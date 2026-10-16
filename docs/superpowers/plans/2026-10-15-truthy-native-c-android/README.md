# Truthy native, plan C (Android) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Kotlin and Jetpack Compose app for Android 8 (API 26) and later that plays exactly like the web app (same decks, dealing, classes, records and progress format), looks like the Boarding Pass design in day and night, and behaves natively in every gesture (predictive back, stretch overscroll, edge to edge), ending with a signed release APK that installs and plays a round on API 36 and API 26 emulators.

**Architecture:** One Gradle project, `android/Truthy`, with three modules. `:engine` is a pure Kotlin JVM module holding the line-by-line port of every function in reference 3.9, tested with JUnit against the golden vectors in `native-data/golden`. `:tokengen` is a small JVM module that turns `native-data/tokens/resolved.json` into the committed `Tokens.kt` and tests that it is current. `:app` is the Compose application: content loading from `native-data/decks` as an assets source directory, progress storage, the round journal, app state in ViewModels, the design system and the screens. The two top-level screens swap in place in the activity's state; the start flow's back motion is a pure function of progress that `PredictiveBackHandler` drives.

**Tech Stack:** Kotlin 2.4.21 (built into AGP 9), Android Gradle Plugin 9.x with Gradle 9.x, JDK 17 or later (Android Studio's bundled JBR 25.0.2), compileSdk 37, targetSdk 36, minSdk 26, Compose BOM 2026.09.00 (UI 1.12.1, Material3 1.4.0), activity-compose 1.13.0, lifecycle 2.11.0, core 1.19.1, core-splashscreen 1.2.0, browser 1.10.0, kotlinx-serialization 1.11.0, JUnit for the engine, Compose UI tests on the emulator. Task 1 pins the exact versions against their release pages before writing the version catalog.

**Spec:** `docs/superpowers/specs/2026-10-14-truthy-native-apps-design.md` (binding), its companion `docs/superpowers/specs/2026-10-14-truthy-native-port-reference.md` (constants, copy, tokens, rules), and plan A's README for the golden vector format (`docs/superpowers/plans/2026-10-15-truthy-native-a-shared-data/README.md`, section "The golden vector format"). Plan A must be complete before task 1. Plan B is not a prerequisite, but where plan B has already settled a detail of a shared concern (a golden test's shape, a back-motion frame, a guard), this plan matches it.

## Global Constraints

