// Short heights (review findings U49, U79 and U81): a phone held sideways (844 by 390, 667 by 375, 568 by 320)
// and a 390 by 844 phone zoomed to 200 percent (195 by 422) or 300 percent (130 by 281). The orientation is not
// locked (WCAG 1.3.4), so every screen works there: the statement never lies under True and False, the start
// flow reaches Start round, the result's missed list and actions can be reached, and the leave sheet can be
// read and answered. At 300 percent scrolling is expected, but nothing is cut off out of reach. Under 320 wide the
// page keeps the 320 layout and scrolls sideways (e2e/narrow-zoom-polish.spec.ts), so a control is brought into
// reach by scrolling both ways, as a player would.
import { readFileSync, readdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { CLF_ID, CLF_SECURITY, SETTLE_MS, answerCard, atHome, atStep, deckAnswers, openPendingRound, waitForQuestion } from "./helpers";
import { plainText } from "../src/content/text";

test.use({ reducedMotion: "reduce" });

const SIDEWAYS = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 568, height: 320 },
] as const;
const ZOOM_200 = { width: 195, height: 422 } as const;
const ZOOM_300 = { width: 130, height: 281 } as const;
const SHORT = [...SIDEWAYS, ZOOM_200, ZOOM_300] as const;

const name = (viewport: { width: number; height: number }) => `${viewport.width} by ${viewport.height}`;

/**
 * Scrolls `target` into reach as a player would (the page or the column it lies in, both ways) and checks that a
 * finger can take it there: it is on screen (wholly upright when it is no taller than the screen; across, a part of
 * it, since a control can be wider than a zoomed screen) and on top at the middle of that part, under no other
 * layer. Returns that point on the screen. Mobile Chromium pans its visual viewport over a page wider than the
 * screen, so the point is checked in the page's own coordinates (elementFromPoint) and tapped on the screen's.
 * `whole`: a part to be read, not only tapped; its top and its bottom edge are on top too, so it can be read at
 * once, cut by no scroller's edge and under no other layer.
 */
async function reach(page: Page, target: Locator, whole = false): Promise<{ x: number; y: number }> {
  await target.scrollIntoViewIfNeeded();
  return inReach(page, target, whole);
}

/** What reach checks, where `target` lies now, scrolling nothing: for a scroll the screen should have made itself. */
async function inReach(page: Page, target: Locator, whole = false): Promise<{ x: number; y: number }> {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("No viewport");
  const box = await target.boundingBox();
  if (box === null) throw new Error(`${String(target)} has no box`);
  const left = Math.max(0, box.x);
  const right = Math.min(viewport.width, box.x + box.width);
  const top = Math.max(0, box.y);
  const bottom = Math.min(viewport.height, box.y + box.height);
  expect(right - left, `a part of ${String(target)} is on screen across`).toBeGreaterThan(8);
  expect(bottom - top, `a part of ${String(target)} is on screen upright`).toBeGreaterThan(8);
  if (box.height <= viewport.height) {
    expect(box.y, `${String(target)} is wholly on screen, top`).toBeGreaterThanOrEqual(-0.5);
    expect(box.y + box.height, `${String(target)} is wholly on screen, bottom`).toBeLessThanOrEqual(viewport.height + 0.5);
  }
  const x = (left + right) / 2;
  const y = (top + bottom) / 2;
  const ys = whole && box.height <= viewport.height ? [box.y + 2, y, box.y + box.height - 2] : [y];
  for (const py of ys) {
    const onTop = await target.evaluate((element, [px, py, bx, by]) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint((px ?? 0) + rect.left - (bx ?? 0), (py ?? 0) + rect.top - (by ?? 0));
      return hit !== null && (hit === element || element.contains(hit));
    }, [x, py, box.x, box.y]);
    expect(onTop, `${String(target)} is on top at (${x}, ${py})`).toBe(true);
  }
  return { x, y };
}

/** Brings `target` into reach and taps it. */
async function tap(page: Page, target: Locator): Promise<void> {
  const { x, y } = await reach(page, target);
  await page.touchscreen.tap(x, y);
}

/** A label that fits its box: nothing of its text is cut off by the box's edges. */
async function expectWhole(target: Locator): Promise<void> {
  const { scroll, client } = await target.evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(scroll, `the text of ${String(target)} fits its box`).toBeLessThanOrEqual(client + 1);
}

