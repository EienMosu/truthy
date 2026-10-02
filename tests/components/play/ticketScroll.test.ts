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
  // A stage 300 tall at the top of the ticket, then the 12 px gap above the action row; the ticket scrolls to 340.
  const at = { top: 0, visible: 300, gap: 12, max: 340 };

  it("scrolls to the end of the ticket when the slip fits the stage", () => {
    expect(slipScroll({ top: 500, bottom: 620 }, at)).toBe(340);
  });

  it("stops at the top of a slip taller than the stage", () => {
    expect(slipScroll({ top: 300, bottom: 640 }, at)).toBe(300);
  });

  it("does not move a ticket that fits", () => {
    expect(slipScroll({ top: 200, bottom: 300 }, { ...at, max: 0 })).toBeNull();
  });

  it("does not move the ticket when the slip ends in the gap above the action row, where nothing hides it", () => {
    expect(slipScroll({ top: 200, bottom: 303 }, { ...at, max: 3 })).toBeNull();
    expect(slipScroll({ top: 200, bottom: 312 }, at)).toBeNull();
    expect(slipScroll({ top: 300, bottom: 452 }, { ...at, top: 140 })).toBeNull();
  });

  it("scrolls once the slip runs under the action row itself", () => {
    expect(slipScroll({ top: 200, bottom: 313 }, at)).toBe(200);
    expect(slipScroll({ top: 200, bottom: 313 }, { ...at, max: 13 })).toBe(13);
  });

  it("scrolls back up to a slip that starts above the stage", () => {
    expect(slipScroll({ top: 100, bottom: 200 }, { ...at, top: 150 })).toBe(100);
  });

  it("stays at 0 when there is nothing to scroll", () => {
    expect(slipScroll({ top: 200, bottom: 400 }, { ...at, max: 0 })).toBe(0);
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
