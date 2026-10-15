package com.eienmosu.truthy.design

import androidx.compose.ui.graphics.vector.PathNode
import androidx.compose.ui.graphics.vector.PathParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class IconPathsTest {
    // ICON_PATHS of components/icons.tsx: name: "path data", in the web's order.
    private fun webPaths(): Map<String, String> {
        val source = WebSource.read("components/icons.tsx")
        val block = Regex("ICON_PATHS = \\{(.*?)\\} as const;", RegexOption.DOT_MATCHES_ALL).find(source)
        requireNotNull(block) { "ICON_PATHS not found in components/icons.tsx" }
        return Regex("(\\w+):\\s*\"([^\"]*)\"")
            .findAll(block.groupValues[1])
            .associate { it.groupValues[1] to it.groupValues[2] }
    }

    @Test
    fun thePathDataIsTheWebsPathDataUnchanged() {
        assertEquals(webPaths(), IconPaths.BY_WEB_NAME)
    }

    @Test
    fun thereAreNineteenEntriesInTheWebsOrder() {
        assertEquals(19, IconPaths.BY_WEB_NAME.size)
        assertEquals(webPaths().keys.toList(), IconPaths.BY_WEB_NAME.keys.toList())
    }

    @Test
    fun everyPathParsesAndStartsWithAMoveTo() {
        for ((name, data) in IconPaths.BY_WEB_NAME) {
            val nodes = PathParser().parsePathString(data).toNodes()
            assertTrue("$name parses to nodes", nodes.isNotEmpty())
            assertTrue("$name starts with M", nodes.first() is PathNode.MoveTo)
        }
    }

    @Test
    fun numbersAreWrittenShortAndWithADot() {
        assertEquals("358", pathNumber(358f))
        assertEquals("16.5", pathNumber(16.5f))
        assertEquals("5.7", pathNumber(5.7000003f))
        assertEquals("0", pathNumber(0.0004f))
        assertEquals("-0.4", pathNumber(-0.4f))
        assertEquals("-12", pathNumber(-12f))
    }
}
