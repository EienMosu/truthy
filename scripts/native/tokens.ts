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