- Every shell that runs `./gradlew` first runs `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` (task 1). If that `java -version` hangs, a separate JDK 17 or newer is installed with the owner's approval and `JAVA_HOME` points at it.
- applicationId and namespace `com.eienmosu.truthy`. minSdk 26, targetSdk 36, compileSdk 37. Kotlin DSL and a version catalog `gradle/libs.versions.toml`. No dependency outside AndroidX, Kotlin and kotlinx.
- Layout: `android/Truthy/{settings.gradle.kts, build.gradle.kts, gradle/, engine/, tokengen/, app/}`, packages `com.eienmosu.truthy.engine` (`:engine`), `com.eienmosu.truthy.tokengen` (`:tokengen`), `com.eienmosu.truthy` (`:app`).
- The engine module is a plain Kotlin JVM module with no Android dependency. It is pure: no `System.currentTimeMillis`, `System.nanoTime`, `SystemClock`, `java.time` clocks, `Random` or `SecureRandom`, no coroutines, `Thread.sleep`, `Handler` or timers, no file or preference access, no `android.*` or `androidx.*` import. A test fails otherwise.
- **The Kotlin API mirrors the TypeScript exports one to one:** the same function and type names, the same parameter order, optional parameters as default arguments, string-literal unions as enums with a `wire` property holding the TypeScript string (`Mode.CLASSIC.wire == "classic"`), constants with the same names (`SWIPE`, `DEAL`, `TIMED`, `CHUNK`). Times are `Double` epoch or monotonic milliseconds as in the TypeScript. `CardHistory.seen` is a `Long`, because the web keeps any stored safe integer up to 2^53 - 1 and a golden case holds one; every other count is `Int` (deviation 1 below).
- Port traps (each pinned by a golden test): JavaScript `Math.round(x)` is task 1's `jsRound` (half toward +infinity, `-0` kept; `floor(x + 0.5)` is wrong where `x + 0.5` is inexact), the one port of it in the engine, not `kotlin.math.round` (half to even) or `roundToInt` (half away from zero for negatives); `>>> 0` and `Math.imul` are 32-bit wrapping arithmetic on `Int` read as unsigned (`toUInt()`), or masked `Long`; `string.length` counts UTF-16 units, which Kotlin's `String.length` also does; sorts the TypeScript relies on being stable use Kotlin's stable `sortedWith`; cards are compared by `id`; a non-finite `lastSeenAt` counts as 0.
- Golden files are found through the system property `truthy.golden`, which the `:engine` test task sets from the project directory at build time (spec 4.1); no path is written into a committed file. A file is `<module with "/" as ".">.<function>.json`, with plan A's one exception: the constant `DEAL` is `src.engine.deal.DEAL.constant.json`. Every test loads its file with `Golden.load("<module>", "<function>")`, two string literals, so the coverage test can see it; the `:engine` tests use `kotlin.test` on JUnit 4 (`kotlin-test-junit`).
- Every user-facing string and accessibility label is taken verbatim from reference 4.5. Every colour, size, duration and curve comes from the generated `Tokens.kt`, plan A's additive `native` group included (`Tokens.Native`: the sky's stops, the short-screen rule, the 36 step-title row, the sheet's reduced 140 ms and the type size variants, written nowhere else); no literal design values in composables.
- Fonts: Overpass 600 and 800, Overpass Mono 400 and 600, static TTF files in `res/font` with `OFL.txt` in `assets/licenses/`, every weight requested explicitly.
- No navigation library for the top-level screens: the start flow and the round swap in place in the activity's state. `android:enableOnBackInvokedCallback="true"`. Edge to edge with bar icon colours from the app's theme.
- Press feedback per spec 5.6: `graphicsLayer` scale and offset from `collectIsPressedAsState`; a bounded ripple only on the pass fields and the continue line; `LocalIndication` is no indication elsewhere.
- Haptics only as spec 5.5's table, through `ViewCompat.performHapticFeedback` with `HapticFeedbackConstantsCompat`.
- Timed pauses only on `ON_STOP` and resumes on `ON_START`; the app's own sheet window never pauses it.
- Repository hygiene (spec section 8): no absolute local path in Gradle files or properties (`local.properties` stays ignored); no Kotlin labelled `this` followed by a member access in a form the e-mail rule matches (write a local `val activity = this` instead); no image file name with a scale suffix after an at sign; PNG files without text or EXIF chunks; no em dash; commits by EienMosu with the noreply address; the keystore and its passwords never in git.
- Every task ends with `./gradlew :engine:test` green, and from task 7 on with `./gradlew :app:testDebugUnitTest :app:assembleDebug` green and, where the task says so, `:app:connectedDebugAndroidTest` on the API 36 emulator. The web's `pnpm test` stays green.

## Review Focus

1. **Back on API 26, 33, 34 and 36.** Expected: on API 34 and later, predictive back scrubs the start flow's back motion and the round's shrink and cancels cleanly; on API 33 and 26 the same back commits at once with a correct final frame (spec 5.1). Task 12 tests the instant-commit path in a unit test of `BackTransition`; task 15 checks each API level on its emulator.
2. **The app is killed in the middle of a round** (`adb shell am kill` while backgrounded, and "Don't keep activities"). Expected on the next launch: the journal is applied with the leave rules and deleted, and the app opens at start step 1. Tasks 9 and 11.
3. **The stored theme is the opposite of the system theme.** Expected: the first frame, the status and navigation bar icons and, on Android 12 and later, the splash all follow the stored theme (`UiModeManager.setApplicationNightMode`); below 12 the splash follows the system. Tasks 8 and 11, feel item N12 in task 15.
4. **Font scale 200 percent and reduced animations (`ANIMATOR_DURATION_SCALE` 0).** Expected: nothing clips; the fades the web keeps under reduced motion still play because they run with a `MotionDurationScale` of 1. Tasks 12 to 14, checked in task 15.
5. **A drag that starts inside the system gesture inset, and a diagonal drag on a long statement.** Expected: the first belongs to the system (back), never to the card; the second either scrolls or drags, never both. Task 13 tests both with Compose UI tests and `adb` input (N3).

