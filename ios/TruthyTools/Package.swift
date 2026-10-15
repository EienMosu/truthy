// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TruthyTools",
    platforms: [.macOS(.v15)],
    products: [
        .executable(name: "generate-tokens", targets: ["GenerateTokens"]),
    ],
    targets: [
        .target(name: "TokenGen"),
        .executableTarget(name: "GenerateTokens", dependencies: ["TokenGen"]),
        .testTarget(name: "TokenGenTests", dependencies: ["TokenGen"]),
    ],
    swiftLanguageModes: [.v6]
)
