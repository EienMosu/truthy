package com.eienmosu.truthy.round

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import com.eienmosu.truthy.design.IconPaths
import com.eienmosu.truthy.design.Tokens
import com.eienmosu.truthy.design.TruthyColors
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.engine.LIVES
import com.eienmosu.truthy.engine.Point
import com.eienmosu.truthy.engine.TIMED
import com.eienmosu.truthy.engine.WaypointState
import com.eienmosu.truthy.engine.clockText
import com.eienmosu.truthy.engine.flightPathLabel
import com.eienmosu.truthy.engine.flownPath
import com.eienmosu.truthy.engine.headingAt
import com.eienmosu.truthy.engine.livesLabel
import com.eienmosu.truthy.engine.pointAt
import com.eienmosu.truthy.engine.streakLabel
import com.eienmosu.truthy.engine.streakLayout
import com.eienmosu.truthy.engine.timedLabel
import com.eienmosu.truthy.engine.trailLayout
import com.eienmosu.truthy.engine.waypointStates
import com.eienmosu.truthy.engine.waypointT
import kotlin.math.ceil
import kotlin.math.floor

private object HeaderGeometry {
    const val VIEW_WIDTH = 276f
    const val VIEW_HEIGHT = 34f
    const val ROUTE_STROKE = 1.6f
    const val FLOWN_STROKE = 2.4f
    val ROUTE_DASH = floatArrayOf(2f, 5f)
    const val MARK_RADIUS = 7f
    const val MARK_SQUARE = 13f
    const val MARK_CORNER = 2f
    const val MARK_STROKE = 1.8f
    const val FUTURE_RADIUS = 4f
    const val LAST_RADIUS = 5f
    const val RING_STROKE = 1.4f
    const val RING_GAP = 3.5
    const val REACHED_RING = 10.5f
    const val PLANE_RADIUS = 12f
    const val PLANE_STROKE = 2f
    const val TARGET_RING = 7f
    const val TARGET_CENTRE = 3f
    const val MIN_FUTURE_RADIUS = 2.0
    const val MAX_FUTURE_RADIUS = 4.0
    const val MIN_DOT_RADIUS = 1.2
    val HEART_X = floatArrayOf(11f, 39f, 67f)
    const val HEART_Y = 6f
    const val HEART_STROKE = 1.6f
    const val TRAIL_Y = 17f
    const val TRAIL_STROKE = 1.2f
    const val TRAIL_CORNER = 1.5f
    const val MIN_TRAIL_DOT = 0.6
    const val LIVES_PLANE_X = 238f
    const val TRAIL_END = 274f
    const val CROSS_REACH = 0.22
    const val SHORT_TRAIL = 14
    const val CROSS_STROKE = 1.4f
    const val CROSS_STROKE_LONG = 1.3f
    const val CLOCK_DOT = 5f
    const val QUARTER_RADIUS = 3.5f
    val QUARTERS = doubleArrayOf(0.25, 0.5, 0.75)
    const val MS_PER_SECOND = 1_000.0
}

private class Ink(val ink: Color, val muted: Color, val paper: Color, val accent: Color, val onAccent: Color, val correct: Color, val wrong: Color)

private fun svg(d: String): Path = PathParser().parsePathString(d).toPath()

private val ROUTE: Path by lazy { svg(flownPath(1.0)) }
private val PLANE: Path by lazy { svg(IconPaths.PLANE_ARROW) }
private val HEART: Path by lazy { svg(IconPaths.HEART) }
private val HEART_SLASH: Path by lazy { svg(IconPaths.HEART_SLASH) }
private val TICK: Path by lazy { svg("M-3 0l2 2 4-4") }
private val MARK_X: Path by lazy { svg("M-3-3l6 6m0-6l-6 6") }

private val BOLD = SpanStyle(fontWeight = FontWeight.SemiBold)

/** JavaScript Math.round(x * 10) / 10. */
private fun round1(value: Double): Double = floor(value * 10.0 + 0.5) / 10.0

