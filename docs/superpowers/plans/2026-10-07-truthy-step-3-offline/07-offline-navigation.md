### Task 7: Offline navigation through the router's page load fallback, and a stored round without a deck

Check C1 settled spec section 8's open question. When the browser is offline, the React Server Components fetch behind `router.push("/play")` (start flow) and `router.replace("/")` (play screen) fails. Next.js 16.3.8 then falls back to a full document navigation: `location.assign` for a push and `location.replace` for a replace, so the history behaves as it does online. The service worker of task 3 serves that navigation from its cache. So this task takes the "pin the fallback" branch:

- `StartFlow.tsx` keeps `router.push("/play")`. There is no `useOnline` branch and no `window.location.assign`.
- `PlayScreen.tsx` keeps its `router.replace("/")` fallback unchanged.
- A unit test pins the two facts the fallback rests on: `next.config.ts` does not turn on `experimental.useOffline`, and Next's client router still falls back.
- An e2e spec pins the real behaviour, in both engines: offline, Start round lands on a `/play` the worker served, and Leave round, Choose another route and Close results land on a `/` the worker served.

C1 also found what a document load costs. A document load starts `src/app-state/services.ts` afresh, which drops the in-memory mark `returningFromPlay`. After an offline way back from `/play`, the start therefore no longer focused its step 1 title (review finding U56, design system section 8). The mark is now also kept in sessionStorage under `RETURN_KEY = "truthy.return.v1"`, as the time it was set, and counts for `RETURN_MAX_AGE_MS` (10 s); `takeReturnFromPlay` reads and clears both copies. The same fix covers task 5's update path, where `goToStart` deliberately loads `/` with `window.location.replace("/")` after `markReturnToStart`.

The second part pins spec section 10's row "Offline, a stored round (`truthy.pending.v1`) whose deck has no copy", as section 14 amends it: the load failure screen (`LoadFailed` in `PlayScreen.tsx`) has no "Choose another route"; its way back is the header's "Leave round" (`onLeave={leaveToStart}`, no sheet). `/play` shows the existing load failure message with Try again. Try again keeps the message while still offline and deals the round once the network is back. Leave round goes to the start. No UI changes.

The e2e spec also pins one case of spec section 8 that no other task reaches end to end (README, Review Focus 2): a network that is gone while the browser still says it is online. The deck step then offers every deck, and a deck with no copy must end at that same load failure, with a way home.

**Accepted, recorded here.** An offline Start round loads `/play` as a new document, so the in-memory `startEntryBehind` mark is gone. Leaving that `/play` therefore takes `router.replace("/")`, which offline is a `location.replace("/")`. The tab's history is then [start, start] instead of [start]: the first back step lands on a start at step 1, and the next one leaves the site. Carrying `startEntryBehind` across the document load would make `backToStart` step back into a document the browser may restore from its back-forward cache, which can still show the ready pass. That is a worse result, so the extra entry stays. Online nothing changes.

**Files:**
- Modify: `src/app-state/services.ts` (`RETURN_KEY`, `RETURN_MAX_AGE_MS`, `markReturnFromPlay`, `takeReturnFromPlay`)
- Test: create `tests/next-offline-fallback.test.ts`, `tests/components/play/PlayScreenOffline.test.tsx` and `e2e/offline-navigation.spec.ts`; modify `tests/app-state/services.test.ts`

