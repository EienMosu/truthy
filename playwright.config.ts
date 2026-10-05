import { defineConfig } from "@playwright/test";

// E2E_PORT lets two checkouts run the specs at the same time, each against its own server.
export function e2ePort(value: string | undefined): number {
  if (value === undefined || value === "") return 3100;
  const port = Number(value);
  if (!/^\d+$/.test(value) || port < 1 || port > 65535) {
    throw new Error(`E2E_PORT must be a whole port number from 1 to 65535, not "${value}"`);
  }
  return port;
}

const PORT = e2ePort(process.env.E2E_PORT);
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
  // In CI a failed test runs once more, so the report tells a flaky test from a broken one, but a pass on the
  // retry still fails the run: a flake shows as a red check, and CI uploads the failed attempt's trace.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
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