private fun Point.offset(): Offset = Offset(x.toFloat(), y.toFloat())

private fun label(vararg parts: Pair<String, Boolean>): AnnotatedString = buildAnnotatedString {
    for ((text, bold) in parts) if (bold) withStyle(BOLD) { append(text) } else append(text)
}

/** One image with a full-sentence label, the drawing and the label row (FlightPath.tsx PathFrame). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun InkFrame(label: String, progress: AnnotatedString, tally: AnnotatedString?, modifier: Modifier, draw: DrawScope.(Ink) -> Unit) {
    val colors = TruthyTheme.colors
    val ink = Ink(colors.ink, colors.inkMuted, colors.surfaceRaised, colors.accent, colors.onAccent, colors.correct, colors.wrong)
    Column(modifier.clearAndSetSemantics { contentDescription = label; role = Role.Image }) {
        Canvas(Modifier.fillMaxWidth().height(Tokens.Size.flightPathHeight)) {
            val s = minOf(size.width / HeaderGeometry.VIEW_WIDTH, size.height / HeaderGeometry.VIEW_HEIGHT)
            withTransform({
                translate((size.width - HeaderGeometry.VIEW_WIDTH * s) / 2f, (size.height - HeaderGeometry.VIEW_HEIGHT * s) / 2f)
                scale(s, s, pivot = Offset.Zero)
            }) { this.draw(ink) }
        }
        FlowRow(Modifier.fillMaxWidth().padding(top = Tokens.Space.s2), horizontalArrangement = Arrangement.spacedBy(Tokens.Space.s8)) {
            Text(progress, style = TruthyType.routeLabel, color = colors.ink)
            if (tally != null) Text(tally, Modifier.weight(1f), style = TruthyType.routeLabel, color = colors.ink, textAlign = TextAlign.End)
        }
    }
}

private fun inkOf(colors: TruthyColors): Ink =
    Ink(colors.ink, colors.inkMuted, colors.surfaceRaised, colors.accent, colors.onAccent, colors.correct, colors.wrong)

/**
 * The header frame with a plain drawing, for task 14's completed route: one image labelled [label], the label row
 * hidden from screen readers; [draw] runs in the 276 by 34 drawing's units.
 */
@Composable
internal fun PathFrame(label: String, progress: AnnotatedString, tally: AnnotatedString?, modifier: Modifier = Modifier, draw: DrawScope.() -> Unit) {
    InkFrame(label, progress, tally, modifier) { _ -> draw() }
}

/** The dashed route and its flown part up to [flownTo], as the headers draw it (task 14 reuses it). */
internal fun DrawScope.drawRouteLine(flownTo: Double, colors: TruthyColors) = routeLine(flownTo, inkOf(colors))

/** A waypoint mark scaled by [scale], as the headers draw it (task 14 reuses it). */
internal fun DrawScope.drawMark(correct: Boolean, at: Point, scale: Double, fresh: Boolean, plain: Boolean, colors: TruthyColors) =
    mark(correct, at, inkOf(colors), scale.toFloat(), fresh, plain)

private fun DrawScope.routeLine(flownTo: Double, c: Ink) {
    drawPath(ROUTE, c.ink, style = Stroke(width = HeaderGeometry.ROUTE_STROKE, cap = StrokeCap.Round, pathEffect = PathEffect.dashPathEffect(HeaderGeometry.ROUTE_DASH)))
    if (flownTo > 0.0) drawPath(svg(flownPath(flownTo)), c.ink, style = Stroke(width = HeaderGeometry.FLOWN_STROKE, cap = StrokeCap.Round))
}

