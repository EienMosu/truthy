import { describe, expect, it } from "vitest";
import { keyScroll, slipScroll, statementScroll } from "@/components/play/ticketScroll";
import { scrollGolden } from "@/scripts/native/golden/geometry-scroll";
import { byName, fileAt, outputFor, view } from "./golden-view";

const FILES = scrollGolden();
const at = (name: string) => fileAt(FILES, `native-data/golden/components.play.ticketScroll.${name}.json`);

describe("the ticket scroll vectors", () => {
  it("makes a file for each function and the step constant", () => {
    expect(FILES.map((file) => file.path)).toEqual(
      ["statementScroll", "slipScroll", "keyScroll", "ARROW_STEP"].map((name) => `native-data/golden/components.play.ticketScroll.${name}.json`),
    );
    expect(view(at("ARROW_STEP")).cases).toEqual([{ name: "value", input: null, output: 40 }]);
  });
});

describe("statementScroll (the pinned cases of ticketScroll.test.ts)", () => {
  const file = at("statementScroll");

  it("stays at the top when the text ends inside the visible stage, scrolls only as far as the end, starts a tall text at the top", () => {
    expect(outputFor(file, { text: { top: 230, bottom: 400 }, visible: 420 })).toBe(0);
    expect(outputFor(file, { text: { top: 230, bottom: 485 }, visible: 350 })).toBe(135);
    expect(outputFor(file, { text: { top: 230, bottom: 485 }, visible: 120 })).toBe(230);
  });
});

describe("slipScroll (the pinned cases of ticketScroll.test.ts)", () => {
  const file = at("slipScroll");
  const base = { top: 0, visible: 300, gap: 12, max: 340 };

  it("scrolls to the end of the ticket for a slip that fits, and stops at the top of a taller one", () => {
    expect(outputFor(file, { slip: { top: 500, bottom: 620 }, at: base })).toBe(340);
    expect(outputFor(file, { slip: { top: 300, bottom: 640 }, at: base })).toBe(300);
  });

  it("does not move a ticket that fits, nor one whose slip ends in the gap above the action row", () => {
    expect(outputFor(file, { slip: { top: 200, bottom: 300 }, at: { ...base, max: 0 } })).toBeNull();
    expect(outputFor(file, { slip: { top: 200, bottom: 303 }, at: { ...base, max: 3 } })).toBeNull();
    expect(outputFor(file, { slip: { top: 200, bottom: 312 }, at: base })).toBeNull();
    expect(outputFor(file, { slip: { top: 300, bottom: 452 }, at: { ...base, top: 140 } })).toBeNull();
  });

  it("scrolls once the slip runs under the action row itself, and back up to a slip above the stage", () => {
    expect(outputFor(file, { slip: { top: 200, bottom: 313 }, at: base })).toBe(200);
    expect(outputFor(file, { slip: { top: 200, bottom: 313 }, at: { ...base, max: 13 } })).toBe(13);
    expect(outputFor(file, { slip: { top: 100, bottom: 200 }, at: { ...base, top: 150 } })).toBe(100);
    expect(outputFor(file, { slip: { top: 200, bottom: 400 }, at: { ...base, max: 0 } })).toBe(0);
  });
});

describe("keyScroll (the pinned cases of ticketScroll.test.ts)", () => {
  const file = at("keyScroll");
  const middle = { top: 100, visible: 300, max: 600 };

  it("moves by a line, a page less a line, or to the ends", () => {
    const out = (key: string, shift: boolean) => outputFor(file, { key, shift, at: middle });
    expect(out("ArrowDown", false)).toBe(140);
    expect(out("ArrowUp", false)).toBe(60);
    expect(out("PageDown", false)).toBe(360);
    expect(out("PageUp", false)).toBe(0);
    expect(out(" ", false)).toBe(360);
    expect(out(" ", true)).toBe(0);
    expect(out("Home", false)).toBe(0);
    expect(out("End", false)).toBe(600);
  });

  it("stays inside the ticket", () => {
    expect(outputFor(file, { key: "ArrowDown", shift: false, at: { top: 590, visible: 300, max: 600 } })).toBe(600);
    expect(outputFor(file, { key: "ArrowUp", shift: false, at: { top: 10, visible: 300, max: 600 } })).toBe(0);
  });

  it("pages by at least a line on a tiny stage", () => {
    expect(outputFor(file, { key: "PageDown", shift: false, at: { top: 0, visible: 49, max: 600 } })).toBe(40);
  });

  it("leaves other keys, and Shift with anything but Space, alone", () => {
    expect(outputFor(file, { key: "ArrowLeft", shift: false, at: middle })).toBeNull();
    expect(outputFor(file, { key: "Enter", shift: false, at: middle })).toBeNull();
    expect(outputFor(file, { key: "ArrowDown", shift: true, at: middle })).toBeNull();
  });
});

describe("every recorded output is what the function says on the recorded input", () => {
  it("statementScroll, slipScroll and keyScroll", () => {
    for (const recorded of view(at("statementScroll")).cases) {
      const input = recorded.input as { text: { top: number; bottom: number }; visible: number };
      expect(statementScroll(input.text, input.visible), recorded.name).toBe(recorded.output);
    }
    for (const recorded of view(at("slipScroll")).cases) {
      const input = recorded.input as { slip: { top: number; bottom: number }; at: { top: number; visible: number; gap: number; max: number } };
      expect(slipScroll(input.slip, input.at), recorded.name).toBe(recorded.output);
    }
    for (const recorded of view(at("keyScroll")).cases) {
      const input = recorded.input as { key: string; shift: boolean; at: { top: number; visible: number; max: number } };
      expect(keyScroll(input.key, input.shift, input.at), recorded.name).toBe(recorded.output);
    }
    expect(byName(at("keyScroll"), "Space with Shift, in the middle").output).toBe(0);
  });
});
