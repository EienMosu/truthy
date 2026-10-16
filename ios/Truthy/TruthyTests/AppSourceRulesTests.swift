import Foundation
import Testing

// README Global Constraints that no screen test sees: no system navigation or full-screen cover for the top-level
// screens, no simultaneousGesture (it blocks scrolling on iOS 26.5), haptics only through sensoryFeedback, no
// selectable text, no literal or system colours or font sizes in views (they come from Tokens.swift), and none of
// spec 5.7's web smells: no browser-like dialog (item 8), no link that leaves the app (item 9), no hover or
// long-press menu (items 1 and N8).
@Suite struct AppSourceRulesTests {
    static let appSources = URL(filePath: #filePath).deletingLastPathComponent().deletingLastPathComponent().appending(path: "Truthy")
    static let rules: [(String, String)] = [
        ("NavigationStack", #"\bNavigation(?:Stack|View|SplitView)\b"#),
        ("fullScreenCover", #"\.fullScreenCover\("#),
        ("simultaneousGesture", #"\.simultaneousGesture\("#),
        ("UIKit haptics", #"\bUI(?:Impact|Notification|Selection)FeedbackGenerator\b"#),
        ("selectable text", #"\.textSelection\(\.enabled\)"#),
        ("a literal colour", #"\bColor\((?:red|white|hue):|\bUIColor\((?:red|white|hue):|\bColor\(\.sRGB"#),
        ("a literal font size", #"\.system\(size:|\.custom\([^)]*size:\s*\d|UIFont\([^)]*size:\s*\d"#),
        ("a system colour", #"\bColor\.(?:white|black|red|green|blue|gray|yellow|orange|primary|secondary|accentColor)\b|\.(?:foregroundStyle|foregroundColor|tint)\(\.(?:white|black|primary|secondary|blue|accentColor)\)"#),
        ("a browser-like dialog", #"\.(?:alert|confirmationDialog|popover)\("#),
        ("a link out of the app", #"\bLink\(|\bopenURL\b|UIApplication\.shared\.open\("#),
        ("a hover or long-press menu", #"\.(?:onHover|hoverEffect|contextMenu)\b"#),
        // The web's pills have circular ends (border-radius draws arcs); Capsule() is continuous: Capsule.pill.
        ("a continuous capsule", #"\bCapsule\(\s*\)|\bCapsule\(style:\s*\.continuous\)"#),
    ]

    static func findings(in name: String, _ source: String) throws -> [String] {
        let code = source.replacing(try Regex(#"//[^\n]*"#), with: "")
        // Simple word boundaries, as in task 1's purity test: with the default Unicode ones "Color.red" is one word.
        return try rules.compactMap { rule in
            try code.contains(Regex(rule.1).wordBoundaryKind(.simple)) ? "\(name) uses \(rule.0)" : nil
        }
    }

    @Test func theScannerFindsEachRule() throws {
        let planted = """
            NavigationStack { }
            .fullScreenCover(isPresented: $x) { }
            .simultaneousGesture(drag)
            UIImpactFeedbackGenerator(style: .light)
            .textSelection(.enabled)
            Color(red: 1, green: 0, blue: 0)
            .font(.system(size: 17))
            .foregroundStyle(Color.white)
            .alert("Leave round?", isPresented: $x) { }
            Link("Docs", destination: url)
            .contextMenu { }
            .background(Capsule().fill(ink))
            """
        // An icon or a frame of a literal size is not a font size; the tokens give fonts their sizes.
        #expect(try Self.findings(in: "icon.swift", "IconView(icon: .cross, size: 16)").isEmpty)
        #expect(try Self.findings(in: "planted.swift", planted).count == 12)
        #expect(try Self.findings(in: "ok.swift", "// NavigationStack in a comment\nColor(\"LaunchSurface\")\nColor.clear\nSafariView(url: url)\nCapsule.pill").isEmpty)
    }

    @Test func appSourcesKeepTheGlobalConstraints() throws {
        let files = FileManager.default.enumerator(at: Self.appSources, includingPropertiesForKeys: nil)
        var found: [String] = []
        var scanned = 0
        while let url = files?.nextObject() as? URL {
            guard url.pathExtension == "swift", url.lastPathComponent != "Tokens.swift", !url.path.contains("/Debug/") else { continue }
            scanned += 1
            found += try Self.findings(in: url.lastPathComponent, String(contentsOf: url, encoding: .utf8))
        }
        #expect(scanned > 0)
        #expect(found == [])
    }
}
