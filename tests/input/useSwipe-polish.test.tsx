// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSwipe } from "@/components/play/useSwipe";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// The injected clock the hook reads; each helper sets it before it fires its event.
let time = 0;
const now = () => time;
const SHOWN_AT = 0;

function Card({ onSwipe }: { onSwipe: (value: boolean) => void }) {
  const swipe = useSwipe<HTMLDivElement>({ enabled: true, cardShownAt: () => SHOWN_AT, now, onSwipe });
  return (
    <div
      data-testid="card"
      ref={swipe.ref}
      onPointerDown={swipe.onPointerDown}
      onPointerMove={swipe.onPointerMove}
      onPointerUp={swipe.onPointerUp}
      onPointerCancel={swipe.onPointerCancel}
    />
  );
}

const touch = { pointerId: 1, isPrimary: true, pointerType: "touch", button: 0 };

function setup() {
  const onSwipe = vi.fn();
  const card = render(<Card onSwipe={onSwipe} />).getByTestId("card");
  return { onSwipe, card };
}

beforeEach(() => {
  time = 0;
});

// Review finding U21: a pointer event is timed by its own time stamp (the performance.now() timeline), not by
// when the handler ran. jsdom stamps events with epoch ms, so these tests set the stamp themselves.
describe("useSwipe: samples are timed by when the input happened", () => {
  type Phase = "pointerDown" | "pointerMove" | "pointerUp";

  // Fires one event that the browser received at `stamp`, while the page's clocks read `handledAt`.
  function fire(card: HTMLElement, phase: Phase, x: number, stamp: number, handledAt: number) {
    time = handledAt;
    vi.spyOn(performance, "now").mockReturnValue(handledAt);
    const event = createEvent[phase](card, { ...touch, clientX: x, clientY: 400 });
    Object.defineProperty(event, "timeStamp", { value: stamp });
    fireEvent(card, event);
  }

  it("does not answer a slow nudge whose events were all handled together after a main-thread stall", () => {
    const { onSwipe, card } = setup();
    // 50 px over 250 ms is 0.2 px/ms. The page was blocked, so it handled the three events 2 ms apart.
    fire(card, "pointerDown", 200, 1010, 1400);
    fire(card, "pointerMove", 240, 1190, 1402);
    fire(card, "pointerUp", 250, 1260, 1404);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("still answers a real fling whose events were handled late", () => {
    const { onSwipe, card } = setup();
    // 50 px in 50 ms is 1 px/ms, wherever the handlers ran.
    fire(card, "pointerDown", 200, 1010, 1400);
    fire(card, "pointerMove", 230, 1040, 1402);
    fire(card, "pointerUp", 250, 1060, 1404);
    expect(onSwipe.mock.calls).toEqual([[true]]);
  });

  it("judges the settle time by when the finger touched, not by when the handler ran", () => {
    const { onSwipe, card } = setup();
    // Down 100 ms after the card appeared, handled 1.3 s later. A 120 px drag from there must not answer.
    fire(card, "pointerDown", 200, SHOWN_AT + 100, 1400);
    fire(card, "pointerMove", 320, SHOWN_AT + 500, 1402);
    fire(card, "pointerUp", 320, SHOWN_AT + 600, 1404);
    expect(onSwipe).not.toHaveBeenCalled();
  });
});

// Review finding U123: a pointer down that canStart rejects must not grab the card at all. interpret() would
// cancel the answer anyway, so only the visual drag and the pointer capture are at stake.
describe("useSwipe: a rejected pointer down does not grab the card", () => {
  function grabbed(card: HTMLElement, start: { x: number; t: number }) {
    const capture = vi.fn();
    Object.defineProperty(card, "setPointerCapture", { value: capture, configurable: true });
    time = start.t;
    fireEvent.pointerDown(card, { ...touch, clientX: start.x, clientY: 400 });
    const down = { dragging: card.dataset.dragging, captured: capture.mock.calls.length };
    time = start.t + 100;
    fireEvent.pointerMove(card, { ...touch, clientX: start.x + 60, clientY: 400 });
    return { ...down, dragX: card.style.getPropertyValue("--drag-x") };
  }

  it.each([
    ["left", 10],
    ["right", 1024 - 10],
  ])("ignores a touch in the %s edge zone", (_side, x) => {
    const { card } = setup();
    const result = grabbed(card, { x, t: 2000 });
    expect(result.dragging).toBeUndefined();
    expect(result.captured).toBe(0);
    expect(["", "0"]).toContain(result.dragX);
  });

  it("ignores a touch inside the settle time", () => {
    const { card } = setup();
    const result = grabbed(card, { x: 300, t: SHOWN_AT + 100 });
    expect(result.dragging).toBeUndefined();
    expect(result.captured).toBe(0);
    expect(["", "0"]).toContain(result.dragX);
  });

  it("grabs a touch in the middle of the screen once the card has settled", () => {
    const { card } = setup();
    const result = grabbed(card, { x: 300, t: 2000 });
    expect(result.dragging).toBe("");
    expect(result.captured).toBe(1);
    expect(result.dragX).toBe("60");
  });
});

// Review finding U124: only the primary mouse button swipes; a right or middle button drag is a context menu
// or an auto-scroll, not an answer.
describe("useSwipe: mouse buttons", () => {
  const mouse = { pointerId: 1, isPrimary: true, pointerType: "mouse" };

  function mouseDrag(card: HTMLElement, button: number) {
    time = 2000;
    fireEvent.pointerDown(card, { ...mouse, button, clientX: 200, clientY: 400 });
    const dragging = card.dataset.dragging;
    time = 2300;
    fireEvent.pointerMove(card, { ...mouse, button, clientX: 270, clientY: 400 });
    time = 2600;
    fireEvent.pointerUp(card, { ...mouse, button, clientX: 340, clientY: 400 });
    return dragging;
  }

  it("answers True for a 140 px drag with the primary button", () => {
    const { onSwipe, card } = setup();
    expect(mouseDrag(card, 0)).toBe("");
    expect(onSwipe.mock.calls).toEqual([[true]]);
  });

  it.each([
    ["middle", 1],
    ["right", 2],
  ])("does not answer a drag with the %s button", (_name, button) => {
    const { onSwipe, card } = setup();
    expect(mouseDrag(card, button)).toBeUndefined();
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
