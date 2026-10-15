package com.eienmosu.truthy.engine

import com.eienmosu.truthy.engine.RoundVectors as V
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.test.fail

// The round against the vectors the TypeScript computed (native-data/golden/src.engine.round.*.json): every
// case of every file, every state of every trace. A trace is replayed and compared state by state; the first
// differing state fails with the case name and its index.
class RoundGoldenTest {
    @Test
    fun classicLengthLivesAndTimedAreTheWebConstants() {
        assertEquals(V.int(Golden.load("src/engine/round", "CLASSIC_LENGTH").cases.single().output), CLASSIC_LENGTH)
        assertEquals(V.int(Golden.load("src/engine/round", "LIVES").cases.single().output), LIVES)
        val timed = V.obj(Golden.load("src/engine/round", "TIMED").cases.single().output)
        assertEquals(3, timed.size)
        val expected = TimedSettings(
            roundMs = V.number(V.field(timed, "roundMs")),
            holdMs = V.number(V.field(timed, "holdMs")),
            maxStepMs = V.number(V.field(timed, "maxStepMs")),
        )
        assertEquals(expected, TIMED)
    }

    @Test
    fun chunkSeedVectors() {
        val golden = Golden.load("src/engine/round", "chunkSeed")
        assertTrue(golden.cases.isNotEmpty())
        for (item in golden.cases) {
            val input = V.obj(item.input)
            val actual = chunkSeed(V.number(V.field(input, "seed")), V.int(V.field(input, "chunk")))
            assertEquals(V.number(item.output), actual, item.name)
        }
    }

    @Test
    fun scoreOfVectors() {
        val golden = Golden.load("src/engine/round", "scoreOf")
        val cards = V.cardTable(golden.cards)
        assertTrue(golden.cases.isNotEmpty())
        for (item in golden.cases) {
            val input = V.obj(item.input)
            val name = V.string(V.field(input, "mode"))
            val mode = V.mode(name) ?: fail("${item.name}: unknown mode $name")
            val answers = V.array(V.field(input, "answers")).map { V.answered(it, cards) }
            assertEquals(V.int(item.output), scoreOf(mode, answers), item.name)
        }
    }

    @Test
    fun startRoundVectors() {
        val golden = Golden.load("src/engine/round", "startRound")
        val cards = V.cardTable(golden.cards)
        assertTrue(golden.cases.isNotEmpty())
        for (item in golden.cases) {
            val args = V.field(V.obj(item.input), "args")
            val modeName = V.string(V.field(V.obj(args), "mode"))
            val thrown = V.throwsMessage(item.output)
            if (V.mode(modeName) == null) {
                // A Mode value is always one of the four: the TypeScript's unknown-mode throw cannot be built here.
                assertEquals("The mode \"$modeName\" is not available.", thrown, item.name)
                continue
            }
            val start = V.startArgs(args, cards)
            if (thrown != null) {
                val error = assertFailsWith<IllegalArgumentException>(item.name) { startRound(start) }
                assertEquals(thrown, error.message, item.name)
            } else {
                assertEquals(V.expectedState(item.output), V.view(startRound(start)), item.name)
            }
        }
    }

    @Test
    fun reduceTraces() {
        val golden = Golden.load("src/engine/round", "reduce")
        val cards = V.cardTable(golden.cards)
        assertTrue(golden.cases.isNotEmpty())
        for (item in golden.cases) {
            val states = V.replay(item.input, cards)
            val expected = V.array(item.output)
            assertEquals(expected.size, states.size, "${item.name}: one snapshot per event plus the start")
            for (i in states.indices) {
                assertEquals(V.expectedState(expected[i]), V.view(states[i]), "${item.name}: state $i")
            }
        }
    }

    @Test
    fun currentCardVectors() = checkReader("currentCard", Golden.load("src/engine/round", "currentCard"))

    @Test
    fun lastAnswerVectors() = checkReader("lastAnswer", Golden.load("src/engine/round", "lastAnswer"))

    @Test
    fun wrongCountVectors() = checkReader("wrongCount", Golden.load("src/engine/round", "wrongCount"))

    @Test
    fun livesLeftVectors() = checkReader("livesLeft", Golden.load("src/engine/round", "livesLeft"))

    @Test
    fun isDecidedVectors() = checkReader("isDecided", Golden.load("src/engine/round", "isDecided"))

    @Test
    fun summariseVectors() = checkReader("summarise", Golden.load("src/engine/round", "summarise"))

    // A reader's file holds the input of a reduce trace and the reader's value on every state of it.
    private fun checkReader(function: String, golden: GoldenFile) {
        val cards = V.cardTable(golden.cards)
        assertTrue(golden.cases.isNotEmpty(), function)
        for (item in golden.cases) {
            val states = V.replay(item.input, cards)
            val expected = V.array(item.output)
            assertEquals(expected.size, states.size, "${item.name}: one value per state")
            for (i in states.indices) {
                assertEquals(V.expectedRead(function, expected[i]), V.read(function, states[i]), "${item.name}: $function of state $i")
            }
        }
    }
}
