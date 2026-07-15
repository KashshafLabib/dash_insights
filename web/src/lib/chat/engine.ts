import type { Insights, SentimentCounts } from "../types";

export interface ChatReply {
  reply: string;
  suggestions: string[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const signedPct = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n * 100)}%`;

const share = (c: SentimentCounts, key: keyof SentimentCounts) => {
  const total = c.negative + c.neutral + c.positive;
  return total === 0 ? 0 : c[key] / total;
};

const pretty = (topic: string) => topic.replace(/_/g, " ");

const DEFAULT_SUGGESTIONS = [
  "How is overall sentiment?",
  "What should we fix first?",
  "How do we compare with the competitor?",
  "Can I trust this data?",
];

type Intent = {
  match: RegExp;
  answer: (i: Insights, msg: string) => string;
  followups?: string[];
};

const INTENTS: Intent[] = [
  {
    match: /trust|quality|clean|reliable|audit|mislabel|wrong label|accurate/,
    answer: (i) => {
      const a = i.audit;
      const ex = a.examples[0];
      const example = ex
        ? ` The clearest example: "${ex.text}" was shipped as *${ex.original}* and is actually *${ex.corrected}*.`
        : "";
      return (
        `Mostly — after cleaning. The raw feed had problems we corrected before showing you anything: ` +
        `**${a.labelsCorrected} sentiment labels (${pct(a.labelsCorrected / a.totalRows)}) contradicted their own text** and were fixed, ` +
        `${a.duplicates} duplicate posts were removed, and ${a.offTopic} off-topic posts (weather, traffic…) were excluded. ` +
        `${a.inScope} of ${a.totalRows} posts are trustworthy brand signal.${example}`
      );
    },
    followups: ["How is overall sentiment?", "What should we fix first?"],
  },
  {
    match: /fix first|priorit|worst (issue|problem|topic)|top (complaint|issue|problem)|urgent|act on/,
    answer: (i) => {
      const [a, b, c] = i.topics;
      const line = (t: typeof a, rank: string) =>
        t ? `${rank} **${pretty(t.topic)}** — ${t.posts} posts, ${pct(t.negShare)} negative.` : "";
      return (
        `${line(a, "1.")} People report money leaving their account with the transfer stuck or the recharge never arriving, and no help afterwards.\n` +
        `${line(b, "2.")}\n${line(c, "3.")}\n\n` +
        `${pretty(a.topic)} is ${a && b ? Math.round(a.priority / Math.max(b.priority, 1)) : ""}× the priority of everything below it — fixing it changes the whole picture.`
      );
    },
    followups: ["How do we compare with the competitor?", "Is sentiment improving?"],
  },
  {
    match: /competitor|ngoodpay|versus|vs\b|compare|switch/,
    answer: (i) => {
      const c = i.competitor;
      const themes = c.themes.slice(0, 3).map((t) => `${t.theme.toLowerCase()} (${t.count})`).join(", ");
      return (
        `**${i.meta.competitor}** appears in ${c.mentions} posts, and they're uncomfortable reading: ` +
        `the recurring reasons people cite are ${themes}. ` +
        `${pct(share(c.sentiment, "negative"))} of competitor posts are negative *for ${i.meta.brand}* — ` +
        `they're mostly "the other wallet does this better" posts. Pricing (cash-out charges) is the most repeated trigger.`
      );
    },
    followups: ["What should we fix first?", "What do people like about us?"],
  },
  {
    match: /trend|improv|better|worse|over time|trajectory|june|month/,
    answer: (i) => {
      const t = i.trend;
      if (t.length < 4) return "Not enough dated posts to draw a trend.";
      const half = Math.floor(t.length / 2);
      const avg = (rows: typeof t) => rows.reduce((s, r) => s + r.net, 0) / rows.length;
      const first = avg(t.slice(0, half));
      const second = avg(t.slice(half));
      const worst = t.reduce((w, r) => (r.net < w.net ? r : w));
      const direction =
        second - first > 0.03 ? "improving slightly" : second - first < -0.03 ? "getting worse" : "flat";
      const negDays = t.filter((r) => r.net < 0).length;
      return (
        `Net sentiment is **${direction}**: ${signedPct(first)} average in the first half of the period vs ${signedPct(second)} in the second. ` +
        `${negDays} of ${t.length} days were net-negative. The worst day was **${worst.date}** at ${signedPct(worst.net)}.`
      );
    },
    followups: ["What happened on the worst day?", "What should we fix first?"],
  },
  {
    match: /platform|facebook|tiktok|youtube|reddit|instagram|twitter|news/,
    answer: (i, msg) => {
      const named = i.platforms.find((p) => new RegExp(p.key.split("/")[0], "i").test(msg));
      if (named) {
        return (
          `**${named.key}**: ${named.posts} posts — ${pct(share(named, "negative"))} negative, ` +
          `${pct(share(named, "positive"))} positive.`
        );
      }
      const most = [...i.platforms].sort((a, b) => share(b, "negative") - share(a, "negative"))[0];
      const list = i.platforms.map((p) => `${p.key} (${p.posts})`).join(", ");
      return (
        `Volume by platform: ${list}. ` +
        `The sentiment mix is similar everywhere — the complaints are about the product, not one platform's community. ` +
        `**${most.key}** currently has the highest negative share at ${pct(share(most, "negative"))}.`
      );
    },
  },
  {
    match: /language|bangla|banglish|english|multilingual/,
    answer: (i) => {
      const get = (k: string) => i.languages.find((l) => l.key === k);
      const en = get("en");
      const bnEn = get("bn-en");
      const bn = get("bn");
      if (!en || !bnEn || !bn) return "This dataset doesn't have enough language variety to compare.";
      return (
        `The most important split in the data: **praise is in English, pain is in Bangla and Banglish**. ` +
        `English posts: ${pct(share(en, "positive"))} positive. Banglish: ${pct(share(bnEn, "negative"))} negative. ` +
        `Bangla: ${pct(share(bn, "negative"))} negative. ` +
        `Since ${pct((bnEn.posts + bn.posts) / (en.posts + bnEn.posts + bn.posts))} of the feed is Bangla/Banglish, ` +
        `an English-only read would badly misjudge the situation.`
      );
    },
  },
  {
    match: /like|love|good|positive|works|strength|happy/,
    answer: (i) => {
      const good = [...i.topics].filter((t) => t.posts >= 5).sort((a, b) => a.negShare - b.negShare).slice(0, 3);
      const list = good.map((t) => `**${pretty(t.topic)}** (${pct(1 - t.negShare)} non-negative, ${t.posts} posts)`).join(", ");
      return (
        `The core product is genuinely liked when it works: ${list}. ` +
        `Cashback posts in particular read like free advertising — people name the amounts they saved. ` +
        `The praise disappears the moment a transaction fails, which is why fixing failures is the priority.`
      );
    },
  },
  {
    match: /overall|sentiment|picture|summary|how (are|is)|doing|feel/,
    answer: (i) => {
      const s = i.sentiment;
      const total = s.audited.negative + s.audited.neutral + s.audited.positive;
      return (
        `**Net sentiment is ${signedPct(s.netAudited)}** — negative clearly outweighs positive. ` +
        `Of ${total} trustworthy posts: ${s.audited.negative} negative (${pct(share(s.audited, "negative"))}), ` +
        `${s.audited.positive} positive (${pct(share(s.audited, "positive"))}), ${s.audited.neutral} neutral. ` +
        `Note: the raw feed claimed ${signedPct(s.netRaw)}, but ${i.audit.labelsCorrected} mislabeled posts were hiding complaints inside the positive pile — ` +
        `the real picture is worse than the raw data suggested.`
      );
    },
    followups: ["What should we fix first?", "Is sentiment improving?"],
  },
  {
    match: /^(hi|hello|hey|salam|assalamu)/,
    answer: (i) =>
      `Hi! I can answer questions about the ${i.meta.brand} social feed (${i.meta.totalRows} posts, ${i.meta.from} → ${i.meta.to}) in plain language — sentiment, topics, the competitor, trends, or whether the data can be trusted.`,
  },
  {
    match: /help|what can (you|i)|how do i|what do you/,
    answer: () =>
      `Ask me things like: *"How is overall sentiment?"*, *"What should we fix first?"*, *"How do we compare with NgoodPay?"*, *"Is it improving?"*, *"Which platform is worst?"*, *"Can I trust this data?"* — I answer from the audited numbers, so I won't make things up.`,
  },
];

