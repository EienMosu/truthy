package com.eienmosu.truthy.support

import com.eienmosu.truthy.engine.Route

/** One way through the start flow, as the accessible names of the options to choose (reference 4.5). */
data class RoutePick(val area: Regex, val platform: Regex, val deck: Regex, val section: Regex?, val mode: Regex)

// Patterns where a count changes with the content, so the tests keep passing when the decks grow (as e2e/helpers.ts).
val CLF_SECURITY = RoutePick(
    area = Regex("Cloud, \\d+ decks?"),
    platform = Regex("AWS, \\d+ decks?"),
    deck = Regex("CLF, Cloud Practitioner, \\d+ cards, .*"),
    section = Regex("SEC, Security and compliance, \\d+ cards"),
    mode = Regex("Classic\\. Correct answers out of 10 cards\\. .*"),
)

/** The same route in another class: "Streak", "Three lives" or "Timed". */
fun RoutePick.inClass(name: String): RoutePick = copy(mode = Regex(Regex.escape(name) + "\\. .*"))

/** The whole CDL deck (it has no sections), Classic: the second deck of the review's returning player. */
val CDL_WHOLE = RoutePick(
    area = Regex("Cloud, \\d+ decks?"),
    platform = Regex("Google Cloud, \\d+ decks?"),
    deck = Regex("CDL, Cloud Digital Leader, \\d+ cards, .*"),
    section = null,
    mode = Regex("Classic\\. Correct answers out of 10 cards\\. .*"),
)

const val CLF_ID = "aws-clf-c02"
const val CDL_ID = "gcp-cdl"
val CLF_SEC_ROUTE = Route(CLF_ID, "SEC")

/** The Continue line after a round on CLF / SEC / Classic; a score adds " Last score {x}." */
const val CONTINUE_CLF_SECURITY = "Continue: AWS Cloud Practitioner, Security and compliance, Classic."

/** The round's heading: "{deckName}, {sectionName}: {class} round". */
fun roundHeading(className: String) = "AWS Cloud Practitioner, Security and compliance: $className round"
