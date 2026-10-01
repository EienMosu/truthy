import { expect, test } from "@playwright/test";
import { CDL_ID, CDL_WHOLE, atStep, chooseRoute, expectResult, openHome, playRound, startRound, stepTitle, wrongOn } from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec section 9, screen 1: a deck without sections skips the section step and plays the whole deck.
test("a deck without sections goes from the deck straight to the class and plays the whole deck", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CDL_WHOLE); // asserts "Choose how to play" right after the deck

  // Back from the ready pass goes to the class, then straight to the deck: no section step on the way.
  await page.getByRole("button", { name: "Back to classes" }).click();
  await expect(stepTitle(page)).toHaveText("Choose how to play");
  await page.getByRole("button", { name: "Back to decks" }).click();
  await atStep(page, "Choose a deck");
  await page.getByRole("button", { name: CDL_WHOLE.deck }).click();
  await atStep(page, "Choose how to play");
  await page.getByRole("button", { name: CDL_WHOLE.mode }).click();
  await atStep(page, "Your pass is ready");

  await startRound(page);
  await expect(page.getByText("Whole deck").first()).toBeVisible();
  await playRound(page, CDL_ID, wrongOn(10));
  await expectResult(page, 9);
});
