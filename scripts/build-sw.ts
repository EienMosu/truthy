// Bundles src/offline/sw-entry.ts into public/sw.js, one classic script with the release version filled in.
// Runs before `next build` and `next dev`, after build:tokens and build:decks.
// Usage: tsx scripts/build-sw.ts [output file]   (default: public/sw.js)
import { execFileSync } from "node:child_process";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ENTRY = fileURLToPath(new URL("../src/offline/sw-entry.ts", import.meta.url));
const out = resolve(process.argv[2] ?? "public/sw.js");

// The commit Vercel builds, else the checkout's, else "local"; then the build time. Every build changes the
// worker's bytes, so the browser installs a new worker after each deploy and its cache gets a new name.
function commit(): string {
  const deployed = process.env.VERCEL_GIT_COMMIT_SHA;
  if (deployed) return deployed;
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "local";
  } catch {
    return "local";
  }
}

async function main(): Promise<void> {
  const version = `${commit()}-${new Date().toISOString()}`;
  await build({
    entryPoints: [ENTRY],
    outfile: out,
    bundle: true,
    format: "iife",
    target: "es2022",
    platform: "browser",
    minify: false,
    // src/offline/version.ts reads it.
    define: { __TRUTHY_VERSION__: JSON.stringify(version) },
    logLevel: "warning",
  });
  console.log(`build-sw: wrote ${relative(process.cwd(), out)}, version ${version}`);
}

main().catch((error: unknown) => {
  console.error(`build-sw: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
