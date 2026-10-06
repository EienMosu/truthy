// The Timed clock keeps running under the "Leave round?" sheet. When the minute runs out there, the sheet's text
// changes to say the round's score is kept, and a polite status inside the dialog says so: a screen reader read
// the text when the sheet opened, so without it the player would leave believing nothing is recorded.
import { expect, test } from "@playwright/test";
import { CLF_ID, answerCard, deckAnswers, openPendingRound, waitForQuestion } from "./helpers";

test.use({ reducedMotion: "reduce" });

const DECIDED = "This round is over and its score is kept. Leaving skips its result.";

test("time running out under the leave sheet is said by a status inside the dialog", async ({ page }) => {
  await page.clock.install();
  await openPendingRound(page, "timed");
  const answers = await deckAnswers(page, CLF_ID);
  const first = await answerCard(page, answers, 1, true);
  await waitForQuestion(page, answers, first.statement);

  await page.getByRole("button", { name: "Leave round" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave round?" });
  await expect(dialog).toBeVisible();
  const status = dialog.getByRole("status");
  await expect(status).toHaveText("");
  await expect(dialog).toContainText("This round won't count toward your best.");

  await page.clock.runFor(61_000);
  await expect(status).toHaveText(DECIDED);
  await expect(dialog.locator("p").first()).toHaveText(DECIDED);
});
