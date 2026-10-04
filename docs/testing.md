# Testing

Four gates, all run by CI (`.github/workflows/ci.yml`) on every push and pull request:

| Command | What it runs |
|---|---|
| `pnpm test` | Vitest: the engine, input, progress, content and token modules, and every component (`tests/`) |
| `pnpm typecheck` | `tsc --noEmit` over the app, the scripts, the unit tests and the end-to-end specs |
| `pnpm build` | Tokens and decks, then the Next.js production build |
| `pnpm e2e` | Playwright (`e2e/`) at 390 by 844 with touch, in `phone-chromium` and `phone-webkit`, against `pnpm build && pnpm start --port 3100` (the port comes from `E2E_PORT`, see below) |

Install the browsers once with `pnpm exec playwright install chromium webkit`.

## End-to-end specs

The specs act like a player: they find buttons by role and accessible name and read what is on screen. To know the right answer to the statement on screen, a spec fetches the built deck file (`/decks/<id>.json`) from the running app and looks the statement up (`deckAnswers` and `waitForCard` in `e2e/helpers.ts`). No seed is needed, and a spec can answer right or wrong on purpose (`wrongOn(3, 6, 9)` gives 7 of 10).

Things to know when writing one:

- Every spec file that looks at the game sets `reducedMotion` itself; `e2e/install.spec.ts` only reads the links in `<head>`, the manifest and the icons, so it does not. Headless Chromium on a Mac with "Reduce motion" turned on in System Settings reports `prefers-reduced-motion: reduce`, so a spec that wants the movement says `test.use({ reducedMotion: "no-preference" })`.
- Both projects run in the light colour scheme (`colorScheme: "light"` in `playwright.config.ts`), so no spec depends on the machine's appearance setting. `e2e/night.spec.ts` asks for `colorScheme: "dark"` and checks the colours the browser computes against the night values in `design/system/tokens.json`; `e2e/theme.spec.ts` does the same for the theme switch (`expectThemePage` and `tokenRgb` in `e2e/helpers.ts`).
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

A failed test keeps its trace in `test-results/` (`pnpm exec playwright show-trace <path>`); CI uploads that folder as the `playwright-traces` artifact after every run that was not cancelled. In CI a failed test runs once more, so the report tells a flaky test from a broken one, but a test that passes only on its retry still fails the run (`failOnFlakyTests`), and the failed attempt's trace is in the artifact.
