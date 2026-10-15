// The states of the visual review, mirroring SCREEN_ELEMENTS in ScreenWalk.kt (compare.test.mjs pins it), with the
// ids and the colour probes of plan B's review: what both walks capture, which element frames are compared, and where
// colours are sampled. The Timed stamp beat (reference P3t) is not captured: it lasts 700 ms; the feel recordings cover it.
export const SEED = 1234567; // REVIEW_SEED in ScreenWalk.kt and in plan B
export const THEMES = ["day", "night"];
export const ELEMENTS = ["logo", "pass", "ticket", "stub", "sheet", "start", "true", "false", "next", "results", "keep", "again", "another"];
// The pills are found by their accessible names on both platforms (reference 4.5).
export const PILLS = {
  start: "Start round",
  true: "True",
  false: "False",
  next: "Next card",
  results: "See results",
  keep: "Keep playing",
  again: "Play again",
  another: "Choose another route",
};
// The colour role of each pill's fill (reference 5.1). Choose another route is a quiet button: no fill to probe.
const FILL = { true: "true", false: "false", next: "ink", results: "ink", start: "ink", again: "ink", keep: "ink" };

// The sky 4 dp from the left edge, where nothing else is drawn, at heights clear of the upper cloud (196 to 242);
// under the leave sheet the scrim lies over it.
const SKY_Y = [120, 300, 560, 860];
const sky = (scrim = false) => SKY_Y.map((y) => ({ name: `sky-${y}`, x: 4, y, scrim }));
// The accent band 4 dp below the top of a pass or ticket, at its horizontal centre.
const band = (element) => ({ name: `${element}-band`, element, fx: 0.5, dy: 4, role: "accent" });
// The ticket's paper 6 dp in from its left edge and 50 down, under the band.
const paper = { name: "ticket-paper", element: "ticket", dx: 6, dy: 50, role: "surface-raised" };
// The sheet card 10 dp in from its left edge at half its height (inside its 20 padding).
const sheetPaper = { name: "sheet-paper", element: "sheet", dx: 10, fy: 0.5, role: "surface-raised" };
// A pill 14 dp in from its left edge at half its height: its fill.
const fill = (element) => ({ name: `${element}-fill`, element, dx: 14, fy: 0.5, role: FILL[element] });

const screen = (id, elements, samples) => ({ id, elements, samples });
const pass = (id, ...pills) => screen(id, ["pass", ...pills], [...sky(), band("pass"), ...pills.map(fill)]);
const question = (id) => screen(id, ["ticket", "stub", "true", "false"], [...sky(), band("ticket"), paper, fill("true"), fill("false")]);
const result = (id) => screen(id, ["ticket", "again", "another"], [...sky(), band("ticket"), paper, fill("again")]);

export const SCREENS = [
  screen("s1", ["logo"], sky()),
  pass("s2"),
  pass("s3"),
  pass("s4"),
  pass("s5"),
  pass("s6", "start"),
  question("p2"),
  screen("p3", ["ticket", "next"], [...sky(), band("ticket"), paper, fill("next")]),
  screen("p4", ["sheet", "keep"], [...sky(true), sheetPaper, fill("keep")]),
  result("r1"),
  question("streak-p2"),
  result("streak-r1"),
  question("lives-p2"),
  result("lives-r1"),
  // The opened Why scrolls the stage, so the ticket's top may lie above the screen: only the sky is sampled.
  screen("lives-r1-why", ["ticket"], sky()),
  question("timed-p2"),
  screen("timed-up", ["ticket", "results"], [...sky(), band("ticket"), paper, fill("results")]),
  result("timed-r1"),
  screen("s1-returning", ["logo"], sky()),
  pass("s3-recent"),
];
