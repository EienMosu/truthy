import { expect, test, type Locator, type Page } from "@playwright/test";
import { CLF_ID, RND_ID, SETTLE_MS, answerCard, deckAnswers, openPendingRound, statementOnScreen, waitForCard } from "./helpers";

// What the play screen keeps in view inside its stage. The ticket scrolls inside the stage when it is taller
// than the space (short phones, a phone held sideways, a zoomed page), and the stage runs on under the opaque
// action row. Nothing here scrolls by hand: the screen itself must bring what the player needs above the row.
test.use({ reducedMotion: "no-preference" });

/** The stage (the region "Card") and the top of the action row (True, Next card or See results), as boxes. */
async function stageAndRow(page: Page, action: Locator): Promise<{ top: number; row: number }> {
  const stage = await page.getByRole("region", { name: "Card" }).boundingBox();
  const row = await action.boundingBox();
  if (stage === null || row === null) throw new Error("The stage or the action row is not on screen");
  return { top: stage.y, row: row.y };
}

/** The boxes of a list of parts, null for a part that has none. */
async function boxes(parts: readonly Locator[]): Promise<({ y: number; bottom: number } | null)[]> {
  return Promise.all(
    parts.map(async (part) => {
      const box = await part.boundingBox();
      return box === null ? null : { y: box.y, bottom: box.y + box.height };
    }),
  );
}

// ---------- the verdict slip after an answer (review finding U44) ----------

/**
 * After an answer the verdict row (the answer and its stamp) and the explanation lie inside the stage, under
 * nothing and above the action, without a scroll by the player; so does the source link with its whole 48 px
 * target, unless the slip is taller than the stage, in which case the slip starts at the top of the stage.
 * Half a pixel for subpixel layout. Polled: the ticket scrolls smoothly and the stamp lands.
 */
async function expectSlipInView(page: Page, action: Locator): Promise<void> {
  await expect(action).toBeFocused(); // the action has arrived
  const slip = page.locator("[data-slip]");
  const parts = [slip.locator("[data-verdict]"), slip.locator("p").last()];
  const link = slip.getByRole("link");
  await expect
    .poll(
      async () => {
        const { top, row } = await stageAndRow(page, action);
        const [stamp, explanation] = await boxes(parts);
        const [whole, source] = await boxes([slip, link]);
        if (!stamp || !explanation || !whole || !source) return "a part of the slip is not on screen";
        for (const [name, box] of [["the verdict stamp", stamp], ["the explanation", explanation]] as const) {
          if (box.y < top - 0.5) return `${name} starts above the stage (${box.y} < ${top})`;
          if (box.bottom > row + 0.5) return `${name} runs under the action row (${box.bottom} > ${row})`;
        }
        const fits = whole.bottom - whole.y <= row - top;
        if (fits && source.bottom > row + 0.5) return `the source link runs under the action row (${source.bottom} > ${row})`;
        if (!fits && Math.abs(whole.y - top) > 1) return `a slip taller than the stage starts at ${whole.y}, not at the top ${top}`;
        return "in view";
      },
      { message: "the verdict slip is in view above the action row", timeout: 5_000 },
    )
    .toBe("in view");
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 664 },
]) {
  test.describe(`the verdict slip on a ${viewport.width} by ${viewport.height} screen`, () => {
    test.use({ viewport });

    test("Classic: the answer, the stamp, the explanation and the source show above Next card", async ({ page }) => {
      await openPendingRound(page, "classic");
      const answers = await deckAnswers(page, CLF_ID);
      const { truth } = await waitForCard(page, answers, 1);
      await page.getByRole("button", { name: truth ? "True" : "False", exact: true }).click();
      await expectSlipInView(page, page.getByRole("button", { name: "Next card" }));
    });

    test("Streak: the New best stamp shows above Next card", async ({ page }) => {
      await openPendingRound(page, "streak", 1);
      const answers = await deckAnswers(page, CLF_ID);
      const first = await answerCard(page, answers, 1, true);
      await page.getByRole("button", { name: "Next card" }).click();
      await answerCard(page, answers, 2, true, first.statement);
      await expect(page.locator('[data-slip] [data-verdict="new-best"]')).toBeVisible();
      await expectSlipInView(page, page.getByRole("button", { name: "Next card" }));
    });

    test("Three lives: the deciding third wrong answer shows above See results", async ({ page }) => {
      await openPendingRound(page, "lives");
      const answers = await deckAnswers(page, CLF_ID);
      let previous: string | undefined;
      for (let n = 1; n <= 3; n += 1) {
        previous = (await answerCard(page, answers, n, false, previous)).statement;
        if (n < 3) await page.getByRole("button", { name: "Next card" }).click();
      }
      await expect(page.locator('[data-slip] [data-verdict="wrong"]')).toBeVisible();
      await expectSlipInView(page, page.getByRole("button", { name: "See results" }));
    });
  });
}

