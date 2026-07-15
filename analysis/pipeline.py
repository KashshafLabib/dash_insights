# -*- coding: utf-8 -*-
"""Offline audit pipeline for the default TakaPay dataset.

Reads the shared rules from web/src/lib/rules/rules.json (same file the
TypeScript runtime uses), audits every row with three judges (template
consensus, multilingual cues, XLM-R transformer), and writes the audited
posts + precomputed insights that the web app bundles:

    web/src/data/posts.json
    web/src/data/insights.json

Run:  python pipeline.py            (from analysis/)
      python pipeline.py --no-model (skip the transformer judge)
"""
import argparse
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from statistics import median

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RULES_PATH = ROOT / "web" / "src" / "lib" / "rules" / "rules.json"
DATA_PATH = ROOT / "data" / "takapay_sample_data.csv"
OUT_DIR = ROOT / "web" / "src" / "data"

RULES = json.loads(RULES_PATH.read_text(encoding="utf-8"))
SENTIMENTS = ("negative", "neutral", "positive")


def contains_any(text: str, patterns) -> bool:
    t = text.lower()
    return any(p.lower() in t for p in patterns)


def count_matches(text: str, patterns) -> int:
    t = text.lower()
    return sum(p.lower() in t for p in patterns)


def judge_cues(text: str):
    cues = RULES["sentimentCues"]
    neg = count_matches(text, cues["negative"])
    pos = count_matches(text, cues["positive"])
    if neg > pos:
        return "negative"
    if pos > neg:
        return "positive"
    return "neutral" if contains_any(text, cues["neutral"]) else None


def template_of(text: str) -> str:
    t = text
    for rule in RULES["templateNormalization"]:
        flags = re.IGNORECASE if rule.get("ignoreCase") else 0
        t = re.sub(rule["pattern"], rule["replace"], t, flags=flags)
    return t


def template_consensus(templates, labels):
    cfg = RULES["templateConsensus"]
    grouped = {}
    for tpl, label in zip(templates, labels):
        if label:
            grouped.setdefault(tpl, []).append(label)
    out = {}
    for tpl, arr in grouped.items():
        if len(arr) < cfg["minRows"]:
            continue
        top, n = Counter(arr).most_common(1)[0]
        if n / len(arr) >= cfg["minShare"]:
            out[tpl] = top
    return out


def judge_model(texts):
    from transformers import pipeline as hf_pipeline

    clf = hf_pipeline(
        "sentiment-analysis",
        model="cardiffnlp/twitter-xlm-roberta-base-sentiment",
        truncation=True,
        device=-1,
    )
    return [p["label"].lower() for p in clf(texts, batch_size=32)]


def vote(original, judges):
    votes = Counter(j for j in judges if j)
    if votes:
        top, n = votes.most_common(1)[0]
        if n >= 2 and top != original:
            return top, True
    return original, False


def sentiment_counts(items):
    c = Counter(items)
    return {s: c.get(s, 0) for s in SENTIMENTS}


def net(counts):
    total = sum(counts.values())
    return 0 if total == 0 else round((counts["positive"] - counts["negative"]) / total, 3)


def build_posts(df: pd.DataFrame, use_model: bool):
    texts = df["text"].tolist()
    templates = [template_of(t) for t in texts]
    cue_verdicts = [judge_cues(t) for t in texts]
    consensus = template_consensus(templates, df["sentiment"].tolist())
    tpl_verdicts = [consensus.get(t) for t in templates]
    model_verdicts = judge_model(texts) if use_model else [None] * len(texts)

    posts, seen = [], set()
    for i, row in enumerate(df.itertuples(index=False)):
        judges = [tpl_verdicts[i], cue_verdicts[i], model_verdicts[i]]
        sentiment, corrected = vote(row.sentiment, judges)
        text = row.text
        is_dup = text in seen
        seen.add(text)
        mentions_brand = contains_any(text, RULES["brands"]["primary"]["patterns"])
        mentions_comp = contains_any(text, RULES["brands"]["competitor"]["patterns"])
        posts.append({
            "id": str(row.id),
            "platform": row.platform,
            "timestamp": str(row.timestamp).replace(" ", "T"),
            "author": row.author,
            "text": text,
            "language": row.language,
            "sentimentOriginal": row.sentiment,
            "sentimentScore": int(row.sentiment_score),
            "sentiment": sentiment,
            "labelCorrected": corrected,
            "topic": row.topic,
            "reactions": int(row.reactions),
            "comments": int(row.comments),
            "mentionsBrand": mentions_brand,
            "mentionsCompetitor": mentions_comp,
            "isDuplicate": is_dup,
            "inScope": not is_dup and row.topic != "off_topic",
        })
    return posts


