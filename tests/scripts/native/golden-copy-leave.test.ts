import { describe, expect, it } from "vitest";
import { leavesSomething } from "@/components/play/leave";
import { leaveGolden } from "@/scripts/native/golden/copy-leave";
import { byName, fileAt, replay, view } from "./golden-view";

const FILES = leaveGolden();
const at = (name: string) => fileAt(FILES, `native-data/golden/components.play.leave.${name}.json`);

type Stored = { cards: Record<string, { seen: number; lastCorrect: boolean; lastSeenAt: number }>; records: Record<string, number>; last: unknown };
const stored = (name: string) => (byName(at("saveLeftRound"), name).output as { stored: Stored | null }).stored;

describe("the leave vectors", () => {
  it("makes a file for each function of leave.ts", () => {
    expect(FILES.map((file) => file.path)).toEqual([
      "native-data/golden/components.play.leave.leavesSomething.json",
      "native-data/golden/components.play.leave.saveLeftRound.json",
    ]);
    expect(view(at("saveLeftRound")).tests).toEqual(["tests/components/play/leave.test.ts"]);
  });
});

describe("leavesSomething", () => {
  it("is true with answers or a decided round, false before both", () => {
    const file = at("leavesSomething");
    const out = (name: string) => byName(file, name).output;
    expect(out("Classic: nothing answered yet")).toBe(false);
    expect(out("Classic: one answer given")).toBe(true);
    expect(out("Classic: the last card answered, the round is decided")).toBe(true);
    expect(out("Timed: the minute is running and nothing is answered")).toBe(false);
    expect(out("Timed: the minute ran out with nothing answered")).toBe(true);
    expect(out("Classic: abandoned with nothing answered")).toBe(false);
  });

  it("every recorded output is what the function says on the round its trace replays to", () => {
    const file = at("leavesSomething");
    for (const recorded of view(file).cases) expect(leavesSomething(replay(file, recorded.input)), recorded.name).toBe(recorded.output);
  });
});

describe("saveLeftRound (the pinned cases of leave.test.ts)", () => {
  const route = { deckId: "test-deck", sectionId: "SEC" };

  it("keeps the answers in the card history, remembers the route without a score and sets no record", () => {
    const after = stored("Classic: two answers kept in the history, no record, the route without a score");
    expect(Object.values(after?.cards ?? {}).map((entry) => entry.seen)).toEqual([1, 1]);
    expect(after?.records).toEqual({});
    expect(after?.last).toEqual({ route, mode: "classic", score: null, total: null });
  });

  it("records a decided round that is left as its result would: the answers, the record and the score", () => {
    const after = stored("Streak: left after the deciding answer, recorded as its result would be");
    expect(after?.records).toEqual({ "test-deck/SEC#streak": 3 });
    expect(Object.values(after?.cards ?? {})).toHaveLength(4);
    expect(Object.values(after?.cards ?? {}).every((entry) => entry.seen === 1)).toBe(true);
    expect(after?.last).toEqual({ route, mode: "streak", score: 3, total: 4 });
  });

  it("does not throw when the store cannot save, and writes nothing", () => {
    expect(stored("the store cannot save: nothing is written and nothing throws")).toBeNull();
    expect(stored("the store cannot save over stored progress: the stored value stays")?.records).toEqual({
      "test-deck/SEC#classic": 5,
      "test-deck/SEC#streak": 9,
    });
  });

  it("records the other deciding rounds and an open round over stored progress", () => {
    expect(stored("Three lives: left after the third wrong answer")?.records).toEqual({ "test-deck/SEC#lives": 3 });
    expect(stored("Classic: left after the last card was answered, the record is set")?.records).toEqual({ "test-deck/SEC#classic": 10 });
    expect(stored("Timed: the minute ran out with nothing answered, a record of 0")?.records).toEqual({ "test-deck/SEC#timed": 0 });
    const open = stored("Classic: an open round over stored progress keeps the records and counts a card seen before once more");
    expect(open?.records).toEqual({ "test-deck/SEC#classic": 5, "test-deck/SEC#streak": 9 });
    expect(open?.cards["test-deck-sec-10"]).toEqual({ seen: 2, lastCorrect: true, lastSeenAt: 1000 });
    expect(stored("Streak: a decided round below the stored record leaves the record alone")?.records["test-deck/SEC#streak"]).toBe(9);
  });
});
