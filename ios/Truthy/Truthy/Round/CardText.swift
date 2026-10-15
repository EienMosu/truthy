import SwiftUI
import TruthyEngine

// Card text with its code parts in the mono face at 0.92 of the size, backticks stripped (CardText.tsx), read by
// VoiceOver as task 5's plainText: one element whose label is the whole text.

struct CardTextView: View {
    let text: String
    let style: TypeStyle

    var body: some View {
        textParts(text).reduce(Text("")) { line, part in
            line + (part.code
                ? Text(part.text).font(.custom("OverpassMono-SemiBold", size: style.size * 0.92, relativeTo: style.textStyle))
                : Text(part.text))
        }
        .typeRole(style)
        .fixedSize(horizontal: false, vertical: true)
        .wholeWords(plainText(text), style)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(plainText(text))
    }
}
