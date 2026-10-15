package com.eienmosu.truthy.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// Spec 4.2, as tests/purity.test.ts does for the web: the engine reaches for no clock, no randomness, no timer,
// coroutine or scheduler, no file or preference storage and no Android or UI import. Time and seeds always come
// in as arguments. The patterns read the code with its comments removed; string literals stay, as on the web.

private val FORBIDDEN: List<Pair<String, Regex>> = listOf(
    "the wall clock" to Regex("""\bSystem\.currentTimeMillis\b|\bjava\.time\b|\bjava\.util\.(?:Date|Calendar)\b|\bInstant\.now\b|\bClock\.System\b|\bkotlinx\.datetime\b"""),
    "a monotonic clock" to Regex("""\bSystem\.nanoTime\b|\bSystemClock\b|\bTimeSource\b|\bmeasureTime(?:Millis|NanoTime)?\b|\bkotlin\.time\b"""),
    "randomness" to Regex("""\bkotlin\.random\b|\bjava\.util\.Random\b|\b(?:Random|SecureRandom|ThreadLocalRandom|SplittableRandom)\b|\.shuffled?\(|\.random(?:OrNull)?\(|\bUUID\.randomUUID\b|\bMath\.random\b"""),
    "a timer, coroutine or scheduler" to Regex("""\bkotlinx\.coroutines\b|\bsuspend\s+fun\b|\bdelay\(|\b(?:Thread|Timer|TimerTask|Handler|Looper|Executors?|ScheduledExecutorService|Choreographer)\b"""),
    "storage" to Regex("""\bjava\.io\b|\bjava\.nio\b|\b(?:File|Files|Paths|SharedPreferences|DataStore|AtomicFile)\b|\bjava\.util\.prefs\b|\bokio\b"""),
    "an Android or UI import" to Regex("""(?m)^\s*import\s+(?:android|androidx|java\.awt|javax\.swing|javafx)\."""),
)

/** The code without its comments: line comments, block comments (nested, as Kotlin allows) and KDoc. */
internal fun withoutComments(source: String): String {
    val out = StringBuilder()
    var i = 0
    while (i < source.length) {
        val c = source[i]
        when {
            source.startsWith("\"\"\"", i) -> {
                val close = source.indexOf("\"\"\"", i + 3)
                val end = if (close < 0) source.length else close + 3
                out.append(source, i, end)
                i = end
            }
            c == '"' || c == '\'' -> {
                var j = i + 1
                while (j < source.length && source[j] != c && source[j] != '\n') {
                    if (source[j] == '\\') j++
                    j++
                }
                val end = minOf(j + 1, source.length)
                out.append(source, i, end)
                i = end
            }
            source.startsWith("//", i) -> {
                val newline = source.indexOf('\n', i)
                i = if (newline < 0) source.length else newline
            }
            source.startsWith("/*", i) -> {
                var depth = 0
                var j = i
                while (j < source.length) {
                    if (source.startsWith("/*", j)) {
                        depth++
                        j += 2
                    } else if (source.startsWith("*/", j)) {
                        depth--
                        j += 2
                        if (depth == 0) break
                    } else {
                        j++
                    }
                }
                out.append(' ')
                i = j
            }
            else -> {
                out.append(c)
                i++
            }
        }
    }
    return out.toString()
}

internal fun findings(file: String, source: String): List<String> {
    val code = withoutComments(source)
    return FORBIDDEN.filter { (_, pattern) -> pattern.containsMatchIn(code) }.map { (name, _) -> "$file uses $name" }
}

class PurityTest {
    @Test
    fun theScannerIgnoresCommentsAndKeepsStrings() {
        assertEquals(emptyList<String>(), findings("a.kt", "// never System.currentTimeMillis() here\nval a = 1 /* Random /* nested */ Thread */"))
        assertTrue(withoutComments("val url = \"https://example.com/x\"").contains("https://example.com/x"))
        assertEquals("val a = 1 \n", withoutComments("val a = 1 // Random\n"))
    }

    @Test
    fun theScannerFindsEachKindOfImpurity() {
        val planted = listOf(
            "import android.os.SystemClock",
            "import kotlinx.coroutines.delay",
            "val now = System.currentTimeMillis() + System.nanoTime()",
            "val pick = listOf(1, 2).shuffled() + Random.nextInt()",
            "suspend fun wait() = delay(100)",
            "val text = File(\"x\").readText()",
        ).joinToString("\n")
        assertEquals(
            listOf(
                "planted.kt uses the wall clock",
                "planted.kt uses a monotonic clock",
                "planted.kt uses randomness",
                "planted.kt uses a timer, coroutine or scheduler",
                "planted.kt uses storage",
                "planted.kt uses an Android or UI import",
            ),
            findings("planted.kt", planted),
        )
    }

    @Test
    fun theScannerAcceptsTheEngineOwnNames() {
        val code = "val rng = createRng(seed)\nval order = shuffle(items, rng)\nval deck: DeckFile = load()\nval clock = Clock(60000.0, null, false, 0.0)"
        assertEquals(emptyList<String>(), findings("ok.kt", code))
    }

    @Test
    fun theEngineIsPure() {
        val files = Golden.sourcesDirectory.walkTopDown().filter { it.isFile && it.extension == "kt" }.sortedBy { it.name }.toList()
        assertTrue("found only ${files.size} engine files", files.size >= 7)
        val found = files.flatMap { findings(it.name, it.readText()) }
        assertEquals(emptyList<String>(), found)
    }

    @Test
    fun theEngineModuleDependsOnNothingButKotlinxSerialization() {
        val build = Golden.engineDirectory.resolve("build.gradle.kts").readText()
        val dependencies = Regex("""(?m)^\s*(\w+)\((.+)\)\s*$""").findAll(build.substringAfter("dependencies {").substringBefore("}"))
            .map { it.groupValues[1] + " " + it.groupValues[2] }
            .toList()
        assertEquals(
            listOf("implementation libs.kotlinx.serialization.json", "testImplementation libs.junit", "testImplementation libs.kotlin.test.junit"),
            dependencies,
        )
        assertTrue(!build.contains("com.android") && !build.contains("android {"))
    }
}
