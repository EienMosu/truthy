package com.eienmosu.truthy.round

import com.eienmosu.truthy.engine.isDecided
import org.junit.Assert.assertEquals
import org.junit.Test

class LeaveBodyTest {
    @Test
    fun theBodyFollowsWhetherTheRoundIsDecided() {
        assertEquals(LeaveText.OPEN_BODY, LeaveText.body(isDecided(TestRounds.classic(answers = 2, finish = false))))
        assertEquals(LeaveText.DECIDED_BODY, LeaveText.body(isDecided(TestRounds.streakEndedUnopened())))
    }
}
