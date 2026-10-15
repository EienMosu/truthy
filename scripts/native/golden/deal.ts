// Golden vectors of the dealing (reference 3.2 and 3.9): deal and dealChunk on every scenario of the dealing tests and
// on the shipped decks, and the constants. Every output comes from running src/engine/deal.ts; only inputs are written here.
import type { CardHistory, History } from "@/src/content/play";
import { poolFor } from "@/src/content/load";
import { WHOLE_DECK, type Card } from "@/src/content/schema";
import { CHUNK, DEAL, SEARCH_BUDGET, deal, dealChunk, type DealOptions } from "@/src/engine/deal";
import { createRng, type Rng } from "@/src/engine/rng";
import { chunkSeed } from "@/src/engine/round";
import {
  DEAL_MODULE,
  DEAL_SOURCE,
  DEAL_TESTS,
  GROUPS_GIVE_WAY,
  ROUND_CHUNKS,
  SAMPLE,
  boundaryRoute,
  cutPool,
  first,
  fixture,
  halfMissed,
  missed,
  missedFrom,
  overCapPool,
  overdueRoute,
  overdueRouteOf,
  pinsPool,
  range,
  right,
  rightFrom,
  ringPool,
  shippedDecks,
  type Fixture,
} from "./deal-fixtures";
import { deckRef, goldenFile, rngSeed, type GoldenCase, type GoldenFile } from "./format";

interface Cases {
  deal: GoldenCase[];
  dealChunk: GoldenCase[];
}

// One call of deal: the input is its four arguments, the output what it returns.
function dealCase(cases: Cases, name: string, pool: readonly Card[], history: History, seed: number, options: DealOptions): void {
  cases.deal.push({ name, input: { pool, history, rng: rngSeed(seed), options }, output: deal(pool, history, createRng(seed), options) });
}

// One call of dealChunk. The budget is written only when the call passes one; a whole shipped deck is written as
// {"$deck": id} through poolInput.
function chunkCase(
  cases: Cases,
  name: string,
  pool: readonly Card[],
  history: History,
  seed: number,
  dealt: readonly Card[],
  budget?: number,
  poolInput: unknown = pool,
): Card[] {
  const output = budget === undefined ? dealChunk(pool, history, createRng(seed), dealt) : dealChunk(pool, history, createRng(seed), dealt, budget);
  const input = { pool: poolInput, history, rng: rngSeed(seed), dealt: [...dealt], ...(budget === undefined ? {} : { budget }) };
  cases.dealChunk.push({ name, input, output });
  return output;
}

// A round that deals chunk after chunk, chunk k from the seed seedOf(k), until it has dealt `length` cards or
// ROUND_CHUNKS chunks: one case per chunk, named "<name>, chunk <k>".
function roundCases(
  cases: Cases,
  name: string,
  pool: readonly Card[],
  history: History,
  seedOf: (k: number) => number,
  length: number,
  budget?: number,
): void {
  const dealt: Card[] = [];
  for (let k = 0; dealt.length < length && k < ROUND_CHUNKS; k++) {
    dealt.push(...chunkCase(cases, `${name}, chunk ${k}`, pool, history, seedOf(k), dealt, budget));
  }
}

// deal-pins-polish and overdue-boundary: the reference vectors, whole.
function pinsCases(cases: Cases): void {
  const pins = pinsPool();
  for (const seed of [1, 2, 3]) dealCase(cases, `deal-pins-polish: reference vectors, seed ${seed}`, pins.pool, pins.history, seed, { count: 10 });
  roundCases(cases, "deal-pins-polish: three chunks with the seeds 100 to 102", pins.pool, pins.history, (k) => 100 + k, 22);
  const overCap = overCapPool();
  for (const seed of [1, 2, 3]) {
    dealCase(cases, `deal-pins-polish: more missed cards than the cap, seed ${seed}`, overCap.pool, overCap.history, seed, { count: 10 });
  }
  roundCases(cases, "deal-pins-polish: six chunks with the seeds 210 to 215", overdueRoute(), {}, (k) => 210 + k, 60);
  roundCases(cases, "overdue-boundary: six chunks with the seeds 150 to 155", boundaryRoute(), {}, (k) => 150 + k, 60);
}

