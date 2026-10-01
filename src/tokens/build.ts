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
