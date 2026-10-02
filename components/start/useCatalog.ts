// What the start flow shows, loaded on the device: the deck index (spec section 5, "Loading") and the
// player's progress (section 7). Also the small pure questions the flow asks of them: how many decks an
// area has, how much of a deck has been seen, the best for a route, and where "Continue" leads.
import { useCallback, useEffect, useState } from "react";
import type { AppServices } from "@/src/app-state/services";
import { isOffered } from "@/src/app-state/modes";
import { createDeckCache, loadDeck, loadIndex } from "@/src/content/load";
import { findRoute, type DeckIndex, type IndexArea, type IndexDeck, type IndexPlatform, type Route, type RouteInIndex } from "@/src/content/schema";
import type { Mode } from "@/src/content/play";
import { createLocalStore, type ProgressStore } from "@/src/progress/local";
import { pruneDeck, seenShare, type Progress } from "@/src/progress/progress";

/** The card ids of each deck whose current file (the index's hash) is on the device, by deck id. */
export type DeckCardIds = Readonly<Record<string, readonly string[]>>;

export type CatalogStatus =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      index: DeckIndex;
      progress: Progress;
      /** For the decks the player has history on: their current card ids, once known (see seenPercent). */
      cardIds: DeckCardIds;
    };

export interface UseCatalogResult {
  status: CatalogStatus;
  /** After a failure: load the index again. */
  retry: () => void;
}

/**
 * Loads the index (a cached copy is used when the network fails) and reads the progress on the device.
 * The status is "error" only when there is no index at all. `services` must be stable.
 *
 * The seen share counts the deck's current cards (spec section 7), so for every deck the player has history
 * on, the hook finds the card ids of its current file and drops the history of cards no longer in it. A file
 * of the index's hash already on the device is read at once; a deck updated since it was last played is
 * loaded (a round on it needs the new file anyway), and the figures follow when it arrives. A deck that
 * cannot be loaded keeps its history, and its figure is counted from the history alone.
 */
export function useCatalog(services: AppServices): UseCatalogResult {
  const [status, setStatus] = useState<CatalogStatus>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const local = services.localStorage();
    loadIndex(services.fetcher, local).then(
      (index) => {
        if (!live) return;
        const store = createLocalStore(local);
        const cache = createDeckCache(local);
        const loaded = store.load();
        const known: Record<string, readonly string[]> = {};
        const updated: IndexDeck[] = [];
        for (const deck of decksWithHistory(index, loaded)) {
          const file = cache.read(deck.id);
          if (file && file.hash === deck.hash) known[deck.id] = file.cards.map((card) => card.id);
          else updated.push(deck);
        }
        const progress = withoutRemovedCards(loaded, known, store);
        setStatus({ kind: "ready", index, progress, cardIds: known });
        if (updated.length === 0) return;
        const current = (deck: IndexDeck) =>
          loadDeck(deck, cache, services.fetcher).then(
            (file) => (file.hash === deck.hash ? file : null), // an older copy, used when the network fails
            () => null,
          );
        void Promise.all(updated.map(current)).then((files) => {
          const more: Record<string, readonly string[]> = {};
          for (const file of files) if (file) more[file.id] = file.cards.map((card) => card.id);
          if (!live || Object.keys(more).length === 0) return;
          setStatus({ kind: "ready", index, progress: withoutRemovedCards(progress, more, store), cardIds: { ...known, ...more } });
        });
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

/** The decks of the index that the player has history on (a card id starts with `${deck.id}-`). */
function decksWithHistory(index: DeckIndex, progress: Progress): IndexDeck[] {
  const ids = Object.keys(progress.cards);
  const decks = index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks));
  return decks.filter((deck) => ids.some((id) => id.startsWith(`${deck.id}-`)));
}

/** Drops the history of cards that are no longer in their deck, and saves the progress when that changed it. */
function withoutRemovedCards(progress: Progress, cardIds: DeckCardIds, store: ProgressStore): Progress {
  let pruned = progress;
  for (const [deckId, ids] of Object.entries(cardIds)) pruned = pruneDeck(pruned, deckId, ids);
  if (Object.keys(pruned.cards).length !== Object.keys(progress.cards).length) store.save(pruned);
  return pruned;
}

/**
 * The seen share of a deck in whole percent (spec section 7): of the deck's current cards, `cardIds`, the
 * share seen at least once. While those ids are unknown, the history entries seen at least once whose card id
 * starts with `${deck.id}-`, divided by the deck's card count, capped at 100. Anything seen shows at least 1,
 * so it never reads "Not started" (0) by rounding.
 */
export function seenPercent(progress: Progress, deck: Pick<IndexDeck, "id" | "cardCount">, cardIds?: readonly string[]): number {
  let share: number;
  if (cardIds) {
    share = seenShare(progress.cards, cardIds);
  } else {
    const prefix = `${deck.id}-`;
    const seen = Object.entries(progress.cards).filter(([id, entry]) => id.startsWith(prefix) && entry.seen > 0).length;
    share = deck.cardCount > 0 ? seen / deck.cardCount : 0;
  }
  if (share <= 0) return 0;
  return Math.min(100, Math.max(1, Math.round(share * 100)));
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
