import type { Insights, Post } from "../types";

export interface HistoryMessage {
  role: "user" | "assistant";
  text: string;
}

/** Keyword-overlap retrieval: the posts most relevant to the question. */
export function relevantPosts(message: string, posts: Post[], limit = 6): Post[] {
  const words = message
    .toLowerCase()
    .split(/[^\p{L}\d]+/u)
    .filter((w) => w.length > 2);
  if (words.length === 0) return [];
  return posts
    .filter((p) => p.inScope)
    .map((p) => {
      const t = `${p.text} ${p.topic} ${p.platform}`.toLowerCase();
      return { p, score: words.filter((w) => t.includes(w)).length };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.p.reactions - a.p.reactions)
    .slice(0, limit)
    .map((r) => r.p);
}

/**
 * Optional free-tier LLM upgrade for the chat. Works with any OpenAI-compatible
 * endpoint — Groq and Google Gemini both offer keyless-billing free tiers:
 *   LLM_API_KEY   (required to enable)
 *   LLM_BASE_URL  (default: Groq)
 *   LLM_MODEL     (default: llama-3.3-70b-versatile)
 * Without a key the deterministic engine answers everything.
 */
export function llmEnabled(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

function digest(i: Insights): string {
  const s = i.sentiment;
  return JSON.stringify({
    brand: i.meta.brand,
    competitor: i.meta.competitor,
    period: `${i.meta.from}..${i.meta.to}`,
    posts_total: i.meta.totalRows,
    posts_trustworthy: i.audit.inScope,
    audit: {
      labels_corrected: i.audit.labelsCorrected,
      duplicates: i.audit.duplicates,
      off_topic: i.audit.offTopic,
      example_fix: i.audit.examples[0] ?? null,
    },
    sentiment_audited: s.audited,
    net_sentiment: { raw: s.netRaw, audited: s.netAudited },
    topics: i.topics.map((t) => ({ topic: t.topic, posts: t.posts, negative: t.negative, priority: t.priority })),
    competitor_view: { mentions: i.competitor.mentions, themes: i.competitor.themes },
    languages: i.languages,
    platforms: i.platforms.map((p) => ({ platform: p.key, posts: p.posts, negative: p.negative, positive: p.positive })),
    worst_day: i.trend.length ? i.trend.reduce((w, r) => (r.net < w.net ? r : w)) : null,
  });
}

/** topic × platform negative-post counts, so "compare X and Y on Z" gets real numbers. */
export function topicPlatformCrosstab(posts: Post[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const p of posts) {
    if (!p.inScope || p.sentiment !== "negative") continue;
    out[p.topic] ??= {};
    out[p.topic][p.platform] = (out[p.topic][p.platform] ?? 0) + 1;
  }
  return out;
}

export async function llmAnswer(
  message: string,
  insights: Insights,
  history: HistoryMessage[] = [],
  examples: Post[] = [],
  crosstab?: Record<string, Record<string, number>>,
): Promise<string | null> {
  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
  const model = process.env.LLM_MODEL ?? "llama-3.3-70b-versatile";
  const posts = examples.length
    ? "\nRELEVANT POSTS (real examples you may quote): " +
      JSON.stringify(
        examples.map((p) => ({
          text: p.text,
          platform: p.platform,
          date: p.timestamp?.slice(0, 10),
          sentiment: p.sentiment,
          topic: p.topic,
        })),
      )
    : "";
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "You are a friendly analyst helping a non-technical brand manager understand their social media data. " +
              "Answer ONLY from the JSON below — never invent numbers or posts. Keep answers short (2-4 sentences " +
              "unless the question genuinely needs more), plain-language, and end with the single most actionable " +
              "takeaway when relevant. Answer in the language the user writes in. " +
              `INSIGHTS: ${digest(insights)}${posts}` +
              (crosstab ? `\nNEGATIVE POSTS BY TOPIC AND PLATFORM: ${JSON.stringify(crosstab)}` : ""),
          },
          ...history.slice(-6).map((m) => ({ role: m.role, content: m.text })),
          { role: "user", content: message },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
