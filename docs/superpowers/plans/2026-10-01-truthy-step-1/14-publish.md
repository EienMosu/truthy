### Task 14: Publish: GitHub repository and Vercel

Tasks 1 to 13 are done and committed on `main`. This task makes the repository safe to publish, adds the licences, creates the public repository `EienMosu/truthy`, checks CI, deploys `main` on Vercel through Vercel's GitHub integration (imported in the dashboard, no Vercel CLI, no `.vercel/` folder), verifies the production URL and records it in the README.

Every step that touches an account starts with the account check in step 1 and stops if it does not show `EienMosu`. Steps marked **Owner action or explicit go-ahead required** change something outside the machine: do not run them until the owner says so in this session. Every command runs from the repository root.

**Files:**
- Create: `tests/repo-hygiene.test.ts`, `tests/publish-files.test.ts`, `LICENSE`, `content/LICENSE.md`
- Modify: `package.json` (one field), `README.md` (a License section, then the production URL line)
- Outside the machine: GitHub repository `EienMosu/truthy` (public), Vercel project `truthy` on the owner's personal Vercel account

**Interfaces:**
- Consumes:
  - Package scripts `test`, `typecheck`, `build` (with `prebuild` = `pnpm build:tokens && pnpm build:decks`, task 3), `e2e` (task 13); `.github/workflows/ci.yml` (workflow name `checks`, tasks 1 and 13); `vercel.json` (`{"$schema", "regions": ["fra1"]}`, task 1); `.gitignore` entries `app/tokens.css` and `public/decks/` (task 1).
  - `DeckIndexSchema` and `DeckFileSchema` from `@/src/content/schema` (task 3), used by the production check in step 17.
  - The description text `A true or false card game that teaches IT, one swipe at a time.` (`APP_DESCRIPTION`, `src/meta.ts`, task 1).
- Produces:
  - `tests/repo-hygiene.test.ts`: a permanent CI gate. Every tracked text file and symlink target is free of absolute local paths (`/Users/<x>`, `/home/<x>`, anything under `/private/tmp`, `/private/var` or `/var/folders`, `C:\Users\<x>`), home folders encoded into folder names (`-Users-<x>-`), e-mail addresses other than `EienMosu@users.noreply.github.com`, and secret shapes (AWS access key ids, GitHub tokens, `sk-`, Slack and Google API keys, private key blocks).
  - `tests/publish-files.test.ts`: licence files, the Vercel build guard and the README production URL line.
  - `LICENSE` (MIT, `Copyright (c) 2026 EienMosu`), `content/LICENSE.md` (CC BY 4.0 notice), `package.json` `"license": "MIT"`.
  - `https://github.com/EienMosu/truthy` (public, default branch `main`) and a production URL recorded in `README.md` as the line `Play it on your phone at https://<production domain>`.

- [ ] **Step 1: Check the accounts and the starting state (read-only)**

Run:

```bash
git config user.name && git config user.email
gh auth status --active --hostname github.com
gh api user --jq .login
ssh -T -l git github.com
gh repo view EienMosu/truthy
git status --porcelain
git log --all --format='%an <%ae>%n%cn <%ce>' | sort -u
```

Expected:

```
EienMosu
EienMosu@users.noreply.github.com
github.com
  ✓ Logged in to github.com account EienMosu (keyring)
  - Active account: true
  ...
EienMosu
Hi EienMosu! You've successfully authenticated, but GitHub does not provide shell access.
GraphQL: Could not resolve to a Repository with the name 'EienMosu/truthy'. (repository)
EienMosu <EienMosu@users.noreply.github.com>
```

`git status --porcelain` prints nothing. Stop and tell the owner if any account line names anything other than `EienMosu`, if `gh repo view` finds an existing repository, or if the author list has a second line. Fix the git identity only with `git config user.name EienMosu && git config user.email EienMosu@users.noreply.github.com`; never switch `gh` or SSH accounts yourself.

