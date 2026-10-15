// components/format.ts

/// A number as two digits: "07", "14". Longer numbers stay as they are (`String(n).padStart(2, "0")`).
public func pad2(_ n: Int) -> String {
    let text = String(n)
    let length = text.utf16.count
    return length >= 2 ? text : String(repeating: "0", count: 2 - length) + text
}
