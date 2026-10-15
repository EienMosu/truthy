// What the ticket shows about the route (components/play/useRound.ts: ticketFor).

public struct TicketInfo: Equatable, Sendable {
    public let deckCode: String
    public let deckName: String
    public let sectionCode: String
    public let sectionName: String
    public let modeLabel: String
    public let best: Int?

    public init(deckCode: String, deckName: String, sectionCode: String, sectionName: String, modeLabel: String, best: Int?) {
        self.deckCode = deckCode
        self.deckName = deckName
        self.sectionCode = sectionCode
        self.sectionName = sectionName
        self.modeLabel = modeLabel
        self.best = best
    }
}

public func ticketFor(_ found: RouteInIndex, _ mode: Mode, _ best: Int?) -> TicketInfo {
    TicketInfo(
        deckCode: found.deck.code, deckName: deckPassName(found.platform, found.deck), sectionCode: found.section?.id ?? WHOLE_DECK,
        sectionName: found.section?.title ?? "Whole deck", modeLabel: modeInfo(mode).name, best: best)
}
