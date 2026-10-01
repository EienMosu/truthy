import { expect, test, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  chooseRoute,
  computed,
  deckAnswers,
  expectMissed,
  expectPass,
  expectResult,
  expectThemePage,
  openHome,
  playRound,
  startRound,
  tokenRgb as rgb,
  verdict,
  verdictFor,
  waitForCard,
  wrongOn,
} from "./helpers";

// The night theme follows the system setting (prefers-color-scheme: dark). Design system principle 6:
// night is a remap of the same components, so this spec plays a whole round in the dark scheme and reads
// the colours the browser actually computes on the page, the sky and the pass.
test.use({ colorScheme: "dark", reducedMotion: "no-preference" });

/** The page is in the night theme: night text and background, and the backdrop blends the four night sky colours. */
async function expectNightPage(page: Page): Promise<void> {
  expect(await page.evaluate(() => window.matchMedia("(prefers-color-scheme: dark)").matches)).toBe(true);
  await expectThemePage(page, "night");
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
  await expectPass(page, "night");
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
  await expectPass(page, "night");
});
