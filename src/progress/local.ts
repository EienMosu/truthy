// The progress store on the device: one versioned key in localStorage (spec section 7).
// Storage that is missing, blocked, full or corrupt never reaches the player: load gives
// empty progress and save does nothing.

import { emptyProgress, parseProgress, type Progress } from "./progress";

export const PROGRESS_KEY = "truthy.progress.v1";

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
        storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      } catch {
        // Full or blocked storage: play goes on, this round is simply not remembered.
      }
    },
  };
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
