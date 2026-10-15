### Task 10: Shapes, the 19 icons as `ImageVector`s, shadows, the sky, buttons with the web's press feedback, destination cards, stamps and a debug gallery

Everything the screens of tasks 12 to 14 are built from, except text layout and gestures, is made here once, from the same path data, tokens and motion values as the web. The 19 entries of `ICON_PATHS` become 19 `ImageVector`s (strokes in viewBox units, so they scale with the drawn size); the two things a vector cannot draw, a dash (the logo's tear line and the route icon), are drawn in Compose code. The ticket's two papers (main part with notches at the bottom corners, lower part with notches at the top corners), the destination card's paper (notches on the stub line), the dashed perforations and the stamp's double border are built as path data that a test can read. The web's shadows have negative spread, which Compose has no switch for, so each shadow layer is drawn as a stack of 14 rounded rectangles whose alphas make the sum a Gaussian edge (the same result on every API level). The sky is the smooth four stop gradient with the two clouds placed inside the 430 frame. The buttons (the 60 pill, the 48 round button, the quiet button, the Back pill) press the way the web's do, from `collectIsPressedAsState` through a `graphicsLayer`; the pass fields and the continue line get a bounded press tint through one `Indication`; every other control keeps the app-wide no indication. The destination cards (place, deck, section, class, unavailable), the three kinds of stamp and a debug-only gallery activity complete the task.

**This task was not compiled during drafting.** Nothing in this file was compiled or run while the plan was written. After the review, tasks 1 to 15 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: the JVM tests and, on the API 36 emulator, the instrumented tests. The defects that run found are fixed in this file (README, Drafting record). The Compose signatures were read from the AndroidX sources of `ImageVector.Builder`, `PathParser` and `PathNode` (the `androidx-main` branch of the AndroidX repository, `compose/ui` and `compose/material3`), from Task 8's file for everything the generated tokens and the theme expose, and from the web components named in each step. If the compiler rejects a line, fix the line, not the test, and keep the behaviour the step states. Expected outputs that depend on the compiler are stated as the expected failure of a red step (an unresolved reference) and the expected counts of a green one.

Builds on tasks 1, 7 and 8. From task 1: the engine's `Theme` and `logoMarkHeight`. From task 7: the `:app` module, its Gradle file, the manifest and the Compose set-up. From task 8: `Tokens`, `TruthyTheme`, `TruthyType`, `resolvedTheme`, `applyWindowTheme` and `bootTheme`. Web sources read: `components/icons.tsx`, `Logo.tsx`, `SkyBackdrop.tsx`, `PillButton.tsx`, `RoundButton.tsx`, `QuietButton.tsx`, `DestinationCard.tsx`, `Stamp.tsx`, `BoardingPass.tsx` (the notched paper, the perforation, the intent stamps), `components/start/StartFlow.tsx` (the Back pill), `components/easing.ts`, and the shadow, motion and shape tables of reference 5.5 to 5.8.

**Files:**
- Modify: `android/Truthy/app/build.gradle.kts` (a test system property; test dependencies only if missing)
- Create (all under `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/`): `IconPaths.kt`, `Icons.kt`, `Logo.kt`, `TruthyText.kt`, `Shapes.kt`, `Shadows.kt`, `Sky.kt`, `Motion.kt`, `PressTint.kt`, `Frame.kt`, `FocusRing.kt`
- Create (all under `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/`): `Buttons.kt`, `DestinationCard.kt`, `Stamps.kt`, `TestTags.kt`
- Create (debug only): `android/Truthy/app/src/debug/AndroidManifest.xml`, `android/Truthy/app/src/debug/kotlin/com/eienmosu/truthy/debug/GalleryActivity.kt`, `android/Truthy/app/src/debug/kotlin/com/eienmosu/truthy/debug/Gallery.kt`
- Test (JVM, under `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/`): create `design/WebSource.kt`, `design/IconPathsTest.kt`, `design/IconsTest.kt`, `design/LogoTest.kt`, `design/ShapesTest.kt`, `design/ShadowsTest.kt`, `design/SkyTest.kt`, `design/MotionTest.kt`, `design/FrameInsetsTest.kt`, `ui/ComponentsLogicTest.kt`
- Test (emulator): create `android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/ui/ComponentsSemanticsTest.kt`

**Interfaces:**
- Consumes, fixed by task 8's file (package `com.eienmosu.truthy.design`):
  - `Tokens.Space.s2 .. s24` (`Dp`), `Tokens.Size.{maxWidth, gutter, roundButton, pill, pillSmall, notch, cardNotch, cardStub, cardStubDeck, cardMin, cardMinDeck, cardMinSection, cardMinClass, cardMinOff, progressTrack, lower}` (`Dp`), `Tokens.Radius.{card, small, pill, pillSmall}`, `Tokens.Stroke.{rule, perforation, stamp}`, `Tokens.Opacity.{cloud, disabled}` (`Float`), `Tokens.Duration.stampTimed` (`Int` ms), `Tokens.Curves.spring`, `Tokens.Transitions.{press, stamp}` (`TransitionSpec(durationMs, delayMs, easing)`), `Tokens.Colors.{day, night}`, `Tokens.Shadows.{day, night}` (`ShadowSpec(layers)`, `ShadowLayer(offsetX, offsetY, blur, spread, color)`), `Tokens.Native.{skyStops, shortScreenBelow, shortSafeTop, shortSafeBottom}` (plan A's native group: the sky's stops and the short-screen rule).
  - `TruthyTheme.colors` (`TruthyColors`: `sky1..sky4, surfaceRaised, surfaceSunk, ink, inkMuted, rule, accent, onAccent, trueColor, falseColor, correct, wrong, onDark, cloud, press`), `TruthyTheme.shadows` (`small, button, press, ticket`), `TruthyTheme.isDark`, the composable `TruthyTheme(theme, content)`, `resolvedTheme(Theme)`, `applyWindowTheme(activity, theme)`, `bootTheme(activity, stored)`.
  - `TruthyType.{logo, cardName, deckCode, button, buttonQuiet, buttonBack, fieldLabel, fieldValuePass, monoData, monoCaption, listTitle, stamp, stampStub, intentStamp, stubValue}` (`TextStyle`, colour never part of a style).
- Consumes, fixed by task 1 and the README: `com.eienmosu.truthy.engine.Theme` (`LIGHT`, `DARK`).
- Assumed from task 1 (step 1 checks it): `fun logoMarkHeight(width: Double = 44.0): Double` in `com.eienmosu.truthy.engine`, the Kotlin twin of the iOS plan's function of that name (`Math.round(width * 30 / 44 * 100) / 100` in JavaScript order of operations; 44 gives 30, 26 gives 17.73).
- Produces (package `com.eienmosu.truthy.design`; later tasks rely on these names):

```kotlin
// IconPaths.kt
object IconPaths { const val CROSS: String /* ... one const per ICON_PATHS entry */; val BY_WEB_NAME: Map<String, String> }
internal fun pathNumber(value: Float): String

// Icons.kt
enum class IconId { CLOSE, CROSS, CHECK, BACK_HEADER, BACK_PILL, FORWARD, CHEVRON_RIGHT, CHEVRON_DOWN, PLANE, CLOUD, SKY_CLOUD, BOOK, REPLAY, CLOCK, STAR, HEART, HEART_LOST, MOON, SUN }
fun iconVector(id: IconId, strokeWidth: Float? = null, colors: TruthyColors? = null): ImageVector   // PLANE needs colors
@Composable fun TruthyIcon(id: IconId, modifier: Modifier = Modifier, tint: Color = TruthyTheme.colors.ink, width: Dp? = null, strokeWidth: Float? = null, label: String? = null)
@Composable fun RouteIcon(modifier: Modifier = Modifier, width: Dp = RouteIconSpec.WIDTH.dp, tint: Color = TruthyTheme.colors.ink)

// Logo.kt
const val APP_NAME = "Truthy"
enum class LogoVariant { FULL, COMPACT }
@Composable fun LogoMark(modifier: Modifier = Modifier, width: Dp = 44.dp, variant: LogoVariant = LogoVariant.FULL)
@Composable fun Logo(modifier: Modifier = Modifier, asHeading: Boolean = false)

// TruthyText.kt
@Composable fun TruthyText(text: String, style: TextStyle, color: Color, modifier: Modifier = Modifier, textAlign: TextAlign? = null, maxLines: Int = Int.MAX_VALUE, overflow: TextOverflow = TextOverflow.Clip)
@Composable fun TruthyText(text: AnnotatedString, style: TextStyle, color: Color, modifier: Modifier = Modifier, textAlign: TextAlign? = null, maxLines: Int = Int.MAX_VALUE, overflow: TextOverflow = TextOverflow.Clip)

// Shapes.kt
data class TicketMainShape(val cornerRadius: Dp = Tokens.Radius.card, val notchRadius: Dp = Tokens.Size.notch) : Shape
data class TicketLowerShape(val cornerRadius: Dp = Tokens.Radius.card, val notchRadius: Dp = Tokens.Size.notch) : Shape
data class DestinationCardShape(val stubWidth: Dp, val cornerRadius: Dp = Tokens.Radius.card, val notchRadius: Dp = Tokens.Size.cardNotch) : Shape
fun DrawScope.drawTicketPerforation(color: Color)                       // the dashed line at the bottom of the main part
fun DrawScope.drawCardPerforation(color: Color, stubWidth: Dp)          // the dashed line on a destination card's stub line
fun Modifier.stampBorder(color: Color, double: Boolean, radius: Dp = Tokens.Radius.small, total: Dp = Tokens.Stroke.stamp): Modifier

// Shadows.kt
@Composable fun Modifier.truthyShadow(spec: ShadowSpec, cornerRadius: Dp = Tokens.Radius.card, alpha: () -> Float = { 1f }): Modifier

// Sky.kt
enum class LowerCloud(val top: Float) { GAME(620f), START(660f) }
@Composable fun SkyBackdrop(modifier: Modifier = Modifier, lowerCloud: LowerCloud = LowerCloud.GAME)

// Motion.kt
val LocalReducedMotion: ProvidableCompositionLocal<Boolean>              // false by default; task 11 or 12 provides the real value, nothing redefines it
object PressFeedback { const val ROUND_SCALE = 0.92f; const val BACK_PILL_SCALE = 0.96f; const val PILL_SCALE = 0.98f; const val CARD_SCALE = 0.98f; const val QUIET_SCALE = 0.98f; const val CONTINUE_SCALE = 0.98f }
fun pressSpec(reducedMotion: Boolean): FiniteAnimationSpec<Float>
@Composable fun rememberPressProgress(interactionSource: InteractionSource, active: Boolean = true): State<Float>
fun Modifier.pressFeedback(progress: State<Float>, pressedScale: Float, drop: Dp = 0.dp): Modifier

// PressTint.kt
class PressTint(color: Color, cornerRadius: Dp, reducedMotion: Boolean) : IndicationNodeFactory
@Composable fun rememberPressTint(cornerRadius: Dp): PressTint           // for the pass fields (6) and the continue line: Modifier.clickable(source, rememberPressTint(r)) { }

// Frame.kt (spec 5.6 safe areas, the one implementation tasks 12 to 14 use)
data class FrameInsets(val top: Dp, val bottom: Dp, val start: Dp, val end: Dp)
fun frameInsets(systemTop: Dp, systemBottom: Dp, systemStart: Dp, systemEnd: Dp, windowHeight: Dp): FrameInsets   // pure, unit tested
@Composable fun rememberFrameInsets(): FrameInsets
@Composable fun TruthyFrame(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit)   // the 430 column padded by rememberFrameInsets; draws nothing itself

// FocusRing.kt
object FocusRingSpec { val WIDTH: Dp /* 2 */; val OFFSET: Dp /* 2 */; val INSET: Dp /* -2 */ }
@Composable fun Modifier.keyboardFocusRing(shape: Shape, offset: Dp = FocusRingSpec.OFFSET): Modifier   // before the clip and the clickable
```

  Package `com.eienmosu.truthy.ui`:

```kotlin
// Buttons.kt
enum class PillTone { INK, TRUE, FALSE }
enum class RoundVariant { RAISED, SUNK }
@Composable fun PillButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, tone: PillTone = PillTone.INK, dimmed: Boolean = false, leadingIcon: (@Composable () -> Unit)? = null, trailingIcon: (@Composable () -> Unit)? = null)
@Composable fun RoundButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, variant: RoundVariant = RoundVariant.RAISED, enabled: Boolean = true, content: @Composable () -> Unit)
@Composable fun QuietButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, leadingIcon: (@Composable () -> Unit)? = null)
@Composable fun BackPill(description: String, onClick: () -> Unit, modifier: Modifier = Modifier, text: String = "Back")

// DestinationCard.kt
enum class DestinationVariant { PLACE, DECK, SECTION, CLASS }
data class CardStub(val label: String, val value: String, val unit: String? = null, val muted: Boolean = false)
data class DestinationMetrics(val stubWidth: Dp, val minHeight: Dp, val gap: Dp, val vertical: Dp)
object DestinationLayout { fun of(variant: DestinationVariant): DestinationMetrics }
object TrackGeometry { fun seenWidth(percent: Int, trackWidth: Float): Float }
@Composable fun ProgressTrack(percent: Int, modifier: Modifier = Modifier)
@Composable fun DestinationCard(variant: DestinationVariant, name: String, label: String, modifier: Modifier = Modifier, onSelect: (() -> Unit)? = null, code: Boolean = false, sub: String? = null, detail: String? = null, seenPercent: Int? = null, stub: CardStub? = null, unavailable: Boolean = false, nameHidden: Boolean = false)

// TestTags.kt
object TestTags { const val LOGO = "logo"; const val PASS = "pass"; const val TICKET = "ticket"; const val STUB = "stub"; const val CARD = "card"; const val ROUND_SURFACE = "round-surface"; const val SHEET_CARD = "sheet-card" }

// Stamps.kt
enum class StampVerdict { CORRECT, WRONG, NEW_BEST }
enum class StubStampKind { CORRECT, WRONG, TIME_UP }
enum class IntentKind { TRUE, FALSE }
object StampLanding { fun at(progress: Float): StampFrame }                     // StampFrame(scale, rotation, alpha)
@Composable fun Stamp(verdict: StampVerdict, modifier: Modifier = Modifier, animate: Boolean = false, replayKey: Any? = null)
@Composable fun StubStamp(kind: StubStampKind, modifier: Modifier = Modifier, replayKey: Any? = null)
@Composable fun IntentStamp(kind: IntentKind, modifier: Modifier = Modifier)
```

**Rules:**

1. **Icons are the web's path data, unchanged.** `IconPaths` holds the 19 strings of `ICON_PATHS` in the web's order, and a test reads `components/icons.tsx` and compares them. Strokes are in viewBox units: an icon drawn at 22 that the web draws at viewBox 18 gets a proportionally thicker line, as in the web. Caps and joins are round except the book (butt caps, round join), the route icon (curve with a round cap, circles with neither), the clock's circle and the heart's outline (no cap set, so butt; the heart's outline has a round join), and the heart's slash (round cap, no join set). Single colour icons are drawn black in the vector and tinted with `ColorFilter.tint`; the plane has two colours (accent disc, on-accent arrow) and is built with the theme's colours instead. The 19 vectors are: close, cross, check, back header, back pill, forward, chevron right, chevron down, plane, carrier cloud, sky cloud, book, replay, clock, star, heart, lost heart, moon, sun. The route icon and the logo's tear line are drawn in Compose code (a vector cannot dash).
2. **A viewBox that does not start at 0 0** (the plane `-12 -12 24 24`, the heart `-11 0 22 22`) is moved into the vector's 0 0 based viewport with a translation group.
3. **Shapes are path data first.** The three papers and the stamp border are functions from sizes to a path string or to plain numbers; the `Shape` classes and the draw helpers only convert dp to px and call them. Arc directions: with the y axis pointing down, an SVG sweep flag of 1 turns clockwise on screen. A corner arc (top left to top right and so on, going clockwise round the shape) is sweep 1; a notch cut into the paper is sweep 0.
4. **Shadows** follow CSS: the shadow rectangle is the element's bounds grown by `spread` (negative shrinks) and moved by the offset, its corner radius is `max(0, radius + spread)`, and the blur is a Gaussian with sigma `blur / 2`. The 14 rectangles run from sigma times 2 outside to sigma times 2 inside, outermost first; the alpha of each is chosen so the stacked result at the middle of each band equals `alpha * normalCdf(-distance / sigma)`, and the innermost rectangle brings the sum to the full alpha. A blur of 0 is one rectangle. `Modifier.dropShadow` exists in the newest AndroidX sources, but its presence in the pinned Compose UI 1.12 and its result below Android 12 were not verified, and a blur mask filter on the drawing layer is not reliable on API 26 and 27; the stacked version needs neither.
5. **Press feedback is the web's, per control** (reference 5.7): round button 0.92, Back pill 0.96, pills 2 down plus 0.98 plus the `press` shadow in place of the `button` shadow, cards, the quiet button and the continue line 0.98, all over the `press` transition (120 ms, `ease`) from the tokens; with reduced motion the press is instant. A dimmed pill (the web's `aria-disabled`) takes no press, shows no shadow, is drawn at 0.45, ignores clicks and stays in the accessibility tree as disabled. Only the pass fields and the continue line show the `press` colour, as a bounded circle that grows from the touch point and fades out on release (`PressTint`); Material's `ripple` is not used because it multiplies the colour's alpha by its own pressed alpha, and the token's 0.05 would be invisible. Every other control passes `indication = null`.
6. **Cards and stamps are one accessible element each.** A destination card is a button whose name is the `label` given by the caller (reference 4.5); its visible texts are cleared from the accessibility tree. An unavailable card is a disabled group with the same rule and no click action. A stamp is one element named by its word ("Correct. New best" for the record stamp). The stub is hidden from screen readers by its caller, not here.
7. **Text may grow.** Fixed heights from the tokens are minimums (`heightIn(min = ...)`), and a card name may wrap where the web does not (`white-space: nowrap`), because wrapping is better than clipping at the largest font scale (spec 5.6). Review Focus 4 (font scale 200 percent) belongs to tasks 12 to 15; this task's part is the minimums, and task 15 captures the gallery sections at the largest font scale. None of the five Review Focus lines is owned by this task.
8. **No literal design values in composables** except geometry constants that no token carries and that sit in one named place with the web line they come from: the notch and perforation dash lengths (`PerforationGeometry`, `components/DestinationCard.tsx` and `BoardingPass.tsx`), the sky's cloud placement (`SkyGeometry`, `SkyBackdrop.tsx`), the press scales (`PressFeedback`), the stamp's landing frame (`StampLanding`, `components/easing.ts`), the Time is up delay (`STUB_TIME_UP_DELAY_MS`, `Stamp.tsx`), the route icon (`RouteIconSpec`) and the logo (`LogoPaths`). The debug gallery is not part of the shipped UI and uses a few literal sizes.
9. **Focus is visible only for a hardware keyboard** (spec 5.6, reference 5.0): `keyboardFocusRing` draws a 2 wide ring in `focus` (the ink) 2 outside the control while it has focus and the input mode is `Keyboard`, never after a touch. Every control of this task carries it, before its clip.
10. **One frame rule.** `frameInsets` is spec 5.6's safe-area rule, written once, with the short-screen numbers (below 568: 8 and 12) from `Tokens.Native`; the start flow, the round, the leave sheet's card and the result use `rememberFrameInsets` or `TruthyFrame` and never compute insets themselves.
11. Not built here, by decision: the dimmed deck card of the offline web (it exists only offline, reference 7.1), the theme switch (task 12 puts a `RoundButton` and the moon or sun in the start flow), the continue line and the pass fields themselves (task 12), the boarding pass, the stub and the slip (task 13).

**Steps:**

- [ ] **Step 1: Check the ground this task stands on.**

```bash
cd android/Truthy
ls app/src/main/kotlin/com/eienmosu/truthy/design/Tokens.kt app/src/main/kotlin/com/eienmosu/truthy/design/Theme.kt app/src/main/kotlin/com/eienmosu/truthy/design/TypeRoles.kt app/src/main/kotlin/com/eienmosu/truthy/design/WindowTheme.kt
grep -rn 'fun logoMarkHeight' engine/src/main/kotlin || echo "no logoMarkHeight"
grep -n 'object Shadows\|object Transitions\|object Curves\|const val stampTimed' app/src/main/kotlin/com/eienmosu/truthy/design/Tokens.kt
grep -n 'val stampStub\|val stubValue\|val intentStamp' app/src/main/kotlin/com/eienmosu/truthy/design/TypeRoles.kt
grep -n 'testInstrumentationRunner\|ui-test-junit4\|ui.test.junit4\|ui-test-manifest\|ui.test.manifest' app/build.gradle.kts gradle/libs.versions.toml || echo "no instrumented test set-up"
grep -n 'src/debug\|debugImplementation' app/build.gradle.kts || echo "no debug dependencies"
ls app/src/debug 2>/dev/null || echo "no debug source set"
adb devices
```

Expected: the four design files are listed; one line `fun logoMarkHeight(width: Double = 44.0): Double` (if it prints `no logoMarkHeight`, the engine has the function under another name: use that name in `Logo.kt` and `LogoTest.kt`, nothing else changes); the generated file's `object Shadows`, `object Transitions`, `object Curves` and `const val stampTimed` lines; the three type roles; lines naming `testInstrumentationRunner` and the two Compose UI test artifacts (or the instruction in the next paragraph); either `no debug dependencies` or the existing lines; `no debug source set`; and `adb devices` listing one emulator as `device` (the API 36 emulator of task 7; start it from the command line or Android Studio if the list is empty, the connected tests of step 31 need it).

If the grep for the instrumented test set-up printed `no instrumented test set-up`, add to the `dependencies { }` block of `android/Truthy/app/build.gradle.kts` the two lines below (they take their version from the Compose BOM that `implementation` already declares) and, inside `android { defaultConfig { } }`, the runner line:

```kotlin
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
```

```kotlin
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
```

Stop and report instead of going on if a design file or a token name above is missing: task 8 is not complete.

- [ ] **Step 2: Let the unit tests read the web sources.**

The icon and logo tests compare the Kotlin path data with `components/icons.tsx` and `components/Logo.tsx`. Add to the end of `android/Truthy/app/build.gradle.kts` (the path is computed from the project directory at build time; nothing absolute is written into a committed file):

```kotlin
tasks.withType<Test>().configureEach {
    systemProperty("truthy.repo", rootDir.resolve("../..").path)
    inputs.files(
        rootDir.resolve("../../components/icons.tsx"),
        rootDir.resolve("../../components/Logo.tsx"),
    )
}
```

Create `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/WebSource.kt`:

```kotlin
package com.eienmosu.truthy.design

import java.io.File

/** Reads a file of the web app, relative to the repository root that the Gradle test task passes in. */
object WebSource {
    fun read(relative: String): String {
        val root = requireNotNull(System.getProperty("truthy.repo")) {
            "The system property truthy.repo is missing; it is set in app/build.gradle.kts"
        }
        return File(root, relative).readText()
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:compileDebugUnitTestKotlin
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Write the tests of the icon path data (they fail: no `IconPaths` yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/IconPathsTest.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.ui.graphics.vector.PathNode
import androidx.compose.ui.graphics.vector.PathParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class IconPathsTest {
    // ICON_PATHS of components/icons.tsx: name: "path data", in the web's order.
    private fun webPaths(): Map<String, String> {
        val source = WebSource.read("components/icons.tsx")
        val block = Regex("ICON_PATHS = \\{(.*?)\\} as const;", RegexOption.DOT_MATCHES_ALL).find(source)
        requireNotNull(block) { "ICON_PATHS not found in components/icons.tsx" }
        return Regex("(\\w+):\\s*\"([^\"]*)\"")
            .findAll(block.groupValues[1])
            .associate { it.groupValues[1] to it.groupValues[2] }
    }

    @Test
    fun thePathDataIsTheWebsPathDataUnchanged() {
        assertEquals(webPaths(), IconPaths.BY_WEB_NAME)
    }

    @Test
    fun thereAreNineteenEntriesInTheWebsOrder() {
        assertEquals(19, IconPaths.BY_WEB_NAME.size)
        assertEquals(webPaths().keys.toList(), IconPaths.BY_WEB_NAME.keys.toList())
    }

    @Test
    fun everyPathParsesAndStartsWithAMoveTo() {
        for ((name, data) in IconPaths.BY_WEB_NAME) {
            val nodes = PathParser().parsePathString(data).toNodes()
            assertTrue("$name parses to nodes", nodes.isNotEmpty())
            assertTrue("$name starts with M", nodes.first() is PathNode.MoveTo)
        }
    }

    @Test
    fun numbersAreWrittenShortAndWithADot() {
        assertEquals("358", pathNumber(358f))
        assertEquals("16.5", pathNumber(16.5f))
        assertEquals("5.7", pathNumber(5.7000003f))
        assertEquals("0", pathNumber(0.0004f))
        assertEquals("-0.4", pathNumber(-0.4f))
        assertEquals("-12", pathNumber(-12f))
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.IconPathsTest'
```

Expected: `BUILD FAILED` with `e: ... Unresolved reference: IconPaths` and `Unresolved reference: pathNumber` from `compileDebugUnitTestKotlin`.

- [ ] **Step 4: Write the path data.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/IconPaths.kt`:

```kotlin
package com.eienmosu.truthy.design

/**
 * ICON_PATHS of components/icons.tsx, unchanged (the design system says: copy them, do not redraw them).
 * The moon and the sun came later and are drawn in the same style. IconPathsTest compares every string with the web file.
 */
object IconPaths {
    const val CROSS = "M3 3l10 10M13 3L3 13"
    const val CHECK = "M3 9.5l4 4 8-9"
    const val BACK_HEADER = "M16 8H3M8 2.5L2.5 8 8 13.5"
    const val BACK_PILL = "M15 9H4M8.5 4L3.5 9l5 5"
    const val FORWARD = "M1 8h36M30 2l7 6-7 6"
    const val CHEVRON_RIGHT = "M6 3l5 5-5 5"
    const val CHEVRON_DOWN = "M2 4l4 4 4-4"
    const val PLANE_ARROW = "M-7 0h14M1-6l4 6-4 6M-6-3l2 3-2 3"
    const val CARRIER_CLOUD = "M5 15h13a4 4 0 0 0 .6-8A6 6 0 0 0 7.2 5.5 4.8 4.8 0 0 0 5 15z"
    const val SKY_CLOUD =
        "M0 46h150c0-12-10-20-22-20-2-14-14-24-29-24-12 0-22 6-26 16-4-3-9-5-15-5-12 0-21 8-23 19C24 28 20 26 15 26 6 26 0 34 0 46z"
    const val BOOK = "M3 3h5l1 1 1-1h5v12h-5l-1 1-1-1H3zM9 4v11"
    const val REPLAY = "M3.5 9a5.5 5.5 0 1 0 1.8-4.1M3.5 2.5v3h3"
    const val ROUTE_CURVE = "M5 10.5C10 10 10 4 15 3.5"
    const val CLOCK_HANDS = "M11 7.5V12l3 2M8.5 2h5"
    const val STAR = "M9 1.8l2.1 4.5 4.9.6-3.6 3.4.9 4.9L9 12.8l-4.3 2.4.9-4.9L2 6.9l4.9-.6z"
    const val HEART =
        "M0 6.2C-1.5 4.3-3 3.2-5.1 3.2c-3.7 0-5.9 3.9-4.5 7.3C-7.5 15.1 0 19.7 0 19.7s7.5-4.6 9.6-9.2c1.4-3.4-.8-7.3-4.5-7.3C3 3.2 1.5 4.3 0 6.2z"
    const val HEART_SLASH = "M-8 18L8 3"
    const val MOON = "M15.8 9.6A6.8 6.8 0 1 1 8.4 2.2a5.3 5.3 0 0 0 7.4 7.4z"
    const val SUN_RAYS =
        "M9 1.5v1.6M9 14.9v1.6M1.5 9h1.6M14.9 9h1.6M3.7 3.7l1.1 1.1M13.2 13.2l1.1 1.1M3.7 14.3l1.1-1.1M13.2 4.8l1.1-1.1"

    /** The same strings under the web's key names, in the web's order. */
    val BY_WEB_NAME: Map<String, String> = linkedMapOf(
        "cross" to CROSS,
        "check" to CHECK,
        "backHeader" to BACK_HEADER,
        "backPill" to BACK_PILL,
        "forward" to FORWARD,
        "chevronRight" to CHEVRON_RIGHT,
        "chevronDown" to CHEVRON_DOWN,
        "planeArrow" to PLANE_ARROW,
        "carrierCloud" to CARRIER_CLOUD,
        "skyCloud" to SKY_CLOUD,
        "book" to BOOK,
        "replay" to REPLAY,
        "routeCurve" to ROUTE_CURVE,
        "clockHands" to CLOCK_HANDS,
        "star" to STAR,
        "heart" to HEART,
        "heartSlash" to HEART_SLASH,
        "moon" to MOON,
        "sunRays" to SUN_RAYS,
    )
}

/**
 * A number for path data: rounded to 3 decimals, no trailing ".0", always a dot (Float.toString does not depend on
 * the locale, String.format would).
 */
internal fun pathNumber(value: Float): String {
    val rounded = Math.round(value * 1000f) / 1000f
    return if (rounded == Math.floor(rounded.toDouble()).toFloat()) rounded.toLong().toString() else rounded.toString()
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.IconPathsTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.IconPathsTest.xml
```

Expected: `BUILD SUCCESSFUL` and `tests="4" skipped="0" failures="0" errors="0"`. If `thePathDataIsTheWebsPathDataUnchanged` fails, the web file changed since this plan was written: copy the new string into `IconPaths.kt` (never edit the test), and re-read reference 5.6 for a changed stroke or box.

- [ ] **Step 5: Write the tests of the 19 vectors (they fail: no `iconVector` yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/IconsTest.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.VectorGroup
import androidx.compose.ui.graphics.vector.VectorPath
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class IconsTest {
    private val day = Tokens.Colors.day

    private fun paths(group: VectorGroup): List<VectorPath> = group.flatMap { node ->
        when (node) {
            is VectorPath -> listOf(node)
            is VectorGroup -> paths(node)
        }
    }

    private fun paths(vector: ImageVector): List<VectorPath> = paths(vector.root)

    // Reference 5.6, icon by icon: drawn size in dp (width, height), the viewBox, how many paths, the stroke width
    // (null for a filled icon).
    private class Row(
        val id: IconId,
        val width: Float,
        val height: Float,
        val viewportWidth: Float,
        val viewportHeight: Float,
        val parts: Int,
        val stroke: Float?,
    )

    private val rows = listOf(
        Row(IconId.CLOSE, 16f, 16f, 16f, 16f, 1, 2.4f),
        Row(IconId.CROSS, 16f, 16f, 16f, 16f, 1, 3f),
        Row(IconId.CHECK, 18f, 18f, 18f, 18f, 1, 3f),
        Row(IconId.BACK_HEADER, 18f, 16f, 18f, 16f, 1, 2.4f),
        Row(IconId.BACK_PILL, 18f, 18f, 18f, 18f, 1, 2.2f),
        Row(IconId.FORWARD, 40f, 16f, 40f, 16f, 1, 2f),
        Row(IconId.CHEVRON_RIGHT, 16f, 16f, 16f, 16f, 1, 2.2f),
        Row(IconId.CHEVRON_DOWN, 12f, 12f, 12f, 12f, 1, 1.8f),
        Row(IconId.PLANE, 24f, 24f, 24f, 24f, 2, 2f),
        Row(IconId.CLOUD, 22f, 16f, 22f, 16f, 1, null),
        Row(IconId.SKY_CLOUD, 150f, 46f, 150f, 46f, 1, null),
        Row(IconId.BOOK, 18f, 18f, 18f, 18f, 1, 1.6f),
        Row(IconId.REPLAY, 18f, 18f, 18f, 18f, 1, 2.2f),
        Row(IconId.CLOCK, 22f, 22f, 22f, 22f, 2, 2.4f),
        Row(IconId.STAR, 18f, 18f, 18f, 18f, 1, null),
        Row(IconId.HEART, 20f, 20f, 22f, 22f, 1, null),
        Row(IconId.HEART_LOST, 20f, 20f, 22f, 22f, 2, 1.6f),
        Row(IconId.MOON, 18f, 18f, 18f, 18f, 1, 2f),
        Row(IconId.SUN, 18f, 18f, 18f, 18f, 2, 2f),
    )

    @Test
    fun thereAreNineteenIcons() {
        assertEquals(19, IconId.entries.size)
        assertEquals(IconId.entries.toSet(), rows.map { it.id }.toSet())
    }

    @Test
    fun everyIconHasTheReferenceSizeBoxAndStroke() {
        for (row in rows) {
            val vector = iconVector(row.id, colors = day)
            assertEquals("${row.id} width", row.width, vector.defaultWidth.value, 0.001f)
            assertEquals("${row.id} height", row.height, vector.defaultHeight.value, 0.001f)
            assertEquals("${row.id} viewport width", row.viewportWidth, vector.viewportWidth, 0.001f)
            assertEquals("${row.id} viewport height", row.viewportHeight, vector.viewportHeight, 0.001f)
            val parts = paths(vector.root)
            assertEquals("${row.id} paths", row.parts, parts.size)
            val stroked = parts.filter { it.stroke != null }
            if (row.stroke == null) {
                assertTrue("${row.id} is filled", parts.all { it.fill != null && it.stroke == null })
            } else {
                assertTrue("${row.id} has a stroke", stroked.isNotEmpty())
                for (part in stroked) assertEquals("${row.id} stroke", row.stroke, part.strokeLineWidth, 0.001f)
            }
        }
    }

    @Test
    fun capsAndJoinsAreTheWebsRoundOnesExceptWhereTheWebSetsNone() {
        val close = paths(iconVector(IconId.CLOSE, colors = day)).single()
        assertEquals(StrokeCap.Round, close.strokeLineCap)
        assertEquals(StrokeJoin.Round, close.strokeLineJoin)

        val book = paths(iconVector(IconId.BOOK, colors = day)).single()
        assertEquals(StrokeCap.Butt, book.strokeLineCap)
        assertEquals(StrokeJoin.Round, book.strokeLineJoin)

        val clock = paths(iconVector(IconId.CLOCK, colors = day))
        assertEquals(StrokeCap.Butt, clock[0].strokeLineCap)
        assertEquals(StrokeJoin.Miter, clock[0].strokeLineJoin)
        assertEquals(StrokeCap.Round, clock[1].strokeLineCap)
        assertEquals(StrokeJoin.Round, clock[1].strokeLineJoin)

        val lost = paths(iconVector(IconId.HEART_LOST, colors = day))
        assertEquals(StrokeCap.Butt, lost[0].strokeLineCap)
        assertEquals(StrokeJoin.Round, lost[0].strokeLineJoin)
        assertEquals(StrokeCap.Round, lost[1].strokeLineCap)
        assertEquals(StrokeJoin.Miter, lost[1].strokeLineJoin)
    }

    @Test
    fun aViewBoxThatDoesNotStartAtZeroIsMovedByAGroup() {
        val heart = iconVector(IconId.HEART, colors = day).root[0] as VectorGroup
        assertEquals(11f, heart.translationX, 0.001f)
        assertEquals(0f, heart.translationY, 0.001f)

        val plane = iconVector(IconId.PLANE, colors = day).root[0] as VectorGroup
        assertEquals(12f, plane.translationX, 0.001f)
        assertEquals(12f, plane.translationY, 0.001f)

        assertTrue(iconVector(IconId.CLOSE, colors = day).root[0] is VectorPath)
    }

    @Test
    fun thePlaneIsAnAccentDiscWithAnOnAccentArrow() {
        val parts = paths(iconVector(IconId.PLANE, colors = day))
        assertEquals(day.accent, (parts[0].fill as SolidColor).value)
        assertNull(parts[0].stroke)
        assertEquals(day.onAccent, (parts[1].stroke as SolidColor).value)
        assertNull(parts[1].fill)
        val night = Tokens.Colors.night
        assertEquals(night.accent, (paths(iconVector(IconId.PLANE, colors = night))[0].fill as SolidColor).value)
    }

    @Test
    fun aStrokeWidthCanBeOverriddenAsTheCrossAndTheCloseButtonShareOnePath() {
        val heavy = paths(iconVector(IconId.CLOSE, strokeWidth = 3f, colors = day)).single()
        assertEquals(3f, heavy.strokeLineWidth, 0.001f)
        assertNotNull(heavy.stroke)
        val sun = paths(iconVector(IconId.SUN, strokeWidth = 2.5f, colors = day))
        assertTrue(sun.all { it.strokeLineWidth == 2.5f })
    }

    @Test
    fun aCircleIsTwoArcs() {
        assertEquals("M5.7 9a3.3 3.3 0 1 0 6.6 0a3.3 3.3 0 1 0 -6.6 0z", circlePathData(9f, 9f, 3.3f))
        assertEquals("M-12 0a12 12 0 1 0 24 0a12 12 0 1 0 -24 0z", circlePathData(0f, 0f, 12f))
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.IconsTest'
```

Expected: `BUILD FAILED` with `Unresolved reference: IconId`, `iconVector` and `circlePathData`.

- [ ] **Step 6: Write the icon table and the vector builder.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Icons.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.foundation.layout.size
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** The 19 icons, as ImageVectors. The route icon (a dashed curve) is RouteIcon, drawn in code. */
enum class IconId {
    CLOSE, CROSS, CHECK, BACK_HEADER, BACK_PILL, FORWARD, CHEVRON_RIGHT, CHEVRON_DOWN, PLANE, CLOUD, SKY_CLOUD,
    BOOK, REPLAY, CLOCK, STAR, HEART, HEART_LOST, MOON, SUN,
}

internal enum class IconPaint { CURRENT, ACCENT, ON_ACCENT }

internal class IconPart(
    val pathData: String,
    val fill: Boolean,
    val paint: IconPaint,
    val cap: StrokeCap,
    val join: StrokeJoin,
)

/**
 * One icon: the box the paths are drawn in (originX/originY are the viewBox's min-x and min-y), the width the web draws
 * it at by default, its default stroke width in viewBox units and its parts.
 */
internal class IconSpec(
    val originX: Float,
    val originY: Float,
    val viewportWidth: Float,
    val viewportHeight: Float,
    val defaultWidth: Float,
    val defaultStroke: Float,
    val tintable: Boolean,
    val parts: List<IconPart>,
)

internal fun circlePathData(cx: Float, cy: Float, r: Float): String {
    val radius = pathNumber(r)
    return "M${pathNumber(cx - r)} ${pathNumber(cy)}a$radius $radius 0 1 0 ${pathNumber(2 * r)} 0" +
        "a$radius $radius 0 1 0 ${pathNumber(-2 * r)} 0z"
}

private fun stroked(
    data: String,
    cap: StrokeCap = StrokeCap.Round,
    join: StrokeJoin = StrokeJoin.Round,
    paint: IconPaint = IconPaint.CURRENT,
) = IconPart(data, false, paint, cap, join)

private fun filled(data: String, paint: IconPaint = IconPaint.CURRENT) =
    IconPart(data, true, paint, StrokeCap.Butt, StrokeJoin.Miter)

private fun plain(
    size: Float,
    defaultStroke: Float,
    vararg parts: IconPart,
) = IconSpec(0f, 0f, size, size, size, defaultStroke, true, parts.toList())

// components/icons.tsx, component by component. The stroke widths are the web's defaults; the box is its viewBox.
private val SPECS: Map<IconId, IconSpec> = mapOf(
    IconId.CLOSE to plain(16f, 2.4f, stroked(IconPaths.CROSS)),
    IconId.CROSS to plain(16f, 3f, stroked(IconPaths.CROSS)),
    IconId.CHECK to plain(18f, 3f, stroked(IconPaths.CHECK)),
    IconId.BACK_HEADER to IconSpec(0f, 0f, 18f, 16f, 18f, 2.4f, true, listOf(stroked(IconPaths.BACK_HEADER))),
    IconId.BACK_PILL to plain(18f, 2.2f, stroked(IconPaths.BACK_PILL)),
    IconId.FORWARD to IconSpec(0f, 0f, 40f, 16f, 40f, 2f, true, listOf(stroked(IconPaths.FORWARD))),
    IconId.CHEVRON_RIGHT to plain(16f, 2.2f, stroked(IconPaths.CHEVRON_RIGHT)),
    IconId.CHEVRON_DOWN to plain(12f, 1.8f, stroked(IconPaths.CHEVRON_DOWN)),
    IconId.PLANE to IconSpec(
        -12f, -12f, 24f, 24f, 24f, 2f, false,
        listOf(
            filled(circlePathData(0f, 0f, 12f), IconPaint.ACCENT),
            stroked(IconPaths.PLANE_ARROW, paint = IconPaint.ON_ACCENT),
        ),
    ),
    IconId.CLOUD to IconSpec(0f, 0f, 22f, 16f, 22f, 0f, true, listOf(filled(IconPaths.CARRIER_CLOUD))),
    IconId.SKY_CLOUD to IconSpec(0f, 0f, 150f, 46f, 150f, 0f, true, listOf(filled(IconPaths.SKY_CLOUD))),
    IconId.BOOK to plain(18f, 1.6f, stroked(IconPaths.BOOK, cap = StrokeCap.Butt)),
    IconId.REPLAY to plain(18f, 2.2f, stroked(IconPaths.REPLAY)),
    IconId.CLOCK to plain(
        22f, 2.4f,
        stroked(circlePathData(11f, 12f, 8f), cap = StrokeCap.Butt, join = StrokeJoin.Miter),
        stroked(IconPaths.CLOCK_HANDS),
    ),
    IconId.STAR to plain(18f, 0f, filled(IconPaths.STAR)),
    IconId.HEART to IconSpec(-11f, 0f, 22f, 22f, 20f, 0f, true, listOf(filled(IconPaths.HEART))),
    IconId.HEART_LOST to IconSpec(
        -11f, 0f, 22f, 22f, 20f, 1.6f, true,
        listOf(
            stroked(IconPaths.HEART, cap = StrokeCap.Butt, join = StrokeJoin.Round),
            stroked(IconPaths.HEART_SLASH, cap = StrokeCap.Round, join = StrokeJoin.Miter),
        ),
    ),
    IconId.MOON to plain(18f, 2f, stroked(IconPaths.MOON)),
    IconId.SUN to plain(
        18f, 2f,
        stroked(circlePathData(9f, 9f, 3.3f)),
        stroked(IconPaths.SUN_RAYS),
    ),
)

internal fun iconSpec(id: IconId): IconSpec = SPECS.getValue(id)

private fun paintColor(paint: IconPaint, colors: TruthyColors?): Color = when (paint) {
    IconPaint.CURRENT -> Color.Black
    IconPaint.ACCENT -> requireNotNull(colors) { "This icon has two colours; pass the theme's colours" }.accent
    IconPaint.ON_ACCENT -> requireNotNull(colors) { "This icon has two colours; pass the theme's colours" }.onAccent
}

/**
 * The icon as an ImageVector. Single colour icons are black and are tinted where they are drawn; the plane takes its two
 * colours from [colors]. [strokeWidth] replaces the icon's default in viewBox units (the web passes 3 to the close cross
 * for False, for instance); filled icons ignore it.
 */
fun iconVector(id: IconId, strokeWidth: Float? = null, colors: TruthyColors? = null): ImageVector {
    val spec = iconSpec(id)
    val width = strokeWidth ?: spec.defaultStroke
    // The web rounds the proportional height to 2 decimals (icons.tsx round()).
    val height = Math.round(spec.defaultWidth * spec.viewportHeight / spec.viewportWidth * 100f) / 100f
    val builder = ImageVector.Builder(
        name = id.name,
        defaultWidth = spec.defaultWidth.dp,
        defaultHeight = height.dp,
        viewportWidth = spec.viewportWidth,
        viewportHeight = spec.viewportHeight,
    )
    val shifted = spec.originX != 0f || spec.originY != 0f
    if (shifted) builder.addGroup(translationX = -spec.originX, translationY = -spec.originY)
    for (part in spec.parts) {
        val nodes = PathParser().parsePathString(part.pathData).toNodes()
        val brush = SolidColor(paintColor(part.paint, colors))
        if (part.fill) {
            builder.addPath(nodes, fill = brush)
        } else {
            builder.addPath(
                nodes,
                stroke = brush,
                strokeLineWidth = width,
                strokeLineCap = part.cap,
                strokeLineJoin = part.join,
            )
        }
    }
    return builder.build()
}

/**
 * An icon. Decorative unless [label] is given (the web hides icons from screen readers unless they carry a label).
 * [width] replaces the default drawn width; the height follows the icon's proportions. [tint] colours single colour icons.
 */
@Composable
fun TruthyIcon(
    id: IconId,
    modifier: Modifier = Modifier,
    tint: Color = TruthyTheme.colors.ink,
    width: Dp? = null,
    strokeWidth: Float? = null,
    label: String? = null,
) {
    val colors = TruthyTheme.colors
    val spec = iconSpec(id)
    val vector = remember(id, strokeWidth, colors) { iconVector(id, strokeWidth, colors) }
    val painter = rememberVectorPainter(vector)
    val drawnWidth = width ?: vector.defaultWidth
    val drawnHeight = drawnWidth * (spec.viewportHeight / spec.viewportWidth)
    Image(
        painter = painter,
        contentDescription = label,
        modifier = modifier.size(drawnWidth, drawnHeight),
        colorFilter = if (spec.tintable) ColorFilter.tint(tint) else null,
    )
}

/** components/icons.tsx RouteIcon: two ringed stops joined by a dashed curve, 20 by 14, stroke 1.8. */
object RouteIconSpec {
    const val WIDTH = 20f
    const val HEIGHT = 14f
    const val STROKE = 1.8f
    const val RADIUS = 2f
    const val DASH_ON = 2f
    const val DASH_OFF = 3f
    const val FROM_X = 3f
    const val FROM_Y = 11f
    const val TO_X = 17f
    const val TO_Y = 3f
}

/** Drawn in code because a vector cannot dash. [width] replaces the default drawn width. */
@Composable
fun RouteIcon(
    modifier: Modifier = Modifier,
    width: Dp = RouteIconSpec.WIDTH.dp,
    tint: Color = TruthyTheme.colors.ink,
) {
    val curve = remember { PathParser().parsePathString(IconPaths.ROUTE_CURVE).toPath() }
    val height = width * (RouteIconSpec.HEIGHT / RouteIconSpec.WIDTH)
    Canvas(modifier.size(width, height)) {
        val k = size.width / RouteIconSpec.WIDTH
        val ring = Stroke(width = RouteIconSpec.STROKE * k)
        drawCircle(tint, RouteIconSpec.RADIUS * k, Offset(RouteIconSpec.FROM_X * k, RouteIconSpec.FROM_Y * k), style = ring)
        drawCircle(tint, RouteIconSpec.RADIUS * k, Offset(RouteIconSpec.TO_X * k, RouteIconSpec.TO_Y * k), style = ring)
        withTransform({ scale(k, k, pivot = Offset.Zero) }) {
            drawPath(
                curve,
                tint,
                style = Stroke(
                    width = RouteIconSpec.STROKE,
                    cap = StrokeCap.Round,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(RouteIconSpec.DASH_ON, RouteIconSpec.DASH_OFF)),
                ),
            )
        }
    }
}
```

`TruthyText.kt` is written in step 9; `Icons.kt` does not use it. `TruthyIcon` reads `TruthyTheme.colors`, which is the object from task 8's `Theme.kt`.

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.IconsTest' --tests 'com.eienmosu.truthy.design.IconPathsTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.IconsTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.IconPathsTest.xml
```

Expected: `BUILD SUCCESSFUL` and two lines, `tests="7" skipped="0" failures="0" errors="0"` (`IconsTest`) and `tests="4" skipped="0" failures="0" errors="0"` (`IconPathsTest`). If `everyIconHasTheReferenceSizeBoxAndStroke` fails on one icon, its message names the icon and the field: compare with the row of reference 5.6 and with `components/icons.tsx` before touching either side.

- [ ] **Step 7: Commit the icon data and vectors.**

```bash
git status --short
git add android/Truthy/app/build.gradle.kts android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/IconPaths.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Icons.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/WebSource.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/IconPathsTest.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/IconsTest.kt
git commit -m "feat: draw the 19 icons of the web as vectors from the same path data"
```

Expected: `git status --short` lists only files of the `git add` before the commit (a changed `libs.versions.toml` or a test dependency line in `app/build.gradle.kts` from step 1 is part of this commit: add `android/Truthy/gradle/libs.versions.toml` if step 1 changed it); one commit.

- [ ] **Step 8: Write the logo test (it fails: no `LogoPaths` yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/LogoTest.kt`:

```kotlin
package com.eienmosu.truthy.design

import com.eienmosu.truthy.engine.logoMarkHeight
import org.junit.Assert.assertEquals
import org.junit.Test

class LogoTest {
    // const TICKET = "..."; const TEAR = "..."; const CHECK = "..."; in components/Logo.tsx.
    private fun webConstant(name: String): String {
        val source = WebSource.read("components/Logo.tsx")
        val match = Regex("const $name =\\s*\"([^\"]*)\"").find(source)
        requireNotNull(match) { "const $name not found in components/Logo.tsx" }
        return match.groupValues[1]
    }

    @Test
    fun thePathDataIsTheWebsPathData() {
        assertEquals(webConstant("TICKET"), LogoPaths.TICKET)
        assertEquals(webConstant("TEAR"), LogoPaths.TEAR)
        assertEquals(webConstant("CHECK"), LogoPaths.CHECK)
    }

    @Test
    fun theMarkKeepsThe44By30Proportion() {
        assertEquals(44f, LogoPaths.WIDTH, 0.001f)
        assertEquals(30f, LogoPaths.HEIGHT, 0.001f)
        assertEquals(30.0, logoMarkHeight(44.0), 0.0001)
        assertEquals(17.73, logoMarkHeight(26.0), 0.0001)
        assertEquals(13.64, logoMarkHeight(20.0), 0.0001)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.LogoTest'
```

Expected: `BUILD FAILED` with `Unresolved reference: LogoPaths`.

- [ ] **Step 9: Write the text helper, the logo and run both icon and logo tests.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/TruthyText.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow

// Text without Material's content colour and text style locals: a type role from TruthyType and a colour from the theme.
// No text is selectable (spec section 2), which BasicText gives without a SelectionContainer.

@Composable
fun TruthyText(
    text: String,
    style: TextStyle,
    color: Color,
    modifier: Modifier = Modifier,
    textAlign: TextAlign? = null,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
) {
    BasicText(
        text = text,
        modifier = modifier,
        style = if (textAlign == null) style.copy(color = color) else style.copy(color = color, textAlign = textAlign),
        overflow = overflow,
        maxLines = maxLines,
    )
}

@Composable
fun TruthyText(
    text: AnnotatedString,
    style: TextStyle,
    color: Color,
    modifier: Modifier = Modifier,
    textAlign: TextAlign? = null,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
) {
    BasicText(
        text = text,
        modifier = modifier,
        style = if (textAlign == null) style.copy(color = color) else style.copy(color = color, textAlign = textAlign),
        overflow = overflow,
        maxLines = maxLines,
    )
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Logo.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.engine.logoMarkHeight

/** The app's name (reference 4.5). */
const val APP_NAME = "Truthy"

/** components/Logo.tsx: the ticket, the tear line and the check, in a 44 by 30 box. */
object LogoPaths {
    const val TICKET =
        "M6 0H38A6 6 0 0 1 44 6V10.5A4.5 4.5 0 0 0 44 19.5V24A6 6 0 0 1 38 30H6A6 6 0 0 1 0 24V19.5A4.5 4.5 0 0 0 0 10.5V6A6 6 0 0 1 6 0Z"
    const val TEAR = "M33 5v20"
    const val CHECK = "M9 15.5l4.5 4.5 9-10"
    const val WIDTH = 44f
    const val HEIGHT = 30f
    const val TEAR_STROKE = 1.6f
    const val TEAR_DASH_ON = 2.5f
    const val TEAR_DASH_OFF = 3f
    const val CHECK_STROKE = 3f
    const val COMPACT_CHECK_STROKE = 3.4f
}

enum class LogoVariant { FULL, COMPACT }

/**
 * The ticket mark on its own, always decorative. FULL: an accent ticket with the tear line and the check in on-accent
 * (44 wide beside the wordmark, 26 on the continue line). COMPACT: an on-accent ticket with an accent check and no tear
 * line (20 wide on the compact pass band). The tear line is drawn here because a vector cannot dash.
 */
@Composable
fun LogoMark(
    modifier: Modifier = Modifier,
    width: Dp = LogoPaths.WIDTH.dp,
    variant: LogoVariant = LogoVariant.FULL,
) {
    val colors = TruthyTheme.colors
    val ticket = remember { PathParser().parsePathString(LogoPaths.TICKET).toPath() }
    val check = remember { PathParser().parsePathString(LogoPaths.CHECK).toPath() }
    val height = logoMarkHeight(width.value.toDouble()).toFloat().dp
    Canvas(modifier.size(width, height)) {
        val k = size.width / LogoPaths.WIDTH
        withTransform({ scale(k, k, pivot = Offset.Zero) }) {
            if (variant == LogoVariant.FULL) {
                drawPath(ticket, colors.accent)
                drawLine(
                    colors.onAccent,
                    Offset(33f, 5f),
                    Offset(33f, 25f),
                    strokeWidth = LogoPaths.TEAR_STROKE,
                    cap = StrokeCap.Round,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(LogoPaths.TEAR_DASH_ON, LogoPaths.TEAR_DASH_OFF)),
                )
                drawPath(
                    check,
                    colors.onAccent,
                    style = Stroke(LogoPaths.CHECK_STROKE, cap = StrokeCap.Round, join = StrokeJoin.Round),
                )
            } else {
                drawPath(ticket, colors.onAccent)
                drawPath(
                    check,
                    colors.accent,
                    style = Stroke(LogoPaths.COMPACT_CHECK_STROKE, cap = StrokeCap.Round, join = StrokeJoin.Round),
                )
            }
        }
    }
}

/** The mark, a 12 gap (0.3333 of the 36 type size) and "Truthy" in the logo role. Start step 1 passes asHeading. */
@Composable
fun Logo(modifier: Modifier = Modifier, asHeading: Boolean = false) {
    Row(
        modifier = if (asHeading) modifier.semantics { heading() } else modifier,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LogoMark()
        // The web nudges the word down by 0.1111 of the type size (4) so it sits on the mark's centre line.
        TruthyText(APP_NAME, TruthyType.logo, TruthyTheme.colors.ink, Modifier.padding(top = Tokens.Space.s4))
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.LogoTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.LogoTest.xml
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`, `tests="2" skipped="0" failures="0" errors="0"`, and a second `BUILD SUCCESSFUL` from the compile (warnings about unused imports are fine; fix any error in `Icons.kt` or `Logo.kt` here).

- [ ] **Step 10: Commit the logo and the text helper.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/TruthyText.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Logo.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/LogoTest.kt
git commit -m "feat: draw the logo mark, with its dashed tear line, in code"
```

Expected: one commit; `git status --short` prints nothing for these files.

- [ ] **Step 11: Write the tests of the shapes and the perforations (they fail: no `TicketGeometry` yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/ShapesTest.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.ui.graphics.vector.PathNode
import androidx.compose.ui.graphics.vector.PathParser
import org.junit.Assert.assertEquals
import org.junit.Test

class ShapesTest {
    private fun arcs(data: String): List<PathNode.ArcTo> =
        PathParser().parsePathString(data).toNodes().filterIsInstance<PathNode.ArcTo>()

    // The main part of the ticket (BoardingPass.tsx notchedPaper(..., "bottom") inside rounded-t-card): top corners
    // 16, and a quarter circle of 12 cut into each bottom corner, centred on the corner.
    @Test
    fun theMainPartHasRoundTopCornersAndNotchedBottomCorners() {
        assertEquals(
            "M0 16A16 16 0 0 1 16 0L342 0A16 16 0 0 1 358 16L358 288A12 12 0 0 0 346 300L12 300A12 12 0 0 0 0 288Z",
            TicketGeometry.mainPathData(358f, 300f, 16f, 12f),
        )
    }

    // PassLower: notches at the top corners, radius 16 at the bottom (rounded-b-card).
    @Test
    fun theLowerPartHasNotchedTopCornersAndRoundBottomCorners() {
        assertEquals(
            "M12 0L346 0A12 12 0 0 0 358 12L358 212A16 16 0 0 1 342 228L16 228A16 16 0 0 1 0 212L0 12A12 12 0 0 0 12 0Z",
            TicketGeometry.lowerPathData(358f, 228f, 16f, 12f),
        )
    }

    // DestinationCard.tsx notchedCard: a half circle of 7 cut into the top and the bottom edge at x = width - stub.
    @Test
    fun theDestinationCardIsCutByTwoHalfCirclesOnTheStubLine() {
        assertEquals(
            "M0 16A16 16 0 0 1 16 0L271 0A7 7 0 0 0 285 0L342 0A16 16 0 0 1 358 16L358 112A16 16 0 0 1 342 128" +
                "L285 128A7 7 0 0 0 271 128L16 128A16 16 0 0 1 0 112Z",
            TicketGeometry.cardPathData(358f, 128f, 80f, 16f, 7f),
        )
    }

    // Clockwise corners turn with sweep 1; a notch bites into the paper with sweep 0.
    @Test
    fun cornersTurnClockwiseAndNotchesCounterClockwise() {
        assertEquals(
            listOf(true, true, false, false),
            arcs(TicketGeometry.mainPathData(358f, 300f, 16f, 12f)).map { it.isPositiveArc },
        )
        assertEquals(
            listOf(false, true, true, false),
            arcs(TicketGeometry.lowerPathData(358f, 228f, 16f, 12f)).map { it.isPositiveArc },
        )
        assertEquals(
            listOf(true, false, true, true, false, true),
            arcs(TicketGeometry.cardPathData(358f, 128f, 80f, 16f, 7f)).map { it.isPositiveArc },
        )
    }

    // BoardingPass.tsx PERFORATION: left and right at notch + 6, the bottom 2 of the main part, dashes 7 on, 5 off.
    @Test
    fun theTicketPerforationRunsBetweenTheNotchesAlongTheBottomEdge() {
        assertEquals(
            DashedLine(18f, 299f, 340f, 299f, 2f, 7f, 5f),
            PerforationGeometry.ticket(358f, 300f, 12f, 6f, 2f),
        )
    }

    // DestinationCard.tsx perforation: at the stub line, 12 from the top and the bottom, 1.5 wide, dashes 5 on, 5 off.
    @Test
    fun theCardPerforationRunsDownTheStubLine() {
        assertEquals(
            DashedLine(278f, 12f, 278f, 116f, 1.5f, 5f, 5f),
            PerforationGeometry.card(358f, 128f, 80f, 12f, 1.5f),
        )
    }

    // DS 9: two 1 px lines with a 1 px gap, the outer at radius 8 and the inner inset 2 at radius 6 (centre lines 7.5 and 5.5).
    @Test
    fun theVerdictStampHasADoubleBorder() {
        assertEquals(
            listOf(BorderLine(0.5f, 7.5f, 1f), BorderLine(2.5f, 5.5f, 1f)),
            StampBorder.lines(3f, 8f, true),
        )
    }

    // BoardingPass.tsx INTENT_STAMP: border 3 solid.
    @Test
    fun theIntentStampHasASolidBorder() {
        assertEquals(listOf(BorderLine(1.5f, 6.5f, 3f)), StampBorder.lines(3f, 8f, false))
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.ShapesTest'
```

Expected: `BUILD FAILED` with `Unresolved reference: TicketGeometry`, `DashedLine`, `PerforationGeometry`, `BorderLine` and `StampBorder`.

- [ ] **Step 12: Write the shapes.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Shapes.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection

// Path data, in dp-agnostic floats. In SVG path data with y pointing down, the sweep flag 1 is clockwise on screen: the
// corners (travelling clockwise round the paper) use it, the notches (half circles cut into the paper) use 0.

object TicketGeometry {
    private fun n(value: Float) = pathNumber(value)

    /** The main part: top corners [r], a quarter circle of [notch] cut into each bottom corner. */
    fun mainPathData(width: Float, height: Float, r: Float, notch: Float): String =
        "M0 ${n(r)}A${n(r)} ${n(r)} 0 0 1 ${n(r)} 0" +
            "L${n(width - r)} 0" +
            "A${n(r)} ${n(r)} 0 0 1 ${n(width)} ${n(r)}" +
            "L${n(width)} ${n(height - notch)}" +
            "A${n(notch)} ${n(notch)} 0 0 0 ${n(width - notch)} ${n(height)}" +
            "L${n(notch)} ${n(height)}" +
            "A${n(notch)} ${n(notch)} 0 0 0 0 ${n(height - notch)}Z"

    /** The lower part (stub, slip or list): a quarter circle of [notch] cut into each top corner, bottom corners [r]. */
    fun lowerPathData(width: Float, height: Float, r: Float, notch: Float): String =
        "M${n(notch)} 0" +
            "L${n(width - notch)} 0" +
            "A${n(notch)} ${n(notch)} 0 0 0 ${n(width)} ${n(notch)}" +
            "L${n(width)} ${n(height - r)}" +
            "A${n(r)} ${n(r)} 0 0 1 ${n(width - r)} ${n(height)}" +
            "L${n(r)} ${n(height)}" +
            "A${n(r)} ${n(r)} 0 0 1 0 ${n(height - r)}" +
            "L0 ${n(notch)}" +
            "A${n(notch)} ${n(notch)} 0 0 0 ${n(notch)} 0Z"

    /** A destination card: corners [r], a half circle of [notch] cut into the top and the bottom edge on the stub line. */
    fun cardPathData(width: Float, height: Float, stub: Float, r: Float, notch: Float): String {
        val x = width - stub
        return "M0 ${n(r)}A${n(r)} ${n(r)} 0 0 1 ${n(r)} 0" +
            "L${n(x - notch)} 0" +
            "A${n(notch)} ${n(notch)} 0 0 0 ${n(x + notch)} 0" +
            "L${n(width - r)} 0" +
            "A${n(r)} ${n(r)} 0 0 1 ${n(width)} ${n(r)}" +
            "L${n(width)} ${n(height - r)}" +
            "A${n(r)} ${n(r)} 0 0 1 ${n(width - r)} ${n(height)}" +
            "L${n(x + notch)} ${n(height)}" +
            "A${n(notch)} ${n(notch)} 0 0 0 ${n(x - notch)} ${n(height)}" +
            "L${n(r)} ${n(height)}" +
            "A${n(r)} ${n(r)} 0 0 1 0 ${n(height - r)}Z"
    }
}

private fun outlineOf(data: String): Outline = Outline.Generic(PathParser().parsePathString(data).toPath())

data class TicketMainShape(
    val cornerRadius: Dp = Tokens.Radius.card,
    val notchRadius: Dp = Tokens.Size.notch,
) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline =
        outlineOf(
            TicketGeometry.mainPathData(
                size.width,
                size.height,
                with(density) { cornerRadius.toPx() },
                with(density) { notchRadius.toPx() },
            ),
        )
}

data class TicketLowerShape(
    val cornerRadius: Dp = Tokens.Radius.card,
    val notchRadius: Dp = Tokens.Size.notch,
) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline =
        outlineOf(
            TicketGeometry.lowerPathData(
                size.width,
                size.height,
                with(density) { cornerRadius.toPx() },
                with(density) { notchRadius.toPx() },
            ),
        )
}

data class DestinationCardShape(
    val stubWidth: Dp,
    val cornerRadius: Dp = Tokens.Radius.card,
    val notchRadius: Dp = Tokens.Size.cardNotch,
) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline =
        outlineOf(
            TicketGeometry.cardPathData(
                size.width,
                size.height,
                with(density) { stubWidth.toPx() },
                with(density) { cornerRadius.toPx() },
                with(density) { notchRadius.toPx() },
            ),
        )
}

/** A straight dashed line in dp, drawn with butt ends (the web's repeating-linear-gradient). */
data class DashedLine(
    val x1: Float,
    val y1: Float,
    val x2: Float,
    val y2: Float,
    val width: Float,
    val on: Float,
    val off: Float,
)

object PerforationGeometry {
    // BoardingPass.tsx PERFORATION: repeating-linear-gradient(90deg, rule 0 7px, transparent 7px 12px).
    const val TICKET_DASH_ON = 7f
    const val TICKET_DASH_OFF = 5f

    // DestinationCard.tsx PERFORATION: repeating-linear-gradient(180deg, rule 0 5px, transparent 5px 10px).
    const val CARD_DASH_ON = 5f
    const val CARD_DASH_OFF = 5f

    /** Along the bottom [stroke] of the main part, [notch] + [inset] from each side. */
    fun ticket(width: Float, height: Float, notch: Float, inset: Float, stroke: Float): DashedLine =
        DashedLine(
            notch + inset,
            height - stroke / 2f,
            width - notch - inset,
            height - stroke / 2f,
            stroke,
            TICKET_DASH_ON,
            TICKET_DASH_OFF,
        )

    /** Down the stub line, [inset] from the top and the bottom. */
    fun card(width: Float, height: Float, stub: Float, inset: Float, stroke: Float): DashedLine =
        DashedLine(width - stub, inset, width - stub, height - inset, stroke, CARD_DASH_ON, CARD_DASH_OFF)
}

private fun DrawScope.drawDashedLine(line: DashedLine, color: Color) {
    val d = density
    drawLine(
        color = color,
        start = Offset(line.x1 * d, line.y1 * d),
        end = Offset(line.x2 * d, line.y2 * d),
        strokeWidth = line.width * d,
        cap = StrokeCap.Butt,
        pathEffect = PathEffect.dashPathEffect(floatArrayOf(line.on * d, line.off * d)),
    )
}

/** The dashed line at the bottom of the main part of a ticket; call it from drawBehind on the part. */
fun DrawScope.drawTicketPerforation(color: Color) {
    val d = density
    drawDashedLine(
        PerforationGeometry.ticket(
            size.width / d,
            size.height / d,
            Tokens.Size.notch.value,
            Tokens.Space.s6.value,
            Tokens.Stroke.perforation.value,
        ),
        color,
    )
}

/** The dashed line on a destination card's stub line; call it from drawBehind on the card. */
fun DrawScope.drawCardPerforation(color: Color, stubWidth: Dp) {
    val d = density
    drawDashedLine(
        PerforationGeometry.card(
            size.width / d,
            size.height / d,
            stubWidth.value,
            Tokens.Space.s12.value,
            Tokens.Stroke.rule.value,
        ),
        color,
    )
}

/** One border line: its centre line's inset from the box, the corner radius of the centre line and its width. */
data class BorderLine(val inset: Float, val cornerRadius: Float, val width: Float)

object StampBorder {
    /**
     * [total] is the CSS border width (3). A double border is three equal bands, line, gap, line; the outer edge of the
     * outer line has radius [radius], the outer edge of the inner line is inset by two bands. A solid border is one line.
     */
    fun lines(total: Float, radius: Float, double: Boolean): List<BorderLine> =
        if (double) {
            val band = total / 3f
            listOf(
                BorderLine(band / 2f, radius - band / 2f, band),
                BorderLine(2f * band + band / 2f, radius - 2f * band - band / 2f, band),
            )
        } else {
            listOf(BorderLine(total / 2f, radius - total / 2f, total))
        }
}

/** Draws the stamp's border inside the box in [color]. The caller adds `padding(total)` before its own padding. */
fun Modifier.stampBorder(
    color: Color,
    double: Boolean,
    radius: Dp = Tokens.Radius.small,
    total: Dp = Tokens.Stroke.stamp,
): Modifier = drawBehind {
    for (line in StampBorder.lines(total.toPx(), radius.toPx(), double)) {
        drawRoundRect(
            color = color,
            topLeft = Offset(line.inset, line.inset),
            size = Size(size.width - 2f * line.inset, size.height - 2f * line.inset),
            cornerRadius = CornerRadius(line.cornerRadius),
            style = Stroke(width = line.width),
        )
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.ShapesTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.ShapesTest.xml
```

Expected: `BUILD SUCCESSFUL` and `tests="8" skipped="0" failures="0" errors="0"`. If `cornersTurnClockwiseAndNotchesCounterClockwise` fails, a notch arc has the wrong sweep: the notch must bite into the paper (the half circle's middle lies inside the box), which is sweep 0 in all three shapes; the exact-string tests then fail with it.

- [ ] **Step 13: Write the tests of the shadows (they fail: no `ShadowMath` yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/ShadowsTest.kt`:

```kotlin
package com.eienmosu.truthy.design

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ShadowsTest {
    @Test
    fun theNormalCdfMatchesTheTable() {
        assertEquals(0.5, ShadowMath.normalCdf(0.0), 1e-6)
        assertEquals(0.8413447, ShadowMath.normalCdf(1.0), 1e-6)
        assertEquals(0.0227501, ShadowMath.normalCdf(-2.0), 1e-6)
        assertEquals(0.9772499, ShadowMath.normalCdf(2.0), 1e-6)
    }

    @Test
    fun noBlurIsOneRectangleOfTheColoursAlpha() {
        assertEquals(listOf(ShadowPass(0f, 0.1f)), ShadowMath.passes(0f, 0.1f))
    }

    // The ticket's second layer: blur 36, so sigma 18 and the passes run from +36 down to -36.
    @Test
    fun thePassesRunFromTwoSigmaOutsideToTwoSigmaInsideAndNeverGoNegative() {
        val passes = ShadowMath.passes(36f, 0.45f)
        assertEquals(14, passes.size)
        assertEquals(36f, passes.first().expand, 1e-3f)
        assertEquals(-36f, passes.last().expand, 1e-3f)
        for (i in 1 until passes.size) assertTrue("pass $i is inside pass ${i - 1}", passes[i].expand < passes[i - 1].expand)
        assertTrue(passes.all { it.alpha in 0f..1f })
    }

    @Test
    fun theStackedAlphaReachesTheColoursAlphaInTheMiddle() {
        val passes = ShadowMath.passes(36f, 0.45f)
        val uncovered = passes.fold(1.0) { acc, pass -> acc * (1.0 - pass.alpha) }
        assertEquals(0.45, 1.0 - uncovered, 1e-5)
    }

    // At the edge of the shadow rectangle (distance 0) a Gaussian edge is half of the full alpha: after the 7 outer passes
    // the band that contains distance 0 is covered by exactly those.
    @Test
    fun theStackedAlphaAtTheEdgeIsHalfOfTheColoursAlpha() {
        val passes = ShadowMath.passes(36f, 0.45f)
        val uncovered = passes.take(7).fold(1.0) { acc, pass -> acc * (1.0 - pass.alpha) }
        assertEquals(0.225, 1.0 - uncovered, 1e-4)
    }

    // Reference 5.5, ticket, day: 0 22 36 -18 in ink at 0.45. The rectangle shrinks by 18 on each side, moves down 22,
    // and its corner radius 16 shrinks to 0.
    @Test
    fun theTicketShadowRectangleIsInsetByTheNegativeSpread() {
        val layer = Tokens.Shadows.day.ticket.layers[1]
        assertEquals(22f, layer.offsetY.value, 0.001f)
        assertEquals(36f, layer.blur.value, 0.001f)
        assertEquals(-18f, layer.spread.value, 0.001f)
        assertEquals(0.45f, layer.color.alpha, 0.005f)
        val rect = ShadowMath.rect(358f, 300f, 16f, layer.offsetX.value, layer.offsetY.value, layer.spread.value)
        assertEquals(ShadowRect(18f, 40f, 340f, 304f, 0f), rect)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.ShadowsTest'
```

Expected: `BUILD FAILED` with `Unresolved reference: ShadowMath`, `ShadowPass` and `ShadowRect`.

- [ ] **Step 14: Write the shadows.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Shadows.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.sqrt

/** One rounded rectangle of a shadow's stack: how far it is grown (negative: shrunk) and its alpha. */
data class ShadowPass(val expand: Float, val alpha: Float)

/** A shadow layer's rectangle in the element's coordinates. */
data class ShadowRect(val left: Float, val top: Float, val right: Float, val bottom: Float, val cornerRadius: Float)

object ShadowMath {
    const val PASS_COUNT = 14
    const val SIGMA_SPAN = 2.0

    /** The standard normal distribution function (Abramowitz and Stegun 7.1.26, error below 1.5e-7). */
    fun normalCdf(z: Double): Double {
        val x = abs(z) / sqrt(2.0)
        val t = 1.0 / (1.0 + 0.3275911 * x)
        val polynomial = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
        val erf = 1.0 - polynomial * exp(-x * x)
        return if (z >= 0.0) 0.5 * (1.0 + erf) else 0.5 * (1.0 - erf)
    }

    /**
     * The stack for a blur of [blur] (the CSS blur radius, so sigma is blur / 2) and a colour alpha of [alpha], outermost
     * first. A rectangle grown by e covers every point whose distance outside the shadow rectangle is at most e. The point
     * in the band between two neighbouring rectangles is covered by all the rectangles outside it, so each alpha is chosen
     * to bring the running total to alpha * normalCdf(-distance / sigma) at the middle of its band, and the innermost to
     * the full alpha.
     */
    fun passes(blur: Float, alpha: Float, count: Int = PASS_COUNT): List<ShadowPass> {
        if (blur <= 0f || alpha <= 0f) return listOf(ShadowPass(0f, alpha))
        val sigma = blur / 2.0
        val span = SIGMA_SPAN * sigma
        val edges = DoubleArray(count) { k -> span - 2.0 * span * k / (count - 1) }
        val result = ArrayList<ShadowPass>(count)
        var covered = 0.0
        for (j in 0 until count) {
            val target = if (j == count - 1) {
                alpha.toDouble()
            } else {
                alpha * normalCdf(-((edges[j] + edges[j + 1]) / 2.0) / sigma)
            }
            val own = 1.0 - (1.0 - target) / (1.0 - covered)
            result += ShadowPass(edges[j].toFloat(), own.coerceIn(0.0, 1.0).toFloat())
            covered = target
        }
        return result
    }

    /**
     * CSS: the shadow rectangle is the border box grown by [spread] and moved by the offset; the corner radius grows
     * with the spread and never goes below 0.
     */
    fun rect(width: Float, height: Float, cornerRadius: Float, offsetX: Float, offsetY: Float, spread: Float): ShadowRect =
        ShadowRect(
            left = -spread + offsetX,
            top = -spread + offsetY,
            right = width + spread + offsetX,
            bottom = height + spread + offsetY,
            cornerRadius = max(0f, cornerRadius + spread),
        )
}

private class ShadowPlan(val layer: ShadowLayer, val passes: List<ShadowPass>)

/**
 * Draws [spec] behind the element, whose paper has corner radius [cornerRadius]. [alpha] scales the whole shadow, read
 * while drawing (the pill cross-fades its button shadow into its press shadow with it).
 */
@Composable
fun Modifier.truthyShadow(
    spec: ShadowSpec,
    cornerRadius: Dp = Tokens.Radius.card,
    alpha: () -> Float = { 1f },
): Modifier {
    val density = LocalDensity.current.density
    val plans = remember(spec, density) {
        spec.layers.map { layer -> ShadowPlan(layer, ShadowMath.passes(layer.blur.value * density, layer.color.alpha)) }
    }
    return drawBehind {
        val scale = alpha()
        if (scale <= 0f) return@drawBehind
        for (plan in plans) {
            val layer = plan.layer
            val rect = ShadowMath.rect(
                size.width,
                size.height,
                cornerRadius.toPx(),
                layer.offsetX.toPx(),
                layer.offsetY.toPx(),
                layer.spread.toPx(),
            )
            for (pass in plan.passes) {
                val width = rect.right - rect.left + 2f * pass.expand
                val height = rect.bottom - rect.top + 2f * pass.expand
                if (width <= 0f || height <= 0f) continue
                drawRoundRect(
                    color = layer.color.copy(alpha = pass.alpha * scale),
                    topLeft = Offset(rect.left - pass.expand, rect.top - pass.expand),
                    size = Size(width, height),
                    cornerRadius = CornerRadius(max(0f, rect.cornerRadius + pass.expand)),
                )
            }
        }
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.ShadowsTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.ShadowsTest.xml
```

Expected: `BUILD SUCCESSFUL` and `tests="6" skipped="0" failures="0" errors="0"`. The layers are passed in dp and `layer.blur.value * density` is the blur in px, so the plan is built once per density and theme.

- [ ] **Step 15: Write the tests of the sky (they fail: no `SkyGeometry` yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/SkyTest.kt`:

```kotlin
package com.eienmosu.truthy.design

import org.junit.Assert.assertEquals
import org.junit.Test

class SkyTest {
    // SkyBackdrop.tsx: linear-gradient(180deg, sky-1 0%, sky-2 35%, sky-3 62%, sky-4 100%), from plan A's native group.
    @Test
    fun theGradientHasTheFourSmoothStops() {
        assertEquals(listOf(0f, 0.35f, 0.62f, 1f), Tokens.Native.skyStops)
    }

    // 412 wide is narrower than the 430 frame, so the frame is the viewport: the upper cloud 30 off the left edge at 196,
    // the lower one 40 off the right edge (170 wide, so it starts at 412 + 40 - 170).
    @Test
    fun theCloudsOfAPhoneSitInsideTheViewport() {
        assertEquals(CloudRect(-30f, 196f, 150f, 46f), SkyGeometry.upper(412f, 430f))
        assertEquals(CloudRect(282f, 620f, 170f, 50f), SkyGeometry.lower(412f, 430f, 620f))
    }

    // 600 wide: the 430 frame is centred, 85 from each side.
    @Test
    fun theCloudsOfAWideScreenSitInsideTheCentredFrame() {
        assertEquals(CloudRect(55f, 196f, 150f, 46f), SkyGeometry.upper(600f, 430f))
        assertEquals(CloudRect(385f, 620f, 170f, 50f), SkyGeometry.lower(600f, 430f, 620f))
    }

    @Test
    fun theStartFlowPutsTheLowerCloudLower() {
        assertEquals(620f, LowerCloud.GAME.top, 0f)
        assertEquals(660f, LowerCloud.START.top, 0f)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.SkyTest'
```

Expected: `BUILD FAILED` with `Unresolved reference: SkyGeometry`, `CloudRect` and `LowerCloud`.

- [ ] **Step 16: Write the sky and run the shapes, shadows and sky tests.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Sky.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.unit.dp
import kotlin.math.min

/** Top of the lower cloud in dp: 620 on the game and result screens, 660 in the start flow (under its foot zone). */
enum class LowerCloud(val top: Float) { GAME(620f), START(660f) }

data class CloudRect(val x: Float, val y: Float, val width: Float, val height: Float)

/** components/SkyBackdrop.tsx and reference 5.1: the stops and the two clouds, in dp inside the 430 frame. */
object SkyGeometry {
    // The gradient's stops are Tokens.Native.skyStops (plan A's native group), not a constant here.

    private const val UPPER_LEFT = -30f
    private const val UPPER_TOP = 196f
    private const val UPPER_WIDTH = 150f
    private const val UPPER_HEIGHT = 46f
    private const val LOWER_RIGHT = -40f
    private const val LOWER_WIDTH = 170f
    private const val LOWER_HEIGHT = 50f

    private fun frameLeft(viewportWidth: Float, frameMax: Float) = (viewportWidth - min(viewportWidth, frameMax)) / 2f

    fun upper(viewportWidth: Float, frameMax: Float): CloudRect =
        CloudRect(frameLeft(viewportWidth, frameMax) + UPPER_LEFT, UPPER_TOP, UPPER_WIDTH, UPPER_HEIGHT)

    fun lower(viewportWidth: Float, frameMax: Float, top: Float): CloudRect {
        val frameRight = frameLeft(viewportWidth, frameMax) + min(viewportWidth, frameMax)
        return CloudRect(frameRight - LOWER_RIGHT - LOWER_WIDTH, top, LOWER_WIDTH, LOWER_HEIGHT)
    }
}

/**
 * The calm ground of every screen: the four sky colours blended from top to bottom and two clouds. As wide and as tall as
 * its parent (put it first in a full-screen Box); the clouds stay inside the 430 wide frame. It takes no touches and has
 * no accessibility semantics.
 */
@Composable
fun SkyBackdrop(modifier: Modifier = Modifier, lowerCloud: LowerCloud = LowerCloud.GAME) {
    val colors = TruthyTheme.colors
    val sky = remember(colors) {
        val tones = listOf(colors.sky1, colors.sky2, colors.sky3, colors.sky4)
        val stops = Array(tones.size) { i -> Tokens.Native.skyStops[i] to tones[i] }
        Brush.verticalGradient(*stops)
    }
    val painter = rememberVectorPainter(remember { iconVector(IconId.SKY_CLOUD) })
    BoxWithConstraints(modifier.fillMaxSize().background(sky)) {
        val frameMax = Tokens.Size.maxWidth.value
        val upper = SkyGeometry.upper(maxWidth.value, frameMax)
        val lower = SkyGeometry.lower(maxWidth.value, frameMax, lowerCloud.top)
        val tint = ColorFilter.tint(colors.cloud)
        Image(
            painter = painter,
            contentDescription = null,
            modifier = Modifier.offset(upper.x.dp, upper.y.dp).size(upper.width.dp, upper.height.dp),
            contentScale = ContentScale.FillBounds,
            alpha = Tokens.Opacity.cloud,
            colorFilter = tint,
        )
        Image(
            painter = painter,
            contentDescription = null,
            modifier = Modifier.offset(lower.x.dp, lower.y.dp).size(lower.width.dp, lower.height.dp),
            contentScale = ContentScale.FillBounds,
            alpha = Tokens.Opacity.cloud,
            colorFilter = tint,
        )
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.SkyTest' --tests 'com.eienmosu.truthy.design.ShapesTest' --tests 'com.eienmosu.truthy.design.ShadowsTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.SkyTest.xml
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`, `tests="4" skipped="0" failures="0" errors="0"` for the sky, and a second `BUILD SUCCESSFUL`. The sky vector is tinted with `cloud` at the token opacity, so by day the clouds are white at 0.7 and at night `#2c3a55` at 0.7 (reference 5.1).

- [ ] **Step 17: Commit the shapes, the shadows and the sky.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Shapes.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Shadows.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Sky.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/ShapesTest.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/ShadowsTest.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/SkyTest.kt
git commit -m "feat: draw the ticket papers, the perforations, the negative spread shadows and the sky"
```

Expected: one commit.

- [ ] **Step 18: Write the tests of the press feedback (they fail: no `PressFeedback` yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/MotionTest.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.animation.core.SnapSpec
import androidx.compose.animation.core.TweenSpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class MotionTest {
    // Reference 5.7, Press: round button 0.92, Back pill 0.96, pills 0.98 (and 2 down), cards, quiet button and continue
    // line 0.98.
    @Test
    fun theWebsPressScalesAreKept() {
        assertEquals(0.92f, PressFeedback.ROUND_SCALE, 0f)
        assertEquals(0.96f, PressFeedback.BACK_PILL_SCALE, 0f)
        assertEquals(0.98f, PressFeedback.PILL_SCALE, 0f)
        assertEquals(0.98f, PressFeedback.CARD_SCALE, 0f)
        assertEquals(0.98f, PressFeedback.QUIET_SCALE, 0f)
        assertEquals(0.98f, PressFeedback.CONTINUE_SCALE, 0f)
        assertEquals(2f, Tokens.Space.s2.value, 0f)
    }

    @Test
    fun aPressRunsOverTheTokenDurationOnTheTokenCurve() {
        val spec = pressSpec(false)
        assertTrue(spec is TweenSpec<*>)
        val tween = spec as TweenSpec<*>
        assertEquals(120, tween.durationMillis)
        assertEquals(0, tween.delay)
        assertSame(Tokens.Transitions.press.easing, tween.easing)
    }

    @Test
    fun withReducedMotionAPressIsInstant() {
        assertTrue(pressSpec(true) is SnapSpec<*>)
    }

    @Test
    fun theDisabledOpacityIsTheTokens() {
        assertEquals(0.45f, Tokens.Opacity.disabled, 0f)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.MotionTest'
```

Expected: `BUILD FAILED` with `Unresolved reference: PressFeedback` and `pressSpec`.

- [ ] **Step 19: Write the press feedback and the press tint.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Motion.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Whether the player asked for reduced motion (on Android: ANIMATOR_DURATION_SCALE is 0, spec 5.1). False by default; the
 * start flow and the round provide the real value once at the top of the tree (task 12), and nothing else defines it.
 */
val LocalReducedMotion = staticCompositionLocalOf { false }

/** Reference 5.7, Press: the scale each control reaches while it is held. */
object PressFeedback {
    const val ROUND_SCALE = 0.92f
    const val BACK_PILL_SCALE = 0.96f
    const val PILL_SCALE = 0.98f
    const val CARD_SCALE = 0.98f
    const val QUIET_SCALE = 0.98f
    const val CONTINUE_SCALE = 0.98f
}

/** The press transition of the tokens (120 ms, ease); instant with reduced motion. */
fun pressSpec(reducedMotion: Boolean): FiniteAnimationSpec<Float> =
    if (reducedMotion) {
        snap()
    } else {
        tween(durationMillis = Tokens.Transitions.press.durationMs, easing = Tokens.Transitions.press.easing)
    }

/** 0 at rest, 1 while pressed, animated with [pressSpec]. [active] false (a dimmed control) never leaves 0. */
@Composable
fun rememberPressProgress(interactionSource: InteractionSource, active: Boolean = true): State<Float> {
    val pressed by interactionSource.collectIsPressedAsState()
    val reduced = LocalReducedMotion.current
    return animateFloatAsState(
        targetValue = if (pressed && active) 1f else 0f,
        animationSpec = pressSpec(reduced),
        label = "press",
    )
}

/**
 * Scales the element to [pressedScale] and moves it [drop] down as [progress] goes from 0 to 1. The state is read in the
 * layer block, so a press redraws without recomposing. Put it before the shadow so the shadow moves with the element.
 */
fun Modifier.pressFeedback(progress: State<Float>, pressedScale: Float, drop: Dp = 0.dp): Modifier =
    graphicsLayer {
        val p = progress.value
        val s = 1f + (pressedScale - 1f) * p
        scaleX = s
        scaleY = s
        translationY = drop.toPx() * p
    }
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/PressTint.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.IndicationNodeFactory
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.node.DelegatableNode
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.unit.Dp
import kotlin.math.hypot
import kotlin.math.max
import kotlinx.coroutines.launch

/**
 * The `press` colour as a bounded circle that grows from the touch point to cover the element and fades out on release
 * (spec 5.6: pass fields and the continue line only). Material's ripple multiplies the colour's alpha by its own pressed
 * alpha, which would make the token's 0.05 invisible; this draws the colour as it is. Use with
 * `Modifier.clickable(interactionSource, rememberPressTint(radius)) { }`.
 */
class PressTint(
    private val color: Color,
    private val cornerRadius: Dp,
    private val reducedMotion: Boolean,
) : IndicationNodeFactory {
    override fun create(interactionSource: InteractionSource): DelegatableNode =
        PressTintNode(interactionSource, color, cornerRadius, reducedMotion)

    override fun equals(other: Any?): Boolean =
        other is PressTint && other.color == color && other.cornerRadius == cornerRadius && other.reducedMotion == reducedMotion

    override fun hashCode(): Int = 31 * (31 * color.hashCode() + cornerRadius.hashCode()) + reducedMotion.hashCode()
}

private class PressTintNode(
    private val interactionSource: InteractionSource,
    private val color: Color,
    private val cornerRadius: Dp,
    private val reducedMotion: Boolean,
) : Modifier.Node(), DrawModifierNode {
    private val reveal = Animatable(0f)
    private val shown = Animatable(0f)
    private var origin = Offset.Zero

    override fun onAttach() {
        coroutineScope.launch {
            interactionSource.interactions.collect { interaction ->
                when (interaction) {
                    is PressInteraction.Press -> {
                        origin = interaction.pressPosition
                        launch {
                            reveal.snapTo(0f)
                            reveal.animateTo(1f, pressSpec(reducedMotion))
                        }
                        launch { shown.snapTo(1f) }
                    }
                    is PressInteraction.Release, is PressInteraction.Cancel -> {
                        launch { shown.animateTo(0f, pressSpec(reducedMotion)) }
                    }
                    else -> Unit
                }
            }
        }
    }

    override fun ContentDrawScope.draw() {
        drawContent()
        val visible = shown.value
        if (visible <= 0f) return
        val shape = Path().apply {
            addRoundRect(RoundRect(0f, 0f, size.width, size.height, CornerRadius(cornerRadius.toPx())))
        }
        val farthest = hypot(max(origin.x, size.width - origin.x), max(origin.y, size.height - origin.y))
        clipPath(shape) {
            drawCircle(
                color = color.copy(alpha = color.alpha * visible),
                radius = farthest * reveal.value,
                center = origin,
            )
        }
    }
}

/** The press tint in the current theme's `press` colour. [cornerRadius] is the element's own (6 on the pass fields). */
@Composable
fun rememberPressTint(cornerRadius: Dp): PressTint {
    val color = TruthyTheme.colors.press
    val reduced = LocalReducedMotion.current
    return remember(color, cornerRadius, reduced) { PressTint(color, cornerRadius, reduced) }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.MotionTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.MotionTest.xml
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`, `tests="4" skipped="0" failures="0" errors="0"`, and a second `BUILD SUCCESSFUL`.

- [ ] **Step 20: Write the buttons.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/Buttons.kt`:

```kotlin
package com.eienmosu.truthy.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.PressFeedback
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyText
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.pressFeedback
import com.eienmosu.truthy.design.rememberPressProgress
import com.eienmosu.truthy.design.truthyShadow

enum class PillTone { INK, TRUE, FALSE }

enum class RoundVariant { RAISED, SUNK }

/**
 * The 60 pill (PillButton.tsx): "Next card →", "See results →", "Start round →", "Play again", and in the TRUE and FALSE
 * tones the answer buttons. [dimmed] is the web's aria-disabled: drawn at 0.45 with no shadow, takes no press, ignores
 * clicks, and stays in the accessibility tree as disabled so focus is not lost mid-round. The icons are decorative.
 */
@Composable
fun PillButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tone: PillTone = PillTone.INK,
    dimmed: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
) {
    val colors = TruthyTheme.colors
    val shadows = TruthyTheme.shadows
    val source = remember { MutableInteractionSource() }
    val press = rememberPressProgress(source, active = !dimmed)
    val fill = when (tone) {
        PillTone.INK -> colors.ink
        PillTone.TRUE -> colors.trueColor
        PillTone.FALSE -> colors.falseColor
    }
    val shape = RoundedCornerShape(Tokens.Radius.pill)
    val shadow = if (dimmed) {
        Modifier
    } else {
        Modifier
            .truthyShadow(shadows.button, Tokens.Radius.pill, alpha = { 1f - press.value })
            .truthyShadow(shadows.press, Tokens.Radius.pill, alpha = { press.value })
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.pill)
            .pressFeedback(press, PressFeedback.PILL_SCALE, Tokens.Space.s2)
            .then(shadow)
            .alpha(if (dimmed) Tokens.Opacity.disabled else 1f)
            .clip(shape)
            .background(fill)
            .clickable(interactionSource = source, indication = null, role = Role.Button) {
                if (!dimmed) onClick()
            }
            .semantics { if (dimmed) disabled() }
            .padding(horizontal = Tokens.Space.s16),
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s10, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leadingIcon?.invoke()
        TruthyText(label, TruthyType.button, colors.onDark)
        trailingIcon?.invoke()
    }
}

/**
 * The 48 round button of the headers (RoundButton.tsx): leave a round, close results, switch the theme. It holds only an
 * icon, so [label] is its accessible name. RAISED is paper with the small shadow on the sky; SUNK is sunk paper with no
 * shadow on a paper surface. [enabled] false is the web's disabled: drawn at 0.45, takes no press.
 */
@Composable
fun RoundButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: RoundVariant = RoundVariant.RAISED,
    enabled: Boolean = true,
    content: @Composable () -> Unit,
) {
    val colors = TruthyTheme.colors
    val shadows = TruthyTheme.shadows
    val source = remember { MutableInteractionSource() }
    val press = rememberPressProgress(source, active = enabled)
    val shadow = if (variant == RoundVariant.RAISED) {
        Modifier.truthyShadow(shadows.small, Tokens.Size.roundButton / 2)
    } else {
        Modifier
    }
    Box(
        modifier = modifier
            .size(Tokens.Size.roundButton)
            .pressFeedback(press, PressFeedback.ROUND_SCALE)
            .then(shadow)
            .alpha(if (enabled) 1f else Tokens.Opacity.disabled)
            .clip(CircleShape)
            .background(if (variant == RoundVariant.RAISED) colors.surfaceRaised else colors.surfaceSunk)
            .clickable(interactionSource = source, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}

/** The quiet 48 text button under the primary pill (QuietButton.tsx): "Choose another route". */
@Composable
fun QuietButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: (@Composable () -> Unit)? = null,
) {
    val colors = TruthyTheme.colors
    val source = remember { MutableInteractionSource() }
    val press = rememberPressProgress(source)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.pillSmall)
            .pressFeedback(press, PressFeedback.QUIET_SCALE)
            .clip(RoundedCornerShape(Tokens.Radius.pillSmall))
            .clickable(interactionSource = source, indication = null, role = Role.Button, onClick = onClick),
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leadingIcon?.invoke()
        TruthyText(label, TruthyType.buttonQuiet, colors.ink)
    }
}

/**
 * The Back pill of the start flow (StartFlow.tsx): raised paper, the small shadow, the pill arrow and "Back". Its name for
 * screen readers is [description] ("Back to areas").
 */
@Composable
fun BackPill(
    description: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    text: String = "Back",
) {
    val colors = TruthyTheme.colors
    val shadows = TruthyTheme.shadows
    val source = remember { MutableInteractionSource() }
    val press = rememberPressProgress(source)
    Row(
        modifier = modifier
            .heightIn(min = Tokens.Size.pillSmall)
            .pressFeedback(press, PressFeedback.BACK_PILL_SCALE)
            .truthyShadow(shadows.small, Tokens.Radius.pillSmall)
            .clip(RoundedCornerShape(Tokens.Radius.pillSmall))
            .background(colors.surfaceRaised)
            .clickable(interactionSource = source, indication = null, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = description }
            .padding(start = Tokens.Space.s14, end = Tokens.Space.s20),
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TruthyIcon(IconId.BACK_PILL, tint = colors.ink)
        TruthyText(text, TruthyType.buttonBack, colors.ink)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`. A common first-compile error here is an import the file does not need (Kotlin only warns) or `Tokens.Size.roundButton / 2` (a `Dp` divided by an `Int` is defined; if the compiler disagrees, write `Tokens.Size.roundButton / 2f`).

- [ ] **Step 21: Commit the press feedback and the buttons.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Motion.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/PressTint.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/Buttons.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/MotionTest.kt
git commit -m "feat: add the pill, round, quiet and Back buttons with the web's press feedback"
```

Expected: one commit.

- [ ] **Step 22: Write the logic tests of the cards and stamps (they fail: nothing exists yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/ui/ComponentsLogicTest.kt`:

```kotlin
package com.eienmosu.truthy.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ComponentsLogicTest {
    // components/easing.ts: STAMP_LANDING = opacity 0, scale 1.9, rotate -14; STAMP_REST = opacity 1, scale 1, rotate -6.
    @Test
    fun aStampLandsFromBigAndInvisible() {
        val frame = StampLanding.at(0f)
        assertEquals(1.9f, frame.scale, 1e-4f)
        assertEquals(-14f, frame.rotation, 1e-4f)
        assertEquals(0f, frame.alpha, 1e-4f)
    }

    @Test
    fun aStampRestsTurnedMinusSix() {
        val frame = StampLanding.at(1f)
        assertEquals(1f, frame.scale, 1e-4f)
        assertEquals(-6f, frame.rotation, 1e-4f)
        assertEquals(1f, frame.alpha, 1e-4f)
    }

    // The spring-ease curve overshoots to about 1.098 of the way: the stamp dips below its rest size, and the opacity stays 1.
    @Test
    fun theOvershootKeepsTheOpacityAtOneAndDipsBelowRestSize() {
        val frame = StampLanding.at(1.098f)
        assertEquals(1f, frame.alpha, 1e-4f)
        assertTrue(frame.scale < 1f)
        assertTrue(frame.rotation > -6f)
    }

    // Reference 4.5: stamps say Correct, Not quite or New best (screen readers: "Correct. New best"); Timed stub stamps
    // say Correct, Not quite or Time is up.
    @Test
    fun stampWordsAndNamesAreTheReferenceCopy() {
        assertEquals("Correct", StampText.word(StampVerdict.CORRECT))
        assertEquals("Not quite", StampText.word(StampVerdict.WRONG))
        assertEquals("New best", StampText.word(StampVerdict.NEW_BEST))
        assertEquals("Correct", StampText.description(StampVerdict.CORRECT))
        assertEquals("Not quite", StampText.description(StampVerdict.WRONG))
        assertEquals("Correct. New best", StampText.description(StampVerdict.NEW_BEST))
        assertEquals("Correct", StampText.stubWord(StubStampKind.CORRECT))
        assertEquals("Not quite", StampText.stubWord(StubStampKind.WRONG))
        assertEquals("Time is up", StampText.stubWord(StubStampKind.TIME_UP))
        assertEquals("True", StampText.intentWord(IntentKind.TRUE))
        assertEquals("False", StampText.intentWord(IntentKind.FALSE))
    }

    // DestinationCard.tsx: the seen part of the 56 wide track is percent% of it.
    @Test
    fun theSeenPartOfTheTrackIsThePercentOfItsWidth() {
        assertEquals(21.28f, TrackGeometry.seenWidth(38, 56f), 1e-3f)
        assertEquals(0f, TrackGeometry.seenWidth(0, 56f), 0f)
        assertEquals(56f, TrackGeometry.seenWidth(100, 56f), 1e-3f)
    }

    // DestinationCard.tsx STUB_WIDTH, MIN_HEIGHT and MAIN_PADDING (reference 5.4): stubs 64 and 80, minimum heights 104, 128,
    // 90 and 108, gaps and paddings 4/18, 2/18, 2/14 and 4/16.
    @Test
    fun eachVariantHasTheWebsStubMinimumHeightAndSpacing() {
        fun check(variant: DestinationVariant, stub: Float, min: Float, gap: Float, vertical: Float) {
            val metrics = DestinationLayout.of(variant)
            assertEquals("$variant stub", stub, metrics.stubWidth.value, 0f)
            assertEquals("$variant min", min, metrics.minHeight.value, 0f)
            assertEquals("$variant gap", gap, metrics.gap.value, 0f)
            assertEquals("$variant vertical", vertical, metrics.vertical.value, 0f)
        }
        check(DestinationVariant.PLACE, 64f, 104f, 4f, 18f)
        check(DestinationVariant.DECK, 80f, 128f, 2f, 18f)
        check(DestinationVariant.SECTION, 80f, 90f, 2f, 14f)
        check(DestinationVariant.CLASS, 80f, 108f, 4f, 16f)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.ui.ComponentsLogicTest'
```

Expected: `BUILD FAILED` with `Unresolved reference: StampLanding`, `StampText`, `StampVerdict`, `TrackGeometry` and `DestinationLayout`.

- [ ] **Step 23: Write the stamps.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/Stamps.kt`:

```kotlin
package com.eienmosu.truthy.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyText
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.stampBorder

enum class StampVerdict { CORRECT, WRONG, NEW_BEST }

enum class StubStampKind { CORRECT, WRONG, TIME_UP }

enum class IntentKind { TRUE, FALSE }

/** Reference 4.5: the words on the stamps and the name a screen reader reads. */
object StampText {
    fun word(verdict: StampVerdict): String = when (verdict) {
        StampVerdict.CORRECT -> "Correct"
        StampVerdict.WRONG -> "Not quite"
        StampVerdict.NEW_BEST -> "New best"
    }

    /** The record stamp is "Correct. New best" to screen readers (Stamp.tsx has an sr-only "Correct. " before it). */
    fun description(verdict: StampVerdict): String =
        if (verdict == StampVerdict.NEW_BEST) "Correct. New best" else word(verdict)

    fun stubWord(kind: StubStampKind): String = when (kind) {
        StubStampKind.CORRECT -> "Correct"
        StubStampKind.WRONG -> "Not quite"
        StubStampKind.TIME_UP -> "Time is up"
    }

    fun intentWord(kind: IntentKind): String = if (kind == IntentKind.TRUE) "True" else "False"
}

data class StampFrame(val scale: Float, val rotation: Float, val alpha: Float)

/** components/easing.ts: a stamp lands from scale 1.9, -14 degrees and invisible to scale 1, -6 degrees and visible. */
object StampLanding {
    const val FROM_SCALE = 1.9f
    const val FROM_ROTATION = -14f
    const val REST_ROTATION = -6f

    /** [progress] is the eased fraction 0 to 1 (the spring curve may take it a little past 1). */
    fun at(progress: Float): StampFrame = StampFrame(
        scale = FROM_SCALE + (1f - FROM_SCALE) * progress,
        rotation = FROM_ROTATION + (REST_ROTATION - FROM_ROTATION) * progress,
        alpha = progress.coerceIn(0f, 1f),
    )
}

/** Stamp.tsx StubStamp: "Time is up" lands 120 ms later than a verdict. */
const val STUB_TIME_UP_DELAY_MS = 120

@Composable
private fun rememberLandingProgress(
    animate: Boolean,
    durationMs: Int,
    delayMs: Int,
    easing: Easing,
    replayKey: Any?,
): State<Float> {
    val reduced = LocalReducedMotion.current
    val land = animate && !reduced
    val progress = remember { Animatable(if (land) 0f else 1f) }
    LaunchedEffect(land, durationMs, delayMs, replayKey) {
        if (land) {
            progress.snapTo(0f)
            progress.animateTo(1f, tween(durationMs, delayMs, easing))
        } else {
            progress.snapTo(1f)
        }
    }
    return progress.asState()
}

/**
 * The verdict stamp on the answer slip (Stamp.tsx): an icon and a word in the verdict colour inside a double border,
 * turned -6 degrees. With [animate] it lands (420 ms after 380 ms, spring curve); with reduced motion it is shown at
 * rest. Change [replayKey] to play the landing again.
 */
@Composable
fun Stamp(
    verdict: StampVerdict,
    modifier: Modifier = Modifier,
    animate: Boolean = false,
    replayKey: Any? = null,
) {
    val colors = TruthyTheme.colors
    val color = if (verdict == StampVerdict.WRONG) colors.wrong else colors.correct
    val landing = Tokens.Transitions.stamp
    val progress = rememberLandingProgress(animate, landing.durationMs, landing.delayMs, landing.easing, replayKey)
    Row(
        modifier = modifier
            .graphicsLayer {
                val frame = StampLanding.at(progress.value)
                scaleX = frame.scale
                scaleY = frame.scale
                rotationZ = frame.rotation
                alpha = frame.alpha
            }
            .stampBorder(color, double = true)
            .padding(Tokens.Stroke.stamp)
            .padding(start = Tokens.Space.s14, end = Tokens.Space.s14, top = Tokens.Space.s6, bottom = Tokens.Space.s4)
            .clearAndSetSemantics { contentDescription = StampText.description(verdict) },
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when (verdict) {
            StampVerdict.CORRECT -> TruthyIcon(IconId.CHECK, tint = color, width = 22.dp)
            StampVerdict.WRONG -> TruthyIcon(IconId.CROSS, tint = color, width = 18.dp)
            StampVerdict.NEW_BEST -> TruthyIcon(IconId.STAR, tint = color, width = 20.dp)
        }
        TruthyText(StampText.word(verdict), TruthyType.stamp, color)
    }
}

/**
 * The stamp on the stub of a Timed card (Stamp.tsx StubStamp): the same stamp at 28 on raised paper, so the barcode under
 * it does not show through. It lands over 300 ms (120 ms late for Time is up); with reduced motion it is shown at rest.
 */
@Composable
fun StubStamp(kind: StubStampKind, modifier: Modifier = Modifier, replayKey: Any? = null) {
    val colors = TruthyTheme.colors
    val color = when (kind) {
        StubStampKind.CORRECT -> colors.correct
        StubStampKind.WRONG -> colors.wrong
        StubStampKind.TIME_UP -> colors.ink
    }
    val delay = if (kind == StubStampKind.TIME_UP) STUB_TIME_UP_DELAY_MS else 0
    val progress = rememberLandingProgress(true, Tokens.Duration.stampTimed, delay, Tokens.Curves.spring, replayKey)
    Row(
        modifier = modifier
            .graphicsLayer {
                val frame = StampLanding.at(progress.value)
                scaleX = frame.scale
                scaleY = frame.scale
                rotationZ = frame.rotation
                alpha = frame.alpha
            }
            .background(colors.surfaceRaised, RoundedCornerShape(Tokens.Radius.small))
            .stampBorder(color, double = true)
            .padding(Tokens.Stroke.stamp)
            .padding(start = Tokens.Space.s18, end = Tokens.Space.s18, top = Tokens.Space.s8, bottom = Tokens.Space.s6)
            .clearAndSetSemantics { contentDescription = StampText.stubWord(kind) },
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when (kind) {
            StubStampKind.CORRECT -> TruthyIcon(IconId.CHECK, tint = color, width = 24.dp)
            StubStampKind.WRONG -> TruthyIcon(IconId.CROSS, tint = color, width = 20.dp)
            StubStampKind.TIME_UP -> TruthyIcon(IconId.CLOCK, tint = color)
        }
        TruthyText(StampText.stubWord(kind), TruthyType.stampStub, color)
    }
}

/**
 * The preview that follows the finger while the card is dragged (BoardingPass.tsx INTENT_STAMP): True in the true colour
 * with a check, False in the false colour with a cross, on raised paper inside a solid 3 border. The round screen sets
 * its opacity and rotation (task 13); this draws it at rest.
 */
@Composable
fun IntentStamp(kind: IntentKind, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val color = if (kind == IntentKind.TRUE) colors.trueColor else colors.falseColor
    Row(
        modifier = modifier
            .background(colors.surfaceRaised, RoundedCornerShape(Tokens.Radius.small))
            .stampBorder(color, double = false)
            .padding(Tokens.Stroke.stamp)
            .padding(horizontal = Tokens.Space.s12, vertical = Tokens.Space.s6)
            .clearAndSetSemantics { },
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (kind == IntentKind.TRUE) {
            TruthyIcon(IconId.CHECK, tint = color, width = 18.dp)
        } else {
            TruthyIcon(IconId.CROSS, tint = color, width = 16.dp)
        }
        TruthyText(StampText.intentWord(kind), TruthyType.intentStamp, color)
    }
}
```

The icon widths (22, 18, 20 on the slip; 24, 20 and the clock's default on the stub; 18 and 16 on the intent stamps) are the sizes the web draws them at (`Stamp.tsx:45, 91`, reference 5.6); they are the icons' sizes, not layout tokens.

- [ ] **Step 24: Write the destination card.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/DestinationCard.kt`:

```kotlin
package com.eienmosu.truthy.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import com.eienmosu.truthy.design.DestinationCardShape
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.PressFeedback
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyText
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.drawCardPerforation
import com.eienmosu.truthy.design.pressFeedback
import com.eienmosu.truthy.design.rememberPressProgress
import com.eienmosu.truthy.design.truthyShadow

enum class DestinationVariant { PLACE, DECK, SECTION, CLASS }

/** What the stub of a deck, section or class card shows: "Cards / 214" or "Best / 9 / of 10". */
data class CardStub(val label: String, val value: String, val unit: String? = null, val muted: Boolean = false)

data class DestinationMetrics(val stubWidth: Dp, val minHeight: Dp, val gap: Dp, val vertical: Dp)

/** DestinationCard.tsx STUB_WIDTH, MIN_HEIGHT and MAIN_PADDING. */
object DestinationLayout {
    fun of(variant: DestinationVariant): DestinationMetrics = when (variant) {
        DestinationVariant.PLACE ->
            DestinationMetrics(Tokens.Size.cardStub, Tokens.Size.cardMin, Tokens.Space.s4, Tokens.Space.s18)
        DestinationVariant.DECK ->
            DestinationMetrics(Tokens.Size.cardStubDeck, Tokens.Size.cardMinDeck, Tokens.Space.s2, Tokens.Space.s18)
        DestinationVariant.SECTION ->
            DestinationMetrics(Tokens.Size.cardStubDeck, Tokens.Size.cardMinSection, Tokens.Space.s2, Tokens.Space.s14)
        DestinationVariant.CLASS ->
            DestinationMetrics(Tokens.Size.cardStubDeck, Tokens.Size.cardMinClass, Tokens.Space.s4, Tokens.Space.s16)
    }
}

object TrackGeometry {
    /** The seen part is `percent`% of the track (DestinationCard.tsx: `width: percent%`). */
    fun seenWidth(percent: Int, trackWidth: Float): Float = trackWidth * percent / 100f

    // The track is dashed 4 on, 4 off in rule, 2 thick, at y 3 of 8; the seen part is a solid ink line with an accent dot
    // (8 across) on its end, ringed in ink by a 1.5 spread.
    const val DASH = 4f
    const val LINE_TOP = 3f
    const val DOT_RADIUS = 4f
    const val DOT_RING = 1.5f
}

/** The 56 by 8 progress track: dashed for the part not seen, a solid ink line with an amber dot for the part seen. */
@Composable
fun ProgressTrack(percent: Int, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    Canvas(modifier.size(Tokens.Size.progressTrack, Tokens.Space.s8)) {
        val d = density
        val thick = Tokens.Stroke.perforation.toPx()
        val y = TrackGeometry.LINE_TOP * d + thick / 2f
        drawLine(
            color = colors.rule,
            start = Offset(0f, y),
            end = Offset(size.width, y),
            strokeWidth = thick,
            cap = StrokeCap.Butt,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(TrackGeometry.DASH * d, TrackGeometry.DASH * d)),
        )
        if (percent > 0) {
            val seen = TrackGeometry.seenWidth(percent, size.width)
            drawRoundRect(
                color = colors.ink,
                topLeft = Offset(0f, TrackGeometry.LINE_TOP * d),
                size = Size(seen, thick),
                cornerRadius = CornerRadius(1f * d),
            )
            drawCircle(colors.ink, (TrackGeometry.DOT_RADIUS + TrackGeometry.DOT_RING) * d, Offset(seen, y))
            drawCircle(colors.accent, TrackGeometry.DOT_RADIUS * d, Offset(seen, y))
        }
    }
}

/**
 * The destination card of the start flow (DestinationCard.tsx): one large, calm choice per row. A ticket with a stub on the
 * right, notches of 7 on the stub line and a dashed perforation between them. [label] is the card's accessible name, a full
 * sentence from reference 4.5; the visible texts are not read separately. An [unavailable] card is a disabled group: sunk
 * paper, no stub, no click. [nameHidden] hides the name while a copy of it travels into the pass (task 12).
 */
@Composable
fun DestinationCard(
    variant: DestinationVariant,
    name: String,
    label: String,
    modifier: Modifier = Modifier,
    onSelect: (() -> Unit)? = null,
    code: Boolean = false,
    sub: String? = null,
    detail: String? = null,
    seenPercent: Int? = null,
    stub: CardStub? = null,
    unavailable: Boolean = false,
    nameHidden: Boolean = false,
) {
    val colors = TruthyTheme.colors
    val shadows = TruthyTheme.shadows
    val metrics = DestinationLayout.of(variant)
    val nameStyle = if (code) TruthyType.deckCode else TruthyType.cardName
    val nameModifier = if (nameHidden) Modifier.alpha(0f) else Modifier

    if (unavailable) {
        Column(
            modifier = modifier
                .fillMaxWidth()
                .heightIn(min = Tokens.Size.cardMinOff)
                .clip(RoundedCornerShape(Tokens.Radius.card))
                .background(colors.surfaceSunk)
                .clearAndSetSemantics {
                    contentDescription = label
                    disabled()
                }
                .padding(
                    start = Tokens.Space.s20,
                    end = Tokens.Space.s12,
                    top = Tokens.Space.s18,
                    bottom = Tokens.Space.s18,
                ),
            verticalArrangement = Arrangement.spacedBy(Tokens.Space.s4, Alignment.CenterVertically),
        ) {
            TruthyText(name, nameStyle, colors.inkMuted)
            if (detail != null) TruthyText(detail, TruthyType.listTitle, colors.inkMuted)
            if (sub != null) TruthyText(sub, TruthyType.monoData, colors.inkMuted)
        }
        return
    }

    val source = remember { MutableInteractionSource() }
    val press = rememberPressProgress(source)
    val rule = colors.rule
    Box(
        modifier = modifier
            .fillMaxWidth()
            .pressFeedback(press, PressFeedback.CARD_SCALE)
            .truthyShadow(shadows.small, Tokens.Radius.card)
            .background(colors.surfaceRaised, DestinationCardShape(metrics.stubWidth))
            .drawBehind { drawCardPerforation(rule, metrics.stubWidth) }
            .clickable(interactionSource = source, indication = null, role = Role.Button) { onSelect?.invoke() }
            // Clears the visible texts of the card from the accessibility tree; the click action of this node stays.
            .clearAndSetSemantics { contentDescription = label },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = metrics.minHeight)
                .padding(end = metrics.stubWidth)
                .padding(
                    start = Tokens.Space.s20,
                    end = Tokens.Space.s12,
                    top = metrics.vertical,
                    bottom = metrics.vertical,
                ),
            verticalArrangement = Arrangement.spacedBy(metrics.gap, Alignment.CenterVertically),
        ) {
            TruthyText(name, nameStyle, colors.ink, nameModifier)
            if (sub != null) TruthyText(sub, TruthyType.monoData, colors.inkMuted)
            if (detail != null) {
                TruthyText(detail, TruthyType.listTitle, if (variant == DestinationVariant.CLASS) colors.inkMuted else colors.ink)
            }
            if (seenPercent != null) {
                Row(
                    modifier = Modifier.padding(top = Tokens.Space.s10),
                    horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s10),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    ProgressTrack(seenPercent)
                    if (seenPercent > 0) {
                        val seen = buildAnnotatedString {
                            withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = colors.ink)) { append("$seenPercent%") }
                            append(" seen")
                        }
                        TruthyText(seen, TruthyType.monoData, colors.inkMuted)
                    } else {
                        TruthyText("Not started", TruthyType.monoData, colors.inkMuted)
                    }
                }
            }
        }
        Box(Modifier.matchParentSize(), contentAlignment = Alignment.CenterEnd) {
            Column(
                modifier = Modifier.width(metrics.stubWidth),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Tokens.Space.s2, Alignment.CenterVertically),
            ) {
                if (stub != null) {
                    TruthyText(stub.label, TruthyType.fieldLabel, colors.inkMuted, textAlign = TextAlign.Center)
                    TruthyText(stub.value, TruthyType.stubValue, if (stub.muted) colors.inkMuted else colors.ink, textAlign = TextAlign.Center)
                    if (stub.unit != null) TruthyText(stub.unit, TruthyType.fieldLabel, colors.inkMuted, textAlign = TextAlign.Center)
                }
                if (variant != DestinationVariant.CLASS) {
                    Box(if (stub != null) Modifier.padding(top = Tokens.Space.s8) else Modifier) {
                        TruthyIcon(IconId.CHEVRON_RIGHT, tint = colors.ink)
                    }
                }
            }
        }
    }
}
```

Run the unit tests of the task so far:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.ui.ComponentsLogicTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.ui.ComponentsLogicTest.xml
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`, `tests="6" skipped="0" failures="0" errors="0"` and a second `BUILD SUCCESSFUL`. A compile error in `DestinationCard.kt` most likely names `matchParentSize` (it is available only inside a `BoxScope`; the call sits inside the `Box { }` content) or the `Dp.times(Float)` of `TruthyIcon`; fix the line and keep the layout: the main column's height defines the card's height, the stub overlays it.

- [ ] **Step 25: Commit the stamps and the destination card.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/Stamps.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/DestinationCard.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/ui/ComponentsLogicTest.kt
git commit -m "feat: add the destination cards and the verdict, stub and intent stamps"
```

Expected: one commit.

- [ ] **Step 26: Write the frame insets and the test tags, with the frame's unit test.**

Spec 5.6 sets the safe areas once for every screen: the larger of the system inset and 52 at the top and 34 at the bottom (8 and 12 when the window is under 568 tall, `app/globals.css` "short"), and sides of the 16 gutter plus the side inset. Tasks 12, 13 and 14 all use this one implementation; none writes the rule again. `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/FrameInsetsTest.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.ui.unit.dp
import kotlin.test.Test
import kotlin.test.assertEquals

class FrameInsetsTest {
    @Test
    fun aTallWindowKeepsTheWebsSafeAreasWhenTheSystemInsetsAreSmaller() {
        assertEquals(FrameInsets(52.dp, 34.dp, 16.dp, 16.dp), frameInsets(0.dp, 0.dp, 0.dp, 0.dp, 915.dp))
        assertEquals(FrameInsets(52.dp, 34.dp, 16.dp, 16.dp), frameInsets(24.dp, 16.dp, 0.dp, 0.dp, 568.dp))
    }

    @Test
    fun aLargerSystemInsetWins() {
        assertEquals(FrameInsets(60.dp, 60.dp, 16.dp, 16.dp), frameInsets(60.dp, 60.dp, 0.dp, 0.dp, 915.dp))
        assertEquals(FrameInsets(60.dp, 60.dp, 16.dp, 16.dp), frameInsets(60.dp, 60.dp, 0.dp, 0.dp, 560.dp))
    }

    @Test
    fun aShortWindowUsesEightAndTwelve() {
        assertEquals(FrameInsets(8.dp, 12.dp, 16.dp, 16.dp), frameInsets(0.dp, 0.dp, 0.dp, 0.dp, 560.dp))
        assertEquals(FrameInsets(24.dp, 12.dp, 16.dp, 16.dp), frameInsets(24.dp, 0.dp, 0.dp, 0.dp, 560.dp))
    }

    @Test
    fun theSidesAreTheGutterPlusTheSideInset() {
        assertEquals(FrameInsets(52.dp, 34.dp, 40.dp, 16.dp), frameInsets(0.dp, 0.dp, 24.dp, 0.dp, 915.dp))
        assertEquals(FrameInsets(52.dp, 34.dp, 40.dp, 40.dp), frameInsets(0.dp, 0.dp, 24.dp, 24.dp, 915.dp))
    }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Frame.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/** The padding of a screen's 430 column: top, bottom and the two sides (start and end in layout direction). */
data class FrameInsets(val top: Dp, val bottom: Dp, val start: Dp, val end: Dp)

/**
 * Spec 5.6: the larger of the system inset and 52 / 34 (8 / 12 under 568 tall, app/globals.css:29 "short", all three
 * from plan A's native group); the sides are the 16 gutter plus the side inset. Pure, so FrameInsetsTest pins it on the JVM.
 */
fun frameInsets(systemTop: Dp, systemBottom: Dp, systemStart: Dp, systemEnd: Dp, windowHeight: Dp): FrameInsets {
    val short = windowHeight < Tokens.Native.shortScreenBelow
    return FrameInsets(
        top = maxOf(systemTop, if (short) Tokens.Native.shortSafeTop else Tokens.Size.safeTop),
        bottom = maxOf(systemBottom, if (short) Tokens.Native.shortSafeBottom else Tokens.Size.safeBottom),
        start = Tokens.Size.gutter + systemStart,
        end = Tokens.Size.gutter + systemEnd,
    )
}

/** The frame insets of the current window, from the safe drawing insets (bars, cutout, IME). */
@Composable
fun rememberFrameInsets(): FrameInsets {
    val density = LocalDensity.current
    val direction = LocalLayoutDirection.current
    val safe = WindowInsets.safeDrawing
    val height = LocalConfiguration.current.screenHeightDp.dp
    return with(density) {
        val left = safe.getLeft(this, direction).toDp()
        val right = safe.getRight(this, direction).toDp()
        val rtl = direction == LayoutDirection.Rtl
        frameInsets(
            systemTop = safe.getTop(this).toDp(),
            systemBottom = safe.getBottom(this).toDp(),
            systemStart = if (rtl) right else left,
            systemEnd = if (rtl) left else right,
            windowHeight = height,
        )
    }
}

/**
 * A screen's frame: a column at most 430 wide, centred, padded by [rememberFrameInsets]. The caller draws the sky (or
 * the scrim) behind it; the frame draws nothing itself.
 */
@Composable
fun TruthyFrame(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val insets = rememberFrameInsets()
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier
                .fillMaxHeight()
                .widthIn(max = Tokens.Size.maxWidth)
                .fillMaxWidth()
                .padding(start = insets.start, end = insets.end, top = insets.top, bottom = insets.bottom),
            content = content,
        )
    }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/TestTags.kt`:

```kotlin
package com.eienmosu.truthy.ui

/**
 * The test tags the UI tests and the visual review (task 15) find nodes by. Tasks 12 to 14 put each on its node:
 * LOGO on the logo row, PASS on the fill-in pass, TICKET on the boarding pass (round and result), STUB on the round's
 * stub, CARD on the dragged card after its graphicsLayer, ROUND_SURFACE on the round's back surface, SHEET_CARD on the
 * leave sheet's card.
 */
object TestTags {
    const val LOGO = "logo"
    const val PASS = "pass"
    const val TICKET = "ticket"
    const val STUB = "stub"
    const val CARD = "card"
    const val ROUND_SURFACE = "round-surface"
    const val SHEET_CARD = "sheet-card"
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.FrameInsetsTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.FrameInsetsTest.xml
```

Expected: `BUILD SUCCESSFUL` and `tests="4" skipped="0" failures="0" errors="0"`. Write the test file first and run it once before `Frame.kt` exists if you want the red step: it fails at `:app:compileDebugUnitTestKotlin` with `Unresolved reference 'frameInsets'` and `'FrameInsets'`.

- [ ] **Step 27: Draw the focus ring for hardware keyboard focus.**

Spec 5.6: "Focus rings appear only for hardware keyboard focus, never on touch"; reference 5.0 gives an ink ring, 2 wide, 2 outside the control (2 inside on the pass fields and the ticket). `TruthyColors.focus` is that ink in both themes. `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/FocusRing.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Reference 5.0, focus: an ink ring 2 wide, 2 outside the control; -2 (inside) on the pass fields and the ticket. */
object FocusRingSpec {
    val WIDTH = 2.dp
    val OFFSET = 2.dp
    val INSET = (-2).dp
}

/**
 * Draws the focus ring around [shape] while this control has focus and a hardware keyboard drives the input mode,
 * never after a touch. Place it before the control's clip and before its clickable or focusable, so it sees the focus
 * and draws outside the clipped content.
 */
@Composable
fun Modifier.keyboardFocusRing(shape: Shape, offset: Dp = FocusRingSpec.OFFSET): Modifier {
    var focused by remember { mutableStateOf(false) }
    val keyboard = LocalInputModeManager.current.inputMode == InputMode.Keyboard
    val ring = TruthyTheme.colors.focus
    return this
        .onFocusChanged { focused = it.isFocused }
        .drawWithContent {
            drawContent()
            if (focused && keyboard) {
                val o = offset.toPx()
                val outline = shape.createOutline(Size(size.width + 2 * o, size.height + 2 * o), layoutDirection, this)
                translate(-o, -o) { drawOutline(outline, ring, style = Stroke(FocusRingSpec.WIDTH.toPx())) }
            }
        }
}
```

Put it on every control of this task, before the clip, in `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/Buttons.kt` and `DestinationCard.kt`:

- `PillButton`: replace `.clip(shape)` with `.keyboardFocusRing(shape)` followed by `.clip(shape)`.
- `RoundButton`: replace `.clip(CircleShape)` with `.keyboardFocusRing(CircleShape)` followed by `.clip(CircleShape)`.
- `QuietButton` and `BackPill`: replace `.clip(RoundedCornerShape(Tokens.Radius.pillSmall))` with `.keyboardFocusRing(RoundedCornerShape(Tokens.Radius.pillSmall))` followed by `.clip(RoundedCornerShape(Tokens.Radius.pillSmall))`.
- `DestinationCard` (the available card's `Box`): insert `.keyboardFocusRing(DestinationCardShape(metrics.stubWidth))` right after `.truthyShadow(shadows.small, Tokens.Radius.card)`.

Add `import com.eienmosu.truthy.design.keyboardFocusRing` to both files. Task 12 puts it on the theme switch (a `RoundButton`, so it has it already), the continue line and the "Why" rows (default offset) and on the pass fields with `offset = FocusRingSpec.INSET`; task 13 on the ticket with `FocusRingSpec.INSET` and on the source link with the default.

```bash
cd android/Truthy
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`. Step 29's emulator test proves the ring shows on keyboard focus and not after a tap.

- [ ] **Step 28: Commit the frame, the test tags and the focus ring.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Frame.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/FocusRing.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/TestTags.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/Buttons.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/DestinationCard.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/FrameInsetsTest.kt
git commit -m "feat: add the shared frame insets, the test tags and the keyboard focus ring to the Android design system"
```

Expected: one commit with six files.

- [ ] **Step 29: Write the semantics test for the emulator (it only has to compile now; step 31 runs it).**

The JVM tests pin the numbers; these pin what the accessibility tree and the click handlers do. `android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/ui/ComponentsSemanticsTest.kt`:

```kotlin
package com.eienmosu.truthy.ui

import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.input.InputModeManager
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import androidx.compose.ui.test.assertHasNoClickAction
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.resolvedTheme
import com.eienmosu.truthy.engine.Theme
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class ComponentsSemanticsTest {
    @get:Rule
    val rule = createComposeRule()

    private fun show(content: @Composable () -> Unit) {
        rule.setContent { TruthyTheme(resolvedTheme(Theme.LIGHT)) { content() } }
    }

    @Test
    fun aPillTakesClicksAndIsNamedByItsLabel() {
        var clicks = 0
        show { PillButton("Next card", onClick = { clicks++ }) }
        rule.onNodeWithText("Next card").assertIsEnabled().assertHasClickAction().performClick()
        assertEquals(1, clicks)
    }

    @Test
    fun aDimmedPillIsDisabledAndIgnoresClicks() {
        var clicks = 0
        show { PillButton("Next card", onClick = { clicks++ }, dimmed = true) }
        rule.onNodeWithText("Next card").assertIsNotEnabled().performClick()
        assertEquals(0, clicks)
    }

    @Test
    fun aRoundButtonIsNamedByItsLabelNotByItsIcon() {
        var clicks = 0
        show { RoundButton("Leave round", onClick = { clicks++ }) { TruthyIcon(IconId.CLOSE) } }
        rule.onNodeWithContentDescription("Leave round").assertHasClickAction().performClick()
        assertEquals(1, clicks)
    }

    @Test
    fun theBackPillNamesItsDestination() {
        var clicks = 0
        show { BackPill("Back to areas", onClick = { clicks++ }) }
        rule.onNodeWithContentDescription("Back to areas").assertHasClickAction().performClick()
        assertEquals(1, clicks)
    }

    @Test
    fun aDeckCardIsOneButtonNamedByItsLabel() {
        var chosen = 0
        val label = "CLF, Cloud Practitioner, 214 cards, not started"
        show {
            DestinationCard(
                variant = DestinationVariant.DECK,
                name = "CLF",
                code = true,
                detail = "Cloud Practitioner",
                seenPercent = 0,
                stub = CardStub("Cards", "214"),
                label = label,
                onSelect = { chosen++ },
            )
        }
        rule.onNodeWithContentDescription(label).assertHasClickAction().performClick()
        assertEquals(1, chosen)
        // The visible texts are not separate nodes in the merged tree.
        rule.onNodeWithText("Cloud Practitioner").assertDoesNotExist()
    }

    @Test
    fun anUnavailableCardIsADisabledGroupWithNoClickAction() {
        val label = "Cloud, no decks yet"
        show {
            DestinationCard(
                variant = DestinationVariant.PLACE,
                name = "Cloud",
                sub = "No decks yet",
                label = label,
                unavailable = true,
            )
        }
        rule.onNodeWithContentDescription(label).assertHasNoClickAction().assertIsNotEnabled()
    }

    @Test
    fun theRecordStampIsOneElementNamedCorrectNewBest() {
        show { Stamp(StampVerdict.NEW_BEST) }
        rule.onNodeWithContentDescription("Correct. New best").assertExists()
    }

    @Test
    fun theTimedStubStampsAreNamedByTheirWords() {
        show { StubStamp(StubStampKind.TIME_UP) }
        rule.onNodeWithContentDescription("Time is up").assertExists()
    }

    // Spec 5.6: a ring for hardware keyboard focus, none after a touch. The quiet button has no shadow and no fill, so
    // the pixel 2 dp left of it is either the ring or the frame's own colour.
    @Test
    fun theFocusRingShowsForKeyboardFocusAndNotAfterATap() {
        val requester = FocusRequester()
        lateinit var inputMode: InputModeManager
        var frame = Color.Unspecified
        var ring = Color.Unspecified
        show {
            inputMode = LocalInputModeManager.current
            frame = TruthyTheme.colors.surfaceSunk
            ring = TruthyTheme.colors.focus
            Box(Modifier.testTag("frame").background(frame).padding(8.dp)) {
                QuietButton("Choose another route", onClick = {}, modifier = Modifier.focusRequester(requester))
            }
        }
        rule.runOnIdle {
            inputMode.requestInputMode(InputMode.Keyboard)
            requester.requestFocus()
        }
        rule.waitForIdle()
        assertTrue("no ring under keyboard focus", near(ring, pixelLeftOfButton()))
        // A real tap through the window manager: performClick dispatches inside the test, past the window manager, so
        // the window never enters touch mode and the input mode stays Keyboard.
        val button = rule.onNodeWithText("Choose another route").fetchSemanticsNode()
        realTap(button.positionOnScreen.x + button.size.width / 2f, button.positionOnScreen.y + button.size.height / 2f)
        rule.waitForIdle()
        assertTrue("a ring after a tap", near(frame, pixelLeftOfButton()))
    }

    private fun realTap(x: Float, y: Float) {
        val automation = InstrumentationRegistry.getInstrumentation().uiAutomation
        val downAt = SystemClock.uptimeMillis()
        val down = MotionEvent.obtain(downAt, downAt, MotionEvent.ACTION_DOWN, x, y, 0)
        down.source = InputDevice.SOURCE_TOUCHSCREEN
        automation.injectInputEvent(down, true)
        val up = MotionEvent.obtain(downAt, downAt + 20, MotionEvent.ACTION_UP, x, y, 0)
        up.source = InputDevice.SOURCE_TOUCHSCREEN
        automation.injectInputEvent(up, true)
        down.recycle()
        up.recycle()
    }

    // 6 dp from the frame's left edge is 2 dp outside the button: the middle of the ring's 2 dp stroke.
    private fun pixelLeftOfButton(): Color {
        val image = rule.onNodeWithTag("frame").captureToImage().toPixelMap()
        val x = with(rule.density) { 6.dp.roundToPx() }
        return image[x, image.height / 2]
    }

    private fun near(a: Color, b: Color): Boolean =
        abs(a.red - b.red) < 0.08f && abs(a.green - b.green) < 0.08f && abs(a.blue - b.blue) < 0.08f
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:compileDebugAndroidTestKotlin
```

Expected: `BUILD SUCCESSFUL` (the components exist already; only the emulator run proves behaviour, in step 31). If it fails on an unresolved `createComposeRule`, step 1's dependency lines are not in `app/build.gradle.kts`.

- [ ] **Step 30: Write the debug gallery.**

A debug-only activity that shows every component in a known state, day or night, section by section, so the visual review and the pairs of task 15 have something to capture. It is not part of the release.

`android/Truthy/app/src/debug/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application>
        <activity
            android:name=".debug.GalleryActivity"
            android:exported="false" />
    </application>
</manifest>
```

`android/Truthy/app/src/debug/kotlin/com/eienmosu/truthy/debug/GalleryActivity.kt`:

```kotlin
package com.eienmosu.truthy.debug

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.applyWindowTheme
import com.eienmosu.truthy.design.bootTheme
import com.eienmosu.truthy.design.resolvedTheme
import com.eienmosu.truthy.engine.Theme

/**
 * Debug only. Shows every component of task 10.
 *
 *     adb shell am start -n com.eienmosu.truthy/.debug.GalleryActivity --es section buttons --ez night true
 *
 * `section` is all, icons, buttons, cards, stamps or shapes; `night` (true or false) fixes the theme, otherwise the
 * system's decides. The round button at the top switches the theme.
 */
class GalleryActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val activity = this
        val section = intent.getStringExtra(EXTRA_SECTION) ?: "all"
        val stored: Theme? = if (intent.hasExtra(EXTRA_NIGHT)) {
            if (intent.getBooleanExtra(EXTRA_NIGHT, false)) Theme.DARK else Theme.LIGHT
        } else {
            null
        }
        val first = bootTheme(activity, stored)
        setContent {
            var theme by remember { mutableStateOf(first) }
            LaunchedEffect(theme) { applyWindowTheme(activity, theme) }
            TruthyTheme(theme) {
                ComponentGallery(
                    section = section,
                    onToggleTheme = {
                        theme = resolvedTheme(if (theme.isDark) Theme.LIGHT else Theme.DARK)
                    },
                )
            }
        }
    }

    companion object {
        const val EXTRA_SECTION = "section"
        const val EXTRA_NIGHT = "night"
    }
}
```

`android/Truthy/app/src/debug/kotlin/com/eienmosu/truthy/debug/Gallery.kt`:

```kotlin
package com.eienmosu.truthy.debug

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.Logo
import com.eienmosu.truthy.design.LogoMark
import com.eienmosu.truthy.design.LogoVariant
import com.eienmosu.truthy.design.RouteIcon
import com.eienmosu.truthy.design.SkyBackdrop
import com.eienmosu.truthy.design.TicketLowerShape
import com.eienmosu.truthy.design.TicketMainShape
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyText
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.drawTicketPerforation
import com.eienmosu.truthy.design.rememberPressTint
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.ui.BackPill
import com.eienmosu.truthy.ui.CardStub
import com.eienmosu.truthy.ui.DestinationCard
import com.eienmosu.truthy.ui.DestinationVariant
import com.eienmosu.truthy.ui.IntentKind
import com.eienmosu.truthy.ui.IntentStamp
import com.eienmosu.truthy.ui.PillButton
import com.eienmosu.truthy.ui.PillTone
import com.eienmosu.truthy.ui.QuietButton
import com.eienmosu.truthy.ui.RoundButton
import com.eienmosu.truthy.ui.RoundVariant
import com.eienmosu.truthy.ui.Stamp
import com.eienmosu.truthy.ui.StampVerdict
import com.eienmosu.truthy.ui.StubStamp
import com.eienmosu.truthy.ui.StubStampKind

private fun String.shows(name: String) = this == "all" || this == name

@Composable
fun ComponentGallery(section: String, onToggleTheme: () -> Unit) {
    val dark = TruthyTheme.isDark
    Box(Modifier.fillMaxSize()) {
        SkyBackdrop()
        Box(Modifier.fillMaxSize().safeDrawingPadding(), contentAlignment = Alignment.TopCenter) {
            Column(
                modifier = Modifier
                    .widthIn(max = Tokens.Size.maxWidth)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Tokens.Size.gutter, vertical = Tokens.Space.s16),
                verticalArrangement = Arrangement.spacedBy(Tokens.Space.s16),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Logo(asHeading = true)
                    RoundButton(
                        label = if (dark) "Switch to light theme" else "Switch to dark theme",
                        onClick = onToggleTheme,
                    ) {
                        TruthyIcon(if (dark) IconId.SUN else IconId.MOON)
                    }
                }
                if (section.shows("icons")) IconsSection()
                if (section.shows("buttons")) ButtonsSection()
                if (section.shows("cards")) CardsSection()
                if (section.shows("stamps")) StampsSection()
                if (section.shows("shapes")) ShapesSection()
            }
        }
    }
}

@Composable
private fun Heading(text: String) {
    TruthyText(text, TruthyType.routeLabel, TruthyTheme.colors.ink)
}

@Composable
private fun IconsSection() {
    val colors = TruthyTheme.colors
    Heading("Icons (19 vectors and the route icon)")
    val cells: List<Pair<String, @Composable () -> Unit>> =
        IconId.entries.map { id -> id.name to @Composable { TruthyIcon(id) } } +
            ("ROUTE" to @Composable { RouteIcon() }) +
            ("CLOSE 3" to @Composable { TruthyIcon(IconId.CLOSE, strokeWidth = 3f) })
    cells.chunked(4).forEach { row ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8)) {
            row.forEach { (name, icon) ->
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(Tokens.Radius.small))
                        .background(colors.surfaceRaised)
                        .padding(Tokens.Space.s8),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(Tokens.Space.s6),
                ) {
                    Box(Modifier.height(48.dp), contentAlignment = Alignment.Center) { icon() }
                    TruthyText(name, TruthyType.monoCaption, colors.inkMuted)
                }
            }
        }
    }
}

@Composable
private fun ButtonsSection() {
    val colors = TruthyTheme.colors
    Heading("Buttons")
    BackPill("Back to areas", onClick = {})
    PillButton(
        "Start round",
        onClick = {},
        trailingIcon = { TruthyText("\u2192", TruthyType.button, colors.onDark) },
    )
    PillButton("True", onClick = {}, tone = PillTone.TRUE, leadingIcon = { TruthyIcon(IconId.CHECK, tint = colors.onDark) })
    PillButton("False", onClick = {}, tone = PillTone.FALSE, leadingIcon = { TruthyIcon(IconId.CROSS, tint = colors.onDark) })
    PillButton("Next card", onClick = {}, dimmed = true, trailingIcon = { TruthyText("\u2192", TruthyType.button, colors.onDark) })
    QuietButton("Choose another route", onClick = {}, leadingIcon = { RouteIcon() })
    Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12)) {
        RoundButton("Leave round", onClick = {}) { TruthyIcon(IconId.CLOSE) }
        RoundButton("Close results", onClick = {}, variant = RoundVariant.SUNK) { TruthyIcon(IconId.CLOSE) }
        RoundButton("Disabled", onClick = {}, enabled = false) { TruthyIcon(IconId.BACK_HEADER) }
    }
    Heading("Press tint (pass fields, continue line)")
    val source = remember { MutableInteractionSource() }
    val tint = rememberPressTint(Tokens.Space.s6)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(RoundedCornerShape(Tokens.Space.s6))
            .background(colors.surfaceRaised)
            .clickable(interactionSource = source, indication = tint) {},
        contentAlignment = Alignment.Center,
    ) {
        TruthyText("Change deck, now CLF", TruthyType.fieldValuePass, colors.ink)
    }
}

