// The progress store on the device: one versioned key in localStorage (spec section 7).
// Storage that is missing, blocked, full or corrupt never reaches the player: load gives
// empty progress and save does nothing.

import { emptyProgress, parseProgress, readProgress, type Progress } from "./progress";

export const PROGRESS_KEY = "truthy.progress.v1";

// Where a stored value that did not read back whole is kept before the store writes over it, so a later
// version can still recover what this one could not read. It holds the latest such value only.
export const UNREADABLE_KEY = "truthy.progress.v1.unreadable";

export interface ProgressStore {
  load(): Progress;
  save(progress: Progress): void;
}

export function createLocalStore(storage: Pick<Storage, "getItem" | "setItem"> | undefined): ProgressStore {
  return {
    load() {
      if (storage === undefined) return emptyProgress();
      try {
        return parseProgress(storage.getItem(PROGRESS_KEY));
      } catch {
        return emptyProgress();
      }
    },
    save(progress) {
      if (storage === undefined) return;
      try {
        keepUnreadable(storage);
        storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      } catch {
        // Full or blocked storage: play goes on, this round is simply not remembered. When the stored
        // value could not be kept aside first, it is not written over either.
      }
    },
  };
}

// Copies the stored value to UNREADABLE_KEY when part or all of it was dropped on reading. The first
// save over such a value replaces it with one that reads whole, so the copy is made once per value.
function keepUnreadable(storage: Pick<Storage, "getItem" | "setItem">): void {
  const raw = storage.getItem(PROGRESS_KEY);
  if (raw === null || readProgress(raw).whole || storage.getItem(UNREADABLE_KEY) === raw) return;
  storage.setItem(UNREADABLE_KEY, raw);
}

// window.localStorage, or undefined where it cannot be used: no window (prerendering), or a
// browser that throws on reading the property because site data is blocked.
export function browserLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
