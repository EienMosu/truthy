// Review finding U93: on a short screen the play screen's stage is shorter than the ticket, and the action row is
// opaque, so what lies under it cannot be read. These specs check, by position rather than by presence in the
// page, that the parts the player must read are on screen and above the row: the statement of a card that
// arrives, and the top of the answer slip (its verdict) once the card is answered. The end of the slip, its
// source link, is checked on the smallest phone in e2e/small-screens.spec.ts, and the missed list of the result
// there too. A card on screen while the phone is turned keeps its scroll (design system 7, "Statement into
// view"), so these specs open the round at the size they check.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { CLF_ID, deckAnswers, openPendingRound, verdict, verdictFor, waitForCard } from "./helpers";

test.use({ reducedMotion: "no-preference" });

/** The part lies inside the screen and above the top of the action row. Half a pixel for subpixel layout. */
async function expectAboveRow(page: Page, part: Locator, row: Locator, what: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const box = await part.boundingBox();
        const top = await row.boundingBox();
        return box !== null && top !== null && box.y >= -0.5 && box.y + box.height <= top.y + 0.5;
      },
      { message: `${what} lies inside the screen and above the action row`, timeout: 5_000 },
    )
    .toBe(true);
}

const statement = (page: Page) => page.locator("[data-statement] > p").last();
const answerRow = (page: Page) => page.getByRole("button", { name: "True", exact: true });
const slipTop = (page: Page) => page.locator("[data-slip] p").first();

for (const viewport of [
  { width: 320, height: 568 },
  { width: 844, height: 390 },
  { width: 667, height: 375 },
]) {
  test.describe(`a round on a ${viewport.width} by ${viewport.height} screen`, () => {
    test.use({ viewport });

    test("each card's statement shows above True and False, and the verdict above Next card once answered", async ({ page }) => {
      await openPendingRound(page, "classic");
      const answers = await deckAnswers(page, CLF_ID);

      for (const n of [1, 2]) {
        const card = await waitForCard(page, answers, n);
        await expectAboveRow(page, statement(page), answerRow(page), `card ${n}'s statement`);

        await page.getByRole("button", { name: "True", exact: true }).click();
        await expect(verdict(page)).toHaveText(verdictFor(true, card.truth));
        const next = page.getByRole("button", { name: "Next card" });
        await expect(next).toBeFocused();
        await expectAboveRow(page, slipTop(page), next, `card ${n}'s verdict`);
        await next.click();
      }
    });
  });
}
