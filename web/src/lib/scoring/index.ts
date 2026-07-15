import type { Insights, Post } from "../types";
import type { RawRow } from "./normalize";
import { auditRows } from "./audit";
import { buildInsights } from "./aggregate";

export type { RawRow } from "./normalize";

export { auditRows, judgeCues, templateOf, templateConsensus, vote, classifyTopic } from "./audit";
export { buildInsights } from "./aggregate";
export {
  mapColumns,
  normalizeSentiment,
  normalizeTimestamp,
  detectLanguage,
  normalizeLanguage,
} from "./normalize";

/** The whole upload pipeline: raw rows in, audited posts + insights out. */
export function runPipeline(rows: RawRow[], source: string): { posts: Post[]; insights: Insights } {
  const posts = auditRows(rows);
  return { posts, insights: buildInsights(posts, source) };
}
