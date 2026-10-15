package com.eienmosu.truthy.start

import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.previousStep

/** The three layouts of the fill-in pass (FillInPass.tsx `PassStage`). */
enum class PassStage { DESTINATION, ROUTE, READY }

/** The start flow's copy, verbatim from reference 4.5 (StartFlow.tsx, FillInPass.tsx, ThemeSwitch.tsx, ContinueLine.tsx). */
object StartCopy {
    const val TAGLINE = "True or false cards that teach you IT, one swipe at a time."
    const val BACK = "Back"
    const val RECENT_NAME = "Recent"
    const val WHOLE_DECK_NAME = "Whole deck"
    const val START_ROUND = "Start round"
    const val READY_RULE = "Swipe right for true, left for false."
    const val LOADING_DECKS = "Loading the decks"
    const val SWITCH_TO_DARK = "Switch to dark theme"
    const val SWITCH_TO_LIGHT = "Switch to light theme"
    const val NOT_CHOSEN = "not chosen"
    const val BAND_TITLE = "Truthy"
    const val YOUR_PASS = "YOUR PASS"
    const val BOARDING_PASS = "BOARDING PASS"
    const val GATE_SHOWN = "F ← → T"
    const val GATE_SPOKEN = "False left, true right"
    const val LABEL_CLASS = "Class"
    const val LABEL_CARDS = "Cards"
    const val LABEL_GATE = "Gate"
    const val CARDS = "Cards"
    const val BEST = "Best"
    const val NO_BEST = "–"
    const val NOT_PLAYED = "not played"
    const val NOT_AVAILABLE = "Not available yet"
    const val ARROW = "→"
    const val SEPARATOR = " · "
    const val MIDDLE_DOT = "·"
    const val LAST = "last "
}

fun stepTitle(step: Step): String = when (step) {
    Step.ONE -> "Choose an area"
    Step.TWO -> "Choose a platform"
    Step.THREE -> "Choose a deck"
    Step.FOUR -> "Choose a section"
    Step.FIVE -> "Choose how to play"
    Step.SIX -> "Your pass is ready"
}

/** StartFlow.tsx:360 `BACK_TO`: what the Back pill of a step returns to, named after the step it goes back to. */
private fun backToWord(step: Step): String = when (step) {
    Step.ONE -> "areas"
    Step.TWO -> "platforms"
    Step.THREE -> "decks"
    Step.FOUR -> "sections"
    Step.FIVE, Step.SIX -> "classes"
}

/** "Back to platforms": the Back pill's label on `step` (StartFlow.tsx:786). */
fun backLabel(step: Step, hasSections: Boolean, recent: Boolean): String =
    "Back to ${backToWord(previousStep(step, hasSections, recent))}"

/** StartFlow.tsx:363-366: steps 1 to 3 choose the destination, 4 and 5 the route, 6 is ready. */
fun stageOf(step: Step): PassStage = when {
    step <= Step.THREE -> PassStage.DESTINATION
    step <= Step.FIVE -> PassStage.ROUTE
    else -> PassStage.READY
}

/** StartFlow.tsx:361 `NOW_FIELD`: the field each step fills, drawn in ink while it is chosen. */
fun nowField(step: Step): PassFieldName? = when (step) {
    Step.TWO -> PassFieldName.PLATFORM
    Step.THREE -> PassFieldName.DECK
    Step.FOUR -> PassFieldName.SECTION
    Step.FIVE -> PassFieldName.MODE
    Step.ONE, Step.SIX -> null
}

/** StartFlow.tsx:99 `STEP_OF_FIELD`: the step a field of the pass returns to. */
fun fieldStep(field: PassFieldName): Step = when (field) {
    PassFieldName.AREA -> Step.ONE
    PassFieldName.PLATFORM -> Step.TWO
    PassFieldName.DECK -> Step.THREE
    PassFieldName.SECTION -> Step.FOUR
    PassFieldName.MODE -> Step.FIVE
}

/** The field labels of the destination and route layouts (FillInPass.tsx:343-372). */
fun fieldLabel(field: PassFieldName): String = when (field) {
    PassFieldName.AREA -> "Area"
    PassFieldName.PLATFORM -> "Platform"
    PassFieldName.DECK -> "Deck"
    PassFieldName.SECTION -> "Section"
    PassFieldName.MODE -> "Class"
}

/** The line of step 6 (StartFlow.tsx:983-985). */
fun readyLine(description: String): String = "$description ${StartCopy.READY_RULE}"
