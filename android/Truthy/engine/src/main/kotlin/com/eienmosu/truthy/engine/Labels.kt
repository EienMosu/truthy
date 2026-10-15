package com.eienmosu.truthy.engine

// The accessible names of the pass fields and the continue line (components/FillInPass.tsx and
// components/start/ContinueLine.tsx). Both read as the web words them; reference 4.5 lists the copy.

/** The five fields of the fill-in pass, with the word the "Change" label uses for each. */
enum class PassFieldName(val wire: String, val changeWord: String) {
    AREA("area", "area"),
    PLATFORM("platform", "platform"),
    DECK("deck", "deck"),
    SECTION("section", "section"),
    MODE("mode", "class"),
}

/** "Change deck, now CLF": the accessible name of a field that returns to its step. */
fun changeLabel(field: PassFieldName, value: String): String = "Change ${field.changeWord}, now $value"

/**
 * "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.", or, when the deck cannot
 * be played now, "Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection." An empty
 * last score counts as none. The app plays embedded decks and never passes `needsConnection`; it is here because the
 * vectors pin the sentence.
 */
fun continueLabel(
    deckName: String,
    sectionTitle: String,
    modeLabel: String,
    lastScore: String? = null,
    needsConnection: Boolean = false,
): String {
    if (needsConnection) return "Continue: ${deckName}, ${sectionTitle}, ${modeLabel}, needs a connection."
    val score = if (lastScore.isNullOrEmpty()) "" else " Last score ${lastScore}."
    return "Continue: ${deckName}, ${sectionTitle}, ${modeLabel}.${score}"
}
