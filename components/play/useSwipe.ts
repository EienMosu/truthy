// Pointer events on the card, turned into answers by the pure rules in src/input/swipe (spec section 8).
// The card follows the finger through three CSS custom properties set directly on the element, so a drag
// does not re-render React on every move:
//   --drag-x  the horizontal travel in px, unitless (the card's translateX and rotation read it)
//   --intent  intent(dx), -1 (towards False) to 1 (towards True), for the intent stamps and the stub turn
//   --pull    |intent|, for the stub drop
// While a gesture runs the element carries data-dragging (transitions off, cursor grabbing).
import { useCallback, useEffect, useRef, type PointerEvent, type RefObject } from "react";
import { canStart, intent, interpret, type SwipeContext, type SwipeSample } from "@/src/input/swipe";

export interface UseSwipeOptions {
  /** False outside the question phase or while a dialog is open: pointers are ignored. */
  enabled: boolean;
  /** When the card on screen appeared, on the same clock as now(). Read at pointer down (settle time). */
  cardShownAt: () => number;
  /** The clock for the samples, in ms. */
  now: () => number;
  /** Called once per committed swipe: true for a swipe right, false for a swipe left. */
  onSwipe: (value: boolean) => void;
}

export interface SwipeBindings<T extends HTMLElement> {
  ref: RefObject<T | null>;
  onPointerDown: (event: PointerEvent<T>) => void;
  onPointerMove: (event: PointerEvent<T>) => void;
  onPointerUp: (event: PointerEvent<T>) => void;
  onPointerCancel: (event: PointerEvent<T>) => void;
}

interface Gesture {
  pointerId: number;
  samples: SwipeSample[];
  context: SwipeContext;
}

function paint(element: HTMLElement | null, dx: number): void {
  if (!element) return;
  const value = intent(dx);
  element.style.setProperty("--drag-x", String(dx));
  element.style.setProperty("--intent", String(value));
  element.style.setProperty("--pull", String(Math.abs(value)));
}

export function useSwipe<T extends HTMLElement>({ enabled, cardShownAt, now, onSwipe }: UseSwipeOptions): SwipeBindings<T> {
  const ref = useRef<T | null>(null);
  const gesture = useRef<Gesture | null>(null);

  const reset = useCallback(() => {
    gesture.current = null;
    const element = ref.current;
    if (!element) return;
    delete element.dataset.dragging;
    paint(element, 0);
  }, []);

  // A card that stops taking answers (answered by a button or a key mid-drag, a dialog opened) springs back.
  useEffect(() => {
    if (!enabled) reset();
  }, [enabled, reset]);

  const sample = useCallback((event: PointerEvent<T>): SwipeSample => ({ x: event.clientX, y: event.clientY, t: now() }), [now]);

  const onPointerDown = useCallback(
    (event: PointerEvent<T>) => {
      if (!enabled || gesture.current !== null || !event.isPrimary) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const first = sample(event);
      const context: SwipeContext = { viewportWidth: window.innerWidth, cardShownAt: cardShownAt() };
      if (!canStart(first, context)) return; // settle time or edge zone: this gesture is ignored
      gesture.current = { pointerId: event.pointerId, samples: [first], context };
      const element = event.currentTarget;
      element.dataset.dragging = "";
      // Keep receiving moves when the finger leaves the card. Not every environment has pointer capture.
      if (typeof element.setPointerCapture === "function") {
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // An already released pointer cannot be captured; the gesture still works while over the card.
        }
      }
    },
    [enabled, sample, cardShownAt],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<T>) => {
      const current = gesture.current;
      if (current === null || event.pointerId !== current.pointerId) return;
      const next = sample(event);
      current.samples.push(next);
      const first = current.samples[0];
      if (first) paint(ref.current, next.x - first.x);
    },
    [sample],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<T>) => {
      const current = gesture.current;
      if (current === null || event.pointerId !== current.pointerId) return;
      current.samples.push(sample(event));
      const outcome = interpret(current.samples, current.context);
      reset();
      if (enabled && outcome !== "cancel") onSwipe(outcome === "true");
    },
    [sample, reset, enabled, onSwipe],
  );

  const onPointerCancel = useCallback(
    (event: PointerEvent<T>) => {
      const current = gesture.current;
      if (current === null || event.pointerId !== current.pointerId) return;
      reset();
    },
    [reset],
  );

  return { ref, onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
