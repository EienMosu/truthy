package com.eienmosu.truthy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The adaptive icon is the web's installed icon (spec 5.6, App icon): the app/icon.svg ticket at 60 percent of the
 *  visible square, centred, on day sky-1. */
class LauncherIconTest {
    private val svgPaths = RepoFiles.xml(RepoFiles.root.resolve("app/icon.svg")).elements("path")
    private val foreground = RepoFiles.resource("drawable/ic_launcher_foreground.xml")
    private val group = foreground.elements("group").single()
    private val paths = foreground.elements("path")

    @Test
    fun adaptiveIconHasTheSkyBackgroundAndTheMarkOnly() {
        val icon = RepoFiles.resource("mipmap-anydpi/ic_launcher.xml").documentElement
        assertEquals("adaptive-icon", icon.tagName)
        val layers = icon.childElements()
        assertEquals(listOf("background", "foreground"), layers.map { it.tagName })
        assertEquals("@color/truthy_icon_background", layers[0].android("drawable"))
        assertEquals("@drawable/ic_launcher_foreground", layers[1].android("drawable"))
    }

    @Test
    fun iconBackgroundIsDaySkyOneInEveryTheme() {
        assertEquals(
            RepoFiles.tokenColor("color.day.sky-1"),
            RepoFiles.resource("values/colors.xml").value("color", "truthy_icon_background").lowercase(),
        )
        val night = RepoFiles.resource("values-night/colors.xml").elements("color")
        assertTrue(night.none { it.getAttribute("name") == "truthy_icon_background" })
    }

    @Test
    fun markIsSixtyPercentOfTheVisibleSquareAndCentred() {
        val root = foreground.documentElement
        assertEquals("108dp", root.android("width"))
        assertEquals("108dp", root.android("height"))
        assertEquals("108", root.android("viewportWidth"))
        assertEquals("108", root.android("viewportHeight"))
        assertEquals(group.android("scaleX"), group.android("scaleY"))
        val scale = group.android("scaleX").toDouble()
        // The ticket path of app/icon.svg spans x 0 to 44 and y 0 to 30. An adaptive icon shows the centre 72 of 108.
        val ticketWidth = 44.0
        val ticketHeight = 30.0
        assertEquals(0.6 * 72.0, ticketWidth * scale, 1e-4)
        assertEquals(54.0, group.android("translateX").toDouble() + scale * ticketWidth / 2, 1e-4)
        assertEquals(54.0, group.android("translateY").toDouble() + scale * ticketHeight / 2, 1e-4)
    }

    @Test
    fun pathsAreTheWebMark() {
        assertEquals(3, svgPaths.size)
        assertEquals(3, paths.size)
        assertEquals("M33 5v2.5M33 10.5v2.5M33 16v2.5M33 21.5v2.5", dashed("M33 5v20", "2.5 3"))
        assertEquals(svgPaths[0].getAttribute("d"), paths[0].android("pathData"))
        assertEquals(
            dashed(svgPaths[1].getAttribute("d"), svgPaths[1].getAttribute("stroke-dasharray")),
            paths[1].android("pathData"),
        )
        assertEquals(svgPaths[2].getAttribute("d"), paths[2].android("pathData"))
    }

    @Test
    fun coloursAndStrokesMatchTheWebMark() {
        assertEquals(RepoFiles.tokenColor("color.day.accent"), paths[0].android("fillColor").lowercase())
        assertEquals(svgPaths[0].getAttribute("fill").lowercase(), paths[0].android("fillColor").lowercase())
        assertEquals("", paths[0].android("strokeColor"))
        for (i in 1..2) {
            assertEquals(RepoFiles.tokenColor("color.day.on-accent"), paths[i].android("strokeColor").lowercase())
            assertEquals(svgPaths[i].getAttribute("stroke").lowercase(), paths[i].android("strokeColor").lowercase())
            assertEquals(svgPaths[i].getAttribute("stroke-width"), paths[i].android("strokeWidth"))
            assertEquals(svgPaths[i].getAttribute("stroke-linecap"), paths[i].android("strokeLineCap"))
            assertEquals("", paths[i].android("fillColor"))
        }
        assertEquals("", paths[1].android("strokeLineJoin"))
        assertEquals(svgPaths[2].getAttribute("stroke-linejoin"), paths[2].android("strokeLineJoin"))
    }

    /** The segments an SVG dash pattern draws along a vertical line "Mx yvLength", starting with a dash. */
    private fun dashed(d: String, dashArray: String): String {
        val match = Regex("""M(\S+) (\S+)v(\S+)""").matchEntire(d) ?: error("not a vertical line: $d")
        val (x, y, length) = match.destructured.toList().map(String::toDouble)
        val (dash, gap) = dashArray.split(' ').map(String::toDouble)
        return buildString {
            var at = 0.0
            while (at < length) {
                append("M${number(x)} ${number(y + at)}v${number(minOf(dash, length - at))}")
                at += dash + gap
            }
        }
    }

    private fun number(value: Double): String =
        if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()
}
