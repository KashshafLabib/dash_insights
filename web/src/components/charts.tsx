"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Insights, SentimentCounts } from "@/lib/types";
import { pct, prettyTopic, shortDate, signedPct } from "@/lib/format";

const SENT = {
  positive: "var(--positive)",
  neutral: "var(--neutral)",
  negative: "var(--negative)",
} as const;

const AXIS_TICK = { fill: "var(--muted)", fontSize: 12 } as const;

function ChartTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: string;
  rows: { name: string; value: string; color?: string }[];
}) {
  if (!active) return null;
  return (
    <div className="rounded-lg border border-hairline bg-surface px-3 py-2 text-xs shadow-sm">
      {label && <div className="mb-1 font-semibold">{label}</div>}
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2">
          {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span className="text-ink-2">{r.name}</span>
          <span className="ml-auto pl-3 font-medium">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Sentiment donut ---------- */

export function SentimentDonut({ counts, net }: { counts: SentimentCounts; net: number }) {
  const data = (["negative", "neutral", "positive"] as const).map((k) => ({
    name: k,
    value: counts[k],
    fill: SENT[k],
  }));
  const total = counts.negative + counts.neutral + counts.positive;
  return (
    <div className="relative h-56">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="68%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                rows={(payload ?? []).map((p) => ({
                  name: String(p.name),
                  value: `${p.value} (${pct(Number(p.value) / Math.max(total, 1))})`,
                  color: (p.payload as { fill: string }).fill,
                }))}
              />
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-semibold" style={{ color: net < 0 ? "var(--negative)" : "var(--positive)" }}>
          {signedPct(net)}
        </div>
        <div className="text-xs text-muted">net sentiment</div>
      </div>
    </div>
  );
}

/* ---------- Raw vs audited grouped bars ---------- */

export function BeforeAfterBars({ raw, audited }: { raw: SentimentCounts; audited: SentimentCounts }) {
  const data = (["negative", "neutral", "positive"] as const).map((k) => ({
    name: k,
    raw: raw[k],
    audited: audited[k],
    fill: SENT[k],
  }));
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <BarChart data={data} barGap={4} margin={{ top: 20, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="name" tick={AXIS_TICK} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--grid)", opacity: 0.35 }}
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                label={String(label ?? "")}
                rows={(payload ?? []).map((p) => ({
                  name: p.dataKey === "raw" ? "raw labels" : "after audit",
                  value: String(p.value),
                }))}
              />
            )}
          />
          <Bar
            dataKey="raw"
            isAnimationActive={false}
            shape={(props: unknown) => {
              const p = props as { payload: { fill: string } } & Record<string, unknown>;
              return <Rectangle {...p} fill={p.payload.fill} opacity={0.4} radius={[4, 4, 0, 0]} />;
            }}
          />
          <Bar
            dataKey="audited"
            isAnimationActive={false}
            shape={(props: unknown) => {
              const p = props as { payload: { fill: string } } & Record<string, unknown>;
              return <Rectangle {...p} fill={p.payload.fill} radius={[4, 4, 0, 0]} />;
            }}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex justify-center gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-foreground/25" /> raw labels
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-foreground/70" /> after audit
        </span>
      </div>
    </div>
  );
}

/* ---------- Daily net-sentiment trend ---------- */

export function TrendChart({ trend }: { trend: Insights["trend"] }) {
  const data = trend.map((t) => ({ ...t, label: shortDate(t.date) }));
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => signedPct(v)}
            domain={[(min: number) => Math.min(min - 0.08, -0.1), (max: number) => Math.max(max + 0.08, 0.1)]}
          />
          <ReferenceLine y={0} stroke="var(--baseline)" />
          <Tooltip
            cursor={{ stroke: "var(--baseline)" }}
            content={({ active, payload, label }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
              return (
                <ChartTooltip
                  active={active && Boolean(p)}
                  label={String(label ?? "")}
                  rows={
                    p
                      ? [
                          { name: "net sentiment", value: signedPct(p.net), color: "var(--accent)" },
                          { name: "posts", value: String(p.posts) },
                          { name: "negative", value: String(p.negative), color: SENT.negative },
                          { name: "positive", value: String(p.positive), color: SENT.positive },
                        ]
                      : []
                  }
                />
              );
            }}
          />
          <Line type="monotone" dataKey="net" stroke="var(--accent)" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Topic stacked bars ---------- */

