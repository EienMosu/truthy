// Loading a round and running it (spec sections 5, 6, 7 and 10): read the pending round, load the index and
// the deck, prune the stored progress for that deck, deal with startRound, then run the round on
// useReducer(reduce). Everything that touches the network, storage, the clock or randomness comes in
// through PlayServices, so the play screen runs in tests without a browser.
import { useCallback, useEffect, useReducer, useState } from "react";
import { WHOLE_DECK, deckPassName, findRoute, type Route, type RouteInIndex } from "@/src/content/schema";
import { LoadError, createDeckCache, loadDeck, loadIndex, poolFor } from "@/src/content/load";
import { modeInfo } from "@/src/app-state/modes";
import { readPending, type PendingRound } from "@/src/app-state/pending";
import { browserAppServices, browserBackToStart, markReturnFromPlay, type AppServices } from "@/src/app-state/services";
import type { Mode } from "@/src/content/play";
import { reduce, startRound, type RoundEvent, type RoundState } from "@/src/engine/round";
import { bestFor, pruneDeck } from "@/src/progress/progress";
import { createLocalStore, type ProgressStore } from "@/src/progress/local";

/** How often the Timed clock is told the time, in ms. The engine counts the time itself; this is only how often it hears. */
export const TICK_MS = 100;

/** Whether the page can be seen, and when that changes (the Timed clock pauses while it is hidden). */
export interface PageVisibility {
  /** Whether the page is hidden now. In the browser: document.visibilityState === "hidden". */
  hidden: () => boolean;
  /** Calls onChange when the page is hidden or shown. Returns the unsubscribe. In the browser: "visibilitychange". */
  listen: (onChange: (hidden: boolean) => void) => () => void;
}

/** The play screen's window on the outside world: the app services plus the clock and the dice. Tests pass fakes; the app uses browserPlayServices. */
export interface PlayServices extends AppServices {
  /** The clock in ms since the epoch: answer times (card history) and the Timed clock. */
  now: () => number;
  /**
   * A clock in ms that never goes back, for the screen's guards: the settle time of a card, the arrival of
   * the action row and of the result's actions. The wall clock can be set back (by hand, or by a large time
   * correction), and a guard on it would then drop every press until it caught up again.
   */
  monotonic: () => number;
  /** A fresh 32-bit seed for dealing a round. */
  randomSeed: () => number;
  /**
   * Goes back to the start when the start flow's first entry is right behind /play, and says whether it
   * did. Left out (tests) or false: the screen replaces /play with / instead.
   */
  backToStart?: () => boolean;
  /** Tells the start that the player is coming back from a round by a control, so it takes the focus. */
  markReturnToStart?: () => void;
  /** Calls onTick about every TICK_MS while subscribed. Returns the unsubscribe. In the browser: setInterval. */
  ticker: (onTick: () => void) => () => void;
  visibility: PageVisibility;
}

/** The real services. A module constant, so it is stable across renders. */
export const browserPlayServices: PlayServices = {
  ...browserAppServices,
  now: () => Date.now(),
  monotonic: () => performance.now(),
  backToStart: browserBackToStart,
  markReturnToStart: markReturnFromPlay,
  randomSeed: () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0,
  ticker: (onTick) => {
    const id = window.setInterval(onTick, TICK_MS);
    return () => window.clearInterval(id);
  },
  visibility: {
    hidden: () => document.visibilityState === "hidden",
    listen: (onChange) => {
      const handler = () => onChange(document.visibilityState === "hidden");
      document.addEventListener("visibilitychange", handler);
      return () => document.removeEventListener("visibilitychange", handler);
    },
  },
};

/** What the ticket shows about the route, taken from the deck index. */
export interface TicketInfo {
  deckCode: string; // "CLF"
  deckName: string; // "AWS Cloud Practitioner": platform title plus deck title
  sectionCode: string; // "SEC", or "ALL" for the whole deck
  sectionName: string; // "Security and compliance", or "Whole deck"
  modeLabel: string; // "Classic"
  best: number | null; // the record for this route and mode when the round was dealt
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

/** What the ticket shows about a route that was found in the index, for the mode played. */
export function ticketFor(found: RouteInIndex, mode: Mode, best: number | null): TicketInfo {
  return {
    deckCode: found.deck.code,
    deckName: deckPassName(found.platform, found.deck),
    sectionCode: found.section?.id ?? WHOLE_DECK,
    sectionName: found.section?.title ?? "Whole deck",
    modeLabel: modeInfo(mode).name,
    best,
  };
}

// Loads everything a round needs and deals it. Null means "this route cannot be played any more": go home.
// Throws LoadError when the index or the deck cannot be loaded and nothing is cached.
export async function prepareRound(pending: PendingRound, services: PlayServices): Promise<{ round: RoundState; ticket: TicketInfo } | null> {
  const local = services.localStorage();
  const index = await loadIndex(services.fetcher, local);
  const found = findRoute(index, pending.route);
  if (found === null) return null;
  const deck = await loadDeck(found.deck, createDeckCache(local), services.fetcher);

  const store = createLocalStore(local);
  const progress = pruneDeck(
    store.load(),
    deck.id,
    deck.cards.map((card) => card.id),
  );
  store.save(progress);

  const pool = poolFor(deck, pending.route.sectionId);
  if (pool.length === 0) {
    // An older copy on the device (the deck named in the index did not load) can lack a section the index
    // already has. That route is not gone, the deck did not load: the player gets the message and Try again.
    if (deck.hash !== found.deck.hash) {
      throw new LoadError(`Could not load the deck "${deck.id}": the copy on the device has no cards for ${pending.route.sectionId}.`);
    }
    return null;
  }
  const route: Route = { deckId: pending.route.deckId, sectionId: pending.route.sectionId };
  const round = startRound({ mode: pending.mode, route, pool, history: progress.cards, seed: services.randomSeed() });
  return { round, ticket: ticketFor(found, pending.mode, bestFor(progress, route, pending.mode)) };
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
      (reason: unknown) => {
        if (cancelled) return;
        // A LoadError is the network or the cache. Anything else is a bug in dealing or pruning: it is
        // logged, and the player still sees the one message the screen has.
        if (!(reason instanceof LoadError)) console.error(reason);
        setLoad({ kind: "error", message: LOAD_FAILED_MESSAGE });
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
