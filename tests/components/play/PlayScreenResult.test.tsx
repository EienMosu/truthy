// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { StrictMode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NEXT_ARRIVES_MS, PlayScreen } from "@/components/play/PlayScreen";
import { PROGRESS_KEY } from "@/src/progress/local";
import { parseProgress, recordKey } from "@/src/progress/progress";
import { DECK, DECK_ID, INDEX, cardByStatement, fakeNetwork, harness, memoryStorage, pendingFor, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  router.replace.mockReset();
  router.push.mockReset();
});
afterEach(cleanup);

const ROUTE = { deckId: DECK_ID, sectionId: "SEC" };

function statementText(): string | null | undefined {
  return document.querySelector("[data-statement] p:last-of-type")?.textContent;
}

/** Renders the play screen and answers one card per entry of right (right or wrong), up to the result. Returns the statements in order. */
async function playRound(h: Harness, right: readonly boolean[], strict = false): Promise<string[]> {
  const screenElement = <PlayScreen services={h.services} />;
  render(strict ? <StrictMode>{screenElement}</StrictMode> : screenElement);
  return answerAll(h, right);
}

/** Answers the cards on screen, one per entry of right, then waits for the result. */
async function answerAll(h: Harness, right: readonly boolean[]): Promise<string[]> {
  const statements: string[] = [];
  for (const ok of right) {
    await screen.findByRole("button", { name: "True" });
    h.advance(1000); // past the 250 ms settle time
    const statement = statementText() ?? "";
    statements.push(statement);
    const answer = cardByStatement(statement).answer;
    fireEvent.click(screen.getByRole("button", { name: (ok ? answer : !answer) ? "True" : "False" }));
    const next = await screen.findByRole("button", { name: /^(Next card|See results)$/ });
    h.advance(NEXT_ARRIVES_MS); // "Next card" takes presses once it has arrived
    fireEvent.click(next);
  }
  await screen.findByRole("heading", { name: "Round complete" });
  return statements;
}

const SEVEN_OF_TEN = [true, true, false, true, true, false, true, true, false, true];

