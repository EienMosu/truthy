import { expect, test, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  chooseRoute,
  deckAnswers,
  dragCard,
  expectUnanswered,
  openHome,
  startRound,
  verdict,
  verdictFor,
  waitForCard,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Swipe rules, spec section 8: a release at least 90 px from the start commits (right is True); a shorter
// drag cancels; a gesture more vertical than horizontal is not a swipe.
async function toFirstCard(page: Page) {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  return deckAnswers(page, CLF_ID);
}

test("a drag past the threshold to the right answers True, and to the left answers False", async ({ page }) => {
  const answers = await toFirstCard(page);

  const first = await waitForCard(page, answers, 1);
  await dragCard(page, 140, 0);
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
  await page.getByRole("button", { name: "Next card" }).click();

  const second = await waitForCard(page, answers, 2);
  await dragCard(page, -140, 0);
  await expect(verdict(page)).toHaveText(verdictFor(false, second.truth));
  // The flight path records the second answer.
  await expect(page.getByRole("img", { name: /^Card 2 of 10\. / })).toBeVisible();
});

test("a short drag of 30 px does not answer, and the card can still be answered after it", async ({ page }) => {
  const answers = await toFirstCard(page);
  const first = await waitForCard(page, answers, 1);

  await dragCard(page, 30, 0, 3);
  await dragCard(page, -30, 0, 3);
  await expectUnanswered(page, 1);

  await dragCard(page, 140, 0);
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
});

test("a mostly vertical drag does not answer, even when it travels more than 90 px sideways", async ({ page }) => {
  const answers = await toFirstCard(page);
  const first = await waitForCard(page, answers, 1);

  await dragCard(page, 100, 160);
  await dragCard(page, -100, -160);
  await expectUnanswered(page, 1);

  await dragCard(page, -140, 0);
  await expect(verdict(page)).toHaveText(verdictFor(false, first.truth));
});

test("a real touch drag answers in Chromium (touch-action lets the horizontal drag reach the card)", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Touch input with moves is only available through the Chromium DevTools protocol");
  const answers = await toFirstCard(page);
  const first = await waitForCard(page, answers, 1);

  const box = await page.locator("[data-statement]").boundingBox();
  if (box === null) throw new Error("The statement is not on screen");
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 12; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - step * 12, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  await expect(verdict(page)).toHaveText(verdictFor(false, first.truth));
});