// tests/engine/deal.test.ts
function dealTestCases(cases: Cases): void {
  const alt = fixture("alt"); // cards("c", n) of the tests: c1, c2, ... with answers True, False, True, ...
  dealCase(cases, "deal.test: an empty pool", [], {}, 1, { count: 10 });
  dealCase(cases, "deal.test: count 0", alt.cards("c", 12), {}, 1, { count: 0 });
  dealCase(cases, "deal.test: count -3", alt.cards("c", 12), {}, 1, { count: -3 });
  for (const size of [1, 3, 9]) dealCase(cases, `deal.test: a pool of only ${size} cards`, alt.cards("c", size), {}, 1, { count: 10 });
  dealCase(cases, "deal.test: exactly the count from a larger pool", alt.cards("c", 40), {}, 1, { count: 10 });
  dealCase(cases, "deal.test: a fractional count", alt.cards("c", 40), {}, 1, { count: 4.7 });
  dealCase(cases, "deal.test: a pool that lists each id twice", [...alt.cards("c", 6), ...alt.cards("c", 6)], {}, 1, { count: 10 });
  dealCase(cases, "deal.test: only cards from the pool", alt.cards("c", 30), {}, 4, { count: 10 });
  const determinism = alt.history({ c1: missed(5), c2: right(3), c3: right(9) });
  for (const seed of [77, ...first(range(0, 10))]) {
    dealCase(cases, `deal.test: the same seed deals the same, seed ${seed}`, alt.cards("c", 40), determinism, seed, { count: 10 });
  }
  const strangers = fixture("strangers").history({ gone1: missed(1), gone2: missed(2), gone3: missed(3), gone4: missed(4) });
  dealCase(cases, "deal.test: history entries for cards not in the pool", alt.cards("c", 12), strangers, 2, { count: 10 });
  {
    const f = fixture("unseen-first");
    const seenBefore = f.cards("s", 10);
    dealCase(cases, "deal.test: cards never seen come first", [...seenBefore, ...f.cards("u", 10)], rightFrom(seenBefore, 1), 3, { count: 10 });
  }
  {
    const pool = fixture("oldest-first").cards("s", 15);
    dealCase(cases, "deal.test: among cards seen, the oldest first", pool, rightFrom(pool, 1000), 3, { count: 10 });
  }
  {
    const f = fixture("missed-first");
    const wrong = f.cards("m", 6);
    const pool = [...f.cards("u", 10, (i) => i % 2 === 1), ...wrong];
    dealCase(cases, "deal.test: missed cards first, three per ten", pool, missedFrom(wrong, 1), 8, { count: 10 });
  }
  {
    const f = fixture("two-missed");
    const pool = [...f.cards("u", 20), ...f.cards("m", 2)];
    dealCase(cases, "deal.test: fewer than three missed cards", pool, f.history({ m1: missed(1), m2: missed(2) }), 8, { count: 10 });
  }
  {
    const f = fixture("missed-twenty");
    const wrong = f.cards("m", 10);
    dealCase(cases, "deal.test: the missed cap scales with the count", [...f.cards("u", 30), ...wrong], missedFrom(wrong, 1), 8, { count: 20 });
  }
  {
    const f = fixture("beyond-cap");
    const wrong = f.cards("m", 5);
    const recent = f.cards("s", 5);
    const pool = [...wrong, ...f.cards("u", 5, (i) => i % 2 === 1), ...recent];
    dealCase(cases, "deal.test: missed cards beyond the cap last", pool, { ...missedFrom(wrong, 1), ...rightFrom(recent, 100) }, 5, { count: 10 });
  }
  {
    const f = fixture("almost-all-missed");
    const wrong = f.cards("m", 8);
    const pool = [...wrong, ...f.cards("u", 2)];
    for (const seed of [1, ...first(range(2, 21))]) {
      dealCase(cases, `deal.test: almost the whole pool missed, seed ${seed}`, pool, missedFrom(wrong, 1), seed, { count: 10 });
    }
  }
  {
    const f = fixture("seen-zero");
    const seen = f.cards("s", 10);
    const history = { ...rightFrom(seen, 1), ...f.history({ z: { seen: 0, lastCorrect: false, lastSeenAt: 0 } }) };
    dealCase(cases, "deal.test: an entry seen 0 times is never seen", [...seen, f.card("z", true)], history, 1, { count: 10 });
  }
  {
    const f = fixture("five-groups");
    const grouped = Array.from({ length: 15 }, (_, i) => f.card(`g${i + 1}`, i % 2 === 0, [`group-${i % 5}`]));
    const pool = [...grouped, ...f.cards("f", 5, (i) => i % 2 === 1)];
    for (const seed of first(range(0, 50))) dealCase(cases, `deal.test: ten conflict-free cards, seed ${seed}`, pool, {}, seed, { count: 10 });
  }
  {
    const f = fixture("multi");
    const pool = [f.card("multi", true, ["a", "b"]), f.card("a2", true, ["a"]), f.card("b2", false, ["b"]), ...f.cards("f", 12)];
    for (const seed of first(range(0, 30))) dealCase(cases, `deal.test: a card in two groups, seed ${seed}`, pool, {}, seed, { count: 10 });
  }
  {
    const f = fixture("missed-conflict");
    const older = f.cards("s", 12);
    const pool = [f.card("mB", false, ["shared"]), f.card("mA", true, ["shared"]), ...older];
    const history = { ...f.history({ mA: missed(1), mB: missed(2) }), ...rightFrom(older, 100) };
    dealCase(cases, "deal.test: a missed card in conflict with an older miss", pool, history, 4, { count: 10 });
  }
  {
    const f = fixture("avoid");
    const avoid = [f.card("before", true, ["shared"])];
    const pool = [f.card("x1", true, ["shared"]), f.card("x2", false, ["shared"]), ...f.cards("f", 12)];
    for (const seed of first(range(0, 30))) dealCase(cases, `deal.test: the groups of the avoid cards, seed ${seed}`, pool, {}, seed, { count: 10, avoid });
  }
  {
    const f = fixture("avoid-free");
    dealCase(cases, "deal.test: an avoid card without groups", f.cards("f", 10), {}, 1, { count: 10, avoid: [f.card("before", true)] });
  }
  {
    const mostlyTrue = fixture("mostly-true").cards("c", 20, (i) => i < 14);
    const mostlyFalse = fixture("mostly-false").cards("c", 20, (i) => i < 6);
    for (const seed of first(range(0, 50))) {
      dealCase(cases, `deal.test: a pool mostly True, seed ${seed}`, mostlyTrue, {}, seed, { count: 10 });
      dealCase(cases, `deal.test: a pool mostly False, seed ${seed}`, mostlyFalse, {}, seed, { count: 10 });
    }
  }
  {
    const f = fixture("balance-first");
    const seenFalse = f.cards("s", 10, () => false);
    const pool = [...f.cards("u", 10, () => true), ...seenFalse];
    dealCase(cases, "deal.test: older False cards replace unseen True ones", pool, rightFrom(seenFalse, 1), 6, { count: 10 });
  }
  {
    const pool = fixture("thirty-of-forty").cards("c", 40, (i) => i < 30);
    for (const count of [5, 1, 3, 20]) {
      for (const seed of first(range(0, 30))) dealCase(cases, `deal.test: the balance of ${count} cards, seed ${seed}`, pool, {}, seed, { count });
    }
  }
  {
    const f = fixture("one-group");
    const pool = Array.from({ length: 12 }, (_, i) => f.card(`c${i + 1}`, i % 2 === 0, ["everything"]));
    dealCase(cases, "deal.test: every card in one group", pool, {}, 2, { count: 10 });
  }
  {
    const f = fixture("clash");
    const pool = [...f.cards("t", 8, () => true), ...f.cards("f", 2, () => false), ...Array.from({ length: 4 }, (_, i) => f.card(`g${i + 1}`, false, ["clash"]))];
    for (const seed of first(range(0, 60))) dealCase(cases, `deal.test: the groups give way before the balance, seed ${seed}`, pool, {}, seed, { count: 10 });
    const history = f.history({ g1: right(1), g2: right(2), g3: right(3), g4: right(4) });
    for (const seed of first(range(0, 20))) {
      dealCase(cases, `deal.test: the groups give way before the balance, group cards last, seed ${seed}`, pool, history, seed, { count: 10 });
    }
  }
  {
    const f = fixture("one-topic");
    const pool = Array.from({ length: 12 }, (_, i) => f.card(`c${i + 1}`, true, ["one-topic"]));
    for (const seed of first(range(0, 20))) {
      dealCase(cases, `deal.test: twelve True cards of one group, seed ${seed}`, pool, {}, seed, { count: 10 });
      chunkCase(cases, `deal.test: twelve True cards of one group, seed ${seed}`, pool, {}, seed, []);
    }
  }
  {
    const f = fixture("recency-first");
    const wrong = f.cards("m", 5, (i) => i < 3);
    const pool = [...wrong, ...f.cards("u", 10, (i) => i < 8)];
    for (const seed of first(range(1, 21))) {
      dealCase(cases, `deal.test: recency gives way before the balance, seed ${seed}`, pool, missedFrom(wrong, 1), seed, { count: 10 });
    }
  }
  {
    const f = fixture("three-false");
    const wrong = [f.card("m1", false), f.card("m2", false), f.card("m3", false), f.card("m4", true)];
    const pool = [...wrong, ...f.cards("u", 10, () => true)];
    for (const seed of first(range(1, 21))) {
      dealCase(cases, `deal.test: only three False cards, seed ${seed}`, pool, missedFrom(wrong, 1), seed, { count: 10 });
      chunkCase(cases, `deal.test: only three False cards, seed ${seed}`, pool, missedFrom(wrong, 1), seed, []);
    }
  }
  {
    const f = fixture("over-cap-oldest");
    const wrong = [...f.cards("m", 3, () => true), ...[4, 5, 6, 7].map((n) => f.card(`m${n}`, false))];
    const pool = [...wrong, ...f.cards("u", 9, () => true), f.card("f1", false)];
    for (const seed of first(range(1, 21))) {
      dealCase(cases, `deal.test: only as many missed cards over the cap as needed, seed ${seed}`, pool, missedFrom(wrong, 1), seed, { count: 10 });
    }
  }
  {
    const f = fixture("cap-leave-out");
    const wrong = [1, 2, 3, 4].map((n) => f.card(`m${n}`, false));
    const pool = [...wrong, f.card("x", true, ["g"]), f.card("y", false, ["g"]), ...f.cards("u", 6, () => true)];
    for (const seed of first(range(1, 21))) {
      dealCase(cases, `deal.test: the cap kept by leaving out a higher card, seed ${seed}`, pool, missedFrom(wrong, 1), seed, { count: 10 });
    }
  }
  {
    const f = fixture("avoid-all");
    const pool = Array.from({ length: 10 }, (_, i) => f.card(`c${i + 1}`, i % 2 === 0, ["shared"]));
    dealCase(cases, "deal.test: the avoid groups give way too", pool, {}, 1, { count: 10, avoid: [f.card("before", true, ["shared"])] });
  }
  dealCase(cases, "deal.test: only True cards", fixture("all-true").cards("c", 10, () => true), {}, 1, { count: 10 });
  dealCase(cases, "deal.test: only False cards", fixture("all-false").cards("c", 12, () => false), {}, 1, { count: 10 });
  dealCase(cases, "deal.test: 9 True and 3 False", fixture("nine-three").cards("c", 12, (i) => i < 9), {}, 1, { count: 10 });
  {
    const sixFour = fixture("six-four");
    const edge = [...sixFour.cards("t", 6, () => true), ...sixFour.cards("f", 4, () => false)];
    const sevenThree = fixture("seven-three").cards("c", 10, (i) => i < 7);
    for (const seed of first(range(0, 200))) {
      dealCase(cases, `deal.test: runs of three at most, seed ${seed}`, alt.cards("c", 20), {}, seed, { count: 10 });
      dealCase(cases, `deal.test: runs at the edge of the balance, seed ${seed}`, edge, {}, seed, { count: 10 });
      dealCase(cases, `deal.test: runs after relaxing the balance, seed ${seed}`, sevenThree, {}, seed, { count: 10 });
    }
    const nineOne = fixture("nine-one").cards("c", 10, (i) => i < 9);
    for (const seed of first(range(0, 100))) {
      dealCase(cases, `deal.test: 9 True and 1 False, seed ${seed}`, nineOne, {}, seed, { count: 10 });
      dealCase(cases, `deal.test: a long deal of twenty, seed ${seed}`, alt.cards("c", 40), {}, seed, { count: 20 });
    }
  }
  {
    const f = fixture("shuffles");
    const pool = [...f.cards("m", 3), ...f.cards("u", 20)];
    const history = f.history({ m1: missed(1), m2: missed(2), m3: missed(3) });
    for (const seed of first(range(0, 30))) dealCase(cases, `deal.test: missed cards not always first, seed ${seed}`, pool, history, seed, { count: 10 });
  }
  for (const seed of first(range(0, 30))) dealCase(cases, `deal.test: the answer pattern varies, seed ${seed}`, alt.cards("c", 20), {}, seed, { count: 10 });
  {
    const f = fixture("next-shape");
    const pool = [...f.cards("f", 8), ...Array.from({ length: 4 }, (_, i) => f.card(`g${i + 1}`, i % 2 === 0, ["same-topic"]))];
    for (const seed of first(range(0, 50))) dealCase(cases, `deal.test: a 12-card section with one group of four, seed ${seed}`, pool, {}, seed, { count: 10 });
  }
  // The corrupt history of the test, with -Infinity and -0 added: a non-finite lastSeenAt counts as 0.
  const corrupt = alt.history({
    c1: { seen: 1, lastCorrect: false, lastSeenAt: Number.NaN },
    c2: { seen: -4, lastCorrect: false, lastSeenAt: 5 },
    c3: { seen: 1, lastCorrect: true, lastSeenAt: Number.POSITIVE_INFINITY },
    c4: { seen: Number.NaN, lastCorrect: true, lastSeenAt: -1 },
    c5: { seen: 1, lastCorrect: false, lastSeenAt: Number.NEGATIVE_INFINITY },
    c6: { seen: 1, lastCorrect: true, lastSeenAt: -0 },
  });
  dealCase(cases, "deal.test: a history with corrupt numbers", alt.cards("c", 20), corrupt, 12, { count: 10 });
  chunkCase(cases, "deal.test: a history with corrupt numbers", alt.cards("c", 20), corrupt, 12, []);
}

