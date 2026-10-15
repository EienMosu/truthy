import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EASE } from "@/components/easing";
import { type Override, resolveTokens } from "@/scripts/native/tokens";

// scripts/native-token-overrides.json is kept by hand from the override table of reference 5.0: the places where
// the code wins over design/system/tokens.json. These tests hold it to the code and to tokens.json, so it cannot
// go stale on either side: a row the code no longer shows fails here, and a token that was fixed fails in
// resolveTokens as a stale override.
const ROOT = join(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const TOKENS: unknown = JSON.parse(read("design/system/tokens.json"));
const OVERRIDES = JSON.parse(read("scripts/native-token-overrides.json")) as Override[];
const RESOLVED = resolveTokens(TOKENS, OVERRIDES);

function at(tree: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], tree);
}

function parentOf(tree: unknown, path: string): Record<string, unknown> {
  const keys = path.split(".").slice(0, -1);
  return (keys.length === 0 ? tree : at(tree, keys.join("."))) as Record<string, unknown>;
}

function setAt(tree: unknown, path: string, value: unknown): void {
  parentOf(tree, path)[path.split(".").pop() as string] = value;
}

function removeAt(tree: unknown, path: string): void {
  delete parentOf(tree, path)[path.split(".").pop() as string];
}

// ---------- the rows of reference 5.0, by the token paths each one overrides ----------
const SKY = ["day", "night"].flatMap((theme) => [1, 2, 3, 4].map((n) => `color.${theme}.sky-${n}.$description`));
const ROWS: Record<string, string[]> = {
  "size.max-width": ["size.max-width.$value", "size.max-width.$description"],
  "color.*.sky-1..4": SKY,
  "motion.transition.sheet-open": ["motion.transition.sheet-open.$value", "motion.transition.sheet-open.$description"],
  "motion.transition.sheet-close": ["motion.transition.sheet-close.$description"],
  "motion.spring.land": ["motion.spring.land.$description"],
  "the unused sheet sizes and the radio": [
    "size.sheet-overrun.$description",
    "size.sheet-bar.$description",
    "size.grab.$description",
    "size.list-row.$description",
    "size.radio.$description",
    "stroke.radio.$description",
  ],
  "stroke.focus and color.*.focus-on-fill": [
    "stroke.focus.$value",
    "stroke.focus.$description",
    "color.day.focus-on-fill.$value",
    "color.day.focus-on-fill.$description",
    "color.night.focus-on-fill.$value",
    "color.night.focus-on-fill.$description",
  ],
  "typography.tagline": ["typography.tagline.$description"],
  "typography.step-title": ["typography.step-title.$description"],
  "typography.list-title (the 1.25 detail lines)": ["typography.list-title.$value.lineHeight"],
  "the unused type roles": [
    "typography.screen-title.$description",
    "typography.body-small.$description",
    "typography.option-title.$description",
    "typography.section-code.$description",
    "typography.sheet-title.$description",
  ],
  "size.safe-top and size.safe-bottom": ["size.safe-top.$description", "size.safe-bottom.$description"],
  "size.start-top-zone": ["size.start-top-zone.$description"],
  "motion.spring.snap": ["motion.spring.snap.$description"],
  "the values with no token": ["native"],
};

