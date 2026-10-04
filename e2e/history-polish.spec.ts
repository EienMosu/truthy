import { expect, test } from "@playwright/test";
import { CLF_ID, CLF_SECURITY, chooseRoute, deckAnswers, openHome, startRound, stepTitle, waitForCard } from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Review finding U26 (finding F3: back from /play is the start at step 1, and one more back leaves the site).
// After a reload of /play, leaving by the close button put a second start entry in the history, so one more
// back showed step 1 again. Every spec starts on about:blank, the page before the site.
test("after a reload of /play, Leave round is step 1 and one more back leaves the site", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);
  await waitForCard(page, answers, 1);

  await page.reload();
  await waitForCard(page, answers, 1);
  await page.getByRole("button", { name: "Leave round" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toHaveText("Choose an area");

  await page.goBack();
  await expect(page).toHaveURL("about:blank");
});
