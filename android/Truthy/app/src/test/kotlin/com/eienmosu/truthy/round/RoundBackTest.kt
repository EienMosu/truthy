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
