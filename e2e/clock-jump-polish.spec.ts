import { expect, test } from "@playwright/test";
import { CLF_ID, answerCard, deckAnswers, openPendingRound, verdict, verdictFor, waitForCard } from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Review finding U4: the wall clock set back in the middle of a round (by hand, or a large time correction)
// must not drop the player's presses. The page clock's setSystemTime moves Date only, as such a jump does.

test("a wall clock set back a minute still takes the answer and Next card", async ({ page }) => {
  await page.clock.install();
  await openPendingRound(page, "classic");
  const answers = await deckAnswers(page, CLF_ID);
  const { truth } = await waitForCard(page, answers, 1);
  await page.clock.setSystemTime((await page.evaluate(() => Date.now())) - 60_000);
  await page.getByRole("button", { name: "True", exact: true }).click();
  await expect(verdict(page)).toHaveText(verdictFor(true, truth));
  await page.clock.setSystemTime((await page.evaluate(() => Date.now())) - 60_000);
  await page.getByRole("button", { name: "Next card" }).click();
  await waitForCard(page, answers, 2);
});

test("a wall clock set back five minutes in Timed still counts the answers", async ({ page }) => {
  await page.clock.install();
  await openPendingRound(page, "timed");
  const answers = await deckAnswers(page, CLF_ID);
  await expect(page.getByRole("button", { name: "True", exact: true })).toBeVisible();
  await page.clock.setSystemTime((await page.evaluate(() => Date.now())) - 300_000);
  await answerCard(page, answers, 1, true);
  await expect(page.locator("[data-tally]")).toHaveText("1 correct · 0 wrong");
});
