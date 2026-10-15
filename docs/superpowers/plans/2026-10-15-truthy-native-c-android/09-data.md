### Task 9: The data layer: DeckStore, ProgressStore and FileProgressStore, RoundJournal, ThemeStore

This task gives the app everything it keeps or reads from disk, behind the names the README fixes. `DeckStore` decodes the embedded deck index and one deck at a time from the APK's assets (spec D3, reference 2.3). `FileProgressStore` keeps the player's progress in `filesDir` as `truthy.progress.v1.json`, in the web's JSON shape, written with `AtomicFile` through one writer per file, and runs the engine's port of `src/progress/local.ts` (task 4) over it, so the unreadable side copy `truthy.progress.v1.unreadable.json` follows the web's rule exactly (reference 6). `RoundJournal` is the native-only file `truthy.round.v1.json` that survives a killed app (spec 4.5); with it come the pure helpers that turn a round into a journal entry and a journal entry into the result the leave rules save, and `applyJournal`, which task 11 calls at launch. `ThemeStore` reads and writes the stored theme under the web's key `truthy.theme` in `SharedPreferences`. The task ends by pinning the backup rules to these file names: progress and theme are backed up, the journal is not.

Everything here is tested with JVM unit tests (`:app:testDebugUnitTest`), against the real `native-data/decks` for the deck store and against temporary folders for the files. This task owns the store side of Review Focus 2 (the app killed in the middle of a round): `ApplyJournalTest` applies a journal written by another instance (another process) with each leave rule and checks that it is deleted. Task 11 owns the launch side.

**This task was not compiled during drafting.** Nothing in this file was compiled or run while the plan was written, so every Kotlin line below was checked by reading against the Kotlin standard library, kotlinx.coroutines, kotlinx.serialization, kotlin.test and the AndroidX `AtomicFile` source, never by a compiler. After the review, tasks 1 to 15 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: the JVM tests and, on the API 36 emulator, the instrumented tests. The defects that run found are fixed in this file (README, Drafting record). If the compiler rejects a line, fix the line, not the test, and keep the behaviour the step states.

Builds on tasks 1 to 8. From tasks 1 to 4: the content types, `Mode`, `Theme` and the theme rules, the round reducer and its helpers, `Progress` and the progress rules, and the engine's port of `local.ts` (`KeyValueStorage`, `createLocalStore`, the two keys). From task 7: the `:app` module, its manifest, its unit test setup, the assets source directory over `native-data/decks`, the two backup rule files (include-only: the progress file and `truthy.xml`, never the journal, spec 4.5) and `StorageNames`, whose names the stores here take as their own. Task 8 is not used here.

**Files:**
- Create (all under `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/`): `DeckStore.kt`, `FileStorage.kt`, `ProgressStore.kt`, `RoundJournal.kt`, `JournalApply.kt`, `ThemeStore.kt`
- Modify only if step 1 finds them missing: `android/Truthy/gradle/libs.versions.toml`, `android/Truthy/app/build.gradle.kts`
- Test support (under `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/support/`): create `TestData.kt`, `MemoryPrefs.kt`
- Test (under `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/`): create `DeckStoreTest.kt`, `FileStorageTest.kt`, `FileProgressStoreTest.kt`, `RoundJournalTest.kt`, `ApplyJournalTest.kt`, `ThemeStoreTest.kt` (task 7's `app/src/test/java/com/eienmosu/truthy/BackupRulesTest.kt` and its include-only rule files stay as they are)

**Interfaces:**
- Consumes (package `com.eienmosu.truthy.engine`). The first group is fixed by the README. The second group is assumed from the plan's description of tasks 1 to 4 and from plan B's matching tasks; step 1 checks every name.

```kotlin
// fixed by the README
@Serializable data class Card(...)                                   // decoded from the shipped deck JSON, compared by id
@Serializable data class DeckIndex(val areas: List<IndexArea>)       // IndexArea(id, title, platforms), IndexPlatform(id, title, decks),
                                                                     // IndexDeck(id, code, title, passName, cardCount, version, hash, sections), IndexSection(id, title, cardCount)
@Serializable data class DeckFile(val id: String, val hash: String, val cards: List<Card>)
@Serializable data class Route(val deckId: String, val sectionId: String)
const val WHOLE_DECK = "ALL"
enum class Mode(val wire: String) { CLASSIC("classic"), STREAK("streak"), LIVES("lives"), TIMED("timed") }
@Serializable data class CardHistory(val seen: Long, val lastCorrect: Boolean, val lastSeenAt: Double)
data class Answered(val card: Card, val given: Boolean, val correct: Boolean, val at: Double)
data class RoundResult(val mode: Mode, val route: Route, val score: Int, val total: Int, val answers: List<Answered>, val missed: List<Answered>, val abandoned: Boolean)
enum class Phase(val wire: String) { QUESTION("question"), ANSWERED("answered"), STAMPED("stamped"), FINISHED("finished") }
data class RoundState(val mode: Mode, val route: Route, val cards: List<Card>, val index: Int, val answers: List<Answered>, val phase: Phase, val abandoned: Boolean, val source: DealSource, val clock: Clock?)
sealed interface RoundEvent { data class Answer(val value: Boolean, val at: Double); data object Next; data class Tick(val now: Double); data class Visibility(val hidden: Boolean, val at: Double); data object Abandon }
@Serializable data class Progress(val version: Int, val cards: Map<String, CardHistory>, val records: Map<String, Int>, val last: LastRound?)
fun readProgress(raw: String?): ReadResult                           // data class ReadResult(val progress: Progress, val whole: Boolean)

// assumed from task 1 (theme rules, the README's "theme rules")
enum class Theme(val wire: String) { LIGHT("light"), DARK("dark") }
const val THEME_KEY = "truthy.theme"
fun parseTheme(value: String?): Theme?                               // "light", "dark", anything else null

// assumed from task 3 (the round reducer)
data class StartArgs(val mode: Mode, val route: Route, val pool: List<Card>, val history: Map<String, CardHistory>, val seed: Double)
fun startRound(args: StartArgs): RoundState
fun reduce(state: RoundState, event: RoundEvent): RoundState
fun currentCard(state: RoundState): Card?
fun isDecided(state: RoundState): Boolean
fun scoreOf(mode: Mode, answers: List<Answered>): Int

// assumed from task 4 (progress and the port of local.ts, as plan B task 4 names them)
@Serializable data class LastRound(val route: Route, val mode: Mode, val score: Int?, val total: Int?)
fun emptyProgress(): Progress
fun recordKey(route: Route, mode: Mode): String
fun applyResult(progress: Progress, result: RoundResult): ApplyOutcome      // ApplyOutcome(progress, previousBest, isNewBest)
const val PROGRESS_KEY = "truthy.progress.v1"
const val UNREADABLE_KEY = "truthy.progress.v1.unreadable"
interface KeyValueStorage { fun getItem(key: String): String?; fun setItem(key: String, value: String) }   // either may throw
class LocalStore { fun load(): Progress; fun save(progress: Progress) }      // never throws; save runs the side-copy decision first
fun createLocalStore(storage: KeyValueStorage?): LocalStore
```

- Consumes, from task 7: `object StorageNames { PROGRESS_FILE, UNREADABLE_FILE, JOURNAL_FILE, PREFS_FILE }` in `com.eienmosu.truthy` (the names the backup rules list); the `:app` module with Kotlin sources under `app/src/main/kotlin` and unit tests under `app/src/test/kotlin`; the kotlinx-serialization plugin applied to `:app`; unit tests on JUnit 4 with kotlin.test (`kotlin-test-junit`); `android/Truthy/app/build.gradle.kts` adding `native-data/decks` as an assets source directory, so `index.json` and the 54 `<deckId>.json` files sit at the root of the APK's assets; `AndroidManifest.xml` with `android:allowBackup="true"`, `android:fullBackupContent="@xml/backup_rules"` and `android:dataExtractionRules="@xml/data_extraction_rules"`. Step 1 checks each of these.

- Produces (package `com.eienmosu.truthy`; later tasks rely on every name):

```kotlin
// DeckStore.kt
class DeckLoadError(message: String, cause: Throwable? = null) : Exception(message, cause)
class DeckStore internal constructor(open: (String) -> InputStream, io: CoroutineDispatcher = Dispatchers.IO) {
    constructor(assets: AssetManager)
    fun index(): DeckIndex                     // decoded once, on the calling thread (task 11 calls it at launch)
    suspend fun deck(id: String): DeckFile     // decoded on io; the last deck is kept; throws DeckLoadError
    companion object { const val INDEX_ASSET = "index.json"; fun deckAsset(id: String): String }
}

// FileStorage.kt (internal: used by this task's stores and tests only)
internal class FileStorage(dir: File) : KeyValueStorage     // key K is the file K.json in dir, read and written with AtomicFile
internal fun readAtomically(file: AtomicFile): String?
internal fun writeAtomically(file: AtomicFile, bytes: ByteArray)
internal object FileWriters { fun lockFor(file: File): Mutex }   // one Mutex per file path in the process: the single writer

// ProgressStore.kt
interface ProgressStore {
    suspend fun load(): Progress
    suspend fun save(progress: Progress)
    suspend fun update(change: (Progress) -> Progress): Progress   // read, change, write as one turn of the writer; default: load then save
}
class FileProgressStore(dir: File, io: CoroutineDispatcher = Dispatchers.IO) : ProgressStore {
    companion object { const val FILE_NAME = StorageNames.PROGRESS_FILE; const val UNREADABLE_FILE_NAME = StorageNames.UNREADABLE_FILE }   // "truthy.progress.v1.json", "truthy.progress.v1.unreadable.json"
}

// RoundJournal.kt
@Serializable data class JournalAnswer(val cardId: String, val given: Boolean, val correct: Boolean, val at: Double)
@Serializable data class JournalEntry(val route: Route, val mode: Mode, val seed: Long, val roundId: String, val answers: List<JournalAnswer>, val decided: Boolean, val recorded: Boolean)
class RoundJournal(dir: File, io: CoroutineDispatcher = Dispatchers.IO) {
    suspend fun record(entry: JournalEntry); suspend fun clear(); suspend fun pending(): JournalEntry?
    companion object { const val FILE_NAME = StorageNames.JOURNAL_FILE }      // "truthy.round.v1.json"
}
fun journalEntry(state: RoundState, seed: Long, roundId: String, recorded: Boolean = false): JournalEntry
fun journalResult(entry: JournalEntry, deck: DeckFile): RoundResult?

// JournalApply.kt
enum class JournalOutcome { NONE, DISCARDED, ABANDONED, RECORDED }
suspend fun applyJournal(journal: RoundJournal, store: ProgressStore, deck: suspend (String) -> DeckFile): JournalOutcome

// ThemeStore.kt
typealias StoredTheme = Theme
class ThemeStore(prefs: SharedPreferences) {
    val stored: StoredTheme?
    fun store(theme: StoredTheme)
    companion object { const val PREFS_NAME = StorageNames.PREFS_FILE }      // "truthy", the preferences file shared_prefs/truthy.xml
}
```

- What later tasks must know:
  - Task 11 builds one of each from the application context: `DeckStore(context.assets)`, `FileProgressStore(context.filesDir)`, `RoundJournal(context.filesDir)` and `ThemeStore(context.getSharedPreferences(ThemeStore.PREFS_NAME, Context.MODE_PRIVATE))`. Two instances on one folder are safe (they share the writer), but one is enough.
  - At launch, before the start screen loads its progress, task 11 calls `applyJournal(journal, store) { id -> decks.deck(id) }` and then opens start step 1 with no choices, whatever the outcome.
  - During a round, task 11 calls `journal.record(journalEntry(state, seed, roundId))` after every answer and when a Timed minute runs out, from one coroutine in order; when the result is shown it records the round with `store.update { applyResult(it, summarise(state)).progress }`, then `journal.record(journalEntry(state, seed, roundId, recorded = true))`, then `journal.clear()`; on leave it saves with the leave rules through `store.update` and then calls `journal.clear()`.
  - Every read, modify and write of progress that must not lose a concurrent change goes through `update`, which holds the writer for the whole turn. `load` and `save` alone are each one turn.

**Rules:**

1. **One writer per file, off the main thread.** Every read and write of a file runs on the store's `io` dispatcher (`Dispatchers.IO` in the app) while holding the `Mutex` that `FileWriters.lockFor` gives for that file's path. Reads hold it too: `AtomicFile.openRead` deletes a `.new` file it finds next to the base file, which would destroy a write in progress on another thread. The AndroidX source says it plainly: "You must do your own threading protection for access to AtomicFile". The lock is per path in the process, not per instance, so two stores on one folder still have one writer. kotlinx's `Mutex` is fair, so turns are taken in the order they were asked for.
2. **Atomic writes.** `writeAtomically` writes the bytes to `AtomicFile.startWrite()`, calls `failWrite` and rethrows when writing fails, and otherwise calls `finishWrite`, which syncs, closes and renames the `.new` file over the base file. `finishWrite` only logs a failed rename, so `writeAtomically` checks afterwards that the `.new` file is gone and throws `IOException` when it is not. A kill during a write leaves the old file whole: `openRead` ignores and deletes the half-written `.new` file, and a first write that never finished reads as nothing stored.
3. **Reading as the web's `getItem`.** `FileStorage.getItem` returns `null` only when the file does not exist. A file that exists but cannot be read (a folder in its place, no permission) throws, so the engine's store treats it as storage that throws: `load` gives empty progress and `save` does nothing (reference 3.5, `local.ts`). Bytes are decoded as UTF-8; malformed bytes become U+FFFD instead of failing, so a damaged file is copied aside and replaced on the next save instead of blocking every save.
4. **The side copy is the engine's rule.** `FileProgressStore` adds no rule of its own: it runs `createLocalStore(FileStorage(dir))`, whose `save` first copies a stored value that did not read back whole to `truthy.progress.v1.unreadable` (the file `truthy.progress.v1.unreadable.json`), skips the copy when the side file already holds exactly that value, and skips the main write when the copy fails. A storage failure never reaches the player.
5. **The deck store.** `index()` decodes `index.json` once (a failed decode is tried again on the next call) and is meant for launch. `deck(id)` decodes `<id>.json` on `io`, keeps the last decoded deck (so Play again does not decode it twice) and throws `DeckLoadError` when the asset is missing, is not a deck file, or holds another deck's id. The decks are the web build's output and the drift test keeps them right, so the decoder ignores unknown keys instead of failing on a field this build does not read. Card order is kept as in the file, because the first shuffle runs over file order (reference 2.3).
6. **The journal** holds one `JournalEntry` as JSON in `truthy.round.v1.json`, rewritten whole and atomically by every `record` under the journal's writer. `record` never throws (a journal that cannot be written costs only this round's answers if the app is then killed). `pending()` returns `null` for no file or a file that does not decode. `clear()` deletes the file and its temporary files.
7. **A round as a journal entry** (`journalEntry`): the route, class, seed and round id, every answer as its card id, given value, verdict and wall-clock time, and `decided`. A round is decided when `isDecided(state)` is true, and also when it is finished without being abandoned: `reduce` finishes a round on `next` only when it was decided, and `isDecided` is false once the phase is `FINISHED`.
8. **The leave rules, applied to a journal** (spec 4.5, reference 6 save rule 4, `components/play/leave.ts`). `journalResult` gives what `saveLeftRound` would save, `summarise(reduce(round, decided ? next : abandon))`:
   - `recorded` is true: nothing (the result was already written).
   - no answers and not decided: nothing.
   - otherwise a `RoundResult` with the entry's class and route, the answers whose card is still in the deck (an answer to a card the deck no longer holds is skipped), `score = scoreOf(mode, answers)`, `total = answers.size`, `missed` the wrong answers, and `abandoned = !decided`. `applyResult` then puts the answers into the card history and, for an abandoned round, sets `last` with null score and total and never touches the record; a decided round is recorded as its result would record it (a first round sets the record, even at 0; only a higher score replaces it).
