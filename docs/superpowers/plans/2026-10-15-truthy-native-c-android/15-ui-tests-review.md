### Task 15: Compose UI test stories, the Android feel checklist on API 36, 34, 33 and 26, the visual review captures and pairs

Tasks 7 to 14 built the app screen by screen, each with unit tests of its logic. This task checks the finished app the way a player meets it, on real emulators, in three parts. First, the Compose UI test stories of spec 7.3, the same stories plan B runs with XCUITest: a Classic round from step 1 to the result, the Recent path, Continue, leaving with and without answers, going back a step with the gesture, the theme switch, Timed running out, Three lives running out, a Streak ending, a source link opening in the in-app browser and the hardware keyboard keys. Second, the feel checks of spec 5.8 that a test can make (N4 the card under the finger, N7 the leave sheet, N8 no selection menu, N9 nothing clips at 200 percent, N11 Custom Tabs, N12 the bars, N13 back on the round) and a checklist with recordings for the ones only a person can judge, each recorded with its API level. Third, the visual review of spec 7.4: an instrumented walk captures the twenty review states plan B also captures, with its ids, in day and night at font scale 1.0 and 2.0, a Playwright script captures the web in the same states at the same viewport and seed, and a pairing script checks the element frames (within 2 dp) and the colours (against `native-data/tokens/resolved.json`) and writes side-by-side pairs for the reviewer and the owner.

The whole UI suite runs on the four emulators of spec 7.6 (API 36, 34, 33 and 26). That is how this task closes Review Focus 1 (back on each API level: a scrubbed back and a cancel on 34 and 36, an instant commit with the right final frame on 33 and 26), Review Focus 3 (the stored theme opposite to the system theme: bars, first frame and, on API 31 and later, the configuration that drives the splash; feel item N12) and Review Focus 4 (font scale 2.0 and `ANIMATOR_DURATION_SCALE` 0: nothing clips, and the recordings show the fades the web keeps). Review Focus 2 (the app killed mid-round) and 5 (a drag in the system gesture inset, a diagonal drag) are owned by tasks 9, 11 and 13; the checklist repeats them on the emulator as items F19 and F22 so the review has them in one place. TalkBack (spec risk 11 and section 7.6) has tests that read the semantics the screens expose but none that hears the speech; item F23 checks it on the API 36 emulator, whose `google_apis` image ships TalkBack.

