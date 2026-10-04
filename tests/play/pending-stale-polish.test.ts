// @vitest-environment jsdom
// Review finding U22: when the write of a newer pending round fails (storage full) after an earlier write
// worked, storage still holds the earlier round. /play must deal the round the player just chose, which is
// the copy in memory, and not the older stored one.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingRound } from "@/src/app-state/pending";

type PendingModule = typeof import("@/src/app-state/pending");

let mod: PendingModule;
beforeEach(async () => {
  vi.resetModules(); // a fresh page: nothing in memory yet
  mod = await import("@/src/app-state/pending");
});

const security: PendingRound = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" };
const concepts: PendingRound = { route: { deckId: "aws-clf-c02", sectionId: "CON" }, mode: "streak" };

function storage() {
  const data = new Map<string, string>();
  let full = false;
  return {
    fill: () => {
      full = true;
    },
    getItem: (key: string): string | null => data.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      if (full) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      data.set(key, value);
    },
  };
}

describe("a pending round whose write failed after an earlier one worked", () => {
  it("is the round read back, not the older stored one", () => {
    const session = storage();
    mod.savePending(security, session);
    session.fill();
    mod.savePending(concepts, session);
    expect(mod.readPending(session)).toEqual(concepts);
  });

  it("leaves the stored round to a reload, where memory is empty", async () => {
    const session = storage();
    mod.savePending(security, session);
    vi.resetModules();
    const reloaded: PendingModule = await import("@/src/app-state/pending");
    expect(reloaded.readPending(session)).toEqual(security);
  });
});