**Interfaces:**
- Consumes:
  - Task 1: `playwright.config.ts` `use.serviceWorkers = "block"`. This spec sets `serviceWorkers: "allow"`.
  - Task 3: `public/sw.js` built by `pnpm build:sw` in `prebuild`. A navigate to `/` or `/play` is served network first, with the cached page when the network fails. RSC requests (`_rsc` query, `RSC` header) and `/decks/*` are "pass". Activate claims the open pages, so the first visit's worker controls the page once it is active.
  - Task 4: `components/OfflineStart.tsx` in `app/layout.tsx` calls `services.offline.start()`, which registers `/sw.js` with scope `/` in a production build. `APPLY_TIMEOUT_MS` (3000) of `src/offline/register.ts`, which the mark's 10 s cover.
  - Task 5: `goToStart(services, router)` in `src/app-state/to-start.ts`, reached through the play screen's `leaveToStart`, which calls `services.markReturnToStart?.()` (`markReturnFromPlay`) first. Nothing in this task changes it.
  - Task 6: `e2e/offline.ts` (`test` with the fixture `net`, `goOffline`, `waitForWorker`) and `e2e/proxy.ts` (`net.setOffline`).
  - Existing: `components/start/StartFlow.tsx` `openPlay` (`markStartEntryBehind(...)`, `router.push("/play")`) and the step 1 focus effect (`services.returnedFromPlay?.()`, which is `takeReturnFromPlay`, read on the first render). Also `components/play/PlayScreen.tsx` `goHome` (`if (!services.backToStart?.()) router.replace("/")`), `leaveToStart` and `LoadFailed` ("This deck didn't load", "Check your connection and try again.", "Try again", header "Leave round"), `components/play/ResultView.tsx` (its actions carry `pointer-events-none` until `RESULT_ARRIVES_MS` has passed), `components/play/useRound.ts` `prepareRound`, `src/content/load.ts` `INDEX_CACHE_KEY` and `deckCacheKey`, and the fixtures in `tests/components/play/fixtures.ts` (`harness`, `memoryStorage`, `INDEX`, `DECK`, `DECK_ID`, `network.online`).
- Produces:

```ts
// src/app-state/services.ts
/** The sessionStorage key of the mark that the player is coming back from /play: the time it was set, in ms. */
export const RETURN_KEY = "truthy.return.v1";
/** How long the stored mark counts. */
export const RETURN_MAX_AGE_MS = 10_000;
export function markReturnFromPlay(): void;   // unchanged signature: now also writes RETURN_KEY = String(Date.now()) (never throws)
export function takeReturnFromPlay(): boolean; // unchanged signature: true for the in-memory mark or a stored one at most RETURN_MAX_AGE_MS old; clears both
```

**Rules:**

1. **No offline branch in the navigation code.** `StartFlow.tsx` and `PlayScreen.tsx` are not changed. The full-load fallback is Next's own (`fetchServerResponse` returns the URL as a string, and `app-router.js` calls `location.assign` for a push and `location.replace` for a replace). It only exists while `experimental.useOffline` is off: with it on, Next waits for the connection and retries instead.
2. **The return mark survives a document load, for a short while.** `markReturnFromPlay` sets the in-memory mark and writes `sessionStorage[RETURN_KEY] = String(Date.now())`. A blocked or full storage is ignored, and the in-memory mark still serves a same-page way back. `takeReturnFromPlay` returns true when the in-memory mark is set or the stored time is at most `RETURN_MAX_AGE_MS` old, then clears both.
   - Why a time limit (review): a stored mark can be left behind when no start takes it. A way back can step back (`history.back`) into a start document the browser restores from its back-forward cache, whose effects do not run again; a load can be cut off. A later fresh load of `/` must still move no focus (`e2e/return-focus.spec.ts`, "a fresh page load of the start moves no focus"), so the mark expires.
   - Why 10 s: the slowest way back that loads the page is the update path: `applyUpdate` waits up to 3 s (`APPLY_TIMEOUT_MS`), the page then waits up to 3 s for the network before the worker serves its copy (`PAGE_TIMEOUT_MS`), and the start reads the mark on its first render after hydration. A fresh load within 10 s of a mark no start took still focuses the step 1 title; that costs nothing worse than a focused title.
