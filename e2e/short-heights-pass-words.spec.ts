// The area and platform words on the route pass (review finding U119). They are 22 tall on a 30 tall line that
// sits right on the Deck, Section and Class fields, so a 48 tall target overlaps those fields by 13. The owner
// accepts targets of 35 there (WCAG 2.2 AA asks for 24) on one condition: a tap just under a word, or just above
// it, never lands on anything else. The words take that overlap, so these specs check the condition on every
// screen the start flow is made for, upright and held sideways or zoomed (e2e/start-layout.spec.ts checks 390 by
// 844 and 320 by 568 with the tap itself): every pixel from 12 above a word to 12 under it, at its left end, its
// middle and its right end, is the word's, and a tap 6 under it goes back to its own step.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { CLF_SECURITY, atStep, openHome } from "./helpers";

test.use({ reducedMotion: "reduce" });

function currentStep(page: Page): Locator {
  return page.locator("[data-step]:not([inert])");
}

async function tapOption(page: Page, name: string | RegExp, next: string): Promise<void> {
  await currentStep(page).getByRole("button", { name }).click();
  await atStep(page, next);
}

/** The points around `word` that do not hit it: 1 to 12 above and under, at its two ends and its middle. */
async function missesAround(word: Locator): Promise<string[]> {
  return word.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const misses: string[] = [];
    for (const x of [rect.left + 2, rect.left + rect.width / 2, rect.right - 2]) {
      for (let d = 1; d <= 12; d += 1) {
        for (const [where, y] of [["above", rect.top - d], ["under", rect.bottom + d]] as const) {
          const hit = document.elementFromPoint(x, y);
          if (hit === null || !(hit === element || element.contains(hit))) {
            const label = hit?.closest("button")?.getAttribute("aria-label") ?? hit?.tagName ?? "nothing";
            misses.push(`${Math.round(x - rect.left)} across, ${d} ${where}: ${label}`);
          }
        }
      }
    }
    return misses;
  });
}

const WORDS = [
  { name: "Change area, now Cloud", step: "Choose an area" },
  { name: "Change platform, now AWS", step: "Choose a platform" },
] as const;

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
  { width: 568, height: 320 },
  { width: 195, height: 422 },
]) {
  test.describe(`the words of the route pass on a ${viewport.width} by ${viewport.height} screen`, () => {
    test.use({ viewport });

    for (const at of ["Choose a section", "Choose how to play"] as const) {
      for (const word of WORDS) {
        test(`on "${at}", a tap just above or just under "${word.name}" is the word's`, async ({ page }) => {
          await openHome(page);
          await tapOption(page, CLF_SECURITY.area, "Choose a platform");
          await tapOption(page, CLF_SECURITY.platform, "Choose a deck");
          await tapOption(page, CLF_SECURITY.deck, "Choose a section");
          if (at === "Choose how to play") await tapOption(page, CLF_SECURITY.section ?? "", at);
          const target = page.getByRole("button", { name: word.name });
          await target.scrollIntoViewIfNeeded();
          expect(await missesAround(target)).toEqual([]);
          // The tap itself, on the screen's coordinates (mobile Chromium pans over a page wider than the screen).
          const box = await target.boundingBox();
          if (box === null) throw new Error(`${word.name} is not on screen`);
          await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height + 6);
          await expect(currentStep(page).locator("h2")).toHaveText(word.step);
        });
      }
    }
  });
}
