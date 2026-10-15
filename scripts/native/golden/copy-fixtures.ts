// The deck, the route and the round recorder the copy vectors are built from. The cards are small and made up
// (the copy functions read card fields, not the shipped decks), so every case of a file stays readable.
import { poolFor } from "@/src/content/load";
import type { Mode } from "@/src/content/play";
import type { Card, DeckFile, Route } from "@/src/content/schema";
import { currentCard, reduce, startRound, type RoundEvent, type RoundState, type StartArgs } from "@/src/engine/round";

export const DECK_ID = "test-deck";
export const ROUTE: Route = { deckId: DECK_ID, sectionId: "SEC" };
export const SEED = 12345;

const SCOPE = "Next.js 16 with cacheComponents: true";

function card(section: string, n: number, answer: boolean, appliesTo = "", mark = ""): Card {
  const id = `${DECK_ID}-${section.toLowerCase()}-${String(n).padStart(2, "0")}`;
  return {
    id,
    section,
    text: { en: { statement: `${mark}Statement ${section} ${n}.`, explanation: `Explanation ${section} ${n}.` } },
    answer,
    source: { title: `Source ${section} ${n}`, url: `https://example.com/${id}` },
    difficulty: 1,
    appliesTo,
    conflictGroups: [],
  };
}

const twelve = (section: string, appliesTo = "", mark = ""): Card[] =>
  Array.from({ length: 12 }, (_, i) => card(section, i + 1, i % 2 === 0, appliesTo, mark));

/**
 * SEC: 12 plain cards, half of them true. APP: one card with an appliesTo. SCP: 12 cards that all apply to one
 * setting. COD: 12 cards whose statement opens with a code fragment between backticks.
 */
export const FIXTURE_DECK: DeckFile = {
  id: DECK_ID,
  hash: "hash-1",
  cards: [...twelve("SEC"), card("APP", 1, true, "Next.js 16"), ...twelve("SCP", SCOPE), ...twelve("COD", "", "`docker run` ")],
};

export const SCOPE_TEXT = SCOPE;

/** The arguments that start a round of the mode on the fixture deck's section (SEC unless given). */
export function startArgs(mode: Mode, sectionId = "SEC", seed = SEED): StartArgs {
  return { mode, route: { deckId: DECK_ID, sectionId }, pool: poolFor(FIXTURE_DECK, sectionId), history: {}, seed };
}

/** A round being played: every event it was sent is kept, so the case input can replay it. */
export class Played {
  readonly events: RoundEvent[] = [];
  state: RoundState;

  constructor(readonly start: StartArgs) {
    this.state = startRound(start);
  }

  send(event: RoundEvent): this {
    this.events.push(event);
    this.state = reduce(this.state, event);
    return this;
  }

  /** The card on screen. Throws when the round has none. */
  card(): Card {
    const found = currentCard(this.state);
    if (found === undefined) throw new Error("the round has no card on screen");
    return found;
  }

  right(at: number): this {
    return this.send({ type: "answer", value: this.card().answer, at });
  }

  wrong(at: number): this {
    return this.send({ type: "answer", value: !this.card().answer, at });
  }

  next(): this {
    return this.send({ type: "next" });
  }

  tick(now: number): this {
    return this.send({ type: "tick", now });
  }

  /** One tick a second from `from` up to and including `to`. */
  ticks(from: number, to: number): this {
    for (let now = from; now <= to; now += 1000) this.tick(now);
    return this;
  }

  /** The case input that rebuilds this round: its start and the events it was sent, in order. */
  trace(): { start: StartArgs; events: RoundEvent[] } {
    return { start: this.start, events: [...this.events] };
  }
}
