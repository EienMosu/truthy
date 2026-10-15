import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  STATES,
  checkColors,
  classifyFrames,
  compareFrames,
  frameDiff,
  hexToRgb,
  probesFor,
  sideBySide,
  skyHex,
  statusBarCheck,
  tokenHex,
} from "./compare.mjs";

const TOKENS = JSON.parse(readFileSync(new URL("../../../native-data/tokens/resolved.json", import.meta.url), "utf8"));

/** A plain image of one colour, with optional rectangles painted over it (in pixels). */
function canvas(width, height, hex, rects = []) {
  const data = new Uint8Array(width * height * 4);
  const fill = (x0, y0, x1, y1, rgb) => {
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) data.set([...rgb, 255], (y * width + x) * 4);
  };
  fill(0, 0, width, height, hexToRgb(hex));
  for (const [x0, y0, x1, y1, color] of rects) fill(x0, y0, x1, y1, hexToRgb(color));
  return { width, height, data, profile: "none" };
}

test("tokens resolve through their references to the values of reference 5.1", () => {
  assert.equal(tokenHex(TOKENS, "day", "sky-1"), "#a9d6f0");
  assert.equal(tokenHex(TOKENS, "night", "sky-1"), "#0b1528");
  assert.equal(tokenHex(TOKENS, "day", "surface-raised"), "#fdfbf5");
  assert.equal(tokenHex(TOKENS, "night", "accent"), "#e0a52c");
  assert.equal(tokenHex(TOKENS, "day", "true"), "#1d5cc0");
  assert.equal(tokenHex(TOKENS, "night", "ink"), "#e6e3da");
  assert.throws(() => tokenHex(TOKENS, "day", "no-such-role"), /does not resolve/);
});

test("a frame difference is the largest of x, y, width and height", () => {
  assert.equal(frameDiff([16, 100, 398, 300], [17.5, 99, 398, 302.25]), 2.25);
});

test("frames compare within 2 points, report what one side lacks and honour approvals", () => {
  const web = { ticket: [16, 100, 398, 300], "pill:True": [223, 838, 191, 60], logo: [16, 88, 160, 36] };
  const ios = { ticket: [16, 101.5, 398, 300], "pill:True": [223, 841, 191, 60], stub: [16, 420, 398, 228] };
  const results = compareFrames(web, ios, "large-day-p2", { "large-day-p2:stub": "the web has no stub frame here" });
  assert.deepEqual(
    results.map((r) => [r.name, r.diff, r.ok, r.missing]),
    [
      ["logo", null, false, "ios"],
      ["pill:True", 3, false, null],
      ["stub", null, true, "web"],
      ["ticket", 1.5, true, null],
    ],
  );
});

test("the probes of a screen follow its frames; the leave sheet reads the sky under the scrim, the sheet and its pill", () => {
  const frames = { ticket: [16, 100, 398, 600], "pill:True": [223, 838, 191, 60], sheet: [16, 600, 398, 250], "pill:Keep playing": [36, 700, 358, 60] };
  const sky = (y, scrim) => ({ name: `sky-${y}`, x: 4, y, role: "sky", fraction: y / 932, scrim });
  assert.deepEqual(
    probesFor("p2", { ticket: frames.ticket, "pill:True": frames["pill:True"] }, { width: 430, height: 932 }),
    [
      sky(120, false), sky(300, false), sky(560, false), sky(860, false),
      { name: "ticket band", x: 215, y: 104, role: "accent" },
      { name: "ticket paper", x: 22, y: 150, role: "surface-raised" },
      { name: "pill:True", x: 237, y: 868, role: "true" },
    ],
  );
  const p4 = probesFor("p4", frames, { width: 430, height: 932 });
  assert.deepEqual(p4.map((p) => p.name), ["sky-120", "sky-300", "sky-560", "sky-860", "sheet", "pill:Keep playing"]);
  assert.ok(p4.filter((p) => p.role === "sky").every((p) => p.scrim === true));
  assert.deepEqual(probesFor("s1", {}, { width: 375, height: 667 }).map((p) => p.name), ["sky-120", "sky-300", "sky-560"]);
});