9. **`applyJournal`** reads the pending entry, loads the route's deck only when there is something to save, applies the result with `store.update`, and always deletes the journal, also when it could not be read or its deck could not be loaded (then nothing is saved: the round cannot be rebuilt, as the web loses an unsaved round). It returns `NONE` for no readable journal, `DISCARDED` when the journal held nothing to save, `ABANDONED` or `RECORDED` otherwise. The order is apply, then delete: a kill between the two applies the round once more at the next launch, which adds one more `seen` to its cards and leaves the record and `last` as they were (an equal score is not a new best). Deleting first could lose the round, which is worse.
10. **The theme** (reference 6, `src/app-state/theme.ts`). `stored` is `parseTheme` of the string under `truthy.theme`: `"light"` or `"dark"`, and `null` (follow the system) for anything else, for a value of another type and for preferences that throw. `store` writes the theme's wire value with `apply()` and never throws. Nothing removes the key, as on the web. The flip rule and the system theme belong to task 11.
11. **Backups** (spec 4.5) are task 7's: its include-only rule files name the progress file and `shared_prefs/truthy.xml`, so the journal, the side copy and `AtomicFile`'s temporary files are never backed up. This task writes no rule file. Its stores take their file names from task 7's `StorageNames`, and step 33 pins that, so a store can never write under a name the rules do not cover.

**Steps:**

- [ ] **Step 1: Check the starting point.**

```bash
git status --short
ls android/Truthy/app/src/main/kotlin/com/eienmosu/truthy android/Truthy/app/src/test/kotlin android/Truthy/app/src/main/res/xml
grep -rhoE '(interface KeyValueStorage|fun createLocalStore|val PROGRESS_KEY|val UNREADABLE_KEY|fun readProgress|class LastRound|fun emptyProgress|fun recordKey|fun applyResult|fun scoreOf|fun isDecided|fun startRound|class StartArgs|fun currentCard|fun reduce|fun parseTheme|val THEME_KEY|enum class Theme)' android/Truthy/engine/src/main/kotlin | sort -u
grep -n 'serialization\|assets' android/Truthy/app/build.gradle.kts
grep -o 'android:allowBackup="true"\|android:fullBackupContent="[^"]*"\|android:dataExtractionRules="[^"]*"' android/Truthy/app/src/main/AndroidManifest.xml
(cd android/Truthy && ./gradlew -q :app:dependencies --configuration debugUnitTestRuntimeClasspath | grep -oE '(androidx\.core:core|org\.jetbrains\.kotlinx:kotlinx-coroutines-core|org\.jetbrains\.kotlinx:kotlinx-serialization-json|org\.jetbrains\.kotlin:kotlin-test|junit:junit):[^ ]*' | sed 's/:[^:]*$//' | sort -u)
(cd android/Truthy && ./gradlew -q :app:dependencies --configuration debugCompileClasspath | grep -oE 'org\.jetbrains\.kotlinx:kotlinx-serialization-json:[^ ]*' | sed 's/:[^:]*$//' | sort -u)
```

