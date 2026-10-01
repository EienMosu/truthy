### Task 2: Design tokens to CSS

Turn `design/system/tokens.json` (W3C Design Tokens, DTCG 2025.10) into `app/tokens.css`: one `:root` block of CSS custom properties with the day values, generated before every `pnpm dev` and `pnpm build` and imported by `app/globals.css`. The function is pure and is tested with small inline token objects, so the design reviewer can still change individual values in `tokens.json` without breaking a test. One test runs the real file and pins the variable names that tasks 9 to 12 are written against (names only, never values).

Every command runs from the repository root. Task 1 is done: the `@/` alias works in Vitest and `tsx`, `.gitignore` already lists `app/tokens.css`, and `app/globals.css` holds the Tailwind header and a placeholder `:root`.

**Files:**
- Create: `src/tokens/build.ts`, `scripts/build-tokens.ts`
- Modify: `package.json` (three script lines: `predev`, `prebuild`, `build:tokens`), `app/globals.css` (the tokens import), `README.md` (one row in the scripts table)
- Generated, not committed: `app/tokens.css` (already in `.gitignore`)
- Test: `tests/tokens/build.test.ts`

**Interfaces:**
- Consumes:
  - `design/system/tokens.json` (moved in by task 1). Groups read: `color.day`, `font.family`, `font.weight`, `typography`, `space`, `size`, `radius`, `stroke`, `opacity`, `elevation.day`, `motion.duration`, `motion.easing`, `motion.spring`, `motion.transition`, `motion.gesture`. Groups ignored in step 1: `color.primitive` (only reached through references), `color.night`, `elevation.night`.
  - The `@/` alias and `tsx` 4.23.15 from task 1 (`node_modules/tsx/dist/cli.mjs` is used by the script tests).
- Produces:
  - `src/tokens/build.ts`:
    - `export function tokensToCss(tokens: unknown): string` returns the full text of `app/tokens.css`. Throws `TokenError` for anything it cannot turn into CSS; the message starts with `Token <dotted path>` or names the missing group.
    - `export class TokenError extends Error` (`name === "TokenError"`).
    - `export const NEXT_FONT_VARIABLES: Readonly<Record<string, string>>` = `{ sans: "--font-overpass", mono: "--font-overpass-mono" }`. Task 9 must give `next/font/google` exactly these `variable` names (`Overpass({ variable: "--font-overpass", ... })`, `Overpass_Mono({ variable: "--font-overpass-mono", ... })`).
  - `scripts/build-tokens.ts`: `tsx scripts/build-tokens.ts [source.json] [target.css]`, defaults `design/system/tokens.json` and `app/tokens.css`. Prints `Wrote <target> (<n> variables)`. On any error prints `build:tokens failed for <source>: <message>` to stderr, exits 1 and leaves the target untouched.
  - Package scripts: `"build:tokens": "tsx scripts/build-tokens.ts"`, `"prebuild": "pnpm build:tokens"`, `"predev": "pnpm build:tokens"`. Task 3 changes both `prebuild` and `predev` to `"pnpm build:tokens && pnpm build:decks"`.
  - The CSS variables listed under "CSS variables produced" at the end of this task (324 with today's tokens.json).

Decisions made once, here:
- Prefix per group: `color.day` to `--color-`, `font.family` to `--font-`, `font.weight` to `--font-weight-`, `typography` to `--type-`, `space` to `--space-`, `size` to `--size-`, `radius` to `--radius-`, `stroke` to `--stroke-`, `opacity` to `--opacity-`, `elevation.day` to `--elevation-`, `motion.duration` to `--duration-`, `motion.easing` to `--easing-`, `motion.spring` to `--spring-`, `motion.transition` to `--transition-`, `motion.gesture` to `--gesture-`. Nested group names are joined with hyphens (`color.day.sky.1` would be `--color-sky-1`).
- Typography roles are composite, so each role becomes five variables: `--type-<role>-family`, `-size`, `-weight`, `-line-height`, `-letter-spacing`. The family is `var(--font-sans)` or `var(--font-mono)` when the role references `font.family.sans` or `font.family.mono`, so it follows the self-hosted font. Letter spacing is emitted in px as stored in `$value` (the `letterSpacingEm` in `$extensions` is ignored).
- `--font-sans` and `--font-mono` are `var(--font-overpass), system-ui, sans-serif` and `var(--font-overpass-mono), ui-monospace, monospace`: the next/font variable replaces the first family of the stack, the fallbacks stay.
- Colors with alpha 1 are `#rrggbb`; colors with any other alpha are `rgb(r g b / a)`.
- Shadows are CSS `box-shadow` lists (`offsetX offsetY blur spread color`, layers comma separated). Springs and transitions are written as `<duration> <cubic-bezier> <delay>`, ready for `transition: transform var(--transition-press)`.
- Required groups (a missing or empty one is an error naming it): `color.day`, `font.family`, `space`, `radius`, `elevation.day`, `motion.duration`, `motion.easing`. The others are emitted when present.
- Night values are not emitted in step 1.

- [ ] **Step 1: Write the first failing tests (structure, colors, references)**

Create `tests/tokens/build.test.ts`. `base()` is the smallest token file the function accepts; every later test copies it and changes one thing. `vars()` reads the generated `--name: value;` lines into a map so tests check names and values without depending on layout.

```ts
import { describe, expect, it } from "vitest";
import { TokenError, tokensToCss } from "@/src/tokens/build";

type Dict = Record<string, any>;

const srgb = (hex: string, alpha?: number) => ({
  colorSpace: "srgb",
  components: [0, 0, 0],
  hex,
  ...(alpha === undefined ? {} : { alpha }),
});
const px = (value: number) => ({ value, unit: "px" });
const ms = (value: number) => ({ value, unit: "ms" });

// The smallest token file that tokensToCss accepts: one token in every required group.
function base(): Dict {
  return {
    color: {
      primitive: {
        "navy-900": { $type: "color", $value: srgb("#10233f") },
        "cream-50": { $type: "color", $value: srgb("#fdfbf5") },
      },
      day: { ink: { $type: "color", $value: "{color.primitive.navy-900}" } },
      night: { ink: { $type: "color", $value: "{color.primitive.cream-50}" } },
    },
    font: {
      family: {
        sans: { $type: "fontFamily", $value: ["Overpass", "system-ui", "sans-serif"] },
        mono: { $type: "fontFamily", $value: ["Overpass Mono", "ui-monospace", "monospace"] },
      },
    },
    space: { "4": { $type: "dimension", $value: px(4) } },
    radius: { card: { $type: "dimension", $value: px(16) } },
    elevation: {
      day: {
        small: {
          $type: "shadow",
          $value: [{ color: srgb("#10233f", 0.1), offsetX: px(0), offsetY: px(1), blur: px(0), spread: px(0) }],
        },
      },
      night: {
        small: {
          $type: "shadow",
          $value: [{ color: srgb("#000000", 0.2), offsetX: px(0), offsetY: px(1), blur: px(0), spread: px(0) }],
        },
      },
    },
    motion: {
      duration: { t1: { $type: "duration", $value: ms(120) } },
      easing: { ease: { $type: "cubicBezier", $value: [0.2, 0.7, 0.2, 1] } },
    },
  };
}

// Reads the `--name: value;` lines of the generated CSS into a map.
function vars(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of css.matchAll(/^\s*(--[a-z0-9-]+):\s*(.+);$/gm)) {
    out.set(match[1]!, match[2]!);
  }
  return out;
}

describe("tokensToCss: structure", () => {
  it("rejects input that is not a JSON object", () => {
    expect(() => tokensToCss(null)).toThrow(TokenError);
    expect(() => tokensToCss([])).toThrow(TokenError);
    expect(() => tokensToCss("tokens")).toThrow(TokenError);
  });

  it("names a required group that is missing", () => {
    const tokens = base();
    delete tokens.color.day;
    expect(() => tokensToCss(tokens)).toThrow("color.day");
  });

  it("names a required group that has no tokens", () => {
    const tokens = base();
    tokens.color.day = {};
    expect(() => tokensToCss(tokens)).toThrow(/color\.day.*no tokens/);
  });

  it("emits one :root block after a do-not-edit header", () => {
    const css = tokensToCss(base());
    expect(css.startsWith("/* Generated by scripts/build-tokens.ts")).toBe(true);
    expect(css.match(/:root \{/g)).toHaveLength(1);
    expect(css.trimEnd().endsWith("}")).toBe(true);
    expect(css.endsWith("\n")).toBe(true);
  });

  it("gives the same text for the same tokens", () => {
    expect(tokensToCss(base())).toBe(tokensToCss(base()));
  });
});

describe("tokensToCss: colors and references", () => {
  it("emits a --color variable per day color with the reference resolved", () => {
    expect(vars(tokensToCss(base())).get("--color-ink")).toBe("#10233f");
  });

  it("follows a chain of references", () => {
    const tokens = base();
    tokens.color.day.focus = { $type: "color", $value: "{color.day.ink}" };
    expect(vars(tokensToCss(tokens)).get("--color-focus")).toBe("#10233f");
  });

  it("leaves primitives and night colors out", () => {
    const css = tokensToCss(base());
    expect(css).not.toContain("navy-900");
    expect(css).not.toContain("#fdfbf5");
    expect(css).not.toContain("night");
  });

  it("writes a color with alpha below 1 as rgb with alpha, including fully clear", () => {
    const tokens = base();
    tokens.color.primitive["navy-a32"] = { $type: "color", $value: srgb("#10233f", 0.32) };
    tokens.color.primitive["mist-a0"] = { $type: "color", $value: srgb("#eef3f5", 0) };
    tokens.color.day.scrim = { $type: "color", $value: "{color.primitive.navy-a32}" };
    tokens.color.day.clear = { $type: "color", $value: "{color.primitive.mist-a0}" };
    tokens.color.day.solid = { $type: "color", $value: srgb("#FFFFFF", 1) };
    const out = vars(tokensToCss(tokens));
    expect(out.get("--color-scrim")).toBe("rgb(16 35 63 / 0.32)");
    expect(out.get("--color-clear")).toBe("rgb(238 243 245 / 0)");
    expect(out.get("--color-solid")).toBe("#ffffff");
  });

  it("builds the color from components when there is no hex", () => {
    const tokens = base();
    tokens.color.day.paper = { $type: "color", $value: { colorSpace: "srgb", components: [1, 0.5, 0] } };
    expect(vars(tokensToCss(tokens)).get("--color-paper")).toBe("#ff8000");
  });

  it("names the token and the reference when the reference does not exist", () => {
    const tokens = base();
    tokens.color.day.accent = { $type: "color", $value: "{color.primitive.amber-500}" };
    expect(() => tokensToCss(tokens)).toThrow(TokenError);
    expect(() => tokensToCss(tokens)).toThrow("color.day.accent refers to {color.primitive.amber-500}, which does not exist");
  });

  it("reports a circular reference instead of looping", () => {
    const tokens = base();
    tokens.color.day.a = { $type: "color", $value: "{color.day.b}" };
    tokens.color.day.b = { $type: "color", $value: "{color.day.a}" };
    expect(() => tokensToCss(tokens)).toThrow(/circular reference/);
  });

  it("rejects a color outside the srgb color space and names it", () => {
    const tokens = base();
    tokens.color.day.wide = { $type: "color", $value: { colorSpace: "display-p3", components: [1, 0, 0] } };
    expect(() => tokensToCss(tokens)).toThrow(/color\.day\.wide.*display-p3/);
  });

  it("rejects an alpha outside 0 to 1", () => {
    const tokens = base();
    tokens.color.day.bad = { $type: "color", $value: srgb("#000000", 1.5) };
    expect(() => tokensToCss(tokens)).toThrow(/color\.day\.bad/);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm vitest run tests/tokens/build.test.ts`

Expected: the suite fails to load, `Error: Cannot find package '@/src/tokens/build' imported from .../tests/tokens/build.test.ts`, `Tests  no tests`.

- [ ] **Step 3: Implement colors, references and the :root block**

Create `src/tokens/build.ts`:

```ts
// Turns design/system/tokens.json (W3C Design Tokens, DTCG 2025.10) into the text of app/tokens.css:
// one :root block of CSS custom properties with the day values. Pure: no file system, no DOM.

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

interface Group {
  path: string; // where the group sits in tokens.json
  prefix: string; // CSS variable prefix: --<prefix>-<token name>
  label: string; // comment above the group in the CSS
  required: boolean;
}

const GROUPS: readonly Group[] = [{ path: "color.day", prefix: "color", label: "Colors, day theme", required: true }];

type Dict = Record<string, unknown>;
interface Token {
  path: string;
  type: string | undefined;
  value: unknown;
}

const REFERENCE = /^\{([^{}]+)\}$/;

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(path: string, problem: string): never {
  throw new TokenError(`Token ${path} ${problem}`);
}

// Every token in the file by its dotted path. A group's $type applies to the tokens below it.
function collect(node: Dict, path: string, inherited: string | undefined, out: Map<string, Token>): void {
  const type = typeof node.$type === "string" ? node.$type : inherited;
  if ("$value" in node) {
    out.set(path, { path, type, value: node.$value });
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || !isDict(child)) continue;
    collect(child, path === "" ? key : `${path}.${key}`, type, out);
  }
}

// Follows "{a.b.c}" references until a literal value. `chain` starts with the token being emitted.
function deref(raw: unknown, chain: readonly string[], all: ReadonlyMap<string, Token>): unknown {
  if (typeof raw !== "string") return raw;
  const match = REFERENCE.exec(raw);
  if (!match) return raw;
  const target = match[1] as string;
  const holder = chain[chain.length - 1] as string;
  const token = all.get(target);
  if (!token) fail(holder, `refers to {${target}}, which does not exist`);
  if (chain.includes(target)) fail(chain[0] as string, `has a circular reference: ${[...chain, target].join(" -> ")}`);
  return deref(token.value, [...chain, target], all);
}

function toByte(component: unknown, path: string): number {
  if (typeof component !== "number" || !Number.isFinite(component) || component < 0 || component > 1) {
    fail(path, "has a color component outside 0 to 1");
  }
  return Math.round(component * 255);
}

function rgbOf(value: Dict, path: string): [number, number, number] {
  if (typeof value.hex === "string") {
    const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.hex);
    if (!hex) fail(path, `has a hex color that is not #rrggbb: ${value.hex}`);
    return [parseInt(hex[1] as string, 16), parseInt(hex[2] as string, 16), parseInt(hex[3] as string, 16)];
  }
  const components = value.components;
  if (!Array.isArray(components) || components.length !== 3) fail(path, "has a color with neither hex nor three components");
  return [toByte(components[0], path), toByte(components[1], path), toByte(components[2], path)];
}

