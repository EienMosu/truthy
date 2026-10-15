// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TruthyEngine",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [
        .library(name: "TruthyEngine", targets: ["TruthyEngine"]),
    ],
    targets: [
        .target(name: "TruthyEngine"),
        .testTarget(name: "TruthyEngineTests", dependencies: ["TruthyEngine"]),
    ],
    swiftLanguageModes: [.v6]
)
