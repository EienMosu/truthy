// What the start flow shows, loaded on the device: the deck index (spec section 5, "Loading") and the
// player's progress (section 7). Also the small pure questions the flow asks of them: how many decks an
// area has, how much of a deck has been seen, the best for a route, and where "Continue" leads.
import { useCallback, useEffect, useState } from "react";
import type { AppServices } from "@/src/app-state/services";
import { isOffered } from "@/src/app-state/modes";
import { loadIndex } from "@/src/content/load";
import { WHOLE_DECK, type DeckIndex, type IndexArea, type IndexDeck, type IndexPlatform, type Route } from "@/src/content/schema";
import type { Mode } from "@/src/content/play";
import { createLocalStore } from "@/src/progress/local";
import { recordKey, type Progress } from "@/src/progress/progress";

export type CatalogStatus = { kind: "loading" } | { kind: "error" } | { kind: "ready"; index: DeckIndex; progress: Progress };

export interface UseCatalogResult {
  status: CatalogStatus;
  /** After a failure: load the index again. */
  retry: () => void;
}

/**
 * Loads the index (a cached copy is used when the network fails) and reads the progress on the device.
 * The status is "error" only when there is no index at all. `services` must be stable.
 */
export function useCatalog(services: AppServices): UseCatalogResult {
  const [status, setStatus] = useState<CatalogStatus>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const local = services.localStorage();
    loadIndex(services.fetcher, local).then(
      (index) => {
        if (live) setStatus({ kind: "ready", index, progress: createLocalStore(local).load() });
      },
      () => {
        if (live) setStatus({ kind: "error" });
      },
    );
    return () => {
      live = false;
    };
  }, [services, attempt]);

  const retry = useCallback(() => {
    setStatus({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { status, retry };
}

/** The number of decks under an area (all its platforms) or a platform. */
export function deckCount(place: IndexArea | IndexPlatform): number {
  if ("decks" in place) return place.decks.length;
  return place.platforms.reduce((sum, platform) => sum + platform.decks.length, 0);
}

/** "1 deck", "3 decks", or "No decks yet". */
export function decksLabel(count: number): string {
  if (count === 0) return "No decks yet";
  return `${count} ${count === 1 ? "deck" : "decks"}`;
}

/**
 * The seen share of a deck in whole percent: the history entries whose card id starts with `${deck.id}-`,
 * divided by the deck's card count, capped at 100. Anything seen shows at least 1, so it never reads
 * "Not started" (0) by rounding.
 */
export function seenPercent(progress: Progress, deck: Pick<IndexDeck, "id" | "cardCount">): number {
  const prefix = `${deck.id}-`;
  const seen = Object.keys(progress.cards).filter((id) => id.startsWith(prefix)).length;
  if (seen === 0 || deck.cardCount <= 0) return 0;
  return Math.min(100, Math.max(1, Math.round((seen / deck.cardCount) * 100)));
}

/** The record for a route and mode, or null when it has not been played (to the end) yet. */
export function bestFor(progress: Progress, route: Route, mode: Mode): number | null {
  const key = recordKey(route, mode);
  return Object.hasOwn(progress.records, key) ? (progress.records[key] ?? null) : null;
}

/** Everything the index says about one route. `section` is null for the whole deck. */
export interface RouteInIndex {
  area: IndexArea;
  platform: IndexPlatform;
  deck: IndexDeck;
  section: IndexDeck["sections"][number] | null;
}

/** Finds a route in the index, or null when its deck or section is gone. */
export function findRoute(index: DeckIndex, route: Route): RouteInIndex | null {
  for (const area of index.areas) {
    for (const platform of area.platforms) {
      const deck = platform.decks.find((candidate) => candidate.id === route.deckId);
      if (!deck) continue;
      if (route.sectionId === WHOLE_DECK) return { area, platform, deck, section: null };
      const section = deck.sections.find((candidate) => candidate.id === route.sectionId);
      return section ? { area, platform, deck, section } : null;
    }
  }
  return null;
}

/** Where "Continue" leads: the last route and mode, when both can still be played. */
export interface ContinueTarget {
  route: Route;
  mode: Mode;
  found: RouteInIndex;
  /** The score of the last round; null when it was left before the end. */
  lastScore: { score: number; total: number } | null;
}

export function continueTarget(index: DeckIndex, progress: Progress): ContinueTarget | null {
  const last = progress.last;
  if (last === null || !isOffered(last.mode)) return null;
  const found = findRoute(index, last.route);
  if (!found) return null;
  const lastScore = last.score !== null && last.total !== null ? { score: last.score, total: last.total } : null;
  return { route: last.route, mode: last.mode, found, lastScore };
}