// On the phone the design is drawn for, the long Next.js cards have a slip taller than the space left under
// the statement: their source link lay under Next card. Every card of a Classic round of the caching section.
test.describe("the verdict slip of long cards on a 390 by 844 screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("every slip of a Next.js caching round shows its source link above Next card", async ({ page }) => {
    await page.addInitScript((deckId) => {
      sessionStorage.setItem("truthy.pending.v1", JSON.stringify({ route: { deckId, sectionId: "CAC" }, mode: "classic" }));
    }, RND_ID);
    await page.goto("/play");
    const answers = await deckAnswers(page, RND_ID);
    for (let n = 1; n <= 10; n += 1) {
      const { truth } = await waitForCard(page, answers, n);
      await page.getByRole("button", { name: truth ? "True" : "False", exact: true }).click();
      const action = page.getByRole("button", { name: n === 10 ? "See results" : "Next card" });
      await expectSlipInView(page, action);
      if (n < 10) await action.click();
    }
  });

  // Most CLF tickets are a few pixels taller than the stage, but their slip still ends in the gap above Next
  // card, where nothing hides it: the ticket must not move for them (a nudge would cut the pass's top
  // corners flat at the stage top on most ordinary cards). Only a slip that runs under the row itself moves it.
  test("a slip that ends above Next card leaves the ticket where it is on a CLF Classic round", async ({ page }) => {
    await openPendingRound(page, "classic");
    const answers = await deckAnswers(page, CLF_ID);
    let overflowingButFits = 0;
    for (let n = 1; n <= 10; n += 1) {
      const { truth } = await waitForCard(page, answers, n);
      const ticketBox = ticket(page);
      expect(await ticketBox.evaluate((scroller) => scroller.scrollTop), "the statement fits: the ticket is at its top").toBe(0);
      await page.getByRole("button", { name: truth ? "True" : "False", exact: true }).click();
      const action = page.getByRole("button", { name: n === 10 ? "See results" : "Next card" });
      await expectSlipInView(page, action);
      await page.waitForTimeout(400); // past any smooth scroll
      const row = await action.boundingBox();
      if (row === null) throw new Error("The action row is not on screen");
      const at = await ticketBox.evaluate((scroller, rowTop) => {
        const slip = scroller.querySelector("[data-slip]");
        const top = scroller.getBoundingClientRect().top;
        const slipBottom = slip === null ? Infinity : slip.getBoundingClientRect().bottom - top + scroller.scrollTop;
        return { top: scroller.scrollTop, overflow: scroller.scrollHeight - scroller.clientHeight, fits: slipBottom <= rowTop - top };
      }, row.y);
      if (at.fits) {
        expect(at.top, `card ${n}: the slip ends above the row, so the ticket stays at its top`).toBe(0);
        if (at.overflow > 0) overflowingButFits += 1;
      }
      if (n < 10) await action.click();
    }
    expect(overflowingButFits, "the round had a ticket taller than the stage whose slip still ends above the row").toBeGreaterThan(0);
  });
});

// ---------- the statement of a new card (review finding U49) ----------

/**
 * The statement's text (from its first line, the appliesTo line where there is one, to its last) lies in the
 * visible stage: it starts inside the stage and ends above the action row, or, when it is taller than the
 * stage, it starts at the top of the stage. Polled: in Timed the ticket glides back up from the stamped stub.
 */
