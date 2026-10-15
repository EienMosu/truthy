package com.eienmosu.truthy.round

import com.eienmosu.truthy.RepoFiles
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LeaveResultTextTest {
    private fun web(path: String): String = RepoFiles.root.resolve(path).readText()

    private fun assertIn(source: String, path: String, vararg texts: String) {
        for (text in texts) assertTrue("'$text' is not in $path", source.contains(text))
    }

    // JavaScript prints 2 for 2.0 and 1.9 for 1.9.
    private fun js(value: Float): String = if (value == value.toInt().toFloat()) value.toInt().toString() else value.toString()

    @Test
    fun leaveSheetSaysWhatLeaveDialogSays() {
        val path = "components/play/LeaveDialog.tsx"
        assertIn(web(path), path, LeaveText.TITLE, LeaveText.OPEN_BODY, LeaveText.DECIDED_BODY, LeaveText.KEEP_PLAYING, LeaveText.LEAVE_ROUND)
        assertEquals("Leave round?", LeaveText.TITLE)
        assertEquals(LeaveText.OPEN_BODY, LeaveText.body(decided = false))
        assertEquals(LeaveText.DECIDED_BODY, LeaveText.body(decided = true))
    }

    @Test
    fun resultSaysWhatResultViewScoreBlockAndMissedCardsSay() {
        val view = "components/play/ResultView.tsx"
        assertIn(web(view), view, ResultText.CLOSE_RESULTS, ResultText.HEADING, ResultText.PLAY_AGAIN, ResultText.CHOOSE_ANOTHER_ROUTE)
        val score = "components/ScoreBlock.tsx"
        assertIn(web(score), score, ResultText.FIRST_ROUND, ResultText.NEW_BEST, ResultText.EQUALS_BEST, "Previous best {best(", "Best {best(", "} short of your best")
        val missed = "components/MissedCards.tsx"
        assertIn(
            web(missed), missed,
            ResultText.MISSED_CARDS, ResultText.NO_MISSED_CARDS, ResultText.WHY, ResultText.ANSWER,
            "{missed.length} to review", "Card {number}", "You said {word(item.given)}", "`Why, card \${number}`", "`Applies to \${item.appliesTo}`",
        )
    }

    @Test
    fun formattedCopyReadsAsTheWebWritesIt() {
        assertEquals("Previous best 9 / 10", ResultText.previousBest("9 / 10"))
        assertEquals("Best 21 cards", ResultText.best("21 cards"))
        assertEquals("2 short of your best", ResultText.shortOfBest(2))
        assertEquals("3 to review", ResultText.toReview(3))
        assertEquals("Card 03", ResultText.cardCaption(3))
        assertEquals("Card 12", ResultText.cardCaption(12))
        assertEquals("You said True", ResultText.youSaid(true))
        assertEquals("You said False", ResultText.youSaid(false))
        assertEquals("Why, card 07", ResultText.whyLabel(7))
        assertEquals("Applies to Kubernetes 1.33", ResultText.appliesTo("Kubernetes 1.33"))
        assertEquals("7 correct · 3 wrong", ResultText.tally(7, 3))
        assertEquals("True", ResultText.word(true))
        assertEquals("False", ResultText.word(false))
    }

    @Test
    fun sourceLinkLabelIsTheSpecsNativeLabel() {
        val path = "docs/superpowers/specs/2026-10-14-truthy-native-apps-design.md"
        assertIn(web(path), path, "\"{source.title} (opens in browser)\"")
        assertEquals("AWS Shared Responsibility Model (opens in browser)", ResultText.sourceLabel("AWS Shared Responsibility Model"))
    }

    @Test
    fun codeOnlyNumbersArePinnedToTheirSources() {
        val c = LeaveResultConstants
        val spec = "docs/superpowers/specs/2026-10-14-truthy-native-apps-design.md"
        assertIn(web(spec), spec, "from scale 1 to ${js(c.ROUND_BACK_MIN_SCALE)}")
        val easing = "components/easing.ts"
        assertIn(
            web(easing), easing,
            "STAMP_LANDING = { opacity: 0, scale: ${js(c.STAMP_LANDING_SCALE)}, rotate: ${js(c.STAMP_LANDING_ROTATION)} }",
            "STAMP_REST = { opacity: 1, scale: 1, rotate: ${js(c.STAMP_REST_ROTATION)} }",
        )
        val pass = "components/BoardingPass.tsx"
        assertIn(web(pass), pass, "y: [0, ${js(c.JOLT_DISTANCE_DP)}, 0]", "times: [0, ${js(c.JOLT_PEAK_AT)}, 1]", "max-height:${js(c.SHORT_LEGS_MAX_HEIGHT_DP)}px")
        val missed = "components/MissedCards.tsx"
        assertIn(web(missed), missed, "reduced ? ${c.WHY_SCROLL_DELAY_REDUCED_MS} : ${c.WHY_SCROLL_DELAY_MS}", "+ ${js(c.WHY_SCROLL_CLEARANCE_DP)} -")
        val path = "components/FlightPath.tsx"
        assertIn(web(path), path, "strokeWidth=\"${js(c.RING_STROKE)}\"")
    }

    // The web's header is justify-between with no gap; Android keeps 8 (space-8) between the two at a large font scale.
    @Test
    fun theMissedCardsHeaderKeepsItsWordsApart() {
        val missed = "components/MissedCards.tsx"
        assertIn(web(missed), missed, "flex flex-none items-baseline justify-between px-(--size-ticket-inset)")
        assertEquals(com.eienmosu.truthy.design.Tokens.Space.s8.value, LeaveResultConstants.MISSED_HEADER_GAP_DP)
    }
}
