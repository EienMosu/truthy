### Task 7: The `:app` module: manifest, activity, the deck assets, fonts and the OFL, the adaptive icon, the splash, edge to edge and the backup rules

This task creates the Compose application module that every later task of this plan fills. When it ends, `android/Truthy/app` builds a debug APK that holds the 54 decks and the index straight from `native-data/decks` (an assets source directory, nothing copied, spec 4.1 and D3), the four static Overpass cuts with their licence, an adaptive launcher icon composed like the web's installed icons, a splash screen in `color-surface` of the system appearance, and backup and data extraction rules that keep progress and the theme across a reinstall but never the round journal (spec 4.5). The one activity installs the splash, goes edge to edge with transparent bars whose icon colours follow the theme and without an enforced navigation bar contrast scrim (spec 5.6, The Slow Wire's trap), and shows an empty root that later tasks fill. It launches on the API 36 emulator, checked by five instrumented tests.

There is no game on screen yet: the root is an empty `Box`, so the window background (the surface colour) is all the player sees. Task 8 adds the tokens, the stored theme and the type roles; task 11 swaps the two top-level screens inside `TruthyRoot`.

Everything this task can check without a device is pinned by JVM unit tests that read the source files: the resource colours against `native-data/tokens/resolved.json`, the launcher mark against the web's `app/icon.svg`, the backup rules against the file names the stores will use, the font files' weights, names and character coverage, and the manifest's attributes. They run in `:app:testDebugUnitTest` with no Android framework (no Robolectric: the plan allows no dependency outside AndroidX, Kotlin and kotlinx).