- [ ] **Step 2: Ask the owner the licence question (Owner action)**

The specification leaves the licence open until publishing. Ask, word for word:

> Before Truthy goes public: which licences? Proposed default: MIT for the code (copyright holder "EienMosu") and CC BY 4.0 for the card content in `content/`. Everything outside `content/`, including `design/`, falls under MIT. Confirm, or name the licences and the copyright holder you want.

Wait for the answer. Steps 8 to 12 are written for the default. If the owner picks something else, change the expected strings in `tests/publish-files.test.ts` (step 8) and the texts in step 10 to match before running them; nothing else in this task depends on the licence.

- [ ] **Step 3: Write the hygiene test**

Create `tests/repo-hygiene.test.ts`. The rule tests check that each rule flags its sample; the tracked-files test is the gate itself. The samples in the rule tests are built from pieces so that the file never contains what it scans for (the test scans itself).

```ts
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The repository is public. Nothing tracked may reveal a local machine, a work identity or a secret.
const ROOT = join(import.meta.dirname, "..");
const ALLOWED_EMAIL = "EienMosu@users.noreply.github.com";

const RULES: readonly { name: string; pattern: RegExp }[] = [
  // A slash-led home or temp path, but not the same words inside a web URL ("example.com/home/x").
  { name: "absolute local path", pattern: /(?<![\w.-])(?:\/Users|\/home|\/private\/tmp|\/private\/var|\/var\/folders)\/[\w.-]+/ },
  { name: "Windows user path", pattern: /\b[A-Za-z]:\\Users\\[\w.-]+/ },
  // Tools encode a home folder into a folder name, for example a transcript folder per project.
  { name: "encoded local path", pattern: /-Users-[A-Za-z0-9.]+-/ },
  { name: "AWS access key id", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "GitHub token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { name: "API key", pattern: /\b(?:sk-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})/ },
  { name: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

function findingsIn(text: string): string[] {
  const found: string[] = [];
  text.split("\n").forEach((line, index) => {
    for (const rule of RULES) {
      const match = rule.pattern.exec(line);
      if (match) found.push(`${index + 1}: ${rule.name}: ${match[0]}`);
    }
    for (const match of line.matchAll(EMAIL)) {
      if (match[0] !== ALLOWED_EMAIL) found.push(`${index + 1}: e-mail address: ${match[0]}`);
    }
  });
  return found;
}

function trackedFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  return out.split("\0").filter((path) => path.length > 0);
}

function scanRepository(): string[] {
  const found: string[] = [];
  for (const path of trackedFiles()) {
    const full = join(ROOT, path);
    let stats;
    try {
      stats = lstatSync(full);
    } catch {
      continue; // deleted in the working tree but not yet committed
    }
    if (stats.isSymbolicLink()) {
      // The link target is published as text.
      for (const finding of findingsIn(readlinkSync(full))) found.push(`${path} -> ${finding}`);
      continue;
    }
    const bytes = readFileSync(full);
    if (bytes.includes(0)) continue; // binary (images, fonts)
    for (const finding of findingsIn(bytes.toString("utf8"))) found.push(`${path}:${finding}`);
  }
  return found;
}

describe("hygiene rules", () => {
  // Samples are built from pieces so that this file never contains what it looks for.
  const home = "/" + "Users/alex";
  const temp = "/" + "private/tmp/tool.mjs";
  const key = "AKIA" + "ABCDEFGHIJKLMNOP";
  const email = "someone" + "@" + "example.org";

  it("flags a home folder path", () => {
    expect(findingsIn(`see ${home}/notes.md`)).toEqual([`1: absolute local path: ${home}`]);
  });

  it("flags a temp folder path", () => {
    expect(findingsIn(`node ${temp}`)).toEqual([`1: absolute local path: ${temp}`]);
  });

  it("flags a home folder encoded into a folder name", () => {
    expect(findingsIn("~/.cache/projects/" + "-Users-" + "alex-work/*.jsonl")).toHaveLength(1);
  });

  it("leaves web URLs that happen to contain /home/ alone", () => {
    expect(findingsIn("https://cloud.google.com/home/dashboard")).toEqual([]);
  });

  it("flags an AWS access key id and a GitHub token", () => {
    expect(findingsIn(key)).toEqual([`1: AWS access key id: ${key}`]);
    expect(findingsIn("token=" + "ghp_" + "a".repeat(36))).toHaveLength(1);
  });

  it("does not mistake a hyphenated word ending in sk for a key", () => {
    expect(findingsIn('"datasync-task-runs-versus-live-mount"')).toEqual([]);
  });

  it("flags any e-mail address except the GitHub noreply one", () => {
    expect(findingsIn(`write to ${email}`)).toEqual([`1: e-mail address: ${email}`]);
    expect(findingsIn(`Author: EienMosu <${ALLOWED_EMAIL}>`)).toEqual([]);
  });
});

describe("tracked files", () => {
  it("contain no local paths, foreign e-mail addresses or secrets", () => {
    expect(scanRepository()).toEqual([]);
  });
});
```

