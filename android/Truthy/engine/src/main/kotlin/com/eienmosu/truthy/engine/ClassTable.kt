package com.eienmosu.truthy.engine

// The one table of classes (src/app-state/modes.ts): what the class step, the ticket, the continue line and the
// result say about each, and whether the class step offers it. The engine can play more modes than are offered:
// `offered` is the only gate between a finished mode and the player.

data class ModeInfo(
    val id: Mode,
    /** The class name: on the class card, the pass, the ticket and the continue line. */
    val name: String,
    /** What the class scores, in one sentence: on the class card and the ready pass. */
    val description: String,
    /** The unit of a best on the class card: "of 10", "in a row", "cards", "correct". */
    val unit: String,
    /** False: the class step shows it as "Not available yet" and it cannot be chosen or continued. */
    val offered: Boolean,
)

val MODE_TABLE: List<ModeInfo> =
    listOf(
        ModeInfo(Mode.CLASSIC, "Classic", "Correct answers out of 10 cards.", "of 10", true),
        ModeInfo(Mode.STREAK, "Streak", "Correct answers in a row, until the first wrong one.", "in a row", true),
        ModeInfo(Mode.LIVES, "Three lives", "Cards answered until the third wrong one.", "cards", true),
        ModeInfo(Mode.TIMED, "Timed", "Correct answers in one minute, wrong ones cost nothing.", "correct", true),
    )

/** The message of the error for a class the table does not know, as the web words it. */
fun unknownModeMessage(wire: String): String = "Unknown mode \"$wire\"."

/** The row of the mode. Throws for a mode the table does not know. */
fun modeInfo(mode: Mode, table: List<ModeInfo> = MODE_TABLE): ModeInfo =
    table.firstOrNull { it.id == mode } ?: throw IllegalArgumentException(unknownModeMessage(mode.wire))

/** The row of the class with this name. Throws for a name that is no class, or that the table does not know. */
fun modeInfo(wire: String, table: List<ModeInfo> = MODE_TABLE): ModeInfo {
    val mode = Mode.entries.firstOrNull { it.wire == wire } ?: throw IllegalArgumentException(unknownModeMessage(wire))
    return modeInfo(mode, table)
}

/** Whether the class step offers the mode. */
fun isOffered(mode: Mode, table: List<ModeInfo> = MODE_TABLE): Boolean = modeInfo(mode, table).offered

fun isOffered(wire: String, table: List<ModeInfo> = MODE_TABLE): Boolean = modeInfo(wire, table).offered

/** The score of a finished round as the continue line says it: "7 of 10", "13 in a row", "21 cards", "14 correct". */
fun lastScoreText(mode: Mode, score: Int, total: Int): String =
    if (mode == Mode.CLASSIC) "$score of $total" else "$score ${modeInfo(mode).unit}"
