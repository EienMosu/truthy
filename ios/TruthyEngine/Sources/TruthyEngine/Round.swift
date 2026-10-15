// The round: a pure reducer over the dealt cards, a line-by-line port of src/engine/round.ts.
// Randomness comes only from the seed given to startRound; time comes in on the events.

public let CLASSIC_LENGTH = CHUNK // a Classic round is the first chunk
public let LIVES = 3

// Timed: the length of the round, how long the stamp stays before the next card, and the most time one
// tick may count (a longer gap is a sleep the app did not report).
public struct TimedSettings: Equatable, Sendable {
    public let roundMs: Double
    public let holdMs: Double
    public let maxStepMs: Double

    public init(roundMs: Double, holdMs: Double, maxStepMs: Double) {
        self.roundMs = roundMs
        self.holdMs = holdMs
        self.maxStepMs = maxStepMs
    }
}

public let TIMED = TimedSettings(roundMs: 60_000, holdMs: 700, maxStepMs: 1_000)

public enum Phase: String, Equatable, Sendable {
    case question, answered, stamped, finished
}

// The Timed clock. It only moves on events: lastTick is the moment up to which time has been counted
// (nil before the first tick and while hidden); holdMs is what is left of the stamp.
public struct Clock: Equatable, Sendable {
    public var remainingMs: Double
    public var lastTick: Double?
    public var hidden: Bool
    public var holdMs: Double

    public init(remainingMs: Double, lastTick: Double?, hidden: Bool, holdMs: Double) {
        self.remainingMs = remainingMs
        self.lastTick = lastTick
        self.hidden = hidden
        self.holdMs = holdMs
    }
}

// What the next chunk is dealt from: the route's cards, the stored history, the round's seed and how many
// chunks it has dealt.
public struct DealSource: Equatable, Sendable {
    public var pool: [Card]
    public var history: History
    public var seed: Double
    public var chunks: Int

    public init(pool: [Card], history: History, seed: Double, chunks: Int) {
        self.pool = pool
        self.history = history
        self.seed = seed
        self.chunks = chunks
    }
}

public struct RoundState: Equatable, Sendable {
    public var mode: Mode
    public var route: Route
    public var cards: [Card] // every card dealt so far, in order; the unbounded modes add a chunk when they run out
    public var index: Int // index of the current card
    public var answers: [Answered]
    public var phase: Phase
    public var abandoned: Bool
    public var source: DealSource
    public var clock: Clock? // Timed only

    public init(
        mode: Mode, route: Route, cards: [Card], index: Int, answers: [Answered], phase: Phase,
        abandoned: Bool, source: DealSource, clock: Clock?
    ) {
        self.mode = mode
        self.route = route
        self.cards = cards
        self.index = index
        self.answers = answers
        self.phase = phase
        self.abandoned = abandoned
        self.source = source
        self.clock = clock
    }
}

public enum RoundEvent: Equatable, Sendable {
    case answer(value: Bool, at: Double)
    case next
    case tick(now: Double)
    case visibility(hidden: Bool, at: Double)
    case abandon
}

public struct StartArgs: Equatable, Sendable {
    public var mode: Mode
    public var route: Route
    public var pool: [Card]
    public var history: History
    public var seed: Double

    public init(mode: Mode, route: Route, pool: [Card], history: History, seed: Double) {
        self.mode = mode
        self.route = route
        self.pool = pool
        self.history = history
        self.seed = seed
    }
}

// What startRound throws, with the message the TypeScript Error carries.
public struct RoundError: Error, Equatable, Sendable {
    public let message: String

    public init(message: String) {
        self.message = message
    }
}

// The seed of chunk k of a round: the round's seed for the first chunk, then steps of the 32-bit golden
// ratio. (seed + Math.imul(chunk, 0x9e3779b9)) >>> 0: the product wraps to a signed 32-bit integer, the sum
// is a double, and >>> 0 takes it modulo 2^32.
public func chunkSeed(_ seed: Double, _ chunk: Int) -> Double {
    let step = Int32(bitPattern: UInt32(truncatingIfNeeded: chunk) &* 0x9e37_79b9)
    return Double(jsUint32(seed + Double(step)))
}

