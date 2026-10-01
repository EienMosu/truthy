// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScoreBlock, compareWithBest } from "@/components/ScoreBlock";

afterEach(cleanup);

function comparisonText(container: HTMLElement): string | null | undefined {
  return container.querySelector("[data-comparison]")?.textContent;
}

describe("compareWithBest", () => {
  it("is a first round when the route and mode had no record", () => {
    expect(compareWithBest(7, null)).toEqual({ kind: "first" });
  });

  it("is a new best when the score beats the record", () => {
    expect(compareWithBest(8, 7)).toEqual({ kind: "new-best", previousBest: 7 });
  });

  it("equals the best when the score matches the record", () => {
    expect(compareWithBest(9, 9)).toEqual({ kind: "equal", best: 9 });
  });

  it("says how far short of the record the score is", () => {
    expect(compareWithBest(7, 9)).toEqual({ kind: "short", best: 9, by: 2 });
    expect(compareWithBest(0, 10)).toEqual({ kind: "short", best: 10, by: 10 });
  });
});

describe("ScoreBlock", () => {
  it("shows Your score over the score and its total", () => {
    const { container } = render(<ScoreBlock score={7} total={10} comparison={{ kind: "first" }} />);
    expect(screen.getByRole("term").textContent).toBe("Your score");
    expect(screen.getByRole("definition").textContent).toBe("7 of 10");
    expect(container.querySelector("[data-score]")?.textContent).toBe("7 of 10");
  });

  it("takes another label", () => {
    render(<ScoreBlock score={14} total={17} label="Correct" comparison={{ kind: "first" }} />);
    expect(screen.getByRole("term").textContent).toBe("Correct");
  });

  it("says First round on this route when there was no record", () => {
    const { container } = render(<ScoreBlock score={7} total={10} comparison={{ kind: "first" }} />);
    expect(comparisonText(container)).toBe("First round on this route");
    expect(container.querySelector("[data-new-best]")).toBeNull();
  });

  it("stamps New best over the previous best when the record is beaten", () => {
    const { container } = render(<ScoreBlock score={8} total={10} comparison={{ kind: "new-best", previousBest: 7 }} />);
    const stamp = container.querySelector<HTMLElement>("[data-new-best]");
    expect(stamp?.textContent).toBe("New best");
    expect(stamp?.className).toContain("border-double");
    expect(stamp?.className).toContain("text-(--color-correct)");
    expect(stamp?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(stamp?.style.transform).toContain("rotate(-6deg)");
    expect(comparisonText(container)).toBe("New bestPrevious best 7 / 10");
  });

  it("lets the New best stamp land when asked", () => {
    const { container } = render(<ScoreBlock score={8} total={10} comparison={{ kind: "new-best", previousBest: 7 }} animate />);
    const stamp = container.querySelector<HTMLElement>("[data-new-best]");
    expect(stamp?.style.opacity).toBe("0");
    expect(stamp?.style.transform).toContain("scale(1.9)");
  });

  it("says Equals your best, in words and not as a stamp", () => {
    const { container } = render(<ScoreBlock score={9} total={10} comparison={{ kind: "equal", best: 9 }} />);
    expect(comparisonText(container)).toBe("Equals your bestBest 9 / 10");
    expect(container.querySelector("[data-new-best]")).toBeNull();
  });

  it("says how many short of the best, with the best under it", () => {
    const { container } = render(<ScoreBlock score={7} total={10} comparison={{ kind: "short", best: 9, by: 2 }} />);
    expect(comparisonText(container)).toBe("2 short of your bestBest 9 / 10");
  });
});
