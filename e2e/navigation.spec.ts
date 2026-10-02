import { expect, test } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  CONTINUE_CLF_SECURITY,
  atHome,
  chooseRoute,
  deckAnswers,
  expectResult,
  openHome,
  playRound,
  startRound,
  storedProgress,
  waitForCard,
  wrongOn,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec section 4, "Routes": the pending round is kept for the tab, so a reload of /play keeps it.
test("reloading in the middle of a round deals a new round on the same route instead of going home", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);
  await waitForCard(page, answers, 1);
  await page.getByRole("button", { name: "False", exact: true }).click();
  await page.getByRole("button", { name: "Next card" }).click();
  await waitForCard(page, answers, 2);

  await page.reload();
  await expect(page).toHaveURL(/\/play$/);
  await waitForCard(page, answers, 1);
  await expect(page.getByText("Security and compliance").first()).toBeVisible();
});

// Review finding U2 (spec section 6, "Leaving a round"): a reload does not resume the round, but the answers
// given before it stay in the card history; the round sets no record. (This replaces finding U137's test of
// the old sentence, which dropped them.)
test("reloading in the middle of a round keeps the answers given so far in the card history, without a record", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);
  await waitForCard(page, answers, 1);
  await page.getByRole("button", { name: "False", exact: true }).click();
  await page.getByRole("button", { name: "Next card" }).click();
  await waitForCard(page, answers, 2);
  await page.getByRole("button", { name: "True", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next card" })).toBeVisible();

  await page.reload();
  await waitForCard(page, answers, 1);
  const progress = await storedProgress(page);
  expect(Object.values(progress.cards).map((card) => (card as { seen: number }).seen)).toEqual([1, 1]);
  expect(progress.records).toEqual({});
  expect(progress.last).toEqual({ route: { deckId: CLF_ID, sectionId: "SEC" }, mode: "classic", score: null, total: null });
});

// The phone's back gesture on the result screen: the round is already recorded, once.
test("the browser's back button on the result goes home with the round recorded", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await playRound(page, CLF_ID, wrongOn(1, 2, 3, 4));
  await expectResult(page, 6);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await atHome(page);
  await page.getByRole("button", { name: CONTINUE_CLF_SECURITY }).click();
  await page.getByRole("button", { name: "Back to classes" }).click();
  await expect(page.getByRole("button", { name: "Classic. 10 cards, score at the end. Your best: 6 of 10." })).toBeVisible();
});
