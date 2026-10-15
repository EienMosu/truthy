package com.eienmosu.truthy.design

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection

// Path data, in dp-agnostic floats. In SVG path data with y pointing down, the sweep flag 1 is clockwise on screen: the
// corners (travelling clockwise round the paper) use it, the notches (half circles cut into the paper) use 0.

object TicketGeometry {
    private fun n(value: Float) = pathNumber(value)

    /** The main part: top corners [r], a quarter circle of [notch] cut into each bottom corner. */
    fun mainPathData(width: Float, height: Float, r: Float, notch: Float): String =
        "M0 ${n(r)}A${n(r)} ${n(r)} 0 0 1 ${n(r)} 0" +
            "L${n(width - r)} 0" +
            "A${n(r)} ${n(r)} 0 0 1 ${n(width)} ${n(r)}" +
            "L${n(width)} ${n(height - notch)}" +
            "A${n(notch)} ${n(notch)} 0 0 0 ${n(width - notch)} ${n(height)}" +
            "L${n(notch)} ${n(height)}" +
            "A${n(notch)} ${n(notch)} 0 0 0 0 ${n(height - notch)}Z"

    /** The lower part (stub, slip or list): a quarter circle of [notch] cut into each top corner, bottom corners [r]. */
    fun lowerPathData(width: Float, height: Float, r: Float, notch: Float): String =
        "M${n(notch)} 0" +
            "L${n(width - notch)} 0" +
            "A${n(notch)} ${n(notch)} 0 0 0 ${n(width)} ${n(notch)}" +
            "L${n(width)} ${n(height - r)}" +
            "A${n(r)} ${n(r)} 0 0 1 ${n(width - r)} ${n(height)}" +
            "L${n(r)} ${n(height)}" +
            "A${n(r)} ${n(r)} 0 0 1 0 ${n(height - r)}" +
            "L0 ${n(notch)}" +
            "A${n(notch)} ${n(notch)} 0 0 0 ${n(notch)} 0Z"

    /** A destination card: corners [r], a half circle of [notch] cut into the top and the bottom edge on the stub line. */
    fun cardPathData(width: Float, height: Float, stub: Float, r: Float, notch: Float): String {
        val x = width - stub
        return "M0 ${n(r)}A${n(r)} ${n(r)} 0 0 1 ${n(r)} 0" +
            "L${n(x - notch)} 0" +
            "A${n(notch)} ${n(notch)} 0 0 0 ${n(x + notch)} 0" +
            "L${n(width - r)} 0" +
            "A${n(r)} ${n(r)} 0 0 1 ${n(width)} ${n(r)}" +
            "L${n(width)} ${n(height - r)}" +
            "A${n(r)} ${n(r)} 0 0 1 ${n(width - r)} ${n(height)}" +
            "L${n(x + notch)} ${n(height)}" +
            "A${n(notch)} ${n(notch)} 0 0 0 ${n(x - notch)} ${n(height)}" +
            "L${n(r)} ${n(height)}" +
            "A${n(r)} ${n(r)} 0 0 1 0 ${n(height - r)}Z"
    }
}

private fun outlineOf(data: String): Outline = Outline.Generic(PathParser().parsePathString(data).toPath())

data class TicketMainShape(
    val cornerRadius: Dp = Tokens.Radius.card,
    val notchRadius: Dp = Tokens.Size.notch,
) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline =
        outlineOf(
            TicketGeometry.mainPathData(
                size.width,
                size.height,
                with(density) { cornerRadius.toPx() },
                with(density) { notchRadius.toPx() },
            ),
        )
}

data class TicketLowerShape(
    val cornerRadius: Dp = Tokens.Radius.card,
    val notchRadius: Dp = Tokens.Size.notch,
) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline =
        outlineOf(
            TicketGeometry.lowerPathData(
                size.width,
                size.height,
                with(density) { cornerRadius.toPx() },
                with(density) { notchRadius.toPx() },
            ),
        )
}

data class DestinationCardShape(
    val stubWidth: Dp,
    val cornerRadius: Dp = Tokens.Radius.card,
    val notchRadius: Dp = Tokens.Size.cardNotch,
) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline =
        outlineOf(
            TicketGeometry.cardPathData(
                size.width,
                size.height,
                with(density) { stubWidth.toPx() },
                with(density) { cornerRadius.toPx() },
                with(density) { notchRadius.toPx() },
            ),
        )
}

