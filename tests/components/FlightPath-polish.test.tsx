// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FlightPath, completedScale, pointAt, waypointT } from "@/components/FlightPath";

afterEach(cleanup);

/** A Streak result: right answers up to the last card, which is wrong, with the previous best on the card before it. */
function streakResult(total: number) {
  const results = Array.from({ length: total }, (_, i) => i < total - 1);
  return render(<FlightPath variant="completed" total={total} results={results} ring={total - 2} />);
}

const RING_HALF_STROKE = 0.7;

describe("the previous-best ring on a completed route", () => {
  it("keeps the mockup's dot + 3.5 while there is room for it", () => {
    for (const total of [10, 14]) {
      const ring = streakResult(total).container.querySelector('[data-ring="reached"]');
      expect(Number(ring?.getAttribute("r"))).toBeCloseTo(7 * completedScale(total) + 3.5, 5);
      cleanup();
    }
  });

  // From 58 cards the space between two dots is narrower than the ring's own 1.4 stroke, so no ring fits there.
  it.each(Array.from({ length: 47 }, (_, i) => i + 11))("never touches the dot before it on a route of %i cards", (total) => {
    const ring = streakResult(total).container.querySelector('[data-ring="reached"]');
    const r = Number(ring?.getAttribute("r"));
    const centre = pointAt(waypointT(total - 2, total));
    const neighbour = pointAt(waypointT(total - 3, total));
    const distance = Math.hypot(centre.x - neighbour.x, centre.y - neighbour.y);
    const dot = 7 * completedScale(total);
    // Clear of the neighbour outside, and still a ring around its own dot inside.
    expect(r + RING_HALF_STROKE + dot).toBeLessThan(distance);
    expect(r - RING_HALF_STROKE).toBeGreaterThan(dot);
  });

  it("is drawn under a wrong square that is enlarged past its neighbours, so the square's x stays whole", () => {
    const { container } = streakResult(41);
    const ring = container.querySelector('[data-ring="reached"]');
    const wrong = container.querySelector('[data-waypoint="wrong"]');
    expect(ring).not.toBeNull();
    expect(wrong).not.toBeNull();
    expect(ring!.compareDocumentPosition(wrong!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
