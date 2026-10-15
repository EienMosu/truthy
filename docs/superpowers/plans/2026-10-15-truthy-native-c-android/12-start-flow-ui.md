### Task 12: The start flow screens: the fill-in pass, Recent, Continue, the theme switch, the forward motion, predictive back driving the back motion, reduced motion and Escape

This task draws the start flow. Tasks 5 and 11 already decide everything about it that is not a picture: the six steps, which of them a path passes through, the settle time, the ways back, what Continue and Start round do, and (in `BackTransition`) the web's back motion written as a function of progress. Here that becomes the screen the player sees and touches, ported from `components/start/StartFlow.tsx`, `components/FillInPass.tsx`, `components/passValueTravel.ts`, `components/start/ContinueLine.tsx`, `components/ThemeSwitch.tsx` and `components/start/listCue.ts`: the logo and tagline on step 1 with Recent first when two or more decks have been played, the Back pill and the fill-in pass in its three layouts from step 2 on, the destination cards of each step with their labels, the bottom fade on long lists, the continue line and Start round in the foot zone, the theme switch on every step, the chosen name travelling into its field and the pass changing shape, and the empty paper unrolling before the round opens.

The native part is the way back (spec 5.1, decision D8). Every way back (predictive back, the Back pill, a field of the pass, "Change platform" on the recent path, Escape) plays the web's back motion through task 11's `BackTransition`. Predictive back on Android 14 and later feeds the system's progress into it and springs back on a cancel; on Android 13 and lower the handler gets no progress events and the back commits at once, so the final frame of the motion must be the arriving step at rest (Review Focus 1, tested here in a unit test of `BackTransition` read through this task's layers, and on the emulator through the dispatcher's test entry points). Reduced motion (`ANIMATOR_DURATION_SCALE` 0) keeps every way back and turns the motion into the web's reduced fades, which run with a `MotionDurationScale` of 1 so the system's zero scale does not swallow them (Review Focus 4). Escape goes back one step, is consumed on step 1 and during the unroll, and a held key acts once.

**This task was not compiled during drafting.** Nothing in this file was compiled or run while the plan was written, so every Kotlin line below was checked by reading against the AndroidX sources and reference pages of the pinned stack (Compose UI 1.12, Foundation, activity-compose 1.13, kotlinx-coroutines) and against the Produces blocks of tasks 5, 8, 10 and 11 of this plan, never by a compiler or an emulator. After the review, tasks 1 to 15 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: the JVM tests and, on the API 36 emulator, the instrumented tests. The defects that run found are fixed in this file (README, Drafting record). If the compiler rejects a line, fix the line, not the test, and keep the behaviour the step states. Tasks 10 and 11 were drafted at the same time as this file: step 1 checks every name this task takes from them.

Builds on tasks 1 to 11. From task 5: the start-flow step helpers, the catalog helpers, the list cue and the labels. From task 4: `bestFor`, `SWIPE`. From task 8: `Tokens`, `TruthyType`, `TruthyTheme`. From task 10: `SkyBackdrop`, `Logo`, `LogoMark`, `TruthyIcon`, `BackPill`, `PillButton`, `RoundButton`, `DestinationCard`, `truthyShadow`, `rememberPressTint`, `rememberPressProgress`, `pressFeedback` and `LocalReducedMotion`, which this task provides for the start flow's tree. From task 11: `AppViewModel` (`startFlow`, `theme`, `switchTheme`, `openRound`, `retryCatalog`), `StartFlowModel` (the step view, the catalog, the settle time, the ways back, the short-screen hold, Continue, Start round), `BackTransition` and `BackFrame`, `TruthyRoot` and `START_TAG`, and `MainActivity`.

**Files:**
- Create (all under `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/`): `StartCopy.kt`, `StartOptions.kt`, `FrWidths.kt`, `StartGeometry.kt`, `StepMotion.kt`, `BackLayers.kt`, `BackGesture.kt`, `StartKeys.kt`, `ReducedMotion.kt`, `StartModifiers.kt`, `Travels.kt`, `FillInPass.kt`, `ContinueLine.kt`, `ThemeSwitch.kt`, `StepPanel.kt`, `StartMotion.kt`, `StartFlowScreen.kt`, `StartFlowRoute.kt`
- Create: `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/HardwareKeys.kt`
- Modify: `android/Truthy/app/src/main/java/com/eienmosu/truthy/MainActivity.kt` (route hardware keys first), `android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt` (the start root draws the start flow, and reduced motion is provided at the root), `android/Truthy/app/build.gradle.kts` (Material3, step 2), `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/DestinationCard.kt` (a modifier for the card's name, so the name's box can be measured), and, only if step 1 finds them missing, `android/Truthy/gradle/libs.versions.toml` and `android/Truthy/app/build.gradle.kts` (instrumented test dependencies)
- Test (all under `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/`): create `StartFixtures.kt`, `LayersAssert.kt`, `StartOptionsTest.kt`, `FrWidthsTest.kt`, `StepMotionTest.kt`, `BackTransitionCommitTest.kt`, `BackGestureTest.kt`, `StartKeysTest.kt`, `ReducedMotionTest.kt`
- Test (instrumented): create `android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/start/StartFlowTest.kt`

**Interfaces:**
- Consumes (exact names from the Produces blocks of the task files; step 1 checks each in the code):

```kotlin
// task 5, package com.eienmosu.truthy.engine (05-catalog-flow.md)
enum class Step(val number: Int) { ONE(1), TWO(2), THREE(3), FOUR(4), FIVE(5), SIX(6) }   // compares in order
const val RECENT = "recent"
data class StartChoice(val via: String? = null, val areaId: String? = null, val platformId: String? = null, val deckId: String? = null, val sectionId: String? = null, val mode: Mode? = null)
fun clearFrom(choice: StartChoice, step: Step): StartChoice
fun previousStep(step: Step, hasSections: Boolean, recent: Boolean = false): Step
data class ModeInfo(val id: Mode, val name: String, val description: String, val unit: String, val offered: Boolean)
val MODE_TABLE: List<ModeInfo>
fun modeInfo(mode: Mode, table: List<ModeInfo> = MODE_TABLE): ModeInfo
fun lastScoreText(mode: Mode, score: Int, total: Int): String
data class RouteInIndex(val area: IndexArea, val platform: IndexPlatform, val deck: IndexDeck, val section: IndexSection?)
fun deckPassName(platform: IndexPlatform, deck: IndexDeck): String
data class ContinueTarget(val route: Route, val mode: Mode, val found: RouteInIndex, val lastScore: LastScore?)   // LastScore(score, total)
data class RecentDeck(val area: IndexArea, val platform: IndexPlatform, val deck: IndexDeck, val lastSeenAt: Double)
fun deckCount(area: IndexArea): Int
fun deckCount(platform: IndexPlatform): Int
fun decksLabel(count: Int): String
fun seenPercent(progress: Progress, deck: IndexDeck, cardIds: List<String>? = null): Int
fun continueTarget(index: DeckIndex, progress: Progress, table: List<ModeInfo> = MODE_TABLE): ContinueTarget?
const val FADE_PX: Double = 28.0
data class ItemSpan(val top: Double, val bottom: Double)
data class ListCue(val more: Boolean, val lift: Double)
fun listCue(viewHeight: Double, contentBottom: Double, items: List<ItemSpan>): ListCue
fun revealDelta(viewHeight: Double, item: ItemSpan, room: Double): Double
enum class PassFieldName(val wire: String, val changeWord: String) { AREA, PLATFORM, DECK, SECTION, MODE }
fun changeLabel(field: PassFieldName, value: String): String
fun continueLabel(deckName: String, sectionTitle: String, modeLabel: String, lastScore: String? = null, needsConnection: Boolean = false): String

// tasks 1 and 4, package com.eienmosu.truthy.engine
fun bestFor(progress: Progress, route: Route, mode: Mode): Int?
data class SwipeConstants(val commitPx: Double, val flingPx: Double, val flingVelocity: Double, val settleMs: Double, val edgePx: Double)
val SWIPE: SwipeConstants
enum class Theme(val wire: String) { LIGHT("light"), DARK("dark") }

// task 8, package com.eienmosu.truthy.design (08-tokens-theme.md)
object Tokens       // Space (s2..s24), Size, Radius, Stroke, Duration, Curves, SpringTransitions (TransitionSpec(durationMs, delayMs, easing))
object TruthyType   // stepTitle, tagline, cardName, deckCode, fieldLabel, fieldValue, fieldValuePass, passCode, passLine, legCode, legName,
                    // carrierTitle, carrierLabel, carrierTitleCompact, carrierLabelCompact, continueDeckName, monoData, button
object TruthyTheme { val colors: TruthyColors; val shadows: TruthyShadows }   // @Composable getters
class ResolvedTheme { val theme: Theme }

// task 10, package com.eienmosu.truthy.design (10-components.md)
enum class IconId { CLOSE, CROSS, CHECK, BACK_HEADER, BACK_PILL, FORWARD, CHEVRON_RIGHT, CHEVRON_DOWN, PLANE, CLOUD, SKY_CLOUD, BOOK, REPLAY, CLOCK, STAR, HEART, HEART_LOST, MOON, SUN }
@Composable fun TruthyIcon(id: IconId, modifier: Modifier = Modifier, tint: Color = TruthyTheme.colors.ink, width: Dp? = null, strokeWidth: Float? = null, label: String? = null)
enum class LogoVariant { FULL, COMPACT }
@Composable fun LogoMark(modifier: Modifier = Modifier, width: Dp = 44.dp, variant: LogoVariant = LogoVariant.FULL)
@Composable fun Logo(modifier: Modifier = Modifier, asHeading: Boolean = false)
@Composable fun Modifier.truthyShadow(spec: ShadowSpec, cornerRadius: Dp = Tokens.Radius.card, alpha: () -> Float = { 1f }): Modifier
enum class LowerCloud(val top: Float) { GAME(620f), START(660f) }
@Composable fun SkyBackdrop(modifier: Modifier = Modifier, lowerCloud: LowerCloud = LowerCloud.GAME)
val LocalReducedMotion: ProvidableCompositionLocal<Boolean>
object PressFeedback { const val CONTINUE_SCALE = 0.98f /* and the others */ }
@Composable fun rememberPressProgress(interactionSource: InteractionSource, active: Boolean = true): State<Float>
fun Modifier.pressFeedback(progress: State<Float>, pressedScale: Float, drop: Dp = 0.dp): Modifier
@Composable fun rememberPressTint(cornerRadius: Dp): PressTint            // an IndicationNodeFactory: the `press` colour, bounded
// task 10, package com.eienmosu.truthy.ui
@Composable fun PillButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, tone: PillTone = PillTone.INK, dimmed: Boolean = false, leadingIcon: (@Composable () -> Unit)? = null, trailingIcon: (@Composable () -> Unit)? = null)
@Composable fun RoundButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, variant: RoundVariant = RoundVariant.RAISED, enabled: Boolean = true, content: @Composable () -> Unit)
@Composable fun BackPill(description: String, onClick: () -> Unit, modifier: Modifier = Modifier, text: String = "Back")
enum class DestinationVariant { PLACE, DECK, SECTION, CLASS }
data class CardStub(val label: String, val value: String, val unit: String? = null, val muted: Boolean = false)
@Composable fun DestinationCard(variant: DestinationVariant, name: String, label: String, modifier: Modifier = Modifier, onSelect: (() -> Unit)? = null,
    code: Boolean = false, sub: String? = null, detail: String? = null, seenPercent: Int? = null, stub: CardStub? = null, unavailable: Boolean = false, nameHidden: Boolean = false)

// task 11, package com.eienmosu.truthy (11-app-state.md)
fun interface MonotonicClock { fun nowMs(): Double }; object SystemMonotonicClock : MonotonicClock
data class BackLayer(val alpha: Float, val offsetY: Float)                    // offsetY in dp, positive is down
data class BackTransition(val from: Step, val to: Step, val itemCount: Int) { fun durationMs(reducedMotion: Boolean): Int; fun frame(p: Float, reducedMotion: Boolean): BackFrame }
data class BackFrame(val transition: BackTransition, val timeMs: Float, val reducedMotion: Boolean) {
    val oldPanel: BackLayer; val oldTitleAlpha: Float; fun newItem(index: Int): BackLayer
    val topSwap: Boolean; val tripOut: BackLayer; val brandIn: BackLayer; val switchShift: Float
    val footOut: BackLayer; val footIn: BackLayer; val dashAlpha: Float
    val stageChange: Boolean; val oldBlockAlpha: Float; val newBlockAlpha: Float; val morph: Float
}
data class RoundRequest(val route: Route, val mode: Mode)
enum class Direction { FORWARD, BACK }
data class StartView(val step: Step, val choice: StartChoice, val dir: Direction, val focusId: String? = null, val travel: PassFieldName? = null, val seq: Int = 0, val fromRound: Boolean = false)
data class Catalog(val index: DeckIndex, val progress: Progress, val cardIds: Map<String, List<String>>, val recent: List<RecentDeck>)
sealed interface CatalogState { data object Loading; data object Failed; data class Ready(val catalog: Catalog) }
class StartFlowModel {
    val view: StateFlow<StartView>; val catalog: StateFlow<CatalogState>; val boarding: StateFlow<Boolean>
    fun choose(step: Step, choice: StartChoice, field: PassFieldName? = null): Boolean; fun continueLast(): Boolean
    fun back(to: Step): Boolean; fun back(): Boolean; fun backTransition(itemCount: Int): BackTransition?
    fun tapBack(): Boolean; fun jump(field: PassFieldName): Boolean; fun columnJumped(); fun arrivalFocusTaken()
    fun startRound(): RoundRequest?
}
sealed interface TopScreen { data object Start; data class Round(...) }
class AppViewModel : ViewModel { val startFlow: StartFlowModel; val theme: StateFlow<ResolvedTheme>; fun switchTheme(): Theme; fun openRound(request: RoundRequest); fun retryCatalog() }
const val START_TAG = "truthy.start"; @Composable fun TruthyRoot(app: AppViewModel)   // app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt
class MainActivity : ComponentActivity()                                                // app/src/main/java/com/eienmosu/truthy/MainActivity.kt
// task 11's AppGraph: FileProgressStore(context.filesDir), RoundJournal(context.filesDir), ThemeStore(getSharedPreferences(ThemeStore.PREFS_NAME = "truthy"))
```

- Produces (later tasks rely on these names; task 13 may reuse `HardwareKeys`, `rememberReducedMotion`, `motionContext` and `FullSpeed`; task 15 runs `StartFlowTest` and reads the screen's labels):

```kotlin
// package com.eienmosu.truthy
object HardwareKeys { fun register(handler: (KeyEvent) -> Boolean): () -> Unit; fun dispatch(event: KeyEvent): Boolean }   // last registered wins
@Composable fun HardwareKeyHandler(onKey: (KeyEvent) -> Boolean)

// package com.eienmosu.truthy.ui (added to task 10's DestinationCard, default keeps every existing call)
@Composable fun DestinationCard(..., nameHidden: Boolean = false, nameLayout: Modifier = Modifier)

// package com.eienmosu.truthy.start
enum class PassStage { DESTINATION, ROUTE, READY }
object StartCopy                                   // every start-flow string of reference 4.5
fun stepTitle(step: Step): String
fun backLabel(step: Step, hasSections: Boolean, recent: Boolean): String
fun stageOf(step: Step): PassStage
fun nowField(step: Step): PassFieldName?
fun fieldStep(field: PassFieldName): Step
fun readyLine(description: String): String
data class StartData(val index: DeckIndex, val progress: Progress, val cardIds: Map<String, List<String>>, val recent: List<RecentDeck>)
data class PanelSnapshot(val step: Step, val choice: StartChoice)
data class ResolvedChoice(...) { val hasSections: Boolean }
fun resolveChoice(index: DeckIndex, choice: StartChoice, table: List<ModeInfo> = MODE_TABLE): ResolvedChoice
fun backTarget(index: DeckIndex, snapshot: PanelSnapshot): Step
data class PassValues(...); fun passValues(resolved: ResolvedChoice): PassValues
sealed interface PassBlock; data class DestinationBlock(...); data class RouteBlock(...); data class ReadyBlock(...)
fun passBlock(stage: PassStage, values: PassValues, now: PassFieldName?, sectionChoosable: Boolean): PassBlock
data class OptionModel(...); data class Forward(val step: Step, val choice: StartChoice, val field: PassFieldName?)
fun stepOptions(data: StartData, snapshot: PanelSnapshot, table: List<ModeInfo> = MODE_TABLE): List<OptionModel>
fun itemCount(data: StartData?, snapshot: PanelSnapshot): Int
data class ContinueModel(...); fun continueModel(data: StartData, table: List<ModeInfo> = MODE_TABLE): ContinueModel?
fun frWidths(total: Int, fractions: List<Float>, mins: List<Int>): List<Int>
data class Layer(val alpha: Float, val offsetY: Float); data class StepLayers(...); data class Swaps(...)
fun forwardLayers(tMs: Float, itemCount: Int, reduced: Boolean, swaps: Swaps): StepLayers
fun forwardDurationMs(itemCount: Int, reduced: Boolean): Int
fun remainingMs(lastProgress: Float?, totalMs: Int): Int
fun backLayers(frame: BackFrame, itemCount: Int, swaps: Swaps): StepLayers
sealed interface BackEnd { data class Committed(val lastProgress: Float?); data object Cancelled }
suspend fun followBack(progress: Flow<Float>, onProgress: (Float) -> Unit, onEnd: (BackEnd) -> Unit)
enum class StartKey { BACK, CONSUME, PASS }
fun startKeyAction(keyCode: Int, action: Int, repeatCount: Int, step: Step, boarding: Boolean): StartKey
fun isReducedMotion(animatorDurationScale: Float): Boolean
object FullSpeed : MotionDurationScale
fun motionContext(reduced: Boolean): CoroutineContext
@Composable fun rememberReducedMotion(): Boolean
data class StartFlowUi(...)                        // the model's view, catalog, boarding and theme, as the screen reads them
interface StartFlowActions                          // what the screen asks of the model and the app
@Composable fun StartFlowScreen(ui: StartFlowUi, actions: StartFlowActions)
@Composable fun StartFlowRoute(app: AppViewModel)
```

**Rules:**

1. **The screen draws what the motion shows, not what the model says.** `StartMotion` holds `shown` (the step and choices drawn as current) and `leaving` (the step on its way out). A change of the model's `StartView.seq` starts the forward motion when its `dir` is `FORWARD` and the back motion over time when it is `BACK`. A gesture moves `shown` to the step behind before the model knows anything; the model is told (`back(to)`) only when the gesture commits, so the model's change that follows matches `shown` and starts nothing.
2. **Forward** (StartFlow.tsx:230-269, FillInPass.tsx:131-132, 379-385; reference 5.7): the old panel rises 10 and fades over 140 `ease-out`, its title fades inside it over 80; the new step's items (the title first, then each option) rise from 24 below over 240 `ease` after 110 plus 25 per item; the dashes of a field being filled leave over 100 `ease-out` after 120; a pass that changes layout cross-fades its blocks (old out over 120 `ease-out`, new in over 220 `ease` after 90) while its band and body change height over 360 `ease`; the top and foot zones swap over 110 out and 240 in after 120, 12 of travel; the theme switch moves between the logo row (32 down) and the Back pill row over 240. The chosen name travels from its card into its field over 300 `ease` after 60 (the model's `StartView.travel` names the field); the class never travels, because its ready field is in another typeface (StartFlow.tsx:735-736). Values that sit on both layouts of a changing pass travel as two cross-fading copies over 360 (passValueTravel.ts): the old copy is gone by 60 percent, the new one comes in from 40 percent. Value travel runs forward, on a back over time and under a gesture, where the frame's `timeMs` is its clock.
3. **Back.** Every way back plays `BackTransition(from, to, itemCount).frame(p, reduced)` through `backLayers`. The Back pill (`tapBack`), a pass field (`jump`, which also opens the platform's own deck step on the recent path) and Escape (`back()`) change the model at once; the screen then plays p from 0 to 1 over `durationMs` (the web's own back, the same timeline with dir = -1). Predictive back (`PredictiveBackHandler`, enabled exactly when the step is not 1 or the pass is boarding) takes `startFlow.backTransition(itemCount)` and scrubs p with the system's progress: release commits, plays the rest of p over the remaining share of the duration and then calls `back(transition.to)`; a release without any progress event (Android 13 and lower, and `onBackPressed()`) commits at once with the frame at p = 1, which `BackTransitionCommitTest` pins as the arriving step at rest; a cancel springs p back to 0 over `Tokens.SpringTransitions.snap` and changes nothing. A gesture always goes back exactly one step. A forward motion still running when a back begins jumps to its end first. On step 1 the handler is disabled, so back belongs to the system (spec 5.1, feel item N2). From Start round until the round replaces the flow every back and every Escape is consumed and does nothing.
4. **Reduced motion** is `Settings.Global.ANIMATOR_DURATION_SCALE` equal to 0, read at first composition and on every change of the setting, and provided once at the app root (`TruthyRoot`, step 25) as task 10's `LocalReducedMotion`, so the round, the leave sheet, the result and task 10's components see the real value too; `StartFlowScreen` reads it from there and provides nothing. The start flow then uses the web's reduced fades (StartFlow.tsx:247-260, FillInPass.tsx:382-383): the old step out over 100, the new one in over 140 after 90, the pass blocks and the zones the same, no movement, no name or value travel, no unroll (the round opens at once). Every one of these fades runs inside `motionContext(true)`, which carries `FullSpeed` (a `MotionDurationScale` of 1), because the system's scale of 0 would end them at once. With motion on, the system's own scale applies.
5. **Escape** (StartFlow.tsx:653-660, spec section 2): a key-down with no repeat goes back one step (`back()`, never held); on step 1 and while boarding it is consumed and does nothing, so Android never turns it into back; its key-up and its repeats are consumed. `HardwareKeys` sees every key in `MainActivity.dispatchKeyEvent` before the views do, and only while the start flow is on screen.
6. **Guards** are the model's (reference 4.3): the 250 ms settle time of options, Continue and Start round, and the 250 ms hold of the Back pill and the pass fields after the short-screen column jumped to its top. The screen's only part is to call `columnJumped()` when, on a short screen (under 568 tall), a step arrives while the column was scrolled and the column jumps back to its top (StartFlow.tsx:493-501).
7. **Press feedback** (spec 5.6, reference 5.7): the pass's ways back (radius 6) and the continue line (radius 16) take task 10's `rememberPressTint` as their indication, and the continue line also scales to `PressFeedback.CONTINUE_SCALE`; the cards, the pills, the Back pill and the theme switch bring their own press from task 10.
8. **No literal design values in composables.** Colours, type, durations, curves, radii, sizes and spacing come from `Tokens`, `TruthyType` and `TruthyTheme`. The few values the web's code draws that no token holds live in `StartGeometry`, `Breakpoints` and `StartMotionTimes`, each with the web line it comes from. The short-screen rule (under 568) and the step title's 36 row are plan A's native group, `Tokens.Native.shortScreenBelow` and `Tokens.Native.stepTitleRow`, and are written nowhere else.
9. **Copy** is `StartCopy`, verbatim from reference 4.5, plus the engine's `changeLabel`, `continueLabel`, `decksLabel` and `lastScoreText`.
10. **Accessibility** (reference 4.4, 4.5, 5.9): each step title is a heading and takes focus on a forward step and on the arrival from a round (then `arrivalFocusTaken()`); going back, the card the model names (`StartView.focusId`) is scrolled into view (`revealDelta` with 8 of room) and takes focus; option lists are collections; the pass body is a polite live region; a blank field says "not chosen"; the Gate says "False left, true right"; every card, field and button has the full-sentence label of 4.5; the leaving panel and the travelling copies are hidden from accessibility and take no presses.
11. **Text scaling.** Every fixed height of the web is a minimum here (`heightIn(min = ...)`), so text at 200 percent grows instead of clipping (Review Focus 4); task 15 checks it on the screenshots.
12. **Decided here** (each listed in the report): the route pass's quiet-line words get Compose's own 48 dp touch-target expansion instead of the web's 13 up and down overlap of the fields below (a tap just under "Cloud" can reach the Deck field); focus moves are Compose focus requests, which TalkBack follows; on a long list the chosen card is revealed one frame after the arriving step is laid out, while its items are still invisible; a catalog that failed to load (unreachable with embedded decks) shows "The decks didn't load" with Try again in the step 1 panel.

**Steps:**

- [ ] **Step 1: Check the ground this task stands on.**

