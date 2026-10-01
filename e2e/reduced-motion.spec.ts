import { expect, test } from "@playwright/test";
import { CLF_ID, CLF_SECURITY, chooseRoute, expectMissed, expectResult, openHome, playRound, startRound, wrongOn } from "./helpers";

// Spec section 9, "Motion": every transition has a reduced-motion fallback (a cross-fade).
test.use({ reducedMotion: "reduce" });

test("with reduced motion the start flow, a whole round and the result all work", async ({ page }) => {
  await openHome(page);
  expect(await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  const played = await playRound(page, CLF_ID, wrongOn(1, 2));

  await expectResult(page, 8);
  await expectMissed(page, played);
  await expect(page.getByText("First round on this route")).toBeVisible();
});
