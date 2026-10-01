import { expect, test } from "@playwright/test";
import { CLF_ID, CLF_SECURITY, chooseRoute, expectMissed, expectResult, openHome, playRound, startRound } from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec sections 7 and 10: when the browser blocks storage the game still runs, with empty progress. Here
// every touch of localStorage and sessionStorage throws a SecurityError, as in a locked-down browser.
test("with storage blocked a round starts and plays to the result", async ({ page }) => {
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
  expect(
    await page.evaluate(() => {
      try {
        return window.sessionStorage === undefined ? "missing" : "available";
      } catch (error) {
        return error instanceof DOMException ? error.name : "other";
      }
    }),
  ).toBe("SecurityError");

  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();
  const played = await playRound(page, CLF_ID, (number, truth) => (number === 3 ? !truth : truth));

  await expectResult(page, 9);
  await expectMissed(page, played);
});
