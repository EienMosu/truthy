import Testing
@testable import TruthyEngine

// native-data/golden/src.progress.local.*.json. The createLocalStore cases are scripts over a storage held as
// plain data: steps run in order, and the output is what each load returned and the storage at the end.
//   load: store.load() into loads; save: store.save(progress); resave: store.save(store.load());
//   put: the script writes a key straight into the storage; breakGet: every getItem throws from here on;
//   breakSet: setItem throws from here on for the listed keys, or for every key when keys is "all".
// "storage": null is createLocalStore(nil).
private typealias G = ProgressGolden

private struct StorageBroken: Error {}

private final class ScriptStorage: KeyValueStorage {
  var items: [String: String]
  var getBroken = false
  var setBroken: Set<String> = []
  var setBrokenForAll = false

  init(_ items: [String: String]) { self.items = items }

  func getItem(_ key: String) throws -> String? {
    if getBroken { throw StorageBroken() }
    return items[key]
  }

  func setItem(_ key: String, _ value: String) throws {
    if setBrokenForAll || setBroken.contains(key) { throw StorageBroken() }
    items[key] = value
  }
}

// The stored progress is compared as JSON (the web and Swift order keys differently); any other value exactly.
private func sameStoredValue(_ got: String, _ expected: String) -> Bool {
  if got.utf16.elementsEqual(expected.utf16) { return true }
  guard let a = parseJSON(got), let b = parseJSON(expected), case .object = a else { return false }
  return a == b
}

@Suite struct LocalStoreGoldenTests {
  @Test func keys() throws {
    #expect(PROGRESS_KEY == (try #require(try Golden.load("src/progress/local", "PROGRESS_KEY").cases.first).output.string()))
    #expect(UNREADABLE_KEY == (try #require(try Golden.load("src/progress/local", "UNREADABLE_KEY").cases.first).output.string()))
  }

  @Test func createLocalStoreScripts() throws {
    let file = try Golden.load("src/progress/local", "createLocalStore")
    #expect(!file.cases.isEmpty)
    for c in file.cases {
      let storageSpec = try G.required(c.input, "storage")
      var storage: ScriptStorage? = nil
      if storageSpec != .null {
        guard case .object(let items) = try G.required(storageSpec, "items") else { throw GoldenError(description: "\(c.name): items") }
        storage = ScriptStorage(try items.mapValues { try $0.string() })
      }
      let store = createLocalStore(storage)
      var loads: [Progress] = []
      for step in try G.required(c.input, "steps").array() {
        switch try G.required(step, "op").string() {
        case "load": loads.append(store.load())
        case "save": store.save(try G.progress(try G.required(step, "progress")))
        case "resave": store.save(store.load())
        case "put": storage?.items[try G.required(step, "key").string()] = try G.required(step, "value").string()
        case "breakGet": storage?.getBroken = true
        case "breakSet":
          let keys = try G.required(step, "keys")
          if keys == .string("all") { storage?.setBrokenForAll = true } else { storage?.setBroken = Set(try keys.array().map { try $0.string() }) }
        case let op: throw GoldenError(description: "\(c.name): unknown op \(op)")
        }
      }
      let expectedLoads = try G.required(c.output, "loads").array().map(G.progress)
      #expect(loads.count == expectedLoads.count, "\(c.name): loads")
      for (got, expected) in zip(loads, expectedLoads) { #expect(G.exactly(got, expected), "\(c.name): load") }
      let expectedItems = try G.required(c.output, "items")
      if expectedItems == .null {
        #expect(storage == nil, "\(c.name): storage")
        continue
      }
      guard case .object(let items) = expectedItems, let storage else { throw GoldenError(description: "\(c.name): items") }
      #expect(Set(storage.items.keys) == Set(items.keys), "\(c.name): keys")
      for (key, value) in items {
        let got = storage.items[key] ?? ""
        #expect(sameStoredValue(got, try value.string()), "\(c.name): \(key) is \(got)")
      }
    }
  }
}
