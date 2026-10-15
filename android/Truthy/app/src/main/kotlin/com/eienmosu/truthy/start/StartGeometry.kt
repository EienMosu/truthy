package com.eienmosu.truthy.start

import androidx.compose.ui.unit.dp

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
    val legGap = 40.dp                 // FillInPass.tsx:285, the empty middle column of the legs
    val readyCellBottom = 7.dp         // FillInPass.tsx:301
    val compactMarkWidth = 20.dp       // FillInPass.tsx:104
    val compactMarkBoxWidth = 22.dp    // FillInPass.tsx:103
    val compactMarkBoxHeight = 16.dp   // FillInPass.tsx:103
    val continueMarkWidth = 26.dp      // ContinueLine.tsx:59
    val continueLineGap = 3.dp         // ContinueLine.tsx:66
    const val FOCUS_ROOM = 8.0         // StartFlow.tsx:307, room around a card scrolled into view
}

/**
 * app/globals.css:34: `tight` under 600 tall. The `short` rule (under 568, globals.css:29) and the step title's 36 row
 * (StartFlow.tsx:370) are Tokens.Native.shortScreenBelow and Tokens.Native.stepTitleRow, from plan A's native group.
 */
object Breakpoints {
    val tight = 600.dp
}