// tests/engine/deal-pins-polish.test.ts after the reference vectors
function pinsPolishCases(cases: Cases): void {
  const alt = fixture("alt");
  const alternating = Array.from({ length: 10 }, (_, i) => i % 2 === 0);
  for (const seed of first(range(0, 50))) {
    dealCase(cases, `deal-pins-polish: after T F T F T F T F T F, seed ${seed}`, alt.cards("c", 40), {}, seed, { count: 10, before: alternating });
  }
  {
    const f = fixture("nine-and-one");
    const pool = [...f.cards("t", 9, () => true), f.card("f", false)];
    for (const seed of first(range(0, 50))) {
      dealCase(cases, `deal-pins-polish: 9 True and 1 False after three True, seed ${seed}`, pool, {}, seed, { count: 10, before: [true, true, true] });
    }
  }
  {
    const f = fixture("one-and-nine");
    const pool = [f.card("t", true), ...f.cards("f", 9, () => false)];
    for (const seed of first(range(0, 50))) dealCase(cases, `deal-pins-polish: 1 True and 9 False, seed ${seed}`, pool, {}, seed, { count: 10 });
  }
  {
    const f = fixture("over-cap-group");
    const wrong = [1, 2, 3, 4].map((i) => f.card(`m${i}`, false, i === 4 ? ["g"] : []));
    const m5 = f.card("m5", true);
    const pool = [...wrong, m5, ...[1, 2, 3, 4, 5, 6].map((i) => f.card(`u${i}`, true, i === 1 ? ["g"] : []))];
    for (const seed of first(range(0, 20))) {
      dealCase(cases, `deal-pins-polish: a missed card over the cap rather than a repeated group, seed ${seed}`, pool, missedFrom([...wrong, m5], 1), seed, { count: 10 });
    }
  }
  {
    const f = fixture("seen-zero-wrong");
    const pool = [...f.cards("m", 3), f.card("z", true), ...f.cards("u", 20)];
    const history = f.history({ m1: missed(10), m2: missed(20), m3: missed(30), z: { seen: 0, lastCorrect: false, lastSeenAt: 0 } });
    for (const seed of first(range(0, 20))) dealCase(cases, `deal-pins-polish: seen 0 with the last answer wrong, seed ${seed}`, pool, history, seed, { count: 10 });
  }
  {
    const f = fixture("cap-sizes");
    const wrong = f.cards("m", 10);
    const pool = [...wrong, ...f.cards("u", 30)];
    for (const count of [4, 5, 7, 9, 10, 14]) {
      for (const seed of first(range(0, 10))) dealCase(cases, `deal-pins-polish: the missed cap of ${count}, seed ${seed}`, pool, missedFrom(wrong, 1), seed, { count });
    }
  }
  {
    const f = fixture("true-first");
    const falses = f.cards("f", 20, () => false);
    const pool = [...f.cards("t", 20, () => true), ...falses];
    for (const count of [1, 3, 5, 7, 9, 10, 13, 20]) dealCase(cases, `deal-pins-polish: six True per ten, count ${count}`, pool, rightFrom(falses, 1), 1, { count });
  }
  {
    const f = fixture("false-first");
    const trues = f.cards("t", 20, () => true);
    const pool = [...f.cards("f", 20, () => false), ...trues];
    for (const count of [1, 3, 5, 7, 9, 10, 13, 20]) dealCase(cases, `deal-pins-polish: four True per ten, count ${count}`, pool, rightFrom(trues, 1), 1, { count });
  }
  {
    const f = fixture("window");
    const others = f.cards("k", 30);
    const p = f.card("p", true, ["G"]);
    const u = f.card("u", false, ["G"]);
    const before = others.slice(0, 15);
    for (const back of [CHUNK, CHUNK + 1]) {
      const dealt = [...before.slice(0, 15 - back), p, ...before.slice(15 - back + 1)];
      chunkCase(cases, `deal-pins-polish: the partner ${back} cards back`, [u, p, ...others], f.history({ u: missed(1) }), 7, dealt);
    }
  }
}

