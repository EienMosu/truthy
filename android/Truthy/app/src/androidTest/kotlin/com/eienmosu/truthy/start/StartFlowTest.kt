package com.eienmosu.truthy.start

import android.content.Context
import android.os.SystemClock
import android.view.KeyEvent
import androidx.activity.BackEventCompat
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.eienmosu.truthy.MainActivity
import com.eienmosu.truthy.ROUND_TAG
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StartFlowTest {
    @get:Rule
    val compose = createEmptyComposeRule()

    private var scenario: ActivityScenario<MainActivity>? = null
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context: Context get() = instrumentation.targetContext

    @After
    fun close() {
        scenario?.close()
    }

    /** A fresh install's state (no progress, no round journal, no stored theme), or the given progress, then the app at step 1. */
    private fun launch(progressJson: String? = null) {
        val files = context.filesDir
        for (name in STORE_FILES) for (suffix in listOf("", ".bak", ".new")) File(files, name + suffix).delete()
        File(context.applicationInfo.dataDir, "shared_prefs").listFiles()?.forEach { file ->
            context.getSharedPreferences(file.name.removeSuffix(".xml"), Context.MODE_PRIVATE).edit().clear().commit()
        }
        if (progressJson != null) File(files, PROGRESS_FILE).writeText(progressJson)
        scenario = ActivityScenario.launch(MainActivity::class.java)
        compose.waitUntil(TIMEOUT_MS) { exists("Cloud, 17 decks") }
        compose.waitForIdle()
    }

    private fun labelled(label: String, substring: Boolean = false): SemanticsMatcher =
        hasContentDescription(label, substring = substring) or hasText(label, substring = substring)

    private fun exists(label: String, substring: Boolean = false): Boolean =
        compose.onAllNodes(labelled(label, substring)).fetchSemanticsNodes().isNotEmpty()

    private fun count(label: String): Int = compose.onAllNodes(labelled(label)).fetchSemanticsNodes().size

    /** A way forward: after the settle time, press the card and wait for the next step's title. */
    private fun choose(label: String, arrivesAt: String, substring: Boolean = false, scroll: Boolean = true) {
        SystemClock.sleep(SETTLE_WAIT_MS)
        val node = compose.onNode(labelled(label, substring))
        // The Continue line is drawn outside the step's scrolling list: it is pressed where it is.
        if (scroll) node.performScrollTo()
        node.performClick()
        compose.waitUntil(TIMEOUT_MS) { exists(arrivesAt) }
        compose.waitForIdle()
    }

    /** A way back: never held by the settle time. */
    private fun goBack(label: String, arrivesAt: String) {
        compose.onNode(labelled(label)).performClick()
        compose.waitUntil(TIMEOUT_MS) { exists(arrivesAt) }
        compose.waitForIdle()
    }

    private fun toDecks() {
        choose("Cloud, 17 decks", "Choose a platform")
        choose("AWS, 7 decks", "Choose a deck")
    }

    private fun onActivity(block: (MainActivity) -> Unit) {
        checkNotNull(scenario).onActivity { block(it) }
    }

    private fun backEvent(progress: Float) = BackEventCompat(touchX = 120f * progress, touchY = 400f, progress = progress, swipeEdge = BackEventCompat.EDGE_LEFT)

    @Test
    fun walksTheWholePathAndFillsThePass() {
        launch()
        choose("Cloud, 17 decks", "Choose a platform")
        assertTrue(exists("Change area, now Cloud"))
        assertEquals(2, count("not chosen"))
        choose("AWS, 7 decks", "Choose a deck")
        assertTrue(exists("Change platform, now AWS"))
        choose("CLF, Cloud Practitioner, 214 cards, not started", "Choose a section")
        assertTrue(exists("Change deck, now CLF"))
        assertTrue(exists("Whole deck, all 4 sections, 214 cards"))
        choose("SEC, Security and compliance, ", "Choose how to play", substring = true)
        assertTrue(exists("Change section, now SEC"))
        choose("Classic. Correct answers out of 10 cards. Not played yet.", "Your pass is ready")
        assertTrue(exists("Correct answers out of 10 cards. Swipe right for true, left for false."))
        assertTrue(exists("Change class, now Classic"))
        assertTrue(exists("Start round"))
        assertTrue(exists("Back to classes"))
    }

    @Test
    fun startRoundSurvivesARecreationDuringTheUnroll() {
        launch()
        choose("Cloud, 17 decks", "Choose a platform")
        choose("AWS, 7 decks", "Choose a deck")
        choose("CLF, Cloud Practitioner, 214 cards, not started", "Choose a section")
        choose("SEC, Security and compliance, ", "Choose how to play", substring = true)
        choose("Classic. Correct answers out of 10 cards. Not played yet.", "Your pass is ready")
        SystemClock.sleep(SETTLE_WAIT_MS)
        compose.mainClock.autoAdvance = false
        compose.onNode(labelled("Start round")).performClick()
        // Boarding starts while the paper is still unrolling: the recreation drops the remembered request.
        compose.mainClock.advanceTimeByFrame()
        checkNotNull(scenario).recreate()
        compose.mainClock.autoAdvance = true
        compose.waitUntil(TIMEOUT_MS) { compose.onAllNodes(hasTestTag(ROUND_TAG)).fetchSemanticsNodes().isNotEmpty() }
    }

    @Test
    fun theBackPillAndThePassFieldsGoBackAndClearTheLaterChoices() {
        launch()
        toDecks()
        goBack("Back to platforms", "Choose a platform")
        assertFalse(exists("Change platform, now AWS"))
        choose("AWS, 7 decks", "Choose a deck")
        choose("CLF, Cloud Practitioner, 214 cards, not started", "Choose a section")
        goBack("Change area, now Cloud", "Choose an area")
        assertFalse(exists("Change area, now Cloud"))
        assertTrue(exists("Cloud, 17 decks"))
    }

    @Test
    fun escapeGoesBackOneStepAndDoesNothingOnStep1() {
        launch()
        choose("Cloud, 17 decks", "Choose a platform")
        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ESCAPE)
        compose.waitUntil(TIMEOUT_MS) { exists("Choose an area") }
        compose.waitForIdle()
        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ESCAPE)
        compose.waitForIdle()
        assertTrue(exists("Choose an area"))
        assertEquals(Lifecycle.State.RESUMED, checkNotNull(scenario).state)
    }

    @Test
    fun predictiveBackScrubsTheBackMotionAndACancelChangesNothing() {
        launch()
        toDecks()
        onActivity { it.onBackPressedDispatcher.dispatchOnBackStarted(backEvent(0f)) }
        onActivity { it.onBackPressedDispatcher.dispatchOnBackProgressed(backEvent(0.5f)) }
        compose.waitForIdle()
        assertTrue(exists("Choose a platform"))           // the step behind, halfway in
        assertFalse(exists("Choose a deck"))              // the step being left is drawn but no longer read out
        onActivity { it.onBackPressedDispatcher.dispatchOnBackCancelled() }
        compose.waitUntil(TIMEOUT_MS) { exists("Choose a deck") }
        compose.waitForIdle()
        assertFalse(exists("Choose a platform"))
        assertTrue(exists("Change platform, now AWS"))
    }

    @Test
    fun aBackWithoutProgressCommitsAtOnce() {
        launch()
        toDecks()
        onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
        assertTrue(exists("Choose a platform"))
        assertFalse(exists("Choose a deck"))
        assertFalse(exists("Change platform, now AWS"))
    }

    @Test
    fun releasingAfterProgressFinishesTheBack() {
        launch()
        toDecks()
        onActivity { it.onBackPressedDispatcher.dispatchOnBackStarted(backEvent(0f)) }
        onActivity { it.onBackPressedDispatcher.dispatchOnBackProgressed(backEvent(0.6f)) }
        onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitUntil(TIMEOUT_MS) { exists("Choose a platform") && !exists("Choose a deck") }
        compose.waitForIdle()
        assertFalse(exists("Change platform, now AWS"))
    }

    @Test
    fun backOnStep1IsTheSystemsBack() {
        launch()
        Espresso.pressBackUnconditionally()
        val deadline = SystemClock.uptimeMillis() + TIMEOUT_MS
        while (checkNotNull(scenario).state == Lifecycle.State.RESUMED && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(50)
        assertNotEquals(Lifecycle.State.RESUMED, checkNotNull(scenario).state)
    }

    @Test
    fun recentLeadsToTheDecksPlayedLastAndChangePlatformOpensItsOwnDeckStep() {
        launch(PLAYED)
        assertTrue(exists("Recent, 2 decks"))
        choose("Recent, 2 decks", "Choose a deck")
        assertTrue(exists("CDL, Cloud Digital Leader, 133 cards, 1 percent seen"))
        assertTrue(exists("Back to areas"))
        choose("CLF, Cloud Practitioner, 214 cards, 1 percent seen", "Choose a section")
        assertTrue(exists("Change area, now Cloud"))
        assertTrue(exists("Change platform, now AWS"))
        assertTrue(exists("Back to decks"))
        goBack("Change platform, now AWS", "Choose a deck")
        assertTrue(exists("Back to platforms"))
        assertTrue(exists("CLF, Cloud Practitioner, 214 cards, 1 percent seen"))
        goBack("Back to platforms", "Choose a platform")
    }

    @Test
    fun continueFillsThePassAndBackRetracesTheSteps() {
        launch(PLAYED)
        choose("Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.", "Your pass is ready", scroll = false)
        assertTrue(exists("Change section, now SEC"))
        assertTrue(exists("Change class, now Classic"))
        goBack("Back to classes", "Choose how to play")
        goBack("Back to sections", "Choose a section")
    }

    @Test
    fun theThemeSwitchFlipsTheThemeAndKeepsIt() {
        launch()
        val night = exists("Switch to light theme")
        val before = if (night) "Switch to light theme" else "Switch to dark theme"
        val after = if (night) "Switch to dark theme" else "Switch to light theme"
        compose.onNode(labelled(before)).performClick()
        compose.waitUntil(TIMEOUT_MS) { exists(after) }
        assertTrue(exists("Choose an area"))
        checkNotNull(scenario).recreate()
        compose.waitUntil(TIMEOUT_MS) { exists(after) }
    }

    private companion object {
        const val TIMEOUT_MS = 5_000L
        const val SETTLE_WAIT_MS = 300L
        const val PROGRESS_FILE = "truthy.progress.v1.json"
        val STORE_FILES = listOf(PROGRESS_FILE, "truthy.progress.v1.unreadable.json", "truthy.round.v1.json")

        /** Two decks played (CLF last), the record 7 on CLF SEC Classic, and that route as the last round. Real card ids: the start screen prunes unknown ones. */
        val PLAYED = """{"version":1,"cards":{"aws-clf-c02-t1.1-01":{"seen":1,"lastCorrect":true,"lastSeenAt":2000},""" +
            """"gcp-cdl-s1.1-01":{"seen":1,"lastCorrect":false,"lastSeenAt":1000}},"records":{"aws-clf-c02/SEC#classic":7},""" +
            """"last":{"route":{"deckId":"aws-clf-c02","sectionId":"SEC"},"mode":"classic","score":7,"total":10}}"""
    }
}
