package com.eienmosu.truthy.design

import androidx.compose.ui.graphics.vector.PathNode
import androidx.compose.ui.graphics.vector.PathParser
import org.junit.Assert.assertEquals
import org.junit.Test

class ShapesTest {
    private fun arcs(data: String): List<PathNode.ArcTo> =
        PathParser().parsePathString(data).toNodes().filterIsInstance<PathNode.ArcTo>()

    // The main part of the ticket (BoardingPass.tsx notchedPaper(..., "bottom") inside rounded-t-card): top corners
    // 16, and a quarter circle of 12 cut into each bottom corner, centred on the corner.
    @Test
    fun theMainPartHasRoundTopCornersAndNotchedBottomCorners() {
        assertEquals(
            "M0 16A16 16 0 0 1 16 0L342 0A16 16 0 0 1 358 16L358 288A12 12 0 0 0 346 300L12 300A12 12 0 0 0 0 288Z",
            TicketGeometry.mainPathData(358f, 300f, 16f, 12f),
        )
    }

    // PassLower: notches at the top corners, radius 16 at the bottom (rounded-b-card).
    @Test
    fun theLowerPartHasNotchedTopCornersAndRoundBottomCorners() {
        assertEquals(
            "M12 0L346 0A12 12 0 0 0 358 12L358 212A16 16 0 0 1 342 228L16 228A16 16 0 0 1 0 212L0 12A12 12 0 0 0 12 0Z",
            TicketGeometry.lowerPathData(358f, 228f, 16f, 12f),
        )
    }

    // DestinationCard.tsx notchedCard: a half circle of 7 cut into the top and the bottom edge at x = width - stub.
    @Test
    fun theDestinationCardIsCutByTwoHalfCirclesOnTheStubLine() {
        assertEquals(
            "M0 16A16 16 0 0 1 16 0L271 0A7 7 0 0 0 285 0L342 0A16 16 0 0 1 358 16L358 112A16 16 0 0 1 342 128" +
                "L285 128A7 7 0 0 0 271 128L16 128A16 16 0 0 1 0 112Z",
            TicketGeometry.cardPathData(358f, 128f, 80f, 16f, 7f),
        )
    }

    // Clockwise corners turn with sweep 1; a notch bites into the paper with sweep 0.
    @Test
    fun cornersTurnClockwiseAndNotchesCounterClockwise() {
        assertEquals(
            listOf(true, true, false, false),
            arcs(TicketGeometry.mainPathData(358f, 300f, 16f, 12f)).map { it.isPositiveArc },
        )
        assertEquals(
            listOf(false, true, true, false),
            arcs(TicketGeometry.lowerPathData(358f, 228f, 16f, 12f)).map { it.isPositiveArc },
        )
        assertEquals(
            listOf(true, false, true, true, false, true),
            arcs(TicketGeometry.cardPathData(358f, 128f, 80f, 16f, 7f)).map { it.isPositiveArc },
        )
    }

    // BoardingPass.tsx PERFORATION: left and right at notch + 6, the bottom 2 of the main part, dashes 7 on, 5 off.
    @Test
    fun theTicketPerforationRunsBetweenTheNotchesAlongTheBottomEdge() {
        assertEquals(
            DashedLine(18f, 299f, 340f, 299f, 2f, 7f, 5f),
            PerforationGeometry.ticket(358f, 300f, 12f, 6f, 2f),
        )
    }

    // DestinationCard.tsx perforation: at the stub line, 12 from the top and the bottom, 1.5 wide, dashes 5 on, 5 off.
    @Test
    fun theCardPerforationRunsDownTheStubLine() {
        assertEquals(
            DashedLine(278f, 12f, 278f, 116f, 1.5f, 5f, 5f),
            PerforationGeometry.card(358f, 128f, 80f, 12f, 1.5f),
        )
    }

    // DS 9: two 1 px lines with a 1 px gap, the outer at radius 8 and the inner inset 2 at radius 6 (centre lines 7.5 and 5.5).
    @Test
    fun theVerdictStampHasADoubleBorder() {
        assertEquals(
            listOf(BorderLine(0.5f, 7.5f, 1f), BorderLine(2.5f, 5.5f, 1f)),
            StampBorder.lines(3f, 8f, true),
        )
    }

    // BoardingPass.tsx INTENT_STAMP: border 3 solid.
    @Test
    fun theIntentStampHasASolidBorder() {
        assertEquals(listOf(BorderLine(1.5f, 6.5f, 3f)), StampBorder.lines(3f, 8f, false))
    }
}
