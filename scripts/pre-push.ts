// Run by .githooks/pre-push: scans every commit about to be pushed with the repository hygiene rules and
// refuses the push on a finding. Git passes one line per ref on standard input.
import { readFileSync } from "node:fs";
import { pushRanges, scanCommits } from "./hygiene";

const cwd = process.cwd();
const findings = pushRanges(cwd, readFileSync(0, "utf8")).flatMap((revisions) => scanCommits(cwd, revisions));
const unique = [...new Set(findings)];

if (unique.length > 0) {
  console.error("pre-push: the repository is public, and these commits would publish:");
  for (const finding of unique) console.error(`  ${finding}`);
  console.error("Rewrite the commits (git rebase -i, git commit --amend), then push again.");
  process.exit(1);
}
