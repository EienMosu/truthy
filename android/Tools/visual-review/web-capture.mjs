#!/usr/bin/env node
// Captures the web app in the twenty states of the Android walk (ScreenWalk.kt), day and night, at the viewport and density
// of the Android captures, with the round's seed fixed. Needs the production build running: pnpm build && pnpm start --port 3100.
//   node android/Tools/visual-review/web-capture.mjs [base URL, default http://localhost:3100]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { PILLS, SCREENS, SEED, THEMES } from "./screens.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
const base = process.argv[2] ?? "http://localhost:3100";
const reference = JSON.parse(readFileSync(join(out, "android", "font100-day-s1.json"), "utf8"));
const viewport = { width: Math.round(reference.widthDp), height: Math.round(reference.heightDp) };
const density = reference.density;
mkdirSync(join(out, "web"), { recursive: true });

// The same options as Routes.kt and e2e/helpers.ts (CLF_SECURITY).
const OPTION = {
  area: /^Cloud, \d+ decks?$/,
  platform: /^AWS, \d+ decks?$/,
  deck: /^CLF, Cloud Practitioner, \d+ cards, /,
  section: /^SEC, Security and compliance, \d+ cards$/,
  mode: /^Classic\. Correct answers out of 10 cards\. /,
};
// The other classes on the same route, and the whole CDL deck (no sections) of the returning player.
const CLASS = { streak: /^Streak\. /, lives: /^Three lives\. /, timed: /^Timed\. / };
const CDL = { platform: /^Google Cloud, \d+ decks?$/, deck: /^CDL, Cloud Digital Leader, \d+ cards, / };
// The web elements whose frames match the Android test tags.
const SELECTOR = { pass: "[data-fill-in-pass]", ticket: "[data-boarding-pass]", stub: "[data-stub]", sheet: "[role=dialog]" };

const literal = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function atStep(page, title) {
  await page.locator("[data-step]:not([inert]) h2", { hasText: new RegExp(`^${literal(title)}$`) }).waitFor();
  await page.waitForTimeout(1000);
}

const pill = (page, name) => page.getByRole("button", { name, exact: true });

async function frameOf(page, element) {
  if (element === "logo") {
    // The heading is a full-width flex row; the logo's frame is its mark and wordmark.
    const heading = page.getByRole("heading", { level: 1, name: "Truthy" });
    if ((await heading.count()) === 0) return null;
    return heading.evaluate((h) => {
      const rects = [...h.children].map((child) => child.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left));
      const top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      return [left, top, right - left, bottom - top];
    });
  }
  const locator = element in PILLS ? pill(page, PILLS[element]) : page.locator(SELECTOR[element]);
  if ((await locator.count()) === 0) return null;
  const box = await locator.first().boundingBox();
  return box === null ? null : [box.x, box.y, box.width, box.height];
}

async function shoot(page, theme, screen) {
  await page.waitForTimeout(800);
  const spec = SCREENS.find((s) => s.id === screen);
  const frames = {};
  for (const element of spec.elements) {
    const frame = await frameOf(page, element);
    if (frame !== null) frames[element] = frame;
  }
  const name = `${theme}-${screen}`;
  await page.screenshot({ path: join(out, "web", `${name}.png`) });
  const capture = { platform: "web", screen, theme, label: "font100", density, widthDp: viewport.width, heightDp: viewport.height, frames };
  writeFileSync(join(out, "web", `${name}.json`), `${JSON.stringify(capture, null, 2)}\n`);
  console.log(`web ${name}`);
}

const option = (page, name) => page.getByRole("button", { name });

/** The question phase: True is back on screen; a little over the 250 ms settle time. */
async function question(page) {
  await pill(page, "True").waitFor({ state: "visible" });
  await page.waitForTimeout(600);
}

async function result(page) {
  await page.getByRole("heading", { name: "Round complete" }).waitFor({ state: "attached" });
  await page.waitForTimeout(400);
}

/** Close results once the result's 1000 ms have passed, back to step 1. */
async function closeResults(page) {
  await page.waitForTimeout(1100);
  await pill(page, "Close results").click();
  await atStep(page, "Choose an area");
}

/** CLF / SEC in a class, from step 1 to the round's first card. */
async function playClf(page, mode) {
  await option(page, OPTION.area).click();
  await atStep(page, "Choose a platform");
  await option(page, OPTION.platform).click();
  await atStep(page, "Choose a deck");
  await option(page, OPTION.deck).click();
  await atStep(page, "Choose a section");
  await option(page, OPTION.section).click();
  await atStep(page, "Choose how to play");
  await option(page, mode).click();
  await atStep(page, "Your pass is ready");
  await pill(page, "Start round").click();
  await question(page);
}