// tests/engine/chunks.test.ts (its dealRound seeds chunk k with createRng(seed + k))
function chunksCases(cases: Cases): void {
  const alt = fixture("alt");
  for (const seed of first(range(0, 200))) {
    dealCase(cases, `chunks: no run of three continued from before, seed ${seed}`, alt.cards("c", 40), {}, seed, { count: 10, before: [false, true, true, true] });
    dealCase(cases, `chunks: the cards before count into the run, seed ${seed}`, alt.cards("c", 40), {}, seed, { count: 10, before: [true, false, false] });
  }
  {
    const f = fixture("three-true-one-false");
    const pool = [...f.cards("t", 3, () => true), f.card("f1", false)];
    for (const seed of first(range(0, 50))) {
      dealCase(cases, `chunks: the one card of the other answer first, seed ${seed}`, pool, {}, seed, { count: 4, before: [true, true, true] });
    }
  }
  for (const seed of first(range(0, 50))) dealCase(cases, `chunks: nothing before, seed ${seed}`, alt.cards("c", 40), {}, seed, { count: 10, before: [] });
  dealCase(cases, "chunks: a run that cannot be broken", fixture("five-true").cards("t", 5, () => true), {}, 1, { count: 5, before: [true, true, true] });
  {
    const f = fixture("back-two-groups");
    const ks = Array.from({ length: 10 }, (_, i) => f.card(`k${i + 1}`, i % 2 === 0, i === 0 ? ["A"] : i === 1 ? ["B"] : []));
    const rs = Array.from({ length: 10 }, (_, i) => f.card(`r${i + 1}`, i % 2 === 0));
    const pool = [f.card("u1", true, ["A", "B"]), ...ks, ...rs];
    for (const seed of first(range(0, 20))) chunkCase(cases, `chunks: shown cards come back rather than repeat a group, seed ${seed}`, pool, {}, seed, [...ks, ...rs]);
  }
  {
    const f = fixture("back-x");
    const shown = [
      f.card("c1", false, ["X"]),
      ...Array.from({ length: 9 }, (_, i) => f.card(`c${i + 2}`, i % 3 !== 0)),
      ...Array.from({ length: 10 }, (_, i) => f.card(`c${i + 11}`, i % 2 === 0)),
    ];
    const pool = [...shown, f.card("c21", true, ["X"])];
    for (const seed of first(range(0, 50))) chunkCase(cases, `chunks: a card comes back rather than an unshown card of a group of the last ten, seed ${seed}`, pool, {}, seed, shown);
  }
  {
    const f = fixture("unshown-first");
    const wrong = [f.card("m1", true), f.card("m2", false), f.card("m3", true), f.card("m4", false)];
    const shown = Array.from({ length: 11 }, (_, i) => f.card(`k${i + 1}`, i % 2 === 1));
    const pool = [...wrong, ...Array.from({ length: 6 }, (_, i) => f.card(`u${i + 1}`, i % 2 === 0)), ...shown];
    for (const seed of first(range(0, 20))) chunkCase(cases, `chunks: every unshown card before any card comes back, seed ${seed}`, pool, missedFrom(wrong, 1), seed, shown);
  }
  for (const seed of first(range(0, 50))) chunkCase(cases, `chunks: the first chunk deals as deal does, seed ${seed}`, alt.cards("c", 40), {}, seed, []);
  for (const size of first(range(20, 46))) roundCases(cases, `chunks: ten whenever the route has twenty or more, size ${size}`, alt.cards("c", size), {}, (k) => size + k, 3 * size);
  for (const size of [20, 34, 47]) {
    for (const seed of first(range(0, 20))) roundCases(cases, `chunks: only unshown cards while ten are left, size ${size}, seed ${seed}`, alt.cards("c", size), {}, (k) => seed + k, size);
  }
  for (const seed of first(range(0, 20))) roundCases(cases, `chunks: the chunk that uses up the route, seed ${seed}`, alt.cards("c", 47), {}, (k) => seed + k, 50);
  for (const size of [11, 12, 15, 19]) {
    for (const seed of first(range(0, 20))) roundCases(cases, `chunks: a route of fewer than twenty, size ${size}, seed ${seed}`, alt.cards("c", size), {}, (k) => seed + k, size);
  }
  for (const size of first(range(1, 26))) roundCases(cases, `chunks: never empty and never more than ten, size ${size}`, alt.cards("c", size), {}, (k) => size + k, 60);
  for (const size of first(range(2, 26))) {
    for (const seed of first(range(0, 10))) roundCases(cases, `chunks: a card comes back only after min(10, size - 1), size ${size}, seed ${seed}`, alt.cards("c", size), {}, (k) => seed + k, 80);
  }
  roundCases(cases, "chunks: an 11 card route repeats in its first order", alt.cards("c", 11), {}, (k) => 5 + k, 33);
  roundCases(cases, "chunks: a one card route", alt.cards("c", 1), {}, (k) => 1 + k, 4);
  for (const size of [20, 34, 60]) {
    for (const seed of first(range(0, 50))) roundCases(cases, `chunks: the run limit and the balance, size ${size}, seed ${seed}`, alt.cards("c", size), {}, (k) => seed + k, 150);
  }
  {
    const f = fixture("pairs");
    const pool = Array.from({ length: 100 }, (_, i) => f.card(`g${i + 1}`, i % 2 === 0, [`group-${Math.floor(i / 2)}`]));
    for (const seed of first(range(0, 50))) roundCases(cases, `chunks: clear of the groups of the ten cards before, seed ${seed}`, pool, {}, (k) => seed + k, 250);
  }
  {
    const f = fixture("pair-21");
    const pool = Array.from({ length: 21 }, (_, i) => f.card(`c${i + 1}`, i % 2 === 0, i === 19 || i === 20 ? ["pair"] : []));
    const dealt = pool.slice(0, 20);
    const chunk = chunkCase(cases, "chunks: a card comes back rather than one sharing a group with the last ten", pool, {}, 3, dealt);
    chunkCase(cases, "chunks: one chunk later the last unshown card is first in line", pool, {}, 4, [...dealt, ...chunk]);
  }
  {
    const f = fixture("section-like");
    const groups: Record<number, string> = { 0: "a", 9: "a", 18: "a", 27: "a", 3: "b", 12: "b", 21: "b", 5: "c", 30: "c", 7: "d", 40: "d" };
    const pool = Array.from({ length: 47 }, (_, i) => f.card(`s${i + 1}`, i % 2 === 0, groups[i] === undefined ? [] : [`group-${groups[i]}`]));
    for (const seed of first(range(0, 30))) roundCases(cases, `chunks: a route like a real section, seed ${seed}`, pool, {}, (k) => seed + k, 150);
  }
  for (const size of [11, 12]) {
    for (const seed of first(range(0, 100))) roundCases(cases, `chunks: a route of ${size} keeps the gap, seed ${seed}`, alt.cards("c", size), {}, (k) => seed + k, 60);
  }
  {
    const pool = alt.cards("c", 30);
    roundCases(cases, "chunks: the stored history for the unshown cards", pool, missedFrom(pool.slice(0, 8), 1), (k) => 2 + k, 30);
  }
  {
    const pool = alt.cards("c", 25);
    const dealt = chunkCase(cases, "chunks: deterministic, the first chunk", pool, {}, 1, []);
    chunkCase(cases, "chunks: deterministic, the second chunk", pool, {}, 2, dealt);
  }
}

