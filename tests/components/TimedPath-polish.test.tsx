// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimedPath } from "@/components/TimedPath";

const motionPreference = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  useReducedMotion: () => motionPreference.reduced,
}));

afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
});

/** The plane's transform and the end of the flown line at `remainingMs`. */
function drawn(remainingMs: number) {
  const { container } = render(<TimedPath remainingMs={remainingMs} correct={0} wrong={0} />);
  const result = {
    plane: container.querySelector("[data-plane]")?.getAttribute("transform"),
    line: container.querySelector('path[stroke-width="2.4"]')?.getAttribute("d"),
  };
  cleanup();
  return result;
}

describe("TimedPath with reduced motion", () => {
  it("moves the plane and the flown line once a second, with the clock", () => {
    motionPreference.reduced = true;
    expect(drawn(41_900)).toEqual(drawn(41_050));
    // The clock reads 0:41 down to 40 001 ms and 0:40 from 40 000 ms.
    expect(drawn(40_001)).not.toEqual(drawn(40_000));
  });

  it("puts the plane where the clock is: on the start while it reads 1:00, on the destination at 0:00", () => {
    motionPreference.reduced = true;
    expect(drawn(59_500).plane).toMatch(/^translate\(6 24\)/);
    expect(drawn(0).plane).toMatch(/^translate\(270 24\)/);
    expect(drawn(400).plane).not.toMatch(/^translate\(270 24\)/);
  });

  it("without reduced motion still flies the plane continuously", () => {
    expect(drawn(41_900)).not.toEqual(drawn(41_050));
  });
});
