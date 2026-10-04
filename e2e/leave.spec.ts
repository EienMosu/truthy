import { expect, test, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  CONTINUE_CLF_SECURITY,
  answerCard,
  atHome,
  chooseRoute,
  deckAnswers,
  inClass,
  openHome,
  seeResults,
  startRound,
  stepTitle,
  storedProgress,
  verdict,
  verdictFor,
  waitForCard,
  waitForQuestion,
  type ClassName,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec section 6, "Leaving a round": one confirmation; a round that is left sets no record; the answers
// already given stay in the card history (and the route becomes the one to continue).
test("leaving after an answer asks once, Keep playing stays, Leave round goes home without a record", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);

  const first = await waitForCard(page, answers, 1);
  await page.getByRole("button", { name: "True", exact: true }).click();
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));

  // The close control asks first.
  await page.getByRole("button", { name: "Leave round" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave round?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep playing" })).toBeFocused();

  // Keep playing: the dialog closes and the round is where it was.
  await dialog.getByRole("button", { name: "Keep playing" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/play$/);
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
  await page.getByRole("button", { name: "Next card" }).click();
  await waitForCard(page, answers, 2);

  // Leave round: back to the start.
  await page.getByRole("button", { name: "Leave round" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Leave round" }).click();
  await expect(page).toHaveURL(/\/$/);
  await atHome(page);

  // Continue is offered, and the Classic card still has no record.
  await page.getByRole("button", { name: CONTINUE_CLF_SECURITY }).click();
  await expect(stepTitle(page)).toHaveText("Your pass is ready");
  await page.getByRole("button", { name: "Back to classes" }).click();
  await expect(page.getByRole("button", { name: "Classic. Correct answers out of 10 cards. Not played yet." })).toBeVisible();
});

test("leaving before any answer goes home at once and leaves nothing to continue", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await waitForCard(page, await deckAnswers(page, CLF_ID), 1);

  await page.getByRole("button", { name: "Leave round" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toHaveText("Choose an area");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Continue/ })).toHaveCount(0);
});

/** Back on the start flow after a left round: the answers are kept, no record is set, and the route can be continued without a score. */
async function expectLeftRound(page: Page, className: ClassName, cards: number): Promise<void> {
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toHaveText("Choose an area");
  const progress = await storedProgress(page);
  expect(Object.keys(progress.cards)).toHaveLength(cards);
  expect(progress.records).toEqual({});
  expect((progress.last as { score: number | null } | null)?.score).toBeNull();
  await expect(
    page.getByRole("button", { name: `Continue: Cloud Practitioner, Security and compliance, ${className}.`, exact: true }),
  ).toBeVisible();
}

// The phone's back gesture leaves a round the way the close button does, in every mode.
for (const className of ["Streak", "Three lives", "Timed"] as const) {
  test(`back in the middle of a round keeps the answers and sets no record, in every mode: ${className}`, async ({ page }) => {
    if (className === "Timed") await page.clock.install();
    await openHome(page);
    await chooseRoute(page, inClass(CLF_SECURITY, className));
    await startRound(page);
    await answerCard(page, await deckAnswers(page, CLF_ID), 1, true);
    await expect(verdict(page)).not.toHaveText("");

    await page.goBack();
    await expectLeftRound(page, className, 1);
  });
}

/** A Streak round of two right answers and a wrong one: decided, with "See results" waiting. */
async function decidedStreak(page: Page): Promise<void> {
  await openHome(page);
  await chooseRoute(page, inClass(CLF_SECURITY, "Streak"));
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);
  let previous: string | undefined;
  for (let number = 1; number <= 3; number += 1) {
    const card = await answerCard(page, answers, number, number < 3, previous);
    await expect(verdict(page)).toHaveText(verdictFor(card.given, card.truth));
    if (number < 3) await page.getByRole("button", { name: "Next card" }).click();
    previous = card.statement;
  }
  await expect(page.getByRole("button", { name: "See results" })).toBeVisible();
}

// Spec sections 2 and 6: a round that is left sets no record, also once it is decided. Only "See results"
// finishes it. (The plan lists the proposal to count such a round as finished; it is not built.)
test("back on a decided Streak round keeps the answers and sets no record", async ({ page }) => {
  await decidedStreak(page);
  await page.goBack();
  await expectLeftRound(page, "Streak", 3);
});

