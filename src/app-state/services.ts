// The outside world as the screens see it: the network, the two storages, the service worker and the browser
// history. Screens take these through an optional `services` prop, so their tests run without a browser.

import type { Fetcher } from "@/src/content/load";
import { browserOfflineClient, type OfflineClient } from "@/src/offline/register";
import { browserLocalStorage } from "@/src/progress/local";

export type ReadWriteStorage = Pick<Storage, "getItem" | "setItem">;

export interface AppServices {
  /** GETs a URL. In the browser: window.fetch. */
  fetcher: Fetcher;
  /** Progress, the deck cache and the index cache. In the browser: localStorage, or undefined when blocked. */
  localStorage: () => ReadWriteStorage | undefined;
  /** The round handed from the start flow to /play. In the browser: sessionStorage, or undefined when blocked. */
  sessionStorage: () => ReadWriteStorage | undefined;
  /** The service worker: registration and the update applied at a safe moment. Tests: noOfflineClient. */
  offline: OfflineClient;
}

/** window.sessionStorage, or undefined on the server and where the browser blocks storage. */
export function browserSessionStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** The real services. A module constant, so it is stable across renders. */
export const browserAppServices: AppServices = {
  fetcher: (url) => fetch(url),
  localStorage: browserLocalStorage,
  sessionStorage: browserSessionStorage,
  offline: browserOfflineClient,
};

/**
 * The session history, narrowed to what a screen that keeps its own steps needs. Entries carry a state
 * object and never change the URL. `go` is asynchronous in browsers: the listener hears about the move later.
 */
export interface StepHistory {
  /** The state of the current entry. */
  readonly state: unknown;
  push(state: unknown): void;
  replace(state: unknown): void;
  go(delta: number): void;
  /** Calls `onPop` with the state of the entry the browser moved to (back or forward). Returns the unsubscribe. */
  listen(onPop: (state: unknown) => void): () => void;
}

/**
 * Adds `state` to the state the current entry already carries. The Next.js router keeps its own keys in
 * every entry (`__NA` and its tree) and reloads the page on a back step to an entry without them.
 */
export function withEntryState(current: unknown, state: unknown): Record<string, unknown> {
  const base = typeof current === "object" && current !== null ? (current as Record<string, unknown>) : {};
  const added = typeof state === "object" && state !== null ? (state as Record<string, unknown>) : {};
  return { ...base, ...added };
}

/** window.history behind StepHistory, or undefined on the server. Entries keep the router's own state. */
export function browserStepHistory(): StepHistory | undefined {
  if (typeof window === "undefined") return undefined;
  const history = window.history;
  return {
    get state() {
      return history.state as unknown;
    },
    push: (state) => history.pushState(withEntryState(history.state, state), ""),
    replace: (state) => history.replaceState(withEntryState(history.state, state), ""),
    go: (delta) => history.go(delta),
    listen(onPop) {
      const handler = (event: PopStateEvent) => onPop(event.state);
      window.addEventListener("popstate", handler);
      return () => window.removeEventListener("popstate", handler);
    },
  };
}

// Whether the entry right behind /play is the start flow's first entry. The start flow sets it when it
// opens /play after taking its step entries out of the history; it lasts as long as the page. Only the
// browser sets it. /play also writes it into its own history entry (markPlayEntry), which a reload keeps.
let startEntryBehind = false;

// The key of that mark in the /play entry's history state.
const START_BEHIND_KEY = "truthyStartBehind";

/**
 * The start flow is opening /play: `behind` says whether it moved back to its first entry first. Set on
 * every start, so a start that could not move back does not inherit an earlier round's mark.
 */
export function markStartEntryBehind(behind: boolean): void {
  if (typeof window !== "undefined") startEntryBehind = behind;
}

/**
 * /play has opened: when the start flow's first entry is right behind it, the /play entry carries that in
 * its history state, so a reload of /play (which starts the page, and this module, afresh) still knows it.
 */
export function markPlayEntry(): void {
  if (typeof window === "undefined" || !startEntryBehind) return;
  window.history.replaceState(withEntryState(window.history.state, { [START_BEHIND_KEY]: true }), "");
}

/**
 * Leaves /play for the start with the browser's back, when the start flow's first entry is right behind
 * it, so the history does not grow a second start entry. False when it is not (the caller then opens /).
 */
export function browserBackToStart(): boolean {
  if (typeof window === "undefined") return false;
  const state: unknown = window.history.state;
  const marked = typeof state === "object" && state !== null && (state as Record<string, unknown>)[START_BEHIND_KEY] === true;
  if (!startEntryBehind && !marked) return false;
  window.history.back();
  return true;
}

// Whether the player has just left /play for the start with one of its controls (Choose another route,
// Close results, Leave round). The start flow then focuses its step 1 title, which a fresh page load does
// not. It is read once. Offline, and when a waiting update is applied, the way back is a full page load, which
// starts this module afresh, so the mark is also kept in sessionStorage under RETURN_KEY, where the start reads
// it after that load. The stored mark counts for RETURN_MAX_AGE_MS only: one that no start took (a way back
// into a start restored from the back-forward cache, a load that was cut off) must not move the focus of a
// later fresh load. The mark in memory has no age: the play screen takes it back when it knows that no start
// will take it (clearReturnFromPlay).
let returningFromPlay = false;

/** The sessionStorage key of the mark that the player is coming back from /play: the time it was set, in ms. */
export const RETURN_KEY = "truthy.return.v1";

/**
 * How long the stored mark counts. The slowest way back that loads the page applies an update first (up to 3 s),
 * then the page may wait 3 s for the network before the worker serves its copy, then hydrates.
 */
export const RETURN_MAX_AGE_MS = 10_000;

/** /play is sending the player back to the start with one of its controls. */
export function markReturnFromPlay(): void {
  if (typeof window === "undefined") return;
  returningFromPlay = true;
  try {
    browserSessionStorage()?.setItem(RETURN_KEY, String(Date.now()));
  } catch {
    // Storage full or blocked: the mark in memory still serves a way back within the page.
  }
}

/**
 * A way back from /play failed before it moved, the full page load it started was lost, or the player played on
 * (Play again, Try again) while it had not moved yet, so no start should take the mark: clears it in memory and
 * in sessionStorage, or the next start to open in this page (or, for the stored mark, within RETURN_MAX_AGE_MS)
 * would focus its step 1 title.
 */
export function clearReturnFromPlay(): void {
  takeReturnFromPlay();
}

/** Whether the start is being opened by a way back from /play; clears the mark in memory and in sessionStorage. */
export function takeReturnFromPlay(): boolean {
  let stored = false;
  if (typeof window !== "undefined") {
    try {
      const storage = browserSessionStorage();
      const markedAt = Number(storage?.getItem(RETURN_KEY) ?? Number.NaN);
      const age = Date.now() - markedAt;
      stored = age >= 0 && age <= RETURN_MAX_AGE_MS;
      storage?.removeItem(RETURN_KEY);
    } catch {
      // Blocked storage: only the mark in memory counts.
    }
  }
  const was = returningFromPlay || stored;
  returningFromPlay = false;
  return was;
}
