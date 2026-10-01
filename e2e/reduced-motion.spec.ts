import { expect, test } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  chooseRoute,
  deckAnswers,
  expectMissed,
  expectResult,
  openHome,
  playRound,
  startRound,
  verdict,
  verdictFor,
  waitForCard,
  wrongOn,
} from "./helpers";

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

// The time "Next card" ignores presses guards against a double tap, not against the animation: it is the
// same 420 ms with reduced motion, although the cross-fade is over sooner.
for (const gap of [150, 300]) {
  test(`with reduced motion a double tap ${gap} ms apart on an answer keeps the verdict`, async ({ page }) => {
    await openHome(page);
    await chooseRoute(page, CLF_SECURITY);
    await startRound(page);
    const answers = await deckAnswers(page, CLF_ID);

    const first = await waitForCard(page, answers, 1);
    const box = await page.getByRole("button", { name: "True", exact: true }).boundingBox();
    if (box === null) throw new Error("True is not on screen");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.click(x, y);
    await page.waitForTimeout(gap);
    await page.mouse.click(x, y);

    await page.waitForTimeout(600);
    await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();
    await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
    await expect(page.getByRole("button", { name: "Next card" })).toBeVisible();
  });
}
