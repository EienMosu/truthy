import { expect, test, type Page } from "@playwright/test";
import { atHome, atStep, openHome, stepTitle } from "./helpers";

// Review finding U27, in a real browser: a reload in the middle of the start flow starts again at step 1, and
// the entries of the steps before the reload are taken out of the history, so back from step 1 leaves the
// site instead of bringing an old pass back. The move crosses entries the previous document made, which the
// app router sees as popstate events of its own. Every spec starts on about:blank, the page before the site.

// The history is the subject, not the movement between the steps.
test.use({ reducedMotion: "reduce" });

async function toSections(page: Page): Promise<void> {
  await openHome(page);
  await page.getByRole("button", { name: /^Cloud, / }).click();
  await atStep(page, "Choose a platform");
  await page.getByRole("button", { name: /^AWS, / }).click();
  await atStep(page, "Choose a deck");
  await page.getByRole("button", { name: /^CLF, / }).click();
  await atStep(page, "Choose a section");
}

async function expectBackLeavesTheSite(page: Page): Promise<void> {
  await page.reload();
  await atHome(page);
  // The rewind runs once the deck index is known; give it the time a phone would.
  await page.waitForTimeout(600);
  await expect(stepTitle(page)).toHaveText("Choose an area");
  await page.goBack();
  await expect(page).toHaveURL("about:blank");
}

test("a reload at the section step, then back, leaves the site", async ({ page }) => {
  await toSections(page);
  await expectBackLeavesTheSite(page);
});

test("a reload on the ready pass, then back, leaves the site", async ({ page }) => {
  await toSections(page);
  await page.getByRole("button", { name: /^SEC, / }).click();
  await atStep(page, "Choose how to play");
  await page.getByRole("button", { name: /^Classic\. / }).click();
  await atStep(page, "Your pass is ready");
  await expectBackLeavesTheSite(page);
});

test("after a reload the flow still steps forward and back as usual", async ({ page }) => {
  await toSections(page);
  await page.reload();
  await atHome(page);
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Cloud, / }).click();
  await atStep(page, "Choose a platform");
  await page.goBack();
  await expect(stepTitle(page)).toHaveText("Choose an area");
  await expect(page.locator('[data-field="platform"]')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL("about:blank");
});