Every interaction goes through what a player sees and does: accessibility labels from reference 4.5, real touches injected with real `SystemClock.uptimeMillis` timestamps (the guards and `interpret` compare them with the monotonic clock, so the Compose test's virtual event times would not do), real key events, and the system back key. Only five things are read from behind the scenes: the deck file (to know the right answer to the statement on screen), the progress file (to check what a round saved), the stored theme, the bounds of seven tagged elements, and the screen pixels.

**This task was not compiled during drafting.** Nothing in this file was compiled or run while the plan was written. Every Kotlin line was checked by reading it against the current sources and reference pages of androidx.activity (`OnBackPressedDispatcher`, `BackEventCompat`), Compose UI test (the v2 rules, `SemanticsNode`, the wait functions) and AndroidX Test, never by a compiler. After the review, tasks 1 to 15 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: the JVM tests and, on the API 36 emulator, the instrumented tests. The defects that run found are fixed in this file (README, Drafting record). The review states other than the Classic round's, the new colour probes and the Node scripts of the visual review were added after that run: see the README's Drafting record for what of them has run. If the compiler rejects a line, fix the line, not the test, and keep the behaviour the step states. Of the Node scripts, `compare.test.mjs` and `checklist.test.mjs` have since run green and `web-capture.mjs` and `pair.mjs` were only syntax-checked: the web capture and the pairing need the web's production build.

Builds on tasks 1 to 14: the app is complete, `./gradlew :app:testDebugUnitTest :app:assembleDebug` is green, and the app launches on the API 36 emulator (task 7). Plan A's `native-data/tokens/resolved.json` and the web's Playwright install (`pnpm exec playwright install chromium`) are used by the visual review.

**Files:**
- Create (Gradle test support, under `android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/support/`): `Device.kt`, `Routes.kt`, `Ui.kt`, `ScreenWalk.kt`, `SupportTest.kt`
- Create (stories, under `android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/stories/`): `ClassicRoundTest.kt`, `ReturningTest.kt`, `LeaveTest.kt`, `ModesTest.kt`, `BackTest.kt`, `ThemeTest.kt`, `SourceLinkTest.kt`, `KeyboardTest.kt`
- Create (feel checks, under `android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/feel/`): `FingerTest.kt`, `LeaveSheetTest.kt`, `NoClipTest.kt`
- Create (visual capture, under `android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/review/`): `VisualCaptureTest.kt`
- Create (tools): `android/Tools/emulators.sh`, `android/Tools/test-summary.mjs`, `android/Tools/feel/checklist.mjs`, `android/Tools/feel/checklist.test.mjs`, `android/Tools/feel/FEEL-CHECKLIST.md`, `android/Tools/visual-review/screens.mjs`, `android/Tools/visual-review/compare.mjs`, `android/Tools/visual-review/compare.test.mjs`, `android/Tools/visual-review/approvals.json`, `android/Tools/visual-review/capture-android.sh`, `android/Tools/visual-review/web-capture.mjs`, `android/Tools/visual-review/pair.mjs`
- Modify: `android/Truthy/gradle/libs.versions.toml` and `android/Truthy/app/build.gradle.kts` (the instrumented test dependencies, only those step 1 finds missing); `android/Tools/feel/FEEL-CHECKLIST.md` (its `Result:` lines, steps 33 to 35); `android/Tools/visual-review/approvals.json` (the owner's approvals, step 32)
- Not committed: everything under `android/Tools/visual-review/out/` (captures, pairs, report), which the root `.gitignore` pattern `out/` already ignores, and the recordings, which stay in `$TMPDIR/truthy-feel/`.

**Interfaces:**
- Consumes, fixed by the README: `MainActivity` in `com.eienmosu.truthy` (task 7, named by task 8); `DeckStore(assets)` with `suspend fun deck(id: String): DeckFile`, `FileProgressStore.FILE_NAME` (`"truthy.progress.v1.json"`) and `ThemeStore.PREFS_NAME` (`"truthy"`) from task 9; `DebugLaunch` (task 11); the engine's `Card`, `DeckFile`, `Route`, `Mode`, `Progress`, `readProgress(raw: String?): ReadResult`.
- Consumes, named by tasks 4, 5 and 8 in their own files: `recordKey(route: Route, mode: Mode): String` and `LastRound(route, mode, score: Int?, total: Int?)` (task 4); `plainText(text: String): String` (task 5); `Tokens.Colors.day` and `Tokens.Colors.night` of type `TruthyColors` with `sky1` to `sky4` (task 8, package `com.eienmosu.truthy.design`).
- Consumes, assumed from tasks 10 to 14 (listed again under "Assumed from other tasks"; step 1 checks each and stops when one is missing):

```kotlin
// com.eienmosu.truthy.ui.TestTags (task 10 creates it; tasks 12 to 14 tag their elements), copied from task 10's Produces
object TestTags {
    const val LOGO = "logo"                    // step 1's logo: the mark and the wordmark, the row that wraps them
    const val PASS = "pass"                    // the fill-in pass, band and body (the web's [data-fill-in-pass])
    const val TICKET = "ticket"                // the boarding pass on the round and on the result (the web's [data-boarding-pass])
    const val STUB = "stub"                    // the stub of the question phase (the web's [data-stub])
    const val CARD = "card"                    // the node the drag moves: after its graphicsLayer in the modifier chain
    const val ROUND_SURFACE = "round-surface"  // the surface that back on the round scales from 1 to 0.94
    const val SHEET_CARD = "sheet-card"        // the paper card inside the leave sheet (the web's [role=dialog])
}
// com.eienmosu.truthy.DebugLaunch (task 11): companion constant of the intent extra that fixes the seed of every
// round dealt in that launch (Play again included), read in debug builds only. Pass it as a string (0 to 4294967295);
// task 11's extraText also reads a Long extra as its digits.
const val SEED = "truthy.seed"
```

- Produces (nothing in the app; later tasks and the owner use these tools):

```kotlin
// androidTest, package com.eienmosu.truthy.support
object Device { fun reset(); fun launch(seed: Long? = null): ActivityScenario<MainActivity>; fun progress(): Progress; fun storeProgress(json: String); fun storedTheme(): String?; fun shell(command: String): String; fun systemNight(on: Boolean); fun screenshot(): Bitmap }
object Finger { fun tap(at: Offset); fun press(at: Offset): Long; fun moveTo(downTime: Long, at: Offset); fun release(downTime: Long, at: Offset); fun drag(from: Offset, to: Offset, steps: Int = 12, stepMs: Long = 16) }
object Keys { fun press(code: Int); fun hold(code: Int, repeats: Int) }
object Colours { fun skyAt(colors: TruthyColors, fraction: Float): Int; fun close(a: Int, b: Int, tolerance: Int = 3): Boolean; fun hex(colour: Int): String }
class Ui(rule: ComposeTestRule)          // waits, real taps, the start flow and the round as a player plays them
class ScreenWalk(ui: Ui) { fun run(visit: (String) -> Unit) }   // the 20 review states, plan B's ids
val SCREEN_ELEMENTS: Map<String, List<String>>   // mirrored by screens.mjs, pinned by compare.test.mjs
```

```js
// android/Tools/visual-review/compare.mjs
export function tokenColour(tokens, path): { r, g, b, a }
export function skyStops(tokens): number[]                       // native.sky-stops of resolved.json
export function skyColour(tokens, theme, fraction): { r, g, b, a }
export function over(top, bottom): { r, g, b, a }
export function samplePoint(sample, frames): { x, y } | null
export function expectedColour(tokens, theme, sample, heightDp): { r, g, b, a }
export function frameFindings(screen, theme, android, web, elements): Finding[]
export function colourFindings(screen, theme, platform, sampled): Finding[]
export function withApprovals(findings, approvals): Finding[]   // Finding: { theme, screen, kind, name, detail, key, approved, reason }
export function unapproved(findings): Finding[]
// android/Tools/feel/checklist.mjs
export function parseChecklist(text); export function structureProblems(items); export function openIssues(items); export function summarise(items)
```

**Rules:**

1. **Real input, real clocks.** Taps, drags and long presses are `MotionEvent`s with `SystemClock.uptimeMillis()` times, injected with `Instrumentation.sendPointerSync` at screen coordinates (`SemanticsNode.positionOnScreen`). Keys are `KeyEvent`s through `sendKeySync`. The system back key is `Espresso.pressBackUnconditionally()`, which on API 33 and later reaches the app as `OnBackInvokedCallback.onBackInvoked` with no progress: the instant-commit path of spec 5.1. A scrubbed predictive back is driven through `OnBackPressedDispatcher.dispatchOnBackStarted`, `dispatchOnBackProgressed`, `onBackPressed` and `dispatchOnBackCancelled` (public and marked for tests in androidx.activity), which feed the same `PredictiveBackHandler` the system gesture feeds on API 34 and later. Compose's own `performClick` and `performTouchInput` are not used: their events carry the test clock's virtual times.
2. **Waiting.** The guards are real time: a test sleeps 300 ms after a step or a card appears (the 250 ms settle), 470 ms before Next card or See results (420 ms), 1100 ms before a result action (1000 ms). Animations run on the Compose test clock, which advances while a test waits for idle. Where a test must act while an animation runs (back during the 360 ms unroll), it turns `mainClock.autoAdvance` off first.
3. **What a test may read.** Labels exactly as reference 4.5 gives them, matched against a node's content description or text; the seven test tags; the deck through `DeckStore` (to find the right answer to the statement on screen, matched by `plainText` of the card's statement); the progress file through `readProgress`; the preference `truthy.theme`; the screenshot. No test reads a view model or calls app code to change state.
4. **A first launch per test.** `Device.reset()` deletes every `truthy.*` file in `filesDir`, clears the preferences file `truthy` and, on API 31 and later, sets the application night mode back to `MODE_NIGHT_AUTO` (task 8 hands the stored theme to the system, which keeps it after the preferences are gone). Tests that change the system's night mode restore it in `finally`.
5. **A failing story is a defect of the task that owns the behaviour**, never a reason to change the story. Find the cause with superpowers:systematic-debugging, fix it in that task's code with a unit test there, and run the story again. The expected outputs below assume tasks 7 to 14 are right.
6. **The visual review compares like with like.** Both platforms start from an empty store, follow the system theme (day or night set on the emulator and in the browser), deal with `REVIEW_SEED` 1234567 (`DebugLaunch.SEED` as a string extra on Android, `crypto.getRandomValues` fixed for a one-element `Uint32Array` on the web), the same seed plan B uses, and play the same moves: Classic on CLF / SEC with True on every card, the leave sheet opened and closed after card 1; then Streak and Three lives with True on every card until the round ends (Why opened on the Three lives result), Timed answered once and run out, and a second deck (CDL) left after one answer. The twenty states carry plan B's ids: `s1` to `s6`, `p2`, `p3`, `p4`, `r1`, `streak-p2`, `streak-r1`, `lives-p2`, `lives-r1`, `lives-r1-why`, `timed-p2`, `timed-up`, `timed-r1`, `s1-returning`, `s3-recent`. The Timed stamp beat (P3t) is not captured: it lasts 700 ms; the feel recordings cover it. Colours are probed at the points plan B probes: the sky at x 4 and y 120, 300, 560 and 860 (with the scrim under the sheet), a band 4 below its top at its horizontal centre (`accent`), the ticket paper 6 in from the left and 50 down (`surface-raised`), the sheet card 10 in at half its height (`surface-raised`), a pill 14 in at half its height (`true`, `false` or `ink`). Frames are compared in dp, the web's CSS px being dp. A frame off by more than 2 dp, a screenshot colour off by more than 3 per channel (12 would be allowed for a video frame; this review reads none), or an element missing on one side is a finding; a finding blocks until it is fixed or the owner approves it in `approvals.json` with the owner's reason (spec success criterion 2).
7. **Recordings and captures never enter the repository.** Captures, pairs and the report live in `android/Tools/visual-review/out/` (ignored by the root `.gitignore`), recordings in `$TMPDIR/truthy-feel/<api>/`. The checklist records each result with its API level, emulator, build and date (spec 5.8: platform, OS version and device).
8. **Hygiene.** The repository is public: no absolute path, home folder layout or e-mail-shaped string in any file this task writes. In Kotlin that means no labelled `this` followed by a member (the tests take the activity from `onActivity { activity -> }`), and no image file name with a scale suffix after an at sign.

**Assumed from other tasks** (the README does not name these; step 1 checks each one):
- `com.eienmosu.truthy.ui.TestTags` with the seven constants above (task 10), each applied by the task that draws the element: `LOGO` and `PASS` (task 12), `TICKET`, `STUB` and `CARD` (task 13; `TICKET` sits on task 13's `BoardingPass`, so the result's ticket in task 14 carries it too), `ROUND_SURFACE` and `SHEET_CARD` (task 14). `CARD` comes after the card's `graphicsLayer` in its modifier chain, so that its bounds include the drag's translation.
- `DebugLaunch.SEED` (`"truthy.seed"`), a string extra holding 0 to 4294967295 that fixes the seed of every round dealt in that launch, Play again included (task 11; `extraText` also reads a long extra).
- `Card.text.en.statement`, `Card.text.en.explanation`, `Card.source.title`, `Card.source.url` (task 1, the shapes of `schema.ts`), as tasks 6 and 9 also assume.
- `recordKey` and `LastRound` as task 9 assumes them from task 4.
- The theme switch, the Back pill, the pass fields, the Continue line, the result's "Why" buttons and the source link are clickable nodes labelled as reference 4.5 says (task 12 to 14), and the round's header is one node labelled with `flightPathLabel`, `streakLabel`, `livesLabel` or `timedLabel` (task 13), as reference 5.9 requires ("one image per header").
- The Timed ticker runs on the round coordinator's coroutine scope (task 11), not as a frame loop inside the composition; a composition that always waits for the next frame never becomes idle and every Compose finder would time out.
- Lists of options are not lazy (a `Column` in a `verticalScroll`, as the web renders every option), so `performScrollTo` reaches any option.

**Steps:**

- [ ] **Step 1: Check the starting state, the names this task relies on and the SDK.**

```bash
git branch --show-current
git status --short
node --version
cd android/Truthy
grep -rln "class MainActivity" app/src/main
grep -rn 'const val SEED = "truthy.seed"' app/src/main/kotlin
grep -rn "object TestTags" app/src/main/kotlin
for tag in LOGO PASS TICKET STUB CARD ROUND_SURFACE SHEET_CARD; do printf '%s ' "$tag"; grep -rlw "TestTags.$tag" app/src/main/kotlin | wc -l | tr -d ' '; done
grep -rn "const val PREFS_NAME\|const val FILE_NAME" app/src/main/kotlin
grep -rln "fun recordKey\|fun plainText\|fun readProgress" ../Truthy/engine/src/main/kotlin
grep -n "testInstrumentationRunner\|androidTestImplementation\|debugImplementation" app/build.gradle.kts
grep -n "compose-bom\|ui-test\|androidx-test\|espresso\|uiautomator" gradle/libs.versions.toml
ls "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "$ANDROID_HOME/emulator/emulator" "$ANDROID_HOME/platform-tools/adb"
```

Expected: `native`; nothing from `git status --short`; a Node version starting `v24`; one file for `MainActivity` (task 7 keeps it under `app/src/main/java`); one line declaring `SEED`; one `object TestTags` line; every tag name followed by a count of 1 or more; `PREFS_NAME = StorageNames.PREFS_FILE` and the three `FILE_NAME` constants of task 9 (each `= StorageNames.X`, task 7's names: `"truthy"`, `"truthy.progress.v1.json"`, `"truthy.progress.v1.unreadable.json"` as `UNREADABLE_FILE_NAME`, `"truthy.round.v1.json"`); three engine files; a `testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"` line; the three SDK tools listed without an error. If `ANDROID_HOME` is empty, set it to the SDK folder Android Studio uses (Settings, Languages and Frameworks, Android SDK) in the shell profile first.

Stop and report to the controller when a name is missing or a tag count is 0: the task that draws that element did not tag it, and that task is reopened, not this one. Note which of the instrumented test libraries of step 2 the last two `grep`s already show.

- [ ] **Step 2: Add the instrumented test dependencies.**

In `android/Truthy/gradle/libs.versions.toml`, add each of these lines that the catalog does not already have (the versions are the current stable releases on the AndroidX release pages as of drafting; if task 1 pinned newer ones, keep those). Under `[versions]`:

```toml
androidxTestCore = "1.7.0"
androidxTestRunner = "1.7.0"
androidxTestRules = "1.7.0"
androidxTestExtJunit = "1.3.0"
espresso = "3.7.0"
uiautomator = "2.4.0"
```

Under `[libraries]`:

```toml
androidx-test-core = { group = "androidx.test", name = "core", version.ref = "androidxTestCore" }
androidx-test-runner = { group = "androidx.test", name = "runner", version.ref = "androidxTestRunner" }
androidx-test-rules = { group = "androidx.test", name = "rules", version.ref = "androidxTestRules" }
androidx-test-ext-junit = { group = "androidx.test.ext", name = "junit", version.ref = "androidxTestExtJunit" }
androidx-test-espresso-core = { group = "androidx.test.espresso", name = "espresso-core", version.ref = "espresso" }
androidx-test-espresso-intents = { group = "androidx.test.espresso", name = "espresso-intents", version.ref = "espresso" }
androidx-test-uiautomator = { group = "androidx.test.uiautomator", name = "uiautomator", version.ref = "uiautomator" }
androidx-compose-ui-test-junit4 = { group = "androidx.compose.ui", name = "ui-test-junit4" }
androidx-compose-ui-test-manifest = { group = "androidx.compose.ui", name = "ui-test-manifest" }
```

In `android/Truthy/app/build.gradle.kts`, inside `dependencies { }`, add each of these lines that is not there yet (`libs.androidx.compose.bom` is task 7's alias of the Compose BOM; use the alias the catalog has):

```kotlin
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(libs.androidx.test.espresso.intents)
    androidTestImplementation(libs.androidx.test.uiautomator)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
```

and, inside `android { defaultConfig { } }`, `testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"` if step 1 did not find it. Run:

```bash
cd android/Truthy && ./gradlew :app:assembleDebugAndroidTest
```

Expected: `BUILD SUCCESSFUL`. A version that does not resolve, or a library whose minSdk is above 26 (the manifest merger names it), is replaced by the latest stable version that resolves and supports API 26, and the change is noted in the report.

- [ ] **Step 3: Write the emulator script and create the four emulators.**

`android/Tools/emulators.sh`:

```bash
#!/usr/bin/env bash
# The four emulators of the Android review (spec 7.6): API 36, 34, 33 and 26, Pixel 8 size (412 by 915 dp).
#   android/Tools/emulators.sh create          installs the system images and creates the AVDs (once)
#   android/Tools/emulators.sh start <api>     boots one, waits for it and sets it up for tests (one at a time)
#   android/Tools/emulators.sh stop            shuts the running emulator down
set -euo pipefail
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK folder}"
sdkmanager="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
avdmanager="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"
emulator="$ANDROID_HOME/emulator/emulator"
adb="$ANDROID_HOME/platform-tools/adb"
apis=(36 34 33 26)
image() { echo "system-images;android-$1;google_apis;arm64-v8a"; }

case "${1:-}" in
  create)
    yes | "$sdkmanager" --licenses > /dev/null || true
    for api in "${apis[@]}"; do
      "$sdkmanager" "$(image "$api")" > /dev/null
      if ! "$emulator" -list-avds | grep -qx "truthy-api$api"; then
        echo no | "$avdmanager" create avd --name "truthy-api$api" --package "$(image "$api")" --device pixel_8 > /dev/null
      fi
      echo "truthy-api$api ready"
    done
    ;;
  start)
    api="${2:?which API: 36, 34, 33 or 26}"
    if "$adb" devices | grep -q '^emulator-'; then echo "an emulator is already running: stop it first" >&2; exit 1; fi
    "$emulator" -avd "truthy-api$api" -no-snapshot -no-boot-anim -no-audio > "${TMPDIR:-/tmp}/truthy-api$api.log" 2>&1 &
    "$adb" wait-for-device
    until [ "$("$adb" shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 2; done
    "$adb" shell input keyevent KEYCODE_WAKEUP
    "$adb" shell wm dismiss-keyguard > /dev/null 2>&1 || true
    "$adb" shell svc power stayon true
    "$adb" shell settings put system font_scale 1.0
    for scale in window_animation_scale transition_animation_scale animator_duration_scale; do
      "$adb" shell settings put global "$scale" 1
    done
    if [ "$api" -ge 29 ]; then
      "$adb" shell cmd overlay enable com.android.internal.systemui.navbar.gestural > /dev/null 2>&1 || true
      "$adb" shell cmd uimode night no > /dev/null
    fi
    echo "truthy-api$api booted, SDK $("$adb" shell getprop ro.build.version.sdk | tr -d '\r')"
    ;;
  stop)
    "$adb" emu kill > /dev/null 2>&1 || true
    while "$adb" devices | grep -q '^emulator-'; do sleep 1; done
    echo "stopped"
    ;;
  *)
    echo "usage: emulators.sh create | start <api> | stop" >&2
    exit 2
    ;;
esac
```

Run:

```bash
chmod +x android/Tools/emulators.sh
android/Tools/emulators.sh create
android/Tools/emulators.sh start 36
```

Expected: `truthy-api36 ready`, `truthy-api34 ready`, `truthy-api33 ready`, `truthy-api26 ready` (the first run downloads four system images, several gigabytes), then `truthy-api36 booted, SDK 36`. The four images exist for Apple silicon (`arm64-v8a`); this was checked against Google's system image list during drafting. Gesture navigation is switched on from API 29, so an edge swipe is a predictive back on 34 and 36 and an instant back on 33; API 26 has three-button navigation.

- [ ] **Step 4: Write the device helpers.**

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/support/Device.kt`:

```kotlin
package com.eienmosu.truthy.support

import android.app.Instrumentation
import android.app.UiModeManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.toArgb
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import com.eienmosu.truthy.DebugLaunch
import com.eienmosu.truthy.FileProgressStore
import com.eienmosu.truthy.MainActivity
import com.eienmosu.truthy.ThemeStore
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyColors
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.readProgress
import java.io.File
import kotlin.math.abs

/** The web's key of the stored theme (reference 6), read to check what the switch stored. */
const val THEME_PREF_KEY = "truthy.theme"

/** The emulator and the app's files: what a test arranges before a launch and reads after it. */
object Device {
    val instrumentation: Instrumentation get() = InstrumentationRegistry.getInstrumentation()
    val app: Context get() = instrumentation.targetContext
    val density: Float get() = app.resources.displayMetrics.density
    val sdk: Int get() = Build.VERSION.SDK_INT

    /** A first launch: no progress, no side copy, no journal, no stored theme. The review folder "visual" stays. */
    fun reset() {
        app.filesDir.listFiles()?.filter { it.name.startsWith("truthy.") }?.forEach { it.deleteRecursively() }
        prefs().edit().clear().commit()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Task 8 hands a stored theme to the system (setApplicationNightMode), which keeps it after the
            // preferences are cleared. MODE_NIGHT_AUTO gives the app the system's own setting back.
            app.getSystemService(UiModeManager::class.java).setApplicationNightMode(UiModeManager.MODE_NIGHT_AUTO)
        }
    }

    private fun prefs() = app.getSharedPreferences(ThemeStore.PREFS_NAME, Context.MODE_PRIVATE)

    /** Writes the progress file as a previous run of the app (or the web, same JSON) would have left it. */
    fun storeProgress(json: String) {
        File(app.filesDir, FileProgressStore.FILE_NAME).writeText(json)
    }

    /** The stored progress, read with the engine's own reader. Empty progress when nothing is stored. */
    fun progress(): Progress {
        val file = File(app.filesDir, FileProgressStore.FILE_NAME)
        return readProgress(if (file.exists()) file.readText() else null).progress
    }

    fun storedTheme(): String? = prefs().getString(THEME_PREF_KEY, null)

    fun launch(seed: Long? = null): ActivityScenario<MainActivity> {
        val intent = Intent(app, MainActivity::class.java)
        if (seed != null) intent.putExtra(DebugLaunch.SEED, seed.toString())
        return ActivityScenario.launch(intent)
    }

    /** Runs a shell command as the shell user and returns its output once it has finished. */
    fun shell(command: String): String {
        val output = instrumentation.uiAutomation.executeShellCommand(command)
        return ParcelFileDescriptor.AutoCloseInputStream(output).bufferedReader().use { it.readText() }
    }

    /** The system's dark theme on or off. Android has a system dark theme from API 29; below it this does nothing. */
    fun systemNight(on: Boolean) {
        if (sdk >= 29) shell("cmd uimode night ${if (on) "yes" else "no"}")
    }

    /** The whole screen, system bars included, as a software bitmap whose pixels can be read. */
    fun screenshot(): Bitmap {
        val shot = instrumentation.uiAutomation.takeScreenshot() ?: error("UiAutomation gave no screenshot")
        return shot.copy(Bitmap.Config.ARGB_8888, false)
    }
}

/** A finger on the touch screen: real MotionEvents with real uptime stamps, at screen coordinates in px. */
object Finger {
    fun tap(at: Offset) {
        val down = press(at)
        SystemClock.sleep(40)
        release(down, at)
    }

    /** Puts the finger down and returns the down time the later events of this gesture carry. */
    fun press(at: Offset): Long {
        val now = SystemClock.uptimeMillis()
        send(now, now, MotionEvent.ACTION_DOWN, at)
        return now
    }

    fun moveTo(downTime: Long, at: Offset) = send(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_MOVE, at)

    fun release(downTime: Long, at: Offset) = send(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, at)

    fun drag(from: Offset, to: Offset, steps: Int = 12, stepMs: Long = 16) {
        val down = press(from)
        for (step in 1..steps) {
            SystemClock.sleep(stepMs)
            moveTo(down, from + (to - from) * (step / steps.toFloat()))
        }
        release(down, to)
    }

    private fun send(downTime: Long, eventTime: Long, action: Int, at: Offset) {
        val event = MotionEvent.obtain(downTime, eventTime, action, at.x, at.y, 0)
        event.source = InputDevice.SOURCE_TOUCHSCREEN
        try {
            Device.instrumentation.sendPointerSync(event)
        } finally {
            event.recycle()
        }
    }
}

/** A hardware keyboard: key events to the focused window, as an attached keyboard sends them. */
object Keys {
    fun press(code: Int) = Device.instrumentation.sendKeyDownUpSync(code)

    /** A held key: one down, `repeats` auto-repeat downs 50 ms apart, then the up. */
    fun hold(code: Int, repeats: Int) {
        val keyboard = Device.instrumentation
        val down = SystemClock.uptimeMillis()
        keyboard.sendKeySync(KeyEvent(down, down, KeyEvent.ACTION_DOWN, code, 0))
        for (repeat in 1..repeats) {
            SystemClock.sleep(50)
            keyboard.sendKeySync(KeyEvent(down, SystemClock.uptimeMillis(), KeyEvent.ACTION_DOWN, code, repeat))
        }
        keyboard.sendKeySync(KeyEvent(down, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, code, 0))
    }
}

/** Expected screen colours, from the generated tokens (task 8). */
object Colours {
    // The sky's smooth gradient over the window height (reference 5.0 and 5.1), stops from plan A's native group.
    private val STOPS = Tokens.Native.skyStops

    /** The sky at a fraction of the window height, mixed per channel in sRGB as the gradient draws it. */
    fun skyAt(colors: TruthyColors, fraction: Float): Int {
        val sky = intArrayOf(colors.sky1.toArgb(), colors.sky2.toArgb(), colors.sky3.toArgb(), colors.sky4.toArgb())
        val at = fraction.coerceIn(0f, 1f)
        var i = 0
        while (i < STOPS.size - 2 && at > STOPS[i + 1]) i += 1
        val t = (at - STOPS[i]) / (STOPS[i + 1] - STOPS[i])
        fun mix(shift: Int): Int {
            val from = (sky[i] shr shift) and 0xFF
            val to = (sky[i + 1] shr shift) and 0xFF
            return Math.round(from + (to - from) * t)
        }
        return (0xFF shl 24) or (mix(16) shl 16) or (mix(8) shl 8) or mix(0)
    }

    fun close(a: Int, b: Int, tolerance: Int = 3): Boolean =
        listOf(16, 8, 0).all { shift -> abs(((a shr shift) and 0xFF) - ((b shr shift) and 0xFF)) <= tolerance }

    fun hex(colour: Int): String = "#%06x".format(colour and 0xFFFFFF)
}
```

No run yet: step 7 compiles and runs the support code.

- [ ] **Step 5: Write the routes and the UI driver.**

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/support/Routes.kt`:

```kotlin
package com.eienmosu.truthy.support

import com.eienmosu.truthy.engine.Route

/** One way through the start flow, as the accessible names of the options to choose (reference 4.5). */
data class RoutePick(val area: Regex, val platform: Regex, val deck: Regex, val section: Regex?, val mode: Regex)

// Patterns where a count changes with the content, so the tests keep passing when the decks grow (as e2e/helpers.ts).
val CLF_SECURITY = RoutePick(
    area = Regex("Cloud, \\d+ decks?"),
    platform = Regex("AWS, \\d+ decks?"),
    deck = Regex("CLF, Cloud Practitioner, \\d+ cards, .*"),
    section = Regex("SEC, Security and compliance, \\d+ cards"),
    mode = Regex("Classic\\. Correct answers out of 10 cards\\. .*"),
)

/** The same route in another class: "Streak", "Three lives" or "Timed". */
fun RoutePick.inClass(name: String): RoutePick = copy(mode = Regex(Regex.escape(name) + "\\. .*"))

/** The whole CDL deck (it has no sections), Classic: the second deck of the review's returning player. */
val CDL_WHOLE = RoutePick(
    area = Regex("Cloud, \\d+ decks?"),
    platform = Regex("Google Cloud, \\d+ decks?"),
    deck = Regex("CDL, Cloud Digital Leader, \\d+ cards, .*"),
    section = null,
    mode = Regex("Classic\\. Correct answers out of 10 cards\\. .*"),
)

const val CLF_ID = "aws-clf-c02"
const val CDL_ID = "gcp-cdl"
val CLF_SEC_ROUTE = Route(CLF_ID, "SEC")

/** The Continue line after a round on CLF / SEC / Classic; a score adds " Last score {x}." */
const val CONTINUE_CLF_SECURITY = "Continue: AWS Cloud Practitioner, Security and compliance, Classic."

/** The round's heading: "{deckName}, {sectionName}: {class} round". */
fun roundHeading(className: String) = "AWS Cloud Practitioner, Security and compliance: $className round"
```

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/support/Ui.kt`:

```kotlin
package com.eienmosu.truthy.support

import android.os.SystemClock
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.text.TextLayoutResult
import com.eienmosu.truthy.DeckStore
import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.DeckFile
import com.eienmosu.truthy.engine.plainText
import com.eienmosu.truthy.ui.TestTags
import kotlinx.coroutines.runBlocking

/** A little over the 250 ms settle time: a new step's options and a new card ignore input until it has passed. */
const val SETTLE_MS = 300L
/** A little over NEXT_ARRIVES_MS (420): Next card and See results ignore presses until then. */
const val ARRIVAL_MS = 470L
/** A little over RESULT_ARRIVES_MS (1000): the result's actions and back on the result. */
const val RESULT_MS = 1_100L
const val WAIT_MS = 5_000L

/** What a screen reader would read for a node: its content descriptions and its texts. */
fun labelsOf(node: SemanticsNode): List<String> {
    val descriptions = node.config.getOrElseNullable(SemanticsProperties.ContentDescription) { null }.orEmpty()
    val texts = node.config.getOrElseNullable(SemanticsProperties.Text) { null }.orEmpty().map { it.text }
    return descriptions + texts
}

fun label(text: String) = SemanticsMatcher("label \"$text\"") { text in labelsOf(it) }
fun label(pattern: Regex) = SemanticsMatcher("label matching /$pattern/") { node -> labelsOf(node).any { pattern.matches(it) } }
fun button(text: String) = label(text) and hasClickAction()
fun button(pattern: Regex) = label(pattern) and hasClickAction()

val IN_SHEET = hasAnyAncestor(hasTestTag(TestTags.SHEET_CARD))
/** The round's X ("Leave round"), not the sheet's quiet button of the same name. */
val LEAVE_X = button("Leave round") and !IN_SHEET
val LEAVE_IN_SHEET = button("Leave round") and IN_SHEET
val SHEET_TITLE = label("Leave round?")

/** A card of a round and what the player answered to it. `number` counts from 1. */
data class Played(val number: Int, val card: Card, val given: Boolean) {
    val correct: Boolean get() = given == card.answer
}

fun statementOf(card: Card): String = plainText(card.text.en.statement)

/** The shipped deck, read from the app's assets as the app reads it: tells a test the answer to the statement on screen. */
class DeckAnswers(deckId: String) {
    val deck: DeckFile = runBlocking { DeckStore(Device.app.assets).deck(deckId) }
    private val byStatement: Map<String, Card> = deck.cards.associateBy(::statementOf)
    fun cardFor(text: String): Card? = byStatement[text]
}

/** Plays the app through a Compose test rule the way a player does: by labels, with real taps, at real speed. */
@OptIn(ExperimentalTestApi::class)
class Ui(val rule: ComposeTestRule) {
    fun idle() = rule.waitForIdle()

    fun exists(matcher: SemanticsMatcher, unmerged: Boolean = false): Boolean =
        rule.onAllNodes(matcher, useUnmergedTree = unmerged).fetchSemanticsNodes(atLeastOneRootRequired = false).isNotEmpty()

    fun count(matcher: SemanticsMatcher): Int =
        rule.onAllNodes(matcher).fetchSemanticsNodes(atLeastOneRootRequired = false).size

    fun waitFor(matcher: SemanticsMatcher, timeoutMs: Long = WAIT_MS) = rule.waitUntilExactlyOneExists(matcher, timeoutMs)
    fun waitForAny(matcher: SemanticsMatcher, timeoutMs: Long = WAIT_MS) = rule.waitUntilAtLeastOneExists(matcher, timeoutMs)
    fun waitGone(matcher: SemanticsMatcher, timeoutMs: Long = WAIT_MS) = rule.waitUntilDoesNotExist(matcher, timeoutMs)

    fun node(matcher: SemanticsMatcher): SemanticsNode = rule.onNode(matcher).fetchSemanticsNode()

    /** The centre of a node in screen px, where a finger would touch it. */
    fun centre(matcher: SemanticsMatcher): Offset = centreOf(node(matcher))

    private fun centreOf(node: SemanticsNode): Offset =
        node.positionOnScreen + Offset(node.size.width / 2f, node.size.height / 2f)

    /** A node's bounds in its window, in dp. They include graphicsLayer transforms of the node. */
    fun boundsDp(matcher: SemanticsMatcher): Rect {
        val bounds = node(matcher).boundsInWindow
        val d = Device.density
        return Rect(bounds.left / d, bounds.top / d, bounds.right / d, bounds.bottom / d)
    }

    fun tap(matcher: SemanticsMatcher, idle: Boolean = true) {
        waitFor(matcher)
        Finger.tap(centre(matcher))
        if (idle) idle()
    }

    /** Scrolls the node's list or column until the node shows, then taps it. */
    fun tapScrolled(matcher: SemanticsMatcher) {
        waitFor(matcher)
        rule.onNode(matcher).performScrollTo()
        idle()
        tap(matcher)
    }

    /** The first of several matching nodes (the "Why" rows), scrolled into view and tapped. */
    fun tapFirst(matcher: SemanticsMatcher) {
        waitForAny(matcher)
        val first = rule.onAllNodes(matcher)[0]
        first.performScrollTo()
        idle()
        Finger.tap(centreOf(first.fetchSemanticsNode()))
        idle()
    }

    // ---------- the start flow ----------

    /** Waits for the step with this title, lets its motion finish and its 250 ms settle time pass. */
    fun atStep(title: String) {
        waitFor(label(title))
        idle()
        SystemClock.sleep(SETTLE_MS)
    }

    fun atHome() {
        atStep("Choose an area")
        waitFor(button(CLF_SECURITY.area))
    }

    fun choose(option: Regex) = tapScrolled(button(option))

    /** Fills in the pass from step 1 to "Your pass is ready", letting each step settle. */
    fun chooseRoute(pick: RoutePick) {
        choose(pick.area)
        atStep("Choose a platform")
        choose(pick.platform)
        atStep("Choose a deck")
        choose(pick.deck)
        if (pick.section != null) {
            atStep("Choose a section")
            choose(pick.section)
        }
        atStep("Choose how to play")
        choose(pick.mode)
        atStep("Your pass is ready")
    }

    fun startRound() = tap(button("Start round"))

    // ---------- the round ----------

    /**
     * The card whose statement is on screen: exactly one statement of the deck among the texts, other than
     * `previous` (a Timed card that is leaving, or the card answered before).
     */
    fun cardOnScreen(deck: DeckAnswers, previous: Card? = null, timeoutMs: Long = WAIT_MS): Card {
        var found: Card? = null
        rule.waitUntil(timeoutMs) {
            val texts = rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.Text), useUnmergedTree = true)
                .fetchSemanticsNodes(atLeastOneRootRequired = false)
                .flatMap { node -> node.config[SemanticsProperties.Text].map { it.text } }
            val cards = texts.mapNotNull(deck::cardFor).distinctBy { it.id }.filter { it.id != previous?.id }
            found = cards.singleOrNull()
            found != null
        }
        return found ?: error("no single card of ${deck.deck.id} on screen")
    }

    /** Answers with the True or False pill, right or wrong on purpose. Returns what was given. */
    fun answer(card: Card, right: Boolean, idle: Boolean = true): Boolean {
        val given = if (right) card.answer else !card.answer
        tap(button(if (given) "True" else "False"), idle)
        return given
    }

    /** Next card, or See results on the last card, once it takes presses. */
    fun goOn(last: Boolean) {
        val go = button(if (last) "See results" else "Next card")
        waitFor(go)
        SystemClock.sleep(ARRIVAL_MS)
        tap(go)
    }

    /** A whole Classic round of `total` cards, wrong on purpose on the numbers in `wrongOn`. */
    fun playClassic(deck: DeckAnswers, wrongOn: Set<Int>, total: Int = 10): List<Played> {
        val played = mutableListOf<Played>()
        for (number in 1..total) {
            waitFor(label(Regex("Card $number of $total\\..*")))
            val card = cardOnScreen(deck, played.lastOrNull()?.card)
            SystemClock.sleep(SETTLE_MS)
            val given = answer(card, right = number !in wrongOn)
            goOn(last = number == total)
            played += Played(number, card, given)
        }
        return played
    }

    fun waitForResult() {
        waitFor(label("Round complete"))
        idle()
    }

    /** The whole seconds the Timed header names: "41 seconds left of 60. 1 correct, 0 wrong." */
    fun timedSecondsLeft(): Int {
        val pattern = Regex("(\\d+) seconds? left of 60\\. .*")
        val node = rule.onAllNodes(label(pattern)).fetchSemanticsNodes().single()
        return labelsOf(node).firstNotNullOf { pattern.matchEntire(it) }.groupValues[1].toInt()
    }

    // ---------- text that does not fit ----------

    /**
     * Every text on screen that overflows its box or is cut with an ellipsis, with the reason. A fixed height
     * that is not a minimum shows up here as a taller text than its box (spec 5.6: text grows or scrolls).
     */
    fun clippedTexts(): List<String> {
        val nodes = rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.GetTextLayoutResult), useUnmergedTree = true)
            .fetchSemanticsNodes(atLeastOneRootRequired = false)
        return rule.runOnUiThread {
            nodes.mapNotNull { node ->
                val layouts = mutableListOf<TextLayoutResult>()
                node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
                layouts.firstOrNull()?.let { layout ->
                    val ellipsized = (0 until layout.lineCount).any { layout.isLineEllipsized(it) }
                    if ((layout.didOverflowHeight || (0 until layout.lineCount).any { layout.getLineRight(it) - layout.getLineLeft(it) > layout.size.width + 1f }) || ellipsized) {
                        "\"${layout.layoutInput.text.text}\" (too wide: ${layout.didOverflowWidth}, " +
                            "too tall: ${layout.didOverflowHeight}, ellipsized: $ellipsized)"
                    } else {
                        null
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 6: Write the screen walk the visual review and the large-text check share.**

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/support/ScreenWalk.kt`:

```kotlin
package com.eienmosu.truthy.support

import android.os.SystemClock
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasTestTag
import com.eienmosu.truthy.ui.TestTags

/** The seed of the review's round, the same on the web (screens.mjs SEED) and in plan B's review. */
const val REVIEW_SEED = 1_234_567L

/**
 * The reviewed states in walk order, with the ids plan B's review uses, and the elements whose frames are compared.
 * screens.mjs mirrors this map (compare.test.mjs pins it). The Timed stamp beat (reference P3t) is not captured: it
 * lasts 700 ms, and the feel recordings cover it.
 */
val SCREEN_ELEMENTS: Map<String, List<String>> = linkedMapOf(
    "s1" to listOf("logo"),
    "s2" to listOf("pass"),
    "s3" to listOf("pass"),
    "s4" to listOf("pass"),
    "s5" to listOf("pass"),
    "s6" to listOf("pass", "start"),
    "p2" to listOf("ticket", "stub", "true", "false"),
    "p3" to listOf("ticket", "next"),
    "p4" to listOf("sheet", "keep"),
    "r1" to listOf("ticket", "again", "another"),
    "streak-p2" to listOf("ticket", "stub", "true", "false"),
    "streak-r1" to listOf("ticket", "again", "another"),
    "lives-p2" to listOf("ticket", "stub", "true", "false"),
    "lives-r1" to listOf("ticket", "again", "another"),
    "lives-r1-why" to listOf("ticket"),
    "timed-p2" to listOf("ticket", "stub", "true", "false"),
    "timed-up" to listOf("ticket", "results"),
    "timed-r1" to listOf("ticket", "again", "another"),
    "s1-returning" to listOf("logo"),
    "s3-recent" to listOf("pass"),
)

/** How each element is found on Android; web-capture.mjs finds the same elements in the web page. */
val ELEMENT_MATCHERS: Map<String, SemanticsMatcher> = mapOf(
    "logo" to hasTestTag(TestTags.LOGO),
    "pass" to hasTestTag(TestTags.PASS),
    "ticket" to hasTestTag(TestTags.TICKET),
    "stub" to hasTestTag(TestTags.STUB),
    "sheet" to hasTestTag(TestTags.SHEET_CARD),
    "start" to button("Start round"),
    "true" to button("True"),
    "false" to button("False"),
    "next" to button("Next card"),
    "results" to button("See results"),
    "keep" to button("Keep playing"),
    "again" to button("Play again"),
    "another" to button("Choose another route"),
)

/**
 * Walks the reviewed states from a first launch, as plan B's testCaptureEveryScreen and
 * testCaptureTheOtherClassesAndStartStates play them and as web-capture.mjs plays them: Classic on CLF / SEC with
 * True on every card, the leave sheet opened and closed after card 1; then Streak and Three lives with True on every
 * card until the round ends (a missed card with Why open on the Three lives result), Timed answered once and run
 * out; then a second deck (CDL, whole deck) played and left with one answer, so step 1 shows Recent and the
 * Continue line, and the Recent deck list. `visit` gets each state at rest.
 */
class ScreenWalk(private val ui: Ui) {
    private val deck by lazy { DeckAnswers(CLF_ID) }

    fun run(visit: (String) -> Unit) {
        classicRound(visit)
        otherClassesAndStartStates(visit)
    }

    private fun classicRound(visit: (String) -> Unit) {
        ui.atHome()
        visit("s1")
        ui.choose(CLF_SECURITY.area)
        ui.atStep("Choose a platform")
        visit("s2")
        ui.choose(CLF_SECURITY.platform)
        ui.atStep("Choose a deck")
        visit("s3")
        ui.choose(CLF_SECURITY.deck)
        ui.atStep("Choose a section")
        visit("s4")
        ui.choose(checkNotNull(CLF_SECURITY.section))
        ui.atStep("Choose how to play")
        visit("s5")
        ui.choose(CLF_SECURITY.mode)
        ui.atStep("Your pass is ready")
        visit("s6")

        ui.startRound()
        var card = ui.cardOnScreen(deck)
        ui.idle()
        SystemClock.sleep(SETTLE_MS)
        visit("p2")
        ui.tap(button("True"))
        ui.waitFor(button("Next card"))
        SystemClock.sleep(ARRIVAL_MS)
        ui.idle()
        visit("p3")
        ui.tap(LEAVE_X)
        ui.waitFor(SHEET_TITLE)
        ui.idle()
        visit("p4")
        ui.tap(button("Keep playing"))
        ui.waitGone(SHEET_TITLE)

        for (number in 2..10) {
            SystemClock.sleep(ARRIVAL_MS)
            ui.tap(button("Next card"))
            card = ui.cardOnScreen(deck, card)
            SystemClock.sleep(SETTLE_MS)
            ui.tap(button("True"))
            ui.waitFor(button(if (number == 10) "See results" else "Next card"))
        }
        SystemClock.sleep(ARRIVAL_MS)
        ui.tap(button("See results"))
        ui.waitForResult()
        SystemClock.sleep(RESULT_MS)
        visit("r1")
        closeResults()
    }

    private fun otherClassesAndStartStates(visit: (String) -> Unit) {
        for ((className, name) in listOf("Streak" to "streak", "Three lives" to "lives")) {
            ui.chooseRoute(CLF_SECURITY.inClass(className))
            ui.startRound()
            var card = ui.cardOnScreen(deck)
            ui.idle()
            SystemClock.sleep(SETTLE_MS)
            visit("$name-p2")
            while (true) {
                ui.tap(button("True"))
                ui.waitForAny(button(Regex("Next card|See results")))
                if (ui.exists(button("See results"))) break
                SystemClock.sleep(ARRIVAL_MS)
                ui.tap(button("Next card"))
                card = ui.cardOnScreen(deck, card)
                SystemClock.sleep(SETTLE_MS)
            }
            SystemClock.sleep(ARRIVAL_MS)
            ui.tap(button("See results"))
            ui.waitForResult()
            SystemClock.sleep(RESULT_MS)
            visit("$name-r1")
            if (name == "lives") {
                // Three wrong answers end the round, so a missed card is always there.
                ui.tapFirst(button(Regex("Why, card \\d{2}")))
                visit("lives-r1-why")
            }
            closeResults()
        }

        ui.chooseRoute(CLF_SECURITY.inClass("Timed"))
        ui.startRound()
        ui.cardOnScreen(deck)
        ui.idle()
        SystemClock.sleep(SETTLE_MS)
        visit("timed-p2")
        ui.tap(button("True"))
        // The rest of the minute runs out in real time.
        ui.waitFor(button("See results"), timeoutMs = 75_000)
        SystemClock.sleep(ARRIVAL_MS)
        ui.idle()
        visit("timed-up")
        ui.tap(button("See results"))
        ui.waitForResult()
        SystemClock.sleep(RESULT_MS)
        visit("timed-r1")
        closeResults()

        // A second deck played and left with one answer: step 1 then shows Recent (two decks) and Continue.
        ui.chooseRoute(CDL_WHOLE)
        ui.startRound()
        ui.cardOnScreen(DeckAnswers(CDL_ID))
        SystemClock.sleep(SETTLE_MS)
        ui.tap(button("True"))
        ui.waitForAny(button(Regex("Next card|See results")))
        ui.tap(LEAVE_X)
        ui.waitFor(SHEET_TITLE)
        ui.tap(LEAVE_IN_SHEET)
        ui.atHome()
        visit("s1-returning")
        ui.choose(Regex("Recent, 2 decks"))
        ui.atStep("Choose a deck")
        visit("s3-recent")
    }

    /** Close results, once the result's 1000 ms have passed (the caller slept RESULT_MS before its visit). */
    private fun closeResults() {
        ui.tap(button("Close results"))
        ui.atHome()
    }
}
```

- [ ] **Step 7: Check the support code on the API 36 emulator.**

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/support/SupportTest.kt`:

```kotlin
package com.eienmosu.truthy.support

import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.ui.TestTags
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SupportTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    @Test fun theWindowStartsAtTheScreenOrigin() {
        Device.launch().use { scenario ->
            ui.atHome()
            scenario.onActivity { activity ->
                val origin = IntArray(2)
                activity.window.decorView.getLocationOnScreen(origin)
                assertEquals(0, origin[0])
                assertEquals(0, origin[1])
            }
        }
    }

    @Test fun stepOneShowsTheLogoTheAreasAndTheThemeSwitch() {
        Device.launch().use {
            ui.atHome()
            ui.waitFor(hasTestTag(TestTags.LOGO))
            assertTrue(ui.exists(label("Truthy")))
            ui.waitFor(label("True or false cards that teach you IT, one swipe at a time."))
            for (area in listOf("Cloud", "Frontend", "DevOps", "Backend")) ui.waitFor(button(Regex("$area, (\\d+ decks?|no decks yet)")))
            ui.waitFor(button(Regex("Switch to (dark|light) theme")))
            assertFalse(ui.exists(label(Regex("Continue: .*"))))
        }
    }
}
```

Run (the emulator from step 3 is running):

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.support.SupportTest
```

Expected: the first compile of the support code, then `BUILD SUCCESSFUL`. Then write the report reader used after every run from here on.

`android/Tools/test-summary.mjs`:

```js
#!/usr/bin/env node
// Sums the JUnit XML reports of a connected test run and names the failed tests.
//   node android/Tools/test-summary.mjs android/Truthy/app/build/outputs/androidTest-results
// Exits 1 when a test failed or no test ran.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const folder = process.argv[2];
const totals = { tests: 0, failures: 0, errors: 0, skipped: 0 };
const failed = [];
for (const name of readdirSync(folder, { recursive: true })) {
  if (!/(^|\/)TEST-[^/]*\.xml$/.test(name)) continue;
  const xml = readFileSync(join(folder, name), "utf8");
  for (const suite of xml.matchAll(/<testsuite\b[^>]*>/g)) {
    for (const key of Object.keys(totals)) totals[key] += Number(new RegExp(`\\b${key}="(\\d+)"`).exec(suite[0])?.[1] ?? 0);
  }
  for (const chunk of xml.split("<testcase").slice(1)) {
    const body = chunk.split("</testcase>")[0];
    if (!/<(failure|error)\b/.test(body)) continue;
    const test = /\bname="([^"]*)"/.exec(chunk)?.[1];
    const owner = /\bclassname="([^"]*)"/.exec(chunk)?.[1];
    failed.push(`${owner}.${test}`);
  }
}
console.log(`tests ${totals.tests}, failures ${totals.failures}, errors ${totals.errors}, skipped ${totals.skipped}`);
for (const name of failed) console.log(`failed: ${name}`);
process.exit(totals.tests > 0 && totals.failures + totals.errors === 0 ? 0 : 1);
```

```bash
node android/Tools/test-summary.mjs android/Truthy/app/build/outputs/androidTest-results
```

Expected: `tests 2, failures 0, errors 0, skipped 0`. If `theWindowStartsAtTheScreenOrigin` fails, the window is offset (not edge to edge, task 8's `applyWindowTheme`): every screen coordinate this task computes would be off, so fix that first.

Commit:

```bash
git add android/Truthy/gradle/libs.versions.toml android/Truthy/app/build.gradle.kts android/Tools/emulators.sh android/Tools/test-summary.mjs android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/support
git commit -m "test: add the Android UI test support, the emulator script and the report reader"
```

- [ ] **Step 8: A Classic round from step 1 to the result.**

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/stories/ClassicRoundTest.kt`:

```kotlin
package com.eienmosu.truthy.stories

import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.plainText
import com.eienmosu.truthy.engine.recordKey
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.CLF_SEC_ROUTE
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.WAIT_MS
import com.eienmosu.truthy.support.button
import com.eienmosu.truthy.support.label
import com.eienmosu.truthy.support.roundHeading
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ClassicRoundTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    @Test fun aFirstRunFillsInThePassPlaysTenCardsAndShowsTheResult() {
        Device.launch().use {
            ui.atHome()
            // A new player has nothing to continue.
            assertFalse(ui.exists(label(Regex("Continue: .*"))))
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            ui.waitFor(label(roundHeading("Classic")))

            val played = ui.playClassic(DeckAnswers(CLF_ID), wrongOn = setOf(3, 6, 9))

            ui.waitForResult()
            ui.waitFor(label("Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9."))
            ui.waitFor(label("First round on this route"))
            ui.waitFor(label("3 to review"))
            val missed = played.filter { !it.correct }
            assertEquals(listOf(3, 6, 9), missed.map { it.number })
            assertEquals(3, ui.count(button(Regex("Why, card \\d{2}"))))
            for (card in missed) ui.waitFor(button("Why, card %02d".format(card.number)))

            // "Why" opens the explanation and the source link of that card.
            val third = missed.first().card
            ui.tapScrolled(button("Why, card 03"))
            ui.waitForAny(label(plainText(third.text.en.explanation)))
            ui.waitFor(button("${third.source.title} (opens in browser)"))
            ui.waitFor(button("Play again"))
            ui.waitFor(button("Choose another route"))

            // Recorded once: the record of this route and class is the score.
            rule.waitUntil(WAIT_MS) { Device.progress().records[recordKey(CLF_SEC_ROUTE, Mode.CLASSIC)] == 7 }
            assertEquals(10, Device.progress().cards.size)
        }
    }
}
```

Run:

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.stories.ClassicRoundTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
```

Expected: `BUILD SUCCESSFUL` and `tests 1, failures 0, errors 0, skipped 0` (about 20 seconds of play). The story is expected to pass on the first run, because tasks 12 to 14 built what it plays; a failure is handled as Rule 5 says.

- [ ] **Step 9: The Recent path and the Continue line.**

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/stories/ReturningTest.kt`:

```kotlin
package com.eienmosu.truthy.stories

import android.os.SystemClock
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.support.CDL_ID
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.CONTINUE_CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.RESULT_MS
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.button
import com.eienmosu.truthy.support.label
import com.eienmosu.truthy.support.roundHeading
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ReturningTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    @Test fun recentDecksSkipThePlatformStepNewestFirst() {
        // History on one card of each deck, CDL seen last, as e2e/recent-decks.spec.ts stores it.
        val clf = DeckAnswers(CLF_ID).deck.cards.first().id
        val cdl = DeckAnswers(CDL_ID).deck.cards.first().id
        Device.storeProgress(
            """{"version":1,"cards":{"$clf":{"seen":1,"lastCorrect":true,"lastSeenAt":1000},""" +
                """"$cdl":{"seen":1,"lastCorrect":true,"lastSeenAt":1001}},"records":{},"last":null}""",
        )
        Device.launch().use {
            ui.atHome()
            ui.choose(Regex("Recent, 2 decks"))
            ui.atStep("Choose a deck")
            val cdlTop = ui.boundsDp(button(Regex("CDL, Cloud Digital Leader, \\d+ cards, .*"))).top
            val clfTop = ui.boundsDp(button(CLF_SECURITY.deck)).top
            assertTrue("the newest deck comes first", cdlTop < clfTop)

            ui.choose(CLF_SECURITY.deck)
            ui.atStep("Choose a section")
            // The deck filled in the area and the platform: the pass offers them as ways back.
            ui.waitFor(button("Change platform, now AWS"))
            ui.waitFor(button("Change area, now Cloud"))
            ui.choose(checkNotNull(CLF_SECURITY.section))
            ui.atStep("Choose how to play")
            ui.choose(CLF_SECURITY.mode)
            ui.atStep("Your pass is ready")
            ui.startRound()
            ui.waitFor(button("Leave round"))
            ui.waitFor(label(roundHeading("Classic")))
        }
    }

    @Test fun theContinueLineLeadsToTheReadyPassAndBackRetracesTheSteps() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            ui.playClassic(DeckAnswers(CLF_ID), wrongOn = setOf(2))
            ui.waitForResult()
            SystemClock.sleep(RESULT_MS)
            // Choose another route sits under the result's stage, outside every scroll: always on screen.
            ui.tap(button("Choose another route"))
            ui.atHome()

            ui.tap(button("$CONTINUE_CLF_SECURITY Last score 9 of 10."))
            ui.atStep("Your pass is ready")
            ui.waitFor(button("Change deck, now CLF"))
            ui.waitFor(button("Change section, now SEC"))
            ui.waitFor(button("Change class, now Classic"))

            // The whole path was pushed: Back retraces 5, 4, 3, 2 and 1.
            val back = listOf(
                "Back to classes" to "Choose how to play",
                "Back to sections" to "Choose a section",
                "Back to decks" to "Choose a deck",
                "Back to platforms" to "Choose a platform",
                "Back to areas" to "Choose an area",
            )
            for ((pill, title) in back) {
                ui.tap(button(pill))
                ui.atStep(title)
            }
        }
    }
}
```

Run:

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.stories.ReturningTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
```

Expected: `BUILD SUCCESSFUL` and `tests 2, failures 0, errors 0, skipped 0`.

- [ ] **Step 10: Leaving with and without answers.**

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/stories/LeaveTest.kt`:

```kotlin
package com.eienmosu.truthy.stories

import android.os.SystemClock
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.CLF_SEC_ROUTE
import com.eienmosu.truthy.support.CONTINUE_CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.LEAVE_IN_SHEET
import com.eienmosu.truthy.support.LEAVE_X
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.SHEET_TITLE
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.WAIT_MS
import com.eienmosu.truthy.support.button
import com.eienmosu.truthy.support.label
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LeaveTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    @Test fun leavingWithNoAnswersLeavesAtOnceAndSavesNothing() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            ui.cardOnScreen(DeckAnswers(CLF_ID))
            ui.tap(LEAVE_X)
            ui.atHome()
            assertFalse(ui.exists(SHEET_TITLE))
            assertFalse(ui.exists(label(Regex("Continue: .*"))))
            val progress = Device.progress()
            assertNull(progress.last)
            assertTrue(progress.cards.isEmpty())
            assertTrue(progress.records.isEmpty())
        }
    }

    @Test fun leavingWithAnswersKeepsThemAndOffersTheRouteWithoutAScore() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            val card = ui.cardOnScreen(DeckAnswers(CLF_ID))
            SystemClock.sleep(SETTLE_MS)
            ui.answer(card, right = true)
            ui.waitFor(button("Next card"))

            ui.tap(LEAVE_X)
            ui.waitFor(SHEET_TITLE)
            ui.waitFor(label("Your answers so far stay in your history. This round won't count toward your best."))
            ui.waitFor(button("Keep playing"))
            ui.tap(LEAVE_IN_SHEET)
            ui.atHome()
            ui.waitFor(button(CONTINUE_CLF_SECURITY))

            // Abandoned (spec 4.5): the answer is in the history, `last` has no score, no record is set.
            rule.waitUntil(WAIT_MS) { Device.progress().cards.containsKey(card.id) }
            val progress = Device.progress()
            assertEquals(CLF_SEC_ROUTE, progress.last?.route)
            assertEquals(Mode.CLASSIC, progress.last?.mode)
            assertNull(progress.last?.score)
            assertNull(progress.last?.total)
            assertTrue(progress.records.isEmpty())
        }
    }
}
```

Run:

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.stories.LeaveTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
```

Expected: `BUILD SUCCESSFUL` and `tests 2, failures 0, errors 0, skipped 0`.

- [ ] **Step 11: A Streak ending, Three lives running out, Timed running out, and the Timed pause.**

The round's header is the one place every class states its progress in words (reference 4.5, "Header labels"), so these stories read it instead of the stub, which is hidden from screen readers. The strings are the web's `streakLabel`, `livesLabel`, `timedLabel` and `resultCopy` outputs for these moves (the same cases as `e2e/streak.spec.ts`, `lives.spec.ts` and `timed.spec.ts`).

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/stories/ModesTest.kt`:

```kotlin
package com.eienmosu.truthy.stories

import android.os.SystemClock
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.recordKey
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.CLF_SEC_ROUTE
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.WAIT_MS
import com.eienmosu.truthy.support.inClass
import com.eienmosu.truthy.support.label
import com.eienmosu.truthy.support.roundHeading
import androidx.test.uiautomator.UiDevice
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ModesTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)
    private val deck by lazy { DeckAnswers(CLF_ID) }

    @Before fun firstLaunch() = Device.reset()

    private fun start(className: String) {
        ui.atHome()
        ui.chooseRoute(CLF_SECURITY.inClass(className))
        ui.startRound()
        ui.waitFor(label(roundHeading(className)))
    }

    // Spec section 2 (orientation not locked) and reference 7.2 item 10: a rotation recreates the activity
    // (configChanges holds only uiMode) and must not reset the round: the view models keep it.
    @Test fun rotatingMidRoundKeepsTheRound() {
        Device.launch().use {
            start("Classic")
            val card = ui.cardOnScreen(deck)
            SystemClock.sleep(SETTLE_MS)
            ui.answer(card, right = true)
            ui.waitFor(label(Regex("Card 1 of 10\\..*")))
            val device = UiDevice.getInstance(Device.instrumentation)
            try {
                device.setOrientationLeft()
                ui.idle()
                ui.waitFor(label(roundHeading("Classic")))
                ui.waitFor(label(Regex("Card 1 of 10\\..*")))
                ui.goOn(last = false)
                ui.waitFor(label(Regex("Card 2 of 10\\..*")))
            } finally {
                device.setOrientationNatural()
                device.unfreezeRotation()
            }
        }
    }

    @Test fun aStreakEndsOnTheFirstWrongAnswer() {
        Device.launch().use {
            start("Streak")
            ui.waitFor(label("Streak of 0 correct answers."))
            var previous: Card? = null
            for (number in 1..3) {
                val card = ui.cardOnScreen(deck, previous)
                SystemClock.sleep(SETTLE_MS)
                ui.answer(card, right = number < 3)
                if (number == 2) ui.waitFor(label("Streak of 2 correct answers."))
                if (number == 3) ui.waitFor(label("Streak ended at 2."))
                ui.goOn(last = number == 3)
                previous = card
            }
            ui.waitForResult()
            ui.waitFor(label("Streak over on card 3. 2 correct in a row. Card 3 was wrong."))
            rule.waitUntil(WAIT_MS) { Device.progress().records[recordKey(CLF_SEC_ROUTE, Mode.STREAK)] == 2 }
        }
    }

    @Test fun threeLivesEndOnTheThirdWrongAnswer() {
        Device.launch().use {
            start("Three lives")
            ui.waitFor(label("3 of 3 lives left. No cards answered yet."))
            val wrongOn = setOf(2, 4, 5)
            var previous: Card? = null
            for (number in 1..5) {
                val card = ui.cardOnScreen(deck, previous)
                SystemClock.sleep(SETTLE_MS)
                ui.answer(card, right = number !in wrongOn)
                if (number == 2) ui.waitFor(label("2 of 3 lives left. 2 cards answered, card 2 was wrong."))
                if (number == 4) ui.waitFor(label("1 of 3 lives left. 4 cards answered, cards 2 and 4 were wrong."))
                if (number == 5) ui.waitFor(label("No lives left. The round is over after 5 cards: cards 2, 4 and 5 were wrong."))
                ui.goOn(last = number == 5)
                previous = card
            }
            ui.waitForResult()
            ui.waitFor(label("Out of lives after 5 cards. 2 correct, 3 wrong: cards 2, 4 and 5."))
            rule.waitUntil(WAIT_MS) { Device.progress().records[recordKey(CLF_SEC_ROUTE, Mode.LIVES)] == 5 }
        }
    }

    @Test fun aTimedRoundEndsWhenTheMinuteIsOver() {
        Device.launch().use {
            start("Timed")
            ui.waitFor(label(Regex("\\d+ seconds? left of 60\\. 0 correct, 0 wrong\\.")))
            val first = ui.cardOnScreen(deck)
            SystemClock.sleep(SETTLE_MS)
            ui.answer(first, right = true)
            ui.waitFor(label(Regex("\\d+ seconds? left of 60\\. 1 correct, 0 wrong\\.")))
            // After the 700 ms hold the next card is dealt; the stub stayed and took the stamp.
            val second = ui.cardOnScreen(deck, first)
            SystemClock.sleep(SETTLE_MS)
            ui.answer(second, right = false)
            ui.waitFor(label(Regex("\\d+ seconds? left of 60\\. 1 correct, 1 wrong\\.")))

            // The rest of the minute runs out in real time.
            ui.waitFor(label("Time is up. 2 cards answered: 1 correct, 1 wrong."), timeoutMs = 70_000)
            ui.waitForAny(label("Closed"))
            ui.goOn(last = true)
            ui.waitForResult()
            ui.waitFor(label("Time is up. 2 cards answered in 60 seconds. 1 correct, 1 wrong: card 2."))
            rule.waitUntil(WAIT_MS) { Device.progress().records[recordKey(CLF_SEC_ROUTE, Mode.TIMED)] == 1 }
        }
    }

    @Test fun theTimedClockPausesOnlyWhileTheAppIsStopped() {
        Device.launch().use { scenario ->
            start("Timed")
            ui.cardOnScreen(deck)
            SystemClock.sleep(2_000)
            val before = ui.timedSecondsLeft()

            // ON_STOP sends visibility(hidden) to the engine; the minute does not run in the background.
            scenario.moveToState(Lifecycle.State.CREATED)
            SystemClock.sleep(5_000)
            scenario.moveToState(Lifecycle.State.RESUMED)
            ui.idle()
            val after = ui.timedSecondsLeft()
            assertTrue("the clock ran while the app was stopped: $before, then $after", before - after <= 1)

            SystemClock.sleep(3_000)
            val later = ui.timedSecondsLeft()
            assertTrue("the clock did not run again after ON_START: $after, then $later", after - later >= 2)
        }
    }
}
```

Run:

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.stories.ModesTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
```

Expected: `BUILD SUCCESSFUL` and `tests 5, failures 0, errors 0, skipped 0`, in about two minutes (one real Timed minute). If `rotatingMidRoundKeepsTheRound` fails after the rotation, round state lives in `remember` instead of task 11's view models: a defect of task 11 or 13 (rule 5).

- [ ] **Step 12: Back, by gesture and by key, on the start flow and on the round.**

These are the tests of Review Focus 1 that a machine can make. `scrub` feeds `PredictiveBackHandler` the progress the system gives it on API 34 and later; `Espresso.pressBackUnconditionally` is the back the system sends on API 33 and 26, with no progress, which must commit at once and leave every element at rest (spec 5.1). Step 22 runs this class on all four emulators. The round's shrink is spec 5.2's scale from 1 to 0.94 with the progress, pivot at the centre: at p = 0.5 the surface is 0.97 of its width with the same centre.

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/stories/BackTest.kt`:

```kotlin
package com.eienmosu.truthy.stories

import android.os.SystemClock
import androidx.activity.BackEventCompat
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.MainActivity
import com.eienmosu.truthy.support.ARRIVAL_MS
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.RESULT_MS
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.SHEET_TITLE
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.button
import com.eienmosu.truthy.support.inClass
import com.eienmosu.truthy.support.label
import com.eienmosu.truthy.support.roundHeading
import com.eienmosu.truthy.ui.TestTags
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs

@RunWith(AndroidJUnit4::class)
class BackTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    // ---------- a predictive back gesture, as the system feeds it on API 34 and later ----------

    private fun event(progress: Float) = BackEventCompat(8f, 1_000f, progress, BackEventCompat.EDGE_LEFT)

    private fun begin(scenario: ActivityScenario<MainActivity>) {
        scenario.onActivity { activity -> activity.onBackPressedDispatcher.dispatchOnBackStarted(event(0f)) }
        ui.idle()
    }

    private fun scrub(scenario: ActivityScenario<MainActivity>, progress: Float) {
        scenario.onActivity { activity -> activity.onBackPressedDispatcher.dispatchOnBackProgressed(event(progress)) }
        ui.idle()
    }

    private fun commit(scenario: ActivityScenario<MainActivity>) {
        scenario.onActivity { activity -> activity.onBackPressedDispatcher.onBackPressed() }
        ui.idle()
    }

    private fun cancel(scenario: ActivityScenario<MainActivity>) {
        scenario.onActivity { activity -> activity.onBackPressedDispatcher.dispatchOnBackCancelled() }
        ui.idle()
    }

    private fun assertAtRest(expected: Rect, actual: Rect, what: String) {
        val off = listOf(expected.left - actual.left, expected.top - actual.top, expected.width - actual.width, expected.height - actual.height)
        assertTrue("$what is not at rest: expected $expected, was $actual", off.all { abs(it) <= 0.5f })
    }

    // ---------- the start flow (spec 5.1) ----------

    @Test fun aScrubbedBackCommitsOneStepAndClearsItsChoice() {
        Device.launch().use { scenario ->
            ui.atHome()
            val homeTitle = ui.boundsDp(label("Choose an area"))
            ui.choose(CLF_SECURITY.area)
            ui.atStep("Choose a platform")
            ui.waitFor(button("Change area, now Cloud"))

            begin(scenario)
            for (p in listOf(0.2f, 0.5f, 0.8f)) scrub(scenario, p)
            // Mid-gesture nothing is decided: the step being left is still there.
            // The step being left is drawn but cleared from the merged tree while it leaves (task 12 StepPanel).
            assertTrue(ui.exists(label("Choose a platform"), unmerged = true))
            commit(scenario)

            ui.atStep("Choose an area")
            ui.waitGone(label("Choose a platform"))
            assertFalse("the area choice is cleared", ui.exists(hasTestTag(TestTags.PASS)))
            assertAtRest(homeTitle, ui.boundsDp(label("Choose an area")), "the step 1 title")
        }
    }

    @Test fun aCancelledBackChangesNothing() {
        Device.launch().use { scenario ->
            ui.atHome()
            ui.choose(CLF_SECURITY.area)
            ui.atStep("Choose a platform")
            val title = ui.boundsDp(label("Choose a platform"))
            val option = ui.boundsDp(button(CLF_SECURITY.platform))

            begin(scenario)
            scrub(scenario, 0.3f)
            scrub(scenario, 0.6f)
            cancel(scenario)

            ui.atStep("Choose a platform")
            assertFalse(ui.exists(label("Choose an area")))
            ui.waitFor(button("Change area, now Cloud"))
            assertAtRest(title, ui.boundsDp(label("Choose a platform")), "the step 2 title")
            assertAtRest(option, ui.boundsDp(button(CLF_SECURITY.platform)), "the AWS card")
        }
    }

    @Test fun theSystemBackKeyCommitsAtOnceWithEverythingAtRest() {
        Device.launch().use {
            ui.atHome()
            val homeTitle = ui.boundsDp(label("Choose an area"))
            ui.choose(CLF_SECURITY.area)
            ui.atStep("Choose a platform")
            val platformTitle = ui.boundsDp(label("Choose a platform"))
            ui.choose(CLF_SECURITY.platform)
            ui.atStep("Choose a deck")

            Espresso.pressBackUnconditionally()
            ui.atStep("Choose a platform")
            ui.waitGone(button("Change platform, now AWS"))
            ui.waitFor(button("Change area, now Cloud"))
            assertAtRest(platformTitle, ui.boundsDp(label("Choose a platform")), "the step 2 title")

            Espresso.pressBackUnconditionally()
            ui.atStep("Choose an area")
            assertFalse(ui.exists(hasTestTag(TestTags.PASS)))
            assertAtRest(homeTitle, ui.boundsDp(label("Choose an area")), "the step 1 title")
        }
    }

    @Test fun backOnStepOneGoesToTheSystem() {
        Device.launch().use { scenario ->
            ui.atHome()
            Espresso.pressBackUnconditionally()
            // API 31 and later move a root activity to the back; older versions finish it.
            rule.waitUntil(3_000) { scenario.state != Lifecycle.State.RESUMED }
        }
    }

    @Test fun backDuringTheUnrollIsConsumed() {
        Device.launch().use { scenario ->
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            rule.mainClock.autoAdvance = false
            ui.tap(button("Start round"), idle = false)
            // The 360 ms unroll has started and is held by the test clock: this back arrives during it.
            scenario.onActivity { activity -> activity.onBackPressedDispatcher.onBackPressed() }
            rule.mainClock.autoAdvance = true
            ui.waitFor(label(roundHeading("Classic")))
            assertFalse(ui.exists(label("Choose how to play")))
        }
    }

    // ---------- the round (spec 5.2, feel item N13) ----------

    @Test fun backOnTheRoundShrinksTheSurfaceAndLeavesWithNoAnswers() {
        Device.launch().use { scenario ->
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            ui.cardOnScreen(DeckAnswers(CLF_ID))
            ui.idle()
            val surface = hasTestTag(TestTags.ROUND_SURFACE)
            val rest = ui.boundsDp(surface)

            begin(scenario)
            scrub(scenario, 0.5f)
            val half = ui.boundsDp(surface)
            assertEquals(rest.width * 0.97f, half.width, 1f)
            assertEquals(rest.center.x, half.center.x, 1f)
            assertEquals(rest.center.y, half.center.y, 1f)
            cancel(scenario)
            assertAtRest(rest, ui.boundsDp(surface), "the round surface")
            ui.waitFor(button("True"))

            begin(scenario)
            scrub(scenario, 0.8f)
            commit(scenario)
            ui.atHome()
        }
    }

    @Test fun backOnTheRoundWithAnswersOpensTheSheetAndBackKeepsPlaying() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            val card = ui.cardOnScreen(DeckAnswers(CLF_ID))
            SystemClock.sleep(SETTLE_MS)
            ui.answer(card, right = true)
            ui.waitFor(button("Next card"))

            Espresso.pressBackUnconditionally()
            ui.waitFor(SHEET_TITLE)
            Espresso.pressBackUnconditionally()
            ui.waitGone(SHEET_TITLE)
            ui.waitFor(button("Next card"))
        }
    }

    @Test fun backOnTheResultWaitsForItsGuardThenClosesIt() {
        Device.launch().use { scenario ->
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY.inClass("Streak"))
            ui.startRound()
            val card = ui.cardOnScreen(DeckAnswers(CLF_ID))
            SystemClock.sleep(SETTLE_MS)
            ui.answer(card, right = false)
            val see = button("See results")
            ui.waitFor(see)
            SystemClock.sleep(ARRIVAL_MS)

            val tappedAt = SystemClock.uptimeMillis()
            ui.tap(see, idle = false)
            ui.waitFor(label("Round complete"))
            scenario.onActivity { activity -> activity.onBackPressedDispatcher.onBackPressed() }
            val early = SystemClock.uptimeMillis() - tappedAt
            assumeTrue("back came $early ms after See results: too late to test the 1000 ms guard", early < 900)
            ui.idle()
            assertTrue("back closed the result before its 1000 ms", ui.exists(label("Round complete")))

            SystemClock.sleep(RESULT_MS)
            Espresso.pressBackUnconditionally()
            ui.atHome()
        }
    }
}
```

Run:

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.stories.BackTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
```

Expected: `BUILD SUCCESSFUL` and `tests 8, failures 0, errors 0, skipped 0`. A `skipped 1` is the result guard test finding the emulator too slow to press back within 900 ms of See results; run the class again, and if it is skipped twice, note it in the report (the checklist's F6 checks the guard by hand). A failed width at p = 0.5 means the round's shrink does not follow the progress linearly (spec 5.2); fix it in task 14.

- [ ] **Step 13: The theme switch, and the stored theme opposite to the system theme.**

The second and third tests are Review Focus 3 and the machine half of feel item N12: after a relaunch with a stored theme opposite to the system's, the bar icons follow the stored theme, the app draws the stored theme's sky, and on API 31 and later the app's configuration is in the stored mode, which is what the splash of the next cold start uses. Below API 27 the light navigation bar flag does not exist, so it is checked from 27.

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/stories/ThemeTest.kt`:

```kotlin
package com.eienmosu.truthy.stories

import android.content.res.Configuration
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.core.view.WindowCompat
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.MainActivity
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.Colours
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.button
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ThemeTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() {
        Device.systemNight(false)
        Device.reset()
    }

    @After fun systemBackToDay() = Device.systemNight(false)

    private val toDark = button("Switch to dark theme")
    private val toLight = button("Switch to light theme")

    @Test fun theSwitchFlipsTheVisibleThemeOnEveryStepAndIsKept() {
        Device.launch().use {
            ui.atHome()
            ui.tap(toDark)
            ui.waitFor(toLight)
            assertEquals("dark", Device.storedTheme())
            ui.choose(CLF_SECURITY.area)
            ui.atStep("Choose a platform")
            ui.waitFor(toLight)
        }
        Device.launch().use {
            ui.atHome()
            ui.waitFor(toLight)
        }
    }

    @Test fun aStoredLightThemeWinsOverTheSystemDarkTheme() {
        assumeTrue("Android has a system dark theme from API 29", Device.sdk >= 29)
        Device.systemNight(true)
        Device.launch().use {
            ui.atHome()
            ui.tap(toLight)
            ui.waitFor(toDark)
            assertEquals("light", Device.storedTheme())
        }
        Device.launch().use { scenario ->
            ui.atHome()
            ui.waitFor(toDark)
            assertDrawnIn(scenario, light = true)
        }
    }

    @Test fun aStoredDarkThemeWinsOverTheSystemLightTheme() {
        Device.launch().use {
            ui.atHome()
            ui.tap(toDark)
            ui.waitFor(toLight)
        }
        Device.launch().use { scenario ->
            ui.atHome()
            ui.waitFor(toLight)
            assertDrawnIn(scenario, light = false)
        }
    }

    private fun assertDrawnIn(scenario: ActivityScenario<MainActivity>, light: Boolean) {
        scenario.onActivity { activity ->
            val bars = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            assertEquals("dark status bar icons on a light theme", light, bars.isAppearanceLightStatusBars)
            if (Device.sdk >= 27) assertEquals("dark navigation bar icons on a light theme", light, bars.isAppearanceLightNavigationBars)
            if (Device.sdk >= 31) {
                val night = activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
                assertEquals(if (light) Configuration.UI_MODE_NIGHT_NO else Configuration.UI_MODE_NIGHT_YES, night)
            }
        }
        ui.idle()
        // The sky at 4 dp from the left edge, 300 dp down: nothing else is drawn there on step 1.
        val shot = Device.screenshot()
        val y = (300 * Device.density).toInt()
        val expected = Colours.skyAt(if (light) Tokens.Colors.day else Tokens.Colors.night, y / shot.height.toFloat())
        val actual = shot.getPixel((4 * Device.density).toInt(), y)
        assertTrue("the sky is ${Colours.hex(actual)}, the stored theme's is ${Colours.hex(expected)}", Colours.close(actual, expected))
    }
}
```

Run:

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.stories.ThemeTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
```

Expected: `BUILD SUCCESSFUL` and `tests 3, failures 0, errors 0, skipped 0` on API 36 (on API 26, step 22 expects the second test skipped).

- [ ] **Step 14: A source link opens in the in-app browser.**

Feel item N11. Custom Tabs open as an `ACTION_VIEW` intent that carries the Custom Tabs session extra (the AndroidX builder always puts it, with a null session when there is none). Espresso-Intents records the intent and answers it, so no browser has to be installed on the emulator for this test.

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/stories/SourceLinkTest.kt`:

```kotlin
package com.eienmosu.truthy.stories

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.espresso.intent.Intents
import androidx.test.espresso.intent.Intents.intended
import androidx.test.espresso.intent.Intents.intending
import androidx.test.espresso.intent.matcher.IntentMatchers.hasAction
import androidx.test.espresso.intent.matcher.IntentMatchers.hasData
import androidx.test.espresso.intent.matcher.IntentMatchers.hasExtraWithKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.button
import org.hamcrest.Matchers.allOf
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SourceLinkTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun setUp() {
        Device.reset()
        Intents.init()
        intending(hasAction(Intent.ACTION_VIEW)).respondWith(Instrumentation.ActivityResult(Activity.RESULT_OK, null))
    }

    @After fun tearDown() = Intents.release()

    @Test fun theSourceLinkOfTheSlipOpensACustomTab() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            val card = ui.cardOnScreen(DeckAnswers(CLF_ID))
            SystemClock.sleep(SETTLE_MS)
            ui.answer(card, right = true)
            ui.waitFor(button("Next card"))

            ui.tapScrolled(button("${card.source.title} (opens in browser)"))
            intended(
                allOf(
                    hasAction(Intent.ACTION_VIEW),
                    hasData(Uri.parse(card.source.url)),
                    hasExtraWithKey(CustomTabsIntent.EXTRA_SESSION),
                ),
            )
        }
    }
}
```

Run:

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.stories.SourceLinkTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
```

Expected: `BUILD SUCCESSFUL` and `tests 1, failures 0, errors 0, skipped 0`.

- [ ] **Step 15: The hardware keyboard keys.**

Spec section 2: the arrows answer, Return is the action after an answer, Escape is the X on the round (Keep playing while the sheet is open) and one step back in the start flow (consumed on step 1), and a held key acts once. The header label tells how many answers the round has, so a held arrow that answered twice would show.

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/stories/KeyboardTest.kt`:

```kotlin
package com.eienmosu.truthy.stories

import android.os.SystemClock
import android.view.KeyEvent
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.support.ARRIVAL_MS
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.Keys
import com.eienmosu.truthy.support.LEAVE_IN_SHEET
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.SHEET_TITLE
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.label
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KeyboardTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    private fun verdict(correct: Boolean) = if (correct) "correct" else "wrong"

    @Test fun theArrowsAnswerReturnGoesOnAndEscapeIsTheX() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            val deck = DeckAnswers(CLF_ID)

            val first = ui.cardOnScreen(deck)
            SystemClock.sleep(SETTLE_MS)
            Keys.hold(KeyEvent.KEYCODE_DPAD_RIGHT, repeats = 4)
            ui.waitFor(label("Card 1 of 10. Card 1 ${verdict(first.answer)}."))

            SystemClock.sleep(ARRIVAL_MS)
            Keys.press(KeyEvent.KEYCODE_ENTER)
            val second = ui.cardOnScreen(deck, first)
            ui.waitFor(label(Regex("Card 2 of 10\\..*")))
            SystemClock.sleep(SETTLE_MS)
            Keys.press(KeyEvent.KEYCODE_DPAD_LEFT)
            val firstRight = first.answer
            val secondRight = !second.answer
            val tally = when {
                firstRight && secondRight -> "Cards 1 and 2 correct."
                !firstRight && !secondRight -> "Cards 1 and 2 wrong."
                firstRight -> "Card 1 correct, card 2 wrong."
                else -> "Card 2 correct, card 1 wrong."
            }
            ui.waitFor(label("Card 2 of 10. $tally"))

            Keys.press(KeyEvent.KEYCODE_ESCAPE)
            ui.waitFor(SHEET_TITLE)
            Keys.press(KeyEvent.KEYCODE_ESCAPE)
            ui.waitGone(SHEET_TITLE)
            Keys.press(KeyEvent.KEYCODE_ESCAPE)
            ui.waitFor(SHEET_TITLE)
            ui.tap(LEAVE_IN_SHEET)
            ui.atHome()
        }
    }

    @Test fun escapeGoesBackOneStepAndIsConsumedOnStepOne() {
        Device.launch().use { scenario ->
            ui.atHome()
            Keys.press(KeyEvent.KEYCODE_ESCAPE)
            ui.idle()
            SystemClock.sleep(SETTLE_MS)
            assertEquals(Lifecycle.State.RESUMED, scenario.state)
            ui.atHome()

            ui.choose(CLF_SECURITY.area)
            ui.atStep("Choose a platform")
            ui.choose(CLF_SECURITY.platform)
            ui.atStep("Choose a deck")
            // A held Escape acts once: one step back, not two.
            Keys.hold(KeyEvent.KEYCODE_ESCAPE, repeats = 3)
            ui.atStep("Choose a platform")
            Keys.press(KeyEvent.KEYCODE_ESCAPE)
            ui.atStep("Choose an area")
        }
    }
}
```

The flight path's tally names the correct cards first, then the wrong ones (`flightPathLabel` in `components/FlightPath.tsx`), which is why the mixed cases read "Card 1 correct, card 2 wrong." and "Card 2 correct, card 1 wrong.".

Run:

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.stories.KeyboardTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
```

Expected: `BUILD SUCCESSFUL` and `tests 2, failures 0, errors 0, skipped 0`.

- [ ] **Step 16: Commit the stories.**

```bash
git add android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/stories
git commit -m "test: add the Android UI test stories of spec 7.3"
```

- [ ] **Step 17: The card under the finger and the long press (feel items N4 and N8).**

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/feel/FingerTest.kt`:

```kotlin
package com.eienmosu.truthy.feel

import android.os.SystemClock
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.eienmosu.truthy.round.CardDragOffset
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.Finger
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.button
import com.eienmosu.truthy.ui.TestTags
import java.util.regex.Pattern
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FingerTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)
    private val card = hasTestTag(TestTags.CARD)

    @Before fun firstLaunch() = Device.reset()

    private fun roundAtCardOne() {
        ui.atHome()
        ui.chooseRoute(CLF_SECURITY)
        ui.startRound()
        ui.cardOnScreen(DeckAnswers(CLF_ID))
        ui.idle()
        SystemClock.sleep(SETTLE_MS)
    }

    @Test fun theCardFollowsTheFingerWithinOneDp() {
        Device.launch().use {
            roundAtCardOne()
            val d = Device.density
            // The card's drawn offset in dp, from the drag area (task 13's CardDragOffset): the rotated card's bounding
            // box runs past the window's right edge, and boundsInWindow is clipped to the window, so its centre lags.
            fun drawn(): Float = ui.node(hasTestTag("swipe-card")).config[CardDragOffset] * d
            val from = ui.centre(card)
            val down = Finger.press(from)
            SystemClock.sleep(16)
            Finger.moveTo(down, from + Offset(12 * d, 0f)) // past the touch slop: the drag has begun
            ui.idle()
            for (sample in 1..10) {
                SystemClock.sleep(16)
                val travel = (12 + 5 * sample) * d // ends at 62 dp, short of the 90 commit line
                Finger.moveTo(down, from + Offset(travel, 0f))
                ui.idle()
                val offset = drawn()
                assertEquals("sample $sample: the card is not under the finger", travel, offset, d)
            }
            // Back to the touch-down point and up: dx is 0, interpret cancels, the card springs home unanswered.
            Finger.moveTo(down, from)
            Finger.release(down, from)
            ui.idle()
            ui.waitFor(button("True"))
            assertFalse(ui.exists(button("Next card")))
        }
    }

    @Test fun aLongPressSelectsNothingAndOpensNoMenu() {
        Device.launch().use {
            roundAtCardOne()
            val at = ui.centre(card)
            val down = Finger.press(at)
            SystemClock.sleep(1_000)
            Finger.release(down, at)
            ui.idle()
            val device = UiDevice.getInstance(Device.instrumentation)
            assertFalse("a text menu opened", device.hasObject(By.text(Pattern.compile("(?i)(copy|select all|share|paste)"))))
            ui.waitFor(button("True"))
            assertFalse(ui.exists(button("Next card")))
        }
    }
}
```

Run:

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.feel.FingerTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
```

Expected: `BUILD SUCCESSFUL` and `tests 2, failures 0, errors 0, skipped 0`. A sample off by more than 1 dp means the drawn offset (task 13's `CardDragOffset`, the offset the card is drawn at) is not "current x minus touch-down x, slop included" (spec 5.3); fix it in task 13. The test reads that offset rather than the card's window bounds: the rotated card's bounding box runs past the window's right edge, and window bounds are clipped there.

- [ ] **Step 18: The leave sheet (feel item N7).**

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/feel/LeaveSheetTest.kt`:

```kotlin
package com.eienmosu.truthy.feel

import android.os.SystemClock
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.Finger
import com.eienmosu.truthy.support.LEAVE_X
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.SHEET_TITLE
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.button
import com.eienmosu.truthy.support.inClass
import com.eienmosu.truthy.support.label
import com.eienmosu.truthy.ui.TestTags
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LeaveSheetTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)
    private val deck by lazy { DeckAnswers(CLF_ID) }
    private val sheetCard = hasTestTag(TestTags.SHEET_CARD)

    @Before fun firstLaunch() = Device.reset()

    /** A round with card 1 answered right, so the X opens the sheet instead of leaving. */
    private fun answerCardOne(className: String = "Classic") {
        ui.atHome()
        ui.chooseRoute(if (className == "Classic") CLF_SECURITY else CLF_SECURITY.inClass(className))
        ui.startRound()
        val card = ui.cardOnScreen(deck)
        SystemClock.sleep(SETTLE_MS)
        ui.answer(card, right = true)
    }

    private fun openSheet() {
        ui.tap(LEAVE_X)
        ui.waitFor(SHEET_TITLE)
        ui.idle()
    }

    @Test fun aDoubleTapOnTheXLeavesTheSheetOpen() {
        Device.launch().use {
            answerCardOne()
            ui.waitFor(button("Next card"))
            val x = ui.centre(LEAVE_X)
            Finger.tap(x)
            SystemClock.sleep(80)
            // Lands on the X again: 80 ms after the first tap the sheet's window is not up yet. Task 11's requestLeave
            // takes it as the web's tap on the scrim that covers the X, within the sheet's first 250 ms.
            Finger.tap(x)
            ui.idle()
            SystemClock.sleep(600)
            ui.idle()
            assertTrue("the second tap of a double tap closed the sheet", ui.exists(SHEET_TITLE))
        }
    }

    @Test fun swipingTheSheetDownKeepsPlaying() {
        Device.launch().use {
            answerCardOne()
            ui.waitFor(button("Next card"))
            openSheet()
            val from = ui.centre(sheetCard)
            Finger.drag(from, from + Offset(0f, 300 * Device.density), steps = 15, stepMs = 16)
            ui.waitGone(SHEET_TITLE)
            ui.waitFor(button("Next card"))
        }
    }

    @Test fun aTapOnTheScrimKeepsPlaying() {
        Device.launch().use {
            answerCardOne()
            ui.waitFor(button("Next card"))
            openSheet()
            SystemClock.sleep(400) // past the scrim's 250 ms guard
            val top = ui.node(sheetCard).positionOnScreen.y
            Finger.tap(Offset(Device.app.resources.displayMetrics.widthPixels / 2f, top / 2f))
            ui.waitGone(SHEET_TITLE)
            ui.waitFor(button("Next card"))
        }
    }

    @Test fun backOnTheSheetKeepsPlaying() {
        Device.launch().use {
            answerCardOne()
            ui.waitFor(button("Next card"))
            openSheet()
            Espresso.pressBackUnconditionally()
            ui.waitGone(SHEET_TITLE)
            ui.waitFor(button("Next card"))
        }
    }

    @Test fun theTimedClockKeepsRunningUnderTheSheet() {
        Device.launch().use {
            answerCardOne("Timed")
            ui.waitFor(label(Regex("\\d+ seconds? left of 60\\. 1 correct, 0 wrong\\.")))
            openSheet()
            val before = ui.timedSecondsLeft()
            SystemClock.sleep(3_000)
            val during = ui.timedSecondsLeft()
            assertTrue("the clock stopped under the sheet: $before, then $during", before - during >= 2)
            ui.tap(button("Keep playing"))
            ui.waitGone(SHEET_TITLE)
        }
    }
}
```

Run:

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.feel.LeaveSheetTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
```

Expected: `BUILD SUCCESSFUL` and `tests 5, failures 0, errors 0, skipped 0`. Spec 5.4 decides what a failure of `aDoubleTapOnTheXLeavesTheSheetOpen` means: the sheet closes on the second tap, so `RoundHost.scrimTapAccepted` in task 14 returns `coordinator?.scrimTapAccepted() ?: true` (the guard task 11 already tests); run this test again and record under N7 (item F11) that the guard was needed. When it passes as written, record under N7 that the sheet's scrim needed no guard (the X's own 250 ms rule of task 11 holds the second tap).

- [ ] **Step 19: Nothing clips at font scale 2.0 with animations off (Review Focus 4, feel item N9).**

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/feel/NoClipTest.kt`:

```kotlin
package com.eienmosu.truthy.feel

import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.REVIEW_SEED
import com.eienmosu.truthy.support.ScreenWalk
import com.eienmosu.truthy.support.Ui
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Runs only at font scale 2.0 (this step and step 22 set it); at other scales it is skipped. */
@RunWith(AndroidJUnit4::class)
class NoClipTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Test fun nothingClipsAtTheLargestFontScale() {
        val scale = Device.app.resources.configuration.fontScale
        assumeTrue("run at font_scale 2.0; the scale is $scale", scale >= 1.99f)
        Device.reset()
        val problems = mutableListOf<String>()
        Device.launch(seed = REVIEW_SEED).use {
            ScreenWalk(ui).run { screen -> problems += ui.clippedTexts().map { "$screen: $it" } }
        }
        assertTrue(problems.joinToString("\n"), problems.isEmpty())
    }
}
```

Run it at the default scale first, then at 2.0 with every animation scale at 0 (`adb` is `$ANDROID_HOME/platform-tools/adb`; put that folder on `PATH` if it is not):

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.feel.NoClipTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
adb shell settings put system font_scale 2.0
for scale in window_animation_scale transition_animation_scale animator_duration_scale; do adb shell settings put global "$scale" 0; done
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.feel.NoClipTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
adb shell settings put system font_scale 1.0
for scale in window_animation_scale transition_animation_scale animator_duration_scale; do adb shell settings put global "$scale" 1; done
```

Expected: first `tests 1, failures 0, errors 0, skipped 1`, then `BUILD SUCCESSFUL` and `tests 1, failures 0, errors 0, skipped 0` (the walk takes about three minutes: it runs one real Timed minute). A failure lists each clipped text with its state (the twenty of rule 6, `s1` to `s3-recent`); each is a fixed height that is not a minimum, or a `maxLines` that cuts, in the task that draws that screen (spec 5.6: text grows or scrolls and never clips). The walk also proves that every screen is reachable and works with animations ending at once.

- [ ] **Step 20: Commit the feel tests.**

```bash
git add android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/feel
git commit -m "test: add the Android feel checks for the finger, the leave sheet and large text"
```

- [ ] **Step 21: Run the whole suite on API 36.**

```bash
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
```

Expected: `BUILD SUCCESSFUL` and `tests 105, failures 0, errors 0, skipped 1` (NoClipTest at font scale 1.0), in about seven minutes. `connectedDebugAndroidTest` runs every instrumented test of the app: this task's 34 and the 71 of tasks 7 (5), 10 (9), 12 (10), 13 (17) and 14 (30). If an earlier task's count changed when it was executed, add the difference. Two runs in a row must both pass; a test that fails once in two runs is flaky, and its wait is fixed before going on (a guard slept too short, or a wait on a label that exists twice).

- [ ] **Step 22: Run the suite on API 34, 33 and 26 (Review Focus 1).**

For each API level in turn (one emulator at a time):

```bash
android/Tools/emulators.sh stop
android/Tools/emulators.sh start 34
cd android/Truthy
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
adb shell settings put system font_scale 2.0
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.feel.NoClipTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
adb shell settings put system font_scale 1.0
cd ../..
```

then the same with `start 33` and `start 26`, and finally `android/Tools/emulators.sh stop` and `android/Tools/emulators.sh start 36` for the rest of the task.

Expected on API 34 and 33: `tests 105, failures 0, errors 0, skipped 1`, then `tests 1, failures 0, errors 0, skipped 0`. On API 26: `tests 105, failures 0, errors 0, skipped 2` (also `aStoredLightThemeWinsOverTheSystemDarkTheme`: API 26 has no system dark theme), then `tests 1, failures 0, errors 0, skipped 0`. `BackTest` passing on all four is the machine half of Review Focus 1: on 33 and 26 the system back key arrives with no progress and commits at once with every element at rest; on all four, the progress events reach `PredictiveBackHandler` and a cancel changes nothing. The recordings of step 34 add what the system gesture itself does on each level. Write down the four summaries for the checklist (F3, F4, F8, F11, F13, F17).

- [ ] **Step 23: Write the checklist checker's tests.**

`android/Tools/feel/checklist.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { openIssues, parseChecklist, structureProblems, summarise } from "./checklist.mjs";

const item = (id, result, extra = "Do: x\nExpect: y\n") => `#### ${id}. Title ${id}\n${extra}Result: ${result}\n\n`;
const pass = "PASS (API 36, truthy-api36, build abc1234, 2026-10-20, f1-api36.mp4)";

test("items are read with their id, title, status and detail", () => {
  const items = parseChecklist(item("F1", pass) + item("F2", "PENDING"));
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    id: "F1",
    title: "Title F1",
    status: "PASS",
    detail: "API 36, truthy-api36, build abc1234, 2026-10-20, f1-api36.mp4",
    hasDo: true,
    hasExpect: true,
  });
  assert.equal(items[1].status, "PENDING");
  assert.equal(items[1].detail, "");
});

test("structure: ids run F1, F2, ... without gaps, every item has Do, Expect and a known Result", () => {
  assert.deepEqual(structureProblems(parseChecklist(item("F1", "PENDING") + item("F2", "PENDING"))), []);
  const broken = parseChecklist(item("F1", "PENDING") + item("F3", "MAYBE") + "#### F4. No result\nDo: x\nExpect: y\n");
  const problems = structureProblems(broken);
  assert.ok(problems.some((p) => p.startsWith("F3: expected id F2")));
  assert.ok(problems.some((p) => p.startsWith("F3: unknown status MAYBE")));
  assert.ok(problems.some((p) => p.startsWith("F4: no Result line")));
  assert.ok(structureProblems(parseChecklist(item("F1", "PENDING", "Do: x\n"))).some((p) => p.startsWith("F1: no Expect line")));
});

test("done gate: pending and failed items block, a pass names the API level and the date, a skip its reason", () => {
  assert.deepEqual(openIssues(parseChecklist(item("F1", pass) + item("F2", "SKIP (no Android phone; emulators do not vibrate)"))), []);
  const issues = openIssues(
    parseChecklist(item("F1", "PENDING") + item("F2", "FAIL (the card jumps on release)") + item("F3", "PASS") + item("F4", "PASS (looked fine)") + item("F5", "SKIP")),
  );
  assert.deepEqual(issues, [
    "F1: still pending",
    "F2: failed (the card jumps on release)",
    "F3: a PASS needs (API level, emulator or phone, build, date)",
    "F4: a PASS needs (API level, emulator or phone, build, date)",
    "F5: a SKIP needs a reason in parentheses",
  ]);
});

test("the summary counts each status", () => {
  const items = parseChecklist(item("F1", "PENDING") + item("F2", "PENDING") + item("F3", "FAIL (x)"));
  assert.deepEqual(summarise(items), { PENDING: 2, PASS: 0, FAIL: 1, SKIP: 0 });
});

test("the committed checklist is well formed and every item names where it is checked", () => {
  const items = parseChecklist(readFileSync(new URL("./FEEL-CHECKLIST.md", import.meta.url), "utf8"));
  assert.ok(items.length >= 23);
  assert.deepEqual(structureProblems(items), []);
  for (const entry of items) assert.match(entry.title, /API (36|34|33|26)|phone/, `${entry.id} names no API level`);
});
```

Run `node --test --test-reporter=spec android/Tools/feel/checklist.test.mjs 2>&1 | grep -E 'Cannot find module|ℹ (pass|fail)'`. Expected: a `Cannot find module` line naming `checklist.mjs`, `ℹ pass 0`, `ℹ fail 1`.

- [ ] **Step 24: Write the checklist checker.**

`android/Tools/feel/checklist.mjs`:

```js
// Reads FEEL-CHECKLIST.md: every item is a "#### F<n>. Title" heading followed by Do, Expect and Result lines.
//   node checklist.mjs <FEEL-CHECKLIST.md>          prints the counts, exits 1 when the file is malformed
//   node checklist.mjs <FEEL-CHECKLIST.md> --done   also exits 1 while an item is pending, failed or recorded without its details
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const STATUSES = ["PENDING", "PASS", "FAIL", "SKIP"];

export function parseChecklist(text) {
  const items = [];
  let current = null;
  for (const line of text.split("\n")) {
    const head = /^#### (F\d+)\. (.+)$/.exec(line);
    if (head) {
      current = { id: head[1], title: head[2], status: null, detail: "", hasDo: false, hasExpect: false };
      items.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("Do: ")) current.hasDo = true;
    else if (line.startsWith("Expect: ")) current.hasExpect = true;
    else if (current.status === null) {
      const result = /^Result: (\S+)(?: \((.*)\))?\s*$/.exec(line);
      if (result) {
        current.status = result[1];
        current.detail = result[2] ?? "";
      }
    }
  }
  return items;
}

export function structureProblems(items) {
  const problems = [];
  items.forEach((item, index) => {
    if (item.id !== `F${index + 1}`) problems.push(`${item.id}: expected id F${index + 1}`);
    if (!item.hasDo) problems.push(`${item.id}: no Do line`);
    if (!item.hasExpect) problems.push(`${item.id}: no Expect line`);
    if (item.status === null) problems.push(`${item.id}: no Result line`);
    else if (!STATUSES.includes(item.status)) problems.push(`${item.id}: unknown status ${item.status}`);
  });
  return problems;
}

export function openIssues(items) {
  const issues = [];
  for (const item of items) {
    if (item.status === "PENDING") issues.push(`${item.id}: still pending`);
    else if (item.status === "FAIL") issues.push(`${item.id}: failed (${item.detail})`);
    else if (item.status === "SKIP" && item.detail === "") issues.push(`${item.id}: a SKIP needs a reason in parentheses`);
    else if (item.status === "PASS" && !(/API \d+/.test(item.detail) && /\d{4}-\d{2}-\d{2}/.test(item.detail))) {
      issues.push(`${item.id}: a PASS needs (API level, emulator or phone, build, date)`);
    }
  }
  return issues;
}

export function summarise(items) {
  const counts = { PENDING: 0, PASS: 0, FAIL: 0, SKIP: 0 };
  for (const item of items) if (item.status in counts) counts[item.status] += 1;
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, flag] = process.argv.slice(2);
  const items = parseChecklist(readFileSync(file, "utf8"));
  const problems = structureProblems(items);
  const counts = summarise(items);
  console.log(`${items.length} items: ${STATUSES.map((s) => `${counts[s]} ${s}`).join(", ")}`);
  const blocking = flag === "--done" ? [...problems, ...openIssues(items)] : problems;
  for (const line of blocking) console.error(line);
  process.exit(blocking.length === 0 ? 0 : 1);
}
```

Run `node --test --test-reporter=spec android/Tools/feel/checklist.test.mjs 2>&1 | grep -E '✔|✖|ℹ (pass|fail)|ENOENT'`. Expected: four `✔` lines, one `✖ the committed checklist is well formed and every item names where it is checked` with an `ENOENT` error naming `FEEL-CHECKLIST.md`, `ℹ pass 4`, `ℹ fail 1`.

- [ ] **Step 25: Write the feel checklist.**

`android/Tools/feel/FEEL-CHECKLIST.md` (the executing agent and the owner edit only the `Result:` lines; the headings, `Do:` and `Expect:` lines are what `checklist.mjs` reads):

```markdown
# Android feel checklist

