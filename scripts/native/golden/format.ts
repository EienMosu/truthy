// The golden vector format (plan A README, "The golden vector format"): the contract with the Swift and Kotlin
// test suites. A producer runs a TypeScript function and hands its cases here; goldenFile writes the one JSON
// file both native suites decode. Everything JSON cannot carry is tagged, every card is written once in the
// file's card table, and the text is the same for the same cases, byte for byte.

import type { Card } from "@/src/content/schema";
import { createRng, type Rng } from "@/src/engine/rng";
import type { RoundState } from "@/src/engine/round";

export interface GoldenCase {
  name: string;
  input: unknown;
  output: unknown;
}

export interface GoldenMeta {
  module: string;
  function: string;
  source: string;
  tests: readonly string[];
}

export interface GoldenFile {
  path: string; // "native-data/golden/<module>.<function>.json"
  content: string;
}

export const GOLDEN_FORMAT = 1;
export const GOLDEN_DIR = "native-data/golden";

type RngTag = { $rng: { seed: number } } | { $rng: { values: number[] } };

const SPECIAL_NUMBERS = ["Infinity", "-Infinity", "NaN", "-0"] as const;
type SpecialNumber = (typeof SPECIAL_NUMBERS)[number];

// Names whose path would equal another path of the same module on a file system that ignores case (macOS by
// default): src.engine.deal.DEAL.json and src.engine.deal.deal.json are one file there. The constant gets
// ".constant" before ".json". The registry test fails on any new pair.
const CASE_CLASHES: ReadonlySet<string> = new Set(["src/engine/deal.DEAL"]);

/** "src/engine/deal" and "dealChunk" give "native-data/golden/src.engine.deal.dealChunk.json". */
export function goldenPath(module: string, name: string): string {
  const suffix = CASE_CLASHES.has(`${module}.${name}`) ? ".constant" : "";
  return `${GOLDEN_DIR}/${module.split("/").join(".")}.${name}${suffix}.json`;
}

/** What a card becomes inside a case: its id. The full card goes into the file's card table. */
export function cardRef(card: Pick<Card, "id">): { $card: string } {
  return { $card: card.id };
}

/** A whole shipped deck in file order: the cards array of native-data/decks/<deckId>.json. */
export function deckRef(deckId: string): { $deck: string } {
  if (deckId === "") throw new Error("deckRef needs a deck id");
  return { $deck: deckId };
}

/** An rng argument: the mulberry32 stream of createRng(seed). The seed must be an unsigned 32-bit integer; -0 is written as 0. */
export function rngSeed(seed: number): { $rng: { seed: number } } {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error(`an rng seed is an unsigned 32-bit integer, not ${seed}`);
  }
  return { $rng: { seed: seed + 0 } };
}

/** An rng argument that returns these values in order and fails when they run out. A -0 is written as 0. */
export function rngValues(values: readonly number[]): { $rng: { values: number[] } } {
  for (const value of values) {
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error(`an rng value is in [0, 1), not ${value}`);
  }
  return { $rng: { values: values.map((value) => value + 0) } };
}

/** The generator a tag stands for, so a producer runs the function on exactly what the file says. */
export function rngOf(tag: RngTag): Rng {
  if ("seed" in tag.$rng) return createRng(tag.$rng.seed);
  const values = tag.$rng.values;
  let next = 0;
  return () => {
    const value = values[next];
    if (value === undefined) throw new Error(`the rng ran out after ${values.length} values`);
    next += 1;
    return value;
  };
}

/** The output of a call, or {"$throws": message} when it throws an Error. */
export function outputOf(run: () => unknown): unknown {
  try {
    return run();
  } catch (error) {
    if (error instanceof Error) return { $throws: error.message };
    throw error;
  }
}

/**
 * A round state as the vectors carry it: its own fields in their order, with `source` replaced by
 * "chunks": source.chunks (pool, history and seed are in the case's input). Cards stay cards here;
 * goldenFile turns them into references.
 */
