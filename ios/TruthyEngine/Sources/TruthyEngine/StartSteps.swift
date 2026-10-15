// The steps and the choices of the start flow (components/start/StartFlow.tsx:72-185), pure.

/// A start step, 1 to 6: area, platform, deck, section, class, ready.
public typealias Step = Int

/// The Recent card's choice on step 1: the deck step then lists the decks played last (the recent path).
public let RECENT = "recent"

public enum ChoiceKey: String, CaseIterable, Codable, Sendable {
    case via, areaId, platformId, deckId, sectionId, mode
}

/// What the player has chosen so far, as ids. sectionId is a section id or WHOLE_DECK.
public struct Choice: Codable, Hashable, Sendable {
    public var via: String?
    public var areaId: String?
    public var platformId: String?
    public var deckId: String?
    public var sectionId: String?
    public var mode: Mode?

    public init(via: String? = nil, areaId: String? = nil, platformId: String? = nil, deckId: String? = nil, sectionId: String? = nil, mode: Mode? = nil) {
        self.via = via
        self.areaId = areaId
        self.platformId = platformId
        self.deckId = deckId
        self.sectionId = sectionId
        self.mode = mode
    }

    /// The choice of a key as its id; the class as its raw value.
    public subscript(key: ChoiceKey) -> String? {
        switch key {
        case .via: via
        case .areaId: areaId
        case .platformId: platformId
        case .deckId: deckId
        case .sectionId: sectionId
        case .mode: mode?.rawValue
        }
    }

    fileprivate mutating func copy(_ key: ChoiceKey, from other: Choice) {
        switch key {
        case .via: via = other.via
        case .areaId: areaId = other.areaId
        case .platformId: platformId = other.platformId
        case .deckId: deckId = other.deckId
        case .sectionId: sectionId = other.sectionId
        case .mode: mode = other.mode
        }
    }
}

/// The step on which each choice is made on the ordinary path.
public let STEP_OF: [ChoiceKey: Step] = [.via: 1, .areaId: 1, .platformId: 2, .deckId: 3, .sectionId: 4, .mode: 5]

/// The step on which `key` is chosen: on the recent path the area and the platform come with the deck.
public func stepOf(_ key: ChoiceKey, _ choice: Choice) -> Step {
    if choice.via == RECENT && (key == .areaId || key == .platformId) { return 3 }
    return STEP_OF[key] ?? 1
}

/// Keeps only the choices made before `step`: going back to a step clears it and everything after it.
public func clearFrom(_ choice: Choice, _ step: Step) -> Choice {
    var kept = Choice()
    for key in ChoiceKey.allCases where stepOf(key, choice) < step && choice[key] != nil {
        kept.copy(key, from: choice)
    }
    return kept
}

/// The steps a player passes through up to `step`. A deck without sections has no step 4; the recent path no step 2.
public func pathTo(_ step: Step, _ hasSections: Bool, _ recent: Bool = false) -> [Step] {
    let all: [Step] = hasSections ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 5, 6]
    return all.filter { $0 <= step && !(recent && $0 == 2) }
}

/// Where Back goes from `step`: one step back on its path.
public func previousStep(_ step: Step, _ hasSections: Bool, _ recent: Bool = false) -> Step {
    let path = pathTo(step, hasSections, recent)
    return path.count >= 2 ? path[path.count - 2] : 1
}

/// The id of the card chosen on `target`; on step 1 of the recent path the Recent card (RECENT).
public func chosenOn(_ target: Step, _ choice: Choice) -> String? {
    if target == 1 && choice.via == RECENT { return RECENT }
    switch target {
    case 1: return choice.areaId
    case 2: return choice.platformId
    case 3: return choice.deckId
    case 4: return choice.sectionId
    case 5: return choice.mode?.rawValue
    default: return nil
    }
}

/// The choices looked up in the index (StartFlow.tsx: resolve). A missing entry was not chosen or no longer exists.
private struct Resolved {
    var area: IndexArea?
    var platform: IndexPlatform?
    var deck: IndexDeck?
    var hasSection = false
    var mode: ModeInfo?
}

private func resolve(_ index: DeckIndex, _ choice: Choice, _ table: [ModeInfo]) -> Resolved {
    var r = Resolved()
    r.area = choice.areaId.flatMap { id in index.areas.first { $0.id == id } }
    r.platform = choice.platformId.flatMap { id in r.area?.platforms.first { $0.id == id } }
    r.deck = choice.deckId.flatMap { id in r.platform?.decks.first { $0.id == id } }
    if let deck = r.deck, let sectionId = choice.sectionId {
        r.hasSection = sectionId == WHOLE_DECK || deck.sections.contains { $0.id == sectionId }
    }
    r.mode = choice.mode.flatMap { mode in table.first { $0.id == mode && $0.offered } }
    return r
}

/// True when every choice needed to show `step` exists in the index (a remembered step may be stale).
public func canShow(_ index: DeckIndex, _ step: Step, _ choice: Choice, _ table: [ModeInfo] = MODE_TABLE) -> Bool {
    let r = resolve(index, choice, table)
    let recent = choice.via == RECENT
    if recent && step == 2 { return false }
    let placed = !(recent && step == 3)
    if step >= 2 && placed && r.area == nil { return false }
    if step >= 3 && placed && r.platform == nil { return false }
    if step >= 4 && r.deck == nil { return false }
    if step == 4, let deck = r.deck, deck.sections.isEmpty { return false }
    if step >= 5 && !r.hasSection { return false }
    if step >= 6 && r.mode == nil { return false }
    return true
}
