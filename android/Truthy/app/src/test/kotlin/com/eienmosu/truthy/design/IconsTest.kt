package com.eienmosu.truthy.design

import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.VectorGroup
import androidx.compose.ui.graphics.vector.VectorPath
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class IconsTest {
    private val day = Tokens.Colors.day

    private fun paths(group: VectorGroup): List<VectorPath> = group.flatMap { node ->
        when (node) {
            is VectorPath -> listOf(node)
            is VectorGroup -> paths(node)
        }
    }

    private fun paths(vector: ImageVector): List<VectorPath> = paths(vector.root)

    // Reference 5.6, icon by icon: drawn size in dp (width, height), the viewBox, how many paths, the stroke width
    // (null for a filled icon).
    private class Row(
        val id: IconId,
        val width: Float,
        val height: Float,
        val viewportWidth: Float,
        val viewportHeight: Float,
        val parts: Int,
        val stroke: Float?,
    )

    private val rows = listOf(
        Row(IconId.CLOSE, 16f, 16f, 16f, 16f, 1, 2.4f),
        Row(IconId.CROSS, 16f, 16f, 16f, 16f, 1, 3f),
        Row(IconId.CHECK, 18f, 18f, 18f, 18f, 1, 3f),
        Row(IconId.BACK_HEADER, 18f, 16f, 18f, 16f, 1, 2.4f),
        Row(IconId.BACK_PILL, 18f, 18f, 18f, 18f, 1, 2.2f),
        Row(IconId.FORWARD, 40f, 16f, 40f, 16f, 1, 2f),
        Row(IconId.CHEVRON_RIGHT, 16f, 16f, 16f, 16f, 1, 2.2f),
        Row(IconId.CHEVRON_DOWN, 12f, 12f, 12f, 12f, 1, 1.8f),
        Row(IconId.PLANE, 24f, 24f, 24f, 24f, 2, 2f),
        Row(IconId.CLOUD, 22f, 16f, 22f, 16f, 1, null),
        Row(IconId.SKY_CLOUD, 150f, 46f, 150f, 46f, 1, null),
        Row(IconId.BOOK, 18f, 18f, 18f, 18f, 1, 1.6f),
        Row(IconId.REPLAY, 18f, 18f, 18f, 18f, 1, 2.2f),
        Row(IconId.CLOCK, 22f, 22f, 22f, 22f, 2, 2.4f),
        Row(IconId.STAR, 18f, 18f, 18f, 18f, 1, null),
        Row(IconId.HEART, 20f, 20f, 22f, 22f, 1, null),
        Row(IconId.HEART_LOST, 20f, 20f, 22f, 22f, 2, 1.6f),
        Row(IconId.MOON, 18f, 18f, 18f, 18f, 1, 2f),
        Row(IconId.SUN, 18f, 18f, 18f, 18f, 2, 2f),
    )

    @Test
    fun thereAreNineteenIcons() {
        assertEquals(19, IconId.entries.size)
        assertEquals(IconId.entries.toSet(), rows.map { it.id }.toSet())
    }

    @Test
    fun everyIconHasTheReferenceSizeBoxAndStroke() {
        for (row in rows) {
            val vector = iconVector(row.id, colors = day)
            assertEquals("${row.id} width", row.width, vector.defaultWidth.value, 0.001f)
            assertEquals("${row.id} height", row.height, vector.defaultHeight.value, 0.001f)
            assertEquals("${row.id} viewport width", row.viewportWidth, vector.viewportWidth, 0.001f)
            assertEquals("${row.id} viewport height", row.viewportHeight, vector.viewportHeight, 0.001f)
            val parts = paths(vector.root)
            assertEquals("${row.id} paths", row.parts, parts.size)
            val stroked = parts.filter { it.stroke != null }
            if (row.stroke == null) {
                assertTrue("${row.id} is filled", parts.all { it.fill != null && it.stroke == null })
            } else {
                assertTrue("${row.id} has a stroke", stroked.isNotEmpty())
                for (part in stroked) assertEquals("${row.id} stroke", row.stroke, part.strokeLineWidth, 0.001f)
            }
        }
    }

    @Test
    fun capsAndJoinsAreTheWebsRoundOnesExceptWhereTheWebSetsNone() {
        val close = paths(iconVector(IconId.CLOSE, colors = day)).single()
        assertEquals(StrokeCap.Round, close.strokeLineCap)
        assertEquals(StrokeJoin.Round, close.strokeLineJoin)

        val book = paths(iconVector(IconId.BOOK, colors = day)).single()
        assertEquals(StrokeCap.Butt, book.strokeLineCap)
        assertEquals(StrokeJoin.Round, book.strokeLineJoin)

        val clock = paths(iconVector(IconId.CLOCK, colors = day))
        assertEquals(StrokeCap.Butt, clock[0].strokeLineCap)
        assertEquals(StrokeJoin.Miter, clock[0].strokeLineJoin)
        assertEquals(StrokeCap.Round, clock[1].strokeLineCap)
        assertEquals(StrokeJoin.Round, clock[1].strokeLineJoin)

        val lost = paths(iconVector(IconId.HEART_LOST, colors = day))
        assertEquals(StrokeCap.Butt, lost[0].strokeLineCap)
        assertEquals(StrokeJoin.Round, lost[0].strokeLineJoin)
        assertEquals(StrokeCap.Round, lost[1].strokeLineCap)
        assertEquals(StrokeJoin.Miter, lost[1].strokeLineJoin)
    }

    @Test
    fun aViewBoxThatDoesNotStartAtZeroIsMovedByAGroup() {
        val heart = iconVector(IconId.HEART, colors = day).root[0] as VectorGroup
        assertEquals(11f, heart.translationX, 0.001f)
        assertEquals(0f, heart.translationY, 0.001f)

        val plane = iconVector(IconId.PLANE, colors = day).root[0] as VectorGroup
        assertEquals(12f, plane.translationX, 0.001f)
        assertEquals(12f, plane.translationY, 0.001f)

        assertTrue(iconVector(IconId.CLOSE, colors = day).root[0] is VectorPath)
    }

    @Test
    fun thePlaneIsAnAccentDiscWithAnOnAccentArrow() {
        val parts = paths(iconVector(IconId.PLANE, colors = day))
        assertEquals(day.accent, (parts[0].fill as SolidColor).value)
        assertNull(parts[0].stroke)
        assertEquals(day.onAccent, (parts[1].stroke as SolidColor).value)
        assertNull(parts[1].fill)
        val night = Tokens.Colors.night
        assertEquals(night.accent, (paths(iconVector(IconId.PLANE, colors = night))[0].fill as SolidColor).value)
    }

    @Test
    fun aStrokeWidthCanBeOverriddenAsTheCrossAndTheCloseButtonShareOnePath() {
        val heavy = paths(iconVector(IconId.CLOSE, strokeWidth = 3f, colors = day)).single()
        assertEquals(3f, heavy.strokeLineWidth, 0.001f)
        assertNotNull(heavy.stroke)
        val sun = paths(iconVector(IconId.SUN, strokeWidth = 2.5f, colors = day))
        assertTrue(sun.all { it.strokeLineWidth == 2.5f })
    }

    @Test
    fun aCircleIsTwoArcs() {
        assertEquals("M5.7 9a3.3 3.3 0 1 0 6.6 0a3.3 3.3 0 1 0 -6.6 0z", circlePathData(9f, 9f, 3.3f))
        assertEquals("M-12 0a12 12 0 1 0 24 0a12 12 0 1 0 -24 0z", circlePathData(0f, 0f, 12f))
    }
}
