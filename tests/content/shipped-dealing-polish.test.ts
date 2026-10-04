import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDecks } from "@/src/content/build";
import { poolFor } from "@/src/content/load";
import { WHOLE_DECK, type Card } from "@/src/content/schema";
import { CHUNK, DEAL, deal, dealChunk, type CardHistory, type History } from "@/src/engine/deal";
import { createRng } from "@/src/engine/rng";
import { chunkSeed } from "@/src/engine/round";

// The shipped decks against the dealing rules of spec section 6. The other content tests check the cards one by
// one; these deal from every route a player can choose, so that a content edit which leaves a route unable to keep a
// rule (a lopsided section, a conflict group on too many cards) fails here and not on a phone.

function readContent(path: string): string {
  return readFileSync(new URL(`../../content/${path}`, import.meta.url), "utf8");
}

// Every reviewed deck, built as scripts/build-decks.ts builds them.
const reviewedDir = new URL("../../content/reviewed/", import.meta.url);
const reviewed = Object.fromEntries(
  readdirSync(reviewedDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => [name.slice(0, -".json".length), JSON.parse(readContent(`reviewed/${name}`)) as unknown]),
);
const { decks } = buildDecks({ catalog: JSON.parse(readContent("catalog.json")), reviewed, version: "2026-10-01" });

// Every route: the whole deck and each of its sections.
const routes: { name: string; pool: Card[] }[] = decks.flatMap((deck) => {
  const sections = [...new Set(deck.cards.map((c) => c.section))].filter((id) => id !== WHOLE_DECK);
  return [WHOLE_DECK, ...sections].map((sectionId) => ({ name: `${deck.id}/${sectionId}`, pool: poolFor(deck, sectionId) }));
});

// Routes so small that a Classic round cannot keep the conflict groups apart: every way to choose its ten cards (or
// all of them) within the balance puts two cards of one group together, so the groups give way as the spec orders,
// and the round holds as few repeats as the route allows. Each is checked to be so below; when a content edit lets
// one of them keep the groups, or makes another route lose them, this list has to change with it.
const GROUPS_GIVE_WAY = [
  "azure-az-900/STO",
  "docker-fundamentals/REG",
  "docker-fundamentals/SEC",
  "linux-command-line/SYS",
  "nextjs-rendering/DAT",
  "nextjs-rendering/REQ",
  "nextjs-rendering/REV",
  "nextjs-rendering/STR",
  "terraform-associate/MOD",
  "typescript-fundamentals/ENM",
];

function trueCount(cards: readonly Card[]): number {
  return cards.filter((c) => c.answer).length;
}