describe("PlayScreen: the result of a finished round", () => {
  it("shows the result after the tenth card: score, comparison and missed cards", async () => {
    const h = harness();
    await playRound(h, SEVEN_OF_TEN);
    expect(screen.getByRole("img", { name: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." })).toBeTruthy();
    expect(document.querySelector("[data-score]")?.textContent).toBe("7 of 10");
    expect(document.querySelector("[data-comparison]")?.textContent).toBe("First round on this route");
    expect(screen.getByText("3 to review")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "True" })).toBeNull();
  });

  it("records the round once, even in strict mode: history, record and last route", async () => {
    const h = harness();
    const statements = await playRound(h, SEVEN_OF_TEN, true);
    // Strict mode runs every effect twice; a second recording would make each card seen twice.
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(Object.keys(progress.cards).sort()).toEqual(statements.map((s) => cardByStatement(s).id).sort());
    expect(Object.values(progress.cards).every((entry) => entry.seen === 1)).toBe(true);
    expect(progress.records[recordKey(ROUTE, "classic")]).toBe(7);
    expect(progress.last).toEqual({ route: ROUTE, mode: "classic", score: 7, total: 10 });
  });

  it("goes home with Choose another route", async () => {
    await playRound(harness(), SEVEN_OF_TEN);
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("goes home with the close button", async () => {
    await playRound(harness(), SEVEN_OF_TEN);
    fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});

describe("PlayScreen: Play again", () => {
  it("deals a new round on the same route with a new seed and the updated history, back at card 1", async () => {
    const h = harness();
    let seed = 100;
    const randomSeed = vi.fn(() => seed++);
    h.services.randomSeed = randomSeed;
    const first = await playRound(h, SEVEN_OF_TEN);
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await screen.findByRole("button", { name: "True" });
    expect(randomSeed).toHaveBeenCalledTimes(2);
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "Card 1 of 10." })).toBeTruthy();
    expect(screen.getAllByRole("definition")[1]?.textContent).toBe("01 / 10");
    expect(document.activeElement).toBe(document.querySelector("[data-statement]"));
    // The history from the first round shapes the deal: the 2 unseen SEC cards come in, and the
    // 3 missed cards come back first in line.
    const second = await answerAll(h, Array.from({ length: 10 }, () => true));
    const missed = [first[2], first[5], first[8]];
    const sec = Array.from({ length: 12 }, (_, i) => `Statement SEC ${i + 1}.`);
    const unseen = sec.filter((statement) => !first.includes(statement));
    expect(unseen).toHaveLength(2);
    for (const statement of [...missed, ...unseen]) expect(second).toContain(statement);
  });

  it("records the second round on top of the first", async () => {
    const h = harness();
    await playRound(h, SEVEN_OF_TEN);
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await answerAll(h, Array.from({ length: 10 }, () => true));
    expect(document.querySelector("[data-new-best]")?.textContent).toBe("New best");
    expect(document.querySelector("[data-comparison]")?.textContent).toBe("New bestPrevious best 7 / 10");
    expect(screen.getByText("No missed cards")).toBeTruthy();
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(progress.records[recordKey(ROUTE, "classic")]).toBe(10);
    expect(Object.values(progress.cards).reduce((sum, entry) => sum + entry.seen, 0)).toBe(20);
  });
});

describe("PlayScreen: storage that fails", () => {
  it("plays and shows the result when every storage call throws", async () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const h = harness();
    h.services.localStorage = () => throwing;
    await playRound(h, SEVEN_OF_TEN);
    expect(document.querySelector("[data-comparison]")?.textContent).toBe("First round on this route");
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await waitFor(() => expect(screen.getByRole("img", { name: "Card 1 of 10." })).toBeTruthy());
  });
});

describe("PlayScreen: review focus", () => {
  it("counts a round on a short route by its own length, not by 10", async () => {
    // The APP section of the fixture deck has one card, so Classic deals a round of one.
    const h = harness({ route: { deckId: DECK_ID, sectionId: "APP" }, mode: "classic" });
    const best = { [recordKey({ deckId: DECK_ID, sectionId: "APP" }, "classic")]: 1 };
    h.local.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, cards: {}, records: best, last: null }));
    await playRound(h, [false]);
    expect(screen.getByRole("img", { name: "Round complete. 1 of 1 cards. 0 correct, 1 wrong: card 1." })).toBeTruthy();
    expect(screen.getAllByRole("definition").map((value) => value.textContent).slice(0, 4)).toEqual(["Classic", "01 / 01", "01", "0 of 1"]);
    expect(document.querySelector("[data-comparison]")?.textContent).toBe("1 short of your bestBest 1 / 1");
  });

  it("plays again from the copies on the device when the network has gone since the round began", async () => {
    const h = harness();
    await playRound(h, SEVEN_OF_TEN);
    h.network.online = false;
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await screen.findByRole("button", { name: "True" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("img", { name: "Card 1 of 10." })).toBeTruthy();
  });

  it("compares with the stored record when storage is full and cannot save, and plays again", async () => {
    const h = harness();
    h.local.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, cards: {}, records: { [recordKey(ROUTE, "classic")]: 9 }, last: null }));
    const full = {
      getItem: (key: string) => h.local.getItem(key),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    h.services.localStorage = () => full;
    await playRound(h, SEVEN_OF_TEN);
    expect(document.querySelector("[data-comparison]")?.textContent).toBe("2 short of your bestBest 9 / 10");
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).last).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(await screen.findByRole("button", { name: "True" })).toBeTruthy();
  });
});

