export type Sentiment = "negative" | "neutral" | "positive";

export type Language = "bn" | "bn-en" | "en" | "unknown";

/** One canonical social post after normalization + audit. */
export interface Post {
  id: string;
  platform: string;
  /** ISO 8601, or null when the source row had no parseable timestamp. */
  timestamp: string | null;
  author: string;
  text: string;
  language: Language;
  /** Sentiment label as shipped in the source data (null if the source had none). */
  sentimentOriginal: Sentiment | null;
  sentimentScore: number | null;
  /** Sentiment after the audit vote — what the dashboard shows. */
  sentiment: Sentiment;
  labelCorrected: boolean;
  topic: string;
  reactions: number;
  comments: number;
  mentionsBrand: boolean;
  mentionsCompetitor: boolean;
  isDuplicate: boolean;
  /** Deduped and on-topic — the only rows that feed brand metrics. */
  inScope: boolean;
}

export interface SentimentCounts {
  negative: number;
  neutral: number;
  positive: number;
}

export interface AuditExample {
  id: string;
  text: string;
  platform: string;
  original: Sentiment | null;
  corrected: Sentiment;
  score: number | null;
}

export interface TopicInsight extends SentimentCounts {
  topic: string;
  posts: number;
  negShare: number;
  /** negatives × engagement index — the fix-first ranking. */
  priority: number;
  medianReactions: number;
}

export interface TrendPoint extends SentimentCounts {
  date: string;
  posts: number;
  /** (positive − negative) / posts for the day. */
  net: number;
}

export interface BreakdownRow extends SentimentCounts {
  key: string;
  posts: number;
}

export interface CompetitorInsight {
  mentions: number;
  sentiment: SentimentCounts;
  themes: { theme: string; count: number }[];
  samples: string[];
}

export interface Insights {
  meta: {
    source: string;
    brand: string;
    competitor: string;
    totalRows: number;
    from: string | null;
    to: string | null;
    generatedAt: string;
    judges: string[];
  };
  audit: {
    totalRows: number;
    duplicates: number;
    offTopic: number;
    noBrandMention: number;
    labelsCorrected: number;
    inScope: number;
    examples: AuditExample[];
  };
  sentiment: {
    raw: SentimentCounts;
    audited: SentimentCounts;
    netRaw: number;
    netAudited: number;
  };
  topics: TopicInsight[];
  trend: TrendPoint[];
  platforms: BreakdownRow[];
  languages: BreakdownRow[];
  competitor: CompetitorInsight;
}
