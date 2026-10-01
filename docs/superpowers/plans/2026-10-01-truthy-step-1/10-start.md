### Task 10: Start flow

The `/` route: the start flow, "filling in the pass". One screen steps through six states: 1 choose an area, 2 a platform, 3 a deck, 4 a section, 5 how to play (the class), 6 "Your pass is ready" with "Start round". Every choice is written onto the fill-in pass at the top; the Back pill, a filled field of the pass, Escape and the browser's back button step back and clear the later choices. A returning player gets one "Continue where you left off" line on step 1 that fills the whole pass at once. "Start round" saves the pending round for `/play` and navigates there after the pass has unrolled to the height of the game ticket.

The visual specification is `design/flow/screens/start.html` (shots `design/flow/shots/start-1.png` to `start-6.png`) and `design/system/DESIGN-SYSTEM.md` sections 4 (start flow zones), 5.3 (destination card), 5.4 (fill-in pass), 5.4a (continue line), 5.6 (Back pill) and 7 (motion). Behaviour comes from the spec, section 9 (screen 1), and sections 5, 7 and 10 for loading, progress and errors.

Every command runs from the repository root. Tasks 1 to 9 are done (`pnpm test`, `pnpm typecheck` and `pnpm build` are green). **Task 10 runs before tasks 11 and 12**: nothing here imports `components/play/*` or `components/BoardingPass.tsx`, and `/play` is still a 404 page when this task ends (the hand-off is checked through `sessionStorage` and the router call).

**How the screen is put together.**
- `app/page.tsx` is a server component that renders `<StartFlow />`. Everything else is client side.
- The outside world comes in through one optional prop, `services` (`StartServices`): the fetcher, the two storages and the browser history. Its shared part, `AppServices`, lives in `src/app-state/services.ts` so that the play screen can use the same seam later. Navigation to `/play` is `useRouter().push` from `next/navigation`; the component tests mock that module, as task 11's tests will.
- `components/start/useCatalog.ts` loads the index with `loadIndex(fetcher, localStorage)` (task 8 falls back to the cached index) and reads the progress with `createLocalStore`. It also holds the small pure questions the flow asks: decks per area, the seen share of a deck, the best for a route, where Continue leads.
- The step and the choices are one `view` state. It is mirrored into the session history as one entry per step on the path (`{ truthyStart: { step, choice } }`, the URL never changes), so the browser's back and forward buttons move through the steps. The in-app Back and the field jumps change the state at once and then call `history.go(-n)` to drop the entries left behind; the popstate that follows matches the state and is ignored. On mount the current entry is overwritten with step 1, so a reload starts at step 1. Entries keep the keys the Next.js router stores in them (`__NA` and its tree): without them Next.js reloads the page on a back step (seen in the spike).
- Layout, measured against the mockup at 390 by 844: the top zone is 176 tall (`--size-start-top-zone`, y 52 to 228) and holds the logo or the Back pill plus the pass; the main area starts 20 below (title row 36 at y 248, first card at y 298); the foot zone is absolute, 60 tall at y 746 to 806 (the place of a game's action row). On step 6 the pass is 358 by 210 at y 120, exactly where task 11's ticket starts; the unroll grows a plain paper under it to y 728, the ticket's bottom.
- Motion (`motion/react`, transforms and opacity only): each zone swaps its content with `AnimatePresence`; the old step rises (forward) or sinks (back) 10 px and fades, the new items rise from 24 px below (or drop from 24 px above) with a 25 ms stagger; the chosen card's name travels into its field of the pass as a scaled copy (300 ms after a 60 ms hold) when it keeps its typeface. Under reduced motion every change is a cross-fade (out 100 ms, in 140 ms after 90 ms), nothing travels and Start round navigates at once.
- Product decisions applied here: the tagline and the ready line are ink (not ink-muted, which fails contrast on the sky); Streak, Three lives and Timed are shown with their descriptions but are not available in step 1 (sunk, "Not available yet", not buttons), like an area without decks; the focus ring is the 2 px ink ring of `app/globals.css`, never amber.
- Focus: going forward focuses the new step's title (an `h2` with `tabIndex={-1}`, no visible ring on purpose); going back focuses the card chosen before (design system section 8). A leaving step is `inert`, so a quick second tap cannot reach it.
- Settle time: the new step's cards appear where the chosen card was, so for 250 ms after a step becomes current (`SWIPE.settleMs`, the play screen's settle time, spec section 8) the options, the continue line and "Start round" ignore presses, by mouse, touch or keyboard; Back, the pass fields and Escape never wait. The clock is `services.now` (`performance.now` in the browser), so the tests move it by hand.
- Continue line: it shows the last round's score ("last 7 of 10", from task 6's `Progress.last`) when that round was finished, and none when it was left.

**Files:**
- Create: `src/app-state/services.ts`, `components/start/useCatalog.ts`, `components/DestinationCard.tsx`, `components/FillInPass.tsx`, `components/start/ContinueLine.tsx`, `components/start/StartFlow.tsx`
- Modify: `app/page.tsx` (task 1's placeholder becomes the start flow), `tests/app/page.test.tsx` (task 1's test of the placeholder, rewritten for the start flow)
- Tests: `tests/app-state/services.test.ts`, `tests/components/start/useCatalog.test.tsx`, `tests/components/DestinationCard.test.tsx`, `tests/components/FillInPass.test.tsx`, `tests/components/start/ContinueLine.test.tsx`, `tests/components/start/StartFlow.test.tsx`, and the shared test doubles `tests/components/start/fixtures.ts` (not a test file itself)
- Temporary, never committed (last step only): `task10-shoot.mjs`, `task10-check.mjs`

**Interfaces:**
- Consumes:
  - Task 1: the `@/*` alias; `app/page.tsx` and `tests/app/page.test.tsx` (both replaced here).
  - Task 3, `@/src/content/schema`: `WHOLE_DECK` (`"ALL"`), types `DeckIndex`, `IndexArea`, `IndexPlatform`, `IndexDeck`, `Route`.
  - Task 5, `@/src/engine/round`: `AVAILABLE_MODES` (`["classic"]`), type `Mode`.
  - Task 6, `@/src/progress/progress`: `recordKey(route, mode): string`, `emptyProgress()`, type `Progress` (`{ version: 1; cards; records; last: { route; mode; score: number | null; total: number | null } | null }`); `@/src/progress/local`: `createLocalStore(storage)`, `browserLocalStorage(): Storage | undefined`, `PROGRESS_KEY`.
  - Task 7, `@/src/input/swipe`: `SWIPE.settleMs` (250).
  - Task 8, `@/src/content/load`: `loadIndex(fetcher: Fetcher, storage?: Pick<Storage, "getItem" | "setItem">): Promise<DeckIndex>` (cached index on failure, `LoadError` without one), `INDEX_CACHE_KEY` (tests), type `Fetcher`; `@/src/app-state/pending`: `savePending(pending: PendingRound, storage?: Pick<Storage, "setItem">): void`, `PENDING_KEY` (tests).
  - Task 9: `SkyBackdrop({ lowerCloud: "start" })`, `Logo({ as: "h1" })`, `LogoMark({ width, variant })`, `PillButton({ children, trailingIcon, onClick })`; icons `BackArrowIcon({ variant: "pill" })`, `ChevronIcon()`, `CloudIcon()`; the screen skeleton (`<main className="flex min-h-0 flex-1 flex-col">` inside `.app-frame`, which is positioned, so an absolute foot zone sits against the frame); the `sr-only` utility; the ink focus ring; the Tailwind forms for token variables (`text-(--color-ink)`, `text-(length:--type-x-size)`, `font-(family-name:--type-x-family)`, ...).
  - Task 2 CSS variables: `--color-` `ink`, `ink-muted`, `rule`, `accent`, `on-accent`, `surface-raised`, `surface-sunk`, `press`; every `--type-*` of the roles `card-name`, `deck-code`, `mono-data`, `list-title`, `field-label`, `field-value`, `field-value-pass`, `carrier-title`, `carrier-label`, `leg-code`, `leg-name`, `pass-line`, `step-title`, `tagline`, `emphasis`, `button-back`, `body`; `--font-mono`, `--font-weight-mono-semibold`; `--space-2/4/6/8/10/12/14/16/18/20/24`; `--size-` `start-top-zone`, `foot-gap`, `ready-offset`, `card-min`, `card-min-deck`, `card-min-section`, `card-min-class`, `card-min-off`, `card-stub`, `card-stub-deck`, `card-notch`, `progress-track`, `carrier`, `carrier-compact`, `pass-line`, `continue-icon`, `pill`, `pill-small`, `gutter`, `safe-bottom`, `ticket-inset`, `statement-min`, `lower`; `--radius-card`, `--radius-small`, `--radius-pill-small`, `--radius-tick`; `--stroke-rule`, `--stroke-perforation`; `--elevation-small`, `--elevation-ticket`; `--duration-t1`, `--easing-ease`.
- Produces (tasks 11 to 13 rely on these):
  - `src/app-state/services.ts`:
    - `type ReadWriteStorage = Pick<Storage, "getItem" | "setItem">`.
    - `interface AppServices { fetcher: Fetcher; localStorage: () => ReadWriteStorage | undefined; sessionStorage: () => ReadWriteStorage | undefined }`, `const browserAppServices: AppServices` (`fetch`, `browserLocalStorage`, `browserSessionStorage`).
    - `browserSessionStorage(): Storage | undefined` (undefined on the server and when blocked).
    - `interface StepHistory { readonly state: unknown; push(state: unknown): void; replace(state: unknown): void; go(delta: number): void; listen(onPop: (state: unknown) => void): () => void }`, `browserStepHistory(): StepHistory | undefined`, `withEntryState(current: unknown, state: unknown): Record<string, unknown>`.
  - `components/start/useCatalog.ts`:
    - `type CatalogStatus = { kind: "loading" } | { kind: "error" } | { kind: "ready"; index: DeckIndex; progress: Progress }`, `interface UseCatalogResult { status: CatalogStatus; retry: () => void }`, `useCatalog(services: AppServices): UseCatalogResult` (`services` must be stable).
    - `deckCount(place: IndexArea | IndexPlatform): number`, `decksLabel(count: number): string` ("1 deck", "3 decks", "No decks yet"), `seenPercent(progress: Progress, deck: Pick<IndexDeck, "id" | "cardCount">): number` (whole percent, 0 only when nothing is seen, capped at 100), `bestFor(progress: Progress, route: Route, mode: Mode): number | null`.
    - `interface RouteInIndex { area: IndexArea; platform: IndexPlatform; deck: IndexDeck; section: IndexDeck["sections"][number] | null }` (null: whole deck), `findRoute(index: DeckIndex, route: Route): RouteInIndex | null`.
    - `interface ContinueTarget { route: Route; mode: Mode; found: RouteInIndex; lastScore: { score: number; total: number } | null }`, `continueTarget(index: DeckIndex, progress: Progress): ContinueTarget | null` (null without `last`, when the route is gone, or when the mode is not in `AVAILABLE_MODES`; `lastScore` is null when `last.score` or `last.total` is null).
  - `components/DestinationCard.tsx` (no hooks, no `"use client"`):
    - `DestinationCard(props: DestinationCardProps)`, `type DestinationVariant = "place" | "deck" | "section" | "class"`, `interface CardStub { label: string; value: string; unit?: string; muted?: boolean }`, `interface DestinationCardProps { variant: DestinationVariant; name: string; code?: boolean; sub?: string; detail?: string; seenPercent?: number; stub?: CardStub; label: string; unavailable?: boolean; onSelect?: () => void; ref?: Ref<HTMLButtonElement>; nameHidden?: boolean }`. A button named `label`, or with `unavailable` a `role="group"` with `aria-disabled="true"` named `label`. DOM hooks: `[data-card-name]`, `[data-status]`, `[data-seen]`, `[data-unavailable]`.
    - `ProgressTrack(props: { percent: number })`: the 56 by 8 track, decorative.
  - `components/FillInPass.tsx` (`"use client"`):
    - `FillInPass(props: FillInPassProps)`, `type PassStage = "destination" | "route" | "ready"`, `type PassFieldName = "area" | "platform" | "deck" | "section" | "mode"`, `interface FillInPassValues { area?: string; platform?: string; deck?: { code: string; name: string }; section?: { code: string; name: string; whole: boolean }; mode?: string; cards?: number }`, `interface FillInPassProps { stage: PassStage; values: FillInPassValues; now?: PassFieldName; sectionChoosable?: boolean; onJump: (field: PassFieldName) => void; travelling?: PassFieldName; unroll?: boolean; onUnrolled?: () => void; className?: string }`.
    - `changeLabel(field: PassFieldName, value: string): string` ("Change deck, now CLF"; `mode` reads "class").
    - DOM hooks: `[data-fill-in-pass="<stage>"]`, `[data-field="<name>"]` (with `data-now` on the field being chosen), `[data-pass-value="<name>"]`, `[data-leg="deck" | "section"]`, `[data-unroll]`.
  - `components/start/ContinueLine.tsx`: `ContinueLine(props: ContinueLineProps)`, `interface ContinueLineProps { deckCode: string; deckTitle: string; sectionCode: string; sectionTitle: string; modeLabel: string; lastScore?: { score: number; total: number }; onContinue: () => void; ref?: Ref<HTMLButtonElement> }`, `continueLabel(props): string` ("Continue: Cloud Practitioner, Security and compliance, Classic." plus " Last score 7 of 10." when known).
  - `components/start/StartFlow.tsx` (`"use client"`):
    - `StartFlow(props: StartFlowProps)`, `interface StartFlowProps { services?: StartServices }` (default `browserStartServices`; pass a stable object), `interface StartServices extends AppServices { history: () => StepHistory | undefined; now: () => number }`, `const browserStartServices: StartServices` (`now` is `performance.now`). For 250 ms (`SWIPE.settleMs`) after a step change, presses on the options, the continue line and "Start round" are ignored; the first render starts no settle time.
    - `type Step = 1 | 2 | 3 | 4 | 5 | 6`, `interface Choice { areaId?: string; platformId?: string; deckId?: string; sectionId?: string; mode?: Mode }`, `STEP_OF: Record<keyof Choice, Step>`, `clearFrom(choice: Choice, step: Step): Choice`, `pathTo(step: Step, hasSections: boolean): Step[]`, `previousStep(step: Step, hasSections: boolean): Step`, `canShow(index: DeckIndex, step: Step, choice: Choice): boolean`.
    - `interface ModeOption { id: Mode; name: string; description: string; unit: string }`, `MODE_OPTIONS: readonly ModeOption[]` (Classic "10 cards, score at the end." "of 10"; Streak "Keep going until the first wrong answer." "in a row"; Three lives "The round ends on the third wrong answer." "cards"; Timed "60 seconds, as many cards as you can." "correct").
    - Accessible landmarks for task 13: `h1` "Truthy" on step 1; the step title is the `h2` of `[data-step]:not([inert])` ("Choose an area", "Choose a platform", "Choose a deck", "Choose a section", "Choose how to play", "Your pass is ready"); option buttons named "Cloud, 2 decks", "AWS, 1 deck", "CLF, Cloud Practitioner, 214 cards, not started" (or "..., 38 percent seen"), "Whole deck, all 4 sections, 214 cards", "SEC, Security and compliance, 47 cards", "Classic. 10 cards, score at the end. Not played yet." (or "Your best: 9 of 10."); groups "DevOps, no decks yet", "Streak, not available yet"; the Back pill named after the step it returns to ("Back to areas", "Back to platforms", "Back to decks", "Back to sections", "Back to classes"; on step 6 it is "Back to classes"), buttons "Change deck, now CLF", "Start round", "Continue: ..." (ending "Last score 7 of 10." after a finished round), "Try again"; options wrapped in `[data-option="<id>"]`.
  - `app/page.tsx`: default export `Home()`, a server component rendering `<StartFlow />`. Route `/`, prerendered static.
  - `tests/components/start/fixtures.ts`: `INDEX` (Cloud: AWS with CLF 92 cards in CON 45 and SEC 47, Google Cloud with CDL 133 and no sections, Azure without decks; Frontend: Next.js with RND; DevOps without platforms), `memoryStorage(initial?)`, `storedProgress(partial)`, `fakeNetwork(index?)`, `memoryHistory()` (with `back()`, `forward()`, `entries`, `position`), `harness(local?, index?)` returning `{ services, network, local, session, history, clock }` (`clock.time` is what `services.now()` returns, 0 until a test moves it), types `TestServices`, `Harness`, `MemoryStorage`, `MemoryHistory`, `ManualClock`.

- [ ] **Step 1: Write the failing tests for the services seam**

Create `tests/app-state/services.test.ts`. It pins the one trap found in the spike: the Next.js router stores its own keys in every history entry and reloads the page when the browser steps back to an entry without them, so our entries must keep them.

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserAppServices, browserSessionStorage, browserStepHistory, withEntryState } from "@/src/app-state/services";

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "");
});

describe("withEntryState", () => {
  it("keeps the keys the router stored in the entry and adds ours", () => {
    const routerState = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: 1 } };
    expect(withEntryState(routerState, { truthyStart: { step: 2 } })).toEqual({ ...routerState, truthyStart: { step: 2 } });
  });

  it("replaces our own key and copes with an entry without state", () => {
    expect(withEntryState({ truthyStart: { step: 2 } }, { truthyStart: { step: 3 } })).toEqual({ truthyStart: { step: 3 } });
    expect(withEntryState(null, { truthyStart: { step: 1 } })).toEqual({ truthyStart: { step: 1 } });
  });
});

describe("browserStepHistory", () => {
  it("pushes and replaces entries without changing the URL, keeping the router's keys", () => {
    const history = browserStepHistory();
    if (!history) throw new Error("no history in jsdom");
    const url = window.location.href;
    window.history.replaceState({ __NA: true }, "");
    history.push({ truthyStart: { step: 2 } });
    expect(window.history.state).toEqual({ __NA: true, truthyStart: { step: 2 } });
    history.replace({ truthyStart: { step: 3 } });
    expect(history.state).toEqual({ __NA: true, truthyStart: { step: 3 } });
    expect(window.location.href).toBe(url);
  });

  it("tells a listener the state of the entry the browser moved to, until it unsubscribes", () => {
    const history = browserStepHistory();
    if (!history) throw new Error("no history in jsdom");
    const heard: unknown[] = [];
    const stop = history.listen((state) => heard.push(state));
    window.dispatchEvent(new PopStateEvent("popstate", { state: { truthyStart: { step: 1 } } }));
    stop();
    window.dispatchEvent(new PopStateEvent("popstate", { state: { truthyStart: { step: 2 } } }));
    expect(heard).toEqual([{ truthyStart: { step: 1 } }]);
  });
});

