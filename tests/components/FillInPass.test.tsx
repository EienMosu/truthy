// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FillInPass, changeLabel, type FillInPassValues } from "@/components/FillInPass";

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

function field(name: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-field="${name}"]`);
  if (!element) throw new Error(`no field ${name}`);
  return element;
}

describe("changeLabel", () => {
  it("names what a filled field changes", () => {
    expect(changeLabel("deck", "CLF")).toBe("Change deck, now CLF");
    expect(changeLabel("mode", "Classic")).toBe("Change class, now Classic");
  });
});

describe("FillInPass: choosing the destination", () => {
  it("shows Area, Platform and Deck under the compact YOUR PASS band, blanks saying not chosen", () => {
    render(<FillInPass stage="destination" values={{ area: "Cloud" }} now="platform" onJump={() => {}} />);
    expect(document.querySelector("[data-fill-in-pass]")?.textContent).toContain("YOUR PASS");
    expect(field("area").textContent).toBe("AreaCloud");
    expect(field("platform").textContent).toBe("Platformnot chosen");
    expect(field("deck").textContent).toBe("Decknot chosen");
  });

  it("marks the field being chosen now in ink, not only by colour: its label also turns semibold", () => {
    render(<FillInPass stage="destination" values={{ area: "Cloud" }} now="platform" onJump={() => {}} />);
    expect(field("platform").hasAttribute("data-now")).toBe(true);
    expect(field("platform").querySelector("dt")?.className).toContain("font-(--font-weight-mono-semibold)");
    expect(field("deck").hasAttribute("data-now")).toBe(false);
  });

  it("makes each filled field a way back to its step", () => {
    const onJump = vi.fn();
    render(<FillInPass stage="destination" values={{ area: "Cloud", platform: "AWS" }} now="deck" onJump={onJump} />);
    fireEvent.click(screen.getByRole("button", { name: "Change platform, now AWS" }));
    expect(onJump).toHaveBeenCalledWith("platform");
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("announces changes politely", () => {
    render(<FillInPass stage="destination" values={{}} now="platform" onJump={() => {}} />);
    expect(document.querySelector("[aria-live='polite']")).not.toBeNull();
  });
});

describe("FillInPass: choosing the route", () => {
  it("folds area and platform into one quiet line over Deck, Section and Class", () => {
    const onJump = vi.fn();
    render(<FillInPass stage="route" values={{ area: "Cloud", platform: "AWS", deck: FULL.deck }} now="section" onJump={onJump} />);
    fireEvent.click(screen.getByRole("button", { name: "Change area, now Cloud" }));
    expect(onJump).toHaveBeenCalledWith("area");
    expect(screen.getByRole("button", { name: "Change platform, now AWS" })).toBeTruthy();
    expect(field("deck").textContent).toBe("DeckCLF");
    expect(field("section").textContent).toBe("Sectionnot chosen");
    expect(field("mode").textContent).toBe("Classnot chosen");
  });

  it("writes Whole deck in words, and keeps it from being a way back when the deck has no sections", () => {
    const values: FillInPassValues = { ...FULL, mode: undefined, section: { code: "ALL", name: "Whole deck", whole: true } };
    render(<FillInPass stage="route" values={values} now="mode" sectionChoosable={false} onJump={() => {}} />);
    expect(field("section").textContent).toBe("SectionWhole deck");
    expect(screen.queryByRole("button", { name: /^Change section/ })).toBeNull();
  });
});

describe("FillInPass: ready", () => {
  it("becomes the boarding pass: legs, Class, Cards and Gate", () => {
    render(<FillInPass stage="ready" values={FULL} onJump={() => {}} />);
    const pass = document.querySelector("[data-fill-in-pass='ready']");
    expect(pass?.textContent).toContain("BOARDING PASS");
    expect(document.querySelector("[data-leg='deck']")?.textContent).toBe("CLFAWS Cloud Practitioner");
    expect(document.querySelector("[data-leg='section']")?.textContent).toBe("SECSecurity and compliance");
    expect(pass?.textContent).toContain("ClassClassic");
    expect(pass?.textContent).toContain("Cards47");
    expect(pass?.textContent).toContain("GateF ← → TFalse left, true right");
  });

  it("lets the deck leg, the section leg and the class field return to their steps", () => {
    const onJump = vi.fn();
    render(<FillInPass stage="ready" values={FULL} onJump={onJump} />);
    fireEvent.click(screen.getByRole("button", { name: "Change deck, now CLF" }));
    fireEvent.click(screen.getByRole("button", { name: "Change section, now SEC" }));
    fireEvent.click(screen.getByRole("button", { name: "Change class, now Classic" }));
    expect(onJump.mock.calls).toEqual([["deck"], ["section"], ["mode"]]);
  });

  it("unrolls to the height of the game ticket, then says so", () => {
    const onUnrolled = vi.fn();
    const { rerender } = render(<FillInPass stage="ready" values={FULL} onJump={() => {}} />);
    expect(document.querySelector("[data-unroll]")).toBeNull();
    rerender(<FillInPass stage="ready" values={FULL} onJump={() => {}} unroll onUnrolled={onUnrolled} />);
    const paper = document.querySelector<HTMLElement>("[data-unroll]");
    expect(paper?.style.height).toBe("calc(var(--size-statement-min) + var(--size-lower) - var(--space-18) + var(--radius-card))");
    return vi.waitFor(() => expect(onUnrolled).toHaveBeenCalledTimes(1));
  });
});

describe("FillInPass: travelling values", () => {
  it("hides the value that is still travelling in from its card", () => {
    render(<FillInPass stage="destination" values={{ area: "Cloud" }} now="platform" travelling="area" onJump={() => {}} />);
    expect(document.querySelector<HTMLElement>("[data-pass-value='area']")?.style.visibility).toBe("hidden");
  });
});
