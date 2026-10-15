### Task 11: App state: `AppViewModel`, `StartFlowModel`, `BackTransition`, `RoundCoordinator` and the debug intent extras

The engine knows the rules and the data layer knows the files; this task is the part in between that decides what happens when, on which clock, in which order. It ports the stateful half of the web's start flow (`components/start/StartFlow.tsx`: the step, the choices, the settle time, the way back, boarding), of the play screen (`components/play/PlayScreen.tsx`, `useRound.ts`, `useClock.ts`, `leave.ts`, `ResultView.tsx`: the guards, the one answer path, the sheet, the Timed clock, the saves) and of the theme switch (`src/app-state/theme.ts`), and adds what only a native app needs: the round journal written after every answer and applied at launch (spec 4.5), the Timed pause on `ON_STOP` only (spec 5.6), the back motion of the start flow as a pure function of progress that predictive back can scrub (spec 5.1, D8), and debug intent extras that open any screen in a known state for the visual review (spec 7.4). Nothing here draws: tasks 12 to 14 build the screens on these models. At the end of the task the activity boots the stored theme before the first frame, applies a pending journal, opens start step 1, and swaps an empty start root and an empty round root in place.

**This task was not compiled during drafting.** Nothing in this file was compiled or run while the plan was written, so every Kotlin line below was checked by reading against the Kotlin standard library, kotlinx.coroutines and kotlinx-coroutines-test, AndroidX lifecycle, activity, core-splashscreen and Compose documentation, and against the Produces blocks of tasks 1 to 9 of this plan, never by a compiler. After the review, tasks 1 to 15 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: the JVM tests and, on the API 36 emulator, the instrumented tests. The defects that run found are fixed in this file (README, Drafting record). If the compiler rejects a line, fix the line, not the test, and keep the behaviour the step states.

Builds on tasks 1 to 10. From the engine (tasks 1 to 6): the content and round types, the reducer, the progress rules, the start-flow step helpers, the catalog helpers, the leave and record rules, the ticket and the guard constants. From task 7: `MainActivity`, `TruthyRoot` and `ROOT_TAG` in `app/src/main/java/com/eienmosu/truthy/`, the manifest with `android:enableOnBackInvokedCallback="true"`, the instrumented `AppLaunchTest`. From task 8: `Tokens`, `ResolvedTheme`, `resolvedTheme`, `TruthyTheme`, `bootTheme`, `applyWindowTheme`, `applyStoredNightMode`, `isNightUiMode`, and `uiMode` in the activity's `android:configChanges`. From task 9: `DeckStore`, `ProgressStore` with `update`, `RoundJournal`, `journalEntry`, `applyJournal`, `ThemeStore`, `StoredTheme`, and the unit test support in `com.eienmosu.truthy.support`. Task 10 is not used.

**Files:**
- Modify (only if step 1 finds them missing): `android/Truthy/gradle/libs.versions.toml`, `android/Truthy/app/build.gradle.kts`
- Create (all under `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/`): `Clocks.kt`, `SerialWriter.kt`, `BackTransition.kt`, `RoundRequest.kt`, `StartFlowModel.kt`, `DebugLaunch.kt`, `AppServices.kt`, `RoundCoordinator.kt`, `AppController.kt`, `AppGraph.kt`, `AppViewModel.kt`
- Modify (replace the whole content): `android/Truthy/app/src/main/java/com/eienmosu/truthy/MainActivity.kt`, `android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt`
- Test support (under `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/support/`): create `StateFakes.kt`, `TestServices.kt`
- Test (under `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/`): create `SerialWriterTest.kt`, `BackTransitionTest.kt`, `StartFlowModelTest.kt`, `DebugLaunchTest.kt`, `RoundCoordinatorTest.kt`, `AppControllerTest.kt`

**Interfaces:**
- Consumes (the README fixes some of these names; the rest were read from the Produces blocks of tasks 1 to 9; step 1 checks every one):

```kotlin
// engine, package com.eienmosu.truthy.engine
@Serializable enum class Theme(val wire: String) { LIGHT("light"), DARK("dark") }
fun switchTheme(choice: Theme?, systemDark: Boolean): Theme                  // the web's flip rule (task 1)
data class StartArgs(val mode: Mode, val route: Route, val pool: List<Card>, val history: History, val seed: Double)
fun startRound(args: StartArgs): RoundState; fun reduce(state: RoundState, event: RoundEvent): RoundState
fun currentCard(state: RoundState): Card?; fun isDecided(state: RoundState): Boolean; fun scoreOf(mode: Mode, answers: List<Answered>): Int
val TIMED: TimedSettings                                                     // roundMs, holdMs, maxStepMs (task 3)
data class SwipeConstants(..., val settleMs: Double, ...); val SWIPE: SwipeConstants   // settleMs = 250.0 (task 4)
@Serializable data class LastRound(val route: Route, val mode: Mode, val score: Int?, val total: Int?)
data class ApplyOutcome(val progress: Progress, val previousBest: Int?, val isNewBest: Boolean)
fun emptyProgress(): Progress; fun recordKey(route: Route, mode: Mode): String; fun bestFor(progress: Progress, route: Route, mode: Mode): Int?
fun pruneDeck(progress: Progress, deckId: String, cardIds: List<String>): Progress   // task 4
fun findRoute(index: DeckIndex, route: Route): RouteInIndex?                 // RouteInIndex(area, platform, deck, section) (task 5)
fun poolFor(deck: DeckFile, sectionId: String): List<Card>
enum class Step(val number: Int) { ONE(1), TWO(2), THREE(3), FOUR(4), FIVE(5), SIX(6) }
const val RECENT = "recent"
data class StartChoice(val via: String? = null, val areaId: String? = null, val platformId: String? = null, val deckId: String? = null, val sectionId: String? = null, val mode: Mode? = null)
enum class PassFieldName(val wire: String) { AREA("area"), PLATFORM("platform"), DECK("deck"), SECTION("section"), MODE("mode") }
fun clearFrom(choice: StartChoice, step: Step): StartChoice; fun pathTo(step: Step, hasSections: Boolean, recent: Boolean = false): List<Step>
fun previousStep(step: Step, hasSections: Boolean, recent: Boolean = false): Step; fun chosenOn(target: Step, choice: StartChoice): String?
data class RecentDeck(val area: IndexArea, val platform: IndexPlatform, val deck: IndexDeck, val lastSeenAt: Double)
data class PrunedProgress(val progress: Progress, val changed: Boolean)
fun decksWithHistory(index: DeckIndex, progress: Progress): List<IndexDeck>
fun withoutRemovedCards(progress: Progress, cardIds: Map<String, List<String>>): PrunedProgress
fun continueTarget(index: DeckIndex, progress: Progress, table: List<ModeInfo> = MODE_TABLE): ContinueTarget?   // ContinueTarget(route, mode, found, lastScore)
fun recentDecks(index: DeckIndex, progress: Progress, limit: Int = RECENT_LIMIT): List<RecentDeck>
const val NEXT_ARRIVES_MS: Double = 420.0; const val RESULT_ARRIVES_MS: Double = 1000.0   // task 6
fun leavesSomething(round: RoundState): Boolean; fun saveLeftRound(round: RoundState, stored: Progress): Progress
fun recordRound(round: RoundState, stored: Progress): ApplyOutcome
data class TicketInfo(val deckCode: String, val deckName: String, val sectionCode: String, val sectionName: String, val modeLabel: String, val best: Int?)
fun ticketFor(found: RouteInIndex, mode: Mode, best: Int?): TicketInfo

// app, package com.eienmosu.truthy (task 9)
class DeckStore internal constructor(open: (String) -> InputStream, io: CoroutineDispatcher = Dispatchers.IO) { constructor(assets: AssetManager); fun index(): DeckIndex; suspend fun deck(id: String): DeckFile }
interface ProgressStore { suspend fun load(): Progress; suspend fun save(progress: Progress); suspend fun update(change: (Progress) -> Progress): Progress }   // update has a default body
class FileProgressStore(dir: File, io: CoroutineDispatcher = Dispatchers.IO) : ProgressStore
class RoundJournal(dir: File, io: CoroutineDispatcher = Dispatchers.IO) { suspend fun record(entry: JournalEntry); suspend fun clear(); suspend fun pending(): JournalEntry? }
@Serializable data class JournalAnswer(val cardId: String, val given: Boolean, val correct: Boolean, val at: Double)
@Serializable data class JournalEntry(val route: Route, val mode: Mode, val seed: Long, val roundId: String, val answers: List<JournalAnswer>, val decided: Boolean, val recorded: Boolean)
fun journalEntry(state: RoundState, seed: Long, roundId: String, recorded: Boolean = false): JournalEntry
suspend fun applyJournal(journal: RoundJournal, store: ProgressStore, deck: suspend (String) -> DeckFile): JournalOutcome
typealias StoredTheme = Theme
class ThemeStore(prefs: SharedPreferences) { val stored: StoredTheme?; fun store(theme: StoredTheme); companion object { const val PREFS_NAME = "truthy" } }
// task 9 test support, package com.eienmosu.truthy.support
const val T0 = 1_790_000_000_000.0; fun nativeDecksDir(): File; fun repositoryDeckStore(): DeckStore; fun newTempDir(): File

// app, package com.eienmosu.truthy.design (task 8)
class ResolvedTheme { val theme: Theme; val colors: TruthyColors; val isDark: Boolean }
fun resolvedTheme(theme: Theme): ResolvedTheme; fun resolvedTheme(stored: Theme?, systemDark: Boolean): ResolvedTheme
@Composable fun TruthyTheme(theme: ResolvedTheme, content: @Composable () -> Unit); object TruthyTheme { val colors: TruthyColors }
fun isNightUiMode(uiMode: Int): Boolean; fun applyStoredNightMode(context: Context, stored: Theme?)
fun applyWindowTheme(activity: ComponentActivity, theme: ResolvedTheme); fun bootTheme(activity: ComponentActivity, stored: Theme?): ResolvedTheme
object Tokens { object Duration { const val t1: Int; t2; t3; stepExitTitle; stepExit; stepEnter; stepEnterDelay; stepStagger; topExit; topEnterDelay; dashIn; reducedOut; reducedIn }
                object Curves { val ease: CubicBezierEasing; val easeOut: CubicBezierEasing } }

// app (task 7)
class MainActivity : ComponentActivity()        // app/src/main/java/com/eienmosu/truthy/MainActivity.kt
const val ROOT_TAG = "truthy.root"              // app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt
```

- Produces (package `com.eienmosu.truthy`; later tasks rely on every name):

```kotlin
// Clocks.kt
fun interface WallClock { fun nowMs(): Double }                // epoch ms, whole numbers (System.currentTimeMillis)
fun interface MonotonicClock { fun nowMs(): Double }           // SystemClock.uptimeMillis, the base of PointerInputChange.uptimeMillis
object SystemWallClock : WallClock; object SystemMonotonicClock : MonotonicClock
fun secureSeed(): Long                                         // SecureRandom, 0 to 2^32 - 1
fun newRoundId(): String

// SerialWriter.kt: the one writer, FIFO, failures dropped
class SerialWriter(scope: CoroutineScope) { fun submit(block: suspend () -> Unit); suspend fun <T> run(block: suspend () -> T): T }

// BackTransition.kt: the start flow's back motion as a pure function of progress
data class BackLayer(val alpha: Float, val offsetY: Float)     // offsetY in dp, positive is down
data class BackTransition(val from: Step, val to: Step, val itemCount: Int) {
    fun durationMs(reducedMotion: Boolean): Int
    fun frame(p: Float, reducedMotion: Boolean): BackFrame
    companion object { PANEL_SINK_DP, ITEM_DROP_DP, ZONE_SHIFT_DP, REDUCED_IN_DELAY_MS, BLOCK_IN_DELAY_MS, VALUE_OUT_END, VALUE_IN_START }
}
data class BackFrame(val transition: BackTransition, val timeMs: Float, val reducedMotion: Boolean) {
    val oldPanel: BackLayer; val oldTitleAlpha: Float; fun newItem(index: Int): BackLayer
    val topSwap: Boolean; val tripOut: BackLayer; val brandIn: BackLayer; val switchShift: Float
    val footOut: BackLayer; val footIn: BackLayer; val dashAlpha: Float
    val stageChange: Boolean; val oldBlockAlpha: Float; val newBlockAlpha: Float; val morph: Float
    val valuesTravel: Boolean; val oldValueAlpha: Float; val newValueAlpha: Float
}

// RoundRequest.kt
data class RoundRequest(val route: Route, val mode: Mode)

// StartFlowModel.kt
enum class Direction { FORWARD, BACK }
data class StartView(val step: Step, val choice: StartChoice, val dir: Direction, val focusId: String? = null, val travel: PassFieldName? = null, val seq: Int = 0, val fromRound: Boolean = false)
data class Catalog(val index: DeckIndex, val progress: Progress, val cardIds: Map<String, List<String>>, val recent: List<RecentDeck>)
sealed interface CatalogState { data object Loading; data object Failed; data class Ready(val catalog: Catalog) }
class StartFlowModel(monotonic: MonotonicClock) {
    val view: StateFlow<StartView>; val stack: StateFlow<List<Step>>; val choice: StateFlow<StartChoice>
    val catalog: StateFlow<CatalogState>; val boarding: StateFlow<Boolean>; val step: Step
    fun showCatalog(catalog: Catalog); fun catalogLoading(); fun catalogFailed(); fun reset(fromRound: Boolean); fun arrivalFocusTaken()
    fun settled(): Boolean
    fun choose(step: Step, choice: StartChoice, field: PassFieldName? = null): Boolean
    fun chooseArea(area: IndexArea): Boolean; fun chooseRecent(): Boolean; fun choosePlatform(platform: IndexPlatform): Boolean
    fun chooseDeck(deck: IndexDeck, base: StartChoice = choice.value): Boolean; fun chooseRecentDeck(recent: RecentDeck): Boolean
    fun chooseSection(sectionId: String): Boolean; fun chooseMode(mode: Mode): Boolean; fun continueLast(): Boolean
    fun back(to: Step): Boolean; fun back(): Boolean; fun previous(): Step?; fun backTransition(itemCount: Int): BackTransition?
    fun tapBack(): Boolean; fun jump(field: PassFieldName): Boolean; fun columnJumped()
    fun startRound(): RoundRequest?; fun show(step: Step, choice: StartChoice)
}

// DebugLaunch.kt (debug builds only, from intent extras)
enum class DebugScreen(val wire: String) { START("start"), ROUND("round"), ANSWERED("answered"), LEAVE_SHEET("sheet"), RESULT("result") }
data class DebugLaunch(val seed: Long?, val route: Route?, val mode: Mode?, val screen: DebugScreen?, val theme: StoredTheme?, val step: Step? = null) {
    fun roundRequest(): RoundRequest?
    companion object { SEED = "truthy.seed"; DECK = "truthy.deck"; SECTION = "truthy.section"; MODE = "truthy.mode"; SCREEN = "truthy.screen"; THEME = "truthy.theme"; STEP = "truthy.step" }
}
fun parseDebugLaunch(extra: (String) -> String?): DebugLaunch?
fun extraText(value: Any?): String?          // a String extra as is, a Long or Int extra as its digits, anything else null (so --es and --el both work)
fun isDebuggable(context: Context): Boolean

// AppServices.kt
class AppServices(val index: suspend () -> DeckIndex, val deck: suspend (String) -> DeckFile, val progress: ProgressStore, val journal: RoundJournal,
                  val readTheme: () -> Theme?, val writeTheme: (Theme) -> Unit, val wall: WallClock, val monotonic: MonotonicClock,
                  val seeds: () -> Long, val newRoundId: () -> String)

// RoundCoordinator.kt
class RoundCoordinator(request, ticket, initial, seed, roundId, scope, writer, progressStore, journal, wall, monotonic, hidden) {
    val request: RoundRequest; val ticket: TicketInfo; val seed: Long; val roundId: String
    val state: StateFlow<RoundState>; val sheetOpen: StateFlow<Boolean>; val outcome: StateFlow<ApplyOutcome?>
    val cardShownAt: Double; val sheetOpenedAt: Double; val decidedWhenSheetOpened: Boolean
    fun answer(value: Boolean): Boolean; fun next(): Boolean; fun requestLeave(): Boolean; fun keepPlaying(); fun scrimTapAccepted(): Boolean
    suspend fun leave(); fun onStop(); fun onStart(); suspend fun awaitRecorded(); fun resultActionReady(): Boolean; fun close()
    fun debugAdvance(screen: DebugScreen)
    companion object { const val TICK_MS = 100L }
}
suspend fun prepareRound(request: RoundRequest, index: DeckIndex, services: AppServices, writer: SerialWriter, parent: CoroutineScope, hidden: Boolean): RoundCoordinator?

// AppController.kt
sealed interface TopScreen { data object Start; data class Round(val request: RoundRequest, val load: RoundLoad) }
sealed interface RoundLoad { data object Loading; data object Failed; class Ready(val coordinator: RoundCoordinator) }
class AppController(scope: CoroutineScope, services: AppServices, writer: SerialWriter, systemDark: Boolean, debug: DebugLaunch? = null) {
    val startFlow: StartFlowModel; val screen: StateFlow<TopScreen>; val theme: StateFlow<ResolvedTheme>; val storedTheme: Theme?; val booted: Job
    fun openRound(request: RoundRequest); fun retryRound(); fun requestLeave(); fun roundBack(); fun leaveRound()
    fun closeResult(): Boolean; fun playAgain(): Boolean; fun switchTheme(): Theme; fun onSystemDarkChanged(dark: Boolean)
    fun onStart(); fun onStop(); fun retryCatalog()
}

// AppGraph.kt, AppViewModel.kt
class AppGraph { val themeStore: ThemeStore; val writer: SerialWriter; fun services(debug: DebugLaunch?): AppServices; companion object { fun get(context: Context): AppGraph } }
class AppViewModel(services: AppServices, writer: SerialWriter, systemDark: Boolean, debug: DebugLaunch?) : ViewModel() {
    val controller: AppController; val screen: StateFlow<TopScreen>; val theme: StateFlow<ResolvedTheme>; val startFlow: StartFlowModel; val storedTheme: Theme?
    // and every AppController action above, delegated one to one
    companion object { fun factory(graph: AppGraph, systemDark: Boolean, debug: DebugLaunch?): ViewModelProvider.Factory }
}

// TruthyRoot.kt (replaces task 7's no-argument version)
const val ROOT_TAG = "truthy.root"; const val START_TAG = "truthy.start"; const val ROUND_TAG = "truthy.round"
@Composable fun TruthyRoot(app: AppViewModel)
```

  - What tasks 12 to 15 must know:
    - The start screen reads `startFlow.view` (step, choice, direction, the card to focus going back, the field a name travels into, `seq` as the key of a step change, `fromRound` for the step 1 title focus, then calls `arrivalFocusTaken()`), `startFlow.catalog` and `startFlow.boarding`. Options call the `choose*` functions and get `false` while the settle time runs. The Back pill calls `tapBack()`, a pass field `jump(field)`, Escape and a completed predictive back `back()` or `back(transition.to)`. After a step change that scrolled the short-screen column back to its top, the UI calls `columnJumped()`. "Start round" calls `startRound()`, plays the 360 ms unroll (none with reduced motion), then calls `openRound(request)`.
    - Predictive back on the start flow is enabled exactly when `startFlow.previous()` is not null or `boarding` is true (during the unroll every back is consumed and does nothing; `back` returns false). The gesture takes `startFlow.backTransition(itemCount)`, renders `frame(p, reducedMotion)` for every progress event, calls `back(transition.to)` only on completion, and on a cancel animates p back to 0 without touching the model (spec 5.1: choices are cleared only when a back completes). A tap that jumps several steps plays `BackTransition(from, target, itemCount).frame` from 0 to 1 over `durationMs(reducedMotion)` with linear time. Below API 34 the handler's flow completes without progress events: the UI calls `back` and may play the same frames over time; `frame(1f, _)` is the new step at rest in both motion modes (tested here).
    - The round screen reads `coordinator.state`, `sheetOpen`, `outcome` (non-null once the result is recorded: the comparison and the 1000 ms guard start there), `ticket`, `cardShownAt` (the `SwipeContext.cardShownAt` of the swipe, on the monotonic clock) and `decidedWhenSheetOpened`. True, False, the arrows and a committed swipe all call `answer(value)`; Next card, See results and Return call `next()`; the X and Escape call `AppViewModel.requestLeave()`; Android back on the round calls `roundBack()`; Keep playing and every dismissal of the sheet call `keepPlaying()`; Leave round calls `leaveRound()`; Play again `playAgain()`; Choose another route and Close results `closeResult()`. A scrim tap first asks `scrimTapAccepted()` if task 14 adds the 250 ms scrim guard (spec 5.4).
    - Debug extras, read only on a debuggable build and only when the activity starts without saved state: `adb shell am start -n com.eienmosu.truthy/.MainActivity --es truthy.deck <deckId> --es truthy.section <sectionId or ALL> --es truthy.mode <classic|streak|lives|timed> --es truthy.screen <start|round|answered|sheet|result> --es truthy.step <1..6> --es truthy.seed <0..4294967295> --es truthy.theme <light|dark>`. The seed may also be a long extra (`--el truthy.seed 1234567`, or `putExtra(DebugLaunch.SEED, 1234567L)`): `extraText` reads a `Long` or `Int` extra as its digits. The fixed seed applies to every round dealt in that launch, Play again included (`AppGraph.services` hands out the same seed each time). The extras are read only when `BuildConfig.DEBUG` is true, a compile-time constant, so R8 drops the parser from the release build (task 16 checks it). A missing section means the whole deck. `start` opens the given step (6 when no step is given) with the route's choices up to it; the other screens deal the round with the seed and drive it there (answers alternate right and wrong; Timed answers three cards and then runs the minute out). A debug theme is stored, as the switch would store it.

