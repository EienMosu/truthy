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
