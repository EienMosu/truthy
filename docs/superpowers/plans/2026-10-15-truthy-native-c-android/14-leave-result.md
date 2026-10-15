### Task 14: The leave sheet (`ModalBottomSheet`), predictive back on the round, the result screen

The round needs three ways out that behave like Android and look like the web. The leave sheet is the web's "Leave round?" card drawn inside a Material3 `ModalBottomSheet`, so swiping it down, tapping the scrim, pressing back and pressing Escape all mean "Keep playing" through the platform's own sheet, while the card keeps the web's paper, padding, radius, words and buttons (spec 5.4). Back on the round is a real predictive back gesture: it shrinks the round surface from 1 to 0.94 with the system's progress and on release does exactly what the X does (spec D4 and 5.2): leave at once with no answers, otherwise open the sheet; on the result it is "Close results" after the 1000 ms guard; on loading it leaves at once. Below API 34 the same handler gets no progress and commits at once, so the decision and the final frame are pure functions with unit tests (README Review Focus 1). The result screen shows the completed flight path, the ticket with the score block and the comparison with the record, the missed cards with their "Why" rows, and "Play again" and "Choose another route", all with the web's copy and guards.

The task is test first. The decisions (what back and the X do, the sheet's scrim guard, the completed route's marks, the copy and the few code-only numbers) are plain Kotlin with JVM unit tests. The composables are tested on the API 36 emulator with Compose UI tests: the sheet card's texts, live region, fade under reduced motion and text at 200 percent; the back surface's scrub, cancel and instant commit through the activity's `OnBackPressedDispatcher`; the result's comparisons, missed list, guards and text at 200 percent; and the host that ties the round, the sheet, the back gesture and the result together, including the platform sheet's back, Escape and scrim.

