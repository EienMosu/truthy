// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { FADE_PX, listCue, useListCue, type ItemSpan } from "@/components/start/listCue";

afterEach(cleanup);

/** `count` cards of `height` with `gap` between them, the first at `first`, minus how far the list has scrolled. */
function cards(count: number, height: number, gap: number, first: number, scrollTop = 0): ItemSpan[] {
  return Array.from({ length: count }, (_, i) => {
    const top = first + i * (height + gap) - scrollTop;
    return { top, bottom: top + height };
  });
}

function bottomOf(items: ItemSpan[]): number {
  return items.at(-1)?.bottom ?? 0;
}

describe("listCue", () => {
  it("shows no cue while the content ends inside the view, a pixel allowed for rounding", () => {
    const five = cards(5, 90, 12, 6);
    expect(listCue(518, bottomOf(five), five)).toEqual({ more: false, lift: 0 });
    expect(listCue(503, 504, five)).toEqual({ more: false, lift: 0 });
  });

  it("fades at the edge when the fold cuts a card that shows at least 28 px", () => {
    const nine = cards(9, 90, 12, 6);
    // The fold at 581 cuts the sixth card (516 to 606) 65 px down.
    expect(listCue(581, bottomOf(nine), nine)).toEqual({ more: true, lift: 0 });
    expect(listCue(516 + FADE_PX, bottomOf(nine), nine)).toEqual({ more: true, lift: 0 });
  });

  it("ends the fade at the bottom of the card above when the fold falls in the gap between two cards", () => {
    // The classes at 320 by 568: the view is 236 tall, Streak ends at 228 and Three lives starts at 240.
    const four = cards(4, 108, 12, 0);
    expect(listCue(236, bottomOf(four), four)).toEqual({ more: true, lift: 8 });
  });

  it("lifts the fade most of the way onto the card above when the fold shows only a sliver of the next card", () => {
    // RND at 390 by 844: the view is 518 tall, STA ends at 504 and the sixth card starts at 516 and shows 2 px.
    const nine = cards(9, 90, 12, 6);
    const cue = listCue(518, bottomOf(nine), nine);
    expect(cue.more).toBe(true);
    expect(cue.lift).toBeCloseTo(14 * (1 - 2 / FADE_PX), 6);
    // The fade (28 px ending `lift` above the edge) lies over STA, not over the gap and the sliver.
    const end = 518 - cue.lift;
    expect(end).toBeLessThanOrEqual(504 + 2);
    expect(end - FADE_PX).toBeGreaterThanOrEqual((nine[4]?.top ?? 0));
  });

  it("follows the scroll: the cue is gone once the last card is in view", () => {
    const at = (scrollTop: number) => {
      const nine = cards(9, 90, 12, 6, scrollTop);
      return listCue(518, bottomOf(nine), nine);
    };
    expect(at(100).more).toBe(true);
    expect(at(390).more).toBe(true);
    expect(at(394)).toEqual({ more: false, lift: 0 });
  });

  it("moves the end of the fade without a jump as the list scrolls", () => {
    let previous: number | null = null;
    for (let scrollTop = 0; scrollTop <= 300; scrollTop += 1) {
      const nine = cards(9, 90, 12, 6, scrollTop);
      const end = 518 - listCue(518, bottomOf(nine), nine).lift;
      if (previous !== null) expect(Math.abs(end - previous)).toBeLessThanOrEqual(2);
      previous = end;
    }
  });
});

// jsdom has no layout: each test places the list's view and its cards by hand, as a browser would.
function List({ count }: { count: number }) {
  const list = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const more = useListCue(list, content);
  return (
    <div ref={list} data-testid="list" data-more={more ? "" : undefined}>
      <div ref={content} data-testid="content">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} data-card="" />
        ))}
      </div>
    </div>
  );
}

const define = (element: HTMLElement, name: string, value: number) => Object.defineProperty(element, name, { configurable: true, value });

/** A view `viewHeight` tall over cards of 90 with gaps of 12, the first 6 down, scrolled by `scrollTop`. */
function layout(list: HTMLElement, content: HTMLElement, viewHeight: number, scrollTop: number) {
  const items = [...content.children] as HTMLElement[];
  define(list, "clientHeight", viewHeight);
  list.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 292, width: 358, height: viewHeight });
  content.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 298 - scrollTop, width: 358, height: items.length * 102 - 12 });
  define(content, "offsetTop", 400);
  define(content, "offsetHeight", items.length * 102 - 12);
  items.forEach((item, i) => {
    define(item, "offsetTop", 400 + i * 102);
    define(item, "offsetHeight", 90);
  });
}

describe("useListCue", () => {
  it("marks a list whose cards run on below its view, lifts the fade over a sliver, and clears the mark at the end", async () => {
    const view = render(<List count={9} />);
    const list = view.getByTestId("list");
    const content = view.getByTestId("content");

    layout(list, content, 518, 0);
    fireEvent.scroll(list);
    await act(async () => {});
    expect(list.hasAttribute("data-more")).toBe(true);
    expect(list.style.getPropertyValue("--list-fade-lift")).toBe(`${14 * (1 - 2 / FADE_PX)}px`);

    layout(list, content, 518, 63);
    fireEvent.scroll(list);
    await act(async () => {});
    expect(list.hasAttribute("data-more")).toBe(true);
    expect(list.style.getPropertyValue("--list-fade-lift")).toBe("0px");

    layout(list, content, 518, 400);
    fireEvent.scroll(list);
    await act(async () => {});
    expect(list.hasAttribute("data-more")).toBe(false);
    expect(list.style.getPropertyValue("--list-fade-lift")).toBe("0px");
  });

  it("does not mark a list whose cards fit", async () => {
    const view = render(<List count={5} />);
    const list = view.getByTestId("list");
    layout(list, view.getByTestId("content"), 518, 0);
    fireEvent.scroll(list);
    await act(async () => {});
    expect(list.hasAttribute("data-more")).toBe(false);
  });

  it("measures when it mounts, before any scroll", async () => {
    const descriptors = ["clientHeight", "offsetHeight"].map((name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)] as const);
    const rect = HTMLElement.prototype.getBoundingClientRect;
    try {
      HTMLElement.prototype.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 292, width: 358, height: 0 });
      Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 518 });
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
        configurable: true,
        get(this: HTMLElement) {
          return this.dataset.testid === "content" ? 912 : 90;
        },
      });
      const view = render(<List count={9} />);
      await act(async () => {});
      expect(view.getByTestId("list").hasAttribute("data-more")).toBe(true);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = rect;
      for (const [name, descriptor] of descriptors) if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
    }
  });
});
