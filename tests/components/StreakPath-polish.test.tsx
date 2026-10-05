// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StreakPath } from "@/components/StreakPath";

afterEach(cleanup);

const radii = (elements: NodeListOf<Element>) => [...elements].map((element) => element.getAttribute("r"));

describe("StreakPath with a large best", () => {
  it("keeps the target ring at r7 around an r3 centre, as in the mockup", () => {
    const { container } = render(<StreakPath streak={3} best={60} answered={null} />);
    expect(radii(container.querySelectorAll('[data-ring="target"] circle'))).toEqual(["7", "3"]);
  });

  it("draws no future slots once they would be too small to read apart, and leaves the dotted line to them", () => {
    const { container } = render(<StreakPath streak={3} best={60} answered={null} />);
    expect(container.querySelectorAll("[data-future]")).toHaveLength(0);
    expect(container.querySelector('path[stroke-dasharray="2 5"]')).not.toBeNull();
  });

  it("still draws every future slot at r4 and the r7 ring around r3 for the mockup's best of 12", () => {
    const { container } = render(<StreakPath streak={8} best={12} answered={null} />);
    expect(radii(container.querySelectorAll("[data-future]"))).toEqual(["4", "4"]);
    expect(radii(container.querySelectorAll('[data-ring="target"] circle'))).toEqual(["7", "3"]);
  });

  it("keeps future slots while they are r2 or more: up to a best of 28", () => {
    const { container } = render(<StreakPath streak={3} best={28} answered={null} />);
    expect(new Set(radii(container.querySelectorAll("[data-future]")))).toEqual(new Set(["2"]));
    expect(container.querySelectorAll("[data-future]")).toHaveLength(23);
    cleanup();
    const past = render(<StreakPath streak={3} best={29} answered={null} />);
    expect(past.container.querySelectorAll("[data-future]")).toHaveLength(0);
  });
});

describe("StreakPath on a very long streak", () => {
  it("draws a dot for every card while a dot is wider than the flown line", () => {
    const { container } = render(<StreakPath streak={60} best={null} answered={null} />);
    expect(container.querySelectorAll("[data-streak-dot]")).toHaveLength(60);
  });

  it("stops adding dots once they would vanish inside the flown line, so the header stays a fixed size", () => {
    const { container } = render(<StreakPath streak={300} best={null} answered={null} />);
    expect(container.querySelectorAll("[data-streak-dot]")).toHaveLength(0);
    expect(container.querySelectorAll("*").length).toBeLessThan(40);
    expect(container.querySelector('path[stroke-width="2.4"]')).not.toBeNull();
  });

  it("keeps the ring where a best of 12 was reached, past the last drawn dot", () => {
    const { container } = render(<StreakPath streak={300} best={12} answered="correct" />);
    expect(container.querySelectorAll("[data-streak-dot]")).toHaveLength(0);
    expect(container.querySelectorAll('[data-ring="reached"]')).toHaveLength(1);
  });

  it("never draws more than about 65 dots, whatever the best", () => {
    for (const best of [null, 40, 66, 67, 80, 200]) {
      for (const streak of [50, 64, 65, 66, 70, 150]) {
        const { container } = render(<StreakPath streak={streak} best={best} answered={null} />);
        expect(container.querySelectorAll("[data-streak-dot]").length).toBeLessThanOrEqual(66);
        cleanup();
      }
    }
  });
});
