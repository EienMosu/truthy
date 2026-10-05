import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// The actions .github/workflows/ci.yml uses, as "owner/name" and major version.
function actions(): { name: string; major: number }[] {
  const text = readFileSync(".github/workflows/ci.yml", "utf8");
  return [...text.matchAll(/^\s*-?\s*uses: ([\w.-]+\/[\w.-]+)@v(\d+)\s*$/gm)].map((match) => ({
    name: match[1] ?? "",
    major: Number(match[2]),
  }));
}

// The first major of each action whose action.yml says `runs.using: node24`. GitHub removes Node 20 from its
// runners, and an action still on it then stops the workflow.
const FIRST_NODE_24: Readonly<Record<string, number>> = {
  "actions/checkout": 5,
  "pnpm/action-setup": 5,
  "actions/setup-node": 5,
  "actions/upload-artifact": 6,
};

describe("CI workflow actions", () => {
  it("are all pinned to a major version", () => {
    const text = readFileSync(".github/workflows/ci.yml", "utf8");
    const uses = [...text.matchAll(/uses: (\S+)/g)].map((match) => match[1]);
    expect(uses).toHaveLength(actions().length);
  });

  it("run on Node 24, not the deprecated Node 20", () => {
    const found = actions();
    expect(found.map(({ name }) => name).sort()).toEqual(Object.keys(FIRST_NODE_24).sort());
    for (const { name, major } of found) expect(major, name).toBeGreaterThanOrEqual(FIRST_NODE_24[name] ?? Infinity);
  });
});

describe("end-to-end retries in CI", () => {
  // A pass on the retry keeps the run green and shows as a flaky notice: failing the run on every flake would turn
  // most runs red, because the shared Linux WebKit runner flakes a timing spec in most of them.
  it("retry a failed test once, keep its trace, and let a pass on the retry show as flaky", async () => {
    vi.stubEnv("CI", "true");
    vi.resetModules();
    try {
      const { default: config } = await import("@/playwright.config");
      expect(config.retries).toBe(1);
      expect(config.failOnFlakyTests).toBeFalsy();
      expect(config.use?.trace).toBe("retain-on-failure");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("do not retry on a developer's machine", async () => {
    vi.stubEnv("CI", "");
    vi.resetModules();
    try {
      const { default: config } = await import("@/playwright.config");
      expect(config.retries).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