3. **A stored round whose deck has no copy, offline.** `/play` (served by the worker) shows `LoadFailed`, deals nothing, writes no progress and stays on `/play`. Try again repeats the index and deck requests: offline the message stays, and back online the round is dealt and the deck cached. "Leave round" goes home at once, without the "Leave round?" sheet. It calls `markReturnToStart`, then `backToStart`, else `router.replace("/")`. Offline that last step is the worker-served full load of rule 1.
4. **Engines.** The e2e spec goes offline with task 6's kit (the proxy drops every connection, `navigator.onLine` reads false), the one way every offline spec goes offline, so it runs in `phone-chromium` and `phone-webkit` and nothing is skipped (check C2; `context.setOffline` is not used).
5. **A network that is gone while the browser says it is online** (spec section 8: such a fetch "takes the existing paths"). With only `net.setOffline(true)`, `navigator.onLine` stays true: the deck step offers every deck, Start round on a deck with no copy goes through the same fallback to a worker-served `/play`, which shows the load failure of rule 3, and Leave round gets home.

**Tests:**

`tests/next-offline-fallback.test.ts` (new, node): this file pins rule 1. It passes from the start, because it pins behaviour that must not change. It tests `next.config.ts` and Next's own client router, not a file of `src/`, so it sits at the root of `tests/`, beside `tests/security-headers.test.ts`, which also reads `next.config.ts`.

```ts
// Spec section 8, "Moving to /play offline" and "Coming back to the start offline", decided by check C1 of the
// step 3 plan: when the React Server Components fetch of a client navigation fails (the browser is offline),
// Next.js 16.3.8 falls back to a full document navigation (location.assign for router.push, location.replace
// for router.replace), and the service worker answers that navigation from its cache. So the start flow keeps
// router.push("/play") and the play screen keeps router.replace("/"). These tests pin the two things that
// fallback rests on; when one fails after a Next.js upgrade, run check C1 again before changing the test.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

const require = createRequire(import.meta.url);
const NEXT_CLIENT = join(dirname(require.resolve("next/package.json")), "dist", "client", "components");

function nextSource(path: string): string {
  return readFileSync(join(NEXT_CLIENT, path), "utf8");
}

describe("an offline client navigation becomes a document load", () => {
  it("does not turn on Next's offline mode, which waits for the network instead of loading the document", () => {
    const experimental = (nextConfig.experimental ?? {}) as Record<string, unknown>;
    expect(experimental.useOffline ?? false).toBe(false);
  });

  it("falls back to the browser's navigation when the payload fetch fails", () => {
    const fetching = nextSource("router-reducer/fetch-server-response.js");
    expect(fetching).toContain("Falling back to browser navigation.");
    expect(fetching).toContain("return originalUrl.toString();");
  });

  it("keeps the history a push or a replace would have made", () => {
    const router = nextSource("app-router.js");
    expect(router).toMatch(/if \(pushRef\.pendingPush\) \{\s*location\.assign\(canonicalUrl\);\s*\} else \{\s*location\.replace\(canonicalUrl\);/);
  });
});
```

`tests/app-state/services.test.ts`: append this block (the file already imports `afterEach`, `describe`, `expect`, `it` and `vi`, and runs in jsdom):

