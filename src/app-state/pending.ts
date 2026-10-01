// The round the start flow hands to /play: the chosen route and mode, kept in sessionStorage
// so that a reload of /play keeps it and a new tab starts clean (spec section 4, "Routes"), and in
// memory for when the browser blocks storage.

import { z } from "zod";
import { browserSessionStorage } from "@/src/app-state/services";
import type { Route } from "@/src/content/schema";
import { AVAILABLE_MODES, type Mode } from "@/src/engine/round";

export interface PendingRound {
  route: Route;
  mode: Mode;
}

export const PENDING_KEY = "truthy.pending.v1";

// Only modes this build can play: a stored "streak" from a newer build must not reach startRound, which would throw.
const PendingSchema = z.object({
  route: z.object({ deckId: z.string().min(1), sectionId: z.string().min(1) }),
  mode: z.custom<Mode>((value) => typeof value === "string" && (AVAILABLE_MODES as readonly string[]).includes(value)),
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

// The copy in memory, for when storage is unavailable, throws or holds nothing.
function fromMemory(): PendingRound | null {
  return typeof window === "undefined" || inMemory === null ? null : { route: { ...inMemory.route }, mode: inMemory.mode };
}

// The stored pending round, or null when there is none or it is not valid. Where storage cannot give a
// round back, the copy in memory. Never throws.
export function readPending(storage: Pick<Storage, "getItem"> | undefined = browserSessionStorage()): PendingRound | null {
  if (!storage) return fromMemory();
  let value: unknown;
  try {
    const text = storage.getItem(PENDING_KEY);
    if (text === null) return fromMemory();
    value = JSON.parse(text);
  } catch (error) {
    return error instanceof SyntaxError ? null : fromMemory();
  }
  const parsed = PendingSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