// tests/engine/overdue-polish.test.ts: chunk k of a round with seed s is dealt from chunkSeed(s, k), as rounds deal.
function overduePolishCases(cases: Cases): void {
  for (const size of [21, 22, 23]) {
    for (const seed of first(range(0, 200))) {
      roundCases(cases, `overdue-polish: every card of a ${size} card route, seed ${seed}`, overdueRouteOf(size), {}, (k) => chunkSeed(seed, k), 300);
    }
  }
  {
    const f = fixture("overdue-24");
    const shape = ["Tg2", "Fg0", "Tg1", "F", "F", "T", "Tg2", "Fg1", "F", "F", "F", "Fg2", "Fg0", "Fg2", "Tg1", "F", "F", "F", "F", "T", "T", "F", "T", "F"];
    const pool = shape.map((s, i) => f.card(`c${i + 1}`, s.startsWith("T"), s.length > 1 ? [s.slice(1)] : []));
    for (const seed of first(range(0, 200))) {
      roundCases(cases, `overdue-polish: the overdue card where the fallback would leave it out, seed ${seed}`, pool, {}, (k) => chunkSeed(seed, k), 300);
    }
  }
  const withoutRepeats = (dealt: readonly Card[]): Card[] => dealt.filter((c, i) => !dealt.slice(i + 1).some((later) => later.id === c.id));
  const pools: [string, Card[]][] = [
    ["without groups", fixture("overdue-free").cards("c", 23)],
    ["of 21 cards with one pair", overdueRouteOf(21)],
    ["of 23 cards with three pairs", overdueRouteOf(23)],
  ];
  for (const [name, pool] of pools) {
    for (const seed of first(range(0, 50))) {
      const dealt: Card[] = [];
      for (let k = 0; dealt.length < 2 * pool.length; k++) {
        const label = `overdue-polish: a route ${name} deals as without the rule, seed ${seed}, chunk ${k}`;
        const chunk = chunkCase(cases, label, pool, {}, chunkSeed(seed, k), dealt);
        chunkCase(cases, `${label}, without repeats`, pool, {}, chunkSeed(seed, k), withoutRepeats(dealt));
        dealt.push(...chunk);
      }
    }
  }
}

