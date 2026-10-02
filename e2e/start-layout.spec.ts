// What a finger can reach in the start flow: the options under the foot zone, the words of the route pass,
// and the cue that a step's list goes on below the fold. Every check hit-tests the page as a tap would
// (document.elementFromPoint) and then taps there, so a layer that covers a control fails it even when the
// control is drawn on top.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { CLF_SECURITY, atStep, openHome } from "./helpers";

test.use({ reducedMotion: "no-preference" });

/** The step on screen (the leaving step is inert while it animates out). */
function currentStep(page: Page): Locator {
  return page.locator("[data-step]:not([inert])");
}

/** An option of the current step by its accessible name. */
function option(page: Page, name: string | RegExp): Locator {
  return currentStep(page).getByRole("button", { name });
}

/** Whether the element on top at (x, y) is `target` or inside it. */
async function hits(page: Page, target: Locator, x: number, y: number): Promise<boolean> {
  return target.evaluate((element, [px, py]) => {
    const top = document.elementFromPoint(px ?? 0, py ?? 0);
    return top !== null && (top === element || element.contains(top));
  }, [x, y]);
}

async function box(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await locator.boundingBox();
  if (b === null) throw new Error("The element is not on screen");
  return b;
}

/** Scrolls the list of the current step to its end, as far as it goes. */
async function scrollListToEnd(page: Page): Promise<void> {
  await currentStep(page).locator("[data-option]").first().evaluate((first) => {
    const list = first.parentElement?.parentElement;
    if (!list) throw new Error("No list around the options");
    list.scrollTop = list.scrollHeight;
  });
  await page.waitForTimeout(100);
}

async function toSections(page: Page): Promise<void> {
  await openHome(page);
  await option(page, CLF_SECURITY.area).click();
  await atStep(page, "Choose a platform");
  await option(page, CLF_SECURITY.platform).click();
  await atStep(page, "Choose a deck");
  await option(page, CLF_SECURITY.deck).click();
  await atStep(page, "Choose a section");
}

// U1: the foot zone is mounted on every step and sits over the bottom of the list. Empty (steps 2 to 5, and
// step 1 for a new player) it must let taps through to the cards under it.
test.describe("the empty foot zone", () => {
  test.describe("on a 390 by 844 screen", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("a tap on the lower part of the last section card chooses it", async ({ page }) => {
      await toSections(page);
      await scrollListToEnd(page);
      const card = option(page, /^BIL, /);
      const b = await box(card);
      const x = b.x + b.width / 2;
      const y = b.y + b.height - 15;
      expect(await hits(page, card, x, y), `the card is on top at (${x}, ${y})`).toBe(true);
      await page.touchscreen.tap(x, y);
      await expect(currentStep(page).locator("h2")).toHaveText("Choose how to play");
    });

    test("a tap on the lower part of the last class card chooses it", async ({ page }) => {
      await toSections(page);
      await option(page, CLF_SECURITY.section ?? "").click();
      await atStep(page, "Choose how to play");
      await scrollListToEnd(page);
      const card = option(page, /^Timed\. /);
      const b = await box(card);
      const x = b.x + b.width / 2;
      const y = b.y + b.height - 10;
      expect(await hits(page, card, x, y), `the card is on top at (${x}, ${y})`).toBe(true);
      await page.touchscreen.tap(x, y);
      await expect(currentStep(page).locator("h2")).toHaveText("Your pass is ready");
    });
  });

  test.describe("on a phone turned sideways, 844 by 390", () => {
    test.use({ viewport: { width: 844, height: 390 } });

    test("a tap on the part of the first area card that shows chooses it", async ({ page }) => {
      await openHome(page);
      await page.waitForTimeout(400);
      const card = option(page, CLF_SECURITY.area);
      const b = await box(card);
      const top = Math.max(b.y, 0);
      const bottom = Math.min(b.y + b.height, 390);
      expect(bottom - top, "some of the card shows").toBeGreaterThan(0);
      const x = b.x + b.width / 2;
      const y = (top + bottom) / 2;
      expect(await hits(page, card, x, y), `the card is on top at (${x}, ${y})`).toBe(true);
      await page.touchscreen.tap(x, y);
      await expect(currentStep(page).locator("h2")).toHaveText("Choose a platform");
    });
  });
});

/** The run of pixels around the centre of `target` that hit it: up and down at its centre x, across at its centre y. */
async function hitSpan(target: Locator): Promise<{ height: number; width: number }> {
  return target.evaluate((element) => {
    const r = element.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const on = (x: number, y: number) => {
      const top = document.elementFromPoint(x, y);
      return top !== null && (top === element || element.contains(top));
    };
    const run = (from: number, step: (n: number) => [number, number]) => {
      let n = 0;
      while (n < 200 && on(...step(from + n))) n += 1;
      return n;
    };
    const down = run(0, (n) => [cx, Math.floor(cy) + n]);
    const up = run(1, (n) => [cx, Math.floor(cy) - n]);
    const right = run(0, (n) => [Math.floor(cx) + n, cy]);
    const left = run(1, (n) => [Math.floor(cx) - n, cy]);
    return { height: down + up, width: right + left };
  });
}

// U119: the area and platform words of the route pass are 22 px tall; their hit area reaches 48 by 48 without
// moving the pass, and the Deck field under them keeps 48 of its 56.
for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test.describe(`the words of the route pass on a ${viewport.width} by ${viewport.height} screen`, () => {
    test.use({ viewport });

    for (const at of ["Choose a section", "Choose how to play"] as const) {
      test(`on "${at}" each word takes taps over 48 by 48, and a tap just under it is its own`, async ({ page }) => {
        await toSections(page);
        if (at === "Choose how to play") {
          await option(page, CLF_SECURITY.section ?? "").click();
          await atStep(page, at);
        }
        await page.waitForTimeout(400);
        const words = [page.getByRole("button", { name: "Change area, now Cloud" }), page.getByRole("button", { name: "Change platform, now AWS" })];
        for (const word of words) {
          const b = await box(word);
          expect(b.height).toBeCloseTo(22, 0);
          const span = await hitSpan(word);
          expect(span.height, "hit area height").toBeGreaterThanOrEqual(48);
          expect(span.width, "hit area width").toBeGreaterThanOrEqual(48);
          const x = b.x + b.width / 2;
          expect(await hits(page, word, x, b.y - 12), "12 px above the word").toBe(true);
          expect(await hits(page, word, x, b.y + b.height + 6), "6 px under the word").toBe(true);
        }
        const deck = page.getByRole("button", { name: "Change deck, now CLF" });
        expect((await hitSpan(deck)).height, "the Deck field under the words").toBeGreaterThanOrEqual(48);

        // A tap 6 px under AWS goes back to the platforms, not to the decks.
        const aws = await box(words[1] as Locator);
        await page.touchscreen.tap(aws.x + aws.width / 2, aws.y + aws.height + 6);
        await expect(currentStep(page).locator("h2")).toHaveText("Choose a platform");
      });
    }
  });
}
