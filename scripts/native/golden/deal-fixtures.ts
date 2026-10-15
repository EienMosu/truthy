// The cards, histories and pools the dealing vectors are made of: the scenarios of the dealing tests, and the shipped
// decks built as scripts/build-decks.ts builds them.
import { readFileSync, readdirSync } from "node:fs";
import { buildDecks } from "@/src/content/build";
import type { CardHistory, History } from "@/src/content/play";
import type { Card, DeckFile } from "@/src/content/schema";
import { CHUNK } from "@/src/engine/deal";
import { createRng } from "@/src/engine/rng";

export const DEAL_MODULE = "src/engine/deal";
export const DEAL_SOURCE = "src/engine/deal.ts";
export const DEAL_TESTS = [
  "tests/engine/deal.test.ts",
  "tests/engine/deal-pins-polish.test.ts",
  "tests/engine/chunks.test.ts",
  "tests/engine/missed-cap-polish.test.ts",
  "tests/engine/search-polish.test.ts",
  "tests/engine/overdue-polish.test.ts",
  "tests/engine/overdue-boundary.test.ts",
  "tests/engine/deal.property.test.ts",
  "tests/content/shipped-dealing-polish.test.ts",
] as const;

// How much of each loop of the web tests goes into the vectors: the first SAMPLE items of a loop over seeds, sizes or
// generated pools, and the first ROUND_CHUNKS chunks of a round. The reference vectors of deal-pins-polish and
// overdue-boundary are whole: they need no more than six chunks.
export const SAMPLE = 2;
export const ROUND_CHUNKS = 6;

export function first<T>(items: readonly T[]): T[] {
  return items.slice(0, SAMPLE);
}

export function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, i) => from + i);
}

export interface Fixture {
  id(local: string): string;
  card(local: string, answer: boolean, conflictGroups?: readonly string[]): Card;
  cards(prefix: string, n: number, answer?: (i: number) => boolean): Card[];
  history(entries: Record<string, CardHistory>): History;
}

// The web tests reuse names such as c1 for different cards, and a golden file holds one card per id, so the cards of a
// scenario carry its name: "pins:c3" is card c3 of the reference vectors. Otherwise a card is built as the tests build it.
export function fixture(name: string): Fixture {
  const id = (local: string) => `${name}:${local}`;
  const card = (local: string, answer: boolean, conflictGroups: readonly string[] = []): Card => ({
    id: id(local),
    section: "SEC",
    text: { en: { statement: `Statement ${local}`, explanation: `Explanation ${local}` } },
    answer,
    source: { title: "AWS documentation", url: "https://docs.aws.amazon.com/" },
    difficulty: 2,
    appliesTo: "",
    conflictGroups: [...conflictGroups],
  });
  const cards = (prefix: string, n: number, answer: (i: number) => boolean = (i) => i % 2 === 0): Card[] =>
    Array.from({ length: n }, (_, i) => card(`${prefix}${i + 1}`, answer(i)));
  const history = (entries: Record<string, CardHistory>): History =>
    Object.fromEntries(Object.entries(entries).map(([local, entry]) => [id(local), entry]));
  return { id, card, cards, history };
}

export const missed = (lastSeenAt: number): CardHistory => ({ seen: 1, lastCorrect: false, lastSeenAt });
export const right = (lastSeenAt: number): CardHistory => ({ seen: 1, lastCorrect: true, lastSeenAt });

// Each card missed (or answered right) once, the first card longest ago: the times are from, from + 1, ...
export function missedFrom(cards: readonly Card[], from: number): History {
  return Object.fromEntries(cards.map((c, i) => [c.id, missed(from + i)]));
}

export function rightFrom(cards: readonly Card[], from: number): History {
  return Object.fromEntries(cards.map((c, i) => [c.id, right(from + i)]));
}

// deal-pins-polish: 16 cards with answers True, False, True, ...; c3 and c8 share group a, c5 and c12 share group b;
// c1 and c6 were missed, c2 was answered right.
export function pinsPool(): { pool: Card[]; history: History } {
  const f = fixture("pins");
  const pool = Array.from({ length: 16 }, (_, i) =>
    f.card(`c${i + 1}`, i % 2 === 0, i === 2 || i === 7 ? ["a"] : i === 4 || i === 11 ? ["b"] : []),
  );
  return { pool, history: f.history({ c1: missed(5), c2: { seen: 2, lastCorrect: true, lastSeenAt: 9 }, c6: missed(3) }) };
}