**This task was not compiled during drafting.** Nothing in this file was compiled or run while the plan was written. After the review, tasks 1 to 15 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: the JVM tests and, on the API 36 emulator, the instrumented tests. The defects that run found are fixed in this file (README, Drafting record). The Material3 calls were checked against the `material3-android-1.4.0` sources (`ModalBottomSheet`, `ModalBottomSheetProperties`, `rememberModalBottomSheetState`, the sheet's dialog wrapper and scrim), the back calls against `activity-1.13.0` and `activity-compose-1.13.0` (`PredictiveBackHandler`, `BackEventCompat`, `OnBackPressedDispatcher.dispatchOnBackStarted`, `dispatchOnBackProgressed`, `dispatchOnBackCancelled`, `onBackPressed`), and the test rules against `ui-test-junit4-android-1.12.1` (`androidx.compose.ui.test.junit4.v2.createAndroidComposeRule(effectContext)`). If the compiler rejects a line for a reason other than the "Unresolved reference" a red step announces, fix the line in this task's file, keep the behaviour the test states, and never loosen a test.

Builds on: tasks 1 to 13. From the engine (tasks 1 to 6): the round types and reducer, `isDecided`, `leavesSomething`, `summarise`, `compareWithBest` and `Comparison`, `resultCopy`, `missedCards`, `RESULT_ARRIVES_MS`, `SWIPE`, `pad2`, the flight path helpers and `TicketInfo`. From task 8: `Tokens`, `TruthyType`, `TruthyTheme` and `resolvedTheme`. From task 9: nothing directly (the round's saves stay with task 11, see rule 6). From tasks 10 to 13: the buttons, icons, shadow and frame of the design system, the reduced-motion flag, the clocks and the coordinator, the ticket, the flight path drawing pieces, the code-text composable, the Custom Tabs opener and the round screen. Step 1 checks every name this task assumes.

**Files:**
- Modify: `android/Truthy/app/build.gradle.kts` (only if `material3` is not yet a dependency, step 2)
- Create (main, in `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/`): `LeaveResultText.kt`, `LeaveResultConstants.kt`, `RoundBack.kt`, `CompletedMarks.kt`, `LeaveSheet.kt`, `RoundBackSurface.kt`, `ScoreBlock.kt`, `MissedCardsList.kt`, `CompletedFlightPath.kt`, `ResultScreen.kt`, `RoundHost.kt`
- Test (JVM, in `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/`): `TestRounds.kt` (support), `LeaveResultTextTest.kt`, `RoundBackTest.kt`, `LeaveBodyTest.kt`, `CompletedMarksTest.kt`
- Test (instrumented, in `android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/`): `TestRounds.kt` (a copy of the JVM one), `RoundTestSupport.kt` (support), `LeaveSheetCardTest.kt`, `LeaveSheetFadeTest.kt`, `RoundBackSurfaceTest.kt`, `ResultScreenTest.kt`, `RoundHostTest.kt`
- Modify: `android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt`, whose `TopScreen.Round` branch composes `RoundHostRoute` (step 26)

**Interfaces:**

Consumes, engine (package `com.eienmosu.truthy.engine`, fixed by the README and tasks 1 to 6):

```kotlin
data class CardTextEn(val statement: String, val explanation: String); data class CardText(val en: CardTextEn); data class CardSource(val title: String, val url: String)
data class Card(val id: String, val section: String, val text: CardText, val answer: Boolean, val source: CardSource, val difficulty: Int, val appliesTo: String, val conflictGroups: List<String>)
data class Route(val deckId: String, val sectionId: String); enum class Mode { CLASSIC, STREAK, LIVES, TIMED }; enum class Theme { LIGHT, DARK }
enum class Phase { QUESTION, ANSWERED, STAMPED, FINISHED }
data class RoundState(val mode: Mode, val route: Route, val cards: List<Card>, val index: Int, val answers: List<Answered>, val phase: Phase, val abandoned: Boolean, val source: DealSource, val clock: Clock?)
sealed interface RoundEvent { data class Answer(val value: Boolean, val at: Double); data object Next; data class Tick(val now: Double); data object Abandon /* and Visibility */ }
data class StartArgs(val mode: Mode, val route: Route, val pool: List<Card>, val history: Map<String, CardHistory>, val seed: Double)
fun startRound(args: StartArgs): RoundState; fun reduce(state: RoundState, event: RoundEvent): RoundState; fun currentCard(state: RoundState): Card?
fun isDecided(state: RoundState): Boolean; fun summarise(state: RoundState): RoundResult; fun leavesSomething(round: RoundState): Boolean
sealed interface Comparison { data object First; data class NewBest(val previousBest: Int); data class Equal(val best: Int); data class Short(val best: Int, val by: Int) }
fun compareWithBest(score: Int, previousBest: Int?): Comparison
data class LabelledValue(val label: String, val value: String)
class ResultCopy(val fields: List<LabelledValue>, val scoreLabel: String, val unit: String?, val best: (Int) -> String, val ended: String, val endedDetail: String, val label: String, val marks: Int, val ring: Int?)
fun resultCopy(result: RoundResult, modeName: String, dealt: Int, previousBest: Int?): ResultCopy
data class MissedCard(val number: Int, val given: Boolean, val answer: Boolean, val appliesTo: String?, val statement: String, val explanation: String, val source: CardSource)
fun missedCards(answers: List<Answered>): List<MissedCard>
const val RESULT_ARRIVES_MS: Double = 1000.0
val SWIPE: SwipeConstants                      // SWIPE.settleMs == 250.0
fun pad2(n: Int): String
data class Point(val x: Double, val y: Double); fun pointAt(t: Double): Point; fun waypointT(i: Int, n: Int): Double
fun completedScale(cards: Int): Double; fun completedLabel(total: Int, results: List<Boolean>): String
data class TicketInfo(val deckCode: String, val deckName: String, val sectionCode: String, val sectionName: String, val modeLabel: String, val best: Int?)
```

Consumes, design system (task 8, package `com.eienmosu.truthy.design`): `Tokens` (`Colors`, `Space.s2` to `s24`, `Size.maxWidth`, `header`, `touchMin`, `ticketInset`, `Radius.card`, `small`, `Stroke.rule`, `quote`, `stamp`, `Duration.t2`, `t3`, `reducedIn`, `Curves.ease`, `spring`, `Transitions.sheetOpen`, `sheetClose`, `stamp`, `jolt`, `disclosure` as `TransitionSpec(durationMs, delayMs, easing)`, `Native.sheetReducedMs`, plan A's native group), `TruthyType` (`stepTitle`, `body`, `fieldLabel`, `score`, `scoreUnit`, `emphasis`, `monoData`, `monoDataStrong`, `monoCaption`, `listStatement`, `missedAnswer`, `missedExplanation`, `stampBest`), `TruthyColors` (`ink`, `inkMuted`, `rule`, `surfaceRaised`, `scrim`, `correct`, `trueColor`), `TruthyTheme` (the composable and the object with `resolved`, `colors`, `shadows`, `isDark`), `ResolvedTheme`, `fun resolvedTheme(theme: Theme): ResolvedTheme`.

Consumes, from other tasks (the README does not name all of them; these are copied from each task's Produces; step 1 checks each and the report lists them; if a name or a parameter differs, change only the call sites in this task's files and keep the behaviour):

```kotlin
// task 11 (its Produces), package com.eienmosu.truthy
fun interface MonotonicClock { fun nowMs(): Double }          // README
class RoundCoordinator { val ticket: TicketInfo; val state: StateFlow<RoundState>; val sheetOpen: StateFlow<Boolean>
                         fun requestLeave(): Boolean; fun keepPlaying(); fun scrimTapAccepted(): Boolean /* 250 ms from the sheet opening */; suspend fun leave() }
sealed interface TopScreen { data object Start; data class Round(val request: RoundRequest, val load: RoundLoad) }
sealed interface RoundLoad { data object Loading; data object Failed; class Ready(val coordinator: RoundCoordinator) }
class AppViewModel { val screen: StateFlow<TopScreen>
                     fun requestLeave(); fun roundBack(); fun leaveRound(); fun closeResult(): Boolean; fun playAgain(): Boolean }   // task 11 rules 5 and 6 decide; this task only routes
@Composable fun TruthyRoot(app: AppViewModel)                  // app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt, as task 13 left it

// task 10 (its Produces), package com.eienmosu.truthy.design
val LocalReducedMotion: ProvidableCompositionLocal<Boolean>   // provided at the app root by task 12
data class FrameInsets(val top: Dp, val bottom: Dp, val start: Dp, val end: Dp)
@Composable fun rememberFrameInsets(): FrameInsets           // spec 5.6: max(system inset, 52 / 34, or 8 / 12 under 568 tall); sides 16 plus the side inset
@Composable fun TruthyFrame(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit)   // the 430 column padded by rememberFrameInsets(); draws nothing itself
enum class IconId { CLOSE, CROSS, CHECK, BACK_HEADER, BACK_PILL, FORWARD, CHEVRON_RIGHT, CHEVRON_DOWN, PLANE, CLOUD, SKY_CLOUD, BOOK, REPLAY, CLOCK, STAR, HEART, HEART_LOST, MOON, SUN }
@Composable fun TruthyIcon(id: IconId, modifier: Modifier = Modifier, tint: Color = TruthyTheme.colors.ink, width: Dp? = null, strokeWidth: Float? = null, label: String? = null)
@Composable fun RouteIcon(modifier: Modifier = Modifier, width: Dp = RouteIconSpec.WIDTH.dp, tint: Color = TruthyTheme.colors.ink)
@Composable fun TruthyText(text: AnnotatedString, style: TextStyle, color: Color, modifier: Modifier = Modifier, textAlign: TextAlign? = null, maxLines: Int = Int.MAX_VALUE, overflow: TextOverflow = TextOverflow.Clip)
@Composable fun Modifier.truthyShadow(spec: ShadowSpec, cornerRadius: Dp = Tokens.Radius.card, alpha: () -> Float = { 1f }): Modifier
enum class LowerCloud(val top: Float) { GAME(620f), START(660f) }; @Composable fun SkyBackdrop(modifier: Modifier = Modifier, lowerCloud: LowerCloud = LowerCloud.GAME)
@Composable fun Modifier.keyboardFocusRing(shape: Shape, offset: Dp = FocusRingSpec.OFFSET): Modifier
// task 10, package com.eienmosu.truthy.ui
@Composable fun PillButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, tone: PillTone = PillTone.INK, dimmed: Boolean = false, leadingIcon: (@Composable () -> Unit)? = null, trailingIcon: (@Composable () -> Unit)? = null)
@Composable fun QuietButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, leadingIcon: (@Composable () -> Unit)? = null)
@Composable fun RoundButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, variant: RoundVariant = RoundVariant.RAISED, enabled: Boolean = true, content: @Composable () -> Unit)   // label is the contentDescription
object TestTags { const val TICKET: String; const val ROUND_SURFACE: String; const val SHEET_CARD: String /* and the others */ }
// task 12, package com.eienmosu.truthy.start
object FullSpeed : MotionDurationScale                          // a duration scale of 1: the app's one way to keep a fade under reduced motion

// task 13 (its Produces), package com.eienmosu.truthy.round, so no import
data class PassLeg(val code: String, val name: String)
data class PassField(val label: String, val value: String, val spoken: String? = null, val muted: Boolean = false)
enum class PaperTone { RAISED, SUNK }
@Composable fun BoardingPass(from: PassLeg, to: PassLeg, fields: List<PassField>, modifier: Modifier = Modifier, jolt: Boolean = false,
    joltDelayMs: Int = Tokens.Transitions.jolt.delayMs, reduced: Boolean = false, shortLegs: Boolean = false,
    lower: @Composable BoxScope.() -> Unit, body: @Composable ColumnScope.() -> Unit)   // tagged TestTags.TICKET; lower gets at least the height the upper part leaves of the caller's minimum height and grows with its content
@Composable fun PassLower(tone: PaperTone, modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit = {})
@Composable internal fun PathFrame(label: String, progress: AnnotatedString, tally: AnnotatedString?, modifier: Modifier = Modifier, draw: DrawScope.() -> Unit)
internal fun DrawScope.drawRouteLine(flownTo: Double, colors: TruthyColors)
internal fun DrawScope.drawMark(correct: Boolean, at: Point, scale: Double, fresh: Boolean, plain: Boolean, colors: TruthyColors)
fun cardText(text: String): AnnotatedString                    // code parts in Overpass Mono at 0.92 em
@Composable fun rememberSourceOpener(): (String) -> Unit        // Custom Tabs with the app's colours (the app's one opener)
@Composable fun RoundRoute(coordinator: RoundCoordinator, onRequestLeave: () -> Unit, modifier: Modifier = Modifier, sheetOpen: Boolean = false)
@Composable fun RoundLoading(onRequestLeave: () -> Unit, modifier: Modifier = Modifier)
```

Produces (package `com.eienmosu.truthy.round`; task 15 relies on these names):

```kotlin
// LeaveResultText.kt
object LeaveText { const val TITLE; const val OPEN_BODY; const val DECIDED_BODY; const val KEEP_PLAYING; const val LEAVE_ROUND; fun body(decided: Boolean): String }
object ResultText { const val CLOSE_RESULTS; const val HEADING; const val PLAY_AGAIN; const val CHOOSE_ANOTHER_ROUTE; const val FIRST_ROUND; const val NEW_BEST
                    const val EQUALS_BEST; const val MISSED_CARDS; const val NO_MISSED_CARDS; const val WHY; const val ANSWER
                    fun previousBest(best: String): String; fun best(best: String): String; fun shortOfBest(by: Int): String; fun toReview(count: Int): String
                    fun cardCaption(number: Int): String; fun youSaid(given: Boolean): String; fun whyLabel(number: Int): String
                    fun appliesTo(text: String): String; fun sourceLabel(title: String): String; fun tally(correct: Int, wrong: Int): String; fun word(value: Boolean): String }
// LeaveResultConstants.kt
object LeaveResultConstants { ROUND_BACK_MIN_SCALE; STAMP_LANDING_SCALE; STAMP_LANDING_ROTATION; STAMP_REST_ROTATION; JOLT_DISTANCE_DP; JOLT_PEAK_AT
                              WHY_SCROLL_DELAY_MS; WHY_SCROLL_DELAY_REDUCED_MS; WHY_SCROLL_CLEARANCE_DP; SHORT_LEGS_MAX_HEIGHT_DP; RING_STROKE }
// RoundBack.kt (the scale only: what back does is task 11's AppViewModel.roundBack)
fun roundBackScale(progress: Float): Float
suspend fun followRoundBack(progress: Flow<Float>, show: suspend (Float) -> Unit, onCancel: () -> Unit)
// CompletedMarks.kt
data class MarkPlacement(val index: Int, val correct: Boolean, val at: Point, val scale: Double, val plain: Boolean)
data class RingPlacement(val at: Point, val radius: Double)
data class CompletedMarks(val below: List<MarkPlacement>, val ring: RingPlacement?, val above: List<MarkPlacement>)
fun completedMarks(results: List<Boolean>, total: Int, ring: Int?): CompletedMarks
// LeaveSheet.kt
const val SHEET_CARD_TAG = TestTags.SHEET_CARD; val SheetCardAlpha: SemanticsPropertyKey<Float>
const val SCRIM_TAG = "leave.scrim"; val ScrimAlpha: SemanticsPropertyKey<Float>
@Composable fun LeaveSheet(decided: Boolean, scrimTapAccepted: () -> Boolean, onKeepPlaying: () -> Unit, onLeave: () -> Unit)   // composed while the coordinator's sheetOpen is true
@Composable fun LeaveSheetCard(decided: Boolean, hiding: Boolean, onKeepPlaying: () -> Unit, onLeave: () -> Unit, modifier: Modifier = Modifier)
@Composable fun LeaveScrim(visible: Boolean, modifier: Modifier = Modifier)   // the web's 360 ms ease scrim, kept under reduced motion
// RoundBackSurface.kt
const val ROUND_SURFACE_TAG = TestTags.ROUND_SURFACE; val RoundBackScale: SemanticsPropertyKey<Float>
@Composable fun RoundBackSurface(enabled: Boolean, onBack: () -> Unit, modifier: Modifier = Modifier, content: @Composable () -> Unit)
// ScoreBlock.kt, MissedCardsList.kt, CompletedFlightPath.kt, ResultScreen.kt
@Composable fun ScoreBlock(score: Int, copy: ResultCopy, comparison: Comparison, comparisonView: BringIntoViewRequester, modifier: Modifier = Modifier)
@Composable fun NewBestStamp(animate: Boolean, modifier: Modifier = Modifier)
@Composable fun MissedCardsList(missed: List<MissedCard>, openSource: (String) -> Unit, modifier: Modifier = Modifier)
@Composable fun CompletedFlightPath(copy: ResultCopy, results: List<Boolean>, modifier: Modifier = Modifier)
const val MISSED_FADE_TAG = "result.missed.fade"
@Composable fun ResultScreen(round: RoundState, ticket: TicketInfo, shownAt: Double, clock: MonotonicClock, onClose: () -> Unit, onPlayAgain: () -> Unit,
                             onHome: () -> Unit, openSource: (String) -> Unit, modifier: Modifier = Modifier)
// RoundHost.kt
interface RoundHostActions { fun requestLeave(); fun roundBack(); fun keepPlaying(); fun scrimTapAccepted(): Boolean; fun leaveRound(); fun closeResult(); fun playAgain() }
@Composable fun RoundHost(round: RoundState?, ticket: TicketInfo?, sheetOpen: Boolean, clock: MonotonicClock, actions: RoundHostActions, modifier: Modifier = Modifier,
                          openSource: (String) -> Unit = rememberSourceOpener(), content: @Composable (requestClose: () -> Unit) -> Unit)
@Composable fun RoundHostRoute(app: AppViewModel, load: RoundLoad, modifier: Modifier = Modifier)   // the host on task 11's coordinator and actions, for TruthyRoot
```

**Rules:**

1. **One owner for the X, Escape and back: task 11** (spec D4 and 5.2, reference 4.2, task 11 rules 5 and 6). The host decides nothing; it routes. The X and Escape (task 13's `onRequestLeave`) call `AppViewModel.requestLeave()`, back calls `roundBack()`, "Leave round" calls `leaveRound()`, "Close results" and "Choose another route" call `closeResult()`, "Play again" calls `playAgain()`, and every way the sheet is dismissed (Keep playing, a swipe down, a scrim tap, back, Escape) calls the coordinator's `keepPlaying()`. Whether the sheet is open is the coordinator's `sheetOpen`, so its answer guard and its held live regions see the sheet, and task 11 decides the rest: no answers leaves at once, a round with answers opens the sheet, the result closes only after its 1000 ms, loading leaves at once. `RoundHostActions` is that routing, so the host is tested with a fake and the app passes task 11's objects (`RoundHostRoute`).
2. **Back on the round** (`RoundBackSurface`): `PredictiveBackHandler` on the whole round surface, enabled while the sheet is closed. Each progress event sets the scale to `roundBackScale(p) = 1 - 0.06 p` (pivot at the centre); a cancel springs back to 1 over `Tokens.Duration.t3` on `Tokens.Curves.spring`; a commit calls `roundBack()` (rule 1) and then springs back to 1 (the surface stays visible behind the sheet). Below API 34 there are no progress events, the flow completes at once, the scale never leaves 1 and `roundBack()` runs: that is the instant commit of spec 5.1, tested at fixed values in `RoundBackTest` and on the device in `RoundBackSurfaceTest`. The handler is the only back handler of the round: step 26 removes any other one task 13 may have composed inside the round, because the handler composed last wins.
3. **The sheet** (spec 5.4): Material3 `ModalBottomSheet` with `skipPartiallyExpanded = true`, `containerColor` transparent, `RectangleShape`, `tonalElevation` 0, no drag handle, `sheetMaxWidth = Tokens.Size.maxWidth`, `scrimColor` transparent (rule 5 draws the scrim), no content insets (the card pads itself with `rememberFrameInsets()`), and `ModalBottomSheetProperties(isAppearanceLightStatusBars = !isDark, isAppearanceLightNavigationBars = !isDark)` so the sheet's own window takes its bar icons from the app's theme. Inside, the web's card: `surfaceRaised`, padding 20, radius 16, the `sheet` shadow, 12 above it, the side gutter and the safe bottom; "Leave round?" in `stepTitle` (a heading), the body in `body` 8 below it (a polite live region, so the decided text is announced when it changes while the sheet is open and not when the sheet opens, as the web's status does), then 20 below "Keep playing" (pill, focused when the sheet opens) and "Leave round" (quiet) 4 apart. The card scrolls inside the sheet when it is taller than the window.
4. **Every way out but "Leave round" keeps playing.** A swipe down and a scrim tap end in Material's `onDismissRequest`; back on the sheet is the sheet's own `BackHandler` (`shouldDismissOnBackPress = false`); Escape is handled on the sheet's focusable root (a held key acts once), which takes focus when Keep playing cannot (in touch mode), because with predictive back on, a dialog no longer turns Escape into back. Each ends in the coordinator's `keepPlaying()`. Material3 1.4.0's `SheetState.hide()` asks `confirmValueChange(Hidden)` too, so a close the card asked for (`closing`) is let through without asking the guard. The web ignores a scrim tap for 250 ms after the sheet opened. Following spec 5.4, the sheet consults the coordinator's `scrimTapAccepted()` (task 11 owns the guard and its clock) only if task 15's `aDoubleTapOnTheXLeavesTheSheetOpen` fails; until then `RoundHost` answers `true`. Back, Escape and Keep playing never wait. (On Android the second tap of a double tap on the X lands on the X itself, before the sheet's window is up; task 11's `requestLeave` treats that tap as the web's tap on the scrim that covers the X.)
5. **Motion of the sheet.** The sheet slides in and out with the platform's own motion: Material3 1.4.0 reads it from `MaterialTheme.motionScheme`, whose `MotionScheme` type is internal in that version, so it cannot be set to the web's 24 px and 360 ms; that difference is sheet chrome under spec criterion 2 and goes to the owner's review pairs in task 15. The card adds the web's fade: opacity 0 to 1 over `Transitions.sheetOpen` (360 ms `ease`) and back over `Transitions.sheetClose`, and with reduced motion over `Tokens.Native.sheetReducedMs` (140 ms, plan A's native group) in both directions. The scrim is the web's too (reference 5.0 and 5.8): Material's own scrim is transparent (its window still takes the taps and calls `onDismissRequest`), and `LeaveScrim`, drawn by the host in the activity's window under the sheet's window, fades the theme's `scrim` over `Transitions.sheetOpen` in and `sheetClose` out, also under reduced motion. Both fades run inside task 12's `FullSpeed`, a `MotionDurationScale` of 1, so they still play when the animator scale is 0 (README Review Focus 4).
6. **The result does not write.** Task 9 hands recording to task 11: when the round is finished the coordinator records it once with `store.update`, marks and clears the journal. The result screen computes what it shows from the round and from `ticket.best`, the record for this route and class when the round was dealt (the web's `useRound` takes `ticket.best` from the same progress the comparison reads), so the comparison is on screen in the first frame and does not change once the record is written.
7. **The result's guards.** "Play again" and "Choose another route" ignore presses until 1000 ms after the result appeared (`RESULT_ARRIVES_MS`, monotonic clock), counted from the first frame of the result, kept by the host; "Close results" and back go to task 11 (rule 1), whose controller applies the same 1000 from the moment the result was recorded. The two guards measure the same moment, so the later of them is the one a player meets.
8. **The result's layout.** The header (56 minimum) holds "Close results" and the completed flight path 12 apart; 12 below, the stage holds the ticket, at least as tall as the stage, with its lower part taking the extra height (task 13's `BoardingPass` measures the upper part first and gives the lower part at least the height left, never less than its content, so the missed list is never laid out 0 tall when the upper part is taller than the stage); 12 below, "Play again" and "Choose another route" 4 apart. The stage scrolls as one column with the platform's stretch overscroll. The missed list does not scroll inside the ticket as the web's does on tall screens: on a phone one scroll is the native behaviour. The web's bottom fade cue stays (spec 5.6, reference 5.0): while more of the stage lies below and the ticket's lower part reaches the stage's foot, a 28 (`FADE_PX`) gradient from `surfaceSunkClear` to `surfaceSunk` covers the foot (`MISSED_FADE_TAG`); at the end of the scroll it is gone. With the missed cards fitting (most rounds) the ticket's frame is the web's; with a long list the ticket grows and the stage scrolls, a difference for the owner's review pairs. The leg names hide at a window height of 600 or less (`shortLegs`).
9. **Text never clips.** Every fixed height is a minimum (`heightIn`); no text sets `maxLines`; "New best" and the score's unit may wrap rather than clip (the web keeps them on one line, but spec 5.6 wins); the score row stacks the comparison under the score when the New best stamp does not fit beside it, as the web does.
10. **No literal design values in composables.** Colours, sizes, durations and curves come from `Tokens`, `TruthyType` and `TruthyTheme`. The few numbers that live only in the web's code or in the spec (the 0.94 back scale, the stamp's landing pose, the jolt, the Why scroll delay, the 600 short-legs height, the ring's stroke) are in `LeaveResultConstants`, and a unit test pins each one to the text of the web file or the spec it comes from. Every string is in `LeaveText` and `ResultText`, pinned the same way against the web components (reference 4.5; the source link label "{title} (opens in browser)" against spec 5.6).
11. **Accessibility.** The sheet's title is a heading and its body a polite live region. The result's stage carries the "Round complete" heading and takes focus when the result appears; with a New best the comparison is brought into view first. The completed route is one image labelled `copy.label`. "Why, card nn" exposes expand and collapse actions; an opened Why scrolls into view after 380 ms (50 with reduced motion), 16 clear of the list's foot; the source link's label is "{title} (opens in browser)". The applies-to line reads "Applies to {text}". The answer row reads as one.
12. **Not in this task:** holding the play screen's announcements while the sheet is open (`SPOKEN_RELEASE_MS`) belongs to task 13's announcer; the stories with a real coordinator (double tap on the X, the Timed clock running under the sheet, the API 26, 33 and 34 recordings) are task 15's.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
cd android/Truthy
ls app/src/main/kotlin/com/eienmosu/truthy app/src/main/java/com/eienmosu/truthy 2>/dev/null
grep -n 'material3\|serialization\|ui.test\|androidTest' app/build.gradle.kts
grep -rhn 'fun interface MonotonicClock\|class RoundCoordinator\|suspend fun leave\|val state: StateFlow<RoundState>\|val sheetOpen\|fun keepPlaying\|fun scrimTapAccepted\|sealed interface RoundLoad\|fun roundBack\|fun leaveRound\|fun closeResult\|fun playAgain' app/src/main
grep -rhn 'val LocalReducedMotion\|fun rememberFrameInsets\|fun TruthyFrame\|fun PillButton\|fun QuietButton\|fun RoundButton\|fun TruthyIcon(\|fun RouteIcon\|fun TruthyText\|fun Modifier.truthyShadow\|fun SkyBackdrop\|fun Modifier.keyboardFocusRing\|object TestTags\|object FullSpeed' app/src/main
grep -rhn 'class PassLeg\|class PassField\|fun BoardingPass\|fun PassLower\|fun PathFrame\|fun DrawScope.drawRouteLine\|fun DrawScope.drawMark\|fun cardText\|fun rememberSourceOpener\|fun RoundRoute\|fun RoundLoading' app/src/main
grep -rln 'BackHandler\|PredictiveBackHandler' app/src/main
grep -rln 'applyResult\|RoundRecorder\|recordRound' app/src/main
grep -rn '^package' app/src/main/kotlin/com/eienmosu/truthy/round 2>/dev/null | head -3
```

Expected:
- the `kotlin` source folder exists (tasks 8 and 9 write there; task 7's files may sit under `java`, both are compiled);
- the build file shows the compose plugin, the androidTest lines of task 7 (`ui-test-junit4`, `ext-junit`, `runner`) and `debugImplementation` of `ui-test-manifest`; `material3` may be missing (step 2 adds it);
- task 11's names: `fun interface MonotonicClock`, `class RoundCoordinator` with its `state` and `sheetOpen` flows, `keepPlaying`, `scrimTapAccepted` and `suspend fun leave()`, `sealed interface RoundLoad`, and the controller's `roundBack`, `leaveRound`, `closeResult` and `playAgain`;
- one line for each name of tasks 10 and 12 and one for each of task 13 listed under "Interfaces" (`fun rememberSourceOpener` exactly once, in task 13's `SourceLink.kt`);
- the files with a back handler: task 12's start flow file, and no file of the round (if a round file of task 13 registers one, step 21 removes it);
- a file of task 11 that calls `recordRound` (or `applyResult` or `RoundRecorder`): the coordinator records the finished round (rule 6);
- task 13's round files declare `package com.eienmosu.truthy.round`.

Stop and fix before going on if: a name is missing (finish the task that owns it first), or a name exists with another spelling or parameter list (use the real one at the call sites of this task, which are listed in each step, and note it in the commit message), or no file records the finished round (rule 6 then needs task 11 to record on finish; do not add a write here), or task 13's package differs (add `import` lines for its names in the files of steps 15, 18, 21 and 24).

- [ ] **Step 2: Add Material3 to the app if it is not there.**

```bash
cd android/Truthy
grep -q 'libs.androidx.compose.material3' app/build.gradle.kts || perl -0pi -e 's/^(    implementation\(libs\.androidx\.compose\.foundation\)\n)/$1    implementation(libs.androidx.compose.material3)\n/m' app/build.gradle.kts
grep -n 'compose.material3' app/build.gradle.kts
./gradlew :app:assembleDebug
```

Expected: one line `    implementation(libs.androidx.compose.material3)` (the catalog alias exists since task 1, version from the Compose BOM, Material3 1.4.0), then `BUILD SUCCESSFUL`. Task 12 step 2 already adds it, so the `grep -q` usually skips the edit. If `perl` added nothing because the foundation line is written differently, add the line by hand under the other `implementation(libs.androidx.compose...)` lines. (BSD `sed` on macOS writes a `\n` in a replacement as a literal `n`, which is why this step uses `perl`.)

- [ ] **Step 3: Write the copy and constants test and watch it fail.** It pins every string of the sheet and the result to the web's components and every code-only number to its source.

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/LeaveResultTextTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.RepoFiles
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LeaveResultTextTest {
    private fun web(path: String): String = RepoFiles.root.resolve(path).readText()

    private fun assertIn(source: String, path: String, vararg texts: String) {
        for (text in texts) assertTrue("'$text' is not in $path", source.contains(text))
    }

    // JavaScript prints 2 for 2.0 and 1.9 for 1.9.
    private fun js(value: Float): String = if (value == value.toInt().toFloat()) value.toInt().toString() else value.toString()

    @Test
    fun leaveSheetSaysWhatLeaveDialogSays() {
        val path = "components/play/LeaveDialog.tsx"
        assertIn(web(path), path, LeaveText.TITLE, LeaveText.OPEN_BODY, LeaveText.DECIDED_BODY, LeaveText.KEEP_PLAYING, LeaveText.LEAVE_ROUND)
        assertEquals("Leave round?", LeaveText.TITLE)
        assertEquals(LeaveText.OPEN_BODY, LeaveText.body(decided = false))
        assertEquals(LeaveText.DECIDED_BODY, LeaveText.body(decided = true))
    }

    @Test
    fun resultSaysWhatResultViewScoreBlockAndMissedCardsSay() {
        val view = "components/play/ResultView.tsx"
        assertIn(web(view), view, ResultText.CLOSE_RESULTS, ResultText.HEADING, ResultText.PLAY_AGAIN, ResultText.CHOOSE_ANOTHER_ROUTE)
        val score = "components/ScoreBlock.tsx"
        assertIn(web(score), score, ResultText.FIRST_ROUND, ResultText.NEW_BEST, ResultText.EQUALS_BEST, "Previous best {best(", "Best {best(", "} short of your best")
        val missed = "components/MissedCards.tsx"
        assertIn(
            web(missed), missed,
            ResultText.MISSED_CARDS, ResultText.NO_MISSED_CARDS, ResultText.WHY, ResultText.ANSWER,
            "{missed.length} to review", "Card {number}", "You said {word(item.given)}", "`Why, card \${number}`", "`Applies to \${item.appliesTo}`",
        )
    }

    @Test
    fun formattedCopyReadsAsTheWebWritesIt() {
        assertEquals("Previous best 9 / 10", ResultText.previousBest("9 / 10"))
        assertEquals("Best 21 cards", ResultText.best("21 cards"))
        assertEquals("2 short of your best", ResultText.shortOfBest(2))
        assertEquals("3 to review", ResultText.toReview(3))
        assertEquals("Card 03", ResultText.cardCaption(3))
        assertEquals("Card 12", ResultText.cardCaption(12))
        assertEquals("You said True", ResultText.youSaid(true))
        assertEquals("You said False", ResultText.youSaid(false))
        assertEquals("Why, card 07", ResultText.whyLabel(7))
        assertEquals("Applies to Kubernetes 1.33", ResultText.appliesTo("Kubernetes 1.33"))
        assertEquals("7 correct · 3 wrong", ResultText.tally(7, 3))
        assertEquals("True", ResultText.word(true))
        assertEquals("False", ResultText.word(false))
    }

    @Test
    fun sourceLinkLabelIsTheSpecsNativeLabel() {
        val path = "docs/superpowers/specs/2026-10-14-truthy-native-apps-design.md"
        assertIn(web(path), path, "\"{source.title} (opens in browser)\"")
        assertEquals("AWS Shared Responsibility Model (opens in browser)", ResultText.sourceLabel("AWS Shared Responsibility Model"))
    }

    @Test
    fun codeOnlyNumbersArePinnedToTheirSources() {
        val c = LeaveResultConstants
        val spec = "docs/superpowers/specs/2026-10-14-truthy-native-apps-design.md"
        assertIn(web(spec), spec, "from scale 1 to ${js(c.ROUND_BACK_MIN_SCALE)}")
        val easing = "components/easing.ts"
        assertIn(
            web(easing), easing,
            "STAMP_LANDING = { opacity: 0, scale: ${js(c.STAMP_LANDING_SCALE)}, rotate: ${js(c.STAMP_LANDING_ROTATION)} }",
            "STAMP_REST = { opacity: 1, scale: 1, rotate: ${js(c.STAMP_REST_ROTATION)} }",
        )
        val pass = "components/BoardingPass.tsx"
        assertIn(web(pass), pass, "y: [0, ${js(c.JOLT_DISTANCE_DP)}, 0]", "times: [0, ${js(c.JOLT_PEAK_AT)}, 1]", "max-height:${js(c.SHORT_LEGS_MAX_HEIGHT_DP)}px")
        val missed = "components/MissedCards.tsx"
        assertIn(web(missed), missed, "reduced ? ${c.WHY_SCROLL_DELAY_REDUCED_MS} : ${c.WHY_SCROLL_DELAY_MS}", "+ ${js(c.WHY_SCROLL_CLEARANCE_DP)} -")
        val path = "components/FlightPath.tsx"
        assertIn(web(path), path, "strokeWidth=\"${js(c.RING_STROKE)}\"")
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.round.LeaveResultTextTest'
```

Expected: FAIL at `:app:compileDebugUnitTestKotlin` with `Unresolved reference 'LeaveText'`, `'ResultText'` and `'LeaveResultConstants'`, then `BUILD FAILED`.

- [ ] **Step 4: Write the copy and the constants and run the test green.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/LeaveResultText.kt`:

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.pad2

// Every string of the leave sheet and the result screen, verbatim from reference 4.5: the web's LeaveDialog.tsx,
// ResultView.tsx, ScoreBlock.tsx and MissedCards.tsx, and the native source link label of spec 5.6.

object LeaveText {
    const val TITLE = "Leave round?"
    const val OPEN_BODY = "Your answers so far stay in your history. This round won't count toward your best."
    const val DECIDED_BODY = "This round is over and its score is kept. Leaving skips its result."
    const val KEEP_PLAYING = "Keep playing"
    const val LEAVE_ROUND = "Leave round"

    /** Before the round is decided its answers are kept without a record; once decided, leaving records its score. */
    fun body(decided: Boolean): String = if (decided) DECIDED_BODY else OPEN_BODY
}

object ResultText {
    const val CLOSE_RESULTS = "Close results"
    const val HEADING = "Round complete"
    const val PLAY_AGAIN = "Play again"
    const val CHOOSE_ANOTHER_ROUTE = "Choose another route"
    const val FIRST_ROUND = "First round on this route"
    const val NEW_BEST = "New best"
    const val EQUALS_BEST = "Equals your best"
    const val MISSED_CARDS = "Missed cards"
    const val NO_MISSED_CARDS = "No missed cards"
    const val WHY = "Why"
    const val ANSWER = "Answer"

    fun previousBest(best: String): String = "Previous best $best"
    fun best(best: String): String = "Best $best"
    fun shortOfBest(by: Int): String = "$by short of your best"
    fun toReview(count: Int): String = "$count to review"
    fun cardCaption(number: Int): String = "Card ${pad2(number)}"
    fun youSaid(given: Boolean): String = "You said ${word(given)}"
    fun whyLabel(number: Int): String = "Why, card ${pad2(number)}"
    fun appliesTo(text: String): String = "Applies to $text"
    fun sourceLabel(title: String): String = "$title (opens in browser)"
    fun tally(correct: Int, wrong: Int): String = "$correct correct · $wrong wrong"
    fun word(value: Boolean): String = if (value) "True" else "False"
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/LeaveResultConstants.kt`:

```kotlin
package com.eienmosu.truthy.round

/**
 * The numbers of the leave sheet, the round's back gesture and the result that live in the web's code or in the
 * spec rather than in tokens.json. Composables read them from here; LeaveResultTextTest pins each to its source.
 */
object LeaveResultConstants {
    /** Spec 5.2: back on the round shrinks the surface from scale 1 to 0.94 with the gesture's progress. */
    const val ROUND_BACK_MIN_SCALE = 0.94f

    /** components/easing.ts STAMP_LANDING and STAMP_REST: the New best stamp lands from scale 1.9 at -14 degrees to 1 at -6. */
    const val STAMP_LANDING_SCALE = 1.9f
    const val STAMP_LANDING_ROTATION = -14f
    const val STAMP_REST_ROTATION = -6f

    /** components/BoardingPass.tsx JOLT: the ticket moves y 0, 2, 0 at the times 0, 0.4 and 1 of its duration. */
    const val JOLT_DISTANCE_DP = 2f
    const val JOLT_PEAK_AT = 0.4f

    /** components/MissedCards.tsx: an opened Why scrolls into view after 380 ms (50 with reduced motion), 16 clear of the foot. */
    const val WHY_SCROLL_DELAY_MS = 380L
    const val WHY_SCROLL_DELAY_REDUCED_MS = 50L
    const val WHY_SCROLL_CLEARANCE_DP = 16f

    /** components/BoardingPass.tsx shortLegs: the leg names hide at a window height of 600 or less. */
    const val SHORT_LEGS_MAX_HEIGHT_DP = 600f

    /** components/FlightPath.tsx CompletedMarks: the stroke of the Streak ring, in the 276 by 34 drawing's units. */
    const val RING_STROKE = 1.4f
}
```

Run the command of step 3. Expected: `BUILD SUCCESSFUL`, and

```bash
grep -o 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.round.LeaveResultTextTest.xml
```

prints `tests="5" skipped="0" failures="0" errors="0"`.

- [ ] **Step 5: Commit.**

```bash
git add android/Truthy/app/build.gradle.kts android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/LeaveResultText.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/LeaveResultConstants.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/LeaveResultTextTest.kt
git commit -m "feat: add the leave sheet and result copy for Android, pinned to the web"
```

Expected: one commit (if step 2 changed nothing, `git add` of the build file adds nothing and the commit still holds the three new files).

- [ ] **Step 6: Write the round fixtures and the back scale test, and watch it fail.** The fixtures build real rounds with the engine; the test pins the back scale and the gesture's follow, including the instant commit below API 34 (a progress flow with no events). What the X and back decide is task 11's (rule 1) and is tested there.

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/TestRounds.kt`:

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.CardSource
import com.eienmosu.truthy.engine.CardText
import com.eienmosu.truthy.engine.CardTextEn
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.StartArgs
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.reduce
import com.eienmosu.truthy.engine.startRound

/** Rounds played through the engine, for the tests of the leave sheet, the back decision and the result. */
object TestRounds {
    val ROUTE = Route(deckId = "test-deck", sectionId = "SEC")

    fun card(n: Int, answer: Boolean = n % 2 == 0, appliesTo: String = ""): Card = Card(
        id = "test-deck-$n",
        section = "SEC",
        text = CardText(en = CardTextEn(statement = "Statement $n", explanation = "Explanation $n")),
        answer = answer,
        source = CardSource(title = "Source $n", url = "https://example.com/source-$n"),
        difficulty = 1,
        appliesTo = appliesTo,
        conflictGroups = emptyList(),
    )

    fun start(mode: Mode, size: Int = 10): RoundState =
        startRound(StartArgs(mode = mode, route = ROUTE, pool = (1..size).map { card(it) }, history = emptyMap(), seed = 1.0))

    /** Answers `answers` cards, wrongly at the 0-based places in `wrong`, one second apart; `finish` also sends Next after the last. */
    fun play(start: RoundState, wrong: Set<Int>, answers: Int, finish: Boolean): RoundState {
        var state = start
        for (i in 0 until answers) {
            val card = requireNotNull(currentCard(state)) { "no card for answer $i" }
            state = reduce(state, RoundEvent.Answer(value = if (i in wrong) !card.answer else card.answer, at = 1_000.0 * (i + 1)))
            if (i < answers - 1 || finish) state = reduce(state, RoundEvent.Next)
        }
        return state
    }

    /** A Classic round of 10: wrong at cards 3, 6 and 10 by default (score 7), finished unless `finish` is false. */
    fun classic(wrong: Set<Int> = setOf(2, 5, 9), answers: Int = 10, finish: Boolean = true): RoundState =
        play(start(Mode.CLASSIC), wrong, answers, finish)

    /** A Streak round ended by its second answer (decided), its result not opened yet. */
    fun streakEndedUnopened(): RoundState = play(start(Mode.STREAK), wrong = setOf(1), answers = 2, finish = false)

    /** A Timed round whose minute ran out with nothing answered: decided, no answers. */
    fun timedRunOut(): RoundState {
        var state = reduce(start(Mode.TIMED), RoundEvent.Tick(now = 0.0))
        for (second in 1..60) state = reduce(state, RoundEvent.Tick(now = 1_000.0 * second))
        return state
    }

    fun ticket(best: Int?): TicketInfo = TicketInfo(
        deckCode = "TST",
        deckName = "Test deck",
        sectionCode = "SEC",
        sectionName = "Security",
        modeLabel = "Classic",
        best = best,
    )
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/RoundBackTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RoundBackTest {
    @Test
    fun scaleFollowsTheProgressFromOneToNinetyFourHundredths() {
        assertEquals(1f, roundBackScale(0f), 1e-6f)
        assertEquals(0.985f, roundBackScale(0.25f), 1e-6f)
        assertEquals(0.97f, roundBackScale(0.5f), 1e-6f)
        assertEquals(0.94f, roundBackScale(1f), 1e-6f)
        assertEquals(1f, roundBackScale(-0.5f), 1e-6f)
        assertEquals(0.94f, roundBackScale(1.5f), 1e-6f)
        assertEquals(1f, roundBackScale(Float.NaN), 1e-6f)
    }

    @Test
    fun aBackWithNoProgressEventsCommitsAtOnceWithTheSurfaceAtRest() {
        val shown = mutableListOf<Float>()
        var cancelled = false
        runBlocking { followRoundBack(emptyFlow(), show = { shown += it }, onCancel = { cancelled = true }) }
        assertTrue(shown.isEmpty())
        assertFalse(cancelled)
    }

    @Test
    fun aScrubbedBackShowsEachScaleThenCommits() {
        val shown = mutableListOf<Float>()
        runBlocking { followRoundBack(flowOf(0.25f, 0.5f, 1f), show = { shown += it }, onCancel = {}) }
        assertEquals(listOf(0.985, 0.97, 0.94), shown.map { it.toDouble() }.map { Math.round(it * 1000) / 1000.0 })
    }

    @Test
    fun aCancelledBackSpringsBackAndDoesNotCommit() {
        val shown = mutableListOf<Float>()
        var cancelled = false
        var thrown: Throwable? = null
        runBlocking {
            try {
                followRoundBack(
                    flow {
                        emit(0.5f)
                        throw CancellationException("gesture cancelled")
                    },
                    show = { shown += it },
                    onCancel = { cancelled = true },
                )
            } catch (e: CancellationException) {
                thrown = e
            }
        }
        assertNotNull(thrown)
        assertTrue(cancelled)
        assertEquals(1, shown.size)
        assertEquals(0.97f, shown[0], 1e-6f)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.round.RoundBackTest'
```

Expected: FAIL at `:app:compileDebugUnitTestKotlin` with `Unresolved reference 'roundBackScale'` and `'followRoundBack'`, then `BUILD FAILED`.

- [ ] **Step 7: Write `RoundBack.kt` and run the test green.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundBack.kt`:

```kotlin
package com.eienmosu.truthy.round

import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.flow.Flow

/** The round surface's scale at back progress p (spec 5.2): 1 at rest, 0.94 at the end, clamped. */
fun roundBackScale(progress: Float): Float {
    val p = if (progress.isNaN()) 0f else progress.coerceIn(0f, 1f)
    return 1f - (1f - LeaveResultConstants.ROUND_BACK_MIN_SCALE) * p
}

// What the X, Escape and back do is task 11's (AppController.requestLeave and roundBack, rule 1); this file only
// turns the system's back progress into the round surface's scale.

/**
 * Follows one back gesture: every progress value becomes a scale for `show`. Returning normally is a commit (below
 * API 34 the flow ends at once with no value, so the surface never leaves 1); a cancelled gesture calls `onCancel`
 * and rethrows, as PredictiveBackHandler requires.
 */
suspend fun followRoundBack(progress: Flow<Float>, show: suspend (Float) -> Unit, onCancel: () -> Unit) {
    try {
        progress.collect { show(roundBackScale(it)) }
    } catch (cancelled: CancellationException) {
        onCancel()
        throw cancelled
    }
}
```

Run the command of step 6. Expected: `BUILD SUCCESSFUL`; the `grep` of step 4 on `TEST-com.eienmosu.truthy.round.RoundBackTest.xml` prints `tests="4" skipped="0" failures="0" errors="0"`.

- [ ] **Step 8: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundBack.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/TestRounds.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/RoundBackTest.kt
git commit -m "feat: scale the Android round with the back gesture's progress"
```

- [ ] **Step 9: Pin the sheet's body to whether the round is decided.** The sheet keeps no state of its own: it is open while task 11's coordinator says so (`sheetOpen`), its scrim guard is the host's `scrimTapAccepted()` (`true` unless task 15 finds the coordinator's guard needed, rule 4) and its dismissals call `keepPlaying()` (rules 1 and 4). What this task decides is only which body the card says.

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/LeaveBodyTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.isDecided
import org.junit.Assert.assertEquals
import org.junit.Test

class LeaveBodyTest {
    @Test
    fun theBodyFollowsWhetherTheRoundIsDecided() {
        assertEquals(LeaveText.OPEN_BODY, LeaveText.body(isDecided(TestRounds.classic(answers = 2, finish = false))))
        assertEquals(LeaveText.DECIDED_BODY, LeaveText.body(isDecided(TestRounds.streakEndedUnopened())))
    }
}
```

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.round.LeaveBodyTest'
cd ../..
git add android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/LeaveBodyTest.kt
git commit -m "test: pin the Android leave sheet's body to a decided round"
```

Expected: `BUILD SUCCESSFUL` (`LeaveText` exists since step 4) and the `grep` of step 4 on `TEST-com.eienmosu.truthy.round.LeaveBodyTest.xml` prints `tests="1" skipped="0" failures="0" errors="0"`; one commit.

- [ ] **Step 10: Write the completed route test and watch it fail.** The values were computed with the web's `CompletedMarks` code (`components/FlightPath.tsx`) while drafting.

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/CompletedMarksTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Point
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CompletedMarksTest {
    @Test
    fun tenCardsDrawEveryMarkAtFullSizeWithTheRingThreeAndAHalfOutside() {
        val results = listOf(true, false, true, true, false, true, true, true, true, false)
        val marks = completedMarks(results, total = 10, ring = 4)
        assertEquals((0..9).toList(), marks.below.map { it.index })
        assertTrue(marks.above.isEmpty())
        assertTrue(marks.below.all { it.scale == 1.0 && !it.plain })
        assertEquals(results, marks.below.map { it.correct })
        assertEquals(RingPlacement(at = Point(123.33, 9.19), radius = 10.5), marks.ring)
    }

    @Test
    fun aLongRouteDrawsCorrectMarksPlainAndLiftsTheWrongOnesAboveTheRing() {
        val results = List(30) { it % 7 != 3 }
        val marks = completedMarks(results, total = 30, ring = 12)
        assertEquals(listOf(3, 10, 17, 24), marks.above.map { it.index })
        assertEquals(26, marks.below.size)
        assertTrue(marks.below.all { it.correct && it.plain && it.scale == 0.4551724137931034 })
        assertTrue(marks.above.all { !it.correct && !it.plain && it.scale == 0.46153846153846156 })
        assertEquals(RingPlacement(at = Point(115.24, 9.45), radius = 4.55), marks.ring)
    }

    @Test
    fun marksFollowTheDealtCountNotTheAnswers() {
        val marks = completedMarks(listOf(true, true, false), total = 12, ring = 1)
        assertEquals(3, marks.below.size)
        assertTrue(marks.below.all { it.scale == 6.0 / 7.0 })
        assertEquals(RingPlacement(at = Point(30.0, 19.04), radius = 9.5), marks.ring)
    }

    @Test
    fun aRingOutsideTheRouteIsNotDrawnAndASingleCardRingsAtTheStart() {
        assertNull(completedMarks(listOf(true, true, true), total = 3, ring = 5).ring)
        assertNull(completedMarks(listOf(true, true, true), total = 3, ring = -1).ring)
        assertNull(completedMarks(listOf(true, true, true), total = 3, ring = null).ring)
        assertEquals(RingPlacement(at = Point(6.0, 24.0), radius = 10.5), completedMarks(listOf(false), total = 1, ring = 0).ring)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.round.CompletedMarksTest'
```

Expected: FAIL at `:app:compileDebugUnitTestKotlin` with `Unresolved reference 'completedMarks'` and `'RingPlacement'`, then `BUILD FAILED`.

- [ ] **Step 11: Write `CompletedMarks.kt` and run the test green.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/CompletedMarks.kt`:

```kotlin
package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Point
import com.eienmosu.truthy.engine.completedScale
import com.eienmosu.truthy.engine.pointAt
import com.eienmosu.truthy.engine.waypointT
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** One mark of a completed route, in the 276 by 34 drawing's units. */
data class MarkPlacement(val index: Int, val correct: Boolean, val at: Point, val scale: Double, val plain: Boolean)

/** The Streak ring where the previous best was reached. */
data class RingPlacement(val at: Point, val radius: Double)

/** Drawn in order: `below`, then the ring, then `above` (wrong squares enlarged past their neighbours). */
data class CompletedMarks(val below: List<MarkPlacement>, val ring: RingPlacement?, val above: List<MarkPlacement>)

// The geometry of components/FlightPath.tsx CompletedMarks: a mark is a circle of radius 7 or a square of 13 at
// scale 1; a correct mark under radius 5 loses its tick; a wrong square keeps a side of at least 6; the route is 264
// long; the ring sits 3.5 outside its dot while that leaves it clear of the next one.
private const val MARK_RADIUS = 7.0
private const val PLAIN_BELOW_RADIUS = 5.0
private const val WRONG_MIN_SCALE = 6.0 / 13.0
private const val ROUTE_LENGTH = 264.0
private const val RING_GAP = 3.5

fun completedMarks(results: List<Boolean>, total: Int, ring: Int?): CompletedMarks {
    val scale = completedScale(total)
    val plainCorrect = MARK_RADIUS * scale < PLAIN_BELOW_RADIUS
    val wrongScale = max(scale, WRONG_MIN_SCALE)
    val lifted = wrongScale > scale
    val marks = results.take(total).mapIndexed { i, correct ->
        MarkPlacement(
            index = i,
            correct = correct,
            at = pointAt(waypointT(i, total)),
            scale = if (correct) scale else wrongScale,
            plain = if (correct) plainCorrect else false,
        )
    }
    val below = if (lifted) marks.filter { it.correct } else marks
    val above = if (lifted) marks.filter { !it.correct } else emptyList()
    val ringAt = if (ring == null || ring < 0 || ring >= total) null else pointAt(waypointT(ring, total))
    val gap = if (total <= 1) Double.POSITIVE_INFINITY else ROUTE_LENGTH / (total - 1)
    val ringOffset = min(RING_GAP, (gap - 2 * MARK_RADIUS * scale) / 2)
    return CompletedMarks(
        below = below,
        ring = ringAt?.let { RingPlacement(at = it, radius = round2(MARK_RADIUS * scale + ringOffset)) },
        above = above,
    )
}

// JavaScript's Math.round(value * 100) / 100: floor(x + 0.5), not Kotlin's half-to-even rounding.
private fun round2(value: Double): Double = floor(value * 100 + 0.5) / 100
```

Run the command of step 10. Expected: `BUILD SUCCESSFUL`; the `grep` of step 4 on `TEST-com.eienmosu.truthy.round.CompletedMarksTest.xml` prints `tests="4" skipped="0" failures="0" errors="0"`.

- [ ] **Step 12: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/CompletedMarks.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/CompletedMarksTest.kt
git commit -m "feat: lay out the completed route's marks and ring on Android as the web does"
```

- [ ] **Step 13: Write the instrumented test support.** The fixtures are the JVM ones (same package, another source set); the support adds the theme wrapper, a size and font-scale box, a check that no text is clipped, and a tap injected through the window manager, so it lands on whichever window is on top (the sheet's scrim when it is open).

```bash
mkdir -p android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round
cp android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/round/TestRounds.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/TestRounds.kt
```

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/RoundTestSupport.kt`:

```kotlin
package com.eienmosu.truthy.round

import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.test.platform.app.InstrumentationRegistry
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.resolvedTheme
import com.eienmosu.truthy.engine.Theme
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue

/** The day theme around a test's content. */
@Composable
fun Themed(content: @Composable () -> Unit) {
    TruthyTheme(resolvedTheme(Theme.LIGHT), content)
}

/** The content laid out at a given logical size and font scale (spec 7.4 sizes; README Review Focus 4 at 2f). */
@Composable
fun AtSize(width: Dp, height: Dp, fontScale: Float, content: @Composable () -> Unit) {
    val density = LocalDensity.current
    CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) {
        Box(Modifier.requiredSize(width, height)) { content() }
    }
}

/** Fails when any text node's layout overflows its box: text must grow or scroll, never clip (spec 5.6). */
fun SemanticsNodeInteractionsProvider.assertNoClippedText() {
    val nodes = onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.GetTextLayoutResult), useUnmergedTree = true).fetchSemanticsNodes()
    assertTrue("no text was laid out", nodes.isNotEmpty())
    for (node in nodes) {
        val layouts = mutableListOf<TextLayoutResult>()
        node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
        // A text node hugs its longest line (Compose UI 1.12), so hasVisualOverflow is true for any line shorter than the
        // constraint; a text clips only when a line is wider than its node (1 px of rounding allowed) or the lines are taller.
        for (layout in layouts) assertFalse("clipped: ${layout.layoutInput.text}", (layout.didOverflowHeight || (0 until layout.lineCount).any { layout.getLineRight(it) - layout.getLineLeft(it) > layout.size.width + 1f }))
    }
}

/** A tap at a screen position, through the window manager: it reaches the top window (the sheet's scrim when open). */
fun injectTap(x: Float, y: Float) {
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

/** A tap halfway between the top of the screen and the top of the node with `tag`: on the scrim above the sheet card. */
fun SemanticsNodeInteractionsProvider.tapAbove(tag: String) {
    val node = onNodeWithTag(tag).fetchSemanticsNode()
    injectTap(node.positionOnScreen.x + node.size.width / 2f, node.positionOnScreen.y / 2f)
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:compileDebugAndroidTestKotlin
```

Expected: `BUILD SUCCESSFUL` (the support compiles against the engine and task 8's theme; nothing runs yet).

- [ ] **Step 14: Write the sheet card tests and watch them fail.** The card is tested alone, without the platform sheet, so its texts, live region, buttons and large text are pinned without the sheet's animation.

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/LeaveSheetCardTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LeaveSheetCardTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val events = mutableListOf<String>()
    private var decided by mutableStateOf(false)

    private fun card() {
        rule.setContent {
            Themed {
                LeaveSheetCard(decided = decided, hiding = false, onKeepPlaying = { events += "keep" }, onLeave = { events += "leave" })
            }
        }
    }

    @Test
    fun saysTheTitleTheBodyAndBothActionsWithTheBodyAsALiveRegion() {
        card()
        rule.onNodeWithText(LeaveText.TITLE).assertIsDisplayed().assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading))
        rule.onNodeWithText(LeaveText.OPEN_BODY).assertIsDisplayed()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite))
        rule.onNodeWithText(LeaveText.KEEP_PLAYING).assertIsDisplayed()
        rule.onNodeWithText(LeaveText.LEAVE_ROUND).assertIsDisplayed()
    }

    @Test
    fun switchesToTheDecidedBodyWhenTheRoundIsDecidedWhileOpen() {
        card()
        decided = true
        rule.waitForIdle()
        rule.onNodeWithText(LeaveText.DECIDED_BODY).assertIsDisplayed()
        rule.onNodeWithText(LeaveText.OPEN_BODY).assertDoesNotExist()
    }

    @Test
    fun keepPlayingAndLeaveRoundCallTheirActions() {
        card()
        rule.onNodeWithText(LeaveText.KEEP_PLAYING).performClick()
        rule.onNodeWithText(LeaveText.LEAVE_ROUND).performClick()
        assertEquals(listOf("keep", "leave"), events)
    }

    @Test
    fun nothingClipsAtTwiceTheTextSizeOnALargePhone() {
        rule.setContent { Themed { AtSize(412.dp, 915.dp, fontScale = 2f) { LeaveSheetCard(decided = true, hiding = false, onKeepPlaying = {}, onLeave = {}) } } }
        rule.waitForIdle()
        rule.assertNoClippedText()
    }

    @Test
    fun nothingClipsAtTwiceTheTextSizeOnTheSmallestPhone() {
        rule.setContent { Themed { AtSize(320.dp, 568.dp, fontScale = 2f) { LeaveSheetCard(decided = false, hiding = false, onKeepPlaying = {}, onLeave = {}) } } }
        rule.waitForIdle()
        rule.assertNoClippedText()
    }
}
```

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/LeaveSheetFadeTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.design.LocalReducedMotion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** The system animator scale of 0 that reduced motion means on Android (spec 5.1), applied to the whole composition. */
private object FrozenMotion : MotionDurationScale {
    override val scaleFactor: Float = 0f
}

@RunWith(AndroidJUnit4::class)
class LeaveSheetFadeTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>(effectContext = FrozenMotion)

    private fun alpha(): Float = rule.onNodeWithTag(SHEET_CARD_TAG).fetchSemanticsNode().config[SheetCardAlpha]

    private fun card(reduced: Boolean) {
        rule.mainClock.autoAdvance = false
        rule.setContent {
            Themed {
                CompositionLocalProvider(LocalReducedMotion provides reduced) {
                    LeaveSheetCard(decided = false, hiding = false, onKeepPlaying = {}, onLeave = {})
                }
            }
        }
    }

    @Test
    fun reducedMotionStillFadesTheCardInOver140Milliseconds() {
        card(reduced = true)
        rule.mainClock.advanceTimeBy(70)
        val halfway = alpha()
        assertTrue("alpha at 70 ms was $halfway", halfway > 0.05f && halfway < 0.99f)
        rule.mainClock.advanceTimeBy(80)
        assertEquals("the card is opaque by 140 ms", 1f, alpha(), 0.001f)
    }

    // Reference 5.0 and 5.8: under reduced motion the scrim keeps its 360 ms ease fade while the card takes 140.
    @Test
    fun reducedMotionKeepsTheScrimsFullFade() {
        rule.mainClock.autoAdvance = false
        rule.setContent {
            Themed {
                CompositionLocalProvider(LocalReducedMotion provides true) {
                    LeaveScrim(visible = true)
                }
            }
        }
        rule.mainClock.advanceTimeBy(180)
        val scrim = rule.onNodeWithTag(SCRIM_TAG).fetchSemanticsNode().config[ScrimAlpha]
        // The token curve is --ease, cubic-bezier(0.2, 0.7, 0.2, 1): about 0.93 at 180 of 360 ms. Still fading, and above
        // what the 140 ms reduced fade would leave.
        assertTrue("scrim alpha at 180 ms was $scrim", scrim > 0.5f && scrim < 0.98f)
        rule.mainClock.advanceTimeBy(300)
        assertEquals(1f, rule.onNodeWithTag(SCRIM_TAG).fetchSemanticsNode().config[ScrimAlpha], 0.001f)
    }

    @Test
    fun fullMotionFadesTheCardInOver360Milliseconds() {
        card(reduced = false)
        rule.mainClock.advanceTimeBy(150)
        val early = alpha()
        assertTrue("alpha at 150 ms was $early", early > 0.05f && early < 0.99f)
        rule.mainClock.advanceTimeBy(400)
        assertEquals(1f, alpha(), 0.001f)
    }
}
```