private func withNextChunk(_ state: RoundState) -> RoundState {
    let source = state.source
    let chunk = dealChunk(source.pool, source.history, createRng(chunkSeed(source.seed, source.chunks)), state.cards)
    var next = state
    next.cards = state.cards + chunk
    next.source.chunks = source.chunks + 1
    return next
}

// Throws for an empty pool. The TypeScript also throws for a mode it does not know; a Mode value is always
// one of the four, so that case cannot be built here (the golden test checks the vector says so).
public func startRound(_ args: StartArgs) throws -> RoundState {
    if args.pool.isEmpty {
        throw RoundError(message: "The route \(args.route.deckId)/\(args.route.sectionId) has no cards to deal.")
    }
    return withNextChunk(
        RoundState(
            mode: args.mode,
            route: args.route,
            cards: [],
            index: 0,
            answers: [],
            phase: .question,
            abandoned: false,
            source: DealSource(pool: args.pool, history: args.history, seed: args.seed, chunks: 0),
            clock: args.mode == .timed ? Clock(remainingMs: TIMED.roundMs, lastTick: nil, hidden: false, holdMs: 0) : nil
        )
    )
}

// The card on screen; nil once the round is finished.
public func currentCard(_ state: RoundState) -> Card? {
    guard state.phase != .finished, state.cards.indices.contains(state.index) else { return nil }
    return state.cards[state.index]
}

public func lastAnswer(_ state: RoundState) -> Answered? {
    state.answers.last
}

public func wrongCount(_ state: RoundState) -> Int {
    state.answers.filter { !$0.correct }.count
}

public func livesLeft(_ state: RoundState) -> Int {
    max(0, LIVES - wrongCount(state))
}

// Decided: the mode's end rule has been met and only the result is left to show. No answer can change the
// score any more; the next event finishes the round.
public func isDecided(_ state: RoundState) -> Bool {
    if state.phase == .finished { return false }
    switch state.mode {
    case .classic:
        return state.phase == .answered && state.index + 1 >= state.cards.count
    case .streak:
        return state.phase == .answered && lastAnswer(state)?.correct == false
    case .lives:
        return state.phase == .answered && wrongCount(state) >= LIVES
    case .timed:
        guard let clock = state.clock else { return false }
        return clock.remainingMs == 0
    }
}

// Pure: returns a new state, or a state equal to the one given when the event does not apply.
// An event whose time is not a finite number does not apply: one NaN would make the Timed clock NaN for good,
// and a clock that is never 0 never ends the round.
public func reduce(_ state: RoundState, _ event: RoundEvent) -> RoundState {
    if state.phase == .finished { return state }
    if !timeOf(event).isFinite { return state }
    switch event {
    case let .answer(value, at):
        return state.phase == .question ? recordAnswer(state, value, at) : state
    case .next:
        if isDecided(state) {
            var finished = state
            finished.phase = .finished
            return finished
        }
        return state.phase == .answered ? advance(state) : state
    case let .tick(now):
        guard let clock = state.clock else { return state }
        return onTick(state, clock, now)
    case let .visibility(hidden, at):
        guard let clock = state.clock else { return state }
        return onVisibility(state, clock, hidden, at)
    case .abandon:
        var left = state
        left.phase = .finished
        left.abandoned = true
        return left
    }
}

// The moment an event happened; 0 for the events that carry no time.
private func timeOf(_ event: RoundEvent) -> Double {
    switch event {
    case let .answer(_, at): return at
    case let .visibility(_, at): return at
    case let .tick(now): return now
    case .next, .abandon: return 0
    }
}

// To the next card as a question. When the dealt cards run out, the next chunk is dealt first
// (dealChunk never returns an empty chunk).
private func advance(_ state: RoundState) -> RoundState {
    let index = state.index + 1
    var dealt = index < state.cards.count ? state : withNextChunk(state)
    dealt.index = index
    dealt.phase = .question
    return dealt
}