// deal-pins-polish, "with more missed cards than the cap": c1 to c8 missed, oldest first; c16 answered right.
export function overCapPool(): { pool: Card[]; history: History } {
  const f = fixture("pins-over-cap");
  const pool = Array.from({ length: 16 }, (_, i) => f.card(`c${i + 1}`, i < 3 || (i >= 8 && i < 15), i === 4 || i === 9 ? ["b"] : []));
  return { pool, history: { ...missedFrom(pool.slice(0, 8), 1), ...f.history({ c16: right(9) }) } };
}

// deal-pins-polish: 21 cards with answers True, False, True, ...; k1 and k12 share group pair.
export function overdueRoute(): Card[] {
  const f = fixture("pins-overdue");
  return Array.from({ length: 21 }, (_, i) => f.card(`k${i + 1}`, i % 2 === 0, i === 0 || i === 11 ? ["pair"] : []));
}

// overdue-boundary: 25 cards; each of k1 to k5 shares a group with the card eleven places later.
export function boundaryRoute(): Card[] {
  const f = fixture("boundary");
  return Array.from({ length: 25 }, (_, i) => {
    const pair = i < 5 ? i : i - (CHUNK + 1);
    return f.card(`k${i + 1}`, i % 2 === 0, pair >= 0 && pair < 5 ? [`pair${pair + 1}`] : []);
  });
}

// overdue-polish: alternating answers, and each of the first size - 20 cards shares a group with the card eleven places later.
export function overdueRouteOf(size: number): Card[] {
  const f = fixture(`overdue-${size}`);
  const pairs = size - 2 * CHUNK;
  return Array.from({ length: size }, (_, i) => {
    const pair = i < pairs ? i : i - (CHUNK + 1);
    return f.card(`k${i + 1}`, i % 2 === 0, pair >= 0 && pair < pairs ? [`pair${pair + 1}`] : []);
  });
}

// search-polish: h1 to h6 (True) first, f1 to f6 (False) each sharing a group with one of them, t1 to t20 (True) last.
export function cutPool(): Card[] {
  const f = fixture("cut-h");
  return [
    ...Array.from({ length: 6 }, (_, i) => f.card(`h${i + 1}`, true, [`g${i + 1}`])),
    ...Array.from({ length: 6 }, (_, i) => f.card(`f${i + 1}`, false, [`g${i + 1}`])),
    ...Array.from({ length: 20 }, (_, i) => f.card(`t${i + 1}`, true)),
  ];
}

// search-polish: sixty True cards, then seven False cards in a ring (each shares a group with the next).
export function ringPool(): Card[] {
  const f = fixture("ring");
  return [
    ...Array.from({ length: 60 }, (_, i) => f.card(`t${i + 1}`, true)),
    ...Array.from({ length: 7 }, (_, i) => f.card(`f${i + 1}`, false, [`r${i}`, `r${(i + 1) % 7}`])),
  ];
}

// Every shipped deck, in catalog order, with its cards in the order of native-data/decks/<id>.json.
export function shippedDecks(): DeckFile[] {
  const content = new URL("../../../content/", import.meta.url);
  const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, content), "utf8"));
  const reviewed = Object.fromEntries(
    readdirSync(new URL("reviewed/", content))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => [name.slice(0, -".json".length), read(`reviewed/${name}`)]),
  );
  return buildDecks({ catalog: read("catalog.json"), reviewed, version: "2026-10-01" }).decks;
}

// shipped-dealing-polish: the routes where the conflict groups give way, and its history with every card seen and
// about half of them missed.
export const GROUPS_GIVE_WAY = [
  "azure-az-900/STO",
  "csharp-fundamentals/RES",
  "docker-fundamentals/REG",
  "docker-fundamentals/SEC",
  "linux-command-line/SYS",
  "tailwind-css/THM",
  "tailwind-css/UTL",
  "terraform-associate/MOD",
  "typescript-fundamentals/ENM",
] as const;

export function halfMissed(pool: readonly Card[], seed: number): History {
  const rng = createRng(seed);
  const history: Record<string, CardHistory> = {};
  for (const c of pool) history[c.id] = { seen: 1, lastCorrect: rng() < 0.5, lastSeenAt: Math.floor(rng() * 1e6) };
  return history;
}
