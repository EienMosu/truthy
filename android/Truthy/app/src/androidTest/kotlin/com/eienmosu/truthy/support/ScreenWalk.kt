package com.eienmosu.truthy.support

import android.os.SystemClock
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasTestTag
import com.eienmosu.truthy.ui.TestTags

/** The seed of the review's round, the same on the web (screens.mjs SEED) and in plan B's review. */
const val REVIEW_SEED = 1_234_567L

/**
 * The reviewed states in walk order, with the ids plan B's review uses, and the elements whose frames are compared.
 * screens.mjs mirrors this map (compare.test.mjs pins it). The Timed stamp beat (reference P3t) is not captured: it
 * lasts 700 ms, and the feel recordings cover it.
 */
val SCREEN_ELEMENTS: Map<String, List<String>> = linkedMapOf(
    "s1" to listOf("logo"),
    "s2" to listOf("pass"),
    "s3" to listOf("pass"),
    "s4" to listOf("pass"),
    "s5" to listOf("pass"),
    "s6" to listOf("pass", "start"),
    "p2" to listOf("ticket", "stub", "true", "false"),
    "p3" to listOf("ticket", "next"),
    "p4" to listOf("sheet", "keep"),
    "r1" to listOf("ticket", "again", "another"),
    "streak-p2" to listOf("ticket", "stub", "true", "false"),
    "streak-r1" to listOf("ticket", "again", "another"),
    "lives-p2" to listOf("ticket", "stub", "true", "false"),
    "lives-r1" to listOf("ticket", "again", "another"),
    "lives-r1-why" to listOf("ticket"),
    "timed-p2" to listOf("ticket", "stub", "true", "false"),
    "timed-up" to listOf("ticket", "results"),
    "timed-r1" to listOf("ticket", "again", "another"),
    "s1-returning" to listOf("logo"),
    "s3-recent" to listOf("pass"),
)

/** How each element is found on Android; web-capture.mjs finds the same elements in the web page. */
val ELEMENT_MATCHERS: Map<String, SemanticsMatcher> = mapOf(
    "logo" to hasTestTag(TestTags.LOGO),
    "pass" to hasTestTag(TestTags.PASS),
    "ticket" to hasTestTag(TestTags.TICKET),
    "stub" to hasTestTag(TestTags.STUB),
    "sheet" to hasTestTag(TestTags.SHEET_CARD),
    "start" to button("Start round"),
    "true" to button("True"),
    "false" to button("False"),
    "next" to button("Next card"),
    "results" to button("See results"),
    "keep" to button("Keep playing"),
    "again" to button("Play again"),
    "another" to button("Choose another route"),
)

/**
 * Walks the reviewed states from a first launch, as plan B's testCaptureEveryScreen and
 * testCaptureTheOtherClassesAndStartStates play them and as web-capture.mjs plays them: Classic on CLF / SEC with
 * True on every card, the leave sheet opened and closed after card 1; then Streak and Three lives with True on every
 * card until the round ends (a missed card with Why open on the Three lives result), Timed answered once and run
 * out; then a second deck (CDL, whole deck) played and left with one answer, so step 1 shows Recent and the
 * Continue line, and the Recent deck list. `visit` gets each state at rest.
 */
class ScreenWalk(private val ui: Ui) {
    private val deck by lazy { DeckAnswers(CLF_ID) }

    fun run(visit: (String) -> Unit) {
        classicRound(visit)
        otherClassesAndStartStates(visit)
    }