// tests/engine/search-polish.test.ts
function searchPolishCases(cases: Cases): void {
  {
    const ranked = cutPool();
    for (const seed of first(range(0, 20))) {
      dealCase(cases, `search-polish: too few False cards behind the groups, budget 40, seed ${seed}`, ranked, rightFrom(ranked, 1), seed, { count: 10, budget: 40 });
    }
    dealCase(cases, "search-polish: too few False cards behind the groups, the default budget", ranked, rightFrom(ranked, 1), 1, { count: 10 });
    dealCase(cases, "search-polish: too few False cards behind the groups, a budget of one step", ranked, rightFrom(ranked, 1), 1, { count: 10, budget: 1 });
  }
  for (const [name, scarce] of [["False", false], ["True", true]] as const) {
    const f = fixture(`cut-scarce-${name.toLowerCase()}`);
    const ranked = [
      f.card("h", !scarce, ["G"]),
      ...Array.from({ length: 20 }, (_, i) => f.card(`t${i + 1}`, !scarce)),
      ...Array.from({ length: 6 }, (_, i) => f.card(`a${i + 1}`, scarce, ["A"])),
      f.card("d1", scarce),
      f.card("d2", scarce),
      f.card("g", scarce, ["G"]),
    ];
    for (const seed of first(range(0, 20))) {
      dealCase(cases, `search-polish: ${name} cards of one group give one card, budget 200, seed ${seed}`, ranked, rightFrom(ranked, 1), seed, { count: 10, budget: 200 });
    }
  }
  {
    const f = fixture("cut-x");
    const pairs = Array.from({ length: 4 }, (_, i) => [f.card(`p${i + 1}t`, true, [`P${i + 1}`]), f.card(`p${i + 1}f`, false, [`P${i + 1}`])]).flat();
    const ranked = [
      f.card("x", true, ["X1", "X2"]),
      ...pairs,
      f.card("t1", true),
      f.card("t2", true),
      f.card("f1", false),
      f.card("f2", false),
      f.card("y1", false, ["X1"]),
      f.card("y2", false, ["X2"]),
    ];
    for (const seed of first(range(0, 20))) {
      dealCase(cases, `search-polish: a card that blocks two groups, budget 40, seed ${seed}`, ranked, rightFrom(ranked, 1), seed, { count: 10, budget: 40 });
    }
  }
  {
    const rng = createRng(107);
    for (let n = 0; n < SAMPLE; n++) {
      const pool = randomPool(fixture(`random-${n}`), rng);
      const seed = Math.floor(rng() * 2 ** 32);
      dealCase(cases, `search-polish: random pool ${n}`, pool, {}, seed, { count: 10 });
      chunkCase(cases, `search-polish: random pool ${n}`, pool, {}, seed, []);
    }
  }
  chunkCase(cases, "search-polish: the ring, a full chunk at once", ringPool(), {}, 1, []);
}