**Rules:**

1. **Two clocks** (spec 4.4, reference 3.3 and 7.3). Answer times, Timed ticks and visibility events use `WallClock` (`System.currentTimeMillis()`, whole epoch milliseconds, as `Date.now()`); the guards use `MonotonicClock` (`SystemClock.uptimeMillis()`, the base of `MotionEvent.eventTime` and `PointerInputChange.uptimeMillis`). They are never mixed: the coordinator stamps an answer's guard time on the monotonic clock and its `at` on the wall clock (`PlayScreen.tsx:582-591`).
2. **One writer.** Every progress change goes through `ProgressStore.update` (task 9) inside `SerialWriter.run`, and every journal write and delete through the same `SerialWriter`, in the order handed in. The app's writer lives in a process-wide scope (`AppGraph`), so a journal write handed in just before the activity is destroyed still lands, and a new `AppViewModel` applies the journal only after it. A failing write is dropped (a storage failure never reaches the player, spec 4.5).
3. **The start flow** (`StartFlow.tsx:72-185, 480-700`):
   - The stack is `pathTo(step, hasSections, recent)`: a deck without sections has no step 4, the recent path has no step 2; before a deck is known, a deck has sections (`(r.deck?.sections.length ?? 1) > 0`).
   - Options, Continue and Start round are ignored for `SWIPE.settleMs` (250) after the step appears, on the monotonic clock. Every step change, forward or back, restarts that time, and so does the catalog appearing (step 1's options, and the arrival from the round).
   - Going back (`back(to)`, the web's `backTo`) never waits for the settle time; it is refused for a target that is not earlier and while boarding. It clears the choices made on or after the target (`clearFrom`) and names the card to focus, `chosenOn(target, choice)` of the choices before the clear. The Back pill and the pass fields (`tapBack`, `jump`), but not Escape or the gesture (`back()`), are also held for 250 ms after `columnJumped()`.
   - On the recent path the platform field (`jump(PLATFORM)`) opens that platform's own deck step: step 3 with only the area and platform, the stack `[1, 2, 3]`, focus on the deck chosen before.
   - Continue (`continueTarget`) goes to step 6 with the whole path on the stack; Back retraces it.
   - `startRound()` sets `boarding` and returns the request once; from then on every back and choice is refused until `reset`. Leaving the round shows step 1 with no choices (`reset(fromRound = true)`).
4. **The back motion B(p)** (spec 5.1, reference 5.7 and 5.8, `StartFlow.tsx:230-267, 815-822`, `FillInPass.tsx:131-132, 379-385`, `passValueTravel.ts:104-113`). Time `t = p * durationMs`, linear in p; every part runs its own easing inside its window and is exactly at rest outside it.
   - Full motion, `durationMs = max(t3 = 360, 110 + 25 * (itemCount - 1) + 240)`. The old panel: opacity 1 to 0 and offset 0 to +10 (it sinks) over 140 `ease-out`; its title fades over the first 80 `ease-out`. New item i (the title is item 0): opacity 0 to 1 and offset -24 to 0 (it drops in from above) over 240 `ease` after `110 + 25 * i`. Back to step 1: the pass and Back pill leave (opacity to 0, offset to +12, 110 `ease`), the logo enters (from -12, 240 `ease` after 120), the continue line enters (from +12, the same timing), the theme switch moves to the logo row (`switchShift` 0 to 1 over 240 `ease`). From step 6: Start round leaves (to +12, 110 `ease`). Cleared pass fields: the dashes come back (opacity 0 to 1 over 140 `ease` after 220). A change of pass stage (destination for steps 2 and 3, route for 4 and 5, ready for 6): the old block fades out over 120 `ease-out`, the new one in over 220 `ease` after 90, the paper and band morph over 360 `ease`, the old value copy is gone by 60 percent and the new one comes in from 40 percent (linear).
   - Reduced motion, `durationMs = 90 + 140 = 230`. Nothing moves. The old step and the leaving zones fade out over 100, the new step and the entering zones fade in over 140 after 90 (`ease-out`, the default easing of the web's native opacity animations, which name none). The parts the web switches at once (the theme switch, the pass morph, the dashes) switch when the old step has faded out, at t = 100, so p = 0 is still the old step at rest and a cancelled gesture shows no jump. No value copy travels.
   - p outside 0 to 1, and NaN, are clamped (NaN to 0). A back must go to an earlier step and a step has at least its title. `itemCount` (the new step's title plus its rendered options) has no default: every caller passes it.
5. **The round** (`PlayScreen.tsx:470-620`, `useRound.ts:169-197`, `useClock.ts`, `leave.ts`, `ResultView.tsx:50-125`, `LeaveDialog.tsx:55-63, 132-134`):
   - Dealing: find the route, decode its deck, prune that deck's history and save (`update`), take the pool, deal with a fresh seed, compute the ticket with the best before the round. A route that no longer resolves, or an empty pool, goes back to step 1; a deck that cannot be decoded shows the load failure with Try again.
   - An answer needs the question phase, no open sheet and 250 ms since the card appeared. Only the first accepted answer to a card starts its Next guard. Next card and See results need 420 ms since that answer, or since time ran out in Timed, and no open sheet.
   - The X (and Escape) with no answers leaves at once; otherwise it opens the sheet once. `scrimTapAccepted()` is true from 250 ms after the sheet opened (always computed, unit tested). An X or Escape that reaches the round while the sheet is already open is where the second tap of a double tap on the X lands on Android (80 ms after the first, the sheet's window is not up yet; on the web the scrim covers the X there): it keeps playing only once `scrimTapAccepted()` is true. Back on the sheet keeps playing at once, and Keep playing never waits. Whether the sheet's own scrim consults the guard is task 14's and task 15's (spec 5.4).
   - Journal: after every change of the number of answers or of `isDecided`, the coordinator hands `journalEntry(state, seed, roundId)` to the writer. A Timed minute that runs out with no answers is journalled as decided.
   - Result: when the round finishes (`next` on a decided round) it is recorded exactly once: `update { recordRound(round, it).progress }`, then `journal.record(... recorded = true)`, then `journal.clear()` (task 9's order). The outcome is published after the write; the 1000 ms guard of the result's actions counts from then.
   - Leave: before the result, the round is marked abandoned on screen, then `update { saveLeftRound(round, it) }` runs only when `leavesSomething(round)` (answers, or decided), then the journal is cleared. On the result, leave waits for the record and writes nothing more.
   - Timed: at the start a `Tick(now)` arms the clock (a round dealt while the app is stopped is first hidden); a coroutine sends `Tick(wall.nowMs())` every 100 ms (`TICK_MS`, `useRound.ts:17`) until time is up. `onStop` sends `Visibility(hidden = true)` and stops the ticker; `onStart` sends `Visibility(hidden = false)` and restarts it. Nothing else pauses the clock: not the sheet, not a configuration change (`MainActivity` skips `onStop` while `isChangingConfigurations`).
6. **Back on the round** (spec D4 and 5.2): while loading or after a load failure it leaves at once; with the sheet open it keeps playing; on the result it does what Close results does and is ignored for its first 1000 ms; otherwise it does what the X does.
7. **Process death** (spec 4.5 and 5.6, Review Focus 2): at every launch the controller first applies a pending journal with task 9's `applyJournal` inside the writer, then loads the catalog (with the start-screen prune of every played deck, saving only when the number of entries changed), then shows step 1 with no choices. Nothing is restored from saved state: `AppViewModel` keeps no `SavedStateHandle`, so a new process starts at step 1.
8. **Theme** (`theme.ts:36-47, 104-113`, Review Focus 3): the visible theme is `resolvedTheme(stored, systemDark)`. The switch flips the visible theme (`switchTheme`), stores it, and flips even when the store throws. `MainActivity` stores a debug theme, then calls `bootTheme` before `setContent`, and re-applies the window and the night mode whenever the resolved theme changes; a configuration change of `uiMode` updates `systemDark`.

**Review focus owned here:** Review Focus 2 (the app killed in the middle of a round): `AppControllerTest` launches over a journal in each of the four leave states and checks the saved progress, the deleted journal and start step 1; `RoundCoordinatorTest` checks that every answer, and a Timed minute running out, reaches the journal; step 37 kills the app on the emulator (`am kill`, and "Don't keep activities"). Review Focus 3 (stored theme opposite to the system): `AppControllerTest` pins the resolution and the flip, `MainActivity` boots the theme before the first frame, step 37 looks at the first frame; task 15 owns the bar and splash checks (N12). Review Focus 1 (back): `BackTransitionTest` pins B at fixed progress values and the final frame `frame(1f)` that an instant commit shows; task 12 tests the handler path on API levels below 34.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
cd android/Truthy
ls app/src/main/java/com/eienmosu/truthy app/src/main/kotlin/com/eienmosu/truthy app/src/test/kotlin/com/eienmosu/truthy/support
for name in 'fun switchTheme' 'fun startRound' 'fun reduce' 'fun currentCard' 'fun isDecided' 'val TIMED' 'val SWIPE' 'class LastRound' 'class ApplyOutcome' 'fun recordKey' 'fun bestFor' 'fun pruneDeck' 'fun findRoute' 'fun poolFor' 'enum class Step' 'const val RECENT' 'class StartChoice' 'enum class PassFieldName' 'fun clearFrom' 'fun pathTo' 'fun previousStep' 'fun chosenOn' 'class RecentDeck' 'fun decksWithHistory' 'fun withoutRemovedCards' 'fun continueTarget' 'fun recentDecks' 'NEXT_ARRIVES_MS' 'RESULT_ARRIVES_MS' 'fun leavesSomething' 'fun saveLeftRound' 'fun recordRound' 'class TicketInfo' 'fun ticketFor' 'class DeckStore' 'interface ProgressStore' 'fun update' 'class FileProgressStore' 'class RoundJournal' 'fun journalEntry' 'fun applyJournal' 'typealias StoredTheme' 'class ThemeStore' 'PREFS_NAME' 'fun resolvedTheme' 'fun bootTheme' 'fun applyWindowTheme' 'fun applyStoredNightMode' 'fun isNightUiMode' 'fun TruthyTheme' 'const val ROOT_TAG' 'fun repositoryDeckStore' 'fun nativeDecksDir' 'fun newTempDir' 'const val T0'; do
  grep -rqF "$name" engine/src/main/kotlin app/src/main app/src/test || echo "missing: $name"
done; echo "names checked"
grep -rn 'TruthyRoot(' app/src | grep -v 'fun TruthyRoot'
grep -o 'android:configChanges="[^"]*"' app/src/main/AndroidManifest.xml
./gradlew -q :app:dependencies --configuration debugUnitTestRuntimeClasspath | grep -oE '(org\.jetbrains\.kotlinx:kotlinx-coroutines-test|androidx\.lifecycle:lifecycle-viewmodel|org\.jetbrains\.kotlin:kotlin-test):[^ ]*' | sed 's/:[^:]*$//' | sort -u
cd ../..
```

Expected:
- `git status --short` prints nothing.
- The `ls` shows task 7's `MainActivity.kt`, `SystemBars.kt`, `TruthyRoot.kt`, `StorageNames.kt` under `java`, task 8's `design` folder and task 9's stores under `kotlin`, and task 9's `TestData.kt` and `MemoryPrefs.kt` under the test support folder.
- The loop prints only `names checked`. A `missing:` line means an earlier task named something differently: read its source, use its name in this task's code and tests, and note the difference in your report. If `applyJournal` or `journalEntry` is missing, stop: task 9 is not in place.
- The `TruthyRoot(` grep prints only the call in `MainActivity.kt` (any other caller, for example a debug gallery of task 10, must be changed to pass the `AppViewModel` in step 34).
- The manifest grep prints a value that contains `uiMode` (task 8 added it). If there is none, stop and report: task 8 owns that line.
- The dependency check prints `androidx.lifecycle:lifecycle-viewmodel` and `org.jetbrains.kotlin:kotlin-test`, and, if task 9 or earlier added it, `org.jetbrains.kotlinx:kotlinx-coroutines-test`. Step 2 adds what is missing.

- [ ] **Step 2: Add the coroutine test library and the view model library to the build.**

The tests of this task use `runTest`, virtual time and `backgroundScope` from kotlinx-coroutines-test, at the version of the coroutines the app already resolves; the view model code uses `viewModelScope` and `viewModelFactory` from `androidx.lifecycle:lifecycle-viewmodel`, at the version the activity library already brings. Each line below does nothing when its entry is already there.

```bash
cd android/Truthy
CORO=$(./gradlew -q :app:dependencies --configuration debugRuntimeClasspath | grep -oE 'kotlinx-coroutines-core:[0-9][^ ]*( -> [0-9][^ ]*)?' | head -1 | grep -oE '[0-9][0-9.]*[0-9]$')
LIFE=$(./gradlew -q :app:dependencies --configuration debugRuntimeClasspath | grep -oE 'androidx.lifecycle:lifecycle-viewmodel:[0-9][^ ]*( -> [0-9][^ ]*)?' | head -1 | grep -oE '[0-9][0-9.]*[0-9]$')
echo "coroutines $CORO, lifecycle $LIFE"
grep -q 'org.jetbrains.kotlinx:kotlinx-coroutines-test"' gradle/libs.versions.toml || perl -0pi -e "s/^\[libraries\]\n/[libraries]\nkotlinx-coroutines-test = { module = \"org.jetbrains.kotlinx:kotlinx-coroutines-test\", version = \"$CORO\" }\n/m" gradle/libs.versions.toml
grep -q 'androidx.lifecycle:lifecycle-viewmodel"' gradle/libs.versions.toml || perl -0pi -e "s/^\[libraries\]\n/[libraries]\nlifecycle-viewmodel = { module = \"androidx.lifecycle:lifecycle-viewmodel\", version = \"$LIFE\" }\n/m" gradle/libs.versions.toml
grep -n 'kotlinx-coroutines-test\|lifecycle-viewmodel' gradle/libs.versions.toml
```

Expected: `coroutines 1.11.0, lifecycle 2.11.0` (or the versions task 1 pinned; both must be non-empty), then one catalog line for each module. If a module was already in the catalog under another alias, the `grep -n` line shows that alias: use it in place of `kotlinx.coroutines.test` or `lifecycle.viewmodel` in the next two lines.

```bash
grep -q 'libs.kotlinx.coroutines.test)' app/build.gradle.kts || perl -0pi -e 's/^dependencies \{\n/dependencies {\n    testImplementation(libs.kotlinx.coroutines.test)\n/m' app/build.gradle.kts
grep -q 'libs.lifecycle.viewmodel)' app/build.gradle.kts || perl -0pi -e 's/^dependencies \{\n/dependencies {\n    implementation(libs.lifecycle.viewmodel)\n/m' app/build.gradle.kts
./gradlew -q :app:dependencies --configuration debugUnitTestRuntimeClasspath | grep -oE '(org\.jetbrains\.kotlinx:kotlinx-coroutines-test|androidx\.lifecycle:lifecycle-viewmodel):[^ ]*' | sed 's/:[^:]*$//' | sort -u
cd ../..
```

Expected: the two module names, `androidx.lifecycle:lifecycle-viewmodel` and `org.jetbrains.kotlinx:kotlinx-coroutines-test`.

The activity reads the debug extras behind `BuildConfig.DEBUG` (step 34), so the app needs its `BuildConfig` class (AGP 9 does not generate it by default). Add it inside `android { }`, next to task 7's `buildFeatures { compose = true }`:

```bash
cd android/Truthy
grep -q 'buildConfig = true' app/build.gradle.kts || perl -0pi -e 's/(    buildFeatures \{\n        compose = true\n)/$1        buildConfig = true\n/' app/build.gradle.kts
grep -n -A 3 'buildFeatures {' app/build.gradle.kts
cd ../..
```

Expected: the `buildFeatures` block holds `compose = true` and `buildConfig = true`. These two files are committed with step 7.

- [ ] **Step 3: Write the writer's tests (they fail: no writer yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/SerialWriterTest.kt`:

```kotlin
package com.eienmosu.truthy

import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.yield
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class SerialWriterTest {
    @Test
    fun jobsRunOneAfterAnotherInTheOrderTheyCame() = runTest {
        val writer = SerialWriter(backgroundScope)
        val log = mutableListOf<String>()
        writer.submit {
            log += "a1"
            yield()
            log += "a2"
        }
        writer.submit { log += "b" }
        assertEquals("c", writer.run { log += "c"; "c" })
        assertEquals(listOf("a1", "a2", "b", "c"), log)
    }

    @Test
    fun aFailingJobDoesNotStopTheWriter() = runTest {
        val writer = SerialWriter(backgroundScope)
        writer.submit { throw IllegalStateException("the disk is full") }
        assertEquals(2, writer.run { 2 })
    }

    @Test
    fun runThrowsTheFailureOfItsOwnBlockOnly() = runTest {
        val writer = SerialWriter(backgroundScope)
        assertFailsWith<IllegalStateException> { writer.run<Int> { throw IllegalStateException("refused") } }
        assertEquals(3, writer.run { 3 })
    }
}
```

- [ ] **Step 4: Run them and see them fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.SerialWriterTest')
```

Expected: `BUILD FAILED`, with `Unresolved reference 'SerialWriter'` from `:app:compileDebugUnitTestKotlin`.

- [ ] **Step 5: Write the clocks and the writer.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/Clocks.kt`:

```kotlin
package com.eienmosu.truthy

import android.os.SystemClock
import java.security.SecureRandom
import java.util.UUID

/**
 * Epoch milliseconds, whole numbers as the web's Date.now() gives them (reference 3.3, "Which clock"): answer times,
 * lastSeenAt, Timed ticks and visibility events. Never mixed with the monotonic clock.
 */
fun interface WallClock {
    fun nowMs(): Double
}

/**
 * SystemClock.uptimeMillis, the base of MotionEvent.eventTime and PointerInputChange.uptimeMillis (reference 7.3), for
 * the guards (250, 420, 1000) and the swipe's card-shown time. Not elapsedRealtime, which has another base.
 */
fun interface MonotonicClock {
    fun nowMs(): Double
}

object SystemWallClock : WallClock {
    override fun nowMs(): Double = System.currentTimeMillis().toDouble()
}

object SystemMonotonicClock : MonotonicClock {
    override fun nowMs(): Double = SystemClock.uptimeMillis().toDouble()
}

private val seedSource = SecureRandom()

/** A random unsigned 32-bit seed, as the web's crypto.getRandomValues(new Uint32Array(1)) (reference 7.1). */
fun secureSeed(): Long = seedSource.nextInt().toLong() and 0xFFFFFFFFL

/** The id that tells one round's journal from another's. */
fun newRoundId(): String = UUID.randomUUID().toString()
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/SerialWriter.kt`:

```kotlin
package com.eienmosu.truthy

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.completeWith
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * The app's one writer (spec 4.5): every progress change and every journal write and delete runs here, one after
 * another, in the order it was handed in. The app keeps it in a process-wide scope (AppGraph), so a write handed in
 * just before the activity goes away still lands before the next launch reads the journal. A failing write is
 * dropped: a storage failure never reaches the player, and the next write starts from what is stored.
 */
class SerialWriter(scope: CoroutineScope) {
    private val jobs = Channel<suspend () -> Unit>(Channel.UNLIMITED)

    init {
        scope.launch {
            for (job in jobs) {
                try {
                    job()
                } catch (e: Exception) {
                    if (e is CancellationException && !isActive) throw e
                }
            }
        }
    }

    /** Hands in a write and returns at once. */
    fun submit(block: suspend () -> Unit) {
        jobs.trySend(block)
    }

    /** Hands in a block, waits for its turn and returns its result; a failure of this block is thrown here. */
    suspend fun <T> run(block: suspend () -> T): T {
        val done = CompletableDeferred<T>()
        jobs.trySend { done.completeWith(runCatching { block() }) }
        return done.await()
    }
}
```

- [ ] **Step 6: Run the writer's tests green.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.SerialWriterTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.SerialWriterTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="3" skipped="0" failures="0"`.

- [ ] **Step 7: Commit.**

```bash
git add android/Truthy/gradle/libs.versions.toml android/Truthy/app/build.gradle.kts android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/Clocks.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/SerialWriter.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/SerialWriterTest.kt
git commit -m "feat: add the two clocks, the round seed and the app's one serial writer"
git status --short
```

Expected: one commit; `git status --short` prints nothing (if step 2 changed neither build file, `git add` of an unchanged file adds nothing).

- [ ] **Step 8: Write the back motion's tests (they fail: no `BackTransition` yet).**

The expected curve values were computed from the cubic-bezier definitions of `ease` (0.2, 0.7, 0.2, 1) and `ease-out` (0, 0, 0.58, 1) by bisection; the tolerance of 0.01 covers the error bound of Compose's `CubicBezierEasing` solver and still tells every window apart.

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/BackTransitionTest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.Step
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BackTransitionTest {
    private val tol = 0.01f

    // ease(x) and ease-out(x) at the fractions the frames below fall on.
    private val easeOutAt85of140 = 0.791763f
    private val easeAt145of240 = 0.962277f
    private val easeAtHalf = 0.929579f
    private val easeAt70of240 = 0.783114f
    private val easeAtQuarter = 0.727373f
    private val easeAtThreeQuarters = 0.987468f
    private val easeAt90of220 = 0.884209f
    private val easeOutAt575 = 0.761353f
    private val easeOutAt25of140 = 0.277632f

    private fun assertLayer(alpha: Float, offsetY: Float, layer: BackLayer, what: String) {
        assertEquals(alpha, layer.alpha, tol, "$what: alpha")
        assertEquals(offsetY, layer.offsetY, tol, "$what: offset")
    }

    @Test
    fun theDurationCoversTheLastItemAndThePass() {
        assertEquals(360, BackTransition(Step.TWO, Step.ONE, 1).durationMs(reducedMotion = false))
        assertEquals(375, BackTransition(Step.THREE, Step.TWO, itemCount = 2).durationMs(reducedMotion = false))
        assertEquals(425, BackTransition(Step.THREE, Step.TWO, itemCount = 4).durationMs(reducedMotion = false))
        assertEquals(230, BackTransition(Step.THREE, Step.TWO, itemCount = 4).durationMs(reducedMotion = true))
    }

    @Test
    fun progressZeroIsTheStepBeingLeftAtRest() {
        for (reduced in listOf(false, true)) {
            val frame = BackTransition(Step.THREE, Step.TWO, itemCount = 4).frame(0f, reduced)
            assertLayer(1f, 0f, frame.oldPanel, "old panel, reduced $reduced")
            assertEquals(1f, frame.oldTitleAlpha, tol)
            for (i in 0 until 4) assertEquals(0f, frame.newItem(i).alpha, tol, "item $i, reduced $reduced")
            assertEquals(0f, frame.dashAlpha, tol)
        }
        assertLayer(0f, -24f, BackTransition(Step.THREE, Step.TWO, 1).frame(0f, false).newItem(0), "title above its place")
    }

    @Test
    fun progressOneIsTheNewStepAtRestTheFrameAnInstantCommitShows() {
        for (reduced in listOf(false, true)) {
            val frame = BackTransition(Step.SIX, Step.ONE, itemCount = 5).frame(1f, reduced)
            val sink = if (reduced) 0f else 10f
            val shift = if (reduced) 0f else 12f
            assertLayer(0f, sink, frame.oldPanel, "old panel, reduced $reduced")
            for (i in 0 until 5) assertLayer(1f, 0f, frame.newItem(i), "item $i, reduced $reduced")
            assertLayer(0f, shift, frame.tripOut, "pass and Back pill, reduced $reduced")
            assertLayer(1f, 0f, frame.brandIn, "logo, reduced $reduced")
            assertLayer(1f, 0f, frame.footIn, "continue line, reduced $reduced")
            assertLayer(0f, shift, frame.footOut, "Start round, reduced $reduced")
            assertEquals(1f, frame.switchShift, tol)
            assertEquals(1f, frame.dashAlpha, tol)
        }
    }

    @Test
    fun theBackMotionFollowsTheWebTimeline() {
        val transition = BackTransition(Step.THREE, Step.TWO, itemCount = 4)
        val early = transition.frame(0.2f, reducedMotion = false)
        assertEquals(85f, early.timeMs, 0.01f)
        assertLayer(1f - easeOutAt85of140, 10f * easeOutAt85of140, early.oldPanel, "old panel at 85")
        assertEquals(0f, early.oldTitleAlpha, tol)
        assertLayer(0f, -24f, early.newItem(0), "title at 85")
        val later = transition.frame(0.6f, reducedMotion = false)
        assertLayer(0f, 10f, later.oldPanel, "old panel at 255")
        assertLayer(easeAt145of240, -24f * (1f - easeAt145of240), later.newItem(0), "title at 255")
        assertLayer(easeAtHalf, -24f * (1f - easeAtHalf), later.newItem(1), "item 1 at 255")
        assertLayer(easeAt70of240, -24f * (1f - easeAt70of240), later.newItem(3), "item 3 at 255")
        assertLayer(easeAt70of240, -24f * (1f - easeAt70of240), later.newItem(9), "an index past the last item is the last item")
        assertEquals(easeAtQuarter, later.dashAlpha, tol)
        assertFalse(later.stageChange)
        assertFalse(later.topSwap)
    }

    @Test
    fun backToStepOneSwapsTheTopAndFootZonesAndMovesTheSwitch() {
        val frame = BackTransition(Step.TWO, Step.ONE, 1).frame(0.5f, reducedMotion = false)
        assertTrue(frame.topSwap)
        assertFalse(frame.stageChange)
        assertLayer(0f, 12f, frame.tripOut, "pass and Back pill at 180")
        assertLayer(easeAtQuarter, -12f * (1f - easeAtQuarter), frame.brandIn, "logo at 180")
        assertLayer(easeAtQuarter, 12f * (1f - easeAtQuarter), frame.footIn, "continue line at 180")
        assertEquals(easeAtThreeQuarters, frame.switchShift, tol)
    }

    @Test
    fun leavingTheReadyPassMorphsThePassAndDropsStartRound() {
        val transition = BackTransition(Step.SIX, Step.FIVE, 1)
        val frame = transition.frame(0.5f, reducedMotion = false)
        assertTrue(frame.stageChange)
        assertTrue(frame.valuesTravel)
        assertEquals(easeAtHalf, frame.morph, tol)
        assertEquals(0f, frame.oldBlockAlpha, tol)
        assertEquals(easeAt90of220, frame.newBlockAlpha, tol)
        assertEquals(1f / 6f, frame.oldValueAlpha, tol)
        assertEquals(1f / 6f, frame.newValueAlpha, tol)
        val start = transition.frame(55f / 360f, reducedMotion = false)
        assertLayer(1f - easeAtHalf, 12f * easeAtHalf, start.footOut, "Start round at 55")
    }

    @Test
    fun reducedMotionIsTheCrossFadeMappedOntoProgress() {
        val transition = BackTransition(Step.THREE, Step.TWO, itemCount = 4)
        val early = transition.frame(0.25f, reducedMotion = true)
        assertLayer(1f - easeOutAt575, 0f, early.oldPanel, "old panel at 57.5")
        assertEquals(1f, early.oldTitleAlpha, tol)
        for (i in 0 until 4) assertLayer(0f, 0f, early.newItem(i), "item $i at 57.5")
        assertEquals(0f, early.dashAlpha, tol)
        val mid = transition.frame(0.5f, reducedMotion = true)
        assertLayer(0f, 0f, mid.oldPanel, "old panel at 115")
        for (i in 0 until 4) assertLayer(easeOutAt25of140, 0f, mid.newItem(i), "item $i at 115")
        assertEquals(1f, mid.dashAlpha, tol)
        assertFalse(mid.valuesTravel)
        val toOne = BackTransition(Step.TWO, Step.ONE, 1)
        assertEquals(0f, toOne.frame(99f / 230f, reducedMotion = true).switchShift, tol)
        assertEquals(1f, toOne.frame(101f / 230f, reducedMotion = true).switchShift, tol)
    }

    @Test
    fun progressIsClampedAndABackMustGoBack() {
        val transition = BackTransition(Step.FOUR, Step.THREE, 1)
        assertEquals(transition.frame(0f, false), transition.frame(-0.5f, false))
        assertEquals(transition.frame(1f, false), transition.frame(1.5f, false))
        assertEquals(transition.frame(0f, false), transition.frame(Float.NaN, false))
        assertFailsWith<IllegalArgumentException> { BackTransition(Step.TWO, Step.TWO, 1) }
        assertFailsWith<IllegalArgumentException> { BackTransition(Step.TWO, Step.THREE, 1) }
        assertFailsWith<IllegalArgumentException> { BackTransition(Step.THREE, Step.TWO, itemCount = 0) }
    }
}
```

- [ ] **Step 9: Run them and see them fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.BackTransitionTest')
```

Expected: `BUILD FAILED`, with `Unresolved reference 'BackTransition'` and `Unresolved reference 'BackLayer'` from `:app:compileDebugUnitTestKotlin`.

- [ ] **Step 10: Write the back motion.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/BackTransition.kt`:

```kotlin
package com.eienmosu.truthy

import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.LinearEasing
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.engine.Step

/** Where a layer of the start flow is during a back: its opacity, and its vertical offset in dp (positive is down). */
data class BackLayer(val alpha: Float, val offsetY: Float)

/**
 * The web's back motion of the start flow (StartFlow.tsx:230-267, 815-822; FillInPass.tsx:131-132, 379-385;
 * passValueTravel.ts:104-113) as a pure function of progress p, so that predictive back can scrub it (spec 5.1).
 * Time is p times durationMs, linear; each part keeps its own easing inside its window. [itemCount] counts the new
 * step's items, its title included; the stagger of 25 per item sets how long the whole back takes.
 */
data class BackTransition(val from: Step, val to: Step, val itemCount: Int) {
    init {
        require(to < from) { "A back goes to an earlier step, not from $from to $to." }
        require(itemCount >= 1) { "A step has at least its title, not $itemCount items." }
    }

    fun durationMs(reducedMotion: Boolean): Int =
        if (reducedMotion) {
            REDUCED_IN_DELAY_MS + Tokens.Duration.reducedIn
        } else {
            maxOf(
                Tokens.Duration.t3,
                Tokens.Duration.stepEnterDelay + Tokens.Duration.stepStagger * (itemCount - 1) + Tokens.Duration.stepEnter,
            )
        }

    fun frame(p: Float, reducedMotion: Boolean): BackFrame {
        val progress = if (p.isNaN()) 0f else p.coerceIn(0f, 1f)
        return BackFrame(this, progress * durationMs(reducedMotion), reducedMotion)
    }

    companion object {
        /** The leaving panel sinks 10 on the way back (StartFlow.tsx PANEL.gone: y = -10 * dir). */
        const val PANEL_SINK_DP = 10f

        /** The new step's items drop in from 24 above on the way back (StartFlow.tsx ITEM.hidden: y = 24 * dir). */
        const val ITEM_DROP_DP = 24f

        /** The top and foot zones move 12 as they swap (StartFlow.tsx swapMotion). */
        const val ZONE_SHIFT_DP = 12f

        /** Reduced motion: the new step fades in after 90 (StartFlow.tsx PANEL_REDUCED, 230 = 90 + 140). */
        const val REDUCED_IN_DELAY_MS = 90

        /** The pass's new block fades in after 90 (FillInPass.tsx BLOCK_IN). */
        const val BLOCK_IN_DELAY_MS = 90

        /** The old value copy is gone by 60 percent of the morph, the new one comes in from 40 percent (passValueTravel.ts). */
        const val VALUE_OUT_END = 0.6f
        const val VALUE_IN_START = 0.4f
    }
}

/** One frame of a [BackTransition], [timeMs] into it. */
data class BackFrame(val transition: BackTransition, val timeMs: Float, val reducedMotion: Boolean) {
    /** The step being left: it fades out and sinks. Its title fades faster, inside it ([oldTitleAlpha] multiplies). */
    val oldPanel: BackLayer
        get() = if (reducedMotion) {
            BackLayer(1f - reducedOut(), 0f)
        } else {
            val f = window(0, Tokens.Duration.stepExit, Tokens.Curves.easeOut)
            BackLayer(1f - f, BackTransition.PANEL_SINK_DP * f)
        }

    val oldTitleAlpha: Float
        get() = if (reducedMotion) 1f else 1f - window(0, Tokens.Duration.stepExitTitle, Tokens.Curves.easeOut)

    /** Item [index] of the new step (0 is its title); an index past the last item moves with the last one. */
    fun newItem(index: Int): BackLayer {
        if (reducedMotion) return BackLayer(reducedIn(), 0f)
        val i = index.coerceIn(0, transition.itemCount - 1)
        val f = window(Tokens.Duration.stepEnterDelay + Tokens.Duration.stepStagger * i, Tokens.Duration.stepEnter, Tokens.Curves.ease)
        return BackLayer(f, -BackTransition.ITEM_DROP_DP * (1f - f))
    }

    /** Back to step 1: the pass and the Back pill leave, the logo and the tagline come in. */
    val topSwap: Boolean get() = transition.to == Step.ONE
    val tripOut: BackLayer get() = zoneOut()
    val brandIn: BackLayer get() = zoneIn(-BackTransition.ZONE_SHIFT_DP)

    /** How far the theme switch has moved from the Back pill row to the logo row, 0 to 1 (back to step 1 only). */
    val switchShift: Float
        get() = when {
            !topSwap -> 0f
            reducedMotion -> snap()
            else -> window(0, Tokens.Duration.stepEnter, Tokens.Curves.ease)
        }

    /** Start round leaving (a back from step 6) and the continue line coming in (a back to step 1, when it shows). */
    val footOut: BackLayer get() = zoneOut()
    val footIn: BackLayer get() = zoneIn(BackTransition.ZONE_SHIFT_DP)

    /** The dashes of the pass fields this back clears. */
    val dashAlpha: Float
        get() = if (reducedMotion) snap() else window(Tokens.Duration.t3 - Tokens.Duration.dashIn, Tokens.Duration.dashIn, Tokens.Curves.ease)

    /** The pass changes stage (destination, route, ready) and stays on screen. */
    val stageChange: Boolean get() = transition.to != Step.ONE && stageOf(transition.from) != stageOf(transition.to)

    val oldBlockAlpha: Float
        get() = 1f - if (reducedMotion) reducedOut() else window(0, Tokens.Duration.t1, Tokens.Curves.easeOut)

    val newBlockAlpha: Float
        get() = if (reducedMotion) reducedIn() else window(BackTransition.BLOCK_IN_DELAY_MS, Tokens.Duration.t2, Tokens.Curves.ease)

    /** The paper's height and the band's height, from the old stage (0) to the new one (1). */
    val morph: Float
        get() = if (reducedMotion) snap() else window(0, Tokens.Duration.t3, Tokens.Curves.ease)

    /** Whether the values travel as two cross-fading copies; under reduced motion the blocks carry them. */
    val valuesTravel: Boolean get() = !reducedMotion

    val oldValueAlpha: Float
        get() = if (reducedMotion) 0f else 1f - windowOf(0f, Tokens.Duration.t3 * BackTransition.VALUE_OUT_END, LinearEasing)

    val newValueAlpha: Float
        get() = if (reducedMotion) {
            1f
        } else {
            windowOf(
                Tokens.Duration.t3 * BackTransition.VALUE_IN_START,
                Tokens.Duration.t3 * (1f - BackTransition.VALUE_IN_START),
                LinearEasing,
            )
        }

    private fun window(delayMs: Int, durationMs: Int, easing: Easing): Float =
        windowOf(delayMs.toFloat(), durationMs.toFloat(), easing)

    private fun windowOf(delayMs: Float, durationMs: Float, easing: Easing): Float {
        val f = (timeMs - delayMs) / durationMs
        return when {
            f <= 0f -> 0f
            f >= 1f -> 1f
            else -> easing.transform(f)
        }
    }

    // Reduced motion: out over 100, in over 140 after 90, with the web's default opacity easing (ease-out).
    private fun reducedOut(): Float = window(0, Tokens.Duration.reducedOut, Tokens.Curves.easeOut)

    private fun reducedIn(): Float = window(BackTransition.REDUCED_IN_DELAY_MS, Tokens.Duration.reducedIn, Tokens.Curves.easeOut)

    // What the web switches at once under reduced motion switches when the old step has faded out.
    private fun snap(): Float = if (timeMs >= Tokens.Duration.reducedOut.toFloat()) 1f else 0f

    private fun zoneOut(): BackLayer =
        if (reducedMotion) {
            BackLayer(1f - reducedOut(), 0f)
        } else {
            val f = window(0, Tokens.Duration.topExit, Tokens.Curves.ease)
            BackLayer(1f - f, BackTransition.ZONE_SHIFT_DP * f)
        }

    private fun zoneIn(fromOffset: Float): BackLayer =
        if (reducedMotion) {
            BackLayer(reducedIn(), 0f)
        } else {
            val f = window(Tokens.Duration.topEnterDelay, Tokens.Duration.stepEnter, Tokens.Curves.ease)
            BackLayer(f, fromOffset * (1f - f))
        }

    private fun stageOf(step: Step): Int = when (step) {
        Step.ONE -> 0
        Step.TWO, Step.THREE -> 1
        Step.FOUR, Step.FIVE -> 2
        Step.SIX -> 3
    }
}
```

- [ ] **Step 11: Run the back motion's tests green.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.BackTransitionTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.BackTransitionTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="8" skipped="0" failures="0"`. A curve value off by more than 0.01 means the easing token differs from reference 5.7 (check `Tokens.Curves` against `resolved.json`), never a reason to widen the tolerance.

- [ ] **Step 12: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/BackTransition.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/BackTransitionTest.kt
git commit -m "feat: write the start flow's back motion as a pure function of progress"
```

- [ ] **Step 13: Write the shared fakes and the start flow's tests (they fail: no `StartFlowModel` yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/support/StateFakes.kt`:

```kotlin
package com.eienmosu.truthy.support

import com.eienmosu.truthy.DeckStore
import com.eienmosu.truthy.MonotonicClock
import com.eienmosu.truthy.ProgressStore
import com.eienmosu.truthy.WallClock
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.emptyProgress
import kotlinx.coroutines.CoroutineDispatcher
import java.io.File

// Two shipped decks the state tests use: one with sections (CON, SEC, TEC, BIL), one without.
const val CLF = "aws-clf-c02"
const val CDL = "gcp-cdl"

/** A clock the test sets by hand; one instance plays the wall clock, another the monotonic one. */
class FakeClock(var now: Double) : WallClock, MonotonicClock {
    override fun nowMs(): Double = now
}

/** Progress in memory; update is the interface's default (load, then save). */
class MemoryProgressStore(var stored: Progress = emptyProgress()) : ProgressStore {
    var saves = 0
        private set

    override suspend fun load(): Progress = stored

    override suspend fun save(progress: Progress) {
        stored = progress
        saves += 1
    }
}

/** The stored theme, and whether storing it fails. */
class ThemeBox(var value: Theme? = null, val fails: Boolean = false)

/** The real embedded decks, decoded on the test's own dispatcher so virtual time covers them. */
fun testDeckStore(io: CoroutineDispatcher): DeckStore =
    DeckStore(open = { name -> File(nativeDecksDir(), name).inputStream() }, io = io)
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/StartFlowModelTest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.CardHistory
import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.RECENT
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.StartChoice
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.WHOLE_DECK
import com.eienmosu.truthy.engine.chosenOn
import com.eienmosu.truthy.engine.emptyProgress
import com.eienmosu.truthy.engine.recentDecks
import com.eienmosu.truthy.support.CDL
import com.eienmosu.truthy.support.CLF
import com.eienmosu.truthy.support.FakeClock
import com.eienmosu.truthy.support.T0
import com.eienmosu.truthy.support.repositoryDeckStore
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class StartFlowModelTest {
    private val decks = repositoryDeckStore()
    private val index = decks.index()
    private val clock = FakeClock(10_000.0)
    private val flow = StartFlowModel(clock)

    private val cloud get() = index.areas.first { it.id == "cloud" }
    private fun platform(id: String) = cloud.platforms.first { it.id == id }
    private fun deck(platformId: String, deckId: String) = platform(platformId).decks.first { it.id == deckId }

    private fun show(progress: Progress = emptyProgress()) {
        flow.showCatalog(Catalog(index, progress, emptyMap(), recentDecks(index, progress)))
    }

    private fun settle() {
        clock.now += 250.0
    }

    private val all = listOf(Step.ONE, Step.TWO, Step.THREE, Step.FOUR, Step.FIVE, Step.SIX)

    @Test
    fun optionsWaitTheSettleTimeOfTheirStep() {
        clock.now = 20_000.0
        show()
        clock.now += 249.0
        assertFalse(flow.chooseArea(cloud))
        assertFalse(flow.continueLast())
        assertEquals(Step.ONE, flow.step)
        clock.now += 1.0
        assertTrue(flow.chooseArea(cloud))
        assertFalse(flow.choosePlatform(platform("aws")), "the new step's options wait their own settle time")
        assertEquals(Step.TWO, flow.step)
        assertEquals(StartChoice(areaId = "cloud"), flow.choice.value)
        assertEquals(PassFieldName.AREA, flow.view.value.travel)
        assertEquals(Direction.FORWARD, flow.view.value.dir)
    }

    @Test
    fun aDeckWithSectionsWalksAllSixStepsAndBackRetracesThemWithoutWaiting() {
        show(); settle()
        assertTrue(flow.chooseArea(cloud)); settle()
        assertTrue(flow.choosePlatform(platform("aws"))); settle()
        assertTrue(flow.chooseDeck(deck("aws", CLF))); settle()
        assertEquals(Step.FOUR, flow.step)
        assertTrue(flow.chooseSection("SEC")); settle()
        assertTrue(flow.chooseMode(Mode.CLASSIC))
        assertEquals(all, flow.stack.value)
        val before = flow.choice.value
        assertEquals(StartChoice(areaId = "cloud", platformId = "aws", deckId = CLF, sectionId = "SEC", mode = Mode.CLASSIC), before)
        assertEquals(PassFieldName.MODE, flow.view.value.travel)
        assertEquals(Step.FIVE, flow.previous())
        assertTrue(flow.back(), "a back does not wait for the settle time")
        assertEquals(Step.FIVE, flow.step)
        assertEquals(before.copy(mode = null), flow.choice.value)
        assertEquals(Direction.BACK, flow.view.value.dir)
        assertEquals(chosenOn(Step.FIVE, before), flow.view.value.focusId)
        assertNull(flow.view.value.travel)
        assertEquals(all.take(5), flow.stack.value)
        assertTrue(flow.back(Step.TWO))
        assertEquals(StartChoice(areaId = "cloud"), flow.choice.value)
        assertEquals(listOf(Step.ONE, Step.TWO), flow.stack.value)
    }

    @Test
    fun aDeckWithoutSectionsSkipsTheSectionStep() {
        show(); settle()
        flow.chooseArea(cloud); settle()
        flow.choosePlatform(platform("gcp")); settle()
        assertTrue(flow.chooseDeck(deck("gcp", CDL)))
        assertEquals(Step.FIVE, flow.step)
        assertEquals(WHOLE_DECK, flow.choice.value.sectionId)
        assertEquals(listOf(Step.ONE, Step.TWO, Step.THREE, Step.FIVE), flow.stack.value)
        assertEquals(Step.THREE, flow.previous())
    }

    @Test
    fun stepOneHasNoWayBackSoBackGoesToTheSystem() {
        show()
        assertNull(flow.previous())
        assertFalse(flow.back())
        assertNull(flow.backTransition(1))
        assertEquals(listOf(Step.ONE), flow.stack.value)
    }

    @Test
    fun aBackThatHasNotCompletedChangesNothing() {
        show(); settle()
        flow.chooseArea(cloud); settle()
        flow.choosePlatform(platform("aws"))
        val view = flow.view.value
        val transition = assertNotNull(flow.backTransition(itemCount = 3))
        assertEquals(BackTransition(Step.THREE, Step.TWO, 3), transition)
        for (p in listOf(0f, 0.4f, 0.99f)) transition.frame(p, reducedMotion = false)
        assertEquals(view, flow.view.value)
        assertTrue(flow.back(transition.to))
        assertEquals(StartChoice(areaId = "cloud"), flow.choice.value)
    }

    @Test
    fun theRecentPathSkipsThePlatformAndChangePlatformOpensItsDeckStep() {
        val clfCard = runBlocking { decks.deck(CLF) }.cards.first().id
        val cdlCard = runBlocking { decks.deck(CDL) }.cards.first().id
        val progress = emptyProgress().copy(
            cards = mapOf(clfCard to CardHistory(1, true, T0), cdlCard to CardHistory(1, false, T0 + 1_000.0)),
        )
        show(progress); settle()
        assertTrue(flow.chooseRecent()); settle()
        assertEquals(StartChoice(via = RECENT), flow.choice.value)
        assertEquals(listOf(Step.ONE, Step.THREE), flow.stack.value)
        val recent = assertIs<CatalogState.Ready>(flow.catalog.value).catalog.recent
        assertEquals(listOf(CDL, CLF), recent.map { it.deck.id })
        assertTrue(flow.chooseRecentDeck(recent.first { it.deck.id == CLF }))
        assertEquals(StartChoice(via = RECENT, areaId = "cloud", platformId = "aws", deckId = CLF), flow.choice.value)
        assertEquals(listOf(Step.ONE, Step.THREE, Step.FOUR), flow.stack.value)
        assertEquals(Step.THREE, flow.previous())
        assertTrue(flow.jump(PassFieldName.PLATFORM))
        assertEquals(Step.THREE, flow.step)
        assertEquals(StartChoice(areaId = "cloud", platformId = "aws"), flow.choice.value)
        assertEquals(listOf(Step.ONE, Step.TWO, Step.THREE), flow.stack.value)
        assertEquals(CLF, flow.view.value.focusId)
        assertEquals(Direction.BACK, flow.view.value.dir)
    }

    @Test
    fun theHeaderHoldStopsTheBackPillAndThePassButNotEscape() {
        show(); settle()
        flow.chooseArea(cloud); settle()
        flow.choosePlatform(platform("aws"))
        flow.columnJumped()
        assertFalse(flow.tapBack())
        assertFalse(flow.jump(PassFieldName.AREA))
        assertEquals(Step.THREE, flow.step)
        clock.now += 250.0
        assertTrue(flow.tapBack())
        assertEquals(Step.TWO, flow.step)
        settle()
        flow.choosePlatform(platform("aws"))
        flow.columnJumped()
        assertTrue(flow.back(), "Escape and the gesture skip the hold")
        assertEquals(Step.TWO, flow.step)
    }

    @Test
    fun continueOpensTheReadyPassWithTheWholePathBehindIt() {
        val progress = emptyProgress().copy(last = LastRound(Route(CLF, "SEC"), Mode.STREAK, 4, 5))
        show(progress); settle()
        assertTrue(flow.continueLast())
        assertEquals(Step.SIX, flow.step)
        assertEquals(all, flow.stack.value)
        assertEquals(StartChoice(areaId = "cloud", platformId = "aws", deckId = CLF, sectionId = "SEC", mode = Mode.STREAK), flow.choice.value)
    }

    @Test
    fun startRoundBoardsOnceAndThenEveryWayBackIsConsumed() {
        show(emptyProgress().copy(last = LastRound(Route(CLF, "SEC"), Mode.STREAK, 4, 5))); settle()
        flow.continueLast()
        assertNull(flow.startRound(), "Start round waits the settle time too")
        settle()
        assertEquals(RoundRequest(Route(CLF, "SEC"), Mode.STREAK), flow.startRound())
        assertTrue(flow.boarding.value)
        assertNull(flow.startRound())
        assertFalse(flow.back())
        assertFalse(flow.jump(PassFieldName.DECK))
        settle()
        assertFalse(flow.chooseMode(Mode.CLASSIC))
        assertEquals(Step.SIX, flow.step)
    }

    @Test
    fun resetOpensStepOneWithNoChoices() {
        show(); settle()
        flow.chooseArea(cloud)
        flow.reset(fromRound = true)
        assertEquals(Step.ONE, flow.step)
        assertEquals(StartChoice(), flow.choice.value)
        assertEquals(listOf(Step.ONE), flow.stack.value)
        assertTrue(flow.view.value.fromRound)
        assertFalse(flow.boarding.value)
        assertEquals(CatalogState.Loading, flow.catalog.value)
        flow.arrivalFocusTaken()
        assertFalse(flow.view.value.fromRound)
    }
}
```

- [ ] **Step 14: Run them and see them fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.StartFlowModelTest')
```

Expected: `BUILD FAILED`, with `Unresolved reference 'StartFlowModel'` (and `Catalog`, `CatalogState`, `Direction`, `RoundRequest`) from `:app:compileDebugUnitTestKotlin`.

- [ ] **Step 15: Write the round request and the start flow model.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/RoundRequest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route

/** What Start round hands to the round (the web's pending round, truthy.pending.v1, kept in memory). */
data class RoundRequest(val route: Route, val mode: Mode)
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/StartFlowModel.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.IndexArea
import com.eienmosu.truthy.engine.IndexDeck
import com.eienmosu.truthy.engine.IndexPlatform
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.RECENT
import com.eienmosu.truthy.engine.RecentDeck
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.SWIPE
import com.eienmosu.truthy.engine.StartChoice
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.WHOLE_DECK
import com.eienmosu.truthy.engine.chosenOn
import com.eienmosu.truthy.engine.clearFrom
import com.eienmosu.truthy.engine.continueTarget
import com.eienmosu.truthy.engine.pathTo
import com.eienmosu.truthy.engine.previousStep
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class Direction { FORWARD, BACK }

/**
 * The start flow as the screen draws it. [focusId] names the card chosen before when the flow went back
 * (chosenOn); otherwise the step title takes focus. [travel] is the pass field the chosen name travels into.
 * [seq] counts step changes, the key of the step motion. [fromRound]: the flow was opened from the round by a
 * control, so the step 1 title takes focus once (reference 4.4).
 */
data class StartView(
    val step: Step,
    val choice: StartChoice,
    val dir: Direction,
    val focusId: String? = null,
    val travel: PassFieldName? = null,
    val seq: Int = 0,
    val fromRound: Boolean = false,
)

/** What the start flow shows: the index, the pruned progress, the card ids of the played decks, the recent decks. */
data class Catalog(
    val index: DeckIndex,
    val progress: Progress,
    val cardIds: Map<String, List<String>>,
    val recent: List<RecentDeck>,
)

sealed interface CatalogState {
    data object Loading : CatalogState
    data object Failed : CatalogState
    data class Ready(val catalog: Catalog) : CatalogState
}

/**
 * The start flow's state (StartFlow.tsx:392-700): one screen whose steps change in place, a step stack derived
 * from the path, the settle time of each step, the ways back and boarding. Pure state: the screen of task 12 draws it.
 */
class StartFlowModel(private val monotonic: MonotonicClock) {
    private val _view = MutableStateFlow(StartView(Step.ONE, StartChoice(), Direction.FORWARD))
    val view: StateFlow<StartView> = _view.asStateFlow()

    private val _stack = MutableStateFlow(listOf(Step.ONE))
    val stack: StateFlow<List<Step>> = _stack.asStateFlow()

    private val _choice = MutableStateFlow(StartChoice())
    val choice: StateFlow<StartChoice> = _choice.asStateFlow()

    private val _catalog = MutableStateFlow<CatalogState>(CatalogState.Loading)
    val catalog: StateFlow<CatalogState> = _catalog.asStateFlow()

    private val _boarding = MutableStateFlow(false)
    val boarding: StateFlow<Boolean> = _boarding.asStateFlow()

    // When the current step's options appeared, and until when the Back pill and the pass are held (monotonic).
    private var shownAt = Double.NEGATIVE_INFINITY
    private var headerHeldUntil = Double.NEGATIVE_INFINITY

    val step: Step get() = _view.value.step

    private val current: StartChoice get() = _view.value.choice
    private val onRecent: Boolean get() = current.via == RECENT
    private val ready: Catalog? get() = (_catalog.value as? CatalogState.Ready)?.catalog

    /** The catalog is loaded: step 1's options appear, so their settle time starts now. */
    fun showCatalog(catalog: Catalog) {
        _catalog.value = CatalogState.Ready(catalog)
        shownAt = monotonic.nowMs()
        _stack.value = stackOf(_view.value)
    }

    fun catalogLoading() {
        _catalog.value = CatalogState.Loading
    }

    fun catalogFailed() {
        _catalog.value = CatalogState.Failed
    }

    /** Step 1 with no choices, as after a round or a reload; the catalog is loaded again. */
    fun reset(fromRound: Boolean) {
        _catalog.value = CatalogState.Loading
        _boarding.value = false
        shownAt = Double.NEGATIVE_INFINITY
        headerHeldUntil = Double.NEGATIVE_INFINITY
        publish(StartView(Step.ONE, StartChoice(), Direction.FORWARD, fromRound = fromRound))
    }

    /** The step 1 title has taken focus after the arrival from the round. */
    fun arrivalFocusTaken() {
        val view = _view.value
        if (view.fromRound) _view.value = view.copy(fromRound = false)
    }

    /** Whether the current step's options, Continue and Start round take presses (250 ms after it appeared). */
    fun settled(): Boolean = monotonic.nowMs() - shownAt >= SWIPE.settleMs

    /** The web's forward(): to [step] with [choice]; [field] is where the chosen name travels. False while settling or boarding. */
    fun choose(step: Step, choice: StartChoice, field: PassFieldName? = null): Boolean {
        if (!settled() || _boarding.value) return false
        move(StartView(step, choice, Direction.FORWARD, travel = field, seq = _view.value.seq + 1))
        return true
    }

    fun chooseArea(area: IndexArea): Boolean = choose(Step.TWO, StartChoice(areaId = area.id), PassFieldName.AREA)

    fun chooseRecent(): Boolean = choose(Step.THREE, StartChoice(via = RECENT))

    fun choosePlatform(platform: IndexPlatform): Boolean =
        choose(Step.THREE, current.copy(platformId = platform.id), PassFieldName.PLATFORM)

    /** A deck card of step 3, added to [base] (the choices before it): to its sections, or to the classes for a deck without. */
    fun chooseDeck(deck: IndexDeck, base: StartChoice = current): Boolean =
        if (deck.sections.isNotEmpty()) {
            choose(Step.FOUR, base.copy(deckId = deck.id), PassFieldName.DECK)
        } else {
            choose(Step.FIVE, base.copy(deckId = deck.id, sectionId = WHOLE_DECK), PassFieldName.DECK)
        }

    /** A deck of the recent list: it fills the area, the platform and the deck at once. */
    fun chooseRecentDeck(recent: RecentDeck): Boolean =
        chooseDeck(recent.deck, StartChoice(via = RECENT, areaId = recent.area.id, platformId = recent.platform.id))

    fun chooseSection(sectionId: String): Boolean = choose(Step.FIVE, current.copy(sectionId = sectionId), PassFieldName.SECTION)

    fun chooseMode(mode: Mode): Boolean = choose(Step.SIX, current.copy(mode = mode), PassFieldName.MODE)

    /** The continue line: the ready pass of the last round, with every step of its path behind it. */
    fun continueLast(): Boolean {
        val catalog = ready ?: return false
        if (!settled() || _boarding.value) return false
        val target = continueTarget(catalog.index, catalog.progress) ?: return false
        val choice = StartChoice(
            areaId = target.found.area.id,
            platformId = target.found.platform.id,
            deckId = target.found.deck.id,
            sectionId = target.route.sectionId,
            mode = target.mode,
        )
        move(StartView(Step.SIX, choice, Direction.FORWARD, seq = _view.value.seq + 1))
        return true
    }

    /** The web's backTo(): never waits for the settle time; clears the target step and every later choice. */
    fun back(to: Step): Boolean {
        val view = _view.value
        if (to >= view.step || _boarding.value) return false
        move(StartView(to, clearFrom(view.choice, to), Direction.BACK, focusId = chosenOn(to, view.choice), seq = view.seq + 1))
        return true
    }

    /** One step back (Escape, a completed gesture); false on step 1 and while boarding. */
    fun back(): Boolean {
        val target = previous() ?: return false
        return back(target)
    }

    /** Where one step back leads, or null on step 1 (back then belongs to the system). */
    fun previous(): Step? = if (step == Step.ONE) null else previousStep(step, hasSections(current), onRecent)

    /** The motion of one step back from here, for the predictive back gesture. */
    fun backTransition(itemCount: Int): BackTransition? = previous()?.let { target -> BackTransition(step, target, itemCount) }

    /** The Back pill: held for 250 ms after the short-screen column jumped to its top. */
    fun tapBack(): Boolean = !headerHeld() && back()

    /** A filled pass field: back to its step; on the recent path the platform opens that platform's deck step. */
    fun jump(field: PassFieldName): Boolean {
        if (headerHeld()) return false
        return if (field == PassFieldName.PLATFORM && onRecent) toPlatformDecks() else back(stepOfField(field))
    }

    /** The short-screen column jumped to its top after a step change: the Back pill and the pass wait 250 ms. */
    fun columnJumped() {
        headerHeldUntil = monotonic.nowMs() + SWIPE.settleMs
    }

    /** Start round: the request once, then boarding until reset; null while settling or without a full pass. */
    fun startRound(): RoundRequest? {
        val choice = current
        val deckId = choice.deckId ?: return null
        val sectionId = choice.sectionId ?: return null
        val mode = choice.mode ?: return null
        if (_boarding.value || !settled()) return null
        _boarding.value = true
        return RoundRequest(Route(deckId, sectionId), mode)
    }

    /** Shows [step] with [choice] at once (debug launches only). */
    fun show(step: Step, choice: StartChoice) {
        move(StartView(step, choice, Direction.FORWARD, seq = _view.value.seq + 1))
    }

    private fun toPlatformDecks(): Boolean {
        val choice = current
        val areaId = choice.areaId
        val platformId = choice.platformId
        if (_boarding.value || areaId == null || platformId == null) return false
        move(
            StartView(
                Step.THREE,
                StartChoice(areaId = areaId, platformId = platformId),
                Direction.BACK,
                focusId = choice.deckId,
                seq = _view.value.seq + 1,
            ),
        )
        return true
    }

    private fun headerHeld(): Boolean = monotonic.nowMs() < headerHeldUntil

    private fun move(next: StartView) {
        publish(next)
        shownAt = monotonic.nowMs()
    }

    private fun publish(next: StartView) {
        _view.value = next
        _choice.value = next.choice
        _stack.value = stackOf(next)
    }

    private fun stackOf(view: StartView): List<Step> = pathTo(view.step, hasSections(view.choice), view.choice.via == RECENT)

    // The web's (r.deck?.sections.length ?? 1) > 0: a deck not chosen yet counts as one with sections.
    private fun hasSections(choice: StartChoice): Boolean {
        val index = ready?.index ?: return true
        val deck = index.areas.firstOrNull { it.id == choice.areaId }
            ?.platforms?.firstOrNull { it.id == choice.platformId }
            ?.decks?.firstOrNull { it.id == choice.deckId }
            ?: return true
        return deck.sections.isNotEmpty()
    }

    private fun stepOfField(field: PassFieldName): Step = when (field) {
        PassFieldName.AREA -> Step.ONE
        PassFieldName.PLATFORM -> Step.TWO
        PassFieldName.DECK -> Step.THREE
        PassFieldName.SECTION -> Step.FOUR
        PassFieldName.MODE -> Step.FIVE
    }
}
```

- [ ] **Step 16: Run the start flow's tests green.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.StartFlowModelTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.StartFlowModelTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="10" skipped="0" failures="0"`.

- [ ] **Step 17: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/RoundRequest.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/StartFlowModel.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/support/StateFakes.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/StartFlowModelTest.kt
git commit -m "feat: hold the start flow's steps, choices, settle time, ways back and boarding in a model"
```

- [ ] **Step 18: Write the debug extras' tests (they fail: no parser yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/DebugLaunchTest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.WHOLE_DECK
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class DebugLaunchTest {
    private fun parse(vararg extras: Pair<String, String>): DebugLaunch? {
        val map = mapOf(*extras)
        return parseDebugLaunch { key -> map[key] }
    }

    @Test
    fun noExtrasIsNoDebugLaunch() {
        assertNull(parse())
    }

    @Test
    fun everyExtraIsRead() {
        val launch = assertNotNull(
            parse(
                DebugLaunch.SEED to "4294967295",
                DebugLaunch.DECK to "aws-clf-c02",
                DebugLaunch.SECTION to "SEC",
                DebugLaunch.MODE to "timed",
                DebugLaunch.SCREEN to "sheet",
                DebugLaunch.THEME to "dark",
                DebugLaunch.STEP to "4",
            ),
        )
        assertEquals(DebugLaunch(4294967295L, Route("aws-clf-c02", "SEC"), Mode.TIMED, DebugScreen.LEAVE_SHEET, Theme.DARK, Step.FOUR), launch)
        assertEquals(RoundRequest(Route("aws-clf-c02", "SEC"), Mode.TIMED), launch.roundRequest())
    }

    @Test
    fun aDeckWithoutASectionIsTheWholeDeck() {
        assertEquals(Route("gcp-cdl", WHOLE_DECK), parse(DebugLaunch.DECK to "gcp-cdl")?.route)
        assertNull(parse(DebugLaunch.DECK to "gcp-cdl")?.roundRequest(), "a round needs a class too")
    }

    @Test
    fun valuesThatAreNotValidAreLeftOut() {
        val launch = assertNotNull(
            parse(
                DebugLaunch.SEED to "-1",
                DebugLaunch.MODE to "blitz",
                DebugLaunch.SCREEN to "menu",
                DebugLaunch.THEME to "sepia",
                DebugLaunch.STEP to "7",
                DebugLaunch.DECK to "aws-clf-c02",
            ),
        )
        assertNull(launch.seed)
        assertNull(launch.mode)
        assertNull(launch.screen)
        assertNull(launch.theme)
        assertNull(launch.step)
        assertNull(parse(DebugLaunch.SEED to "4294967296"), "a launch with nothing valid is no launch")
    }

    // adb's --el and Intent.putExtra(key, Long) store a Long, which getStringExtra would read as null.
    @Test
    fun aLongOrIntSeedExtraIsReadAsItsDigits() {
        assertEquals("1234567", extraText(1234567L))
        assertEquals("7", extraText(7))
        assertEquals("aws-clf-c02", extraText("aws-clf-c02"))
        assertNull(extraText(true))
        assertNull(extraText(null))
        val launch = parseDebugLaunch { key -> extraText(if (key == DebugLaunch.SEED) 1234567L else null) }
        assertEquals(1234567L, launch?.seed)
    }
}
```

- [ ] **Step 19: Run them and see them fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.DebugLaunchTest')
```

Expected: `BUILD FAILED`, with `Unresolved reference 'parseDebugLaunch'` (and `DebugLaunch`, `DebugScreen`) from `:app:compileDebugUnitTestKotlin`.

- [ ] **Step 20: Write the debug extras.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/DebugLaunch.kt`:

```kotlin
package com.eienmosu.truthy

import android.content.Context
import android.content.pm.ApplicationInfo
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.WHOLE_DECK

/** The screens a debug launch can open in a known state (spec 7.4). */
enum class DebugScreen(val wire: String) {
    START("start"),
    ROUND("round"),
    ANSWERED("answered"),
    LEAVE_SHEET("sheet"),
    RESULT("result"),
}

/**
 * A debug launch from intent extras (debug builds only): a fixed seed, a route and class, the screen to open, the
 * start step for [DebugScreen.START], and a theme to store first.
 */
data class DebugLaunch(
    val seed: Long?,
    val route: Route?,
    val mode: Mode?,
    val screen: DebugScreen?,
    val theme: StoredTheme?,
    val step: Step? = null,
) {
    fun roundRequest(): RoundRequest? {
        val chosenRoute = route ?: return null
        val chosenMode = mode ?: return null
        return RoundRequest(chosenRoute, chosenMode)
    }

    companion object {
        const val SEED = "truthy.seed"
        const val DECK = "truthy.deck"
        const val SECTION = "truthy.section"
        const val MODE = "truthy.mode"
        const val SCREEN = "truthy.screen"
        const val THEME = "truthy.theme"
        const val STEP = "truthy.step"
    }
}

/** Reads the extras through [extra]; a value that is not valid is left out, and no valid value at all is no launch. */
fun parseDebugLaunch(extra: (String) -> String?): DebugLaunch? {
    val seed = extra(DebugLaunch.SEED)?.toLongOrNull()?.takeIf { it in 0L..0xFFFFFFFFL }
    val deck = extra(DebugLaunch.DECK)?.takeIf { it.isNotEmpty() }
    val route = deck?.let { id -> Route(id, extra(DebugLaunch.SECTION)?.takeIf { it.isNotEmpty() } ?: WHOLE_DECK) }
    val mode = extra(DebugLaunch.MODE)?.let { wire -> Mode.entries.firstOrNull { it.wire == wire } }
    val screen = extra(DebugLaunch.SCREEN)?.let { wire -> DebugScreen.entries.firstOrNull { it.wire == wire } }
    val theme = extra(DebugLaunch.THEME)?.let { wire -> Theme.entries.firstOrNull { it.wire == wire } }
    val step = extra(DebugLaunch.STEP)?.toIntOrNull()?.let { number -> Step.entries.firstOrNull { it.number == number } }
    if (seed == null && route == null && mode == null && screen == null && theme == null && step == null) return null
    return DebugLaunch(seed, route, mode, screen, theme, step)
}

/**
 * An intent extra as the parser reads it: a String as is, a Long or an Int (adb's --el and --ei, putExtra with a
 * number) as its digits, anything else null.
 */
fun extraText(value: Any?): String? = when (value) {
    is String -> value
    is Long, is Int -> value.toString()
    else -> null
}

/** Whether this build is debuggable (debug builds). The activity guards the extras with BuildConfig.DEBUG instead. */
fun isDebuggable(context: Context): Boolean =
    (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
```

- [ ] **Step 21: Run the debug extras' tests green.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.DebugLaunchTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.DebugLaunchTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="5" skipped="0" failures="0"`.

- [ ] **Step 22: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/DebugLaunch.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/DebugLaunchTest.kt
git commit -m "feat: read the debug launch extras: seed, route, class, screen, start step and theme"
```

- [ ] **Step 23: Write the test services and the round coordinator's tests (they fail: no coordinator yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/support/TestServices.kt`:

```kotlin
package com.eienmosu.truthy.support

import com.eienmosu.truthy.AppServices
import com.eienmosu.truthy.DeckStore
import com.eienmosu.truthy.RoundJournal
import kotlinx.coroutines.CompletableDeferred

/** The app's services over the given fakes and the real decks. A [gate] holds every deck decode until it completes. */
fun testServices(
    journal: RoundJournal,
    progress: MemoryProgressStore,
    wall: FakeClock,
    monotonic: FakeClock,
    decks: DeckStore,
    theme: ThemeBox = ThemeBox(),
    gate: CompletableDeferred<Unit>? = null,
): AppServices = AppServices(
    index = { decks.index() },
    deck = { id ->
        gate?.await()
        decks.deck(id)
    },
    progress = progress,
    journal = journal,
    readTheme = { theme.value },
    writeTheme = { chosen ->
        if (theme.fails) throw IllegalStateException("the preferences refused the write")
        theme.value = chosen
    },
    wall = wall,
    monotonic = monotonic,
    seeds = { 7L },
    newRoundId = { "round-1" },
)
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/RoundCoordinatorTest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.Clock
import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.engine.recordKey
import com.eienmosu.truthy.support.CLF
import com.eienmosu.truthy.support.FakeClock
import com.eienmosu.truthy.support.MemoryProgressStore
import com.eienmosu.truthy.support.T0
import com.eienmosu.truthy.support.newTempDir
import com.eienmosu.truthy.support.testDeckStore
import com.eienmosu.truthy.support.testServices
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class RoundCoordinatorTest {
    private val sec = Route(CLF, "SEC")

    private class Rig(val scope: TestScope) {
        val io = StandardTestDispatcher(scope.testScheduler)
        val wall = FakeClock(T0)
        val monotonic = FakeClock(10_000.0)
        val progress = MemoryProgressStore()
        val journal = RoundJournal(newTempDir(), io)
        val writer = SerialWriter(scope.backgroundScope)
        val services = testServices(journal, progress, wall, monotonic, testDeckStore(io))

        suspend fun start(route: Route, mode: Mode, hidden: Boolean = false): RoundCoordinator =
            assertNotNull(prepareRound(RoundRequest(route, mode), services.index(), services, writer, scope.backgroundScope, hidden))

        /** Moves the wall clock by [wallMs] and lets exactly one 100 ms tick of the ticker fire. */
        fun tick(wallMs: Double) {
            wall.now += wallMs
            scope.advanceTimeBy(RoundCoordinator.TICK_MS)
            scope.runCurrent()
        }
    }

    private fun clock(round: RoundCoordinator): Clock = assertNotNull(round.state.value.clock)

    @Test
    fun anAnswerWaitsTheSettleTimeOfItsCardAndKeepsTheWallClockTime() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.CLASSIC)
        val card = assertNotNull(currentCard(round.state.value))
        rig.monotonic.now += 249.0
        assertFalse(round.answer(card.answer))
        assertTrue(round.state.value.answers.isEmpty())
        rig.monotonic.now += 1.0
        rig.wall.now = T0 + 5_000.0
        assertTrue(round.answer(card.answer))
        val state = round.state.value
        assertEquals(Phase.ANSWERED, state.phase)
        assertEquals(T0 + 5_000.0, state.answers.single().at)
        assertTrue(state.answers.single().correct)
    }

    @Test
    fun aCardTakesOneAnswerAndNextWaitsFourHundredTwentyMilliseconds() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.CLASSIC)
        rig.monotonic.now += 300.0
        assertTrue(round.answer(true))
        assertFalse(round.answer(false))
        assertEquals(1, round.state.value.answers.size)
        rig.monotonic.now += 419.0
        assertFalse(round.next())
        assertEquals(Phase.ANSWERED, round.state.value.phase)
        rig.monotonic.now += 1.0
        assertTrue(round.next())
        assertEquals(Phase.QUESTION, round.state.value.phase)
        assertEquals(1, round.state.value.index)
        assertEquals(rig.monotonic.now, round.cardShownAt)
        assertFalse(round.answer(true), "the new card has its own settle time")
        rig.monotonic.now += 250.0
        assertTrue(round.answer(true))
    }

    @Test
    fun theXLeavesAtOnceWithoutAnswersAndOtherwiseOpensTheSheet() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.CLASSIC)
        assertTrue(round.requestLeave())
        assertFalse(round.sheetOpen.value)
        rig.monotonic.now += 300.0
        round.answer(true)
        assertFalse(round.requestLeave())
        assertTrue(round.sheetOpen.value)
        assertEquals(rig.monotonic.now, round.sheetOpenedAt)
        assertFalse(round.decidedWhenSheetOpened)
        assertFalse(round.scrimTapAccepted())
        rig.monotonic.now += 1_000.0
        assertTrue(round.scrimTapAccepted())
        assertFalse(round.next(), "nothing under the sheet takes a press")
        round.keepPlaying()
        assertFalse(round.sheetOpen.value)
        assertTrue(round.next())
    }

    @Test
    fun everyAnswerIsJournalledInOrder() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.CLASSIC)
        rig.monotonic.now += 300.0
        round.answer(true)
        rig.monotonic.now += 420.0
        round.next()
        rig.monotonic.now += 250.0
        round.answer(false)
        runCurrent()
        val entry = assertNotNull(rig.journal.pending())
        assertEquals(sec, entry.route)
        assertEquals(Mode.CLASSIC, entry.mode)
        assertEquals(7L, entry.seed)
        assertEquals("round-1", entry.roundId)
        assertEquals(round.state.value.answers.map { it.card.id }, entry.answers.map { it.cardId })
        assertFalse(entry.decided)
        assertFalse(entry.recorded)
    }

    @Test
    fun leavingBeforeAnyAnswerSavesNothing() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.CLASSIC)
        val savesAfterDealing = rig.progress.saves
        round.leave()
        assertEquals(savesAfterDealing, rig.progress.saves)
        assertNull(rig.journal.pending())
        assertTrue(round.state.value.abandoned)
    }

    @Test
    fun leavingAnUndecidedRoundKeepsItsAnswersWithoutARecord() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.CLASSIC)
        val card = assertNotNull(currentCard(round.state.value))
        rig.monotonic.now += 300.0
        round.answer(card.answer)
        round.leave()
        val stored = rig.progress.stored
        assertEquals(LastRound(sec, Mode.CLASSIC, null, null), stored.last)
        assertTrue(stored.records.isEmpty())
        assertEquals(1L, stored.cards.getValue(card.id).seen)
        assertNull(rig.journal.pending())
    }

    @Test
    fun leavingADecidedRoundRecordsIt() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.STREAK)
        val card = assertNotNull(currentCard(round.state.value))
        rig.monotonic.now += 300.0
        round.answer(!card.answer)
        assertTrue(isDecided(round.state.value))
        round.leave()
        assertEquals(0, rig.progress.stored.records[recordKey(sec, Mode.STREAK)])
        assertEquals(LastRound(sec, Mode.STREAK, 0, 1), rig.progress.stored.last)
        assertNull(rig.journal.pending())
    }

    @Test
    fun aFinishedRoundIsRecordedOnceAndItsActionsWaitOneSecond() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.STREAK)
        val card = assertNotNull(currentCard(round.state.value))
        rig.monotonic.now += 300.0
        round.answer(!card.answer)
        rig.monotonic.now += 420.0
        assertTrue(round.next())
        assertEquals(Phase.FINISHED, round.state.value.phase)
        round.awaitRecorded()
        val outcome = assertNotNull(round.outcome.value)
        assertTrue(outcome.isNewBest)
        assertNull(outcome.previousBest)
        assertEquals(0, rig.progress.stored.records[recordKey(sec, Mode.STREAK)])
        assertNull(rig.journal.pending())
        val saves = rig.progress.saves
        rig.monotonic.now += 999.0
        assertFalse(round.resultActionReady())
        rig.monotonic.now += 1.0
        assertTrue(round.resultActionReady())
        round.leave()
        assertEquals(saves, rig.progress.saves, "leaving the result writes nothing more")
    }

    @Test
    fun theTimedClockHearsATickEveryHundredMillisecondsAndPausesOnlyWhileStopped() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.TIMED)
        assertEquals(60_000.0, clock(round).remainingMs)
        rig.tick(100.0)
        assertEquals(59_900.0, clock(round).remainingMs)
        rig.monotonic.now += 300.0
        round.answer(true)
        assertFalse(round.requestLeave())
        rig.tick(100.0)
        assertEquals(59_800.0, clock(round).remainingMs, "the sheet does not pause the clock")
        round.keepPlaying()
        round.onStop()
        assertTrue(clock(round).hidden)
        rig.wall.now += 5_000.0
        advanceTimeBy(5_000)
        runCurrent()
        assertEquals(59_800.0, clock(round).remainingMs)
        round.onStart()
        assertFalse(clock(round).hidden)
        rig.tick(100.0)
        assertEquals(59_700.0, clock(round).remainingMs)
    }

    @Test
    fun timeUpStopsTheRoundAndSeeResultsWaitsFourHundredTwenty() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.TIMED)
        repeat(60) { rig.tick(1_000.0) }
        val upAt = rig.monotonic.now
        assertTrue(isDecided(round.state.value))
        assertEquals(0.0, clock(round).remainingMs)
        val decided = round.state.value
        rig.tick(1_000.0)
        assertSame(decided, round.state.value, "the round no longer changes")
        rig.monotonic.now = upAt + 419.0
        assertFalse(round.next())
        rig.monotonic.now = upAt + 420.0
        assertTrue(round.next())
        assertEquals(Phase.FINISHED, round.state.value.phase)
    }

    @Test
    fun aMinuteRunOutWithNoAnswersIsJournalledAndTheXRecordsAZero() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.TIMED)
        repeat(60) { rig.tick(1_000.0) }
        runCurrent()
        val entry = assertNotNull(rig.journal.pending())
        assertTrue(entry.decided)
        assertTrue(entry.answers.isEmpty())
        assertTrue(round.requestLeave(), "no answers: the X leaves without the sheet")
        round.leave()
        assertEquals(0, rig.progress.stored.records[recordKey(sec, Mode.TIMED)])
        assertEquals(LastRound(sec, Mode.TIMED, 0, 0), rig.progress.stored.last)
        assertNull(rig.journal.pending())
    }

    @Test
    fun aTimedRoundDealtWhileStoppedWaitsForTheStart() = runTest {
        val rig = Rig(this)
        val round = rig.start(sec, Mode.TIMED, hidden = true)
        assertTrue(clock(round).hidden)
        rig.tick(1_000.0)
        assertEquals(60_000.0, clock(round).remainingMs)
        round.onStart()
        assertFalse(clock(round).hidden)
        rig.tick(100.0)
        assertEquals(59_900.0, clock(round).remainingMs)
    }
}
```

- [ ] **Step 24: Run them and see them fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.RoundCoordinatorTest')
```

Expected: `BUILD FAILED`, with `Unresolved reference 'AppServices'` (in `TestServices.kt`), `Unresolved reference 'RoundCoordinator'` and `Unresolved reference 'prepareRound'` from `:app:compileDebugUnitTestKotlin`.

- [ ] **Step 25: Write the services and the round coordinator.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/AppServices.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.DeckFile
import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.Theme

/**
 * The app state's window on the outside world (the web's PlayServices and StartServices): the decks, the stores,
 * the theme preference, the two clocks and the dice. AppGraph builds the real one; tests pass fakes.
 */
class AppServices(
    val index: suspend () -> DeckIndex,
    val deck: suspend (String) -> DeckFile,
    val progress: ProgressStore,
    val journal: RoundJournal,
    val readTheme: () -> Theme?,
    val writeTheme: (Theme) -> Unit,
    val wall: WallClock,
    val monotonic: MonotonicClock,
    val seeds: () -> Long,
    val newRoundId: () -> String,
)
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/RoundCoordinator.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.ApplyOutcome
import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.NEXT_ARRIVES_MS
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.RESULT_ARRIVES_MS
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.SWIPE
import com.eienmosu.truthy.engine.StartArgs
import com.eienmosu.truthy.engine.TIMED
import com.eienmosu.truthy.engine.TicketInfo
import com.eienmosu.truthy.engine.bestFor
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.emptyProgress
import com.eienmosu.truthy.engine.findRoute
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.engine.leavesSomething
import com.eienmosu.truthy.engine.poolFor
import com.eienmosu.truthy.engine.pruneDeck
import com.eienmosu.truthy.engine.recordRound
import com.eienmosu.truthy.engine.reduce
import com.eienmosu.truthy.engine.saveLeftRound
import com.eienmosu.truthy.engine.startRound
import com.eienmosu.truthy.engine.ticketFor
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * One round on screen (PlayScreen.tsx, useRound.ts, useClock.ts, leave.ts, ResultView.tsx): the one answer path and
 * its guards, the leave sheet's state, the Timed ticker and its pause on ON_STOP, the journal after every answer,
 * the record when the result shows, and the save on leave. The reducer of the engine does the rules.
 */
class RoundCoordinator(
    val request: RoundRequest,
    val ticket: TicketInfo,
    initial: RoundState,
    val seed: Long,
    val roundId: String,
    private val scope: CoroutineScope,
    private val writer: SerialWriter,
    private val progressStore: ProgressStore,
    private val journal: RoundJournal,
    private val wall: WallClock,
    private val monotonic: MonotonicClock,
    hidden: Boolean,
) {
    private class AnsweredAt(val index: Int, val at: Double)

    private val _state = MutableStateFlow(initial)
    val state: StateFlow<RoundState> = _state.asStateFlow()

    private val _sheetOpen = MutableStateFlow(false)
    val sheetOpen: StateFlow<Boolean> = _sheetOpen.asStateFlow()

    private val _outcome = MutableStateFlow<ApplyOutcome?>(null)

    /** What recording the result said, once it is written: the comparison and the result's guard start here. */
    val outcome: StateFlow<ApplyOutcome?> = _outcome.asStateFlow()

    /** When the card on screen appeared, on the monotonic clock: the swipe's SwipeContext.cardShownAt. */
    var cardShownAt: Double = monotonic.nowMs()
        private set

    var sheetOpenedAt: Double = Double.NEGATIVE_INFINITY
        private set

    /** Whether the round was already decided when the sheet opened (LeaveDialog.tsx decidedAtOpen). */
    var decidedWhenSheetOpened: Boolean = false
        private set

    private val timed = request.mode == Mode.TIMED
    private var answeredAt: AnsweredAt? = null
    private var timeUpAt: Double? = null
    private var resultShownAt: Double? = null
    private var stopped = hidden
    private var ticker: Job? = null
    private var recordJob: Job? = null
    private var journalled: Pair<Int, Boolean> = 0 to false

    init {
        // useClock.ts: a page already hidden pauses the clock first; the first tick arms it.
        if (timed) {
            val now = wall.nowMs()
            if (hidden) dispatch(RoundEvent.Visibility(hidden = true, at = now))
            dispatch(RoundEvent.Tick(now))
            if (!hidden) startTicker()
        }
    }

    /** True, False, the arrows and a committed swipe. False when a guard drops it. */
    fun answer(value: Boolean): Boolean {
        val round = _state.value
        if (round.phase != Phase.QUESTION || _sheetOpen.value) return false
        val at = monotonic.nowMs()
        if (at - cardShownAt < SWIPE.settleMs) return false
        if (answeredAt?.index != round.index) answeredAt = AnsweredAt(round.index, at)
        dispatch(RoundEvent.Answer(value = value, at = wall.nowMs()))
        return true
    }

    /** Next card, See results and Return: 420 ms after the answer, or after time ran out. */
    fun next(): Boolean {
        if (_sheetOpen.value) return false
        val round = _state.value
        val since = when {
            round.phase == Phase.ANSWERED -> answeredAt?.at
            timed && isDecided(round) -> timeUpAt
            else -> null
        } ?: return false
        if (monotonic.nowMs() - since < NEXT_ARRIVES_MS) return false
        dispatch(RoundEvent.Next)
        return true
    }

    /** The X and Escape: true when the round should be left at once (no answers); otherwise the sheet opens. */
    fun requestLeave(): Boolean {
        val round = _state.value
        if (round.phase == Phase.FINISHED) return false
        if (round.answers.isEmpty()) return true
        if (!_sheetOpen.value) {
            sheetOpenedAt = monotonic.nowMs()
            decidedWhenSheetOpened = isDecided(round)
            _sheetOpen.value = true
        }
        return false
    }

    fun keepPlaying() {
        _sheetOpen.value = false
    }

    /** The web's scrim ignores taps for 250 ms after the sheet opens (LeaveDialog.tsx:132-134). */
    fun scrimTapAccepted(): Boolean = monotonic.nowMs() - sheetOpenedAt >= SWIPE.settleMs

    /**
     * Leaves the round (PlayScreen.tsx leave, leave.ts): before the result it is abandoned on screen and saved with
     * the leave rules when it leaves something; on the result it waits for the record. The journal goes either way.
     */
    suspend fun leave() {
        stopTicker()
        _sheetOpen.value = false
        val round = _state.value
        if (round.phase == Phase.FINISHED) {
            recordJob?.join()
            return
        }
        _state.value = reduce(round, RoundEvent.Abandon)
        try {
            writer.run {
                if (leavesSomething(round)) progressStore.update { stored -> saveLeftRound(round, stored) }
                journal.clear()
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // A storage failure never reaches the player.
        }
    }

    /** ON_STOP: the only pause of the Timed clock (spec 5.6). */
    fun onStop() {
        if (stopped) return
        stopped = true
        if (!clockRunning()) return
        stopTicker()
        dispatch(RoundEvent.Visibility(hidden = true, at = wall.nowMs()))
    }

    /** ON_START: the Timed clock runs again from now. */
    fun onStart() {
        if (!stopped) return
        stopped = false
        if (!clockRunning()) return
        dispatch(RoundEvent.Visibility(hidden = false, at = wall.nowMs()))
        startTicker()
    }

    suspend fun awaitRecorded() {
        recordJob?.join()
    }

    /** Play again, Choose another route and Close results: 1000 ms after the result was recorded and shown. */
    fun resultActionReady(): Boolean {
        val shown = resultShownAt ?: return false
        return monotonic.nowMs() - shown >= RESULT_ARRIVES_MS
    }

    /** Stops the ticker and this round's coroutines. */
    fun close() {
        stopTicker()
        scope.cancel()
    }

    /**
     * Debug launches: drives the round to [screen] without the guards. Answers alternate right and wrong; Timed
     * answers three cards and then runs the minute out in one-second ticks.
     */
    fun debugAdvance(screen: DebugScreen) {
        var at = wall.nowMs()
        var given = 0
        fun answerCard() {
            val card = currentCard(_state.value) ?: return
            answeredAt = AnsweredAt(_state.value.index, monotonic.nowMs())
            dispatch(RoundEvent.Answer(value = if (given % 2 == 0) card.answer else !card.answer, at = at))
            given += 1
        }
        fun tickUntilQuestion() {
            while (_state.value.phase == Phase.STAMPED && !isDecided(_state.value)) {
                at += TICK_MS
                dispatch(RoundEvent.Tick(at))
            }
        }
        when (screen) {
            DebugScreen.START, DebugScreen.ROUND -> Unit
            DebugScreen.ANSWERED -> answerCard()
            DebugScreen.LEAVE_SHEET -> {
                answerCard()
                if (timed) tickUntilQuestion() else dispatch(RoundEvent.Next)
                requestLeave()
            }
            DebugScreen.RESULT -> {
                if (timed) {
                    repeat(3) {
                        answerCard()
                        tickUntilQuestion()
                    }
                    while (!isDecided(_state.value)) {
                        at += TIMED.maxStepMs
                        dispatch(RoundEvent.Tick(at))
                    }
                } else {
                    while (!isDecided(_state.value)) {
                        if (_state.value.phase == Phase.QUESTION) answerCard() else dispatch(RoundEvent.Next)
                    }
                }
                dispatch(RoundEvent.Next)
            }
        }
    }

    private fun dispatch(event: RoundEvent) {
        val before = _state.value
        val after = reduce(before, event)
        if (after === before) return
        _state.value = after
        changed(before, after)
    }

    private fun changed(before: RoundState, after: RoundState) {
        if (after.phase == Phase.QUESTION && (before.phase != Phase.QUESTION || before.index != after.index)) {
            cardShownAt = monotonic.nowMs()
        }
        if (timed && isDecided(after) && !isDecided(before)) {
            timeUpAt = monotonic.nowMs()
            stopTicker()
        }
        if (after.phase == Phase.FINISHED) {
            if (!after.abandoned) record(after)
            return
        }
        val mark = after.answers.size to isDecided(after)
        if (mark != journalled) {
            journalled = mark
            val entry = journalEntry(after, seed, roundId)
            writer.submit { journal.record(entry) }
        }
    }

    // ResultView.tsx recordRound: once per round; then the journal is marked recorded and deleted (task 9's order).
    private fun record(finished: RoundState) {
        if (recordJob != null) return
        recordJob = scope.launch {
            val outcome = try {
                writer.run {
                    var applied: ApplyOutcome? = null
                    progressStore.update { stored -> recordRound(finished, stored).also { applied = it }.progress }
                    journal.record(journalEntry(finished, seed, roundId, recorded = true))
                    journal.clear()
                    applied
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                null
            }
            resultShownAt = monotonic.nowMs()
            _outcome.value = outcome ?: recordRound(finished, emptyProgress())
        }
    }

    private fun clockRunning(): Boolean {
        val round = _state.value
        return timed && round.phase != Phase.FINISHED && !isDecided(round)
    }

    private fun startTicker() {
        if (ticker?.isActive == true) return
        ticker = scope.launch {
            while (true) {
                delay(TICK_MS)
                dispatch(RoundEvent.Tick(wall.nowMs()))
            }
        }
    }

    private fun stopTicker() {
        ticker?.cancel()
        ticker = null
    }

    companion object {
        /** How often the Timed clock is told the time (useRound.ts TICK_MS). */
        const val TICK_MS = 100L
    }
}

/**
 * The web's prepareRound (useRound.ts:169-197): find the route, decode its deck, prune that deck's history and save,
 * deal with a fresh seed. Null when the route no longer resolves or has no cards; a deck that cannot be decoded throws.
 */
suspend fun prepareRound(
    request: RoundRequest,
    index: DeckIndex,
    services: AppServices,
    writer: SerialWriter,
    parent: CoroutineScope,
    hidden: Boolean,
): RoundCoordinator? {
    val found = findRoute(index, request.route) ?: return null
    val deck = services.deck(found.deck.id)
    val progress = writer.run {
        services.progress.update { stored -> pruneDeck(stored, deck.id, deck.cards.map { it.id }) }
    }
    val pool = poolFor(deck, request.route.sectionId)
    if (pool.isEmpty()) return null
    val seed = services.seeds()
    val round = startRound(
        StartArgs(mode = request.mode, route = request.route, pool = pool, history = progress.cards, seed = seed.toDouble()),
    )
    val ticket = ticketFor(found, request.mode, bestFor(progress, request.route, request.mode))
    val scope = CoroutineScope(parent.coroutineContext + SupervisorJob(parent.coroutineContext[Job]))
    return RoundCoordinator(
        request = request,
        ticket = ticket,
        initial = round,
        seed = seed,
        roundId = services.newRoundId(),
        scope = scope,
        writer = writer,
        progressStore = services.progress,
        journal = services.journal,
        wall = services.wall,
        monotonic = services.monotonic,
        hidden = hidden,
    )
}
```

- [ ] **Step 26: Run the coordinator's tests green.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.RoundCoordinatorTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.RoundCoordinatorTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="12" skipped="0" failures="0"`. If a test that reads the journal times out, a journal write was not handed to the writer or the `RoundJournal` of the rig does not use the test dispatcher.

- [ ] **Step 27: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/AppServices.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/RoundCoordinator.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/support/TestServices.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/RoundCoordinatorTest.kt
git commit -m "feat: run a round: one answer path with its guards, the Timed ticker and its pause, the journal, the record and the leave save"
```

- [ ] **Step 28: Write the app controller's tests (they fail: no controller yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/AppControllerTest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.StartChoice
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.emptyProgress
import com.eienmosu.truthy.engine.recordKey
import com.eienmosu.truthy.engine.scoreOf
import com.eienmosu.truthy.support.CLF
import com.eienmosu.truthy.support.FakeClock
import com.eienmosu.truthy.support.MemoryProgressStore
import com.eienmosu.truthy.support.T0
import com.eienmosu.truthy.support.ThemeBox
import com.eienmosu.truthy.support.newTempDir
import com.eienmosu.truthy.support.testDeckStore
import com.eienmosu.truthy.support.testServices
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNotSame
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class AppControllerTest {
    private val sec = Route(CLF, "SEC")

    private class Rig(
        val scope: TestScope,
        val systemDark: Boolean = false,
        val debug: DebugLaunch? = null,
        themeFails: Boolean = false,
        gate: CompletableDeferred<Unit>? = null,
    ) {
        val io = StandardTestDispatcher(scope.testScheduler)
        val wall = FakeClock(T0)
        val monotonic = FakeClock(10_000.0)
        val progress = MemoryProgressStore()
        val journal = RoundJournal(newTempDir(), io)
        val theme = ThemeBox(fails = themeFails)
        val decks = testDeckStore(io)
        val writer = SerialWriter(scope.backgroundScope)
        val services = testServices(journal, progress, wall, monotonic, decks, theme, gate)

        /** A new launch of the app over this rig's files: its boot runs when the test next waits. */
        fun start(): AppController = AppController(scope.backgroundScope, services, writer, systemDark, debug)

        suspend fun cardIds(): List<String> = decks.deck(CLF).cards.map { it.id }
    }

    private fun entry(mode: Mode, answers: List<JournalAnswer>, decided: Boolean, recorded: Boolean = false) =
        JournalEntry(route = sec, mode = mode, seed = 7L, roundId = "killed", answers = answers, decided = decided, recorded = recorded)

    private fun coordinatorOf(app: AppController): RoundCoordinator =
        assertIs<RoundLoad.Ready>(assertIs<TopScreen.Round>(app.screen.value).load).coordinator

    private fun assertStepOne(app: AppController) {
        assertEquals(TopScreen.Start, app.screen.value)
        assertEquals(Step.ONE, app.startFlow.view.value.step)
        assertEquals(StartChoice(), app.startFlow.choice.value)
        assertIs<CatalogState.Ready>(app.startFlow.catalog.value)
    }

    @Test
    fun aKilledRoundWithAnswersIsAbandonedAtLaunchAndTheAppOpensAtStepOne() = runTest {
        val rig = Rig(this)
        val ids = rig.cardIds()
        rig.journal.record(entry(Mode.CLASSIC, listOf(JournalAnswer(ids[0], true, true, T0), JournalAnswer(ids[1], true, false, T0 + 1_000.0)), decided = false))
        val app = rig.start()
        app.booted.join()
        assertNull(rig.journal.pending())
        val stored = rig.progress.stored
        assertEquals(LastRound(sec, Mode.CLASSIC, null, null), stored.last)
        assertTrue(stored.records.isEmpty())
        assertEquals(setOf(ids[0], ids[1]), stored.cards.keys)
        assertStepOne(app)
    }

    @Test
    fun aKilledDecidedRoundIsRecordedAtLaunch() = runTest {
        val rig = Rig(this)
        val ids = rig.cardIds()
        rig.journal.record(entry(Mode.STREAK, listOf(JournalAnswer(ids[0], true, false, T0)), decided = true))
        val app = rig.start()
        app.booted.join()
        assertNull(rig.journal.pending())
        assertEquals(0, rig.progress.stored.records[recordKey(sec, Mode.STREAK)])
        assertEquals(LastRound(sec, Mode.STREAK, 0, 1), rig.progress.stored.last)
        assertStepOne(app)
    }

    @Test
    fun aKilledRoundWithNothingToSaveOnlyDeletesItsJournal() = runTest {
        val rig = Rig(this)
        rig.journal.record(entry(Mode.CLASSIC, emptyList(), decided = false))
        val app = rig.start()
        app.booted.join()
        assertNull(rig.journal.pending())
        assertEquals(0, rig.progress.saves)
        assertStepOne(app)
    }

    @Test
    fun anAlreadyRecordedJournalIsDeletedWithoutTouchingProgress() = runTest {
        val rig = Rig(this)
        val ids = rig.cardIds()
        rig.journal.record(entry(Mode.CLASSIC, listOf(JournalAnswer(ids[0], true, true, T0)), decided = true, recorded = true))
        val app = rig.start()
        app.booted.join()
        assertNull(rig.journal.pending())
        assertEquals(emptyProgress(), rig.progress.stored)
        assertStepOne(app)
    }

    @Test
    fun aRoundOpensAndTheXWithoutAnswersReturnsToStepOne() = runTest {
        val rig = Rig(this)
        val app = rig.start()
        app.booted.join()
        app.openRound(RoundRequest(sec, Mode.CLASSIC))
        assertNotNull(app.roundJob).join()
        val round = coordinatorOf(app)
        assertEquals("CLF", round.ticket.deckCode)
        assertEquals(Phase.QUESTION, round.state.value.phase)
        app.requestLeave()
        assertNotNull(app.leaveJob).join()
        assertTrue(round.state.value.abandoned)
        assertEquals(TopScreen.Start, app.screen.value)
        assertTrue(app.startFlow.view.value.fromRound)
        assertIs<CatalogState.Ready>(app.startFlow.catalog.value)
    }

    @Test
    fun backWhileTheRoundLoadsLeavesAtOnce() = runTest {
        val gate = CompletableDeferred<Unit>()
        val rig = Rig(this, gate = gate)
        val app = rig.start()
        app.booted.join()
        app.openRound(RoundRequest(sec, Mode.CLASSIC))
        runCurrent()
        assertEquals(RoundLoad.Loading, assertIs<TopScreen.Round>(app.screen.value).load)
        app.roundBack()
        assertNotNull(app.leaveJob).join()
        assertEquals(TopScreen.Start, app.screen.value)
        gate.complete(Unit)
        runCurrent()
        assertEquals(TopScreen.Start, app.screen.value, "the cancelled deal opens nothing")
    }

    @Test
    fun backOnTheRoundActsLikeTheXAndOnTheResultLikeCloseResults() = runTest {
        val rig = Rig(this)
        val app = rig.start()
        app.booted.join()
        app.openRound(RoundRequest(sec, Mode.STREAK))
        assertNotNull(app.roundJob).join()
        val round = coordinatorOf(app)
        rig.monotonic.now += 300.0
        round.answer(assertNotNull(currentCard(round.state.value)).answer)
        app.roundBack()
        assertTrue(round.sheetOpen.value, "with answers, back opens the sheet")
        app.roundBack()
        assertFalse(round.sheetOpen.value, "back on the sheet keeps playing")
        rig.monotonic.now += 420.0
        assertTrue(round.next())
        rig.monotonic.now += 250.0
        round.answer(!assertNotNull(currentCard(round.state.value)).answer)
        rig.monotonic.now += 420.0
        assertTrue(round.next())
        round.awaitRecorded()
        app.roundBack()
        assertNull(app.leaveJob, "the result ignores back for its first second")
        rig.monotonic.now += 1_000.0
        app.roundBack()
        assertNotNull(app.leaveJob).join()
        assertEquals(TopScreen.Start, app.screen.value)
        assertEquals(1, rig.progress.stored.records[recordKey(sec, Mode.STREAK)])
        assertEquals(LastRound(sec, Mode.STREAK, 1, 2), rig.progress.stored.last)
    }

    @Test
    fun playAgainDealsANewRoundOnTheSameRoute() = runTest {
        val rig = Rig(this)
        val app = rig.start()
        app.booted.join()
        app.openRound(RoundRequest(sec, Mode.STREAK))
        assertNotNull(app.roundJob).join()
        val first = coordinatorOf(app)
        rig.monotonic.now += 300.0
        first.answer(!assertNotNull(currentCard(first.state.value)).answer)
        rig.monotonic.now += 420.0
        first.next()
        first.awaitRecorded()
        assertFalse(app.playAgain(), "Play again waits one second")
        rig.monotonic.now += 1_000.0
        assertTrue(app.playAgain())
        assertNotNull(app.roundJob).join()
        val second = coordinatorOf(app)
        assertNotSame(first, second)
        assertEquals(first.request, second.request)
        assertEquals(Phase.QUESTION, second.state.value.phase)
        assertTrue(second.state.value.answers.isEmpty())
    }

    @Test
    fun theSwitchFlipsTheVisibleThemeAndAStoredChoiceBeatsTheSystem() = runTest {
        val rig = Rig(this, systemDark = true)
        val app = rig.start()
        assertEquals(Theme.DARK, app.theme.value.theme, "nothing stored: the system decides")
        assertEquals(Theme.LIGHT, app.switchTheme())
        assertEquals(Theme.LIGHT, app.theme.value.theme)
        assertEquals(Theme.LIGHT, rig.theme.value)
        assertEquals(Theme.LIGHT, app.storedTheme)
        app.onSystemDarkChanged(true)
        assertEquals(Theme.LIGHT, app.theme.value.theme)
    }

    @Test
    fun theSystemThemeIsFollowedWhileNothingIsStored() = runTest {
        val rig = Rig(this, systemDark = false)
        val app = rig.start()
        assertEquals(Theme.LIGHT, app.theme.value.theme)
        app.onSystemDarkChanged(true)
        assertEquals(Theme.DARK, app.theme.value.theme)
        assertNull(app.storedTheme)
    }

    @Test
    fun theThemeFlipsEvenWhenItCannotBeStored() = runTest {
        val rig = Rig(this, systemDark = false, themeFails = true)
        val app = rig.start()
        assertEquals(Theme.DARK, app.switchTheme())
        assertEquals(Theme.DARK, app.theme.value.theme)
        assertNull(rig.theme.value)
    }

    @Test
    fun aDebugLaunchOpensTheRoundAnswered() = runTest {
        val rig = Rig(this, debug = DebugLaunch(seed = 7L, route = sec, mode = Mode.CLASSIC, screen = DebugScreen.ANSWERED, theme = null))
        val app = rig.start()
        app.booted.join()
        val round = coordinatorOf(app)
        assertEquals(Phase.ANSWERED, round.state.value.phase)
        runCurrent()
        assertEquals(1, assertNotNull(rig.journal.pending()).answers.size)
    }

    @Test
    fun aDebugLaunchOpensTheResultRecorded() = runTest {
        val rig = Rig(this, debug = DebugLaunch(seed = 7L, route = sec, mode = Mode.CLASSIC, screen = DebugScreen.RESULT, theme = null))
        val app = rig.start()
        app.booted.join()
        val round = coordinatorOf(app)
        val state = round.state.value
        assertEquals(Phase.FINISHED, state.phase)
        assertEquals(state.cards.size, state.answers.size)
        round.awaitRecorded()
        assertNotNull(round.outcome.value)
        assertEquals(scoreOf(Mode.CLASSIC, state.answers), rig.progress.stored.last?.score)
    }

    @Test
    fun aDebugLaunchOpensAStartStepWithTheRouteChosenUpToIt() = runTest {
        val rig = Rig(this, debug = DebugLaunch(seed = null, route = sec, mode = Mode.CLASSIC, screen = DebugScreen.START, theme = null, step = Step.FIVE))
        val app = rig.start()
        app.booted.join()
        assertEquals(TopScreen.Start, app.screen.value)
        assertEquals(Step.FIVE, app.startFlow.step)
        assertEquals(StartChoice(areaId = "cloud", platformId = "aws", deckId = CLF, sectionId = "SEC"), app.startFlow.choice.value)
    }
}
```

- [ ] **Step 29: Run them and see them fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.AppControllerTest')
```

Expected: `BUILD FAILED`, with `Unresolved reference 'AppController'` (and `TopScreen`, `RoundLoad`) from `:app:compileDebugUnitTestKotlin`.

- [ ] **Step 30: Write the app controller.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/AppController.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.design.ResolvedTheme
import com.eienmosu.truthy.design.resolvedTheme
import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.StartChoice
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.clearFrom
import com.eienmosu.truthy.engine.decksWithHistory
import com.eienmosu.truthy.engine.findRoute
import com.eienmosu.truthy.engine.recentDecks
import com.eienmosu.truthy.engine.withoutRemovedCards
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** The two top-level screens, swapped in place (spec 5.2): the start flow, or the round with its loading state. */
sealed interface TopScreen {
    data object Start : TopScreen
    data class Round(val request: RoundRequest, val load: RoundLoad) : TopScreen
}

sealed interface RoundLoad {
    data object Loading : RoundLoad
    data object Failed : RoundLoad
    class Ready(val coordinator: RoundCoordinator) : RoundLoad
}

/**
 * The app's state above the two screens: the launch (journal first, then the catalog, then step 1), the swap
 * between the start flow and the round, the ways out of a round, and the theme. AppViewModel owns one, on its
 * viewModelScope; tests own one on a test scope.
 */
class AppController(
    private val scope: CoroutineScope,
    private val services: AppServices,
    private val writer: SerialWriter,
    systemDark: Boolean,
    private val debug: DebugLaunch? = null,
) {
    val startFlow = StartFlowModel(services.monotonic)

    private val _screen = MutableStateFlow<TopScreen>(TopScreen.Start)
    val screen: StateFlow<TopScreen> = _screen.asStateFlow()

    private var stored: Theme? = readStoredTheme()
    private var systemDark: Boolean = systemDark
    private val _theme = MutableStateFlow(resolvedTheme(stored, systemDark))
    val theme: StateFlow<ResolvedTheme> = _theme.asStateFlow()
    val storedTheme: Theme? get() = stored

    private var foreground = true
    private var index: DeckIndex? = null
    private var round: RoundCoordinator? = null

    internal var roundJob: Job? = null
        private set
    internal var leaveJob: Job? = null
        private set

    /** The launch. Declared last: on Main.immediate it starts running inside the constructor. */
    val booted: Job = scope.launch { boot() }

    /** After the unroll of Start round: the round replaces the start flow. */
    fun openRound(request: RoundRequest) {
        if (roundJob?.isActive == true || leaveJob?.isActive == true) return
        roundJob = scope.launch { open(request) }
    }

    /** Try again after a load failure. */
    fun retryRound() {
        val shown = _screen.value as? TopScreen.Round ?: return
        if (shown.load == RoundLoad.Failed) openRound(shown.request)
    }

    /** The X and Escape on the round (PlayScreen.tsx requestLeave); Escape on the sheet keeps playing. */
    fun requestLeave() {
        val shown = _screen.value as? TopScreen.Round ?: return
        val current = (shown.load as? RoundLoad.Ready)?.coordinator
        if (current == null) {
            leaveRound()
            return
        }
        if (current.state.value.phase == Phase.FINISHED) return
        if (current.sheetOpen.value) {
            // The second tap of a double tap on the X lands here, not on the sheet: 80 ms after the first the sheet's
            // window is not up yet. On the web the scrim covers the X and ignores taps for 250 ms (LeaveDialog.tsx:132-134).
            if (current.scrimTapAccepted()) current.keepPlaying()
            return
        }
        if (current.requestLeave()) leaveRound()
    }

    /** Android back on the round (spec D4 and 5.2): the X, or Close results on the result. */
    fun roundBack() {
        val shown = _screen.value as? TopScreen.Round ?: return
        val current = (shown.load as? RoundLoad.Ready)?.coordinator
        if (current != null && current.state.value.phase == Phase.FINISHED) {
            closeResult()
            return
        }
        // Back on the sheet keeps playing at once; backs never wait.
        if (current != null && current.sheetOpen.value) {
            current.keepPlaying()
            return
        }
        requestLeave()
    }

    /** Leave round, and every way out of a round: save with the leave rules, then step 1 with no choices. */
    fun leaveRound() {
        if (leaveJob?.isActive == true) return
        val loading = roundJob
        leaveJob = scope.launch {
            loading?.cancelAndJoin()
            round?.leave()
            showStart(fromRound = true)
        }
    }

    /** Close results and Choose another route: ignored for the result's first 1000 ms. */
    fun closeResult(): Boolean {
        val current = round ?: return false
        if (current.state.value.phase != Phase.FINISHED || !current.resultActionReady()) return false
        leaveRound()
        return true
    }

    /** Play again: the same route and class, progress read and pruned again, a new seed. */
    fun playAgain(): Boolean {
        val current = round ?: return false
        if (current.state.value.phase != Phase.FINISHED || !current.resultActionReady()) return false
        if (roundJob?.isActive == true || leaveJob?.isActive == true) return false
        roundJob = scope.launch {
            current.awaitRecorded()
            current.close()
            round = null
            open(current.request)
        }
        return true
    }

    /** The theme switch: flips the theme on screen, stores it, and flips even when storing fails. */
    fun switchTheme(): Theme {
        val next = com.eienmosu.truthy.engine.switchTheme(stored, systemDark)
        try {
            services.writeTheme(next)
        } catch (e: Exception) {
            // The page flips even when the store fails (theme.ts switchTheme).
        }
        stored = next
        _theme.value = resolvedTheme(next)
        return next
    }

    /** The configuration's night bit changed: followed only while nothing is stored. */
    fun onSystemDarkChanged(dark: Boolean) {
        systemDark = dark
        _theme.value = resolvedTheme(stored, dark)
    }

    fun onStart() {
        foreground = true
        round?.onStart()
    }

    fun onStop() {
        foreground = false
        round?.onStop()
    }

    /** Try again on step 1 after the index failed to load. */
    fun retryCatalog() {
        startFlow.catalogLoading()
        scope.launch { loadCatalog() }
    }

    private suspend fun boot() {
        recoverJournal()
        val launch = debug
        val request = launch?.roundRequest()
        val screen = launch?.screen
        loadCatalog()
        if (request == null || screen == null) return
        if (screen == DebugScreen.START) {
            showDebugStep(launch?.step ?: Step.SIX, request)
        } else {
            open(request)?.debugAdvance(screen)
        }
    }

    // Spec 4.5: a journal found at launch is applied with the leave rules and deleted, before anything reads progress.
    private suspend fun recoverJournal() {
        try {
            writer.run { applyJournal(services.journal, services.progress, services.deck) }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // The start opens all the same.
        }
    }

    private suspend fun open(request: RoundRequest): RoundCoordinator? {
        _screen.value = TopScreen.Round(request, RoundLoad.Loading)
        val prepared = try {
            prepareRound(request, loadIndex(), services, writer, scope, hidden = !foreground)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            _screen.value = TopScreen.Round(request, RoundLoad.Failed)
            return null
        }
        if (prepared == null) {
            showStart(fromRound = false)
            return null
        }
        round = prepared
        _screen.value = TopScreen.Round(request, RoundLoad.Ready(prepared))
        return prepared
    }

    private suspend fun showStart(fromRound: Boolean) {
        round?.close()
        round = null
        _screen.value = TopScreen.Start
        startFlow.reset(fromRound)
        loadCatalog()
    }

    // useCatalog.ts: the index, the progress, the start-screen prune of every played deck (saved only when the number
    // of card entries changed) and the recent decks, worked out once per visit.
    private suspend fun loadCatalog() {
        val catalog = try {
            val index = loadIndex()
            val cardIds = mutableMapOf<String, List<String>>()
            for (deck in decksWithHistory(index, services.progress.load())) {
                val file = try {
                    services.deck(deck.id)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    null
                }
                if (file != null) cardIds[deck.id] = file.cards.map { it.id }
            }
            // One turn of the one writer reads, prunes and writes, and writes only when the number of entries changed.
            writer.run {
                val loaded = services.progress.load()
                val pruned = withoutRemovedCards(loaded, cardIds)
                if (pruned.changed) services.progress.save(pruned.progress)
                Catalog(index, pruned.progress, cardIds, recentDecks(index, pruned.progress))
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            startFlow.catalogFailed()
            return
        }
        startFlow.showCatalog(catalog)
    }

    private suspend fun loadIndex(): DeckIndex = index ?: services.index().also { index = it }

    private suspend fun showDebugStep(step: Step, request: RoundRequest) {
        val found = findRoute(loadIndex(), request.route) ?: return
        val full = StartChoice(
            areaId = found.area.id,
            platformId = found.platform.id,
            deckId = found.deck.id,
            sectionId = request.route.sectionId,
            mode = request.mode,
        )
        startFlow.show(step, clearFrom(full, step))
    }

    private fun readStoredTheme(): Theme? =
        try {
            services.readTheme()
        } catch (e: Exception) {
            null
        }
}
```

`loadCatalog` does not use `ProgressStore.update`, which always writes: the web saves the start-screen prune only when the number of card entries changed (reference 6, save rule 1). Inside `writer.run` the load and the save are still one turn of the app's one writer; `aKilledRoundWithNothingToSaveOnlyDeletesItsJournal` pins that a launch with nothing to prune saves nothing.

- [ ] **Step 31: Run the controller's tests green, then the whole unit test suite.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.AppControllerTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.AppControllerTest.xml
(cd android/Truthy && ./gradlew :app:testDebugUnitTest)
```

Expected: `BUILD SUCCESSFUL`; `tests="14" skipped="0" failures="0"`; then `BUILD SUCCESSFUL` for the whole suite (the tests of tasks 7 to 9 stay green).

- [ ] **Step 32: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/AppController.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/AppControllerTest.kt
git commit -m "feat: launch over a pending journal into step 1, swap the start flow and the round in place, and switch the theme"
```

Expected: one commit.

- [ ] **Step 33: Write the process-wide graph and the view model.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/AppGraph.kt`:

```kotlin
package com.eienmosu.truthy

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.withContext

/**
 * One of each store for the whole process (task 9: one is enough), and the one writer in a scope that outlives
 * every activity and view model, so a write handed in just before a "Don't keep activities" teardown still lands.
 */
class AppGraph private constructor(context: Context) {
    private val decks = DeckStore(context.assets)
    private val progress = FileProgressStore(context.filesDir)
    private val journal = RoundJournal(context.filesDir)
    val themeStore = ThemeStore(context.getSharedPreferences(ThemeStore.PREFS_NAME, Context.MODE_PRIVATE))
    val writer = SerialWriter(CoroutineScope(SupervisorJob() + Dispatchers.IO))

    fun services(debug: DebugLaunch?): AppServices {
        val fixedSeed = debug?.seed
        val seeds: () -> Long = if (fixedSeed != null) {
            { fixedSeed }
        } else {
            { secureSeed() }
        }
        return AppServices(
            index = { withContext(Dispatchers.IO) { decks.index() } },
            deck = { id -> decks.deck(id) },
            progress = progress,
            journal = journal,
            readTheme = { themeStore.stored },
            writeTheme = { theme -> themeStore.store(theme) },
            wall = SystemWallClock,
            monotonic = SystemMonotonicClock,
            seeds = seeds,
            newRoundId = { newRoundId() },
        )
    }

    companion object {
        @Volatile
        private var instance: AppGraph? = null

        fun get(context: Context): AppGraph =
            instance ?: synchronized(this) {
                instance ?: AppGraph(context.applicationContext).also { instance = it }
            }
    }
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/AppViewModel.kt`:

```kotlin
package com.eienmosu.truthy

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.eienmosu.truthy.design.ResolvedTheme
import com.eienmosu.truthy.engine.Theme
import kotlinx.coroutines.flow.StateFlow

/**
 * The activity's state holder: survives configuration changes, never process death (no SavedStateHandle, so a new
 * process opens at start step 1, spec 5.6). All of the logic is in [controller].
 */
class AppViewModel(
    services: AppServices,
    writer: SerialWriter,
    systemDark: Boolean,
    debug: DebugLaunch?,
) : ViewModel() {
    val controller = AppController(viewModelScope, services, writer, systemDark, debug)

    val screen: StateFlow<TopScreen> get() = controller.screen
    val theme: StateFlow<ResolvedTheme> get() = controller.theme
    val startFlow: StartFlowModel get() = controller.startFlow
    val storedTheme: Theme? get() = controller.storedTheme

    fun openRound(request: RoundRequest) = controller.openRound(request)

    fun retryRound() = controller.retryRound()

    fun requestLeave() = controller.requestLeave()

    fun roundBack() = controller.roundBack()

    fun leaveRound() = controller.leaveRound()

    fun closeResult(): Boolean = controller.closeResult()

    fun playAgain(): Boolean = controller.playAgain()

    fun switchTheme(): Theme = controller.switchTheme()

    fun onSystemDarkChanged(dark: Boolean) = controller.onSystemDarkChanged(dark)

    fun onStart() = controller.onStart()

    fun onStop() = controller.onStop()

    fun retryCatalog() = controller.retryCatalog()

    companion object {
        fun factory(graph: AppGraph, systemDark: Boolean, debug: DebugLaunch?): ViewModelProvider.Factory =
            viewModelFactory {
                initializer { AppViewModel(graph.services(debug), graph.writer, systemDark, debug) }
            }
    }
}
```

- [ ] **Step 34: Wire the activity and the root.**

Replace `android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt` with:

```kotlin
package com.eienmosu.truthy

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.eienmosu.truthy.design.TruthyTheme

/** The test tag of the activity's root, for tests that only need to know the app drew. */
const val ROOT_TAG = "truthy.root"

/** The test tags of the two top-level screens; tasks 12 to 14 put the screens inside them. */
const val START_TAG = "truthy.start"
const val ROUND_TAG = "truthy.round"

/** The two top-level screens, swapped in place (spec 5.2). Empty roots until tasks 12 to 14 fill them. */
@Composable
fun TruthyRoot(app: AppViewModel) {
    val screen by app.screen.collectAsState()
    Box(Modifier.fillMaxSize().background(TruthyTheme.colors.surface).testTag(ROOT_TAG)) {
        when (screen) {
            TopScreen.Start -> Box(Modifier.fillMaxSize().testTag(START_TAG))
            is TopScreen.Round -> Box(Modifier.fillMaxSize().testTag(ROUND_TAG))
        }
    }
}
```

Replace `android/Truthy/app/src/main/java/com/eienmosu/truthy/MainActivity.kt` with:

```kotlin
package com.eienmosu.truthy

import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.applyStoredNightMode
import com.eienmosu.truthy.design.applyWindowTheme
import com.eienmosu.truthy.design.bootTheme
import com.eienmosu.truthy.design.isNightUiMode

class MainActivity : ComponentActivity() {
    private var debugLaunch: DebugLaunch? = null
    private var systemDarkAtLaunch = false

    private val app: AppViewModel by viewModels {
        AppViewModel.factory(AppGraph.get(applicationContext), systemDarkAtLaunch, debugLaunch)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Before super.onCreate, as the splash screen library requires.
        installSplashScreen()
        super.onCreate(savedInstanceState)
        val activity = this
        val graph = AppGraph.get(applicationContext)
        // Debug extras only on a debug build and only on a fresh start: an activity recreated after process
        // death gets its old intent back, and must open at step 1 (spec 5.6), not replay the debug launch.
        // BuildConfig.DEBUG is a compile-time constant, so R8 removes the parser from the release build (task 16).
        val launch = if (BuildConfig.DEBUG && savedInstanceState == null) {
            @Suppress("DEPRECATION")
            parseDebugLaunch { key -> extraText(intent.extras?.get(key)) }
        } else {
            null
        }
        launch?.theme?.let { theme -> graph.themeStore.store(theme) }
        debugLaunch = launch
        // The stored theme before the first frame (Review Focus 3): night mode, window background and bar icons.
        bootTheme(activity, graph.themeStore.stored)
        systemDarkAtLaunch = isNightUiMode(resources.configuration.uiMode)
        app.onSystemDarkChanged(systemDarkAtLaunch)
        lifecycle.addObserver(
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_START -> app.onStart()
                    Lifecycle.Event.ON_STOP -> onActivityStop()
                    else -> Unit
                }
            },
        )
        setContent {
            val theme by app.theme.collectAsState()
            LaunchedEffect(theme) {
                applyWindowTheme(activity, theme)
                applyStoredNightMode(activity, app.storedTheme)
            }
            TruthyTheme(theme) { TruthyRoot(app) }
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        app.onSystemDarkChanged(isNightUiMode(newConfig.uiMode))
    }

    // ON_STOP pauses the Timed clock, except while the activity is only being recreated for a configuration change.
    private fun onActivityStop() {
        if (!isChangingConfigurations) app.onStop()
    }
}
```

If step 1 found another caller of `TruthyRoot()` (for example a debug gallery), pass it the activity's `AppViewModel` in the same way.

- [ ] **Step 35: Build, run every unit test, and run the launch test on the API 36 emulator.**

Start the API 36 emulator first (task 7, step 19 names it).

```bash
cd android/Truthy
./gradlew :engine:test :app:testDebugUnitTest :app:assembleDebug
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.SerialWriterTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.BackTransitionTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.StartFlowModelTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.DebugLaunchTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.RoundCoordinatorTest.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.AppControllerTest.xml
./gradlew :app:connectedDebugAndroidTest
cd ../..
```

Expected: `BUILD SUCCESSFUL`; the six lines `tests="3"`, `tests="8"`, `tests="10"`, `tests="5"`, `tests="12"`, `tests="14"`, each with `skipped="0" failures="0"`; then `BUILD SUCCESSFUL` for the connected run, with task 7's `AppLaunchTest` green (the root still carries `ROOT_TAG`, and with nothing stored the bar icons follow the system theme).

- [ ] **Step 36: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/AppGraph.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/AppViewModel.kt android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt android/Truthy/app/src/main/java/com/eienmosu/truthy/MainActivity.kt
git commit -m "feat: boot the stored theme before the first frame, apply a pending journal at launch, and swap the two screens in place"
git status --short
```

Expected: one commit; `git status --short` prints nothing (add any other caller of `TruthyRoot` that step 34 changed).

- [ ] **Step 37: Kill the app in the middle of a round on the emulator, and look at the first frame in the stored theme.**

Review Focus 2 on a real process. The debug extras deal a Classic round on `aws-clf-c02` SEC with seed 12345 and answer its first card; the app is sent home and killed; a plain launch must apply the journal (an abandoned round: the answer in the history, `last` with a null score, no record), delete it and open step 1.

```bash
cd android/Truthy && ./gradlew :app:installDebug && cd ../..
adb shell am force-stop com.eienmosu.truthy
adb shell run-as com.eienmosu.truthy rm -f files/truthy.progress.v1.json files/truthy.round.v1.json
adb shell am start -W -n com.eienmosu.truthy/.MainActivity --es truthy.deck aws-clf-c02 --es truthy.section SEC --es truthy.mode classic --es truthy.screen answered --es truthy.seed 12345
sleep 2
adb shell run-as com.eienmosu.truthy cat files/truthy.round.v1.json; echo
adb shell input keyevent KEYCODE_HOME
sleep 1
adb shell am kill com.eienmosu.truthy
adb shell pidof com.eienmosu.truthy || echo "process gone"
adb shell am start -W -n com.eienmosu.truthy/.MainActivity
sleep 2
adb shell run-as com.eienmosu.truthy ls files
adb shell run-as com.eienmosu.truthy cat files/truthy.progress.v1.json; echo
```

Expected: `Status: ok` for both launches; the journal before the kill holds `"roundId"`, one object in `"answers"`, `"decided":false` and `"recorded":false`; `process gone`; after the relaunch `ls` lists `truthy.progress.v1.json` and no `truthy.round.v1.json`; the progress JSON has one entry in `"cards"`, `"records":{}` and `"last":{"route":{"deckId":"aws-clf-c02","sectionId":"SEC"},"mode":"classic","score":null,"total":null}`.

The same with "Don't keep activities" (the activity and its view model go away, the process stays):

```bash
adb shell settings put global always_finish_activities 1
adb shell am force-stop com.eienmosu.truthy
adb shell run-as com.eienmosu.truthy rm -f files/truthy.progress.v1.json files/truthy.round.v1.json
adb shell am start -W -n com.eienmosu.truthy/.MainActivity --es truthy.deck aws-clf-c02 --es truthy.section SEC --es truthy.mode streak --es truthy.screen sheet --es truthy.seed 12345
sleep 2
adb shell input keyevent KEYCODE_HOME
sleep 1
adb shell pidof com.eienmosu.truthy && echo "process alive"
adb shell am start -W -n com.eienmosu.truthy/.MainActivity
sleep 2
adb shell run-as com.eienmosu.truthy ls files
adb shell run-as com.eienmosu.truthy cat files/truthy.progress.v1.json; echo
adb shell settings put global always_finish_activities 0
```

Expected: a process id and `process alive`; after the relaunch no `truthy.round.v1.json`; the progress JSON has `"records":{}` and `"last"` with `"mode":"streak"`, `"score":null` and `"total":null` (the debug leave screen answered one card right, moved on and opened the sheet, so the round was undecided with one answer).

The first frame in the stored theme (Review Focus 3; task 15 records the full N12 check):

```bash
adb shell cmd uimode night no
adb shell am force-stop com.eienmosu.truthy
adb shell am start -W -n com.eienmosu.truthy/.MainActivity --es truthy.theme dark
sleep 2
adb exec-out screencap -p > android/Truthy/app/build/stored-dark-on-light-system.png
adb shell pm clear com.eienmosu.truthy
```

Expected: `Status: ok`; open `android/Truthy/app/build/stored-dark-on-light-system.png` (a build output, never committed): the screen is the night surface `#101c33` edge to edge with light status bar icons although the system is light. `pm clear` prints `Success` and removes the stored theme and the files again. Nothing from this step is committed.

- [ ] **Step 38: Run every gate and the hygiene check.**

```bash
cd android/Truthy
./gradlew :engine:test :tokengen:test :app:testDebugUnitTest :app:assembleDebug
cd ../..
pnpm vitest run tests/repo-hygiene.test.ts
pnpm test
git grep -n -I -E 'this@[A-Za-z]+\.' -- android || echo "no labelled this"
git status --short
git log --oneline -7
```

Expected: `BUILD SUCCESSFUL`; the hygiene test passes (`Test Files  1 passed (1)`); `pnpm test` passes every Vitest file; `no labelled this`; `git status --short` prints nothing; the log shows this task's six commits (writer, back motion, start flow model, debug extras, round coordinator, app controller) and the wiring commit on top of task 10's last commit.
