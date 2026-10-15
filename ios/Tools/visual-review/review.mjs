// The visual review of spec 7.4. Captures every review screen on the iOS simulator (small and large phone, day and
// night, default and largest text) and on the web in WebKit at the same size, compares element frames with the
// web's and colours with the resolved tokens, checks the status bar against the system theme (N12), and writes
// side-by-side pairs and a report under ios/Tools/visual-review/out/<runtime>/ (ignored by git).
//
// Usage, from the repository root, with the web app running (pnpm build && pnpm start --port 3100):
//   node ios/Tools/visual-review/review.mjs [--web http://localhost:3100] [--seed 1234567] [--runtime iOS-26-5]
//                                          [--skip-build] [--skip-capture]
// Exits 1 when a frame or colour is outside its tolerance and not in approved.json.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { STATES, checkColors, compareFrames, probesFor, sideBySide, statusBarCheck } from "./compare.mjs";
import { decodePng, encodePng } from "./png.mjs";
import { DEVICES, HERE, OUT, ROOT, buildForTesting, ensureSimulator, runUITest, setAppearance, uninstallApp } from "./sim.mjs";
import { captureWeb } from "./web.mjs";

const { values } = parseArgs({
  options: {
    web: { type: "string", default: "http://localhost:3100" },
    seed: { type: "string", default: "1234567" },
    runtime: { type: "string", default: "iOS-26-5" },
    "skip-build": { type: "boolean", default: false },
    "skip-capture": { type: "boolean", default: false },
  },
});
const seed = Number(values.seed);
const tokens = JSON.parse(readFileSync(join(ROOT, "native-data/tokens/resolved.json"), "utf8"));
const approved = JSON.parse(readFileSync(join(HERE, "approved.json"), "utf8"));
const THEMES = /** @type {const} */ (["day", "night"]);
const RUN = join(OUT, values.runtime);
const appearanceOf = (/** @type {"day" | "night"} */ theme) => (theme === "day" ? "light" : "dark");

/** Reads a screenshot as sRGB pixels: a file with an ICC profile is converted with sips first. */
function readScreenshot(/** @type {string} */ path) {
  let image = decodePng(readFileSync(path));
  if (image.profile === "icc") {
    const converted = path.replace(/\.png$/, ".srgb.png");
    const result = spawnSync("sips", ["--matchTo", "/System/Library/ColorSync/Profiles/sRGB Profile.icc", path, "--out", converted]);
    if (result.status !== 0) throw new Error(`sips could not convert ${path}`);
    image = decodePng(readFileSync(converted));
  }
  return image;
}

