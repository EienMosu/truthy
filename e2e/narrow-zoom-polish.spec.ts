import { expect, test, type Page } from "@playwright/test";
import { CLF_ID, SETTLE_MS, deckAnswers, openPendingRound, waitForQuestion } from "./helpers";

// 195 by 422: a 390 by 844 phone at 200 percent page zoom, below the 320 the layout is made for.
test.use({ reducedMotion: "reduce", viewport: { width: 195, height: 422 } });

/**
 * Every box inside `selector` lies within the page's scrollable width, so whatever does not fit on the screen
 * can be scrolled to. Half a pixel for subpixel layout.
 */
async function expectReachable(page: Page, selector: string): Promise<void> {
  const outside = await page.evaluate((selector) => {
    const width = document.documentElement.scrollWidth;
    const found: string[] = [];
    for (const element of document.querySelectorAll(`${selector}, ${selector} *`)) {
      const box = element.getBoundingClientRect();
      if (box.width === 0) continue;
      const left = box.left + window.scrollX;
      const right = box.right + window.scrollX;
      if (left < -0.5 || right > width + 0.5) found.push(`${element.tagName} ${Math.round(left)} to ${Math.round(right)} of ${width}`);
    }
    return found;
  }, selector);
  expect(outside).toEqual([]);
}

test("at 195 wide the start screen keeps the logo clear of the theme switch", async ({ page }) => {
  await page.goto("/");
  // The wordmark, the right end of the logo (the heading itself is as wide as the row).
  const logo = page.getByRole("heading", { level: 1 }).getByText("Truthy");
  const themeSwitch = page.getByRole("button", { name: /theme/ });
  await expect(logo).toBeVisible();
  await expect(themeSwitch).toBeVisible();
  const [a, b] = [await logo.boundingBox(), await themeSwitch.boundingBox()];
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + 0.5);
  await expectReachable(page, "header");
});

test("at 195 wide the pass and the header of a round can be scrolled to, not cut off", async ({ page }) => {
  await openPendingRound(page, "classic");
  const answers = await deckAnswers(page, CLF_ID);
  // Answered with the keyboard: on a page wider than the screen, mobile Chromium pans the visual viewport
  // instead of scrolling, and Playwright's click does not follow that pan.
  await waitForQuestion(page, answers);
  await page.getByRole("button", { name: "True", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Next card" })).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);
  await expectReachable(page, "[data-boarding-pass]");
  await expectReachable(page, "[data-flight-path]");
});
