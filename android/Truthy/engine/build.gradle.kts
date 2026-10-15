// :engine, the pure Kotlin port of the web's engine (reference 3.9). No Android, no clock, no randomness,
// no storage: PurityTest fails otherwise. Its tests read the golden vectors of native-data/golden.
import org.gradle.api.tasks.testing.logging.TestExceptionFormat
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.kotlinx.serialization.json)
    testImplementation(libs.junit)
    testImplementation(libs.kotlin.test.junit)
}

// native-data sits two folders above this Gradle project (android/Truthy). Its place is computed here, at
// build time, and handed to the tests as system properties; no committed file holds a path.
val nativeData: File = rootDir.resolve("../../native-data").canonicalFile

tasks.test {
    useJUnit()
    val golden = nativeData.resolve("golden")
    val decks = nativeData.resolve("decks")
    inputs.dir(golden).withPropertyName("golden").withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir(decks).withPropertyName("decks").withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.file(nativeData.resolve("manifest.json")).withPropertyName("manifest").withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.dir("src").withPropertyName("sources").withPathSensitivity(PathSensitivity.RELATIVE)
    systemProperty("truthy.golden", golden.path)
    systemProperty("truthy.decks", decks.path)
    systemProperty("truthy.engine", projectDir.path)
    testLogging {
        events("failed", "skipped")
        exceptionFormat = TestExceptionFormat.FULL
    }
    addTestListener(
        object : TestListener {
            override fun beforeSuite(suite: TestDescriptor) {}

            override fun beforeTest(testDescriptor: TestDescriptor) {}

            override fun afterTest(testDescriptor: TestDescriptor, result: TestResult) {}

            override fun afterSuite(suite: TestDescriptor, result: TestResult) {
                if (suite.parent == null) {
                    println(
                        "Engine tests: ${result.resultType}, ${result.testCount} run, ${result.successfulTestCount} passed, " +
                            "${result.failedTestCount} failed, ${result.skippedTestCount} skipped",
                    )
                }
            }
        },
    )
}
