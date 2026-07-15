import type {
  AuditExample,
  BreakdownRow,
  Insights,
  Post,
  Sentiment,
  SentimentCounts,
  TopicInsight,
  TrendPoint,
} from "../types";
import rules from "../rules/rules.json";

const emptyCounts = (): SentimentCounts => ({ negative: 0, neutral: 0, positive: 0 });

function countSentiments(posts: Post[], pick: (p: Post) => Sentiment | null): SentimentCounts {
  const c = emptyCounts();
  for (const p of posts) {
    const s = pick(p);
    if (s) c[s] += 1;
  }
  return c;
}

const net = (c: SentimentCounts) => {
  const total = c.negative + c.neutral + c.positive;
  return total === 0 ? 0 : (c.positive - c.negative) / total;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function groupBy<K extends string>(posts: Post[], key: (p: Post) => K): Map<K, Post[]> {
  const m = new Map<K, Post[]>();
  for (const p of posts) {
    const k = key(p);
    const arr = m.get(k) ?? [];
    arr.push(p);
    m.set(k, arr);
  }
  return m;
}

function breakdown(posts: Post[], key: (p: Post) => string): BreakdownRow[] {
  return [...groupBy(posts, key)]
    .map(([k, group]) => ({ key: k, posts: group.length, ...countSentiments(group, (p) => p.sentiment) }))
    .sort((a, b) => b.posts - a.posts);
}

function topicInsights(scope: Post[]): TopicInsight[] {
  const globalMedian = median(scope.map((p) => p.reactions)) || 1;
  return [...groupBy(scope, (p) => p.topic)]
    .map(([topic, group]) => {
      const counts = countSentiments(group, (p) => p.sentiment);
      const medianReactions = median(group.map((p) => p.reactions));
      const engagementIndex = globalMedian ? medianReactions / globalMedian : 1;
      return {
        topic,
        posts: group.length,
        ...counts,
        negShare: counts.negative / group.length,
        priority: Number((counts.negative * engagementIndex).toFixed(2)),
        medianReactions,
      };
    })
    .sort((a, b) => b.priority - a.priority || b.posts - a.posts);
}

function trend(scope: Post[]): TrendPoint[] {
  const dated = scope.filter((p) => p.timestamp);
  return [...groupBy(dated, (p) => (p.timestamp as string).slice(0, 10))]
    .map(([date, group]) => {
      const counts = countSentiments(group, (p) => p.sentiment);
      return { date, posts: group.length, ...counts, net: Number(net(counts).toFixed(3)) };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function competitorInsight(scope: Post[]) {
  const comp = scope.filter((p) => p.mentionsCompetitor);
  const themes = rules.competitorThemes
    .map(({ theme, patterns }) => ({
      theme,
      count: comp.filter((p) => patterns.some((pat) => p.text.toLowerCase().includes(pat.toLowerCase()))).length,
    }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
  const samples = [...new Set(comp.map((p) => p.text))].slice(0, 6);
  return { mentions: comp.length, sentiment: countSentiments(comp, (p) => p.sentiment), themes, samples };
}

export function buildInsights(posts: Post[], source: string): Insights {
  const scope = posts.filter((p) => p.inScope);
  const corrections = posts.filter((p) => p.labelCorrected);
  const examples: AuditExample[] = corrections
    .sort((a, b) => (b.sentimentScore ?? 0) - (a.sentimentScore ?? 0))
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      text: p.text,
      platform: p.platform,
      original: p.sentimentOriginal,
      corrected: p.sentiment,
      score: p.sentimentScore,
    }));

  const timestamps = posts.map((p) => p.timestamp).filter((t): t is string => t !== null).sort();
  const raw = countSentiments(posts, (p) => p.sentimentOriginal);
  const audited = countSentiments(scope, (p) => p.sentiment);

  return {
    meta: {
      source,
      brand: rules.brands.primary.name,
      competitor: rules.brands.competitor.name,
      totalRows: posts.length,
      from: timestamps[0]?.slice(0, 10) ?? null,
      to: timestamps[timestamps.length - 1]?.slice(0, 10) ?? null,
      generatedAt: new Date().toISOString(),
      judges: ["template consensus", "multilingual cues"],
    },
    audit: {
      totalRows: posts.length,
      duplicates: posts.filter((p) => p.isDuplicate).length,
      offTopic: posts.filter((p) => p.topic === "off_topic").length,
      noBrandMention: posts.filter((p) => !p.mentionsBrand).length,
      labelsCorrected: corrections.length,
      inScope: scope.length,
      examples,
    },
    sentiment: {
      raw,
      audited,
      netRaw: Number(net(raw).toFixed(3)),
      netAudited: Number(net(audited).toFixed(3)),
    },
    topics: topicInsights(scope.filter((p) => p.topic !== "competitor")),
    trend: trend(scope),
    platforms: breakdown(scope, (p) => p.platform),
    languages: breakdown(scope, (p) => p.language),
    competitor: competitorInsight(scope),
  };
}
