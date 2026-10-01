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
