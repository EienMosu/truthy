import Foundation
import TruthyEngine

// The engine's KeyValueStorage (task 4) over files: key K is the file K.json in `directory`. Writes are atomic and
// throw on any failure; a read returns nil only when the file does not exist and throws when it cannot be read, so
// the engine's store sees the same failures the web's storage reports (reference 6).

struct FileKeyValueStorage: KeyValueStorage {
    let directory: URL

    func url(_ key: String) -> URL {
        directory.appending(path: "\(key).json")
    }

    func getItem(_ key: String) throws -> String? {
        let file = url(key)
        guard FileManager.default.fileExists(atPath: file.path(percentEncoded: false)) else { return nil }
        return try String(contentsOf: file, encoding: .utf8)
    }

    func setItem(_ key: String, _ value: String) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try Data(value.utf8).write(to: url(key), options: .atomic)
    }
}