```ts
// Check C1 of the step 3 plan: offline, a way back from /play can be a full page load (Next falls back to the
// browser's navigation when the payload fetch fails), and the way back that applies an update is one too. A page
// load starts this module afresh, so the mark that the player is coming back from a round is kept in
// sessionStorage as well, for a short while, and the start still focuses its step 1 title.
describe("the mark that the player is coming back from /play", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("is read once on the same page", async () => {
    vi.resetModules();
    const fresh = await import("@/src/app-state/services");
    expect(fresh.takeReturnFromPlay()).toBe(false);
    fresh.markReturnFromPlay();
    expect(fresh.takeReturnFromPlay()).toBe(true);
    expect(fresh.takeReturnFromPlay()).toBe(false);
  });

  it("survives a page load in the same tab, and is read once there", async () => {
    vi.resetModules();
    const before = await import("@/src/app-state/services");
    before.markReturnFromPlay();
    expect(Number(window.sessionStorage.getItem(before.RETURN_KEY))).toBeGreaterThan(0);
    vi.resetModules();
    const after = await import("@/src/app-state/services");
    expect(after.takeReturnFromPlay()).toBe(true);
    expect(window.sessionStorage.getItem(after.RETURN_KEY)).toBeNull();
    expect(after.takeReturnFromPlay()).toBe(false);
  });

  it("is not there on a page load that no way back from /play started", async () => {
    vi.resetModules();
    const fresh = await import("@/src/app-state/services");
    expect(fresh.takeReturnFromPlay()).toBe(false);
  });

  it("counts for a short while only: a mark no start took does not move the focus of a later page load", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const markedAt = new Date("2026-10-07T10:00:00.000Z").getTime();
    vi.setSystemTime(markedAt);
    vi.resetModules();
    const before = await import("@/src/app-state/services");
    expect(before.RETURN_MAX_AGE_MS).toBe(10_000);
    before.markReturnFromPlay();
    // The way back stepped into a start the browser restored from its back-forward cache, whose effects do not
    // run again, so nothing took the mark. A load of the start a while later:
    vi.setSystemTime(markedAt + before.RETURN_MAX_AGE_MS + 1);
    vi.resetModules();
    const later = await import("@/src/app-state/services");
    expect(later.takeReturnFromPlay()).toBe(false);
    expect(window.sessionStorage.getItem(later.RETURN_KEY)).toBeNull();
  });

  it("still works on the same page when the browser blocks sessionStorage", async () => {
    vi.resetModules();
    const fresh = await import("@/src/app-state/services");
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    fresh.markReturnFromPlay();
    expect(fresh.takeReturnFromPlay()).toBe(true);
    expect(fresh.takeReturnFromPlay()).toBe(false);
  });
});
```

`tests/components/play/PlayScreenOffline.test.tsx` (new, jsdom): this file pins rule 3. It passes from the start, because the screen already behaves this way, and it guards that behaviour from now on.

```tsx
// @vitest-environment jsdom
// Step 3 spec section 10 (as amended in section 14): offline, a stored round (truthy.pending.v1) whose deck has no
// copy on the device. The index is on the device (the start flow loaded it once), the deck is not, and every request
// fails. /play shows the existing load failure message with Try again, and its way back (the header's Leave round)
// goes to the start.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayScreen } from "@/components/play/PlayScreen";
import { INDEX_CACHE_KEY, deckCacheKey } from "@/src/content/load";
import { PROGRESS_KEY } from "@/src/progress/local";
import { DECK, DECK_ID, INDEX, harness, memoryStorage, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  router.replace.mockReset();
  router.push.mockReset();
});
afterEach(cleanup);

/** Offline, with the index on the device and no copy of the deck. */
function offlineWithoutDeck(): Harness {
  const h = harness(undefined, memoryStorage({ [INDEX_CACHE_KEY]: JSON.stringify(INDEX) }));
  h.network.online = false;
  return h;
}

describe("PlayScreen offline: a stored round whose deck has no copy", () => {
  it("shows the load failure message with Try again, deals nothing and stays on /play", async () => {
    const h = offlineWithoutDeck();
    render(<PlayScreen services={h.services} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("This deck didn't loadCheck your connection and try again.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Leave round" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "True" })).toBeNull();
    expect(h.network.calls).toEqual(["/decks/index.json", `/decks/${DECK_ID}.json?v=${DECK.hash}`]);
    expect(h.local.data.has(PROGRESS_KEY)).toBe(false);
    expect(h.local.data.has(deckCacheKey(DECK_ID))).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("keeps the message on Try again while still offline, and deals the round once the network is back", async () => {
    const h = offlineWithoutDeck();
    render(<PlayScreen services={h.services} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(h.network.calls).toHaveLength(4));
    expect((await screen.findByRole("alert")).textContent).toContain("This deck didn't load");
    h.network.online = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "True" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(h.local.data.has(deckCacheKey(DECK_ID))).toBe(true);
  });

  it("goes to the start with Leave round, in place of /play when the start's entry is not behind it", async () => {
    const h = offlineWithoutDeck();
    const backToStart = vi.fn(() => false);
    const markReturnToStart = vi.fn();
    h.services = { ...h.services, backToStart, markReturnToStart };
    render(<PlayScreen services={h.services} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(markReturnToStart).toHaveBeenCalledTimes(1);
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(h.local.data.has(PROGRESS_KEY)).toBe(false);
  });

  it("goes back to the start's entry with Leave round when it is right behind /play", async () => {
    const h = offlineWithoutDeck();
    const backToStart = vi.fn(() => true);
    h.services = { ...h.services, backToStart };
    render(<PlayScreen services={h.services} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
```

