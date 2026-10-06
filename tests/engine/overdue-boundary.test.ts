import { describe, expect, it } from "vitest";
import type { Card } from "@/src/content/schema";
import { CHUNK, dealChunk } from "@/src/engine/deal";
import { createRng } from "@/src/engine/rng";

function card(id: string, answer: boolean, conflictGroups: string[] = []): Card {
  return {
    id,
    section: "SEC",
    text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
    answer,
    source: { title: "AWS documentation", url: "https://docs.aws.amazon.com/" },
    difficulty: 2,
    appliesTo: "",
    conflictGroups,
  };
}

// The other vectors of the overdue rule deal routes of 21 to 24 cards, so no chunk is dealt at exactly twice the
// route (42 to 48 cards), and a clone that waited for more than two passes would still match them. This one deals a
// route of 25 cards, so the sixth chunk is dealt at exactly 50: the card the round has not shown is overdue at that
// chunk, not at the one after it.
describe("deal: reference vector at the overdue threshold", () => {
  it("six chunks with the seeds 150 to 155 deal exactly these cards, k1 overdue in the sixth, dealt at exactly twice the route", () => {
    // 25 cards with answers True, False, True, ...; each of k1 to k5 shares a group with the card eleven places later
    // (k1 with k12, up to k5 with k16). k12 is in the second and fourth chunks, so it is among the ten cards before
    // the third and the fifth, and the fourth cannot take k1 beside it. Without the overdue rule, the sixth chunk
    // deals k12 again and keeps k1 out; with it, k1 goes in and k12 stays out.
    const route = Array.from({ length: 25 }, (_, i) => {
      const pair = i < 5 ? i : i - (CHUNK + 1);
      return card(`k${i + 1}`, i % 2 === 0, pair >= 0 && pair < 5 ? [`pair${pair + 1}`] : []);
    });
    const dealt: Card[] = [];
    for (let k = 0; k < 6; k++) dealt.push(...dealChunk(route, {}, createRng(150 + k), dealt));
    expect(dealt.slice(0, 2 * route.length).map((c) => c.id)).not.toContain("k1");
    expect(dealt.map((c) => c.id)).toEqual([
      "k15", "k23", "k2", "k6", "k10", "k11", "k22", "k5", "k24", "k14",
      "k12", "k7", "k25", "k21", "k18", "k17", "k20", "k8", "k9", "k19",
      "k3", "k10", "k16", "k6", "k13", "k4", "k22", "k11", "k23", "k24",
      "k12", "k21", "k17", "k19", "k18", "k8", "k25", "k20", "k9", "k7",
      "k10", "k5", "k15", "k23", "k24", "k6", "k22", "k11", "k14", "k2",
      "k25", "k1", "k20", "k9", "k19", "k8", "k21", "k17", "k16", "k18",
    ]);
  });
});
