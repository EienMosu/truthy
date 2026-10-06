import { describe, expect, it } from "vitest";
import { createLocalStore, PROGRESS_KEY, UNREADABLE_KEY } from "@/src/progress/local";
import { emptyProgress, readProgress, type Progress } from "@/src/progress/progress";

// Review finding U43 (spec section 7): a stored value is read part by part. A record, a card's history or
// the last route that fails is dropped alone and the rest is kept; only a value that is not JSON, not an
// object or of another version starts empty. Before the store writes over a value that did not read back
// whole, it keeps the raw string under UNREADABLE_KEY.

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }
}

const SEC = { deckId: "aws-clf-c02", sectionId: "SEC" };

const stored: Progress = {
  version: 1,
  cards: {
    "aws-clf-c02-t1.1-01": { seen: 3, lastCorrect: false, lastSeenAt: 1_790_000_000_000 },
    "aws-clf-c02-t2.1-06": { seen: 1, lastCorrect: true, lastSeenAt: 1_790_000_100_000 },
  },
  records: { "aws-clf-c02/SEC#classic": 7, "gcp-cdl/ALL#classic": 8 },
  last: { route: SEC, mode: "classic", score: 7, total: 10 },
};

// Each invalid part, the stored value with only that part changed, and what reading it keeps.
const PARTS: readonly { name: string; raw: string; kept: Progress }[] = [
  {
    name: "a bad record",
    raw: JSON.stringify({ ...stored, records: { ...stored.records, "aws-clf-c02/APP#classic": 7.5 } }),
    kept: stored,
  },
  {
    name: "a bad card entry",
    raw: JSON.stringify({ ...stored, cards: { ...stored.cards, "aws-clf-c02-t3.1-01": { seen: -1, lastCorrect: true, lastSeenAt: 1 } } }),
    kept: stored,
  },
  {
    name: "a last route with a mode a later version added",
    raw: JSON.stringify({ ...stored, last: { route: SEC, mode: "daily", score: 7, total: 10 } }),
    kept: { ...stored, last: null },
  },
  {
    name: "a card history that is not an object",
    raw: JSON.stringify({ ...stored, cards: "x" }),
    kept: { ...stored, cards: {} },
  },
  {
    name: "records that are not an object",
    raw: JSON.stringify({ ...stored, records: [] }),
    kept: { ...stored, records: {} },
  },
];

// Values that cannot be read at all.
const UNREADABLE: readonly { name: string; raw: string }[] = [
  { name: "unparsable JSON", raw: "{not json" },
  { name: "a value cut short", raw: JSON.stringify(stored).slice(0, 40) },
  { name: "null", raw: "null" },
  { name: "a number", raw: "42" },
  { name: "an array", raw: "[]" },
  { name: "a future version", raw: JSON.stringify({ ...stored, version: 2 }) },
  { name: "a version stored as a string", raw: JSON.stringify({ ...stored, version: "1" }) },
  { name: "no version", raw: JSON.stringify({ cards: stored.cards, records: stored.records, last: stored.last }) },
];

describe("readProgress", () => {
  it("reads a valid value back whole", () => {
    expect(readProgress(JSON.stringify(stored))).toEqual({ progress: stored, whole: true });
  });

  it("reads nothing stored as empty and whole, since there is nothing to keep", () => {
    expect(readProgress(null)).toEqual({ progress: emptyProgress(), whole: true });
  });

  it("reads a value without scores in its last route whole, as it was stored before scores were kept", () => {
    const older = { ...stored, last: { route: SEC, mode: "classic" } };
    expect(readProgress(JSON.stringify(older)).whole).toBe(true);
  });

  it("reads a value whole when only unknown fields are dropped", () => {
    expect(readProgress(JSON.stringify({ ...stored, theme: "night" })).whole).toBe(true);
  });

  for (const part of PARTS) {
    it(`drops ${part.name} alone and keeps the rest`, () => {
      expect(readProgress(part.raw)).toEqual({ progress: part.kept, whole: false });
    });
  }

  for (const value of UNREADABLE) {
    it(`reads ${value.name} as empty, not whole`, () => {
      expect(readProgress(value.raw)).toEqual({ progress: emptyProgress(), whole: false });
    });
  }

  it("keeps a __proto__ key of a dropped part's neighbours as a plain key", () => {
    const raw = '{"version":1,"cards":{"__proto__":{"seen":1,"lastCorrect":true,"lastSeenAt":1},"bad":{"seen":-1}},"records":{},"last":null}';
    const { progress } = readProgress(raw);
    expect(Object.getPrototypeOf(progress.cards)).toBe(Object.prototype);
    expect(Object.keys(progress.cards)).toEqual(["__proto__"]);
    expect(({} as Record<string, unknown>)["seen"]).toBeUndefined();
  });
});

describe("the local store over a value that did not read back whole", () => {
  it("loads the valid parts", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEY, PARTS[2]!.raw);
    expect(createLocalStore(storage).load()).toEqual({ ...stored, last: null });
  });

  for (const value of [...PARTS, ...UNREADABLE]) {
    it(`keeps the raw value of ${value.name} under the side key before writing over it`, () => {
      const storage = new MemoryStorage();
      storage.setItem(PROGRESS_KEY, value.raw);
      const store = createLocalStore(storage);
      store.save(store.load());
      expect(storage.items.get(UNREADABLE_KEY)).toBe(value.raw);
      expect(readProgress(storage.items.get(PROGRESS_KEY) ?? null).whole).toBe(true);
    });
  }

  it("keeps the valid records through a save, as at the start of a round", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEY, PARTS[2]!.raw);
    const store = createLocalStore(storage);
    store.save(store.load());
    expect(createLocalStore(storage).load().records).toEqual(stored.records);
  });

  it("makes the copy once: later saves over the clean value leave the side key alone", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEY, "{not json");
    const store = createLocalStore(storage);
    store.save(stored);
    storage.setItem(UNREADABLE_KEY, "marker");
    store.save(emptyProgress());
    expect(storage.items.get(UNREADABLE_KEY)).toBe("marker");
  });

  it("replaces the side key with a later unreadable value", () => {
    const storage = new MemoryStorage();
    const store = createLocalStore(storage);
    storage.setItem(PROGRESS_KEY, "{first");
    store.save(stored);
    storage.setItem(PROGRESS_KEY, "{second");
    store.save(stored);
    expect(storage.items.get(UNREADABLE_KEY)).toBe("{second");
  });

  it("writes no side key over a value that reads whole, or when nothing is stored", () => {
    const storage = new MemoryStorage();
    const store = createLocalStore(storage);
    store.save(stored);
    store.save(emptyProgress());
    expect(storage.items.has(UNREADABLE_KEY)).toBe(false);
  });

  it("does not write over the value when it cannot be kept aside first", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEY, "{not json");
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (key === UNREADABLE_KEY) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      setItem(key, value);
    };
    expect(() => createLocalStore(storage).save(stored)).not.toThrow();
    expect(storage.items.get(PROGRESS_KEY)).toBe("{not json");
  });
});
