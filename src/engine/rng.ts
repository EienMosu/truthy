// Seeded randomness for the engine. The engine never calls Math.random: a round gets one
// generator from its seed, so the same seed and the same events always give the same round.

export type Rng = () => number; // uniform in [0, 1)

// mulberry32: a small, fast 32-bit generator. The seed is taken as an unsigned 32-bit integer.
// The Swift and Kotlin clones implement the same arithmetic, so a seed deals the same round everywhere.
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates from the end. Returns a new array; the input is never changed.
// Draws exactly items.length - 1 numbers (none for zero or one item).
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const held = result[i] as T;
    result[i] = result[j] as T;
    result[j] = held;
  }
  return result;
}
