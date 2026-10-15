# Visual review and feel recordings (iOS)

The scripts of spec 7.4 and 5.8 for the iOS app. They need Node 24, Xcode 26.6 with the iOS 26.5 (and 18.4) simulator runtime, the repository's `node_modules` (`pnpm install`) and Playwright's WebKit (`pnpm exec playwright install webkit`). Everything they write goes to `out/`, which git ignores.

## Visual review

Start the web app in one terminal, the production build as the e2e specs use it:

```bash
pnpm build && pnpm start --port 3100
```

Then, from the repository root:

```bash
node ios/Tools/visual-review/review.mjs --runtime iOS-26-5
```

It builds the app for testing once, creates and boots two simulators on that runtime ("Truthy Review SE", 375 by 667 at 2x, and "Truthy Review 15 Pro Max", 430 by 932 at 3x) with a fixed status bar, and for each phone and theme:

1. installs the app fresh and runs `VisualCaptureTests/testCaptureEveryScreen`: start steps 1 to 6, the question, the answered card, the leave sheet and the result of a Classic round on CLF / SEC, every card answered True, with the round seed fixed (`--seed`, default 1234567, the seed plan C's review uses too); once at the default text size and once at the largest accessibility size;
2. runs `VisualCaptureTests/testCaptureTheStoredThemeAgainstTheSystem` with the system appearance opposite to the theme (N12);
3. captures the same ten screens of the web in WebKit at the same size and scale, with the same seed.

It then compares, for each pair:

- element frames (`logo`, `pass`, `ticket`, `card`, `stub`, `sheet` and the pills `pill:<title>`), which must be within 2 points of the web's;
- colours at fixed points (the sky column at x 4, the ticket's band and paper, the sheet card, each pill) against `native-data/tokens/resolved.json` (the sky as its gradient at that height, under the scrim on the leave sheet), within 3 per channel, on both sides;
- the status bar of the N12 captures: the sky is the app theme's `sky-1` and the glyphs are dark on the day sky and light on the night sky.

Output in `out/<runtime>/`: `pairs/<phone>-<theme>-<screen>.png` (the web left, iOS right, frames outlined green within tolerance and red outside it), `report.md`, `report.json`, and the largest-text screenshots under `ios/<phone>/<theme>-largest/` for N9. The script exits 1 while anything is outside its tolerance and not approved.

`--skip-build` reuses the last build, `--skip-capture` only compares what `out/<runtime>/` already holds.

### Approved differences

A difference the owner accepts (criterion 2: system insets, sheet chrome, the in-app browser) is recorded in `approved.json`, keyed `<phone>-<theme>-<screen>:<element>` for a frame and `<phone>-<theme>-<screen>:color:<ios|web>:<probe>` for a colour, with the owner's reason and the date as the value. Only the owner approves; the same decisions are listed in `ios/docs/visual-review.md`.

## Recordings

```bash
node ios/Tools/visual-review/record.mjs test --device large --test TruthyUITests/FeelTests/testBackOnTheRoundActsLikeTheX --name N13-back-26
node ios/Tools/visual-review/record.mjs launch --device large --system light --app dark
node ios/Tools/visual-review/record.mjs between --device large --theme night
```

`test` records the simulator while one UI test runs. `launch` stores one app theme against a system appearance, then records a cold launch; `between` records a start flow, a round and the way back. Both check every frame at 2 points from the top left corner (`frames.swift`): first the launch screen in the system's `surface` colour or a blend from it, then only the app's `sky-1`; a white or mismatched frame fails and is listed in the `.json` next to the recording. All recordings go to `out/recordings/`. `--runtime` picks the simulator runtime, `--build` builds first.

## Tests

```bash
node --test "ios/Tools/visual-review/*.test.mjs"
```
