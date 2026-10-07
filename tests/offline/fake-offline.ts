// A stand-in for the page's side of the service worker, for the tests of the screens that ask it for a waiting update.
import { vi, type Mock } from "vitest";
import type { OfflineClient } from "@/src/offline/register";

export interface FakeOffline extends OfflineClient {
  updateWaiting: Mock<() => boolean>;
  applyUpdate: Mock<() => Promise<boolean>>;
  checkForUpdate: Mock<() => Promise<void>>;
}

/** Whether a new version waits, and what applyUpdate answers (by default: the new version takes over). */
export function fakeOffline(waiting: boolean, takesOver: () => Promise<boolean> = async () => true): FakeOffline {
  return {
    start: async () => {},
    updateWaiting: vi.fn(() => waiting),
    applyUpdate: vi.fn(takesOver),
    checkForUpdate: vi.fn(async () => {}),
  };
}
