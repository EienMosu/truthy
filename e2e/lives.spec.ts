import { expect, test, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  RND_ID,
  RND_REQUEST,
  answerCard,
  chooseRoute,
  deckAnswers,
  expectMissed,
  inClass,
  openHome,
  seeResults,
  startRound,
  storedProgress,
  verdict,
  verdictFor,
  type Played,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec section 6, "Modes": a Three lives round ends on the third wrong answer; its score is the cards
// answered, the one that cost the last life included.

const header = (page: Page) => page.locator("[data-flight-path]");
const hearts = (page: Page) => page.locator("[data-heart]");

/** A field of the pass on the result: its value under the label. */
function field(page: Page, label: string) {
  return page
    .locator("[data-boarding-pass] dl > div")
    .filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) })
    .locator("dd");
}

async function expectHearts(page: Page, states: readonly ("full" | "lost")[]): Promise<void> {
  await expect(hearts(page)).toHaveCount(3);
  for (const [i, state] of states.entries()) await expect(hearts(page).nth(i)).toHaveAttribute("data-heart", state);
}

test("a Three lives round ends on the third wrong answer", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, inClass(CLF_SECURITY, "Three lives"));
  await startRound(page);
  const answers = await deckAnswers(page, CLF_ID);

  await expect(header(page)).toHaveAccessibleName("3 of 3 lives left. No cards answered yet.");
  await expect(page.locator('[data-heart="full"]')).toHaveCount(3);

  const wrongOn = [2, 4, 5];
  // What the status says after the verdict when a life goes (review finding U50).
  const lifeNews: Record<number, string> = { 2: " Life lost, 2 left.", 4: " Last life.", 5: " Out of lives." };
  const played: Played[] = [];
  for (let number = 1; number <= 5; number += 1) {
    const card = await answerCard(page, answers, number, !wrongOn.includes(number), played.at(-1)?.statement);
    played.push(card);
    await expect(verdict(page)).toHaveText(`${verdictFor(card.given, card.truth)}${lifeNews[number] ?? ""}`);
    if (number === 2) {
      await expect(header(page)).toHaveAccessibleName(/^2 of 3 lives left\./);
      await expectHearts(page, ["full", "full", "lost"]);
    }
    if (number === 4) await expect(header(page)).toHaveAccessibleName(/^1 of 3 lives left\./);
    if (number < 5) {
      await expect(page.getByRole("button", { name: "See results" })).toHaveCount(0);
      await page.getByRole("button", { name: "Next card" }).click();
    }
  }

  await expect(header(page)).toHaveAccessibleName("No lives left. The round is over after 5 cards: cards 2, 4 and 5 were wrong.");
  await expectHearts(page, ["lost", "lost", "lost"]);
  await expect(page.getByRole("button", { name: "See results" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next card" })).toHaveCount(0);

  await seeResults(page);
  await expect(page.locator("[data-score]")).toHaveText("5 cards");
  await expect(field(page, "Correct")).toHaveText("02");
  await expect(field(page, "Wrong")).toHaveText("03");
  await expect(header(page)).toHaveAccessibleName("Out of lives after 5 cards. 2 correct, 3 wrong: cards 2, 4 and 5.");
  await expectMissed(page, played);
  const progress = await storedProgress(page);
  expect(progress.records["aws-clf-c02/SEC#lives"]).toBe(5);
});

// The smallest sections have eleven cards. A long round goes on past the last one: the route comes round
// again in its first order, and the round never runs out of cards.
test("an eleven card section goes on after its last card", async ({ page }) => {
  test.slow();
  await openHome(page);
  await chooseRoute(page, inClass(RND_REQUEST, "Three lives"));
  await startRound(page);
  const answers = await deckAnswers(page, RND_ID);

  const statements: string[] = [];
  for (let number = 1; number <= 13; number += 1) {
    const card = await answerCard(page, answers, number, true, statements.at(-1));
    statements.push(card.statement);
    await expect(verdict(page)).toHaveText(verdictFor(card.given, card.truth));
    if (number < 13) await page.getByRole("button", { name: "Next card" }).click();
  }

  expect(new Set(statements.slice(0, 11)).size).toBe(11);
  expect(statements[11]).toBe(statements[0]);
  expect(statements[12]).toBe(statements[1]);
  await expect(header(page)).toHaveAccessibleName("3 of 3 lives left. 13 cards answered.");
});
