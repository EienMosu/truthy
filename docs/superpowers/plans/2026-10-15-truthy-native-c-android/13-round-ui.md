### Task 13: The round screen: headers, ticket, stub and slip, stamps, the card drag, springs, haptics, the Timed flow, keyboard, announcements and source links

The round is where the game is played, so it is where a web view in a frame would show first. This task builds the Compose round screen for the question, answered and stamped phases of all four classes, ported from `components/play/PlayScreen.tsx`, `components/BoardingPass.tsx`, `components/play/useSwipe.ts`, `components/FlightPath.tsx`, `StreakPath.tsx`, `LivesPath.tsx` and `TimedPath.tsx`, and makes every interaction native (spec 5.3 to 5.6): the card follows the finger through a `pointerInput` on a stationary container inside the ticket's `verticalScroll`, a drag only claims horizontal-dominant movement so the ticket keeps its native vertical scroll and stretch, the release springs back with the finger's velocity and never throws the card, a touch catches a springing card, the 90 line and the verdicts give the haptics of spec 5.5, the hardware keys answer, go on and ask to leave, the live regions speak the web's sentences and hold them while the leave sheet is open, and the source link opens a Custom Tab in the app's colours. The leave sheet, back on the round and the result screen are task 14; this task gives them `RoundScreen(sheetOpen = ...)`, the `onRequestLeave` callback and the reusable ticket shell (`BoardingPass`, `PassLower`, `PassFieldGrid`).

The task is test first. The decisions that need no device are pure Kotlin in `:app` and are unit tested on the JVM: what each phase shows and says (`roundView`), which haptic a change of the round earns and when a drag crosses the commit line (`verdictHaptic`, `CommitLine`), what a hardware key does (`roundKeyAction`), the field grid's columns (`fieldColumnWidths`), the spoken link label, and that task 12's `FullSpeed` keeps the web's reduced-motion fades running when the system scale is 0. The gesture, the layout and the links are tested with Compose UI tests and Espresso-Intents on the API 36 emulator, including both tests Review Focus 5 asks for (a drag that starts in the edge zone, a diagonal drag on a long statement), and one manual `adb input` check of a drag inside the system gesture inset.

**This task was not compiled during drafting.** Nothing in this file was compiled or run while the plan was written. After the review, tasks 1 to 15 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: the JVM tests and, on the API 36 emulator, the instrumented tests. The defects that run found are fixed in this file (README, Drafting record). API signatures were checked against the AndroidX sources (`HapticFeedbackConstantsCompat`, `ViewCompat.performHapticFeedback`, `AnimatedContent`, `ContentTransform`, `AnimatedVisibilityScope.transition`, `performKeyInput`) and written from the current Compose and browser references. If a step fails to compile for a reason other than the "Unresolved reference" it announces, read the compiler message, fix that line, and keep the behaviour the tests state.

