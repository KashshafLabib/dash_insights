"use client";

import { useRef, useState } from "react";
import type { Insights, Post } from "@/lib/types";
import { num } from "@/lib/format";

export interface UploadResult {
  name: string;
  posts: Post[];
  insights: Insights;
}

export function UploadModal({
  onClose,
  onLoaded,
}: {
  onClose: () => void;
  onLoaded: (r: UploadResult) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed — try another file.");
        return;
      }
      onLoaded({ name: file.name, posts: data.posts, insights: data.insights });
    } catch {
      setError("Couldn't reach the server — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-hairline bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Bring your own data</h2>
        <p className="mt-1 text-sm text-ink-2">
          CSV or JSON, up to 4 MB / {num(20000)} rows. Only a text column is required — sentiment, topic, platform and
          dates are used when present and inferred when missing. The same audit runs on your data.
        </p>

        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          disabled={busy}
          className="mt-4 flex h-32 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-sm text-ink-2 transition-colors"
          style={{ borderColor: dragOver ? "var(--accent)" : "var(--baseline)", background: dragOver ? "var(--accent-soft)" : undefined }}
        >
          {busy ? (
            "Auditing your data…"
          ) : (
            <>
              <span className="text-2xl" aria-hidden>⬆️</span>
              <span>Drop a file here or click to choose</span>
              <span className="text-xs text-muted">.csv or .json</span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {error && (
          <p className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--warning-bg)" }}>
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-lg border border-hairline px-3 py-1.5 text-sm text-ink-2 hover:bg-background">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
