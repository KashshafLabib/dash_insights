"use client";

import { useMemo, useState } from "react";
import defaultInsightsJson from "@/data/insights.json";
import defaultPostsJson from "@/data/posts.json";
import { buildInsights } from "@/lib/scoring";
import type { Insights, Post } from "@/lib/types";
import { num, pct, prettyTopic, share, signedPct } from "@/lib/format";
import { AuditBanner } from "./AuditBanner";
import { ChatWidget } from "./ChatWidget";
import { CompetitorPanel } from "./CompetitorPanel";
import { EMPTY_FILTERS, FilterBar, applyFilters, isFiltering, type Filters } from "./FilterBar";
import { KpiRow } from "./KpiRow";
import { PostsExplorer } from "./PostsExplorer";
import { UploadModal, type UploadResult } from "./UploadModal";
import { BeforeAfterBars, SentimentDonut, SentimentLegend, ShareBars, TopicBars, TrendChart } from "./charts";
import { Card, SectionHeader } from "./ui";

const DEFAULT_POSTS = defaultPostsJson as unknown as Post[];
const DEFAULT_INSIGHTS = defaultInsightsJson as unknown as Insights;
const LANG_LABEL: Record<string, string> = { bn: "Bangla", "bn-en": "Banglish", en: "English", unknown: "Unknown" };

interface Dataset {
  name: string;
  isDefault: boolean;
  posts: Post[];
  insights: Insights;
}

const DEFAULT_DATASET: Dataset = {
  name: "TakaPay sample (660 posts)",
  isDefault: true,
  posts: DEFAULT_POSTS,
  insights: DEFAULT_INSIGHTS,
};

