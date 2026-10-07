# Truthy step 3 (offline play) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player who has opened Truthy once online can open it again without a network, from the home screen or the browser, in both themes, and play every deck the device holds to a saved result. A deck the device never loaded cannot be chosen offline and says "Needs a connection". A new release reaches the player without a prompt, only when the app opens on the start or when the player comes back to the start from a round, never during a round.

**Architecture:** A service worker keeps the app shell on the device: the two prerendered pages, every file their HTML names, the icons and the manifest, and the game's 404 page, in one cache per release, `truthy-shell-<version>`. Its decisions are pure modules in `src/offline` (`cache-names.ts`, `assets.ts`, `strategy.ts`), tested in Node on the real production HTML. `worker.ts` holds install, activate, fetch and message behind a `WorkerEnv`, so the unit tests drive it with a fake CacheStorage, fetch and timer; `sw-entry.ts` wires it to the worker global, and `scripts/build-sw.ts` bundles it with esbuild into `public/sw.js` before every build, with the release version of `version.ts` filled in. On the page side, `register.ts` registers the worker in production builds and applies a waiting release only at the two safe moments of spec section 7: `OfflineStart` in the layout, when a document opens on `/`, and `goToStart`, behind the play screen's ways back to the start. The decks stay in localStorage as today: `availability.ts` and the `useOnline` hook decide which decks the start flow offers offline. Moving between `/` and `/play` offline needs no code of its own: Next's router falls back to a document load when its payload fetch fails, and the worker serves that load (check C1).

**Tech Stack:** Next.js 16.3 (App Router, statically prerendered), React 19.2, TypeScript 5.9 (strict, `noUncheckedIndexedAccess`), Tailwind CSS 4, Motion, zod 4, Vitest 4 with Testing Library, esbuild 0.28 (the worker bundle only), Playwright 1.63 (phone-sized Chromium and WebKit; service workers blocked unless a spec allows them; offline through a proxy the specs own), pnpm 10, Node 24.

**Spec:** `docs/superpowers/specs/2026-10-07-truthy-offline-design.md` is binding, with its section 14, "Amendments after the plan's checks", which this plan added. Its parent is `docs/superpowers/specs/2026-10-01-truthy-design.md`. The visual authority is `design/system/DESIGN-SYSTEM.md` and `design/system/tokens.json`. Where they disagree: the specification wins, then DESIGN-SYSTEM.md.

## How this plan is organised

One file per task in this folder. Execute them in numeric order on the branch `offline`; each task builds only on what the tasks before it created, ends with its gates green and commits all of its changes. Every command runs from the repository root.

| Task | File | Delivers | Tier |
|---|---|---|---|
| 1 | `01-baseline.md` | The base and the green baseline checked; esbuild as a devDependency; service workers blocked in every end-to-end spec unless the spec allows them | standard |
| 2 | `02-pure.md` | The worker's pure decisions: the cache names, the files a page loads (tested on the production HTML of `/` and `/play`), `SHELL_FILES`, the strategy for each request | standard |
| 3 | `03-worker.md` | The service worker (`createWorker`), its release version and entry, the esbuild bundle into `public/sw.js`, `Cache-Control: no-cache` on `/sw.js`, a smoke spec in both engines | most capable |
| 4 | `04-register.md` | Registration on every page, `AppServices.offline`, a waiting update applied when a document opens on `/`, the guard that keeps `src/offline` free of React and components | most capable |
| 5 | `05-return.md` | `goToStart`: a waiting update applied on the play screen's ways back to the start, with a full page load; never during a round | standard |
| 6 | `06-availability.md` | Which decks can be played offline: the rule, `useOnline`, the dimmed deck card and continue line with "Needs a connection", their design system entries; the one kit every offline end-to-end spec uses (proxy and fixture) | most capable |
| 7 | `07-offline-navigation.md` | The router's document load fallback pinned (unit and end to end, both engines), the step 1 focus kept across that load, a stored round without a deck, a network that is gone while the browser says it is online | standard |
| 8 | `08-e2e-docs.md` | The offline and update specs of spec section 11 in both engines, the phone check, the main spec, design system and testing documents, the full suite | most capable |

Every task was drafted by its own writer and its code run in a throwaway worktree at `5db53f3`, with the earlier tasks' parts written from the brief's signatures where a task needed them; the three checks below ran before that. The plan was then edited into one plan: the shared names, the files each task builds on, and the expected outputs are for the tasks run in order. A few parts changed after the drafts ran, each named in its task's "Tried" note: task 2's build names moved into one block of constants; task 3's install reads `SHELL_FILES`, the version moved into `src/offline/version.ts`, and two worker cases were added; task 4's boundary guard; task 6's labels spec moved onto the proxy kit; task 7's return mark became a time that expires, with a condition instead of a fixed wait and one more case; task 8's three Review Focus cases and the focus check after an update.

