import { expect, test, type Page } from "@playwright/test";
import {
  CLF_ID,
  answerCard,
  centreOf,
  deckAnswers,
  openPendingRound,
  verdict,
  verdictFor,
  waitForCard,
  type Played,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// "Choose another route" lies where "See results" was (at 390 by 844 the pill is y 746 to 806, the quiet
// button y 762 to 810), so a second tap on "See results" lands on it. The result's actions take presses
// only once the result has been on screen for a second: a second tap, or a player still tapping when a Timed
// minute ends, never leaves the result unseen.

const resultHeading = (page: Page) => page.getByRole("heading", { name: "Round complete" });

/** Plays the round of `mode` up to its deciding answer and waits until "See results" has arrived (it takes focus). */
async function toDecidingAnswer(page: Page, mode: "classic" | "streak" | "lives"): Promise<void> {
  await openPendingRound(page, mode);
  const answers = await deckAnswers(page, CLF_ID);
  if (mode === "classic") {
    for (let n = 1; n <= 10; n += 1) {
      const { truth } = await waitForCard(page, answers, n);
      await page.getByRole("button", { name: truth ? "True" : "False", exact: true }).click();
      if (n < 10) await page.getByRole("button", { name: "Next card" }).click();
    }
  } else {
    // Streak ends on the first wrong answer, Three lives on the third.
    const wrongs = mode === "streak" ? 1 : 3;
    // What the status says after each wrong answer's verdict (review finding U50).
    const news = mode === "streak" ? [" Streak ended at 0."] : [" Life lost, 2 left.", " Last life.", " Out of lives."];
    let previous: Played | undefined;
    for (let n = 1; n <= wrongs; n += 1) {
      previous = await answerCard(page, answers, n, false, previous?.statement);
      await expect(verdict(page)).toHaveText(`${verdictFor(previous.given, previous.truth)}${news[n - 1]}`);
      if (n < wrongs) await page.getByRole("button", { name: "Next card" }).click();
    }
  }
  await expect(page.getByRole("button", { name: "See results" })).toBeFocused();
}

for (const mode of ["classic", "streak", "lives"] as const) {
  for (const gap of [80, 150, 250, 350]) {
    test(`a double tap on See results ${gap} ms apart keeps the result on screen (${mode})`, async ({ page }) => {
      await toDecidingAnswer(page, mode);
      const { x, y } = await centreOf(page.getByRole("button", { name: "See results" }));

      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(gap);
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(500);

      // The second tap lands on nothing (the actions take no pointer events yet); the result stays.
      await expect(page).toHaveURL(/\/play$/);
      await expect(resultHeading(page)).toHaveCount(1);
      await expect(page.locator("[data-score]")).toBeVisible();
      await expect(page.getByRole("button", { name: "Choose another route" })).toBeVisible();
    });
  }
}

test("once the result has been on screen for a second, Choose another route goes to the start", async ({ page }) => {
  await toDecidingAnswer(page, "streak");
  const { x, y } = await centreOf(page.getByRole("button", { name: "See results" }));
  await page.touchscreen.tap(x, y);
  await expect(resultHeading(page)).toBeFocused();
  await page.waitForTimeout(1100);
  await page.touchscreen.tap(x, y);
  await expect(page).toHaveURL(/\/$/);
});

test("Enter on a result action waits for the actions to arrive too", async ({ page }) => {
  await toDecidingAnswer(page, "streak");
  await page.keyboard.press("Enter");
  await expect(resultHeading(page)).toBeFocused();
  await page.getByRole("button", { name: "Play again" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await expect(resultHeading(page)).toBeVisible();
  await page.waitForTimeout(800);
  await page.keyboard.press("Enter");
  await expect(resultHeading(page)).toHaveCount(0);
  await expect(page.getByRole("img", { name: /^Streak of 0 correct answers/ })).toBeVisible();
});

// A player who keeps tapping where True is when the minute ends: the taps answer cards until time is up, one
// of them opens the result about 0.4 s later ("See results" lies there), and the taps that follow must not
// leave it. Real time: the round runs its whole minute.
type TapClock = { resultAt: number | null; taps: number[] };

test("taps every 200 ms through time up end on the result, not on the start screen", async ({ page }) => {
  test.setTimeout(120_000);
  // The page notes when the result arrives and when each tap lands, so the taps are timed on its clock. Timed on
  // the test's clock, a slow runner once pushed the last tap past the result's one-second guard.
  await page.addInitScript(() => {
    const clock: TapClock = { resultAt: null, taps: [] };
    (window as unknown as { tapClock: TapClock }).tapClock = clock;
    document.addEventListener("pointerdown", () => clock.taps.push(performance.now()), true);
    new MutationObserver(() => {
      const arrived = [...document.querySelectorAll("h1, h2")].some((heading) => heading.textContent === "Round complete");
      if (clock.resultAt === null && arrived) clock.resultAt = performance.now();
    }).observe(document, { subtree: true, childList: true });
  });
  const readClock = () => page.evaluate(() => (window as unknown as { tapClock: TapClock }).tapClock);
  await openPendingRound(page, "timed");
  const trueButton = page.getByRole("button", { name: "True", exact: true });
  await expect(page.locator("[data-statement]")).toBeFocused();
  const { x, y } = await centreOf(trueButton);

  const tapsOnResult = ({ resultAt, taps }: TapClock) => taps.filter((at) => resultAt !== null && at > resultAt).map((at) => Math.round(at - (resultAt ?? 0)));
  const started = Date.now();
  let seen: TapClock | null = null;
  // Until the result appears, and for 500 ms after it on the page's clock (two or three more taps). The margin
  // to the one-second guard is for a tap the runner delivers late.
  for (;;) {
    const clock = await readClock();
    // A new page has a new clock: a tap left the result.
    if (seen !== null && clock.resultAt === null) throw new Error(`A tap left the result. Taps on it, in ms after it arrived: ${tapsOnResult(seen).join(", ")}`);
    if (clock.resultAt !== null) seen = clock;
    if (clock.resultAt !== null && (await page.evaluate(() => performance.now())) - clock.resultAt > 500) break;
    if (Date.now() - started > 75_000) throw new Error("The round did not end");
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(200);
  }
  const onResult = tapsOnResult(await readClock());
  expect(onResult.length, "taps that land on the result").toBeGreaterThanOrEqual(1);
  expect(Math.max(...onResult), "every tap lands inside the result's one-second guard").toBeLessThan(1000);
  await page.waitForTimeout(300);

  await expect(page).toHaveURL(/\/play$/);
  await expect(resultHeading(page)).toBeVisible();
  await expect(page.locator("[data-flight-path]")).toHaveAccessibleName(/^Time is up\. /);
});
