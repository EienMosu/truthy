// JavaScript number operations the TypeScript engine relies on, written out so a port gives the same bits.
// Internal: every engine file uses them, and the tests reach them with @testable import.

/// `x >>> 0`: ToUint32. Truncates toward zero and wraps modulo 2^32; NaN and the infinities give 0.
func jsUint32(_ x: Double) -> UInt32 {
    guard x.isFinite else { return 0 }
    let wrapped = x.rounded(.towardZero).truncatingRemainder(dividingBy: 4_294_967_296)
    return UInt32(wrapped < 0 ? wrapped + 4_294_967_296 : wrapped)
}

/// `Math.round(x)`: the nearest integer, a half rounding toward +infinity, -0 for x in [-0.5, -0].
/// `(x + 0.5).rounded(.down)` is wrong where x + 0.5 is not exact (0.49999999999999994, odd numbers above 2^52);
/// the fraction `x - floor(x)` is always exact, so the comparison is too.
func jsRound(_ x: Double) -> Double {
    guard x.isFinite else { return x }
    let floor = x.rounded(.down)
    let result = x - floor >= 0.5 ? floor + 1 : floor
    return result == 0 && x.sign == .minus ? -0.0 : result
}
