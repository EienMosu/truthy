// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THEME_COLOR,
  THEME_KEY,
  applyTheme,
  chosenTheme,
  oppositeTheme,
  parseTheme,
  readThemeChoice,
  resolveTheme,
  subscribeTheme,
  switchTheme,
  systemPrefersDark,
  themeScript,
  visibleTheme,
  writeThemeChoice,
} from "@/src/app-state/theme";
import { tokensToCss } from "@/src/tokens/build";

/** Local storage in memory; `fail` makes every call throw, as a browser that blocks site data does. */
function memoryStorage(initial: Record<string, string> = {}, fail = false) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: vi.fn((key: string) => {
      if (fail) throw new DOMException("The operation is insecure.", "SecurityError");
      return data.get(key) ?? null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (fail) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      data.set(key, value);
    }),
  };
}

/** A prefers-color-scheme: dark query whose answer a test can change, with its change listeners. */
function fakeMedia(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_type: "change", listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: "change", listener: () => void) => listeners.delete(listener),
  };
  return {
    query,
    listeners,
    matchMedia: vi.fn((_media: string) => query),
    flip(next: boolean) {
      query.matches = next;
      for (const listener of listeners) listener();
    },
  };
}

function addThemeColorMetas() {
  for (const scheme of ["light", "dark"] as const) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("media", `(prefers-color-scheme: ${scheme})`);
    meta.setAttribute("content", THEME_COLOR[scheme]);
    document.head.append(meta);
  }
}

function metas(): HTMLMetaElement[] {
  return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
}

/** The colour the browser bar takes: that of the first theme-color tag, in document order, whose media matches. */
function barColor(systemDark: boolean): string | undefined {
  const matches = (media: string): boolean => {
    if (media === "" || media === "all") return true;
    if (media === "not all") return false;
    if (media === "(prefers-color-scheme: dark)") return systemDark;
    if (media === "(prefers-color-scheme: light)") return !systemDark;
    throw new Error(`unexpected media ${media}`);
  };
  return metas().find((meta) => matches(meta.getAttribute("media") ?? ""))?.getAttribute("content") ?? undefined;
}

/**
 * The bar shows the chosen theme's top sky colour whatever the system setting. The tags keep their
 * content: React finds the tags it rendered by their content when it hydrates (it would add a copy of
 * a tag whose content changed), so the choice moves their media instead.
 */
function expectBar(theme: "light" | "dark") {
  expect(barColor(false)).toBe(THEME_COLOR[theme]);
  expect(barColor(true)).toBe(THEME_COLOR[theme]);
  expect(metas().map((meta) => meta.getAttribute("content"))).toEqual([THEME_COLOR.light, THEME_COLOR.dark]);
}

function expectBarFollowsSystem() {
  expect(metas().map((meta) => [meta.getAttribute("content"), meta.getAttribute("media")])).toEqual([
    [THEME_COLOR.light, "(prefers-color-scheme: light)"],
    [THEME_COLOR.dark, "(prefers-color-scheme: dark)"],
  ]);
}

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.head.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseTheme", () => {
  it("accepts light and dark only", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    for (const garbage of [null, undefined, "", "Dark", " dark", "system", "auto", "1", 1, {}, ["dark"]]) {
      expect(parseTheme(garbage), String(garbage)).toBeNull();
    }
  });
});

describe("readThemeChoice", () => {
  it("reads the stored choice under truthy.theme", () => {
    expect(THEME_KEY).toBe("truthy.theme");
    expect(readThemeChoice(memoryStorage({ "truthy.theme": "dark" }))).toBe("dark");
    expect(readThemeChoice(memoryStorage({ "truthy.theme": "light" }))).toBe("light");
  });

  it("means follow the system for no choice, a garbage value, no storage or storage that throws", () => {
    expect(readThemeChoice(memoryStorage())).toBeNull();
    expect(readThemeChoice(memoryStorage({ "truthy.theme": "purple" }))).toBeNull();
    expect(readThemeChoice(memoryStorage({ "truthy.theme": '"dark"' }))).toBeNull();
    expect(readThemeChoice(undefined)).toBeNull();
    expect(readThemeChoice(memoryStorage({ "truthy.theme": "dark" }, true))).toBeNull();
  });
});

describe("writeThemeChoice", () => {
  it("stores the choice under truthy.theme and says it did", () => {
    const storage = memoryStorage();
    expect(writeThemeChoice(storage, "dark")).toBe(true);
    expect(storage.data.get("truthy.theme")).toBe("dark");
    expect(writeThemeChoice(storage, "light")).toBe(true);
    expect(storage.data.get("truthy.theme")).toBe("light");
  });

  it("never throws: no storage or storage that throws is reported, not raised", () => {
    expect(writeThemeChoice(undefined, "dark")).toBe(false);
    expect(writeThemeChoice(memoryStorage({}, true), "dark")).toBe(false);
  });
});

describe("resolveTheme and oppositeTheme", () => {
  it("lets a choice win over the system setting, and follows the system without one", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });

  it("flips light and dark", () => {
    expect(oppositeTheme("light")).toBe("dark");
    expect(oppositeTheme("dark")).toBe("light");
  });
});