## How this plan is organised

One file per task in this folder. Execute them in numeric order on the branch `native`, in the worktree `../truthy-native`; each task builds only on what the tasks before it created, ends with its gates green and commits all of its changes. Commands run from the repository root unless a step says `cd android/Truthy`.

| Task | File | Delivers | Tier |
|---|---|---|---|
| 1 | `01-toolchain-engine.md` | The JDK (Android Studio's JBR through `JAVA_HOME`), pinned versions, the Gradle project with `:engine`, the golden loader, the coverage, purity and manifest tests, rng, shuffle, `pad2`, logo height, theme rules | most capable |
| 2 | `02-deal.md` | `deal`, `dealChunk` and every internal of `deal.ts`, against all dealing vectors | most capable |
| 3 | `03-round.md` | The round reducer, the four classes, the Timed clock, `chunkSeed`, `scoreOf`, `summarise`, against the round traces | most capable |
| 4 | `04-swipe-progress.md` | Swipe interpretation and the progress rules, including partial reads and the unreadable side-copy decision | most capable |
| 5 | `05-catalog-flow.md` | Content helpers, text parts, the class table, catalog helpers, start-flow step helpers, the list cue, the pass and continue labels | standard |
| 6 | `06-copy-geometry.md` | Play copy, leave rules, result copy, missed cards, ticket scrolls, flight path, Streak, Lives and Timed headers, barcode, `ticketFor`, contrast; the coverage test now requires every golden file | standard |
| 7 | `07-app-module.md` | `:app`: manifest, activity, the assets source directory, fonts and `OFL.txt`, adaptive icon, splash, edge to edge, backup rules; the app launches on the API 36 emulator | most capable |
| 8 | `08-tokens-theme.md` | `:tokengen`, the committed `Tokens.kt` (with `Tokens.Native`) and its freshness test, theme resolution, fonts and type roles | standard |
| 9 | `09-data.md` | `DeckStore`, `ProgressStore` and `FileProgressStore` (`AtomicFile`, a single writer), `RoundJournal`, `ThemeStore` | most capable |
| 10 | `10-components.md` | Shapes, the 19 icons as `ImageVector`s, shadows, the sky, buttons with the web's press feedback, destination cards, stamps, the shared frame insets (`TruthyFrame`), the keyboard focus ring, the UI test tags; a debug gallery | standard |
| 11 | `11-app-state.md` | `AppViewModel` (top-level screen, process death), `StartFlowModel`, `BackTransition`, `RoundCoordinator` (clocks, guards, saves, journal, Timed ticker, `ON_STOP` pause), debug intent extras | most capable |
| 12 | `12-start-flow-ui.md` | The start flow screens, the fill-in pass, Recent, Continue, the theme switch, forward motion, predictive back driving the back motion, reduced motion, Escape | most capable |
| 13 | `13-round-ui.md` | The round screen: header indicators, ticket, stub and slip, stamps, the `pointerInput` swipe, springs with velocity, haptics, the Timed flow, keyboard, announcements, Custom Tabs links | most capable |
| 14 | `14-leave-result.md` | The leave sheet (`ModalBottomSheet`) with the web's scrim, predictive back on the round, the result screen, the round's host wired to task 11's decisions | most capable |
| 15 | `15-ui-tests-review.md` | Compose UI test stories, the Android feel checklist with recordings on API 36, 34, 33 and 26, the visual review of the twenty states plan B also reviews, its captures and pairs | most capable |
| 16 | `16-release.md` | R8, the release signing config, the new keystore outside the repository and its backup, the release APK played on API 36 and 26 | standard |

If a step's actual output differs from the stated one, stop and find out why before going on.

## Drafting record

Plain record of what was compiled or run while these files were written, and what has been compiled and run since. "Review" is the cross-check of all sixteen task files against each other, the spec, the reference and plan A; it compiled nothing. Its one run was a script that matched plan A's 130 golden registry entries against the literal `Golden.load` calls in this plan. After the review, on 2026-10-15, tasks 1 to 15 were assembled from these files (every code block, the in-place edits the steps describe, the fonts made with task 7's script and fontTools 4.67.0, `Tokens.kt` generated by task 8) and run with the Android Studio JBR 25.0.2, Gradle 9.7.1 and the API 36 emulator (`Pixel8_API36`) against plan A's real `native-data`: 130 golden files, the 54 decks and the index, `tokens/resolved.json` with its `native` group, `manifest.json` (format 1, generator 1). Every defect that run found is fixed in these files; the last assembly is exactly these files, with no change by hand.

