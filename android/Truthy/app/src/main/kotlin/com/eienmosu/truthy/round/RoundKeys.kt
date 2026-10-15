package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Phase

/** The hardware keys the round acts on (spec section 2). */
enum class RoundKey { LEFT, RIGHT, ENTER, ESCAPE }

sealed interface RoundKeyAction {
    data class Answer(val value: Boolean) : RoundKeyAction
    data object Next : RoundKeyAction
    data object Leave : RoundKeyAction
    /** A repeat of a held key: consumed, nothing happens. */
    data object Swallow : RoundKeyAction
}

/** What a key-down does on the round, or null when the round leaves it alone (PlayScreen.tsx:605-650). */
fun roundKeyAction(key: RoundKey, repeat: Boolean, modified: Boolean, sheetOpen: Boolean, phase: Phase, awaitsNext: Boolean): RoundKeyAction? {
    if (repeat) return RoundKeyAction.Swallow
    if (modified || sheetOpen) return null
    return when (key) {
        RoundKey.ESCAPE -> RoundKeyAction.Leave
        RoundKey.LEFT -> if (phase == Phase.QUESTION) RoundKeyAction.Answer(false) else null
        RoundKey.RIGHT -> if (phase == Phase.QUESTION) RoundKeyAction.Answer(true) else null
        RoundKey.ENTER -> if (awaitsNext) RoundKeyAction.Next else null
    }
}
