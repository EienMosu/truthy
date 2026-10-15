import Foundation
@testable import TruthyEngine

// Cards for the progress unit tests, decoded from the web's JSON shape so they do not depend on how task 1
// names the parts of a card's text. This file uses no progress type, so Foundation's Progress never meets it.
enum ProgressFixtures {
  static func card(_ id: String) throws -> Card {
    let json = #"{"id":"\#(id)","section":"SEC","text":{"en":{"statement":"Statement \#(id)","explanation":"Explanation \#(id)"}},"#
      + #""answer":true,"source":{"title":"AWS docs","url":"https://docs.aws.amazon.com/"},"difficulty":1,"appliesTo":"","conflictGroups":[]}"#
    return try JSONDecoder().decode(Card.self, from: Data(json.utf8))
  }
}
