package com.eienmosu.truthy

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** OFL 1.1 travels with the fonts (reference 5.2): the same text as the web's app/fonts/OFL.txt. */
class LicenseTest {
    @Test
    fun oflTextIsTheWebCopy() {
        val shipped = RepoFiles.main.resolve("assets/licenses/OFL.txt")
        assertTrue("missing assets/licenses/OFL.txt", shipped.isFile)
        assertArrayEquals(RepoFiles.root.resolve("app/fonts/OFL.txt").readBytes(), shipped.readBytes())
    }
}
