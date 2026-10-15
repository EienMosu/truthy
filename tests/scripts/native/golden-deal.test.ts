import { describe, expect, it } from "vitest";
import { golden } from "@/scripts/native/golden/deal";
import { DEAL_TESTS, GROUPS_GIVE_WAY, shippedDecks } from "@/scripts/native/golden/deal-fixtures";
import type { History } from "@/src/content/play";
import type { Card } from "@/src/content/schema";
import { deal, dealChunk, type DealOptions } from "@/src/engine/deal";
import type { Rng } from "@/src/engine/rng";
import { decode, encoded, ids, parseGolden, type GoldenJson } from "./golden-replay";

const files = golden();
const parsed = files.map((file) => parseGolden(file.content));
const decks = new Map(shippedDecks().map((deck) => [deck.id, deck.cards] as const));

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

// The ids a sequence of chunk cases dealt, in order, without the scenario's prefix.
function dealtBy(name: string, chunks: number, prefix: string): string[] {
  return Array.from({ length: chunks }, (_, k) => ids(caseOf("dealChunk", `${name}, chunk ${k}`).output)).flat().map((id) => id.slice(prefix.length));
}

describe("golden: deal and dealChunk", () => {
  it("writes deal, dealChunk and the three exported constants under their golden paths", () => {
    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "native-data/golden/src.engine.deal.deal.json",
        "native-data/golden/src.engine.deal.dealChunk.json",
        "native-data/golden/src.engine.deal.DEAL.constant.json",
        "native-data/golden/src.engine.deal.CHUNK.json",
        "native-data/golden/src.engine.deal.SEARCH_BUDGET.json",
      ]),
    );
    for (const file of parsed) {
      expect(file.format).toBe(1);
      expect(file.module).toBe("src/engine/deal");
      expect(file.source).toBe("src/engine/deal.ts");
    }
    expect(fileOf("deal").tests).toEqual([...DEAL_TESTS]);
    expect(fileOf("dealChunk").tests).toEqual([...DEAL_TESTS]);
  });

  it("writes each constant as one case with a null input", () => {
    expect(fileOf("DEAL").cases).toEqual([{ name: "the value", input: null, output: { missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3 } }]);
    expect(fileOf("CHUNK").cases).toEqual([{ name: "the value", input: null, output: 10 }]);
    expect(fileOf("SEARCH_BUDGET").cases).toEqual([{ name: "the value", input: null, output: 20_000 }]);
  });

  it("holds the reference vectors of deal-pins-polish exactly", () => {
    const pins: [number, string[]][] = [
      [1, ["c3", "c10", "c16", "c9", "c5", "c6", "c7", "c14", "c15", "c1"]],
      [2, ["c11", "c13", "c8", "c10", "c14", "c9", "c16", "c15", "c1", "c6"]],
      [3, ["c9", "c6", "c1", "c16", "c4", "c13", "c14", "c11", "c5", "c8"]],
    ];
    for (const [seed, expected] of pins) {
      expect(ids(caseOf("deal", `deal-pins-polish: reference vectors, seed ${seed}`).output)).toEqual(expected.map((id) => `pins:${id}`));
    }
    const overCap: [number, string[]][] = [
      [1, ["c10", "c7", "c6", "c12", "c15", "c16", "c13", "c4", "c9", "c14"]],
      [2, ["c13", "c11", "c4", "c14", "c6", "c16", "c10", "c15", "c9", "c7"]],
      [3, ["c9", "c16", "c10", "c4", "c7", "c14", "c13", "c6", "c11", "c15"]],
    ];
    for (const [seed, expected] of overCap) {
      const output = caseOf("deal", `deal-pins-polish: more missed cards than the cap, seed ${seed}`).output;
      expect(ids(output)).toEqual(expected.map((id) => `pins-over-cap:${id}`));
    }
  });

  it("holds the chunk sequences of deal-pins-polish and overdue-boundary exactly", () => {
    expect(dealtBy("deal-pins-polish: three chunks with the seeds 100 to 102", 3, "pins:")).toEqual([
      "c11", "c6", "c14", "c9", "c13", "c10", "c3", "c16", "c1", "c15",
      "c7", "c4", "c12", "c8", "c5", "c2",
      "c6", "c14", "c11", "c10", "c9", "c13",
    ]);
    expect(dealtBy("deal-pins-polish: six chunks with the seeds 210 to 215", 6, "pins-overdue:")).toEqual([
      "k7", "k3", "k15", "k8", "k12", "k19", "k4", "k14", "k17", "k11",
      "k9", "k10", "k16", "k6", "k21", "k5", "k18", "k2", "k20", "k13",
      "k7", "k11", "k12", "k19", "k3", "k17", "k14", "k4", "k15", "k8",
      "k6", "k13", "k9", "k20", "k5", "k2", "k16", "k21", "k10", "k18",
      "k15", "k7", "k14", "k17", "k4", "k3", "k19", "k8", "k11", "k12",
      "k20", "k1", "k9", "k21", "k2", "k5", "k13", "k10", "k16", "k6",
    ]);
    expect(dealtBy("overdue-boundary: six chunks with the seeds 150 to 155", 6, "boundary:")).toEqual([
      "k15", "k23", "k2", "k6", "k10", "k11", "k22", "k5", "k24", "k14",
      "k12", "k7", "k25", "k21", "k18", "k17", "k20", "k8", "k9", "k19",
      "k3", "k10", "k16", "k6", "k13", "k4", "k22", "k11", "k23", "k24",
      "k12", "k21", "k17", "k19", "k18", "k8", "k25", "k20", "k9", "k7",
      "k10", "k5", "k15", "k23", "k24", "k6", "k22", "k11", "k14", "k2",
      "k25", "k1", "k20", "k9", "k19", "k8", "k21", "k17", "k16", "k18",
    ]);
  });

  it("covers the count, avoid, before and budget options of deal, and dealChunk's dealt and budget", () => {
    const options = fileOf("deal").cases.map((c) => (c.input as { options: Record<string, unknown> }).options);
    expect(options.map((o) => o.count)).toEqual(expect.arrayContaining([0, -3, 4.7, 4, 5, 10, 14, 20]));
    expect(options.some((o) => Array.isArray(o.avoid) && o.avoid.length > 0)).toBe(true);
    expect(options.some((o) => Array.isArray(o.before) && o.before.length === 0)).toBe(true);
    expect(options.some((o) => Array.isArray(o.before) && o.before.length === 10)).toBe(true);
    expect(options.map((o) => o.budget)).toEqual(expect.arrayContaining([1, 40, 200]));
    const chunkInputs = fileOf("dealChunk").cases.map((c) => c.input as { dealt: unknown[]; budget?: unknown });
    expect(chunkInputs.some((input) => input.dealt.length >= 50)).toBe(true);
    expect(chunkInputs.some((input) => input.budget !== undefined)).toBe(true);
  });

  it("writes the budget Infinity and the corrupt history numbers as tagged numbers", () => {
    const unbounded = caseOf("dealChunk", "shipped: aws-clf-c02/ALL, the first chunk without the bound, seed 0").input as Record<string, unknown>;
    expect(unbounded.budget).toEqual({ $number: "Infinity" });
    expect(unbounded.pool).toEqual({ $deck: "aws-clf-c02" });
    const history = (caseOf("deal", "deal.test: a history with corrupt numbers").input as { history: Record<string, Record<string, unknown>> }).history;
    expect(history["alt:c1"]).toEqual({ seen: 1, lastCorrect: false, lastSeenAt: { $number: "NaN" } });
    expect(history["alt:c3"]?.lastSeenAt).toEqual({ $number: "Infinity" });
    expect(history["alt:c4"]?.seen).toEqual({ $number: "NaN" });
    expect(history["alt:c5"]?.lastSeenAt).toEqual({ $number: "-Infinity" });
    expect(history["alt:c6"]?.lastSeenAt).toEqual({ $number: "-0" });
  });

  it("deals from every shipped deck, the routes where the groups give way, and the deal the bound once decided", () => {
    const names = fileOf("dealChunk").cases.map((c) => c.name);
    for (const deckId of decks.keys()) {
      expect(names).toContain(`shipped: ${deckId}/ALL, the first chunk, seed 0`);
      expect(names).toContain(`shipped: ${deckId}/ALL, the first chunk without the bound, seed 0`);
    }
    expect(decks.size).toBe(54);
    const dealNames = fileOf("deal").cases.map((c) => c.name);
    for (const route of GROUPS_GIVE_WAY) {
      expect(dealNames).toContain(`shipped: ${route}, a Classic deal, half missed, seed 0`);
      expect(names).toContain(`shipped: ${route}, a round that goes on, seed 0, chunk 0`);
    }
    const bounded = dealtBy("shipped: aws-clf-c02/SEC, seed 5670, with the bound", 6, "");
    expect(dealtBy("shipped: aws-clf-c02/SEC, seed 5670, without the bound", 6, "")).toEqual(bounded);
  });

  it("gives every output again when the input is decoded and the function runs on it", () => {
    const run: Record<string, (input: unknown) => unknown> = {
      deal: (input) => {
        const i = input as { pool: Card[]; history: History; rng: Rng; options: DealOptions };
        return deal(i.pool, i.history, i.rng, i.options);
      },
      dealChunk: (input) => {
        const i = input as { pool: Card[]; history: History; rng: Rng; dealt: Card[]; budget?: number };
        return i.budget === undefined ? dealChunk(i.pool, i.history, i.rng, i.dealt) : dealChunk(i.pool, i.history, i.rng, i.dealt, i.budget);
      },
    };
    for (const fn of ["deal", "dealChunk"]) {
      const file = fileOf(fn);
      for (const c of file.cases) {
        const runner = run[fn];
        if (runner === undefined) throw new Error(fn);
        expect(encoded(runner(decode(c.input, file.cards, decks))), `${fn}: ${c.name}`).toEqual(c.output);
      }
    }
  });

  it("names each case once and writes the same files twice", () => {
    for (const file of parsed) expect(new Set(file.cases.map((c) => c.name)).size, file.function).toBe(file.cases.length);
    expect(golden()).toEqual(files);
  });
});
