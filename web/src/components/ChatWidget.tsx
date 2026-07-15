"use client";

import { useEffect, useRef, useState } from "react";
import type { Insights } from "@/lib/types";
import { Markdown } from "./Markdown";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const OPENERS = [
  "How is overall sentiment?",
  "What should we fix first?",
  "How do we compare with the competitor?",
  "Can I trust this data?",
];

export function ChatWidget({ insights, isDefaultData }: { insights: Insights; isDefaultData: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(OPENERS);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    setBusy(true);
    try {
      const history = messages.slice(-6);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Uploaded datasets carry their own numbers; the default is bundled server-side.
        body: JSON.stringify(isDefaultData ? { message, history } : { message, history, insights }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.reply ?? data.error ?? "Something went wrong." }]);
      if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "I couldn't reach the server — try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Ask the data a question"}
        className="fixed bottom-5 right-5 z-40 flex h-13 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-lg"
        style={{ background: "var(--accent)", height: 48 }}
      >
        {open ? "Close" : "💬 Ask the data"}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-130 w-95 max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xl">
          <div className="border-b border-hairline px-4 py-3">
            <div className="text-sm font-semibold">Ask the data</div>
            <div className="text-xs text-ink-2">Plain-language answers from the audited numbers — no made-up figures.</div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-ink-2">
                Hi! I can explain this dashboard in plain language. Try one of the questions below.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  m.role === "user" ? "ml-auto text-white" : "border border-hairline bg-background"
                }`}
                style={m.role === "user" ? { background: "var(--accent)" } : undefined}
              >
                {m.role === "assistant" ? <Markdown text={m.text} /> : m.text}
              </div>
            ))}
            {busy && <div className="text-sm text-muted">Thinking…</div>}
          </div>

          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {suggestions.slice(0, 3).map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-hairline px-2.5 py-1 text-xs text-ink-2 hover:bg-background"
              >
                {s}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-hairline p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about this data…"
              className="flex-1 rounded-lg border border-hairline bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
