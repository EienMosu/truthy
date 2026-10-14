# Truthy recent decks and long start-flow lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A returning player who plays several decks reaches them from step 1 through one "Recent" card; going back on a long step list brings the chosen card into view before it takes focus; each step's options are announced as a list.

**Architecture:** The recent decks are derived from the progress the game already keeps: a pure `recentDecks` in `components/start/useCatalog.ts`, worked out once when the catalog is ready and carried in the ready status. The start flow keeps its six steps; the recent path is step 3 with `choice.via = "recent"` (no step 2), so the history, Back, the pass fields and the hand-off to `/play` reuse the step machinery with a `recent` flag on `pathTo` and `previousStep`. Scrolling back to the chosen card is a pure `revealDelta` plus a small DOM helper in `components/start/listCue.ts`, called from a layout effect before the existing focus effect.

**Tech Stack:** Next.js 16 (App Router, prerendered), React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Tailwind CSS 4, Motion (`m.*` under `MotionFeatures`), zod/mini, Vitest with Testing Library (jsdom), Playwright (phone-sized Chromium and WebKit), pnpm, Node 24.

**Spec:** `docs/superpowers/specs/2026-10-13-truthy-recent-decks-design.md` (approved by the owner on 2026-10-14). Parents: `docs/superpowers/specs/2026-10-01-truthy-design.md`, `design/system/DESIGN-SYSTEM.md`. Where they disagree on behaviour the recent-decks spec wins for this change; the rulings below say where the plan departs from its text and why.

## Rulings made while planning (2026-10-14)

1. **Four recent decks, not five.** Measured in Chromium with the shipped `app/fonts/overpass-mono-400.woff2` at 12 px: "CLF · GIT · SQL · TSC · RCT" is 199.6 px wide, "CLF · GIT · SQL · TSC" 155.2 px. The area card's main column at 320 px is 192 px (card 288, stub 64, padding 20 and 12). Spec section 4 requires the codes to fit the 320 px card, so the limit is 4 (`RECENT_LIMIT`). Task 3 amends the spec. Cost if wrong: one constant.
2. **"Change platform" on the recent path follows spec section 5 as written:** it opens that platform's own deck step on the ordinary path (the design system's general rule says a field returns to its step; the spec makes this one exception and asks the design system to record it). The history becomes the ordinary path's: step 1, the platform step, the deck step.
3. **Return from a round:** spec section 6 lists "the start opening after a round" among the ways back with a chosen card. That return lands on step 1 with the choices cleared and focuses the step 1 title (design system 8); there is no chosen card, so nothing changes there.
4. **Short screens:** where the whole column scrolls and the list does not (`short:` in `app/globals.css`), the existing rule stays: a way back by a press keeps the column at its top, a way back from the keyboard brings the card into the column's view (`showInColumn`). The new list scroll is a no-op there, since the list does not scroll.
5. **While the flow moves the browser for "Change platform"** (one `history.go`), Back, Escape, the pass fields and every forward choice are ignored, and the browser's report of that move is ignored, the same way the reload rewind already holds forward choices.

## Global Constraints

- Work in the `truthy-web` checkout on branch `web-polish` (rebased on `main` a89d3e5). Every command runs from the repository root.
- No em dash (U+2014) anywhere: code, comments, docs, commit messages.
- The only new visible word is "Recent". Accessible name of the card: `Recent, ${decksLabel(n)}` ("Recent, 3 decks").
- The codes on the Recent card are joined by `" · "` (space, U+00B7, space), newest first.
- At most `RECENT_LIMIT = 4` recent decks (ruling 1). The Recent card shows only with two or more.
- Nothing new is stored. `truthy.progress.v1` and every other stored format stay as they are.
- The Recent card is the area card (`DestinationCard variant="place"`); its wrapper carries `data-recent`, never `data-option`.
- Components use tokens only; no raw colours; Motion only through `m.*` elements inside `MotionFeatures`.
- Commit messages in the repo's style (`feat: ...`, `test: ...`, `docs: ...`), a body when useful, no attribution lines. The repository is public: no local paths, e-mail addresses or secrets in any tracked file.
- Gates per task: `pnpm typecheck` and `pnpm test` green. Task 3 also runs its e2e specs and the listed existing ones with `E2E_PORT=3460` (another checkout may use 3100).

## Review Focus

1. A deck id that begins another deck's id ("gcp-cdl" and "gcp-cdl-pro"): the history of one must not make the other recent. Pinned in Task 1 (longest prefix wins).
2. A reload in the middle of the recent path: the flow must start at step 1 and move the browser back past exactly the recent path's entries (no platform step among them). Pinned in Task 1 (`entriesBehind`) and Task 2 (reload test).
3. A history entry that was not written by this release, with a `via` of another value, or a recent-path entry at step 2: read as the ordinary path, or sent to step 1. Pinned in Task 1 (`canShow`) and Task 2 (forged `via` test).
4. Escape, Back or a field pressed while the flow is still moving the browser for "Change platform": must not land between paths. Pinned in Task 2.
5. The recent list must not change under the player: the progress the catalog replaces after a deck update keeps the same recent list. Pinned in Task 1.

---

### Task 1: The pure parts: recent decks, the recent path's steps and the list reveal

**Files:**
- Modify: `components/start/useCatalog.ts`
- Modify: `components/start/StartFlow.tsx` (the pure section only: lines 68 to 197 today)
- Modify: `components/start/listCue.ts`
- Test: `tests/components/start/useCatalog.test.tsx`, `tests/components/start/StartFlow.test.tsx` (the "the steps (pure)" describe), `tests/components/start/listCue.test.tsx`

**Interfaces:**
- Produces (useCatalog.ts):
  - `export interface RecentDeck { area: IndexArea; platform: IndexPlatform; deck: IndexDeck; lastSeenAt: number }`
  - `export const RECENT_LIMIT = 4`
  - `export function recentDecks(index: DeckIndex, progress: Progress, limit = RECENT_LIMIT): RecentDeck[]`
  - `CatalogStatus` ready variant gains `recent: readonly RecentDeck[]`.
- Produces (StartFlow.tsx, exported):
  - `export const RECENT = "recent"`
  - `Choice` gains `via?: typeof RECENT`
  - `export function stepOf(key: keyof Choice, choice: Choice): Step`
  - `export function pathTo(step: Step, hasSections: boolean, recent = false): Step[]`
  - `export function previousStep(step: Step, hasSections: boolean, recent = false): Step`
  - `export function chosenOn(target: Step, choice: Choice): string | undefined`
  - `clearFrom`, `canShow`, `entriesBehind` keep their signatures and learn the recent path.
- Produces (listCue.ts):
  - `export function revealDelta(viewHeight: number, item: ItemSpan, room: number): number`
  - `export function revealInList(list: HTMLElement, content: HTMLElement, item: HTMLElement, room: number): void`

- [ ] **Step 1: Write the failing tests for `recentDecks` and the ready status**

In `tests/components/start/useCatalog.test.tsx`, extend the import from `@/components/start/useCatalog` with `RECENT_LIMIT, recentDecks`, and add after the `describe("seenPercent", ...)` block:

