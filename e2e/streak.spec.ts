import { expect, test, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  answerCard,
  atStep,
  chooseRoute,
  deckAnswers,
  expectMissed,
  inClass,
  openHome,
  seeResults,
  startRound,
  stepTitle,
  verdict,
  verdictFor,
  waitForQuestion,
  type Played,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec section 6, "Modes": a Streak round goes on until the first wrong answer; its score is the run of
// correct answers, compared with the record for this route and mode.

const STREAK = inClass(CLF_SECURITY, "Streak");
const header = (page: Page) => page.locator("[data-flight-path]");
const nextCard = (page: Page) => page.getByRole("button", { name: "Next card" });

async function startStreak(page: Page): Promise<Map<string, boolean>> {
  await openHome(page);
  await chooseRoute(page, STREAK);
  await startRound(page);
  return deckAnswers(page, CLF_ID);
}

/** Answers card `number` and checks the verdict; a right answer goes on with "Next card". */
async function play(page: Page, answers: Map<string, boolean>, number: number, right: boolean, previous?: string): Promise<Played> {
  const played = await answerCard(page, answers, number, right, previous);
  await expect(verdict(page)).toHaveText(verdictFor(played.given, played.truth));
  if (right) {
    await expect(nextCard(page)).toBeVisible();
    await nextCard(page).click();
  }
  return played;
}

test("a Streak round ends on the first wrong answer and shows its result", async ({ page }) => {
  const answers = await startStreak(page);
  await expect(header(page)).toHaveAccessibleName("Streak of 0 correct answers.");

  const played: Played[] = [];
  for (let number = 1; number <= 3; number += 1) {
    const card = await answerCard(page, answers, number, true, played.at(-1)?.statement);
    await expect(verdict(page)).toHaveText(verdictFor(card.given, card.truth));
    await expect(nextCard(page)).toBeVisible();
    if (number === 3) await expect(header(page)).toHaveAccessibleName(/^Streak of 3 correct answers/);
    await nextCard(page).click();
    played.push(card);
  }

  const wrong = await answerCard(page, answers, 4, false, played.at(-1)?.statement);
  played.push(wrong);
  await expect(verdict(page)).toHaveText(verdictFor(wrong.given, wrong.truth));
  await expect(header(page)).toHaveAccessibleName(/^Streak ended at 3/);
  await expect(page.getByRole("button", { name: "See results" })).toBeVisible();
  await expect(nextCard(page)).toHaveCount(0);

  await seeResults(page);
  await expect(page.locator("[data-score]")).toHaveText("3");
  await expect(page.getByText("Correct in a row", { exact: true })).toBeVisible();
  await expect(page.locator("[data-comparison]")).toHaveText("First round on this route");
  await expectMissed(page, played);
  await expect(header(page)).toHaveAccessibleName("Streak over on card 4. 3 correct in a row. Card 4 was wrong.");

  await page.getByRole("button", { name: "Play again" }).click();
  await expect(header(page)).toHaveAccessibleName("Streak of 0 correct answers. Your best on this route is 3.");
});

test("passing the best shows New best on the slip, then on the result, and the start flow remembers it", async ({ page }) => {
  test.slow();
  const answers = await startStreak(page);

  // Round one: two right, one wrong. The best on this route is 2.
  const one = await play(page, answers, 1, true);
  const two = await play(page, answers, 2, true, one.statement);
  await play(page, answers, 3, false, two.statement);
  await seeResults(page);

  // Round two: the third right answer passes the best.
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(header(page)).toHaveAccessibleName("Streak of 0 correct answers. Your best on this route is 2.");
  let previous: string | undefined;
  for (let number = 1; number <= 2; number += 1) {
    const card = await answerCard(page, answers, number, true, previous);
    await expect(page.locator('[data-slip] [data-verdict="correct"]')).toBeVisible();
    await expect(page.locator('[data-verdict="new-best"]')).toHaveCount(0);
    await expect(verdict(page)).toHaveText(verdictFor(card.given, card.truth));
    await nextCard(page).click();
    previous = card.statement;
  }
  const third = await answerCard(page, answers, 3, true, previous);
  const stamp = page.locator('[data-slip] [data-verdict="new-best"]');
  await expect(stamp).toBeVisible();
  await expect(stamp).toHaveText("Correct. New best");
  await expect(verdict(page)).toHaveText(`${verdictFor(third.given, third.truth)} New best.`);
  await nextCard(page).click();
  await play(page, answers, 4, false, third.statement);
  await seeResults(page);
  await expect(page.locator("[data-score]")).toHaveText("3");
  await expect(page.locator("[data-comparison]")).toContainText("New best");
  await expect(page.locator("[data-comparison]")).toContainText("Previous best 2");

  // The start flow: the continue line says the last score, and the Streak class card says the best.
  await page.getByRole("button", { name: "Choose another route" }).click();
  await expect(stepTitle(page)).toHaveText("Choose an area");
  const continueLine = page.getByRole("button", {
    name: "Continue: Cloud Practitioner, Security and compliance, Streak. Last score 3 in a row.",
    exact: true,
  });
  await expect(continueLine).toBeVisible();
  await page.waitForTimeout(300);
  await continueLine.click();
  await atStep(page, "Your pass is ready");
  await page.getByRole("button", { name: "Back to classes" }).click();
  await expect(page.getByRole("button", { name: /^Streak\. .* Your best: 3 in a row\.$/ })).toBeVisible();
});

// "See results" comes in where True and False were, so a second tap on the answer that ends the Streak must
// not reach it before it has arrived: the verdict stays on screen. A tap once it has arrived opens the result.
for (const gap of [150, 300]) {
  test(`a double tap on the wrong answer keeps the verdict (taps ${gap} ms apart)`, async ({ page }) => {
    const answers = await startStreak(page);
    const { statement, truth } = await waitForQuestion(page, answers);
    const wrongButton = page.getByRole("button", { name: truth ? "False" : "True", exact: true });
    const box = await wrongButton.boundingBox();
    if (box === null) throw new Error("The wrong answer is not on screen");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(gap);
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(100);

    await expect(page).toHaveURL(/\/play$/);
    await expect(verdict(page)).toHaveText(verdictFor(!truth, truth));
    await expect(page.getByRole("button", { name: "See results" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Round complete" })).toHaveCount(0);
    expect(await page.locator("[data-statement] > p").last().textContent()).toContain(statement);

    await page.waitForTimeout(Math.max(0, 500 - gap - 100));
    await page.touchscreen.tap(x, y);
    await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
  });
}
