import { describe, expect, it } from "vitest";
import { golden as content } from "@/scripts/native/golden/content";
import { golden as progress } from "@/scripts/native/golden/progress";
import { golden as start } from "@/scripts/native/golden/start";
import { NATIVE_FUNCTIONS, goldenProducers } from "@/scripts/native/registry";

// The producers of progress, content and start are registered, and every file they write is a function or a
// constant of the inventory (reference 3.9) with the same source file and the same kind.
describe("registry: progress, content and start", () => {
  it("runs the three producers", () => {
    expect(goldenProducers()).toEqual(expect.arrayContaining([progress, content, start]));
  });

  it("writes each path once", () => {
    const paths = [...progress(), ...content(), ...start()].map((file) => file.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toHaveLength(12 + 11 + 20);
  });

  it("writes only files of the inventory, with its source file, its tests and its kind", () => {
    for (const file of [...progress(), ...content(), ...start()]) {
      const vectors = JSON.parse(file.content) as { module: string; function: string; source: string; tests: string[]; cases: { input: unknown }[] };
      const listed = NATIVE_FUNCTIONS.find((candidate) => candidate.module === vectors.module && candidate.name === vectors.function);
      expect(listed, file.path).toBeDefined();
      expect(listed?.source, file.path).toBe(vectors.source);
      expect(listed?.tests ?? [], file.path).toEqual(expect.arrayContaining(vectors.tests));
      expect(listed?.kind, file.path).toBe(vectors.cases[0]?.input === null ? "constant" : "function");
    }
  });
});
