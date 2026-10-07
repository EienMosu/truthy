# Testing

Four gates, all run by CI (`.github/workflows/ci.yml`) on every push and pull request:

| Command | What it runs |
|---|---|
| `pnpm test` | Vitest: the engine, input, progress, content and token modules, and every component (`tests/`) |
| `pnpm typecheck` | `tsc --noEmit` over the app, the scripts, the unit tests and the end-to-end specs |
| `pnpm build` | Tokens, decks and the service worker (`public/sw.js`), then the Next.js production build |
| `pnpm e2e` | Playwright (`e2e/`) at 390 by 844 with touch, in `phone-chromium` and `phone-webkit`, against `pnpm build && pnpm start --port 3100` (the port comes from `E2E_PORT`, see below) |

Install the browsers once with `pnpm exec playwright install chromium webkit`.

## End-to-end specs

The specs act like a player: they find buttons by role and accessible name and read what is on screen. To know the right answer to the statement on screen, a spec fetches the built deck file (`/decks/<id>.json`) from the running app and looks the statement up (`deckAnswers` and `waitForCard` in `e2e/helpers.ts`). No seed is needed, and a spec can answer right or wrong on purpose (`wrongOn(3, 6, 9)` gives 7 of 10).

Things to know when writing one:

- Every spec file that looks at the game sets `reducedMotion` itself; `e2e/install.spec.ts` only reads the links in `<head>`, the manifest and the icons, so it does not. Headless Chromium on a Mac with "Reduce motion" turned on in System Settings reports `prefers-reduced-motion: reduce`, so a spec that wants the movement says `test.use({ reducedMotion: "no-preference" })`.
- Both projects run in the light colour scheme (`colorScheme: "light"` in `playwright.config.ts`), so no spec depends on the machine's appearance setting. `e2e/night.spec.ts` asks for `colorScheme: "dark"` and checks the colours the browser computes against the night values in `design/system/tokens.json`; `e2e/theme.spec.ts` does the same for the theme switch (`expectThemePage` and `tokenRgb` in `e2e/helpers.ts`).
- Service workers are blocked in every spec (`serviceWorkers: "block"` in `playwright.config.ts`): a worker would answer the page's requests before `page.route` and `context.route` see them. Under the block `navigator.serviceWorker.register()` resolves to `undefined` instead of a registration, and no worker ever controls the page. A spec that needs a worker sets `test.use({ serviceWorkers: "allow" })` itself.
- A new card ignores input for 250 ms (spec section 8). `waitForCard` waits 300 ms after the card appears; a spec that drives input by hand must do the same, or a test that expects "no answer" passes for the wrong reason.
- The start flow ignores presses on a step's options, the continue line and "Start round" for 250 ms after a step change. Wait with `atStep(page, title)` before pressing them; Back and the pass fields never wait.
- The current step of the start flow is `[data-step]:not([inert]) h2`: during a transition the leaving step is still in the page, inert.
- Swipes use the mouse (`dragCard`), which produces pointer events in both browsers. A real touch drag is only possible through the Chromium DevTools protocol, so that one spec is skipped in WebKit.
- A spec that plays several rounds calls `test.slow()`.
- The modes without a fixed length have no "Card n of total" in their header: wait for a card with `waitForQuestion` (True is there and takes presses, no action row, the settle time has passed; pass the previous statement so it waits for the next card) and answer it with `answerCard`. In Timed only the first card takes focus, so `waitForQuestion` does not wait for focus.
- The Timed specs install the page clock (`page.clock.install()`) before `page.goto`, then run the minute with `page.clock.runFor(61_000)`, which fires the clock's ticks as it goes. `page.clock.fastForward(ms)` is a jump, as a phone that slept without telling the page; `setPageHidden(page, true)` is a hidden page (another app, a locked screen), which pauses the clock and holds a Timed stamp on screen while a spec looks at it.
- Motion times its animations with `performance.now`, which the page clock fakes, while the browser runs them on its real timeline: once the page clock has been run ahead, a new animation starts that much later in real time, so an element that leaves with an exit animation stays in the page. Finish the page's animations (`document.getAnimations()`, `finish()`) before asserting that something has gone, as `e2e/timed.spec.ts` does. The cost: no spec under the page clock proves that an exit animation ends on its own. Two Timed specs run a real minute instead: "Timed 14 of 17" (`e2e/small-screens.spec.ts`) with reduced motion, and "taps every 200 ms through time up" (`e2e/result-arrival.spec.ts`) with motion on, which only reaches "See results" once the answer row has left on its own.
- A stamp's landing is in its first frames: `e2e/stamp-landing.spec.ts` reads the stamp's computed opacity and transform on every animation frame from the moment it is in the page (a single read after the answer can come too late on a fast machine or too early on a slow one).
- The result's actions take presses one second after the result appears (`RESULT_ARRIVES_MS`). Playwright's `click()` waits until they take pointer events; a spec that taps by coordinates (`page.touchscreen.tap`) must wait for that itself.

