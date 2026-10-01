# Testing

Four gates, all run by CI (`.github/workflows/ci.yml`) on every push and pull request:

| Command | What it runs |
|---|---|
| `pnpm test` | Vitest: the engine, input, progress, content and token modules, and every component (`tests/`) |
| `pnpm typecheck` | `tsc --noEmit` over the app, the scripts, the unit tests and the end-to-end specs |
| `pnpm build` | Tokens and decks, then the Next.js production build |
| `pnpm e2e` | Playwright (`e2e/`) at 390 by 844 with touch, in `phone-chromium` and `phone-webkit`, against `pnpm build && pnpm start --port 3100` |

Install the browsers once with `pnpm exec playwright install chromium webkit`.

## End-to-end specs

The specs act like a player: they find buttons by role and accessible name and read what is on screen. To know the right answer to the statement on screen, a spec fetches the built deck file (`/decks/<id>.json`) from the running app and looks the statement up (`deckAnswers` and `waitForCard` in `e2e/helpers.ts`). No seed is needed, and a spec can answer right or wrong on purpose (`wrongOn(3, 6, 9)` gives 7 of 10).

Things to know when writing one:

- Every spec file sets `reducedMotion` itself. Headless Chromium on a Mac with "Reduce motion" turned on in System Settings reports `prefers-reduced-motion: reduce`, so a spec that wants the movement says `test.use({ reducedMotion: "no-preference" })`.
- Both projects run in the light colour scheme (`colorScheme: "light"` in `playwright.config.ts`), so no spec depends on the machine's appearance setting. `e2e/night.spec.ts` asks for `colorScheme: "dark"` and checks the colours the browser computes against the night values in `design/system/tokens.json`.
- A new card ignores input for 250 ms (spec section 8). `waitForCard` waits 300 ms after the card appears; a spec that drives input by hand must do the same, or a test that expects "no answer" passes for the wrong reason.
- The start flow ignores presses on a step's options, the continue line and "Start round" for 250 ms after a step change. Wait with `atStep(page, title)` before pressing them; Back and the pass fields never wait.
- The current step of the start flow is `[data-step]:not([inert]) h2`: during a transition the leaving step is still in the page, inert.
- Swipes use the mouse (`dragCard`), which produces pointer events in both browsers. A real touch drag is only possible through the Chromium DevTools protocol, so that one spec is skipped in WebKit.
- A spec that plays several rounds calls `test.slow()`.

Run one file, or see the browser:

```bash
pnpm exec playwright test e2e/swipe.spec.ts
pnpm exec playwright test e2e/swipe.spec.ts --project=phone-webkit --headed
```

Locally an already running `pnpm start --port 3100` is reused (rebuild it after a change); in CI the specs always build first. A failed test keeps its trace in `test-results/` (`pnpm exec playwright show-trace <path>`); CI uploads that folder as the `playwright-traces` artifact.
