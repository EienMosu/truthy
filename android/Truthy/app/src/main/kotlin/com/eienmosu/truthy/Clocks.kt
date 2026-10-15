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
