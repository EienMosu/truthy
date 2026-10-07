# Truthy step 3: offline play

Date: 2026-10-07. Status: approved design, written for review before the implementation plan.
Parent spec: `docs/superpowers/specs/2026-10-01-truthy-design.md` (section 3, step 3; section 9, "Installability").

## 1. Goal

A player who has opened Truthy on a phone can open it again without a network (on a plane, in the underground) and play every deck they have played before. Progress and records stay on the device, as they do today. Nothing in a round changes when the network comes and goes.

Success is:

- With the network off, `/` and `/play` open from the home screen icon and from the browser, in both themes, and look as they do online.
- Every deck the device holds a copy of can be chosen and played to its result; the record is saved.
- A deck the device has never loaded cannot be chosen while offline, and says why.
- A new release reaches the player without a prompt and never in the middle of a round.

## 2. Owner decisions

- **Which decks work offline:** the decks the player has played, automatically. A deck is kept the first time a round on it loads it; there is no download control and no "all decks" option.
- **Updates:** silent, at a safe moment. A new release downloads in the background and takes over when the app is opened or when the player comes back from a round to the start, never during a round. There is no update banner.

## 3. What exists

- `src/content/load.ts` already caches `index.json` (`truthy.index.v1`) and every deck a round loads (`truthy.deck.<id>`) in localStorage. When a fetch fails, `loadIndex` falls back to the cached index and `loadDeck` to any cached copy of the deck, even one of an older hash. So the data side of offline play works today; what fails is the app itself: with no network the browser cannot load `/` or `/play` and shows its own offline page (review finding U51).
- The web app manifest and icons ship (`app/manifest.ts`), so the game can already be added to the home screen.
- All 19 deck files together are 1.2 MB, so the decks a player has played fit in localStorage with room to spare. The storage stays as it is.

## 4. Scope

In: a service worker that keeps the app shell (the two pages and the files they load) on the device, serves it when the network is missing, and updates it at a safe moment; the start flow knowing which decks it can offer offline; tests.

Out: downloading decks the player has not played, a custom install prompt, push notifications, background sync, caching deck files in the service worker (localStorage keeps them), and any change to how a round is dealt or scored.

## 5. Architecture

| Unit | Job | Depends on |
| --- | --- | --- |
| `src/offline/assets.ts` | Pure: the same-origin asset paths a page's HTML loads (`/_next/static/...`, icons, the manifest). | nothing |
| `src/offline/strategy.ts` | Pure: what the worker does with one request (page, static asset, deck data, other). | nothing |
| `src/offline/version.ts` | The release version the worker carries, injected at build time. | nothing |
| `src/offline/worker.ts` | The service worker: install, activate, fetch and message handlers. Built to `public/sw.js`. | `assets`, `strategy`, `version` |
| `scripts/build-sw.ts` | Bundles `worker.ts` with esbuild into `public/sw.js` with the version filled in. Runs before `next build`, like `build:tokens` and `build:decks`. | esbuild |
| `src/offline/register.ts` | Registers `/sw.js` in production builds, checks for updates, and applies a waiting update when asked at a safe moment. | the browser's ServiceWorker API |
| `src/offline/availability.ts` | Which decks can be played now: all of them online, the ones with a cached copy offline; and a hook for the online state. | `src/content/load.ts` (`createDeckCache`) |
| `components/start/*` | Shows a deck that cannot be played offline as unavailable, with its reason. | `availability` |

The worker shares its pure parts with the unit tests, so the decisions it makes are tested without a browser.

## 6. The service worker

**Version.** Each build gets a version string: the deploy's commit (`VERCEL_GIT_COMMIT_SHA`, or `git rev-parse HEAD` locally) plus the build time. It is part of `public/sw.js`, so every deploy changes the worker's bytes and the browser sees a new worker. The worker's cache is named `truthy-shell-<version>`.

