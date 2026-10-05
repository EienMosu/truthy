// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { subscribeTheme, type ColorSchemeQuery, type MatchMedia } from "@/src/app-state/theme";

// Review finding U134: a query that, like the real MediaQueryList, delivers an event only to listeners that
// asked for its type. The fakes in theme.test.ts and ThemeSwitch.test.tsx ignore the type, so a listener
// registered or removed under a mistyped event name passed unnoticed.
function typedQuery(dark: boolean) {
  const target = new EventTarget();
  const query: ColorSchemeQuery = {
    matches: dark,
    addEventListener: (type, listener) => target.addEventListener(type, listener),
    removeEventListener: (type, listener) => target.removeEventListener(type, listener),
  };
  const matchMedia: MatchMedia = () => query;
  return { matchMedia, emit: (type: string) => target.dispatchEvent(new Event(type)) };
}

describe("subscribeTheme: following the system setting live", () => {
  it("calls back on a change event of the colour scheme query and on no other event", () => {
    const media = typedQuery(false);
    const onChange = vi.fn();
    const stop = subscribeTheme(document, media.matchMedia, onChange);
    media.emit("resize");
    expect(onChange).not.toHaveBeenCalled();
    media.emit("change");
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });

  it("stops calling back after the unsubscribe", () => {
    const media = typedQuery(false);
    const onChange = vi.fn();
    const stop = subscribeTheme(document, media.matchMedia, onChange);
    stop();
    media.emit("change");
    expect(onChange).not.toHaveBeenCalled();
  });
});
