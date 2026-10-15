import Testing
import TruthyEngine

// pad2 (tests/components/format.test.ts), the logo mark's height (tests/components/Logo.test.tsx) and the theme
// rules (tests/app-state/theme.test.ts), first as the web tests pin them, then against the golden vectors.
@Suite struct SmallHelpersTests {
    @Test func pad2PadsToTwoDigitsAndLeavesLongerNumbersAlone() {
        #expect(pad2(0) == "00")
        #expect(pad2(7) == "07")
        #expect(pad2(14) == "14")
        #expect(pad2(120) == "120")
        #expect(pad2(-5) == "-5")
    }

    @Test func logoMarkKeepsThe44By30Proportion() {
        #expect(logoMarkHeight() == 30)
        #expect(logoMarkHeight(44) == 30)
        #expect(logoMarkHeight(26) == 17.73)
        #expect(logoMarkHeight(20) == 13.64)
    }

    @Test func parsesOnlyLightAndDark() {
        #expect(parseTheme("light") == .light)
        #expect(parseTheme("dark") == .dark)
        for value in [nil, "", "Dark", " dark", "system", "auto", "1", #""dark""#, "purple"] as [String?] {
            #expect(parseTheme(value) == nil, "\(String(describing: value))")
        }
        #expect(THEME_KEY == "truthy.theme")
        #expect(Theme.allCases.map(\.rawValue) == ["light", "dark"])
    }

    @Test func letsAChoiceWinOverTheSystemAndFlipsTheVisibleTheme() {
        #expect(oppositeTheme(.light) == .dark)
        #expect(oppositeTheme(.dark) == .light)
        #expect(resolveTheme(nil, false) == .light)
        #expect(resolveTheme(nil, true) == .dark)
        #expect(resolveTheme(.light, true) == .light)
        #expect(resolveTheme(.dark, false) == .dark)
        #expect(switchTheme(nil, true) == .light)
        #expect(switchTheme(nil, false) == .dark)
        #expect(switchTheme(.dark, false) == .light)
        #expect(switchTheme(.light, true) == .dark)
    }

    @Test func pad2MatchesTheWeb() throws {
        let golden = try Golden.load("components/format", "pad2")
        for item in golden.cases {
            let n = try golden.decode(Int.self, #require(item.input["n"]))
            let expected = try golden.decode(String.self, item.output)
            #expect(pad2(n) == expected, "\(item.name)")
        }
    }

    @Test func logoMarkHeightMatchesTheWeb() throws {
        let golden = try Golden.load("components/Logo", "LogoMark")
        for item in golden.cases {
            let expected = try golden.decode(Double.self, item.output)
            if let width = item.input["width"] {
                #expect(logoMarkHeight(try golden.decode(Double.self, width)) == expected, "\(item.name)")
            } else {
                #expect(logoMarkHeight() == expected, "\(item.name)")
            }
        }
    }

    @Test func themeKeyMatchesTheWeb() throws {
        let golden = try Golden.load("src/app-state/theme", "THEME_KEY")
        #expect(golden.cases.count == 1)
        #expect(golden.cases[0].input == .null)
        #expect(try golden.decode(String.self, golden.cases[0].output) == THEME_KEY)
    }

    @Test func parseThemeMatchesTheWeb() throws {
        let golden = try Golden.load("src/app-state/theme", "parseTheme")
        for item in golden.cases {
            // A stored value that is not a string (a number, an object, an array) reaches the native store as no
            // string at all, so it is read as nil; the web gives null for all of them too.
            let value = item.input["value"]?.stringValue
            let expected = try golden.decode(Theme?.self, item.output)
            #expect(parseTheme(value) == expected, "\(item.name)")
        }
    }

    @Test func oppositeThemeMatchesTheWeb() throws {
        let golden = try Golden.load("src/app-state/theme", "oppositeTheme")
        for item in golden.cases {
            let theme = try golden.decode(Theme.self, #require(item.input["theme"]))
            #expect(oppositeTheme(theme) == (try golden.decode(Theme.self, item.output)), "\(item.name)")
        }
    }

    @Test func resolveThemeMatchesTheWeb() throws {
        let golden = try Golden.load("src/app-state/theme", "resolveTheme")
        for item in golden.cases {
            let choice = try golden.decode(Theme?.self, #require(item.input["choice"]))
            let systemDark = try golden.decode(Bool.self, #require(item.input["systemDark"]))
            #expect(resolveTheme(choice, systemDark) == (try golden.decode(Theme.self, item.output)), "\(item.name)")
        }
    }

    @Test func switchThemeMatchesTheWeb() throws {
        let golden = try Golden.load("src/app-state/theme", "switchTheme")
        for item in golden.cases {
            let choice = try golden.decode(Theme?.self, #require(item.input["choice"]))
            let systemDark = try golden.decode(Bool.self, #require(item.input["systemDark"]))
            let shown = try golden.decode(Theme.self, #require(item.output["theme"]))
            let stored = try golden.decode(String?.self, #require(item.output["stored"]))
            #expect(switchTheme(choice, systemDark) == shown, "\(item.name)")
            #expect(switchTheme(choice, systemDark).rawValue == stored, "\(item.name): the stored value")
        }
    }
}
