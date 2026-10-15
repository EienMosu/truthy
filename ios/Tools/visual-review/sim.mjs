// Simulator and xcodebuild helpers shared by review.mjs and record.mjs.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const HERE = import.meta.dirname;
export const ROOT = resolve(HERE, "../../..");
export const OUT = join(HERE, "out");
export const BUNDLE_ID = "com.eienmosu.Truthy";
export const PROJECT = join(ROOT, "ios/Truthy/Truthy.xcodeproj");
export const DERIVED = join(OUT, "build");

/** The two review phones of spec 7.4, created on the runtime given to review.mjs. */
export const DEVICES = {
  small: {
    name: "Truthy Review SE",
    type: "com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation",
    width: 375,
    height: 667,
    scale: 2,
    statusBarPoints: 20,
  },
  large: {
    name: "Truthy Review 15 Pro Max",
    type: "com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro-Max",
    width: 430,
    height: 932,
    scale: 3,
    statusBarPoints: 54,
  },
};

/** @param {string[]} args */
export function simctl(args, { allowFailure = false } = {}) {
  const result = spawnSync("xcrun", ["simctl", ...args], { encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`simctl ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

/**
 * The UDID of the review simulator for this device on this runtime ("iOS-26-5"), created and booted when needed,
 * with a fixed status bar so screenshots compare.
 * @param {keyof typeof DEVICES} key @param {string} runtime
 */
export function ensureSimulator(key, runtime) {
  const device = DEVICES[key];
  const runtimeId = `com.apple.CoreSimulator.SimRuntime.${runtime}`;
  const list = JSON.parse(simctl(["list", "devices", "--json"]));
  const existing = (list.devices[runtimeId] ?? []).find((/** @type {{ name: string }} */ d) => d.name === device.name);
  const udid = existing?.udid ?? simctl(["create", device.name, device.type, runtimeId]);
  simctl(["boot", udid], { allowFailure: true });
  simctl(["bootstatus", udid, "-b"]);
  simctl([
    "status_bar", udid, "override", "--time", "9:41", "--dataNetwork", "wifi", "--wifiMode", "active", "--wifiBars", "3",
    "--cellularMode", "active", "--cellularBars", "4", "--batteryState", "charged", "--batteryLevel", "100",
  ]);
  return udid;
}

/** @param {string} udid @param {"light" | "dark"} appearance */
export function setAppearance(udid, appearance) {
  simctl(["ui", udid, "appearance", appearance]);
}

/** A fresh app: no progress, no theme, no journal. */
export function uninstallApp(udid) {
  simctl(["terminate", udid, BUNDLE_ID], { allowFailure: true });
  simctl(["uninstall", udid, BUNDLE_ID], { allowFailure: true });
}

/** Builds the app and its tests once for the simulator. */
export function buildForTesting() {
  execFileSync("xcodebuild", [
    "build-for-testing", "-project", PROJECT, "-scheme", "Truthy",
    "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", DERIVED, "-quiet",
  ], { stdio: "inherit" });
}

/**
 * Runs one UI test of the built products on a simulator. `environment` reaches the test runner through
 * xcodebuild's TEST_RUNNER_ prefix.
 * @param {string} udid @param {string} test e.g. "TruthyUITests/VisualCaptureTests/testCaptureEveryScreen"
 * @param {Record<string, string>} environment
 */
export function runUITest(udid, test, environment) {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(environment)) env[`TEST_RUNNER_${key}`] = value;
  const result = spawnSync("xcodebuild", [
    "test-without-building", "-project", PROJECT, "-scheme", "Truthy",
    "-destination", `platform=iOS Simulator,id=${udid}`, "-derivedDataPath", DERIVED,
    "-only-testing:" + test, "-quiet",
  ], { stdio: "inherit", env });
  if (result.status !== 0) throw new Error(`${test} failed on ${udid}`);
}

/** The path of the built app, for simctl install. */
export function builtApp() {
  const app = join(DERIVED, "Build/Products/Debug-iphonesimulator/Truthy.app");
  if (!existsSync(app)) throw new Error("Build the app first (review.mjs builds it)");
  return app;
}