```bash
cd android/Truthy
ls app/src/main/java/com/eienmosu/truthy app/src/main/kotlin/com/eienmosu/truthy app/src/main/kotlin/com/eienmosu/truthy/design app/src/main/kotlin/com/eienmosu/truthy/ui
grep -rhn "class BackTransition\|class BackFrame\|class BackLayer\|class StartView\|class Catalog(\|interface CatalogState\|class StartFlowModel\|class AppViewModel\|fun interface MonotonicClock\|object SystemMonotonicClock\|const val START_TAG\|fun TruthyRoot" app/src/main
grep -rhn "fun choose(\|fun back(\|fun backTransition\|fun tapBack\|fun jump\|fun columnJumped\|fun arrivalFocusTaken\|fun startRound\|fun continueLast\|fun openRound\|fun switchTheme\|fun retryCatalog\|val startFlow" app/src/main/kotlin/com/eienmosu/truthy/StartFlowModel.kt app/src/main/kotlin/com/eienmosu/truthy/AppViewModel.kt
grep -rhn "fun TruthyIcon\|enum class IconId\|fun LogoMark\|fun Logo(\|fun Modifier.truthyShadow\|fun SkyBackdrop\|val LocalReducedMotion\|object PressFeedback\|fun rememberPressProgress\|fun Modifier.pressFeedback\|fun rememberPressTint\|fun PillButton\|fun RoundButton\|fun BackPill\|fun DestinationCard\|class CardStub" app/src/main/kotlin
grep -n "nameHidden\|val nameModifier" app/src/main/kotlin/com/eienmosu/truthy/ui/DestinationCard.kt
grep -n "TopScreen.Start" app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt
grep -n "dispatchKeyEvent" app/src/main/java/com/eienmosu/truthy/MainActivity.kt || echo "no dispatchKeyEvent yet"
grep -n "compose-bom\|ui-test-junit4\|ui-test-manifest\|androidx-test-runner\|androidx-test-ext-junit\|espresso" gradle/libs.versions.toml
grep -n "testInstrumentationRunner\|androidTestImplementation\|ui.test.manifest" app/build.gradle.kts
./gradlew :engine:test :app:testDebugUnitTest :app:assembleDebug
```

Expected:
- the `ls` shows `MainActivity.kt` and `TruthyRoot.kt` under `java`, task 11's files (`BackTransition.kt`, `StartFlowModel.kt`, `AppViewModel.kt` and the rest) under `kotlin`, task 8's and task 10's files in `design`, and `Buttons.kt`, `DestinationCard.kt`, `Stamps.kt` in `ui`;
- the first `grep` prints one declaration line for each name in it; the second one line for each member (`back(` twice: `back(to: Step)` and `back()`); the third one line for each task 10 name;
- `DestinationCard.kt` has the parameter `nameHidden: Boolean = false,` and the line `val nameModifier = if (nameHidden) Modifier.alpha(0f) else Modifier` (step 23 changes both);
- `TruthyRoot.kt` has `TopScreen.Start -> Box(Modifier.fillMaxSize().testTag(START_TAG))` (step 25 fills it);
- `no dispatchKeyEvent yet`;
- a `compose-bom` line in the catalog; the instrumented test lines may or may not be there (step 2 handles both);
- `BUILD SUCCESSFUL` for the three tasks.

Stop and adapt before going on if a name differs. The task 11 names are used in three files only: `BackLayers.kt` (the `BackFrame` members, step 10), `StartMotion.kt` (`BackTransition`, step 24) and `StartFlowRoute.kt` (every `StartFlowModel` and `AppViewModel` member, step 25); a difference changes those files and nothing else. A task 10 name that differs changes the call sites of steps 20 to 25, which each name it. If a member of the second or third `grep` is missing, stop: an earlier task is incomplete, and this task does not add members to it. If `:app:testDebugUnitTest` or `:app:assembleDebug` fails, an earlier task is broken; stop.

- [ ] **Step 2: Make sure the instrumented test set-up exists.**

Only for what step 1 found missing. In `android/Truthy/gradle/libs.versions.toml`, add under `[versions]`:

```toml
androidx-test-runner = "1.7.0"
androidx-test-ext-junit = "1.3.0"
androidx-test-espresso = "3.7.0"
```

and under `[libraries]` (the two Compose test artifacts take their versions from the BOM task 7 already uses):

```toml
androidx-compose-ui-test-junit4 = { group = "androidx.compose.ui", name = "ui-test-junit4" }
androidx-compose-ui-test-manifest = { group = "androidx.compose.ui", name = "ui-test-manifest" }
androidx-test-runner = { group = "androidx.test", name = "runner", version.ref = "androidx-test-runner" }
androidx-test-ext-junit = { group = "androidx.test.ext", name = "junit", version.ref = "androidx-test-ext-junit" }
androidx-test-espresso-core = { group = "androidx.test.espresso", name = "espresso-core", version.ref = "androidx-test-espresso" }
```

In `android/Truthy/app/build.gradle.kts`, inside `android { defaultConfig { ... } }`, if it is not there:

```kotlin
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
```

and inside `dependencies { ... }`, the lines that are not there yet (use the BOM alias step 1 printed if it is not `androidx-compose-bom`):

```kotlin
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
```

The versions are the current releases on Google's Maven repository as of 2026-10-15 (runner 1.7.0, ext junit 1.3.0, espresso 3.7.0). Run:

```bash
cd android/Truthy
./gradlew :app:assembleDebugAndroidTest
```

Expected: `BUILD SUCCESSFUL`. If step 1 found every line already present, skip the lines above.

Whatever step 1 found, the screens of this task (and of tasks 13 and 14) use Material3's `Text`, and no earlier task has added Material3 to the app. Add it next to the foundation line (the catalog alias exists since task 1; the version comes from the Compose BOM, Material3 1.4.0):

```bash
cd android/Truthy
grep -q 'libs.androidx.compose.material3' app/build.gradle.kts || perl -0pi -e 's/^(    implementation\(libs\.androidx\.compose\.foundation\)\n)/$1    implementation(libs.androidx.compose.material3)\n/m' app/build.gradle.kts
grep -n 'compose.material3' app/build.gradle.kts
./gradlew :app:assembleDebug
cd ../..
```

Expected: one line `    implementation(libs.androidx.compose.material3)`, then `BUILD SUCCESSFUL`. The build file is committed with this task's first commit (step 7): add `android/Truthy/app/build.gradle.kts` to its `git add` if it is not listed there.

- [ ] **Step 3: Write the failing tests for the copy, the options and the pass layouts.**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/StartFixtures.kt` (the web's start-flow test index, `tests/components/start/fixtures.ts`, in Kotlin):

```kotlin
package com.eienmosu.truthy.start

import com.eienmosu.truthy.engine.CardHistory
import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.IndexArea
import com.eienmosu.truthy.engine.IndexDeck
import com.eienmosu.truthy.engine.IndexPlatform
import com.eienmosu.truthy.engine.IndexSection
import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.RecentDeck

/**
 * The web's start-flow test index (tests/components/start/fixtures.ts): Cloud with AWS (CLF, two sections),
 * Google Cloud (CDL, no sections) and Azure (no decks); Frontend with Next.js (RND); DevOps with no platforms.
 */
object StartFixtures {
    val CLF = IndexDeck(
        id = "aws-clf-c02", code = "CLF", title = "Cloud Practitioner", passName = null, cardCount = 92,
        version = "2026-10-01", hash = "clf-1",
        sections = listOf(
            IndexSection(id = "CON", title = "Cloud concepts", cardCount = 45),
            IndexSection(id = "SEC", title = "Security and compliance", cardCount = 47),
        ),
    )
    val CDL = IndexDeck(
        id = "gcp-cdl", code = "CDL", title = "Cloud Digital Leader", passName = "Google Cloud Digital Leader", cardCount = 133,
        version = "2026-10-01", hash = "cdl-1", sections = emptyList(),
    )
    val RND = IndexDeck(
        id = "nextjs-rendering", code = "RND", title = "Rendering", passName = null, cardCount = 12,
        version = "2026-10-01", hash = "rnd-1",
        sections = listOf(IndexSection(id = "RSC", title = "Server and client components", cardCount = 12)),
    )
    val AWS = IndexPlatform(id = "aws", title = "AWS", decks = listOf(CLF))
    val GCP = IndexPlatform(id = "gcp", title = "Google Cloud", decks = listOf(CDL))
    val AZURE = IndexPlatform(id = "azure", title = "Azure", decks = emptyList())
    val NEXTJS = IndexPlatform(id = "nextjs", title = "Next.js", decks = listOf(RND))
    val CLOUD = IndexArea(id = "cloud", title = "Cloud", platforms = listOf(AWS, GCP, AZURE))
    val FRONTEND = IndexArea(id = "frontend", title = "Frontend", platforms = listOf(NEXTJS))
    val DEVOPS = IndexArea(id = "devops", title = "DevOps", platforms = emptyList())
    val INDEX = DeckIndex(areas = listOf(CLOUD, FRONTEND, DEVOPS))

    /** Two decks played: CLF last, CDL before it (useCatalog's recentDecks order). */
    val RECENT_TWO = listOf(
        RecentDeck(area = CLOUD, platform = AWS, deck = CLF, lastSeenAt = 2000.0),
        RecentDeck(area = CLOUD, platform = GCP, deck = CDL, lastSeenAt = 1000.0),
    )

    fun progressOf(
        cards: Map<String, CardHistory> = emptyMap(),
        records: Map<String, Int> = emptyMap(),
        last: LastRound? = null,
    ): Progress = Progress(version = 1, cards = cards, records = records, last = last)