async function expectStatementInView(page: Page): Promise<void> {
  const action = page.getByRole("button", { name: "True", exact: true });
  await expect
    .poll(
      async () => {
        const { top, row } = await stageAndRow(page, action);
        const text = await page.locator("[data-statement]").last().evaluate((block) => {
          const first = block.firstElementChild?.getBoundingClientRect();
          const last = block.lastElementChild?.getBoundingClientRect();
          return first && last ? { y: first.top, bottom: last.bottom } : null;
        });
        if (text === null) return "the statement is not on screen";
        if (text.y < top - 0.5) return `the statement starts above the stage (${text.y} < ${top})`;
        const fits = text.bottom - text.y <= row - top;
        if (fits && text.bottom > row + 0.5) return `the statement runs under the action row (${text.bottom} > ${row})`;
        if (!fits && Math.abs(text.y - top) > 1) return `a statement taller than the stage starts at ${text.y}, not at the top ${top}`;
        return "in view";
      },
      { message: "the statement is in view above True and False", timeout: 5_000 },
    )
    .toBe("in view");
}

/** The ticket of the play screen: the stage's scroller. */
function ticket(page: Page): Locator {
  return page.locator("[data-swipe-card]").locator("..");
}

async function ticketScroll(page: Page): Promise<{ top: number; max: number }> {
  return ticket(page).evaluate((scroller) => ({ top: scroller.scrollTop, max: scroller.scrollHeight - scroller.clientHeight }));
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 844, height: 390 },
  { width: 640, height: 400 },
]) {
  test.describe(`the statement of a new card on a ${viewport.width} by ${viewport.height} screen`, () => {
    test.use({ viewport });

    test("Classic: each card shows its statement above True and False", async ({ page }) => {
      await openPendingRound(page, "classic");
      const answers = await deckAnswers(page, CLF_ID);
      for (let n = 1; n <= 3; n += 1) {
        const { truth } = await waitForCard(page, answers, n);
        await expectStatementInView(page);
        await page.getByRole("button", { name: truth ? "True" : "False", exact: true }).click();
        await page.getByRole("button", { name: "Next card" }).click();
      }
    });

    test("Timed: each card shows its statement above True and False", async ({ page }) => {
      await openPendingRound(page, "timed");
      const answers = await deckAnswers(page, CLF_ID);
      let previous: string | undefined;
      for (let n = 1; n <= 3; n += 1) {
        if (n > 1) await expect(page.locator("[data-card-announcer]")).toHaveText(new RegExp(`^Card ${n}\\. `));
        await expect.poll(() => statementOnScreen(page)).not.toBe(previous);
        await expectStatementInView(page);
        previous = (await answerCard(page, answers, n, true, previous)).statement;
      }
    });
  });
}

// The stage scrolls by keyboard in every mode. In Timed, from the second card on, focus is on the page or on
// the pill the player used, outside the ticket: the keys that scroll a page scroll the ticket from there. The
// ticket is also a stop of its own in the Tab order (Option+Tab in Safari, which leaves Tab to text fields).
test.describe("the ticket by keyboard on a 640 by 400 screen (a page zoomed to 200 percent)", () => {
  test.use({ viewport: { width: 640, height: 400 } });

  test("Timed: from the second card the arrow keys, End and Home scroll the ticket", async ({ page }) => {
    await openPendingRound(page, "timed");
    await expect(page.locator("[data-statement]")).toBeFocused();
    await page.waitForTimeout(SETTLE_MS);
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[data-card-announcer]")).toHaveText(/^Card 2\. /);
    await expectStatementInView(page);
    await page.waitForTimeout(SETTLE_MS);
    const before = await ticketScroll(page);
    expect(before.max, "the ticket is taller than the stage").toBeGreaterThan(before.top);
    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await ticketScroll(page)).top).toBeGreaterThan(before.top);
    await page.keyboard.press("End");
    await expect.poll(async () => (await ticketScroll(page)).top).toBeCloseTo(before.max, 0);
    await page.keyboard.press("Home");
    await expect.poll(async () => (await ticketScroll(page)).top).toBe(0);
  });

  test("the ticket is a stop in the Tab order and scrolls with the arrow keys", async ({ page, browserName }) => {
    await openPendingRound(page, "classic");
    await expect(page.locator("[data-statement]")).toBeFocused();
    await page.getByRole("button", { name: "Leave round" }).focus();
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    await expect(ticket(page)).toBeFocused();
    const before = await ticketScroll(page);
    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await ticketScroll(page)).top).toBeGreaterThan(before.top);
  });
});
