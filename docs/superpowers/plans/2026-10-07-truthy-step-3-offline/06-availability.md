### Task 6: Which decks can be played offline

Offline, the start flow offers only the decks the device holds a copy of (offline spec section 8). This task adds the pure rule (`src/offline/availability.ts`), the online state as a hook (`components/useOnline.ts`), the dimmed deck card and the unavailable continue line with the copy "Needs a connection", and their entries in the design system (spec section 12, second bullet). Areas, platforms, the section step and the class step do not change. Nothing here touches the service worker: the labels work in any browser that reports `navigator.onLine`, with or without a worker.

Its end-to-end spec is the first of step 3 that goes offline, so this task also creates the one way every offline spec goes offline, in both engines (check C2, offline spec section 14): a proxy of the test's own in front of the production server that drops every connection (`e2e/proxy.ts`), and a Playwright fixture with the steps that use it (`e2e/offline.ts`: `test`, `goOffline`, `goOnline`, and `waitForWorker` and `workerState`, which tasks 7 and 8 use). No spec of step 3 calls `context.setOffline`.

This task builds on task 4: `AppServices` has `offline`, and `tests/components/start/fixtures.ts` passes `noOfflineClient`, which the new tests get through `harness()` without a change. Task 4's guard (`tests/offline/boundaries.test.ts`) also reads the new `src/offline/availability.ts`.

**Files:**
- Create: `src/offline/availability.ts`, `components/useOnline.ts`, `e2e/proxy.ts`, `e2e/offline.ts`, `e2e/offline-labels.spec.ts`
- Modify: `components/DestinationCard.tsx`, `components/start/ContinueLine.tsx`, `components/start/StartFlow.tsx`, `design/system/DESIGN-SYSTEM.md` (sections 2.2, 5.3 and 5.4a), `docs/testing.md` (a section "Offline and updates")
- Test: create `tests/offline/availability.test.ts`, `tests/components/useOnline.test.tsx`, `tests/components/start/offline.test.tsx`, `tests/e2e/proxy.test.ts`; modify `tests/components/DestinationCard.test.tsx`, `tests/components/start/ContinueLine.test.tsx`

**Interfaces:**
- Consumes:
  - `playwright.config.ts`: task 1's `use.serviceWorkers = "block"`, and the export `e2ePort(value)` it has had since before step 3, which the fixture uses to find the production server.
  - `src/content/load.ts`: `DeckCache` (`read(deckId): DeckFile | null`, any hash, null for a missing or invalid copy), `createDeckCache(storage)`, `deckCacheKey(id)`, `INDEX_CACHE_KEY`.
  - `components/start/StartFlow.tsx` as it is: `useCatalog(services)` (the index from the network or from `truthy.index.v1`), `continueTarget(index, progress)`, `continueLast()`, the deck step (`case 3`), `Option`, `services.localStorage()`.
  - `components/DestinationCard.tsx`: `DestinationCardProps`, the `unavailable` variant, `STUB_LABEL`, `MIN_HEIGHT`, `STUB_WIDTH`, `notchedCard`, `PERFORATION`.
  - `components/start/ContinueLine.tsx`: `ContinueLineProps`, `continueLabel`.
  - `tests/components/start/fixtures.ts`: `INDEX` (CLF on AWS, CDL on Google Cloud, one deck per platform), `harness(local)`, `memoryStorage`.
  - `e2e/helpers.ts`: `CLF_ID`, `CLF_SECURITY`, `CONTINUE_CLF_SECURITY`, `SETTLE_MS`, `atHome`, `atStep`, `openHome`.
- Produces:

```ts
// src/offline/availability.ts
export function availableDeckIds(deckIds: readonly string[], online: boolean, cache: DeckCache): ReadonlySet<string>;

// components/useOnline.ts
export function useOnline(): boolean;

// components/DestinationCard.tsx
export interface DestinationCardProps { /* as today */ dimmedReason?: string }

// components/start/ContinueLine.tsx
export interface ContinueLineProps { /* as today */ needsConnection?: boolean }

// e2e/proxy.ts (Node only, no Playwright)
export interface Proxy {
  readonly url: string;                       // http://localhost:<free port>
  setOffline(offline: boolean): void;         // offline: drops every open and every new connection
  release(from: string, to: string): void;    // sw.js served with every `from` replaced by `to` (task 8's update spec)
  close(): Promise<void>;
}
export function startProxy(upstream: string): Promise<Proxy>;

// e2e/offline.ts
export const test;   // @playwright/test's test plus the fixture `net: Proxy`; baseURL is net.url; every page gets the onLine switch
export function goOffline(page: Page, net: Proxy): Promise<void>;
export function goOnline(page: Page, net: Proxy): Promise<void>;
export interface WorkerState { controlled: boolean; waiting: boolean; caches: string[] }
export function workerState(page: Page): Promise<WorkerState | null>;
export function waitForWorker(page: Page): Promise<string>;   // the first worker's version, once it controls the page
```

  - Accessible names and copy the e2e specs of tasks 7 and 8 use: an unavailable deck card is a group named `` `${code}, ${title}, needs a connection` `` ("SAA, Solutions Architect Associate, needs a connection") with the visible text "Needs a connection"; the unavailable continue line is a group named "Continue: {deck pass name}, {section title}, {class}, needs a connection." with the mono line "{code} → {section} · {class} · Needs a connection". Neither is a button.

**Rules:**

1. `availableDeckIds(ids, online, cache)`: online, every id, and the cache is not read. Offline, the ids with `cache.read(id) !== null`: a valid copy of any hash, the rule `loadDeck` follows when its fetch fails (spec section 8). `src/offline/availability.ts` imports only `@/src/content/load` (no React, no components).
2. `useOnline()`: `navigator.onLine`, read through `useSyncExternalStore` with the window's `online` and `offline` events; `true` on the server and while hydrating (the prerendered page is the online one). A client render after mount reads the real value at once, so coming back to `/` offline never shows the decks as available for a frame.
3. `StartFlow` computes `available` once per index, online state and services (`useMemo`), from every deck id of the index and `createDeckCache(services.localStorage())`. When the network comes or goes, `useOnline` changes and the labels follow without a reload.
4. **The deck step.** A deck not in `available` is drawn by `DestinationCard` with `dimmedReason="Needs a connection"`, `seenPercent` as today, no `stub`, no `onSelect`, and the label `` `${deck.code}, ${deck.title}, needs a connection` ``. The dimmed card is the deck card's shape and height (128) with its main column (code, title, status row), in `surface-sunk` with the same notches and perforation, no shadow, all text ink-muted (the seen share too), and the stub showing only the reason in `field-label`, centred (two lines: "Needs a" / "connection"). It is a group with `aria-disabled="true"` and `data-dimmed`, not a button; a tap does nothing. Focus coming back to it (Back from step 4) finds no button in the option and falls back to the step title, as for the existing unavailable cards.
5. **The continue line.** `needsConnection={!available.has(returning.found.deck.id)}`. With it, the line is a group (`aria-disabled="true"`, `data-unavailable`) with the same row classes and size, text ink-muted, no chevron and no pressed state; the third part of the mono line is "Needs a connection" (`data-continue="reason"`, Mono 600 ink) in place of the last score; the name is "Continue: …, {class}, needs a connection.". `continueLast()` also returns early when the target's deck is not available.
6. Unchanged: areas and platforms with their counts, the section and class steps, the ready step, Start round, the load failure with Try again (no cached index at all). A history entry restored by the browser's forward button that shows step 4 to 6 of a deck that became unavailable is not checked: Start round then opens `/play`, which shows the existing load failure (spec section 10, the stored round row; task 7 pins it).
7. Design system: the "Needs a connection" deck card in 5.3, the unavailable continue line in 5.4a, and the two contrast rows of 2.2 that now also cover them. These are the only entries for the two states; task 8 adds one screen reader line in section 8 and updates the main spec, and does not describe the states again.
8. **One way of going offline in the end-to-end specs** (check C2, offline spec section 14). `goOffline(page, net)` makes the test's proxy drop every connection, makes `navigator.onLine` read false (an init script reads a flag in local storage), sends `offline`, and then checks that a request of the page fails, so a spec never passes for the wrong reason; `goOnline` undoes all of it without a reload. `net.setOffline(true)` alone is a network that is gone while the browser still says it is online. The labels spec keeps service workers blocked (task 1's default): it tests the labels, not the worker. Tasks 7 and 8 use the same kit with workers allowed.

