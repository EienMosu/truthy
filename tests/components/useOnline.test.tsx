// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOnline } from "@/components/useOnline";
import { resetOnline, setOnline } from "@/tests/support/online";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetOnline();
});

function Probe() {
  return <span>{useOnline() ? "online" : "offline"}</span>;
}

/** The handlers a spy on window.addEventListener or removeEventListener saw for this event type, in order. */
function handlersFor(spy: { mock: { calls: unknown[][] } }, type: string): unknown[] {
  return spy.mock.calls.filter(([name]) => name === type).map(([, handler]) => handler);
}

describe("useOnline", () => {
  it("reads navigator.onLine", () => {
    setOnline(false, false);
    expect(renderHook(() => useOnline()).result.current).toBe(false);
  });

  it("follows the online and offline events", () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    act(() => setOnline(false));
    expect(result.current).toBe(false);
    act(() => setOnline(true));
    expect(result.current).toBe(true);
  });

  it("stops listening once unmounted: the handlers it added are the ones it removes", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useOnline());
    const added = { online: handlersFor(add, "online"), offline: handlersFor(add, "offline") };
    expect(added.online).toHaveLength(1);
    expect(added.offline).toHaveLength(1);
    expect(handlersFor(remove, "online")).toHaveLength(0);
    expect(handlersFor(remove, "offline")).toHaveLength(0);

    unmount();
    expect(handlersFor(remove, "online")).toEqual(added.online);
    expect(handlersFor(remove, "offline")).toEqual(added.offline);
  });

  it("is online on the server, so the prerendered page is the online one", () => {
    setOnline(false, false);
    expect(renderToString(<Probe />)).toBe("<span>online</span>");
  });
});
