// Test doubles for the start flow: a small deck index, storage in memory, a fake network, a session
// history in memory and a clock moved by hand. Everything goes in through StartFlow's `services` prop.
import type { AppServices, StepHistory } from "@/src/app-state/services";
import type { DeckIndex } from "@/src/content/schema";
import { noOfflineClient } from "@/src/offline/register";
import { PROGRESS_KEY } from "@/src/progress/local";
import { emptyProgress, type Progress } from "@/src/progress/progress";

// Cloud: AWS (CLF with two sections), Google Cloud (CDL, no sections), Azure (no decks).
// Frontend: Next.js (RND). DevOps: no platforms at all.
export const INDEX: DeckIndex = {
  areas: [
    {
      id: "cloud",
      title: "Cloud",
      platforms: [
        {
          id: "aws",
          title: "AWS",
          decks: [
            {
              id: "aws-clf-c02",
              code: "CLF",
              title: "Cloud Practitioner",
              cardCount: 92,
              version: "2026-10-01",
              hash: "clf-1",
              sections: [
                { id: "CON", title: "Cloud concepts", cardCount: 45 },
                { id: "SEC", title: "Security and compliance", cardCount: 47 },
              ],
            },
          ],
        },
        {
          id: "gcp",
          title: "Google Cloud",
          decks: [{ id: "gcp-cdl", code: "CDL", title: "Cloud Digital Leader", passName: "Google Cloud Digital Leader", cardCount: 133, version: "2026-10-01", hash: "cdl-1", sections: [] }],
        },
        { id: "azure", title: "Azure", decks: [] },
      ],
    },
    {
      id: "frontend",
      title: "Frontend",
      platforms: [
        {
          id: "nextjs",
          title: "Next.js",
          decks: [
            {
              id: "nextjs-rendering",
              code: "RND",
              title: "Rendering",
              cardCount: 12,
              version: "2026-10-01",
              hash: "rnd-1",
              sections: [{ id: "RSC", title: "Server and client components", cardCount: 12 }],
            },
          ],
        },
      ],
    },
    { id: "devops", title: "DevOps", platforms: [] },
  ],
};

export interface MemoryStorage extends Pick<Storage, "getItem" | "setItem"> {
  data: Map<string, string>;
}

export function memoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

/** Local storage holding this progress. */
export function storedProgress(progress: Partial<Progress>): MemoryStorage {
  return memoryStorage({ [PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), ...progress }) });
}

export interface FakeNetwork {
  fetcher: AppServices["fetcher"];
  calls: string[];
  /** When false every request fails, as offline. */
  online: boolean;
  /** When set, requests wait for release() before they answer. */
  hold: boolean;
  release: () => void;
}

export function fakeNetwork(index: unknown = INDEX): FakeNetwork {
  let waiting: (() => void)[] = [];
  const network: FakeNetwork = {
    calls: [],
    online: true,
    hold: false,
    release: () => {
      const queued = waiting;
      waiting = [];
      for (const go of queued) go();
    },
    fetcher: async (url) => {
      network.calls.push(url);
      if (network.hold) await new Promise<void>((resolve) => waiting.push(resolve));
      if (!network.online) throw new Error("offline");
      if (url !== "/decks/index.json") return { ok: false, json: async () => null };
      return { ok: true, json: async () => structuredClone(index) };
    },
  };
  return network;
}

/** A session history in memory. `back()` and `forward()` are the browser's buttons. */
export interface MemoryHistory extends StepHistory {
  entries: unknown[];
  position: number;
  back: () => void;
  forward: () => void;
}

export function memoryHistory(): MemoryHistory {
  const listeners = new Set<(state: unknown) => void>();
  const history: MemoryHistory = {
    entries: [null],
    position: 0,
    get state() {
      return history.entries[history.position];
    },
    push(state) {
      history.entries = [...history.entries.slice(0, history.position + 1), state];
      history.position += 1;
    },
    replace(state) {
      history.entries[history.position] = state;
    },
    go(delta) {
      const next = Math.min(Math.max(history.position + delta, 0), history.entries.length - 1);
      if (next === history.position) return;
      history.position = next;
      const state = history.entries[next];
      // Browsers report the move later, as a popstate event.
      queueMicrotask(() => {
        for (const listener of listeners) listener(state);
      });
    },
    listen(onPop) {
      listeners.add(onPop);
      return () => listeners.delete(onPop);
    },
    back: () => history.go(-1),
    forward: () => history.go(1),
  };
  return history;
}

/** A clock in ms that only moves when a test moves it. */
export interface ManualClock {
  time: number;
}

/** What StartFlow takes as `services` (StartServices), written out so this file does not import the flow. */
export interface TestServices extends AppServices {
  history: () => StepHistory | undefined;
  now: () => number;
}

export interface Harness {
  services: TestServices;
  network: FakeNetwork;
  local: MemoryStorage;
  session: MemoryStorage;
  history: MemoryHistory;
  clock: ManualClock;
}

export function harness(local: MemoryStorage = memoryStorage(), index: unknown = INDEX): Harness {
  const network = fakeNetwork(index);
  const session = memoryStorage();
  const history = memoryHistory();
  const clock: ManualClock = { time: 0 };
  const services: TestServices = {
    fetcher: network.fetcher,
    localStorage: () => local,
    sessionStorage: () => session,
    offline: noOfflineClient,
    history: () => history,
    now: () => clock.time,
  };
  return { services, network, local, session, history, clock };
}