/** Answer a brand manager's question from the audited insights. Deterministic. */
export function answer(message: string, insights: Insights): ChatReply {
  const msg = message.toLowerCase().trim();

  // Topic-specific question, e.g. "tell me about cashback"?
  const topic = insights.topics.find((t) =>
    msg.includes(pretty(t.topic)) || msg.includes(t.topic),
  );

  for (const intent of INTENTS) {
    if (intent.match.test(msg)) {
      return {
        reply: intent.answer(insights, msg),
        suggestions: intent.followups ?? DEFAULT_SUGGESTIONS,
      };
    }
  }

  if (topic) {
    return {
      reply:
        `**${pretty(topic.topic)}**: ${topic.posts} posts — ${topic.negative} negative (${pct(topic.negShare)}), ` +
        `${topic.positive} positive, ${topic.neutral} neutral. ` +
        (topic.negShare > 0.5
          ? `This is a problem area${topic === insights.topics[0] ? " — the biggest one" : ""}.`
          : `This topic is in decent shape.`),
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const s = insights.sentiment;
  return {
    reply:
      `I'm not sure I understood that, so here's the headline: net sentiment is **${signedPct(s.netAudited)}**, ` +
      `driven almost entirely by failed transactions. Try one of the suggestions below — or ask about any topic, platform, or the competitor.`,
    suggestions: DEFAULT_SUGGESTIONS,
  };
}
