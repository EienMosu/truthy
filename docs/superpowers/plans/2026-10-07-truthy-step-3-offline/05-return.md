### Task 5: A waiting update takes over on the way back to the start

**Prerequisite: task 4.** This task builds on `src/offline/register.ts` (`OfflineClient`, `noOfflineClient`), `AppServices.offline` with `browserAppServices.offline = browserOfflineClient`, and `offline: noOfflineClient` in the fakes of `tests/components/play/fixtures.ts`, `tests/components/start/fixtures.ts` and `tests/components/start/useCatalog.test.tsx`, all of which task 4 creates. It changes none of them. If any is missing (`grep -n "offline: OfflineClient" src/app-state/services.ts` prints nothing), stop: task 4 has not landed.

Spec section 7, the second safe moment: when the player comes back to the start from a round with one of the play screen's own controls (Choose another route, Close results, Leave round, also the Leave round of the loading and load failure screens) and a new version of the worker is waiting, the page asks it to take over and opens the start with a full page load instead of the in-app navigation. With nothing waiting the way back is exactly today's, and the worker is asked to look for a new version so that the next safe moment finds it. Nothing that happens while a round is open looks at the waiting worker: not an answer, not the leave sheet kept with Keep playing, not Play again, not the back gesture, not `/play` sending a page load without a round (or with a route that is gone) to the start.

**Files:**
- Create: `src/app-state/to-start.ts`
- Modify: `components/play/PlayScreen.tsx` (`leaveToStart` only)
- Test: create `tests/app-state/to-start.test.ts`, `tests/components/play/PlayScreenUpdate.test.tsx`