/** A straight dashed line in dp, drawn with butt ends (the web's repeating-linear-gradient). */
data class DashedLine(
    val x1: Float,
    val y1: Float,
    val x2: Float,
    val y2: Float,
    val width: Float,
    val on: Float,
    val off: Float,
)

object PerforationGeometry {
    // BoardingPass.tsx PERFORATION: repeating-linear-gradient(90deg, rule 0 7px, transparent 7px 12px).
    const val TICKET_DASH_ON = 7f
    const val TICKET_DASH_OFF = 5f

    // DestinationCard.tsx PERFORATION: repeating-linear-gradient(180deg, rule 0 5px, transparent 5px 10px).
    const val CARD_DASH_ON = 5f
    const val CARD_DASH_OFF = 5f

    /** Along the bottom [stroke] of the main part, [notch] + [inset] from each side. */
    fun ticket(width: Float, height: Float, notch: Float, inset: Float, stroke: Float): DashedLine =
        DashedLine(
            notch + inset,
            height - stroke / 2f,
            width - notch - inset,
            height - stroke / 2f,
            stroke,
            TICKET_DASH_ON,
            TICKET_DASH_OFF,
        )

    /** Down the stub line, [inset] from the top and the bottom. */
    fun card(width: Float, height: Float, stub: Float, inset: Float, stroke: Float): DashedLine =
        DashedLine(width - stub, inset, width - stub, height - inset, stroke, CARD_DASH_ON, CARD_DASH_OFF)
}

private fun DrawScope.drawDashedLine(line: DashedLine, color: Color) {
    val d = density
    drawLine(
        color = color,
        start = Offset(line.x1 * d, line.y1 * d),
        end = Offset(line.x2 * d, line.y2 * d),
        strokeWidth = line.width * d,
        cap = StrokeCap.Butt,
        pathEffect = PathEffect.dashPathEffect(floatArrayOf(line.on * d, line.off * d)),
    )
}

/** The dashed line at the bottom of the main part of a ticket; call it from drawBehind on the part. */
fun DrawScope.drawTicketPerforation(color: Color) {
    val d = density
    drawDashedLine(
        PerforationGeometry.ticket(
            size.width / d,
            size.height / d,
            Tokens.Size.notch.value,
            Tokens.Space.s6.value,
            Tokens.Stroke.perforation.value,
        ),
        color,
    )
}

/** The dashed line on a destination card's stub line; call it from drawBehind on the card. */
fun DrawScope.drawCardPerforation(color: Color, stubWidth: Dp) {
    val d = density
    drawDashedLine(
        PerforationGeometry.card(
            size.width / d,
            size.height / d,
            stubWidth.value,
            Tokens.Space.s12.value,
            Tokens.Stroke.rule.value,
        ),
        color,
    )
}

/** One border line: its centre line's inset from the box, the corner radius of the centre line and its width. */
data class BorderLine(val inset: Float, val cornerRadius: Float, val width: Float)

object StampBorder {
    /**
     * [total] is the CSS border width (3). A double border is three equal bands, line, gap, line; the outer edge of the
     * outer line has radius [radius], the outer edge of the inner line is inset by two bands. A solid border is one line.
     */
    fun lines(total: Float, radius: Float, double: Boolean): List<BorderLine> =
        if (double) {
            val band = total / 3f
            listOf(
                BorderLine(band / 2f, radius - band / 2f, band),
                BorderLine(2f * band + band / 2f, radius - 2f * band - band / 2f, band),
            )
        } else {
            listOf(BorderLine(total / 2f, radius - total / 2f, total))
        }
}

/** Draws the stamp's border inside the box in [color]. The caller adds `padding(total)` before its own padding. */
fun Modifier.stampBorder(
    color: Color,
    double: Boolean,
    radius: Dp = Tokens.Radius.small,
    total: Dp = Tokens.Stroke.stamp,
): Modifier = drawBehind {
    for (line in StampBorder.lines(total.toPx(), radius.toPx(), double)) {
        drawRoundRect(
            color = color,
            topLeft = Offset(line.inset, line.inset),
            size = Size(size.width - 2f * line.inset, size.height - 2f * line.inset),
            cornerRadius = CornerRadius(line.cornerRadius),
            style = Stroke(width = line.width),
        )
    }
}