// search-polish's randomPool: 12 to 40 cards, some groups of two to four cards, answers more or less balanced.
function randomPool(f: Fixture, rng: Rng): Card[] {
  const size = 12 + Math.floor(rng() * 29);
  const groups = Math.max(2, Math.floor(size / (2 + rng() * 3)));
  const grouped = 0.3 + rng() * 0.5;
  const trueShare = 0.3 + rng() * 0.4;
  return Array.from({ length: size }, (_, i) => f.card(`c${i + 1}`, rng() < trueShare, rng() < grouped ? [`g${Math.floor(rng() * groups)}`] : []));
}

// tests/engine/missed-cap-polish.test.ts. The first chunk of a Classic round is dealChunk(pool, history, createRng(chunkSeed(seed, 0)), []).
function missedCapCases(cases: Cases): void {
  {
    const f = fixture("swap");
    const pool = [
      f.card("M1", true, ["g"]),
      f.card("M2", true),
      f.card("M3", false),
      f.card("M4", false),
      f.card("M5", false),
      f.card("N1", true, ["g"]),
      f.card("N2", true),
      f.card("N3", true),
      f.card("N4", false),
      f.card("N5", false),
      f.card("N6", false),
      f.card("N7", false),
    ];
    const history = { ...missedFrom(pool.slice(0, 5), 1), ...rightFrom(pool.slice(5), 100) };
    for (const seed of first(range(0, 50))) {
      chunkCase(cases, `missed-cap-polish: an old miss swapped for a newer one, seed ${seed}`, pool, history, chunkSeed(seed, 0), []);
    }
  }
  const rng = createRng(60);
  for (let n = 0; n < SAMPLE; n++) {
    const f = fixture(`cap-random-${n}`);
    const size = 11 + Math.floor(rng() * 40);
    const pool = Array.from({ length: size }, (_, i) => {
      const group = rng() < 0.35 ? [`g${Math.floor(rng() * Math.max(2, size / 4))}`] : [];
      return f.card(`c${i + 1}`, rng() < 0.5, group);
    });
    const wrongShare = 0.3 + rng() * 0.6;
    const history: Record<string, CardHistory> = {};
    pool.forEach((c, i) => {
      const draw = rng();
      if (draw < wrongShare) history[c.id] = missed(1 + i);
      else if (draw < wrongShare + 0.2) history[c.id] = right(1 + i);
    });
    const seed = Math.floor(rng() * 2 ** 32);
    dealCase(cases, `missed-cap-polish: random pool ${n}`, pool, history, seed, { count: 10 });
    chunkCase(cases, `missed-cap-polish: random pool ${n}`, pool, history, seed, []);
  }
}

