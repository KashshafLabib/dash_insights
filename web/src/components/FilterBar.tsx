"use client";

import type { Post } from "@/lib/types";
import { prettyTopic } from "@/lib/format";

export interface Filters {
  topic: string;
  sentiment: string;
  platform: string;
  language: string;
  from: string;
  to: string;
}

export const EMPTY_FILTERS: Filters = { topic: "all", sentiment: "all", platform: "all", language: "all", from: "", to: "" };

export function isFiltering(f: Filters) {
  return f !== EMPTY_FILTERS && (f.topic !== "all" || f.sentiment !== "all" || f.platform !== "all" || f.language !== "all" || f.from !== "" || f.to !== "");
}

export function applyFilters(posts: Post[], f: Filters): Post[] {
  return posts.filter((p) => {
    if (f.topic !== "all" && p.topic !== f.topic) return false;
    if (f.sentiment !== "all" && p.sentiment !== f.sentiment) return false;
    if (f.platform !== "all" && p.platform !== f.platform) return false;
    if (f.language !== "all" && p.language !== f.language) return false;
    const day = p.timestamp?.slice(0, 10);
    if (f.from && (!day || day < f.from)) return false;
    if (f.to && (!day || day > f.to)) return false;
    return true;
  });
}

const LANG_LABEL: Record<string, string> = { bn: "Bangla", "bn-en": "Banglish", en: "English", unknown: "Unknown" };

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-2">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-hairline bg-surface px-2 py-1.5 text-xs text-foreground"
      >
        <option value="all">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({
  posts,
  filters,
  onChange,
}: {
  posts: Post[];
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const uniq = (key: (p: Post) => string) => [...new Set(posts.map(key))].sort();
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3">
      <Select
        label="Topic"
        value={filters.topic}
        options={uniq((p) => p.topic).map((t) => ({ value: t, label: prettyTopic(t) }))}
        onChange={(topic) => set({ topic })}
      />
      <Select
        label="Sentiment"
        value={filters.sentiment}
        options={["negative", "neutral", "positive"].map((s) => ({ value: s, label: s }))}
        onChange={(sentiment) => set({ sentiment })}
      />
      <Select
        label="Platform"
        value={filters.platform}
        options={uniq((p) => p.platform).map((p) => ({ value: p, label: p }))}
        onChange={(platform) => set({ platform })}
      />
      <Select
        label="Language"
        value={filters.language}
        options={uniq((p) => p.language).map((l) => ({ value: l, label: LANG_LABEL[l] ?? l }))}
        onChange={(language) => set({ language })}
      />
      <label className="flex items-center gap-1.5 text-xs text-ink-2">
        From
        <input
          type="date"
          value={filters.from}
          onChange={(e) => set({ from: e.target.value })}
          className="rounded-lg border border-hairline bg-surface px-2 py-1 text-xs text-foreground"
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-ink-2">
        To
        <input
          type="date"
          value={filters.to}
          onChange={(e) => set({ to: e.target.value })}
          className="rounded-lg border border-hairline bg-surface px-2 py-1 text-xs text-foreground"
        />
      </label>
      {isFiltering(filters) && (
        <button onClick={() => onChange(EMPTY_FILTERS)} className="ml-auto text-xs font-medium text-accent hover:underline">
          Clear filters
        </button>
      )}
    </div>
  );
}
