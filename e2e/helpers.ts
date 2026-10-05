// Shared steps for the end-to-end specs. Every action goes through what a player can see and do: roles,
// accessible names and visible text. The one look behind the scenes is the built deck file, fetched from
// the running app, which tells a spec the right answer to the statement on screen (so a spec can choose
// to answer right or wrong without depending on the random deal).
import { readFileSync } from "node:fs";
import { expect, type Locator, type Page } from "@playwright/test";
import { plainText } from "../src/content/text";

/**
 * A little over the 250 ms settle time of spec section 8: input is ignored until a new card has settled,
 * and the start flow ignores presses on a step's options for as long after the step appears.
 */
export const SETTLE_MS = 300;

/** One step of the start flow: the accessible name of the option to choose. */
type OptionName = string | RegExp;

export interface RoutePick {
  area: OptionName;
  platform: OptionName;
  deck: OptionName;
  /** Left out for a deck without sections: the flow skips the section step. */
  section?: OptionName;
  mode: OptionName;
}

// Names are patterns where a count changes with the content (a new deck, more cards), so the specs keep
// passing when the decks grow.

/** Cloud, AWS, Cloud Practitioner, Security and compliance, Classic. */
export const CLF_SECURITY: RoutePick = {
  area: /^Cloud, \d+ decks?$/,
  platform: /^AWS, \d+ decks?$/,
  deck: /^CLF, Cloud Practitioner, \d+ cards, /,
  section: /^SEC, Security and compliance, \d+ cards$/,
  mode: /^Classic\. Correct answers out of 10 cards\. /,
};

/** Cloud, Google Cloud, Cloud Digital Leader (a deck without sections), Classic. */
export const CDL_WHOLE: RoutePick = {
  area: /^Cloud, \d+ decks?$/,
  platform: /^Google Cloud, \d+ decks?$/,
  deck: /^CDL, Cloud Digital Leader, \d+ cards, /,
  mode: /^Classic\. Correct answers out of 10 cards\. /,
};

export const CLF_ID = "aws-clf-c02";
export const CDL_ID = "gcp-cdl";

/** The accessible name of the continue line after a round on CLF / SEC / Classic. */
export const CONTINUE_CLF_SECURITY = "Continue: AWS Cloud Practitioner, Security and compliance, Classic.";

/** The title of the start step on screen (the leaving step is inert while it animates out). */
export function stepTitle(page: Page): Locator {
  return page.locator("[data-step]:not([inert]) h2");
}

/** Waits until the start flow shows the step with this title and its settle time has passed. */
export async function atStep(page: Page, title: string): Promise<void> {
  await expect(stepTitle(page)).toHaveText(title);
  await page.waitForTimeout(SETTLE_MS);
}

function option(page: Page, name: OptionName): Locator {
  return page.getByRole("button", typeof name === "string" ? { name, exact: true } : { name });
}

/**
 * Waits until the start flow shows step 1 with its areas and their settle time has passed: step 1's options
 * ignore presses for 250 ms after they appear, as every step's do (review finding U6).
 */
export async function atHome(page: Page): Promise<void> {
  await expect(stepTitle(page)).toHaveText("Choose an area");
  await expect(page.getByRole("button", { name: CLF_SECURITY.area })).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);
}

/** Opens the start screen at step 1 and waits for the areas and their settle time. */
export async function openHome(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Truthy" })).toBeVisible();
  await atHome(page);
}

/** Fills in the pass from step 1 to "Your pass is ready" by tapping the cards, letting each step settle. */
export async function chooseRoute(page: Page, pick: RoutePick): Promise<void> {
  await option(page, pick.area).click();
  await atStep(page, "Choose a platform");
  await option(page, pick.platform).click();
  await atStep(page, "Choose a deck");
  await option(page, pick.deck).click();
  if (pick.section !== undefined) {
    await atStep(page, "Choose a section");
    await option(page, pick.section).click();
  }
  await atStep(page, "Choose how to play");
  await option(page, pick.mode).click();
  await atStep(page, "Your pass is ready");
}

/** "Start round" on the ready pass, then waits for /play. */
export async function startRound(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Start round" }).click();
  await expect(page).toHaveURL(/\/play$/);
}

/**
 * The right answer of every statement of a deck, read from the built deck file the app serves. Each statement is
 * keyed as it is shown (statementOnScreen): a code fragment without its backticks.
 */
export async function deckAnswers(page: Page, deckId: string): Promise<Map<string, boolean>> {
  const response = await page.request.get(`/decks/${deckId}.json`);
  expect(response.ok()).toBe(true);
  const deck = (await response.json()) as { cards: { answer: boolean; text: { en: { statement: string } } }[] };
  return new Map(deck.cards.map((card) => [plainText(card.text.en.statement), card.answer]));
}

