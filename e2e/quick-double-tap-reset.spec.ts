// quickDoubleTap plays an attempt again when its taps were too far apart, and each further attempt has to start
// from an empty device. Storage used to be cleared while the page was still on /play: the next page.goto then
// fired pagehide there, and the round screen wrote the slow attempt's answers back, so the retry started as a
// returning player with a card history and a continue line.
import { expect, test } from "@playwright/test";
import { CLF_ID, answerCard, deckAnswers, openPendingRound, quickDoubleTap, storedProgress } from "./helpers";

test.use({ reducedMotion: "reduce" });

test("a further attempt starts from an empty device, though the slow one left a round with answers on /play", async ({ page }) => {
  let attempts = 0;
  let cardsAtRetry: Record<string, unknown> | null = null;
  await quickDoubleTap(
    page,
    100,
    async () => {
      attempts += 1;
      if (attempts === 1) {
        await openPendingRound(page, "classic");
        const answers = await deckAnswers(page, CLF_ID);
        await answerCard(page, answers, 1, true);
        await expect(page.getByRole("button", { name: "Next card" })).toBeVisible();
        return 10_000; // too slow: play it again
      }
      await page.goto("/");
      cardsAtRetry = (await storedProgress(page)).cards;
      return 0;
    },
    async () => {},
  );
  expect(attempts).toBe(2);
  expect(cardsAtRetry).toEqual({});
});
