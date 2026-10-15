// Golden vectors of the internal steps of the dealing that reference 3.9 lists as ported. A step that deal or
// dealChunk takes is recorded on the reference scenarios, step by step, with the arguments dealChunk passes it; the
// small helpers get tables that reach every branch.
import type { CardHistory, History } from "@/src/content/play";
import type { Card } from "@/src/content/schema";
import { CHUNK, SEARCH_BUDGET, dealChunk, dealInternals } from "@/src/engine/deal";
import { createRng, type Rng } from "@/src/engine/rng";
import {
  DEAL_MODULE,
  DEAL_SOURCE,
  DEAL_TESTS,
  boundaryRoute,
  cutPool,
  fixture,
  missed,
  missedFrom,
  overCapPool,
  overdueRoute,
  pinsPool,
  range,
  ringPool,
} from "./deal-fixtures";
import { goldenFile, rngSeed, rngValues, type GoldenCase, type GoldenFile } from "./format";

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

type Ranking = ReturnType<typeof rankByPriority>;
type Join = ReturnType<typeof joinOf>;
type Limits = NonNullable<Parameters<typeof searchWithAllRules>[4]>;

// A ReadonlySet of card ids is written as the array of its ids, in insertion order.
function written(ranking: Ranking): unknown {
  return { ...ranking, missed: [...ranking.missed] };
}

function writtenLimits(limits: Limits): unknown {
  return limits.missed === undefined ? limits : { ...limits, missed: [...limits.missed] };
}

// An rng that keeps what it returns, so that a step which continues a stream is written with rngValues.
function recording(rng: Rng): { rng: Rng; values: number[] } {
  const values: number[] = [];
  return {
    values,
    rng: () => {
      const value = rng();
      values.push(value);
      return value;
    },
  };
}

// An rng that returns the given values in order and fails when they run out, as {"$rng": {"values": [...]}} does.
function replay(values: readonly number[]): Rng {
  let next = 0;
  return () => {
    const value = values[next++];
    if (value === undefined) throw new Error("the rng ran out of values");
    return value;
  };
}

interface Steps {
  rankByPriority: GoldenCase[];
  choose: GoldenCase[];
  joinOf: GoldenCase[];
  runLimit: GoldenCase[];
  arrange: GoldenCase[];
  dealRanked: GoldenCase[];
}

// One dealChunk call, step by step as dealChunk takes it (deal.ts:71-86 and dealRanked). Fails when the steps put
// together do not give what dealChunk gives.
function chunkSteps(steps: Steps, name: string, pool: readonly Card[], history: History, seed: number, dealt: readonly Card[]): Card[] {
  const cards = uniqueById(pool);
  const lastDealtAt = new Map<string, number>();
  dealt.forEach((card, position) => lastDealtAt.set(card.id, position));
  const unshown = cards.filter((card) => !lastDealtAt.has(card.id));
  const gap = Math.min(CHUNK, cards.length - 1);
  const comeBack = cards
    .filter((card) => (lastDealtAt.get(card.id) ?? dealt.length) < dealt.length - gap)
    .sort((a, b) => (lastDealtAt.get(a.id) ?? 0) - (lastDealtAt.get(b.id) ?? 0));
  const size = Math.min(CHUNK, unshown.length + comeBack.length);
  const lastTen = dealt.slice(-CHUNK);
  const setting = {
    avoid: lastTen,
    before: lastTen.map((card) => card.answer),
    budget: SEARCH_BUDGET,
    overdue: unshown.length > 0 && dealt.length >= OVERDUE_AFTER_PASSES * cards.length,
  };

  const rng = createRng(seed);
  const ranked = rankByPriority(unshown, history, rng, size);
  steps.rankByPriority.push({ name, input: { cards: unshown, history, rng: rngSeed(seed), size }, output: written(ranked) });
  const ranking = { ...ranked, comeBack };

  const after = recording(rng);
  const output = dealRanked(ranking, size, after.rng, setting);
  steps.dealRanked.push({ name, input: { ranking: written(ranking), size, rng: rngValues(after.values), setting }, output });

  const chosen = choose(ranking, size, setting.avoid, setting.budget, setting.overdue);
  steps.choose.push({ name, input: { ranking: written(ranking), size, avoid: setting.avoid, budget: setting.budget, overdue: setting.overdue }, output: chosen });
  const join = joinOf(setting.before);
  steps.joinOf.push({ name, input: { before: setting.before }, output: join });
  const trues = trueCount(chosen);
  steps.runLimit.push({ name, input: { trues, falses: chosen.length - trues, join }, output: runLimit(trues, chosen.length - trues, join) });
  steps.arrange.push({ name, input: { chosen, rng: rngValues(after.values), join }, output: arrange(chosen, replay(after.values), join) });

  const whole = dealChunk(pool, history, createRng(seed), dealt);
  if (whole.map((c) => c.id).join() !== output.map((c) => c.id).join()) throw new Error(`${name}: the steps do not deal what dealChunk deals`);
  return output;
}

