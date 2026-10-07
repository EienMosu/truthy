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
// not. It lasts as long as the page and is read once.
let returningFromPlay = false;

/** /play is sending the player back to the start with one of its controls. */
export function markReturnFromPlay(): void {
  if (typeof window !== "undefined") returningFromPlay = true;
}

/** Whether the start is being opened by a way back from /play; clears the mark. */
export function takeReturnFromPlay(): boolean {
  const was = returningFromPlay;
  returningFromPlay = false;
  return was;
}
