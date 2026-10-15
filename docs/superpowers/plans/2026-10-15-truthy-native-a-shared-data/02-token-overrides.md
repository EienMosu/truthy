### Task 2: The token overrides: `scripts/native-token-overrides.json` and `resolveTokens`

`design/system/tokens.json` is the source of the web's CSS, and it is stale in places: the frame is 390 wide there and 430 in the code, the sky is four hard bands there and one smooth gradient in the code, the leave sheet springs there and eases in the code, and several tokens describe things the app no longer draws. Reference 5.0 lists those places. This task turns that table into data and into a function. `scripts/native-token-overrides.json` is the hand-kept list (one entry per path: the value the code has, why, and where the code shows it). `resolveTokens(tokens, overrides)` in `scripts/native/tokens.ts` returns the tokens with every override applied, and fails loudly in two directions: an override whose path is no longer in the tokens (dangling), and an override whose value `tokens.json` now has itself (stale, so the entry can go). One entry is additive: the values the code uses that `tokens.json` has no token for at all (the sky stops, the leave sheet's offset and reduced timing, the short-screen safe areas, the size variants of reference 5.0) go under a new top-level key `native`, so the generators of plans B and C read every number from `resolved.json` and none from prose. Plans B and C generate `Tokens.swift` and `Tokens.kt` from the resolved file only, so a stale value cannot reach a native constant.

Two test files keep the list honest from the other side. One pins every entry to the code: the frame width, the focus ring, the sky stops, the leave sheet's motion and the rest are read from the component and CSS files, and every token the list calls unused is searched for in the sources. The other tests `resolveTokens` on a small fixture. Nothing in the app imports either file; the export of task 9 reads them.

Builds on: nothing from task 1 or later tasks. It reads `design/system/tokens.json` and the web code as they are on the branch. The new files are outside the native hygiene scopes of task 1; the repository-wide rules apply to them (no em dash, no local path, no e-mail-shaped string).

**Files:**
- Create: `scripts/native-token-overrides.json`, `scripts/native/tokens.ts`
- Test: create `tests/scripts/native/tokens.test.ts`, `tests/scripts/native/token-overrides.test.ts`