@Composable
private fun CardsSection() {
    Heading("Destination cards")
    DestinationCard(DestinationVariant.PLACE, name = "Cloud", sub = "3 decks", label = "Cloud, 3 decks")
    DestinationCard(
        DestinationVariant.DECK,
        name = "CLF",
        code = true,
        detail = "Cloud Practitioner",
        seenPercent = 38,
        stub = CardStub("Cards", "214"),
        label = "CLF, Cloud Practitioner, 214 cards, 38 percent seen",
    )
    DestinationCard(
        DestinationVariant.DECK,
        name = "SAA",
        code = true,
        detail = "Solutions Architect Associate",
        seenPercent = 0,
        stub = CardStub("Cards", "1,024"),
        label = "SAA, Solutions Architect Associate, 1,024 cards, not started",
    )
    DestinationCard(
        DestinationVariant.SECTION,
        name = "SEC",
        code = true,
        detail = "Security and Compliance",
        stub = CardStub("Cards", "48"),
        label = "SEC, Security and Compliance, 48 cards",
    )
    DestinationCard(
        DestinationVariant.CLASS,
        name = "Classic",
        detail = "Correct answers out of 10 cards.",
        stub = CardStub("Best", "9", "of 10"),
        label = "Classic. Correct answers out of 10 cards. Your best: 9 of 10.",
    )
    DestinationCard(
        DestinationVariant.CLASS,
        name = "Streak",
        detail = "Correct answers in a row, until the first wrong one.",
        stub = CardStub("Best", "\u2013", "not played", muted = true),
        label = "Streak. Correct answers in a row, until the first wrong one. Not played yet.",
    )
    DestinationCard(
        DestinationVariant.PLACE,
        name = "Security",
        sub = "No decks yet",
        label = "Security, no decks yet",
        unavailable = true,
    )
}