On 2026-10-15 tasks 1 to 6 were assembled from these files and run with JBR 25.0.2 and Gradle 9.7.1 against plan A's real native-data (130 golden files, 54 decks): every task boundary reached its stated count, the final run was 372 run, 372 passed, 0 skipped with the coverage flag on, and the bite steps (task 1 steps 24 and 31, task 2 step 8, task 3 step 12) failed as stated. Task 1 has since gained the manifest test, so every count from task 1 step 23 on is one higher: task 1 ends at 57 run (56 passed, 1 skipped) and task 6 at 373 run, 373 passed, 0 skipped, both run again on these files.

| Task | Compiled or run while drafting | Compiled and run against plan A's real export (2026-10-15) | Still not compiled or run |
|---|---|---|---|
| 1 | Every file as first drafted, against nine golden files made by running the web's own functions. | Every file: 57 run, 56 passed, 1 skipped at the task's end; step 24's four failures; the manifest test, which also fails when `generator` is changed to 2; no compiler warning. | A separate JDK (rule 1's fallback); the git and `pnpm` steps (no commit was made). |
| 2 | The TypeScript facts it states, run against `src/engine/deal.ts`. | All Kotlin: the task's boundary count and step 8's planted fault. | The git and `pnpm` steps. |
| 3 | Nothing. | All Kotlin: the task's boundary count and step 12's planted fault. | The git and `pnpm` steps. |
| 4 | Node's `JSON.stringify` and `JSON.parse` outputs behind the writer and reader tests. | All Kotlin, against every swipe, progress and local golden file. | The git and `pnpm` steps. |
| 5 | Nothing. | All Kotlin. | The git and `pnpm` steps. |
| 6 | A few pinned values recomputed with the web code. | All Kotlin, the coverage flag on: 373 run, 373 passed; a mutation of each of the 130 golden files failed its own suite; no warning. | The git and `pnpm` steps. |
| 7 | The font pipeline of step 12. | The module, the fonts (the stated hashes), the unit tests and the five launch tests on API 36. | Step 20's look by eye; the git and `pnpm` steps. |
| 8 | Nothing. | The generator with `Tokens.Native` (18 generator and 3 freshness tests), the theme, font and type role tests. | The git and `pnpm` steps. |
| 9 | Nothing. | All Kotlin and its unit tests. | The git and `pnpm` steps. |
| 10 | Nothing. | All Kotlin, its unit tests and its 9 instrumented tests on API 36. | The debug gallery by eye. |
| 11 | Nothing. | All Kotlin and its unit tests (`:app:testDebugUnitTest`: 284 tests for tasks 7 to 15, all passed). | Step 37's kill on the emulator and the `adb` launches by hand. |
| 12 | Nothing. | All Kotlin and its 10 instrumented tests on API 36. | API 34, 33 and 26. |
| 13 | Nothing. | All Kotlin and its 17 instrumented tests on API 36. | The `adb` input checks by hand; API 34, 33 and 26. |
| 14 | Nothing. | All Kotlin and its 30 instrumented tests on API 36; task 15's `aDoubleTapOnTheXLeavesTheSheetOpen` passed with `RoundHost` answering `true` (spec 5.4: the sheet's scrim guard was not needed). | API 34, 33 and 26. |
| 15 | The emulator images checked against Google's system image list. | All Kotlin: the whole instrumented suite on API 36 (106 tests, 104 passed, 2 skipped, as step 35 states); `NoClipTest` at font scale 2.0 with animations off over the twenty review states; `VisualCaptureTest` with `capture=1`, day and night at font scale 1.0 (every element of the twenty states found; every colour probe within 3 of its token except the day sky probes beside a ticket, step 31); `compare.test.mjs` and `checklist.test.mjs` (17 passed); `node --check` of `web-capture.mjs` and `pair.mjs`, `bash -n` of `capture-android.sh`. | The web capture and the pairing (they need the web's production build); the captures at font scale 2.0; API 34, 33 and 26; the feel checklist and its recordings; the owner's review. |
| 16 | The Node tools and their 29 tests under Node 24; the `apksigner` and `aapt2` parsers against real output; the driver against a simulated phone. | Nothing (the release build was not assembled). | All Gradle and Kotlin; no real emulator or keystore. |

