package com.eienmosu.truthy.stories

import android.os.SystemClock
import androidx.activity.BackEventCompat
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.MainActivity
import com.eienmosu.truthy.support.ARRIVAL_MS
import com.eienmosu.truthy.support.CLF_ID
import com.eienmosu.truthy.support.CLF_SECURITY
import com.eienmosu.truthy.support.DeckAnswers
import com.eienmosu.truthy.support.Device
import com.eienmosu.truthy.support.RESULT_MS
import com.eienmosu.truthy.support.SETTLE_MS
import com.eienmosu.truthy.support.SHEET_TITLE
import com.eienmosu.truthy.support.Ui
import com.eienmosu.truthy.support.button
import com.eienmosu.truthy.support.inClass
import com.eienmosu.truthy.support.label
import com.eienmosu.truthy.support.roundHeading
import com.eienmosu.truthy.ui.TestTags
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs

@RunWith(AndroidJUnit4::class)
class BackTest {
    @get:Rule val rule = createEmptyComposeRule()
    private val ui = Ui(rule)

    @Before fun firstLaunch() = Device.reset()

    // ---------- a predictive back gesture, as the system feeds it on API 34 and later ----------

    private fun event(progress: Float) = BackEventCompat(8f, 1_000f, progress, BackEventCompat.EDGE_LEFT)

    private fun begin(scenario: ActivityScenario<MainActivity>) {
        scenario.onActivity { activity -> activity.onBackPressedDispatcher.dispatchOnBackStarted(event(0f)) }
        ui.idle()
    }

    private fun scrub(scenario: ActivityScenario<MainActivity>, progress: Float) {
        scenario.onActivity { activity -> activity.onBackPressedDispatcher.dispatchOnBackProgressed(event(progress)) }
        ui.idle()
    }

    private fun commit(scenario: ActivityScenario<MainActivity>) {
        scenario.onActivity { activity -> activity.onBackPressedDispatcher.onBackPressed() }
        ui.idle()
    }

    private fun cancel(scenario: ActivityScenario<MainActivity>) {
        scenario.onActivity { activity -> activity.onBackPressedDispatcher.dispatchOnBackCancelled() }
        ui.idle()
    }

    private fun assertAtRest(expected: Rect, actual: Rect, what: String) {
        val off = listOf(expected.left - actual.left, expected.top - actual.top, expected.width - actual.width, expected.height - actual.height)
        assertTrue("$what is not at rest: expected $expected, was $actual", off.all { abs(it) <= 0.5f })
    }

    // ---------- the start flow (spec 5.1) ----------

    @Test fun aScrubbedBackCommitsOneStepAndClearsItsChoice() {
        Device.launch().use { scenario ->
            ui.atHome()
            val homeTitle = ui.boundsDp(label("Choose an area"))
            ui.choose(CLF_SECURITY.area)
            ui.atStep("Choose a platform")
            ui.waitFor(button("Change area, now Cloud"))

            begin(scenario)
            for (p in listOf(0.2f, 0.5f, 0.8f)) scrub(scenario, p)
            // Mid-gesture nothing is decided: the step being left is still there.
            // The step being left is drawn but cleared from the merged tree while it leaves (task 12 StepPanel).
            assertTrue(ui.exists(label("Choose a platform"), unmerged = true))
            commit(scenario)

            ui.atStep("Choose an area")
            ui.waitGone(label("Choose a platform"))
            assertFalse("the area choice is cleared", ui.exists(hasTestTag(TestTags.PASS)))
            assertAtRest(homeTitle, ui.boundsDp(label("Choose an area")), "the step 1 title")
        }
    }

    @Test fun aCancelledBackChangesNothing() {
        Device.launch().use { scenario ->
            ui.atHome()
            ui.choose(CLF_SECURITY.area)
            ui.atStep("Choose a platform")
            val title = ui.boundsDp(label("Choose a platform"))
            val option = ui.boundsDp(button(CLF_SECURITY.platform))

            begin(scenario)
            scrub(scenario, 0.3f)
            scrub(scenario, 0.6f)
            cancel(scenario)

            ui.atStep("Choose a platform")
            assertFalse(ui.exists(label("Choose an area")))
            ui.waitFor(button("Change area, now Cloud"))
            assertAtRest(title, ui.boundsDp(label("Choose a platform")), "the step 2 title")
            assertAtRest(option, ui.boundsDp(button(CLF_SECURITY.platform)), "the AWS card")
        }
    }