**Steps:**

- [ ] **Step 1: Write the tests.**

Create `tests/offline/availability.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { availableDeckIds } from "@/src/offline/availability";
import { createDeckCache, deckCacheKey, type DeckCache } from "@/src/content/load";
import type { DeckFile } from "@/src/content/schema";

/** A valid deck file of one card. */
function deckFile(id: string, hash: string): DeckFile {
  return {
    id,
    hash,
    cards: [
      {
        id: `${id}-1`,
        section: "SEC",
        text: { en: { statement: "A statement", explanation: "An explanation" } },
        answer: true,
        source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
        difficulty: 1,
        appliesTo: "",
        conflictGroups: [],
      },
    ],
  };
}

/** Storage in memory holding these deck files under truthy.deck.<id>, plus any raw entries. */
function cacheWith(decks: readonly DeckFile[], raw: Record<string, string> = {}): DeckCache {
  const data = new Map<string, string>(Object.entries(raw));
  for (const deck of decks) data.set(deckCacheKey(deck.id), JSON.stringify(deck));
  return createDeckCache({ getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) });
}

const IDS = ["aws-clf-c02", "aws-saa-c03", "gcp-cdl"] as const;

describe("availableDeckIds", () => {
  it("offers every deck online, without reading the cache", () => {
    let reads = 0;
    const cache: DeckCache = {
      read: () => {
        reads += 1;
        return null;
      },
      write: () => {},
    };
    expect([...availableDeckIds(IDS, true, cache)]).toEqual([...IDS]);
    expect(reads).toBe(0);
  });

  it("offers offline only the decks the device holds a copy of", () => {
    const cache = cacheWith([deckFile("aws-clf-c02", "clf-1"), deckFile("gcp-cdl", "cdl-1")]);
    const available = availableDeckIds(IDS, false, cache);
    expect(available.has("aws-clf-c02")).toBe(true);
    expect(available.has("gcp-cdl")).toBe(true);
    expect(available.has("aws-saa-c03")).toBe(false);
    expect(available.size).toBe(2);
  });

  it("counts a copy of any hash, the rule loadDeck follows when its fetch fails", () => {
    const cache = cacheWith([deckFile("aws-clf-c02", "an-older-hash")]);
    expect(availableDeckIds(["aws-clf-c02"], false, cache).has("aws-clf-c02")).toBe(true);
  });

  it("does not count a copy that is not a valid deck file, or one stored for another deck", () => {
    const cache = cacheWith([], {
      [deckCacheKey("aws-clf-c02")]: "{not json",
      [deckCacheKey("gcp-cdl")]: JSON.stringify(deckFile("aws-saa-c03", "saa-1")),
    });
    expect(availableDeckIds(IDS, false, cache).size).toBe(0);
  });

  it("offers nothing offline with no storage at all", () => {
    expect(availableDeckIds(IDS, false, createDeckCache(undefined)).size).toBe(0);
  });

  it("stays free of React and the components (src/offline is shared with the service worker)", () => {
    const source = readFileSync("src/offline/availability.ts", "utf8");
    const imports = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]);
    expect(imports).toEqual(["@/src/content/load"]);
  });
});
```

Create `tests/components/useOnline.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { useOnline } from "@/components/useOnline";

/** Sets navigator.onLine and, like the browser, fires "online" or "offline" on the window. */
function goOnline(online: boolean, fire = true) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => online });
  if (fire) window.dispatchEvent(new Event(online ? "online" : "offline"));
}

afterEach(() => {
  cleanup();
  // Back to jsdom's own getter on Navigator.prototype.
  delete (window.navigator as { onLine?: boolean }).onLine;
});

function Probe() {
  return <span>{useOnline() ? "online" : "offline"}</span>;
}

describe("useOnline", () => {
  it("reads navigator.onLine", () => {
    goOnline(false, false);
    expect(renderHook(() => useOnline()).result.current).toBe(false);
  });

  it("follows the online and offline events", () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    act(() => goOnline(false));
    expect(result.current).toBe(false);
    act(() => goOnline(true));
    expect(result.current).toBe(true);
  });

  it("stops listening once unmounted", () => {
    const { result, unmount } = renderHook(() => useOnline());
    unmount();
    act(() => goOnline(false));
    expect(result.current).toBe(true);
  });

  it("is online on the server, so the prerendered page is the online one", () => {
    goOnline(false, false);
    expect(renderToString(<Probe />)).toBe("<span>online</span>");
  });
});
```

In `tests/components/DestinationCard.test.tsx`, insert before `it("can hide its name while a copy of it travels into the pass", ...)`:

```tsx
  it("draws a deck that cannot be played now dimmed: a labelled, disabled group with the reason in the stub", () => {
    const onSelect = vi.fn();
    render(
      <DestinationCard
        variant="deck"
        name="SAA"
        code
        detail="Solutions Architect Associate"
        seenPercent={0}
        stub={{ label: "Cards", value: "248" }}
        dimmedReason="Needs a connection"
        label="SAA, Solutions Architect Associate, needs a connection"
        onSelect={onSelect}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    const group = screen.getByRole("group", { name: "SAA, Solutions Architect Associate, needs a connection" });
    expect(group.getAttribute("aria-disabled")).toBe("true");
    expect(group.hasAttribute("data-dimmed")).toBe(true);
    // The reason takes the place of the count: no "Cards", no number, no chevron.
    expect(group.textContent).toBe("SAASolutions Architect AssociateNot startedNeeds a connection");
    expect(group.querySelector("[data-stub-reason]")?.textContent).toBe("Needs a connection");
    expect(group.querySelectorAll("svg")).toHaveLength(0);
    fireEvent.click(group);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps a dimmed deck card the size and shape of a deck card, in sunk paper and muted ink without a shadow", () => {
    render(<DestinationCard variant="deck" name="SAA" code detail="Solutions Architect Associate" seenPercent={0} dimmedReason="Needs a connection" label="SAA" />);
    const group = screen.getByRole("group", { name: "SAA" });
    expect(group.className).toContain("min-h-(--size-card-min-deck)");
    expect(group.className).toContain("text-(--color-ink-muted)");
    expect(group.className).not.toContain("shadow-");
    expect(group.style.gridTemplateColumns).toBe("minmax(0, 1fr) var(--size-card-stub-deck)");
    expect(group.style.background).toContain("var(--color-surface-sunk)");
    expect(group.style.background).not.toContain("var(--color-surface-raised)");
  });

  it("shows the seen share of a dimmed deck in muted ink too", () => {
    render(<DestinationCard variant="deck" name="CLF" code detail="Cloud Practitioner" seenPercent={38} dimmedReason="Needs a connection" label="CLF" />);
    const share = screen.getByRole("group", { name: "CLF" }).querySelector("[data-status] b");
    expect(share?.textContent).toBe("38%");
    expect(share?.className).not.toContain("text-(--color-ink)");
  });

```

