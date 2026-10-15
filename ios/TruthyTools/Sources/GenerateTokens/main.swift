import Foundation
import TokenGen

// swift run --package-path ios/TruthyTools generate-tokens [repository root]
// Reads native-data/tokens/resolved.json and writes ios/Truthy/Truthy/Design/Tokens.swift.
let root = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : FileManager.default.currentDirectoryPath)
let input = root.appending(path: "native-data/tokens/resolved.json")
let output = root.appending(path: "ios/Truthy/Truthy/Design/Tokens.swift")
do {
    let text = try TokenGen.generate(Data(contentsOf: input))
    try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Data(text.utf8).write(to: output, options: .atomic)
    print("wrote ios/Truthy/Truthy/Design/Tokens.swift, \(text.split(separator: "\n").count) lines")
} catch {
    FileHandle.standardError.write(Data("generate-tokens: \(error)\n".utf8))
    exit(1)
}
