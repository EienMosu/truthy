import Foundation

// The contrast pairs of the design system (tests/tokens/contrast.test.ts, spec 5.9), as data and WCAG 2.x arithmetic.

public enum ContrastKind: String, Codable, Sendable {
    case bodyText = "body text"
    case largeText = "large text"
    case nonText = "non-text"
}

public struct ContrastPair: Equatable, Sendable {
    public let foreground: String
    public let background: String
    public let kind: ContrastKind
    /// Where the screens use it (the web test's `where`).
    public let usedFor: String

    public init(foreground: String, background: String, kind: ContrastKind, usedFor: String) {
        self.foreground = foreground
        self.background = background
        self.kind = kind
        self.usedFor = usedFor
    }
}

private func pair(_ foreground: String, _ background: String, _ kind: ContrastKind, _ usedFor: String) -> ContrastPair {
    ContrastPair(foreground: foreground, background: background, kind: kind, usedFor: usedFor)
}

public let CONTRAST_PAIRS: [ContrastPair] = [
    pair("ink", "surface-raised", .bodyText, "ticket, cards, fill-in pass, Back pill"),
    pair("ink", "surface-sunk", .bodyText, "answer slip, missed-cards slip"),
    pair("ink-muted", "surface-raised", .bodyText, "field labels, leg names, card details"),
    pair("ink-muted", "surface-sunk", .bodyText, "missed-card heads, unavailable card"),
    pair("true", "surface-raised", .bodyText, "True hint"),
    pair("true", "surface-sunk", .bodyText, "source link, Why link"),
    pair("false", "surface-raised", .bodyText, "False hint"),
    pair("on-dark", "true", .bodyText, "True pill label"),
    pair("on-dark", "false", .bodyText, "False pill label"),
    pair("on-dark", "ink", .bodyText, "Next card, Play again, Start round"),
    pair("on-accent", "accent", .bodyText, "carrier band"),
    pair("ink", "sky-1", .bodyText, "start-flow tagline (decision: ink)"),
    pair("ink", "sky-2", .bodyText, "the tagline where it crosses into sky-2, step titles"),
    pair("ink", "sky-3", .bodyText, "the ready line (decision: ink)"),
    pair("ink", "sky-4", .bodyText, "continue line, quiet buttons"),
    pair("ink-muted", "sky-4", .bodyText, "continue line route"),
    pair("correct", "surface-sunk", .largeText, "Correct stamp on the slip, 24px ExtraBold"),
    pair("correct", "surface-raised", .largeText, "New best stamp, 22px ExtraBold"),
    pair("wrong", "surface-sunk", .largeText, "Not quite stamp, 24px ExtraBold"),
    pair("wrong", "surface-raised", .largeText, "Not quite stamp on the stub, 28px ExtraBold"),
    pair("false", "surface-raised", .largeText, "False intent stamp, 26px"),
    pair("focus", "sky-1", .nonText, "focus ring on the sky"),
    pair("focus", "sky-2", .nonText, "focus ring on the sky"),
    pair("focus", "sky-3", .nonText, "focus ring on the sky (filled pills)"),
    pair("focus", "sky-4", .nonText, "focus ring on the sky (filled pills)"),
    pair("focus", "surface-raised", .nonText, "focus ring inside the pass and the ticket"),
    pair("focus", "surface-sunk", .nonText, "focus ring on the slip"),
]

public func contrastMinimum(_ kind: ContrastKind) -> Double {
    kind == .bodyText ? 4.5 : 3
}

/// Relative luminance of an opaque "#rrggbb" colour (WCAG 2.x), or nil for anything else.
public func relativeLuminance(_ hex: String) -> Double? {
    let digits = Array(hex.utf8)
    guard digits.count == 7, digits[0] == UInt8(ascii: "#") else { return nil }
    var channels: [Double] = []
    for at in stride(from: 1, to: 7, by: 2) {
        guard let byte = UInt8(String(decoding: digits[at..<(at + 2)], as: UTF8.self), radix: 16) else { return nil }
        let c = Double(byte) / 255
        channels.append(c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4))
    }
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/// The contrast ratio of two opaque colours, or nil when either is not "#rrggbb".
public func contrastRatio(_ foregroundHex: String, _ backgroundHex: String) -> Double? {
    guard let a = relativeLuminance(foregroundHex), let b = relativeLuminance(backgroundHex) else { return nil }
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)
}