In `tests/components/start/ContinueLine.test.tsx`, insert before `it("is a 60 tall row, the same place and size as the pill it shares the foot with", ...)`:

```tsx
  it("says Needs a connection and is not a button when its deck cannot be played now", () => {
    const onContinue = vi.fn();
    render(<ContinueLine {...ROUTE} lastScore="7 of 10" needsConnection onContinue={onContinue} />);
    expect(screen.queryByRole("button")).toBeNull();
    const line = screen.getByRole("group", { name: "Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection." });
    expect(line.getAttribute("aria-disabled")).toBe("true");
    // The reason takes the place of the last score; the chevron that says "continue" is gone.
    expect(line.textContent).toBe("AWS Cloud PractitionerCLF → SEC · Classic · Needs a connection");
    expect(line.querySelector("[data-continue='reason']")?.textContent).toBe("Needs a connection");
    expect(line.querySelector("[data-continue='score']")).toBeNull();
    expect(line.querySelectorAll("svg")).toHaveLength(1); // the logo mark only
    expect(line.className).toContain("h-(--size-pill)");
    expect(line.className).toContain("text-(--color-ink-muted)");
    expect(line.className).not.toContain("active:");
    fireEvent.click(line);
    expect(onContinue).not.toHaveBeenCalled();
  });

```

Create `tests/components/start/offline.test.tsx`:

```tsx
// @vitest-environment jsdom
// The start flow offline (offline spec section 8): a deck with no copy on the device cannot be chosen and says
// why, the continue line leads only to a deck that can be played, and the labels go away when the network is back.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StartFlow } from "@/components/start/StartFlow";
import { INDEX_CACHE_KEY, deckCacheKey } from "@/src/content/load";
import type { DeckFile } from "@/src/content/schema";
import { SWIPE } from "@/src/input/swipe";
import { PROGRESS_KEY } from "@/src/progress/local";
import { emptyProgress } from "@/src/progress/progress";
import { INDEX, harness, memoryStorage, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(() => {
  cleanup();
  delete (window.navigator as { onLine?: boolean }).onLine;
});

/** Sets navigator.onLine and, like the browser, fires "online" or "offline" on the window. */
function goOnline(online: boolean, fire = true) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => online });
  if (fire) window.dispatchEvent(new Event(online ? "online" : "offline"));
}

/** A valid copy of a deck as a round leaves it on the device (any hash counts). */
function deckCopy(id: string): DeckFile {
  return {
    id,
    hash: "an-older-hash",
    cards: [
      {
        id: `${id}-1`,
        section: "SEC",
        text: { en: { statement: "A statement", explanation: "An explanation" } },
        answer: true,
        source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
        difficulty: 1,
        appliesTo: "",
        conflictGroups: [],
      },
    ],
  };
}

const LAST_CLF_SEC = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" as const, score: 7, total: 10 };

/** A device that has opened Truthy before: the cached index, these deck copies and this last round. */
function device(decks: readonly string[], last: typeof LAST_CLF_SEC | null = null) {
  const local = memoryStorage({
    [INDEX_CACHE_KEY]: JSON.stringify(INDEX),
    [PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), last }),
  });
  for (const id of decks) local.setItem(deckCacheKey(id), JSON.stringify(deckCopy(id)));
  return local;
}

let h: Harness;

/** Opens the start with the network off (navigator.onLine false, every fetch failing). */
async function startOffline(local: ReturnType<typeof device>) {
  goOnline(false, false);
  h = harness(local);
  h.network.online = false;
  render(<StartFlow services={h.services} />);
  await screen.findByRole("button", { name: "Cloud, 2 decks" });
}

function heading(): string | null | undefined {
  return [...document.querySelectorAll("[data-step]:not([inert]) h2")].at(-1)?.textContent;
}

async function choose(name: string | RegExp, nextHeading: string) {
  h.clock.time += SWIPE.settleMs;
  fireEvent.click(screen.getByRole("button", { name }));
  await waitFor(() => expect(heading()).toBe(nextHeading));
}

describe("StartFlow offline: the deck step", () => {
  it("shows areas and platforms as online, with their counts", async () => {
    await startOffline(device([]));
    expect(screen.getByRole("button", { name: "Frontend, 1 deck" })).toBeTruthy();
    await choose("Cloud, 2 decks", "Choose a platform");
    expect(screen.getByRole("button", { name: "AWS, 1 deck" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Google Cloud, 1 deck" })).toBeTruthy();
  });

  it("offers a deck the device holds a copy of, as online", async () => {
    await startOffline(device(["aws-clf-c02"]));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("AWS, 1 deck", "Choose a deck");
    expect(screen.getByRole("button", { name: "CLF, Cloud Practitioner, 92 cards, not started" })).toBeTruthy();
    expect(screen.queryByText("Needs a connection")).toBeNull();
    await choose(/^CLF, Cloud Practitioner/, "Choose a section");
  });

  it("shows a deck with no copy as unavailable: dimmed, not selectable, Needs a connection in place of its count", async () => {
    await startOffline(device(["aws-clf-c02"]));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("Google Cloud, 1 deck", "Choose a deck");
    expect(screen.queryByRole("button", { name: /^CDL/ })).toBeNull();
    const card = screen.getByRole("group", { name: "CDL, Cloud Digital Leader, needs a connection" });
    expect(card.getAttribute("aria-disabled")).toBe("true");
    expect(card.textContent).toBe("CDLCloud Digital LeaderNot startedNeeds a connection");
    h.clock.time += SWIPE.settleMs;
    fireEvent.click(card);
    await act(async () => {});
    expect(heading()).toBe("Choose a deck");
  });

  it("drops the labels without a reload when the network comes back, and takes them back when it goes", async () => {
    await startOffline(device([]));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("Google Cloud, 1 deck", "Choose a deck");
    expect(screen.getByRole("group", { name: "CDL, Cloud Digital Leader, needs a connection" })).toBeTruthy();
    act(() => goOnline(true));
    expect(screen.getByRole("button", { name: "CDL, Cloud Digital Leader, 133 cards, not started" })).toBeTruthy();
    expect(screen.queryByText("Needs a connection")).toBeNull();
    act(() => goOnline(false));
    expect(screen.getByRole("group", { name: "CDL, Cloud Digital Leader, needs a connection" })).toBeTruthy();
  });

  it("offers every deck online, whatever the device holds", async () => {
    h = harness(device([]));
    render(<StartFlow services={h.services} />);
    await screen.findByRole("button", { name: "Cloud, 2 decks" });
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("Google Cloud, 1 deck", "Choose a deck");
    expect(screen.getByRole("button", { name: "CDL, Cloud Digital Leader, 133 cards, not started" })).toBeTruthy();
  });
});

describe("StartFlow offline: the continue line", () => {
  it("leads to the last route as online when its deck is on the device", async () => {
    await startOffline(device(["aws-clf-c02"], LAST_CLF_SEC));
    const line = screen.getByRole("button", { name: "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10." });
    h.clock.time += SWIPE.settleMs;
    fireEvent.click(line);
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
  });

  it("says Needs a connection and is not a button when its deck has no copy", async () => {
    await startOffline(device([], LAST_CLF_SEC));
    expect(screen.queryByRole("button", { name: /^Continue/ })).toBeNull();
    const line = screen.getByRole("group", { name: "Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection." });
    expect(line.textContent).toBe("AWS Cloud PractitionerCLF → SEC · Classic · Needs a connection");
    h.clock.time += SWIPE.settleMs;
    fireEvent.click(line);
    await act(async () => {});
    expect(heading()).toBe("Choose an area");
  });

  it("becomes the button again when the network comes back", async () => {
    await startOffline(device([], LAST_CLF_SEC));
    act(() => goOnline(true));
    expect(screen.getByRole("button", { name: "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10." })).toBeTruthy();
    expect(screen.queryByText("Needs a connection")).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
pnpm vitest run tests/offline/availability.test.ts tests/components/useOnline.test.tsx tests/components/DestinationCard.test.tsx tests/components/start/ContinueLine.test.tsx tests/components/start/offline.test.tsx
```