async function walk(page, theme) {
  const shot = (screen) => shoot(page, theme, screen);
  await page.goto(`${base}/`);
  await atStep(page, "Choose an area");
  await shot("s1");
  await option(page, OPTION.area).click();
  await atStep(page, "Choose a platform");
  await shot("s2");
  await option(page, OPTION.platform).click();
  await atStep(page, "Choose a deck");
  await shot("s3");
  await option(page, OPTION.deck).click();
  await atStep(page, "Choose a section");
  await shot("s4");
  await option(page, OPTION.section).click();
  await atStep(page, "Choose how to play");
  await shot("s5");
  await option(page, OPTION.mode).click();
  await atStep(page, "Your pass is ready");
  await shot("s6");

  await pill(page, "Start round").click();
  await page.getByRole("img", { name: /^Card 1 of 10\./ }).waitFor();
  await page.waitForTimeout(600);
  await shot("p2");
  await pill(page, "True").click();
  await pill(page, "Next card").waitFor();
  await page.waitForTimeout(500);
  await shot("p3");
  await pill(page, "Leave round").click();
  await page.getByRole("dialog").waitFor();
  await shot("p4");
  await pill(page, "Keep playing").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });

  for (let number = 2; number <= 10; number += 1) {
    await page.waitForTimeout(500);
    await pill(page, "Next card").click();
    await page.getByRole("img", { name: new RegExp(`^Card ${number} of 10\\.`) }).waitFor();
    await page.waitForTimeout(400);
    await pill(page, "True").click();
    await pill(page, number === 10 ? "See results" : "Next card").waitFor();
  }
  await page.waitForTimeout(500);
  await pill(page, "See results").click();
  await result(page);
  await shot("r1");
  await closeResults(page);

  // The states one Classic round does not reach, played as ScreenWalk.kt (and plan B) play them.
  for (const name of ["streak", "lives"]) {
    await playClf(page, CLASS[name]);
    await shot(`${name}-p2`);
    for (;;) {
      await pill(page, "True").click();
      await page.getByRole("button", { name: /^(Next card|See results)$/ }).waitFor();
      if ((await pill(page, "See results").count()) > 0) break;
      await page.waitForTimeout(500);
      await pill(page, "Next card").click();
      await pill(page, "Next card").waitFor({ state: "detached" });
      await question(page);
    }
    await page.waitForTimeout(500);
    await pill(page, "See results").click();
    await result(page);
    await shot(`${name}-r1`);
    if (name === "lives") {
      // Three wrong answers end the round, so a missed card is always there.
      await page.getByRole("button", { name: /^Why, card / }).first().click();
      await shot("lives-r1-why");
    }
    await closeResults(page);
  }

  await playClf(page, CLASS.timed);
  await shot("timed-p2");
  await pill(page, "True").click();
  // The rest of the minute runs out in real time.
  await pill(page, "See results").waitFor({ timeout: 75_000 });
  await page.waitForTimeout(500);
  await shot("timed-up");
  await pill(page, "See results").click();
  await result(page);
  await shot("timed-r1");
  await closeResults(page);

  // A second deck played and left with one answer: step 1 then shows Recent (two decks) and Continue.
  await option(page, OPTION.area).click();
  await atStep(page, "Choose a platform");
  await option(page, CDL.platform).click();
  await atStep(page, "Choose a deck");
  await option(page, CDL.deck).click();
  await atStep(page, "Choose how to play");
  await option(page, OPTION.mode).click();
  await atStep(page, "Your pass is ready");
  await pill(page, "Start round").click();
  await question(page);
  await pill(page, "True").click();
  await page.getByRole("button", { name: /^(Next card|See results)$/ }).waitFor();
  await pill(page, "Leave round").click();
  await page.getByRole("dialog").getByRole("button", { name: "Leave round", exact: true }).click();
  await atStep(page, "Choose an area");
  await shot("s1-returning");
  await option(page, /^Recent, 2 decks$/).click();
  await atStep(page, "Choose a deck");
  await shot("s3-recent");
}

const browser = await chromium.launch();
try {
  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: density,
      isMobile: true,
      hasTouch: true,
      colorScheme: theme === "day" ? "light" : "dark",
      reducedMotion: "no-preference",
      serviceWorkers: "block",
    });
    // The round's seed: useRound.ts draws it with crypto.getRandomValues(new Uint32Array(1)).
    await context.addInitScript((seed) => {
      const original = crypto.getRandomValues.bind(crypto);
      Object.defineProperty(crypto, "getRandomValues", {
        configurable: true,
        value: (array) => {
          if (array instanceof Uint32Array && array.length === 1) {
            array[0] = seed;
            return array;
          }
          return original(array);
        },
      });
    }, SEED);
    const page = await context.newPage();
    await walk(page, theme);
    await context.close();
  }
} finally {
  await browser.close();
}
