import defaultInsights from "@/data/insights.json";
import defaultPosts from "@/data/posts.json";
import { answer } from "@/lib/chat/engine";
import { llmAnswer, llmEnabled, relevantPosts, topicPlatformCrosstab, type HistoryMessage } from "@/lib/chat/llm";
import type { Insights, Post } from "@/lib/types";

/**
 * Brand-manager chat. With LLM_API_KEY set (free-tier Groq/Gemini), questions go
 * to the LLM grounded in the audited insights digest + the most relevant real
 * posts, with chat history for follow-ups. The deterministic intent engine is
 * the always-on fallback, so the chat keeps working if the LLM quota dies.
 * `insights` in the body lets uploaded datasets bring their own numbers.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return Response.json({ error: "Send { message: string }." }, { status: 400 });
  if (message.length > 500) return Response.json({ error: "Keep questions under 500 characters." }, { status: 413 });

  const insights = (body.insights ?? defaultInsights) as Insights;
  const history: HistoryMessage[] = Array.isArray(body.history)
    ? body.history
        .filter((m: unknown): m is HistoryMessage => {
          const h = m as HistoryMessage;
          return (h?.role === "user" || h?.role === "assistant") && typeof h?.text === "string";
        })
        .slice(-6)
    : [];
  const engineReply = answer(message, insights);

  if (llmEnabled()) {
    // Real-post retrieval + crosstab only for the default dataset (uploads stay client-side).
    const posts = body.insights ? null : (defaultPosts as unknown as Post[]);
    const examples = posts ? relevantPosts(message, posts) : [];
    const crosstab = posts ? topicPlatformCrosstab(posts) : undefined;
    const llm = await llmAnswer(message, insights, history, examples, crosstab);
    if (llm) return Response.json({ reply: llm, suggestions: engineReply.suggestions, source: "llm" });
  }
  return Response.json({ ...engineReply, source: "engine" });
}
