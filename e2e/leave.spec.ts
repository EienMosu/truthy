import { expect, test } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  CONTINUE_CLF_SECURITY,
  chooseRoute,
  deckAnswers,
  openHome,
  startRound,
  stepTitle,
  verdict,
  verdictFor,
  waitForCard,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec section 6, "Leaving a round": one confirmation; a round that is left sets no record; the answers
// already given stay in the card history (and the route becomes the one to continue).
test("leaving after an answer asks once, Keep playing stays, Leave round goes home without a record", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);

  const first = await waitForCard(page, answers, 1);
  await page.getByRole("button", { name: "True", exact: true }).click();
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));

  // The close control asks first.
  await page.getByRole("button", { name: "Leave round" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave round?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep playing" })).toBeFocused();

  // Keep playing: the dialog closes and the round is where it was.
  await dialog.getByRole("button", { name: "Keep playing" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/play$/);
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
  await page.getByRole("button", { name: "Next card" }).click();
  await waitForCard(page, answers, 2);

  // Leave round: back to the start.
  await page.getByRole("button", { name: "Leave round" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Leave round" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toHaveText("Choose an area");

  // Continue is offered, and the Classic card still has no record.
  await page.getByRole("button", { name: CONTINUE_CLF_SECURITY }).click();
  await expect(stepTitle(page)).toHaveText("Your pass is ready");
  await page.getByRole("button", { name: "Back to classes" }).click();
  await expect(page.getByRole("button", { name: "Classic. 10 cards, score at the end. Not played yet." })).toBeVisible();
});

test("leaving before any answer goes home at once and leaves nothing to continue", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await waitForCard(page, await deckAnswers(page, CLF_ID), 1);

  await page.getByRole("button", { name: "Leave round" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toHaveText("Choose an area");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Continue/ })).toHaveCount(0);
});
