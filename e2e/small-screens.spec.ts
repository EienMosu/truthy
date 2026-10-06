import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  SETTLE_MS,
  answerCard,
  chooseRoute,
  deckAnswers,
  inClass,
  openHome,
  playRound,
  seeResults,
  setPageHidden,
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

// The last round of each class, as the continue line says it ("21 cards" is the longest score, "Three lives"
// the longest class).
const LAST_ROUNDS = [
  { mode: "classic", score: 7, total: 10, name: "Classic", text: "7 of 10" },
  { mode: "streak", score: 13, total: 14, name: "Streak", text: "13 in a row" },
  { mode: "lives", score: 21, total: 21, name: "Three lives", text: "21 cards" },
  { mode: "timed", score: 14, total: 17, name: "Timed", text: "14 correct" },
] as const;

// Opens step 1 for a returning player whose last round was `last` on CLF / SEC, and checks the continue line
// at rest. Each part of the mono line ([data-continue] route, class, score) is measured by its text against the
// line's clipping box: "whole" means its text runs inside it from start to end (nothing cut, no ellipsis) on a
// line the box shows, "hidden" means it sits on a line the box leaves out. Across, the text itself is measured;
// up and down, the part's line box (the font's content area is a little taller than the 1.27 line height). A separator ("·") is either hidden or follows a part on its own line, never the first thing on a
// line. Half a pixel for subpixel layout.
async function expectReadableContinueLine(
  page: Page,
  last: (typeof LAST_ROUNDS)[number],
  width: number,
  score: "whole" | "whole or hidden",
): Promise<void> {
  await page.addInitScript(
    (stored) => localStorage.setItem("truthy.progress.v1", JSON.stringify({ version: 1, cards: {}, records: {}, last: stored })),
    { route: { deckId: CLF_ID, sectionId: "SEC" }, mode: last.mode, score: last.score, total: last.total },
  );
  await page.goto("/");
  const line = page.getByRole("button", { name: `Continue: AWS Cloud Practitioner, Security and compliance, ${last.name}. Last score ${last.text}.` });
  await expect(line).toBeVisible();
  await expect(line.locator("em")).toHaveText(last.text);
  await page.waitForTimeout(SETTLE_MS);
  await expectNoSidewaysScroll(page);

  const m = await line.evaluate((button) => {
    const rect = (r: DOMRect) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    const clip = button.querySelector<HTMLElement>("[data-continue=line]");
    if (clip === null) throw new Error("No [data-continue=line]");
    const text = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return rect(range.getBoundingClientRect());
    };
    const part = (name: string) => {
      const el = clip.querySelector<HTMLElement>(`[data-continue=${name}]`);
      if (el === null) throw new Error(`No [data-continue=${name}]`);
      return { text: text(el), box: rect(el.getBoundingClientRect()), scroll: el.scrollWidth, client: el.clientWidth };
    };
    const column = clip.parentElement;
    if (column === null) throw new Error("The mono line has no parent");
    return {
      button: rect(button.getBoundingClientRect()),
      column: rect(column.getBoundingClientRect()),
      clip: rect(clip.getBoundingClientRect()),
      route: part("route"),
      mode: part("class"),
      score: part("score"),
      seps: [...clip.querySelectorAll("[data-continue=sep]")].map((el) => rect(el.getBoundingClientRect())),
    };
  });

  // The row stays inside the page and its text inside the 60 px row.
  expect(m.button.left).toBeGreaterThanOrEqual(0);
  expect(m.button.right).toBeLessThanOrEqual(width);
  expect(m.column.top).toBeGreaterThanOrEqual(m.button.top - 0.5);
  expect(m.column.bottom).toBeLessThanOrEqual(m.button.bottom + 0.5);

  type Box = { left: number; right: number; top: number; bottom: number };
  type Part = { text: Box; box: Box; scroll: number; client: number };
  const isWhole = (p: Part) =>
    p.text.right - p.text.left > 0 &&
    p.text.left >= m.clip.left - 0.5 &&
    p.text.right <= Math.min(m.clip.right, p.box.right) + 0.5 &&
    p.box.top >= m.clip.top - 0.5 &&
    p.box.bottom <= m.clip.bottom + 0.5 &&
    p.scroll <= p.client + 1;
  const isHidden = (b: Box) => b.top >= m.clip.bottom - 0.5 || b.right <= m.clip.left + 0.5;

  expect(isWhole(m.route), `the route is shown whole: ${JSON.stringify(m.route)} in ${JSON.stringify(m.clip)}`).toBe(true);
  expect(isWhole(m.mode), `the class is shown whole: ${JSON.stringify(m.mode)} in ${JSON.stringify(m.clip)}`).toBe(true);
  if (score === "whole") {
    expect(isWhole(m.score), `the score is shown whole: ${JSON.stringify(m.score)} in ${JSON.stringify(m.clip)}`).toBe(true);
  } else {
    expect(isWhole(m.score) || isHidden(m.score.box), `the score is whole or hidden: ${JSON.stringify(m.score)} in ${JSON.stringify(m.clip)}`).toBe(true);
  }
  if (isWhole(m.score)) expect(m.score.text.right).toBeLessThanOrEqual(m.button.right - 24);
  for (const sep of m.seps) {
    const shownAfterAPart = sep.left > m.clip.left + 1 && sep.right <= m.clip.right + 0.5 && sep.bottom <= m.clip.bottom + 0.5;
    expect(isHidden(sep) || shownAfterAPart, `a separator is hidden or follows a part: ${JSON.stringify(sep)} in ${JSON.stringify(m.clip)}`).toBe(true);
  }
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

    // The answer slip (explanation and source link) is brought into view above Next card, which is opaque and
    // hides what scrolls under it; the player does not have to scroll (review finding U44).
    await page.getByRole("button", { name: "True", exact: true }).click();
    const next = page.getByRole("button", { name: "Next card" });
    await expect(next).toBeFocused();
    const source = page.getByRole("link", { name: /\(opens in a new tab\)$/ });
    await expect
      .poll(async () => {
        const link = await source.boundingBox();
        const pill = await next.boundingBox();
        return link === null || pill === null ? Infinity : link.y + link.height - pill.y;
      }, { message: "the source link ends above Next card", timeout: 5_000 })
      .toBeLessThanOrEqual(0.5);
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

  // The ready step teaches the swipe in its last sentence. For every class it ends above Start round, which
  // is opaque and would hide what runs under it, and nothing covers its last line (review finding U8).
  for (const name of ["Classic", "Streak", "Three lives", "Timed"] as const) {
    test(`the ready sentence of ${name} ends above Start round`, async ({ page }) => {
      await openHome(page);
      await chooseRoute(page, inClass(CLF_SECURITY, name));
      const pill = page.getByRole("button", { name: "Start round" });
      await expect(pill).toBeInViewport();
      await page.waitForTimeout(600);
      const sentence = page.locator("[data-step]:not([inert]) p").filter({ hasText: "Swipe right for true, left for false." });
      const last = await sentence.evaluate((p) => {
        const range = document.createRange();
        range.selectNodeContents(p);
        const lines = [...range.getClientRects()];
        const line = lines.reduce((a, b) => (b.bottom > a.bottom ? b : a));
        const top = document.elementFromPoint(line.right - 4, line.top + line.height / 2);
        return { bottom: line.bottom, onTop: top !== null && p.contains(top) };
      });
      const pillBox = await pill.boundingBox();
      if (pillBox === null) throw new Error("Start round is not on screen");
      expect(last.bottom, "the last line ends above Start round").toBeLessThanOrEqual(pillBox.y - 8);
      expect(last.onTop, "nothing covers the last line").toBe(true);
    });
  }

  // The continue line after a round of each class: the line stays inside the page and inside its 60 px
  // row, and the route, the class and the score are each shown whole: the score, which no longer fits beside
  // them at this width, takes the second line, never cut and never left behind as a stray "·" (review
  // finding U61).
  for (const last of LAST_ROUNDS) {
    test(`the continue line after a ${last.name} round fits the width`, async ({ page }) => {
      await expectReadableContinueLine(page, last, 320, "whole");
    });
  }
});

