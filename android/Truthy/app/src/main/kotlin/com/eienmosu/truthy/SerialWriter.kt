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
