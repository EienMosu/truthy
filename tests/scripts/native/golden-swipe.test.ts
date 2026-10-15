import { describe, expect, it } from "vitest";
import { NATIVE_FUNCTIONS } from "@/scripts/native/registry";
import { golden } from "@/scripts/native/golden/swipe";

interface Case {
  name: string;
  input: unknown;
  output: unknown;
}
interface Parsed {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, unknown>;
  cases: Case[];
}

const files = golden();
const parsed = new Map(files.map((f) => [f.path, JSON.parse(f.content) as Parsed]));

function file(name: string): Parsed {
  const found = parsed.get(`native-data/golden/src.input.swipe.${name}.json`);
  if (found === undefined) throw new Error(`No golden file for ${name}.`);
  return found;
}

// The output of every case, by case name.
function outputs(name: string): Map<string, unknown> {
  return new Map(file(name).cases.map((c) => [c.name, c.output]));
}

describe("golden swipe: the files", () => {
  it("writes one file per function and constant of swipe in reference 3.9, with the registry's meta and no cards", () => {
    expect(files.map((f) => f.path).sort()).toEqual(
      ["SWIPE", "canStart", "intent", "interpret"].map((n) => `native-data/golden/src.input.swipe.${n}.json`),
    );
    const entries = NATIVE_FUNCTIONS.filter((f) => f.module === "src/input/swipe");
    expect(entries.map((e) => e.name).sort()).toEqual(["SWIPE", "canStart", "intent", "interpret"]);
    for (const entry of entries) {
      const golden = file(entry.name);
      expect([golden.format, golden.module, golden.function, golden.source, golden.tests, golden.cards]).toEqual([
        1,
        entry.module,
        entry.name,
        entry.source,
        [...entry.tests],
        {},
      ]);
    }
  });

  it("is the same on every run, with case names unique in each file", () => {
    expect(golden().map((f) => f.content)).toEqual(files.map((f) => f.content));
    for (const f of parsed.values()) expect(new Set(f.cases.map((c) => c.name)).size).toBe(f.cases.length);
  });
});

describe("golden swipe: the web tests' values", () => {
  it("SWIPE: the input table of the spec", () => {
    expect(file("SWIPE").cases).toEqual([
      { name: "SWIPE", input: null, output: { commitPx: 90, flingPx: 40, flingVelocity: 0.5, settleMs: 250, edgePx: 24 } },
    ]);
  });

  it("intent: proportional inside 110 px and clamped beyond", () => {
    const out = outputs("intent");
    expect(file("intent").cases).toHaveLength(16);
    expect(out.get("swipe.test: zero when the card has not moved")).toBe(0);
    expect(out.get("swipe.test: proportional inside 110 px (55)")).toBe(0.5);
    expect(out.get("swipe.test: exactly -1 at -110 px")).toBe(-1);
    expect(out.get("swipe.test: clamped beyond 110 px (500)")).toBe(1);
    expect(out.get("boundary: 33 px (0.3, which has no exact binary form)")).toBe(33 / 110);
  });

  it("canStart: the settle time and the edge zones, both ends inclusive", () => {
    const out = outputs("canStart");
    expect(file("canStart").cases).toHaveLength(25);
    expect(out.get("swipe.test: ignores a touch 249 ms after the card appeared")).toBe(false);
    expect(out.get("swipe.test: accepts a touch exactly 250 ms after the card appeared")).toBe(true);
    expect(out.get("swipe.test: ignores a touch at x 23 (inside the left edge zone)")).toBe(false);
    expect(out.get("swipe.test: accepts a touch at viewportWidth minus 24")).toBe(true);
    expect(out.get("swipe-early-touch-polish.test: ignores a touch a whole second before the card appeared")).toBe(false);
    expect(out.get("boundary: fractional times, exactly 250 ms apart")).toBe(true);
    expect(out.get("boundary: fractional times, just under 250 ms apart")).toBe(false);
    expect(out.get("boundary: a 1024 wide window (tablet), x 1000")).toBe(true);
    expect(out.get("boundary: a 1024 wide window (tablet), x 1001")).toBe(false);
  });

  it("interpret: every gesture of the three web suites, with the web's verdict", () => {
    const cases = file("interpret").cases;
    expect(cases.filter((c) => c.name.startsWith("swipe.test: "))).toHaveLength(33);
    expect(cases.filter((c) => c.name.startsWith("swipe-polish.test: "))).toHaveLength(4);
    expect(cases.filter((c) => c.name.startsWith("boundary: "))).toHaveLength(17);
    const out = outputs("interpret");
    const expected: readonly [string, string][] = [
      ["swipe.test: commits at exactly 90 px", "true"],
      ["swipe.test: cancels at 89 px", "cancel"],
      ["swipe.test: commits at exactly 90 px to the left", "false"],
      ["swipe.test: commits an exactly diagonal gesture", "true"],
      ["swipe.test: cancels a mostly vertical gesture upwards", "cancel"],
      ["swipe.test: commits a fast fling that travelled 40 px", "true"],
      ["swipe.test: cancels a fast fling that travelled 39 px", "cancel"],
      ["swipe.test: commits at exactly 0.5 px/ms measured over exactly 80 ms", "true"],
      ["swipe.test: cancels just below 0.5 px/ms", "cancel"],
      ["swipe.test: cancels a 120 px swipe that started in the left edge zone", "cancel"],
      ["swipe-polish.test: does not count a reference sample 81 ms before the release", "cancel"],
      ["swipe-polish.test: counts a reference sample exactly 80 ms before the release", "true"],
      ["swipe-polish.test: takes the oldest sample inside the window, so a fast stretch followed by a pause still flings", "true"],
      ["swipe-polish.test: takes the oldest sample inside the window, so a slow drag that ends in a one-frame jerk does not fling", "cancel"],
      ["boundary: exactly 0.5 px/ms to the left over 80 ms is false", "false"],
      ["boundary: a fractional reference 80.5 ms before the release is outside the window", "cancel"],
      ["boundary: a start 249 ms after the card cancels", "cancel"],
      ["boundary: a tablet window measures the edge zone from the window, not the card", "false"],
    ];
    for (const [name, verdict] of expected) expect(out.get(name), name).toBe(verdict);
  });

  it("interpret: writes the samples and the context as the function takes them", () => {
    const first = file("interpret").cases.find((c) => c.name === "swipe.test: commits at exactly 90 px");
    expect(first?.input).toEqual({
      samples: [
        { x: 195, y: 400, t: 1000 },
        { x: 240, y: 400, t: 1300 },
        { x: 285, y: 400, t: 1600 },
      ],
      context: { viewportWidth: 390, cardShownAt: 0 },
    });
  });
});
