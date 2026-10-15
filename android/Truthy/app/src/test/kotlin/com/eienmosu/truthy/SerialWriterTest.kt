package com.eienmosu.truthy

import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.yield
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class SerialWriterTest {
    @Test
    fun jobsRunOneAfterAnotherInTheOrderTheyCame() = runTest {
        val writer = SerialWriter(backgroundScope)
        val log = mutableListOf<String>()
        writer.submit {
            log += "a1"
            yield()
            log += "a2"
        }
        writer.submit { log += "b" }
        assertEquals("c", writer.run { log += "c"; "c" })
        assertEquals(listOf("a1", "a2", "b", "c"), log)
    }

    @Test
    fun aFailingJobDoesNotStopTheWriter() = runTest {
        val writer = SerialWriter(backgroundScope)
        writer.submit { throw IllegalStateException("the disk is full") }
        assertEquals(2, writer.run { 2 })
    }

    @Test
    fun runThrowsTheFailureOfItsOwnBlockOnly() = runTest {
        val writer = SerialWriter(backgroundScope)
        assertFailsWith<IllegalStateException> { writer.run<Int> { throw IllegalStateException("refused") } }
        assertEquals(3, writer.run { 3 })
    }
}
