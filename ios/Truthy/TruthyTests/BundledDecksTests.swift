import Foundation
import Testing
import TruthyEngine

// Spec D3 and 4.1: the 54 decks are embedded, from native-data/decks in place, as the folder "decks". The test host
// is the app, so Bundle.main is the app bundle.
@Suite struct BundledDecksTests {
    private let decks = Bundle.main.url(forResource: "decks", withExtension: nil)

    @Test func theBundleHoldsTheIndexAndEveryDeck() throws {
        let folder = try #require(decks, "the app bundle has no decks folder")
        let files = try FileManager.default.contentsOfDirectory(atPath: folder.path(percentEncoded: false)).filter { $0.hasSuffix(".json") }
        #expect(files.count == 55)
        #expect(files.contains("index.json"))
    }

    @Test func theIndexDecodesAndEveryDeckItNamesIsThere() throws {
        let folder = try #require(decks)
        let index = try JSONDecoder().decode(DeckIndex.self, from: Data(contentsOf: folder.appending(path: "index.json")))
        let ids = index.areas.flatMap(\.platforms).flatMap(\.decks).map(\.id)
        #expect(ids.count == 54)
        for id in ids {
            #expect(FileManager.default.fileExists(atPath: folder.appending(path: "\(id).json").path(percentEncoded: false)), "\(id)")
        }
    }
}