test("the sky is the gradient of the four sky colours at the native stops, the scrim over it under the sheet", () => {
  assert.equal(skyHex(TOKENS, "day", 0), tokenHex(TOKENS, "day", "sky-1"));
  assert.equal(skyHex(TOKENS, "day", 0.35), tokenHex(TOKENS, "day", "sky-2"));
  assert.equal(skyHex(TOKENS, "night", 1), tokenHex(TOKENS, "night", "sky-4"));
  const [a, b] = [hexToRgb(tokenHex(TOKENS, "day", "sky-2")), hexToRgb(tokenHex(TOKENS, "day", "sky-3"))];
  const mid = hexToRgb(skyHex(TOKENS, "day", (0.35 + 0.62) / 2));
  mid.forEach((c, i) => assert.ok(Math.abs(c - (a[i] + b[i]) / 2) <= 1));
  const under = hexToRgb(skyHex(TOKENS, "day", 0, true));
  const plain = hexToRgb(skyHex(TOKENS, "day", 0));
  assert.ok(under.every((c, i) => c < plain[i]), "the day scrim darkens the sky");
});

test("colours are read at the probe times the scale and compared with the theme's token", () => {
  const image = canvas(20, 20, "#a9d6f0", [[10, 10, 20, 20, "#1d5cd0"]]);
  const results = checkColors(image, 2, [
    { name: "sky", x: 1, y: 1, role: "sky-1" },
    { name: "pill:True", x: 7, y: 7, role: "true" },
  ], TOKENS, "day");
  assert.deepEqual(results.map((r) => [r.name, r.actual, r.distance, r.ok]), [
    ["sky", "#a9d6f0", 0, true],
    ["pill:True", "#1d5cd0", 16, false],
  ]);
});

test("N12: dark glyphs on the day sky pass, light glyphs on the day sky fail", () => {
  const darkGlyphs = canvas(100, 60, "#a9d6f0", [[10, 10, 40, 20, "#000000"]]);
  const lightGlyphs = canvas(100, 60, "#a9d6f0", [[10, 10, 40, 20, "#ffffff"]]);
  const options = { scale: 2, statusBarPoints: 20, theme: "day", tokens: TOKENS };
  assert.equal(statusBarCheck(darkGlyphs, options).ok, true);
  assert.equal(statusBarCheck(lightGlyphs, options).ok, false);
  const nightSky = canvas(100, 60, "#0b1528", [[10, 10, 40, 20, "#ffffff"]]);
  assert.equal(statusBarCheck(nightSky, { ...options, theme: "night" }).ok, true);
  assert.equal(statusBarCheck(nightSky, options).ok, false, "a night sky is not the day theme");
});

test("N10: home screen, launch colour, a blend, then the app colour pass; a white frame fails", () => {
  const home = [40, 40, 40];
  const launch = [196, 227, 245];
  const app = [11, 21, 40];
  const blend = [104, 124, 143];
  const good = [home, home, launch, launch, blend, app, app, home];
  assert.deepEqual(classifyFrames(good, launch, app), { ok: true, firstApp: 5, problems: [] });
  const flash = [home, launch, [255, 255, 255], app, app];
  assert.deepEqual(classifyFrames(flash, launch, app).problems, [{ frame: 2, color: "#ffffff" }]);
  const backToLaunch = [launch, app, launch, app];
  assert.equal(classifyFrames(backToLaunch, launch, app).ok, false);
  assert.equal(classifyFrames([home, home], launch, app).ok, false);
});

test("the review captures twenty states on each side, the Classic round's ten first", () => {
  assert.equal(STATES.length, 20);
  assert.deepEqual(STATES.slice(0, 10), ["s1", "s2", "s3", "s4", "s5", "s6", "p2", "p3", "p4", "r1"]);
  assert.equal(new Set(STATES).size, STATES.length);
});

test("a pair puts the web left and iOS right, 16 pixels apart, frames outlined", () => {
  const web = canvas(10, 10, "#ffffff");
  const ios = canvas(10, 10, "#000000");
  const pair = sideBySide(web, ios, [{ name: "ticket", web: [2, 2, 4, 4], ios: [2, 2, 4, 4], ok: false }], 1);
  assert.equal(pair.width, 36);
  assert.equal(pair.height, 10);
  const at = (x, y) => [...pair.data.subarray((y * pair.width + x) * 4, (y * pair.width + x) * 4 + 3)];
  assert.deepEqual(at(0, 0), [255, 255, 255]);
  assert.deepEqual(at(26, 0), [0, 0, 0]);
  assert.deepEqual(at(2, 2), [220, 30, 30]);
  assert.deepEqual(at(28, 2), [220, 30, 30]);
});