    private fun classicRound(visit: (String) -> Unit) {
        ui.atHome()
        visit("s1")
        ui.choose(CLF_SECURITY.area)
        ui.atStep("Choose a platform")
        visit("s2")
        ui.choose(CLF_SECURITY.platform)
        ui.atStep("Choose a deck")
        visit("s3")
        ui.choose(CLF_SECURITY.deck)
        ui.atStep("Choose a section")
        visit("s4")
        ui.choose(checkNotNull(CLF_SECURITY.section))
        ui.atStep("Choose how to play")
        visit("s5")
        ui.choose(CLF_SECURITY.mode)
        ui.atStep("Your pass is ready")
        visit("s6")

        ui.startRound()
        var card = ui.cardOnScreen(deck)
        ui.idle()
        SystemClock.sleep(SETTLE_MS)
        visit("p2")
        ui.tap(button("True"))
        ui.waitFor(button("Next card"))
        SystemClock.sleep(ARRIVAL_MS)
        ui.idle()
        visit("p3")
        ui.tap(LEAVE_X)
        ui.waitFor(SHEET_TITLE)
        ui.idle()
        visit("p4")
        ui.tap(button("Keep playing"))
        ui.waitGone(SHEET_TITLE)

        for (number in 2..10) {
            SystemClock.sleep(ARRIVAL_MS)
            ui.tap(button("Next card"))
            card = ui.cardOnScreen(deck, card)
            SystemClock.sleep(SETTLE_MS)
            ui.tap(button("True"))
            ui.waitFor(button(if (number == 10) "See results" else "Next card"))
        }
        SystemClock.sleep(ARRIVAL_MS)
        ui.tap(button("See results"))
        ui.waitForResult()
        SystemClock.sleep(RESULT_MS)
        visit("r1")
        closeResults()
    }

    private fun otherClassesAndStartStates(visit: (String) -> Unit) {
        for ((className, name) in listOf("Streak" to "streak", "Three lives" to "lives")) {
            ui.chooseRoute(CLF_SECURITY.inClass(className))
            ui.startRound()
            var card = ui.cardOnScreen(deck)
            ui.idle()
            SystemClock.sleep(SETTLE_MS)
            visit("$name-p2")
            while (true) {
                ui.tap(button("True"))
                ui.waitForAny(button(Regex("Next card|See results")))
                if (ui.exists(button("See results"))) break
                SystemClock.sleep(ARRIVAL_MS)
                ui.tap(button("Next card"))
                card = ui.cardOnScreen(deck, card)
                SystemClock.sleep(SETTLE_MS)
            }
            SystemClock.sleep(ARRIVAL_MS)
            ui.tap(button("See results"))
            ui.waitForResult()
            SystemClock.sleep(RESULT_MS)
            visit("$name-r1")
            if (name == "lives") {
                // Three wrong answers end the round, so a missed card is always there.
                ui.tapFirst(button(Regex("Why, card \\d{2}")))
                visit("lives-r1-why")
            }
            closeResults()
        }

        ui.chooseRoute(CLF_SECURITY.inClass("Timed"))
        ui.startRound()
        ui.cardOnScreen(deck)
        ui.idle()
        SystemClock.sleep(SETTLE_MS)
        visit("timed-p2")
        ui.tap(button("True"))
        // The rest of the minute runs out in real time.
        ui.waitFor(button("See results"), timeoutMs = 75_000)
        SystemClock.sleep(ARRIVAL_MS)
        ui.idle()
        visit("timed-up")
        ui.tap(button("See results"))
        ui.waitForResult()
        SystemClock.sleep(RESULT_MS)
        visit("timed-r1")
        closeResults()

        // A second deck played and left with one answer: step 1 then shows Recent (two decks) and Continue.
        ui.chooseRoute(CDL_WHOLE)
        ui.startRound()
        ui.cardOnScreen(DeckAnswers(CDL_ID))
        SystemClock.sleep(SETTLE_MS)
        ui.tap(button("True"))
        ui.waitForAny(button(Regex("Next card|See results")))
        ui.tap(LEAVE_X)
        ui.waitFor(SHEET_TITLE)
        ui.tap(LEAVE_IN_SHEET)
        ui.atHome()
        visit("s1-returning")
        ui.choose(Regex("Recent, 2 decks"))
        ui.atStep("Choose a deck")
        visit("s3-recent")
    }

    /** Close results, once the result's 1000 ms have passed (the caller slept RESULT_MS before its visit). */
    private fun closeResults() {
        ui.tap(button("Close results"))
        ui.atHome()
    }
}
