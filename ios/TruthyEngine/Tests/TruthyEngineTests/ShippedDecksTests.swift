import Foundation
import Testing
import TruthyEngine

// The shipped content of native-data/decks decodes into the content types (reference 2.2: 4 areas, 54 decks,
// 285 sections, 7378 cards; gcp-cdl is the one deck without sections).
@Suite struct ShippedDecksTests {
    @Test func theIndexAndEveryDeckFileDecode() throws {
        let decoder = JSONDecoder()
        let index = try decoder.decode(DeckIndex.self, from: Data(contentsOf: Golden.decksDirectory.appending(path: "index.json")))
        let decks = index.areas.flatMap(\.platforms).flatMap(\.decks)
        #expect(index.areas.map(\.id) == ["cloud", "frontend", "devops", "backend"])
        #expect(decks.count == 54)
        #expect(decks.map(\.sections.count).reduce(0, +) == 285)
        #expect(decks.filter(\.sections.isEmpty).map(\.id) == ["gcp-cdl"])
        #expect(decks.map(\.cardCount).reduce(0, +) == 7378)
        var cards = 0
        for deck in decks {
            let file = try decoder.decode(DeckFile.self, from: Data(contentsOf: Golden.decksDirectory.appending(path: "\(deck.id).json")))
            #expect(file.id == deck.id)
            #expect(file.hash == deck.hash)
            #expect(file.cards.count == deck.cardCount, "\(deck.id)")
            #expect(file.cards.allSatisfy { $0.id.hasPrefix(deck.id + "-") }, "\(deck.id): card id prefix")
            let sections = deck.sections.isEmpty ? [WHOLE_DECK] : deck.sections.map(\.id)
            #expect(file.cards.allSatisfy { sections.contains($0.section) }, "\(deck.id): card sections")
            cards += file.cards.count
        }
        #expect(cards == 7378)
    }

    /// Plan A's manifest, checked once here; the app never reads it. A failure means plan A changed its layout.
    @Test func theManifestIsFormatOneAndMatchesTheDecks() throws {
        let url = Golden.root.appending(path: "native-data/manifest.json")
        let m = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        #expect(m["format"] as? Int == 1 && m["generator"] as? Int == 1)
        let hashes = m["deckHashes"] as! [String: String]
        let index = try JSONDecoder().decode(DeckIndex.self, from: Data(contentsOf: Golden.decksDirectory.appending(path: "index.json")))
        let decks = index.areas.flatMap(\.platforms).flatMap(\.decks)
        #expect(Set(hashes.keys) == Set(decks.map(\.id)))
        for d in decks { #expect(hashes[d.id] == d.hash && d.version == m["deckIndexVersion"] as? String, "\(d.id)") }
    }
}