// ---------- the play screen ----------

/**
 * Where the statement of the card on screen lies against the stage and the action row: "in view" when nothing of
 * the ticket lies under the row (the scroller ends at the top of the row) and the statement's text, its appliesTo
 * line included, lies wholly between the top of the stage and the gap above the row, or, for a text taller than
 * that, starts at the top of the stage. Half a pixel for subpixel layout.
 */
async function statementPlacement(page: Page): Promise<string> {
  return page.locator("[data-statement]").last().evaluate((statement) => {
    const scroller = statement.closest("[data-swipe-card]")?.parentElement;
    const stage = scroller?.parentElement;
    const row = stage?.nextElementSibling;
    const first = statement.firstElementChild;
    const last = statement.lastElementChild;
    if (!scroller || !stage || !row || !first || !last) return "the play screen is not built as expected";
    const rowTop = row.getBoundingClientRect().top;
    const stageTop = stage.getBoundingClientRect().top;
    const scrollerBottom = scroller.getBoundingClientRect().bottom;
    if (scrollerBottom > rowTop + 0.5) return `the ticket runs on under the action row (${scrollerBottom} > ${rowTop})`;
    const visibleBottom = scrollerBottom - parseFloat(getComputedStyle(scroller).paddingBottom);
    const top = first.getBoundingClientRect().top;
    const bottom = last.getBoundingClientRect().bottom;
    if (bottom - top <= visibleBottom - stageTop + 0.5) {
      if (top < stageTop - 0.5) return `the statement starts above the stage (${top} < ${stageTop})`;
      if (bottom > visibleBottom + 0.5) return `the statement ends below the visible stage (${bottom} > ${visibleBottom})`;
      return "in view";
    }
    return Math.abs(top - stageTop) <= 1 ? "in view" : `a statement taller than the stage starts at ${top}, not at ${stageTop}`;
  });
}

async function expectStatementInView(page: Page, what: string): Promise<void> {
  await expect.poll(() => statementPlacement(page), { message: `${what}: the statement is in view above True and False` }).toBe("in view");
}

/** Answers the card on screen by tapping True or False, scrolled into reach first (sideways under 320 wide). */
async function tapAnswer(page: Page, given: boolean): Promise<void> {
  await tap(page, page.getByRole("button", { name: given ? "True" : "False", exact: true }));
}

for (const viewport of SHORT) {
  test.describe(`a round on a ${name(viewport)} screen`, () => {
    test.use({ viewport });

    test("Classic: each card's statement shows above True and False, nothing of the ticket lies under them, and the verdict shows above Next card", async ({ page }) => {
      await openPendingRound(page, "classic");
      const answers = await deckAnswers(page, CLF_ID);
      let previous: string | undefined;
      for (const n of [1, 2, 3]) {
        const card = await waitForQuestion(page, answers, previous);
        previous = card.statement;
        await expectStatementInView(page, `card ${n}`);
        await tapAnswer(page, card.truth);
        const next = page.getByRole("button", { name: "Next card" });
        await expect(next).toBeFocused();
        await page.waitForTimeout(500);
        const verdictRow = await page.locator("[data-slip] [data-verdict]").boundingBox();
        const nextBox = await next.boundingBox();
        expect(verdictRow !== null && nextBox !== null && verdictRow.y + verdictRow.height <= nextBox.y + 0.5, `card ${n}'s verdict lies above Next card`).toBe(true);
        await tap(page, next);
      }
    });

    test("Timed: each card's statement shows above True and False", async ({ page }) => {
      await openPendingRound(page, "timed");
      const answers = await deckAnswers(page, CLF_ID);
      let previous: string | undefined;
      for (const n of [1, 2, 3]) {
        if (n > 1) await expect(page.locator("[data-card-announcer]")).toHaveText(new RegExp(`^Card ${n}\\. `));
        const card = await waitForQuestion(page, answers, previous);
        previous = card.statement;
        await expectStatementInView(page, `card ${n}`);
        await tapAnswer(page, card.truth);
      }
    });

    test("the leave sheet can be read whole and answered", async ({ page }) => {
      await openPendingRound(page, "classic");
      const answers = await deckAnswers(page, CLF_ID);
      const card = await waitForQuestion(page, answers);
      await tapAnswer(page, card.truth);
      await expect(page.getByRole("button", { name: "Next card" })).toBeFocused();
      await page.keyboard.press("Escape");
      const sheet = page.getByRole("dialog", { name: "Leave round?" });
      await expect(sheet).toBeVisible();
      await page.waitForTimeout(500);
      await reach(page, sheet.getByRole("heading", { name: "Leave round?" }));
      await reach(page, sheet.getByRole("button", { name: "Leave round" }));
      const stay = sheet.getByRole("button", { name: "Keep playing" });
      await expectWhole(stay);
      await tap(page, stay);
      await expect(sheet).toHaveCount(0);
    });
  });
}

