// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSwipe } from "@/components/play/useSwipe";

afterEach(cleanup);

// The clock the hook reads. Each pointer event sets it first, so samples get exact times.
let time = 0;
const now = () => time;
const SHOWN_AT = 1000;

function Card({ enabled = true, onSwipe }: { enabled?: boolean; onSwipe: (value: boolean) => void }) {
  const swipe = useSwipe<HTMLDivElement>({ enabled, cardShownAt: () => SHOWN_AT, now, onSwipe });
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

type Point = [x: number, y: number, t: number];
const pointer = { pointerId: 1, isPrimary: true, pointerType: "touch", button: 0 };

function down(card: HTMLElement, [x, y, t]: Point) {
  time = t;
  fireEvent.pointerDown(card, { ...pointer, clientX: x, clientY: y });
}
function move(card: HTMLElement, [x, y, t]: Point) {
  time = t;
  fireEvent.pointerMove(card, { ...pointer, clientX: x, clientY: y });
}
function up(card: HTMLElement, [x, y, t]: Point) {
  time = t;
  fireEvent.pointerUp(card, { ...pointer, clientX: x, clientY: y });
}

// A gesture: pointer down at the first point, moves through the middle ones, release at the last.
function drag(card: HTMLElement, points: Point[]) {
  const [first, ...rest] = points;
  const last = rest.pop();
  if (!first || !last) throw new Error("a drag needs two points");
  down(card, first);
  for (const point of rest) move(card, point);
  up(card, last);
}

function setup(enabled = true) {
  const onSwipe = vi.fn();
  const view = render(<Card enabled={enabled} onSwipe={onSwipe} />);
  return { onSwipe, card: view.getByTestId("card"), rerender: (on: boolean) => view.rerender(<Card enabled={on} onSwipe={onSwipe} />) };
}

beforeEach(() => {
  time = 0;
});

describe("useSwipe", () => {
  it("answers True for a slow drag released 90 px or more to the right", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [200, 400, 2000],
      [250, 402, 2300],
      [300, 404, 2600],
    ]);
    expect(onSwipe.mock.calls).toEqual([[true]]);
  });

  it("answers False for a drag released 90 px or more to the left", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [300, 400, 2000],
      [240, 400, 2300],
      [205, 400, 2600],
    ]);
    expect(onSwipe.mock.calls).toEqual([[false]]);
  });

  it("does not answer a short slow drag (an accidental nudge)", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [200, 400, 2000],
      [220, 400, 2300],
      [230, 400, 2600],
    ]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("answers a fast fling of at least 40 px", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [200, 400, 2000],
      [230, 400, 2040],
      [250, 400, 2060],
    ]);
    expect(onSwipe.mock.calls).toEqual([[true]]);
  });

  it("does not answer a drag back inside 90 px before release", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [200, 400, 2000],
      [320, 400, 2300],
      [240, 400, 2700],
    ]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("ignores a gesture that is more vertical than horizontal", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [200, 400, 2000],
      [300, 550, 2400],
    ]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("ignores a gesture that starts within the 250 ms settle time", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [200, 400, SHOWN_AT + 100],
      [320, 400, SHOWN_AT + 500],
    ]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("ignores a gesture that starts within 24 px of the screen edge", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [10, 400, 2000],
      [200, 400, 2400],
    ]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("does nothing while it is disabled", () => {
    const { onSwipe, card } = setup(false);
    drag(card, [
      [200, 400, 2000],
      [320, 400, 2400],
    ]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("drops the gesture on pointercancel (the browser took over, for example to scroll)", () => {
    const { onSwipe, card } = setup();
    down(card, [200, 400, 2000]);
    move(card, [320, 400, 2300]);
    time = 2400;
    fireEvent.pointerCancel(card, pointer);
    up(card, [320, 400, 2500]);
    expect(onSwipe).not.toHaveBeenCalled();
    expect(card.dataset.dragging).toBeUndefined();
  });

  it("ignores a second finger", () => {
    const { onSwipe, card } = setup();
    time = 2000;
    fireEvent.pointerDown(card, { ...pointer, isPrimary: false, clientX: 200, clientY: 400 });
    time = 2400;
    fireEvent.pointerUp(card, { ...pointer, isPrimary: false, clientX: 320, clientY: 400 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("makes the card follow the finger and shows the intent while dragging", () => {
    const { card } = setup();
    down(card, [200, 400, 2000]);
    expect(card.dataset.dragging).toBe("");
    move(card, [255, 400, 2100]);
    expect(card.style.getPropertyValue("--drag-x")).toBe("55");
    expect(card.style.getPropertyValue("--intent")).toBe("0.5");
    expect(card.style.getPropertyValue("--pull")).toBe("0.5");
    move(card, [90, 400, 2200]);
    expect(card.style.getPropertyValue("--intent")).toBe("-1");
    expect(card.style.getPropertyValue("--pull")).toBe("1");
  });

  it("lets the card spring back after the release, answered or not", () => {
    const { card } = setup();
    drag(card, [
      [200, 400, 2000],
      [320, 400, 2300],
    ]);
    expect(card.dataset.dragging).toBeUndefined();
    expect(card.style.getPropertyValue("--drag-x")).toBe("0");
    expect(card.style.getPropertyValue("--intent")).toBe("0");
  });

  it("springs back when it is disabled in the middle of a drag (answered by a key or a button)", () => {
    const { onSwipe, card, rerender } = setup();
    down(card, [200, 400, 2000]);
    move(card, [320, 400, 2300]);
    rerender(false);
    expect(card.style.getPropertyValue("--drag-x")).toBe("0");
    up(card, [320, 400, 2400]);
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
