import { describe, expect, it } from "vitest";
import { golden } from "@/scripts/native/golden/geometry";
import { NATIVE_FUNCTIONS } from "@/scripts/native/registry";
import { view } from "./golden-view";

const GEOMETRY_MODULES = [
  "components/play/ticketScroll",
  "components/FlightPath",
  "components/StreakPath",
  "components/LivesPath",
  "components/TimedPath",
  "components/BoardingPass",
  "design/system/tokens",
];

const EM_DASH = String.fromCharCode(0x2014);

describe("the geometry group", () => {
  const files = golden();
  const wanted = NATIVE_FUNCTIONS.filter((entry) => GEOMETRY_MODULES.includes(entry.module));

  it("has a vector file for every function and constant reference 3.9 lists for these modules, and no other", () => {
    expect(wanted).toHaveLength(21);
    const made = files.map((file) => `${view(file).module}.${view(file).function}`);
    expect([...made].sort()).toEqual(wanted.map((entry) => `${entry.module}.${entry.name}`).sort());
    for (const entry of wanted) {
      const file = files.find((candidate) => view(candidate).module === entry.module && view(candidate).function === entry.name);
      expect(file?.path, entry.name).toBe(`native-data/golden/${entry.module.replaceAll("/", ".")}.${entry.name}.json`);
      expect(view(file!).source, entry.name).toBe(entry.source);
      expect(view(file!).tests, entry.name).toEqual(expect.arrayContaining([...entry.tests]));
    }
  });

  it("gives a constant one case with a null input, and a function none", () => {
    for (const entry of wanted) {
      const file = files.find((candidate) => view(candidate).module === entry.module && view(candidate).function === entry.name);
      const cases = view(file!).cases;
      if (entry.kind === "constant") {
        expect(cases, entry.name).toHaveLength(1);
        expect(cases[0]?.input, entry.name).toBeNull();
      } else {
        expect(cases.length, entry.name).toBeGreaterThan(0);
        expect(cases.some((one) => one.input === null), entry.name).toBe(false);
      }
    }
  });

  it("names every case once, so a pinned case can be found by its name", () => {
    for (const file of files) {
      const names = view(file).cases.map((one) => one.name);
      expect(new Set(names).size, file.path).toBe(names.length);
    }
  });

  it("is byte-identical on a second run", () => {
    expect(golden()).toEqual(files);
  });

  it("holds no em dash, no local path and nothing shaped like an e-mail address", () => {
    for (const file of files) {
      expect(file.content, file.path).not.toContain(EM_DASH);
      expect(file.content, file.path).not.toMatch(/\/Users\/|\/home\/|[A-Za-z]:\\/);
      expect(file.content, file.path).not.toMatch(/\w@\w+\.\w/);
      expect(file.content.endsWith("}\n"), file.path).toBe(true);
    }
  });
});
