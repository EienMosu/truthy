import { expect, test } from "@playwright/test";
import { CLF_ID, CLF_SECURITY, chooseRoute, expectMissed, expectResult, openHome, playRound, startRound, wrongOn } from "./helpers";

// A Mac with "Reduce motion" on makes headless Chromium report reduce; these specs play with motion.
test.use({ reducedMotion: "no-preference" });

test("a first run fills in the pass, plays ten cards with the buttons and shows the result", async ({ page }) => {
  await openHome(page);
  // A new player has nothing to continue.
  await expect(page.getByRole("button", { name: /^Continue/ })).toHaveCount(0);

  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);

  const played = await playRound(page, CLF_ID, wrongOn(3, 6, 9));

  await expectResult(page, 7);
  await expect(page.getByRole("img", { name: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." })).toBeVisible();
  await expect(page.getByText("First round on this route")).toBeVisible();
  await expectMissed(page, played);
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose another route" })).toBeVisible();
});
