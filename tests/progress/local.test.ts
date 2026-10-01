import { afterEach, describe, expect, it, vi } from "vitest";
import { browserLocalStorage, createLocalStore, PROGRESS_KEY } from "@/src/progress/local";
import { emptyProgress, type Progress } from "@/src/progress/progress";

// A small stand-in for window.localStorage that behaves like the real one: strings in, strings out.
class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }
}

const played: Progress = {
  version: 1,
  cards: { "aws-clf-c02-t2.1-06": { seen: 2, lastCorrect: true, lastSeenAt: 1_790_000_000_000 } },
  records: { "aws-clf-c02/SEC#classic": 7 },
  last: { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" },
};

describe("PROGRESS_KEY", () => {
  it("is one versioned key", () => {
    expect(PROGRESS_KEY).toBe("truthy.progress.v1");
  });
});

describe("createLocalStore with a working storage", () => {
  it("loads empty progress when nothing has been stored", () => {
    expect(createLocalStore(new MemoryStorage()).load()).toEqual(emptyProgress());
  });

  it("saves under PROGRESS_KEY as JSON", () => {
    const storage = new MemoryStorage();
    createLocalStore(storage).save(played);
    expect(JSON.parse(storage.items.get(PROGRESS_KEY) ?? "null")).toEqual(played);
  });

  it("round-trips progress through the storage", () => {
    const storage = new MemoryStorage();
    createLocalStore(storage).save(played);
    expect(createLocalStore(storage).load()).toEqual(played);
  });

  it("loads what the latest save wrote", () => {
    const storage = new MemoryStorage();
    const store = createLocalStore(storage);
    store.save(played);
    store.save(emptyProgress());
    expect(store.load()).toEqual(emptyProgress());
  });

  it("loads empty progress when the stored value is corrupt", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEY, "{corrupt");
    expect(createLocalStore(storage).load()).toEqual(emptyProgress());
  });

  it("returns a copy, so changing the loaded value does not change what is stored", () => {
    const storage = new MemoryStorage();
    const store = createLocalStore(storage);
    store.save(played);
    const loaded = store.load();
    loaded.records["aws-clf-c02/SEC#classic"] = 0;
    expect(store.load()).toEqual(played);
  });

  it("does not touch other keys", () => {
    const storage = new MemoryStorage();
    storage.setItem("truthy.deck.aws-clf-c02", "deck");
    createLocalStore(storage).save(played);
    expect(storage.items.get("truthy.deck.aws-clf-c02")).toBe("deck");
  });
});

describe("createLocalStore without a usable storage", () => {
  it("loads empty progress and ignores saves when there is no storage", () => {
    const store = createLocalStore(undefined);
    expect(store.load()).toEqual(emptyProgress());
    expect(() => store.save(played)).not.toThrow();
    expect(store.load()).toEqual(emptyProgress());
  });

  it("loads empty progress when getItem throws", () => {
    const storage = new MemoryStorage();
    storage.getItem = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    expect(() => createLocalStore(storage).load()).not.toThrow();
    expect(createLocalStore(storage).load()).toEqual(emptyProgress());
  });

  it("does not throw when setItem throws because the storage is full", () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    };
    expect(() => createLocalStore(storage).save(played)).not.toThrow();
  });

  it("keeps the previously stored progress when a save fails", () => {
    const storage = new MemoryStorage();
    const store = createLocalStore(storage);
    store.save(played);
    storage.setItem = () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    };
    store.save(emptyProgress());
    expect(store.load()).toEqual(played);
  });
});

describe("browserLocalStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is undefined where there is no window, as during prerendering", () => {
    expect(typeof window).toBe("undefined");
    expect(browserLocalStorage()).toBeUndefined();
  });

  it("is the window's localStorage when it can be reached", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    expect(browserLocalStorage()).toBe(storage);
  });

  it("is undefined when reading window.localStorage throws, as with blocked site data", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    expect(() => browserLocalStorage()).not.toThrow();
    expect(browserLocalStorage()).toBeUndefined();
  });

  it("gives a store that still works when the storage is blocked", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    const store = createLocalStore(browserLocalStorage());
    expect(store.load()).toEqual(emptyProgress());
    expect(() => store.save(played)).not.toThrow();
  });
});
