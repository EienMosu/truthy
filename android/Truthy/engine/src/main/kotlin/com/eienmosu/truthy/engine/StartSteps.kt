package com.eienmosu.truthy.engine

// The steps and the choices of the start flow, as pure functions (components/start/StartFlow.tsx, "the steps and
// the choices"). Step 1 is the area (or Recent), 2 the platform, 3 the deck, 4 the section, 5 the class, 6 the ready
// pass. The history entries of the web (entriesBehind and the like) have no native counterpart and are not ported.

enum class Step(val number: Int) {
    ONE(1),
    TWO(2),
    THREE(3),
    FOUR(4),
    FIVE(5),
    SIX(6),
    ;

    companion object {
        fun of(number: Int): Step =
            Step.entries.firstOrNull { it.number == number } ?: throw IllegalArgumentException("There is no step $number.")
    }
}

/** The Recent card's choice on step 1: the deck step then lists the decks played last (the recent path). */
const val RECENT = "recent"

/** The fields of a choice, with the names the vectors use. */
enum class ChoiceKey(val wire: String) {
    VIA("via"),
    AREA_ID("areaId"),
    PLATFORM_ID("platformId"),
    DECK_ID("deckId"),
    SECTION_ID("sectionId"),
    MODE("mode"),
}

/** What the player has chosen so far, as ids. `sectionId` is a section id or WHOLE_DECK. */
data class StartChoice(
    /** RECENT on the recent path: step 1 chose "Recent", and the deck step fills area, platform and deck at once. */
    val via: String? = null,
    val areaId: String? = null,
    val platformId: String? = null,
    val deckId: String? = null,
    val sectionId: String? = null,
    val mode: Mode? = null,
)

/** The step on which each choice is made on the ordinary path. */
val STEP_OF: Map<ChoiceKey, Step> =
    mapOf(
        ChoiceKey.VIA to Step.ONE,
        ChoiceKey.AREA_ID to Step.ONE,
        ChoiceKey.PLATFORM_ID to Step.TWO,
        ChoiceKey.DECK_ID to Step.THREE,
        ChoiceKey.SECTION_ID to Step.FOUR,
        ChoiceKey.MODE to Step.FIVE,
    )

/** The step on which `key` is chosen in `choice`: on the recent path the area and the platform come with the deck. */
fun stepOf(key: ChoiceKey, choice: StartChoice): Step =
    if (choice.via == RECENT && (key == ChoiceKey.AREA_ID || key == ChoiceKey.PLATFORM_ID)) Step.THREE else STEP_OF.getValue(key)

/** Keeps only the choices made before `step`: going back to a step clears it and everything after it. */
fun clearFrom(choice: StartChoice, step: Step): StartChoice {
    fun before(key: ChoiceKey): Boolean = stepOf(key, choice) < step
    return StartChoice(
        via = choice.via.takeIf { before(ChoiceKey.VIA) },
        areaId = choice.areaId.takeIf { before(ChoiceKey.AREA_ID) },
        platformId = choice.platformId.takeIf { before(ChoiceKey.PLATFORM_ID) },
        deckId = choice.deckId.takeIf { before(ChoiceKey.DECK_ID) },
        sectionId = choice.sectionId.takeIf { before(ChoiceKey.SECTION_ID) },
        mode = choice.mode.takeIf { before(ChoiceKey.MODE) },
    )
}

/**
 * The steps a player passes through up to `step`. A deck without sections has no step 4; the recent path has no
 * step 2.
 */
fun pathTo(step: Step, hasSections: Boolean, recent: Boolean = false): List<Step> {
    val all = if (hasSections) listOf(Step.ONE, Step.TWO, Step.THREE, Step.FOUR, Step.FIVE, Step.SIX) else listOf(Step.ONE, Step.TWO, Step.THREE, Step.FIVE, Step.SIX)
    return all.filter { it <= step && !(recent && it == Step.TWO) }
}

/**
 * Where Back goes from `step`: one step back on its path, so from the class step of a deck without sections to the
 * deck step.
 */
fun previousStep(step: Step, hasSections: Boolean, recent: Boolean = false): Step {
    val path = pathTo(step, hasSections, recent)
    return path.getOrNull(path.size - 2) ?: Step.ONE
}

/** The id of the card chosen on `target` in `choice`; on step 1 of the recent path, the Recent card (RECENT). */
fun chosenOn(target: Step, choice: StartChoice): String? {
    if (target == Step.ONE && choice.via == RECENT) return RECENT
    return when (target) {
        Step.ONE -> choice.areaId
        Step.TWO -> choice.platformId
        Step.THREE -> choice.deckId
        Step.FOUR -> choice.sectionId
        Step.FIVE -> choice.mode?.wire
        Step.SIX -> null
    }
}

/**
 * True when every choice needed to show `step` exists in the index (a remembered choice may not). The area is looked
 * up in the index, the platform only inside that area, the deck only inside that platform, the section as WHOLE_DECK
 * or an existing section of that deck, and the class only when `table` offers it.
 */
fun canShow(index: DeckIndex, step: Step, choice: StartChoice, table: List<ModeInfo> = MODE_TABLE): Boolean {
    val area = index.areas.firstOrNull { it.id == choice.areaId }
    val platform = area?.platforms?.firstOrNull { it.id == choice.platformId }
    val deck = platform?.decks?.firstOrNull { it.id == choice.deckId }
    val hasSection = deck != null && (choice.sectionId == WHOLE_DECK || deck.sections.any { it.id == choice.sectionId })
    val hasMode = table.any { it.id == choice.mode && it.offered }
    val recent = choice.via == RECENT
    if (recent && step == Step.TWO) return false // the recent path has no platform step
    // The recent decks' step needs no area or platform: each of its decks brings its own.
    val placed = !(recent && step == Step.THREE)
    if (step >= Step.TWO && placed && area == null) return false
    if (step >= Step.THREE && placed && platform == null) return false
    if (step >= Step.FOUR && deck == null) return false
    if (step == Step.FOUR && deck != null && deck.sections.isEmpty()) return false
    if (step >= Step.FIVE && !hasSection) return false
    if (step >= Step.SIX && !hasMode) return false
    return true
}