**Install.** The worker fetches `/` and `/play`, reads the asset paths out of their HTML (`assets.ts`: script `src`, stylesheet and preload `href`, the font files of the self-hosted faces), and puts the two pages, those assets, the icons and the manifest in its cache. It also fetches one path that does not exist and keeps that response as the offline page for unknown paths (the game's own 404, status 404). If any of these fetches fails, the install fails and the old worker stays; the browser tries again later. The new worker does not take over on its own (no `skipWaiting` at install).

**Activate.** The worker deletes every `truthy-shell-*` cache but its own. On the very first install (no worker controlled the page before), it claims the open page at once, so the first visit already works offline; a later version is only activated at a safe moment (section 7), so claiming then cannot change a running round.

**Fetch.** Only same-origin GET requests are handled; everything else goes to the network untouched.

| Request | Strategy |
| --- | --- |
| A page (`mode: navigate`) for `/` or `/play` | Network first, with the cached page when the network fails or takes more than 3 s. A fresh response from the network updates nothing in the cache: the cache only changes with a new version, so a page and its assets always match. |
| A page for any other path | Network first; offline, the cached 404 page with status 404. |
| `/_next/static/...` | Cache first, then the network, adding what it fetches to the cache (a file a page loads later, such as a lazily loaded chunk). These files have a hash in their name and never change. |
| `/decks/...` | Network only, untouched. The app's own localStorage cache is the offline copy (section 3). |
| Icons, the manifest, `/sw.js` | Icons and the manifest: cache first. `/sw.js` is never handled by the worker. |
| A React Server Components request (a `_rsc` query or an `RSC` header) | Network only. Its offline behaviour is in section 8. |

**Messages.** The page can post `{ type: "apply-update" }` to a waiting worker, which then calls `skipWaiting()`.

## 7. Registration and updates

`register.ts` runs once on page load in a production build (never in `next dev` or the unit tests). It registers `/sw.js` with scope `/` and asks the registration to check for an update when the page loads and when the player comes back to the start.

A new version installs in the background and waits. It is applied only at a safe moment, where no round is open and the next screen is the start:

1. **When the app opens.** If a worker is already waiting when `/` loads, the page asks it to take over and reloads once when the controller changes. This happens before the player has done anything, so the reload looks like part of opening the app.
2. **When the player comes back to the start from a round** (Choose another route, Close on a result, Leave round). If a worker is waiting, the page asks it to take over, and the way back to the start is a full page load instead of the in-app navigation.

Nothing else applies an update: not a timer, not a visibility change, never `/play` while a round is open. If the page cannot reach the worker (registration failed, unsupported browser), the game behaves exactly as it does today.

## 8. Playing offline

**Online state.** The app treats itself as offline when `navigator.onLine` is false, and follows the browser's `online` and `offline` events. A fetch that fails while `navigator.onLine` is still true takes the existing paths (cached copy, else the plain message with a retry action).

**What can be played.** Online, every deck. Offline, a deck can be played when the device holds a copy of it (`truthy.deck.<id>`, any hash), which is the same rule `loadDeck` already follows when its fetch fails. The index comes from `truthy.index.v1`; with no cached index at all, the start shows the existing message with its retry action.

**The start flow offline.**
- Areas and platforms are shown as online, with their counts.
- On the deck step, a deck with no copy on the device is shown as unavailable: dimmed, not selectable, with "Needs a connection" in place of its card count. Its accessible name says the same ("CLF, Cloud Practitioner, needs a connection").
- The section and class steps are unchanged, since a deck that reaches them is available.
- The continue line offers its route only when its deck is available; otherwise it shows "Needs a connection" and is not a button.
- When the network comes back, the labels go away without a reload.

**Moving to `/play` offline.** The start flow goes to `/play` with the router (`router.push`), which fetches a React Server Components payload. The plan's first task checks what Next.js 16 does when that fetch fails offline. If it falls back to a full page load, the worker serves the cached `/play` and nothing more is needed. If it does not, the start flow uses a full page load to `/play` whenever the app is offline.

**Coming back to the start offline.** `backToStart` goes back in the history, which needs no network; the fallback `router.replace("/")` is treated like the move to `/play` above.

## 9. Build and deploy

- `pnpm build:sw` (`scripts/build-sw.ts`) writes `public/sw.js`; `prebuild` and `predev` run it after `build:tokens` and `build:decks`. `public/sw.js` is generated, so it is git-ignored, as `public/decks` is.
- esbuild is already installed as a dependency of the toolchain; the plan adds it to `devDependencies` at the same version so the script can import it.
- `next.config.ts` sends `/sw.js` with `Cache-Control: no-cache` so a browser always checks it, and the existing security headers.
- No new runtime dependency.

## 10. Errors and edge cases

| Situation | Behaviour |
| --- | --- |
| The browser has no service worker support, or registration fails | The game works as today, online only. Nothing is shown. |
| The install of a new version fails (a fetch fails midway) | The old version stays and keeps serving; the browser retries on a later visit. |
| Offline on the very first visit (no worker yet) | The browser's own offline page, as today. Offline play starts after one visit online. |
| Offline, a deck with no copy | Unavailable on the deck step with "Needs a connection" (section 8). |
| Offline, a stored round (`truthy.pending.v1`) whose deck has no copy | `/play` shows the existing load failure message with Try again, and Choose another route goes back to the start. |
| The network drops during a round | Nothing changes: the round already has its deck in memory. |
| The network comes back | The deck step's labels go away; the next index fetch refreshes the cached index. |
| A new version is waiting while a round is open | It stays waiting until a safe moment (section 7). |
| Two tabs are open, one in a round | Applying the update replaces the worker for both. The worker only serves pages and hashed assets, and the old page keeps its own loaded code, so the round in the other tab goes on; that tab gets the new version on its next page load. |
| The device clears site storage (for example Safari's limit on script-written storage for a site not opened for a while; a home screen app is exempt) | The decks, the index, progress and the worker's cache are gone together; the next online visit starts fresh, as today. |

## 11. Testing

**Unit (Vitest).**
- `assets.ts`: asset paths from real pages of the production build (stored as fixtures), absolute and relative URLs, and other origins left out.
- `strategy.ts`: every row of the fetch table in section 6, including RSC requests and other origins.
- `register.ts` and the safe moments: with a fake registration, an update is applied when the app opens with a waiting worker and when the player comes back from a round, and never otherwise.
- `availability.ts` and the deck step: unavailable decks offline, labels and accessible names, the continue line, the labels going away online.

**End to end (Playwright).**
- `playwright.config.ts` sets `serviceWorkers: "block"` for every spec, so the existing specs that route network requests keep working as they do today. The offline specs set `serviceWorkers: "allow"`.
- An offline spec: open `/` online and wait until a worker controls the page; play a round on one deck; go offline with `context.setOffline(true)`; reload `/`; check the played deck is available and another deck says "Needs a connection"; play the available deck to its result and check the record is saved; reload `/play` offline; check an unknown path shows the game's 404 page.
- An update spec: serve a changed `sw.js` and check the new version takes over when the app opens and when the player leaves a round, and not during a round.
- Both engines where Playwright's WebKit supports service workers; the plan's first task checks that. If it does not, these specs run on Chromium and a real iPhone check is added to the phone checklist: offline open from the home screen, offline round on a played deck, and an update after a deploy.

**CI.** The same Playwright suite; the offline specs build the production app as all specs do.

## 12. Changes to the existing documents

- The main spec: section 3 (step 3 is this document), section 5 "Loading" (offline decks), section 9 "Installability" (the worker ships), section 10's error table (the rows in section 10 above).
- The design system: the unavailable deck card (dimmed, "Needs a connection", not selectable) and the unavailable continue line, in the start flow's component entries.

## 13. Checks before the plan's tasks

1. What Next.js 16 does when the RSC fetch of `router.push("/play")` fails offline (section 8).
2. Whether Playwright's WebKit runs service workers, on macOS and on Linux (section 11).
3. Whether every chunk `/play` needs is named in its HTML, or some load later; the cache-first rule for `/_next/static` covers a chunk that loaded once online, and the offline spec shows whether that is enough.

## 14. Amendments after the plan's checks

The checks of section 13 ran before the plan was written; their results and the decisions taken from them are in `docs/superpowers/plans/2026-10-07-truthy-step-3-offline/README.md` ("Decisions from the checks"). Sections 1 to 13 stay as approved. Where the evidence showed a sentence above to be impossible or wrong, it is amended here, and the amendment wins.

1. **Section 11, how the end-to-end specs go offline and get a new release.** Check C2 found that in Playwright 1.63's WebKit (r2359) a context set offline with `context.setOffline(true)` fails every page request before the service worker sees it (5 of 5 runs on macOS; microsoft/playwright issue 42775 reports the same on Linux; the fix comes only with WebKit r2370 in Playwright 1.64), and that neither engine routes the worker's update check through `page.route` or `context.route`. So no spec uses `context.setOffline`. Every spec that goes offline does it one way, in both engines: a proxy of its own in front of the production server drops every connection, and an init script makes `navigator.onLine` read false and sends the `offline` event (`e2e/proxy.ts`, `e2e/offline.ts`). The update spec gets its changed `sw.js` from the same proxy. With that, the offline and update specs run in Chromium and WebKit, so the last bullet's fallback to Chromium alone does not apply; the phone check is added all the same (`docs/testing.md`, "On a phone"), since no spec opens the game as a home screen app.
2. **Section 10, the row "Offline, a stored round (`truthy.pending.v1`) whose deck has no copy".** The load failure screen has no "Choose another route": its only controls are "Try again" and the header's "Leave round", which goes back to the start without a sheet (`LoadFailed` in `components/play/PlayScreen.tsx` at 5db53f3, read while the plan was written). The row reads: "`/play` shows the existing load failure message with Try again, and Leave round goes back to the start." No control is added.
3. **Sections 5 and 6, where the code as built differs in detail.** Recorded after the last task, so this document says what shipped; none of it changes what the player sees.
   - Section 6, "Version": locally the commit is `git rev-parse --short HEAD`, not the full hash. The build time already makes every version unique, and the short form keeps the cache name readable.
   - Section 5, `availability.ts`: the hook for the online state is `components/useOnline.ts`, not part of `src/offline/availability.ts`, because `src/offline` imports no React (`tests/offline/boundaries.test.ts` enforces it).
   - Section 6, "Activate": the worker claims the open pages on every activation, not only the first. A later version only activates at a safe moment (section 7), so the claim cannot change a running round, and the pages the old version controlled switch to the new one on activation anyway.
   - Section 5, the table: it gains a row `src/offline/cache-names.ts` (pure: the name of a release's cache, `truthy-shell-<version>`, and which caches belong to another release; depends on nothing), which `worker.ts` depends on; and `strategy.ts` depends on `assets.ts`, which holds the one list of the shell's pages and files (`SHELL_PAGES`, `SHELL_FILES`) that the install and the strategy both read, so the two never disagree.
4. **Section 6, a server error and a redirect.** Added after the final review. For `/` and `/play`, a network answer with a server error (status 500 or more) counts as a failed network: the cached page answers when there is one, else the server's answer passes on. At install, a file of the shell that comes through a redirect fails the install, as a failed fetch does: the browser refuses a redirected response as the answer to a page load, so a kept page would fail offline.
5. **Section 10, stored formats across releases.** Added after the final review. Every release keeps what it stores (the localStorage and sessionStorage keys, such as `truthy.pending.v1` and `truthy.progress.v1`) readable by the release before it, and reads what that release stored, or it moves to a new key: online the pages come from the network, so a newer release's start page can store a round while the worker still holds the release before it, and offline that installed release's `/play` reads it. How to turn the worker off altogether is in `docs/testing.md` ("Releases after step 3").
6. **Section 7, the second safe moment after an update that took over without a reload.** Added in the cleanup after step 3. A press while the app opens skips the reload of the first safe moment, and a new version can take over after `applyUpdate` gave up waiting; either way the new version controls the page while the page runs the old code, and nothing waits any more. `OfflineClient` gains `updateApplied()`, true once a version this page asked to take over controls it (the page compares the controller with the one it had when it asked; a page load starts afresh). When it is true, the way back to the start from a round is a full page load, as with a waiting update. Nothing else changes: the check runs only on the player's ways back to the start, never while a round is open, and a version that took over without this page asking (the first install, another tab) still waits for the next page load (section 10).
