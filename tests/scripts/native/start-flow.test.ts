import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MODE_TABLE } from "@/src/app-state/modes";
import { golden } from "@/scripts/native/golden/start";

// The step, list cue and label vectors (components/start/StartFlow.tsx, listCue.ts, FillInPass.tsx,
// ContinueLine.tsx): the shape of every file, and the values the web's own tests pin, read back out of the
// generated files.

const root = fileURLToPath(new URL("../../../", import.meta.url));

interface Case {
  name: string;
  input: any;
  output: any;
}
interface Vectors {
  format: number;
  module: string;
  function: string;
  source: string;
  tests: string[];
  cards: Record<string, unknown>;
  cases: Case[];
}

const OWN = ["StartFlow", "listCue", "FillInPass", "ContinueLine"].map((name) => `.${name}.`);
const isOwn = (path: string) => OWN.some((marker) => path.includes(marker)) && !path.includes("useCatalog");
const files = golden().filter((file) => isOwn(file.path));
const parsed = files.map((file) => ({ path: file.path, content: file.content, vectors: JSON.parse(file.content) as Vectors }));

function vectorsOf(name: string): Vectors {
  const found = parsed.find((file) => file.vectors.function === name);
  if (!found) throw new Error(`no vectors for ${name}`);
  return found.vectors;
}

function caseOf(name: string, title: string): Case {
  const found = vectorsOf(name).cases.find((candidate) => candidate.name === title);
  if (!found) throw new Error(`no case "${title}" in ${name}`);
  return found;
}

describe("start-flow vectors: the files", () => {
  it("writes one file for each function and constant of the steps, the list cue and the two labels", () => {
    expect(files.map((file) => file.path).sort()).toEqual([
      "native-data/golden/components.FillInPass.changeLabel.json",
      "native-data/golden/components.start.ContinueLine.continueLabel.json",
      "native-data/golden/components.start.StartFlow.STEP_OF.json",
      "native-data/golden/components.start.StartFlow.canShow.json",
      "native-data/golden/components.start.StartFlow.chosenOn.json",
      "native-data/golden/components.start.StartFlow.clearFrom.json",
      "native-data/golden/components.start.StartFlow.pathTo.json",
      "native-data/golden/components.start.StartFlow.previousStep.json",
      "native-data/golden/components.start.StartFlow.stepOf.json",
      "native-data/golden/components.start.listCue.FADE_PX.json",
      "native-data/golden/components.start.listCue.listCue.json",
      "native-data/golden/components.start.listCue.revealDelta.json",
    ]);
  });

  it("names a source file and test files that exist, and the module and function in the path", () => {
    for (const { path, vectors } of parsed) {
      expect(vectors.format).toBe(1);
      expect(path).toBe(`native-data/golden/${vectors.module.replaceAll("/", ".")}.${vectors.function}.json`);
      expect(existsSync(`${root}${vectors.source}`), vectors.source).toBe(true);
      for (const test of vectors.tests) expect(existsSync(`${root}${test}`), test).toBe(true);
    }
  });

  it("gives every case a distinct name, an input and an output", () => {
    for (const { path, vectors } of parsed) {
      const names = vectors.cases.map((candidate) => candidate.name);
      expect(new Set(names).size, path).toBe(names.length);
      for (const candidate of vectors.cases) {
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("input");
        expect(candidate, `${path}: ${candidate.name}`).toHaveProperty("output");
      }
    }
  });

  it("gives byte-identical files on a second run, and leaves the class table open as it found it", () => {
    expect(golden().filter((file) => isOwn(file.path))).toEqual(files);
    expect(MODE_TABLE.map((row) => row.offered)).toEqual([true, true, true, true]);
  });
});

