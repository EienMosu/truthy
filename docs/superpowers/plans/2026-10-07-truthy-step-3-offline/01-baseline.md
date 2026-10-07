### Task 1: The baseline, esbuild and blocked service workers

Before any offline code: the branch is checked (it holds `hardening` and the commit of the step 3 spec), the four gates are green on it, and two things the later tasks need are put in place. esbuild becomes a devDependency at the version the toolchain already installs (0.28.2), so `scripts/build-sw.ts` (task 3) can import it; with pnpm's strict `node_modules` the root cannot import it today. And `playwright.config.ts` blocks service workers for every spec (spec section 11): once task 3 ships a worker, a worker would answer the page's requests before `page.route` and `context.route` see them, and the specs that route or fail requests (`storage-blocked`, `catalog`, `not-found` and others) would test the worker instead of the page. The specs that need a worker (task 3's smoke spec, task 4's registration spec, the offline and update specs of tasks 7 and 8) allow workers themselves. This task changes no application code; with no worker yet, the block changes no spec's outcome.

Check C2 measured the block in Playwright 1.63 on both engines: it works, and under it `navigator.serviceWorker.register()` resolves to `undefined` (Playwright replaces it with `async () => { console.warn("Service Worker registration blocked by Playwright"); }`) instead of rejecting. Task 4's `register.ts` must handle a missing registration; this task only writes the fact down in `docs/testing.md`.

Not in this task: the README's command table (task 3 adds `build:sw`), any e2e spec.

**Files:**
- Modify: `package.json` (devDependencies), `pnpm-lock.yaml` (through `pnpm add`: three lines in `importers`), `playwright.config.ts` (`use.serviceWorkers`), `docs/testing.md` (one bullet under "Things to know when writing one")
- Test: modify `tests/playwright-config.test.ts` (one new case), `tests/publish-files.test.ts` (one new `describe`)

**Interfaces:**
- Consumes:
  - `playwright.config.ts`: the default export (`defineConfig({ ..., use: { baseURL, trace }, projects: [phone-chromium, phone-webkit], webServer })`), imported by `tests/playwright-config.test.ts` as `config` from `@/playwright.config`.
  - `tests/publish-files.test.ts`: its `read(path)` helper (reads a file from the repository root).
  - `pnpm-lock.yaml`: `esbuild@0.28.2` is already in `packages` and `snapshots` (a dependency of vite, through vitest and `@vitejs/plugin-react`); `package.json` already lists `"esbuild"` in `pnpm.onlyBuiltDependencies`.
- Produces (for later tasks):
  - `import { build } from "esbuild"` resolves from the repository root (task 3, `scripts/build-sw.ts`), with esbuild's own types (no `@types` package).
  - `playwright.config.ts` `use.serviceWorkers === "block"`; no project overrides it. A spec that needs a worker sets `test.use({ serviceWorkers: "allow" })` (`e2e/service-worker.spec.ts` of task 3, `e2e/register.spec.ts` of task 4, `e2e/offline-navigation.spec.ts` of task 7, `e2e/offline.spec.ts` and `e2e/update.spec.ts` of task 8).
  - Known for task 3: `tests/publish-files.test.ts` "generates the tokens and the decks before every build, because both are gitignored" pins `scripts.prebuild` to `"pnpm build:tokens && pnpm build:decks"`; task 3 changes that expectation when it adds `build:sw`.

**Rules:**

1. The branch is `offline` and contains `hardening` and the spec commit `5db53f3` ("docs: add the design of step 3, offline play, as the owner approved it"); the working tree is clean. The controller has committed this plan folder and the spec's section 14 on top of `5db53f3` before this task and runs the plan in a worktree of its own for `offline` (README, "Before task 1"), so the tree is clean with them. If not, stop: the plan was written against that base.
2. `package.json` `devDependencies.esbuild` is `"0.28.2"`, exact like every other version in the file, in alphabetical order between `@vitejs/plugin-react` and `jsdom`. The lockfile gains only the importer entry and still holds one esbuild version, 0.28.2. `pnpm install --frozen-lockfile` (what CI runs) passes.
3. `playwright.config.ts`: `serviceWorkers: "block"` in the top-level `use`, after `trace`, with the comment of step 6. The projects keep their `use` as it is.
4. `docs/testing.md` gets the bullet of step 8 after the colour scheme bullet.

