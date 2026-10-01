// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  FlightPath,
  Mark,
  completedLabel,
  flightPathLabel,
  flownPath,
  headingAt,
  pointAt,
  waypointStates,
  waypointT,
} from "@/components/FlightPath";

afterEach(cleanup);

function waypoints(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll("[data-waypoint]")].map((element) => element.getAttribute("data-waypoint"));
}

describe("flight path geometry", () => {
  it("runs along the curve M6 24 Q138 -6 270 24, waypoints evenly spread in t", () => {
    expect(pointAt(0)).toEqual({ x: 6, y: 24 });
    expect(pointAt(1)).toEqual({ x: 270, y: 24 });
    expect(pointAt(0.5)).toEqual({ x: 138, y: 9 });
    expect(waypointT(0, 10)).toBe(0);
    expect(waypointT(9, 10)).toBe(1);
    expect(waypointT(3, 10)).toBeCloseTo(1 / 3);
    expect(waypointT(0, 1)).toBe(0);
  });

  it("draws the flown part as the same curve cut at the plane", () => {
    expect(flownPath(1)).toBe("M6 24 Q138 -6 270 24");
    expect(flownPath(0.5)).toBe("M6 24 Q72 9 138 9");
  });

  it("points the plane along the curve: climbing at the start, level in the middle, descending at the end", () => {
    expect(headingAt(0)).toBeLessThan(0);
    expect(headingAt(0.5)).toBe(0);
    expect(headingAt(1)).toBeGreaterThan(0);
  });
});

describe("waypointStates", () => {
  it("marks answered cards correct or wrong, the card on screen current, the rest future", () => {
    expect(waypointStates(5, [true, false], 2, false)).toEqual(["correct", "wrong", "current", "future", "future"]);
  });

  it("shows the card on screen with its own mark once it is answered", () => {
    expect(waypointStates(4, [true, false, false], 2, true)).toEqual(["correct", "wrong", "wrong", "future"]);
  });
});

describe("flightPathLabel", () => {
  it("is one full sentence with the card numbers of each verdict", () => {
    expect(flightPathLabel(10, [true, true, false], 3)).toBe("Card 4 of 10. Cards 1 and 2 correct, card 3 wrong.");
    expect(flightPathLabel(10, [false, true, true, true], 4)).toBe("Card 5 of 10. Cards 2, 3 and 4 correct, card 1 wrong.");
  });

  it("says only where the round is before the first answer", () => {
    expect(flightPathLabel(10, [], 0)).toBe("Card 1 of 10.");
  });
});

describe("FlightPath", () => {
  it("is one image whose name says the progress and the verdicts", () => {
    render(<FlightPath total={10} results={[true, true, false]} current={3} answered={false} />);
    expect(screen.getByRole("img", { name: "Card 4 of 10. Cards 1 and 2 correct, card 3 wrong." })).toBeTruthy();
  });

  it("shows card N of total and the tally in the label row", () => {
    const { container } = render(<FlightPath total={10} results={[true, true, false]} current={3} answered={false} />);
    expect(container.querySelector("[data-progress]")?.textContent).toBe("Card 4 of 10");
    expect(container.querySelector("[data-tally]")?.textContent).toBe("2 correct · 1 wrong");
  });

  it("draws a waypoint per card and tells them apart by shape, not colour alone", () => {
    const { container } = render(<FlightPath total={10} results={[true, true, false]} current={3} answered={false} />);
    expect(waypoints(container)).toEqual([
      "correct",
      "correct",
      "wrong",
      "current",
      "future",
      "future",
      "future",
      "future",
      "future",
      "future",
    ]);
    expect(container.querySelector('[data-waypoint="correct"] circle')).not.toBeNull();
    expect(container.querySelector('[data-waypoint="wrong"] rect')).not.toBeNull();
    expect(container.querySelector('[data-waypoint="future"] circle')?.getAttribute("r")).toBe("4");
    expect(container.querySelectorAll("[data-waypoint]")[9]?.querySelector("circle")?.getAttribute("r")).toBe("5");
  });

  it("puts the plane on the card on screen and fades it out once that card is answered", () => {
    const question = render(<FlightPath total={10} results={[true, true, false]} current={3} answered={false} />);
    const plane = question.container.querySelector("[data-plane]");
    const at = pointAt(1 / 3);
    expect(plane?.getAttribute("transform")).toContain(`translate(${at.x} ${at.y})`);
    expect(plane?.getAttribute("class")).toContain("opacity-100");
    cleanup();
    const answered = render(<FlightPath total={10} results={[true, true, false, true]} current={3} answered />);
    expect(answered.container.querySelector("[data-plane]")?.getAttribute("class")).toContain("opacity-0");
    expect(waypoints(answered.container)[3]).toBe("correct");
    expect(answered.container.querySelector("[data-tally]")?.textContent).toBe("3 correct · 1 wrong");
  });

  it("has no flown line before the first card is left", () => {
    const { container } = render(<FlightPath total={10} results={[]} current={0} answered={false} />);
    expect(container.querySelectorAll("svg > path")).toHaveLength(1);
  });
});

describe("FlightPath, completed (result screens)", () => {
  const results = [true, true, false, true, true, false, true, true, false, true];

  it("names the finished round and lists the missed cards", () => {
    expect(completedLabel(10, results)).toBe("Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.");
    expect(completedLabel(10, Array.from({ length: 10 }, () => true))).toBe("Round complete. 10 of 10 cards. 10 correct, 0 wrong.");
    render(<FlightPath variant="completed" total={10} results={results} />);
    expect(screen.getByRole("img", { name: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." })).toBeTruthy();
  });

  it("flies the whole route: every card resolved, the line solid to the end, no plane", () => {
    const { container } = render(<FlightPath variant="completed" total={10} results={results} />);
    expect(waypoints(container)).toEqual(results.map((ok) => (ok ? "correct" : "wrong")));
    expect(container.querySelector("[data-plane]")).toBeNull();
    expect(container.querySelectorAll("svg > path")[1]?.getAttribute("d")).toBe("M6 24 Q138 -6 270 24");
  });

  it("reads Arrived with the count and the tally", () => {
    const { container } = render(<FlightPath variant="completed" total={10} results={results} />);
    expect(container.querySelector("[data-progress]")?.textContent).toBe("Arrived · 10 of 10");
    expect(container.querySelector("[data-tally]")?.textContent).toBe("7 correct · 3 wrong");
  });
});

describe("Mark", () => {
  it("scales as a whole and can go without its tick", () => {
    const scaled = render(
      <svg>
        <Mark verdict="correct" at={{ x: 30, y: 20 }} scale={6 / 7} plain />
      </svg>,
    );
    const group = scaled.container.querySelector("[data-waypoint]");
    expect(group?.getAttribute("transform")).toMatch(/^translate\(30 20\) scale\(0\.857/);
    expect(group?.querySelector("path")).toBeNull();
    expect(group?.hasAttribute("data-fresh")).toBe(false);
    cleanup();
    const full = render(
      <svg>
        <Mark verdict="wrong" at={{ x: 30, y: 20 }} fresh />
      </svg>,
    );
    const wrong = full.container.querySelector("[data-waypoint]");
    expect(wrong?.getAttribute("transform")).toBe("translate(30 20)");
    expect(wrong?.querySelector("path")).not.toBeNull();
    expect(wrong?.hasAttribute("data-fresh")).toBe(true);
  });
});
