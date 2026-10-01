### Task 13: End to end, the mockups, the documents

The last task proves step 2 the way a player meets it and writes down what was decided. It adds the end-to-end specs spec section 11 asks for ("each mode's ending", in phone-sized Chromium and WebKit), one mode at night, the reduced-motion Timed stamp, the back gesture in every mode and the small-section case; compares the nine new screens with their mockups at 390 by 844; and updates the specification, the design system, the token and the testing note. No application code changes here: if a spec fails on the real code it has found a defect, which is fixed in the component with a failing unit test first and committed on its own.

**How the Timed specs handle the minute.** Playwright's page clock (`page.clock`, in @playwright/test 1.63) replaces `Date.now` and the timers of the page. It was tried against this app in both browsers: after `page.clock.install()` the page runs in real time as before (a whole round plays), `page.clock.runFor(60_000)` fires the 100 ms ticker 600 times and moves `Date.now` by a minute within a few seconds, and `page.clock.fastForward(ms)` jumps the time while firing each due timer at most once, which is exactly a phone that slept without a visibility event. Install the clock before `page.goto`.

**Files:**
- Modify: `e2e/helpers.ts`, `e2e/leave.spec.ts`, `e2e/night.spec.ts`
- Create: `e2e/streak.spec.ts`, `e2e/lives.spec.ts`, `e2e/timed.spec.ts`
- Modify (documents): `docs/superpowers/specs/2026-10-01-truthy-design.md` (sections 6 and 11), `design/system/DESIGN-SYSTEM.md` (5.7, 5.10, 5.11, 5.14, 7, 10), `design/system/tokens.json` (`motion.duration.hold-timed`), `docs/testing.md`
- Temporary, never committed: `compare-shoot.mjs` (step 9)

**Interfaces:**
- Consumes (accessible names and hooks of tasks 7 to 12):
  - Class cards: "Streak. Keep going until the first wrong answer. …", "Three lives. The round ends on the third wrong answer. …", "Timed. 60 seconds, as many cards as you can. …", each ending "Not played yet." or "Your best: N {in a row | cards | correct}."
  - Play: buttons "True", "False", "Next card", "See results", "Leave round"; the header `role="img"` named "Streak of N correct answers…" / "Streak ended at N…", "N of 3 lives left. …" / "No lives left. …", "N seconds left of 60. …" / "No time left. …"; the live region in `main` (`verdict(page)`); `[data-statement]`, `[data-muted]`, `[data-verdict="new-best"]`, `[data-stub-stamp="correct" | "wrong" | "time-up"]`, `[data-heart="full" | "lost"]`, `[data-slip]`, `[data-stub]`.
  - Result: heading "Round complete" (focused), `[data-score]`, `[data-comparison]`, the region "Missed cards", "Play again", "Choose another route", "Close results".
  - Start: the continue line "Continue: {deck}, {section}, {class}. Last score {text}."
  - `e2e/helpers.ts` as task 7 left it: `RoutePick`, `CLF_SECURITY`, `CLF_ID`, `openHome`, `chooseRoute`, `startRound`, `deckAnswers`, `statementOnScreen`, `verdict`, `verdictFor`, `expectMissed`, `SETTLE_MS`, `expectThemePage`, `expectPass`, `tokenRgb`, `computed`, `type Played`.
  - Changed: `computed(locator, property)` also takes the properties `"fill"` and `"stroke"` (the night spec reads SVG paint).
- Produces (`e2e/helpers.ts`), complete:

```ts
export type ClassName = "Classic" | "Streak" | "Three lives" | "Timed";

/** The same route played in another class. */
export function inClass(pick: RoutePick, name: ClassName): RoutePick {
  return { ...pick, mode: new RegExp(`^${name}\\. `) };
}

/** Frontend, Next.js, Rendering, "How a request renders": an eleven card section, the smallest kind of route. */
export const RND_REQUEST: RoutePick = {
  area: /^Frontend, \d+ decks?$/,
  platform: /^Next\.js, \d+ decks?$/,
  deck: /^RND, Rendering, \d+ cards, /,
  section: /^REQ, How a request renders, 11 cards$/,
  mode: /^Classic\. /,
};
export const RND_ID = "nextjs-rendering";

/**
 * Waits until the card on screen can be answered, in any mode: True is there and takes presses, no action
 * row is in its place, and the settle time has passed. It does not read the header (each mode has its own)
 * and does not wait for focus (in Timed only the first card takes it). Returns the statement and its answer.
 */
export async function waitForQuestion(page: Page, answers: Map<string, boolean>, previous?: string): Promise<{ statement: string; truth: boolean }> {
  const trueButton = page.getByRole("button", { name: "True", exact: true });
  await expect(trueButton).toBeVisible();
  await expect(trueButton).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: /^(Next card|See results)$/ })).toHaveCount(0);
  if (previous !== undefined) await expect.poll(() => statementOnScreen(page)).not.toBe(previous);
  await page.waitForTimeout(SETTLE_MS);
  const statement = await statementOnScreen(page);
  const truth = answers.get(statement);
  if (truth === undefined) throw new Error(`The statement on screen is not in the deck file: "${statement}"`);
  return { statement, truth };
}

/** Answers the card on screen right or wrong with the buttons. `number` is its place in the round, for expectMissed. */
export async function answerCard(page: Page, answers: Map<string, boolean>, number: number, right: boolean, previous?: string): Promise<Played> {
  const { statement, truth } = await waitForQuestion(page, answers, previous);
  const given = right ? truth : !truth;
  await page.getByRole("button", { name: given ? "True" : "False", exact: true }).click();
  return { number, statement, truth, given };
}

/** "See results", then the result screen with its heading focused. */
export async function seeResults(page: Page): Promise<void> {
  await page.getByRole("button", { name: "See results" }).click();
  await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
}

/** Tells the page it is hidden or shown, as the browser does when the player switches apps or locks the phone. */
export async function setPageHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((isHidden) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (isHidden ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

/** The stored progress of the page (truthy.progress.v1), parsed. */
export async function storedProgress(page: Page): Promise<{ records: Record<string, number>; cards: Record<string, unknown>; last: unknown }> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("truthy.progress.v1") ?? '{"records":{},"cards":{},"last":null}'));
}
```

**Specs.** Every file starts with `test.use({ reducedMotion: "no-preference" })` unless it says otherwise, and every round starts with `openHome`, `chooseRoute(page, inClass(...))`, `startRound`. A spec that plays more than one round calls `test.slow()`.

