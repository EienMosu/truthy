import { expect, test, type Page } from "@playwright/test";
import { CLF_SECURITY, atStep, openHome } from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Review finding U7: on a choice the chosen card's name hides while its copy travels into the pass. Back within
// the step's 140 ms exit brings the same panel back, and its card must show its name again (and keep it once
// the panel has settled, also in Safari, which does not repaint a name shown again with visibility).

type Way = "the Back pill" | "Escape" | "the browser's back button";

/** Chooses `optionId` on the step shown and goes back 40 ms later, inside the step's exit. Says what it saw then. */
async function chooseAndGoBackAtOnce(page: Page, step: number, optionId: string, way: Way): Promise<{ sameStep: boolean; nameHidden: boolean }> {
  return page.evaluate(
    async ({ step, optionId, way }) => {
      const panel = document.querySelector(`[data-step="${step}"]`);
      const option = panel?.querySelector(`[data-option="${optionId}"]`);
      const name = option?.querySelector<HTMLElement>("[data-card-name]");
      option?.querySelector("button")?.click();
      await new Promise((resolve) => setTimeout(resolve, 40));
      const nameHidden = name?.style.opacity === "0" || name?.style.visibility === "hidden";
      if (way === "the Back pill") document.querySelector<HTMLElement>('button[aria-label^="Back to "]')?.click();
      else if (way === "Escape") document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      else history.back();
      await new Promise((resolve) => setTimeout(resolve, 900));
      // The panel shown again is the one that was leaving (the case of the finding), not a new one.
      const sameStep = document.querySelector(`[data-step="${step}"]:not([inert])`) === panel;
      return { sameStep, nameHidden };
    },
    { step, optionId, way },
  );
}

async function expectNameShown(page: Page, step: number, optionId: string, label: string | RegExp, text: string): Promise<void> {
  const name = page.locator(`[data-step="${step}"]:not([inert]) [data-option="${optionId}"] [data-card-name]`);
  await expect(name).toHaveText(text);
  await expect(name).toHaveCSS("opacity", "1");
  await expect(name).toHaveCSS("visibility", "visible");
  await expect(page.getByRole("button", { name: label })).toBeFocused();
}

for (const way of ["the Back pill", "Escape", "the browser's back button"] as const) {
  test(`going back with ${way} right after choosing a platform shows the card's name again`, async ({ page }) => {
    await openHome(page);
    await page.getByRole("button", { name: CLF_SECURITY.area }).click();
    await atStep(page, "Choose a platform");
    const seen = await chooseAndGoBackAtOnce(page, 2, "aws", way);
    expect(seen).toEqual({ sameStep: true, nameHidden: true });
    await expectNameShown(page, 2, "aws", CLF_SECURITY.platform, "AWS");
  });
}

test("going back right after choosing an area or a class shows the card's name again", async ({ page }) => {
  await openHome(page);
  expect(await chooseAndGoBackAtOnce(page, 1, "cloud", "the Back pill")).toEqual({ sameStep: true, nameHidden: true });
  await expectNameShown(page, 1, "cloud", CLF_SECURITY.area, "Cloud");

  await page.waitForTimeout(300);
  await page.getByRole("button", { name: CLF_SECURITY.area }).click();
  await atStep(page, "Choose a platform");
  await page.getByRole("button", { name: CLF_SECURITY.platform }).click();
  await atStep(page, "Choose a deck");
  await page.getByRole("button", { name: CLF_SECURITY.deck }).click();
  await atStep(page, "Choose a section");
  await page.getByRole("button", { name: CLF_SECURITY.section }).click();
  await atStep(page, "Choose how to play");
  expect(await chooseAndGoBackAtOnce(page, 5, "classic", "Escape")).toEqual({ sameStep: true, nameHidden: true });
  await expectNameShown(page, 5, "classic", CLF_SECURITY.mode, "Classic");
});
