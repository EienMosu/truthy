import { describe, expect, it } from "vitest";
import { DeckBuildError } from "@/src/content/build";
import { DeckFileSchema, DeckIndexSchema } from "@/src/content/schema";
import { manifestOf, manifestText, nativeDecks, parseManifest, type Manifest } from "@/scripts/native/decks";

// A catalog of two decks: "alpha" with two sections, "beta" without any (its cards sit in the whole deck).
const CATALOG = {
  areas: [
    {
      id: "cloud",
      title: "Cloud",
      platforms: [
        {
          id: "aws",
          title: "AWS",
          decks: [
            {
              id: "alpha",
              code: "ALP",
              title: "Alpha",
              sections: [
                { id: "AAA", title: "First", match: ["a"] },
                { id: "BBB", title: "Second", match: ["b"] },
              ],
            },
            { id: "beta", code: "BET", title: "Beta", passName: "Beta Pass", sections: [] },
          ],
        },
      ],
    },
  ],
};

function reviewedCard(id: string, section: string | undefined, statement: string) {
  return {
    id,
    ...(section === undefined ? {} : { section }),
    statement,
    answer: true,
    explanation: `Explanation of ${id}.`,
    difficulty: 2,
    source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
    conflictGroups: [],
    pipelineOnlyField: "dropped from the shipped card",
  };
}

function reviewed() {
  return {
    alpha: {
      deck: "alpha",
      cards: [reviewedCard("alpha-1", "a", "One."), reviewedCard("alpha-2", "b", "Two."), reviewedCard("alpha-3", "a", "Three.")],
    },
    beta: { deck: "beta", cards: [reviewedCard("beta-1", undefined, "Uno."), reviewedCard("beta-2", undefined, "Dos.")] },
  };
}

describe("nativeDecks without a manifest", () => {
  it("writes the index and one file per deck under native-data/decks, in catalog order", () => {
    const { files } = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    expect(Object.keys(files)).toEqual(["native-data/decks/index.json", "native-data/decks/alpha.json", "native-data/decks/beta.json"]);
  });

  it("stamps the index with today's date and records a hash for every deck", () => {
    const result = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    expect(result.deckIndexVersion).toBe("2026-10-15");
    const index = DeckIndexSchema.parse(JSON.parse(result.files["native-data/decks/index.json"] ?? ""));
    const decks = index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks));
    expect(decks.map((deck) => [deck.id, deck.version])).toEqual([
      ["alpha", "2026-10-15"],
      ["beta", "2026-10-15"],
    ]);
    expect(Object.keys(result.deckHashes)).toEqual(["alpha", "beta"]);
    for (const deck of decks) expect(result.deckHashes[deck.id]).toBe(deck.hash);
    for (const hash of Object.values(result.deckHashes)) expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("writes the deck files as the web build does: compact JSON, no trailing newline, cards in file order, pipeline fields dropped", () => {
    const { files } = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    const text = files["native-data/decks/alpha.json"] ?? "";
    expect(text.endsWith("\n")).toBe(false);
    expect(text).not.toContain("\n");
    expect(text).not.toContain("pipelineOnlyField");
    const deck = DeckFileSchema.parse(JSON.parse(text));
    expect(deck.cards.map((card) => card.id)).toEqual(["alpha-1", "alpha-2", "alpha-3"]);
    expect(deck.cards.map((card) => card.section)).toEqual(["AAA", "BBB", "AAA"]);
    expect(Object.keys(deck.cards[0] ?? {})).toEqual(["id", "section", "text", "answer", "source", "difficulty", "appliesTo", "conflictGroups"]);
    const beta = DeckFileSchema.parse(JSON.parse(files["native-data/decks/beta.json"] ?? ""));
    expect(beta.cards.map((card) => card.section)).toEqual(["ALL", "ALL"]);
  });

  it("is deterministic: the same input twice gives the same result", () => {
    const first = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    const second = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    expect(second).toEqual(first);
  });

  it("leaves a reviewed file that is not in the catalog out, as the web build does", () => {
    const input = { ...reviewed(), orphan: { deck: "orphan", cards: [reviewedCard("orphan-1", undefined, "Lost.")] } };
    const { files, deckHashes } = nativeDecks({ catalog: CATALOG, reviewed: input, previous: null, today: "2026-10-15" });
    expect(Object.keys(files)).not.toContain("native-data/decks/orphan.json");
    expect(Object.keys(deckHashes)).toEqual(["alpha", "beta"]);
  });

  it("fails like the web build on a bad catalog or a bad deck, and on a date that is not a date", () => {
    expect(() => nativeDecks({ catalog: { areas: "no" }, reviewed: reviewed(), previous: null, today: "2026-10-15" })).toThrow(DeckBuildError);
    const broken = { ...reviewed(), beta: { deck: "beta", cards: [reviewedCard("gamma-1", undefined, "Wrong prefix.")] } };
    expect(() => nativeDecks({ catalog: CATALOG, reviewed: broken, previous: null, today: "2026-10-15" })).toThrow(/beta: card gamma-1/);
    expect(() => nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "15.10.2026" })).toThrow(/ISO date/);
  });
});

