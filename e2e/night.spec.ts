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
  answerCard,
  inClass,
  openHome,
  playRound,
  seeResults,
  setPageHidden,
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

test("at night a Streak round and its result are drawn with the night colours", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, inClass(CLF_SECURITY, "Streak"));
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);

  const first = await answerCard(page, answers, 1, true);
  await expectNightPage(page);
  await expectPass(page, "night");
  expect(await computed(page.locator("[data-plane] circle"), "fill")).toBe(rgb("night", "accent"));

  // The answered card: the sunk slip and the Correct stamp in their night colours.
  await expect(verdict(page)).toHaveText(verdictFor(first.given, first.truth));
  expect(await computed(page.locator('[data-slip] [data-tone="sunk"]'), "backgroundImage")).toContain(rgb("night", "surface-sunk"));
  expect(await computed(page.locator('[data-slip] [data-verdict="correct"]'), "color")).toBe(rgb("night", "correct"));
  await page.getByRole("button", { name: "Next card" }).click();

  const second = await answerCard(page, answers, 2, false, first.statement);
  await expect(verdict(page)).toHaveText(verdictFor(second.given, second.truth));
  await seeResults(page);
  await expectNightPage(page);
  await expectPass(page, "night");
  expect(await computed(page.locator("[data-score]"), "color")).toBe(rgb("night", "ink"));
});

test("at night the Three lives hearts and the Timed stamp use the night roles", async ({ page }) => {
  test.slow();
  await openHome(page);
  await chooseRoute(page, inClass(CLF_SECURITY, "Three lives"));
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);
  const wrong = await answerCard(page, answers, 1, false);
  await expect(verdict(page)).toHaveText(verdictFor(wrong.given, wrong.truth));
  expect(await computed(page.locator('[data-heart="full"] path').first(), "fill")).toBe(rgb("night", "ink"));
  expect(await computed(page.locator('[data-heart="lost"] path').first(), "stroke")).toBe(rgb("night", "ink-muted"));

  await openHome(page);
  await chooseRoute(page, inClass(CLF_SECURITY, "Timed"));
  await startRound(page);
  await answerCard(page, answers, 1, true);
  // A hidden page holds the stamp beat, so the stamp stays while its colours are read.
  await setPageHidden(page, true);
  const stamp = page.locator('[data-stub-stamp="correct"]');
  await expect(stamp).toBeVisible();
  expect(await computed(stamp, "backgroundColor")).toBe(rgb("night", "surface-raised"));
  await expectNightPage(page);
  await setPageHidden(page, false);
});