Expected: `Test Files  5 failed (5)`, `Tests  7 failed | 17 passed (24)`.
- `tests/offline/availability.test.ts`: `Error: Cannot find package '@/src/offline/availability'`.
- `tests/components/useOnline.test.tsx`: `Error: Failed to resolve import "@/components/useOnline" from "tests/components/useOnline.test.tsx". Does the file exist?`
- `DestinationCard.test.tsx`: the three new cases (`expected <button type="button" …(4)>…(2)</button> to be null`; `Unable to find an accessible element with the role "group" and name "SAA"`, and `"CLF"`).
- `ContinueLine.test.tsx`: the new case (`expected <button type="button" …(2)>…(3)</button> to be null`).
- `offline.test.tsx`: "shows a deck with no copy as unavailable …", "drops the labels …" and "says Needs a connection and is not a button …" fail; the five cases that pin what stays as online pass already.

- [ ] **Step 3: The rule and the hook.**

Create `src/offline/availability.ts`:

```ts
// Which decks can be played now (offline spec section 8). Online, every deck. Offline, the decks the device
// holds a copy of (`truthy.deck.<id>`, any hash): the same rule loadDeck follows when its fetch fails, so a
// deck offered here is one a round can load. Pure apart from the cache it is given; no React, no DOM.
import type { DeckCache } from "@/src/content/load";

export function availableDeckIds(deckIds: readonly string[], online: boolean, cache: DeckCache): ReadonlySet<string> {
  if (online) return new Set(deckIds);
  return new Set(deckIds.filter((id) => cache.read(id) !== null));
}
```

Create `components/useOnline.ts`:

```ts
// Whether the browser says it is online (offline spec section 8, "Online state"): navigator.onLine, followed
// through the window's online and offline events, so what depends on it changes without a reload. A fetch that
// fails while this is still true takes the loader's own paths (a cached copy, else Try again).
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const browserOnLine = () => navigator.onLine;

// The prerendered page and the first render that hydrates it are online, so they match the server's HTML;
// React then reads navigator.onLine and renders again if it differs.
const serverOnLine = () => true;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, browserOnLine, serverOnLine);
}
```

- [ ] **Step 4: The dimmed deck card** (rule 4). In `components/DestinationCard.tsx`:

Replace the last line of the header comment (`// content is "not available": a sunk, labelled group without a stub, which is not a button.`) with:

```ts
// content is "not available": a sunk, labelled group without a stub, which is not a button. A deck that
// exists but cannot be played now (offline, no copy on the device) is "dimmed": the same ticket in sunk
// paper and muted ink, the reason in its stub, also a labelled group and not a button.
```

In `DestinationCardProps`, after `unavailable?: boolean;` add:

```ts
  /**
   * When set the option cannot be chosen now, and this says why ("Needs a connection"). The card keeps its
   * shape, height and main column, in sunk paper and muted ink without a shadow; the stub shows this text in
   * place of its values and chevron. Not a button: a labelled, disabled group. Used by the deck card offline.
   */
  dimmedReason?: string;
```

Replace `notchedCard` with:

```ts
/** Paper with a half circle of radius 7 cut into the top and bottom edges on the stub line. */
function notchedCard(stubWidth: string, paper = "var(--color-surface-raised)"): CSSProperties {
  const cut = (edge: "0" | "100%") =>
    `radial-gradient(circle at calc(100% - ${stubWidth}) ${edge}, transparent var(--size-card-notch), ` +
    `${paper} calc(var(--size-card-notch) + 0.5px))`;
  return { background: `${cut("0")} top / 100% 51% no-repeat, ${cut("100%")} bottom / 100% 51% no-repeat` };
}
```

Replace the whole `DestinationCard` function with:

```tsx
export function DestinationCard(props: DestinationCardProps) {
  const { variant, name, code = false, sub, detail, seenPercent, stub, label, unavailable = false, dimmedReason, onSelect, ref, nameHidden = false } = props;
  const nameClass = code ? CODE : NAME;
  const dimmed = dimmedReason !== undefined;

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
  const main = (
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
              <b className={`font-(--font-weight-mono-semibold) ${dimmed ? "" : "text-(--color-ink)"}`}>{seenPercent}%</b> seen
            </span>
          ) : (
            <span>Not started</span>
          )}
        </span>
      )}
    </span>
  );
  const perforation = <span className="absolute top-(--space-12) bottom-(--space-12) left-[-0.75px] w-(--stroke-rule)" style={PERFORATION} />;

  if (dimmed) {
    return (
      <div
        role="group"
        aria-label={label}
        aria-disabled="true"
        data-variant={variant}
        data-dimmed=""
        className={`relative grid w-full rounded-(--radius-card) text-left text-(--color-ink-muted) ${MIN_HEIGHT[variant]}`}
        style={{ ...notchedCard(stubWidth, "var(--color-surface-sunk)"), gridTemplateColumns: `minmax(0, 1fr) ${stubWidth}` }}
      >
        {main}
        <span aria-hidden="true" className="relative flex flex-col items-center justify-center px-(--space-4)">
          {perforation}
          <span data-stub-reason="" className={`${STUB_LABEL} text-center`}>
            {dimmedReason}
          </span>
        </span>
      </div>
    );
  }

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
      {main}
      <span aria-hidden="true" className="relative flex flex-col items-center justify-center gap-(--space-2)">
        {perforation}
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

The enabled button renders exactly as before (the main column and the perforation are only moved into constants).

- [ ] **Step 5: The unavailable continue line** (rule 5). Replace `components/start/ContinueLine.tsx` with:

```tsx
// The continue line of start step 1 (design system 5.4a): one tap back into the last route for a
// returning player. It fills the whole pass and goes straight to "Your pass is ready". Offline, when the
// route's deck has no copy on the device, it says "Needs a connection" and is not a button.
import type { Ref } from "react";
import { LogoMark } from "@/components/Logo";
import { ChevronIcon } from "@/components/icons";

