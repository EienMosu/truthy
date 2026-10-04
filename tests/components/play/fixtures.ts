// Test doubles for the play screen: a small deck and its index, storage in memory, a fake network and
// a clock the test moves by hand. Everything goes in through PlayScreen's `services` prop.
import type { PlayServices } from "@/components/play/useRound";
import { PENDING_KEY, type PendingRound } from "@/src/app-state/pending";
import type { Mode } from "@/src/content/play";
import type { Card, DeckFile, DeckIndex } from "@/src/content/schema";

export const DECK_ID = "test-deck";

function card(section: string, n: number, answer: boolean, appliesTo = ""): Card {
  const id = `${DECK_ID}-${section.toLowerCase()}-${String(n).padStart(2, "0")}`;
  return {
    id,
    section,
    text: { en: { statement: `Statement ${section} ${n}.`, explanation: `Explanation ${section} ${n}.` } },
    answer,
    source: { title: `Source ${section} ${n}`, url: `https://example.com/${id}` },
    difficulty: 1,
    appliesTo,
    conflictGroups: [],
  };
}

// SEC: 12 cards, half true. APP: one card with appliesTo.
export const DECK: DeckFile = {
  id: DECK_ID,
  hash: "hash-1",
  cards: [...Array.from({ length: 12 }, (_, i) => card("SEC", i + 1, i % 2 === 0)), card("APP", 1, true, "Next.js 16")],
};

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
              id: DECK_ID,
              code: "TST",
              title: "Test deck",
              cardCount: DECK.cards.length,
              version: "2026-10-01",
              hash: "hash-1",
              sections: [
                { id: "SEC", title: "Security and compliance", cardCount: 12 },
                { id: "APP", title: "Applies to", cardCount: 1 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export function cardByStatement(statement: string | null | undefined): Card {
  const found = DECK.cards.find((c) => c.text.en.statement === statement);
  if (!found) throw new Error(`no card with the statement "${statement}"`);
  return found;
}

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

export interface FakeNetwork {
  fetcher: PlayServices["fetcher"];
  calls: string[];
  /** When false every request fails, as offline. */
  online: boolean;
  /** When set, requests wait for release() before they answer. */
  hold: boolean;
  release: () => void;
}

export function fakeNetwork(files: Record<string, unknown> = { "/decks/index.json": INDEX, [`/decks/${DECK_ID}.json`]: DECK }): FakeNetwork {
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
      const path = url.split("?")[0] ?? url;
      if (!(path in files)) return { ok: false, json: async () => null };
      return { ok: true, json: async () => structuredClone(files[path]) };
    },
  };
  return network;
}

export interface Harness {
  services: PlayServices;
  network: FakeNetwork;
  local: MemoryStorage;
  session: MemoryStorage;
  /** Moves the clock on by ms. */
  advance: (ms: number) => void;
  /** Calls every subscribed onTick once. */
  tick: () => void;
  /** Every 100 ms up to ms: moves the clock on by 100, then ticks. */
  run: (ms: number) => void;
  /** Changes visibility.hidden() and tells the listeners. */
  setHidden: (hidden: boolean) => void;
  /** How many ticker subscriptions are open. */
  ticking: () => number;
}

export function harness(pending: PendingRound | null = { route: { deckId: DECK_ID, sectionId: "SEC" }, mode: "classic" }, local = memoryStorage()): Harness {
  let time = 1_700_000_000_000;
  let hidden = false;
  const tickers = new Set<() => void>();
  const listeners = new Set<(hidden: boolean) => void>();
  const network = fakeNetwork();
  const session = memoryStorage(pending ? { [PENDING_KEY]: JSON.stringify(pending) } : {});
  const services: PlayServices = {
    fetcher: network.fetcher,
    localStorage: () => local,
    sessionStorage: () => session,
    now: () => time,
    monotonic: () => time,
    randomSeed: () => 12345,
    ticker: (onTick) => {
      // A wrapper per subscription, so the same function subscribed twice counts twice.
      const entry = () => onTick();
      tickers.add(entry);
      return () => {
        tickers.delete(entry);
      };
    },
    visibility: {
      hidden: () => hidden,
      listen: (onChange) => {
        const entry = (value: boolean) => onChange(value);
        listeners.add(entry);
        return () => {
          listeners.delete(entry);
        };
      },
    },
  };
  const tick = () => {
    for (const onTick of [...tickers]) onTick();
  };
  return {
    services,
    network,
    local,
    session,
    advance: (ms) => (time += ms),
    tick,
    run: (ms) => {
      for (let passed = 100; passed <= ms; passed += 100) {
        time += 100;
        tick();
      }
    },
    setHidden: (value) => {
      hidden = value;
      for (const onChange of [...listeners]) onChange(value);
    },
    ticking: () => tickers.size,
  };
}

/** The pending round the start flow would hand over: the test deck's section (SEC unless given) in the mode. */
export function pendingFor(mode: Mode, sectionId = "SEC"): PendingRound {
  return { route: { deckId: DECK_ID, sectionId }, mode };
}
