package com.eienmosu.truthy.stories

import android.graphics.Rect
import android.os.Build
import android.view.accessibility.AccessibilityNodeInfo
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.WAIT_MS
import com.eienmosu.truthy.support.label
import com.eienmosu.truthy.support.roundHeading
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * What a screen reader is handed (spec section 2, reference 4.5 and 5.9), read from the accessibility tree the system
 * builds for TalkBack, not from Compose's own semantics: the system marks a node that lies under another window (the
 * status bar) as not visible to the user, and TalkBack never reaches it.
 */
@RunWith(AndroidJUnit4::class)
class ScreenReaderTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    private fun find(root: AccessibilityNodeInfo, matches: (String) -> Boolean): AccessibilityNodeInfo? {
        val said = root.contentDescription?.toString() ?: root.text?.toString()
        if (said != null && matches(said)) return root
        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            find(child, matches)?.let { return it }
        }
        return null
    }

    /** The node the system hands an accessibility service for what [matches], once the tree has it. */
    private fun systemNode(what: String, matches: (String) -> Boolean = { it == what }): AccessibilityNodeInfo {
        val automation = Device.instrumentation.uiAutomation
        var found: AccessibilityNodeInfo? = null
        rule.waitUntil(WAIT_MS) {
            found = automation.rootInActiveWindow?.let { find(it, matches) }
            found != null
        }
        return checkNotNull(found) { "the system tree has $what" }
    }

    private fun boundsOf(node: AccessibilityNodeInfo): Rect = Rect().also(node::getBoundsInScreen)

    @Test fun theRoundHeadingAndStatusReachTalkBackAndTheHeadingComesBeforeTheX() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            val heading = roundHeading("Classic")
            ui.waitFor(label(heading))
            ui.idle()
            val node = systemNode(heading)
            assertTrue("TalkBack skips a node the system marks as not visible: \"$heading\"", node.isVisibleToUser)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) assertTrue("\"$heading\" is a heading", node.isHeading)
            val x = boundsOf(systemNode("Leave round"))
            val at = boundsOf(node)
            assertTrue("the heading $at is not below the X $x", at.top <= x.top)
            assertTrue("the heading $at starts where the X $x does", at.left <= x.left)

            // The status live region is handed over as well: after an answer it says the verdict.
            ui.answer(ui.cardOnScreen(DeckAnswers(CLF_ID)), right = true)
            val status = systemNode("the verdict") { it.startsWith("Correct. ") || it.startsWith("Not quite. ") }
            assertTrue("the status is visible to TalkBack", status.isVisibleToUser)
        }
    }
}
