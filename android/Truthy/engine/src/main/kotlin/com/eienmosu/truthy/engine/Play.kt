// What a round is made of, as far as both the engine and the progress need to know (src/content/play.ts).
// Types and one constant, no behaviour.
package com.eienmosu.truthy.engine

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** The class of a round. `wire` is the TypeScript string; the record keys and the progress file use it. */
@Serializable
enum class Mode(val wire: String) {
    @SerialName("classic")
    CLASSIC("classic"),

    @SerialName("streak")
    STREAK("streak"),

    @SerialName("lives")
    LIVES("lives"),

    @SerialName("timed")
    TIMED("timed"),
}

/** play.ts: MODES, in the order the class step lists them. */
val MODES: List<Mode> = listOf(Mode.CLASSIC, Mode.STREAK, Mode.LIVES, Mode.TIMED)

@Serializable
data class CardHistory(
    val seen: Long,
    val lastCorrect: Boolean,
    /** Epoch milliseconds. A value that is not finite counts as 0 when dealing. */
    val lastSeenAt: Double,
)

/** Card history by card id. */
typealias History = Map<String, CardHistory>

@Serializable
data class Answered(
    val card: Card,
    val given: Boolean,
    val correct: Boolean,
    /** Epoch milliseconds, from the same clock as Timed's tick and visibility events. */
    val at: Double,
)

@Serializable
data class RoundResult(
    val mode: Mode,
    val route: Route,
    /** The number the class's record keeps. */
    val score: Int,
    /** Cards answered. */
    val total: Int,
    val answers: List<Answered>,
    /** The answers with `correct == false`, in order. */
    val missed: List<Answered>,
    val abandoned: Boolean,
)
