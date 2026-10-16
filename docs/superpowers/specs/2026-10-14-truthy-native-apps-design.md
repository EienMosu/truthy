# Truthy native apps (iOS and Android): design

Date: 2026-10-14. Status: design approved by the owner in conversation; this written spec awaits the owner's review.

Companion document: [`2026-10-14-truthy-native-port-reference.md`](2026-10-14-truthy-native-port-reference.md) holds the exact constants, schemas, copy strings, accessibility labels, token values and golden vector sources, read from the web code. This spec decides; the reference measures. A fact read from the code is fixed in the reference first. Where the reference states a proposal or an open choice that this spec settles, this spec wins.

## 1. Goal

Two native apps, a SwiftUI app for iOS and a Kotlin and Jetpack Compose app for Android, that play exactly like the web app and feel native in every touch.

- **Same game.** The same 54 decks, the same dealing, the same four classes, the same rules, records and progress format as the web at `main` 53e9c81.
- **Same look.** The Boarding Pass design language of `design/system/DESIGN-SYSTEM.md` on both platforms. The original spec already fixed this: the design is the same on three platforms and does not change.
- **Native behaviour.** Back gestures, sheets, scrolling, press feedback, haptics, text scaling, links and the app's life cycle follow each platform. Nothing should feel like a web page in a frame (section 5).

This is a personal project. There is no store release in scope.

### Success criteria

1. **Parity.** For the same seed, route, class, history and answers, both apps deal the same cards in the same order and end with the same score, record and progress JSON as the web. Every golden vector file exported from the TypeScript engine passes on both platforms (section 7.1).
2. **Look.** Every screen, in day and night, matches the web screen at the same logical size: colours equal the resolved token values, and the frames of the logo, the pass, the ticket, the stub, the pills and the sheet card are within 2 pt (dp) of the web's element rectangles, measured by the visual review script (section 7.4). Remaining differences (system insets, sheet chrome, the in-app browser) are approved by the owner pair by pair.
3. **Feel.** Every item of the feel checklist (section 5.8) passes with its stated method.
4. **Runs.** The iOS app runs on the owner's iPhone 15 Pro Max with the free Personal Team. The Android app is a signed release APK that installs and plays a round on an API 36 and an API 26 emulator, and on an Android phone if the owner provides one.
5. **Web unaffected.** Commits that only touch `ios/`, `android/` or `native-data/` do not deploy the web app and do not change `sw.js`. Commits that only touch `ios/` or `android/` also skip the web CI; `native-data/` changes still run it, because the drift and hygiene tests live there.

## 2. Decisions

The owner made these on 2026-10-14:

| # | Decision | Choice |
|---|---|---|
| D1 | Android stack | Kotlin and Jetpack Compose, as in The Slow Wire. Not Flutter. |
| D2 | Way of working | Claude builds both apps end to end after this spec and the plans are approved; the owner reviews screenshots, recordings and the device build. |
| D3 | Deck data | All 54 decks are embedded in each app. No fetching, no offline states. A new deck means a new app build. |
| D4 | Back on the round | Behaves like the X: with no answers it leaves at once, otherwise it opens "Leave round?". |
| D5 | Haptics | Light haptics at decision moments only, through the system APIs (section 5.5). |
| D6 | Architecture | Two native ports, each translating the TypeScript engine line by line, checked against shared golden vectors. Not Kotlin Multiplatform, not a web view. |
| D7 | Native feel | The visual language stays Boarding Pass; every interaction is native. |
| D8 | Start flow | Steps change in place ("Filling in the pass", as on the web; DS principle 4 rejected the horizontal-push flow). Going back is a real native gesture that scrubs the web's own back motion (section 5.1). |

Defaults chosen within the approved design. Each keeps the web's behaviour unless a decision above changes it; the owner can override any of them:

| Topic | Default |
|---|---|
| Identifiers | iOS: Swift package `ios/TruthyEngine`, app project `ios/Truthy`, bundle id `com.eienmosu.Truthy`. Android: project `android/Truthy`, modules `:engine` and `:app`, namespace and applicationId `com.eienmosu.truthy`. |
| Minimums | iOS 18.0: the native card drag needs `UIGestureRecognizerRepresentable` (iOS 18), the usual SwiftUI workaround (`simultaneousGesture`) blocks scrolling on iOS 26.5, and no iOS 17 simulator is installed to test a fallback. Android minSdk 26, targetSdk 36, compileSdk 37 (Compose 1.12 requires it). |
| Source links | Open in the in-app browser: `SFSafariViewController` on iOS, Custom Tabs on Android. |
| Progress storage | A local JSON file per platform behind a store interface, so a sync can be added later without touching the engine. |
| Round in progress | A round journal survives a killed app (section 4.5). |
| After process death | The app opens at start step 1 with no choices, as a web reload does. |
| Timed pause | Only when the app goes to the background, as the web pauses only when the page is hidden (section 5.6). |
| Text selection | None, including the answer slip's explanation, which the web lets people select. Selectable text in a game card is a web affordance (D7). |
| Hardware keyboard | Arrows answer, Return is the action after an answer, Escape is the X on the round (Keep playing while the sheet is open) and one step back in the start flow (consumed and doing nothing on step 1). A held key acts once. The web's ticket scrolling keys are not ported. |
| Orientation | Not locked. The content column is at most 430 wide and centred, as on the web. |
| Order | iOS first, then Android. Android starts when the local JDK problem is fixed (section 11). |