describe("scripts/native-token-overrides.json", () => {
  it("is a list of overrides with a path, a value, a reason and evidence, in that order, and add last on the additive one", () => {
    expect(Array.isArray(OVERRIDES)).toBe(true);
    for (const item of OVERRIDES) {
      const keys = item.add === true ? ["path", "value", "reason", "evidence", "add"] : ["path", "value", "reason", "evidence"];
      expect(Object.keys(item), item.path).toEqual(keys);
    }
    expect(OVERRIDES.filter((item) => item.add === true).map((item) => item.path)).toEqual(["native"]);
  });

  it("holds the rows of reference 5.0 that tokens.json states wrongly, and nothing else", () => {
    const expected = Object.values(ROWS).flat();
    expect(OVERRIDES.map((item) => item.path).sort()).toEqual([...expected].sort());
    expect(expected).toHaveLength(39);
  });

  it("resolves against design/system/tokens.json: no path is dangling and no value is stale", () => {
    expect(() => resolveTokens(TOKENS, OVERRIDES)).not.toThrow();
  });

  it("changes nothing but the listed paths", () => {
    const restored = structuredClone(RESOLVED);
    for (const { path, add } of OVERRIDES) {
      if (add === true) removeAt(restored, path);
      else setAt(restored, path, at(TOKENS, path));
    }
    expect(restored).toEqual(TOKENS);
    expect(RESOLVED).not.toEqual(TOKENS);
  });

  it("names a reason and evidence on every override, and the files and lines of the evidence exist", () => {
    const GREP = "Grep of components/, app/ and src/ finds no use of the role.";
    for (const { path, reason, evidence } of OVERRIDES) {
      expect(reason.trim(), path).not.toBe("");
      const references = [...evidence.matchAll(/([\w./-]+\.(?:tsx?|css)):(\d+)(?:-(\d+))?/g)];
      expect(references.length > 0 || evidence === GREP, `${path}: evidence`).toBe(true);
      for (const [, file, from, to] of references) {
        expect(existsSync(join(ROOT, file as string)), `${path}: ${file}`).toBe(true);
        const lines = read(file as string).split("\n").length;
        expect(Number(to ?? from), `${path}: ${file} has ${lines} lines`).toBeLessThanOrEqual(lines);
      }
    }
  });
});

describe("the overridden values", () => {
  it("make the frame 430 wide, the focus ring 2 px and the list-title line 1.25", () => {
    expect(at(RESOLVED, "size.max-width.$value")).toEqual({ value: 430, unit: "px" });
    expect(at(RESOLVED, "stroke.focus.$value")).toEqual({ value: 2, unit: "px" });
    expect(at(RESOLVED, "typography.list-title.$value.lineHeight")).toBe(1.25);
    expect(at(RESOLVED, "typography.list-title.$value.fontSize")).toEqual({ value: 16, unit: "px" });
  });

  it("make the focus ring on filled pills the ink ring, by day and by night", () => {
    expect(at(RESOLVED, "color.day.focus-on-fill.$value")).toBe(at(RESOLVED, "color.day.focus.$value"));
    expect(at(RESOLVED, "color.night.focus-on-fill.$value")).toBe(at(RESOLVED, "color.night.focus.$value"));
  });

  it("make the leave sheet open exactly as it closes: 360 ms on the default curve", () => {
    const open = at(RESOLVED, "motion.transition.sheet-open.$value");
    expect(open).toEqual(at(RESOLVED, "motion.transition.sheet-close.$value"));
    expect(open).toEqual({ duration: "{motion.duration.t3}", delay: { value: 0, unit: "ms" }, timingFunction: "{motion.easing.ease}" });
    expect(at(TOKENS, "motion.duration.t3.$value")).toEqual({ value: 360, unit: "ms" });
    expect(at(TOKENS, "motion.easing.ease.$value")).toEqual([...EASE]);
  });

  it("keep the colours of the sky and give the four stops of one smooth gradient", () => {
    for (const theme of ["day", "night"]) {
      for (const [n, stop] of [["1", "0%"], ["2", "35%"], ["3", "62%"], ["4", "100%"]] as const) {
        expect(at(RESOLVED, `color.${theme}.sky-${n}.$value`)).toBe(at(TOKENS, `color.${theme}.sky-${n}.$value`));
        expect(at(RESOLVED, `color.${theme}.sky-${n}.$description`)).toContain(`stop at ${stop} of the screen height`);
      }
    }
  });
});