**Tests:**

`tests/playwright-config.test.ts`, new case after "runs both projects in the light colour scheme, whatever the machine is set to; the night spec asks for dark":

```ts
  it("blocks service workers in every spec, so a spec that routes requests sees them; an offline spec allows them itself", () => {
    expect(config.use?.serviceWorkers).toBe("block");
    for (const project of config.projects ?? []) expect(project.use?.serviceWorkers, project.name).toBeUndefined();
  });
```

`tests/publish-files.test.ts`, new block between `describe("Vercel build", ...)` and `describe("production URL", ...)`:

```ts
describe("the service worker's bundler", () => {
  it("is esbuild, a devDependency at the one version the toolchain already installs", () => {
    expect(JSON.parse(read("package.json")).devDependencies.esbuild).toBe("0.28.2");
    const lock = read("pnpm-lock.yaml");
    expect(lock).toContain("\n      esbuild:\n        specifier: 0.28.2\n        version: 0.28.2\n");
    expect([...new Set(lock.match(/^ {2}esbuild@[^:]+:$/gm))]).toEqual(["  esbuild@0.28.2:"]);
  });
});
```

The last line reads every top-level `esbuild@<version>:` key of the lockfile (`packages` and `snapshots` have one per version each) and expects 0.28.2 alone, so a second copy of esbuild cannot slip in beside the one vite uses.

**Steps:**

- [ ] **Step 1: Check the base.** From the repository root:

```bash
git rev-parse --abbrev-ref HEAD
git merge-base --is-ancestor hardening HEAD && git merge-base --is-ancestor 5db53f3 HEAD && echo base-ok
git status --porcelain
```

Expected: `offline`, then `base-ok`, then no output (a clean tree). Anything else: stop and report (rule 1).

- [ ] **Step 2: Check the baseline.** With port 3100 free (`lsof -ti :3100 | xargs kill`), or with another port in `E2E_PORT`:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

Expected: `tsc --noEmit` prints nothing after its header; `Test Files  130 passed (130)` and `Tests  2152 passed (2152)`; the build's route table lists `/`, `/_not-found`, `/apple-icon.png`, `/icon.svg`, `/manifest.webmanifest` and `/play`, all `○ (Static)`; the e2e run of 646 tests ends with `644 passed` and `2 skipped` (the two Chromium-only touch tests of `e2e/swipe.spec.ts` in `phone-webkit`). If a gate is red before any change, stop and report it: the baseline is not the one this plan was written against.

One known exception: `e2e/small-screens.spec.ts:776` "a phone turned sideways, 667 by 375 › a double tap on a card the player scrolled to chooses it once, and does not go back" fails now and then in `phone-webkit` on this baseline, on a loaded machine (`Expected: "Choose a deck"`, `Received: "Choose a platform"` at line 824). It was measured at 5 failures in 10 repeats without this task's change and 1 in 6 with it, on the same build. If it is the only failure, run it once more on its own (`pnpm exec playwright test e2e/small-screens.spec.ts:776 --project=phone-webkit`); passing there counts as green, as CI's retry would count it. It is not this task's to fix; report it with the task.

- [ ] **Step 3: Write the two tests** (the case in `tests/playwright-config.test.ts`, the block in `tests/publish-files.test.ts`, as above).

- [ ] **Step 4: Run them and watch them fail.**

```bash
pnpm vitest run tests/playwright-config.test.ts tests/publish-files.test.ts
```

Expected: `Test Files  2 failed (2)`, `Tests  2 failed | 14 passed (16)`. The config case fails with `AssertionError: expected undefined to be 'block'` at `expect(config.use?.serviceWorkers).toBe("block")`; the bundler case with `AssertionError: expected undefined to be '0.28.2'` at the `devDependencies.esbuild` line. Also confirm that the root cannot import esbuild yet:

```bash
node -e "import('esbuild').then((m) => console.log(m.version), (e) => console.log(e.code))"
```

Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 5: Add esbuild as a devDependency.**

```bash
pnpm add --save-dev --save-exact --prefer-offline esbuild@0.28.2
```

Expected: the output ends with `devDependencies:` and `+ esbuild 0.28.2`. `git diff package.json pnpm-lock.yaml` shows exactly this:

