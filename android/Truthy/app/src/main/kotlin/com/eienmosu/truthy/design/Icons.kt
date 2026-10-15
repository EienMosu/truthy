package com.eienmosu.truthy.design

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.foundation.layout.size
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** The 19 icons, as ImageVectors. The route icon (a dashed curve) is RouteIcon, drawn in code. */
enum class IconId {
    CLOSE, CROSS, CHECK, BACK_HEADER, BACK_PILL, FORWARD, CHEVRON_RIGHT, CHEVRON_DOWN, PLANE, CLOUD, SKY_CLOUD,
    BOOK, REPLAY, CLOCK, STAR, HEART, HEART_LOST, MOON, SUN,
}

internal enum class IconPaint { CURRENT, ACCENT, ON_ACCENT }

internal class IconPart(
    val pathData: String,
    val fill: Boolean,
    val paint: IconPaint,
    val cap: StrokeCap,
    val join: StrokeJoin,
)

/**
 * One icon: the box the paths are drawn in (originX/originY are the viewBox's min-x and min-y), the width the web draws
 * it at by default, its default stroke width in viewBox units and its parts.
 */
internal class IconSpec(
    val originX: Float,
    val originY: Float,
    val viewportWidth: Float,
    val viewportHeight: Float,
    val defaultWidth: Float,
    val defaultStroke: Float,
    val tintable: Boolean,
    val parts: List<IconPart>,
)

internal fun circlePathData(cx: Float, cy: Float, r: Float): String {
    val radius = pathNumber(r)
    return "M${pathNumber(cx - r)} ${pathNumber(cy)}a$radius $radius 0 1 0 ${pathNumber(2 * r)} 0" +
        "a$radius $radius 0 1 0 ${pathNumber(-2 * r)} 0z"
}

private fun stroked(
    data: String,
    cap: StrokeCap = StrokeCap.Round,
    join: StrokeJoin = StrokeJoin.Round,
    paint: IconPaint = IconPaint.CURRENT,
) = IconPart(data, false, paint, cap, join)

private fun filled(data: String, paint: IconPaint = IconPaint.CURRENT) =
    IconPart(data, true, paint, StrokeCap.Butt, StrokeJoin.Miter)

private fun plain(
    size: Float,
    defaultStroke: Float,
    vararg parts: IconPart,
) = IconSpec(0f, 0f, size, size, size, defaultStroke, true, parts.toList())

// components/icons.tsx, component by component. The stroke widths are the web's defaults; the box is its viewBox.
private val SPECS: Map<IconId, IconSpec> = mapOf(
    IconId.CLOSE to plain(16f, 2.4f, stroked(IconPaths.CROSS)),
    IconId.CROSS to plain(16f, 3f, stroked(IconPaths.CROSS)),
    IconId.CHECK to plain(18f, 3f, stroked(IconPaths.CHECK)),
    IconId.BACK_HEADER to IconSpec(0f, 0f, 18f, 16f, 18f, 2.4f, true, listOf(stroked(IconPaths.BACK_HEADER))),
    IconId.BACK_PILL to plain(18f, 2.2f, stroked(IconPaths.BACK_PILL)),
    IconId.FORWARD to IconSpec(0f, 0f, 40f, 16f, 40f, 2f, true, listOf(stroked(IconPaths.FORWARD))),
    IconId.CHEVRON_RIGHT to plain(16f, 2.2f, stroked(IconPaths.CHEVRON_RIGHT)),
    IconId.CHEVRON_DOWN to plain(12f, 1.8f, stroked(IconPaths.CHEVRON_DOWN)),
    IconId.PLANE to IconSpec(
        -12f, -12f, 24f, 24f, 24f, 2f, false,
        listOf(
            filled(circlePathData(0f, 0f, 12f), IconPaint.ACCENT),
            stroked(IconPaths.PLANE_ARROW, paint = IconPaint.ON_ACCENT),
        ),
    ),
    IconId.CLOUD to IconSpec(0f, 0f, 22f, 16f, 22f, 0f, true, listOf(filled(IconPaths.CARRIER_CLOUD))),
    IconId.SKY_CLOUD to IconSpec(0f, 0f, 150f, 46f, 150f, 0f, true, listOf(filled(IconPaths.SKY_CLOUD))),
    IconId.BOOK to plain(18f, 1.6f, stroked(IconPaths.BOOK, cap = StrokeCap.Butt)),
    IconId.REPLAY to plain(18f, 2.2f, stroked(IconPaths.REPLAY)),
    IconId.CLOCK to plain(
        22f, 2.4f,
        stroked(circlePathData(11f, 12f, 8f), cap = StrokeCap.Butt, join = StrokeJoin.Miter),
        stroked(IconPaths.CLOCK_HANDS),
    ),
    IconId.STAR to plain(18f, 0f, filled(IconPaths.STAR)),
    IconId.HEART to IconSpec(-11f, 0f, 22f, 22f, 20f, 0f, true, listOf(filled(IconPaths.HEART))),
    IconId.HEART_LOST to IconSpec(
        -11f, 0f, 22f, 22f, 20f, 1.6f, true,
        listOf(
            stroked(IconPaths.HEART, cap = StrokeCap.Butt, join = StrokeJoin.Round),
            stroked(IconPaths.HEART_SLASH, cap = StrokeCap.Round, join = StrokeJoin.Miter),
        ),
    ),
    IconId.MOON to plain(18f, 2f, stroked(IconPaths.MOON)),
    IconId.SUN to plain(
        18f, 2f,
        stroked(circlePathData(9f, 9f, 3.3f)),
        stroked(IconPaths.SUN_RAYS),
    ),
)