## Cross-platform agreements

- Golden file names: `native-data/golden/<module with "/" as ".">.<name>.json` for functions and constants alike, with exactly one exception, the constant `DEAL` of `src/engine/deal`, which is `src.engine.deal.DEAL.constant.json` (plan A README). Each loader holds that one pair in a fixed exception table; nothing reads the folder to pick a name, and a coverage check fails when two golden file names are equal ignoring case (B task 1, C task 1).
- Golden coverage: every test loads its file with `Golden.load("<module>", "<name>")`, two string literals; the coverage test turns `everyFileRequired` / `EVERY_FILE_REQUIRED` on in task 6, and from then on each of the 130 files must be loaded by some test (B task 6, C task 6).
- Manifest: neither app reads `native-data/manifest.json` at run time. Each engine suite checks it once: `format` 1, `generator` 1, `deckHashes` naming exactly the 54 deck files, each hash equal to the deck file's `hash` and the index entry's `hash`, and every index `version` equal to `deckIndexVersion`; a failure means plan A changed its layout and the plan is updated first (B task 1, C task 1).
- Decks: `native-data/decks/index.json` and the 54 `<deckId>.json` files are bundled in place, never copied into `ios/` or `android/` (an Xcode folder reference named `decks`, an assets source directory); card order inside a deck file is kept (B task 7, C task 7).
- Tokens: each generator reads only `native-data/tokens/resolved.json`, including the additive top-level `native` group (`sky-stops`, `sheet`, `safe-area-short`, `step-title-row`, `type`), and emits it as `Tokens.Native`; the sky gradient stops, the short-screen rule (below 568: 8 and 12), the 36 step-title row, the sheet's reduced 140 ms and the size variants of reference 5.0 and 5.3 come from there and are written nowhere else (B tasks 8, 10, 12 and 14, C tasks 8, 10, 12 and 14).
- Compact carrier label: 11 with tracking 0.66 (`tracking-[0.06em]` at 11 px in `FillInPass.tsx`), not the role's 0.72 (B task 8, C task 8).
- Fonts: the same bytes on both platforms, the four static cuts instanced from the google/fonts variable files at commit `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5` with fontTools 4.67.0, name record 19 removed, with the SHA-256 values C task 7 step 12 states; PostScript names `OverpassRoman-SemiBold`, `OverpassRoman-ExtraBold`, `OverpassMono-Regular`, `OverpassMono-SemiBold`, the names those files carry; the file names are each platform's own (B task 7, C task 7).
- Counters: Swift uses `Int` (64-bit) everywhere; Kotlin keeps `CardHistory.seen` as `Long` and records, `score` and `total` as `Int`, a value above 2^31 - 1 reading as a failing part (C decision D1, a recorded deviation). No golden case reaches the difference: the only stored record above that is 2^53, which the web drops too (B task 1, C tasks 1 and 4).
- Stored JSON reader: more than 512 nested arrays and objects fail the parse (the read is not whole, the raw text goes to the side copy) instead of overflowing the stack, and a `\u` escape needs exactly four ASCII hex digits (`\u+041` fails). A lone surrogate is U+FFFD in Swift and kept in Kotlin. All three are recorded deviations (B task 4, C task 4).
- Start back motion: `BackTransition(from, to, itemCount)` with `itemCount` the new step's title plus its rendered options and no default; full motion lasts `max(360, 110 + 25 (itemCount - 1) + 240)` ms, reduced 230 (`90 + reduced-in`); the frame holds the parts of C task 11 rule 4, back-to-step-1 zones, Start round, the pass stage morph and value copies included; reduced fades use `ease-out` and the instant parts switch at t = 100 (B task 11, C task 11).
- Back gesture release (iOS): completes above p 0.5 or above 500 pt/s towards the trailing edge, cancels above 500 pt/s towards the leading edge; Android commits on the system's decision, and below API 34 at once (B task 11, C task 12).
- Back on the round scales the surface from 1 to 0.94 with the progress, pivot at the centre, a cancel springs back, and on release does what the X does; on loading it leaves at once; while the sheet is open it means Keep playing (B task 13, C task 14).
- Back on the result does what Close results does and is ignored for 1000 ms from the result's first frame, on the monotonic clock (B task 14, C task 14).
- Guards on the monotonic clock: answers 250 ms after the card appeared, Next card and See results 420 ms, result actions 1000 ms, start options, Continue and Start round 250 ms after a step appears; backs never wait (B task 11, C task 11).
- Leave sheet scrim guard (spec 5.4): the coordinator always computes `scrimTapAccepted` (250 ms from the sheet opening, unit tested), but the sheet consults it only if the double-tap UI test on the X fails; the outcome is recorded under N7 (B task 14, C tasks 14 and 15).
- Progress save after a failed read: a save never writes over the stored progress after the read it was built on failed; it waits for a load that succeeds. Native only (on the web a throwing `localStorage` stays blocked; on a phone a read can fail and later work), and no deviation from the spec: the store remembers a throwing read of the progress key, refuses to write that key until a load succeeds, and never holds back the side copy; plan C's `AtomicFile` store mirrors it (B task 9 `GuardedStorage`, C task 9).
- Round journal: written after every change of the number of answers or of `isDecided`; deleted when the round is recorded or left; at launch applied with the leave rules and then deleted, also when unreadable. A kill between apply and delete applies it once more (one more `seen` per card, record and `last` unchanged), accepted (B tasks 9 and 11, C tasks 9 and 11).
- Process death: the app opens at start step 1 with no choices after applying the journal and pruning every played deck; a round is never resumed and no state is restored from the system (B task 11, C task 11).
- Timed: the clock pauses through the engine's `visibility` event only when the app goes to the background (scene phase `.background`, `ON_STOP`) and resumes on return; the sheet, Control Center and the notification shade never pause it; the 100 ms ticker keeps firing during scrolls and drags (B task 11, C task 11).
- Haptics, exactly spec 5.5: one light impact or `GESTURE_THRESHOLD_ACTIVATE` per crossing of the 90 line (re-armed silently below it), success or `CONFIRM` on a right answer, error or `REJECT` on a wrong one, warning or `REJECT` when Timed runs out; nothing else (B task 13, C task 13).
- Debug launch (debug builds only): the same keys and values on both, seed (0 to 4294967295), route (deck and section, `ALL` for the whole deck), mode (`classic`, `streak`, `lives`, `timed`), screen (`start`, `round`, `answered`, `sheet`, `result`), step (1 to 6, with `start`) and theme (`light`, `dark`); iOS `-seed`, `-route <deckId>/<sectionId>`, `-mode`, `-screen`, `-step`, `-theme`; Android extras `truthy.seed`, `truthy.deck`, `truthy.section`, `truthy.mode`, `truthy.screen`, `truthy.step`, `truthy.theme` (B task 11, C task 11).
- Visual review seed: both platforms and the web deal with `REVIEW_SEED` 1234567 and play Classic on CLF / SEC with True on every card (B task 15, C task 15).
- Visual review states, the same ids on both: `s1` to `s6`, `p2`, `p3`, `p4`, `r1`, `streak-p2`, `streak-r1`, `lives-p2`, `lives-r1`, `lives-r1-why`, `timed-p2`, `timed-up`, `timed-r1`, `s1-returning`, `s3-recent`. The Timed stamp beat (reference P3t) is not captured on either: it lasts 700 ms and is checked in the feel recordings (B task 15, C task 15).
- Colour probes, the same points on both: the sky at x 4 and y 120, 300, 560 and 860 (expected with the scrim under the sheet); a band 4 below its top at its horizontal centre (`accent`); the ticket paper 6 in from the left and 50 down (`surface-raised`); the sheet card 10 in at half its height (`surface-raised`); a pill 14 in at half its height (`true`, `false` or `ink`); tolerances 2 for frames, 3 per channel for screenshots, 12 for video (B task 15, C task 15).

