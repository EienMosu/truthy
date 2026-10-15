// Golden vectors for the steps of the start flow and what hangs on them: the step helpers
// (components/start/StartFlow.tsx), the list cue (components/start/listCue.ts) and the two labels
// (components/FillInPass.tsx, components/start/ContinueLine.tsx). Outputs are computed by calling the TypeScript
// functions on the index of ./catalog-fixture.
//
// A class table that a case closes a class in travels in the case's input as `modeTable` (see withClosedClasses
// in ./content).
import { changeLabel, type PassFieldName } from "@/components/FillInPass";
import { continueLabel } from "@/components/start/ContinueLine";
import { RECENT, STEP_OF, canShow, chosenOn, clearFrom, pathTo, previousStep, stepOf, type Choice, type Step } from "@/components/start/StartFlow";
import { FADE_PX, listCue, revealDelta, type ItemSpan } from "@/components/start/listCue";
import { MODE_TABLE, lastScoreText, modeInfo } from "@/src/app-state/modes";
import { CATALOG_INDEX } from "./catalog-fixture";
import { withClosedClasses } from "./content";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const FLOW_TESTS = ["tests/components/start/StartFlow.test.tsx", "tests/components/start/unoffered.test.tsx"] as const;
const CUE_TESTS = ["tests/components/start/listCue.test.tsx", "tests/components/start/reveal-on-return.test.tsx"] as const;
// The registry (task 4) gives each label the tests of its own web file.
const CHANGE_LABEL_TESTS = ["tests/components/FillInPass.test.tsx"] as const;
const CONTINUE_LABEL_TESTS = ["tests/components/start/ContinueLine.test.tsx", "tests/components/start/continue-line-polish.test.tsx"] as const;

function startFile(module: string, source: string, tests: readonly string[], name: string, cases: readonly GoldenCase[]): GoldenFile {
  return goldenFile({ module, function: name, source, tests }, cases);
}

const flowFile = (name: string, cases: readonly GoldenCase[]) => startFile("components/start/StartFlow", "components/start/StartFlow.tsx", FLOW_TESTS, name, cases);
const cueFile = (name: string, cases: readonly GoldenCase[]) => startFile("components/start/listCue", "components/start/listCue.ts", CUE_TESTS, name, cases);

// ---------- the steps and the choices ----------

const STEPS: readonly Step[] = [1, 2, 3, 4, 5, 6];
const CHOICE_KEYS = ["via", "areaId", "platformId", "deckId", "sectionId", "mode"] as const satisfies readonly (keyof Choice)[];

const AWS: Choice = { areaId: "cloud", platformId: "aws" };
const CLF: Choice = { ...AWS, deckId: "aws-clf-c02" };
const CLF_SEC: Choice = { ...CLF, sectionId: "SEC" };
const FULL: Choice = { ...CLF_SEC, mode: "classic" };
const GCP: Choice = { areaId: "cloud", platformId: "gcp" };
const CDL_ALL: Choice = { ...GCP, deckId: "gcp-cdl", sectionId: "ALL" };
const RECENT_CLF: Choice = { via: RECENT, ...CLF };
const RECENT_FULL: Choice = { via: RECENT, ...FULL };

function stepOfFile(): GoldenFile {
  const cases: GoldenCase[] = [];
  for (const key of CHOICE_KEYS) {
    cases.push({ name: `${key} on the ordinary path`, input: { key, choice: {} }, output: stepOf(key, {}) });
    cases.push({ name: `${key} on the recent path`, input: { key, choice: { via: RECENT } }, output: stepOf(key, { via: RECENT }) });
  }
  cases.push({ name: "areaId with a full recent choice", input: { key: "areaId", choice: RECENT_FULL }, output: stepOf("areaId", RECENT_FULL) });
  cases.push({ name: "areaId with an ordinary choice", input: { key: "areaId", choice: FULL }, output: stepOf("areaId", FULL) });
  return flowFile("stepOf", cases);
}