export function TopicBars({ topics }: { topics: Insights["topics"] }) {
  const data = [...topics]
    .sort((a, b) => b.posts - a.posts)
    .map((t) => ({ ...t, name: prettyTopic(t.topic) }));
  const height = Math.max(data.length * 34 + 30, 120);
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }} barSize={16}>
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" tick={AXIS_TICK} axisLine={{ stroke: "var(--baseline)" }} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fill: "var(--ink-2)" }} width={120} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--grid)", opacity: 0.35 }}
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                label={String(label ?? "")}
                rows={(payload ?? []).map((p) => ({
                  name: String(p.dataKey),
                  value: String(p.value),
                  color: SENT[p.dataKey as keyof typeof SENT],
                }))}
              />
            )}
          />
          <Bar dataKey="negative" stackId="s" fill={SENT.negative} stroke="var(--surface)" strokeWidth={1} isAnimationActive={false} />
          <Bar dataKey="neutral" stackId="s" fill={SENT.neutral} stroke="var(--surface)" strokeWidth={1} isAnimationActive={false} />
          <Bar dataKey="positive" stackId="s" fill={SENT.positive} stroke="var(--surface)" strokeWidth={1} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- 100% stacked share bars (language / platform) ---------- */

export function ShareBars({ rows, labelMap }: { rows: Insights["languages"]; labelMap?: Record<string, string> }) {
  const data = rows.map((r) => {
    const total = Math.max(r.negative + r.neutral + r.positive, 1);
    return {
      name: labelMap?.[r.key] ?? r.key,
      posts: r.posts,
      negative: r.negative / total,
      neutral: r.neutral / total,
      positive: r.positive / total,
      counts: r,
    };
  });
  const height = Math.max(data.length * 40 + 30, 110);
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 30, bottom: 0 }} barSize={18}>
          <XAxis type="number" domain={[0, 1]} hide />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fill: "var(--ink-2)" }} width={90} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--grid)", opacity: 0.35 }}
            content={({ active, payload, label }) => {
              const c = (payload?.[0]?.payload as (typeof data)[number] | undefined)?.counts;
              return (
                <ChartTooltip
                  active={active && Boolean(c)}
                  label={`${label} — ${c?.posts ?? 0} posts`}
                  rows={
                    c
                      ? (["negative", "neutral", "positive"] as const).map((k) => ({
                          name: k,
                          value: `${c[k]} (${pct(c[k] / Math.max(c.posts, 1))})`,
                          color: SENT[k],
                        }))
                      : []
                  }
                />
              );
            }}
          />
          <Bar dataKey="negative" stackId="s" fill={SENT.negative} stroke="var(--surface)" strokeWidth={1} isAnimationActive={false} />
          <Bar dataKey="neutral" stackId="s" fill={SENT.neutral} stroke="var(--surface)" strokeWidth={1} isAnimationActive={false} />
          <Bar dataKey="positive" stackId="s" fill={SENT.positive} stroke="var(--surface)" strokeWidth={1} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SentimentLegend() {
  return (
    <div className="mt-2 flex gap-4 text-xs text-ink-2">
      {(["negative", "neutral", "positive"] as const).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: SENT[k] }} /> {k}
        </span>
      ))}
    </div>
  );
}

/* ---------- Competitor theme bars ---------- */

export function ThemeBars({ themes }: { themes: { theme: string; count: number }[] }) {
  const height = Math.max(themes.length * 34 + 10, 100);
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={themes} layout="vertical" margin={{ top: 0, right: 34, left: 60, bottom: 0 }} barSize={14}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="theme" tick={{ ...AXIS_TICK, fill: "var(--ink-2)" }} width={150} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--grid)", opacity: 0.35 }}
            content={({ active, payload, label }) => (
              <ChartTooltip active={active} label={String(label ?? "")} rows={(payload ?? []).map((p) => ({ name: "posts", value: String(p.value) }))} />
            )}
          />
          <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: "right", fill: "var(--ink-2)", fontSize: 12 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