## Deviations from the spec

Recorded for the owner's review; each is pinned by a test in the task named.

1. **Decision D1** (task 4): `CardHistory.seen` is a `Long`, but the records, `last.score` and `last.total` are `Int`. A stored value above 2^31 - 1 there is read as a failing part (that part is dropped, the read is not whole, the raw value goes to the side copy), where the web keeps it. No golden case and no real round reaches it; if the owner prefers full parity, the records, `score` and `total` become `Long` too.
2. **Decision D2** (task 4): a stored JSON value nested more than 512 arrays and objects deep fails the parse (the read is not whole, the raw text goes to the side copy) instead of overflowing the thread's stack.
3. **The `\u` escape** (task 4, recorded with D2): it needs exactly four ASCII hex digits (`\u+041` fails), as `JSON.parse` agrees. A lone surrogate is kept, as JavaScript keeps it (plan B turns it into U+FFFD).
4. **The sheet's slide** (task 14 rule 5): Material3 1.4.0 keeps its sheet motion internal, so the sheet cannot take the web's 24 px and 360 ms; that is sheet chrome under spec criterion 2 and goes to the owner's review pairs. The card's fade and the scrim are the web's.
5. **Text wraps where the web truncates** (task 10 rule 7, task 12): a destination card's name and the continue line's deck name wrap instead of ending in an ellipsis, because at font scale 2.0 text must never clip (spec 5.6).

