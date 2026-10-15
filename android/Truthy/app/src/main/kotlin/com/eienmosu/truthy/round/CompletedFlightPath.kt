package com.eienmosu.truthy.round

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import com.eienmosu.truthy.design.TruthyTheme
import com.eienmosu.truthy.design.TruthyType
import com.eienmosu.truthy.engine.ResultCopy

/**
 * The result's header route (FlightPath.tsx, "completed"): the whole route flown, every card's mark, the Streak ring
 * at the previous best, no plane; the label row says copy.ended in bold, copy.endedDetail, and the tally.
 */
@Composable
fun CompletedFlightPath(copy: ResultCopy, results: List<Boolean>, modifier: Modifier = Modifier) {
    val colors = TruthyTheme.colors
    val marks = remember(results, copy.marks, copy.ring) { completedMarks(results, copy.marks, copy.ring) }
    val correct = results.count { it }
    val progress = buildAnnotatedString {
        withStyle(SpanStyle(fontWeight = TruthyType.monoDataStrong.fontWeight)) { append(copy.ended) }
        append(copy.endedDetail)
    }
    PathFrame(
        label = copy.label,
        progress = progress,
        tally = AnnotatedString(ResultText.tally(correct, results.size - correct)),
        modifier = modifier,
    ) {
        drawRouteLine(flownTo = 1.0, colors = colors)
        for (mark in marks.below) drawMark(correct = mark.correct, at = mark.at, scale = mark.scale, fresh = false, plain = mark.plain, colors = colors)
        val ring = marks.ring
        if (ring != null) {
            drawCircle(
                color = colors.ink,
                radius = ring.radius.toFloat(),
                center = Offset(ring.at.x.toFloat(), ring.at.y.toFloat()),
                style = Stroke(width = LeaveResultConstants.RING_STROKE),
            )
        }
        for (mark in marks.above) drawMark(correct = mark.correct, at = mark.at, scale = mark.scale, fresh = false, plain = mark.plain, colors = colors)
    }
}