export interface ContinueLineProps {
  /** "CLF". */
  deckCode: string;
  /**
   * The deck's name on the pass ("AWS Cloud Practitioner", "React Fundamentals"; deckPassName), on the line and
   * in the accessible name. The bare deck title would not do: six decks are titled "Fundamentals".
   */
  deckName: string;
  /** "SEC", or "ALL" for the whole deck. */
  sectionCode: string;
  /** "Security and compliance", or "Whole deck". */
  sectionTitle: string;
  /** "Classic". */
  modeLabel: string;
  /** The score of the last round, already worded ("7 of 10", "13 in a row"), when it is known. */
  lastScore?: string;
  /**
   * The route's deck cannot be played now (offline, no copy on the device): the line says "Needs a connection"
   * in place of the last score, has no chevron and is a labelled, disabled group instead of a button.
   */
  needsConnection?: boolean;
  onContinue: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.", or, when the deck
 * cannot be played now, "Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection."
 */
export function continueLabel({ deckName, sectionTitle, modeLabel, lastScore, needsConnection }: Omit<ContinueLineProps, "onContinue" | "ref" | "deckCode" | "sectionCode">): string {
  if (needsConnection) return `Continue: ${deckName}, ${sectionTitle}, ${modeLabel}, needs a connection.`;
  const score = lastScore ? ` Last score ${lastScore}.` : "";
  return `Continue: ${deckName}, ${sectionTitle}, ${modeLabel}.${score}`;
}

/** " · " in a 3ch box, the width the mono line pulls itself to the left by. */
function Separator() {
  return (
    <span data-continue="sep" className="w-[3ch] flex-none whitespace-pre">
      {" · "}
    </span>
  );
}

const ROW = "flex h-(--size-pill) w-full items-center gap-(--space-14) rounded-(--radius-card) pr-(--space-12) pl-(--space-4) text-left";

export function ContinueLine(props: ContinueLineProps) {
  const { deckCode, deckName, sectionCode, modeLabel, lastScore, needsConnection = false, onContinue, ref } = props;
  const content = (
    <>
      <span aria-hidden="true" className="grid size-(--size-continue-icon) flex-none place-items-center rounded-full bg-(--color-surface-raised)">
        <LogoMark width={26} />
      </span>
      <span aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-[3px]">
        {/*
          The deck's name on the pass, on one line: a name longer than the column ends in an ellipsis (the
          accessible name has all of it). One line leaves room in the 60 px row for two lines below it, so the
          last score always has a line to go to, on a 320 px phone too (review finding U61).
        */}
        <span
          data-continue="deck"
          className="truncate font-(family-name:--type-emphasis-family) text-(length:--type-emphasis-size) font-(--type-emphasis-weight) leading-[1.2] tracking-(--type-emphasis-letter-spacing)"
        >
          {deckName}
        </span>
        {/*
          The mono line is three parts that are never cut: the route, the class and the last score (offline,
          for a deck with no copy on the device, "Needs a connection" in its place). A part
          that does not fit after the others moves to the next line, and the line box shows at most two lines.
          Each separator sits in the 3ch before its part; the row is pulled 3ch to the left and clipped, so
          the separator of a part that starts a line is outside the box and never shows as a stray "·".
        */}
        <span
          data-continue="line"
          className="block max-h-[2lh] overflow-hidden font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) font-(--type-mono-data-weight) leading-(--type-mono-data-line-height) text-(--color-ink-muted)"
        >
          <span className="-ml-[3ch] flex flex-wrap whitespace-nowrap">
            <span data-continue="route" className="ml-[3ch] min-w-0 overflow-hidden text-ellipsis">
              {deckCode} → {sectionCode}
            </span>
            <span className="flex min-w-0">
              <Separator />
              <span data-continue="class" className="min-w-0 overflow-hidden text-ellipsis">
                {modeLabel}
              </span>
            </span>
            {needsConnection ? (
              <span className="flex min-w-0">
                <Separator />
                <span data-continue="reason" className="min-w-0 overflow-hidden text-ellipsis font-(--font-weight-mono-semibold) text-(--color-ink)">
                  Needs a connection
                </span>
              </span>
            ) : lastScore ? (
              <span className="flex min-w-0">
                <Separator />
                <span data-continue="score" className="min-w-0 overflow-hidden text-ellipsis">
                  {"last "}
                  <em className="font-(--font-weight-mono-semibold) text-(--color-ink) not-italic">{lastScore}</em>
                </span>
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </>
  );

  if (needsConnection) {
    return (
      <div role="group" aria-label={continueLabel(props)} aria-disabled="true" data-unavailable="" className={`${ROW} text-(--color-ink-muted)`}>
        {content}
      </div>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-label={continueLabel(props)}
      onClick={onContinue}
      className={[
        ROW,
        "cursor-pointer text-(--color-ink)",
        "transition-[scale,background-color] duration-(--duration-t1) ease-(--easing-ease) active:scale-[0.98] active:bg-(--color-press)",
      ].join(" ")}
    >
      {content}
      <span aria-hidden="true" className="flex flex-none">
        <ChevronIcon />
      </span>
    </button>
  );
}
```

The button's classes are the same set as before, in another order (`ROW` first); `continue-line-polish.test.tsx` and `ContinueLine.test.tsx` check single classes, not the order.

- [ ] **Step 6: The start flow** (rules 3 to 5). In `components/start/StartFlow.tsx`:

The React import gains `useMemo`:

```ts
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
```

After `import { EASE, EASE_OUT } from "@/components/easing";` add:

```ts
import { useOnline } from "@/components/useOnline";
```

Before `import type { Mode } from "@/src/content/play";` add:

```ts
import { createDeckCache } from "@/src/content/load";
```

After `import { SWIPE } from "@/src/input/swipe";` add:

```ts
import { availableDeckIds } from "@/src/offline/availability";
```

After the line `const hasSections = (r.deck?.sections.length ?? 1) > 0;` in `StartFlow` add:

```ts

  // The decks that can be played now (offline spec section 8): all of them online; offline, those with a copy
  // on the device. Read again when the network comes or goes, so the deck step's labels follow without a reload.
  const online = useOnline();
  const available = useMemo(() => {
    if (!index) return new Set<string>();
    const ids = index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks.map((deck) => deck.id)));
    return availableDeckIds(ids, online, createDeckCache(services.localStorage()));
  }, [index, online, services]);
```

In `continueLast()` replace `if (!target) return;` with:

```ts
    if (!target || !available.has(target.found.deck.id)) return;
```

In the foot zone's `<ContinueLine … />`, after the `lastScore={…}` line add:

```tsx
                needsConnection={!available.has(returning.found.deck.id)}
```

In `renderOptions()`, `case 3`, right after `const seen = seenPercent(progress, deck, cardIds[deck.id]);` add:

```tsx
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
```

- [ ] **Step 7: Run them green.**

```bash
pnpm vitest run tests/offline/availability.test.ts tests/components/useOnline.test.tsx tests/components/DestinationCard.test.tsx tests/components/start/ContinueLine.test.tsx tests/components/start/offline.test.tsx
```

Expected: `Test Files  5 passed (5)`, `Tests  34 passed (34)`.

```bash
pnpm vitest run tests/components/start tests/components/DestinationCard.test.tsx
```

Expected: every file passes (the existing start flow tests run with jsdom's `navigator.onLine` true, so nothing in them changes).

- [ ] **Step 8: The proxy's contract, test first** (rule 8). Create `tests/e2e/proxy.test.ts`:

```ts
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startProxy, type Proxy } from "@/e2e/proxy";

// The offline specs reach the production server through this proxy (docs/testing.md, "Offline and updates"): it is
// how they cut the network in WebKit, where Playwright's setOffline also stops the service worker from answering,
// and how the update spec serves a new release of sw.js.

const WORKER = 'self.version = "abc-1";\n';

let upstream: Server;
let upstreamUrl: string;
let proxy: Proxy;

beforeEach(async () => {
  upstream = createServer((request, response) => {
    if (request.url === "/sw.js") {
      response.writeHead(200, { "content-type": "text/javascript", etag: '"w1"', "content-length": String(Buffer.byteLength(WORKER)) });
      response.end(WORKER);
      return;
    }
    response.writeHead(200, { "content-type": "text/plain", "x-path": request.url ?? "" });
    response.end(`page ${request.url}`);
  });
  await new Promise<void>((resolve) => upstream.listen(0, resolve));
  upstreamUrl = `http://localhost:${(upstream.address() as AddressInfo).port}`;
  proxy = await startProxy(upstreamUrl);
});

afterEach(async () => {
  await proxy.close();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe("the switchable proxy", () => {
  it("passes requests and answers through while online", async () => {
    const response = await fetch(`${proxy.url}/play?x=1`);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-path")).toBe("/play?x=1");
    expect(await response.text()).toBe("page /play?x=1");
  });

  it("drops every connection while offline, and passes them again once back online", async () => {
    await fetch(`${proxy.url}/`);
    proxy.setOffline(true);
    await expect(fetch(`${proxy.url}/`)).rejects.toThrow();
    proxy.setOffline(false);
    expect(await (await fetch(`${proxy.url}/`)).text()).toBe("page /");
  });

  it("serves sw.js unchanged until a release is made", async () => {
    expect(await (await fetch(`${proxy.url}/sw.js`)).text()).toBe(WORKER);
  });

  it("serves a new release of sw.js: the version replaced, with no stale length or validator", async () => {
    proxy.release("abc-1", "abc-1-next");
    const response = await fetch(`${proxy.url}/sw.js`, { headers: { "if-none-match": '"w1"' } });
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBeNull();
    expect(await response.text()).toBe('self.version = "abc-1-next";\n');
    expect(await (await fetch(`${proxy.url}/`)).text()).toBe("page /");
  });
});
```

Run `pnpm vitest run tests/e2e/proxy.test.ts`. Expected: the file fails to load with `Error: Cannot find package '@/e2e/proxy' imported from .../tests/e2e/proxy.test.ts`; `Test Files  1 failed (1)`, `Tests  no tests`.

- [ ] **Step 9: The proxy.** Create `e2e/proxy.ts`:

```ts
// A proxy in front of the production server that the offline specs can switch: offline it drops every connection,
// as a phone without a network does, and after a release it serves sw.js with a new version string. Playwright's
// context.setOffline cannot stand in for it: in Playwright 1.63's WebKit an offline context fails every page
// request before the service worker sees it, and a changed sw.js cannot come from page.route or context.route,
// since neither engine routes the worker's update check through them (docs/testing.md, "Offline and updates").
import { createServer, request as forward, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo, Socket } from "node:net";

export interface Proxy {
  /** The proxy's own address, http://localhost:<port>: the specs' baseURL. */
  readonly url: string;
  /** Offline drops every open connection and every new one; online passes them again. */
  setOffline(offline: boolean): void;
  /** From now on sw.js is served with every `from` replaced by `to`: the browser sees a new release. */
  release(from: string, to: string): void;
  close(): Promise<void>;
}

// Headers that would describe the original bytes of sw.js, or let the server answer 304 for them.
const STALE = new Set(["content-length", "etag", "last-modified", "content-encoding", "transfer-encoding"]);

function freshHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !STALE.has(name)));
}

