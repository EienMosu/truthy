// JavaScript number operations the TypeScript engine relies on, written out so the port gives the same bits.
// Internal: the engine files use them, and the tests of this module reach them directly.
package com.eienmosu.truthy.engine

import kotlin.math.floor
import kotlin.math.truncate

private const val TWO_TO_THE_32 = 4294967296.0

/** `x >>> 0`: ToUint32, as a Long from 0 to 2^32 - 1. Truncates toward zero and wraps; NaN and the infinities give 0. */
internal fun jsUint32(x: Double): Long {
    if (!x.isFinite()) return 0L
    val wrapped = truncate(x) % TWO_TO_THE_32
    return (if (wrapped < 0) wrapped + TWO_TO_THE_32 else wrapped).toLong()
}

/**
 * `Math.round(x)`: the nearest integer, a half rounding toward +infinity, -0 for x in [-0.5, -0].
 * Not `kotlin.math.round` (half to even) and not `roundToInt` (half away from zero). `floor(x + 0.5)` is wrong
 * where x + 0.5 is not exact (0.49999999999999994, odd numbers above 2^52); the fraction `x - floor(x)` is
 * always exact, so the comparison is too.
 */
internal fun jsRound(x: Double): Double {
    if (!x.isFinite()) return x
    val down = floor(x)
    val result = if (x - down >= 0.5) down + 1.0 else down
    return if (result == 0.0 && x.toRawBits() < 0L) -0.0 else result
}
