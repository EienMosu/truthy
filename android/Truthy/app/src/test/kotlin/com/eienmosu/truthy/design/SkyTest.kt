package com.eienmosu.truthy.design

import org.junit.Assert.assertEquals
import org.junit.Test

class SkyTest {
    // SkyBackdrop.tsx: linear-gradient(180deg, sky-1 0%, sky-2 35%, sky-3 62%, sky-4 100%), from plan A's native group.
    @Test
    fun theGradientHasTheFourSmoothStops() {
        assertEquals(listOf(0f, 0.35f, 0.62f, 1f), Tokens.Native.skyStops)
    }

    // 412 wide is narrower than the 430 frame, so the frame is the viewport: the upper cloud 30 off the left edge at 196,
    // the lower one 40 off the right edge (170 wide, so it starts at 412 + 40 - 170).
    @Test
    fun theCloudsOfAPhoneSitInsideTheViewport() {
        assertEquals(CloudRect(-30f, 196f, 150f, 46f), SkyGeometry.upper(412f, 430f))
        assertEquals(CloudRect(282f, 620f, 170f, 50f), SkyGeometry.lower(412f, 430f, 620f))
    }

    // 600 wide: the 430 frame is centred, 85 from each side.
    @Test
    fun theCloudsOfAWideScreenSitInsideTheCentredFrame() {
        assertEquals(CloudRect(55f, 196f, 150f, 46f), SkyGeometry.upper(600f, 430f))
        assertEquals(CloudRect(385f, 620f, 170f, 50f), SkyGeometry.lower(600f, 430f, 620f))
    }

    @Test
    fun theStartFlowPutsTheLowerCloudLower() {
        assertEquals(620f, LowerCloud.GAME.top, 0f)
        assertEquals(660f, LowerCloud.START.top, 0f)
    }
}
