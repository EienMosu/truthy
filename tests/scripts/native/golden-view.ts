// Reading a golden file the way a native test does: the JSON, with cases found by name or by input, the
// card references put back, and a round trace replayed with the engine.
import { isDeepStrictEqual } from "node:util";
import { decodeGoldenFile, decodeValue, type GoldenFile } from "@/scripts/native/golden/format";
import type { Card } from "@/src/content/schema";
import { reduce, startRound, type RoundEvent, type RoundState, type StartArgs } from "@/src/engine/round";

export interface GoldenCaseView {
  name: string;
  input: unknown;
  output: unknown;
}

export interface View {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, Card>;
  cases: GoldenCaseView[];
}

export function view(file: GoldenFile): View {
  return JSON.parse(file.content) as View;
}

/** The case with this name. Throws when there is none, so a renamed case fails loudly. */
export function byName(file: GoldenFile, name: string): GoldenCaseView {
  const found = view(file).cases.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`${file.path} has no case named "${name}"`);
  return found;
}

/** The output of the case whose (encoded) input equals `input`. Throws when there is none. */
export function outputFor(file: GoldenFile, input: unknown): unknown {
  const found = view(file).cases.find((candidate) => isDeepStrictEqual(candidate.input, input));
  if (found === undefined) throw new Error(`${file.path} has no case for ${JSON.stringify(input)}`);
  return found.output;
}

/** The file of a producer's list by its path. Throws when there is none. */
export function fileAt(files: readonly GoldenFile[], path: string): GoldenFile {
  const found = files.find((candidate) => candidate.path === path);
  if (found === undefined) throw new Error(`no file at ${path}; the list has ${files.map((file) => file.path).join(", ")}`);
  return found;
}

/**
 * A value of a case read back with the format's own decoder (task 4): every {"$card": id} is the card of the file's
 * table, tagged numbers and {"$undefined": true} are what they name. `view` stays the raw JSON, which `outputFor`
 * compares encoded inputs against.
 */
export function decode(file: GoldenFile, value: unknown): unknown {
  return decodeValue(value, decodeGoldenFile(file.content).cards);
}

/** The round a case input of the form {start, events} builds, replayed with the engine. */
export function replay(file: GoldenFile, input: unknown): RoundState {
  const { start, events } = decode(file, input) as { start: StartArgs; events: RoundEvent[] };
  return events.reduce(reduce, startRound(start));
}