private fun DrawScope.plane(at: Point, heading: Double, alpha: Float, c: Ink) {
    if (alpha <= 0f) return
    withTransform({
        translate(at.x.toFloat(), at.y.toFloat())
        rotate(heading.toFloat(), pivot = Offset.Zero)
    }) {
        drawCircle(c.accent, radius = HeaderGeometry.PLANE_RADIUS, center = Offset.Zero, alpha = alpha)
        drawPath(PLANE, c.onAccent, alpha = alpha, style = Stroke(width = HeaderGeometry.PLANE_STROKE, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

/** A circle with a tick (right) or a square with an x (wrong); butt caps and miter joins, as on the web. */
private fun DrawScope.mark(correct: Boolean, at: Point, c: Ink, factor: Float = 1f, fresh: Boolean = false, plain: Boolean = false) {
    withTransform({
        translate(at.x.toFloat(), at.y.toFloat())
        scale(factor, factor, pivot = Offset.Zero)
    }) {
        if (correct) {
            drawCircle(if (fresh) c.correct else c.ink, radius = HeaderGeometry.MARK_RADIUS, center = Offset.Zero)
            if (!plain) drawPath(TICK, c.paper, style = Stroke(width = HeaderGeometry.MARK_STROKE))
        } else {
            val half = HeaderGeometry.MARK_SQUARE / 2f
            drawRoundRect(c.wrong, topLeft = Offset(-half, -half), size = Size(HeaderGeometry.MARK_SQUARE, HeaderGeometry.MARK_SQUARE), cornerRadius = CornerRadius(HeaderGeometry.MARK_CORNER))
            if (!plain) drawPath(MARK_X, c.paper, style = Stroke(width = HeaderGeometry.MARK_STROKE))
        }
    }
}

private fun DrawScope.openCircle(at: Point, radius: Float, c: Ink, fill: Color = c.paper) {
    drawCircle(fill, radius = radius, center = at.offset())
    drawCircle(c.ink, radius = radius, center = at.offset(), style = Stroke(width = HeaderGeometry.ROUTE_STROKE))
}

private fun DrawScope.ringAround(at: Point, radius: Float, c: Ink) {
    drawCircle(c.ink, radius = radius, center = at.offset(), style = Stroke(width = HeaderGeometry.RING_STROKE))
}

private fun partial(path: Path, portion: Float): Path {
    if (portion >= 1f) return path
    val measure = PathMeasure()
    measure.setPath(path, false)
    val out = Path()
    measure.getSegment(0f, measure.length * portion, out, true)
    return out
}

/** The plane fades over 220 ms once its card is answered (FlightPath.tsx Plane); at once with reduced motion. */
@Composable
private fun planeAlpha(hidden: Boolean, reduced: Boolean): Float {
    val alpha by animateFloatAsState(
        targetValue = if (hidden) 0f else 1f,
        animationSpec = if (reduced) snap() else tweenOf(Tokens.Duration.t2, Tokens.Curves.ease),
        label = "plane",
    )
    return alpha
}

@Composable
fun FlightPathHeader(total: Int, results: List<Boolean>, current: Int, answered: Boolean, reduced: Boolean, modifier: Modifier = Modifier) {
    val alpha = planeAlpha(hidden = answered, reduced = reduced)
    val correct = results.count { it }
    val states = waypointStates(total, results, current, answered)
    val t = waypointT(current, total)
    InkFrame(
        label = flightPathLabel(total, results, current),
        progress = label("Card " to false, "${current + 1}" to true, " of $total" to false),
        tally = label("$correct correct · ${results.size - correct} wrong" to false),
        modifier = modifier,
    ) { c ->
        routeLine(t, c)
        states.forEachIndexed { i, state ->
            val at = pointAt(waypointT(i, total))
            when (state) {
                WaypointState.CORRECT -> mark(true, at, c, fresh = i == current)
                WaypointState.WRONG -> mark(false, at, c)
                WaypointState.FUTURE -> openCircle(at, if (i == total - 1) HeaderGeometry.LAST_RADIUS else HeaderGeometry.FUTURE_RADIUS, c)
                WaypointState.CURRENT -> Unit
            }
        }
        plane(pointAt(t), headingAt(t), alpha, c)
    }
}

@Composable
fun StreakHeader(streak: Int, best: Int?, answered: Boolean?, reduced: Boolean, modifier: Modifier = Modifier) {
    val alpha = planeAlpha(hidden = answered != null, reduced = reduced)
    val ended = answered == false
    val done = if (answered == true) streak - 1 else streak
    val layout = streakLayout(done, best)
    val futureRadius = minOf(HeaderGeometry.MAX_FUTURE_RADIUS, round1(layout.dot * 2.0 / 3.0))
    InkFrame(
        label = streakLabel(streak, best, ended),
        progress = if (ended) label("Streak ended at " to false, "$streak" to true) else label("Streak " to false, "$streak" to true),
        tally = if (best != null && best >= 1) label((if (streak > best) "Previous best " else "Best ") to false, "$best" to true) else null,
        modifier = modifier,
    ) { c ->
        val here = pointAt(layout.t(done))
        val ring = layout.ring
        val ringAt = ring?.let { pointAt(layout.t(it)) }
        routeLine(layout.t(done), c)
        if (layout.dot > HeaderGeometry.MIN_DOT_RADIUS) {
            for (slot in 0 until done) mark(true, pointAt(layout.t(slot)), c, factor = (layout.dot / HeaderGeometry.MARK_RADIUS).toFloat(), plain = !layout.ticks)
        }
        if (ring != null && ringAt != null && ring < done) ringAround(ringAt, (layout.dot + HeaderGeometry.RING_GAP).toFloat(), c)
        if (futureRadius >= HeaderGeometry.MIN_FUTURE_RADIUS) {
            for (slot in layout.future) openCircle(pointAt(layout.t(slot)), futureRadius.toFloat(), c)
        }
        if (layout.target && ring != null && ringAt != null && ring > done) {
            openCircle(ringAt, HeaderGeometry.TARGET_RING, c)
            drawCircle(c.ink, radius = HeaderGeometry.TARGET_CENTRE, center = ringAt.offset())
        }
        plane(here, headingAt(layout.t(done)), alpha, c)
        if (answered != null) mark(answered, here, c, fresh = true)
        if (ring != null && answered == true && ring == done) ringAround(here, HeaderGeometry.REACHED_RING, c)
    }
}

@Composable
fun LivesHeader(results: List<Boolean>, answered: Boolean, reduced: Boolean, modifier: Modifier = Modifier) {
    val alpha = planeAlpha(hidden = answered, reduced = reduced)
    val left = maxOf(0, LIVES - results.count { !it })
    val last = results.lastOrNull()
    val striking = if (answered && last == false) left else -1
    val strike = remember(results.size, striking) { Animatable(if (striking >= 0 && !reduced) 0f else 1f) }
    LaunchedEffect(strike) {
        if (strike.value < 1f) strike.animateTo(1f, tweenOf(Tokens.Duration.strike, Tokens.Curves.ease, Tokens.Transitions.stamp.delayMs))
    }
    val drawn = strike.value
    val marks = if (answered) results.dropLast(1) else results
    val layout = trailLayout(marks.size)
    val crossReach = round1(layout.side * HeaderGeometry.CROSS_REACH)
    val crossStroke = if (marks.size <= HeaderGeometry.SHORT_TRAIL) HeaderGeometry.CROSS_STROKE else HeaderGeometry.CROSS_STROKE_LONG
    val trailY = HeaderGeometry.TRAIL_Y.toDouble()
    InkFrame(
        label = livesLabel(results),
        progress = if (left == 0) label("No" to true, " lives left" to false) else label("$left" to true, " of $LIVES lives left" to false),
        tally = label("${results.size}" to true, " answered" to false),
        modifier = modifier,
    ) { c ->
        HeaderGeometry.HEART_X.forEachIndexed { j, x ->
            withTransform({ translate(x, HeaderGeometry.HEART_Y) }) {
                if (j >= left) {
                    drawPath(HEART, c.muted, style = Stroke(width = HeaderGeometry.HEART_STROKE, join = StrokeJoin.Round))
                    val portion = if (j == striking) drawn else 1f
                    if (portion > 0f) drawPath(partial(HEART_SLASH, portion), c.muted, style = Stroke(width = HeaderGeometry.HEART_STROKE, cap = StrokeCap.Round))
                } else {
                    drawPath(HEART, c.ink)
                }
            }
        }
        if (marks.isNotEmpty()) {
            drawLine(c.ink, Offset(layout.x(0).toFloat(), HeaderGeometry.TRAIL_Y), Offset(HeaderGeometry.LIVES_PLANE_X, HeaderGeometry.TRAIL_Y), strokeWidth = HeaderGeometry.TRAIL_STROKE, cap = StrokeCap.Round)
        }
        drawLine(
            c.ink,
            Offset(HeaderGeometry.LIVES_PLANE_X, HeaderGeometry.TRAIL_Y),
            Offset(HeaderGeometry.TRAIL_END, HeaderGeometry.TRAIL_Y),
            strokeWidth = HeaderGeometry.ROUTE_STROKE,
            cap = StrokeCap.Round,
            pathEffect = PathEffect.dashPathEffect(HeaderGeometry.ROUTE_DASH),
        )
        marks.forEachIndexed { i, correct ->
            if (correct && layout.r > HeaderGeometry.MIN_TRAIL_DOT) drawCircle(c.ink, radius = layout.r.toFloat(), center = Offset(layout.x(i).toFloat(), HeaderGeometry.TRAIL_Y))
        }
        marks.forEachIndexed { i, correct ->
            if (correct) return@forEachIndexed
            val x = layout.x(i)
            drawRoundRect(
                c.wrong,
                topLeft = Offset(round1(x - layout.side / 2).toFloat(), round1(trailY - layout.side / 2).toFloat()),
                size = Size(layout.side.toFloat(), layout.side.toFloat()),
                cornerRadius = CornerRadius(HeaderGeometry.TRAIL_CORNER),
            )
            if (layout.cross) {
                val reach = round1(crossReach * 2).toFloat()
                val cross = Path().apply {
                    moveTo(round1(x - crossReach).toFloat(), (trailY - crossReach).toFloat())
                    relativeLineTo(reach, reach)
                    relativeMoveTo(0f, -reach)
                    relativeLineTo(-reach, reach)
                }
                drawPath(cross, c.paper, style = Stroke(width = crossStroke))
            }
        }
        val here = Point(HeaderGeometry.LIVES_PLANE_X.toDouble(), trailY)
        plane(here, 0.0, alpha, c)
        if (answered && last != null) mark(last, here, c, fresh = true)
    }
}

@Composable
fun TimedHeader(remainingMs: Double, correct: Int, wrong: Int, reduced: Boolean, modifier: Modifier = Modifier) {
    val seconds = ceil(maxOf(0.0, remainingMs) / HeaderGeometry.MS_PER_SECOND)
    val shownMs = if (reduced) seconds * HeaderGeometry.MS_PER_SECOND else remainingMs
    val t = (1.0 - shownMs / TIMED.roundMs).coerceIn(0.0, 1.0)
    val clock = TruthyType.timedClock.toSpanStyle()
    InkFrame(
        label = timedLabel(remainingMs, correct, wrong),
        progress = buildAnnotatedString {
            withStyle(clock) { append(clockText(remainingMs)) }
            append(" left")
        },
        tally = label("$correct correct · $wrong wrong" to false),
        modifier = modifier,
    ) { c ->
        routeLine(t, c)
        drawCircle(c.ink, radius = HeaderGeometry.CLOCK_DOT, center = pointAt(0.0).offset())
        for (quarter in HeaderGeometry.QUARTERS) openCircle(pointAt(quarter), HeaderGeometry.QUARTER_RADIUS, c, fill = if (t >= quarter) c.ink else c.paper)
        openCircle(pointAt(1.0), HeaderGeometry.CLOCK_DOT, c)
        plane(pointAt(t), headingAt(t), 1f, c)
    }
}
