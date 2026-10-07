import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goToStart, type ToStartServices } from "@/src/app-state/to-start";
import { noOfflineClient, type OfflineClient } from "@/src/offline/register";
import { fakeOffline } from "@/tests/offline/fake-offline";

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

function servicesWith(offline: OfflineClient, backToStart?: () => boolean): ToStartServices {
  return backToStart ? { offline, backToStart } : { offline };
}

describe("goToStart: an update is waiting", () => {
  it("applies it and opens the start with a full page load in place of /play", async () => {
    const offline = fakeOffline(true);
    const backToStart = vi.fn(() => true);
    const router = { replace: vi.fn() };
    await expect(goToStart(servicesWith(offline, backToStart), router)).resolves.toBe(true);
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
    await expect(going).resolves.toBe(true);
    expect(location.replace).toHaveBeenCalledWith("/");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("takes the in-app way back when the worker does not take over in time", async () => {
    const offline = fakeOffline(true, async () => false);
    const backToStart = vi.fn(() => false);
    const router = { replace: vi.fn() };
    await expect(goToStart(servicesWith(offline, backToStart), router)).resolves.toBe(false);
    expect(location.replace).not.toHaveBeenCalled();
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("takes the in-app way back when applying the update fails", async () => {
    const offline = fakeOffline(true, () => Promise.reject(new Error("InvalidStateError")));
    const router = { replace: vi.fn() };
    await expect(goToStart(servicesWith(offline), router)).resolves.toBe(false);
    expect(location.replace).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});

// A press during the app-open update leaves the new version in control without the reload (openApp), and a
// version can also take over after applyUpdate gave up. Nothing waits any more, but the page runs the old code.
describe("goToStart: a new version took over this page earlier without a reload", () => {
  it("opens the start with a full page load in place of /play, and asks nothing of the worker", async () => {
    const offline = fakeOffline(false, async () => true, true);
    const backToStart = vi.fn(() => true);
    const router = { replace: vi.fn() };
    await expect(goToStart(servicesWith(offline, backToStart), router)).resolves.toBe(true);
    expect(location.replace).toHaveBeenCalledTimes(1);
    expect(location.replace).toHaveBeenCalledWith("/");
    expect(offline.applyUpdate).not.toHaveBeenCalled();
    expect(backToStart).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(offline.checkForUpdate).not.toHaveBeenCalled();
  });

  it("opens the start with a full page load too when a newer update waits and does not take over in time", async () => {
    const offline = fakeOffline(true, async () => false, true);
    const router = { replace: vi.fn() };
    await expect(goToStart(servicesWith(offline), router)).resolves.toBe(true);
    expect(offline.applyUpdate).toHaveBeenCalledTimes(1);
    expect(location.replace).toHaveBeenCalledWith("/");
    expect(router.replace).not.toHaveBeenCalled();
  });
});

// The play screen lost a full page load that a way back started (it never replaced the page). A back step to the
// start's entry stays in the page when the start flow opened /play in it. router.replace("/") is no way out: a newer
// release has taken over, so the payload comes from another build, and Next.js answers with a document load of its
// own that nothing guards.
describe("goToStart: a full page load from this screen was lost", () => {
  it("goes back to the start's entry when it is right behind /play, whatever waits or took over, and applies nothing", async () => {
    const offline = fakeOffline(true, async () => true, true);
    const backToStart = vi.fn(() => true);
    const router = { replace: vi.fn() };
    await expect(goToStart(servicesWith(offline, backToStart), router, { loadLost: true })).resolves.toBe(false);
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(offline.applyUpdate).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("opens the start with the full page load again when the start's entry is not behind /play, not with router.replace", async () => {
    const offline = fakeOffline(false, async () => true, true);
    const backToStart = vi.fn(() => false);
    const router = { replace: vi.fn() };
    await expect(goToStart(servicesWith(offline, backToStart), router, { loadLost: true })).resolves.toBe(true);
    expect(location.replace).toHaveBeenCalledTimes(1);
    expect(location.replace).toHaveBeenCalledWith("/");
    expect(router.replace).not.toHaveBeenCalled();
    expect(backToStart).toHaveBeenCalledTimes(1);
  });

  it("replaces /play with / when nothing waits or took over and the start's entry is not behind it, asking for that entry once", async () => {
    const offline = fakeOffline(false);
    const backToStart = vi.fn(() => false);
    const router = { replace: vi.fn() };
    await expect(goToStart(servicesWith(offline, backToStart), router, { loadLost: true })).resolves.toBe(false);
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(location.replace).not.toHaveBeenCalled();
  });
});

describe("goToStart: nothing is waiting", () => {
  it("goes back to the start's entry when it is right behind /play, and applies nothing", async () => {
    const offline = fakeOffline(false);
    const backToStart = vi.fn(() => true);
    const router = { replace: vi.fn() };
    await expect(goToStart(servicesWith(offline, backToStart), router)).resolves.toBe(false);
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
    await expect(goToStart(servicesWith(offline), router)).resolves.toBe(false);
    await Promise.resolve();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
