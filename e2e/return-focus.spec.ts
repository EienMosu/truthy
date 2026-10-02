import { expect, test, type Page } from "@playwright/test";
import { CLF_ID, CLF_SECURITY, answerCard, chooseRoute, deckAnswers, inClass, openHome, openPendingRound, seeResults, startRound, stepTitle, verdict } from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Review finding U56: the control pressed on /play is gone once the start opens, so the start's step 1 title
// takes the focus (design system section 8: step titles take focus after each step). A fresh page load moves
// no focus, as before.

async function expectTitleFocusedOnStepOne(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toHaveText("Choose an area");
  await expect(stepTitle(page)).toBeFocused();
  // It stays there once the areas have come in.
  await expect(page.getByRole("button", { name: CLF_SECURITY.area })).toBeVisible();
  await page.waitForTimeout(400);
  await expect(stepTitle(page)).toBeFocused();
}

/** A Streak round of one wrong answer, on its result, once the result's actions take presses. */
async function onResult(page: Page): Promise<void> {
  await openHome(page);
  await chooseRoute(page, inClass(CLF_SECURITY, "Streak"));
  await startRound(page);
  await answerCard(page, await deckAnswers(page, CLF_ID), 1, false);
  await expect(verdict(page)).not.toHaveText("");
  await seeResults(page);
  await page.waitForTimeout(1200);
}

test("Enter on Choose another route focuses the step 1 title", async ({ page }) => {
  await onResult(page);
  await page.getByRole("button", { name: "Choose another route" }).focus();
  await page.keyboard.press("Enter");
  await expectTitleFocusedOnStepOne(page);
});

test("a tap on Close results focuses the step 1 title", async ({ page }) => {
  await onResult(page);
  await page.getByRole("button", { name: "Close results" }).click();
  await expectTitleFocusedOnStepOne(page);
});

test("Leave round, confirmed in its dialog, focuses the step 1 title", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, inClass(CLF_SECURITY, "Three lives"));
  await startRound(page);
  await answerCard(page, await deckAnswers(page, CLF_ID), 1, true);
  await expect(verdict(page)).not.toHaveText("");
  await page.getByRole("button", { name: "Leave round" }).click();
  await page.getByRole("dialog", { name: "Leave round?" }).getByRole("button", { name: "Leave round" }).click();
  await expectTitleFocusedOnStepOne(page);
});

test("Leave round on a /play that was opened straight away focuses the step 1 title", async ({ page }) => {
  await openPendingRound(page, "streak");
  await expect(page.getByRole("button", { name: "True", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Leave round" }).click();
  await expectTitleFocusedOnStepOne(page);
});

test("a fresh page load of the start moves no focus", async ({ page }) => {
  await openHome(page);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
});