```tsx
describe("recentDecks", () => {
  const at = (lastSeenAt: number) => ({ seen: 1, lastCorrect: true, lastSeenAt });
  const codes = (progress: Progress, index: DeckIndex = INDEX, limit?: number) =>
    recentDecks(index, progress, limit).map((played) => played.deck.code);

  /** INDEX with `count` decks on Azure, azure-az0 to azure-az<count-1>, codes AZ0 to AZ<count-1>. */
  function indexWithAzure(count: number): DeckIndex {
    const index = structuredClone(INDEX);
    const azure = index.areas[0]!.platforms[2]!;
    azure.decks = Array.from({ length: count }, (_, i) => ({
      id: `azure-az${i}`,
      code: `AZ${i}`,
      title: `Azure ${i}`,
      cardCount: 10,
      version: "2026-10-01",
      hash: `az-${i}`,
      sections: [],
    }));
    return index;
  }

  it("lists nothing without history", () => {
    expect(recentDecks(INDEX, emptyProgress())).toEqual([]);
  });

  it("gives each deck its area, platform and latest time, newest first", () => {
    const progress = progressWith({
      cards: { "aws-clf-c02-1": at(100), "aws-clf-c02-2": at(300), "gcp-cdl-1": at(200), "nextjs-rendering-1": at(50) },
    });
    expect(recentDecks(INDEX, progress).map((p) => [p.area.id, p.platform.id, p.deck.code, p.lastSeenAt])).toEqual([
      ["cloud", "aws", "CLF", 300],
      ["cloud", "gcp", "CDL", 200],
      ["frontend", "nextjs", "RND", 50],
    ]);
  });

  it("keeps catalog order for equal times", () => {
    expect(codes(progressWith({ cards: { "nextjs-rendering-1": at(5), "gcp-cdl-1": at(5), "aws-clf-c02-1": at(5) } }))).toEqual(["CLF", "CDL", "RND"]);
  });

  it("leaves out a deck the index no longer has", () => {
    expect(codes(progressWith({ cards: { "aws-gone-1": at(900), "gcp-cdl-1": at(1) } }))).toEqual(["CDL"]);
  });

  it("lists four at most, or as many as asked", () => {
    const index = indexWithAzure(5);
    const progress = progressWith({ cards: Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`azure-az${i}-1`, at(i)])) });
    expect(RECENT_LIMIT).toBe(4);
    expect(codes(progress, index)).toEqual(["AZ4", "AZ3", "AZ2", "AZ1"]);
    expect(codes(progress, index, 2)).toEqual(["AZ4", "AZ3"]);
  });

  it("gives a card to the deck whose id is its longest prefix, so an id that begins another deck's stays apart", () => {
    const index = structuredClone(INDEX);
    index.areas[0]!.platforms[1]!.decks.push({ id: "gcp-cdl-pro", code: "CDP", title: "Pro", cardCount: 5, version: "2026-10-01", hash: "cdp-1", sections: [] });
    expect(codes(progressWith({ cards: { "gcp-cdl-pro-1": at(10) } }), index)).toEqual(["CDP"]);
    expect(codes(progressWith({ cards: { "gcp-cdl-pro-1": at(10), "gcp-cdl-7": at(20) } }), index)).toEqual(["CDL", "CDP"]);
  });
});
```

In the `describe("useCatalog: the seen share after a deck update", ...)` block, add:

```tsx
  it("works out the recent decks once: the progress replaced after a deck update keeps the same list", async () => {
    const old = deckFile("aws-clf-c02", "clf-1", CLF_IDS);
    const updated = deckFile("aws-clf-c02", "clf-2", [...CLF_IDS.slice(10), "aws-clf-c02-new"]);
    const local = deviceWith(old);
    const net = network(indexWithClf("clf-2", 11), [updated]);
    const status = await ready(
      { fetcher: net.fetcher, localStorage: () => local, sessionStorage: () => undefined, offline: noOfflineClient },
      (s) => "aws-clf-c02" in s.cardIds,
    );
    expect(Object.keys(status.progress.cards)).toEqual([]);
    expect(status.recent.map((played) => played.deck.code)).toEqual(["CLF"]);
  });
```

In the `describe("useCatalog", ...)` block, add:

```tsx
  it("carries the recent decks with the index and the progress", async () => {
    const h = harness(
      storedProgress({ cards: { "aws-clf-c02-1": { seen: 1, lastCorrect: true, lastSeenAt: 1 }, "gcp-cdl-1": { seen: 1, lastCorrect: true, lastSeenAt: 2 } } }),
    );
    const { result } = renderHook(() => useCatalog(h.services));
    await waitFor(() => expect(result.current.status.kind).toBe("ready"));
    const status = result.current.status;
    if (status.kind !== "ready") throw new Error("not ready");
    expect(status.recent.map((played) => played.deck.code)).toEqual(["CDL", "CLF"]);
  });
```

- [ ] **Step 2: Write the failing tests for the recent path's steps**

In `tests/components/start/StartFlow.test.tsx`, change the import to

```tsx
import { RECENT, StartFlow, canShow, chosenOn, clearFrom, entriesBehind, pathTo, previousStep, stepOf } from "@/components/start/StartFlow";
```

(`entriesBehind` is already exported by `StartFlow.tsx`.) Add inside `describe("the steps (pure)", ...)`:

```tsx
  it("clears the area and platform with the deck on the recent path, where they come with it", () => {
    const all = { via: RECENT, areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC" } as const;
    expect(clearFrom(all, 3)).toEqual({ via: RECENT });
    expect(clearFrom(all, 4)).toEqual({ via: RECENT, areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02" });
    expect(clearFrom(all, 1)).toEqual({});
    expect(stepOf("areaId", all)).toBe(3);
    expect(stepOf("areaId", { areaId: "cloud" })).toBe(1);
    expect(stepOf("via", all)).toBe(1);
  });

  it("walks the recent path without the platform step", () => {
    expect(pathTo(6, true, true)).toEqual([1, 3, 4, 5, 6]);
    expect(pathTo(5, false, true)).toEqual([1, 3, 5]);
    expect(previousStep(3, true, true)).toBe(1);
    expect(previousStep(4, true, true)).toBe(3);
    expect(previousStep(5, false, true)).toBe(3);
  });

  it("names the card to focus on the way back: the Recent card on step 1 of the recent path", () => {
    const recent = { via: RECENT, areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02" } as const;
    expect(chosenOn(1, recent)).toBe(RECENT);
    expect(chosenOn(3, recent)).toBe("aws-clf-c02");
    expect(chosenOn(1, { areaId: "cloud" })).toBe("cloud");
    expect(chosenOn(2, { areaId: "cloud", platformId: "aws" })).toBe("aws");
    expect(chosenOn(6, { mode: "classic" })).toBeUndefined();
  });

  it("shows the recent decks' step without an area or platform, and never a platform step on the recent path", () => {
    expect(canShow(INDEX, 3, { via: RECENT })).toBe(true);
    expect(canShow(INDEX, 3, {})).toBe(false);
    expect(canShow(INDEX, 2, { via: RECENT, areaId: "cloud" })).toBe(false);
    expect(canShow(INDEX, 4, { via: RECENT, areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02" })).toBe(true);
  });

  it("counts the entries behind a recent-path entry without the platform step", () => {
    expect(entriesBehind(INDEX, { step: 3, choice: { via: RECENT } })).toBe(1);
    expect(entriesBehind(INDEX, { step: 4, choice: { via: RECENT, areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02" } })).toBe(2);
    expect(entriesBehind(INDEX, { step: 5, choice: { via: RECENT, areaId: "cloud", platformId: "gcp", deckId: "gcp-cdl", sectionId: "ALL" } })).toBe(2);
  });
```

- [ ] **Step 3: Write the failing tests for `revealDelta`**

In `tests/components/start/listCue.test.tsx`, import `revealDelta` and `FADE_PX` from `@/components/start/listCue` (add to the existing import) and add:

```tsx
describe("revealDelta", () => {
  it("leaves a card that shows whole, with room for its ring and for the fade below it", () => {
    expect(revealDelta(400, { top: 100, bottom: 200 }, 8)).toBe(0);
  });

  it("scrolls down to a card below the view, just far enough, the fade's room included", () => {
    expect(revealDelta(400, { top: 500, bottom: 600 }, 8)).toBe(600 + 8 + FADE_PX - 400);
  });

  it("scrolls up to a card above the view", () => {
    expect(revealDelta(400, { top: -150, bottom: -50 }, 8)).toBe(-158);
  });

  it("shows the top of a card taller than the view", () => {
    expect(revealDelta(100, { top: 50, bottom: 300 }, 8)).toBe(42);
  });
});
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `pnpm vitest run tests/components/start/useCatalog.test.tsx tests/components/start/StartFlow.test.tsx tests/components/start/listCue.test.tsx`
Expected: FAIL (`recentDecks`, `RECENT`, `stepOf`, `chosenOn`, `revealDelta` are not exported).

- [ ] **Step 5: Implement `recentDecks` and the ready status's `recent`**

In `components/start/useCatalog.ts`:

1. Extend the file's header comment, after "...and where "Continue" leads.", with: ` Also which decks were played last ("Recent", recentDecks).`
2. Add `recent` to the ready variant of `CatalogStatus`:

```ts
      /**
       * The decks played last, newest first (recentDecks). Worked out once, when the index and the progress are
       * read, so the list does not reorder while the start screen is open.
       */
      recent: readonly RecentDeck[];