Spec 5.8, 7.5 and 7.6: every feel item, checked on the emulator its method needs and recorded with the API level, the emulator (or the phone), the build and the date. The tests named in an item are the classes of `android/Truthy/app/src/androidTest`; "green" means the last full run on that emulator (task 15, steps 21 and 22) reported it passing. Recordings and screenshots are kept in `$TMPDIR/truthy-feel/api<level>/`, never in the repository.

Each item ends with a `Result:` line. Replace `PENDING` with one of:

- `Result: PASS (API 36, truthy-api36, build 1a2b3c4, 2026-10-20, f1-api36.mp4)`: the API level, the emulator or the phone, the short commit hash of the build, the date, and the recording or screenshot when the item has one.
- `Result: FAIL (what was seen)`: then fix it in the task that owns the behaviour; the item stays FAIL until a later check passes.
- `Result: SKIP (why)`: only with a reason.

`node android/Tools/feel/checklist.mjs android/Tools/feel/FEEL-CHECKLIST.md --done` exits 0 when nothing is pending or failed.

Recording: `adb shell screenrecord --bit-rate 12000000 /sdcard/<name>.mp4` (stop with Ctrl+C, at most 180 seconds), then `adb pull /sdcard/<name>.mp4 "$TMPDIR/truthy-feel/api<level>/"`. A slow edge swipe with the finger held mid-way (API 30 and later, px on the 1080 by 2400 Pixel 8 screen): `adb shell input motionevent DOWN 3 1400`, then `adb shell input motionevent MOVE 150 1400` and `adb shell input motionevent MOVE 300 1400` with a pause between them, then `adb shell input motionevent UP 300 1400` to commit, or `adb shell input motionevent MOVE 3 1400` before `adb shell input motionevent UP 3 1400` to cancel.

#### F1. Predictive back scrubs the start flow, API 36
Do: on steps 2 to 6 and on the deck step of the Recent path, a slow edge swipe held at about a third and two thirds, then released; then the same swipe pulled back to the edge before release; record f1-api36.mp4.
Expect: feel item N1: the old step sinks and the new step's items come in from above with the finger; the cleared pass fields are dashes only after the release; a cancel springs back with every choice kept; BackTest green.
Result: PENDING

#### F2. Predictive back scrubs the start flow and the round, API 34
Do: F1 on truthy-api34, then the same swipe on a round with no answers (release), on a round with one answer (release), and a cancel on each; record f2-api34.mp4.
Expect: N1 on API 34; on the round the surface shrinks towards 0.94 with the finger, a release does what the X does (leaves, or opens the sheet), a cancel springs back; BackTest green on API 34.
Result: PENDING

#### F3. Back commits at once with the right final frame, API 33
Do: on truthy-api33, edge swipes on steps 2 to 6 and on a round with one answer; record f3-api33.mp4; step 22's summary for API 33.
Expect: no scrubbing; at the release the previous step appears at rest in one motion (or the sheet opens), the cleared fields are dashes, and no element is left half moved in the last frame; BackTest green on API 33.
Result: PENDING

#### F4. Back commits at once with the right final frame, API 26
Do: on truthy-api26 (three-button navigation), the Back button on steps 2 to 6 and on a round with one answer; record f4-api26.mp4; step 22's summary for API 26.
Expect: as F3; BackTest green on API 26.
Result: PENDING

#### F5. Back on step 1 plays the system back-to-home animation, API 36
Do: on step 1, a back swipe held mid-way, then released; record f5-api36.mp4.
Expect: feel item N2: the system's back-to-home preview follows the finger and the app goes to the background; BackTest backOnStepOneGoesToTheSystem green.
Result: PENDING

#### F6. Back on the round and on the result, API 36
Do: back on a round with no answers, on a round with answers, with the sheet open, and on the result once at once and once after a second; record f6-api36.mp4.
Expect: feel item N13: the surface shrinks and back acts like the X; with the sheet open back keeps playing; on the result back does nothing in the first second and then closes the results; BackTest green.
Result: PENDING

#### F7. Vertical, horizontal and diagonal drags on the ticket, API 36
Do: at font scale 2.0, on a card whose statement makes the ticket scroll, drag vertically, horizontally and at about 45 degrees with `adb shell input swipe`; record f7-api36.mp4; task 13's drag tests green.
Expect: feel item N3 and Review Focus 5: vertical scrolls the ticket with stretch overscroll at its ends, horizontal moves the card, a diagonal does one or the other and never both.
Result: PENDING

#### F8. The card follows the finger, API 36 and API 26
Do: FingerTest in step 22's summaries for API 36 and API 26.
Expect: feel item N4: the offset equals the finger's travel within 1 dp at 10 sampled frames on both.
Result: PENDING

#### F9. Release springs with the finger's velocity, and a touch catches a springing card, API 36
Do: in the emulator window, drag the card 60 dp and release fast, then slowly; then release and touch the card again while it springs back; record f9-api36.mp4. The owner watches the recording.
Expect: feel item N5: the card springs back from the release with the finger's speed, a committed swipe tears the stub and never throws the card, and a touch stops a springing card where it is, which then follows the finger from there.
Result: PENDING

#### F10. One haptic per crossing of the commit line, phone
Do: task 13's unit test of the trigger count green; on an Android phone, if the owner provides one, drag across the 90 line and back several times, answer right and wrong, and let a Timed minute run out.
Expect: feel item N6: one light tick per crossing and none while moving, a confirm on Correct, a reject on Not quite and at time up. Emulators do not vibrate: without a phone the result is SKIP with that reason.
Result: PENDING

#### F11. The leave sheet keeps playing, API 36 and API 26
Do: LeaveSheetTest in step 22's summaries for API 36 and API 26; on API 36 record a swipe down, a scrim tap, back, and a Timed round with the sheet open (f11-api36.mp4).
Expect: feel item N7: every way out but Leave round keeps playing, the Timed clock keeps counting under the sheet, a double tap on the X leaves the sheet open, and the sheet shows the web's paper card on a transparent container with no drag handle. The Result line also says whether step 18 needed the sheet's scrim guard (spec 5.4).
Result: PENDING

#### F12. No highlight, no selection menu, no focus ring after a tap, API 36
Do: FingerTest green; screenshots while a destination card, a pill and the X are held down and right after a tap (`adb exec-out screencap -p > "$TMPDIR/truthy-feel/api36/f12-held.png"` with the press held by `adb shell input motionevent DOWN`).
Expect: feel item N8: held controls scale as the web's press does with no ripple, except the bounded press tint on the pass fields and the Continue line; no selection or menu after a long press; no focus ring after a tap; after `adb shell input keyevent TAB` the focused control shows a 2 dp ink ring (task 10's `keyboardFocusRing`), and after a tap it does not.
Result: PENDING

#### F13. Nothing clips at font scale 2.0, API 36 and API 26
Do: NoClipTest green at font scale 2.0 on both (steps 19 and 22); look at every font200 capture of the visual review (`android/Tools/visual-review/out/android/font200-*.png`).
Expect: feel item N9 and Review Focus 4: no text cut, ellipsized or overlapping; lists and the ticket scroll; the leave sheet's card grows and scrolls when it does not fit.
Result: PENDING

#### F14. No white or mismatched frame at launch or between screens, API 36 and API 26
Do: record a cold start (`adb shell am force-stop com.eienmosu.truthy`, then `adb shell am start -n com.eienmosu.truthy/.MainActivity`) in day and in night, a round start and a leave, on both emulators (f14-api36.mp4, f14-api26.mp4); step through the recordings frame by frame.
Expect: feel item N10: the splash in the surface colour, then the app's first frame already in its theme; no white frame, no frame in the other theme, no blank frame between the start flow and the round.
Result: PENDING

#### F15. Source links open in the in-app browser, API 36
Do: SourceLinkTest green; tap a slip's source link on the emulator; record f15-api36.mp4.
Expect: feel item N11: a Custom Tab opens over the app with its toolbar in the app's theme colours, and its back returns to the round. If the image has no browser that supports Custom Tabs, the system browser opens: record which.
Result: PENDING

#### F16. Bars and splash follow the stored theme, API 36
Do: ThemeTest green; with the system dark and the stored theme light, then the opposite, a screenshot of step 1 and of a round, and a recorded cold start (f16-api36.mp4).
Expect: feel item N12 and Review Focus 3: the status and navigation bar icons are dark on the day theme and light on the night theme whatever the system says, the first frame is in the stored theme, and the splash (Android 12 and later) is in the stored theme too.
Result: PENDING

#### F17. Bars follow the stored theme and the splash follows the system, API 26
Do: ThemeTest in step 22's summary for API 26; with the stored theme dark, a screenshot of step 1 and a recorded cold start (f17-api26.mp4).
Expect: the app draws night with light status bar icons; the splash is the system's day surface colour (below Android 12 the splash follows the system), followed by the night app with no white frame.
Result: PENDING

#### F18. Reduced animations keep the web's fades, API 36
Do: set the three animation scales to 0 (`adb shell settings put global animator_duration_scale 0` and the window and transition scales); record answering a card, opening and closing the leave sheet, and a step forward and back (f18-api36.mp4); set the scales back to 1.
Expect: Review Focus 4 and reference 5.8: the slip fades in over about 140 ms, the sheet card fades in 140 ms over a 360 ms scrim, the step panel fades out and in; stamps, tear, jolt and name travel show at rest at once; the 250, 420 and 1000 ms guards are unchanged.
Result: PENDING

#### F19. The app killed in the middle of a round, API 36
Do: answer two cards of a Classic round, press Home, run `adb shell am kill com.eienmosu.truthy`, launch the app; then again with "Don't keep activities" on (`adb shell settings put global always_finish_activities 1`, and back to 0 afterwards).
Expect: Review Focus 2: the app opens at start step 1 with no choices, the Continue line offers the route without a score (the journal was applied as an abandoned round), and a second launch applies nothing again.
Result: PENDING

#### F20. The Timed clock pauses only in the background, API 36
Do: in a Timed round, pull the notification shade down for 5 seconds, then press Home for 10 seconds and come back; ModesTest green.
Expect: spec 5.6: the shade does not pause the clock; Home pauses it (the seconds left are the same on return), and it runs again at once.
Result: PENDING

#### F21. Overscroll follows the platform, API 36 and API 26
Do: drag past both ends of a long step list, of the ticket and of the result column on both emulators; record f21-api36.mp4 and f21-api26.mp4.
Expect: spec 5.6: stretch overscroll on API 36; on API 26 the edge glow in the ink colour (task 8's `TruthyTheme` provides it through `LocalOverscrollFactory`).
Result: PENDING

#### F22. A drag from the system gesture inset belongs to the system, API 36
Do: task 13's edge-drag test green; on a round with one answer, a drag that starts inside the left gesture inset and moves right (`adb shell input motionevent` from x 3); record f22-api36.mp4.
Expect: Review Focus 5 and spec 5.3: the system's back takes the drag (the round surface shrinks, the release opens the sheet), and the card never moves.
Result: PENDING

#### F23. TalkBack reads the start flow, the round and the result, API 36
Do: `emulators.sh` starts the emulator with `-no-audio`, so run `android/Tools/emulators.sh stop` and start the API 36 emulator with its sound and window: `"$ANDROID_HOME/emulator/emulator" -avd truthy-api36 -no-snapshot &`; turn TalkBack on (`adb shell settings put secure enabled_accessibility_services com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService` and `adb shell settings put secure accessibility_enabled 1`); swipe through step 1 and take the Classic path with double taps; on the round swipe through the header, answer one card with the True pill, open the leave sheet, close it, and play to the result; then a Timed round with one answer; record f23-api36.mp4 for the focus order (`screenrecord` records no sound: the owner listens live and the Result line names what was heard wrong, if anything); turn TalkBack off afterwards (`adb shell settings delete secure enabled_accessibility_services` and `adb shell settings put secure accessibility_enabled 0`), stop that emulator by its PID and run `android/Tools/emulators.sh start 36` again. The owner listens and gives the result.
Expect: spec 7.6 and risk 11 (reference 4.5 and 5.9): the round's heading is read as "{deck}, {section}: {class} round" and the Classic header once as one image with its full sentence, "Card N of M." and then which cards were correct and wrong (for example "Card 4 of 10. Cards 1 and 2 correct, card 3 wrong."; RoundScreenTest and FlightPathGoldenTest assert these labels); an answer is read once as "Correct. The answer is True." (or "Not quite. The answer is ..."), politely, after what TalkBack was reading, and not cut off by the sheet; nothing stale is read after the sheet closes; in Timed each new card is read as "Card N. {statement}"; the X reads "Leave round", a source link "{title} (opens in browser)"; no hidden node is read twice and focus never lands on an invisible element.
Result: PENDING
```

Run:

```bash
node --test --test-reporter=spec android/Tools/feel/checklist.test.mjs 2>&1 | grep -E '✔|✖|ℹ (pass|fail)'
node android/Tools/feel/checklist.mjs android/Tools/feel/FEEL-CHECKLIST.md
```

Expected: five `✔` lines, `ℹ pass 5`, `ℹ fail 0`; then `23 items: 23 PENDING, 0 PASS, 0 FAIL, 0 SKIP` with exit code 0.

Commit:

```bash
git add android/Tools/feel
git commit -m "test: add the Android feel checklist and its checker"
```

- [ ] **Step 26: Write the visual review's comparison tests.**

`android/Tools/visual-review/compare.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  close,
  colourFindings,
  expectedColour,
  frameFindings,
  hex,
  over,
  samplePoint,
  skyColour,
  skyStops,
  tokenColour,
  unapproved,
  withApprovals,
} from "./compare.mjs";
import { ELEMENTS, SCREENS } from "./screens.mjs";

// The DTCG shape of design/system/tokens.json: references between colour tokens, hex and an optional alpha.
const colour = (hexValue, alpha) => ({ $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 0], hex: hexValue, ...(alpha === undefined ? {} : { alpha }) } });
const ref = (path) => ({ $type: "color", $value: `{${path}}` });
const tokens = {
  color: {
    primitive: {
      black: colour("#000000"),
      grey: colour("#646464"),
      silver: colour("#c8c8c8"),
      white: colour("#ffffff"),
      navy: colour("#10233f", 0.32),
      amber: colour("#f5b400"),
    },
    day: {
      "sky-1": ref("color.primitive.black"),
      "sky-2": ref("color.primitive.grey"),
      middle: ref("color.primitive.silver"),
      "sky-3": ref("color.day.middle"),
      "sky-4": ref("color.primitive.white"),
      scrim: ref("color.primitive.navy"),
      accent: ref("color.primitive.amber"),
    },
  },
  native: { "sky-stops": [0, 0.35, 0.62, 1] },
};
const grey = (n) => ({ r: n, g: n, b: n, a: 1 });

test("a token colour follows its references to a hex value and an alpha", () => {
  assert.deepEqual(tokenColour(tokens, "color.day.sky-3"), grey(200));
  assert.deepEqual(tokenColour(tokens, "color.day.scrim"), { r: 16, g: 35, b: 63, a: 0.32 });
  assert.throws(() => tokenColour(tokens, "color.day.nope"), /no token color\.day\.nope/);
});

test("the sky mixes its four stops at 0, 35, 62 and 100 percent of the height", () => {
  assert.deepEqual(skyStops(tokens), [0, 0.35, 0.62, 1]);
  assert.throws(() => skyStops({}), /no native\.sky-stops/);
  const cases = [[0, 0], [0.175, 50], [0.35, 100], [0.62, 200], [0.81, 228], [1, 255], [-0.5, 0], [1.5, 255]];
  for (const [fraction, value] of cases) assert.deepEqual(skyColour(tokens, "day", fraction), grey(value), `at ${fraction}`);
});

test("the scrim is laid over the sky, and a role sample is the role's colour", () => {
  assert.deepEqual(over({ r: 16, g: 35, b: 63, a: 0.32 }, { r: 169, g: 214, b: 240, a: 1 }), { r: 120, g: 157, b: 183, a: 1 });
  assert.deepEqual(expectedColour(tokens, "day", { name: "sky-0", x: 4, y: 0, scrim: true }, 100), { r: 5, g: 11, b: 20, a: 1 });
  assert.deepEqual(expectedColour(tokens, "day", { name: "sky-50", x: 4, y: 17.5 }, 100), grey(50));
  assert.deepEqual(expectedColour(tokens, "day", { name: "band", element: "ticket", fx: 0.5, dy: 22, role: "accent" }, 100), {
    r: 245,
    g: 180,
    b: 0,
    a: 1,
  });
});

test("a sample point is fixed on the screen or placed inside its element", () => {
  assert.deepEqual(samplePoint({ x: 4, y: 120 }, {}), { x: 4, y: 120 });
  assert.deepEqual(samplePoint({ element: "ticket", fx: 0.5, dy: 22 }, { ticket: [10, 100, 380, 500] }), { x: 200, y: 122 });
  assert.deepEqual(samplePoint({ element: "sheet", dx: 8, dyBottom: 8 }, { sheet: [16, 600, 380, 200] }), { x: 24, y: 792 });
  assert.deepEqual(samplePoint({ element: "sheet", dx: 10, fy: 0.5 }, { sheet: [16, 600, 380, 200] }), { x: 26, y: 700 });
  assert.equal(samplePoint({ element: "sheet", dx: 8, dyBottom: 8 }, {}), null);
});

test("colours within 3 per channel are close, and are written as hex", () => {
  assert.equal(close({ r: 1, g: 2, b: 3 }, { r: 4, g: 5, b: 6 }), true);
  assert.equal(close({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 4 }), false);
  assert.equal(hex({ r: 10, g: 20, b: 255 }), "#0a14ff");
});

test("frames within 2 dp pass; a larger offset and a missing element are findings", () => {
  const android = { frames: { logo: [16, 36, 150, 30], pass: [16, 200, 380, 120], stub: [16, 500, 380, 228] } };
  const web = { frames: { logo: [17.5, 36, 150, 31], pass: [16, 203, 380, 120] } };
  assert.deepEqual(frameFindings("s2", "day", android, web, ["logo", "pass", "ticket", "stub"]), [
    { theme: "day", screen: "s2", kind: "frame", name: "pass", detail: "android 16, 200, 380, 120; web 16, 203, 380, 120; off by 3.0 dp" },
    { theme: "day", screen: "s2", kind: "missing-android", name: "ticket", detail: "not found on android" },
    { theme: "day", screen: "s2", kind: "missing-web", name: "stub", detail: "not found on the web" },
  ]);
});

test("a colour finding names the sample and both colours; a sample of a missing element is left to the frame check", () => {
  const sampled = [
    { name: "sky-120", expected: { r: 10, g: 20, b: 30, a: 1 }, actual: { r: 12, g: 20, b: 30, a: 1 } },
    { name: "sky-300", expected: { r: 10, g: 20, b: 30, a: 1 }, actual: { r: 10, g: 24, b: 30, a: 1 } },
    { name: "pass-band", expected: { r: 245, g: 180, b: 0, a: 1 }, actual: null },
  ];
  assert.deepEqual(colourFindings("s1", "night", "android", sampled), [
    { theme: "night", screen: "s1", kind: "colour-android", name: "sky-300", detail: "expected #0a141e, was #0a181e" },
  ]);
});

test("approvals mark findings by key, and only the others block", () => {
  const findings = [
    { theme: "day", screen: "s2", kind: "frame", name: "pass", detail: "off by 3.0 dp" },
    { theme: "night", screen: "p2", kind: "colour-web", name: "ticket-band", detail: "expected #e0a52c, was #ffffff" },
  ];
  const judged = withApprovals(findings, [{ key: "day/s2/frame/pass", reason: "Owner, 2026-10-21: the status bar is taller" }]);
  assert.equal(judged[0].key, "day/s2/frame/pass");
  assert.equal(judged[0].approved, true);
  assert.equal(judged[0].reason, "Owner, 2026-10-21: the status bar is taller");
  assert.equal(judged[1].approved, false);
  assert.deepEqual(unapproved(judged).map((f) => f.key), ["night/p2/colour-web/ticket-band"]);
});

test("the screens and their elements are the ones the Android walk captures (ScreenWalk.kt)", () => {
  const kotlin = readFileSync(new URL("../../Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/support/ScreenWalk.kt", import.meta.url), "utf8");
  const walk = [...kotlin.matchAll(/"([\w-]+)" to listOf\(([^)]*)\)/g)].map(([, id, list]) => ({ id, elements: [...list.matchAll(/"(\w+)"/g)].map((m) => m[1]) }));
  assert.deepEqual(SCREENS.map(({ id, elements }) => ({ id, elements })), walk);
  for (const screen of SCREENS) {
    for (const element of screen.elements) assert.ok(ELEMENTS.includes(element), `${screen.id}: unknown element ${element}`);
    for (const sample of screen.samples) {
      if (sample.element !== undefined) assert.ok(screen.elements.includes(sample.element), `${screen.id}: ${sample.name} samples an element the screen does not capture`);
    }
  }
});

test("the states are the twenty of plan B's review, in its order, each once", () => {
  assert.deepEqual(SCREENS.map((s) => s.id), [
    "s1", "s2", "s3", "s4", "s5", "s6", "p2", "p3", "p4", "r1",
    "streak-p2", "streak-r1", "lives-p2", "lives-r1", "lives-r1-why", "timed-p2", "timed-up", "timed-r1",
    "s1-returning", "s3-recent",
  ]);
});