- [ ] **Step 4: Run it and read the findings**

Run:

```bash
pnpm vitest run tests/repo-hygiene.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

Task 1 step 35 rewrote the slash paths and the three files that held the home folder in the hyphen-encoded form (`content/outlines/gcp.md`, `content/save-pasted.py`, `design/research/references.md`) before the move commit, so the scan finds nothing. To see that the gate bites, its rule tests flag a sample of every kind.

What to do on any finding (the test then fails and lists `<file>:<line>: <rule>: <match>`):
- Local path in a note or result file: rewrite it relative, with the same perl substitutions as task 1 step 35, and add the file to the step 6 commit.
- Local path in a plan or notes file under `docs/` (for example a committed implementation plan): rewrite it the same way, or ask the owner whether that file belongs in the public repository at all.
- E-mail address: show it to the owner. Remove it, or, if the owner says it is meant to be public (a published contact address in card content), add it next to `ALLOWED_EMAIL` as a second allowed constant with a comment saying why.
- Secret: stop the whole task. Tell the owner the file and line (never paste the value), ask them to revoke or rotate it, and do not publish. A secret in any commit is public forever once pushed; step 13 checks the history.

- [ ] **Step 5: Confirm that no commit ever held an encoded home folder (read-only)**

The fix belongs to task 1, before the first commit of `content/` and `design/`; check that it happened there and not later:

```bash
grep -n "TRANSCRIPTS =" content/save-pasted.py
git grep -IlE -e '-Users-[A-Za-z0-9.]+-' $(git rev-list --all); echo "encoded in history: $?"
```

Expected: `16:TRANSCRIPTS = os.path.join(os.path.expanduser('~/.claude/projects'), re.sub(r'[/.]', '-', str(pathlib.Path.home())), '*.jsonl')`, then `encoded in history: 1` (`git grep` exits 1 when it finds nothing). If either differs, task 1 step 35 was run in its older form: stop and tell the owner, because the move commit then holds the user name; fix the files as task 1 step 35 does and ask the owner whether to rewrite the history before the first push in step 14.

- [ ] **Step 6: Run the hygiene test and commit**

The scan reads tracked files, so stage first:

```bash
git add tests/repo-hygiene.test.ts
pnpm vitest run tests/repo-hygiene.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

Then:

```bash
git commit -m "chore: scan tracked files for local paths, e-mail addresses and secrets"
```

- [ ] **Step 7: Run the full unit suite**

Run:

```bash
pnpm test && pnpm typecheck
```

Expected: every test file passes (0 failed) and `tsc --noEmit` prints nothing.

- [ ] **Step 8: Write the failing licence and Vercel test**

