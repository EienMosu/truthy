import SwiftUI
import TruthyEngine

// What each start step lists (reference 4.1 and 4.5): its title and its cards, built from the index, the progress
// and the choices. A pure description, so the back motion can draw the step being left and the step coming back at
// once.

struct StepOption: Identifiable {
    let id: String
    let card: DestinationCard
}

@MainActor
struct StepContent {
    let flow: StartFlowModel
    let app: AppModel
    let step: Step
    let choose: (StepChoice) -> Void

    enum StepChoice {
        case area(String), recent, platform(String), deck(String), recentDeck(RecentDeck), section(String), mode(Mode)
    }

    static let titles: [Step: String] = [
        1: "Choose an area", 2: "Choose a platform", 3: "Choose a deck", 4: "Choose a section", 5: "Choose how to play",
        6: "Your pass is ready",
    ]
    static let backTo: [Step: String] = [1: "areas", 2: "platforms", 3: "decks", 4: "sections", 5: "classes"]

    var title: String { Self.titles[step] ?? "" }

    var options: [StepOption] {
        switch step {
        case 1: areaOptions
        case 2: platformOptions
        case 3: flow.recent ? recentOptions : deckOptions
        case 4: sectionOptions
        case 5: classOptions
        default: []
        }
    }

    private var areaOptions: [StepOption] {
        var options: [StepOption] = []
        if app.recent.count >= 2 {
            options.append(StepOption(id: RECENT, card: DestinationCard(
                variant: .place, name: "Recent", sub: app.recent.map(\.deck.code).joined(separator: " · "),
                label: "Recent, \(decksLabel(app.recent.count))") { choose(.recent) }))
        }
        for area in flow.index.areas {
            let count = deckCount(area)
            options.append(StepOption(id: area.id, card: DestinationCard(
                variant: .place, name: area.title, sub: decksLabel(count), enabled: count > 0,
                label: count > 0 ? "\(area.title), \(decksLabel(count))" : "\(area.title), no decks yet") { choose(.area(area.id)) }))
        }
        return options
    }

    private var platformOptions: [StepOption] {
        (flow.area?.platforms ?? []).map { platform in
            let count = deckCount(platform)
            return StepOption(id: platform.id, card: DestinationCard(
                variant: .place, name: platform.title, sub: decksLabel(count), enabled: count > 0,
                label: count > 0 ? "\(platform.title), \(decksLabel(count))" : "\(platform.title), no decks yet") { choose(.platform(platform.id)) })
        }
    }

    private func deckCard(_ deck: IndexDeck, _ action: @escaping () -> Void) -> DestinationCard {
        let percent = seenPercent(app.progress, (id: deck.id, cardCount: deck.cardCount))
        let label = percent == 0
            ? "\(deck.code), \(deck.title), \(deck.cardCount) cards, not started"
            : "\(deck.code), \(deck.title), \(deck.cardCount) cards, \(percent) percent seen"
        return DestinationCard(variant: .deck, name: deck.code, nameStyle: .code, detail: deck.title, seenPercent: percent, stubLabel: "Cards",
                               stubValue: "\(deck.cardCount)", label: label, action: action)
    }

    private var deckOptions: [StepOption] {
        (flow.platform?.decks ?? []).map { deck in StepOption(id: deck.id, card: deckCard(deck) { choose(.deck(deck.id)) }) }
    }

    private var recentOptions: [StepOption] {
        app.recent.map { recent in StepOption(id: recent.deck.id, card: deckCard(recent.deck) { choose(.recentDeck(recent)) }) }
    }

    private var sectionOptions: [StepOption] {
        guard let deck = flow.deck else { return [] }
        let whole = StepOption(id: WHOLE_DECK, card: DestinationCard(
            variant: .section, name: "Whole deck", detail: "All \(deck.sections.count) sections", stubLabel: "Cards", stubValue: "\(deck.cardCount)",
            label: "Whole deck, all \(deck.sections.count) sections, \(deck.cardCount) cards") { choose(.section(WHOLE_DECK)) })
        return [whole] + deck.sections.map { section in
            StepOption(id: section.id, card: DestinationCard(
                variant: .section, name: section.id, nameStyle: .code, detail: section.title, stubLabel: "Cards", stubValue: "\(section.cardCount)",
                label: "\(section.id), \(section.title), \(section.cardCount) cards") { choose(.section(section.id)) })
        }
    }

    private var classOptions: [StepOption] {
        guard let route = flow.choice.deckId.flatMap({ deckId in flow.choice.sectionId.map { Route(deckId: deckId, sectionId: $0) } }) else { return [] }
        return MODE_TABLE.map { row in
            let best = bestFor(app.progress, route, row.id)
            if !row.offered {
                return StepOption(id: row.id.rawValue, card: DestinationCard(
                    variant: .mode, name: row.name, sub: "Not available yet", detail: row.description, enabled: false,
                    label: "\(row.name), not available yet") {})
            }
            let label = best.map { "\(row.name). \(row.description) Your best: \($0) \(row.unit)." } ?? "\(row.name). \(row.description) Not played yet."
            return StepOption(id: row.id.rawValue, card: DestinationCard(
                variant: .mode, name: row.name, detail: row.description, detailMuted: true, stubLabel: "Best", stubValue: best.map(String.init) ?? "–",
                stubUnit: best == nil ? "not played" : row.unit, stubValueMuted: best == nil, label: label) { choose(.mode(row.id)) })
        }
    }
}