Run on the API 36 emulator (`adb devices` lists it):

```bash
cd android/Truthy
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.round.LeaveSheetCardTest,com.eienmosu.truthy.round.LeaveSheetFadeTest
```

Expected: FAIL at `:app:compileDebugAndroidTestKotlin` with `Unresolved reference 'LeaveSheetCard'`, `'SHEET_CARD_TAG'`, `'SheetCardAlpha'`, `'LeaveScrim'`, `'SCRIM_TAG'` and `'ScrimAlpha'`, then `BUILD FAILED`.

- [ ] **Step 15: Write `LeaveSheet.kt` and run the card tests green.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/LeaveSheet.kt`:

```kotlin
package com.eienmosu.truthy.round

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.ModalBottomSheetProperties
import androidx.compose.material3.SheetValue
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.rememberFrameInsets
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.start.FullSpeed
import com.eienmosu.truthy.ui.PillButton
import com.eienmosu.truthy.ui.QuietButton
import com.eienmosu.truthy.ui.TestTags
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

const val SHEET_CARD_TAG = TestTags.SHEET_CARD
const val SCRIM_TAG = "leave.scrim"

/** The sheet card's current opacity, for tests (the fade is the web's, rule 5). */
val SheetCardAlpha = SemanticsPropertyKey<Float>("SheetCardAlpha")

