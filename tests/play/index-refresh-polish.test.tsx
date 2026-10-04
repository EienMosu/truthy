// @vitest-environment jsdom
// Review finding U10: every round start fetched the index again and, on a network that hangs, waited the whole
// fetch timeout (8 s) for it, also on Play again seconds after the index had been loaded. A later round in
// the same page now waits only INDEX_REFRESH_MS for the fetch and otherwise goes on with the index the last
// round was dealt from; an answering network still wins, so a deck update between rounds still shows up.
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INDEX_REFRESH_MS, prepareRound, useRound } from "@/components/play/useRound";
import { FETCH_TIMEOUT_MS } from "@/src/content/load";
import { DECK, DECK_ID, INDEX, harness, pendingFor } from "../components/play/fixtures";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("prepareRound with the index of the last round", () => {
  it("goes on with that index once the refetch has taken INDEX_REFRESH_MS, and still asks for it", async () => {
    const h = harness(pendingFor("classic"));
    const first = await prepareRound(pendingFor("classic"), h.services);
    if (!first) throw new Error("no round");
    vi.useFakeTimers();
    h.network.hold = true; // the network stops answering
    h.network.calls.length = 0;
    let done = false;
    const second = prepareRound(pendingFor("classic"), h.services, first.index).then((prepared) => {
      done = true;
      return prepared;
    });
    await vi.advanceTimersByTimeAsync(INDEX_REFRESH_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect((await second)?.round.cards).toHaveLength(10);
    expect(h.network.calls).toEqual(["/decks/index.json"]);
  });

  it("uses that index when the refetch fails at once", async () => {
    const h = harness(pendingFor("classic"));
    const first = await prepareRound(pendingFor("classic"), h.services);
    if (!first) throw new Error("no round");
    h.network.online = false;
    expect((await prepareRound(pendingFor("classic"), h.services, first.index))?.round.cards).toHaveLength(10);
  });

  it("takes the fetched index when the network answers in time", async () => {
    const h = harness(pendingFor("classic"));
    const first = await prepareRound(pendingFor("classic"), h.services);
    if (!first) throw new Error("no round");
    const index = structuredClone(INDEX);
    const entry = index.areas[0]?.platforms[0]?.decks[0];
    if (!entry) throw new Error("no deck in the index");
    entry.hash = "hash-2";
    const calls: string[] = [];
    h.services.fetcher = async (url) => {
      calls.push(url);
      const path = url.split("?")[0];
      const body = path === "/decks/index.json" ? index : { ...DECK, hash: "hash-2" };
      return { ok: true, json: async () => structuredClone(body) };
    };
    const second = await prepareRound(pendingFor("classic"), h.services, first.index);
    expect(second?.index).toEqual(index);
    expect(calls).toEqual(["/decks/index.json", `/decks/${DECK_ID}.json?v=hash-2`]);
  });
});

describe("useRound: Play again on a network that hangs", () => {
  it("deals the next round without waiting the fetch timeout", async () => {
    const h = harness(pendingFor("streak"));
    const hook = renderHook(() => useRound(h.services, vi.fn()));
    await waitFor(() => expect(hook.result.current.status.kind).toBe("ready"));
    h.network.hold = true;
    const restartedAt = Date.now();
    act(() => hook.result.current.restart());
    expect(hook.result.current.status.kind).toBe("loading");
    await waitFor(() => expect(hook.result.current.status.kind).toBe("ready"), { timeout: FETCH_TIMEOUT_MS / 2 });
    expect(Date.now() - restartedAt).toBeLessThan(FETCH_TIMEOUT_MS / 2);
  });
});
