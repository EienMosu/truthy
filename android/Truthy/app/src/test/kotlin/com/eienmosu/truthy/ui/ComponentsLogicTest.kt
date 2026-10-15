package com.eienmosu.truthy.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ComponentsLogicTest {
    // components/easing.ts: STAMP_LANDING = opacity 0, scale 1.9, rotate -14; STAMP_REST = opacity 1, scale 1, rotate -6.
    @Test
    fun aStampLandsFromBigAndInvisible() {
        val frame = StampLanding.at(0f)
        assertEquals(1.9f, frame.scale, 1e-4f)
        assertEquals(-14f, frame.rotation, 1e-4f)
        assertEquals(0f, frame.alpha, 1e-4f)
    }

    @Test
    fun aStampRestsTurnedMinusSix() {
        val frame = StampLanding.at(1f)
        assertEquals(1f, frame.scale, 1e-4f)
        assertEquals(-6f, frame.rotation, 1e-4f)
        assertEquals(1f, frame.alpha, 1e-4f)
    }

    // The spring-ease curve overshoots to about 1.098 of the way: the stamp dips below its rest size, and the opacity stays 1.
    @Test
    fun theOvershootKeepsTheOpacityAtOneAndDipsBelowRestSize() {
        val frame = StampLanding.at(1.098f)
        assertEquals(1f, frame.alpha, 1e-4f)
        assertTrue(frame.scale < 1f)
        assertTrue(frame.rotation > -6f)
    }

    // Reference 4.5: stamps say Correct, Not quite or New best (screen readers: "Correct. New best"); Timed stub stamps
    // say Correct, Not quite or Time is up.
    @Test
    fun stampWordsAndNamesAreTheReferenceCopy() {
        assertEquals("Correct", StampText.word(StampVerdict.CORRECT))
        assertEquals("Not quite", StampText.word(StampVerdict.WRONG))
        assertEquals("New best", StampText.word(StampVerdict.NEW_BEST))
        assertEquals("Correct", StampText.description(StampVerdict.CORRECT))
        assertEquals("Not quite", StampText.description(StampVerdict.WRONG))
        assertEquals("Correct. New best", StampText.description(StampVerdict.NEW_BEST))
        assertEquals("Correct", StampText.stubWord(StubStampKind.CORRECT))
        assertEquals("Not quite", StampText.stubWord(StubStampKind.WRONG))
        assertEquals("Time is up", StampText.stubWord(StubStampKind.TIME_UP))
        assertEquals("True", StampText.intentWord(IntentKind.TRUE))
        assertEquals("False", StampText.intentWord(IntentKind.FALSE))
    }

    // DestinationCard.tsx: the seen part of the 56 wide track is percent% of it.
    @Test
    fun theSeenPartOfTheTrackIsThePercentOfItsWidth() {
        assertEquals(21.28f, TrackGeometry.seenWidth(38, 56f), 1e-3f)
        assertEquals(0f, TrackGeometry.seenWidth(0, 56f), 0f)
        assertEquals(56f, TrackGeometry.seenWidth(100, 56f), 1e-3f)
    }

    // DestinationCard.tsx STUB_WIDTH, MIN_HEIGHT and MAIN_PADDING (reference 5.4): stubs 64 and 80, minimum heights 104, 128,
    // 90 and 108, gaps and paddings 4/18, 2/18, 2/14 and 4/16.
    @Test
    fun eachVariantHasTheWebsStubMinimumHeightAndSpacing() {
        fun check(variant: DestinationVariant, stub: Float, min: Float, gap: Float, vertical: Float) {
            val metrics = DestinationLayout.of(variant)
            assertEquals("$variant stub", stub, metrics.stubWidth.value, 0f)
            assertEquals("$variant min", min, metrics.minHeight.value, 0f)
            assertEquals("$variant gap", gap, metrics.gap.value, 0f)
            assertEquals("$variant vertical", vertical, metrics.vertical.value, 0f)
        }
        check(DestinationVariant.PLACE, 64f, 104f, 4f, 18f)
        check(DestinationVariant.DECK, 80f, 128f, 2f, 18f)
        check(DestinationVariant.SECTION, 80f, 90f, 2f, 14f)
        check(DestinationVariant.CLASS, 80f, 108f, 4f, 16f)
    }
}
