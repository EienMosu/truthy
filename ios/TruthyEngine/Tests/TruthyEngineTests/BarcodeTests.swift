import Testing
@testable import TruthyEngine

// tests/components/BoardingPass.test.tsx (barcodeBars).
@Suite struct BarcodeTests {
    @Test func startAndEndBarsFrameTheData() {
        let empty = barcodeBars("")
        #expect(empty.bars == [BarcodeBar(x: 0, width: 2), BarcodeBar(x: 3, width: 1), BarcodeBar(x: 6, width: 1), BarcodeBar(x: 8, width: 2)])
        #expect(empty.width == 10)
    }

    @Test func eachCharacterIsSevenBitsLeastSignificantFirst() {
        // "A" is 65 = 1000001: bits 1,0,0,0,0,0,1; on, off, on, off, on, off, on; then a 1 wide gap.
        let a = barcodeBars("A")
        #expect(a.bars[2] == BarcodeBar(x: 6, width: 2))
        #expect(a.width == 6 + (2 + 1 + 1 + 1 + 1 + 1 + 2) + 1 + 4)
        // Beyond the first plane only the high surrogate counts: U+1F600 reads as 0xD83D, whose low seven bits are
        // 0111101, widths 2, 1, 2, 2, 2, 2, 1.
        #expect(barcodeBars("😀").width == 6 + 12 + 1 + 4)
        // "é" is one unit, 233, low seven bits 1101001: widths 2, 1, 1, 2, 1, 2, 2.
        #expect(barcodeBars("é").width == 6 + 11 + 1 + 4)
    }
}
