package com.eienmosu.truthy.start

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.eienmosu.truthy.design.Tokens

/** Sizes the web's start-flow code draws that no token holds. Each names the line it comes from. */
object StartGeometry {
    val logoTop = 36.dp                // StartFlow.tsx:777, pt-9 above the logo
    val taglineMax = 300.dp            // StartFlow.tsx:779
    val readyLineMax = 320.dp          // StartFlow.tsx:983
    val switchLogoRow = 32.dp          // StartFlow.tsx:274, SWITCH_OFFSET_LOGO_ROW
    val fieldTop = 9.dp                // FillInPass.tsx:181
    val fieldBottom = 11.dp            // FillInPass.tsx:181
    val fieldValueTop = 3.dp           // FillInPass.tsx:192
    val wayBackRadius = 6.dp           // FillInPass.tsx:86
    val dashWidth = 14.dp              // FillInPass.tsx:151
    val dashHeight = 3.dp              // FillInPass.tsx:151
    val dashGap = 5.dp                 // FillInPass.tsx:141
    val lineWordHeight = 22.dp         // FillInPass.tsx:225
    val lineWordTextTop = 1.dp         // FillInPass.tsx:231, pt-px: the word's text 1 below the top of its 22 box
    val legGap = 40.dp                 // FillInPass.tsx:285, the empty middle column of the legs
    val readyCellBottom = 7.dp         // FillInPass.tsx:301
    val compactMarkWidth = 20.dp       // FillInPass.tsx:104
    val compactMarkBoxWidth = 22.dp    // FillInPass.tsx:103
    val compactMarkBoxHeight = 16.dp   // FillInPass.tsx:103
    val continueMarkWidth = 26.dp      // ContinueLine.tsx:59
    val continueLineGap = 3.dp         // ContinueLine.tsx:66
    const val FOCUS_ROOM = 8.0         // StartFlow.tsx:307, room around a card scrolled into view
}

/** Where the start flow's zones meet when what they hold is taller than the web's fixed heights. */
object StartLayout {
    /** StartFlow.tsx:1069-1086: the ready line sits in the step's list like any option, 8 + 6 under the title row. */
    val readyLineTop: Dp = Tokens.Space.s8 + Tokens.Space.s6

    /**
     * StartFlow.tsx:772 and 1059: the web's top zone is 176 tall and the ready pass reaches past it, so the ready title
     * sits 20 + [offset] below the zone's 176 line. The Android zone grows with what it holds ([topZone]), so the offset
     * shrinks by what the zone grew; a pass taller than 176 + [offset] (a large font scale) pushes the title down.
     */
    fun readyTop(offset: Dp, topZone: Dp): Dp = (Tokens.Size.startTopZone + offset - topZone).coerceAtLeast(0.dp)

    /**
     * StartFlow.tsx:826 and 837: while the continue line shows, the list stops foot-gap (76) above the bottom, 12 above
     * the foot's 60 pill set 4 up. A foot taller than the pill (the continue line at a large font scale) pushes the
     * list's end up by what it grew, so the line never lies over the list.
     */
    fun continueGap(footHeight: Dp): Dp = maxOf(Tokens.Size.footGap, footHeight + Tokens.Size.footGap - Tokens.Size.pill)
}

/**
 * app/globals.css:34: `tight` under 600 tall. The `short` rule (under 568, globals.css:29) and the step title's 36 row
 * (StartFlow.tsx:370) are Tokens.Native.shortScreenBelow and Tokens.Native.stepTitleRow, from plan A's native group.
 */
object Breakpoints {
    val tight = 600.dp
}
