// JavaScript number operations the copy and geometry ports need, beyond task 1's jsRound and jsUint32.

/// Number.prototype.toString(10), as ECMAScript defines it: the shortest digits that read back as x; no point for an
/// integer; "-0" is "0"; plain notation from 1e-6 up to 1e21, an exponent ("1e-7", "1.5e+21") outside.
func jsNumberString(_ x: Double) -> String {
    if x.isNaN { return "NaN" }
    if x.isInfinite { return x < 0 ? "-Infinity" : "Infinity" }
    if x == 0 { return "0" }
    let sign = x < 0 ? "-" : ""
    // Swift's description already holds the shortest round-trip digits; read them and the decimal exponent.
    var text = abs(x).description
    var exponent = 0
    if let e = text.firstIndex(where: { $0 == "e" || $0 == "E" }) {
        exponent = Int(text[text.index(after: e)...]) ?? 0
        text = String(text[..<e])
    }
    let parts = text.split(separator: ".", omittingEmptySubsequences: false)
    let whole = String(parts[0])
    let fraction = parts.count > 1 ? String(parts[1]) : ""
    var digits = whole + fraction
    var point = whole.count + exponent  // the value is 0.digits times 10^point
    while digits.hasPrefix("0") && digits.count > 1 {
        digits.removeFirst()
        point -= 1
    }
    while digits.hasSuffix("0") && digits.count > 1 { digits.removeLast() }
    let k = digits.count
    let n = point
    if k <= n && n <= 21 { return sign + digits + String(repeating: "0", count: n - k) }
    if 0 < n && n <= 21 { return sign + String(digits.prefix(n)) + "." + String(digits.dropFirst(n)) }
    if -6 < n && n <= 0 { return sign + "0." + String(repeating: "0", count: -n) + digits }
    let e = n - 1
    let mantissa = k == 1 ? digits : String(digits.prefix(1)) + "." + String(digits.dropFirst())
    return sign + mantissa + "e" + (e < 0 ? "-" : "+") + String(abs(e))
}

/// Math.max: NaN if either is NaN, and +0 above -0.
func jsMathMax(_ a: Double, _ b: Double) -> Double {
    if a.isNaN || b.isNaN { return .nan }
    if a == 0 && b == 0 { return a.sign == .minus && b.sign == .minus ? -0.0 : 0 }
    return a > b ? a : b
}

/// Math.min: NaN if either is NaN, and -0 below +0.
func jsMathMin(_ a: Double, _ b: Double) -> Double {
    if a.isNaN || b.isNaN { return .nan }
    if a == 0 && b == 0 { return a.sign == .minus || b.sign == .minus ? -0.0 : 0 }
    return a < b ? a : b
}

func round1(_ value: Double) -> Double { jsRound(value * 10) / 10 }
func round2(_ value: Double) -> Double { jsRound(value * 100) / 100 }
