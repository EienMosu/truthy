// Vectors for where the play screen scrolls its ticket (components/play/ticketScroll.ts): pure arithmetic
// on numbers, with the spans and the scroll position given as objects.
import { ARROW_STEP, keyScroll, slipScroll, statementScroll } from "@/components/play/ticketScroll";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const MODULE = "components/play/ticketScroll";
const SOURCE = "components/play/ticketScroll.ts";
const TESTS = ["tests/components/play/ticketScroll.test.ts"] as const;

const meta = (name: string) => ({ module: MODULE, function: name, source: SOURCE, tests: TESTS });

type Span = { top: number; bottom: number };
type SlipAt = { top: number; visible: number; gap: number; max: number };

function statementFile(): GoldenFile {
  const text = (name: string, span: Span, visible: number): GoldenCase => ({ name, input: { text: span, visible }, output: statementScroll(span, visible) });
  return goldenFile(meta("statementScroll"), [
    text("the text ends inside the visible stage: nothing moves", { top: 230, bottom: 400 }, 420),
    text("scrolls only as far as lets the text end at the bottom of the visible stage", { top: 230, bottom: 485 }, 350),
    text("a text taller than the stage starts at the top of the stage", { top: 230, bottom: 485 }, 120),
    text("the text ends exactly at the bottom of the stage", { top: 230, bottom: 420 }, 420),
    text("the text ends one pixel below the stage", { top: 230, bottom: 421 }, 420),
    text("the text starts at the top of the ticket", { top: 0, bottom: 500 }, 300),
    text("the text is as tall as the stage and starts below the top", { top: 100, bottom: 400 }, 300),
    text("a stage of nothing", { top: 50, bottom: 80 }, 0),
    text("fractional pixels", { top: 230.5, bottom: 485.25 }, 350.75),
  ]);
}

function slipFile(): GoldenFile {
  const slip = (name: string, span: Span, at: SlipAt): GoldenCase => ({ name, input: { slip: span, at }, output: slipScroll(span, at) });
  // A stage 300 tall at the top of the ticket, then the 12 px gap above the action row; the ticket scrolls to 340.
  const base: SlipAt = { top: 0, visible: 300, gap: 12, max: 340 };
  return goldenFile(meta("slipScroll"), [
    slip("scrolls to the end of the ticket when the slip fits the stage", { top: 500, bottom: 620 }, base),
    slip("stops at the top of a slip taller than the stage", { top: 300, bottom: 640 }, base),
    slip("does not move a ticket that fits", { top: 200, bottom: 300 }, { ...base, max: 0 }),
    slip("does not move the ticket when the slip ends in the gap: 3 px of scroll", { top: 200, bottom: 303 }, { ...base, max: 3 }),
    slip("does not move the ticket when the slip ends exactly at the end of the gap", { top: 200, bottom: 312 }, base),
    slip("does not move the ticket when the scroll is 140 and the slip ends in the gap", { top: 300, bottom: 452 }, { ...base, top: 140 }),
    slip("scrolls once the slip runs one pixel under the action row", { top: 200, bottom: 313 }, base),
    slip("scrolls to the largest scroll when that is above the slip's top", { top: 200, bottom: 313 }, { ...base, max: 13 }),
    slip("scrolls back up to a slip that starts above the stage", { top: 100, bottom: 200 }, { ...base, top: 150 }),
    slip("stays at 0 when there is nothing to scroll", { top: 200, bottom: 400 }, { ...base, max: 0 }),
    slip("a slip that starts exactly at the top of the stage is in view", { top: 150, bottom: 300 }, { ...base, top: 150 }),
    slip("a slip that starts one pixel above the stage is scrolled to", { top: 149, bottom: 300 }, { ...base, top: 150 }),
    slip("no gap", { top: 200, bottom: 301 }, { ...base, gap: 0 }),
  ]);
}

const KEYS = [" ", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", "ArrowLeft", "ArrowRight", "Enter", "Tab", "a"];

function keyFile(): GoldenFile {
  const stages: { label: string; at: { top: number; visible: number; max: number } }[] = [
    { label: "in the middle", at: { top: 100, visible: 300, max: 600 } },
    { label: "near the end", at: { top: 590, visible: 300, max: 600 } },
    { label: "near the top", at: { top: 10, visible: 300, max: 600 } },
    { label: "on a tiny stage", at: { top: 0, visible: 49, max: 600 } },
  ];
  const cases: GoldenCase[] = [];
  for (const { label, at } of stages) {
    for (const key of KEYS) {
      for (const shift of [false, true]) {
        cases.push({ name: `${key === " " ? "Space" : key}${shift ? " with Shift" : ""}, ${label}`, input: { key, shift, at }, output: keyScroll(key, shift, at) });
      }
    }
  }
  return goldenFile(meta("keyScroll"), cases);
}

/** The files of this group: statementScroll, slipScroll, keyScroll, ARROW_STEP. */
export function scrollGolden(): GoldenFile[] {
  return [statementFile(), slipFile(), keyFile(), goldenFile(meta("ARROW_STEP"), [{ name: "value", input: null, output: ARROW_STEP }])];
}
