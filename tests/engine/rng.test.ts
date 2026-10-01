import { describe, expect, it } from "vitest";
import { createRng, shuffle } from "@/src/engine/rng";

function draw(seed: number, n: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng());
}

describe("createRng (mulberry32)", () => {
  it("produces the reference mulberry32 values, so the native clones can match them", () => {
    // Each value times 2^32 is the raw 32-bit output of mulberry32.
    expect(draw(1, 3).map((x) => x * 2 ** 32)).toEqual([2693262067, 11749833, 2265367787]);
    expect(draw(42, 3).map((x) => x * 2 ** 32)).toEqual([2581720956, 1925393290, 3661312704]);
  });

  it("gives the same sequence for the same seed", () => {
    expect(draw(7, 50)).toEqual(draw(7, 50));
  });

  it("gives different sequences for different seeds", () => {
    expect(draw(7, 5)).not.toEqual(draw(8, 5));
  });

  it("keeps two generators with the same seed independent of each other", () => {
    const a = createRng(3);
    const b = createRng(3);
    a();
    a();
    expect(b()).toBe(draw(3, 1)[0]);
  });

  it("stays in [0, 1) over many draws", () => {
    for (const x of draw(123, 10_000)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("is roughly uniform: each tenth of [0, 1) gets between 8% and 12% of 10,000 draws", () => {
    const buckets = new Array<number>(10).fill(0);
    for (const x of draw(99, 10_000)) {
      const i = Math.floor(x * 10);
      buckets[i] = (buckets[i] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });

  it("accepts seed 0, negative, fractional and very large seeds", () => {
    expect(draw(0, 3).map((x) => x * 2 ** 32)).toEqual([1144304738, 1416247, 958946056]);
    // Seeds are taken as unsigned 32-bit integers: -1 is 2^32 - 1, 1.9 is 1, 2^32 + 1 is 1.
    expect(draw(-1, 3)).toEqual(draw(2 ** 32 - 1, 3));
    expect(draw(1.9, 3)).toEqual(draw(1, 3));
    expect(draw(2 ** 32 + 1, 3)).toEqual(draw(1, 3));
  });
});

describe("shuffle (Fisher-Yates)", () => {
  const items = Object.freeze(["a", "b", "c", "d", "e", "f", "g", "h"]);

  it("returns a new array and leaves the input untouched", () => {
    const result = shuffle(items, createRng(1));
    expect(result).not.toBe(items);
    expect(items).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  it("returns a permutation: the same items, each exactly once", () => {
    const result = shuffle(items, createRng(5));
    expect(result).toHaveLength(items.length);
    expect([...result].sort()).toEqual([...items]);
  });

  it("gives the reference order for seed 1, so the native clones can match it", () => {
    expect(shuffle(items, createRng(1))).toEqual(["c", "b", "g", "h", "e", "d", "a", "f"]);
  });

  it("is deterministic for a seed", () => {
    expect(shuffle(items, createRng(11))).toEqual(shuffle(items, createRng(11)));
  });

  it("actually reorders: some seed out of ten changes the order", () => {
    const orders = new Set(Array.from({ length: 10 }, (_, seed) => shuffle(items, createRng(seed)).join("")));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("handles an empty list and a single item", () => {
    expect(shuffle([], createRng(1))).toEqual([]);
    expect(shuffle(["only"], createRng(1))).toEqual(["only"]);
  });

  it("can put every item in every position (2,000 seeds over 4 items)", () => {
    const seenAt = new Map<string, Set<number>>();
    for (let seed = 0; seed < 2000; seed++) {
      shuffle(["w", "x", "y", "z"], createRng(seed)).forEach((item, position) => {
        const positions = seenAt.get(item) ?? new Set<number>();
        positions.add(position);
        seenAt.set(item, positions);
      });
    }
    for (const item of ["w", "x", "y", "z"]) {
      expect(seenAt.get(item)?.size).toBe(4);
    }
  });

  it("uses exactly length - 1 draws, so callers can predict the generator state", () => {
    let calls = 0;
    const counting = () => {
      calls++;
      return 0.5;
    };
    shuffle(items, counting);
    expect(calls).toBe(items.length - 1);
  });
});
