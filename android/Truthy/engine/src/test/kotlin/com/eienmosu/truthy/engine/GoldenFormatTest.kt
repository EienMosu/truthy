package com.eienmosu.truthy.engine

import java.nio.file.Files
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

// The loader on files written here, in plan A's format, so it is tested whatever the vectors hold. Kotlin reads
// `$card` in a string as a template, so the JSON below writes `^` where the file has `$`.
private fun tags(json: String): String = json.replace('^', '$')

private const val CARD =
    """{"id":"t-1","section":"ALL","text":{"en":{"statement":"S","explanation":"E"}},"answer":true,"source":{"title":"T","url":"https://example.com/t"},"difficulty":2,"appliesTo":"","conflictGroups":[]}"""

private fun file(cases: String, cards: String = """{"t-1":$CARD}"""): GoldenFile =
    Golden.parse(
        tags("""{"format":1,"module":"src/demo","function":"demo","source":"src/demo.ts","tests":["tests/demo.test.ts"],"cards":$cards,"cases":$cases}"""),
    )

@Serializable
private data class Numbers(val a: Double, val b: Double, val c: Double, val d: Double, val e: Int, val f: Double)

@Serializable
private data class Optionals(val kept: Int, val gone: Int? = null)

class GoldenFormatTest {
    @Test
    fun readsTheMetaAndTheCases() {
        val golden = file("""[{"name":"one","input":{"n":1},"output":"01"}]""")
        assertEquals(1, golden.format)
        assertEquals("src/demo", golden.module)
        assertEquals("demo", golden.function)
        assertEquals("src/demo.ts", golden.source)
        assertEquals(listOf("tests/demo.test.ts"), golden.tests)
        assertEquals(listOf("one"), golden.cases.map { it.name })
        assertEquals(JsonPrimitive(1), golden.cases[0].arg("n"))
        assertEquals(JsonPrimitive("01"), golden.cases[0].output)
    }

    @Test
    fun namesAFileAfterItsModuleAndFunction() {
        assertEquals("src.engine.deal.dealChunk.json", Golden.fileName("src/engine/deal", "dealChunk"))
        assertEquals("components.FlightPath.pointAt.json", Golden.fileName("components/FlightPath", "pointAt"))
        assertEquals("src.engine.deal.DEAL.constant.json", Golden.fileName("src/engine/deal", "DEAL"))
        assertEquals("src.engine.deal.deal.json", Golden.fileName("src/engine/deal", "deal"))
    }

    @Test
    fun turnsCardReferencesIntoTheCardsOfTheTable() {
        val golden = file("""[{"name":"c","input":{"pool":[{"^card":"t-1"},{"^card":"t-1"}]},"output":{"^card":"t-1"}}]""")
        val pool = golden.decode<List<Card>>(golden.cases[0].arg("pool")!!)
        assertEquals(listOf("t-1", "t-1"), pool.map { it.id })
        assertEquals(2, pool[0].difficulty)
        assertEquals("https://example.com/t", pool[0].source.url)
        assertEquals(pool[0], golden.decode<Card>(golden.cases[0].output))
    }

    @Test
    fun readsOneCardThroughCard() {
        val golden = file("""[{"name":"c","input":{"card":{"^card":"t-1"}},"output":null}]""")
        val card = golden.card(golden.cases[0].arg("card")!!)
        assertEquals("t-1", card.id)
        assertEquals("https://example.com/t", card.source.url)
    }

    @Test
    fun readsAWholeDeckThroughCards() {
        val decks = Files.createTempDirectory("golden-cards").toFile()
        try {
            decks.resolve("t.json").writeText("""{"id":"t","hash":"0000000000000000","cards":[$CARD]}""")
            val golden = file("""[{"name":"d","input":{"pool":{"^deck":"t"}},"output":[{"^card":"t-1"}]}]""")
            assertEquals(listOf("t-1"), golden.cards(golden.cases[0].arg("pool")!!, decks).map { it.id })
            assertEquals(listOf("t-1"), golden.cards(golden.cases[0].output).map { it.id })
        } finally {
            decks.deleteRecursively()
        }
    }

