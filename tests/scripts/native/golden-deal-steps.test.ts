import { describe, expect, it } from "vitest";
import { golden } from "@/scripts/native/golden/deal";
import { DEAL_STEPS } from "@/scripts/native/golden/deal-steps";
import { NATIVE_FUNCTIONS, goldenProducers } from "@/scripts/native/registry";
import type { History } from "@/src/content/play";
import type { Card } from "@/src/content/schema";
import { dealInternals } from "@/src/engine/deal";
import type { Rng } from "@/src/engine/rng";
import { decode, encoded, ids, parseGolden, type GoldenJson } from "./golden-replay";

const {
  dealRanked,
  uniqueById,
  dealSize,
  wasSeen,
  wasMissed,
  lastSeenAt,
  oldestFirst,
  rankByPriority,
  balanceFor,
  choose,
  searchOverCap,
  searchWithAllRules,
  relaxStepByStep,
  sharesGroup,
  trueCount,
  balanceAllows,
  arrange,
  joinOf,
  runLimit,
  placementCheck,
  pickAnswer,
  OVERDUE_AFTER_PASSES,
} = dealInternals;

type Ranking = Parameters<typeof dealRanked>[0];
type WrittenRanking = Omit<Ranking, "missed"> & { missed: string[] };
type Balance = Parameters<typeof searchWithAllRules>[3];
type Limits = NonNullable<Parameters<typeof searchWithAllRules>[4]>;
type Join = Parameters<typeof arrange>[2];

const files = golden();
const parsed = files.map((file) => parseGolden(file.content));

function fileOf(fn: string): GoldenJson {
  const found = parsed.find((file) => file.function === fn);
  if (found === undefined) throw new Error(`no golden file for ${fn}`);
  return found;
}

function caseOf(fn: string, name: string): { name: string; input: unknown; output: unknown } {
  const found = fileOf(fn).cases.find((c) => c.name === name);
  if (found === undefined) throw new Error(`no case "${name}" in ${fn}`);
  return found;
}

const ranking = (written: WrittenRanking): Ranking => ({ ...written, missed: new Set(written.missed) });
const asWritten = (r: Ranking): WrittenRanking => ({ ...r, missed: [...r.missed] });
const limitsOf = (written: Omit<Limits, "missed"> & { missed?: string[] }): Limits =>
  written.missed === undefined ? (written as Limits) : { ...written, missed: new Set(written.missed) };

// How a native port calls each step on a decoded input: a Set of ids is written as an array, placementCheck(limit)
// is called once with (t, f, last, run), and searchOverCap's search is the closure choose builds.
const RUN: Record<string, (input: never) => unknown> = {
  dealRanked: (i: { ranking: WrittenRanking; size: number; rng: Rng; setting: Parameters<typeof dealRanked>[3] }) =>
    dealRanked(ranking(i.ranking), i.size, i.rng, i.setting),
  uniqueById: (i: { pool: Card[] }) => uniqueById(i.pool),
  dealSize: (i: { count: number; available: number }) => dealSize(i.count, i.available),
  wasSeen: (i: { card: Card; history: History }) => wasSeen(i.card, i.history),
  wasMissed: (i: { card: Card; history: History }) => wasMissed(i.card, i.history),
  lastSeenAt: (i: { card: Card; history: History }) => lastSeenAt(i.card, i.history),
  oldestFirst: (i: { cards: Card[]; history: History }) => oldestFirst(i.cards, i.history),
  rankByPriority: (i: { cards: Card[]; history: History; rng: Rng; size: number }) => asWritten(rankByPriority(i.cards, i.history, i.rng, i.size)),
  balanceFor: (i: { size: number }) => balanceFor(i.size),
  choose: (i: { ranking: WrittenRanking; size: number; avoid: Card[]; budget: number; overdue: boolean }) =>
    choose(ranking(i.ranking), i.size, i.avoid, i.budget, i.overdue),
  searchOverCap: (i: { ranking: WrittenRanking; unshown: Card[]; search: { size: number; avoid: Card[]; budget: number } }) => {
    const r = ranking(i.ranking);
    const balance = balanceFor(i.search.size);
    return searchOverCap(r, i.unshown, (ranked, limits = {}) =>
      searchWithAllRules(ranked, i.search.size, i.search.avoid, balance, { budget: i.search.budget, missed: r.missed, ...limits }),
    );
  },
  searchWithAllRules: (i: { ranked: Card[]; size: number; avoid: Card[]; balance: Balance; limits: Omit<Limits, "missed"> & { missed?: string[] } }) =>
    searchWithAllRules(i.ranked, i.size, i.avoid, i.balance, limitsOf(i.limits)),
  relaxStepByStep: (i: { ranked: Card[]; size: number; avoid: Card[]; balance: Balance; first: Card[] }) =>
    relaxStepByStep(i.ranked, i.size, i.avoid, i.balance, i.first),
  sharesGroup: (i: { card: Card; others: Card[] }) => sharesGroup(i.card, i.others),
  trueCount: (i: { cards: Card[] }) => trueCount(i.cards),
  balanceAllows: (i: { answer: boolean; trues: number; falses: number; size: number; balance: Balance }) =>
    balanceAllows(i.answer, i.trues, i.falses, i.size, i.balance),
  arrange: (i: { chosen: Card[]; rng: Rng; join: Join }) => arrange(i.chosen, i.rng, i.join),
  joinOf: (i: { before: boolean[] }) => joinOf(i.before),
  runLimit: (i: { trues: number; falses: number; join: Join }) => runLimit(i.trues, i.falses, i.join),
  placementCheck: (i: { limit: number; t: number; f: number; last: boolean | null; run: number }) => placementCheck(i.limit)(i.t, i.f, i.last, i.run),
  pickAnswer: (i: { allowed: boolean[]; trues: number; falses: number; rng: Rng }) => pickAnswer(i.allowed, i.trues, i.falses, i.rng),
};

