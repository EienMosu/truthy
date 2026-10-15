package com.eienmosu.truthy.engine

import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.Test

class PlayCopyGoldenTest : CopyGoldenBase() {
    private val verdict = Golden.load("components/play/PlayScreen", "verdictText")
    private val status = Golden.load("components/play/PlayScreen", "roundStatus")
    private val timedStatusFile = Golden.load("components/play/PlayScreen", "timedStatus")
    private val timedCard = Golden.load("components/play/PlayScreen", "timedCardText")
    private val nextArrives = Golden.load("components/play/PlayScreen", "NEXT_ARRIVES_MS")
    private val spokenRelease = Golden.load("components/play/PlayScreen", "SPOKEN_RELEASE_MS")

    @Test
    fun `verdictText says the verdict, the answer and New best for every combination`() {
        for (correct in listOf(true, false)) {
            for (answer in listOf(true, false)) {
                val text = "${if (correct) "Correct" else "Not quite"}. The answer is ${if (answer) "True" else "False"}."
                assertEquals(text, verdictText(correct, answer))
                assertEquals("$text New best.", verdictText(correct, answer, true))
            }
        }
    }

    @Test
    fun `verdictText matches every golden case`() {
        assertEquals(8, verdict.cases.size)
        for (case in verdict.cases) {
            val input = verdict.resolve(case.input)
            val newBest = input.optional("newBest")?.flag() ?: false
            assertEquals(case.output.text(), verdictText(input.field("correct").flag(), input.field("answer").flag(), newBest), case.name)
        }
    }

    @Test
    fun `roundStatus pins the Three lives and Streak words and the silence of the other classes`() {
        fun said(name: String) = status.outputOf(name).text()
        assertEquals("Life lost, 2 left.", said("lives: the first wrong answer loses a life"))
        assertEquals("", said("lives: a right answer after a lost life says nothing"))
        assertEquals("Last life.", said("lives: the second wrong answer is the last life"))
        assertEquals("Out of lives.", said("lives: the third wrong answer is out of lives"))
        assertEquals("Streak ended at 2.", said("streak: wrong after two right answers"))
        assertEquals("Streak ended at 0.", said("streak: wrong on the first card ends at 0"))
        assertEquals("Streak ended at 13.", said("streak: 13 right answers then a wrong one, across a chunk"))
        assertEquals("", said("classic: a wrong answer adds nothing"))
        assertEquals("", said("timed: a wrong answer adds nothing"))
    }

    @Test
    fun `roundStatus matches every golden case`() {
        assertEquals(12, status.cases.size)
        for (case in status.cases) assertEquals(case.output.text(), roundStatus(replay(status, case.input)), case.name)
    }

    @Test
    fun `timedStatus pins nothing on a question, the verdict during the stamp and the end of the card`() {
        fun said(name: String) = timedStatusFile.outputOf(name).text()
        assertEquals("", said("a question says nothing"))
        assertEquals("Correct.", said("the stamp of a right answer says Correct."))
        assertEquals("Not quite.", said("the stamp of a wrong answer says Not quite."))
        assertEquals("Time is up. This card doesn't count.", said("time is up on a question"))
        assertEquals("Time is up. This card doesn't count.", said("time is up after an answer"))
    }

    @Test
    fun `timedStatus matches every golden case`() {
        assertEquals(6, timedStatusFile.cases.size)
        for (case in timedStatusFile.cases) assertEquals(case.output.text(), timedStatus(replay(timedStatusFile, case.input)), case.name)
    }

    @Test
    fun `timedCardText pins the number, the Applies to line and the code fragment without backticks`() {
        fun statement(name: String) = replay(timedCard, timedCard.inputOf(name)).cards[1].text.en.statement
        fun said(name: String) = timedCard.outputOf(name).text()
        assertEquals("", said("the first card is read through focus: nothing"))
        assertEquals("", said("the stamp on the first card: nothing"))
        assertEquals("", said("time is up: nothing"))
        val second = "the second card: its number and statement"
        assertEquals("Card 2. ${statement(second)}", said(second))
        val kept = "the second card keeps the text through its stamp"
        assertEquals("Card 2. ${statement(kept)}", said(kept))
        val scoped = "the second card with an appliesTo says the Applies to line first"
        assertEquals("Card 2. Applies to Next.js 16 with cacheComponents: true. ${statement(scoped)}", said(scoped))
        val code = "the second card opening with a code fragment is read without its backticks"
        assertTrue(statement(code).startsWith("`docker run` "))
        assertEquals("Card 2. docker run ${statement(code).removePrefix("`docker run` ")}", said(code))
    }

    @Test
    fun `timedCardText matches every golden case`() {
        assertEquals(8, timedCard.cases.size)
        for (case in timedCard.cases) assertEquals(case.output.text(), timedCardText(replay(timedCard, case.input)), case.name)
    }

    @Test
    fun `the two timings are 420 and 150 milliseconds`() {
        assertEquals(420.0, NEXT_ARRIVES_MS)
        assertEquals(150.0, SPOKEN_RELEASE_MS)
        assertEquals(1, nextArrives.cases.size)
        assertEquals(1, spokenRelease.cases.size)
        assertTrue(nextArrives.cases[0].output.number() == NEXT_ARRIVES_MS)
        assertTrue(spokenRelease.cases[0].output.number() == SPOKEN_RELEASE_MS)
    }
}