function stepOfTableFile(): GoldenFile {
  return flowFile("STEP_OF", [{ name: "the step on which each choice is made on the ordinary path", input: null, output: STEP_OF }]);
}

function clearFromFile(): GoldenFile {
  const call = (name: string, choice: Choice, step: Step): GoldenCase => ({ name, input: { choice, step }, output: clearFrom(choice, step) });
  const cases: GoldenCase[] = [];
  for (const step of STEPS) cases.push(call(`a full choice, back to step ${step}`, FULL, step));
  for (const step of STEPS) cases.push(call(`a full recent choice, back to step ${step}`, RECENT_FULL, step));
  cases.push(call("a partial choice keeps what was chosen before the step", AWS, 2));
  cases.push(call("a partial choice keeps nothing at step 1", AWS, 1));
  cases.push(call("an empty choice stays empty", {}, 4));
  cases.push(call("the recent path keeps via and clears the area and platform at step 2", RECENT_FULL, 2));
  cases.push(call("the section and class of a deck without sections", { ...CDL_ALL, mode: "streak" }, 5));
  return flowFile("clearFrom", cases);
}

function pathToFile(): GoldenFile {
  const cases: GoldenCase[] = [];
  for (const step of STEPS) {
    cases.push({ name: `up to step ${step}, with sections`, input: { step, hasSections: true }, output: pathTo(step, true) });
    cases.push({ name: `up to step ${step}, without sections`, input: { step, hasSections: false }, output: pathTo(step, false) });
    cases.push({ name: `up to step ${step}, recent path, with sections`, input: { step, hasSections: true, recent: true }, output: pathTo(step, true, true) });
    cases.push({ name: `up to step ${step}, recent path, without sections`, input: { step, hasSections: false, recent: true }, output: pathTo(step, false, true) });
    cases.push({ name: `up to step ${step}, recent spelled false`, input: { step, hasSections: true, recent: false }, output: pathTo(step, true, false) });
  }
  return flowFile("pathTo", cases);
}

function previousStepFile(): GoldenFile {
  const cases: GoldenCase[] = [];
  for (const step of STEPS) {
    cases.push({ name: `back from step ${step}, with sections`, input: { step, hasSections: true }, output: previousStep(step, true) });
    cases.push({ name: `back from step ${step}, without sections`, input: { step, hasSections: false }, output: previousStep(step, false) });
    cases.push({ name: `back from step ${step}, recent path, with sections`, input: { step, hasSections: true, recent: true }, output: previousStep(step, true, true) });
    cases.push({ name: `back from step ${step}, recent path, without sections`, input: { step, hasSections: false, recent: true }, output: previousStep(step, false, true) });
  }
  return flowFile("previousStep", cases);
}

function chosenOnFile(): GoldenFile {
  const call = (name: string, target: Step, choice: Choice): GoldenCase => ({ name, input: { target, choice }, output: chosenOn(target, choice) });
  return flowFile("chosenOn", [
    call("the Recent card on step 1 of the recent path", 1, RECENT_CLF),
    call("the deck on step 3 of the recent path", 3, RECENT_CLF),
    call("the area on step 1", 1, { areaId: "cloud" }),
    call("the platform on step 2", 2, AWS),
    call("the deck on step 3", 3, CLF),
    call("the section on step 4", 4, CLF_SEC),
    call("the class on step 5", 5, FULL),
    call("nothing on step 6", 6, { mode: "classic" }),
    call("nothing on step 6 of a full choice", 6, FULL),
    call("nothing when the step was not chosen yet", 3, AWS),
    call("the area is still the card of step 1 when via is not set", 1, FULL),
    call("the section of a recent choice on step 4", 4, { via: RECENT, ...CLF_SEC }),
    call("step 2 on the recent path still names the platform", 2, RECENT_CLF),
    call("step 1 of the recent path with nothing else", 1, { via: RECENT }),
  ]);
}

