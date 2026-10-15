package com.eienmosu.truthy.round

import org.junit.Assert.assertEquals
import org.junit.Test

class SourceLinkLabelTest {
    @Test
    fun theSpokenLabelSaysTheLinkOpensInTheBrowser() {
        assertEquals("AWS Pricing • Billing (opens in browser)", sourceLinkLabel("AWS Pricing • Billing"))
    }
}