```diff
--- a/package.json
+++ b/package.json
@@ -37,6 +37,7 @@
     "@types/react": "19.2.18",
     "@types/react-dom": "19.2.7",
     "@vitejs/plugin-react": "6.1.1",
+    "esbuild": "0.28.2",
     "jsdom": "30.1.1",
     "tailwindcss": "4.3.3",
     "tsx": "4.23.15",
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -48,6 +48,9 @@ importers:
       '@vitejs/plugin-react':
         specifier: 6.1.1
         version: 6.1.1(vite@8.3.1(@types/node@24.19.0)(esbuild@0.28.2)(jiti@2.7.0)(tsx@4.23.15))
+      esbuild:
+        specifier: 0.28.2
+        version: 0.28.2
       jsdom:
         specifier: 30.1.1
         version: 30.1.1
```

If `pnpm add` changes anything else in the lockfile (another version, a new resolution), stop, run `git checkout package.json pnpm-lock.yaml` and report it. Then:

```bash
pnpm install --frozen-lockfile
node -e "import('esbuild').then((m) => console.log(m.version), (e) => console.log(e.code))"
```

Expected: the install ends with `Done in ...`, and the import prints `0.28.2`.

- [ ] **Step 6: Block service workers in `playwright.config.ts`.** The top-level `use` becomes:

```ts
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // The game registers a service worker from step 3 on. A worker answers a page's requests before page.route and
    // context.route see them, so the specs that route or fail requests would test the worker instead of the page.
    // Blocked here for every spec; a spec that needs a worker sets test.use({ serviceWorkers: "allow" }) itself.
    serviceWorkers: "block",
  },
```

- [ ] **Step 7: Run the tests green.**

```bash
pnpm vitest run tests/playwright-config.test.ts tests/publish-files.test.ts
```

Expected: `Test Files  2 passed (2)`, `Tests  16 passed (16)`.

- [ ] **Step 8: Write the testing note.** In `docs/testing.md`, under "Things to know when writing one", after the bullet that starts "Both projects run in the light colour scheme", add:

```markdown
- Service workers are blocked in every spec (`serviceWorkers: "block"` in `playwright.config.ts`): a worker would answer the page's requests before `page.route` and `context.route` see them. Under the block `navigator.serviceWorker.register()` resolves to `undefined` instead of a registration, and no worker ever controls the page. A spec that needs a worker sets `test.use({ serviceWorkers: "allow" })` itself.
```

- [ ] **Step 9: Run the gates.** With the port free:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

Expected: typecheck clean; `Test Files  130 passed (130)` and `Tests  2154 passed (2154)` (the two new tests); the build's route table as in step 2; the e2e run as in step 2 (`644 passed`, `2 skipped`, with the same allowance for the one known WebKit flake). No page registers a worker yet, so the block changes no spec's outcome. The full suite runs here rather than a few named specs because the config change reaches every spec.

- [ ] **Step 10: Commit.**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts docs/testing.md tests/playwright-config.test.ts tests/publish-files.test.ts
git commit -m "chore: add esbuild as a devDependency for the service worker build, and block service workers in every end-to-end spec unless a spec allows them"
```

**Tried:** in a throwaway worktree detached at `5db53f3`, after `pnpm install --frozen-lockfile --prefer-offline`. The two tests failed as step 4 says (`Tests  2 failed | 14 passed (16)`) and the import printed `ERR_MODULE_NOT_FOUND`. `pnpm add` produced exactly the diff of step 5; `pnpm install --frozen-lockfile` passed and the import printed `0.28.2`. After step 6 both files passed (16 tests). Then `pnpm typecheck` was clean, `pnpm test` passed 130 files and 2154 tests, `pnpm build` listed the six static routes, and the full e2e suite with the block in place (`E2E_PORT=3711 pnpm exec playwright test`, both projects, 646 tests, 11.0 min) gave `643 passed`, `2 skipped` (the swipe touch tests in WebKit) and `1 failed`: the WebKit sideways double tap of `e2e/small-screens.spec.ts:776` at 667 by 375. Repeated on its own against the same build, that test failed 1 time in 6 with the block and 5 times in 10 with the `serviceWorkers` line removed, so it is a flake of the baseline, not of this change. The baseline e2e of step 2 was not run as a separate full run: with no worker in the app the block has no effect, so the full run after the change and the repeat without the block stand for it.
