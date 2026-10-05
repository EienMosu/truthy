import { describe, expect, it } from "vitest";
import type { Card } from "@/src/content/schema";
import { CHUNK, DEAL, deal, dealChunk, type History } from "@/src/engine/deal";
import { createRng } from "@/src/engine/rng";

function card(id: string, answer: boolean, conflictGroups: string[] = []): Card {
  return {
    id,
    section: "SEC",
    text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
    answer,
    source: { title: "AWS documentation", url: "https://docs.aws.amazon.com/" },
    difficulty: 2,
    appliesTo: "",
    conflictGroups,
  };
}

function cards(prefix: string, n: number, answer: (i: number) => boolean = (i) => i % 2 === 0): Card[] {
  return Array.from({ length: n }, (_, i) => card(`${prefix}${i + 1}`, answer(i)));
}

const missed = (lastSeenAt: number) => ({ seen: 1, lastCorrect: false, lastSeenAt });
const right = (lastSeenAt: number) => ({ seen: 1, lastCorrect: true, lastSeenAt });

function ids(dealt: readonly Card[]): string[] {
  return dealt.map((c) => c.id);
}

function trueCount(dealt: readonly Card[]): number {
  return dealt.filter((c) => c.answer).length;
}

function longestRun(answers: readonly boolean[]): number {
  let longest = 0;
  let run = 0;
  answers.forEach((answer, i) => {
    run = i > 0 && answers[i - 1] === answer ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}

function repeatedGroups(dealt: readonly Card[]): string[] {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const c of dealt) {
    for (const g of c.conflictGroups) {
      if (seen.has(g)) repeated.push(g);
      seen.add(g);
    }
  }
  return repeated;
}

// The Swift and Kotlin clones must deal the same cards in the same order for the same seed (spec section 4). These
// vectors pin every step of a deal: the ranking, the search, the limit on missed cards over the cap, the overdue
// card, the run limit and the draw of each answer.
describe("deal: reference vectors", () => {
  // 16 cards with answers True, False, True, ...; c3 and c8 share group a, c5 and c12 share group b; c1 and c6 were
  // missed, c2 was answered right.
  const pool = Array.from({ length: 16 }, (_, i) =>
    card(`c${i + 1}`, i % 2 === 0, i === 2 || i === 7 ? ["a"] : i === 4 || i === 11 ? ["b"] : []),
  );
  const history: History = { c1: missed(5), c2: { seen: 2, lastCorrect: true, lastSeenAt: 9 }, c6: missed(3) };

  it.each([
    [1, ["c3", "c10", "c16", "c9", "c5", "c6", "c7", "c14", "c15", "c1"]],
    [2, ["c11", "c13", "c8", "c10", "c14", "c9", "c16", "c15", "c1", "c6"]],
    [3, ["c9", "c6", "c1", "c16", "c4", "c13", "c14", "c11", "c5", "c8"]],
  ])("seed %i deals exactly these ten cards in this order", (seed, expected) => {
    expect(ids(deal(pool, history, createRng(seed), { count: 10 }))).toEqual(expected);
  });

  it("three chunks with the seeds 100, 101 and 102 deal exactly these cards", () => {
    const dealt: Card[] = [];
    for (let k = 0; k < 3; k++) dealt.push(...dealChunk(pool, history, createRng(100 + k), dealt));
    expect(ids(dealt)).toEqual([
      "c11", "c6", "c14", "c9", "c13", "c10", "c3", "c16", "c1", "c15",
      "c7", "c4", "c12", "c8", "c5", "c2",
      "c6", "c14", "c11", "c10", "c9", "c13",
    ]);
  });

  describe("with more missed cards than the cap", () => {
    // c1 to c3 (True) and c4 to c8 (False) were missed, oldest first; c9 to c15 (True) were never seen; c16 (False)
    // was answered right. c5 and c10 share group b. The three missed cards within the cap are True, so the cards
    // within the cap hold one False card and no deal keeps every rule without the missed cards over it. With them
    // and no limit, the search deals c1 to c3 and three of c4 to c8: six missed cards. The limit of three finds a
    // deal that keeps the cap: c16, three of c4 to c8 (c4, c6 and c7 here, as c10 holds group b) and six True cards
    // never seen.
    const overCapPool = Array.from({ length: 16 }, (_, i) =>
      card(`c${i + 1}`, i < 3 || (i >= 8 && i < 15), i === 4 || i === 9 ? ["b"] : []),
    );
    const overCapHistory: History = {
      ...Object.fromEntries(overCapPool.slice(0, 8).map((c, i) => [c.id, missed(i + 1)])),
      c16: right(9),
    };

    it.each([
      [1, ["c10", "c7", "c6", "c12", "c15", "c16", "c13", "c4", "c9", "c14"]],
      [2, ["c13", "c11", "c4", "c14", "c6", "c16", "c10", "c15", "c9", "c7"]],
      [3, ["c9", "c16", "c10", "c4", "c7", "c14", "c13", "c6", "c11", "c15"]],
    ])("seed %i deals exactly these ten cards in this order", (seed, expected) => {
      expect(ids(deal(overCapPool, overCapHistory, createRng(seed), { count: 10 }))).toEqual(expected);
    });
  });

  it("six chunks with the seeds 210 to 215 deal exactly these cards, k1 overdue in the sixth", () => {
    // 21 cards with answers True, False, True, ...; k1 and k12 share group pair. Without the overdue rule, k1 is
    // still unshown after eighty cards. Once the round has dealt the route twice (42 cards), k1 is overdue, and the
    // sixth chunk takes it in although k12 is among the ten cards before it.
    const route = Array.from({ length: 21 }, (_, i) => card(`k${i + 1}`, i % 2 === 0, i === 0 || i === 11 ? ["pair"] : []));
    const dealt: Card[] = [];
    for (let k = 0; k < 6; k++) dealt.push(...dealChunk(route, {}, createRng(210 + k), dealt));
    expect(ids(dealt)).toEqual([
      "k7", "k3", "k15", "k8", "k12", "k19", "k4", "k14", "k17", "k11",
      "k9", "k10", "k16", "k6", "k21", "k5", "k18", "k2", "k20", "k13",
      "k7", "k11", "k12", "k19", "k3", "k17", "k14", "k4", "k15", "k8",
      "k6", "k13", "k9", "k20", "k5", "k2", "k16", "k21", "k10", "k18",
      "k15", "k7", "k14", "k17", "k4", "k3", "k19", "k8", "k11", "k12",
      "k20", "k1", "k9", "k21", "k2", "k5", "k13", "k10", "k16", "k6",
    ]);
  });
});

describe("deal: the run limit across a join, exactly", () => {
  it("counts only the run that ends the cards before: after T F T F T F T F T F, either answer may come first", () => {
    const before = Array.from({ length: 10 }, (_, i) => i % 2 === 0);
    const firsts = new Set<boolean>();
    for (let seed = 0; seed < 50; seed++) {
      const first = deal(cards("c", 40), {}, createRng(seed), { count: 10, before })[0];
      if (first !== undefined) firsts.add(first.answer);
    }
    expect(firsts).toEqual(new Set([true, false]));
  });

  it("works out the raised limit with the cards before: after three True, 9 True and 1 False give a longest run of exactly 6", () => {
    // The best order is T T T | T T T F T T T T T T: the one False card splits the twelve True cards into six and six.
    const pool = [...cards("t", 9, () => true), card("f", false)];
    for (let seed = 0; seed < 50; seed++) {
      const dealt = deal(pool, {}, createRng(seed), { count: 10, before: [true, true, true] });
      expect(longestRun([true, true, true, ...dealt.map((c) => c.answer)]), `seed ${seed}`).toBe(6);
    }
  });

  it("raises the limit only as far as it must: 1 True and 9 False give a longest run of exactly 5", () => {
    const pool = [card("t", true), ...cards("f", 9, () => false)];
    for (let seed = 0; seed < 50; seed++) {
      const dealt = deal(pool, {}, createRng(seed), { count: 10 });
      expect(longestRun(dealt.map((c) => c.answer)), `seed ${seed}`).toBe(5);
    }
  });
});

describe("deal: the rules at their exact edges", () => {
  it("lets a missed card over the cap in rather than repeat a conflict group", () => {
    // Missed, oldest first: m1 to m4 False (m4 in group g) and m5 True; never seen: u1 to u6 True (u1 in group g).
    // The only deal that keeps every rule is m1 to m5 with u2 to u6.
    const wrong = [1, 2, 3, 4].map((i) => card(`m${i}`, false, i === 4 ? ["g"] : []));
    const m5 = card("m5", true);
    const unseen = [1, 2, 3, 4, 5, 6].map((i) => card(`u${i}`, true, i === 1 ? ["g"] : []));
    const history: History = Object.fromEntries([...wrong, m5].map((c, i) => [c.id, missed(i + 1)]));
    for (let seed = 0; seed < 20; seed++) {
      const dealt = deal([...wrong, m5, ...unseen], history, createRng(seed), { count: 10 });
      expect(dealt, `seed ${seed}`).toHaveLength(10);
      expect(repeatedGroups(dealt), `seed ${seed}`).toEqual([]);
    }
  });

  it("treats an entry seen 0 times as never seen, also when it says the last answer was wrong", () => {
    // A seen-0 entry with lastCorrect false must not take a missed card's place: m1 to m3 are the three missed cards.
    const wrong = cards("m", 3);
    const pool = [...wrong, card("z", true), ...cards("u", 20)];
    const history: History = {
      m1: missed(10),
      m2: missed(20),
      m3: missed(30),
      z: { seen: 0, lastCorrect: false, lastSeenAt: 0 },
    };
    for (let seed = 0; seed < 20; seed++) {
      expect(ids(deal(pool, history, createRng(seed), { count: 10 })), `seed ${seed}`).toEqual(
        expect.arrayContaining(["m1", "m2", "m3"]),
      );
    }
  });

  // The missed cap is three per ten rounded down, the balance four per ten rounded down to six per ten rounded up
  // (spec section 6, scaled to the size of the deal).
  it.each([
    [4, 1],
    [5, 1],
    [7, 2],
    [9, 2],
    [10, 3],
    [14, 4],
  ])("a deal of %i holds exactly %i missed cards (three per ten, rounded down)", (count, cap) => {
    const wrong = cards("m", 10);
    const history: History = Object.fromEntries(wrong.map((c, i) => [c.id, missed(i + 1)]));
    for (let seed = 0; seed < 10; seed++) {
      const dealt = deal([...wrong, ...cards("u", 30)], history, createRng(seed), { count });
      expect(dealt.filter((c) => c.id.startsWith("m")), `seed ${seed}`).toHaveLength(cap);
    }
  });

  it.each([1, 3, 5, 7, 9, 10, 13, 20])("a deal of %i holds six True per ten, rounded up, when True cards come first", (count) => {
    // Never seen True cards rank before False cards answered right, so the deal takes True cards up to the limit.
    const falses = cards("f", 20, () => false);
    const pool = [...cards("t", 20, () => true), ...falses];
    const history: History = Object.fromEntries(falses.map((c, i) => [c.id, right(i + 1)]));
    expect(trueCount(deal(pool, history, createRng(1), { count }))).toBe(Math.ceil((count * DEAL.maxTrue) / 10));
  });

  it.each([1, 3, 5, 7, 9, 10, 13, 20])("a deal of %i holds four True per ten, rounded down, when False cards come first", (count) => {
    const trues = cards("t", 20, () => true);
    const pool = [...cards("f", 20, () => false), ...trues];
    const history: History = Object.fromEntries(trues.map((c, i) => [c.id, right(i + 1)]));
    expect(trueCount(deal(pool, history, createRng(1), { count }))).toBe(Math.floor((count * DEAL.minTrue) / 10));
  });
});

// Plan decision 10: the conflict window of a chunk is the ten cards dealt before it, no more and no fewer.
describe("dealChunk: the conflict window is exactly the last ten cards", () => {
  // u (missed, so first in line) shares group G with p. The round has dealt fifteen other cards, p among them.
  function chunkWithPartnerBack(back: number): string[] {
    const others = cards("k", 30);
    const p = card("p", true, ["G"]);
    const u = card("u", false, ["G"]);
    const before = others.slice(0, 15);
    const dealt = [...before.slice(0, 15 - back), p, ...before.slice(15 - back + 1)];
    return ids(dealChunk([u, p, ...others], { u: missed(1) }, createRng(7), dealt));
  }

  it("keeps u out while p is among the last ten cards", () => {
    expect(chunkWithPartnerBack(CHUNK)).not.toContain("u");
  });

  it("deals u once p is eleven cards back", () => {
    expect(chunkWithPartnerBack(CHUNK + 1)).toContain("u");
  });
});
