// Spec section 8, "Moving to /play offline" and "Coming back to the start offline", decided by check C1 of the
// step 3 plan: when the React Server Components fetch of a client navigation fails (the browser is offline),
// Next.js 16.3.8 falls back to a full document navigation (location.assign for router.push, location.replace
// for router.replace), and the service worker answers that navigation from its cache. So the start flow keeps
// router.push("/play") and the play screen keeps router.replace("/"). These tests pin the two things that
// fallback rests on; when one fails after a Next.js upgrade, run check C1 again before changing the test.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

const require = createRequire(import.meta.url);
const NEXT_CLIENT = join(dirname(require.resolve("next/package.json")), "dist", "client", "components");

function nextSource(path: string): string {
  return readFileSync(join(NEXT_CLIENT, path), "utf8");
}

describe("an offline client navigation becomes a document load", () => {
  it("does not turn on Next's offline mode, which waits for the network instead of loading the document", () => {
    const experimental = (nextConfig.experimental ?? {}) as Record<string, unknown>;
    expect(experimental.useOffline ?? false).toBe(false);
  });

  it("falls back to the browser's navigation when the payload fetch fails", () => {
    const fetching = nextSource("router-reducer/fetch-server-response.js");
    expect(fetching).toContain("Falling back to browser navigation.");
    expect(fetching).toContain("return originalUrl.toString();");
  });

  it("keeps the history a push or a replace would have made", () => {
    const router = nextSource("app-router.js");
    expect(router).toMatch(/if \(pushRef\.pendingPush\) \{\s*location\.assign\(canonicalUrl\);\s*\} else \{\s*location\.replace\(canonicalUrl\);/);
  });
});