describe("browser storages", () => {
  it("gives sessionStorage, or undefined when the browser blocks it", () => {
    expect(browserSessionStorage()).toBe(window.sessionStorage);
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(browserSessionStorage()).toBeUndefined();
  });

  it("wires the real services to fetch and the two storages", () => {
    expect(browserAppServices.localStorage()).toBe(window.localStorage);
    expect(browserAppServices.sessionStorage()).toBe(window.sessionStorage);
  });
});
```

- [ ] **Step 2: Run the services tests and watch them fail**

```bash
pnpm vitest run tests/app-state/services.test.ts
```

Expected: `Error: Failed to resolve import "@/src/app-state/services" from "tests/app-state/services.test.ts". Does the file exist?` and `Test Files  1 failed (1)`.

- [ ] **Step 3: Create the services seam**

Create `src/app-state/services.ts`:

```ts
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
```

- [ ] **Step 4: Run the services tests and watch them pass**

```bash
pnpm vitest run tests/app-state/services.test.ts
```

Expected: `Tests  6 passed (6)`.

- [ ] **Step 5: Commit**

```bash
git add src/app-state/services.ts tests/app-state/services.test.ts
git commit -m "feat: add the app services seam and a step history that keeps the router's state"
```

- [ ] **Step 6: Write the test doubles and the failing tests for the catalog**

Create `tests/components/start/fixtures.ts` (shared by the start-flow tests and the home page test; it imports nothing from the flow, so it works before the flow exists):

```ts
// Test doubles for the start flow: a small deck index, storage in memory, a fake network and a session
// history in memory. Everything goes in through StartFlow's `services` prop.
import type { AppServices, StepHistory } from "@/src/app-state/services";
import type { DeckIndex } from "@/src/content/schema";
import { PROGRESS_KEY } from "@/src/progress/local";
import { emptyProgress, type Progress } from "@/src/progress/progress";

// Cloud: AWS (CLF with two sections), Google Cloud (CDL, no sections), Azure (no decks).
// Frontend: Next.js (RND). DevOps: no platforms at all.
export const INDEX: DeckIndex = {
  areas: [
    {
      id: "cloud",
      title: "Cloud",
      platforms: [
        {
          id: "aws",
          title: "AWS",
          decks: [
            {
              id: "aws-clf-c02",
              code: "CLF",
              title: "Cloud Practitioner",
              cardCount: 92,
              version: "2026-10-01",
              hash: "clf-1",
              sections: [
                { id: "CON", title: "Cloud concepts", cardCount: 45 },
                { id: "SEC", title: "Security and compliance", cardCount: 47 },
              ],
            },
          ],
        },
        {
          id: "gcp",
          title: "Google Cloud",
          decks: [{ id: "gcp-cdl", code: "CDL", title: "Cloud Digital Leader", cardCount: 133, version: "2026-10-01", hash: "cdl-1", sections: [] }],
        },
        { id: "azure", title: "Azure", decks: [] },
      ],
    },
    {
      id: "frontend",
      title: "Frontend",
      platforms: [
        {
          id: "nextjs",
          title: "Next.js",
          decks: [
            {
              id: "nextjs-rendering",
              code: "RND",
              title: "Rendering",
              cardCount: 12,
              version: "2026-10-01",
              hash: "rnd-1",
              sections: [{ id: "RSC", title: "Server and client components", cardCount: 12 }],
            },
          ],
        },
      ],
    },
    { id: "devops", title: "DevOps", platforms: [] },
  ],
};

export interface MemoryStorage extends Pick<Storage, "getItem" | "setItem"> {
  data: Map<string, string>;
}

export function memoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

/** Local storage holding this progress. */
export function storedProgress(progress: Partial<Progress>): MemoryStorage {
  return memoryStorage({ [PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), ...progress }) });
}

export interface FakeNetwork {
  fetcher: AppServices["fetcher"];
  calls: string[];
  /** When false every request fails, as offline. */
  online: boolean;
  /** When set, requests wait for release() before they answer. */
  hold: boolean;
  release: () => void;
}

export function fakeNetwork(index: unknown = INDEX): FakeNetwork {
  let waiting: (() => void)[] = [];
  const network: FakeNetwork = {
    calls: [],
    online: true,
    hold: false,
    release: () => {
      const queued = waiting;
      waiting = [];
      for (const go of queued) go();
    },
    fetcher: async (url) => {
      network.calls.push(url);
      if (network.hold) await new Promise<void>((resolve) => waiting.push(resolve));
      if (!network.online) throw new Error("offline");
      if (url !== "/decks/index.json") return { ok: false, json: async () => null };
      return { ok: true, json: async () => structuredClone(index) };
    },
  };
  return network;
}

/** A session history in memory. `back()` and `forward()` are the browser's buttons. */
export interface MemoryHistory extends StepHistory {
  entries: unknown[];
  position: number;
  back: () => void;
  forward: () => void;
}

export function memoryHistory(): MemoryHistory {
  const listeners = new Set<(state: unknown) => void>();
  const history: MemoryHistory = {
    entries: [null],
    position: 0,
    get state() {
      return history.entries[history.position];
    },
    push(state) {
      history.entries = [...history.entries.slice(0, history.position + 1), state];
      history.position += 1;
    },
    replace(state) {
      history.entries[history.position] = state;
    },
    go(delta) {
      const next = Math.min(Math.max(history.position + delta, 0), history.entries.length - 1);
      if (next === history.position) return;
      history.position = next;
      const state = history.entries[next];
      // Browsers report the move later, as a popstate event.
      queueMicrotask(() => {
        for (const listener of listeners) listener(state);
      });
    },
    listen(onPop) {
      listeners.add(onPop);
      return () => listeners.delete(onPop);
    },
    back: () => history.go(-1),
    forward: () => history.go(1),
  };
  return history;
}

/** What StartFlow takes as `services` (StartServices), written out so this file does not import the flow. */
export interface TestServices extends AppServices {
  history: () => StepHistory | undefined;
}

export interface Harness {
  services: TestServices;
  network: FakeNetwork;
  local: MemoryStorage;
  session: MemoryStorage;
  history: MemoryHistory;
}

export function harness(local: MemoryStorage = memoryStorage(), index: unknown = INDEX): Harness {
  const network = fakeNetwork(index);
  const session = memoryStorage();
  const history = memoryHistory();
  const services: TestServices = {
    fetcher: network.fetcher,
    localStorage: () => local,
    sessionStorage: () => session,
    history: () => history,
  };
  return { services, network, local, session, history };
}
```

Create `tests/components/start/useCatalog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  bestFor,
  continueTarget,
  deckCount,
  decksLabel,
  findRoute,
  seenPercent,
  useCatalog,
} from "@/components/start/useCatalog";
import { INDEX_CACHE_KEY } from "@/src/content/load";
import { emptyProgress, type Progress } from "@/src/progress/progress";
import { INDEX, harness, memoryStorage, storedProgress } from "./fixtures";

afterEach(cleanup);

function area(id: string) {
  const found = INDEX.areas.find((a) => a.id === id);
  if (!found) throw new Error(id);
  return found;
}

function progressWith(partial: Partial<Progress>): Progress {
  return { ...emptyProgress(), ...partial };
}

const seen = { seen: 1, lastCorrect: true, lastSeenAt: 1 };

describe("deckCount and decksLabel", () => {
  it("counts the decks of every platform of an area, or of one platform", () => {
    expect(deckCount(area("cloud"))).toBe(2);
    expect(deckCount(area("devops"))).toBe(0);
    expect(deckCount(area("cloud").platforms[2]!)).toBe(0);
  });

  it("says how many decks there are, or that there are none yet", () => {
    expect(decksLabel(1)).toBe("1 deck");
    expect(decksLabel(3)).toBe("3 decks");
    expect(decksLabel(0)).toBe("No decks yet");
  });
});

describe("seenPercent", () => {
  const deck = { id: "aws-clf-c02", cardCount: 92 };

  it("is 0 (not started) without history for the deck", () => {
    expect(seenPercent(progressWith({ cards: { "gcp-cdl-01": seen } }), deck)).toBe(0);
  });

  it("counts history entries whose id starts with the deck id and a dash", () => {
    const cards = Object.fromEntries(Array.from({ length: 46 }, (_, i) => [`aws-clf-c02-t1-${i}`, seen]));
    expect(seenPercent(progressWith({ cards: { ...cards, "aws-clf-c02x-1": seen } }), deck)).toBe(50);
  });

  it("never reads 0 once a card is seen, and never more than 100", () => {
    expect(seenPercent(progressWith({ cards: { "aws-clf-c02-1": seen } }), { id: "aws-clf-c02", cardCount: 500 })).toBe(1);
    const many = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`aws-clf-c02-${i}`, seen]));
    expect(seenPercent(progressWith({ cards: many }), { id: "aws-clf-c02", cardCount: 3 })).toBe(100);
  });
});

describe("bestFor", () => {
  it("reads the record of a route and mode, or null when there is none", () => {
    const progress = progressWith({ records: { "aws-clf-c02/SEC#classic": 9 } });
    expect(bestFor(progress, { deckId: "aws-clf-c02", sectionId: "SEC" }, "classic")).toBe(9);
    expect(bestFor(progress, { deckId: "aws-clf-c02", sectionId: "ALL" }, "classic")).toBeNull();
  });
});

describe("findRoute and continueTarget", () => {
  it("finds a section route and a whole-deck route", () => {
    expect(findRoute(INDEX, { deckId: "aws-clf-c02", sectionId: "SEC" })?.section?.title).toBe("Security and compliance");
    const whole = findRoute(INDEX, { deckId: "gcp-cdl", sectionId: "ALL" });
    expect(whole?.platform.title).toBe("Google Cloud");
    expect(whole?.section).toBeNull();
  });

  it("finds nothing when the deck or the section is gone", () => {
    expect(findRoute(INDEX, { deckId: "aws-saa-c03", sectionId: "ALL" })).toBeNull();
    expect(findRoute(INDEX, { deckId: "aws-clf-c02", sectionId: "OLD" })).toBeNull();
  });

  it("leads Continue to the last route and mode, only while both can be played", () => {
    const last = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" as const, score: 7, total: 10 };
    expect(continueTarget(INDEX, progressWith({ last }))?.found.deck.code).toBe("CLF");
    expect(continueTarget(INDEX, emptyProgress())).toBeNull();
    expect(continueTarget(INDEX, progressWith({ last: { ...last, route: { deckId: "aws-clf-c02", sectionId: "OLD" } } }))).toBeNull();
    expect(continueTarget(INDEX, progressWith({ last: { ...last, mode: "streak" } }))).toBeNull();
  });
});

describe("useCatalog", () => {
  it("loads the index and the progress on the device", async () => {
    const h = harness(storedProgress({ records: { "gcp-cdl/ALL#classic": 7 } }));
    const { result } = renderHook(() => useCatalog(h.services));
    expect(result.current.status.kind).toBe("loading");
    await waitFor(() => expect(result.current.status.kind).toBe("ready"));
    const status = result.current.status;
    if (status.kind !== "ready") throw new Error("not ready");
    expect(status.index.areas.map((a) => a.title)).toEqual(["Cloud", "Frontend", "DevOps"]);
    expect(status.progress.records).toEqual({ "gcp-cdl/ALL#classic": 7 });
    expect(h.network.calls).toEqual(["/decks/index.json"]);
  });

  it("uses the cached index when the network fails", async () => {
    const h = harness(memoryStorage({ [INDEX_CACHE_KEY]: JSON.stringify(INDEX) }));
    h.network.online = false;
    const { result } = renderHook(() => useCatalog(h.services));
    await waitFor(() => expect(result.current.status.kind).toBe("ready"));
  });

  it("fails without a cached index, and loads again on retry", async () => {
    const h = harness();
    h.network.online = false;
    const { result } = renderHook(() => useCatalog(h.services));
    await waitFor(() => expect(result.current.status.kind).toBe("error"));
    h.network.online = true;
    act(() => result.current.retry());
    expect(result.current.status.kind).toBe("loading");
    await waitFor(() => expect(result.current.status.kind).toBe("ready"));
    expect(h.network.calls).toHaveLength(2);
  });

  it("runs with empty progress when storage is blocked", async () => {
    const h = harness();
    const services = { ...h.services, localStorage: () => undefined };
    const { result } = renderHook(() => useCatalog(services));
    await waitFor(() => expect(result.current.status.kind).toBe("ready"));
    const status = result.current.status;
    expect(status.kind === "ready" && status.progress).toEqual(emptyProgress());
  });
});
```

- [ ] **Step 7: Run the catalog tests and watch them fail**

```bash
pnpm vitest run tests/components/start/useCatalog.test.tsx
```

Expected: `Error: Failed to resolve import "@/components/start/useCatalog" from "tests/components/start/useCatalog.test.tsx". Does the file exist?`.

- [ ] **Step 8: Create the catalog hook and its helpers**

Create `components/start/useCatalog.ts`:

```ts
// What the start flow shows, loaded on the device: the deck index (spec section 5, "Loading") and the
// player's progress (section 7). Also the small pure questions the flow asks of them: how many decks an
// area has, how much of a deck has been seen, the best for a route, and where "Continue" leads.
import { useCallback, useEffect, useState } from "react";
import type { AppServices } from "@/src/app-state/services";
import { loadIndex } from "@/src/content/load";
import { WHOLE_DECK, type DeckIndex, type IndexArea, type IndexDeck, type IndexPlatform, type Route } from "@/src/content/schema";
import { AVAILABLE_MODES, type Mode } from "@/src/engine/round";
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
}

export function continueTarget(index: DeckIndex, progress: Progress): ContinueTarget | null {
  const last = progress.last;
  if (last === null || !AVAILABLE_MODES.includes(last.mode)) return null;
  const found = findRoute(index, last.route);
  return found ? { route: last.route, mode: last.mode, found } : null;
}
```

- [ ] **Step 9: Run the catalog tests and watch them pass**

```bash
pnpm vitest run tests/components/start/useCatalog.test.tsx
```

Expected: `Tests  13 passed (13)`.

- [ ] **Step 10: Commit**

```bash
git add components/start/useCatalog.ts tests/components/start/useCatalog.test.tsx tests/components/start/fixtures.ts
git commit -m "feat: load the deck index and progress for the start flow"
```

- [ ] **Step 11: Write the failing tests for the destination card**

Create `tests/components/DestinationCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DestinationCard, ProgressTrack } from "@/components/DestinationCard";

afterEach(cleanup);