Create `tests/publish-files.test.ts`. The two Vercel tests pass already; they guard what tasks 1 and 3 set up, because a build override in the Vercel project or a dropped `prebuild` deploys a site without `public/decks/` (both generated folders are gitignored).

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("licences", () => {
  it("licenses the code under MIT in the root LICENSE file", () => {
    const licence = read("LICENSE");
    expect(licence.startsWith("MIT License\n\nCopyright (c) 2026 EienMosu\n")).toBe(true);
    expect(licence).toContain('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND');
  });

  it("declares the same licence in package.json", () => {
    expect(JSON.parse(read("package.json")).license).toBe("MIT");
  });

  it("licenses the card content under CC BY 4.0 with a link to the licence", () => {
    const notice = read("content/LICENSE.md");
    expect(notice).toContain("Creative Commons Attribution 4.0 International");
    expect(notice).toContain("https://creativecommons.org/licenses/by/4.0/");
  });

  it("names both licences in the README", () => {
    const readme = read("README.md");
    expect(readme).toContain("\n## License\n");
    expect(readme).toContain("[MIT](LICENSE)");
    expect(readme).toContain("[CC BY 4.0](content/LICENSE.md)");
  });
});

describe("Vercel build", () => {
  it("leaves the build, install and output settings to the Next.js preset", () => {
    const config = JSON.parse(read("vercel.json"));
    expect(Object.keys(config).sort()).toEqual(["$schema", "regions"]);
    expect(config.regions).toEqual(["fra1"]);
  });

  it("generates the tokens and the decks before every build, because both are gitignored", () => {
    const scripts = JSON.parse(read("package.json")).scripts;
    expect(scripts.prebuild).toBe("pnpm build:tokens && pnpm build:decks");
    expect(scripts.build).toBe("next build");
    const ignored = read(".gitignore").split("\n");
    expect(ignored).toContain("app/tokens.css");
    expect(ignored).toContain("public/decks/");
  });
});
```

- [ ] **Step 9: Run it and watch it fail**

Run:

```bash
pnpm vitest run tests/publish-files.test.ts
```

Expected: FAIL with

```
     × licenses the code under MIT in the root LICENSE file
     × declares the same licence in package.json
     × licenses the card content under CC BY 4.0 with a link to the licence
     × names both licences in the README
Error: ENOENT: no such file or directory, open '.../LICENSE'
AssertionError: expected undefined to be 'MIT' // Object.is equality
Error: ENOENT: no such file or directory, open '.../content/LICENSE.md'
AssertionError: expected '# Truthy\n\nA mobile-first true or fa…' to contain '\n## License\n'
      Tests  4 failed | 2 passed (6)
```

If a Vercel test fails too, an earlier task changed `vercel.json`, `prebuild` or `.gitignore`: stop and report it, do not edit the test.

- [ ] **Step 10: Add the licences**

Create `LICENSE`:

```
MIT License

Copyright (c) 2026 EienMosu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Create `content/LICENSE.md`:

```markdown
# Card content license

The card content in this folder (statements, explanations, answers, and the source titles and links each card cites) is licensed under the Creative Commons Attribution 4.0 International license (CC BY 4.0): https://creativecommons.org/licenses/by/4.0/

Attribute it as: "Truthy card content by EienMosu, https://github.com/EienMosu/truthy, CC BY 4.0".

The documentation pages the cards link to belong to their owners and are not covered by this license. The code in this repository is licensed separately under the MIT license in [../LICENSE](../LICENSE).
```

Append to the end of `README.md` (one blank line before the heading):

```markdown

## License

The code is licensed under [MIT](LICENSE). The card content in `content/` is licensed under [CC BY 4.0](content/LICENSE.md); the documentation pages the cards link to belong to their owners.
```

In `package.json`, add one line directly after `"private": true,`:

```json
  "license": "MIT",
```

so the top of the file reads:

```json
{
  "name": "truthy",
  "version": "0.1.0",
  "private": true,
  "license": "MIT",
  "type": "module",
```

- [ ] **Step 11: Run it and watch it pass**

Run:

```bash
pnpm vitest run tests/publish-files.test.ts && git add LICENSE content/LICENSE.md README.md package.json tests/publish-files.test.ts && pnpm vitest run tests/repo-hygiene.test.ts
```

Expected: `Tests  6 passed (6)`, then `Tests  8 passed (8)` (the new files are scanned too).

- [ ] **Step 12: Commit**

```bash
git commit -m "docs: license the code under MIT and the card content under CC BY 4.0"
```

- [ ] **Step 13: Pre-publish check (read-only)**

All four gates, a clean tree, and the whole history (a public repository publishes every commit, not only the last one):

```bash
pnpm test && pnpm typecheck && pnpm build && pnpm e2e
git status --porcelain
git log --all --format='%an <%ae>%n%cn <%ce>' | sort -u
git log --all --format=%B | grep -inE 'co-authored-by|generated with'
git grep -IlE '(^|[^A-Za-z0-9._-])(/Users|/home|/private/tmp|/private/var|/var/folders)/[A-Za-z0-9._-]+|-Users-[A-Za-z0-9.]+-' $(git rev-list --all)
git grep -IhoE '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}' $(git rev-list --all) | sort -u
git grep -InE '(AKIA|ASIA)[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|(^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----' $(git rev-list --all)
```

Expected: the four gates pass (0 failed unit tests, no `tsc` output, `next build` lists `/` and `/play` as static, Playwright reports every spec passed in `phone-chromium` and `phone-webkit`); `git status --porcelain` prints nothing; the author list is the single line `EienMosu <EienMosu@users.noreply.github.com>`; the commit message grep prints nothing; the e-mail grep prints only `EienMosu@users.noreply.github.com`; the secret grep prints nothing.

The path grep lists `<commit>:<file>` pairs. Expected: it prints nothing, because task 1 step 35 cleaned `content/` and `design/` before their first commit. Any hit: handle it as in step 4 and show the list to the owner, asking whether to rewrite the history before the first push (nothing is public yet, so a rewrite is still harmless now and never after step 14); for a secret in history stop: it must be rotated and the history rewritten before anything is pushed.

- [ ] **Step 14: Create the public repository and push (Owner action or explicit go-ahead required)**

Re-run the account check, then create the repository without `--source` so the remote can be the SSH one that step 1 proved belongs to EienMosu (`gh` itself uses HTTPS on this machine and no git credential helper is configured):

```bash
gh api user --jq .login && ssh -T -l git github.com
gh repo create EienMosu/truthy --public --description "A true or false card game that teaches IT, one swipe at a time." --disable-wiki
SSH_USER=git
git remote add origin "${SSH_USER}@github.com:EienMosu/truthy.git"
git push -u origin main
gh repo view EienMosu/truthy --json visibility,defaultBranchRef --jq '.visibility + " " + .defaultBranchRef.name'
```

`ssh -l git` and the `SSH_USER` variable give the same login and remote as the usual `user@host` form, written so that this committed plan holds no e-mail-shaped string for the hygiene test. Expected: `EienMosu`, the SSH greeting for EienMosu, `✓ Created repository EienMosu/truthy on github.com` with `https://github.com/EienMosu/truthy`, the push ending in `branch 'main' set up to track 'origin/main'.`, and `PUBLIC main`.

- [ ] **Step 15: Check that CI runs and passes (read-only)**

```bash
gh api repos/EienMosu/truthy/actions/permissions --jq .enabled
git rev-parse HEAD
gh run list --repo EienMosu/truthy --branch main --limit 1 --json databaseId,workflowName,headSha,status
gh run watch <databaseId from the line above> --repo EienMosu/truthy --exit-status
```

Expected: `true`; a run of workflow `checks` whose `headSha` equals `git rev-parse HEAD` (if the list is empty, the run has not been queued yet: repeat the command after a few seconds); `gh run watch` ends with `✓ main checks · <id>` and exit code 0. On failure, read `gh run view <id> --repo EienMosu/truthy --log-failed`, reproduce the failure locally, fix it test first in a new commit, and push again (the push needs the go-ahead again).

