// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScoreBlock } from "@/components/ScoreBlock";

afterEach(cleanup);

function comparisonText(container: HTMLElement): string | null | undefined {
  return container.querySelector("[data-comparison]")?.textContent;
}

describe("ScoreBlock", () => {
  it("shows Your score over the score and its total", () => {
    const { container } = render(<ScoreBlock score={7} unit="of 10" best={(n) => `${n} / 10`} comparison={{ kind: "first" }} />);
    expect(screen.getByRole("term").textContent).toBe("Your score");
    expect(screen.getByRole("definition").textContent).toBe("7 of 10");
    expect(container.querySelector("[data-score]")?.textContent).toBe("7 of 10");
  });

  it("shows no unit when none is given", () => {
    const { container } = render(<ScoreBlock score={13} best={(n) => `${n}`} comparison={{ kind: "first" }} />);
    expect(container.querySelector("[data-score]")?.textContent).toBe("13");
    expect(container.querySelector("[data-score] small")).toBeNull();
  });

  it("writes the record the way the mode does", () => {
    const record = (n: number) => `${n} cards`;
    const equal = render(<ScoreBlock score={21} unit="cards" best={record} comparison={{ kind: "equal", best: 21 }} />);
    expect(comparisonText(equal.container)).toBe("Equals your bestBest 21 cards");
    cleanup();
    const beaten = render(<ScoreBlock score={21} unit="cards" best={record} comparison={{ kind: "new-best", previousBest: 20 }} />);
    expect(comparisonText(beaten.container)).toBe("New bestPrevious best 20 cards");
    expect(beaten.container.querySelector("[data-score]")?.textContent).toBe("21 cards");
  });

  it("takes another label", () => {
    render(<ScoreBlock score={14} unit="of 17" best={(n) => `${n}`} label="Correct" comparison={{ kind: "first" }} />);
    expect(screen.getByRole("term").textContent).toBe("Correct");
  });

  it("says First round on this route when there was no record", () => {
    const { container } = render(<ScoreBlock score={7} unit="of 10" best={(n) => `${n} / 10`} comparison={{ kind: "first" }} />);
    expect(comparisonText(container)).toBe("First round on this route");
    expect(container.querySelector("[data-new-best]")).toBeNull();
  });

  it("stamps New best over the previous best when the record is beaten", () => {
    const { container } = render(<ScoreBlock score={8} unit="of 10" best={(n) => `${n} / 10`} comparison={{ kind: "new-best", previousBest: 7 }} />);
    const stamp = container.querySelector<HTMLElement>("[data-new-best]");
    expect(stamp?.textContent).toBe("New best");
    expect(stamp?.className).toContain("border-double");
    expect(stamp?.className).toContain("text-(--color-correct)");
    expect(stamp?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(stamp?.style.transform).toContain("rotate(-6deg)");
    expect(comparisonText(container)).toBe("New bestPrevious best 7 / 10");
  });

  it("lets the New best stamp land when asked", () => {
    const { container } = render(<ScoreBlock score={8} unit="of 10" best={(n) => `${n} / 10`} comparison={{ kind: "new-best", previousBest: 7 }} animate />);
    const stamp = container.querySelector<HTMLElement>("[data-new-best]");
    expect(stamp?.style.opacity).toBe("0");
    expect(stamp?.style.transform).toContain("scale(1.9)");
  });

  it("says Equals your best, in words and not as a stamp", () => {
    const { container } = render(<ScoreBlock score={9} unit="of 10" best={(n) => `${n} / 10`} comparison={{ kind: "equal", best: 9 }} />);
    expect(comparisonText(container)).toBe("Equals your bestBest 9 / 10");
    expect(container.querySelector("[data-new-best]")).toBeNull();
  });

  it("says how many short of the best, with the best under it", () => {
    const { container } = render(<ScoreBlock score={7} unit="of 10" best={(n) => `${n} / 10`} comparison={{ kind: "short", best: 9, by: 2 }} />);
    expect(comparisonText(container)).toBe("2 short of your bestBest 9 / 10");
  });

  // Only the stamp cannot wrap, so only a New best may move under the score (a 320 px phone); the other
  // comparisons stay beside it and wrap their words inside their column.
  it("lets only a New best move under the score", () => {
    const kinds = [
      { kind: "first" },
      { kind: "equal", best: 9 },
      { kind: "short", best: 9, by: 2 },
      { kind: "new-best", previousBest: 7 },
    ] as const;
    for (const comparison of kinds) {
      const { container, unmount } = render(<ScoreBlock score={9} unit="of 10" best={(n) => `${n} / 10`} comparison={comparison} />);
      const row = container.querySelector<HTMLElement>("[data-score-block]");
      const column = container.querySelector<HTMLElement>("[data-comparison]");
      const wraps = comparison.kind === "new-best";
      expect(row?.classList.contains("flex-wrap"), comparison.kind).toBe(wraps);
      expect(row?.classList.contains("flex-nowrap"), comparison.kind).toBe(!wraps);
      expect(column?.classList.contains("ml-auto"), comparison.kind).toBe(wraps);
      expect(column?.classList.contains("min-w-0"), comparison.kind).toBe(!wraps);
      unmount();
    }
  });
});