    @Test fun theSystemBackKeyCommitsAtOnceWithEverythingAtRest() {
        Device.launch().use {
            ui.atHome()
            val homeTitle = ui.boundsDp(label("Choose an area"))
            ui.choose(CLF_SECURITY.area)
            ui.atStep("Choose a platform")
            val platformTitle = ui.boundsDp(label("Choose a platform"))
            ui.choose(CLF_SECURITY.platform)
            ui.atStep("Choose a deck")

            Espresso.pressBackUnconditionally()
            ui.atStep("Choose a platform")
            ui.waitGone(button("Change platform, now AWS"))
            ui.waitFor(button("Change area, now Cloud"))
            assertAtRest(platformTitle, ui.boundsDp(label("Choose a platform")), "the step 2 title")

            Espresso.pressBackUnconditionally()
            ui.atStep("Choose an area")
            assertFalse(ui.exists(hasTestTag(TestTags.PASS)))
            assertAtRest(homeTitle, ui.boundsDp(label("Choose an area")), "the step 1 title")
        }
    }

    @Test fun backOnStepOneGoesToTheSystem() {
        Device.launch().use { scenario ->
            ui.atHome()
            Espresso.pressBackUnconditionally()
            // API 31 and later move a root activity to the back; older versions finish it.
            rule.waitUntil(3_000) { scenario.state != Lifecycle.State.RESUMED }
        }
    }

    @Test fun backDuringTheUnrollIsConsumed() {
        Device.launch().use { scenario ->
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            rule.mainClock.autoAdvance = false
            ui.tap(button("Start round"), idle = false)
            // The 360 ms unroll has started and is held by the test clock: this back arrives during it.
            scenario.onActivity { activity -> activity.onBackPressedDispatcher.onBackPressed() }
            rule.mainClock.autoAdvance = true
            ui.waitFor(label(roundHeading("Classic")))
            assertFalse(ui.exists(label("Choose how to play")))
        }
    }

    // ---------- the round (spec 5.2, feel item N13) ----------

    @Test fun backOnTheRoundShrinksTheSurfaceAndLeavesWithNoAnswers() {
        Device.launch().use { scenario ->
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            ui.cardOnScreen(DeckAnswers(CLF_ID))
            ui.idle()
            val surface = hasTestTag(TestTags.ROUND_SURFACE)
            val rest = ui.boundsDp(surface)

            begin(scenario)
            scrub(scenario, 0.5f)
            val half = ui.boundsDp(surface)
            assertEquals(rest.width * 0.97f, half.width, 1f)
            assertEquals(rest.center.x, half.center.x, 1f)
            assertEquals(rest.center.y, half.center.y, 1f)
            cancel(scenario)
            assertAtRest(rest, ui.boundsDp(surface), "the round surface")
            ui.waitFor(button("True"))

            begin(scenario)
            scrub(scenario, 0.8f)
            commit(scenario)
            ui.atHome()
        }
    }

    @Test fun backOnTheRoundWithAnswersOpensTheSheetAndBackKeepsPlaying() {
        Device.launch().use {
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY)
            ui.startRound()
            val card = ui.cardOnScreen(DeckAnswers(CLF_ID))
            SystemClock.sleep(SETTLE_MS)
            ui.answer(card, right = true)
            ui.waitFor(button("Next card"))

            Espresso.pressBackUnconditionally()
            ui.waitFor(SHEET_TITLE)
            Espresso.pressBackUnconditionally()
            ui.waitGone(SHEET_TITLE)
            ui.waitFor(button("Next card"))
        }
    }

    @Test fun backOnTheResultWaitsForItsGuardThenClosesIt() {
        Device.launch().use { scenario ->
            ui.atHome()
            ui.chooseRoute(CLF_SECURITY.inClass("Streak"))
            ui.startRound()
            val card = ui.cardOnScreen(DeckAnswers(CLF_ID))
            SystemClock.sleep(SETTLE_MS)
            ui.answer(card, right = false)
            val see = button("See results")
            ui.waitFor(see)
            SystemClock.sleep(ARRIVAL_MS)

            val tappedAt = SystemClock.uptimeMillis()
            ui.tap(see, idle = false)
            ui.waitFor(label("Round complete"))
            scenario.onActivity { activity -> activity.onBackPressedDispatcher.onBackPressed() }
            val early = SystemClock.uptimeMillis() - tappedAt
            assumeTrue("back came $early ms after See results: too late to test the 1000 ms guard", early < 900)
            ui.idle()
            assertTrue("back closed the result before its 1000 ms", ui.exists(label("Round complete")))

            SystemClock.sleep(RESULT_MS)
            Espresso.pressBackUnconditionally()
            ui.atHome()
        }
    }
}
