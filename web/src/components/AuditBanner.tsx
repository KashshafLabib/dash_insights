"use client";

import { useState } from "react";
import type { Insights } from "@/lib/types";
import { num, pct } from "@/lib/format";
import { SentimentBadge } from "./ui";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-sm font-semibold">{value}</span>
      <span className="text-xs text-ink-2">{label}</span>
    </div>
  );
}

/** The trust panel: what the audit corrected before anything reached this page. */
export function AuditBanner({ insights }: { insights: Insights }) {
  const [open, setOpen] = useState(false);
  const a = insights.audit;
  return (
    <div className="rounded-xl border border-hairline bg-surface">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
          style={{ background: "var(--accent-soft)" }}
        >
          ✓
        </span>
        <div className="mr-auto">
          <div className="text-sm font-semibold">This data has been audited</div>
          <div className="text-xs text-ink-2">
            Every number below uses corrected labels and only the {num(a.inScope)} posts that are genuine brand signal.
          </div>
        </div>
        <Stat value={num(a.labelsCorrected)} label={`labels fixed (${pct(a.labelsCorrected / Math.max(a.totalRows, 1))})`} />
        <Stat value={num(a.duplicates)} label="duplicates removed" />
        <Stat value={num(a.offTopic)} label="off-topic excluded" />
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-background"
        >
          {open ? "Hide details" : "See what was fixed"}
        </button>
      </div>

      {open && (
        <div className="border-t border-hairline px-5 py-4">
          <p className="mb-3 text-sm text-ink-2">
            Labels were corrected only when at least two independent checks agreed the shipped label contradicts the
            text ({insights.meta.judges.join(", ")}). Examples:
          </p>
          <ul className="space-y-2.5">
            {a.examples.slice(0, 5).map((ex) => (
              <li key={ex.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink-2" title={ex.text}>
                  “{ex.text}”
                </span>
                {ex.original && <SentimentBadge sentiment={ex.original} />}
                <span aria-hidden className="text-muted">→</span>
                <SentimentBadge sentiment={ex.corrected} />
                {ex.score !== null && (
                  <span className="text-xs text-muted">shipped score {ex.score}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
