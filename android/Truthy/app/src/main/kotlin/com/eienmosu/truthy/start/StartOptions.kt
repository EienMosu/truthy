package com.eienmosu.truthy.start

import com.eienmosu.truthy.engine.DeckIndex
import com.eienmosu.truthy.engine.IndexArea
import com.eienmosu.truthy.engine.IndexDeck
import com.eienmosu.truthy.engine.IndexPlatform
import com.eienmosu.truthy.engine.MODE_TABLE
import com.eienmosu.truthy.engine.ModeInfo
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.Progress
import com.eienmosu.truthy.engine.RECENT
import com.eienmosu.truthy.engine.RecentDeck
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.StartChoice
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.WHOLE_DECK
import com.eienmosu.truthy.engine.bestFor
import com.eienmosu.truthy.engine.changeLabel
import com.eienmosu.truthy.engine.continueLabel
import com.eienmosu.truthy.engine.continueTarget
import com.eienmosu.truthy.engine.deckCount
import com.eienmosu.truthy.engine.deckPassName
import com.eienmosu.truthy.engine.decksLabel
import com.eienmosu.truthy.engine.lastScoreText
import com.eienmosu.truthy.engine.modeInfo
import com.eienmosu.truthy.engine.previousStep
import com.eienmosu.truthy.engine.seenPercent

/** What the start screen reads once the index is decoded: useCatalog's "ready" status (index, progress, card ids, recent decks). */
data class StartData(
    val index: DeckIndex,
    val progress: Progress,
    val cardIds: Map<String, List<String>>,
    val recent: List<RecentDeck>,
)

/** A step as it is drawn: its number and the choices it is drawn with. */
data class PanelSnapshot(val step: Step, val choice: StartChoice)

/** A section as the flow shows it; the whole deck is one too (StartFlow.tsx:137-146). */
data class SectionView(val id: String, val title: String, val cardCount: Int, val whole: Boolean)

/** The choices looked up in the index; a missing entry was not chosen or no longer exists (StartFlow.tsx:149-169). */
data class ResolvedChoice(
    val area: IndexArea?,
    val platform: IndexPlatform?,
    val deck: IndexDeck?,
    val section: SectionView?,
    val mode: ModeInfo?,
) {
    /** StartFlow.tsx:407: before a deck is chosen the path counts as having the section step. */
    val hasSections: Boolean get() = (deck?.sections?.size ?: 1) > 0
}

fun wholeDeck(deck: IndexDeck): SectionView = SectionView(WHOLE_DECK, StartCopy.WHOLE_DECK_NAME, deck.cardCount, whole = true)

fun resolveChoice(index: DeckIndex, choice: StartChoice, table: List<ModeInfo> = MODE_TABLE): ResolvedChoice {
    val area = index.areas.firstOrNull { it.id == choice.areaId }
    val platform = area?.platforms?.firstOrNull { it.id == choice.platformId }
    val deck = platform?.decks?.firstOrNull { it.id == choice.deckId }
    val section = when {
        deck == null -> null
        choice.sectionId == WHOLE_DECK -> wholeDeck(deck)
        else -> deck.sections.firstOrNull { it.id == choice.sectionId }?.let { SectionView(it.id, it.title, it.cardCount, whole = false) }
    }
    val mode = table.firstOrNull { it.id == choice.mode && it.offered }
    return ResolvedChoice(area, platform, deck, section, mode)
}

/** Where every one-step way back from `snapshot` goes (StartFlow.tsx:647). */
fun backTarget(index: DeckIndex, snapshot: PanelSnapshot): Step =
    previousStep(snapshot.step, resolveChoice(index, snapshot.choice).hasSections, snapshot.choice.via == RECENT)

// ---------- the pass ----------

data class PassDeck(val code: String, val name: String)
data class PassSection(val code: String, val name: String, val whole: Boolean)

/** FillInPass.tsx `FillInPassValues`, filled as StartFlow.tsx:745-752 does. */
data class PassValues(
    val area: String? = null,
    val platform: String? = null,
    val deck: PassDeck? = null,
    val section: PassSection? = null,
    val mode: String? = null,
    val cards: Int? = null,
)

fun passValues(resolved: ResolvedChoice): PassValues {
    val platform = resolved.platform
    val deck = resolved.deck
    return PassValues(
        area = resolved.area?.title,
        platform = platform?.title,
        deck = if (deck != null && platform != null) PassDeck(deck.code, deckPassName(platform, deck)) else null,
        section = resolved.section?.let { PassSection(it.id, it.title, it.whole) },
        mode = resolved.mode?.name,
        cards = resolved.section?.cardCount,
    )
}

