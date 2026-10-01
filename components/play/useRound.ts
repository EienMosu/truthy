// Loading a round and running it (spec sections 5, 6, 7 and 10): read the pending round, load the index and
// the deck, prune the stored progress for that deck, deal with startRound, then run the round on
// useReducer(reduce). Everything that touches the network, storage, the clock or randomness comes in
// through PlayServices, so the play screen runs in tests without a browser.
import { useCallback, useEffect, useReducer, useState } from "react";
import { WHOLE_DECK, type DeckIndex, type IndexDeck, type Route } from "@/src/content/schema";
import { createDeckCache, loadDeck, loadIndex, poolFor, type Fetcher } from "@/src/content/load";
import { readPending, type PendingRound } from "@/src/app-state/pending";
import { reduce, startRound, type Mode, type RoundEvent, type RoundState } from "@/src/engine/round";
import { pruneDeck } from "@/src/progress/progress";
import { browserLocalStorage, createLocalStore, type ProgressStore } from "@/src/progress/local";

/** The play screen's window on the outside world. Tests pass fakes; the app uses browserPlayServices. */
export interface PlayServices {
  /** GETs a URL. In the browser: window.fetch. */
  fetcher: Fetcher;
  /** Where progress, the deck cache and the index cache live. In the browser: localStorage (or undefined when blocked). */
  localStorage: () => Pick<Storage, "getItem" | "setItem"> | undefined;
  /** Where the start flow left the pending round. In the browser: sessionStorage (or undefined when blocked). */
  sessionStorage: () => Pick<Storage, "getItem"> | undefined;
  /** The clock in ms since the epoch: answer times (card history) and the swipe settle time. */
  now: () => number;
  /** A fresh 32-bit seed for dealing a round. */
  randomSeed: () => number;
}

function browserSessionStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** The real services. A module constant, so it is stable across renders. */
export const browserPlayServices: PlayServices = {
  fetcher: (url) => fetch(url),
  localStorage: browserLocalStorage,
  sessionStorage: browserSessionStorage,
  now: () => Date.now(),
  randomSeed: () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0,
};

export const MODE_LABELS: Record<Mode, string> = {
  classic: "Classic",
  streak: "Streak",
  lives: "Three lives",
  timed: "Timed",
};

/** What the ticket shows about the route, taken from the deck index. */
export interface TicketInfo {
  deckCode: string; // "CLF"
  deckName: string; // "AWS Cloud Practitioner": platform title plus deck title
  sectionCode: string; // "SEC", or "ALL" for the whole deck
  sectionName: string; // "Security and compliance", or "Whole deck"
  modeLabel: string; // "Classic"
}

export type RoundStatus =
  | { kind: "loading" }
  | { kind: "redirecting" }
  | { kind: "error"; message: string }
  | { kind: "ready"; round: RoundState; ticket: TicketInfo };

export interface UseRoundResult {
  status: RoundStatus;
  /** Sends an event to the round (answer, next, abandon). Ignored while no round is running. */
  dispatch: (event: RoundEvent) => void;
  /** After a load error: try loading again. */
  retry: () => void;
  /** A new round on the same route and mode, dealt with the card history as stored now (task 12: "Play again"). */
  restart: () => void;
  /** The progress store on the device, for recording a round. */
  progressStore: () => ProgressStore;
}

export const LOAD_FAILED_MESSAGE = "This deck didn't load. Check your connection and try again.";

interface Located {
  deck: IndexDeck;
  ticket: TicketInfo;
}

// Finds the route in the index. Null when the deck or the section no longer exists.
export function locateRoute(index: DeckIndex, pending: PendingRound): Located | null {
  const { deckId, sectionId } = pending.route;
  for (const area of index.areas) {
    for (const platform of area.platforms) {
      const deck = platform.decks.find((candidate) => candidate.id === deckId);
      if (!deck) continue;
      const deckName = `${platform.title} ${deck.title}`;
      const modeLabel = MODE_LABELS[pending.mode];
      if (sectionId === WHOLE_DECK) {
        return { deck, ticket: { deckCode: deck.code, deckName, sectionCode: WHOLE_DECK, sectionName: "Whole deck", modeLabel } };
      }
      const section = deck.sections.find((candidate) => candidate.id === sectionId);
      if (!section) return null;
      return { deck, ticket: { deckCode: deck.code, deckName, sectionCode: section.id, sectionName: section.title, modeLabel } };
    }
  }
  return null;
}

// Loads everything a round needs and deals it. Null means "this route cannot be played any more": go home.
// Throws LoadError when the index or the deck cannot be loaded and nothing is cached.
export async function prepareRound(pending: PendingRound, services: PlayServices): Promise<{ round: RoundState; ticket: TicketInfo } | null> {
  const local = services.localStorage();
  const index = await loadIndex(services.fetcher, local);
  const located = locateRoute(index, pending);
  if (located === null) return null;
  const deck = await loadDeck(located.deck, createDeckCache(local), services.fetcher);

  const store = createLocalStore(local);
  const progress = pruneDeck(
    store.load(),
    deck.id,
    deck.cards.map((card) => card.id),
  );
  store.save(progress);

  const pool = poolFor(deck, pending.route.sectionId);
  if (pool.length === 0) return null;
  const route: Route = { deckId: pending.route.deckId, sectionId: pending.route.sectionId };
  const round = startRound({ mode: pending.mode, route, pool, history: progress.cards, seed: services.randomSeed() });
  return { round, ticket: located.ticket };
}

type Action = RoundEvent | { type: "start"; round: RoundState } | { type: "clear" };

function roundReducer(state: RoundState | null, action: Action): RoundState | null {
  if (action.type === "start") return action.round;
  if (action.type === "clear") return null;
  return state === null ? null : reduce(state, action);
}

type LoadState = { kind: "loading" } | { kind: "redirecting" } | { kind: "error"; message: string } | { kind: "ready"; ticket: TicketInfo };

export function useRound(services: PlayServices, goHome: () => void): UseRoundResult {
  const [round, send] = useReducer(roundReducer, null);
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const pending = readPending(services.sessionStorage());
    if (pending === null) {
      setLoad({ kind: "redirecting" });
      goHome();
      return;
    }
    prepareRound(pending, services).then(
      (prepared) => {
        if (cancelled) return;
        if (prepared === null) {
          setLoad({ kind: "redirecting" });
          goHome();
          return;
        }
        send({ type: "start", round: prepared.round });
        setLoad({ kind: "ready", ticket: prepared.ticket });
      },
      () => {
        if (!cancelled) setLoad({ kind: "error", message: LOAD_FAILED_MESSAGE });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt, services, goHome]);

  const again = useCallback(() => {
    send({ type: "clear" });
    setLoad({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const dispatch = useCallback((event: RoundEvent) => send(event), []);
  const progressStore = useCallback(() => createLocalStore(services.localStorage()), [services]);

  let status: RoundStatus;
  if (load.kind === "ready") status = round === null ? { kind: "loading" } : { kind: "ready", round, ticket: load.ticket };
  else status = load;

  return { status, dispatch, retry: again, restart: again, progressStore };
}
