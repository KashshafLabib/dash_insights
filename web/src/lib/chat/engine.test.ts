import { describe, expect, it } from "vitest";
import { answer } from "./engine";
import type { Insights } from "../types";
import insightsJson from "../../data/insights.json";

const insights = insightsJson as unknown as Insights;

describe("chat engine on the default dataset", () => {
  it("answers the overall-sentiment question with audited numbers", () => {
    const r = answer("How is overall sentiment?", insights);
    expect(r.reply).toContain("-22%");
    expect(r.reply).toContain("63");
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("ranks failed transactions first for fix-first questions", () => {
    const r = answer("What should we fix first?", insights);
    expect(r.reply).toContain("failed transaction");
  });

  it("answers competitor questions with themes", () => {
    const r = answer("How do we compare with NgoodPay?", insights);
    expect(r.reply).toContain("NgoodPay");
    expect(r.reply.toLowerCase()).toContain("cash-out");
  });

  it("explains the data audit when asked about trust", () => {
    const r = answer("Can I trust this data?", insights);
    expect(r.reply).toContain("63");
    expect(r.reply).toContain("61");
  });

  it("answers about a specific platform", () => {
    const r = answer("How are we doing on Facebook?", insights);
    expect(r.reply).toContain("Facebook");
  });

  it("describes the language split", () => {
    const r = answer("Does language matter in this data?", insights);
    expect(r.reply.toLowerCase()).toContain("english");
    expect(r.reply.toLowerCase()).toContain("banglish");
  });

  it("falls back gracefully on gibberish", () => {
    const r = answer("xyzzy plugh", insights);
    expect(r.reply.length).toBeGreaterThan(20);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });
});
