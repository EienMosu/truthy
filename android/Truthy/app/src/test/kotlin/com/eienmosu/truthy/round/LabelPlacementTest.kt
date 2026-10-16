package com.eienmosu.truthy.round

import org.junit.Assert.assertEquals
import org.junit.Test

// Review F1 (font scale 2): the tally broke inside itself ("0 correct · / 0 wrong"). The web's rule (FlightPath.tsx
// PathFrame): each label on one line, the row wrapping between the two, the tally at the right.
class LabelPlacementTest {
    @Test
    fun bothLabelsShareALineWhenTheyFitTheTallyAtTheRight() {
        // "Card 1 of 10" and "0 correct · 0 wrong" at font scale 1 in a 319 dp row (px at density 2.625).
        assertEquals(LabelPlacement(tallyX = 837 - 319, tallyY = 0, height = 37), labelPlacement(837, 21, 245, 37, 319, 37))
    }

    @Test
    fun theTallyMovesWholeToTheNextLineWhenBothDoNotFit() {
        // At font scale 2 the two need 1100 px with the gap: the tally keeps its one line, under the progress, at the right.
        assertEquals(LabelPlacement(tallyX = 837 - 600, tallyY = 70, height = 140), labelPlacement(837, 21, 480, 70, 600, 70))
    }

    @Test
    fun theGapCountsWhenDecidingTheLine() {
        assertEquals(0, labelPlacement(100, 8, 46, 10, 46, 10).tallyY)
        assertEquals(10, labelPlacement(100, 8, 46, 10, 47, 10).tallyY)
    }

    @Test
    fun aTallyWiderThanTheRowStartsAtItsLeftAndRunsPastItsEnd() {
        assertEquals(LabelPlacement(tallyX = 0, tallyY = 70, height = 140), labelPlacement(500, 21, 300, 70, 640, 70))
    }
}
