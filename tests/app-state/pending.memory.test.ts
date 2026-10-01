// @vitest-environment jsdom
// Review finding F2: where the browser blocks storage the round must still reach /play (spec sections 7
// and 10: the game runs with empty progress). The start flow and /play share one page, so the pending
// round also lives in memory, and readPending falls back to that copy when storage cannot give it back.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingRound } from "@/src/app-state/pending";

type PendingModule = typeof import("@/src/app-state/pending");

let mod: PendingModule;
beforeEach(async () => {
  vi.resetModules(); // a fresh page: nothing in memory yet
  mod = await import("@/src/app-state/pending");
});

const pending: PendingRound = { route: { deckId: "aws-clf", sectionId: "S01" }, mode: "classic" };
const other: PendingRound = { route: { deckId: "gcp-cdl", sectionId: "ALL" }, mode: "classic" };

function blocked() {
  const error = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  return { getItem: error, setItem: error };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string): string | null => data.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      data.set(key, String(value));
    },
  };
}

describe("the pending round in memory", () => {
  it("is read back when the storage throws on write and on read", () => {
    const storage = blocked();
    mod.savePending(pending, storage);
    expect(mod.readPending(storage)).toEqual(pending);
  });

  it("is read back when there is no storage at all", () => {
    const none = { getItem: () => null, setItem: () => undefined };
    mod.savePending(pending, blocked());
    expect(mod.readPending(none)).toEqual(pending);
  });

  it("is read back when the browser blocks window.sessionStorage itself", () => {
    const spy = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    try {
      mod.savePending(pending);
      expect(mod.readPending()).toEqual(pending);
    } finally {
      spy.mockRestore();
    }
  });

  it("is read back when the write failed because the storage is full", () => {
    const storage = memoryStorage();
    const full = {
      getItem: storage.getItem,
      setItem: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
    };
    mod.savePending(pending, full);
    expect(mod.readPending(full)).toEqual(pending);
  });

  it("holds the latest round only", () => {
    const storage = blocked();
    mod.savePending(pending, storage);
    mod.savePending(other, storage);
    expect(mod.readPending(storage)).toEqual(other);
  });

  it("is still null on a fresh page where nothing was saved", () => {
    expect(mod.readPending(blocked())).toBeNull();
    expect(mod.readPending(memoryStorage())).toBeNull();
  });

  it("does not hide what a working storage holds", () => {
    const storage = memoryStorage();
    mod.savePending(pending, blocked());
    mod.savePending(other, storage);
    expect(mod.readPending(storage)).toEqual(other);
  });

  it("is a copy: changing the saved object afterwards does not change it", () => {
    const mine: PendingRound = { route: { ...pending.route }, mode: "classic" };
    mod.savePending(mine, blocked());
    mine.route.sectionId = "S99";
    expect(mod.readPending(blocked())).toEqual(pending);
  });
});
