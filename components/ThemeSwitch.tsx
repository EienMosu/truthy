"use client";

// The theme switch (design system 5.5, round button): one press flips the theme the player sees, day to
// night or night to day, and the choice is kept on the device (src/app-state/theme.ts holds the logic).
// The icon shows what a press gives: a moon on the day theme, a sun on the night theme.
import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { RoundButton } from "@/components/RoundButton";
import { MoonIcon, SunIcon } from "@/components/icons";
import type { ReadWriteStorage } from "@/src/app-state/services";
import {
  applyTheme,
  browserMatchMedia,
  chosenTheme,
  readThemeChoice,
  subscribeTheme,
  switchTheme,
  visibleTheme,
  type MatchMedia,
  type Theme,
} from "@/src/app-state/theme";
import { browserLocalStorage } from "@/src/progress/local";

export interface ThemeSwitchProps {
  /** Where the choice is kept. Defaults to localStorage, or undefined when the browser blocks it. Pass a stable function. */
  storage?: () => ReadWriteStorage | undefined;
  /** The system setting. Defaults to window.matchMedia. Pass a stable function. */
  matchMedia?: () => MatchMedia | undefined;
  className?: string;
}

const LABEL: Record<Theme, string> = { light: "Switch to dark theme", dark: "Switch to light theme" };

// On the server the theme is unknown (null), so the prerendered button shows the icon the CSS picks: the
// "night" variant (app/globals.css) follows the same three cases as the night tokens. Right after hydration
// the button reads the theme on the page and draws the one icon.
function serverTheme(): Theme | null {
  return null;
}

export function ThemeSwitch({ storage = browserLocalStorage, matchMedia = browserMatchMedia, className }: ThemeSwitchProps) {
  const subscribe = useCallback((onChange: () => void) => subscribeTheme(document, matchMedia(), onChange), [matchMedia]);
  const read = useCallback((): Theme | null => visibleTheme(document, matchMedia()), [matchMedia]);
  const theme = useSyncExternalStore(subscribe, read, serverTheme);

  // The head script has put a stored choice on <html> before the first paint. In development React's
  // remount clears attributes it did not render, so put the choice back (a no-op in production).
  useLayoutEffect(() => {
    const stored = readThemeChoice(storage());
    if (stored !== null && chosenTheme(document) === null) applyTheme(document, stored);
  }, [storage]);

  return (
    <RoundButton
      label={theme === null ? "Switch theme" : LABEL[theme]}
      className={className}
      onClick={() => switchTheme(document, storage(), matchMedia())}
    >
      {theme === null ? (
        <>
          <span data-icon="moon" className="contents night:hidden">
            <MoonIcon />
          </span>
          <span data-icon="sun" className="hidden night:contents">
            <SunIcon />
          </span>
        </>
      ) : (
        <span data-icon={theme === "light" ? "moon" : "sun"} className="contents">
          {theme === "light" ? <MoonIcon /> : <SunIcon />}
        </span>
      )}
    </RoundButton>
  );
}
