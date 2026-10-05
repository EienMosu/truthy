import { expect, test, type Page } from "@playwright/test";
import { CLF_ID, answerCard, deckAnswers, openPendingRound } from "./helpers";

test.use({ reducedMotion: "reduce", viewport: { width: 320, height: 568 } });

/**
 * On a 320 phone the label row wraps between its two labels (design system 5.10) and the second line hangs
 * below the fixed 56 header, into the 12 gap above the ticket. It must stay in that gap: its bottom at or
 * above the top of the area the ticket scrolls in.
 */
async function expectTallyAboveTicket(page: Page): Promise<void> {
  const boxes = await page.evaluate(() => {
    const header = document.querySelector("main header");
    const tally = header?.querySelector("[data-tally]");
    const progress = header?.querySelector("[data-progress]");
    const stage = header?.nextElementSibling;
    if (!tally || !progress || !stage) return null;
    return {
      tally: tally.getBoundingClientRect().toJSON() as DOMRect,
      progress: progress.getBoundingClientRect().toJSON() as DOMRect,
      stage: stage.getBoundingClientRect().toJSON() as DOMRect,
    };
  });
  expect(boxes).not.toBeNull();
  // Wrapped: the tally is on the second line.
  expect(boxes!.tally.top).toBeGreaterThanOrEqual(boxes!.progress.bottom - 0.5);
  expect(boxes!.tally.bottom).toBeLessThanOrEqual(boxes!.stage.top + 0.5);
}

test("at 320 wide a wrapped Streak label row stays clear of the ticket, in the round and on the result", async ({ page }) => {
  test.slow();
  await openPendingRound(page, "streak", 5);
  const answers = await deckAnswers(page, CLF_ID);
  let previous: string | undefined;
  for (let number = 1; number <= 14; number++) {
    const played = await answerCard(page, answers, number, number <= 13, previous);
    previous = played.statement;
    if (number <= 13) await page.getByRole("button", { name: "Next card" }).click();
  }
  await expect(page.locator("[data-flight-path] [data-progress]")).toHaveText("Streak ended at 13");
  await expect(page.locator("[data-flight-path] [data-tally]")).toHaveText("Previous best 5");
  await expectTallyAboveTicket(page);

  await page.getByRole("button", { name: "See results" }).click();
  await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
  await expect(page.locator("[data-flight-path] [data-tally]")).toHaveText("13 correct · 1 wrong");
  await expectTallyAboveTicket(page);
});