function canShowFile(): GoldenFile {
  const call = (name: string, step: Step, choice: Choice): GoldenCase => ({ name, input: { index: CATALOG_INDEX, step, choice }, output: canShow(CATALOG_INDEX, step, choice) });
  const cases: GoldenCase[] = [
    call("step 1 needs nothing", 1, {}),
    call("step 1 with a full choice", 1, FULL),
    call("step 2 needs the area", 2, {}),
    call("step 2 with an area", 2, { areaId: "cloud" }),
    call("step 2 with an area the index does not have", 2, { areaId: "gone" }),
    call("step 3 needs the platform", 3, { areaId: "cloud" }),
    call("step 3 with a platform", 3, AWS),
    call("step 3 with a platform the index does not have", 3, { areaId: "cloud", platformId: "gone" }),
    call("step 3 with a platform of another area", 3, { areaId: "frontend", platformId: "aws" }),
    call("step 3 with a full choice", 3, FULL),
    call("step 4 with a deck that has sections", 4, CLF),
    call("step 4 needs a deck", 4, AWS),
    call("step 4 with a deck that has no sections", 4, { ...GCP, deckId: "gcp-cdl" }),
    call("step 4 with a deck of another platform", 4, { ...AWS, deckId: "gcp-cdl" }),
    call("step 5 needs the section", 5, CLF),
    call("step 5 with a section", 5, CLF_SEC),
    call("step 5 with the whole deck of a deck with sections", 5, { ...CLF, sectionId: "ALL" }),
    call("step 5 with a section the deck does not have", 5, { ...CLF, sectionId: "OLD" }),
    call("step 5 with a section of another deck", 5, { ...CLF, sectionId: "RSC" }),
    call("step 5 with the whole deck of a deck without sections", 5, CDL_ALL),
    call("step 5 with a section of a deck that has none", 5, { ...GCP, deckId: "gcp-cdl", sectionId: "SEC" }),
    call("step 6 with a class", 6, FULL),
    call("step 6 needs a class", 6, CLF_SEC),
    call("step 6 with a class that does not exist", 6, { ...CLF_SEC, mode: "zen" as never }),
    call("step 6 needs the section", 6, { ...CLF, mode: "classic" }),
    call("step 6 of a deck without sections", 6, { ...CDL_ALL, mode: "lives" }),
    call("step 6 with Streak", 6, { ...CLF_SEC, mode: "streak" }),
    call("step 6 with Three lives", 6, { ...CLF_SEC, mode: "lives" }),
    call("step 6 with Timed while it is offered", 6, { ...CLF_SEC, mode: "timed" }),
    call("step 1 on the recent path", 1, { via: RECENT }),
    call("step 2 does not exist on the recent path", 2, { via: RECENT }),
    call("step 2 does not exist on the recent path, even with an area", 2, { via: RECENT, areaId: "cloud" }),
    call("step 3 of the recent path needs no area or platform", 3, { via: RECENT }),
    call("step 3 needs the platform on the ordinary path", 3, {}),
    call("step 4 of the recent path needs the deck", 4, { via: RECENT }),
    call("step 4 of the recent path with a deck that has sections", 4, RECENT_CLF),
    call("step 4 of the recent path with a deck that has none", 4, { via: RECENT, ...GCP, deckId: "gcp-cdl" }),
    call("step 4 of the recent path: the deck is found only inside its area and platform", 4, { via: RECENT, deckId: "aws-clf-c02" }),
    call("step 5 of the recent path with the whole deck", 5, { via: RECENT, ...CDL_ALL }),
    call("step 6 of the recent path", 6, RECENT_FULL),
  ];
  for (const mode of ["timed", "streak"] as const) {
    const choice: Choice = { ...CLF_SEC, mode };
    cases.push(withClosedClasses(["timed"], (modeTable) => ({ name: `step 6 with ${mode} while Timed is closed`, input: { index: CATALOG_INDEX, step: 6, choice, modeTable }, output: canShow(CATALOG_INDEX, 6, choice) })));
  }
  const closed: Choice = { ...CLF_SEC, mode: "timed" };
  cases.push(withClosedClasses(["timed"], (modeTable) => ({ name: "step 5 does not look at the class while Timed is closed", input: { index: CATALOG_INDEX, step: 5, choice: closed, modeTable }, output: canShow(CATALOG_INDEX, 5, closed) })));
  return flowFile("canShow", cases);
}