Builds on: tasks 1 to 6 (the engine: `RoundState` and the readers, swipe interpretation, `pad2`, the play copy, the header labels and layouts, `ticketFor`'s `TicketInfo`, the ticket scroll arithmetic), task 8 (`Tokens`, `TruthyType`, `TruthyTheme`, `resolvedTheme`, fonts), task 10 (icons, shapes, shadows, sky, buttons, stamps), task 11 (`RoundCoordinator`, the app root and the debug launch extras) and task 12 (the start flow that opens a round).

**Files:**
- Create (main, in `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/`): `RoundView.kt`, `RoundFeedback.kt`, `RoundKeys.kt`, `FieldColumns.kt`, `SourceLink.kt`, `RoundMotion.kt`, `CardTextSpans.kt`, `RoundHeaders.kt`, `BoardingPass.kt`, `PassParts.kt`, `SwipeCard.kt`, `RoundScreen.kt`, `RoundRoute.kt`
- Create (JVM tests, in `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/`): `RoundFixtures.kt`, `RoundViewTest.kt`, `RoundFeedbackTest.kt`, `RoundKeysTest.kt`, `FieldColumnsTest.kt`, `SourceLinkLabelTest.kt`, `KeepingFadesTest.kt`
- Create (device tests, in `android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/`): `RoundTestHost.kt`, `SwipeGestureTest.kt`, `RoundScreenTest.kt`, `SourceLinkIntentTest.kt`
- Modify: `android/Truthy/gradle/libs.versions.toml` and `android/Truthy/app/build.gradle.kts` (`androidx.browser` and `lifecycle-runtime-compose` for the app in step 8, Espresso-Intents for the device tests in step 11), and `android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt` (task 11's app root, step 20)

**Interfaces:**

Consumes, fixed by the README or by tasks already written (exact names):

```kotlin
// com.eienmosu.truthy.engine (tasks 1 to 6)
Card (id, answer, appliesTo, text.en.statement, text.en.explanation, source.title, source.url), @Serializable: Card.serializer()
Mode { CLASSIC, STREAK, LIVES, TIMED }, Phase { QUESTION, ANSWERED, STAMPED, FINISHED }, Route, Answered(card, given, correct, at)
RoundState(mode, route, cards, index, answers, phase, abandoned, source, clock), Clock(remainingMs, lastTick, hidden, holdMs)
RoundEvent.Answer(value, at), RoundEvent.Next, RoundEvent.Tick(now), StartArgs(mode, route, pool, history, seed)
fun startRound(args: StartArgs): RoundState; fun reduce(state: RoundState, event: RoundEvent): RoundState
fun currentCard(state: RoundState): Card?; fun lastAnswer(state: RoundState): Answered?; fun isDecided(state: RoundState): Boolean
fun scoreOf(mode: Mode, answers: List<Answered>): Int; val TIMED (roundMs); const val LIVES: Int
SwipeSample(x, y, t), SwipeContext(viewportWidth, cardShownAt), SwipeOutcome { TRUE, FALSE, CANCEL }, val SWIPE (commitPx)
fun intent(dx: Double): Double; fun canStart(sample: SwipeSample, context: SwipeContext): Boolean; fun interpret(samples: List<SwipeSample>, context: SwipeContext): SwipeOutcome
fun pad2(n: Int): String; enum class Theme { LIGHT, DARK }; fun textParts(text: String): List<TextPart>; fun modeInfo(mode: Mode): ModeInfo (name)
const val NEXT_ARRIVES_MS: Double; const val SPOKEN_RELEASE_MS: Double
fun verdictText(correct: Boolean, answer: Boolean, newBest: Boolean = false): String; fun roundStatus(round: RoundState): String
fun timedStatus(round: RoundState): String; fun timedCardText(round: RoundState): String
data class TicketInfo(val deckCode: String, val deckName: String, val sectionCode: String, val sectionName: String, val modeLabel: String, val best: Int?)
data class Span(val top: Double, val bottom: Double); data class SlipAt(val top: Double, val visible: Double, val gap: Double, val max: Double)
fun statementScroll(text: Span, visible: Double): Double; fun slipScroll(slip: Span, at: SlipAt): Double?
data class Point(val x: Double, val y: Double); enum class WaypointState { CORRECT, WRONG, CURRENT, FUTURE }
fun pointAt(t: Double): Point; fun waypointT(i: Int, n: Int): Double; fun flownPath(t: Double): String; fun headingAt(t: Double): Double
fun waypointStates(total: Int, results: List<Boolean>, current: Int, answered: Boolean): List<WaypointState>
fun flightPathLabel(total: Int, results: List<Boolean>, current: Int): String
class StreakLayout(t: (Int) -> Double, dot: Double, ticks: Boolean, ring: Int?, target: Boolean, future: List<Int>); fun streakLayout(done: Int, best: Int?): StreakLayout
fun streakLabel(streak: Int, best: Int?, ended: Boolean): String
class TrailLayout(x: (Int) -> Double, r: Double, side: Double, cross: Boolean); fun trailLayout(marks: Int): TrailLayout; fun livesLabel(results: List<Boolean>): String
fun clockText(remainingMs: Double): String; fun timedLabel(remainingMs: Double, correct: Int, wrong: Int): String

// com.eienmosu.truthy.design (task 8)
Tokens.Size (header, actions, carrier, statementMin, lower, barcode, notch, ticketInset, touchMin, gutter, maxWidth, safeTop, safeBottom, flightPathHeight),
Tokens.Space (s2 ... s24), Tokens.Radius (card, small), Tokens.Stroke (rule, stamp), Tokens.Duration (t2, tear, jolt, leaveTimed, dealTimed, reducedOut, reducedIn, strike), Tokens.Native.shortScreenBelow (plan A's native group),
Tokens.Transitions (jolt, stamp, answerRow), Tokens.SpringTransitions.snap, Tokens.Curves (ease, easeIn, easeOut, fall, spring), Tokens.Gesture (rotationDivisor, stubPull, intentOpacityGain)
TransitionSpec(durationMs, delayMs, easing); TruthyType (routeLabel, monoData, monoDataStrong, fieldLabel, fieldValue, legCode, legName, cardStatement,
answerLabel, answerValue, body, intentStamp, carrierTitle, carrierLabel, sourceLink, timedClock); val OverpassMono: FontFamily
TruthyTheme.colors (ink, inkMuted, rule, accent, onAccent, trueColor, falseColor, correct, wrong, surface, surfaceRaised, surfaceSunk), TruthyTheme.shadows.ticket
@Composable fun TruthyTheme(theme: ResolvedTheme, content: @Composable () -> Unit); fun resolvedTheme(theme: Theme): ResolvedTheme (colors, isDark); val LocalResolvedTheme
```

Consumes, **assumed from other tasks** (the README does not name them; step 1 checks each with `grep` and says what to do when a name differs):

```kotlin
// task 10 (its Produces, verbatim for the names this task uses), package com.eienmosu.truthy.design
object IconPaths { const val PLANE_ARROW: String; const val HEART: String; const val HEART_SLASH: String /* ... one const per ICON_PATHS entry */ }
enum class IconId { CLOSE, CROSS, CHECK, BACK_HEADER, BACK_PILL, FORWARD, CHEVRON_RIGHT, CHEVRON_DOWN, PLANE, CLOUD, SKY_CLOUD, BOOK, REPLAY, CLOCK, STAR, HEART, HEART_LOST, MOON, SUN }
@Composable fun TruthyIcon(id: IconId, modifier: Modifier = Modifier, tint: Color = TruthyTheme.colors.ink, width: Dp? = null, strokeWidth: Float? = null, label: String? = null)
data class TicketMainShape(val cornerRadius: Dp = Tokens.Radius.card, val notchRadius: Dp = Tokens.Size.notch) : Shape
data class TicketLowerShape(val cornerRadius: Dp = Tokens.Radius.card, val notchRadius: Dp = Tokens.Size.notch) : Shape
fun DrawScope.drawTicketPerforation(color: Color)                       // the dashed line at the bottom of the main part
@Composable fun Modifier.truthyShadow(spec: ShadowSpec, cornerRadius: Dp = Tokens.Radius.card, alpha: () -> Float = { 1f }): Modifier
enum class LowerCloud(val top: Float) { GAME(620f), START(660f) }
@Composable fun SkyBackdrop(modifier: Modifier = Modifier, lowerCloud: LowerCloud = LowerCloud.GAME)
val LocalReducedMotion: ProvidableCompositionLocal<Boolean>              // provided at the app root by task 12 (TruthyRoot)
@Composable fun TruthyFrame(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit)   // spec 5.6's 430 column and safe areas
object FocusRingSpec { val INSET: Dp }; @Composable fun Modifier.keyboardFocusRing(shape: Shape, offset: Dp = FocusRingSpec.OFFSET): Modifier
// task 10, package com.eienmosu.truthy.ui
enum class PillTone { INK, TRUE, FALSE }
@Composable fun PillButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, tone: PillTone = PillTone.INK, dimmed: Boolean = false, leadingIcon: (@Composable () -> Unit)? = null, trailingIcon: (@Composable () -> Unit)? = null)
@Composable fun RoundButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, variant: RoundVariant = RoundVariant.RAISED, enabled: Boolean = true, content: @Composable () -> Unit)
enum class StampVerdict { CORRECT, WRONG, NEW_BEST }; @Composable fun Stamp(verdict: StampVerdict, modifier: Modifier = Modifier, animate: Boolean = false, replayKey: Any? = null)
enum class StubStampKind { CORRECT, WRONG, TIME_UP }; @Composable fun StubStamp(kind: StubStampKind, modifier: Modifier = Modifier, replayKey: Any? = null)
enum class IntentKind { TRUE, FALSE }; @Composable fun IntentStamp(kind: IntentKind, modifier: Modifier = Modifier)
object TestTags { const val TICKET: String; const val STUB: String; const val CARD: String /* and the others */ }
// task 6, package com.eienmosu.truthy.engine
data class BarcodeBar(val x: Int, val width: Int); data class Barcode(val bars: List<BarcodeBar>, val width: Int); fun barcodeBars(data: String): Barcode
// task 12, package com.eienmosu.truthy.start
object FullSpeed : MotionDurationScale                                   // a duration scale of 1, for the fades the web keeps under reduced motion

// task 11 (its Produces), package com.eienmosu.truthy
class RoundCoordinator { val ticket: TicketInfo; val state: StateFlow<RoundState>; val sheetOpen: StateFlow<Boolean>; val cardShownAt: Double /* monotonic ms of the card's question phase */
                         fun answer(value: Boolean): Boolean; fun next(): Boolean; fun requestLeave(): Boolean; fun keepPlaying(); fun scrimTapAccepted(): Boolean; suspend fun leave() }   // answer and next apply the 250 and 420 ms guards
sealed interface TopScreen { data object Start; data class Round(val request: RoundRequest, val load: RoundLoad) }
sealed interface RoundLoad { data object Loading; data object Failed; class Ready(val coordinator: RoundCoordinator) }
class AppViewModel { val screen: StateFlow<TopScreen>; fun requestLeave(); fun roundBack(); fun leaveRound(); fun closeResult(): Boolean; fun playAgain(): Boolean }
@Composable fun TruthyRoot(app: AppViewModel)                           // app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt, `when (screen)` over TopScreen
// debug intent extras (DebugLaunch): truthy.screen (round), truthy.deck, truthy.section, truthy.mode, truthy.seed (a string extra, or a long one through extraText)
```

Produces (package `com.eienmosu.truthy.round`; task 14 and 15 rely on these names):

```kotlin
enum class TearSide { LEFT, RIGHT }
enum class StubMark { CORRECT, WRONG, TIME_UP }
data class Spoken(val status: String, val card: String)
data class RoundView(card, takesAnswers, answered, timed, decided, timeUp, beat, awaitsNext, actionLabel, streak, newBest, slip: Answered?,
    cardNumber, cardField, routeLine, heading, showStub, stubMark: StubMark?, stubHint: String?, tear: TearSide, leaveSide: TearSide,
    results: List<Boolean>, correctCount, wrongCount, spoken: Spoken)
fun roundView(round: RoundState, ticket: TicketInfo): RoundView
enum class RoundHaptic { THRESHOLD, CONFIRM, REJECT }
fun verdictHaptic(before: RoundState, after: RoundState): RoundHaptic?
class CommitLine(distance: Double = SWIPE.commitPx) { fun crossed(dx: Double): Boolean }
enum class RoundKey { LEFT, RIGHT, ENTER, ESCAPE }
sealed interface RoundKeyAction { data class Answer(val value: Boolean); data object Next; data object Leave; data object Swallow }
fun roundKeyAction(key: RoundKey, repeat: Boolean, modified: Boolean, sheetOpen: Boolean, phase: Phase, awaitsNext: Boolean): RoundKeyAction?
fun sourceLinkLabel(title: String): String                                  // "{title} (opens in browser)"
fun sourceTabIntent(colors: TruthyColors, dark: Boolean): CustomTabsIntent
fun openSource(context: Context, url: String, colors: TruthyColors, dark: Boolean)
@Composable fun rememberSourceOpener(): (String) -> Unit                    // the one opener of the app: task 14 uses it, never a second one
@Composable fun rememberRoundHaptics(): (RoundHaptic) -> Unit
fun cardText(text: String): AnnotatedString                                 // code parts in Overpass Mono at 0.92 em
data class PassLeg(val code: String, val name: String)
data class PassField(val label: String, val value: String, val spoken: String? = null, val muted: Boolean = false)
enum class PaperTone { RAISED, SUNK }
@Composable fun BoardingPass(from: PassLeg, to: PassLeg, fields: List<PassField>, modifier: Modifier = Modifier, jolt: Boolean = false,
    joltDelayMs: Int = Tokens.Transitions.jolt.delayMs, reduced: Boolean = false, shortLegs: Boolean = false,
    lower: @Composable BoxScope.() -> Unit, body: @Composable ColumnScope.() -> Unit)   // tagged TestTags.TICKET; lower gets at least the height the upper part leaves of the caller's minimum height and grows with its content
@Composable fun PassLower(tone: PaperTone, modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit = {})
@Composable fun PassFieldGrid(fields: List<PassField>, modifier: Modifier = Modifier)
@Composable fun PassStatement(statement: String, appliesTo: String, muted: Boolean, modifier: Modifier = Modifier, textModifier: Modifier = Modifier)
@Composable fun FlightPathHeader(total: Int, results: List<Boolean>, current: Int, answered: Boolean, reduced: Boolean, modifier: Modifier = Modifier)
@Composable fun StreakHeader(streak: Int, best: Int?, answered: Boolean?, reduced: Boolean, modifier: Modifier = Modifier)
@Composable fun LivesHeader(results: List<Boolean>, answered: Boolean, reduced: Boolean, modifier: Modifier = Modifier)
@Composable fun TimedHeader(remainingMs: Double, correct: Int, wrong: Int, reduced: Boolean, modifier: Modifier = Modifier)
// RoundHeaders.kt, internal, for task 14's completed route: the same frame and drawing pieces as the headers
@Composable internal fun PathFrame(label: String, progress: AnnotatedString, tally: AnnotatedString?, modifier: Modifier = Modifier, draw: DrawScope.() -> Unit)   // one image labelled `label`; `draw` runs in the 276 by 34 drawing's units
internal fun DrawScope.drawRouteLine(flownTo: Double, colors: TruthyColors)
internal fun DrawScope.drawMark(correct: Boolean, at: Point, scale: Double, fresh: Boolean, plain: Boolean, colors: TruthyColors)
val CardDragOffset: SemanticsPropertyKey<Float>                             // the drawn card offset in dp, for UI tests (N4)
@Composable fun RoundScreen(round: RoundState, ticket: TicketInfo, cardShownAt: () -> Double, onAnswer: (Boolean) -> Unit, onNext: () -> Unit,
    onRequestLeave: () -> Unit, modifier: Modifier = Modifier, sheetOpen: Boolean = false, reducedMotion: Boolean = LocalReducedMotion.current,
    haptics: (RoundHaptic) -> Unit = rememberRoundHaptics(), openLink: (String) -> Unit = rememberSourceOpener())
@Composable fun RoundLoading(onRequestLeave: () -> Unit, modifier: Modifier = Modifier)
@Composable fun RoundRoute(coordinator: RoundCoordinator, onRequestLeave: () -> Unit, modifier: Modifier = Modifier, sheetOpen: Boolean = false)
```

What task 14 must know: `RoundScreen` draws nothing once the round is finished or abandoned (the result is task 14's); while `sheetOpen` is true the card takes no drag, the keys are left to the sheet's window, and the two live regions hold the text they had when the sheet opened, releasing it 150 ms after it closes. `RoundRoute(coordinator, onRequestLeave, sheetOpen = ...)` is the round on task 11's coordinator. Until task 14 the app root passes an `onRequestLeave` that calls `app.leaveRound()` (step 20); task 14 replaces it with `app.requestLeave()`, the sheet driven by `coordinator.sheetOpen`, and back on the round. `BoardingPass` carries `TestTags.TICKET`, the stub `TestTags.STUB` and the drawn card `TestTags.CARD`. `PathFrame`, `drawRouteLine` and `drawMark` are internal in `RoundHeaders.kt` for task 14's completed route; `rememberSourceOpener` and `cardText` are the only link opener and code-text helper (task 14 adds none). The device test support's class is `RoundTestState` (not `RoundHost`, which is task 14's composable).

**Rules:**

1. **One answer path.** The True and False pills, the swipe, the arrow keys and the accessibility actions "Answer true" and "Answer false" all call `onAnswer`; the coordinator applies the phase, sheet and 250 ms guards and `next` the 420 ms guard (task 11). The screen adds only what the web's binding adds: a drag starts only when `canStart` passes on the touch-down sample and the round is in the question phase with no sheet open; the dimmed Timed pills ignore presses.
2. **The drag** (spec 5.3, reference 7.2 items 1 to 3). A `pointerInput` on a stationary container inside the ticket's `verticalScroll`; the card's translation and rotation (drawn dx / 18 degrees) are a `graphicsLayer` inside it. `awaitFirstDown(requireUnconsumed = false)` gives the first sample. Until the touch slop is passed the gesture claims nothing; past it, horizontal-dominant movement (|x| > |y|) is consumed and the card follows, otherwise the gesture lets go and the parent scroll takes it. Samples are window coordinates in dp with `PointerInputChange.uptimeMillis`; `viewportWidth` is the window width in dp. A second pointer, a cancel (a consumed release, which is how Compose reports `ACTION_CANCEL` and the system's back gesture taking the pointers) or the card stopping to take answers springs the card back with no answer. On release `interpret` decides.
3. **Drawn offset and springs.** The drawn offset is the current x minus the touch-down x, slop included. A touch on a card that is still springing back stops it at its offset c and draws c + dx, while `intent`, the intent stamps and the threshold haptic use dx alone. Release always springs to rest (never thrown) with `spring(dampingRatio = 0.6f, stiffness = 360f)` (reference 5.7) seeded with the `VelocityTracker`'s release velocity; the stub's pull and turn go back over `Tokens.SpringTransitions.snap`; the intent stamps vanish at once, as on the web. With reduced motion the card is at rest at once.
4. **Haptics** (spec 5.5), through `ViewCompat.performHapticFeedback` only: `GESTURE_THRESHOLD_ACTIVATE` once per crossing of |dx| >= 90 (moving back under re-arms it silently), `CONFIRM` for a recorded right answer, `REJECT` for a recorded wrong answer and for the Timed clock reaching zero. Nothing else vibrates.
5. **Phases, copy and motion** follow `PlayScreen.tsx` exactly (`roundView`): the Card field is "nn / tt" in Classic and "nn" otherwise; the stub is shown in the question phase and throughout Timed; Classic, Streak and Three lives tear the stub (correct to the left, wrong to the right, 460 ms `fall`, opacity `easeIn`) and reveal the slip, whose stamp lands (task 10's `Stamp`); Timed stamps the stub ("Next card coming up", "Wrong, saved for review at the end", "This card doesn't count · n answered"), dims the pills, and after the hold the card leaves towards the answered side (x 120 percent, 8 degrees, 220 ms) while the next comes up from 14 dp over 280 ms; the main part jolts 2 dp (delay 420, 120 in the beat, 240 at time up); the answer row leaves and the Next row enters from 12 dp after 360 ms; "See results" replaces "Next card" once the round is decided.
6. **Reduced motion** (reference 5.8): stamps, jolt, tear, the Timed swap, the slash, the plane fade and the card spring are at rest or instant; the slip fades in over 140, the stub fades in 140 and out 100, both action rows fade over 220 with no delay and no movement, and these fades run inside `withContext(FullSpeed)`, task 12's `MotionDurationScale` of 1 (the app's one implementation), so they play even when `ANIMATOR_DURATION_SCALE` is 0. Reduced motion itself is task 10's `LocalReducedMotion`, which task 12 provides at the app root. The Timed plane steps once a second.
7. **Keyboard** (spec section 2): Left answers False and Right True in the question phase, Enter is the action once the round awaits Next (a focused pill or link takes its own Enter first), Escape asks to leave in every phase and its key-up is consumed too, so Android never falls back to Back. A repeated key-down of these four keys is swallowed before anything sees it, so a held key acts once. Keys with Alt, Ctrl, Meta or Shift, and every key while the sheet is open, are left alone.
8. **Announcements** (reference 4.5 and 5.9): an invisible heading "{deckName}, {sectionName}: {class} round"; a polite live region with `verdictText` and `roundStatus` (Timed: `timedStatus`); in Timed a second polite region with `timedCardText`. Both hold their text while the sheet is open and release it `SPOKEN_RELEASE_MS` after it closes. Each header is one image with its full-sentence label; the stub, the band and the barcode are hidden from accessibility.
9. **Focus**: the new card's statement takes focus (in Timed only the first card's; later ones go to the ticket if the statement had focus); Next takes focus when it has arrived (at once with reduced motion), and at time up only if True or False had focus. The root keeps keyboard focus inside the screen.
10. **Ticket scroll** (`ticketScroll.ts`): a new card scrolls to `statementScroll` (smooth in Timed, instant otherwise); a Timed stamp scrolls to the end; an answer outside Timed scrolls to `slipScroll` when that is not null. On screens 568 dp or taller the scroller runs on under the action row with that row and the 12 dp gap as bottom padding; below 568 it stops at the row.
11. **Links**: the source row's spoken label is "{source.title} (opens in browser)"; it opens a Custom Tab whose colour scheme and toolbar and navigation bar colours (`surface`) come from the app's resolved theme. A device with no browser does nothing.
12. **Text** scales with the font scale, every fixed height is a minimum (`heightIn(min = ...)`), and nothing is selectable.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
cd android/Truthy
grep -rnE "class RoundCoordinator|val ticket: TicketInfo|cardShownAt|fun answer\(|fun next\(|suspend fun leave\(|class RoundLoad|class Round\(val request" app/src/main/kotlin
grep -rnE "TopScreen\.Round" app/src/main
grep -rnE "object IconPaths|enum class IconId|fun TruthyIcon\(|class TicketMainShape|class TicketLowerShape|fun DrawScope\.drawTicketPerforation|fun SkyBackdrop\(|fun Modifier\.truthyShadow|enum class PillTone|fun PillButton\(|fun RoundButton\(|enum class StampVerdict|fun Stamp\(|enum class StubStampKind|fun StubStamp\(|fun IntentStamp\(|object TestTags|fun TruthyFrame\(|fun Modifier\.keyboardFocusRing|val LocalReducedMotion|object FullSpeed" app/src/main/kotlin
grep -nE "ui-test-junit4|ui-test-manifest|lifecycle-runtime-compose|androidx-browser|espresso" gradle/libs.versions.toml
grep -rnE "truthy\.(screen|deck|section|mode|seed)" app/src/main/kotlin
./gradlew :engine:test :app:testDebugUnitTest
```

Expected: the first command finds `RoundCoordinator` with the members listed under Interfaces; the second finds one `is TopScreen.Round ->` branch in the app root (task 11's `TruthyRoot.kt` under `app/src/main/java`); the third finds every task 10 and task 12 name listed; the fourth finds the Compose UI test, test manifest, `lifecycle-runtime-compose` and `browser` entries and an `espresso-core` entry; the fifth finds the five debug extras; the last ends `BUILD SUCCESSFUL`.

If a name differs, do not rename the other task's code: use its actual name in this task's files. Every use of an assumed name sits in `RoundScreen.kt`, `RoundRoute.kt`, `BoardingPass.kt`, `PassParts.kt`, `RoundHeaders.kt`, `RoundMotion.kt` and the step 20 snippet, and nowhere else. If `RoundCoordinator` has no `cardShownAt` (the monotonic time the current card entered the question phase), stop and report: the swipe's settle check needs it, and it belongs to task 11.

- [ ] **Step 2: Write the JVM fixtures and the failing test of what each phase shows and says.**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/RoundFixtures.kt`:

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.StartArgs
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.modeInfo
import com.eienmosu.truthy.engine.reduce
import com.eienmosu.truthy.engine.startRound
import kotlinx.serialization.json.Json

/** Small rounds for the JVM tests. Cards are decoded from the shipped JSON shape, so the tests need no Card constructor. */
internal object RoundFixtures {
    fun card(n: Int, answer: Boolean, appliesTo: String = ""): Card = Json.decodeFromString(
        Card.serializer(),
        """{"id":"test-c$n","section":"SEC","text":{"en":{"statement":"Statement $n","explanation":"Because $n."}},""" +
            """"answer":$answer,"source":{"title":"Docs $n","url":"https://example.com/docs/$n"},"difficulty":1,""" +
            """"appliesTo":"$appliesTo","conflictGroups":[]}""",
    )

    /** Half True, half False, so every class can deal from it. */
    fun pool(size: Int = 10): List<Card> = (1..size).map { card(it, answer = it % 2 == 0) }

    fun start(mode: Mode, pool: List<Card> = pool()): RoundState =
        startRound(StartArgs(mode, Route("test", "SEC"), pool, emptyMap(), 7.0))

    fun ticket(mode: Mode, best: Int? = null): TicketInfo =
        TicketInfo("TST", "Test deck", "SEC", "Section", modeInfo(mode).name, best)

    /** Answers the card on screen right or wrong, whatever its answer is. */
    fun answer(round: RoundState, correct: Boolean, at: Double = 1_000.0): RoundState {
        val card = currentCard(round)!!
        return reduce(round, RoundEvent.Answer(if (correct) card.answer else !card.answer, at))
    }

    fun next(round: RoundState): RoundState = reduce(round, RoundEvent.Next)

    fun tick(round: RoundState, now: Double): RoundState = reduce(round, RoundEvent.Tick(now))

    fun word(answer: Boolean): String = if (answer) "True" else "False"
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/RoundViewTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.round.RoundFixtures.answer
import com.eienmosu.truthy.round.RoundFixtures.next
import com.eienmosu.truthy.round.RoundFixtures.start
import com.eienmosu.truthy.round.RoundFixtures.tick
import com.eienmosu.truthy.round.RoundFixtures.ticket
import com.eienmosu.truthy.round.RoundFixtures.word
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RoundViewTest {
    private val classic = ticket(Mode.CLASSIC)

    @Test
    fun aClassicQuestionShowsTheTicketWords() {
        val view = roundView(start(Mode.CLASSIC), classic)
        assertEquals("01", view.cardNumber)
        assertEquals("01 / 10", view.cardField)
        assertEquals("TST → SEC · Classic", view.routeLine)
        assertEquals("Test deck, Section: Classic round", view.heading)
        assertTrue(view.takesAnswers)
        assertTrue(view.showStub)
        assertFalse(view.answered)
        assertFalse(view.awaitsNext)
        assertNull(view.stubMark)
        assertNull(view.stubHint)
        assertNull(view.slip)
        assertEquals(Spoken("", ""), view.spoken)
        assertEquals("Next card", view.actionLabel)
    }

    @Test
    fun aCorrectClassicAnswerRevealsTheSlipAndTearsTheStubLeft() {
        val first = start(Mode.CLASSIC)
        val card = currentCard(first)!!
        val view = roundView(answer(first, correct = true), classic)
        assertTrue(view.answered)
        assertTrue(view.awaitsNext)
        assertFalse(view.showStub)
        assertFalse(view.takesAnswers)
        assertEquals(TearSide.LEFT, view.tear)
        assertEquals(card.id, view.slip!!.card.id)
        assertTrue(view.slip!!.correct)
        assertEquals("Correct. The answer is ${word(card.answer)}.", view.spoken.status)
        assertEquals("", view.spoken.card)
        assertEquals("Next card", view.actionLabel)
        assertEquals(listOf(true), view.results)
        assertEquals(1, view.correctCount)
        assertEquals(0, view.wrongCount)
    }

    @Test
    fun aWrongClassicAnswerTearsTheStubRight() {
        val first = start(Mode.CLASSIC)
        val card = currentCard(first)!!
        val view = roundView(answer(first, correct = false), classic)
        assertEquals(TearSide.RIGHT, view.tear)
        assertEquals("Not quite. The answer is ${word(card.answer)}.", view.spoken.status)
        assertEquals(listOf(false), view.results)
        assertEquals(1, view.wrongCount)
    }

    @Test
    fun nextCardCountsTheCardField() {
        val view = roundView(next(answer(start(Mode.CLASSIC), correct = true)), classic)
        assertEquals("02", view.cardNumber)
        assertEquals("02 / 10", view.cardField)
        assertTrue(view.takesAnswers)
        assertTrue(view.showStub)
        assertEquals(Spoken("", ""), view.spoken)
    }

    @Test
    fun theTenthAnswerOffersSeeResults() {
        var round = start(Mode.CLASSIC)
        repeat(10) { i ->
            round = answer(round, correct = true)
            if (i < 9) round = next(round)
        }
        val view = roundView(round, classic)
        assertTrue(view.decided)
        assertEquals("See results", view.actionLabel)
        assertEquals("10 / 10", view.cardField)
    }

    @Test
    fun aShortPoolShowsItsOwnTotal() {
        assertEquals("01 / 07", roundView(start(Mode.CLASSIC, RoundFixtures.pool(7)), classic).cardField)
    }

    @Test
    fun aStreakThatPassesABestOfAtLeastOneSaysNewBestOnce() {
        val streak = ticket(Mode.STREAK, best = 2)
        val second = answer(next(answer(start(Mode.STREAK), correct = true)), correct = true)
        assertFalse("equalling the best is not a new best", roundView(second, streak).newBest)
        var round = next(second)
        val card = currentCard(round)!!
        round = answer(round, correct = true)
        val view = roundView(round, streak)
        assertEquals(3, view.streak)
        assertTrue(view.newBest)
        assertEquals("Correct. The answer is ${word(card.answer)}. New best.", view.spoken.status)
    }

    @Test
    fun aWrongStreakAnswerSaysWhereTheStreakEnded() {
        val streak = ticket(Mode.STREAK, best = 2)
        var round = start(Mode.STREAK)
        repeat(3) { round = next(answer(round, correct = true)) }
        val card = currentCard(round)!!
        val view = roundView(answer(round, correct = false), streak)
        assertFalse(view.newBest)
        assertTrue(view.decided)
        assertEquals("See results", view.actionLabel)
        assertEquals("Not quite. The answer is ${word(card.answer)}. Streak ended at 3.", view.spoken.status)
    }

    @Test
    fun noNewBestWithoutAStoredBestOfAtLeastOne() {
        val once = answer(start(Mode.STREAK), correct = true)
        assertFalse(roundView(once, ticket(Mode.STREAK, best = null)).newBest)
        assertFalse(roundView(once, ticket(Mode.STREAK, best = 0)).newBest)
        assertFalse(roundView(once, ticket(Mode.STREAK, best = 0)).spoken.status.endsWith("New best."))
    }

    @Test
    fun aWrongThreeLivesAnswerSaysTheLivesLeft() {
        val first = start(Mode.LIVES)
        val card = currentCard(first)!!
        val view = roundView(answer(first, correct = false), ticket(Mode.LIVES))
        assertEquals("Not quite. The answer is ${word(card.answer)}. Life lost, 2 left.", view.spoken.status)
    }

    @Test
    fun aTimedQuestionShowsTheCardNumberAloneAndKeepsTheStub() {
        val view = roundView(start(Mode.TIMED), ticket(Mode.TIMED))
        assertEquals("01", view.cardField)
        assertEquals("TST → SEC · Timed", view.routeLine)
        assertTrue(view.showStub)
        assertTrue(view.takesAnswers)
        assertNull(view.stubMark)
        assertEquals(Spoken("", ""), view.spoken)
    }

    @Test
    fun aRightTimedAnswerStampsTheStub() {
        val armed = tick(start(Mode.TIMED), 1_000.0)
        val card = currentCard(armed)!!
        val view = roundView(answer(armed, correct = true, at = 1_500.0), ticket(Mode.TIMED))
        assertTrue(view.beat)
        assertFalse(view.answered)
        assertFalse(view.awaitsNext)
        assertFalse(view.takesAnswers)
        assertTrue(view.showStub)
        assertEquals(StubMark.CORRECT, view.stubMark)
        assertEquals("Next card coming up", view.stubHint)
        assertEquals("Correct.", view.spoken.status)
        assertEquals(if (card.answer) TearSide.RIGHT else TearSide.LEFT, view.leaveSide)
    }

    @Test
    fun aWrongTimedAnswerIsSavedForReview() {
        val armed = tick(start(Mode.TIMED), 1_000.0)
        val card = currentCard(armed)!!
        val view = roundView(answer(armed, correct = false, at = 1_500.0), ticket(Mode.TIMED))
        assertEquals(StubMark.WRONG, view.stubMark)
        assertEquals("Wrong, saved for review at the end", view.stubHint)
        assertEquals("Not quite.", view.spoken.status)
        assertEquals(if (card.answer) TearSide.LEFT else TearSide.RIGHT, view.leaveSide)
    }

    @Test
    fun theNextTimedCardIsAnnouncedAfterTheHold() {
        val stamped = answer(tick(start(Mode.TIMED), 1_000.0), correct = true, at = 1_500.0)
        val round = tick(stamped, 2_200.0)
        val view = roundView(round, ticket(Mode.TIMED))
        assertEquals(1, round.index)
        assertTrue(view.takesAnswers)
        assertEquals("02", view.cardField)
        assertEquals("Card 2. ${currentCard(round)!!.text.en.statement}", view.spoken.card)
    }

    @Test
    fun timeUpStampsTheStubAndOffersSeeResults() {
        var round = tick(answer(tick(start(Mode.TIMED), 1_000.0), correct = true, at = 1_500.0), 2_200.0)
        var now = 3_200.0
        while (!isDecided(round)) {
            round = tick(round, now)
            now += 1_000.0
        }
        val view = roundView(round, ticket(Mode.TIMED))
        assertTrue(view.timeUp)
        assertFalse(view.beat)
        assertTrue(view.awaitsNext)
        assertEquals(StubMark.TIME_UP, view.stubMark)
        assertEquals("This card doesn't count · 1 answered", view.stubHint)
        assertEquals("See results", view.actionLabel)
        assertEquals("Time is up. This card doesn't count.", view.spoken.status)
        assertEquals("", view.spoken.card)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.round.*'
```

Expected: `BUILD FAILED` at `:app:compileDebugUnitTestKotlin` with `Unresolved reference 'roundView'`, `'Spoken'`, `'TearSide'` and `'StubMark'`.

- [ ] **Step 3: Write `roundView`.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundView.kt`:

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Answered
import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.engine.lastAnswer
import com.eienmosu.truthy.engine.pad2
import com.eienmosu.truthy.engine.roundStatus
import com.eienmosu.truthy.engine.scoreOf
import com.eienmosu.truthy.engine.timedCardText
import com.eienmosu.truthy.engine.timedStatus
import com.eienmosu.truthy.engine.verdictText

/** Which way the torn stub falls (left after a right answer) or a Timed card leaves (towards the side answered). */
enum class TearSide { LEFT, RIGHT }

/** What the stub of a Timed card is stamped with. */
enum class StubMark { CORRECT, WRONG, TIME_UP }

/** What the two live regions say: the status, and in Timed the card announcer. */
data class Spoken(val status: String, val card: String)

/** Everything the round screen derives from the round, as RoundView in components/play/PlayScreen.tsx does. */
data class RoundView(
    val card: Card?,
    val takesAnswers: Boolean,
    val answered: Boolean,
    val timed: Boolean,
    val decided: Boolean,
    val timeUp: Boolean,
    val beat: Boolean,
    val awaitsNext: Boolean,
    val actionLabel: String,
    val streak: Int,
    val newBest: Boolean,
    val slip: Answered?,
    val cardNumber: String,
    val cardField: String,
    val routeLine: String,
    val heading: String,
    val showStub: Boolean,
    val stubMark: StubMark?,
    val stubHint: String?,
    val tear: TearSide,
    val leaveSide: TearSide,
    val results: List<Boolean>,
    val correctCount: Int,
    val wrongCount: Int,
    val spoken: Spoken,
)

fun roundView(round: RoundState, ticket: TicketInfo): RoundView {
    val answered = round.phase == Phase.ANSWERED
    val last = if (answered) lastAnswer(round) else null
    val timed = round.mode == Mode.TIMED
    val decided = isDecided(round)
    val timeUp = timed && decided
    val beat = timed && round.phase == Phase.STAMPED && !decided
    val stamped = if (beat) lastAnswer(round) else null
    val streak = if (round.mode == Mode.STREAK) scoreOf(Mode.STREAK, round.answers) else 0
    val best = ticket.best
    val newBest = last?.correct == true && best != null && best >= 1 && streak == best + 1
    val cardNumber = pad2(round.index + 1)
    val results = round.answers.map { it.correct }
    val correct = results.count { it }
    val status = when {
        timed -> timedStatus(round)
        last != null -> listOf(verdictText(last.correct, last.card.answer, newBest), roundStatus(round))
            .filter { it.isNotEmpty() }
            .joinToString(" ")
        else -> ""
    }
    return RoundView(
        card = currentCard(round),
        takesAnswers = round.phase == Phase.QUESTION,
        answered = answered,
        timed = timed,
        decided = decided,
        timeUp = timeUp,
        beat = beat,
        awaitsNext = answered || timeUp,
        actionLabel = if (decided) "See results" else "Next card",
        streak = streak,
        newBest = newBest,
        slip = last,
        cardNumber = cardNumber,
        cardField = if (round.mode == Mode.CLASSIC) "$cardNumber / ${pad2(round.cards.size)}" else cardNumber,
        routeLine = "${ticket.deckCode} → ${ticket.sectionCode} · ${ticket.modeLabel}",
        heading = "${ticket.deckName}, ${ticket.sectionName}: ${ticket.modeLabel} round",
        showStub = round.phase == Phase.QUESTION || timed,
        stubMark = when {
            timeUp -> StubMark.TIME_UP
            stamped == null -> null
            stamped.correct -> StubMark.CORRECT
            else -> StubMark.WRONG
        },
        stubHint = when {
            timeUp -> "This card doesn't count · ${round.answers.size} answered"
            stamped == null -> null
            stamped.correct -> "Next card coming up"
            else -> "Wrong, saved for review at the end"
        },
        tear = if (last?.correct == false) TearSide.RIGHT else TearSide.LEFT,
        leaveSide = if (lastAnswer(round)?.given == true) TearSide.RIGHT else TearSide.LEFT,
        results = results,
        correctCount = correct,
        wrongCount = results.size - correct,
        spoken = Spoken(status, if (timed) timedCardText(round) else ""),
    )
}
```

- [ ] **Step 4: Run the test.**

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.round.RoundViewTest'
```

Expected: `BUILD SUCCESSFUL`; `app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.round.RoundViewTest.xml` reports `tests="15" failures="0" errors="0"`.

- [ ] **Step 5: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundView.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/RoundFixtures.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/RoundViewTest.kt
git commit -m "feat: derive what the Android round screen shows and says in each phase"
```

- [ ] **Step 6: Write the failing tests of the haptic decisions, the keys, the field columns, the link label and the kept fades.**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/RoundFeedbackTest.kt` (Feel item N6 starts here: one haptic per crossing, none per move):

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.engine.reduce
import com.eienmosu.truthy.round.RoundFixtures.answer
import com.eienmosu.truthy.round.RoundFixtures.next
import com.eienmosu.truthy.round.RoundFixtures.start
import com.eienmosu.truthy.round.RoundFixtures.tick
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RoundFeedbackTest {
    @Test
    fun aRightAnswerConfirms() {
        val first = start(Mode.CLASSIC)
        assertEquals(RoundHaptic.CONFIRM, verdictHaptic(first, answer(first, correct = true)))
    }

    @Test
    fun aWrongAnswerRejects() {
        val first = start(Mode.CLASSIC)
        assertEquals(RoundHaptic.REJECT, verdictHaptic(first, answer(first, correct = false)))
    }

    @Test
    fun nextCardIsSilent() {
        val answered = answer(start(Mode.CLASSIC), correct = true)
        assertNull(verdictHaptic(answered, next(answered)))
    }

    @Test
    fun theTimedClockRejectsOnceWhenItReachesZeroAndTicksAreOtherwiseSilent() {
        var round = tick(start(Mode.TIMED), 1_000.0)
        var now = 2_000.0
        val felt = mutableListOf<RoundHaptic>()
        while (!isDecided(round)) {
            val after = tick(round, now)
            verdictHaptic(round, after)?.let { felt.add(it) }
            round = after
            now += 1_000.0
        }
        assertEquals(listOf(RoundHaptic.REJECT), felt)
        assertNull(verdictHaptic(round, tick(round, now)))
    }

    @Test
    fun anAnswerThatRunsOutTheClockRejectsWithoutAVerdict() {
        var round = tick(start(Mode.TIMED), 1_000.0)
        var now = 2_000.0
        while (round.clock!!.remainingMs > 1_000.0) {
            round = tick(round, now)
            now += 1_000.0
        }
        val card = currentCard(round)!!
        val after = reduce(round, RoundEvent.Answer(card.answer, round.clock!!.lastTick!! + 1_000.0))
        assertEquals(round.answers.size, after.answers.size)
        assertTrue(isDecided(after))
        assertEquals(RoundHaptic.REJECT, verdictHaptic(round, after))
    }

    @Test
    fun theCommitLineFiresOncePerCrossing() {
        val line = CommitLine()
        val fired = listOf(0.0, 30.0, 89.9, 90.0, 120.0, 95.0, 60.0, 91.0, 130.0).map { line.crossed(it) }
        assertEquals(listOf(false, false, false, true, false, false, false, true, false), fired)
    }

    @Test
    fun theCommitLineCountsBothSides() {
        val line = CommitLine()
        val fired = listOf(-50.0, -90.0, -200.0, -10.0, 100.0).map { line.crossed(it) }
        assertEquals(listOf(false, true, false, false, true), fired)
    }
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/RoundKeysTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Phase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RoundKeysTest {
    private fun action(key: RoundKey, phase: Phase, awaitsNext: Boolean = false, repeat: Boolean = false, modified: Boolean = false, sheetOpen: Boolean = false) =
        roundKeyAction(key, repeat, modified, sheetOpen, phase, awaitsNext)

    @Test
    fun aHeldKeyActsOnceInEveryPhase() {
        for (key in RoundKey.entries) for (phase in Phase.entries) {
            assertEquals(RoundKeyAction.Swallow, action(key, phase, awaitsNext = true, repeat = true))
        }
    }

    @Test
    fun aKeyWithAModifierIsLeftAlone() {
        for (key in RoundKey.entries) assertNull(action(key, Phase.QUESTION, modified = true))
    }

    @Test
    fun everyKeyIsLeftToTheSheetWhileItIsOpen() {
        for (key in RoundKey.entries) assertNull(action(key, Phase.ANSWERED, awaitsNext = true, sheetOpen = true))
    }

    @Test
    fun escapeAsksToLeaveInEveryPhase() {
        for (phase in listOf(Phase.QUESTION, Phase.ANSWERED, Phase.STAMPED)) {
            assertEquals(RoundKeyAction.Leave, action(RoundKey.ESCAPE, phase))
        }
    }

    @Test
    fun theArrowsAnswerOnlyAQuestion() {
        assertEquals(RoundKeyAction.Answer(false), action(RoundKey.LEFT, Phase.QUESTION))
        assertEquals(RoundKeyAction.Answer(true), action(RoundKey.RIGHT, Phase.QUESTION))
        assertNull(action(RoundKey.RIGHT, Phase.ANSWERED, awaitsNext = true))
        assertNull(action(RoundKey.LEFT, Phase.STAMPED))
    }

    @Test
    fun enterIsTheActionOnlyOnceTheRoundAwaitsNext() {
        assertEquals(RoundKeyAction.Next, action(RoundKey.ENTER, Phase.ANSWERED, awaitsNext = true))
        assertEquals(RoundKeyAction.Next, action(RoundKey.ENTER, Phase.STAMPED, awaitsNext = true))
        assertNull(action(RoundKey.ENTER, Phase.QUESTION))
        assertNull(action(RoundKey.ENTER, Phase.STAMPED, awaitsNext = false))
    }
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/FieldColumnsTest.kt` (the web's `minmax(max-content, 1.1fr) minmax(max-content, 1fr) minmax(max-content, 1fr)`):

```kotlin
package com.eienmosu.truthy.round

import org.junit.Assert.assertEquals
import org.junit.Test

class FieldColumnsTest {
    @Test
    fun valuesThatFitShareTheWidth11To1To1() {
        assertEquals(listOf(110, 100, 100), fieldColumnWidths(listOf(50, 40, 40), 310))
    }

    @Test
    fun aValueWiderThanItsShareKeepsItsWidthAndTheOthersShareTheRest() {
        assertEquals(listOf(150, 80, 80), fieldColumnWidths(listOf(150, 40, 40), 310))
    }

    @Test
    fun theLastFlexibleColumnTakesTheRoundingRemainder() {
        assertEquals(listOf(110, 100, 101), fieldColumnWidths(listOf(50, 40, 40), 311))
    }

    @Test
    fun valuesThatCannotAllFitOnOneLineShareTheWidthAndWrap() {
        assertEquals(listOf(106, 96, 98), fieldColumnWidths(listOf(200, 150, 100), 300))
    }
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/SourceLinkLabelTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import org.junit.Assert.assertEquals
import org.junit.Test

class SourceLinkLabelTest {
    @Test
    fun theSpokenLabelSaysTheLinkOpensInTheBrowser() {
        assertEquals("AWS Pricing • Billing (opens in browser)", sourceLinkLabel("AWS Pricing • Billing"))
    }
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/KeepingFadesTest.kt` (Review Focus 4: the fades the web keeps under reduced motion still play when the system scale is 0):

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.runtime.MonotonicFrameClock
import androidx.compose.ui.MotionDurationScale
import com.eienmosu.truthy.start.FullSpeed
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Assert.assertTrue
import org.junit.Test

// The round keeps its reduced-motion fades with task 12's FullSpeed, the app's one MotionDurationScale of 1.
class KeepingFadesTest {
    private class StepClock : MonotonicFrameClock {
        var frames = 0
        private var now = 0L
        override suspend fun <R> withFrameNanos(onFrame: (frameTimeNanos: Long) -> R): R {
            frames += 1
            now += 16_000_000L
            return onFrame(now)
        }
    }

    private object AnimationsOff : MotionDurationScale {
        override val scaleFactor: Float get() = 0f
    }

    @Test
    fun aKeptFadeTakesItsTimeWhenTheSystemTurnsAnimationsOff() = runBlocking {
        val clock = StepClock()
        withContext(clock + AnimationsOff) {
            Animatable(0f).animateTo(1f, tween(140))
            val plain = clock.frames
            clock.frames = 0
            val kept = Animatable(0f)
            withContext(FullSpeed) { kept.animateTo(1f, tween(140)) }
            assertTrue("an animation under scale 0 ends at once, took $plain frames", plain <= 2)
            assertTrue("a kept 140 ms fade runs about 9 frames of 16 ms, took ${clock.frames}", clock.frames >= 8)
            assertTrue(kept.value == 1f)
        }
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.round.*'
```

Expected: `BUILD FAILED` at `:app:compileDebugUnitTestKotlin` with `Unresolved reference` for `verdictHaptic`, `RoundHaptic`, `CommitLine`, `roundKeyAction`, `RoundKey`, `RoundKeyAction`, `fieldColumnWidths` and `sourceLinkLabel` (`KeepingFadesTest` compiles already: `FullSpeed` is task 12's).

- [ ] **Step 7: Write the haptic decisions, the keys and the field columns.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundFeedback.kt`:

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.SWIPE
import com.eienmosu.truthy.engine.isDecided
import kotlin.math.abs

/** The haptics of spec 5.5. */
enum class RoundHaptic { THRESHOLD, CONFIRM, REJECT }

/**
 * The haptic a change of the round earns: a recorded answer confirms or rejects; the Timed clock reaching zero
 * rejects (also when an answer runs it out, which records no answer). Anything else is silent.
 */
fun verdictHaptic(before: RoundState, after: RoundState): RoundHaptic? {
    if (after.answers.size > before.answers.size) {
        return if (after.answers.last().correct) RoundHaptic.CONFIRM else RoundHaptic.REJECT
    }
    if (after.mode == Mode.TIMED && isDecided(after) && !isDecided(before)) return RoundHaptic.REJECT
    return null
}

/** The 90 commit line of one drag: true once for each crossing; moving back under it re-arms it silently. */
class CommitLine(private val distance: Double = SWIPE.commitPx) {
    private var beyond = false

    fun crossed(dx: Double): Boolean {
        val now = abs(dx) >= distance
        val fires = now && !beyond
        beyond = now
        return fires
    }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundKeys.kt`:

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Phase

/** The hardware keys the round acts on (spec section 2). */
enum class RoundKey { LEFT, RIGHT, ENTER, ESCAPE }

sealed interface RoundKeyAction {
    data class Answer(val value: Boolean) : RoundKeyAction
    data object Next : RoundKeyAction
    data object Leave : RoundKeyAction
    /** A repeat of a held key: consumed, nothing happens. */
    data object Swallow : RoundKeyAction
}

/** What a key-down does on the round, or null when the round leaves it alone (PlayScreen.tsx:605-650). */
fun roundKeyAction(key: RoundKey, repeat: Boolean, modified: Boolean, sheetOpen: Boolean, phase: Phase, awaitsNext: Boolean): RoundKeyAction? {
    if (repeat) return RoundKeyAction.Swallow
    if (modified || sheetOpen) return null
    return when (key) {
        RoundKey.ESCAPE -> RoundKeyAction.Leave
        RoundKey.LEFT -> if (phase == Phase.QUESTION) RoundKeyAction.Answer(false) else null
        RoundKey.RIGHT -> if (phase == Phase.QUESTION) RoundKeyAction.Answer(true) else null
        RoundKey.ENTER -> if (awaitsNext) RoundKeyAction.Next else null
    }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/FieldColumns.kt`:

```kotlin
package com.eienmosu.truthy.round

/** The fr of the Class, Card and Gate columns (BoardingPass.tsx FIELD_COLUMNS), in tenths so the arithmetic stays exact. */
private const val FIRST_FR_TENTHS = 11
private const val OTHER_FR_TENTHS = 10

/**
 * The widths of the field grid's columns for the given one-line content widths: minmax(max-content, fr), so a
 * column never splits its value while the values fit; when they cannot all fit on one line (a large font scale)
 * the columns share the width by fr and the values wrap, so nothing clips. Integer pixels; the last flexible
 * column takes the rounding remainder.
 */
internal fun fieldColumnWidths(contents: List<Int>, available: Int): List<Int> {
    val n = contents.size
    if (n == 0) return emptyList()
    val fr = List(n) { if (it == 0) FIRST_FR_TENTHS else OTHER_FR_TENTHS }
    val flexible = BooleanArray(n) { true }
    fun free(): Int = available - (0 until n).filter { !flexible[it] }.sumOf { contents[it] }
    fun total(): Int = (0 until n).filter { flexible[it] }.sumOf { fr[it] }
    if (contents.sum() <= available) {
        while (flexible.any { it }) {
            val free = free()
            val total = total()
            var changed = false
            for (i in 0 until n) {
                if (flexible[i] && free.toLong() * fr[i] < contents[i].toLong() * total) {
                    flexible[i] = false
                    changed = true
                }
            }
            if (!changed) break
        }
    }
    val free = free()
    val total = total()
    val widths = IntArray(n) { if (flexible[it]) (free.toLong() * fr[it] / total).toInt() else contents[it] }
    val last = (0 until n).lastOrNull { flexible[it] }
    if (last != null) widths[last] += available - widths.sum()
    return widths.toList()
}
```

- [ ] **Step 8: Write the link label, Custom Tabs and the motion helpers.**

First add the two libraries the round's main code needs, which task 1 put in the catalog but no task has added to the app yet: `androidx.browser` for the Custom Tabs of `SourceLink.kt`, and `lifecycle-runtime-compose` for `collectAsStateWithLifecycle` in `RoundRoute.kt` (step 19). In `android/Truthy/app/build.gradle.kts`, add inside `dependencies { }`, next to the other `implementation` lines (skip a line that is already there):

```kotlin
    implementation(libs.androidx.browser)
    implementation(libs.androidx.lifecycle.runtime.compose)
```

```bash
cd android/Truthy
./gradlew :app:dependencies --configuration debugRuntimeClasspath | grep -E 'androidx.browser:browser:1.10.0|lifecycle-runtime-compose'
```

Expected: lines naming `androidx.browser:browser:1.10.0` and `androidx.lifecycle:lifecycle-runtime-compose`. The build file is committed with step 10.

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/SourceLink.kt`:

```kotlin
package com.eienmosu.truthy.round

import android.content.ActivityNotFoundException
import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import com.eienmosu.truthy.design.LocalResolvedTheme
import com.eienmosu.truthy.design.TruthyColors

/** The source link's spoken label (reference 4.5, decided in spec 5.6). */
fun sourceLinkLabel(title: String): String = "$title (opens in browser)"

/** A Custom Tab in the app's resolved theme, not the system's (spec 5.6). */
fun sourceTabIntent(colors: TruthyColors, dark: Boolean): CustomTabsIntent {
    val bars = CustomTabColorSchemeParams.Builder()
        .setToolbarColor(colors.surface.toArgb())
        .setNavigationBarColor(colors.surface.toArgb())
        .build()
    return CustomTabsIntent.Builder()
        .setColorScheme(if (dark) CustomTabsIntent.COLOR_SCHEME_DARK else CustomTabsIntent.COLOR_SCHEME_LIGHT)
        .setDefaultColorSchemeParams(bars)
        .setShowTitle(true)
        .build()
}

/** Opens a card's source in the in-app browser. A device without any browser does nothing. */
fun openSource(context: Context, url: String, colors: TruthyColors, dark: Boolean) {
    try {
        sourceTabIntent(colors, dark).launchUrl(context, Uri.parse(url))
    } catch (missing: ActivityNotFoundException) {
        return
    }
}

@Composable
fun rememberSourceOpener(): (String) -> Unit {
    val context = LocalContext.current
    val theme = LocalResolvedTheme.current
    return remember(context, theme) { { url: String -> openSource(context, url, theme.colors, theme.isDark) } }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundMotion.kt`:

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.TweenSpec
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.ui.unit.dp

/**
 * Values the web writes in its component code rather than in tokens.json (reference 5.4 and 5.7). Every other
 * size, duration and curve of the round comes from Tokens.
 */
internal object RoundGeometry {
    // globals.css "short" (under 568 tall, 8 and 12) is Tokens.Native.shortScreenBelow, shortSafeTop and shortSafeBottom.
    const val SHORT_LEGS_HEIGHT = 600      // BoardingPass.tsx:93, max-height 600, inclusive
    val LEG_ARROW_COLUMN = 40.dp           // BoardingPass.tsx:122
    val FIELD_BOTTOM = 7.dp                // BoardingPass.tsx:141
    val CLOUD_WIDTH = 22.dp                // carrierCloud, 22 by 16
    val CLOUD_HEIGHT = 16.dp
    val STUB_TOP = 22.dp                   // BoardingPass.tsx:384
    val HINT_ROW = 32.dp                   // min-h-8
    val STUB_STAMP_CENTRE = 96.dp          // BoardingPass.tsx:404
    val INTENT_STAMP_TOP = 64.dp           // BoardingPass.tsx:331
    const val INTENT_STAMP_TURN = 7f
    val CHECK_ICON = 18.dp
    val CROSS_ICON = 16.dp
    val BOOK_ICON = 18.dp
    const val STUB_TURN = 2f               // degrees per unit of intent, about (20%, 0)
    const val STUB_PIVOT_X = 0.2f
    val TEAR_X = 40.dp                     // BoardingPass.tsx:302-315
    val TEAR_Y = 360.dp
    const val TEAR_TURN = 18f
    val STUB_RISE = 12.dp
    val ROW_RISE = 12.dp                   // PlayScreen.tsx:816-847
    val DEAL_RISE = 14.dp                  // PlayScreen.tsx:148-157
    const val LEAVE_FRACTION = 1.2f
    const val LEAVE_TURN = 8f
    const val JOLT_DP = 2f                 // BoardingPass.tsx:65-68
    const val JOLT_PEAK = 0.4f
    const val JOLT_DELAY_BEAT = 120
    const val JOLT_DELAY_TIME_UP = 240
    val SLIP_VERDICT_ROW = 60.dp
    const val CODE_SCALE = 0.92f           // components/CardText.tsx
    const val SNAP_DAMPING = 0.6f          // reference 5.7, native springs: snap 360
    const val SNAP_STIFFNESS = 360f
    val PLACEHOLDER_BODY = 336.dp          // BoardingPassPlaceholder
    val SPOKEN_NODE = 1.dp                 // the invisible heading and live regions
}

// The fades the web keeps under reduced motion run inside withContext(FullSpeed) (task 12), and reduced motion is
// task 10's LocalReducedMotion, provided at the app root: this file adds no second implementation of either.

internal fun <T> tweenOf(durationMs: Int, easing: Easing, delayMs: Int = 0): TweenSpec<T> =
    tween(durationMillis = durationMs, delayMillis = delayMs, easing = easing)

/** The card's snap back, seeded with the release velocity by the caller. */
internal fun snapSpring(): SpringSpec<Float> =
    spring(dampingRatio = RoundGeometry.SNAP_DAMPING, stiffness = RoundGeometry.SNAP_STIFFNESS)
```

- [ ] **Step 9: Run the JVM tests.**

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.round.*'
```

Expected: `BUILD SUCCESSFUL`; the XML results in `app/build/test-results/testDebugUnitTest/` report `RoundViewTest` 15, `RoundFeedbackTest` 7, `RoundKeysTest` 6, `FieldColumnsTest` 4, `SourceLinkLabelTest` 1 and `KeepingFadesTest` 1 tests, 34 in all, with `failures="0" errors="0"`.

- [ ] **Step 10: Commit.**

```bash
git add android/Truthy/app/build.gradle.kts android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundFeedback.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundKeys.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/FieldColumns.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/SourceLink.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundMotion.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/RoundFeedbackTest.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/RoundKeysTest.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/FieldColumnsTest.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/SourceLinkLabelTest.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/KeepingFadesTest.kt
git commit -m "feat: add the round's haptic, key, field column, link and motion rules on Android"
```

- [ ] **Step 11: Add Espresso-Intents for the link test.**

In `android/Truthy/gradle/libs.versions.toml`, add under `[versions]`:

```toml
espressoIntents = "3.7.0"
```

and under `[libraries]`:

```toml
androidx-test-espresso-intents = { module = "androidx.test.espresso:espresso-intents", version.ref = "espressoIntents" }
```

If the catalog's `espresso-core` uses a later version than 3.7.0, use that version here instead, so both Espresso artifacts match. In `android/Truthy/app/build.gradle.kts`, add inside `dependencies { }` next to the other `androidTestImplementation` lines:

```kotlin
    androidTestImplementation(libs.androidx.test.espresso.intents)
```

Run:

```bash
cd android/Truthy
./gradlew :app:dependencies --configuration debugAndroidTestRuntimeClasspath | grep espresso-intents
```

Expected: one or more lines naming `androidx.test.espresso:espresso-intents:3.7.0` (or the matched version).

- [ ] **Step 12: Write the device tests (they fail to compile: no round screen yet).**

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/RoundTestHost.kt`:

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.resolvedTheme
import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.StartArgs
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.modeInfo
import com.eienmosu.truthy.engine.reduce
import com.eienmosu.truthy.engine.startRound
import kotlinx.serialization.json.Json

internal object RoundTestData {
    /** 108 UTF-16 units, inside the 120 the schema allows. */
    const val LONG_STATEMENT = "A statement long enough to wrap over many lines of the ticket, so that the ticket scrolls on a short screen."
    /** 201 UTF-16 units, inside the 240 the schema allows. */
    const val LONG_EXPLANATION = "An explanation long enough to fill the answer slip with several lines of body text, so that the slip runs on below the action row " +
        "on a short screen and the ticket has to scroll to show the source link."

    fun card(n: Int, answer: Boolean, statement: String = "Statement $n", explanation: String = "Because $n."): Card = Json.decodeFromString(
        Card.serializer(),
        """{"id":"test-c$n","section":"SEC","text":{"en":{"statement":"$statement","explanation":"$explanation"}},""" +
            """"answer":$answer,"source":{"title":"Docs $n","url":"https://example.com/docs/$n"},"difficulty":1,""" +
            """"appliesTo":"","conflictGroups":[]}""",
    )

    fun pool(size: Int = 10, statement: (Int) -> String = { "Statement $it" }, explanation: (Int) -> String = { "Because $it." }): List<Card> =
        (1..size).map { card(it, answer = it % 2 == 0, statement = statement(it), explanation = explanation(it)) }

    fun start(mode: Mode, pool: List<Card> = pool()): RoundState =
        startRound(StartArgs(mode, Route("test", "SEC"), pool, emptyMap(), 7.0))

    fun ticket(mode: Mode, best: Int? = null): TicketInfo =
        TicketInfo("TST", "Test deck", "SEC", "Section", modeInfo(mode).name, best)
}

/** Plays the round with the engine directly, recording what the screen asked for. The coordinator's guards are task 11's tests. */
internal class RoundTestState(start: RoundState, val ticket: TicketInfo) {
    var round by mutableStateOf(start)
    var sheetOpen by mutableStateOf(false)
    var wallClock = 10_000.0
    val answers = mutableListOf<Boolean>()
    val haptics = mutableListOf<RoundHaptic>()
    val links = mutableListOf<String>()
    var nexts = 0
    var leaveRequests = 0

    fun answer(value: Boolean) {
        answers.add(value)
        round = reduce(round, RoundEvent.Answer(value, wallClock))
    }

    fun next() {
        nexts += 1
        round = reduce(round, RoundEvent.Next)
    }

    @Composable
    fun Content(modifier: Modifier = Modifier, cardShownAt: Double = SETTLED, reduced: Boolean = false) {
        TruthyTheme(resolvedTheme(Theme.LIGHT)) {
            RoundScreen(
                round = round,
                ticket = ticket,
                cardShownAt = { cardShownAt },
                onAnswer = { answer(it) },
                onNext = { next() },
                onRequestLeave = { leaveRequests += 1 },
                modifier = modifier,
                sheetOpen = sheetOpen,
                reducedMotion = reduced,
                haptics = { haptics.add(it) },
                openLink = { links.add(it) },
            )
        }
    }

    companion object {
        /** Long before any test event: the 250 ms settle has passed whatever clock the test injects with. */
        const val SETTLED = -1.0e12
    }
}
```

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/SwipeGestureTest.kt` (Review Focus 5 and feel items N3, N4 and N6):

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipe
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.currentCard
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SwipeGestureTest {
    @get:Rule
    val rule = createComposeRule()

    private fun px(dp: Float): Float = with(rule.density) { dp.dp.toPx() }

    private fun offset(): Float = rule.onNodeWithTag("swipe-card").fetchSemanticsNode().config[CardDragOffset]

    private fun scrolled(): Float =
        rule.onNodeWithTag("ticket-scroller").fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange].value()

    private fun scrollRoom(): Float =
        rule.onNodeWithTag("ticket-scroller").fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange].maxValue()

    private fun classic(pool: List<Card> = RoundTestData.pool()) =
        RoundTestState(RoundTestData.start(Mode.CLASSIC, pool), RoundTestData.ticket(Mode.CLASSIC))

    private fun moveAndCheck(dxDp: Float, dyDp: Float, times: Int, check: (step: Int) -> Unit) {
        repeat(times) { step ->
            rule.onNodeWithTag("ticket-scroller").performTouchInput { moveBy(Offset(px(dxDp), px(dyDp))) }
            rule.waitForIdle()
            check(step + 1)
        }
    }

    @Test
    fun theCardFollowsTheFingerOneToOneAndACancelAnswersNothing() {
        val host = classic()
        rule.setContent { host.Content() }
        rule.onNodeWithTag("ticket-scroller").performTouchInput { down(center) }
        moveAndCheck(12f, 0f, 10) { step -> assertEquals(12f * step, offset(), 1f) }
        rule.onNodeWithTag("ticket-scroller").performTouchInput { cancel() }
        rule.waitForIdle()
        assertTrue(host.answers.isEmpty())
        assertEquals(0f, offset(), 0.5f)
    }

    @Test
    fun aSwipeRightAnswersTrueWithOneThresholdHapticAndTheCardSpringsBack() {
        val host = classic()
        val right = currentCard(host.round)!!.answer
        rule.setContent { host.Content() }
        rule.onNodeWithTag("ticket-scroller").performTouchInput {
            swipe(start = center, end = center + Offset(px(150f), 0f), durationMillis = 300)
        }
        rule.waitForIdle()
        assertEquals(listOf(true), host.answers)
        assertEquals(listOf(RoundHaptic.THRESHOLD, if (right) RoundHaptic.CONFIRM else RoundHaptic.REJECT), host.haptics)
        assertEquals(0f, offset(), 0.5f)
    }

    @Test
    fun aDragThatStartsInsideThe24DpEdgeZoneNeverMovesTheCard() {
        val host = classic()
        rule.setContent { host.Content() }
        val card = rule.onNodeWithTag("swipe-card").fetchSemanticsNode().boundsInRoot
        assumeTrue("the card reaches into the edge zone only when the frame meets the window edge", card.left < px(22f))
        val y = rule.onNodeWithTag("ticket-scroller").fetchSemanticsNode().boundsInRoot.center.y
        rule.onRoot().performTouchInput { down(Offset(px(22f), y)) }
        repeat(10) {
            rule.onRoot().performTouchInput { moveBy(Offset(px(15f), 0f)) }
            rule.waitForIdle()
            assertEquals(0f, offset(), 0.01f)
        }
        rule.onRoot().performTouchInput { up() }
        rule.waitForIdle()
        assertTrue(host.answers.isEmpty())
        rule.onRoot().performTouchInput {
            down(Offset(px(30f), y))
            moveBy(Offset(px(40f), 0f))
        }
        rule.waitForIdle()
        assertTrue("a drag from 30 dp moves the card", offset() > 30f)
        rule.onRoot().performTouchInput { cancel() }
    }

    @Test
    fun aVerticalDiagonalOnALongStatementScrollsTheTicketAndNeverMovesTheCard() {
        val host = classic(RoundTestData.pool(statement = { RoundTestData.LONG_STATEMENT }))
        rule.setContent { Box(Modifier.width(412.dp).height(480.dp)) { host.Content() } }
        rule.waitForIdle()
        assertTrue("the ticket must be taller than the stage", scrollRoom() > 0f)
        val before = scrolled()
        rule.onNodeWithTag("ticket-scroller").performTouchInput { down(center) }
        moveAndCheck(3f, -12f, 10) { assertEquals(0f, offset(), 0.01f) }
        rule.onNodeWithTag("ticket-scroller").performTouchInput { up() }
        rule.waitForIdle()
        assertTrue("the ticket scrolled", scrolled() > before)
        assertTrue(host.answers.isEmpty())
    }

    @Test
    fun aHorizontalDiagonalOnALongStatementMovesTheCardAndNeverScrolls() {
        val host = classic(RoundTestData.pool(statement = { RoundTestData.LONG_STATEMENT }))
        rule.setContent { Box(Modifier.width(412.dp).height(480.dp)) { host.Content() } }
        rule.waitForIdle()
        val before = scrolled()
        rule.onNodeWithTag("ticket-scroller").performTouchInput { down(center) }
        moveAndCheck(10f, 3f, 10) { step ->
            assertEquals(before, scrolled(), 0.5f)
            assertEquals(10f * step, offset(), 1f)
        }
        rule.onNodeWithTag("ticket-scroller").performTouchInput { cancel() }
        rule.waitForIdle()
        assertTrue(host.answers.isEmpty())
    }

    @Test
    fun theThresholdHapticFiresOncePerCrossingOfTheCommitLine() {
        val host = classic()
        rule.setContent { host.Content() }
        rule.onNodeWithTag("ticket-scroller").performTouchInput {
            down(center)
            repeat(3) { moveBy(Offset(px(40f), 0f)) }
            repeat(2) { moveBy(Offset(px(-30f), 0f)) }
            moveBy(Offset(px(40f), 0f))
            repeat(2) { moveBy(Offset(px(10f), 0f)) }
            cancel()
        }
        rule.waitForIdle()
        assertEquals(2, host.haptics.count { it == RoundHaptic.THRESHOLD })
        assertTrue(host.answers.isEmpty())
    }

    @Test
    fun aSecondFingerCancelsTheDrag() {
        val host = classic()
        rule.setContent { host.Content() }
        rule.onNodeWithTag("ticket-scroller").performTouchInput {
            down(0, center)
            moveBy(0, Offset(px(60f), 0f))
            down(1, center + Offset(0f, px(40f)))
        }
        rule.waitForIdle()
        assertEquals(0f, offset(), 0.5f)
        rule.onNodeWithTag("ticket-scroller").performTouchInput {
            moveBy(0, Offset(px(80f), 0f))
            up(1)
            up(0)
        }
        rule.waitForIdle()
        assertTrue(host.answers.isEmpty())
    }

    @Test
    fun beforeTheSettleTimeADragIsIgnored() {
        val host = classic()
        rule.setContent { host.Content(cardShownAt = 1.0e15) }
        rule.onNodeWithTag("ticket-scroller").performTouchInput {
            swipe(start = center, end = center + Offset(px(150f), 0f), durationMillis = 300)
        }
        rule.waitForIdle()
        assertTrue(host.answers.isEmpty())
        assertTrue(host.haptics.isEmpty())
    }
}
```

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/RoundScreenTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.reduce
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class RoundScreenTest {
    @get:Rule
    val rule = createComposeRule()

    private fun classic() = RoundTestState(RoundTestData.start(Mode.CLASSIC), RoundTestData.ticket(Mode.CLASSIC))

    private fun verdict(answer: Boolean, correct: Boolean) =
        "${if (correct) "Correct" else "Not quite"}. The answer is ${if (answer) "True" else "False"}."

    @Test
    fun theFirstCardShowsTheTicketTheHeadingAndTheStatement() {
        val host = classic()
        val card = currentCard(host.round)!!
        rule.setContent { host.Content() }
        rule.onNodeWithText("01 / 10").assertExists()
        rule.onNodeWithText("Classic").assertExists()
        rule.onNodeWithText(card.text.en.statement).assertExists()
        rule.onNodeWithContentDescription("Test deck, Section: Classic round").assertExists()
        rule.onNodeWithContentDescription("Card 1 of 10.").assertExists()
        rule.onNodeWithContentDescription("Leave round").assertExists()
        rule.onNodeWithText("swipe to board").assertDoesNotExist()
    }

    @Test
    fun theTruePillAnswersAndTheSlipShowsTheVerdictTheExplanationAndTheSource() {
        val host = classic()
        val card = currentCard(host.round)!!
        rule.setContent { host.Content() }
        rule.onNodeWithTag("answer-true").performClick()
        rule.waitForIdle()
        assertEquals(listOf(true), host.answers)
        rule.onNodeWithTag("status").assertContentDescriptionEquals(verdict(card.answer, correct = card.answer))
        rule.onNodeWithText(card.text.en.explanation).assertExists()
        rule.onNodeWithContentDescription("${card.source.title} (opens in browser)").performScrollTo().performClick()
        assertEquals(listOf(card.source.url), host.links)
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithTag("next").assertExists()
    }

    @Test
    fun nextCardDealsTheSecondCard() {
        val host = classic()
        rule.setContent { host.Content() }
        rule.onNodeWithTag("answer-false").performClick()
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithTag("next").performClick()
        rule.waitForIdle()
        assertEquals(1, host.nexts)
        rule.onNodeWithText("02 / 10").assertExists()
    }

    @Test
    fun theArrowsAnswerEnterGoesOnAndEscapeAsksToLeave() {
        val host = classic()
        rule.setContent { host.Content() }
        rule.onNodeWithTag("round-screen").requestFocus()
        rule.onNodeWithTag("round-screen").performKeyInput { pressKey(Key.DirectionRight) }
        rule.waitForIdle()
        assertEquals(listOf(true), host.answers)
        rule.onNodeWithTag("round-screen").performKeyInput { pressKey(Key.Enter) }
        rule.waitForIdle()
        assertEquals(1, host.nexts)
        rule.onNodeWithTag("round-screen").requestFocus()
        rule.onNodeWithTag("round-screen").performKeyInput { pressKey(Key.DirectionLeft) }
        rule.waitForIdle()
        assertEquals(listOf(true, false), host.answers)
        rule.onNodeWithTag("round-screen").performKeyInput { pressKey(Key.Escape) }
        rule.waitForIdle()
        assertEquals(1, host.leaveRequests)
    }

    @Test
    fun timedStampsTheStubIgnoresTheDimmedPillsAndAnnouncesTheNextCard() {
        val host = RoundTestState(RoundTestData.start(Mode.TIMED), RoundTestData.ticket(Mode.TIMED))
        val card = currentCard(host.round)!!
        rule.setContent { host.Content() }
        rule.onNodeWithTag("answer-true").performClick()
        rule.waitForIdle()
        rule.onNodeWithTag("status").assertContentDescriptionEquals(if (card.answer) "Correct." else "Not quite.")
        rule.onNodeWithTag("answer-false").performClick()
        rule.waitForIdle()
        assertEquals(1, host.answers.size)
        rule.onNodeWithText("The answer is").assertDoesNotExist()
        rule.runOnIdle { host.round = reduce(host.round, RoundEvent.Tick(host.wallClock + 700.0)) }
        rule.waitForIdle()
        val second = currentCard(host.round)!!
        rule.onNodeWithTag("card-announcer").assertContentDescriptionEquals("Card 2. ${second.text.en.statement}")
        rule.onNodeWithText("02").assertExists()
    }

    @Test
    fun theLiveRegionsKeepTheirTextUnderTheSheetAndRelease150MsAfterItCloses() {
        val host = classic()
        val card = currentCard(host.round)!!
        rule.setContent { host.Content() }
        rule.onNodeWithTag("answer-true").performClick()
        rule.waitForIdle()
        val said = verdict(card.answer, correct = card.answer)
        rule.runOnIdle { host.sheetOpen = true }
        rule.waitForIdle()
        rule.runOnIdle { host.next() }
        rule.waitForIdle()
        rule.onNodeWithTag("status").assertContentDescriptionEquals(said)
        rule.mainClock.autoAdvance = false
        rule.runOnIdle { host.sheetOpen = false }
        rule.mainClock.advanceTimeBy(100)
        rule.onNodeWithTag("status").assertContentDescriptionEquals(said)
        rule.mainClock.advanceTimeBy(100)
        rule.onNodeWithTag("status").assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.ContentDescription))
    }

    @Test
    fun nothingClipsAtTwiceTheTextSize() {
        val pool = RoundTestData.pool(statement = { RoundTestData.LONG_STATEMENT }, explanation = { RoundTestData.LONG_EXPLANATION })
        val host = RoundTestState(RoundTestData.start(Mode.CLASSIC, pool), RoundTestData.ticket(Mode.CLASSIC))
        host.answer(currentCard(host.round)!!.answer)
        rule.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 2f)) { host.Content() }
        }
        rule.mainClock.advanceTimeBy(2_000)
        rule.waitForIdle()
        val texts = rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.GetTextLayoutResult)).fetchSemanticsNodes()
        assertTrue(texts.isNotEmpty())
        for (node in texts) {
            val results = mutableListOf<TextLayoutResult>()
            node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(results)
            val layout = results.single()
            assertFalse("clipped: ${layout.layoutInput.text}", (layout.didOverflowHeight || (0 until layout.lineCount).any { layout.getLineRight(it) - layout.getLineLeft(it) > layout.size.width + 1f }))
        }
    }
}
```

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/SourceLinkIntentTest.kt` (feel item N11):

```kotlin
package com.eienmosu.truthy.round

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.espresso.intent.Intents
import androidx.test.espresso.intent.matcher.IntentMatchers.anyIntent
import androidx.test.espresso.intent.matcher.IntentMatchers.hasAction
import androidx.test.espresso.intent.matcher.IntentMatchers.hasData
import androidx.test.espresso.intent.matcher.IntentMatchers.hasExtra
import androidx.test.espresso.intent.matcher.IntentMatchers.hasExtraWithKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.resolvedTheme
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.reduce
import org.hamcrest.CoreMatchers.allOf
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SourceLinkIntentTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Before
    fun stubTheBrowser() {
        Intents.init()
        Intents.intending(anyIntent()).respondWith(Instrumentation.ActivityResult(Activity.RESULT_OK, null))
    }

    @After
    fun releaseIntents() {
        Intents.release()
    }

    @Test
    fun aSourceOpensAsACustomTabInTheAppsNightColours() {
        val night = resolvedTheme(Theme.DARK)
        rule.runOnUiThread { openSource(rule.activity, URL, night.colors, night.isDark) }
        Intents.intended(
            allOf(
                hasAction(Intent.ACTION_VIEW),
                hasData(Uri.parse(URL)),
                hasExtraWithKey(CustomTabsIntent.EXTRA_SESSION),
                hasExtra(CustomTabsIntent.EXTRA_COLOR_SCHEME, CustomTabsIntent.COLOR_SCHEME_DARK),
                hasExtra(CustomTabsIntent.EXTRA_TOOLBAR_COLOR, night.colors.surface.toArgb()),
            ),
        )
    }

    @Test
    fun theSlipsSourceLinkOpensTheInAppBrowser() {
        val start = RoundTestData.start(Mode.CLASSIC)
        val card = currentCard(start)!!
        val answered = reduce(start, RoundEvent.Answer(card.answer, 10_000.0))
        rule.setContent {
            TruthyTheme(resolvedTheme(Theme.LIGHT)) {
                RoundScreen(
                    round = answered,
                    ticket = RoundTestData.ticket(Mode.CLASSIC),
                    cardShownAt = { RoundTestState.SETTLED },
                    onAnswer = {},
                    onNext = {},
                    onRequestLeave = {},
                    reducedMotion = false,
                    haptics = {},
                )
            }
        }
        rule.onNodeWithContentDescription("${card.source.title} (opens in browser)").performScrollTo().performClick()
        Intents.intended(allOf(hasAction(Intent.ACTION_VIEW), hasData(Uri.parse(card.source.url)), hasExtraWithKey(CustomTabsIntent.EXTRA_SESSION)))
    }

    private companion object {
        const val URL = "https://example.com/docs/1"
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:compileDebugAndroidTestKotlin
```

Expected: `BUILD FAILED` with `Unresolved reference 'RoundScreen'` and `Unresolved reference 'CardDragOffset'`.

- [ ] **Step 13: Write the card text spans and the four header indicators.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/CardTextSpans.kt`:

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.eienmosu.truthy.design.OverpassMono
import com.eienmosu.truthy.engine.textParts

private val CODE = SpanStyle(fontFamily = OverpassMono, fontSize = RoundGeometry.CODE_SCALE.em, letterSpacing = 0.sp)

/** A statement or an explanation: code parts in the mono face at 0.92 em, backticks stripped (components/CardText.tsx). */
fun cardText(text: String): AnnotatedString = buildAnnotatedString {
    for (part in textParts(text)) {
        if (part.code) withStyle(CODE) { append(part.text) } else append(part.text)
    }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundHeaders.kt` (the drawings of `FlightPath.tsx`, `StreakPath.tsx`, `LivesPath.tsx` and `TimedPath.tsx` in their 276 by 34 viewBox; the numbers inside `HeaderGeometry` are the SVG's own geometry, like icon path data):

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import com.eienmosu.truthy.design.IconPaths
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyColors
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.engine.LIVES
import com.eienmosu.truthy.engine.Point
import com.eienmosu.truthy.engine.TIMED
import com.eienmosu.truthy.engine.WaypointState
import com.eienmosu.truthy.engine.clockText
import com.eienmosu.truthy.engine.flightPathLabel
import com.eienmosu.truthy.engine.flownPath
import com.eienmosu.truthy.engine.headingAt
import com.eienmosu.truthy.engine.livesLabel
import com.eienmosu.truthy.engine.pointAt
import com.eienmosu.truthy.engine.streakLabel
import com.eienmosu.truthy.engine.streakLayout
import com.eienmosu.truthy.engine.timedLabel
import com.eienmosu.truthy.engine.trailLayout
import com.eienmosu.truthy.engine.waypointStates
import com.eienmosu.truthy.engine.waypointT
import kotlin.math.ceil
import kotlin.math.floor

private object HeaderGeometry {
    const val VIEW_WIDTH = 276f
    const val VIEW_HEIGHT = 34f
    const val ROUTE_STROKE = 1.6f
    const val FLOWN_STROKE = 2.4f
    val ROUTE_DASH = floatArrayOf(2f, 5f)
    const val MARK_RADIUS = 7f
    const val MARK_SQUARE = 13f
    const val MARK_CORNER = 2f
    const val MARK_STROKE = 1.8f
    const val FUTURE_RADIUS = 4f
    const val LAST_RADIUS = 5f
    const val RING_STROKE = 1.4f
    const val RING_GAP = 3.5
    const val REACHED_RING = 10.5f
    const val PLANE_RADIUS = 12f
    const val PLANE_STROKE = 2f
    const val TARGET_RING = 7f
    const val TARGET_CENTRE = 3f
    const val MIN_FUTURE_RADIUS = 2.0
    const val MAX_FUTURE_RADIUS = 4.0
    const val MIN_DOT_RADIUS = 1.2
    val HEART_X = floatArrayOf(11f, 39f, 67f)
    const val HEART_Y = 6f
    const val HEART_STROKE = 1.6f
    const val TRAIL_Y = 17f
    const val TRAIL_STROKE = 1.2f
    const val TRAIL_CORNER = 1.5f
    const val MIN_TRAIL_DOT = 0.6
    const val LIVES_PLANE_X = 238f
    const val TRAIL_END = 274f
    const val CROSS_REACH = 0.22
    const val SHORT_TRAIL = 14
    const val CROSS_STROKE = 1.4f
    const val CROSS_STROKE_LONG = 1.3f
    const val CLOCK_DOT = 5f
    const val QUARTER_RADIUS = 3.5f
    val QUARTERS = doubleArrayOf(0.25, 0.5, 0.75)
    const val MS_PER_SECOND = 1_000.0
}

private class Ink(val ink: Color, val muted: Color, val paper: Color, val accent: Color, val onAccent: Color, val correct: Color, val wrong: Color)

private fun svg(d: String): Path = PathParser().parsePathString(d).toPath()

private val ROUTE: Path by lazy { svg(flownPath(1.0)) }
private val PLANE: Path by lazy { svg(IconPaths.PLANE_ARROW) }
private val HEART: Path by lazy { svg(IconPaths.HEART) }
private val HEART_SLASH: Path by lazy { svg(IconPaths.HEART_SLASH) }
private val TICK: Path by lazy { svg("M-3 0l2 2 4-4") }
private val MARK_X: Path by lazy { svg("M-3-3l6 6m0-6l-6 6") }

private val BOLD = SpanStyle(fontWeight = FontWeight.SemiBold)

/** JavaScript Math.round(x * 10) / 10. */
private fun round1(value: Double): Double = floor(value * 10.0 + 0.5) / 10.0

private fun Point.offset(): Offset = Offset(x.toFloat(), y.toFloat())

private fun label(vararg parts: Pair<String, Boolean>): AnnotatedString = buildAnnotatedString {
    for ((text, bold) in parts) if (bold) withStyle(BOLD) { append(text) } else append(text)
}

/** One image with a full-sentence label, the drawing and the label row (FlightPath.tsx PathFrame). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun InkFrame(label: String, progress: AnnotatedString, tally: AnnotatedString?, modifier: Modifier, draw: DrawScope.(Ink) -> Unit) {
    val colors = TruthyTheme.colors
    val ink = Ink(colors.ink, colors.inkMuted, colors.surfaceRaised, colors.accent, colors.onAccent, colors.correct, colors.wrong)
    Column(modifier.clearAndSetSemantics { contentDescription = label; role = Role.Image }) {
        Canvas(Modifier.fillMaxWidth().height(Tokens.Size.flightPathHeight)) {
            val s = minOf(size.width / HeaderGeometry.VIEW_WIDTH, size.height / HeaderGeometry.VIEW_HEIGHT)
            withTransform({
                translate((size.width - HeaderGeometry.VIEW_WIDTH * s) / 2f, (size.height - HeaderGeometry.VIEW_HEIGHT * s) / 2f)
                scale(s, s, pivot = Offset.Zero)
            }) { this.draw(ink) }
        }
        FlowRow(Modifier.fillMaxWidth().padding(top = Tokens.Space.s2), horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8)) {
            Text(progress, style = TruthyType.routeLabel, color = colors.ink)
            if (tally != null) Text(tally, Modifier.weight(1f), style = TruthyType.routeLabel, color = colors.ink, textAlign = TextAlign.End)
        }
    }
}

private fun inkOf(colors: TruthyColors): Ink =
    Ink(colors.ink, colors.inkMuted, colors.surfaceRaised, colors.accent, colors.onAccent, colors.correct, colors.wrong)

/**
 * The header frame with a plain drawing, for task 14's completed route: one image labelled [label], the label row
 * hidden from screen readers; [draw] runs in the 276 by 34 drawing's units.
 */
@Composable
internal fun PathFrame(label: String, progress: AnnotatedString, tally: AnnotatedString?, modifier: Modifier = Modifier, draw: DrawScope.() -> Unit) {
    InkFrame(label, progress, tally, modifier) { _ -> draw() }
}

/** The dashed route and its flown part up to [flownTo], as the headers draw it (task 14 reuses it). */
internal fun DrawScope.drawRouteLine(flownTo: Double, colors: TruthyColors) = routeLine(flownTo, inkOf(colors))

/** A waypoint mark scaled by [scale], as the headers draw it (task 14 reuses it). */
internal fun DrawScope.drawMark(correct: Boolean, at: Point, scale: Double, fresh: Boolean, plain: Boolean, colors: TruthyColors) =
    mark(correct, at, inkOf(colors), scale.toFloat(), fresh, plain)

private fun DrawScope.routeLine(flownTo: Double, c: Ink) {
    drawPath(ROUTE, c.ink, style = Stroke(width = HeaderGeometry.ROUTE_STROKE, cap = StrokeCap.Round, pathEffect = PathEffect.dashPathEffect(HeaderGeometry.ROUTE_DASH)))
    if (flownTo > 0.0) drawPath(svg(flownPath(flownTo)), c.ink, style = Stroke(width = HeaderGeometry.FLOWN_STROKE, cap = StrokeCap.Round))
}

private fun DrawScope.plane(at: Point, heading: Double, alpha: Float, c: Ink) {
    if (alpha <= 0f) return
    withTransform({
        translate(at.x.toFloat(), at.y.toFloat())
        rotate(heading.toFloat(), pivot = Offset.Zero)
    }) {
        drawCircle(c.accent, radius = HeaderGeometry.PLANE_RADIUS, center = Offset.Zero, alpha = alpha)
        drawPath(PLANE, c.onAccent, alpha = alpha, style = Stroke(width = HeaderGeometry.PLANE_STROKE, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

/** A circle with a tick (right) or a square with an x (wrong); butt caps and miter joins, as on the web. */
private fun DrawScope.mark(correct: Boolean, at: Point, c: Ink, factor: Float = 1f, fresh: Boolean = false, plain: Boolean = false) {
    withTransform({
        translate(at.x.toFloat(), at.y.toFloat())
        scale(factor, factor, pivot = Offset.Zero)
    }) {
        if (correct) {
            drawCircle(if (fresh) c.correct else c.ink, radius = HeaderGeometry.MARK_RADIUS, center = Offset.Zero)
            if (!plain) drawPath(TICK, c.paper, style = Stroke(width = HeaderGeometry.MARK_STROKE))
        } else {
            val half = HeaderGeometry.MARK_SQUARE / 2f
            drawRoundRect(c.wrong, topLeft = Offset(-half, -half), size = Size(HeaderGeometry.MARK_SQUARE, HeaderGeometry.MARK_SQUARE), cornerRadius = CornerRadius(HeaderGeometry.MARK_CORNER))
            if (!plain) drawPath(MARK_X, c.paper, style = Stroke(width = HeaderGeometry.MARK_STROKE))
        }
    }
}

private fun DrawScope.openCircle(at: Point, radius: Float, c: Ink, fill: Color = c.paper) {
    drawCircle(fill, radius = radius, center = at.offset())
    drawCircle(c.ink, radius = radius, center = at.offset(), style = Stroke(width = HeaderGeometry.ROUTE_STROKE))
}

private fun DrawScope.ringAround(at: Point, radius: Float, c: Ink) {
    drawCircle(c.ink, radius = radius, center = at.offset(), style = Stroke(width = HeaderGeometry.RING_STROKE))
}

private fun partial(path: Path, portion: Float): Path {
    if (portion >= 1f) return path
    val measure = PathMeasure()
    measure.setPath(path, false)
    val out = Path()
    measure.getSegment(0f, measure.length * portion, out, true)
    return out
}

/** The plane fades over 220 ms once its card is answered (FlightPath.tsx Plane); at once with reduced motion. */
@Composable
private fun planeAlpha(hidden: Boolean, reduced: Boolean): Float {
    val alpha by animateFloatAsState(
        targetValue = if (hidden) 0f else 1f,
        animationSpec = if (reduced) snap() else tweenOf(Tokens.Duration.t2, Tokens.Curves.ease),
        label = "plane",
    )
    return alpha
}

@Composable
fun FlightPathHeader(total: Int, results: List<Boolean>, current: Int, answered: Boolean, reduced: Boolean, modifier: Modifier = Modifier) {
    val alpha = planeAlpha(hidden = answered, reduced = reduced)
    val correct = results.count { it }
    val states = waypointStates(total, results, current, answered)
    val t = waypointT(current, total)
    InkFrame(
        label = flightPathLabel(total, results, current),
        progress = label("Card " to false, "${current + 1}" to true, " of $total" to false),
        tally = label("$correct correct · ${results.size - correct} wrong" to false),
        modifier = modifier,
    ) { c ->
        routeLine(t, c)
        states.forEachIndexed { i, state ->
            val at = pointAt(waypointT(i, total))
            when (state) {
                WaypointState.CORRECT -> mark(true, at, c, fresh = i == current)
                WaypointState.WRONG -> mark(false, at, c)
                WaypointState.FUTURE -> openCircle(at, if (i == total - 1) HeaderGeometry.LAST_RADIUS else HeaderGeometry.FUTURE_RADIUS, c)
                WaypointState.CURRENT -> Unit
            }
        }
        plane(pointAt(t), headingAt(t), alpha, c)
    }
}

@Composable
fun StreakHeader(streak: Int, best: Int?, answered: Boolean?, reduced: Boolean, modifier: Modifier = Modifier) {
    val alpha = planeAlpha(hidden = answered != null, reduced = reduced)
    val ended = answered == false
    val done = if (answered == true) streak - 1 else streak
    val layout = streakLayout(done, best)
    val futureRadius = minOf(HeaderGeometry.MAX_FUTURE_RADIUS, round1(layout.dot * 2.0 / 3.0))
    InkFrame(
        label = streakLabel(streak, best, ended),
        progress = if (ended) label("Streak ended at " to false, "$streak" to true) else label("Streak " to false, "$streak" to true),
        tally = if (best != null && best >= 1) label((if (streak > best) "Previous best " else "Best ") to false, "$best" to true) else null,
        modifier = modifier,
    ) { c ->
        val here = pointAt(layout.t(done))
        val ring = layout.ring
        val ringAt = ring?.let { pointAt(layout.t(it)) }
        routeLine(layout.t(done), c)
        if (layout.dot > HeaderGeometry.MIN_DOT_RADIUS) {
            for (slot in 0 until done) mark(true, pointAt(layout.t(slot)), c, factor = (layout.dot / HeaderGeometry.MARK_RADIUS).toFloat(), plain = !layout.ticks)
        }
        if (ring != null && ringAt != null && ring < done) ringAround(ringAt, (layout.dot + HeaderGeometry.RING_GAP).toFloat(), c)
        if (futureRadius >= HeaderGeometry.MIN_FUTURE_RADIUS) {
            for (slot in layout.future) openCircle(pointAt(layout.t(slot)), futureRadius.toFloat(), c)
        }
        if (layout.target && ring != null && ringAt != null && ring > done) {
            openCircle(ringAt, HeaderGeometry.TARGET_RING, c)
            drawCircle(c.ink, radius = HeaderGeometry.TARGET_CENTRE, center = ringAt.offset())
        }
        plane(here, headingAt(layout.t(done)), alpha, c)
        if (answered != null) mark(answered, here, c, fresh = true)
        if (ring != null && answered == true && ring == done) ringAround(here, HeaderGeometry.REACHED_RING, c)
    }
}

@Composable
fun LivesHeader(results: List<Boolean>, answered: Boolean, reduced: Boolean, modifier: Modifier = Modifier) {
    val alpha = planeAlpha(hidden = answered, reduced = reduced)
    val left = maxOf(0, LIVES - results.count { !it })
    val last = results.lastOrNull()
    val striking = if (answered && last == false) left else -1
    val strike = remember(results.size, striking) { Animatable(if (striking >= 0 && !reduced) 0f else 1f) }
    LaunchedEffect(strike) {
        if (strike.value < 1f) strike.animateTo(1f, tweenOf(Tokens.Duration.strike, Tokens.Curves.ease, Tokens.Transitions.stamp.delayMs))
    }
    val drawn = strike.value
    val marks = if (answered) results.dropLast(1) else results
    val layout = trailLayout(marks.size)
    val crossReach = round1(layout.side * HeaderGeometry.CROSS_REACH)
    val crossStroke = if (marks.size <= HeaderGeometry.SHORT_TRAIL) HeaderGeometry.CROSS_STROKE else HeaderGeometry.CROSS_STROKE_LONG
    val trailY = HeaderGeometry.TRAIL_Y.toDouble()
    InkFrame(
        label = livesLabel(results),
        progress = if (left == 0) label("No" to true, " lives left" to false) else label("$left" to true, " of $LIVES lives left" to false),
        tally = label("${results.size}" to true, " answered" to false),
        modifier = modifier,
    ) { c ->
        HeaderGeometry.HEART_X.forEachIndexed { j, x ->
            withTransform({ translate(x, HeaderGeometry.HEART_Y) }) {
                if (j >= left) {
                    drawPath(HEART, c.muted, style = Stroke(width = HeaderGeometry.HEART_STROKE, join = StrokeJoin.Round))
                    val portion = if (j == striking) drawn else 1f
                    if (portion > 0f) drawPath(partial(HEART_SLASH, portion), c.muted, style = Stroke(width = HeaderGeometry.HEART_STROKE, cap = StrokeCap.Round))
                } else {
                    drawPath(HEART, c.ink)
                }
            }
        }
        if (marks.isNotEmpty()) {
            drawLine(c.ink, Offset(layout.x(0).toFloat(), HeaderGeometry.TRAIL_Y), Offset(HeaderGeometry.LIVES_PLANE_X, HeaderGeometry.TRAIL_Y), strokeWidth = HeaderGeometry.TRAIL_STROKE, cap = StrokeCap.Round)
        }
        drawLine(
            c.ink,
            Offset(HeaderGeometry.LIVES_PLANE_X, HeaderGeometry.TRAIL_Y),
            Offset(HeaderGeometry.TRAIL_END, HeaderGeometry.TRAIL_Y),
            strokeWidth = HeaderGeometry.ROUTE_STROKE,
            cap = StrokeCap.Round,
            pathEffect = PathEffect.dashPathEffect(HeaderGeometry.ROUTE_DASH),
        )
        marks.forEachIndexed { i, correct ->
            if (correct && layout.r > HeaderGeometry.MIN_TRAIL_DOT) drawCircle(c.ink, radius = layout.r.toFloat(), center = Offset(layout.x(i).toFloat(), HeaderGeometry.TRAIL_Y))
        }
        marks.forEachIndexed { i, correct ->
            if (correct) return@forEachIndexed
            val x = layout.x(i)
            drawRoundRect(
                c.wrong,
                topLeft = Offset(round1(x - layout.side / 2).toFloat(), round1(trailY - layout.side / 2).toFloat()),
                size = Size(layout.side.toFloat(), layout.side.toFloat()),
                cornerRadius = CornerRadius(HeaderGeometry.TRAIL_CORNER),
            )
            if (layout.cross) {
                val reach = round1(crossReach * 2).toFloat()
                val cross = Path().apply {
                    moveTo(round1(x - crossReach).toFloat(), (trailY - crossReach).toFloat())
                    relativeLineTo(reach, reach)
                    relativeMoveTo(0f, -reach)
                    relativeLineTo(-reach, reach)
                }
                drawPath(cross, c.paper, style = Stroke(width = crossStroke))
            }
        }
        val here = Point(HeaderGeometry.LIVES_PLANE_X.toDouble(), trailY)
        plane(here, 0.0, alpha, c)
        if (answered && last != null) mark(last, here, c, fresh = true)
    }
}

@Composable
fun TimedHeader(remainingMs: Double, correct: Int, wrong: Int, reduced: Boolean, modifier: Modifier = Modifier) {
    val seconds = ceil(maxOf(0.0, remainingMs) / HeaderGeometry.MS_PER_SECOND)
    val shownMs = if (reduced) seconds * HeaderGeometry.MS_PER_SECOND else remainingMs
    val t = (1.0 - shownMs / TIMED.roundMs).coerceIn(0.0, 1.0)
    val clock = TruthyType.timedClock.toSpanStyle()
    InkFrame(
        label = timedLabel(remainingMs, correct, wrong),
        progress = buildAnnotatedString {
            withStyle(clock) { append(clockText(remainingMs)) }
            append(" left")
        },
        tally = label("$correct correct · $wrong wrong" to false),
        modifier = modifier,
    ) { c ->
        routeLine(t, c)
        drawCircle(c.ink, radius = HeaderGeometry.CLOCK_DOT, center = pointAt(0.0).offset())
        for (quarter in HeaderGeometry.QUARTERS) openCircle(pointAt(quarter), HeaderGeometry.QUARTER_RADIUS, c, fill = if (t >= quarter) c.ink else c.paper)
        openCircle(pointAt(1.0), HeaderGeometry.CLOCK_DOT, c)
        plane(pointAt(t), headingAt(t), 1f, c)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL` (warnings allowed, no errors).

- [ ] **Step 14: Write the ticket shell and its parts.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/BoardingPass.kt` (`components/BoardingPass.tsx`: the shell that task 14's result screen reuses):

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.keyframes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.TicketLowerShape
import com.eienmosu.truthy.design.TicketMainShape
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.drawTicketPerforation
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.ui.TestTags

/** A leg of the pass: the three-letter code over its name. */
data class PassLeg(val code: String, val name: String)

/** A cell of the field grid. `spoken` replaces the value for screen readers (Gate: "False left, true right"). */
data class PassField(val label: String, val value: String, val spoken: String? = null, val muted: Boolean = false)

/** The paper of the lower part: raised for the stub, sunk for the slip and the result list. */
enum class PaperTone { RAISED, SUNK }

@Composable
fun BoardingPass(
    from: PassLeg,
    to: PassLeg,
    fields: List<PassField>,
    modifier: Modifier = Modifier,
    jolt: Boolean = false,
    joltDelayMs: Int = Tokens.Transitions.jolt.delayMs,
    reduced: Boolean = false,
    shortLegs: Boolean = false,
    lower: @Composable BoxScope.() -> Unit,
    body: @Composable ColumnScope.() -> Unit,
) {
    val colors = TruthyTheme.colors
    val joltY = remember { Animatable(0f) }
    LaunchedEffect(jolt) {
        if (jolt && !reduced) {
            joltY.animateTo(
                0f,
                keyframes {
                    durationMillis = Tokens.Duration.jolt
                    delayMillis = joltDelayMs
                    0f at 0 using Tokens.Curves.ease
                    RoundGeometry.JOLT_DP at (Tokens.Duration.jolt * RoundGeometry.JOLT_PEAK).toInt() using Tokens.Curves.ease
                },
            )
        }
    }
    val main = TicketMainShape()
    // TestTags.TICKET: task 15 finds the ticket by it, on the round and on the result. propagateMinConstraints hands a
    // caller's minimum height (task 14's result stage) to the layout below. The upper part is measured first; the lower
    // part gets at least the height it leaves of that minimum and grows past it with its content. (A Column child with
    // weight(1f) would get the minimum minus the upper part, 0 once the upper part is taller than the stage at a large
    // font scale or on a 320 by 568 phone, and the result's missed list would be laid out 0 px tall.)
    Box(modifier.fillMaxWidth().testTag(TestTags.TICKET), propagateMinConstraints = true) {
        Box(Modifier.matchParentSize().truthyShadow(TruthyTheme.shadows.ticket, cornerRadius = Tokens.Radius.card))
        Layout(
            content = {
            Box(
                Modifier
                    .fillMaxWidth()
                    .graphicsLayer { translationY = joltY.value.dp.toPx() }
                    .clip(main)
                    .background(colors.surfaceRaised)
                    // The perforation over the main part's foot (task 10), drawn above the content as the web's is.
                    .drawWithContent {
                        drawContent()
                        drawTicketPerforation(colors.rule)
                    },
            ) {
                Column(Modifier.fillMaxWidth()) {
                    CarrierBand(words = true)
                    Legs(from, to, shortLegs)
                    PassFieldGrid(fields, Modifier.padding(horizontal = Tokens.Size.ticketInset))
                    body()
                }
            }
            Box(Modifier.fillMaxWidth(), propagateMinConstraints = true) { lower() }
            },
        ) { measurables, constraints ->
            val width = constraints.maxWidth
            val upper = measurables[0].measure(Constraints.fixedWidth(width))
            val rest = (constraints.minHeight - upper.height).coerceAtLeast(0)
            val lowerPart = measurables[1].measure(Constraints(minWidth = width, maxWidth = width, minHeight = rest))
            layout(width, upper.height + lowerPart.height) {
                upper.place(0, 0)
                lowerPart.place(0, upper.height)
            }
        }
    }
}

/** The accent band: cloud, "Truthy" and "BOARDING PASS"; the loading placeholder shows the cloud only. Hidden from screen readers. */
@Composable
internal fun CarrierBand(words: Boolean) {
    val colors = TruthyTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.carrier)
            .background(colors.accent)
            .padding(horizontal = Tokens.Space.s16)
            .clearAndSetSemantics {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s10),
    ) {
        TruthyIcon(IconId.CLOUD, tint = colors.onAccent, width = RoundGeometry.CLOUD_WIDTH)
        if (words) {
            Text("Truthy", style = TruthyType.carrierTitle, color = colors.onAccent)
            Spacer(Modifier.weight(1f))
            Text("BOARDING PASS", style = TruthyType.carrierLabel, color = colors.onAccent)
        }
    }
}

@Composable
private fun Legs(from: PassLeg, to: PassLeg, shortLegs: Boolean) {
    val compact = shortLegs && LocalConfiguration.current.screenHeightDp <= RoundGeometry.SHORT_LEGS_HEIGHT
    Row(
        Modifier.fillMaxWidth().padding(
            start = Tokens.Size.ticketInset,
            end = Tokens.Size.ticketInset,
            top = if (compact) Tokens.Space.s8 else Tokens.Space.s14,
            bottom = if (compact) Tokens.Space.s8 else Tokens.Space.s12,
        ),
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
    ) {
        Leg(from, compact, end = false, modifier = Modifier.weight(1f))
        Spacer(Modifier.width(RoundGeometry.LEG_ARROW_COLUMN))
        Leg(to, compact, end = true, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun Leg(leg: PassLeg, compact: Boolean, end: Boolean, modifier: Modifier) {
    val colors = TruthyTheme.colors
    val align = if (end) TextAlign.End else TextAlign.Start
    Column(modifier, horizontalAlignment = if (end) Alignment.End else Alignment.Start) {
        Text(
            leg.code,
            modifier = if (compact) Modifier.semantics { contentDescription = "${leg.code}, ${leg.name}" } else Modifier,
            style = TruthyType.legCode,
            color = colors.ink,
            textAlign = align,
        )
        if (!compact) Text(leg.name, Modifier.padding(top = Tokens.Space.s6), style = TruthyType.legName, color = colors.inkMuted, textAlign = align)
    }
}

/** Class / Card / Gate between two rules, the columns 1.1 / 1 / 1 but never narrower than a value (fieldColumnWidths). */
@Composable
fun PassFieldGrid(fields: List<PassField>, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    Layout(
        content = { fields.forEachIndexed { i, field -> FieldCell(field, first = i == 0) } },
        modifier = modifier
            .fillMaxWidth()
            .drawBehind {
                val w = Tokens.Stroke.rule.toPx()
                drawLine(colors.rule, Offset(0f, w / 2), Offset(size.width, w / 2), w)
                drawLine(colors.rule, Offset(0f, size.height - w / 2), Offset(size.width, size.height - w / 2), w)
            }
            .padding(vertical = Tokens.Stroke.rule),
    ) { measurables, constraints ->
        val widths = fieldColumnWidths(measurables.map { it.maxIntrinsicWidth(Constraints.Infinity) }, constraints.maxWidth)
        val height = measurables.indices.maxOfOrNull { measurables[it].maxIntrinsicHeight(widths[it]) } ?: 0
        val placeables = measurables.mapIndexed { i, measurable -> measurable.measure(Constraints.fixed(widths[i], height)) }
        layout(constraints.maxWidth, height) {
            var x = 0
            placeables.forEach {
                it.placeRelative(x, 0)
                x += it.width
            }
        }
    }
}

@Composable
private fun FieldCell(field: PassField, first: Boolean) {
    val colors = TruthyTheme.colors
    val divider = if (first) {
        Modifier
    } else {
        Modifier
            .drawBehind {
                val w = Tokens.Stroke.rule.toPx()
                drawLine(colors.rule, Offset(w / 2, 0f), Offset(w / 2, size.height), w)
            }
            .padding(start = Tokens.Stroke.rule + Tokens.Space.s12)
    }
    val spoken = field.spoken
    Column(divider.padding(top = Tokens.Space.s8, bottom = RoundGeometry.FIELD_BOTTOM)) {
        Text(field.label, style = TruthyType.fieldLabel, color = colors.inkMuted)
        Text(
            field.value,
            modifier = Modifier.padding(top = Tokens.Space.s2).then(if (spoken != null) Modifier.semantics { contentDescription = spoken } else Modifier),
            style = TruthyType.fieldValue,
            color = if (field.muted) colors.inkMuted else colors.ink,
        )
    }
}

/** The statement area: at least 188 tall, the text centred; the appliesTo line above it is never cut (BoardingPass.tsx PassStatement). */
@Composable
fun PassStatement(statement: String, appliesTo: String, muted: Boolean, modifier: Modifier = Modifier, textModifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    Column(
        modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.statementMin)
            .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = Tokens.Space.s18, bottom = Tokens.Space.s24),
        verticalArrangement = Arrangement.Center,
    ) {
        Column(textModifier.fillMaxWidth()) {
            if (appliesTo.isNotEmpty()) {
                Text(
                    appliesTo,
                    modifier = Modifier.padding(bottom = Tokens.Space.s6).semantics { contentDescription = "Applies to $appliesTo" },
                    style = TruthyType.monoData.copy(lineBreak = LineBreak.Heading),
                    color = colors.inkMuted,
                )
            }
            Text(cardText(statement), style = TruthyType.cardStatement, color = if (muted) colors.inkMuted else colors.ink)
        }
    }
}

/** The lower part's paper: notches at the top, radius 16 at the bottom. */
@Composable
fun PassLower(tone: PaperTone, modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit = {}) {
    val colors = TruthyTheme.colors
    val shape = TicketLowerShape()
    Box(modifier.background(if (tone == PaperTone.RAISED) colors.surfaceRaised else colors.surfaceSunk, shape), content = content)
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/PassParts.kt` (the stub with its intent stamps and Timed stamp, the slip, the source row and the loading placeholder):

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.remember
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.TicketMainShape
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.drawTicketPerforation
import com.eienmosu.truthy.design.keyboardFocusRing
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.engine.Answered
import com.eienmosu.truthy.engine.barcodeBars
import com.eienmosu.truthy.ui.IntentKind
import com.eienmosu.truthy.ui.IntentStamp
import com.eienmosu.truthy.ui.Stamp
import com.eienmosu.truthy.ui.StampVerdict
import com.eienmosu.truthy.ui.StubStamp
import com.eienmosu.truthy.ui.StubStampKind
import com.eienmosu.truthy.ui.TestTags
import kotlin.math.abs

/**
 * The stub of a question (and of every Timed card): route line, barcode, the swipe hint or one hint line, the
 * Timed stamp, and the intent stamps while dragging. Decorative, so hidden from screen readers. The stub drops
 * |intent| x 7 and turns intent x 2 degrees about (20%, 0) while the card is dragged.
 */
@Composable
internal fun PassStubContent(
    routeLine: String,
    cardLabel: String,
    barcode: String,
    hint: String?,
    mark: StubMark?,
    stampIntent: () -> Float,
    stubTurn: () -> Float,
    modifier: Modifier = Modifier,
) {
    val colors = TruthyTheme.colors
    val quiet = TruthyType.monoDataStrong.copy(fontWeight = FontWeight.Normal)
    Box(
        modifier
            .fillMaxWidth()
            .testTag(TestTags.STUB)
            .clearAndSetSemantics {}
            .graphicsLayer {
                val turn = stubTurn()
                transformOrigin = TransformOrigin(RoundGeometry.STUB_PIVOT_X, 0f)
                translationY = abs(turn) * Tokens.Gesture.stubPull.toPx()
                rotationZ = turn * RoundGeometry.STUB_TURN
            },
    ) {
        PassLower(PaperTone.RAISED, Modifier.fillMaxWidth().heightIn(min = Tokens.Size.lower)) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = Tokens.Size.lower)
                    .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = RoundGeometry.STUB_TOP, bottom = Tokens.Space.s14),
                verticalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(routeLine, Modifier.weight(1f, fill = false).alignByBaseline(), style = TruthyType.monoData, color = colors.inkMuted)
                    Text(cardLabel, Modifier.alignByBaseline(), style = TruthyType.monoDataStrong, color = colors.ink)
                }
                BarcodeStrip(barcode, Modifier.fillMaxWidth().height(Tokens.Size.barcode))
                if (hint == null) {
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = RoundGeometry.HINT_ROW),
                        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("← False", style = TruthyType.monoDataStrong, color = colors.falseColor)
                        Text("swipe to board", Modifier.weight(1f), style = quiet, color = colors.inkMuted, textAlign = TextAlign.Center)
                        Text("True →", style = TruthyType.monoDataStrong, color = colors.trueColor)
                    }
                } else {
                    Box(Modifier.fillMaxWidth().heightIn(min = RoundGeometry.HINT_ROW), contentAlignment = Alignment.Center) {
                        Text(hint, style = quiet, color = colors.inkMuted, textAlign = TextAlign.Center)
                    }
                }
            }
        }
        if (mark != null) {
            Box(Modifier.fillMaxWidth().height(RoundGeometry.STUB_STAMP_CENTRE * 2), contentAlignment = Alignment.Center) {
                key(mark) { StubStamp(mark.kind()) }
            }
        }
        if (hint == null) IntentStamps(stampIntent)
    }
}

/** components/BoardingPass.tsx Barcode: the engine's bars (barcodeBars, task 6) stretched to the strip's size, in ink. */
@Composable
private fun BarcodeStrip(data: String, modifier: Modifier) {
    val ink = TruthyTheme.colors.ink
    val code = remember(data) { barcodeBars(data) }
    Canvas(modifier) {
        val unit = size.width / code.width
        for (bar in code.bars) {
            drawRect(ink, topLeft = Offset(bar.x * unit, 0f), size = Size(bar.width * unit, size.height))
        }
    }
}

private fun StubMark.kind(): StubStampKind = when (this) {
    StubMark.CORRECT -> StubStampKind.CORRECT
    StubMark.WRONG -> StubStampKind.WRONG
    StubMark.TIME_UP -> StubStampKind.TIME_UP
}

/** True (left, -7 degrees) and False (right, +7 degrees), opacity intent x 1.6 toward their side; task 10's intent stamps. */
@Composable
private fun IntentStamps(stampIntent: () -> Float) {
    val gain = Tokens.Gesture.intentOpacityGain
    Box(Modifier.fillMaxWidth()) {
        IntentStamp(
            kind = IntentKind.TRUE,
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(start = Tokens.Space.s16, top = RoundGeometry.INTENT_STAMP_TOP)
                .graphicsLayer {
                    rotationZ = -RoundGeometry.INTENT_STAMP_TURN
                    alpha = (stampIntent() * gain).coerceIn(0f, 1f)
                },
        )
        IntentStamp(
            kind = IntentKind.FALSE,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(end = Tokens.Space.s16, top = RoundGeometry.INTENT_STAMP_TOP)
                .graphicsLayer {
                    rotationZ = RoundGeometry.INTENT_STAMP_TURN
                    alpha = (-stampIntent() * gain).coerceIn(0f, 1f)
                },
        )
    }
}

/** The answer slip under the torn stub: the right answer, the verdict stamp, the explanation and the source. */
@Composable
internal fun PassSlipContent(answer: Answered, newBest: Boolean, animateStamp: Boolean, onOpenSource: (String) -> Unit, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val card = answer.card
    PassLower(PaperTone.SUNK, modifier.fillMaxWidth().heightIn(min = Tokens.Size.lower)) {
        Column(
            Modifier
                .fillMaxWidth()
                .heightIn(min = Tokens.Size.lower)
                .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = Tokens.Space.s18, bottom = Tokens.Space.s12),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(Modifier.fillMaxWidth()) {
                Row(
                    Modifier.fillMaxWidth().heightIn(min = RoundGeometry.SLIP_VERDICT_ROW),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
                ) {
                    Column(Modifier.weight(1f).semantics(mergeDescendants = true) {}) {
                        Text("The answer is", style = TruthyType.answerLabel, color = colors.inkMuted)
                        Text(if (card.answer) "True" else "False", Modifier.padding(top = Tokens.Space.s2), style = TruthyType.answerValue, color = colors.ink)
                    }
                    Stamp(
                        verdict = when {
                            !answer.correct -> StampVerdict.WRONG
                            newBest -> StampVerdict.NEW_BEST
                            else -> StampVerdict.CORRECT
                        },
                        animate = animateStamp,
                    )
                }
                Text(cardText(card.text.en.explanation), Modifier.padding(top = Tokens.Space.s10), style = TruthyType.body, color = colors.ink)
            }
            SourceRow(card.source.title, card.source.url, onOpenSource)
        }
    }
}

@Composable
private fun SourceRow(title: String, url: String, onOpen: (String) -> Unit) {
    val colors = TruthyTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.touchMin)
            .testTag("source-link")
            .keyboardFocusRing(RoundedCornerShape(Tokens.Radius.small))
            .clickable(role = Role.Button) { onOpen(url) }
            .clearAndSetSemantics { contentDescription = sourceLinkLabel(title) },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
    ) {
        TruthyIcon(IconId.BOOK, tint = colors.trueColor, width = RoundGeometry.BOOK_ICON)
        Text(title, Modifier.weight(1f, fill = false), style = TruthyType.sourceLink.copy(textDecoration = TextDecoration.Underline), color = colors.trueColor)
        Text("→", style = TruthyType.sourceLink, color = colors.trueColor)
    }
}

/** The calm stand-in while the round loads: the band with the cloud, an empty body and the stub's paper. */
@Composable
fun PlaceholderTicket(modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    Box(modifier.fillMaxWidth().clearAndSetSemantics {}) {
        Box(Modifier.matchParentSize().truthyShadow(TruthyTheme.shadows.ticket, cornerRadius = Tokens.Radius.card))
        Column(Modifier.fillMaxWidth()) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(TicketMainShape())
                    .background(colors.surfaceRaised)
                    .drawWithContent {
                        drawContent()
                        drawTicketPerforation(colors.rule)
                    },
            ) {
                Column(Modifier.fillMaxWidth()) {
                    CarrierBand(words = false)
                    Spacer(Modifier.height(RoundGeometry.PLACEHOLDER_BODY))
                }
            }
            PassLower(PaperTone.RAISED, Modifier.fillMaxWidth().height(Tokens.Size.lower))
        }
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 15: Write the card drag.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/SwipeCard.kt` (spec 5.3, reference 7.2 items 1 to 3; Rules 2 and 3):

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.semantics.SemanticsPropertyKey
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.engine.SwipeContext
import com.eienmosu.truthy.engine.SwipeOutcome
import com.eienmosu.truthy.engine.SwipeSample
import com.eienmosu.truthy.engine.canStart
import com.eienmosu.truthy.engine.intent
import com.eienmosu.truthy.engine.interpret
import kotlin.math.abs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** The drawn card offset in dp, exposed for the UI tests that compare it with the finger travel (feel item N4). */
val CardDragOffset = SemanticsPropertyKey<Float>("CardDragOffset")

/**
 * The card's offset under the finger and its spring back. While a drag runs the drawn offset is c + dx (c: where a
 * springing card was caught); the intent stamps and the stub use dx alone.
 */
@Stable
internal class SwipeCardState(private val scope: CoroutineScope) {
    private val settle = Animatable(0f)
    private val stub = Animatable(0f)
    private var active = false
    private var dragging by mutableStateOf(false)
    private var caught by mutableFloatStateOf(0f)
    private var dragPx by mutableFloatStateOf(0f)
    private var liveIntent by mutableFloatStateOf(0f)

    /** The card's translation in px. */
    val drawnPx: Float get() = if (dragging) caught + dragPx else settle.value

    /** The intent stamps' intent: back to 0 at once on release, as the web resets --intent. */
    val stampIntent: Float get() = if (dragging) liveIntent else 0f

    /** The stub's pull and turn: the live intent, then springing back with the card. */
    val stubTurn: Float get() = if (dragging) liveIntent else stub.value

    fun begin() {
        caught = settle.value
        dragPx = 0f
        liveIntent = 0f
        dragging = true
        active = true
        scope.launch {
            settle.stop()
            stub.stop()
        }
    }

    fun move(dxPx: Float, dxDp: Double) {
        dragPx = dxPx
        liveIntent = intent(dxDp).toFloat()
    }

    /** Springs the card back to rest from where it is, seeded with the release velocity in px per second. No-op unless a drag is active. */
    fun release(velocityPxPerSecond: Float, reduced: Boolean) {
        if (!active) return
        active = false
        val from = caught + dragPx
        val turn = liveIntent
        scope.launch {
            settle.snapTo(from)
            stub.snapTo(turn)
            dragging = false
            if (reduced) {
                settle.snapTo(0f)
                stub.snapTo(0f)
                return@launch
            }
            launch { settle.animateTo(0f, snapSpring(), initialVelocity = velocityPxPerSecond) }
            stub.animateTo(0f, tweenOf(Tokens.SpringTransitions.snap.durationMs, Tokens.SpringTransitions.snap.easing))
        }
    }
}

/**
 * The drag on the stationary container inside the ticket's verticalScroll. It claims only horizontal-dominant
 * movement past the touch slop, so the scroll keeps vertical drags; `interpret` decides the outcome.
 */
internal fun Modifier.swipeGesture(
    state: SwipeCardState,
    enabled: Boolean,
    reduced: Boolean,
    coordinates: () -> LayoutCoordinates?,
    windowWidthPx: () -> Int,
    cardShownAt: () -> Double,
    onThreshold: () -> Unit,
    onSwipe: (Boolean) -> Unit,
): Modifier = pointerInput(enabled, reduced) {
    if (!enabled) return@pointerInput
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        val origin = coordinates()
        if (origin == null || !origin.isAttached) return@awaitEachGesture
        val scale = density.toDouble()
        fun sampleOf(change: PointerInputChange): SwipeSample {
            val at = origin.localToWindow(change.position)
            return SwipeSample(at.x / scale, at.y / scale, change.uptimeMillis.toDouble())
        }
        val first = sampleOf(down)
        val context = SwipeContext(viewportWidth = windowWidthPx() / scale, cardShownAt = cardShownAt())
        if (!canStart(first, context)) return@awaitEachGesture
        val samples = mutableListOf(first)
        val velocity = VelocityTracker()
        velocity.addPosition(down.uptimeMillis, down.position)
        val line = CommitLine()
        var claimed = false
        state.begin()
        try {
            while (true) {
                val event = awaitPointerEvent()
                val change = event.changes.firstOrNull { it.id == down.id }
                val secondPointer = event.changes.any { it.id != down.id && it.pressed }
                if (change == null || secondPointer || (!change.pressed && change.isConsumed) || (!claimed && change.isConsumed)) {
                    state.release(0f, reduced)
                    return@awaitEachGesture
                }
                samples.add(sampleOf(change))
                velocity.addPosition(change.uptimeMillis, change.position)
                if (!claimed) {
                    val travel = change.position - down.position
                    if (change.pressed && travel.getDistance() <= viewConfiguration.touchSlop) continue
                    if (change.pressed && abs(travel.x) <= abs(travel.y)) {
                        state.release(0f, reduced)
                        return@awaitEachGesture
                    }
                    claimed = true
                }
                change.consume()
                val dxDp = samples.last().x - first.x
                state.move(change.position.x - down.position.x, dxDp)
                if (line.crossed(dxDp)) onThreshold()
                if (!change.pressed) {
                    val outcome = interpret(samples, context)
                    state.release(velocity.calculateVelocity().x, reduced)
                    if (outcome != SwipeOutcome.CANCEL) onSwipe(outcome == SwipeOutcome.TRUE)
                    return@awaitEachGesture
                }
            }
        } finally {
            state.release(0f, reduced)
        }
    }
}
```

Notes for the executor: `release` runs once per drag (`active`), so the `finally` only acts when the gesture was cut off, for example when the card stopped taking answers and `pointerInput` restarted with `enabled = false`. A consumed release is how Compose reports a cancelled pointer (`onCancelPointerInput`), including the system back gesture taking the pointers; it springs back and answers nothing.

Run:

```bash
cd android/Truthy
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 16: Write the round screen.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundScreen.kt` (`components/play/PlayScreen.tsx` RoundView and Loading; Rules 1 and 4 to 12):

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.EnterExitState
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isAltPressed
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isMetaPressed
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.core.view.HapticFeedbackConstantsCompat
import androidx.core.view.ViewCompat
import androidx.compose.foundation.shape.RoundedCornerShape
import com.eienmosu.truthy.design.FocusRingSpec
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.LowerCloud
import com.eienmosu.truthy.design.SkyBackdrop
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyFrame
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.keyboardFocusRing
import com.eienmosu.truthy.start.FullSpeed
import com.eienmosu.truthy.ui.PillButton
import com.eienmosu.truthy.ui.PillTone
import com.eienmosu.truthy.ui.RoundButton
import com.eienmosu.truthy.ui.TestTags
import com.eienmosu.truthy.engine.Answered
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.NEXT_ARRIVES_MS
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.SPOKEN_RELEASE_MS
import com.eienmosu.truthy.engine.SlipAt
import com.eienmosu.truthy.engine.Span
import com.eienmosu.truthy.engine.TIMED
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.slipScroll
import com.eienmosu.truthy.engine.statementScroll
import kotlin.math.roundToInt
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun rememberRoundHaptics(): (RoundHaptic) -> Unit {
    val view = LocalView.current
    return remember(view) { { haptic: RoundHaptic -> ViewCompat.performHapticFeedback(view, haptic.feedbackConstant()) } }
}

private fun RoundHaptic.feedbackConstant(): Int = when (this) {
    RoundHaptic.THRESHOLD -> HapticFeedbackConstantsCompat.GESTURE_THRESHOLD_ACTIVATE
    RoundHaptic.CONFIRM -> HapticFeedbackConstantsCompat.CONFIRM
    RoundHaptic.REJECT -> HapticFeedbackConstantsCompat.REJECT
}

/** The round in its question, answered and stamped phases. Draws nothing once the round is finished or abandoned. */
@Composable
fun RoundScreen(
    round: RoundState,
    ticket: TicketInfo,
    cardShownAt: () -> Double,
    onAnswer: (Boolean) -> Unit,
    onNext: () -> Unit,
    onRequestLeave: () -> Unit,
    modifier: Modifier = Modifier,
    sheetOpen: Boolean = false,
    reducedMotion: Boolean = LocalReducedMotion.current,
    haptics: (RoundHaptic) -> Unit = rememberRoundHaptics(),
    openLink: (String) -> Unit = rememberSourceOpener(),
) {
    val view = remember(round, ticket) { roundView(round, ticket) }
    if (view.card == null || round.phase == Phase.FINISHED || round.abandoned) return
    val rootFocus = remember { FocusRequester() }
    var rootHasFocus by remember { mutableStateOf(false) }
    LaunchedEffect(rootHasFocus, sheetOpen) {
        if (!rootHasFocus && !sheetOpen) {
            withFrameNanos { }
            rootFocus.tryFocus()
        }
    }
    BoxWithConstraints(
        modifier
            .fillMaxSize()
            .background(TruthyTheme.colors.surface)
            .testTag("round-screen")
            .onFocusChanged { rootHasFocus = it.hasFocus }
            .focusRequester(rootFocus)
            .focusable()
            .onPreviewKeyEvent { event -> event.type == KeyEventType.KeyDown && event.roundKey() != null && event.nativeKeyEvent.repeatCount > 0 }
            .onKeyEvent { event -> handleRoundKey(event, round.phase, view.awaitsNext, sheetOpen, onAnswer, onNext, onRequestLeave) },
    ) {
        RoundBody(
            round = round,
            view = view,
            ticket = ticket,
            short = maxHeight < Tokens.Native.shortScreenBelow,
            cardShownAt = cardShownAt,
            onAnswer = onAnswer,
            onNext = onNext,
            onRequestLeave = onRequestLeave,
            sheetOpen = sheetOpen,
            reduced = reducedMotion,
            haptics = haptics,
            openLink = openLink,
        )
    }
}

@Composable
private fun RoundBody(
    round: RoundState,
    view: RoundView,
    ticket: TicketInfo,
    short: Boolean,
    cardShownAt: () -> Double,
    onAnswer: (Boolean) -> Unit,
    onNext: () -> Unit,
    onRequestLeave: () -> Unit,
    sheetOpen: Boolean,
    reduced: Boolean,
    haptics: (RoundHaptic) -> Unit,
    openLink: (String) -> Unit,
) {
    val screenDensity = LocalDensity.current
    val hostView = LocalView.current
    val scope = rememberCoroutineScope()
    val currentHaptics by rememberUpdatedState(haptics)
    val currentAnswer by rememberUpdatedState(onAnswer)
    val currentShownAt by rememberUpdatedState(cardShownAt)

    // Verdict and time-up haptics, once per change of the round (spec 5.5).
    val previous = remember { RoundRef(round) }
    LaunchedEffect(round) {
        val haptic = verdictHaptic(previous.state, round)
        previous.state = round
        if (haptic != null) currentHaptics(haptic)
    }

    // The live regions keep what they said while the sheet is open and release it SPOKEN_RELEASE_MS after it closes.
    var held by remember { mutableStateOf<Spoken?>(null) }
    val live = view.spoken
    LaunchedEffect(sheetOpen) {
        if (sheetOpen) {
            if (held == null) held = live
        } else {
            delay(SPOKEN_RELEASE_MS.toLong())
            held = null
        }
    }
    val said = held ?: live

    val statementFocus = remember { FocusRequester() }
    val scrollerFocus = remember { FocusRequester() }
    val nextFocus = remember { FocusRequester() }
    var statementFocused by remember { mutableStateOf(false) }
    var answerRowFocused by remember { mutableStateOf(false) }
    var focusedAtTimeUp by remember { mutableStateOf(false) }
    val scroll = rememberScrollState()
    var viewportPx by remember { mutableIntStateOf(0) }
    var rowPx by remember { mutableIntStateOf(with(screenDensity) { Tokens.Size.actions.roundToPx() }) }
    val content = remember { Placed() }
    val statementText = remember { Placed() }
    val slip = remember { Placed() }
    val swipeArea = remember { Placed() }
    val swipe = remember(scope) { SwipeCardState(scope) }
    val gapPx = with(screenDensity) { Tokens.Space.s12.toPx() }
    val underPx = if (short) gapPx else gapPx + rowPx

    // A new card: scroll the statement into the stage and give it focus (in Timed only the first card's).
    LaunchedEffect(round.index, round.phase == Phase.QUESTION, round.cards.size) {
        if (round.phase != Phase.QUESTION) return@LaunchedEffect
        withFrameNanos { }
        val span = content.spanOf(statementText)
        val top = if (span == null) 0 else statementScroll(span, (viewportPx - underPx).toDouble()).roundToInt()
        launch { if (view.timed && !reduced) scroll.animateScrollTo(top) else scroll.scrollTo(top) }
        if (!view.timed || round.index == 0) statementFocus.tryFocus() else if (statementFocused) scrollerFocus.tryFocus()
    }

    // Timed: a stamped stub (an answer, or time up) scrolls the ticket to its end.
    val stubStamped = view.beat || view.timeUp
    LaunchedEffect(stubStamped, round.index) {
        if (!stubStamped) return@LaunchedEffect
        withFrameNanos { }
        if (reduced) scroll.scrollTo(scroll.maxValue) else scroll.animateScrollTo(scroll.maxValue)
    }

    // The other classes: an answer scrolls the slip into view when it is not already above the action row.
    LaunchedEffect(view.answered, round.index) {
        if (!view.answered || view.timed) return@LaunchedEffect
        withFrameNanos { }
        val span = content.spanOf(slip) ?: return@LaunchedEffect
        val at = SlipAt(top = scroll.value.toDouble(), visible = (viewportPx - underPx).toDouble(), gap = gapPx.toDouble(), max = scroll.maxValue.toDouble())
        val target = slipScroll(span, at) ?: return@LaunchedEffect
        if (reduced) scroll.scrollTo(target.roundToInt()) else scroll.animateScrollTo(target.roundToInt())
    }

    // Time up: whether True or False had focus decides whether See results takes it.
    LaunchedEffect(view.timeUp) {
        if (view.timeUp) focusedAtTimeUp = answerRowFocused
    }

    // The Next row arrives NEXT_ARRIVES_MS after the answer; focus moves to it then, or at once with reduced motion.
    var arrivedAt by remember { mutableIntStateOf(-1) }
    LaunchedEffect(view.awaitsNext, round.index) {
        if (!view.awaitsNext) return@LaunchedEffect
        delay(NEXT_ARRIVES_MS.toLong())
        arrivedAt = round.index
    }
    val focusNext = view.awaitsNext && (reduced || arrivedAt == round.index)
    LaunchedEffect(focusNext, round.index, view.timeUp) {
        if (!focusNext || (view.timeUp && !focusedAtTimeUp)) return@LaunchedEffect
        withFrameNanos { }
        nextFocus.tryFocus()
    }

    Box(Modifier.fillMaxSize()) {
        SkyBackdrop(lowerCloud = LowerCloud.GAME)
        LiveRegions(view, said)
        TruthyFrame {
            Row(
                Modifier.fillMaxWidth().heightIn(min = Tokens.Size.header),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
            ) {
                RoundButton(label = "Leave round", onClick = onRequestLeave) { TruthyIcon(IconId.CLOSE) }
                RoundHeader(round, view, ticket.best, reduced, Modifier.weight(1f))
            }
            Spacer(Modifier.height(Tokens.Space.s12))
            Box(Modifier.weight(1f).fillMaxWidth()) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .padding(bottom = if (short) with(screenDensity) { rowPx.toDp() } else 0.dp)
                        .widenBy(Tokens.Size.gutter)
                        .onSizeChanged { viewportPx = it.height }
                        .testTag("ticket-scroller")
                        .focusRequester(scrollerFocus)
                        // Reference 5.0: the ring sits 2 inside the ticket, for a hardware keyboard only (task 10).
                        .keyboardFocusRing(RoundedCornerShape(Tokens.Radius.card), FocusRingSpec.INSET)
                        .focusable()
                        .semantics { contentDescription = "Ticket" }
                        .verticalScroll(scroll),
                ) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .onPlaced { content.coords = it }
                            .padding(start = Tokens.Size.gutter, end = Tokens.Size.gutter, bottom = with(screenDensity) { underPx.toDp() }),
                    ) {
                        val offsetDp = swipe.drawnPx / screenDensity.density
                        val takes = view.takesAnswers && !sheetOpen
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .testTag("swipe-card")
                                .onPlaced { swipeArea.coords = it }
                                .swipeGesture(
                                    state = swipe,
                                    enabled = takes,
                                    reduced = reduced,
                                    coordinates = { swipeArea.coords },
                                    windowWidthPx = { hostView.rootView.width },
                                    cardShownAt = { currentShownAt() },
                                    onThreshold = { currentHaptics(RoundHaptic.THRESHOLD) },
                                    onSwipe = { value -> currentAnswer(value) },
                                )
                                .semantics {
                                    this[CardDragOffset] = offsetDp
                                    if (takes) {
                                        customActions = listOf(
                                            CustomAccessibilityAction("Answer true") { currentAnswer(true); true },
                                            CustomAccessibilityAction("Answer false") { currentAnswer(false); true },
                                        )
                                    }
                                },
                        ) {
                            Box(
                                Modifier
                                    .graphicsLayer {
                                        translationX = swipe.drawnPx
                                        rotationZ = swipe.drawnPx / density / Tokens.Gesture.rotationDivisor
                                    }
                                    // The drawn card, for task 15's captures; "swipe-card" above is the stationary drag area.
                                    .testTag(TestTags.CARD),
                            ) {
                                CardSwap(
                                    round = round,
                                    view = view,
                                    ticket = ticket,
                                    reduced = reduced,
                                    swipe = swipe,
                                    statementModifier = Modifier
                                        .onPlaced { statementText.coords = it }
                                        .onFocusChanged { statementFocused = it.isFocused }
                                        .focusRequester(statementFocus)
                                        .focusable(),
                                    slipModifier = Modifier.onPlaced { slip.coords = it },
                                    onOpenSource = openLink,
                                )
                            }
                        }
                    }
                }
                ActionRows(
                    view = view,
                    reduced = reduced,
                    nextFocus = nextFocus,
                    onAnswer = onAnswer,
                    onNext = onNext,
                    onAnswerRowFocus = { answerRowFocused = it },
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .heightIn(min = Tokens.Size.actions)
                        .onSizeChanged { rowPx = it.height },
                )
            }
        }
    }
}

/** What the card shows: the round and its view, frozen per card so a leaving Timed card keeps its own stamp. */
private data class CardFrame(val key: Int, val round: RoundState, val view: RoundView)

@Composable
private fun CardSwap(
    round: RoundState,
    view: RoundView,
    ticket: TicketInfo,
    reduced: Boolean,
    swipe: SwipeCardState,
    statementModifier: Modifier,
    slipModifier: Modifier,
    onOpenSource: (String) -> Unit,
) {
    val dealRisePx = with(LocalDensity.current) { RoundGeometry.DEAL_RISE.roundToPx() }
    val animated = view.timed && !reduced
    AnimatedContent(
        targetState = CardFrame(if (view.timed) round.index else 0, round, view),
        transitionSpec = { cardSwap(animated, dealRisePx) },
        contentKey = { it.key },
        label = "card",
    ) { shown ->
        val turn by transition.animateFloat(
            transitionSpec = { tweenOf(Tokens.Duration.leaveTimed, Tokens.Curves.fall) },
            label = "leave-turn",
        ) { state -> if (state == EnterExitState.PostExit) 1f else 0f }
        val current = shown.round.index == round.index
        val side = if (shown.view.leaveSide == TearSide.RIGHT) 1f else -1f
        TicketCard(
            frame = shown,
            ticket = ticket,
            reduced = reduced,
            swipe = swipe,
            statementModifier = if (current) statementModifier else Modifier,
            slipModifier = if (current) slipModifier else Modifier,
            onOpenSource = onOpenSource,
            modifier = Modifier.graphicsLayer { rotationZ = turn * RoundGeometry.LEAVE_TURN * side },
        )
    }
}

/** Timed: the answered card leaves towards its side over the next one coming up from 14 dp (PlayScreen.tsx CARD_SWAP). */
private fun AnimatedContentTransitionScope<CardFrame>.cardSwap(animated: Boolean, dealRisePx: Int): ContentTransform {
    val transform = if (!animated) {
        EnterTransition.None togetherWith ExitTransition.None
    } else {
        val toRight = initialState.view.leaveSide == TearSide.RIGHT
        val enter = fadeIn(tweenOf(Tokens.Duration.dealTimed, Tokens.Curves.ease)) +
            slideInVertically(tweenOf(Tokens.Duration.dealTimed, Tokens.Curves.ease)) { dealRisePx }
        val exit = fadeOut(tweenOf(Tokens.Duration.leaveTimed, Tokens.Curves.easeIn)) +
            slideOutHorizontally(tweenOf(Tokens.Duration.leaveTimed, Tokens.Curves.fall)) { width ->
                ((if (toRight) 1f else -1f) * width * RoundGeometry.LEAVE_FRACTION).roundToInt()
            }
        enter togetherWith exit
    }
    val sized = transform using SizeTransform(clip = false)
    sized.targetContentZIndex = -targetState.key.toFloat()
    return sized
}

@Composable
private fun TicketCard(
    frame: CardFrame,
    ticket: TicketInfo,
    reduced: Boolean,
    swipe: SwipeCardState,
    statementModifier: Modifier,
    slipModifier: Modifier,
    onOpenSource: (String) -> Unit,
    modifier: Modifier,
) {
    val view = frame.view
    val card = view.card ?: return
    val index = frame.round.index
    BoardingPass(
        from = PassLeg(ticket.deckCode, ticket.deckName),
        to = PassLeg(ticket.sectionCode, ticket.sectionName),
        fields = listOf(
            PassField("Class", ticket.modeLabel),
            PassField("Card", view.cardField),
            if (view.timeUp) PassField("Gate", "Closed", muted = true) else PassField("Gate", "F ← → T", spoken = "False left, true right"),
        ),
        modifier = modifier,
        jolt = view.answered || view.beat || view.timeUp,
        joltDelayMs = when {
            view.timeUp -> RoundGeometry.JOLT_DELAY_TIME_UP
            view.beat -> RoundGeometry.JOLT_DELAY_BEAT
            else -> Tokens.Transitions.jolt.delayMs
        },
        reduced = reduced,
        lower = {
            Box(Modifier.fillMaxWidth().heightIn(min = Tokens.Size.lower)) {
                val answered = view.slip
                if (answered != null) {
                    key(index) { SlipLayer(answered, view.newBest, reduced, onOpenSource, slipModifier) }
                }
                key(index) {
                    StubLayer(visible = view.showStub, enterAnimated = !view.timed && index > 0, tear = view.tear, reduced = reduced) {
                        PassStubContent(
                            routeLine = view.routeLine,
                            cardLabel = "Card ${view.cardNumber}",
                            barcode = card.id,
                            hint = view.stubHint,
                            mark = view.stubMark,
                            stampIntent = { swipe.stampIntent },
                            stubTurn = { swipe.stubTurn },
                        )
                    }
                }
            }
        },
    ) {
        PassStatement(card.text.en.statement, card.appliesTo, muted = view.timeUp, textModifier = statementModifier)
    }
}

/** The slip appears under the stub as it tears; with reduced motion it fades in over 140 ms, kept at any system scale. */
@Composable
private fun SlipLayer(answer: Answered, newBest: Boolean, reduced: Boolean, onOpenSource: (String) -> Unit, modifier: Modifier) {
    val alpha = remember { Animatable(if (reduced) 0f else 1f) }
    LaunchedEffect(Unit) {
        if (alpha.value < 1f) withContext(FullSpeed) { alpha.animateTo(1f, tweenOf(Tokens.Duration.reducedIn, Tokens.Curves.easeOut)) }
    }
    PassSlipContent(answer, newBest, animateStamp = !reduced, onOpenSource = onOpenSource, modifier = modifier.graphicsLayer { this.alpha = alpha.value })
}

/** The stub's presence: it enters from 12 dp, and tears off towards `tear` when it leaves (fades with reduced motion). */
@Composable
private fun StubLayer(visible: Boolean, enterAnimated: Boolean, tear: TearSide, reduced: Boolean, content: @Composable () -> Unit) {
    var present by remember { mutableStateOf(visible) }
    val alpha = remember { Animatable(if (visible && !enterAnimated) 1f else 0f) }
    val rise = remember { Animatable(if (visible && enterAnimated && !reduced) RoundGeometry.STUB_RISE.value else 0f) }
    val fall = remember { Animatable(0f) }
    var side by remember { mutableStateOf(tear) }
    LaunchedEffect(visible) {
        if (visible) {
            present = true
            if (alpha.value >= 1f) return@LaunchedEffect
            coroutineScope {
                if (reduced) {
                    launch { withContext(FullSpeed) { alpha.animateTo(1f, tweenOf(Tokens.Duration.reducedIn, Tokens.Curves.easeOut)) } }
                } else {
                    launch { alpha.animateTo(1f, tweenOf(Tokens.Duration.t2, Tokens.Curves.ease)) }
                    launch { rise.animateTo(0f, tweenOf(Tokens.Duration.t2, Tokens.Curves.ease)) }
                }
            }
        } else {
            side = tear
            coroutineScope {
                if (reduced) {
                    launch { withContext(FullSpeed) { alpha.animateTo(0f, tweenOf(Tokens.Duration.reducedOut, Tokens.Curves.easeOut)) } }
                } else {
                    launch { fall.animateTo(1f, tweenOf(Tokens.Duration.tear, Tokens.Curves.fall)) }
                    launch { alpha.animateTo(0f, tweenOf(Tokens.Duration.tear, Tokens.Curves.easeIn)) }
                }
            }
            present = false
        }
    }
    if (!present) return
    Box(
        Modifier.graphicsLayer {
            val direction = if (side == TearSide.RIGHT) 1f else -1f
            this.alpha = alpha.value
            translationX = direction * RoundGeometry.TEAR_X.toPx() * fall.value
            translationY = rise.value.dp.toPx() + RoundGeometry.TEAR_Y.toPx() * fall.value
            rotationZ = direction * RoundGeometry.TEAR_TURN * fall.value
        },
    ) { content() }
}

/** The answer row (False, True) and the Next row (Next card or See results), crossing over in place. */
@Composable
private fun ActionRows(
    view: RoundView,
    reduced: Boolean,
    nextFocus: FocusRequester,
    onAnswer: (Boolean) -> Unit,
    onNext: () -> Unit,
    onAnswerRowFocus: (Boolean) -> Unit,
    modifier: Modifier,
) {
    Box(modifier) {
        FadingRow(visible = !view.awaitsNext, reduced = reduced, enterDelayMs = 0) {
            Row(
                Modifier.fillMaxWidth().onFocusChanged { onAnswerRowFocus(it.hasFocus) },
                horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
            ) {
                PillButton(
                    label = "False",
                    onClick = { if (!view.beat) onAnswer(false) },
                    modifier = Modifier.weight(1f).testTag("answer-false"),
                    tone = PillTone.FALSE,
                    dimmed = view.beat,
                    leadingIcon = { TruthyIcon(IconId.CROSS, tint = TruthyTheme.colors.onDark, width = RoundGeometry.CROSS_ICON) },
                )
                PillButton(
                    label = "True",
                    onClick = { if (!view.beat) onAnswer(true) },
                    modifier = Modifier.weight(1f).testTag("answer-true"),
                    tone = PillTone.TRUE,
                    dimmed = view.beat,
                    leadingIcon = { TruthyIcon(IconId.CHECK, tint = TruthyTheme.colors.onDark, width = RoundGeometry.CHECK_ICON) },
                )
            }
        }
        FadingRow(visible = view.awaitsNext, reduced = reduced, enterDelayMs = Tokens.Transitions.answerRow.delayMs) {
            PillButton(
                label = view.actionLabel,
                onClick = onNext,
                modifier = Modifier.fillMaxWidth().focusRequester(nextFocus).testTag("next"),
                trailingIcon = { TruthyIcon(IconId.FORWARD, tint = TruthyTheme.colors.onDark) },
            )
        }
    }
}

/** A row that rises in from 12 dp and sinks out to it over 220 ms; with reduced motion only the fade, kept at any system scale. */
@Composable
private fun FadingRow(visible: Boolean, reduced: Boolean, enterDelayMs: Int, content: @Composable () -> Unit) {
    var present by remember { mutableStateOf(visible) }
    var settled by remember { mutableStateOf(false) }
    val alpha = remember { Animatable(if (visible) 1f else 0f) }
    val rise = remember { Animatable(0f) }
    LaunchedEffect(visible) {
        if (!settled) {
            settled = true
            return@LaunchedEffect
        }
        val travel = if (reduced) 0f else RoundGeometry.ROW_RISE.value
        val delayMs = if (reduced) 0 else enterDelayMs
        if (visible) {
            present = true
            rise.snapTo(travel)
            coroutineScope {
                launch { withContext(FullSpeed) { alpha.animateTo(1f, tweenOf(Tokens.Duration.t2, Tokens.Curves.ease, delayMs)) } }
                launch { rise.animateTo(0f, tweenOf(Tokens.Duration.t2, Tokens.Curves.ease, delayMs)) }
            }
        } else {
            coroutineScope {
                launch { withContext(FullSpeed) { alpha.animateTo(0f, tweenOf(Tokens.Duration.t2, Tokens.Curves.ease)) } }
                launch { rise.animateTo(travel, tweenOf(Tokens.Duration.t2, Tokens.Curves.ease)) }
            }
            present = false
        }
    }
    if (!present) return
    Box(
        Modifier.fillMaxWidth().graphicsLayer {
            this.alpha = alpha.value
            translationY = rise.value.dp.toPx()
        },
    ) { content() }
}

@Composable
private fun RoundHeader(round: RoundState, view: RoundView, best: Int?, reduced: Boolean, modifier: Modifier) {
    when (round.mode) {
        Mode.STREAK -> StreakHeader(view.streak, best, view.slip?.correct, reduced, modifier)
        Mode.LIVES -> LivesHeader(view.results, view.answered, reduced, modifier)
        Mode.TIMED -> TimedHeader(round.clock?.remainingMs ?: TIMED.roundMs, view.correctCount, view.wrongCount, reduced, modifier)
        Mode.CLASSIC -> FlightPathHeader(round.cards.size, view.results, round.index, view.answered, reduced, modifier)
    }
}

/** The heading and the two live regions, drawn as nothing (reference 4.5 and 5.9). */
@Composable
private fun LiveRegions(view: RoundView, said: Spoken) {
    Box(Modifier.size(RoundGeometry.SPOKEN_NODE).semantics { heading(); contentDescription = view.heading })
    Box(
        Modifier.size(RoundGeometry.SPOKEN_NODE).testTag("status").semantics {
            liveRegion = LiveRegionMode.Polite
            if (said.status.isNotEmpty()) contentDescription = said.status
        },
    )
    if (view.timed) {
        Box(
            Modifier.size(RoundGeometry.SPOKEN_NODE).testTag("card-announcer").semantics {
                liveRegion = LiveRegionMode.Polite
                if (said.card.isNotEmpty()) contentDescription = said.card
            },
        )
    }
}

// The 430 column and the safe areas are task 10's TruthyFrame (spec 5.6, one implementation for every screen).

/** P0: the sky, the X, the placeholder ticket, the heading "Your round" and the status "Loading your round". */
@Composable
fun RoundLoading(onRequestLeave: () -> Unit, modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier.fillMaxSize().background(TruthyTheme.colors.surface)) {
        val short = maxHeight < Tokens.Native.shortScreenBelow
        SkyBackdrop(lowerCloud = LowerCloud.GAME)
        Box(Modifier.size(RoundGeometry.SPOKEN_NODE).semantics { heading(); contentDescription = "Your round" })
        Box(Modifier.size(RoundGeometry.SPOKEN_NODE).semantics { liveRegion = LiveRegionMode.Polite; contentDescription = "Loading your round" })
        TruthyFrame {
            Row(Modifier.fillMaxWidth().heightIn(min = Tokens.Size.header), verticalAlignment = Alignment.CenterVertically) {
                RoundButton(label = "Leave round", onClick = onRequestLeave) { TruthyIcon(IconId.CLOSE) }
            }
            Spacer(Modifier.height(Tokens.Space.s12))
            Box(Modifier.weight(1f).fillMaxWidth()) { PlaceholderTicket() }
            Spacer(Modifier.height(Tokens.Space.s12 + Tokens.Size.actions))
        }
    }
}

private class RoundRef(var state: RoundState)

private class Placed {
    var coords: LayoutCoordinates? = null
}

/** Where a part lies in the ticket's scroll content, from top to bottom in px. */
private fun Placed.spanOf(part: Placed): Span? {
    val base = coords ?: return null
    val node = part.coords ?: return null
    if (!base.isAttached || !node.isAttached) return null
    val top = base.localPositionOf(node, Offset.Zero).y.toDouble()
    return Span(top, top + node.size.height)
}

/** The scroller runs from frame edge to frame edge, so a dragged card reaches it (PlayScreen.tsx -mx gutter). */
private fun Modifier.widenBy(side: Dp): Modifier = layout { measurable, constraints ->
    val extra = side.roundToPx() * 2
    val width = constraints.maxWidth + extra
    val placeable = measurable.measure(constraints.copy(minWidth = width, maxWidth = width))
    layout(constraints.maxWidth, placeable.height) { placeable.place(-extra / 2, 0) }
}

private fun FocusRequester.tryFocus() {
    try {
        requestFocus()
    } catch (notAttached: IllegalStateException) {
        return
    }
}

private fun KeyEvent.roundKey(): RoundKey? = when (key) {
    Key.DirectionLeft -> RoundKey.LEFT
    Key.DirectionRight -> RoundKey.RIGHT
    Key.Enter, Key.NumPadEnter -> RoundKey.ENTER
    Key.Escape -> RoundKey.ESCAPE
    else -> null
}

private fun handleRoundKey(
    event: KeyEvent,
    phase: Phase,
    awaitsNext: Boolean,
    sheetOpen: Boolean,
    onAnswer: (Boolean) -> Unit,
    onNext: () -> Unit,
    onLeave: () -> Unit,
): Boolean {
    val key = event.roundKey() ?: return false
    val modified = event.isAltPressed || event.isCtrlPressed || event.isMetaPressed || event.isShiftPressed
    if (event.type == KeyEventType.KeyUp) return key == RoundKey.ESCAPE && !modified && !sheetOpen
    if (event.type != KeyEventType.KeyDown) return false
    when (val action = roundKeyAction(key, event.nativeKeyEvent.repeatCount > 0, modified, sheetOpen, phase, awaitsNext)) {
        null -> return false
        is RoundKeyAction.Answer -> onAnswer(action.value)
        RoundKeyAction.Next -> onNext()
        RoundKeyAction.Leave -> onLeave()
        RoundKeyAction.Swallow -> Unit
    }
    return true
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:compileDebugKotlin :app:compileDebugAndroidTestKotlin :app:assembleDebug
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 17: Run the device tests on the API 36 emulator.**

Start the API 36 emulator of task 7 (gesture navigation, the default) and run:

```bash
cd android/Truthy
adb devices
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=com.eienmosu.truthy.round
```

Expected: `adb devices` lists one `emulator-5554 device`; the run ends `BUILD SUCCESSFUL` and `app/build/reports/androidTests/connected/debug/index.html` lists `SwipeGestureTest` 8, `RoundScreenTest` 7 and `SourceLinkIntentTest` 2 tests, 17 in all, with 0 failures. `aDragThatStartsInsideThe24DpEdgeZoneNeverMovesTheCard` must run, not be skipped: on the 412 dp wide emulator the frame meets the window edge. If a test fails:
- `nothingClipsAtTwiceTheTextSize` names the clipped text. A fixed height somewhere above it must become `heightIn(min = ...)`, or a `softWrap = false` must go; when the text belongs to a task 10 component (a pill, a stamp), fix that component the same way and say so in the commit message.
- A diagonal or edge test that fails on `offset()` means the gesture claimed movement it must not: check the claim rule in `swipeGesture` (|x| > |y| past the slop, the `canStart` check before `begin`).
- `aSourceOpensAsACustomTabInTheAppsNightColours` failing on `EXTRA_TOOLBAR_COLOR` means the browser library put the default colours elsewhere: read the extras of the recorded intent (`Intents.getIntents()`) and match the key the library writes, keeping the colour.

- [ ] **Step 18: Commit the round screen and its tests.**

```bash
git add android/Truthy/gradle/libs.versions.toml android/Truthy/app/build.gradle.kts android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/CardTextSpans.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundHeaders.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/BoardingPass.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/PassParts.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/SwipeCard.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundScreen.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/RoundTestHost.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/SwipeGestureTest.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/RoundScreenTest.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/SourceLinkIntentTest.kt
git commit -m "feat: add the Android round screen with the native card drag, haptics and source links"
```

- [ ] **Step 19: Write `RoundRoute`.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundRoute.kt`:

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.eienmosu.truthy.RoundCoordinator

/** The round screen on the coordinator of task 11: its state, its ticket, its guarded answer and next. */
@Composable
fun RoundRoute(coordinator: RoundCoordinator, onRequestLeave: () -> Unit, modifier: Modifier = Modifier, sheetOpen: Boolean = false) {
    val round by coordinator.state.collectAsStateWithLifecycle()
    RoundScreen(
        round = round,
        ticket = coordinator.ticket,
        cardShownAt = { coordinator.cardShownAt },
        onAnswer = { coordinator.answer(it) },
        onNext = { coordinator.next() },
        onRequestLeave = onRequestLeave,
        modifier = modifier,
        sheetOpen = sheetOpen,
    )
}
```

- [ ] **Step 20: Show the round in the app.**

The app root is task 11's `TruthyRoot` in `android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt`, as task 12 left it (reduced motion provided at the root, the start flow in its branch). Check that it is the only file with the round's branch:

```bash
cd android/Truthy
grep -rnE "TopScreen\.Round" app/src/main
cd ../..
```

Expected: `TruthyRoot.kt` (the `is TopScreen.Round ->` branch) and task 11's `AppController.kt` and `AppViewModel.kt`; no other composable renders the round. Add these imports to `TruthyRoot.kt`:

```kotlin
import com.eienmosu.truthy.round.RoundLoading
import com.eienmosu.truthy.round.RoundRoute
```

and replace its `TruthyRoot` function with this one. `screen` is a delegated property, which Kotlin cannot smart-cast, so the `when` binds it to `current`; the round's state comes from task 11's `RoundLoad`:

```kotlin
@Composable
fun TruthyRoot(app: AppViewModel) {
    val screen by app.screen.collectAsState()
    // Task 12, rule 4: reduced motion for every screen, provided once.
    CompositionLocalProvider(LocalReducedMotion provides rememberReducedMotion()) {
        Box(Modifier.fillMaxSize().background(TruthyTheme.colors.surface).testTag(ROOT_TAG)) {
            when (val current = screen) {
                TopScreen.Start -> Box(Modifier.fillMaxSize().testTag(START_TAG)) { StartFlowRoute(app) }
                is TopScreen.Round -> Box(Modifier.fillMaxSize().testTag(ROUND_TAG)) {
                    // Until task 14 adds the leave sheet and back on the round, the X leaves at once with the leave
                    // rules (task 11's leaveRound: the coordinator's leave, then start step 1).
                    when (val load = current.load) {
                        is RoundLoad.Ready -> RoundRoute(load.coordinator, onRequestLeave = { app.leaveRound() })
                        else -> RoundLoading(onRequestLeave = { app.leaveRound() })
                    }
                }
            }
        }
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 21: Check a drag inside the system gesture inset with `adb input` (Review Focus 5, feel item N3).**

The Compose tests inject events into the app and cannot reach the system's gesture handler, so this check goes through the input system. On the API 36 emulator:

```bash
cd android/Truthy
adb shell settings get secure navigation_mode
./gradlew :app:installDebug
size=$(adb shell wm size | tail -1 | awk '{print $3}'); w=${size%x*}; h=${size#*x}; echo "$w x $h"
adb shell am start -W -n com.eienmosu.truthy/.MainActivity --es truthy.screen round --es truthy.deck aws-clf-c02 --es truthy.section ALL --es truthy.mode classic --es truthy.seed 1
sleep 2
adb shell input swipe 4 $((h/2)) $((w*6/10)) $((h/2)) 300
sleep 1
adb shell dumpsys window | grep -E 'mCurrentFocus'
```

Expected: `navigation_mode` prints `2` (gesture navigation; if not, run `adb shell cmd overlay enable-exclusive com.android.internal.systemui.navbar.gestural` and start again); the size line prints the emulator's pixels; and after the swipe from 4 px, `mCurrentFocus` no longer names `com.eienmosu.truthy`: the system took the drag as Back, and with no back handler on the round until task 14 the activity closed. The card was never answered. Then the control, a drag that starts well inside the screen:

```bash
adb shell am start -W -n com.eienmosu.truthy/.MainActivity --es truthy.screen round --es truthy.deck aws-clf-c02 --es truthy.section ALL --es truthy.mode classic --es truthy.seed 1
sleep 2
adb shell input swipe $((w*3/10)) $((h/2)) $((w*9/10)) $((h/2)) 300
sleep 1
adb shell uiautomator dump /sdcard/round.xml > /dev/null
adb shell cat /sdcard/round.xml | grep -c 'The answer is'
adb shell rm /sdcard/round.xml
```

Expected: `1`: the card was answered True and the slip shows. If the extras of task 11 have other names (step 1), use them. Write both results (API level, emulator, outcome) into the feel checklist notes that task 15 collects; nothing of this goes into the repository.

- [ ] **Step 22: Run every gate and the hygiene check, then commit.**

```bash
cd android/Truthy
./gradlew :engine:test :tokengen:test :app:testDebugUnitTest :app:assembleDebug
./gradlew :app:connectedDebugAndroidTest
cd ../..
pnpm test
git status --short
git diff --cached --name-only
```

Expected: both Gradle runs end `BUILD SUCCESSFUL` (the connected run with every device test of the app green, this task's 17 among them); `pnpm test` passes, including the repository hygiene test over the new Kotlin files (no labelled `this` with a member access, no local path, no em dash); `git status --short` shows only `RoundRoute.kt` and `TruthyRoot.kt` as changed. Then:

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundRoute.kt android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt
git commit -m "feat: show the Android round screen from the app root"
git status --short
```

Expected: the commit holds the two files (`git show --stat HEAD`) and `git status --short` prints nothing.
