import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "@/playwright.config";
import { MODE_TABLE } from "@/src/app-state/modes";

// Review finding U38: the README described the Classic-only game of step 1. It names what the game offers now.
const readme = readFileSync("README.md", "utf8");

describe("the README", () => {
  it("names every class the start flow offers", () => {
    const offered = MODE_TABLE.filter((mode) => mode.offered).map((mode) => mode.name);
    expect(offered.length).toBeGreaterThan(1);
    for (const name of offered) expect(readme, name).toContain(name);
  });

  it("names the three ways to answer", () => {
    expect(readme).toMatch(/swiping right for true or left for false/);
    expect(readme).toContain("the True and False buttons");
    expect(readme).toContain("the arrow keys");
  });

  it("says that pnpm e2e builds first and on which port it serves", () => {
    const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
    expect(server?.command).toMatch(/^pnpm build && pnpm start --port \d+$/);
    expect(readme).toMatch(/\| `pnpm e2e` \|[^\n]*builds first and serves on port 3100 \(another with `E2E_PORT`\)/);
  });
});
