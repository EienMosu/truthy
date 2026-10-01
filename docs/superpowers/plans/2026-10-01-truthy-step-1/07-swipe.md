### Task 7: Swipe interpretation

Pure functions that turn the pointer samples of one gesture into `"true"`, `"false"` or `"cancel"`, plus the two helpers the play screen needs while dragging: `canStart` (may a gesture begin here?) and `intent` (how far towards an answer the drag preview leans). The rules are the input table in section 8 of the spec. This module imports nothing: no React, no DOM types, no `Date`, no `Math.random`. Callers pass plain numbers (client coordinates and millisecond timestamps).

The behaviour is built up in five test-first slices: constants and `intent`, then `canStart`, then `interpret` by distance and direction, then flings, then the guard against gestures that should never have started.

Every command below runs from the repository root, `~/Desktop/workspace/truthy`.

**Files:**
- Create: `src/input/swipe.ts`
- Test: `tests/input/swipe.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks. Uses the Vitest setup and the `@/*` alias from task 1.
- Produces (exactly as in the contract):

```ts
export const SWIPE = { commitPx: 90, flingPx: 40, flingVelocity: 0.5, settleMs: 250, edgePx: 24 } as const;   // flingVelocity in px per ms

export interface SwipeSample { x: number; y: number; t: number }             // client coordinates, ms timestamp
export interface SwipeContext { viewportWidth: number; cardShownAt: number }
export type SwipeOutcome = "true" | "false" | "cancel";

export function canStart(sample: SwipeSample, context: SwipeContext): boolean;
export function interpret(samples: readonly SwipeSample[], context: SwipeContext): SwipeOutcome;
export function intent(dx: number): number;                                   // clamp(dx / 110, -1, 1)
```

Exact semantics that task 11 (`components/play/useSwipe.ts`) relies on:
- `canStart(sample, context)` is true only when `sample.t - context.cardShownAt >= 250` and `24 <= sample.x <= context.viewportWidth - 24`. A touch timestamped before `cardShownAt` is false.
- `interpret(samples, context)`: `samples[0]` is the pointer down sample, the last one is the release. It returns `"cancel"` when there are fewer than two samples, when `canStart(samples[0], context)` is false, when the net horizontal displacement `dx` is 0, or when the net vertical displacement is larger in absolute value than `|dx|` (an exact diagonal still counts as horizontal). Otherwise `|dx| >= 90` commits to the side of `dx`. Below that, a fling commits when `|dx| >= 40` and the release velocity is at least 0.5 px/ms in the direction of `dx`. The release velocity is `(last.x - ref.x) / (last.t - ref.t)` where `ref` is the oldest sample (other than the last) whose timestamp is at most 80 ms before the release; with no such sample, or zero elapsed time, the velocity is 0. Right (positive `dx`) is `"true"`, left is `"false"`.
- The hook should pass every pointer move sample of the gesture (not only the first and last), because the velocity window needs the samples near the release.
- `intent(dx)` is in `[-1, 1]`, `0` at rest, `1` from 110 px to the right.

- [ ] **Step 1: Write the failing tests for the constants and the drag intent**

Create `tests/input/swipe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SWIPE, intent } from "@/src/input/swipe";

describe("swipe constants", () => {
  it("match the values in the spec's input table", () => {
    expect(SWIPE).toEqual({ commitPx: 90, flingPx: 40, flingVelocity: 0.5, settleMs: 250, edgePx: 24 });
  });
});

describe("intent (drag preview)", () => {
  it("is zero when the card has not moved", () => {
    expect(intent(0)).toBe(0);
  });

  it("is proportional to dx inside 110 px", () => {
    expect(intent(55)).toBe(0.5);
    expect(intent(-55)).toBe(-0.5);
  });

  it("reaches exactly 1 and -1 at 110 px", () => {
    expect(intent(110)).toBe(1);
    expect(intent(-110)).toBe(-1);
  });

  it("clamps beyond 110 px at both ends", () => {
    expect(intent(500)).toBe(1);
    expect(intent(-500)).toBe(-1);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run:

```bash
pnpm vitest run tests/input/swipe.test.ts
```

Expected: the suite fails to load because the module does not exist yet.

```
 FAIL  tests/input/swipe.test.ts [ tests/input/swipe.test.ts ]
Error: Cannot find package '@/src/input/swipe' imported from .../tests/input/swipe.test.ts

 Test Files  1 failed (1)
      Tests  no tests
```

- [ ] **Step 3: Create the module with the constants, the types and intent**

Create `src/input/swipe.ts`:

```ts
// Swipe interpretation: pure functions that turn pointer samples into "true", "false" or "cancel".
// The rules are the input table in section 8 of the spec. No DOM, no clock: callers pass numbers.

export const SWIPE = { commitPx: 90, flingPx: 40, flingVelocity: 0.5, settleMs: 250, edgePx: 24 } as const; // flingVelocity in px per ms

// How far (px) a drag must go for the preview to show full intent.
const INTENT_FULL_PX = 110;

export interface SwipeSample {
  x: number;
  y: number;
  t: number;
}

export interface SwipeContext {
  viewportWidth: number;
  cardShownAt: number;
}

export type SwipeOutcome = "true" | "false" | "cancel";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// -1 (fully towards False) to 1 (fully towards True), for the drag preview.
export function intent(dx: number): number {
  return clamp(dx / INTENT_FULL_PX, -1, 1);
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run:

```bash
pnpm vitest run tests/input/swipe.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

- [ ] **Step 5: Commit**

```bash
git add src/input/swipe.ts tests/input/swipe.test.ts
git commit -m "feat: add swipe constants and drag intent"
```

- [ ] **Step 6: Write the failing tests for canStart (settle time and edges)**

In `tests/input/swipe.test.ts`, replace the line

```ts
import { SWIPE, intent } from "@/src/input/swipe";
```

with

```ts
import { SWIPE, canStart, intent, type SwipeContext } from "@/src/input/swipe";

// A phone-sized viewport whose card appeared at t = 0.
const context: SwipeContext = { viewportWidth: 390, cardShownAt: 0 };
```

Then append to the end of the file:

```ts

describe("canStart: settle time", () => {
  const at = (t: number) => ({ x: 195, y: 400, t });

  it("ignores a touch 249 ms after the card appeared", () => {
    expect(canStart(at(249), context)).toBe(false);
  });

  it("accepts a touch exactly 250 ms after the card appeared", () => {
    expect(canStart(at(250), context)).toBe(true);
  });

  it("measures from cardShownAt, not from zero", () => {
    const later: SwipeContext = { viewportWidth: 390, cardShownAt: 10_000 };
    expect(canStart(at(10_100), later)).toBe(false);
    expect(canStart(at(10_250), later)).toBe(true);
  });
});

describe("canStart: edges", () => {
  const atX = (x: number) => ({ x, y: 400, t: 1000 });

  it("ignores a touch at x 23 (inside the left edge zone)", () => {
    expect(canStart(atX(23), context)).toBe(false);
  });

  it("accepts a touch at x 24", () => {
    expect(canStart(atX(24), context)).toBe(true);
  });

  it("ignores a touch at viewportWidth minus 23 (inside the right edge zone)", () => {
    expect(canStart(atX(390 - 23), context)).toBe(false);
  });

  it("accepts a touch at viewportWidth minus 24", () => {
    expect(canStart(atX(390 - 24), context)).toBe(true);
  });

  it("ignores a touch at x 0", () => {
    expect(canStart(atX(0), context)).toBe(false);
  });
});
```

- [ ] **Step 7: Run the tests and watch the new ones fail**

Run:

```bash
pnpm vitest run tests/input/swipe.test.ts
```

Expected: the 8 new tests fail with `TypeError: canStart is not a function`, the 5 earlier ones still pass.

```
      Tests  8 failed | 5 passed (13)
```

- [ ] **Step 8: Implement canStart**

Append to the end of `src/input/swipe.ts`:

```ts

// A gesture may start only after the settle time and outside the edge zones.
// "Within 24 px of the edge" means x < 24 or x > viewportWidth - 24.
export function canStart(sample: SwipeSample, context: SwipeContext): boolean {
  const settled = sample.t - context.cardShownAt >= SWIPE.settleMs;
  const awayFromEdges = sample.x >= SWIPE.edgePx && sample.x <= context.viewportWidth - SWIPE.edgePx;
  return settled && awayFromEdges;
}
```

- [ ] **Step 9: Run the tests and watch them pass**

Run:

```bash
pnpm vitest run tests/input/swipe.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

- [ ] **Step 10: Commit**

```bash
git add src/input/swipe.ts tests/input/swipe.test.ts
git commit -m "feat: add swipe start rules for settle time and edges"
```

- [ ] **Step 11: Write the failing tests for interpret by distance and direction**

In `tests/input/swipe.test.ts`, replace these lines

```ts
import { SWIPE, canStart, intent, type SwipeContext } from "@/src/input/swipe";

// A phone-sized viewport whose card appeared at t = 0.
const context: SwipeContext = { viewportWidth: 390, cardShownAt: 0 };
```

with

```ts
import { SWIPE, canStart, intent, interpret, type SwipeContext, type SwipeSample } from "@/src/input/swipe";

// A phone-sized viewport whose card appeared at t = 0.
const context: SwipeContext = { viewportWidth: 390, cardShownAt: 0 };

// Gestures start in the middle of the screen, 1000 ms after the card appeared.
const START = { x: 195, y: 400, t: 1000 };

// Builds samples from offsets relative to START, each one [dx, dy, dt].
function gesture(...offsets: [number, number, number][]): SwipeSample[] {
  return offsets.map(([dx, dy, dt]) => ({ x: START.x + dx, y: START.y + dy, t: START.t + dt }));
}
```

Then append to the end of the file:

```ts

describe("interpret: too little input", () => {
  it("cancels with no samples", () => {
    expect(interpret([], context)).toBe("cancel");
  });

  it("cancels with a single sample", () => {
    expect(interpret(gesture([0, 0, 0]), context)).toBe("cancel");
  });

  it("cancels when the card did not move", () => {
    expect(interpret(gesture([0, 0, 0], [0, 0, 500]), context)).toBe("cancel");
  });
});

describe("interpret: commit (released at least 90 px from its start)", () => {
  // Slow drags: 300 ms per step, far below fling speed, so only distance decides.
  it("commits at exactly 90 px", () => {
    expect(interpret(gesture([0, 0, 0], [45, 0, 300], [90, 0, 600]), context)).toBe("true");
  });

  it("cancels at 89 px", () => {
    expect(interpret(gesture([0, 0, 0], [45, 0, 300], [89, 0, 600]), context)).toBe("cancel");
  });

  it("commits at exactly 90 px to the left", () => {
    expect(interpret(gesture([0, 0, 0], [-45, 0, 300], [-90, 0, 600]), context)).toBe("false");
  });

  it("cancels when dragged past 90 px and back inside before release", () => {
    expect(interpret(gesture([0, 0, 0], [150, 0, 300], [60, 0, 900]), context)).toBe("cancel");
  });

  it("cancels when dragged past 90 px and released exactly at the start", () => {
    expect(interpret(gesture([0, 0, 0], [150, 0, 300], [0, 0, 900]), context)).toBe("cancel");
  });
});

describe("interpret: direction (right is True, left is False)", () => {
  it("a release 120 px to the right is true", () => {
    expect(interpret(gesture([0, 0, 0], [120, 5, 600]), context)).toBe("true");
  });

  it("a release 120 px to the left is false", () => {
    expect(interpret(gesture([0, 0, 0], [-120, 5, 600]), context)).toBe("false");
  });

  it("the side at release wins, not the side first visited", () => {
    expect(interpret(gesture([0, 0, 0], [120, 0, 300], [-100, 0, 900]), context)).toBe("false");
  });
});

describe("interpret: a gesture more vertical than horizontal is not a swipe", () => {
  it("cancels a mostly vertical gesture even when it ends 100 px to the side", () => {
    expect(interpret(gesture([0, 0, 0], [50, 150, 300], [100, 300, 600]), context)).toBe("cancel");
  });

  it("cancels a mostly vertical gesture upwards", () => {
    expect(interpret(gesture([0, 0, 0], [-100, -101, 600]), context)).toBe("cancel");
  });

  it("commits an exactly diagonal gesture (vertical travel does not exceed horizontal)", () => {
    expect(interpret(gesture([0, 0, 0], [100, 100, 600]), context)).toBe("true");
  });

  it("commits a horizontal swipe with some vertical drift", () => {
    expect(interpret(gesture([0, 0, 0], [60, 20, 300], [120, 40, 600]), context)).toBe("true");
  });
});
```

- [ ] **Step 12: Run the tests and watch the new ones fail**

Run:

```bash
pnpm vitest run tests/input/swipe.test.ts
```

Expected: the 15 new tests fail with `TypeError: interpret is not a function`.

```
      Tests  15 failed | 13 passed (28)
```

- [ ] **Step 13: Implement interpret by distance and direction**

Append to the end of `src/input/swipe.ts`:

```ts

function sideOf(dx: number): SwipeOutcome {
  return dx > 0 ? "true" : "false";
}

// Turns the samples of one gesture (first = pointer down, last = release) into an answer or "cancel".
export function interpret(samples: readonly SwipeSample[], context: SwipeContext): SwipeOutcome {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (samples.length < 2 || first === undefined || last === undefined) return "cancel";

  const dx = last.x - first.x;
  const dy = last.y - first.y;
  if (dx === 0) return "cancel";
  if (Math.abs(dy) > Math.abs(dx)) return "cancel";

  if (Math.abs(dx) >= SWIPE.commitPx) return sideOf(dx);
  return "cancel";
}
```

`context` is not read yet; step 23 uses it.

- [ ] **Step 14: Run the tests and watch them pass**

Run:

```bash
pnpm vitest run tests/input/swipe.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  28 passed (28)
```

- [ ] **Step 15: Commit**

```bash
git add src/input/swipe.ts tests/input/swipe.test.ts
git commit -m "feat: interpret swipes by release distance and direction"
```

- [ ] **Step 16: Write the failing tests for flings, identical timestamps and zig-zags**

Append to the end of `tests/input/swipe.test.ts`:

```ts

describe("interpret: fling (a fast release commits only after at least 40 px)", () => {
  it("commits a fast fling that travelled 40 px", () => {
    // 40 px in 40 ms: 1 px/ms, twice the fling velocity.
    expect(interpret(gesture([0, 0, 0], [20, 0, 20], [40, 0, 40]), context)).toBe("true");
  });

  it("cancels a fast fling that travelled 39 px", () => {
    expect(interpret(gesture([0, 0, 0], [20, 0, 20], [39, 0, 40]), context)).toBe("cancel");
  });

  it("commits a fast fling of 40 px to the left as false", () => {
    expect(interpret(gesture([0, 0, 0], [-20, 0, 20], [-40, 0, 40]), context)).toBe("false");
  });

  it("cancels a slow release at 60 px (pointer moves sampled every 16 ms)", () => {
    // 2 px every 16 ms is 0.125 px/ms, a quarter of the fling velocity.
    const slow = Array.from({ length: 31 }, (_, i): [number, number, number] => [2 * i, 0, 16 * i]);
    expect(slow.at(-1)).toEqual([60, 0, 480]);
    expect(interpret(gesture(...slow), context)).toBe("cancel");
  });

  it("cancels a slow release at 60 px with sparse samples", () => {
    expect(interpret(gesture([0, 0, 0], [30, 0, 200], [60, 0, 400]), context)).toBe("cancel");
  });

  it("uses only the last 80 ms: a fast start followed by a slow finish cancels", () => {
    // 0 to 50 px in 50 ms, then 50 to 60 px over the last 100 ms (0.1 px/ms).
    expect(interpret(gesture([0, 0, 0], [50, 0, 50], [55, 0, 100], [60, 0, 150]), context)).toBe("cancel");
  });

  it("cancels a fast flick back towards the start", () => {
    // Out to 80 px slowly, then flicked back to 50 px at 0.75 px/ms against dx.
    expect(interpret(gesture([0, 0, 0], [80, 0, 400], [65, 0, 420], [50, 0, 440]), context)).toBe("cancel");
  });
});

describe("interpret: identical timestamps", () => {
  it("cancels two samples with the same timestamp below the fling distance, without dividing by zero", () => {
    expect(interpret(gesture([0, 0, 0], [50, 0, 0]), context)).toBe("cancel");
  });

  it("commits two samples with the same timestamp at 100 px by distance", () => {
    expect(interpret(gesture([0, 0, 0], [100, 0, 0]), context)).toBe("true");
  });

  it("cancels when every sample in the last 80 ms shares the release timestamp", () => {
    expect(interpret(gesture([0, 0, 0], [50, 0, 200], [60, 0, 200]), context)).toBe("cancel");
  });
});

describe("interpret: zig-zag gestures", () => {
  it("commits a zig-zag that is released 95 px to the right", () => {
    expect(
      interpret(gesture([0, 0, 0], [40, 0, 20], [-40, 0, 40], [40, 0, 60], [-40, 0, 80], [95, 0, 100]), context),
    ).toBe("true");
  });

  it("cancels a fast zig-zag released near the start", () => {
    expect(
      interpret(gesture([0, 0, 0], [60, 0, 20], [-60, 0, 40], [60, 0, 60], [-60, 0, 80], [10, 0, 100]), context),
    ).toBe("cancel");
  });

  it("cancels a zig-zag released at 50 px while moving back towards the start", () => {
    expect(interpret(gesture([0, 0, 0], [100, 0, 100], [20, 0, 200], [90, 0, 300], [50, 0, 340]), context)).toBe(
      "cancel",
    );
  });

  it("commits a zig-zag released at 50 px while moving fast away from the start", () => {
    expect(interpret(gesture([0, 0, 0], [100, 0, 100], [-20, 0, 200], [10, 0, 300], [50, 0, 340]), context)).toBe(
      "true",
    );
  });
});
```

- [ ] **Step 17: Run the tests and watch the fling commits fail**

Run:

```bash
pnpm vitest run tests/input/swipe.test.ts
```

Expected: only the three tests where a fling must commit fail (`Expected: "true"` or `"false"`, `Received: "cancel"`); every test that expects `"cancel"` already passes because the current code cancels everything under 90 px.

```
     × commits a fast fling that travelled 40 px
     × commits a fast fling of 40 px to the left as false
     × commits a zig-zag released at 50 px while moving fast away from the start
      Tests  3 failed | 39 passed (42)
```

- [ ] **Step 18: Implement the fling rule**

Replace the whole of `src/input/swipe.ts` with:

```ts
// Swipe interpretation: pure functions that turn pointer samples into "true", "false" or "cancel".
// The rules are the input table in section 8 of the spec. No DOM, no clock: callers pass numbers.

export const SWIPE = { commitPx: 90, flingPx: 40, flingVelocity: 0.5, settleMs: 250, edgePx: 24 } as const; // flingVelocity in px per ms

// How far (px) a drag must go for the preview to show full intent.
const INTENT_FULL_PX = 110;

// The release velocity is measured over this many ms before the last sample.
const VELOCITY_WINDOW_MS = 80;

export interface SwipeSample {
  x: number;
  y: number;
  t: number;
}

export interface SwipeContext {
  viewportWidth: number;
  cardShownAt: number;
}

export type SwipeOutcome = "true" | "false" | "cancel";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// -1 (fully towards False) to 1 (fully towards True), for the drag preview.
export function intent(dx: number): number {
  return clamp(dx / INTENT_FULL_PX, -1, 1);
}

// A gesture may start only after the settle time and outside the edge zones.
// "Within 24 px of the edge" means x < 24 or x > viewportWidth - 24.
export function canStart(sample: SwipeSample, context: SwipeContext): boolean {
  const settled = sample.t - context.cardShownAt >= SWIPE.settleMs;
  const awayFromEdges = sample.x >= SWIPE.edgePx && sample.x <= context.viewportWidth - SWIPE.edgePx;
  return settled && awayFromEdges;
}

function sideOf(dx: number): SwipeOutcome {
  return dx > 0 ? "true" : "false";
}

// Horizontal velocity in px per ms between the oldest sample inside the window and the last one.
// No earlier sample inside the window, or no time between them, means the card was not moving fast: 0.
function releaseVelocity(samples: readonly SwipeSample[], last: SwipeSample): number {
  const reference = samples.slice(0, -1).find((sample) => last.t - sample.t <= VELOCITY_WINDOW_MS);
  if (reference === undefined) return 0;
  const dt = last.t - reference.t;
  if (dt <= 0) return 0;
  return (last.x - reference.x) / dt;
}

// Turns the samples of one gesture (first = pointer down, last = release) into an answer or "cancel".
export function interpret(samples: readonly SwipeSample[], context: SwipeContext): SwipeOutcome {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (samples.length < 2 || first === undefined || last === undefined) return "cancel";

  const dx = last.x - first.x;
  const dy = last.y - first.y;
  if (dx === 0) return "cancel";
  if (Math.abs(dy) > Math.abs(dx)) return "cancel";

  if (Math.abs(dx) >= SWIPE.commitPx) return sideOf(dx);

  const velocityTowardsSide = releaseVelocity(samples, last) * Math.sign(dx);
  if (Math.abs(dx) >= SWIPE.flingPx && velocityTowardsSide >= SWIPE.flingVelocity) return sideOf(dx);
  return "cancel";
}
```

- [ ] **Step 19: Run the tests and watch them pass**

Run:

```bash
pnpm vitest run tests/input/swipe.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  42 passed (42)
```

- [ ] **Step 20: Commit**

```bash
git add src/input/swipe.ts tests/input/swipe.test.ts
git commit -m "feat: commit fast flings after 40 px"
```

- [ ] **Step 21: Write the failing tests for gestures that should never have started, and the fling velocity boundary**

These cover the review focus candidates listed at the end of this task. Append to the end of `tests/input/swipe.test.ts`:

```ts

describe("interpret: gestures that should never have started", () => {
  it("cancels a 120 px swipe that started inside the settle time", () => {
    const justShown: SwipeContext = { viewportWidth: 390, cardShownAt: 900 };
    // Starts 100 ms after the card appeared and ends well past the commit distance.
    expect(interpret(gesture([0, 0, 0], [120, 0, 300]), justShown)).toBe("cancel");
  });

  it("cancels a 120 px swipe that started in the left edge zone", () => {
    const fromEdge = [
      { x: 10, y: 400, t: 1000 },
      { x: 130, y: 400, t: 1300 },
    ];
    expect(interpret(fromEdge, context)).toBe("cancel");
  });

  it("canStart ignores a touch that began before the card appeared", () => {
    const shown: SwipeContext = { viewportWidth: 390, cardShownAt: 5000 };
    expect(canStart({ x: 195, y: 400, t: 4990 }, shown)).toBe(false);
  });
});

describe("interpret: fling velocity boundary", () => {
  it("commits at exactly 0.5 px/ms measured over exactly 80 ms", () => {
    // Slow to 20 px, then 40 px more in the last 80 ms: 60 px total, 0.5 px/ms.
    expect(interpret(gesture([0, 0, 0], [20, 0, 400], [60, 0, 480]), context)).toBe("true");
  });

  it("cancels just below 0.5 px/ms", () => {
    expect(interpret(gesture([0, 0, 0], [20, 0, 400], [59, 0, 480]), context)).toBe("cancel");
  });
});
```

- [ ] **Step 22: Run the tests and watch the two guard tests fail**

Run:

```bash
pnpm vitest run tests/input/swipe.test.ts
```

Expected: the two `interpret` guard tests fail because `interpret` does not yet look at where and when the gesture started; the others already pass.

```
     × cancels a 120 px swipe that started inside the settle time
     × cancels a 120 px swipe that started in the left edge zone
Expected: "cancel"
Received: "true"
      Tests  2 failed | 45 passed (47)
```

- [ ] **Step 23: Make interpret reject gestures that could not have started**

In `src/input/swipe.ts`, inside `interpret`, replace

```ts
  if (samples.length < 2 || first === undefined || last === undefined) return "cancel";

  const dx = last.x - first.x;
```

with

```ts
  if (samples.length < 2 || first === undefined || last === undefined) return "cancel";
  if (!canStart(first, context)) return "cancel";

  const dx = last.x - first.x;
```

The final `interpret` is:

```ts
// Turns the samples of one gesture (first = pointer down, last = release) into an answer or "cancel".
export function interpret(samples: readonly SwipeSample[], context: SwipeContext): SwipeOutcome {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (samples.length < 2 || first === undefined || last === undefined) return "cancel";
  if (!canStart(first, context)) return "cancel";

  const dx = last.x - first.x;
  const dy = last.y - first.y;
  if (dx === 0) return "cancel";
  if (Math.abs(dy) > Math.abs(dx)) return "cancel";

  if (Math.abs(dx) >= SWIPE.commitPx) return sideOf(dx);

  const velocityTowardsSide = releaseVelocity(samples, last) * Math.sign(dx);
  if (Math.abs(dx) >= SWIPE.flingPx && velocityTowardsSide >= SWIPE.flingVelocity) return sideOf(dx);
  return "cancel";
}
```

- [ ] **Step 24: Run the tests and the type check**

Run:

```bash
pnpm vitest run tests/input/swipe.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  47 passed (47)
```

Then run:

```bash
pnpm typecheck
```

Expected: no errors in `src/input/swipe.ts` or `tests/input/swipe.test.ts`. (If earlier tasks are complete the whole command exits 0.)

- [ ] **Step 25: Commit**

```bash
git add src/input/swipe.ts tests/input/swipe.test.ts
git commit -m "feat: cancel swipes that started in the settle time or an edge zone"
```

#### Review focus candidates

1. A gesture that began inside the settle time or an edge zone still reaches `interpret` (the hook forgets to call `canStart`, or a finger that went down on the previous card is still dragging when the next card appears). The spec says such input is ignored, so `interpret` must cancel it whatever its distance. Covered by step 21 ("cancels a 120 px swipe that started inside the settle time", "cancels a 120 px swipe that started in the left edge zone"), implemented in step 23.
2. A touch timestamped before the card appeared (negative elapsed time, e.g. a held finger carried over from the previous card). Covered by step 21 ("canStart ignores a touch that began before the card appeared").
3. A fling at exactly the velocity threshold measured over exactly the 80 ms window: the boundary is inclusive on both, and just below cancels. Covered by step 21 ("fling velocity boundary").