test("the colour probes are the points both platforms read", () => {
  const byId = Object.fromEntries(SCREENS.map((s) => [s.id, s.samples]));
  const names = (id) => byId[id].map((s) => s.name);
  const skies = ["sky-120", "sky-300", "sky-560", "sky-860"];
  assert.deepEqual(names("p2"), [...skies, "ticket-band", "ticket-paper", "true-fill", "false-fill"]);
  assert.deepEqual(names("p4"), [...skies, "sheet-paper", "keep-fill"]);
  assert.deepEqual(names("s6"), [...skies, "pass-band", "start-fill"]);
  assert.ok(byId.p4.filter((s) => s.name.startsWith("sky-")).every((s) => s.scrim === true && s.x === 4));
  const frames = { ticket: [16, 100, 380, 500], sheet: [16, 600, 380, 200], keep: [36, 700, 340, 52], true: [216, 640, 180, 52] };
  const at = (id, name) => samplePoint(byId[id].find((s) => s.name === name), frames);
  assert.deepEqual(at("p2", "ticket-band"), { x: 206, y: 104 });
  assert.deepEqual(at("p2", "ticket-paper"), { x: 22, y: 150 });
  assert.deepEqual(at("p4", "sheet-paper"), { x: 26, y: 700 });
  assert.deepEqual(at("p4", "keep-fill"), { x: 50, y: 726 });
  assert.deepEqual(at("p2", "true-fill"), { x: 230, y: 666 });
  assert.equal(byId.p2.find((s) => s.name === "true-fill").role, "true");
  assert.equal(byId.p2.find((s) => s.name === "false-fill").role, "false");
  assert.equal(byId.p4.find((s) => s.name === "keep-fill").role, "ink");
});

test("the committed resolved tokens give the colours the review expects (reference 5.1)", () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL("../../../native-data/tokens/resolved.json", import.meta.url), "utf8")).native["sky-stops"], [0, 0.35, 0.62, 1]);
  const resolved = JSON.parse(readFileSync(new URL("../../../native-data/tokens/resolved.json", import.meta.url), "utf8"));
  assert.equal(hex(tokenColour(resolved, "color.day.sky-1")), "#a9d6f0");
  assert.equal(hex(tokenColour(resolved, "color.night.sky-4")), "#1c2538");
  assert.equal(hex(tokenColour(resolved, "color.day.accent")), "#f5b400");
  assert.equal(hex(tokenColour(resolved, "color.night.surface-raised")), "#252f41");
  assert.deepEqual(tokenColour(resolved, "color.night.scrim"), { r: 0, g: 0, b: 0, a: 0.6 });
  assert.equal(tokenColour(resolved, "color.day.scrim").a, 0.32);
});
```

Run `node --test --test-reporter=spec android/Tools/visual-review/compare.test.mjs 2>&1 | grep -E 'Cannot find module|ℹ (pass|fail)'`. Expected: a `Cannot find module` line naming `compare.mjs`, `ℹ pass 0`, `ℹ fail 1`.

- [ ] **Step 27: Write the comparison and the screen list.**

`android/Tools/visual-review/compare.mjs`:

```js
// Pure checks of the visual review (spec 7.4): token colours, the sky, element frames and approvals. No I/O.
export const FRAME_LIMIT_DP = 2;
// Per channel, for a screenshot. (A colour read from a video frame would allow 12; this review reads screenshots only.)
export const COLOUR_TOLERANCE = 3;

/** The sky's gradient stops: plan A's native group of resolved.json (Tokens.Native.skyStops on Android). */
export function skyStops(tokens) {
  const stops = tokens?.native?.["sky-stops"];
  if (!Array.isArray(stops) || stops.length !== 4) throw new Error("no native.sky-stops in the tokens");
  return stops;
}

function lookup(tokens, path) {
  let node = tokens;
  for (const key of path.split(".")) {
    if (node === null || typeof node !== "object" || !(key in node)) throw new Error(`no token ${path}`);
    node = node[key];
  }
  return node;
}

/** A colour token of the DTCG file, references followed: { r, g, b } in 0 to 255 and the alpha. */
export function tokenColour(tokens, path) {
  let token = lookup(tokens, path);
  for (let hops = 0; hops < 10; hops += 1) {
    const value = token?.$value;
    if (typeof value === "string") {
      const reference = /^\{([^}]+)\}$/.exec(value);
      if (reference === null) throw new Error(`${path} is not a colour: ${value}`);
      token = lookup(tokens, reference[1]);
    } else if (value !== null && typeof value === "object" && typeof value.hex === "string") {
      const h = value.hex;
      return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16), a: value.alpha ?? 1 };
    } else {
      throw new Error(`${path} is not a colour`);
    }
  }
  throw new Error(`${path}: the reference chain is too long`);
}

const role = (tokens, theme, name) => tokenColour(tokens, `color.${theme}.${name}`);

/** A colour with alpha laid over an opaque one, per channel, rounded. */
export function over(top, bottom) {
  const a = top.a ?? 1;
  const mix = (front, back) => Math.round(front * a + back * (1 - a));
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

/** The sky at a fraction of the window height, mixed per channel in sRGB. */
export function skyColour(tokens, theme, fraction) {
  const SKY_STOPS = skyStops(tokens);
  const at = Math.min(1, Math.max(0, fraction));
  const stops = [1, 2, 3, 4].map((n) => role(tokens, theme, `sky-${n}`));
  let i = 0;
  while (i < SKY_STOPS.length - 2 && at > SKY_STOPS[i + 1]) i += 1;
  const t = (at - SKY_STOPS[i]) / (SKY_STOPS[i + 1] - SKY_STOPS[i]);
  const from = stops[i];
  const to = stops[i + 1];
  const mix = (a, b) => Math.round(a + (b - a) * t);
  return { r: mix(from.r, to.r), g: mix(from.g, to.g), b: mix(from.b, to.b), a: 1 };
}

/**
 * Where a sample is read, in dp: fixed on the screen ({ x, y }), or inside an element's frame [x, y, w, h]:
 * across by a fraction of the width (fx) or by dp (dx), down by dp from the top (dy), by a fraction of the height (fy)
 * or up from the bottom (dyBottom). Null when the element was not captured.
 */
export function samplePoint(sample, frames) {
  if (sample.element === undefined) return { x: sample.x, y: sample.y };
  const frame = frames[sample.element];
  if (frame === undefined) return null;
  const [fx, fy, fw, fh] = frame;
  const x = sample.fx !== undefined ? fx + fw * sample.fx : fx + sample.dx;
  const y = sample.dy !== undefined ? fy + sample.dy : sample.fy !== undefined ? fy + fh * sample.fy : fy + fh - sample.dyBottom;
  return { x, y };
}

/** What a sample should read: a colour role of the theme, or the sky at its height, under the scrim if it says so. */
export function expectedColour(tokens, theme, sample, heightDp) {
  if (sample.role !== undefined) return role(tokens, theme, sample.role);
  const sky = skyColour(tokens, theme, sample.y / heightDp);
  return sample.scrim ? over(role(tokens, theme, "scrim"), sky) : sky;
}

export function close(a, b, tolerance = COLOUR_TOLERANCE) {
  return Math.abs(a.r - b.r) <= tolerance && Math.abs(a.g - b.g) <= tolerance && Math.abs(a.b - b.b) <= tolerance;
}

export function hex(c) {
  return `#${[c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

const written = (frame) => frame.map((value) => Number(value.toFixed(1))).join(", ");

/** Frames of the same element on both platforms, [x, y, w, h] in dp: more than 2 dp apart, or missing, is a finding. */
export function frameFindings(screen, theme, android, web, elements) {
  const findings = [];
  for (const name of elements) {
    const a = android.frames[name];
    const w = web.frames[name];
    if (a === undefined) {
      findings.push({ theme, screen, kind: "missing-android", name, detail: "not found on android" });
    } else if (w === undefined) {
      findings.push({ theme, screen, kind: "missing-web", name, detail: "not found on the web" });
    } else {
      const off = Math.max(...a.map((value, i) => Math.abs(value - w[i])));
      if (off > FRAME_LIMIT_DP) findings.push({ theme, screen, kind: "frame", name, detail: `android ${written(a)}; web ${written(w)}; off by ${off.toFixed(1)} dp` });
    }
  }
  return findings;
}

/** Sampled colours of one platform against what the tokens say. A null reading (element missing) is left out. */
export function colourFindings(screen, theme, platform, sampled) {
  return sampled
    .filter((s) => s.actual !== null && !close(s.actual, s.expected))
    .map((s) => ({ theme, screen, kind: `colour-${platform}`, name: s.name, detail: `expected ${hex(s.expected)}, was ${hex(s.actual)}` }));
}

export const findingKey = (f) => `${f.theme}/${f.screen}/${f.kind}/${f.name}`;

/** Marks each finding approved when approvals.json has its key, with the owner's reason. */
export function withApprovals(findings, approvals) {
  return findings.map((f) => {
    const key = findingKey(f);
    const approval = approvals.find((entry) => entry.key === key);
    return { ...f, key, approved: approval !== undefined, reason: approval?.reason ?? "" };
  });
}

export const unapproved = (findings) => findings.filter((f) => !f.approved);
```

`android/Tools/visual-review/screens.mjs`:

```js
// The states of the visual review, mirroring SCREEN_ELEMENTS in ScreenWalk.kt (compare.test.mjs pins it), with the
// ids and the colour probes of plan B's review: what both walks capture, which element frames are compared, and where
// colours are sampled. The Timed stamp beat (reference P3t) is not captured: it lasts 700 ms; the feel recordings cover it.
export const SEED = 1234567; // REVIEW_SEED in ScreenWalk.kt and in plan B
export const THEMES = ["day", "night"];
export const ELEMENTS = ["logo", "pass", "ticket", "stub", "sheet", "start", "true", "false", "next", "results", "keep", "again", "another"];
// The pills are found by their accessible names on both platforms (reference 4.5).
export const PILLS = {
  start: "Start round",
  true: "True",
  false: "False",
  next: "Next card",
  results: "See results",
  keep: "Keep playing",
  again: "Play again",
  another: "Choose another route",
};
// The colour role of each pill's fill (reference 5.1). Choose another route is a quiet button: no fill to probe.
const FILL = { true: "true", false: "false", next: "ink", results: "ink", start: "ink", again: "ink", keep: "ink" };

// The sky 4 dp from the left edge, where nothing else is drawn, at heights clear of the upper cloud (196 to 242);
// under the leave sheet the scrim lies over it.
const SKY_Y = [120, 300, 560, 860];
const sky = (scrim = false) => SKY_Y.map((y) => ({ name: `sky-${y}`, x: 4, y, scrim }));
// The accent band 4 dp below the top of a pass or ticket, at its horizontal centre.
const band = (element) => ({ name: `${element}-band`, element, fx: 0.5, dy: 4, role: "accent" });
// The ticket's paper 6 dp in from its left edge and 50 down, under the band.
const paper = { name: "ticket-paper", element: "ticket", dx: 6, dy: 50, role: "surface-raised" };
// The sheet card 10 dp in from its left edge at half its height (inside its 20 padding).
const sheetPaper = { name: "sheet-paper", element: "sheet", dx: 10, fy: 0.5, role: "surface-raised" };
// A pill 14 dp in from its left edge at half its height: its fill.
const fill = (element) => ({ name: `${element}-fill`, element, dx: 14, fy: 0.5, role: FILL[element] });

const screen = (id, elements, samples) => ({ id, elements, samples });
const pass = (id, ...pills) => screen(id, ["pass", ...pills], [...sky(), band("pass"), ...pills.map(fill)]);
const question = (id) => screen(id, ["ticket", "stub", "true", "false"], [...sky(), band("ticket"), paper, fill("true"), fill("false")]);
const result = (id) => screen(id, ["ticket", "again", "another"], [...sky(), band("ticket"), paper, fill("again")]);

export const SCREENS = [
  screen("s1", ["logo"], sky()),
  pass("s2"),
  pass("s3"),
  pass("s4"),
  pass("s5"),
  pass("s6", "start"),
  question("p2"),
  screen("p3", ["ticket", "next"], [...sky(), band("ticket"), paper, fill("next")]),
  screen("p4", ["sheet", "keep"], [...sky(true), sheetPaper, fill("keep")]),
  result("r1"),
  question("streak-p2"),
  result("streak-r1"),
  question("lives-p2"),
  result("lives-r1"),
  // The opened Why scrolls the stage, so the ticket's top may lie above the screen: only the sky is sampled.
  screen("lives-r1-why", ["ticket"], sky()),
  question("timed-p2"),
  screen("timed-up", ["ticket", "results"], [...sky(), band("ticket"), paper, fill("results")]),
  result("timed-r1"),
  screen("s1-returning", ["logo"], sky()),
  pass("s3-recent"),
];
```

`android/Tools/visual-review/approvals.json` (the owner's approvals, empty until step 32):

```json
[]
```

Run `node --test --test-reporter=spec android/Tools/visual-review/compare.test.mjs 2>&1 | grep -E '✔|✖|ℹ (pass|fail)'`. Expected: twelve `✔` lines, `ℹ pass 12`, `ℹ fail 0`.

- [ ] **Step 28: Commit the comparison.**

```bash
git add android/Tools/visual-review/compare.mjs android/Tools/visual-review/compare.test.mjs android/Tools/visual-review/screens.mjs android/Tools/visual-review/approvals.json
git commit -m "test: add the visual review's frame and colour comparison"
```

- [ ] **Step 29: Capture every reviewed screen on the API 36 emulator.**

The capture runs as an instrumented test started with `am instrument` (not Gradle), so the app stays installed afterwards and its files can be read with `run-as`; Gradle's connected run uninstalls the app and its files with it. Without the argument `capture=1` the test is skipped, so the regular suite does not capture.

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/review/VisualCaptureTest.kt`:

```kotlin
package com.eienmosu.truthy.review

import android.graphics.Bitmap
import android.os.SystemClock
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.ELEMENT_MATCHERS
import com.eienmosu.truthy.support.REVIEW_SEED
import com.eienmosu.truthy.support.SCREEN_ELEMENTS
import com.eienmosu.truthy.support.ScreenWalk
import com.eienmosu.truthy.support.Ui
import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Screenshots and element frames of every reviewed screen, for pair.mjs. Started by capture-android.sh with the
 * arguments capture=1 and theme=day or night; writes files/visual/<font100|font200>-<theme>-<screen>.{png,json}.
 */
@RunWith(AndroidJUnit4::class)
class VisualCaptureTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)
    private val arguments = InstrumentationRegistry.getArguments()

    @Test fun captureEveryScreen() {
        assumeTrue("started by capture-android.sh (argument capture=1)", arguments.getString("capture") == "1")
        val theme = arguments.getString("theme") ?: "day"
        val label = if (Device.app.resources.configuration.fontScale >= 1.99f) "font200" else "font100"
        Device.reset()
        Device.systemNight(theme == "night")
        try {
            Device.launch(seed = REVIEW_SEED).use {
                ScreenWalk(ui).run { screen -> capture(screen, theme, label) }
            }
        } finally {
            Device.systemNight(false)
        }
    }

    private fun capture(screen: String, theme: String, label: String) {
        ui.idle()
        SystemClock.sleep(500)
        ui.idle()
        val shot = Device.screenshot()
        val density = Device.density
        val name = "$label-$theme-$screen"
        val dir = File(Device.app.filesDir, "visual").apply { mkdirs() }
        File(dir, "$name.png").outputStream().use { shot.compress(Bitmap.CompressFormat.PNG, 100, it) }

        val frames = JSONObject()
        for (element in SCREEN_ELEMENTS.getValue(screen)) {
            val node = rule.onAllNodes(ELEMENT_MATCHERS.getValue(element))
                .fetchSemanticsNodes(atLeastOneRootRequired = false)
                .firstOrNull() ?: continue
            val bounds = node.boundsInWindow
            frames.put(element, JSONArray(listOf(bounds.left, bounds.top, bounds.width, bounds.height).map { (it / density).toDouble() }))
        }
        val json = JSONObject()
            .put("platform", "android")
            .put("screen", screen)
            .put("theme", theme)
            .put("label", label)
            .put("density", density.toDouble())
            .put("widthDp", shot.width / density.toDouble())
            .put("heightDp", shot.height / density.toDouble())
            .put("frames", frames)
        File(dir, "$name.json").writeText(json.toString(2))
    }
}
```

`android/Tools/visual-review/capture-android.sh`:

```bash
#!/usr/bin/env bash
# Captures every reviewed screen on the running emulator, day and night, at font scale 1.0 and 2.0.
# Writes android/Tools/visual-review/out/android/<font100|font200>-<day|night>-<screen>.{png,json}.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
project="$(cd "$here/../.." && pwd)/Truthy"
out="$here/out/android"
pkg=com.eienmosu.truthy
adb="${ANDROID_HOME:?set ANDROID_HOME to the Android SDK folder}/platform-tools/adb"

rm -rf "$out"
mkdir -p "$out"
(cd "$project" && ./gradlew -q :app:installDebug :app:installDebugAndroidTest)
runner="$("$adb" shell pm list instrumentation | tr -d '\r' | grep "(target=$pkg)" | sed -E 's/^instrumentation:([^ ]+) .*/\1/' | head -n 1)"
[ -n "$runner" ] || { echo "no instrumentation installed for $pkg" >&2; exit 1; }
"$adb" shell run-as "$pkg" rm -rf files/visual

for scale in 1.0 2.0; do
  "$adb" shell settings put system font_scale "$scale"
  for theme in day night; do
    log="$("$adb" shell am instrument -w -e capture 1 -e theme "$theme" -e class com.eienmosu.truthy.review.VisualCaptureTest "$runner" | tr -d '\r')"
    echo "$log" | tail -n 2
    echo "$log" | grep -q '^OK (1 test)' || { echo "the capture failed at font scale $scale, $theme" >&2; exit 1; }
  done
done
"$adb" shell settings put system font_scale 1.0

for file in $("$adb" shell run-as "$pkg" ls files/visual | tr -d '\r'); do
  "$adb" exec-out run-as "$pkg" cat "files/visual/$file" > "$out/$file"
done
echo "$(ls "$out" | wc -l | tr -d ' ') files in out/android"
```

Run (the API 36 emulator is running):

```bash
chmod +x android/Tools/visual-review/capture-android.sh
android/Tools/visual-review/capture-android.sh
git check-ignore android/Tools/visual-review/out/android/font100-day-s1.png
ls android/Tools/visual-review/out/android | head -n 4
```

Expected: four times `OK (1 test)` (each walk takes about three minutes, one real Timed minute among them), then `160 files in out/android` (20 states, 2 themes, 2 font scales, a PNG and a JSON each); `git check-ignore` prints the path (the root `.gitignore`'s `out/` covers it); the first names are `font100-day-lives-p2.json`, `font100-day-lives-p2.png`, `font100-day-lives-r1-why.json`, `font100-day-lives-r1-why.png`. Open `font100-day-s1.json`: `widthDp` about 411.4, `heightDp` about 914.3 (the Pixel 8 profile, spec 7.4's 412 by 915), `density` 2.625, and a `logo` frame.

Commit:

```bash
git add android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/review android/Tools/visual-review/capture-android.sh
git commit -m "test: capture the reviewed Android screens with their element frames"
```

- [ ] **Step 30: Capture the web in the same states.**

`android/Tools/visual-review/web-capture.mjs`:

```js
#!/usr/bin/env node
// Captures the web app in the twenty states of the Android walk (ScreenWalk.kt), day and night, at the viewport and density
// of the Android captures, with the round's seed fixed. Needs the production build running: pnpm build && pnpm start --port 3100.
//   node android/Tools/visual-review/web-capture.mjs [base URL, default http://localhost:3100]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { PILLS, SCREENS, SEED, THEMES } from "./screens.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
const base = process.argv[2] ?? "http://localhost:3100";
const reference = JSON.parse(readFileSync(join(out, "android", "font100-day-s1.json"), "utf8"));
const viewport = { width: Math.round(reference.widthDp), height: Math.round(reference.heightDp) };
const density = reference.density;
mkdirSync(join(out, "web"), { recursive: true });

// The same options as Routes.kt and e2e/helpers.ts (CLF_SECURITY).
const OPTION = {
  area: /^Cloud, \d+ decks?$/,
  platform: /^AWS, \d+ decks?$/,
  deck: /^CLF, Cloud Practitioner, \d+ cards, /,
  section: /^SEC, Security and compliance, \d+ cards$/,
  mode: /^Classic\. Correct answers out of 10 cards\. /,
};
// The other classes on the same route, and the whole CDL deck (no sections) of the returning player.
const CLASS = { streak: /^Streak\. /, lives: /^Three lives\. /, timed: /^Timed\. / };
const CDL = { platform: /^Google Cloud, \d+ decks?$/, deck: /^CDL, Cloud Digital Leader, \d+ cards, / };
// The web elements whose frames match the Android test tags.
const SELECTOR = { pass: "[data-fill-in-pass]", ticket: "[data-boarding-pass]", stub: "[data-stub]", sheet: "[role=dialog]" };

const literal = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function atStep(page, title) {
  await page.locator("[data-step]:not([inert]) h2", { hasText: new RegExp(`^${literal(title)}$`) }).waitFor();
  await page.waitForTimeout(1000);
}

const pill = (page, name) => page.getByRole("button", { name, exact: true });

async function frameOf(page, element) {
  if (element === "logo") {
    // The heading is a full-width flex row; the logo's frame is its mark and wordmark.
    const heading = page.getByRole("heading", { level: 1, name: "Truthy" });
    if ((await heading.count()) === 0) return null;
    return heading.evaluate((h) => {
      const rects = [...h.children].map((child) => child.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left));
      const top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      return [left, top, right - left, bottom - top];
    });
  }
  const locator = element in PILLS ? pill(page, PILLS[element]) : page.locator(SELECTOR[element]);
  if ((await locator.count()) === 0) return null;
  const box = await locator.first().boundingBox();
  return box === null ? null : [box.x, box.y, box.width, box.height];
}

