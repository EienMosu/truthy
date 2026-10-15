package com.eienmosu.truthy.support

import android.os.SystemClock
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.text.TextLayoutResult
import com.eienmosu.truthy.DeckStore
import com.eienmosu.truthy.engine.Card
import com.eienmosu.truthy.engine.DeckFile
import com.eienmosu.truthy.engine.plainText
import com.eienmosu.truthy.ui.TestTags
import kotlinx.coroutines.runBlocking

/** A little over the 250 ms settle time: a new step's options and a new card ignore input until it has passed. */
const val SETTLE_MS = 300L
/** A little over NEXT_ARRIVES_MS (420): Next card and See results ignore presses until then. */
const val ARRIVAL_MS = 470L
/** A little over RESULT_ARRIVES_MS (1000): the result's actions and back on the result. */
const val RESULT_MS = 1_100L
const val WAIT_MS = 5_000L

/** What a screen reader would read for a node: its content descriptions and its texts. */
fun labelsOf(node: SemanticsNode): List<String> {
    val descriptions = node.config.getOrElseNullable(SemanticsProperties.ContentDescription) { null }.orEmpty()
    val texts = node.config.getOrElseNullable(SemanticsProperties.Text) { null }.orEmpty().map { it.text }
    return descriptions + texts
}

fun label(text: String) = SemanticsMatcher("label \"$text\"") { text in labelsOf(it) }
fun label(pattern: Regex) = SemanticsMatcher("label matching /$pattern/") { node -> labelsOf(node).any { pattern.matches(it) } }
fun button(text: String) = label(text) and hasClickAction()
fun button(pattern: Regex) = label(pattern) and hasClickAction()

val IN_SHEET = hasAnyAncestor(hasTestTag(TestTags.SHEET_CARD))
/** The round's X ("Leave round"), not the sheet's quiet button of the same name. */
val LEAVE_X = button("Leave round") and !IN_SHEET
val LEAVE_IN_SHEET = button("Leave round") and IN_SHEET
val SHEET_TITLE = label("Leave round?")

/** A card of a round and what the player answered to it. `number` counts from 1. */
data class Played(val number: Int, val card: Card, val given: Boolean) {
    val correct: Boolean get() = given == card.answer
}

fun statementOf(card: Card): String = plainText(card.text.en.statement)

/** The shipped deck, read from the app's assets as the app reads it: tells a test the answer to the statement on screen. */
class DeckAnswers(deckId: String) {
    val deck: DeckFile = runBlocking { DeckStore(Device.app.assets).deck(deckId) }
    private val byStatement: Map<String, Card> = deck.cards.associateBy(::statementOf)
    fun cardFor(text: String): Card? = byStatement[text]
}

/** Plays the app through a Compose test rule the way a player does: by labels, with real taps, at real speed. */
@OptIn(ExperimentalTestApi::class)
class Ui(val rule: ComposeTestRule) {
    fun idle() = rule.waitForIdle()

    fun exists(matcher: SemanticsMatcher, unmerged: Boolean = false): Boolean =
        rule.onAllNodes(matcher, useUnmergedTree = unmerged).fetchSemanticsNodes(atLeastOneRootRequired = false).isNotEmpty()

    fun count(matcher: SemanticsMatcher): Int =
        rule.onAllNodes(matcher).fetchSemanticsNodes(atLeastOneRootRequired = false).size

    fun waitFor(matcher: SemanticsMatcher, timeoutMs: Long = WAIT_MS) = rule.waitUntilExactlyOneExists(matcher, timeoutMs)
    fun waitForAny(matcher: SemanticsMatcher, timeoutMs: Long = WAIT_MS) = rule.waitUntilAtLeastOneExists(matcher, timeoutMs)
    fun waitGone(matcher: SemanticsMatcher, timeoutMs: Long = WAIT_MS) = rule.waitUntilDoesNotExist(matcher, timeoutMs)

    fun node(matcher: SemanticsMatcher): SemanticsNode = rule.onNode(matcher).fetchSemanticsNode()

    /** The centre of a node in screen px, where a finger would touch it. */
    fun centre(matcher: SemanticsMatcher): Offset = centreOf(node(matcher))

    private fun centreOf(node: SemanticsNode): Offset =
        node.positionOnScreen + Offset(node.size.width / 2f, node.size.height / 2f)

    /** A node's bounds in its window, in dp. They include graphicsLayer transforms of the node. */
    fun boundsDp(matcher: SemanticsMatcher): Rect {
        val bounds = node(matcher).boundsInWindow
        val d = Device.density
        return Rect(bounds.left / d, bounds.top / d, bounds.right / d, bounds.bottom / d)
    }

    fun tap(matcher: SemanticsMatcher, idle: Boolean = true) {
        waitFor(matcher)
        Finger.tap(centre(matcher))
        if (idle) idle()
    }

    /** Scrolls the node's list or column until the node shows, then taps it. */
    fun tapScrolled(matcher: SemanticsMatcher) {
        waitFor(matcher)
        rule.onNode(matcher).performScrollTo()
        idle()
        tap(matcher)
    }

