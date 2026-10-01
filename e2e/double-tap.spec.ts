import { expect, test } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  chooseRoute,
  deckAnswers,
  expectUnanswered,
  openHome,
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
