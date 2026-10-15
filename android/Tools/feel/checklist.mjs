// Reads FEEL-CHECKLIST.md: every item is a "#### F<n>. Title" heading followed by Do, Expect and Result lines.
//   node checklist.mjs <FEEL-CHECKLIST.md>          prints the counts, exits 1 when the file is malformed
//   node checklist.mjs <FEEL-CHECKLIST.md> --done   also exits 1 while an item is pending, failed or recorded without its details
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const STATUSES = ["PENDING", "PASS", "FAIL", "SKIP"];

export function parseChecklist(text) {
  const items = [];
  let current = null;
  for (const line of text.split("\n")) {
    const head = /^#### (F\d+)\. (.+)$/.exec(line);
    if (head) {
      current = { id: head[1], title: head[2], status: null, detail: "", hasDo: false, hasExpect: false };
      items.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("Do: ")) current.hasDo = true;
    else if (line.startsWith("Expect: ")) current.hasExpect = true;
    else if (current.status === null) {
      const result = /^Result: (\S+)(?: \((.*)\))?\s*$/.exec(line);
      if (result) {
        current.status = result[1];
        current.detail = result[2] ?? "";
      }
    }
  }
  return items;
}

export function structureProblems(items) {
  const problems = [];
  items.forEach((item, index) => {
    if (item.id !== `F${index + 1}`) problems.push(`${item.id}: expected id F${index + 1}`);
    if (!item.hasDo) problems.push(`${item.id}: no Do line`);
    if (!item.hasExpect) problems.push(`${item.id}: no Expect line`);
    if (item.status === null) problems.push(`${item.id}: no Result line`);
    else if (!STATUSES.includes(item.status)) problems.push(`${item.id}: unknown status ${item.status}`);
  });
  return problems;
}

export function openIssues(items) {
  const issues = [];
  for (const item of items) {
    if (item.status === "PENDING") issues.push(`${item.id}: still pending`);
    else if (item.status === "FAIL") issues.push(`${item.id}: failed (${item.detail})`);
    else if (item.status === "SKIP" && item.detail === "") issues.push(`${item.id}: a SKIP needs a reason in parentheses`);
    else if (item.status === "PASS" && !(/API \d+/.test(item.detail) && /\d{4}-\d{2}-\d{2}/.test(item.detail))) {
      issues.push(`${item.id}: a PASS needs (API level, emulator or phone, build, date)`);
    }
  }
  return issues;
}

export function summarise(items) {
  const counts = { PENDING: 0, PASS: 0, FAIL: 0, SKIP: 0 };
  for (const item of items) if (item.status in counts) counts[item.status] += 1;
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, flag] = process.argv.slice(2);
  const items = parseChecklist(readFileSync(file, "utf8"));
  const problems = structureProblems(items);
  const counts = summarise(items);
  console.log(`${items.length} items: ${STATUSES.map((s) => `${counts[s]} ${s}`).join(", ")}`);
  const blocking = flag === "--done" ? [...problems, ...openIssues(items)] : problems;
  for (const line of blocking) console.error(line);
  process.exit(blocking.length === 0 ? 0 : 1);
}
