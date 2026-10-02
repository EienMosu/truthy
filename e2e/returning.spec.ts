import { expect, test } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  CONTINUE_CLF_SECURITY,
  atHome,
  atStep,
  chooseRoute,
  expectResult,
  openHome,
  playRound,
  startRound,
  stepTitle,
  wrongOn,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

test("a returning player continues to the ready pass, and each round is compared with the record", async ({ page }) => {
  test.slow(); // three rounds

  // Round 1: 7 of 10, the first round on this route.
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await playRound(page, CLF_ID, wrongOn(2, 5, 8));
  await expectResult(page, 7);
  await expect(page.getByText("First round on this route")).toBeVisible();

  // Home: the continue line names the route and the last score, and leads to the ready pass.
  await page.getByRole("button", { name: "Choose another route" }).click();
  await expect(page).toHaveURL(/\/$/);
  await atHome(page);
  await expect(page.getByRole("button", { name: `${CONTINUE_CLF_SECURITY} Last score 7 of 10.` })).toContainText("last 7 of 10");
  await page.getByRole("button", { name: CONTINUE_CLF_SECURITY }).click();
  await expect(stepTitle(page)).toHaveText("Your pass is ready");

  // One step back shows the record on the Classic card; choosing it again returns to the ready pass.
  await page.getByRole("button", { name: "Back to classes" }).click();
  await atStep(page, "Choose how to play");
  await page.getByRole("button", { name: "Classic. 10 cards, score at the end. Your best: 7 of 10." }).click();
  await atStep(page, "Your pass is ready");

  // Round 2: 10 of 10 beats the record.
  await startRound(page);
  await playRound(page, CLF_ID, wrongOn());
  await expectResult(page, 10);
  await expect(page.getByText("New best")).toBeVisible();
  await expect(page.getByText("Previous best 7 / 10")).toBeVisible();

  // Round 3, through "Play again": 7 of 10 is short of the new record.
  await page.getByRole("button", { name: "Play again" }).click();
  await playRound(page, CLF_ID, wrongOn(1, 4, 10));
  await expectResult(page, 7);
  await expect(page.getByText("3 short of your best")).toBeVisible();
  await expect(page.getByText("Best 10 / 10")).toBeVisible();
  await expect(page.getByText("New best")).toHaveCount(0);
});
