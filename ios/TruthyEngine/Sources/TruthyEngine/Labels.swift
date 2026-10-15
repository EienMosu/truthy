// Two accessible names of the start flow: a pass field's way back (components/FillInPass.tsx) and the continue line
// (components/start/ContinueLine.tsx).

public enum PassFieldName: String, Codable, CaseIterable, Sendable {
    case area, platform, deck, section, mode
}

/// "Change deck, now CLF". The class field says "class".
public func changeLabel(_ field: PassFieldName, _ value: String) -> String {
    let word = field == .mode ? "class" : field.rawValue
    return "Change \(word), now \(value)"
}

public struct ContinueLabelProps: Equatable, Sendable {
    public var deckName: String
    public var sectionTitle: String
    public var modeLabel: String
    /// Already worded ("7 of 10"); nil or empty when the last round was left before its end.
    public var lastScore: String?
    /// The web's offline line; the embedded decks never need a connection, so the app passes false.
    public var needsConnection: Bool

    public init(deckName: String, sectionTitle: String, modeLabel: String, lastScore: String? = nil, needsConnection: Bool = false) {
        self.deckName = deckName
        self.sectionTitle = sectionTitle
        self.modeLabel = modeLabel
        self.lastScore = lastScore
        self.needsConnection = needsConnection
    }
}

/// "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10."
public func continueLabel(_ props: ContinueLabelProps) -> String {
    if props.needsConnection {
        return "Continue: \(props.deckName), \(props.sectionTitle), \(props.modeLabel), needs a connection."
    }
    let score = props.lastScore.map { $0.isEmpty ? "" : " Last score \($0)." } ?? ""
    return "Continue: \(props.deckName), \(props.sectionTitle), \(props.modeLabel).\(score)"
}
