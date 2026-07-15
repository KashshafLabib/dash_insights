import type { Language, Sentiment } from "../types";
import rules from "../rules/rules.json";

/** Column aliases accepted when a brand manager brings their own CSV/JSON. */
const ALIASES: Record<string, string[]> = {
  id: ["id", "post_id", "postid", "_id", "uid"],
  platform: ["platform", "source", "channel", "network"],
  timestamp: ["timestamp", "date", "datetime", "created_at", "createdat", "time", "posted_at"],
  author: ["author", "user", "username", "name", "handle", "account"],
  text: ["text", "content", "message", "post", "body", "caption", "comment_text"],
  language: ["language", "lang", "locale"],
  sentiment: ["sentiment", "label", "sentiment_label", "polarity"],
  sentiment_score: ["sentiment_score", "sentimentscore", "score", "confidence"],
  topic: ["topic", "category", "theme", "tag"],
  reactions: ["reactions", "likes", "reaction_count", "reactioncount", "upvotes"],
  comments: ["comments", "comment_count", "commentcount", "replies", "reply_count"],
};

export interface RawRow {
  [key: string]: unknown;
}

/** Map a raw row's keys onto the canonical field names (case/space tolerant). */
export function mapColumns(row: RawRow): Partial<Record<keyof typeof ALIASES, unknown>> {
  const lookup = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    lookup.set(k.toLowerCase().replace(/[\s_-]/g, ""), v);
  }
  const out: Partial<Record<string, unknown>> = {};
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      const key = alias.replace(/[\s_-]/g, "");
      if (lookup.has(key)) {
        out[canonical] = lookup.get(key);
        break;
      }
    }
  }
  return out;
}

export function normalizeSentiment(value: unknown): Sentiment | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim().toLowerCase();
  if (["positive", "pos", "1", "good"].includes(v)) return "positive";
  if (["negative", "neg", "-1", "bad"].includes(v)) return "negative";
  if (["neutral", "neu", "0", "mixed"].includes(v)) return "neutral";
  return null;
}

export function normalizeTimestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).trim().replace(" ", "T");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19);
}

const BENGALI_RE = /[ঀ-৿]/g;

/** Script-aware language detection for rows that don't declare one. */
export function detectLanguage(text: string): Language {
  const bengali = (text.match(BENGALI_RE) ?? []).length;
  const letters = (text.match(/[\p{L}]/gu) ?? []).length;
  if (letters === 0) return "unknown";
  if (bengali / letters > 0.3) return "bn";
  const lower = ` ${text.toLowerCase()} `;
  const markers = rules.banglishMarkers.filter((m) => lower.includes(` ${m} `) || lower.includes(` ${m},`)).length;
  if (bengali > 0 || markers >= 2) return "bn-en";
  return "en";
}

export function normalizeLanguage(value: unknown, text: string): Language {
  const v = String(value ?? "").trim().toLowerCase();
  if (["bn", "bangla", "bengali"].includes(v)) return "bn";
  if (["bn-en", "banglish", "mixed"].includes(v)) return "bn-en";
  if (["en", "english"].includes(v)) return "en";
  return detectLanguage(text);
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