describe("start-flow vectors: steps and choices", () => {
  it("pins the step of each choice, and moves the area and platform to step 3 on the recent path", () => {
    expect(vectorsOf("STEP_OF").cases[0]!.output).toEqual({ via: 1, areaId: 1, platformId: 2, deckId: 3, sectionId: 4, mode: 5 });
    expect(caseOf("stepOf", "areaId with a full recent choice").output).toBe(3);
    expect(caseOf("stepOf", "areaId with an ordinary choice").output).toBe(1);
    expect(caseOf("stepOf", "via on the recent path").output).toBe(1);
    expect(caseOf("stepOf", "platformId on the recent path").output).toBe(3);
    expect(caseOf("stepOf", "platformId on the ordinary path").output).toBe(2);
    expect(caseOf("stepOf", "mode on the recent path").output).toBe(5);
  });

  it("clears a step's choice and every later one", () => {
    const clear = (title: string) => caseOf("clearFrom", title).output;
    const all = { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC", mode: "classic" };
    expect(clear("a full choice, back to step 3")).toEqual({ areaId: "cloud", platformId: "aws" });
    expect(clear("a full choice, back to step 6")).toEqual(all);
    expect(clear("a full choice, back to step 1")).toEqual({});
    expect(clear("a full recent choice, back to step 3")).toEqual({ via: "recent" });
    expect(clear("a full recent choice, back to step 4")).toEqual({ via: "recent", areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02" });
    expect(clear("a full recent choice, back to step 1")).toEqual({});
  });

  it("walks every step, skips the section step for a deck without sections, and the platform step on the recent path", () => {
    const path = (title: string) => caseOf("pathTo", title).output;
    expect(path("up to step 6, with sections")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(path("up to step 6, without sections")).toEqual([1, 2, 3, 5, 6]);
    expect(path("up to step 6, recent path, with sections")).toEqual([1, 3, 4, 5, 6]);
    expect(path("up to step 5, recent path, without sections")).toEqual([1, 3, 5]);
    expect(path("up to step 1, with sections")).toEqual([1]);
    expect(path("up to step 2, with sections")).toEqual([1, 2]);
    expect(path("up to step 4, without sections")).toEqual([1, 2, 3]);
    expect(caseOf("pathTo", "up to step 3, recent spelled false").input.recent).toBe(false);
    expect(caseOf("pathTo", "up to step 3, with sections").input).not.toHaveProperty("recent");
  });

  it("goes back one step on the path", () => {
    const back = (title: string) => caseOf("previousStep", title).output;
    expect(back("back from step 5, without sections")).toBe(3);
    expect(back("back from step 5, with sections")).toBe(4);
    expect(back("back from step 2, with sections")).toBe(1);
    expect(back("back from step 1, with sections")).toBe(1);
    expect(back("back from step 3, recent path, with sections")).toBe(1);
    expect(back("back from step 4, recent path, with sections")).toBe(3);
    expect(back("back from step 5, recent path, without sections")).toBe(3);
  });

  it("names the card to focus on the way back, undefined as the tagged undefined", () => {
    const chosen = (title: string) => caseOf("chosenOn", title).output;
    expect(chosen("the Recent card on step 1 of the recent path")).toBe("recent");
    expect(chosen("the deck on step 3 of the recent path")).toBe("aws-clf-c02");
    expect(chosen("the area on step 1")).toBe("cloud");
    expect(chosen("the platform on step 2")).toBe("aws");
    expect(chosen("nothing on step 6")).toEqual({ $undefined: true });
    expect(chosen("nothing when the step was not chosen yet")).toEqual({ $undefined: true });
  });

  it("knows whether a remembered step can still be shown with the index", () => {
    const shown = (title: string) => caseOf("canShow", title).output;
    expect(shown("step 4 with a deck that has sections")).toBe(true);
    expect(shown("step 4 with a deck that has no sections")).toBe(false);
    expect(shown("step 3 with a platform the index does not have")).toBe(false);
    expect(shown("step 6 with a class")).toBe(true);
    expect(shown("step 6 with Streak")).toBe(true);
    expect(shown("step 3 of the recent path needs no area or platform")).toBe(true);
    expect(shown("step 3 needs the platform on the ordinary path")).toBe(false);
    expect(shown("step 2 does not exist on the recent path, even with an area")).toBe(false);
    expect(shown("step 4 of the recent path with a deck that has sections")).toBe(true);
    expect(shown("step 5 with the whole deck of a deck without sections")).toBe(true);
    expect(shown("step 5 with a section the deck does not have")).toBe(false);
    expect(shown("step 6 needs a class")).toBe(false);
  });

  it("refuses a class that is not offered at step 6, and no other step or class", () => {
    expect(caseOf("canShow", "step 6 with Timed while it is offered").output).toBe(true);
    expect(caseOf("canShow", "step 6 with timed while Timed is closed").output).toBe(false);
    expect(caseOf("canShow", "step 6 with streak while Timed is closed").output).toBe(true);
    expect(caseOf("canShow", "step 5 does not look at the class while Timed is closed").output).toBe(true);
    expect(caseOf("canShow", "step 6 with timed while Timed is closed").input.modeTable.map((row: any) => row.offered)).toEqual([true, true, true, false]);
    expect(caseOf("canShow", "step 6 with Streak").input).not.toHaveProperty("modeTable");
  });
});

describe("start-flow vectors: the list cue", () => {
  const cue = (title: string) => caseOf("listCue", title).output;

  it("pins the length of the fade", () => {
    expect(vectorsOf("FADE_PX").cases[0]).toMatchObject({ input: null, output: 28 });
  });

  it("shows no cue while the content ends inside the view, a pixel allowed for rounding", () => {
    expect(cue("no cue while the content ends inside the view")).toEqual({ more: false, lift: 0 });
    expect(cue("no cue when the content ends one pixel below the view (rounding)")).toEqual({ more: false, lift: 0 });
    expect(cue("a cue when the content ends two pixels below the view")).toEqual({ more: true, lift: 0 });
  });

  it("ends the fade at the edge when the fold cuts a card that shows at least 28 px", () => {
    expect(cue("the fade ends at the edge when the fold cuts a card that shows 65 px")).toEqual({ more: true, lift: 0 });
    expect(cue("the fade ends at the edge when the fold shows exactly 28 px")).toEqual({ more: true, lift: 0 });
  });

  it("ends the fade on the card above when the fold falls in the gap", () => {
    expect(cue("the fade ends on the card above when the fold falls in the gap")).toEqual({ more: true, lift: 8 });
    expect(cue("the fade ends on the card above when the fold shows 0 px")).toEqual({ more: true, lift: 12 });
  });

  it("lifts the fade most of the way when the fold shows only a sliver, to the exact double", () => {
    expect(cue("the fade lifts most of the way when the fold shows a 2 px sliver")).toEqual({ more: true, lift: 14 * (1 - 2 / 28) });
    expect(cue("the fade moves up when the fold shows 27 px")).toEqual({ more: true, lift: (543 - 504) * (1 - 27 / 28) });
  });

  it("follows the scroll: the cue is gone once the last card is in view", () => {
    expect(cue("nine cards scrolled by 100 px").more).toBe(true);
    expect(cue("nine cards scrolled by 390 px").more).toBe(true);
    expect(cue("nine cards scrolled by 394 px")).toEqual({ more: false, lift: 0 });
  });

  it("moves the end of the fade without a jump as the list scrolls: at most 2 px per px of scroll, as the web's test holds", () => {
    const scrolls = vectorsOf("listCue")
      .cases.filter((c) => /^nine cards scrolled by \d+ px$/.test(c.name))
      .map((c) => ({ scrollTop: Number(/\d+/.exec(c.name)![0]), end: 518 - c.output.lift }))
      .filter((c) => c.scrollTop <= 300)
      .sort((a, b) => a.scrollTop - b.scrollTop);
    expect(scrolls).toHaveLength(32);
    scrolls.slice(1).forEach((c, i) => {
      const before = scrolls[i]!;
      expect(Math.abs(c.end - before.end), `${before.scrollTop} to ${c.scrollTop}`).toBeLessThanOrEqual(2 * (c.scrollTop - before.scrollTop));
    });
  });

  it("pins the cases that have no card on the fold", () => {
    expect(cue("content below the view and no cards: a cue without a lift")).toEqual({ more: true, lift: 0 });
    expect(cue("every card inside the view but the content runs on")).toEqual({ more: true, lift: 0 });
    expect(cue("the first card starts below the fold")).toEqual({ more: true, lift: 0 });
    expect(cue("the last card in view")).toEqual({ more: false, lift: 0 });
  });
});

describe("start-flow vectors: revealDelta", () => {
  const delta = (title: string) => caseOf("revealDelta", title).output;

  it("leaves a card that shows whole, scrolls to one below or above, and shows the top of a tall one", () => {
    expect(delta("a card that shows whole needs no scroll")).toBe(0);
    expect(delta("scrolls down to a card below the view, the fade's room included")).toBe(600 + 8 + 28 - 400);
    expect(delta("scrolls up to a card above the view")).toBe(-158);
    expect(delta("shows the top of a card taller than the view")).toBe(42);
  });

  it("pins the edges of the room", () => {
    expect(delta("a card whose ring just fits at the top")).toBe(0);
    expect(delta("a card one pixel too high for its ring")).toBe(-1);
    expect(delta("a card whose fade room just fits at the bottom")).toBe(0);
    expect(delta("a card one pixel too low for the fade room")).toBe(1);
    expect(delta("no room around the card")).toBe(28);
  });
});

describe("start-flow vectors: the labels", () => {
  it("names what a filled field of the pass changes", () => {
    expect(caseOf("changeLabel", "names the deck field").output).toBe("Change deck, now CLF");
    expect(caseOf("changeLabel", "names the mode field a class").output).toBe("Change class, now Classic");
    expect(caseOf("changeLabel", "names the area field").output).toBe("Change area, now Cloud");
    expect(caseOf("changeLabel", "names the platform field").output).toBe("Change platform, now AWS");
    expect(caseOf("changeLabel", "names the section field").output).toBe("Change section, now SEC");
  });

  it("words the continue line's accessible name", () => {
    const label = (title: string) => caseOf("continueLabel", title).output;
    expect(label("names the route and the class in full")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Classic.");
    expect(label("adds the last score when it is known")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.");
    expect(label("says a Streak score in its own words")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Streak. Last score 13 in a row.");
    expect(label("says Needs a connection when its deck cannot be played now")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection.");
    expect(label("needsConnection false is the ordinary line")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.");
    expect(label("an empty last score is no score")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Classic.");
    expect(label("the deck named as the pass names it")).toBe("Continue: Next.js Rendering, Server and client components, Classic. Last score 7 of 10.");
    expect(label("Three lives with the score as the continue line words it")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Three lives. Last score 7 cards.");
    expect(label("Timed with the score as the continue line words it")).toBe("Continue: AWS Cloud Practitioner, Security and compliance, Timed. Last score 7 correct.");
  });

  it("names the one parameter props", () => {
    expect(Object.keys(caseOf("continueLabel", "adds the last score when it is known").input)).toEqual(["props"]);
  });
});