describe("the code shows what the overrides say", () => {
  const has = (file: string, text: string) => expect(read(file), `${file} has ${text}`).toContain(text);

  it("frame width, focus ring and the short-screen safe areas (app/globals.css)", () => {
    has("app/globals.css", "--app-max-width: 430px;");
    has("app/globals.css", "--focus-ring-width: 2px;");
    has("app/globals.css", "--focus-ring-offset: 2px;");
    has("app/globals.css", "outline: var(--focus-ring-width) solid var(--color-focus);");
    has("app/globals.css", "@media (max-height: 567px) {\n  :root {\n    --size-safe-top: var(--space-8);\n    --size-safe-bottom: var(--space-12);");
    expect(at(TOKENS, "space.8.$value")).toEqual({ value: 8, unit: "px" });
    expect(at(TOKENS, "space.12.$value")).toEqual({ value: 12, unit: "px" });
  });

  it("the sky gradient stops (SkyBackdrop)", () => {
    has(
      "components/SkyBackdrop.tsx",
      "linear-gradient(180deg, var(--color-sky-1) 0%, var(--color-sky-2) 35%, var(--color-sky-3) 62%, var(--color-sky-4) 100%)",
    );
  });

  it("the leave sheet's motion: 24 px, 360 ms, 140 ms reduced, no spring (LeaveDialog)", () => {
    const file = "components/play/LeaveDialog.tsx";
    has(file, "initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}");
    has(file, "exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}");
    has(file, "transition={{ duration: reduced ? 0.14 : 0.36, ease: EASE }}");
    has(file, "transition={{ duration: 0.36, ease: EASE }}");
    has(file, "rounded-(--radius-card) bg-(--color-surface-raised) p-(--space-20)");
    expect(read(file)).not.toMatch(/SPRING|spring/);
  });

  it("the title row, the tagline, the top zone and the detail lines (start flow, destination card)", () => {
    has("components/start/StartFlow.tsx", "m-0 flex h-[36px] flex-none items-center font-(family-name:--type-step-title-family)");
    has("components/start/StartFlow.tsx", "leading-(--type-tagline-line-height) text-(--color-ink)");
    has("components/start/StartFlow.tsx", "Top zone, 176 tall");
    expect(read("components/start/StartFlow.tsx")).not.toMatch(/step 7/i);
    has("components/DestinationCard.tsx", 'leading-[1.25] tracking-(--type-list-title-letter-spacing)');
    has("components/play/LeaveDialog.tsx", "leading-(--type-step-title-line-height)");
    has("components/play/PlayScreen.tsx", "leading-(--type-step-title-line-height)");
  });

  it("the values that have no token: the additive native entry (reference 5.0, 5.3, 5.4)", () => {
    expect(at(RESOLVED, "native")).toEqual({
      "sky-stops": [0, 0.35, 0.62, 1],
      sheet: { "offset-y": 24, "duration-reduced-ms": 140, "min-width": 320 },
      "safe-area-short": { "below-height": 568, top: 8, bottom: 12 },
      "step-title-row": 36,
      type: {
        "stub-stamp-size": 28,
        "new-best-size": 22,
        "missed-explanation-size": 15,
        "missed-answer-size": 17,
        "carrier-compact": { title: 14, label: 11 },
        "source-link-size": 13.5,
        "score-unit-size": 20,
        "timed-clock-size": 13,
        "stub-value": { size: 16, lineHeight: 1.27 },
        "continue-deck-line-height": 1.2,
      },
    });
    expect(at(TOKENS, "native")).toBeUndefined();
    has("components/play/LeaveDialog.tsx", "min-w-[320px]");
    has("components/Stamp.tsx", "text-[28px] font-(--type-stamp-weight)");
    has("components/ScoreBlock.tsx", "text-[22px] font-(--type-stamp-weight)");
    has("components/ScoreBlock.tsx", '<small className="text-[20px]');
    has("components/MissedCards.tsx", "text-[17px] font-(--type-emphasis-weight)");
    has("components/MissedCards.tsx", "text-[15px] font-(--type-body-weight)");
    has("components/FillInPass.tsx", "text-[14px] font-(--type-carrier-title-weight)");
    has("components/FillInPass.tsx", "text-[11px] font-(--type-carrier-label-weight)");
    has("components/BoardingPass.tsx", "text-[13.5px]");
    has("components/TimedPath.tsx", "text-[13px] tabular-nums");
    has("components/DestinationCard.tsx", "text-[16px] font-(--font-weight-mono-semibold) leading-[1.27]");
    has("components/start/ContinueLine.tsx", "leading-[1.2] tracking-(--type-emphasis-letter-spacing)");
  });

  it("the card's snap-back after every release (PlayScreen, useSwipe)", () => {
    has("components/play/PlayScreen.tsx", "transition-transform duration-(--duration-t3) ease-(--easing-spring) data-dragging:transition-none");
    has("components/play/useSwipe.ts", "delete element.dataset.dragging;\n    paint(element, 0);");
    expect(at(TOKENS, "motion.easing.spring.$value")).toEqual([0.34, 1.56, 0.64, 1]);
  });
});