function recordedSteps(): Steps {
  const steps: Steps = { rankByPriority: [], choose: [], joinOf: [], runLimit: [], arrange: [], dealRanked: [] };
  const pins = pinsPool();
  const overCap = overCapPool();
  for (const seed of [1, 2, 3]) {
    chunkSteps(steps, `the reference pool, seed ${seed}`, pins.pool, pins.history, seed, []);
    chunkSteps(steps, `more missed cards than the cap, seed ${seed}`, overCap.pool, overCap.history, seed, []);
  }
  const rounds: [string, Card[], History, (k: number) => number, number][] = [
    ["the reference pool, seeds 100 to 102", pins.pool, pins.history, (k) => 100 + k, 3],
    ["the overdue route, seeds 210 to 215", overdueRoute(), {}, (k) => 210 + k, 6],
    ["the overdue threshold, seeds 150 to 155", boundaryRoute(), {}, (k) => 150 + k, 6],
  ];
  for (const [name, pool, history, seedOf, chunks] of rounds) {
    const dealt: Card[] = [];
    for (let k = 0; k < chunks; k++) dealt.push(...chunkSteps(steps, `${name}, chunk ${k}`, pool, history, seedOf(k), dealt));
  }
  return steps;
}

function tableCases(): Record<string, GoldenCase[]> {
  const pins = pinsPool();
  const overCap = overCapPool();
  const tables: Record<string, GoldenCase[]> = {};

  const twice = fixture("twice-listed");
  const listed = [...twice.cards("c", 6), ...twice.cards("c", 6), twice.card("c7", true)];
  tables.uniqueById = [
    { name: "an empty pool", input: { pool: [] }, output: uniqueById([]) },
    { name: "the reference pool", input: { pool: pins.pool }, output: uniqueById(pins.pool) },
    { name: "a pool that lists each id twice", input: { pool: listed }, output: uniqueById(listed) },
  ];

  const counts: [number, number][] = [[10, 40], [4.7, 40], [0, 12], [-3, 12], [Number.NaN, 12], [10, 6], [10, 0], [Number.POSITIVE_INFINITY, 5], [-0, 3], [0.5, 3], [1, 1]];
  tables.dealSize = counts.map(([count, available]) => ({ name: `count ${count}, available ${available}`, input: { count, available }, output: dealSize(count, available) }));

  // Every kind of history entry, the corrupt ones too: a non-finite lastSeenAt counts as 0, and -0 stays -0.
  const h = fixture("history-kinds");
  const kinds: [string, CardHistory | undefined][] = [
    ["no entry", undefined],
    ["seen 0, last wrong", { seen: 0, lastCorrect: false, lastSeenAt: 0 }],
    ["seen 1, last wrong", missed(5)],
    ["seen 2, last right", { seen: 2, lastCorrect: true, lastSeenAt: 9 }],
    ["seen -4, last wrong", { seen: -4, lastCorrect: false, lastSeenAt: 5 }],
    ["seen NaN, last right", { seen: Number.NaN, lastCorrect: true, lastSeenAt: -1 }],
    ["lastSeenAt NaN", { seen: 1, lastCorrect: false, lastSeenAt: Number.NaN }],
    ["lastSeenAt Infinity", { seen: 1, lastCorrect: true, lastSeenAt: Number.POSITIVE_INFINITY }],
    ["lastSeenAt -Infinity", { seen: 1, lastCorrect: false, lastSeenAt: Number.NEGATIVE_INFINITY }],
    ["lastSeenAt -0", { seen: 1, lastCorrect: true, lastSeenAt: -0 }],
    ["lastSeenAt 1e15", { seen: 3, lastCorrect: true, lastSeenAt: 1e15 }],
  ];
  const kindCards = kinds.map((_, i) => h.card(`k${i + 1}`, i % 2 === 0));
  const kindHistory: History = Object.fromEntries(kinds.flatMap(([, entry], i) => (entry === undefined ? [] : [[h.id(`k${i + 1}`), entry]])));
  const perCard = (run: (card: Card, history: History) => unknown): GoldenCase[] =>
    kinds.map(([label], i) => {
      const card = kindCards[i] as Card;
      return { name: label, input: { card, history: kindHistory }, output: run(card, kindHistory) };
    });
  tables.wasSeen = perCard(wasSeen);
  tables.wasMissed = perCard(wasMissed);
  tables.lastSeenAt = perCard(lastSeenAt);
  const reversed = [...kindCards].reverse();
  tables.oldestFirst = [
    { name: "every kind of entry", input: { cards: kindCards, history: kindHistory }, output: oldestFirst(kindCards, kindHistory) },
    { name: "every kind of entry, reversed", input: { cards: reversed, history: kindHistory }, output: oldestFirst(reversed, kindHistory) },
    { name: "equal times keep their order", input: { cards: overCap.pool, history: overCap.history }, output: oldestFirst(overCap.pool, overCap.history) },
  ];

  tables.balanceFor = range(0, 21).map((size) => ({ name: `size ${size}`, input: { size }, output: balanceFor(size) }));
  tables.balanceAllows = [];
  for (const size of [1, 5, 10, 14]) {
    const balance = balanceFor(size);
    for (const answer of [true, false]) {
      for (let trues = 0; trues <= size; trues += size > 5 ? 2 : 1) {
        for (let falses = 0; trues + falses <= size; falses += size > 5 ? 2 : 1) {
          tables.balanceAllows.push({
            name: `size ${size}, answer ${answer}, ${trues} True and ${falses} False taken`,
            input: { answer, trues, falses, size, balance },
            output: balanceAllows(answer, trues, falses, size, balance),
          });
        }
      }
    }
  }

  tables.trueCount = [
    { name: "no cards", input: { cards: [] }, output: trueCount([]) },
    { name: "the reference pool", input: { cards: pins.pool }, output: trueCount(pins.pool) },
    { name: "more missed cards than the cap", input: { cards: overCap.pool }, output: trueCount(overCap.pool) },
  ];

  const g = fixture("groups");
  const multi = g.card("multi", true, ["a", "b"]);
  const inA = g.card("a", true, ["a"]);
  const inB = g.card("b", false, ["b"]);
  const free = g.card("free", false);
  const inC = g.card("c", true, ["c"]);
  const shares: [string, Card, Card[]][] = [
    ["a card in two groups and a card in one of them", multi, [free, inB]],
    ["a card in two groups and none of them", multi, [free, inC]],
    ["a card without groups", free, [multi, inA, inB]],
    ["no other cards", inA, []],
    ["a card in a group of the other", inA, [multi]],
    ["the card itself", inA, [inA]],
  ];
  tables.sharesGroup = shares.map(([name, card, others]) => ({ name, input: { card, others }, output: sharesGroup(card, others) }));

  const befores: boolean[][] = [
    [],
    [true],
    [false],
    [true, true, true],
    [false, true, true, true],
    [true, false, false],
    [true, true, true, true],
    Array.from({ length: 10 }, (_, i) => i % 2 === 0),
  ];
  tables.joinOf = befores.map((before) => ({ name: `before [${before.map((a) => (a ? "T" : "F")).join(" ")}]`, input: { before }, output: joinOf(before) }));

  const joins: Join[] = [
    { last: null, run: 0 },
    { last: true, run: 1 },
    { last: true, run: 3 },
    { last: false, run: 2 },
    { last: false, run: 4 },
  ];
  tables.runLimit = [];
  for (const join of joins) {
    for (let t = 0; t <= 10; t++) {
      for (let f = 0; t + f <= 10; f++) {
        tables.runLimit.push({ name: `${t} True and ${f} False after ${join.last} x${join.run}`, input: { trues: t, falses: f, join }, output: runLimit(t, f, join) });
      }
    }
  }

  // placementCheck(limit) returns canPlace; a case is one call canPlace(t, f, last, run) on a fresh placementCheck(limit).
  tables.placementCheck = [];
  for (const limit of [1, 3, 5]) {
    for (const [last, run] of [[null, 0], [true, 1], [true, 3], [false, 2], [false, 5]] as const) {
      for (let t = 0; t <= 5; t++) {
        for (let f = 0; f <= 5; f++) {
          tables.placementCheck.push({ name: `limit ${limit}: ${t} True and ${f} False after ${last} x${run}`, input: { limit, t, f, last, run }, output: placementCheck(limit)(t, f, last, run) });
        }
      }
    }
  }

  const picks: [boolean[], number, number, number[]][] = [
    [[], 3, 0, []],
    [[], 0, 3, []],
    [[true], 2, 5, []],
    [[false], 5, 2, []],
    [[true, false], 3, 7, [0.29]],
    [[true, false], 3, 7, [0.3]],
    [[true, false], 3, 7, [0.31]],
    [[true, false], 5, 5, [0]],
    [[true, false], 5, 5, [0.9999999999]],
  ];
  tables.pickAnswer = picks.map(([allowed, t, f, values]) => ({
    name: `allowed [${allowed.join(" ")}], ${t} True and ${f} False left, draws [${values.join(" ")}]`,
    input: { allowed, trues: t, falses: f, rng: rngValues(values) },
    output: pickAnswer(allowed, t, f, replay(values)),
  }));

  tables.searchWithAllRules = [];
  const search = (name: string, ranked: readonly Card[], size: number, avoid: readonly Card[], limits: Limits) => {
    const balance = balanceFor(size);
    tables.searchWithAllRules?.push({ name, input: { ranked, size, avoid, balance, limits: writtenLimits(limits) }, output: searchWithAllRules(ranked, size, avoid, balance, limits) });
  };
  const cut = cutPool();
  for (const budget of [1, 19, 20, 40, SEARCH_BUDGET]) search(`too few False cards behind the groups, budget ${budget}`, cut, 10, [], { budget });
  search("too few False cards behind the groups, no limits", cut, 10, [], {});
  for (const budget of [100, 2000]) search(`the ring, budget ${budget}`, ringPool(), 10, [], { budget });
  const overCapRanking = rankByPriority(overCap.pool, overCap.history, createRng(1), 10);
  const overCapUnshown = [...overCapRanking.withinCap, ...overCapRanking.overCap];
  search("more missed cards than the cap: within the cap only", overCapRanking.withinCap, 10, [], { missed: overCapRanking.missed });
  search("more missed cards than the cap: every card, no limit", overCapUnshown, 10, [], { missed: overCapRanking.missed });
  for (const missedLimit of [0, 3, 4, 5, 6]) {
    search(`more missed cards than the cap: missed limit ${missedLimit}`, overCapUnshown, 10, [], { missed: overCapRanking.missed, missedLimit });
  }
  search("more missed cards than the cap: the group of an avoid card", overCapUnshown, 10, [fixture("avoid-b").card("before", true, ["b"])], {
    missed: overCapRanking.missed,
    missedLimit: 3,
  });

  // searchOverCap's third argument is the closure choose builds; the input names what it closes over.
  tables.searchOverCap = [];
  const overCapCase = (name: string, ranking: Ranking, size: number, budget: number) => {
    const unshown = [...ranking.withinCap, ...ranking.overCap];
    const balance = balanceFor(size);
    const run = (ranked: readonly Card[], limits: Limits = {}) => searchWithAllRules(ranked, size, [], balance, { budget, missed: ranking.missed, ...limits });
    tables.searchOverCap?.push({ name, input: { ranking: written(ranking), unshown, search: { size, avoid: [], budget } }, output: searchOverCap(ranking, unshown, run) });
  };
  for (const seed of [1, 2, 3]) overCapCase(`more missed cards than the cap, seed ${seed}`, rankByPriority(overCap.pool, overCap.history, createRng(seed), 10), 10, SEARCH_BUDGET);
  overCapCase("more missed cards than the cap, a budget of 5", overCapRanking, 10, 5);
  overCapCase("nothing over the cap", rankByPriority(pins.pool, pins.history, createRng(1), 10), 10, SEARCH_BUDGET);
  const allTrue = fixture("over-cap-all-true");
  const allTruePool = [...allTrue.cards("m", 8, () => true), ...allTrue.cards("u", 4, () => true)];
  overCapCase("no deal keeps the balance", rankByPriority(allTruePool, missedFrom(allTruePool.slice(0, 8), 1), createRng(1), 10), 10, SEARCH_BUDGET);

  tables.relaxStepByStep = [];
  const relax = (name: string, ranked: readonly Card[], size: number, avoid: readonly Card[], firstCards: readonly Card[] = []) => {
    const balance = balanceFor(size);
    tables.relaxStepByStep?.push({ name, input: { ranked, size, avoid, balance, first: firstCards }, output: relaxStepByStep(ranked, size, avoid, balance, firstCards) });
  };
  const one = fixture("one-group");
  const everything = Array.from({ length: 12 }, (_, i) => one.card(`c${i + 1}`, i % 2 === 0, ["everything"]));
  relax("every card in one group", everything, 10, []);
  relax("every card in one group, a size of 4", everything, 4, []);
  const c = fixture("clash");
  const clash = [...c.cards("t", 8, () => true), ...c.cards("f", 2, () => false), ...Array.from({ length: 4 }, (_, i) => c.card(`g${i + 1}`, false, ["clash"]))];
  relax("the groups give way before the balance", clash, 10, []);
  relax("the groups give way before the balance, group cards first", [...clash].reverse(), 10, []);
  const topic = fixture("one-topic");
  relax("twelve True cards of one group", Array.from({ length: 12 }, (_, i) => topic.card(`c${i + 1}`, true, ["one-topic"])), 10, []);
  const a = fixture("avoid-all");
  relax("the avoid groups give way too", Array.from({ length: 10 }, (_, i) => a.card(`c${i + 1}`, i % 2 === 0, ["shared"])), 10, [a.card("before", true, ["shared"])]);
  const route = overdueRoute();
  relax("the overdue card goes in first", route.slice(1), 10, route.slice(11, 21), [route[0] as Card]);

  return tables;
}

