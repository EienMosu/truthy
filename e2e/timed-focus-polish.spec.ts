import { expect, test } from "@playwright/test";
import { CLF_ID, deckAnswers, openPendingRound, statementOnScreen, waitForQuestion } from "./helpers";

// Review finding U48: in Timed the first card's statement has focus, and it leaves with its card. A player
// who answers by key keeps focus on the ticket from then on, not on the page.
for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test.describe(`motion: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    test("answers by arrow key keep focus on the ticket, card after card", async ({ page }) => {
      await openPendingRound(page, "timed");
      const answers = await deckAnswers(page, CLF_ID);
      const ticket = page.getByRole("group", { name: "Ticket" });
      let previous: string | undefined;
      for (let card = 1; card <= 3; card += 1) {
        const { truth } = await waitForQuestion(page, answers, previous);
        if (card === 1) await expect(page.locator("[data-statement]")).toBeFocused();
        else await expect(ticket).toBeFocused();
        previous = await statementOnScreen(page);
        await page.keyboard.press(truth ? "ArrowRight" : "ArrowLeft");
      }
      await waitForQuestion(page, answers, previous);
      await expect(ticket).toBeFocused();
      expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
    });
  });
}
