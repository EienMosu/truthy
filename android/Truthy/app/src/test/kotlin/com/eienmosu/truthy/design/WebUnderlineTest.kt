package com.eienmosu.truthy.design

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * The underline of "Why" and the source links is the web's own (WebUnderline): every <u> of the web app carries the
 * same thickness and offset, and no text of the app draws the font's underline (TextDecoration.Underline) instead.
 */
class WebUnderlineTest {
    private fun px(value: Float): String = if (value % 1f == 0f) value.toInt().toString() else value.toString()

    @Test fun theConstantsAreTheWebsUnderlineClasses() {
        val underlines = listOf("components/BoardingPass.tsx", "components/MissedCards.tsx").flatMap { file ->
            Regex("""<u className="([^"]*)"""").findAll(WebSource.read(file)).map { file to it.groupValues[1] }.toList()
        }
        assertEquals("the web's <u> elements: $underlines", 3, underlines.size)
        for ((file, classes) in underlines) {
            assertTrue("$file: $classes", classes.split(' ').contains("decoration-[${px(WebUnderline.THICKNESS_DP)}px]"))
            assertTrue("$file: $classes", classes.split(' ').contains("underline-offset-[${px(WebUnderline.OFFSET_DP)}px]"))
        }
    }

    @Test fun noTextOfTheAppDrawsTheFontsUnderline() {
        val root = File(requireNotNull(System.getProperty("truthy.repo")), "android/Truthy/app/src/main")
        val users = root.walkTopDown().filter { it.isFile && it.extension == "kt" && it.readText().contains("TextDecoration.Underline") }.toList()
        assertEquals("these draw the font's underline: $users", emptyList<File>(), users)
    }
}