// tests/engine/deal.property.test.ts: its scenario(seed), with the cards named after the scenario.
function propertyCases(cases: Cases): void {
  const GROUPS = Array.from({ length: 10 }, (_, i) => `topic-${i}`);
  const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)] as T;
  for (const poolSeed of first(range(1, 101))) {
    const f = fixture(`property-${poolSeed}`);
    const tec = (local: string, answer: boolean, groups: readonly string[]): Card => ({ ...f.card(local, answer, groups), section: "TEC" });
    const rng = createRng(poolSeed);
    const size = 36 + Math.floor(rng() * 9);
    const pool: Card[] = [];
    const history: Record<string, CardHistory> = {};
    for (let i = 0; i < size; i++) {
      const answer = i < 16 ? i % 2 === 0 : rng() < 0.5;
      const roll = rng();
      const groups = i < 16 || roll < 0.6 ? [] : roll < 0.92 ? [pick(GROUPS, rng)] : [pick(GROUPS, rng), pick(GROUPS, rng)];
      pool.push(tec(`c${i}`, answer, [...new Set(groups)]));
      const kind = rng();
      if (kind < 0.2) history[f.id(`c${i}`)] = { seen: 1 + Math.floor(rng() * 3), lastCorrect: false, lastSeenAt: Math.floor(rng() * 1e6) };
      else if (kind < 0.5) history[f.id(`c${i}`)] = { seen: 1 + Math.floor(rng() * 3), lastCorrect: true, lastSeenAt: Math.floor(rng() * 1e6) };
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j] as Card, pool[i] as Card];
    }
    for (const dealSeed of first(range(0, 10))) dealCase(cases, `deal.property: pool ${poolSeed}, seed ${dealSeed}`, pool, history, dealSeed, { count: 10 });
    const avoidRng = createRng(poolSeed * 31);
    const avoid = Array.from({ length: 10 }, (_, i) => tec(`earlier-${i}`, i % 2 === 0, [pick(GROUPS, avoidRng)]));
    dealCase(cases, `deal.property: pool ${poolSeed}, clear of the groups of the ten before`, pool, history, poolSeed, { count: 10, avoid });
    dealCase(cases, `deal.property: pool ${poolSeed}, twenty cards`, pool, history, poolSeed, { count: 20 });
    dealCase(cases, `deal.property: pool ${poolSeed}, seed 9`, pool, history, 9, { count: 10 });
  }
}

// tests/content/shipped-dealing-polish.test.ts
function shippedCases(cases: Cases): void {
  const decks = shippedDecks();
  for (const deck of decks) {
    const pool = poolFor(deck, WHOLE_DECK);
    chunkCase(cases, `shipped: ${deck.id}/${WHOLE_DECK}, the first chunk, seed 0`, pool, {}, chunkSeed(0, 0), [], undefined, deckRef(deck.id));
    chunkCase(cases, `shipped: ${deck.id}/${WHOLE_DECK}, the first chunk without the bound, seed 0`, pool, {}, chunkSeed(0, 0), [], Infinity, deckRef(deck.id));
  }
  for (const name of GROUPS_GIVE_WAY) {
    const [deckId, sectionId] = name.split("/") as [string, string];
    const deck = decks.find((d) => d.id === deckId);
    if (deck === undefined) throw new Error(`no shipped deck ${deckId}`);
    const pool = poolFor(deck, sectionId);
    for (const seed of first(range(0, 30))) {
      dealCase(cases, `shipped: ${name}, a Classic deal, seed ${seed}`, pool, {}, seed, { count: CHUNK });
      dealCase(cases, `shipped: ${name}, a Classic deal, half missed, seed ${seed}`, pool, halfMissed(pool, seed), seed, { count: CHUNK });
    }
    roundCases(cases, `shipped: ${name}, a round that goes on, seed 0`, pool, {}, (k) => chunkSeed(0, k), 3 * pool.length + CHUNK);
  }
  // The deal the bound once decided: Cloud Practitioner "Security and compliance", seed 5670, chunk 1.
  const clf = decks.find((d) => d.id === "aws-clf-c02");
  if (clf === undefined) throw new Error("no shipped deck aws-clf-c02");
  const security = poolFor(clf, "SEC");
  const history = halfMissed(security, 5670 ^ 0x123);
  roundCases(cases, "shipped: aws-clf-c02/SEC, seed 5670, with the bound", security, history, (k) => chunkSeed(5670, k), 8 * CHUNK);
  roundCases(cases, "shipped: aws-clf-c02/SEC, seed 5670, without the bound", security, history, (k) => chunkSeed(5670, k), 8 * CHUNK, Infinity);
}

export function golden(): GoldenFile[] {
  const cases: Cases = { deal: [], dealChunk: [] };
  pinsCases(cases);
  dealTestCases(cases);
  pinsPolishCases(cases);
  chunksCases(cases);
  overduePolishCases(cases);
  searchPolishCases(cases);
  missedCapCases(cases);
  propertyCases(cases);
  shippedCases(cases);
  const meta = (fn: string, tests: readonly string[]) => ({ module: DEAL_MODULE, function: fn, source: DEAL_SOURCE, tests });
  return [
    goldenFile(meta("deal", DEAL_TESTS), cases.deal),
    goldenFile(meta("dealChunk", DEAL_TESTS), cases.dealChunk),
    goldenFile(meta("DEAL", ["tests/engine/deal.test.ts"]), [{ name: "the value", input: null, output: DEAL }]),
    goldenFile(meta("CHUNK", ["tests/engine/chunks.test.ts"]), [{ name: "the value", input: null, output: CHUNK }]),
    goldenFile(meta("SEARCH_BUDGET", ["tests/engine/search-polish.test.ts"]), [{ name: "the value", input: null, output: SEARCH_BUDGET }]),
  ];
}
