import defaultInsights from "@/data/insights.json";
import { answer } from "@/lib/chat/engine";
import { llmAnswer, llmEnabled } from "@/lib/chat/llm";
import type { Insights } from "@/lib/types";

/**
 * Brand-manager chat. Deterministic intent engine by default (zero hallucination
 * risk); upgrades to a free-tier LLM when LLM_API_KEY is configured. `insights`
 * in the body lets uploaded datasets bring their own numbers — stateless server.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return Response.json({ error: "Send { message: string }." }, { status: 400 });
  if (message.length > 500) return Response.json({ error: "Keep questions under 500 characters." }, { status: 413 });

  const insights = (body.insights ?? defaultInsights) as Insights;
  const engineReply = answer(message, insights);

  if (llmEnabled()) {
    const llm = await llmAnswer(message, insights);
    if (llm) return Response.json({ reply: llm, suggestions: engineReply.suggestions, source: "llm" });
  }
  return Response.json({ ...engineReply, source: "engine" });
}