/** Starts a proxy to `upstream` (for example http://localhost:3100) on a free port. */
export async function startProxy(upstream: string): Promise<Proxy> {
  const target = new URL(upstream);
  const sockets = new Set<Socket>();
  let offline = false;
  let swRelease: { from: string; to: string } | null = null;

  const server = createServer((request, response) => {
    if (offline) {
      request.socket.destroy();
      return;
    }
    const path = request.url ?? "/";
    const rewrite = swRelease !== null && new URL(path, target).pathname === "/sw.js" ? swRelease : null;
    const headers: IncomingHttpHeaders = { ...request.headers, host: target.host };
    if (rewrite) {
      delete headers["accept-encoding"];
      delete headers["if-none-match"];
      delete headers["if-modified-since"];
    }
    const outgoing = forward({ hostname: target.hostname, port: target.port, method: request.method, path, headers }, (answer) => {
      if (!rewrite) {
        response.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(response);
        return;
      }
      const chunks: Buffer[] = [];
      answer.on("data", (chunk: Buffer) => chunks.push(chunk));
      answer.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8").split(rewrite.from).join(rewrite.to);
        response.writeHead(answer.statusCode ?? 502, { ...freshHeaders(answer.headers), "content-length": String(Buffer.byteLength(body)) });
        response.end(body);
      });
    });
    outgoing.on("error", () => response.destroy());
    request.pipe(outgoing);
  });

  server.on("connection", (socket: Socket) => {
    if (offline) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://localhost:${port}`,
    setOffline(value) {
      offline = value;
      if (value) for (const socket of sockets) socket.destroy();
    },
    release(from, to) {
      swRelease = { from, to };
    },
    close() {
      for (const socket of sockets) socket.destroy();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
```

Run `pnpm vitest run tests/e2e/proxy.test.ts`. Expected: `Test Files  1 passed (1)`, `Tests  4 passed (4)`.

- [ ] **Step 10: The fixture and the steps.** Create `e2e/offline.ts`. It is not a spec file, so the reduced motion guard does not read it:

```ts
// The fixture and the steps of every end-to-end spec that goes offline (offline spec sections 11 and 14). Each test
// gets its own proxy in front of the production server (e2e/proxy.ts) and uses it as its baseURL, so it can cut the
// network and serve a new release of sw.js without touching the server other specs use. "Offline" is the proxy
// dropping every connection plus navigator.onLine reading false with an "offline" event, which is what a phone
// without a network gives the page; the same in Chromium and WebKit.
import { expect, test as base, type Page } from "@playwright/test";
import { e2ePort } from "../playwright.config";
import { startProxy, type Proxy } from "./proxy";

// The key the onLine switch reads. The app never reads or writes it.
const OFFLINE_FLAG = "truthy.e2e.offline";

export const test = base.extend<{ net: Proxy }>({
  net: async ({}, use) => {
    const proxy = await startProxy(`http://localhost:${e2ePort(process.env.E2E_PORT)}`);
    await use(proxy);
    await proxy.close();
  },
  baseURL: async ({ net }, use) => {
    await use(net.url);
  },
  context: async ({ context }, use) => {
    // Every page of the context reads navigator.onLine from the switch, on every load.
    await context.addInitScript((flag) => {
      Object.defineProperty(Navigator.prototype, "onLine", {
        configurable: true,
        get: () => {
          try {
            return localStorage.getItem(flag) !== "1";
          } catch {
            return true;
          }
        },
      });
    }, OFFLINE_FLAG);
    await use(context);
  },
});

/** The network goes away: connections drop, navigator.onLine reads false and the page hears "offline". */
export async function goOffline(page: Page, net: Proxy): Promise<void> {
  net.setOffline(true);
  await page.evaluate((flag) => {
    localStorage.setItem(flag, "1");
    window.dispatchEvent(new Event("offline"));
  }, OFFLINE_FLAG);
  // The page's own requests fail now (a worker passes /decks/ to the network untouched).
  const reached = await page.evaluate(() =>
    fetch("/decks/index.json", { cache: "no-store" }).then(
      () => true,
      () => false,
    ),
  );
  expect(reached, "a request went through while offline").toBe(false);
}

/** The network comes back, without a reload. */
export async function goOnline(page: Page, net: Proxy): Promise<void> {
  net.setOffline(false);
  await page.evaluate((flag) => {
    localStorage.removeItem(flag);
    window.dispatchEvent(new Event("online"));
  }, OFFLINE_FLAG);
}

export interface WorkerState {
  /** A service worker controls the page. */
  controlled: boolean;
  /** A new release has installed and waits for a safe moment. */
  waiting: boolean;
  /** The worker caches of the origin (truthy-shell-<version>), sorted. */
  caches: string[];
}

/** What the page sees of its service worker; null while the page is between two documents. */
export async function workerState(page: Page): Promise<WorkerState | null> {
  try {
    return await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const names = (await caches.keys()).filter((name) => name.startsWith("truthy-shell-")).sort();
      return { controlled: navigator.serviceWorker.controller !== null, waiting: Boolean(registration?.waiting), caches: names };
    });
  } catch {
    return null;
  }
}

/**
 * Waits until the worker of the first visit controls the page and its cache is complete (it claims the page once it
 * has activated, and it activates once every file is in its cache). Returns the release it carries.
 */
export async function waitForWorker(page: Page): Promise<string> {
  await expect.poll(async () => (await workerState(page))?.controlled, { timeout: 20_000 }).toBe(true);
  const state = await workerState(page);
  expect(state?.caches).toHaveLength(1);
  return (state?.caches[0] ?? "").replace(/^truthy-shell-/, "");
}
```

Run `pnpm typecheck`. Expected: no output after the command line.

- [ ] **Step 11: The e2e spec.** Create `e2e/offline-labels.spec.ts`:

```ts
// The start flow's offline labels in a real browser (offline spec section 8): the page is opened online, then the
// network goes. No service worker is involved (workers stay blocked here) and no page is loaded while offline.
// Offline is the one way every offline spec of step 3 goes offline (e2e/offline.ts): the test's proxy drops every
// connection, navigator.onLine reads false and the page hears "offline", the same in Chromium and WebKit.
// Opening the app with no network is the service worker's part, which has specs of its own.
import { expect, type Page } from "@playwright/test";
import { CLF_ID, CLF_SECURITY, CONTINUE_CLF_SECURITY, SETTLE_MS, atHome, atStep, openHome } from "./helpers";
import { goOffline, goOnline, test } from "./offline";

test.use({ reducedMotion: "reduce" });

/** Puts a copy of a deck on the device, as a round on it would: the file the app serves, under truthy.deck.<id>. */
async function keepDeck(page: Page, deckId: string): Promise<void> {
  await page.evaluate(async (id) => {
    type Index = { areas: { platforms: { decks: { id: string; hash: string }[] }[] }[] };
    const index = (await (await fetch("/decks/index.json")).json()) as Index;
    const entry = index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks)).find((deck) => deck.id === id);
    if (!entry) throw new Error(`no deck ${id} in the index`);
    const deck: unknown = await (await fetch(`/decks/${id}.json?v=${entry.hash}`)).json();
    localStorage.setItem(`truthy.deck.${id}`, JSON.stringify(deck));
  }, deckId);
}

