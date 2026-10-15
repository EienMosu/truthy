// Leaving a round for any reason but its end (components/play/leave.ts).

/// Whether leaving saves anything: answers to keep, or a decided round (the Timed minute can run out with nothing
/// answered).
public func leavesSomething(_ round: RoundState) -> Bool {
    !round.answers.isEmpty || isDecided(round)
}

/// Before its deciding answer a round is kept as abandoned (history and `last` without a score, no record); after it,
/// it is recorded as its result would record it.
public func saveLeftRound(_ round: RoundState, _ store: LocalStore) {
    let ended = reduce(round, isDecided(round) ? .next : .abandon)
    store.save(applyResult(store.load(), summarise(ended)).progress)
}