test("the close button on a decided round asks, and Keep playing leads to See results", async ({ page }) => {
  await decidedStreak(page);
  await page.getByRole("button", { name: "Leave round" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave round?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep playing" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "See results" })).toBeVisible();

  await seeResults(page);
  expect((await storedProgress(page)).records["aws-clf-c02/SEC#streak"]).toBe(2);
});

// Review finding U57 (design system 8, Accessibility: on step 7 Escape leaves the round): Escape does what
// the close button does. Before the first answer it leaves at once; after it, it opens "Leave round?", where
// Escape keeps playing. A held Escape opens the sheet once and leaves it open.
test("Escape leaves at once before the first answer", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await waitForCard(page, await deckAnswers(page, CLF_ID), 1);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toHaveText("Choose an area");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Escape after an answer asks once, Escape in the sheet keeps playing, and a held Escape leaves the sheet open", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  const first = await waitForCard(page, await deckAnswers(page, CLF_ID), 1);
  await page.getByRole("button", { name: "True", exact: true }).click();
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
  const next = page.getByRole("button", { name: "Next card" });
  await expect(next).toBeFocused();

  const dialog = page.getByRole("dialog", { name: "Leave round?" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep playing" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/play$/);
  await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
  await expect(page.getByRole("button", { name: "Leave round" })).toBeFocused();

  // Held: the repeats neither close the sheet nor open it again.
  await page.keyboard.down("Escape");
  for (let held = 0; held < 1200; held += 33) {
    await page.waitForTimeout(33);
    await page.keyboard.down("Escape");
  }
  await page.keyboard.up("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep playing" })).toBeFocused();

  await dialog.getByRole("button", { name: "Leave round" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(Object.keys((await storedProgress(page)).cards)).toHaveLength(1);
});

/** Two cards of a round answered right with the buttons, in any mode. */
async function answerTwo(page: Page): Promise<void> {
  const answers = await deckAnswers(page, CLF_ID);
  const first = await answerCard(page, answers, 1, true);
  await expect(verdict(page)).not.toHaveText("");
  const action = page.getByRole("button", { name: "Next card" });
  if (await action.count()) await action.click();
  await answerCard(page, answers, 2, true, first.statement);
  await expect(verdict(page)).not.toHaveText("");
}

/** Every card in the card history was seen once. */
async function expectSeenOnce(page: Page, cards: number): Promise<void> {
  const progress = await storedProgress(page);
  const seen = Object.values(progress.cards).map((card) => (card as { seen: number }).seen);
  expect(seen).toEqual(Array.from({ length: cards }, () => 1));
}

// Review finding U2 (spec section 6): the answers of a round that is left stay in the card history also
// when leaving /play unloads the page: a /play that was opened as its own page and left with back, a
// player who goes to another site, a reload. The round is saved when the page is hidden for good (pagehide).
for (const className of ["Classic", "Streak", "Three lives", "Timed"] as const) {
  test(`back from a /play opened as its own page keeps the answers and sets no record: ${className}`, async ({ page }) => {
    await openHome(page);
    await chooseRoute(page, inClass(CLF_SECURITY, className));
    await startRound(page);
    await waitForQuestion(page, await deckAnswers(page, CLF_ID));
    // Leaving before an answer keeps the round for the tab, so /play typed in the address bar opens it again,
    // this time as a page of its own.
    await page.getByRole("button", { name: "Leave round" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/play");
    await page.evaluate(() => Object.assign(window, { truthyPlayDocument: true }));
    await answerTwo(page);

    await page.goBack();
    expect(await page.evaluate(() => "truthyPlayDocument" in window)).toBe(false);
    await expectLeftRound(page, className, 2);
    await expectSeenOnce(page, 2);
  });
}

test("going to another site in the middle of a round keeps the answers and sets no record", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await answerTwo(page);

  await page.goto("about:blank");
  await page.goto("/");
  await expectLeftRound(page, "Classic", 2);
  await expectSeenOnce(page, 2);
});
