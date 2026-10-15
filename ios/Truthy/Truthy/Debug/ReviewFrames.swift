import SwiftUI
import UIKit

/// The names of the views the visual review measures (spec 7.4, criterion 2). The web side of
/// `ios/Tools/visual-review` reads the same names from the web page, so a name here is a contract with `web.mjs`.
enum ReviewName {
    static let logo = "logo"
    static let pass = "pass"
    static let ticket = "ticket"
    static let card = "card"
    static let stub = "stub"
    static let sheet = "sheet"

    /// A pill is named after its visible title: "pill:True", "pill:Next card", "pill:Start round".
    static func pill(_ title: String) -> String { "pill:" + title }
}

extension View {
    /// Debug builds: reports this view's frame in window points while the app runs with the
    /// `TRUTHY_REVIEW_FRAMES` or `TRUTHY_REVIEW_TRACE` environment variable (the visual review and the N4 test).
    /// Without them, and in release builds, it does nothing.
    func reviewFrame(_ name: String) -> some View {
        #if DEBUG
        background(ReviewProbe(name: name))
        #else
        self
        #endif
    }
}

#if DEBUG

/// One display frame of the trace: the time (`CACurrentMediaTime` base), the first touch in window points (nil when
/// no finger is down) and the frames of the "card" view (N4) and of the fill-in pass (its morph during a back), each
/// as [x, y, width, height].
struct TraceSample: Codable, Equatable {
    let t: Double
    let touch: [Double]?
    let card: [Double]?
    var pass: [Double]? = nil
}

/// The two file formats, kept pure so a unit test pins them.
enum ReviewFrameFile {
    /// [x, y, width, height] rounded to hundredths of a point.
    static func numbers(_ rect: CGRect) -> [Double] {
        [rect.minX, rect.minY, rect.width, rect.height].map { (Double($0) * 100).rounded() / 100 }
    }

    /// One JSON object, name to [x, y, width, height], names sorted.
    static func encode(_ frames: [String: CGRect]) -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return (try? encoder.encode(frames.mapValues(numbers))) ?? Data("{}".utf8)
    }

    /// One JSON object per line, each line ending in a newline.
    static func traceLines(_ samples: [TraceSample]) -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        var data = Data()
        for sample in samples {
            guard let line = try? encoder.encode(sample) else { continue }
            data.append(line)
            data.append(0x0A)
        }
        return data
    }
}

/// Debug-only recorder. With `TRUTHY_REVIEW_FRAMES` it rewrites that file with the frames of every probe in a
/// window, four times a second, when they changed. With `TRUTHY_REVIEW_TRACE` it appends one `TraceSample` per
/// display frame to that file. Paths are host paths: the simulator runs the app as a Mac process.
@MainActor
final class ReviewFrames {
    static let shared = ReviewFrames(environment: ProcessInfo.processInfo.environment)

    private struct Probe {
        let name: String
        weak var view: UIView?
    }

    private let framesURL: URL?
    private let traceURL: URL?
    private var probes: [ObjectIdentifier: Probe] = [:]
    private var timer: Timer?
    private var link: CADisplayLink?
    private var linkTarget: DisplayLinkTarget?
    private var watcher: TouchWatcher?
    private var lastFrames: Data?
    private var pending: [TraceSample] = []
    private var touch: CGPoint?

    init(environment: [String: String]) {
        framesURL = Self.fileURL(environment["TRUTHY_REVIEW_FRAMES"])
        traceURL = Self.fileURL(environment["TRUTHY_REVIEW_TRACE"])
    }

