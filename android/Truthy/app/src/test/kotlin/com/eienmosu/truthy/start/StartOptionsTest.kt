package com.eienmosu.truthy.start

import com.eienmosu.truthy.engine.CardHistory
import com.eienmosu.truthy.engine.LastRound
import com.eienmosu.truthy.engine.Mode
import com.eienmosu.truthy.engine.PassFieldName
import com.eienmosu.truthy.engine.RECENT
import com.eienmosu.truthy.engine.Route
import com.eienmosu.truthy.engine.StartChoice
import com.eienmosu.truthy.engine.Step
import com.eienmosu.truthy.engine.WHOLE_DECK
import com.eienmosu.truthy.start.StartFixtures.INDEX
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StartOptionsTest {
    private fun labels(options: List<OptionModel>) = options.map { it.label }
    private val step1 = PanelSnapshot(Step.ONE, StartChoice())

    @Test
    fun stepTitlesAndBackLabelsAreTheWebsCopy() {
        assertEquals(
            listOf("Choose an area", "Choose a platform", "Choose a deck", "Choose a section", "Choose how to play", "Your pass is ready"),
            Step.entries.map { stepTitle(it) },
        )
        assertEquals("Back to areas", backLabel(Step.TWO, hasSections = true, recent = false))
        assertEquals("Back to areas", backLabel(Step.THREE, hasSections = true, recent = true))
        assertEquals("Back to decks", backLabel(Step.FOUR, hasSections = true, recent = true))
        assertEquals("Back to decks", backLabel(Step.FIVE, hasSections = false, recent = false))
        assertEquals("Back to sections", backLabel(Step.FIVE, hasSections = true, recent = false))
        assertEquals("Back to classes", backLabel(Step.SIX, hasSections = true, recent = false))
    }

    @Test
    fun eachStepHasItsPassStageAndItsFieldBeingChosen() {
        assertEquals(
            listOf(PassStage.DESTINATION, PassStage.DESTINATION, PassStage.DESTINATION, PassStage.ROUTE, PassStage.ROUTE, PassStage.READY),
            Step.entries.map { stageOf(it) },
        )
        assertEquals(
            listOf(null, PassFieldName.PLATFORM, PassFieldName.DECK, PassFieldName.SECTION, PassFieldName.MODE, null),
            Step.entries.map { nowField(it) },
        )
        assertEquals(listOf(Step.ONE, Step.TWO, Step.THREE, Step.FOUR, Step.FIVE), PassFieldName.entries.map { fieldStep(it) })
        assertEquals(Step.TWO, backTarget(INDEX, PanelSnapshot(Step.THREE, StartChoice(areaId = "cloud", platformId = "aws"))))
        assertEquals(Step.ONE, backTarget(INDEX, PanelSnapshot(Step.THREE, StartChoice(via = RECENT))))
        assertEquals(Step.THREE, backTarget(INDEX, PanelSnapshot(Step.FIVE, StartChoice(areaId = "cloud", platformId = "gcp", deckId = "gcp-cdl", sectionId = WHOLE_DECK))))
    }

    @Test
    fun step1ListsTheAreasWithTheirDeckCounts() {
        val options = stepOptions(StartFixtures.data(), step1)
        assertEquals(listOf("Cloud, 2 decks", "Frontend, 1 deck", "DevOps, no decks yet"), labels(options))
        assertEquals(listOf("2 decks", "1 deck", "No decks yet"), options.map { it.sub })
        assertEquals(listOf(false, false, true), options.map { it.unavailable })
        assertEquals(listOf(OptionKind.PLACE, OptionKind.PLACE, OptionKind.PLACE), options.map { it.kind })
        assertEquals(Forward(Step.TWO, StartChoice(areaId = "cloud"), PassFieldName.AREA), options[0].forward)
        assertNull(options[2].forward)
    }

    @Test
    fun recentComesFirstOnlyWithTwoOrMoreDecksPlayed() {
        assertEquals(3, stepOptions(StartFixtures.data(recent = StartFixtures.RECENT_TWO.take(1)), step1).size)
        val options = stepOptions(StartFixtures.data(recent = StartFixtures.RECENT_TWO), step1)
        val recent = options.first()
        assertEquals(RECENT, recent.id)
        assertEquals("Recent", recent.name)
        assertEquals("CLF · CDL", recent.sub)
        assertTrue(recent.recent)
        assertEquals(Forward(Step.THREE, StartChoice(via = RECENT), null), recent.forward)
        assertEquals(listOf("Recent, 2 decks", "Cloud, 2 decks", "Frontend, 1 deck", "DevOps, no decks yet"), labels(options))
    }

    @Test
    fun step2ListsThePlatformsOfTheChosenArea() {
        val options = stepOptions(StartFixtures.data(), PanelSnapshot(Step.TWO, StartChoice(areaId = "cloud")))
        assertEquals(listOf("AWS, 1 deck", "Google Cloud, 1 deck", "Azure, no decks yet"), labels(options))
        assertEquals(Forward(Step.THREE, StartChoice(areaId = "cloud", platformId = "aws"), PassFieldName.PLATFORM), options[0].forward)
    }

    @Test
    fun deckCardsShowTheShareSeenAndLeadToTheirNextStep() {
        val ids = (0 until 92).map { "aws-clf-c02-t1-$it" }
        val cards = ids.take(23).associateWith { CardHistory(seen = 1, lastCorrect = true, lastSeenAt = 1.0) }
        val data = StartFixtures.data(progress = StartFixtures.progressOf(cards = cards), cardIds = mapOf("aws-clf-c02" to ids))
        val clf = stepOptions(data, PanelSnapshot(Step.THREE, StartChoice(areaId = "cloud", platformId = "aws"))).single()
        assertEquals("CLF, Cloud Practitioner, 92 cards, 25 percent seen", clf.label)
        assertEquals(OptionKind.DECK, clf.kind)
        assertEquals("CLF", clf.name)
        assertTrue(clf.code)
        assertEquals("Cloud Practitioner", clf.detail)
        assertEquals(25, clf.seenPercent)
        assertEquals(StubText("Cards", "92"), clf.stub)
        assertEquals(Forward(Step.FOUR, StartChoice(areaId = "cloud", platformId = "aws", deckId = "aws-clf-c02"), PassFieldName.DECK), clf.forward)
        val cdl = stepOptions(StartFixtures.data(), PanelSnapshot(Step.THREE, StartChoice(areaId = "cloud", platformId = "gcp"))).single()
        assertEquals("CDL, Cloud Digital Leader, 133 cards, not started", cdl.label)
        assertEquals(
            Forward(Step.FIVE, StartChoice(areaId = "cloud", platformId = "gcp", deckId = "gcp-cdl", sectionId = WHOLE_DECK), PassFieldName.DECK),
            cdl.forward,
        )
    }

    @Test
    fun theRecentDecksBringTheirAreaAndPlatformWithThem() {
        val options = stepOptions(StartFixtures.data(recent = StartFixtures.RECENT_TWO), PanelSnapshot(Step.THREE, StartChoice(via = RECENT)))
        assertEquals(listOf("aws-clf-c02", "gcp-cdl"), options.map { it.id })
        assertEquals(
            Forward(Step.FOUR, StartChoice(via = RECENT, areaId = "cloud", platformId = "aws", deckId = "aws-clf-c02"), PassFieldName.DECK),
            options[0].forward,
        )
        assertEquals(
            Forward(Step.FIVE, StartChoice(via = RECENT, areaId = "cloud", platformId = "gcp", deckId = "gcp-cdl", sectionId = WHOLE_DECK), PassFieldName.DECK),
            options[1].forward,
        )
    }

    @Test
    fun step4StartsWithTheWholeDeck() {
        val choice = StartChoice(areaId = "cloud", platformId = "aws", deckId = "aws-clf-c02")
        val options = stepOptions(StartFixtures.data(), PanelSnapshot(Step.FOUR, choice))
        assertEquals(
            listOf("Whole deck, all 2 sections, 92 cards", "CON, Cloud concepts, 45 cards", "SEC, Security and compliance, 47 cards"),
            labels(options),
        )
        assertEquals(listOf(WHOLE_DECK, "CON", "SEC"), options.map { it.id })
        assertEquals(listOf("Whole deck", "CON", "SEC"), options.map { it.name })
        assertEquals(listOf(false, true, true), options.map { it.code })
        assertEquals(listOf("All 2 sections", "Cloud concepts", "Security and compliance"), options.map { it.detail })
        assertEquals(StubText("Cards", "45"), options[1].stub)
        assertEquals(Forward(Step.FIVE, choice.copy(sectionId = "SEC"), PassFieldName.SECTION), options[2].forward)
    }

    @Test
    fun step5ShowsEachClassWithItsBestOnTheRoute() {
        val records = mapOf("aws-clf-c02/SEC#classic" to 9, "aws-clf-c02/SEC#streak" to 12, "aws-clf-c02/SEC#lives" to 21, "aws-clf-c02/CON#timed" to 30)
        val choice = StartChoice(areaId = "cloud", platformId = "aws", deckId = "aws-clf-c02", sectionId = "SEC")
        val options = stepOptions(StartFixtures.data(progress = StartFixtures.progressOf(records = records)), PanelSnapshot(Step.FIVE, choice))
        assertEquals(
            listOf(
                "Classic. Correct answers out of 10 cards. Your best: 9 of 10.",
                "Streak. Correct answers in a row, until the first wrong one. Your best: 12 in a row.",
                "Three lives. Cards answered until the third wrong one. Your best: 21 cards.",
                "Timed. Correct answers in one minute, wrong ones cost nothing. Not played yet.",
            ),
            labels(options),
        )
        assertEquals(listOf("classic", "streak", "lives", "timed"), options.map { it.id })
        assertEquals(OptionKind.CLASS, options[0].kind)
        assertEquals("Correct answers out of 10 cards.", options[0].detail)
        assertEquals(StubText("Best", "9", "of 10"), options[0].stub)
        assertEquals(StubText("Best", "–", "not played", muted = true), options[3].stub)
        assertEquals(Forward(Step.SIX, choice.copy(mode = Mode.TIMED), PassFieldName.MODE), options[3].forward)
    }

    @Test
    fun thePassShowsEachStagesFieldsAndWaysBack() {
        val route = StartChoice(areaId = "cloud", platformId = "aws", deckId = "aws-clf-c02", sectionId = "SEC")
        val values = passValues(resolveChoice(INDEX, route))
        assertEquals(
            PassValues(
                area = "Cloud", platform = "AWS", deck = PassDeck("CLF", "AWS Cloud Practitioner"),
                section = PassSection("SEC", "Security and compliance", whole = false), mode = null, cards = 47,
            ),
            values,
        )
        val destination = passBlock(PassStage.DESTINATION, passValues(resolveChoice(INDEX, StartChoice(areaId = "cloud"))), PassFieldName.PLATFORM, sectionChoosable = true) as DestinationBlock
        assertEquals(listOf("Area", "Platform", "Deck"), destination.fields.map { it.label })
        assertEquals(listOf("Cloud", null, null), destination.fields.map { it.value })
        assertEquals(listOf("Change area, now Cloud", null, null), destination.fields.map { it.wayBack })
        assertEquals(listOf(false, true, false), destination.fields.map { it.now })
        val routeBlock = passBlock(PassStage.ROUTE, values, PassFieldName.MODE, sectionChoosable = true) as RouteBlock
        assertEquals("Change area, now Cloud", routeBlock.area?.wayBack)
        assertEquals("Change platform, now AWS", routeBlock.platform?.wayBack)
        assertEquals(listOf("Deck", "Section", "Class"), routeBlock.fields.map { it.label })
        assertEquals(listOf("CLF", "SEC", null), routeBlock.fields.map { it.value })
        assertEquals(listOf(true, true, false), routeBlock.fields.map { it.code })
        assertEquals(listOf("Change deck, now CLF", "Change section, now SEC", null), routeBlock.fields.map { it.wayBack })
        assertEquals(setOf(PassFieldName.AREA, PassFieldName.PLATFORM, PassFieldName.DECK, PassFieldName.SECTION), filledFields(values))
        assertEquals(setOf(PassFieldName.DECK, PassFieldName.SECTION), changingFields(passValues(resolveChoice(INDEX, StartChoice(areaId = "cloud", platformId = "aws"))), values))
        assertTrue(stageShows(PassStage.ROUTE, PassFieldName.AREA))
        assertFalse(stageShows(PassStage.READY, PassFieldName.PLATFORM))
        assertFalse(stageShows(PassStage.DESTINATION, PassFieldName.SECTION))
    }

    @Test
    fun aWholeDeckIsWrittenInWordsAndIsNoWayBackWithoutSections() {
        val cdl = passValues(
            resolveChoice(INDEX, StartChoice(areaId = "cloud", platformId = "gcp", deckId = "gcp-cdl", sectionId = WHOLE_DECK, mode = Mode.CLASSIC)),
        )
        val route = passBlock(PassStage.ROUTE, cdl, PassFieldName.MODE, sectionChoosable = false) as RouteBlock
        assertEquals("Whole deck", route.fields[1].value)
        assertFalse(route.fields[1].code)
        assertNull(route.fields[1].wayBack)
        val ready = passBlock(PassStage.READY, cdl, null, sectionChoosable = false) as ReadyBlock
        assertEquals(PassLeg(PassFieldName.DECK, "CDL", "Google Cloud Digital Leader", "Change deck, now CDL"), ready.deck)
        assertEquals(PassLeg(PassFieldName.SECTION, "ALL", "Whole deck", null), ready.section)
        assertEquals("Classic", ready.mode)
        assertEquals("Change class, now Classic", ready.modeWayBack)
        assertEquals("133", ready.cards)
        val choosable = passBlock(PassStage.READY, cdl, null, sectionChoosable = true) as ReadyBlock
        assertEquals("Change section, now Whole deck", choosable.section.wayBack)
    }

    @Test
    fun theContinueLineNamesTheLastRouteAndItsScore() {
        val last = LastRound(route = Route(deckId = "aws-clf-c02", sectionId = "SEC"), mode = Mode.CLASSIC, score = 7, total = 10)
        val line = continueModel(StartFixtures.data(progress = StartFixtures.progressOf(last = last)))
        assertNotNull(line)
        line!!
        assertEquals("CLF", line.deckCode)
        assertEquals("AWS Cloud Practitioner", line.deckName)
        assertEquals("SEC", line.sectionCode)
        assertEquals("Classic", line.modeLabel)
        assertEquals("7 of 10", line.lastScore)
        assertEquals("Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10.", line.label)
        assertEquals(StartChoice(areaId = "cloud", platformId = "aws", deckId = "aws-clf-c02", sectionId = "SEC", mode = Mode.CLASSIC), line.choice)
        val left = continueModel(
            StartFixtures.data(progress = StartFixtures.progressOf(last = LastRound(Route("gcp-cdl", WHOLE_DECK), Mode.STREAK, null, null))),
        )!!
        assertEquals("ALL", left.sectionCode)
        assertEquals("Whole deck", left.sectionTitle)
        assertNull(left.lastScore)
        assertEquals("Continue: Google Cloud Digital Leader, Whole deck, Streak.", left.label)
        assertNull(continueModel(StartFixtures.data()))
        assertNull(continueModel(StartFixtures.data(progress = StartFixtures.progressOf(last = LastRound(Route("gone", WHOLE_DECK), Mode.CLASSIC, 1, 10)))))
    }

    @Test
    fun theReadyLineAndTheItemCounts() {
        assertEquals("Correct answers out of 10 cards. Swipe right for true, left for false.", readyLine("Correct answers out of 10 cards."))
        assertEquals(4, itemCount(StartFixtures.data(), step1))
        assertEquals(1, itemCount(null, step1))
        assertEquals(1, itemCount(StartFixtures.data(), PanelSnapshot(Step.SIX, StartChoice(mode = Mode.CLASSIC))))
    }
}