    fun data(
        progress: Progress = progressOf(),
        recent: List<RecentDeck> = emptyList(),
        cardIds: Map<String, List<String>> = emptyMap(),
    ): StartData = StartData(index = INDEX, progress = progress, cardIds = cardIds, recent = recent)
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/StartOptionsTest.kt`:

```kotlin
package com.eienmosu.truthy.start

import com.eienmosu.truthy.engine.CardHistory
import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.RECENT
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.StartChoice
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.WHOLE_DECK
import com.eienmosu.truthy.start.StartFixtures.INDEX
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StartOptionsTest {
    private fun labels(options: List<OptionModel>) = options.map { it.label }
    private val step1 = PanelSnapshot(Step.ONE, StartChoice())

    @Test
    fun stepTitlesAndBackLabelsAreTheWebsCopy() {
        assertEquals(
            listOf("Choose an area", "Choose a platform", "Choose a deck", "Choose a section", "Choose how to play", "Your pass is ready"),
            Step.entries.map { stepTitle(it) },
        )
        assertEquals("Back to areas", backLabel(Step.TWO, hasSections = true, recent = false))
        assertEquals("Back to areas", backLabel(Step.THREE, hasSections = true, recent = true))
        assertEquals("Back to decks", backLabel(Step.FOUR, hasSections = true, recent = true))
        assertEquals("Back to decks", backLabel(Step.FIVE, hasSections = false, recent = false))
        assertEquals("Back to sections", backLabel(Step.FIVE, hasSections = true, recent = false))
        assertEquals("Back to classes", backLabel(Step.SIX, hasSections = true, recent = false))
    }

    @Test
    fun eachStepHasItsPassStageAndItsFieldBeingChosen() {
        assertEquals(
            listOf(PassStage.DESTINATION, PassStage.DESTINATION, PassStage.DESTINATION, PassStage.ROUTE, PassStage.ROUTE, PassStage.READY),
            Step.entries.map { stageOf(it) },
        )
        assertEquals(
            listOf(null, PassFieldName.PLATFORM, PassFieldName.DECK, PassFieldName.SECTION, PassFieldName.MODE, null),
            Step.entries.map { nowField(it) },
        )
        assertEquals(listOf(Step.ONE, Step.TWO, Step.THREE, Step.FOUR, Step.FIVE), PassFieldName.entries.map { fieldStep(it) })
        assertEquals(Step.TWO, backTarget(INDEX, PanelSnapshot(Step.THREE, StartChoice(areaId = "cloud", platformId = "aws"))))
        assertEquals(Step.ONE, backTarget(INDEX, PanelSnapshot(Step.THREE, StartChoice(via = RECENT))))
        assertEquals(Step.THREE, backTarget(INDEX, PanelSnapshot(Step.FIVE, StartChoice(areaId = "cloud", platformId = "gcp", deckId = "gcp-cdl", sectionId = WHOLE_DECK))))
    }

    @Test
    fun step1ListsTheAreasWithTheirDeckCounts() {
        val options = stepOptions(StartFixtures.data(), step1)
        assertEquals(listOf("Cloud, 2 decks", "Frontend, 1 deck", "DevOps, no decks yet"), labels(options))
        assertEquals(listOf("2 decks", "1 deck", "No decks yet"), options.map { it.sub })
        assertEquals(listOf(false, false, true), options.map { it.unavailable })
        assertEquals(listOf(OptionKind.PLACE, OptionKind.PLACE, OptionKind.PLACE), options.map { it.kind })
        assertEquals(Forward(Step.TWO, StartChoice(areaId = "cloud"), PassFieldName.AREA), options[0].forward)
        assertNull(options[2].forward)
    }

    @Test
    fun recentComesFirstOnlyWithTwoOrMoreDecksPlayed() {
        assertEquals(3, stepOptions(StartFixtures.data(recent = StartFixtures.RECENT_TWO.take(1)), step1).size)
        val options = stepOptions(StartFixtures.data(recent = StartFixtures.RECENT_TWO), step1)
        val recent = options.first()
        assertEquals(RECENT, recent.id)
        assertEquals("Recent", recent.name)
        assertEquals("CLF · CDL", recent.sub)
        assertTrue(recent.recent)
        assertEquals(Forward(Step.THREE, StartChoice(via = RECENT), null), recent.forward)
        assertEquals(listOf("Recent, 2 decks", "Cloud, 2 decks", "Frontend, 1 deck", "DevOps, no decks yet"), labels(options))
    }

    @Test
    fun step2ListsThePlatformsOfTheChosenArea() {
        val options = stepOptions(StartFixtures.data(), PanelSnapshot(Step.TWO, StartChoice(areaId = "cloud")))
        assertEquals(listOf("AWS, 1 deck", "Google Cloud, 1 deck", "Azure, no decks yet"), labels(options))
        assertEquals(Forward(Step.THREE, StartChoice(areaId = "cloud", platformId = "aws"), PassFieldName.PLATFORM), options[0].forward)
    }

    @Test
    fun deckCardsShowTheShareSeenAndLeadToTheirNextStep() {
        val ids = (0 until 92).map { "aws-clf-c02-t1-$it" }
        val cards = ids.take(23).associateWith { CardHistory(seen = 1, lastCorrect = true, lastSeenAt = 1.0) }
        val data = StartFixtures.data(progress = StartFixtures.progressOf(cards = cards), cardIds = mapOf("aws-clf-c02" to ids))
        val clf = stepOptions(data, PanelSnapshot(Step.THREE, StartChoice(areaId = "cloud", platformId = "aws"))).single()
        assertEquals("CLF, Cloud Practitioner, 92 cards, 25 percent seen", clf.label)
        assertEquals(OptionKind.DECK, clf.kind)
        assertEquals("CLF", clf.name)
        assertTrue(clf.code)
        assertEquals("Cloud Practitioner", clf.detail)
        assertEquals(25, clf.seenPercent)
        assertEquals(StubText("Cards", "92"), clf.stub)
        assertEquals(Forward(Step.FOUR, StartChoice(areaId = "cloud", platformId = "aws", deckId = "aws-clf-c02"), PassFieldName.DECK), clf.forward)
        val cdl = stepOptions(StartFixtures.data(), PanelSnapshot(Step.THREE, StartChoice(areaId = "cloud", platformId = "gcp"))).single()
        assertEquals("CDL, Cloud Digital Leader, 133 cards, not started", cdl.label)
        assertEquals(
            Forward(Step.FIVE, StartChoice(areaId = "cloud", platformId = "gcp", deckId = "gcp-cdl", sectionId = WHOLE_DECK), PassFieldName.DECK),
            cdl.forward,
        )
    }

    @Test
    fun theRecentDecksBringTheirAreaAndPlatformWithThem() {
        val options = stepOptions(StartFixtures.data(recent = StartFixtures.RECENT_TWO), PanelSnapshot(Step.THREE, StartChoice(via = RECENT)))
        assertEquals(listOf("aws-clf-c02", "gcp-cdl"), options.map { it.id })
        assertEquals(
            Forward(Step.FOUR, StartChoice(via = RECENT, areaId = "cloud", platformId = "aws", deckId = "aws-clf-c02"), PassFieldName.DECK),
            options[0].forward,
        )
        assertEquals(
            Forward(Step.FIVE, StartChoice(via = RECENT, areaId = "cloud", platformId = "gcp", deckId = "gcp-cdl", sectionId = WHOLE_DECK), PassFieldName.DECK),
            options[1].forward,
        )
    }

    @Test
    fun step4StartsWithTheWholeDeck() {
        val choice = StartChoice(areaId = "cloud", platformId = "aws", deckId = "aws-clf-c02")
        val options = stepOptions(StartFixtures.data(), PanelSnapshot(Step.FOUR, choice))
        assertEquals(
            listOf("Whole deck, all 2 sections, 92 cards", "CON, Cloud concepts, 45 cards", "SEC, Security and compliance, 47 cards"),
            labels(options),
        )
        assertEquals(listOf(WHOLE_DECK, "CON", "SEC"), options.map { it.id })
        assertEquals(listOf("Whole deck", "CON", "SEC"), options.map { it.name })
        assertEquals(listOf(false, true, true), options.map { it.code })
        assertEquals(listOf("All 2 sections", "Cloud concepts", "Security and compliance"), options.map { it.detail })
        assertEquals(StubText("Cards", "45"), options[1].stub)
        assertEquals(Forward(Step.FIVE, choice.copy(sectionId = "SEC"), PassFieldName.SECTION), options[2].forward)
    }

    @Test
    fun step5ShowsEachClassWithItsBestOnTheRoute() {
        val records = mapOf("aws-clf-c02/SEC#classic" to 9, "aws-clf-c02/SEC#streak" to 12, "aws-clf-c02/SEC#lives" to 21, "aws-clf-c02/CON#timed" to 30)
        val choice = StartChoice(areaId = "cloud", platformId = "aws", deckId = "aws-clf-c02", sectionId = "SEC")
        val options = stepOptions(StartFixtures.data(progress = StartFixtures.progressOf(records = records)), PanelSnapshot(Step.FIVE, choice))
        assertEquals(
            listOf(
                "Classic. Correct answers out of 10 cards. Your best: 9 of 10.",
                "Streak. Correct answers in a row, until the first wrong one. Your best: 12 in a row.",
                "Three lives. Cards answered until the third wrong one. Your best: 21 cards.",
                "Timed. Correct answers in one minute, wrong ones cost nothing. Not played yet.",
            ),
            labels(options),
        )
        assertEquals(listOf("classic", "streak", "lives", "timed"), options.map { it.id })
        assertEquals(OptionKind.CLASS, options[0].kind)
        assertEquals("Correct answers out of 10 cards.", options[0].detail)
        assertEquals(StubText("Best", "9", "of 10"), options[0].stub)
        assertEquals(StubText("Best", "–", "not played", muted = true), options[3].stub)
        assertEquals(Forward(Step.SIX, choice.copy(mode = Mode.TIMED), PassFieldName.MODE), options[3].forward)
    }

    @Test
    fun thePassShowsEachStagesFieldsAndWaysBack() {
        val route = StartChoice(areaId = "cloud", platformId = "aws", deckId = "aws-clf-c02", sectionId = "SEC")
        val values = passValues(resolveChoice(INDEX, route))
        assertEquals(
            PassValues(
                area = "Cloud", platform = "AWS", deck = PassDeck("CLF", "AWS Cloud Practitioner"),
                section = PassSection("SEC", "Security and compliance", whole = false), mode = null, cards = 47,
            ),
            values,
        )
        val destination = passBlock(PassStage.DESTINATION, passValues(resolveChoice(INDEX, StartChoice(areaId = "cloud"))), PassFieldName.PLATFORM, sectionChoosable = true) as DestinationBlock
        assertEquals(listOf("Area", "Platform", "Deck"), destination.fields.map { it.label })
        assertEquals(listOf("Cloud", null, null), destination.fields.map { it.value })
        assertEquals(listOf("Change area, now Cloud", null, null), destination.fields.map { it.wayBack })
        assertEquals(listOf(false, true, false), destination.fields.map { it.now })
        val routeBlock = passBlock(PassStage.ROUTE, values, PassFieldName.MODE, sectionChoosable = true) as RouteBlock
        assertEquals("Change area, now Cloud", routeBlock.area?.wayBack)
        assertEquals("Change platform, now AWS", routeBlock.platform?.wayBack)
        assertEquals(listOf("Deck", "Section", "Class"), routeBlock.fields.map { it.label })
        assertEquals(listOf("CLF", "SEC", null), routeBlock.fields.map { it.value })
        assertEquals(listOf(true, true, false), routeBlock.fields.map { it.code })
        assertEquals(listOf("Change deck, now CLF", "Change section, now SEC", null), routeBlock.fields.map { it.wayBack })
        assertEquals(setOf(PassFieldName.AREA, PassFieldName.PLATFORM, PassFieldName.DECK, PassFieldName.SECTION), filledFields(values))
        assertEquals(setOf(PassFieldName.DECK, PassFieldName.SECTION), changingFields(passValues(resolveChoice(INDEX, StartChoice(areaId = "cloud", platformId = "aws"))), values))
        assertTrue(stageShows(PassStage.ROUTE, PassFieldName.AREA))
        assertFalse(stageShows(PassStage.READY, PassFieldName.PLATFORM))
        assertFalse(stageShows(PassStage.DESTINATION, PassFieldName.SECTION))
    }

    @Test
    fun aWholeDeckIsWrittenInWordsAndIsNoWayBackWithoutSections() {
        val cdl = passValues(
            resolveChoice(INDEX, StartChoice(areaId = "cloud", platformId = "gcp", deckId = "gcp-cdl", sectionId = WHOLE_DECK, mode = Mode.CLASSIC)),
        )
        val route = passBlock(PassStage.ROUTE, cdl, PassFieldName.MODE, sectionChoosable = false) as RouteBlock
        assertEquals("Whole deck", route.fields[1].value)
        assertFalse(route.fields[1].code)
        assertNull(route.fields[1].wayBack)
        val ready = passBlock(PassStage.READY, cdl, null, sectionChoosable = false) as ReadyBlock
        assertEquals(PassLeg(PassFieldName.DECK, "CDL", "Google Cloud Digital Leader", "Change deck, now CDL"), ready.deck)
        assertEquals(PassLeg(PassFieldName.SECTION, "ALL", "Whole deck", null), ready.section)
        assertEquals("Classic", ready.mode)
        assertEquals("Change class, now Classic", ready.modeWayBack)
        assertEquals("133", ready.cards)
        val choosable = passBlock(PassStage.READY, cdl, null, sectionChoosable = true) as ReadyBlock
        assertEquals("Change section, now Whole deck", choosable.section.wayBack)
    }

    @Test
    fun theContinueLineNamesTheLastRouteAndItsScore() {
        val last = LastRound(route = Route(deckId = "aws-clf-c02", sectionId = "SEC"), mode = Mode.CLASSIC, score = 7, total = 10)
        val line = continueModel(StartFixtures.data(progress = StartFixtures.progressOf(last = last)))
        assertNotNull(line)
        line!!
        assertEquals("CLF", line.deckCode)
        assertEquals("AWS Cloud Practitioner", line.deckName)
        assertEquals("SEC", line.sectionCode)
        assertEquals("Classic", line.modeLabel)
        assertEquals("7 of 10", line.lastScore)
        assertEquals("Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.", line.label)
        assertEquals(StartChoice(areaId = "cloud", platformId = "aws", deckId = "aws-clf-c02", sectionId = "SEC", mode = Mode.CLASSIC), line.choice)
        val left = continueModel(
            StartFixtures.data(progress = StartFixtures.progressOf(last = LastRound(Route("gcp-cdl", WHOLE_DECK), Mode.STREAK, null, null))),
        )!!
        assertEquals("ALL", left.sectionCode)
        assertEquals("Whole deck", left.sectionTitle)
        assertNull(left.lastScore)
        assertEquals("Continue: Google Cloud Digital Leader, Whole deck, Streak.", left.label)
        assertNull(continueModel(StartFixtures.data()))
        assertNull(continueModel(StartFixtures.data(progress = StartFixtures.progressOf(last = LastRound(Route("gone", WHOLE_DECK), Mode.CLASSIC, 1, 10)))))
    }

    @Test
    fun theReadyLineAndTheItemCounts() {
        assertEquals("Correct answers out of 10 cards. Swipe right for true, left for false.", readyLine("Correct answers out of 10 cards."))
        assertEquals(4, itemCount(StartFixtures.data(), step1))
        assertEquals(1, itemCount(null, step1))
        assertEquals(1, itemCount(StartFixtures.data(), PanelSnapshot(Step.SIX, StartChoice(mode = Mode.CLASSIC))))
    }
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/FrWidthsTest.kt` (the CSS grid columns of the pass, FillInPass.tsx:342 and :360, BoardingPass.tsx:82):

```kotlin
package com.eienmosu.truthy.start

import org.junit.Assert.assertEquals
import org.junit.Test

class FrWidthsTest {
    @Test
    fun fractionsShareTheWidthAndTheLastFlexibleColumnTakesTheRoundingRest() {
        // 300 / 3.15 = 95.238 per fr: 85.71, 138.10, 76.19, floored to 85, 138, 76 and the missing pixel to the last.
        assertEquals(listOf(85, 138, 77), frWidths(300, listOf(0.9f, 1.45f, 0.8f), listOf(0, 0, 0)))
    }

    @Test
    fun aColumnNarrowerThanItsContentKeepsItsContentAndTheOthersShareTheRest() {
        // minmax(max-content, fr): 1.1 fr of 100 is under 150, so it keeps 150; then 0.75 of 78.9 is under 60, so it keeps 60;
        // the last column takes the remaining 90.
        assertEquals(listOf(60, 150, 90), frWidths(300, listOf(0.75f, 1.1f, 1.15f), listOf(60, 150, 60)))
    }

    @Test
    fun contentWiderThanTheRowOverflowsInsteadOfShrinking() {
        assertEquals(listOf(200, 150), frWidths(300, listOf(1f, 1f), listOf(200, 150)))
    }
}
```

- [ ] **Step 4: Run the tests and see them fail.**

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.start.*'
```

Expected: `> Task :app:compileDebugUnitTestKotlin FAILED` with `Unresolved reference 'StartData'` in `StartFixtures.kt` and unresolved references to `stepTitle`, `backLabel`, `stageOf`, `PassStage`, `stepOptions`, `PanelSnapshot`, `frWidths` and the other names of step 5 in the two tests, then `BUILD FAILED`. No test runs.

- [ ] **Step 5: Write the copy, the options, the pass layouts, the column widths and the code-only sizes.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartCopy.kt`:

```kotlin
package com.eienmosu.truthy.start

import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.previousStep

/** The three layouts of the fill-in pass (FillInPass.tsx `PassStage`). */
enum class PassStage { DESTINATION, ROUTE, READY }

/** The start flow's copy, verbatim from reference 4.5 (StartFlow.tsx, FillInPass.tsx, ThemeSwitch.tsx, ContinueLine.tsx). */
object StartCopy {
    const val TAGLINE = "True or false cards that teach you IT, one swipe at a time."
    const val BACK = "Back"
    const val RECENT_NAME = "Recent"
    const val WHOLE_DECK_NAME = "Whole deck"
    const val START_ROUND = "Start round"
    const val READY_RULE = "Swipe right for true, left for false."
    const val LOADING_DECKS = "Loading the decks"
    const val SWITCH_TO_DARK = "Switch to dark theme"
    const val SWITCH_TO_LIGHT = "Switch to light theme"
    const val NOT_CHOSEN = "not chosen"
    const val BAND_TITLE = "Truthy"
    const val YOUR_PASS = "YOUR PASS"
    const val BOARDING_PASS = "BOARDING PASS"
    const val GATE_SHOWN = "F ← → T"
    const val GATE_SPOKEN = "False left, true right"
    const val LABEL_CLASS = "Class"
    const val LABEL_CARDS = "Cards"
    const val LABEL_GATE = "Gate"
    const val CARDS = "Cards"
    const val BEST = "Best"
    const val NO_BEST = "–"
    const val NOT_PLAYED = "not played"
    const val NOT_AVAILABLE = "Not available yet"
    const val ARROW = "→"
    const val SEPARATOR = " · "
    const val MIDDLE_DOT = "·"
    const val LAST = "last "
}

fun stepTitle(step: Step): String = when (step) {
    Step.ONE -> "Choose an area"
    Step.TWO -> "Choose a platform"
    Step.THREE -> "Choose a deck"
    Step.FOUR -> "Choose a section"
    Step.FIVE -> "Choose how to play"
    Step.SIX -> "Your pass is ready"
}

/** StartFlow.tsx:360 `BACK_TO`: what the Back pill of a step returns to, named after the step it goes back to. */
private fun backToWord(step: Step): String = when (step) {
    Step.ONE -> "areas"
    Step.TWO -> "platforms"
    Step.THREE -> "decks"
    Step.FOUR -> "sections"
    Step.FIVE, Step.SIX -> "classes"
}

/** "Back to platforms": the Back pill's label on `step` (StartFlow.tsx:786). */
fun backLabel(step: Step, hasSections: Boolean, recent: Boolean): String =
    "Back to ${backToWord(previousStep(step, hasSections, recent))}"

/** StartFlow.tsx:363-366: steps 1 to 3 choose the destination, 4 and 5 the route, 6 is ready. */
fun stageOf(step: Step): PassStage = when {
    step <= Step.THREE -> PassStage.DESTINATION
    step <= Step.FIVE -> PassStage.ROUTE
    else -> PassStage.READY
}

/** StartFlow.tsx:361 `NOW_FIELD`: the field each step fills, drawn in ink while it is chosen. */
fun nowField(step: Step): PassFieldName? = when (step) {
    Step.TWO -> PassFieldName.PLATFORM
    Step.THREE -> PassFieldName.DECK
    Step.FOUR -> PassFieldName.SECTION
    Step.FIVE -> PassFieldName.MODE
    Step.ONE, Step.SIX -> null
}

/** StartFlow.tsx:99 `STEP_OF_FIELD`: the step a field of the pass returns to. */
fun fieldStep(field: PassFieldName): Step = when (field) {
    PassFieldName.AREA -> Step.ONE
    PassFieldName.PLATFORM -> Step.TWO
    PassFieldName.DECK -> Step.THREE
    PassFieldName.SECTION -> Step.FOUR
    PassFieldName.MODE -> Step.FIVE
}

/** The field labels of the destination and route layouts (FillInPass.tsx:343-372). */
fun fieldLabel(field: PassFieldName): String = when (field) {
    PassFieldName.AREA -> "Area"
    PassFieldName.PLATFORM -> "Platform"
    PassFieldName.DECK -> "Deck"
    PassFieldName.SECTION -> "Section"
    PassFieldName.MODE -> "Class"
}

/** The line of step 6 (StartFlow.tsx:983-985). */
fun readyLine(description: String): String = "$description ${StartCopy.READY_RULE}"
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartOptions.kt`:

```kotlin
package com.eienmosu.truthy.start

import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.IndexArea
import com.eienmosu.truthy.engine.IndexDeck
import com.eienmosu.truthy.engine.IndexPlatform
import com.eienmosu.truthy.engine.MODE_TABLE
import com.eienmosu.truthy.engine.ModeInfo
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.RECENT
import com.eienmosu.truthy.engine.RecentDeck
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.StartChoice
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.WHOLE_DECK
import com.eienmosu.truthy.engine.bestFor
import com.eienmosu.truthy.engine.changeLabel
import com.eienmosu.truthy.engine.continueLabel
import com.eienmosu.truthy.engine.continueTarget
import com.eienmosu.truthy.engine.deckCount
import com.eienmosu.truthy.engine.deckPassName
import com.eienmosu.truthy.engine.decksLabel
import com.eienmosu.truthy.engine.lastScoreText
import com.eienmosu.truthy.engine.modeInfo
import com.eienmosu.truthy.engine.previousStep
import com.eienmosu.truthy.engine.seenPercent

/** What the start screen reads once the index is decoded: useCatalog's "ready" status (index, progress, card ids, recent decks). */
data class StartData(
    val index: DeckIndex,
    val progress: Progress,
    val cardIds: Map<String, List<String>>,
    val recent: List<RecentDeck>,
)

/** A step as it is drawn: its number and the choices it is drawn with. */
data class PanelSnapshot(val step: Step, val choice: StartChoice)

/** A section as the flow shows it; the whole deck is one too (StartFlow.tsx:137-146). */
data class SectionView(val id: String, val title: String, val cardCount: Int, val whole: Boolean)

/** The choices looked up in the index; a missing entry was not chosen or no longer exists (StartFlow.tsx:149-169). */
data class ResolvedChoice(
    val area: IndexArea?,
    val platform: IndexPlatform?,
    val deck: IndexDeck?,
    val section: SectionView?,
    val mode: ModeInfo?,
) {
    /** StartFlow.tsx:407: before a deck is chosen the path counts as having the section step. */
    val hasSections: Boolean get() = (deck?.sections?.size ?: 1) > 0
}

fun wholeDeck(deck: IndexDeck): SectionView = SectionView(WHOLE_DECK, StartCopy.WHOLE_DECK_NAME, deck.cardCount, whole = true)

fun resolveChoice(index: DeckIndex, choice: StartChoice, table: List<ModeInfo> = MODE_TABLE): ResolvedChoice {
    val area = index.areas.firstOrNull { it.id == choice.areaId }
    val platform = area?.platforms?.firstOrNull { it.id == choice.platformId }
    val deck = platform?.decks?.firstOrNull { it.id == choice.deckId }
    val section = when {
        deck == null -> null
        choice.sectionId == WHOLE_DECK -> wholeDeck(deck)
        else -> deck.sections.firstOrNull { it.id == choice.sectionId }?.let { SectionView(it.id, it.title, it.cardCount, whole = false) }
    }
    val mode = table.firstOrNull { it.id == choice.mode && it.offered }
    return ResolvedChoice(area, platform, deck, section, mode)
}

/** Where every one-step way back from `snapshot` goes (StartFlow.tsx:647). */
fun backTarget(index: DeckIndex, snapshot: PanelSnapshot): Step =
    previousStep(snapshot.step, resolveChoice(index, snapshot.choice).hasSections, snapshot.choice.via == RECENT)

// ---------- the pass ----------

data class PassDeck(val code: String, val name: String)
data class PassSection(val code: String, val name: String, val whole: Boolean)

/** FillInPass.tsx `FillInPassValues`, filled as StartFlow.tsx:745-752 does. */
data class PassValues(
    val area: String? = null,
    val platform: String? = null,
    val deck: PassDeck? = null,
    val section: PassSection? = null,
    val mode: String? = null,
    val cards: Int? = null,
)

fun passValues(resolved: ResolvedChoice): PassValues {
    val platform = resolved.platform
    val deck = resolved.deck
    return PassValues(
        area = resolved.area?.title,
        platform = platform?.title,
        deck = if (deck != null && platform != null) PassDeck(deck.code, deckPassName(platform, deck)) else null,
        section = resolved.section?.let { PassSection(it.id, it.title, it.whole) },
        mode = resolved.mode?.name,
        cards = resolved.section?.cardCount,
    )
}

fun filledFields(values: PassValues): Set<PassFieldName> = buildSet {
    if (values.area != null) add(PassFieldName.AREA)
    if (values.platform != null) add(PassFieldName.PLATFORM)
    if (values.deck != null) add(PassFieldName.DECK)
    if (values.section != null) add(PassFieldName.SECTION)
    if (values.mode != null) add(PassFieldName.MODE)
}

/** The fields filled on one side and blank on the other: their dashes leave (forward) or come back (back). */
fun changingFields(from: PassValues, to: PassValues): Set<PassFieldName> {
    val a = filledFields(from)
    val b = filledFields(to)
    return (a union b) - (a intersect b)
}

/** Whether a layout of the pass shows a field's value (FillInPass.tsx:334-376). */
fun stageShows(stage: PassStage, field: PassFieldName): Boolean = when (stage) {
    PassStage.DESTINATION -> field == PassFieldName.AREA || field == PassFieldName.PLATFORM || field == PassFieldName.DECK
    PassStage.ROUTE -> true
    PassStage.READY -> field == PassFieldName.DECK || field == PassFieldName.SECTION || field == PassFieldName.MODE
}

/** A field of the destination or route grid, or a word of the route pass's quiet line. `wayBack` is its accessible name when it returns to its step. */
data class PassField(val field: PassFieldName, val label: String, val value: String?, val code: Boolean, val now: Boolean, val wayBack: String?)

/** A leg of the ready pass: code over name (FillInPass.tsx:239-267). */
data class PassLeg(val field: PassFieldName, val code: String, val name: String, val wayBack: String?)

sealed interface PassBlock {
    val stage: PassStage
}

data class DestinationBlock(val fields: List<PassField>) : PassBlock {
    override val stage: PassStage get() = PassStage.DESTINATION
}

data class RouteBlock(val area: PassField?, val platform: PassField?, val fields: List<PassField>) : PassBlock {
    override val stage: PassStage get() = PassStage.ROUTE
}

data class ReadyBlock(val deck: PassLeg, val section: PassLeg, val mode: String, val modeWayBack: String?, val cards: String) : PassBlock {
    override val stage: PassStage get() = PassStage.READY
}

/** FillInPass.tsx:173-209: a filled field that is not being chosen now is a way back, unless it cannot be chosen. */
private fun gridField(field: PassFieldName, value: String?, code: Boolean, now: PassFieldName?, choosable: Boolean = true): PassField =
    PassField(
        field = field,
        label = fieldLabel(field),
        value = value,
        code = code,
        now = now == field,
        wayBack = if (value != null && now != field && choosable) changeLabel(field, value) else null,
    )

/** FillInPass.tsx:218-236: the quiet line's words are always ways back. */
private fun lineWord(field: PassFieldName, value: String?): PassField? =
    value?.let { PassField(field, fieldLabel(field), it, code = false, now = false, wayBack = changeLabel(field, it)) }

fun passBlock(stage: PassStage, values: PassValues, now: PassFieldName?, sectionChoosable: Boolean): PassBlock = when (stage) {
    PassStage.DESTINATION -> DestinationBlock(
        listOf(
            gridField(PassFieldName.AREA, values.area, code = false, now = now),
            gridField(PassFieldName.PLATFORM, values.platform, code = false, now = now),
            gridField(PassFieldName.DECK, values.deck?.code, code = true, now = now),
        ),
    )
    PassStage.ROUTE -> {
        val section = values.section
        RouteBlock(
            area = lineWord(PassFieldName.AREA, values.area),
            platform = lineWord(PassFieldName.PLATFORM, values.platform),
            fields = listOf(
                gridField(PassFieldName.DECK, values.deck?.code, code = true, now = now),
                gridField(
                    PassFieldName.SECTION,
                    section?.let { if (it.whole) it.name else it.code },
                    code = section != null && !section.whole,
                    now = now,
                    choosable = sectionChoosable,
                ),
                gridField(PassFieldName.MODE, values.mode, code = false, now = now),
            ),
        )
    }
    PassStage.READY -> {
        val deckCode = values.deck?.code ?: ""
        val sectionCode = values.section?.code ?: ""
        val sectionName = values.section?.name ?: ""
        ReadyBlock(
            deck = PassLeg(PassFieldName.DECK, deckCode, values.deck?.name ?: "", changeLabel(PassFieldName.DECK, deckCode)),
            section = PassLeg(
                PassFieldName.SECTION,
                sectionCode,
                sectionName,
                if (sectionChoosable) changeLabel(PassFieldName.SECTION, if (sectionCode == WHOLE_DECK) sectionName else sectionCode) else null,
            ),
            mode = values.mode ?: "",
            modeWayBack = values.mode?.let { changeLabel(PassFieldName.MODE, it) },
            cards = values.cards?.toString() ?: "",
        )
    }
}

// ---------- the options of each step ----------

enum class OptionKind { PLACE, DECK, SECTION, CLASS }

/** What a card's stub shows: "Cards / 214" or "Best / 9 / of 10" (DestinationCard.tsx `CardStub`). */
data class StubText(val label: String, val value: String, val unit: String? = null, val muted: Boolean = false)

/** Where choosing an option leads: the step, the choices with it, and the field its name travels into (none for Recent). */
data class Forward(val step: Step, val choice: StartChoice, val field: PassFieldName?)

/** One card of a step's list (StartFlow.tsx:876-1026). */
data class OptionModel(
    val id: String,
    val kind: OptionKind,
    val name: String,
    val label: String,
    val code: Boolean = false,
    val sub: String? = null,
    val detail: String? = null,
    val seenPercent: Int? = null,
    val stub: StubText? = null,
    val unavailable: Boolean = false,
    val recent: Boolean = false,
    val forward: Forward? = null,
)

fun stepOptions(data: StartData, snapshot: PanelSnapshot, table: List<ModeInfo> = MODE_TABLE): List<OptionModel> {
    val choice = snapshot.choice
    val resolved = resolveChoice(data.index, choice, table)
    return when (snapshot.step) {
        Step.ONE -> {
            val areas = data.index.areas.map { area ->
                placeOption(area.id, area.title, deckCount(area), Forward(Step.TWO, StartChoice(areaId = area.id), PassFieldName.AREA))
            }
            if (data.recent.size < 2) areas else listOf(recentOption(data.recent)) + areas
        }
        Step.TWO -> (resolved.area?.platforms ?: emptyList()).map { platform ->
            placeOption(platform.id, platform.title, deckCount(platform), Forward(Step.THREE, choice.copy(platformId = platform.id), PassFieldName.PLATFORM))
        }
        Step.THREE ->
            if (choice.via == RECENT) {
                data.recent.map { played -> deckOption(data, played.deck, StartChoice(via = RECENT, areaId = played.area.id, platformId = played.platform.id)) }
            } else {
                (resolved.platform?.decks ?: emptyList()).map { deckOption(data, it, choice) }
            }
        Step.FOUR -> {
            val deck = resolved.deck
            if (deck == null) {
                emptyList()
            } else {
                (listOf(wholeDeck(deck)) + deck.sections.map { SectionView(it.id, it.title, it.cardCount, whole = false) })
                    .map { sectionOption(deck, it, choice) }
            }
        }
        Step.FIVE -> table.map { classOption(data, it, choice) }
        Step.SIX -> emptyList()
    }
}

/** How many items of a step move in one after the other: its title, then its options. Placeholders and the ready line are not items (StartFlow.tsx:1097-1118). */
fun itemCount(data: StartData?, snapshot: PanelSnapshot): Int = when {
    snapshot.step == Step.SIX || data == null -> 1
    else -> 1 + stepOptions(data, snapshot).size
}

private fun placeOption(id: String, title: String, count: Int, forward: Forward): OptionModel {
    val available = count > 0
    return OptionModel(
        id = id,
        kind = OptionKind.PLACE,
        name = title,
        sub = decksLabel(count),
        label = if (available) "$title, ${decksLabel(count)}" else "$title, no decks yet",
        unavailable = !available,
        forward = if (available) forward else null,
    )
}

private fun recentOption(recent: List<RecentDeck>): OptionModel = OptionModel(
    id = RECENT,
    kind = OptionKind.PLACE,
    name = StartCopy.RECENT_NAME,
    sub = recent.joinToString(StartCopy.SEPARATOR) { it.deck.code },
    label = "${StartCopy.RECENT_NAME}, ${decksLabel(recent.size)}",
    recent = true,
    forward = Forward(Step.THREE, StartChoice(via = RECENT), null),
)

private fun deckOption(data: StartData, deck: IndexDeck, base: StartChoice): OptionModel {
    val seen = seenPercent(data.progress, deck, data.cardIds[deck.id])
    val forward = if (deck.sections.isNotEmpty()) {
        Forward(Step.FOUR, base.copy(deckId = deck.id), PassFieldName.DECK)
    } else {
        Forward(Step.FIVE, base.copy(deckId = deck.id, sectionId = WHOLE_DECK), PassFieldName.DECK)
    }
    return OptionModel(
        id = deck.id,
        kind = OptionKind.DECK,
        name = deck.code,
        code = true,
        detail = deck.title,
        seenPercent = seen,
        stub = StubText(StartCopy.CARDS, deck.cardCount.toString()),
        label = "${deck.code}, ${deck.title}, ${deck.cardCount} cards, ${if (seen > 0) "$seen percent seen" else "not started"}",
        forward = forward,
    )
}

private fun sectionOption(deck: IndexDeck, section: SectionView, choice: StartChoice): OptionModel = OptionModel(
    id = section.id,
    kind = OptionKind.SECTION,
    name = if (section.whole) StartCopy.WHOLE_DECK_NAME else section.id,
    code = !section.whole,
    detail = if (section.whole) "All ${deck.sections.size} sections" else section.title,
    stub = StubText(StartCopy.CARDS, section.cardCount.toString()),
    label = if (section.whole) {
        "Whole deck, all ${deck.sections.size} sections, ${section.cardCount} cards"
    } else {
        "${section.id}, ${section.title}, ${section.cardCount} cards"
    },
    forward = Forward(Step.FIVE, choice.copy(sectionId = section.id), PassFieldName.SECTION),
)

private fun classOption(data: StartData, mode: ModeInfo, choice: StartChoice): OptionModel {
    val deckId = choice.deckId
    val sectionId = choice.sectionId
    val best = if (mode.offered && deckId != null && sectionId != null) bestFor(data.progress, Route(deckId, sectionId), mode.id) else null
    return OptionModel(
        id = mode.id.wire,
        kind = OptionKind.CLASS,
        name = mode.name,
        detail = mode.description,
        sub = if (mode.offered) null else StartCopy.NOT_AVAILABLE,
        unavailable = !mode.offered,
        stub = if (best == null) {
            StubText(StartCopy.BEST, StartCopy.NO_BEST, StartCopy.NOT_PLAYED, muted = true)
        } else {
            StubText(StartCopy.BEST, best.toString(), mode.unit)
        },
        label = when {
            !mode.offered -> "${mode.name}, not available yet"
            best == null -> "${mode.name}. ${mode.description} Not played yet."
            else -> "${mode.name}. ${mode.description} Your best: $best ${mode.unit}."
        },
        forward = if (mode.offered) Forward(Step.SIX, choice.copy(mode = mode.id), PassFieldName.MODE) else null,
    )
}

// ---------- the continue line ----------

/** What the continue line shows and says (StartFlow.tsx:841-849, ContinueLine.tsx). `choice` is the full pass it fills. */
data class ContinueModel(
    val deckCode: String,
    val deckName: String,
    val sectionCode: String,
    val sectionTitle: String,
    val modeLabel: String,
    val lastScore: String?,
    val label: String,
    val choice: StartChoice,
)

fun continueModel(data: StartData, table: List<ModeInfo> = MODE_TABLE): ContinueModel? {
    val target = continueTarget(data.index, data.progress, table) ?: return null
    val found = target.found
    val deckName = deckPassName(found.platform, found.deck)
    val sectionTitle = found.section?.title ?: StartCopy.WHOLE_DECK_NAME
    val modeLabel = modeInfo(target.mode, table).name
    val lastScore = target.lastScore?.let { lastScoreText(target.mode, it.score, it.total) }
    return ContinueModel(
        deckCode = found.deck.code,
        deckName = deckName,
        sectionCode = found.section?.id ?: WHOLE_DECK,
        sectionTitle = sectionTitle,
        modeLabel = modeLabel,
        lastScore = lastScore,
        label = continueLabel(deckName, sectionTitle, modeLabel, lastScore),
        choice = StartChoice(
            areaId = found.area.id,
            platformId = found.platform.id,
            deckId = found.deck.id,
            sectionId = target.route.sectionId,
            mode = target.mode,
        ),
    )
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/FrWidths.kt`:

```kotlin
package com.eienmosu.truthy.start

import kotlin.math.floor

/**
 * Column widths of a CSS grid whose tracks are `minmax(min, fr)` (FillInPass.tsx:342 and :360, BoardingPass.tsx:82):
 * the fr unit is the free width over the flexible fractions; a track whose share is under its minimum keeps the
 * minimum and leaves the sharing, and the unit is worked out again until no track is under its minimum (CSS Grid,
 * "find the size of an fr"). Whole pixels: each width is floored and the rounding rest goes to the last flexible track.
 * Minimums wider than the row overflow, as in CSS.
 */
fun frWidths(total: Int, fractions: List<Float>, mins: List<Int>): List<Int> {
    val fixed = BooleanArray(fractions.size)
    var free = total.toFloat()
    var unit = 0f
    var changed = true
    while (changed) {
        changed = false
        val share = fractions.indices.filter { !fixed[it] }.sumOf { fractions[it].toDouble() }.toFloat()
        unit = if (share > 0f) (free / share).coerceAtLeast(0f) else 0f
        for (i in fractions.indices) {
            if (!fixed[i] && fractions[i] * unit < mins[i]) {
                fixed[i] = true
                free -= mins[i]
                changed = true
            }
        }
    }
    val widths = fractions.indices.map { if (fixed[it]) mins[it] else floor(fractions[it] * unit).toInt() }.toMutableList()
    val rest = total - widths.sum()
    val last = fractions.indices.lastOrNull { !fixed[it] }
    if (last != null && rest > 0) widths[last] += rest
    return widths
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartGeometry.kt`:

```kotlin
package com.eienmosu.truthy.start

import androidx.compose.ui.unit.dp

/** Sizes the web's start-flow code draws that no token holds. Each names the line it comes from. */
object StartGeometry {
    val logoTop = 36.dp                // StartFlow.tsx:777, pt-9 above the logo
    val taglineMax = 300.dp            // StartFlow.tsx:779
    val readyLineMax = 320.dp          // StartFlow.tsx:983
    val switchLogoRow = 32.dp          // StartFlow.tsx:274, SWITCH_OFFSET_LOGO_ROW
    val fieldTop = 9.dp                // FillInPass.tsx:181
    val fieldBottom = 11.dp            // FillInPass.tsx:181
    val fieldValueTop = 3.dp           // FillInPass.tsx:192
    val wayBackRadius = 6.dp           // FillInPass.tsx:86
    val dashWidth = 14.dp              // FillInPass.tsx:151
    val dashHeight = 3.dp              // FillInPass.tsx:151
    val dashGap = 5.dp                 // FillInPass.tsx:141
    val lineWordHeight = 22.dp         // FillInPass.tsx:225
    val legGap = 40.dp                 // FillInPass.tsx:285, the empty middle column of the legs
    val readyCellBottom = 7.dp         // FillInPass.tsx:301
    val compactMarkWidth = 20.dp       // FillInPass.tsx:104
    val compactMarkBoxWidth = 22.dp    // FillInPass.tsx:103
    val compactMarkBoxHeight = 16.dp   // FillInPass.tsx:103
    val continueMarkWidth = 26.dp      // ContinueLine.tsx:59
    val continueLineGap = 3.dp         // ContinueLine.tsx:66
    const val FOCUS_ROOM = 8.0         // StartFlow.tsx:307, room around a card scrolled into view
}

/**
 * app/globals.css:34: `tight` under 600 tall. The `short` rule (under 568, globals.css:29) and the step title's 36 row
 * (StartFlow.tsx:370) are Tokens.Native.shortScreenBelow and Tokens.Native.stepTitleRow, from plan A's native group.
 */
object Breakpoints {
    val tight = 600.dp
}
```

- [ ] **Step 6: Run the tests and see them pass.**

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.start.*'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.start.*.xml
```

Expected: `BUILD SUCCESSFUL`, and the two report lines `tests="3" skipped="0" failures="0" errors="0"` (`FrWidthsTest`) and `tests="13" skipped="0" failures="0" errors="0"` (`StartOptionsTest`). If a label differs from the web's, the copy in this step is wrong, not the test: the test strings come from `tests/components/start/StartFlow.test.tsx:194-316` and reference 4.5.

- [ ] **Step 7: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartCopy.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartOptions.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/FrWidths.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartGeometry.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/StartFixtures.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/StartOptionsTest.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/FrWidthsTest.kt android/Truthy/gradle/libs.versions.toml android/Truthy/app/build.gradle.kts
git commit -m "feat: work out the Android start flow's options, pass layouts and copy"
```

(`git add` of the two Gradle files is harmless when step 2 changed nothing.)

- [ ] **Step 8: Write the failing tests for the forward motion and for the back motion's first and last frames.**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/LayersAssert.kt`:

```kotlin
package com.eienmosu.truthy.start

import org.junit.Assert.assertEquals

const val EPS = 1e-4f

fun assertLayer(expected: Layer, actual: Layer, what: String = "") {
    assertEquals("$what alpha", expected.alpha, actual.alpha, EPS)
    assertEquals("$what offsetY", expected.offsetY, actual.offsetY, EPS)
}

/**
 * The arriving step at rest: everything that leaves is invisible (where it went does not matter; the old title is
 * drawn inside the old panel, so the panel's alpha covers it), everything that arrives is fully shown in its place.
 */
fun assertAtRest(itemCount: Int, layers: StepLayers, what: String = "") {
    assertEquals("$what old panel", 0f, layers.oldPanel.alpha, EPS)
    assertEquals("$what new panel", 1f, layers.newPanelAlpha, EPS)
    for (i in 0 until itemCount) assertLayer(Layer.Shown, layers.item(i), "$what item $i")
    assertEquals("$what leaving dashes", 0f, layers.dashOutAlpha, EPS)
    assertEquals("$what arriving dashes", 1f, layers.dashInAlpha, EPS)
    assertEquals("$what old block", 0f, layers.oldBlockAlpha, EPS)
    assertEquals("$what new block", 1f, layers.newBlockAlpha, EPS)
    assertEquals("$what morph", 1f, layers.passMorph, EPS)
    assertEquals("$what top out", 0f, layers.topOut.alpha, EPS)
    assertLayer(Layer.Shown, layers.topIn, "$what top in")
    assertEquals("$what foot out", 0f, layers.footOut.alpha, EPS)
    assertLayer(Layer.Shown, layers.footIn, "$what foot in")
    assertEquals("$what switch", 1f, layers.switchMove, EPS)
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/StepMotionTest.kt` (the values are StartFlow.tsx:230-269 and FillInPass.tsx:131-132, 379-385, read through the generated tokens):

```kotlin
package com.eienmosu.truthy.start

import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.engine.Step
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StepMotionTest {
    private fun ease(x: Float) = Tokens.Curves.ease.transform(x)
    private fun easeOut(x: Float) = Tokens.Curves.easeOut.transform(x)
    private fun forward(t: Int, n: Int = 3, reduced: Boolean = false, swaps: Swaps = Swaps.NONE) = forwardLayers(t.toFloat(), n, reduced, swaps)

    @Test
    fun theOldPanelRisesTenAndFadesOver140WhileItsTitleFadesIn80() {
        assertLayer(Layer(1f, 0f), forward(0).oldPanel)
        assertEquals(1f - easeOut(0.5f), forward(70).oldPanel.alpha, EPS)
        assertEquals(-10f * easeOut(0.5f), forward(70).oldPanel.offsetY, EPS)
        assertLayer(Layer(0f, -10f), forward(140).oldPanel)
        assertEquals(1f - easeOut(0.5f), forward(40).oldTitleAlpha, EPS)
        assertEquals(0f, forward(80).oldTitleAlpha, EPS)
        assertEquals(1f, forward(0).newPanelAlpha, EPS)
    }

    @Test
    fun theNewItemsRiseFrom24BelowAfter110Plus25Each() {
        assertLayer(Layer(0f, 24f), forward(110).item(0))
        assertLayer(Layer(0f, 24f), forward(135).item(1))
        assertEquals(ease(0.5f), forward(255).item(1).alpha, EPS)
        assertEquals(24f * (1f - ease(0.5f)), forward(255).item(1).offsetY, EPS)
        assertLayer(Layer.Shown, forward(350).item(0))
        assertLayer(Layer.Shown, forward(400).item(2))
    }

    @Test
    fun theDashesOfTheChosenFieldLeaveAfter120Over100() {
        assertEquals(1f, forward(120).dashOutAlpha, EPS)
        assertEquals(1f - easeOut(0.5f), forward(170).dashOutAlpha, EPS)
        assertEquals(0f, forward(220).dashOutAlpha, EPS)
        assertEquals(1f, forward(0).dashInAlpha, EPS)
    }

    @Test
    fun aNewPassLayoutCrossFadesWhileThePaperChangesShapeOver360() {
        val block = Swaps.NONE.copy(block = true)
        assertEquals(1f, forward(0, swaps = block).oldBlockAlpha, EPS)
        assertEquals(0f, forward(120, swaps = block).oldBlockAlpha, EPS)
        assertEquals(0f, forward(90, swaps = block).newBlockAlpha, EPS)
        assertEquals(ease(0.5f), forward(200, swaps = block).newBlockAlpha, EPS)
        assertEquals(1f, forward(310, swaps = block).newBlockAlpha, EPS)
        assertEquals(ease(0.5f), forward(180, swaps = block).passMorph, EPS)
        assertEquals(1f, forward(360, swaps = block).passMorph, EPS)
        assertEquals(0f, forward(0).oldBlockAlpha, EPS)
        assertEquals(1f, forward(0).newBlockAlpha, EPS)
        assertEquals(1f, forward(0).passMorph, EPS)
    }

    @Test
    fun leavingStep1TheLogoRisesAwayThePassComesUpAndTheSwitchMoves() {
        val swaps = swapsFor(Step.ONE, Step.TWO, FootContent.NONE, FootContent.NONE)
        assertEquals(ZoneSwap(outRise = -12f, inRise = 12f), swaps.top)
        assertLayer(Layer(1f, 0f), forward(0, swaps = swaps).topOut)
        assertLayer(Layer(0f, -12f), forward(110, swaps = swaps).topOut)
        assertLayer(Layer(0f, 12f), forward(120, swaps = swaps).topIn)
        assertLayer(Layer.Shown, forward(360, swaps = swaps).topIn)
        assertEquals(ease(0.5f), forward(120, swaps = swaps).switchMove, EPS)
        assertEquals(1f, forward(240, swaps = swaps).switchMove, EPS)
        assertEquals(ZoneSwap(outRise = 12f, inRise = -12f), swapsFor(Step.TWO, Step.ONE, FootContent.NONE, FootContent.NONE).top)
    }

    @Test
    fun theMotionLastsUntilTheLastItemHasArrivedAndAtLeast360() {
        assertEquals(360, forwardDurationMs(1, reduced = false))
        assertEquals(400, forwardDurationMs(3, reduced = false))
        assertEquals(575, forwardDurationMs(10, reduced = false))
        assertEquals(230, forwardDurationMs(10, reduced = true))
    }

    @Test
    fun reducedMotionFadesTheOldStepOutIn100AndTheNewInOver140After90() {
        val block = Swaps(top = ZoneSwap(-12f, 12f), foot = null, block = true, switchMoves = true)
        assertEquals(1f, forward(0, reduced = true).oldPanel.alpha, EPS)
        assertEquals(0.5f, forward(50, reduced = true).oldPanel.alpha, EPS)
        assertEquals(0f, forward(100, reduced = true).oldPanel.alpha, EPS)
        assertEquals(0f, forward(90, reduced = true).newPanelAlpha, EPS)
        assertEquals(0.5f, forward(160, reduced = true).newPanelAlpha, EPS)
        assertEquals(1f, forward(230, reduced = true).newPanelAlpha, EPS)
        assertLayer(Layer(0.5f, 0f), forward(50, reduced = true, swaps = block).topOut)
        assertLayer(Layer(0.5f, 0f), forward(160, reduced = true, swaps = block).topIn)
        assertEquals(1f, forward(0, reduced = true, swaps = block).passMorph, EPS)
        assertEquals(1f, forward(0, reduced = true, swaps = block).switchMove, EPS)
        assertEquals(0f, forward(0, reduced = true).dashOutAlpha, EPS)
        for (i in 0 until 3) assertLayer(Layer.Shown, forward(0, reduced = true).item(i))
    }

    @Test
    fun everyForwardMotionEndsAtRest() {
        val all = listOf(
            Swaps.NONE,
            swapsFor(Step.ONE, Step.TWO, FootContent.CONTINUE, FootContent.NONE),
            swapsFor(Step.THREE, Step.FOUR, FootContent.NONE, FootContent.NONE),
            swapsFor(Step.ONE, Step.SIX, FootContent.CONTINUE, FootContent.START),
        )
        for (reduced in listOf(false, true)) for (swaps in all) for (n in listOf(1, 4, 9)) {
            assertAtRest(n, forwardLayers(forwardDurationMs(n, reduced).toFloat(), n, reduced, swaps), "reduced $reduced, $swaps, $n items")
        }
    }

    @Test
    fun theSwapsFollowTheSteps() {
        assertEquals(Swaps.NONE, swapsFor(Step.TWO, Step.THREE, FootContent.NONE, FootContent.NONE))
        assertTrue(swapsFor(Step.THREE, Step.FOUR, FootContent.NONE, FootContent.NONE).block)
        assertTrue(swapsFor(Step.FIVE, Step.SIX, FootContent.NONE, FootContent.START).block)
        val continued = swapsFor(Step.ONE, Step.SIX, FootContent.CONTINUE, FootContent.START)
        assertEquals(ZoneSwap(outRise = 12f, inRise = 12f), continued.foot)
        assertEquals(false, continued.block)
        assertEquals(true, continued.switchMoves)
        assertNull(swapsFor(Step.FOUR, Step.FIVE, FootContent.NONE, FootContent.NONE).top)
        assertEquals(FootContent.CONTINUE, footContent(Step.ONE, hasContinue = true))
        assertEquals(FootContent.NONE, footContent(Step.ONE, hasContinue = false))
        assertEquals(FootContent.START, footContent(Step.SIX, hasContinue = true))
        assertEquals(FootContent.NONE, footContent(Step.THREE, hasContinue = true))
    }
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/BackTransitionCommitTest.kt` (Review Focus 1: below Android 14 a back delivers no progress and commits at once, so the frame at p = 1, read through `backLayers`, must be the arriving step at rest; at p = 0 nothing has moved yet):

```kotlin
package com.eienmosu.truthy.start

import com.eienmosu.truthy.BackTransition
import com.eienmosu.truthy.engine.Step
import org.junit.Assert.assertEquals
import org.junit.Test

class BackTransitionCommitTest {
    private val oneStepBacks = listOf(
        Step.TWO to Step.ONE,
        Step.THREE to Step.TWO,
        Step.FOUR to Step.THREE,
        Step.FIVE to Step.THREE,
        Step.FIVE to Step.FOUR,
        Step.SIX to Step.FIVE,
    )

    private fun swaps(from: Step, to: Step) = swapsFor(
        from, to,
        footContent(from, hasContinue = true),
        footContent(to, hasContinue = true),
    )

    @Test
    fun aBackWithoutProgressCommitsAtOnceWithTheArrivingStepAtRest() {
        for ((from, to) in oneStepBacks) for (reduced in listOf(false, true)) for (n in listOf(1, 5, 12)) {
            val transition = BackTransition(from, to, n)
            assertAtRest(n, backLayers(transition.frame(1f, reduced), n, swaps(from, to)), "$from to $to, reduced $reduced, $n items")
            assertEquals(0, remainingMs(lastProgress = null, totalMs = transition.durationMs(reduced)))
        }
    }

    @Test
    fun atProgressZeroTheStepBeingLeftIsUntouched() {
        for ((from, to) in oneStepBacks) for (reduced in listOf(false, true)) {
            val layers = backLayers(BackTransition(from, to, 5).frame(0f, reduced), 5, swaps(from, to))
            assertLayer(Layer(1f, 0f), layers.oldPanel, "$from to $to, reduced $reduced")
            assertEquals(1f, layers.oldTitleAlpha, EPS)
            for (i in 0 until 5) assertEquals("$from to $to, reduced $reduced, item $i", 0f, layers.item(i).alpha, EPS)
        }
    }

    @Test
    fun theForwardAndTheBackLastTheSameForTheSameItems() {
        for (n in 1..12) for (reduced in listOf(false, true)) {
            assertEquals("$n items, reduced $reduced", BackTransition(Step.SIX, Step.FIVE, n).durationMs(reduced), forwardDurationMs(n, reduced))
        }
    }

    @Test
    fun aCommitAfterProgressPlaysOnlyWhatIsLeft() {
        assertEquals(200, remainingMs(lastProgress = 0.5f, totalMs = 400))
        assertEquals(400, remainingMs(lastProgress = 0f, totalMs = 400))
        assertEquals(0, remainingMs(lastProgress = 1f, totalMs = 400))
    }
}
```

- [ ] **Step 9: Run the tests and see them fail.**

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.start.*'
```

Expected: `> Task :app:compileDebugUnitTestKotlin FAILED` with `Unresolved reference 'Layer'` in `LayersAssert.kt` and unresolved references to `StepLayers`, `Swaps`, `ZoneSwap`, `FootContent`, `forwardLayers`, `forwardDurationMs`, `swapsFor`, `footContent`, `backLayers` and `remainingMs`, then `BUILD FAILED`.

- [ ] **Step 10: Write the motion model and the one adapter from `BackFrame`.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StepMotion.kt`:

```kotlin
package com.eienmosu.truthy.start

import androidx.compose.animation.core.Easing
import androidx.compose.runtime.Immutable
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.engine.Step
import kotlin.math.max
import kotlin.math.roundToInt

/** How a part is drawn in one frame: its opacity and its vertical offset in dp (positive downwards). */
@Immutable
data class Layer(val alpha: Float, val offsetY: Float) {
    companion object {
        val Shown = Layer(1f, 0f)
        val Gone = Layer(0f, 0f)
    }
}

/** A zone (top or foot) that swaps its content: the leaving content moves to `outRise`, the arriving one comes from `inRise` (dp). */
@Immutable
data class ZoneSwap(val outRise: Float, val inRise: Float)

/** What a step change moves besides the panels: the top zone, the foot zone, the pass's layout, the theme switch. */
@Immutable
data class Swaps(val top: ZoneSwap?, val foot: ZoneSwap?, val block: Boolean, val switchMoves: Boolean) {
    companion object {
        val NONE = Swaps(top = null, foot = null, block = false, switchMoves = false)
    }
}

/** What the foot zone holds (StartFlow.tsx:837-866): the continue line on step 1, Start round on step 6. */
enum class FootContent { NONE, CONTINUE, START }

/**
 * One frame of a step change. `oldPanel` and `oldTitleAlpha` draw the step being left; `newPanelAlpha` and `items`
 * (the title first, then each option) the arriving one; `dashOutAlpha` the dashes of the fields being filled (forward),
 * `dashInAlpha` those of the fields being cleared (back); the pass's two blocks and the change of its shape; the two
 * zones; and how far the theme switch has moved to its new row (0 to 1).
 */
@Immutable
data class StepLayers(
    val oldPanel: Layer,
    val oldTitleAlpha: Float,
    val newPanelAlpha: Float,
    val items: List<Layer>,
    val dashOutAlpha: Float,
    val dashInAlpha: Float,
    val oldBlockAlpha: Float,
    val newBlockAlpha: Float,
    val passMorph: Float,
    val topOut: Layer,
    val topIn: Layer,
    val footOut: Layer,
    val footIn: Layer,
    val switchMove: Float,
) {
    fun item(index: Int): Layer = items.getOrElse(index) { Layer.Shown }

    companion object {
        fun rest(itemCount: Int): StepLayers = StepLayers(
            oldPanel = Layer.Gone,
            oldTitleAlpha = 0f,
            newPanelAlpha = 1f,
            items = List(itemCount) { Layer.Shown },
            dashOutAlpha = 0f,
            dashInAlpha = 1f,
            oldBlockAlpha = 0f,
            newBlockAlpha = 1f,
            passMorph = 1f,
            topOut = Layer.Gone,
            topIn = Layer.Shown,
            footOut = Layer.Gone,
            footIn = Layer.Shown,
            switchMove = 1f,
        )
    }
}

/** Times and distances of the start flow's motion that are not a token of their own. */
object StartMotionTimes {
    /** FillInPass.tsx:131: the dashes of a field being filled wait 120 ms (the value of t1) before they leave. */
    val dashOutDelayMs: Int get() = Tokens.Duration.t1

    /** FillInPass.tsx:379 and :382, StartFlow.tsx:249: the 90 ms before a new pass block or a reduced step fades in. No token holds 90. */
    const val FADE_IN_DELAY_MS = 90

    /** StartFlow.tsx:234: the panel's 10 px rise (forward) or sink (back). */
    val panelTravelDp: Float get() = Tokens.Space.s10.value

    /** StartFlow.tsx:238: the items' 24 px. */
    val itemTravelDp: Float get() = Tokens.Space.s24.value

    /** StartFlow.tsx:263: the zones' 12 px. */
    val zoneTravelDp: Float get() = Tokens.Space.s12.value
}

fun footContent(step: Step, hasContinue: Boolean): FootContent = when {
    step == Step.ONE && hasContinue -> FootContent.CONTINUE
    step == Step.SIX -> FootContent.START
    else -> FootContent.NONE
}

/** StartFlow.tsx:775-866: the logo leaves upward and the trip rises in, or the reverse; the foot swaps its content; the pass changes layout between stages. */
fun swapsFor(from: Step, to: Step, footFrom: FootContent, footTo: FootContent): Swaps {
    val zone = StartMotionTimes.zoneTravelDp
    val top = when {
        from == Step.ONE && to != Step.ONE -> ZoneSwap(outRise = -zone, inRise = zone)
        from != Step.ONE && to == Step.ONE -> ZoneSwap(outRise = zone, inRise = -zone)
        else -> null
    }
    val foot = if (footFrom == footTo) null else ZoneSwap(outRise = zone, inRise = zone)
    val block = from != Step.ONE && to != Step.ONE && stageOf(from) != stageOf(to)
    return Swaps(top = top, foot = foot, block = block, switchMoves = (from == Step.ONE) != (to == Step.ONE))
}

internal fun progress(t: Float, delayMs: Int, durationMs: Int): Float =
    if (durationMs <= 0) (if (t >= delayMs) 1f else 0f) else ((t - delayMs) / durationMs).coerceIn(0f, 1f)

internal fun Easing.at(x: Float): Float = when {
    x <= 0f -> 0f
    x >= 1f -> 1f
    else -> transform(x)
}

/** How long a step change runs: until the last item has arrived, and at least as long as the pass's change of shape and the zone swap. */
fun forwardDurationMs(itemCount: Int, reduced: Boolean): Int {
    val d = Tokens.Duration
    if (reduced) return StartMotionTimes.FADE_IN_DELAY_MS + d.reducedIn
    val lastItem = d.stepEnterDelay + d.stepStagger * max(0, itemCount - 1) + d.stepEnter
    return max(lastItem, max(d.t3, d.topEnterDelay + d.stepEnter))
}

/** The time left for a back that commits at `lastProgress`; none at all when no progress was ever reported (an instant commit). */
fun remainingMs(lastProgress: Float?, totalMs: Int): Int =
    if (lastProgress == null) 0 else ((1f - lastProgress.coerceIn(0f, 1f)) * totalMs).roundToInt()

/** The forward step change at `tMs` (StartFlow.tsx:230-269, FillInPass.tsx:131-132 and 379-385; reduced: StartFlow.tsx:247-260). */
fun forwardLayers(tMs: Float, itemCount: Int, reduced: Boolean, swaps: Swaps): StepLayers {
    val d = Tokens.Duration
    if (reduced) {
        val out = 1f - progress(tMs, 0, d.reducedOut)
        val enter = progress(tMs, StartMotionTimes.FADE_IN_DELAY_MS, d.reducedIn)
        return StepLayers(
            oldPanel = Layer(out, 0f),
            oldTitleAlpha = 1f, // the title fades with its panel (a title's alpha multiplies the panel's)
            newPanelAlpha = enter,
            items = List(itemCount) { Layer.Shown },
            dashOutAlpha = 0f,
            dashInAlpha = 1f,
            oldBlockAlpha = if (swaps.block) out else 0f,
            newBlockAlpha = if (swaps.block) enter else 1f,
            passMorph = 1f,
            topOut = if (swaps.top != null) Layer(out, 0f) else Layer.Gone,
            topIn = if (swaps.top != null) Layer(enter, 0f) else Layer.Shown,
            footOut = if (swaps.foot != null) Layer(out, 0f) else Layer.Gone,
            footIn = if (swaps.foot != null) Layer(enter, 0f) else Layer.Shown,
            switchMove = 1f,
        )
    }
    val ease = Tokens.Curves.ease
    val easeOut = Tokens.Curves.easeOut
    val exit = easeOut.at(progress(tMs, 0, d.stepExit))
    val zoneOut = ease.at(progress(tMs, 0, d.topExit))
    val zoneIn = ease.at(progress(tMs, d.topEnterDelay, d.stepEnter))
    return StepLayers(
        oldPanel = Layer(1f - exit, -StartMotionTimes.panelTravelDp * exit),
        oldTitleAlpha = 1f - easeOut.at(progress(tMs, 0, d.stepExitTitle)),
        newPanelAlpha = 1f,
        items = List(itemCount) { i ->
            val e = ease.at(progress(tMs, d.stepEnterDelay + d.stepStagger * i, d.stepEnter))
            Layer(e, StartMotionTimes.itemTravelDp * (1f - e))
        },
        dashOutAlpha = 1f - easeOut.at(progress(tMs, StartMotionTimes.dashOutDelayMs, d.dashOut)),
        dashInAlpha = 1f,
        oldBlockAlpha = if (swaps.block) 1f - easeOut.at(progress(tMs, 0, d.t1)) else 0f,
        newBlockAlpha = if (swaps.block) ease.at(progress(tMs, StartMotionTimes.FADE_IN_DELAY_MS, d.t2)) else 1f,
        passMorph = if (swaps.block) ease.at(progress(tMs, 0, d.t3)) else 1f,
        topOut = swaps.top?.let { Layer(1f - zoneOut, it.outRise * zoneOut) } ?: Layer.Gone,
        topIn = swaps.top?.let { Layer(zoneIn, it.inRise * (1f - zoneIn)) } ?: Layer.Shown,
        footOut = swaps.foot?.let { Layer(1f - zoneOut, it.outRise * zoneOut) } ?: Layer.Gone,
        footIn = swaps.foot?.let { Layer(zoneIn, it.inRise * (1f - zoneIn)) } ?: Layer.Shown,
        switchMove = if (swaps.switchMoves) ease.at(progress(tMs, 0, d.stepEnter)) else 1f,
    )
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/BackLayers.kt` (the only place this task reads `BackFrame`; if step 1 printed other member names, this function is the one to change):

```kotlin
package com.eienmosu.truthy.start

import com.eienmosu.truthy.BackFrame
import com.eienmosu.truthy.BackLayer

private fun BackLayer.toLayer(): Layer = Layer(alpha, offsetY)

/**
 * One frame of task 11's back motion as the layers the start screen draws. The arriving panel itself never fades
 * (its items do, also under reduced motion); a zone, the pass's blocks or the theme switch only move when `swaps`
 * says this step change moves them.
 */
fun backLayers(frame: BackFrame, itemCount: Int, swaps: Swaps): StepLayers = StepLayers(
    oldPanel = frame.oldPanel.toLayer(),
    oldTitleAlpha = frame.oldTitleAlpha,
    newPanelAlpha = 1f,
    items = List(itemCount) { i -> frame.newItem(i).toLayer() },
    dashOutAlpha = 0f,
    dashInAlpha = frame.dashAlpha,
    oldBlockAlpha = if (swaps.block) frame.oldBlockAlpha else 0f,
    newBlockAlpha = if (swaps.block) frame.newBlockAlpha else 1f,
    passMorph = if (swaps.block) frame.morph else 1f,
    topOut = if (swaps.top != null) frame.tripOut.toLayer() else Layer.Gone,
    topIn = if (swaps.top != null) frame.brandIn.toLayer() else Layer.Shown,
    footOut = if (swaps.foot != null) frame.footOut.toLayer() else Layer.Gone,
    footIn = if (swaps.foot != null) frame.footIn.toLayer() else Layer.Shown,
    switchMove = if (swaps.switchMoves) frame.switchShift else 1f,
)
```

- [ ] **Step 11: Run the tests and see them pass.**

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.start.*'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.start.StepMotionTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.start.BackTransitionCommitTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="9" skipped="0" failures="0" errors="0"` for `StepMotionTest` and `tests="4" skipped="0" failures="0" errors="0"` for `BackTransitionCommitTest`; the 16 tests of step 6 still pass. If `BackTransitionCommitTest` fails on a value, the frame task 11 computes at p = 1 or p = 0 is not the web's rest or start, or `backLayers` reads a member with another meaning: read the failing message (it names the part, the steps and the motion setting), fix `backLayers` if it misreads a member, and otherwise stop and report the frame instead of changing the test, because this test is Review Focus 1's unit test. If `theForwardAndTheBackLastTheSameForTheSameItems` fails, `forwardDurationMs` and `BackTransition.durationMs` disagree on the web's timeline: both must be `max(360, 110 + 25 * (items - 1) + 240)`, and 230 with reduced motion.

- [ ] **Step 12: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StepMotion.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/BackLayers.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/LayersAssert.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/StepMotionTest.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/BackTransitionCommitTest.kt
git commit -m "feat: add the Android start flow's forward motion and read the back motion's frames"
```

- [ ] **Step 13: Write the failing tests for the back gesture, Escape and reduced motion.**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/BackGestureTest.kt`:

```kotlin
package com.eienmosu.truthy.start

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class BackGestureTest {
    @Test
    fun aBackWithoutProgressEventsCommitsAtOnce(): Unit = runBlocking {
        val seen = mutableListOf<Float>()
        var end: BackEnd? = null
        followBack(emptyFlow(), onProgress = { seen += it }) { end = it }
        assertEquals(emptyList<Float>(), seen)
        assertEquals(BackEnd.Committed(null), end)
    }

    @Test
    fun progressScrubsAndTheLastValueIsWhereTheCommitStarts(): Unit = runBlocking {
        val seen = mutableListOf<Float>()
        var end: BackEnd? = null
        followBack(flowOf(0.1f, 0.4f, 0.7f), onProgress = { seen += it }) { end = it }
        assertEquals(listOf(0.1f, 0.4f, 0.7f), seen)
        assertEquals(BackEnd.Committed(0.7f), end)
    }

    @Test
    fun aCancelledGestureEndsCancelledAndStillCancelsItsCoroutine() {
        val seen = mutableListOf<Float>()
        var end: BackEnd? = null
        assertThrows(CancellationException::class.java) {
            runBlocking {
                followBack(
                    flow {
                        emit(0.3f)
                        throw CancellationException("onBack cancelled")
                    },
                    onProgress = { seen += it },
                ) { end = it }
            }
        }
        assertEquals(listOf(0.3f), seen)
        assertEquals(BackEnd.Cancelled, end)
    }
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/StartKeysTest.kt`:

```kotlin
package com.eienmosu.truthy.start

import android.view.KeyEvent
import com.eienmosu.truthy.engine.Step
import org.junit.Assert.assertEquals
import org.junit.Test

class StartKeysTest {
    private fun escape(action: Int = KeyEvent.ACTION_DOWN, repeat: Int = 0, step: Step = Step.THREE, boarding: Boolean = false) =
        startKeyAction(KeyEvent.KEYCODE_ESCAPE, action, repeat, step, boarding)

    @Test
    fun escapeGoesBackOneStepOnceAndIsConsumedEverywhereElse() {
        assertEquals(StartKey.BACK, escape())
        assertEquals(StartKey.BACK, escape(step = Step.TWO))
        assertEquals(StartKey.CONSUME, escape(step = Step.ONE))          // nothing to go back to, and never Android's back
        assertEquals(StartKey.CONSUME, escape(repeat = 1))               // a held key acts once
        assertEquals(StartKey.CONSUME, escape(action = KeyEvent.ACTION_UP))
        assertEquals(StartKey.CONSUME, escape(boarding = true))          // the unroll ignores every back
    }

    @Test
    fun otherKeysAreLeftToTheViews() {
        assertEquals(StartKey.PASS, startKeyAction(KeyEvent.KEYCODE_ENTER, KeyEvent.ACTION_DOWN, 0, Step.THREE, false))
        assertEquals(StartKey.PASS, startKeyAction(KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.ACTION_DOWN, 0, Step.ONE, false))
    }
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/ReducedMotionTest.kt` (Review Focus 4):

```kotlin
package com.eienmosu.truthy.start

import androidx.compose.ui.MotionDurationScale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReducedMotionTest {
    @Test
    fun onlyAnAnimatorScaleOfZeroIsReducedMotion() {
        assertTrue(isReducedMotion(0f))
        assertFalse(isReducedMotion(1f))
        assertFalse(isReducedMotion(0.5f))
        assertFalse(isReducedMotion(10f))
    }

    @Test
    fun theFadesThatReducedMotionKeepsRunAtFullSpeed() {
        assertEquals(1f, motionContext(reduced = true)[MotionDurationScale]?.scaleFactor)
        assertNull(motionContext(reduced = false)[MotionDurationScale])
    }
}
```

- [ ] **Step 14: Run the tests and see them fail.**

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.start.*'
```

Expected: `> Task :app:compileDebugUnitTestKotlin FAILED` with unresolved references `BackEnd`, `followBack`, `StartKey`, `startKeyAction`, `isReducedMotion` and `motionContext`, then `BUILD FAILED`.

- [ ] **Step 15: Write the gesture follower, the key routing and reduced motion.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/BackGesture.kt`:

```kotlin
package com.eienmosu.truthy.start

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow

/** How a back gesture ended: committed (with the last progress reported, or none at all), or cancelled. */
sealed interface BackEnd {
    data class Committed(val lastProgress: Float?) : BackEnd
    data object Cancelled : BackEnd
}

/**
 * Follows one back gesture the way PredictiveBackHandler hands it over: each progress value scrubs the back motion;
 * the flow completing is a commit; a CancellationException is a cancel, reported and then rethrown so the
 * handler's coroutine still ends cancelled. Below Android 14 (and for `onBackPressed`) the flow completes with no
 * value, which `Committed(null)` reports: an instant commit.
 */
suspend fun followBack(progress: Flow<Float>, onProgress: (Float) -> Unit, onEnd: (BackEnd) -> Unit) {
    var last: Float? = null
    try {
        progress.collect { value ->
            last = value
            onProgress(value)
        }
    } catch (cancelled: CancellationException) {
        onEnd(BackEnd.Cancelled)
        throw cancelled
    }
    onEnd(BackEnd.Committed(last))
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartKeys.kt`:

```kotlin
package com.eienmosu.truthy.start

import android.view.KeyEvent
import com.eienmosu.truthy.engine.Step

/** What the start flow does with a hardware key: go back one step, swallow it, or leave it to the views. */
enum class StartKey { BACK, CONSUME, PASS }

/**
 * Escape (StartFlow.tsx:653-660; spec section 2, hardware keyboard): one step back on its first key-down; consumed
 * and doing nothing on step 1 and during the unroll, so Android never turns it into back; its repeats and its
 * key-up are consumed too, so a held key acts once. Every other key is left to the views.
 */
fun startKeyAction(keyCode: Int, action: Int, repeatCount: Int, step: Step, boarding: Boolean): StartKey {
    if (keyCode != KeyEvent.KEYCODE_ESCAPE) return StartKey.PASS
    if (action != KeyEvent.ACTION_DOWN || repeatCount > 0 || boarding || step == Step.ONE) return StartKey.CONSUME
    return StartKey.BACK
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/HardwareKeys.kt`:

```kotlin
package com.eienmosu.truthy

import android.view.KeyEvent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState

/**
 * Hardware keys reach the screen on top before any view: MainActivity.dispatchKeyEvent asks the handler registered
 * last. A handler that returns true has used the key, so Android neither hands it to a view nor turns an unused
 * Escape into back.
 */
object HardwareKeys {
    private val handlers = ArrayList<(KeyEvent) -> Boolean>()

    fun register(handler: (KeyEvent) -> Boolean): () -> Unit {
        handlers.add(handler)
        return { handlers.remove(handler) }
    }

    fun dispatch(event: KeyEvent): Boolean = handlers.lastOrNull()?.invoke(event) ?: false
}

/** Registers `onKey` with HardwareKeys while this composable is on screen. */
@Composable
fun HardwareKeyHandler(onKey: (KeyEvent) -> Boolean) {
    val current by rememberUpdatedState(onKey)
    DisposableEffect(Unit) {
        val unregister = HardwareKeys.register { event -> current(event) }
        onDispose { unregister() }
    }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/ReducedMotion.kt`:

```kotlin
package com.eienmosu.truthy.start

import android.content.Context
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.platform.LocalContext
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.EmptyCoroutineContext

/** Reference 5.8: on Android, reduced motion is "Remove animations", an animator duration scale of 0. */
fun isReducedMotion(animatorDurationScale: Float): Boolean = animatorDurationScale == 0f

fun readAnimatorDurationScale(context: Context): Float =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)

/** A MotionDurationScale of 1: the fades the web keeps under reduced motion run in real time although the system scale is 0. */
object FullSpeed : MotionDurationScale {
    override val scaleFactor: Float get() = 1f
}

/** The coroutine context a start-flow animation runs in: full speed under reduced motion, the system's own scale otherwise. */
fun motionContext(reduced: Boolean): CoroutineContext = if (reduced) FullSpeed else EmptyCoroutineContext

/** Whether reduced motion is on, read now and again whenever the setting changes. */
@Composable
fun rememberReducedMotion(): Boolean {
    val context = LocalContext.current
    var reduced by remember(context) { mutableStateOf(isReducedMotion(readAnimatorDurationScale(context))) }
    DisposableEffect(context) {
        val resolver = context.contentResolver
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                reduced = isReducedMotion(readAnimatorDurationScale(context))
            }
        }
        resolver.registerContentObserver(Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, observer)
        onDispose { resolver.unregisterContentObserver(observer) }
    }
    return reduced
}
```

In `android/Truthy/app/src/main/java/com/eienmosu/truthy/MainActivity.kt` (task 7 and 11 keep it under `java`), add `import android.view.KeyEvent` to the imports (if it is not there) and this member to the `MainActivity` class (if task 11 already overrides `dispatchKeyEvent`, put `HardwareKeys.dispatch(event) ||` in front of its body's result instead):

```kotlin
    override fun dispatchKeyEvent(event: KeyEvent): Boolean =
        HardwareKeys.dispatch(event) || super.dispatchKeyEvent(event)
```

- [ ] **Step 16: Run the tests and see them pass.**

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.start.*' :app:assembleDebug
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.start.BackGestureTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.start.StartKeysTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.start.ReducedMotionTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="3" ...failures="0" errors="0"` (`BackGestureTest`), `tests="2" ...failures="0" errors="0"` (`StartKeysTest`), `tests="2" ...failures="0" errors="0"` (`ReducedMotionTest`); the 29 earlier tests of the package still pass (36 in all).

- [ ] **Step 17: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/BackGesture.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartKeys.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/ReducedMotion.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/HardwareKeys.kt android/Truthy/app/src/main/java/com/eienmosu/truthy/MainActivity.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/BackGestureTest.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/StartKeysTest.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/start/ReducedMotionTest.kt
git commit -m "feat: follow predictive back, Escape and reduced motion in the Android start flow"
```

- [ ] **Step 18: Write the failing instrumented tests of the start flow.**

They drive the real app (`MainActivity`, the 54 embedded decks, task 11's model) on the emulator, so their labels are the shipped catalog's: Cloud holds 17 decks, AWS 7, CLF has 214 cards in 4 sections (reference 2.2, `content/catalog.json`). Ways forward wait 300 ms of real time first, because the model ignores option presses for 250 ms after a step appears (reference 4.3) and counts on `SystemClock.uptimeMillis`, not on the Compose test clock. Predictive back is driven through the activity's `OnBackPressedDispatcher` test entry points (`dispatchOnBackStarted`, `dispatchOnBackProgressed`, `dispatchOnBackCancelled`, which androidx.activity marks `@VisibleForTesting`), so the scrub and the cancel are tested on any API level; `onBackPressed()` is the release without progress that Android 13 and lower deliver.

`android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/start/StartFlowTest.kt`:

```kotlin
package com.eienmosu.truthy.start

import android.content.Context
import android.os.SystemClock
import android.view.KeyEvent
import androidx.activity.BackEventCompat
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.eienmosu.truthy.MainActivity
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StartFlowTest {
    @get:Rule
    val compose = createEmptyComposeRule()

    private var scenario: ActivityScenario<MainActivity>? = null
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context: Context get() = instrumentation.targetContext

    @After
    fun close() {
        scenario?.close()
    }

    /** A fresh install's state (no progress, no round journal, no stored theme), or the given progress, then the app at step 1. */
    private fun launch(progressJson: String? = null) {
        val files = context.filesDir
        for (name in STORE_FILES) for (suffix in listOf("", ".bak", ".new")) File(files, name + suffix).delete()
        File(context.applicationInfo.dataDir, "shared_prefs").listFiles()?.forEach { file ->
            context.getSharedPreferences(file.name.removeSuffix(".xml"), Context.MODE_PRIVATE).edit().clear().commit()
        }
        if (progressJson != null) File(files, PROGRESS_FILE).writeText(progressJson)
        scenario = ActivityScenario.launch(MainActivity::class.java)
        compose.waitUntil(TIMEOUT_MS) { exists("Cloud, 17 decks") }
        compose.waitForIdle()
    }

    private fun labelled(label: String, substring: Boolean = false): SemanticsMatcher =
        hasContentDescription(label, substring = substring) or hasText(label, substring = substring)

    private fun exists(label: String, substring: Boolean = false): Boolean =
        compose.onAllNodes(labelled(label, substring)).fetchSemanticsNodes().isNotEmpty()

    private fun count(label: String): Int = compose.onAllNodes(labelled(label)).fetchSemanticsNodes().size

    /** A way forward: after the settle time, press the card and wait for the next step's title. */
    private fun choose(label: String, arrivesAt: String, substring: Boolean = false, scroll: Boolean = true) {
        SystemClock.sleep(SETTLE_WAIT_MS)
        val node = compose.onNode(labelled(label, substring))
        // The Continue line is drawn outside the step's scrolling list: it is pressed where it is.
        if (scroll) node.performScrollTo()
        node.performClick()
        compose.waitUntil(TIMEOUT_MS) { exists(arrivesAt) }
        compose.waitForIdle()
    }

    /** A way back: never held by the settle time. */
    private fun goBack(label: String, arrivesAt: String) {
        compose.onNode(labelled(label)).performClick()
        compose.waitUntil(TIMEOUT_MS) { exists(arrivesAt) }
        compose.waitForIdle()
    }

    private fun toDecks() {
        choose("Cloud, 17 decks", "Choose a platform")
        choose("AWS, 7 decks", "Choose a deck")
    }

    private fun onActivity(block: (MainActivity) -> Unit) {
        checkNotNull(scenario).onActivity { block(it) }
    }

    private fun backEvent(progress: Float) = BackEventCompat(touchX = 120f * progress, touchY = 400f, progress = progress, swipeEdge = BackEventCompat.EDGE_LEFT)

    @Test
    fun walksTheWholePathAndFillsThePass() {
        launch()
        choose("Cloud, 17 decks", "Choose a platform")
        assertTrue(exists("Change area, now Cloud"))
        assertEquals(2, count("not chosen"))
        choose("AWS, 7 decks", "Choose a deck")
        assertTrue(exists("Change platform, now AWS"))
        choose("CLF, Cloud Practitioner, 214 cards, not started", "Choose a section")
        assertTrue(exists("Change deck, now CLF"))
        assertTrue(exists("Whole deck, all 4 sections, 214 cards"))
        choose("SEC, Security and compliance, ", "Choose how to play", substring = true)
        assertTrue(exists("Change section, now SEC"))
        choose("Classic. Correct answers out of 10 cards. Not played yet.", "Your pass is ready")
        assertTrue(exists("Correct answers out of 10 cards. Swipe right for true, left for false."))
        assertTrue(exists("Change class, now Classic"))
        assertTrue(exists("Start round"))
        assertTrue(exists("Back to classes"))
    }

    @Test
    fun theBackPillAndThePassFieldsGoBackAndClearTheLaterChoices() {
        launch()
        toDecks()
        goBack("Back to platforms", "Choose a platform")
        assertFalse(exists("Change platform, now AWS"))
        choose("AWS, 7 decks", "Choose a deck")
        choose("CLF, Cloud Practitioner, 214 cards, not started", "Choose a section")
        goBack("Change area, now Cloud", "Choose an area")
        assertFalse(exists("Change area, now Cloud"))
        assertTrue(exists("Cloud, 17 decks"))
    }

    @Test
    fun escapeGoesBackOneStepAndDoesNothingOnStep1() {
        launch()
        choose("Cloud, 17 decks", "Choose a platform")
        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ESCAPE)
        compose.waitUntil(TIMEOUT_MS) { exists("Choose an area") }
        compose.waitForIdle()
        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ESCAPE)
        compose.waitForIdle()
        assertTrue(exists("Choose an area"))
        assertEquals(Lifecycle.State.RESUMED, checkNotNull(scenario).state)
    }

    @Test
    fun predictiveBackScrubsTheBackMotionAndACancelChangesNothing() {
        launch()
        toDecks()
        onActivity { it.onBackPressedDispatcher.dispatchOnBackStarted(backEvent(0f)) }
        onActivity { it.onBackPressedDispatcher.dispatchOnBackProgressed(backEvent(0.5f)) }
        compose.waitForIdle()
        assertTrue(exists("Choose a platform"))           // the step behind, halfway in
        assertFalse(exists("Choose a deck"))              // the step being left is drawn but no longer read out
        onActivity { it.onBackPressedDispatcher.dispatchOnBackCancelled() }
        compose.waitUntil(TIMEOUT_MS) { exists("Choose a deck") }
        compose.waitForIdle()
        assertFalse(exists("Choose a platform"))
        assertTrue(exists("Change platform, now AWS"))
    }

    @Test
    fun aBackWithoutProgressCommitsAtOnce() {
        launch()
        toDecks()
        onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
        assertTrue(exists("Choose a platform"))
        assertFalse(exists("Choose a deck"))
        assertFalse(exists("Change platform, now AWS"))
    }

    @Test
    fun releasingAfterProgressFinishesTheBack() {
        launch()
        toDecks()
        onActivity { it.onBackPressedDispatcher.dispatchOnBackStarted(backEvent(0f)) }
        onActivity { it.onBackPressedDispatcher.dispatchOnBackProgressed(backEvent(0.6f)) }
        onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitUntil(TIMEOUT_MS) { exists("Choose a platform") && !exists("Choose a deck") }
        compose.waitForIdle()
        assertFalse(exists("Change platform, now AWS"))
    }

    @Test
    fun backOnStep1IsTheSystemsBack() {
        launch()
        Espresso.pressBackUnconditionally()
        val deadline = SystemClock.uptimeMillis() + TIMEOUT_MS
        while (checkNotNull(scenario).state == Lifecycle.State.RESUMED && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(50)
        assertNotEquals(Lifecycle.State.RESUMED, checkNotNull(scenario).state)
    }

    @Test
    fun recentLeadsToTheDecksPlayedLastAndChangePlatformOpensItsOwnDeckStep() {
        launch(PLAYED)
        assertTrue(exists("Recent, 2 decks"))
        choose("Recent, 2 decks", "Choose a deck")
        assertTrue(exists("CDL, Cloud Digital Leader, 133 cards, 1 percent seen"))
        assertTrue(exists("Back to areas"))
        choose("CLF, Cloud Practitioner, 214 cards, 1 percent seen", "Choose a section")
        assertTrue(exists("Change area, now Cloud"))
        assertTrue(exists("Change platform, now AWS"))
        assertTrue(exists("Back to decks"))
        goBack("Change platform, now AWS", "Choose a deck")
        assertTrue(exists("Back to platforms"))
        assertTrue(exists("CLF, Cloud Practitioner, 214 cards, 1 percent seen"))
        goBack("Back to platforms", "Choose a platform")
    }

    @Test
    fun continueFillsThePassAndBackRetracesTheSteps() {
        launch(PLAYED)
        choose("Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.", "Your pass is ready", scroll = false)
        assertTrue(exists("Change section, now SEC"))
        assertTrue(exists("Change class, now Classic"))
        goBack("Back to classes", "Choose how to play")
        goBack("Back to sections", "Choose a section")
    }

    @Test
    fun theThemeSwitchFlipsTheThemeAndKeepsIt() {
        launch()
        val night = exists("Switch to light theme")
        val before = if (night) "Switch to light theme" else "Switch to dark theme"
        val after = if (night) "Switch to dark theme" else "Switch to light theme"
        compose.onNode(labelled(before)).performClick()
        compose.waitUntil(TIMEOUT_MS) { exists(after) }
        assertTrue(exists("Choose an area"))
        checkNotNull(scenario).recreate()
        compose.waitUntil(TIMEOUT_MS) { exists(after) }
    }

    private companion object {
        const val TIMEOUT_MS = 5_000L
        const val SETTLE_WAIT_MS = 300L
        const val PROGRESS_FILE = "truthy.progress.v1.json"
        val STORE_FILES = listOf(PROGRESS_FILE, "truthy.progress.v1.unreadable.json", "truthy.round.v1.json")

        /** Two decks played (CLF last), the record 7 on CLF SEC Classic, and that route as the last round. Real card ids: the start screen prunes unknown ones. */
        val PLAYED = """{"version":1,"cards":{"aws-clf-c02-t1.1-01":{"seen":1,"lastCorrect":true,"lastSeenAt":2000},""" +
            """"gcp-cdl-s1.1-01":{"seen":1,"lastCorrect":false,"lastSeenAt":1000}},"records":{"aws-clf-c02/SEC#classic":7},""" +
            """"last":{"route":{"deckId":"aws-clf-c02","sectionId":"SEC"},"mode":"classic","score":7,"total":10}}"""
    }
}
```

- [ ] **Step 19: Run the instrumented tests and see them fail.**

Start the API 36 emulator task 7 created (the AVD name is in task 7's file; `emulator -list-avds` lists it), then:

```bash
cd android/Truthy
adb devices
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.start.StartFlowTest
```

Expected: `adb devices` lists one `emulator-5554 device`; the run ends `BUILD FAILED` with `There were failing tests`, every one of the 10 tests failing in `launch` with `androidx.compose.ui.test.ComposeTimeoutException: Condition still not satisfied after 5000 ms` (task 11's placeholder draws no "Cloud, 17 decks" card yet). A compile error instead means a name of step 18 differs from the installed libraries; fix the test's imports, not its assertions.

- [ ] **Step 20: Write the shared modifiers and the travelling copies.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartModifiers.kt`:

```kotlin
package com.eienmosu.truthy.start

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.FocusRingSpec
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.keyboardFocusRing
import com.eienmosu.truthy.design.rememberPressTint
import com.eienmosu.truthy.engine.FADE_PX

/** A field of the pass that returns to its step (FillInPass.tsx:85-86, :204): radius 6, task 10's press tint, its full-sentence label. */
@Composable
fun Modifier.wayBack(label: String, onClick: () -> Unit): Modifier {
    val source = remember { MutableInteractionSource() }
    val tint = rememberPressTint(StartGeometry.wayBackRadius)
    return this
        // Reference 5.0: the focus ring sits 2 inside a pass field (hardware keyboard only, task 10).
        .keyboardFocusRing(RoundedCornerShape(StartGeometry.wayBackRadius), FocusRingSpec.INSET)
        .clip(RoundedCornerShape(StartGeometry.wayBackRadius))
        .clickable(interactionSource = source, indication = tint, role = Role.Button, onClick = onClick)
        .clearAndSetSemantics {
            contentDescription = label
            role = Role.Button
        }
}

/** Draws a part where its layer says: moved by `offsetY` dp (a placement, so measured positions follow it) and faded to `alpha`. */
fun Modifier.moved(layer: Layer): Modifier = this
    .offset { IntOffset(0, layer.offsetY.dp.roundToPx()) }
    .graphicsLayer { alpha = layer.alpha }

/** The 1.5 rule on the start side of a grid cell (FillInPass.tsx:182, :301). */
fun Modifier.ruleStart(color: Color): Modifier = this.drawBehind {
    val width = Tokens.Stroke.rule.toPx()
    drawLine(color, start = Offset(width / 2f, 0f), end = Offset(width / 2f, size.height), strokeWidth = width)
}

/** The rules above and below the ready pass's Class, Cards and Gate (FillInPass.tsx:297). */
fun Modifier.ruleTopBottom(color: Color): Modifier = this.drawBehind {
    val width = Tokens.Stroke.rule.toPx()
    drawLine(color, start = Offset(0f, width / 2f), end = Offset(size.width, width / 2f), strokeWidth = width)
    drawLine(color, start = Offset(0f, size.height - width / 2f), end = Offset(size.width, size.height - width / 2f), strokeWidth = width)
}

/** StartFlow.tsx:1081: while more lies below, the list fades out over 28 at its bottom, ending `liftDp` above the edge (listCue). */
fun Modifier.fadeBottom(liftDp: Float, ink: Color): Modifier = this
    .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
    .drawWithContent {
        drawContent()
        val end = size.height - liftDp.dp.toPx()
        val start = end - FADE_PX.toFloat().dp.toPx()
        drawRect(
            brush = Brush.verticalGradient(listOf(ink, ink.copy(alpha = 0f)), startY = start, endY = end),
            blendMode = BlendMode.DstIn,
        )
    }

/** A pass value: reports where it is laid out and how it looks, and hides while a copy of it travels (FillInPass.tsx:51-55). */
fun Modifier.travelSpot(travels: Travels, key: SpotKey, text: String, style: TextStyle, color: Color, right: Boolean): Modifier = this
    .onGloballyPositioned { travels.report(key, Spot(text, style, color, it.boundsInRoot(), right)) }
    .graphicsLayer { alpha = if (key.field in travels.hiddenFields) 0f else 1f }
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/Travels.kt`:

```kotlin
package com.eienmosu.truthy.start

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.util.lerp
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.engine.PassFieldName
import kotlin.math.roundToInt

/** A pass value or a card name as laid out: its text, its look and its box in root coordinates (px). */
@Immutable
data class Spot(val text: String, val style: TextStyle, val color: Color, val rect: Rect, val right: Boolean)

/** Where a value sits: a layout of the pass and a field. */
data class SpotKey(val stage: PassStage, val field: PassFieldName)

/** The chosen name flying from its card into its field (StartFlow.tsx:1134-1150). */
data class NameFlight(val from: Spot, val target: SpotKey)

/** A value moving from its place on the old layout to its place on the new one (passValueTravel.ts). */
data class ValueFlight(val from: Spot, val target: SpotKey)

/** What a step change sends travelling: the name (with the card it leaves) and the values that sit on both layouts. */
data class TravelStart(val name: NameFlight?, val nameId: String?, val values: List<ValueFlight>)

/** Where the pass values and card names are, and what is travelling now. `clockMs` counts from the start of the step change. */
@Stable
class Travels {
    val spots = mutableStateMapOf<SpotKey, Spot>()
    val names = mutableStateMapOf<String, Spot>()
    var clockMs by mutableFloatStateOf(0f)
    var name by mutableStateOf<NameFlight?>(null)
        private set
    var values by mutableStateOf<List<ValueFlight>>(emptyList())
        private set
    var hiddenFields by mutableStateOf<Set<PassFieldName>>(emptySet())
        private set
    var hiddenName by mutableStateOf<String?>(null)
        private set

    fun report(key: SpotKey, spot: Spot) {
        if (spots[key] != spot) spots[key] = spot
    }

    fun reportName(id: String, spot: Spot) {
        if (names[id] != spot) names[id] = spot
    }

    fun start(travel: TravelStart) {
        clockMs = 0f
        name = travel.name
        values = travel.values
        hiddenFields = buildSet {
            travel.name?.let { add(it.target.field) }
            travel.values.forEach { add(it.target.field) }
        }
        hiddenName = if (travel.name != null) travel.nameId else null
    }

    fun clear() {
        name = null
        values = emptyList()
        hiddenFields = emptySet()
        hiddenName = null
        clockMs = 0f
    }
}

/** passValueTravel.ts: the old copy is gone by 60 percent of the travel, the new one comes in from 40 percent. */
private const val OLD_GONE_AT = 0.6f
private const val NEW_FROM = 0.4f

/** The layer above the whole start screen where the copies travel. It takes no presses and is not read out. */
@Composable
fun TravelOverlay(travels: Travels, modifier: Modifier = Modifier) {
    var origin by remember { mutableStateOf(Offset.Zero) }
    Box(
        modifier
            .fillMaxSize()
            .onGloballyPositioned { origin = it.positionInRoot() }
            .clearAndSetSemantics { },
    ) {
        val t = travels.clockMs
        travels.name?.let { flight ->
            travels.spots[flight.target]?.let { to -> NameGhost(flight.from, to, t, origin) }
        }
        travels.values.forEach { flight ->
            travels.spots[flight.target]?.let { to -> ValueCopies(flight.from, to, t, origin) }
        }
    }
}

/** StartFlow.tsx:1134-1150: left edges and vertical centres meet; the copy scales by the change of font size; 300 ms ease after 60. */
@Composable
private fun NameGhost(from: Spot, to: Spot, t: Float, origin: Offset) {
    val e = Tokens.Curves.ease.at(progress(t, Tokens.Duration.travelHold, Tokens.Duration.travel))
    val scale = to.style.fontSize.value / from.style.fontSize.value
    val dx = to.rect.left - from.rect.left
    val dy = to.rect.top + to.rect.height / 2f - from.rect.top - from.rect.height * scale / 2f
    CopyText(from, origin, alpha = 1f, dx = dx * e, dy = dy * e, scale = lerp(1f, scale, e), pivotX = 0f, fixedWidth = false)
}

/** passValueTravel.ts:76-131: two copies on one eased path, cross-fading on a linear clock; right edges meet where a value keeps to the right. */
@Composable
private fun ValueCopies(from: Spot, to: Spot, t: Float, origin: Offset) {
    val duration = Tokens.Duration.t3
    val e = Tokens.Curves.ease.at(progress(t, 0, duration))
    val linear = progress(t, 0, duration)
    val right = from.right || to.right
    val scale = if (from.rect.height > 0f) to.rect.height / from.rect.height else 1f
    val dx = if (right) to.rect.right - from.rect.right else to.rect.left - from.rect.left
    val dy = to.rect.top - from.rect.top
    val pivot = if (right) 1f else 0f
    CopyText(from, origin, alpha = (1f - linear / OLD_GONE_AT).coerceIn(0f, 1f), dx = dx * e, dy = dy * e, scale = lerp(1f, scale, e), pivotX = pivot, fixedWidth = true)
    CopyText(
        to, origin,
        alpha = ((linear - NEW_FROM) / (1f - NEW_FROM)).coerceIn(0f, 1f),
        dx = -dx * (1f - e), dy = -dy * (1f - e), scale = lerp(1f / scale, 1f, e), pivotX = pivot, fixedWidth = true,
    )
}

@Composable
private fun CopyText(spot: Spot, origin: Offset, alpha: Float, dx: Float, dy: Float, scale: Float, pivotX: Float, fixedWidth: Boolean) {
    val density = LocalDensity.current
    val width = with(density) { spot.rect.width.toDp() }
    Text(
        text = spot.text,
        style = spot.style,
        color = spot.color,
        maxLines = 1,
        softWrap = false,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier
            .offset { IntOffset((spot.rect.left - origin.x).roundToInt(), (spot.rect.top - origin.y).roundToInt()) }
            .then(if (fixedWidth) Modifier.width(width) else Modifier)
            .graphicsLayer {
                transformOrigin = TransformOrigin(pivotX, 0f)
                translationX = dx
                translationY = dy
                scaleX = scale
                scaleY = scale
                this.alpha = alpha
            },
    )
}
```

Build to catch compile errors early:

```bash
cd android/Truthy
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`. If `rememberPressTint` lives in another package than `com.eienmosu.truthy.design` (step 1 printed its file), change the import.

- [ ] **Step 21: Write the fill-in pass.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/FillInPass.kt` (FillInPass.tsx in Compose: the three layouts, the dashes, the ways back, the band and body changing shape, the unrolling paper):

```kotlin
package com.eienmosu.truthy.start

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.lerp
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LogoMark
import com.eienmosu.truthy.design.LogoVariant
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.ui.TestTags
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.engine.PassFieldName
import kotlin.math.roundToInt
import androidx.compose.ui.util.lerp as lerpFloat

/** FillInPass.tsx:342, :360 and BoardingPass.tsx:82: the fractions of each layout's three columns. */
private val DESTINATION_COLUMNS = listOf(0.9f, 1.45f, 0.8f)
private val ROUTE_COLUMNS = listOf(0.75f, 1.1f, 1.15f)
private val READY_COLUMNS = listOf(1.1f, 1f, 1f)

/**
 * The fill-in pass. `block` is the layout of the step drawn as current; `leavingBlock` the layout it replaces, fading
 * out over it while the paper changes shape (`layers.passMorph`); `changing` the fields whose dashes leave
 * (`direction` 1) or come back (`direction` -1); `unroll` the empty paper's scale while Start round unrolls it.
 */
@Composable
fun FillInPass(
    block: PassBlock,
    leavingBlock: PassBlock?,
    layers: StepLayers,
    changing: Set<PassFieldName>,
    direction: Int,
    interactive: Boolean,
    travels: Travels,
    onJump: (PassFieldName) -> Unit,
    unroll: Float?,
    modifier: Modifier = Modifier,
) {
    val colors = TruthyTheme.colors
    val shadows = TruthyTheme.shadows
    val shape = RoundedCornerShape(Tokens.Radius.card)
    val ready = block is ReadyBlock
    val morph = if (leavingBlock != null) layers.passMorph else 1f
    val band = if (leavingBlock != null) lerp(bandHeight(leavingBlock), bandHeight(block), morph) else bandHeight(block)
    // FillInPass.tsx:484: the ready pass carries the ticket shadow, except while the paper below unrolls and carries it.
    val shadow = when {
        !ready -> shadows.small
        unroll != null -> null
        else -> shadows.ticket
    }
    UnrollLayout(unroll = unroll, modifier = modifier.testTag(TestTags.PASS)) {
        Column(
            Modifier
                .fillMaxWidth()
                .then(if (shadow != null) Modifier.truthyShadow(shadow, Tokens.Radius.card) else Modifier)
                .clip(shape)
                .background(colors.surfaceRaised),
        ) {
            Box(Modifier.fillMaxWidth().clipToBounds().clearAndSetSemantics { }) {
                if (ready) TicketBand(band) else CompactBand(band)
            }
            PassBody(block, leavingBlock, layers, morph, changing, direction, interactive, travels, onJump)
        }
    }
}

private fun bandHeight(block: PassBlock): Dp = if (block is ReadyBlock) Tokens.Size.carrier else Tokens.Size.carrierCompact

/** The pass, with the empty paper that unrolls below it (FillInPass.tsx:318-322, :523-534): it starts 16 above the pass's bottom edge and is drawn behind it. */
@Composable
private fun UnrollLayout(unroll: Float?, modifier: Modifier, pass: @Composable () -> Unit) {
    val colors = TruthyTheme.colors
    val shadows = TruthyTheme.shadows
    val radius = Tokens.Radius.card
    val bottom = RoundedCornerShape(bottomStart = radius, bottomEnd = radius)
    val paperHeight = Tokens.Size.statementMin + Tokens.Size.lower - Tokens.Space.s18 + radius
    Layout(
        modifier = modifier,
        content = {
            if (unroll != null) {
                Box(
                    Modifier
                        .graphicsLayer {
                            scaleY = unroll
                            transformOrigin = TransformOrigin(0.5f, 0f)
                        }
                        .truthyShadow(shadows.ticket, radius)
                        .clip(bottom)
                        .background(colors.surfaceRaised)
                        .clearAndSetSemantics { },
                )
            }
            Box { pass() }
        },
    ) { measurables, constraints ->
        val passPlaceable = measurables.last().measure(constraints.copy(minHeight = 0))
        val paper = if (measurables.size > 1) {
            measurables.first().measure(Constraints.fixed(passPlaceable.width, paperHeight.roundToPx()))
        } else {
            null
        }
        layout(passPlaceable.width, passPlaceable.height) {
            paper?.place(0, passPlaceable.height - radius.roundToPx())
            passPlaceable.place(0, 0)
        }
    }
}

/** FillInPass.tsx:97-114: the compact band, 30 tall (`height` grows it with the paper; text at large sizes grows it further). */
@Composable
private fun CompactBand(height: Dp) {
    val colors = TruthyTheme.colors
    Row(
        Modifier.fillMaxWidth().heightIn(min = height).background(colors.accent).padding(horizontal = Tokens.Space.s14),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
    ) {
        Box(
            Modifier.size(width = StartGeometry.compactMarkBoxWidth, height = StartGeometry.compactMarkBoxHeight),
            contentAlignment = Alignment.Center,
        ) {
            LogoMark(width = StartGeometry.compactMarkWidth, variant = LogoVariant.COMPACT)
        }
        Text(StartCopy.BAND_TITLE, style = TruthyType.carrierTitleCompact, color = colors.onAccent, maxLines = 1)
        Spacer(Modifier.weight(1f))
        Text(StartCopy.YOUR_PASS, style = TruthyType.carrierLabelCompact, color = colors.onAccent, maxLines = 1)
    }
}

/** FillInPass.tsx:116-128: the ready band, 44 tall, with the cloud and "BOARDING PASS". */
@Composable
private fun TicketBand(height: Dp) {
    val colors = TruthyTheme.colors
    Row(
        Modifier.fillMaxWidth().heightIn(min = height).background(colors.accent).padding(horizontal = Tokens.Space.s16),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s10),
    ) {
        TruthyIcon(IconId.CLOUD, tint = colors.onAccent)
        Text(StartCopy.BAND_TITLE, style = TruthyType.carrierTitle, color = colors.onAccent, maxLines = 1)
        Spacer(Modifier.weight(1f))
        Text(StartCopy.BOARDING_PASS, style = TruthyType.carrierLabel, color = colors.onAccent, maxLines = 1)
    }
}

/** The body under the band: the current block, and the old one fading out over it while the body's height goes from the old block's to the new one's. */
@Composable
private fun PassBody(
    block: PassBlock,
    leavingBlock: PassBlock?,
    layers: StepLayers,
    morph: Float,
    changing: Set<PassFieldName>,
    direction: Int,
    interactive: Boolean,
    travels: Travels,
    onJump: (PassFieldName) -> Unit,
) {
    Layout(
        modifier = Modifier
            .fillMaxWidth()
            .semantics { liveRegion = LiveRegionMode.Polite }
            .then(if (morph < 1f) Modifier.clipToBounds() else Modifier),
        content = {
            Box(Modifier.graphicsLayer { alpha = if (leavingBlock != null) layers.newBlockAlpha else 1f }) {
                BlockContent(block, layers, changing, direction, interactive, travels, onJump)
            }
            if (leavingBlock != null) {
                Box(Modifier.graphicsLayer { alpha = layers.oldBlockAlpha }.clearAndSetSemantics { }) {
                    BlockContent(leavingBlock, layers, emptySet(), direction, interactive = false, travels = travels, onJump = {})
                }
            }
        },
    ) { measurables, constraints ->
        val loose = constraints.copy(minHeight = 0)
        val current = measurables[0].measure(loose)
        val old = measurables.getOrNull(1)?.measure(loose)
        val height = if (old == null) current.height else lerpFloat(old.height.toFloat(), current.height.toFloat(), morph).roundToInt()
        layout(current.width, height) {
            current.place(0, 0)
            old?.place(0, 0)
        }
    }
}

@Composable
private fun BlockContent(
    block: PassBlock,
    layers: StepLayers,
    changing: Set<PassFieldName>,
    direction: Int,
    interactive: Boolean,
    travels: Travels,
    onJump: (PassFieldName) -> Unit,
) {
    when (block) {
        is DestinationBlock -> FrRow(DESTINATION_COLUMNS, minContent = false, modifier = Modifier.fillMaxWidth().padding(horizontal = Tokens.Space.s16)) {
            block.fields.forEachIndexed { i, field ->
                FieldCell(field, PassStage.DESTINATION, first = i == 0, dash = dashFor(field, layers, changing, direction), interactive, travels, onJump)
            }
        }
        is RouteBlock -> Column(Modifier.fillMaxWidth()) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = Tokens.Size.passLine)
                    .padding(start = Tokens.Space.s10, end = Tokens.Space.s10, top = Tokens.Space.s8),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s2),
            ) {
                block.area?.let { LineWord(it, interactive, travels, onJump) }
                Text(StartCopy.MIDDLE_DOT, style = TruthyType.passLine, color = TruthyTheme.colors.rule, modifier = Modifier.clearAndSetSemantics { })
                block.platform?.let { LineWord(it, interactive, travels, onJump) }
            }
            FrRow(ROUTE_COLUMNS, minContent = true, modifier = Modifier.fillMaxWidth().padding(horizontal = Tokens.Space.s16)) {
                block.fields.forEachIndexed { i, field ->
                    FieldCell(field, PassStage.ROUTE, first = i == 0, dash = dashFor(field, layers, changing, direction), interactive, travels, onJump)
                }
            }
        }
        is ReadyBlock -> ReadyContent(block, interactive, travels, onJump)
    }
}

/** How a field's dashes are drawn now: a blank field's own dashes, and the dashes leaving under a value that just arrived. */
private data class DashLook(val blankAlpha: Float, val leavingAlpha: Float)

private fun dashFor(field: PassField, layers: StepLayers, changing: Set<PassFieldName>, direction: Int): DashLook {
    val moving = field.field in changing
    return DashLook(
        blankAlpha = if (moving && direction < 0) layers.dashInAlpha else 1f,
        leavingAlpha = if (moving && direction > 0) layers.dashOutAlpha else 0f,
    )
}

/** FillInPass.tsx:173-209: label, then the value or three dashes; a filled field that is not being chosen is a way back over the whole cell. */
@Composable
private fun FieldCell(
    field: PassField,
    stage: PassStage,
    first: Boolean,
    dash: DashLook,
    interactive: Boolean,
    travels: Travels,
    onJump: (PassFieldName) -> Unit,
) {
    val colors = TruthyTheme.colors
    val wayBack = field.wayBack?.takeIf { interactive }
    val labelStyle = if (field.now) TruthyType.fieldLabel.copy(fontWeight = FontWeight.SemiBold) else TruthyType.fieldLabel
    val valueStyle = if (field.code) TruthyType.passCode else TruthyType.fieldValuePass
    Box(
        Modifier
            .fillMaxWidth()
            .then(if (first) Modifier else Modifier.ruleStart(colors.rule).padding(start = Tokens.Stroke.rule))
            .then(if (wayBack != null) Modifier.wayBack(wayBack) { onJump(field.field) } else Modifier)
            .padding(start = if (first) 0.dp else Tokens.Space.s12, top = StartGeometry.fieldTop, bottom = StartGeometry.fieldBottom),
    ) {
        Column {
            Text(field.label, style = labelStyle, color = if (field.now) colors.ink else colors.inkMuted, maxLines = 1)
            Box(
                Modifier.padding(top = StartGeometry.fieldValueTop).heightIn(min = Tokens.Space.s20),
                contentAlignment = Alignment.CenterStart,
            ) {
                val value = field.value
                if (value == null) {
                    Dashes(now = field.now, alpha = dash.blankAlpha, spoken = true)
                } else {
                    if (dash.leavingAlpha > 0f) Dashes(now = field.now, alpha = dash.leavingAlpha, spoken = false)
                    Text(
                        value,
                        style = valueStyle,
                        color = colors.ink,
                        maxLines = 1,
                        softWrap = false,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.travelSpot(travels, SpotKey(stage, field.field), value, valueStyle, colors.ink, right = false),
                    )
                }
            }
        }
    }
}

/** FillInPass.tsx:135-156: three 14 by 3 dashes, ink on the field being chosen, rule elsewhere; "not chosen" for assistive technology. */
@Composable
private fun Dashes(now: Boolean, alpha: Float, spoken: Boolean) {
    val color = if (now) TruthyTheme.colors.ink else TruthyTheme.colors.rule
    Row(
        Modifier
            .heightIn(min = Tokens.Space.s20)
            .graphicsLayer { this.alpha = alpha }
            .then(if (spoken) Modifier.semantics { contentDescription = StartCopy.NOT_CHOSEN } else Modifier.clearAndSetSemantics { }),
        horizontalArrangement = Arrangement.spacedBy(StartGeometry.dashGap),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(3) {
            Box(
                Modifier
                    .size(width = StartGeometry.dashWidth, height = StartGeometry.dashHeight)
                    .clip(RoundedCornerShape(Tokens.Radius.tick))
                    .background(color),
            )
        }
    }
}

/** FillInPass.tsx:218-236: a word of the route pass's quiet line, a way back to the area or the platform. */
@Composable
private fun LineWord(word: PassField, interactive: Boolean, travels: Travels, onJump: (PassFieldName) -> Unit) {
    val value = word.value ?: return
    val muted = TruthyTheme.colors.inkMuted
    val wayBack = word.wayBack?.takeIf { interactive }
    Box(
        Modifier
            .heightIn(min = StartGeometry.lineWordHeight)
            .then(if (wayBack != null) Modifier.wayBack(wayBack) { onJump(word.field) } else Modifier)
            .padding(horizontal = Tokens.Space.s6),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            value,
            style = TruthyType.passLine,
            color = muted,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier.travelSpot(travels, SpotKey(PassStage.ROUTE, word.field), value, TruthyType.passLine, muted, right = false),
        )
    }
}

/** FillInPass.tsx:269-316: the legs (code over name), then Class, Cards and Gate between two rules. */
@Composable
private fun ReadyContent(block: ReadyBlock, interactive: Boolean, travels: Travels, onJump: (PassFieldName) -> Unit) {
    val colors = TruthyTheme.colors
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(start = Tokens.Size.ticketInset, end = Tokens.Size.ticketInset, top = Tokens.Space.s14, bottom = Tokens.Space.s12),
            horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8),
        ) {
            Leg(block.deck, alignEnd = false, interactive, travels, onJump, Modifier.weight(1f))
            Spacer(Modifier.width(StartGeometry.legGap))
            Leg(block.section, alignEnd = true, interactive, travels, onJump, Modifier.weight(1f))
        }
        FrRow(
            READY_COLUMNS,
            minContent = true,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Tokens.Size.ticketInset)
                .ruleTopBottom(colors.rule)
                .padding(vertical = Tokens.Stroke.rule),
        ) {
            ReadyCell(StartCopy.LABEL_CLASS, first = true, wayBack = block.modeWayBack?.takeIf { interactive }, onClick = { onJump(PassFieldName.MODE) }) {
                Text(
                    block.mode,
                    style = TruthyType.fieldValue,
                    color = colors.ink,
                    maxLines = 1,
                    softWrap = false,
                    modifier = Modifier.travelSpot(travels, SpotKey(PassStage.READY, PassFieldName.MODE), block.mode, TruthyType.fieldValue, colors.ink, right = false),
                )
            }
            ReadyCell(StartCopy.LABEL_CARDS, first = false, wayBack = null, onClick = {}) {
                Text(block.cards, style = TruthyType.fieldValue, color = colors.ink, maxLines = 1, softWrap = false)
            }
            ReadyCell(StartCopy.LABEL_GATE, first = false, wayBack = null, onClick = {}) {
                Text(
                    StartCopy.GATE_SHOWN,
                    style = TruthyType.fieldValue,
                    color = colors.ink,
                    maxLines = 1,
                    softWrap = false,
                    modifier = Modifier.clearAndSetSemantics { contentDescription = StartCopy.GATE_SPOKEN },
                )
            }
        }
        Spacer(Modifier.height(Tokens.Space.s18))
    }
}

@Composable
private fun Leg(leg: PassLeg, alignEnd: Boolean, interactive: Boolean, travels: Travels, onJump: (PassFieldName) -> Unit, modifier: Modifier) {
    val colors = TruthyTheme.colors
    val wayBack = leg.wayBack?.takeIf { interactive }
    Column(
        modifier
            .clip(RoundedCornerShape(Tokens.Radius.small))
            .then(if (wayBack != null) Modifier.wayBack(wayBack) { onJump(leg.field) } else Modifier),
        horizontalAlignment = if (alignEnd) Alignment.End else Alignment.Start,
    ) {
        Text(
            leg.code,
            style = TruthyType.legCode,
            color = colors.ink,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier.travelSpot(travels, SpotKey(PassStage.READY, leg.field), leg.code, TruthyType.legCode, colors.ink, right = alignEnd),
        )
        Text(
            leg.name,
            style = TruthyType.legName,
            color = colors.inkMuted,
            textAlign = if (alignEnd) TextAlign.End else TextAlign.Start,
            modifier = Modifier.padding(top = Tokens.Space.s6),
        )
    }
}

@Composable
private fun ReadyCell(label: String, first: Boolean, wayBack: String?, onClick: () -> Unit, value: @Composable () -> Unit) {
    val colors = TruthyTheme.colors
    Box(
        Modifier
            .fillMaxWidth()
            .then(if (first) Modifier else Modifier.ruleStart(colors.rule).padding(start = Tokens.Stroke.rule))
            .then(if (wayBack != null) Modifier.wayBack(wayBack, onClick) else Modifier)
            .padding(start = if (first) 0.dp else Tokens.Space.s12, top = Tokens.Space.s8, bottom = StartGeometry.readyCellBottom),
    ) {
        Column {
            Text(label, style = TruthyType.fieldLabel, color = colors.inkMuted, maxLines = 1)
            Box(Modifier.padding(top = Tokens.Space.s2)) { value() }
        }
    }
}

/** A row of cells sized like a CSS grid of `minmax(min, fr)` tracks (frWidths), every cell as tall as the tallest. */
@Composable
private fun FrRow(fractions: List<Float>, minContent: Boolean, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Layout(content = content, modifier = modifier) { measurables, constraints ->
        val total = constraints.maxWidth
        val mins = measurables.map { if (minContent) it.maxIntrinsicWidth(Constraints.Infinity) else 0 }
        val widths = frWidths(total, fractions, mins)
        val height = measurables.mapIndexed { i, m -> m.maxIntrinsicHeight(widths[i]) }.maxOrNull() ?: 0
        val placeables = measurables.mapIndexed { i, m -> m.measure(Constraints.fixed(widths[i], height)) }
        layout(total, height) {
            var x = 0
            placeables.forEach {
                it.place(x, 0)
                x += it.width
            }
        }
    }
}
```

```bash
cd android/Truthy
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`. If `TruthyIcon`, `LogoMark` or `truthyShadow` has another signature than step 1 printed, change these call sites to it.

- [ ] **Step 22: Write the continue line and the theme switch.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/ContinueLine.kt`:

```kotlin
package com.eienmosu.truthy.start

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Constraints
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.LogoMark
import com.eienmosu.truthy.design.PressFeedback
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.keyboardFocusRing
import com.eienmosu.truthy.design.pressFeedback
import com.eienmosu.truthy.design.rememberPressProgress
import com.eienmosu.truthy.design.rememberPressTint

/** ContinueLine.tsx: the logo disc, the deck's pass name on one line, the mono route line, a chevron; one button labelled in full. */
@Composable
fun ContinueLine(model: ContinueModel, onContinue: () -> Unit, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val source = remember { MutableInteractionSource() }
    val press = rememberPressProgress(source)
    val tint = rememberPressTint(Tokens.Radius.card)
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = Tokens.Size.pill)
            .pressFeedback(press, PressFeedback.CONTINUE_SCALE)
            .keyboardFocusRing(RoundedCornerShape(Tokens.Radius.card))
            .clip(RoundedCornerShape(Tokens.Radius.card))
            .clickable(interactionSource = source, indication = tint, role = Role.Button, onClick = onContinue)
            .clearAndSetSemantics {
                contentDescription = model.label
                role = Role.Button
            }
            .padding(start = Tokens.Space.s4, end = Tokens.Space.s12),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s14),
    ) {
        Box(
            Modifier.size(Tokens.Size.continueIcon).clip(CircleShape).background(colors.surfaceRaised),
            contentAlignment = Alignment.Center,
        ) {
            LogoMark(width = StartGeometry.continueMarkWidth)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(StartGeometry.continueLineGap)) {
            // The web truncates a long name (ContinueLine.tsx:63-71); here it wraps instead, as a card name does (task 10
            // rule 7): at font scale 2.0 "Google Cloud Digital Leader" no longer fits one line, and text never clips (spec 5.6).
            Text(model.deckName, style = TruthyType.continueDeckName, color = colors.ink)
            PartsLine(continueParts(model, colors.ink), TruthyType.monoData, colors.inkMuted, maxLines = 2)
        }
        TruthyIcon(IconId.CHEVRON_RIGHT, tint = colors.ink)
    }
}

/** ContinueLine.tsx:84-110: "CLF → SEC", "Classic", "last 7 of 10" (the score in ink and semibold). */
private fun continueParts(model: ContinueModel, ink: Color): List<AnnotatedString> = buildList {
    add(AnnotatedString("${model.deckCode} ${StartCopy.ARROW} ${model.sectionCode}"))
    add(AnnotatedString(model.modeLabel))
    model.lastScore?.let { score ->
        add(
            buildAnnotatedString {
                append(StartCopy.LAST)
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = ink)) { append(score) }
            },
        )
    }
}

/**
 * ContinueLine.tsx:75-111: parts that are never split; a part that does not fit after the others starts the next line
 * without its " · ", and at most `maxLines` lines show. Each part after the first is composed twice, with and without
 * its separator, and only the one that fits is measured and placed.
 */
@Composable
private fun PartsLine(parts: List<AnnotatedString>, style: TextStyle, color: Color, maxLines: Int, modifier: Modifier = Modifier) {
    Layout(
        modifier = modifier,
        content = {
            parts.forEachIndexed { i, part ->
                Text(part, style = style, color = color, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
                if (i > 0) {
                    Text(AnnotatedString(StartCopy.SEPARATOR) + part, style = style, color = color, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
                }
            }
        },
    ) { measurables, constraints ->
        val width = constraints.maxWidth
        val placed = mutableListOf<Triple<Placeable, Int, Int>>()
        var x = 0
        var y = 0
        var line = 0
        var lineHeight = 0
        var index = 0
        for (i in parts.indices) {
            val bare = measurables[index]
            index += 1
            val joined = if (i > 0) measurables[index].also { index += 1 } else null
            if (line >= maxLines) continue
            if (joined != null && x > 0 && x + joined.maxIntrinsicWidth(Constraints.Infinity) <= width) {
                val p = joined.measure(Constraints(maxWidth = width - x))
                placed += Triple(p, x, y)
                x += p.width
                lineHeight = maxOf(lineHeight, p.height)
            } else {
                if (x > 0) {
                    line += 1
                    y += lineHeight
                    x = 0
                    lineHeight = 0
                    if (line >= maxLines) continue
                }
                val p = bare.measure(Constraints(maxWidth = width))
                placed += Triple(p, 0, y)
                x = p.width
                lineHeight = maxOf(lineHeight, p.height)
            }
        }
        layout(width, y + lineHeight) {
            placed.forEach { (p, px, py) -> p.place(px, py) }
        }
    }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/ThemeSwitch.kt`:

```kotlin
package com.eienmosu.truthy.start

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.eienmosu.truthy.design.IconId
import com.eienmosu.truthy.design.TruthyIcon
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.ui.RoundButton

/** ThemeSwitch.tsx: a moon offers the night theme while the day theme shows, a sun the day theme at night. */
@Composable
fun ThemeSwitch(theme: Theme, onSwitch: () -> Unit, modifier: Modifier = Modifier) {
    val day = theme == Theme.LIGHT
    RoundButton(label = if (day) StartCopy.SWITCH_TO_DARK else StartCopy.SWITCH_TO_LIGHT, onClick = onSwitch, modifier = modifier) {
        TruthyIcon(if (day) IconId.MOON else IconId.SUN)
    }
}
```

```bash
cd android/Truthy
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 23: Give the destination card's name a modifier, and write the step panel.**

The name travel needs the box of the chosen card's name, which task 10's card draws inside itself. In `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/DestinationCard.kt`, add one parameter at the end of `DestinationCard`'s list and use it for the name. Replace

```kotlin
    nameHidden: Boolean = false,
) {
```

with

```kotlin
    nameHidden: Boolean = false,
    nameLayout: Modifier = Modifier,
) {
```

and replace

```kotlin
    val nameModifier = if (nameHidden) Modifier.alpha(0f) else Modifier
```

with

```kotlin
    // nameLayout: the start flow measures the name's box for the name that travels into the pass (task 12).
    val nameModifier = nameLayout.then(if (nameHidden) Modifier.alpha(0f) else Modifier)
```

Every existing call keeps working (the default is no modifier), and task 10's tests stay green.

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StepPanel.kt`:

```kotlin
package com.eienmosu.truthy.start

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.collectionItemInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.design.truthyShadow
import com.eienmosu.truthy.engine.ItemSpan
import com.eienmosu.truthy.engine.ListCue
import com.eienmosu.truthy.engine.MODE_TABLE
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.listCue
import com.eienmosu.truthy.engine.revealDelta
import com.eienmosu.truthy.ui.CardStub
import com.eienmosu.truthy.ui.DestinationCard
import com.eienmosu.truthy.ui.DestinationVariant
import kotlin.math.roundToInt

/** What a step's panel holds under its title. */
sealed interface PanelContent {
    data object Loading : PanelContent
    data object Failed : PanelContent
    data class Options(val options: List<OptionModel>) : PanelContent
    data class Ready(val line: String) : PanelContent
}

/** What takes focus when a panel arrives (reference 4.4): its title going forward, the card chosen before going back. */
sealed interface PanelFocus {
    data object Title : PanelFocus
    data class Card(val id: String) : PanelFocus
}

fun panelContent(data: StartData?, failed: Boolean, snapshot: PanelSnapshot): PanelContent = when {
    snapshot.step == Step.SIX -> PanelContent.Ready(readyLine(MODE_TABLE.firstOrNull { it.id == snapshot.choice.mode }?.description ?: ""))
    data != null -> PanelContent.Options(stepOptions(data, snapshot))
    failed -> PanelContent.Failed
    else -> PanelContent.Loading
}

/**
 * One step (StartFlow.tsx:1048-1091): its title in a 36 row over its options. A leaving panel is drawn with the old
 * panel's layer, is not read out and takes no presses; an arriving one moves its title and options in with `layers.items`.
 */
@Composable
fun StepPanel(
    snapshot: PanelSnapshot,
    content: PanelContent,
    leaving: Boolean,
    layers: StepLayers,
    short: Boolean,
    tight: Boolean,
    travels: Travels,
    focus: PanelFocus?,
    onOption: (OptionModel) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = TruthyTheme.colors
    val panel = if (leaving) layers.oldPanel else Layer(layers.newPanelAlpha, 0f)
    val title = if (leaving) Layer(layers.oldTitleAlpha, 0f) else layers.item(0)
    val titleFocus = remember { FocusRequester() }
    // StartFlow.tsx:1059: the ready step sits 112 lower, 88 under 600 tall, and at the top of a short screen's column.
    val readyTop = when {
        content !is PanelContent.Ready || short -> 0.dp
        tight -> Tokens.Size.readyOffset - Tokens.Space.s24
        else -> Tokens.Size.readyOffset
    }
    Box(modifier) {
        Column(
            Modifier
                .fillMaxWidth()
                .then(if (short) Modifier else Modifier.fillMaxHeight())
                .moved(panel)
                .then(if (leaving) Modifier.clearAndSetSemantics { } else Modifier)
                .padding(top = readyTop),
        ) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = Tokens.Native.stepTitleRow)
                    .moved(title)
                    .focusRequester(titleFocus)
                    .focusable()
                    .semantics { heading() },
                contentAlignment = Alignment.CenterStart,
            ) {
                Text(stepTitle(snapshot.step), style = TruthyType.stepTitle, color = colors.ink)
            }
            when (content) {
                PanelContent.Loading -> LoadingAreas()
                PanelContent.Failed -> LoadFailed()
                is PanelContent.Options -> OptionList(content.options, layers, leaving, short, travels, focus, onOption)
                is PanelContent.Ready -> Text(
                    content.line,
                    style = TruthyType.tagline,
                    color = colors.ink,
                    modifier = Modifier.widthIn(max = StartGeometry.readyLineMax),
                )
            }
        }
        if (leaving) {
            // StartFlow.tsx:1058: a leaving panel is inert; this cover takes the presses so the cards under it never see them.
            Spacer(
                Modifier.matchParentSize().pointerInput(Unit) {
                    awaitPointerEventScope {
                        while (true) awaitPointerEvent()
                    }
                },
            )
        }
    }
    LaunchedEffect(focus, leaving) {
        if (!leaving && focus == PanelFocus.Title) runCatching { titleFocus.requestFocus() }
    }
}

/** StartFlow.tsx:1106-1118: three quiet placeholders while the index loads, and the status "Loading the decks". */
@Composable
private fun LoadingAreas() {
    Column(
        Modifier.fillMaxWidth().padding(top = Tokens.Space.s8 + Tokens.Space.s6),
        verticalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
    ) {
        Box(
            Modifier.semantics {
                liveRegion = LiveRegionMode.Polite
                contentDescription = StartCopy.LOADING_DECKS
            },
        )
        repeat(3) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = Tokens.Size.cardMin)
                    .clip(RoundedCornerShape(Tokens.Radius.card))
                    .background(TruthyTheme.colors.surfaceSunk)
                    .clearAndSetSemantics { },
            )
        }
    }
}

