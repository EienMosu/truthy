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