// The continue line on the phone the design is drawn for (390), on a common smaller one (360) and at 340 (the
// review found the score left out on every screen under 344): the whole line is readable, the route, the
// class and the last score, each shown whole.
for (const width of [340, 360, 390] as const) {
  test.describe(`the continue line on a ${width} px screen`, () => {
    test.use({ viewport: { width, height: 780 } });

    for (const last of LAST_ROUNDS) {
      test(`after a ${last.name} round it shows the route, the class and the score whole`, async ({ page }) => {
        await expectReadableContinueLine(page, last, width, "whole");
      });
    }
  });
}

// A round handed to /play the way the start flow does (the pending round in sessionStorage), with a record for
// its route and mode already stored (null: none).
async function openRound(page: Page, mode: "classic" | "streak" | "lives" | "timed", record: number | null): Promise<void> {
  await page.addInitScript(
    ({ mode, record }) => {
      const route = { deckId: "aws-clf-c02", sectionId: "SEC" };
      sessionStorage.setItem("truthy.pending.v1", JSON.stringify({ route, mode }));
      if (localStorage.getItem("truthy.progress.v1") === null) {
        const records = record === null ? {} : { [`${route.deckId}/${route.sectionId}#${mode}`]: record };
        localStorage.setItem("truthy.progress.v1", JSON.stringify({ version: 1, cards: {}, records, last: null }));
      }
    },
    { mode, record },
  );
  await page.goto("/play");
}