function formatColor(value: unknown, path: string): string {
  if (!isDict(value)) fail(path, "has a color value that is not a DTCG color object");
  if (value.colorSpace !== undefined && value.colorSpace !== "srgb") {
    fail(path, `uses color space ${String(value.colorSpace)}, only srgb is supported`);
  }
  const rgb = rgbOf(value, path);
  const alpha = value.alpha ?? 1;
  if (typeof alpha !== "number" || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) fail(path, "has an alpha outside 0 to 1");
  if (alpha === 1) return `#${rgb.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return `rgb(${rgb.join(" ")} / ${alpha})`;
}

function formatValue(type: string | undefined, raw: unknown, path: string, all: ReadonlyMap<string, Token>): string {
  const value = deref(raw, [path], all);
  switch (type) {
    case "color":
      return formatColor(value, path);
    case undefined:
      return fail(path, "has no $type");
    default:
      return fail(path, `has unsupported type ${type}`);
  }
}

// The group object at a dotted path and the $type it inherits from its ancestors.
function groupAt(root: Dict, path: string): { node: Dict; type: string | undefined } | undefined {
  let node: Dict = root;
  let type = typeof root.$type === "string" ? root.$type : undefined;
  for (const key of path.split(".")) {
    const child = node[key];
    if (!isDict(child)) return undefined;
    node = child;
    if (typeof node.$type === "string") type = node.$type;
  }
  return { node, type };
}

export function tokensToCss(tokens: unknown): string {
  if (!isDict(tokens)) throw new TokenError("The design tokens must be a JSON object");
  const all = new Map<string, Token>();
  collect(tokens, "", undefined, all);

  const sections: string[] = [];
  for (const group of GROUPS) {
    const found = groupAt(tokens, group.path);
    if (!found) {
      if (group.required) throw new TokenError(`Required token group ${group.path} is missing`);
      continue;
    }
    const members = new Map<string, Token>();
    collect(found.node, group.path, found.type, members);
    if (members.size === 0) {
      if (group.required) throw new TokenError(`Required token group ${group.path} has no tokens`);
      continue;
    }
    const lines = [`  /* ${group.label} */`];
    for (const token of members.values()) {
      const name = `--${group.prefix}-${token.path.slice(group.path.length + 1)}`;
      lines.push(`  ${name}: ${formatValue(token.type, token.value, token.path, all)};`);
    }
    sections.push(lines.join("\n"));
  }

  return [
    "/* Generated by scripts/build-tokens.ts from design/system/tokens.json. Do not edit by hand. */",
    ":root {",
    sections.join("\n\n"),
    "}",
    "",
  ].join("\n");
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm vitest run tests/tokens/build.test.ts`

Expected: `Tests  14 passed (14)`.

- [ ] **Step 5: Commit**

```bash
git add src/tokens/build.ts tests/tokens/build.test.ts
git commit -m "feat: turn day colors from the design tokens into CSS variables"
```

- [ ] **Step 6: Write failing tests for sizes, numbers and names**

Append to the end of `tests/tokens/build.test.ts`:

```ts
describe("tokensToCss: sizes, numbers and names", () => {
  it("emits space, size, radius, stroke and opacity with their prefixes", () => {
    const tokens = base();
    tokens.size = { gutter: { $type: "dimension", $value: px(16) } };
    tokens.stroke = { rule: { $type: "dimension", $value: px(1.5) } };
    tokens.opacity = { disabled: { $type: "number", $value: 0.45 } };
    const out = vars(tokensToCss(tokens));
    expect(out.get("--space-4")).toBe("4px");
    expect(out.get("--size-gutter")).toBe("16px");
    expect(out.get("--radius-card")).toBe("16px");
    expect(out.get("--stroke-rule")).toBe("1.5px");
    expect(out.get("--opacity-disabled")).toBe("0.45");
  });

  it("writes zero and negative dimensions with their unit", () => {
    const tokens = base();
    tokens.space.none = { $type: "dimension", $value: px(0) };
    tokens.space.pull = { $type: "dimension", $value: px(-18) };
    tokens.space.rem = { $type: "dimension", $value: { value: 1.25, unit: "rem" } };
    const out = vars(tokensToCss(tokens));
    expect(out.get("--space-none")).toBe("0px");
    expect(out.get("--space-pull")).toBe("-18px");
    expect(out.get("--space-rem")).toBe("1.25rem");
  });

  it("joins nested group names with hyphens", () => {
    const tokens = base();
    tokens.color.day.sky = { "1": { $type: "color", $value: "{color.primitive.navy-900}" } };
    expect(vars(tokensToCss(tokens)).get("--color-sky-1")).toBe("#10233f");
  });

  it("applies a $type declared on a group to the tokens inside it", () => {
    const tokens = base();
    tokens.size = { $type: "dimension", header: { $value: px(56) } };
    expect(vars(tokensToCss(tokens)).get("--size-header")).toBe("56px");
  });

  it("skips optional groups that are absent", () => {
    const css = tokensToCss(base());
    expect(css).not.toContain("--size-");
    expect(css).not.toContain("--stroke-");
    expect(css).not.toContain("--opacity-");
  });

  it("names the required space and radius groups when they are missing", () => {
    const noSpace = base();
    delete noSpace.space;
    expect(() => tokensToCss(noSpace)).toThrow("space");
    const noRadius = base();
    delete noRadius.radius;
    expect(() => tokensToCss(noRadius)).toThrow("radius");
  });

  it("rejects a token name that is not a lowercase CSS name and names the token", () => {
    const tokens = base();
    tokens.space["Big Gap"] = { $type: "dimension", $value: px(40) };
    expect(() => tokensToCss(tokens)).toThrow(/space\.Big Gap/);
  });

  it("rejects two tokens that would produce the same variable", () => {
    const tokens = base();
    tokens.color.day["sky-1"] = { $type: "color", $value: "{color.primitive.navy-900}" };
    tokens.color.day.sky = { "1": { $type: "color", $value: "{color.primitive.cream-50}" } };
    expect(() => tokensToCss(tokens)).toThrow(/--color-sky-1/);
  });

  it("names a token that has no $type", () => {
    const tokens = base();
    tokens.space.mystery = { $value: px(3) };
    expect(() => tokensToCss(tokens)).toThrow(/space\.mystery has no \$type/);
  });

  it("names a token with a type this build does not know", () => {
    const tokens = base();
    tokens.space.odd = { $type: "gradient", $value: [] };
    expect(() => tokensToCss(tokens)).toThrow(/space\.odd has unsupported type gradient/);
  });

  it("rejects a dimension without a numeric value or with an unknown unit", () => {
    const noNumber = base();
    noNumber.space.bad = { $type: "dimension", $value: { value: "4", unit: "px" } };
    expect(() => tokensToCss(noNumber)).toThrow(/space\.bad/);
    const badUnit = base();
    badUnit.space.bad = { $type: "dimension", $value: { value: 4, unit: "vw" } };
    expect(() => tokensToCss(badUnit)).toThrow(/space\.bad.*vw/);
  });

  it("rejects a number token that is not a finite number", () => {
    const tokens = base();
    tokens.opacity = { broken: { $type: "number", $value: "0.5" } };
    expect(() => tokensToCss(tokens)).toThrow(/opacity\.broken/);
  });
});
```

- [ ] **Step 7: Run the tests and watch the new ones fail**

Run: `pnpm vitest run tests/tokens/build.test.ts`

Expected: `Tests  11 failed | 15 passed (26)`. "skips optional groups that are absent" already passes; the rest fail because only `color.day` is emitted and nested names are joined with a dot.

- [ ] **Step 8: Add the size groups, name checks and dimension and number formatting**

Replace the whole of `src/tokens/build.ts` with:

```ts
// Turns design/system/tokens.json (W3C Design Tokens, DTCG 2025.10) into the text of app/tokens.css:
// one :root block of CSS custom properties with the day values. Pure: no file system, no DOM.

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

interface Group {
  path: string; // where the group sits in tokens.json
  prefix: string; // CSS variable prefix: --<prefix>-<token name>
  label: string; // comment above the group in the CSS
  required: boolean;
}

const GROUPS: readonly Group[] = [
  { path: "color.day", prefix: "color", label: "Colors, day theme", required: true },
  { path: "space", prefix: "space", label: "Spacing", required: true },
  { path: "size", prefix: "size", label: "Sizes", required: false },
  { path: "radius", prefix: "radius", label: "Corner radii", required: true },
  { path: "stroke", prefix: "stroke", label: "Stroke widths", required: false },
  { path: "opacity", prefix: "opacity", label: "Opacities", required: false },
];

type Dict = Record<string, unknown>;
interface Token {
  path: string;
  type: string | undefined;
  value: unknown;
}

const REFERENCE = /^\{([^{}]+)\}$/;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UNITS: Readonly<Record<string, readonly string[]>> = { dimension: ["px", "rem"], duration: ["ms", "s"] };

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(path: string, problem: string): never {
  throw new TokenError(`Token ${path} ${problem}`);
}

// Every token in the file by its dotted path. A group's $type applies to the tokens below it.
function collect(node: Dict, path: string, inherited: string | undefined, out: Map<string, Token>): void {
  const type = typeof node.$type === "string" ? node.$type : inherited;
  if ("$value" in node) {
    out.set(path, { path, type, value: node.$value });
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || !isDict(child)) continue;
    collect(child, path === "" ? key : `${path}.${key}`, type, out);
  }
}

// Follows "{a.b.c}" references until a literal value. `chain` starts with the token being emitted.
function deref(raw: unknown, chain: readonly string[], all: ReadonlyMap<string, Token>): unknown {
  if (typeof raw !== "string") return raw;
  const match = REFERENCE.exec(raw);
  if (!match) return raw;
  const target = match[1] as string;
  const holder = chain[chain.length - 1] as string;
  const token = all.get(target);
  if (!token) fail(holder, `refers to {${target}}, which does not exist`);
  if (chain.includes(target)) fail(chain[0] as string, `has a circular reference: ${[...chain, target].join(" -> ")}`);
  return deref(token.value, [...chain, target], all);
}

function toByte(component: unknown, path: string): number {
  if (typeof component !== "number" || !Number.isFinite(component) || component < 0 || component > 1) {
    fail(path, "has a color component outside 0 to 1");
  }
  return Math.round(component * 255);
}

function rgbOf(value: Dict, path: string): [number, number, number] {
  if (typeof value.hex === "string") {
    const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.hex);
    if (!hex) fail(path, `has a hex color that is not #rrggbb: ${value.hex}`);
    return [parseInt(hex[1] as string, 16), parseInt(hex[2] as string, 16), parseInt(hex[3] as string, 16)];
  }
  const components = value.components;
  if (!Array.isArray(components) || components.length !== 3) fail(path, "has a color with neither hex nor three components");
  return [toByte(components[0], path), toByte(components[1], path), toByte(components[2], path)];
}

