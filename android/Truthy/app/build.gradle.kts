import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    // Task 9 decodes the deck files and writes the round journal with kotlinx.serialization in main code.
    alias(libs.plugins.kotlin.serialization)
}

// The repository root is two levels above this Gradle project (android/Truthy). Both paths are computed when the
// build runs and are never written into a committed file (spec 4.1, repository hygiene).
val repoRoot: File = rootDir.resolve("../..").canonicalFile
val deckAssets: File = repoRoot.resolve("native-data/decks")
check(deckAssets.resolve("index.json").isFile) {
    "native-data/decks/index.json is missing: run plan A's export (pnpm export:native) first"
}

android {
    namespace = "com.eienmosu.truthy"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.eienmosu.truthy"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            // The 54 decks and the index, referenced in place (spec 4.1, D3): the asset root holds index.json and
            // <deckId>.json. src/main/assets stays a source as well, for licenses/OFL.txt.
            assets.directories.add(deckAssets.path)
        }
    }
}

// The unit tests read source files (resources, the manifest, the fonts) and native-data/tokens/resolved.json.
tasks.withType<Test>().configureEach {
    systemProperty("truthy.repo", repoRoot.path)
    // The icon and logo tests compare the Kotlin path data with the web's source files (task 10).
    inputs.files(
        rootDir.resolve("../../components/icons.tsx"),
        rootDir.resolve("../../components/Logo.tsx"),
    )
}

dependencies {
    implementation(libs.lifecycle.viewmodel)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.kotlin.test.junit)
    implementation(project(":engine"))
    // :engine keeps kotlinx-serialization-json as an implementation dependency, which is not on :app's compile
    // classpath; the app's own JSON code (DeckStore, RoundJournal, task 9) needs it there.
    implementation(libs.kotlinx.serialization.json)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)

    testImplementation(libs.junit)

    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
