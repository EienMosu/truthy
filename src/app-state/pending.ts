// The round the start flow hands to /play: the chosen route and mode, kept in sessionStorage
// so that a reload of /play keeps it and a new tab starts clean (spec section 4, "Routes").

import { z } from "zod";
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

// window.sessionStorage, or undefined on the server and where the browser blocks storage.
function sessionStore(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

// Never throws: without storage the round is simply not handed over, and /play sends the player back to /.
export function savePending(pending: PendingRound, storage: Pick<Storage, "setItem"> | undefined = sessionStore()): void {
  if (!storage) return;
  try {
    storage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Storage full or blocked.
  }
}

// The stored pending round, or null when there is none or it is not valid. Never throws.
export function readPending(storage: Pick<Storage, "getItem"> | undefined = sessionStore()): PendingRound | null {
  if (!storage) return null;
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
