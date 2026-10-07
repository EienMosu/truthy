import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

const ROOT = join(import.meta.dirname, "..");

describe("response headers", () => {
  it("sends the hardening headers on every route, and Cache-Control: no-cache on /sw.js only", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.map((rule) => rule.source)).toEqual(["/:path*", "/sw.js"]);
    const headers = (index: number) => Object.fromEntries((rules[index]?.headers ?? []).map((header) => [header.key, header.value]));
    expect(headers(0)).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
    });
    // The browser checks the worker script on every visit, so a new release is found at once (spec section 9).
    // Next applies every rule whose source matches, so /sw.js gets both.
    expect(headers(1)).toEqual({ "Cache-Control": "no-cache" });
  });

  it("does not announce the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("CI workflow", () => {
  it("runs with a read-only token", () => {
    const workflow = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain("\npermissions:\n  contents: read\n");
  });
});
