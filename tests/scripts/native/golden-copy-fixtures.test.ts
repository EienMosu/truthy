import { describe, expect, it } from "vitest";
import { DeckFileSchema } from "@/src/content/schema";
import { reduce, startRound } from "@/src/engine/round";
import { FIXTURE_DECK, Played, ROUTE, SCOPE_TEXT, startArgs } from "@/scripts/native/golden/copy-fixtures";

describe("the copy fixtures", () => {
  it("is a valid deck: 12 plain cards, 1 scoped, 12 with the same scope and 12 opening with code", () => {
    expect(DeckFileSchema.safeParse(FIXTURE_DECK).success).toBe(true);
    const count = (section: string) => FIXTURE_DECK.cards.filter((card) => card.section === section).length;
    expect([count("SEC"), count("APP"), count("SCP"), count("COD")]).toEqual([12, 1, 12, 12]);
    expect(new Set(FIXTURE_DECK.cards.map((card) => card.id)).size).toBe(37);
    expect(FIXTURE_DECK.cards.filter((card) => card.section === "SCP").every((card) => card.appliesTo === SCOPE_TEXT)).toBe(true);
    expect(FIXTURE_DECK.cards.find((card) => card.section === "COD")?.text.en.statement).toBe("`docker run` Statement COD 1.");
  });

  it("starts a round on the route's cards and keeps every event it is sent", () => {
    const args = startArgs("classic");
    expect(args.route).toEqual(ROUTE);
    expect(args.pool).toHaveLength(12);
    const played = new Played(args).right(1000).next().wrong(2000);
    expect(played.state.answers.map((answer) => answer.correct)).toEqual([true, false]);
    expect(played.trace().events).toEqual([
      { type: "answer", value: played.state.answers[0]?.given, at: 1000 },
      { type: "next" },
      { type: "answer", value: played.state.answers[1]?.given, at: 2000 },
    ]);
    const replayed = played.trace().events.reduce(reduce, startRound(args));
    expect(replayed).toEqual(played.state);
  });

  it("ticks once a second and throws when asked for the card of a finished round", () => {
    const timed = new Played(startArgs("timed")).tick(0).ticks(1000, 3000);
    expect(timed.events.map((event) => (event.type === "tick" ? event.now : -1))).toEqual([0, 1000, 2000, 3000]);
    const done = new Played(startArgs("classic")).send({ type: "abandon" });
    expect(() => done.card()).toThrow("the round has no card on screen");
  });
});
