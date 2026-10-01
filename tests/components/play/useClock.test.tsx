// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClock } from "@/components/play/useClock";
import type { RoundEvent } from "@/src/engine/round";
import { harness, pendingFor } from "./fixtures";

afterEach(cleanup);

function setup(running = true) {
  const h = harness(pendingFor("timed"));
  const dispatch = vi.fn<(event: RoundEvent) => void>();
  const hook = renderHook(({ on }: { on: boolean }) => useClock(on, dispatch, h.services), { initialProps: { on: running } });
  const events = () => dispatch.mock.calls.map(([event]) => event);
  return { h, dispatch, hook, events };
}

describe("useClock", () => {
  it("does nothing while it is not running", () => {
    const { h, dispatch } = setup(false);
    act(() => {
      h.advance(100);
      h.tick();
      h.setHidden(true);
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(h.ticking()).toBe(0);
  });

  it("ticks once at the start, then on every tick of the source, with the time of the services", () => {
    const { h, events } = setup();
    const start = h.services.now();
    expect(h.ticking()).toBe(1);
    act(() => {
      h.advance(100);
      h.tick();
    });
    expect(events()).toEqual([
      { type: "tick", now: start },
      { type: "tick", now: start + 100 },
    ]);
  });

  it("reports the page being hidden and shown with the time", () => {
    const { h, events } = setup();
    const start = h.services.now();
    act(() => {
      h.advance(300);
      h.setHidden(true);
      h.advance(5_000);
      h.setHidden(false);
    });
    expect(events()).toEqual([
      { type: "tick", now: start },
      { type: "visibility", hidden: true, at: start + 300 },
      { type: "visibility", hidden: false, at: start + 5_300 },
    ]);
  });

  it("tells the round first when the page is already hidden at the start", () => {
    const h = harness(pendingFor("timed"));
    h.setHidden(true);
    const dispatch = vi.fn<(event: RoundEvent) => void>();
    renderHook(() => useClock(true, dispatch, h.services));
    const now = h.services.now();
    expect(dispatch.mock.calls.map(([event]) => event)).toEqual([
      { type: "visibility", hidden: true, at: now },
      { type: "tick", now },
    ]);
  });

  it("unsubscribes when it stops running and when it unmounts", () => {
    const stopped = setup();
    expect(stopped.h.ticking()).toBe(1);
    stopped.hook.rerender({ on: false });
    expect(stopped.h.ticking()).toBe(0);
    stopped.dispatch.mockClear();
    act(() => {
      stopped.h.tick();
      stopped.h.setHidden(true);
    });
    expect(stopped.dispatch).not.toHaveBeenCalled();

    const unmounted = setup();
    expect(unmounted.h.ticking()).toBe(1);
    unmounted.hook.unmount();
    expect(unmounted.h.ticking()).toBe(0);
    unmounted.dispatch.mockClear();
    act(() => {
      unmounted.h.tick();
      unmounted.h.setHidden(true);
    });
    expect(unmounted.dispatch).not.toHaveBeenCalled();
  });
});
