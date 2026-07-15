import type { SentimentCounts } from "./types";

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const signedPct = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n * 100)}%`;

export const num = (n: number) => n.toLocaleString("en-US");

export const share = (c: SentimentCounts, key: keyof SentimentCounts) => {
  const total = c.negative + c.neutral + c.positive;
  return total === 0 ? 0 : c[key] / total;
};

export const prettyTopic = (t: string) =>
  t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