function formatColor(value: unknown, path: string): string {
  if (!isDict(value)) fail(path, "has a color value that is not a DTCG color object");
  if (value.colorSpace !== undefined && value.colorSpace !== "srgb") {
    fail(path, `uses color space ${String(value.colorSpace)}, only srgb is supported`);
  }
  const rgb = rgbOf(value, path);
  const alpha = value.alpha ?? 1;
  if (typeof alpha !== "number" || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) fail(path, "has an alpha outside 0 to 1");
  if (alpha === 1) return `#${rgb.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return `rgb(${rgb.join(" ")} / ${alpha})`;
}

function formatNumber(value: unknown, path: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "has a value that is not a finite number");
  return String(value);
}

function formatMeasure(type: "dimension" | "duration", value: unknown, path: string): string {
  if (!isDict(value) || typeof value.value !== "number" || !Number.isFinite(value.value)) {
    fail(path, `has a ${type} without a numeric value`);
  }
  const units = UNITS[type] as readonly string[];
  if (typeof value.unit !== "string" || !units.includes(value.unit)) {
    fail(path, `has a ${type} unit ${String(value.unit)}, expected one of ${units.join(", ")}`);
  }
  return `${value.value}${value.unit}`;
}

function formatValue(type: string | undefined, raw: unknown, path: string, all: ReadonlyMap<string, Token>): string {
  const value = deref(raw, [path], all);
  switch (type) {
    case "color":
      return formatColor(value, path);
    case "dimension":
      return formatMeasure("dimension", value, path);
    case "number":
      return formatNumber(value, path);
    case undefined:
      return fail(path, "has no $type");
    default:
      return fail(path, `has unsupported type ${type}`);
  }
}

// The group object at a dotted path and the $type it inherits from its ancestors.
function groupAt(root: Dict, path: string): { node: Dict; type: string | undefined } | undefined {
  let node: Dict = root;
  let type = typeof root.$type === "string" ? root.$type : undefined;
  for (const key of path.split(".")) {
    const child = node[key];
    if (!isDict(child)) return undefined;
    node = child;
    if (typeof node.$type === "string") type = node.$type;
  }
  return { node, type };
}

export function tokensToCss(tokens: unknown): string {
  if (!isDict(tokens)) throw new TokenError("The design tokens must be a JSON object");
  const all = new Map<string, Token>();
  collect(tokens, "", undefined, all);

  const sections: string[] = [];
  const emitted = new Set<string>();
  for (const group of GROUPS) {
    const found = groupAt(tokens, group.path);
    if (!found) {
      if (group.required) throw new TokenError(`Required token group ${group.path} is missing`);
      continue;
    }
    const members = new Map<string, Token>();
    collect(found.node, group.path, found.type, members);
    if (members.size === 0) {
      if (group.required) throw new TokenError(`Required token group ${group.path} has no tokens`);
      continue;
    }
    const lines = [`  /* ${group.label} */`];
    for (const token of members.values()) {
      const segments = token.path.slice(group.path.length + 1).split(".");
      if (!segments.every((segment) => NAME.test(segment))) {
        fail(token.path, "has a name that is not lowercase letters, digits and hyphens");
      }
      const name = `--${group.prefix}-${segments.join("-")}`;
      if (emitted.has(name)) fail(token.path, `would produce ${name} a second time`);
      emitted.add(name);
      lines.push(`  ${name}: ${formatValue(token.type, token.value, token.path, all)};`);
    }
    sections.push(lines.join("\n"));
  }

  return [
    "/* Generated by scripts/build-tokens.ts from design/system/tokens.json. Do not edit by hand. */",
    ":root {",
    sections.join("\n\n"),
    "}",
    "",
  ].join("\n");
}
```

- [ ] **Step 9: Run the tests and watch them pass**

Run: `pnpm vitest run tests/tokens/build.test.ts`

Expected: `Tests  26 passed (26)`.

- [ ] **Step 10: Commit**

```bash
git add src/tokens/build.ts tests/tokens/build.test.ts
git commit -m "feat: emit spacing, size, radius, stroke and opacity tokens"
```

- [ ] **Step 11: Write failing tests for fonts and type roles**

Append to the end of `tests/tokens/build.test.ts`:

```ts
describe("tokensToCss: fonts and type roles", () => {
  const role = (overrides: Dict = {}) => ({
    $type: "typography",
    $value: {
      fontFamily: "{font.family.sans}",
      fontSize: px(25),
      fontWeight: "{font.weight.sans-semibold}",
      letterSpacing: px(-0.3),
      lineHeight: 1.28,
      ...overrides,
    },
  });

  function withTypography(roles: Dict): Dict {
    const tokens = base();
    tokens.font.weight = { "sans-semibold": { $type: "fontWeight", $value: 600 } };
    tokens.typography = roles;
    return tokens;
  }

  it("points --font-sans and --font-mono at the next/font variables, keeping the fallbacks", () => {
    const out = vars(tokensToCss(base()));
    expect(out.get("--font-sans")).toBe("var(--font-overpass), system-ui, sans-serif");
    expect(out.get("--font-mono")).toBe("var(--font-overpass-mono), ui-monospace, monospace");
  });

  it("writes any other family as a font stack, quoting names with spaces", () => {
    const tokens = base();
    tokens.font.family.serif = { $type: "fontFamily", $value: ["Source Serif 4", "Georgia", "serif"] };
    tokens.font.family.single = { $type: "fontFamily", $value: "Inter" };
    const out = vars(tokensToCss(tokens));
    expect(out.get("--font-serif")).toBe('"Source Serif 4", Georgia, serif');
    expect(out.get("--font-single")).toBe("Inter");
  });

  it("names the required font family group when it is missing", () => {
    const tokens = base();
    delete tokens.font;
    expect(() => tokensToCss(tokens)).toThrow("font.family");
  });

  it("rejects an empty font stack", () => {
    const tokens = base();
    tokens.font.family.sans.$value = [];
    expect(() => tokensToCss(tokens)).toThrow(/font\.family\.sans/);
  });

  it("emits font weights as --font-weight variables", () => {
    const tokens = base();
    tokens.font.weight = { "sans-extrabold": { $type: "fontWeight", $value: 800 }, "mono-bold": { $type: "fontWeight", $value: "bold" } };
    const out = vars(tokensToCss(tokens));
    expect(out.get("--font-weight-sans-extrabold")).toBe("800");
    expect(out.get("--font-weight-mono-bold")).toBe("bold");
  });

  it("rejects a font weight outside 1 to 1000", () => {
    const tokens = base();
    tokens.font.weight = { heavy: { $type: "fontWeight", $value: 1200 } };
    expect(() => tokensToCss(tokens)).toThrow(/font\.weight\.heavy/);
  });

  it("splits a type role into five variables with references resolved", () => {
    const out = vars(tokensToCss(withTypography({ "card-statement": role() })));
    expect(out.get("--type-card-statement-family")).toBe("var(--font-sans)");
    expect(out.get("--type-card-statement-size")).toBe("25px");
    expect(out.get("--type-card-statement-weight")).toBe("600");
    expect(out.get("--type-card-statement-line-height")).toBe("1.28");
    expect(out.get("--type-card-statement-letter-spacing")).toBe("-0.3px");
  });

  it("points a mono role at --font-mono", () => {
    const out = vars(tokensToCss(withTypography({ score: role({ fontFamily: "{font.family.mono}" }) })));
    expect(out.get("--type-score-family")).toBe("var(--font-mono)");
  });

  it("writes a role with a literal family and weight as they are", () => {
    const out = vars(tokensToCss(withTypography({ quote: role({ fontFamily: ["Georgia", "serif"], fontWeight: 400 }) })));
    expect(out.get("--type-quote-family")).toBe("Georgia, serif");
    expect(out.get("--type-quote-weight")).toBe("400");
  });

  it("accepts a line height given as a dimension", () => {
    const out = vars(tokensToCss(withTypography({ tight: role({ lineHeight: px(20) }) })));
    expect(out.get("--type-tight-line-height")).toBe("20px");
  });

  it("names the role and the field that is missing", () => {
    const value = role().$value as Dict;
    delete value.letterSpacing;
    expect(() => tokensToCss(withTypography({ stamp: { $type: "typography", $value: value } }))).toThrow(
      /typography\.stamp is missing letterSpacing/,
    );
  });

  it("names the role when its family reference does not exist", () => {
    expect(() => tokensToCss(withTypography({ logo: role({ fontFamily: "{font.family.display}" }) }))).toThrow(
      "typography.logo refers to {font.family.display}, which does not exist",
    );
  });
});
```

- [ ] **Step 12: Run the tests and watch the new ones fail**

Run: `pnpm vitest run tests/tokens/build.test.ts`

Expected: `Tests  12 failed | 26 passed (38)`.

- [ ] **Step 13: Add font families, font weights and type roles**

Replace the whole of `src/tokens/build.ts` with:

```ts
// Turns design/system/tokens.json (W3C Design Tokens, DTCG 2025.10) into the text of app/tokens.css:
// one :root block of CSS custom properties with the day values. Pure: no file system, no DOM.

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

interface Group {
  path: string; // where the group sits in tokens.json
  prefix: string; // CSS variable prefix: --<prefix>-<token name>
  label: string; // comment above the group in the CSS
  required: boolean;
  kind: "plain" | "font-family" | "typography";
}

// next/font exposes each loaded family as a CSS variable (app/layout.tsx). A font family token whose
// name is listed here points at that variable, so the self-hosted font is used, and keeps its fallbacks.
export const NEXT_FONT_VARIABLES: Readonly<Record<string, string>> = {
  sans: "--font-overpass",
  mono: "--font-overpass-mono",
};

// A typography token becomes one variable per field: --type-<role>-<suffix>.
const TYPE_FIELDS = [
  ["fontFamily", "family"],
  ["fontSize", "size"],
  ["fontWeight", "weight"],
  ["lineHeight", "line-height"],
  ["letterSpacing", "letter-spacing"],
] as const;

const GROUPS: readonly Group[] = [
  { path: "color.day", prefix: "color", label: "Colors, day theme", required: true, kind: "plain" },
  { path: "font.family", prefix: "font", label: "Font families", required: true, kind: "font-family" },
  { path: "font.weight", prefix: "font-weight", label: "Font weights", required: false, kind: "plain" },
  { path: "typography", prefix: "type", label: "Type roles", required: false, kind: "typography" },
  { path: "space", prefix: "space", label: "Spacing", required: true, kind: "plain" },
  { path: "size", prefix: "size", label: "Sizes", required: false, kind: "plain" },
  { path: "radius", prefix: "radius", label: "Corner radii", required: true, kind: "plain" },
  { path: "stroke", prefix: "stroke", label: "Stroke widths", required: false, kind: "plain" },
  { path: "opacity", prefix: "opacity", label: "Opacities", required: false, kind: "plain" },
];

type Dict = Record<string, unknown>;
interface Token {
  path: string;
  type: string | undefined;
  value: unknown;
}

const REFERENCE = /^\{([^{}]+)\}$/;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UNITS: Readonly<Record<string, readonly string[]>> = { dimension: ["px", "rem"], duration: ["ms", "s"] };

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(path: string, problem: string): never {
  throw new TokenError(`Token ${path} ${problem}`);
}

// Every token in the file by its dotted path. A group's $type applies to the tokens below it.
function collect(node: Dict, path: string, inherited: string | undefined, out: Map<string, Token>): void {
  const type = typeof node.$type === "string" ? node.$type : inherited;
  if ("$value" in node) {
    out.set(path, { path, type, value: node.$value });
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || !isDict(child)) continue;
    collect(child, path === "" ? key : `${path}.${key}`, type, out);
  }
}

// Follows "{a.b.c}" references until a literal value. `chain` starts with the token being emitted.
function deref(raw: unknown, chain: readonly string[], all: ReadonlyMap<string, Token>): unknown {
  if (typeof raw !== "string") return raw;
  const match = REFERENCE.exec(raw);
  if (!match) return raw;
  const target = match[1] as string;
  const holder = chain[chain.length - 1] as string;
  const token = all.get(target);
  if (!token) fail(holder, `refers to {${target}}, which does not exist`);
  if (chain.includes(target)) fail(chain[0] as string, `has a circular reference: ${[...chain, target].join(" -> ")}`);
  return deref(token.value, [...chain, target], all);
}

function toByte(component: unknown, path: string): number {
  if (typeof component !== "number" || !Number.isFinite(component) || component < 0 || component > 1) {
    fail(path, "has a color component outside 0 to 1");
  }
  return Math.round(component * 255);
}

function rgbOf(value: Dict, path: string): [number, number, number] {
  if (typeof value.hex === "string") {
    const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.hex);
    if (!hex) fail(path, `has a hex color that is not #rrggbb: ${value.hex}`);
    return [parseInt(hex[1] as string, 16), parseInt(hex[2] as string, 16), parseInt(hex[3] as string, 16)];
  }
  const components = value.components;
  if (!Array.isArray(components) || components.length !== 3) fail(path, "has a color with neither hex nor three components");
  return [toByte(components[0], path), toByte(components[1], path), toByte(components[2], path)];
}