function readJson(/** @type {string} */ path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

if (!values["skip-capture"]) {
  rmSync(join(RUN, "ios"), { recursive: true, force: true });
  rmSync(join(RUN, "web"), { recursive: true, force: true });
  if (!values["skip-build"]) buildForTesting();
  for (const [key, device] of Object.entries(DEVICES)) {
    const udid = ensureSimulator(/** @type {keyof typeof DEVICES} */ (key), values.runtime);
    for (const theme of THEMES) {
      for (const text of ["default", "largest"]) {
        uninstallApp(udid);
        setAppearance(udid, appearanceOf(theme));
        const settings = {
          TRUTHY_REVIEW_OUT: join(RUN, "ios", key, `${theme}-${text}`),
          TRUTHY_REVIEW_SEED: String(seed),
          TRUTHY_REVIEW_TEXT: text,
        };
        runUITest(udid, "TruthyUITests/VisualCaptureTests/testCaptureEveryScreen", settings);
        // The same install goes on with the other classes and a returning player's start, as web.mjs does.
        runUITest(udid, "TruthyUITests/VisualCaptureTests/testCaptureTheOtherClassesAndStartStates", settings);
      }
      // N12: the stored theme is this one, the system the other.
      uninstallApp(udid);
      setAppearance(udid, theme === "day" ? "dark" : "light");
      runUITest(udid, "TruthyUITests/VisualCaptureTests/testCaptureTheStoredThemeAgainstTheSystem", {
        TRUTHY_REVIEW_OUT: join(RUN, "ios", key, "flip"),
        TRUTHY_REVIEW_SEED: String(seed),
        TRUTHY_REVIEW_FLIP: appearanceOf(theme),
      });
      await captureWeb({ baseUrl: values.web, device, theme, seed, outDir: join(RUN, "web", key, theme) });
    }
  }
}

mkdirSync(join(RUN, "pairs"), { recursive: true });
const report = { frames: [], colors: [], flips: [], largest: [] };
let failures = 0;
for (const [key, device] of Object.entries(DEVICES)) {
  for (const theme of THEMES) {
    for (const state of STATES) {
      const iosDir = join(RUN, "ios", key, `${theme}-default`);
      const webDir = join(RUN, "web", key, theme);
      const pairKey = `${key}-${theme}-${state}`;
      if (!existsSync(join(iosDir, `${state}.png`)) || !existsSync(join(webDir, `${state}.png`))) {
        report.frames.push({ pair: pairKey, name: "(screen)", ok: false, missing: "capture" });
        failures += 1;
        continue;
      }
      const iosImage = readScreenshot(join(iosDir, `${state}.png`));
      const webImage = readScreenshot(join(webDir, `${state}.png`));
      const iosFrames = readJson(join(iosDir, `${state}.frames.json`));
      const webFrames = readJson(join(webDir, `${state}.frames.json`));
      const frames = compareFrames(webFrames, iosFrames, pairKey, approved);
      const screen = { width: device.width, height: device.height };
      const colors = [
        ...checkColors(iosImage, device.scale, probesFor(state, iosFrames, screen), tokens, theme).map((c) => ({ side: "ios", ...c })),
        ...checkColors(webImage, device.scale, probesFor(state, webFrames, screen), tokens, theme).map((c) => ({ side: "web", ...c })),
      ].map((c) => ({ ...c, ok: c.ok || approved[`${pairKey}:color:${c.side}:${c.name}`] !== undefined }));
      for (const f of frames) report.frames.push({ pair: pairKey, ...f });
      for (const c of colors) report.colors.push({ pair: pairKey, ...c });
      failures += frames.filter((f) => !f.ok).length + colors.filter((c) => !c.ok).length;
      writeFileSync(join(RUN, "pairs", `${pairKey}.png`), encodePng(sideBySide(webImage, iosImage, frames, device.scale)));
      report.largest.push(join("ios", key, `${theme}-largest`, `${state}.png`));
    }
    const flipPath = join(RUN, "ios", key, "flip", `flip-${appearanceOf(theme)}.png`);
    const flip = existsSync(flipPath)
      ? statusBarCheck(readScreenshot(flipPath), { scale: device.scale, statusBarPoints: device.statusBarPoints, theme, tokens })
      : { ok: false, missing: "capture" };
    report.flips.push({ device: key, theme, ...flip });
    if (!flip.ok) failures += 1;
  }
}

writeFileSync(join(RUN, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(RUN, "report.md"), markdown(report));
console.log(`${report.frames.length} frames, ${report.colors.length} colours, ${report.flips.length} theme checks: ${failures} outside tolerance`);
console.log(`Pairs in ios/Tools/visual-review/out/${values.runtime}/pairs, report in ios/Tools/visual-review/out/${values.runtime}/report.md`);
process.exitCode = failures === 0 ? 0 : 1;

function markdown(/** @type {typeof report} */ r) {
  const lines = ["# Visual review", "", "## Frames (points, tolerance 2)", "", "| Pair | Element | Web | iOS | Diff | OK |", "|---|---|---|---|---|---|"];
  for (const f of r.frames) {
    lines.push(`| ${f.pair} | ${f.name} | ${JSON.stringify(f.web ?? null)} | ${JSON.stringify(f.ios ?? null)} | ${f.diff ?? f.missing ?? ""} | ${f.ok ? "yes" : "NO"} |`);
  }
  lines.push("", "## Colours (tolerance 3 per channel)", "", "| Pair | Side | Probe | Token | Expected | Actual | OK |", "|---|---|---|---|---|---|---|");
  for (const c of r.colors) lines.push(`| ${c.pair} | ${c.side} | ${c.name} | ${c.role} | ${c.expected} | ${c.actual} | ${c.ok ? "yes" : "NO"} |`);
  lines.push("", "## N12: stored theme against the opposite system appearance", "", "| Device | App theme | Sky | Glyph pixels | OK |", "|---|---|---|---|---|");
  for (const f of r.flips) lines.push(`| ${f.device} | ${f.theme} | ${f.sky ?? ""} | ${f.glyphPixels ?? ""} | ${f.ok ? "yes" : "NO"} |`);
  lines.push("", "## N9: largest text size (review by eye)", "");
  for (const path of r.largest) lines.push(`- ${path}`);
  return `${lines.join("\n")}\n`;
}
