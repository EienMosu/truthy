package com.eienmosu.truthy.start

import android.view.KeyEvent
import com.eienmosu.truthy.engine.Step
import org.junit.Assert.assertEquals
import org.junit.Test

class StartKeysTest {
    private fun escape(action: Int = KeyEvent.ACTION_DOWN, repeat: Int = 0, step: Step = Step.THREE, boarding: Boolean = false) =
        startKeyAction(KeyEvent.KEYCODE_ESCAPE, action, repeat, step, boarding)

    @Test
    fun escapeGoesBackOneStepOnceAndIsConsumedEverywhereElse() {
        assertEquals(StartKey.BACK, escape())
        assertEquals(StartKey.BACK, escape(step = Step.TWO))
        assertEquals(StartKey.CONSUME, escape(step = Step.ONE))          // nothing to go back to, and never Android's back
        assertEquals(StartKey.CONSUME, escape(repeat = 1))               // a held key acts once
        assertEquals(StartKey.CONSUME, escape(action = KeyEvent.ACTION_UP))
        assertEquals(StartKey.CONSUME, escape(boarding = true))          // the unroll ignores every back
    }

    @Test
    fun otherKeysAreLeftToTheViews() {
        assertEquals(StartKey.PASS, startKeyAction(KeyEvent.KEYCODE_ENTER, KeyEvent.ACTION_DOWN, 0, Step.THREE, false))
        assertEquals(StartKey.PASS, startKeyAction(KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.ACTION_DOWN, 0, Step.ONE, false))
    }
}