**Not compiled during drafting.** Apart from the font pipeline of step 12, nothing in this file was compiled or run while the plan was written. After the review, tasks 1 to 15 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: the JVM tests and, on the API 36 emulator, the instrumented tests. The defects that run found are fixed in this file (README, Drafting record). The API signatures were checked against the current reference pages, which were those of AGP 9.4 while task 1 pins 9.3.3 (AGP 9.4 `AndroidSourceDirectorySet` and `CompileSdkSpec`; step 3 checks them against 9.3 before the first build; `androidx.activity` `enableEdgeToEdge` and `SystemBarStyle.auto`, the AndroidX splash screen guide, the activity library's `EdgeToEdge.kt` source). The font pipeline's input and output hashes are the measured ones. If a step's output differs from the stated one, stop and find out why before going on.

Builds on: tasks 1 to 6. Task 1 created the Gradle project `android/Truthy` (`settings.gradle.kts`, the root `build.gradle.kts`, `gradle/libs.versions.toml`, `gradle.properties`, the wrapper, `.gitignore`) and the `:engine` module, with a working JDK 17 or later; tasks 2 to 6 completed the engine. Plan A is complete: `native-data/decks` holds `index.json` and the 54 deck files, and `native-data/tokens/resolved.json` exists.

**Files:**
- Modify: `android/Truthy/settings.gradle.kts`, `android/Truthy/build.gradle.kts`, `android/Truthy/gradle.properties` (only if a line is missing, step 2)
- Create: `android/Truthy/app/build.gradle.kts`, `android/Truthy/app/.gitignore`
- Create: `android/Truthy/app/src/main/AndroidManifest.xml`
- Create: `android/Truthy/app/src/main/java/com/eienmosu/truthy/MainActivity.kt`, `SystemBars.kt`, `TruthyRoot.kt`, `StorageNames.kt` (all in `android/Truthy/app/src/main/java/com/eienmosu/truthy/`)
- Create: `android/Truthy/app/src/main/res/values/colors.xml`, `strings.xml`, `bools.xml`, `themes.xml`
- Create: `android/Truthy/app/src/main/res/values-night/colors.xml`, `bools.xml`, `themes.xml`
- Create: `android/Truthy/app/src/main/res/drawable/ic_launcher_foreground.xml`, `android/Truthy/app/src/main/res/mipmap-anydpi/ic_launcher.xml`
- Create: `android/Truthy/app/src/main/res/xml/backup_rules.xml`, `android/Truthy/app/src/main/res/xml/data_extraction_rules.xml`
- Create (binary, built in step 12): `android/Truthy/app/src/main/res/font/overpass_600.ttf`, `overpass_800.ttf`, `overpass_mono_400.ttf`, `overpass_mono_600.ttf`
- Create (copy of `app/fonts/OFL.txt`): `android/Truthy/app/src/main/assets/licenses/OFL.txt`
- Test (JVM, `android/Truthy/app/src/test/java/com/eienmosu/truthy/`): `RepoFiles.kt` (support), `TrueType.kt` (support), `LauncherIconTest.kt`, `ResourceValuesTest.kt`, `BackupRulesTest.kt`, `FontFilesTest.kt`, `LicenseTest.kt`, `ManifestTest.kt`
- Test (instrumented, `android/Truthy/app/src/androidTest/java/com/eienmosu/truthy/`): `AppLaunchTest.kt`

**Interfaces:**
- Consumes:
  - From task 1: the Gradle project at `android/Truthy` with `include(":engine")` in `settings.gradle.kts`; in `gradle/libs.versions.toml` the versions `agp` and `kotlin` and the library alias `kotlinx-serialization-json` (`org.jetbrains.kotlinx:kotlinx-serialization-json`); the `:engine` module, a Kotlin JVM module compiled for JVM 17. No engine function is called yet: `:app` only depends on `:engine`.
  - From plan A: `native-data/decks/index.json` and `native-data/decks/<deckId>.json` (54 files); `native-data/tokens/resolved.json` (tokens.json with the overrides applied: a colour role is `color.<day|night>.<role>.$value`, either an alias string such as `"{color.primitive.sky-100}"` or an object with a `hex` field).
  - From the web: `app/icon.svg` (the mark: three paths, the ticket filled in accent, the tear line `M33 5v20` dashed `2.5 3` and the check stroked in on-accent), `app/fonts/OFL.txt`.
- Produces (in `com.eienmosu.truthy`, the README's names where it has them, the rest named here for later tasks):

```kotlin
// MainActivity.kt: the only activity. installSplashScreen() before super.onCreate, then applySystemBars, then setContent { TruthyRoot() }.
class MainActivity : ComponentActivity()

// SystemBars.kt
fun Configuration.isNightMode(): Boolean                    // uiMode night bits are UI_MODE_NIGHT_YES
fun ComponentActivity.applySystemBars(dark: Boolean)        // enableEdgeToEdge with transparent bars, icons light when dark; no enforced nav bar contrast

// TruthyRoot.kt
const val ROOT_TAG = "truthy.root"
@Composable fun TruthyRoot()                                // the activity's only content: an empty full-size Box tagged ROOT_TAG

// StorageNames.kt: the file names the stores of task 9 must use, shared with res/xml backup rules
object StorageNames {
    const val PROGRESS_FILE = "truthy.progress.v1.json"             // filesDir, backed up
    const val UNREADABLE_FILE = "truthy.progress.v1.unreadable.json" // filesDir, not backed up
    const val JOURNAL_FILE = "truthy.round.v1.json"                  // filesDir, never backed up
    const val PREFS_FILE = "truthy"                                  // getSharedPreferences(PREFS_FILE, MODE_PRIVATE): truthy.xml, holds "truthy.theme", backed up
}
```

  - Resources: `@string/app_name` ("Truthy"); `@color/truthy_surface` (day and night); `@color/truthy_icon_background` (day `sky-1` in every theme); `@bool/truthy_light_bars` (true by day, false at night); `@style/Base.Theme.Truthy` (platform Material light by day, dark at night), `@style/Theme.Truthy` (the post-splash theme), `@style/Theme.Truthy.Starting` (the launch theme on the application); `@drawable/ic_launcher_foreground`, `@mipmap/ic_launcher`; `R.font.overpass_600`, `R.font.overpass_800`, `R.font.overpass_mono_400`, `R.font.overpass_mono_600`; `@xml/backup_rules`, `@xml/data_extraction_rules`.
  - Assets: the asset root holds `index.json` and `<deckId>.json` for every deck (the files of `native-data/decks`, so `DeckStore` of task 9 opens `"index.json"` and `"$id.json"`), and `licenses/OFL.txt`.
  - Test support for later tasks (in the `:app` unit test source set): the system property `truthy.repo` (the repository root, set on every `:app` test task from the Gradle project directory, never written in a committed file), `RepoFiles` (`root`, `main`, `resDir`, `xml(file)`, `resource(path)`, `tokenColor(path)`), `ANDROID_NS`, the DOM helpers `Document.elements`, `Element.childElements`, `Element.android`, `Document.value`, `Document.style` and `Style`, and `TrueType` (`tables`, `weightClass`, `names()`, `covers(codePoint)`).

**Rules:**

1. **Assets in place.** `native-data/decks` is added to the `main` source set's assets with `assets.directories.add(...)` (AGP 9.4 deprecates `srcDir` in favour of the `directories` set; step 3 checks that AGP 9.3.3, task 1's pin, already has `directories`, and falls back to `srcDir` if not). The path is computed at build time from `rootDir` (the Gradle project, two levels below the repository root), so no absolute path is written into a committed file. The build fails at configuration with a clear message when `native-data/decks/index.json` is missing. The default `src/main/assets` stays, for `licenses/OFL.txt`.
2. **Launcher icon** (spec 5.6, reference 7.1 "an app icon composed like `app/apple-icon.png` and `public/icon-512.png`"). The web icons put the ticket of `app/icon.svg` (44 by 30 units) at 60 percent of the icon's width, centred, on an opaque `sky-1` square (measured in `public/icon-512.png`: the ticket spans x 103 to 409 of 512, 0.5996 of the width, centred at 256, 256). An adaptive icon shows at most the centre 72 by 72 of its 108 by 108 canvas, so that 72 square plays the web icon's square: the ticket is 0.6 x 72 = 43.2 wide (scale 43.2 / 44 = 0.9818182), centred at 54, 54 (translate 32.4, 39.272727). Its corners are 26.1 from the centre, inside the 33 radius safe zone. The background layer is `@color/truthy_icon_background` (day `sky-1`, `#a9d6f0`, also at night, as the web's icons are). There is no monochrome layer (spec 3 lists a designed one as suggested, not requested).
3. **The tear line without dashes.** VectorDrawable cannot dash a stroke (reference 5.6). The icon draws the dashed tear line as the four segments the SVG dash pattern gives along `M33 5v20` with dash 2.5 and gap 3: `M33 5v2.5M33 10.5v2.5M33 16v2.5M33 21.5v2.5`, each with round caps, exactly as the SVG renders each dash. A test derives this from `app/icon.svg`.
4. **Splash and window background** (spec 5.6, Launch). `Theme.Truthy.Starting` (parent `Theme.SplashScreen`) is the application's theme: background `@color/truthy_surface`, icon `@drawable/ic_launcher_foreground` (the mark alone on the surface, no icon background), then `postSplashScreenTheme` `Theme.Truthy`, whose `android:windowBackground` is the same surface colour, so there is no white frame between the splash and the first Compose frame. `truthy_surface` has a night value in `values-night`, so the splash follows the system appearance; on Android 12 and later, once task 8 or 11 hands the stored theme to `UiModeManager.setApplicationNightMode`, the `-night` resources (surface, bar flags, base theme) follow the stored theme instead, with no change to these files.
5. **Bar icons for the first frame.** Both themes set `android:windowLightStatusBar` and `android:windowLightNavigationBar` (the latter with `tools:targetApi="27"`; API 26 ignores it) to `@bool/truthy_light_bars`: dark icons on the day surface, light icons at night (spec 5.6, System bars). After `onCreate`, `applySystemBars(dark)` sets the same through `enableEdgeToEdge`.
6. **Edge to edge.** `applySystemBars(dark)` calls `enableEdgeToEdge` with `SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { dark }` for both bars, so the icon colours come from the app's theme, never from the system's (`detectDarkMode` returns `dark`). `SystemBarStyle.auto` makes the activity library set `isNavigationBarContrastEnforced = true` on API 29 and later (`EdgeToEdge.kt`, `EdgeToEdgeApi29` and `EdgeToEdgeApi35`), which draws a translucent scrim behind three-button navigation; `applySystemBars` sets it back to false afterwards. In this task the activity passes the system's night mode; task 8 (or 11) passes the resolved app theme instead and calls `applySystemBars` again whenever the theme changes.
7. **No AppCompat.** The themes descend from the platform `android:Theme.Material.Light.NoActionBar` (day) and `android:Theme.Material.NoActionBar` (night) through `Base.Theme.Truthy`; Compose draws everything else.
8. **Predictive back** is opted into with `android:enableOnBackInvokedCallback="true"` on the application (spec 5.1). No handler exists yet, so back on this task's empty screen leaves to the launcher with the system animation.
9. **Backup rules** (spec 4.5, reference 6 "Backups"). `android:allowBackup="true"`; `android:fullBackupContent="@xml/backup_rules"` for Android 8 to 11 and `android:dataExtractionRules="@xml/data_extraction_rules"` for Android 12 and later (cloud backup and device transfer alike). Each lists exactly two includes: `file` `truthy.progress.v1.json` and `sharedpref` `truthy.xml`. With an include list, nothing else is backed up, so the round journal is excluded by not being listed (lint's `FullBackupContent` check reports an `<exclude>` outside every included path, so none is written). The unreadable side copy is also left out: it only matters on the device whose progress failed to read. `AtomicFile`'s transient `.new` and `.bak` files are never backed up either, which matters because `AtomicFile` restores a leftover legacy backup file over the base file when it reads.
10. **Fonts.** The four static cuts are instanced from the Google Fonts variable files of Overpass and Overpass Mono (reference 5.2 allows this; their OFL text is byte for byte `app/fonts/OFL.txt`, "Copyright 2021 The Overpass Project Authors"), pinned to google/fonts commit `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5` and fontTools 4.67.0. The name record 19 (a sample text that contains an em dash) is removed; every other name record is printable ASCII with no e-mail-shaped text. Each cut covers the characters of reference 2.2 (U+2022, U+00A7, U+2013, U+2018 to U+201D, U+00E9, U+00C9, U+2190 to U+2193, U+00B7). File names are `overpass_600.ttf`, `overpass_800.ttf`, `overpass_mono_400.ttf`, `overpass_mono_600.ttf` (reference 8.1). Task 8 builds the `FontFamily`s from them, requesting every weight explicitly.
11. **Permissions, orientation and configuration changes.** The manifest asks for no permission (Custom Tabs need none) and locks no orientation (spec 2, Orientation). The activity declares `android:configChanges="uiMode"`, so a change of the night mode (the stored theme handed to `UiModeManager.setApplicationNightMode`, tasks 8 and 11) reaches Compose as a configuration change instead of recreating the activity; a rotation still recreates it, and the view models keep the round. A later task that needs a permission or a `<queries>` element changes `ManifestTest` in the same commit and says why.
12. **Hygiene.** No PNG is added (the icon is a vector), so no PNG metadata can leak. No absolute path appears in any file: `rootDir` is resolved at build time. No Kotlin labelled `this` followed by a member access. No em dash in any file. Commits by EienMosu with the noreply address plan A configured.

- [ ] **Step 1: Check the starting point**

Run from the repository root:

```bash
git status --short
git log --oneline -1
ls native-data/decks | wc -l
test -f native-data/tokens/resolved.json && echo "resolved tokens present"
"$JAVA_HOME/bin/java" -version 2>&1 | head -1
echo "$ANDROID_HOME"
ls "$ANDROID_HOME/platforms"
"$ANDROID_HOME/emulator/emulator" -list-avds
cd android/Truthy && ./gradlew :engine:test
```

Expected: `git status --short` prints nothing; the last commit is task 6's; `55` (index plus 54 decks); `resolved tokens present`; a Java version of 17 or later (the JBR of task 1, through `JAVA_HOME`); `ANDROID_HOME` is set (task 1 set it up); the platforms list contains `android-37.0` (or `android-37`); the AVD list contains an API 36 image (on the owner's Mac `Pixel8_API36`, a `pixel_8` with `system-images;android-36;google_apis;arm64-v8a`); `BUILD SUCCESSFUL`. If there is no API 36 AVD, create one now with `"$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd -n Pixel8_API36 -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_8` (install the image first with `sdkmanager` if it is missing; on an Intel machine use `x86_64`). If the API 37 platform is missing, install it with `"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "platforms;android-37.0"`.

- [ ] **Step 2: Check the version catalog, include `:app` and declare its plugins**

`android/Truthy/gradle/libs.versions.toml` needs no change: task 1 wrote every alias this task uses (`androidx-compose-bom`, `androidx-compose-ui`, `androidx-compose-foundation`, `androidx-compose-ui-test-junit4`, `androidx-compose-ui-test-manifest`, `androidx-activity-compose`, `androidx-core-ktx`, `androidx-core-splashscreen`, `junit`, `androidx-test-ext-junit`, `androidx-test-runner`, `kotlinx-serialization-json`, and the plugins `android-application` and `kotlin-compose`). Check it, from the repository root:

```bash
for alias in androidx-compose-bom androidx-compose-ui androidx-compose-foundation androidx-compose-ui-test-junit4 androidx-compose-ui-test-manifest androidx-activity-compose androidx-core-ktx androidx-core-splashscreen junit androidx-test-ext-junit androidx-test-runner kotlinx-serialization-json android-application kotlin-compose; do grep -q "^$alias = " android/Truthy/gradle/libs.versions.toml || echo "MISSING $alias"; done
```

Expected: no output. If an alias is missing, task 1's catalog is not in place: stop. Do not add a second alias for a module the catalog already has (the JUnit 4 alias is task 1's `junit`, not `junit4`).

In `android/Truthy/settings.gradle.kts`, add `include(":app")` on the line after `include(":engine")`. Check that both `pluginManagement { repositories { ... } }` and `dependencyResolutionManagement { repositories { ... } }` list `google()` (the Android Gradle plugin and every AndroidX artifact come from it); add `google()` as the first entry of either block that lacks it.

In `android/Truthy/build.gradle.kts`, add these two lines inside the existing `plugins { }` block, next to task 1's `apply false` lines (declaring every plugin once at the root keeps them in one class loader):

```kotlin
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
```

In `android/Truthy/gradle.properties`, make sure the line `android.useAndroidX=true` is present; add it if it is not.

Nothing to run yet: `:app` has no build file, so Gradle would fail on the include. Step 3 adds it.

- [ ] **Step 3: Create the `:app` module skeleton and the unit test support**

Create `android/Truthy/app/build.gradle.kts`:

```kotlin
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
}

dependencies {
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
```

Before the first build, check that the AGP 9.3 DSL reference for `AndroidSourceDirectorySet` lists `directories` (task 1 pins AGP 9.3.3; this file was checked against the 9.4 reference). If it does not, write `assets.srcDir(deckAssets)` in its place (deprecated only from 9.4), and change rule 1 to say so. The same applies to `compileSdk { version = release(37) }`: if the 9.3 reference has no `CompileSdkSpec`, write `compileSdk = 37`.

Create `android/Truthy/app/.gitignore`:

```gitignore
/build
```

Create `android/Truthy/app/src/main/AndroidManifest.xml` (a placeholder until step 16):

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application />
</manifest>
```

Create `android/Truthy/app/src/test/java/com/eienmosu/truthy/RepoFiles.kt`:

```kotlin
package com.eienmosu.truthy

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.w3c.dom.Document
import org.w3c.dom.Element

const val ANDROID_NS = "http://schemas.android.com/apk/res/android"

/** Files of the repository, found through the truthy.repo system property that app/build.gradle.kts sets. */
object RepoFiles {
    val root: File = File(
        System.getProperty("truthy.repo") ?: error("truthy.repo is not set: run the tests through Gradle"),
    )
    val main: File = root.resolve("android/Truthy/app/src/main")
    val resDir: File = main.resolve("res")

    fun xml(file: File): Document {
        require(file.isFile) { "missing ${file.relativeTo(root)}" }
        val factory = DocumentBuilderFactory.newInstance()
        factory.isNamespaceAware = true
        return factory.newDocumentBuilder().parse(file)
    }

    /** A resource file by its path under res, for example "values/colors.xml". */
    fun resource(path: String): Document = xml(resDir.resolve(path))

    private val tokens: JsonObject by lazy {
        Json.parseToJsonElement(root.resolve("native-data/tokens/resolved.json").readText()).jsonObject
    }

    /** The hex value of a colour token, following aliases: tokenColor("color.day.surface") is "#c4e3f5". */
    fun tokenColor(path: String): String {
        var current = path
        repeat(8) {
            val value = node(current).jsonObject.getValue("\$value")
            if (value is JsonPrimitive && value.isString) {
                current = value.content.removePrefix("{").removeSuffix("}")
            } else {
                return value.jsonObject.getValue("hex").jsonPrimitive.content.lowercase()
            }
        }
        error("alias chain too long at $path")
    }

    private fun node(path: String): JsonElement =
        path.split('.').fold<String, JsonElement>(tokens) { element, key ->
            element.jsonObject[key] ?: error("no token at $path")
        }
}

fun Document.elements(tag: String): List<Element> {
    val nodes = getElementsByTagName(tag)
    return (0 until nodes.length).map { nodes.item(it) as Element }
}

fun Element.childElements(tag: String? = null): List<Element> {
    val nodes = childNodes
    return (0 until nodes.length)
        .map { nodes.item(it) }
        .filterIsInstance<Element>()
        .filter { tag == null || it.tagName == tag }
}

/** An android: attribute, or "" when it is absent. */
fun Element.android(name: String): String = getAttributeNS(ANDROID_NS, name)

/** The text of the resource of this kind and name in a values file, for example value("color", "truthy_surface"). */
fun Document.value(tag: String, name: String): String =
    elements(tag).single { it.getAttribute("name") == name }.textContent.trim()

data class Style(val parent: String, val items: Map<String, String>)

fun Document.style(name: String): Style {
    val element = elements("style").single { it.getAttribute("name") == name }
    return Style(
        parent = element.getAttribute("parent"),
        items = element.childElements("item").associate { it.getAttribute("name") to it.textContent.trim() },
    )
}
```

Run from `android/Truthy`:

```bash
./gradlew :app:assembleDebug :app:testDebugUnitTest
```

Expected: `BUILD SUCCESSFUL`. `:app:testDebugUnitTest` runs no test yet (there are no test classes, only support code). If the build stops with "Failed to find target", the API 37 platform is missing (step 1). If it stops on the `check` message, plan A's export has not run.

- [ ] **Step 4: Write the failing launcher icon test**

Create `android/Truthy/app/src/test/java/com/eienmosu/truthy/LauncherIconTest.kt`:

```kotlin
package com.eienmosu.truthy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The adaptive icon is the web's installed icon (spec 5.6, App icon): the app/icon.svg ticket at 60 percent of the
 *  visible square, centred, on day sky-1. */
class LauncherIconTest {
    private val svgPaths = RepoFiles.xml(RepoFiles.root.resolve("app/icon.svg")).elements("path")
    private val foreground = RepoFiles.resource("drawable/ic_launcher_foreground.xml")
    private val group = foreground.elements("group").single()
    private val paths = foreground.elements("path")

    @Test
    fun adaptiveIconHasTheSkyBackgroundAndTheMarkOnly() {
        val icon = RepoFiles.resource("mipmap-anydpi/ic_launcher.xml").documentElement
        assertEquals("adaptive-icon", icon.tagName)
        val layers = icon.childElements()
        assertEquals(listOf("background", "foreground"), layers.map { it.tagName })
        assertEquals("@color/truthy_icon_background", layers[0].android("drawable"))
        assertEquals("@drawable/ic_launcher_foreground", layers[1].android("drawable"))
    }

    @Test
    fun iconBackgroundIsDaySkyOneInEveryTheme() {
        assertEquals(
            RepoFiles.tokenColor("color.day.sky-1"),
            RepoFiles.resource("values/colors.xml").value("color", "truthy_icon_background").lowercase(),
        )
        val night = RepoFiles.resource("values-night/colors.xml").elements("color")
        assertTrue(night.none { it.getAttribute("name") == "truthy_icon_background" })
    }

    @Test
    fun markIsSixtyPercentOfTheVisibleSquareAndCentred() {
        val root = foreground.documentElement
        assertEquals("108dp", root.android("width"))
        assertEquals("108dp", root.android("height"))
        assertEquals("108", root.android("viewportWidth"))
        assertEquals("108", root.android("viewportHeight"))
        assertEquals(group.android("scaleX"), group.android("scaleY"))
        val scale = group.android("scaleX").toDouble()
        // The ticket path of app/icon.svg spans x 0 to 44 and y 0 to 30. An adaptive icon shows the centre 72 of 108.
        val ticketWidth = 44.0
        val ticketHeight = 30.0
        assertEquals(0.6 * 72.0, ticketWidth * scale, 1e-4)
        assertEquals(54.0, group.android("translateX").toDouble() + scale * ticketWidth / 2, 1e-4)
        assertEquals(54.0, group.android("translateY").toDouble() + scale * ticketHeight / 2, 1e-4)
    }

    @Test
    fun pathsAreTheWebMark() {
        assertEquals(3, svgPaths.size)
        assertEquals(3, paths.size)
        assertEquals("M33 5v2.5M33 10.5v2.5M33 16v2.5M33 21.5v2.5", dashed("M33 5v20", "2.5 3"))
        assertEquals(svgPaths[0].getAttribute("d"), paths[0].android("pathData"))
        assertEquals(
            dashed(svgPaths[1].getAttribute("d"), svgPaths[1].getAttribute("stroke-dasharray")),
            paths[1].android("pathData"),
        )
        assertEquals(svgPaths[2].getAttribute("d"), paths[2].android("pathData"))
    }

    @Test
    fun coloursAndStrokesMatchTheWebMark() {
        assertEquals(RepoFiles.tokenColor("color.day.accent"), paths[0].android("fillColor").lowercase())
        assertEquals(svgPaths[0].getAttribute("fill").lowercase(), paths[0].android("fillColor").lowercase())
        assertEquals("", paths[0].android("strokeColor"))
        for (i in 1..2) {
            assertEquals(RepoFiles.tokenColor("color.day.on-accent"), paths[i].android("strokeColor").lowercase())
            assertEquals(svgPaths[i].getAttribute("stroke").lowercase(), paths[i].android("strokeColor").lowercase())
            assertEquals(svgPaths[i].getAttribute("stroke-width"), paths[i].android("strokeWidth"))
            assertEquals(svgPaths[i].getAttribute("stroke-linecap"), paths[i].android("strokeLineCap"))
            assertEquals("", paths[i].android("fillColor"))
        }
        assertEquals("", paths[1].android("strokeLineJoin"))
        assertEquals(svgPaths[2].getAttribute("stroke-linejoin"), paths[2].android("strokeLineJoin"))
    }

    /** The segments an SVG dash pattern draws along a vertical line "Mx yvLength", starting with a dash. */
    private fun dashed(d: String, dashArray: String): String {
        val match = Regex("""M(\S+) (\S+)v(\S+)""").matchEntire(d) ?: error("not a vertical line: $d")
        val (x, y, length) = match.destructured.toList().map(String::toDouble)
        val (dash, gap) = dashArray.split(' ').map(String::toDouble)
        return buildString {
            var at = 0.0
            while (at < length) {
                append("M${number(x)} ${number(y + at)}v${number(minOf(dash, length - at))}")
                at += dash + gap
            }
        }
    }

    private fun number(value: Double): String =
        if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()
}
```

Run from `android/Truthy`:

```bash
./gradlew :app:testDebugUnitTest --tests com.eienmosu.truthy.LauncherIconTest
```

Expected: FAIL, `5 tests completed, 5 failed`, each with `IllegalArgumentException: missing android/Truthy/app/src/main/res/drawable/ic_launcher_foreground.xml` (the class's properties read the file).

- [ ] **Step 5: Add the colours and the launcher icon**

Create `android/Truthy/app/src/main/res/values/colors.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- color.day.surface (reference 5.1): the window and splash background, so launch shows no white frame. -->
    <color name="truthy_surface">#c4e3f5</color>
    <!-- color.day.sky-1: the launcher icon's square, day in every theme like the web's installed icons. -->
    <color name="truthy_icon_background">#a9d6f0</color>
</resources>
```

Create `android/Truthy/app/src/main/res/values-night/colors.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- color.night.surface (reference 5.1). -->
    <color name="truthy_surface">#101c33</color>
</resources>
```

Create `android/Truthy/app/src/main/res/drawable/ic_launcher_foreground.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- The mark of app/icon.svg: the ticket 43.2 wide (60 percent of the 72 visible), centred at 54, 54.
     VectorDrawable cannot dash, so the tear line is drawn as the four dashes of "2.5 3" along M33 5v20. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <group
        android:scaleX="0.9818182"
        android:scaleY="0.9818182"
        android:translateX="32.4"
        android:translateY="39.272727">
        <path
            android:fillColor="#f5b400"
            android:pathData="M6 0H38A6 6 0 0 1 44 6V10.5A4.5 4.5 0 0 0 44 19.5V24A6 6 0 0 1 38 30H6A6 6 0 0 1 0 24V19.5A4.5 4.5 0 0 0 0 10.5V6A6 6 0 0 1 6 0Z" />
        <path
            android:strokeColor="#10233f"
            android:strokeWidth="1.6"
            android:strokeLineCap="round"
            android:pathData="M33 5v2.5M33 10.5v2.5M33 16v2.5M33 21.5v2.5" />
        <path
            android:strokeColor="#10233f"
            android:strokeWidth="3"
            android:strokeLineCap="round"
            android:strokeLineJoin="round"
            android:pathData="M9 15.5l4.5 4.5 9-10" />
    </group>
</vector>
```

Create `android/Truthy/app/src/main/res/mipmap-anydpi/ic_launcher.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/truthy_icon_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
```

Run from `android/Truthy`:

```bash
./gradlew :app:testDebugUnitTest --tests com.eienmosu.truthy.LauncherIconTest
```

Expected: `BUILD SUCCESSFUL`; `grep -o '<testcase ' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.LauncherIconTest.xml | wc -l` prints `5`, and the file has `failures="0" errors="0"`.

- [ ] **Step 6: Write the failing resource values test**

Create `android/Truthy/app/src/test/java/com/eienmosu/truthy/ResourceValuesTest.kt`:

```kotlin
package com.eienmosu.truthy

import org.junit.Assert.assertEquals
import org.junit.Test

/** The name, the surface colour, the bar icon flags and the themes the splash and the first frame use (spec 5.6). */
class ResourceValuesTest {
    @Test
    fun appNameIsTruthy() {
        // Reference 4.5, App: the name "Truthy".
        assertEquals("Truthy", RepoFiles.resource("values/strings.xml").value("string", "app_name"))
    }

    @Test
    fun surfaceFollowsTheTokensByDayAndNight() {
        assertEquals(
            RepoFiles.tokenColor("color.day.surface"),
            RepoFiles.resource("values/colors.xml").value("color", "truthy_surface").lowercase(),
        )
        assertEquals(
            RepoFiles.tokenColor("color.night.surface"),
            RepoFiles.resource("values-night/colors.xml").value("color", "truthy_surface").lowercase(),
        )
    }

    @Test
    fun barIconsAreDarkByDayAndLightByNight() {
        assertEquals("true", RepoFiles.resource("values/bools.xml").value("bool", "truthy_light_bars"))
        assertEquals("false", RepoFiles.resource("values-night/bools.xml").value("bool", "truthy_light_bars"))
    }

    @Test
    fun windowAndSplashUseTheSurface() {
        val themes = RepoFiles.resource("values/themes.xml")
        val app = themes.style("Theme.Truthy")
        assertEquals("Base.Theme.Truthy", app.parent)
        assertEquals(
            mapOf(
                "android:windowBackground" to "@color/truthy_surface",
                "android:windowLightStatusBar" to "@bool/truthy_light_bars",
                "android:windowLightNavigationBar" to "@bool/truthy_light_bars",
            ),
            app.items,
        )
        val starting = themes.style("Theme.Truthy.Starting")
        assertEquals("Theme.SplashScreen", starting.parent)
        assertEquals(
            mapOf(
                "windowSplashScreenBackground" to "@color/truthy_surface",
                "windowSplashScreenAnimatedIcon" to "@drawable/ic_launcher_foreground",
                "postSplashScreenTheme" to "@style/Theme.Truthy",
                "android:windowLightStatusBar" to "@bool/truthy_light_bars",
                "android:windowLightNavigationBar" to "@bool/truthy_light_bars",
            ),
            starting.items,
        )
    }

    @Test
    fun baseThemeIsLightByDayAndDarkByNight() {
        val day = RepoFiles.resource("values/themes.xml")
        val night = RepoFiles.resource("values-night/themes.xml")
        assertEquals("android:Theme.Material.Light.NoActionBar", day.style("Base.Theme.Truthy").parent)
        assertEquals("android:Theme.Material.NoActionBar", night.style("Base.Theme.Truthy").parent)
        assertEquals(listOf("Base.Theme.Truthy"), night.elements("style").map { it.getAttribute("name") })
    }
}
```

Run from `android/Truthy`:

```bash
./gradlew :app:testDebugUnitTest --tests com.eienmosu.truthy.ResourceValuesTest
```

Expected: FAIL, `5 tests completed, 4 failed`. `surfaceFollowsTheTokensByDayAndNight` passes (step 5 wrote the colours); the other four fail with `IllegalArgumentException: missing android/Truthy/app/src/main/res/values/strings.xml`, `.../values/bools.xml` and `.../values/themes.xml`.

- [ ] **Step 7: Add the name, the bar flags and the themes**

Create `android/Truthy/app/src/main/res/values/strings.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Truthy</string>
</resources>
```

Create `android/Truthy/app/src/main/res/values/bools.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Dark bar icons on the day surface. -->
    <bool name="truthy_light_bars">true</bool>
</resources>
```

Create `android/Truthy/app/src/main/res/values-night/bools.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Light bar icons on the night surface. -->
    <bool name="truthy_light_bars">false</bool>
</resources>
```

Create `android/Truthy/app/src/main/res/values/themes.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">

    <style name="Base.Theme.Truthy" parent="android:Theme.Material.Light.NoActionBar" />

    <!-- The activity's theme after the splash: the surface behind the first Compose frame and the bar icons of the
         first frame (spec 5.6). applySystemBars sets the same at runtime. -->
    <style name="Theme.Truthy" parent="Base.Theme.Truthy">
        <item name="android:windowBackground">@color/truthy_surface</item>
        <item name="android:windowLightStatusBar">@bool/truthy_light_bars</item>
        <item name="android:windowLightNavigationBar" tools:targetApi="27">@bool/truthy_light_bars</item>
    </style>

    <!-- The launch theme (AndroidX splash screen): the mark on color-surface, then Theme.Truthy. -->
    <style name="Theme.Truthy.Starting" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/truthy_surface</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/ic_launcher_foreground</item>
        <item name="postSplashScreenTheme">@style/Theme.Truthy</item>
        <item name="android:windowLightStatusBar">@bool/truthy_light_bars</item>
        <item name="android:windowLightNavigationBar" tools:targetApi="27">@bool/truthy_light_bars</item>
    </style>
</resources>
```

Create `android/Truthy/app/src/main/res/values-night/themes.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>

    <style name="Base.Theme.Truthy" parent="android:Theme.Material.NoActionBar" />
</resources>
```

Run from `android/Truthy`:

```bash
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

Expected: `BUILD SUCCESSFUL`; `cat app/build/test-results/testDebugUnitTest/TEST-*.xml | grep -o '<testcase ' | wc -l` prints `10`, and no result file has a failure or error (`grep -l -E 'failures="[1-9]|errors="[1-9]' app/build/test-results/testDebugUnitTest/TEST-*.xml` prints nothing). The resource linker accepted `Theme.SplashScreen` (from `core-splashscreen`) and the drawable the themes point at.

- [ ] **Step 8: Write the failing backup rules test**

Create `android/Truthy/app/src/test/java/com/eienmosu/truthy/BackupRulesTest.kt`:

```kotlin
package com.eienmosu.truthy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.w3c.dom.Element

/** Backups keep the progress file and the theme and never the round journal (spec 4.5, reference 6 "Backups"). */
class BackupRulesTest {
    private val expected = setOf(
        "file:${StorageNames.PROGRESS_FILE}",
        "sharedpref:${StorageNames.PREFS_FILE}.xml",
    )

    private fun includes(parent: Element): Set<String> =
        parent.childElements("include").map { "${it.getAttribute("domain")}:${it.getAttribute("path")}" }.toSet()

    @Test
    fun fullBackupIncludesOnlyProgressAndTheme() {
        val root = RepoFiles.resource("xml/backup_rules.xml").documentElement
        assertEquals("full-backup-content", root.tagName)
        assertEquals(expected, includes(root))
        assertEquals(listOf("include", "include"), root.childElements().map { it.tagName })
    }

    @Test
    fun cloudBackupAndDeviceTransferIncludeOnlyProgressAndTheme() {
        val root = RepoFiles.resource("xml/data_extraction_rules.xml").documentElement
        assertEquals("data-extraction-rules", root.tagName)
        assertEquals(listOf("cloud-backup", "device-transfer"), root.childElements().map { it.tagName })
        for (section in root.childElements()) {
            assertEquals(section.tagName, expected, includes(section))
            assertEquals(section.tagName, listOf("include", "include"), section.childElements().map { it.tagName })
        }
    }

    @Test
    fun journalAndSideCopyAreNeverIncluded() {
        val paths = (
            RepoFiles.resource("xml/backup_rules.xml").elements("include") +
                RepoFiles.resource("xml/data_extraction_rules.xml").elements("include")
            ).map { it.getAttribute("path") }
        assertFalse(StorageNames.JOURNAL_FILE in paths)
        assertFalse(StorageNames.UNREADABLE_FILE in paths)
        assertTrue(paths.none { it == "." || it.isEmpty() || it.endsWith("/") })
    }

    @Test
    fun storageNamesFollowTheWebKeys() {
        // src/progress/local.ts PROGRESS_KEY and UNREADABLE_KEY with ".json"; spec 4.5 names the journal.
        assertEquals("truthy.progress.v1.json", StorageNames.PROGRESS_FILE)
        assertEquals("truthy.progress.v1.unreadable.json", StorageNames.UNREADABLE_FILE)
        assertEquals("truthy.round.v1.json", StorageNames.JOURNAL_FILE)
        assertEquals("truthy", StorageNames.PREFS_FILE)
    }
}
```

Run from `android/Truthy`:

```bash
./gradlew :app:testDebugUnitTest --tests com.eienmosu.truthy.BackupRulesTest
```

Expected: FAIL at `:app:compileDebugUnitTestKotlin` with `Unresolved reference 'StorageNames'`.

- [ ] **Step 9: Add the storage names and the two rule files**

Create `android/Truthy/app/src/main/java/com/eienmosu/truthy/StorageNames.kt`:

```kotlin
package com.eienmosu.truthy

/**
 * The names of what the app stores, shared by the stores of task 9 and the backup rules in res/xml
 * (spec 4.5, reference 6). A rename here must change res/xml/backup_rules.xml and data_extraction_rules.xml too;
 * BackupRulesTest fails otherwise.
 */
object StorageNames {
    /** The web's PROGRESS_KEY with ".json", in filesDir through AtomicFile. Backed up. */
    const val PROGRESS_FILE = "truthy.progress.v1.json"

    /** The web's UNREADABLE_KEY with ".json", in filesDir. Not backed up. */
    const val UNREADABLE_FILE = "truthy.progress.v1.unreadable.json"

    /** The round journal (spec 4.5), in filesDir. Never backed up. */
    const val JOURNAL_FILE = "truthy.round.v1.json"

    /** The SharedPreferences file (truthy.xml on disk) that holds "truthy.theme". Backed up. */
    const val PREFS_FILE = "truthy"
}
```

Create `android/Truthy/app/src/main/res/xml/backup_rules.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Android 8 to 11. Only what is listed is backed up: the progress and the theme. The round journal, the
     unreadable side copy and AtomicFile's temporary files are left out by not being listed. -->
<full-backup-content>
    <include domain="file" path="truthy.progress.v1.json" />
    <include domain="sharedpref" path="truthy.xml" />
</full-backup-content>
```

Create `android/Truthy/app/src/main/res/xml/data_extraction_rules.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Android 12 and later: the same two files for cloud backup and for device transfer. -->
<data-extraction-rules>
    <cloud-backup>
        <include domain="file" path="truthy.progress.v1.json" />
        <include domain="sharedpref" path="truthy.xml" />
    </cloud-backup>
    <device-transfer>
        <include domain="file" path="truthy.progress.v1.json" />
        <include domain="sharedpref" path="truthy.xml" />
    </device-transfer>
</data-extraction-rules>
```

Run from `android/Truthy`:

```bash
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

Expected: `BUILD SUCCESSFUL`; `cat app/build/test-results/testDebugUnitTest/TEST-*.xml | grep -o '<testcase ' | wc -l` prints `14`, with no failure or error.

- [ ] **Step 10: Commit the module, the icon, the themes and the backup rules**

Run from the repository root:

```bash
git add android/Truthy/gradle/libs.versions.toml android/Truthy/settings.gradle.kts android/Truthy/build.gradle.kts android/Truthy/gradle.properties android/Truthy/app/build.gradle.kts android/Truthy/app/.gitignore android/Truthy/app/src/main/AndroidManifest.xml android/Truthy/app/src/main/java/com/eienmosu/truthy/StorageNames.kt android/Truthy/app/src/main/res android/Truthy/app/src/test/java/com/eienmosu/truthy/RepoFiles.kt android/Truthy/app/src/test/java/com/eienmosu/truthy/LauncherIconTest.kt android/Truthy/app/src/test/java/com/eienmosu/truthy/ResourceValuesTest.kt android/Truthy/app/src/test/java/com/eienmosu/truthy/BackupRulesTest.kt
git status --short
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "feat: add the Android app module with its launcher icon, themes and backup rules"
```

Expected: `git status --short` lists only the added files (`A`), and `M` for the four task 1 files that changed (`gradle.properties` only if step 2 added the line; if it did not change, `git add` of it is a no-op); nothing under `app/build` appears. The hygiene test passes (it scans every file in the index, the new ones included). The commit succeeds with the EienMosu noreply identity (`git config user.email` prints the address plan A set).

- [ ] **Step 11: Write the failing font and licence tests**

Create `android/Truthy/app/src/test/java/com/eienmosu/truthy/TrueType.kt`:

```kotlin
package com.eienmosu.truthy

/** Just enough of a TrueType reader for the font tests: the table directory, OS/2, name and the format 4 cmap. */
class TrueType(private val bytes: ByteArray) {
    data class Name(val platform: Int, val id: Int, val text: String)

    val tables: Map<String, Int>

    init {
        require(u32(0) == 0x00010000L) { "not a TrueType font" }
        tables = (0 until u16(4)).associate { i ->
            val record = 12 + 16 * i
            String(bytes, record, 4, Charsets.ISO_8859_1) to u32(record + 8).toInt()
        }
    }

    val weightClass: Int get() = u16(table("OS/2") + 4)

    fun names(): List<Name> {
        val name = table("name")
        val strings = name + u16(name + 4)
        return (0 until u16(name + 2)).map { i ->
            val record = name + 6 + 12 * i
            val platform = u16(record)
            val start = strings + u16(record + 10)
            val charset = if (platform == 1) Charsets.ISO_8859_1 else Charsets.UTF_16BE
            Name(platform, u16(record + 6), String(bytes, start, u16(record + 8), charset))
        }
    }

    /** True when the Windows BMP cmap (platform 3, encoding 1, format 4) maps the code point to a glyph. */
    fun covers(codePoint: Int): Boolean {
        val cmap = table("cmap")
        val record = (0 until u16(cmap + 2)).map { cmap + 4 + 8 * it }
            .first { u16(it) == 3 && u16(it + 2) == 1 }
        val sub = cmap + u32(record + 4).toInt()
        require(u16(sub) == 4) { "the Windows BMP cmap is not format 4" }
        val segCountX2 = u16(sub + 6)
        val ends = sub + 14
        val starts = ends + segCountX2 + 2
        val deltas = starts + segCountX2
        val ranges = deltas + segCountX2
        for (segment in 0 until segCountX2 / 2) {
            if (u16(ends + 2 * segment) < codePoint) continue
            val start = u16(starts + 2 * segment)
            if (start > codePoint) return false
            val delta = u16(deltas + 2 * segment)
            val rangeOffset = u16(ranges + 2 * segment)
            val glyph = if (rangeOffset == 0) {
                (codePoint + delta) and 0xFFFF
            } else {
                val raw = u16(ranges + 2 * segment + rangeOffset + 2 * (codePoint - start))
                if (raw == 0) 0 else (raw + delta) and 0xFFFF
            }
            return glyph != 0
        }
        return false
    }

    private fun table(tag: String): Int = tables[tag] ?: error("no $tag table")

    private fun u16(at: Int): Int = ((bytes[at].toInt() and 0xFF) shl 8) or (bytes[at + 1].toInt() and 0xFF)

    private fun u32(at: Int): Long = (u16(at).toLong() shl 16) or u16(at + 2).toLong()
}
```

Create `android/Truthy/app/src/test/java/com/eienmosu/truthy/FontFilesTest.kt`:

```kotlin
package com.eienmosu.truthy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The four static cuts of spec 6 (Fonts) and reference 5.2, with the coverage reference 2.2 requires. */
class FontFilesTest {
    private data class Cut(val weight: Int, val postScriptName: String)

    private val fonts = RepoFiles.resDir.resolve("font")
    private val cuts = mapOf(
        "overpass_600.ttf" to Cut(600, "OverpassRoman-SemiBold"),
        "overpass_800.ttf" to Cut(800, "OverpassRoman-ExtraBold"),
        "overpass_mono_400.ttf" to Cut(400, "OverpassMono-Regular"),
        "overpass_mono_600.ttf" to Cut(600, "OverpassMono-SemiBold"),
    )

    // Reference 2.2, font consequence: bullet, section sign, en dash, typographic quotes, é and É, the four arrows,
    // the middle dot.
    private val needed = listOf(
        0x2022, 0x00A7, 0x2013, 0x2018, 0x2019, 0x201A, 0x201B, 0x201C, 0x201D,
        0x00E9, 0x00C9, 0x2190, 0x2191, 0x2192, 0x2193, 0x00B7,
    )

    private fun font(file: String) = TrueType(fonts.resolve(file).readBytes())

    @Test
    fun theFourStaticCutsAreThere() {
        assertEquals(cuts.keys, fonts.list().orEmpty().toSet())
    }

    @Test
    fun eachCutHasItsWeightAndNameAndNoVariationTable() {
        for ((file, cut) in cuts) {
            val font = font(file)
            assertEquals(file, cut.weight, font.weightClass)
            assertEquals(file, listOf(cut.postScriptName), font.names().filter { it.id == 6 }.map { it.text }.distinct())
            assertFalse(file, "fvar" in font.tables)
            assertFalse(file, "gvar" in font.tables)
        }
    }

    @Test
    fun eachCutCoversTheCharactersTheContentUses() {
        for (file in cuts.keys) {
            val font = font(file)
            val missing = needed.filterNot(font::covers).map { "U+%04X".format(it) }
            assertEquals(file, emptyList<String>(), missing)
        }
        // The lookup can say no: Overpass has no CJK.
        assertFalse(font("overpass_600.ttf").covers(0x4E00))
    }

    @Test
    fun nameTablesArePlainAscii() {
        val email = Regex("""[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}""")
        for (file in cuts.keys) {
            for (name in font(file).names()) {
                assertNotEquals("$file has the sample text record", 19, name.id)
                assertTrue("$file name ${name.id}: ${name.text}", name.text.all { it in ' '..'~' })
                assertNull("$file name ${name.id}", email.find(name.text))
            }
        }
    }
}
```

The list is reference 2.2's, with its range U+2018 to U+201D written out (U+201A and U+201B included); step 12's script checks the same list before it writes a file, and all four cuts cover it.

Create `android/Truthy/app/src/test/java/com/eienmosu/truthy/LicenseTest.kt`:

```kotlin
package com.eienmosu.truthy

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** OFL 1.1 travels with the fonts (reference 5.2): the same text as the web's app/fonts/OFL.txt. */
class LicenseTest {
    @Test
    fun oflTextIsTheWebCopy() {
        val shipped = RepoFiles.main.resolve("assets/licenses/OFL.txt")
        assertTrue("missing assets/licenses/OFL.txt", shipped.isFile)
        assertArrayEquals(RepoFiles.root.resolve("app/fonts/OFL.txt").readBytes(), shipped.readBytes())
    }
}
```

Run from `android/Truthy`:

```bash
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.FontFilesTest' --tests 'com.eienmosu.truthy.LicenseTest'
```

Expected: FAIL, `5 tests completed, 5 failed`: `theFourStaticCutsAreThere` (the set is empty), the other three font tests with `FileNotFoundException` for `overpass_600.ttf`, and `oflTextIsTheWebCopy` with `missing assets/licenses/OFL.txt`.

- [ ] **Step 12: Build the four static cuts**

Run from the repository root. The work happens in a fresh temporary directory; nothing but the four output files lands in the repository.

```bash
FONTWORK="$(mktemp -d)"
python3 -m venv "$FONTWORK/venv"
"$FONTWORK/venv/bin/pip" install --quiet fonttools==4.67.0
GF=8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5
curl -fsSL -o "$FONTWORK/Overpass[wght].ttf" "https://raw.githubusercontent.com/google/fonts/$GF/ofl/overpass/Overpass%5Bwght%5D.ttf"
curl -fsSL -o "$FONTWORK/OverpassMono[wght].ttf" "https://raw.githubusercontent.com/google/fonts/$GF/ofl/overpassmono/OverpassMono%5Bwght%5D.ttf"
curl -fsSL -o "$FONTWORK/OFL.txt" "https://raw.githubusercontent.com/google/fonts/$GF/ofl/overpass/OFL.txt"
(cd "$FONTWORK" && shasum -a 256 'Overpass[wght].ttf' 'OverpassMono[wght].ttf')
cmp "$FONTWORK/OFL.txt" app/fonts/OFL.txt && echo "OFL identical"
```

Expected:

```
970717df17a7f9911dee45f60695d05bfa9d745fa0a11fc5c348371fa21f0073  Overpass[wght].ttf
49f230e10251608f0ae1a2ce46be768d7b9ddcbe5cdca2e9f6b762fcbce1ae4f  OverpassMono[wght].ttf
OFL identical
```

Write the instancing script into the same temporary directory:

```bash
cat > "$FONTWORK/make_fonts.py" <<'EOF'
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

src, out = Path(sys.argv[1]), Path(sys.argv[2])
CUTS = [
    ("Overpass[wght].ttf", 600, "overpass_600.ttf"),
    ("Overpass[wght].ttf", 800, "overpass_800.ttf"),
    ("OverpassMono[wght].ttf", 400, "overpass_mono_400.ttf"),
    ("OverpassMono[wght].ttf", 600, "overpass_mono_600.ttf"),
]
NEEDED = [0x2022, 0x00A7, 0x2013, 0x2018, 0x2019, 0x201A, 0x201B, 0x201C, 0x201D,
          0x00E9, 0x00C9, 0x2190, 0x2191, 0x2192, 0x2193, 0x00B7]
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")

for source, weight, name in CUTS:
    # recalcTimestamp=False keeps head.modified from the source, so the output is the same on every run.
    font = TTFont(src / source, recalcTimestamp=False)
    static = instancer.instantiateVariableFont(font, {"wght": weight}, static=True, updateFontNames=True)
    # Name 19 is a sample text with an em dash; nothing reads it.
    static["name"].names = [record for record in static["name"].names if record.nameID != 19]
    for record in static["name"].names:
        text = record.toUnicode()
        if EMAIL.search(text) or any(ord(c) > 0x7E or ord(c) < 0x20 for c in text):
            sys.exit(f"{name}: name record {record.nameID} needs a look: {text!r}")
    cmap = static.getBestCmap()
    missing = [f"U+{c:04X}" for c in NEEDED if c not in cmap]
    if missing:
        sys.exit(f"{name}: missing {missing}")
    if static["OS/2"].usWeightClass != weight or "fvar" in static:
        sys.exit(f"{name}: not a static {weight} cut")
    static.save(out / name)
    print(f"{name}: weight {weight}, {len(cmap)} characters, ok")
EOF
mkdir -p android/Truthy/app/src/main/res/font
"$FONTWORK/venv/bin/python" "$FONTWORK/make_fonts.py" "$FONTWORK" android/Truthy/app/src/main/res/font
(cd android/Truthy/app/src/main/res/font && shasum -a 256 *.ttf)
```

Expected (the hashes were measured when this task was written, with the pinned commit and fontTools 4.67.0; the script exits with a message instead if a check fails):

```
overpass_600.ttf: weight 600, 1182 characters, ok
overpass_800.ttf: weight 800, 1182 characters, ok
overpass_mono_400.ttf: weight 400, 1642 characters, ok
overpass_mono_600.ttf: weight 600, 1642 characters, ok
cbb64707c7c100db86215ed151764e5ff3abdd97d1402c14cddad1d340d5dbf6  overpass_600.ttf
69662f8197e1c89a038946f09cd45ae1501e57535da6d064eeb30a5bd4d5af91  overpass_800.ttf
281d7b976131719912653240f3fe8e7ae3be51589ec5b6d0e7ff63dd8c704c7f  overpass_mono_400.ttf
409ae74070db65740d840675662da17ae3863e30fec647cdb15b7629c6351bc6  overpass_mono_600.ttf
```

Then remove the temporary directory: `rm -rf "$FONTWORK"`.

- [ ] **Step 13: Ship the licence and run the font tests**

Run from the repository root:

```bash
mkdir -p android/Truthy/app/src/main/assets/licenses
cp app/fonts/OFL.txt android/Truthy/app/src/main/assets/licenses/OFL.txt
cd android/Truthy && ./gradlew :app:testDebugUnitTest :app:assembleDebug
```

Expected: `BUILD SUCCESSFUL`; `cat app/build/test-results/testDebugUnitTest/TEST-*.xml | grep -o '<testcase ' | wc -l` prints `19`, with no failure or error.

- [ ] **Step 14: Commit the fonts and the licence**

Run from the repository root:

```bash
git add android/Truthy/app/src/main/res/font android/Truthy/app/src/main/assets/licenses/OFL.txt android/Truthy/app/src/test/java/com/eienmosu/truthy/TrueType.kt android/Truthy/app/src/test/java/com/eienmosu/truthy/FontFilesTest.kt android/Truthy/app/src/test/java/com/eienmosu/truthy/LicenseTest.kt
pnpm vitest run tests/repo-hygiene.test.ts tests/scripts/hygiene-native.test.ts
git commit -m "feat: ship static Overpass and Overpass Mono cuts with the OFL in the Android app" -m "Instanced with fontTools 4.67.0 from the variable files of google/fonts at 8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5 (Overpass 600 and 800, Overpass Mono 400 and 600), name record 19 removed."
```

Expected: both hygiene test files pass; they read the font files' ASCII and (with plan A's change) UTF-16 runs. If a font is reported, stop: do not commit it; read the reported run, and remove or fix the name record it comes from in the step 12 script.

- [ ] **Step 15: Write the failing manifest test**

Create `android/Truthy/app/src/test/java/com/eienmosu/truthy/ManifestTest.kt`:

```kotlin
package com.eienmosu.truthy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Predictive back, backups, the launch theme and the single launcher activity (spec 5.1, 4.5, 5.6). */
class ManifestTest {
    private val manifest = RepoFiles.xml(RepoFiles.main.resolve("AndroidManifest.xml")).documentElement
    private val application = manifest.childElements("application").single()

    @Test
    fun applicationOptsIntoPredictiveBackAndBackups() {
        assertEquals("true", application.android("enableOnBackInvokedCallback"))
        assertEquals("true", application.android("allowBackup"))
        assertEquals("@xml/backup_rules", application.android("fullBackupContent"))
        assertEquals("@xml/data_extraction_rules", application.android("dataExtractionRules"))
    }

    @Test
    fun applicationUsesTheStartingThemeIconAndName() {
        assertEquals("@style/Theme.Truthy.Starting", application.android("theme"))
        assertEquals("@mipmap/ic_launcher", application.android("icon"))
        assertEquals("@string/app_name", application.android("label"))
    }

    @Test
    fun launcherActivityIsMainActivity() {
        val activity = application.childElements("activity").single()
        assertEquals(".MainActivity", activity.android("name"))
        assertEquals("true", activity.android("exported"))
        // A theme switch (UiModeManager.setApplicationNightMode, tasks 8 and 11) must not recreate the activity.
        assertEquals("uiMode", activity.android("configChanges"))
        assertEquals("", activity.android("theme"))
        val filter = activity.childElements("intent-filter").single()
        assertEquals(listOf("android.intent.action.MAIN"), filter.childElements("action").map { it.android("name") })
        assertEquals(
            listOf("android.intent.category.LAUNCHER"),
            filter.childElements("category").map { it.android("name") },
        )
    }

    @Test
    fun asksForNoPermissionAndLocksNoOrientation() {
        assertTrue(manifest.childElements("uses-permission").isEmpty())
        val activity = application.childElements("activity").single()
        assertEquals("", activity.android("screenOrientation"))
    }
}
```

Run from `android/Truthy`:

```bash
./gradlew :app:testDebugUnitTest --tests com.eienmosu.truthy.ManifestTest
```

Expected: FAIL, `4 tests completed, 4 failed`: the two application tests on `expected:<true> but was:<>` and `expected:<@style/Theme.Truthy.Starting> but was:<>`, the two activity tests with `NoSuchElementException` (the placeholder manifest has no activity).

- [ ] **Step 16: Write the activity, the system bars, the root and the manifest**

Create `android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt`:

```kotlin
package com.eienmosu.truthy

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag

/** The test tag of the activity's root, for tests that only need to know the app drew. */
const val ROOT_TAG = "truthy.root"

/**
 * The activity's only content. Empty for now: the window background (truthy_surface) shows through. Task 8 wraps it
 * in the theme; task 11 swaps the start flow and the round inside it.
 */
@Composable
fun TruthyRoot() {
    Box(Modifier.fillMaxSize().testTag(ROOT_TAG))
}
```

Create `android/Truthy/app/src/main/java/com/eienmosu/truthy/SystemBars.kt`:

```kotlin
package com.eienmosu.truthy

import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge

/** True when this configuration is in night mode: the system's, or the app's once UiModeManager has it (task 8). */
fun Configuration.isNightMode(): Boolean =
    (uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

/**
 * Edge to edge with transparent bars whose icons follow the app's theme, not the system's (spec 5.6, System bars):
 * dark icons when [dark] is false, light ones when it is true. Call it in onCreate and again whenever the app's theme
 * changes.
 *
 * SystemBarStyle.auto makes the activity library enforce navigation bar contrast on API 29 and later, which puts a
 * translucent scrim behind three-button navigation; it is turned off again here.
 */
fun ComponentActivity.applySystemBars(dark: Boolean) {
    val style = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { dark }
    enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        window.isNavigationBarContrastEnforced = false
    }
}
```

Create `android/Truthy/app/src/main/java/com/eienmosu/truthy/MainActivity.kt`:

```kotlin
package com.eienmosu.truthy

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Before super.onCreate, as the splash screen library requires: it switches to postSplashScreenTheme.
        installSplashScreen()
        super.onCreate(savedInstanceState)
        // The system's night mode for now; task 8 passes the resolved app theme.
        applySystemBars(dark = resources.configuration.isNightMode())
        setContent { TruthyRoot() }
    }
}
```

Replace `android/Truthy/app/src/main/AndroidManifest.xml` with:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <application
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:enableOnBackInvokedCallback="true"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.Truthy.Starting"
        tools:targetApi="33">
        <activity
            android:name=".MainActivity"
            android:configChanges="uiMode"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />

                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

Run from `android/Truthy`:

```bash
./gradlew :engine:test :app:testDebugUnitTest :app:assembleDebug
```

Expected: `BUILD SUCCESSFUL`; `cat app/build/test-results/testDebugUnitTest/TEST-*.xml | grep -o '<testcase ' | wc -l` prints `23`, with no failure or error (LauncherIconTest 5, ResourceValuesTest 5, BackupRulesTest 4, FontFilesTest 4, LicenseTest 1, ManifestTest 4).

- [ ] **Step 17: Check what the APK carries**

Run from `android/Truthy`:

```bash
unzip -l app/build/outputs/apk/debug/app-debug.apk | grep -c -E ' assets/[^/]+\.json$'
unzip -l app/build/outputs/apk/debug/app-debug.apk | grep -E ' assets/(index\.json|aws-clf-c02\.json|licenses/OFL\.txt)$|res/font/'
cd ../.. && git grep -n -I -E '/Users/|/home/|/private/|/var/folders' -- android || echo "no local paths"
```

Expected: `55`; then lines for `assets/index.json`, `assets/aws-clf-c02.json`, `assets/licenses/OFL.txt` and the four `res/font/overpass_*.ttf` files; then `no local paths` (the deck path exists only in the build, never in a tracked file; `git grep` reads only tracked files, so this also covers the files committed in steps 10 and 14).

- [ ] **Step 18: Write the launch test for the emulator**

Create `android/Truthy/app/src/androidTest/java/com/eienmosu/truthy/AppLaunchTest.kt`:

```kotlin
package com.eienmosu.truthy

