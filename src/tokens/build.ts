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