```

3. In `useCatalog`, compute it once and keep it in both `setStatus` calls:

```ts
        const progress = withoutRemovedCards(loaded, known, store);
        const recent = recentDecks(index, progress);
        setStatus({ kind: "ready", index, progress, cardIds: known, recent });
```

and in the later update:

```ts
          setStatus({ kind: "ready", index, progress: withoutRemovedCards(progress, more, store), cardIds: { ...known, ...more }, recent });
```

4. Add after `continueTarget`:

```ts
/** A deck the player has played, where it sits in the catalog, and when one of its cards was last seen. */
export interface RecentDeck {
  area: IndexArea;
  platform: IndexPlatform;
  deck: IndexDeck;
  /** The latest lastSeenAt among the history entries of its cards. */
  lastSeenAt: number;
}

/** How many decks "Recent" lists at most: the codes of four fit one line of the area card at 320 px. */
export const RECENT_LIMIT = 4;

/**
 * The decks of the index the player has played, newest first ("Recent", recent-decks spec section 3). A deck counts
 * when at least one of its cards has a history entry; its time is the latest lastSeenAt among them, and equal times
 * keep catalog order. A card belongs to the deck whose `${id}-` is its longest prefix, so a deck whose id begins
 * another deck's ("gcp-cdl" and "gcp-cdl-pro") never takes that deck's history. Nothing is stored for it.
 */
export function recentDecks(index: DeckIndex, progress: Progress, limit = RECENT_LIMIT): RecentDeck[] {
  const placed = index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks.map((deck) => ({ area, platform, deck }))));
  const longestFirst = [...placed].sort((a, b) => b.deck.id.length - a.deck.id.length);
  const latest = new Map<string, number>();
  for (const [cardId, entry] of Object.entries(progress.cards)) {
    const owner = longestFirst.find(({ deck }) => cardId.startsWith(`${deck.id}-`));
    if (owner) latest.set(owner.deck.id, Math.max(latest.get(owner.deck.id) ?? Number.NEGATIVE_INFINITY, entry.lastSeenAt));
  }
  return placed
    .flatMap((place) => {
      const lastSeenAt = latest.get(place.deck.id);
      return lastSeenAt === undefined ? [] : [{ ...place, lastSeenAt }];
    })
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, limit);
}
```

(`Array.prototype.sort` is stable, so equal times keep the catalog order of `placed`.)

- [ ] **Step 6: Implement the recent path in the pure section of `StartFlow.tsx`**

Replace the `Choice` interface, `ChoiceKey`, `CHOICE_KEYS`, `STEP_OF`, `clearFrom`, `pathTo` and `previousStep` (lines 72 to 108 today) with:

```ts
/** The Recent card's choice on step 1: the deck step then lists the decks played last (the recent path). */
export const RECENT = "recent";

/** What the player has chosen so far, as ids. sectionId is a section id or WHOLE_DECK. */
export interface Choice {
  /** RECENT on the recent path: step 1 chose "Recent", and the deck step fills area, platform and deck at once. */
  via?: typeof RECENT;
  areaId?: string;
  platformId?: string;
  deckId?: string;
  sectionId?: string;
  mode?: Mode;
}

type ChoiceKey = keyof Choice;
const CHOICE_KEYS: readonly ChoiceKey[] = ["via", "areaId", "platformId", "deckId", "sectionId", "mode"];

/** The step on which each choice is made on the ordinary path. */
export const STEP_OF: Record<ChoiceKey, Step> = { via: 1, areaId: 1, platformId: 2, deckId: 3, sectionId: 4, mode: 5 };

/** The step on which `key` is chosen in `choice`: on the recent path the area and the platform come with the deck. */
export function stepOf(key: ChoiceKey, choice: Choice): Step {
  return choice.via === RECENT && (key === "areaId" || key === "platformId") ? 3 : STEP_OF[key];
}

const STEP_OF_FIELD: Record<PassFieldName, Step> = { area: 1, platform: 2, deck: 3, section: 4, mode: 5 };

/** Keeps only the choices made before `step`: going back to a step clears it and everything after it. */
export function clearFrom(choice: Choice, step: Step): Choice {
  const kept: Choice = {};
  for (const key of CHOICE_KEYS) {
    if (stepOf(key, choice) < step && choice[key] !== undefined) Object.assign(kept, { [key]: choice[key] });
  }
  return kept;
}

/** The steps a player passes through up to `step`. A deck without sections has no step 4; the recent path has no step 2. */
export function pathTo(step: Step, hasSections: boolean, recent = false): Step[] {
  const all: Step[] = hasSections ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 5, 6];
  return all.filter((s) => s <= step && !(recent && s === 2));
}

/** Where Back goes from `step`: one step back on its path, so from the class step of a deck without sections to the deck step. */
export function previousStep(step: Step, hasSections: boolean, recent = false): Step {
  const path = pathTo(step, hasSections, recent);
  return path[path.length - 2] ?? 1;
}

/** The choice made on each step, whose card takes focus when the flow comes back to that step. */
const CHOSEN_ON: Partial<Record<Step, Exclude<ChoiceKey, "via">>> = { 1: "areaId", 2: "platformId", 3: "deckId", 4: "sectionId", 5: "mode" };

/** The id of the card chosen on `target` in `choice`; on step 1 of the recent path, the Recent card (RECENT). */
export function chosenOn(target: Step, choice: Choice): string | undefined {
  if (target === 1 && choice.via === RECENT) return RECENT;
  const key = CHOSEN_ON[target];
  return key ? choice[key] : undefined;
}
```

Keep `sameChoice` as it is (it walks `CHOICE_KEYS`, which now include `via`). Replace `canShow` with:

```ts
/** True when every choice needed to show `step` exists in the index (a stale history entry may not). */
export function canShow(index: DeckIndex, step: Step, choice: Choice): boolean {
  const r = resolve(index, choice);
  const recent = choice.via === RECENT;
  if (recent && step === 2) return false; // the recent path has no platform step
  // The recent decks' step needs no area or platform: each of its decks brings its own.
  const placed = !(recent && step === 3);
  if (step >= 2 && placed && !r.area) return false;
  if (step >= 3 && placed && !r.platform) return false;
  if (step >= 4 && !r.deck) return false;
  if (step === 4 && r.deck && r.deck.sections.length === 0) return false;
  if (step >= 5 && !r.section) return false;
  if (step >= 6 && !r.mode) return false;
  return true;
}
```

In `entriesBehind`, change the last line to

```ts
  return pathTo(entry.step, hasSections, entry.choice.via === RECENT).length - 1;
```

and add to its doc comment: ` On the recent path the platform step is not among them.`

In `readEntry`, accept `via` only with the value RECENT:

```ts
  for (const key of CHOICE_KEYS) {
    const v = (choice as Record<string, unknown>)[key];
    if (typeof v === "string" && (key !== "via" || v === RECENT)) Object.assign(picked, { [key]: v });
  }
```

The component body still calls the old helpers: in it, replace the two `CHOICE_KEYS.find((key) => STEP_OF[key] === ...)` lookups so it compiles and behaves as before:
- in the history listener: delete the `focusKey` line and set `focusId: dir < 0 ? chosenOn(entry.step, current.choice) : undefined`;
- in `backTo`: delete the `focusKey` line and set `focusId: chosenOn(target, v.choice)`.

(`CHOICE_KEYS` now starts with `via`, whose step is 1, so the old lookup would return "via" for step 1.)

- [ ] **Step 7: Implement `revealDelta` and `revealInList` in `listCue.ts`**

Append to `components/start/listCue.ts`:

```ts
/**
 * How far to scroll a list so that a card at `item` (px from the top of the list's view) shows whole in a view
 * `viewHeight` tall, with `room` px around it for its focus ring and, below it, room for the fade (FADE_PX): positive
 * scrolls down, negative up, 0 when it already shows. Nearest edge first: a card taller than the view shows its top.
 */
export function revealDelta(viewHeight: number, item: ItemSpan, room: number): number {
  const top = item.top - room;
  const bottom = item.bottom + room + FADE_PX;
  if (top < 0) return top;
  if (bottom > viewHeight) return Math.min(bottom - viewHeight, top);
  return 0;
}

/**
 * Scrolls `list` at once so that `item`, one of the cards in `content`, shows whole (revealDelta). The card is placed
 * by its layout offset, as the cue places its cards, since it may still be rising into place. A list that does not
 * scroll (on a short screen the column scrolls instead) is left alone.
 */