Run one file, or see the browser:

```bash
pnpm exec playwright test e2e/swipe.spec.ts
pnpm exec playwright test e2e/swipe.spec.ts --project=phone-webkit --headed
```

Locally an already running `pnpm start --port 3100` is reused (rebuild it after a change); in CI the specs always build first. The port is 3100 unless the environment variable `E2E_PORT` names another one (a whole number from 1 to 65535; anything else stops the run), so two checkouts can run the specs at the same time, each against its own server:

```bash
E2E_PORT=3200 pnpm e2e
```

A failed test keeps its trace in `test-results/` (`pnpm exec playwright show-trace <path>`); CI uploads that folder as the `playwright-traces` artifact after every run that was not cancelled. In CI a failed test runs once more, so the report tells a flaky test from a broken one. A test that passes only on its retry keeps the run green but shows as a flaky notice in the run summary, and the failed attempt's trace is in the artifact: read the notice after every run.

## Offline and updates

Every spec that goes offline imports `test` from `e2e/offline.ts` instead of `@playwright/test`. Its fixture `net` is a proxy of the test's own (`e2e/proxy.ts`) in front of the production server, and the proxy is the test's `baseURL`. Service workers stay blocked unless the spec allows them; a spec about the worker offline sets `serviceWorkers: "allow"`.

- `goOffline(page, net)` makes the proxy drop every connection, makes `navigator.onLine` read false (an init script reads a flag in local storage) and sends the page an `offline` event; it then checks that a request of the page fails (`expectNetworkGone(page)`), so a spec never passes for the wrong reason. `goOnline(page, net)` undoes all three without a reload.
- `net.setOffline(true)` alone is a network that is gone while the browser still says it is online (a Wi-Fi without internet); a spec that does it checks the cut with `expectNetworkGone(page)` itself.
- `net.release(from, to)` makes the proxy serve `sw.js` with the version string `from` replaced by `to`, which is what a deploy does. `waitForWorker(page)` waits until the first worker controls the page and returns its version; `workerState(page)` reads what the page sees: controlled, a release waiting, the `truthy-shell-*` caches.
- `toDeckStep(page, area, platform)` goes from start step 1 to the deck step and waits for each step to settle, the same offline as online.
- Read what a spec needs from the network before going offline: `deckAnswers` fetches the deck file, so an offline round is played with `playRoundWith(page, answers, choose)`.

Why a proxy and not `context.setOffline`: in Playwright 1.63's WebKit an offline context fails every page request before the service worker sees it (microsoft/playwright issue 42775; fixed with WebKit r2370, which comes with Playwright 1.64), and neither engine routes the worker's update check through `page.route` or `context.route`, so a new `sw.js` cannot come from a route. With the proxy the same specs run in both projects, on macOS and in CI. Playwright's own worker events (`context.serviceWorkers()`, the `serviceworker` event) exist only in Chromium, so the specs assert on what the page shows, on `response.fromServiceWorker()` and on `workerState`.

A known limit: the proxy refuses a connection at once, as a phone in flight mode does. A network that drops packets instead (a weak signal, a router that has stopped answering) leaves the router's payload fetch waiting before Next.js falls back to a document load, and that wait can outlast the 10 s the return mark counts (`RETURN_MAX_AGE_MS`); the start then opens with focus on the body instead of its step 1 title. No spec covers that network.

## A worker left over under `pnpm dev`

The app registers its service worker only in a production build, so `pnpm dev` never registers one. A worker that an earlier `pnpm start` (a production build) left on `localhost` stays, though: a registration belongs to the origin, and the origin includes the port. If `pnpm dev` then runs on the same port, that old worker keeps controlling the page and answers from its cache, so the page shows the old build and ignores what you change. Remove it before you trust what the dev server shows:

- In the browser's DevTools, open the Application panel, then Service workers, and choose Unregister for the `localhost` entry; Clear site data in the Storage section also removes its `truthy-shell-*` caches.
- Or run `navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => r.unregister()))` in the console, and reload.

