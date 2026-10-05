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

// Review finding U138: the two taps of a double tap are two calls from the test, and on a busy machine they can
// land further apart than the spec waits between them. A second tap after the 250 ms settle time is a fair press
// on whatever has arrived, not the double tap these specs are about, so the page times the taps itself and an
// attempt whose taps were too far apart is played again from the start. Each spec names how far apart its taps
// may be: 50 ms short of the guard it is about (the 250 ms settle time, or Next card's 420 ms arrival).
const WITHIN_SETTLE_MS = 200;
const WITHIN_ARRIVAL_MS = 370;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const taps: number[] = [];
    Object.assign(window, { __taps: taps });
    window.addEventListener("touchstart", (event) => taps.push(event.timeStamp), { capture: true });
  });
});

/** Taps twice at (x, y), `gap` ms apart as far as the test can ask, and returns how far apart the page saw them. */
async function tapTwice(page: Page, x: number, y: number, gap: number): Promise<number> {
  await page.evaluate(() => (window as unknown as { __taps: number[] }).__taps.splice(0));
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(gap);
  await page.touchscreen.tap(x, y);
  const taps = await page.evaluate(() => [...(window as unknown as { __taps: number[] }).__taps]);
  expect(taps).toHaveLength(2);
  return (taps[1] ?? 0) - (taps[0] ?? 0);
}

/**
 * Runs `attempt` (which sets the scene and double taps, returning tapTwice's measure) until its taps were at most
 * `within` ms apart, three times at most, then `check`. Each further attempt starts from an empty device.
 */
async function quickDoubleTap(
  page: Page,
  within: number,
  attempt: () => Promise<number>,
  check: () => Promise<void>,
): Promise<void> {
  const seen: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    if (i > 0) {
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    }
    const apart = Math.round(await attempt());
    if (apart <= within) {
      await check();
      return;
    }
    seen.push(apart);
    test.info().annotations.push({ type: "slow double tap", description: `${apart} ms apart, played again` });
  }
  throw new Error(`The two taps were never within ${within} ms of each other: ${seen.join(", ")} ms`);
}

// Spec section 8: input is ignored for 250 ms after a new card appears. "Next card" and the True button
// share the same spot, so a quick double tap on "Next card" must not answer the next card unseen.
test("a double tap on Next card does not answer the next card", async ({ page }) => {
  await quickDoubleTap(
    page,
    WITHIN_SETTLE_MS,
    async () => {
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
      return tapTwice(page, box.x + box.width * 0.75, box.y + box.height / 2, 100);
    },
    async () => {
      await page.waitForTimeout(400);
      await expectUnanswered(page, 2);
    },
  );
});

// "Next card" comes in where True and False were, so a quick double tap on an answer must not land on it
// before it has arrived: the verdict and the explanation stay on screen.
test("a double tap on an answer keeps the verdict and the explanation", async ({ page }) => {
  let first = { statement: "", truth: false };
  await quickDoubleTap(
    page,
    WITHIN_ARRIVAL_MS,
    async () => {
      await openHome(page);
      await chooseRoute(page, CLF_SECURITY);
      await startRound(page);
      const answers = await deckAnswers(page, CLF_ID);

      first = await waitForCard(page, answers, 1);
      const { x, y } = await centreOf(page.getByRole("button", { name: "True", exact: true }));
      return tapTwice(page, x, y, 150);
    },
    async () => {
      await page.waitForTimeout(600);
      await expectAnswerKept(page, first);
    },
  );
});

/** Card 1 is still on screen with the verdict on True, its explanation and Next card. */
async function expectAnswerKept(page: Page, first: { statement: string; truth: boolean }): Promise<void> {
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
}

// The same in the start flow: the next step's cards appear where the chosen card was, so a quick double
// tap on "Cloud" must not choose "AWS" unseen.
test("a double tap on an area does not choose a platform", async ({ page }) => {
  await quickDoubleTap(
    page,
    WITHIN_SETTLE_MS,
    async () => {
      await openHome(page);
      const { x, y } = await centreOf(page.getByRole("button", { name: CLF_SECURITY.area }));
      return tapTwice(page, x, y, 100);
    },
    async () => {
      await page.waitForTimeout(400);
      await expect(stepTitle(page)).toHaveText("Choose a platform");
      await expect(page.getByRole("button", { name: CLF_SECURITY.platform })).toBeVisible();
    },
  );
});

// Review finding U6: the start screen opened from /play shows the continue line where the button just pressed
// was. Step 1's options appearing start the settle time, so the second tap of a double tap does not take the
// line to the old route's ready pass: the player lands on step 1 as asked.
async function doubleTap(page: Page, button: Locator, gap: number): Promise<void> {
  const { x, y } = await centreOf(button);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(gap);
  await page.touchscreen.tap(x, y);
  // The second tap landed on the continue line, so the spec cannot pass for want of a target. The line stays
  // where it was on step 1, so it is measured after the taps: measured between them, a slow runner stretched
  // the gap past the settle time.
  const line = await page.getByRole("button", { name: /^Continue: / }).boundingBox();
  expect(line).not.toBeNull();
  if (line) {
    expect(y).toBeGreaterThanOrEqual(line.y);
    expect(y).toBeLessThanOrEqual(line.y + line.height);
  }
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
    await expect(page.getByRole("button", { name: /^Continue: AWS Cloud Practitioner, Security and compliance, Streak\./ })).toBeVisible();
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
