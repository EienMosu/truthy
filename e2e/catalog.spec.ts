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