// Every .ts, .tsx and .css file of the app, except the generated app/tokens.css.
function appSources(): { file: string; text: string }[] {
  return ["components", "app", "src"].flatMap((dir) =>
    readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
      .map((name) => `${dir}/${name}`)
      .filter((file) => /\.(tsx?|css)$/.test(file) && file !== "app/tokens.css")
      .map((file) => ({ file, text: read(file) })),
  );
}

describe("the tokens the overrides call unused", () => {
  const sources = appSources();
  const users = (pattern: RegExp) => sources.filter(({ text }) => pattern.test(text)).map(({ file }) => file);

  it("finds the files that use a token that is used (the scan itself works)", () => {
    expect(users(/--type-step-title-size/).length).toBeGreaterThan(2);
    expect(users(/--size-gutter(?![\w-])/).length).toBeGreaterThan(2);
  });

  it.each([
    ["size.sheet-overrun", /--size-sheet-overrun(?![\w-])/],
    ["size.sheet-bar", /--size-sheet-bar(?![\w-])/],
    ["size.grab", /--size-grab(?![\w-])/],
    ["size.list-row", /--size-list-row(?![\w-])/],
    ["size.radio", /--size-radio(?![\w-])/],
    ["stroke.radio", /--stroke-radio(?![\w-])/],
    ["color.*.focus-on-fill", /--color-focus-on-fill(?![\w-])/],
    ["typography.screen-title", /--type-screen-title-/],
    ["typography.body-small", /--type-body-small-/],
    ["typography.option-title", /--type-option-title-/],
    ["typography.section-code", /--type-section-code-/],
    ["typography.sheet-title", /--type-sheet-title-/],
  ])("%s is read by no source file", (_token, pattern) => {
    expect(users(pattern)).toEqual([]);
  });

  it("typography.list-title is read by the destination card alone, so its line height 1.25 is the whole truth", () => {
    expect(users(/--type-list-title-/)).toEqual(["components/DestinationCard.tsx"]);
  });
});

describe("the rows of reference 5.0 that tokens.json already states truthfully", () => {
  const description = (path: string) => at(TOKENS, `${path}.$description`) as string;

  it("the stamp sizes, the body and the carrier on the compact pass, the answer word and the source link", () => {
    expect(description("typography.stamp")).toContain("Stub stamp variant 28px");
    expect(description("typography.stamp")).toContain("New best is 22px");
    expect(description("typography.body")).toContain("Missed-card explanation is 15px");
    expect(description("typography.carrier-title")).toContain("Compact pass while it is being filled: 14px");
    expect(description("typography.carrier-label")).toContain("Compact pass: 11px");
    expect(description("typography.emphasis")).toContain("Missed-card answer word is 17px");
    expect(description("typography.mono-data-strong")).toContain("Source link is 13.5px");
  });

  it("the unused board motion", () => {
    expect(description("motion.duration.board")).toContain("Not used: the build unrolls an empty paper below the ready pass in 360ms");
    expect(description("motion.transition.pass-board")).toContain("Not used");
  });
});