A different port, or a private window, has no such worker. The end-to-end specs are not affected: they block service workers unless a spec allows one.

## On a phone

After a release that changes the service worker, the owner checks on an iPhone in Safari (and, if at hand, Chrome on Android), because Playwright neither runs the game as a home screen app nor turns a real network off:

1. Online, open the game from the home screen icon and play one round on a deck.
2. Turn on flight mode and open the game from the home screen again: the start shows in the chosen theme, the deck played in step 1 can be played to its result, and another deck says "Needs a connection".
3. Still in flight mode, start a round on that deck, press Leave round, then Back: the first Back may show the start once more or, restored from the back-forward cache, the ready pass of the round just left (accepted); from the ready pass, Start round works.
4. Turn flight mode off: the labels go without a reload.
5. After a deploy with a visible change: open the game online from the home screen, wait about 10 s, swipe the app away, turn on flight mode and open it again: the change shows, with no prompt (it came from the new release's cache). Online every page comes from the network, so only an offline open shows which release the phone holds.
6. With VoiceOver on and flight mode on, swipe through the deck step of a platform with a deck the phone has never loaded: VoiceOver stops on its dimmed card and reads its whole name, ending in "needs a connection" ("CDL, Cloud Digital Leader, needs a connection"), and a double tap does nothing. The card is a group with that name whose parts are hidden from VoiceOver, so a swipe that passes over it without stopping is a failure. The continue line on step 1 is built the same way when its deck has no copy on the device, which a phone check cannot set up (the last round's deck always has one).

## Releases after step 3

- **Stored formats.** Every release keeps what it stores (the localStorage and sessionStorage keys, such as `truthy.pending.v1` and `truthy.progress.v1`) readable by the release before it, and reads what that release stored, or it moves to a new key (`.v2`). Online the pages come from the network, so a newer release's start page can store a round while the worker still holds the release before it; offline, that installed release's `/play` then reads it.
- **Turning the worker off.** Taking `/sw.js` away does not remove an installed worker: the browser's update check fails and the old worker stays. What removes it is a kill switch, a worker that deletes every `truthy-shell-*` cache and unregisters itself:

  ```ts
  // src/offline/sw-entry.ts, the kill switch: it answers no request, so every request goes to the network.
  interface KillSwitchScope {
    caches: CacheStorage;
    registration: { unregister(): Promise<boolean> };
    skipWaiting(): Promise<void>;
    addEventListener(type: "install" | "activate", listener: (event: { waitUntil(promise: Promise<unknown>): void }) => void): void;
  }

  const scope = self as unknown as KillSwitchScope;

  scope.addEventListener("install", (event) => event.waitUntil(scope.skipWaiting()));
  scope.addEventListener("activate", (event) =>
    event.waitUntil(
      (async () => {
        const names = await scope.caches.keys();
        await Promise.all(names.filter((name) => name.startsWith("truthy-shell-")).map((name) => scope.caches.delete(name)));
        await scope.registration.unregister();
      })(),
    ),
  );
  ```

  - When: only when a release's worker does harm that the next release cannot undo at a safe moment (it answers pages wrongly online, or the way a waiting release takes over is broken), or when offline play is to be switched off. An ordinary bug needs no kill switch: the fixed release takes over at the next safe moment, as every release does.
  - How: in one release, replace `src/offline/sw-entry.ts` with the code above (`pnpm build:sw` bundles it into `public/sw.js` as before, and `next.config.ts` keeps sending it with `Cache-Control: no-cache`), and set `production: false` in `browserOfflineClient` (`src/offline/register.ts`), so no page registers a worker again; their unit tests change with them, and so do the five specs that allow a worker (`service-worker`, `register`, `offline`, `offline-navigation`, `update`). The browser finds the new `sw.js` on the next page load, installs it, lets it take over at once (it serves nothing, so a round in memory goes on) and the caches and the registration are gone; from the next load the game runs online only, as before step 3.
  - Check it on the branch's preview URL, whose origin stays the same across its deploys: open it once on the release before, deploy the kill switch to the branch, open it again online, then look at the site's data (Chrome's DevTools, Application): no service worker and no `truthy-shell-*` cache.
  - Keep serving the kill switch for months, as long as a phone that has not opened the game since may still hold an old worker. To bring offline play back, ship the worker again; the kill switch leaves nothing behind.
