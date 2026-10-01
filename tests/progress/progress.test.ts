import { describe, expect, it } from "vitest";
import { emptyProgress, recordKey } from "@/src/progress/progress";

describe("emptyProgress", () => {
  it("has version 1, no card history, no records and no last route", () => {
    expect(emptyProgress()).toEqual({ version: 1, cards: {}, records: {}, last: null });
  });

  it("returns a fresh object on every call", () => {
    const first = emptyProgress();
    first.cards["aws-clf-c02-t1.1-01"] = { seen: 1, lastCorrect: true, lastSeenAt: 1 };
    first.records["x"] = 3;
    expect(emptyProgress()).toEqual({ version: 1, cards: {}, records: {}, last: null });
  });
});

describe("recordKey", () => {
  it("joins the route key and the mode with a hash", () => {
    expect(recordKey({ deckId: "aws-clf-c02", sectionId: "SEC" }, "classic")).toBe("aws-clf-c02/SEC#classic");
  });

  it("uses the whole deck id for a whole deck route", () => {
    expect(recordKey({ deckId: "nextjs-rendering", sectionId: "ALL" }, "classic")).toBe("nextjs-rendering/ALL#classic");
  });

  it("gives different keys for different modes on the same route", () => {
    const route = { deckId: "aws-clf-c02", sectionId: "SEC" };
    expect(recordKey(route, "classic")).not.toBe(recordKey(route, "timed"));
  });
});
