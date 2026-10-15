package com.eienmosu.truthy.engine

import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.Test

class TicketScrollGoldenTest : CopyGoldenBase() {
    private val statement = Golden.load("components/play/ticketScroll", "statementScroll")
    private val slip = Golden.load("components/play/ticketScroll", "slipScroll")
    private val key = Golden.load("components/play/ticketScroll", "keyScroll")
    private val step = Golden.load("components/play/ticketScroll", "ARROW_STEP")

    private val base = SlipAt(top = 0.0, visible = 300.0, gap = 12.0, max = 340.0)
    private val middle = KeyAt(top = 100.0, visible = 300.0, max = 600.0)

    @Test
    fun `statementScroll stays at the top when the text fits, scrolls only to its end, starts a tall text at the top`() {
        assertEquals(0.0, statementScroll(Span(230.0, 400.0), 420.0))
        assertEquals(135.0, statementScroll(Span(230.0, 485.0), 350.0))
        assertEquals(230.0, statementScroll(Span(230.0, 485.0), 120.0))
    }

    @Test
    fun `slipScroll scrolls to the end of the ticket, stops at a tall slip, and leaves a slip in view alone`() {
        assertEquals(340.0, slipScroll(Span(500.0, 620.0), base))
        assertEquals(300.0, slipScroll(Span(300.0, 640.0), base))
        assertNull(slipScroll(Span(200.0, 300.0), base.copy(max = 0.0)))
        assertNull(slipScroll(Span(200.0, 303.0), base.copy(max = 3.0)))
        assertNull(slipScroll(Span(200.0, 312.0), base))
        assertNull(slipScroll(Span(300.0, 452.0), base.copy(top = 140.0)))
        assertEquals(200.0, slipScroll(Span(200.0, 313.0), base))
        assertEquals(13.0, slipScroll(Span(200.0, 313.0), base.copy(max = 13.0)))
        assertEquals(100.0, slipScroll(Span(100.0, 200.0), base.copy(top = 150.0)))
        assertEquals(0.0, slipScroll(Span(200.0, 400.0), base.copy(max = 0.0)))
    }

    @Test
    fun `keyScroll moves by a line, a page less a line or to the ends, stays inside the ticket and ignores other keys`() {
        assertEquals(140.0, keyScroll("ArrowDown", false, middle))
        assertEquals(60.0, keyScroll("ArrowUp", false, middle))
        assertEquals(360.0, keyScroll("PageDown", false, middle))
        assertEquals(0.0, keyScroll("PageUp", false, middle))
        assertEquals(360.0, keyScroll(" ", false, middle))
        assertEquals(0.0, keyScroll(" ", true, middle))
        assertEquals(0.0, keyScroll("Home", false, middle))
        assertEquals(600.0, keyScroll("End", false, middle))
        assertEquals(600.0, keyScroll("ArrowDown", false, KeyAt(590.0, 300.0, 600.0)))
        assertEquals(0.0, keyScroll("ArrowUp", false, KeyAt(10.0, 300.0, 600.0)))
        assertEquals(40.0, keyScroll("PageDown", false, KeyAt(0.0, 49.0, 600.0)))
        assertNull(keyScroll("ArrowLeft", false, middle))
        assertNull(keyScroll("Enter", false, middle))
        assertNull(keyScroll("ArrowDown", true, middle))
    }

    @Test
    fun `statementScroll matches every golden case`() {
        assertEquals(9, statement.cases.size)
        for (case in statement.cases) {
            val input = statement.resolve(case.input)
            val text = input.field("text")
            val result = statementScroll(Span(text.field("top").number(), text.field("bottom").number()), input.field("visible").number())
            assertSameJson(case.output, json(result), case.name)
        }
    }

    @Test
    fun `slipScroll matches every golden case`() {
        assertEquals(13, slip.cases.size)
        for (case in slip.cases) {
            val input = slip.resolve(case.input)
            val span = input.field("slip")
            val at = input.field("at")
            val result = slipScroll(
                Span(span.field("top").number(), span.field("bottom").number()),
                SlipAt(at.field("top").number(), at.field("visible").number(), at.field("gap").number(), at.field("max").number()),
            )
            assertSameJson(case.output, json(result), case.name)
        }
    }

    @Test
    fun `keyScroll matches every golden case`() {
        assertEquals(96, key.cases.size)
        for (case in key.cases) {
            val input = key.resolve(case.input)
            val at = input.field("at")
            val result = keyScroll(
                input.field("key").text(),
                input.field("shift").flag(),
                KeyAt(at.field("top").number(), at.field("visible").number(), at.field("max").number()),
            )
            assertSameJson(case.output, json(result), case.name)
        }
    }

    @Test
    fun `one arrow press scrolls forty`() {
        assertEquals(40.0, ARROW_STEP)
        assertEquals(1, step.cases.size)
        assertEquals(true, step.cases[0].output.number() == ARROW_STEP)
    }
}