    private static func fileURL(_ path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path)
    }

    var isRecording: Bool { framesURL != nil || traceURL != nil }

    func attach(_ view: UIView, name: String) {
        guard isRecording else { return }
        probes[ObjectIdentifier(view)] = Probe(name: name, view: view)
        if traceURL != nil, watcher == nil, let window = view.window {
            let watcher = TouchWatcher { [weak self] point in self?.touch = point }
            window.addGestureRecognizer(watcher)
            self.watcher = watcher
        }
        start()
    }

    func detach(_ view: UIView) {
        probes[ObjectIdentifier(view)] = nil
    }

    /// The frame of every probe that is in a window, in that window's points.
    func currentFrames() -> [String: CGRect] {
        var frames: [String: CGRect] = [:]
        for probe in probes.values {
            guard let view = probe.view, let window = view.window else { continue }
            frames[probe.name] = view.convert(view.bounds, to: window)
        }
        return frames
    }

    private func start() {
        if framesURL != nil, timer == nil {
            let timer = Timer(timeInterval: 0.25, repeats: true) { _ in
                MainActor.assumeIsolated { ReviewFrames.shared.flushFrames() }
            }
            RunLoop.main.add(timer, forMode: .common)
            self.timer = timer
        }
        if traceURL != nil, link == nil {
            let target = DisplayLinkTarget()
            let link = CADisplayLink(target: target, selector: #selector(DisplayLinkTarget.tick(_:)))
            link.add(to: .main, forMode: .common)
            self.link = link
            linkTarget = target
        }
    }

    func flushFrames() {
        guard let framesURL else { return }
        let data = ReviewFrameFile.encode(currentFrames())
        guard data != lastFrames else { return }
        lastFrames = data
        try? data.write(to: framesURL, options: .atomic)
    }

    func traceTick(time: Double) {
        guard traceURL != nil else { return }
        let frames = currentFrames()
        let finger = touch.map { [Double($0.x), Double($0.y)] }
        pending.append(TraceSample(t: time, touch: finger, card: frames[ReviewName.card].map(ReviewFrameFile.numbers),
                                   pass: frames[ReviewName.pass].map(ReviewFrameFile.numbers)))
        if pending.count >= 30 { flushTrace() }
    }

    private func flushTrace() {
        guard let traceURL, !pending.isEmpty else { return }
        let data = ReviewFrameFile.traceLines(pending)
        pending.removeAll()
        if let handle = try? FileHandle(forWritingTo: traceURL) {
            handle.seekToEndOfFile()
            handle.write(data)
            try? handle.close()
        } else {
            try? data.write(to: traceURL, options: .atomic)
        }
    }
}

/// The display link's target: `CADisplayLink` needs an Objective-C selector.
@MainActor
private final class DisplayLinkTarget: NSObject {
    @objc func tick(_ link: CADisplayLink) {
        ReviewFrames.shared.traceTick(time: link.timestamp)
    }
}

/// A recognizer on the window that never recognizes and never delays or cancels a touch: it only reports where
/// the first finger is, for the N4 trace.
private final class TouchWatcher: UIGestureRecognizer, UIGestureRecognizerDelegate {
    private let report: (CGPoint?) -> Void

    init(report: @escaping (CGPoint?) -> Void) {
        self.report = report
        super.init(target: nil, action: nil)
        cancelsTouchesInView = false
        delaysTouchesBegan = false
        delaysTouchesEnded = false
        delegate = self
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        report(location(of: touches))
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        report(location(of: touches))
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        report(nil)
        state = .failed
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        report(nil)
        state = .failed
    }

    private func location(of touches: Set<UITouch>) -> CGPoint? {
        guard let touch = touches.first else { return nil }
        return touch.location(in: view)
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        true
    }
}

/// The view `reviewFrame` puts behind the measured view: invisible, untouchable, hidden from accessibility.
private struct ReviewProbe: UIViewRepresentable {
    let name: String

    func makeUIView(context: Context) -> ReviewProbeView {
        let view = ReviewProbeView()
        view.name = name
        return view
    }

    func updateUIView(_ view: ReviewProbeView, context: Context) {
        view.name = name
    }
}

private final class ReviewProbeView: UIView {
    var name = "" {
        didSet {
            if window != nil { ReviewFrames.shared.attach(self, name: name) }
        }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        isAccessibilityElement = false
        accessibilityElementsHidden = true
        backgroundColor = .clear
    }

    required init?(coder: NSCoder) {
        nil
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil {
            ReviewFrames.shared.detach(self)
        } else {
            ReviewFrames.shared.attach(self, name: name)
        }
    }
}

#endif
