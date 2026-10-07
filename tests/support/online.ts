// The browser's online state in jsdom, for the tests of what follows navigator.onLine (components/useOnline.ts and
// the start flow offline). jsdom's own getter on Navigator.prototype always reads true.

/** Sets navigator.onLine and, like the browser, fires "online" or "offline" on the window (unless `fire` is false). */
export function setOnline(online: boolean, fire = true): void {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => online });
  if (fire) window.dispatchEvent(new Event(online ? "online" : "offline"));
}

/** Back to jsdom's own getter on Navigator.prototype: online. */
export function resetOnline(): void {
  delete (window.navigator as { onLine?: boolean }).onLine;
}