async function shoot(page, theme, screen) {
  await page.waitForTimeout(800);
  const spec = SCREENS.find((s) => s.id === screen);
  const frames = {};
  for (const element of spec.elements) {
    const frame = await frameOf(page, element);
    if (frame !== null) frames[element] = frame;
  }
  const name = `${theme}-${screen}`;
  await page.screenshot({ path: join(out, "web", `${name}.png`) });
  const capture = { platform: "web", screen, theme, label: "font100", density, widthDp: viewport.width, heightDp: viewport.height, frames };
  writeFileSync(join(out, "web", `${name}.json`), `${JSON.stringify(capture, null, 2)}\n`);
  console.log(`web ${name}`);
}

const option = (page, name) => page.getByRole("button", { name });

/** The question phase: True is back on screen; a little over the 250 ms settle time. */
async function question(page) {
  await pill(page, "True").waitFor({ state: "visible" });
  await page.waitForTimeout(600);
}

async function result(page) {
  await page.getByRole("heading", { name: "Round complete" }).waitFor({ state: "attached" });
  await page.waitForTimeout(400);
}

/** Close results once the result's 1000 ms have passed, back to step 1. */
async function closeResults(page) {
  await page.waitForTimeout(1100);
  await pill(page, "Close results").click();
  await atStep(page, "Choose an area");
}

/** CLF / SEC in a class, from step 1 to the round's first card. */
async function playClf(page, mode) {
  await option(page, OPTION.area).click();
  await atStep(page, "Choose a platform");
  await option(page, OPTION.platform).click();
  await atStep(page, "Choose a deck");
  await option(page, OPTION.deck).click();
  await atStep(page, "Choose a section");
  await option(page, OPTION.section).click();
  await atStep(page, "Choose how to play");
  await option(page, mode).click();
  await atStep(page, "Your pass is ready");
  await pill(page, "Start round").click();
  await question(page);
}

async function walk(page, theme) {
  const shot = (screen) => shoot(page, theme, screen);
  await page.goto(`${base}/`);
  await atStep(page, "Choose an area");
  await shot("s1");
  await option(page, OPTION.area).click();
  await atStep(page, "Choose a platform");
  await shot("s2");
  await option(page, OPTION.platform).click();
  await atStep(page, "Choose a deck");
  await shot("s3");
  await option(page, OPTION.deck).click();
  await atStep(page, "Choose a section");
  await shot("s4");
  await option(page, OPTION.section).click();
  await atStep(page, "Choose how to play");
  await shot("s5");
  await option(page, OPTION.mode).click();
  await atStep(page, "Your pass is ready");
  await shot("s6");

  await pill(page, "Start round").click();
  await page.getByRole("img", { name: /^Card 1 of 10\./ }).waitFor();
  await page.waitForTimeout(600);
  await shot("p2");
  await pill(page, "True").click();
  await pill(page, "Next card").waitFor();
  await page.waitForTimeout(500);
  await shot("p3");
  await pill(page, "Leave round").click();
  await page.getByRole("dialog").waitFor();
  await shot("p4");
  await pill(page, "Keep playing").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });

  for (let number = 2; number <= 10; number += 1) {
    await page.waitForTimeout(500);
    await pill(page, "Next card").click();
    await page.getByRole("img", { name: new RegExp(`^Card ${number} of 10\\.`) }).waitFor();
    await page.waitForTimeout(400);
    await pill(page, "True").click();
    await pill(page, number === 10 ? "See results" : "Next card").waitFor();
  }
  await page.waitForTimeout(500);
  await pill(page, "See results").click();
  await result(page);
  await shot("r1");
  await closeResults(page);

  // The states one Classic round does not reach, played as ScreenWalk.kt (and plan B) play them.
  for (const name of ["streak", "lives"]) {
    await playClf(page, CLASS[name]);
    await shot(`${name}-p2`);
    for (;;) {
      await pill(page, "True").click();
      await page.getByRole("button", { name: /^(Next card|See results)$/ }).waitFor();
      if ((await pill(page, "See results").count()) > 0) break;
      await page.waitForTimeout(500);
      await pill(page, "Next card").click();
      await pill(page, "Next card").waitFor({ state: "detached" });
      await question(page);
    }
    await page.waitForTimeout(500);
    await pill(page, "See results").click();
    await result(page);
    await shot(`${name}-r1`);
    if (name === "lives") {
      // Three wrong answers end the round, so a missed card is always there.
      await page.getByRole("button", { name: /^Why, card / }).first().click();
      await shot("lives-r1-why");
    }
    await closeResults(page);
  }

  await playClf(page, CLASS.timed);
  await shot("timed-p2");
  await pill(page, "True").click();
  // The rest of the minute runs out in real time.
  await pill(page, "See results").waitFor({ timeout: 75_000 });
  await page.waitForTimeout(500);
  await shot("timed-up");
  await pill(page, "See results").click();
  await result(page);
  await shot("timed-r1");
  await closeResults(page);

  // A second deck played and left with one answer: step 1 then shows Recent (two decks) and Continue.
  await option(page, OPTION.area).click();
  await atStep(page, "Choose a platform");
  await option(page, CDL.platform).click();
  await atStep(page, "Choose a deck");
  await option(page, CDL.deck).click();
  await atStep(page, "Choose how to play");
  await option(page, OPTION.mode).click();
  await atStep(page, "Your pass is ready");
  await pill(page, "Start round").click();
  await question(page);
  await pill(page, "True").click();
  await page.getByRole("button", { name: /^(Next card|See results)$/ }).waitFor();
  await pill(page, "Leave round").click();
  await page.getByRole("dialog").getByRole("button", { name: "Leave round", exact: true }).click();
  await atStep(page, "Choose an area");
  await shot("s1-returning");
  await option(page, /^Recent, 2 decks$/).click();
  await atStep(page, "Choose a deck");
  await shot("s3-recent");
}

const browser = await chromium.launch();
try {
  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: density,
      isMobile: true,
      hasTouch: true,
      colorScheme: theme === "day" ? "light" : "dark",
      reducedMotion: "no-preference",
      serviceWorkers: "block",
    });
    // The round's seed: useRound.ts draws it with crypto.getRandomValues(new Uint32Array(1)).
    await context.addInitScript((seed) => {
      const original = crypto.getRandomValues.bind(crypto);
      Object.defineProperty(crypto, "getRandomValues", {
        configurable: true,
        value: (array) => {
          if (array instanceof Uint32Array && array.length === 1) {
            array[0] = seed;
            return array;
          }
          return original(array);
        },
      });
    }, SEED);
    const page = await context.newPage();
    await walk(page, theme);
    await context.close();
  }
} finally {
  await browser.close();
}
```

Run, with the web's production build served on port 3100 (in a second shell, or in the background):

```bash
pnpm build && pnpm start --port 3100
```

```bash
node android/Tools/visual-review/web-capture.mjs
ls android/Tools/visual-review/out/web | wc -l
```

Expected: forty `web <theme>-<state>` lines (`web day-s1` to `web night-s3-recent`), then `80`. Stop the server afterwards. The first statement on `out/web/day-p2.png` and `out/android/font100-day-p2.png` is the same (seed 1234567, the same deck order and history): if not, the two engines dealt differently, which the golden tests should have caught, or the seed extra is not used; find out which before going on.

- [ ] **Step 31: Pair the captures and write the report.**

`android/Tools/visual-review/pair.mjs`:

```js
#!/usr/bin/env node
// Pairs each Android capture with the web capture of the same screen and theme (spec 7.4): checks the element
// frames and the colours, writes a side-by-side image per pair and a report. Run after capture-android.sh and web-capture.mjs.
//   node android/Tools/visual-review/pair.mjs           writes out/pairs/*.png, out/report.md and out/report.json
//   node android/Tools/visual-review/pair.mjs --check   also exits 1 while a finding is not approved in approvals.json
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { colourFindings, expectedColour, frameFindings, samplePoint, unapproved, withApprovals } from "./compare.mjs";
import { SCREENS, THEMES } from "./screens.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
const tokens = JSON.parse(readFileSync(join(here, "..", "..", "..", "native-data", "tokens", "resolved.json"), "utf8"));
const approvals = JSON.parse(readFileSync(join(here, "approvals.json"), "utf8"));
const check = process.argv.includes("--check");
const WIDTH = 412;

function readCapture(folder, name) {
  const json = join(out, folder, `${name}.json`);
  const png = join(out, folder, `${name}.png`);
  return existsSync(json) && existsSync(png) ? { ...JSON.parse(readFileSync(json, "utf8")), png } : null;
}

const dataUrl = (png) => `data:image/png;base64,${readFileSync(png).toString("base64")}`;
const escapeHtml = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The colours of a capture at points in dp, read without colour conversion; null where a point is null. */
async function pixels(page, capture, points) {
  return page.evaluate(
    async ({ url, widthDp, points }) => {
      const blob = await (await fetch(url)).blob();
      const bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none" });
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const scale = bitmap.width / widthDp;
      return points.map((point) => {
        if (point === null) return null;
        const x = Math.min(bitmap.width - 1, Math.max(0, Math.round(point.x * scale)));
        const y = Math.min(bitmap.height - 1, Math.max(0, Math.round(point.y * scale)));
        const [r, g, b] = context.getImageData(x, y, 1, 1).data;
        return { r, g, b, a: 1 };
      });
    },
    { url: dataUrl(capture.png), widthDp: capture.widthDp, points },
  );
}

async function sampled(page, capture, screen, theme) {
  const actual = await pixels(page, capture, screen.samples.map((sample) => samplePoint(sample, capture.frames)));
  return screen.samples.map((sample, i) => ({ name: sample.name, expected: expectedColour(tokens, theme, sample, capture.heightDp), actual: actual[i] }));
}

function side(title, capture, colour) {
  const scale = WIDTH / capture.widthDp;
  const boxes = Object.entries(capture.frames)
    .map(
      ([name, [x, y, w, h]]) =>
        `<div class="frame" style="left:${x * scale}px;top:${y * scale}px;width:${w * scale}px;height:${h * scale}px;border-color:${colour}">` +
        `<span style="background:${colour}">${escapeHtml(name)}</span></div>`,
    )
    .join("");
  return (
    `<figure><figcaption>${escapeHtml(title)}</figcaption>` +
    `<div class="shot" style="width:${WIDTH}px;height:${capture.heightDp * scale}px"><img src="${dataUrl(capture.png)}" width="${WIDTH}">${boxes}</div></figure>`
  );
}

function pairPage(theme, screen, android, web, findings) {
  const list =
    findings.length === 0
      ? "<li>no findings</li>"
      : findings
          .map((f) => `<li class="${f.approved ? "ok" : "open"}">${escapeHtml(`${f.kind} ${f.name}: ${f.detail}${f.approved ? ` (approved: ${f.reason})` : ""}`)}</li>`)
          .join("");
  return (
    `<!doctype html><meta charset="utf-8"><style>` +
    `body{margin:16px;font:14px system-ui;background:#fff;color:#111}.row{display:flex;gap:24px}figure{margin:0}` +
    `figcaption{font-weight:600;margin-bottom:6px}.shot{position:relative;overflow:hidden;outline:1px solid #ccc}.shot img{display:block}` +
    `.frame{position:absolute;border:2px solid;box-sizing:border-box}.frame span{position:absolute;top:-1px;left:-1px;color:#fff;font:11px system-ui;padding:0 3px}` +
    `li.open{color:#b3321c}li.ok{color:#0d7250}</style>` +
    `<h1>${escapeHtml(`${screen.id}, ${theme}`)}</h1><div class="row">${side("Android (red frames)", android, "#d0021b")}${side("Web (blue frames)", web, "#1d5cc0")}</div>` +
    `<ul>${list}</ul>`
  );
}

mkdirSync(join(out, "pairs"), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2 * WIDTH + 80, height: 900 } });
const all = [];
try {
  for (const theme of THEMES) {
    for (const screen of SCREENS) {
      const android = readCapture("android", `font100-${theme}-${screen.id}`);
      const web = readCapture("web", `${theme}-${screen.id}`);
      if (android === null || web === null) {
        const missing = { theme, screen: screen.id, kind: "missing-capture", name: android === null ? "android" : "web", detail: "run capture-android.sh and web-capture.mjs first" };
        all.push(...withApprovals([missing], approvals));
        continue;
      }
      const findings = withApprovals(
        [
          ...frameFindings(screen.id, theme, android, web, screen.elements),
          ...colourFindings(screen.id, theme, "android", await sampled(page, android, screen, theme)),
          ...colourFindings(screen.id, theme, "web", await sampled(page, web, screen, theme)),
        ],
        approvals,
      );
      all.push(...findings);
      await page.setContent(pairPage(theme, screen, android, web, findings));
      await page.screenshot({ path: join(out, "pairs", `${theme}-${screen.id}.png`), fullPage: true });
    }
  }
} finally {
  await browser.close();
}

const open = unapproved(all);
const androidFolder = join(out, "android");
const large = existsSync(androidFolder) ? readdirSync(androidFolder).filter((n) => n.startsWith("font200-") && n.endsWith(".png")) : [];
const pairs = SCREENS.length * THEMES.length;
const report = [
  "# Visual review",
  "",
  `${pairs} pairs, ${all.length} findings, ${open.length} not approved. Pairs: out/pairs/<theme>-<screen>.png.`,
  "",
  "| Theme | Screen | Kind | Name | Detail | Approved |",
  "|---|---|---|---|---|---|",
  ...all.map((f) => `| ${f.theme} | ${f.screen} | ${f.kind} | ${f.name} | ${f.detail} | ${f.approved ? f.reason : "no"} |`),
  "",
  `Large text (N9), Android only: ${large.length} captures, out/android/font200-*.png.`,
  "",
];
writeFileSync(join(out, "report.md"), report.join("\n"));
writeFileSync(join(out, "report.json"), `${JSON.stringify(all, null, 2)}\n`);
console.log(`${pairs} pairs, ${all.length} findings, ${open.length} not approved`);
for (const f of open) console.log(`open: ${f.key}: ${f.detail}`);
process.exitCode = check && open.length > 0 ? 1 : 0;
```

Run:

```bash
node android/Tools/visual-review/pair.mjs
ls android/Tools/visual-review/out/pairs | wc -l
```

Expected: `40 pairs, N findings, N not approved` followed by one `open:` line per finding, then `40`. N is whatever the apps really differ by; zero is possible but not required at this point. Each `open:` line is either a defect (fix it in the task that draws the element, recapture with steps 29 to 31) or a platform difference for the owner (step 32). A `missing-android` finding usually means a test tag is missing; a `colour-web` finding on a sky sample means the web differs from its own tokens, which is a web issue to report, not to approve silently. One pattern is known in advance: on the day screens that show a ticket, and on `s6`, the sky probes at y 300 and 560 read 5 to 6 per channel darker than the token (on the API 36 emulator, `sky-300` `#bddcf0` for `#c2e2f5`, `sky-560` `#d6e9f3` for `#dceff8`), because the `ticket` shadow (blur 36) reaches x 4; the web draws the same shadow, so the same finding should appear on both sides. That is not an Android defect: show it to the owner in step 32 (the probe points are shared with plan B, so moving them is a cross-plan change). Every other Android probe, day and night at font scale 1.0, read within 3 of its token.

Commit:

```bash
git add android/Tools/visual-review/web-capture.mjs android/Tools/visual-review/pair.mjs
git commit -m "test: capture the web in the same states and pair it with the Android captures"
```

- [ ] **Step 32: The pairs reviewed by a reviewer and by the owner.**

Dispatch a reviewer subagent of the most capable tier with this prompt, giving it the folder `android/Tools/visual-review/out` (it reads the images; it changes nothing):

```text
You review the visual parity of the Truthy Android app with its web app (spec docs/superpowers/specs/2026-10-14-truthy-native-apps-design.md, success criterion 2 and section 6). In out/pairs there is one image per screen and theme: the Android screenshot on the left with red element frames, the web screenshot at the same viewport, seed and moves on the right with blue frames, and the list of findings below. out/report.md lists every finding. For each pair, report: (1) every visible difference in colour, type, spacing, shape, icon or copy, beyond the findings already listed; (2) for each finding, whether it is a defect of the Android app or an expected platform difference (system bar insets, the sheet's container, the system font rendering), with a one-line reason. Also look at every out/android/font200-*.png: report any text that is cut, overlaps or runs off the screen. Answer as a list grouped by pair. Do not approve anything: the owner does.
```

Fix every defect the reviewer confirms, in the task that owns it, and repeat steps 29 to 31. Then show the owner the remaining findings with the pairs (`out/report.md` and `out/pairs/`). For each finding the owner approves, add an entry to `android/Tools/visual-review/approvals.json` in the owner's words, for example:

```json
[
  { "key": "day/p4/frame/sheet", "reason": "Owner, 2026-10-21: the platform sheet sits on the gesture bar inset, 4 dp higher" }
]
```

Run:

```bash
node android/Tools/visual-review/pair.mjs --check
echo "exit $?"
```

Expected: `40 pairs, N findings, 0 not approved` and `exit 0`. Commit:

```bash
git add android/Tools/visual-review/approvals.json
git commit -m "test: record the owner's approvals of the Android visual review"
```

- [ ] **Step 33: The feel checklist on API 36.**

On the API 36 emulator, work through F1, F5 to F9, F11 to F16 and F18 to F23 of `android/Tools/feel/FEEL-CHECKLIST.md` with the commands the items give (`mkdir -p "$TMPDIR/truthy-feel/api36"` first). The executing agent does everything `adb` can do and records it; items that need a real finger in the emulator window (F9) or a judgement of motion (F1, F5, F6, F14, F18) or of speech (F23) are prepared as recordings and the owner watches or listens to them and gives the result. Write each result on its `Result:` line as the file's header says, with the build's short hash from `git rev-parse --short HEAD`. A FAIL is fixed in the task that owns the behaviour (Rule 5), the affected tests rerun, and the item checked again.

Run `node android/Tools/feel/checklist.mjs android/Tools/feel/FEEL-CHECKLIST.md`. Expected: `23 items:` with no FAIL and exit code 0; the items of steps 34 and 35 are still PENDING.

- [ ] **Step 34: The feel checklist on API 34, 33 and 26.**

```bash
android/Tools/emulators.sh stop && android/Tools/emulators.sh start 34
```

Work through F2 on API 34; then `stop`, `start 33` and F3; then `stop`, `start 26` and F4, F8, F11, F13, F14 (API 26 half), F17 and F21 (API 26 half). Items that span two emulators get one `Result:` line naming both, for example `PASS (API 36 and API 26, truthy-api36 and truthy-api26, build 1a2b3c4, 2026-10-21)`. Finally `android/Tools/emulators.sh stop` and `android/Tools/emulators.sh start 36`.

F10 is SKIP (no Android phone; emulators do not vibrate) unless the owner provides a phone, in which case the owner checks it there and the result names the phone and its Android version.

Run `node android/Tools/feel/checklist.mjs android/Tools/feel/FEEL-CHECKLIST.md --done; echo "exit $?"`. Expected: `23 items: 0 PENDING, 22 PASS, 0 FAIL, 1 SKIP` (or 23 PASS with a phone) and `exit 0`.

- [ ] **Step 35: The task's gates, and the commit.**

```bash
cd android/Truthy
./gradlew :engine:test :tokengen:test :app:testDebugUnitTest :app:assembleDebug
rm -rf app/build/outputs/androidTest-results
./gradlew :app:connectedDebugAndroidTest
node ../Tools/test-summary.mjs app/build/outputs/androidTest-results
cd ../..
node --test android/Tools/feel/checklist.test.mjs android/Tools/visual-review/compare.test.mjs 2>&1 | grep -E 'ℹ (pass|fail)'
node android/Tools/visual-review/pair.mjs --check
node android/Tools/feel/checklist.mjs android/Tools/feel/FEEL-CHECKLIST.md --done
pnpm test
git status --short
```

Expected: `BUILD SUCCESSFUL` twice; `tests 106, failures 0, errors 0, skipped 2` on API 36 (this task's 35 and the 71 of tasks 7 to 14; skipped: NoClipTest at font scale 1.0 and VisualCaptureTest without its argument); `ℹ pass 17`, `ℹ fail 0`; `0 not approved`; `23 items: ...` with exit 0; the web suite green (its hygiene test scans every file this task added); and `git status --short` shows only `android/Tools/feel/FEEL-CHECKLIST.md`.

```bash
git add android/Tools/feel/FEEL-CHECKLIST.md
git commit -m "test: record the Android feel checklist on API 36, 34, 33 and 26"
```