function formatColor(value: unknown, path: string): string {
  if (!isDict(value)) fail(path, "has a color value that is not a DTCG color object");
  if (value.colorSpace !== undefined && value.colorSpace !== "srgb") {
    fail(path, `uses color space ${String(value.colorSpace)}, only srgb is supported`);
  }
  const rgb = rgbOf(value, path);
  const alpha = value.alpha ?? 1;
  if (typeof alpha !== "number" || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) fail(path, "has an alpha outside 0 to 1");
  if (alpha === 1) return `#${rgb.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return `rgb(${rgb.join(" ")} / ${alpha})`;
}

function formatNumber(value: unknown, path: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "has a value that is not a finite number");
  return String(value);
}

function formatMeasure(type: "dimension" | "duration", value: unknown, path: string): string {
  if (!isDict(value) || typeof value.value !== "number" || !Number.isFinite(value.value)) {
    fail(path, `has a ${type} without a numeric value`);
  }
  const units = UNITS[type] as readonly string[];
  if (typeof value.unit !== "string" || !units.includes(value.unit)) {
    fail(path, `has a ${type} unit ${String(value.unit)}, expected one of ${units.join(", ")}`);
  }
  return `${value.value}${value.unit}`;
}

function fontStack(value: unknown, path: string): string[] {
  const families = typeof value === "string" ? [value] : value;
  if (!Array.isArray(families) || families.length === 0) fail(path, "has a font family that is not a name or a list of names");
  return families.map((family) => {
    if (typeof family !== "string" || family.trim() === "") fail(path, "has an empty font family name");
    return /^[A-Za-z][A-Za-z0-9-]*$/.test(family) ? family : `"${family}"`;
  });
}

function formatFontWeight(value: unknown, path: string): string {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 1000) return String(value);
  if (typeof value === "string" && /^[a-z]+(?:-[a-z]+)*$/.test(value)) return value;
  return fail(path, "has a font weight that is neither a number from 1 to 1000 nor a keyword");
}

function formatValue(type: string | undefined, raw: unknown, path: string, all: ReadonlyMap<string, Token>): string {
  const value = deref(raw, [path], all);
  switch (type) {
    case "color":
      return formatColor(value, path);
    case "dimension":
      return formatMeasure("dimension", value, path);
    case "number":
      return formatNumber(value, path);
    case "fontWeight":
      return formatFontWeight(value, path);
    case "fontFamily":
      return fontStack(value, path).join(", ");
    case undefined:
      return fail(path, "has no $type");
    default:
      return fail(path, `has unsupported type ${type}`);
  }
}

function fontFamilyEntry(token: Token, all: ReadonlyMap<string, Token>): string {
  if (token.type !== "fontFamily") fail(token.path, `has type ${String(token.type)}, expected fontFamily`);
  const stack = fontStack(deref(token.value, [token.path], all), token.path);
  const variable = NEXT_FONT_VARIABLES[token.path.slice("font.family.".length)];
  return variable === undefined ? stack.join(", ") : [`var(${variable})`, ...stack.slice(1)].join(", ");
}

function typographyEntries(token: Token, name: string, all: ReadonlyMap<string, Token>): [string, string][] {
  if (token.type !== "typography") fail(token.path, `has type ${String(token.type)}, expected typography`);
  const role = deref(token.value, [token.path], all);
  if (!isDict(role)) fail(token.path, "has a typography value that is not an object");
  return TYPE_FIELDS.map(([field, suffix]): [string, string] => {
    const raw = role[field];
    if (raw === undefined) fail(token.path, `is missing ${field}`);
    const value = deref(raw, [token.path], all);
    let css: string;
    if (field === "fontFamily") {
      const reference = typeof raw === "string" ? REFERENCE.exec(raw) : null;
      const family = reference?.[1]?.startsWith("font.family.") ? reference[1].slice("font.family.".length) : undefined;
      css = family === undefined ? fontStack(value, token.path).join(", ") : `var(--font-${family.split(".").join("-")})`;
    } else if (field === "fontWeight") {
      css = formatFontWeight(value, token.path);
    } else if (field === "lineHeight") {
      css = typeof value === "number" ? formatNumber(value, token.path) : formatMeasure("dimension", value, token.path);
    } else {
      css = formatMeasure("dimension", value, token.path);
    }
    return [`${name}-${suffix}`, css];
  });
}

function entriesFor(group: Group, token: Token, name: string, all: ReadonlyMap<string, Token>): [string, string][] {
  switch (group.kind) {
    case "font-family":
      return [[name, fontFamilyEntry(token, all)]];
    case "typography":
      return typographyEntries(token, name, all);
    case "plain":
      return [[name, formatValue(token.type, token.value, token.path, all)]];
  }
}

// The group object at a dotted path and the $type it inherits from its ancestors.
function groupAt(root: Dict, path: string): { node: Dict; type: string | undefined } | undefined {
  let node: Dict = root;
  let type = typeof root.$type === "string" ? root.$type : undefined;
  for (const key of path.split(".")) {
    const child = node[key];
    if (!isDict(child)) return undefined;
    node = child;
    if (typeof node.$type === "string") type = node.$type;
  }
  return { node, type };
}

export function tokensToCss(tokens: unknown): string {
  if (!isDict(tokens)) throw new TokenError("The design tokens must be a JSON object");
  const all = new Map<string, Token>();
  collect(tokens, "", undefined, all);

  const sections: string[] = [];
  const emitted = new Set<string>();
  for (const group of GROUPS) {
    const found = groupAt(tokens, group.path);
    if (!found) {
      if (group.required) throw new TokenError(`Required token group ${group.path} is missing`);
      continue;
    }
    const members = new Map<string, Token>();
    collect(found.node, group.path, found.type, members);
    if (members.size === 0) {
      if (group.required) throw new TokenError(`Required token group ${group.path} has no tokens`);
      continue;
    }
    const lines = [`  /* ${group.label} */`];
    for (const token of members.values()) {
      const segments = token.path.slice(group.path.length + 1).split(".");
      if (!segments.every((segment) => NAME.test(segment))) {
        fail(token.path, "has a name that is not lowercase letters, digits and hyphens");
      }
      for (const [name, value] of entriesFor(group, token, `--${group.prefix}-${segments.join("-")}`, all)) {
        if (emitted.has(name)) fail(token.path, `would produce ${name} a second time`);
        emitted.add(name);
        lines.push(`  ${name}: ${value};`);
      }
    }
    sections.push(lines.join("\n"));
  }

  return [
    "/* Generated by scripts/build-tokens.ts from design/system/tokens.json. Do not edit by hand. */",
    ":root {",
    sections.join("\n\n"),
    "}",
    "",
  ].join("\n");
}
```

- [ ] **Step 14: Run the tests and watch them pass**

Run: `pnpm vitest run tests/tokens/build.test.ts`

Expected: `Tests  38 passed (38)`.

- [ ] **Step 15: Commit**

```bash
git add src/tokens/build.ts tests/tokens/build.test.ts
git commit -m "feat: emit font and type role tokens, one variable per role field"
```

- [ ] **Step 16: Write failing tests for elevation and motion**

Append to the end of `tests/tokens/build.test.ts`:

```ts
describe("tokensToCss: elevation and motion", () => {
  it("writes a day shadow as a CSS box-shadow list, layers in order", () => {
    const tokens = base();
    tokens.elevation.day.ticket = {
      $type: "shadow",
      $value: [
        { color: srgb("#10233f", 0.06), offsetX: px(0), offsetY: px(1), blur: px(0), spread: px(0) },
        { color: srgb("#10233f", 0.45), offsetX: px(0), offsetY: px(22), blur: px(36), spread: px(-18) },
      ],
    };
    expect(vars(tokensToCss(tokens)).get("--elevation-ticket")).toBe(
      "0px 1px 0px 0px rgb(16 35 63 / 0.06), 0px 22px 36px -18px rgb(16 35 63 / 0.45)",
    );
  });

  it("accepts a single shadow object, an inset layer and a color reference", () => {
    const tokens = base();
    tokens.elevation.day.well = {
      $type: "shadow",
      $value: { color: "{color.primitive.navy-900}", offsetX: px(0), offsetY: px(2), blur: px(4), spread: px(0), inset: true },
    };
    expect(vars(tokensToCss(tokens)).get("--elevation-well")).toBe("inset 0px 2px 4px 0px #10233f");
  });

  it("leaves night elevation out", () => {
    expect(tokensToCss(base())).not.toContain("#000000");
    expect(tokensToCss(base())).not.toContain("rgb(0 0 0");
  });

  it("names a shadow layer that is missing a field", () => {
    const tokens = base();
    tokens.elevation.day.small.$value = [{ color: srgb("#10233f"), offsetX: px(0), offsetY: px(1), spread: px(0) }];
    expect(() => tokensToCss(tokens)).toThrow(/elevation\.day\.small is missing blur/);
  });

  it("emits durations and easing curves", () => {
    const tokens = base();
    tokens.motion.duration.slow = { $type: "duration", $value: { value: 1.5, unit: "s" } };
    const out = vars(tokensToCss(tokens));
    expect(out.get("--duration-t1")).toBe("120ms");
    expect(out.get("--duration-slow")).toBe("1.5s");
    expect(out.get("--easing-ease")).toBe("cubic-bezier(0.2, 0.7, 0.2, 1)");
  });

  it("allows an overshooting curve but rejects x values outside 0 to 1 and wrong lengths", () => {
    const spring = base();
    spring.motion.easing.spring = { $type: "cubicBezier", $value: [0.34, 1.56, 0.64, 1] };
    expect(vars(tokensToCss(spring)).get("--easing-spring")).toBe("cubic-bezier(0.34, 1.56, 0.64, 1)");
    const badX = base();
    badX.motion.easing.bad = { $type: "cubicBezier", $value: [1.2, 0, 0.5, 1] };
    expect(() => tokensToCss(badX)).toThrow(/motion\.easing\.bad/);
    const short = base();
    short.motion.easing.short = { $type: "cubicBezier", $value: [0.2, 0.7, 0.2] };
    expect(() => tokensToCss(short)).toThrow(/motion\.easing\.short/);
  });

  it("names the required duration and easing groups when they are missing", () => {
    const noDuration = base();
    delete noDuration.motion.duration;
    expect(() => tokensToCss(noDuration)).toThrow("motion.duration");
    const noEasing = base();
    delete noEasing.motion.easing;
    expect(() => tokensToCss(noEasing)).toThrow("motion.easing");
    const noElevation = base();
    delete noElevation.elevation.day;
    expect(() => tokensToCss(noElevation)).toThrow("elevation.day");
  });

  it("writes springs and transitions as duration, curve and delay with references resolved", () => {
    const tokens = base();
    tokens.motion.duration.hold = { $type: "duration", $value: ms(60) };
    tokens.motion.spring = {
      snap: { $type: "transition", $value: { duration: "{motion.duration.t1}", delay: ms(0), timingFunction: "{motion.easing.ease}" } },
    };
    tokens.motion.transition = {
      travel: {
        $type: "transition",
        $value: { duration: ms(300), delay: "{motion.duration.hold}", timingFunction: [0, 0, 0.58, 1] },
      },
    };
    const out = vars(tokensToCss(tokens));
    expect(out.get("--spring-snap")).toBe("120ms cubic-bezier(0.2, 0.7, 0.2, 1) 0ms");
    expect(out.get("--transition-travel")).toBe("300ms cubic-bezier(0, 0, 0.58, 1) 60ms");
  });

  it("names a transition whose timing function reference does not exist", () => {
    const tokens = base();
    tokens.motion.transition = {
      press: { $type: "transition", $value: { duration: ms(120), delay: ms(0), timingFunction: "{motion.easing.bounce}" } },
    };
    expect(() => tokensToCss(tokens)).toThrow("motion.transition.press refers to {motion.easing.bounce}, which does not exist");
  });

  it("emits gesture tokens of mixed types", () => {
    const tokens = base();
    tokens.motion.gesture = {
      "commit-distance": { $type: "dimension", $value: px(90) },
      "rotation-divisor": { $type: "number", $value: 18 },
    };
    const out = vars(tokensToCss(tokens));
    expect(out.get("--gesture-commit-distance")).toBe("90px");
    expect(out.get("--gesture-rotation-divisor")).toBe("18");
  });
});
```

- [ ] **Step 17: Run the tests and watch the new ones fail**

Run: `pnpm vitest run tests/tokens/build.test.ts`

Expected: `Tests  9 failed | 39 passed (48)`. "leaves night elevation out" already passes because no elevation is emitted yet.

- [ ] **Step 18: Add shadows, durations, easing curves, springs, transitions and gesture constants**

Replace the whole of `src/tokens/build.ts` with:

```ts
// Turns design/system/tokens.json (W3C Design Tokens, DTCG 2025.10) into the text of app/tokens.css:
// one :root block of CSS custom properties with the day values. Pure: no file system, no DOM.

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

interface Group {
  path: string; // where the group sits in tokens.json
  prefix: string; // CSS variable prefix: --<prefix>-<token name>
  label: string; // comment above the group in the CSS
  required: boolean;
  kind: "plain" | "font-family" | "typography";
}

// next/font exposes each loaded family as a CSS variable (app/layout.tsx). A font family token whose
// name is listed here points at that variable, so the self-hosted font is used, and keeps its fallbacks.
export const NEXT_FONT_VARIABLES: Readonly<Record<string, string>> = {
  sans: "--font-overpass",
  mono: "--font-overpass-mono",
};

// A typography token becomes one variable per field: --type-<role>-<suffix>.
const TYPE_FIELDS = [
  ["fontFamily", "family"],
  ["fontSize", "size"],
  ["fontWeight", "weight"],
  ["lineHeight", "line-height"],
  ["letterSpacing", "letter-spacing"],
] as const;

const GROUPS: readonly Group[] = [
  { path: "color.day", prefix: "color", label: "Colors, day theme", required: true, kind: "plain" },
  { path: "font.family", prefix: "font", label: "Font families", required: true, kind: "font-family" },
  { path: "font.weight", prefix: "font-weight", label: "Font weights", required: false, kind: "plain" },
  { path: "typography", prefix: "type", label: "Type roles", required: false, kind: "typography" },
  { path: "space", prefix: "space", label: "Spacing", required: true, kind: "plain" },
  { path: "size", prefix: "size", label: "Sizes", required: false, kind: "plain" },
  { path: "radius", prefix: "radius", label: "Corner radii", required: true, kind: "plain" },
  { path: "stroke", prefix: "stroke", label: "Stroke widths", required: false, kind: "plain" },
  { path: "opacity", prefix: "opacity", label: "Opacities", required: false, kind: "plain" },
  { path: "elevation.day", prefix: "elevation", label: "Elevation, day theme", required: true, kind: "plain" },
  { path: "motion.duration", prefix: "duration", label: "Durations", required: true, kind: "plain" },
  { path: "motion.easing", prefix: "easing", label: "Easing curves", required: true, kind: "plain" },
  { path: "motion.spring", prefix: "spring", label: "Springs (duration, curve, delay)", required: false, kind: "plain" },
  { path: "motion.transition", prefix: "transition", label: "Transitions (duration, curve, delay)", required: false, kind: "plain" },
  { path: "motion.gesture", prefix: "gesture", label: "Gesture constants", required: false, kind: "plain" },
];

type Dict = Record<string, unknown>;
interface Token {
  path: string;
  type: string | undefined;
  value: unknown;
}

const REFERENCE = /^\{([^{}]+)\}$/;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UNITS: Readonly<Record<string, readonly string[]>> = { dimension: ["px", "rem"], duration: ["ms", "s"] };

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(path: string, problem: string): never {
  throw new TokenError(`Token ${path} ${problem}`);
}

// Every token in the file by its dotted path. A group's $type applies to the tokens below it.
function collect(node: Dict, path: string, inherited: string | undefined, out: Map<string, Token>): void {
  const type = typeof node.$type === "string" ? node.$type : inherited;
  if ("$value" in node) {
    out.set(path, { path, type, value: node.$value });
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || !isDict(child)) continue;
    collect(child, path === "" ? key : `${path}.${key}`, type, out);
  }
}

// Follows "{a.b.c}" references until a literal value. `chain` starts with the token being emitted.
function deref(raw: unknown, chain: readonly string[], all: ReadonlyMap<string, Token>): unknown {
  if (typeof raw !== "string") return raw;
  const match = REFERENCE.exec(raw);
  if (!match) return raw;
  const target = match[1] as string;
  const holder = chain[chain.length - 1] as string;
  const token = all.get(target);
  if (!token) fail(holder, `refers to {${target}}, which does not exist`);
  if (chain.includes(target)) fail(chain[0] as string, `has a circular reference: ${[...chain, target].join(" -> ")}`);
  return deref(token.value, [...chain, target], all);
}

function toByte(component: unknown, path: string): number {
  if (typeof component !== "number" || !Number.isFinite(component) || component < 0 || component > 1) {
    fail(path, "has a color component outside 0 to 1");
  }
  return Math.round(component * 255);
}

function rgbOf(value: Dict, path: string): [number, number, number] {
  if (typeof value.hex === "string") {
    const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.hex);
    if (!hex) fail(path, `has a hex color that is not #rrggbb: ${value.hex}`);
    return [parseInt(hex[1] as string, 16), parseInt(hex[2] as string, 16), parseInt(hex[3] as string, 16)];
  }
  const components = value.components;
  if (!Array.isArray(components) || components.length !== 3) fail(path, "has a color with neither hex nor three components");
  return [toByte(components[0], path), toByte(components[1], path), toByte(components[2], path)];
}