// Review Focus 2 of the plan: exporting on another day with unchanged decks gives the same bytes.
describe("nativeDecks with the manifest of an earlier export", () => {
  function firstExport(): { files: Record<string, string>; manifest: Manifest } {
    const result = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    return { files: result.files, manifest: { format: 1, generator: 1, deckIndexVersion: result.deckIndexVersion, deckHashes: result.deckHashes } };
  }

  it("keeps the recorded version on a later day while every deck hash is unchanged: byte-identical files, the index included", () => {
    const { files, manifest } = firstExport();
    const later = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: manifest, today: "2026-11-02" });
    expect(later.deckIndexVersion).toBe("2026-10-15");
    expect(later.deckHashes).toEqual(manifest.deckHashes);
    expect(later.files).toEqual(files);
    const index = later.files["native-data/decks/index.json"] ?? "";
    expect(index).toBe(files["native-data/decks/index.json"]);
    expect(index).toContain('"version":"2026-10-15"');
    expect(index).not.toContain("2026-11-02");
  });

  it("gives the same result for two runs on two different days", () => {
    const { manifest } = firstExport();
    const dayOne = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: manifest, today: "2027-01-01" });
    const dayTwo = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: manifest, today: "2027-06-30" });
    expect(dayTwo).toEqual(dayOne);
  });

  it("moves to today when one card changes: the whole index gets the new version, only the changed deck file differs", () => {
    const { files, manifest } = firstExport();
    const edited = reviewed();
    edited.alpha.cards[1] = reviewedCard("alpha-2", "b", "Two, corrected.");
    const later = nativeDecks({ catalog: CATALOG, reviewed: edited, previous: manifest, today: "2026-11-02" });
    expect(later.deckIndexVersion).toBe("2026-11-02");
    expect(later.deckHashes.alpha).not.toBe(manifest.deckHashes.alpha);
    expect(later.deckHashes.beta).toBe(manifest.deckHashes.beta);
    expect(later.files["native-data/decks/beta.json"]).toBe(files["native-data/decks/beta.json"]);
    expect(later.files["native-data/decks/alpha.json"]).not.toBe(files["native-data/decks/alpha.json"]);
    const index = DeckIndexSchema.parse(JSON.parse(later.files["native-data/decks/index.json"] ?? ""));
    const versions = index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks.map((deck) => deck.version)));
    expect(versions).toEqual(["2026-11-02", "2026-11-02"]);
  });

  it("moves to today when a deck is removed from the build", () => {
    const { manifest } = firstExport();
    const withoutBeta = { alpha: reviewed().alpha };
    expect(nativeDecks({ catalog: CATALOG, reviewed: withoutBeta, previous: manifest, today: "2026-11-02" }).deckIndexVersion).toBe("2026-11-02");
  });

  it("moves to today when a deck is added to the build", () => {
    const { manifest } = firstExport();
    const onlyBeta: Manifest = { ...manifest, deckHashes: { beta: manifest.deckHashes.beta ?? "" } };
    expect(nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: onlyBeta, today: "2026-11-02" }).deckIndexVersion).toBe("2026-11-02");
  });

  it("moves to today when a deck keeps its cards and changes only their order", () => {
    const { manifest } = firstExport();
    const swapped = reviewed();
    swapped.beta.cards.reverse();
    expect(nativeDecks({ catalog: CATALOG, reviewed: swapped, previous: manifest, today: "2026-11-02" }).deckIndexVersion).toBe("2026-11-02");
  });

  it("does not care in which order the manifest lists its hashes", () => {
    const { files, manifest } = firstExport();
    const reversed: Manifest = { ...manifest, deckHashes: Object.fromEntries(Object.entries(manifest.deckHashes).reverse()) };
    expect(nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: reversed, today: "2026-11-02" }).files).toEqual(files);
  });

  it("fails when the kept version is not a date, instead of writing it into the index", () => {
    const { manifest } = firstExport();
    const damaged: Manifest = { ...manifest, deckIndexVersion: "yesterday" };
    expect(() => nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: damaged, today: "2026-11-02" })).toThrow(/ISO date/);
  });
});

