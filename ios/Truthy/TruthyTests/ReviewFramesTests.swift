import CoreGraphics
import Foundation
import Testing
@testable import Truthy

/// The files the debug recorder writes for the visual review (frames) and the N4 test (trace).
@Suite struct ReviewFramesTests {
    @Test func framesAreWindowPointsRoundedToHundredthsUnderSortedNames() throws {
        let data = ReviewFrameFile.encode([
            "ticket": CGRect(x: 16.004, y: 120.5, width: 398, height: 512.126),
            "pill:True": CGRect(x: 223, y: 838, width: 191, height: 60),
        ])
        let text = try #require(String(data: data, encoding: .utf8))
        let pill = try #require(text.range(of: "pill:True"))
        let ticket = try #require(text.range(of: "ticket"))
        #expect(pill.lowerBound < ticket.lowerBound)
        let decoded = try JSONDecoder().decode([String: [Double]].self, from: data)
        #expect(decoded == ["ticket": [16, 120.5, 398, 512.13], "pill:True": [223, 838, 191, 60]])
    }

    @Test func noFramesIsAnEmptyObject() {
        #expect(String(decoding: ReviewFrameFile.encode([:]), as: UTF8.self) == "{}")
    }

    @Test func theTraceIsOneObjectPerLine() throws {
        let samples = [
            TraceSample(t: 1.5, touch: [210, 400], card: [16, 100, 398, 300]),
            TraceSample(t: 1.5167, touch: nil, card: nil),
            TraceSample(t: 1.5333, touch: [12, 400], card: nil, pass: [16, 120, 398, 96.5]),
        ]
        let text = String(decoding: ReviewFrameFile.traceLines(samples), as: UTF8.self)
        #expect(text.hasSuffix("\n"))
        let lines = text.split(separator: "\n")
        #expect(lines.count == 3)
        let decoded = try lines.map { try JSONDecoder().decode(TraceSample.self, from: Data($0.utf8)) }
        #expect(decoded == samples)
    }

    @Test @MainActor func recordsOnlyWithAPathInTheEnvironment() {
        #expect(ReviewFrames(environment: [:]).isRecording == false)
        #expect(ReviewFrames(environment: ["TRUTHY_REVIEW_FRAMES": ""]).isRecording == false)
        #expect(ReviewFrames(environment: ["TRUTHY_REVIEW_FRAMES": "frames.json"]).isRecording)
        #expect(ReviewFrames(environment: ["TRUTHY_REVIEW_TRACE": "trace.jsonl"]).isRecording)
    }

    @Test func pillNamesCarryTheVisibleTitle() {
        #expect(ReviewName.pill("Next card") == "pill:Next card")
        #expect([ReviewName.logo, ReviewName.pass, ReviewName.ticket, ReviewName.card, ReviewName.stub, ReviewName.sheet]
            == ["logo", "pass", "ticket", "card", "stub", "sheet"])
    }
}