import android.os.Build
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.core.content.res.ResourcesCompat
import androidx.core.view.WindowCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** The app launches, draws, goes edge to edge with theme-following bars, and carries its decks, fonts and licence. */
@RunWith(AndroidJUnit4::class)
class AppLaunchTest {
    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun drawsTheRoot() {
        compose.onNodeWithTag(ROOT_TAG).assertExists()
    }

    @Test
    fun barIconsFollowTheThemeAndTheNavigationBarHasNoScrim() {
        compose.runOnIdle {
            val activity = compose.activity
            val night = activity.resources.configuration.isNightMode()
            val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            assertEquals(!night, controller.isAppearanceLightStatusBars)
            assertEquals(!night, controller.isAppearanceLightNavigationBars)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                assertFalse(activity.window.isNavigationBarContrastEnforced)
            }
        }
    }

    @Test
    fun theDecksAreAssetsAtTheRoot() {
        val index = JSONObject(context.assets.open("index.json").bufferedReader().use { it.readText() })
        val ids = buildList {
            val areas = index.getJSONArray("areas")
            for (a in 0 until areas.length()) {
                val platforms = areas.getJSONObject(a).getJSONArray("platforms")
                for (p in 0 until platforms.length()) {
                    val decks = platforms.getJSONObject(p).getJSONArray("decks")
                    for (d in 0 until decks.length()) add(decks.getJSONObject(d).getString("id"))
                }
            }
        }
        assertEquals(54, ids.size)
        val files = context.assets.list("").orEmpty().filter { it.endsWith(".json") }.toSet()
        assertEquals(ids.map { "$it.json" }.toSet() + "index.json", files)
    }

    @Test
    fun theFontLicenceShips() {
        val first = context.assets.open("licenses/OFL.txt").bufferedReader().use { it.readLine() }
        assertEquals("Copyright 2021 The Overpass Project Authors (https://github.com/RedHatOfficial/Overpass)", first)
    }

    @Test
    fun theFourFontsLoad() {
        val ids = listOf(R.font.overpass_600, R.font.overpass_800, R.font.overpass_mono_400, R.font.overpass_mono_600)
        for (id in ids) {
            assertNotNull(ResourcesCompat.getFont(context, id))
        }
    }
}
```

Run from `android/Truthy`:

```bash
./gradlew :app:assembleDebugAndroidTest
```

Expected: `BUILD SUCCESSFUL` (the test APK compiles; running it needs the emulator of step 19).

- [ ] **Step 19: Run the launch test on the API 36 emulator**

Start the emulator (replace `Pixel8_API36` with the API 36 AVD name step 1 listed) and wait for it to boot:

```bash
"$ANDROID_HOME/emulator/emulator" -avd Pixel8_API36 -no-snapshot-save -no-audio -no-boot-anim >/dev/null 2>&1 &
"$ANDROID_HOME/platform-tools/adb" wait-for-device
until [ "$("$ANDROID_HOME/platform-tools/adb" shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
"$ANDROID_HOME/platform-tools/adb" shell getprop ro.build.version.sdk
"$ANDROID_HOME/platform-tools/adb" shell cmd uimode night
```

Expected: `36`, then `Night mode: no` (the emulator's default day appearance; if it says `yes`, run `adb shell cmd uimode night no` first so the run matches this step).

Run from `android/Truthy`:

```bash
./gradlew :app:connectedDebugAndroidTest
```

Expected: `BUILD SUCCESSFUL`, with Gradle reporting `Finished 5 tests on Pixel8_API36(AVD) - 16` (the device label is the AVD's). Then run the same suite once in night mode, so the bar test sees both themes:

```bash
"$ANDROID_HOME/platform-tools/adb" shell cmd uimode night yes
./gradlew :app:connectedDebugAndroidTest
"$ANDROID_HOME/platform-tools/adb" shell cmd uimode night no
```

Expected: `BUILD SUCCESSFUL`, 5 tests again.

- [ ] **Step 20: Launch the app by hand and look at it in day and night**

With the emulator from step 19 still running, from `android/Truthy`:

```bash
ADB="$ANDROID_HOME/platform-tools/adb"
"$ADB" install -r app/build/outputs/apk/debug/app-debug.apk
"$ADB" shell am force-stop com.eienmosu.truthy
"$ADB" shell am start -W -n com.eienmosu.truthy/.MainActivity
sleep 2
"$ADB" exec-out screencap -p > "${TMPDIR:-/tmp}/truthy-task7-day.png"
"$ADB" shell cmd uimode night yes
"$ADB" shell am force-stop com.eienmosu.truthy
"$ADB" shell am start -W -n com.eienmosu.truthy/.MainActivity
sleep 2
"$ADB" exec-out screencap -p > "${TMPDIR:-/tmp}/truthy-task7-night.png"
"$ADB" shell cmd uimode night no
```

Expected: both `am start` calls print `Status: ok`, `LaunchState: COLD` and `Activity: com.eienmosu.truthy/.MainActivity`. Open the two screenshots (they stay in the temporary folder, outside the repository): the day one is the flat surface `#c4e3f5` edge to edge with dark status bar icons and a dark gesture handle, no scrim behind the navigation bar; the night one is `#101c33` with light icons. Also check by eye on the emulator: the launcher shows the amber ticket on the light blue square; launching shows the ticket on the surface colour before the empty screen, with no white frame; the back gesture from the empty screen goes home with the system's predictive back-to-home animation. Nothing from this step is committed.

- [ ] **Step 21: Run every gate and commit**

Run from `android/Truthy`, then from the repository root:

```bash
./gradlew :engine:test :app:testDebugUnitTest :app:assembleDebug
cd ../..
pnpm test
git add android/Truthy/app/src/main/AndroidManifest.xml android/Truthy/app/src/main/java/com/eienmosu/truthy/MainActivity.kt android/Truthy/app/src/main/java/com/eienmosu/truthy/SystemBars.kt android/Truthy/app/src/main/java/com/eienmosu/truthy/TruthyRoot.kt android/Truthy/app/src/test/java/com/eienmosu/truthy/ManifestTest.kt android/Truthy/app/src/androidTest/java/com/eienmosu/truthy/AppLaunchTest.kt
git status --short
pnpm vitest run tests/repo-hygiene.test.ts
git commit -m "feat: launch the Android app edge to edge behind the splash screen, with predictive back enabled"
```

Expected: `BUILD SUCCESSFUL` (23 app unit tests and the engine suite); `pnpm test` passes (the web suite, including the hygiene and drift tests, is unaffected by `android/`); `git status --short` shows only the six staged files and no untracked file under `android/` (in particular nothing under `app/build`); the hygiene test passes; the commit succeeds. The emulator may be left running for task 8 or closed with `"$ANDROID_HOME/platform-tools/adb" emu kill`.