/** StartFlow.tsx:1120-1132: the alert card when the index did not load (unreachable with embedded decks; Try again sits in the foot zone). */
@Composable
private fun LoadFailed() {
    val colors = TruthyTheme.colors
    Column(
        Modifier
            .fillMaxWidth()
            .padding(top = Tokens.Space.s8 + Tokens.Space.s6)
            .truthyShadow(TruthyTheme.shadows.small, Tokens.Radius.card)
            .clip(RoundedCornerShape(Tokens.Radius.card))
            .background(colors.surfaceRaised)
            .semantics { liveRegion = LiveRegionMode.Assertive }
            .padding(Tokens.Space.s20),
    ) {
        Text(StartCopy.DECKS_FAILED, style = TruthyType.emphasis, color = colors.ink)
        Text(StartCopy.CHECK_CONNECTION, style = TruthyType.body, color = colors.ink, modifier = Modifier.padding(top = Tokens.Space.s8))
    }
}

/**
 * StartFlow.tsx:1069-1087: the scrolling list, padded 6 above and 24 below, cards 12 apart, fading its bottom 28 while
 * more lies below (listCue). On a short screen the whole column scrolls instead and the list takes its own height.
 */
@Composable
private fun ColumnScope.OptionList(
    options: List<OptionModel>,
    layers: StepLayers,
    leaving: Boolean,
    short: Boolean,
    travels: Travels,
    focus: PanelFocus?,
    onOption: (OptionModel) -> Unit,
) {
    val density = LocalDensity.current
    val scroll = rememberScrollState()
    var viewHeight by remember { mutableIntStateOf(0) }
    var contentHeight by remember { mutableIntStateOf(0) }
    val tops = remember(options) { mutableStateListOf<Int>().apply { repeat(options.size) { add(0) } } }
    val heights = remember(options) { mutableStateListOf<Int>().apply { repeat(options.size) { add(0) } } }
    val cardFocus = remember { FocusRequester() }
    val padTop = with(density) { Tokens.Space.s6.roundToPx() }
    fun dp(px: Int): Double = with(density) { px.toDp().value.toDouble() }
    fun span(i: Int): ItemSpan {
        val top = dp(padTop + tops[i] - scroll.value)
        return ItemSpan(top, top + dp(heights[i]))
    }
    val cue = if (short) {
        ListCue(more = false, lift = 0.0)
    } else {
        listCue(dp(viewHeight), dp(padTop + contentHeight - scroll.value), options.indices.map { span(it) })
    }
    val ink = TruthyTheme.colors.ink
    val focusId = (focus as? PanelFocus.Card)?.id
    Box(
        Modifier
            .fillMaxWidth()
            .then(if (short) Modifier else Modifier.weight(1f))
            .padding(top = Tokens.Space.s8)
            .onSizeChanged { viewHeight = it.height }
            .then(if (cue.more) Modifier.fadeBottom(cue.lift.toFloat(), ink) else Modifier),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .then(if (short) Modifier else Modifier.verticalScroll(scroll))
                .padding(top = Tokens.Space.s6, bottom = Tokens.Space.s24)
                .semantics { collectionInfo = CollectionInfo(rowCount = options.size, columnCount = 1) },
        ) {
            Column(
                Modifier.fillMaxWidth().onSizeChanged { contentHeight = it.height },
                verticalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
            ) {
                options.forEachIndexed { i, option ->
                    OptionItem(
                        option = option,
                        index = i,
                        layer = if (leaving) Layer.Shown else layers.item(i + 1),
                        interactive = !leaving,
                        travels = travels,
                        onOption = onOption,
                        modifier = Modifier
                            .onPlaced {
                                tops[i] = it.positionInParent().y.roundToInt()
                                heights[i] = it.size.height
                            }
                            .then(if (option.id == focusId) Modifier.focusRequester(cardFocus) else Modifier),
                    )
                }
            }
        }
    }
    // StartFlow.tsx:522-548: going back, the card chosen before is scrolled into view whole, with 8 of room, then takes focus.
    LaunchedEffect(focusId, leaving) {
        val id = focusId ?: return@LaunchedEffect
        if (leaving) return@LaunchedEffect
        val index = options.indexOfFirst { it.id == id }
        if (index < 0) return@LaunchedEffect
        withFrameNanos { }
        if (!short) {
            val delta = revealDelta(dp(viewHeight), span(index), StartGeometry.FOCUS_ROOM)
            if (delta != 0.0) scroll.scrollTo(scroll.value + with(density) { delta.toFloat().dp.roundToPx() })
        }
        runCatching { cardFocus.requestFocus() }
    }
}

