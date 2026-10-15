import Foundation
import Testing
import TruthyEngine

// Spec 7.1: every file in native-data/golden is consumed, and a vector the suite skips is a failing test.
// Which files the suite consumes is read from the test sources: every Golden.load call with two string literals.

/// Off until every ported module has its golden tests; task 6 turns it on, and from then on a golden file
/// without a test fails the suite.
private let everyFileRequired = true

private func consumedFileNames() throws -> Set<String> {
    let pattern = try Regex(#"Golden\.load\("([^"]+)", "([^"]+)"\)"#, as: (Substring, Substring, Substring).self)
    var names = Set<String>()
    let files = FileManager.default.enumerator(at: Golden.testsDirectory, includingPropertiesForKeys: nil)
    while let url = files?.nextObject() as? URL {
        guard url.pathExtension == "swift" else { continue }
        for match in try String(contentsOf: url, encoding: .utf8).matches(of: pattern) {
            names.insert(Golden.fileName(String(match.output.1), String(match.output.2)))
        }
    }
    return names
}

private func cardReferences(in value: JSONValue) -> [String] {
    if let tag = value.tag, tag.key == "$card", let id = tag.value.stringValue { return [id] }
    switch value {
    case .array(let items): return items.flatMap(cardReferences)
    case .object(let members): return members.values.flatMap(cardReferences)
    default: return []
    }
}

@Suite struct GoldenCoverageTests {
    @Test func everyGoldenFileIsWellFormed() throws {
        let names = try Golden.fileNames()
        #expect(!names.isEmpty, "native-data/golden is empty: run plan A first")
        for name in names {
            let golden = try Golden.decodeFile(at: Golden.directory.appending(path: name))
            #expect(golden.format == 1, "\(name): format")
            #expect(Golden.fileName(golden.module, golden.function) == name, "\(name): module and function")
            #expect(!golden.cases.isEmpty, "\(name): no cases")
            #expect(Set(golden.cases.map(\.name)).count == golden.cases.count, "\(name): two cases share a name")
            for (id, card) in golden.cards {
                #expect(try golden.decode(Card.self, card).id == id, "\(name): card table entry \(id)")
            }
            for item in golden.cases {
                for id in cardReferences(in: item.input) + cardReferences(in: item.output) {
                    #expect(golden.cards[id] != nil, "\(name), \(item.name): card \(id) is not in the table")
                }
            }
        }
    }

    @Test func everyFileTheSuiteLoadsExists() throws {
        let consumed = try consumedFileNames()
        #expect(consumed.count >= 2, "the scan found no Golden.load call")
        // A named result, so that a failure prints the names (an expectation with `try` in it does not expand them).
        let missing = consumed.subtracting(try Golden.fileNames()).sorted()
        #expect(missing == [], "loaded files native-data/golden does not have")
    }

    @Test func noTwoGoldenFilesDifferOnlyInCase() throws {
        let names = try Golden.fileNames()
        #expect(Set(names.map { $0.lowercased() }).count == names.count)
    }

    @Test(.enabled(if: everyFileRequired)) func everyGoldenFileHasATest() throws {
        let untested = Set(try Golden.fileNames()).subtracting(try consumedFileNames()).sorted()
        #expect(untested == [], "golden files no test loads with two literals")
    }
}