## Interfaces every task can rely on

Engine (tasks 1 to 6): the TypeScript exports of reference 3.9 under the naming rule above, in `com.eienmosu.truthy.engine`. The types tasks 1 to 4 create and later tasks use:

```kotlin
@Serializable data class Card(val id: String, val section: String, val text: CardText, val answer: Boolean, val source: CardSource, val difficulty: Int, val appliesTo: String, val conflictGroups: List<String>)
@Serializable data class DeckIndex(val areas: List<IndexArea>)          // IndexArea, IndexPlatform, IndexDeck, IndexSection mirror schema.ts
@Serializable data class DeckFile(val id: String, val hash: String, val cards: List<Card>)
@Serializable data class Route(val deckId: String, val sectionId: String)
const val WHOLE_DECK = "ALL"
enum class Mode(val wire: String) { CLASSIC("classic"), STREAK("streak"), LIVES("lives"), TIMED("timed") }
@Serializable data class CardHistory(val seen: Long, val lastCorrect: Boolean, val lastSeenAt: Double)
typealias History = Map<String, CardHistory>
data class Answered(val card: Card, val given: Boolean, val correct: Boolean, val at: Double)
data class RoundResult(val mode: Mode, val route: Route, val score: Int, val total: Int, val answers: List<Answered>, val missed: List<Answered>, val abandoned: Boolean)
typealias Rng = () -> Double
fun createRng(seed: Double): Rng

enum class Phase(val wire: String) { QUESTION("question"), ANSWERED("answered"), STAMPED("stamped"), FINISHED("finished") }
data class Clock(val remainingMs: Double, val lastTick: Double?, val hidden: Boolean, val holdMs: Double)
data class RoundState(val mode: Mode, val route: Route, val cards: List<Card>, val index: Int, val answers: List<Answered>, val phase: Phase, val abandoned: Boolean, val source: DealSource, val clock: Clock?)
sealed interface RoundEvent { data class Answer(val value: Boolean, val at: Double); data object Next; data class Tick(val now: Double); data class Visibility(val hidden: Boolean, val at: Double); data object Abandon }

data class SwipeSample(val x: Double, val y: Double, val t: Double)
data class SwipeContext(val viewportWidth: Double, val cardShownAt: Double)
enum class SwipeOutcome(val wire: String) { TRUE("true"), FALSE("false"), CANCEL("cancel") }
@Serializable data class Progress(val version: Int, val cards: Map<String, CardHistory>, val records: Map<String, Int>, val last: LastRound?)
fun readProgress(raw: String?): ReadResult    // data class ReadResult(val progress: Progress, val whole: Boolean)
```

