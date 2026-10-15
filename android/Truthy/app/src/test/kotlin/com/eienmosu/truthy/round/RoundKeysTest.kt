package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.Phase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RoundKeysTest {
    private fun action(key: RoundKey, phase: Phase, awaitsNext: Boolean = false, repeat: Boolean = false, modified: Boolean = false, sheetOpen: Boolean = false) =
        roundKeyAction(key, repeat, modified, sheetOpen, phase, awaitsNext)

    @Test
    fun aHeldKeyActsOnceInEveryPhase() {
        for (key in RoundKey.entries) for (phase in Phase.entries) {
            assertEquals(RoundKeyAction.Swallow, action(key, phase, awaitsNext = true, repeat = true))
        }
    }

    @Test
    fun aKeyWithAModifierIsLeftAlone() {
        for (key in RoundKey.entries) assertNull(action(key, Phase.QUESTION, modified = true))
    }

    @Test
    fun everyKeyIsLeftToTheSheetWhileItIsOpen() {
        for (key in RoundKey.entries) assertNull(action(key, Phase.ANSWERED, awaitsNext = true, sheetOpen = true))
    }

    @Test
    fun escapeAsksToLeaveInEveryPhase() {
        for (phase in listOf(Phase.QUESTION, Phase.ANSWERED, Phase.STAMPED)) {
            assertEquals(RoundKeyAction.Leave, action(RoundKey.ESCAPE, phase))
        }
    }

    @Test
    fun theArrowsAnswerOnlyAQuestion() {
        assertEquals(RoundKeyAction.Answer(false), action(RoundKey.LEFT, Phase.QUESTION))
        assertEquals(RoundKeyAction.Answer(true), action(RoundKey.RIGHT, Phase.QUESTION))
        assertNull(action(RoundKey.RIGHT, Phase.ANSWERED, awaitsNext = true))
        assertNull(action(RoundKey.LEFT, Phase.STAMPED))
    }

    @Test
    fun enterIsTheActionOnlyOnceTheRoundAwaitsNext() {
        assertEquals(RoundKeyAction.Next, action(RoundKey.ENTER, Phase.ANSWERED, awaitsNext = true))
        assertEquals(RoundKeyAction.Next, action(RoundKey.ENTER, Phase.STAMPED, awaitsNext = true))
        assertNull(action(RoundKey.ENTER, Phase.QUESTION))
        assertNull(action(RoundKey.ENTER, Phase.STAMPED, awaitsNext = false))
    }
}