Expected:
- `git status --short` prints nothing.
- The `ls` shows the app sources of task 7 (at least `MainActivity.kt`), a test folder and the two rule files `backup_rules.xml` and `data_extraction_rules.xml`.
- The engine `grep` prints 18 lines, one for each name in the pattern (`const val PROGRESS_KEY` prints as `val PROGRESS_KEY`). If a name is missing or has another signature than in Consumes, read the engine source, adapt the calls in this task's code and tests to it, and note the difference in your report. If `KeyValueStorage` or `createLocalStore` does not exist, stop: task 4 is not in place.
- The `build.gradle.kts` grep shows the serialization plugin line, the `implementation(libs.kotlinx.serialization.json)` line and the assets source directory line (task 7 wrote all three). If one is missing, stop: task 7 is not in place.
- The manifest grep prints the three attributes with `@xml/backup_rules` and `@xml/data_extraction_rules`. If they differ, stop and report: task 7 owns the manifest.
- The first dependency check prints these five lines:

```
androidx.core:core
junit:junit
org.jetbrains.kotlin:kotlin-test
org.jetbrains.kotlinx:kotlinx-coroutines-core
org.jetbrains.kotlinx:kotlinx-serialization-json
```

- The second prints `org.jetbrains.kotlinx:kotlinx-serialization-json`: the main code of this task (`DeckStore`, `RoundJournal`) compiles against it. The test runtime classpath alone does not show that, because `:engine` brings the library there as a runtime dependency. If the second line is missing, stop: task 7's `implementation(libs.kotlinx.serialization.json)` is not in place.

If all five are there, skip step 2.

- [ ] **Step 2: Add the dependencies the check did not find (skip when it found all five).**

Task 1's catalog already has `kotlin-test-junit` (`libs.kotlin.test.junit`) and `junit` (`libs.junit`); reuse those aliases and add no second entry for either module. Only coroutines may be missing from the catalog: if `grep -n 'kotlinx-coroutines-android' android/Truthy/gradle/libs.versions.toml` prints nothing, add this entry right below the `[libraries]` line:

```toml
kotlinx-coroutines-android = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-android", version = "1.11.0" }
```

Then add the matching lines for what the check did not find right below the `dependencies {` line of `android/Truthy/app/build.gradle.kts` (task 7 already has `testImplementation(libs.junit)`; do not add it twice):

```kotlin
    implementation(libs.kotlinx.coroutines.android)
    testImplementation(libs.kotlin.test.junit)
    testImplementation(libs.junit)
```

