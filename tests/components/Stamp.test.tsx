// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Stamp, StubStamp, type StubStampKind } from "@/components/Stamp";

afterEach(cleanup);

function stampOf(container: HTMLElement): HTMLElement {
  const stamp = container.querySelector<HTMLElement>("[data-verdict]");
  if (!stamp) throw new Error("no stamp rendered");
  return stamp;
}

describe("Stamp", () => {
  it("says Correct with a check in the correct colour", () => {
    const stamp = stampOf(render(<Stamp verdict="correct" />).container);
    expect(stamp.textContent).toBe("Correct");
    expect(stamp.className).toContain("text-(--color-correct)");
    expect(stamp.querySelector("path")?.getAttribute("d")).toBe("M3 9.5l4 4 8-9");
    expect(stamp.querySelector("svg")?.getAttribute("width")).toBe("22");
  });

  it("says Not quite with an X in the wrong colour", () => {
    const stamp = stampOf(render(<Stamp verdict="wrong" />).container);
    expect(stamp.textContent).toBe("Not quite");
    expect(stamp.className).toContain("text-(--color-wrong)");
    expect(stamp.querySelector("path")?.getAttribute("d")).toBe("M3 3l10 10M13 3L3 13");
    expect(stamp.querySelector("svg")?.getAttribute("width")).toBe("18");
  });

  it("keeps its icon out of the accessible text: the word carries the verdict", () => {
    const stamp = stampOf(render(<Stamp verdict="correct" />).container);
    expect(stamp.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("has the double 3px border and sits at rest tilted by -6 degrees", () => {
    const stamp = stampOf(render(<Stamp verdict="correct" />).container);
    expect(stamp.className).toContain("border-double");
    expect(stamp.className).toContain("border-(length:--stroke-stamp)");
    expect(stamp.style.transform).toContain("rotate(-6deg)");
    expect(stamp.style.opacity).toBe("1");
  });

  it("starts large, turned and invisible when it is to land", () => {
    const stamp = stampOf(render(<Stamp verdict="wrong" animate />).container);
    expect(stamp.style.opacity).toBe("0");
    expect(stamp.style.transform).toContain("scale(1.9)");
    expect(stamp.style.transform).toContain("rotate(-14deg)");
  });

  it("the New best stamp is a star, the words New best and a hidden Correct", () => {
    const stamp = stampOf(render(<Stamp verdict="new-best" />).container);
    expect(stamp.textContent).toBe("Correct. New best");
    expect(stamp.getAttribute("data-verdict")).toBe("new-best");
    expect(stamp.className).toContain("text-(--color-correct)");
    expect(stamp.querySelector(".sr-only")?.textContent).toBe("Correct. ");
    expect(stamp.querySelector("svg")?.getAttribute("width")).toBe("20");
    expect(stamp.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("StubStamp", () => {
  it.each<[StubStampKind, string, string]>([
    ["correct", "Correct", "text-(--color-correct)"],
    ["wrong", "Not quite", "text-(--color-wrong)"],
    ["time-up", "Time is up", "text-(--color-ink)"],
  ])("StubStamp says Correct, Not quite or Time is up with its icon, at 28 px on raised paper (%s)", (kind, text, colour) => {
    const { container } = render(<StubStamp kind={kind} />);
    const stamp = container.querySelector<HTMLElement>(`[data-stub-stamp="${kind}"]`);
    expect(stamp?.textContent).toBe(text);
    expect(stamp?.className).toContain(colour);
    expect(stamp?.className).toContain("text-[28px]");
    expect(stamp?.className).toContain("bg-(--color-surface-raised)");
    expect(stamp?.className).toContain("border-double");
    expect(stamp?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("lands from 1.9 and -14 degrees, invisible", () => {
    const { container } = render(<StubStamp kind="correct" />);
    const stamp = container.querySelector<HTMLElement>("[data-stub-stamp]");
    expect(stamp?.style.opacity).toBe("0");
    expect(stamp?.style.transform).toContain("scale(1.9)");
    expect(stamp?.style.transform).toContain("rotate(-14deg)");
  });

  it("uses the check at 24, the X at 20 and the clock at its own size", () => {
    const width = (kind: StubStampKind) => {
      const { container } = render(<StubStamp kind={kind} />);
      const value = container.querySelector("svg")?.getAttribute("width");
      cleanup();
      return value;
    };
    expect([width("correct"), width("wrong"), width("time-up")]).toEqual(["24", "20", "22"]);
  });
});