fun filledFields(values: PassValues): Set<PassFieldName> = buildSet {
    if (values.area != null) add(PassFieldName.AREA)
    if (values.platform != null) add(PassFieldName.PLATFORM)
    if (values.deck != null) add(PassFieldName.DECK)
    if (values.section != null) add(PassFieldName.SECTION)
    if (values.mode != null) add(PassFieldName.MODE)
}

/** The fields filled on one side and blank on the other: their dashes leave (forward) or come back (back). */
fun changingFields(from: PassValues, to: PassValues): Set<PassFieldName> {
    val a = filledFields(from)
    val b = filledFields(to)
    return (a union b) - (a intersect b)
}

/** Whether a layout of the pass shows a field's value (FillInPass.tsx:334-376). */
fun stageShows(stage: PassStage, field: PassFieldName): Boolean = when (stage) {
    PassStage.DESTINATION -> field == PassFieldName.AREA || field == PassFieldName.PLATFORM || field == PassFieldName.DECK
    PassStage.ROUTE -> true
    PassStage.READY -> field == PassFieldName.DECK || field == PassFieldName.SECTION || field == PassFieldName.MODE
}

/** A field of the destination or route grid, or a word of the route pass's quiet line. `wayBack` is its accessible name when it returns to its step. */
data class PassField(val field: PassFieldName, val label: String, val value: String?, val code: Boolean, val now: Boolean, val wayBack: String?)

/** A leg of the ready pass: code over name (FillInPass.tsx:239-267). */
data class PassLeg(val field: PassFieldName, val code: String, val name: String, val wayBack: String?)

sealed interface PassBlock {
    val stage: PassStage
}

data class DestinationBlock(val fields: List<PassField>) : PassBlock {
    override val stage: PassStage get() = PassStage.DESTINATION
}

data class RouteBlock(val area: PassField?, val platform: PassField?, val fields: List<PassField>) : PassBlock {
    override val stage: PassStage get() = PassStage.ROUTE
}

data class ReadyBlock(val deck: PassLeg, val section: PassLeg, val mode: String, val modeWayBack: String?, val cards: String) : PassBlock {
    override val stage: PassStage get() = PassStage.READY
}

/** FillInPass.tsx:173-209: a filled field that is not being chosen now is a way back, unless it cannot be chosen. */
private fun gridField(field: PassFieldName, value: String?, code: Boolean, now: PassFieldName?, choosable: Boolean = true): PassField =
    PassField(
        field = field,
        label = fieldLabel(field),
        value = value,
        code = code,
        now = now == field,
        wayBack = if (value != null && now != field && choosable) changeLabel(field, value) else null,
    )

/** FillInPass.tsx:218-236: the quiet line's words are always ways back. */
private fun lineWord(field: PassFieldName, value: String?): PassField? =
    value?.let { PassField(field, fieldLabel(field), it, code = false, now = false, wayBack = changeLabel(field, it)) }

fun passBlock(stage: PassStage, values: PassValues, now: PassFieldName?, sectionChoosable: Boolean): PassBlock = when (stage) {
    PassStage.DESTINATION -> DestinationBlock(
        listOf(
            gridField(PassFieldName.AREA, values.area, code = false, now = now),
            gridField(PassFieldName.PLATFORM, values.platform, code = false, now = now),
            gridField(PassFieldName.DECK, values.deck?.code, code = true, now = now),
        ),
    )
    PassStage.ROUTE -> {
        val section = values.section
        RouteBlock(
            area = lineWord(PassFieldName.AREA, values.area),
            platform = lineWord(PassFieldName.PLATFORM, values.platform),
            fields = listOf(
                gridField(PassFieldName.DECK, values.deck?.code, code = true, now = now),
                gridField(
                    PassFieldName.SECTION,
                    section?.let { if (it.whole) it.name else it.code },
                    code = section != null && !section.whole,
                    now = now,
                    choosable = sectionChoosable,
                ),
                gridField(PassFieldName.MODE, values.mode, code = false, now = now),
            ),
        )
    }
    PassStage.READY -> {
        val deckCode = values.deck?.code ?: ""
        val sectionCode = values.section?.code ?: ""
        val sectionName = values.section?.name ?: ""
        ReadyBlock(
            deck = PassLeg(PassFieldName.DECK, deckCode, values.deck?.name ?: "", changeLabel(PassFieldName.DECK, deckCode)),
            section = PassLeg(
                PassFieldName.SECTION,
                sectionCode,
                sectionName,
                if (sectionChoosable) changeLabel(PassFieldName.SECTION, if (sectionCode == WHOLE_DECK) sectionName else sectionCode) else null,
            ),
            mode = values.mode ?: "",
            modeWayBack = values.mode?.let { changeLabel(PassFieldName.MODE, it) },
            cards = values.cards?.toString() ?: "",
        )
    }
}

