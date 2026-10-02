// The arithmetic of where the play screen scrolls its ticket (review findings U44 and U49).
import { describe, expect, it } from "vitest";
import { ARROW_STEP, keyScroll, slipScroll, statementScroll } from "@/components/play/ticketScroll";

describe("statementScroll: a new card", () => {
  it("stays at the top when the text ends inside the visible stage", () => {
    expect(statementScroll({ top: 230, bottom: 400 }, 420)).toBe(0);
  });

  it("scrolls only as far as lets the text end at the bottom of the visible stage", () => {
    expect(statementScroll({ top: 230, bottom: 485 }, 350)).toBe(135);
  });

  it("starts a text taller than the stage at the top of the stage", () => {
    expect(statementScroll({ top: 230, bottom: 485 }, 120)).toBe(230);
  });
});

describe("slipScroll: after an answer", () => {
  it("scrolls to the end of the ticket when the slip fits the stage", () => {
    expect(slipScroll(500, 340)).toBe(340);
  });

  it("stops at the top of a slip taller than the stage", () => {
    expect(slipScroll(300, 340)).toBe(300);
  });

  it("does not move a ticket that fits", () => {
    expect(slipScroll(500, 0)).toBe(0);
  });
});

describe("keyScroll: the keys that scroll a page", () => {
  const at = { top: 100, visible: 300, max: 600 };

  it("moves by a line, a page less a line, or to the ends", () => {
    expect(keyScroll("ArrowDown", false, at)).toBe(100 + ARROW_STEP);
    expect(keyScroll("ArrowUp", false, at)).toBe(100 - ARROW_STEP);
    expect(keyScroll("PageDown", false, at)).toBe(360);
    expect(keyScroll("PageUp", false, at)).toBe(0);
    expect(keyScroll(" ", false, at)).toBe(360);
    expect(keyScroll(" ", true, at)).toBe(0);
    expect(keyScroll("Home", false, at)).toBe(0);
    expect(keyScroll("End", false, at)).toBe(600);
  });

  it("stays inside the ticket", () => {
    expect(keyScroll("ArrowDown", false, { ...at, top: 590 })).toBe(600);
    expect(keyScroll("ArrowUp", false, { ...at, top: 10 })).toBe(0);
  });

  it("pages by at least a line on a tiny stage", () => {
    expect(keyScroll("PageDown", false, { top: 0, visible: 49, max: 600 })).toBe(ARROW_STEP);
  });

  it("leaves other keys, and Shift with anything but Space, alone", () => {
    expect(keyScroll("ArrowLeft", false, at)).toBeNull();
    expect(keyScroll("Enter", false, at)).toBeNull();
    expect(keyScroll("ArrowDown", true, at)).toBeNull();
  });
});