    /** The first of several matching nodes (the "Why" rows), scrolled into view and tapped. */
    fun tapFirst(matcher: SemanticsMatcher) {
        waitForAny(matcher)
        val first = rule.onAllNodes(matcher)[0]
        first.performScrollTo()
        idle()
        Finger.tap(centreOf(first.fetchSemanticsNode()))
        idle()
    }

    // ---------- the start flow ----------

    /** Waits for the step with this title, lets its motion finish and its 250 ms settle time pass. */
    fun atStep(title: String) {
        waitFor(label(title))
        idle()
        SystemClock.sleep(SETTLE_MS)
    }

    fun atHome() {
        atStep("Choose an area")
        waitFor(button(CLF_SECURITY.area))
    }

    fun choose(option: Regex) = tapScrolled(button(option))

    /** Fills in the pass from step 1 to "Your pass is ready", letting each step settle. */
    fun chooseRoute(pick: RoutePick) {
        choose(pick.area)
        atStep("Choose a platform")
        choose(pick.platform)
        atStep("Choose a deck")
        choose(pick.deck)
        if (pick.section != null) {
            atStep("Choose a section")
            choose(pick.section)
        }
        atStep("Choose how to play")
        choose(pick.mode)
        atStep("Your pass is ready")
    }

    fun startRound() = tap(button("Start round"))

    // ---------- the round ----------

    /**
     * The card whose statement is on screen: exactly one statement of the deck among the texts, other than
     * `previous` (a Timed card that is leaving, or the card answered before).
     */
    fun cardOnScreen(deck: DeckAnswers, previous: Card? = null, timeoutMs: Long = WAIT_MS): Card {
        var found: Card? = null
        rule.waitUntil(timeoutMs) {
            val texts = rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.Text), useUnmergedTree = true)
                .fetchSemanticsNodes(atLeastOneRootRequired = false)
                .flatMap { node -> node.config[SemanticsProperties.Text].map { it.text } }
            val cards = texts.mapNotNull(deck::cardFor).distinctBy { it.id }.filter { it.id != previous?.id }
            found = cards.singleOrNull()
            found != null
        }
        return found ?: error("no single card of ${deck.deck.id} on screen")
    }

    /** Answers with the True or False pill, right or wrong on purpose. Returns what was given. */
    fun answer(card: Card, right: Boolean, idle: Boolean = true): Boolean {
        val given = if (right) card.answer else !card.answer
        tap(button(if (given) "True" else "False"), idle)
        return given
    }

    /** Next card, or See results on the last card, once it takes presses. */
    fun goOn(last: Boolean) {
        val go = button(if (last) "See results" else "Next card")
        waitFor(go)
        SystemClock.sleep(ARRIVAL_MS)
        tap(go)
    }

    /** A whole Classic round of `total` cards, wrong on purpose on the numbers in `wrongOn`. */
    fun playClassic(deck: DeckAnswers, wrongOn: Set<Int>, total: Int = 10): List<Played> {
        val played = mutableListOf<Played>()
        for (number in 1..total) {
            waitFor(label(Regex("Card $number of $total\\..*")))
            val card = cardOnScreen(deck, played.lastOrNull()?.card)
            SystemClock.sleep(SETTLE_MS)
            val given = answer(card, right = number !in wrongOn)
            goOn(last = number == total)
            played += Played(number, card, given)
        }
        return played
    }

    fun waitForResult() {
        waitFor(label("Round complete"))
        idle()
    }

    /** The whole seconds the Timed header names: "41 seconds left of 60. 1 correct, 0 wrong." */
    fun timedSecondsLeft(): Int {
        val pattern = Regex("(\\d+) seconds? left of 60\\. .*")
        val node = rule.onAllNodes(label(pattern)).fetchSemanticsNodes().single()
        return labelsOf(node).firstNotNullOf { pattern.matchEntire(it) }.groupValues[1].toInt()
    }

    // ---------- text that does not fit ----------

    /**
     * Every text on screen that overflows its box or is cut with an ellipsis, with the reason. A fixed height
     * that is not a minimum shows up here as a taller text than its box (spec 5.6: text grows or scrolls).
     */
    fun clippedTexts(): List<String> {
        val nodes = rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.GetTextLayoutResult), useUnmergedTree = true)
            .fetchSemanticsNodes(atLeastOneRootRequired = false)
        return rule.runOnUiThread {
            nodes.mapNotNull { node ->
                val layouts = mutableListOf<TextLayoutResult>()
                node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
                layouts.firstOrNull()?.let { layout ->
                    val ellipsized = (0 until layout.lineCount).any { layout.isLineEllipsized(it) }
                    if ((layout.didOverflowHeight || (0 until layout.lineCount).any { layout.getLineRight(it) - layout.getLineLeft(it) > layout.size.width + 1f }) || ellipsized) {
                        "\"${layout.layoutInput.text.text}\" (too wide: ${layout.didOverflowWidth}, " +
                            "too tall: ${layout.didOverflowHeight}, ellipsized: $ellipsized)"
                    } else {
                        null
                    }
                }
            }
        }
    }
}
