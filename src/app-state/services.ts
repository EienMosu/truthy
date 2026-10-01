// The outside world as the screens see it: the network, the two storages and the browser history.
// Screens take these through an optional `services` prop, so their tests run without a browser.

import type { Fetcher } from "@/src/content/load";
import { browserLocalStorage } from "@/src/progress/local";

export type ReadWriteStorage = Pick<Storage, "getItem" | "setItem">;

export interface AppServices {
  /** GETs a URL. In the browser: window.fetch. */
  fetcher: Fetcher;
  /** Progress, the deck cache and the index cache. In the browser: localStorage, or undefined when blocked. */
  localStorage: () => ReadWriteStorage | undefined;
  /** The round handed from the start flow to /play. In the browser: sessionStorage, or undefined when blocked. */
  sessionStorage: () => ReadWriteStorage | undefined;
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
