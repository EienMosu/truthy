// @vitest-environment jsdom
// Review finding U69: the fields of the fill-in pass are a list of terms (dl). In HTML a div in a dl holds only
// its dt and dd, so a field's way back ("Change deck, now CLF") sits inside the dd, and still covers the
// whole field: the dd is not positioned while it holds a value, so the button's inset is the field's.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FillInPass, type FillInPassValues, type PassStage } from "@/components/FillInPass";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

const FULL: FillInPassValues = {
  area: "Cloud",
  platform: "AWS",
  deck: { code: "CLF", name: "AWS Cloud Practitioner" },
  section: { code: "SEC", name: "Security and compliance", whole: false },
  mode: "Classic",
  cards: 47,
};

const STAGES: [PassStage, FillInPassValues][] = [
  ["destination", { area: "Cloud", platform: "AWS", deck: FULL.deck }],
  ["route", { ...FULL, mode: undefined }],
  ["route", FULL],
  ["ready", FULL],
];

describe("FillInPass: the fields as a list of terms", () => {
  it.each(STAGES)("holds only a dt and a dd in each group of the %s pass", (stage, values) => {
    render(<FillInPass stage={stage} values={values} onJump={() => {}} />);
    const lists = [...document.querySelectorAll("dl")];
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      for (const group of list.children) {
        expect(group.tagName).toBe("DIV");
        expect([...group.children].map((child) => child.tagName)).toEqual(["DT", "DD"]);
      }
    }
  });

  it("keeps every way back of a field inside its value", () => {
    render(<FillInPass stage="route" values={FULL} onJump={() => {}} />);
    for (const name of ["Change deck, now CLF", "Change section, now SEC", "Change class, now Classic"]) {
      expect(screen.getByRole("button", { name }).parentElement?.tagName).toBe("DD");
    }
  });

  it("lets the way back cover the whole field, not only its value", () => {
    render(<FillInPass stage="route" values={{ ...FULL, mode: undefined }} now="mode" onJump={() => {}} />);
    const deck = document.querySelector<HTMLElement>('[data-field="deck"]');
    expect(deck?.className).toContain("relative");
    expect(deck?.querySelector("dd")?.className.split(" ")).not.toContain("relative");
    // The dashes of the field being chosen sit in the dd's one grid cell, where its value will be, with no
    // positioned dd for leaving dashes to be placed against.
    const blankValue = document.querySelector('[data-field="mode"] dd');
    expect(blankValue?.className.split(" ")).not.toContain("relative");
    expect(blankValue?.querySelector("[data-pass-blank]")?.className).toContain("[grid-area:1/1]");
  });

  it("still goes back from the ready pass's class", () => {
    const onJump = vi.fn();
    render(<FillInPass stage="ready" values={FULL} onJump={onJump} />);
    const change = screen.getByRole("button", { name: "Change class, now Classic" });
    expect(change.parentElement?.tagName).toBe("DD");
    expect(change.closest("div")?.className).toContain("relative");
    fireEvent.click(change);
    expect(onJump).toHaveBeenCalledWith("mode");
  });
});
