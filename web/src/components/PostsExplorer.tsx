"use client";

import { useMemo, useState } from "react";
import type { Post } from "@/lib/types";
import { num, prettyTopic } from "@/lib/format";
import { Card, SectionHeader, SentimentBadge } from "./ui";

const PAGE = 25;

export function PostsExplorer({ posts }: { posts: Post[] }) {
  const [query, setQuery] = useState("");
  const [correctedOnly, setCorrectedOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return posts.filter((p) => {
      if (correctedOnly && !p.labelCorrected) return false;
      if (q && !p.text.toLowerCase().includes(q) && !p.author.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [posts, query, correctedOnly]);

  return (
    <Card>
      <SectionHeader
        title="The actual posts"
        caption="What people wrote, in their own words — with the audit's corrections visible."
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Search text or author…"
          className="w-64 max-w-full rounded-lg border border-hairline bg-background px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1.5 text-xs text-ink-2">
          <input
            type="checkbox"
            checked={correctedOnly}
            onChange={(e) => {
              setCorrectedOnly(e.target.checked);
              setLimit(PAGE);
            }}
          />
          Only corrected labels
        </label>
        <span className="ml-auto text-xs text-muted">{num(visible.length)} posts</span>
      </div>

      <ul className="divide-y divide-hairline">
        {visible.slice(0, limit).map((p) => (
          <li key={p.id} className="flex flex-col gap-1.5 py-3">
            <p className="text-sm leading-relaxed">{p.text}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-medium text-ink-2">{p.platform}</span>
              <span>· {p.author}</span>
              {p.timestamp && <span>· {p.timestamp.slice(0, 10)}</span>}
              <span>· {prettyTopic(p.topic)}</span>
              <span className="ml-auto flex items-center gap-2">
                {p.labelCorrected && p.sentimentOriginal && (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--warning-bg)" }}>
                    was “{p.sentimentOriginal}” <span aria-hidden>→</span>
                  </span>
                )}
                {!p.inScope && (
                  <span className="rounded-full bg-neutral/15 px-2 py-0.5 text-xs text-ink-2">
                    {p.isDuplicate ? "duplicate" : "off-topic"} — excluded
                  </span>
                )}
                <SentimentBadge sentiment={p.sentiment} />
                <span>♥ {num(p.reactions)}</span>
                <span>💬 {num(p.comments)}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">No posts match — try clearing a filter.</p>
      )}
      {visible.length > limit && (
        <button
          onClick={() => setLimit((l) => l + PAGE * 2)}
          className="mt-3 w-full rounded-lg border border-hairline py-2 text-sm font-medium text-ink-2 hover:bg-background"
        >
          Show more ({num(visible.length - limit)} remaining)
        </button>
      )}
    </Card>
  );
}
