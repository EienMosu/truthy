package com.eienmosu.truthy.start

import android.view.KeyEvent
import com.eienmosu.truthy.engine.Step

/** What the start flow does with a hardware key: go back one step, swallow it, or leave it to the views. */
enum class StartKey { BACK, CONSUME, PASS }

/**
 * Escape (StartFlow.tsx:653-660; spec section 2, hardware keyboard): one step back on its first key-down; consumed
 * and doing nothing on step 1 and during the unroll, so Android never turns it into back; its repeats and its
 * key-up are consumed too, so a held key acts once. Every other key is left to the views.
 */
fun startKeyAction(keyCode: Int, action: Int, repeatCount: Int, step: Step, boarding: Boolean): StartKey {
    if (keyCode != KeyEvent.KEYCODE_ESCAPE) return StartKey.PASS
    if (action != KeyEvent.ACTION_DOWN || repeatCount > 0 || boarding || step == Step.ONE) return StartKey.CONSUME
    return StartKey.BACK
}