describe("the theme on the page", () => {
  it("reads the choice from data-theme on <html>, ignoring a value it does not know", () => {
    expect(chosenTheme(document)).toBeNull();
    document.documentElement.setAttribute("data-theme", "dark");
    expect(chosenTheme(document)).toBe("dark");
    document.documentElement.setAttribute("data-theme", "sepia");
    expect(chosenTheme(document)).toBeNull();
  });

  it("asks the system through matchMedia, and treats a browser without it as light", () => {
    expect(systemPrefersDark(fakeMedia(true).matchMedia)).toBe(true);
    expect(systemPrefersDark(fakeMedia(false).matchMedia)).toBe(false);
    expect(systemPrefersDark(undefined)).toBe(false);
    const media = fakeMedia(true);
    systemPrefersDark(media.matchMedia);
    expect(media.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
  });

  it("shows the attribute's theme when there is one, otherwise the system's", () => {
    expect(visibleTheme(document, fakeMedia(true).matchMedia)).toBe("dark");
    expect(visibleTheme(document, fakeMedia(false).matchMedia)).toBe("light");
    document.documentElement.setAttribute("data-theme", "light");
    expect(visibleTheme(document, fakeMedia(true).matchMedia)).toBe("light");
  });

  it("applies a choice: the attribute on <html>, and the browser bar in the chosen theme's colour", () => {
    addThemeColorMetas();
    applyTheme(document, "dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expectBar("dark");
    applyTheme(document, "light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expectBar("light");
  });
});

describe("switchTheme", () => {
  it("flips the theme the player sees, applies it and stores it", () => {
    addThemeColorMetas();
    const storage = memoryStorage();
    expect(switchTheme(document, storage, fakeMedia(false).matchMedia)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(storage.data.get("truthy.theme")).toBe("dark");
    expectBar("dark");
    expect(switchTheme(document, storage, fakeMedia(false).matchMedia)).toBe("light");
    expect(storage.data.get("truthy.theme")).toBe("light");
  });

  it("flips from the system's dark to light on the first press", () => {
    const storage = memoryStorage();
    expect(switchTheme(document, storage, fakeMedia(true).matchMedia)).toBe("light");
    expect(storage.data.get("truthy.theme")).toBe("light");
  });

  it("still flips the page when storage throws or is missing: the attribute keeps the choice", () => {
    expect(switchTheme(document, memoryStorage({}, true), fakeMedia(false).matchMedia)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(switchTheme(document, undefined, fakeMedia(false).matchMedia)).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

describe("subscribeTheme", () => {
  it("calls back when the attribute changes and when the system setting changes, until unsubscribed", async () => {
    const media = fakeMedia(false);
    const onChange = vi.fn();
    const stop = subscribeTheme(document, media.matchMedia, onChange);
    media.flip(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    document.documentElement.setAttribute("data-theme", "light");
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    stop();
    media.flip(false);
    document.documentElement.setAttribute("data-theme", "dark");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(media.listeners.size).toBe(0);
  });

  it("works without matchMedia", () => {
    const stop = subscribeTheme(document, undefined, () => {});
    expect(stop).toBeTypeOf("function");
    stop();
  });
});

describe("themeScript, the inline script in <head>", () => {
  function run(storage: unknown) {
    vi.stubGlobal("localStorage", storage);
    new Function(themeScript())();
  }

  it("applies a stored choice before the page paints: the attribute and the browser bar colour", () => {
    addThemeColorMetas();
    run(memoryStorage({ "truthy.theme": "dark" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expectBar("dark");
  });

  // The router of Next.js replaces the theme-color tags on a client-side navigation (start to /play), and
  // they come back with their system media. The script keeps watching <head> for the life of the page.
  const observed = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("sets theme-color tags that arrive after it ran, as on a client-side navigation", async () => {
    run(memoryStorage({ "truthy.theme": "light" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    addThemeColorMetas();
    await observed();
    expectBar("light");
  });

  it("keeps a choice made later with the switch when the tags are replaced", async () => {
    run(memoryStorage());
    addThemeColorMetas();
    applyTheme(document, "dark");
    document.head.innerHTML = "";
    addThemeColorMetas();
    await observed();
    expectBar("dark");
  });

  it("keeps watching when storage throws, so a choice for this page alone survives a navigation too", async () => {
    run(memoryStorage({}, true));
    applyTheme(document, "dark");
    addThemeColorMetas();
    await observed();
    expectBar("dark");
  });

  it("leaves the page to the system for no choice or a garbage value", () => {
    addThemeColorMetas();
    const cases: Record<string, string>[] = [{}, { "truthy.theme": "sepia" }];
    for (const stored of cases) {
      run(memoryStorage(stored));
      expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
      expectBarFollowsSystem();
    }
  });

  it("does not throw when storage throws", () => {
    expect(() => run(memoryStorage({ "truthy.theme": "dark" }, true))).not.toThrow();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("is one self-contained expression with no line break, ready to inline", () => {
    expect(themeScript()).not.toContain("\n");
    expect(themeScript()).not.toMatch(/<\/script/i);
    expect(themeScript()).toContain(JSON.stringify(THEME_KEY));
  });
});

describe("THEME_COLOR", () => {
  it("is the top sky band of each theme in the generated CSS", () => {
    const css = tokensToCss(JSON.parse(readFileSync("design/system/tokens.json", "utf8")));
    const dark = css.indexOf("@media (prefers-color-scheme: dark)");
    expect(/--color-sky-1: (#[0-9a-f]{6});/.exec(css.slice(0, dark))?.[1]).toBe(THEME_COLOR.light);
    expect(/--color-sky-1: (#[0-9a-f]{6});/.exec(css.slice(dark))?.[1]).toBe(THEME_COLOR.dark);
  });
});