internal fun iconSpec(id: IconId): IconSpec = SPECS.getValue(id)

private fun paintColor(paint: IconPaint, colors: TruthyColors?): Color = when (paint) {
    IconPaint.CURRENT -> Color.Black
    IconPaint.ACCENT -> requireNotNull(colors) { "This icon has two colours; pass the theme's colours" }.accent
    IconPaint.ON_ACCENT -> requireNotNull(colors) { "This icon has two colours; pass the theme's colours" }.onAccent
}

/**
 * The icon as an ImageVector. Single colour icons are black and are tinted where they are drawn; the plane takes its two
 * colours from [colors]. [strokeWidth] replaces the icon's default in viewBox units (the web passes 3 to the close cross
 * for False, for instance); filled icons ignore it.
 */
fun iconVector(id: IconId, strokeWidth: Float? = null, colors: TruthyColors? = null): ImageVector {
    val spec = iconSpec(id)
    val width = strokeWidth ?: spec.defaultStroke
    // The web rounds the proportional height to 2 decimals (icons.tsx round()).
    val height = Math.round(spec.defaultWidth * spec.viewportHeight / spec.viewportWidth * 100f) / 100f
    val builder = ImageVector.Builder(
        name = id.name,
        defaultWidth = spec.defaultWidth.dp,
        defaultHeight = height.dp,
        viewportWidth = spec.viewportWidth,
        viewportHeight = spec.viewportHeight,
    )
    val shifted = spec.originX != 0f || spec.originY != 0f
    if (shifted) builder.addGroup(translationX = -spec.originX, translationY = -spec.originY)
    for (part in spec.parts) {
        val nodes = PathParser().parsePathString(part.pathData).toNodes()
        val brush = SolidColor(paintColor(part.paint, colors))
        if (part.fill) {
            builder.addPath(nodes, fill = brush)
        } else {
            builder.addPath(
                nodes,
                stroke = brush,
                strokeLineWidth = width,
                strokeLineCap = part.cap,
                strokeLineJoin = part.join,
            )
        }
    }
    return builder.build()
}

/**
 * An icon. Decorative unless [label] is given (the web hides icons from screen readers unless they carry a label).
 * [width] replaces the default drawn width; the height follows the icon's proportions. [tint] colours single colour icons.
 */
@Composable
fun TruthyIcon(
    id: IconId,
    modifier: Modifier = Modifier,
    tint: Color = TruthyTheme.colors.ink,
    width: Dp? = null,
    strokeWidth: Float? = null,
    label: String? = null,
) {
    val colors = TruthyTheme.colors
    val spec = iconSpec(id)
    val vector = remember(id, strokeWidth, colors) { iconVector(id, strokeWidth, colors) }
    val painter = rememberVectorPainter(vector)
    val drawnWidth = width ?: vector.defaultWidth
    val drawnHeight = drawnWidth * (spec.viewportHeight / spec.viewportWidth)
    Image(
        painter = painter,
        contentDescription = label,
        modifier = modifier.size(drawnWidth, drawnHeight),
        colorFilter = if (spec.tintable) ColorFilter.tint(tint) else null,
    )
}

/** components/icons.tsx RouteIcon: two ringed stops joined by a dashed curve, 20 by 14, stroke 1.8. */
object RouteIconSpec {
    const val WIDTH = 20f
    const val HEIGHT = 14f
    const val STROKE = 1.8f
    const val RADIUS = 2f
    const val DASH_ON = 2f
    const val DASH_OFF = 3f
    const val FROM_X = 3f
    const val FROM_Y = 11f
    const val TO_X = 17f
    const val TO_Y = 3f
}

/** Drawn in code because a vector cannot dash. [width] replaces the default drawn width. */
@Composable
fun RouteIcon(
    modifier: Modifier = Modifier,
    width: Dp = RouteIconSpec.WIDTH.dp,
    tint: Color = TruthyTheme.colors.ink,
) {
    val curve = remember { PathParser().parsePathString(IconPaths.ROUTE_CURVE).toPath() }
    val height = width * (RouteIconSpec.HEIGHT / RouteIconSpec.WIDTH)
    Canvas(modifier.size(width, height)) {
        val k = size.width / RouteIconSpec.WIDTH
        val ring = Stroke(width = RouteIconSpec.STROKE * k)
        drawCircle(tint, RouteIconSpec.RADIUS * k, Offset(RouteIconSpec.FROM_X * k, RouteIconSpec.FROM_Y * k), style = ring)
        drawCircle(tint, RouteIconSpec.RADIUS * k, Offset(RouteIconSpec.TO_X * k, RouteIconSpec.TO_Y * k), style = ring)
        withTransform({ scale(k, k, pivot = Offset.Zero) }) {
            drawPath(
                curve,
                tint,
                style = Stroke(
                    width = RouteIconSpec.STROKE,
                    cap = StrokeCap.Round,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(RouteIconSpec.DASH_ON, RouteIconSpec.DASH_OFF)),
                ),
            )
        }
    }
}
