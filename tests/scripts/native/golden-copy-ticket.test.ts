import { describe, expect, it } from "vitest";
import { ticketFor } from "@/components/play/useRound";
import { TICKET_INDEX, ticketGolden } from "@/scripts/native/golden/copy-ticket";
import { findRoute, type RouteInIndex } from "@/src/content/schema";
import { byName, fileAt, view } from "./golden-view";

const FILES = ticketGolden();
const file = fileAt(FILES, "native-data/golden/components.play.useRound.ticketFor.json");

describe("ticketFor", () => {
  it("makes one file", () => {
    expect(FILES).toHaveLength(1);
    expect(view(file)).toMatchObject({ module: "components/play/useRound", function: "ticketFor", source: "components/play/useRound.ts" });
  });

  it("names the deck by its platform and title, or by its pass name when it has one (the pinned cases of useRound.test.tsx)", () => {
    expect((byName(file, "the platform and the deck title name the deck").output as { deckName: string }).deckName).toBe("AWS Test deck");
    expect((byName(file, "the deck's pass name wins when it has one").output as { deckName: string }).deckName).toBe("Amazon Test deck");
  });

  it("gives ALL and Whole deck for the whole deck, and the section id and title for a section", () => {
    expect(byName(file, "a shipped deck with a pass name and no sections is the whole deck").output).toEqual({
      deckCode: "CDL",
      deckName: "Google Cloud Digital Leader",
      sectionCode: "ALL",
      sectionName: "Whole deck",
      modeLabel: "Classic",
      best: null,
    });
    expect(byName(file, "a section of a shipped deck").output).toEqual({
      deckCode: "CLF",
      deckName: "AWS Cloud Practitioner",
      sectionCode: "BIL",
      sectionName: "Billing, pricing and support",
      modeLabel: "Classic",
      best: null,
    });
  });

  it("names the class and keeps the best, a best of 0 included", () => {
    expect(byName(file, "the whole deck of a deck with sections").output).toMatchObject({ sectionCode: "ALL", modeLabel: "Streak", best: 12 });
    expect(byName(file, "Three lives with a best").output).toMatchObject({ modeLabel: "Three lives", best: 21 });
    expect(byName(file, "Timed with a best of 0").output).toMatchObject({ modeLabel: "Timed", best: 0 });
  });

  it("every recorded output is what the function says on the recorded route", () => {
    for (const recorded of view(file).cases) {
      const input = recorded.input as { found: RouteInIndex; mode: "classic" | "streak" | "lives" | "timed"; best: number | null };
      expect(ticketFor(input.found, input.mode, input.best), recorded.name).toEqual(recorded.output);
      const route = { deckId: input.found.deck.id, sectionId: input.found.section?.id ?? "ALL" };
      expect(findRoute(TICKET_INDEX, route), recorded.name).toEqual(input.found);
    }
  });
});