@Composable
private fun OptionItem(
    option: OptionModel,
    index: Int,
    layer: Layer,
    interactive: Boolean,
    travels: Travels,
    onOption: (OptionModel) -> Unit,
    modifier: Modifier,
) {
    val ink = TruthyTheme.colors.ink
    val nameStyle = if (option.code) TruthyType.deckCode else TruthyType.cardName
    Box(
        modifier
            .moved(layer)
            .semantics { collectionItemInfo = CollectionItemInfo(rowIndex = index, rowSpan = 1, columnIndex = 0, columnSpan = 1) },
    ) {
        DestinationCard(
            variant = when (option.kind) {
                OptionKind.PLACE -> DestinationVariant.PLACE
                OptionKind.DECK -> DestinationVariant.DECK
                OptionKind.SECTION -> DestinationVariant.SECTION
                OptionKind.CLASS -> DestinationVariant.CLASS
            },
            name = option.name,
            label = option.label,
            onSelect = if (interactive && option.forward != null) ({ onOption(option) }) else null,
            code = option.code,
            sub = option.sub,
            detail = option.detail,
            seenPercent = option.seenPercent,
            stub = option.stub?.let { CardStub(it.label, it.value, it.unit, it.muted) },
            unavailable = option.unavailable,
            nameHidden = travels.hiddenName == option.id,
            nameLayout = Modifier.onGloballyPositioned {
                travels.reportName(option.id, Spot(option.name, nameStyle, ink, it.boundsInRoot(), right = false))
            },
        )
    }
}
```

Add the three strings of the load failure to `StartCopy` in `StartCopy.kt` (reference 4.5, S1), after `LOADING_DECKS`:

```kotlin
    const val DECKS_FAILED = "The decks didn't load"
    const val CHECK_CONNECTION = "Check your connection and try again."
    const val TRY_AGAIN = "Try again"
