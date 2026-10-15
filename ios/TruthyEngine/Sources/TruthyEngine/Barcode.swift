// The barcode of the stub (components/BoardingPass.tsx:251-277): the same bars on every platform. The data is the
// card's id.

public struct BarcodeBar: Codable, Equatable, Sendable {
    public let x: Int
    public let width: Int

    public init(x: Int, width: Int) {
        self.x = x
        self.width = width
    }
}

/// Start bars 2/1/1/2 (on, off, on, off); per character 7 bits of its first UTF-16 unit, least significant first, width
/// 2 for a 1 and 1 for a 0, alternating on and off from on, then a 1-wide gap; end bars 1/1/2 (on, off, on).
public func barcodeBars(_ data: String) -> (bars: [BarcodeBar], width: Int) {
    var bars: [BarcodeBar] = []
    var x = 0
    func bar(_ width: Int, _ on: Bool) {
        if on { bars.append(BarcodeBar(x: x, width: width)) }
        x += width
    }
    bar(2, true)
    bar(1, false)
    bar(1, true)
    bar(2, false)
    for scalar in data.unicodeScalars {
        let code = Int(scalar.utf16.first ?? 0)
        for bit in 0..<7 { bar((code >> bit) & 1 == 1 ? 2 : 1, bit % 2 == 0) }
        bar(1, false)
    }
    bar(1, true)
    bar(1, false)
    bar(2, true)
    return (bars, x)
}