    @Test
    fun refusesACardTheTableDoesNotHave() {
        val golden = file("""[{"name":"c","input":{"^card":"t-2"},"output":null}]""")
        assertThrows(GoldenException::class.java) { golden.decode<Card>(golden.cases[0].input) }
    }

    @Test
    fun decodesTheNumbersJsonCannotCarry() {
        val golden = file(
            """[{"name":"n","input":{"a":{"^number":"Infinity"},"b":{"^number":"-Infinity"},"c":{"^number":"NaN"},"d":{"^number":"-0"},"e":7,"f":0.30000000000000004},"output":null}]""",
        )
        val numbers = golden.decode<Numbers>(golden.cases[0].input)
        assertEquals(Double.POSITIVE_INFINITY, numbers.a, 0.0)
        assertEquals(Double.NEGATIVE_INFINITY, numbers.b, 0.0)
        assertTrue(numbers.c.isNaN())
        assertEquals((-0.0).toRawBits(), numbers.d.toRawBits())
        assertEquals(7, numbers.e)
        assertEquals((0.1 + 0.2).toRawBits(), numbers.f.toRawBits())
    }

    @Test
    fun leavesAnUndefinedKeyOutAndReadsAnUndefinedOutputAsNull() {
        val golden = file("""[{"name":"u","input":{"kept":1,"gone":{"^undefined":true}},"output":{"^undefined":true}}]""")
        assertEquals(Optionals(kept = 1, gone = null), golden.decode<Optionals>(golden.cases[0].input))
        assertEquals(JsonNull, golden.resolved(golden.cases[0].output))
        assertNull(golden.decode<Int?>(golden.cases[0].output))
    }

    @Test
    fun readsAThrownErrorAsItsMessage() {
        val golden = file("""[{"name":"t","input":{},"output":{"^throws":"no cards"}},{"name":"v","input":{},"output":3}]""")
        assertEquals("no cards", golden.cases[0].throwsMessage)
        assertNull(golden.cases[1].throwsMessage)
    }

    @Test
    fun makesASeededRngThatMatchesCreateRng() {
        val golden = file("""[{"name":"r","input":{"rng":{"^rng":{"seed":42}}},"output":null}]""")
        val rng = golden.rng(golden.cases[0].arg("rng")!!)
        val reference = createRng(42.0)
        assertEquals(listOf(reference(), reference(), reference()), listOf(rng(), rng(), rng()))
    }

    @Test
    fun makesAnRngThatReturnsItsValuesAndFailsWhenTheyRunOut() {
        val golden = file("""[{"name":"r","input":{"rng":{"^rng":{"values":[0.25,0.5]}}},"output":null}]""")
        val rng = golden.rng(golden.cases[0].arg("rng")!!)
        assertEquals(0.25, rng(), 0.0)
        assertEquals(0.5, rng(), 0.0)
        val error = assertThrows(AssertionError::class.java) { rng() }
        assertEquals("the rng ran out after 2 values", error.message)
    }

    @Test
    fun refusesAnArgumentThatIsNotAnRng() {
        val golden = file("""[{"name":"r","input":{"rng":{"seed":1}},"output":null}]""")
        assertThrows(GoldenException::class.java) { golden.rng(golden.cases[0].arg("rng")!!) }
    }

    @Test
    fun readsAWholeDeckFromTheDecksFolder() {
        val decks = Files.createTempDirectory("golden-decks").toFile()
        try {
            decks.resolve("t.json").writeText("""{"id":"t","hash":"0000000000000000","cards":[$CARD]}""")
            val golden = file("""[{"name":"d","input":{"pool":{"^deck":"t"}},"output":null}]""")
            val pool = golden.decode<List<Card>>(golden.cases[0].arg("pool")!!, decks)
            assertEquals(listOf("t-1"), pool.map { it.id })
        } finally {
            decks.deleteRecursively()
        }
    }
}