```

```bash
cd android/Truthy
./gradlew :app:compileDebugKotlin :app:testDebugUnitTest
```

Expected: `BUILD SUCCESSFUL`; task 10's tests and the 36 tests of `com.eienmosu.truthy.start` still pass.

- [ ] **Step 24: Write the motion state.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartMotion.kt`:

```kotlin
package com.eienmosu.truthy.start

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.eienmosu.truthy.BackTransition
import com.eienmosu.truthy.design.Tokens
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * What the start screen draws and how far its step change has got (Rule 1). One motion runs at a time: starting a
 * new one first ends the running one, as if it had finished (a gesture not yet committed returns to its step).
 */
@Stable
class StartMotion(private val scope: CoroutineScope, private val travels: Travels, initial: PanelSnapshot) {
    var shown by mutableStateOf(initial)
        private set
    var leaving by mutableStateOf<PanelSnapshot?>(null)
        private set
    var layers by mutableStateOf(StepLayers.rest(0))
        private set
    var direction by mutableIntStateOf(1)
        private set
    var swaps by mutableStateOf(Swaps.NONE)
        private set

    private val clock = Animatable(0f)
    private var job: Job? = null
    private var pendingEnd: (() -> Unit)? = null
    private var scrub: Scrub? = null

    private inner class Scrub(val from: PanelSnapshot, val transition: BackTransition, val itemCount: Int, val reduced: Boolean, val swaps: Swaps) {
        var p = 0f
        fun at(p: Float): StepLayers {
            val frame = transition.frame(p, reduced)
            travels.clockMs = frame.timeMs
            return backLayers(frame, itemCount, swaps)
        }
    }

    /** Ends the running motion now and returns the step drawn as current. */
    fun finishNow(): PanelSnapshot {
        job?.cancel()
        job = null
        val end = pendingEnd
        pendingEnd = null
        scrub = null
        end?.invoke()
        settle()
        return shown
    }

    /** A step change with nothing to animate (a step shown at once): draw it at rest. */
    fun showAtOnce(to: PanelSnapshot) {
        finishNow()
        shown = to
    }

    fun forward(to: PanelSnapshot, itemCount: Int, reduced: Boolean, swaps: Swaps, travel: TravelStart?) {
        val from = finishNow()
        begin(from, to, direction = 1, swaps = swaps)
        if (travel != null && !reduced) travels.start(travel)
        play(forwardDurationMs(itemCount, reduced), reduced) { t ->
            travels.clockMs = t
            forwardLayers(t, itemCount, reduced, swaps)
        }
    }

    /** A back by a tap or a key: the model has already gone back; the motion plays over its whole duration. */
    fun backOverTime(to: PanelSnapshot, itemCount: Int, reduced: Boolean, swaps: Swaps, travel: TravelStart?) {
        val from = finishNow()
        begin(from, to, direction = -1, swaps = swaps)
        if (travel != null && !reduced) travels.start(travel)
        val transition = BackTransition(from.step, to.step, itemCount)
        val total = transition.durationMs(reduced)
        play(total, reduced) { t ->
            val frame = transition.frame(t / total, reduced)
            travels.clockMs = frame.timeMs
            backLayers(frame, itemCount, swaps)
        }
    }

    /** A back gesture began: draw the step behind at progress 0; the model is not told until the gesture commits. */
    fun beginScrub(to: PanelSnapshot, transition: BackTransition, itemCount: Int, reduced: Boolean, swaps: Swaps, travel: TravelStart?) {
        val from = finishNow()
        begin(from, to, direction = -1, swaps = swaps)
        if (travel != null && !reduced) travels.start(travel)
        val s = Scrub(from, transition, itemCount, reduced, swaps)
        scrub = s
        pendingEnd = { shown = s.from }
        layers = s.at(0f)
    }

    fun scrubTo(p: Float) {
        val s = scrub ?: return
        s.p = p
        layers = s.at(p)
    }

    /** The gesture committed: play what is left (nothing for an instant commit), then tell the model. */
    fun commitScrub(lastProgress: Float?, onCommitted: () -> Unit) {
        val s = scrub ?: return
        scrub = null
        val ms = remainingMs(lastProgress, s.transition.durationMs(s.reduced))
        if (ms == 0) {
            pendingEnd = null
            settle()
            onCommitted()
            return
        }
        pendingEnd = onCommitted
        val start = s.p
        job = scope.launch(motionContext(s.reduced)) {
            clock.snapTo(start)
            clock.animateTo(1f, tween(durationMillis = ms, easing = LinearEasing)) { layers = s.at(value) }
            finishRun()
        }
    }

    /** The gesture was cancelled: spring back to progress 0, then draw the step it started from. */
    fun cancelScrub() {
        val s = scrub ?: return
        scrub = null
        pendingEnd = { shown = s.from }
        val snap = Tokens.SpringTransitions.snap
        job = scope.launch(motionContext(s.reduced)) {
            clock.snapTo(s.p)
            clock.animateTo(0f, tween(durationMillis = snap.durationMs, easing = snap.easing)) { layers = s.at(value) }
            finishRun()
        }
    }

    private fun begin(from: PanelSnapshot, to: PanelSnapshot, direction: Int, swaps: Swaps) {
        leaving = from
        shown = to
        this.direction = direction
        this.swaps = swaps
    }

    private fun settle() {
        leaving = null
        layers = StepLayers.rest(0)
        swaps = Swaps.NONE
        travels.clear()
    }

    private fun finishRun() {
        val end = pendingEnd
        pendingEnd = null
        job = null
        settle()
        end?.invoke()
    }

    private fun play(totalMs: Int, reduced: Boolean, frameAt: (Float) -> StepLayers) {
        layers = frameAt(0f)
        pendingEnd = null
        job = scope.launch(motionContext(reduced)) {
            clock.snapTo(0f)
            clock.animateTo(totalMs.toFloat(), tween(durationMillis = totalMs, easing = LinearEasing)) { layers = frameAt(value) }
            finishRun()
        }
    }
}
```

