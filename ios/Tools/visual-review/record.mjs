// Screen recordings for the feel checklist (spec 5.8), written to ios/Tools/visual-review/out/recordings/.
//
//   node ios/Tools/visual-review/record.mjs test --device large --test <TruthyUITests/Class/method> --name <file>
//       records the simulator while one UI test runs (N1, N3, N5, N13)
//   node ios/Tools/visual-review/record.mjs launch --device large --system light --app dark
//       N10 at launch: stores the app theme against the system appearance, then records a cold launch and checks
//       every frame: the launch screen in the system's surface colour, then the app in its stored theme's sky
//   node ios/Tools/visual-review/record.mjs between --device large --theme day
//       N10 between screens: records start flow, round and back, and checks that no frame leaves the sky colour
//
// test needs the app built (review.mjs builds it, or pass --build). Every command takes --runtime (iOS-26-5).
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { classifyFrames, hexToRgb, tokenHex } from "./compare.mjs";
import { BUNDLE_ID, DEVICES, HERE, OUT, ROOT, buildForTesting, ensureSimulator, runUITest, setAppearance, simctl, uninstallApp } from "./sim.mjs";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    device: { type: "string", default: "large" },
    runtime: { type: "string", default: "iOS-26-5" },
    test: { type: "string" },
    name: { type: "string" },
    system: { type: "string", default: "light" },
    app: { type: "string", default: "dark" },
    theme: { type: "string", default: "day" },
    build: { type: "boolean", default: false },
  },
});
const mode = positionals[0];
const key = /** @type {keyof typeof DEVICES} */ (values.device);
const device = DEVICES[key];
if (device === undefined) throw new Error(`--device is small or large, not ${values.device}`);
const recordings = join(OUT, "recordings");
mkdirSync(recordings, { recursive: true });
if (values.build) buildForTesting();
const udid = ensureSimulator(key, values.runtime);
const tokens = JSON.parse(readFileSync(join(ROOT, "native-data/tokens/resolved.json"), "utf8"));

/** Starts a recording and resolves once simctl reports its first frame; the returned function stops it. */
async function startRecording(/** @type {string} */ file) {
  const child = spawn("xcrun", ["simctl", "io", udid, "recordVideo", "--codec=h264", "--mask=ignored", "--force", file]);
  await new Promise((resolve, reject) => {
    child.stderr.on("data", (chunk) => {
      if (String(chunk).includes("Recording started")) resolve(undefined);
    });
    child.on("exit", (code) => reject(new Error(`recordVideo ended early (${code})`)));
  });
  return () =>
    new Promise((resolve) => {
      child.removeAllListeners("exit");
      child.on("exit", () => resolve(undefined));
      child.kill("SIGINT");
    });
}

/** The colour of the pixel at (2, 2) points in every frame of a recording. */
function frameColors(/** @type {string} */ file) {
  const px = String(2 * device.scale);
  const result = spawnSync("xcrun", ["swift", join(HERE, "frames.swift"), file, px, px], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`frames.swift failed: ${result.stderr}`);
  return result.stdout.trim().split("\n").map((line) => /** @type {[number, number, number]} */ (JSON.parse(line)));
}

const sleep = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms));
const asTheme = (/** @type {string} */ appearance) => (appearance === "light" ? "day" : "night");

function check(/** @type {string} */ file, /** @type {string} */ launchHex, /** @type {string} */ appHex) {
  const result = classifyFrames(frameColors(file), hexToRgb(launchHex), hexToRgb(appHex));
  writeFileSync(file.replace(/\.mov$/, ".json"), `${JSON.stringify({ launch: launchHex, app: appHex, ...result }, null, 2)}\n`);
  console.log(`${file}: ${result.ok ? "no white or mismatched frame" : `${result.problems.length} bad frames`} (app from frame ${result.firstApp})`);
  process.exitCode = result.ok ? 0 : 1;
}

if (mode === "test") {
  if (values.test === undefined || values.name === undefined) throw new Error("test needs --test and --name");
  const file = join(recordings, `${values.name}.mov`);
  const stop = await startRecording(file);
  try {
    runUITest(udid, values.test, {});
  } finally {
    await stop();
  }
  console.log(`Recorded ${file}`);
} else if (mode === "launch") {
  const system = values.system === "dark" ? "dark" : "light";
  const app = values.app === "dark" ? "dark" : "light";
  uninstallApp(udid);
  setAppearance(udid, app === "dark" ? "light" : "dark");
  runUITest(udid, "TruthyUITests/VisualCaptureTests/testCaptureTheStoredThemeAgainstTheSystem", {
    TRUTHY_REVIEW_OUT: join(OUT, "ios", key, "flip"),
    TRUTHY_REVIEW_FLIP: app,
  });
  simctl(["terminate", udid, BUNDLE_ID], { allowFailure: true });
  setAppearance(udid, system);
  await sleep(1000);
  const file = join(recordings, `N10-launch-${key}-system-${system}-app-${app}.mov`);
  const stop = await startRecording(file);
  await sleep(500);
  simctl(["launch", udid, BUNDLE_ID]);
  await sleep(4000);
  await stop();
  check(file, tokenHex(tokens, asTheme(system), "surface"), tokenHex(tokens, asTheme(app), "sky-1"));
} else if (mode === "between") {
  const theme = values.theme === "night" ? "night" : "day";
  uninstallApp(udid);
  setAppearance(udid, theme === "day" ? "light" : "dark");
  const file = join(recordings, `N10-between-${key}-${theme}.mov`);
  const stop = await startRecording(file);
  try {
    runUITest(udid, "TruthyUITests/VisualCaptureTests/testSwapScreensForTheRecording", {
      TRUTHY_REVIEW_OUT: join(OUT, "ios", key, "between"),
    });
  } finally {
    await stop();
  }
  check(file, tokenHex(tokens, theme, "surface"), tokenHex(tokens, theme, "sky-1"));
} else {
  throw new Error("record.mjs test | launch | between");
}