describe("the manifest", () => {
  const HASH_A = "0123456789abcdef";
  const HASH_B = "fedcba9876543210";
  const manifest: Manifest = { format: 1, generator: 1, deckIndexVersion: "2026-10-15", deckHashes: { beta: HASH_B, alpha: HASH_A } };

  it("manifestOf takes the version and the hashes of an export", () => {
    const result = nativeDecks({ catalog: CATALOG, reviewed: reviewed(), previous: null, today: "2026-10-15" });
    expect(manifestOf(result)).toEqual({ format: 1, generator: 1, deckIndexVersion: "2026-10-15", deckHashes: result.deckHashes });
  });

  it("manifestText is two-space JSON with a final newline, the format, generator and version first, the decks by name", () => {
    expect(manifestText(manifest)).toBe(
      [
        "{",
        '  "format": 1,',
        '  "generator": 1,',
        '  "deckIndexVersion": "2026-10-15",',
        '  "deckHashes": {',
        `    "alpha": "${HASH_A}",`,
        `    "beta": "${HASH_B}"`,
        "  }",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("manifestText does not depend on the order the hashes were collected in", () => {
    const other: Manifest = { ...manifest, deckHashes: { alpha: HASH_A, beta: HASH_B } };
    expect(manifestText(other)).toBe(manifestText(manifest));
  });

  it("parseManifest reads back what manifestText wrote", () => {
    expect(parseManifest(JSON.parse(manifestText(manifest)))).toEqual(manifest);
  });

  it("parseManifest keeps the four fields and drops any other", () => {
    expect(parseManifest({ ...manifest, extra: "7" })).toEqual(manifest);
  });

  it.each<[string, unknown, RegExp]>([
    ["a value that is not an object", "manifest", /^manifest\.json: /],
    ["another format", { ...manifest, format: 2 }, /^manifest\.json: format: /],
    ["a missing version", { format: 1, generator: 1, deckHashes: {} }, /^manifest\.json: deckIndexVersion: /],
    ["a version that is not a date", { ...manifest, deckIndexVersion: "yesterday" }, /^manifest\.json: deckIndexVersion: /],
    ["hashes that are an array", { ...manifest, deckHashes: [HASH_A] }, /^manifest\.json: deckHashes: /],
    ["a hash that is not 16 hex characters", { ...manifest, deckHashes: { alpha: "xyz" } }, /^manifest\.json: deckHashes\.alpha: /],
  ])("parseManifest rejects %s", (_name, raw, message) => {
    expect(() => parseManifest(raw)).toThrow(message);
  });
});
