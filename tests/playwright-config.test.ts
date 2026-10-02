import { describe, expect, it, vi } from "vitest";
import config, { e2ePort } from "@/playwright.config";

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

  it("takes the port from E2E_PORT, so two checkouts can run the specs at once, and 3100 without it", () => {
    expect(e2ePort(undefined)).toBe(3100);
    expect(e2ePort("")).toBe(3100);
    expect(e2ePort("3412")).toBe(3412);
  });

  it("serves and visits the port E2E_PORT names", async () => {
    vi.stubEnv("E2E_PORT", "3412");
    vi.resetModules();
    try {
      const { default: other } = await import("@/playwright.config");
      const server = Array.isArray(other.webServer) ? other.webServer[0] : other.webServer;
      expect(server?.command).toBe("pnpm build && pnpm start --port 3412");
      expect(other.use?.baseURL).toBe("http://localhost:3412");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refuses an E2E_PORT that is not a whole port number", () => {
    for (const value of ["abc", "3100.5", "31 00", "0", "65536", "-1", "3e3"]) {
      expect(() => e2ePort(value), value).toThrow(/E2E_PORT/);
    }
  });
});
