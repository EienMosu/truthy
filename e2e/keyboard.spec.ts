import { expect, test, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  chooseRoute,
  deckAnswers,
  expectMissed,
  expectResult,
  openHome,
  openPendingRound,
  playRound,
  startRound,
  verdict,
  verdictFor,
  waitForCard,
  waitForQuestion,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec section 8: left arrow False, right arrow True, Enter for the following action.
test("the arrow keys and Enter play a whole round", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);

  // Right on odd cards, wrong on even ones, so both arrows are used for right and for wrong answers.
  const played = await playRound(page, CLF_ID, (number, truth) => (number % 2 === 1 ? truth : !truth), "keys");

  await expectResult(page, 5);
  await expectMissed(page, played);
  expect(played.some((card) => card.given)).toBe(true);
  expect(played.some((card) => !card.given)).toBe(true);
});

/** Holds a key the way the system's key repeat does: one keydown, then a repeated keydown every 33 ms. */
async function holdKey(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  for (let held = 0; held < ms; held += 33) {
    await page.waitForTimeout(33);
    await page.keyboard.down(key);
  }
  await page.keyboard.up(key);
}

// Review finding U3: the repeats of a held key are not new presses. A held arrow key answered every Timed
// card as soon as it settled, and a held Enter on True pressed Next card and skipped the verdict.
test("a held arrow key answers one Timed card, not every card that follows", async ({ page }) => {
  await openPendingRound(page, "timed");
  await waitForQuestion(page, await deckAnswers(page, CLF_ID));
  await expect(page.locator("[data-statement]")).toBeFocused();

  await holdKey(page, "ArrowRight", 3000);

  await expect(page.locator("[data-tally]")).toHaveText(/^(1 correct · 0 wrong|0 correct · 1 wrong)$/);
});

test("a held Enter on True answers once and leaves the verdict on screen", async ({ page }) => {
  await openPendingRound(page, "classic");
  const answers = await deckAnswers(page, CLF_ID);
  const first = await waitForCard(page, answers, 1);
  await page.getByRole("button", { name: "True", exact: true }).focus();

  await holdKey(page, "Enter", 1500);

  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();
  const next = page.getByRole("button", { name: "Next card" });
  await expect(next).toBeFocused();
  // A new press still goes on.
  await page.keyboard.press("Enter");
  await waitForCard(page, answers, 2);
});
