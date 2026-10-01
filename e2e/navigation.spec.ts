import { expect, test } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  CONTINUE_CLF_SECURITY,
  chooseRoute,
  deckAnswers,
  expectResult,
  openHome,
  playRound,
  startRound,
  stepTitle,
  waitForCard,
  wrongOn,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec section 4, "Routes": the pending round is kept for the tab, so a reload of /play keeps it.
test("reloading in the middle of a round deals a new round on the same route instead of going home", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);
  await waitForCard(page, answers, 1);
  await page.getByRole("button", { name: "False", exact: true }).click();
  await page.getByRole("button", { name: "Next card" }).click();
  await waitForCard(page, answers, 2);

  await page.reload();
  await expect(page).toHaveURL(/\/play$/);
  await waitForCard(page, answers, 1);
  await expect(page.getByText("Security and compliance").first()).toBeVisible();
});

// The phone's back gesture on the result screen: the round is already recorded, once.
test("the browser's back button on the result goes home with the round recorded", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await playRound(page, CLF_ID, wrongOn(1, 2, 3, 4));
  await expectResult(page, 6);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toHaveText("Choose an area");
  await page.getByRole("button", { name: CONTINUE_CLF_SECURITY }).click();
  await page.getByRole("button", { name: "Back to classes" }).click();
  await expect(page.getByRole("button", { name: "Classic. 10 cards, score at the end. Your best: 6 of 10." })).toBeVisible();
});
