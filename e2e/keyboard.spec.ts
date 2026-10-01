import { expect, test } from "@playwright/test";
import { CLF_ID, CLF_SECURITY, chooseRoute, expectMissed, expectResult, openHome, playRound, startRound } from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec section 8: left arrow False, right arrow True, Enter for the following action.
test("the arrow keys and Enter play a whole round", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);

  // Right on odd cards, wrong on even ones, so both arrows are used for right and for wrong answers.
  const played = await playRound(page, CLF_ID, (number, truth) => (number % 2 === 1 ? truth : !truth), "keys");

  await expectResult(page, 5);
  await expectMissed(page, played);
  expect(played.some((card) => card.given)).toBe(true);
  expect(played.some((card) => !card.given)).toBe(true);
});
