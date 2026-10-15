package com.eienmosu.truthy.engine

import org.junit.Assert.assertEquals
import org.junit.Test

// native-data/golden vectors of src/engine/rng.ts. Numbers compare exactly (List<Double> equality is bitwise).
class RngGoldenTest {
    @Test
    fun createRngMatchesTheWeb() {
        val golden = Golden.load("src/engine/rng", "createRng")
        for (case in golden.cases) {
            val seed = golden.decode<Double>(case.arg("seed")!!)
            val expected = golden.decode<List<Double>>(case.output)
            val rng = createRng(seed)
            assertEquals(case.name, expected, expected.map { rng() })
        }
    }

    @Test
    fun shuffleMatchesTheWeb() {
        val golden = Golden.load("src/engine/rng", "shuffle")
        for (case in golden.cases) {
            val items = golden.decode<List<String>>(case.arg("items")!!)
            val rng = golden.rng(case.arg("rng")!!)
            assertEquals(case.name, golden.decode<List<String>>(case.output), shuffle(items, rng))
        }
    }
}
