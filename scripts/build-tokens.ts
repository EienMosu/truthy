// Generates app/tokens.css from design/system/tokens.json. Runs before every build (prebuild) and dev
// server start (predev). Usage: tsx scripts/build-tokens.ts [source.json] [target.css]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tokensToCss } from "@/src/tokens/build";

const source = process.argv[2] ?? fileURLToPath(new URL("../design/system/tokens.json", import.meta.url));
const target = process.argv[3] ?? fileURLToPath(new URL("../app/tokens.css", import.meta.url));

let css: string;
try {
  css = tokensToCss(JSON.parse(readFileSync(source, "utf8")));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`build:tokens failed for ${source}: ${message}`);
  process.exit(1);
}

writeFileSync(target, css);
const count = css.match(/^\s*--[a-z0-9-]+:/gm)?.length ?? 0;
console.log(`Wrote ${target} (${count} variables)`);