// Each part of the comparison lies inside the pass and above the opaque "Play again" pill, which hides what
// scrolls under it. Half a pixel for subpixel layout.
async function expectInPassAbovePill(page: Page, parts: readonly Locator[]): Promise<void> {
  const pass = await page.locator("[data-boarding-pass]").boundingBox();
  const pill = await page.getByRole("button", { name: "Play again" }).boundingBox();
  if (pass === null || pill === null) throw new Error("The pass or the Play again pill is not on screen");
  for (const element of parts) {
    await expect(element).toBeVisible();
    const box = await element.boundingBox();
    if (box === null) throw new Error("A part of the comparison is not on screen");
    expect(box.x).toBeGreaterThanOrEqual(pass.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(pass.x + pass.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(pill.y + 0.5);
  }
}

// The New best moment of the result (spec section 6) on a 320 px phone: the stamp and the "Previous best"
// line stay inside the pass when the score has a unit and two digits, and above "Play again" once the result
// has brought them into view. The record stored is one below the score. Reduced motion shows the stamp at
// rest, where it is measured.
test.describe("the New best of a result on a 320 by 568 screen", () => {
  test.use({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce" });

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
    await expectInPassAbovePill(page, [page.locator("[data-new-best]"), page.getByText(/^Previous best /)]);
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
      const lifeNews = n === 6 ? " Life lost, 2 left." : n === 15 ? " Last life." : n === 21 ? " Out of lives." : "";
      await expect(verdict(page)).toHaveText(`${verdictFor(given, truth)}${lifeNews}`);
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

// The other comparisons of a Classic result on a 320 px phone stay beside the score, whole and above "Play
// again", without a scroll.
test.describe("the comparison of a Classic result on a 320 by 568 screen", () => {
  test.use({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce" });

  test("1 short of your best, with Best 10 / 10 under it", async ({ page }) => {
    await openRound(page, "classic", 10);
    await playRound(page, CLF_ID, wrongOn(4));
    await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
    await expect(page.locator("[data-score]")).toHaveText("9 of 10");
    await expect(page.locator("[data-comparison]")).toHaveText(/^1 short of your best\s*Best 10 \/ 10$/);
    await expectInPassAbovePill(page, [page.locator("[data-comparison]")]);
    await expectNoSidewaysScroll(page);
  });

  test("First round on this route", async ({ page }) => {
    await openRound(page, "classic", null);
    await playRound(page, CLF_ID, wrongOn());
    await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
    await expect(page.locator("[data-comparison]")).toHaveText("First round on this route");
    await expectInPassAbovePill(page, [page.locator("[data-comparison]")]);
    await expectNoSidewaysScroll(page);
  });
});

// The New best stamp lands where the player can see it: on a 320 by 568 phone the result scrolls the wrapped
// comparison into view before the landing, and the stamp comes to rest above "Play again".
test.describe("the New best landing on a 320 by 568 screen", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("Classic 10 of 10 over a record of 9", async ({ page }) => {
    await openRound(page, "classic", 9);
    await playRound(page, CLF_ID, wrongOn());
    await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
    const stamp = page.locator("[data-new-best]");
    // At rest: the landing (380 ms delay, 420 ms) is over and the stamp is no longer scaled.
    await expect
      .poll(async () => (await stamp.boundingBox())?.height ?? 0, { timeout: 5_000 })
      .toBeLessThan(80);
    await page.waitForTimeout(SETTLE_MS);
    await expectInPassAbovePill(page, [stamp, page.getByText(/^Previous best /)]);
    await expectNoSidewaysScroll(page);
  });
});

// The parts of a ticket that must be seen lie inside the screen and above the action row, which covers what
// scrolls under it (the pills dim to 0.45 during the Timed beat), and the ticket ends above the row, so none
// of its text shows through the pills. Half a pixel for subpixel layout. Polled: the ticket may still be
// scrolling there and the stamp landing.
async function expectAboveActionRow(page: Page, parts: readonly Locator[], action: Locator): Promise<void> {
  const row = await action.boundingBox();
  if (row === null) throw new Error("The action row is not on screen");
  for (const part of parts) {
    await expect
      .poll(async () => {
        const box = await part.boundingBox();
        return box !== null && box.y >= -0.5 && box.y + box.height <= row.y + 0.5;
      }, { message: `${part} lies inside the screen and above the action row`, timeout: 5_000 })
      .toBe(true);
  }
  await expect
    .poll(async () => {
      const pass = await page.locator("[data-boarding-pass]").last().boundingBox();
      return pass === null ? Infinity : pass.y + pass.height - row.y;
    }, { message: "the ticket ends above the action row", timeout: 5_000 })
    .toBeLessThanOrEqual(0.5);
}

/** How far the ticket of the play screen is scrolled. */
async function ticketScroll(page: Page): Promise<number> {
  return page.locator("[data-swipe-card]").evaluate((card) => card.parentElement?.scrollTop ?? -1);
}

// Timed on the smallest phone: the ticket is taller than the stage, so while a card is a question its stub
// lies under the answer row. When the stub is stamped (an answer, or time up) the ticket scrolls to its end:
// the stamp and its hint show above the row, and nothing of the ticket is left under the dimmed pills. The
// next card glides back up to its statement. A hidden page holds the beat while the boxes are measured.
test.describe("the Timed stamp on a 320 by 568 screen", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("the stamp and its hint show above the answer row, and the next card glides back up to its statement", async ({ page }) => {
    await openRound(page, "timed", null);
    const answers = await deckAnswers(page, CLF_ID);
    await expect(page.locator("[data-statement]")).toBeFocused();
    const first = await answerCard(page, answers, 1, true);
    await setPageHidden(page, true);
    const stamp = page.locator('[data-stub-stamp="correct"]');
    await expect(stamp).toBeVisible();
    const trueButton = page.getByRole("button", { name: "True", exact: true });
    await expectAboveActionRow(page, [stamp, page.locator("[data-hint]")], trueButton);
    await expectNoSidewaysScroll(page);

    await setPageHidden(page, false);
    await expect(page.locator("[data-card-announcer]")).toHaveText(/^Card 2\. /);
    await expect.poll(() => statementOnScreen(page)).not.toBe(first.statement);
    // The ticket glides back up for the new card: to its top, or on this short stage only as far as lets the
    // statement's text end above True and False (review finding U49), never left at the stub.
    await expect
      .poll(async () => {
        const stage = await page.getByRole("region", { name: "Card" }).boundingBox();
        const row = await trueButton.boundingBox();
        const text = await page.locator("[data-statement]").last().evaluate((block) => ({
          top: block.firstElementChild?.getBoundingClientRect().top ?? NaN,
          bottom: block.lastElementChild?.getBoundingClientRect().bottom ?? NaN,
        }));
        return stage !== null && row !== null && text.top >= stage.y - 0.5 && text.bottom <= row.y + 0.5;
      }, { message: "the new statement lies in the stage, above True and False", timeout: 5_000 })
      .toBe(true);
    expect(await ticketScroll(page)).toBeLessThan(await page.locator("[data-swipe-card]").evaluate((card) => {
      const scroller = card.parentElement;
      return scroller ? scroller.scrollHeight - scroller.clientHeight : 0;
    }));
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("Time is up and its hint show above See results, and the result labels keep their numbers", async ({ page }) => {
      await page.clock.install();
      await openRound(page, "timed", null);
      await expect(page.getByRole("button", { name: "True", exact: true })).toBeVisible();
      await page.clock.runFor(61_000);
      const stamp = page.locator('[data-stub-stamp="time-up"]');
      await expect(stamp).toBeVisible();
      await expectAboveActionRow(
        page,
        [stamp, page.getByText("This card doesn't count · 0 answered")],
        page.getByRole("button", { name: "See results" }),
      );
      await seeResults(page);
      await expectLabelsWhole(page);
    });
  });
});

// The label row of a header at 320: each label stays on one line with its number ("Ended · 5 cards", never
// "Ended · 5" over "cards"); when the two do not fit side by side, the row wraps between them.
async function expectLabelsWhole(page: Page): Promise<void> {
  const header = page.locator("[data-flight-path]");
  for (const name of ["progress", "tally"]) {
    const label = header.locator(`[data-${name}]`);
    await expect(label).toBeVisible();
    const m = await label.evaluate((element) => {
      const row = element.parentElement?.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return { lines: box.height / parseFloat(getComputedStyle(element).lineHeight), left: box.left, right: box.right, row: row ? { left: row.left, right: row.right } : null };
    });
    expect(m.lines, `[data-${name}] is one line`).toBeLessThan(1.5);
    if (m.row === null) throw new Error("The label has no row");
    expect(m.left).toBeGreaterThanOrEqual(m.row.left - 0.5);
    expect(m.right).toBeLessThanOrEqual(m.row.right + 0.5);
  }
}

test.describe("the header labels of a result on a 320 by 568 screen", () => {
  test.use({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce" });

  test("a Streak that ends on card 5: Ended · 5 cards and 4 correct · 1 wrong, each on one line", async ({ page }) => {
    await openRound(page, "streak", null);
    const answers = await deckAnswers(page, CLF_ID);
    let previous: string | undefined;
    for (let n = 1; n <= 5; n += 1) {
      previous = (await answerCard(page, answers, n, n < 5, previous)).statement;
      await page.getByRole("button", { name: n < 5 ? "Next card" : "See results" }).click();
    }
    await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
    await expect(page.locator("[data-flight-path] [data-progress]")).toHaveText("Ended · 5 cards");
    await expect(page.locator("[data-flight-path] [data-tally]")).toHaveText("4 correct · 1 wrong");
    await expectLabelsWhole(page);
    await expectNoSidewaysScroll(page);
  });
});

// The result on the smallest phone shows the start of the missed-card list ("N to review", or "No missed
// cards") above "Play again" before any scroll, so the player sees the list is there: on a screen 600 px tall
// or less the ticket leaves out the names under the codes (review finding U81). Measured at rest.
test.describe("the missed list of a result on a 320 by 568 screen", () => {
  test.use({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce" });

  async function expectListHeadAbovePill(page: Page, head: string): Promise<void> {
    await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
    await page.waitForTimeout(SETTLE_MS);
    const scrolled = await page.locator("[data-boarding-pass]").locator("..").evaluate((scroller) => scroller.scrollTop);
    expect(scrolled).toBe(0);
    await expectInPassAbovePill(page, [page.getByRole("region", { name: "Missed cards" }).getByText(head, { exact: true })]);
    await expectNoSidewaysScroll(page);
  }

  // A round that ends after `n` cards, each answered right or wrong as `right(card)` says.
  async function playShort(page: Page, n: number, right: (card: number) => boolean): Promise<void> {
    const answers = await deckAnswers(page, CLF_ID);
    let previous: string | undefined;
    for (let card = 1; card <= n; card += 1) {
      previous = (await answerCard(page, answers, card, right(card), previous)).statement;
      await page.getByRole("button", { name: card < n ? "Next card" : "See results" }).click();
    }
  }

  test("Classic with two missed cards: 2 to review", async ({ page }) => {
    await openRound(page, "classic", null);
    await playRound(page, CLF_ID, wrongOn(1, 2));
    await expectListHeadAbovePill(page, "2 to review");
  });

  test("Classic with none missed: No missed cards", async ({ page }) => {
    await openRound(page, "classic", 10);
    await playRound(page, CLF_ID, wrongOn());
    await expectListHeadAbovePill(page, "No missed cards");
  });

  test("Streak ended on card 3: 1 to review", async ({ page }) => {
    await openRound(page, "streak", null);
    await playShort(page, 3, (card) => card < 3);
    await expectListHeadAbovePill(page, "1 to review");
  });

  test("Three lives out on card 3: 3 to review", async ({ page }) => {
    await openRound(page, "lives", null);
    await playShort(page, 3, () => false);
    await expectListHeadAbovePill(page, "3 to review");
  });
});

// Taller screens keep the approved ticket: the names under the codes stay on the result.
for (const viewport of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
]) {
  test.describe(`the result ticket on a ${viewport.width} by ${viewport.height} screen`, () => {
    test.use({ viewport, reducedMotion: "reduce" });

    test("keeps the names under the codes", async ({ page }) => {
      await openRound(page, "streak", null);
      const answers = await deckAnswers(page, CLF_ID);
      await answerCard(page, answers, 1, false);
      await page.getByRole("button", { name: "See results" }).click();
      await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
      await expect(page.locator('[data-leg="from"] > span').nth(1)).toHaveText("AWS Cloud Practitioner");
      await expect(page.locator('[data-leg="from"] > span').nth(1)).toBeVisible();
      await expect(page.locator('[data-leg="to"] > span').nth(1)).toHaveText("Security and compliance");
      await expect(page.locator('[data-leg="to"] > span').nth(1)).toBeVisible();
    });
  });
}

// The route of the header stays where it is when its labels wrap at 320 ("Card 10 of 10" beside "10 correct
// · 0 wrong" as the tenth verdict lands, "Streak ended at 11" beside "Previous best 10"): the header centres a
// frame one label line tall, and a second line hangs below it, above the ticket.
test.describe("the route of the header on a 320 by 568 screen", () => {
  test.use({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce" });

  async function routeTop(page: Page): Promise<number> {
    const box = await page.locator("[data-flight-path] svg").boundingBox();
    if (box === null) throw new Error("The route is not on screen");
    return box.y;
  }

  // The label row ends above the ticket where it shows: its top, or the top of the stage once an answer has
  // scrolled the slip into view (review finding U44) and the top of the pass lies above the stage, clipped.
  async function expectLabelsAboveTicket(page: Page): Promise<void> {
    const labels = await page.locator("[data-flight-path] [data-progress]").evaluate((element) => element.parentElement?.getBoundingClientRect().bottom ?? 0);
    const pass = await page.locator("[data-boarding-pass]").last().boundingBox();
    const stage = await page.getByRole("region", { name: "Card" }).boundingBox();
    if (pass === null || stage === null) throw new Error("The pass is not on screen");
    expect(labels).toBeLessThanOrEqual(Math.max(pass.y, stage.y) + 0.5);
  }

  test("a perfect Classic round: the route does not move on the verdict of card 10", async ({ page }) => {
    await openRound(page, "classic", null);
    const answers = await deckAnswers(page, CLF_ID);
    await waitForCard(page, answers, 1);
    const atStart = await routeTop(page);
    for (let n = 1; n <= 10; n += 1) {
      const { truth } = await waitForCard(page, answers, n);
      await page.getByRole("button", { name: truth ? "True" : "False", exact: true }).click();
      await expect(verdict(page)).toHaveText(verdictFor(truth, truth));
      if (n < 10) await page.getByRole("button", { name: "Next card" }).click();
    }
    await expect(page.locator("[data-flight-path] [data-tally]")).toHaveText("10 correct · 0 wrong");
    expect(await routeTop(page)).toBeCloseTo(atStart, 1);
    await expectLabelsAboveTicket(page);
  });

  test("a Streak that passes the best and ends: the route does not move on the deciding answer", async ({ page }) => {
    await openRound(page, "streak", 10);
    const answers = await deckAnswers(page, CLF_ID);
    let previous: string | undefined;
    let atStart: number | null = null;
    for (let n = 1; n <= 12; n += 1) {
      if (atStart === null) {
        await expect(page.locator("[data-statement]")).toBeFocused();
        atStart = await routeTop(page);
      }
      previous = (await answerCard(page, answers, n, n < 12, previous)).statement;
      if (n < 12) await page.getByRole("button", { name: "Next card" }).click();
    }
    await expect(page.locator("[data-flight-path] [data-progress]")).toHaveText("Streak ended at 11");
    await expect(page.locator("[data-flight-path] [data-tally]")).toHaveText("Previous best 10");
    expect(await routeTop(page)).toBeCloseTo(atStart ?? Number.NaN, 1);
    await expectLabelsAboveTicket(page);
  });
});

// A statement with one long word (a real Next.js card: "suppressHydrationWarning", 24 characters) wraps
// inside its own paragraph; the pass keeps the width of the card, so SEC, Gate and the stub are not cut off
// on the right. A sideways scroll check cannot see this: the card's scroller clips what sticks out. The word
// itself breaks where it must, so its text ends inside the paragraph and is not cut at the pass edge (review
// finding U54).
const LONG_WORD_STATEMENT = "suppressHydrationWarning repairs mismatched text during hydration.";

/** The paragraph's overflow and how far its text runs past its right edge (0 or less: inside). */
async function textOverflow(paragraph: Locator): Promise<{ scroll: number; client: number; pastRight: number }> {
  return paragraph.evaluate((p) => {
    const range = document.createRange();
    range.selectNodeContents(p);
    const right = Math.max(...[...range.getClientRects()].map((r) => r.right));
    return { scroll: p.scrollWidth, client: p.clientWidth, pastRight: right - p.getBoundingClientRect().right };
  });
}

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
      // The long word breaks inside the paragraph: nothing of it runs past the paragraph's right edge.
      const overflow = await textOverflow(page.locator("[data-statement] > p").last());
      expect(overflow.scroll, "the paragraph is not wider than its box").toBeLessThanOrEqual(overflow.client);
      expect(overflow.pastRight, "the text ends inside the paragraph").toBeLessThanOrEqual(0.5);
    });
  });
}

// A phone held sideways, and a page zoomed to 200 percent and more: under 568 tall the fixed start layout does
// not fit, so the start screen scrolls as one column (review finding U79). A player reaches every control the
// way a finger does: dragging the middle of the screen, which scrolls the scroll container under the finger if
// there is one a finger can scroll, until the control is wholly on screen and on top where it is tapped, then
// tapping it. Nothing scrolls it into view for them, as Playwright's own tap() would (it also scrolls boxes
// with overflow: hidden). Mobile WebKit has no wheel, so the drag is played as a scrollBy on that container.
async function dragPage(page: Page, dy: number): Promise<void> {
  await page.evaluate((delta) => {
    let node: Element | null = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    for (; node !== null; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) {
        node.scrollBy(0, delta);
        return;
      }
    }
    const root = getComputedStyle(document.documentElement).overflowY;
    const body = getComputedStyle(document.body).overflowY;
    if (root !== "hidden" && body !== "hidden") window.scrollBy(0, delta);
  }, dy);
}

async function tapLikeAPlayer(page: Page, target: Locator): Promise<void> {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("No viewport");
  for (let tries = 0; tries < 30; tries += 1) {
    const box = await target.boundingBox();
    if (box !== null && box.y >= 0 && box.y + box.height <= viewport.height) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const onTop = await target.evaluate((element, [px, py]) => {
        const top = document.elementFromPoint(px ?? 0, py ?? 0);
        return top !== null && (top === element || element.contains(top));
      }, [x, y]);
      if (onTop) {
        await page.touchscreen.tap(x, y);
        return;
      }
    }
    await dragPage(page, box !== null && box.y < 0 ? -80 : 80);
    await page.waitForTimeout(80);
  }
  throw new Error(`A player cannot reach ${String(target)}: it never comes wholly on screen and on top`);
}

async function tapThrough(page: Page, steps: readonly [string | RegExp, string][]): Promise<void> {
  for (const [name, next] of steps) {
    await tapLikeAPlayer(page, page.locator("[data-step]:not([inert])").getByRole("button", { name }));
    await expect(page.locator("[data-step]:not([inert]) h2")).toHaveText(next);
    await page.waitForTimeout(SETTLE_MS);
  }
}

const ROUTE_BY_TAPS: readonly [string | RegExp, string][] = [
  [CLF_SECURITY.area, "Choose a platform"],
  [CLF_SECURITY.platform, "Choose a deck"],
  [CLF_SECURITY.deck, "Choose a section"],
  [CLF_SECURITY.section ?? "", "Choose how to play"],
  [CLF_SECURITY.mode, "Your pass is ready"],
];

for (const viewport of [
  { width: 844, height: 390 },
  { width: 734, height: 340 },
  { width: 667, height: 375 },
  { width: 640, height: 280 },
]) {
  test.describe(`a phone turned sideways, ${viewport.width} by ${viewport.height}`, () => {
    test.use({ viewport });

    test("a first-run player chooses a route and starts the round by touch", async ({ page }) => {
      await openHome(page);
      await tapThrough(page, ROUTE_BY_TAPS);
      await tapLikeAPlayer(page, page.getByRole("button", { name: "Start round" }));
      await expect(page).toHaveURL(/\/play$/);
    });

    test("a returning player chooses a route by touch, and the continue line does not take the taps", async ({ page }) => {
      await page.addInitScript(() =>
        localStorage.setItem(
          "truthy.progress.v1",
          JSON.stringify({ version: 1, cards: {}, records: {}, last: { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: 7, total: 10 } }),
        ),
      );
      await openHome(page);
      await expect(page.getByRole("button", { name: /^Continue: / })).toBeAttached();
      await tapThrough(page, ROUTE_BY_TAPS);
      await tapLikeAPlayer(page, page.getByRole("button", { name: "Start round" }));
      await expect(page).toHaveURL(/\/play$/);
    });

    // A step that arrives starts at the top of the column, which brings the Back pill and the pass under the
    // finger: the second tap of a double tap must not take a way back the player has not seen (fix round 1).
    test("a double tap on a card the player scrolled to chooses it once, and does not go back", async ({ page }) => {
      await openHome(page);
      await tapThrough(page, ROUTE_BY_TAPS.slice(0, 1));
      const card = page.locator("[data-step]:not([inert])").getByRole("button", { name: CLF_SECURITY.platform });
      // The finger goes where the Area field of the pass lies while the column is at its top, so the step that
      // arrives brings that way back under it, whatever the frame's padding on a short screen.
      const areaField = await page.getByRole("button", { name: /^Change area, now / }).boundingBox();
      if (areaField === null) throw new Error("The Area field is not on screen");
      const tapY = Math.round(areaField.y + areaField.height / 2);
      // The cards of the step that arrived rise 24 px into place, one after another (about 400 ms in all, more
      // on a busy runner): scroll only once this one has stopped, or the scroll is off by what it had left to
      // rise (6.7 px in CI). Stopped means the same place for five frames in a row.
      await card.evaluate(
        (element, y) =>
          new Promise<void>((resolve, reject) => {
            const main = element.closest("main");
            if (!main) throw new Error("No main");
            const t0 = performance.now();
            let last = Number.NaN;
            let still = 0;
            const frame = () => {
              const top = element.getBoundingClientRect().top;
              still = Math.abs(top - last) < 0.01 ? still + 1 : 0;
              last = top;
              if (still >= 5) {
                main.scrollTop += top - (y - 30);
                resolve();
              } else if (performance.now() - t0 > 5_000) reject(new Error("The platform card never stopped moving"));
              else requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
          }),
        tapY,
      );
      await expect
        .poll(async () => Math.abs(((await card.boundingBox())?.y ?? Number.POSITIVE_INFINITY) - (tapY - 30)), {
          message: "the card was scrolled to the tap",
        })
        .toBeLessThan(2);
      const b = await card.boundingBox();
      if (b === null) throw new Error("The platform card is not on screen");
      const x = b.x + b.width / 2;
      await page.touchscreen.tap(x, tapY);
      await page.waitForTimeout(100);
      const under = await page.evaluate(([px, py]) => document.elementFromPoint(px ?? 0, py ?? 0)?.closest("header button")?.getAttribute("aria-label") ?? null, [x, tapY]);
      expect(under, "a way back of the pass lies under the finger after the first tap").toMatch(/^(Change |Back to )/);
      await page.touchscreen.tap(x, tapY);
      await page.waitForTimeout(400);
      await expect(page.locator("[data-step]:not([inert]) h2")).toHaveText("Choose a deck");
    });

    // Going back focuses the card chosen before; the column starts at its top, so that card is brought into view
    // (with its focus ring) rather than left below the fold (fix round 1).
    test("going back with Escape shows the card it focuses", async ({ page }) => {
      await openHome(page);
      await tapThrough(page, [...ROUTE_BY_TAPS.slice(0, 4), [/^Timed\. /, "Your pass is ready"]]);
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-step]:not([inert]) h2")).toHaveText("Choose how to play");
      await page.waitForTimeout(600);
      const timed = page.locator("[data-step]:not([inert])").getByRole("button", { name: /^Timed\. / });
      await expect(timed).toBeFocused();
      const b = await timed.boundingBox();
      if (b === null) throw new Error("The Timed card has no box");
      expect(b.y, "the top of the focused card is on screen").toBeGreaterThanOrEqual(0);
      expect(b.y + b.height, "the bottom of the focused card is on screen").toBeLessThanOrEqual(viewport.height);
    });

    // Going back by a tap keeps the column at its top, so the Back pill stays under the finger: "Back, Back" at a
    // normal pace goes back two steps and never lands on a card the column moved there (fix round 2). Only a way
    // back from the keyboard brings the focused card into view (the test above).
    async function backTwiceByTouch(page: Page, from: string): Promise<void> {
      const back = page.getByRole("button", { name: /^Back to / });
      const b = await back.boundingBox();
      if (b === null) throw new Error("The Back pill is not on screen");
      const x = b.x + b.width / 2;
      const y = b.y + b.height / 2;
      expect(y, "the Back pill is on screen").toBeLessThan(viewport.height);
      await page.touchscreen.tap(x, y);
      await expect(page.locator("[data-step]:not([inert]) h2")).not.toHaveText(from);
      await page.waitForTimeout(150);
      const under = await page.evaluate(([px, py]) => document.elementFromPoint(px ?? 0, py ?? 0)?.closest("button")?.getAttribute("aria-label") ?? null, [x, y]);
      expect(under, "the Back pill is still under the finger after the first tap").toMatch(/^Back to /);
      await page.waitForTimeout(200); // the second tap comes 350 ms after the first
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(500);
    }

    test("tapping Back twice from the ready step goes back two steps", async ({ page }) => {
      await openHome(page);
      await tapThrough(page, [...ROUTE_BY_TAPS.slice(0, 4), [/^Timed\. /, "Your pass is ready"]]);
      await backTwiceByTouch(page, "Your pass is ready");
      await expect(page.locator("[data-step]:not([inert]) h2")).toHaveText("Choose a section");
    });

    test("after a way back by the keyboard, tapping Back twice still goes back two steps", async ({ page }) => {
      await openHome(page);
      await tapThrough(page, [...ROUTE_BY_TAPS.slice(0, 4), [/^Timed\. /, "Your pass is ready"]]);
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-step]:not([inert]) h2")).toHaveText("Choose how to play");
      await page.waitForTimeout(SETTLE_MS);
      await tapThrough(page, [[/^Timed\. /, "Your pass is ready"]]);
      await backTwiceByTouch(page, "Your pass is ready");
      await expect(page.locator("[data-step]:not([inert]) h2")).toHaveText("Choose a section");
    });

    test("a returning player continues and starts the round by touch", async ({ page }) => {
      await page.addInitScript(() =>
        localStorage.setItem(
          "truthy.progress.v1",
          JSON.stringify({ version: 1, cards: {}, records: {}, last: { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: 7, total: 10 } }),
        ),
      );
      await openHome(page);
      await page.waitForTimeout(SETTLE_MS);
      await tapLikeAPlayer(page, page.getByRole("button", { name: /^Continue: AWS Cloud Practitioner, Security and compliance, Classic\./ }));
      await expect(page.locator("[data-step]:not([inert]) h2")).toHaveText("Your pass is ready");
      await page.waitForTimeout(SETTLE_MS);
      await tapLikeAPlayer(page, page.getByRole("button", { name: "Start round" }));
      await expect(page).toHaveURL(/\/play$/);
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
