import { expect, test } from "@playwright/test";
import { stepTitle } from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec section 10: /play opened without a pending round redirects to /.
test("opening /play without a pending round goes to the start screen", async ({ page }) => {
  await page.goto("/play");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Truthy" })).toBeVisible();
  await expect(stepTitle(page)).toHaveText("Choose an area");
});
