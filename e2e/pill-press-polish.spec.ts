import { expect, test, type Locator } from "@playwright/test";
import { CLF_ID, deckAnswers, openPendingRound, setPageHidden, waitForQuestion } from "./helpers";

test.use({ reducedMotion: "no-preference" });

/** The pill's press styles as the browser computes them. */
function pressStyle(pill: Locator): Promise<{ translate: string; scale: string }> {
  return pill.evaluate((element) => {
    const style = getComputedStyle(element);
    return { translate: style.translate, scale: style.scale };
  });
}

test("a Timed answer pill shows its press under a held Space, but not while it is dimmed for the stamp", async ({ page }) => {
  await page.clock.install();
  await openPendingRound(page, "timed");
  const answers = await deckAnswers(page, CLF_ID);
  const { truth } = await waitForQuestion(page, answers);
  const pill = page.getByRole("button", { name: truth ? "True" : "False", exact: true });

  // Taking presses: Space held down presses the pill in; letting go answers.
  await pill.focus();
  await page.keyboard.down("Space");
  await expect.poll(() => pressStyle(pill)).toEqual({ translate: "0px 2px", scale: "0.98" });
  await page.keyboard.up("Space");
  await expect(pill).toHaveAttribute("aria-disabled", "true");

  // During the stamp's beat (held on screen while the page is hidden) the pill keeps focus but stays flat.
  await setPageHidden(page, true);
  await expect(pill).toBeFocused();
  await page.keyboard.down("Space");
  await page.waitForTimeout(300);
  expect(await pressStyle(pill)).toEqual({ translate: "none", scale: "none" });
  await page.keyboard.up("Space");
  await expect(page.locator("[data-flight-path] [data-tally]")).toHaveText("1 correct · 0 wrong");
  await setPageHidden(page, false);
});