- [ ] **Step 16: Connect Vercel (Owner action)**

Vercel needs the owner's login, so the owner does this in the dashboard; read these steps out to them:

1. Sign in at https://vercel.com with the owner's personal Vercel account. Check the scope selector at the top left shows that personal account; stop if it shows anything else.
2. Add New, then Project. Under "Import Git Repository" the GitHub account is `EienMosu`. If `truthy` is not listed, choose "Adjust GitHub App Permissions", add `EienMosu/truthy` to the repository access, save, and come back.
3. Press Import next to `truthy`.
4. Configure: Project Name `truthy`; Framework Preset `Next.js` (detected); Root Directory `./`; Build and Output Settings: leave every Override switch off (Vercel then runs `pnpm install` and `pnpm run build`, and pnpm runs `prebuild` first); Environment Variables: none. Press Deploy.
5. In the build log check that `> truthy@0.1.0 prebuild` appears before `> truthy@0.1.0 build`, and that the build ends with the route table and "Deployment completed". If the install step fails on the pnpm version, add the one environment variable `ENABLE_EXPERIMENTAL_COREPACK` = `1` (Vercel's switch for honouring `packageManager` in `package.json`) and redeploy; that is the only allowed exception to "no environment variables".
6. Settings, Git: Production Branch is `main` (pushes to `main` deploy production, pull requests get preview deployments, as the specification says). Settings, Build and Deployment: Node.js Version `24.x`. Settings, Deployment Protection: leave the default, which protects preview deployments and keeps the production domain public.
7. Settings, Domains: copy the production domain (`truthy.vercel.app` if it was free, otherwise a name such as `truthy-<words>.vercel.app`). Not a URL with `-git-` or ending in `-projects.vercel.app`: those are preview addresses behind a Vercel login.

- [ ] **Step 17: Verify the production URL**

Read-only, from this machine, with the domain from step 16:

```bash
URL=https://<production domain> pnpm exec tsx --eval '
import { DeckFileSchema, DeckIndexSchema } from "@/src/content/schema";
const base = (process.env.URL ?? "").replace(/\/$/, "");
async function get(path: string): Promise<Response> {
  const response = await fetch(base + path, { redirect: "manual" });
  if (response.status !== 200) throw new Error(`${path} returned ${response.status}`);
  return response;
}
async function main(): Promise<void> {
  const html = await (await get("/")).text();
  if (!html.includes("<title>Truthy</title>")) throw new Error("the home page has no Truthy title");
  console.log("home ok");
  await get("/play");
  console.log("play ok");
  const index = DeckIndexSchema.parse(await (await get("/decks/index.json")).json());
  for (const deck of index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks))) {
    const file = DeckFileSchema.parse(await (await get(`/decks/${deck.id}.json`)).json());
    if (file.hash !== deck.hash || file.cards.length !== deck.cardCount) throw new Error(`${deck.id} does not match the index`);
    console.log(`deck ok: ${deck.id} ${deck.cardCount} cards ${deck.hash}`);
  }
}
main().catch((error: unknown) => {
  console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
'
node -e 'const i=require("./public/decks/index.json");for(const a of i.areas)for(const p of a.platforms)for(const d of p.decks)console.log(`local: ${d.id} ${d.cardCount} cards ${d.hash}`)'
```

Expected: `home ok`, `play ok`, then one `deck ok: <id> <count> cards <hash>` per deck, and the `local:` lines from step 13's build show the same ids, counts and hashes (hashes are content hashes, so the build date does not change them). `redirect: "manual"` makes a Vercel login wall fail as `/ returned 302` or `401` instead of passing silently. Any `FAILED:` line: check step 16, item 4 and 5 (a build override or a missing `prebuild` leaves `/decks/index.json` at 404).

Then on a phone (Owner action), at the production URL in Safari on iPhone and, if available, Chrome on Android:
1. The home screen loads with the logo and the boarding pass.
2. Fill in the pass, play a full Classic round of ten cards with both swipes and buttons, and reach the result screen with the score.
3. Add to the home screen (Safari: Share, Add to Home Screen; Chrome: menu, Add to home screen or Install app). The icon is labelled "Truthy" and opening it shows the start screen without the browser bar.

Write down anything that fails and stop; do not record the URL until all three pass.

- [ ] **Step 18: Write the failing test for the production URL line**

Append to `tests/publish-files.test.ts`:

```ts

describe("production URL", () => {
  it("is recorded in the README as the public production address, not a preview one", () => {
    const line = /^Play it on your phone at (https:\/\/[a-z0-9.-]+)\/?$/m.exec(read("README.md"));
    expect(line, "README needs a line: Play it on your phone at https://<production domain>").not.toBeNull();
    const url = line?.[1] ?? "";
    // Preview and branch URLs carry "-git-" or the team slug and sit behind Vercel's login wall.
    expect(url).not.toMatch(/-git-|-projects\.vercel\.app$/);
  });
});
```

Run:

```bash
pnpm vitest run tests/publish-files.test.ts
```

Expected: FAIL with

```
     × is recorded in the README as the public production address, not a preview one
AssertionError: README needs a line: Play it on your phone at https://<production domain>: expected null not to be null
      Tests  1 failed | 6 passed (7)
```

- [ ] **Step 19: Record the URL, run the gates and commit**

Insert the line after the README's first paragraph (with the real domain from step 16):

```bash
URL=https://<production domain>
perl -0pi -e "s#\A(\# Truthy\n\n[^\n]+\n)#\$1\nPlay it on your phone at $URL\n#" README.md
git diff README.md
pnpm vitest run tests/publish-files.test.ts && pnpm test && pnpm typecheck
```

Expected: the diff adds `Play it on your phone at https://<production domain>` and a blank line between the first paragraph and the "design specification" paragraph; `Tests  7 passed (7)`; the full suite passes; no `tsc` output.

```bash
git add README.md tests/publish-files.test.ts
git commit -m "docs: record the production URL"
```

- [ ] **Step 20: Push and set the repository homepage (Owner action or explicit go-ahead required)**

```bash
gh api user --jq .login
git push
gh repo edit EienMosu/truthy --homepage "https://<production domain>"
gh run list --repo EienMosu/truthy --branch main --limit 1 --json databaseId,headSha,status
gh run watch <databaseId> --repo EienMosu/truthy --exit-status
```

Expected: `EienMosu`; the push succeeds; `gh repo edit` prints nothing; the `checks` run for the new `HEAD` passes. In the Vercel dashboard (Owner) the Deployments list shows the commit "docs: record the production URL" as Production, Ready, and the production URL still passes step 17's check.

#### Review focus candidates

1. A home folder hidden in a hyphen-encoded folder name (`~/.claude/projects/-Users-<name>-...`) gets published. Task 1 step 35 removes the three such files' encoded paths before the first commit of `content/` and `design/` (found when this test first ran against a slash-only rewrite); "flags a home folder encoded into a folder name" and the tracked-files scan in `tests/repo-hygiene.test.ts`, steps 3 to 6, keep any new one out, and steps 5 and 13 check the history.
2. The README or the repository homepage points at a preview deployment, so visitors hit a Vercel login wall instead of the game. Covered by "is recorded in the README as the public production address, not a preview one" in `tests/publish-files.test.ts`, steps 18 and 19, and by step 17's check, which treats any redirect or 401 as a failure.
3. A build command override in the Vercel project or a dropped `prebuild` deploys a site without `public/decks/` (gitignored), so the start flow cannot load the catalog. Covered by "leaves the build, install and output settings to the Next.js preset" and "generates the tokens and the decks before every build, because both are gitignored" in `tests/publish-files.test.ts`, steps 8 to 12, and on the live site by step 17's deck check.