/** The statement on the card (the last paragraph of the statement block). */
export async function statementOnScreen(page: Page): Promise<string> {
  const text = await page.locator("[data-statement] > p").last().textContent();
  return (text ?? "").trim();
}

/** The live region that announces the verdict after an answer. */
export function verdict(page: Page): Locator {
  return page.locator("main").getByRole("status");
}

/** What the live region says after an answer (verdictText in components/play/PlayScreen.tsx). */
export function verdictFor(given: boolean, truth: boolean): string {
  return `${given === truth ? "Correct" : "Not quite"}. The answer is ${truth ? "True" : "False"}.`;
}

/**
 * Waits until card `n` of `total` is on screen and has settled, and returns its statement and right answer.
 * The flight path's name starts "Card n of total." and the True and False buttons are back. The play
 * screen starts the settle time and focuses the statement in the same effect, so the wait is counted
 * from the moment the statement has focus, not from when the card was painted.
 */
export async function waitForCard(
  page: Page,
  answers: Map<string, boolean>,
  n: number,
  total = 10,
): Promise<{ statement: string; truth: boolean }> {
  await expect(page.getByRole("img", { name: new RegExp(`^Card ${n} of ${total}\\.`) })).toBeVisible();
  await expect(page.getByRole("button", { name: "True", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next card" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "See results" })).toHaveCount(0);
  await expect(page.locator("[data-statement]")).toBeFocused();
  await page.waitForTimeout(SETTLE_MS);
  const statement = await statementOnScreen(page);
  const truth = answers.get(statement);
  if (truth === undefined) throw new Error(`The statement on screen is not in the deck file: "${statement}"`);
  return { statement, truth };
}

export type AnswerMethod = "buttons" | "keys";

export interface Played {
  number: number;
  statement: string;
  truth: boolean;
  given: boolean;
}

/**
 * Plays a whole Classic round of `total` cards. `choose(number, truth)` returns the answer to give to card
 * `number` (from 1). Buttons answer by tapping True or False and go on with "Next card"; keys answer with
 * the right and left arrows and go on with Enter. Every answer is checked against the announced verdict.
 * `from` starts at a later card when the spec has played the first ones itself.
 */
export async function playRound(
  page: Page,
  deckId: string,
  choose: (number: number, truth: boolean) => boolean,
  method: AnswerMethod = "buttons",
  total = 10,
  from = 1,
): Promise<Played[]> {
  const answers = await deckAnswers(page, deckId);
  const played: Played[] = [];
  for (let number = from; number <= total; number += 1) {
    const { statement, truth } = await waitForCard(page, answers, number, total);
    const given = choose(number, truth);
    if (method === "buttons") await page.getByRole("button", { name: given ? "True" : "False", exact: true }).click();
    else await page.keyboard.press(given ? "ArrowRight" : "ArrowLeft");
    await expect(verdict(page)).toHaveText(verdictFor(given, truth));
    const next = page.getByRole("button", { name: number === total ? "See results" : "Next card" });
    await expect(next).toBeVisible();
    if (method === "buttons") await next.click();
    else {
      await expect(next).toBeFocused();
      await page.keyboard.press("Enter");
    }
    played.push({ number, statement, truth, given });
  }
  return played;
}

/** Right on every card except the numbers listed, which are answered wrong on purpose. */
export function wrongOn(...numbers: number[]): (number: number, truth: boolean) => boolean {
  return (number, truth) => (numbers.includes(number) ? !truth : truth);
}

/** The result screen: its heading is focused when it appears. */
export async function expectResult(page: Page, score: number, total = 10): Promise<void> {
  await expect(page.getByRole("heading", { name: "Round complete" })).toBeFocused();
  await expect(page.getByText(`${score} of ${total}`, { exact: true })).toBeVisible();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** The missed-card list holds exactly the wrong answers of the round, in order, with what the player said. */
export async function expectMissed(page: Page, played: readonly Played[]): Promise<void> {
  const wrong = played.filter((card) => card.given !== card.truth);
  const list = page.getByRole("region", { name: "Missed cards" });
  if (wrong.length === 0) {
    await expect(list.getByText("No missed cards")).toBeVisible();
    return;
  }
  await expect(list.getByText(`${wrong.length} to review`)).toBeVisible();
  const items = list.getByRole("listitem");
  await expect(items).toHaveCount(wrong.length);
  for (const [i, card] of wrong.entries()) {
    const item = items.nth(i);
    await expect(item).toContainText(`Card ${pad2(card.number)}`);
    await expect(item).toContainText(`You said ${card.given ? "True" : "False"}`);
    await expect(item).toContainText(card.statement);
    await expect(item).toContainText(`Answer ${card.truth ? "True" : "False"}`);
  }
}

/**
 * Drags the card with the mouse from the middle of its statement by (dx, dy) in `steps` moves, then
 * releases it. The start point is far from the 24 px edge zones.
 */
export async function dragCard(page: Page, dx: number, dy: number, steps = 12): Promise<void> {
  const box = await page.locator("[data-statement]").boundingBox();
  if (box === null) throw new Error("The statement is not on screen");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up();
}

/** The round is still waiting for an answer to card `n`: no verdict, the answer buttons, no "Next card" or "See results". */
export async function expectUnanswered(page: Page, n: number, total = 10): Promise<void> {
  await expect(page.getByRole("img", { name: new RegExp(`^Card ${n} of ${total}\\.`) })).toBeVisible();
  await expect(verdict(page)).toHaveText("");
  await expect(page.getByRole("button", { name: "True", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next card" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "See results" })).toHaveCount(0);
}

// ---------- the modes of step 2 ----------

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

// ---------- colours ----------

interface ColorToken {
  $value: string | { hex: string };
}

const TOKENS = JSON.parse(readFileSync(new URL("../design/system/tokens.json", import.meta.url), "utf8")) as {
  color: Record<string, Record<string, ColorToken>>;
};

export type TokenTheme = "day" | "night";

/** A colour role of a theme in design/system/tokens.json, references followed, as the browser writes it. */
export function tokenRgb(theme: TokenTheme, role: string): string {
  let token = TOKENS.color[theme]?.[role];
  for (let hops = 0; token !== undefined && typeof token.$value === "string" && hops < 8; hops += 1) {
    const [, group, name] = /^\{color\.([a-z]+)\.([a-z0-9-]+)\}$/.exec(token.$value) ?? [];
    token = group === undefined || name === undefined ? undefined : TOKENS.color[group]?.[name];
  }
  if (token === undefined || typeof token.$value === "string") throw new Error(`color.${theme}.${role} does not resolve`);
  const hex = token.$value.hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** The colour role as #rrggbb, as a theme-color tag holds it. */
export function tokenHex(theme: TokenTheme, role: string): string {
  const [r, g, b] = (/^rgb\((\d+), (\d+), (\d+)\)$/.exec(tokenRgb(theme, role)) ?? []).slice(1).map(Number);
  return `#${[r, g, b].map((n) => (n ?? 0).toString(16).padStart(2, "0")).join("")}`;
}

export async function computed(
  locator: Locator,
  property: "color" | "backgroundColor" | "backgroundImage" | "fill" | "stroke",
): Promise<string> {
  return locator.evaluate((element, name) => getComputedStyle(element)[name], property);
}

const SKY = ["sky-1", "sky-2", "sky-3", "sky-4"] as const;

/** The page is in this theme: its text and background, and the backdrop blends its four sky colours, in order. */
export async function expectThemePage(page: Page, theme: TokenTheme): Promise<void> {
  const other: TokenTheme = theme === "day" ? "night" : "day";
  const body = page.locator("body");
  expect(await computed(body, "color")).toBe(tokenRgb(theme, "ink"));
  expect(await computed(body, "backgroundColor")).toBe(tokenRgb(theme, "surface"));

  const sky = await computed(page.locator("[data-sky-backdrop]"), "backgroundImage");
  expect(sky).toMatch(/^linear-gradient\(/);
  const stops = SKY.map((role) => sky.indexOf(tokenRgb(theme, role)));
  for (const [i, at] of stops.entries()) expect(at, `${SKY[i]} in ${sky}`).toBeGreaterThanOrEqual(0);
  expect([...stops].sort((a, b) => a - b)).toEqual(stops);
  for (const role of SKY) expect(sky, `${other} ${role}`).not.toContain(tokenRgb(other, role));
}

/** The main paper of the pass on screen is drawn in this theme's surface-raised colour, its text in its ink. */
export async function expectPass(page: Page, theme: TokenTheme): Promise<void> {
  const paper = page.locator("[data-boarding-pass] > div").nth(1);
  expect(await computed(paper, "backgroundImage")).toContain(tokenRgb(theme, "surface-raised"));
  expect(await computed(page.locator("[data-boarding-pass]").first(), "color")).toBe(tokenRgb(theme, "ink"));
}

/**
 * Opens /play straight on a round of CLF / SEC in this class, as the start flow hands it over, with the
 * stored record for that route and class (none when null). Skips the start flow for specs about the round.
 */
export async function openPendingRound(page: Page, mode: "classic" | "streak" | "lives" | "timed", record: number | null = null): Promise<void> {
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

/** The centre of an element on screen. */
export async function centreOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("The element is not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
