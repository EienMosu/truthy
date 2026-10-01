import { defineConfig } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// Phone size from the spec: 390 by 844, touch enabled so swipe specs can use touch input. The day theme
// unless a spec asks for dark (e2e/night.spec.ts), so no spec depends on the machine's appearance setting.
const phone = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: "light",
} as const;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone-chromium", use: { ...phone, browserName: "chromium" } },
    { name: "phone-webkit", use: { ...phone, browserName: "webkit" } },
  ],
  webServer: {
    // Always the production build, so the specs test what Vercel serves.
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