// ---------- the options of each step ----------

enum class OptionKind { PLACE, DECK, SECTION, CLASS }

/** What a card's stub shows: "Cards / 214" or "Best / 9 / of 10" (DestinationCard.tsx `CardStub`). */
data class StubText(val label: String, val value: String, val unit: String? = null, val muted: Boolean = false)

/** Where choosing an option leads: the step, the choices with it, and the field its name travels into (none for Recent). */
data class Forward(val step: Step, val choice: StartChoice, val field: PassFieldName?)

/** One card of a step's list (StartFlow.tsx:876-1026). */
data class OptionModel(
    val id: String,
    val kind: OptionKind,
    val name: String,
    val label: String,
    val code: Boolean = false,
    val sub: String? = null,
    val detail: String? = null,
    val seenPercent: Int? = null,
    val stub: StubText? = null,
    val unavailable: Boolean = false,
    val recent: Boolean = false,
    val forward: Forward? = null,
)

fun stepOptions(data: StartData, snapshot: PanelSnapshot, table: List<ModeInfo> = MODE_TABLE): List<OptionModel> {
    val choice = snapshot.choice
    val resolved = resolveChoice(data.index, choice, table)
    return when (snapshot.step) {
        Step.ONE -> {
            val areas = data.index.areas.map { area ->
                placeOption(area.id, area.title, deckCount(area), Forward(Step.TWO, StartChoice(areaId = area.id), PassFieldName.AREA))
            }
            if (data.recent.size < 2) areas else listOf(recentOption(data.recent)) + areas
        }
        Step.TWO -> (resolved.area?.platforms ?: emptyList()).map { platform ->
            placeOption(platform.id, platform.title, deckCount(platform), Forward(Step.THREE, choice.copy(platformId = platform.id), PassFieldName.PLATFORM))
        }
        Step.THREE ->
            if (choice.via == RECENT) {
                data.recent.map { played -> deckOption(data, played.deck, StartChoice(via = RECENT, areaId = played.area.id, platformId = played.platform.id)) }
            } else {
                (resolved.platform?.decks ?: emptyList()).map { deckOption(data, it, choice) }
            }
        Step.FOUR -> {
            val deck = resolved.deck
            if (deck == null) {
                emptyList()
            } else {
                (listOf(wholeDeck(deck)) + deck.sections.map { SectionView(it.id, it.title, it.cardCount, whole = false) })
                    .map { sectionOption(deck, it, choice) }
            }
        }
        Step.FIVE -> table.map { classOption(data, it, choice) }
        Step.SIX -> emptyList()
    }
}

/** How many items of a step move in one after the other: its title, then its options. Placeholders and the ready line are not items (StartFlow.tsx:1097-1118). */
fun itemCount(data: StartData?, snapshot: PanelSnapshot): Int = when {
    snapshot.step == Step.SIX || data == null -> 1
    else -> 1 + stepOptions(data, snapshot).size
}

private fun placeOption(id: String, title: String, count: Int, forward: Forward): OptionModel {
    val available = count > 0
    return OptionModel(
        id = id,
        kind = OptionKind.PLACE,
        name = title,
        sub = decksLabel(count),
        label = if (available) "$title, ${decksLabel(count)}" else "$title, no decks yet",
        unavailable = !available,
        forward = if (available) forward else null,
    )
}

private fun recentOption(recent: List<RecentDeck>): OptionModel = OptionModel(
    id = RECENT,
    kind = OptionKind.PLACE,
    name = StartCopy.RECENT_NAME,
    sub = recent.joinToString(StartCopy.SEPARATOR) { it.deck.code },
    label = "${StartCopy.RECENT_NAME}, ${decksLabel(recent.size)}",
    recent = true,
    forward = Forward(Step.THREE, StartChoice(via = RECENT), null),
)

