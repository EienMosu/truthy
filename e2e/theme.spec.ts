import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  atStep,
  chooseRoute,
  deckAnswers,
  expectPass,
  expectThemePage,
  openHome,
  startRound,
  tokenHex,
  waitForCard,
  type TokenTheme,
} from "./helpers";

// The theme switch (spec section 9, "Tokens in code"): the theme follows the system setting until the player
// presses the switch at the top right of the start flow. The press flips the theme on screen, and the choice
// is kept on the device under "truthy.theme" and wins over the system setting on every screen and after a
// reload, with no day frame painted first.
test.use({ reducedMotion: "no-preference" });

const THEME: Record<"light" | "dark", TokenTheme> = { light: "day", dark: "night" };

function themeSwitch(page: Page): Locator {
  return page.getByRole("button", { name: /^Switch to (dark|light) theme$/ });
}

/** The colour the browser bar takes: the first theme-color tag, in document order, whose media matches. */
async function barColor(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    return metas.find((meta) => window.matchMedia(meta.getAttribute("media") ?? "all").matches)?.getAttribute("content") ?? null;
  });
}

/** The page shows `theme`: the colours, the attribute, the browser bar and the switch offering the other theme. */
async function expectTheme(page: Page, theme: "light" | "dark", chosen: boolean): Promise<void> {
  if (chosen) await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  else await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await expectThemePage(page, THEME[theme]);
  expect(await barColor(page)).toBe(tokenHex(THEME[theme], "sky-1"));
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
}

async function expectSwitchOffers(page: Page, next: "light" | "dark"): Promise<void> {
  await expect(page.getByRole("button", { name: `Switch to ${next} theme` })).toBeVisible();
}

test.describe("with the system in the light theme", () => {
  test.use({ colorScheme: "light" });

  test("the switch turns the page dark, the choice survives a reload with no day frame first, and a second press turns it light", async ({ page }) => {
    await openHome(page);
    await expectTheme(page, "light", false);
    await expectSwitchOffers(page, "dark");

    await themeSwitch(page).click();
    await expectSwitchOffers(page, "light");
    await expectTheme(page, "dark", true);
    expect(await page.evaluate(() => localStorage.getItem("truthy.theme"))).toBe("dark");

    // Before the reload: note the attribute as soon as <body> exists (nothing of the page can be painted
    // before that) and when the document has been parsed.
    await page.addInitScript(() => {
      const seen: Record<string, string | null> = {};
      (window as unknown as { themeSeen: typeof seen }).themeSeen = seen;
      const observer = new MutationObserver(() => {
        if (document.body && !("body" in seen)) {
          seen.body = document.documentElement.getAttribute("data-theme");
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
      document.addEventListener("DOMContentLoaded", () => {
        seen.parsed = document.documentElement.getAttribute("data-theme");
      });
    });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Truthy" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { themeSeen: unknown }).themeSeen)).toEqual({ body: "dark", parsed: "dark" });
    await expectTheme(page, "dark", true);
    await expectSwitchOffers(page, "light");

    await themeSwitch(page).click();
    await expectSwitchOffers(page, "dark");
    await expectTheme(page, "light", true);
    expect(await page.evaluate(() => localStorage.getItem("truthy.theme"))).toBe("light");
  });

  test("the dark choice carries into the round on /play, where there is no switch", async ({ page }) => {
    await openHome(page);
    await themeSwitch(page).click();
    await expectSwitchOffers(page, "light");
    await chooseRoute(page, CLF_SECURITY);
    await expectTheme(page, "dark", true);
    await startRound(page);

    const answers = await deckAnswers(page, CLF_ID);
    await waitForCard(page, answers, 1);
    await expectTheme(page, "dark", true);
    await expectPass(page, "night");
    await expect(themeSwitch(page)).toHaveCount(0);
  });
});

test.describe("with the system in the dark theme", () => {
  test.use({ colorScheme: "dark" });

  test("a stored light choice opens the page light", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("truthy.theme", "light"));
    await openHome(page);
    expect(await page.evaluate(() => window.matchMedia("(prefers-color-scheme: dark)").matches)).toBe(true);
    await expectTheme(page, "light", true);
    await expectSwitchOffers(page, "dark");
  });

  test("a stored value the game does not know is ignored, and the page follows the system", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("truthy.theme", "sepia"));
    await openHome(page);
    await expectTheme(page, "dark", false);
    await expectSwitchOffers(page, "light");
  });
});

test("with storage blocked the switch still flips the theme for the page", async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      });
    }
  });
  await openHome(page);
  await expectTheme(page, "light", false);

  await themeSwitch(page).click();
  await expectSwitchOffers(page, "light");
  await expectTheme(page, "dark", true);

  await themeSwitch(page).click();
  await expectSwitchOffers(page, "dark");
  await expectTheme(page, "light", true);
});

test.describe("before the page runs any script", () => {
  test.use({ javaScriptEnabled: false, colorScheme: "dark" });

  test("the prerendered switch already shows the sun on the night theme", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-icon="sun"] svg')).toBeVisible();
    await expect(page.locator('[data-icon="moon"] svg')).toBeHidden();
  });
});

/** The vertical centre of a box. */
function middle(box: { y: number; height: number }): number {
  return box.y + box.height / 2;
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("not on screen");
  return box;
}

function apart(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test.describe(`on a ${viewport.width} by ${viewport.height} screen`, () => {
    test.use({ viewport });

    test("the switch sits at the top right of the header, in line with the logo and then the Back pill, clear of them and of the pass", async ({ page }) => {
      await openHome(page);
      const button = themeSwitch(page);
      const logo = page.getByRole("heading", { level: 1, name: "Truthy" });
      const frame = await boxOf(page.locator(".app-frame"));

      await expect.poll(async () => Math.abs(middle(await boxOf(button)) - middle(await boxOf(logo)))).toBeLessThanOrEqual(1);
      let switchBox = await boxOf(button);
      expect(switchBox.width).toBeGreaterThanOrEqual(48);
      expect(switchBox.height).toBeGreaterThanOrEqual(48);
      expect(switchBox.x + switchBox.width).toBeCloseTo(frame.x + frame.width - 16, 0);
      // The heading spans the row; the wordmark is its last child.
      const wordmark = await boxOf(logo.locator("span"));
      expect(switchBox.x - (wordmark.x + wordmark.width)).toBeGreaterThanOrEqual(16);
      expect(apart(switchBox, await boxOf(page.getByText("True or false cards that teach you IT, one swipe at a time.")))).toBe(true);

      await page.getByRole("button", { name: CLF_SECURITY.area }).click();
      await atStep(page, "Choose a platform");
      const back = page.getByRole("button", { name: "Back to areas" });
      await expect.poll(async () => Math.abs(middle(await boxOf(button)) - middle(await boxOf(back)))).toBeLessThanOrEqual(1);
      switchBox = await boxOf(button);
      expect(apart(switchBox, await boxOf(back))).toBe(true);
      expect(apart(switchBox, await boxOf(page.locator("[data-fill-in-pass]")))).toBe(true);
      expect(switchBox.x + switchBox.width).toBeCloseTo(frame.x + frame.width - 16, 0);

      // Pressing it does not move the flow: the step and its options stay, and the next press on a card counts.
      await button.click();
      await expectSwitchOffers(page, "light");
      await expect(page.locator("[data-step]:not([inert]) h2")).toHaveText("Choose a platform");
      await page.getByRole("button", { name: CLF_SECURITY.platform }).click();
      await atStep(page, "Choose a deck");
    });
  });
}