function flowFiles(): GoldenFile[] {
  return [stepOfTableFile(), stepOfFile(), clearFromFile(), pathToFile(), previousStepFile(), chosenOnFile(), canShowFile()];
}

// ---------- the list cue ----------

/** `count` cards of `height` with `gap` between them, the first at `first`, minus how far the list has scrolled. */
function cards(count: number, height: number, gap: number, first: number, scrollTop = 0): ItemSpan[] {
  return Array.from({ length: count }, (_, i) => {
    const top = first + i * (height + gap) - scrollTop;
    return { top, bottom: top + height };
  });
}

function bottomOf(items: ItemSpan[]): number {
  return items.at(-1)?.bottom ?? 0;
}

function listCueFile(): GoldenFile {
  const call = (name: string, viewHeight: number, contentBottom: number, items: ItemSpan[]): GoldenCase => ({
    name,
    input: { viewHeight, contentBottom, items },
    output: listCue(viewHeight, contentBottom, items),
  });
  const five = cards(5, 90, 12, 6);
  const nine = cards(9, 90, 12, 6);
  const four = cards(4, 108, 12, 0);
  const cases: GoldenCase[] = [
    call("no cue while the content ends inside the view", 518, bottomOf(five), five),
    call("no cue when the content ends one pixel below the view (rounding)", 503, 504, five),
    call("a cue when the content ends two pixels below the view", 503, 505, five),
    call("the fade ends at the edge when the fold cuts a card that shows 65 px", 581, bottomOf(nine), nine),
    call("the fade ends at the edge when the fold shows exactly 28 px", 516 + FADE_PX, bottomOf(nine), nine),
    call("the fade moves up when the fold shows 27 px", 516 + FADE_PX - 1, bottomOf(nine), nine),
    call("the fade ends on the card above when the fold falls in the gap", 236, bottomOf(four), four),
    call("the fade lifts most of the way when the fold shows a 2 px sliver", 518, bottomOf(nine), nine),
    call("the fade ends on the card above when the fold shows 0 px", 516, bottomOf(nine), nine),
    call("content below the view and no cards: a cue without a lift", 100, 300, []),
    call("every card inside the view but the content runs on", 200, 400, cards(2, 50, 10, 0)),
    call("the first card starts below the fold", 100, 400, cards(3, 90, 12, 150)),
    call("the first card starts exactly at the fold", 100, 400, cards(3, 90, 12, 100)),
    call("a view of height 0", 0, 90, cards(1, 90, 12, 0)),
    call("fractional positions", 300.5, 612.75, cards(6, 90.25, 11.5, 5.5)),
    call("the last card in view", 518, 504, cards(5, 90, 12, 6)),
    call("one very tall card", 400, 1000, [{ top: 0, bottom: 1000 }]),
  ];
  for (const scrollTop of [0, 10, 20, 30, 40, 50, 60, 63, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300, 390, 394, 400]) {
    const scrolled = cards(9, 90, 12, 6, scrollTop);
    cases.push(call(`nine cards scrolled by ${scrollTop} px`, 518, bottomOf(scrolled), scrolled));
  }
  return cueFile("listCue", cases);
}

