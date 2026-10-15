import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { openIssues, parseChecklist, structureProblems, summarise } from "./checklist.mjs";

const item = (id, result, extra = "Do: x\nExpect: y\n") => `#### ${id}. Title ${id}\n${extra}Result: ${result}\n\n`;
const pass = "PASS (API 36, truthy-api36, build abc1234, 2026-10-20, f1-api36.mp4)";

test("items are read with their id, title, status and detail", () => {
  const items = parseChecklist(item("F1", pass) + item("F2", "PENDING"));
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    id: "F1",
    title: "Title F1",
    status: "PASS",
    detail: "API 36, truthy-api36, build abc1234, 2026-10-20, f1-api36.mp4",
    hasDo: true,
    hasExpect: true,
  });
  assert.equal(items[1].status, "PENDING");
  assert.equal(items[1].detail, "");
});

test("structure: ids run F1, F2, ... without gaps, every item has Do, Expect and a known Result", () => {
  assert.deepEqual(structureProblems(parseChecklist(item("F1", "PENDING") + item("F2", "PENDING"))), []);
  const broken = parseChecklist(item("F1", "PENDING") + item("F3", "MAYBE") + "#### F4. No result\nDo: x\nExpect: y\n");
  const problems = structureProblems(broken);
  assert.ok(problems.some((p) => p.startsWith("F3: expected id F2")));
  assert.ok(problems.some((p) => p.startsWith("F3: unknown status MAYBE")));
  assert.ok(problems.some((p) => p.startsWith("F4: no Result line")));
  assert.ok(structureProblems(parseChecklist(item("F1", "PENDING", "Do: x\n"))).some((p) => p.startsWith("F1: no Expect line")));
});

test("done gate: pending and failed items block, a pass names the API level and the date, a skip its reason", () => {
  assert.deepEqual(openIssues(parseChecklist(item("F1", pass) + item("F2", "SKIP (no Android phone; emulators do not vibrate)"))), []);
  const issues = openIssues(
    parseChecklist(item("F1", "PENDING") + item("F2", "FAIL (the card jumps on release)") + item("F3", "PASS") + item("F4", "PASS (looked fine)") + item("F5", "SKIP")),
  );
  assert.deepEqual(issues, [
    "F1: still pending",
    "F2: failed (the card jumps on release)",
    "F3: a PASS needs (API level, emulator or phone, build, date)",
    "F4: a PASS needs (API level, emulator or phone, build, date)",
    "F5: a SKIP needs a reason in parentheses",
  ]);
});

test("the summary counts each status", () => {
  const items = parseChecklist(item("F1", "PENDING") + item("F2", "PENDING") + item("F3", "FAIL (x)"));
  assert.deepEqual(summarise(items), { PENDING: 2, PASS: 0, FAIL: 1, SKIP: 0 });
});

test("the committed checklist is well formed and every item names where it is checked", () => {
  const items = parseChecklist(readFileSync(new URL("./FEEL-CHECKLIST.md", import.meta.url), "utf8"));
  assert.ok(items.length >= 23);
  assert.deepEqual(structureProblems(items), []);
  for (const entry of items) assert.match(entry.title, /API (36|34|33|26)|phone/, `${entry.id} names no API level`);
});