`e2e/offline-navigation.spec.ts` (new): rules 1 to 5, in a production build with the worker. The first online round on the deck is left at once: no answers are saved, and the device then holds the deck. `deckAnswers` uses Playwright's request context, which goes through the same proxy, so the Streak cases read the answers before going offline.

```ts
// Step 3 spec section 8, "Moving to /play offline" and "Coming back to the start offline", as check C1 of the plan
// found them: offline, the router's payload fetch fails and Next.js loads the document instead, which the service
// worker serves from its cache. Every way between the start and /play works offline: Start round, and Leave round,
// Choose another route and Close results on a /play with no start entry behind it (every /play an offline Start
// round opens is a fresh document). The start still focuses its step 1 title after such a load. Also spec section
// 10 as amended in section 14: a stored round whose deck has no copy shows the load failure with Try again, and
// Leave round goes home; and section 8's network that fails while the browser still says it is online.
import { expect, type Page, type Response } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  answerCard,
  atHome,
  chooseRoute,
  deckAnswers,
  inClass,
  openHome,
  seeResults,
  stepTitle,
} from "./helpers";
import { goOffline, test, waitForWorker } from "./offline";

test.use({ reducedMotion: "reduce", serviceWorkers: "allow" });

// Offline is the test's proxy dropping every connection (e2e/offline.ts), not context.setOffline: in Playwright
// 1.63's WebKit an offline context fails every page request before the service worker sees it (check C2 of the
// plan), so this spec runs in both engines.

/** The next document load of `path`, as the page receives it. */
function documentLoad(page: Page, path: string): Promise<Response> {
  return page.waitForResponse((response) => response.request().isNavigationRequest() && new URL(response.url()).pathname === path);
}

/** The start at step 1 in a document the worker served, with the step 1 title focused (a way back from /play). */
async function expectStartFromWorker(page: Page, load: Promise<Response>): Promise<void> {
  const response = await load;
  expect(response.status()).toBe(200);
  expect(response.fromServiceWorker()).toBe(true);
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toHaveText("Choose an area");
  await expect(stepTitle(page)).toBeFocused();
  await atHome(page);
}

/**
 * Opens the start online until the worker controls it, then starts a round on CLF / SEC in `mode` and leaves it at
 * once, so the device holds the deck (the online round loaded it). Back at step 1 of the start.
 */
async function playedOnce(page: Page, mode: "Classic" | "Streak"): Promise<void> {
  await openHome(page);
  await waitForWorker(page);
  await chooseRoute(page, inClass(CLF_SECURITY, mode));
  await page.getByRole("button", { name: "Start round" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("button", { name: "True", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Leave round" }).click();
  await atHome(page);
}

/** Start round, offline: /play is a document the worker served, with the round's first card. */
async function startRoundOffline(page: Page): Promise<void> {
  const load = documentLoad(page, "/play");
  await page.getByRole("button", { name: "Start round" }).click();
  const response = await load;
  expect(response.status()).toBe(200);
  expect(response.fromServiceWorker()).toBe(true);
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("button", { name: "True", exact: true })).toBeVisible();
}

test("offline, Start round opens /play from the worker, and Leave round comes back to the start from the worker", async ({ page, net }) => {
  await playedOnce(page, "Classic");
  await goOffline(page, net);
  await chooseRoute(page, CLF_SECURITY);
  await startRoundOffline(page);
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();

  const home = documentLoad(page, "/");
  await page.getByRole("button", { name: "Leave round" }).click();
  await expectStartFromWorker(page, home);
});

for (const control of ["Choose another route", "Close results"]) {
  test(`offline, ${control} on the result comes back to the start from the worker`, async ({ page, net }) => {
    await playedOnce(page, "Streak");
    const answers = await deckAnswers(page, CLF_ID);
    await goOffline(page, net);
    await chooseRoute(page, inClass(CLF_SECURITY, "Streak"));
    await startRoundOffline(page);
    await answerCard(page, answers, 1, false);
    await seeResults(page);
    // The result's actions take presses once they have arrived: ResultView drops pointer-events-none from them
    // when RESULT_ARRIVES_MS has passed.
    await expect(page.getByRole("button", { name: "Close results" })).not.toHaveClass(/\bpointer-events-none\b/);

    const home = documentLoad(page, "/");
    await page.getByRole("button", { name: control }).click();
    await expectStartFromWorker(page, home);
  });
}

test("offline, a stored round whose deck has no copy shows the load failure, and Leave round goes to the start", async ({ page, net }) => {
  await openHome(page);
  await waitForWorker(page);
  await goOffline(page, net);
  await page.evaluate(() =>
    sessionStorage.setItem("truthy.pending.v1", JSON.stringify({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" })),
  );

  let deckRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === `/decks/${CLF_ID}.json`) deckRequests += 1;
  });
  const response = await page.goto("/play");
  expect(response?.status()).toBe(200);
  expect(response?.fromServiceWorker()).toBe(true);
  // Next's route announcer is an alert too: the message is the one in <main>.
  const alert = page.locator("main").getByRole("alert");
  await expect(alert).toContainText("This deck didn't load");
  await expect(alert).toContainText("Check your connection and try again.");
  await expect.poll(() => deckRequests).toBe(1);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => deckRequests).toBe(2);
  await expect(alert).toContainText("This deck didn't load");
  await expect(page.getByRole("button", { name: "True", exact: true })).toHaveCount(0);

  const home = documentLoad(page, "/");
  await page.getByRole("button", { name: "Leave round" }).click();
  await expectStartFromWorker(page, home);
});

test("a network that is gone while the browser still says it is online: a deck with no copy ends at the load failure, and Leave round goes home", async ({ page, net }) => {
  await openHome(page);
  await waitForWorker(page);
  // The connection is gone, but navigator.onLine stays true, as on a Wi-Fi without internet.
  net.setOffline(true);
  const reached = await page.evaluate(() =>
    fetch("/decks/index.json", { cache: "no-store" }).then(
      () => true,
      () => false,
    ),
  );
  expect(reached).toBe(false);
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);

  const opened = await page.reload();
  expect(opened?.fromServiceWorker()).toBe(true);
  await atHome(page);
  // The deck step offers every deck as it does online, CLF too, which the device holds no copy of.
  await chooseRoute(page, CLF_SECURITY);
  const play = documentLoad(page, "/play");
  await page.getByRole("button", { name: "Start round" }).click();
  expect((await play).fromServiceWorker()).toBe(true);
  await expect(page).toHaveURL(/\/play$/);
  const alert = page.locator("main").getByRole("alert");
  await expect(alert).toContainText("This deck didn't load");
  await expect(alert).toContainText("Check your connection and try again.");

  const home = documentLoad(page, "/");
  await page.getByRole("button", { name: "Leave round" }).click();
  await expectStartFromWorker(page, home);
});
```

