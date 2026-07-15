import type { Post, Sentiment } from "../types";
import rules from "../rules/rules.json";
import {
  RawRow,
  mapColumns,
  normalizeLanguage,
  normalizeSentiment,
  normalizeTimestamp,
  toNumber,
} from "./normalize";

const includesAny = (text: string, patterns: string[]) => {
  const t = text.toLowerCase();
  return patterns.some((p) => t.includes(p.toLowerCase()));
};

const countMatches = (text: string, patterns: string[]) => {
  const t = text.toLowerCase();
  return patterns.filter((p) => t.includes(p.toLowerCase())).length;
};

/** Judge 1 — transparent multilingual polarity cues. */
export function judgeCues(text: string): Sentiment | null {
  const neg = countMatches(text, rules.sentimentCues.negative);
  const pos = countMatches(text, rules.sentimentCues.positive);
  if (neg > pos) return "negative";
  if (pos > neg) return "positive";
  return includesAny(text, rules.sentimentCues.neutral) ? "neutral" : null;
}

/** Strip amounts, operators, locations, relations → the underlying template. */
export function templateOf(text: string): string {
  let t = text;
  for (const rule of rules.templateNormalization) {
    t = t.replace(new RegExp(rule.pattern, rule.ignoreCase ? "gi" : "g"), rule.replace);
  }
  return t;
}

/** Judge 2 — majority label among rows sharing the same template. */
export function templateConsensus(
  templates: string[],
  labels: (Sentiment | null)[],
): Map<string, Sentiment> {
  const byTemplate = new Map<string, Sentiment[]>();
  templates.forEach((tpl, i) => {
    const label = labels[i];
    if (!label) return;
    const arr = byTemplate.get(tpl) ?? [];
    arr.push(label);
    byTemplate.set(tpl, arr);
  });
  const out = new Map<string, Sentiment>();
  const { minRows, minShare } = rules.templateConsensus;
  for (const [tpl, arr] of byTemplate) {
    if (arr.length < minRows) continue;
    const counts = new Map<Sentiment, number>();
    for (const l of arr) counts.set(l, (counts.get(l) ?? 0) + 1);
    const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n / arr.length >= minShare) out.set(tpl, top);
  }
  return out;
}

/** Correct a label only when ≥ 2 independent judges agree on a different one. */
export function vote(
  original: Sentiment | null,
  judges: (Sentiment | null)[],
): { sentiment: Sentiment; corrected: boolean } {
  const votes = judges.filter((j): j is Sentiment => j !== null);
  const counts = new Map<Sentiment, number>();
  for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (original) {
    if (top && top[1] >= 2 && top[0] !== original) return { sentiment: top[0], corrected: true };
    return { sentiment: original, corrected: false };
  }
  // No label in the source data — the judges ARE the label.
  return { sentiment: top ? top[0] : "neutral", corrected: false };
}

export function classifyTopic(
  text: string,
  mentionsBrand: boolean,
  mentionsCompetitor: boolean,
): string {
  if (mentionsCompetitor && !mentionsBrand) return "competitor";
  for (const { topic, patterns } of rules.topics) {
    if (includesAny(text, patterns)) return topic;
  }
  if (mentionsCompetitor) return "competitor";
  return mentionsBrand ? "general" : "off_topic";
}

/** Full audit: normalize rows → flag → judge → vote. Pure and deterministic. */
export function auditRows(rows: RawRow[]): Post[] {
  const drafts = rows.map((row, i) => {
    const m = mapColumns(row);
    const text = String(m.text ?? "").trim();
    const mentionsBrand = includesAny(text, rules.brands.primary.patterns);
    const mentionsCompetitor = includesAny(text, rules.brands.competitor.patterns);
    const sourceTopic = m.topic ? String(m.topic).trim() : null;
    return {
      id: m.id !== undefined && m.id !== null && m.id !== "" ? String(m.id) : `row-${i + 1}`,
      platform: String(m.platform ?? "Unknown").trim() || "Unknown",
      timestamp: normalizeTimestamp(m.timestamp),
      author: String(m.author ?? "unknown").trim() || "unknown",
      text,
      language: normalizeLanguage(m.language, text),
      sentimentOriginal: normalizeSentiment(m.sentiment),
      sentimentScore: toNumber(m.sentiment_score),
      topic: sourceTopic || classifyTopic(text, mentionsBrand, mentionsCompetitor),
      reactions: toNumber(m.reactions) ?? 0,
      comments: toNumber(m.comments) ?? 0,
      mentionsBrand,
      mentionsCompetitor,
    };
  });

  const templates = drafts.map((d) => templateOf(d.text));
  const cueVerdicts = drafts.map((d) => judgeCues(d.text));
  // Consensus is built over the best available per-row reference: the source
  // label when present, otherwise the cue verdict.
  const references = drafts.map((d, i) => d.sentimentOriginal ?? cueVerdicts[i]);
  const consensus = templateConsensus(templates, references);

  const seenTexts = new Set<string>();
  return drafts.map((d, i) => {
    const tplVerdict = consensus.get(templates[i]) ?? null;
    const { sentiment, corrected } = vote(d.sentimentOriginal, [tplVerdict, cueVerdicts[i]]);
    const isDuplicate = seenTexts.has(d.text);
    seenTexts.add(d.text);
    const inScope = !isDuplicate && d.topic !== "off_topic" && d.text.length > 0;
    return { ...d, sentiment, labelCorrected: corrected, isDuplicate, inScope };
  });
}