describe("PlayScreen: a deck update between rounds", () => {
  it("plays again from the new version of the deck, without the card it dropped, and forgets that card", async () => {
    const files: Record<string, unknown> = { "/decks/index.json": INDEX, [`/decks/${DECK_ID}.json`]: DECK };
    const network = fakeNetwork(files);
    const h = harness();
    h.services.fetcher = network.fetcher;
    const first = await playRound(h, SEVEN_OF_TEN);

    // While the result is on screen a new build is deployed: it drops a card the player has just answered.
    const dropped = cardByStatement(first[0]);
    const cards = DECK.cards.filter((card) => card.id !== dropped.id);
    const index = structuredClone(INDEX);
    const entry = index.areas[0]?.platforms[0]?.decks[0];
    if (!entry) throw new Error("the fixture index has no deck");
    entry.hash = "hash-2";
    entry.cardCount = cards.length;
    entry.sections = entry.sections.map((section) => (section.id === "SEC" ? { ...section, cardCount: 11 } : section));
    files["/decks/index.json"] = index;
    files[`/decks/${DECK_ID}.json`] = { ...DECK, hash: "hash-2", cards };

    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    const second = await answerAll(h, Array.from({ length: 10 }, () => true));

    expect(network.calls).toContain(`/decks/${DECK_ID}.json?v=hash-2`);
    expect(JSON.parse(h.local.getItem(`truthy.deck.${DECK_ID}`) ?? "null")?.hash).toBe("hash-2");
    expect(second).not.toContain(dropped.text.en.statement);
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(progress.cards[dropped.id]).toBeUndefined();
    // Every SEC card that is left has been seen once or twice; the record of the route survives the update.
    expect(Object.keys(progress.cards).sort()).toEqual(cards.filter((card) => card.section === "SEC").map((card) => card.id).sort());
    expect(progress.records[recordKey(ROUTE, "classic")]).toBe(10);
  });
});

describe("PlayScreen: the result of a Streak round", () => {
  it("a record stored before the deck changed still counts", async () => {
    // The player's record was set on the first version of the deck; the network now serves a second
    // version without one SEC card. The stored record is kept as it is and the round compares with it.
    const records = { [recordKey(ROUTE, "streak")]: 2 };
    const local = memoryStorage({
      [PROGRESS_KEY]: JSON.stringify({ version: 1, cards: {}, records, last: null }),
      [`truthy.deck.${DECK_ID}`]: JSON.stringify(DECK),
    });
    const h = harness(pendingFor("streak"), local);
    const cards = DECK.cards.slice(1);
    const index = structuredClone(INDEX);
    const entry = index.areas[0]?.platforms[0]?.decks[0];
    if (!entry) throw new Error("the fixture index has no deck");
    entry.hash = "hash-2";
    entry.cardCount = cards.length;
    entry.sections = entry.sections.map((section) => (section.id === "SEC" ? { ...section, cardCount: 11 } : section));
    const network = fakeNetwork({ "/decks/index.json": index, [`/decks/${DECK_ID}.json`]: { ...DECK, hash: "hash-2", cards } });
    h.services.fetcher = network.fetcher;

    await playRound(h, [true, true, false]);

    expect(network.calls).toContain(`/decks/${DECK_ID}.json?v=hash-2`);
    expect(document.querySelector("[data-comparison]")?.textContent).toBe("Equals your bestBest 2");
    expect(document.querySelector("[data-new-best]")).toBeNull();
    expect(document.querySelector("[data-score]")?.textContent).toBe("2");
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).records[recordKey(ROUTE, "streak")]).toBe(2);
  });

  it("Play again after a Streak result deals a new Streak round", async () => {
    const h = harness(pendingFor("streak"));
    await playRound(h, [true, true, false]);
    expect(screen.getByRole("img", { name: "Streak over on card 3. 2 correct in a row. Card 3 was wrong." })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await screen.findByRole("button", { name: "True" });
    expect(screen.getByRole("img", { name: "Streak of 0 correct answers. Your best on this route is 2." })).toBeTruthy();
  });
});