**Steps:**

- [ ] **Step 1: Write the tests.** Create `tests/next-offline-fallback.test.ts`, `tests/components/play/PlayScreenOffline.test.tsx` and `e2e/offline-navigation.spec.ts`, and append the block to `tests/app-state/services.test.ts`, all as above.

- [ ] **Step 2: Run them and watch the right ones fail.**

```bash
pnpm vitest run tests/app-state/services.test.ts tests/next-offline-fallback.test.ts tests/components/play/PlayScreenOffline.test.tsx
```

Expected: two failures, the others green.

```
     × survives a page load in the same tab, and is read once there
AssertionError: expected 0 to be greater than 0
     × counts for a short while only: a mark no start took does not move the focus of a later page load
AssertionError: expected undefined to be 10000 // Object.is equality
 Test Files  1 failed | 2 passed (3)
      Tests  2 failed | 18 passed (20)
```

`pnpm typecheck` fails on the missing exports: `error TS2339: Property 'RETURN_KEY' does not exist on type 'typeof import(".../src/app-state/services")'` in `tests/app-state/services.test.ts` (three times), and the same for `'RETURN_MAX_AGE_MS'` (twice). `next build` type-checks the tests too, so the e2e spec runs after step 3. Without step 3, every case of it fails at its last `toBeFocused` (the draft's first four cases did, in Chromium, with the old mark): the worker-served documents, the URLs and the step 1 title are all right before that line.

- [ ] **Step 3: Keep the return mark across a document load** (rule 2). In `src/app-state/services.ts`, replace the block from the comment "Whether the player has just left /play for the start with one of its controls" to the end of the file with:

```ts
// Whether the player has just left /play for the start with one of its controls (Choose another route,
// Close results, Leave round). The start flow then focuses its step 1 title, which a fresh page load does
// not. It is read once. Offline, and when a waiting update is applied, the way back is a full page load, which
// starts this module afresh, so the mark is also kept in sessionStorage under RETURN_KEY, where the start reads
// it after that load. The stored mark counts for RETURN_MAX_AGE_MS only: one that no start took (a way back
// into a start restored from the back-forward cache, a load that was cut off) must not move the focus of a
// later fresh load.
let returningFromPlay = false;

/** The sessionStorage key of the mark that the player is coming back from /play: the time it was set, in ms. */
export const RETURN_KEY = "truthy.return.v1";

/**
 * How long the stored mark counts. The slowest way back that loads the page applies an update first (up to 3 s),
 * then the page may wait 3 s for the network before the worker serves its copy, then hydrates.
 */
export const RETURN_MAX_AGE_MS = 10_000;

/** /play is sending the player back to the start with one of its controls. */
export function markReturnFromPlay(): void {
  if (typeof window === "undefined") return;
  returningFromPlay = true;
  try {
    browserSessionStorage()?.setItem(RETURN_KEY, String(Date.now()));
  } catch {
    // Storage full or blocked: the mark in memory still serves a way back within the page.
  }
}

/** Whether the start is being opened by a way back from /play; clears the mark in memory and in sessionStorage. */
export function takeReturnFromPlay(): boolean {
  let stored = false;
  if (typeof window !== "undefined") {
    try {
      const storage = browserSessionStorage();
      const markedAt = Number(storage?.getItem(RETURN_KEY) ?? Number.NaN);
      const age = Date.now() - markedAt;
      stored = age >= 0 && age <= RETURN_MAX_AGE_MS;
      storage?.removeItem(RETURN_KEY);
    } catch {
      // Blocked storage: only the mark in memory counts.
    }
  }
  const was = returningFromPlay || stored;
  returningFromPlay = false;
  return was;
}
```

- [ ] **Step 4: Run the unit tests green.**

```bash
pnpm vitest run tests/app-state/services.test.ts tests/next-offline-fallback.test.ts tests/components/play/PlayScreenOffline.test.tsx
```

Expected:

```
 Test Files  3 passed (3)
      Tests  20 passed (20)
```

(services 13, next-offline-fallback 3, PlayScreenOffline 4.) `pnpm typecheck` prints nothing after the command line.

- [ ] **Step 5: Run the offline spec and the specs that use the return mark and the history** (port 3717 free):

```bash
E2E_PORT=3717 pnpm exec playwright test e2e/offline-navigation.spec.ts e2e/return-focus.spec.ts e2e/reload-history.spec.ts e2e/history.spec.ts e2e/navigation.spec.ts e2e/direct-play.spec.ts e2e/storage-blocked.spec.ts e2e/quick-back.spec.ts
```

Expected: `50 passed`, nothing skipped: the five cases of `offline-navigation.spec.ts` in both projects, and the 40 tests of the seven other specs as before. The offline cases are, in each project:

```
  ✓  [phone-chromium] › e2e/offline-navigation.spec.ts › offline, Start round opens /play from the worker, and Leave round comes back to the start from the worker
  ✓  [phone-chromium] › e2e/offline-navigation.spec.ts › offline, Choose another route on the result comes back to the start from the worker
  ✓  [phone-chromium] › e2e/offline-navigation.spec.ts › offline, Close results on the result comes back to the start from the worker
  ✓  [phone-chromium] › e2e/offline-navigation.spec.ts › offline, a stored round whose deck has no copy shows the load failure, and Leave round goes to the start
  ✓  [phone-chromium] › e2e/offline-navigation.spec.ts › a network that is gone while the browser still says it is online: a deck with no copy ends at the load failure, and Leave round goes home
```

and the same five in `[phone-webkit]`. The page logs "Failed to fetch RSC payload for http://localhost:<port>/play?_rsc=... Falling back to browser navigation." as a console error on each offline move (the port is the proxy's). That is the fallback this task pins. No spec fails on console errors.

- [ ] **Step 6: Run the gates.**

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: `tsc --noEmit` prints nothing; `pnpm test` ends with `Test Files  147 passed (147)`, `Tests  2338 passed (2338)` (task 6's 145 files and 2325 tests, plus 2 files and 13 tests: next-offline-fallback 3, PlayScreenOffline 4, the services block 5, and the e2e guard's case for `offline-navigation.spec.ts`); `pnpm build` exits 0 and the route table lists `/` and `/play` as static, `○`.

  On a machine under heavy load (load average near 40, with other checkouts running their suites), some long jsdom play screen tests can hit Vitest's 5000 ms timeout, for example `tests/play/leave-decided-polish.test.tsx` or `tests/components/play/PlayScreenResult.test.tsx`. They pass when run alone (`pnpm vitest run <file> --maxWorkers=1`). Rerun the suite on a quiet machine rather than raising timeouts.

- [ ] **Step 7: Commit.**

```bash
git add src/app-state/services.ts tests/app-state/services.test.ts tests/next-offline-fallback.test.ts tests/components/play/PlayScreenOffline.test.tsx e2e/offline-navigation.spec.ts
git commit -m "feat: keep the way between the start and /play working offline through the router's page load fallback, with the step 1 focus kept across that load"
```

**Tried** (worktree at 5db53f3, with task 3's worker and task 4's registration stood in by hand-written versions of the same behaviour): the fallback and PlayScreenOffline tests passed from the start; with the old mark, the e2e spec's first four cases failed in Chromium at `toBeFocused` only; with the mark kept in sessionStorage they passed in Chromium (WebKit was skipped then, on `context.setOffline`). Task 8's draft then ran the same four cases through the proxy kit: 8 passed in both engines, nothing skipped. The pre-run version wrote `"1"` as the mark; the review made it a time that expires (rule 2), added the expiry case, replaced a fixed wait for the result's actions with the condition above, and added the case of rule 5. The plan as written was then run once more in a scratch copy (README): the unit tests failed first exactly as step 2 says and passed after step 3, and the five e2e cases passed in both engines (10). The fallback test was `tests/offline/navigation.test.ts` in those runs; the second review moved it, unchanged, to the root of `tests/` (it mirrors no file of `src/`), and in the same scratch copy the three files of step 4 then passed again (20) with `tsc --noEmit` clean. The counts above are for the plan's task order.