@Composable
private fun StampsSection() {
    var replay by remember { mutableIntStateOf(0) }
    Heading("Stamps")
    QuietButton("Play the landings again", onClick = { replay++ })
    Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12)) {
        Stamp(StampVerdict.CORRECT, animate = true, replayKey = replay)
        Stamp(StampVerdict.WRONG, animate = true, replayKey = replay)
    }
    Stamp(StampVerdict.NEW_BEST, animate = true, replayKey = replay)
    Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12)) {
        StubStamp(StubStampKind.CORRECT, replayKey = replay)
        StubStamp(StubStampKind.WRONG, replayKey = replay)
    }
    StubStamp(StubStampKind.TIME_UP, replayKey = replay)
    Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12)) {
        IntentStamp(IntentKind.TRUE)
        IntentStamp(IntentKind.FALSE)
    }
}

@Composable
private fun ShapesSection() {
    val colors = TruthyTheme.colors
    Heading("Ticket papers, perforation and shadow")
    Box(Modifier.fillMaxWidth().truthyShadow(TruthyTheme.shadows.ticket, Tokens.Radius.card)) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
                    .background(colors.surfaceRaised, TicketMainShape())
                    .drawBehind { drawTicketPerforation(colors.rule) },
                contentAlignment = Alignment.Center,
            ) {
                Logo()
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(Tokens.Size.lower)
                    .background(colors.surfaceSunk, TicketLowerShape()),
            )
        }
    }
    Heading("Logo marks (44, 26, compact 20)")
    Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s16), verticalAlignment = Alignment.CenterVertically) {
        LogoMark()
        LogoMark(width = 26.dp)
        LogoMark(width = 20.dp, variant = LogoVariant.COMPACT)
    }
}
```

The `chunked(4)` rows leave the last row with fewer cells; the cells keep their `weight(1f)`, so a short row is left-aligned.

Run:

```bash
cd android/Truthy
./gradlew :app:assembleDebug
```

Expected: `BUILD SUCCESSFUL`. If the manifest merger complains, the activity name must resolve against the namespace `com.eienmosu.truthy` (`.debug.GalleryActivity` is `com.eienmosu.truthy.debug.GalleryActivity`); do not add a `package` attribute to the debug manifest.

- [ ] **Step 31: Run the semantics tests on the emulator.**

```bash
cd android/Truthy
adb devices
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.ui.ComponentsSemanticsTest
find app/build/outputs/androidTest-results -name 'TEST-*.xml' -exec grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' {} +
```

Expected: `adb devices` lists the API 36 emulator as `device`; `BUILD SUCCESSFUL`; one result line `tests="9" skipped="0" failures="0" errors="0"`. If `theFocusRingShowsForKeyboardFocusAndNotAfterATap` fails on "no ring", `keyboardFocusRing` sits after the clickable or after the clip in `QuietButton` (step 27); if the compiler asks for an opt-in on `requestInputMode`, add `@OptIn(ExperimentalComposeUiApi::class)` to the test. If `aDeckCardIsOneButtonNamedByItsLabel` fails on `assertDoesNotExist`, the visible text leaked into the merged tree: `clearAndSetSemantics` must be the last semantic modifier of the card's `Box` (after `clickable`), and it must be on the same node as the click action. If `anUnavailableCardIsADisabledGroupWithNoClickAction` fails on `assertIsNotEnabled`, `disabled()` is missing from the `clearAndSetSemantics` block of the unavailable branch. If a pill test cannot find "Next card" by text, the label is inside `clearAndSetSemantics` by mistake (only cards use it).

- [ ] **Step 32: Look at every section, day and night.**

```bash
cd android/Truthy
./gradlew :app:installDebug
mkdir -p app/build/gallery
for section in icons buttons cards stamps shapes; do
  for night in false true; do
    adb shell am force-stop com.eienmosu.truthy
    adb shell am start -W -n com.eienmosu.truthy/.debug.GalleryActivity --es section "$section" --ez night "$night" > /dev/null
    sleep 2
    adb exec-out screencap -p > "app/build/gallery/$section-night-$night.png"
  done