(`androidx.core:core` and `kotlinx-serialization-json` come from task 7's `implementation` lines; if either is missing, stop and report.) Run step 1's dependency check again. Expected: the five lines.

- [ ] **Step 3: Write the test support and the deck store tests.**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/support/TestData.kt`:

```kotlin
package com.eienmosu.truthy.support

import com.eienmosu.truthy.DeckStore
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileNotFoundException
import java.nio.file.Files

// A wall-clock time in epoch milliseconds, as answers carry it.
const val T0 = 1_790_000_000_000.0

// The repository's native-data/decks, found by walking up from the working directory of the test (Gradle
// runs unit tests in the module folder, android/Truthy/app), so no path is written into a committed file.
fun nativeDecksDir(): File {
    var dir: File? = File(System.getProperty("user.dir")).absoluteFile
    while (dir != null) {
        val decks = File(dir, "native-data/decks")
        if (File(decks, "index.json").isFile) return decks
        dir = dir.parentFile
    }
    error("native-data/decks/index.json was not found above the working directory of the test")
}

// The repository root: the folder that holds native-data.
fun repositoryRoot(): File = nativeDecksDir().parentFile.parentFile

// A deck store over the real embedded decks, read from the repository instead of the APK's assets.
fun repositoryDeckStore(): DeckStore = DeckStore(open = { name -> File(nativeDecksDir(), name).inputStream() })

fun newTempDir(): File = Files.createTempDirectory("truthy-data").toFile()

// A two-card deck in the shipped deck file's shape: tiny-01 is true, tiny-02 is false.
const val TINY_DECK_JSON =
    "{\"id\":\"tiny\",\"hash\":\"0000000000000000\",\"cards\":[" +
        "{\"id\":\"tiny-01\",\"section\":\"S01\",\"text\":{\"en\":{\"statement\":\"A `pod` is the smallest unit Kubernetes schedules.\"," +
        "\"explanation\":\"Kubernetes schedules pods, not containers.\"}},\"answer\":true," +
        "\"source\":{\"title\":\"Pods\",\"url\":\"https://example.com/pods\"},\"difficulty\":1,\"appliesTo\":\"\",\"conflictGroups\":[]}," +
        "{\"id\":\"tiny-02\",\"section\":\"S01\",\"text\":{\"en\":{\"statement\":\"A Service stores container images.\"," +
        "\"explanation\":\"A registry stores images; a Service routes traffic.\"}},\"answer\":false," +
        "\"source\":{\"title\":\"Services\",\"url\":\"https://example.com/services\"},\"difficulty\":1,\"appliesTo\":\"\",\"conflictGroups\":[]}" +
        "]}"

// A deck store that serves the tiny deck as tiny.json, the extra files given, and nothing else.
fun tinyDeckStore(extra: Map<String, String> = emptyMap()): DeckStore {
    val files = mapOf("tiny.json" to TINY_DECK_JSON) + extra
    return DeckStore(open = { name -> ByteArrayInputStream((files[name] ?: throw FileNotFoundException(name)).toByteArray()) })
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/DeckStoreTest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.support.TINY_DECK_JSON
import com.eienmosu.truthy.support.nativeDecksDir
import com.eienmosu.truthy.support.repositoryDeckStore
import com.eienmosu.truthy.support.tinyDeckStore
import kotlinx.coroutines.runBlocking
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertSame

class DeckStoreTest {
    private val store = repositoryDeckStore()
    private val entries get() = store.index().areas.flatMap { it.platforms }.flatMap { it.decks }

    @Test
    fun theIndexListsEveryDeckFileOnce() {
        val ids = entries.map { it.id }
        val files = nativeDecksDir().list()!!.filter { it.endsWith(".json") && it != DeckStore.INDEX_ASSET }.map { it.removeSuffix(".json") }
        assertEquals(ids.size, ids.toSet().size, "a deck id is listed twice")
        assertEquals(files.sorted(), ids.sorted())
    }

    @Test
    fun everyDeckDecodesWithTheCountsAndTheHashOfTheIndex() {
        runBlocking {
            for (entry in entries) {
                val deck = store.deck(entry.id)
                assertEquals(entry.id, deck.id)
                assertEquals(entry.hash, deck.hash, entry.id)
                assertEquals(entry.cardCount, deck.cards.size, entry.id)
                for (section in entry.sections) {
                    assertEquals(section.cardCount, deck.cards.count { it.section == section.id }, "${entry.id} ${section.id}")
                }
            }
        }
    }

    @Test
    fun cardsKeepTheOrderOfTheDeckFile() {
        val idPattern = Regex("\"id\"\\s*:\\s*\"([^\"]*)\"")
        runBlocking {
            for (entry in entries) {
                val raw = File(nativeDecksDir(), DeckStore.deckAsset(entry.id)).readText()
                val inFile = idPattern.findAll(raw).map { it.groupValues[1] }.drop(1).toList()
                assertEquals(inFile, store.deck(entry.id).cards.map { it.id }, entry.id)
            }
        }
    }

    @Test
    fun aDeckThatIsNotEmbeddedFailsWithADeckLoadError() {
        runBlocking {
            assertFailsWith<DeckLoadError> { store.deck("no-such-deck") }
        }
    }

    @Test
    fun aFileThatHoldsAnotherDeckFails() {
        runBlocking {
            assertFailsWith<DeckLoadError> { tinyDeckStore(mapOf("copy.json" to TINY_DECK_JSON)).deck("copy") }
        }
    }

    @Test
    fun aFileThatIsNotADeckFails() {
        runBlocking {
            assertFailsWith<DeckLoadError> { tinyDeckStore(mapOf("bad.json" to "{\"id\":\"bad\"")).deck("bad") }
        }
    }

    @Test
    fun theSameDeckTwiceIsDecodedOnce() {
        runBlocking {
            val tiny = tinyDeckStore()
            assertSame(tiny.deck("tiny"), tiny.deck("tiny"))
        }
    }

    @Test
    fun theIndexIsDecodedOnce() {
        assertSame(store.index(), store.index())
    }

    @Test
    fun theFilesAreReadFromTheRootOfTheAssets() {
        assertEquals("index.json", DeckStore.INDEX_ASSET)
        assertEquals("aws-clf-c02.json", DeckStore.deckAsset("aws-clf-c02"))
    }
}
```

- [ ] **Step 4: Watch them fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.DeckStoreTest')
```

Expected: `> Task :app:compileDebugUnitTestKotlin FAILED` with `Unresolved reference 'DeckStore'` and `Unresolved reference 'DeckLoadError'`, and `BUILD FAILED`.

- [ ] **Step 5: Write the deck store.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/DeckStore.kt`:

```kotlin
package com.eienmosu.truthy

import android.content.res.AssetManager
import com.eienmosu.truthy.engine.DeckFile
import com.eienmosu.truthy.engine.DeckIndex
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.json.Json
import java.io.IOException
import java.io.InputStream

// A deck file or the index could not be read or decoded. The round's loading screen shows its own copy.
class DeckLoadError(message: String, cause: Throwable? = null) : Exception(message, cause)

// The embedded decks (spec D3): native-data/decks is an assets source directory, so index.json and the deck
// files sit at the root of the assets. The index is decoded once, at launch; a deck is decoded off the main
// thread when a route is chosen, and the last one is kept for Play again.
class DeckStore internal constructor(
    private val open: (String) -> InputStream,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {
    constructor(assets: AssetManager) : this(open = { name: String -> assets.open(name) })

    private val decodedIndex: DeckIndex by lazy { decode(INDEX_ASSET, DeckIndex.serializer()) }

    @Volatile
    private var lastDeck: DeckFile? = null

    fun index(): DeckIndex = decodedIndex

    suspend fun deck(id: String): DeckFile {
        val kept = lastDeck
        if (kept != null && kept.id == id) return kept
        val file = withContext(io) { decode(deckAsset(id), DeckFile.serializer()) }
        if (file.id != id) throw DeckLoadError("${deckAsset(id)} holds the deck \"${file.id}\".")
        lastDeck = file
        return file
    }

    private fun <T> decode(name: String, strategy: DeserializationStrategy<T>): T {
        val text = try {
            open(name).use { stream -> stream.readBytes().toString(Charsets.UTF_8) }
        } catch (e: IOException) {
            throw DeckLoadError("Could not read $name.", e)
        }
        return try {
            DECK_JSON.decodeFromString(strategy, text)
        } catch (e: IllegalArgumentException) {
            // SerializationException is an IllegalArgumentException.
            throw DeckLoadError("$name is not a valid deck file.", e)
        }
    }

    companion object {
        const val INDEX_ASSET = "index.json"

        fun deckAsset(id: String): String = "$id.json"

        private val DECK_JSON = Json { ignoreUnknownKeys = true }
    }
}
```

- [ ] **Step 6: Run them green.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.DeckStoreTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.DeckStoreTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="9" skipped="0" failures="0"`. A failing `everyDeckDecodes...` names the deck; if it is a decoding error, the engine's content types (task 1) and the deck JSON disagree: fix the type in the engine, not the data.

- [ ] **Step 7: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/DeckStore.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/support/TestData.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/DeckStoreTest.kt
git commit -m "feat: decode the embedded deck index and decks in the Android app"
```

If step 2 changed `android/Truthy/gradle/libs.versions.toml` and `android/Truthy/app/build.gradle.kts`, add them to this commit too.

- [ ] **Step 8: Write the file storage tests.**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/FileStorageTest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.support.newTempDir
import java.io.File
import java.io.IOException
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FileStorageTest {
    private val dir = newTempDir()
    private val storage = FileStorage(dir)

    @AfterTest
    fun removeTheFolder() {
        dir.deleteRecursively()
    }

    @Test
    fun aKeyNeverWrittenReadsAsNothing() {
        assertNull(storage.getItem("truthy.progress.v1"))
    }

    @Test
    fun aValueReadsBackExactlyWithItsNonAsciiText() {
        val value = "{\"title\":\"Kubernetes \u2022 \u00a7 \u2013 \u2019 \u00e9 \u00c9 \u2192 \u00b7\"}"
        storage.setItem("k", value)
        assertEquals(value, FileStorage(dir).getItem("k"))
    }

    @Test
    fun eachKeyIsItsOwnJsonFileInUtf8() {
        storage.setItem("truthy.progress.v1", "\u00e9")
        assertContentEquals(byteArrayOf(0xC3.toByte(), 0xA9.toByte()), File(dir, "truthy.progress.v1.json").readBytes())
    }

    @Test
    fun aLaterWriteReplacesTheWholeValue() {
        storage.setItem("k", "a long first value")
        storage.setItem("k", "short")
        assertEquals("short", storage.getItem("k"))
    }

    @Test
    fun aWriteLeavesNoTemporaryFileBehind() {
        storage.setItem("k", "v")
        assertEquals(listOf("k.json"), dir.list()!!.toList())
    }

    @Test
    fun aHalfWrittenFileFromAKilledWriteIsIgnored() {
        storage.setItem("k", "complete")
        File(dir, "k.json.new").writeText("{\"half")
        assertEquals("complete", FileStorage(dir).getItem("k"))
    }

    @Test
    fun aFirstWriteThatNeverFinishedReadsAsNothing() {
        File(dir, "k.json.new").writeText("{\"half")
        assertNull(storage.getItem("k"))
    }

    @Test
    fun aMissingFolderIsCreatedByTheFirstWrite() {
        val nested = FileStorage(File(dir, "later"))
        assertNull(nested.getItem("k"))
        nested.setItem("k", "v")
        assertEquals("v", nested.getItem("k"))
    }

    @Test
    fun aFileThatCannotBeReadThrowsInsteadOfReadingAsNothing() {
        File(dir, "k.json").mkdirs()
        assertFailsWith<IOException> { storage.getItem("k") }
    }

    @Test
    fun aWriteThatCannotReplaceTheFileThrows() {
        File(dir, "k.json/inside").mkdirs()
        assertFails { storage.setItem("k", "v") }
        assertTrue(File(dir, "k.json").isDirectory)
    }
}
```

The last test throws on either path the AndroidX code can take: in a JVM unit test `android.util.Log.e` throws unless task 7 set `unitTests.isReturnDefaultValues`, and with it set the rename fails quietly and `writeAtomically` throws its own `IOException`.

- [ ] **Step 9: Watch them fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.FileStorageTest')
```

Expected: `> Task :app:compileDebugUnitTestKotlin FAILED` with `Unresolved reference 'FileStorage'`, and `BUILD FAILED`.

- [ ] **Step 10: Write the file storage.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/FileStorage.kt`:

```kotlin
package com.eienmosu.truthy

import androidx.core.util.AtomicFile
import com.eienmosu.truthy.engine.KeyValueStorage
import kotlinx.coroutines.sync.Mutex
import java.io.File
import java.io.FileNotFoundException
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap

// The web's localStorage for the engine's progress store (task 4): key K is the file K.json in dir. Reads
// give null only when the file does not exist; any other failure throws, as a blocked storage does on the
// web. Writes are atomic. Callers hold the file's lock from FileWriters around every call.
internal class FileStorage(private val dir: File) : KeyValueStorage {
    override fun getItem(key: String): String? = readAtomically(atomicFile(key))

    override fun setItem(key: String, value: String) {
        writeAtomically(atomicFile(key), value.toByteArray(Charsets.UTF_8))
    }

    private fun atomicFile(key: String): AtomicFile = AtomicFile(File(dir, "$key.json"))
}

// The file's text, or null when it does not exist. A .new file left by a killed write is ignored, and a
// first write that never finished reads as nothing. Malformed UTF-8 becomes U+FFFD.
internal fun readAtomically(file: AtomicFile): String? =
    try {
        file.readFully().toString(Charsets.UTF_8)
    } catch (e: FileNotFoundException) {
        if (file.baseFile.exists()) throw e else null
    }

// Writes the bytes to file.new, then syncs and renames it over the file. AtomicFile.finishWrite only logs a
// failed rename, so a .new file still there afterwards is reported as the failure it is.
internal fun writeAtomically(file: AtomicFile, bytes: ByteArray) {
    val stream = file.startWrite()
    try {
        stream.write(bytes)
    } catch (e: IOException) {
        file.failWrite(stream)
        throw e
    }
    file.finishWrite(stream)
    if (File(file.baseFile.path + ".new").exists()) throw IOException("${file.baseFile.name} was not replaced")
}

// One lock per file path for the whole process: the single writer of spec 4.5. Reads take it too, because
// AtomicFile.openRead deletes a .new file it finds, which may be a write in progress.
internal object FileWriters {
    private val locks = ConcurrentHashMap<String, Mutex>()

    fun lockFor(file: File): Mutex = locks.computeIfAbsent(file.absolutePath) { Mutex() }
}
```

- [ ] **Step 11: Run them green.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.FileStorageTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.FileStorageTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="10" skipped="0" failures="0"`.

- [ ] **Step 12: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/FileStorage.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/FileStorageTest.kt
git commit -m "feat: add atomic file storage with one writer per file to the Android app"
```

- [ ] **Step 13: Write the progress store tests.**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/FileProgressStoreTest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.CardHistory
import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.PROGRESS_KEY
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.UNREADABLE_KEY
import com.eienmosu.truthy.engine.emptyProgress
import com.eienmosu.truthy.engine.readProgress
import com.eienmosu.truthy.support.T0
import com.eienmosu.truthy.support.newTempDir
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.io.File
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FileProgressStoreTest {
    private val dir = newTempDir()
    private val main = File(dir, FileProgressStore.FILE_NAME)
    private val side = File(dir, FileProgressStore.UNREADABLE_FILE_NAME)

    private val played = Progress(
        version = 1,
        cards = mapOf("aws-clf-c02-t2.1-06" to CardHistory(seen = 2, lastCorrect = true, lastSeenAt = T0)),
        records = mapOf("aws-clf-c02/SEC#classic" to 7),
        last = LastRound(route = Route(deckId = "aws-clf-c02", sectionId = "SEC"), mode = Mode.CLASSIC, score = 7, total = 10),
    )

    @AfterTest
    fun removeTheFolder() {
        dir.deleteRecursively()
    }

    @Test
    fun theFileNamesAreTheWebKeysWithJson() {
        assertEquals("$PROGRESS_KEY.json", FileProgressStore.FILE_NAME)
        assertEquals("$UNREADABLE_KEY.json", FileProgressStore.UNREADABLE_FILE_NAME)
        assertEquals("truthy.progress.v1.json", FileProgressStore.FILE_NAME)
        assertEquals("truthy.progress.v1.unreadable.json", FileProgressStore.UNREADABLE_FILE_NAME)
    }

    @Test
    fun nothingStoredLoadsAsEmptyProgressAndWritesNothing() {
        runBlocking {
            assertEquals(emptyProgress(), FileProgressStore(dir).load())
            assertEquals(0, dir.list()!!.size)
        }
    }

    @Test
    fun aSaveIsWhatTheNextLaunchLoads() {
        runBlocking {
            FileProgressStore(dir).save(played)
            assertEquals(played, FileProgressStore(dir).load())
        }
    }

    @Test
    fun theFileHoldsTheWebShapeAndReadsBackWhole() {
        runBlocking {
            FileProgressStore(dir).save(played)
            val read = readProgress(main.readText())
            assertTrue(read.whole)
            assertEquals(played, read.progress)
            FileProgressStore(dir).save(emptyProgress())
            assertTrue(readProgress(main.readText()).whole, "empty progress is written with its last key")
        }
    }

    @Test
    fun anUnreadableValueIsKeptAsideBeforeItIsWrittenOver() {
        runBlocking {
            main.writeText("{not json")
            val store = FileProgressStore(dir)
            store.save(store.load())
            assertEquals("{not json", side.readText())
            assertTrue(readProgress(main.readText()).whole)
        }
    }

    @Test
    fun aValueWithADroppedPartIsKeptAsideAndItsValidPartsStay() {
        runBlocking {
            val raw = "{\"version\":1,\"cards\":{\"aws-clf-c02-t2.1-06\":{\"seen\":2,\"lastCorrect\":true,\"lastSeenAt\":1790000000000}}," +
                "\"records\":{\"aws-clf-c02/SEC#classic\":7,\"aws-clf-c02/APP#classic\":7.5},\"last\":null}"
            main.writeText(raw)
            val store = FileProgressStore(dir)
            val loaded = store.load()
            assertEquals(mapOf("aws-clf-c02/SEC#classic" to 7), loaded.records)
            assertEquals(played.cards, loaded.cards)
            store.save(loaded)
            assertEquals(raw, side.readText())
            assertEquals(loaded, FileProgressStore(dir).load())
        }
    }

    @Test
    fun aValueWithNoLastKeyIsKeptAside() {
        runBlocking {
            val raw = "{\"version\":1,\"cards\":{},\"records\":{\"gcp-cdl/ALL#classic\":8}}"
            main.writeText(raw)
            val store = FileProgressStore(dir)
            val loaded = store.load()
            assertEquals(mapOf("gcp-cdl/ALL#classic" to 8), loaded.records)
            store.save(loaded)
            assertEquals(raw, side.readText())
        }
    }

    @Test
    fun noSideCopyIsMadeOverAWholeValueOrOverNothing() {
        runBlocking {
            val store = FileProgressStore(dir)
            store.save(played)
            store.save(emptyProgress())
            assertFalse(side.exists())
        }
    }

    @Test
    fun theSideCopyIsMadeOnceAndReplacedByALaterUnreadableValue() {
        runBlocking {
            val store = FileProgressStore(dir)
            main.writeText("{first")
            store.save(played)
            assertEquals("{first", side.readText())
            store.save(emptyProgress())
            assertEquals("{first", side.readText())
            main.writeText("{second")
            store.save(played)
            assertEquals("{second", side.readText())
        }
    }

    @Test
    fun whenTheSideCopyCannotBeHandledTheValueIsNotWrittenOver() {
        runBlocking {
            main.writeText("{not json")
            File(side, "inside").mkdirs()
            FileProgressStore(dir).save(played)
            assertEquals("{not json", main.readText())
        }
    }

    @Test
    fun aBrokenProgressFileNeverReachesThePlayer() {
        runBlocking {
            File(main, "inside").mkdirs()
            val store = FileProgressStore(dir)
            assertEquals(emptyProgress(), store.load())
            store.save(played)
            assertTrue(main.isDirectory)
        }
    }

    @Test
    fun updateReadsChangesAndWritesInOneTurn() {
        runBlocking {
            val store = FileProgressStore(dir)
            store.save(played)
            val next = store.update { it.copy(records = it.records + ("gcp-cdl/ALL#classic" to 8)) }
            assertEquals(8, next.records["gcp-cdl/ALL#classic"])
            assertEquals(7, next.records["aws-clf-c02/SEC#classic"])
            assertEquals(next, FileProgressStore(dir).load())
        }
    }

    @Test
    fun concurrentUpdatesThroughTwoStoresOnOneFolderAreNeverLost() {
        runBlocking {
            val first = FileProgressStore(dir)
            val second = FileProgressStore(dir)
            (0 until 40).map { i ->
                launch(Dispatchers.Default) {
                    (if (i % 2 == 0) first else second).update { it.copy(records = it.records + ("deck-$i/ALL#classic" to i)) }
                }
            }.joinAll()
            assertEquals((0 until 40).map { "deck-$it/ALL#classic" }.toSet(), first.load().records.keys)
        }
    }

    @Test
    fun concurrentSavesLeaveAFileThatReadsWhole() {
        runBlocking {
            val store = FileProgressStore(dir)
            (0 until 30).map { i ->
                launch(Dispatchers.Default) { store.save(played.copy(records = mapOf("deck-$i/ALL#classic" to i))) }
            }.joinAll()
            val read = readProgress(main.readText())
            assertTrue(read.whole)
            assertEquals(1, read.progress.records.size)
            assertFalse(side.exists())
        }
    }
}
```

- [ ] **Step 14: Watch them fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.FileProgressStoreTest')
```

Expected: `> Task :app:compileDebugUnitTestKotlin FAILED` with `Unresolved reference 'FileProgressStore'`, and `BUILD FAILED`.

- [ ] **Step 15: Write the progress store.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ProgressStore.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.createLocalStore
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File

// Where the player's progress lives, behind an interface so a sync can be added later (spec 4.5). A storage
// failure never reaches the player: load gives what still reads, save does nothing when it cannot write.
interface ProgressStore {
    suspend fun load(): Progress

    suspend fun save(progress: Progress)

    // A whole read, modify and write (reference 6, save rule 5). A store with a writer holds it for the
    // whole turn, so no concurrent save is lost in between.
    suspend fun update(change: (Progress) -> Progress): Progress {
        val next = change(load())
        save(next)
        return next
    }
}

// truthy.progress.v1.json in dir (filesDir in the app), in the web's JSON shape, with the web's unreadable
// side copy truthy.progress.v1.unreadable.json. The rules are the engine's port of local.ts; this class adds
// the files, the single writer and the move off the main thread.
class FileProgressStore(dir: File, private val io: CoroutineDispatcher = Dispatchers.IO) : ProgressStore {
    private val local = createLocalStore(FileStorage(dir))
    private val writer = FileWriters.lockFor(File(dir, FILE_NAME))

    override suspend fun load(): Progress = withContext(io) { writer.withLock { local.load() } }

    override suspend fun save(progress: Progress) {
        withContext(io) { writer.withLock { local.save(progress) } }
    }

    override suspend fun update(change: (Progress) -> Progress): Progress =
        withContext(io) {
            writer.withLock {
                val next = change(local.load())
                local.save(next)
                next
            }
        }

    companion object {
        // Task 7's names, which the backup rules list (the progress file backed up, the side copy not).
        const val FILE_NAME = StorageNames.PROGRESS_FILE
        const val UNREADABLE_FILE_NAME = StorageNames.UNREADABLE_FILE
    }
}
```

- [ ] **Step 16: Run them green.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.FileProgressStoreTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.FileProgressStoreTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="14" skipped="0" failures="0"`. If `theFileHoldsTheWebShape...` fails on its second assertion, the engine writes empty progress without `"last":null` (task 4's encoder): fix it there, because a value without `last` reads as not whole and would be copied aside on every save.

- [ ] **Step 17: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ProgressStore.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/FileProgressStoreTest.kt
git commit -m "feat: keep Android progress in an atomic file with the web's side copy"
```

- [ ] **Step 18: Write the round journal tests.**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/RoundJournalTest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.RoundEvent
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.StartArgs
import com.eienmosu.truthy.engine.WHOLE_DECK
import com.eienmosu.truthy.engine.currentCard
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.engine.reduce
import com.eienmosu.truthy.engine.startRound
import com.eienmosu.truthy.support.T0
import com.eienmosu.truthy.support.newTempDir
import com.eienmosu.truthy.support.tinyDeckStore
import kotlinx.coroutines.runBlocking
import java.io.File
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RoundJournalTest {
    private val dir = newTempDir()
    private val route = Route(deckId = "tiny", sectionId = WHOLE_DECK)
    private val deck = runBlocking { tinyDeckStore().deck("tiny") }

    @AfterTest
    fun removeTheFolder() {
        dir.deleteRecursively()
    }

    private fun entry(mode: Mode, answers: List<JournalAnswer>, decided: Boolean, recorded: Boolean = false) =
        JournalEntry(route = route, mode = mode, seed = 7L, roundId = "round-1", answers = answers, decided = decided, recorded = recorded)

    private fun start(mode: Mode, pool: List<Card> = deck.cards): RoundState =
        startRound(StartArgs(mode = mode, route = route, pool = pool, history = emptyMap(), seed = 7.0))

    private fun answerCurrent(state: RoundState, correct: Boolean, at: Double): RoundState {
        val card = assertNotNull(currentCard(state))
        return reduce(state, RoundEvent.Answer(value = if (correct) card.answer else !card.answer, at = at))
    }

    @Test
    fun nothingRecordedIsNothingPending() {
        runBlocking { assertNull(RoundJournal(dir).pending()) }
    }

    @Test
    fun anEntryOutlivesTheProcessThatWroteIt() {
        runBlocking {
            val written = entry(Mode.TIMED, listOf(JournalAnswer("tiny-01", given = true, correct = true, at = T0)), decided = false)
                .copy(seed = 4_294_967_295L)
            RoundJournal(dir).record(written)
            assertEquals(written, RoundJournal(dir).pending())
        }
    }

    @Test
    fun aLaterRecordReplacesTheEarlierOne() {
        runBlocking {
            val journal = RoundJournal(dir)
            journal.record(entry(Mode.CLASSIC, emptyList(), decided = false))
            val later = entry(Mode.CLASSIC, listOf(JournalAnswer("tiny-02", given = false, correct = true, at = T0)), decided = false)
            journal.record(later)
            assertEquals(later, journal.pending())
        }
    }

    @Test
    fun clearDeletesTheJournal() {
        runBlocking {
            val journal = RoundJournal(dir)
            journal.record(entry(Mode.CLASSIC, emptyList(), decided = false))
            journal.clear()
            assertNull(journal.pending())
            assertEquals(0, dir.list()!!.size)
        }
    }

    @Test
    fun anUnreadableJournalIsNothingPending() {
        runBlocking {
            File(dir, RoundJournal.FILE_NAME).writeText("{\"route\":")
            assertNull(RoundJournal(dir).pending())
        }
    }

    @Test
    fun theJournalIsOneFileNamedForItsVersion() {
        runBlocking {
            assertEquals("truthy.round.v1.json", RoundJournal.FILE_NAME)
            RoundJournal(dir).record(entry(Mode.LIVES, emptyList(), decided = false))
            assertEquals(listOf(RoundJournal.FILE_NAME), dir.list()!!.toList())
        }
    }

    @Test
    fun aFreshRoundIsUndecidedWithNoAnswers() {
        val journalled = journalEntry(start(Mode.CLASSIC), seed = 7L, roundId = "round-1")
        assertEquals(entry(Mode.CLASSIC, emptyList(), decided = false), journalled)
    }

    @Test
    fun eachAnswerIsJournalledWithItsCardAndTime() {
        val started = start(Mode.CLASSIC)
        val card = assertNotNull(currentCard(started))
        val answered = answerCurrent(started, correct = true, at = T0)
        val journalled = journalEntry(answered, seed = 7L, roundId = "round-1")
        assertEquals(listOf(JournalAnswer(cardId = card.id, given = card.answer, correct = true, at = T0)), journalled.answers)
        assertFalse(journalled.decided)
        assertFalse(journalled.recorded)
    }

    @Test
    fun theLastClassicAnswerDecidesTheRoundAndNextKeepsItDecided() {
        var state = start(Mode.CLASSIC)
        var at = T0
        while (!isDecided(state)) {
            state = answerCurrent(state, correct = true, at = at)
            at += 1000.0
            if (!isDecided(state)) state = reduce(state, RoundEvent.Next)
        }
        assertEquals(deck.cards.size, journalEntry(state, 7L, "round-1").answers.size)
        assertTrue(journalEntry(state, 7L, "round-1").decided)
        val finished = reduce(state, RoundEvent.Next)
        assertEquals(Phase.FINISHED, finished.phase)
        assertTrue(journalEntry(finished, 7L, "round-1").decided)
        assertTrue(journalEntry(finished, 7L, "round-1", recorded = true).recorded)
    }

    @Test
    fun anAbandonedRoundIsNotDecided() {
        val left = reduce(answerCurrent(start(Mode.CLASSIC), correct = false, at = T0), RoundEvent.Abandon)
        val journalled = journalEntry(left, 7L, "round-1")
        assertEquals(1, journalled.answers.size)
        assertFalse(journalled.answers.single().correct)
        assertFalse(journalled.decided)
    }

    @Test
    fun aTimedMinuteThatRunsOutIsDecidedWithoutAnswers() {
        var state = start(Mode.TIMED)
        for (second in 0..60) state = reduce(state, RoundEvent.Tick(now = T0 + second * 1000.0))
        assertTrue(isDecided(state))
        val journalled = journalEntry(state, 7L, "round-1")
        assertTrue(journalled.answers.isEmpty())
        assertTrue(journalled.decided)
    }

    @Test
    fun aJournalWithNothingToSaveHasNoResult() {
        val answers = listOf(JournalAnswer("tiny-01", given = true, correct = true, at = T0))
        assertNull(journalResult(entry(Mode.CLASSIC, emptyList(), decided = false), deck))
        assertNull(journalResult(entry(Mode.CLASSIC, answers, decided = true, recorded = true), deck))
        assertNull(journalResult(entry(Mode.TIMED, emptyList(), decided = true, recorded = true), deck))
    }

    @Test
    fun anUndecidedJournalGivesAnAbandonedResult() {
        val result = assertNotNull(journalResult(entry(Mode.CLASSIC, listOf(JournalAnswer("tiny-01", given = true, correct = true, at = T0)), decided = false), deck))
        assertTrue(result.abandoned)
        assertEquals(Mode.CLASSIC, result.mode)
        assertEquals(route, result.route)
        assertEquals(1, result.score)
        assertEquals(1, result.total)
        assertEquals(listOf("tiny-01"), result.answers.map { it.card.id })
        assertTrue(result.missed.isEmpty())
    }

    @Test
    fun aDecidedJournalGivesTheResultTheRoundWouldHave() {
        val answers = listOf(
            JournalAnswer("tiny-01", given = true, correct = true, at = T0),
            JournalAnswer("tiny-02", given = false, correct = true, at = T0 + 1000.0),
            JournalAnswer("gone-99", given = true, correct = true, at = T0 + 1500.0),
            JournalAnswer("tiny-01", given = false, correct = false, at = T0 + 2000.0),
        )
        val result = assertNotNull(journalResult(entry(Mode.STREAK, answers, decided = true), deck))
        assertFalse(result.abandoned)
        assertEquals(listOf("tiny-01", "tiny-02", "tiny-01"), result.answers.map { it.card.id })
        assertEquals(2, result.score)
        assertEquals(3, result.total)
        assertEquals(listOf(T0 + 2000.0), result.missed.map { it.at })
    }
}
```

- [ ] **Step 19: Watch them fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.RoundJournalTest')
```

Expected: `> Task :app:compileDebugUnitTestKotlin FAILED` with `Unresolved reference` errors for `JournalEntry`, `JournalAnswer`, `RoundJournal`, `journalEntry` and `journalResult`, and `BUILD FAILED`. If an engine name of Consumes is reported too (`StartArgs`, `startRound`, `currentCard`), adapt the test to the engine's actual signature first.

- [ ] **Step 20: Write the round journal.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/RoundJournal.kt`:

```kotlin
package com.eienmosu.truthy

import androidx.core.util.AtomicFile
import com.eienmosu.truthy.engine.Answered
import com.eienmosu.truthy.engine.DeckFile
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Phase
import com.eienmosu.truthy.engine.RoundResult
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.isDecided
import com.eienmosu.truthy.engine.scoreOf
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

// One answer of the round in progress: the card by id, what was given, the verdict and the wall-clock time.
@Serializable
data class JournalAnswer(val cardId: String, val given: Boolean, val correct: Boolean, val at: Double)

// The round in progress, as the journal keeps it (spec 4.5). seed is the round's unsigned 32-bit seed.
@Serializable
data class JournalEntry(
    val route: Route,
    val mode: Mode,
    val seed: Long,
    val roundId: String,
    val answers: List<JournalAnswer>,
    val decided: Boolean,
    val recorded: Boolean,
)

// truthy.round.v1.json in dir (filesDir in the app). The web saves a round when the page hides; a native app
// can be killed without warning, so each answer is also written here, and a journal found at launch is
// applied with the leave rules and deleted (applyJournal). Rounds are never resumed.
class RoundJournal(dir: File, private val io: CoroutineDispatcher = Dispatchers.IO) {
    private val file = AtomicFile(File(dir, FILE_NAME))
    private val writer = FileWriters.lockFor(file.baseFile)

    // Replaces the journal with this entry. Never throws: a journal that cannot be written costs only this
    // round's answers if the app is then killed.
    suspend fun record(entry: JournalEntry) {
        withContext(io) {
            writer.withLock {
                try {
                    writeAtomically(file, JOURNAL_JSON.encodeToString(JournalEntry.serializer(), entry).toByteArray(Charsets.UTF_8))
                } catch (e: Exception) {
                    // The previous journal, if any, stays whole.
                }
            }
        }
    }

    suspend fun clear() {
        withContext(io) { writer.withLock { file.delete() } }
    }

    // The journalled round, or null when there is none or it does not decode.
    suspend fun pending(): JournalEntry? =
        withContext(io) {
            writer.withLock {
                try {
                    readAtomically(file)?.let { text -> JOURNAL_JSON.decodeFromString(JournalEntry.serializer(), text) }
                } catch (e: Exception) {
                    null
                }
            }
        }

    companion object {
        // Task 7's name; the backup rules never include it.
        const val FILE_NAME = StorageNames.JOURNAL_FILE

        private val JOURNAL_JSON = Json { ignoreUnknownKeys = true }
    }
}

// The journal entry of a round. A round is decided when isDecided says so, and also once it is finished
// without being abandoned: reduce finishes a round on next only when it was decided, and isDecided is false
// for a finished round.
fun journalEntry(state: RoundState, seed: Long, roundId: String, recorded: Boolean = false): JournalEntry =
    JournalEntry(
        route = state.route,
        mode = state.mode,
        seed = seed,
        roundId = roundId,
        answers = state.answers.map { JournalAnswer(cardId = it.card.id, given = it.given, correct = it.correct, at = it.at) },
        decided = isDecided(state) || (state.phase == Phase.FINISHED && !state.abandoned),
        recorded = recorded,
    )

// What leaving this round would save (components/play/leave.ts): nothing when it was already recorded or has
// no answers and is not decided; otherwise summarise(reduce(round, decided ? next : abandon)), rebuilt from
// the deck. An answer to a card the deck no longer holds is skipped.
fun journalResult(entry: JournalEntry, deck: DeckFile): RoundResult? {
    if (entry.recorded || (entry.answers.isEmpty() && !entry.decided)) return null
    val cards = deck.cards.associateBy { it.id }
    val answers = entry.answers.mapNotNull { answer ->
        cards[answer.cardId]?.let { card -> Answered(card = card, given = answer.given, correct = answer.correct, at = answer.at) }
    }
    return RoundResult(
        mode = entry.mode,
        route = entry.route,
        score = scoreOf(entry.mode, answers),
        total = answers.size,
        answers = answers,
        missed = answers.filter { !it.correct },
        abandoned = !entry.decided,
    )
}
```

- [ ] **Step 21: Run them green.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.RoundJournalTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.RoundJournalTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="14" skipped="0" failures="0"`.

- [ ] **Step 22: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/RoundJournal.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/RoundJournalTest.kt
git commit -m "feat: journal the Android round in progress so a killed app keeps its answers"
```

- [ ] **Step 23: Write the tests of the journal applied at launch (Review Focus 2).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/ApplyJournalTest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.CardHistory
import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.WHOLE_DECK
import com.eienmosu.truthy.engine.emptyProgress
import com.eienmosu.truthy.engine.recordKey
import com.eienmosu.truthy.support.T0
import com.eienmosu.truthy.support.newTempDir
import com.eienmosu.truthy.support.tinyDeckStore
import kotlinx.coroutines.runBlocking
import java.io.File
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// The app is killed in the middle of a round: the next launch applies the journal with the leave rules
// (spec 4.5, reference 6 save rule 4) and deletes it. Every launch here uses new store and journal objects
// on the same folder, as a new process would.
class ApplyJournalTest {
    private val dir = newTempDir()
    private val decks = tinyDeckStore()
    private val route = Route(deckId = "tiny", sectionId = WHOLE_DECK)
    private val progressFile = File(dir, FileProgressStore.FILE_NAME)
    private val journalFile = File(dir, RoundJournal.FILE_NAME)

    @AfterTest
    fun removeTheFolder() {
        dir.deleteRecursively()
    }

    private fun entry(mode: Mode, answers: List<JournalAnswer>, decided: Boolean, recorded: Boolean = false, on: Route = route) =
        JournalEntry(route = on, mode = mode, seed = 7L, roundId = "round-1", answers = answers, decided = decided, recorded = recorded)

    private suspend fun killedDuring(entry: JournalEntry) = RoundJournal(dir).record(entry)

    private suspend fun nextLaunch(): JournalOutcome = applyJournal(RoundJournal(dir), FileProgressStore(dir)) { id -> decks.deck(id) }

    private suspend fun stored() = FileProgressStore(dir).load()

    @Test
    fun noJournalChangesNothing() {
        runBlocking {
            assertEquals(JournalOutcome.NONE, nextLaunch())
            assertFalse(progressFile.exists())
        }
    }

    @Test
    fun aRoundWithNoAnswersThatIsNotDecidedSavesNothing() {
        runBlocking {
            killedDuring(entry(Mode.CLASSIC, emptyList(), decided = false))
            assertEquals(JournalOutcome.DISCARDED, nextLaunch())
            assertFalse(progressFile.exists())
            assertFalse(journalFile.exists())
        }
    }

    @Test
    fun anUndecidedRoundWithAnswersIsAppliedAsAbandoned() {
        runBlocking {
            killedDuring(entry(Mode.CLASSIC, listOf(JournalAnswer("tiny-01", given = true, correct = true, at = T0)), decided = false))
            assertEquals(JournalOutcome.ABANDONED, nextLaunch())
            val progress = stored()
            assertEquals(mapOf("tiny-01" to CardHistory(seen = 1, lastCorrect = true, lastSeenAt = T0)), progress.cards)
            assertTrue(progress.records.isEmpty())
            assertEquals(LastRound(route = route, mode = Mode.CLASSIC, score = null, total = null), progress.last)
            assertFalse(journalFile.exists())
        }
    }

    @Test
    fun aDecidedRoundIsRecordedAsItsResultWouldBe() {
        runBlocking {
            killedDuring(
                entry(
                    Mode.STREAK,
                    listOf(
                        JournalAnswer("tiny-01", given = true, correct = true, at = T0),
                        JournalAnswer("tiny-02", given = false, correct = true, at = T0 + 1000.0),
                        JournalAnswer("tiny-01", given = false, correct = false, at = T0 + 2000.0),
                    ),
                    decided = true,
                ),
            )
            assertEquals(JournalOutcome.RECORDED, nextLaunch())
            val progress = stored()
            assertEquals(2, progress.records[recordKey(route, Mode.STREAK)])
            assertEquals(LastRound(route = route, mode = Mode.STREAK, score = 2, total = 3), progress.last)
            assertEquals(CardHistory(seen = 2, lastCorrect = false, lastSeenAt = T0 + 2000.0), progress.cards["tiny-01"])
            assertEquals(CardHistory(seen = 1, lastCorrect = true, lastSeenAt = T0 + 1000.0), progress.cards["tiny-02"])
            assertFalse(journalFile.exists())
        }
    }

    @Test
    fun aDecidedRoundBelowTheRecordKeepsTheRecord() {
        runBlocking {
            FileProgressStore(dir).save(emptyProgress().copy(records = mapOf(recordKey(route, Mode.CLASSIC) to 5)))
            killedDuring(
                entry(
                    Mode.CLASSIC,
                    listOf(
                        JournalAnswer("tiny-01", given = true, correct = true, at = T0),
                        JournalAnswer("tiny-02", given = true, correct = false, at = T0 + 1000.0),
                    ),
                    decided = true,
                ),
            )
            assertEquals(JournalOutcome.RECORDED, nextLaunch())
            val progress = stored()
            assertEquals(5, progress.records[recordKey(route, Mode.CLASSIC)])
            assertEquals(LastRound(route = route, mode = Mode.CLASSIC, score = 1, total = 2), progress.last)
        }
    }

    @Test
    fun aTimedMinuteThatRanOutWithNoAnswersIsRecordedAtZero() {
        runBlocking {
            killedDuring(entry(Mode.TIMED, emptyList(), decided = true))
            assertEquals(JournalOutcome.RECORDED, nextLaunch())
            val progress = stored()
            assertEquals(0, progress.records[recordKey(route, Mode.TIMED)])
            assertEquals(LastRound(route = route, mode = Mode.TIMED, score = 0, total = 0), progress.last)
            assertTrue(progress.cards.isEmpty())
        }
    }

    @Test
    fun aRoundAlreadyRecordedIsOnlyDeleted() {
        runBlocking {
            val before = emptyProgress().copy(records = mapOf(recordKey(route, Mode.CLASSIC) to 2))
            FileProgressStore(dir).save(before)
            killedDuring(entry(Mode.CLASSIC, listOf(JournalAnswer("tiny-01", given = true, correct = true, at = T0)), decided = true, recorded = true))
            assertEquals(JournalOutcome.DISCARDED, nextLaunch())
            assertEquals(before, stored())
            assertFalse(journalFile.exists())
        }
    }

    @Test
    fun aJournalWhoseDeckCannotLoadIsDeletedWithoutSaving() {
        runBlocking {
            val gone = Route(deckId = "gone", sectionId = WHOLE_DECK)
            killedDuring(entry(Mode.CLASSIC, listOf(JournalAnswer("gone-01", given = true, correct = true, at = T0)), decided = false, on = gone))
            assertEquals(JournalOutcome.DISCARDED, nextLaunch())
            assertFalse(progressFile.exists())
            assertFalse(journalFile.exists())
        }
    }

    @Test
    fun anUnreadableJournalIsDeleted() {
        runBlocking {
            journalFile.writeText("{\"route\":")
            assertEquals(JournalOutcome.NONE, nextLaunch())
            assertFalse(journalFile.exists())
            assertFalse(progressFile.exists())
        }
    }

    @Test
    fun theRoundOfAKilledProcessIsAppliedOnlyOnce() {
        runBlocking {
            killedDuring(entry(Mode.LIVES, listOf(JournalAnswer("tiny-02", given = true, correct = false, at = T0)), decided = false))
            assertEquals(JournalOutcome.ABANDONED, nextLaunch())
            assertEquals(JournalOutcome.NONE, nextLaunch())
            assertEquals(CardHistory(seen = 1, lastCorrect = false, lastSeenAt = T0), stored().cards["tiny-02"])
        }
    }
}
```

- [ ] **Step 24: Watch them fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.ApplyJournalTest')
```

Expected: `> Task :app:compileDebugUnitTestKotlin FAILED` with `Unresolved reference` errors for `JournalOutcome` and `applyJournal`, and `BUILD FAILED`.

- [ ] **Step 25: Write `applyJournal`.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/JournalApply.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.DeckFile
import com.eienmosu.truthy.engine.applyResult
import kotlin.coroutines.cancellation.CancellationException

// What applying a journal at launch did.
enum class JournalOutcome {
    NONE, // no journal, or one that could not be read
    DISCARDED, // a journal with nothing to save, or whose deck could not be loaded
    ABANDONED, // an undecided round: its answers went into the history, last has no score
    RECORDED, // a decided round, recorded as its result would record it
}

// Run once at launch, before the start screen reads progress (spec 4.5): applies a journal left by a killed
// app with the leave rules, then deletes it. The journal is deleted in every case. Apply comes before delete:
// a kill between the two applies the round once more at the next launch (one more seen per card; the record
// and last stay as they were), which is better than losing it.
suspend fun applyJournal(journal: RoundJournal, store: ProgressStore, deck: suspend (String) -> DeckFile): JournalOutcome {
    val entry = journal.pending()
    if (entry == null) {
        journal.clear()
        return JournalOutcome.NONE
    }
    val result = if (entry.recorded || (entry.answers.isEmpty() && !entry.decided)) {
        null
    } else {
        val file = try {
            deck(entry.route.deckId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            null
        }
        file?.let { journalResult(entry, it) }
    }
    if (result != null) store.update { applyResult(it, result).progress }
    journal.clear()
    return when {
        result == null -> JournalOutcome.DISCARDED
        result.abandoned -> JournalOutcome.ABANDONED
        else -> JournalOutcome.RECORDED
    }
}
```

- [ ] **Step 26: Run them green.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.ApplyJournalTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.ApplyJournalTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="10" skipped="0" failures="0"`.

- [ ] **Step 27: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/JournalApply.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/ApplyJournalTest.kt
git commit -m "feat: apply a killed round's journal with the leave rules at Android launch"
```

- [ ] **Step 28: Write the theme store tests and an in-memory SharedPreferences.**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/support/MemoryPrefs.kt`:

```kotlin
package com.eienmosu.truthy.support

import android.content.SharedPreferences

// SharedPreferences in memory, with the platform's behaviour where ThemeStore depends on it: a value of
// another type under a key makes getString throw ClassCastException, and an edit lands on apply or commit.
// With refuseWrites, apply and commit throw, as a broken storage might.
class MemoryPrefs : SharedPreferences {
    val values = mutableMapOf<String, Any?>()
    var refuseWrites = false

    override fun getAll(): MutableMap<String, *> = values.toMutableMap()

    override fun getString(key: String?, defValue: String?): String? =
        if (key != null && key in values) values[key] as String? else defValue

    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? =
        if (key != null && key in values) values[key] as MutableSet<String>? else defValues

    override fun getInt(key: String?, defValue: Int): Int = if (key != null && key in values) values[key] as Int else defValue

    override fun getLong(key: String?, defValue: Long): Long = if (key != null && key in values) values[key] as Long else defValue

    override fun getFloat(key: String?, defValue: Float): Float = if (key != null && key in values) values[key] as Float else defValue

    override fun getBoolean(key: String?, defValue: Boolean): Boolean = if (key != null && key in values) values[key] as Boolean else defValue

    override fun contains(key: String?): Boolean = key != null && key in values

    override fun edit(): SharedPreferences.Editor = MemoryEditor()

    override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

    override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

    private inner class MemoryEditor : SharedPreferences.Editor {
        private val changes = mutableMapOf<String, Any?>()
        private val removals = mutableSetOf<String>()
        private var clearAll = false

        private fun put(key: String?, value: Any?): SharedPreferences.Editor {
            changes[requireNotNull(key)] = value
            return this
        }

        override fun putString(key: String?, value: String?): SharedPreferences.Editor = put(key, value)

        override fun putStringSet(key: String?, set: MutableSet<String>?): SharedPreferences.Editor = put(key, set)

        override fun putInt(key: String?, value: Int): SharedPreferences.Editor = put(key, value)

        override fun putLong(key: String?, value: Long): SharedPreferences.Editor = put(key, value)

        override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = put(key, value)

        override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = put(key, value)

        override fun remove(key: String?): SharedPreferences.Editor {
            removals += requireNotNull(key)
            return this
        }

        override fun clear(): SharedPreferences.Editor {
            clearAll = true
            return this
        }

        override fun commit(): Boolean {
            write()
            return true
        }

        override fun apply() {
            write()
        }

        private fun write() {
            check(!refuseWrites) { "the storage refuses writes" }
            if (clearAll) values.clear()
            removals.forEach { values.remove(it) }
            values.putAll(changes)
        }
    }
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/ThemeStoreTest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.engine.THEME_KEY
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.support.MemoryPrefs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ThemeStoreTest {
    private val prefs = MemoryPrefs()

    @Test
    fun theKeyAndTheFileAreFixed() {
        assertEquals("truthy.theme", THEME_KEY)
        assertEquals("truthy", ThemeStore.PREFS_NAME)
    }

    @Test
    fun nothingStoredFollowsTheSystem() {
        assertNull(ThemeStore(prefs).stored)
    }

    @Test
    fun lightAndDarkAreRead() {
        prefs.values[THEME_KEY] = "light"
        assertEquals(Theme.LIGHT, ThemeStore(prefs).stored)
        prefs.values[THEME_KEY] = "dark"
        assertEquals(Theme.DARK, ThemeStore(prefs).stored)
    }

    @Test
    fun anyOtherStringFollowsTheSystem() {
        for (value in listOf("night", "", "Dark", " dark", "system")) {
            prefs.values[THEME_KEY] = value
            assertNull(ThemeStore(prefs).stored, value)
        }
    }

    @Test
    fun aValueOfAnotherTypeFollowsTheSystem() {
        prefs.values[THEME_KEY] = 1
        assertNull(ThemeStore(prefs).stored)
    }

    @Test
    fun storeKeepsTheWireValueUnderTheWebKey() {
        val store = ThemeStore(prefs)
        store.store(Theme.DARK)
        assertEquals("dark", prefs.values[THEME_KEY])
        assertEquals(Theme.DARK, ThemeStore(prefs).stored)
        store.store(Theme.LIGHT)
        assertEquals("light", prefs.values[THEME_KEY])
    }

    @Test
    fun aStorageThatRefusesIsNeverAnError() {
        prefs.refuseWrites = true
        ThemeStore(prefs).store(Theme.DARK)
        assertNull(ThemeStore(prefs).stored)
    }
}
```

- [ ] **Step 29: Watch them fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.ThemeStoreTest')
```

Expected: `> Task :app:compileDebugUnitTestKotlin FAILED` with `Unresolved reference 'ThemeStore'`, and `BUILD FAILED`. A warning about a parameter name or nullability in `MemoryPrefs` (the platform's annotations) is not an error; any error in `MemoryPrefs` is, and is fixed by matching the signature the compiler names.

- [ ] **Step 30: Write the theme store.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ThemeStore.kt`:

```kotlin
package com.eienmosu.truthy

import android.content.SharedPreferences
import com.eienmosu.truthy.engine.THEME_KEY
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.parseTheme

// The theme a player chose with the switch; null follows the system. The app's name for the engine's Theme.
typealias StoredTheme = Theme

// The stored theme under the web's key "truthy.theme" (reference 6). Read before the first frame (task 11).
// Anything but "light" or "dark", and preferences that throw, follow the system. Storing never throws, and
// nothing removes the key, so there is no way back to following the system, as on the web.
class ThemeStore(private val prefs: SharedPreferences) {
    val stored: StoredTheme?
        get() = try {
            parseTheme(prefs.getString(THEME_KEY, null))
        } catch (e: RuntimeException) {
            null
        }

    fun store(theme: StoredTheme) {
        try {
            prefs.edit().putString(THEME_KEY, theme.wire).apply()
        } catch (e: RuntimeException) {
            // The theme on screen still flips (task 11); only the choice is not kept.
        }
    }

    companion object {
        // The preferences file, shared_prefs/truthy.xml, which the backup rules keep (task 7's name).
        const val PREFS_NAME = StorageNames.PREFS_FILE
    }
}
```

- [ ] **Step 31: Run them green.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.ThemeStoreTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.ThemeStoreTest.xml
```

Expected: `BUILD SUCCESSFUL`; `tests="7" skipped="0" failures="0"`.

- [ ] **Step 32: Commit.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/ThemeStore.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/support/MemoryPrefs.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/ThemeStoreTest.kt
git commit -m "feat: store the Android theme choice under the web's key"
```

- [ ] **Step 33: Pin the stores' file names to the backup rules' names.**

Task 7's backup rules include `StorageNames.PROGRESS_FILE` and `StorageNames.PREFS_FILE` (as `truthy.xml`) and nothing else, and its `BackupRulesTest` checks that. Add this test to the end of the class in `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/FileProgressStoreTest.kt` (before its last closing brace):

```kotlin
    @Test
    fun everyStoreUsesTheNamesTheBackupRulesList() {
        assertEquals(StorageNames.PROGRESS_FILE, FileProgressStore.FILE_NAME)
        assertEquals(StorageNames.UNREADABLE_FILE, FileProgressStore.UNREADABLE_FILE_NAME)
        assertEquals(StorageNames.JOURNAL_FILE, RoundJournal.FILE_NAME)
        assertEquals(StorageNames.PREFS_FILE, ThemeStore.PREFS_NAME)
    }
```

Run it with task 7's backup test:

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.FileProgressStoreTest' --tests 'com.eienmosu.truthy.BackupRulesTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.FileProgressStoreTest.xml
git add android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/FileProgressStoreTest.kt
git commit -m "test: tie the Android stores' file names to the backup rules"
```

Expected: `BUILD SUCCESSFUL`; `tests="15" skipped="0" failures="0"`; task 7's `BackupRulesTest` (in `app/src/test/java`) still passes over its unchanged include-only rule files. There is one `BackupRulesTest` class in the unit test source set, task 7's.

- [ ] **Step 38: Run the gates.**

```bash
(cd android/Truthy && ./gradlew :engine:test :app:testDebugUnitTest :app:assembleDebug)
for t in DeckStoreTest FileStorageTest FileProgressStoreTest RoundJournalTest ApplyJournalTest ThemeStoreTest; do grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.$t.xml; done
unzip -l android/Truthy/app/build/outputs/apk/debug/app-debug.apk | grep -oE 'assets/(index|aws-clf-c02)\.json'
```

Expected: `BUILD SUCCESSFUL`, with the engine's purity test still passing (this task adds nothing to `:engine`). The six result lines show `tests="9"`, `"10"`, `"15"`, `"14"`, `"10"` and `"7"`, each with `skipped="0" failures="0"`, 65 tests in all, beside the app tests of task 7 and 8, which still pass. The `unzip` line prints `assets/aws-clf-c02.json` and `assets/index.json`: the decks sit at the root of the assets, where `DeckStore` reads them. If they sit under another folder, task 7's assets source directory differs from the README's layout: stop and report.

- [ ] **Step 39: Run the web's tests, the hygiene test over the new files included.**

```bash
npx -y pnpm@10.34.0 test
git status --short
```

Expected: every test file passes. `tests/repo-hygiene.test.ts` scans the new Kotlin and XML files: no absolute path, no e-mail-shaped string, no em dash. `git status --short` prints nothing. If the hygiene test names a line, fix the line in the file and amend this task's last commit.