/** The scrim's current opacity, for tests (rule 5). */
val ScrimAlpha = SemanticsPropertyKey<Float>("ScrimAlpha")

/**
 * "Leave round?" in the platform sheet (spec 5.4), composed while the coordinator's sheetOpen is true: swipe down and
 * the scrim keep playing through Material's onDismissRequest, back through the sheet's own BackHandler. A scrim tap
 * or a swipe-down settle asks scrimTapAccepted first; the host answers true unless task 15 finds the guard needed
 * (rule 4). Material's scrim is transparent: the host draws LeaveScrim (rule 5).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveSheet(decided: Boolean, scrimTapAccepted: () -> Boolean, onKeepPlaying: () -> Unit, onLeave: () -> Unit) {
    val theme = TruthyTheme.resolved
    val currentAccepted by rememberUpdatedState(scrimTapAccepted)
    // Material3 1.4.0's SheetState.hide() asks confirmValueChange(Hidden) too (SheetDefaults.kt:222): a close the card
    // asked for (Keep playing, Escape) is let through without asking the scrim guard.
    var closing by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(
        skipPartiallyExpanded = true,
        confirmValueChange = { value -> value != SheetValue.Hidden || closing || currentAccepted() },
    )
    val scope = rememberCoroutineScope()
    val keepPlaying: () -> Unit = {
        if (!closing) {
            closing = true
            scope.launch { sheetState.hide() }.invokeOnCompletion { onKeepPlaying() }
        }
    }
    ModalBottomSheet(
        onDismissRequest = onKeepPlaying,
        sheetState = sheetState,
        sheetMaxWidth = Tokens.Size.maxWidth,
        shape = RectangleShape,
        containerColor = Color.Transparent,
        contentColor = theme.colors.ink,
        tonalElevation = 0.dp,
        scrimColor = Color.Transparent,
        dragHandle = null,
        contentWindowInsets = { WindowInsets(0, 0, 0, 0) },
        properties = ModalBottomSheetProperties(
            isAppearanceLightStatusBars = !theme.isDark,
            isAppearanceLightNavigationBars = !theme.isDark,
            // Back on the sheet is the BackHandler below: it keeps playing at once and never asks the guard.
            shouldDismissOnBackPress = false,
        ),
    ) {
        BackHandler { keepPlaying() }
        LeaveSheetCard(
            decided = decided,
            hiding = sheetState.targetValue == SheetValue.Hidden,
            onKeepPlaying = keepPlaying,
            onLeave = onLeave,
        )
    }
}

/** The web's floating card (LeaveDialog.tsx), drawn inside the transparent sheet. */
@Composable
fun LeaveSheetCard(decided: Boolean, hiding: Boolean, onKeepPlaying: () -> Unit, onLeave: () -> Unit, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val reduced = LocalReducedMotion.current
    val fade = remember { Animatable(0f) }
    LaunchedEffect(hiding, reduced) {
        val motion = if (hiding) Tokens.Transitions.sheetClose else Tokens.Transitions.sheetOpen
        val duration = if (reduced) Tokens.Native.sheetReducedMs else motion.durationMs
        withContext(FullSpeed) {
            fade.animateTo(if (hiding) 0f else 1f, tween(durationMillis = duration, easing = motion.easing))
        }
    }
    val keepPlayingFocus = remember { FocusRequester() }
    val sheetFocus = remember { FocusRequester() }
    // In touch mode Keep playing (a clickable) cannot take focus; the sheet's root takes it then, so Escape still
    // arrives (with predictive back on, a dialog no longer turns Escape into back).
    LaunchedEffect(Unit) { if (!keepPlayingFocus.requestFocus()) sheetFocus.requestFocus() }
    val frame = rememberFrameInsets()
    val shape = RoundedCornerShape(Tokens.Radius.card)
    val cardAlpha = fade.value
    Column(
        modifier
            .fillMaxWidth()
            .onPreviewKeyEvent { event ->
                val escape = event.key == Key.Escape
                if (escape && event.type == KeyEventType.KeyDown && event.nativeKeyEvent.repeatCount == 0) onKeepPlaying()
                escape
            }
            .focusRequester(sheetFocus)
            .focusable()
            .verticalScroll(rememberScrollState())
            .padding(start = frame.start, end = frame.end, top = Tokens.Space.s12, bottom = frame.bottom),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .testTag(SHEET_CARD_TAG)
                .semantics { this[SheetCardAlpha] = cardAlpha }
                .graphicsLayer { alpha = cardAlpha }
                .truthyShadow(TruthyTheme.shadows.sheet, cornerRadius = Tokens.Radius.card)
                .background(colors.surfaceRaised, shape)
                .padding(Tokens.Space.s20),
        ) {
            BasicText(
                text = LeaveText.TITLE,
                style = TruthyType.stepTitle.copy(color = colors.ink),
                modifier = Modifier.semantics { heading() },
            )
            BasicText(
                text = LeaveText.body(decided),
                style = TruthyType.body.copy(color = colors.ink),
                modifier = Modifier.padding(top = Tokens.Space.s8).semantics { liveRegion = LiveRegionMode.Polite },
            )
            Column(Modifier.padding(top = Tokens.Space.s20), verticalArrangement = Arrangement.spacedBy(Tokens.Space.s4)) {
                PillButton(
                    label = LeaveText.KEEP_PLAYING,
                    onClick = onKeepPlaying,
                    modifier = Modifier.fillMaxWidth().focusRequester(keepPlayingFocus),
                )
                QuietButton(label = LeaveText.LEAVE_ROUND, onClick = onLeave, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

/**
 * The web's scrim (reference 5.0 and 5.8): the theme's scrim colour fading in over Transitions.sheetOpen (360 ms
 * ease) and out over sheetClose, at full length under reduced motion too (task 12's FullSpeed). The host draws it in
 * the activity's window, under the sheet's own window; it takes no touches (the sheet's window takes them).
 */
@Composable
fun LeaveScrim(visible: Boolean, modifier: Modifier = Modifier) {
    val scrim = remember { Animatable(0f) }
    LaunchedEffect(visible) {
        val motion = if (visible) Tokens.Transitions.sheetOpen else Tokens.Transitions.sheetClose
        withContext(FullSpeed) {
            scrim.animateTo(if (visible) 1f else 0f, tween(durationMillis = motion.durationMs, easing = motion.easing))
        }
    }
    val alpha = scrim.value
    Box(
        modifier
            .fillMaxSize()
            .testTag(SCRIM_TAG)
            .semantics { this[ScrimAlpha] = alpha }
            .graphicsLayer { this.alpha = alpha }
            .background(TruthyTheme.colors.scrim),
    )
}
```

Run the command of step 14. Expected: `BUILD SUCCESSFUL`, and

```bash
grep -ho 'tests="[0-9]*" failures="[0-9]*" errors="[0-9]*" skipped="[0-9]*"' app/build/outputs/androidTest-results/connected/debug/*.xml
```

shows `tests="8" failures="0" errors="0" skipped="0"` (5 card tests and 3 fade tests; if the attribute order differs, read the counts from the file). If `fullMotionFadesTheCardInOver360Milliseconds` sees 1 at 150 ms, or `reducedMotionKeepsTheScrimsFullFade` sees 1 at 180 ms, the fade is not running under `FullSpeed`: check that `withContext(FullSpeed)` wraps the `animateTo`.

- [ ] **Step 16: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/LeaveSheet.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/TestRounds.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/RoundTestSupport.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/LeaveSheetCardTest.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/LeaveSheetFadeTest.kt
git commit -m "feat: draw the web's leave card inside a Material3 bottom sheet on Android"
```

- [ ] **Step 17: Write the back surface test and watch it fail.** The activity's dispatcher feeds the handler exactly as the system does: `dispatchOnBackStarted` and `dispatchOnBackProgressed` scrub (API 34 and later), `dispatchOnBackCancelled` cancels, and `onBackPressed` alone is the instant commit of API 33 and below.

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/RoundBackSurfaceTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import androidx.activity.BackEventCompat
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RoundBackSurfaceTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var commits = 0

    @Before
    fun surface() {
        rule.setContent {
            Themed {
                RoundBackSurface(enabled = true, onBack = { commits += 1 }) { Box(Modifier.fillMaxSize()) }
            }
        }
    }

    private fun scale(): Float = rule.onNodeWithTag(ROUND_SURFACE_TAG).fetchSemanticsNode().config[RoundBackScale]

    private fun event(progress: Float) = BackEventCompat(touchX = 0f, touchY = 0f, progress = progress, swipeEdge = BackEventCompat.EDGE_LEFT)

    @Test
    fun aScrubbedBackShrinksTheSurfaceAndACancelSpringsItBackWithoutActing() {
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.dispatchOnBackStarted(event(0f)) }
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.dispatchOnBackProgressed(event(0.5f)) }
        rule.waitForIdle()
        assertEquals(0.97f, scale(), 0.001f)
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.dispatchOnBackCancelled() }
        rule.waitForIdle()
        assertEquals(1f, scale(), 0.001f)
        assertEquals(0, commits)
    }

    @Test
    fun aCompletedBackActsOnceAndReturnsTheSurfaceToRest() {
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.dispatchOnBackStarted(event(0f)) }
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.dispatchOnBackProgressed(event(1f)) }
        rule.waitForIdle()
        assertEquals(0.94f, scale(), 0.001f)
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }
        rule.waitForIdle()
        assertEquals(1, commits)
        assertEquals(1f, scale(), 0.001f)
    }

    @Test
    fun aBackWithoutProgressCommitsAtOnceAsBelowApi34() {
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }
        rule.waitForIdle()
        assertEquals(1, commits)
        assertEquals(1f, scale(), 0.001f)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.round.RoundBackSurfaceTest
```

Expected: FAIL at `:app:compileDebugAndroidTestKotlin` with `Unresolved reference 'RoundBackSurface'`, `'ROUND_SURFACE_TAG'` and `'RoundBackScale'`, then `BUILD FAILED`.

- [ ] **Step 18: Write `RoundBackSurface.kt` and run the test green.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundBackSurface.kt`:

```kotlin
package com.eienmosu.truthy.round

import androidx.activity.compose.PredictiveBackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.semantics
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.ui.TestTags
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

const val ROUND_SURFACE_TAG = TestTags.ROUND_SURFACE

/** The round surface's current scale, for tests. */
val RoundBackScale = SemanticsPropertyKey<Float>("RoundBackScale")

/**
 * The round's only back handler (rule 2): the system's progress shrinks the surface from 1 to 0.94 about its
 * centre, a cancel springs back, a commit calls `onBack` (task 11's roundBack in the app) and springs back. Below API 34 the
 * flow completes with no progress, so the commit runs with the surface at 1.
 */
@Composable
fun RoundBackSurface(enabled: Boolean, onBack: () -> Unit, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val scale = remember { Animatable(1f) }
    val scope = rememberCoroutineScope()
    val currentOnBack by rememberUpdatedState(onBack)
    val settle: () -> Unit = {
        scope.launch { scale.animateTo(1f, tween(durationMillis = Tokens.Duration.t3, easing = Tokens.Curves.spring)) }
    }
    PredictiveBackHandler(enabled = enabled) { progress ->
        followRoundBack(progress.map { it.progress }, show = { scale.snapTo(it) }, onCancel = settle)
        currentOnBack()
        settle()
    }
    val current = scale.value
    Box(
        modifier
            .fillMaxSize()
            // The layer first: the tagged node inside it reports the scaled bounds (task 15's BackTest reads them).
            .graphicsLayer {
                scaleX = current
                scaleY = current
            }
            .testTag(ROUND_SURFACE_TAG)
            .semantics { this[RoundBackScale] = current },
    ) {
        content()
    }
}
```

Run the command of step 17. Expected: `BUILD SUCCESSFUL` and `tests="3" failures="0" errors="0" skipped="0"` in the XML of step 15's `grep`.

- [ ] **Step 19: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundBackSurface.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/RoundBackSurfaceTest.kt
git commit -m "feat: scrub the Android round's predictive back from 1 to 0.94 and commit at once below API 34"
```

- [ ] **Step 20: Write the result screen test and watch it fail.** A Classic round of 10 with cards 3, 6 and 10 wrong (score 7) is shown against each kind of record; the missed list, Why, the source link, the 1000 ms guard and large text are pinned.

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/ResultScreenTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.MonotonicClock
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.completedLabel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ResultScreenTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var now = 0.0
    private val clock = MonotonicClock { now }
    private val events = mutableListOf<String>()

    private fun result(round: RoundState = TestRounds.classic(), best: Int? = null) {
        rule.setContent {
            Themed {
                ResultScreen(
                    round = round,
                    ticket = TestRounds.ticket(best),
                    shownAt = 0.0,
                    clock = clock,
                    onClose = { events += "close" },
                    onPlayAgain = { events += "again" },
                    onHome = { events += "home" },
                    openSource = { events += "open $it" },
                )
            }
        }
    }

    @Test
    fun showsTheHeadingTheRouteTheFieldsAndAFirstRound() {
        val round = TestRounds.classic()
        result(round)
        rule.onNodeWithContentDescription(ResultText.HEADING).assertExists()
        rule.onNodeWithContentDescription(completedLabel(10, round.answers.map { it.correct })).assertExists()
        rule.onNodeWithContentDescription(ResultText.CLOSE_RESULTS).assertIsDisplayed()
        rule.onNodeWithText("10 / 10").assertExists()
        rule.onNodeWithText("03").assertExists()
        rule.onNodeWithText("Your score").assertExists()
        rule.onNodeWithText("7").assertExists()
        rule.onNodeWithText("of 10").assertExists()
        rule.onNodeWithText(ResultText.FIRST_ROUND).assertExists()
        rule.onNodeWithText(ResultText.NEW_BEST).assertDoesNotExist()
    }

    @Test
    fun stampsNewBestOverThePreviousBest() {
        result(best = 6)
        rule.onNodeWithText(ResultText.NEW_BEST).assertExists()
        rule.onNodeWithText(ResultText.previousBest("6 / 10")).assertExists()
    }

    @Test
    fun saysEqualsYourBestInWords() {
        result(best = 7)
        rule.onNodeWithText(ResultText.EQUALS_BEST).assertExists()
        rule.onNodeWithText(ResultText.best("7 / 10")).assertExists()
        rule.onNodeWithText(ResultText.NEW_BEST).assertDoesNotExist()
    }

    @Test
    fun saysHowManyShortOfTheBest() {
        result(best = 9)
        rule.onNodeWithText(ResultText.shortOfBest(2)).assertExists()
        rule.onNodeWithText(ResultText.best("9 / 10")).assertExists()
    }

    @Test
    fun listsTheMissedCardsAndOpensWhyWithItsSource() {
        val round = TestRounds.classic()
        result(round)
        rule.onNodeWithText(ResultText.MISSED_CARDS).assertExists()
        rule.onNodeWithText(ResultText.toReview(3)).assertExists()
        for (number in listOf(3, 6, 10)) rule.onNodeWithText(ResultText.cardCaption(number)).assertExists()
        rule.onAllNodesWithText("You said ", substring = true).assertCountEquals(3)
        val third = round.answers[2].card
        rule.onNodeWithText(third.text.en.explanation).assertDoesNotExist()
        rule.onNodeWithContentDescription(ResultText.whyLabel(3)).performScrollTo().performClick()
        rule.waitForIdle()
        rule.onNodeWithText(third.text.en.explanation).assertExists()
        rule.onNodeWithContentDescription(ResultText.sourceLabel(third.source.title)).performScrollTo().performClick()
        assertEquals(listOf("open ${third.source.url}"), events)
        rule.onNodeWithContentDescription(ResultText.whyLabel(3)).performScrollTo().performClick()
        rule.waitForIdle()
        rule.onNodeWithText(third.text.en.explanation).assertDoesNotExist()
    }

    // Spec 5.6 and reference 5.0: the bottom fade cue shows while more lies below and is gone at the end of the scroll.
    @Test
    fun theMissedListFadesAtTheFootUntilTheEndOfTheScroll() {
        rule.setContent {
            Themed {
                AtSize(320.dp, 568.dp, fontScale = 1f) {
                    ResultScreen(TestRounds.classic(wrong = (0..7).toSet()), TestRounds.ticket(null), 0.0, clock, {}, {}, {}, {})
                }
            }
        }
        rule.waitForIdle()
        // Bring the list's header into view, so the ticket's lower part reaches the stage's foot.
        rule.onNodeWithText(ResultText.MISSED_CARDS).performScrollTo()
        rule.waitForIdle()
        rule.onNodeWithTag(MISSED_FADE_TAG).assertExists()
        rule.onNode(hasScrollAction()).performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, 100_000f) }
        rule.waitForIdle()
        rule.onNodeWithTag(MISSED_FADE_TAG).assertDoesNotExist()
    }

    @Test
    fun saysNoMissedCardsAfterAPerfectRound() {
        result(TestRounds.classic(wrong = emptySet()))
        rule.onNodeWithText(ResultText.NO_MISSED_CARDS).assertExists()
        rule.onNodeWithText(ResultText.toReview(0)).assertDoesNotExist()
    }

    @Test
    fun ignoresPlayAgainAndChooseAnotherRouteForTheFirstSecond() {
        result()
        now = 999.0
        rule.onNodeWithText(ResultText.PLAY_AGAIN).performClick()
        rule.onNodeWithText(ResultText.CHOOSE_ANOTHER_ROUTE).performClick()
        assertTrue(events.isEmpty())
        now = 1_000.0
        rule.onNodeWithText(ResultText.PLAY_AGAIN).performClick()
        rule.onNodeWithText(ResultText.CHOOSE_ANOTHER_ROUTE).performClick()
        assertEquals(listOf("again", "home"), events)
    }

    @Test
    fun nothingClipsAtTwiceTheTextSizeOnALargePhone() {
        rule.setContent {
            Themed {
                AtSize(412.dp, 915.dp, fontScale = 2f) {
                    ResultScreen(TestRounds.classic(), TestRounds.ticket(6), 0.0, clock, {}, {}, {}, {})
                }
            }
        }
        rule.waitForIdle()
        rule.assertNoClippedText()
    }

    @Test
    fun nothingClipsAtTwiceTheTextSizeOnTheSmallestPhone() {
        rule.setContent {
            Themed {
                AtSize(320.dp, 568.dp, fontScale = 2f) {
                    ResultScreen(TestRounds.classic(), TestRounds.ticket(6), 0.0, clock, {}, {}, {}, {})
                }
            }
        }
        rule.waitForIdle()
        rule.assertNoClippedText()
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.round.ResultScreenTest
```

Expected: FAIL at `:app:compileDebugAndroidTestKotlin` with `Unresolved reference 'ResultScreen'`, then `BUILD FAILED`.

- [ ] **Step 21: Write the score block, the missed list, the completed route and the result screen, and run the test green.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/ScoreBlock.kt`:

```kotlin
@file:OptIn(ExperimentalFoundationApi::class)

package com.eienmosu.truthy.round

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.engine.Comparison
import com.eienmosu.truthy.engine.ResultCopy
import kotlin.math.max

/**
 * The score block of the result (ScoreBlock.tsx): the score and its unit on the left, the comparison with the record
 * on the right, bottom-aligned. Only the New best stamp may move under the score, when it does not fit beside it.
 */
@Composable
fun ScoreBlock(score: Int, copy: ResultCopy, comparison: Comparison, comparisonView: BringIntoViewRequester, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    ScoreRow(
        wraps = comparison is Comparison.NewBest,
        modifier = modifier
            .fillMaxWidth()
            .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = Tokens.Space.s14, bottom = Tokens.Space.s18),
        left = {
            Column(Modifier.semantics(mergeDescendants = true) {}) {
                BasicText(copy.scoreLabel, style = TruthyType.fieldLabel.copy(color = colors.inkMuted))
                Row(Modifier.padding(top = Tokens.Space.s4), horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8)) {
                    BasicText("$score", style = TruthyType.score.copy(color = colors.ink), modifier = Modifier.alignByBaseline())
                    val unit = copy.unit
                    if (unit != null) {
                        BasicText(unit, style = TruthyType.scoreUnit.copy(color = colors.inkMuted), modifier = Modifier.alignByBaseline())
                    }
                }
            }
        },
        right = {
            Column(
                Modifier.bringIntoViewRequester(comparisonView).padding(bottom = Tokens.Space.s2),
                horizontalAlignment = Alignment.End,
            ) {
                val emphasis = TruthyType.emphasis.copy(color = colors.ink, textAlign = TextAlign.End)
                val best = TruthyType.monoData.copy(color = colors.inkMuted, textAlign = TextAlign.End)
                when (comparison) {
                    Comparison.First -> BasicText(ResultText.FIRST_ROUND, style = emphasis)
                    is Comparison.NewBest -> {
                        NewBestStamp(animate = true)
                        BasicText(ResultText.previousBest(copy.best(comparison.previousBest)), style = best, modifier = Modifier.padding(top = Tokens.Space.s10))
                    }
                    is Comparison.Equal -> {
                        BasicText(ResultText.EQUALS_BEST, style = emphasis)
                        BasicText(ResultText.best(copy.best(comparison.best)), style = best, modifier = Modifier.padding(top = Tokens.Space.s2))
                    }
                    is Comparison.Short -> {
                        BasicText(ResultText.shortOfBest(comparison.by), style = emphasis)
                        BasicText(ResultText.best(copy.best(comparison.best)), style = best, modifier = Modifier.padding(top = Tokens.Space.s2))
                    }
                }
            }
        },
    )
}

// Side by side when they fit (the comparison's text wraps in what is left); a New best stamp that does not fit beside
// the score moves under it, still at the right (ScoreBlock.tsx flex-wrap).
@Composable
private fun ScoreRow(wraps: Boolean, modifier: Modifier, left: @Composable () -> Unit, right: @Composable () -> Unit) {
    val gapX = Tokens.Space.s16
    val gapY = Tokens.Space.s10
    Layout(contents = listOf(left, right), modifier = modifier) { (leftMeasurables, rightMeasurables), constraints ->
        val width = constraints.maxWidth
        val gx = gapX.roundToPx()
        val gy = gapY.roundToPx()
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val leftPlaceable = leftMeasurables.first().measure(loose)
        val rightMeasurable = rightMeasurables.first()
        val besideFits = !wraps || leftPlaceable.width + gx + rightMeasurable.maxIntrinsicWidth(loose.maxHeight) <= width
        if (besideFits) {
            val rightPlaceable = rightMeasurable.measure(loose.copy(maxWidth = (width - leftPlaceable.width - gx).coerceAtLeast(0)))
            val height = max(leftPlaceable.height, rightPlaceable.height)
            layout(width, height) {
                leftPlaceable.place(0, height - leftPlaceable.height)
                rightPlaceable.place(width - rightPlaceable.width, height - rightPlaceable.height)
            }
        } else {
            val rightPlaceable = rightMeasurable.measure(loose)
            val height = leftPlaceable.height + gy + rightPlaceable.height
            layout(width, height) {
                leftPlaceable.place(0, 0)
                rightPlaceable.place(width - rightPlaceable.width, leftPlaceable.height + gy)
            }
        }
    }
}

/** "New best" on the result (ScoreBlock.tsx): a double-ruled stamp in the correct colour that lands with the web's pose. */
@Composable
fun NewBestStamp(animate: Boolean, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val reduced = LocalReducedMotion.current
    val landing = remember { Animatable(if (animate && !reduced) 0f else 1f) }
    LaunchedEffect(Unit) {
        val stamp = Tokens.Transitions.stamp
        landing.animateTo(1f, tween(durationMillis = stamp.durationMs, delayMillis = stamp.delayMs, easing = stamp.easing))
    }
    val c = LeaveResultConstants
    val border = Tokens.Stroke.stamp
    val radius = Tokens.Radius.small
    Row(
        modifier
            .graphicsLayer {
                val t = landing.value
                alpha = t.coerceIn(0f, 1f)
                val scale = c.STAMP_LANDING_SCALE + (1f - c.STAMP_LANDING_SCALE) * t
                scaleX = scale
                scaleY = scale
                rotationZ = c.STAMP_LANDING_ROTATION + (c.STAMP_REST_ROTATION - c.STAMP_LANDING_ROTATION) * t
            }
            .drawBehind { drawDoubleBorder(colors.correct, border.toPx(), radius.toPx()) }
            .padding(border)
            .padding(start = Tokens.Space.s14, end = Tokens.Space.s14, top = Tokens.Space.s6, bottom = Tokens.Space.s4)
            .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
    ) {
        TruthyIcon(IconId.STAR, tint = colors.correct)
        BasicText(ResultText.NEW_BEST, style = TruthyType.stampBest.copy(color = colors.correct))
    }
}

// A CSS double border: two lines of a third of its width each, a third apart.
private fun DrawScope.drawDoubleBorder(color: Color, width: Float, radius: Float) {
    val line = width / 3f
    for (inset in listOf(line / 2f, width - line / 2f)) {
        drawRoundRect(
            color = color,
            topLeft = Offset(inset, inset),
            size = Size(size.width - 2 * inset, size.height - 2 * inset),
            cornerRadius = CornerRadius((radius - inset).coerceAtLeast(0f)),
            style = Stroke(width = line),
        )
    }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/MissedCardsList.kt`:

```kotlin
@file:OptIn(ExperimentalFoundationApi::class)

package com.eienmosu.truthy.round

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyText
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.keyboardFocusRing
import com.eienmosu.truthy.engine.MissedCard
import kotlinx.coroutines.delay

/**
 * The missed cards on the sunk lower part of the result ticket (MissedCards.tsx): a header row, then each card's
 * number, what was said, the applies-to line, the statement, the right answer and a Why disclosure; one calm line
 * when nothing was missed. The list scrolls with the result column (rule 8).
 */
@Composable
fun MissedCardsList(missed: List<MissedCard>, openSource: (String) -> Unit, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    if (missed.isEmpty()) {
        Column(
            modifier
                .fillMaxWidth()
                .semantics { contentDescription = ResultText.MISSED_CARDS }
                .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = Tokens.Space.s16, bottom = Tokens.Space.s20),
        ) {
            BasicText(ResultText.NO_MISSED_CARDS, style = TruthyType.listStatement.copy(color = colors.ink))
        }
        return
    }
    Column(modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = Tokens.Space.s16, bottom = Tokens.Space.s4),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom,
        ) {
            BasicText(
                ResultText.MISSED_CARDS,
                style = TruthyType.monoData.copy(color = colors.inkMuted),
                modifier = Modifier.semantics { heading() },
            )
            BasicText(ResultText.toReview(missed.size), style = TruthyType.monoDataStrong.copy(color = colors.ink))
        }
        Column(Modifier.fillMaxWidth().padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, bottom = Tokens.Space.s20)) {
            missed.forEachIndexed { i, item -> MissedRow(item, first = i == 0, openSource = openSource) }
        }
    }
}

@Composable
private fun MissedRow(item: MissedCard, first: Boolean, openSource: (String) -> Unit) {
    val colors = TruthyTheme.colors
    val reduced = LocalReducedMotion.current
    var open by rememberSaveable(item.number) { mutableStateOf(false) }
    val chevron by animateFloatAsState(
        targetValue = if (open) 180f else 0f,
        animationSpec = tween(durationMillis = Tokens.Duration.t2, easing = Tokens.Curves.ease),
        label = "why chevron",
    )
    val whyView = remember { BringIntoViewRequester() }
    var whySize by remember { mutableStateOf(IntSize.Zero) }
    val density = LocalDensity.current
    val below = with(density) { (Tokens.Space.s4 + LeaveResultConstants.WHY_SCROLL_CLEARANCE_DP.dp).toPx() }
    LaunchedEffect(open) {
        if (open) {
            delay(if (reduced) LeaveResultConstants.WHY_SCROLL_DELAY_REDUCED_MS else LeaveResultConstants.WHY_SCROLL_DELAY_MS)
            whyView.bringIntoView(Rect(0f, 0f, whySize.width.toFloat(), whySize.height + below))
        }
    }
    val toggle: () -> Unit = { open = !open }
    val rule = colors.rule
    val ruleWidth = Tokens.Stroke.rule
    Column(
        Modifier
            .fillMaxWidth()
            .then(
                if (first) Modifier
                else Modifier.drawBehind { drawLine(rule, Offset(0f, 0f), Offset(size.width, 0f), ruleWidth.toPx()) },
            )
            .padding(top = Tokens.Space.s12, bottom = Tokens.Space.s4),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            BasicText(ResultText.cardCaption(item.number), style = TruthyType.monoCaption.copy(color = colors.inkMuted))
            BasicText(ResultText.youSaid(item.given), style = TruthyType.monoCaption.copy(color = colors.inkMuted))
        }
        val applies = item.appliesTo
        if (applies != null) {
            BasicText(
                applies,
                style = TruthyType.monoData.copy(color = colors.inkMuted),
                modifier = Modifier.padding(top = Tokens.Space.s6).clearAndSetSemantics { contentDescription = ResultText.appliesTo(applies) },
            )
        }
        // Task 13's cardText: code parts in Overpass Mono at 0.92 em, the one helper for card text.
        TruthyText(cardText(item.statement), TruthyType.listStatement, colors.ink, modifier = Modifier.padding(top = Tokens.Space.s6))
        Row(
            Modifier.fillMaxWidth().heightIn(min = Tokens.Size.touchMin),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
        ) {
            Row(
                Modifier.weight(1f).semantics(mergeDescendants = true) {},
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
            ) {
                BasicText(ResultText.ANSWER, style = TruthyType.monoData.copy(color = colors.inkMuted))
                BasicText(ResultText.word(item.answer), style = TruthyType.missedAnswer.copy(color = colors.ink))
            }
            Row(
                Modifier
                    .offset(x = Tokens.Space.s8)
                    .heightIn(min = Tokens.Size.touchMin)
                    .keyboardFocusRing(RoundedCornerShape(Tokens.Radius.small))
                    .clip(RoundedCornerShape(Tokens.Radius.small))
                    .clickable(interactionSource = null, indication = null, onClick = toggle)
                    .clearAndSetSemantics {
                        contentDescription = ResultText.whyLabel(item.number)
                        onClick { toggle(); true }
                        if (open) collapse { toggle(); true } else expand { toggle(); true }
                    }
                    .padding(start = Tokens.Space.s8, end = Tokens.Space.s8),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s6),
            ) {
                BasicText(
                    ResultText.WHY,
                    style = TruthyType.monoDataStrong.copy(color = colors.trueColor, textDecoration = TextDecoration.Underline),
                )
                TruthyIcon(IconId.CHEVRON_DOWN, tint = colors.trueColor, modifier = Modifier.graphicsLayer { rotationZ = chevron })
            }
        }
        val disclosure = Tokens.Transitions.disclosure
        AnimatedVisibility(
            visible = open,
            enter = expandVertically(animationSpec = tween(durationMillis = disclosure.durationMs, easing = disclosure.easing)),
            exit = shrinkVertically(animationSpec = tween(durationMillis = disclosure.durationMs, easing = disclosure.easing)),
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .onSizeChanged { whySize = it }
                    .bringIntoViewRequester(whyView)
                    .padding(bottom = Tokens.Space.s12)
                    .height(IntrinsicSize.Min),
            ) {
                Box(Modifier.width(Tokens.Stroke.quote).fillMaxHeight().background(colors.rule))
                Column(Modifier.padding(start = Tokens.Space.s12)) {
                    TruthyText(cardText(item.explanation), TruthyType.missedExplanation, colors.ink)
                    SourceLink(item.source.title, item.source.url, openSource)
                }
            }
        }
    }
}

@Composable
private fun SourceLink(title: String, url: String, openSource: (String) -> Unit) {
    val colors = TruthyTheme.colors
    val style = TruthyType.monoDataStrong.copy(color = colors.trueColor)
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.touchMin)
            .keyboardFocusRing(RoundedCornerShape(Tokens.Radius.small))
            .clickable(interactionSource = null, indication = null) { openSource(url) }
            .clearAndSetSemantics {
                contentDescription = ResultText.sourceLabel(title)
                onClick { openSource(url); true }
            },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
    ) {
        TruthyIcon(IconId.BOOK, tint = colors.trueColor)
        BasicText(title, style = style.copy(textDecoration = TextDecoration.Underline), modifier = Modifier.weight(1f, fill = false))
        BasicText("→", style = style)
    }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/CompletedFlightPath.kt`:

```kotlin
package com.eienmosu.truthy.round

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.engine.ResultCopy

/**
 * The result's header route (FlightPath.tsx, "completed"): the whole route flown, every card's mark, the Streak ring
 * at the previous best, no plane; the label row says copy.ended in bold, copy.endedDetail, and the tally.
 */
@Composable
fun CompletedFlightPath(copy: ResultCopy, results: List<Boolean>, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val marks = remember(results, copy.marks, copy.ring) { completedMarks(results, copy.marks, copy.ring) }
    val correct = results.count { it }
    val progress = buildAnnotatedString {
        withStyle(SpanStyle(fontWeight = TruthyType.monoDataStrong.fontWeight)) { append(copy.ended) }
        append(copy.endedDetail)
    }
    PathFrame(
        label = copy.label,
        progress = progress,
        tally = AnnotatedString(ResultText.tally(correct, results.size - correct)),
        modifier = modifier,
    ) {
        drawRouteLine(flownTo = 1.0, colors = colors)
        for (mark in marks.below) drawMark(correct = mark.correct, at = mark.at, scale = mark.scale, fresh = false, plain = mark.plain, colors = colors)
        val ring = marks.ring
        if (ring != null) {
            drawCircle(
                color = colors.ink,
                radius = ring.radius.toFloat(),
                center = Offset(ring.at.x.toFloat(), ring.at.y.toFloat()),
                style = Stroke(width = LeaveResultConstants.RING_STROKE),
            )
        }
        for (mark in marks.above) drawMark(correct = mark.correct, at = mark.at, scale = mark.scale, fresh = false, plain = mark.plain, colors = colors)
    }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/ResultScreen.kt`:

```kotlin
@file:OptIn(ExperimentalFoundationApi::class)

package com.eienmosu.truthy.round

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.MonotonicClock
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LowerCloud
import com.eienmosu.truthy.design.RouteIcon
import com.eienmosu.truthy.design.SkyBackdrop
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyFrame
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.engine.FADE_PX
import com.eienmosu.truthy.ui.PillButton
import com.eienmosu.truthy.ui.QuietButton
import com.eienmosu.truthy.ui.RoundButton
import com.eienmosu.truthy.engine.Comparison
import com.eienmosu.truthy.engine.RESULT_ARRIVES_MS
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.compareWithBest
import com.eienmosu.truthy.engine.missedCards
import com.eienmosu.truthy.engine.resultCopy
import com.eienmosu.truthy.engine.summarise

/**
 * The result of a finished round (ResultView.tsx): the completed route, the ticket with the score block and the
 * comparison with the record from before the round (ticket.best, rule 6), the missed cards, Play again and Choose
 * another route. The actions take presses once the result has been shown for RESULT_ARRIVES_MS (rule 7); the X
 * goes through the host's decision, which applies the same time.
 */
@Composable
fun ResultScreen(
    round: RoundState,
    ticket: TicketInfo,
    shownAt: Double,
    clock: MonotonicClock,
    onClose: () -> Unit,
    onPlayAgain: () -> Unit,
    onHome: () -> Unit,
    openSource: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val result = remember(round) { summarise(round) }
    val copy = remember(round, ticket) { resultCopy(result, ticket.modeLabel, round.cards.size, ticket.best) }
    val comparison = remember(round, ticket) { compareWithBest(result.score, ticket.best) }
    val missed = remember(round) { missedCards(round.answers) }
    val results = remember(round) { round.answers.map { it.correct } }
    val newBest = comparison is Comparison.NewBest
    val arrived: (() -> Unit) -> () -> Unit = { action -> { if (clock.nowMs() - shownAt >= RESULT_ARRIVES_MS) action() } }
    val headingFocus = remember { FocusRequester() }
    val comparisonView = remember { BringIntoViewRequester() }
    LaunchedEffect(Unit) {
        headingFocus.requestFocus()
        if (newBest) comparisonView.bringIntoView()
    }
    val jolt = remember { Animatable(0f) }
    LaunchedEffect(newBest) {
        if (newBest) {
            val motion = Tokens.Transitions.jolt
            jolt.animateTo(1f, tween(durationMillis = motion.durationMs, delayMillis = motion.delayMs, easing = LinearEasing))
        }
    }
    val shortLegs = LocalConfiguration.current.screenHeightDp <= LeaveResultConstants.SHORT_LEGS_MAX_HEIGHT_DP
    val colors = TruthyTheme.colors
    val density = LocalDensity.current
    val stageScroll = rememberScrollState()
    // Rule 8: where the ticket's lower part starts and where the stage ends, in root px, for the bottom fade cue.
    var lowerTop by remember { mutableFloatStateOf(Float.MAX_VALUE) }
    var stageBottom by remember { mutableFloatStateOf(0f) }
    val fadePx = with(density) { FADE_PX.toFloat().dp.toPx() }
    val fade = stageScroll.canScrollForward && lowerTop < stageBottom - fadePx
    Box(modifier.fillMaxSize()) {
        SkyBackdrop(lowerCloud = LowerCloud.GAME)
        TruthyFrame {
            Row(
                Modifier.fillMaxWidth().heightIn(min = Tokens.Size.header),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
            ) {
                RoundButton(label = ResultText.CLOSE_RESULTS, onClick = onClose) { TruthyIcon(IconId.CLOSE) }
                CompletedFlightPath(copy, results, Modifier.weight(1f))
            }
            BoxWithConstraints(
                Modifier
                    .padding(top = Tokens.Space.s12)
                    .weight(1f)
                    .fillMaxWidth()
                    .onGloballyPositioned { stageBottom = it.positionInRoot().y + it.size.height }
                    .semantics {
                        heading()
                        contentDescription = ResultText.HEADING
                    }
                    .focusRequester(headingFocus)
                    .focusable(),
            ) {
                val stage = maxHeight
                Column(Modifier.fillMaxSize().verticalScroll(stageScroll)) {
                    // Task 13's ticket shell (tagged TestTags.TICKET); with a minimum height of the stage, its lower part
                    // gets at least the height the upper part leaves and grows with the missed list (rule 8).
                    BoardingPass(
                        from = PassLeg(ticket.deckCode, ticket.deckName),
                        to = PassLeg(ticket.sectionCode, ticket.sectionName),
                        fields = copy.fields.map { PassField(it.label, it.value) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = stage)
                            .graphicsLayer { translationY = joltOffset(jolt.value) * LeaveResultConstants.JOLT_DISTANCE_DP.dp.toPx() },
                        shortLegs = shortLegs,
                        lower = {
                            PassLower(
                                PaperTone.SUNK,
                                Modifier
                                    .fillMaxWidth()
                                    .onGloballyPositioned { lowerTop = it.positionInRoot().y },
                            ) {
                                MissedCardsList(missed, openSource)
                            }
                        },
                    ) {
                        ScoreBlock(result.score, copy, comparison, comparisonView)
                    }
                }
                if (fade) {
                    // The web's 28 px cue (MissedCards.tsx): sunk paper fading in over the stage's foot.
                    Box(
                        Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .height(FADE_PX.toFloat().dp)
                            .testTag(MISSED_FADE_TAG)
                            .clearAndSetSemantics {}
                            .background(Brush.verticalGradient(listOf(colors.surfaceSunkClear, colors.surfaceSunk))),
                    )
                }
            }
            Column(
                Modifier.fillMaxWidth().padding(top = Tokens.Space.s12),
                verticalArrangement = Arrangement.spacedBy(Tokens.Space.s4),
            ) {
                PillButton(
                    label = ResultText.PLAY_AGAIN,
                    onClick = arrived(onPlayAgain),
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { TruthyIcon(IconId.REPLAY, tint = colors.onDark) },
                )
                QuietButton(
                    label = ResultText.CHOOSE_ANOTHER_ROUTE,
                    onClick = arrived(onHome),
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { RouteIcon() },
                )
            }
        }
    }
}

/** The test tag of the missed list's bottom fade cue (rule 8). */
const val MISSED_FADE_TAG = "result.missed.fade"

// The jolt's keyframes (BoardingPass.tsx JOLT): 0 to 1 by the peak time, back to 0 by the end, each part on the
// ease curve. With the system animator scale at 0 the progress jumps to 1 and the ticket stays at rest.
private fun joltOffset(progress: Float): Float {
    val peak = LeaveResultConstants.JOLT_PEAK_AT
    val ease = Tokens.Curves.ease
    return when {
        progress <= 0f || progress >= 1f -> 0f
        progress < peak -> ease.transform(progress / peak)
        else -> 1f - ease.transform((progress - peak) / (1f - peak))
    }
}
```

Run the command of step 20. Expected: `BUILD SUCCESSFUL` and `tests="10" failures="0" errors="0" skipped="0"` in the XML of step 15's `grep`. If only the no-clip tests fail and the clipped text named in the message belongs to task 13's ticket (a field value or a leg), fix that component's height or wrapping in task 13's file in this step, because README Review Focus 4 covers it; then run again.

- [ ] **Step 22: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/ScoreBlock.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/MissedCardsList.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/CompletedFlightPath.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/ResultScreen.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/ResultScreenTest.kt
git commit -m "feat: show the Android result with the comparison, the missed cards and the arrival guard"
```

(Add task 13's file to the `git add` if step 21 changed it, and say so in the message: `... and keep the ticket's fields unclipped at large text`.)

- [ ] **Step 23: Write the host test and watch it fail.** The host ties the round, the sheet, the scrim, the back gesture and the result together and routes every action to the round's owner (rule 1); the round's content is a stand-in with an X and the owner a fake, so the test needs no coordinator. The sheet is the real Material3 sheet: its back and Escape go through the platform, and the scrim tap is injected through the window manager.

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/RoundHostTest.kt`:

```kotlin
package com.eienmosu.truthy.round

import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.eienmosu.truthy.MonotonicClock
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.engine.RoundState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

private const val X_TAG = "test.x"

/**
 * The host routes; it decides nothing (rule 1). A fake owner stands in for task 11's AppViewModel and coordinator:
 * it records every call and keeps the sheet open or closed as the coordinator would after keepPlaying.
 */
@RunWith(AndroidJUnit4::class)
class RoundHostTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var now = 0.0
    private val clock = MonotonicClock { now }
    private val events = mutableListOf<String>()
    private var sheetOpen by mutableStateOf(false)
    private var scrimAccepted = false

    private val owner = object : RoundHostActions {
        override fun requestLeave() { events += "requestLeave" }
        override fun roundBack() { events += "roundBack" }
        override fun keepPlaying() {
            events += "keepPlaying"
            sheetOpen = false
        }
        override fun scrimTapAccepted(): Boolean {
            events += "scrimAsked"
            return scrimAccepted
        }
        override fun leaveRound() { events += "leaveRound" }
        override fun closeResult() { events += "closeResult" }
        override fun playAgain() { events += "playAgain" }
    }

    private fun host(state: RoundState?, best: Int? = null, open: Boolean = false) {
        sheetOpen = open
        rule.setContent {
            Themed {
                RoundHost(
                    round = state,
                    ticket = TestRounds.ticket(best),
                    sheetOpen = sheetOpen,
                    clock = clock,
                    actions = owner,
                    openSource = { events += "open $it" },
                ) { requestClose ->
                    Box(Modifier.fillMaxSize()) {
                        Box(Modifier.size(Tokens.Size.touchMin).testTag(X_TAG).clickable { requestClose() })
                    }
                }
            }
        }
        rule.waitForIdle()
    }

    private fun back() {
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }
        rule.waitForIdle()
    }

    private fun key(code: Int) {
        InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(code)
        rule.waitForIdle()
    }

    @Test
    fun theXAsksTheOwnerToLeave() {
        host(TestRounds.classic(answers = 2, finish = false))
        rule.onNodeWithTag(X_TAG).performClick()
        rule.waitForIdle()
        assertEquals(listOf("requestLeave"), events)
        rule.onNodeWithText(LeaveText.TITLE).assertDoesNotExist()
    }

    @Test
    fun backOnTheRoundGoesToTheOwnersRoundBack() {
        host(TestRounds.classic(answers = 2, finish = false))
        back()
        assertEquals(listOf("roundBack"), events)
    }

    @Test
    fun anOpenSheetShowsTheCardAndKeepPlayingCallsKeepPlaying() {
        host(TestRounds.classic(answers = 2, finish = false), open = true)
        rule.onNodeWithText(LeaveText.TITLE).assertIsDisplayed()
        rule.onNodeWithText(LeaveText.OPEN_BODY).assertIsDisplayed()
        rule.onNodeWithText(LeaveText.KEEP_PLAYING).performClick()
        rule.waitForIdle()
        assertEquals(listOf("keepPlaying"), events)
        rule.onNodeWithText(LeaveText.TITLE).assertDoesNotExist()
    }

    @Test
    fun leaveRoundGoesToTheOwnersLeaveRound() {
        host(TestRounds.streakEndedUnopened(), open = true)
        rule.onNodeWithText(LeaveText.DECIDED_BODY).assertIsDisplayed()
        rule.onNodeWithText(LeaveText.LEAVE_ROUND).performClick()
        rule.waitForIdle()
        assertEquals(listOf("leaveRound"), events)
    }

    @Test
    fun theSystemBackKeyOnTheSheetKeepsPlaying() {
        host(TestRounds.classic(answers = 2, finish = false), open = true)
        key(KeyEvent.KEYCODE_BACK)
        rule.onNodeWithText(LeaveText.TITLE).assertDoesNotExist()
        assertEquals(listOf("keepPlaying"), events)
    }

    @Test
    fun escapeOnTheSheetKeepsPlaying() {
        host(TestRounds.classic(answers = 2, finish = false), open = true)
        key(KeyEvent.KEYCODE_ESCAPE)
        rule.onNodeWithText(LeaveText.TITLE).assertDoesNotExist()
        assertEquals(listOf("keepPlaying"), events)
    }

    @Test
    fun theScrimAsksTheCoordinatorsGuardBeforeItKeepsPlaying() {
        host(TestRounds.classic(answers = 2, finish = false), open = true)
        scrimAccepted = false
        rule.tapAbove(SHEET_CARD_TAG)
        rule.waitForIdle()
        rule.onNodeWithText(LeaveText.TITLE).assertIsDisplayed()
        assertTrue("the guard was asked", "scrimAsked" in events)
        assertTrue("no dismissal yet", "keepPlaying" !in events)
        scrimAccepted = true
        rule.tapAbove(SHEET_CARD_TAG)
        rule.waitForIdle()
        rule.onNodeWithText(LeaveText.TITLE).assertDoesNotExist()
        assertEquals("keepPlaying", events.last())
    }

    @Test
    fun theResultsActionsGoToTheOwner() {
        host(TestRounds.classic(), best = 9)
        rule.onNodeWithText(ResultText.shortOfBest(2)).assertExists()
        now = 1_000.0
        rule.onNodeWithContentDescription(ResultText.CLOSE_RESULTS).performClick()
        rule.onNodeWithText(ResultText.PLAY_AGAIN).performClick()
        rule.onNodeWithText(ResultText.CHOOSE_ANOTHER_ROUTE).performClick()
        back()
        assertEquals(listOf("closeResult", "playAgain", "closeResult", "roundBack"), events)
    }

    @Test
    fun theSheetLeavesTheActivityResumedSoTheTimedClockRuns() {
        host(TestRounds.classic(answers = 2, finish = false), open = true)
        rule.onNodeWithText(LeaveText.TITLE).assertIsDisplayed()
        assertEquals(Lifecycle.State.RESUMED, rule.activity.lifecycle.currentState)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.round.RoundHostTest
```

Expected: FAIL at `:app:compileDebugAndroidTestKotlin` with `Unresolved reference 'RoundHost'`, then `BUILD FAILED`.

- [ ] **Step 24: Write `RoundHost.kt` and run the host test green.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundHost.kt`:

```kotlin
package com.eienmosu.truthy.round

import android.os.SystemClock
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.eienmosu.truthy.AppViewModel
import com.eienmosu.truthy.MonotonicClock
import com.eienmosu.truthy.RoundCoordinator
import com.eienmosu.truthy.RoundLoad
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.isDecided

/**
 * What the host asks of the round's owner (rule 1): task 11's AppViewModel and RoundCoordinator in the app
 * (RoundHostRoute), a fake in RoundHostTest. The owner decides; the host only routes.
 */
interface RoundHostActions {
    /** The X and Escape: AppViewModel.requestLeave (leave at once, or open the sheet). */
    fun requestLeave()

    /** Back on the round surface: AppViewModel.roundBack. */
    fun roundBack()

    /** Every dismissal of the sheet: the coordinator's keepPlaying. */
    fun keepPlaying()

    /** The scrim and swipe-down guard (rule 4): true in the app unless spec 5.4's double-tap story fails; then the coordinator's. */
    fun scrimTapAccepted(): Boolean

    /** "Leave round": AppViewModel.leaveRound. */
    fun leaveRound()

    /** "Close results" and "Choose another route": AppViewModel.closeResult. */
    fun closeResult()

    /** "Play again": AppViewModel.playAgain. */
    fun playAgain()
}

/**
 * The round's top-level screen (spec 5.2): the round or its result inside the back surface, the web's scrim and the
 * leave sheet. `round` null is loading; `sheetOpen` is the coordinator's. The X and Escape (in `content`, through
 * requestClose), back, the sheet and the result's actions all go to `actions` (rule 1).
 */
@Composable
fun RoundHost(
    round: RoundState?,
    ticket: TicketInfo?,
    sheetOpen: Boolean,
    clock: MonotonicClock,
    actions: RoundHostActions,
    modifier: Modifier = Modifier,
    openSource: (String) -> Unit = rememberSourceOpener(),
    content: @Composable (requestClose: () -> Unit) -> Unit,
) {
    val showsResult = round != null && ticket != null && round.phase == Phase.FINISHED && !round.abandoned
    // Rule 7: the result's own 1000 ms counts from its first frame.
    val resultShownAt = remember(showsResult) { if (showsResult) clock.nowMs() else null }
    Box(modifier.fillMaxSize()) {
        RoundBackSurface(enabled = !sheetOpen, onBack = actions::roundBack) {
            val shownRound = round
            val shownTicket = ticket
            val shownAt = resultShownAt
            if (showsResult && shownRound != null && shownTicket != null && shownAt != null) {
                ResultScreen(
                    round = shownRound,
                    ticket = shownTicket,
                    shownAt = shownAt,
                    clock = clock,
                    onClose = actions::closeResult,
                    onPlayAgain = actions::playAgain,
                    onHome = actions::closeResult,
                    openSource = openSource,
                )
            } else {
                content(actions::requestLeave)
            }
        }
        // Rule 5: the web's scrim in the activity's window, under the sheet's window; it fades out when the sheet closes.
        LeaveScrim(visible = sheetOpen)
    }
    val open = round
    if (sheetOpen && open != null) {
        LeaveSheet(
            decided = isDecided(open),
            scrimTapAccepted = actions::scrimTapAccepted,
            onKeepPlaying = actions::keepPlaying,
            onLeave = actions::leaveRound,
        )
    }
}

/** SystemClock.uptimeMillis, the clock of the coordinator's guards (README, MonotonicClock). */
private val UPTIME = MonotonicClock { SystemClock.uptimeMillis().toDouble() }

/** The host on task 11's objects: the round of `load`, its sheet flag and the app's actions (for TruthyRoot). */
@Composable
fun RoundHostRoute(app: AppViewModel, load: RoundLoad, modifier: Modifier = Modifier) {
    when (load) {
        is RoundLoad.Ready -> ReadyRound(app, load.coordinator, modifier)
        else -> {
            val actions = remember(app) { appActions(app, null) }
            RoundHost(round = null, ticket = null, sheetOpen = false, clock = UPTIME, actions = actions, modifier = modifier) { requestClose ->
                RoundLoading(onRequestLeave = requestClose)
            }
        }
    }
}

@Composable
private fun ReadyRound(app: AppViewModel, coordinator: RoundCoordinator, modifier: Modifier) {
    val round by coordinator.state.collectAsStateWithLifecycle()
    val sheetOpen by coordinator.sheetOpen.collectAsStateWithLifecycle()
    val actions = remember(app, coordinator) { appActions(app, coordinator) }
    RoundHost(round = round, ticket = coordinator.ticket, sheetOpen = sheetOpen, clock = UPTIME, actions = actions, modifier = modifier) { requestClose ->
        RoundRoute(coordinator, onRequestLeave = requestClose, sheetOpen = sheetOpen)
    }
}

private fun appActions(app: AppViewModel, coordinator: RoundCoordinator?): RoundHostActions = object : RoundHostActions {
    override fun requestLeave() = app.requestLeave()
    override fun roundBack() = app.roundBack()
    override fun keepPlaying() {
        coordinator?.keepPlaying()
    }
    override fun scrimTapAccepted(): Boolean = true // spec 5.4: wired to coordinator?.scrimTapAccepted() only if task 15's double-tap story fails
    override fun leaveRound() = app.leaveRound()
    override fun closeResult() {
        app.closeResult()
    }
    override fun playAgain() {
        app.playAgain()
    }
}
```

Run the command of step 23. Expected: `BUILD SUCCESSFUL` and `tests="9" failures="0" errors="0" skipped="0"` in the XML of step 15's `grep`. Two failures have a known meaning: if `escapeOnTheSheetKeepsPlaying` fails, the key reached neither the card's handler nor the fallback to back (check that "Keep playing" holds focus once the sheet is shown); if `theScrimAsksTheCoordinatorsGuardBeforeItKeepsPlaying` fails on its first tap, Material is not asking `confirmValueChange` before the scrim hides the sheet (read the installed version's `ModalBottomSheet`; with 1.4.0 `animateToDismiss` asks it). `rememberSourceOpener` is task 13's (one definition in the package; this file adds none).

- [ ] **Step 25: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/round/RoundHost.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/round/RoundHostTest.kt
git commit -m "feat: host the Android round with the sheet, the scrim, back and the result, routed to the app's owner"
```

- [ ] **Step 26: Wire `RoundHost` into the app.** The round screen of task 13 becomes the host's content through `RoundHostRoute`; the X and Escape of task 13 reach `AppViewModel.requestLeave()`; the round's only back handler is the host's.

```bash
cd android/Truthy
grep -rn 'RoundRoute(\|RoundLoading(' app/src/main
grep -rn 'TopScreen.Round' app/src/main
grep -rln 'BackHandler\|PredictiveBackHandler' app/src/main/kotlin/com/eienmosu/truthy/round app/src/main/java 2>/dev/null
```

Expected: the calls of `RoundRoute(` and `RoundLoading(` in the `is TopScreen.Round ->` branch of `TruthyRoot.kt` (task 13, step 20) and in this task's `RoundHost.kt`; `TopScreen.Round` in `TruthyRoot.kt` and task 11's files; no back handler in the round's files other than `RoundBackSurface.kt`. If a round file of task 13 registers a `BackHandler` or `PredictiveBackHandler`, delete that call and its imports (rule 2: the handler composed last wins, and it would sit inside the host's surface).

In `android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt`, add `import com.eienmosu.truthy.round.RoundHostRoute` and replace the round branch that task 13 wrote:

```kotlin
                is TopScreen.Round -> Box(Modifier.fillMaxSize().testTag(ROUND_TAG)) {
                    // Until task 14 adds the leave sheet and back on the round, the X leaves at once with the leave
                    // rules (task 11's leaveRound: the coordinator's leave, then start step 1).
                    when (val load = current.load) {
                        is RoundLoad.Ready -> RoundRoute(load.coordinator, onRequestLeave = { app.leaveRound() })
                        else -> RoundLoading(onRequestLeave = { app.leaveRound() })
                    }
                }
```

with:

```kotlin
                is TopScreen.Round -> Box(Modifier.fillMaxSize().testTag(ROUND_TAG)) {
                    // The round, its sheet, its scrim, back and the result; every decision is task 11's.
                    RoundHostRoute(app, current.load)
                }
```

The imports of `RoundRoute` and `RoundLoading` may stay or go; nothing else in the file changes. The debug launch's leave sheet (`truthy.screen sheet`) needs nothing here: task 11's coordinator opens its own `sheetOpen`, which the host shows.

Run:

```bash
cd android/Truthy
./gradlew :engine:test :tokengen:test :app:testDebugUnitTest :app:assembleDebug
./gradlew :app:connectedDebugAndroidTest
```

Expected: `BUILD SUCCESSFUL` for both. The unit test results include this task's 14 new JVM tests (`LeaveResultTextTest` 5, `RoundBackTest` 4, `LeaveBodyTest` 1, `CompletedMarksTest` 4) with no failure; the connected run includes this task's 30 instrumented tests (`LeaveSheetCardTest` 5, `LeaveSheetFadeTest` 3, `RoundBackSurfaceTest` 3, `ResultScreenTest` 10, `RoundHostTest` 9) and every earlier task's instrumented tests, with no failure:

```bash
grep -ho 'tests="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/outputs/androidTest-results/connected/debug/*.xml
```

- [ ] **Step 27: Play it once on the API 36 emulator.**

```bash
cd android/Truthy
./gradlew :app:installDebug
adb shell am start -n com.eienmosu.truthy/.MainActivity
```

On the emulator: start a Classic round; press the X before answering (expected: start step 1 at once); start again, answer one card, swipe back from the left edge slowly (expected: the round shrinks towards 0.94 and follows the finger), lift with the finger back at the edge (expected: it springs back and nothing happens), swipe back fully (expected: "Leave round?" rises); tap the scrim (expected: the sheet closes, the round goes on); open it again and tap "Leave round" (expected: start step 1, and the Continue line offers the round without a score); play a round to "See results" (expected: the result with the completed route, "First round on this route" or a comparison, the missed cards); press back at once (expected: nothing), then after a second (expected: start step 1). Nothing to commit.

- [ ] **Step 28: Run the web's gates and commit the wiring.**

```bash
pnpm test
node -e "const fs=require('fs');const t=fs.readFileSync('docs/superpowers/plans/2026-10-15-truthy-native-c-android/14-leave-result.md','utf8');console.log(t.includes(String.fromCharCode(0x2014))?'em dash found':'no em dash')"
git add android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt
git add -u android/Truthy/app/src/main
git status --short
git commit -m "feat: show the Android round through its host with the leave sheet, back and the result"
```

Expected: `pnpm test` passes (its hygiene test reads every tracked file, the new Kotlin included: no absolute path, no e-mail-shaped string, no em dash); `no em dash`; `git status --short` before the commit lists only `TruthyRoot.kt` (and any task 13 file whose back handler step 26 removed) as staged; one commit. `git log --oneline -9` shows this task's commits in order.
