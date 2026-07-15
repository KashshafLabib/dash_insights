import type { Insights } from "../types";

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

export async function llmAnswer(message: string, insights: Insights): Promise<string | null> {
  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
  const model = process.env.LLM_MODEL ?? "llama-3.3-70b-versatile";
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
              "Answer ONLY from the JSON insights below — never invent numbers. Keep answers short (2-4 sentences), " +
              "plain-language, and end with the single most actionable takeaway when relevant. " +
              `INSIGHTS: ${digest(insights)}`,
          },
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
