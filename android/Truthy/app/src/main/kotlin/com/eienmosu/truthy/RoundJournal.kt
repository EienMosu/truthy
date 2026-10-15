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
