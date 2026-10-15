import CoreText
import Foundation
import Testing
import UIKit

// Spec 6 and reference 2.2: the four fonts load by their PostScript names and draw every character the content and
// the copy use: the bullet and section signs, the en dash, typographic quotes, e acute (both cases), the arrows and
// the middle dot.
@Suite struct FontCoverageTests {
    static let postScriptNames = ["OverpassRoman-SemiBold", "OverpassRoman-ExtraBold", "OverpassMono-Regular", "OverpassMono-SemiBold"]
    static let needed: [UniChar] = [0x2022, 0x00A7, 0x2013, 0x2018, 0x2019, 0x201A, 0x201B, 0x201C, 0x201D, 0x00E9, 0x00C9,
                                     0x2190, 0x2191, 0x2192, 0x2193, 0x00B7]

    @Test(arguments: postScriptNames)
    func eachFontLoadsAndCoversTheCharacters(name: String) throws {
        let font = try #require(UIFont(name: name, size: 17), "\(name) is not registered")
        #expect(font.fontName == name)
        var glyphs = [CGGlyph](repeating: 0, count: Self.needed.count)
        var characters = Self.needed
        let covered = CTFontGetGlyphsForCharacters(font as CTFont, &characters, &glyphs, characters.count)
        let missing = zip(Self.needed, glyphs).filter { $0.1 == 0 }.map { String(format: "U+%04X", $0.0) }
        #expect(covered && missing.isEmpty, "\(name) has no glyph for \(missing)")
    }

    @Test func theLicenceShipsWithTheFonts() throws {
        let licence = try #require(Bundle.main.url(forResource: "OFL", withExtension: "txt"))
        #expect(try String(contentsOf: licence, encoding: .utf8).contains("SIL OPEN FONT LICENSE"))
    }
}
