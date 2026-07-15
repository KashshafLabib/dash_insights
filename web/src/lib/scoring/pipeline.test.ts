import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { judgeCues, runPipeline, templateOf } from "./index";
import { detectLanguage, mapColumns, normalizeSentiment } from "./normalize";

const dataset = JSON.parse(
  readFileSync(join(__dirname, "../../../../data/takapay_sample_data.json"), "utf-8"),
) as Record<string, unknown>[];

describe("cue judge (multilingual)", () => {
  it("reads a Bangla complaint as negative", () => {
    expect(
      judgeCues("আমার একাউন্ট থেকে 1000 টাকা কেটে নিয়েছে কিন্তু রিচার্জ হয়নি। TakaPay এর কোনো হেল্প নেই।"),
    ).toBe("negative");
  });

  it("reads a Banglish praise post as positive", () => {
    expect(judgeCues("TakaPay e tuition fee dilam ar 800 taka cashback pelam, darun offer!")).toBe("positive");
  });

  it("reads an English complaint as negative", () => {
    expect(judgeCues("Why is TakaPay charging 15 taka to cash out 1500? This is robbery.")).toBe("negative");
  });

  it("reads a where-can-I question as neutral", () => {
    expect(judgeCues("TakaPay agent kothay pabo Farmgate te? Cash out korte hobe.")).toBe("neutral");
  });
});

describe("template normalization", () => {
  it("collapses amounts, operators and relations", () => {
    const a = templateOf("TakaPay diye bhai ke 2500 taka pathalam, 3 din hoye gelo ekhono pending!");
    const b = templateOf("TakaPay diye bon ke 10000 taka pathalam, 30 din hoye gelo ekhono pending!");
    expect(a).toBe(b);
  });
});

describe("column mapping for bring-your-own data", () => {
  it("maps common aliases onto canonical fields", () => {
    const mapped = mapColumns({
      Post_ID: "42",
      Source: "Facebook",
      created_at: "2026-06-01 10:00:00",
      content: "hello",
      likes: 5,
      label: "POS",
    });
    expect(mapped.id).toBe("42");
    expect(mapped.platform).toBe("Facebook");
    expect(mapped.text).toBe("hello");
    expect(mapped.reactions).toBe(5);
    expect(normalizeSentiment(mapped.sentiment)).toBe("positive");
  });
});

describe("timestamp normalization", () => {
  it("keeps naive timestamps naive (no timezone shift across dates)", async () => {
    const { normalizeTimestamp } = await import("./normalize");
    expect(normalizeTimestamp("2026-06-21 01:16:00")).toBe("2026-06-21T01:16:00");
    expect(normalizeTimestamp("2026-06-21")).toBe("2026-06-21T00:00:00");
    expect(normalizeTimestamp("garbage")).toBeNull();
  });
});

describe("language detection", () => {
  it("detects Bangla script", () => {
    expect(detectLanguage("আমার একাউন্ট থেকে টাকা কেটে নিয়েছে")).toBe("bn");
  });
  it("detects Banglish", () => {
    expect(detectLanguage("TakaPay diye taka pathalam, sathe sathe chole gelo, darun kore")).toBe("bn-en");
  });
  it("detects English", () => {
    expect(detectLanguage("Paid my gas bill in under a minute. Genuinely smooth.")).toBe("en");
  });
});

describe("full pipeline on the real dataset (the known traps)", () => {
  const { posts, insights } = runPipeline(dataset, "test");
  const byId = new Map(posts.map((p) => [p.id, p]));

  it("corrects id 1431 — Bangla complaint shipped as positive/79", () => {
    const p = byId.get("1431")!;
    expect(p.sentimentOriginal).toBe("positive");
    expect(p.sentiment).toBe("negative");
    expect(p.labelCorrected).toBe(true);
  });

  it("corrects id 1024 — Banglish praise shipped as negative/20", () => {
    const p = byId.get("1024")!;
    expect(p.sentimentOriginal).toBe("negative");
    expect(p.sentiment).toBe("positive");
    expect(p.labelCorrected).toBe(true);
  });

  it("finds a substantial number of mislabels overall", () => {
    // Two judges here (template + cues) and both must agree, so this is the
    // precision-first floor; the offline pipeline adds a transformer judge
    // and finds ~64.
    expect(insights.audit.labelsCorrected).toBeGreaterThanOrEqual(25);
    expect(insights.audit.labelsCorrected).toBeLessThanOrEqual(90);
  });

  it("flags exactly the 10 duplicate texts and 61 off-topic posts", () => {
    expect(insights.audit.duplicates).toBe(10);
    expect(insights.audit.offTopic).toBe(61);
  });

  it("catches the broken brand_mention flag (70 rows never say TakaPay)", () => {
    expect(insights.audit.noBrandMention).toBe(70);
  });

  it("keeps 589 posts in scope", () => {
    expect(insights.audit.inScope).toBe(589);
  });

  it("ranks failed_transaction as the top fix-first topic", () => {
    expect(insights.topics[0].topic).toBe("failed_transaction");
    expect(insights.topics[0].negShare).toBeGreaterThan(0.9);
  });

  it("finds the competitor conversation", () => {
    expect(insights.competitor.mentions).toBe(81);
    expect(insights.competitor.themes.length).toBeGreaterThanOrEqual(3);
  });

  it("shows English posts positive-leaning and Banglish negative-leaning", () => {
    const lang = new Map(insights.languages.map((l) => [l.key, l]));
    const en = lang.get("en")!;
    const bnEn = lang.get("bn-en")!;
    expect(en.positive).toBeGreaterThan(en.negative);
    expect(bnEn.negative).toBeGreaterThan(bnEn.positive);
  });

  it("audited net sentiment is worse than raw (mislabels hid complaints)", () => {
    expect(insights.sentiment.netAudited).toBeLessThan(insights.sentiment.netRaw);
  });
});

describe("pipeline on unlabeled bring-your-own data", () => {
  it("scores rows that have no sentiment/topic columns at all", () => {
    const rows = [
      { text: "TakaPay diye 500 taka pathalam, sathe sathe chole gelo, darun!", date: "2026-07-01" },
      { text: "TakaPay app crash korche bar bar, kaj korche na", date: "2026-07-02" },
      { text: "Where can I find a TakaPay agent in Mirpur?", date: "2026-07-02" },
    ];
    const { posts, insights } = runPipeline(rows, "byo");
    expect(posts[0].sentiment).toBe("positive");
    expect(posts[1].sentiment).toBe("negative");
    expect(posts[1].topic).toBe("app_crash");
    expect(posts.every((p) => p.labelCorrected === false)).toBe(true);
    expect(insights.audit.inScope).toBe(3);
  });
});