/** Stores a last round on CLF / SEC / Classic that was left before the end, so step 1 shows the continue line. */
async function keepLastRound(page: Page): Promise<void> {
  await page.evaluate((deckId) => {
    const last = { route: { deckId, sectionId: "SEC" }, mode: "classic", score: null, total: null };
    localStorage.setItem("truthy.progress.v1", JSON.stringify({ version: 1, cards: {}, records: {}, last }));
  }, CLF_ID);
}

test("offline, the deck step offers the decks on the device and says the others need a connection, until the network is back", async ({ page, net }) => {
  await openHome(page);
  await keepDeck(page, CLF_ID);
  await keepLastRound(page);
  await page.reload();
  await atHome(page);

  await goOffline(page, net);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  // The continue line still leads into its route: the deck is on the device.
  await expect(page.getByRole("button", { name: CONTINUE_CLF_SECURITY })).toBeVisible();

  await page.getByRole("button", { name: CLF_SECURITY.area }).click();
  await atStep(page, "Choose a platform");
  await page.getByRole("button", { name: CLF_SECURITY.platform }).click();
  await atStep(page, "Choose a deck");
  await expect(page.getByRole("button", { name: CLF_SECURITY.deck })).toBeVisible();
  const saa = page.getByRole("group", { name: "SAA, Solutions Architect Associate, needs a connection" });
  await expect(saa).toBeVisible();
  await expect(saa).toContainText("Needs a connection");
  await expect(page.getByRole("group", { name: "DVA, Developer Associate, needs a connection" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^SAA/ })).toHaveCount(0);
  // A tap on it does nothing (force: Playwright itself refuses to click an aria-disabled element).
  await saa.click({ force: true });
  await page.waitForTimeout(SETTLE_MS);
  await expect(page.locator("[data-step]:not([inert]) h2")).toHaveText("Choose a deck");

  await goOnline(page, net);
  await expect(page.getByRole("button", { name: /^SAA, Solutions Architect Associate, \d+ cards, / })).toBeVisible();
  await expect(page.getByText("Needs a connection")).toHaveCount(0);
});

test("offline, the continue line to a deck that is not on the device says so and is not a button", async ({ page, net }) => {
  await openHome(page);
  await keepLastRound(page);
  await page.reload();
  await atHome(page);
  await expect(page.getByRole("button", { name: CONTINUE_CLF_SECURITY })).toBeVisible();

  await goOffline(page, net);
  const line = page.getByRole("group", { name: "Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection." });
  await expect(line).toBeVisible();
  await expect(line).toContainText("CLF → SEC · Classic · Needs a connection");
  await expect(page.getByRole("button", { name: /^Continue/ })).toHaveCount(0);

  await goOnline(page, net);
  await expect(page.getByRole("button", { name: CONTINUE_CLF_SECURITY })).toBeVisible();
});
```

```bash
E2E_PORT=3716 pnpm exec playwright test e2e/offline-labels.spec.ts
```

Expected: `4 passed` (both tests on phone-chromium and phone-webkit), nothing skipped.

- [ ] **Step 12: The testing note.** In `docs/testing.md`, add a section at the end of the file, after the last paragraph of "End-to-end specs" (the one that starts "A failed test keeps its trace in `test-results/`"). The run commands, the `E2E_PORT` note and the traces note above it stay under "End-to-end specs", where they belong:

```markdown
## Offline and updates