done
ls app/build/gallery
```

Expected: ten PNG files, `buttons-night-false.png` through `stamps-night-true.png`, in `app/build/gallery` (an ignored build folder, nothing to commit). Open each one with the image viewer or the Read tool and check against the web at the same size:

1. Icons: 19 vectors plus the route icon and the heavier close cross, each readable, the plane an amber disc with a dark arrow, the lost heart an outline with a slash, the sky cloud a flat white cloud by day.
2. Buttons: the pill 60 high with the label centred; the dimmed pill at 0.45 with no shadow; the round buttons 48 across; the Back pill with its arrow; pressing each (hold a finger down in the emulator) shrinks it as the table says, and the pass-field sample shows a faint circle growing from the touch point.
3. Cards: the notches on the stub line, the dashed perforation 12 from the top and bottom, the progress track with its amber dot, the unavailable card in sunk paper.
4. Stamps: a double border (two thin lines with a gap), the slip stamps turned about 6 degrees, the stub stamps on raised paper, the intent stamps with a single heavy border; the landing plays again when "Play the landings again" is pressed.
5. Shapes: the ticket's two papers with the half circles cut at the seam, the dashed line between the notches, and the long soft shadow under the whole ticket.

If a shape is wrong (a notch bulging outwards, a shadow with a hard edge), fix the file and the test that pins it and run steps 12 and 14 again. Pixel-level comparison with the web is task 15's visual review, not this step.

- [ ] **Step 33: Run every gate, check hygiene and commit the gallery and the semantics test.**

```bash
cd android/Truthy
./gradlew :engine:test :tokengen:test :app:testDebugUnitTest :app:assembleDebug
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.IconPathsTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.IconsTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.LogoTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.ShapesTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.ShadowsTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.SkyTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.MotionTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.FrameInsetsTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.ui.ComponentsLogicTest.xml
cd ../..
grep -rn 'TODO\|FIXME' android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui android/Truthy/app/src/debug || echo "no markers"
git status --short
git add android/Truthy/app/src/debug android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/ui/ComponentsSemanticsTest.kt
git commit -m "test: add the component gallery for debug builds and the accessibility tests of the buttons, cards and stamps"
git status --short
git log --oneline -7
pnpm vitest run tests/repo-hygiene.test.ts
pnpm test
```

Expected: `BUILD SUCCESSFUL`; the nine result lines in the order of the `grep` arguments: `tests="4"` (`IconPathsTest`), `tests="7"` (`IconsTest`), `tests="2"` (`LogoTest`), `tests="8"` (`ShapesTest`), `tests="6"` (`ShadowsTest`), `tests="4"` (`SkyTest`), `tests="4"` (`MotionTest`), `tests="4"` (`FrameInsetsTest`), `tests="6"` (`ComponentsLogicTest`), all with `skipped="0" failures="0" errors="0"` (45 unit tests in all, on top of the tests of tasks 1 to 9, which stay green); `no markers`; before the last `git add` the status lists only the debug source set and the androidTest file; after the commit `git status --short` prints nothing; the log shows this task's commits in order (icons, logo, shapes and shadows and sky, buttons, cards and stamps, frame and test tags and focus ring, gallery and tests); the web's hygiene test passes with `Test Files  1 passed (1)`, which proves that no new Kotlin, XML or Gradle line carries a local path, an e-mail-shaped string or an em dash; `pnpm test` passes every Vitest file (README, Global Constraints).

What the next tasks rely on from this one, and the checks that are not in this task: task 12 composes the start flow from `DestinationCard`, `BackPill`, `PillButton`, `RoundButton`, `Logo`, `LogoMark`, `SkyBackdrop(lowerCloud = LowerCloud.START)`, `rememberPressTint` (pass fields, radius 6, and the continue line) and `TruthyIcon`/`RouteIcon`, provides `LocalReducedMotion` once, at the app root (`TruthyRoot`, so the round, the sheet and the result see it too), uses `TruthyFrame` or `rememberFrameInsets` for its column, tags the logo `TestTags.LOGO` and the pass `TestTags.PASS`, puts `keyboardFocusRing` on the pass fields (`FocusRingSpec.INSET`) and the continue line, and adds a `DebugScreen` value for the gallery to task 11's debug launch if it wants the gallery in the visual review script (the activity here works without it); task 13 builds the boarding pass from `TicketMainShape`, `TicketLowerShape`, `drawTicketPerforation`, `truthyShadow(shadows.ticket)`, `Stamp`, `StubStamp` and `IntentStamp` and gives the intent stamp its opacity and rotation from the drag; task 13 also uses `TruthyIcon(IconId.X)`, `SkyBackdrop(lowerCloud = LowerCloud.GAME)`, `rememberFrameInsets` and the tags `TICKET`, `STUB` and `CARD`; task 14 uses `PillButton`, `QuietButton`, `RoundButton`, `Stamp(StampVerdict.NEW_BEST)`, `TruthyFrame`, `rememberFrameInsets` and the tags `ROUND_SURFACE`, `SHEET_CARD` and `TICKET`; task 15 captures the gallery sections in day and night at the largest font scale (N9) and the press states (N8) for the visual pairs.