export function snapshotRound(state: RoundState): unknown {
  const snapshot: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (key === "source") snapshot.chunks = state.source.chunks;
    else snapshot[key] = value;
  }
  return snapshot;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** A card by its shape: the fields every Card has (src/content/schema.ts). */
function isCard(value: unknown): value is Card {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.section === "string" &&
    isPlainObject(value.text) &&
    typeof value.answer === "boolean" &&
    isPlainObject(value.source) &&
    typeof value.difficulty === "number"
  );
}

function isSpecialNumber(value: unknown): value is SpecialNumber {
  return (SPECIAL_NUMBERS as readonly unknown[]).includes(value);
}

const TAG_KEYS: ReadonlySet<string> = new Set(["$card", "$deck", "$rng", "$number", "$undefined", "$throws"]);

// A producer may put a tag in a case (rngSeed, deckRef, outputOf's $throws). It is written as it is, after its
// shape is checked, so a file never carries a tag the native decoders cannot read.
function checkTag(key: string, value: unknown, at: string): void {
  const fail = (): never => {
    throw new Error(`malformed ${key} tag at ${at}`);
  };
  switch (key) {
    case "$card":
    case "$deck":
      if (typeof value !== "string" || value === "") fail();
      return;
    case "$throws":
      if (typeof value !== "string") fail();
      return;
    case "$undefined":
      if (value !== true) fail();
      return;
    case "$number":
      if (!isSpecialNumber(value)) fail();
      return;
    case "$rng": {
      if (!isPlainObject(value)) return fail();
      const keys = Object.keys(value);
      if (keys.length !== 1) fail();
      if ("seed" in value) {
        rngSeed(value.seed as number);
        return;
      }
      if (!Array.isArray(value.values)) fail();
      rngValues(value.values as number[]);
      return;
    }
  }
}

function encodeNumber(value: number): number | { $number: SpecialNumber } {
  if (Number.isNaN(value)) return { $number: "NaN" };
  if (value === Infinity) return { $number: "Infinity" };
  if (value === -Infinity) return { $number: "-Infinity" };
  if (Object.is(value, -0)) return { $number: "-0" };
  return value;
}

/**
 * One value in the golden format. Cards become {"$card": id} and land in `cards` (by id, in the order they
 * are first met); numbers JSON cannot carry are tagged; a key whose value is undefined is left out, and an
 * undefined anywhere else is {"$undefined": true}. Functions, symbols, bigints and objects that are not plain
 * (a Map, a Set, a Date, a class instance) throw: a case must say what they are in data.
 */
export function encodeValue(value: unknown, cards: Map<string, unknown> = new Map(), at = "value"): unknown {
  if (value === undefined) return { $undefined: true };
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return encodeNumber(value);
  if (typeof value === "function") throw new Error(`cannot encode a function at ${at}: write rngSeed or rngValues`);
  if (typeof value !== "object") throw new Error(`cannot encode a ${typeof value} at ${at}`);
  if (Array.isArray(value)) return value.map((item, i) => encodeValue(item, cards, `${at}[${i}]`));
  if (!isPlainObject(value)) throw new Error(`cannot encode a ${value.constructor.name} at ${at}: write it as plain data`);
  if (isCard(value)) {
    const encoded = encodeObject(value, cards, `${at}<card ${value.id}>`);
    const known = cards.get(value.id);
    if (known === undefined) cards.set(value.id, encoded);
    else if (JSON.stringify(known) !== JSON.stringify(encoded)) {
      throw new Error(`two different cards share the id "${value.id}" (at ${at})`);
    }
    return cardRef(value);
  }
  const keys = Object.keys(value);
  const only = keys[0];
  if (keys.length === 1 && only !== undefined && TAG_KEYS.has(only)) {
    checkTag(only, value[only], at);
    return { [only]: only === "$rng" ? encodeObject(value.$rng as Record<string, unknown>, cards, at) : value[only] };
  }
  return encodeObject(value, cards, at);
}

