import { expect, test, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  SETTLE_MS,
  chooseRoute,
  deckAnswers,
  openHome,
  playRound,
  startRound,
  statementOnScreen,
  verdict,
  verdictFor,
  waitForCard,
  wrongOn,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Nothing on the page may be wider than the screen: a sideways page scroll fights the swipe.
async function expectNoSidewaysScroll(page: Page) {
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

// The 320 px phones (iPhone SE first generation, small Androids): spec section 1, mobile-first.
test.describe("on a 320 by 568 screen", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("the start flow, a whole round and the result fit the width, and the buttons can be reached", async ({ page }) => {
    await openHome(page);
    await expectNoSidewaysScroll(page);
    await chooseRoute(page, CLF_SECURITY);
    await expectNoSidewaysScroll(page);
    await expect(page.getByRole("button", { name: "Start round" })).toBeInViewport();
    await startRound(page);

    const answers = await deckAnswers(page, CLF_ID);
    await waitForCard(page, answers, 1);
    await expectNoSidewaysScroll(page);
    await expect(page.getByRole("button", { name: "True", exact: true })).toBeInViewport();
    await expect(page.getByRole("button", { name: "False", exact: true })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Leave round" })).toBeInViewport();

    // The answer slip (explanation and source link) can be scrolled into view under the action row.
    await page.getByRole("button", { name: "True", exact: true }).click();
    await expect(page.getByRole("button", { name: "Next card" })).toBeInViewport();
    const source = page.getByRole("link", { name: /\(opens in a new tab\)$/ });
    await source.scrollIntoViewIfNeeded();
    await expect(source).toBeInViewport();
    await expectNoSidewaysScroll(page);
    await page.getByRole("button", { name: "Next card" }).click();

    // Cards 2 to 10, all answered right.
    for (let n = 2; n <= 10; n += 1) {
      const { truth } = await waitForCard(page, answers, n);
      await page.getByRole("button", { name: truth ? "True" : "False", exact: true }).click();
      await page.getByRole("button", { name: n === 10 ? "See results" : "Next card" }).click();
    }
    await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
    await expectNoSidewaysScroll(page);
    await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  });
});

// The New best moment of the result (spec section 6) on a 320 px phone: the stamp and the "Previous best"
// line stay inside the pass when the score has a unit and two digits. The rounds are handed to /play the way
// the start flow does (the pending round in sessionStorage), with a record one below the score already stored.
// Reduced motion shows the stamp at rest, where it is measured.
test.describe("the New best of a result on a 320 by 568 screen", () => {
  test.use({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce" });

  async function openRound(page: Page, mode: "classic" | "lives" | "timed", record: number): Promise<void> {
    await page.addInitScript(
      ({ mode, record }) => {
        const route = { deckId: "aws-clf-c02", sectionId: "SEC" };
        sessionStorage.setItem("truthy.pending.v1", JSON.stringify({ route, mode }));
        if (localStorage.getItem("truthy.progress.v1") === null) {
          const records = { [`${route.deckId}/${route.sectionId}#${mode}`]: record };
          localStorage.setItem("truthy.progress.v1", JSON.stringify({ version: 1, cards: {}, records, last: null }));
        }
      },
      { mode, record },
    );
    await page.goto("/play");
  }

  // A card in Three lives: its statement is on screen and focused, the answer row is back and it has settled.
  async function livesCard(page: Page, answers: Map<string, boolean>, n: number): Promise<boolean> {
    const answered = n === 1 ? "No cards answered yet" : `${n - 1} ${n === 2 ? "card" : "cards"} answered`;
    await expect(page.getByRole("img", { name: new RegExp(`^\\d of 3 lives left\\. ${answered}`) })).toBeVisible();
    await expect(page.getByRole("button", { name: "True", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next card" })).toHaveCount(0);
    await expect(page.locator("[data-statement]")).toBeFocused();
    await page.waitForTimeout(SETTLE_MS);
    const truth = answers.get(await statementOnScreen(page));
    if (truth === undefined) throw new Error(`Card ${n} is not in the deck file`);
    return truth;
  }

  // A card in Timed: the first is read through focus, the later ones through the card announcer.
  async function timedCard(page: Page, answers: Map<string, boolean>, n: number): Promise<boolean> {
    let statement: string;
    if (n === 1) {
      await expect(page.locator("[data-statement]")).toBeFocused();
      statement = await statementOnScreen(page);
    } else {
      const announcer = page.locator("[data-card-announcer]");
      await expect(announcer).toHaveText(new RegExp(`^Card ${n}\\. `));
      statement = ((await announcer.textContent()) ?? "").replace(/^Card \d+\. /, "").trim();
    }
    await page.waitForTimeout(SETTLE_MS);
    const truth = answers.get(statement);
    if (truth === undefined) throw new Error(`Card ${n} is not in the deck file: "${statement}"`);
    return truth;
  }

  async function expectNewBestInsidePass(page: Page, score: string): Promise<void> {
    await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
    await expect(page.locator("[data-score]")).toHaveText(score);
    const pass = await page.locator("[data-boarding-pass]").boundingBox();
    if (pass === null) throw new Error("The pass is not on screen");
    for (const element of [page.locator("[data-new-best]"), page.getByText(/^Previous best /)]) {
      await expect(element).toBeVisible();
      const box = await element.boundingBox();
      if (box === null) throw new Error("A part of the New best is not on screen");
      // Half a pixel for subpixel layout.
      expect(box.x).toBeGreaterThanOrEqual(pass.x - 0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(pass.x + pass.width + 0.5);
    }
    await expectNoSidewaysScroll(page);
  }

  test("Classic 10 of 10 over a record of 9", async ({ page }) => {
    await openRound(page, "classic", 9);
    await playRound(page, CLF_ID, wrongOn());
    await expectNewBestInsidePass(page, "10 of 10");
  });

  test("Three lives 21 cards over a record of 20", async ({ page }) => {
    test.setTimeout(120_000);
    await openRound(page, "lives", 20);
    const answers = await deckAnswers(page, CLF_ID);
    // Three lives counts every card of the round, the third wrong one included.
    for (let n = 1; n <= 21; n += 1) {
      const truth = await livesCard(page, answers, n);
      const given = [6, 15, 21].includes(n) ? !truth : truth;
      await page.getByRole("button", { name: given ? "True" : "False", exact: true }).click();
      await expect(verdict(page)).toHaveText(verdictFor(given, truth));
      await page.getByRole("button", { name: n === 21 ? "See results" : "Next card" }).click();
    }
    await expectNewBestInsidePass(page, "21 cards");
  });

  test("Timed 14 of 17 over a record of 13", async ({ page }) => {
    // The round runs its whole minute in real time.
    test.setTimeout(150_000);
    await openRound(page, "timed", 13);
    const answers = await deckAnswers(page, CLF_ID);
    for (let n = 1; n <= 17; n += 1) {
      const truth = await timedCard(page, answers, n);
      const given = [4, 9, 15].includes(n) ? !truth : truth;
      await page.getByRole("button", { name: given ? "True" : "False", exact: true }).click();
    }
    await page.getByRole("button", { name: "See results" }).click({ timeout: 70_000 });
    await expectNewBestInsidePass(page, "14 of 17");
  });
});

// A statement with one long word (a real Next.js card: "suppressHydrationWarning", 24 characters) wraps
// inside its own paragraph; the pass keeps the width of the card, so SEC, Gate and the stub are not cut off
// on the right. A sideways scroll check cannot see this: the card's scroller clips what sticks out.
const LONG_WORD_STATEMENT = "suppressHydrationWarning repairs mismatched text during hydration.";

for (const width of [320, 360]) {
  test.describe(`on a ${width} px wide screen`, () => {
    test.use({ viewport: { width, height: 640 } });

    test("a statement with a long word does not widen the pass beyond the card", async ({ page }) => {
      await openHome(page);
      await chooseRoute(page, CLF_SECURITY);
      await startRound(page);
      await waitForCard(page, await deckAnswers(page, CLF_ID), 1);

      await page.locator("[data-statement] > p").last().evaluate((p, text) => {
        p.textContent = text;
      }, LONG_WORD_STATEMENT);

      const card = await page.locator("[data-swipe-card]").boundingBox();
      const pass = await page.locator("[data-boarding-pass]").boundingBox();
      if (card === null || pass === null) throw new Error("The card is not on screen");
      expect(card.width).toBeLessThanOrEqual(width);
      expect(pass.width).toBeLessThanOrEqual(card.width);
      // The right-most field ends inside the card (half a pixel for subpixel layout).
      const gate = await page.getByText("Gate", { exact: true }).boundingBox();
      if (gate === null) throw new Error("The Gate field is not on screen");
      expect(gate.x + gate.width).toBeLessThanOrEqual(card.x + card.width + 0.5);
    });
  });
}

// Turning the phone in the middle of a round: the round goes on where it was (no reload, no new deal).
test.describe("turning the phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the card, the answers given and the swipe after turning to landscape and back", async ({ page }) => {
    await openHome(page);
    await chooseRoute(page, CLF_SECURITY);
    await startRound(page);
    const answers = await deckAnswers(page, CLF_ID);

    const first = await waitForCard(page, answers, 1);
    await page.getByRole("button", { name: "True", exact: true }).click();
    await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
    await page.getByRole("button", { name: "Next card" }).click();
    const second = await waitForCard(page, answers, 2);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole("img", { name: /^Card 2 of 10\. Card 1 (correct|wrong)\.$/ })).toBeVisible();
    await expect(page.locator("[data-statement] > p").last()).toHaveText(second.statement);
    await expect(page.getByRole("button", { name: "False", exact: true })).toBeInViewport();
    await expectNoSidewaysScroll(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-statement] > p").last()).toHaveText(second.statement);
    // A swipe still answers after the turn (the edge zones follow the new width).
    const box = await page.locator("[data-statement]").boundingBox();
    if (box === null) throw new Error("The statement is not on screen");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 140, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(verdict(page)).toHaveText(verdictFor(false, second.truth));
  });
});
