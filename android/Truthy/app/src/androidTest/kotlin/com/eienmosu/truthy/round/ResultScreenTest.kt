package com.eienmosu.truthy.round

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.eienmosu.truthy.MonotonicClock
import com.eienmosu.truthy.engine.RoundState
import com.eienmosu.truthy.engine.completedLabel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ResultScreenTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var now = 0.0
    private val clock = MonotonicClock { now }
    private val events = mutableListOf<String>()

    private fun result(round: RoundState = TestRounds.classic(), best: Int? = null) {
        rule.setContent {
            Themed {
                ResultScreen(
                    round = round,
                    ticket = TestRounds.ticket(best),
                    shownAt = 0.0,
                    clock = clock,
                    onClose = { events += "close" },
                    onPlayAgain = { events += "again" },
                    onHome = { events += "home" },
                    openSource = { events += "open $it" },
                )
            }
        }
    }

    @Test
    fun showsTheHeadingTheRouteTheFieldsAndAFirstRound() {
        val round = TestRounds.classic()
        result(round)
        rule.onNodeWithContentDescription(ResultText.HEADING).assertExists()
        rule.onNodeWithContentDescription(completedLabel(10, round.answers.map { it.correct })).assertExists()
        rule.onNodeWithContentDescription(ResultText.CLOSE_RESULTS).assertIsDisplayed()
        rule.onNodeWithText("10 / 10").assertExists()
        rule.onNodeWithText("03").assertExists()
        rule.onNodeWithText("Your score").assertExists()
        rule.onNodeWithText("7").assertExists()
        rule.onNodeWithText("of 10").assertExists()
        rule.onNodeWithText(ResultText.FIRST_ROUND).assertExists()
        rule.onNodeWithText(ResultText.NEW_BEST).assertDoesNotExist()
    }

    @Test
    fun stampsNewBestOverThePreviousBest() {
        result(best = 6)
        rule.onNodeWithText(ResultText.NEW_BEST).assertExists()
        rule.onNodeWithText(ResultText.previousBest("6 / 10")).assertExists()
    }

    @Test
    fun saysEqualsYourBestInWords() {
        result(best = 7)
        rule.onNodeWithText(ResultText.EQUALS_BEST).assertExists()
        rule.onNodeWithText(ResultText.best("7 / 10")).assertExists()
        rule.onNodeWithText(ResultText.NEW_BEST).assertDoesNotExist()
    }

    @Test
    fun saysHowManyShortOfTheBest() {
        result(best = 9)
        rule.onNodeWithText(ResultText.shortOfBest(2)).assertExists()
        rule.onNodeWithText(ResultText.best("9 / 10")).assertExists()
    }

    @Test
    fun listsTheMissedCardsAndOpensWhyWithItsSource() {
        val round = TestRounds.classic()
        result(round)
        rule.onNodeWithText(ResultText.MISSED_CARDS).assertExists()
        rule.onNodeWithText(ResultText.toReview(3)).assertExists()
        for (number in listOf(3, 6, 10)) rule.onNodeWithText(ResultText.cardCaption(number)).assertExists()
        rule.onAllNodesWithText("You said ", substring = true).assertCountEquals(3)
        val third = round.answers[2].card
        rule.onNodeWithText(third.text.en.explanation).assertDoesNotExist()
        rule.onNodeWithContentDescription(ResultText.whyLabel(3)).performScrollTo().performClick()
        rule.waitForIdle()
        rule.onNodeWithText(third.text.en.explanation).assertExists()
        rule.onNodeWithContentDescription(ResultText.sourceLabel(third.source.title)).performScrollTo().performClick()
        assertEquals(listOf("open ${third.source.url}"), events)
        rule.onNodeWithContentDescription(ResultText.whyLabel(3)).performScrollTo().performClick()
        rule.waitForIdle()
        rule.onNodeWithText(third.text.en.explanation).assertDoesNotExist()
    }

    // Spec 5.6 and reference 5.0: the bottom fade cue shows while more lies below and is gone at the end of the scroll.
    @Test
    fun theMissedListFadesAtTheFootUntilTheEndOfTheScroll() {
        rule.setContent {
            Themed {
                AtSize(320.dp, 568.dp, fontScale = 1f) {
                    ResultScreen(TestRounds.classic(wrong = (0..7).toSet()), TestRounds.ticket(null), 0.0, clock, {}, {}, {}, {})
                }
            }
        }
        rule.waitForIdle()
        // Bring the list's header into view, so the ticket's lower part reaches the stage's foot.
        rule.onNodeWithText(ResultText.MISSED_CARDS).performScrollTo()
        rule.waitForIdle()
        rule.onNodeWithTag(MISSED_FADE_TAG).assertExists()
        rule.onNode(hasScrollAction()).performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, 100_000f) }
        rule.waitForIdle()
        rule.onNodeWithTag(MISSED_FADE_TAG).assertDoesNotExist()
    }

    @Test
    fun saysNoMissedCardsAfterAPerfectRound() {
        result(TestRounds.classic(wrong = emptySet()))
        rule.onNodeWithText(ResultText.NO_MISSED_CARDS).assertExists()
        rule.onNodeWithText(ResultText.toReview(0)).assertDoesNotExist()
    }

    @Test
    fun ignoresPlayAgainAndChooseAnotherRouteForTheFirstSecond() {
        result()
        now = 999.0
        rule.onNodeWithText(ResultText.PLAY_AGAIN).performClick()
        rule.onNodeWithText(ResultText.CHOOSE_ANOTHER_ROUTE).performClick()
        assertTrue(events.isEmpty())
        now = 1_000.0
        rule.onNodeWithText(ResultText.PLAY_AGAIN).performClick()
        rule.onNodeWithText(ResultText.CHOOSE_ANOTHER_ROUTE).performClick()
        assertEquals(listOf("again", "home"), events)
    }

    @Test
    fun nothingClipsAtTwiceTheTextSizeOnALargePhone() {
        rule.setContent {
            Themed {
                AtSize(412.dp, 915.dp, fontScale = 2f) {
                    ResultScreen(TestRounds.classic(), TestRounds.ticket(6), 0.0, clock, {}, {}, {}, {})
                }
            }
        }
        rule.waitForIdle()
        rule.assertNoClippedText()
    }

    @Test
    fun nothingClipsAtTwiceTheTextSizeOnTheSmallestPhone() {
        rule.setContent {
            Themed {
                AtSize(320.dp, 568.dp, fontScale = 2f) {
                    ResultScreen(TestRounds.classic(), TestRounds.ticket(6), 0.0, clock, {}, {}, {}, {})
                }
            }
        }
        rule.waitForIdle()
        rule.assertNoClippedText()
    }
}