export function revealInList(list: HTMLElement, content: HTMLElement, item: HTMLElement, room: number): void {
  if (list.scrollHeight <= list.clientHeight) return;
  const contentTop = content.getBoundingClientRect().top - list.getBoundingClientRect().top;
  const top = contentTop + item.offsetTop - content.offsetTop;
  const delta = revealDelta(list.clientHeight, { top, bottom: top + item.offsetHeight }, room);
  if (delta !== 0) list.scrollTop += delta;
}
```

- [ ] **Step 8: Run the tests and the type check**

Run: `pnpm vitest run tests/components/start/ && pnpm typecheck`
Expected: PASS, no type errors. Then the whole unit suite: `pnpm test` (all pass).

- [ ] **Step 9: Commit**

```bash
git add components/start/useCatalog.ts components/start/StartFlow.tsx components/start/listCue.ts tests/components/start/useCatalog.test.tsx tests/components/start/StartFlow.test.tsx tests/components/start/listCue.test.tsx
git commit -m "feat: work out the decks played last and the steps of the recent path, and how far a list scrolls to show a card"
```

---

### Task 2: The start flow: the Recent card, the recent decks' step, going back on long lists, list roles

**Files:**
- Modify: `components/start/StartFlow.tsx` (the component and its parts)
- Modify: `tests/components/start/fixtures.ts` (one helper)
- Test: `tests/components/start/StartFlow.test.tsx` (new describes), `tests/components/start/offline.test.tsx` (one describe), Create: `tests/components/start/reveal-on-return.test.tsx`

**Interfaces:**
- Consumes (Task 1): `RecentDeck`, `status.recent`, `RECENT`, `Choice.via`, `stepOf`, `pathTo(step, hasSections, recent)`, `previousStep(step, hasSections, recent)`, `chosenOn`, `revealInList(list, content, item, room)`.
- Produces: `[data-recent]` on the Recent card's wrapper; `role="list"` on each step's options container and `role="listitem"` on every option wrapper; `playedDecks(decks)` in the test fixtures.

- [ ] **Step 1: Add the fixture helper**

In `tests/components/start/fixtures.ts`, after `storedProgress`:

```ts
/** Local storage with history on these decks: one card each (`<deck id>-1`), last seen at the given time in ms. */
export function playedDecks(decks: Readonly<Record<string, number>>): MemoryStorage {
  const cards = Object.fromEntries(Object.entries(decks).map(([deckId, at]) => [`${deckId}-1`, { seen: 1, lastCorrect: true, lastSeenAt: at }]));
  return storedProgress({ cards });
}
```

- [ ] **Step 2: Write the failing flow tests**

In `tests/components/start/StartFlow.test.tsx`, import `playedDecks` from `./fixtures` and add at the end of the file:

```tsx
// Recent decks (docs/superpowers/specs/2026-10-13-truthy-recent-decks-design.md): CDL played last, CLF before it.
const TWO = { "aws-clf-c02": 100, "gcp-cdl": 200 };

/** The ids of the current step's options (the catalog's own: the Recent card is not one). */
function optionIds(): (string | null)[] {
  return [...document.querySelectorAll("[data-step]:not([inert]) [data-option]")].map((el) => el.getAttribute("data-option"));
}

function focusedLabel(): string | null | undefined {
  return document.activeElement?.getAttribute("aria-label");
}

