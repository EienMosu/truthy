### Task 4: The golden vector format, the function registry, and the first vectors (rng, shuffle, `pad2`, the logo height, theme)

Plans B and C prove their engines against JSON files the TypeScript code writes. This task builds the writer of those files and the list of what must be written. `scripts/native/golden/format.ts` is the encoder of the README's section "The golden vector format": it turns a producer's cases (plain TypeScript values: cards, rounds, histories, numbers JSON cannot carry) into one stable JSON text per function, with every card written once in the file's card table, every special number tagged, and the same bytes for the same cases. It also decodes a file back the way the native suites do, so the format is pinned by its own round trip (Review Focus 3, which this task owns). `scripts/native/registry.ts` is reference section 3.9 as data: 130 functions and constants, each with its web file and its web tests, which task 9's coverage test turns into "one golden file per entry". The registry also lists the producers; this task adds the first two, `golden/rng.ts` (`createRng`, `shuffle`) and `golden/small.ts` (`pad2`, the logo mark's height, the theme rules), which are what plans B and C port in their first task.

Nothing here writes to disk or touches `native-data/`: the producers return `{ path, content }` pairs, and task 9 writes them. No web file changes.

Builds on: nothing from tasks 1 to 3 in code. The branch `native` with tasks 1 to 3 committed, so that the full-suite count of step 11 starts from task 3's.

Commands: `pnpm` is pnpm 10.34.0. Without a global one, write `npx -y pnpm@10.34.0` in its place.

**Files:**
- Create: `scripts/native/golden/format.ts`, `scripts/native/registry.ts`, `scripts/native/golden/rng.ts`, `scripts/native/golden/small.ts`
- Test: create `tests/scripts/native/golden-format.test.ts`, `tests/scripts/native/registry.test.ts`, `tests/scripts/native/golden-rng-small.test.ts`

**Interfaces:**
- Consumes (web code, unchanged): `createRng(seed: number): Rng`, `shuffle<T>(items: readonly T[], rng: Rng): T[]`, `type Rng` (`src/engine/rng.ts`); `startRound(args: StartArgs): RoundState`, `type RoundState` (`src/engine/round.ts`); `type Card` (`src/content/schema.ts`); `type History` (`src/content/play.ts`); `pad2(n: number): string` (`components/format.ts`); `LogoMark(props: LogoMarkProps)` (`components/Logo.tsx`); `THEME_KEY`, `parseTheme`, `oppositeTheme`, `resolveTheme`, `switchTheme`, `type Theme` (`src/app-state/theme.ts`).
- Produces (the README's names exactly, plus the extras marked "extra", which later tasks may use):

```ts
// scripts/native/golden/format.ts
export interface GoldenCase { name: string; input: unknown; output: unknown }
export interface GoldenMeta { module: string; function: string; source: string; tests: readonly string[] }
export interface GoldenFile { path: string; content: string } // path "native-data/golden/<module>.<function>.json"
export const GOLDEN_FORMAT = 1;                                  // extra
export const GOLDEN_DIR = "native-data/golden";                  // extra
export function goldenPath(module: string, name: string): string; // extra: "src/engine/deal", "dealChunk" -> "native-data/golden/src.engine.deal.dealChunk.json"; "DEAL" -> "...src.engine.deal.DEAL.constant.json"
export function cardRef(card: Pick<Card, "id">): { $card: string };
export function deckRef(deckId: string): { $deck: string };
export function rngSeed(seed: number): { $rng: { seed: number } };          // throws unless seed is a uint32
export function rngValues(values: readonly number[]): { $rng: { values: number[] } }; // throws unless every value is in [0, 1)
export function rngOf(tag: { $rng: { seed: number } } | { $rng: { values: number[] } }): Rng; // extra: the generator a tag stands for
export function outputOf(run: () => unknown): unknown;            // extra: the result, or { $throws: message }
export function snapshotRound(state: RoundState): unknown;
export function encodeValue(value: unknown, cards?: Map<string, unknown>, at?: string): unknown;
export function goldenFile(meta: GoldenMeta, cases: readonly GoldenCase[]): GoldenFile;
export interface DecodedGolden { meta: GoldenMeta; cards: Record<string, Card>; cases: GoldenCase[] } // extra
export function decodeGoldenFile(content: string): DecodedGolden;  // extra: the native decoders' reading, in TypeScript
export function decodeValue(value: unknown, cards: Readonly<Record<string, Card>>): unknown; // extra: one encoded value read back, as decodeGoldenFile reads each case

// scripts/native/registry.ts
export interface NativeFunction { module: string; name: string; source: string; tests: readonly string[]; kind: "function" | "constant" }
export const NATIVE_FUNCTIONS: readonly NativeFunction[];         // 130 entries, 21 of them constants
export function nativeFunction(module: string, name: string): NativeFunction; // extra: throws for a name 3.9 does not list
export function metaOf(module: string, name: string): GoldenMeta;  // extra: a producer's meta, read from the registry
export function goldenProducers(): readonly (() => GoldenFile[])[]; // [rng, small] after this task; tasks 5 to 8 append theirs

// scripts/native/golden/rng.ts and scripts/native/golden/small.ts
export function golden(): GoldenFile[];
```

  - What tasks 5 to 8 must know:
    - Every function and constant they produce is already in `NATIVE_FUNCTIONS`. They do not add rows; they append their group's `golden` to the array `goldenProducers()` returns, and build each file with `goldenFile(metaOf(module, name), cases)`.
    - `tests/scripts/native/registry.test.ts` runs every producer in `goldenProducers()`. A later task's file is therefore checked by it the moment it is appended: the file must be for a registered entry, once, with the registry's `source`, and with `tests` that are a non-empty subset of the entry's `tests` (a file may name only the test files that pin it, as the README's `dealChunk` example does). A constant's file has exactly one case, with input `null`.
    - The registry imports the producers and the producers import `metaOf` from the registry. That cycle is safe only while no module calls an import at its top level: call `metaOf` inside `golden()`, never in a top-level constant.
    - Run a function on exactly what the file says: build the rng argument with `rngSeed` or `rngValues`, put that tag in the case's input, and pass `rngOf(tag)` to the function. Wrap a call that may throw in `outputOf`. Write a `RoundState` output with `snapshotRound`.
    - The registry names the deal internals (`dealRanked` to `pickAnswer`, `OVERDUE_AFTER_PASSES`), `deckOfCard` and `withoutRemovedCards`, which the web code does not export today. Task 5 makes the deal internals callable through one `export const dealInternals = { ... }` appended to `src/engine/deal.ts`; task 7 puts `export` before `deckOfCard` and `withoutRemovedCards`. The registry test only needs each name declared at the top level of its web file.

**Rules:**

1. **Path.** `goldenPath(module, name)` is `native-data/golden/` + the module path with every `/` replaced by `.` + `.` + name + `.json`, with one exception. `src.engine.deal.deal.json` (the function) and `src.engine.deal.DEAL.json` (the constant) are one file on a file system that ignores case (macOS by default, where the owner exports and where `swift test` runs), so the constant `DEAL` of `src/engine/deal` is `src.engine.deal.DEAL.constant.json`. The registry test fails on any other pair of paths that are equal ignoring case, so the exception list cannot grow unnoticed; plans B and C build the same path.
2. **Text.** `goldenFile` writes the keys `format` (always `1`), `module`, `function`, `source`, `tests`, `cards`, `cases`, in that order; each case as `name`, `input`, `output`; every other object in the key order of the TypeScript value. `JSON.stringify(file, null, 2)` plus a final newline: two-space indent, numbers in JSON's shortest round-trip form, integers as integers. The same cases give the same bytes.
3. **Cases.** A file has at least one case, every case a non-empty name, no two cases the same name (the native suites name their tests after them).
4. **Cards.** A card is recognised by its shape: a plain object with a string `id`, a string `section`, an object `text`, a boolean `answer`, an object `source` and a number `difficulty` (the fields every `Card` has). Wherever one appears in an input or an output, it is written `{"$card": "<id>"}`, and the card itself goes into `cards` under its id, once, in the order cards are first met (cases in order, input before output). Two cards with one id but different contents throw `two different cards share the id "<id>" (at <where>)`. A `{"$card": ...}` that a producer wrote itself must name a card some case carries, or `goldenFile` throws `refers to card "<id>", which no case carries`.
5. **Numbers.** `NaN`, `Infinity`, `-Infinity` and `-0` become `{"$number": "NaN"}`, `{"$number": "Infinity"}`, `{"$number": "-Infinity"}`, `{"$number": "-0"}`, at any depth (`dealChunk`'s `budget: Infinity`, a `lastSeenAt` that is not finite). Every other number is written as it is.
6. **undefined.** A key whose value is `undefined` is left out. An `undefined` that is an array element, a whole input or a whole output is `{"$undefined": true}`.
7. **Tags.** An object whose only key is `$card`, `$deck`, `$rng`, `$number`, `$undefined` or `$throws` is a tag. A producer may write one (with `rngSeed`, `rngValues`, `deckRef`, `outputOf`); the encoder checks its shape and writes it unchanged: `$card` and `$deck` a non-empty string, `$throws` a string, `$undefined` exactly `true`, `$number` one of the four names, `$rng` exactly `{"seed": <uint32>}` or `{"values": [<numbers in [0, 1)>]}`. A malformed tag throws `malformed <key> tag at <where>` (or the message of `rngSeed` and `rngValues`). An object with a `$` key that is not a tag (a token's `{"$value": ...}`) is ordinary data.
8. **Not data.** A function throws `cannot encode a function at <where>: write rngSeed or rngValues`; a symbol or a bigint `cannot encode a <type> at <where>`; an object whose prototype is neither `Object.prototype` nor `null` (a `Map`, a `Set`, a `Date`, a class instance) `cannot encode a <constructor name> at <where>: write it as plain data`. `<where>` is a path such as `value.input.rng` or `<case name>: output[2]`.
9. **rng.** `rngSeed(seed)` takes an unsigned 32-bit integer (`0` to `4294967295`) and nothing else; seed coercion is `createRng`'s own business and is pinned by `createRng`'s vectors. `rngValues(values)` takes values in `[0, 1)`. `rngOf` gives `createRng(seed)` for a seed and, for values, a generator that returns them in order and throws `the rng ran out after <n> values` when asked for one more, which is how the native suites must run a values rng too.
10. **Throws.** `outputOf(run)` returns `run()`, or `{"$throws": error.message}` when it throws an `Error` (anything else thrown is rethrown).
11. **Rounds.** `snapshotRound(state)` copies the state's own fields in their order, writing `"chunks": state.source.chunks` where `source` was (`pool`, `history` and `seed` are in the case's input). Cards stay cards; `goldenFile` turns them into references.
12. **Decoding.** `decodeGoldenFile(content)` reads a file the way the native suites must: format other than `1` throws `unknown golden format <n>`; `$card` becomes the card of the table (an unknown id throws); `$number` becomes the number (with `-0` as negative zero); `$undefined` becomes `undefined`. `$rng`, `$deck` and `$throws` stay tags: they stand for a generator, a deck file and an expected error, which a test handles itself. `decodeValue(value, cards)` is the same reading for one value. Both directions define own keys, so a key named `__proto__` (a progress record of reference 8.1) stays an ordinary key, written and read back as data.
13. **Registry.** `NATIVE_FUNCTIONS` is reference 3.9 row by row, one row per web file, functions first and then constants, in the order 3.9 names them. 130 entries, 21 constants. Choices this task makes where 3.9 is not a list of exports:
    - Left out, as the spec says: `entriesBehind` (web only) and `browserLocalStorage` (the storage adapter). Also `canStillFinish`, a closure inside `searchWithAllRules` that has no file of its own and is pinned through it, and `keepUnreadable`, which 3.9 names only as what `save` of `createLocalStore` calls first and which is pinned through `createLocalStore`. Also `cards` and `tally`, helpers inside `components/play/resultCopy.ts` pinned through `resultCopy`, and `wholeSeconds`, pinned through `clockText` and `timedLabel`.
    - In: the dealing internals 3.9 lists as ported (21 functions and `OVERDUE_AFTER_PASSES`), `deckOfCard` and `withoutRemovedCards`.
    - The logo row is `components/Logo` `LogoMark`: its vector is the mark's height for a width, `round(width * 30 / 44 * 100) / 100` (`Logo.tsx:20`), read from the element `LogoMark` returns.
    - The contrast row is module `design/system/tokens`, constant `contrastPairs`, source `design/system/tokens.json`, tests `tests/tokens/contrast.test.ts` (the name task 8 and plan C use): the pairs are those of the web contrast test, the colours come from `tokens.json`. It is the one entry whose source is a JSON file, so the registry test checks no declaration for it.
    - Each entry carries the test files of its 3.9 row that test its own web file: a row that spans several web files is split per file (`schema`, `load`, `text`; `FillInPass`, `ContinueLine`; `resultCopy`, `ResultView`, `MissedCards`; the three header files), `MissedCards` also carries `tests/components/missed-cards-applies-to-polish.test.tsx`, and `tests/components/StreakPath*.test.tsx` and its siblings are spelled out. A producer's file names exactly its entry's tests, or a subset of them.
14. **This task's vectors.** Each is computed by calling the web code; the tests replay every case against the web function.
    - `src.engine.rng.createRng`: input `{"seed": <number>}`, output the first draws of that stream; a native test draws `output.length` values. Seeds: the three reference seeds of `rng.test.ts` (1, 42, 0), the coercion cases (-1, 1.9, 2^32 + 1) and their targets (2^32 - 1), 2^31, 0x6d2b79f5, 7 (50 draws), 3, and 123 (200 draws). Ten draws unless stated.
    - `src.engine.rng.shuffle`: input `{"items": [...], "rng": <tag>}`. The reference order for seed 1, seeds 5 and 11, an empty list and a single item with `rngValues([])` (no draw allowed), eight items with exactly seven values (the n - 1 draws), four items with the lowest, the highest and a middle value, and seeded cases of 4 and 20 items.
    - `components.format.pad2`: input `{"n": <number>}`; 0, 7, 14, 120 (`format.test.ts`), then 1, 9, 10, 99, 100.
    - `components.Logo.LogoMark`: input the props (`{}` for the default width 44, else `{"width": <number>}`), output the height. Widths 44, 26 (17.73), 20, 1, 13, 36, 100, and three widths whose hundredths land exactly on a half in doubles (0.11, 0.33, 2.53: 7.5, 22.5 and 172.5 hundredths), so a port that rounds half to even (0.22 instead of 0.23 for 0.33) fails.
    - `src.app-state.theme.THEME_KEY`: one case, input `null`, output `"truthy.theme"`.
    - `src.app-state.theme.parseTheme`: input `{"value": <any>}` (`{}` for `undefined`); light, dark and every garbage value of `theme.test.ts`.
    - `src.app-state.theme.oppositeTheme`: input `{"theme": ...}`, both themes.
    - `src.app-state.theme.resolveTheme`: input `{"choice": <theme or null>, "systemDark": <boolean>}`, all six combinations.
    - `src.app-state.theme.switchTheme`: the flip rule. `switchTheme` takes a page, a storage and a media query, which are not data, so the input describes them by what the rule reads: `{"choice": <the page's data-theme, or null when it follows the system>, "systemDark": <boolean>}`; the output is `{"theme": <the theme now shown>, "stored": <what storage now holds under THEME_KEY>}`. The producer runs the real `switchTheme` on a minimal page, storage and query, for all six combinations.

**Steps:**

- [ ] **Step 1: Write the format test.**

`tests/scripts/native/golden-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Card } from "@/src/content/schema";
import type { History } from "@/src/content/play";
import { startRound } from "@/src/engine/round";
import {
  cardRef,
  decodeGoldenFile,
  deckRef,
  encodeValue,
  goldenFile,
  goldenPath,
  outputOf,
  rngOf,
  rngSeed,
  rngValues,
  snapshotRound,
} from "@/scripts/native/golden/format";

function card(id: string, answer = true): Card {
  return {
    id,
    section: "S01",
    text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
    answer,
    source: { title: "Docs", url: "https://docs.example.com/page" },
    difficulty: 1,
    appliesTo: "",
    conflictGroups: [],
  };
}

const META = { module: "src/engine/demo", function: "demo", source: "src/engine/demo.ts", tests: ["tests/engine/demo.test.ts"] };

describe("goldenPath", () => {
  it("names a file after the module path with dots and the function", () => {
    expect(goldenPath("src/engine/deal", "dealChunk")).toBe("native-data/golden/src.engine.deal.dealChunk.json");
    expect(goldenPath("components/FlightPath", "pointAt")).toBe("native-data/golden/components.FlightPath.pointAt.json");
    expect(goldenPath("src/engine/deal", "DEAL")).toBe("native-data/golden/src.engine.deal.DEAL.constant.json");
    expect(goldenPath("src/engine/deal", "CHUNK")).toBe("native-data/golden/src.engine.deal.CHUNK.json");
  });
});

describe("encodeValue: numbers", () => {
  it("tags the numbers JSON cannot carry", () => {
    expect(encodeValue(Infinity)).toEqual({ $number: "Infinity" });
    expect(encodeValue(-Infinity)).toEqual({ $number: "-Infinity" });
    expect(encodeValue(Number.NaN)).toEqual({ $number: "NaN" });
    expect(encodeValue(-0)).toEqual({ $number: "-0" });
  });

  it("keeps integers and every other double as they are", () => {
    expect(encodeValue(0)).toBe(0);
    expect(encodeValue(4294967295)).toBe(4294967295);
    expect(encodeValue(0.1 + 0.2)).toBe(0.30000000000000004);
    expect(JSON.stringify(encodeValue(2693262067 / 4294967296))).toBe("0.6270739405881613");
  });

  it("tags special numbers wherever they are: dealChunk's budget and a lastSeenAt that is not finite", () => {
    const history: History = { a: { seen: 1, lastCorrect: false, lastSeenAt: Number.NaN }, b: { seen: 2, lastCorrect: true, lastSeenAt: -Infinity } };
    expect(encodeValue({ options: { budget: Infinity }, history })).toEqual({
      options: { budget: { $number: "Infinity" } },
      history: {
        a: { seen: 1, lastCorrect: false, lastSeenAt: { $number: "NaN" } },
        b: { seen: 2, lastCorrect: true, lastSeenAt: { $number: "-Infinity" } },
      },
    });
  });
});

describe("encodeValue: undefined", () => {
  it("leaves out a key whose value is undefined", () => {
    expect(encodeValue({ a: 1, b: undefined, c: "x" })).toEqual({ a: 1, c: "x" });
    expect(Object.keys(encodeValue({ a: 1, b: undefined }) as object)).toEqual(["a"]);
  });

  it("writes an undefined value on its own or in an array as a tag", () => {
    expect(encodeValue(undefined)).toEqual({ $undefined: true });
    expect(encodeValue([1, undefined, 2])).toEqual([1, { $undefined: true }, 2]);
  });
});

describe("encodeValue: cards", () => {
  it("replaces every card by its id and collects it once, in the order first met", () => {
    const cards = new Map<string, unknown>();
    const a = card("a");
    const b = card("b", false);
    expect(encodeValue({ pool: [a, b], dealt: [b, a], answer: { card: a, given: true } }, cards)).toEqual({
      pool: [{ $card: "a" }, { $card: "b" }],
      dealt: [{ $card: "b" }, { $card: "a" }],
      answer: { card: { $card: "a" }, given: true },
    });
    expect([...cards.keys()]).toEqual(["a", "b"]);
    expect(cards.get("b")).toEqual(b);
    expect(cardRef(a)).toEqual({ $card: "a" });
  });

  it("fails when two different cards share an id", () => {
    expect(() => encodeValue([card("a", true), card("a", false)])).toThrow('two different cards share the id "a"');
  });
});

describe("encodeValue: tags and what cannot be encoded", () => {
  it("passes the rng, deck and throws tags through after checking them", () => {
    expect(encodeValue({ rng: rngSeed(1), pool: deckRef("aws-clf") })).toEqual({ rng: { $rng: { seed: 1 } }, pool: { $deck: "aws-clf" } });
    expect(encodeValue(rngValues([0, 0.5]))).toEqual({ $rng: { values: [0, 0.5] } });
    expect(encodeValue({ $throws: "boom" })).toEqual({ $throws: "boom" });
    expect(encodeValue({ $number: "-0" })).toEqual({ $number: "-0" });
  });

  it("rejects a malformed tag", () => {
    expect(() => encodeValue({ $rng: { seed: -1 } })).toThrow("an rng seed is an unsigned 32-bit integer, not -1");
    expect(() => encodeValue({ $rng: { values: [1] } })).toThrow("an rng value is in [0, 1), not 1");
    expect(() => encodeValue({ $number: "Inf" })).toThrow("malformed $number tag at value");
    expect(() => encodeValue({ $undefined: false })).toThrow("malformed $undefined tag at value");
  });

  it("rejects functions and objects that are not plain data, naming where they are", () => {
    expect(() => encodeValue({ input: { rng: () => 0.5 } })).toThrow("cannot encode a function at value.input.rng: write rngSeed or rngValues");
    expect(() => encodeValue([new Map()])).toThrow("cannot encode a Map at value[0]: write it as plain data");
    expect(() => encodeValue(10n)).toThrow("cannot encode a bigint at value");
  });

  it("keeps an object whose one $ key is not a tag, such as a token", () => {
    expect(encodeValue({ $value: "#a9d6f0" })).toEqual({ $value: "#a9d6f0" });
  });
});

describe("the rng helpers", () => {
  it("rngSeed and rngValues check their arguments", () => {
    expect(rngSeed(4294967295)).toEqual({ $rng: { seed: 4294967295 } });
    expect(() => rngSeed(1.5)).toThrow("an rng seed is an unsigned 32-bit integer, not 1.5");
    expect(() => rngSeed(2 ** 32)).toThrow("not 4294967296");
    expect(() => rngValues([Number.NaN])).toThrow("an rng value is in [0, 1), not NaN");
  });

  it("rngOf runs the mulberry32 stream of a seed and the values of a list, failing when they run out", () => {
    const stream = rngOf(rngSeed(1));
    expect([stream(), stream()].map((x) => x * 2 ** 32)).toEqual([2693262067, 11749833]);
    const listed = rngOf(rngValues([0.25, 0.75]));
    expect([listed(), listed()]).toEqual([0.25, 0.75]);
    expect(() => listed()).toThrow("the rng ran out after 2 values");
  });
});

describe("outputOf", () => {
  it("is the result, or a throws tag with the error's message", () => {
    expect(outputOf(() => 3)).toBe(3);
    expect(outputOf(() => startRound({ mode: "classic", route: { deckId: "d", sectionId: "ALL" }, pool: [], history: {}, seed: 1 }))).toEqual({
      $throws: "The route d/ALL has no cards to deal.",
    });
  });
});

describe("snapshotRound", () => {
  it("writes the state's own fields with the source replaced by its chunk count, in the state's order", () => {
    const pool = Array.from({ length: 12 }, (_, i) => card(`c${i}`, i % 2 === 0));
    const state = startRound({ mode: "timed", route: { deckId: "d", sectionId: "ALL" }, pool, history: {}, seed: 7 });
    const snapshot = snapshotRound(state) as Record<string, unknown>;
    expect(Object.keys(snapshot)).toEqual(["mode", "route", "cards", "index", "answers", "phase", "abandoned", "chunks", "clock"]);
    expect(snapshot.chunks).toBe(1);
    expect(snapshot.cards).toBe(state.cards);
    expect(snapshot.clock).toEqual({ remainingMs: 60000, lastTick: null, hidden: false, holdMs: 0 });
  });
});

describe("goldenFile", () => {
  it("writes the exact text: stable keys, the card table, two-space indent, a final newline", () => {
    const a = card("a");
    const file = goldenFile(META, [{ name: "one card", input: { pool: [a], budget: Infinity, skip: undefined }, output: [a] }]);
    expect(file.path).toBe("native-data/golden/src.engine.demo.demo.json");
    expect(file.content).toBe(
      [
        "{",
        '  "format": 1,',
        '  "module": "src/engine/demo",',
        '  "function": "demo",',
        '  "source": "src/engine/demo.ts",',
        '  "tests": [',
        '    "tests/engine/demo.test.ts"',
        "  ],",
        '  "cards": {',
        '    "a": {',
        '      "id": "a",',
        '      "section": "S01",',
        '      "text": {',
        '        "en": {',
        '          "statement": "Statement a",',
        '          "explanation": "Explanation a"',
        "        }",
        "      },",
        '      "answer": true,',
        '      "source": {',
        '        "title": "Docs",',
        '        "url": "https://docs.example.com/page"',
        "      },",
        '      "difficulty": 1,',
        '      "appliesTo": "",',
        '      "conflictGroups": []',
        "    }",
        "  },",
        '  "cases": [',
        "    {",
        '      "name": "one card",',
        '      "input": {',
        '        "pool": [',
        "          {",
        '            "$card": "a"',
        "          }",
        "        ],",
        '        "budget": {',
        '          "$number": "Infinity"',
        "        }",
        "      },",
        '      "output": [',
        "        {",
        '          "$card": "a"',
        "        }",
        "      ]",
        "    }",
        "  ]",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("writes a constant with a null input", () => {
    const content = goldenFile({ ...META, function: "LIMIT" }, [{ name: "LIMIT", input: null, output: 4 }]).content;
    expect(JSON.parse(content).cases).toEqual([{ name: "LIMIT", input: null, output: 4 }]);
  });

  it("gives the same bytes for the same cases", () => {
    const cases = [{ name: "x", input: { pool: [card("b"), card("a")], rng: rngSeed(3) }, output: [card("a")] }];
    expect(goldenFile(META, cases).content).toBe(goldenFile(META, cases).content);
  });

  it("refuses no cases, a case without a name, two cases with one name and a card reference without its card", () => {
    expect(() => goldenFile(META, [])).toThrow("src/engine/demo.demo has no cases");
    expect(() => goldenFile(META, [{ name: "", input: {}, output: 1 }])).toThrow("has a case without a name");
    expect(() => goldenFile(META, [{ name: "x", input: {}, output: 1 }, { name: "x", input: {}, output: 2 }])).toThrow('has two cases named "x"');
    expect(() => goldenFile(META, [{ name: "x", input: { $card: "ghost" }, output: 1 }])).toThrow('refers to card "ghost", which no case carries');
  });
});

describe("decodeGoldenFile: the round trip", () => {
  it("gives back every value the encoder tagged, with negative zero and NaN intact", () => {
    const a = card("a");
    const b = card("b", false);
    const input = {
      pool: [a, b],
      history: { a: { seen: 3, lastCorrect: false, lastSeenAt: Number.NaN }, b: { seen: 1, lastCorrect: true, lastSeenAt: Infinity } },
      options: { budget: Infinity, floor: -Infinity, zero: -0, plain: 0.1 },
      rng: rngSeed(9),
      deck: deckRef("aws-clf"),
    };
    const output = [b, undefined, { $throws: "nothing" }];
    const decoded = decodeGoldenFile(goldenFile(META, [{ name: "trip", input, output }]).content);
    expect(decoded.meta).toEqual(META);
    expect(decoded.cards).toEqual({ a, b });
    const [only] = decoded.cases;
    expect(only?.input).toEqual(input);
    expect(only?.output).toEqual(output);
    const options = (only?.input as typeof input).options;
    expect(Object.is(options.zero, -0)).toBe(true);
    expect(options.budget).toBe(Infinity);
    expect(options.floor).toBe(-Infinity);
    expect(Number.isNaN((only?.input as typeof input).history.a.lastSeenAt)).toBe(true);
    expect((only?.output as unknown[])[1]).toBeUndefined();
  });

  it("refuses a format it does not know", () => {
    expect(() => decodeGoldenFile('{"format": 2}')).toThrow("unknown golden format 2");
  });
});

describe("encodeValue: a __proto__ key", () => {
  it("keeps an own __proto__ key as a plain key, on the way out and back", () => {
    const value: unknown = JSON.parse('{"cards":{"__proto__":{"seen":1}},"records":{"__proto__":3}}');
    expect(JSON.stringify(encodeValue(value))).toBe('{"cards":{"__proto__":{"seen":1}},"records":{"__proto__":3}}');
    const content = goldenFile(META, [{ name: "proto", input: null, output: value }]).content;
    expect(content).toContain('"__proto__": {');
    const output = decodeGoldenFile(content).cases[0]?.output as { cards: object; records: object };
    expect(Object.keys(output.cards)).toEqual(["__proto__"]);
    expect(Object.keys(output.records)).toEqual(["__proto__"]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail.**

```bash
pnpm vitest run tests/scripts/native/golden-format.test.ts
```

Expected: the suite fails to load with `Error: Cannot find package '@/scripts/native/golden/format' imported from .../tests/scripts/native/golden-format.test.ts`, then `Test Files  1 failed (1)` and `Tests  no tests`.

- [ ] **Step 3: Write the format.**

`scripts/native/golden/format.ts`:

```ts
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

/** An rng argument: the mulberry32 stream of createRng(seed). The seed must be an unsigned 32-bit integer. */
export function rngSeed(seed: number): { $rng: { seed: number } } {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error(`an rng seed is an unsigned 32-bit integer, not ${seed}`);
  }
  return { $rng: { seed } };
}

/** An rng argument that returns these values in order and fails when they run out. */
export function rngValues(values: readonly number[]): { $rng: { values: number[] } } {
  for (const value of values) {
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error(`an rng value is in [0, 1), not ${value}`);
  }
  return { $rng: { values: [...values] } };
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
```

- [ ] **Step 4: Run it green and typecheck.**

```bash
pnpm vitest run tests/scripts/native/golden-format.test.ts
pnpm typecheck
```

Expected: `Test Files  1 passed (1)`, `Tests  23 passed (23)`; `tsc --noEmit` prints nothing and exits 0.

- [ ] **Step 5: Commit.**

```bash
git add scripts/native/golden/format.ts tests/scripts/native/golden-format.test.ts
git commit -m "feat: write the golden vector format the native apps decode: card table, tagged numbers, rng and deck references, stable text"
```

- [ ] **Step 6: Write the registry test and the vector test.**

`tests/scripts/native/registry.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeGoldenFile, goldenPath } from "@/scripts/native/golden/format";
import { NATIVE_FUNCTIONS, goldenProducers, metaOf, nativeFunction } from "@/scripts/native/registry";

const names = (module: string) => NATIVE_FUNCTIONS.filter((entry) => entry.module === module).map((entry) => entry.name);

describe("NATIVE_FUNCTIONS: reference 3.9 as data", () => {
  it("lists 130 functions and constants, each once", () => {
    expect(NATIVE_FUNCTIONS).toHaveLength(130);
    expect(NATIVE_FUNCTIONS.filter((entry) => entry.kind === "constant")).toHaveLength(21);
    const keys = NATIVE_FUNCTIONS.map((entry) => `${entry.module}.${entry.name}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(NATIVE_FUNCTIONS.map((entry) => goldenPath(entry.module, entry.name))).size).toBe(keys.length);
    // One file per entry also on a file system that ignores case (macOS by default).
    expect(new Set(NATIVE_FUNCTIONS.map((entry) => goldenPath(entry.module, entry.name).toLowerCase())).size).toBe(keys.length);
  });

  it("names each entry's web file after its module, and every web file and test file exists", () => {
    for (const entry of NATIVE_FUNCTIONS) {
      expect([`${entry.module}.ts`, `${entry.module}.tsx`, `${entry.module}.json`], entry.name).toContain(entry.source);
      expect(existsSync(entry.source), entry.source).toBe(true);
      expect(entry.tests.length, entry.name).toBeGreaterThan(0);
      for (const test of entry.tests) expect(existsSync(test), test).toBe(true);
    }
  });

  it("names only what its web file defines", () => {
    for (const entry of NATIVE_FUNCTIONS) {
      if (entry.source.endsWith(".json")) continue; // contrastPairs is data computed from the tokens, not a declaration
      const text = readFileSync(entry.source, "utf8");
      expect(new RegExp(`^(export )?(function|const) ${entry.name}\\b`, "m").test(text), `${entry.source}: ${entry.name}`).toBe(true);
    }
  });

  it("keeps the rows of reference 3.9 that this task's producers cover", () => {
    expect(names("src/engine/rng")).toEqual(["createRng", "shuffle"]);
    expect(names("components/format")).toEqual(["pad2"]);
    expect(names("components/Logo")).toEqual(["LogoMark"]);
    expect(names("src/app-state/theme")).toEqual(["parseTheme", "oppositeTheme", "resolveTheme", "switchTheme", "THEME_KEY"]);
    expect(nativeFunction("src/app-state/theme", "THEME_KEY").kind).toBe("constant");
  });

  it("carries the dealing internals reference 3.9 lists as ported", () => {
    expect(names("src/engine/deal")).toEqual([
      "deal", "dealChunk", "dealRanked", "uniqueById", "dealSize", "wasSeen", "wasMissed", "lastSeenAt", "oldestFirst",
      "rankByPriority", "balanceFor", "choose", "searchOverCap", "searchWithAllRules", "relaxStepByStep", "sharesGroup",
      "trueCount", "balanceAllows", "arrange", "joinOf", "runLimit", "placementCheck", "pickAnswer",
      "DEAL", "CHUNK", "SEARCH_BUDGET", "OVERDUE_AFTER_PASSES",
    ]);
  });

  it("leaves out the web-only entriesBehind and the browser storage adapter", () => {
    const all = NATIVE_FUNCTIONS.map((entry) => entry.name);
    expect(all).not.toContain("entriesBehind");
    expect(all).not.toContain("browserLocalStorage");
    expect(() => nativeFunction("components/start/StartFlow", "entriesBehind")).toThrow(
      "components/start/StartFlow.entriesBehind is not in the registry (reference 3.9)",
    );
  });

  it("gives a producer its meta from the registry", () => {
    expect(metaOf("src/engine/rng", "shuffle")).toEqual({
      module: "src/engine/rng",
      function: "shuffle",
      source: "src/engine/rng.ts",
      tests: ["tests/engine/rng.test.ts"],
    });
  });
});

describe("goldenProducers", () => {
  const files = goldenProducers().flatMap((produce) => produce());

  it("writes each file once, for a registered function, with the registry's source and tests", () => {
    const paths = files.map((file) => file.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const file of files) {
      const { meta, cases } = decodeGoldenFile(file.content);
      const entry = nativeFunction(meta.module, meta.function);
      expect(file.path).toBe(goldenPath(entry.module, entry.name));
      expect(meta.source).toBe(entry.source);
      expect(meta.tests.length, file.path).toBeGreaterThan(0);
      for (const test of meta.tests) expect(entry.tests, file.path).toContain(test);
      if (entry.kind === "constant") {
        expect(cases.map((item) => item.input), file.path).toEqual([null]);
      }
    }
  });

  it("gives the same bytes on a second run", () => {
    const again = goldenProducers().flatMap((produce) => produce());
    expect(again).toEqual(files);
  });
});
```

`tests/scripts/native/golden-rng-small.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LogoMark } from "@/components/Logo";
import { pad2 } from "@/components/format";
import { oppositeTheme, parseTheme, resolveTheme, type Theme } from "@/src/app-state/theme";
import { createRng, shuffle } from "@/src/engine/rng";
import { decodeGoldenFile, rngOf, type DecodedGolden } from "@/scripts/native/golden/format";
import { golden as rngGolden } from "@/scripts/native/golden/rng";
import { golden as smallGolden } from "@/scripts/native/golden/small";

const FILES = new Map([...rngGolden(), ...smallGolden()].map((file) => [file.path, decodeGoldenFile(file.content)]));

function vectors(name: string): DecodedGolden {
  const found = FILES.get(`native-data/golden/${name}.json`);
  if (found === undefined) throw new Error(`no golden file ${name}`);
  return found;
}

function output(name: string, caseName: string): unknown {
  const found = vectors(name).cases.find((item) => item.name === caseName);
  if (found === undefined) throw new Error(`no case "${caseName}" in ${name}`);
  return found.output;
}

describe("the files of this task", () => {
  it("are the nine of rng, pad2, the logo and the theme", () => {
    expect([...FILES.keys()]).toEqual([
      "native-data/golden/src.engine.rng.createRng.json",
      "native-data/golden/src.engine.rng.shuffle.json",
      "native-data/golden/components.format.pad2.json",
      "native-data/golden/components.Logo.LogoMark.json",
      "native-data/golden/src.app-state.theme.THEME_KEY.json",
      "native-data/golden/src.app-state.theme.parseTheme.json",
      "native-data/golden/src.app-state.theme.oppositeTheme.json",
      "native-data/golden/src.app-state.theme.resolveTheme.json",
      "native-data/golden/src.app-state.theme.switchTheme.json",
    ]);
  });
});

describe("createRng vectors", () => {
  it("carry the reference values of rng.test.ts", () => {
    const raw = (caseName: string) => (output("src.engine.rng.createRng", caseName) as number[]).slice(0, 3).map((x) => x * 2 ** 32);
    expect(raw("seed 1: the reference values (rng.test.ts)")).toEqual([2693262067, 11749833, 2265367787]);
    expect(raw("seed 42: the reference values (rng.test.ts)")).toEqual([2581720956, 1925393290, 3661312704]);
    expect(raw("seed 0 (rng.test.ts)")).toEqual([1144304738, 1416247, 958946056]);
  });

  it("pin the seed coercion: -1 is 2^32 - 1, 1.9 and 2^32 + 1 are 1", () => {
    expect(output("src.engine.rng.createRng", "seed -1 is 2^32 - 1 (rng.test.ts)")).toEqual(output("src.engine.rng.createRng", "seed 2^32 - 1"));
    const one = output("src.engine.rng.createRng", "seed 1: the reference values (rng.test.ts)");
    expect(output("src.engine.rng.createRng", "seed 1.9 is 1 (rng.test.ts)")).toEqual(one);
    expect(output("src.engine.rng.createRng", "seed 2^32 + 1 is 1 (rng.test.ts)")).toEqual(one);
  });

  it("are what createRng draws for each input", () => {
    for (const { name, input, output: draws } of vectors("src.engine.rng.createRng").cases) {
      const rng = createRng((input as { seed: number }).seed);
      expect((draws as number[]).map(() => rng()), name).toEqual(draws);
    }
  });
});

describe("shuffle vectors", () => {
  it("carry the reference order of rng.test.ts and the draw count", () => {
    expect(output("src.engine.rng.shuffle", "a to h, seed 1: the reference order (rng.test.ts)")).toEqual(["c", "b", "g", "h", "e", "d", "a", "f"]);
    expect(output("src.engine.rng.shuffle", "an empty list draws nothing (rng.test.ts)")).toEqual([]);
    expect(output("src.engine.rng.shuffle", "a single item draws nothing (rng.test.ts)")).toEqual(["only"]);
    expect(output("src.engine.rng.shuffle", "a to h draws exactly 7 values (rng.test.ts: length - 1 draws)")).toEqual(["a", "f", "b", "h", "c", "g", "d", "e"]);
  });

  it("are what shuffle gives for each input, drawing no more values than the file lists", () => {
    for (const { name, input, output: order } of vectors("src.engine.rng.shuffle").cases) {
      const { items, rng } = input as { items: string[]; rng: Parameters<typeof rngOf>[0] };
      expect(shuffle(items, rngOf(rng)), name).toEqual(order);
    }
  });
});

describe("pad2, logo and theme vectors", () => {
  it("carry the pinned values of the web tests", () => {
    expect(vectors("components.format.pad2").cases.slice(0, 4).map((item) => item.output)).toEqual(["00", "07", "14", "120"]);
    expect(output("components.Logo.LogoMark", "the default width 44 gives 30 (Logo.test.tsx)")).toBe(30);
    expect(output("components.Logo.LogoMark", "width 26: the continue line (Logo.test.tsx: 17.73)")).toBe(17.73);
    expect(output("components.Logo.LogoMark", "width 0.33: an exact half, 22.5 hundredths, rounds up to 23, not to the even 22")).toBe(0.23);
    expect(vectors("src.app-state.theme.THEME_KEY").cases).toEqual([{ name: "THEME_KEY", input: null, output: "truthy.theme" }]);
    expect(output("src.app-state.theme.switchTheme", "choice none, system dark")).toEqual({ theme: "light", stored: "light" });
    expect(output("src.app-state.theme.switchTheme", "choice light, system dark")).toEqual({ theme: "dark", stored: "dark" });
  });

  it("are what the web code gives for each input", () => {
    for (const { name, input, output: expected } of vectors("components.format.pad2").cases) {
      expect(pad2((input as { n: number }).n), name).toBe(expected);
    }
    for (const { name, input, output: expected } of vectors("components.Logo.LogoMark").cases) {
      expect(LogoMark(input as { width?: number }).props.height, name).toBe(expected);
    }
    for (const { name, input, output: expected } of vectors("src.app-state.theme.parseTheme").cases) {
      expect(parseTheme((input as { value?: unknown }).value), name).toBe(expected);
    }
    for (const { name, input, output: expected } of vectors("src.app-state.theme.oppositeTheme").cases) {
      expect(oppositeTheme((input as { theme: Theme }).theme), name).toBe(expected);
    }
    for (const { name, input, output: expected } of vectors("src.app-state.theme.resolveTheme").cases) {
      const { choice, systemDark } = input as { choice: Theme | null; systemDark: boolean };
      expect(resolveTheme(choice, systemDark), name).toBe(expected);
      expect(output("src.app-state.theme.switchTheme", name), name).toEqual({ theme: oppositeTheme(expected as Theme), stored: oppositeTheme(expected as Theme) });
    }
  });
});
```

- [ ] **Step 7: Run them and watch them fail.**

```bash
pnpm vitest run tests/scripts/native/registry.test.ts tests/scripts/native/golden-rng-small.test.ts
```

Expected: both suites fail to load, with `Error: Cannot find package '@/scripts/native/registry' imported from .../tests/scripts/native/registry.test.ts` and `Error: Cannot find package '@/scripts/native/golden/rng' imported from .../tests/scripts/native/golden-rng-small.test.ts`; `Test Files  2 failed (2)`, `Tests  no tests`.

- [ ] **Step 8: Write the registry.**

`scripts/native/registry.ts`:

```ts
// Reference section 3.9 as data: every function and constant the native apps port, with the web file it lives
// in and the web tests that pin it. Each entry gets one golden file (goldenPath of its module and name); task 9's
// coverage test fails for an entry without one. Left out on purpose, as the spec says: the web-only
// entriesBehind (components/start/StartFlow.tsx) and the browser storage adapter browserLocalStorage
// (src/progress/local.ts). canStillFinish is a closure inside searchWithAllRules and is pinned through it.

import type { GoldenFile, GoldenMeta } from "./golden/format";
import { golden as rngGolden } from "./golden/rng";
import { golden as smallGolden } from "./golden/small";

export interface NativeFunction {
  module: string;
  name: string;
  source: string;
  tests: readonly string[];
  kind: "function" | "constant";
}

interface Row {
  module: string;
  source: string;
  tests: readonly string[];
  functions: readonly string[];
  constants: readonly string[];
}

const ROWS: readonly Row[] = [
  {
    module: "src/engine/rng",
    source: "src/engine/rng.ts",
    tests: ["tests/engine/rng.test.ts"],
    functions: ["createRng", "shuffle"],
    constants: [],
  },
  {
    module: "src/engine/deal",
    source: "src/engine/deal.ts",
    tests: [
      "tests/engine/deal.test.ts",
      "tests/engine/deal-pins-polish.test.ts",
      "tests/engine/chunks.test.ts",
      "tests/engine/missed-cap-polish.test.ts",
      "tests/engine/search-polish.test.ts",
      "tests/engine/overdue-polish.test.ts",
      "tests/engine/overdue-boundary.test.ts",
      "tests/engine/deal.property.test.ts",
      "tests/content/shipped-dealing-polish.test.ts",
    ],
    functions: [
      "deal",
      "dealChunk",
      "dealRanked",
      "uniqueById",
      "dealSize",
      "wasSeen",
      "wasMissed",
      "lastSeenAt",
      "oldestFirst",
      "rankByPriority",
      "balanceFor",
      "choose",
      "searchOverCap",
      "searchWithAllRules",
      "relaxStepByStep",
      "sharesGroup",
      "trueCount",
      "balanceAllows",
      "arrange",
      "joinOf",
      "runLimit",
      "placementCheck",
      "pickAnswer",
    ],
    constants: ["DEAL", "CHUNK", "SEARCH_BUDGET", "OVERDUE_AFTER_PASSES"],
  },
  {
    module: "src/engine/round",
    source: "src/engine/round.ts",
    tests: ["tests/engine/round.test.ts", "tests/engine/modes.test.ts", "tests/engine/timed.test.ts", "tests/engine/clock-polish.test.ts"],
    functions: ["startRound", "reduce", "currentCard", "lastAnswer", "wrongCount", "livesLeft", "isDecided", "scoreOf", "summarise", "chunkSeed"],
    constants: ["CLASSIC_LENGTH", "LIVES", "TIMED"],
  },
  {
    module: "src/input/swipe",
    source: "src/input/swipe.ts",
    tests: ["tests/input/swipe.test.ts", "tests/input/swipe-polish.test.ts", "tests/input/swipe-early-touch-polish.test.ts"],
    functions: ["intent", "canStart", "interpret"],
    constants: ["SWIPE"],
  },
  {
    module: "src/progress/progress",
    source: "src/progress/progress.ts",
    tests: ["tests/progress/progress.test.ts", "tests/progress/progress-polish.test.ts", "tests/progress/partial-read.test.ts"],
    functions: ["emptyProgress", "recordKey", "bestFor", "compareWithBest", "applyResult", "pruneDeck", "seenShare", "readProgress", "parseProgress"],
    constants: [],
  },
  {
    module: "src/progress/local",
    source: "src/progress/local.ts",
    tests: ["tests/progress/local.test.ts", "tests/progress/partial-read.test.ts"],
    functions: ["createLocalStore"],
    constants: ["PROGRESS_KEY", "UNREADABLE_KEY"],
  },
  {
    module: "src/content/schema",
    source: "src/content/schema.ts",
    tests: ["tests/content/schema.test.ts", "tests/content/schema-polish.test.ts"],
    functions: ["deckPassName", "routeKey", "findRoute"],
    constants: ["WHOLE_DECK"],
  },
  {
    module: "src/content/load",
    source: "src/content/load.ts",
    tests: ["tests/content/load.test.ts"],
    functions: ["poolFor"],
    constants: [],
  },
  {
    module: "src/content/text",
    source: "src/content/text.ts",
    tests: ["tests/content/text.test.ts"],
    functions: ["textParts", "plainText"],
    constants: [],
  },
  {
    module: "src/app-state/modes",
    source: "src/app-state/modes.ts",
    tests: ["tests/app-state/modes.test.ts", "tests/app-state/modes-polish.test.ts", "tests/app-state/modes-score-copy-polish.test.ts"],
    functions: ["modeInfo", "isOffered", "lastScoreText"],
    constants: ["MODE_TABLE"],
  },
  {
    module: "src/app-state/theme",
    source: "src/app-state/theme.ts",
    tests: ["tests/app-state/theme.test.ts", "tests/app-state/theme-polish.test.ts"],
    functions: ["parseTheme", "oppositeTheme", "resolveTheme", "switchTheme"],
    constants: ["THEME_KEY"],
  },
  {
    module: "components/start/useCatalog",
    source: "components/start/useCatalog.ts",
    tests: ["tests/components/start/useCatalog.test.tsx", "tests/components/start/unoffered.test.tsx"],
    functions: ["deckCount", "decksLabel", "deckOfCard", "seenPercent", "continueTarget", "recentDecks", "withoutRemovedCards"],
    constants: ["RECENT_LIMIT"],
  },
  {
    module: "components/start/StartFlow",
    source: "components/start/StartFlow.tsx",
    tests: ["tests/components/start/StartFlow.test.tsx", "tests/components/start/unoffered.test.tsx"],
    functions: ["stepOf", "clearFrom", "pathTo", "previousStep", "chosenOn", "canShow"],
    constants: ["STEP_OF"],
  },
  {
    module: "components/start/listCue",
    source: "components/start/listCue.ts",
    tests: ["tests/components/start/listCue.test.tsx", "tests/components/start/reveal-on-return.test.tsx"],
    functions: ["listCue", "revealDelta"],
    constants: ["FADE_PX"],
  },
  {
    module: "components/FillInPass",
    source: "components/FillInPass.tsx",
    tests: ["tests/components/FillInPass.test.tsx"],
    functions: ["changeLabel"],
    constants: [],
  },
  {
    module: "components/start/ContinueLine",
    source: "components/start/ContinueLine.tsx",
    tests: ["tests/components/start/ContinueLine.test.tsx", "tests/components/start/continue-line-polish.test.tsx"],
    functions: ["continueLabel"],
    constants: [],
  },
  {
    module: "components/play/PlayScreen",
    source: "components/play/PlayScreen.tsx",
    tests: [
      "tests/components/play/PlayScreenTimed.test.tsx",
      "tests/components/play/timed-applies-to-polish.test.ts",
      "tests/components/play/round-status-voice.test.tsx",
    ],
    functions: ["verdictText", "roundStatus", "timedStatus", "timedCardText"],
    constants: ["NEXT_ARRIVES_MS", "SPOKEN_RELEASE_MS"],
  },
  {
    module: "components/play/leave",
    source: "components/play/leave.ts",
    tests: ["tests/components/play/leave.test.ts"],
    functions: ["leavesSomething", "saveLeftRound"],
    constants: [],
  },
  {
    module: "components/play/resultCopy",
    source: "components/play/resultCopy.ts",
    tests: ["tests/components/play/resultCopy.test.ts"],
    functions: ["resultCopy"],
    constants: [],
  },
  {
    module: "components/play/ResultView",
    source: "components/play/ResultView.tsx",
    tests: ["tests/components/play/ResultView.test.tsx"],
    functions: ["recordRound"],
    constants: ["RESULT_ARRIVES_MS"],
  },
  {
    module: "components/MissedCards",
    source: "components/MissedCards.tsx",
    tests: ["tests/components/MissedCards.test.tsx", "tests/components/missed-cards-applies-to-polish.test.tsx"],
    functions: ["missedCards"],
    constants: [],
  },
  {
    module: "components/play/ticketScroll",
    source: "components/play/ticketScroll.ts",
    tests: ["tests/components/play/ticketScroll.test.ts"],
    functions: ["statementScroll", "slipScroll", "keyScroll"],
    constants: ["ARROW_STEP"],
  },
  {
    module: "components/FlightPath",
    source: "components/FlightPath.tsx",
    tests: ["tests/components/FlightPath.test.tsx", "tests/components/FlightPath-polish.test.tsx"],
    functions: ["pointAt", "waypointT", "flownPath", "headingAt", "waypointStates", "cardList", "flightPathLabel", "completedLabel", "completedScale"],
    constants: [],
  },
  {
    module: "components/StreakPath",
    source: "components/StreakPath.tsx",
    tests: ["tests/components/StreakPath.test.tsx", "tests/components/StreakPath-polish.test.tsx"],
    functions: ["streakLayout", "streakLabel"],
    constants: [],
  },
  {
    module: "components/LivesPath",
    source: "components/LivesPath.tsx",
    tests: ["tests/components/LivesPath.test.tsx", "tests/components/LivesPath-polish.test.tsx"],
    functions: ["trailLayout", "livesLabel"],
    constants: [],
  },
  {
    module: "components/TimedPath",
    source: "components/TimedPath.tsx",
    tests: ["tests/components/TimedPath.test.tsx", "tests/components/TimedPath-polish.test.tsx"],
    functions: ["clockText", "timedLabel"],
    constants: [],
  },
  {
    module: "components/BoardingPass",
    source: "components/BoardingPass.tsx",
    tests: ["tests/components/BoardingPass.test.tsx"],
    functions: ["barcodeBars"],
    constants: [],
  },
  {
    module: "components/format",
    source: "components/format.ts",
    tests: ["tests/components/format.test.ts"],
    functions: ["pad2"],
    constants: [],
  },
  {
    module: "components/play/useRound",
    source: "components/play/useRound.ts",
    tests: ["tests/components/play/useRound.test.tsx"],
    functions: ["ticketFor"],
    constants: [],
  },
  {
    // The vector is the mark's height for a width: round(width * 30 / 44 * 100) / 100 (Logo.tsx:20).
    module: "components/Logo",
    source: "components/Logo.tsx",
    tests: ["tests/components/Logo.test.tsx"],
    functions: ["LogoMark"],
    constants: [],
  },
  {
    // The contrast pairs of the design system as one constant: the pairs are those of tests/tokens/contrast.test.ts,
    // the colours come from design/system/tokens.json.
    module: "design/system/tokens",
    source: "design/system/tokens.json",
    tests: ["tests/tokens/contrast.test.ts"],
    functions: [],
    constants: ["contrastPairs"],
  },
];

export const NATIVE_FUNCTIONS: readonly NativeFunction[] = ROWS.flatMap((row) => [
  ...row.functions.map((name) => ({ module: row.module, name, source: row.source, tests: row.tests, kind: "function" as const })),
  ...row.constants.map((name) => ({ module: row.module, name, source: row.source, tests: row.tests, kind: "constant" as const })),
]);

/** The registry entry of a function or constant; throws for a name reference 3.9 does not list. */
export function nativeFunction(module: string, name: string): NativeFunction {
  const found = NATIVE_FUNCTIONS.find((entry) => entry.module === module && entry.name === name);
  if (found === undefined) throw new Error(`${module}.${name} is not in the registry (reference 3.9)`);
  return found;
}

/** The meta of a golden file, read from the registry, so a producer never types a source or a test path. */
export function metaOf(module: string, name: string): GoldenMeta {
  const entry = nativeFunction(module, name);
  return { module: entry.module, function: entry.name, source: entry.source, tests: entry.tests };
}

/** One producer per scripts/native/golden/<group>.ts. Tasks 5 to 8 add theirs to this list. */
export function goldenProducers(): readonly (() => GoldenFile[])[] {
  return [rngGolden, smallGolden];
}
```

- [ ] **Step 9: Write the two producers.**

`scripts/native/golden/rng.ts`:

```ts
// Golden vectors of src/engine/rng.ts: the mulberry32 stream for a seed and the Fisher-Yates shuffle. The pinned
// cases of tests/engine/rng.test.ts come first, then seeds that exercise the 32-bit wrap and the seed coercion.

import { createRng, shuffle } from "@/src/engine/rng";
import { metaOf } from "../registry";
import { goldenFile, rngOf, rngSeed, rngValues, type GoldenCase, type GoldenFile } from "./format";

const MODULE = "src/engine/rng";
const EIGHT = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** The first `count` draws of createRng(seed). A native test draws output.length values. */
function draws(seed: number, count: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng());
}

function createRngCases(): GoldenCase[] {
  const seeds: readonly [string, number, number][] = [
    ["seed 1: the reference values (rng.test.ts)", 1, 10],
    ["seed 42: the reference values (rng.test.ts)", 42, 10],
    ["seed 0 (rng.test.ts)", 0, 10],
    ["seed -1 is 2^32 - 1 (rng.test.ts)", -1, 10],
    ["seed 2^32 - 1", 4294967295, 10],
    ["seed 1.9 is 1 (rng.test.ts)", 1.9, 10],
    ["seed 2^32 + 1 is 1 (rng.test.ts)", 4294967297, 10],
    ["seed 2^31", 2147483648, 10],
    ["seed 0x6d2b79f5, the stream's own increment", 0x6d2b79f5, 10],
    ["seed 7 (rng.test.ts: the same sequence for the same seed)", 7, 50],
    ["seed 3 (rng.test.ts: two generators stay independent)", 3, 10],
    ["seed 123, a long stream (rng.test.ts: stays in [0, 1))", 123, 200],
  ];
  return seeds.map(([name, seed, count]) => ({ name, input: { seed }, output: draws(seed, count) }));
}

function shuffleCase(name: string, items: readonly string[], rng: ReturnType<typeof rngSeed> | ReturnType<typeof rngValues>): GoldenCase {
  return { name, input: { items, rng }, output: shuffle(items, rngOf(rng)) };
}

function shuffleCases(): GoldenCase[] {
  return [
    shuffleCase("a to h, seed 1: the reference order (rng.test.ts)", EIGHT, rngSeed(1)),
    shuffleCase("a to h, seed 5 (rng.test.ts: a permutation)", EIGHT, rngSeed(5)),
    shuffleCase("a to h, seed 11 (rng.test.ts: deterministic for a seed)", EIGHT, rngSeed(11)),
    shuffleCase("an empty list draws nothing (rng.test.ts)", [], rngValues([])),
    shuffleCase("a single item draws nothing (rng.test.ts)", ["only"], rngValues([])),
    shuffleCase("a to h draws exactly 7 values (rng.test.ts: length - 1 draws)", EIGHT, rngValues([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])),
    shuffleCase("w to z with the lowest, the highest and a middle draw", ["w", "x", "y", "z"], rngValues([0, 0.9999999999, 0.5])),
    shuffleCase("w to z, seed 0 (rng.test.ts: every item in every position)", ["w", "x", "y", "z"], rngSeed(0)),
    shuffleCase("w to z, seed 1999", ["w", "x", "y", "z"], rngSeed(1999)),
    shuffleCase(
      "twenty items, seed 4294967295",
      Array.from({ length: 20 }, (_, i) => `item-${i}`),
      rngSeed(4294967295),
    ),
  ];
}

export function golden(): GoldenFile[] {
  return [goldenFile(metaOf(MODULE, "createRng"), createRngCases()), goldenFile(metaOf(MODULE, "shuffle"), shuffleCases())];
}
```

`scripts/native/golden/small.ts`:

```ts
// Golden vectors of the small helpers: pad2 (components/format.ts), the logo mark's height (components/Logo.tsx)
// and the theme rules (src/app-state/theme.ts). Each output comes from calling the web code.

import { LogoMark } from "@/components/Logo";
import { pad2 } from "@/components/format";
import { THEME_KEY, oppositeTheme, parseTheme, resolveTheme, switchTheme, type Theme } from "@/src/app-state/theme";
import { metaOf } from "../registry";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

function pad2Cases(): GoldenCase[] {
  const pinned = [0, 7, 14, 120]; // tests/components/format.test.ts
  const edges = [1, 9, 10, 99, 100];
  return [...pinned, ...edges].map((n) => ({ name: `pad2(${n})`, input: { n }, output: pad2(n) }));
}

/** The height LogoMark draws for these props: the svg's height attribute, computed by the component itself. */
function logoHeight(props: { width?: number }): number {
  const height: unknown = LogoMark(props).props.height;
  if (typeof height !== "number") throw new Error("LogoMark drew no numeric height");
  return height;
}

function logoCases(): GoldenCase[] {
  const cases: GoldenCase[] = [{ name: "the default width 44 gives 30 (Logo.test.tsx)", input: {}, output: logoHeight({}) }];
  const widths: readonly [number, string][] = [
    [44, "next to the wordmark"],
    [26, "the continue line (Logo.test.tsx: 17.73)"],
    [20, "the compact pass band"],
    [1, "one pixel"],
    [13, "rounds down"],
    [36, "rounds up"],
    [100, "a wide mark"],
    [0.11, "an exact half, 7.5 hundredths, rounds up to 8"],
    [0.33, "an exact half, 22.5 hundredths, rounds up to 23, not to the even 22"],
    [2.53, "an exact half, 172.5 hundredths, rounds up to 173, not to the even 172"],
  ];
  for (const [width, why] of widths) {
    cases.push({ name: `width ${width}: ${why}`, input: { width }, output: logoHeight({ width }) });
  }
  return cases;
}

function parseThemeCases(): GoldenCase[] {
  // tests/app-state/theme.test.ts: light and dark, then every garbage value it lists. undefined is the empty input.
  const values: readonly [string, unknown][] = [
    ["light", "light"],
    ["dark", "dark"],
    ["null", null],
    ["undefined", undefined],
    ["the empty string", ""],
    ['"Dark"', "Dark"],
    ['" dark"', " dark"],
    ['"system"', "system"],
    ['"auto"', "auto"],
    ['"1"', "1"],
    ["the number 1", 1],
    ["an empty object", {}],
    ['the array ["dark"]', ["dark"]],
    ['the JSON string "\\"dark\\"" (theme.test.ts: readThemeChoice)', '"dark"'],
    ['"purple" (theme.test.ts: readThemeChoice)', "purple"],
  ];
  return values.map(([name, value]) => ({ name, input: value === undefined ? {} : { value }, output: parseTheme(value) }));
}

function oppositeThemeCases(): GoldenCase[] {
  return (["light", "dark"] as const).map((theme) => ({ name: theme, input: { theme }, output: oppositeTheme(theme) }));
}

const CHOICES: readonly (Theme | null)[] = [null, "light", "dark"];

function resolveThemeCases(): GoldenCase[] {
  return CHOICES.flatMap((choice) =>
    [false, true].map((systemDark) => ({
      name: `choice ${choice ?? "none"}, system ${systemDark ? "dark" : "light"}`,
      input: { choice, systemDark },
      output: resolveTheme(choice, systemDark),
    })),
  );
}

/**
 * The flip rule of switchTheme, run on a page whose data-theme attribute holds `choice` (none: the page follows
 * the system), a working storage and a system setting. The vector describes the page by what the rule reads.
 */
function switchOnce(choice: Theme | null, systemDark: boolean): { theme: Theme; stored: string | null } {
  const attributes = new Map<string, string>(choice === null ? [] : [["data-theme", choice]]);
  const page = {
    documentElement: {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => void attributes.set(name, value),
    },
    querySelectorAll: () => [],
  } as unknown as Document;
  const stored = new Map<string, string>();
  const storage = { setItem: (key: string, value: string) => void stored.set(key, value) };
  const query = { matches: systemDark, addEventListener: () => {}, removeEventListener: () => {} };
  const theme = switchTheme(page, storage, () => query);
  if (attributes.get("data-theme") !== theme) throw new Error("switchTheme left another theme on the page");
  return { theme, stored: stored.get(THEME_KEY) ?? null };
}

function switchThemeCases(): GoldenCase[] {
  return CHOICES.flatMap((choice) =>
    [false, true].map((systemDark) => ({
      name: `choice ${choice ?? "none"}, system ${systemDark ? "dark" : "light"}`,
      input: { choice, systemDark },
      output: switchOnce(choice, systemDark),
    })),
  );
}

export function golden(): GoldenFile[] {
  const theme = "src/app-state/theme";
  return [
    goldenFile(metaOf("components/format", "pad2"), pad2Cases()),
    goldenFile(metaOf("components/Logo", "LogoMark"), logoCases()),
    goldenFile(metaOf(theme, "THEME_KEY"), [{ name: "THEME_KEY", input: null, output: THEME_KEY }]),
    goldenFile(metaOf(theme, "parseTheme"), parseThemeCases()),
    goldenFile(metaOf(theme, "oppositeTheme"), oppositeThemeCases()),
    goldenFile(metaOf(theme, "resolveTheme"), resolveThemeCases()),
    goldenFile(metaOf(theme, "switchTheme"), switchThemeCases()),
  ];
}
```

- [ ] **Step 10: Run the three test files green.**

```bash
pnpm vitest run tests/scripts/native
```

Expected: `Test Files  7 passed (7)`, `Tests  121 passed (121)`: this task's format 23, registry 9 and vectors 8, plus task 2's `tokens.test.ts` (22) and `token-overrides.test.ts` (31) and task 3's `decks.test.ts` (25) and `decks-content.test.ts` (3).

- [ ] **Step 11: Run the gates.**

```bash
pnpm typecheck
git add -N scripts/native tests/scripts/native
pnpm test
git reset -q scripts/native tests/scripts/native
```

Expected: `tsc --noEmit` prints nothing and exits 0. `pnpm test` ends with `Test Files  158 passed (158)` and `Tests  3265 passed (3265)`: task 3's 155 and 3225 plus this task's 3 files and 40 tests. `tests/repo-hygiene.test.ts` passes with the new files marked intent-to-add (the `git reset` only unmarks them; step 12 adds them for real).

- [ ] **Step 12: Commit.**

```bash
git add scripts/native/registry.ts scripts/native/golden/rng.ts scripts/native/golden/small.ts tests/scripts/native/registry.test.ts tests/scripts/native/golden-rng-small.test.ts
git commit -m "feat: list the functions of reference 3.9 the native apps port, and write the first golden vectors: rng, shuffle, pad2, the logo height and the theme rules"
```

**Tried:** in a throwaway worktree at 6f0f3dc (no tasks 1 to 3 needed: this task consumes none of their code): both failing runs gave the messages above; then `22 passed (22)` for the format and `39 passed (39)` for the three files; `pnpm typecheck` exit 0; `pnpm test` `153 passed (153)` files and `3146 passed (3146)` tests; `tests/repo-hygiene.test.ts` green with the new files intent-to-add. The nine files the producers write were read back: `src.engine.rng.createRng.json` is 11,742 bytes, the largest; none carries a card. The review then changed this task (the `__proto__` test and its fix, the contrast row, the MissedCards tests, `decodeValue` exported); the counts of steps 4, 10 and 11 are computed from those changes, not measured.
