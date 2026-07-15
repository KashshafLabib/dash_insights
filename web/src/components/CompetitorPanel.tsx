import type { Insights } from "@/lib/types";
import { num, pct, share } from "@/lib/format";
import { ThemeBars } from "./charts";
import { Card, SectionHeader } from "./ui";

export function CompetitorPanel({ insights }: { insights: Insights }) {
  const c = insights.competitor;
  const { brand, competitor } = insights.meta;
  if (c.mentions === 0) {
    return (
      <Card>
        <SectionHeader title={`${brand} vs ${competitor}`} caption="No competitor mentions in the current selection." />
      </Card>
    );
  }
  const inScope = insights.audit.inScope;
  return (
    <Card>
      <SectionHeader
        title={`${brand} vs ${competitor}`}
        caption={`${num(c.mentions)} posts (${pct(c.mentions / Math.max(inScope, 1))} of the trustworthy feed) bring up ${competitor} — and they name concrete reasons.`}
      />
      <ThemeBars themes={c.themes} />
      <div className="mt-4 space-y-2">
        {c.samples.slice(0, 2).map((s) => (
          <blockquote key={s} className="border-l-2 pl-3 text-sm text-ink-2" style={{ borderColor: "var(--baseline)" }}>
            “{s}”
          </blockquote>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-2">
        <strong className="text-foreground">So what:</strong> {pct(share(c.sentiment, "negative"))} of these posts are
        unfavourable to {brand} — mostly “{competitor} does it better” on charges, cashback and agent coverage. Pricing
        is the clearest competitive exposure.
      </p>
    </Card>
  );
}