function revealDeltaFile(): GoldenFile {
  const call = (name: string, viewHeight: number, item: ItemSpan, room: number): GoldenCase => ({
    name,
    input: { viewHeight, item, room },
    output: revealDelta(viewHeight, item, room),
  });
  return cueFile("revealDelta", [
    call("a card that shows whole needs no scroll", 400, { top: 100, bottom: 200 }, 8),
    call("scrolls down to a card below the view, the fade's room included", 400, { top: 500, bottom: 600 }, 8),
    call("scrolls up to a card above the view", 400, { top: -150, bottom: -50 }, 8),
    call("shows the top of a card taller than the view", 100, { top: 50, bottom: 300 }, 8),
    call("a card whose ring just fits at the top", 400, { top: 8, bottom: 108 }, 8),
    call("a card one pixel too high for its ring", 400, { top: 7, bottom: 107 }, 8),
    call("a card whose fade room just fits at the bottom", 400, { top: 264, bottom: 364 }, 8),
    call("a card one pixel too low for the fade room", 400, { top: 265, bottom: 365 }, 8),
    call("no room around the card", 400, { top: 300, bottom: 400 }, 0),
    call("a card taller than the view that starts above it", 100, { top: -20, bottom: 300 }, 8),
    call("a card that starts at the top and is taller than the view", 100, { top: 8, bottom: 300 }, 8),
    call("fractional positions", 400.5, { top: 301.25, bottom: 420.5 }, 8),
  ]);
}

function fadeFile(): GoldenFile {
  return cueFile("FADE_PX", [{ name: "the length of the fade", input: null, output: FADE_PX }]);
}

function listCueFiles(): GoldenFile[] {
  return [fadeFile(), listCueFile(), revealDeltaFile()];
}

// ---------- the labels ----------

function changeLabelFile(): GoldenFile {
  const call = (name: string, field: PassFieldName, value: string): GoldenCase => ({ name, input: { field, value }, output: changeLabel(field, value) });
  return startFile("components/FillInPass", "components/FillInPass.tsx", CHANGE_LABEL_TESTS, "changeLabel", [
    call("names the deck field", "deck", "CLF"),
    call("names the mode field a class", "mode", "Classic"),
    call("names the area field", "area", "Cloud"),
    call("names the platform field", "platform", "AWS"),
    call("names the section field", "section", "SEC"),
    call("the section of a whole deck", "section", "ALL"),
    call("a class with a long name", "mode", "Three lives"),
    call("an empty value", "area", ""),
  ]);
}

type ContinueProps = Parameters<typeof continueLabel>[0];

function continueLabelFile(): GoldenFile {
  // continueLabel takes one object; the vector names that parameter `props`.
  const call = (name: string, props: ContinueProps): GoldenCase => ({ name, input: { props }, output: continueLabel(props) });
  const route = { deckName: "AWS Cloud Practitioner", sectionTitle: "Security and compliance", modeLabel: "Classic" };
  const cases: GoldenCase[] = [
    call("names the route and the class in full", route),
    call("adds the last score when it is known", { ...route, lastScore: "7 of 10" }),
    call("says a Streak score in its own words", { ...route, modeLabel: "Streak", lastScore: "13 in a row" }),
    call("says Needs a connection when its deck cannot be played now", { ...route, lastScore: "7 of 10", needsConnection: true }),
    call("needs a connection without a score", { ...route, needsConnection: true }),
    call("needsConnection false is the ordinary line", { ...route, lastScore: "7 of 10", needsConnection: false }),
    call("an empty last score is no score", { ...route, lastScore: "" }),
    call("the deck named as the pass names it", { deckName: "Next.js Rendering", sectionTitle: "Server and client components", modeLabel: "Classic", lastScore: "7 of 10" }),
    call("a deck with its own pass name and the whole deck", { deckName: "Google Cloud Digital Leader", sectionTitle: "Whole deck", modeLabel: "Classic", lastScore: "7 of 10" }),
  ];
  for (const row of MODE_TABLE) {
    cases.push(call(`${row.name} with the score as the continue line words it`, { ...route, modeLabel: modeInfo(row.id).name, lastScore: lastScoreText(row.id, 7, 10) }));
  }
  return startFile("components/start/ContinueLine", "components/start/ContinueLine.tsx", CONTINUE_LABEL_TESTS, "continueLabel", cases);
}

function labelFiles(): GoldenFile[] {
  return [changeLabelFile(), continueLabelFile()];
}

export function stepFiles(): GoldenFile[] {
  return [...flowFiles(), ...listCueFiles(), ...labelFiles()];
}
