import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The `run:` commands of .github/workflows/ci.yml, in order.
function runSteps(): string[] {
  const text = readFileSync(".github/workflows/ci.yml", "utf8");
  return [...text.matchAll(/^\s*- run: (.+)$/gm)].map((match) => (match[1] ?? "").trim());
}

describe("CI workflow", () => {
  it("runs every gate: unit tests, types, the build, then the end-to-end tests in both browsers", () => {
    expect(runSteps()).toEqual([
      "pnpm install --frozen-lockfile",
      "pnpm test",
      "pnpm typecheck",
      "pnpm build",
      "pnpm exec playwright install --with-deps chromium webkit",
      "pnpm e2e",
    ]);
  });

  it("keeps the Playwright traces of every failed attempt, also when the run passed on a retry", () => {
    const text = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(text).toContain("if: ${{ !cancelled() }}");
    expect(text).not.toContain("if: failure()");
    expect(text).toContain("path: test-results/");
    expect(text).toContain("if-no-files-found: ignore");
  });
});

describe("CI workflow triggers", () => {
  // The text of the `on:` block, from its key to the line before the next top-level key.
  function triggers(): string {
    const text = readFileSync(".github/workflows/ci.yml", "utf8");
    const start = text.indexOf("\non:\n") + 1;
    const end = text.indexOf("\npermissions:");
    return text.slice(start, end);
  }

  it("runs on every push and pull request, except one that changes only ios or android files", () => {
    expect(triggers()).toBe(
      [
        "on:",
        "  push:",
        '    branches: ["**"]',
        "    paths-ignore:",
        '      - "ios/**"',
        '      - "android/**"',
        "  pull_request:",
        "    paths-ignore:",
        '      - "ios/**"',
        '      - "android/**"',
        "",
      ].join("\n"),
    );
  });

  // The drift test (tests/native-data.test.ts) and the hygiene test live in the web checks: a change that only
  // touches native-data must still run them.
  it("does not ignore native-data, nor any path outside ios and android", () => {
    const ignored = [...triggers().matchAll(/^\s+- "([^"]+)"$/gm)].map((match) => match[1]);
    expect(ignored).toEqual(["ios/**", "android/**", "ios/**", "android/**"]);
    expect(triggers()).not.toMatch(/^\s+paths:/m);
  });
});
