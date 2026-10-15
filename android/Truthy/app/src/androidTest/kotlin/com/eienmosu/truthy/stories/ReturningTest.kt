package com.eienmosu.truthy.stories

import android.os.SystemClock
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.support.CDL_ID
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.CONTINUE_CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.RESULT_MS
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.button
import com.eienmosu.truthy.support.label
import com.eienmosu.truthy.support.roundHeading
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ReturningTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    @Test fun recentDecksSkipThePlatformStepNewestFirst() {
        // History on one card of each deck, CDL seen last, as e2e/recent-decks.spec.ts stores it.
        val clf = DeckAnswers(CLF_ID).deck.cards.first().id
        val cdl = DeckAnswers(CDL_ID).deck.cards.first().id
        Device.storeProgress(
            """{"version":1,"cards":{"$clf":{"seen":1,"lastCorrect":true,"lastSeenAt":1000},""" +
                """"$cdl":{"seen":1,"lastCorrect":true,"lastSeenAt":1001}},"records":{},"last":null}""",
        )
        Device.launch().use {
            ui.atHome()
            ui.choose(Regex("Recent, 2 decks"))
            ui.atStep("Choose a deck")
            val cdlTop = ui.boundsDp(button(Regex("CDL, Cloud Digital Leader, \\d+ cards, .*"))).top
            val clfTop = ui.boundsDp(button(CLF_SECURITY.deck)).top
            assertTrue("the newest deck comes first", cdlTop < clfTop)

            ui.choose(CLF_SECURITY.deck)
            ui.atStep("Choose a section")
            // The deck filled in the area and the platform: the pass offers them as ways back.
            ui.waitFor(button("Change platform, now AWS"))
            ui.waitFor(button("Change area, now Cloud"))
            ui.choose(checkNotNull(CLF_SECURITY.section))
            ui.atStep("Choose how to play")
            ui.choose(CLF_SECURITY.mode)
            ui.atStep("Your pass is ready")
            ui.startRound()
            ui.waitFor(button("Leave round"))
            ui.waitFor(label(roundHeading("Classic")))
        }
    }

    @Test fun theContinueLineLeadsToTheReadyPassAndBackRetracesTheSteps() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            ui.playClassic(DeckAnswers(CLF_ID), wrongOn = setOf(2))
            ui.waitForResult()
            SystemClock.sleep(RESULT_MS)
            // Choose another route sits under the result's stage, outside every scroll: always on screen.
            ui.tap(button("Choose another route"))
            ui.atHome()

            ui.tap(button("$CONTINUE_CLF_SECURITY Last score 9 of 10."))
            ui.atStep("Your pass is ready")
            ui.waitFor(button("Change deck, now CLF"))
            ui.waitFor(button("Change section, now SEC"))
            ui.waitFor(button("Change class, now Classic"))

            // The whole path was pushed: Back retraces 5, 4, 3, 2 and 1.
            val back = listOf(
                "Back to classes" to "Choose how to play",
                "Back to sections" to "Choose a section",
                "Back to decks" to "Choose a deck",
                "Back to platforms" to "Choose a platform",
                "Back to areas" to "Choose an area",
            )
            for ((pill, title) in back) {
                ui.tap(button(pill))
                ui.atStep(title)
            }
        }
    }
}
