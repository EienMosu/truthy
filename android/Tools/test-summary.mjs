#!/usr/bin/env node
// Sums the JUnit XML reports of a connected test run and names the failed tests.
//   node android/Tools/test-summary.mjs android/Truthy/app/build/outputs/androidTest-results
// Exits 1 when a test failed or no test ran.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const folder = process.argv[2];
const totals = { tests: 0, failures: 0, errors: 0, skipped: 0 };
const failed = [];
for (const name of readdirSync(folder, { recursive: true })) {
  if (!/(^|\/)TEST-[^/]*\.xml$/.test(name)) continue;
  const xml = readFileSync(join(folder, name), "utf8");
  for (const suite of xml.matchAll(/<testsuite\b[^>]*>/g)) {
    for (const key of Object.keys(totals)) totals[key] += Number(new RegExp(`\\b${key}="(\\d+)"`).exec(suite[0])?.[1] ?? 0);
  }
  for (const chunk of xml.split("<testcase").slice(1)) {
    const body = chunk.split("</testcase>")[0];
    if (!/<(failure|error)\b/.test(body)) continue;
    const test = /\bname="([^"]*)"/.exec(chunk)?.[1];
    const owner = /\bclassname="([^"]*)"/.exec(chunk)?.[1];
    failed.push(`${owner}.${test}`);
  }
}
console.log(`tests ${totals.tests}, failures ${totals.failures}, errors ${totals.errors}, skipped ${totals.skipped}`);
for (const name of failed) console.log(`failed: ${name}`);
process.exit(totals.tests > 0 && totals.failures + totals.errors === 0 ? 0 : 1);
