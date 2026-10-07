// Whether the browser says it is online (offline spec section 8, "Online state"): navigator.onLine, followed
// through the window's online and offline events, so what depends on it changes without a reload. A fetch that
// fails while this is still true takes the loader's own paths (a cached copy, else Try again).
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const browserOnLine = () => navigator.onLine;

// The prerendered page and the first render that hydrates it are online, so they match the server's HTML;
// React then reads navigator.onLine and renders again if it differs.
const serverOnLine = () => true;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, browserOnLine, serverOnLine);
}