function longestRun(cards: readonly Card[]): number {
  let longest = 0;
  let run = 0;
  cards.forEach((c, i) => {
    run = i > 0 && cards[i - 1]?.answer === c.answer ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}

function repeatedGroups(cards: readonly Card[]): string[] {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const c of cards) {
    for (const g of c.conflictGroups) {
      if (seen.has(g)) repeated.push(g);
      seen.add(g);
    }
  }
  return repeated;
}

function inBalance(cards: readonly Card[]): boolean {
  const trues = trueCount(cards);
  return trues >= Math.floor((cards.length * DEAL.minTrue) / 10) && trues <= Math.ceil((cards.length * DEAL.maxTrue) / 10);
}

// The fewest repeated groups a choice of `size` cards of a small pool can have while it keeps the balance: every
// choice is tried. 0 means some choice keeps every rule.
function fewestRepeats(pool: readonly Card[], size: number): number {
  const chosen: Card[] = [];
  let fewest = Infinity;
  const visit = (from: number) => {
    if (chosen.length === size) {
      if (inBalance(chosen)) fewest = Math.min(fewest, repeatedGroups(chosen).length);
      return;
    }
    for (let i = from; i <= pool.length - (size - chosen.length); i++) {
      chosen.push(pool[i]!);
      visit(i + 1);
      chosen.pop();
    }
  };
  visit(0);
  return fewest;
}

// A history with every card seen and about half of them missed, from a seed (the shape of a player part of the way in).
function halfMissed(pool: readonly Card[], seed: number): History {
  const rng = createRng(seed);
  const history: Record<string, CardHistory> = {};
  for (const c of pool) history[c.id] = { seen: 1, lastCorrect: rng() < 0.5, lastSeenAt: Math.floor(rng() * 1e6) };
  return history;
}

describe("the shipped decks: a Classic round on every route", () => {
  it("has routes to deal from", () => {
    expect(routes.length).toBeGreaterThan(50);
    for (const name of GROUPS_GIVE_WAY) expect(routes.map((route) => route.name)).toContain(name);
  });

  it.each(routes.map((route) => [route.name, route.pool] as const))("%s keeps the balance and the run limit, and the groups apart unless it cannot", (name, pool) => {
    const givesWay = GROUPS_GIVE_WAY.includes(name);
    const size = Math.min(CHUNK, pool.length);
    if (givesWay) expect(pool.length, `${name} is small enough to try every choice`).toBeLessThanOrEqual(14);
    const fewest = givesWay ? fewestRepeats(pool, size) : 0;
    if (givesWay) expect(fewest, `${name} can keep every rule now`).toBeGreaterThan(0);
    for (let seed = 0; seed < 30; seed++) {
      for (const history of [{}, halfMissed(pool, seed)]) {
        const dealt = deal(pool, history, createRng(seed), { count: CHUNK });
        expect(dealt, `${name}, seed ${seed}`).toHaveLength(size);
        expect(inBalance(dealt), `${name}, seed ${seed}: ${trueCount(dealt)} True of ${dealt.length}`).toBe(true);
        expect(longestRun(dealt), `${name}, seed ${seed}`).toBeLessThanOrEqual(DEAL.maxRun);
        if (!givesWay) expect(repeatedGroups(dealt), `${name}, seed ${seed}`).toEqual([]);
        else expect(repeatedGroups(dealt).length, `${name}, seed ${seed}: as few repeats as the route allows`).toBe(fewest);
      }
    }
  });
});

describe("the shipped decks: a round that goes on", () => {
  it.each(routes.map((route) => [route.name, route.pool] as const))("%s shows every card within three passes of the route", (name, pool) => {
    for (let seed = 0; seed < 10; seed++) {
      const dealt: Card[] = [];
      while (dealt.length < 3 * pool.length + CHUNK) {
        dealt.push(...dealChunk(pool, {}, createRng(chunkSeed(seed, Math.floor(dealt.length / CHUNK))), dealt));
      }
      const shown = new Set(dealt.map((c) => c.id));
      expect(pool.filter((c) => !shown.has(c.id)).map((c) => c.id), `${name}, seed ${seed}`).toEqual([]);
    }
  });

  // The bound on the search only matters for pools where no deal keeps every rule; on the shipped decks it must
  // never decide a deal. With a half-missed history this once failed: on Cloud Practitioner "Security and
  // compliance", seed 5670, chunk 1, the search ran out of steps and dealt three missed cards where one would do.
  it.each(routes.filter((route) => route.pool.length > 20).map((route) => [route.name, route.pool] as const))(
    "%s deals the same with and without the bound on the search",
    (name, pool) => {
      for (const seed of [0, 1, 2, 5670]) {
        const history = halfMissed(pool, seed ^ 0x123);
        const bounded: Card[] = [];
        const unbounded: Card[] = [];
        for (let k = 0; k < 8; k++) {
          bounded.push(...dealChunk(pool, history, createRng(chunkSeed(seed, k)), bounded));
          unbounded.push(...dealChunk(pool, history, createRng(chunkSeed(seed, k)), unbounded, Infinity));
        }
        expect(bounded.map((c) => c.id), `${name}, seed ${seed}`).toEqual(unbounded.map((c) => c.id));
      }
    },
  );
});
