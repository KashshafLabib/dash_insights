import type { Insights } from "@/lib/types";
import { num, pct, prettyTopic, signedPct } from "@/lib/format";
import { Card } from "./ui";

function Kpi({ label, value, caption, tone }: { label: string; value: string; caption: string; tone?: "negative" | "positive" }) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div
        className="text-2xl font-semibold"
        style={tone ? { color: `var(--${tone})` } : undefined}
      >
        {value}
      </div>
      <div className="text-xs text-ink-2">{caption}</div>
    </Card>
  );
}

export function KpiRow({ insights }: { insights: Insights }) {
  const { sentiment, audit, topics, competitor, meta } = insights;
  const top = topics[0];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi
        label="Net sentiment"
        value={signedPct(sentiment.netAudited)}
        caption={`raw feed claimed ${signedPct(sentiment.netRaw)} — the audit found it's worse`}
        tone={sentiment.netAudited < 0 ? "negative" : "positive"}
      />
      <Kpi
        label="Trustworthy posts"
        value={`${num(audit.inScope)}`}
        caption={`of ${num(audit.totalRows)} raw — duplicates & off-topic removed`}
      />
      <Kpi
        label="Top issue"
        value={top ? prettyTopic(top.topic) : "—"}
        caption={top ? `${num(top.posts)} posts, ${pct(top.negShare)} negative` : "no negative topics"}
        tone={top && top.negShare > 0.5 ? "negative" : undefined}
      />
      <Kpi
        label={`${meta.competitor} mentions`}
        value={num(competitor.mentions)}
        caption={competitor.themes[0] ? `top trigger: ${competitor.themes[0].theme.toLowerCase()}` : "no competitor posts"}
      />
    </div>
  );
}