function encodeObject(value: Record<string, unknown>, cards: Map<string, unknown>, at: string): Record<string, unknown> {
  const entries: [string, unknown][] = [];
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    entries.push([key, encodeValue(item, cards, `${at}.${key}`)]);
  }
  return Object.fromEntries(entries); // defines own keys, so a "__proto__" key stays a plain key
}

function collectCardRefs(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectCardRefs(item, into);
  } else if (isPlainObject(value)) {
    if (typeof value.$card === "string" && Object.keys(value).length === 1) into.add(value.$card);
    else for (const item of Object.values(value)) collectCardRefs(item, into);
  }
}

/** The golden file of one function or constant: meta, the card table and the encoded cases, as stable JSON. */
export function goldenFile(meta: GoldenMeta, cases: readonly GoldenCase[]): GoldenFile {
  if (cases.length === 0) throw new Error(`${meta.module}.${meta.function} has no cases`);
  const names = new Set<string>();
  for (const { name } of cases) {
    if (name === "") throw new Error(`${meta.module}.${meta.function} has a case without a name`);
    if (names.has(name)) throw new Error(`${meta.module}.${meta.function} has two cases named "${name}"`);
    names.add(name);
  }
  const cards = new Map<string, unknown>();
  const encodedCases = cases.map((item) => ({
    name: item.name,
    input: encodeValue(item.input, cards, `${item.name}: input`),
    output: encodeValue(item.output, cards, `${item.name}: output`),
  }));
  const referenced = new Set<string>();
  collectCardRefs(encodedCases, referenced);
  for (const id of referenced) {
    if (!cards.has(id)) throw new Error(`${meta.module}.${meta.function} refers to card "${id}", which no case carries`);
  }
  const file = {
    format: GOLDEN_FORMAT,
    module: meta.module,
    function: meta.function,
    source: meta.source,
    tests: [...meta.tests],
    cards: Object.fromEntries(cards),
    cases: encodedCases,
  };
  return { path: goldenPath(meta.module, meta.function), content: `${JSON.stringify(file, null, 2)}\n` };
}

export interface DecodedGolden {
  meta: GoldenMeta;
  cards: Record<string, Card>;
  cases: GoldenCase[];
}

/** One encoded value read back: card references, tagged numbers and undefined, the way decodeGoldenFile reads each case. */
export function decodeValue(value: unknown, cards: Readonly<Record<string, Card>>): unknown {
  if (Array.isArray(value)) return value.map((item) => decodeValue(item, cards));
  if (!isPlainObject(value)) return value;
  const keys = Object.keys(value);
  if (keys.length === 1) {
    if (typeof value.$card === "string") {
      const card = cards[value.$card];
      if (card === undefined) throw new Error(`card "${value.$card}" is not in the card table`);
      return card;
    }
    if (isSpecialNumber(value.$number)) {
      return { Infinity, "-Infinity": -Infinity, NaN, "-0": -0 }[value.$number];
    }
    if (value.$undefined === true) return undefined;
  }
  // Object.fromEntries defines own keys, so a "__proto__" key stays data.
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeValue(item, cards)]));
}

/**
 * Reads a golden file back the way the native suites do: card references become the cards of the table, tagged
 * numbers become numbers, {"$undefined": true} becomes undefined. $rng, $deck and $throws stay tags.
 */
export function decodeGoldenFile(content: string): DecodedGolden {
  const file = JSON.parse(content) as {
    format: number;
    module: string;
    function: string;
    source: string;
    tests: string[];
    cards: Record<string, unknown>;
    cases: { name: string; input: unknown; output: unknown }[];
  };
  if (file.format !== GOLDEN_FORMAT) throw new Error(`unknown golden format ${file.format}`);
  const cards: Record<string, Card> = {};
  for (const [id, card] of Object.entries(file.cards)) cards[id] = decodeValue(card, {}) as Card;
  return {
    meta: { module: file.module, function: file.function, source: file.source, tests: file.tests },
    cards,
    cases: file.cases.map((item) => ({
      name: item.name,
      input: decodeValue(item.input, cards),
      output: decodeValue(item.output, cards),
    })),
  };
}