function formatColor(value: unknown, path: string): string {
  if (!isDict(value)) fail(path, "has a color value that is not a DTCG color object");
  if (value.colorSpace !== undefined && value.colorSpace !== "srgb") {
    fail(path, `uses color space ${String(value.colorSpace)}, only srgb is supported`);
  }
  const rgb = rgbOf(value, path);
  const alpha = value.alpha ?? 1;
  if (typeof alpha !== "number" || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) fail(path, "has an alpha outside 0 to 1");
  if (alpha === 1) return `#${rgb.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return `rgb(${rgb.join(" ")} / ${alpha})`;
}

function formatNumber(value: unknown, path: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "has a value that is not a finite number");
  return String(value);
}

function formatMeasure(type: "dimension" | "duration", value: unknown, path: string): string {
  if (!isDict(value) || typeof value.value !== "number" || !Number.isFinite(value.value)) {
    fail(path, `has a ${type} without a numeric value`);
  }
  const units = UNITS[type] as readonly string[];
  if (typeof value.unit !== "string" || !units.includes(value.unit)) {
    fail(path, `has a ${type} unit ${String(value.unit)}, expected one of ${units.join(", ")}`);
  }
  return `${value.value}${value.unit}`;
}

function fontStack(value: unknown, path: string): string[] {
  const families = typeof value === "string" ? [value] : value;
  if (!Array.isArray(families) || families.length === 0) fail(path, "has a font family that is not a name or a list of names");
  return families.map((family) => {
    if (typeof family !== "string" || family.trim() === "") fail(path, "has an empty font family name");
    return /^[A-Za-z][A-Za-z0-9-]*$/.test(family) ? family : `"${family}"`;
  });
}

function formatFontWeight(value: unknown, path: string): string {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 1000) return String(value);
  if (typeof value === "string" && /^[a-z]+(?:-[a-z]+)*$/.test(value)) return value;
  return fail(path, "has a font weight that is neither a number from 1 to 1000 nor a keyword");
}

function formatCubicBezier(value: unknown, path: string): string {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every((n) => typeof n === "number" && Number.isFinite(n)) ||
    value[0] < 0 ||
    value[0] > 1 ||
    value[2] < 0 ||
    value[2] > 1
  ) {
    fail(path, "has a cubic bezier that is not four numbers with x values from 0 to 1");
  }
  return `cubic-bezier(${value.join(", ")})`;
}

function field(value: Dict, name: string, path: string, all: ReadonlyMap<string, Token>): unknown {
  if (value[name] === undefined) fail(path, `is missing ${name}`);
  return deref(value[name], [path], all);
}

function formatShadow(value: unknown, path: string, all: ReadonlyMap<string, Token>): string {
  const layers = Array.isArray(value) ? value : [value];
  if (layers.length === 0) fail(path, "has a shadow with no layers");
  return layers
    .map((layer) => {
      if (!isDict(layer)) fail(path, "has a shadow layer that is not an object");
      const parts = [
        formatMeasure("dimension", field(layer, "offsetX", path, all), path),
        formatMeasure("dimension", field(layer, "offsetY", path, all), path),
        formatMeasure("dimension", field(layer, "blur", path, all), path),
        formatMeasure("dimension", field(layer, "spread", path, all), path),
        formatColor(field(layer, "color", path, all), path),
      ];
      return (layer.inset === true ? "inset " : "") + parts.join(" ");
    })
    .join(", ");
}

// A transition token is written as "<duration> <timing function> <delay>", ready for
// `transition: transform var(--transition-press)`.
function formatTransition(value: unknown, path: string, all: ReadonlyMap<string, Token>): string {
  if (!isDict(value)) fail(path, "has a transition value that is not an object");
  return [
    formatMeasure("duration", field(value, "duration", path, all), path),
    formatCubicBezier(field(value, "timingFunction", path, all), path),
    formatMeasure("duration", field(value, "delay", path, all), path),
  ].join(" ");
}

function formatValue(type: string | undefined, raw: unknown, path: string, all: ReadonlyMap<string, Token>): string {
  const value = deref(raw, [path], all);
  switch (type) {
    case "color":
      return formatColor(value, path);
    case "dimension":
      return formatMeasure("dimension", value, path);
    case "number":
      return formatNumber(value, path);
    case "fontWeight":
      return formatFontWeight(value, path);
    case "fontFamily":
      return fontStack(value, path).join(", ");
    case "duration":
      return formatMeasure("duration", value, path);
    case "cubicBezier":
      return formatCubicBezier(value, path);
    case "shadow":
      return formatShadow(value, path, all);
    case "transition":
      return formatTransition(value, path, all);
    case undefined:
      return fail(path, "has no $type");
    default:
      return fail(path, `has unsupported type ${type}`);
  }
}

function fontFamilyEntry(token: Token, all: ReadonlyMap<string, Token>): string {
  if (token.type !== "fontFamily") fail(token.path, `has type ${String(token.type)}, expected fontFamily`);
  const stack = fontStack(deref(token.value, [token.path], all), token.path);
  const variable = NEXT_FONT_VARIABLES[token.path.slice("font.family.".length)];
  return variable === undefined ? stack.join(", ") : [`var(${variable})`, ...stack.slice(1)].join(", ");
}

function typographyEntries(token: Token, name: string, all: ReadonlyMap<string, Token>): [string, string][] {
  if (token.type !== "typography") fail(token.path, `has type ${String(token.type)}, expected typography`);
  const role = deref(token.value, [token.path], all);
  if (!isDict(role)) fail(token.path, "has a typography value that is not an object");
  return TYPE_FIELDS.map(([field, suffix]): [string, string] => {
    const raw = role[field];
    if (raw === undefined) fail(token.path, `is missing ${field}`);
    const value = deref(raw, [token.path], all);
    let css: string;
    if (field === "fontFamily") {
      const reference = typeof raw === "string" ? REFERENCE.exec(raw) : null;
      const family = reference?.[1]?.startsWith("font.family.") ? reference[1].slice("font.family.".length) : undefined;
      css = family === undefined ? fontStack(value, token.path).join(", ") : `var(--font-${family.split(".").join("-")})`;
    } else if (field === "fontWeight") {
      css = formatFontWeight(value, token.path);
    } else if (field === "lineHeight") {
      css = typeof value === "number" ? formatNumber(value, token.path) : formatMeasure("dimension", value, token.path);
    } else {
      css = formatMeasure("dimension", value, token.path);
    }
    return [`${name}-${suffix}`, css];
  });
}

function entriesFor(group: Group, token: Token, name: string, all: ReadonlyMap<string, Token>): [string, string][] {
  switch (group.kind) {
    case "font-family":
      return [[name, fontFamilyEntry(token, all)]];
    case "typography":
      return typographyEntries(token, name, all);
    case "plain":
      return [[name, formatValue(token.type, token.value, token.path, all)]];
  }
}

// The group object at a dotted path and the $type it inherits from its ancestors.
function groupAt(root: Dict, path: string): { node: Dict; type: string | undefined } | undefined {
  let node: Dict = root;
  let type = typeof root.$type === "string" ? root.$type : undefined;
  for (const key of path.split(".")) {
    const child = node[key];
    if (!isDict(child)) return undefined;
    node = child;
    if (typeof node.$type === "string") type = node.$type;
  }
  return { node, type };
}

export function tokensToCss(tokens: unknown): string {
  if (!isDict(tokens)) throw new TokenError("The design tokens must be a JSON object");
  const all = new Map<string, Token>();
  collect(tokens, "", undefined, all);

  const sections: string[] = [];
  const emitted = new Set<string>();
  for (const group of GROUPS) {
    const found = groupAt(tokens, group.path);
    if (!found) {
      if (group.required) throw new TokenError(`Required token group ${group.path} is missing`);
      continue;
    }
    const members = new Map<string, Token>();
    collect(found.node, group.path, found.type, members);
    if (members.size === 0) {
      if (group.required) throw new TokenError(`Required token group ${group.path} has no tokens`);
      continue;
    }
    const lines = [`  /* ${group.label} */`];
    for (const token of members.values()) {
      const segments = token.path.slice(group.path.length + 1).split(".");
      if (!segments.every((segment) => NAME.test(segment))) {
        fail(token.path, "has a name that is not lowercase letters, digits and hyphens");
      }
      for (const [name, value] of entriesFor(group, token, `--${group.prefix}-${segments.join("-")}`, all)) {
        if (emitted.has(name)) fail(token.path, `would produce ${name} a second time`);
        emitted.add(name);
        lines.push(`  ${name}: ${value};`);
      }
    }
    sections.push(lines.join("\n"));
  }

  return [
    "/* Generated by scripts/build-tokens.ts from design/system/tokens.json. Do not edit by hand. */",
    ":root {",
    sections.join("\n\n"),
    "}",
    "",
  ].join("\n");
}
```

- [ ] **Step 19: Run the tests and watch them pass**

Run: `pnpm vitest run tests/tokens/build.test.ts`

Expected: `Tests  48 passed (48)`.

- [ ] **Step 20: Commit**

```bash
git add src/tokens/build.ts tests/tokens/build.test.ts
git commit -m "feat: emit elevation and motion tokens"
```

- [ ] **Step 21: Write tests for the real token file and for the script**

At the top of `tests/tokens/build.test.ts`, replace the line

```ts
import { describe, expect, it } from "vitest";
```

with

```ts
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
```

Then append to the end of the file. The real-file tests pin names only; the design review may change any value. The script tests run the script with `tsx` against files in a temporary folder, so they never touch `app/tokens.css`.

```ts
describe("tokensToCss: the real design/system/tokens.json", () => {
  const realTokens = JSON.parse(readFileSync(new URL("../../design/system/tokens.json", import.meta.url), "utf8"));
  const out = vars(tokensToCss(realTokens));

  // The names tasks 9 to 12 are written against. Values are not pinned: the design review may change them.
  const COLORS = [
    "sky-1", "sky-2", "sky-3", "sky-4", "surface", "surface-raised", "surface-sunk", "ink", "ink-muted", "rule",
    "accent", "on-accent", "true", "false", "correct", "wrong", "on-dark", "cloud", "scrim", "surface-sunk-clear",
    "focus", "focus-on-fill", "press",
  ];
  const TYPE_ROLES = [
    "logo", "screen-title", "step-title", "tagline", "card-statement", "card-name", "answer-value", "answer-label",
    "stamp", "button", "button-quiet", "button-back", "carrier-title", "carrier-label", "leg-code", "leg-name",
    "field-label", "field-value", "field-value-pass", "body", "body-small", "list-title", "list-statement",
    "option-title", "emphasis", "deck-code", "section-code", "score", "intent-stamp", "mono-data", "mono-data-strong",
    "mono-caption", "route-label", "sheet-title", "pass-line",
  ];
  const OTHERS = [
    "--font-sans", "--font-mono",
    "--font-weight-sans-semibold", "--font-weight-sans-extrabold", "--font-weight-mono-regular", "--font-weight-mono-semibold",
    ...["2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "24"].map((n) => `--space-${n}`),
    ...[
      "safe-top", "safe-bottom", "gutter", "ticket-inset", "max-width", "touch-min", "header", "start-top-zone",
      "round-button", "pill", "pill-small", "actions", "carrier", "carrier-compact", "statement-min", "lower", "barcode",
      "notch", "card-notch", "card-stub", "card-stub-deck", "card-min", "card-min-deck", "card-min-off", "list-row",
      "sheet-bar", "sheet-overrun", "grab", "radio", "progress-track", "flight-path-height", "card-min-section",
      "card-min-class", "pass-line", "continue-icon", "foot-gap", "ready-offset",
    ].map((n) => `--size-${n}`),
    ...["card", "small", "pill", "pill-small", "tick"].map((n) => `--radius-${n}`),
    ...["rule", "perforation", "focus", "stamp", "radio", "quote", "icon"].map((n) => `--stroke-${n}`),
    "--opacity-cloud", "--opacity-disabled",
    ...["ticket", "small", "button", "press", "sheet"].map((n) => `--elevation-${n}`),
    ...[
      "t1", "t2", "t3", "stamp", "tear", "jolt", "stamp-timed", "leave-timed", "deal-timed", "hold-timed", "travel-hold",
      "travel", "step-exit-title", "step-exit", "step-enter", "step-enter-delay", "step-stagger", "top-exit",
      "top-enter-delay", "dash-out", "dash-in", "reduced-out", "reduced-in", "board", "strike",
    ].map((n) => `--duration-${n}`),
    ...["ease", "spring", "fall", "ease-in", "ease-out"].map((n) => `--easing-${n}`),
    ...["snap", "land", "land-fast"].map((n) => `--spring-${n}`),
    ...[
      "press", "answer-row", "tear", "stamp", "jolt", "sheet-open", "sheet-close", "disclosure", "travel", "step-enter",
      "step-exit", "timed-leave", "timed-deal", "pass-resize", "pass-board",
    ].map((n) => `--transition-${n}`),
    ...["commit-distance", "intent-distance", "rotation-divisor", "stub-pull", "intent-opacity-gain"].map((n) => `--gesture-${n}`),
  ];

  it("emits every day color the UI uses", () => {
    for (const name of COLORS) expect(out.has(`--color-${name}`), `--color-${name}`).toBe(true);
  });

  it("emits exactly the day colors, no primitives or night colors", () => {
    const colors = [...out.keys()].filter((name) => name.startsWith("--color-"));
    expect(colors).toHaveLength(Object.keys(realTokens.color.day).filter((key) => !key.startsWith("$")).length);
  });

  it("emits five variables for every type role", () => {
    for (const role of TYPE_ROLES) {
      for (const suffix of ["family", "size", "weight", "line-height", "letter-spacing"]) {
        expect(out.has(`--type-${role}-${suffix}`), `--type-${role}-${suffix}`).toBe(true);
      }
    }
  });

  it("emits the font, spacing, size, radius, stroke, opacity, elevation and motion variables", () => {
    for (const name of OTHERS) expect(out.has(name), name).toBe(true);
  });

  it("points the font families at the next/font variables", () => {
    expect(out.get("--font-sans")).toMatch(/^var\(--font-overpass\), /);
    expect(out.get("--font-mono")).toMatch(/^var\(--font-overpass-mono\), /);
  });

  it("leaves no unresolved reference or broken value in the output", () => {
    for (const [name, value] of out) {
      expect(value, name).not.toMatch(/[{}]|undefined|NaN|\[object/);
      expect(value.trim(), name).not.toBe("");
    }
  });
});

describe("scripts/build-tokens.ts", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const tsx = join(root, "node_modules/tsx/dist/cli.mjs");

  function run(source: string, target: string) {
    return spawnSync(process.execPath, [tsx, "scripts/build-tokens.ts", source, target], { cwd: root, encoding: "utf8" });
  }

  function workspace(): string {
    return mkdtempSync(join(tmpdir(), "truthy-tokens-"));
  }

  it("writes the CSS for a valid token file and reports how many variables", () => {
    const dir = workspace();
    writeFileSync(join(dir, "tokens.json"), JSON.stringify(base()));
    const result = run(join(dir, "tokens.json"), join(dir, "tokens.css"));
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Wrote .*tokens\.css \(\d+ variables\)/);
    expect(readFileSync(join(dir, "tokens.css"), "utf8")).toBe(tokensToCss(base()));
  });

  it("exits non-zero and names the token when a reference is broken", () => {
    const dir = workspace();
    const tokens = base();
    tokens.color.day.ink.$value = "{color.primitive.gone}";
    writeFileSync(join(dir, "tokens.json"), JSON.stringify(tokens));
    const result = run(join(dir, "tokens.json"), join(dir, "tokens.css"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("color.day.ink refers to {color.primitive.gone}");
    expect(existsSync(join(dir, "tokens.css"))).toBe(false);
  });

  it("keeps the previous CSS and names the file when tokens.json is not valid JSON", () => {
    const dir = workspace();
    writeFileSync(join(dir, "tokens.json"), '{ "color": { "day": { }, }');
    writeFileSync(join(dir, "tokens.css"), "/* previous */\n");
    const result = run(join(dir, "tokens.json"), join(dir, "tokens.css"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`build:tokens failed for ${join(dir, "tokens.json")}`);
    expect(readFileSync(join(dir, "tokens.css"), "utf8")).toBe("/* previous */\n");
  });
});
```

- [ ] **Step 22: Run the tests and watch the script tests fail**

Run: `pnpm vitest run tests/tokens/build.test.ts`

Expected: `Tests  3 failed | 54 passed (57)`. The six real-file tests pass (the function is complete); the three script tests fail with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../scripts/build-tokens.ts'`. If a real-file test fails instead, the design review has renamed or removed a token: either restore the name in `tokens.json` or update the list in the test and the "CSS variables produced" section together, because tasks 9 to 12 use those names.

- [ ] **Step 23: Write the script**

Create `scripts/build-tokens.ts`. It computes the CSS before writing anything, so a broken `tokens.json` never leaves a half-written or empty `app/tokens.css`.

```ts
// Generates app/tokens.css from design/system/tokens.json. Runs before every build (prebuild) and dev
// server start (predev). Usage: tsx scripts/build-tokens.ts [source.json] [target.css]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tokensToCss } from "@/src/tokens/build";

const source = process.argv[2] ?? fileURLToPath(new URL("../design/system/tokens.json", import.meta.url));
const target = process.argv[3] ?? fileURLToPath(new URL("../app/tokens.css", import.meta.url));

let css: string;
try {
  css = tokensToCss(JSON.parse(readFileSync(source, "utf8")));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`build:tokens failed for ${source}: ${message}`);
  process.exit(1);
}

writeFileSync(target, css);
const count = css.match(/^\s*--[a-z0-9-]+:/gm)?.length ?? 0;
console.log(`Wrote ${target} (${count} variables)`);
```

- [ ] **Step 24: Run the tests and watch them pass**

Run: `pnpm vitest run tests/tokens/build.test.ts`

Expected: `Tests  57 passed (57)`.

- [ ] **Step 25: Commit**

```bash
git add scripts/build-tokens.ts tests/tokens/build.test.ts
git commit -m "feat: add the build-tokens script and pin the token names the UI uses"
```

- [ ] **Step 26: Write failing tests for malformed references**

A reviewer editing `tokens.json` by hand can leave a reference half typed or point it at a group. Append to the end of `tests/tokens/build.test.ts`:

```ts
describe("tokensToCss: awkward references", () => {
  it("rejects text that looks like a reference but is not exactly one", () => {
    for (const bad of ["{color.primitive.navy-900", "{ color.primitive.navy-900 }", "{color.primitive.navy-900} 50%"]) {
      const tokens = base();
      tokens.font.family.sans.$value = bad;
      expect(() => tokensToCss(tokens), bad).toThrow(/font\.family\.sans has a malformed reference/);
    }
  });

  it("says so when a reference points at a group instead of a token", () => {
    const tokens = base();
    tokens.color.day.ink.$value = "{color.primitive}";
    expect(() => tokensToCss(tokens)).toThrow("color.day.ink refers to {color.primitive}, which is a group, not a token");
  });
});
```

- [ ] **Step 27: Run the tests and watch the new ones fail**

Run: `pnpm vitest run tests/tokens/build.test.ts`

Expected: `Tests  2 failed | 57 passed (59)`. The half-typed reference is currently written out as a quoted font name, and the group reference is reported as "does not exist".

- [ ] **Step 28: Reject malformed references and name group references**

Replace the whole of `src/tokens/build.ts` with the final version:

```ts
// Turns design/system/tokens.json (W3C Design Tokens, DTCG 2025.10) into the text of app/tokens.css:
// one :root block of CSS custom properties with the day values. Pure: no file system, no DOM.

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

interface Group {
  path: string; // where the group sits in tokens.json
  prefix: string; // CSS variable prefix: --<prefix>-<token name>
  label: string; // comment above the group in the CSS
  required: boolean;
  kind: "plain" | "font-family" | "typography";
}

// next/font exposes each loaded family as a CSS variable (app/layout.tsx). A font family token whose
// name is listed here points at that variable, so the self-hosted font is used, and keeps its fallbacks.
export const NEXT_FONT_VARIABLES: Readonly<Record<string, string>> = {
  sans: "--font-overpass",
  mono: "--font-overpass-mono",
};

// A typography token becomes one variable per field: --type-<role>-<suffix>.
const TYPE_FIELDS = [
  ["fontFamily", "family"],
  ["fontSize", "size"],
  ["fontWeight", "weight"],
  ["lineHeight", "line-height"],
  ["letterSpacing", "letter-spacing"],
] as const;

const GROUPS: readonly Group[] = [
  { path: "color.day", prefix: "color", label: "Colors, day theme", required: true, kind: "plain" },
  { path: "font.family", prefix: "font", label: "Font families", required: true, kind: "font-family" },
  { path: "font.weight", prefix: "font-weight", label: "Font weights", required: false, kind: "plain" },
  { path: "typography", prefix: "type", label: "Type roles", required: false, kind: "typography" },
  { path: "space", prefix: "space", label: "Spacing", required: true, kind: "plain" },
  { path: "size", prefix: "size", label: "Sizes", required: false, kind: "plain" },
  { path: "radius", prefix: "radius", label: "Corner radii", required: true, kind: "plain" },
  { path: "stroke", prefix: "stroke", label: "Stroke widths", required: false, kind: "plain" },
  { path: "opacity", prefix: "opacity", label: "Opacities", required: false, kind: "plain" },
  { path: "elevation.day", prefix: "elevation", label: "Elevation, day theme", required: true, kind: "plain" },
  { path: "motion.duration", prefix: "duration", label: "Durations", required: true, kind: "plain" },
  { path: "motion.easing", prefix: "easing", label: "Easing curves", required: true, kind: "plain" },
  { path: "motion.spring", prefix: "spring", label: "Springs (duration, curve, delay)", required: false, kind: "plain" },
  { path: "motion.transition", prefix: "transition", label: "Transitions (duration, curve, delay)", required: false, kind: "plain" },
  { path: "motion.gesture", prefix: "gesture", label: "Gesture constants", required: false, kind: "plain" },
];

type Dict = Record<string, unknown>;
interface Token {
  path: string;
  type: string | undefined;
  value: unknown;
}
// Every token by dotted path, and the dotted paths of the groups, so a reference to a group can be named as such.
interface Registry {
  tokens: ReadonlyMap<string, Token>;
  groups: ReadonlySet<string>;
}

const REFERENCE = /^\{([^{}]+)\}$/;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UNITS: Readonly<Record<string, readonly string[]>> = { dimension: ["px", "rem"], duration: ["ms", "s"] };

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(path: string, problem: string): never {
  throw new TokenError(`Token ${path} ${problem}`);
}

// Every token in the file by its dotted path. A group's $type applies to the tokens below it.
function collect(
  node: Dict,
  path: string,
  inherited: string | undefined,
  out: Map<string, Token>,
  groups?: Set<string>,
): void {
  const type = typeof node.$type === "string" ? node.$type : inherited;
  if ("$value" in node) {
    out.set(path, { path, type, value: node.$value });
    return;
  }
  groups?.add(path);
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || !isDict(child)) continue;
    collect(child, path === "" ? key : `${path}.${key}`, type, out, groups);
  }
}

// Follows "{a.b.c}" references until a literal value. `chain` starts with the token being emitted.
function deref(raw: unknown, chain: readonly string[], all: Registry): unknown {
  if (typeof raw !== "string") return raw;
  const holder = chain[chain.length - 1] as string;
  const match = REFERENCE.exec(raw);
  if (!match) {
    if (/[{}]/.test(raw)) fail(holder, `has a malformed reference: ${raw}`);
    return raw;
  }
  const target = match[1] as string;
  if (target.trim() !== target) fail(holder, `has a malformed reference: ${raw}`);
  const token = all.tokens.get(target);
  if (!token && all.groups.has(target)) fail(holder, `refers to {${target}}, which is a group, not a token`);
  if (!token) fail(holder, `refers to {${target}}, which does not exist`);
  if (chain.includes(target)) fail(chain[0] as string, `has a circular reference: ${[...chain, target].join(" -> ")}`);
  return deref(token.value, [...chain, target], all);
}

function toByte(component: unknown, path: string): number {
  if (typeof component !== "number" || !Number.isFinite(component) || component < 0 || component > 1) {
    fail(path, "has a color component outside 0 to 1");
  }
  return Math.round(component * 255);
}

function rgbOf(value: Dict, path: string): [number, number, number] {
  if (typeof value.hex === "string") {
    const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.hex);
    if (!hex) fail(path, `has a hex color that is not #rrggbb: ${value.hex}`);
    return [parseInt(hex[1] as string, 16), parseInt(hex[2] as string, 16), parseInt(hex[3] as string, 16)];
  }
  const components = value.components;
  if (!Array.isArray(components) || components.length !== 3) fail(path, "has a color with neither hex nor three components");
  return [toByte(components[0], path), toByte(components[1], path), toByte(components[2], path)];
}

