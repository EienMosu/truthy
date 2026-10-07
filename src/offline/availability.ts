// Which decks can be played now (offline spec section 8). Online, every deck. Offline, the decks the device
// holds a copy of (`truthy.deck.<id>`, any hash): the same rule loadDeck follows when its fetch fails, so a
// deck offered here is one a round can load. Pure apart from the cache it is given; no React, no DOM.
import type { DeckCache } from "@/src/content/load";

export function availableDeckIds(deckIds: readonly string[], online: boolean, cache: DeckCache): ReadonlySet<string> {
  if (online) return new Set(deckIds);
  return new Set(deckIds.filter((id) => cache.read(id) !== null));
}
