// Where the round scrolls its ticket (components/play/ticketScroll.ts). Pure arithmetic over points.

public struct Span: Codable, Equatable, Sendable {
    public let top: Double
    public let bottom: Double

    public init(top: Double, bottom: Double) {
        self.top = top
        self.bottom = bottom
    }
}

public struct SlipScrollAt: Codable, Equatable, Sendable {
    public let top: Double
    public let visible: Double
    public let gap: Double
    public let max: Double

    public init(top: Double, visible: Double, gap: Double, max: Double) {
        self.top = top
        self.visible = visible
        self.gap = gap
        self.max = max
    }
}

public struct KeyScrollAt: Codable, Equatable, Sendable {
    public let top: Double
    public let visible: Double
    public let max: Double

    public init(top: Double, visible: Double, max: Double) {
        self.top = top
        self.visible = visible
        self.max = max
    }
}

/// A new card: the scroll that shows the statement above the action row; 0 when it fits.
public func statementScroll(_ text: Span, _ visible: Double) -> Double {
    jsMathMax(0, jsMathMin(text.bottom - visible, text.top))
}

/// After an answer: the scroll that brings the slip in, or nil when it is in view (it may end in the gap).
public func slipScroll(_ slip: Span, _ at: SlipScrollAt) -> Double? {
    if slip.top >= at.top && slip.bottom <= at.top + at.visible + at.gap { return nil }
    return jsMathMax(0, jsMathMin(at.max, slip.top))
}

/// One arrow press scrolls this far.
public let ARROW_STEP: Double = 40

/// Where a key that scrolls a page takes the ticket, or nil for any other key. The app ports no ticket scroll keys
/// (spec section 2); the function is ported for parity.
public func keyScroll(_ key: String, _ shift: Bool, _ at: KeyScrollAt) -> Double? {
    let page = jsMathMax(ARROW_STEP, at.visible - ARROW_STEP)
    let top: Double
    if key == " " {
        top = at.top + (shift ? -page : page)
    } else if shift {
        return nil
    } else {
        switch key {
        case "ArrowDown": top = at.top + ARROW_STEP
        case "ArrowUp": top = at.top - ARROW_STEP
        case "PageDown": top = at.top + page
        case "PageUp": top = at.top - page
        case "Home": top = 0
        case "End": top = at.max
        default: return nil
        }
    }
    return jsMathMax(0, jsMathMin(at.max, top))
}