export function Dashboard() {
  const [dataset, setDataset] = useState<Dataset>(DEFAULT_DATASET);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [uploadOpen, setUploadOpen] = useState(false);

  const filtering = isFiltering(filters);
  const filteredPosts = useMemo(
    () => (filtering ? applyFilters(dataset.posts, filters) : dataset.posts),
    [dataset.posts, filters, filtering],
  );
  // Unfiltered: the precomputed (three-judge) insights. Filtered: recomputed
  // client-side from the already-audited posts — same numbers, instant.
  const view: Insights = useMemo(
    () => (filtering ? buildInsights(filteredPosts, dataset.name) : dataset.insights),
    [filtering, filteredPosts, dataset],
  );

  function loadUpload(r: UploadResult) {
    setDataset({ name: r.name, isDefault: false, posts: r.posts, insights: r.insights });
    setFilters(EMPTY_FILTERS);
    setUploadOpen(false);
  }

  const meta = dataset.insights.meta;
  const trendCaption = useMemo(() => {
    const t = view.trend;
    if (t.length < 2) return "Not enough dated posts for a trend.";
    const negDays = t.filter((d) => d.net < 0).length;
    const worst = t.reduce((w, d) => (d.net < w.net ? d : w));
    return `${negDays} of ${t.length} days were net-negative; the worst day was ${worst.date} at ${signedPct(worst.net)}.`;
  }, [view.trend]);

  const langCaption = useMemo(() => {
    const get = (k: string) => view.languages.find((l) => l.key === k);
    const en = get("en");
    const bnEn = get("bn-en");
    if (!en || !bnEn || en.posts < 5 || bnEn.posts < 5) return "Sentiment split by the language people wrote in.";
    return `Praise is in English (${pct(share(en, "positive"))} positive) — pain is in Banglish (${pct(share(bnEn, "negative"))} negative). An English-only read would misjudge this brand.`;
  }, [view.languages]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6">
      {/* Top bar */}
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold tracking-tight">
            {meta.brand} <span style={{ color: "var(--accent)" }}>Pulse</span>
          </h1>
          <p className="text-sm text-ink-2">
            What social media is saying · {dataset.name}
            {meta.from && meta.to && ` · ${meta.from} → ${meta.to}`}
          </p>
        </div>
        {!dataset.isDefault && (
          <button
            onClick={() => {
              setDataset(DEFAULT_DATASET);
              setFilters(EMPTY_FILTERS);
            }}
            className="rounded-lg border border-hairline px-3 py-2 text-sm text-ink-2 hover:bg-surface"
          >
            ← Back to sample data
          </button>
        )}
        <button
          onClick={() => setUploadOpen(true)}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          Upload your data
        </button>
      </header>

      <div className="space-y-4">
        <AuditBanner insights={dataset.insights} />
        <FilterBar posts={dataset.posts} filters={filters} onChange={setFilters} />

        {view.audit.inScope === 0 ? (
          <Card>
            <p className="py-10 text-center text-sm text-muted">
              Nothing matches the current filters — clear one or two and the charts will come back.
            </p>
          </Card>
        ) : (
          <>
            <KpiRow insights={view} />

            {/* Sentiment */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <SectionHeader
                  title="The sentiment picture"
                  caption={`${num(view.audit.inScope)} trustworthy posts — negative clearly outweighs positive.`}
                />
                <SentimentDonut counts={view.sentiment.audited} net={view.sentiment.netAudited} />
                <SentimentLegend />
              </Card>
              <Card>
                <SectionHeader
                  title="Before vs after the audit"
                  caption={`${num(view.audit.labelsCorrected)} labels contradicted their own text — most were complaints hiding in the positive pile.`}
                />
                <BeforeAfterBars raw={view.sentiment.raw} audited={view.sentiment.audited} />
              </Card>
            </div>

            {/* Trend */}
            <Card>
              <SectionHeader title="Is it getting better?" caption={trendCaption} />
              <TrendChart trend={view.trend} />
            </Card>

            {/* Topics */}
            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <SectionHeader
                  title="What people talk about"
                  caption="Every topic with its sentiment mix — red blocks are the problem areas."
                />
                <TopicBars topics={view.topics} />
                <SentimentLegend />
              </Card>
              <Card className="lg:col-span-2">
                <SectionHeader
                  title="Fix first"
                  caption="Negative volume × engagement. What moves the needle, in order."
                />
                <ol className="space-y-3">
                  {view.topics.filter((t) => t.priority > 0).slice(0, 5).map((t, i) => (
                    <li key={t.topic} className="flex items-center gap-3">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: i === 0 ? "var(--negative)" : "var(--baseline)" }}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{prettyTopic(t.topic)}</div>
                        <div className="text-xs text-ink-2">
                          {num(t.posts)} posts · {pct(t.negShare)} negative · priority {t.priority.toFixed(0)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                {view.topics[0] && view.topics[1] && view.topics[1].priority > 0 && (
                  <p className="mt-4 text-sm text-ink-2">
                    <strong className="text-foreground">So what:</strong> {prettyTopic(view.topics[0].topic)} is{" "}
                    {Math.max(Math.round(view.topics[0].priority / view.topics[1].priority), 1)}× the priority of
                    anything else. Fixing it changes the whole picture.
                  </p>
                )}
              </Card>
            </div>

            {/* Competitor + language */}
            <div className="grid gap-4 lg:grid-cols-2">
              <CompetitorPanel insights={view} />
              <div className="space-y-4">
                <Card>
                  <SectionHeader title="The language lens" caption={langCaption} />
                  <ShareBars rows={view.languages} labelMap={LANG_LABEL} />
                  <SentimentLegend />
                </Card>
                <Card>
                  <SectionHeader title="By platform" caption="The mix is similar everywhere — this is a product problem, not a platform problem." />
                  <ShareBars rows={view.platforms} />
                  <SentimentLegend />
                </Card>
              </div>
            </div>

            <PostsExplorer posts={filteredPosts} />
          </>
        )}
      </div>

      <footer className="mt-8 text-center text-xs text-muted">
        Sentiment audited by {meta.judges.join(" + ")} · posts shown in their original language
      </footer>

      <ChatWidget insights={view} isDefaultData={dataset.isDefault && !filtering} />
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onLoaded={loadUpload} />}
    </div>
  );
}
