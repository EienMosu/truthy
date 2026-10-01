import { describe, expect, it } from "vitest";
import config from "@/playwright.config";

describe("end-to-end configuration", () => {
  it("runs the specs in e2e/", () => {
    expect(config.testDir).toBe("e2e");
  });

  it("covers Chromium and WebKit, both at the 390 by 844 phone size with touch", () => {
    const projects = (config.projects ?? []).map((project) => ({
      name: project.name,
      browserName: project.use?.browserName,
      viewport: project.use?.viewport,
      hasTouch: project.use?.hasTouch,
      isMobile: project.use?.isMobile,
    }));
    expect(projects).toEqual([
      { name: "phone-chromium", browserName: "chromium", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
      { name: "phone-webkit", browserName: "webkit", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    ]);
  });

  it("runs both projects in the light colour scheme, whatever the machine is set to; the night spec asks for dark", () => {
    for (const project of config.projects ?? []) expect(project.use?.colorScheme, project.name).toBe("light");
  });

  it("serves the production build, not the dev server", () => {
    const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
    expect(server?.command).toBe("pnpm build && pnpm start --port 3100");
    expect(config.use?.baseURL).toBe("http://localhost:3100");
  });
});
