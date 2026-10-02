import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  answerCard,
  centreOf,
  chooseRoute,
  deckAnswers,
  expectUnanswered,
  inClass,
  openHome,
  seeResults,
  startRound,
  stepTitle,
  verdict,
  verdictFor,
  waitForCard,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec section 8: input is ignored for 250 ms after a new card appears. "Next card" and the True button
// share the same spot, so a quick double tap on "Next card" must not answer the next card unseen.
test("a double tap on Next card does not answer the next card", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);

  const first = await waitForCard(page, answers, 1);
  await page.getByRole("button", { name: "True", exact: true }).click();
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
  const next = page.getByRole("button", { name: "Next card" });
  await expect(next).toBeFocused(); // it has arrived and taken focus
  const box = await next.boundingBox();
  if (box === null) throw new Error("Next card is not on screen");
  // Three quarters across: the spot where True appears.
  const x = box.x + box.width * 0.75;
  const y = box.y + box.height / 2;

  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(100);
  await page.touchscreen.tap(x, y);

  await page.waitForTimeout(400);
  await expectUnanswered(page, 2);
});

// "Next card" comes in where True and False were, so a quick double tap on an answer must not land on it
// before it has arrived: the verdict and the explanation stay on screen.
test("a double tap on an answer keeps the verdict and the explanation", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);

  const first = await waitForCard(page, answers, 1);
  const box = await page.getByRole("button", { name: "True", exact: true }).boundingBox();
  if (box === null) throw new Error("True is not on screen");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(150);
  await page.touchscreen.tap(x, y);

  await page.waitForTimeout(600);
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
  const deck = (await (await page.request.get(`/decks/${CLF_ID}.json`)).json()) as {
    cards: { text: { en: { statement: string; explanation: string } } }[];
  };
  const explanation = deck.cards.find((card) => card.text.en.statement === first.statement)?.text.en.explanation;
  if (explanation === undefined) throw new Error("The card on screen is not in the deck file");
  await expect(page.getByText(explanation, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next card" })).toBeVisible();
  await expect(page.getByRole("button", { name: "True", exact: true })).toHaveCount(0);
});

// The same in the start flow: the next step's cards appear where the chosen card was, so a quick double
// tap on "Cloud" must not choose "AWS" unseen.
test("a double tap on an area does not choose a platform", async ({ page }) => {
  await openHome(page);
  const box = await page.getByRole("button", { name: CLF_SECURITY.area }).boundingBox();
  if (box === null) throw new Error("The Cloud card is not on screen");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(100);
  await page.touchscreen.tap(x, y);

  await page.waitForTimeout(400);
  await expect(stepTitle(page)).toHaveText("Choose a platform");
  await expect(page.getByRole("button", { name: CLF_SECURITY.platform })).toBeVisible();
});

// Review finding U6: the start screen opened from /play shows the continue line where the button just pressed
// was. Step 1's options appearing start the settle time, so the second tap of a double tap does not take the
// line to the old route's ready pass: the player lands on step 1 as asked.
async function doubleTap(page: Page, button: Locator, gap: number): Promise<void> {
  const { x, y } = await centreOf(button);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(gap);
  // The second tap really lands on the continue line, so the spec cannot pass for want of a target.
  const line = await page.getByRole("button", { name: /^Continue: / }).boundingBox();
  expect(line).not.toBeNull();
  if (line) {
    expect(y).toBeGreaterThanOrEqual(line.y);
    expect(y).toBeLessThanOrEqual(line.y + line.height);
  }
  await page.touchscreen.tap(x, y);
}

for (const gap of [100, 200]) {
  test(`a double tap on Choose another route lands on step 1, not on the old route's pass (${gap} ms)`, async ({ page }) => {
    await openHome(page);
    await chooseRoute(page, inClass(CLF_SECURITY, "Streak"));
    await startRound(page);
    await answerCard(page, await deckAnswers(page, CLF_ID), 1, false);
    await seeResults(page);
    await page.waitForTimeout(1600); // past the result's own one-second guard
    await doubleTap(page, page.getByRole("button", { name: "Choose another route" }), gap);
    await page.waitForTimeout(600);
    await expect(stepTitle(page)).toHaveText("Choose an area");
    await expect(page.getByRole("button", { name: /^Continue: Cloud Practitioner, Security and compliance, Streak\./ })).toBeVisible();
  });
}

test("a double tap on the Leave dialog's Leave round lands on step 1, not on the old route's pass", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await answerCard(page, await deckAnswers(page, CLF_ID), 1, true);
  await expect(verdict(page)).not.toHaveText("");
  await page.getByRole("button", { name: "Leave round" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave round?" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(500);
  await doubleTap(page, dialog.getByRole("button", { name: "Leave round" }), 100);
  await page.waitForTimeout(600);
  await expect(stepTitle(page)).toHaveText("Choose an area");
});
