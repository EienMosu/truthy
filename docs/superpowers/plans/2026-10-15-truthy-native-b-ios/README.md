# Truthy native, plan B (iOS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A SwiftUI app for iOS 18 and later that plays exactly like the web app (same decks, dealing, classes, records and progress format), looks like the Boarding Pass design in day and night, and behaves natively in every gesture, ending with a Personal Team build on the owner's iPhone 15 Pro Max.

**Architecture:** Two parts. `ios/TruthyEngine` is a Swift package holding the pure engine, a line-by-line port of every function in reference 3.9, tested with `swift test` against the golden vectors in `native-data/golden`. `ios/Truthy` is an Xcode project (synchronized folders, objectVersion 77, modelled on The Slow Wire's) whose app target depends on the package and holds content loading, progress storage, the round journal, app state, the design system and the screens. The two top-level screens (start flow and round) swap in place; the start flow's back motion is a pure function of progress that the edge-pan gesture drives.

**Tech Stack:** Swift 6 language mode, SwiftUI with UIKit bridges (`UIGestureRecognizerRepresentable`, `SFSafariViewController`), Swift Testing for unit tests, XCTest UI tests, Xcode 26.6 with the iOS 18.4 and 26.5 simulators (Xcode 27 with the owner's agreement if the device needs it), no third-party dependencies.

**Spec:** `docs/superpowers/specs/2026-10-14-truthy-native-apps-design.md` (binding), its companion `docs/superpowers/specs/2026-10-14-truthy-native-port-reference.md` (constants, copy, tokens, rules), and plan A's README for the golden vector format (`docs/superpowers/plans/2026-10-15-truthy-native-a-shared-data/README.md`, section "The golden vector format"). Plan A must be complete before task 1: this plan reads `native-data/`. Golden files are `<module>.<name>.json`, constants included, with plan A's one exception `src.engine.deal.DEAL.constant.json` (see Cross-platform agreements).

## Global Constraints

- Deployment target iOS 18.0. Swift 6 language mode. Bundle id `com.eienmosu.Truthy`. `DEVELOPMENT_TEAM = 2MN3N47796` (the owner's Personal Team, public, as in The Slow Wire). No third-party packages.
- Layout: `ios/TruthyEngine` (Swift package, library `TruthyEngine`, tests `TruthyEngineTests`), `ios/Truthy/Truthy.xcodeproj` with targets `Truthy`, `TruthyTests`, `TruthyUITests`, `ios/TruthyTools` (Swift package: the token generator), `ios/Tools/icon` and `ios/Tools/fonts` (the icon drawing and the font name table reader of task 7), `ios/Tools/visual-review` (Node scripts for the visual review), `ios/Tools/device` (Node tools and the install script of task 16).
- The engine is pure: no `Date`, no clocks, no random generator, no timers or schedulers (`Timer`, `DispatchQueue`, `Task.sleep`), no `FileManager`, `FileHandle`, file reads or writes, or `UserDefaults`, no `SwiftUI`, `UIKit` or `Combine` import. A test fails otherwise.
- **The Swift API mirrors the TypeScript exports one to one:** the same function and type names, the same parameter order with unlabelled arguments (`_`), optional parameters as default arguments, string-literal unions as `String`-backed enums whose raw values are the TypeScript strings, constants with the same names (`SWIPE`, `DEAL`, `TIMED`, `CHUNK`). Times are `Double` epoch or monotonic milliseconds as in the TypeScript; counts are `Int`. Exceptions, as the TypeScript tests need them: `DealOptions.count`, every search budget and `SEARCH_BUDGET` are `Double` (the web passes 4.7, -3, NaN and Infinity); seeds are `Double` in the engine (`createRng`, `StartArgs.seed`, `chunkSeed`) and `UInt32` in the app (`JournalEntry.seed`, `LaunchArguments.seed`, `RoundRequest.seed`), passed as `Double(seed)`; a function that reads a module constant the web flips in its tests (`MODE_TABLE`) takes it as a trailing argument with the constant as the default; the web's `WeakMap` of recorded rounds is a `RecordedRounds` object the caller keeps.
- Port traps (each pinned by a golden test): JavaScript `Math.round(x)` is the engine's internal `jsRound(x)` (task 1): the floor plus one when `x - floor(x) >= 0.5`, `-0` for x in [-0.5, -0]; never `x.rounded()` and never `(x + 0.5).rounded(.down)`. `x >>> 0` is `jsUint32(x)`, and `Math.imul` is `UInt32` wrapping arithmetic; `Math.max`, `Math.min` and a number written into a string are `jsMathMax`, `jsMathMin` and `jsNumberString` (task 6); `string.length` and `slice` count UTF-16 code units (`utf16`); sorts the TypeScript relies on being stable carry an index tiebreak; cards are compared by `id`; a non-finite `lastSeenAt` counts as 0.
- Every golden test calls `Golden.load` with two string literals, `Golden.load("src/engine/deal", "DEAL")`: task 1's coverage test finds consumed files only that way, and from task 6 on a golden file no test loads that way fails `swift test`.
- Every user-facing string and accessibility label is taken verbatim from reference 4.5. Every colour, size, duration and curve comes from the generated `Tokens.swift`, the code values of reference 5.0 and 5.3 included (its `Native` and `Transition` groups); no literal design values in views (task 7's `AppSourceRulesTests` rejects literal and system colours, font sizes, browser-like dialogs, links out of the app and hover or long-press menus).
- Fonts: Overpass 600 and 800, Overpass Mono 400 and 600, static TTF files instanced from the Google Fonts variable files at the pinned commit with fontTools 4.67.0 (the same bytes as plan C, task 7), with `OFL.txt`, addressed by PostScript name (`OverpassRoman-SemiBold`, `OverpassRoman-ExtraBold`, `OverpassMono-Regular`, `OverpassMono-SemiBold`, the names those files carry), scaled with `relativeTo:` for Dynamic Type.
- No `NavigationStack`, `fullScreenCover` or navigation library for the top-level screens: the start flow and the round swap in place. No `simultaneousGesture` on the card.
- Haptics only as spec 5.5's table, through `sensoryFeedback`.
- Timed pauses only when the scene phase becomes `.background`.
- A recognizer's `isEnabled` never reads a clock and never changes while its own gesture runs (task 13 rule 1, task 12 rule 4). Every screen's root holds keyboard focus so the hardware keys work after touches.
- App code uses task 7's `EngineNames.swift` names (`Progress`, `StoredTheme`, `ResolvedTheme`, `StartChoice`); app test files write `TruthyEngine.Progress`, because Foundation's `Progress` makes the bare name ambiguous there.
- Repository hygiene (spec section 8): no absolute local path in `project.pbxproj`, schemes or plists; no image file name with a scale suffix after an at sign; PNG files without text or EXIF chunks; no em dash; commits by EienMosu with the noreply address; no signing files in git.
- Every task ends with `swift test` in `ios/TruthyEngine` green, and from task 7 on with `xcodebuild test` of the `Truthy` scheme on the iOS 26.5 simulator green. The web's `pnpm test` stays green (it runs the hygiene test over the new files).

## Review Focus

1. **The app is killed in the middle of a round.** Expected on the next launch: the journal is applied with the leave rules (no answers and undecided: nothing saved; undecided with answers: answers in the history and `last` with a null score, no record; decided and not recorded: recorded) and deleted, and the app opens at start step 1. Task 9 tests the store side (`RoundJournalTests`), task 11 the launch (`LaunchTestsOfTheModel`), task 16 the device (D10).
2. **The stored theme is the opposite of the system appearance.** Expected: the first frame the app draws is in the stored theme, the status bar follows it, and the launch screen alone follows the system (spec 5.6). Task 8 tests the resolution (`ThemeResolutionTests`), task 15 checks the screenshot (feel item N12) and the launch recording (N10).
3. **The largest accessibility text size.** Expected: nothing clips on any screen; the start flow's whole column, the ticket and the result scroll; the paper's own text stops at `xxLarge` (deviation 6); the leave sheet's detent grows to fit the card and becomes `.large` above the screen height. Task 12 reads step 1's tagline and every step title as drawn (`StartFlowLargeTextTests`), task 14 tests the detent (`LeaveSheetLayoutTests`); task 15 captures every screen of tasks 12 to 14 at the largest size, the other classes, the missed card with Why and the returning player's start included (N9).
4. **A diagonal drag that starts on a long statement, and a drag that starts within 24 of the window edge.** Expected: the first either scrolls the ticket or moves the card, never both; the second never moves the card (on the round it is the back pan). Task 13 tests both with XCUITest coordinates (`RoundGestureTests`, N3).
5. **Rapid repeated taps on the X, Next card and the result actions.** Expected: the 250, 420 and 1000 ms guards hold; a double tap on the X leaves the sheet open; a result is recorded exactly once. Task 11 tests the guards and the single recording in unit tests, task 13 the Next card taps, task 14 the X and the result actions (N7).

## Deviations from the spec

What this plan does on purpose where the web does otherwise, each recorded where the task states it:

1. **Stored JSON nesting and `\u` escapes** (task 4, rule 5): a stored value nested deeper than 512 arrays and objects reads as not whole (the raw text goes to the side copy) instead of overflowing the stack, and a `\u` escape needs four ASCII hex digits (`\u+041` fails as in `JSON.parse`, which a sign-accepting `UInt16(_:radix:)` would not). `JSON.parse` reads any depth; no golden case is that deep.
2. **A lone surrogate in a stored string** becomes U+FFFD, because a Swift `String` cannot hold one (plan C keeps it); no golden case has one (task 4).
3. **A stored theme that is not a string** (a number, an object, an array) reaches `parseTheme` as nil, which gives the web's `null` (task 1, rule 8).
4. **The sheet's slide** (task 14 rule 1): SwiftUI's `.sheet` keeps UIKit's presentation motion internal, so the sheet cannot take the web's 24 px and 360 ms; that is sheet chrome under spec criterion 2 and goes to the owner's review pairs. The card's rise and fade are the web's.
5. **Text wraps where the web truncates** (task 12): a destination card's name and the continue line's deck name wrap instead of ending in an ellipsis, because at the largest accessibility text size text must never clip (spec 5.6).
6. **The paper's own text stops growing at `xxLarge`** (tasks 12 to 14, `paperTextSize()`): the pass, a destination card's stub, the ticket's band, legs, fields, stub and stamps, the slip's answer row, the True and False pills, and the round's and the result's header label rows and field rows follow Dynamic Type up to `xxLarge`, one below the largest standard size, and no further. Their columns are fixed, and above that size they break words ("Platfor m", "Correc t") and end values in an ellipsis ("Tru...", "Cl...", "4 wr..."). Spec 5.6 lets text grow without limit; this and the continue line, which stops at the second accessibility size (task 12), are the places it stops early. Reading text (the tagline, the step titles, the cards, the statement, the explanation, the sheet) grows to the largest accessibility size and scrolls.
7. **The start column scrolls at the accessibility text sizes** (task 12 rule 9): the web scrolls the whole start column only on a short screen (under 568 tall); iOS does it there and also at every accessibility text size, where the fixed layout cut step 1's tagline ("True or false cards that teach you I...") and step 6's title. The hold of the Back pill and the pass fields after the column jumped to its top lives in the view, on the step's settle time, where plan C's model has `columnJumped()`.

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

## How this plan is organised

One file per task in this folder. Execute them in numeric order on the branch `native`, in the worktree `../truthy-native` that plan A set up; each task builds only on what the tasks before it created, ends with its gates green and commits all of its changes. Commands run from the repository root unless a step says `cd`; engine commands use `--package-path ios/TruthyEngine`.

| Task | File | Delivers | Tier |
|---|---|---|---|
| 1 | `01-engine-package.md` | `ios/TruthyEngine`: the content types, the golden loader (references, special numbers, card table, plan A's `DEAL.constant` exception, the throwing readers), the coverage, case and purity tests, the manifest check, rng, shuffle, `pad2`, logo height, theme rules | most capable |
| 2 | `02-deal.md` | `deal`, `dealChunk` and every internal of `deal.ts`, against all dealing vectors | most capable |
| 3 | `03-round.md` | The round reducer, the four classes, the Timed clock, `chunkSeed`, `scoreOf`, `summarise`, against the round traces | most capable |
| 4 | `04-swipe-progress.md` | Swipe interpretation and the progress rules, including partial reads (a stored JSON reader with a 512 nesting limit) and the unreadable side-copy decision | most capable |
| 5 | `05-catalog-flow.md` | Content helpers, text parts, the class table, catalog helpers (Recent, seen percent, Continue, pruning), start-flow step helpers, the list cue, the pass and continue labels | standard |
| 6 | `06-copy-geometry.md` | Play copy, leave rules, result copy and recording once, missed cards, ticket scrolls, flight path, Streak, Lives and Timed headers, barcode, `ticketFor`, contrast; the coverage test now requires every golden file | standard |
| 7 | `07-app-project.md` | The Xcode project (app, unit and UI test targets, the package dependency, the deck folder reference), Info.plist, fonts instanced from the pinned Google Fonts files (plan C's bytes) and `OFL.txt`, app icon, launch colour, `EngineNames.swift`, the source rules test; the app launches in the simulator | most capable |
| 8 | `08-tokens-theme.md` | `ios/TruthyTools` token generator (with the `native` group and the transitions), the committed `Tokens.swift` and its freshness test, type roles with CSS half-leading, motion helpers, theme resolution | standard |
| 9 | `09-data.md` | The two clocks, `DeckStore`, `ProgressStore` and `FileProgressStore` (atomic, serial, side copy), `RoundJournal`, `ThemeStore` | most capable |
| 10 | `10-components.md` | The SVG path reader, the 19 icons, notched shapes, perforations, stamp border, logo, barcode, shadows, the sky, buttons with the web's press feedback, the frame, keyboard focus rings, a debug gallery screen | standard |
| 11 | `11-app-state.md` | `AppModel` (top-level screen, launch with the journal, process death), `StartFlowModel`, `BackTransition` (the back motion as a function of progress, every part of plan C's rule 4), `RoundCoordinator` (clocks, guards, saves, journal on every change of the answers or of `isDecided`, Timed ticker and background pause), debug launch arguments with `-step` | most capable |
| 12 | `12-start-flow-ui.md` | The start flow screens, the fill-in pass in its three stages with the pass line, Recent, Continue, the theme switch, forward motion with name travel, the gesture-driven back (an edge pan of 24 points) with the pass stage morph and value copies, the list's reveal after a back, reduced motion, Escape | most capable |
| 13 | `13-round-ui.md` | The round screen: header indicators, ticket, stub and slip, the tear, stamps and jolt, the ticket scroll of task 6, the swipe recognizer, springs with velocity and the catch, haptics, the Timed flow, keyboard, announcements and focus, source links, back on the round | most capable |
| 14 | `14-leave-result.md` | The leave sheet, back on the result, the result screen with the comparison and the missed cards | most capable |
| 15 | `15-ui-tests-review.md` | XCUITest stories, the iOS feel checklist with recordings, the visual review script and its side-by-side pairs | most capable |
| 16 | `16-device.md` | The Personal Team device build and the device checklist (haptics, 120 Hz, VoiceOver, real finger, sheet material, icon) | standard |

If a step's actual output differs from the stated one, stop and find out why before going on.

## Drafting record

What was compiled or run while this plan was written and reconciled, and what was not. On 2026-10-15 every code block of tasks 1 to 15 was taken from these files as written (the last full block of each path) and run against plan A's real export of `native-data` (130 golden files, the index and 54 decks, `tokens/resolved.json` with its `native` group, `manifest.json` format 1, generator 1), with Xcode 26.6 and Swift 6.3.3 on the iOS 18.4 simulator (iPhone 16), and the whole test scheme of tasks 7 to 15 also on the iOS 26.5 simulator (iPhone 17 Pro). Nothing ran on a device.

| Task | Compiled and run against plan A's real export | Not compiled or run |
|---|---|---|
| 1 | All files, with tasks 2 to 6 removed: `swift test` ends `Test run with 53 tests in 9 suites passed ... with 1 known issue`, `everyGoldenFileHasATest()` skipped, no warning; the manifest check, the case check and the exception table (`DEAL.constant`) pass; step 18's mutation fails `RngTests` and `RngGoldenTests`. | The intermediate counts of steps 5 to 23, which are arithmetic from the drafting run (only the task's end was run here). |
| 2 | With tasks 1 and 2: 81 tests in 11 suites; step 8's mutation fails `"oldestFirst"`, `"deal"` and `"dealChunk"`. | Steps 6 and 7 alone. |
| 3 | With tasks 1 to 3: 180 tests in 15 suites; step 12's mutation fails the constants, `reduceTraces()` and `stateReaderVectors(function:)` (23 issues). | Step 7's intermediate count. |
| 4 | With tasks 1 to 4: 238 tests in 23 suites; `ProgressRead` alone 14 tests; lifting the depth limit crashes the new depth test (stack overflow) and a sign-accepting hex reader fails the `\u` test. | Steps 5, 12 and 25 alone. |
| 5 | With tasks 1 to 5: 294 tests in 35 suites; the `canShow` vector with the class "zen" passes; the Recent tie mutation fails both its tests. | Steps 7 and 10 alone. |
| 6 | Tasks 1 to 6 with step 13 applied: `Test run with 355 tests in 50 suites passed ... with 1 known issue`, the gate on; step 12's mutation fails the ring tests; step 14's load through a variable fails the gate with `(untested → ["components.BoardingPass.barcodeBars.json"]) == []`. | Steps 7 and 11 alone. |
| 7 | The project of step 2 (from these files) built for testing with the app code of tasks 8 to 15, no error and no warning; step 6's font script ran exactly as written (fontTools 4.67.0 from the pinned commit): `OFL identical`, the four hashes and PostScript names stated; `FontCoverageTests`, `BundledDecksTests`, `AppSourceRulesTests` (with the four new rules over every app file) and `EngineLinkTests` passed; a Release build for the simulator succeeded. | The step-by-step counts of this task alone (only the whole scheme ran); `xcodebuild -list` and the icon tool were not rerun (the icon PNG of the earlier run was reused). |
| 8 | The generator on the real `resolved.json`: `wrote ios/Truthy/Truthy/Design/Tokens.swift, 333 lines`, `Test run with 7 tests in 1 suite passed`; the design files and `TokensTests` and `ThemeResolutionTests` passed in the app. | Step 10's freshness mutation (the test itself passed). |
| 9 to 11 | Built and run as part of the whole app: `DataTests`, `ComponentsTests` and `StateTests` (the new back motion, debug start step, Timed journal and debug result tests included) all passed. After that run (task 4 review, fix round 1) task 9 gained `GuardedStorage`, the test `aSaveAfterAFailedReadWaitsForALoadThatSucceeds` and the writes-nothing checks of `aFailingReadIsEmptyProgressAndNeverReachesThePlayer`; `FileKeyValueStorage`, `FileProgressStore` and `ProgressStoreTests` from these files ran in a scratch package (task 6's three functions copied in) on macOS and on the iOS 26.5 and 18.4 simulators, 6 tests passed, and with the guard disabled the new test fails. Every app unit count from task 9 on is therefore one above this run's (task 15: 80). | Each task's counts on its own; the gallery by eye. |
| 12 to 14 | Built and run as part of the whole app. The unit tests passed (`PassMorphTests`, `RoundUnitTests`, `LeaveSheetLayoutTests`). UI tests on iOS 18.4 and 26.5: the edge pan completes and cancels (on 26.5 also the anywhere pan), the reveal after a back, the diagonal, vertical and edge drags, the swipe and the right arrow answering, the triple tap, the double and triple tap on the X, the swipe down and the tap above the sheet, the Timed clock under the sheet, the result recorded and Play again after its second all passed. The three Escape and Return tests skip on the simulator: XCUITest's `typeKey` does not deliver either key there (with the skip removed all three failed the same way on 18.4 and on 26.5; on 18.4 neither key reached `UIApplication.sendEvent`, while the arrows and letters did, whatever handled them: `onKeyPress`, a `keyboardShortcut`, a first-responder `UIKeyCommand` with priority over the system, `pressesBegan`). The Mac keyboard through the 18.4 simulator reached the plan's handlers: Escape went back on the start flow and did nothing on step 1, the right arrow answered and Return dealt the next card, Escape opened the sheet and a second Escape kept playing, Escape closed the result. A back from step 6 to 5 recorded with Escape showed the band and the paper shrinking while CLF and SEC travelled into their fields. Largest text (task 12 rule 9, deviations 6 and 7): text recognition over every screen at the largest accessibility size on 18.4 (the start steps, each class's round, the answered card, the sheet and each class's result, each scrolled to its end) found, against the earlier draft, step 1's tagline cut ("True or false cards that teach you I..."), step 6's title cut, the pass's band and values ending in an ellipsis ("Tru...", "YOU...", "Cl..."), the ticket's leg names cut at two lines ("AWS Cloud..."), the result's header cut ("4 wr..."), a deck card's status cut ("Not star...") and words broken in the paper's fixed columns ("Sec tio n", "Fals e", "Cor rec t"); with the scrolling column, `paperTextSize()`, the unlimited leg names and the wrapping status none of these remain (long words of card names still break at the largest size, as all wrapped text on iOS does). `StartFlowLargeTextTests` read "True or false cards that teach you l..." and "Your-nassis." against that draft and passes with the column; against task 11's stand-in step 3's run gave `Executed 4 tests, with 1 test skipped and 3 failures`. At the default text size every start step, the round, the answered card, the sheet and the result are pixel-identical before and after (Timed's clock aside). Sideways (852 by 393) the column scrolls to Start round and Start round opens the round; with the hold made endless, a press on the Back pill right after a jump from a scrolled column was held and an edge pan was not. | Every other screen's look and motion by eye or recording; the inset sheet on 26.5 by eye; the 250 ms hold's timing under XCUITest (its taps arrive later than 250 ms); Escape and Return under XCUITest and on a device (D16). |
| 15 | The whole scheme on iOS 18.4 (iPhone 16): `Test run with 79 tests in 23 suites passed` (unit), and the UI tests `Executed 48 tests, with 8 tests skipped and 0 failures`: the skips are the four visual captures, the iOS 26 anywhere pan and the three Escape and Return tests. On iOS 26.5 (iPhone 17 Pro): `Test run with 79 tests in 23 suites passed` and `Executed 48 tests, with 7 tests skipped and 0 failures` (the anywhere pan ran and passed). Before task 12's large text test and scrolling column the 26.5 run gave the same unit line and `Executed 47 tests, with 7 tests skipped and 0 failures`. `testTheContinueLineShowsTheWholeDeckNameAtTheLargestTextSize` failed once the column scrolled (the line now follows the list, below the screen) and passes since it scrolls the line into view. `testABackBetweenStagesKeepsThePassHeightContinuous` failed against the earlier draft that cross-faded two stacked passes (a 56 point jump in one frame) and passes with the morph; `testTheContinueLineShowsTheWholeDeckNameAtTheLargestTextSize` failed with a one-line name (it read "Google C...") and passes with the wrap; the in-app browser closes through the coordinate tap of `testTheSourceLinkOpensInTheInAppBrowser` (`close.tap()` on Done landed nowhere, twice, and the browser never reported that it finished). A Release build for the simulator succeeded. The Node tests of the visual review are unchanged since they ran green (16) against the real tokens. | The visual review (`review.mjs`, `web.mjs`, `record.mjs`), the recordings and the feel checklist, on either runtime. |
| 16 | Not rerun in this round. As drafted: `DeviceReadinessTests` typechecked against a stub; the three Node modules and their 17 tests ran; `install.sh` and the profile pipeline ran up to their first check. | Anything on the project, the simulator or the phone; the fix pass's two readiness tests, the third part of D10, the step 18 pathspec and the gates of step 19. |

## Files by task

| Task | Creates or changes |
|---|---|
| 1 | `ios/.gitignore`; `ios/TruthyEngine/Package.swift`; `Sources/TruthyEngine/`: `Content`, `Play`, `JSNumber`, `Rng`, `Format`, `Logo`, `Theme`; `Tests/TruthyEngineTests/Support/`: `JSONValue`, `Golden`, `GoldenReaders`; nine test files |
| 2 | `Sources/TruthyEngine/Deal.swift`; `DealReferenceTests`, `DealGoldenTests` |
| 3 | `Sources/TruthyEngine/Round.swift`; `RoundTesting`, `RoundTests`, `ModesTests`, `TimedTests`, `RoundVectors`, `RoundGoldenTests` |
| 4 | `Sources/TruthyEngine/`: `Swipe`, `Progress`, `StoredJSON`, `ProgressRead`, `LocalStore`; `Golden/GoldenProgress.swift` and eight test files |
| 5 | `Sources/TruthyEngine/`: `ContentHelpers`, `Modes`, `Catalog`, `StartSteps`, `ListCue`, `Labels`; six unit and six golden suites |
| 6 | `Sources/TruthyEngine/`: `JSMath`, `PlayCopy`, `Leave`, `ResultCopy`, `MissedCards`, `Ticket`, `TicketScroll`, `FlightPath`, `Headers`, `Barcode`, `Contrast`; nine unit and six golden suites; `GoldenCoverageTests.swift` (the flag) |
| 7 | `ios/Truthy/Truthy.xcodeproj` (project, scheme); `ios/Truthy/Truthy/`: `Info.plist`, `App/TruthyApp.swift`, `EngineNames.swift`, `Assets.xcassets`, `Fonts/`; `ios/Tools/icon/make-icon.swift`, `ios/Tools/fonts/name-table.py`; `TruthyTests/`: `BundledDecksTests`, `FontCoverageTests`, `AppSourceRulesTests`, `EngineLinkTests`; `TruthyUITests/LaunchTests` |
| 8 | `ios/TruthyTools/` (package, `TokenGen`, `GenerateTokens`, `TokenGenTests`); `Truthy/Design/`: `Tokens` (generated), `Typography`, `Motion`, `Theme`; `TruthyTests/ThemeResolutionTests` |
| 9 | `Truthy/State/Clocks.swift`; `Truthy/Data/`: `DeckStore`, `FileKeyValueStorage`, `FileProgressStore`, `RoundJournal`, `ThemeStore`; `TruthyTests/`: `TestSupport`, `DataTests` |
| 10 | `Truthy/Components/`: `SVGPath`, `Icons`, `Shapes`, `Shadows`, `SkyBackdrop`, `ButtonStyles`, `PillButton`, `FrameLayout`, `KeyboardFocus`; `Truthy/Debug/GalleryView`; `TruthyTests/ComponentsTests` |
| 11 | `Truthy/State/`: `Ticker`, `BackTransition`, `StartFlowModel`, `RoundCoordinator`, `LaunchArguments`, `AppModel`; `Truthy/App/RootView`, `TruthyApp` (replaced); stand-ins `Start/StartFlowView`, `Round/RoundView`; `TruthyTests/StateTests` |
| 12 | `Truthy/Start/`: `BackPans`, `DestinationCard`, `ContinueLine`, `ThemeSwitch`, `FillInPass`, `StepContent`, `StartFlowView` (replaced); `TruthyTests/PassMorphTests`; `TruthyUITests/`: `AppDriver`, `StartFlowGestureTests`, `StartFlowLargeTextTests` |
| 13 | `Truthy/Round/`: `CardPan`, `CardText`, `Headers`, `BoardingPassView`, `Safari`, `RoundView` (replaced); stand-ins `Result/LeaveSheet`, `Result/ResultView`; `TruthyTests/RoundUnitTests`; `TruthyUITests/RoundGestureTests` |
| 14 | `Truthy/Result/`: `LeaveSheet`, `ResultView` (both replaced), `MissedCardsView`; `TruthyTests/LeaveSheetLayoutTests`; `TruthyUITests/LeaveAndResultTests` |
| 15 | `Truthy/Debug/ReviewFrames.swift` and one `.reviewFrame` line in each measured view; `TruthyTests/ReviewFramesTests`; `TruthyUITests/Support/` and the story, feel, names and capture tests; `ios/Tools/visual-review/`; `ios/docs/feel-checklist.md`, `ios/docs/visual-review.md` |
| 16 | `ios/Tools/device/` (Node tools, tests, `install.sh`, `DEVICE-CHECKLIST.md`); `TruthyTests/DeviceReadinessTests`; the device column of `ios/docs/feel-checklist.md` |

## Interfaces every task can rely on

Engine (task 1 to 6): the TypeScript exports of reference 3.9 under the naming rule above. The types tasks 1 to 6 create and later tasks use:

```swift
// Content (task 1)
public struct Card: Codable, Hashable, Sendable { public let id: String; public let section: String; public let text: CardText; public let answer: Bool; public let source: CardSource; public let difficulty: Int; public let appliesTo: String; public let conflictGroups: [String] }
public struct DeckIndex: Codable, Equatable, Sendable { public let areas: [IndexArea] }   // IndexArea, IndexPlatform, IndexDeck, IndexSection mirror schema.ts
public struct DeckFile: Codable, Equatable, Sendable { public let id: String; public let hash: String; public let cards: [Card] }
public struct Route: Codable, Hashable, Sendable { public let deckId: String; public let sectionId: String }
public let WHOLE_DECK = "ALL"
public enum Mode: String, Codable, CaseIterable, Sendable { case classic, streak, lives, timed }
public struct CardHistory: Codable, Equatable, Sendable { public var seen: Int; public var lastCorrect: Bool; public var lastSeenAt: Double }   // Int is 64-bit: no golden case reaches plan C's Long/Int split
public typealias History = [String: CardHistory]
public struct Answered: Equatable, Sendable { public let card: Card; public let given: Bool; public let correct: Bool; public let at: Double }
public struct RoundResult: Equatable, Sendable { mode, route, score, total, answers, missed, abandoned }
public typealias Rng = () -> Double
public func createRng(_ seed: Double) -> Rng
public enum Theme: String { case light, dark }; public func resolveTheme(_ choice: Theme?, _ systemDark: Bool) -> Theme; public func switchTheme(_ choice: Theme?, _ systemDark: Bool) -> Theme

// Round (task 3)
public enum Phase: String, Sendable { case question, answered, stamped, finished }
public struct Clock: Equatable, Sendable { public var remainingMs: Double; public var lastTick: Double?; public var hidden: Bool; public var holdMs: Double }
public struct RoundState: Equatable, Sendable { mode, route, cards, index, answers, phase, abandoned, source: DealSource, clock: Clock? }
public enum RoundEvent: Equatable, Sendable { case answer(value: Bool, at: Double), next, tick(now: Double), visibility(hidden: Bool, at: Double), abandon }
public struct StartArgs: Equatable, Sendable { public var mode: Mode; public var route: Route; public var pool: [Card]; public var history: History; public var seed: Double }
public func chunkSeed(_ seed: Double, _ chunk: Int) -> Double
public func startRound(_ args: StartArgs) throws -> RoundState

// Swipe and progress (task 4)
public struct SwipeSample: Equatable, Sendable { public let x: Double; public let y: Double; public let t: Double }
public struct SwipeContext: Equatable, Sendable { public let viewportWidth: Double; public let cardShownAt: Double }
public enum SwipeOutcome: String, Sendable { case `true`, `false`, cancel }
public struct Progress: Codable, Equatable, Sendable { version, cards: [String: CardHistory], records: [String: Int], last: LastRound? }
public func readProgress(_ raw: String?) -> (progress: Progress, whole: Bool)
public enum Comparison: Equatable, Sendable { case first, newBest(previousBest: Int), equal(best: Int), short(best: Int, by: Int) }
public protocol KeyValueStorage; public struct LocalStore; public func createLocalStore(_ storage: (any KeyValueStorage)?) -> LocalStore

// Start flow helpers (task 5)
public typealias Step = Int; public struct Choice; public enum ChoiceKey; public let RECENT: String
public struct ModeInfo; public let MODE_TABLE: [ModeInfo]; public func modeInfo(_ mode: Mode, _ table: [ModeInfo] = MODE_TABLE) -> ModeInfo
public struct RouteInIndex; public func findRoute(_ index: DeckIndex, _ route: Route) -> RouteInIndex?
public struct ContinueTarget; public struct RecentDeck; public func recentDecks(_ index: DeckIndex, _ progress: Progress, _ limit: Int = RECENT_LIMIT) -> [RecentDeck]
public func withoutRemovedCards(_ progress: Progress, _ cardIds: [String: [String]], _ save: (Progress) -> Void) -> Progress

// Copy and geometry (task 6)
public let NEXT_ARRIVES_MS: Double; public let RESULT_ARRIVES_MS: Double; public let SPOKEN_RELEASE_MS: Double; public let ARROW_STEP: Double
public func saveLeftRound(_ round: RoundState, _ store: LocalStore); public final class RecordedRounds
public func recordRound(_ round: RoundState, _ store: LocalStore, _ recorded: RecordedRounds) -> ApplyOutcome
public struct ResultCopy; public func resultCopy(_ result: RoundResult, _ modeName: String, _ dealt: Int, _ previousBest: Int?) -> ResultCopy
public struct TicketInfo; public func ticketFor(_ found: RouteInIndex, _ mode: Mode, _ best: Int?) -> TicketInfo
```

App (tasks 7 to 14), in the `Truthy` target. Task 7 creates `ios/Truthy/Truthy/EngineNames.swift` with `import TruthyEngine`, `typealias Progress = TruthyEngine.Progress`, `typealias StoredTheme = TruthyEngine.Theme`, `typealias ResolvedTheme = TruthyEngine.Theme` and `typealias StartChoice = TruthyEngine.Choice`; every app file uses these names.

```swift
// Design (task 8)
enum Tokens { static let day, night: Palette; static let dayShadows, nightShadows: ShadowSet; enum Space, Size, Radius, Stroke, Opacity, Duration, Curve, Spring, Transition, Gesture, Native, TypeRole }
extension View { func typeRole(_ style: TypeStyle) -> some View }
enum ThemeResolution { static func resolved(stored: StoredTheme?, system: ColorScheme) -> ResolvedTheme }
struct ThemedRoot<Content: View>: View      // the palette in the environment, preferredColorScheme from the stored theme

// Clocks and data (task 9)
protocol WallClock { func nowMs() -> Double }        // epoch ms
protocol MonotonicClock { func nowMs() -> Double }   // CACurrentMediaTime-based, the base of UITouch.timestamp
protocol ProgressStore: Sendable { func load() async -> Progress; func save(_ progress: Progress) async }   // Progress: task 7's alias
actor FileProgressStore: ProgressStore { init(directory: URL) }                 // truthy.progress.v1.json + .unreadable.json
actor RoundJournal { init(directory: URL); func record(_ entry: JournalEntry) async; func clear() async; func pending() async -> JournalEntry? }
struct JournalEntry: Codable, Equatable { route: Route; mode: Mode; seed: UInt32; roundId: String; answers: [JournalAnswer]; decided: Bool; recorded: Bool }
final class DeckStore: Sendable { init(bundle: Bundle); func index() throws -> DeckIndex; func deck(_ id: String) async throws -> DeckFile }
struct ThemeStore { init(defaults: UserDefaults); var stored: StoredTheme? { get }; func store(_ theme: StoredTheme) }  // key "truthy.theme"

// Components (task 10)
struct PillButton, RoundIconButton, QuietButton: View; struct NotchedPaper, DestinationCardShape: Shape; struct SkyBackdrop, LogoMark, BarcodeView: View
struct AppFrame<Content: View>: View; enum FrameLayout; extension View { func tokenShadow(_:_:); func keyboardFocusRing(_:) }   // the ring adds no focus target

// State (task 11)
@MainActor @Observable final class AppModel { var screen: TopScreen; var theme: ResolvedTheme; func takeDebugScreen() -> DebugScreen? }   // TopScreen = .start, .round(RoundRequest)
@MainActor @Observable final class StartFlowModel { var stack: [Step]; var choice: StartChoice; func chooseArea(_:) ... -> Bool; func back(to: Step) -> Bool; var backProgress: Double?
    func changePlatformOnRecentPath() -> Bool }   // rewrites the stack to [1, 2, 3], area and platform kept
struct BackTransition { let from: Step; let to: Step; let itemCount: Int; func frame(at p: Double, reducedMotion: Bool) -> BackFrame }   // pure, tested at fixed p; no default itemCount
@MainActor @Observable final class RoundCoordinator { var state: RoundState; func answer(_ value: Bool) -> Bool; func next() async -> Bool; func leave() async; func scenePhaseChanged(_ phase: ScenePhase) }
struct LaunchArguments { seed: UInt32?; route: Route?; mode: Mode?; screen: DebugScreen?; step: Step?; theme: StoredTheme? }   // DEBUG only, parsed from `-seed <uint32>`, `-route <deckId>/<sectionId>`, `-mode <mode>`, `-screen <start|round|answered|sheet|result|gallery>`, `-step <1..6>`, `-theme light|dark`
```

Later tasks may add members; they never rename these.
