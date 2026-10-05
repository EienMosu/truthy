// An unknown address (a typo, /Play, a stale link) gets the game's own page: the sky in the theme the player
// chose, one tab title, and a way back to the start flow. Next's stock page painted the body white or black by
// the system setting, whatever theme was stored, and had no link.
import { expect, test } from "@playwright/test";
import { atHome, expectThemePage, type TokenTheme } from "./helpers";

test.use({ reducedMotion: "reduce" });

const CASES: { system: "light" | "dark"; stored: "light" | "dark"; theme: TokenTheme }[] = [
  { system: "light", stored: "dark", theme: "night" },
  { system: "dark", stored: "light", theme: "day" },
];

for (const { system, stored, theme } of CASES) {
  test(`an unknown address answers 404 in the stored ${stored} theme on a ${system} system, and leads back to the start`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: system });
    await page.addInitScript((value) => localStorage.setItem("truthy.theme", value), stored);

    const response = await page.goto("/nope");
    expect(response?.status()).toBe(404);
    const html = (await response?.text()) ?? "";
    expect(html.match(/<title>/g)).toHaveLength(1);
    await expect(page).toHaveTitle("Page not found · Truthy");

    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", stored);
    await expectThemePage(page, theme);

    // The one action is inside main, where a screen reader that moves by landmarks finds it, and still sits at
    // the foot of the page.
    const back = page.getByRole("main").getByRole("link", { name: "Back to start" });
    await expect(back).toBeVisible();
    const box = await back.boundingBox();
    const height = page.viewportSize()?.height ?? 0;
    expect(box && box.y + box.height).toBeGreaterThan(height - 120);

    await back.click();
    await expect(page).toHaveURL("/");
    await atHome(page);
    await expect(page).toHaveTitle("Truthy");
  });
}
