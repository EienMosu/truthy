// Golden vectors of src/engine/rng.ts: the mulberry32 stream for a seed and the Fisher-Yates shuffle. The pinned
// cases of tests/engine/rng.test.ts come first, then seeds that exercise the 32-bit wrap and the seed coercion.

import { createRng, shuffle } from "@/src/engine/rng";
import { metaOf } from "../registry";
import { goldenFile, rngOf, rngSeed, rngValues, type GoldenCase, type GoldenFile } from "./format";

const MODULE = "src/engine/rng";
const EIGHT = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** The first `count` draws of createRng(seed). A native test draws output.length values. */
function draws(seed: number, count: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng());
}

function createRngCases(): GoldenCase[] {
  const seeds: readonly [string, number, number][] = [
    ["seed 1: the reference values (rng.test.ts)", 1, 10],
    ["seed 42: the reference values (rng.test.ts)", 42, 10],
    ["seed 0 (rng.test.ts)", 0, 10],
    ["seed -1 is 2^32 - 1 (rng.test.ts)", -1, 10],
    ["seed 2^32 - 1", 4294967295, 10],
    ["seed 1.9 is 1 (rng.test.ts)", 1.9, 10],
    ["seed 2^32 + 1 is 1 (rng.test.ts)", 4294967297, 10],
    ["seed 2^31", 2147483648, 10],
    ["seed 0x6d2b79f5, the stream's own increment", 0x6d2b79f5, 10],
    ["seed 7 (rng.test.ts: the same sequence for the same seed)", 7, 50],
    ["seed 3 (rng.test.ts: two generators stay independent)", 3, 10],
    ["seed 123, a long stream (rng.test.ts: stays in [0, 1))", 123, 200],
  ];
  return seeds.map(([name, seed, count]) => ({ name, input: { seed }, output: draws(seed, count) }));
}

function shuffleCase(name: string, items: readonly string[], rng: ReturnType<typeof rngSeed> | ReturnType<typeof rngValues>): GoldenCase {
  return { name, input: { items, rng }, output: shuffle(items, rngOf(rng)) };
}

function shuffleCases(): GoldenCase[] {
  return [
    shuffleCase("a to h, seed 1: the reference order (rng.test.ts)", EIGHT, rngSeed(1)),
    shuffleCase("a to h, seed 5 (rng.test.ts: a permutation)", EIGHT, rngSeed(5)),
    shuffleCase("a to h, seed 11 (rng.test.ts: deterministic for a seed)", EIGHT, rngSeed(11)),
    shuffleCase("an empty list draws nothing (rng.test.ts)", [], rngValues([])),
    shuffleCase("a single item draws nothing (rng.test.ts)", ["only"], rngValues([])),
    shuffleCase("a to h draws exactly 7 values (rng.test.ts: length - 1 draws)", EIGHT, rngValues([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])),
    shuffleCase("w to z with the lowest, the highest and a middle draw", ["w", "x", "y", "z"], rngValues([0, 0.9999999999, 0.5])),
    shuffleCase("w to z, seed 0 (rng.test.ts: every item in every position)", ["w", "x", "y", "z"], rngSeed(0)),
    shuffleCase("w to z, seed 1999", ["w", "x", "y", "z"], rngSeed(1999)),
    shuffleCase(
      "twenty items, seed 4294967295",
      Array.from({ length: 20 }, (_, i) => `item-${i}`),
      rngSeed(4294967295),
    ),
  ];
}

export function golden(): GoldenFile[] {
  return [goldenFile(metaOf(MODULE, "createRng"), createRngCases()), goldenFile(metaOf(MODULE, "shuffle"), shuffleCases())];
}
