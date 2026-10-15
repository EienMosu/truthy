import { describe, expect, it } from "vitest";
import { LogoMark } from "@/components/Logo";
import { pad2 } from "@/components/format";
import { oppositeTheme, parseTheme, resolveTheme, type Theme } from "@/src/app-state/theme";
import { createRng, shuffle } from "@/src/engine/rng";
import { decodeGoldenFile, rngOf, type DecodedGolden } from "@/scripts/native/golden/format";
import { golden as rngGolden } from "@/scripts/native/golden/rng";
import { golden as smallGolden } from "@/scripts/native/golden/small";

const FILES = new Map([...rngGolden(), ...smallGolden()].map((file) => [file.path, decodeGoldenFile(file.content)]));

function vectors(name: string): DecodedGolden {
  const found = FILES.get(`native-data/golden/${name}.json`);
  if (found === undefined) throw new Error(`no golden file ${name}`);
  return found;
}

function output(name: string, caseName: string): unknown {
  const found = vectors(name).cases.find((item) => item.name === caseName);
  if (found === undefined) throw new Error(`no case "${caseName}" in ${name}`);
  return found.output;
}

describe("the files of this task", () => {
  it("are the nine of rng, pad2, the logo and the theme", () => {
    expect([...FILES.keys()]).toEqual([
      "native-data/golden/src.engine.rng.createRng.json",
      "native-data/golden/src.engine.rng.shuffle.json",
      "native-data/golden/components.format.pad2.json",
      "native-data/golden/components.Logo.LogoMark.json",
      "native-data/golden/src.app-state.theme.THEME_KEY.json",
      "native-data/golden/src.app-state.theme.parseTheme.json",
      "native-data/golden/src.app-state.theme.oppositeTheme.json",
      "native-data/golden/src.app-state.theme.resolveTheme.json",
      "native-data/golden/src.app-state.theme.switchTheme.json",
    ]);
  });
});

describe("createRng vectors", () => {
  it("carry the reference values of rng.test.ts", () => {
    const raw = (caseName: string) => (output("src.engine.rng.createRng", caseName) as number[]).slice(0, 3).map((x) => x * 2 ** 32);
    expect(raw("seed 1: the reference values (rng.test.ts)")).toEqual([2693262067, 11749833, 2265367787]);
    expect(raw("seed 42: the reference values (rng.test.ts)")).toEqual([2581720956, 1925393290, 3661312704]);
    expect(raw("seed 0 (rng.test.ts)")).toEqual([1144304738, 1416247, 958946056]);
  });

  it("pin the seed coercion: -1 is 2^32 - 1, 1.9 and 2^32 + 1 are 1", () => {
    expect(output("src.engine.rng.createRng", "seed -1 is 2^32 - 1 (rng.test.ts)")).toEqual(output("src.engine.rng.createRng", "seed 2^32 - 1"));
    const one = output("src.engine.rng.createRng", "seed 1: the reference values (rng.test.ts)");
    expect(output("src.engine.rng.createRng", "seed 1.9 is 1 (rng.test.ts)")).toEqual(one);
    expect(output("src.engine.rng.createRng", "seed 2^32 + 1 is 1 (rng.test.ts)")).toEqual(one);
  });

  it("are what createRng draws for each input", () => {
    for (const { name, input, output: draws } of vectors("src.engine.rng.createRng").cases) {
      const rng = createRng((input as { seed: number }).seed);
      expect((draws as number[]).map(() => rng()), name).toEqual(draws);
    }
  });
});

describe("shuffle vectors", () => {
  it("carry the reference order of rng.test.ts and the draw count", () => {
    expect(output("src.engine.rng.shuffle", "a to h, seed 1: the reference order (rng.test.ts)")).toEqual(["c", "b", "g", "h", "e", "d", "a", "f"]);
    expect(output("src.engine.rng.shuffle", "an empty list draws nothing (rng.test.ts)")).toEqual([]);
    expect(output("src.engine.rng.shuffle", "a single item draws nothing (rng.test.ts)")).toEqual(["only"]);
    expect(output("src.engine.rng.shuffle", "a to h draws exactly 7 values (rng.test.ts: length - 1 draws)")).toEqual(["a", "f", "b", "h", "c", "g", "d", "e"]);
  });

  it("are what shuffle gives for each input, drawing no more values than the file lists", () => {
    for (const { name, input, output: order } of vectors("src.engine.rng.shuffle").cases) {
      const { items, rng } = input as { items: string[]; rng: Parameters<typeof rngOf>[0] };
      expect(shuffle(items, rngOf(rng)), name).toEqual(order);
    }
  });
});

describe("pad2, logo and theme vectors", () => {
  it("carry the pinned values of the web tests", () => {
    expect(vectors("components.format.pad2").cases.slice(0, 4).map((item) => item.output)).toEqual(["00", "07", "14", "120"]);
    expect(output("components.Logo.LogoMark", "the default width 44 gives 30 (Logo.test.tsx)")).toBe(30);
    expect(output("components.Logo.LogoMark", "width 26: the continue line (Logo.test.tsx: 17.73)")).toBe(17.73);
    expect(output("components.Logo.LogoMark", "width 0.33: an exact half, 22.5 hundredths, rounds up to 23, not to the even 22")).toBe(0.23);
    expect(vectors("src.app-state.theme.THEME_KEY").cases).toEqual([{ name: "THEME_KEY", input: null, output: "truthy.theme" }]);
    expect(output("src.app-state.theme.switchTheme", "choice none, system dark")).toEqual({ theme: "light", stored: "light" });
    expect(output("src.app-state.theme.switchTheme", "choice light, system dark")).toEqual({ theme: "dark", stored: "dark" });
  });

  it("are what the web code gives for each input", () => {
    for (const { name, input, output: expected } of vectors("components.format.pad2").cases) {
      expect(pad2((input as { n: number }).n), name).toBe(expected);
    }
    for (const { name, input, output: expected } of vectors("components.Logo.LogoMark").cases) {
      expect(LogoMark(input as { width?: number }).props.height, name).toBe(expected);
    }
    for (const { name, input, output: expected } of vectors("src.app-state.theme.parseTheme").cases) {
      expect(parseTheme((input as { value?: unknown }).value), name).toBe(expected);
    }
    for (const { name, input, output: expected } of vectors("src.app-state.theme.oppositeTheme").cases) {
      expect(oppositeTheme((input as { theme: Theme }).theme), name).toBe(expected);
    }
    for (const { name, input, output: expected } of vectors("src.app-state.theme.resolveTheme").cases) {
      const { choice, systemDark } = input as { choice: Theme | null; systemDark: boolean };
      expect(resolveTheme(choice, systemDark), name).toBe(expected);
      expect(output("src.app-state.theme.switchTheme", name), name).toEqual({ theme: oppositeTheme(expected as Theme), stored: oppositeTheme(expected as Theme) });
    }
  });
});
