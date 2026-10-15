// Reads a golden vector file back the way plans B and C read it (README, "The golden vector format"), so the web tests
// can run every case again and compare what the TypeScript gives with what the file says.
import { goldenFile, rngOf } from "@/scripts/native/golden/format";
import type { Card } from "@/src/content/schema";

export interface GoldenJson {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, Card>;
  cases: { name: string; input: unknown; output: unknown }[];
}

export function parseGolden(content: string): GoldenJson {
  return JSON.parse(content) as GoldenJson;
}

// {"$card"} is the card of the table (the same object for every reference), {"$deck"} the deck's cards in file order
// (taken from the table where it has them), {"$rng"} a fresh generator built by the format's own rngOf (a seed's
// stream, or the listed values, failing with the format's message when they run out), {"$number"} and
// {"$undefined"} what they name.
export function decode(value: unknown, cards: Readonly<Record<string, Card>>, decks: ReadonlyMap<string, readonly Card[]>): unknown {
  if (Array.isArray(value)) return value.map((item) => decode(item, cards, decks));
  if (value === null || typeof value !== "object") return value;
  const tagged = value as Record<string, unknown>;
  if (typeof tagged.$card === "string") {
    const card = cards[tagged.$card];
    if (card === undefined) throw new Error(`no card ${tagged.$card} in the table`);
    return card;
  }
  if (typeof tagged.$deck === "string") {
    const deck = decks.get(tagged.$deck);
    if (deck === undefined) throw new Error(`no deck ${tagged.$deck}`);
    return deck.map((card) => cards[card.id] ?? card);
  }
  if (typeof tagged.$number === "string") return Number(tagged.$number);
  if (tagged.$undefined === true) return undefined;
  if (tagged.$rng !== undefined) return rngOf(tagged as Parameters<typeof rngOf>[0]);
  return Object.fromEntries(Object.entries(tagged).map(([key, item]) => [key, decode(item, cards, decks)]));
}

// A value as a golden file writes it, through the format's own encoder.
export function encoded(value: unknown): unknown {
  const file = goldenFile({ module: "m", function: "f", source: "s", tests: [] }, [{ name: "value", input: null, output: value }]);
  return parseGolden(file.content).cases[0]?.output;
}

export function ids(value: unknown): string[] {
  return (value as { $card: string }[]).map((ref) => ref.$card);
}