```bash
cd android/Truthy
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 25: Write the screen, bind it to the models and put it in the app.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartFlowScreen.kt`:

```kotlin
package com.eienmosu.truthy.start

import androidx.activity.compose.PredictiveBackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.lerp
import androidx.compose.ui.unit.max
import com.eienmosu.truthy.BackTransition
import com.eienmosu.truthy.HardwareKeyHandler
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.design.Logo
import com.eienmosu.truthy.design.rememberFrameInsets
import androidx.compose.ui.platform.testTag
import com.eienmosu.truthy.ui.TestTags
import com.eienmosu.truthy.design.LowerCloud
import com.eienmosu.truthy.design.SkyBackdrop
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.RECENT
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.chosenOn
import com.eienmosu.truthy.engine.clearFrom
import com.eienmosu.truthy.ui.BackPill
import com.eienmosu.truthy.ui.PillButton
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/**
 * What the start screen reads from task 11's model: the catalog (null while it loads, `failed` when it could not),
 * the step and choices with the model's direction, the card to focus going back, the field a name travels into,
 * the step change's sequence number, the arrival from a round, boarding, and the theme on screen.
 */
data class StartFlowUi(
    val data: StartData?,
    val failed: Boolean,
    val current: PanelSnapshot,
    val forward: Boolean,
    val focusId: String?,
    val travel: PassFieldName?,
    val seq: Int,
    val fromRound: Boolean,
    val boarding: Boolean,
    val theme: Theme,
)

/** What the start screen asks of the model and the app (StartFlowRoute binds it to task 11's names). */
interface StartFlowActions {
    fun choose(forward: Forward): Boolean
    fun tapBack()
    fun jump(field: PassFieldName)
    fun backOne()
    fun backTo(step: Step)
    fun backTransition(itemCount: Int): BackTransition?
    fun columnJumped()
    fun continueLast(): Boolean
    fun startRound(): Boolean
    fun onUnrolled()
    fun switchTheme()
    fun arrivalFocusTaken()
    fun retryCatalog()
}

/** The card a forward tap came from, so its name can travel once the model has moved (Rule 2). */
private data class PendingName(val optionId: String, val field: PassFieldName, val from: Spot, val to: PanelSnapshot)

/** Reduced motion comes from the app root (`TruthyRoot` provides `LocalReducedMotion` for every screen, rule 4). */
@Composable
fun StartFlowScreen(ui: StartFlowUi, actions: StartFlowActions) {
    StartFlowContent(ui, actions, LocalReducedMotion.current)
}

@Composable
private fun StartFlowContent(ui: StartFlowUi, actions: StartFlowActions, reduced: Boolean) {
    val scope = rememberCoroutineScope()
    val travels = remember { Travels() }
    val motion = remember { StartMotion(scope, travels, ui.current) }
    val latest by rememberUpdatedState(ui)
    val columnScroll = rememberScrollState()
    var pendingName by remember { mutableStateOf<PendingName?>(null) }
    var focus by remember { mutableStateOf<PanelFocus?>(null) }
    val unroll = remember { Animatable(0f) }
    var unrolling by remember { mutableStateOf(false) }
    val chrome by animateFloatAsState(
        targetValue = if (ui.boarding) 0f else 1f,
        animationSpec = if (reduced) snap() else tween(durationMillis = Tokens.Duration.topExit),
        label = "boarding",
    )

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val short = maxHeight < Tokens.Native.shortScreenBelow
        val tight = maxHeight < Breakpoints.tight

        fun swapsBetween(from: PanelSnapshot, to: PanelSnapshot): Swaps {
            val data = latest.data
            val withContinue = data != null && continueModel(data) != null
            return swapsFor(from.step, to.step, footContent(from.step, withContinue), footContent(to.step, withContinue))
        }

        fun travelStart(name: PendingName?, from: PanelSnapshot, to: PanelSnapshot, swaps: Swaps): TravelStart? {
            val data = latest.data
            if (reduced || data == null) return null
            val toStage = stageOf(to.step)
            val nameFlight = name?.let { NameFlight(it.from, SpotKey(toStage, it.field)) }
            val values = if (!swaps.block) {
                emptyList()
            } else {
                val fromStage = stageOf(from.step)
                val oldFilled = filledFields(passValues(resolveChoice(data.index, from.choice)))
                val newFilled = filledFields(passValues(resolveChoice(data.index, to.choice)))
                PassFieldName.entries
                    .filter { it != name?.field && it in oldFilled && it in newFilled && stageShows(fromStage, it) && stageShows(toStage, it) }
                    .mapNotNull { field -> travels.spots[SpotKey(fromStage, field)]?.let { ValueFlight(it, SpotKey(toStage, field)) } }
            }
            if (nameFlight == null && values.isEmpty()) return null
            return TravelStart(nameFlight, name?.optionId, values)
        }

        fun onOption(option: OptionModel) {
            val forward = option.forward ?: return
            val field = forward.field
            val from = travels.names[option.id]
            pendingName = if (!reduced && field != null && field != PassFieldName.MODE && from != null) {
                PendingName(option.id, field, from, PanelSnapshot(forward.step, forward.choice))
            } else {
                null
            }
            if (!actions.choose(forward)) pendingName = null
        }

        // Reference 4.4: arriving from the round by a control, the step 1 title takes focus once.
        LaunchedEffect(ui.fromRound) {
            if (ui.fromRound) {
                focus = PanelFocus.Title
                actions.arrivalFocusTaken()
            }
        }

        // Rule 1: a new step from the model starts its motion, unless the screen already shows it (a committed gesture).
        LaunchedEffect(ui.seq, ui.current) {
            val state = latest
            val now = state.current
            if (now == motion.shown) return@LaunchedEffect
            val from = motion.finishNow()
            if (now == from) return@LaunchedEffect
            val data = state.data
            val swaps = swapsBetween(from, now)
            if (short && columnScroll.value > 0) {
                columnScroll.scrollTo(0)
                actions.columnJumped()
            }
            when {
                state.forward -> {
                    val name = pendingName?.takeIf { it.to == now && it.field == state.travel }
                    focus = PanelFocus.Title
                    motion.forward(now, itemCount(data, now), reduced, swaps, travelStart(name, from, now, swaps))
                }
                now.step < from.step -> {
                    focus = state.focusId?.let { PanelFocus.Card(it) }
                    motion.backOverTime(now, itemCount(data, now), reduced, swaps, travelStart(null, from, now, swaps))
                }
                else -> motion.showAtOnce(now)
            }
            pendingName = null
        }

        // Rule 3: predictive back on every step after the first; consumed while the pass boards.
        PredictiveBackHandler(enabled = ui.current.step != Step.ONE || ui.boarding) { events ->
            val state = latest
            val data = state.data
            if (state.boarding || unrolling || data == null || state.current.step == Step.ONE) {
                events.collect { }
                return@PredictiveBackHandler
            }
            val from = motion.finishNow()
            val target = backTarget(data.index, from)
            val to = PanelSnapshot(target, clearFrom(from.choice, target))
            val count = itemCount(data, to)
            val transition = actions.backTransition(count)
            if (transition == null) {
                events.collect { }
                return@PredictiveBackHandler
            }
            val swaps = swapsBetween(from, to)
            motion.beginScrub(to, transition, count, reduced, swaps, travelStart(null, from, to, swaps))
            followBack(events.map { it.progress }, onProgress = { motion.scrubTo(it) }) { end ->
                when (end) {
                    is BackEnd.Committed -> motion.commitScrub(end.lastProgress) {
                        focus = chosenOn(transition.to, from.choice)?.let { PanelFocus.Card(it) }
                        actions.backTo(transition.to)
                    }
                    BackEnd.Cancelled -> motion.cancelScrub()
                }
            }
        }

        // Rule 5: Escape.
        HardwareKeyHandler { event ->
            val state = latest
            when (startKeyAction(event.keyCode, event.action, event.repeatCount, state.current.step, state.boarding || unrolling)) {
                StartKey.BACK -> {
                    actions.backOne()
                    true
                }
                StartKey.CONSUME -> true
                StartKey.PASS -> false
            }
        }

        // StartFlow.tsx:694-726, FillInPass.tsx:523-534: Start round unrolls the empty paper (at once with reduced motion), then the round opens.
        LaunchedEffect(ui.boarding) {
            if (!ui.boarding) {
                unrolling = false
                unroll.snapTo(0f)
                return@LaunchedEffect
            }
            motion.finishNow()
            if (columnScroll.value > 0) launch { if (reduced) columnScroll.scrollTo(0) else columnScroll.animateScrollTo(0) }
            if (reduced) {
                actions.onUnrolled()
                return@LaunchedEffect
            }
            unrolling = true
            unroll.snapTo(0f)
            unroll.animateTo(1f, tween(durationMillis = Tokens.Duration.t3, easing = Tokens.Curves.ease))
            actions.onUnrolled()
        }

        // Spec 5.6's safe areas, task 10's one implementation (the short-window rule is inside it).
        val frame = rememberFrameInsets()
        val top = frame.top
        val bottom = frame.bottom
        val start = frame.start
        val end = frame.end
        val data = ui.data
        val shown = motion.shown
        val leaving = motion.leaving
        val layers = motion.layers
        val continueLine = data?.let { continueModel(it) }

        @Composable
        fun TopZone(snapshot: PanelSnapshot, layer: Layer, interactive: Boolean, isLeaving: Boolean) {
            if (snapshot.step == Step.ONE) {
                Column(Modifier.fillMaxWidth().moved(layer).padding(top = StartGeometry.logoTop)) {
                    Logo(modifier = Modifier.testTag(TestTags.LOGO), asHeading = true)
                    Text(
                        StartCopy.TAGLINE,
                        style = TruthyType.tagline,
                        color = TruthyTheme.colors.ink,
                        modifier = Modifier.padding(top = Tokens.Space.s14).widthIn(max = StartGeometry.taglineMax),
                    )
                }
                return
            }
            val index = data?.index ?: return
            val resolved = resolveChoice(index, snapshot.choice)
            val values = passValues(resolved)
            val block = passBlock(stageOf(snapshot.step), values, nowField(snapshot.step), resolved.hasSections)
            val other = if (isLeaving) null else leaving?.takeIf { it.step != Step.ONE }
            val otherResolved = other?.let { resolveChoice(index, it.choice) }
            val leavingBlock = if (other != null && otherResolved != null && motion.swaps.block) {
                passBlock(stageOf(other.step), passValues(otherResolved), nowField(other.step), otherResolved.hasSections)
            } else {
                null
            }
            Column(
                Modifier.fillMaxWidth().moved(layer),
                verticalArrangement = Arrangement.spacedBy(Tokens.Space.s12),
            ) {
                BackPill(
                    description = backLabel(snapshot.step, resolved.hasSections, snapshot.choice.via == RECENT),
                    onClick = { if (interactive) actions.tapBack() },
                    modifier = Modifier.graphicsLayer { alpha = chrome },
                )
                FillInPass(
                    block = block,
                    leavingBlock = leavingBlock,
                    layers = layers,
                    changing = if (otherResolved != null) changingFields(passValues(otherResolved), values) else emptySet(),
                    direction = motion.direction,
                    interactive = interactive && !ui.boarding,
                    travels = travels,
                    onJump = { actions.jump(it) },
                    unroll = if (interactive && unrolling && snapshot.step == Step.SIX) unroll.value else null,
                    modifier = if (snapshot.step == Step.SIX) Modifier.padding(top = Tokens.Space.s8) else Modifier,
                )
            }
        }

        @Composable
        fun FootItem(content: FootContent, layer: Layer) {
            when (content) {
                FootContent.CONTINUE -> if (continueLine != null) {
                    ContinueLine(continueLine, onContinue = { actions.continueLast() }, modifier = Modifier.moved(layer))
                }
                FootContent.START -> PillButton(
                    label = StartCopy.START_ROUND,
                    onClick = { if (!ui.boarding) actions.startRound() },
                    modifier = Modifier.moved(layer).graphicsLayer { alpha = chrome },
                    trailingIcon = {
                        Text(StartCopy.ARROW, style = TruthyType.button, color = TruthyTheme.colors.onDark, modifier = Modifier.clearAndSetSemantics { })
                    },
                )
                FootContent.NONE -> Unit
            }
        }

        @Composable
        fun Foot(modifier: Modifier) {
            Box(modifier.fillMaxWidth().heightIn(min = Tokens.Size.pill)) {
                if (ui.failed && data == null && shown.step == Step.ONE) {
                    PillButton(label = StartCopy.TRY_AGAIN, onClick = { actions.retryCatalog() })
                } else {
                    val shownFoot = footContent(shown.step, continueLine != null)
                    val leavingFoot = leaving?.let { footContent(it.step, continueLine != null) }?.takeIf { it != shownFoot }
                    if (leavingFoot != null) FootItem(leavingFoot, layers.footOut)
                    FootItem(shownFoot, if (leavingFoot != null) layers.footIn else Layer.Shown)
                }
            }
        }

        SkyBackdrop(modifier = Modifier.fillMaxSize(), lowerCloud = LowerCloud.START)
        Column(
            Modifier
                .fillMaxSize()
                .then(if (short) Modifier.verticalScroll(columnScroll) else Modifier)
                .padding(start = start, end = end, top = top, bottom = bottom),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                Modifier
                    .widthIn(max = Tokens.Size.maxWidth)
                    .fillMaxWidth()
                    .then(if (short) Modifier else Modifier.weight(1f)),
            ) {
                // StartFlow.tsx:772-823: the top zone, 176 tall (its content's height on a short screen).
                Box(Modifier.fillMaxWidth().then(if (short) Modifier else Modifier.heightIn(min = Tokens.Size.startTopZone))) {
                    val leavingTop = leaving?.takeIf { (it.step == Step.ONE) != (shown.step == Step.ONE) }
                    if (leavingTop != null) TopZone(leavingTop, layers.topOut, interactive = false, isLeaving = true)
                    TopZone(shown, if (leavingTop != null) layers.topIn else Layer.Shown, interactive = true, isLeaving = false)
                    val fromY = if ((leaving ?: shown).step == Step.ONE) StartGeometry.switchLogoRow else 0.dp
                    val toY = if (shown.step == Step.ONE) StartGeometry.switchLogoRow else 0.dp
                    ThemeSwitch(
                        theme = ui.theme,
                        onSwitch = { actions.switchTheme() },
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .offset { IntOffset(0, lerp(fromY, toY, layers.switchMove).roundToPx()) }
                            .graphicsLayer { alpha = chrome },
                    )
                }
                // StartFlow.tsx:826-832: the main area, 20 below the top zone; the list stops 76 above the bottom when the continue line shows.
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = Tokens.Space.s20)
                        .then(if (short) Modifier else Modifier.weight(1f))
                        .padding(bottom = if (!short && shown.step == Step.ONE && continueLine != null) Tokens.Size.footGap else 0.dp),
                ) {
                    // One call site for both panels, keyed by the step and choices drawn, so a panel keeps its own state
                    // (its list's scroll) when it turns from arriving into leaving, and a new step gets fresh state.
                    listOfNotNull(leaving?.let { it to true }, shown to false).forEach { (snapshot, isLeaving) ->
                        key(snapshot) {
                            StepPanel(
                                snapshot = snapshot,
                                content = panelContent(data, ui.failed, snapshot),
                                leaving = isLeaving,
                                layers = layers,
                                short = short,
                                tight = tight,
                                travels = travels,
                                focus = if (isLeaving) null else focus,
                                onOption = { if (!isLeaving) onOption(it) },
                            )
                        }
                    }
                }
                if (short) Foot(Modifier.padding(bottom = Tokens.Space.s4))
            }
        }
        // StartFlow.tsx:837: the foot zone, 16 from the sides and safe-bottom + 4 from the bottom, over the list.
        if (!short) {
            Foot(
                Modifier
                    .align(Alignment.BottomCenter)
                    .padding(start = start, end = end, bottom = bottom + Tokens.Space.s4)
                    .widthIn(max = Tokens.Size.maxWidth),
            )
        }
        TravelOverlay(travels)
    }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartFlowRoute.kt` (the only file that calls `StartFlowModel` and `AppViewModel`):

