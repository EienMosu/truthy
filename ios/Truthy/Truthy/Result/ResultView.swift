import SwiftUI

// A stand-in until task 14 writes the result: the round screen already shows it once the round is finished.
struct ResultView: View {
    let model: AppModel
    let coordinator: RoundCoordinator

    var body: some View {
        Text("Round complete").accessibilityAddTraits(.isHeader)
    }
}
