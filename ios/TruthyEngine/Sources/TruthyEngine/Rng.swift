// Seeded randomness for the engine (src/engine/rng.ts). The engine never draws from the system: a round gets
// one generator from its seed, so the same seed and the same events always give the same round on every platform.

/// Uniform in [0, 1).
public typealias Rng = () -> Double

/// mulberry32. The seed is taken as an unsigned 32-bit integer (`seed >>> 0`): -1 is 2^32 - 1, 1.9 is 1,
/// 2^32 + 1 is 1. `Math.imul` and `>>> 0` are UInt32 wrapping arithmetic.
public func createRng(_ seed: Double) -> Rng {
    var state = jsUint32(seed)
    return {
        state = state &+ 0x6d2b_79f5
        var t = state
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
        return Double(t ^ (t >> 14)) / 4_294_967_296
    }
}

/// Fisher-Yates from the end. Returns a new array; draws exactly items.count - 1 numbers (none for 0 or 1 item).
public func shuffle<T>(_ items: [T], _ rng: Rng) -> [T] {
    var result = items
    var i = result.count - 1
    while i > 0 {
        let j = Int((rng() * Double(i + 1)).rounded(.down))
        result.swapAt(i, j)
        i -= 1
    }
    return result
}
