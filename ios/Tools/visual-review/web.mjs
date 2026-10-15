// The web half of the visual review: the same twenty screens as VisualCaptureTests, in WebKit at the simulator's
// size and scale, with the round's seed fixed through crypto.getRandomValues (the web's only seed source,
// components/play/useRound.ts). Writes <state>.png and <state>.frames.json, frames in CSS pixels.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { webkit } from "@playwright/test";
import { PILLS } from "./compare.mjs";

const SETTLE_MS = 300;
const ARRIVAL_MS = 450;
const RESULT_MS = 1050;
const MOTION_MS = 1500;

/**
 * @param {{ baseUrl: string, device: { width: number, height: number, scale: number }, theme: "day" | "night",
 *   seed: number, outDir: string }} options
 */
export async function captureWeb({ baseUrl, device, theme, seed, outDir }) {
  mkdirSync(outDir, { recursive: true });
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.scale,
      isMobile: true,
      hasTouch: true,
      colorScheme: theme === "day" ? "light" : "dark",
      reducedMotion: "no-preference",
      serviceWorkers: "block",
    });
    await context.addInitScript((fixed) => {
      const original = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = (array) => {
        if (array instanceof Uint32Array && array.length === 1) {
          array[0] = fixed;
          return array;
        }
        return original(array);
      };
    }, seed);
    const page = await context.newPage();
    const capture = async (/** @type {string} */ state) => {
      await page.waitForTimeout(MOTION_MS);
      await page.screenshot({ path: join(outDir, `${state}.png`) });
      writeFileSync(join(outDir, `${state}.frames.json`), `${JSON.stringify(await webFrames(page), null, 2)}\n`);
    };
    const atStep = async (/** @type {string} */ title) => {
      await page.locator("[data-step]:not([inert]) h2", { hasText: title }).waitFor();
      await page.waitForTimeout(SETTLE_MS);
    };
    const choose = async (/** @type {string} */ prefix) => {
      await page.getByRole("button", { name: new RegExp("^" + escapeRegExp(prefix)) }).first().click();
    };
    const button = (/** @type {string} */ name) => page.getByRole("button", { name, exact: true }).first();
    const tapWhenReady = async (/** @type {string} */ name) => {
      await button(name).waitFor();
      await page.waitForTimeout(ARRIVAL_MS);
      await button(name).click();
    };
    const waitForQuestion = async () => {
      await button("True").waitFor();
      await page.getByRole("button", { name: /^(Next card|See results)$/ }).waitFor({ state: "detached" });
      await page.waitForTimeout(SETTLE_MS);
    };

    await page.goto("/");
    await atStep("Choose an area");
    await capture("s1");
    await choose("Cloud, ");
    await atStep("Choose a platform");
    await capture("s2");
    await choose("AWS, ");
    await atStep("Choose a deck");
    await capture("s3");
    await choose("CLF, ");
    await atStep("Choose a section");
    await capture("s4");
    await choose("SEC, ");
    await atStep("Choose how to play");
    await capture("s5");
    await choose("Classic. ");
    await atStep("Your pass is ready");
    await capture("s6");

    await button("Start round").click();
    await page.waitForURL(/\/play$/);
    await waitForQuestion();
    await capture("p2");
    await button("True").click();
    await button("Next card").waitFor();
    await capture("p3");
    await button("Leave round").click();
    await page.getByRole("dialog").waitFor();
    await capture("p4");
    await page.getByRole("dialog").getByRole("button", { name: "Keep playing" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await tapWhenReady("Next card");
    for (let number = 2; number <= 10; number += 1) {
      await waitForQuestion();
      await button("True").click();
      await tapWhenReady(number === 10 ? "See results" : "Next card");
    }
    await page.getByRole("heading", { name: "Round complete" }).waitFor();
    await capture("r1");

    // The screens one Classic round does not reach, as testCaptureTheOtherClassesAndStartStates plays them.
    const atResult = () => page.getByRole("heading", { name: "Round complete" }).waitFor();
    const closeResults = async () => {
      await page.waitForTimeout(RESULT_MS);
      await button("Close results").click();
      await atStep("Choose an area");
    };
    const chooseClf = async (/** @type {string} */ mode) => {
      await choose("Cloud, ");
      await atStep("Choose a platform");
      await choose("AWS, ");
      await atStep("Choose a deck");
      await choose("CLF, ");
      await atStep("Choose a section");
      await choose("SEC, ");
      await atStep("Choose how to play");
      await choose(mode);
      await atStep("Your pass is ready");
      await button("Start round").click();
      await page.waitForURL(/\/play$/);
    };

    await closeResults();
    for (const [mode, name] of [["Streak. ", "streak"], ["Three lives. ", "lives"]]) {
      await chooseClf(mode);
      await waitForQuestion();
      await capture(`${name}-p2`);
      for (;;) {
        await waitForQuestion();
        await button("True").click();
        await page.getByRole("button", { name: /^(Next card|See results)$/ }).waitFor();
        if ((await page.getByRole("button", { name: "See results", exact: true }).count()) > 0) break;
        await tapWhenReady("Next card");
      }
      await tapWhenReady("See results");
      await atResult();
      await capture(`${name}-r1`);
      if (name === "lives") {
        await page.getByRole("button", { name: /^Why, card / }).first().click();
        await capture("lives-r1-why");
      }
      await closeResults();
    }

    await chooseClf("Timed. ");
    await waitForQuestion();
    await capture("timed-p2");
    await button("True").click();
    await button("See results").waitFor({ timeout: 75_000 });
    await capture("timed-up");
    await tapWhenReady("See results");
    await atResult();
    await capture("timed-r1");
    await closeResults();

    // A second deck played and left with one answer: step 1 then shows Recent (two decks) and Continue.
    await choose("Cloud, ");
    await atStep("Choose a platform");
    await choose("Google Cloud, ");
    await atStep("Choose a deck");
    await choose("CDL, ");
    await atStep("Choose how to play");
    await choose("Classic. ");
    await atStep("Your pass is ready");
    await button("Start round").click();
    await page.waitForURL(/\/play$/);
    await waitForQuestion();
    await button("True").click();
    await page.getByRole("button", { name: /^(Next card|See results)$/ }).waitFor();
    await button("Leave round").click();
    await page.getByRole("dialog").getByRole("button", { name: "Leave round" }).click();
    await atStep("Choose an area");
    await capture("s1-returning");
    await choose("Recent, ");
    await atStep("Choose a deck");
    await capture("s3-recent");
  } finally {
    await browser.close();
  }
}

