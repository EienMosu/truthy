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