**Interfaces:**
- Consumes: nothing from an earlier task. The tests read `design/system/tokens.json`, `components/easing.ts` (`EASE`) and the component and CSS files named in the evidence of each entry.
- Produces (the README's names, exactly):

```ts
// scripts/native/tokens.ts
export interface Override { path: string; value: unknown; reason: string; evidence: string; add?: true } // add: the last key must not exist yet; its parent must
export function resolveTokens(tokens: unknown, overrides: readonly Override[]): unknown;
```

  - `scripts/native-token-overrides.json` is a JSON array of `Override`, keys in the order `path`, `value`, `reason`, `evidence` and, on the one additive entry, `add`; two-space indentation, a final newline. Task 9 copies it byte for byte to `native-data/tokens/overrides.json` and passes the parsed array to `resolveTokens` to write `native-data/tokens/resolved.json`.
  - `resolveTokens` returns a copy: its input is not changed, and no object of the result is shared with an override's `value`. The result keeps the key order of the input, so `JSON.stringify` of it is the same on every run.

**Rules:**

1. A path is dot separated keys of `tokens.json` and indices of its arrays, for example `size.max-width.$value` or `typography.list-title.$value.lineHeight`. Every segment must be an own key (or a valid index); inherited members such as `constructor` are not keys. The one key of `tokens.json` that contains a dot (`ch.truthy`, inside `$extensions`) cannot be addressed, and no override needs it.
2. An override replaces the whole value at its path. It may replace a `$value`, one field inside a composite `$value`, or a `$description`. An override with `"add": true` instead creates its last key, which must not exist yet, under a parent that must exist; the list has one such entry, `native` at the top level.
3. The errors, in the order they are checked (the whole list is checked before the first override is applied, then each override in list order):
   - `An override needs a path, a reason and evidence` (a missing or empty path);
   - `Override <path> needs a reason and evidence` (an empty or blank `reason` or `evidence`);
   - `Override <path> has no value` (no `value` key; `null` is a value);
   - `Override <path> is listed twice`;
   - `Override <path> overlaps <other>` (one path lies inside another's value, in either order, so the result would depend on the order of the list);
   - `Override <path> names a path that is not in the tokens (no "<key>")` (dangling, naming the first missing key; for an additive override, a missing parent);
   - `Override <path> adds a key that tokens.json already has` (an additive override whose key exists);
   - `Override <path> is stale: tokens.json already has that value` (deep equality, key order ignored; `"390"` is not `390`).
4. What an entry may claim is limited to what the code shows. Two kinds of rows of reference 5.0 get no replacing entry, and the tests say so:
   - `tokens.json` already states the code value in its own description (the stamp sizes 28 and 22, the body 15 in the missed cards, the compact carrier 14 and 11, the answer word 17, the source link 13.5, the unused board motion). The last test file pins those sentences, so a later edit of `tokens.json` that drops one is noticed. Their numbers also go into the additive entry `native.type`, so a generator reads them as data.
   - there is no token to carry the value at all (the score unit 20, the Timed clock 13, the card stub value 16 / 1.27, the continue line's 1.2), nor for the sky stops 0 / 35 / 62 / 100, the leave sheet's offset 24, reduced 140 ms and minimum width 320, the short-screen safe areas 8 / 12 below 568, and the 36 px step-title row. These are the additive entry `native`, pinned to the code by the tests.
5. Entries the tests keep honest: a token the list calls unused must be read by no file under `components/`, `app/` or `src/` (generated `app/tokens.css` excluded). `typography.list-title` is overridden to line height 1.25 because its only reader is the destination card, which sets 1.25 itself (reference 5.3 notes that the token's 1.2 is never applied); the test fails if another file starts to read the role.
6. Keeping the list: when the code changes a value that `tokens.json` states, add an entry with the code line as evidence. When `tokens.json` is corrected, `resolveTokens` fails with the stale message; delete the entry then, and remove its path from `ROWS` in the second test file.

**Steps:**

- [ ] **Step 1: Write the tests of `resolveTokens`.**

`tests/scripts/native/tokens.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { type Override, resolveTokens } from "@/scripts/native/tokens";

// A small tokens file in the DTCG shape of design/system/tokens.json: groups, tokens with $value and
// $description, a composite value, an array value, and the one key that contains a dot ("ch.truthy").
function fixture() {
  return {
    $description: "fixture",
    size: {
      "max-width": { $type: "dimension", $value: { value: 390, unit: "px" }, $description: "The design viewport is 390." },
      gutter: { $type: "dimension", $value: { value: 16, unit: "px" }, $description: "Side gutter." },
    },
    motion: {
      curve: {
        $type: "cubicBezier",
        $value: [0.34, 1.56, 0.64, 1],
        $extensions: { "ch.truthy": { note: "kept" } },
      },
      transition: {
        "sheet-open": {
          $type: "transition",
          $value: {
            duration: "{motion.duration.stamp}",
            delay: { value: 0, unit: "ms" },
            timingFunction: "{motion.easing.spring}",
          },
        },
      },
    },
  };
}

function override(path: string, value: unknown, extra: Partial<Override> = {}): Override {
  return { path, value, reason: "the code wins", evidence: "app/globals.css:48", ...extra };
}

describe("resolveTokens: applying", () => {
  it("replaces the value at a dot path and leaves every other token as it was", () => {
    const resolved = resolveTokens(fixture(), [override("size.max-width.$value", { value: 430, unit: "px" })]);
    const expected = fixture();
    expected.size["max-width"].$value = { value: 430, unit: "px" };
    expect(resolved).toEqual(expected);
  });

  it("replaces a description, a string inside a composite value and one item of an array", () => {
    const resolved = resolveTokens(fixture(), [
      override("size.max-width.$description", "The frame is 430 wide."),
      override("motion.transition.sheet-open.$value.timingFunction", "{motion.easing.ease}"),
      override("motion.curve.$value.1", 1.5),
    ]) as ReturnType<typeof fixture>;
    expect(resolved.size["max-width"].$description).toBe("The frame is 430 wide.");
    expect(resolved.motion.transition["sheet-open"].$value.timingFunction).toBe("{motion.easing.ease}");
    expect(resolved.motion.curve.$value).toEqual([0.34, 1.5, 0.64, 1]);
  });

  it("returns the tokens unchanged (as a copy) when there are no overrides", () => {
    const tokens = fixture();
    const resolved = resolveTokens(tokens, []);
    expect(resolved).toEqual(tokens);
    expect(resolved).not.toBe(tokens);
  });

  it("does not change its input, and shares no object with the override values", () => {
    const tokens = fixture();
    const value = { value: 430, unit: "px" };
    const resolved = resolveTokens(tokens, [override("size.max-width.$value", value)]) as ReturnType<typeof fixture>;
    expect(tokens).toEqual(fixture());
    value.value = 1;
    expect(resolved.size["max-width"].$value).toEqual({ value: 430, unit: "px" });
  });

  it("gives the same result for the same input, twice", () => {
    const list = [override("size.max-width.$value", { value: 430, unit: "px" }), override("size.gutter.$description", "Gutter.")];
    expect(JSON.stringify(resolveTokens(fixture(), list))).toBe(JSON.stringify(resolveTokens(fixture(), list)));
  });
});

describe("resolveTokens: a dangling override", () => {
  it("throws for a token that is not in the file, naming the path and the missing key", () => {
    expect(() => resolveTokens(fixture(), [override("size.gone.$value", 1)])).toThrow(
      'Override size.gone.$value names a path that is not in the tokens (no "gone")',
    );
  });

  it("throws for a missing field of an existing token", () => {
    expect(() => resolveTokens(fixture(), [override("size.max-width.$extensions", 1)])).toThrow(
      'Override size.max-width.$extensions names a path that is not in the tokens (no "$extensions")',
    );
  });

  it("throws for a path that runs into a value, an empty segment or an array index past the end", () => {
    expect(() => resolveTokens(fixture(), [override("size.max-width.$value.value.deeper", 1)])).toThrow('(no "deeper")');
    expect(() => resolveTokens(fixture(), [override("size..gutter", 1)])).toThrow('(no "")');
    expect(() => resolveTokens(fixture(), [override("motion.curve.$value.4", 1)])).toThrow('(no "4")');
  });

  it("does not find the members every object inherits", () => {
    expect(() => resolveTokens(fixture(), [override("size.constructor", 1)])).toThrow('(no "constructor")');
    expect(() => resolveTokens(fixture(), [override("size.__proto__.x", 1)])).toThrow('(no "__proto__")');
  });

  it("throws for an input that is not an object", () => {
    expect(() => resolveTokens(null, [override("size", 1)])).toThrow('(no "size")');
    expect(() => resolveTokens("tokens", [override("size", 1)])).toThrow('(no "size")');
  });
});

describe("resolveTokens: a stale override", () => {
  it("throws when the token already has the override's value", () => {
    expect(() => resolveTokens(fixture(), [override("size.max-width.$value", { value: 390, unit: "px" })])).toThrow(
      "Override size.max-width.$value is stale: tokens.json already has that value",
    );
    expect(() => resolveTokens(fixture(), [override("size.gutter.$description", "Side gutter.")])).toThrow("is stale");
  });

  it("compares objects and arrays by content, not by key order", () => {
    expect(() => resolveTokens(fixture(), [override("size.max-width.$value", { unit: "px", value: 390 })])).toThrow("is stale");
    expect(() => resolveTokens(fixture(), [override("motion.curve.$value", [0.34, 1.56, 0.64, 1])])).toThrow("is stale");
  });

  it("does not call a value stale because it only looks alike", () => {
    expect(() => resolveTokens(fixture(), [override("size.max-width.$value", { value: "390", unit: "px" })])).not.toThrow();
    expect(() => resolveTokens(fixture(), [override("motion.curve.$value", [0.34, 1.56, 0.64])])).not.toThrow();
  });
});

describe("resolveTokens: a malformed list", () => {
  it("needs a reason and evidence on every override", () => {
    expect(() => resolveTokens(fixture(), [override("size.gutter.$description", "Gutter.", { reason: " " })])).toThrow(
      "Override size.gutter.$description needs a reason and evidence",
    );
    expect(() => resolveTokens(fixture(), [override("size.gutter.$description", "Gutter.", { evidence: "" })])).toThrow(
      "needs a reason and evidence",
    );
    const noPath = { value: 1, reason: "r", evidence: "e" } as unknown as Override;
    expect(() => resolveTokens(fixture(), [noPath])).toThrow("An override needs a path, a reason and evidence");
  });

  it("needs a value, which may be any JSON value", () => {
    const noValue = { path: "size.gutter.$description", reason: "r", evidence: "e" } as unknown as Override;
    expect(() => resolveTokens(fixture(), [noValue])).toThrow("Override size.gutter.$description has no value");
    expect(() => resolveTokens(fixture(), [override("size.gutter.$description", null)])).not.toThrow();
  });

  it("refuses a path listed twice", () => {
    expect(() =>
      resolveTokens(fixture(), [override("size.gutter.$description", "A."), override("size.gutter.$description", "B.")]),
    ).toThrow("Override size.gutter.$description is listed twice");
  });

  it("refuses a path that lies inside another override's value, in either order", () => {
    const inner = override("size.max-width.$value.value", 430);
    const outer = override("size.max-width.$value", { value: 431, unit: "px" });
    expect(() => resolveTokens(fixture(), [outer, inner])).toThrow("Override size.max-width.$value.value overlaps size.max-width.$value");
    expect(() => resolveTokens(fixture(), [inner, outer])).toThrow("Override size.max-width.$value overlaps size.max-width.$value.value");
  });

  it("allows two paths below the same value that do not contain each other", () => {
    expect(() =>
      resolveTokens(fixture(), [override("size.max-width.$value.value", 430), override("size.max-width.$value.unit", "pt")]),
    ).not.toThrow();
  });

  it("throws for a bad override anywhere in the list", () => {
    expect(() => resolveTokens(fixture(), [override("size.gutter.$description", "Gutter."), override("size.gone", 1)])).toThrow("no \"gone\"");
  });
});

describe("resolveTokens: an additive override", () => {
  it("adds a key that the tokens do not have, at the top level or inside a group, after the existing keys", () => {
    const resolved = resolveTokens(fixture(), [
      override("native", { "sky-stops": [0, 0.35, 0.62, 1] }, { add: true }),
      override("size.sheet-min-width", 320, { add: true }),
    ]) as Record<string, unknown> & ReturnType<typeof fixture>;
    expect(resolved.native).toEqual({ "sky-stops": [0, 0.35, 0.62, 1] });
    expect(Object.keys(resolved)).toEqual(["$description", "size", "motion", "native"]);
    expect((resolved.size as Record<string, unknown>)["sheet-min-width"]).toBe(320);
  });

  it("refuses to add a key that the tokens already have", () => {
    expect(() => resolveTokens(fixture(), [override("size.gutter", 1, { add: true })])).toThrow(
      "Override size.gutter adds a key that tokens.json already has",
    );
  });

  it("refuses to add a key under a parent that is missing", () => {
    expect(() => resolveTokens(fixture(), [override("size.gone.x", 1, { add: true })])).toThrow(
      'Override size.gone.x names a path that is not in the tokens (no "gone")',
    );
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/tokens.test.ts
```

Expected: the file fails to load, `Error: Cannot find package '@/scripts/native/tokens' imported from <root>/tests/scripts/native/tokens.test.ts`, then `Test Files  1 failed (1)` and `Tests  no tests`.

- [ ] **Step 3: Write `resolveTokens`.**

`scripts/native/tokens.ts`:

```ts
// Applies the hand-kept native token overrides (scripts/native-token-overrides.json, from reference 5.0) to
// design/system/tokens.json. tokens.json carries values and descriptions the code has since replaced; the
// native generators read the result, never tokens.json itself, so a stale value cannot reach a Swift or
// Kotlin constant. The function fails loudly in both directions: an override whose path is no longer in the
// tokens (dangling) and an override whose value tokens.json now has itself (stale, so the override can go).
// Pure: no file system, no clock.

/** One place where the code wins over tokens.json. */
export interface Override {
  /** Dot path into tokens.json, for example "size.max-width.$value". Every segment must exist. */
  path: string;
  /** The value that replaces the one at the path: any JSON value. */
  value: unknown;
  /** Why the code differs from tokens.json. */
  reason: string;
  /** Where the code shows it: repository-relative files with lines. */
  evidence: string;
  /** true: the last key of the path is new (tokens.json has no token for the value); its parent must exist. */
  add?: true;
}

type Container = Record<string, unknown> | unknown[];

function isContainer(node: unknown): node is Container {
  return typeof node === "object" && node !== null;
}

// An own key of an object, or an index inside an array. Inherited members ("constructor", "__proto__") are not keys.
function holds(node: Container, key: string): boolean {
  if (Array.isArray(node)) return /^(0|[1-9]\d*)$/.test(key) && Number(key) < node.length;
  return Object.hasOwn(node, key);
}

function read(node: Container, key: string): unknown {
  return (node as Record<string, unknown>)[key];
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!isContainer(a) || !isContainer(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => holds(b, key) && sameValue(read(a, key), read(b, key)));
}

function dangling(path: string, key: string): never {
  throw new Error(`Override ${path} names a path that is not in the tokens (no "${key}")`);
}

// The shape of each override and the relations between them, checked before any is applied.
function check(overrides: readonly Override[]): void {
  const seen: string[] = [];
  for (const item of overrides) {
    const path: unknown = item.path;
    if (typeof path !== "string" || path === "") throw new Error("An override needs a path, a reason and evidence");
    if (!nonEmpty(item.reason) || !nonEmpty(item.evidence)) throw new Error(`Override ${path} needs a reason and evidence`);
    if (!("value" in item)) throw new Error(`Override ${path} has no value`);
    for (const other of seen) {
      if (other === path) throw new Error(`Override ${path} is listed twice`);
      if (path.startsWith(`${other}.`) || other.startsWith(`${path}.`)) throw new Error(`Override ${path} overlaps ${other}`);
    }
    seen.push(path);
  }
}

function nonEmpty(text: unknown): boolean {
  return typeof text === "string" && text.trim() !== "";
}

/**
 * A copy of `tokens` with every override applied. Throws when the list is malformed, when a path is not in the
 * tokens, when an override's value equals what the tokens already hold at its path, or when an additive override
 * names a key that exists. Does not change `tokens`.
 */
export function resolveTokens(tokens: unknown, overrides: readonly Override[]): unknown {
  check(overrides);
  const resolved = structuredClone(tokens);
  for (const item of overrides) {
    const { path, value } = item;
    const segments = path.split(".");
    const last = segments.pop() as string;
    let node: unknown = resolved;
    for (const key of segments) {
      if (!isContainer(node) || !holds(node, key)) dangling(path, key);
      node = read(node, key);
    }
    if (!isContainer(node)) dangling(path, last);
    if (item.add === true) {
      if (holds(node, last)) throw new Error(`Override ${path} adds a key that tokens.json already has`);
    } else {
      if (!holds(node, last)) dangling(path, last);
      if (sameValue(read(node, last), value)) throw new Error(`Override ${path} is stale: tokens.json already has that value`);
    }
    (node as Record<string, unknown>)[last] = structuredClone(value);
  }
  return resolved;
}
```

- [ ] **Step 4: Run them green.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/tokens.test.ts
```

Expected: `Test Files  1 passed (1)`, `Tests  22 passed (22)`.

- [ ] **Step 5: Write the tests of the list.**

They read the real `design/system/tokens.json` and the real list, so they fail until step 7 writes the list. `ROWS` is the pin of what the list holds: every row of reference 5.0 that `tokens.json` states wrongly, by the token paths it overrides, and the additive `native` entry (39 paths in all).

`tests/scripts/native/token-overrides.test.ts`:

```ts
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
```

- [ ] **Step 6: Run them and watch them fail.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native/token-overrides.test.ts
```

Expected: the file fails to load, `Error: ENOENT: no such file or directory, open '<root>/scripts/native-token-overrides.json'`, then `Test Files  1 failed (1)` and `Tests  no tests`.

- [ ] **Step 7: Write the list.**

39 entries: 38 in the order of the rows of reference 5.0, then the additive `native` entry. The values and sentences come from the code as it is on the branch (the line numbers in the evidence are the ones the tests check against the files).

`scripts/native-token-overrides.json`:

```json
[
  {
    "path": "size.max-width.$value",
    "value": {
      "value": 430,
      "unit": "px"
    },
    "reason": "The app frame is a phone column up to 430 wide; 390 is only the design viewport of the mockups.",
    "evidence": "app/globals.css:43-48"
  },
  {
    "path": "size.max-width.$description",
    "value": "The frame of every screen is up to 430 wide (--app-max-width in app/globals.css). The design viewport of the mockups is 390 x 844.",
    "reason": "tokens.json describes the frame as 390 wide.",
    "evidence": "app/globals.css:43-48"
  },
  {
    "path": "color.day.sky-1.$description",
    "value": "Sky gradient stop at 0% of the screen height. The sky is one smooth vertical gradient with stops at 0, 35, 62 and 100%; the colours are unchanged.",
    "reason": "The sky is one smooth gradient, not four hard bands.",
    "evidence": "components/SkyBackdrop.tsx:15-17"
  },
  {
    "path": "color.day.sky-2.$description",
    "value": "Sky gradient stop at 35% of the screen height. The sky is one smooth vertical gradient with stops at 0, 35, 62 and 100%; the colours are unchanged.",
    "reason": "The sky is one smooth gradient, not four hard bands.",
    "evidence": "components/SkyBackdrop.tsx:15-17"
  },
  {
    "path": "color.day.sky-3.$description",
    "value": "Sky gradient stop at 62% of the screen height. The sky is one smooth vertical gradient with stops at 0, 35, 62 and 100%; the colours are unchanged.",
    "reason": "The sky is one smooth gradient, not four hard bands.",
    "evidence": "components/SkyBackdrop.tsx:15-17"
  },
  {
    "path": "color.day.sky-4.$description",
    "value": "Sky gradient stop at 100% of the screen height. The sky is one smooth vertical gradient with stops at 0, 35, 62 and 100%; the colours are unchanged.",
    "reason": "The sky is one smooth gradient, not four hard bands.",
    "evidence": "components/SkyBackdrop.tsx:15-17"
  },
  {
    "path": "color.night.sky-1.$description",
    "value": "Sky gradient stop at 0% of the screen height. The sky is one smooth vertical gradient with stops at 0, 35, 62 and 100%; the colours are unchanged.",
    "reason": "The sky is one smooth gradient, not four hard bands.",
    "evidence": "components/SkyBackdrop.tsx:15-17"
  },
  {
    "path": "color.night.sky-2.$description",
    "value": "Sky gradient stop at 35% of the screen height. The sky is one smooth vertical gradient with stops at 0, 35, 62 and 100%; the colours are unchanged.",
    "reason": "The sky is one smooth gradient, not four hard bands.",
    "evidence": "components/SkyBackdrop.tsx:15-17"
  },
  {
    "path": "color.night.sky-3.$description",
    "value": "Sky gradient stop at 62% of the screen height. The sky is one smooth vertical gradient with stops at 0, 35, 62 and 100%; the colours are unchanged.",
    "reason": "The sky is one smooth gradient, not four hard bands.",
    "evidence": "components/SkyBackdrop.tsx:15-17"
  },
  {
    "path": "color.night.sky-4.$description",
    "value": "Sky gradient stop at 100% of the screen height. The sky is one smooth vertical gradient with stops at 0, 35, 62 and 100%; the colours are unchanged.",
    "reason": "The sky is one smooth gradient, not four hard bands.",
    "evidence": "components/SkyBackdrop.tsx:15-17"
  },
  {
    "path": "motion.transition.sheet-open.$value",
    "value": {
      "duration": "{motion.duration.t3}",
      "delay": {
        "value": 0,
        "unit": "ms"
      },
      "timingFunction": "{motion.easing.ease}"
    },
    "reason": "The leave sheet moves 24 px and fades in 360 ms with the default curve; it does not spring.",
    "evidence": "components/play/LeaveDialog.tsx:143-146"
  },
  {
    "path": "motion.transition.sheet-open.$description",
    "value": "Leave sheet in: 360 ms ease, y +24 to 0 and opacity 0 to 1. With reduced motion only the opacity moves, in 140 ms. The scrim fades in over 360 ms ease.",
    "reason": "tokens.json describes a spring from translateY(104%).",
    "evidence": "components/play/LeaveDialog.tsx:124-131, 143-146"
  },
  {
    "path": "motion.transition.sheet-close.$description",
    "value": "Leave sheet out: 360 ms ease, y 0 to +24 and opacity to 0. With reduced motion only the opacity moves, in 140 ms. The scrim fades out over 360 ms ease.",
    "reason": "tokens.json describes a slide back to translateY(104%).",
    "evidence": "components/play/LeaveDialog.tsx:124-131, 143-146"
  },
  {
    "path": "motion.spring.land.$description",
    "value": "Stamp landing (delay 380 in game screens). The leave sheet uses no spring.",
    "reason": "tokens.json says the sheet rises on this spring.",
    "evidence": "components/play/LeaveDialog.tsx:143-146"
  },
  {
    "path": "size.sheet-overrun.$description",
    "value": "Not used by the app: the leave sheet is a floating card (padding 20, radius 16, inset by the gutter), not a bottom sheet. How far the sheet extends below the screen edge so spring overshoot never shows a gap.",
    "reason": "The token describes a bottom sheet the app does not have.",
    "evidence": "components/play/LeaveDialog.tsx:136-142"
  },
  {
    "path": "size.sheet-bar.$description",
    "value": "Not used by the app: the leave sheet is a floating card (padding 20, radius 16, inset by the gutter), not a bottom sheet. Sheet title bar height.",
    "reason": "The token describes a bottom sheet the app does not have.",
    "evidence": "components/play/LeaveDialog.tsx:136-142"
  },
  {
    "path": "size.grab.$description",
    "value": "Not used by the app: the leave sheet is a floating card (padding 20, radius 16, inset by the gutter), not a bottom sheet. Grab bar width (height 4).",
    "reason": "The token describes a bottom sheet the app does not have.",
    "evidence": "components/play/LeaveDialog.tsx:136-142"
  },
  {
    "path": "size.list-row.$description",
    "value": "Not used by the app: the leave sheet is a floating card (padding 20, radius 16, inset by the gutter), not a bottom sheet. Section row minimum height in the sheet.",
    "reason": "The token describes a bottom sheet the app does not have.",
    "evidence": "components/play/LeaveDialog.tsx:136-142"
  },
  {
    "path": "size.radio.$description",
    "value": "Not used by the app. Radio mark diameter in option rows.",
    "reason": "No component reads this token.",
    "evidence": "components/play/LeaveDialog.tsx:136-142"
  },
  {
    "path": "stroke.radio.$description",
    "value": "Not used by the app. Radio ring.",
    "reason": "No component reads this token.",
    "evidence": "components/play/LeaveDialog.tsx:136-142"
  },
  {
    "path": "stroke.focus.$value",
    "value": {
      "value": 2,
      "unit": "px"
    },
    "reason": "The focus ring is 2 px wide with a 2 px offset.",
    "evidence": "app/globals.css:36-48, 113-116"
  },
  {
    "path": "stroke.focus.$description",
    "value": "Focus ring width: 2px with a 2px offset (--focus-ring-width and --focus-ring-offset in app/globals.css), inset by 2px inside the fill-in pass fields and the game's ticket. Web only.",
    "reason": "tokens.json keeps the 3px of the approved screens for the record.",
    "evidence": "app/globals.css:36-48, 113-116"
  },
  {
    "path": "color.day.focus-on-fill.$value",
    "value": "{color.day.ink}",
    "reason": "The ring on filled pills is ink too; the amber ring fails the 3:1 contrast against the light sky.",
    "evidence": "app/globals.css:36-48, 113-116"
  },
  {
    "path": "color.day.focus-on-fill.$description",
    "value": "Focus ring colour on True, False and ink pills: the same ink ring as everywhere (equal to color.focus), not the amber ring of the approved screens. Web only.",
    "reason": "tokens.json keeps the amber ring of the approved screens for the record.",
    "evidence": "app/globals.css:36-48, 113-116"
  },
  {
    "path": "color.night.focus-on-fill.$value",
    "value": "{color.night.ink}",
    "reason": "The ring on filled pills is ink too; the amber ring fails the 3:1 contrast against the light sky.",
    "evidence": "app/globals.css:36-48, 113-116"
  },
  {
    "path": "color.night.focus-on-fill.$description",
    "value": "Focus ring colour on True, False and ink pills: the same ink ring as everywhere (equal to color.focus), not the amber ring of the approved screens. Web only.",
    "reason": "tokens.json keeps the amber ring of the approved screens for the record.",
    "evidence": "app/globals.css:36-48, 113-116"
  },
  {
    "path": "typography.tagline.$description",
    "value": "One description line under the logo; colour ink (also the line under the mode name on step 6).",
    "reason": "The tagline is drawn in ink, not ink-muted.",
    "evidence": "components/start/StartFlow.tsx:372-375, 983"
  },
  {
    "path": "typography.step-title.$description",
    "value": "The one question of a start-flow step, in a 36px row with the text centred vertically (the line height does not apply there). Leave round? and This deck didn't load keep the line height 1.27.",
    "reason": "Start-flow titles are a 36 px row; only two other titles use the line height.",
    "evidence": "components/start/StartFlow.tsx:369-371, components/play/LeaveDialog.tsx:151, components/play/PlayScreen.tsx:377"
  },
  {
    "path": "typography.list-title.$value.lineHeight",
    "value": 1.25,
    "reason": "Its only user, the detail lines of a destination card, sets the line height 1.25; the token's 1.2 is never applied.",
    "evidence": "components/DestinationCard.tsx:94-96"
  },
  {
    "path": "typography.screen-title.$description",
    "value": "Not used by the app. Header title beside a round button.",
    "reason": "The role is defined but no component draws it.",
    "evidence": "Grep of components/, app/ and src/ finds no use of the role."
  },
  {
    "path": "typography.body-small.$description",
    "value": "Not used by the app. One-line description under an option name; colour ink-muted.",
    "reason": "The role is defined but no component draws it.",
    "evidence": "Grep of components/, app/ and src/ finds no use of the role."
  },
  {
    "path": "typography.option-title.$description",
    "value": "Not used by the app. Class name in an option row.",
    "reason": "The role is defined but no component draws it.",
    "evidence": "Grep of components/, app/ and src/ finds no use of the role."
  },
  {
    "path": "typography.section-code.$description",
    "value": "Not used by the app. Code at the start of a section row in the sheet.",
    "reason": "The role is defined but no component draws it.",
    "evidence": "Grep of components/, app/ and src/ finds no use of the role."
  },
  {
    "path": "typography.sheet-title.$description",
    "value": "Not used by the app. Sheet title (\"New boarding pass\"), colour ink.",
    "reason": "The role is defined but no component draws it.",
    "evidence": "Grep of components/, app/ and src/ finds no use of the role."
  },
  {
    "path": "size.safe-top.$description",
    "value": "#app top padding: 52, but 8 on a screen under 568 tall (--size-safe-top in app/globals.css). The contract keeps the top 50px free of interactive content on a full-height screen.",
    "reason": "tokens.json knows only the full-height value.",
    "evidence": "app/globals.css:51-61"
  },
  {
    "path": "size.safe-bottom.$description",
    "value": "#app bottom padding: 34, but 12 on a screen under 568 tall (--size-safe-bottom in app/globals.css). The contract keeps the bottom 30px free on a full-height screen.",
    "reason": "tokens.json knows only the full-height value.",
    "evidence": "app/globals.css:51-61"
  },
  {
    "path": "size.start-top-zone.$description",
    "value": "Top zone of the start flow: logo and tagline on step 1; Back pill + fill-in pass on steps 2 to 6. There is no step 7: Start round hands over to Play.",
    "reason": "tokens.json mentions a step 7 that does not exist.",
    "evidence": "components/start/StartFlow.tsx:772-774"
  },
  {
    "path": "motion.spring.snap.$description",
    "value": "Card snap-back after every release, a committed swipe included: a CSS transition on transform, 360 ms with cubic-bezier(.34,1.56,.64,1); instant with reduced motion.",
    "reason": "tokens.json describes a snap-back after a short drag only.",
    "evidence": "components/play/PlayScreen.tsx:755, components/play/useSwipe.ts:56-62, app/globals.css:118-130"
  },
  {
    "path": "native",
    "value": {
      "sky-stops": [
        0,
        0.35,
        0.62,
        1
      ],
      "sheet": {
        "offset-y": 24,
        "duration-reduced-ms": 140,
        "min-width": 320
      },
      "safe-area-short": {
        "below-height": 568,
        "top": 8,
        "bottom": 12
      },
      "step-title-row": 36,
      "type": {
        "stub-stamp-size": 28,
        "new-best-size": 22,
        "missed-explanation-size": 15,
        "missed-answer-size": 17,
        "carrier-compact": {
          "title": 14,
          "label": 11
        },
        "source-link-size": 13.5,
        "score-unit-size": 20,
        "timed-clock-size": 13,
        "stub-value": {
          "size": 16,
          "lineHeight": 1.27
        },
        "continue-deck-line-height": 1.2
      }
    },
    "reason": "Values the code uses that tokens.json has no token for (reference 5.0, 5.3, 5.4); the native generators read them here instead of hard-coding them.",
    "evidence": "components/SkyBackdrop.tsx:15-17, components/play/LeaveDialog.tsx:136-146, app/globals.css:51-61, components/start/StartFlow.tsx:369-371, components/Stamp.tsx:66, components/ScoreBlock.tsx:43, 115, components/MissedCards.tsx:74-78, components/FillInPass.tsx:106-109, components/BoardingPass.tsx:490, components/TimedPath.tsx:56, components/DestinationCard.tsx:100, components/start/ContinueLine.tsx:69",
    "add": true
  }
]
```

- [ ] **Step 8: Run both files green.**

```bash
npx -y pnpm@10.34.0 vitest run tests/scripts/native
```

Expected: `Test Files  2 passed (2)`, `Tests  53 passed (53)` (tokens 22, token-overrides 31).

- [ ] **Step 9: Check that each side of the list can fail (nothing here is committed).**

The first mutation makes `tokens.json` agree with an override, which must be reported as stale. The second makes the code disagree with an override, which must fail the code pin. Each edit is undone with `git checkout`.

```bash
node -e 'const fs=require("fs");const p="design/system/tokens.json";const s=fs.readFileSync(p,"utf8");const i=s.indexOf("\"max-width\"");const j=s.indexOf("\"value\": 390",i);fs.writeFileSync(p,s.slice(0,j)+"\"value\": 430"+s.slice(j+12))'
npx -y pnpm@10.34.0 vitest run tests/scripts/native/token-overrides.test.ts
git checkout -- design/system/tokens.json

node -e 'const fs=require("fs");const p="app/globals.css";fs.writeFileSync(p,fs.readFileSync(p,"utf8").replace("--app-max-width: 430px;","--app-max-width: 390px;"))'
npx -y pnpm@10.34.0 vitest run tests/scripts/native/token-overrides.test.ts
git checkout -- app/globals.css
git status --short
```

Expected, first run: `Error: Override size.max-width.$value is stale: tokens.json already has that value`, `Test Files  1 failed (1)`. Second run: `FAIL  tests/scripts/native/token-overrides.test.ts > the code shows what the overrides say > frame width, focus ring and the short-screen safe areas (app/globals.css)`, `AssertionError: app/globals.css has --app-max-width: 430px;: expected ... to contain '--app-max-width: 430px;'`, `Tests  1 failed | 30 passed (31)`. After the two `git checkout` lines, `git status --short` prints exactly `?? scripts/native-token-overrides.json`, `?? scripts/native/` and `?? tests/scripts/native/` (git collapses the two new folders).

- [ ] **Step 10: Stage the files and run the gates.**

`tests/repo-hygiene.test.ts` scans the tracked files, so the new files are staged first for it to see them.

```bash
git add scripts/native-token-overrides.json scripts/native/tokens.ts tests/scripts/native/tokens.test.ts tests/scripts/native/token-overrides.test.ts
npx -y pnpm@10.34.0 typecheck
npx -y pnpm@10.34.0 vitest run tests/repo-hygiene.test.ts
npx -y pnpm@10.34.0 test
```

Expected: `tsc --noEmit` prints nothing and exits 0; the hygiene test passes with `Tests  20 passed (20)` (task 1 adds no case to that file); `pnpm test` ends with `Test Files  153 passed (153)` and `Tests  3197 passed (3197)`: task 1's 151 and 3144 plus this task's 2 files and 53 tests.

- [ ] **Step 11: Commit.**

```bash
git commit -m "feat: keep the native token overrides and apply them to the design tokens"
```

**Tried:** in a throwaway worktree at the tip of the design commit, `tokens.ts`, the list and both test files exactly as above: step 2 and step 6 failed as stated, step 4 gave `19 passed (19)`, step 8 gave `49 passed (49)`; both mutations of step 9 failed as stated and were undone; `pnpm typecheck` exit 0; the hygiene test green with the files staged; `pnpm test` gave `152 passed (152)` files and `3156 passed (3156)` tests. The review then added the additive `native` entry and its four tests; in a scratch copy of the tree (no git), step 4 gave `22 passed (22)`, step 8 `53 passed (53)`, the list equals `JSON.stringify(list, null, 2)` plus a newline, and both mutations of step 9 failed as stated (`1 failed | 30 passed (31)` for the second). The totals of step 10 are computed from the counts, not measured.
