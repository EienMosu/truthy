import { expect, test, type Page } from "@playwright/test";
import {
  CDL_ID,
  CLF_ID,
  CLF_SECURITY,
  CONTINUE_CLF_SECURITY,
  atHome,
  atStep,
  expectResult,
  openHome,
  option,
  playRound,
  startRound,
  wrongOn,
} from "./helpers";

// Recent decks and going back on long lists (docs/superpowers/specs/2026-10-13-truthy-recent-decks-design.md).

const RCT_ID = "react-fundamentals";
const TSC_ID = "typescript-fundamentals";
const GIT_ID = "git-fundamentals";

/** The first card id of a deck: the start drops the history of cards that are not in their deck any more. */
async function firstCardId(page: Page, deckId: string): Promise<string> {
  const deck = (await (await page.request.get(`/decks/${deckId}.json`)).json()) as { cards: { id: string }[] };
  const id = deck.cards[0]?.id;
  if (!id) throw new Error(`no cards in ${deckId}`);
  return id;
}

/** Stores history on one card of each deck, in the order given (the last is the newest), and opens step 1. */
async function openWithPlayed(page: Page, deckIds: readonly string[]): Promise<void> {
  const cards: Record<string, { seen: number; lastCorrect: boolean; lastSeenAt: number }> = {};
  for (const [i, deckId] of deckIds.entries()) cards[await firstCardId(page, deckId)] = { seen: 1, lastCorrect: true, lastSeenAt: 1_000 + i };
  await page.goto("/");
  await page.evaluate((value) => localStorage.setItem("truthy.progress.v1", value), JSON.stringify({ version: 1, cards, records: {}, last: null }));
  await page.reload();
  await atHome(page);
}

function recentCard(page: Page) {
  return page.locator("[data-step]:not([inert]) [data-recent]");
}

async function optionIds(page: Page): Promise<(string | null)[]> {
  return page.locator("[data-step]:not([inert]) [data-option]").evaluateAll((els) => els.map((el) => el.getAttribute("data-option")));
}

/** The focused card lies whole inside the visible part of its list. */
async function focusedInListView(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const focused = document.activeElement;
    const list = focused?.closest("[data-list]");
    if (!focused || !list) return false;
    const card = focused.getBoundingClientRect();
    const view = list.getBoundingClientRect();
    return card.top >= view.top - 0.5 && card.bottom <= view.bottom + 0.5;
  });
}

for (const motion of ["reduce", "no-preference"] as const) {
  test.describe(`recent decks, ${motion === "reduce" ? "reduced motion" : "full motion"}`, () => {
    test.use({ reducedMotion: motion });

    test("lists the decks played last, and a round started through Recent records like any other", async ({ page }) => {
      test.slow(); // one round
      await openWithPlayed(page, [CLF_ID, CDL_ID]);
      await expect(recentCard(page)).toHaveText("RecentCDL · CLF");
      expect(await page.locator("[data-step]:not([inert]) [role=list] > [role=listitem]").first().getAttribute("data-recent")).toBe("");
      await option(page, "Recent, 2 decks").click();
      await atStep(page, "Choose a deck");
      expect(await optionIds(page)).toEqual([CDL_ID, CLF_ID]);
      await option(page, CLF_SECURITY.deck).click();
      await atStep(page, "Choose a section");
      await expect(page.getByRole("button", { name: "Change platform, now AWS" })).toBeVisible();
      await option(page, CLF_SECURITY.section!).click();
      await atStep(page, "Choose how to play");
      await option(page, CLF_SECURITY.mode).click();
      await atStep(page, "Your pass is ready");
      await startRound(page);
      await playRound(page, CLF_ID, wrongOn(2));
      await expectResult(page, 9);
      await page.getByRole("button", { name: "Choose another route" }).click();
      await atHome(page);
      // CLF is now the newest, and the continue line leads back to the round.
      await expect(recentCard(page)).toHaveText("RecentCLF · CDL");
      await expect(page.getByRole("button", { name: `${CONTINUE_CLF_SECURITY} Last score 9 of 10.` })).toBeVisible();
    });

    test("goes back from a recent deck to the recent decks and then to step 1, by Back and by the browser", async ({ page }) => {
      await openWithPlayed(page, [CLF_ID, CDL_ID]);
      await option(page, "Recent, 2 decks").click();
      await atStep(page, "Choose a deck");
      await option(page, CLF_SECURITY.deck).click();
      await atStep(page, "Choose a section");
      await page.getByRole("button", { name: "Back to decks" }).click();
      await atStep(page, "Choose a deck");
      await expect(page.locator(":focus")).toHaveAttribute("aria-label", /^CLF, Cloud Practitioner/);
      await page.getByRole("button", { name: "Back to areas" }).click();
      await atStep(page, "Choose an area");
      await expect(page.locator(":focus")).toHaveAttribute("aria-label", "Recent, 2 decks");

      await option(page, "Recent, 2 decks").click();
      await atStep(page, "Choose a deck");
      await option(page, /^CDL, Cloud Digital Leader/).click();
      await atStep(page, "Choose how to play");
      await page.goBack();
      await atStep(page, "Choose a deck");
      expect(await optionIds(page)).toEqual([CDL_ID, CLF_ID]);
      await page.goBack();
      await atStep(page, "Choose an area");
      await expect(page).toHaveURL(/\/$/);
    });

    test("brings the chosen platform into view on a long list when going back, by keyboard and by a press", async ({ page }) => {
      await openHome(page);
      await option(page, /^DevOps, /).click();
      await atStep(page, "Choose a platform");
      await expect(page.locator("[data-step]:not([inert]) [role=list] > [role=listitem]")).toHaveCount(10);
      await option(page, "Networking, 1 deck").focus();
      await page.keyboard.press("Enter");
      await atStep(page, "Choose a deck");
      await page.keyboard.press("Escape");
      await atStep(page, "Choose a platform");
      await expect(page.locator(":focus")).toHaveAttribute("aria-label", "Networking, 1 deck");
      await expect.poll(() => focusedInListView(page)).toBe(true);

      await option(page, "Networking, 1 deck").click();
      await atStep(page, "Choose a deck");
      await page.getByRole("button", { name: "Back to platforms" }).click();
      await atStep(page, "Choose a platform");
      await expect(page.locator(":focus")).toHaveAttribute("aria-label", "Networking, 1 deck");
      await expect.poll(() => focusedInListView(page)).toBe(true);
    });
  });
}

for (const size of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
]) {
  test.describe(`recent decks on a ${size.width} by ${size.height} screen`, () => {
    test.use({ viewport: size, reducedMotion: "reduce" });

    test("lists four decks, their codes on one line, and nothing runs past the screen", async ({ page }) => {
      await openWithPlayed(page, [CLF_ID, CDL_ID, RCT_ID, TSC_ID, GIT_ID]);
      await expect(page.getByRole("button", { name: "Recent, 4 decks" })).toBeVisible();
      const codes = recentCard(page).getByText("GIT · TSC · RCT · CDL", { exact: true });
      await expect(codes).toBeVisible();
      // One line of 12 px Mono: two lines would be at least twice its line height.
      expect(await codes.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(24);
      expect(await codes.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);

      await option(page, "Recent, 4 decks").click();
      await atStep(page, "Choose a deck");
      expect(await optionIds(page)).toEqual([GIT_ID, TSC_ID, RCT_ID, CDL_ID]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    });
  });
}
