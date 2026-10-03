// The start flow lists what the deploy built (public/decks/index.json): every area and every platform in the
// index's order, each with its number of decks, and a place without decks as not available yet. The names and
// counts are read from the index, so the spec keeps passing as decks are added; tests/content/build.test.ts
// pins the index itself.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { atStep, openHome } from "./helpers";

test.use({ reducedMotion: "reduce" });

interface Place {
  id: string;
  title: string;
}
interface Index {
  areas: (Place & { platforms: (Place & { decks: Place[] })[] })[];
}

/** The accessible name of an area or platform card: "Cloud, 5 decks", "Azure, 1 deck", "DevOps, no decks yet". */
function placeLabel(title: string, decks: number): string {
  if (decks === 0) return `${title}, no decks yet`;
  return `${title}, ${decks} ${decks === 1 ? "deck" : "decks"}`;
}

function currentStep(page: Page): Locator {
  return page.locator("[data-step]:not([inert])");
}

/** The ids of the options of the current step, top to bottom. */
async function optionIds(page: Page): Promise<(string | null)[]> {
  return currentStep(page).locator("[data-option]").evaluateAll((options) => options.map((option) => option.getAttribute("data-option")));
}

/** A chooseable place is a button; a place without decks is a labelled group that cannot be chosen. */
function placeCard(page: Page, title: string, decks: number): Locator {
  const name = placeLabel(title, decks);
  return decks === 0 ? currentStep(page).getByRole("group", { name, exact: true }) : currentStep(page).getByRole("button", { name, exact: true });
}

test("every area and platform of the index is listed in order with its number of decks, and every area has decks", async ({ page }) => {
  const index = (await (await page.request.get("/decks/index.json")).json()) as Index;
  await openHome(page);

  expect(await optionIds(page)).toEqual(index.areas.map((area) => area.id));
  for (const area of index.areas) {
    const decks = area.platforms.reduce((sum, platform) => sum + platform.decks.length, 0);
    expect(decks, `${area.title} has decks`).toBeGreaterThan(0);
    await expect(placeCard(page, area.title, decks)).toBeVisible();
  }

  for (const area of index.areas) {
    const decks = area.platforms.reduce((sum, platform) => sum + platform.decks.length, 0);
    await placeCard(page, area.title, decks).click();
    await atStep(page, "Choose a platform");
    expect(await optionIds(page)).toEqual(area.platforms.map((platform) => platform.id));
    for (const platform of area.platforms) {
      await expect(placeCard(page, platform.title, platform.decks.length)).toBeAttached();
    }
    await page.getByRole("button", { name: "Back to areas" }).click();
    await atStep(page, "Choose an area");
  }
});

/** How far the text of a pass value runs past its box, in px (0 or less: shown whole). The ellipsis is drawn over a text laid out in full. */
async function overrun(value: Locator): Promise<number> {
  return value.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().width - element.getBoundingClientRect().width;
  });
}

// The pass names the area and the platform in full while the deck is chosen, on the narrowest phone the game is
// made for: "Web platform" and "Google Cloud" are the longest platform names. A value that does not fit is cut
// with an ellipsis (design system 5.4), which no name of the catalog should need.
test.describe("on a 320 by 568 screen", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("the pass shows every area and platform name whole while the deck is chosen", async ({ page }) => {
    const index = (await (await page.request.get("/decks/index.json")).json()) as Index;
    await openHome(page);
    for (const area of index.areas) {
      for (const platform of area.platforms.filter((candidate) => candidate.decks.length > 0)) {
        const decks = area.platforms.reduce((sum, candidate) => sum + candidate.decks.length, 0);
        await placeCard(page, area.title, decks).click();
        await atStep(page, "Choose a platform");
        await placeCard(page, platform.title, platform.decks.length).click();
        await atStep(page, "Choose a deck");
        const pass = page.locator('[data-fill-in-pass="destination"]');
        await expect(pass.locator('[data-pass-value="platform"]')).toHaveText(platform.title);
        expect(await overrun(pass.locator('[data-pass-value="area"]')), area.title).toBeLessThanOrEqual(0.5);
        expect(await overrun(pass.locator('[data-pass-value="platform"]')), platform.title).toBeLessThanOrEqual(0.5);
        await page.getByRole("button", { name: "Back to platforms" }).click();
        await atStep(page, "Choose a platform");
        await page.getByRole("button", { name: "Back to areas" }).click();
        await atStep(page, "Choose an area");
      }
    }
  });
});