App (tasks 7 to 14), in `com.eienmosu.truthy`:

```kotlin
interface ProgressStore { suspend fun load(): Progress; suspend fun save(progress: Progress) }
class FileProgressStore(dir: File) : ProgressStore            // AtomicFile; truthy.progress.v1.json and .unreadable.json; one writer
class RoundJournal(dir: File) { suspend fun record(entry: JournalEntry); suspend fun clear(); suspend fun pending(): JournalEntry? }
@Serializable data class JournalEntry(val route: Route, val mode: Mode, val seed: Long, val roundId: String, val answers: List<JournalAnswer>, val decided: Boolean, val recorded: Boolean)
class DeckStore(assets: AssetManager) { fun index(): DeckIndex; suspend fun deck(id: String): DeckFile }
class ThemeStore(prefs: SharedPreferences) { val stored: StoredTheme?; fun store(theme: StoredTheme) }   // key "truthy.theme"
class AppViewModel : ViewModel { val screen: StateFlow<TopScreen>; val theme: StateFlow<ResolvedTheme> }
class StartFlowModel { val stack: StateFlow<List<Step>>; val choice: StateFlow<StartChoice>; fun choose(...); fun back(to: Step) }
data class BackTransition(val from: Step, val to: Step, val itemCount: Int) { fun durationMs(reducedMotion: Boolean): Int; fun frame(p: Float, reducedMotion: Boolean): BackFrame }   // pure, tested at fixed p; itemCount has no default; full motion lasts max(360, 110 + 25 (itemCount - 1) + 240), reduced 230
class RoundCoordinator { val state: StateFlow<RoundState>; fun answer(value: Boolean); fun next(); suspend fun leave(); fun onStop(); fun onStart() }
fun interface WallClock { fun nowMs(): Double }          // epoch ms
fun interface MonotonicClock { fun nowMs(): Double }     // SystemClock.uptimeMillis, the base of MotionEvent.eventTime
data class DebugLaunch(val seed: Long?, val route: Route?, val mode: Mode?, val screen: DebugScreen?, val theme: StoredTheme?, val step: Step? = null)   // debug builds only (BuildConfig.DEBUG), from intent extras truthy.seed (a string or long extra), truthy.deck, truthy.section, truthy.mode, truthy.screen (start, round, answered, sheet, result), truthy.step, truthy.theme
```

Later tasks may add members; they never rename these.
