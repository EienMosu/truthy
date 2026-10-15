import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  close,
  colourFindings,
  expectedColour,
  frameFindings,
  hex,
  over,
  samplePoint,
  skyColour,
  skyStops,
  tokenColour,
  unapproved,
  withApprovals,
} from "./compare.mjs";
import { ELEMENTS, SCREENS } from "./screens.mjs";

// The DTCG shape of design/system/tokens.json: references between colour tokens, hex and an optional alpha.
const colour = (hexValue, alpha) => ({ $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 0], hex: hexValue, ...(alpha === undefined ? {} : { alpha }) } });
const ref = (path) => ({ $type: "color", $value: `{${path}}` });
const tokens = {
  color: {
    primitive: {
      black: colour("#000000"),
      grey: colour("#646464"),
      silver: colour("#c8c8c8"),
      white: colour("#ffffff"),
      navy: colour("#10233f", 0.32),
      amber: colour("#f5b400"),
    },
    day: {
      "sky-1": ref("color.primitive.black"),
      "sky-2": ref("color.primitive.grey"),
      middle: ref("color.primitive.silver"),
      "sky-3": ref("color.day.middle"),
      "sky-4": ref("color.primitive.white"),
      scrim: ref("color.primitive.navy"),
      accent: ref("color.primitive.amber"),
    },
  },
  native: { "sky-stops": [0, 0.35, 0.62, 1] },
};
const grey = (n) => ({ r: n, g: n, b: n, a: 1 });

test("a token colour follows its references to a hex value and an alpha", () => {
  assert.deepEqual(tokenColour(tokens, "color.day.sky-3"), grey(200));
  assert.deepEqual(tokenColour(tokens, "color.day.scrim"), { r: 16, g: 35, b: 63, a: 0.32 });
  assert.throws(() => tokenColour(tokens, "color.day.nope"), /no token color\.day\.nope/);
});

test("the sky mixes its four stops at 0, 35, 62 and 100 percent of the height", () => {
  assert.deepEqual(skyStops(tokens), [0, 0.35, 0.62, 1]);
  assert.throws(() => skyStops({}), /no native\.sky-stops/);
  const cases = [[0, 0], [0.175, 50], [0.35, 100], [0.62, 200], [0.81, 228], [1, 255], [-0.5, 0], [1.5, 255]];
  for (const [fraction, value] of cases) assert.deepEqual(skyColour(tokens, "day", fraction), grey(value), `at ${fraction}`);
});

test("the scrim is laid over the sky, and a role sample is the role's colour", () => {
  assert.deepEqual(over({ r: 16, g: 35, b: 63, a: 0.32 }, { r: 169, g: 214, b: 240, a: 1 }), { r: 120, g: 157, b: 183, a: 1 });
  assert.deepEqual(expectedColour(tokens, "day", { name: "sky-0", x: 4, y: 0, scrim: true }, 100), { r: 5, g: 11, b: 20, a: 1 });
  assert.deepEqual(expectedColour(tokens, "day", { name: "sky-50", x: 4, y: 17.5 }, 100), grey(50));
  assert.deepEqual(expectedColour(tokens, "day", { name: "band", element: "ticket", fx: 0.5, dy: 22, role: "accent" }, 100), {
    r: 245,
    g: 180,
    b: 0,
    a: 1,
  });
});

test("a sample point is fixed on the screen or placed inside its element", () => {
  assert.deepEqual(samplePoint({ x: 4, y: 120 }, {}), { x: 4, y: 120 });
  assert.deepEqual(samplePoint({ element: "ticket", fx: 0.5, dy: 22 }, { ticket: [10, 100, 380, 500] }), { x: 200, y: 122 });
  assert.deepEqual(samplePoint({ element: "sheet", dx: 8, dyBottom: 8 }, { sheet: [16, 600, 380, 200] }), { x: 24, y: 792 });
  assert.deepEqual(samplePoint({ element: "sheet", dx: 10, fy: 0.5 }, { sheet: [16, 600, 380, 200] }), { x: 26, y: 700 });
  assert.equal(samplePoint({ element: "sheet", dx: 8, dyBottom: 8 }, {}), null);
});

test("colours within 3 per channel are close, and are written as hex", () => {
  assert.equal(close({ r: 1, g: 2, b: 3 }, { r: 4, g: 5, b: 6 }), true);
  assert.equal(close({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 4 }), false);
  assert.equal(hex({ r: 10, g: 20, b: 255 }), "#0a14ff");
});

test("frames within 2 dp pass; a larger offset and a missing element are findings", () => {
  const android = { frames: { logo: [16, 36, 150, 30], pass: [16, 200, 380, 120], stub: [16, 500, 380, 228] } };
  const web = { frames: { logo: [17.5, 36, 150, 31], pass: [16, 203, 380, 120] } };
  assert.deepEqual(frameFindings("s2", "day", android, web, ["logo", "pass", "ticket", "stub"]), [
    { theme: "day", screen: "s2", kind: "frame", name: "pass", detail: "android 16, 200, 380, 120; web 16, 203, 380, 120; off by 3.0 dp" },
    { theme: "day", screen: "s2", kind: "missing-android", name: "ticket", detail: "not found on android" },
    { theme: "day", screen: "s2", kind: "missing-web", name: "stub", detail: "not found on the web" },
  ]);
});