## 3. Scope

**In scope, for both apps:**
- The whole start flow: area, platform, deck, section, class, ready, the fill-in pass and its three stages, Recent, the Continue line, the theme switch.
- The round in all four classes (Classic, Streak, Three lives, Timed), with the verdict stamps, the explanation, the source link and the header indicator of each class.
- The leave sheet, the result screen with the comparison and the missed cards with "Why".
- Progress, records, recent decks, seen percent, pruning of removed cards.
- Day and night themes, reduced motion, screen reader support, text scaling, the hardware keyboard keys above.
- App icon, launch screen, release build.

**Out of scope:** refreshing decks from the site, iCloud or Play Games sync, widgets, TestFlight and Play Store releases, a separate tablet layout beyond the centred column, any language other than English.

**Suggested, not requested** (listed so they are not forgotten; each needs the owner's yes before it enters a plan):
- A home screen quick action "Continue" (`UIApplicationShortcutItem`, Android app shortcuts).
- Native CI workflows `ios.yml` (macOS runner) and `android.yml` (Ubuntu), each running the engine tests and a build.
- Designed dark and tinted iOS icon variants and a designed Android monochrome icon layer (without them the systems derive their own).

## 4. Architecture

### 4.1 Repository layout

Both apps live in the web repository, as The Slow Wire's do.

```
truthy/
  native-data/                       generated by `pnpm export:native`, committed
    manifest.json                    source hashes, the fixed deck index version, generator version
    decks/index.json                 the deck index, as the web build writes it, with the fixed version
    decks/<deckId>.json              54 deck files, card order kept
    tokens/tokens.json               copy of design/system/tokens.json
    tokens/overrides.json            copy of the hand-kept override source below
    tokens/resolved.json             tokens with every override applied: what the native generators read
    golden/<function>.json           vectors computed by the TypeScript code
  scripts/export-native.ts           writes native-data/
  scripts/native-token-overrides.json  hand-kept: values where the code wins over tokens.json (reference 5.0)
  tests/native-data.test.ts          fails when native-data/ drifts from content/, tokens or the engine
  ios/
    TruthyEngine/                    Swift package: the pure engine, tested with `swift test`
    Truthy/                          Xcode project: app, UI, content, progress; depends on TruthyEngine
  android/
    Truthy/                          one Gradle project
      engine/                        pure Kotlin JVM module, tested with `./gradlew :engine:test`
      app/                           Compose app; depends on :engine
```

Both apps reference `native-data/decks` from its one place instead of copying it: an Xcode folder reference on iOS, a Gradle `assets` source directory on Android. Swift engine tests find `native-data/golden` from `#filePath`. The Gradle `:engine` test task passes the folder as a system property computed at build time from the project directory, never written into a committed file.

### 4.2 Module boundaries

Each platform has the same five parts:

| Part | Job | May depend on |
|---|---|---|
| Engine | Every pure function of reference 3.9: rng, dealing, round and classes, swipe interpretation, progress rules, recent decks, seen percent, continue target, start-flow step helpers, copy tables, barcode, flight path geometry, clock text, list fade cue, text parts. No UI, no storage, no clock, no randomness of its own. | nothing |
| Content | Decodes the embedded index at launch and one deck, off the main thread, when a route is chosen. | Engine types |
| Progress | The store interface, its file implementation, the unreadable side copy, the round journal. | Engine types |
| App state | The start flow state and its step stack, the round coordinator (clock, guards, saves), the theme, the top-level screen. | Engine, Content, Progress |
| UI | Design system (tokens, fonts, shapes, icons, motion), start flow, round, leave sheet, result. | everything above |

Purity is enforced the way the web enforces it (`tests/purity.test.ts`): the engine is its own Swift package and its own Gradle JVM module, so it cannot import UI or platform APIs, and a test in each fails if engine sources use the wall clock, the monotonic clock, a random generator, a timer or scheduler (`Timer`, `DispatchQueue`, `Task.sleep`, coroutine `delay`, `Handler`), file or preference storage, or a UI framework import.

### 4.3 The `native-data` contract

`scripts/export-native.ts` runs the web's own deck build and engine and writes `native-data/`. It is the only way native code gets content, tokens and vectors.

- **Decks** are the web build output with one change: the index's per-deck `version`, which the web stamps with the build date, is the fixed version recorded in `manifest.json` and changes only when a deck hash changes. The rest is byte-identical to the web build. Card order inside a deck file is part of the contract, because the first shuffle runs over file order.
- **Tokens.** `scripts/native-token-overrides.json` is kept by hand from the override table of reference 5.0 (frame width 430 not 390, the smooth sky gradient, the leave sheet's real motion and shape, and the rest). The export copies it and writes `tokens/resolved.json`, the tokens with every override applied. Plans B and C each own a small generator that turns `resolved.json` into a committed `Tokens.swift` or `Tokens.kt`, plus a test that fails when the committed file differs from what the generator would write.
- **Golden vectors** cover every function and constant in reference 3.9, except the web-only `entriesBehind` and the browser storage adapter. They come from running the TypeScript functions, not from hand copies: for each function, its inputs and outputs, including every pinned case of its web test file (for dealing: the `count`, `avoid`, `before` and `budget` options of `deal` as well as `dealChunk`; for the round: event traces of all four classes including every Timed clock edge case). The export fails if a 3.9 function has no vector file.
- **Drift.** `tests/native-data.test.ts` regenerates everything in memory, with the recorded fixed version, and compares it with the committed files. Changing a deck, a token, an override or the engine without re-exporting fails the web tests.

Deck ids and card ids are never renamed or reused, because native progress is keyed by them, exactly as on the web.

### 4.4 Engine port rules

- Translate line by line. Keep function names (in each language's casing), constants and the order of every random draw.
- 32-bit unsigned arithmetic for mulberry32 and `chunkSeed`: `UInt32` with wrapping operators in Swift, masked `Long` or `UInt` in Kotlin.
- Compare cards by id, never by identity. Sorts that the TypeScript relies on being stable carry an index tiebreak.
- Two clocks, exactly as the web uses them: engine events (`answer.at`, Timed `tick.now` and `visibility.at`) and `lastSeenAt` use wall-clock epoch milliseconds, all from the same clock. The UI guards (250, 420 and 1000 ms) and swipe samples use the monotonic clock that touch events are stamped with (`CACurrentMediaTime` on iOS, `SystemClock.uptimeMillis` on Android, not `elapsedRealtime`), and touch samples carry the event's own timestamp.
- The seed of a round is a random unsigned 32-bit value from the platform's secure generator. In debug builds a launch argument fixes it.

### 4.5 Persistence

| Item | Web | Native |
|---|---|---|
| Progress | `truthy.progress.v1` in localStorage | `truthy.progress.v1.json` in Application Support (iOS) or `filesDir` with `AtomicFile` (Android). Same JSON shape as the web, so a later import or sync stays possible. |
| Unreadable copy | `truthy.progress.v1.unreadable` | `truthy.progress.v1.unreadable.json`, written under the web's rule: whenever a read is not whole, skipped when the stored copy is identical, and the main write is skipped if this write fails. |
| Theme | `truthy.theme`, `light` or `dark`, absent follows the system | Same key in UserDefaults or SharedPreferences, read before the first frame. There is no way back to following the system, as on the web. |
| Round journal | none (the web saves on `pagehide`) | `truthy.round.v1.json`, see below. |
| Deck caches, shell cache, pending round, return mark | web only | none |

Rules carried over from the web:
- Prune and save at round start, before dealing; prune every played deck when the start screen loads.
- Record exactly once per round, when the result shows.
- On leave: a round with no answers that is not decided saves nothing; an undecided round with answers is applied as abandoned (the answers go into the card history, `last` becomes this route and class with score and total null, no record); a decided round not yet recorded is recorded as its result would record it.
- Every save is a whole read, modify and write. A storage failure never reaches the player.

All writes go through one serial writer off the main thread, and each write is atomic. Backups stay on: Application Support on iOS, and on Android explicit backup and data extraction rules that include the progress file and the theme and exclude the journal, so progress survives a reinstall.

**Round journal (native only).** The web saves the round when the page hides. A native app can be killed without warning, so each answer is also written to a small journal file holding the route, class, seed, round id, answers and whether the round is decided and recorded. The journal is deleted when the round is recorded or left. If a journal is found at launch, it is applied with the leave rules above and deleted. Rounds are never resumed, as on the web.

## 5. Native interaction model

The owner's requirement: it must look like Truthy and behave like a native app, not a web view. The design system keeps every colour, shape, type role, duration and curve. These rules decide how things move under the finger and how the app talks to the system.

### 5.1 Start flow: in place forward, native gesture back

- **Forward** plays the web's forward motion: the chosen name travels into its pass field, the old panel leaves, the new step's items rise in, with the token durations, offsets and staggers.
- **Back** uses the web's own back motion (the old panel sinks, the new items come in from above, the cleared pass fields return to dashes), written as a function B of progress p from 0 to 1, so a finger can drive it. Every way back uses it: the gesture, the Back pill, a pass field, Escape and Android back. A gesture always goes back exactly one step. A tap that jumps several steps (a pass field, or "Change platform" on the recent path) plays B over its web duration. Going back after Continue works the same way, because B does not depend on the forward motion that led to the step.
- **iOS:** a pan from the leading screen edge on any step after the first drives p (a `UIScreenEdgePanGestureRecognizer` bridged with `UIGestureRecognizerRepresentable`). On iOS 26 and later, where the system lets people swipe back from anywhere on a pushed screen, a rightward horizontal pan anywhere on the step does the same. Release completes the back when p is above 0.5 or the speed towards the trailing edge is above 500 pt/s, and cancels when the speed towards the leading edge is above 500 pt/s; the remaining motion is a spring seeded with the finger's speed. The start flow does not use `NavigationStack` pushes, so no hidden back button can silently disable a system gesture.
- **Android:** predictive back (`PredictiveBackHandler`, `android:enableOnBackInvokedCallback="true"` in the manifest) on any step after the first feeds the system's back progress into B, and a cancelled gesture springs back. Below API 34 (Android 14) the handler gets no progress events and completes at once, so B must also be correct as an instant commit; this is tested on an API 33 and an API 26 emulator. On the first step the handler is disabled, so back goes to the system and plays its own back-to-home animation.
- **State:** the choices of the step being left are cleared only when a back completes. A cancelled gesture returns to p = 0 with no state change. If a forward motion is still running when a back gesture begins, it jumps to its end and the gesture starts from the new step. During the 360 ms unroll every back is consumed and does nothing.
- **Reduced motion** keeps the gesture. B becomes the web's reduced start-flow motion mapped onto progress: the old step fades out over the first 100 of its 230 ms, the new one fades in over its last 140. On Android, reduced motion means `ANIMATOR_DURATION_SCALE` is 0, which also makes Compose end every animation at once; the fades that the web keeps under reduced motion (reference 5.8) therefore run with a `MotionDurationScale` of 1.
- **Escape** goes back one step, and does nothing on step 1.

### 5.2 Top-level screens and the round

- The app has two top-level screens, the start flow and the round, swapped in place on both platforms: when the 360 ms unroll ends the round replaces the start flow, and leaving the round shows start step 1 with its choices cleared, as on the web. There is no system modal presentation and no navigation library on either platform; the result belongs to the round screen, as on the web.
- **Back on the round (D4).** Android predictive back, and on iOS a pan from the leading screen edge (the card ignores touches that start within 24 of the edge, so the two never compete), shrink the round surface from scale 1 to 0.94 with the progress (pivot at the centre, a cancel springs back) and on release do what the X does: leave at once with no answers, otherwise open the leave sheet. A decided Timed round with no answers is recorded on leave without a sheet, as on the web.
- On the result screen, back does what "Close results" does and, like that button, is ignored for the first 1000 ms. On the loading screen back leaves at once. While the leave sheet is open, back means "Keep playing".

### 5.3 The card under the finger

- The card follows the finger one to one, with the web's rotation (dx / 18 degrees) and intent stamp. A horizontal drag only starts once the movement is more horizontal than vertical, so the ticket's own vertical scroll keeps working with native physics.
  - **iOS:** a `UIPanGestureRecognizer` subclass bridged with `UIGestureRecognizerRepresentable`. Its `touchesBegan` stores the touch-down sample (window location, `UITouch.timestamp`) before any slop is passed; `touchesMoved` and `touchesEnded` append samples from the touches, coalesced touches included; a second touch cancels it. `gestureRecognizerShouldBegin` claims only horizontal-dominant movement. It is attached to a stationary container and the card's offset lives inside it (a recognizer on the moving view reports drifting translations). `simultaneousGesture` is not used: on iOS 26.5 it blocks the scroll view.
  - **Android:** `pointerInput` on a stationary container inside the ticket's `verticalScroll`, with the card's translation and rotation applied by a `graphicsLayer` inside that container. `awaitFirstDown(requireUnconsumed = false)` records the touch-down sample; `awaitTouchSlopOrCancellation` consumes only horizontal-dominant movement, so the parent `verticalScroll` keeps vertical drags. Positions are converted to window coordinates; times are `PointerInputChange.uptimeMillis`. A second pointer cancels.
- Commit or cancel is decided by the engine's `interpret` on the samples (90 commit, 40 plus 0.5 per ms fling, 250 ms settle, 24 edge zone, vertical cancel), with the same numbers in points and dp. The 24 edge zone is measured from the window edges in window coordinates, as on the web. On Android the round screen excludes no system gesture area; a drag that starts inside the system gesture insets belongs to the system.
- The drawn offset is the current x minus the touch-down x, slop included, so the card never lags the finger.
- On release the card never flies away: it springs back to rest seeded with the finger's release velocity (`interpolatingSpring(_:initialVelocity:)` with the velocity divided by the remaining distance on iOS, `Animatable.animateTo(initialVelocity =)` on Android). On a commit in Classic, Streak and Three lives the stub tears off and the stamp lands on the slip. In Timed the stub stays and takes its stamp, and after the 700 ms hold the card leaves towards the answered side (with reduced motion it is replaced at once).
- A touch on a card that is still springing back stops it at its offset c; during that gesture the drawn offset is c + dx, while `interpret`, the intent stamp and the threshold haptic use dx alone, as on the web.
- The True and False buttons and the arrow keys go through the same answer path as the swipe.

### 5.4 Leave sheet and disclosures

- "Leave round?" uses the platform's sheet for behaviour and the web's floating card for looks. The sheet container is transparent and the app draws the web's card inside it: paper surface, padding 20, radius 16, with the web's gutter and bottom spacing.
  - **iOS:** `.sheet` with a `.height(h)` detent, where h is the measured height of the card plus the bottom inset, updated when the text size changes (above the screen height it becomes `.large` and the card scrolls); the grabber is hidden. On iOS 18 the card keeps the 16 gutter from the screen edges. On iOS 26 and later the partial sheet is itself inset with Liquid Glass: the card fills it and takes its corner radius, which counts as sheet chrome under criterion 2, and no glass may show around the card (checked on iOS 18, 26 and 27). Swiping down calls `onDismiss`, which also fires on a programmatic dismissal, so a flag tells "Keep playing" from "Leave round". The app does not opt out of Liquid Glass (`UIDesignRequiresCompatibility` is not set).
  - **Android:** Material3 `ModalBottomSheet` with a transparent container, the app's own scrim colour, no drag handle, and the system bar icon flags taken from the app's theme (the sheet is its own window). Swiping down, tapping the scrim or back calls `onDismissRequest`.
- Swiping the sheet down, tapping the scrim or pressing back means "Keep playing". The web ignores a scrim tap in the first 250 ms so that the second tap of a double tap on the X does not close the sheet. A UI test double-taps the X on each platform; if the sheet closes, the same 250 ms guard is added to the scrim tap.
- The Timed clock keeps running under the sheet, and the sheet's text switches if the round becomes decided while it is open, as on the web.
- The missed cards' "Why" rows open and close with the token durations.

### 5.5 Haptics

| Moment | iOS (`sensoryFeedback`) | Android (`ViewCompat.performHapticFeedback` with `HapticFeedbackConstantsCompat`) |
|---|---|---|
| Drag crosses the 90 commit line | `.impact(weight: .light)`, fired by the crossing only | `GESTURE_THRESHOLD_ACTIVATE` |
| Correct | `.success` | `CONFIRM` |
| Not quite | `.error` | `REJECT` |
| Time is up (Timed) | `.warning` | `REJECT` |

Nothing else vibrates; moving back under the line re-arms the crossing haptic without a haptic of its own. On older Android versions the compat library maps each constant to the nearest older one. The system haptic settings are always respected, no custom vibration patterns are used, and haptics never fire per pointer event. A haptic always accompanies a visual change, never replaces it. If the owner finds the iOS notification patterns too strong on the device, they become `.impact(weight: .light)`. The simulator plays no haptics, so they are checked on the device.

### 5.6 Platform behaviour everywhere

- **Scrolling** uses each platform's physics: bounce on iOS, stretch overscroll on Android 12 and later (on Android 8 to 11 the glow takes the ink colour). The web's bottom fade cue on long lists stays.
- **Press feedback** is the web's per control: round buttons 0.92, the Back pill 0.96, pills 2 down plus 0.98 plus the press shadow, cards and the quiet button 0.98, all over 120 ms with the `ease` curve; the `press` tint only on the pass fields and the continue line. iOS: `ButtonStyle`s reading `isPressed`. Android: `collectIsPressedAsState` driving a `graphicsLayer`; the pass fields and the continue line show their press tint as a bounded ripple in the press colour, and every other control has no indication.
- **Safe areas:** the top and bottom padding are the larger of the system inset and the web's 52 and 34 on screens 568 or taller (8 and 12 on shorter ones); the side padding is the 16 gutter plus the side inset.
- **System bars** take their colours from the app's resolved theme, not the system theme. Android is edge to edge: `enableEdgeToEdge` with `SystemBarStyle.auto` deciding dark from the app's theme, called again when the theme changes, the light status bar flag also set in the theme XML for the first frame, and no enforced navigation bar contrast (The Slow Wire's trap).
- **Text** scales with Dynamic Type and Android font scale. Every fixed height is a minimum; text grows or scrolls and never clips. No text is selectable.
- **Focus rings** appear only for hardware keyboard focus, never on touch. There are no hover states.
- **Links** open in the in-app browser: `SFSafariViewController` presented from the top view controller, following the app's theme (its bar tint is honoured only before iOS 26); Custom Tabs with `CustomTabColorSchemeParams` from the app's theme on Android. The spoken label is "{source.title} (opens in browser)".
- **Frame rate:** iOS sets `CADisableMinimumFrameDurationOnPhone` so drags and springs can run at 120 Hz on ProMotion phones.
- **Timed clock:** it pauses through the engine's `visibility` event only when the app goes to the background (scene phase `.background` on iOS, `ON_STOP` on Android) and resumes when it returns, as the web pauses only when the page is hidden. Control Center, the notification shade and the app's own sheet do not pause it. Its 100 ms ticker keeps firing while a scroll or drag is tracking (a common run loop mode timer or a display link on iOS, a coroutine loop on Android).
- **Process death:** the app opens at start step 1 with no choices. A round in progress is never resumed; its journal is applied (section 4.5).
- **Launch:** the launch screen uses `color-surface` of the system appearance (`UILaunchScreen` with a colour set that has a dark variant; the AndroidX splash screen API with the same colour as the window background), so there is no white flash. The app's stored theme applies from the first frame the app draws; on Android 12 and later the stored theme is also handed to `UiModeManager.setApplicationNightMode`, so the splash matches it.
- **App icon:** composed like the web's installed icons (`app/apple-icon.png`, `public/icon-512.png`): the `app/icon.svg` mark at 60 percent width, centred on an opaque square in day `sky-1` (`#a9d6f0`, the web manifest's `theme_color`). iOS: one 1024 image in an asset catalog with a scale-free file name. Android: an adaptive icon from the same mark.

### 5.7 Web view smells that must not appear

1. A tap highlight, hover state or selectable text.
2. A back control without the matching native gesture.
3. Animations that cannot be interrupted, or that jump instead of following the finger.
4. Safe areas or bar colours that ignore the device or the theme.
5. A white or mismatched frame at launch or between screens.
6. Scrolling without the platform's physics, or a gesture that blocks scrolling.
7. Text that clips at large text sizes.
8. Dialogs that look like a browser alert.
9. Links that leave the app for the external browser without need.
10. Visible focus rings after a tap.

### 5.8 Feel checklist

Each item records the platform, OS version and device or simulator it was checked on.

| # | Check | Method |
|---|---|---|
| N1 | The edge swipe (iOS, and the anywhere swipe on iOS 26+) and predictive back (Android, API 34+) scrub every one-step back and cancel cleanly | screen recording |
| N2 | Back on step 1 (Android) plays the system back-to-home animation | screen recording |
| N3 | A vertical drag on the ticket scrolls with bounce or stretch, a horizontal drag moves the card, a diagonal drag does one or the other, never both | UI test plus recording |
| N4 | The card offset equals the finger travel within 1 pt (dp) at 10 sampled frames | UI test reading the offset |
| N5 | Release springs with the finger's velocity; a touch catches a springing card | screen recording |
| N6 | One haptic per crossing of the 90 line, none per move | unit test on the trigger count, device check |
| N7 | Swipe down, scrim and back on the leave sheet all keep playing; the Timed clock keeps running under it; a double tap on the X leaves the sheet open | UI test |
| N8 | No tap highlight, no selection or menu on long press, no focus ring after a tap | UI test plus screenshot |
| N9 | Text at the largest accessibility size never clips, on every screen | screenshots |
| N10 | No white or mismatched frame at launch or between screens, day and night | 60 fps recording checked frame by frame |
| N11 | Source links open in the in-app browser | UI test |
| N12 | Bars follow the app theme, not the system theme | screenshots with the app and system themes opposite |
| N13 | Back on the round shrinks the surface and acts like the X; on the result it acts like Close results after 1000 ms | UI test plus recording |

## 6. Visual parity

- **Tokens:** generated per platform from `native-data/tokens/resolved.json`: colours by theme, type roles, spacing, radii, strokes, shadows, durations, curves and springs. Units map one to one: px to pt on iOS, px to dp and sp on Android.
- **Fonts:** Overpass 600 and 800, Overpass Mono 400 and 600, as static TTF files from the upstream Overpass project (SIL OFL 1.1), with `OFL.txt` shipped in each app. Every weight is requested explicitly. The files must cover the characters the content and copy use (reference 2.2: arrows, the middle dot, typographic quotes, the bullet and section signs, accented letters). The repository's hygiene scan reads only ASCII runs in binary files, so plan A teaches it to read UTF-16 runs as well, and a font's name table is decoded and checked before the file is committed.
- **Icons and shapes:** the icons in `components/icons.tsx`, the logo, the ticket notches, perforation dashes, barcode and flight paths are drawn in code from the same path data (SwiftUI `Path`, Compose `Path` and `ImageVector`). No bitmap icons in the UI.
- **Shadows:** the web's negative-spread shadows are emulated so the ticket reads the same; exact values are in the reference.
- **Copy:** every user-facing string and accessibility label is taken verbatim from reference 4.5.

## 7. Testing and verification

### 7.1 Engine parity

- iOS: `swift test` in `ios/TruthyEngine`. Android: `./gradlew :engine:test`.
- Every file in `native-data/golden` is consumed by both suites. A vector that one platform skips is a failing test, not a silent gap.
- The purity test of section 4.2 runs in both suites.

### 7.2 App logic

Unit tests for the start flow state and its step stack (including B at fixed progress values and the clear-on-complete rule), the round coordinator (guards, Timed visibility on background, saves), the progress store (atomic write, the unreadable side copy, partial reads), the round journal (write, apply at launch with each leave rule, delete) and the theme store.

### 7.3 UI flows

XCUITest on iOS and Compose UI tests on Android cover the same stories: a Classic round from step 1 to the result; the Recent path; Continue; leaving with and without answers; going back a step with the gesture; the theme switch; Timed running out; Three lives running out; a Streak ending; a source link opening in the in-app browser; the hardware keyboard keys.

### 7.4 Visual review

Debug launch arguments open any screen in a known state: seed, route, class, screen (start step, round, answered, leave sheet, result) and theme. A review script captures each screen in day and night, on a small phone (375 by 667), a large phone (430 by 932) and the Android emulator (412 by 915), and at the largest text size, and captures the web at the same viewport with Playwright. It compares colours with the resolved tokens and the element frames listed in criterion 2 with the web's element rectangles, and writes side-by-side pairs. An Opus reviewer and the owner review the pairs.

### 7.5 Feel review

The feel checklist (section 5.8), each item by its stated method.

### 7.6 Device

- The owner runs the iOS app on the iPhone 15 Pro Max: haptics, 120 Hz, VoiceOver, the real finger and the sheet material are checked there.
- Android runs on an API 36 emulator, an API 34 emulator (predictive back progress), an API 33 and an API 26 emulator (instant back commit), and on a phone if the owner provides one.

## 8. Repository integration

- **Branch.** All work happens on `native`. A push to `main` deploys the web to production, so `main` only moves with the owner's explicit approval, every time.
- **Vercel.** `vercel.json` gets `"ignoreCommand": "git diff --quiet ${VERCEL_GIT_PREVIOUS_SHA:-HEAD^} HEAD -- . ':!ios' ':!android' ':!native-data'"`. Vercel skips the build when the command exits 0, which happens only when nothing outside the three native folders changed since the previously deployed commit. Vercel's build runs no tests and never reads `native-data/`, so deploying for it would only ship a new `sw.js` and make every web client update for nothing. An empty variable (a branch's first deploy) falls back to the last commit, and a base missing from Vercel's shallow clone makes `git diff` fail, so the build runs: both are the safe side. Plan A checks the variable and the shell expansion against Vercel's current documentation. The same commit updates the `vercel.json` key pin in `tests/publish-files.test.ts`.
- **Web CI.** `ci.yml` gets `paths-ignore` for `ios/**` and `android/**` only. Changes to `native-data/**` still run the web checks, because the drift and hygiene tests live there. The web check is not made a required check for native-only changes.
- **Ignores.** Xcode user data, build folders, `local.properties`, `.gradle`, `.idea`, `.kotlin` and every signing file stay out of git.
- **Hygiene (public repository).** Already enforced by `scripts/hygiene.ts`, `tests/repo-hygiene.test.ts` and the pre-push hook: the EienMosu noreply author and committer (pre-push), no absolute local paths or home folder layouts, no secrets or PEM private keys, no e-mail-shaped strings (which rules out file names with a scale suffix after an at sign, and Kotlin's labelled `this` followed by a member), and the readable text of binary files and PNG text and EXIF chunks. Plan A adds, scoped to `ios/`, `android/`, `native-data/` and the native documents:
  - a rule against em dashes in text files;
  - a rule rejecting signing files by type (`.jks`, `.keystore`, `.p12`, `.mobileprovision`);
  - a rule rejecting PNG files that carry any text or EXIF chunk;
  - UTF-16 run reading for binary files (font name tables).
  - Plan A also turns the pre-push hook on in this clone (`git config core.hooksPath .githooks`) and confirms it runs.

## 9. Delivery

- **iOS:** signed with the free Personal Team on the owner's iPhone 15 Pro Max; the build expires after seven days and is renewed by running it again from Xcode.
- **Android:** a release APK shrunk with R8 and signed with a new keystore kept outside the repository (`~/keystores/truthy-release.jks`), its passwords in the user's Gradle properties. The signing config only applies when those properties exist, so the build still works on a machine without them. The keystore must be backed up: losing it means no update can ever replace an installed copy. The minified release build is played through once, because that is where serialization and reflection problems show up.
- **Android sideloading policy:** Google's developer verification started in four countries on 2026-09-30 and goes global in 2027. Installs with `adb` are reported to stay exempt; sharing the APK with friends later may need the free "limited distribution" registration. This does not affect the owner's own install now.

## 10. Phases

One spec, three implementation plans, each executed subagent-driven with review gates:

| Plan | Content | Gate |
|---|---|---|
| A. Shared data and repo integration | `export-native.ts`, the override source, `native-data/`, the drift test, the hygiene additions and the hook, `vercel.json` and its pin, `ci.yml` paths, ignores | web unit tests, typecheck and hygiene green; the owner approves before anything reaches `main` |
| B. iOS | Engine package and golden tests, token generator, content and progress, design system, start flow with the gesture-driven back, the round in four classes, leave sheet and result, haptics and platform behaviour, visual and feel review, device build | sections 7.1 to 7.6 for iOS |
| C. Android | The same order on Compose, toolchain versions pinned against their release pages when the plan is written | sections 7.1 to 7.6 for Android; needs a working JDK first |

## 11. Risks

1. **Dealing parity.** One draw out of order or one unstable sort changes every card dealt after it, silently. Mitigation: golden vectors for every pinned case, run on both platforms.
2. **Scrubbable start flow motion.** Driving the back motion from a gesture is more work than system push and pop. Mitigation: B is a pure function of progress from the first step, tested at fixed progress values.
3. **Gesture conflicts.** The card drag against vertical scroll, the edge pans, Android's system gesture insets and predictive back. Mitigation: direction locking, the 24 edge zone, the stationary containers, the feel checklist.
4. **Public repository leaks.** Paths, e-mails, signing material or metadata in generated project files and assets. Mitigation: the hygiene test and pre-push hook with plan A's additions, on every commit.
5. **Timed clock.** Mixing the wall clock and the monotonic clock breaks the clock or the guards. Mitigation: section 4.4 and the Timed golden traces.
6. **Local JDK.** On this Mac the JDK bundled with Android Studio does not start (every `jbr` binary hangs at launch, also outside the sandbox) although it built The Slow Wire on 2026-08-30. Android work waits until it is fixed, for example by updating Android Studio or installing a separate JDK 17 or later, with the owner's agreement.
7. **Xcode and iOS 27.** This Mac has Xcode 26.6 with the iOS 18.4 and 26.5 simulators. The owner's phone ran iOS 27.0 with Xcode 26.6 for The Slow Wire on 2026-08-22. If the phone's current iOS needs a newer Xcode, Xcode 27 and an iOS 27 simulator are installed with the owner's agreement before plan B's device step, and the facts verified on 26.5 (the scroll blocking, the sheet material, the pan recognizer) are checked again on iOS 27.
8. **Personal Team limits.** The iOS build expires after seven days and cannot be shared. Accepted for a personal project.
9. **Stale design documents.** `DESIGN-SYSTEM.md` and `tokens.json` differ from the code in places. The code wins, through the override source and the reference.
10. **Fast-moving Android toolchain.** As of October 2026, Compose 1.12 (BOM 2026.09.00) needs compileSdk 37 and AGP 9.2 or later, AGP 9 builds Kotlin in and needs JDK 17, and Navigation Compose is in maintenance mode. Versions are pinned when plan C is written.
11. **Facts checked only in the simulator or in documents.** Haptics, 120 Hz, real-finger velocity, VoiceOver and TalkBack, the iOS 26 sheet material around the paper card, and Android behaviour below API 34 were not observed on hardware during research. Each is in section 7.6.
