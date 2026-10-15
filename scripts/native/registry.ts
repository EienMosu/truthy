// Reference section 3.9 as data: every function and constant the native apps port, with the web file it lives
// in and the web tests that pin it. Each entry gets one golden file (goldenPath of its module and name); task 9's
// coverage test fails for an entry without one. Left out on purpose, as the spec says: the web-only
// entriesBehind (components/start/StartFlow.tsx) and the browser storage adapter browserLocalStorage
// (src/progress/local.ts). canStillFinish is a closure inside searchWithAllRules and is pinned through it.

import type { GoldenFile, GoldenMeta } from "./golden/format";
import { golden as dealGolden } from "./golden/deal";
import { golden as rngGolden } from "./golden/rng";
import { golden as smallGolden } from "./golden/small";
import { golden as roundGolden } from "./golden/round";
import { golden as swipeGolden } from "./golden/swipe";

export interface NativeFunction {
  module: string;
  name: string;
  source: string;
  tests: readonly string[];
  kind: "function" | "constant";
}

interface Row {
  module: string;
  source: string;
  tests: readonly string[];
  functions: readonly string[];
  constants: readonly string[];
}

const ROWS: readonly Row[] = [
  {
    module: "src/engine/rng",
    source: "src/engine/rng.ts",
    tests: ["tests/engine/rng.test.ts"],
    functions: ["createRng", "shuffle"],
    constants: [],
  },
  {
    module: "src/engine/deal",
    source: "src/engine/deal.ts",
    tests: [
      "tests/engine/deal.test.ts",
      "tests/engine/deal-pins-polish.test.ts",
      "tests/engine/chunks.test.ts",
      "tests/engine/missed-cap-polish.test.ts",
      "tests/engine/search-polish.test.ts",
      "tests/engine/overdue-polish.test.ts",
      "tests/engine/overdue-boundary.test.ts",
      "tests/engine/deal.property.test.ts",
      "tests/content/shipped-dealing-polish.test.ts",
    ],
    functions: [
      "deal",
      "dealChunk",
      "dealRanked",
      "uniqueById",
      "dealSize",
      "wasSeen",
      "wasMissed",
      "lastSeenAt",
      "oldestFirst",
      "rankByPriority",
      "balanceFor",
      "choose",
      "searchOverCap",
      "searchWithAllRules",
      "relaxStepByStep",
      "sharesGroup",
      "trueCount",
      "balanceAllows",
      "arrange",
      "joinOf",
      "runLimit",
      "placementCheck",
      "pickAnswer",
    ],
    constants: ["DEAL", "CHUNK", "SEARCH_BUDGET", "OVERDUE_AFTER_PASSES"],
  },
  {
    module: "src/engine/round",
    source: "src/engine/round.ts",
    tests: ["tests/engine/round.test.ts", "tests/engine/modes.test.ts", "tests/engine/timed.test.ts", "tests/engine/clock-polish.test.ts"],
    functions: ["startRound", "reduce", "currentCard", "lastAnswer", "wrongCount", "livesLeft", "isDecided", "scoreOf", "summarise", "chunkSeed"],
    constants: ["CLASSIC_LENGTH", "LIVES", "TIMED"],
  },
  {
    module: "src/input/swipe",
    source: "src/input/swipe.ts",
    tests: ["tests/input/swipe.test.ts", "tests/input/swipe-polish.test.ts", "tests/input/swipe-early-touch-polish.test.ts"],
    functions: ["intent", "canStart", "interpret"],
    constants: ["SWIPE"],
  },
  {
    module: "src/progress/progress",
    source: "src/progress/progress.ts",
    tests: ["tests/progress/progress.test.ts", "tests/progress/progress-polish.test.ts", "tests/progress/partial-read.test.ts"],
    functions: ["emptyProgress", "recordKey", "bestFor", "compareWithBest", "applyResult", "pruneDeck", "seenShare", "readProgress", "parseProgress"],
    constants: [],
  },
  {
    module: "src/progress/local",
    source: "src/progress/local.ts",
    tests: ["tests/progress/local.test.ts", "tests/progress/partial-read.test.ts"],
    functions: ["createLocalStore"],
    constants: ["PROGRESS_KEY", "UNREADABLE_KEY"],
  },
  {
    module: "src/content/schema",
    source: "src/content/schema.ts",
    tests: ["tests/content/schema.test.ts", "tests/content/schema-polish.test.ts"],
    functions: ["deckPassName", "routeKey", "findRoute"],
    constants: ["WHOLE_DECK"],
  },
  {
    module: "src/content/load",
    source: "src/content/load.ts",
    tests: ["tests/content/load.test.ts"],
    functions: ["poolFor"],
    constants: [],
  },
  {
    module: "src/content/text",
    source: "src/content/text.ts",
    tests: ["tests/content/text.test.ts"],
    functions: ["textParts", "plainText"],
    constants: [],
  },
  {
    module: "src/app-state/modes",
    source: "src/app-state/modes.ts",
    tests: ["tests/app-state/modes.test.ts", "tests/app-state/modes-polish.test.ts", "tests/app-state/modes-score-copy-polish.test.ts"],
    functions: ["modeInfo", "isOffered", "lastScoreText"],
    constants: ["MODE_TABLE"],
  },
  {
    module: "src/app-state/theme",
    source: "src/app-state/theme.ts",
    tests: ["tests/app-state/theme.test.ts", "tests/app-state/theme-polish.test.ts"],
    functions: ["parseTheme", "oppositeTheme", "resolveTheme", "switchTheme"],
    constants: ["THEME_KEY"],
  },
  {
    module: "components/start/useCatalog",
    source: "components/start/useCatalog.ts",
    tests: ["tests/components/start/useCatalog.test.tsx", "tests/components/start/unoffered.test.tsx"],
    functions: ["deckCount", "decksLabel", "deckOfCard", "seenPercent", "continueTarget", "recentDecks", "withoutRemovedCards"],
    constants: ["RECENT_LIMIT"],
  },
  {
    module: "components/start/StartFlow",
    source: "components/start/StartFlow.tsx",
    tests: ["tests/components/start/StartFlow.test.tsx", "tests/components/start/unoffered.test.tsx"],
    functions: ["stepOf", "clearFrom", "pathTo", "previousStep", "chosenOn", "canShow"],
    constants: ["STEP_OF"],
  },
  {
    module: "components/start/listCue",
    source: "components/start/listCue.ts",
    tests: ["tests/components/start/listCue.test.tsx", "tests/components/start/reveal-on-return.test.tsx"],
    functions: ["listCue", "revealDelta"],
    constants: ["FADE_PX"],
  },
  {
    module: "components/FillInPass",
    source: "components/FillInPass.tsx",
    tests: ["tests/components/FillInPass.test.tsx"],
    functions: ["changeLabel"],
    constants: [],
  },
  {
    module: "components/start/ContinueLine",
    source: "components/start/ContinueLine.tsx",
    tests: ["tests/components/start/ContinueLine.test.tsx", "tests/components/start/continue-line-polish.test.tsx"],
    functions: ["continueLabel"],
    constants: [],
  },
  {
    module: "components/play/PlayScreen",
    source: "components/play/PlayScreen.tsx",
    tests: [
      "tests/components/play/PlayScreenTimed.test.tsx",
      "tests/components/play/timed-applies-to-polish.test.ts",
      "tests/components/play/round-status-voice.test.tsx",
    ],
    functions: ["verdictText", "roundStatus", "timedStatus", "timedCardText"],
    constants: ["NEXT_ARRIVES_MS", "SPOKEN_RELEASE_MS"],
  },
  {
    module: "components/play/leave",
    source: "components/play/leave.ts",
    tests: ["tests/components/play/leave.test.ts"],
    functions: ["leavesSomething", "saveLeftRound"],
    constants: [],
  },
  {
    module: "components/play/resultCopy",
    source: "components/play/resultCopy.ts",
    tests: ["tests/components/play/resultCopy.test.ts"],
    functions: ["resultCopy"],
    constants: [],
  },
  {
    module: "components/play/ResultView",
    source: "components/play/ResultView.tsx",
    tests: ["tests/components/play/ResultView.test.tsx"],
    functions: ["recordRound"],
    constants: ["RESULT_ARRIVES_MS"],
  },
  {
    module: "components/MissedCards",
    source: "components/MissedCards.tsx",
    tests: ["tests/components/MissedCards.test.tsx", "tests/components/missed-cards-applies-to-polish.test.tsx"],
    functions: ["missedCards"],
    constants: [],
  },
  {
    module: "components/play/ticketScroll",
    source: "components/play/ticketScroll.ts",
    tests: ["tests/components/play/ticketScroll.test.ts"],
    functions: ["statementScroll", "slipScroll", "keyScroll"],
    constants: ["ARROW_STEP"],
  },
  {
    module: "components/FlightPath",
    source: "components/FlightPath.tsx",
    tests: ["tests/components/FlightPath.test.tsx", "tests/components/FlightPath-polish.test.tsx"],
    functions: ["pointAt", "waypointT", "flownPath", "headingAt", "waypointStates", "cardList", "flightPathLabel", "completedLabel", "completedScale"],
    constants: [],
  },
  {
    module: "components/StreakPath",
    source: "components/StreakPath.tsx",
    tests: ["tests/components/StreakPath.test.tsx", "tests/components/StreakPath-polish.test.tsx"],
    functions: ["streakLayout", "streakLabel"],
    constants: [],
  },
  {
    module: "components/LivesPath",
    source: "components/LivesPath.tsx",
    tests: ["tests/components/LivesPath.test.tsx", "tests/components/LivesPath-polish.test.tsx"],
    functions: ["trailLayout", "livesLabel"],
    constants: [],
  },
  {
    module: "components/TimedPath",
    source: "components/TimedPath.tsx",
    tests: ["tests/components/TimedPath.test.tsx", "tests/components/TimedPath-polish.test.tsx"],
    functions: ["clockText", "timedLabel"],
    constants: [],
  },
  {
    module: "components/BoardingPass",
    source: "components/BoardingPass.tsx",
    tests: ["tests/components/BoardingPass.test.tsx"],
    functions: ["barcodeBars"],
    constants: [],
  },
  {
    module: "components/format",
    source: "components/format.ts",
    tests: ["tests/components/format.test.ts"],
    functions: ["pad2"],
    constants: [],
  },
  {
    module: "components/play/useRound",
    source: "components/play/useRound.ts",
    tests: ["tests/components/play/useRound.test.tsx"],
    functions: ["ticketFor"],
    constants: [],
  },
  {
    // The vector is the mark's height for a width: round(width * 30 / 44 * 100) / 100 (Logo.tsx:20).
    module: "components/Logo",
    source: "components/Logo.tsx",
    tests: ["tests/components/Logo.test.tsx"],
    functions: ["LogoMark"],
    constants: [],
  },
  {
    // The contrast pairs of the design system as one constant: the pairs are those of tests/tokens/contrast.test.ts,
    // the colours come from design/system/tokens.json.
    module: "design/system/tokens",
    source: "design/system/tokens.json",
    tests: ["tests/tokens/contrast.test.ts"],
    functions: [],
    constants: ["contrastPairs"],
  },
];

export const NATIVE_FUNCTIONS: readonly NativeFunction[] = ROWS.flatMap((row) => [
  ...row.functions.map((name) => ({ module: row.module, name, source: row.source, tests: row.tests, kind: "function" as const })),
  ...row.constants.map((name) => ({ module: row.module, name, source: row.source, tests: row.tests, kind: "constant" as const })),
]);

/** The registry entry of a function or constant; throws for a name reference 3.9 does not list. */
export function nativeFunction(module: string, name: string): NativeFunction {
  const found = NATIVE_FUNCTIONS.find((entry) => entry.module === module && entry.name === name);
  if (found === undefined) throw new Error(`${module}.${name} is not in the registry (reference 3.9)`);
  return found;
}

/** The meta of a golden file, read from the registry, so a producer never types a source or a test path. */
export function metaOf(module: string, name: string): GoldenMeta {
  const entry = nativeFunction(module, name);
  return { module: entry.module, function: entry.name, source: entry.source, tests: entry.tests };
}

/** One producer per scripts/native/golden/<group>.ts. Tasks 5 to 8 add theirs to this list. */
export function goldenProducers(): readonly (() => GoldenFile[])[] {
  return [rngGolden, smallGolden, dealGolden, roundGolden, swipeGolden];
}
