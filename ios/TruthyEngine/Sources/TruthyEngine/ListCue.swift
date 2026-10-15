// The cue that a step's list goes on below the fold (components/start/listCue.ts): the list's bottom edge fades over
// 28 points while more content lies below, and the fade ends over a card, never over sky.

/// The length of the fade, as at the bottom of the missed-cards list.
public let FADE_PX: Double = 28

/// A card of the list, from the top of the list's view.
public struct ItemSpan: Codable, Equatable, Sendable {
    public let top: Double
    public let bottom: Double

    public init(top: Double, bottom: Double) {
        self.top = top
        self.bottom = bottom
    }
}

public struct ListCue: Equatable, Sendable {
    /// Content runs on below the view.
    public let more: Bool
    /// How far above the bottom of the view the fade ends (0: at the edge).
    public let lift: Double

    public init(more: Bool, lift: Double) {
        self.more = more
        self.lift = lift
    }
}

private func maxZero(_ x: Double) -> Double {
    x > 0 ? x : 0
}

/// The cue for a view `viewHeight` tall whose content ends at `contentBottom` and whose cards are `items`.
public func listCue(_ viewHeight: Double, _ contentBottom: Double, _ items: [ItemSpan]) -> ListCue {
    if contentBottom <= viewHeight + 1 { return ListCue(more: false, lift: 0) }
    guard let at = items.firstIndex(where: { $0.bottom > viewHeight + 1 }) else { return ListCue(more: true, lift: 0) }
    let cut = items[at]
    let above = at > 0 ? items[at - 1].bottom : min(cut.top, viewHeight)
    let shown = viewHeight - cut.top
    if shown <= 0 { return ListCue(more: true, lift: maxZero(viewHeight - above)) }
    if shown >= FADE_PX { return ListCue(more: true, lift: 0) }
    return ListCue(more: true, lift: maxZero(viewHeight - above) * (1 - shown / FADE_PX))
}

/// How far to scroll so that a card shows whole with `room` around it and the fade below: positive down, negative
/// up, 0 when it already shows. A card taller than the view shows its top.
public func revealDelta(_ viewHeight: Double, _ item: ItemSpan, _ room: Double) -> Double {
    let top = item.top - room
    let bottom = item.bottom + room + FADE_PX
    if top < 0 { return top }
    if bottom > viewHeight { return min(bottom - viewHeight, top) }
    return 0
}