```kotlin
package com.eienmosu.truthy.start

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import com.eienmosu.truthy.AppViewModel
import com.eienmosu.truthy.BackTransition
import com.eienmosu.truthy.CatalogState
import com.eienmosu.truthy.Direction
import com.eienmosu.truthy.RoundRequest
import com.eienmosu.truthy.StartFlowModel
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.Step

/** The start flow on screen, bound to task 11's models. */
@Composable
fun StartFlowRoute(app: AppViewModel) {
    val model = app.startFlow
    val view by model.view.collectAsState()
    val catalog by model.catalog.collectAsState()
    val boarding by model.boarding.collectAsState()
    val theme by app.theme.collectAsState()
    val ready = (catalog as? CatalogState.Ready)?.catalog
    val ui = StartFlowUi(
        data = ready?.let { StartData(index = it.index, progress = it.progress, cardIds = it.cardIds, recent = it.recent) },
        failed = catalog == CatalogState.Failed,
        current = PanelSnapshot(view.step, view.choice),
        forward = view.dir == Direction.FORWARD,
        focusId = view.focusId,
        travel = view.travel,
        seq = view.seq,
        fromRound = view.fromRound,
        boarding = boarding,
        theme = theme.theme,
    )
    val actions = remember(model, app) { RouteActions(model, app) }
    StartFlowScreen(ui = ui, actions = actions)
}

private class RouteActions(private val model: StartFlowModel, private val app: AppViewModel) : StartFlowActions {
    /** The round Start round asked for, opened once the paper has unrolled (task 11: startRound, then openRound). */
    private var request: RoundRequest? = null

    override fun choose(forward: Forward): Boolean = model.choose(forward.step, forward.choice, forward.field)

    override fun tapBack() {
        model.tapBack()
    }

    override fun jump(field: PassFieldName) {
        model.jump(field)
    }

    override fun backOne() {
        model.back()
    }

    override fun backTo(step: Step) {
        model.back(step)
    }

    override fun backTransition(itemCount: Int): BackTransition? = model.backTransition(itemCount)

    override fun columnJumped() {
        model.columnJumped()
    }

    override fun continueLast(): Boolean = model.continueLast()

    override fun startRound(): Boolean {
        val next = model.startRound() ?: return false
        request = next
        return true
    }

    override fun onUnrolled() {
        val next = request ?: return
        request = null
        app.openRound(next)
    }

    override fun switchTheme() {
        app.switchTheme()
    }

    override fun arrivalFocusTaken() {
        model.arrivalFocusTaken()
    }

    override fun retryCatalog() {
        app.retryCatalog()
    }
}
```

In `android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt`, add these imports:

```kotlin
import androidx.compose.runtime.CompositionLocalProvider
import com.eienmosu.truthy.design.LocalReducedMotion
import com.eienmosu.truthy.start.StartFlowRoute
import com.eienmosu.truthy.start.rememberReducedMotion
```

and replace task 11's `TruthyRoot` function with this one. It provides reduced motion once, for every screen (the start flow, and from tasks 13 and 14 the round, the leave sheet and the result), and puts the start flow in its root:

```kotlin
@Composable
fun TruthyRoot(app: AppViewModel) {
    val screen by app.screen.collectAsState()
    // Rule 4: Settings.Global.ANIMATOR_DURATION_SCALE == 0, provided at the root so every screen sees the real value.
    CompositionLocalProvider(LocalReducedMotion provides rememberReducedMotion()) {
        Box(Modifier.fillMaxSize().background(TruthyTheme.colors.surface).testTag(ROOT_TAG)) {
            when (screen) {
                TopScreen.Start -> Box(Modifier.fillMaxSize().testTag(START_TAG)) { StartFlowRoute(app) }
                is TopScreen.Round -> Box(Modifier.fillMaxSize().testTag(ROUND_TAG))
            }
        }
    }
}
```

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

Expected: `BUILD SUCCESSFUL`; the 36 tests of `com.eienmosu.truthy.start` and every earlier `:app` test pass.

- [ ] **Step 26: Run the instrumented tests and see them pass.**

With the API 36 emulator running:

```bash
cd android/Truthy
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.start.StartFlowTest
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/outputs/androidTest-results/connected/debug/*.xml
```

Expected: `BUILD SUCCESSFUL` and `tests="10" skipped="0" failures="0" errors="0"` (the file holds this task's class only, or task 7's and task 11's instrumented classes too, each with its own line and 0 failures). If `predictiveBackScrubsTheBackMotionAndACancelChangesNothing` fails because "Choose a platform" never shows, the dispatcher's test entry points did not reach `PredictiveBackHandler` (activity 1.12 and later route back through `NavigationEventDispatcher`): check in the pinned activity version's `OnBackPressedDispatcher.kt` that `dispatchOnBackStarted` is still public (`@VisibleForTesting`) and forwards to the navigation event input; if it does not, drive the same events through the activity's `navigationEventDispatcher` test input instead, and keep the assertions. Any other failure is a defect of steps 20 to 25: fix the code, not the test.

- [ ] **Step 27: Check reduced motion and an instant-commit API level.**

Reduced motion (Review Focus 4): the fades must still play and every story must still pass with the system's animations off.

```bash
adb shell settings put global animator_duration_scale 0
cd android/Truthy
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.eienmosu.truthy.start.StartFlowTest
adb shell settings put global animator_duration_scale 1
adb shell settings get global animator_duration_scale
```

Expected: `BUILD SUCCESSFUL`, 10 tests, 0 failures, then `1`. Then by hand on the API 36 emulator: with "Remove animations" on (Settings, Accessibility), choose Cloud and see the old step fade out and the new one fade in (about a quarter of a second, no movement), and swipe back from the left edge and hold halfway: the steps cross-fade with the finger. With it off, the same swipe scrubs the web's back motion (the old panel sinks, the platform cards drop in from above, the cleared Platform field returns to dashes), and letting go before the middle springs back.

If an API 33 emulator exists (`emulator -list-avds`; task 15 creates it if not), start it alone and run the same `connectedDebugAndroidTest` command: expected 10 tests, 0 failures. There the system back gesture itself commits at once; check by hand that a back swipe on step 3 lands on step 2 with its cards in place and no half-drawn frame. Task 15 repeats both checks on API 36, 34, 33 and 26 with recordings (feel items N1 and N2).

- [ ] **Step 28: Run every gate, check the hygiene and commit.**

```bash
cd android/Truthy
./gradlew :engine:test :tokengen:test :app:testDebugUnitTest :app:assembleDebug
cd ../..
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartModifiers.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/Travels.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/FillInPass.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/ContinueLine.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/ThemeSwitch.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StepPanel.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartMotion.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartFlowScreen.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartFlowRoute.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/start/StartCopy.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ui/DestinationCard.kt android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt android/Truthy/app/src/androidTest/kotlin/com/eienmosu/truthy/start/StartFlowTest.kt
pnpm test
git status --short
```

Expected: `BUILD SUCCESSFUL`; `pnpm test` ends with every test passing, including `tests/repo-hygiene.test.ts`, which reads the staged Kotlin files (no labelled `this` followed by a member, no em dash, no local path, no e-mail-shaped string); `git status --short` lists only staged entries (`A ` for the ten new files, `M ` for `StartCopy.kt`, `DestinationCard.kt` and `TruthyRoot.kt`) and nothing unstaged or untracked. If the hygiene test reports a finding, fix the line it names and stage it again. Then:

```bash
git commit -m "feat: add the Android start flow screens with the fill-in pass, Recent, Continue, the theme switch and predictive back"
git log --oneline -4
```

Expected: the four commits of this task on top, newest first: this one, `feat: follow predictive back, Escape and reduced motion in the Android start flow`, `feat: add the Android start flow's forward motion and read the back motion's frames`, `feat: work out the Android start flow's options, pass layouts and copy`.