describe("DestinationCard", () => {
  it("is a button named by its full label, showing the name and the sub-line", () => {
    const onSelect = vi.fn();
    render(<DestinationCard variant="place" name="Cloud" sub="2 decks" label="Cloud, 2 decks" onSelect={onSelect} />);
    const button = screen.getByRole("button", { name: "Cloud, 2 decks" });
    expect(button.textContent).toBe("Cloud2 decks");
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("draws a place card 104 tall with a 64 stub holding only the chevron", () => {
    render(<DestinationCard variant="place" name="AWS" sub="1 deck" label="AWS, 1 deck" />);
    const button = screen.getByRole("button", { name: "AWS, 1 deck" });
    expect(button.className).toContain("min-h-(--size-card-min)");
    expect(button.style.gridTemplateColumns).toBe("minmax(0, 1fr) var(--size-card-stub)");
    expect(button.querySelectorAll("svg")).toHaveLength(1);
  });

  it("shows a deck's code, title, progress and card count", () => {
    render(
      <DestinationCard
        variant="deck"
        name="CLF"
        code
        detail="Cloud Practitioner"
        seenPercent={38}
        stub={{ label: "Cards", value: "214" }}
        label="CLF, Cloud Practitioner, 214 cards, 38 percent seen"
      />,
    );
    const button = screen.getByRole("button", { name: "CLF, Cloud Practitioner, 214 cards, 38 percent seen" });
    expect(button.className).toContain("min-h-(--size-card-min-deck)");
    expect(button.querySelector("[data-status]")?.textContent).toBe("38% seen");
    expect(button.querySelector<HTMLElement>("[data-seen]")?.style.width).toBe("38%");
    expect(button.textContent).toContain("Cards214");
  });

  it("says Not started and draws only the dashed track when nothing is seen", () => {
    render(<DestinationCard variant="deck" name="CDL" code detail="Cloud Digital Leader" seenPercent={0} stub={{ label: "Cards", value: "133" }} label="CDL" />);
    expect(screen.getByRole("button", { name: "CDL" }).querySelector("[data-status]")?.textContent).toBe("Not started");
    expect(document.querySelector("[data-seen]")).toBeNull();
  });

  it("shows a class's best with its unit, and no chevron", () => {
    render(
      <DestinationCard
        variant="class"
        name="Classic"
        detail="10 cards, score at the end."
        stub={{ label: "Best", value: "9", unit: "of 10" }}
        label="Classic. 10 cards, score at the end. Your best: 9 of 10."
      />,
    );
    const button = screen.getByRole("button", { name: "Classic. 10 cards, score at the end. Your best: 9 of 10." });
    expect(button.textContent).toBe("Classic10 cards, score at the end.Best9of 10");
    expect(button.querySelectorAll("svg")).toHaveLength(0);
  });

  it("is not a button when its option is not available: a labelled, disabled group", () => {
    const onSelect = vi.fn();
    render(<DestinationCard variant="place" name="DevOps" sub="No decks yet" label="DevOps, no decks yet" unavailable onSelect={onSelect} />);
    expect(screen.queryByRole("button")).toBeNull();
    const group = screen.getByRole("group", { name: "DevOps, no decks yet" });
    expect(group.getAttribute("aria-disabled")).toBe("true");
    expect(group.textContent).toBe("DevOpsNo decks yet");
    fireEvent.click(group);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("can hide its name while a copy of it travels into the pass", () => {
    render(<DestinationCard variant="place" name="Cloud" sub="2 decks" label="Cloud" nameHidden />);
    expect(document.querySelector<HTMLElement>("[data-card-name]")?.style.visibility).toBe("hidden");
  });
});

describe("ProgressTrack", () => {
  it("is decorative", () => {
    const { container } = render(<ProgressTrack percent={12} />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});
```

- [ ] **Step 12: Run the destination card tests and watch them fail**

```bash
pnpm vitest run tests/components/DestinationCard.test.tsx
```

Expected: `Error: Failed to resolve import "@/components/DestinationCard" from "tests/components/DestinationCard.test.tsx". Does the file exist?`.

- [ ] **Step 13: Create the destination card**

Create `components/DestinationCard.tsx`. The notches are two radial gradients, like task 9's sky and task 11's ticket; the 12 px sub-line uses the `mono-data` role (the design system chose 12 over browse-c's 12.5).

```tsx
// The destination card of the start flow (design system 5.3): one large, calm choice per row. A ticket
// with a stub on the right, notches of radius 7 on the stub line and a dashed perforation between them.
// Variants: "place" (an area or a platform), "deck", "section" and "class". A card whose option has no
// content is "not available": a sunk, labelled group without a stub, which is not a button.
import type { CSSProperties, Ref } from "react";
import { ChevronIcon } from "./icons";

export type DestinationVariant = "place" | "deck" | "section" | "class";

/** What the stub of a deck, section or class card shows: "Cards / 214" or "Best / 9 / of 10". */
export interface CardStub {
  label: string;
  value: string;
  /** A third line in the label style, for example "of 10" or "not played". */
  unit?: string;
  /** Draws the value in ink-muted (the "–" of a class that has not been played). */
  muted?: boolean;
}

export interface DestinationCardProps {
  variant: DestinationVariant;
  /** The big name: an area or platform title, a deck or section code, "Whole deck", a class name. */
  name: string;
  /** Draws the name as a code (Mono 600 30) instead of the card-name role. */
  code?: boolean;
  /** Place cards: the mono line under the name ("3 decks"). Unavailable cards: the reason ("No decks yet"). */
  sub?: string;
  /** Deck, section and class cards: the line under the name ("Cloud Practitioner", "10 cards, score at the end."). */
  detail?: string;
  /** Deck cards: the share of the deck seen, in whole percent. 0 reads "Not started". */
  seenPercent?: number;
  /** Deck, section and class cards: the stub values. Place cards show only the chevron. */
  stub?: CardStub;
  /** The accessible name, a full sentence of what the card holds ("CLF, Cloud Practitioner, 214 cards, not started"). */
  label: string;
  /** When true the option cannot be chosen: no button, no stub, sunk paper, and `sub` says why. */
  unavailable?: boolean;
  onSelect?: () => void;
  ref?: Ref<HTMLButtonElement>;
  /** Hides the name while a copy of it travels into the pass. */
  nameHidden?: boolean;
}

const STUB_WIDTH: Record<DestinationVariant, string> = {
  place: "var(--size-card-stub)",
  deck: "var(--size-card-stub-deck)",
  section: "var(--size-card-stub-deck)",
  class: "var(--size-card-stub-deck)",
};

const MIN_HEIGHT: Record<DestinationVariant, string> = {
  place: "min-h-(--size-card-min)",
  deck: "min-h-(--size-card-min-deck)",
  section: "min-h-(--size-card-min-section)",
  class: "min-h-(--size-card-min-class)",
};

const MAIN_PADDING: Record<DestinationVariant, string> = {
  place: "gap-(--space-4) py-(--space-18)",
  deck: "gap-(--space-2) py-(--space-18)",
  section: "gap-(--space-2) py-(--space-14)",
  class: "gap-(--space-4) py-(--space-16)",
};

/** Paper with a half circle of radius 7 cut into the top and bottom edges on the stub line. */
function notchedCard(stubWidth: string): CSSProperties {
  const cut = (edge: "0" | "100%") =>
    `radial-gradient(circle at calc(100% - ${stubWidth}) ${edge}, transparent var(--size-card-notch), ` +
    `var(--color-surface-raised) calc(var(--size-card-notch) + 0.5px))`;
  return { background: `${cut("0")} top / 100% 51% no-repeat, ${cut("100%")} bottom / 100% 51% no-repeat` };
}

const PERFORATION: CSSProperties = {
  background: "repeating-linear-gradient(180deg, var(--color-rule) 0 5px, transparent 5px 10px)",
};

const NAME =
  "self-start whitespace-nowrap font-(family-name:--type-card-name-family) text-(length:--type-card-name-size) " +
  "font-(--type-card-name-weight) leading-(--type-card-name-line-height) tracking-(--type-card-name-letter-spacing)";
const CODE =
  "self-start whitespace-nowrap font-(family-name:--type-deck-code-family) text-(length:--type-deck-code-size) " +
  "font-(--type-deck-code-weight) leading-(--type-deck-code-line-height) tracking-(--type-deck-code-letter-spacing)";
const SUB =
  "font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) font-(--type-mono-data-weight) " +
  "leading-(--type-mono-data-line-height) text-(--color-ink-muted)";
const DETAIL =
  "font-(family-name:--type-list-title-family) text-(length:--type-list-title-size) font-(--type-list-title-weight) " +
  "leading-[1.25] tracking-(--type-list-title-letter-spacing)";
const STUB_LABEL =
  "font-(family-name:--type-field-label-family) text-(length:--type-field-label-size) font-(--type-field-label-weight) " +
  "leading-(--type-field-label-line-height) tracking-(--type-field-label-letter-spacing) text-(--color-ink-muted)";
const STUB_VALUE = "font-(family-name:--font-mono) text-[16px] font-(--font-weight-mono-semibold) leading-[1.27]";

/** The 56 by 8 progress track: dashed for the part not seen, a solid ink line with an amber dot for the part seen. */
export function ProgressTrack({ percent }: { percent: number }) {
  return (
    <span aria-hidden="true" data-track="" className="relative block h-(--space-8) w-(--size-progress-track) flex-none">
      <span
        className="absolute inset-x-0 top-[3px] h-(--stroke-perforation)"
        style={{ background: "repeating-linear-gradient(90deg, var(--color-rule) 0 4px, transparent 4px 8px)" }}
      />
      {percent > 0 ? (
        <span
          data-seen=""
          className="absolute top-[3px] left-0 h-(--stroke-perforation) rounded-[1px] bg-(--color-ink)"
          style={{ width: `${percent}%` }}
        >
          <span className="absolute -top-[3px] -right-[4px] size-(--space-8) rounded-full bg-(--color-accent) shadow-[0_0_0_1.5px_var(--color-ink)]" />
        </span>
      ) : null}
    </span>
  );
}

export function DestinationCard(props: DestinationCardProps) {
  const { variant, name, code = false, sub, detail, seenPercent, stub, label, unavailable = false, onSelect, ref, nameHidden = false } = props;
  const nameClass = code ? CODE : NAME;

  if (unavailable) {
    return (
      <div
        role="group"
        aria-label={label}
        aria-disabled="true"
        data-unavailable=""
        className="flex min-h-(--size-card-min-off) w-full flex-col justify-center gap-(--space-4) rounded-(--radius-card) bg-(--color-surface-sunk) py-(--space-18) pr-(--space-12) pl-(--space-20) text-(--color-ink-muted)"
      >
        <span aria-hidden="true" className={nameClass}>
          {name}
        </span>
        {detail ? (
          <span aria-hidden="true" className={DETAIL}>
            {detail}
          </span>
        ) : null}
        {sub ? (
          <span aria-hidden="true" className={SUB}>
            {sub}
          </span>
        ) : null}
      </div>
    );
  }

  const stubWidth = STUB_WIDTH[variant];
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      onClick={onSelect}
      data-variant={variant}
      className={[
        "relative grid w-full cursor-pointer text-left text-(--color-ink) rounded-(--radius-card) shadow-(--elevation-small)",
        "transition-transform duration-(--duration-t1) ease-(--easing-ease) active:scale-[0.98]",
        MIN_HEIGHT[variant],
      ].join(" ")}
      style={{ ...notchedCard(stubWidth), gridTemplateColumns: `minmax(0, 1fr) ${stubWidth}` }}
    >
      <span aria-hidden="true" className={`flex min-w-0 flex-col justify-center pr-(--space-12) pl-(--space-20) ${MAIN_PADDING[variant]}`}>
        <span data-card-name="" className={nameClass} style={nameHidden ? { visibility: "hidden" } : undefined}>
          {name}
        </span>
        {sub ? <span className={SUB}>{sub}</span> : null}
        {detail ? (
          <span className={`${DETAIL} ${variant === "class" ? "text-(--color-ink-muted)" : ""}`}>{detail}</span>
        ) : null}
        {seenPercent === undefined ? null : (
          <span data-status="" className={`mt-(--space-10) flex items-center gap-(--space-10) ${SUB}`}>
            <ProgressTrack percent={seenPercent} />
            {seenPercent > 0 ? (
              <span>
                <b className="font-(--font-weight-mono-semibold) text-(--color-ink)">{seenPercent}%</b> seen
              </span>
            ) : (
              <span>Not started</span>
            )}
          </span>
        )}
      </span>
      <span aria-hidden="true" className="relative flex flex-col items-center justify-center gap-(--space-2)">
        <span className="absolute top-(--space-12) bottom-(--space-12) left-[-0.75px] w-(--stroke-rule)" style={PERFORATION} />
        {stub ? (
          <>
            <span className={STUB_LABEL}>{stub.label}</span>
            <span className={`${STUB_VALUE} ${stub.muted ? "text-(--color-ink-muted)" : ""}`}>{stub.value}</span>
            {stub.unit ? <span className={STUB_LABEL}>{stub.unit}</span> : null}
          </>
        ) : null}
        {variant === "class" ? null : (
          <span className={stub ? "mt-(--space-8) flex" : "flex"}>
            <ChevronIcon />
          </span>
        )}
      </span>
    </button>
  );
}
```

- [ ] **Step 14: Run the destination card tests and watch them pass**

```bash
pnpm vitest run tests/components/DestinationCard.test.tsx tests/components/no-raw-colours.test.ts
```

Expected: `Tests  9 passed (9)` (8 card tests and task 9's raw-colour guard, which now also reads the new file).

- [ ] **Step 15: Commit**

```bash
git add components/DestinationCard.tsx tests/components/DestinationCard.test.tsx
git commit -m "feat: add the destination card for areas, platforms, decks, sections and classes"
```

- [ ] **Step 16: Write the failing tests for the fill-in pass**

Create `tests/components/FillInPass.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FillInPass, changeLabel, type FillInPassValues } from "@/components/FillInPass";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

const FULL: FillInPassValues = {
  area: "Cloud",
  platform: "AWS",
  deck: { code: "CLF", name: "AWS Cloud Practitioner" },
  section: { code: "SEC", name: "Security and compliance", whole: false },
  mode: "Classic",
  cards: 47,
};

function field(name: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-field="${name}"]`);
  if (!element) throw new Error(`no field ${name}`);
  return element;
}

describe("changeLabel", () => {
  it("names what a filled field changes", () => {
    expect(changeLabel("deck", "CLF")).toBe("Change deck, now CLF");
    expect(changeLabel("mode", "Classic")).toBe("Change class, now Classic");
  });
});

describe("FillInPass: choosing the destination", () => {
  it("shows Area, Platform and Deck under the compact YOUR PASS band, blanks saying not chosen", () => {
    render(<FillInPass stage="destination" values={{ area: "Cloud" }} now="platform" onJump={() => {}} />);
    expect(document.querySelector("[data-fill-in-pass]")?.textContent).toContain("YOUR PASS");
    expect(field("area").textContent).toBe("AreaCloud");
    expect(field("platform").textContent).toBe("Platformnot chosen");
    expect(field("deck").textContent).toBe("Decknot chosen");
  });

  it("marks the field being chosen now in ink, not only by colour: its label also turns semibold", () => {
    render(<FillInPass stage="destination" values={{ area: "Cloud" }} now="platform" onJump={() => {}} />);
    expect(field("platform").hasAttribute("data-now")).toBe(true);
    expect(field("platform").querySelector("dt")?.className).toContain("font-(--font-weight-mono-semibold)");
    expect(field("deck").hasAttribute("data-now")).toBe(false);
  });

  it("makes each filled field a way back to its step", () => {
    const onJump = vi.fn();
    render(<FillInPass stage="destination" values={{ area: "Cloud", platform: "AWS" }} now="deck" onJump={onJump} />);
    fireEvent.click(screen.getByRole("button", { name: "Change platform, now AWS" }));
    expect(onJump).toHaveBeenCalledWith("platform");
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("announces changes politely", () => {
    render(<FillInPass stage="destination" values={{}} now="platform" onJump={() => {}} />);
    expect(document.querySelector("[aria-live='polite']")).not.toBeNull();
  });
});

describe("FillInPass: choosing the route", () => {
  it("folds area and platform into one quiet line over Deck, Section and Class", () => {
    const onJump = vi.fn();
    render(<FillInPass stage="route" values={{ area: "Cloud", platform: "AWS", deck: FULL.deck }} now="section" onJump={onJump} />);
    fireEvent.click(screen.getByRole("button", { name: "Change area, now Cloud" }));
    expect(onJump).toHaveBeenCalledWith("area");
    expect(screen.getByRole("button", { name: "Change platform, now AWS" })).toBeTruthy();
    expect(field("deck").textContent).toBe("DeckCLF");
    expect(field("section").textContent).toBe("Sectionnot chosen");
    expect(field("mode").textContent).toBe("Classnot chosen");
  });

  it("writes Whole deck in words, and keeps it from being a way back when the deck has no sections", () => {
    const values: FillInPassValues = { ...FULL, mode: undefined, section: { code: "ALL", name: "Whole deck", whole: true } };
    render(<FillInPass stage="route" values={values} now="mode" sectionChoosable={false} onJump={() => {}} />);
    expect(field("section").textContent).toBe("SectionWhole deck");
    expect(screen.queryByRole("button", { name: /^Change section/ })).toBeNull();
  });
});

describe("FillInPass: ready", () => {
  it("becomes the boarding pass: legs, Class, Cards and Gate", () => {
    render(<FillInPass stage="ready" values={FULL} onJump={() => {}} />);
    const pass = document.querySelector("[data-fill-in-pass='ready']");
    expect(pass?.textContent).toContain("BOARDING PASS");
    expect(document.querySelector("[data-leg='deck']")?.textContent).toBe("CLFAWS Cloud Practitioner");
    expect(document.querySelector("[data-leg='section']")?.textContent).toBe("SECSecurity and compliance");
    expect(pass?.textContent).toContain("ClassClassic");
    expect(pass?.textContent).toContain("Cards47");
    expect(pass?.textContent).toContain("GateF ← → TFalse left, true right");
  });

  it("lets the deck leg, the section leg and the class field return to their steps", () => {
    const onJump = vi.fn();
    render(<FillInPass stage="ready" values={FULL} onJump={onJump} />);
    fireEvent.click(screen.getByRole("button", { name: "Change deck, now CLF" }));
    fireEvent.click(screen.getByRole("button", { name: "Change section, now SEC" }));
    fireEvent.click(screen.getByRole("button", { name: "Change class, now Classic" }));
    expect(onJump.mock.calls).toEqual([["deck"], ["section"], ["mode"]]);
  });

  it("unrolls to the height of the game ticket, then says so", () => {
    const onUnrolled = vi.fn();
    const { rerender } = render(<FillInPass stage="ready" values={FULL} onJump={() => {}} />);
    expect(document.querySelector("[data-unroll]")).toBeNull();
    rerender(<FillInPass stage="ready" values={FULL} onJump={() => {}} unroll onUnrolled={onUnrolled} />);
    const paper = document.querySelector<HTMLElement>("[data-unroll]");
    expect(paper?.style.height).toBe("calc(var(--size-statement-min) + var(--size-lower) - var(--space-18) + var(--radius-card))");
    return vi.waitFor(() => expect(onUnrolled).toHaveBeenCalledTimes(1));
  });
});

describe("FillInPass: travelling values", () => {
  it("hides the value that is still travelling in from its card", () => {
    render(<FillInPass stage="destination" values={{ area: "Cloud" }} now="platform" travelling="area" onJump={() => {}} />);
    expect(document.querySelector<HTMLElement>("[data-pass-value='area']")?.style.visibility).toBe("hidden");
  });
});
```

- [ ] **Step 17: Run the fill-in pass tests and watch them fail**

```bash
pnpm vitest run tests/components/FillInPass.test.tsx
```

Expected: `Error: Failed to resolve import "@/components/FillInPass" from "tests/components/FillInPass.test.tsx". Does the file exist?`.

- [ ] **Step 18: Create the fill-in pass**

Create `components/FillInPass.tsx`. The ready layout repeats task 11's ticket header (band, legs, field grid) on purpose: task 11 does not exist yet, and the pass is its own component in the design system. The legs have no arrow between them, only the 40 px column, as on the approved screens.

```tsx
"use client";

// The fill-in pass of the start flow (design system 5.4): what the player has chosen so far, written onto
// one pass that becomes the round's boarding pass. Three layouts in step 1 of the game:
//   "destination" (steps 2 and 3): compact band, then Area / Platform / Deck.
//   "route" (steps 4 and 5): area and platform fold into one quiet line over Deck / Section / Class.
//   "ready" (step 6): the full boarding pass without its lower part (legs, Class / Cards / Gate).
// Every filled field is a way back to its step. With `unroll`, the ready pass grows down to the height of
// the game ticket (the hand-off to /play, which shows its ticket in the same place).
import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { LogoMark } from "./Logo";
import { CloudIcon } from "./icons";

export type PassStage = "destination" | "route" | "ready";
export type PassFieldName = "area" | "platform" | "deck" | "section" | "mode";

export interface FillInPassValues {
  /** Area title, "Cloud". */
  area?: string;
  /** Platform title, "AWS". */
  platform?: string;
  /** Deck code ("CLF") and the name the ready pass shows under it ("AWS Cloud Practitioner"). */
  deck?: { code: string; name: string };
  /** Section code and title; the whole deck is { code: "ALL", name: "Whole deck", whole: true }. */
  section?: { code: string; name: string; whole: boolean };
  /** Class label, "Classic". */
  mode?: string;
  /** The number of cards on the chosen route (the ready pass's "Cards"). */
  cards?: number;
}

export interface FillInPassProps {
  stage: PassStage;
  values: FillInPassValues;
  /** The field being chosen now: its dashes and label switch to ink. */
  now?: PassFieldName;
  /** False when the deck has no sections: the section then is not a way back (there is no section step). */
  sectionChoosable?: boolean;
  /** A filled field was pressed: go back to its step. */
  onJump: (field: PassFieldName) => void;
  /** The field whose value is hidden while a copy of it travels in from its card. */
  travelling?: PassFieldName;
  /** Ready stage only: grow down to the height of the game ticket, then call onUnrolled. */
  unroll?: boolean;
  onUnrolled?: () => void;
  className?: string;
}

const CHANGE_WORD: Record<PassFieldName, string> = {
  area: "area",
  platform: "platform",
  deck: "deck",
  section: "section",
  mode: "class",
};

/** "Change deck, now CLF": the accessible name of a field that returns to its step. */
export function changeLabel(field: PassFieldName, value: string): string {
  return `Change ${CHANGE_WORD[field]}, now ${value}`;
}

const EASE = [0.2, 0.7, 0.2, 1] as const;

const FIELD_LABEL =
  "font-(family-name:--type-field-label-family) text-(length:--type-field-label-size) font-(--type-field-label-weight) " +
  "leading-(--type-field-label-line-height) tracking-(--type-field-label-letter-spacing)";
const PASS_VALUE =
  "inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-top font-(family-name:--type-field-value-pass-family) " +
  "text-(length:--type-field-value-pass-size) font-(--type-field-value-pass-weight) leading-(--type-field-value-pass-line-height) " +
  "tracking-(--type-field-value-pass-letter-spacing)";
const PASS_CODE =
  "inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-top font-(family-name:--font-mono) text-(length:--type-field-value-pass-size) " +
  "font-(--font-weight-mono-semibold) leading-(--type-field-value-pass-line-height) tracking-[0.02em]";
const WAY_BACK =
  "absolute inset-0 cursor-pointer rounded-[6px] active:bg-(--color-press) focus-visible:outline-offset-[-2px]";
const LEG_CODE =
  "block font-(family-name:--type-leg-code-family) text-(length:--type-leg-code-size) font-(--type-leg-code-weight) " +
  "leading-(--type-leg-code-line-height) tracking-(--type-leg-code-letter-spacing)";
const LEG_NAME =
  "mt-(--space-6) block font-(family-name:--type-leg-name-family) text-(length:--type-leg-name-size) font-(--type-leg-name-weight) " +
  "leading-(--type-leg-name-line-height) tracking-(--type-leg-name-letter-spacing) text-(--color-ink-muted)";
const TICKET_VALUE =
  "m-0 mt-(--space-2) whitespace-nowrap font-(family-name:--type-field-value-family) text-(length:--type-field-value-size) " +
  "font-(--type-field-value-weight) leading-(--type-field-value-line-height) tracking-(--type-field-value-letter-spacing)";

function CompactBand() {
  return (
    <div
      aria-hidden="true"
      className="flex h-(--size-carrier-compact) items-center gap-(--space-8) bg-(--color-accent) px-(--space-14) text-(--color-on-accent)"
    >
      <span className="grid h-[16px] w-[22px] flex-none place-items-center">
        <LogoMark width={20} variant="compact" />
      </span>
      <span className="font-(family-name:--type-carrier-title-family) text-[14px] font-(--type-carrier-title-weight) leading-(--type-carrier-title-line-height) tracking-(--type-carrier-title-letter-spacing)">
        Truthy
      </span>
      <span className="ml-auto font-(family-name:--type-carrier-label-family) text-[11px] font-(--type-carrier-label-weight) leading-(--type-carrier-label-line-height) tracking-[0.06em]">
        YOUR PASS
      </span>
    </div>
  );
}

function TicketBand() {
  return (
    <div aria-hidden="true" className="flex h-(--size-carrier) items-center gap-(--space-10) bg-(--color-accent) px-(--space-16) text-(--color-on-accent)">
      <CloudIcon />
      <span className="font-(family-name:--type-carrier-title-family) text-(length:--type-carrier-title-size) font-(--type-carrier-title-weight) leading-(--type-carrier-title-line-height) tracking-(--type-carrier-title-letter-spacing)">
        Truthy
      </span>
      <span className="ml-auto font-(family-name:--type-carrier-label-family) text-(length:--type-carrier-label-size) font-(--type-carrier-label-weight) leading-(--type-carrier-label-line-height) tracking-(--type-carrier-label-letter-spacing)">
        BOARDING PASS
      </span>
    </div>
  );
}

/** Three dashes in a 20 tall box: a field not chosen yet. */
function Blank({ now }: { now: boolean }) {
  return (
    <span className="absolute top-0 left-0 flex h-(--space-20) items-center gap-[5px]">
      <span className="sr-only">not chosen</span>
      {[0, 1, 2].map((i) => (
        <i
          key={i}
          aria-hidden="true"
          className={`block h-[3px] w-[14px] rounded-(--radius-tick) ${now ? "bg-(--color-ink)" : "bg-(--color-rule)"}`}
        />
      ))}
    </span>
  );
}

interface FieldProps {
  field: PassFieldName;
  label: string;
  /** The value as shown, or undefined when the field is blank. */
  value: string | undefined;
  code?: boolean;
  now: boolean;
  first?: boolean;
  /** Whether a filled value returns to its step. */
  choosable?: boolean;
  hidden?: boolean;
  onJump: (field: PassFieldName) => void;
}

/** One cell of the destination or route grid: label, then the value or the blank. */
function Field({ field, label, value, code = false, now, first = false, choosable = true, hidden = false, onJump }: FieldProps) {
  const filled = value !== undefined;
  return (
    <div
      data-field={field}
      data-now={now ? "" : undefined}
      className={[
        "relative min-w-0 pt-[9px] pb-[11px]",
        first ? "" : "border-l-(length:--stroke-rule) border-(--color-rule) pl-(--space-12)",
      ].join(" ")}
    >
      <dt className={`${FIELD_LABEL} ${now ? "font-(--font-weight-mono-semibold) text-(--color-ink)" : "text-(--color-ink-muted)"}`}>
        {label}
      </dt>
      <dd className="relative m-0 mt-[3px] h-(--space-20)">
        {filled ? (
          <span data-pass-value={field} className={code ? PASS_CODE : PASS_VALUE} style={hidden ? { visibility: "hidden" } : undefined}>
            {value}
          </span>
        ) : (
          <Blank now={now} />
        )}
      </dd>
      {filled && !now && choosable ? (
        <button type="button" aria-label={changeLabel(field, value)} className={WAY_BACK} onClick={() => onJump(field)} />
      ) : null}
    </div>
  );
}

/** A word on the quiet line of the route pass ("Cloud", "AWS"): 22 tall, its hit area 48. */
function LineWord({ field, value, hidden, onJump }: { field: PassFieldName; value: string; hidden: boolean; onJump: (field: PassFieldName) => void }) {
  return (
    <button
      type="button"
      aria-label={changeLabel(field, value)}
      onClick={() => onJump(field)}
      className={[
        "relative h-[22px] cursor-pointer rounded-[6px] px-(--space-6) whitespace-nowrap text-(--color-ink-muted)",
        "font-(family-name:--type-pass-line-family) text-(length:--type-pass-line-size) font-(--type-pass-line-weight)",
        "after:absolute after:inset-x-[-2px] after:inset-y-[-13px] after:content-['']",
        "active:bg-(--color-press) focus-visible:outline-offset-[-2px]",
      ].join(" ")}
    >
      <span data-pass-value={field} className="inline-block pt-px leading-[22px]" style={hidden ? { visibility: "hidden" } : undefined}>
        {value}
      </span>
    </button>
  );
}

/** A leg of the ready pass (deck or section): code over name, a way back to its step. */
function Leg({ field, code, name, align, choosable, onJump }: { field: PassFieldName; code: string; name: string; align: "left" | "right"; choosable: boolean; onJump: (field: PassFieldName) => void }) {
  const content = (
    <>
      <span data-pass-value={field} className={LEG_CODE}>
        {code}
      </span>
      <span className={LEG_NAME}>{name}</span>
    </>
  );
  const className = `block min-w-0 rounded-(--radius-small) ${align === "right" ? "text-right" : "text-left"}`;
  if (!choosable) {
    return (
      <div data-leg={field} className={className}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-leg={field}
      aria-label={changeLabel(field, code === "ALL" ? name : code)}
      onClick={() => onJump(field)}
      className={`${className} cursor-pointer active:bg-(--color-press)`}
    >
      {content}
    </button>
  );
}

function ReadyBody({ values, sectionChoosable, onJump }: { values: FillInPassValues; sectionChoosable: boolean; onJump: (field: PassFieldName) => void }) {
  const cells: { label: string; value: ReactNode; field?: PassFieldName; text?: string }[] = [
    { label: "Class", value: <span data-pass-value="mode">{values.mode}</span>, field: "mode", text: values.mode },
    { label: "Cards", value: values.cards },
    {
      label: "Gate",
      value: (
        <>
          <span aria-hidden="true">F ← → T</span>
          <span className="sr-only">False left, true right</span>
        </>
      ),
    },
  ];
  return (
    <>
      <div className="grid grid-cols-[1fr_40px_1fr] items-start gap-(--space-8) px-(--size-ticket-inset) pt-(--space-14) pb-(--space-12)">
        <Leg field="deck" code={values.deck?.code ?? ""} name={values.deck?.name ?? ""} align="left" choosable onJump={onJump} />
        <span aria-hidden="true" />
        <Leg
          field="section"
          code={values.section?.code ?? ""}
          name={values.section?.name ?? ""}
          align="right"
          choosable={sectionChoosable}
          onJump={onJump}
        />
      </div>
      <dl className="mx-(--size-ticket-inset) my-0 grid grid-cols-[1.1fr_1fr_1fr] border-y-(length:--stroke-rule) border-(--color-rule)">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={["relative pt-(--space-8) pb-[7px]", i > 0 ? "border-l-(length:--stroke-rule) border-(--color-rule) pl-(--space-12)" : ""].join(" ")}
          >
            <dt className={`${FIELD_LABEL} text-(--color-ink-muted)`}>{cell.label}</dt>
            <dd className={TICKET_VALUE}>{cell.value}</dd>
            {cell.field && cell.text ? (
              <button type="button" aria-label={changeLabel(cell.field, cell.text)} className={WAY_BACK} onClick={() => onJump("mode")} />
            ) : null}
          </div>
        ))}
      </dl>
      <div className="h-(--space-18)" />
    </>
  );
}

/** The paper the ready pass unrolls into: as tall as the rest of a game ticket (statement and stub, minus the 18 pad). */
const UNROLL: CSSProperties = {
  top: "calc(100% - var(--radius-card))",
  height: "calc(var(--size-statement-min) + var(--size-lower) - var(--space-18) + var(--radius-card))",
};

export function FillInPass({
  stage,
  values,
  now,
  sectionChoosable = true,
  onJump,
  travelling,
  unroll = false,
  onUnrolled,
  className,
}: FillInPassProps) {
  const ready = stage === "ready";
  const hide = (field: PassFieldName) => travelling === field;
  const sectionText = values.section ? (values.section.whole ? values.section.name : values.section.code) : undefined;

  return (
    <div data-fill-in-pass={stage} className={["relative isolate", className].filter(Boolean).join(" ")}>
      <div
        className={[
          "relative overflow-hidden rounded-(--radius-card) bg-(--color-surface-raised) text-(--color-ink)",
          // While unrolling, the paper below carries the shadow, so none falls across the join.
          ready ? (unroll ? "" : "shadow-(--elevation-ticket)") : "shadow-(--elevation-small)",
        ].join(" ")}
      >
        {ready ? <TicketBand /> : <CompactBand />}
        <div aria-live="polite">
          {stage === "destination" ? (
            <dl className="m-0 grid grid-cols-[1fr_1.35fr_0.8fr] px-(--space-16)">
              <Field field="area" label="Area" value={values.area} now={now === "area"} first hidden={hide("area")} onJump={onJump} />
              <Field field="platform" label="Platform" value={values.platform} now={now === "platform"} hidden={hide("platform")} onJump={onJump} />
              <Field field="deck" label="Deck" value={values.deck?.code} code now={now === "deck"} hidden={hide("deck")} onJump={onJump} />
            </dl>
          ) : null}
          {stage === "route" ? (
            <>
              <div className="flex h-(--size-pass-line) items-center gap-(--space-2) px-(--space-10) pt-(--space-8)">
                {values.area ? <LineWord field="area" value={values.area} hidden={hide("area")} onJump={onJump} /> : null}
                <span aria-hidden="true" className="font-(family-name:--type-pass-line-family) text-(length:--type-pass-line-size) font-(--type-pass-line-weight) text-(--color-rule)">
                  ·
                </span>
                {values.platform ? <LineWord field="platform" value={values.platform} hidden={hide("platform")} onJump={onJump} /> : null}
              </div>
              <dl className="m-0 grid grid-cols-[0.75fr_1.1fr_1.15fr] px-(--space-16)">
                <Field field="deck" label="Deck" value={values.deck?.code} code now={now === "deck"} first hidden={hide("deck")} onJump={onJump} />
                <Field
                  field="section"
                  label="Section"
                  value={sectionText}
                  code={values.section ? !values.section.whole : false}
                  now={now === "section"}
                  choosable={sectionChoosable}
                  hidden={hide("section")}
                  onJump={onJump}
                />
                <Field field="mode" label="Class" value={values.mode} now={now === "mode"} hidden={hide("mode")} onJump={onJump} />
              </dl>
            </>
          ) : null}
          {ready ? <ReadyBody values={values} sectionChoosable={sectionChoosable} onJump={onJump} /> : null}
        </div>
      </div>
      {ready && unroll ? (
        <motion.div
          aria-hidden="true"
          data-unroll=""
          className="absolute inset-x-0 -z-10 origin-top rounded-b-(--radius-card) bg-(--color-surface-raised) shadow-(--elevation-ticket)"
          style={UNROLL}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.36, ease: EASE }}
          onAnimationComplete={onUnrolled}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 19: Run the fill-in pass tests and watch them pass**

```bash
pnpm vitest run tests/components/FillInPass.test.tsx
```

Expected: `Tests  11 passed (11)`.

- [ ] **Step 20: Commit**

```bash
git add components/FillInPass.tsx tests/components/FillInPass.test.tsx
git commit -m "feat: add the fill-in pass with its three layouts, the ways back and the unroll"
```

- [ ] **Step 21: Write the failing tests for the continue line**

Create `tests/components/start/ContinueLine.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContinueLine } from "@/components/start/ContinueLine";

afterEach(cleanup);

const ROUTE = { deckCode: "CLF", deckTitle: "Cloud Practitioner", sectionCode: "SEC", sectionTitle: "Security and compliance", modeLabel: "Classic" };

describe("ContinueLine", () => {
  it("is one button that names the route and the class in full", () => {
    const onContinue = vi.fn();
    render(<ContinueLine {...ROUTE} onContinue={onContinue} />);
    const button = screen.getByRole("button", { name: "Continue: Cloud Practitioner, Security and compliance, Classic." });
    expect(button.textContent).toBe("Continue where you left offCLF → SEC · Classic");
    fireEvent.click(button);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("adds the last score when it is known", () => {
    render(<ContinueLine {...ROUTE} lastScore={{ score: 7, total: 10 }} onContinue={() => {}} />);
    const button = screen.getByRole("button", { name: "Continue: Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10." });
    expect(button.textContent).toBe("Continue where you left offCLF → SEC · Classic · last 7 of 10");
    expect(button.querySelector("em")?.textContent).toBe("7 of 10");
  });

  it("is a 60 tall row, the same place and size as the pill it shares the foot with", () => {
    render(<ContinueLine {...ROUTE} onContinue={() => {}} />);
    expect(screen.getByRole("button").className).toContain("h-(--size-pill)");
  });
});
```

- [ ] **Step 22: Run the continue line tests and watch them fail**

```bash
pnpm vitest run tests/components/start/ContinueLine.test.tsx
```

Expected: `Error: Failed to resolve import "@/components/start/ContinueLine" from "tests/components/start/ContinueLine.test.tsx". Does the file exist?`.

- [ ] **Step 23: Create the continue line**

Create `components/start/ContinueLine.tsx`:

```tsx
// The continue line of start step 1 (design system 5.4a): one tap back into the last route for a
// returning player. It fills the whole pass and goes straight to "Your pass is ready".
import type { Ref } from "react";
import { LogoMark } from "@/components/Logo";
import { ChevronIcon } from "@/components/icons";

export interface ContinueLineProps {
  /** "CLF". */
  deckCode: string;
  /** "Cloud Practitioner", for the accessible name. */
  deckTitle: string;
  /** "SEC", or "ALL" for the whole deck. */
  sectionCode: string;
  /** "Security and compliance", or "Whole deck". */
  sectionTitle: string;
  /** "Classic". */
  modeLabel: string;
  /** The score of the last round, when it is known. */
  lastScore?: { score: number; total: number };
  onContinue: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/** "Continue: Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10." */
export function continueLabel({ deckTitle, sectionTitle, modeLabel, lastScore }: Omit<ContinueLineProps, "onContinue" | "ref" | "deckCode" | "sectionCode">): string {
  const score = lastScore ? ` Last score ${lastScore.score} of ${lastScore.total}.` : "";
  return `Continue: ${deckTitle}, ${sectionTitle}, ${modeLabel}.${score}`;
}

export function ContinueLine(props: ContinueLineProps) {
  const { deckCode, sectionCode, modeLabel, lastScore, onContinue, ref } = props;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={continueLabel(props)}
      onClick={onContinue}
      className={[
        "flex h-(--size-pill) w-full cursor-pointer items-center gap-(--space-14) rounded-(--radius-card) pr-(--space-12) pl-(--space-4) text-left text-(--color-ink)",
        "transition-[scale,background-color] duration-(--duration-t1) ease-(--easing-ease) active:scale-[0.98] active:bg-(--color-press)",
      ].join(" ")}
    >
      <span aria-hidden="true" className="grid size-(--size-continue-icon) flex-none place-items-center rounded-full bg-(--color-surface-raised)">
        <LogoMark width={26} />
      </span>
      <span aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="font-(family-name:--type-emphasis-family) text-(length:--type-emphasis-size) font-(--type-emphasis-weight) leading-[1.2] tracking-(--type-emphasis-letter-spacing)">
          Continue where you left off
        </span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) font-(--type-mono-data-weight) leading-(--type-mono-data-line-height) text-(--color-ink-muted)">
          {deckCode} → {sectionCode} · {modeLabel}
          {lastScore ? (
            <>
              {" · last "}
              <em className="font-(--font-weight-mono-semibold) text-(--color-ink) not-italic">
                {lastScore.score} of {lastScore.total}
              </em>
            </>
          ) : null}
        </span>
      </span>
      <span aria-hidden="true" className="flex flex-none">
        <ChevronIcon />
      </span>
    </button>
  );
}
```

- [ ] **Step 24: Run the continue line tests and watch them pass**

```bash
pnpm vitest run tests/components/start/ContinueLine.test.tsx
```

Expected: `Tests  3 passed (3)`.

- [ ] **Step 25: Commit**

```bash
git add components/start/ContinueLine.tsx tests/components/start/ContinueLine.test.tsx
git commit -m "feat: add the continue line for returning players"
```

- [ ] **Step 26: Write the failing tests for the start flow**

Create `tests/components/start/StartFlow.test.tsx`. Animations are skipped (`MotionGlobalConfig.skipAnimations`), `next/navigation` is mocked, and the history is the in-memory one from the fixtures. The keyboard test moves focus the way Tab does (next focusable element in document order, nothing inside an `inert` step) and activates buttons on Enter the way browsers do; the comparison step repeats it with real key presses in Chromium.

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { StartFlow, canShow, clearFrom, pathTo, previousStep } from "@/components/start/StartFlow";
import { PENDING_KEY } from "@/src/app-state/pending";
import { INDEX, harness, storedProgress, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
});
afterEach(cleanup);

// The last round on CLF / SEC / Classic, left before the end: it has no score.
const LAST_CLF_SEC = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" as const, score: null, total: null };

let h: Harness;

async function start(setup: Harness = harness()) {
  h = setup;
  const view = render(<StartFlow services={h.services} />);
  await screen.findByRole("button", { name: "Cloud, 2 decks" });
  return view;
}

function heading(): string | null | undefined {
  return [...document.querySelectorAll("[data-step]:not([inert]) h2")].at(-1)?.textContent;
}

async function choose(name: string | RegExp, nextHeading: string) {
  fireEvent.click(screen.getByRole("button", { name }));
  await waitFor(() => expect(heading()).toBe(nextHeading));
}

function passText(): string {
  return (document.querySelector("[data-fill-in-pass]")?.textContent ?? "").replace(/\s+/g, " ");
}

function field(name: string): string | null | undefined {
  return document.querySelector(`[data-fill-in-pass] [data-field="${name}"]`)?.textContent;
}

async function toClasses() {
  await choose("Cloud, 2 decks", "Choose a platform");
  await choose("AWS, 1 deck", "Choose a deck");
  await choose(/^CLF, Cloud Practitioner/, "Choose a section");
  await choose(/^SEC, Security and compliance/, "Choose how to play");
}

describe("the steps (pure)", () => {
  it("clears a step's choice and every later one", () => {
    const all = { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC", mode: "classic" as const };
    expect(clearFrom(all, 3)).toEqual({ areaId: "cloud", platformId: "aws" });
    expect(clearFrom(all, 6)).toEqual(all);
    expect(clearFrom(all, 1)).toEqual({});
  });

  it("walks every step, and skips the section step for a deck without sections", () => {
    expect(pathTo(6, true)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pathTo(6, false)).toEqual([1, 2, 3, 5, 6]);
    expect(previousStep(5, false)).toBe(3);
    expect(previousStep(5, true)).toBe(4);
    expect(previousStep(2, true)).toBe(1);
  });

  it("knows whether a remembered step can still be shown with the index", () => {
    expect(canShow(INDEX, 4, { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02" })).toBe(true);
    expect(canShow(INDEX, 4, { areaId: "cloud", platformId: "gcp", deckId: "gcp-cdl" })).toBe(false);
    expect(canShow(INDEX, 3, { areaId: "cloud", platformId: "gone" })).toBe(false);
    expect(canShow(INDEX, 6, { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC", mode: "streak" })).toBe(false);
  });
});

describe("StartFlow: step 1", () => {
  it("shows the logo as the page heading, the line in ink and one card per area", async () => {
    await start();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Truthy");
    const line = screen.getByText("True or false cards that teach you IT, one swipe at a time.");
    expect(line.className).toContain("text-(--color-ink)");
    expect(line.className).not.toContain("ink-muted");
    expect(heading()).toBe("Choose an area");
    expect(screen.getByRole("button", { name: "Frontend, 1 deck" })).toBeTruthy();
  });

  it("marks an area without decks as not available: a disabled group, not a button", async () => {
    await start();
    expect(screen.queryByRole("button", { name: /DevOps/ })).toBeNull();
    const devops = screen.getByRole("group", { name: "DevOps, no decks yet" });
    expect(devops.getAttribute("aria-disabled")).toBe("true");
    expect(devops.textContent).toBe("DevOpsNo decks yet");
  });

  it("shows quiet placeholders while the index loads", async () => {
    h = harness();
    h.network.hold = true;
    render(<StartFlow services={h.services} />);
    expect(screen.getByRole("status").textContent).toBe("Loading the decks");
    expect(document.querySelectorAll("[data-placeholder]")).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Truthy");
    await act(async () => h.network.release());
    expect(await screen.findByRole("button", { name: "Cloud, 2 decks" })).toBeTruthy();
    expect(document.querySelector("[data-placeholder]")).toBeNull();
  });

  it("says the decks did not load and offers Try again when there is no cached index", async () => {
    h = harness();
    h.network.online = false;
    render(<StartFlow services={h.services} />);
    expect((await screen.findByRole("alert")).textContent).toBe("The decks didn't loadCheck your connection and try again.");
    h.network.online = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Cloud, 2 decks" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("has no Continue line on a first run", async () => {
    await start();
    expect(screen.queryByRole("button", { name: /^Continue/ })).toBeNull();
  });
});

describe("StartFlow: choosing a route", () => {
  it("fills the pass step by step and hands the round to /play", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    expect(field("area")).toBe("AreaCloud");
    expect(field("platform")).toBe("Platformnot chosen");
    expect(screen.getByRole("group", { name: "Azure, no decks yet" })).toBeTruthy();

    await choose("AWS, 1 deck", "Choose a deck");
    expect(field("platform")).toBe("PlatformAWS");

    await choose("CLF, Cloud Practitioner, 92 cards, not started", "Choose a section");
    expect(passText()).toContain("Cloud·AWSDeckCLF");
    expect(field("deck")).toBe("DeckCLF");
    const sections = [...document.querySelectorAll("[data-step='4'] [data-option] button")].map((b) => b.getAttribute("aria-label"));
    expect(sections).toEqual([
      "Whole deck, all 2 sections, 92 cards",
      "CON, Cloud concepts, 45 cards",
      "SEC, Security and compliance, 47 cards",
    ]);

    await choose("SEC, Security and compliance, 47 cards", "Choose how to play");
    expect(field("section")).toBe("SectionSEC");

    await choose(/^Classic\./, "Your pass is ready");
    expect(passText()).toContain("CLF");
    expect(passText()).toContain("AWS Cloud Practitioner");
    expect(passText()).toContain("Security and compliance");
    expect(passText()).toContain("ClassClassic");
    expect(passText()).toContain("Cards47");
    expect(screen.getByText("10 cards, score at the end. Swipe right for true, left for false.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(JSON.parse(h.session.data.get(PENDING_KEY) ?? "null")).toEqual({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play"));
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("shows how much of a deck has been seen", async () => {
    const cards = Object.fromEntries(Array.from({ length: 23 }, (_, i) => [`aws-clf-c02-t1-${i}`, { seen: 1, lastCorrect: true, lastSeenAt: 1 }]));
    await start(harness(storedProgress({ cards })));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("AWS, 1 deck", "Choose a deck");
    expect(screen.getByRole("button", { name: "CLF, Cloud Practitioner, 92 cards, 25 percent seen" })).toBeTruthy();
  });

  it("skips the section step for a deck without sections and plays the whole deck", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("Google Cloud, 1 deck", "Choose a deck");
    await choose(/^CDL, Cloud Digital Leader/, "Choose how to play");
    expect(field("section")).toBe("SectionWhole deck");
    expect(screen.queryByRole("button", { name: /^Change section/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Back to decks" })).toBeTruthy();
    await choose(/^Classic\./, "Your pass is ready");
    expect(document.querySelector("[data-leg='section']")?.textContent).toBe("ALLWhole deck");
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(JSON.parse(h.session.data.get(PENDING_KEY) ?? "null")).toEqual({ route: { deckId: "gcp-cdl", sectionId: "ALL" }, mode: "classic" });
  });

  it("shows the best for this route on Classic, and the other classes as not available", async () => {
    await start(harness(storedProgress({ records: { "aws-clf-c02/SEC#classic": 9, "aws-clf-c02/CON#classic": 4 } })));
    await toClasses();
    expect(screen.getByRole("button", { name: "Classic. 10 cards, score at the end. Your best: 9 of 10." })).toBeTruthy();
    for (const name of ["Streak", "Three lives", "Timed"]) {
      expect(screen.queryByRole("button", { name: new RegExp(`^${name}`) })).toBeNull();
      const group = screen.getByRole("group", { name: `${name}, not available yet` });
      expect(group.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(group);
    }
    expect(heading()).toBe("Choose how to play");
  });

  it("says Classic has not been played on a new route", async () => {
    await start();
    await toClasses();
    expect(screen.getByRole("button", { name: "Classic. 10 cards, score at the end. Not played yet." }).textContent).toContain("Best–not played");
  });

  it("starts the round only once when Start round is pressed twice", async () => {
    await start();
    await toClasses();
    await choose(/^Classic\./, "Your pass is ready");
    const button = screen.getByRole("button", { name: "Start round" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });
});

describe("StartFlow: going back", () => {
  it("steps back with the Back pill, clearing the choice of that step, and focuses the card chosen before", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("AWS, 1 deck", "Choose a deck");
    fireEvent.click(screen.getByRole("button", { name: "Back to platforms" }));
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    expect(field("platform")).toBe("Platformnot chosen");
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("AWS, 1 deck"));
  });

  it("jumps back through a filled field and clears every later choice", async () => {
    await start();
    await toClasses();
    fireEvent.click(screen.getByRole("button", { name: "Change deck, now CLF" }));
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(field("deck")).toBe("Decknot chosen");
    await choose(/^CLF/, "Choose a section");
    expect(field("section")).toBe("Sectionnot chosen");
    expect(field("mode")).toBe("Classnot chosen");
  });

  it("jumps back from the ready pass to the class step", async () => {
    await start();
    await toClasses();
    await choose(/^Classic\./, "Your pass is ready");
    fireEvent.click(screen.getByRole("button", { name: "Change class, now Classic" }));
    await waitFor(() => expect(heading()).toBe("Choose how to play"));
    expect(field("mode")).toBe("Classnot chosen");
    expect(screen.queryByRole("button", { name: "Start round" })).toBeNull();
  });

  it("steps back on Escape", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(heading()).toBe("Choose an area"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Truthy");
  });
});

describe("StartFlow: the browser history", () => {
  it("keeps one entry per step, without changing the URL path", async () => {
    await start();
    await toClasses();
    expect(h.history.position).toBe(4);
    expect(h.history.entries).toHaveLength(5);
    expect(h.history.state).toEqual({
      truthyStart: { step: 5, choice: { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC" } },
    });
  });

  it("steps back on the browser's back button and forward again on forward", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("AWS, 1 deck", "Choose a deck");
    act(() => h.history.back());
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    expect(field("platform")).toBe("Platformnot chosen");
    act(() => h.history.forward());
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(field("platform")).toBe("PlatformAWS");
  });

  it("drops the entries of the steps that Back and the fields leave behind", async () => {
    await start();
    await toClasses();
    fireEvent.click(screen.getByRole("button", { name: "Change platform, now AWS" }));
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    expect(h.history.position).toBe(1);
    await act(async () => {}); // the history reports the move; the flow must stay where it is
    expect(heading()).toBe("Choose a platform");
  });

  it("starts at step 1 after a reload, whatever step the entry remembered", async () => {
    h = harness();
    h.history.replace({ truthyStart: { step: 4, choice: { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02" } } });
    render(<StartFlow services={h.services} />);
    await screen.findByRole("button", { name: "Cloud, 2 decks" });
    expect(heading()).toBe("Choose an area");
    expect(h.history.state).toEqual({ truthyStart: { step: 1, choice: {} } });
  });
});

describe("StartFlow: a history entry from before an update", () => {
  it("goes to step 1 when the browser steps back to a route the index no longer has", async () => {
    h = harness();
    h.history.replace({ truthyStart: { step: 3, choice: { areaId: "cloud", platformId: "oracle" } } });
    h.history.push({ truthyStart: { step: 2, choice: { areaId: "cloud" } } });
    render(<StartFlow services={h.services} />);
    await screen.findByRole("button", { name: "Cloud, 2 decks" });
    await choose("Frontend, 1 deck", "Choose a platform");
    act(() => h.history.go(-2));
    await waitFor(() => expect(h.history.state).toEqual({ truthyStart: { step: 1, choice: {} } }));
    expect(heading()).toBe("Choose an area");
    expect(screen.getByRole("button", { name: "Cloud, 2 decks" })).toBeTruthy();
  });
});

describe("StartFlow: continue", () => {
  it("offers the last route and class, and lands on the ready pass with them filled in", async () => {
    await start(harness(storedProgress({ last: LAST_CLF_SEC })));
    const line = screen.getByRole("button", { name: "Continue: Cloud Practitioner, Security and compliance, Classic." });
    expect(line.textContent).toBe("Continue where you left offCLF → SEC · Classic");
    fireEvent.click(line);
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
    expect(document.querySelector("[data-leg='deck']")?.textContent).toBe("CLFAWS Cloud Practitioner");
    expect(document.querySelector("[data-leg='section']")?.textContent).toBe("SECSecurity and compliance");
    expect(screen.getByRole("button", { name: "Start round" })).toBeTruthy();
    expect(h.history.entries.map((e) => (e as { truthyStart: { step: number } }).truthyStart.step)).toEqual([1, 2, 3, 4, 5, 6]);
    fireEvent.click(screen.getByRole("button", { name: "Back to classes" }));
    await waitFor(() => expect(heading()).toBe("Choose how to play"));
    expect(field("section")).toBe("SectionSEC");
  });

  it("retraces a whole-deck route of a deck without sections without a section step", async () => {
    await start(harness(storedProgress({ last: { route: { deckId: "gcp-cdl", sectionId: "ALL" }, mode: "classic", score: null, total: null } })));
    fireEvent.click(screen.getByRole("button", { name: "Continue: Cloud Digital Leader, Whole deck, Classic." }));
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
    expect(document.querySelector("[data-leg='section']")?.textContent).toBe("ALLWhole deck");
    expect(h.history.entries.map((e) => (e as { truthyStart: { step: number } }).truthyStart.step)).toEqual([1, 2, 3, 5, 6]);
    fireEvent.click(screen.getByRole("button", { name: "Back to classes" }));
    await waitFor(() => expect(heading()).toBe("Choose how to play"));
    fireEvent.click(screen.getByRole("button", { name: "Back to decks" }));
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(h.history.position).toBe(2);
  });

  it("is not shown when the last route is gone from the index", async () => {
    await start(harness(storedProgress({ last: { ...LAST_CLF_SEC, route: { deckId: "aws-clf-c02", sectionId: "OLD" } } })));
    expect(screen.queryByRole("button", { name: /^Continue/ })).toBeNull();
  });

  it("is not shown when the last class cannot be played in this version", async () => {
    await start(harness(storedProgress({ last: { ...LAST_CLF_SEC, mode: "streak" } })));
    expect(screen.queryByRole("button", { name: /^Continue/ })).toBeNull();
  });
});

describe("StartFlow: keyboard", () => {
  // Tab moves to the next focusable element in document order (no positive tabindex is used);
  // Enter on a button activates it, as browsers do.
  function tabbables(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")].filter(
      (el) => !el.closest("[inert]") && !el.hasAttribute("disabled"),
    );
  }
  function tab() {
    const list = tabbables();
    const at = list.indexOf(document.activeElement as HTMLElement);
    list[(at + 1) % list.length]?.focus();
  }
  function enter() {
    const active = document.activeElement as HTMLElement;
    fireEvent.keyDown(active, { key: "Enter" });
    if (active.tagName === "BUTTON") fireEvent.click(active);
  }
  async function tabTo(name: RegExp) {
    for (let i = 0; i < 20; i++) {
      tab();
      if (name.test(document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "")) return;
    }
    throw new Error(`Tab never reached ${name}`);
  }

  it("plays the whole path with Tab and Enter only, the step title taking focus after each step", async () => {
    await start();
    const steps: [RegExp, string][] = [
      [/^Cloud, 2 decks$/, "Choose a platform"],
      [/^AWS, 1 deck$/, "Choose a deck"],
      [/^CLF, /, "Choose a section"],
      [/^SEC, /, "Choose how to play"],
      [/^Classic\./, "Your pass is ready"],
    ];
    for (const [option, next] of steps) {
      await tabTo(option);
      enter();
      await waitFor(() => expect(document.activeElement?.textContent).toBe(next));
      expect(document.activeElement?.tagName).toBe("H2");
    }
    await tabTo(/^Start round/);
    enter();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play"));
  });
});
```

- [ ] **Step 27: Run the start flow tests and watch them fail**

```bash
pnpm vitest run tests/components/start/StartFlow.test.tsx
```

Expected: `Error: Failed to resolve import "@/components/start/StartFlow" from "tests/components/start/StartFlow.test.tsx". Does the file exist?`.

- [ ] **Step 28: Create the start flow**

Create `components/start/StartFlow.tsx`. Read it top to bottom: the pure step model, the history entries, the motion constants, then the component (state, history, focus, the three actions forward, backTo and continueLast, Start round, the travelling name, the three zones), then the small parts.

```tsx
"use client";

// The start flow, "filling in the pass" (spec section 9, screen 1; design/flow/screens/start.html).
// One screen that steps through six states: 1 area, 2 platform, 3 deck, 4 section, 5 class, 6 ready.
// Each choice is written onto the fill-in pass; Back, a filled field of the pass and the browser's back
// button all step back and clear the later choices. "Start round" hands the route and class to /play.
//
// Where things live:
//   - the step and the choices: `view` state, mirrored into the browser history (one entry per step on
//     the path, the URL never changes), so the browser's back and forward buttons move through the steps;
//   - the index and the progress: useCatalog;
//   - the motion: AnimatePresence per zone (top, main, foot), plus one "ghost" copy of the chosen name
//     that travels into its field of the pass. Reduced motion swaps all of it for a cross-fade.
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type Transition, type Variants } from "motion/react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DestinationCard } from "@/components/DestinationCard";
import { FillInPass, type FillInPassValues, type PassFieldName, type PassStage } from "@/components/FillInPass";
import { Logo } from "@/components/Logo";
import { PillButton } from "@/components/PillButton";
import { SkyBackdrop } from "@/components/SkyBackdrop";
import { BackArrowIcon } from "@/components/icons";
import { savePending } from "@/src/app-state/pending";
import { browserAppServices, browserStepHistory, type AppServices, type StepHistory } from "@/src/app-state/services";
import { WHOLE_DECK, type DeckIndex, type IndexArea, type IndexDeck, type IndexPlatform } from "@/src/content/schema";
import { AVAILABLE_MODES, type Mode } from "@/src/engine/round";
import { ContinueLine } from "./ContinueLine";
import { bestFor, continueTarget, deckCount, decksLabel, seenPercent, useCatalog } from "./useCatalog";

// ---------- services ----------

export interface StartServices extends AppServices {
  /** The browser history the flow keeps its steps in. Undefined: steps are not remembered (server, tests). */
  history: () => StepHistory | undefined;
}

export const browserStartServices: StartServices = { ...browserAppServices, history: browserStepHistory };

// ---------- the steps and the choices (pure) ----------

export type Step = 1 | 2 | 3 | 4 | 5 | 6;

/** What the player has chosen so far, as ids. sectionId is a section id or WHOLE_DECK. */
export interface Choice {
  areaId?: string;
  platformId?: string;
  deckId?: string;
  sectionId?: string;
  mode?: Mode;
}

type ChoiceKey = keyof Choice;
const CHOICE_KEYS: readonly ChoiceKey[] = ["areaId", "platformId", "deckId", "sectionId", "mode"];

/** The step on which each choice is made. */
export const STEP_OF: Record<ChoiceKey, Step> = { areaId: 1, platformId: 2, deckId: 3, sectionId: 4, mode: 5 };

const STEP_OF_FIELD: Record<PassFieldName, Step> = { area: 1, platform: 2, deck: 3, section: 4, mode: 5 };

/** Keeps only the choices made before `step`: going back to a step clears it and everything after it. */
export function clearFrom(choice: Choice, step: Step): Choice {
  const kept: Choice = {};
  for (const key of CHOICE_KEYS) {
    if (STEP_OF[key] < step && choice[key] !== undefined) Object.assign(kept, { [key]: choice[key] });
  }
  return kept;
}

/** The steps a player passes through up to `step`. A deck without sections has no step 4. */
export function pathTo(step: Step, hasSections: boolean): Step[] {
  const all: Step[] = hasSections ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 5, 6];
  return all.filter((s) => s <= step);
}

/** Where Back goes from `step`: one step back, and from the class step of a deck without sections to the deck step. */
export function previousStep(step: Step, hasSections: boolean): Step {
  const path = pathTo(step, hasSections);
  return path[path.length - 2] ?? 1;
}

function sameChoice(a: Choice, b: Choice): boolean {
  return CHOICE_KEYS.every((key) => a[key] === b[key]);
}

export interface ModeOption {
  id: Mode;
  name: string;
  description: string;
  /** The unit of the best, as the class card shows it under the number. */
  unit: string;
}

export const MODE_OPTIONS: readonly ModeOption[] = [
  { id: "classic", name: "Classic", description: "10 cards, score at the end.", unit: "of 10" },
  { id: "streak", name: "Streak", description: "Keep going until the first wrong answer.", unit: "in a row" },
  { id: "lives", name: "Three lives", description: "The round ends on the third wrong answer.", unit: "cards" },
  { id: "timed", name: "Timed", description: "60 seconds, as many cards as you can.", unit: "correct" },
];

/** A section as the flow shows it; the whole deck is one too. */
interface SectionView {
  id: string;
  title: string;
  cardCount: number;
  whole: boolean;
}

function wholeDeck(deck: IndexDeck): SectionView {
  return { id: WHOLE_DECK, title: "Whole deck", cardCount: deck.cardCount, whole: true };
}

/** The choices looked up in the index. A missing entry means it was not chosen or no longer exists. */
interface Resolved {
  area?: IndexArea;
  platform?: IndexPlatform;
  deck?: IndexDeck;
  section?: SectionView;
  mode?: ModeOption;
}

function resolve(index: DeckIndex, choice: Choice): Resolved {
  const area = index.areas.find((a) => a.id === choice.areaId);
  const platform = area?.platforms.find((p) => p.id === choice.platformId);
  const deck = platform?.decks.find((d) => d.id === choice.deckId);
  let section: SectionView | undefined;
  if (deck && choice.sectionId === WHOLE_DECK) section = wholeDeck(deck);
  else if (deck) {
    const found = deck.sections.find((s) => s.id === choice.sectionId);
    if (found) section = { id: found.id, title: found.title, cardCount: found.cardCount, whole: false };
  }
  const mode = MODE_OPTIONS.find((m) => m.id === choice.mode && AVAILABLE_MODES.includes(m.id));
  return { area, platform, deck, section, mode };
}

/** True when every choice needed to show `step` exists in the index (a stale history entry may not). */
export function canShow(index: DeckIndex, step: Step, choice: Choice): boolean {
  const r = resolve(index, choice);
  if (step >= 2 && !r.area) return false;
  if (step >= 3 && !r.platform) return false;
  if (step >= 4 && !r.deck) return false;
  if (step === 4 && r.deck && r.deck.sections.length === 0) return false;
  if (step >= 5 && !r.section) return false;
  if (step >= 6 && !r.mode) return false;
  return true;
}

// ---------- history entries ----------

interface Entry {
  step: Step;
  choice: Choice;
}

const HISTORY_KEY = "truthyStart";

function entryState(entry: Entry): Record<string, unknown> {
  return { [HISTORY_KEY]: entry };
}

function readEntry(state: unknown): Entry | null {
  if (typeof state !== "object" || state === null || !(HISTORY_KEY in state)) return null;
  const value = (state as Record<string, unknown>)[HISTORY_KEY];
  if (typeof value !== "object" || value === null) return null;
  const { step, choice } = value as { step?: unknown; choice?: unknown };
  if (typeof step !== "number" || ![1, 2, 3, 4, 5, 6].includes(step) || typeof choice !== "object" || choice === null) return null;
  const picked: Choice = {};
  for (const key of CHOICE_KEYS) {
    const v = (choice as Record<string, unknown>)[key];
    if (typeof v === "string") Object.assign(picked, { [key]: v });
  }
  return { step: step as Step, choice: picked };
}

// ---------- motion ----------

const EASE = [0.2, 0.7, 0.2, 1] as const;
const EASE_OUT = [0, 0, 0.58, 1] as const;
type Direction = 1 | -1;

/** A step's panel: on its way out it rises (forward) or sinks (back) 10px and fades. */
const PANEL: Variants = {
  hidden: { opacity: 1 },
  shown: { opacity: 1, y: 0, transition: { delayChildren: 0.11, staggerChildren: 0.025 } },
  gone: (dir: Direction) => ({ opacity: 0, y: -10 * dir, transition: { duration: 0.14, ease: EASE_OUT } }),
};
/** The items of a step (title, cards): they rise from 24px below (forward) or drop from 24px above (back). */
const ITEM: Variants = {
  hidden: (dir: Direction) => ({ opacity: 0, y: 24 * dir }),
  shown: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
};
/** Reduced motion: the old step fades out, then the new one fades in. Text never overlaps. */
const PANEL_REDUCED: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.14, delay: 0.09 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
};

/** A zone that swaps its content (the top and the foot): out 110ms, in 240ms after 120ms, 12px of travel. */
function swapMotion(reduced: boolean, rise: number) {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.14, delay: 0.09 } },
      exit: { opacity: 0, transition: { duration: 0.1 } },
    };
  }
  return {
    initial: { opacity: 0, y: rise },
    animate: { opacity: 1, y: 0, transition: { duration: 0.24, delay: 0.12, ease: EASE } },
    exit: { opacity: 0, y: rise, transition: { duration: 0.11, ease: EASE } },
  };
}

const TRAVEL: Transition = { duration: 0.3, delay: 0.06, ease: EASE };

/** Where a name is and how it looks, relative to the app frame. */
interface Look {
  text: string;
  left: number;
  top: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  style: CSSProperties;
}

interface Travel {
  field: PassFieldName;
  from: Look;
  to?: { left: number; top: number; height: number; fontSize: number };
}

/** The layout box of `el` relative to `frame`, ignoring transforms (the pass may still be sliding in). */
function layoutBox(el: HTMLElement, frame: Element): { left: number; top: number; width: number; height: number } | null {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== frame) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return node === frame ? { left, top, width: el.offsetWidth, height: el.offsetHeight } : null;
}

function lookOf(el: HTMLElement, frame: Element): Look {
  const box = el.getBoundingClientRect();
  const origin = frame.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    text: el.textContent ?? "",
    left: box.left - origin.left,
    top: box.top - origin.top,
    height: box.height,
    fontSize: parseFloat(cs.fontSize) || 1,
    fontFamily: cs.fontFamily,
    style: { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing, color: cs.color },
  };
}

// ---------- copy ----------

const STEP_TITLE: Record<Step, string> = {
  1: "Choose an area",
  2: "Choose a platform",
  3: "Choose a deck",
  4: "Choose a section",
  5: "Choose how to play",
  6: "Your pass is ready",
};
const BACK_TO: Record<Step, string> = { 1: "areas", 2: "platforms", 3: "decks", 4: "sections", 5: "classes", 6: "classes" };
const NOW_FIELD: Partial<Record<Step, PassFieldName>> = { 2: "platform", 3: "deck", 4: "section", 5: "mode" };

function stageOf(step: Step): PassStage {
  if (step <= 3) return "destination";
  return step <= 5 ? "route" : "ready";
}

const TEXT_ROLE = {
  title:
    "m-0 flex h-[36px] flex-none items-center font-(family-name:--type-step-title-family) text-(length:--type-step-title-size) " +
    "font-(--type-step-title-weight) tracking-(--type-step-title-letter-spacing) text-(--color-ink) outline-none",
  tagline:
    "m-0 font-(family-name:--type-tagline-family) text-(length:--type-tagline-size) font-(--type-tagline-weight) " +
    "leading-(--type-tagline-line-height) text-(--color-ink)",
};

// ---------- the component ----------

export interface StartFlowProps {
  /** The outside world. Defaults to the browser. Pass a stable object. */
  services?: StartServices;
}

interface View extends Entry {
  dir: Direction;
  /** Going back: the option to focus (the one chosen before). Otherwise the step title takes focus. */
  focusId?: string;
  /** Counts step changes; 0 is the first render, which moves no focus. */
  seq: number;
}

export function StartFlow({ services = browserStartServices }: StartFlowProps) {
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const { status, retry } = useCatalog(services);
  const [view, setView] = useState<View>({ step: 1, choice: {}, dir: 1, seq: 0 });
  const [travel, setTravel] = useState<Travel | null>(null);
  const [boarding, setBoarding] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const index = status.kind === "ready" ? status.index : null;
  const progress = status.kind === "ready" ? status.progress : null;
  const r = index ? resolve(index, view.choice) : {};
  const hasSections = (r.deck?.sections.length ?? 1) > 0;

  // The latest values for the history listener, which is subscribed once.
  const latest = useRef({ index, view, boarding });
  useLayoutEffect(() => {
    latest.current = { index, view, boarding };
  });

  // History: a reload starts at step 1 (the current entry is overwritten); back and forward restore an entry.
  useEffect(() => {
    const history = services.history();
    if (!history) return;
    history.replace(entryState({ step: 1, choice: {} }));
    return history.listen((state) => {
      const entry = readEntry(state);
      const { index: currentIndex, view: current, boarding: leaving } = latest.current;
      if (!entry || !currentIndex || leaving) return;
      if (entry.step === current.step && sameChoice(entry.choice, current.choice)) return; // our own go()
      if (!canShow(currentIndex, entry.step, entry.choice)) {
        history.replace(entryState({ step: 1, choice: {} }));
        setView((v) => ({ step: 1, choice: {}, dir: -1, seq: v.seq + 1 }));
        return;
      }
      const dir: Direction = entry.step > current.step ? 1 : -1;
      const focusKey = CHOICE_KEYS.find((key) => STEP_OF[key] === entry.step);
      setTravel(null);
      setView((v) => ({ ...entry, dir, focusId: dir < 0 && focusKey ? current.choice[focusKey] : undefined, seq: v.seq + 1 }));
    });
  }, [services]);

  // Focus: the new step's title, or (going back) the card chosen before.
  useEffect(() => {
    if (view.seq === 0) return;
    const panel = mainRef.current?.querySelector(`[data-step="${view.step}"]`);
    const card = view.focusId ? panel?.querySelector<HTMLElement>(`[data-option="${CSS.escape(view.focusId)}"] button`) : null;
    (card ?? panel?.querySelector<HTMLElement>("h2"))?.focus({ preventScroll: true });
  }, [view]);

  /** Moves forward to `step` with `choice`; `source` is the card whose name travels into the pass. */
  function forward(step: Step, choice: Choice, field: PassFieldName, source?: HTMLElement | null) {
    const name = source?.querySelector<HTMLElement>("[data-card-name]");
    const frame = layerRef.current?.offsetParent;
    if (!reduced && name && frame) {
      setTravel({ field, from: lookOf(name, frame) });
      name.style.visibility = "hidden"; // the card is leaving; its name is now the travelling copy
    } else {
      setTravel(null);
    }
    setView((v) => ({ step, choice, dir: 1, seq: v.seq + 1 }));
    services.history()?.push(entryState({ step, choice }));
  }

  /** Goes back to an earlier step, clearing it and every later choice. */
  function backTo(target: Step) {
    const from = view.step;
    if (target >= from || boarding) return;
    const focusKey = CHOICE_KEYS.find((key) => STEP_OF[key] === target);
    setTravel(null);
    setView((v) => ({
      step: target,
      choice: clearFrom(v.choice, target),
      dir: -1,
      focusId: focusKey ? v.choice[focusKey] : undefined,
      seq: v.seq + 1,
    }));
    // Keep the browser history in step: drop the entries of the steps left behind.
    const distance = pathTo(from, hasSections).length - pathTo(target, hasSections).length;
    if (distance > 0) services.history()?.go(-distance);
  }

  const back = () => backTo(previousStep(view.step, hasSections));
  const backRef = useRef(back);
  useLayoutEffect(() => {
    backRef.current = back;
  });

  // Escape goes back a step, like the Back pill.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") backRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function continueLast() {
    if (!index || !progress) return;
    const target = continueTarget(index, progress);
    if (!target) return;
    const choice: Choice = {
      areaId: target.found.area.id,
      platformId: target.found.platform.id,
      deckId: target.found.deck.id,
      sectionId: target.route.sectionId,
      mode: target.mode,
    };
    setTravel(null);
    setView((v) => ({ step: 6, choice, dir: 1, seq: v.seq + 1 }));
    // One history entry per step on the way, so Back and the browser's back button retrace them.
    const history = services.history();
    for (const step of pathTo(6, target.found.deck.sections.length > 0).slice(1)) {
      history?.push(entryState({ step, choice: clearFrom(choice, step) }));
    }
  }

  function startRound() {
    const { deckId, sectionId, mode } = view.choice;
    if (boarding || !deckId || !sectionId || !mode) return;
    savePending({ route: { deckId, sectionId }, mode }, services.sessionStorage());
    setBoarding(true);
    if (reduced) router.push("/play");
  }

  const onUnrolled = useCallback(() => router.push("/play"), [router]);

  // The travelling name: once the pass shows its field, measure where the copy has to land.
  useLayoutEffect(() => {
    if (!travel || travel.to) return;
    const frame = layerRef.current?.offsetParent;
    const target = mainRef.current?.querySelector<HTMLElement>(`[data-trip] [data-pass-value="${travel.field}"]`);
    const box = target && frame ? layoutBox(target, frame) : null;
    // Only a name that keeps its typeface travels; the class becomes Mono on the ready pass and fades in with it.
    if (!target || !box || getComputedStyle(target).fontFamily !== travel.from.fontFamily) {
      setTravel(null);
      return;
    }
    setTravel({ ...travel, to: { left: box.left, top: box.top, height: box.height, fontSize: parseFloat(getComputedStyle(target).fontSize) || 1 } });
  }, [travel]);

  const step = view.step;
  const returning = step === 1 && index && progress ? continueTarget(index, progress) : null;
  const passValues: FillInPassValues = {
    area: r.area?.title,
    platform: r.platform?.title,
    deck: r.deck && r.platform ? { code: r.deck.code, name: `${r.platform.title} ${r.deck.title}` } : undefined,
    section: r.section ? { code: r.section.id, name: r.section.title, whole: r.section.whole } : undefined,
    mode: r.mode?.name,
    cards: r.section?.cardCount,
  };

  return (
    <main ref={mainRef} className="flex min-h-0 flex-1 flex-col" inert={boarding}>
      <SkyBackdrop lowerCloud="start" />

      {/* Top zone, 176 tall: the logo on step 1, the Back pill and the pass from step 2 on (same place). */}
      <header className="relative z-[7] grid h-(--size-start-top-zone) flex-none">
        <AnimatePresence initial={false}>
          {step === 1 ? (
            <motion.div key="brand" className="[grid-area:1/1] pt-9" {...swapMotion(reduced, -12)}>
              <Logo as="h1" />
              <p className={`${TEXT_ROLE.tagline} mt-(--space-14) max-w-[300px]`}>True or false cards that teach you IT, one swipe at a time.</p>
            </motion.div>
          ) : (
            <motion.div key="trip" data-trip="" className="flex flex-col gap-(--space-12) self-start [grid-area:1/1]" {...swapMotion(reduced, 12)}>
              {/* Boarding: the Back pill fades out; on /play the Leave round button takes its place. */}
              <motion.button
                type="button"
                aria-label={`Back to ${BACK_TO[previousStep(step, hasSections)]}`}
                onClick={back}
                animate={{ opacity: boarding ? 0 : 1 }}
                transition={{ duration: 0.11 }}
                className={[
                  "flex h-(--size-pill-small) cursor-pointer items-center gap-(--space-8) self-start rounded-(--radius-pill-small) bg-(--color-surface-raised) pr-(--space-20) pl-(--space-14)",
                  "text-(--color-ink) shadow-(--elevation-small) transition-transform duration-(--duration-t1) ease-(--easing-ease) active:scale-[0.96]",
                  "font-(family-name:--type-button-back-family) text-(length:--type-button-back-size) font-(--type-button-back-weight) leading-(--type-button-back-line-height) tracking-(--type-button-back-letter-spacing)",
                ].join(" ")}
              >
                <BackArrowIcon variant="pill" />
                Back
              </motion.button>
              <FillInPass
                stage={stageOf(step)}
                values={passValues}
                now={NOW_FIELD[step]}
                sectionChoosable={hasSections}
                onJump={(field) => backTo(STEP_OF_FIELD[field])}
                travelling={travel?.field}
                unroll={boarding && !reduced}
                onUnrolled={onUnrolled}
                className={step === 6 ? "mt-(--space-8)" : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main area: the title of the step and its options, one step at a time in the same place. */}
      <section className={`mt-(--space-20) grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] ${returning ? "mb-(--size-foot-gap)" : ""}`}>
        <AnimatePresence initial={false} custom={view.dir}>
          <StepPanel key={step} step={step} dir={view.dir} reduced={reduced}>
            {renderOptions()}
          </StepPanel>
        </AnimatePresence>
      </section>

      {/* Foot zone: where a game's action row sits. The continue line on step 1, Start round on step 6. */}
      <div className="absolute right-(--size-gutter) bottom-[calc(var(--size-safe-bottom)+var(--space-4))] left-(--size-gutter) z-[6] grid h-(--size-pill)">
        <AnimatePresence initial={false}>
          {returning ? (
            <motion.div key="continue" className="[grid-area:1/1]" {...swapMotion(reduced, 12)}>
              <ContinueLine
                deckCode={returning.found.deck.code}
                deckTitle={returning.found.deck.title}
                sectionCode={returning.found.section?.id ?? WHOLE_DECK}
                sectionTitle={returning.found.section?.title ?? "Whole deck"}
                modeLabel={MODE_OPTIONS.find((m) => m.id === returning.mode)?.name ?? returning.mode}
                onContinue={continueLast}
              />
            </motion.div>
          ) : null}
          {step === 6 && !boarding ? (
            <motion.div key="start" className="[grid-area:1/1]" {...swapMotion(reduced, 12)}>
              <PillButton trailingIcon="→" onClick={startRound}>
                Start round
              </PillButton>
            </motion.div>
          ) : null}
          {status.kind === "error" && step === 1 ? (
            <motion.div key="retry" className="[grid-area:1/1]" {...swapMotion(reduced, 12)}>
              <PillButton onClick={retry}>Try again</PillButton>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* The travelling copy of the chosen name, above everything. */}
      <div ref={layerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[9]">
        {travel?.to ? <Ghost travel={travel} to={travel.to} onLanded={() => setTravel(null)} /> : null}
      </div>
    </main>
  );

  function renderOptions(): ReactNode {
    if (step === 1) {
      if (status.kind === "loading") return <LoadingAreas />;
      if (status.kind === "error") return <LoadFailed />;
    }
    if (!index || !progress) return null;
    switch (step) {
      case 1:
        return index.areas.map((area) => {
          const n = deckCount(area);
          return (
            <Option key={area.id} id={area.id}>
              <DestinationCard
                variant="place"
                name={area.title}
                sub={decksLabel(n)}
                label={n === 0 ? `${area.title}, no decks yet` : `${area.title}, ${decksLabel(n)}`}
                unavailable={n === 0}
                onSelect={() => forward(2, { areaId: area.id }, "area", optionEl(area.id))}
              />
            </Option>
          );
        });
      case 2:
        return (r.area?.platforms ?? []).map((platform) => {
          const n = deckCount(platform);
          return (
            <Option key={platform.id} id={platform.id}>
              <DestinationCard
                variant="place"
                name={platform.title}
                sub={decksLabel(n)}
                label={n === 0 ? `${platform.title}, no decks yet` : `${platform.title}, ${decksLabel(n)}`}
                unavailable={n === 0}
                onSelect={() => forward(3, { ...view.choice, platformId: platform.id }, "platform", optionEl(platform.id))}
              />
            </Option>
          );
        });
      case 3:
        return (r.platform?.decks ?? []).map((deck) => {
          const seen = seenPercent(progress, deck);
          const choose = () =>
            deck.sections.length > 0
              ? forward(4, { ...view.choice, deckId: deck.id }, "deck", optionEl(deck.id))
              : forward(5, { ...view.choice, deckId: deck.id, sectionId: WHOLE_DECK }, "deck", optionEl(deck.id));
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
        });
      case 4: {
        const deck = r.deck;
        if (!deck) return null;
        const sections: SectionView[] = [wholeDeck(deck), ...deck.sections.map((s) => ({ ...s, whole: false }))];
        return sections.map((section) => (
          <Option key={section.id} id={section.id}>
            <DestinationCard
              variant="section"
              name={section.whole ? "Whole deck" : section.id}
              code={!section.whole}
              detail={section.whole ? `All ${deck.sections.length} sections` : section.title}
              stub={{ label: "Cards", value: String(section.cardCount) }}
              label={
                section.whole
                  ? `Whole deck, all ${deck.sections.length} sections, ${section.cardCount} cards`
                  : `${section.id}, ${section.title}, ${section.cardCount} cards`
              }
              onSelect={() => forward(5, { ...view.choice, sectionId: section.id }, "section", optionEl(section.id))}
            />
          </Option>
        ));
      }
      case 5:
        return MODE_OPTIONS.map((mode) => {
          const available = AVAILABLE_MODES.includes(mode.id);
          const { deckId, sectionId } = view.choice;
          const best = available && deckId && sectionId ? bestFor(progress, { deckId, sectionId }, mode.id) : null;
          return (
            <Option key={mode.id} id={mode.id}>
              <DestinationCard
                variant="class"
                name={mode.name}
                detail={mode.description}
                sub={available ? undefined : "Not available yet"}
                unavailable={!available}
                stub={best === null ? { label: "Best", value: "–", unit: "not played", muted: true } : { label: "Best", value: String(best), unit: mode.unit }}
                label={
                  !available
                    ? `${mode.name}, not available yet`
                    : `${mode.name}. ${mode.description} ${best === null ? "Not played yet." : `Your best: ${best} ${mode.unit}.`}`
                }
                onSelect={() => forward(6, { ...view.choice, mode: mode.id }, "mode", optionEl(mode.id))}
              />
            </Option>
          );
        });
      case 6:
        return (
          <p className={`${TEXT_ROLE.tagline} max-w-[320px]`}>
            {r.mode?.description} Swipe right for true, left for false.
          </p>
        );
    }
  }

  function optionEl(id: string): HTMLElement | null {
    return mainRef.current?.querySelector<HTMLElement>(`[data-step="${step}"] [data-option="${CSS.escape(id)}"]`) ?? null;
  }
}

// ---------- parts ----------

interface StepPanelProps {
  step: Step;
  dir: Direction;
  reduced: boolean;
  children: ReactNode;
}

/** How the items of the step being rendered move in: the variants (none under reduced motion) and the direction. */
const ItemMotion = createContext<{ variants: Variants | undefined; dir: Direction }>({ variants: undefined, dir: 1 });

/** One step: its title over its options. Leaving, it is inert, so a quick second tap cannot reach it. */
function StepPanel({ step, dir, reduced, children }: StepPanelProps) {
  const present = useIsPresent();
  const item = reduced ? undefined : ITEM;
  return (
    <ItemMotion.Provider value={{ variants: item, dir }}>
      <motion.div
        data-step={step}
        inert={!present}
        className={`flex min-h-0 flex-col [grid-area:1/1] ${step === 6 ? "pt-(--size-ready-offset)" : ""}`}
        variants={reduced ? PANEL_REDUCED : PANEL}
        initial="hidden"
        animate="shown"
        exit="gone"
        custom={dir}
      >
        <motion.h2 tabIndex={-1} className={TEXT_ROLE.title} variants={item} custom={dir}>
          {STEP_TITLE[step]}
        </motion.h2>
        {/* The list scrolls when it is taller than the screen; its margin and padding leave room for the focus ring. */}
        <div className="-mx-(--space-8) mt-(--space-8) min-h-0 flex-1 overflow-y-auto px-(--space-8) pt-(--space-6) pb-(--space-24) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-col gap-(--space-12)">{children}</div>
        </div>
      </motion.div>
    </ItemMotion.Provider>
  );
}

/** One option in a step's list, rising in after the one before it; `id` lets focus come back to it. */
function Option({ id, children }: { id: string; children: ReactNode }) {
  const { variants, dir } = useContext(ItemMotion);
  return (
    <motion.div data-option={id} className="flex-none" variants={variants} custom={dir}>
      {children}
    </motion.div>
  );
}

/** Step 1 while the index loads: three quiet placeholder cards. */
function LoadingAreas() {
  return (
    <>
      <p role="status" className="sr-only">
        Loading the decks
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden="true" data-placeholder="" className="min-h-(--size-card-min) rounded-(--radius-card) bg-(--color-surface-sunk)" />
      ))}
    </>
  );
}

/** Step 1 when the index cannot be loaded and nothing is cached. "Try again" sits in the foot zone. */
function LoadFailed() {
  return (
    <div role="alert" className="rounded-(--radius-card) bg-(--color-surface-raised) p-(--space-20) text-(--color-ink) shadow-(--elevation-small)">
      <p className="m-0 font-(family-name:--type-emphasis-family) text-(length:--type-emphasis-size) font-(--type-emphasis-weight) tracking-(--type-emphasis-letter-spacing)">
        The decks didn&apos;t load
      </p>
      <p className="m-0 mt-(--space-8) font-(family-name:--type-body-family) text-(length:--type-body-size) leading-(--type-body-line-height) font-(--type-body-weight)">
        Check your connection and try again.
      </p>
    </div>
  );
}

/** The copy of a chosen name, flying from its card into its field: left edges and vertical centres meet. */
function Ghost({ travel, to, onLanded }: { travel: Travel; to: NonNullable<Travel["to"]>; onLanded: () => void }) {
  const { from } = travel;
  const scale = to.fontSize / from.fontSize;
  return (
    <motion.span
      className="absolute origin-top-left whitespace-nowrap"
      style={{ ...from.style, left: from.left, top: from.top, lineHeight: `${from.height}px` }}
      initial={{ x: 0, y: 0, scale: 1 }}
      animate={{ x: to.left - from.left, y: to.top + to.height / 2 - from.top - (from.height * scale) / 2, scale }}
      transition={TRAVEL}
      onAnimationComplete={onLanded}
    >
      {from.text}
    </motion.span>
  );
}
```

- [ ] **Step 29: Run the start flow tests and watch them pass**

```bash
pnpm vitest run tests/components/start tests/components/no-raw-colours.test.ts
```

Expected: `Test Files  4 passed (4)` and `Tests  45 passed (45)` (start flow 28, catalog 13, continue line 3, and task 9's raw-colour guard, which now also reads `components/start/`).

- [ ] **Step 30: Commit**

```bash
git add components/start/StartFlow.tsx tests/components/start/StartFlow.test.tsx
git commit -m "feat: add the start flow from area to Start round"
```

- [ ] **Step 30a: Write the failing tests for the last score on the continue line**

Task 6 keeps the score of the last finished round in `Progress.last` (`score` and `total`, both `null` after a round that was left). The approved prototype shows it on the continue line as "last 7 of 10", and `ContinueLine` already renders `lastScore`; nothing passes it yet.

In `tests/components/start/useCatalog.test.tsx`, add this test at the end of `describe("findRoute and continueTarget", ...)`, after "leads Continue to the last route and mode, only while both can be played":

```tsx

  it("brings the score of the last round, and none after a round that was left", () => {
    const last = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" as const, score: 7, total: 10 };
    expect(continueTarget(INDEX, progressWith({ last }))?.lastScore).toEqual({ score: 7, total: 10 });
    expect(continueTarget(INDEX, progressWith({ last: { ...last, score: null, total: null } }))?.lastScore).toBeNull();
  });
```

In `tests/components/start/StartFlow.test.tsx`, add this test to `describe("StartFlow: continue", ...)`, directly before "is not shown when the last route is gone from the index":

```tsx
  it("shows the score of the last round when it was finished", async () => {
    await start(harness(storedProgress({ last: { ...LAST_CLF_SEC, score: 7, total: 10 } })));
    const line = screen.getByRole("button", { name: "Continue: Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10." });
    expect(line.textContent).toBe("Continue where you left offCLF → SEC · Classic · last 7 of 10");
  });

```

- [ ] **Step 30b: Run them and watch them fail**

```bash
pnpm vitest run tests/components/start tests/components/no-raw-colours.test.ts
```

Expected: `Tests  2 failed | 45 passed (47)`: "brings the score of the last round, and none after a round that was left" (`expected undefined to deeply equal { score: 7, total: 10 }`) and "shows the score of the last round when it was finished" (`Unable to find an accessible element with the role "button" and name "Continue: Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10."`).

- [ ] **Step 30c: Pass the last score to the continue line**

In `components/start/useCatalog.ts`, replace `ContinueTarget` and `continueTarget` with:

```ts
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
  if (last === null || !AVAILABLE_MODES.includes(last.mode)) return null;
  const found = findRoute(index, last.route);
  if (!found) return null;
  const lastScore = last.score !== null && last.total !== null ? { score: last.score, total: last.total } : null;
  return { route: last.route, mode: last.mode, found, lastScore };
}
```

In `components/start/StartFlow.tsx`, pass it to the continue line, between `modeLabel` and `onContinue`:

```tsx
                modeLabel={MODE_OPTIONS.find((m) => m.id === returning.mode)?.name ?? returning.mode}
                lastScore={returning.lastScore ?? undefined}
                onContinue={continueLast}
```

- [ ] **Step 30d: Run them and watch them pass**

```bash
pnpm vitest run tests/components/start tests/components/no-raw-colours.test.ts
pnpm typecheck
```

Expected: `Test Files  4 passed (4)` and `Tests  47 passed (47)`; `tsc --noEmit` prints nothing.

- [ ] **Step 30e: Commit**

```bash
git add components/start/useCatalog.ts components/start/StartFlow.tsx tests/components/start/useCatalog.test.tsx tests/components/start/StartFlow.test.tsx
git commit -m "feat: show the last score on the continue line"
```

- [ ] **Step 30f: Write the failing tests for the settle time**

After a step change the next step's cards appear where the chosen card was, so a quick double tap on "Cloud" would choose "AWS" before the player has seen it; likewise "Start round" appears where the continue line was. The play screen ignores input for 250 ms after a card appears (spec section 8, `SWIPE.settleMs`); the start flow does the same after a step becomes current, for its options, the continue line and "Start round". Back, the pass fields and Escape are never held back. The clock comes in through the services seam, so the tests move it by hand.

In `tests/components/start/fixtures.ts`, replace the opening comment with:

```ts
// Test doubles for the start flow: a small deck index, storage in memory, a fake network, a session
// history in memory and a clock moved by hand. Everything goes in through StartFlow's `services` prop.
```

and replace everything from `/** What StartFlow takes as \`services\`` to the end of the file with:

```ts
/** A clock in ms that only moves when a test moves it. */
export interface ManualClock {
  time: number;
}

/** What StartFlow takes as `services` (StartServices), written out so this file does not import the flow. */
export interface TestServices extends AppServices {
  history: () => StepHistory | undefined;
  now: () => number;
}

export interface Harness {
  services: TestServices;
  network: FakeNetwork;
  local: MemoryStorage;
  session: MemoryStorage;
  history: MemoryHistory;
  clock: ManualClock;
}

export function harness(local: MemoryStorage = memoryStorage(), index: unknown = INDEX): Harness {
  const network = fakeNetwork(index);
  const session = memoryStorage();
  const history = memoryHistory();
  const clock: ManualClock = { time: 0 };
  const services: TestServices = {
    fetcher: network.fetcher,
    localStorage: () => local,
    sessionStorage: () => session,
    history: () => history,
    now: () => clock.time,
  };
  return { services, network, local, session, history, clock };
}
```

In `tests/components/start/StartFlow.test.tsx`, the existing tests let the settle time pass before every press that is not Back, as a person does. Add the import after the `PENDING_KEY` import:

```tsx
import { SWIPE } from "@/src/input/swipe";
```

Replace `choose` with:

```tsx
/** Lets the settle time pass: for 250 ms after a step change, presses on its options are ignored. */
function settle() {
  h.clock.time += SWIPE.settleMs;
}

async function choose(name: string | RegExp, nextHeading: string) {
  settle();
  fireEvent.click(screen.getByRole("button", { name }));
  await waitFor(() => expect(heading()).toBe(nextHeading));
}
```

Add a line `settle();` directly before the press of "Start round" in "fills the pass step by step and hands the round to /play" and in "skips the section step for a deck without sections and plays the whole deck" (before `fireEvent.click(screen.getByRole("button", { name: "Start round" }));`), and in "starts the round only once when Start round is pressed twice" (before the first `fireEvent.click(button);`). In "plays the whole path with Tab and Enter only, the step title taking focus after each step", add `settle();` between `await tabTo(option);` and `enter();`, and between `await tabTo(/^Start round/);` and `enter();`.

Append to the end of the file, after one blank line:

```tsx
describe("StartFlow: the settle time", () => {
  // As on the play screen (spec section 8): for 250 ms after a step becomes current, its options, the
  // continue line and Start round ignore presses. The next step's cards appear where the chosen card was.
  it("ignores a second tap 100 ms after a step change, so a double tap cannot choose unseen", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    h.clock.time += 100;
    fireEvent.click(screen.getByRole("button", { name: "AWS, 1 deck" }));
    await act(async () => {});
    expect(heading()).toBe("Choose a platform");
    expect(field("platform")).toBe("Platformnot chosen");
    expect(h.history.position).toBe(1);
  });

  it("takes a press once 250 ms have passed", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    h.clock.time += 249;
    fireEvent.click(screen.getByRole("button", { name: "AWS, 1 deck" }));
    await act(async () => {});
    expect(heading()).toBe("Choose a platform");
    h.clock.time += 1;
    fireEvent.click(screen.getByRole("button", { name: "AWS, 1 deck" }));
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
  });

  it("holds back Enter on the keyboard in the same way", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    const aws = screen.getByRole("button", { name: "AWS, 1 deck" });
    aws.focus();
    h.clock.time += 100;
    fireEvent.keyDown(aws, { key: "Enter" });
    fireEvent.click(aws); // Enter on a button activates it, as browsers do
    await act(async () => {});
    expect(heading()).toBe("Choose a platform");
    h.clock.time += 150;
    fireEvent.keyDown(aws, { key: "Enter" });
    fireEvent.click(aws);
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
  });

  it("holds back Start round right after the continue line has filled the pass", async () => {
    await start(harness(storedProgress({ last: LAST_CLF_SEC })));
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
    h.clock.time += 100;
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(h.session.data.get(PENDING_KEY)).toBeUndefined();
    h.clock.time += 150;
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(JSON.parse(h.session.data.get(PENDING_KEY) ?? "null")).toEqual({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" });
  });

  it("holds back the continue line right after going back to step 1", async () => {
    await start(harness(storedProgress({ last: LAST_CLF_SEC })));
    await choose("Cloud, 2 decks", "Choose a platform");
    fireEvent.click(screen.getByRole("button", { name: "Back to areas" }));
    await waitFor(() => expect(heading()).toBe("Choose an area"));
    h.clock.time += 100;
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    await act(async () => {});
    expect(heading()).toBe("Choose an area");
    h.clock.time += 150;
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
  });

  it("never holds back Back, the pass fields or Escape", async () => {
    await start();
    await toClasses();
    fireEvent.click(screen.getByRole("button", { name: "Back to sections" }));
    await waitFor(() => expect(heading()).toBe("Choose a section"));
    fireEvent.click(screen.getByRole("button", { name: "Change platform, now AWS" }));
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(heading()).toBe("Choose an area"));
  });
});
```

The first render starts no settle time, so step 1 (and the continue line on it) takes a press as soon as its cards are there.

- [ ] **Step 30g: Run them and watch them fail**

```bash
pnpm vitest run tests/components/start tests/components/no-raw-colours.test.ts
```

Expected: `Test Files  1 failed | 3 passed (4)` and `Tests  5 failed | 48 passed (53)`. The five failures are the first five tests of "StartFlow: the settle time" (the press 100 ms or 249 ms after the step change goes through: `expected 'Choose a deck' to be 'Choose a platform'` three times, `expected '{"route":{"deckId":"aws-clf-c02","sec…' to be undefined` and `expected 'Your pass is ready' to be 'Choose an area'`); "never holds back Back, the pass fields or Escape" already passes and keeps it that way. Every earlier test still passes: the clock only moves when a test moves it.

- [ ] **Step 30h: Hold presses back while a step settles**

In `components/start/StartFlow.tsx`, add to the "Where things live" header comment, after the `useCatalog` line:

```tsx
//   - the settle time: for 250 ms after a step becomes current, presses on its options, the continue
//     line and Start round are ignored (the next step's cards appear where the chosen card was);
```

Import the settle time after the `@/src/engine/round` import:

```tsx
import { SWIPE } from "@/src/input/swipe";
```

The services gain a clock:

```tsx
export interface StartServices extends AppServices {
  /** The browser history the flow keeps its steps in. Undefined: steps are not remembered (server, tests). */
  history: () => StepHistory | undefined;
  /** A clock in ms for the settle time. In the browser: performance.now. */
  now: () => number;
}

export const browserStartServices: StartServices = { ...browserAppServices, history: browserStepHistory, now: () => performance.now() };
```

In `StartFlow`, directly before the comment `// Focus: the new step's title, or (going back) the card chosen before.`, add:

```tsx
  // The settle time, as on the play screen (spec section 8): a step change starts it. The first render
  // starts none, so step 1 takes a press as soon as its cards are there.
  const shownAt = useRef(Number.NEGATIVE_INFINITY);
  useLayoutEffect(() => {
    if (view.seq > 0) shownAt.current = services.now();
  }, [view.seq, services]);
  const settled = () => services.now() - shownAt.current >= SWIPE.settleMs;

```

Then guard the three presses. `forward` (every option card) starts with:

```tsx
  function forward(step: Step, choice: Choice, field: PassFieldName, source?: HTMLElement | null) {
    if (!settled()) return;
```

`continueLast` starts with:

```tsx
  function continueLast() {
    if (!index || !progress || !settled()) return;
```

and the first line of `startRound` after the destructuring becomes:

```tsx
    if (boarding || !deckId || !sectionId || !mode || !settled()) return;
```

`backTo` stays unguarded; its comment becomes `/** Goes back to an earlier step, clearing it and every later choice. Never held back by the settle time. */`. The layout effect runs in the same commit as the step change, so a second press in the same tap sequence already sees the new time.

- [ ] **Step 30i: Run them and watch them pass**

```bash
pnpm vitest run tests/components/start tests/components/no-raw-colours.test.ts
pnpm typecheck
```

Expected: `Test Files  4 passed (4)` and `Tests  53 passed (53)` (start flow 35, catalog 14, continue line 3, raw-colour guard 1); `tsc --noEmit` prints nothing.

- [ ] **Step 30j: Commit**

```bash
git add components/start/StartFlow.tsx tests/components/start/StartFlow.test.tsx tests/components/start/fixtures.ts
git commit -m "feat: ignore start flow presses while a new step settles"
```

- [ ] **Step 31: Rewrite the home page test for the start flow**

Task 1's `tests/app/page.test.tsx` tested the placeholder. Replace it: the page must stay a server component and render the start flow with the browser's own services (here a stubbed `fetch`), the game name still the only `h1`.

```tsx
// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { INDEX } from "../components/start/fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("home page", () => {
  it("is a server component: the start flow is the client part", () => {
    expect(readFileSync("app/page.tsx", "utf8")).not.toContain("use client");
  });

  it("shows the start flow with the browser's own services, the game name as the only top-level heading", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => INDEX }));
    vi.stubGlobal("fetch", fetch);
    render(<Home />);
    expect(await screen.findByRole("button", { name: "Cloud, 2 decks" })).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/decks/index.json");
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toBe("Truthy");
    expect(screen.getByRole("main").textContent).toContain("Choose an area");
  });
});
```

Run it against the placeholder page:

```bash
pnpm vitest run tests/app/page.test.tsx
```

Expected: `Tests  1 failed | 1 passed (2)`; the failure is `TestingLibraryElementError: Unable to find role="button" and name "Cloud, 2 decks"`.

- [ ] **Step 32: Render the start flow on the home page**

Replace `app/page.tsx`:

```tsx
import { StartFlow } from "@/components/start/StartFlow";

// A server component that renders the client-side start flow. Everything it needs is read on the device.
export default function Home() {
  return <StartFlow />;
}
```

Run the page test, then every gate:

```bash
pnpm vitest run tests/app/page.test.tsx
pnpm test
pnpm typecheck
pnpm build
```

Expected: `Tests  2 passed (2)` for the page; every test file passes; `tsc --noEmit` prints nothing; the build lists `/` and `/_not-found` as static.

- [ ] **Step 33: Commit**

```bash
git add app/page.tsx tests/app/page.test.tsx
git commit -m "feat: render the start flow on the home page"
```

- [ ] **Step 34: Compare with the mockup**

Create `task10-shoot.mjs` in the repository root (temporary, never committed). It seeds a returning player (81 of 214 CLF cards seen, a Classic best of 9 on CLF / SEC, last route CLF / SEC Classic with 7 of 10), walks the mockup's path and photographs every settled step. With `motion` as argument it plays the real motion and waits for it to settle.

```js
// TEMPORARY: screenshots of the start flow at 390 by 844 (scale 2, like design/flow/shots), never committed.
import { chromium } from "@playwright/test";

const base = "http://localhost:3100";
const motion = process.argv[2] === "motion";
const seen = Object.fromEntries(
  Array.from({ length: 81 }, (_, i) => [`aws-clf-c02-seen-${i}`, { seen: 1, lastCorrect: true, lastSeenAt: 1 }]),
);
const progress = JSON.stringify({
  version: 1,
  cards: seen,
  records: { "aws-clf-c02/SEC#classic": 9 },
  last: { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: 7, total: 10 },
});

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  reducedMotion: motion ? "no-preference" : "reduce",
});
await page.addInitScript((value) => localStorage.setItem("truthy.progress.v1", value), progress);
await page.goto(`${base}/`);
await page.evaluate(() => document.fonts.ready);
const tag = motion ? "-motion" : "";
const shoot = async (n) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `test-results/task10-start-${n}${tag}.png` });
  console.log(`wrote test-results/task10-start-${n}${tag}.png`);
};
await page.getByRole("button", { name: "Cloud, 2 decks" }).waitFor();
await shoot(1);
await page.getByRole("button", { name: "Cloud, 2 decks" }).click();
await shoot(2);
await page.getByRole("button", { name: "AWS, 1 deck" }).click();
await shoot(3);
await page.getByRole("button", { name: /^CLF, Cloud Practitioner/ }).click();
await shoot(4);
await page.getByRole("button", { name: /^SEC, Security and compliance/ }).click();
await shoot(5);
await page.getByRole("button", { name: /^Classic\./ }).click();
await shoot(6);
await browser.close();
```

Create `task10-check.mjs` next to it (temporary, never committed): browser back and forward inside the flow, keyboard only up to the hand-off, and reduced motion.

```js
// TEMPORARY: the start flow in a real browser, never committed. Browser back and forward inside the flow,
// keyboard only up to the hand-off to /play, and reduced motion. (/play itself arrives with task 11.)
// Every press waits for the step to settle: the flow ignores presses for 250 ms after a step change.
import { chromium } from "@playwright/test";

const base = "http://localhost:3100";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
const title = () => page.locator("[data-step]:not([inert]) h2").textContent();
const settle = () => page.waitForTimeout(600);

await page.goto(`${base}/`);
await page.getByRole("button", { name: "Cloud, 2 decks" }).click();
await settle();
await page.getByRole("button", { name: "AWS, 1 deck" }).click();
await settle();
await page.getByRole("button", { name: /^CLF/ }).click();
await settle();
console.log("1. chosen:", await title(), page.url());
await page.goBack();
await settle();
console.log("2. browser back:", await title(), page.url());
await page.goForward();
await settle();
console.log("3. browser forward:", await title());
await page.getByRole("button", { name: "Back to decks" }).click();
await settle();
await page.goBack();
await settle();
console.log("4. Back pill, then browser back:", await title());

await page.goto(`${base}/`);
await page.getByRole("button", { name: "Cloud, 2 decks" }).waitFor();
for (const want of ["Cloud, 2 decks", "AWS, 1 deck", "CLF,", "SEC,", "Classic.", "Start round"]) {
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "");
    if (name.startsWith(want)) break;
  }
  await page.keyboard.press("Enter");
  await settle();
}
await page.waitForURL("**/play");
console.log("5. keyboard only:", page.url(), await page.evaluate(() => sessionStorage.getItem("truthy.pending.v1")));
await page.close();

const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await reduced.addInitScript(() =>
  localStorage.setItem(
    "truthy.progress.v1",
    JSON.stringify({ version: 1, cards: {}, records: {}, last: { route: { deckId: "gcp-cdl", sectionId: "ALL" }, mode: "classic" } }),
  ),
);
await reduced.goto(`${base}/`);
await reduced.getByRole("button", { name: /^Continue/ }).click();
await reduced.waitForTimeout(300);
const started = Date.now();
await reduced.getByRole("button", { name: "Start round" }).click();
await reduced.waitForURL("**/play");
console.log("6. reduced motion, Continue then Start round:", Date.now() - started < 200 ? "at once" : "after a delay");
await browser.close();
```

Build, serve, photograph, check, stop the server:

```bash
pnpm build
pnpm start --port 3100 &
sleep 3
node task10-shoot.mjs
node task10-shoot.mjs motion
node task10-check.mjs
kill %1
```

Expected from the shoot runs: `wrote test-results/task10-start-1.png` to `...-6.png` and `...-1-motion.png` to `...-6-motion.png` (780 by 1688 pixels, like the mockup shots). Expected from the check (the last navigation lands on the 404 page, because `/play` arrives with task 11):

```
1. chosen: Choose a section http://localhost:3100/
2. browser back: Choose a deck http://localhost:3100/
3. browser forward: Choose a section
4. Back pill, then browser back: Choose a platform
5. keyboard only: http://localhost:3100/play {"route":{"deckId":"aws-clf-c02","sectionId":"SEC"},"mode":"classic"}
6. reduced motion, Continue then Start round: at once
```

The `-motion` shots must equal the reduced-motion shots pixel for pixel (no travelling copy or half-faded item is left behind). Then open each pair side by side and READ both:

| Ours | Mockup | Must match |
|---|---|---|
| `test-results/task10-start-1.png` | `design/flow/shots/start-1.png` | Logo mark at x 32, "Truthy" ExtraBold 36 with its centre near y 215; tagline lines near y 302 and 350, wrapping after "IT,"; "Choose an area" at y 530; Cloud card y 596 to 804 with the stub perforation at x 620 and notches top and bottom, chevron at x 685; Frontend y 828 to 1036; DevOps sunk y 1060 to 1232, no stub, name in ink-muted; continue line disc at x 40 to 128 near y 1552, "Continue where you left off" ExtraBold 16, route line in Mono 12 ink-muted, chevron at x 708. |
| `...-2.png` | `start-2.png` | Back pill x 32 to 220, y 104 to 200, arrow then "Back"; compact amber band y 224 to 284 with the dark mark, "Truthy" and "YOUR PASS"; Area / Platform / Deck cells with dividers at x 270 and 550; "Cloud" in Area, dark dashes under the ink "Platform" label, light dashes under Deck; pass bottom at y 396; AWS, Google Cloud cards and Azure sunk at the same y as step 1's cards. |
| `...-3.png` | `start-3.png` | Deck card y 596 to 852, stub 160 wide (perforation at x 588) with "Cards", "214" and the chevron; "CLF" Mono 30, "Cloud Practitioner" 16, the track with the ink line and amber dot ending near x 114, "38% seen" with 38% in ink. |
| `...-4.png` | `start-4.png` | The quiet line "Cloud · AWS" at y 321, Deck / Section / Class below with dividers at x 230 and 468, "CLF" in Mono; Whole deck card first (y 596 to 776), then CON, SEC, TEC, BIL, each 180 tall with 24 between. |
| `...-5.png` | `start-5.png` | "SEC" in Section, dark dashes under "Class"; the Classic card y 596 to 812 with "Best / 9 / of 10" in the stub. |
| `...-6.png` | `start-6.png` | Back pill unchanged; the ticket pass x 32 to 748, y 240 to 660 (css 120 to 330) with its soft shadow; band 88 tall with the cloud, "Truthy" and "BOARDING PASS"; CLF and SEC Mono 34 at the same height; Class / Cards / Gate grid y 520 to 622, "Classic", "47", "F ← → T"; "Your pass is ready" at y 752; the reminder lines near y 838 and 886; "Start round →" ink pill y 1492 to 1612. |

Also check by hand at `http://localhost:3100/` before stopping the server: with motion on, the chosen name flies into its field and the next cards rise in one after the other; Back reverses the movement; a filled field of the pass returns to its step; Tab shows the 2 px ink ring on every card, the Back pill and the pass fields (never amber); after "Start round" the paper grows down to y 728 before the page changes.

Measured in the spike (grey difference over 40 of 255, whole picture): step 1 1.07 percent, step 2 0.52, step 3 0.85, step 4 0.25, step 5 3.31, step 6 1.35; motion against reduced motion 0 for all six. What still differs, and why:
- Step 1: the tagline is ink, the mockup's ink-muted (product owner decision, contrast). Cloud reads "2 decks" (the index has CLF and CDL; SAA ships in step 3). The continue line's route line ("CLF → SEC · Classic · last 7 of 10", as in the mockup) sits about 20 px further right after the arrow, which is wider (see the arrows below).
- Step 3: only the CLF card; SAA is not in the index yet.
- Step 5: Streak, Three lives and Timed are sunk, single-column "Not available yet" cards (spec, step 1 ships Classic only); the mockup shows them as playable with bests.
- Step 6: "AWS Cloud Practitioner" fits on one line (the mockup forces a break after "Cloud"); the reminder is ink; the pass ends 1 css px higher (fixed line heights of the type roles).
- The arrows "→" and "←" (continue line, Gate, "Start round →") are wider and thinner: neither Overpass nor Overpass Mono has them, and next/font's fallback face catches them (task 9's layout; task 11 records the same).
- The Back label and other 48-tall labels sit about 1 px higher (the roles fix line height 1.27 where the mockup leaves `normal`), as accepted in task 9.
- Mid-transition frames are simpler than the mockup: values already on the pass do not travel when the pass changes layout (steps 3 to 4 and 5 to 6 swap the block at once), a cleared value disappears instead of flying back to its card, and the class name does not travel into the ready pass (its typeface changes to Mono; it appears with the pass).

Delete the temporary files and confirm the gates:

```bash
rm task10-shoot.mjs task10-check.mjs
pnpm test
pnpm typecheck
pnpm build
git status --short
```

Expected: all tests pass, `tsc --noEmit` prints nothing, the build lists `/` and `/_not-found` as static, and `git status --short` prints nothing.

#### Notes for later tasks (verified in the spike)

- **Play screen (task 11).** The pending round is in `sessionStorage` under `PENDING_KEY` (written with `savePending`), then `router.push("/play")`. The ready pass is 358 by 210 at y 120 and unrolls to y 728; task 11's loading placeholder and ticket sit at x 16, y 120, 358 by about 607 (measured in the spike), so `/play` reads as a continuation. Keep task 11's header and stage geometry; do not move the ticket.
- **One services seam (later, not in step 1).** Task 11, as written in this plan, keeps its own `PlayServices` type and a private `browserSessionStorage` in `components/play/useRound.ts` and does not import `src/app-state/services.ts`. A later step can unify them: `export interface PlayServices extends AppServices { now: () => number; randomSeed: () => number }` and `browserPlayServices = { ...browserAppServices, now: () => Date.now(), randomSeed: ... }`, deleting task 11's private `browserSessionStorage`. The only widening is `sessionStorage` returning `getItem` and `setItem` (task 11's fixtures already provide both).
- **Result screen (task 12).** "Choose another route" and the close button go home with `router.replace("/")`; the flow then starts at step 1 (the mount overwrites the history entry). Opening step 6 with the pass filled (design system open question 7) would need an initial-choice prop on `StartFlow`; it is not built.
- **End-to-end (task 13).** Use the accessible names listed under Produces. The current step title is `page.locator("[data-step]:not([inert]) h2")`. With `reducedMotion: "reduce"` Start round navigates at once; with motion it waits for the 360 ms unroll. Headless Chromium on a Mac with "Reduce motion" on reports reduce; pass `reducedMotion: "no-preference"` to see the movement. The browser's back button steps back inside the flow; it leaves `/` only from step 1.
- **Settle time (task 13).** For 250 ms after a step change the start flow ignores presses on the options, the continue line and "Start round" (steps 30f to 30j); Back, the pass fields and Escape are never held back. A spec that presses an option or "Start round" right after a step change must first wait for the step title and then a little over 250 ms.

#### Review focus candidates

Conditions the spec implies, that a person could hit, and that the first draft of the tests did not cover. Each now has a test:

1. A player presses the browser's back button after a deploy that removed a platform or deck they had open before reloading: the remembered history entry names a route the index no longer has, and the flow would show an empty step with a heading and no cards (spec section 9: back works at every step; section 10: nothing is thrown at the player). Covered by "goes to step 1 when the browser steps back to a route the index no longer has" in `tests/components/start/StartFlow.test.tsx`, steps 26 to 29.
2. A returning player whose last round was a whole Google Cloud deck (no sections) presses Continue and then Back twice: Back must go from the ready pass to the class step and then straight to the deck step, and the browser history must hold no entry for a section step that never existed, or the browser's back button would land on an empty section step (spec section 9: a deck without sections skips the section step; Back works at every step). Covered by "retraces a whole-deck route of a deck without sections without a section step", steps 26 to 29.
3. The deck card's seen share counts history entries by card id prefix: a deck whose id is a prefix of another deck's ids ("aws-clf-c02" and a future "aws-clf-c02x") would borrow its history, and one card seen out of hundreds would round to 0 and read "Not started" (spec section 7: the share of the deck's current cards seen at least once). Covered by "counts history entries whose id starts with the deck id and a dash" and "never reads 0 once a card is seen, and never more than 100" in `tests/components/start/useCatalog.test.tsx`, steps 6 to 9.
4. A player double taps a destination card: the first tap chooses it and the next step's first card appears in the same place, so the second tap chooses that card unseen (spec section 8 sets a 250 ms settle time against exactly this on the play screen). The same happens with the continue line and "Start round", which share the foot zone. Covered by the "StartFlow: the settle time" tests in `tests/components/start/StartFlow.test.tsx`, steps 30f to 30j, and end to end by "a double tap on an area does not choose a platform" in task 13's `e2e/double-tap.spec.ts`.
