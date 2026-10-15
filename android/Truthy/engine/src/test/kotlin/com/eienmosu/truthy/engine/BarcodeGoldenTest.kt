package com.eienmosu.truthy.engine

import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.Test

class BarcodeGoldenTest : CopyGoldenBase() {
    private val file = Golden.load("components/BoardingPass", "barcodeBars")

    @Test
    fun `it starts with bars 2, 1, 1, 2 and ends with 1, 1, 2`() {
        val code = barcodeBars("A")
        assertEquals(BarcodeBar(0, 2), code.bars[0])
        assertEquals(BarcodeBar(3, 1), code.bars[1])
        assertEquals(BarcodeBar(code.width - 2, 2), code.bars.last())
        assertEquals(BarcodeBar(code.width - 4, 1), code.bars[code.bars.size - 2])
    }

    @Test
    fun `each character takes 7 bars and a gap, 2 wide for a 1 bit and 1 wide for a 0 bit`() {
        assertEquals(6 + 10 + 4, barcodeBars("A").width)
        assertEquals(6 + 20 + 4, barcodeBars("AA").width)
    }

    @Test
    fun `it is the same for the same data and different for different data`() {
        assertEquals(barcodeBars("aws-clf-c02-t2.1-06"), barcodeBars("aws-clf-c02-t2.1-06"))
        assertNotEquals(barcodeBars("aws-clf-c02-t2.1-06"), barcodeBars("aws-clf-c02-t2.1-07"))
    }

    @Test
    fun `the empty string draws the end bars right after the start bars, and only the low seven bits of the first UTF-16 unit count`() {
        assertEquals(
            Barcode(listOf(BarcodeBar(0, 2), BarcodeBar(3, 1), BarcodeBar(6, 1), BarcodeBar(8, 2)), 10),
            barcodeBars(""),
        )
        assertEquals(barcodeBars("i"), barcodeBars("é"))
        assertEquals(barcodeBars("\uD834"), barcodeBars("𝄞"))
        assertNotEquals(barcodeBars("\u0000"), barcodeBars("𝄞"))
    }

    @Test
    fun `barcodeBars matches every golden case`() {
        assertEquals(10, file.cases.size)
        for (case in file.cases) {
            val code = barcodeBars(case.input.field("data").text())
            val made = json(mapOf("bars" to code.bars.map { mapOf("x" to it.x, "width" to it.width) }, "width" to code.width))
            assertSameJson(case.output, made, case.name)
        }
    }
}
