// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserAppServices, browserSessionStorage, browserStepHistory, withEntryState } from "@/src/app-state/services";
import { browserOfflineClient } from "@/src/offline/register";

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

  it("wires the real services to fetch, the two storages and the service worker", () => {
    expect(browserAppServices.localStorage()).toBe(window.localStorage);
    expect(browserAppServices.sessionStorage()).toBe(window.sessionStorage);
    expect(browserAppServices.offline).toBe(browserOfflineClient);
  });
});

// Review finding F3: the start flow marks that it opened /play right on top of its own first entry; the
// play screen then leaves with the browser's back instead of adding a new entry for the start.
describe("the start's entry behind /play", () => {
  it("goes back only once the start flow has marked its entry", async () => {
    vi.resetModules();
    const fresh = await import("@/src/app-state/services");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    expect(fresh.browserBackToStart()).toBe(false);
    expect(back).not.toHaveBeenCalled();
    fresh.markStartEntryBehind(true);
    expect(fresh.browserBackToStart()).toBe(true);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("drops the mark when a later start could not move back to its first entry", async () => {
    vi.resetModules();
    const fresh = await import("@/src/app-state/services");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    fresh.markStartEntryBehind(true);
    fresh.markStartEntryBehind(false);
    expect(fresh.browserBackToStart()).toBe(false);
    expect(back).not.toHaveBeenCalled();
  });
});
