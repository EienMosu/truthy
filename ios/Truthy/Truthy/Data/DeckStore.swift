import Foundation
import TruthyEngine

// The embedded decks (spec D3, 4.2): the index is decoded at launch, on the caller's thread; a deck is decoded off
// the main thread when a route is chosen. The folder "decks" is task 7's folder reference to native-data/decks.

struct DeckStoreError: Error, CustomStringConvertible {
    let description: String
}

final class DeckStore: Sendable {
    let folder: URL

    init(bundle: Bundle) {
        folder = bundle.url(forResource: "decks", withExtension: nil) ?? bundle.bundleURL.appending(path: "decks")
    }

    func index() throws -> DeckIndex {
        try JSONDecoder().decode(DeckIndex.self, from: Data(contentsOf: folder.appending(path: "index.json")))
    }

    func deck(_ id: String) async throws -> DeckFile {
        let url = folder.appending(path: "\(id).json")
        return try await Task.detached(priority: .userInitiated) {
            let deck = try JSONDecoder().decode(DeckFile.self, from: Data(contentsOf: url))
            guard deck.id == id else { throw DeckStoreError(description: "\(id).json holds the deck \(deck.id)") }
            return deck
        }.value
    }
}