/** @param {string} text */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The web's element rectangles under the names of ReviewName in the app (ios/Truthy/Truthy/Debug/ReviewFrames.swift).
 * @param {import("@playwright/test").Page} page
 */
async function webFrames(page) {
  /** @type {[string, import("@playwright/test").Locator][]} */
  const named = [
    ["logo", page.getByRole("heading", { level: 1, name: "Truthy" })],
    ["pass", page.locator("[data-fill-in-pass]")],
    ["ticket", page.locator("[data-boarding-pass]")],
    ["card", page.locator("[data-swipe-card]")],
    ["stub", page.locator("[data-stub]")],
    ["sheet", page.getByRole("dialog")],
    ...Object.keys(PILLS).map((title) => /** @type {[string, import("@playwright/test").Locator]} */ ([`pill:${title}`, page.getByRole("button", { name: title, exact: true })])),
  ];
  /** @type {Record<string, number[]>} */
  const frames = {};
  for (const [name, locator] of named) {
    const first = locator.first();
    if ((await locator.count()) === 0 || !(await first.isVisible())) continue;
    const box = await first.boundingBox();
    if (box === null) continue;
    frames[name] = [box.x, box.y, box.width, box.height].map((n) => Math.round(n * 100) / 100);
  }
  return Object.fromEntries(Object.entries(frames).sort(([a], [b]) => (a < b ? -1 : 1)));
}
