import { describe, expect, it } from "vitest";
import { golden as copy } from "@/scripts/native/golden/copy";
import { golden as geometry } from "@/scripts/native/golden/geometry";
import { goldenProducers } from "@/scripts/native/registry";

describe("goldenProducers", () => {
  it("includes the copy group and the geometry group, with all 34 of their files", () => {
    const produced = goldenProducers().flatMap((produce) => produce().map((file) => file.path));
    const mine = [...copy(), ...geometry()].map((file) => file.path);
    expect(mine).toHaveLength(34);
    expect(new Set(mine).size).toBe(34);
    for (const path of mine) expect(produced, path).toContain(path);
  });
});
