import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  chooseRoute,
  deckAnswers,
  expectMissed,
  expectResult,
  openHome,
  playRound,
  startRound,
  verdict,
  verdictFor,
  waitForCard,
  wrongOn,
} from "./helpers";

// The night theme follows the system setting (prefers-color-scheme: dark). Design system principle 6:
// night is a remap of the same components, so this spec plays a whole round in the dark scheme and reads
// the colours the browser actually computes on the page, the sky and the pass.
test.use({ colorScheme: "dark", reducedMotion: "no-preference" });

interface ColorToken {
  $value: string | { hex: string };
}

const TOKENS = JSON.parse(readFileSync(new URL("../design/system/tokens.json", import.meta.url), "utf8")) as {
  color: Record<string, Record<string, ColorToken>>;
};

/** A colour role of a theme in design/system/tokens.json, references followed, as the browser writes it. */
function rgb(theme: "day" | "night", role: string): string {
  let token = TOKENS.color[theme]?.[role];
  for (let hops = 0; token !== undefined && typeof token.$value === "string" && hops < 8; hops += 1) {
    const [, group, name] = /^\{color\.([a-z]+)\.([a-z0-9-]+)\}$/.exec(token.$value) ?? [];
    token = group === undefined || name === undefined ? undefined : TOKENS.color[group]?.[name];
  }
  if (token === undefined || typeof token.$value === "string") throw new Error(`color.${theme}.${role} does not resolve`);
  const hex = token.$value.hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

const SKY = ["sky-1", "sky-2", "sky-3", "sky-4"] as const;

async function computed(locator: Locator, property: "color" | "backgroundColor" | "backgroundImage"): Promise<string> {
  return locator.evaluate((element, name) => getComputedStyle(element)[name], property);
}

/** The page is in the night theme: night text and background, and the backdrop blends the four night sky colours. */
async function expectNightPage(page: Page): Promise<void> {
  expect(await page.evaluate(() => window.matchMedia("(prefers-color-scheme: dark)").matches)).toBe(true);
  const body = page.locator("body");
  expect(await computed(body, "color")).toBe(rgb("night", "ink"));
  expect(await computed(body, "backgroundColor")).toBe(rgb("night", "surface"));

  const sky = await computed(page.locator("[data-sky-backdrop]"), "backgroundImage");
  expect(sky).toMatch(/^linear-gradient\(/);
  const stops = SKY.map((role) => sky.indexOf(rgb("night", role)));
  for (const [i, at] of stops.entries()) expect(at, `${SKY[i]} in ${sky}`).toBeGreaterThanOrEqual(0);
  expect([...stops].sort((a, b) => a - b)).toEqual(stops);
  for (const role of SKY) expect(sky, `day ${role}`).not.toContain(rgb("day", role));
}

/** The main paper of the pass on screen is drawn in the night surface-raised colour. */
async function expectNightPass(page: Page): Promise<void> {
  const paper = page.locator("[data-boarding-pass] > div").nth(1);
  expect(await computed(paper, "backgroundImage")).toContain(rgb("night", "surface-raised"));
  expect(await computed(page.locator("[data-boarding-pass]").first(), "color")).toBe(rgb("night", "ink"));
}

test("at night the start flow, a whole Classic round and the result are drawn with the night colours", async ({ page }) => {
  await openHome(page);
  await expectNightPage(page);

  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await expectNightPage(page);

  // The question card: the pass, its raised stub and the True pill in their night colours.
  const answers = await deckAnswers(page, CLF_ID);
  const first = await waitForCard(page, answers, 1);
  await expectNightPass(page);
  expect(await computed(page.locator('[data-stub] [data-tone="raised"]'), "backgroundImage")).toContain(rgb("night", "surface-raised"));
  const trueButton = page.getByRole("button", { name: "True", exact: true });
  expect(await computed(trueButton, "backgroundColor")).toBe(rgb("night", "true"));
  expect(await computed(trueButton, "color")).toBe(rgb("night", "on-dark"));

  // The answered card: the sunk slip in its night colour.
  await trueButton.click();
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
  expect(await computed(page.locator('[data-slip] [data-tone="sunk"]'), "backgroundImage")).toContain(rgb("night", "surface-sunk"));
  await page.getByRole("button", { name: "Next card" }).click();

  // Cards 2 to 10, then the result.
  const played = await playRound(page, CLF_ID, wrongOn(4, 8), "buttons", 10, 2);
  await expectResult(page, first.truth ? 8 : 7);
  await expectMissed(page, [{ number: 1, statement: first.statement, truth: first.truth, given: true }, ...played]);
  await expectNightPage(page);
  await expectNightPass(page);
});
