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

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("openApp: the safe moment when the app opens", () => {
  it("on /, with an update waiting: registers first, then applies it and reloads once it has taken over", async () => {
    const { client, calls, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    const opening = openApp(client, "/", reload);
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
    await openApp(client, "/", reload);
    expect(client.applyUpdate).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it("applies nothing on / when no update waits", async () => {
    const { client, finishStart } = fakeClient({ waiting: false });
    const reload = vi.fn();
    finishStart();
    await openApp(client, "/", reload);
    expect(client.applyUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it.each(["/play", "/no-such-page"])("only registers on %s, also with an update waiting", async (path) => {
    const { client, calls, finishStart } = fakeClient({ waiting: true });
    const reload = vi.fn();
    finishStart();
    await openApp(client, path, reload);
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
});
