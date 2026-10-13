# Truthy: recent decks and long start-flow lists

Date: 2026-10-13. Status: approved direction (owner, 2026-10-13: "Son desteler + kaydırma düzeltmesi", placement "1. adımda 'Recent' kartı"); this document is for review.

## 1. Why

The catalog grew from 19 to 54 decks in a week: 4 areas, 32 platforms, up to 10 platforms in one area and 7 decks on one platform. A returning player who plays more than one deck walks area, platform and deck every time, and on a 320 by 568 screen a platform list shows two of its cards at a time. The continue line (design system 5.4a) brings back one route; nothing brings back the other decks the player uses.

Two facts from the exploration on 2026-10-13 shape the answer:

- The design system rules out the usual tools. Principle 1: "Each start-flow step asks one question ... and shows only its own large cards (two to five). Stats, filters and secondary paths wait for later screens." Principle 4: filter chips were rejected with the screens that had them, "do not build them". A search field is a secondary path and needs a keyboard that covers most of a small screen. Both stay out.
- Long lists have a bug. Going back (Back, Escape or a filled pass field) focuses the card that was chosen, with `focus({ preventScroll: true })`, but nothing scrolls the step's list to it: after choosing the ninth DevOps platform and pressing Escape, focus sits about 700 px below the visible part of the list.

## 2. What changes

1. **A "Recent" destination on step 1.** When the player has played at least two decks that are still in the catalog, step 1 lists a "Recent" card before the areas. It opens a deck step that lists those decks, most recent first, at most five. Choosing one fills area, platform and deck at once and goes on to the section step (or the class step for a deck without sections), exactly as if the player had walked there.
2. **Going back scrolls the chosen card into view** in its list before it takes focus, on every step and on the return from a round.
3. **Step lists are lists for assistive technology:** each step's options are announced as a list with its number of items, so a screen reader user knows how many choices lie beyond the visible part.

Nothing else in the start flow changes: the continue line, the areas, platforms, decks, sections, classes, the pass and its motion stay as they are.

Out of scope: search, filters, favourites or pinning, clearing or editing the recent list, recents on any step but step 1.

## 3. Which decks are recent

- A deck is recent when at least one of its cards has a history entry (`truthy.progress.v1`, `cards[id].lastSeenAt`). Card ids start with `<deck id>-`, as `seenPercent` already relies on.
- Its recency is the latest `lastSeenAt` among those entries. Decks are ordered by it, newest first; equal times keep catalog order.
- Only decks in the current index count (a deck removed from the catalog drops out). At most five are listed.
- The "Recent" card shows only when two or more decks qualify. With one, the continue line already brings it back.
- The list is worked out when step 1 appears and does not reorder while the player is on the start screen.
- Nothing new is stored. The recent list is derived from the progress the game keeps already, so the stored-format rule of the offline spec (section 10, item 5) is untouched and an older release reads the same data.
- A pure function `recentDecks(index, progress, limit = 5)` in `components/start/useCatalog.ts` (next to `continueTarget` and `seenPercent`) returns the decks with their area and platform.

## 4. The "Recent" card (step 1)

- Place: first in step 1's list, above Cloud. With four areas the step shows five cards, the most principle 1 allows.
- Variant: the area card of design system 5.3 (at least 104 tall, stub with the chevron). Name "Recent". Sub-line in `mono-data` ink-muted: the deck codes, newest first, joined by " · " ("CLF · GIT · SQL"). With five codes the line is "CLF · GIT · SQL · TSC · RCT" (26 characters), which fits the 320 px card.
- Accessible name: "Recent, 3 decks" (the same shape as "Cloud, 14 decks").
- It is not an area: it carries `data-recent`, not `data-option`, so the catalog's own order stays what the catalog spec pins.
- Offline it stays a button; the decks inside show their own "Needs a connection" state (5.3).

## 5. The recent deck step

- Title "Choose a deck", the same step as a platform's deck step (step 3), with the same deck cards (5.3 deck variant: code, name, seen share, card count; offline the "Needs a connection" variant for a deck with no copy on the device).
- The pass (5.4, layout 1) shows Area and Platform blank and Deck as the field being chosen. Choosing a deck sends its name into the Deck field as today and fills Area and Platform with that deck's area and platform in the same move; the pass then takes layout 2 for the section step.
- History: the recent deck step is one browser history entry, like every step. Back (pill, Escape or the browser) from it returns to step 1. Back from the section step (or the class step of a deck without sections) reached through Recent returns to the recent deck step, not to a platform step.
- The filled Area and Platform fields stay ways back as today: "Change area, now Cloud" returns to step 1 and clears every later choice; "Change platform, now AWS" opens AWS's deck step (the ordinary path), since the player asked for that platform.

## 6. Going back on a long list

- When a step comes back with a chosen card (Back, Escape, a pass field, the browser's back, or the start opening after a round), the card is scrolled into view in its list first, then focused. The scroll is instant (it is a return, not a movement to watch) and puts the card fully inside the list's visible part, nearest edge first.
- This holds for every step and every list length, with and without reduced motion.

## 7. Lists for assistive technology

- Each step's option list is a list (`role="list"`, each option wrapper `role="listitem"`), so a screen reader announces "list, 9 items" on entering it. The fade at the bottom of a list stays visual only.
- The buttons keep their accessible names; the `h2` of the step keeps focus on arrival.

## 8. Copy

The only new visible word is "Recent". The accessible name follows the existing area pattern ("Recent, 3 decks").

## 9. Tests

- Unit (`tests/components/start/useCatalog.test.ts`): `recentDecks` with no history, one deck, two and more, equal times, a deck missing from the index, more than five, and a deck id that is a prefix of another (`gcp-pca` and `gcp-pcd` style ids stay apart because the prefix ends in "-").
- Unit (`tests/components/start/StartFlow.test.tsx`): the Recent card shows only with two or more recent decks and comes first; its accessible name; the recent deck step's order and offline states; choosing a recent deck fills the pass and opens the section or class step; Back from that step returns to the recent deck step and from there to step 1; the pass fields' ways back.
- Unit: going back scrolls the chosen card into view before focusing it (spy on the list's scroll, or measure in jsdom where possible) and the list roles.
- e2e (`e2e/recent-decks.spec.ts`, both engines, reduced motion and not): after rounds on two decks, Recent appears with their codes; a round started through Recent records like any other; at 320 by 568 and 390 by 844 nothing overflows; Back paths. A second spec case: choose the last DevOps platform by keyboard, press Escape, and the focused card lies inside the list's visible part.
- Existing specs stay green: `catalog.spec.ts` (Recent has no `data-option`), `start-layout.spec.ts`, `return-focus`, `history`, `reload-history`, `small-screens`, `short-heights-layout`. The unit fixture gets progress for two decks where a test needs Recent.

## 10. Docs to update with the change

- Design system: 5.3 gets the "Recent" variant, 5.4 the pass behaviour on the recent path, section 8 the list roles and the scroll-into-view rule.
- Main spec, section 9 ("Start"): the Recent destination and the recent deck step.

## 11. Release

App code: production needs the owner's approval for this release (the standing approval covers deck batches only).
