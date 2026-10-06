import { expect, test, type Page } from "@playwright/test";
import { CLF_ID, answerCard, deckAnswers, openPendingRound, storedProgress, verdict, verdictFor, waitForCard } from "./helpers";

test.use({ reducedMotion: "no-preference" });

const DECIDED_COPY = "This round is over and its score is kept. Leaving skips its result.";

/** Leaves through the sheet and waits for the start at step 1. */
async function leaveThroughTheSheet(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Leave round" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave round?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(DECIDED_COPY);
  await dialog.getByRole("button", { name: "Leave round" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Owner decision D1 (spec section 6, "Leaving a round"): after the deciding answer only the result is left,
// so leaving records the round as opening the result would, with its score and record.
test("leaving a Classic round after its tenth answer records it with its score", async ({ page }) => {
  await openPendingRound(page, "classic");
  const answers = await deckAnswers(page, CLF_ID);
  for (let number = 1; number <= 10; number += 1) {
    const { truth } = await waitForCard(page, answers, number);
    const given = number <= 6 ? truth : !truth;
    await page.getByRole("button", { name: given ? "True" : "False", exact: true }).click();
    await expect(verdict(page)).toHaveText(verdictFor(given, truth));
    if (number < 10) await page.getByRole("button", { name: "Next card" }).click();
  }
  await expect(page.getByRole("button", { name: "See results" })).toBeVisible();

  await leaveThroughTheSheet(page);
  const progress = await storedProgress(page);
  expect(progress.records).toEqual({ "aws-clf-c02/SEC#classic": 6 });
  expect(progress.last).toEqual({ route: { deckId: CLF_ID, sectionId: "SEC" }, mode: "classic", score: 6, total: 10 });
  expect(Object.keys(progress.cards)).toHaveLength(10);
});

test("leaving a Timed round at time up records it with its score", async ({ page }) => {
  await page.clock.install();
  await openPendingRound(page, "timed");
  const answers = await deckAnswers(page, CLF_ID);
  await answerCard(page, answers, 1, true);
  await page.clock.runFor(61_000);
  await expect(page.getByRole("button", { name: "See results" })).toBeVisible();

  await leaveThroughTheSheet(page);
  const progress = await storedProgress(page);
  expect(progress.records).toEqual({ "aws-clf-c02/SEC#timed": 1 });
  expect(progress.last).toEqual({ route: { deckId: CLF_ID, sectionId: "SEC" }, mode: "timed", score: 1, total: 1 });
});

/**
 * A Classic round with card 1 answered, so the close button asks, and its "Next card" arrived. The row takes
 * focus when it arrives, 420 ms after the answer (NEXT_ARRIVES_MS): a sheet opened and kept before then gives
 * focus back to the close button, and the arrival then moves it on to "Next card", which on a busy runner can
 * land between the steps of a spec. Waiting for the arrival first keeps focus where the spec puts it.
 */
async function answeredOne(page: Page): Promise<void> {
  await openPendingRound(page, "classic");
  const { truth } = await waitForCard(page, await deckAnswers(page, CLF_ID), 1);
  await page.getByRole("button", { name: "True", exact: true }).click();
  await expect(verdict(page)).toHaveText(verdictFor(true, truth));
  await expect(page.getByRole("button", { name: "Next card" })).toBeFocused();
}

// Review finding U23: a tap on the sheet's title or text moves focus to the body; Escape still keeps playing.
test("Escape keeps playing after a tap on the sheet's title", async ({ page }) => {
  await answeredOne(page);
  await page.getByRole("button", { name: "Leave round" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave round?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("heading", { name: "Leave round?" }).click();
  await expect(page.getByRole("button", { name: "Keep playing" })).not.toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("button", { name: "Next card" })).toBeVisible();
});

// The sheet hears its keys on the document only while it is open: on its way out after Keep playing, Tab
// from the close button is the round screen's again, and does not send focus into the leaving sheet.
test("Tab right after Keep playing stays on the round screen", async ({ page }) => {
  await answeredOne(page);
  // The round's close button, not the leaving sheet's own "Leave round".
  const close = page.locator("main").getByRole("button", { name: "Leave round" });
  await close.click();
  const dialog = page.getByRole("dialog", { name: "Leave round?" });
  await expect(page.getByRole("button", { name: "Keep playing" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog).toHaveCount(0);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.activeElement !== document.body && document.querySelector("main")?.contains(document.activeElement))).toBe(true);
});

// Review finding U64: the scrim fades in over the close button, so a double tap on it put its second tap on
// the scrim and closed the sheet before it was seen.
test("a double tap on the close button opens the sheet and leaves it open", async ({ page }) => {
  await answeredOne(page);
  await page.getByRole("button", { name: "Leave round" }).dblclick();
  const dialog = page.getByRole("dialog", { name: "Leave round?" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(500);
  await expect(dialog).toBeVisible();
  // A tap on the scrim once the sheet has settled still keeps playing.
  await page.mouse.click(200, 100);
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/play$/);
});
