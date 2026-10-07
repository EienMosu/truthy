// @vitest-environment jsdom
// Spec section 7: a new version waits until a safe moment. On /play the only safe moments are the player's
// own ways back to the start (Choose another route, Close results, Leave round); nothing during a round
// looks at the waiting worker.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FULL_LOAD_WAIT_MS, NEXT_ARRIVES_MS, PlayScreen } from "@/components/play/PlayScreen";
import { RESULT_ARRIVES_MS } from "@/components/play/ResultView";
import { browserPlayServices } from "@/components/play/useRound";
import { RETURN_KEY, RETURN_MAX_AGE_MS, clearReturnFromPlay, markReturnFromPlay, takeReturnFromPlay } from "@/src/app-state/services";
import type { OfflineClient } from "@/src/offline/register";
import { PROGRESS_KEY } from "@/src/progress/local";
import { parseProgress } from "@/src/progress/progress";
import { fakeOffline } from "@/tests/offline/fake-offline";
import { DECK_ID, cardByStatement, harness, pendingFor, type Harness } from "./fixtures";

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

  // Owner decision D1: a decided round left before its result opens is recorded as its result would record it,
  // and the update's full page load must not lose that record.
  it("applies it on Leave round on a decided round before its result opens, and keeps the round's record", async () => {
    const offline = fakeOffline(true);
    await start(withOffline(offline, harness(pendingFor("streak"))));
    await answerAndNext(cardByStatement(statementText()).answer);
    await answerAndNext(cardByStatement(statementText()).answer);
    fireEvent.click(screen.getByRole("button", { name: cardByStatement(statementText()).answer ? "False" : "True" }));
    expect(await screen.findByRole("button", { name: "See results" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave round" }));
    await waitFor(() => expect(location.replace).toHaveBeenCalledWith("/"));
    expect(offline.applyUpdate).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).records).toEqual({ "test-deck/SEC#streak": 2 });
    expect(screen.queryByRole("heading", { name: "Round complete" })).toBeNull();
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

  it("ignores another way back after the page load has started, until the page is left", async () => {
    let takeOver: (value: boolean) => void = () => {};
    const offline = fakeOffline(true, () => new Promise<boolean>((resolve) => (takeOver = resolve)));
    const backToStart = vi.fn(() => true);
    const setup = withOffline(offline);
    setup.services = { ...setup.services, backToStart };
    await playToResult(setup);
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    await act(async () => takeOver(true));
    await waitFor(() => expect(location.replace).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    await act(async () => {});
    expect(offline.updateWaiting).toHaveBeenCalledTimes(1);
    expect(offline.applyUpdate).toHaveBeenCalledTimes(1);
    expect(location.replace).toHaveBeenCalledTimes(1);
    expect(backToStart).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("starts no new round with Play again while the update is being applied", async () => {
    let takeOver: (value: boolean) => void = () => {};
    const offline = fakeOffline(true, () => new Promise<boolean>((resolve) => (takeOver = resolve)));
    await playToResult(withOffline(offline));
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await act(async () => {});
    expect(screen.getByRole("heading", { name: "Round complete" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "True" })).toBeNull();
    await act(async () => takeOver(true));
    await waitFor(() => expect(location.replace).toHaveBeenCalledWith("/"));
    expect(screen.getByRole("heading", { name: "Round complete" })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("starts no new round with Play again once the page load has started", async () => {
    const offline = fakeOffline(true);
    await playToResult(withOffline(offline));
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    await waitFor(() => expect(location.replace).toHaveBeenCalledWith("/"));
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await act(async () => {});
    expect(screen.getByRole("heading", { name: "Round complete" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "True" })).toBeNull();
  });

  it("lifts the guard when the page load has not replaced the page after FULL_LOAD_WAIT_MS", async () => {
    const offline = fakeOffline(true);
    await playToResult(withOffline(offline));
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    await waitFor(() => expect(location.replace).toHaveBeenCalledTimes(1));
    h.advance(FULL_LOAD_WAIT_MS - 1);
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    await act(async () => {});
    expect(screen.getByRole("heading", { name: "Round complete" })).toBeTruthy();
    expect(offline.applyUpdate).toHaveBeenCalledTimes(1);
    // The load stalled and the old page is still there: the result's buttons work again.
    h.advance(1);
    fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    await waitFor(() => expect(location.replace).toHaveBeenCalledTimes(2));
    expect(offline.applyUpdate).toHaveBeenCalledTimes(2);
    h.advance(FULL_LOAD_WAIT_MS);
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(await screen.findByRole("button", { name: "True" })).toBeTruthy();
    expect(FULL_LOAD_WAIT_MS).toBe(RETURN_MAX_AGE_MS);
  });

  it("stops the stalled page load when it lifts the guard, before Play again deals, so the load never lands in the new round", async () => {
    const offline = fakeOffline(true);
    // Dealing a round draws a seed: how many rounds were dealt when the load was stopped.
    const randomSeed = vi.fn(() => 12345);
    const dealtWhenStopped: number[] = [];
    const stopLoading = vi.fn(() => {
      dealtWhenStopped.push(randomSeed.mock.calls.length);
    });
    const setup = withOffline(offline);
    setup.services = { ...setup.services, randomSeed, stopLoading };
    await playToResult(setup);
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    await waitFor(() => expect(location.replace).toHaveBeenCalledTimes(1));
    h.advance(FULL_LOAD_WAIT_MS - 1);
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await act(async () => {});
    expect(stopLoading).not.toHaveBeenCalled();
    h.advance(1);
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(await screen.findByRole("button", { name: "True" })).toBeTruthy();
    expect(stopLoading).toHaveBeenCalledTimes(1);
    expect(randomSeed).toHaveBeenCalledTimes(2);
    expect(dealtWhenStopped).toEqual([1]);
    // The guard is down now: another press does not stop anything.
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    await act(async () => {});
    expect(stopLoading).toHaveBeenCalledTimes(1);
  });

  it("does not stop a page load when no way back started one", async () => {
    const stopLoading = vi.fn();
    const setup = withOffline(fakeOffline(false));
    setup.services = { ...setup.services, stopLoading };
    await playToResult(setup);
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    h.advance(FULL_LOAD_WAIT_MS);
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await screen.findByRole("button", { name: "True" });
    expect(stopLoading).not.toHaveBeenCalled();
  });

  it("the browser's play services stop the page load with window.stop", () => {
    const stop = vi.spyOn(window, "stop").mockImplementation(() => {});
    browserPlayServices.stopLoading?.();
    expect(stop).toHaveBeenCalledTimes(1);
    stop.mockRestore();
  });

  it("tries the deck again with Try again only when no way back is pending", async () => {
    let takeOver: (value: boolean) => void = () => {};
    const offline = fakeOffline(true, () => new Promise<boolean>((resolve) => (takeOver = resolve)));
    h = withOffline(offline);
    h.network.online = false;
    render(<PlayScreen services={h.services} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    h.network.online = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "True" })).toBeNull();
    // The new worker does not take over in time: the in-app way back runs and settles, so no way back is
    // pending any more. The router is a stand-in, so the screen stays, and Try again now loads the deck.
    await act(async () => takeOver(false));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(location.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "True" })).toBeTruthy();
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

describe("PlayScreen: a way back that fails", () => {
  it("leaves the result's actions working: the way back can be pressed again, and Play again deals a new round", async () => {
    const offline = fakeOffline(false);
    const backToStart = vi.fn((): boolean => {
      throw new Error("the history cannot be read");
    });
    const setup = withOffline(offline);
    setup.services = { ...setup.services, backToStart };
    await playToResult(setup);
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    await act(async () => {});
    expect(backToStart).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await screen.findByRole("button", { name: "True" });
    expect(screen.queryByRole("heading", { name: "Round complete" })).toBeNull();
  });

  it("takes back the mark that the player is coming back, so the next start does not focus its step title", async () => {
    const backToStart = vi.fn((): boolean => {
      throw new Error("the history cannot be read");
    });
    const setup = withOffline(fakeOffline(false));
    setup.services = { ...setup.services, backToStart, markReturnToStart: markReturnFromPlay, clearReturnToStart: clearReturnFromPlay };
    await playToResult(setup);
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    await act(async () => {});
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(RETURN_KEY)).toBeNull();
    expect(takeReturnFromPlay()).toBe(false);
  });

  it("the browser's play services take the mark back with clearReturnFromPlay", () => {
    expect(browserPlayServices.clearReturnToStart).toBe(clearReturnFromPlay);
  });
});
