import { expect, test, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  CONTINUE_CLF_SECURITY,
  atStep,
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

// Review finding F3. The start flow keeps one history entry per step so the back button retraces the
// steps. Once a round has started those entries are spent: back from /play is the start at step 1, and
// one more back leaves the site. Every spec starts on about:blank, the page before the site.

async function expectLeftTheSite(page: Page): Promise<void> {
  await page.goBack();
  await expect(page).toHaveURL("about:blank");
}

async function expectHomeAtStepOne(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toHaveText("Choose an area");
}

/** The Classic card of CLF / SEC: still without a record after a round that was left. */
async function expectNoRecordButHistory(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: CONTINUE_CLF_SECURITY }).click();
  await atStep(page, "Your pass is ready");
  await page.getByRole("button", { name: "Back to classes" }).click();
  await expect(page.getByRole("button", { name: "Classic. 10 cards, score at the end. Not played yet." })).toBeVisible();
}

test("back from a round is the start at step 1, and one more back leaves the site; the answers stay, no record", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  // Within the start flow back still goes one step back, and forward returns.
  await page.goBack();
  await expect(stepTitle(page)).toHaveText("Choose how to play");
  await page.goForward();
  await atStep(page, "Your pass is ready");
  await startRound(page);

  const answers = await deckAnswers(page, CLF_ID);
  const first = await waitForCard(page, answers, 1);
  await page.getByRole("button", { name: "True", exact: true }).click();
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
  await page.getByRole("button", { name: "Next card" }).click();
  await waitForCard(page, answers, 2);

  // The phone's back gesture mid-round.
  await page.goBack();
  await expectHomeAtStepOne(page);
  await page.waitForTimeout(400);
  await expect(stepTitle(page)).toHaveText("Choose an area");
  await expectLeftTheSite(page);

  // The answer given is in the card history (the route is offered to continue), and no record was set.
  await expectNoRecordButHistory(page);
});

test("leaving with the close button lands on step 1 with nothing stale behind it", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);
  const first = await waitForCard(page, answers, 1);
  await page.getByRole("button", { name: "True", exact: true }).click();
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));

  await page.getByRole("button", { name: "Leave round" }).click();
  await page.getByRole("dialog", { name: "Leave round?" }).getByRole("button", { name: "Leave round" }).click();
  await expectHomeAtStepOne(page);

  // The continue line fills in the whole pass at once; its steps are spent the same way.
  await page.getByRole("button", { name: CONTINUE_CLF_SECURITY }).click();
  await atStep(page, "Your pass is ready");
  await startRound(page);
  await waitForCard(page, answers, 1);
  await page.getByRole("button", { name: "Leave round" }).click();
  await expectHomeAtStepOne(page);

  await page.waitForTimeout(400);
  await expect(stepTitle(page)).toHaveText("Choose an area");
  await expectLeftTheSite(page);
});