**Interfaces:**
- Consumes (task 4 is a hard prerequisite, see above):
  - Task 4, `src/offline/register.ts`: `interface OfflineClient { start(): Promise<void>; updateWaiting(): boolean; applyUpdate(): Promise<boolean>; checkForUpdate(): Promise<void> }` (`applyUpdate` resolves true once `controllerchange` fires, false when nothing waits or after 3 s), `noOfflineClient`.
  - Task 4, `src/app-state/services.ts`: `AppServices.offline: OfflineClient`; `PlayServices` (`components/play/useRound.ts`) extends `AppServices`, so `browserPlayServices.offline` is `browserOfflineClient`, and the play fixtures' `harness()` carries `offline: noOfflineClient`.
  - `components/play/useRound.ts` as it is: `PlayServices.backToStart?: () => boolean`, `PlayServices.markReturnToStart?: () => void`.
  - `components/play/PlayScreen.tsx` as it is: `goHome` (back to the start's entry, else `router.replace("/")`), used by `useRound` for the automatic ways home and by the `pageshow` handler; `leaveToStart`, used by Leave round (round, loading, load failure) and by the result's Choose another route and Close results.
  - `tests/components/play/fixtures.ts`: `harness(pending?, local?)`, `cardByStatement`, `DECK_ID`; `NEXT_ARRIVES_MS`, `RESULT_ARRIVES_MS`.
- Produces:

```ts
// src/app-state/to-start.ts
/** What goToStart needs of the play screen's services (PlayServices has all of it). */
export interface ToStartServices {
  offline: AppServices["offline"];
  backToStart?: () => boolean;
}
export async function goToStart(services: ToStartServices, router: { replace(href: string): void }): Promise<void>;
```

**Where this differs from the brief, and why:**
1. The brief writes `goToStart(services: PlayServices, ...)`. `PlayServices` lives in `components/play/useRound.ts`, and nothing in `src/` imports from `components/` (the layering the boundary checks keep). `goToStart` takes `ToStartServices`, the two fields it uses, declared in `src/app-state/to-start.ts`; every `PlayServices` is one, so the play screen passes its services unchanged.
2. The brief writes `window.location.assign("/")`. This task uses `window.location.replace("/")`, the full load counterpart of today's `router.replace("/")`: with `assign`, `/play` stays in the history right behind the new start, and a back step from the start reopens `/play`, which deals the stored round again (`truthy.pending.v1` stays in sessionStorage, check C1). Check C1 leaves the method to this task ("may keep"); task 8's update spec asserts on the page, not on the history length.
3. The in-app way back also calls `services.offline.checkForUpdate()` (spec section 7: the registration checks for an update "when the player comes back to the start"; the brief's `goToStart` line does not name it). It runs after the navigation and its failure is swallowed, so the way back is as fast as today.

**Rules:**
1. `goToStart(services, router)`:
   - `services.offline.updateWaiting()` true: `await services.offline.applyUpdate()` (a rejection counts as false). True: `window.location.replace("/")` and nothing else (no `backToStart`, no `router.replace`, no `checkForUpdate`). False (the worker did not take over within 3 s): the in-app way below.
   - Nothing waiting: the in-app way of today, `if (!services.backToStart?.()) router.replace("/")`, run synchronously, before the returned promise settles (the existing tests click and assert `router.replace` without waiting). Then `services.offline.checkForUpdate()`, its rejection caught.
   - The promise never rejects.
2. `PlayScreen`'s `leaveToStart` (and only it) calls `goToStart(services, router)` after `services.markReturnToStart?.()`. `goHome` is unchanged and stays the automatic way home (no stored round, a route that is gone, a left round back from the back-forward cache): those are not a way back by the player and apply no update.
3. While a `goToStart` started by `leaveToStart` has not settled (at most the 3 s of `applyUpdate`), another press of a way back does nothing (a ref, `goingToStart`). Without it a second press while the worker takes over would find nothing waiting any more and start an in-app navigation under the full load.
4. The round is left before the update is looked at: `leave` saves the left round and dispatches `abandon` before it calls `leaveToStart`, and a finished round is recorded when its result opens. So `applyUpdate` never runs with an unsaved round, and the screen shows the loading placeholder (a left round) or the result (Choose another route, Close results) while it waits.
5. The step 1 focus after the update load. `markReturnToStart` sets an in-memory mark, which the page that `location.replace("/")` loads does not have (check C1, side finding 1). Until task 7, the start therefore does not focus its step 1 title after the update load; task 7 keeps the mark in sessionStorage too (`RETURN_KEY`), which restores the focus with no change here, and task 8's update spec checks it. This is not accepted behaviour, only the state between the two tasks.

**Steps:**

- [ ] **Step 1: Write the unit tests of `goToStart`.** Create `tests/app-state/to-start.test.ts` (node environment; `window` is stubbed with a fake `location`):

```ts
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { goToStart, type ToStartServices } from "@/src/app-state/to-start";
import { noOfflineClient, type OfflineClient } from "@/src/offline/register";

// Spec section 7, the second safe moment: a way back to the start from a round applies a waiting update
// and opens the start with a full page load; with nothing waiting it is the in-app way back of today.

const location = vi.hoisted(() => ({ replace: vi.fn() }));

beforeEach(() => {
  location.replace.mockReset();
  vi.stubGlobal("window", { location });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

interface FakeOffline extends OfflineClient {
  updateWaiting: Mock<() => boolean>;
  applyUpdate: Mock<() => Promise<boolean>>;
  checkForUpdate: Mock<() => Promise<void>>;
}

function fakeOffline(waiting: boolean, takesOver: () => Promise<boolean> = async () => true): FakeOffline {
  return {
    start: async () => {},
    updateWaiting: vi.fn(() => waiting),
    applyUpdate: vi.fn(takesOver),
    checkForUpdate: vi.fn(async () => {}),
  };
}

function servicesWith(offline: OfflineClient, backToStart?: () => boolean): ToStartServices {
  return backToStart ? { offline, backToStart } : { offline };
}

describe("goToStart: an update is waiting", () => {
  it("applies it and opens the start with a full page load in place of /play", async () => {
    const offline = fakeOffline(true);
    const backToStart = vi.fn(() => true);
    const router = { replace: vi.fn() };
    await goToStart(servicesWith(offline, backToStart), router);
    expect(offline.applyUpdate).toHaveBeenCalledTimes(1);
    expect(location.replace).toHaveBeenCalledTimes(1);
    expect(location.replace).toHaveBeenCalledWith("/");
    expect(backToStart).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(offline.checkForUpdate).not.toHaveBeenCalled();
  });

  it("loads the page only after the new worker has taken over", async () => {
    let takeOver: (value: boolean) => void = () => {};
    const offline = fakeOffline(true, () => new Promise<boolean>((resolve) => (takeOver = resolve)));
    const router = { replace: vi.fn() };
    const going = goToStart(servicesWith(offline), router);
    await Promise.resolve();
    expect(offline.applyUpdate).toHaveBeenCalledTimes(1);
    expect(location.replace).not.toHaveBeenCalled();
    takeOver(true);
    await going;
    expect(location.replace).toHaveBeenCalledWith("/");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("takes the in-app way back when the worker does not take over in time", async () => {
    const offline = fakeOffline(true, async () => false);
    const backToStart = vi.fn(() => false);
    const router = { replace: vi.fn() };
    await goToStart(servicesWith(offline, backToStart), router);
    expect(location.replace).not.toHaveBeenCalled();
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("takes the in-app way back when applying the update fails", async () => {
    const offline = fakeOffline(true, () => Promise.reject(new Error("InvalidStateError")));
    const router = { replace: vi.fn() };
    await expect(goToStart(servicesWith(offline), router)).resolves.toBeUndefined();
    expect(location.replace).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});

describe("goToStart: nothing is waiting", () => {
  it("goes back to the start's entry when it is right behind /play, and applies nothing", async () => {
    const offline = fakeOffline(false);
    const backToStart = vi.fn(() => true);
    const router = { replace: vi.fn() };
    await goToStart(servicesWith(offline, backToStart), router);
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
    expect(offline.applyUpdate).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("replaces /play with / when the start's entry is not behind it", async () => {
    const offline = fakeOffline(false);
    const backToStart = vi.fn(() => false);
    const router = { replace: vi.fn() };
    await goToStart(servicesWith(offline, backToStart), router);
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("replaces /play with / when there is no backToStart (the tests' services)", async () => {
    const router = { replace: vi.fn() };
    await goToStart(servicesWith(noOfflineClient), router);
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("moves at once, before the returned promise settles, as the way back does today", () => {
    const backToStart = vi.fn(() => false);
    const router = { replace: vi.fn() };
    void goToStart(servicesWith(fakeOffline(false), backToStart), router);
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("asks the worker to look for a new version once it has moved", async () => {
    const offline = fakeOffline(false);
    const router = { replace: vi.fn() };
    await goToStart(servicesWith(offline), router);
    expect(offline.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(router.replace.mock.invocationCallOrder[0]).toBeLessThan(offline.checkForUpdate.mock.invocationCallOrder[0] ?? 0);
  });

  it("still goes back when the look for a new version fails", async () => {
    const offline = fakeOffline(false);
    offline.checkForUpdate.mockImplementation(() => Promise.reject(new Error("network")));
    const router = { replace: vi.fn() };
    await expect(goToStart(servicesWith(offline), router)).resolves.toBeUndefined();
    await Promise.resolve();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 2: Write the play screen tests.** Create `tests/components/play/PlayScreenUpdate.test.tsx` (jsdom; `location` is stubbed with `vi.stubGlobal`, which replaces `window.location` in jsdom; `vi.spyOn(window.location, "replace")` throws "Cannot redefine property: replace" there):

```tsx
// @vitest-environment jsdom
// Spec section 7: a new version waits until a safe moment. On /play the only safe moments are the player's
// own ways back to the start (Choose another route, Close results, Leave round); nothing during a round
// looks at the waiting worker.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NEXT_ARRIVES_MS, PlayScreen } from "@/components/play/PlayScreen";
import { RESULT_ARRIVES_MS } from "@/components/play/ResultView";
import type { OfflineClient } from "@/src/offline/register";
import { PROGRESS_KEY } from "@/src/progress/local";
import { parseProgress } from "@/src/progress/progress";
import { DECK_ID, cardByStatement, harness, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const location = vi.hoisted(() => ({ replace: vi.fn() }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  router.replace.mockReset();
  router.push.mockReset();
  location.replace.mockReset();
  vi.stubGlobal("location", location);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface FakeOffline extends OfflineClient {
  updateWaiting: Mock<() => boolean>;
  applyUpdate: Mock<() => Promise<boolean>>;
  checkForUpdate: Mock<() => Promise<void>>;
}

function fakeOffline(waiting: boolean, takesOver: () => Promise<boolean> = async () => true): FakeOffline {
  return {
    start: async () => {},
    updateWaiting: vi.fn(() => waiting),
    applyUpdate: vi.fn(takesOver),
    checkForUpdate: vi.fn(async () => {}),
  };
}

/** A harness whose offline client is the fake. */
function withOffline(offline: OfflineClient, setup: Harness = harness()): Harness {
  setup.services = { ...setup.services, offline };
  return setup;
}

let h: Harness;

async function start(setup: Harness) {
  h = setup;
  const view = render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000);
  return view;
}

function statementText(): string | null | undefined {
  return document.querySelector("[data-statement] p:last-of-type")?.textContent;
}

async function pressNext() {
  const next = await screen.findByRole("button", { name: /^(Next card|See results)$/ });
  h.advance(NEXT_ARRIVES_MS);
  fireEvent.click(next);
}

async function answerAndNext(value: boolean) {
  fireEvent.click(screen.getByRole("button", { name: value ? "True" : "False" }));
  await pressNext();
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000);
}

/** Answers the cards on screen, one per entry of right (right or wrong), then waits for the result's actions. */
async function answerAll(right: readonly boolean[]) {
  for (const ok of right) {
    await screen.findByRole("button", { name: "True" });
    await act(async () => {});
    h.advance(1000);
    const answer = cardByStatement(statementText()).answer;
    fireEvent.click(screen.getByRole("button", { name: (ok ? answer : !answer) ? "True" : "False" }));
    await pressNext();
  }
  await screen.findByRole("heading", { name: "Round complete" });
  h.advance(RESULT_ARRIVES_MS);
}

async function playToResult(setup: Harness) {
  h = setup;
  render(<PlayScreen services={h.services} />);
  await answerAll(SEVEN_OF_TEN);
}

const SEVEN_OF_TEN = [true, true, false, true, true, false, true, true, false, true];

describe("PlayScreen: a waiting update is applied on the way back to the start", () => {
  it.each(["Choose another route", "Close results"])("applies it on %s and opens the start with a full page load", async (name) => {
    const offline = fakeOffline(true);
    const markReturnToStart = vi.fn();
    const setup = withOffline(offline);
    setup.services = { ...setup.services, markReturnToStart };
    await playToResult(setup);
    expect(offline.updateWaiting).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name }));
    await waitFor(() => expect(location.replace).toHaveBeenCalledWith("/"));
    expect(offline.applyUpdate).toHaveBeenCalledTimes(1);
    expect(location.replace).toHaveBeenCalledTimes(1);
    expect(markReturnToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("applies it on Leave round before the first answer, and does not go back in the history", async () => {
    const offline = fakeOffline(true);
    const backToStart = vi.fn(() => true);
    const setup = withOffline(offline);
    setup.services = { ...setup.services, backToStart };
    await start(setup);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    await waitFor(() => expect(location.replace).toHaveBeenCalledWith("/"));
    expect(backToStart).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("saves the round that is left before it applies the update", async () => {
    let savedWhenApplied: string[] = [];
    const offline = fakeOffline(true, async () => {
      savedWhenApplied = Object.keys(parseProgress(h.local.getItem(PROGRESS_KEY)).cards);
      return true;
    });
    await start(withOffline(offline));
    const first = cardByStatement(statementText());
    await answerAndNext(first.answer);
    expect(offline.updateWaiting).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave round" }));
    await waitFor(() => expect(location.replace).toHaveBeenCalledWith("/"));
    expect(savedWhenApplied).toEqual([first.id]);
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).records).toEqual({});
  });

  it("applies it on Leave round when the deck did not load", async () => {
    const offline = fakeOffline(true);
    h = withOffline(offline);
    h.network.online = false;
    render(<PlayScreen services={h.services} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    await waitFor(() => expect(location.replace).toHaveBeenCalledWith("/"));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("ignores another way back while the update is being applied", async () => {
    let takeOver: (value: boolean) => void = () => {};
    const offline = fakeOffline(true, () => new Promise<boolean>((resolve) => (takeOver = resolve)));
    await playToResult(withOffline(offline));
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    expect(offline.updateWaiting).toHaveBeenCalledTimes(1);
    expect(offline.applyUpdate).toHaveBeenCalledTimes(1);
    await act(async () => takeOver(true));
    await waitFor(() => expect(location.replace).toHaveBeenCalledTimes(1));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("takes the in-app way back when the new worker does not take over in time", async () => {
    const offline = fakeOffline(true, async () => false);
    await playToResult(withOffline(offline));
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(location.replace).not.toHaveBeenCalled();
  });
});

describe("PlayScreen: a waiting update is never applied during a round", () => {
  it("does not look at it while a round is played, while the leave sheet is open and kept, or on Play again", async () => {
    const offline = fakeOffline(true);
    await start(withOffline(offline));
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Keep playing" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await pressNext();
    await answerAll(SEVEN_OF_TEN.slice(1));
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await screen.findByRole("button", { name: "True" });
    await act(async () => {});
    h.advance(1000);
    await answerAndNext(true);
    expect(offline.updateWaiting).not.toHaveBeenCalled();
    expect(offline.applyUpdate).not.toHaveBeenCalled();
    expect(offline.checkForUpdate).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not apply it when /play sends a page load without a round to the start", async () => {
    const offline = fakeOffline(true);
    h = withOffline(offline, harness(null));
    render(<PlayScreen services={h.services} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(offline.updateWaiting).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("does not apply it when the stored round's section is gone", async () => {
    const offline = fakeOffline(true);
    h = withOffline(offline, harness({ route: { deckId: DECK_ID, sectionId: "OLD" }, mode: "classic" }));
    render(<PlayScreen services={h.services} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(offline.updateWaiting).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("does not apply it when the screen goes away mid-round (the back gesture)", async () => {
    const offline = fakeOffline(true);
    const view = await start(withOffline(offline));
    await answerAndNext(true);
    view.unmount();
    expect(offline.updateWaiting).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("does not apply it when a left round comes back from the back-forward cache", async () => {
    const offline = fakeOffline(true);
    await start(withOffline(offline));
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    fireEvent(window, new PageTransitionEvent("pagehide", { persisted: true }));
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(offline.updateWaiting).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
  });
});

describe("PlayScreen: nothing waiting", () => {
  it.each(["Choose another route", "Close results"])("%s goes back in the app at once and asks for a new version", async (name) => {
    const offline = fakeOffline(false);
    await playToResult(withOffline(offline));
    fireEvent.click(screen.getByRole("button", { name }));
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(offline.applyUpdate).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(offline.checkForUpdate).toHaveBeenCalledTimes(1));
  });

  it("Leave round goes back to the start's entry when it is behind /play", async () => {
    const offline = fakeOffline(false);
    const backToStart = vi.fn(() => true);
    const setup = withOffline(offline);
    setup.services = { ...setup.services, backToStart };
    await start(setup);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run them and watch them fail.**

```bash
pnpm vitest run tests/app-state/to-start.test.ts tests/components/play/PlayScreenUpdate.test.tsx
```

Expected: `tests/app-state/to-start.test.ts` fails to load with `Error: Cannot find package '@/src/app-state/to-start'`. In `PlayScreenUpdate.test.tsx` 8 fail and 7 pass (`Tests  8 failed | 7 passed (15)`):
- fail, `expected "vi.fn()" to be called with arguments: [ '/' ]` (no full load yet): "applies it on Choose another route …", "applies it on Close results …", "applies it on Leave round before the first answer …", "saves the round that is left before it applies the update", "applies it on Leave round when the deck did not load";
- fail, `expected "vi.fn()" to be called 1 times, but got 0 times`: "ignores another way back while the update is being applied" (`updateWaiting` is never asked), "Choose another route goes back in the app at once and asks for a new version" and the same for Close results (`checkForUpdate` is never called);
- pass already, pinning what must not change: the five "never applied during a round" cases, "takes the in-app way back when the new worker does not take over in time" and "Leave round goes back to the start's entry when it is behind /play".

- [ ] **Step 4: Write `goToStart`.** Create `src/app-state/to-start.ts`:

```ts
// The way back from a round to the start (spec section 7, the second safe moment). The play screen's own
// ways back (Choose another route, Close results, Leave round) come here once the round is left or finished,
// so a new version of the app that waits can take over without changing a round in progress.
import type { AppServices } from "./services";

/** What goToStart needs of the play screen's services (PlayServices has all of it). */
export interface ToStartServices {
  offline: AppServices["offline"];
  /** Goes back to the start flow's entry when it is right behind /play; false or left out: it is not. */
  backToStart?: () => boolean;
}

/**
 * Opens the start. When a new version waits and takes over, the start opens with a full page load, so the
 * page runs the new version's code; /play is replaced, so a back step does not lead into the left round.
 * Otherwise the in-app way of today: back to the start's entry, or / in place of /play, at once (before the
 * returned promise settles), and the worker is asked to look for a new version for the next safe moment.
 */
export async function goToStart(services: ToStartServices, router: { replace(href: string): void }): Promise<void> {
  if (services.offline.updateWaiting()) {
    const applied = await services.offline.applyUpdate().catch(() => false);
    if (applied) {
      window.location.replace("/");
      return;
    }
  }
  if (!services.backToStart?.()) router.replace("/");
  services.offline.checkForUpdate().catch(() => undefined);
}
```

- [ ] **Step 5: Use it for the play screen's ways back.** In `components/play/PlayScreen.tsx` add the import after `import { CloseIcon } from "@/components/icons";`:

```ts
import { goToStart } from "@/src/app-state/to-start";
```

and replace `leaveToStart` (with the comment above it) by:

```tsx
  // The player's own ways home (Leave round, Choose another route, Close results): the start then focuses its
  // step 1 title. A page load of /play without a round goes home too, but that is not a way back. They are
  // also the safe moment for a waiting update (spec section 7): goToStart applies it and opens the start with
  // a full page load. Until the way back it started has settled, another press of a way back does nothing.
  const goingToStart = useRef(false);
  const leaveToStart = useCallback(() => {
    if (goingToStart.current) return;
    goingToStart.current = true;
    services.markReturnToStart?.();
    void goToStart(services, router).finally(() => {
      goingToStart.current = false;
    });
  }, [router, services]);
```

`useRef` and `useCallback` are imported already. `goHome` stays as it is; it is still used by `useRound` and the `pageshow` handler.

- [ ] **Step 6: Run them green.**

```bash
pnpm vitest run tests/app-state/to-start.test.ts tests/components/play/PlayScreenUpdate.test.tsx
```

Expected: `Test Files  2 passed (2)`, `Tests  25 passed (25)`.

```bash
pnpm vitest run tests/components/play tests/play tests/app-state
```

Expected: all green. The existing tests that click a way back and assert `router.replace("/")` at once still pass: with `noOfflineClient` nothing waits and the in-app way runs synchronously.

- [ ] **Step 7: Run the gates.**

```bash
pnpm typecheck
pnpm test
pnpm build
E2E_PORT=3715 pnpm exec playwright test e2e/leave.spec.ts e2e/leave-polish.spec.ts e2e/return-focus.spec.ts e2e/history.spec.ts e2e/history-polish.spec.ts e2e/navigation.spec.ts e2e/first-round.spec.ts e2e/returning.spec.ts e2e/double-tap.spec.ts e2e/quick-back.spec.ts
```

Expected: `tsc --noEmit` prints nothing; `pnpm test` ends with `Test Files  141 passed (141)`, `Tests  2298 passed (2298)` (task 4's 139 files and 2273 tests, plus this task's 2 files and 25 tests); the build lists `/` and `/play` as `○ (Static)`; the e2e run `86 passed`, both engines: these are the specs that leave a round, close a result or choose another route, and with no worker waiting (task 1's `serviceWorkers: "block"`) every way back is today's. The update itself is driven end to end by task 8's update spec. On a heavily loaded machine the timing specs (`double-tap.spec.ts`, the 200 ms case) and the 5 s jsdom round tests can time out; rerun them alone before reading a failure as a regression.

- [ ] **Step 8: Commit.**

```bash
git add src/app-state/to-start.ts components/play/PlayScreen.tsx tests/app-state/to-start.test.ts tests/components/play/PlayScreenUpdate.test.tsx
git commit -m "feat: a waiting update takes over when the player goes back to the start from a round"
```

**Tried:** on a detached worktree at 5db53f3, with task 4's `register.ts`, `AppServices.offline` and the fixtures' `offline: noOfflineClient` written from the brief's signatures. Steps 1 to 3: the import error and `8 failed | 7 passed (15)` as written. Steps 4 to 6: `2 passed (2)`, `25 passed (25)`. Step 7: `pnpm typecheck` clean; `pnpm test` green (a first run under a load average near 50 timed out in a few 5 s round tests, which passed alone with `--testTimeout=30000` and in the full rerun); `pnpm build` green; the ten e2e specs against `pnpm start --port 3715`: 85 passed and 1 failed (`double-tap.spec.ts` 200 ms on Chromium, the second tap reached the continue line under that load), then that spec's Choose another route cases with `--repeat-each=4`: 16 passed. The full-suite count of step 7 is for the plan's task order.
