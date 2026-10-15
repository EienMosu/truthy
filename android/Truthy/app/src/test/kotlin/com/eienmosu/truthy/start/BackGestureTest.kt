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
