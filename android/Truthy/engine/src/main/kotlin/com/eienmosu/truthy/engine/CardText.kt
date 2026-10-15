package com.eienmosu.truthy.engine

// How card text marks code (src/content/text.ts). A statement or an explanation writes a code fragment between
// backticks, as Markdown does: the fragment is shown in the mono face, without its backticks. Overpass draws a
// backtick as an accent with no width over the next letter, so a backtick is never left in the sans face: one
// without a partner (or of an empty pair) is a code part of its own, shown as itself.

data class TextPart(
    val text: String,
    /** Shown in the mono face. */
    val code: Boolean,
)

// A pair of backticks around at least one character that is not a backtick (a line break counts as a character).
private val FRAGMENT = Regex("`([^`]+)`")

private fun plainParts(text: String): List<TextPart> {
    val parts = ArrayList<TextPart>()
    val run = StringBuilder()
    for (unit in text) {
        if (unit == '`') {
            if (run.isNotEmpty()) {
                parts.add(TextPart(run.toString(), false))
                run.setLength(0)
            }
            parts.add(TextPart("`", true))
        } else {
            run.append(unit)
        }
    }
    if (run.isNotEmpty()) parts.add(TextPart(run.toString(), false))
    return parts
}

/** The text in order as plain and code parts. No part is empty. */
fun textParts(text: String): List<TextPart> {
    val parts = ArrayList<TextPart>()
    var from = 0
    for (match in FRAGMENT.findAll(text)) {
        parts.addAll(plainParts(text.substring(from, match.range.first)))
        parts.add(TextPart(match.groupValues[1], true))
        from = match.range.last + 1
    }
    parts.addAll(plainParts(text.substring(from)))
    return parts
}

/** The text as it is shown, for what is read rather than seen (an announcement): code without its backticks. */
fun plainText(text: String): String = textParts(text).joinToString("") { it.text }
