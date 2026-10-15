// The one table of classes (src/app-state/modes.ts): what the class step, the ticket, the continue line and the
// result say about each, and whether the class step offers it.

public struct ModeInfo: Codable, Equatable, Sendable {
    public let id: Mode
    public let name: String
    public let description: String
    public let unit: String
    public var offered: Bool

    public init(id: Mode, name: String, description: String, unit: String, offered: Bool) {
        self.id = id
        self.name = name
        self.description = description
        self.unit = unit
        self.offered = offered
    }
}

public let MODE_TABLE: [ModeInfo] = [
    ModeInfo(id: .classic, name: "Classic", description: "Correct answers out of 10 cards.", unit: "of 10", offered: true),
    ModeInfo(id: .streak, name: "Streak", description: "Correct answers in a row, until the first wrong one.", unit: "in a row", offered: true),
    ModeInfo(id: .lives, name: "Three lives", description: "Cards answered until the third wrong one.", unit: "cards", offered: true),
    ModeInfo(id: .timed, name: "Timed", description: "Correct answers in one minute, wrong ones cost nothing.", unit: "correct", offered: true),
]

/// The row of the class. The web throws for a class its table does not know; a Mode is always one of the four, and
/// every table (MODE_TABLE, or a vector's modeTable) has all four rows.
public func modeInfo(_ mode: Mode, _ table: [ModeInfo] = MODE_TABLE) -> ModeInfo {
    guard let row = table.first(where: { $0.id == mode }) else { preconditionFailure("Unknown mode \"\(mode.rawValue)\".") }
    return row
}

/// Whether the class step offers the class.
public func isOffered(_ mode: Mode, _ table: [ModeInfo] = MODE_TABLE) -> Bool {
    modeInfo(mode, table).offered
}

/// The score of a finished round as the continue line says it: "7 of 10", "13 in a row", "21 cards", "14 correct".
public func lastScoreText(_ mode: Mode, _ score: Int, _ total: Int) -> String {
    mode == .classic ? "\(score) of \(total)" : "\(score) \(modeInfo(mode).unit)"
}