// Review finding M2: with motion on, the leave sheet rises 24 px into place and sinks 24 px on its way out, and on a
// short screen only 12 lie under it: the moving sheet made its layer scrollable for those 360 ms (a classic
// scrollbar flashed and the sheet shifted sideways). Every frame from opening the sheet to its leaving is checked.
test.describe("the leave sheet moving in and out on a 844 by 390 screen", () => {
  test.use({ viewport: SIDEWAYS[0], reducedMotion: "no-preference" });

  test("never makes its layer scrollable", async ({ page }) => {
    await openPendingRound(page, "classic");
    const answers = await deckAnswers(page, CLF_ID);
    const card = await waitForQuestion(page, answers);
    await tapAnswer(page, card.truth);
    await expect(page.getByRole("button", { name: "Next card" })).toBeFocused();
    await page.evaluate(() => {
      const frames = { shown: 0, scrollable: 0 };
      (window as unknown as { leaveFrames: typeof frames }).leaveFrames = frames;
      const tick = () => {
        const layer = document.querySelector("[role=dialog]")?.parentElement?.parentElement;
        if (layer) {
          frames.shown += 1;
          if (getComputedStyle(layer).overflowY !== "hidden" && layer.scrollHeight > layer.clientHeight) frames.scrollable += 1;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.keyboard.press("Escape");
    const sheet = page.getByRole("dialog", { name: "Leave round?" });
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(800);
    await sheet.getByRole("button", { name: "Keep playing" }).click();
    await expect(sheet).toHaveCount(0);
    const frames = await page.evaluate(() => (window as unknown as { leaveFrames: { shown: number; scrollable: number } }).leaveFrames);
    expect(frames.shown, "frames with the sheet were sampled").toBeGreaterThan(10);
    expect(frames.scrollable, "frames in which the sheet's layer could scroll").toBe(0);
  });
});

// Every statement shipped, with its appliesTo line, fits the stage of a phone held sideways down to 667 by 375 and
// of a 390 by 844 phone at 200 percent zoom, so no player there has to scroll a card to read it. Each statement is
// set into the live statement of a round and measured; a card without its own appliesTo line gets one line in the
// card's mono data type when its deck card has one (every shipped qualifier is one line at 320, see
// tests/content). At 568 by 320 and at 300 percent a long statement scrolls instead (the specs above).
for (const viewport of [SIDEWAYS[0], SIDEWAYS[1], ZOOM_200]) {
  test.describe(`every statement on a ${name(viewport)} screen`, () => {
    test.use({ viewport });

    test("fits the stage above True and False", async ({ page }) => {
      const cards: { statement: string; appliesTo: string }[] = [];
      for (const file of readdirSync("public/decks")) {
        if (file === "index.json") continue;
        const deck = JSON.parse(readFileSync(`public/decks/${file}`, "utf8")) as { cards: { appliesTo?: string; text: { en: { statement: string } } }[] };
        for (const card of deck.cards) cards.push({ statement: plainText(card.text.en.statement), appliesTo: card.appliesTo ?? "" });
      }
      expect(cards.length).toBeGreaterThan(1000);
      await openPendingRound(page, "classic");
      const answers = await deckAnswers(page, CLF_ID);
      await waitForQuestion(page, answers);
      const over = await page.locator("[data-statement]").evaluate((statement, cards) => {
        const scroller = statement.closest("[data-swipe-card]")?.parentElement;
        const text = statement.lastElementChild;
        if (!scroller || !(text instanceof HTMLElement)) throw new Error("The play screen is not built as expected");
        const visible = scroller.clientHeight - parseFloat(getComputedStyle(scroller).paddingBottom);
        let line = statement.querySelector<HTMLElement>("[data-applies-to]");
        if (line === null) {
          line = document.createElement("p");
          line.style.cssText =
            "margin:0 0 var(--space-6);font-family:var(--type-mono-data-family);font-size:var(--type-mono-data-size);" +
            "line-height:var(--type-mono-data-line-height);font-weight:var(--type-mono-data-weight)";
          statement.insertBefore(line, text);
        }
        const found: string[] = [];
        for (const card of cards) {
          text.textContent = card.statement;
          line.textContent = card.appliesTo;
          line.style.display = card.appliesTo ? "" : "none";
          const span = text.getBoundingClientRect().bottom - (card.appliesTo ? line : text).getBoundingClientRect().top;
          if (span > visible + 0.5) found.push(`${Math.round(span)} > ${visible}: ${card.statement}`);
        }
        return found;
      }, cards);
      expect(over).toEqual([]);
    });
  });
}

// ---------- the start flow ----------

async function tapOption(page: Page, option: string | RegExp, next: string): Promise<void> {
  await tap(page, page.locator("[data-step]:not([inert])").getByRole("button", { name: option }));
  await atStep(page, next);
}

async function chooseByTaps(page: Page): Promise<void> {
  await tapOption(page, CLF_SECURITY.area, "Choose a platform");
  await tapOption(page, CLF_SECURITY.platform, "Choose a deck");
  await tapOption(page, CLF_SECURITY.deck, "Choose a section");
  await tapOption(page, CLF_SECURITY.section ?? "", "Choose how to play");
  await tapOption(page, CLF_SECURITY.mode, "Your pass is ready");
}

const RETURNING = JSON.stringify({
  version: 1,
  cards: {},
  records: {},
  last: { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: 7, total: 10 },
});

// 844 by 390, 734 by 340, 667 by 375 and 640 by 280 are in e2e/small-screens.spec.ts.
for (const viewport of [SIDEWAYS[2], ZOOM_200, ZOOM_300]) {
  test.describe(`the start flow on a ${name(viewport)} screen`, () => {
    test.use({ viewport });

    test("a first-run player fills in the pass and starts the round by touch", async ({ page }) => {
      await page.goto("/");
      await atHome(page);
      await reach(page, page.getByRole("heading", { level: 1, name: "Truthy" }));
      await reach(page, page.getByRole("button", { name: /theme/ }));
      await chooseByTaps(page);
      await reach(page, page.locator("[data-step]:not([inert]) p").first());
      await tap(page, page.getByRole("button", { name: "Start round" }));
      await expect(page).toHaveURL(/\/play$/);
    });

    test("a returning player chooses another route by touch, the continue line taking none of the taps", async ({ page }) => {
      await page.addInitScript((progress) => localStorage.setItem("truthy.progress.v1", progress), RETURNING);
      await page.goto("/");
      await atHome(page);
      await expect(page.getByRole("button", { name: /^Continue: / })).toBeAttached();
      await chooseByTaps(page);
      await tap(page, page.getByRole("button", { name: "Start round" }));
      await expect(page).toHaveURL(/\/play$/);
    });

    test("a returning player continues by touch and starts the round", async ({ page }) => {
      await page.addInitScript((progress) => localStorage.setItem("truthy.progress.v1", progress), RETURNING);
      await page.goto("/");
      await atHome(page);
      await tap(page, page.getByRole("button", { name: /^Continue: AWS Cloud Practitioner, Security and compliance, Classic\./ }));
      await atStep(page, "Your pass is ready");
      await tap(page, page.getByRole("button", { name: "Start round" }));
      await expect(page).toHaveURL(/\/play$/);
    });
  });
}

// ---------- the result ----------

/** A Streak round that ends on its second card: one right, one wrong, so one card to review. */
async function streakEndedOnCard2(page: Page): Promise<void> {
  await openPendingRound(page, "streak");
  const answers = await deckAnswers(page, CLF_ID);
  const first = await waitForQuestion(page, answers);
  await tapAnswer(page, first.truth);
  await page.waitForTimeout(500); // NEXT_ARRIVES_MS: Next card takes presses 420 ms after the answer
  await tap(page, page.getByRole("button", { name: "Next card" }));
  const second = await waitForQuestion(page, answers, first.statement);
  await tapAnswer(page, !second.truth);
  await page.waitForTimeout(500);
  await tap(page, page.getByRole("button", { name: "See results" }));
  await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
  await page.waitForTimeout(1_100); // RESULT_ARRIVES_MS: the actions take presses one second after the result appears
}

for (const viewport of SHORT) {
  test.describe(`the result on a ${name(viewport)} screen`, () => {
    test.use({ viewport });

    test("scrolls as one column: the score, the missed list with its Why, and both actions can be reached, and Play again plays again", async ({ page }) => {
      await streakEndedOnCard2(page);
      const list = page.getByRole("region", { name: "Missed cards" });
      await reach(page, page.getByRole("button", { name: "Close results" }));
      await reach(page, page.locator("[data-comparison]"), true);
      await reach(page, list.getByRole("heading", { name: "Missed cards" }), true);
      await reach(page, list.getByText("1 to review", { exact: true }), true);
      await reach(page, list.getByRole("listitem"), true);
      // Review finding M1: the opened Why scrolls its explanation into view by itself. Its button is put at the foot
      // of the screen first, so the explanation opens below the screen, and nothing else scrolls before it is read.
      const why = list.getByRole("button", { name: /Why/ });
      await why.evaluate((element) => element.scrollIntoView({ block: "end" }));
      await tap(page, why);
      await page.waitForTimeout(400);
      const item = list.getByRole("listitem");
      const itemBox = await item.boundingBox();
      if (itemBox !== null && itemBox.height + 16 <= viewport.height) await inReach(page, item, true);
      else {
        const explanation = await list.getByRole("region", { name: /^Why/ }).locator("p").first().boundingBox();
        expect(explanation, "the opened explanation has a box").not.toBeNull();
        expect(explanation!.y, "the opened explanation starts on screen").toBeGreaterThanOrEqual(-0.5);
        expect(explanation!.y + 22, "its first line is on screen").toBeLessThanOrEqual(viewport.height + 0.5);
      }
      await reach(page, item, true);
      await reach(page, page.getByRole("button", { name: "Choose another route" }));
      await tap(page, page.getByRole("button", { name: "Play again" }));
      await expect(page.getByRole("heading", { name: "Round complete" })).toHaveCount(0);
      await waitForQuestion(page, await deckAnswers(page, CLF_ID));
    });
  });
}

// U81: on the smallest phone held upright the result shows the head of its missed list, "Missed cards" and the
// count, above "Play again" before any scroll. The tallest score blocks: Streak and Three lives.
test.describe("the result on a 320 by 568 screen", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  for (const mode of ["streak", "lives"] as const) {
    test(`${mode}: the Missed cards heading shows above Play again before any scroll`, async ({ page }) => {
      await openPendingRound(page, mode);
      const answers = await deckAnswers(page, CLF_ID);
      let previous: string | undefined;
      for (let n = 1; ; n += 1) {
        previous = (await answerCard(page, answers, n, false, previous)).statement;
        const results = page.getByRole("button", { name: "See results" });
        const next = page.getByRole("button", { name: "Next card" });
        await expect(results.or(next)).toBeVisible();
        if (await results.isVisible()) {
          await results.click();
          break;
        }
        await next.click();
      }
      await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
      await page.waitForTimeout(SETTLE_MS);
      const heading = page.getByRole("region", { name: "Missed cards" }).getByRole("heading", { name: "Missed cards" });
      const head = await heading.boundingBox();
      const pill = await page.getByRole("button", { name: "Play again" }).boundingBox();
      expect(head).not.toBeNull();
      expect(pill).not.toBeNull();
      expect(head!.y).toBeGreaterThanOrEqual(0);
      expect(head!.y + head!.height, "the Missed cards heading ends above Play again").toBeLessThanOrEqual(pill!.y + 0.5);
      expect(await heading.evaluate((element) => element.closest("main")?.querySelector("[data-boarding-pass]")?.parentElement?.scrollTop)).toBe(0);
    });
  }
});