def topic_insights(scope):
    prod = [p for p in scope if p["topic"] != "competitor"]
    global_median = median([p["reactions"] for p in prod]) or 1
    out = []
    for topic in sorted({p["topic"] for p in prod}):
        group = [p for p in prod if p["topic"] == topic]
        counts = sentiment_counts(p["sentiment"] for p in group)
        med = median([p["reactions"] for p in group])
        out.append({
            "topic": topic,
            "posts": len(group),
            **counts,
            "negShare": round(counts["negative"] / len(group), 4),
            "priority": round(counts["negative"] * (med / global_median), 2),
            "medianReactions": med,
        })
    return sorted(out, key=lambda r: (-r["priority"], -r["posts"]))


def build_insights(posts, source):
    scope = [p for p in posts if p["inScope"]]
    corrections = [p for p in posts if p["labelCorrected"]]
    examples = [
        {
            "id": p["id"], "text": p["text"], "platform": p["platform"],
            "original": p["sentimentOriginal"], "corrected": p["sentiment"],
            "score": p["sentimentScore"],
        }
        for p in sorted(corrections, key=lambda p: -(p["sentimentScore"] or 0))[:8]
    ]
    timestamps = sorted(p["timestamp"] for p in posts if p["timestamp"])
    raw = sentiment_counts(p["sentimentOriginal"] for p in posts)
    audited = sentiment_counts(p["sentiment"] for p in scope)

    def breakdown(key):
        rows = []
        for k in sorted({p[key] for p in scope}):
            group = [p for p in scope if p[key] == k]
            rows.append({"key": k, "posts": len(group),
                         **sentiment_counts(p["sentiment"] for p in group)})
        return sorted(rows, key=lambda r: -r["posts"])

    trend = []
    for date in sorted({p["timestamp"][:10] for p in scope if p["timestamp"]}):
        group = [p for p in scope if p["timestamp"] and p["timestamp"][:10] == date]
        counts = sentiment_counts(p["sentiment"] for p in group)
        trend.append({"date": date, "posts": len(group), **counts, "net": net(counts)})

    comp = [p for p in scope if p["mentionsCompetitor"]]
    themes = [
        {"theme": t["theme"], "count": sum(contains_any(p["text"], t["patterns"]) for p in comp)}
        for t in RULES["competitorThemes"]
    ]
    themes = sorted([t for t in themes if t["count"] > 0], key=lambda t: -t["count"])
    samples = list(dict.fromkeys(p["text"] for p in comp))[:6]

    return {
        "meta": {
            "source": source,
            "brand": RULES["brands"]["primary"]["name"],
            "competitor": RULES["brands"]["competitor"]["name"],
            "totalRows": len(posts),
            "from": timestamps[0][:10] if timestamps else None,
            "to": timestamps[-1][:10] if timestamps else None,
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "judges": ["template consensus", "multilingual cues", "xlm-roberta transformer"],
        },
        "audit": {
            "totalRows": len(posts),
            "duplicates": sum(p["isDuplicate"] for p in posts),
            "offTopic": sum(p["topic"] == "off_topic" for p in posts),
            "noBrandMention": sum(not p["mentionsBrand"] for p in posts),
            "labelsCorrected": len(corrections),
            "inScope": len(scope),
            "examples": examples,
        },
        "sentiment": {"raw": raw, "audited": audited, "netRaw": net(raw), "netAudited": net(audited)},
        "topics": topic_insights(scope),
        "trend": trend,
        "platforms": breakdown("platform"),
        "languages": breakdown("language"),
        "competitor": {
            "mentions": len(comp),
            "sentiment": sentiment_counts(p["sentiment"] for p in comp),
            "themes": themes,
            "samples": samples,
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-model", action="store_true", help="skip the transformer judge")
    args = parser.parse_args()

    df = pd.read_csv(DATA_PATH)
    print(f"loaded {len(df)} rows from {DATA_PATH.name}")
    posts = build_posts(df, use_model=not args.no_model)
    insights = build_insights(posts, source="takapay_sample_data.csv")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "posts.json").write_text(
        json.dumps(posts, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT_DIR / "insights.json").write_text(
        json.dumps(insights, ensure_ascii=False, indent=2), encoding="utf-8")

    a = insights["audit"]
    print(f"corrected {a['labelsCorrected']} labels; in-scope {a['inScope']} of {a['totalRows']}")
    print(f"wrote {OUT_DIR / 'posts.json'} and insights.json")


if __name__ == "__main__":
    sys.exit(main())
