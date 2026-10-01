import { describe, expect, it } from "vitest";
import { PENDING_KEY, readPending, savePending, type PendingRound } from "@/src/app-state/pending";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    getItem: (key: string): string | null => data.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      data.set(key, String(value));
    },
  };
}

const pending: PendingRound = { route: { deckId: "aws-clf", sectionId: "S01" }, mode: "classic" };

describe("savePending and readPending", () => {
  it("round-trips a pending round under truthy.pending.v1", () => {
    const storage = memoryStorage();
    savePending(pending, storage);
    expect([...storage.data.keys()]).toEqual([PENDING_KEY]);
    expect(PENDING_KEY).toBe("truthy.pending.v1");
    expect(readPending(storage)).toEqual(pending);
  });

  it("round-trips the whole deck route", () => {
    const storage = memoryStorage();
    const whole: PendingRound = { route: { deckId: "gcp-cdl", sectionId: "ALL" }, mode: "classic" };
    savePending(whole, storage);
    expect(readPending(storage)).toEqual(whole);
  });

  it("replaces an earlier pending round", () => {
    const storage = memoryStorage();
    savePending(pending, storage);
    savePending({ ...pending, route: { deckId: "aws-clf", sectionId: "S02" } }, storage);
    expect(readPending(storage)?.route.sectionId).toBe("S02");
  });

  it("reads null when nothing is stored", () => {
    expect(readPending(memoryStorage())).toBeNull();
  });

  it("reads null when the stored text is not JSON", () => {
    expect(readPending(memoryStorage({ [PENDING_KEY]: "{oops" }))).toBeNull();
  });

  it("reads null when the stored JSON has the wrong shape", () => {
    const shapes = [
      null,
      42,
      "classic",
      [],
      {},
      { route: { deckId: "aws-clf" }, mode: "classic" },
      { route: { deckId: "", sectionId: "S01" }, mode: "classic" },
      { route: { deckId: "aws-clf", sectionId: "S01" } },
      { route: { deckId: "aws-clf", sectionId: "S01" }, mode: "chess" },
      { route: "aws-clf/S01", mode: "classic" },
    ];
    for (const shape of shapes) {
      expect(readPending(memoryStorage({ [PENDING_KEY]: JSON.stringify(shape) }))).toBeNull();
    }
  });

  it("drops extra fields it does not know", () => {
    const stored = JSON.stringify({ ...pending, extra: true, route: { ...pending.route, junk: 1 } });
    expect(readPending(memoryStorage({ [PENDING_KEY]: stored }))).toEqual(pending);
  });

  it("reads null and does not throw when the storage throws on read", () => {
    const storage = {
      getItem: (): string | null => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    };
    expect(readPending(storage)).toBeNull();
  });

  it("does not throw when the storage throws on write", () => {
    const storage = {
      setItem: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
    };
    expect(() => savePending(pending, storage)).not.toThrow();
  });

  it("works without a browser: no storage argument and no window", () => {
    expect(typeof window).toBe("undefined");
    expect(() => savePending(pending)).not.toThrow();
    expect(readPending()).toBeNull();
  });
});

describe("modes this build cannot play", () => {
  it("reads null for a mode that exists but is not available yet", () => {
    const stored = JSON.stringify({ route: pending.route, mode: "timed" });
    expect(readPending(memoryStorage({ [PENDING_KEY]: stored }))).toBeNull();
  });

  it("reads a Streak or Three lives round now that the engine can play them", () => {
    for (const mode of ["streak", "lives"] as const) {
      const round: PendingRound = { route: pending.route, mode };
      expect(readPending(memoryStorage({ [PENDING_KEY]: JSON.stringify(round) }))).toEqual(round);
    }
  });
});