// The files, in the order of reference 3.9.
export const DEAL_STEPS = [
  "dealRanked",
  "uniqueById",
  "dealSize",
  "wasSeen",
  "wasMissed",
  "lastSeenAt",
  "oldestFirst",
  "rankByPriority",
  "balanceFor",
  "choose",
  "searchOverCap",
  "searchWithAllRules",
  "relaxStepByStep",
  "sharesGroup",
  "trueCount",
  "balanceAllows",
  "arrange",
  "joinOf",
  "runLimit",
  "placementCheck",
  "pickAnswer",
  "OVERDUE_AFTER_PASSES",
] as const;

export function dealStepFiles(): GoldenFile[] {
  const recorded = recordedSteps();
  const tables = tableCases();
  const casesOf = (step: (typeof DEAL_STEPS)[number]): GoldenCase[] => {
    if (step === "OVERDUE_AFTER_PASSES") return [{ name: "the value", input: null, output: OVERDUE_AFTER_PASSES }];
    return [...(step in recorded ? recorded[step as keyof Steps] : []), ...(tables[step] ?? [])];
  };
  return DEAL_STEPS.map((step) => goldenFile({ module: DEAL_MODULE, function: step, source: DEAL_SOURCE, tests: DEAL_TESTS }, casesOf(step)));
}
