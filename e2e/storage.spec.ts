import { expect, test } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  CONTINUE_CLF_SECURITY,
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

// Spec section 7: progress lives on the device under one versioned key; storage that is corrupt gives
// empty progress and the game still runs.
test("progress survives a reload", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await playRound(page, CLF_ID, wrongOn(4));
  await expectResult(page, 9);

  await page.goto("/");
  await page.reload();
  await expect(stepTitle(page)).toHaveText("Choose an area");
  // The deck card counts the ten cards seen (10 of 214 is 5 percent).
  await page.getByRole("button", { name: CLF_SECURITY.area }).click();
  await atStep(page, "Choose a platform");
  await page.getByRole("button", { name: CLF_SECURITY.platform }).click();
  await expect(page.getByRole("button", { name: /^CLF, Cloud Practitioner, \d+ cards, [1-9]\d* percent seen$/ })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: CONTINUE_CLF_SECURITY }).click();
  await page.getByRole("button", { name: "Back to classes" }).click();
  await expect(page.getByRole("button", { name: "Classic. 10 cards, score at the end. Your best: 9 of 10." })).toBeVisible();
});

const GARBAGE = ["{not json", "null", '{"version":1,"cards":"x","records":[],"last":7}', '{"version":2}'];

for (const [i, garbage] of GARBAGE.entries()) {
  test(`corrupt stored data starts clean and is replaced by the next round (${i + 1})`, async ({ page }) => {
    await page.goto("/");
    await page.evaluate((value) => {
      for (const key of ["truthy.progress.v1", "truthy.index.v1", "truthy.deck.aws-clf-c02"]) localStorage.setItem(key, value);
    }, garbage);
    await page.reload();

    await expect(page.getByRole("heading", { level: 1, name: "Truthy" })).toBeVisible();
    await expect(stepTitle(page)).toHaveText("Choose an area");
    await expect(page.getByRole("button", { name: /^Continue/ })).toHaveCount(0);

    await chooseRoute(page, CLF_SECURITY);
    await startRound(page);
    await playRound(page, CLF_ID, wrongOn());
    await expectResult(page, 10);
    await expect(page.getByText("First round on this route")).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("button", { name: CONTINUE_CLF_SECURITY })).toBeVisible();
  });
}