private fun deckOption(data: StartData, deck: IndexDeck, base: StartChoice): OptionModel {
    val seen = seenPercent(data.progress, deck, data.cardIds[deck.id])
    val forward = if (deck.sections.isNotEmpty()) {
        Forward(Step.FOUR, base.copy(deckId = deck.id), PassFieldName.DECK)
    } else {
        Forward(Step.FIVE, base.copy(deckId = deck.id, sectionId = WHOLE_DECK), PassFieldName.DECK)
    }
    return OptionModel(
        id = deck.id,
        kind = OptionKind.DECK,
        name = deck.code,
        code = true,
        detail = deck.title,
        seenPercent = seen,
        stub = StubText(StartCopy.CARDS, deck.cardCount.toString()),
        label = "${deck.code}, ${deck.title}, ${deck.cardCount} cards, ${if (seen > 0) "$seen percent seen" else "not started"}",
        forward = forward,
    )
}

private fun sectionOption(deck: IndexDeck, section: SectionView, choice: StartChoice): OptionModel = OptionModel(
    id = section.id,
    kind = OptionKind.SECTION,
    name = if (section.whole) StartCopy.WHOLE_DECK_NAME else section.id,
    code = !section.whole,
    detail = if (section.whole) "All ${deck.sections.size} sections" else section.title,
    stub = StubText(StartCopy.CARDS, section.cardCount.toString()),
    label = if (section.whole) {
        "Whole deck, all ${deck.sections.size} sections, ${section.cardCount} cards"
    } else {
        "${section.id}, ${section.title}, ${section.cardCount} cards"
    },
    forward = Forward(Step.FIVE, choice.copy(sectionId = section.id), PassFieldName.SECTION),
)

private fun classOption(data: StartData, mode: ModeInfo, choice: StartChoice): OptionModel {
    val deckId = choice.deckId
    val sectionId = choice.sectionId
    val best = if (mode.offered && deckId != null && sectionId != null) bestFor(data.progress, Route(deckId, sectionId), mode.id) else null
    return OptionModel(
        id = mode.id.wire,
        kind = OptionKind.CLASS,
        name = mode.name,
        detail = mode.description,
        sub = if (mode.offered) null else StartCopy.NOT_AVAILABLE,
        unavailable = !mode.offered,
        stub = if (best == null) {
            StubText(StartCopy.BEST, StartCopy.NO_BEST, StartCopy.NOT_PLAYED, muted = true)
        } else {
            StubText(StartCopy.BEST, best.toString(), mode.unit)
        },
        label = when {
            !mode.offered -> "${mode.name}, not available yet"
            best == null -> "${mode.name}. ${mode.description} Not played yet."
            else -> "${mode.name}. ${mode.description} Your best: $best ${mode.unit}."
        },
        forward = if (mode.offered) Forward(Step.SIX, choice.copy(mode = mode.id), PassFieldName.MODE) else null,
    )
}

// ---------- the continue line ----------

/** What the continue line shows and says (StartFlow.tsx:841-849, ContinueLine.tsx). `choice` is the full pass it fills. */
data class ContinueModel(
    val deckCode: String,
    val deckName: String,
    val sectionCode: String,
    val sectionTitle: String,
    val modeLabel: String,
    val lastScore: String?,
    val label: String,
    val choice: StartChoice,
)

fun continueModel(data: StartData, table: List<ModeInfo> = MODE_TABLE): ContinueModel? {
    val target = continueTarget(data.index, data.progress, table) ?: return null
    val found = target.found
    val deckName = deckPassName(found.platform, found.deck)
    val sectionTitle = found.section?.title ?: StartCopy.WHOLE_DECK_NAME
    val modeLabel = modeInfo(target.mode, table).name
    val lastScore = target.lastScore?.let { lastScoreText(target.mode, it.score, it.total) }
    return ContinueModel(
        deckCode = found.deck.code,
        deckName = deckName,
        sectionCode = found.section?.id ?: WHOLE_DECK,
        sectionTitle = sectionTitle,
        modeLabel = modeLabel,
        lastScore = lastScore,
        label = continueLabel(deckName, sectionTitle, modeLabel, lastScore),
        choice = StartChoice(
            areaId = found.area.id,
            platformId = found.platform.id,
            deckId = found.deck.id,
            sectionId = target.route.sectionId,
            mode = target.mode,
        ),
    )
}
