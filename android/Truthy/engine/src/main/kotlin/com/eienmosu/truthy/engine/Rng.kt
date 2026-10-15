// Seeded randomness for the engine (src/engine/rng.ts). The engine never draws from the system: a round gets
// one generator from its seed, so the same seed and the same events always give the same round on every platform.
package com.eienmosu.truthy.engine

import kotlin.math.floor

/** Uniform in [0, 1). */
typealias Rng = () -> Double

/**
 * mulberry32. The seed is taken as an unsigned 32-bit integer (`seed >>> 0`): -1 is 2^32 - 1, 1.9 is 1,
 * 2^32 + 1 is 1. The state lives in an Int: Kotlin's Int `+` and `*` wrap like `>>> 0` and `Math.imul`,
 * `ushr` is `>>>`, and the draw reads the final 32 bits as unsigned.
 */
fun createRng(seed: Double): Rng {
    var state = jsUint32(seed).toInt()
    return {
        state += 0x6d2b79f5
        var t = state
        t = (t xor (t ushr 15)) * (t or 1)
        t = t xor (t + (t xor (t ushr 7)) * (t or 61))
        ((t xor (t ushr 14)).toLong() and 0xFFFFFFFFL).toDouble() / 4294967296.0
    }
}

/** Fisher-Yates from the end. Returns a new list; draws exactly items.size - 1 numbers (none for 0 or 1 item). */
fun <T> shuffle(items: List<T>, rng: Rng): List<T> {
    val result = items.toMutableList()
    var i = result.size - 1
    while (i > 0) {
        val j = floor(rng() * (i + 1)).toInt()
        val held = result[i]
        result[i] = result[j]
        result[j] = held
        i--
    }
    return result
}
