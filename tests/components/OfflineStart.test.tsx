// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineStart, openApp } from "@/components/OfflineStart";
import type { OfflineClient } from "@/src/offline/register";

/** An offline client whose answers a test sets, and which records what it was asked, in order. */
function fakeClient({ waiting = false, applied = true }: { waiting?: boolean; applied?: boolean } = {}) {
  const calls: string[] = [];
  let finishStart: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    finishStart = resolve;
  });
  const client: OfflineClient = {
    start: vi.fn(async () => {
      calls.push("start");
      await started;
    }),
    updateWaiting: vi.fn(() => {
      calls.push("updateWaiting");
      return waiting;
    }),
    applyUpdate: vi.fn(async () => {
      calls.push("applyUpdate");
      return applied;
    }),
    checkForUpdate: vi.fn(async () => {
      calls.push("checkForUpdate");
    }),
  };
  return { client, calls, finishStart };
}

/** Lets every pending promise settle: a macrotask runs only after the microtasks queued before it. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("openApp: the safe moment when the app opens", () => {
  it("on /, with an update waiting: registers first, then applies it and reloads once it has taken over", async () => {
    const { client, calls, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    const opening = openApp(client, "/", reload, () => "/");
    expect(calls).toEqual(["start"]);
    finishStart();
    await opening;
    expect(calls).toEqual(["start", "updateWaiting", "applyUpdate"]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload when the waiting update did not take over", async () => {
    const { client, finishStart } = fakeClient({ waiting: true, applied: false });
    const reload = vi.fn();
    finishStart();
    await openApp(client, "/", reload, () => "/");
    expect(client.applyUpdate).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it("applies nothing on / when no update waits", async () => {
    const { client, finishStart } = fakeClient({ waiting: false });
    const reload = vi.fn();
    finishStart();
    await openApp(client, "/", reload, () => "/");
    expect(client.applyUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it.each(["/play", "/no-such-page"])("only registers on %s, also with an update waiting", async (path) => {
    const { client, calls, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    finishStart();
    await openApp(client, path, reload, () => path);
    expect(calls).toEqual(["start"]);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("OfflineStart", () => {
  it("renders nothing", () => {
    const { client } = fakeClient();
    const { container } = render(<OfflineStart services={{ offline: client }} reload={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("starts the offline client once per page load, also when React runs its effects twice", async () => {
    const { client, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    const services = { offline: client };
    const { rerender } = render(
      <StrictMode>
        <OfflineStart services={services} reload={reload} />
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <OfflineStart services={services} reload={reload} />
      </StrictMode>,
    );
    finishStart();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(client.start).toHaveBeenCalledTimes(1);
    expect(client.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it("applies a waiting update when the page opened on /", async () => {
    window.history.replaceState(null, "", "/");
    const { client, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    finishStart();
    render(<OfflineStart services={{ offline: client }} reload={reload} />);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("leaves a waiting update alone when the page opened on /play", async () => {
    window.history.replaceState(null, "", "/play");
    const { client, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    finishStart();
    render(<OfflineStart services={{ offline: client }} reload={reload} />);
    await waitFor(() => expect(client.start).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    await Promise.resolve();
    expect(client.updateWaiting).not.toHaveBeenCalled();
    expect(client.applyUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reads the path once, when the page opens: a later move to / applies nothing", async () => {
    window.history.replaceState(null, "", "/play");
    const { client, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    const services = { offline: client };
    const { rerender } = render(<OfflineStart services={services} reload={reload} />);
    window.history.replaceState(null, "", "/");
    rerender(<OfflineStart services={services} reload={reload} />);
    finishStart();
    await waitFor(() => expect(client.start).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    await Promise.resolve();
    expect(client.applyUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  // Spec section 7: never on /play while a round is open. Registration can take seconds (it queues behind an update
  // job that installs a new version), and the start flow opens /play with router.push while the layout stays.
  it("a move to /play before registration settles applies nothing", async () => {
    window.history.replaceState(null, "", "/");
    const { client, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    render(<OfflineStart services={{ offline: client }} reload={reload} />);
    await waitFor(() => expect(client.start).toHaveBeenCalledTimes(1));
    window.history.pushState(null, "", "/play");
    finishStart();
    await settle();
    expect(client.applyUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("leaving / while the update applies does not reload", async () => {
    window.history.replaceState(null, "", "/");
    const { client, finishStart } = fakeClient({ waiting: true });
    // The player opens /play in the up to APPLY_TIMEOUT_MS the new version takes to control the page.
    client.applyUpdate = vi.fn(async () => {
      window.history.pushState(null, "", "/play");
      return true;
    });
    const reload = vi.fn();
    finishStart();
    render(<OfflineStart services={{ offline: client }} reload={reload} />);
    await waitFor(() => expect(client.applyUpdate).toHaveBeenCalledTimes(1));
    await settle();
    expect(reload).not.toHaveBeenCalled();
  });
});