The plan as written was then run once more, in a scratch copy of the tree at `5db53f3` with every task applied (each task's drafted files, and the code of these files where it changed), on macOS with Playwright 1.63:
- `tsc --noEmit` over the whole tree: clean. `next build`: every route static.
- The whole unit suite: 147 files and 2340 tests, as the table below says; the only two failures were the cases that need a git checkout, which the copy did not have (`tests/repo-hygiene.test.ts`, and the short-commit case of `tests/scripts/build-sw.test.ts`).
- Task 7's unit tests failed first exactly as its step 2 says, and the guard of task 4 failed when a React import was planted in `src/offline`.
- The step 3 specs against that build (`service-worker`, `offline-labels`, `offline-navigation`, `offline`, `update`): 34 passed, 17 in each engine, nothing skipped. Task 8's two mutation runs gave exactly its lists.
- Not run there: the full e2e suite (task 1 ran it with the block; task 8 runs it last) and `e2e/register.spec.ts` (run by task 4's draft).

A second review then changed no code, only where one test file lives and what the documents say: task 7's fallback test moved unchanged to `tests/next-offline-fallback.test.ts` (it mirrors no file of `src/`; in the scratch copy it passed there, with `tsc --noEmit` clean); the two new sections of `docs/testing.md` (tasks 6 and 8) go at the end of the file, so the run commands stay under "End-to-end specs"; task 8's edits to the main spec gained the "two tabs" row of section 10 and the `src/app-state` and `components` rows of section 4; task 3's size of `public/sw.js` is about 8 kB; and "Before task 1" below spells out the commands. No count changed.

If a step's actual output differs from the stated one, stop and find out why before going on.

`pnpm test` after each task, in this order (the draft runs give the per-file counts; the e2e reduced motion guard adds one case per new spec file):

| After task | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Test files | 130 | 133 | 136 | 139 | 141 | 145 | 147 | 147 |
| Tests | 2154 | 2188 | 2241 | 2273 | 2298 | 2325 | 2338 | 2340 |

The full end-to-end suite holds 646 tests at `5db53f3` (644 pass, the two WebKit swipe cases skip) and 686 after task 8 (684 pass, the same two skip).

### Before task 1 (the controller, not the executor)

Task 1, step 1 accepts only a checkout of `offline` whose `git status --porcelain` prints nothing. The main checkout cannot pass that check: it holds an untracked `.claude/` folder (agent worktrees), which the check would list. A worktree of its own can, but git refuses to add a worktree for `offline` while the main checkout has `offline` checked out. So, from the main checkout's root:

```bash
git add docs/superpowers/plans/2026-10-07-truthy-step-3-offline docs/superpowers/specs/2026-10-07-truthy-offline-design.md
git commit -m "docs: add the plan of step 3, offline play, and the amendments its checks made to the offline design"
git switch --detach
git worktree add ../truthy-offline offline
```

- The commit puts this plan folder and the offline spec's section 14 on `offline`, nothing else; `.claude/` stays untracked.
- `git switch --detach` leaves the main checkout on the same commit without the branch, which frees `offline` for the new worktree. Use it rather than `git switch main`, which git also refuses while `main` is checked out in another worktree.
- Give the executor `../truthy-offline`: it is the repository root of every command in this plan. It has no `node_modules`; task 1, step 2 starts with `pnpm install --frozen-lockfile`, which installs them.
- `offline` must contain `hardening` and the spec commit `5db53f3`, and all four gates must be green before the first change. Task 1, steps 1 and 2 check both, and the clean tree, and stop if any fails.

## Decisions from the checks

Three checks ran before the tasks were written (offline spec, section 13). Each result, and what the plan does with it.

**C1: what Next.js 16.3.8 does when the payload fetch of `router.push("/play")` or `router.replace("/")` fails offline.**
- Found: in Chromium and WebKit, `fetchServerResponse` logs "Falling back to browser navigation" and the app router calls `location.assign` for a push and `location.replace` for a replace, so history behaves as online. The branch that waits for the network instead exists only with `experimental.useOffline`, which this app does not set.
- Decided: the start flow keeps `router.push("/play")` and the play screen its `router.replace("/")`; there is no `useOnline` branch in the navigation. Task 7 pins the fallback with a unit test (no `useOffline` in `next.config.ts`; Next's client source still falls back) and an end-to-end spec in both engines. This is the branch spec section 8 itself names, so it needs no amendment.
- Side finding 1, a document load drops the in-memory return mark, so the start lost its step 1 focus after an offline way back or the update load. Decided: keep it across the load. Task 7 writes the mark to sessionStorage (`RETURN_KEY`) as the time it was set and counts it for 10 s (`RETURN_MAX_AGE_MS`): long enough for the slowest way back that loads the page (3 s `APPLY_TIMEOUT_MS`, 3 s `PAGE_TIMEOUT_MS`, hydration), short enough that a mark no start took (a step back into a start restored from the back-forward cache) does not move the focus of a later fresh load. The other in-memory mark, `startEntryBehind`, is not carried: stepping back into a document the browser may restore with the ready pass on it would be worse than the extra start entry an offline round leaves in the history (accepted, task 7).
- Side finding 2, `truthy.pending.v1` is never removed (`savePending` is its only writer), so the brief's app-open condition "no round is pending" would never hold after the first round. Decided (task 4, decision 1): the condition is that the document opened on `/`, read once right after registration. That is sound because a round only ever lives in the memory of a `/play` document, `/` renders the start flow alone, the reload keeps the hand-over record as every reload does, and the check runs before the player has done anything. Spec section 7 names no other condition.
- The update path's full load (task 5) is `location.replace("/")`, which C1 allows: with `assign`, `/play` would stay right behind the new start, and a back step would deal the stored round again.

**C2: Playwright 1.63 and service workers.**
- Found: Chromium does everything. WebKit (r2359) registers, is controlled after `claim()` and serves worker answers online, but once a context is set offline with `context.setOffline` it fails every page request before the worker sees it (5 of 5 runs on macOS; microsoft/playwright issue 42775 on Linux; fixed only with WebKit r2370, which Playwright 1.64 will bring). A proxy that drops connections works in both engines, and an init script can make `navigator.onLine` read false. Neither engine routes the worker's update check through `page.route` or `context.route`. `serviceWorkers: "block"` works in both, and under it `register()` resolves to `undefined`.
- Decided: the global `serviceWorkers: "block"` stays (task 1), and `register.ts` treats an `undefined` registration as no worker (task 4, decision 4). Every end-to-end spec that goes offline does it one way, in both engines: a proxy of the test's own in front of the production server that drops every connection, plus `navigator.onLine` reading false with an `offline` event (`e2e/proxy.ts` and `e2e/offline.ts`, created in task 6, the first task whose spec goes offline; used by tasks 7 and 8). No spec uses `context.setOffline`, and no spec skips WebKit. A new release comes from the same proxy rewriting the version string in `sw.js`. The specs assert on what the page shows, on `response.fromServiceWorker()` and on what the page reads of its registration and caches, never on Playwright's worker events (Chromium only). The phone check is added all the same (task 8). Linux CI is expected to behave as macOS did (issue 42775 reports the same setup), which the first CI run of these specs confirms.
- Spec amendment 1 (section 14): section 11 said the offline spec goes offline with `context.setOffline(true)`; C2's evidence makes that impossible in WebKit with a worker, so the specs use the proxy.

**C3: which files a round loads, and whether the HTML names them all.**
- Found: across Classic, Streak and Timed rounds in both engines, every `/_next/static` file requested is named in a script `src` or link `href` of `/` or `/play` (12 chunks, 4 fonts); nothing loads later. The fonts are named only by preload links; the runtime is named twice; the icons are named with a hash query (`/icon.svg?icon.<hash>.svg`, `/apple-icon.png?apple-icon.<hash>.png`); `/icon-192.png`, `/icon-512.png` and the bare `/icon.svg` are named only by the manifest; a noModule polyfill (112,594 B) is named but never loaded. The shell is about 1.43 MB raw, about 440 KiB gzipped.
- Decided: `assetPathsFromHtml` reads script `src` (async and noModule) and link `href` for `stylesheet`, `preload`, `modulepreload`, `icon`, `apple-touch-icon` and `manifest`, once each, query kept (task 2). The files the HTML does not name come from one fixed list in one module, `SHELL_FILES` in `src/offline/assets.ts` (the manifest and the four icons, by path without a query), which the install, `strategyFor` and the worker's test fakes all read (tasks 2 and 3). Cache matching is by the full URL with its query: the install keeps both the queried icons the pages name and the bare paths of `SHELL_FILES`, so each request matches its own entry exactly, with no `ignoreSearch`. The polyfill is kept like any other named file. The unit tests read fixtures captured from the real production HTML of `/` and `/play` (task 2), with every build-specific name in one block.

**Other decisions where the brief or the spec left room** (none departs from the spec):
- `src/offline/version.ts` stays, as spec section 5 lists it: it holds the esbuild define of the release version, and only `sw-entry.ts` imports it, inside the bundle. `worker.ts` gets the version through `WorkerEnv`, so its tests can give it any. `sw-entry.ts` and `cache-names.ts` are parts of the spec's worker unit, not new units.
- Activate claims the open pages on every activation (task 3, decision 2). Spec section 6 asks for the claim on the first install and says a later version only activates at a safe moment, so a claim then cannot change a running round; pages the old version controls switch on activation anyway.
- `goToStart(services: ToStartServices, router)` instead of the brief's `PlayServices`: `PlayServices` lives in `components/`, which `src/` must not import. Every `PlayServices` is a `ToStartServices` (task 5).
- The online hook is `components/useOnline.ts`, not part of `src/offline/availability.ts`: spec section 5's row gives that file "a hook for the online state" but lists `src/content/load.ts` as its only dependency, and `src/offline` imports no React (task 6).
- The install accepts the 404 probe only with status 404, so a page is never kept as the 404 page (task 3).
- Spec amendment 2 (section 14): section 10's row "Offline, a stored round whose deck has no copy" says "Choose another route goes back to the start", but that screen has no such control; its way back is "Leave round" (`LoadFailed` in `components/play/PlayScreen.tsx` at `5db53f3`). This rests on the code, not on C1 to C3; the review asked for the spec to say what the screen does, and no control is added. Task 7 pins it, and task 8's main spec row says "Leave round".

## Global Constraints

From the brief, in force in every task:

- Versions: next 16.3.8, react and react-dom 19.2.8, typescript 5.9.3, tailwindcss 4.3.3, vitest 4.1.11, zod 4.6.5, motion 13.4.6, @playwright/test 1.63.0, pnpm 10, Node 24. Add no runtime dependency. The only new devDependency is esbuild at the version already in `pnpm-lock.yaml` (0.28.2), for `scripts/build-sw.ts`.
- No server code beyond static route output: every route stays prerendered.
- Module boundaries: the `tests/engine` boundary checks stay green; `src/offline` imports nothing from React or components (from task 4 on, `tests/offline/boundaries.test.ts` enforces it); components import from `src/offline`.
- Accessibility floor: text contrast 4.5:1, touch targets 48 px, visible focus, nothing by colour alone, reduced motion respected.
- UI copy: English, sentence case, exactly as the plan writes it. The only new copy is "Needs a connection" (visible) and ", needs a connection" in accessible names.
- Test first; tests mirror source paths under `tests/`; e2e specs in `e2e/`. Every e2e spec file sets `test.use({ reducedMotion: ... })` (a guard test checks this).
- Playwright: `playwright.config.ts` sets `use.serviceWorkers = "block"`; a spec that needs a worker sets `test.use({ serviceWorkers: "allow" })`.
- Commits: conventional prefix, one full sentence, authored by the repository's configured identity, no co-author or tool attribution lines.
- Public repository: no local absolute paths, e-mails or secrets in tracked files (`tests/repo-hygiene.test.ts`). No em dash (U+2014) anywhere.
- Gates at the end of every task: `pnpm typecheck`, `pnpm test`, `pnpm build`, and the e2e specs the task names (`E2E_PORT=<port> pnpm exec playwright test <specs>`). The full e2e suite runs in the last task, and in task 1, whose configuration change reaches every spec.

## Shared names

Every task uses exactly these. The brief's names are kept; the ones the brief did not have are marked "added", with the reason in "Decisions from the checks" or in the task.

- `src/offline/cache-names.ts` (task 2): `SHELL_CACHE_PREFIX = "truthy-shell-"`, `shellCacheName(version)`, `isOldShellCache(name, version)`.
- `src/offline/assets.ts` (task 2): `SHELL_PAGES = ["/", "/play"] as const`, `NOT_FOUND_PROBE = "/__offline-not-found"`, `SHELL_FILES: ReadonlySet<string>` (added: `/icon.svg`, `/icon-192.png`, `/icon-512.png`, `/apple-icon.png`, `/manifest.webmanifest`), `assetPathsFromHtml(html, origin): string[]`.
- `src/offline/strategy.ts` (task 2): `type Strategy = "page" | "unknown-page" | "static" | "pass"`, `interface RequestFacts`, `strategyFor(request, origin)`, `PAGE_TIMEOUT_MS = 3000`.
- `src/offline/version.ts` (task 3, spec section 5): `RELEASE_VERSION` (added name), the esbuild define `__TRUTHY_VERSION__`, `${commit}-${buildTime}`.
- `src/offline/worker.ts` (task 3): `interface WorkerEnv`, `interface ShellWorker` (added: the name of what `createWorker` returns), `createWorker(env)`.
- `src/offline/sw-entry.ts` (task 3): the only file that touches the worker global. `scripts/build-sw.ts`, `"build:sw": "tsx scripts/build-sw.ts"`, `predev` and `prebuild` ending in `pnpm build:sw`, `public/sw.js` git-ignored, `/sw.js` with `Cache-Control: no-cache` in `next.config.ts`.
- `src/offline/register.ts` (task 4): `interface OfflineClient { start; updateWaiting; applyUpdate; checkForUpdate }`, `SW_URL = "/sw.js"`, `SW_SCOPE = "/"`, `APPLY_TIMEOUT_MS = 3000` (all three added), `createOfflineClient({ container, production })`, `browserOfflineClient`, `noOfflineClient`.
- `src/app-state/services.ts`: `AppServices.offline: OfflineClient`, `browserAppServices.offline = browserOfflineClient` (task 4); `RETURN_KEY = "truthy.return.v1"`, `RETURN_MAX_AGE_MS = 10_000` (both added), `markReturnFromPlay()`, `takeReturnFromPlay()` (task 7).
- `components/OfflineStart.tsx` (task 4): `openApp(offline, path, reload)` and `interface OfflineStartProps` (both added), `OfflineStart`, rendered once in the body of `app/layout.tsx` after the app frame.
- `src/app-state/to-start.ts` (task 5): `interface ToStartServices` (added), `goToStart(services, router)`.
- `src/offline/availability.ts` (task 6): `availableDeckIds(deckIds, online, cache): ReadonlySet<string>`.
- `components/useOnline.ts` (task 6): `useOnline(): boolean`.
- `components/DestinationCard.tsx`: `dimmedReason?: string`; `components/start/ContinueLine.tsx`: `needsConnection?: boolean` (task 6, both added).
- `e2e/proxy.ts` (task 6, added): `interface Proxy { url; setOffline(offline); release(from, to); close() }`, `startProxy(upstream)`.
- `e2e/offline.ts` (task 6, added): `test` (with the fixture `net: Proxy`, which is the test's `baseURL`), `goOffline(page, net)`, `goOnline(page, net)`, `interface WorkerState`, `workerState(page)`, `waitForWorker(page)`.
- `e2e/helpers.ts` (task 8, added): `playRoundWith(page, answers, choose, method?, total?, from?)`.
- Storage and caches: `truthy-shell-<version>` (the worker's cache), `truthy.return.v1` (sessionStorage), `truthy.e2e.offline` (a localStorage flag only the specs' onLine switch reads). `truthy.pending.v1`, `truthy.index.v1` and `truthy.deck.<id>` are as before step 3.
- Spec files, by task: `e2e/service-worker.spec.ts` (3), `e2e/register.spec.ts` (4), `e2e/offline-labels.spec.ts` (6), `e2e/offline-navigation.spec.ts` (7), `e2e/offline.spec.ts` and `e2e/update.spec.ts` (8).

## Review Focus

The five failure modes the spec implies that no drafted task tested and that are most likely to bite a player, most likely first. Each now has a test in the task that owns it.

1. **The network drops in the middle of a round** (spec section 10): the round must go on to its saved result and the way back to the start must work offline. Task 8, `e2e/offline.spec.ts`, "the network drops in the middle of a round: the round goes on to its saved result, and the way back to the start works offline".
2. **A network that is gone while the phone still says it is online** (spec section 8; a Wi-Fi without internet): every deck is offered, so a deck with no copy must end at the load failure, served by the worker, with a way home. Task 7, `e2e/offline-navigation.spec.ts`, "a network that is gone while the browser still says it is online: a deck with no copy ends at the load failure, and Leave round goes home".
3. **A release that waits when the app next opens without a network** (spec sections 7 and 8; downloaded on the platform, opened on the train): it must take over and the start must open from the new release's cache. Task 8, `e2e/update.spec.ts`, "a release that waits takes over when the app next opens without a network, and the start opens from it".
4. **A full phone while a new release installs** (spec section 10, a failed install): no half-filled cache of the new release, and the running release's cache untouched. Task 3, `tests/offline/worker.test.ts`, "fails when the device cannot store the shell (its storage is full), and leaves the running version's cache as it was".
5. **The game opened offline looking otherwise than online** (spec section 1, "in both themes, and look as they do online"): a font file or stylesheet the worker did not keep shows only offline. Task 8, `e2e/offline.spec.ts`, "offline, the start opens in the night theme with the game's own four font faces, as it does online", and the day theme check in its second test.
