package com.eienmosu.truthy.ui

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

class DestinationStubTest {
    // A word the stub cannot break ("played" at a large font scale): the column takes the word's width and 4 on each
    // side, so the text wraps between words, never inside one; never narrower than the token (64 or 80).
    @Test fun theStubColumnTakesItsWidestWord() {
        assertEquals(80f, DestinationLayout.stubWidth(80.dp, 40.dp).value, 0f)
        assertEquals(80f, DestinationLayout.stubWidth(80.dp, 72.dp).value, 0f)
        assertEquals(92f, DestinationLayout.stubWidth(80.dp, 84.dp).value, 0f)
    }

    @Test fun theStubsWordsAreItsLabelValueAndUnitSplitAtSpaces() {
        assertEquals(listOf("Best", "–", "not", "played"), DestinationLayout.stubWords(CardStub("Best", "–", "not played")))
        assertEquals(listOf("Cards", "214"), DestinationLayout.stubWords(CardStub("Cards", "214")))
    }
}
