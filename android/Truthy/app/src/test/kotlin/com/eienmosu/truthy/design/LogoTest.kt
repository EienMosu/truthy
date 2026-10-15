package com.eienmosu.truthy.design

import com.eienmosu.truthy.engine.logoMarkHeight
import org.junit.Assert.assertEquals
import org.junit.Test

class LogoTest {
    // const TICKET = "..."; const TEAR = "..."; const CHECK = "..."; in components/Logo.tsx.
    private fun webConstant(name: String): String {
        val source = WebSource.read("components/Logo.tsx")
        val match = Regex("const $name =\\s*\"([^\"]*)\"").find(source)
        requireNotNull(match) { "const $name not found in components/Logo.tsx" }
        return match.groupValues[1]
    }

    @Test
    fun thePathDataIsTheWebsPathData() {
        assertEquals(webConstant("TICKET"), LogoPaths.TICKET)
        assertEquals(webConstant("TEAR"), LogoPaths.TEAR)
        assertEquals(webConstant("CHECK"), LogoPaths.CHECK)
    }

    @Test
    fun theMarkKeepsThe44By30Proportion() {
        assertEquals(44f, LogoPaths.WIDTH, 0.001f)
        assertEquals(30f, LogoPaths.HEIGHT, 0.001f)
        assertEquals(30.0, logoMarkHeight(44.0), 0.0001)
        assertEquals(17.73, logoMarkHeight(26.0), 0.0001)
        assertEquals(13.64, logoMarkHeight(20.0), 0.0001)
    }
}
