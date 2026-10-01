import { expect, test } from "@playwright/test";

// Spec section 9, "Installability": the manifest and the icons that let the game be added to the home screen.
test("the start page links the manifest and the icons, and every icon is served", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", /^\/icon\.svg/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /^\/apple-icon\.png/);

  const response = await page.request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as { name: string; display: string; theme_color: string; icons: { src: string; type: string }[] };
  expect(manifest.name).toBe("Truthy");
  expect(manifest.display).toBe("standalone");
  // The manifest is static and keeps the day colour; the page has a theme colour per system setting.
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')).toHaveAttribute("content", manifest.theme_color);
  const dark = page.locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]');
  await expect(dark).toHaveAttribute("content", /^#[0-9a-f]{6}$/);
  expect(await dark.getAttribute("content")).not.toBe(manifest.theme_color);

  for (const icon of manifest.icons) {
    const file = await page.request.get(icon.src);
    expect(file.ok(), icon.src).toBe(true);
    expect(file.headers()["content-type"], icon.src).toContain(icon.type);
  }
});