Every spec that goes offline imports `test` from `e2e/offline.ts` instead of `@playwright/test`. Its fixture `net` is a proxy of the test's own (`e2e/proxy.ts`) in front of the production server, and the proxy is the test's `baseURL`. Service workers stay blocked unless the spec allows them; a spec about the worker offline sets `serviceWorkers: "allow"`.

- `goOffline(page, net)` makes the proxy drop every connection, makes `navigator.onLine` read false (an init script reads a flag in local storage) and sends the page an `offline` event; it then checks that a request of the page fails, so a spec never passes for the wrong reason. `goOnline(page, net)` undoes all three without a reload.
- `net.setOffline(true)` alone is a network that is gone while the browser still says it is online (a Wi-Fi without internet).
- `net.release(from, to)` makes the proxy serve `sw.js` with the version string `from` replaced by `to`, which is what a deploy does. `waitForWorker(page)` waits until the first worker controls the page and returns its version; `workerState(page)` reads what the page sees: controlled, a release waiting, the `truthy-shell-*` caches.

Why a proxy and not `context.setOffline`: in Playwright 1.63's WebKit an offline context fails every page request before the service worker sees it (microsoft/playwright issue 42775; fixed with WebKit r2370, which comes with Playwright 1.64), and neither engine routes the worker's update check through `page.route` or `context.route`, so a new `sw.js` cannot come from a route. With the proxy the same specs run in both projects, on macOS and in CI. Playwright's own worker events (`context.serviceWorkers()`, the `serviceworker` event) exist only in Chromium, so the specs assert on what the page shows, on `response.fromServiceWorker()` and on `workerState`.
```

- [ ] **Step 13: The design system entries** (rule 7). In `design/system/DESIGN-SYSTEM.md`:

Section 2.2, replace the row `| ink-muted / surface-sunk | 5.23 | 6.04 | Missed-card heads, unavailable card |` with:

```md
| ink-muted / surface-sunk | 5.23 | 6.04 | Missed-card heads, unavailable card, deck card that needs a connection |
```

and the row `| ink-muted / sky-4 | 5.13 | 6.09 | Continue line route (start step 1) |` with:

```md
| ink-muted / sky-4 | 5.13 | 6.09 | Continue line route (start step 1), and its deck name when it needs a connection |
```

Section 5.3, after the **Not available** variant bullet add:

```md
  - **Needs a connection** (deck card, offline, for a deck with no copy on the device): the deck card's shape, size and main column (code, name, status row) kept, so the list does not move when the network comes or goes. Paper `surface-sunk` with the same notches and perforation, no shadow, all text ink-muted (the seen share too). The stub holds only "Needs a connection" in `field-label`, centred, on two lines ("Needs a" / "connection"), in place of "Cards", the count and the chevron. It is not a button and does nothing when tapped; it is a labelled group whose name ends in ", needs a connection" ("SAA, Solutions Architect Associate, needs a connection"). The words say why, so the state does not rest on the colour. When the network comes back the card becomes the deck button again, without a reload.
```

Section 5.4a, after the **States** bullet add (indented under it):

```md
  - **Needs a connection** (offline, when the route's deck has no copy on the device): the same row, place and size, with no chevron and no pressed state. The deck's pass name turns ink-muted, and the third part of the mono line reads "Needs a connection" (Mono 600 ink) in place of the last score. It is not a button and does nothing when tapped; it is a labelled group: "Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection." When the network comes back it is the continue button again, without a reload.
```

The ratios are pairs already listed, so `tests/tokens/contrast.test.ts` (which reads 2.2) stays green:

```bash
pnpm vitest run tests/tokens tests/repo-hygiene.test.ts
```

Expected: all pass.

- [ ] **Step 14: Look at it.** `pnpm build && pnpm start --port 3716`; in a phone-sized window open `/`, choose Cloud, AWS, then set the network offline in the browser's developer tools. Without a stored CLF deck all three AWS decks are dimmed with "Needs a / connection" in the stub; after one round on CLF online, CLF stays a button offline. Check the day and night themes (the dimmed paper is `surface-sunk` in both; the text stays readable) and that turning the network back on brings the buttons back without a reload. Stop the server.

- [ ] **Step 15: Run the gates.**

```bash
pnpm typecheck
pnpm test
pnpm build
E2E_PORT=3716 pnpm exec playwright test e2e/offline-labels.spec.ts e2e/catalog.spec.ts e2e/returning.spec.ts e2e/start-layout.spec.ts
```

Expected: typecheck clean; `pnpm test` ends with `Test Files  145 passed (145)`, `Tests  2325 passed (2325)` (task 5's 141 files and 2298 tests, plus 4 files and 27 tests: availability 6, useOnline 4, the start flow offline 8, DestinationCard 3, ContinueLine 1, the proxy 4, and the e2e guard's case for `offline-labels.spec.ts`); the build lists every route as `○ (Static)`; the four specs: `34 passed`.

- [ ] **Step 16: Commit.**

```bash
git add src/offline/availability.ts components/useOnline.ts components/DestinationCard.tsx components/start/ContinueLine.tsx components/start/StartFlow.tsx design/system/DESIGN-SYSTEM.md docs/testing.md e2e/proxy.ts e2e/offline.ts e2e/offline-labels.spec.ts tests/offline/availability.test.ts tests/components/useOnline.test.tsx tests/components/DestinationCard.test.tsx tests/components/start/ContinueLine.test.tsx tests/components/start/offline.test.tsx tests/e2e/proxy.test.ts
git commit -m "feat: offline, the start flow offers only the decks on the device and says the others need a connection, and the end-to-end specs get one way of going offline in both engines"
```

**Tried** (on `5db53f3` in a throwaway worktree, no commit): the tests failed first as step 2 says (7 failed, 17 passed) and the five files passed with the code above (34); `pnpm typecheck` clean; `pnpm build` all routes static; the four specs of step 15 passed (34) on phone-chromium and phone-webkit; `pnpm test` green (one run at a load average near 50 timed out three play screen files at 5 s; they pass alone with `--testTimeout=60000` and in the next full run, and import nothing this task changes). Screenshots of the offline deck step and continue line in day and night, Chromium and WebKit, showed the dimmed cards at full deck height with "Needs a / connection" fitting the 80 px stub. The labels spec ran then with `context.setOffline`, which works for it in both engines because it loads no page offline; it now goes offline through the kit of steps 8 to 10 (check C2: one way of going offline for every spec). The proxy and the fixture are the code task 8's draft ran (18 tests in both engines), and in the scratch run of the whole plan (README) the proxy test passed (4) and the labels spec on the kit passed in both engines (4).