function formatColor(value: unknown, path: string): string {
  if (!isDict(value)) fail(path, "has a color value that is not a DTCG color object");
  if (value.colorSpace !== undefined && value.colorSpace !== "srgb") {
    fail(path, `uses color space ${String(value.colorSpace)}, only srgb is supported`);
  }
  const rgb = rgbOf(value, path);
  const alpha = value.alpha ?? 1;
  if (typeof alpha !== "number" || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) fail(path, "has an alpha outside 0 to 1");
  if (alpha === 1) return `#${rgb.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return `rgb(${rgb.join(" ")} / ${alpha})`;
}

function formatNumber(value: unknown, path: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "has a value that is not a finite number");
  return String(value);
}

function formatMeasure(type: "dimension" | "duration", value: unknown, path: string): string {
  if (!isDict(value) || typeof value.value !== "number" || !Number.isFinite(value.value)) {
    fail(path, `has a ${type} without a numeric value`);
  }
  const units = UNITS[type] as readonly string[];
  if (typeof value.unit !== "string" || !units.includes(value.unit)) {
    fail(path, `has a ${type} unit ${String(value.unit)}, expected one of ${units.join(", ")}`);
  }
  return `${value.value}${value.unit}`;
}

function fontStack(value: unknown, path: string): string[] {
  const families = typeof value === "string" ? [value] : value;
  if (!Array.isArray(families) || families.length === 0) fail(path, "has a font family that is not a name or a list of names");
  return families.map((family) => {
    if (typeof family !== "string" || family.trim() === "") fail(path, "has an empty font family name");
    return /^[A-Za-z][A-Za-z0-9-]*$/.test(family) ? family : `"${family}"`;
  });
}

function formatFontWeight(value: unknown, path: string): string {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 1000) return String(value);
  if (typeof value === "string" && /^[a-z]+(?:-[a-z]+)*$/.test(value)) return value;
  return fail(path, "has a font weight that is neither a number from 1 to 1000 nor a keyword");
}

function formatCubicBezier(value: unknown, path: string): string {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every((n) => typeof n === "number" && Number.isFinite(n)) ||
    value[0] < 0 ||
    value[0] > 1 ||
    value[2] < 0 ||
    value[2] > 1
  ) {
    fail(path, "has a cubic bezier that is not four numbers with x values from 0 to 1");
  }
  return `cubic-bezier(${value.join(", ")})`;
}

function field(value: Dict, name: string, path: string, all: Registry): unknown {
  if (value[name] === undefined) fail(path, `is missing ${name}`);
  return deref(value[name], [path], all);
}

function formatShadow(value: unknown, path: string, all: Registry): string {
  const layers = Array.isArray(value) ? value : [value];
  if (layers.length === 0) fail(path, "has a shadow with no layers");
  return layers
    .map((layer) => {
      if (!isDict(layer)) fail(path, "has a shadow layer that is not an object");
      const parts = [
        formatMeasure("dimension", field(layer, "offsetX", path, all), path),
        formatMeasure("dimension", field(layer, "offsetY", path, all), path),
        formatMeasure("dimension", field(layer, "blur", path, all), path),
        formatMeasure("dimension", field(layer, "spread", path, all), path),
        formatColor(field(layer, "color", path, all), path),
      ];
      return (layer.inset === true ? "inset " : "") + parts.join(" ");
    })
    .join(", ");
}

// A transition token is written as "<duration> <timing function> <delay>", ready for
// `transition: transform var(--transition-press)`.
function formatTransition(value: unknown, path: string, all: Registry): string {
  if (!isDict(value)) fail(path, "has a transition value that is not an object");
  return [
    formatMeasure("duration", field(value, "duration", path, all), path),
    formatCubicBezier(field(value, "timingFunction", path, all), path),
    formatMeasure("duration", field(value, "delay", path, all), path),
  ].join(" ");
}

function formatValue(type: string | undefined, raw: unknown, path: string, all: Registry): string {
  const value = deref(raw, [path], all);
  switch (type) {
    case "color":
      return formatColor(value, path);
    case "dimension":
      return formatMeasure("dimension", value, path);
    case "number":
      return formatNumber(value, path);
    case "fontWeight":
      return formatFontWeight(value, path);
    case "fontFamily":
      return fontStack(value, path).join(", ");
    case "duration":
      return formatMeasure("duration", value, path);
    case "cubicBezier":
      return formatCubicBezier(value, path);
    case "shadow":
      return formatShadow(value, path, all);
    case "transition":
      return formatTransition(value, path, all);
    case undefined:
      return fail(path, "has no $type");
    default:
      return fail(path, `has unsupported type ${type}`);
  }
}

function fontFamilyEntry(token: Token, all: Registry): string {
  if (token.type !== "fontFamily") fail(token.path, `has type ${String(token.type)}, expected fontFamily`);
  const stack = fontStack(deref(token.value, [token.path], all), token.path);
  const variable = NEXT_FONT_VARIABLES[token.path.slice("font.family.".length)];
  return variable === undefined ? stack.join(", ") : [`var(${variable})`, ...stack.slice(1)].join(", ");
}

function typographyEntries(token: Token, name: string, all: Registry): [string, string][] {
  if (token.type !== "typography") fail(token.path, `has type ${String(token.type)}, expected typography`);
  const role = deref(token.value, [token.path], all);
  if (!isDict(role)) fail(token.path, "has a typography value that is not an object");
  return TYPE_FIELDS.map(([field, suffix]): [string, string] => {
    const raw = role[field];
    if (raw === undefined) fail(token.path, `is missing ${field}`);
    const value = deref(raw, [token.path], all);
    let css: string;
    if (field === "fontFamily") {
      const reference = typeof raw === "string" ? REFERENCE.exec(raw) : null;
      const family = reference?.[1]?.startsWith("font.family.") ? reference[1].slice("font.family.".length) : undefined;
      css = family === undefined ? fontStack(value, token.path).join(", ") : `var(--font-${family.split(".").join("-")})`;
    } else if (field === "fontWeight") {
      css = formatFontWeight(value, token.path);
    } else if (field === "lineHeight") {
      css = typeof value === "number" ? formatNumber(value, token.path) : formatMeasure("dimension", value, token.path);
    } else {
      css = formatMeasure("dimension", value, token.path);
    }
    return [`${name}-${suffix}`, css];
  });
}

function entriesFor(group: Group, token: Token, name: string, all: Registry): [string, string][] {
  switch (group.kind) {
    case "font-family":
      return [[name, fontFamilyEntry(token, all)]];
    case "typography":
      return typographyEntries(token, name, all);
    case "plain":
      return [[name, formatValue(token.type, token.value, token.path, all)]];
  }
}

// The group object at a dotted path and the $type it inherits from its ancestors.
function groupAt(root: Dict, path: string): { node: Dict; type: string | undefined } | undefined {
  let node: Dict = root;
  let type = typeof root.$type === "string" ? root.$type : undefined;
  for (const key of path.split(".")) {
    const child = node[key];
    if (!isDict(child)) return undefined;
    node = child;
    if (typeof node.$type === "string") type = node.$type;
  }
  return { node, type };
}

export function tokensToCss(tokens: unknown): string {
  if (!isDict(tokens)) throw new TokenError("The design tokens must be a JSON object");
  const byPath = new Map<string, Token>();
  const groups = new Set<string>();
  collect(tokens, "", undefined, byPath, groups);
  const all: Registry = { tokens: byPath, groups };

  const sections: string[] = [];
  const emitted = new Set<string>();
  for (const group of GROUPS) {
    const found = groupAt(tokens, group.path);
    if (!found) {
      if (group.required) throw new TokenError(`Required token group ${group.path} is missing`);
      continue;
    }
    const members = new Map<string, Token>();
    collect(found.node, group.path, found.type, members);
    if (members.size === 0) {
      if (group.required) throw new TokenError(`Required token group ${group.path} has no tokens`);
      continue;
    }
    const lines = [`  /* ${group.label} */`];
    for (const token of members.values()) {
      const segments = token.path.slice(group.path.length + 1).split(".");
      if (!segments.every((segment) => NAME.test(segment))) {
        fail(token.path, "has a name that is not lowercase letters, digits and hyphens");
      }
      for (const [name, value] of entriesFor(group, token, `--${group.prefix}-${segments.join("-")}`, all)) {
        if (emitted.has(name)) fail(token.path, `would produce ${name} a second time`);
        emitted.add(name);
        lines.push(`  ${name}: ${value};`);
      }
    }
    sections.push(lines.join("\n"));
  }

  return [
    "/* Generated by scripts/build-tokens.ts from design/system/tokens.json. Do not edit by hand. */",
    ":root {",
    sections.join("\n\n"),
    "}",
    "",
  ].join("\n");
}
```

- [ ] **Step 29: Run the tests and the typecheck**

Run: `pnpm vitest run tests/tokens/build.test.ts`

Expected: `Tests  59 passed (59)`.

Run: `pnpm typecheck`

Expected: exits 0 with no output after the `tsc --noEmit` banner.

- [ ] **Step 30: Commit**

```bash
git add src/tokens/build.ts tests/tokens/build.test.ts
git commit -m "feat: reject malformed token references"
```

- [ ] **Step 31: Wire the script into package.json**

In `package.json`, add `predev` before `dev`, and `prebuild` and `build:tokens` around `build`. The `scripts` block becomes:

```json
  "scripts": {
    "predev": "pnpm build:tokens",
    "dev": "next dev",
    "prebuild": "pnpm build:tokens",
    "build": "next build",
    "build:tokens": "tsx scripts/build-tokens.ts",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test"
  },
```

`predev` matters because `app/tokens.css` is gitignored: without it a fresh clone's `pnpm dev` fails on the import added in the next step.

- [ ] **Step 32: Generate the file**

Run: `pnpm build:tokens`

Expected, last line: `Wrote <repository>/app/tokens.css (324 variables)` (the count changes if the design review adds or removes tokens). Then run `head -6 app/tokens.css`; expected:

```css
/* Generated by scripts/build-tokens.ts from design/system/tokens.json. Do not edit by hand. */
:root {
  /* Colors, day theme */
  --color-sky-1: #a9d6f0;
  --color-sky-2: #c4e3f5;
  --color-sky-3: #ddeff8;
```

`git status --short` must not list `app/tokens.css` (it is ignored).

- [ ] **Step 33: Import the tokens in globals.css**

Replace the whole of `app/globals.css` with:

```css
/* Tailwind scans only the code folders. Automatic detection would also read content/ and
   design/ (megabytes of mockup HTML) and generate classes for them. */
@import "tailwindcss" source(none);
@source "../app";
@source "../components";

/* Design tokens as CSS variables, generated from design/system/tokens.json by `pnpm build:tokens`
   (runs automatically before `pnpm dev` and `pnpm build`). Day theme only in step 1. */
@import "./tokens.css";

:root {
  color-scheme: light;
}
```

- [ ] **Step 34: Add the script to the README**

In `README.md`, in the scripts table, add this row directly under the `pnpm build` row:

```markdown
| `pnpm build:tokens` | Generate `app/tokens.css` from `design/system/tokens.json` (runs automatically before `pnpm dev` and `pnpm build`) |
```

- [ ] **Step 35: Run every gate**

Run: `pnpm build`

Expected: the output starts with `> truthy@0.1.0 prebuild`, then `> pnpm build:tokens`, then `Wrote .../app/tokens.css (324 variables)`, then `> next build`, `✓ Compiled successfully`, and the route table with `○ /`. Exit code 0.

If it fails with `Can't resolve './tokens.css'` although `app/tokens.css` exists, Turbopack's build cache is remembering an earlier build that ran without the file (this happens after a plain `next build` or `pnpm exec next build` without the prebuild hook). Run `rm -rf .next/cache` and `pnpm build` again. Verified: the stale failure repeats on every build until the cache is cleared; a changed token value, by contrast, is picked up by a cached build.

Optional check that the variables reach the browser: `grep -rho -- "--color-ink:#[0-9a-f]*" .next/static | sort -u` prints `--color-ink:#10233f`.

Run: `pnpm test` and `pnpm typecheck`. Expected: both exit 0.

- [ ] **Step 36: Commit**

```bash
git add package.json app/globals.css README.md
git commit -m "chore: generate the token CSS before dev and build and import it globally"
```

#### CSS variables produced

All on `:root`, day values. These are the names tasks 9 to 12 use; `tests/tokens/build.test.ts` ("the real design/system/tokens.json") fails if one disappears. Values are deliberately not listed: read them in `app/tokens.css` after `pnpm build:tokens`.

**Colors (23)**, `--color-<name>`:
`--color-sky-1`, `--color-sky-2`, `--color-sky-3`, `--color-sky-4`, `--color-surface`, `--color-surface-raised`, `--color-surface-sunk`, `--color-ink`, `--color-ink-muted`, `--color-rule`, `--color-accent`, `--color-on-accent`, `--color-true`, `--color-false`, `--color-correct`, `--color-wrong`, `--color-on-dark`, `--color-cloud`, `--color-scrim`, `--color-surface-sunk-clear`, `--color-focus`, `--color-focus-on-fill`, `--color-press`

**Font families (2):** `--font-sans`, `--font-mono`

**Font weights (4):** `--font-weight-sans-semibold`, `--font-weight-sans-extrabold`, `--font-weight-mono-regular`, `--font-weight-mono-semibold`

**Type roles (35 roles x 5 = 175)**, `--type-<role>-family`, `--type-<role>-size`, `--type-<role>-weight`, `--type-<role>-line-height`, `--type-<role>-letter-spacing` for each role:
`logo`, `screen-title`, `step-title`, `tagline`, `card-statement`, `card-name`, `answer-value`, `answer-label`, `stamp`, `button`, `button-quiet`, `button-back`, `carrier-title`, `carrier-label`, `leg-code`, `leg-name`, `field-label`, `field-value`, `field-value-pass`, `body`, `body-small`, `list-title`, `list-statement`, `option-title`, `emphasis`, `deck-code`, `section-code`, `score`, `intent-stamp`, `mono-data`, `mono-data-strong`, `mono-caption`, `route-label`, `sheet-title`, `pass-line`

Example for the statement on the card: `font-family: var(--type-card-statement-family); font-size: var(--type-card-statement-size); font-weight: var(--type-card-statement-weight); line-height: var(--type-card-statement-line-height); letter-spacing: var(--type-card-statement-letter-spacing);`

**Spacing (11):** `--space-2`, `--space-4`, `--space-6`, `--space-8`, `--space-10`, `--space-12`, `--space-14`, `--space-16`, `--space-18`, `--space-20`, `--space-24`

**Sizes (37):** `--size-safe-top`, `--size-safe-bottom`, `--size-gutter`, `--size-ticket-inset`, `--size-max-width`, `--size-touch-min`, `--size-header`, `--size-start-top-zone`, `--size-round-button`, `--size-pill`, `--size-pill-small`, `--size-actions`, `--size-carrier`, `--size-carrier-compact`, `--size-statement-min`, `--size-lower`, `--size-barcode`, `--size-notch`, `--size-card-notch`, `--size-card-stub`, `--size-card-stub-deck`, `--size-card-min`, `--size-card-min-deck`, `--size-card-min-off`, `--size-list-row`, `--size-sheet-bar`, `--size-sheet-overrun`, `--size-grab`, `--size-radio`, `--size-progress-track`, `--size-flight-path-height`, `--size-card-min-section`, `--size-card-min-class`, `--size-pass-line`, `--size-continue-icon`, `--size-foot-gap`, `--size-ready-offset`

**Corner radii (5):** `--radius-card`, `--radius-small`, `--radius-pill`, `--radius-pill-small`, `--radius-tick`

**Stroke widths (7):** `--stroke-rule`, `--stroke-perforation`, `--stroke-focus`, `--stroke-stamp`, `--stroke-radio`, `--stroke-quote`, `--stroke-icon`

**Opacities (2):** `--opacity-cloud`, `--opacity-disabled`

**Elevation, day (5)**, full `box-shadow` values: `--elevation-ticket`, `--elevation-small`, `--elevation-button`, `--elevation-press`, `--elevation-sheet`

**Durations (25):** `--duration-t1`, `--duration-t2`, `--duration-t3`, `--duration-stamp`, `--duration-tear`, `--duration-jolt`, `--duration-stamp-timed`, `--duration-leave-timed`, `--duration-deal-timed`, `--duration-hold-timed`, `--duration-travel-hold`, `--duration-travel`, `--duration-step-exit-title`, `--duration-step-exit`, `--duration-step-enter`, `--duration-step-enter-delay`, `--duration-step-stagger`, `--duration-top-exit`, `--duration-top-enter-delay`, `--duration-dash-out`, `--duration-dash-in`, `--duration-reduced-out`, `--duration-reduced-in`, `--duration-board`, `--duration-strike`

**Easing curves (5)**, `cubic-bezier(...)`: `--easing-ease`, `--easing-spring`, `--easing-fall`, `--easing-ease-in`, `--easing-ease-out`

**Springs (3)**, `<duration> <curve> <delay>`: `--spring-snap`, `--spring-land`, `--spring-land-fast`

**Transitions (15)**, `<duration> <curve> <delay>`, used as `transition: transform var(--transition-press)`: `--transition-press`, `--transition-answer-row`, `--transition-tear`, `--transition-stamp`, `--transition-jolt`, `--transition-sheet-open`, `--transition-sheet-close`, `--transition-disclosure`, `--transition-travel`, `--transition-step-enter`, `--transition-step-exit`, `--transition-timed-leave`, `--transition-timed-deal`, `--transition-pass-resize`, `--transition-pass-board`

**Gesture constants (5):** `--gesture-commit-distance` (px), `--gesture-intent-distance` (px), `--gesture-rotation-divisor` (unitless), `--gesture-stub-pull` (px), `--gesture-intent-opacity-gain` (unitless). The swipe logic itself uses the `SWIPE` constants of task 7 in TypeScript; these variables are for CSS only.

Total with today's `tokens.json`: 324.

#### Notes for later tasks (verified in the spike)

- **Task 9, font variable placement.** `--font-sans` is declared on `:root` as `var(--font-overpass), ...`. A custom property's `var()` is resolved on the element that declares it, so the next/font `variable` classes must be on `<html>`, not on `<body>`. Checked in Chromium with Playwright: with the class on `<html>` a paragraph using `var(--font-sans)` computes to `Overpass, system-ui, sans-serif`; with the class on `<body>` it computes to `Times` (the whole stack, fallbacks included, is lost).
- **Task 9, Tailwind.** Tailwind 4 defines its own `--font-sans` and `--font-mono` in `@layer theme`. Ours are unlayered, so ours win: the built CSS contains both declarations and Tailwind's `font-sans`, `font-mono` utilities and its preflight `html` font (`--default-font-family: var(--font-sans)`) resolve to Overpass. No other emitted name collides with a Tailwind theme namespace (Tailwind uses `--spacing`, `--ease-*`, `--radius-sm` and so on; ours are `--space-*`, `--easing-*`, `--radius-card`).
- **Task 9 keeps** the `@import "./tokens.css";` line and its comment when it extends `app/globals.css`, after the Tailwind header and before its own rules.
- **Task 3** changes both `prebuild` and `predev` to `"pnpm build:tokens && pnpm build:decks"`, so a fresh clone's `pnpm dev` also has `public/decks/`.
- Day only: nothing in step 1 may reference a night value; there are no `--color-*` night variables to fall back on.

#### Review focus candidates

Conditions the spec implies (section "Tokens in code": components use tokens only, so a token build that quietly produces a wrong or empty file restyles the whole app; `tokens.json` is still being hand edited by the design review), that a person could hit, and that the first draft of the tests did not cover. Each now has a test:

1. The reviewer saves `tokens.json` with a syntax error (a trailing comma). The build must stop with a message naming the file and must not overwrite the previous `app/tokens.css` with nothing. Covered by "keeps the previous CSS and names the file when tokens.json is not valid JSON" in the `scripts/build-tokens.ts` block, steps 21 to 24.
2. A reference typed by hand is half finished or padded (`{color.primitive.navy-900`, `{ color.primitive.navy-900 }`, `{...} 50%`). Before the fix, a font family like that was silently written out as a quoted font name and the app would fall back to a system font. Covered by "rejects text that looks like a reference but is not exactly one", steps 26 to 29.
3. A reference points at a group (`{color.primitive}`) instead of a token. Before the fix the message said the token "does not exist", which sends the reviewer looking for a typo. Covered by "says so when a reference points at a group instead of a token", steps 26 to 29.
