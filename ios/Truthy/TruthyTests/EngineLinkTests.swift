import Testing
import TruthyEngine

// The unit tests resolve engine symbols against the app (rule 7). createRng is not called by the app yet, so this
// links only if the app keeps every engine function.
@Suite struct EngineLinkTests {
    @Test func engineFunctionsAreReachableFromTheTests() {
        let rng = createRng(1)
        #expect(rng() * 4_294_967_296 == 2_693_262_067)
        #expect(MODE_TABLE.count == 4)
    }
}
