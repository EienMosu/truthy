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