describe("StartFlow: recent decks on step 1", () => {
  it("shows no Recent card with history on one deck or on none", async () => {
    await start(harness(playedDecks({ "aws-clf-c02": 100 })));
    expect(screen.queryByRole("button", { name: /^Recent/ })).toBeNull();
    cleanup();
    await start();
    expect(screen.queryByRole("button", { name: /^Recent/ })).toBeNull();
  });

  it("lists Recent first, with the codes newest first, apart from the catalog's options", async () => {
    await start(harness(playedDecks(TWO)));
    const recent = screen.getByRole("button", { name: "Recent, 2 decks" });
    expect(recent.textContent).toBe("RecentCDL · CLF");
    const first = document.querySelector("[data-step]:not([inert]) [data-list] > div > *");
    expect(first?.hasAttribute("data-recent")).toBe(true);
    expect(first?.hasAttribute("data-option")).toBe(false);
    expect(optionIds()).toEqual(["cloud", "frontend", "devops"]);
  });

  it("opens the recent decks' step with a blank pass, and Back returns to step 1 on the Recent card", async () => {
    await start(harness(playedDecks(TWO)));
    await choose("Recent, 2 decks", "Choose a deck");
    expect(optionIds()).toEqual(["gcp-cdl", "aws-clf-c02"]);
    expect(field("area")).toBe("Areanot chosen");
    expect(field("platform")).toBe("Platformnot chosen");
    expect(field("deck")).toBe("Decknot chosen");
    expect(document.querySelector('[data-fill-in-pass] [data-field="deck"][data-now]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to areas" }));
    await waitFor(() => expect(heading()).toBe("Choose an area"));
    await waitFor(() => expect(focusedLabel()).toBe("Recent, 2 decks"));
  });
});

describe("StartFlow: the recent path", () => {
  it("fills area, platform and deck at once, and Back from the section step returns to the recent decks", async () => {
    await start(harness(playedDecks(TWO)));
    await choose("Recent, 2 decks", "Choose a deck");
    await choose(/^CLF, Cloud Practitioner/, "Choose a section");
    expect(field("deck")).toBe("DeckCLF");
    expect(screen.getByRole("button", { name: "Change area, now Cloud" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change platform, now AWS" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to decks" }));
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(optionIds()).toEqual(["gcp-cdl", "aws-clf-c02"]);
    await waitFor(() => expect(focusedLabel()).toMatch(/^CLF, Cloud Practitioner/));
  });

  it("goes from a deck without sections to the class step, and back to the recent decks", async () => {
    await start(harness(playedDecks(TWO)));
    await choose("Recent, 2 decks", "Choose a deck");
    await choose(/^CDL, Cloud Digital Leader/, "Choose how to play");
    fireEvent.click(screen.getByRole("button", { name: "Back to decks" }));
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(optionIds()).toEqual(["gcp-cdl", "aws-clf-c02"]);
  });

  it("keeps one history entry per step of the recent path, so the browser's buttons retrace it", async () => {
    await start(harness(playedDecks(TWO)));
    await choose("Recent, 2 decks", "Choose a deck");
    await choose(/^CLF, Cloud Practitioner/, "Choose a section");
    expect(h.history.position).toBe(2);
    expect(h.history.state).toEqual({
      truthyStart: { step: 4, choice: { via: "recent", areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02" } },
    });
    act(() => h.history.back());
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(optionIds()).toEqual(["gcp-cdl", "aws-clf-c02"]);
    act(() => h.history.back());
    await waitFor(() => expect(heading()).toBe("Choose an area"));
    act(() => h.history.forward());
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(optionIds()).toEqual(["gcp-cdl", "aws-clf-c02"]);
  });

  it("returns to step 1 from the area of the pass, clearing every choice", async () => {
    await start(harness(playedDecks(TWO)));
    await choose("Recent, 2 decks", "Choose a deck");
    await choose(/^CLF, Cloud Practitioner/, "Choose a section");
    fireEvent.click(screen.getByRole("button", { name: "Change area, now Cloud" }));
    await waitFor(() => expect(heading()).toBe("Choose an area"));
    expect(h.history.position).toBe(0);
    await waitFor(() => expect(focusedLabel()).toBe("Recent, 2 decks"));
  });

  it("returns to the recent decks from the deck of the pass", async () => {
    await start(harness(playedDecks(TWO)));
    await choose("Recent, 2 decks", "Choose a deck");
    await choose(/^CLF, Cloud Practitioner/, "Choose a section");
    await choose(/^SEC, Security and compliance/, "Choose how to play");
    fireEvent.click(screen.getByRole("button", { name: "Change deck, now CLF" }));
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(optionIds()).toEqual(["gcp-cdl", "aws-clf-c02"]);
    expect(h.history.position).toBe(1);
  });

  it("opens the platform's own deck step from the platform of the pass, and the history becomes the ordinary path's", async () => {
    await start(harness(playedDecks(TWO)));
    await choose("Recent, 2 decks", "Choose a deck");
    await choose(/^CLF, Cloud Practitioner/, "Choose a section");
    await choose(/^SEC, Security and compliance/, "Choose how to play");
    fireEvent.click(screen.getByRole("button", { name: "Change platform, now AWS" }));
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(optionIds()).toEqual(["aws-clf-c02"]);
    expect(field("area")).toBe("AreaCloud");
    expect(field("platform")).toBe("PlatformAWS");
    expect(screen.getByRole("button", { name: "Back to platforms" })).toBeTruthy();
    await waitFor(() => expect(focusedLabel()).toMatch(/^CLF, Cloud Practitioner/));
    await waitFor(() => expect(h.history.state).toEqual({ truthyStart: { step: 3, choice: { areaId: "cloud", platformId: "aws" } } }));
    expect(h.history.position).toBe(2);
    expect(h.history.entries).toHaveLength(3);
    expect(h.history.entries[1]).toEqual({ truthyStart: { step: 2, choice: { areaId: "cloud" } } });
    expect(heading()).toBe("Choose a deck"); // the flow's own move takes it nowhere
    act(() => h.history.back());
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    act(() => h.history.back());
    await waitFor(() => expect(heading()).toBe("Choose an area"));
  });

  it("ignores Escape and the pass while it moves the browser for the platform of the pass", async () => {
    await start(harness(playedDecks(TWO)));
    await choose("Recent, 2 decks", "Choose a deck");
    await choose(/^CLF, Cloud Practitioner/, "Choose a section");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Change platform, now AWS" }));
      fireEvent.keyDown(document.body, { key: "Escape" }); // before the browser reports the move
    });
    await waitFor(() => expect(h.history.state).toEqual({ truthyStart: { step: 3, choice: { areaId: "cloud", platformId: "aws" } } }));
    expect(heading()).toBe("Choose a deck");
    expect(h.history.position).toBe(2);
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    expect(h.history.position).toBe(1);
  });

  it("hands a round started through Recent to /play and takes the recent path's entries out", async () => {
    await start(harness(playedDecks(TWO)));
    const positions: number[] = [];
    router.push.mockImplementation(() => positions.push(h.history.position));
    await choose("Recent, 2 decks", "Choose a deck");
    await choose(/^CLF, Cloud Practitioner/, "Choose a section");
    await choose(/^SEC, Security and compliance/, "Choose how to play");
    await choose(/^Classic\./, "Your pass is ready");
    expect(h.history.position).toBe(4);
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play"));
    expect(positions).toEqual([0]);
    expect(JSON.parse(h.session.data.get(PENDING_KEY) ?? "null")).toEqual({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" });
  });

  it("after a reload in the middle of the recent path, starts at step 1 and moves back past its entries", async () => {
    h = harness(playedDecks(TWO));
    h.history.replace({ truthyStart: { step: 1, choice: {} } });
    h.history.push({ truthyStart: { step: 3, choice: { via: "recent" } } });
    h.history.push({ truthyStart: { step: 4, choice: { via: "recent", areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02" } } });
    render(<StartFlow services={h.services} />);
    await screen.findByRole("button", { name: "Recent, 2 decks" });
    expect(heading()).toBe("Choose an area");
    await waitFor(() => expect(h.history.position).toBe(0));
  });

  it("reads an entry with a via it does not know as the ordinary path", async () => {
    await start(harness(playedDecks(TWO)));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("AWS, 1 deck", "Choose a deck");
    h.history.replace({ truthyStart: { step: 3, choice: { via: "elsewhere", areaId: "cloud", platformId: "aws" } } });
    act(() => h.history.back());
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    act(() => h.history.forward());
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(optionIds()).toEqual(["aws-clf-c02"]);
    expect(field("platform")).toBe("PlatformAWS");
  });
});

describe("StartFlow: the step lists for assistive technology", () => {
  function stepList(): Element | null {
    return document.querySelector("[data-step]:not([inert]) [data-list] > div");
  }

  it("makes each step's options a list of list items, and the loading step no list", async () => {
    h = harness(playedDecks(TWO));
    h.network.hold = true;
    render(<StartFlow services={h.services} />);
    expect(stepList()?.getAttribute("role")).toBeNull();
    await act(async () => h.network.release());
    await screen.findByRole("button", { name: "Recent, 2 decks" });
    expect(stepList()?.getAttribute("role")).toBe("list");
    expect([...(stepList()?.children ?? [])].map((child) => child.getAttribute("role"))).toEqual(["listitem", "listitem", "listitem", "listitem"]);
  });

  it("makes the ready step no list", async () => {
    await start();
    await toClasses();
    await choose(/^Classic\./, "Your pass is ready");
    expect(stepList()?.getAttribute("role")).toBeNull();
  });
});
```

In `tests/components/start/offline.test.tsx`, add at the end:

```tsx
describe("StartFlow offline: recent decks", () => {
  it("keeps Recent a button and dims the recent decks with no copy on the device", async () => {
    const local = device(["gcp-cdl"]);
    const played = { seen: 1, lastCorrect: true };
    local.setItem(PROGRESS_KEY, JSON.stringify({ ...emptyProgress(), cards: { "aws-clf-c02-1": { ...played, lastSeenAt: 100 }, "gcp-cdl-1": { ...played, lastSeenAt: 200 } } }));
    await startOffline(local);
    await choose("Recent, 2 decks", "Choose a deck");
    expect(screen.getByRole("group", { name: "CLF, Cloud Practitioner, needs a connection" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^CDL, Cloud Digital Leader/ })).toBeTruthy();
  });
});
```

Create `tests/components/start/reveal-on-return.test.tsx` (the scroll itself needs layout, which jsdom has not; this pins that the list is asked to show the chosen card before it takes focus):

```tsx
// @vitest-environment jsdom
// Going back on a long list (recent-decks spec section 6): the card chosen before is brought into view in its list
// before it takes focus. jsdom has no layout, so the scroll is checked end to end (e2e/recent-decks.spec.ts); this
// pins the order and the card.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StartFlow } from "@/components/start/StartFlow";
import { SWIPE } from "@/src/input/swipe";
import { harness, playedDecks } from "./fixtures";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const reveals = vi.hoisted(() => [] as { option: string | null; focused: string | null | undefined }[]);
vi.mock("@/components/start/listCue", async (original) => ({
  ...(await original<typeof import("@/components/start/listCue")>()),
  revealInList: (_list: HTMLElement, _content: HTMLElement, item: HTMLElement) => {
    reveals.push({ option: item.getAttribute("data-option") ?? (item.hasAttribute("data-recent") ? "recent" : null), focused: document.activeElement?.getAttribute("aria-label") });
  },
}));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(() => {
  cleanup();
  reveals.length = 0;
});

describe("StartFlow: going back brings the chosen card into view first", () => {
  it("reveals the card chosen before, then focuses it, and reveals nothing going forward", async () => {
    const h = harness(playedDecks({ "aws-clf-c02": 100, "gcp-cdl": 200 }));
    render(<StartFlow services={h.services} />);
    const pick = async (name: string | RegExp, next: string) => {
      h.clock.time += SWIPE.settleMs;
      fireEvent.click(await screen.findByRole("button", { name }));
      await screen.findByRole("heading", { name: next });
    };
    await pick("Cloud, 2 decks", "Choose a platform");
    await pick("AWS, 1 deck", "Choose a deck");
    expect(reveals).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Back to platforms" }));
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("AWS, 1 deck"));
    expect(reveals).toEqual([{ option: "aws", focused: expect.not.stringMatching(/^AWS/) }]);
    fireEvent.click(screen.getByRole("button", { name: "Back to areas" }));
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Cloud, 2 decks"));
    expect(reveals.at(-1)?.option).toBe("cloud");
    h.clock.time += SWIPE.settleMs;
    fireEvent.click(screen.getByRole("button", { name: "Recent, 2 decks" }));
    await screen.findByRole("heading", { name: "Choose a deck" });
    fireEvent.click(screen.getByRole("button", { name: "Back to areas" }));
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Recent, 2 decks"));
    expect(reveals.at(-1)?.option).toBe("recent");
  });
});
```

(If `expect.not.stringMatching` does not match an `undefined` focus in this Vitest version, record `focused ?? ""` in the mock instead; the point is that the AWS card is not yet focused when the reveal runs.)

- [ ] **Step 3: Run the tests to see them fail**

Run: `pnpm vitest run tests/components/start/`
Expected: FAIL (no Recent card, no `data-recent`, no list roles, no reveal call).

- [ ] **Step 4: Implement the component changes in `StartFlow.tsx`**

1. **Header comment** (top of the file), after the line "One screen that steps through six states: ...", add:

```ts
// A "Recent" card on step 1 opens step 3 with the decks played last (the recent path, which has no step 2);
// choosing one of them fills area, platform and deck at once.
```

2. **Imports:** `import { revealInList, useListCue } from "./listCue";` and `import { bestFor, type Progress } from "@/src/progress/progress";`.

3. **Module level**, next to `showInColumn`: add `chosenCard`, and let `showInColumn` find the Recent card's wrapper too:

```ts
/** The card chosen before on a step's panel: the option of `focusId`, or the Recent card (RECENT). */
function chosenCard(panel: Element | null | undefined, focusId: string | undefined): HTMLElement | null {
  if (!panel || !focusId) return null;
  const selector = focusId === RECENT ? "[data-recent] button" : `[data-option="${CSS.escape(focusId)}"] button`;
  return panel.querySelector<HTMLElement>(selector);
}
```

and in `showInColumn`: `const option = card.closest<HTMLElement>("[data-option], [data-recent]");`

4. **In `StartFlow`**, after `const cardIds = ...`: `const recent = status.kind === "ready" ? status.recent : [];` and after `const hasSections = ...`: `const onRecent = view.choice.via === RECENT;`

5. **Move `const rewinding = useRef(false);`** above the history effect (it is read there now), keeping its comment with the reload effect. In the history listener, ignore what the browser reports while the flow moves it itself:

```ts
      if (!entry || !currentIndex || leaving || rewinding.current) return;
```

6. **The reveal**, a layout effect placed right before the focus effect:

```ts
  // Going back on a long list (recent-decks spec section 6): the card chosen before is scrolled into view in its
  // list at once, before the paint and before the effect below focuses it, so the list never shows its top first.
  // Where the list does not scroll (a short screen, where the column scrolls instead) this does nothing.
  useLayoutEffect(() => {
    if (view.seq === 0 || !view.focusId) return;
    const panel = mainRef.current?.querySelector(`[data-step="${view.step}"]`);
    const item = chosenCard(panel, view.focusId)?.closest<HTMLElement>("[data-option], [data-recent]");
    const list = panel?.querySelector<HTMLElement>("[data-list]");
    const content = list?.firstElementChild;
    if (item && list && content instanceof HTMLElement) revealInList(list, content, item, FOCUS_ROOM);
  }, [view]);
```

and in the focus effect replace the `card` lookup with `const card = chosenCard(panel, view.focusId);`.

7. **`forward`** takes the field as optional (the Recent card's name has no field to travel into):

```ts
  /** Moves forward to `step` with `choice`; `source` is the card whose name travels into its `field` of the pass. */
  function forward(step: Step, choice: Choice, field?: PassFieldName, source?: HTMLElement | null) {
    if (!settled() || rewinding.current) return;
    const name = field ? source?.querySelector<HTMLElement>("[data-card-name]") : null;
    const frame = layerRef.current?.offsetParent;
    if (!reduced && field && name && frame) {
```

(the rest unchanged).

8. **`tapBackTo`, `backTo`, `back`, the field jump and the platform jump:**

```ts
  /** A press on the Back pill: held back only right after the column jumped (see above). */
  function tapBackTo(target: Step) {
    if (!headerHeld()) backTo(target);
  }

  /** A press on a filled field of the pass: back to its step; on the recent path the platform opens its deck step. */
  function jump(field: PassFieldName) {
    if (headerHeld()) return;
    if (field === "platform" && onRecent) toPlatformDecks();
    else backTo(STEP_OF_FIELD[field]);
  }

  /** Goes back to an earlier step, clearing it and every later choice. Never held back by the settle time. */
  function backTo(target: Step) {
    const from = view.step;
    if (target >= from || boarding || rewinding.current) return;
    setTravel(null);
    setView((v) => ({ step: target, choice: clearFrom(v.choice, target), dir: -1, focusId: chosenOn(target, v.choice), seq: v.seq + 1 }));
    // Keep the browser history in step: drop the entries of the steps left behind.
    const distance = pathTo(from, hasSections, onRecent).length - pathTo(target, hasSections, onRecent).length;
    if (distance > 0) services.history()?.go(-distance);
  }

  /**
   * The platform field on the recent path opens that platform's own deck step, on the ordinary path (recent-decks
   * spec section 5), focusing the deck chosen before. The ordinary path has the platform step the recent one skipped,
   * so the browser moves back to the recent decks' entry, which becomes the platform step's, and the deck step's
   * entry follows it. While the browser moves, the flow takes no other step and ignores the move it reports.
   */
  function toPlatformDecks() {
    const { areaId, platformId, deckId } = view.choice;
    if (boarding || rewinding.current || !areaId || !platformId) return;
    const distance = pathTo(view.step, hasSections, true).length - 2;
    setTravel(null);
    setView((v) => ({ step: 3, choice: { areaId, platformId }, dir: -1, focusId: deckId, seq: v.seq + 1 }));
    const history = services.history();
    if (!history) return;
    const rewrite = () => {
      history.replace(entryState({ step: 2, choice: { areaId } }));
      history.push(entryState({ step: 3, choice: { areaId, platformId } }));
    };
    if (distance <= 0) {
      rewrite();
      return;
    }
    rewinding.current = true;
    const arrived = () => {
      stop();
      clearTimeout(timer);
      rewinding.current = false;
      rewrite();
    };
    const stop = history.listen(arrived);
    // A browser that never reports the move must not hold the flow.
    const timer = setTimeout(arrived, 1000);
    history.go(-distance);
  }

  const back = () => backTo(previousStep(view.step, hasSections, onRecent));
```

9. **`startRound`:** `const distance = pathTo(view.step, hasSections, onRecent).length - 1;`

10. **JSX:** the Back pill uses `previousStep(step, hasSections, onRecent)` in both its `aria-label` and its `onClick`; `FillInPass` gets `onJump={jump}`; the step panel gets the list flag:

```tsx
            <StepPanel key={step} step={step} dir={view.dir} reduced={reduced} list={step !== 6 && status.kind === "ready"}>
```

11. **`renderOptions`**, step 1 and step 3:

```tsx
      case 1: {
        const areas = index.areas.map((area) => {
          /* unchanged */
        });
        // "Recent" comes first when two or more decks have been played (recent-decks spec section 4).
        if (recent.length < 2) return areas;
        return [
          <Option key={RECENT} id={RECENT} recent>
            <DestinationCard
              variant="place"
              name="Recent"
              sub={recent.map((played) => played.deck.code).join(" · ")}
              label={`Recent, ${decksLabel(recent.length)}`}
              onSelect={() => forward(3, { via: RECENT })}
            />
          </Option>,
          ...areas,
        ];
      }
```

```tsx
      case 3:
        if (onRecent) {
          return recent.map(({ area, platform, deck }) => deckOption(deck, { via: RECENT, areaId: area.id, platformId: platform.id }, progress));
        }
        return (r.platform?.decks ?? []).map((deck) => deckOption(deck, view.choice, progress));
```

and move the deck card out of the switch into a function next to `optionEl`, unchanged apart from `base`:

```tsx
  /** A deck card of step 3; choosing it adds the deck to `base`, the choices made before it. */
  function deckOption(deck: IndexDeck, base: Choice, progress: Progress): ReactNode {
    const seen = seenPercent(progress, deck, cardIds[deck.id]);
    if (!available.has(deck.id)) {
      return (
        <Option key={deck.id} id={deck.id}>
          <DestinationCard
            variant="deck"
            name={deck.code}
            code
            detail={deck.title}
            seenPercent={seen}
            dimmedReason="Needs a connection"
            label={`${deck.code}, ${deck.title}, needs a connection`}
          />
        </Option>
      );
    }
    const choose = () =>
      deck.sections.length > 0
        ? forward(4, { ...base, deckId: deck.id }, "deck", optionEl(deck.id))
        : forward(5, { ...base, deckId: deck.id, sectionId: WHOLE_DECK }, "deck", optionEl(deck.id));
    return (
      <Option key={deck.id} id={deck.id}>
        <DestinationCard
          variant="deck"
          name={deck.code}
          code
          detail={deck.title}
          seenPercent={seen}
          stub={{ label: "Cards", value: String(deck.cardCount) }}
          label={`${deck.code}, ${deck.title}, ${deck.cardCount} cards, ${seen > 0 ? `${seen} percent seen` : "not started"}`}
          onSelect={choose}
        />
      </Option>
    );
  }
```

12. **`StepPanel`** gains `list: boolean` in its props (doc: `/** The step shows options, a list for assistive technology, rather than a message. */`) and puts the role on the options' container; extend the comment above the list with: `Its options are a list for assistive technology ("list, 9 items"); the fade is visual only.`

```tsx
          <div ref={contentRef} role={list ? "list" : undefined} className="flex flex-col gap-(--space-12)">
```

13. **`Option`**:

```tsx
/**
 * One option in a step's list, rising in after the one before it; `id` lets focus come back to it. The Recent card
 * is marked data-recent instead of data-option, so step 1's options stay the catalog's areas (e2e/catalog.spec.ts).
 */
function Option({ id, recent = false, children }: { id: string; recent?: boolean; children: ReactNode }) {
  const { variants, dir } = useContext(ItemMotion);
  return (
    <m.div role="listitem" data-option={recent ? undefined : id} data-recent={recent ? "" : undefined} className="flex-none" variants={variants} custom={dir}>
      {children}
    </m.div>
  );
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `pnpm vitest run tests/components/start/ && pnpm typecheck && pnpm test`
Expected: all pass. If an existing test reads a step's children or `[data-option]` and now meets the list roles, it must still pass unchanged; do not weaken an existing assertion. If one fails, fix the code, not the test, unless the test pins the old `focusKey` lookup itself.

- [ ] **Step 6: Commit**

```bash
git add components/start/StartFlow.tsx tests/components/start/
git commit -m "feat: add Recent to step 1, the recent decks' deck step, and scroll back to the chosen card on long lists"
```

---

### Task 3: End to end, and the documents

**Files:**
- Create: `e2e/recent-decks.spec.ts`
- Modify: `design/system/DESIGN-SYSTEM.md` (5.3, 5.4, 8), `docs/superpowers/specs/2026-10-01-truthy-design.md` (section 9, Screens, item 1), `docs/superpowers/specs/2026-10-13-truthy-recent-decks-design.md` (status line, sections 3, 4, 9, a new section 12), `docs/testing.md` ("On a phone", item 7)

**Interfaces:**
- Consumes: the Recent card (`[data-recent]`, "Recent, N decks"), the recent deck step ("Choose a deck"), list roles, the reveal on going back; e2e helpers from `e2e/helpers.ts` (`CLF_ID`, `CDL_ID`, `CLF_SECURITY`, `CONTINUE_CLF_SECURITY`, `atHome`, `atStep`, `option`, `openHome`, `startRound`, `playRound`, `wrongOn`, `expectResult`).

- [ ] **Step 1: Write the end-to-end spec**

Create `e2e/recent-decks.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import {
  CDL_ID,
  CLF_ID,
  CLF_SECURITY,
  CONTINUE_CLF_SECURITY,
  atHome,
  atStep,
  expectResult,
  openHome,
  option,
  playRound,
  startRound,
  wrongOn,
} from "./helpers";

// Recent decks and going back on long lists (docs/superpowers/specs/2026-10-13-truthy-recent-decks-design.md).

const RCT_ID = "react-fundamentals";
const TSC_ID = "typescript-fundamentals";
const GIT_ID = "git-fundamentals";

/** The first card id of a deck: the start drops the history of cards that are not in their deck any more. */
async function firstCardId(page: Page, deckId: string): Promise<string> {
  const deck = (await (await page.request.get(`/decks/${deckId}.json`)).json()) as { cards: { id: string }[] };
  const id = deck.cards[0]?.id;
  if (!id) throw new Error(`no cards in ${deckId}`);
  return id;
}

/** Stores history on one card of each deck, in the order given (the last is the newest), and opens step 1. */
async function openWithPlayed(page: Page, deckIds: readonly string[]): Promise<void> {
  const cards: Record<string, { seen: number; lastCorrect: boolean; lastSeenAt: number }> = {};
  for (const [i, deckId] of deckIds.entries()) cards[await firstCardId(page, deckId)] = { seen: 1, lastCorrect: true, lastSeenAt: 1_000 + i };
  await page.goto("/");
  await page.evaluate((value) => localStorage.setItem("truthy.progress.v1", value), JSON.stringify({ version: 1, cards, records: {}, last: null }));
  await page.reload();
  await atHome(page);
}

function recentCard(page: Page) {
  return page.locator("[data-step]:not([inert]) [data-recent]");
}

async function optionIds(page: Page): Promise<(string | null)[]> {
  return page.locator("[data-step]:not([inert]) [data-option]").evaluateAll((els) => els.map((el) => el.getAttribute("data-option")));
}

/** The focused card lies whole inside the visible part of its list. */
async function focusedInListView(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const focused = document.activeElement;
    const list = focused?.closest("[data-list]");
    if (!focused || !list) return false;
    const card = focused.getBoundingClientRect();
    const view = list.getBoundingClientRect();
    return card.top >= view.top - 0.5 && card.bottom <= view.bottom + 0.5;
  });
}

for (const motion of ["reduce", "no-preference"] as const) {
  test.describe(`recent decks, ${motion === "reduce" ? "reduced motion" : "full motion"}`, () => {
    test.use({ reducedMotion: motion });

    test("lists the decks played last, and a round started through Recent records like any other", async ({ page }) => {
      test.slow(); // one round
      await openWithPlayed(page, [CLF_ID, CDL_ID]);
      await expect(recentCard(page)).toHaveText("RecentCDL · CLF");
      expect(await page.locator("[data-step]:not([inert]) [role=list] > [role=listitem]").first().getAttribute("data-recent")).toBe("");
      await option(page, "Recent, 2 decks").click();
      await atStep(page, "Choose a deck");
      expect(await optionIds(page)).toEqual([CDL_ID, CLF_ID]);
      await option(page, CLF_SECURITY.deck).click();
      await atStep(page, "Choose a section");
      await expect(page.getByRole("button", { name: "Change platform, now AWS" })).toBeVisible();
      await option(page, CLF_SECURITY.section!).click();
      await atStep(page, "Choose how to play");
      await option(page, CLF_SECURITY.mode).click();
      await atStep(page, "Your pass is ready");
      await startRound(page);
      await playRound(page, CLF_ID, wrongOn(2));
      await expectResult(page, 9);
      await page.getByRole("button", { name: "Choose another route" }).click();
      await atHome(page);
      // CLF is now the newest, and the continue line leads back to the round.
      await expect(recentCard(page)).toHaveText("RecentCLF · CDL");
      await expect(page.getByRole("button", { name: `${CONTINUE_CLF_SECURITY} Last score 9 of 10.` })).toBeVisible();
    });

    test("goes back from a recent deck to the recent decks and then to step 1, by Back and by the browser", async ({ page }) => {
      await openWithPlayed(page, [CLF_ID, CDL_ID]);
      await option(page, "Recent, 2 decks").click();
      await atStep(page, "Choose a deck");
      await option(page, CLF_SECURITY.deck).click();
      await atStep(page, "Choose a section");
      await page.getByRole("button", { name: "Back to decks" }).click();
      await atStep(page, "Choose a deck");
      await expect(page.locator(":focus")).toHaveAttribute("aria-label", /^CLF, Cloud Practitioner/);
      await page.getByRole("button", { name: "Back to areas" }).click();
      await atStep(page, "Choose an area");
      await expect(page.locator(":focus")).toHaveAttribute("aria-label", "Recent, 2 decks");

      await option(page, "Recent, 2 decks").click();
      await atStep(page, "Choose a deck");
      await option(page, /^CDL, Cloud Digital Leader/).click();
      await atStep(page, "Choose how to play");
      await page.goBack();
      await atStep(page, "Choose a deck");
      expect(await optionIds(page)).toEqual([CDL_ID, CLF_ID]);
      await page.goBack();
      await atStep(page, "Choose an area");
      await expect(page).toHaveURL(/\/$/);
    });

    test("brings the chosen platform into view on a long list when going back, by keyboard and by a press", async ({ page }) => {
      await openHome(page);
      await option(page, /^DevOps, /).click();
      await atStep(page, "Choose a platform");
      await expect(page.locator("[data-step]:not([inert]) [role=list] > [role=listitem]")).toHaveCount(10);
      await option(page, "Networking, 1 deck").focus();
      await page.keyboard.press("Enter");
      await atStep(page, "Choose a deck");
      await page.keyboard.press("Escape");
      await atStep(page, "Choose a platform");
      await expect(page.locator(":focus")).toHaveAttribute("aria-label", "Networking, 1 deck");
      await expect.poll(() => focusedInListView(page)).toBe(true);

      await option(page, "Networking, 1 deck").click();
      await atStep(page, "Choose a deck");
      await page.getByRole("button", { name: "Back to platforms" }).click();
      await atStep(page, "Choose a platform");
      await expect(page.locator(":focus")).toHaveAttribute("aria-label", "Networking, 1 deck");
      await expect.poll(() => focusedInListView(page)).toBe(true);
    });
  });
}

for (const size of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
]) {
  test.describe(`recent decks on a ${size.width} by ${size.height} screen`, () => {
    test.use({ viewport: size, reducedMotion: "reduce" });

    test("lists four decks, their codes on one line, and nothing runs past the screen", async ({ page }) => {
      await openWithPlayed(page, [CLF_ID, CDL_ID, RCT_ID, TSC_ID, GIT_ID]);
      await expect(page.getByRole("button", { name: "Recent, 4 decks" })).toBeVisible();
      const codes = recentCard(page).getByText("GIT · TSC · RCT · CDL", { exact: true });
      await expect(codes).toBeVisible();
      // One line of 12 px Mono: two lines would be at least twice its line height.
      expect(await codes.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(24);
      expect(await codes.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);

      await option(page, "Recent, 4 decks").click();
      await atStep(page, "Choose a deck");
      expect(await optionIds(page)).toEqual([GIT_ID, TSC_ID, RCT_ID, CDL_ID]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    });
  });
}
```

Before relying on `CLF_SECURITY.deck`, `CLF_SECURITY.section` and `CLF_SECURITY.mode`, read their values in `e2e/helpers.ts` (they are the accessible names the other specs use for the same route). If the codes' span is not the direct holder of the text, locate it with `recentCard(page).locator("span", { hasText: "GIT · TSC · RCT · CDL" }).last()`.

- [ ] **Step 2: Run the new spec in both engines**

Run: `E2E_PORT=3460 pnpm exec playwright test e2e/recent-decks.spec.ts > /tmp/recent-e2e.log 2>&1; echo exit $?; tail -30 /tmp/recent-e2e.log`
(The scratch log path is local; never commit it.) Expected: exit 0, 14 passed (7 tests in 2 projects). A failure in the reveal case means the code, not the spec, is wrong: go back to Task 2's layout effect.

- [ ] **Step 3: Run the existing start-flow specs that the spec names**

Run: `E2E_PORT=3460 pnpm exec playwright test e2e/catalog.spec.ts e2e/start-layout.spec.ts e2e/return-focus.spec.ts e2e/history.spec.ts e2e/reload-history.spec.ts e2e/small-screens.spec.ts e2e/short-heights-layout.spec.ts e2e/quick-back.spec.ts e2e/keyboard.spec.ts e2e/returning.spec.ts > /tmp/start-e2e.log 2>&1; echo exit $?; grep -E "passed|failed|flaky" /tmp/start-e2e.log | tail -5`
Expected: exit 0.

- [ ] **Step 4: Update the design system**

In `design/system/DESIGN-SYSTEM.md`:

- 5.3, **Variants**, after the "Area / platform" bullet, add:

```markdown
  - **Recent** (start step 1, first in the list): the area / platform card named "Recent", its sub-line the codes of the decks played last, newest first, joined by " · " ("CDL · CLF"), at most four (four codes fit one line of the card at 320; five do not). Shown only when two or more decks the catalog still has were played on the device; worked out from the progress already stored when step 1 appears, and not reordered while the start is open. It is not an option of the catalog: its wrapper carries `data-recent`, not `data-option`. Accessible name "Recent, 3 decks". Offline it stays a button; the decks it opens show their own "Needs a connection" state.
```

- 5.4, after the **Behaviour** bullet, add:

```markdown
- **The recent path** (step 1's "Recent", then a deck of the recent decks, a step titled "Choose a deck" with the deck cards of 5.3): layout 1 shows Area and Platform blank and Deck as the field being chosen; choosing a deck fills all three at once and the pass takes layout 2. The deck field returns to the recent decks and the area word to step 1, as on the ordinary path; the platform word is the one exception to "returns to its step": it opens that platform's own deck step, on the ordinary path. Back from the section step (or the class step of a deck without sections) returns to the recent decks, and from there to step 1, where the Recent card takes focus.
```

- 8, **Focus**, at the end of the start-flow bullet ("In the start flow, going forward focuses the new step title; ..."), add:

```markdown
 Going back on a list longer than its view first scrolls that list, at once, so the chosen card shows whole above the fade, then focuses it. On a short screen, where the whole column scrolls instead of the list, only a way back from the keyboard moves the column; a way back by a press leaves it at its top.
```

- 8, **Screen reader**, add a bullet:

```markdown
  - Each start step's options are a list (`role="list"`, each card a `listitem`), so a screen reader says how many choices it holds ("list, 10 items") on entering it; the loading placeholders, the load failure and the ready step are not lists. The fade at the bottom of a long list is visual only.
```

- [ ] **Step 5: Update the main spec, the recent-decks spec and the phone check**

In `docs/superpowers/specs/2026-10-01-truthy-design.md`, section 9, Screens, item 1, after the sentence ending `one "Continue" line.`, add:

```markdown
 When the player has played two or more decks the catalog still has, a "Recent" card comes before the areas: it opens a deck step of those decks, newest first, at most four, and choosing one fills area, platform and deck at once (`docs/superpowers/specs/2026-10-13-truthy-recent-decks-design.md`).
```

and in the same item change `a filled field returns to its step;` to `a filled field returns to its step (on the recent path, the platform opens that platform's deck step);`.

In `docs/superpowers/specs/2026-10-13-truthy-recent-decks-design.md`:
- the status line becomes: `Date: 2026-10-13. Status: approved by the owner on 2026-10-14; built from docs/superpowers/plans/2026-10-14-truthy-recent-decks/README.md, with the amendments of section 12.`
- section 2, item 1: "at most five" becomes "at most four"; section 3: "At most five are listed." becomes "At most four are listed (section 12)." and `limit = 5` becomes `limit = 4`; section 4: the five-code example becomes `With four codes the line is "CLF · GIT · SQL · TSC", which fits the 320 px card.`; section 9: "more than five" becomes "more than four".
- append:

```markdown
## 12. Amendments after the plan (2026-10-14)

1. **Four decks, not five.** Measured in Chromium with the shipped Overpass Mono 400 at 12 px, five codes joined by " · " are 199.6 px wide and four are 155.2 px; the area card's main column at 320 px is 192 px (card 288, stub 64, padding 20 and 12). The sub-line must fit that card, so Recent lists four.
2. **The start opening after a round** (section 6) has no chosen card: it lands on step 1 with the choices cleared and focuses the step 1 title (design system 8), as before.
3. **Short screens:** where the whole column scrolls and the list does not, a way back by a press keeps the column at its top and a way back from the keyboard brings the card into the column's view (design system 8), as before. The list scroll of section 6 applies where the list itself scrolls.
4. **While the flow moves the browser** for "Change platform" on the recent path, Back, Escape, the pass fields and forward choices are ignored, as during the reload rewind.
```

In `docs/testing.md`, "On a phone", add item 7:

```markdown
7. With VoiceOver on, open DevOps: entering the platforms VoiceOver says it is a list of 10 items. After rounds on two decks, step 1 starts with "Recent" and its codes; through it, play a round on one of them, and back on the start that deck's code comes first.
```

- [ ] **Step 6: Run the gates**

Run: `pnpm typecheck && pnpm test`
Expected: all pass. Run `git grep -n $'\u2014' -- design docs components e2e tests` and expect no new hits in the lines this plan added.

- [ ] **Step 7: Commit**

```bash
git add e2e/recent-decks.spec.ts design/system/DESIGN-SYSTEM.md docs/superpowers/specs/2026-10-01-truthy-design.md docs/superpowers/specs/2026-10-13-truthy-recent-decks-design.md docs/testing.md
git commit -m "test: pin the recent decks and going back on long lists end to end; docs: record Recent, the list roles and the reveal"
```
