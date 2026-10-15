package com.eienmosu.truthy

import android.view.KeyEvent
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HardwareKeysTest {
    // Task 15's BackTest on API 26: below API 33 the back key reached the views first, and Compose turned it into a
    // focus exit inside the round, so back on a round with answers never opened the sheet.
    @Test fun belowApi33TheBackKeyGoesStraightToTheBackDispatcher() {
        for (sdk in listOf(26, 29, 32)) assertTrue("API $sdk", backSkipsViews(sdk, KeyEvent.KEYCODE_BACK))
    }

    @Test fun fromApi33BackArrivesAsACallbackAndKeysAreLeftAlone() {
        for (sdk in listOf(33, 34, 36)) assertFalse("API $sdk", backSkipsViews(sdk, KeyEvent.KEYCODE_BACK))
    }

    @Test fun otherKeysStillReachTheViews() {
        for (key in listOf(KeyEvent.KEYCODE_ESCAPE, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_TAB)) {
            assertFalse("key $key", backSkipsViews(26, key))
        }
    }
}
