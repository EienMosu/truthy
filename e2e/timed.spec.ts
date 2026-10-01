import { expect, test, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  answerCard,
  chooseRoute,
  deckAnswers,
  expectMissed,
  inClass,
  openHome,
  seeResults,
  setPageHidden,
  startRound,
  storedProgress,
  verdict,
  type Played,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

const header = (page: Page) => page.locator("[data-flight-path]");

/** The seconds the header's clock shows ("0:41 left" is 41). */
async function secondsLeft(page: Page): Promise<number> {
  const text = (await page.locator("[data-flight-path] [data-progress]").textContent()) ?? "";
  const match = /^(\d):(\d\d) left$/.exec(text.trim());
  if (!match) throw new Error(`The clock reads "${text}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

async function startTimed(page: Page): Promise<Map<string, boolean>> {
  await page.clock.install();
  await openHome(page);
  await chooseRoute(page, inClass(CLF_SECURITY, "Timed"));
  await startRound(page);
  return deckAnswers(page, CLF_ID);
}

/**
 * Plays the page's running web animations to their end. Motion starts its opacity and transform animations
 * as web animations timed by performance.now, which the page clock fakes, while the browser runs them on the
 * document's real timeline. Once the page clock has been run a minute ahead, a new animation would only
 * start a minute later in real time, so an element that leaves with an exit animation stays in the page.
 * A phone has one clock and no such gap; finishing the animations puts the page where it would be.
 */
async function finishAnimations(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish();
  });
}

/** Answers a card and holds its stamp on screen (a hidden page pauses the beat) while `look` checks it. */
async function answerAndLook(
  page: Page,
  answers: Map<string, boolean>,
  number: number,
  right: boolean,
  previous: string | undefined,
  look: () => Promise<void>,
): Promise<Played> {
  const played = await answerCard(page, answers, number, right, previous);
  await setPageHidden(page, true);
  await look();
  await setPageHidden(page, false);
  return played;
}

test("a Timed round stamps each answer, ends when the minute is over and shows its result", async ({ page }) => {
  const answers = await startTimed(page);
  await expect(header(page)).toHaveAccessibleName(/^\d+ seconds left of 60\. 0 correct, 0 wrong\.$/);

  const first = await answerAndLook(page, answers, 1, true, undefined, async () => {
    await expect(page.locator('[data-stub-stamp="correct"]')).toBeVisible();
    await expect(verdict(page)).toHaveText("Correct.");
    await expect(page.getByText("Next card coming up")).toBeVisible();
    await expect(page.locator("[data-slip]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next card" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "True", exact: true })).toHaveAttribute("aria-disabled", "true");
  });

  const second = await answerAndLook(page, answers, 2, false, first.statement, async () => {
    await expect(page.locator('[data-stub-stamp="wrong"]')).toBeVisible();
    await expect(verdict(page)).toHaveText("Not quite.");
    await expect(page.getByText("Missed, saved for review at the end")).toBeVisible();
    await expect(page.getByText("The answer is")).toHaveCount(0);
  });

  await page.clock.runFor(61_000);
  await expect(page.locator('[data-stub-stamp="time-up"]')).toBeVisible();
  await expect(header(page)).toHaveAccessibleName("No time left. 2 cards answered: 1 correct, 1 wrong.");
  expect(await secondsLeft(page)).toBe(0);
  await expect(page.getByText("Closed")).toBeVisible();
  await expect(page.getByText("This card doesn't count · 2 answered")).toBeVisible();
  await expect(page.locator("[data-statement][data-muted]")).toBeVisible();
  // True and False leave with an exit animation, which the page clock holds back (see finishAnimations).
  await expect(async () => {
    await finishAnimations(page);
    await expect(page.getByRole("button", { name: "True", exact: true })).toHaveCount(0, { timeout: 500 });
    await expect(page.getByRole("button", { name: "False", exact: true })).toHaveCount(0, { timeout: 500 });
  }).toPass();

  await seeResults(page);
  await expect(page.locator("[data-score]")).toHaveText("1 of 2");
  await expect(header(page)).toHaveAccessibleName("Time is up. 2 cards answered in 60 seconds. 1 correct, 1 wrong: card 2.");
  await expectMissed(page, [first, second]);
  const progress = await storedProgress(page);
  expect(progress.records["aws-clf-c02/SEC#timed"]).toBe(1);
  expect(Object.keys(progress.cards)).toHaveLength(2);
});

test("the clock pauses while the page is hidden", async ({ page }) => {
  await startTimed(page);
  await page.clock.runFor(10_000);
  await setPageHidden(page, true);
  const paused = await secondsLeft(page);
  expect(paused).toBeLessThanOrEqual(50);
  expect(paused).toBeGreaterThanOrEqual(44);

  await page.clock.runFor(120_000); // two minutes with the page hidden
  expect(await secondsLeft(page)).toBe(paused);
  await expect(page.locator('[data-stub-stamp="time-up"]')).toHaveCount(0);

  await setPageHidden(page, false);
  await page.clock.runFor(5_000);
  const spent = paused - (await secondsLeft(page));
  expect(spent).toBeGreaterThanOrEqual(5);
  expect(spent).toBeLessThanOrEqual(8);
});

test("a jump of the clock costs at most a second", async ({ page }) => {
  await startTimed(page);
  await page.clock.runFor(5_000);
  const before = await secondsLeft(page);
  await page.clock.fastForward(30 * 60_000); // the phone slept for half an hour and reported nothing
  await page.clock.runFor(1_000);
  const spent = before - (await secondsLeft(page));
  expect(spent).toBeGreaterThanOrEqual(1);
  expect(spent).toBeLessThanOrEqual(5);
  await expect(page.getByRole("button", { name: "True", exact: true })).toBeVisible();
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the stamps are shown at rest and the round still plays to its result", async ({ page }) => {
    const answers = await startTimed(page);
    const atRest = (selector: string) => async () => {
      const stamp = page.locator(selector);
      await expect(stamp).toBeVisible();
      // At rest from its first frame: fully opaque, no landing under way.
      expect(await stamp.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
    };
    const first = await answerAndLook(page, answers, 1, true, undefined, atRest('[data-stub-stamp="correct"]'));
    await answerAndLook(page, answers, 2, true, first.statement, atRest('[data-stub-stamp="correct"]'));
    await page.clock.runFor(61_000);
    await atRest('[data-stub-stamp="time-up"]')();
    await seeResults(page);
    await expect(page.locator("[data-score]")).toHaveText("2 of 2");
  });
});
