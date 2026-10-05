// The round the start flow hands to /play: the chosen route and mode, kept in sessionStorage
// so that a reload of /play keeps it and a new tab starts clean (spec section 4, "Routes"), and in
// memory for when the browser blocks storage.

import { z } from "zod";
import { browserSessionStorage } from "@/src/app-state/services";
import type { Route } from "@/src/content/schema";
import { MODES, type Mode } from "@/src/content/play";

export interface PendingRound {
  route: Route;
  mode: Mode;
}

export const PENDING_KEY = "truthy.pending.v1";

// Only a mode the game knows: anything else reads as no pending round.
const PendingSchema = z.object({
  route: z.object({ deckId: z.string().min(1), sectionId: z.string().min(1) }),
  mode: z.enum(MODES),
});

// The last round handed over on this page. The start flow and /play are one page (client-side navigation),
// so this copy reaches /play when storage cannot: blocked, full or throwing (spec sections 7 and 10, the
// game runs without storage). Only in the browser: on the server a module value would be shared.
let inMemory: PendingRound | null = null;

// Never throws. Keeps a copy in memory, then stores it; without storage only the copy is kept.
export function savePending(pending: PendingRound, storage: Pick<Storage, "setItem"> | undefined = browserSessionStorage()): void {
  if (typeof window !== "undefined") inMemory = { route: { deckId: pending.route.deckId, sectionId: pending.route.sectionId }, mode: pending.mode };
  if (!storage) return;
  try {
    storage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Storage full or blocked: the copy in memory stands in.
  }
}

// The copy in memory of the last round handed over on this page, or null.
function fromMemory(): PendingRound | null {
  return typeof window === "undefined" || inMemory === null ? null : { route: { ...inMemory.route }, mode: inMemory.mode };
}

// The pending round, or null when there is none or it is not valid. The copy in memory comes first: on this
// page it is always the latest round handed over, also when its write failed and storage still holds an
// earlier one. After a reload the copy is empty and storage gives the round back. Never throws.
export function readPending(storage: Pick<Storage, "getItem"> | undefined = browserSessionStorage()): PendingRound | null {
  const mine = fromMemory();
  if (mine || !storage) return mine;
  let value: unknown;
  try {
    const text = storage.getItem(PENDING_KEY);
    if (text === null) return null;
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = PendingSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
