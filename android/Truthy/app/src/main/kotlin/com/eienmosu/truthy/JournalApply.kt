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