`e2e/streak.spec.ts`:
1. "a Streak round ends on the first wrong answer and shows its result": CLF Security in Streak. The header is named "Streak of 0 correct answers." Three right answers, each followed by the verdict "Correct. The answer is …" and "Next card"; the header reads `/^Streak of 3 correct answers/`. The fourth answer wrong: the header `/^Streak ended at 3/`, "See results" is there and "Next card" is not. `seeResults`: `[data-score]` reads "3", "Correct in a row" is visible, `[data-comparison]` "First round on this route", `expectMissed` with the four played cards, the header named "Streak over on card 4. 3 correct in a row. Card 4 was wrong." "Play again": the header "Streak of 0 correct answers. Your best on this route is 3."
2. "passing the best shows New best on the slip, then on the result, and the start flow remembers it" (`test.slow()`): round one: two right, one wrong, results. "Play again": answers one and two show `[data-verdict="correct"]`; answer three shows `[data-verdict="new-best"]` with the text "Correct. New best" and the status "Correct. The answer is … New best."; then a wrong answer and results: `[data-comparison]` contains "New best" and "Previous best 2". "Choose another route": the continue line is named "Continue: Cloud Practitioner, Security and compliance, Streak. Last score 3 in a row."; on the class step the Streak card ends "Your best: 3 in a row."
3. "a double tap on the wrong answer keeps the verdict" (for gaps of 150 and 300 ms, as `e2e/double-tap.spec.ts` does with `page.touchscreen.tap` on the button's centre): after the two taps the URL is still `/play`, the verdict is "Not quite. The answer is …", "See results" is visible and the heading "Round complete" is not; a tap after 500 ms opens the result.

`e2e/lives.spec.ts`:
1. "a Three lives round ends on the third wrong answer": CLF Security in Three lives. The header "3 of 3 lives left. No cards answered yet." and three `[data-heart="full"]`. Wrong on cards 2, 4 and 5 of five: after card 2 the header starts "2 of 3 lives left." and the hearts are full, full, lost; after card 4 "1 of 3 lives left."; cards 1 to 4 go on with "Next card"; after card 5 the header is "No lives left. The round is over after 5 cards: cards 2, 4 and 5 were wrong.", three lost hearts, only "See results". Result: `[data-score]` "5 cards", the fields show "Correct" "02" and "Missed" "03", the header "Out of lives after 5 cards. 2 correct, 3 wrong: cards 2, 4 and 5.", `expectMissed`, and in the stored progress `records["aws-clf-c02/SEC#lives"]` is 5.
2. "an eleven card section goes on after its last card" (`test.slow()`): `inClass(RND_REQUEST, "Three lives")`, answers from `deckAnswers(page, RND_ID)`. Thirteen right answers with "Next card" between them, collecting the statements: the first eleven are eleven different statements; the twelfth equals the first and the thirteenth the second (the route repeats in its first order); the header reads "3 of 3 lives left. 13 cards answered."

`e2e/timed.spec.ts`, complete (the clock handling is the subtle part). Real time also passes while a spec runs, so the specs compare seconds with a margin instead of exact clock texts, and they look at a stamp while the page is "hidden": a hidden page pauses the 700 ms beat, so the stamp stays for as long as the assertions need.

```ts
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
  await expect(page.getByRole("button", { name: "True", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "False", exact: true })).toHaveCount(0);

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
```

`e2e/leave.spec.ts`, added:
1. "back in the middle of a round keeps the answers and sets no record, in every mode" (one test per class of Streak, Three lives, Timed; Timed installs the page clock): one right answer, then `page.goBack()`: the start flow is on screen; the stored progress has one card, `records` is `{}`, `last.score` is null; the continue line is there without a last score.
2. "back on a decided Streak round keeps the answers and sets no record": two right answers, a wrong one, then `page.goBack()` in place of "See results": the start flow is on screen; the stored progress has three cards, `records` is `{}`, `last.score` is null; the continue line is there without a last score. (Spec sections 2 and 6: a round that is left sets no record. The README lists the proposal to count such a round as finished; it is not built.)
3. "the close button on a decided round asks, and Keep playing leads to See results": the same round, "Leave round": the dialog "Leave round?" opens; "Keep playing": the dialog closes and "See results" is still there; `seeResults`: the stored `records["aws-clf-c02/SEC#streak"]` is 2.

`e2e/night.spec.ts`, added (the file's `colorScheme: "dark"`): "at night a Streak round and its result are drawn with the night colours": the play page passes `expectThemePage(page, "night")` and `expectPass(page, "night")`; the plane's circle is `tokenRgb("night", "accent")`; after a right answer the slip's paper contains `tokenRgb("night", "surface-sunk")` and the stamp's colour is `tokenRgb("night", "correct")`; after a wrong answer and `seeResults` the page and the pass are night and the score's colour is `tokenRgb("night", "ink")`. In the same file, "at night the Three lives hearts and the Timed stamp use the night roles": a full heart's fill is `tokenRgb("night", "ink")`, a lost heart's stroke `tokenRgb("night", "ink-muted")`; in Timed the stub stamp's background is `tokenRgb("night", "surface-raised")`.

**Documents.**

`docs/superpowers/specs/2026-10-01-truthy-design.md`:
- Section 6, "Shape": the events line becomes `answer(true | false, at)`, `next`, `tick(now)`, `visibility(hidden | visible, at)`, `abandon`; add: "Every event that depends on time carries the time; the engine never reads a clock." The phases line: "`stamped` (Timed only: the verdict stamp for 700 ms, then the next question; also the state after time is up, until the result is opened)".
- Section 6, "Dealing", last paragraph, add: "A chunk is ten cards, or as many as may be dealt. The cards the round has not shown come first; behind them stand the cards it showed longest ago, and a card never comes back within the last ten cards dealt (or all the other cards of a smaller route). Recency gives way first here too: a card comes back in place of an unshown card that would repeat a conflict group or tip the balance, and the chunk that uses up the route is filled with the cards shown longest ago. A chunk shares no conflict group with the ten cards dealt before it, and the run limit holds across the join of two chunks. On a route of twenty cards or fewer nothing can be chosen once the first ten are dealt: there conflict groups, the balance and the run limit give way where the forced cards break them, and the gap is kept."
- Section 6, "Modes": Classic's cell gains "after the last card the action is 'See results'". Under the table: "Timed: a tick counts at most one second, so a device that sleeps without reporting it does not lose the round. An answer given at or after zero does not count; if time runs out while the stamp of an answer is shown, that answer counts and the next card is the one that does not."
- Section 6, "Leaving a round", add one clarifying sentence (the rule itself and the row in section 2 do not change): "This holds in every state of a round: after the deciding answer or at time up the round is still left without a record, and only 'See results' finishes it."
- Section 11: the `pnpm test` row gains "the purity and import boundaries of the engine, the input rules and the progress rules; dealing in chunks"; the `pnpm e2e` row gains "the Timed clock pausing while the page is hidden; the back gesture in every mode".

`design/system/tokens.json`: `motion.duration.hold-timed` value 700, description "Timed: from the answer until the card leaves (spec section 6)." (`tests/tokens/build.test.ts` pins the duration names, not this value.)

`design/system/DESIGN-SYSTEM.md`: 5.7, the ink variant's list: "See results →" is used after every deciding answer, Classic's last card included ("Classic after the last card, Streak after a wrong answer, Three lives after the third wrong answer, Time is up"). Section 7, "Timed beat": "hold **700 from the tap**", stub stamp landing 1.9 to 1 like every stamp; "Last life lost" becomes "Life lost" (every life, the last included). 5.10: the Streak rule for any best, the open-sky layout without a best, hearts lost from the right with the last life on the left, the trail rule (9 apart up to 14 marks, then squeezed from x 100), the completed scale rule (1, 6/7, then `min(6, 0.35 × 264 / (n - 1))`), the result labels "Ended · 14 cards", "Time up · 17 cards", "Out of lives". 5.11: Timed stub stamp icons check 24 and X 20; the Timed hint lines. 5.14: the record wording per mode. Section 10: questions 5 and 11 closed with their answers; question 6 answered ("unchanged"); question 7 corrected to what the app does (Close and "Choose another route" both return to start step 1).

`docs/testing.md`: under "Things to know when writing one" add: `waitForQuestion` for the modes without "Card n of total"; the Timed specs install `page.clock` before `page.goto` and run the minute with `runFor`; `fastForward` is a jump (a sleep), `setPageHidden` is a hidden page.

**Steps:**

- [ ] **Step 1: Add the helpers** to `e2e/helpers.ts`. `pnpm typecheck`: green.
- [ ] **Step 2: Write `e2e/streak.spec.ts`.** Port 3100 free, then `pnpm exec playwright test e2e/streak.spec.ts`. Expected: every test passes in both projects (the behaviour exists since task 12). A failure is a defect: fix it in the component, test first, in its own commit.
- [ ] **Step 3: Write `e2e/lives.spec.ts`** and run it the same way.
- [ ] **Step 4: Write `e2e/timed.spec.ts`** and run it. Each test takes seconds, not a minute.
- [ ] **Step 5: Add the leave and night cases** and run the two files.
- [ ] **Step 6: Prove the Timed specs bite.** In `src/engine/round.ts` make `onVisibility` return `state` for a hidden page (a clock that does not pause), rebuild (port 3100 free), run `e2e/timed.spec.ts`: "the clock pauses while the page is hidden" fails in both projects. Restore the file (`git checkout src/engine/round.ts`). Then set `TIMED.maxStepMs` to `Infinity`: "a jump of the clock costs at most a second" fails. Restore. Nothing of this step is committed.
- [ ] **Step 7: Prove the double-tap spec bites.** Set `NEXT_ARRIVES_MS` to 0 in `components/play/PlayScreen.tsx`, rebuild, run `e2e/streak.spec.ts`: "a double tap on the wrong answer keeps the verdict" fails. Restore.
- [ ] **Step 8: Commit the specs.**

```bash
git add e2e
git commit -m "test: each mode's ending end to end, the Timed clock, the back gesture and the night colours"
```

- [ ] **Step 9: Compare with the mockups.** Write `compare-shoot.mjs` in the repository root (never committed; delete it afterwards): with Playwright's Chromium at 390 by 844, device scale factor 2, light scheme, it opens each mockup from `design/flow/screens/` by `file:` URL and takes a screenshot, and it drives the running production build (`pnpm start --port 3100`) to the same state and takes a screenshot of it. Put each pair side by side. The nine pairs: `game-streak` (a streak below a stored best), `game-streak-record` (the answer that passes the best), `game-lives` (two lives left), `game-lives-out` (the third wrong answer), `game-timed` (the stamp beat, right and wrong), `game-timed-up`, `result-streak`, `result-lives`, `result-timed`. Accept only the differences the README's decisions name (the sky gradient of step 1, the stamp hold, the stub stamp's landing scale, "See results" delay, the card id barcode, real card texts and counts); anything else is a defect to fix before going on. Then look at the same nine states in the night theme (no night mockups exist): every text readable, no day colour left.
- [ ] **Step 10: Update the documents** as listed. Run `pnpm test` (the token build and the contrast gate read `tokens.json`; the hygiene test reads every tracked file).
- [ ] **Step 11: The final gate of step 2.** Port 3100 free, then `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e`. All green, in both Playwright projects. `git status` shows no stray file (`compare-shoot.mjs` deleted).
- [ ] **Step 12: Commit the documents.**

```bash
git add docs design
git commit -m "docs: the rules of Streak, Three lives and Timed in the spec, the design system and the testing note"
```
