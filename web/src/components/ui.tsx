import type { ReactNode } from "react";
import type { Sentiment } from "@/lib/types";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-hairline bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {caption && <p className="mt-1 text-sm text-ink-2">{caption}</p>}
    </div>
  );
}

const SENTIMENT_STYLE: Record<Sentiment, string> = {
  positive: "bg-positive/12 text-positive",
  negative: "bg-negative/12 text-negative",
  neutral: "bg-neutral/15 text-ink-2",
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SENTIMENT_STYLE[sentiment]}`}>
      {sentiment}
    </span>
  );
}

export function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 rounded-full align-middle"
      style={{ background: color }}
    />
  );
}
