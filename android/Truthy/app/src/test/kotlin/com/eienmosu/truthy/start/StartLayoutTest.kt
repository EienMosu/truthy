package com.eienmosu.truthy.start

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

class StartLayoutTest {
    // StartFlow.tsx:772 and 1059: the ready title sits 176 + 20 + 112 below the top zone's top on the web, whatever the
    // pass reaching past the 176 zone. The Android zone grows with the pass, so the offset shrinks by what it grew.
    @Test fun theReadyTitleKeepsTheWebsLineWhileThePassReachesPastTheZone() {
        assertEquals(112f, StartLayout.readyTop(112.dp, 176.dp).value, 0.001f)
        assertEquals(29.6f, StartLayout.readyTop(112.dp, 258.4.dp).value, 0.001f)
        assertEquals(176f + 112f, 258.4f + StartLayout.readyTop(112.dp, 258.4.dp).value, 0.001f)
        assertEquals(5.6f, StartLayout.readyTop(88.dp, 258.4.dp).value, 0.001f)
    }

    // At a large font scale the pass is taller than 176 + 112: the title follows it, never over it.
    @Test fun aPassTallerThanTheOffsetPushesTheTitleDown() {
        assertEquals(0f, StartLayout.readyTop(112.dp, 400.dp).value, 0f)
    }

    // StartFlow.tsx:826: the list stops 76 above the bottom while the continue line shows, 12 above its 60 pill.
    @Test fun theListStopsTwelveAboveTheContinueLine() {
        assertEquals(76f, StartLayout.continueGap(0.dp).value, 0f)
        assertEquals(76f, StartLayout.continueGap(60.dp).value, 0f)
        assertEquals(206f, StartLayout.continueGap(190.dp).value, 0f)
    }

    // StartFlow.tsx:1069-1086: the ready line is the list's content, under its margin 8 and padding 6.
    @Test fun theReadyLineSitsFourteenUnderTheTitleRow() {
        assertEquals(14f, StartLayout.readyLineTop.value, 0f)
    }
}
