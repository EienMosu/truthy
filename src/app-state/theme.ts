// The theme the player sees: day ("light") or night ("dark"). By default it follows the system setting.
// A press on the theme switch flips the theme on screen, and that choice is kept on the device under
// localStorage "truthy.theme" and wins over the system setting from then on, on every screen.
//
// The choice lives on the page as data-theme="light" or "dark" on <html> (no attribute: follow the
// system). app/tokens.css and app/globals.css read that attribute; nothing else is needed to repaint.
// On a page load the inline script of themeScript() sets it in <head>, before the first paint, so a
// player who chose dark never sees a day frame first. Storage that is missing, blocked or holds anything
// else than "light" or "dark" means follow the system; the switch then still works for the current page,
// because the attribute itself keeps the choice for as long as the page lives.

export type Theme = "light" | "dark";

export const THEME_KEY = "truthy.theme";

const ATTRIBUTE = "data-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_COLOR_METAS = 'meta[name="theme-color"]';

/**
 * The browser bar colour of each theme: its top sky band, --color-sky-1 in app/tokens.css
 * (tests/app-state/theme.test.ts checks they agree). app/layout.tsx uses them for its theme-color tags.
 */
export const THEME_COLOR: Readonly<Record<Theme, string>> = { light: "#a9d6f0", dark: "#0b1528" };

/** The part of a prefers-color-scheme query the theme needs. window.matchMedia returns one. */
export interface ColorSchemeQuery {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

export type MatchMedia = (query: string) => ColorSchemeQuery;

/** "light" or "dark", or null for anything else (no choice, or a value this build does not know). */
export function parseTheme(value: unknown): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/** A choice wins over the system setting; without one the system decides. */
export function resolveTheme(choice: Theme | null, systemDark: boolean): Theme {
  return choice ?? (systemDark ? "dark" : "light");
}

/** The stored choice, or null (follow the system) for no choice, a garbage value, no storage or storage that throws. */
export function readThemeChoice(storage: Pick<Storage, "getItem"> | undefined): Theme | null {
  if (storage === undefined) return null;
  try {
    return parseTheme(storage.getItem(THEME_KEY));
  } catch {
    return null;
  }
}

/** Stores the choice. Never throws: false when there is no storage or it refused. */
export function writeThemeChoice(storage: Pick<Storage, "setItem"> | undefined, theme: Theme): boolean {
  if (storage === undefined) return false;
  try {
    storage.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

/** window.matchMedia, or undefined on the server and in a browser without it. */
export function browserMatchMedia(): MatchMedia | undefined {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
  return (query) => window.matchMedia(query);
}

/** Whether the system asks for a dark theme. A browser that cannot say is treated as light. */
export function systemPrefersDark(matchMedia: MatchMedia | undefined): boolean {
  return matchMedia?.(DARK_QUERY).matches ?? false;
}

/** The choice on the page: the data-theme attribute of <html>, or null when the page follows the system. */
export function chosenTheme(doc: Document): Theme | null {
  return parseTheme(doc.documentElement.getAttribute(ATTRIBUTE));
}

/** The theme the player sees right now. */
export function visibleTheme(doc: Document, matchMedia: MatchMedia | undefined): Theme {
  return resolveTheme(chosenTheme(doc), systemPrefersDark(matchMedia));
}

/**
 * Puts a choice on the page: the attribute on <html>, and the chosen theme's colour in the browser bar.
 * The two theme-color tags of app/layout.tsx keep their content, because React finds the tags it rendered
 * by their content when it hydrates and adds a copy of a tag whose content has changed. Instead the tag
 * with the chosen theme's colour applies everywhere (media "all") and the other one nowhere ("not all").
 */
export function applyTheme(doc: Document, theme: Theme): void {
  doc.documentElement.setAttribute(ATTRIBUTE, theme);
  for (const meta of doc.querySelectorAll(THEME_COLOR_METAS)) {
    meta.setAttribute("media", meta.getAttribute("content") === THEME_COLOR[theme] ? "all" : "not all");
  }
}

/**
 * The theme switch: flips the theme the player sees, puts the choice on the page and stores it. The page
 * flips even when storage fails. Returns the theme now shown.
 */
export function switchTheme(doc: Document, storage: Pick<Storage, "setItem"> | undefined, matchMedia: MatchMedia | undefined): Theme {
  const next = oppositeTheme(visibleTheme(doc, matchMedia));
  applyTheme(doc, next);
  writeThemeChoice(storage, next);
  return next;
}

/** Calls `onChange` when the choice on the page or the system setting changes. Returns the unsubscribe. */
export function subscribeTheme(doc: Document, matchMedia: MatchMedia | undefined, onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: [ATTRIBUTE] });
  const query = matchMedia?.(DARK_QUERY);
  query?.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    query?.removeEventListener("change", onChange);
  };
}

/**
 * The inline script app/layout.tsx puts in <head>. As the page is parsed, before the first paint, it puts a
 * stored choice on <html> and sets the theme-color tags the way applyTheme does. Then it keeps watching
 * <head> for the life of the page: the router of Next.js replaces the theme-color tags on a client-side
 * navigation (start to /play) and they come back with their system media, so whenever tags arrive or
 * change, a choice on <html> (stored, or made with the switch on this page) is applied to them again.
 * Storage that throws only skips the stored choice.
 */
export function themeScript(): string {
  const key = JSON.stringify(THEME_KEY);
  const colors = JSON.stringify(THEME_COLOR);
  const metas = JSON.stringify(THEME_COLOR_METAS);
  const attribute = JSON.stringify(ATTRIBUTE);
  return (
    `(function(){try{var d=document,r=d.documentElement,c=${colors};` +
    `var m=function(){var t=r.getAttribute(${attribute});if(t!=="light"&&t!=="dark")return;` +
    `var l=d.querySelectorAll(${metas});for(var i=0;i<l.length;i++){` +
    `var w=l[i].getAttribute("content")===c[t]?"all":"not all";if(l[i].getAttribute("media")!==w)l[i].setAttribute("media",w)}};` +
    `try{var s=localStorage.getItem(${key});if(s==="light"||s==="dark")r.setAttribute(${attribute},s)}catch(e){}` +
    `m();new MutationObserver(m).observe(d.head||r,{childList:true,subtree:true,attributes:true,attributeFilter:["media","content"]})` +
    `}catch(e){}})()`
  );
}
