// Vectors for the ticket's route words (components/play/useRound.ts, ticketFor): the deck code, the deck's
// name on the pass, the section code and name, and the class name, taken from a route found in the deck index.
import { ticketFor } from "@/components/play/useRound";
import type { Mode } from "@/src/content/play";
import { findRoute, type DeckIndex, type Route } from "@/src/content/schema";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

/** A small index in the shape of public/decks/index.json: two decks of the shipped catalog and the test deck of the web tests. */
export const TICKET_INDEX: DeckIndex = {
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
              id: "aws-clf-c02",
              code: "CLF",
              title: "Cloud Practitioner",
              cardCount: 214,
              version: "2026-10-01",
              hash: "hash-clf",
              sections: [
                { id: "CON", title: "Cloud concepts", cardCount: 60 },
                { id: "SEC", title: "Security and compliance", cardCount: 54 },
                { id: "TEC", title: "Cloud technology and services", cardCount: 60 },
                { id: "BIL", title: "Billing, pricing and support", cardCount: 40 },
              ],
            },
            {
              id: "test-deck",
              code: "TST",
              title: "Test deck",
              cardCount: 13,
              version: "2026-10-01",
              hash: "hash-1",
              sections: [
                { id: "SEC", title: "Security and compliance", cardCount: 12 },
                { id: "APP", title: "Applies to", cardCount: 1 },
              ],
            },
            {
              id: "test-named",
              code: "NAM",
              title: "Test deck",
              passName: "Amazon Test deck",
              cardCount: 12,
              version: "2026-10-01",
              hash: "hash-2",
              sections: [{ id: "SEC", title: "Security and compliance", cardCount: 12 }],
            },
          ],
        },
        {
          id: "gcp",
          title: "Google Cloud",
          decks: [
            {
              id: "gcp-cdl",
              code: "CDL",
              title: "Cloud Digital Leader",
              passName: "Google Cloud Digital Leader",
              cardCount: 133,
              version: "2026-10-01",
              hash: "hash-cdl",
              sections: [],
            },
          ],
        },
      ],
    },
  ],
};

function ticket(name: string, route: Route, mode: Mode, best: number | null): GoldenCase {
  const found = findRoute(TICKET_INDEX, route);
  if (found === null) throw new Error(`the index has no route ${route.deckId}/${route.sectionId}`);
  return { name, input: { found, mode, best }, output: ticketFor(found, mode, best) };
}

/** The file of this group: ticketFor. */
export function ticketGolden(): GoldenFile[] {
  return [
    goldenFile({ module: "components/play/useRound", function: "ticketFor", source: "components/play/useRound.ts", tests: ["tests/components/play/useRound.test.tsx"] }, [
      ticket("the platform and the deck title name the deck", { deckId: "test-deck", sectionId: "SEC" }, "classic", null),
      ticket("the deck's pass name wins when it has one", { deckId: "test-named", sectionId: "SEC" }, "classic", null),
      ticket("a shipped deck with a pass name and no sections is the whole deck", { deckId: "gcp-cdl", sectionId: "ALL" }, "classic", null),
      ticket("a section of a shipped deck", { deckId: "aws-clf-c02", sectionId: "BIL" }, "classic", null),
      ticket("the whole deck of a deck with sections", { deckId: "aws-clf-c02", sectionId: "ALL" }, "streak", 12),
      ticket("Three lives with a best", { deckId: "aws-clf-c02", sectionId: "CON" }, "lives", 21),
      ticket("Timed with a best of 0", { deckId: "test-deck", sectionId: "APP" }, "timed", 0),
    ]),
  ];
}