private func recordAnswer(_ state: RoundState, _ given: Bool, _ at: Double) -> RoundState {
    guard state.cards.indices.contains(state.index) else { return state }
    let card = state.cards[state.index]
    let answers = state.answers + [Answered(card: card, given: given, correct: given == card.answer, at: at)]
    var next = state
    guard let running = state.clock else {
        next.answers = answers
        next.phase = .answered
        return next
    }
    // Timed: the clock runs up to the answer first. An answer at or after zero does not count.
    let clock = countTo(running, at)
    if clock.remainingMs == 0 {
        next.clock = clock
        next.phase = .stamped
        return next
    }
    var held = clock
    held.holdMs = TIMED.holdMs
    next.answers = answers
    next.phase = .stamped
    next.clock = held
    return next
}

// The time to count between the last counted moment and `now`: none while hidden or before the first
// tick, never negative (a clock source may jump back), at most maxStepMs. The zero is the second argument
// of max so that a negative zero comes out as +0, as Math.max(0, x) gives.
private func elapsed(_ clock: Clock, _ now: Double) -> Double {
    guard !clock.hidden, let lastTick = clock.lastTick else { return 0 }
    return min(max(now - lastTick, 0), TIMED.maxStepMs)
}

private func countTo(_ clock: Clock, _ now: Double) -> Clock {
    if clock.hidden { return clock }
    var counted = clock
    counted.remainingMs = max(clock.remainingMs - elapsed(clock, now), 0)
    counted.lastTick = now
    return counted
}

private func onTick(_ state: RoundState, _ clock: Clock, _ now: Double) -> RoundState {
    if clock.remainingMs == 0 || clock.hidden { return state }
    let passed = elapsed(clock, now)
    let counted = countTo(clock, now)
    if counted.remainingMs == 0 {
        // Time is up. A card that was being stamped has been answered in time: it leaves, and the card that
        // does not count is the next one.
        var stopped = counted
        stopped.holdMs = 0
        var withStopped = state
        withStopped.clock = stopped
        var onCard = state.phase == .stamped ? advance(withStopped) : withStopped
        onCard.phase = .stamped
        return onCard
    }
    var next = state
    if state.phase != .stamped {
        next.clock = counted
        return next
    }
    let holdMs = max(clock.holdMs - passed, 0)
    var held = counted
    held.holdMs = holdMs
    next.clock = held
    if holdMs > 0 { return next }
    return advance(next)
}

private func onVisibility(_ state: RoundState, _ clock: Clock, _ hidden: Bool, _ at: Double) -> RoundState {
    if clock.remainingMs == 0 || clock.hidden == hidden { return state }
    if !hidden {
        var shown = clock
        shown.hidden = false
        shown.lastTick = at
        var next = state
        next.clock = shown
        return next
    }
    // Hiding counts the time up to this moment, as a tick does, then pauses.
    let counted = onTick(state, clock, at)
    guard let countedClock = counted.clock, countedClock.remainingMs != 0 else { return counted }
    var paused = countedClock
    paused.hidden = true
    paused.lastTick = nil
    var next = counted
    next.clock = paused
    return next
}

// The number a mode's record keeps (spec section 6, "Modes").
public func scoreOf(_ mode: Mode, _ answers: [Answered]) -> Int {
    switch mode {
    case .classic, .timed:
        return answers.filter { $0.correct }.count
    case .streak:
        return longestRun(answers)
    case .lives:
        return answers.count
    }
}

private func longestRun(_ answers: [Answered]) -> Int {
    var longest = 0
    var run = 0
    for answer in answers {
        run = answer.correct ? run + 1 : 0
        longest = max(longest, run)
    }
    return longest
}

public func summarise(_ state: RoundState) -> RoundResult {
    RoundResult(
        mode: state.mode,
        route: state.route,
        score: scoreOf(state.mode, state.answers),
        total: state.answers.count,
        answers: state.answers,
        missed: state.answers.filter { !$0.correct },
        abandoned: state.abandoned
    )
}