describe("golden: the internal steps of the dealing", () => {
  it("writes one file for each function and constant of src/engine/deal in the registry, and nothing else", () => {
    const registered = NATIVE_FUNCTIONS.filter((entry) => entry.module === "src/engine/deal").map((entry) => entry.name);
    expect(parsed.map((file) => file.function).sort()).toEqual([...registered].sort());
    expect(parsed.map((file) => file.function)).toEqual(["deal", "dealChunk", "DEAL", "CHUNK", "SEARCH_BUDGET", ...DEAL_STEPS]);
    expect(goldenProducers()).toContain(golden);
  });

  it("gives every output again when the input is decoded and the step runs on it", () => {
    for (const step of DEAL_STEPS) {
      const file = fileOf(step);
      expect(file.cases.length, step).toBeGreaterThan(0);
      for (const c of file.cases) {
        if (step === "OVERDUE_AFTER_PASSES") {
          expect(c).toEqual({ name: "the value", input: null, output: OVERDUE_AFTER_PASSES });
          continue;
        }
        const run = RUN[step];
        if (run === undefined) throw new Error(`no runner for ${step}`);
        expect(encoded(run(decode(c.input, file.cards, new Map()) as never)), `${step}: ${c.name}`).toEqual(c.output);
      }
    }
  });

  it("records dealChunk step by step: the steps of the first chunk deal the reference vectors of deal", () => {
    const pins = fileOf("deal");
    for (const seed of [1, 2, 3]) {
      const reference = pins.cases.find((c) => c.name === `deal-pins-polish: reference vectors, seed ${seed}`);
      expect(ids(caseOf("dealRanked", `the reference pool, seed ${seed}`).output)).toEqual(ids(reference?.output));
      expect(ids(caseOf("arrange", `the reference pool, seed ${seed}`).output)).toEqual(ids(reference?.output));
    }
    const ranked = caseOf("rankByPriority", "the reference pool, seed 1").output as { missed: unknown; comeBack: unknown };
    expect(ranked.missed).toEqual(["pins:c6", "pins:c1"]);
    expect(ranked.comeBack).toEqual([]);
    const overdue = caseOf("choose", "the overdue route, seeds 210 to 215, chunk 5").input as { overdue: boolean };
    expect(overdue.overdue).toBe(true);
  });

  it("writes the special numbers of the history steps as tagged numbers", () => {
    expect(caseOf("lastSeenAt", "lastSeenAt NaN").output).toBe(0);
    expect(caseOf("lastSeenAt", "lastSeenAt Infinity").output).toBe(0);
    expect(caseOf("lastSeenAt", "lastSeenAt -Infinity").output).toBe(0);
    expect(caseOf("lastSeenAt", "lastSeenAt -0").output).toEqual({ $number: "-0" });
    expect(caseOf("wasSeen", "seen NaN, last right").output).toBe(false);
    expect(caseOf("wasMissed", "seen 0, last wrong").output).toBe(false);
    expect(caseOf("dealSize", "count NaN, available 12")).toEqual({ name: "count NaN, available 12", input: { count: { $number: "NaN" }, available: 12 }, output: 0 });
    expect(caseOf("dealSize", "count Infinity, available 5").output).toBe(5);
  });

  it("draws for an answer only when both answers are allowed", () => {
    expect(caseOf("pickAnswer", "allowed [true], 2 True and 5 False left, draws []").input).toMatchObject({ rng: { $rng: { values: [] } } });
    expect(caseOf("pickAnswer", "allowed [true false], 3 True and 7 False left, draws [0.29]").output).toBe(true);
    expect(caseOf("pickAnswer", "allowed [true false], 3 True and 7 False left, draws [0.3]").output).toBe(false);
  });

  it("keeps the dealing vectors below 6 MB", () => {
    expect(files.reduce((sum, file) => sum + file.content.length, 0)).toBeLessThan(6_000_000);
  });
});