test("a colour finding names the sample and both colours; a sample of a missing element is left to the frame check", () => {
  const sampled = [
    { name: "sky-120", expected: { r: 10, g: 20, b: 30, a: 1 }, actual: { r: 12, g: 20, b: 30, a: 1 } },
    { name: "sky-300", expected: { r: 10, g: 20, b: 30, a: 1 }, actual: { r: 10, g: 24, b: 30, a: 1 } },
    { name: "pass-band", expected: { r: 245, g: 180, b: 0, a: 1 }, actual: null },
  ];
  assert.deepEqual(colourFindings("s1", "night", "android", sampled), [
    { theme: "night", screen: "s1", kind: "colour-android", name: "sky-300", detail: "expected #0a141e, was #0a181e" },
  ]);
});

test("approvals mark findings by key, and only the others block", () => {
  const findings = [
    { theme: "day", screen: "s2", kind: "frame", name: "pass", detail: "off by 3.0 dp" },
    { theme: "night", screen: "p2", kind: "colour-web", name: "ticket-band", detail: "expected #e0a52c, was #ffffff" },
  ];
  const judged = withApprovals(findings, [{ key: "day/s2/frame/pass", reason: "Owner, 2026-10-21: the status bar is taller" }]);
  assert.equal(judged[0].key, "day/s2/frame/pass");
  assert.equal(judged[0].approved, true);
  assert.equal(judged[0].reason, "Owner, 2026-10-21: the status bar is taller");
  assert.equal(judged[1].approved, false);
  assert.deepEqual(unapproved(judged).map((f) => f.key), ["night/p2/colour-web/ticket-band"]);
});

test("the screens and their elements are the ones the Android walk captures (ScreenWalk.kt)", () => {
  const kotlin = readFileSync(new URL("../../Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/support/ScreenWalk.kt", import.meta.url), "utf8");
  const walk = [...kotlin.matchAll(/"([\w-]+)" to listOf\(([^)]*)\)/g)].map(([, id, list]) => ({ id, elements: [...list.matchAll(/"(\w+)"/g)].map((m) => m[1]) }));
  assert.deepEqual(SCREENS.map(({ id, elements }) => ({ id, elements })), walk);
  for (const screen of SCREENS) {
    for (const element of screen.elements) assert.ok(ELEMENTS.includes(element), `${screen.id}: unknown element ${element}`);
    for (const sample of screen.samples) {
      if (sample.element !== undefined) assert.ok(screen.elements.includes(sample.element), `${screen.id}: ${sample.name} samples an element the screen does not capture`);
    }
  }
});

test("the states are the twenty of plan B's review, in its order, each once", () => {
  assert.deepEqual(SCREENS.map((s) => s.id), [
    "s1", "s2", "s3", "s4", "s5", "s6", "p2", "p3", "p4", "r1",
    "streak-p2", "streak-r1", "lives-p2", "lives-r1", "lives-r1-why", "timed-p2", "timed-up", "timed-r1",
    "s1-returning", "s3-recent",
  ]);
});

test("the colour probes are the points both platforms read", () => {
  const byId = Object.fromEntries(SCREENS.map((s) => [s.id, s.samples]));
  const names = (id) => byId[id].map((s) => s.name);
  const skies = ["sky-120", "sky-300", "sky-560", "sky-860"];
  assert.deepEqual(names("p2"), [...skies, "ticket-band", "ticket-paper", "true-fill", "false-fill"]);
  assert.deepEqual(names("p4"), [...skies, "sheet-paper", "keep-fill"]);
  assert.deepEqual(names("s6"), [...skies, "pass-band", "start-fill"]);
  assert.ok(byId.p4.filter((s) => s.name.startsWith("sky-")).every((s) => s.scrim === true && s.x === 4));
  const frames = { ticket: [16, 100, 380, 500], sheet: [16, 600, 380, 200], keep: [36, 700, 340, 52], true: [216, 640, 180, 52] };
  const at = (id, name) => samplePoint(byId[id].find((s) => s.name === name), frames);
  assert.deepEqual(at("p2", "ticket-band"), { x: 206, y: 104 });
  assert.deepEqual(at("p2", "ticket-paper"), { x: 22, y: 150 });
  assert.deepEqual(at("p4", "sheet-paper"), { x: 26, y: 700 });
  assert.deepEqual(at("p4", "keep-fill"), { x: 50, y: 726 });
  assert.deepEqual(at("p2", "true-fill"), { x: 230, y: 666 });
  assert.equal(byId.p2.find((s) => s.name === "true-fill").role, "true");
  assert.equal(byId.p2.find((s) => s.name === "false-fill").role, "false");
  assert.equal(byId.p4.find((s) => s.name === "keep-fill").role, "ink");
});

test("the committed resolved tokens give the colours the review expects (reference 5.1)", () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL("../../../native-data/tokens/resolved.json", import.meta.url), "utf8")).native["sky-stops"], [0, 0.35, 0.62, 1]);
  const resolved = JSON.parse(readFileSync(new URL("../../../native-data/tokens/resolved.json", import.meta.url), "utf8"));
  assert.equal(hex(tokenColour(resolved, "color.day.sky-1")), "#a9d6f0");
  assert.equal(hex(tokenColour(resolved, "color.night.sky-4")), "#1c2538");
  assert.equal(hex(tokenColour(resolved, "color.day.accent")), "#f5b400");
  assert.equal(hex(tokenColour(resolved, "color.night.surface-raised")), "#252f41");
  assert.deepEqual(tokenColour(resolved, "color.night.scrim"), { r: 0, g: 0, b: 0, a: 0.6 });
  assert.equal(tokenColour(resolved, "color.day.scrim").a, 0.32);
});
