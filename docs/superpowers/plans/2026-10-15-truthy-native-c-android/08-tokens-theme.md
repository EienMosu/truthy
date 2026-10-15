### Task 8: The tokens: `:tokengen`, the committed `Tokens.kt` and its freshness test, theme resolution, the Overpass fonts and the type roles

Every colour, size, duration and curve of the app comes from one generated file. This task builds the generator and the file. `:tokengen` is a small JVM module that reads `native-data/tokens/resolved.json` (the design tokens with the code's overrides applied, written by plan A) and prints `Tokens.kt`: the day and night colours, the five shadows of each theme, the spacing, sizes, radii, strokes, opacities, durations, easing curves, spring and transition specs, the gesture constants and the 35 type roles as plain data. `Tokens.kt` is committed, and a test in `:tokengen` regenerates it in memory and fails when the committed file differs, so a stale value cannot reach a composable (the same gate the web has in `tests/native-data.test.ts`). The generator fails loudly on a dangling or circular reference, a night group that does not match its day group, an unknown unit or colour space, and a token name that would not be a safe Kotlin identifier.

On top of the generated data the task writes the hand-kept parts of the design system's base: the font families (Overpass 600 and 800, Overpass Mono 400 and 600, every weight requested explicitly, no weight synthesis), the type roles as Compose `TextStyle`s (the 30 roles the app uses, and the documented variants of reference 5.0 and 5.3 such as the 28 px stub stamp), and the theme: `resolvedTheme` (a stored choice beats the system, as the web's `resolveTheme` does), `TruthyTheme` (composition locals and "no indication" as the default press indication), the night-mode call for Android 12 and later (`UiModeManager.setApplicationNightMode`, so the splash and the resources follow the stored theme) and the window set-up (edge to edge, bar icon colours and window background from the app's theme, no enforced navigation bar contrast). Review Focus 3 (the stored theme is the opposite of the system theme) starts here: this task tests the resolution and the night-mode and bar decisions as units; task 11 calls `bootTheme` before the first frame and task 15 checks the first frame, the bars and the splash on the emulator (feel item N12).

**Not compiled during drafting.** Nothing in this file was compiled or run while the plan was written. After the review, tasks 1 to 15 were assembled from these files and run with the Android Studio JBR against plan A's real `native-data`: the JVM tests and, on the API 36 emulator, the instrumented tests. The defects that run found are fixed in this file (README, Drafting record). It is written against the API signatures of the pinned stack (Compose UI 1.12, Foundation, activity 1.13, core 1.19, kotlinx-serialization 1.11) as read from the AndroidX sources and the reference pages. A compile error in a step is a defect of this file: fix it in the step's file, keep the behaviour the step's test pins, and never loosen a test to make it pass. Expected outputs below that depend on the compiler are stated as the expected failure of a red step (for example an unresolved reference) and the expected counts of a green one.

Builds on: task 1 (the Gradle project, the version catalog, `settings.gradle.kts`, the engine's `Theme` enum and `resolveTheme`), task 7 (`:app` with its manifest, the fonts in `res/font`, `OFL.txt` in `assets/licenses`, the Compose set-up) and plan A (`native-data/tokens/resolved.json`).

**Files:**
- Modify: `android/Truthy/settings.gradle.kts` (only if `:tokengen` is not yet included)
- Create: `android/Truthy/tokengen/build.gradle.kts`
- Create: `android/Truthy/tokengen/src/main/kotlin/com/eienmosu/truthy/tokengen/TokenGenerator.kt`
- Create: `android/Truthy/tokengen/src/main/kotlin/com/eienmosu/truthy/tokengen/Main.kt`
- Create (generated, committed): `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Tokens.kt`
- Create: `android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/TokenTypes.kt`, `Fonts.kt`, `TypeRoles.kt`, `Theme.kt`, `NightMode.kt`, `WindowTheme.kt`
- Test: create `android/Truthy/tokengen/src/test/resources/tokens-fixture.json`, `android/Truthy/tokengen/src/test/kotlin/com/eienmosu/truthy/tokengen/TokenGeneratorTest.kt`, `TokensFreshnessTest.kt`
- Test: create `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/CmapReader.kt`, `FontsTest.kt`, `TypeRolesTest.kt`, `ThemeTest.kt`

**Interfaces:**
- Consumes (from earlier tasks, exact names; "Assumed from other tasks" in the report lists the ones the README does not fix):
  - Task 1, in `com.eienmosu.truthy.engine`: `enum class Theme(val wire: String) { LIGHT("light"), DARK("dark") }` and `fun resolveTheme(choice: Theme?, systemDark: Boolean): Theme` (the web's `resolveTheme`: a choice wins, otherwise the system decides).
  - Task 1: the version catalog `gradle/libs.versions.toml` with the aliases `libs.plugins.kotlin.jvm`, `libs.kotlinx.serialization.json` and `libs.junit` (JUnit 4, as in The Slow Wire's catalog).
  - Task 7: `res/font/overpass_600.ttf`, `overpass_800.ttf`, `overpass_mono_400.ttf`, `overpass_mono_600.ttf` (so `R.font.overpass_600` and so on), `app/src/main/assets/licenses/OFL.txt`, the namespace `com.eienmosu.truthy`, sources under `app/src/main/kotlin`, tests under `app/src/test/kotlin`, `testImplementation(libs.junit)`, `fun ComponentActivity.applySystemBars(dark: Boolean)` in `com.eienmosu.truthy` (`SystemBars.kt`, the app's one edge-to-edge implementation, which `applyWindowTheme` calls), the activity's `android:configChanges="uiMode"`, and a `MainActivity` that task 11 will wire.
  - Plan A: `native-data/tokens/resolved.json` in the DTCG shape of `design/system/tokens.json` with `scripts/native-token-overrides.json` applied (frame width 430, the list-title line height 1.25, the leave sheet's 360 ms `ease`).
- Produces (later tasks rely on these names exactly), all in `com.eienmosu.truthy.design` unless stated:

```kotlin
// :tokengen, package com.eienmosu.truthy.tokengen
class TokenException(message: String) : Exception(message)
fun generateTokens(resolvedJson: String): String          // the text of Tokens.kt

// TokenTypes.kt
@Immutable class ShadowLayer(val offsetX: Dp, val offsetY: Dp, val blur: Dp, val spread: Dp, val color: Color)
@Immutable class ShadowSpec(val layers: List<ShadowLayer>)
@Immutable class TransitionSpec(val durationMs: Int, val delayMs: Int, val easing: Easing)
enum class FontKey { SANS, MONO }
@Immutable data class TypeRole(val family: FontKey, val weight: Int, val sizeSp: Float, val lineHeight: Float, val letterSpacingSp: Float)

// Tokens.kt (generated)
@Immutable class TruthyColors(val sky1: Color, val sky2: Color, val sky3: Color, val sky4: Color, val surface: Color,
    val surfaceRaised: Color, val surfaceSunk: Color, val ink: Color, val inkMuted: Color, val rule: Color, val accent: Color,
    val onAccent: Color, val trueColor: Color, val falseColor: Color, val correct: Color, val wrong: Color, val onDark: Color,
    val cloud: Color, val scrim: Color, val surfaceSunkClear: Color, val focus: Color, val focusOnFill: Color, val press: Color)
@Immutable class TruthyShadows(val ticket: ShadowSpec, val small: ShadowSpec, val button: ShadowSpec, val press: ShadowSpec, val sheet: ShadowSpec)
object Tokens {
    object Colors { val day: TruthyColors; val night: TruthyColors }
    object Shadows { val day: TruthyShadows; val night: TruthyShadows }
    object Space { val s2: Dp /* ... s24 */ }                    // a name that starts with a digit gets the prefix "s"
    object Size { val maxWidth: Dp /* 430 */; val gutter: Dp; val safeTop: Dp; val safeBottom: Dp /* ... 37 sizes */ }
    object Radius { val card: Dp; val small: Dp; val pill: Dp; val pillSmall: Dp; val tick: Dp }
    object Stroke { val rule: Dp /* ... 7 strokes */ }
    object Opacity { const val cloud: Float; const val disabled: Float }
    object Duration { const val t1: Int /* ms; 25 durations: t2, t3, stamp, tear, jolt, stampTimed, ... */ }
    object Curves { val ease: CubicBezierEasing; val easeOut: CubicBezierEasing; val easeIn: CubicBezierEasing; val fall: CubicBezierEasing; val spring: CubicBezierEasing }
    object SpringTransitions { val snap: TransitionSpec; val land: TransitionSpec; val landFast: TransitionSpec }
    object Transitions { val press: TransitionSpec /* ... 15: answerRow, tear, stamp, jolt, sheetOpen, sheetClose, disclosure, travel, stepEnter, stepExit, timedLeave, timedDeal, passResize, passBoard */ }
    object Gesture { val commitDistance: Dp; val intentDistance: Dp; const val rotationDivisor: Float; val stubPull: Dp; const val intentOpacityGain: Float }
    object Type { val logo: TypeRole /* ... all 35 roles of tokens.json, camelCased */ }
    object Native {                                              // plan A's additive top-level "native" group, written nowhere else
        val skyStops: List<Float>; val sheetOffsetY: Dp; const val sheetReducedMs: Int; val sheetMinWidth: Dp
        val shortScreenBelow: Dp; val shortSafeTop: Dp; val shortSafeBottom: Dp; val stepTitleRow: Dp
        object Type { const val stubStampSize: Float /* newBestSize, missedExplanationSize, missedAnswerSize, carrierCompactTitle,
            carrierCompactLabel, sourceLinkSize, scoreUnitSize, timedClockSize, stubValueSize, stubValueLineHeight, continueDeckLineHeight */ }
    }
}

// Fonts.kt
val OverpassSans: FontFamily      // 600 and 800
val OverpassMono: FontFamily      // 400 and 600
fun FontKey.family(): FontFamily

// TypeRoles.kt
fun TypeRole.toTextStyle(): TextStyle
object TruthyType {               // one TextStyle per used role: logo, stepTitle, tagline, cardStatement, cardName, deckCode, answerLabel,
                                  // answerValue, stamp, button, buttonQuiet, buttonBack, carrierTitle, carrierLabel, legCode, legName, fieldLabel,
                                  // fieldValue, fieldValuePass, passLine, body, listTitle, listStatement, emphasis, score, intentStamp, monoData,
                                  // monoDataStrong, monoCaption, routeLabel
                                  // and the variants: stampStub, stampBest, missedAnswer, missedExplanation, carrierTitleCompact,
                                  // carrierLabelCompact, sourceLink, scoreUnit, timedClock, stubValue, passCode, continueDeckName
}

// Theme.kt
@Immutable class ResolvedTheme { val theme: Theme; val colors: TruthyColors; val shadows: TruthyShadows; val isDark: Boolean }
fun resolvedTheme(theme: Theme): ResolvedTheme
fun resolvedTheme(stored: Theme?, systemDark: Boolean): ResolvedTheme
val LocalResolvedTheme: ProvidableCompositionLocal<ResolvedTheme>
object NoIndication : IndicationNodeFactory
@Composable fun TruthyTheme(theme: ResolvedTheme, content: @Composable () -> Unit)
object TruthyTheme { val resolved: ResolvedTheme; val colors: TruthyColors; val shadows: TruthyShadows; val isDark: Boolean }   // @Composable getters

// NightMode.kt
fun nightModeFor(theme: Theme): Int
fun isNightUiMode(uiMode: Int): Boolean
fun applyStoredNightMode(context: Context, stored: Theme?)

// WindowTheme.kt
fun applyWindowTheme(activity: ComponentActivity, theme: ResolvedTheme)     // call again whenever the theme changes
fun bootTheme(activity: ComponentActivity, stored: Theme?): ResolvedTheme   // call in onCreate before setContent (task 11)
```

**Rules:**

1. The generator reads the DTCG shape of `tokens.json`: groups, tokens with `$value`, a group's `$type` applying to the tokens below it, `{a.b.c}` references (followed to a literal, with the web generator's errors for a missing target, a group used as a token, a circular chain and a malformed reference). It supports exactly the types the file uses: `color` (srgb, `hex` plus an optional `alpha`), `dimension` (`px` only), `duration` (`ms` or `s`, a whole number of milliseconds), `number`, `cubicBezier` (four numbers, x values 0 to 1), `shadow` (one layer or a list, `px` fields, no `inset`), `transition` (duration, delay, timing function) and `typography`. Anything else fails with a message naming the token. Beside the DTCG groups, `resolved.json` has plan A's additive top-level group `native` (plain numbers by path, no `$value`): `sky-stops`, `sheet`, `safe-area-short`, `step-title-row` and `type`. The generator emits it as `Tokens.Native` (`skyStops`, `sheetOffsetY`, `sheetReducedMs`, `sheetMinWidth`, `shortScreenBelow`, `shortSafeTop`, `shortSafeBottom`, `stepTitleRow`, and `Native.Type` with the twelve sizes and line heights of reference 5.0 and 5.3); a missing group or value, or a value that is not a plain number, fails the generator. The sky's gradient stops, the short-screen rule (below 568: 8 and 12), the 36 step-title row, the sheet's reduced 140 ms and the type variants of rule 5 are read from there and written nowhere else (tasks 10, 12, 13 and 14).
2. Units: a `px` dimension becomes `dp` (spacing, sizes, radii, strokes, shadows, gesture distances) and a type role's size and letter spacing become sp numbers (`sizeSp`, `letterSpacingSp`); a line height is a unitless ratio and the style's line height is `sizeSp * lineHeight` sp. Durations are `Int` milliseconds. Opacities and plain numbers are `Float`.
3. A colour with an alpha below 1 is `Color(0xFFRRGGBB).copy(alpha = a)` with the token's own alpha (0.32 stays `0.32f`). The role `true` and the role `false` are `trueColor` and `falseColor` (Kotlin keywords); any other keyword as a token name fails the generator.
4. The night colours and shadows must have exactly the day group's names. The first mismatch fails with the group and the names.
5. Letter spacing is in px at the role's own size. A role drawn at another size keeps its px letter spacing and keeps its line-height ratio (the web does the same: `text-[28px]` with the role's `leading` and `tracking` tokens), so every variant in `TruthyType` is `copy(sizeSp = ...)` of its role, with the size (or line height) from `Tokens.Native.Type`. The one exception is the compact carrier label: 11 with tracking 0.66, which is `tracking-[0.06em]` at 11 px in `FillInPass.tsx`, not the role's 0.72.
6. Fonts: the four static TrueType files only, each requested with an explicit weight and normal style; `FontSynthesis.None` on every style so a missing weight never becomes a smeared fake. Line height is centred with no trim (`LineHeightStyle(Center, Trim.None)`), which is how the browser splits the leading.
7. Theme: a stored choice wins over the system (`resolveTheme`). `setApplicationNightMode` is called only when a theme is stored and the device is Android 12 or later; with nothing stored the system decides and nothing is set. Below Android 12 the splash follows the system (README, Review Focus 3).
8. Bars: `applyWindowTheme` calls task 7's `activity.applySystemBars(theme.isDark)`, the one edge-to-edge implementation of the app: `enableEdgeToEdge` with `SystemBarStyle.auto` and transparent bars whose icon colours come from the app's theme (dark icons by day, light icons at night), with the enforced navigation bar contrast turned off again, which is spec 5.6 word for word. It then sets only the window background, to the theme's `surface`, the colour of the launch screen. The drafter read the current androidx.activity sources as deprecating `enableEdgeToEdge(statusBarStyle, navigationBarStyle)` and `SystemBarStyle` in favour of `WindowCompat.enableEdgeToEdge` with `WindowInsetsControllerCompat`; that is recorded for the owner's review, and the spec's API is kept until the owner approves a change (a deprecation warning at compile time is expected and allowed).
9. `Tokens.kt` is never edited by hand. The header says so and names the command that rewrites it.
10. Overscroll (spec 5.6): stretch on API 31 and later is the platform's; on API 26 to 30 the edge glow is drawn in `ink`. `TruthyTheme` provides `LocalOverscrollFactory` with `rememberPlatformOverscrollFactory(glowColor = theme.colors.ink)`. Check the signature against Foundation 1.12.1 before writing it (it takes the glow colour as a named parameter since Foundation 1.8); feel item F21 of task 15 checks the colour on API 26.

**Steps:**

- [ ] **Step 1: Check the ground this task stands on.**

```bash
cd android/Truthy
ls ../../native-data/tokens/resolved.json
grep -n 'tokengen' settings.gradle.kts || echo "tokengen not included yet"
grep -n 'kotlin-jvm\|kotlinx-serialization-json\|^junit' gradle/libs.versions.toml
sed -n 1,40p engine/build.gradle.kts
ls app/src/main/res/font app/src/main/assets/licenses
grep -rn 'package com.eienmosu.truthy.design' app/src/main/kotlin || echo "no design package yet"
grep -n 'configChanges' app/src/main/AndroidManifest.xml
```

Expected: `resolved.json` is listed; either a line naming `:tokengen` or `tokengen not included yet`; catalog lines for a `kotlin-jvm` plugin, `kotlinx-serialization-json` and `junit`; the engine's build file (its `plugins`, `kotlin { }` or `java { }` block and its `tasks.test` block are the model for the next step); the four font files `overpass_600.ttf`, `overpass_800.ttf`, `overpass_mono_400.ttf`, `overpass_mono_600.ttf` and `OFL.txt`; `no design package yet`; and a `configChanges` value on the activity that contains `uiMode`.

Stop and fix before going on if: `resolved.json` is missing (plan A is not complete), a catalog alias or a font file has another name (use task 1's and task 7's names in this task's files; every place is named in the steps below), or the activity has no `uiMode` in `android:configChanges` (task 7 writes `android:configChanges="uiMode"` and its `ManifestTest` checks it; if it is missing, task 7 is not in place: stop, since this task commits no manifest change).

- [ ] **Step 2: Include `:tokengen` and write its build file.**

```bash
cd android/Truthy
grep -q ':tokengen' settings.gradle.kts || printf '\ninclude(":tokengen")\n' >> settings.gradle.kts
mkdir -p tokengen/src/main/kotlin/com/eienmosu/truthy/tokengen tokengen/src/test/kotlin/com/eienmosu/truthy/tokengen tokengen/src/test/resources
```

`android/Truthy/tokengen/build.gradle.kts` (if the engine's build file has a `kotlin { jvmToolchain(...) }` or `java { toolchain { ... } }` block, copy it into this file unchanged, so both JVM modules compile for the same Java version):

```kotlin
plugins {
    alias(libs.plugins.kotlin.jvm)
}

dependencies {
    implementation(libs.kotlinx.serialization.json)
    testImplementation(libs.junit)
}

// Where the generator reads and writes, computed from the project directory. Nothing here is a
// path written into a committed file.
val repoRoot = rootProject.projectDir.resolve("../..").canonicalFile
val resolvedTokens = repoRoot.resolve("native-data/tokens/resolved.json")
val committedTokens = rootProject.projectDir.resolve("app/src/main/kotlin/com/eienmosu/truthy/design/Tokens.kt")

tasks.test {
    systemProperty("truthy.tokens.resolved", resolvedTokens.path)
    systemProperty("truthy.tokens.committed", committedTokens.path)
    // files(...) and not file(...): the committed file does not exist before the first generation.
    inputs.files(resolvedTokens)
    inputs.files(committedTokens)
}

tasks.register<JavaExec>("generateTokens") {
    group = "truthy"
    description = "Writes Tokens.kt from native-data/tokens/resolved.json."
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass.set("com.eienmosu.truthy.tokengen.MainKt")
    args(resolvedTokens.path, committedTokens.path)
    inputs.files(resolvedTokens)
    outputs.files(committedTokens)
}
```

Run:

```bash
cd android/Truthy
./gradlew :tokengen:tasks --all | grep -E 'generateTokens|tokengen:test'
```

Expected: `BUILD SUCCESSFUL` and the two task names `tokengen:generateTokens` and `tokengen:test` listed (`generateTokens` under the `truthy` group). If the plugin alias is not found, use the alias task 1 wrote for the Kotlin JVM plugin.

- [ ] **Step 3: Write the fixture for the generator tests.**

`android/Truthy/tokengen/src/test/resources/tokens-fixture.json` (a small file in the shape of `tokens.json` with every group the generator requires; the strings the tests replace occur where the tests expect them, so do not reformat it):

```json
{
  "$description": "Fixture for the token generator tests.",
  "color": {
    "primitive": {
      "$type": "color",
      "navy": { "$value": { "colorSpace": "srgb", "components": [0.0627, 0.1373, 0.2471], "hex": "#10233f" } },
      "navy-a32": { "$value": { "colorSpace": "srgb", "components": [0.0627, 0.1373, 0.2471], "hex": "#10233f", "alpha": 0.32 } },
      "cream": { "$value": { "colorSpace": "srgb", "components": [0.9922, 0.9843, 0.9608], "hex": "#fdfbf5" } },
      "black-a60": { "$value": { "colorSpace": "srgb", "components": [0, 0, 0], "hex": "#000000", "alpha": 0.6 } }
    },
    "day": {
      "$type": "color",
      "ink": { "$value": "{color.primitive.navy}" },
      "true": { "$value": "{color.primitive.cream}" },
      "scrim": { "$value": "{color.primitive.navy-a32}" }
    },
    "night": {
      "$type": "color",
      "ink": { "$value": "{color.primitive.cream}" },
      "true": { "$value": "{color.primitive.navy}" },
      "scrim": { "$value": "{color.primitive.black-a60}" }
    }
  },
  "font": {
    "family": {
      "$type": "fontFamily",
      "sans": { "$value": ["Overpass", "system-ui", "sans-serif"] },
      "mono": { "$value": ["Overpass Mono", "ui-monospace", "monospace"] }
    },
    "weight": {
      "$type": "fontWeight",
      "sans-extrabold": { "$value": 800 },
      "mono-semibold": { "$value": 600 }
    }
  },
  "typography": {
    "$type": "typography",
    "logo": {
      "$value": {
        "fontFamily": "{font.family.sans}",
        "fontSize": { "value": 36, "unit": "px" },
        "fontWeight": "{font.weight.sans-extrabold}",
        "letterSpacing": { "value": -0.9, "unit": "px" },
        "lineHeight": 1
      }
    },
    "carrier-label": {
      "$value": {
        "fontFamily": "{font.family.mono}",
        "fontSize": { "value": 12, "unit": "px" },
        "fontWeight": "{font.weight.mono-semibold}",
        "letterSpacing": { "value": 0.72, "unit": "px" },
        "lineHeight": 1.27
      }
    }
  },
  "space": {
    "$type": "dimension",
    "2": { "$value": { "value": 2, "unit": "px" } }
  },
  "size": {
    "$type": "dimension",
    "max-width": { "$value": { "value": 430, "unit": "px" } },
    "gutter": { "$value": { "value": 16, "unit": "px" } }
  },
  "radius": {
    "$type": "dimension",
    "card": { "$value": { "value": 8, "unit": "px" } }
  },
  "stroke": {
    "$type": "dimension",
    "rule": { "$value": { "value": 1.5, "unit": "px" } }
  },
  "opacity": {
    "$type": "number",
    "disabled": { "$value": 0.45 }
  },
  "elevation": {
    "$type": "shadow",
    "day": {
      "ticket": {
        "$value": [
          { "color": { "colorSpace": "srgb", "components": [0.0627, 0.1373, 0.2471], "hex": "#10233f", "alpha": 0.06 }, "offsetX": { "value": 0, "unit": "px" }, "offsetY": { "value": 1, "unit": "px" }, "blur": { "value": 0, "unit": "px" }, "spread": { "value": 0, "unit": "px" } },
          { "color": { "colorSpace": "srgb", "components": [0.0627, 0.1373, 0.2471], "hex": "#10233f", "alpha": 0.45 }, "offsetX": { "value": 0, "unit": "px" }, "offsetY": { "value": 22, "unit": "px" }, "blur": { "value": 36, "unit": "px" }, "spread": { "value": -18, "unit": "px" } }
        ]
      },
      "press": {
        "$value": { "color": { "colorSpace": "srgb", "components": [0.0627, 0.1373, 0.2471], "hex": "#10233f", "alpha": 0.1 }, "offsetX": { "value": 0, "unit": "px" }, "offsetY": { "value": 1, "unit": "px" }, "blur": { "value": 0, "unit": "px" }, "spread": { "value": 0, "unit": "px" } }
      }
    },
    "night": {
      "ticket": {
        "$value": [
          { "color": { "colorSpace": "srgb", "components": [0, 0, 0], "hex": "#000000", "alpha": 0.2 }, "offsetX": { "value": 0, "unit": "px" }, "offsetY": { "value": 1, "unit": "px" }, "blur": { "value": 0, "unit": "px" }, "spread": { "value": 0, "unit": "px" } },
          { "color": { "colorSpace": "srgb", "components": [0, 0, 0], "hex": "#000000", "alpha": 0.75 }, "offsetX": { "value": 0, "unit": "px" }, "offsetY": { "value": 22, "unit": "px" }, "blur": { "value": 36, "unit": "px" }, "spread": { "value": -18, "unit": "px" } }
        ]
      },
      "press": {
        "$value": { "color": { "colorSpace": "srgb", "components": [0, 0, 0], "hex": "#000000", "alpha": 0.2 }, "offsetX": { "value": 0, "unit": "px" }, "offsetY": { "value": 1, "unit": "px" }, "blur": { "value": 0, "unit": "px" }, "spread": { "value": 0, "unit": "px" } }
      }
    }
  },
  "motion": {
    "duration": {
      "$type": "duration",
      "t1": { "$value": { "value": 120, "unit": "ms" } },
      "step-enter": { "$value": { "value": 240, "unit": "ms" } },
      "tick": { "$value": { "value": 0.5, "unit": "s" } }
    },
    "easing": {
      "$type": "cubicBezier",
      "ease": { "$value": [0.2, 0.7, 0.2, 1] },
      "spring": { "$value": [0.34, 1.56, 0.64, 1] }
    },
    "spring": {
      "$type": "transition",
      "snap": { "$value": { "duration": "{motion.duration.t1}", "delay": { "value": 0, "unit": "ms" }, "timingFunction": "{motion.easing.spring}" } }
    },
    "transition": {
      "$type": "transition",
      "press": { "$value": { "duration": "{motion.duration.t1}", "delay": "{motion.duration.step-enter}", "timingFunction": "{motion.easing.ease}" } },
      "custom": { "$value": { "duration": { "value": 80, "unit": "ms" }, "delay": { "value": 0, "unit": "ms" }, "timingFunction": [0.1, 0.2, 0.3, 0.4] } }
    },
    "gesture": {
      "commit-distance": { "$type": "dimension", "$value": { "value": 90, "unit": "px" } },
      "rotation-divisor": { "$type": "number", "$value": 18 }
    }
  },
  "native": {
    "sky-stops": [0, 0.35, 0.62, 1],
    "sheet": { "offset-y": 24, "duration-reduced-ms": 140, "min-width": 320 },
    "safe-area-short": { "below-height": 568, "top": 8, "bottom": 12 },
    "step-title-row": 36,
    "type": {
      "stub-stamp-size": 28,
      "new-best-size": 22,
      "missed-explanation-size": 15,
      "missed-answer-size": 17,
      "carrier-compact": { "title": 14, "label": 11 },
      "source-link-size": 13.5,
      "score-unit-size": 20,
      "timed-clock-size": 13,
      "stub-value": { "size": 16, "lineHeight": 1.27 },
      "continue-deck-line-height": 1.2
    }
  }
}
```

- [ ] **Step 4: Write the generator's tests (they fail: no generator yet).**

`android/Truthy/tokengen/src/test/kotlin/com/eienmosu/truthy/tokengen/TokenGeneratorTest.kt`:

```kotlin
package com.eienmosu.truthy.tokengen

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TokenGeneratorTest {
    private fun fixture(): String {
        val stream = checkNotNull(javaClass.getResourceAsStream("/tokens-fixture.json")) { "tokens-fixture.json is missing" }
        return stream.use { it.readBytes().toString(Charsets.UTF_8) }
    }

    private fun generated(): String = generateTokens(fixture())

    private fun failureOf(json: String): String {
        try {
            generateTokens(json)
        } catch (error: TokenException) {
            return error.message.orEmpty()
        }
        throw AssertionError("expected a TokenException")
    }

    private fun String.replaceLast(old: String, replacement: String): String {
        val at = lastIndexOf(old)
        require(at >= 0) { "$old does not occur" }
        return substring(0, at) + replacement + substring(at + old.length)
    }

    private fun block(vararg lines: String): String = lines.joinToString("\n") + "\n"

    @Test
    fun writesTheColoursOfBothThemesAndNamesTheKeywordRolesWithAColorSuffix() {
        val text = generated()
        assertTrue(text, text.contains(block(
            "@Immutable",
            "class TruthyColors(",
            "    val ink: Color,",
            "    val trueColor: Color,",
            "    val scrim: Color,",
            ")",
        )))
        assertTrue(text, text.contains(block(
            "        val day = TruthyColors(",
            "            ink = Color(0xFF10233F),",
            "            trueColor = Color(0xFFFDFBF5),",
            "            scrim = Color(0xFF10233F).copy(alpha = 0.32f),",
            "        )",
            "        val night = TruthyColors(",
            "            ink = Color(0xFFFDFBF5),",
            "            trueColor = Color(0xFF10233F),",
            "            scrim = Color(0xFF000000).copy(alpha = 0.6f),",
            "        )",
        )))
    }

    @Test
    fun writesDimensionsAsDpAndNumbersAsFloats() {
        val text = generated()
        for (line in listOf(
            "        val s2 = 2.dp",
            "        val maxWidth = 430.dp",
            "        val gutter = 16.dp",
            "        val card = 8.dp",
            "        val rule = 1.5.dp",
            "        const val disabled = 0.45f",
            "        val commitDistance = 90.dp",
            "        const val rotationDivisor = 18f",
        )) {
            assertTrue("missing: $line", text.lines().contains(line))
        }
    }

    @Test
    fun writesDurationsInWholeMillisecondsAndCurvesAndTransitions() {
        val text = generated()
        for (line in listOf(
            "        const val t1 = 120",
            "        const val stepEnter = 240",
            "        const val tick = 500",
            "        val ease = CubicBezierEasing(0.2f, 0.7f, 0.2f, 1f)",
            "        val spring = CubicBezierEasing(0.34f, 1.56f, 0.64f, 1f)",
            "        val snap = TransitionSpec(durationMs = 120, delayMs = 0, easing = Curves.spring)",
            "        val press = TransitionSpec(durationMs = 120, delayMs = 240, easing = Curves.ease)",
            "        val custom = TransitionSpec(durationMs = 80, delayMs = 0, easing = CubicBezierEasing(0.1f, 0.2f, 0.3f, 0.4f))",
        )) {
            assertTrue("missing: $line", text.lines().contains(line))
        }
    }

    @Test
    fun writesTypeRolesWithTheirPxLetterSpacingAndLineHeightRatio() {
        val text = generated()
        assertTrue(text.lines().contains("        val logo = TypeRole(family = FontKey.SANS, weight = 800, sizeSp = 36f, lineHeight = 1f, letterSpacingSp = -0.9f)"))
        assertTrue(text.lines().contains("        val carrierLabel = TypeRole(family = FontKey.MONO, weight = 600, sizeSp = 12f, lineHeight = 1.27f, letterSpacingSp = 0.72f)"))
    }

    @Test
    fun writesShadowsAsLayersWithNegativeSpread() {
        val text = generated()
        assertTrue(text.contains("ShadowLayer(offsetX = 0.dp, offsetY = 22.dp, blur = 36.dp, spread = -18.dp, color = Color(0xFF10233F).copy(alpha = 0.45f)),"))
        assertTrue(text.contains("ShadowLayer(offsetX = 0.dp, offsetY = 22.dp, blur = 36.dp, spread = -18.dp, color = Color(0xFF000000).copy(alpha = 0.75f)),"))
        assertTrue(text.contains(block(
            "@Immutable",
            "class TruthyShadows(",
            "    val ticket: ShadowSpec,",
            "    val press: ShadowSpec,",
            ")",
        )))
        assertTrue(text.contains("ShadowLayer(offsetX = 0.dp, offsetY = 1.dp, blur = 0.dp, spread = 0.dp, color = Color(0xFF10233F).copy(alpha = 0.1f)),"))
    }

    @Test
    fun writesTheNativeGroupAsTokensNative() {
        val text = generated()
        assertTrue(text, text.contains(block(
            "    object Native {",
            "        val skyStops: List<Float> = listOf(0f, 0.35f, 0.62f, 1f)",
            "        val sheetOffsetY = 24.dp",
            "        const val sheetReducedMs: Int = 140",
            "        val sheetMinWidth = 320.dp",
            "        val shortScreenBelow = 568.dp",
            "        val shortSafeTop = 8.dp",
            "        val shortSafeBottom = 12.dp",
            "        val stepTitleRow = 36.dp",
            "        object Type {",
            "            const val stubStampSize: Float = 28f",
            "            const val newBestSize: Float = 22f",
            "            const val missedExplanationSize: Float = 15f",
            "            const val missedAnswerSize: Float = 17f",
            "            const val carrierCompactTitle: Float = 14f",
            "            const val carrierCompactLabel: Float = 11f",
            "            const val sourceLinkSize: Float = 13.5f",
            "            const val scoreUnitSize: Float = 20f",
            "            const val timedClockSize: Float = 13f",
            "            const val stubValueSize: Float = 16f",
            "            const val stubValueLineHeight: Float = 1.27f",
            "            const val continueDeckLineHeight: Float = 1.2f",
            "        }",
            "    }",
            "}",
        )))
    }

    @Test
    fun failsWhenTheNativeGroupIsMissingOrAValueIsNotANumber() {
        val missing = failureOf(fixture().replace("\"native\"", "\"natives\""))
        assertTrue(missing, missing.contains("Required token group native is missing"))
        val text = failureOf(fixture().replace("\"step-title-row\": 36", "\"step-title-row\": \"36\""))
        assertTrue(text, text.contains("native.step-title-row has a value that is not a plain decimal number"))
        val gone = failureOf(fixture().replace("\"timed-clock-size\": 13,", ""))
        assertTrue(gone, gone.contains("Required value native.type.timed-clock-size is missing"))
    }

    @Test
    fun startsWithTheGeneratedHeaderAndEndsWithOneNewline() {
        val text = generated()
        assertTrue(text.startsWith("// Generated by :tokengen from native-data/tokens/resolved.json. Do not edit by hand.\n"))
        assertTrue(text.contains("\npackage com.eienmosu.truthy.design\n"))
        assertTrue(text.endsWith("}\n"))
        assertFalse(text.endsWith("\n\n"))
        assertTrue("no trailing spaces", text.lines().none { it != it.trimEnd() })
        assertFalse("no em dash", text.contains('\u2014'))
    }

    @Test
    fun writesTheSameTextTwice() {
        assertEquals(generated(), generated())
    }

    @Test
    fun failsOnAReferenceToATokenThatDoesNotExist() {
        val message = failureOf(fixture().replace("{color.primitive.cream}", "{color.primitive.nope}"))
        assertTrue(message, message.contains("refers to {color.primitive.nope}, which does not exist"))
    }

    @Test
    fun failsOnAReferenceToAGroup() {
        val message = failureOf(fixture().replace("{color.primitive.cream}", "{color.primitive}"))
        assertTrue(message, message.contains("which is a group, not a token"))
    }

    @Test
    fun failsOnACircularReference() {
        val message = failureOf(fixture().replace("{color.primitive.navy}", "{color.day.ink}"))
        assertTrue(message, message.contains("has a circular reference"))
    }

    @Test
    fun failsOnAMalformedReference() {
        val message = failureOf(fixture().replace("{color.primitive.cream}", "{color.primitive.cream"))
        assertTrue(message, message.contains("has a malformed reference"))
    }

    @Test
    fun failsWhenTheNightGroupDoesNotMatchTheDayGroup() {
        val message = failureOf(fixture().replaceLast("\"scrim\"", "\"scrimmed\""))
        assertTrue(message, message.contains("color.night is missing scrim"))
    }

    @Test
    fun failsOnAColourSpaceOtherThanSrgb() {
        val message = failureOf(fixture().replace("\"srgb\"", "\"display-p3\""))
        assertTrue(message, message.contains("only srgb is supported"))
    }

    @Test
    fun failsOnADimensionUnitOtherThanPx() {
        val message = failureOf(fixture().replace("\"value\": 16, \"unit\": \"px\"", "\"value\": 1, \"unit\": \"rem\""))
        assertTrue(message, message.contains("dimension unit rem, expected px"))
    }

    @Test
    fun failsOnATokenNamedLikeAKotlinKeywordOutsideTheColours() {
        val message = failureOf(fixture().replace("\"gutter\"", "\"object\""))
        assertTrue(message, message.contains("Kotlin keyword object"))
    }

    @Test
    fun failsOnATokenNameThatIsNotLowercaseWithHyphens() {
        val message = failureOf(fixture().replace("\"max-width\"", "\"maxWidth\""))
        assertTrue(message, message.contains("lowercase letters, digits and hyphens"))
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :tokengen:test
```

Expected: `BUILD FAILED` at `:tokengen:compileTestKotlin` with `Unresolved reference 'generateTokens'` and `Unresolved reference 'TokenException'`.

- [ ] **Step 5: Write the generator.**

`android/Truthy/tokengen/src/main/kotlin/com/eienmosu/truthy/tokengen/TokenGenerator.kt`:

```kotlin
package com.eienmosu.truthy.tokengen

import java.math.BigDecimal
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Turns native-data/tokens/resolved.json (the design tokens in the DTCG shape of design/system/tokens.json,
// with the code's overrides applied) into the text of Tokens.kt. Pure: no file access, no clock.

class TokenException(message: String) : Exception(message)

private const val DESIGN_PACKAGE = "com.eienmosu.truthy.design"
private const val TYPE_KEY = "\$type"
private const val VALUE_KEY = "\$value"

private val REFERENCE = Regex("^\\{([^{}]+)\\}$")
private val NUMBER = Regex("^-?\\d+(\\.\\d+)?$")
private val INTEGER = Regex("^\\d{3,4}$")
private val HEX = Regex("^#([0-9a-fA-F]{6})$")
private val NAME = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")

private val KEYWORDS = setOf(
    "as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in", "interface", "is",
    "null", "object", "package", "return", "super", "this", "throw", "true", "try", "typealias", "typeof",
    "val", "var", "when", "while",
)

private fun fail(path: String, problem: String): Nothing = throw TokenException("Token $path $problem")

private fun stringOrNull(element: JsonElement?): String? =
    (element as? JsonPrimitive)?.takeIf { it.isString }?.content

private class Token(val path: String, val type: String?, val value: JsonElement)

// Every token by dotted path, in file order, and the dotted paths of the groups.
private class Registry(root: JsonObject) {
    val tokens = LinkedHashMap<String, Token>()
    val groups = HashSet<String>()

    init {
        collect(root, "", null)
    }

    private fun collect(node: JsonObject, path: String, inherited: String?) {
        val type = stringOrNull(node[TYPE_KEY]) ?: inherited
        val value = node[VALUE_KEY]
        if (value != null) {
            tokens[path] = Token(path, type, value)
            return
        }
        groups.add(path)
        for ((key, child) in node) {
            if (key.startsWith('$') || child !is JsonObject) continue
            collect(child, if (path.isEmpty()) key else "$path.$key", type)
        }
    }

    fun token(path: String): Token = tokens[path] ?: throw TokenException("Required token $path is missing")

    // The tokens directly below a group, as (name, token), in file order.
    fun members(group: String): List<Pair<String, Token>> {
        if (group !in groups) throw TokenException("Required token group $group is missing")
        val prefix = "$group."
        val found = tokens.values.filter { it.path.startsWith(prefix) }.map { it.path.removePrefix(prefix) to it }
        if (found.isEmpty()) throw TokenException("Required token group $group has no tokens")
        return found
    }

    // Follows "{a.b.c}" references until a literal value.
    fun deref(raw: JsonElement, holder: String, chain: List<String> = listOf(holder)): JsonElement {
        val text = stringOrNull(raw) ?: return raw
        val match = REFERENCE.matchEntire(text)
        if (match == null) {
            if (text.contains('{') || text.contains('}')) fail(holder, "has a malformed reference: $text")
            return raw
        }
        val target = match.groupValues[1]
        val token = tokens[target]
        if (token == null) {
            if (target in groups) fail(holder, "refers to {$target}, which is a group, not a token")
            fail(holder, "refers to {$target}, which does not exist")
        }
        if (target in chain) fail(chain[0], "has a circular reference: ${(chain + target).joinToString(" -> ")}")
        return deref(token.value, holder, chain + target)
    }
}

private fun expectType(token: Token, expected: String) {
    if (token.type != expected) fail(token.path, "has type ${token.type}, expected $expected")
}

private fun JsonElement.asObject(holder: String, what: String): JsonObject =
    this as? JsonObject ?: fail(holder, "has $what that is not an object")

private fun numberText(element: JsonElement?, holder: String): String {
    val primitive = element as? JsonPrimitive
    if (primitive == null || primitive.isString || !NUMBER.matches(primitive.content)) {
        fail(holder, "has a value that is not a plain decimal number")
    }
    return primitive.content
}

private fun floatText(number: String): String = "${number}f"

// A px dimension as "<n>.dp".
private fun dp(registry: Registry, raw: JsonElement, holder: String): String {
    val measure = registry.deref(raw, holder).asObject(holder, "a dimension")
    val unit = stringOrNull(measure["unit"])
    if (unit != "px") fail(holder, "has a dimension unit $unit, expected px")
    return "${numberText(measure["value"], holder)}.dp"
}

// A px dimension as a Float literal, for sp values.
private fun pxFloat(registry: Registry, raw: JsonElement, holder: String): String {
    val measure = registry.deref(raw, holder).asObject(holder, "a dimension")
    val unit = stringOrNull(measure["unit"])
    if (unit != "px") fail(holder, "has a dimension unit $unit, expected px")
    return floatText(numberText(measure["value"], holder))
}

private fun milliseconds(registry: Registry, raw: JsonElement, holder: String): String {
    val measure = registry.deref(raw, holder).asObject(holder, "a duration")
    val value = BigDecimal(numberText(measure["value"], holder))
    val millis = when (val unit = stringOrNull(measure["unit"])) {
        "ms" -> value
        "s" -> value.multiply(BigDecimal(1000))
        else -> fail(holder, "has a duration unit $unit, expected ms or s")
    }
    val whole = millis.stripTrailingZeros()
    if (whole.scale() > 0 || whole.signum() < 0) fail(holder, "has a duration that is not a whole number of milliseconds")
    return whole.toPlainString()
}

private fun colorExpression(registry: Registry, raw: JsonElement, holder: String): String {
    val color = registry.deref(raw, holder).asObject(holder, "a color")
    val space = stringOrNull(color["colorSpace"])
    if (space != null && space != "srgb") fail(holder, "uses color space $space, only srgb is supported")
    val hex = stringOrNull(color["hex"]) ?: fail(holder, "has a color without a hex value")
    val match = HEX.matchEntire(hex) ?: fail(holder, "has a hex color that is not #rrggbb: $hex")
    val opaque = "Color(0xFF${match.groupValues[1].uppercase()})"
    val alphaElement = color["alpha"] ?: return opaque
    val alpha = numberText(alphaElement, holder)
    val value = BigDecimal(alpha)
    if (value < BigDecimal.ZERO || value > BigDecimal.ONE) fail(holder, "has an alpha outside 0 to 1")
    return if (value.compareTo(BigDecimal.ONE) == 0) opaque else "$opaque.copy(alpha = ${floatText(alpha)})"
}

private fun cubicBezier(registry: Registry, raw: JsonElement, holder: String): String {
    val array = registry.deref(raw, holder) as? JsonArray ?: fail(holder, "has a cubic bezier that is not a list")
    if (array.size != 4) fail(holder, "has a cubic bezier that is not four numbers")
    val numbers = array.map { numberText(it, holder) }
    if (numbers[0].toDouble() !in 0.0..1.0 || numbers[2].toDouble() !in 0.0..1.0) {
        fail(holder, "has a cubic bezier with an x value outside 0 to 1")
    }
    return "CubicBezierEasing(${numbers.joinToString(", ") { floatText(it) }})"
}

// A reference to motion.easing.<name> stays a reference (Curves.<name>); anything else is written out.
private fun easingExpression(registry: Registry, raw: JsonElement, holder: String): String {
    val target = stringOrNull(raw)?.let { REFERENCE.matchEntire(it) }?.groupValues?.get(1)
    if (target != null && target.startsWith("motion.easing.")) {
        registry.token(target)
        return "Curves.${identifier(target.removePrefix("motion.easing."), "motion.easing", null)}"
    }
    return cubicBezier(registry, raw, holder)
}

private fun transition(registry: Registry, token: Token): String {
    expectType(token, "transition")
    val value = token.value.asObject(token.path, "a transition value")
    fun field(name: String): JsonElement = value[name] ?: fail(token.path, "is missing $name")
    val duration = milliseconds(registry, field("duration"), token.path)
    val delay = milliseconds(registry, field("delay"), token.path)
    val easing = easingExpression(registry, field("timingFunction"), token.path)
    return "TransitionSpec(durationMs = $duration, delayMs = $delay, easing = $easing)"
}

private fun typeRole(registry: Registry, token: Token): String {
    expectType(token, "typography")
    val role = token.value.asObject(token.path, "a typography value")
    fun field(name: String): JsonElement = role[name] ?: fail(token.path, "is missing $name")
    val family = when (stringOrNull(field("fontFamily"))) {
        "{font.family.sans}" -> "SANS"
        "{font.family.mono}" -> "MONO"
        else -> fail(token.path, "has a font family that is not {font.family.sans} or {font.family.mono}")
    }
    val weight = numberText(registry.deref(field("fontWeight"), token.path), token.path)
    if (!INTEGER.matches(weight)) fail(token.path, "has a font weight that is not a whole number from 100 to 1000")
    val size = pxFloat(registry, field("fontSize"), token.path)
    val lineHeight = floatText(numberText(registry.deref(field("lineHeight"), token.path), token.path))
    val spacing = pxFloat(registry, field("letterSpacing"), token.path)
    return "TypeRole(family = FontKey.$family, weight = $weight, sizeSp = $size, lineHeight = $lineHeight, letterSpacingSp = $spacing)"
}

private fun shadowLayers(registry: Registry, token: Token): List<String> {
    expectType(token, "shadow")
    val raw = registry.deref(token.value, token.path)
    val layers = if (raw is JsonArray) raw.toList() else listOf(raw)
    if (layers.isEmpty()) fail(token.path, "has a shadow with no layers")
    return layers.map { element ->
        val layer = element.asObject(token.path, "a shadow layer")
        fun field(name: String): JsonElement = layer[name] ?: fail(token.path, "is missing $name")
        if ((layer["inset"] as? JsonPrimitive)?.content == "true") {
            fail(token.path, "has an inset shadow, which the app does not draw")
        }
        "ShadowLayer(" +
            "offsetX = ${dp(registry, field("offsetX"), token.path)}, " +
            "offsetY = ${dp(registry, field("offsetY"), token.path)}, " +
            "blur = ${dp(registry, field("blur"), token.path)}, " +
            "spread = ${dp(registry, field("spread"), token.path)}, " +
            "color = ${colorExpression(registry, field("color"), token.path)})"
    }
}

// "sky-1" is sky1, "on-accent" is onAccent, "2" is s2. A Kotlin keyword gets the suffix, or fails without one.
private fun identifier(name: String, group: String, keywordSuffix: String?): String {
    if (!NAME.matches(name)) fail("$group.$name", "has a name that is not lowercase letters, digits and hyphens")
    val parts = name.split('-')
    var id = parts.first() + parts.drop(1).joinToString("") { part -> part.replaceFirstChar { it.uppercaseChar() } }
    if (id.first().isDigit()) id = "s$id"
    if (id in KEYWORDS) {
        if (keywordSuffix == null) fail("$group.$name", "would be the Kotlin keyword $id")
        id += keywordSuffix
    }
    return id
}

private fun checkUnique(ids: List<String>, group: String) {
    val seen = HashSet<String>()
    for (id in ids) if (!seen.add(id)) fail(group, "would produce $id a second time")
}

private class Writer {
    private val lines = ArrayList<String>()

    fun line(text: String = "", depth: Int = 0) {
        lines.add(if (text.isEmpty()) "" else "    ".repeat(depth) + text)
    }

    fun text(): String = lines.joinToString("\n") + "\n"
}

private class Member(val declaration: String, val expression: String)

// One flat object of the Tokens object: one member per token of the group.
private fun Writer.flatObject(registry: Registry, name: String, group: String, member: (Token) -> Member) {
    val members = registry.members(group)
    val ids = members.map { identifier(it.first, group, null) }
    checkUnique(ids, group)
    line("object $name {", 1)
    members.forEachIndexed { index, (_, token) ->
        val built = member(token)
        line("${built.declaration} ${ids[index]} = ${built.expression}", 2)
    }
    line("}", 1)
}

// The names of a day group, after checking that the night group has exactly the same ones.
private fun themedNames(registry: Registry, day: String, night: String): List<String> {
    val dayNames = registry.members(day).map { it.first }
    val nightNames = registry.members(night).map { it.first }
    val missing = dayNames.filter { it !in nightNames }
    val extra = nightNames.filter { it !in dayNames }
    if (missing.isNotEmpty()) throw TokenException("Token group $night is missing ${missing.joinToString(", ")}")
    if (extra.isNotEmpty()) throw TokenException("Token group $night has ${extra.joinToString(", ")} with no day value")
    return dayNames
}

private fun Writer.colorsClass(names: List<String>) {
    val ids = names.map { identifier(it, "color.day", "Color") }
    checkUnique(ids, "color.day")
    line("@Immutable")
    line("class TruthyColors(")
    for (id in ids) line("val $id: Color,", 1)
    line(")")
}

private fun Writer.colorsObject(registry: Registry, names: List<String>) {
    val ids = names.map { identifier(it, "color.day", "Color") }
    line("object Colors {", 1)
    for ((label, group) in listOf("day" to "color.day", "night" to "color.night")) {
        line("val $label = TruthyColors(", 2)
        names.forEachIndexed { index, name ->
            val token = registry.token("$group.$name")
            expectType(token, "color")
            line("${ids[index]} = ${colorExpression(registry, token.value, token.path)},", 3)
        }
        line(")", 2)
    }
    line("}", 1)
}

private fun Writer.shadowsClass(names: List<String>) {
    val ids = names.map { identifier(it, "elevation.day", null) }
    checkUnique(ids, "elevation.day")
    line("@Immutable")
    line("class TruthyShadows(")
    for (id in ids) line("val $id: ShadowSpec,", 1)
    line(")")
}

private fun Writer.shadowsObject(registry: Registry, names: List<String>) {
    val ids = names.map { identifier(it, "elevation.day", null) }
    line("object Shadows {", 1)
    for ((label, group) in listOf("day" to "elevation.day", "night" to "elevation.night")) {
        line("val $label = TruthyShadows(", 2)
        names.forEachIndexed { index, name ->
            line("${ids[index]} = ShadowSpec(", 3)
            line("listOf(", 4)
            for (layer in shadowLayers(registry, registry.token("$group.$name"))) line("$layer,", 5)
            line("),", 4)
            line("),", 3)
        }
        line(")", 2)
    }
    line("}", 1)
}

// The additive top-level group "native" of plan A: plain numbers by path (not DTCG, no $value), the values the web
// keeps in component code (reference 5.0 and 5.3). Emitted once as Tokens.Native, so no composable types them again.
private val WHOLE = Regex("^\\d+$")

private val NATIVE_TYPE = listOf(
    "stubStampSize" to listOf("type", "stub-stamp-size"),
    "newBestSize" to listOf("type", "new-best-size"),
    "missedExplanationSize" to listOf("type", "missed-explanation-size"),
    "missedAnswerSize" to listOf("type", "missed-answer-size"),
    "carrierCompactTitle" to listOf("type", "carrier-compact", "title"),
    "carrierCompactLabel" to listOf("type", "carrier-compact", "label"),
    "sourceLinkSize" to listOf("type", "source-link-size"),
    "scoreUnitSize" to listOf("type", "score-unit-size"),
    "timedClockSize" to listOf("type", "timed-clock-size"),
    "stubValueSize" to listOf("type", "stub-value", "size"),
    "stubValueLineHeight" to listOf("type", "stub-value", "lineHeight"),
    "continueDeckLineHeight" to listOf("type", "continue-deck-line-height"),
)

private fun nativeNumber(native: JsonObject, path: List<String>): String {
    val name = "native.${path.joinToString(".")}"
    var node: JsonElement = native
    for (key in path) node = (node as? JsonObject)?.get(key) ?: throw TokenException("Required value $name is missing")
    return numberText(node, name)
}

private fun Writer.nativeObject(root: JsonObject) {
    val native = root["native"] as? JsonObject ?: throw TokenException("Required token group native is missing")
    fun number(vararg path: String): String = nativeNumber(native, path.toList())
    val stops = native["sky-stops"] as? JsonArray ?: throw TokenException("Required value native.sky-stops is missing")
    if (stops.isEmpty()) fail("native.sky-stops", "has no stops")
    val reducedMs = number("sheet", "duration-reduced-ms")
    if (!WHOLE.matches(reducedMs)) fail("native.sheet.duration-reduced-ms", "is not a whole number of milliseconds")
    line("object Native {", 1)
    line("val skyStops: List<Float> = listOf(${stops.joinToString(", ") { floatText(numberText(it, "native.sky-stops")) }})", 2)
    line("val sheetOffsetY = ${number("sheet", "offset-y")}.dp", 2)
    line("const val sheetReducedMs: Int = $reducedMs", 2)
    line("val sheetMinWidth = ${number("sheet", "min-width")}.dp", 2)
    line("val shortScreenBelow = ${number("safe-area-short", "below-height")}.dp", 2)
    line("val shortSafeTop = ${number("safe-area-short", "top")}.dp", 2)
    line("val shortSafeBottom = ${number("safe-area-short", "bottom")}.dp", 2)
    line("val stepTitleRow = ${number("step-title-row")}.dp", 2)
    line("object Type {", 2)
    for ((name, path) in NATIVE_TYPE) line("const val $name: Float = ${floatText(nativeNumber(native, path))}", 3)
    line("}", 2)
    line("}", 1)
}

fun generateTokens(resolvedJson: String): String {
    val parsed = try {
        Json.parseToJsonElement(resolvedJson)
    } catch (error: Exception) {
        throw TokenException("The token file is not valid JSON: ${error.message}")
    }
    val root = parsed as? JsonObject ?: throw TokenException("The design tokens must be a JSON object")
    val registry = Registry(root)

    val colorNames = themedNames(registry, "color.day", "color.night")
    val shadowNames = themedNames(registry, "elevation.day", "elevation.night")

    val out = Writer()
    out.line("// Generated by :tokengen from native-data/tokens/resolved.json. Do not edit by hand.")
    out.line("// Regenerate with: cd android/Truthy && ./gradlew :tokengen:generateTokens")
    out.line()
    out.line("package $DESIGN_PACKAGE")
    out.line()
    out.line("import androidx.compose.animation.core.CubicBezierEasing")
    out.line("import androidx.compose.runtime.Immutable")
    out.line("import androidx.compose.ui.graphics.Color")
    out.line("import androidx.compose.ui.unit.dp")
    out.line()
    out.colorsClass(colorNames)
    out.line()
    out.shadowsClass(shadowNames)
    out.line()
    out.line("object Tokens {")
    out.colorsObject(registry, colorNames)
    out.line()
    out.shadowsObject(registry, shadowNames)
    out.line()
    out.flatObject(registry, "Space", "space") { token ->
        expectType(token, "dimension")
        Member("val", dp(registry, token.value, token.path))
    }
    out.line()
    out.flatObject(registry, "Size", "size") { token ->
        expectType(token, "dimension")
        Member("val", dp(registry, token.value, token.path))
    }
    out.line()
    out.flatObject(registry, "Radius", "radius") { token ->
        expectType(token, "dimension")
        Member("val", dp(registry, token.value, token.path))
    }
    out.line()
    out.flatObject(registry, "Stroke", "stroke") { token ->
        expectType(token, "dimension")
        Member("val", dp(registry, token.value, token.path))
    }
    out.line()
    out.flatObject(registry, "Opacity", "opacity") { token ->
        expectType(token, "number")
        Member("const val", floatText(numberText(registry.deref(token.value, token.path), token.path)))
    }
    out.line()
    out.flatObject(registry, "Duration", "motion.duration") { token ->
        expectType(token, "duration")
        Member("const val", milliseconds(registry, token.value, token.path))
    }
    out.line()
    out.flatObject(registry, "Curves", "motion.easing") { token ->
        expectType(token, "cubicBezier")
        Member("val", cubicBezier(registry, token.value, token.path))
    }
    out.line()
    out.flatObject(registry, "SpringTransitions", "motion.spring") { token -> Member("val", transition(registry, token)) }
    out.line()
    out.flatObject(registry, "Transitions", "motion.transition") { token -> Member("val", transition(registry, token)) }
    out.line()
    out.flatObject(registry, "Gesture", "motion.gesture") { token ->
        when (token.type) {
            "dimension" -> Member("val", dp(registry, token.value, token.path))
            "number" -> Member("const val", floatText(numberText(registry.deref(token.value, token.path), token.path)))
            else -> fail(token.path, "has type ${token.type}, expected dimension or number")
        }
    }
    out.line()
    out.flatObject(registry, "Type", "typography") { token -> Member("val", typeRole(registry, token)) }
    out.line()
    out.nativeObject(root)
    out.line("}")
    return out.text()
}
```

Run:

```bash
cd android/Truthy
./gradlew :tokengen:test
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' tokengen/build/test-results/test/TEST-com.eienmosu.truthy.tokengen.TokenGeneratorTest.xml
```

Expected: `BUILD SUCCESSFUL` and `tests="18" skipped="0" failures="0" errors="0"`.

- [ ] **Step 6: Write the entry point and the freshness test (one of its tests fails: no `Tokens.kt` yet).**

`android/Truthy/tokengen/src/main/kotlin/com/eienmosu/truthy/tokengen/Main.kt`:

```kotlin
package com.eienmosu.truthy.tokengen

import java.io.File
import kotlin.system.exitProcess

// Usage: MainKt <resolved.json> <Tokens.kt>. Run by ./gradlew :tokengen:generateTokens.
fun main(args: Array<String>) {
    if (args.size != 2) {
        System.err.println("Usage: MainKt <resolved.json> <Tokens.kt>")
        exitProcess(2)
    }
    val source = File(args[0])
    val target = File(args[1])
    val text = try {
        generateTokens(source.readText())
    } catch (error: TokenException) {
        System.err.println("tokengen failed: ${error.message}")
        exitProcess(1)
    }
    target.parentFile.mkdirs()
    target.writeText(text)
    println("Wrote ${target.name} (${text.lines().size - 1} lines)")
}
```

`android/Truthy/tokengen/src/test/kotlin/com/eienmosu/truthy/tokengen/TokensFreshnessTest.kt`:

```kotlin
package com.eienmosu.truthy.tokengen

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// The committed Tokens.kt against the real resolved.json. The two paths come from the Gradle build file
// (tokengen/build.gradle.kts) as system properties; nothing here knows where the checkout is.
class TokensFreshnessTest {
    private fun property(name: String): File =
        File(checkNotNull(System.getProperty(name)) { "system property $name is not set; run the test through Gradle" })

    private fun generated(): String = generateTokens(property("truthy.tokens.resolved").readText())

    // The lines of "    object <name> {" up to its closing "    }".
    private fun section(text: String, name: String): List<String> {
        val lines = text.lines()
        val start = lines.indexOf("    object $name {")
        require(start >= 0) { "no object $name in the generated file" }
        val end = lines.subList(start + 1, lines.size).indexOf("    }")
        require(end >= 0) { "object $name is not closed" }
        return lines.subList(start + 1, start + 1 + end)
    }

    private fun members(text: String, name: String): Int =
        section(text, name).count { it.startsWith("        val ") || it.startsWith("        const val ") }

    private fun classFields(text: String, header: String): Int {
        val lines = text.lines()
        val start = lines.indexOf(header)
        require(start >= 0) { "no $header" }
        val end = lines.subList(start + 1, lines.size).indexOf(")")
        return lines.subList(start + 1, start + 1 + end).count { it.startsWith("    val ") }
    }

    @Test
    fun theCommittedFileIsWhatTheGeneratorWrites() {
        val committed = property("truthy.tokens.committed")
        assertTrue("Tokens.kt is missing; run ./gradlew :tokengen:generateTokens", committed.isFile)
        assertEquals(
            "Tokens.kt is stale; run ./gradlew :tokengen:generateTokens and commit the result",
            generated(),
            committed.readText(),
        )
    }

    @Test
    fun theCodesOverridesReachTheConstants() {
        val lines = generated().lines()
        for (expected in listOf(
            // size.max-width: 430 in the code, 390 in the stale tokens.json (reference 5.0)
            "        val maxWidth = 430.dp",
            // typography.list-title: the destination card sets 1.25 itself (reference 5.3)
            "        val listTitle = TypeRole(family = FontKey.SANS, weight = 600, sizeSp = 16f, lineHeight = 1.25f, letterSpacingSp = -0.16f)",
            // the leave sheet: 360 ms ease both ways, no spring (reference 5.0)
            "        val sheetOpen = TransitionSpec(durationMs = 360, delayMs = 0, easing = Curves.ease)",
            "        val sheetClose = TransitionSpec(durationMs = 360, delayMs = 0, easing = Curves.ease)",
            // reference 5.1
            "            sky1 = Color(0xFFA9D6F0),",
            "            sky1 = Color(0xFF0B1528),",
            "            scrim = Color(0xFF10233F).copy(alpha = 0.32f),",
            "            scrim = Color(0xFF000000).copy(alpha = 0.6f),",
            // plan A's native group (reference 5.0 and 5.3)
            "        val skyStops: List<Float> = listOf(0f, 0.35f, 0.62f, 1f)",
            "        const val sheetReducedMs: Int = 140",
            "        val shortScreenBelow = 568.dp",
            "        val stepTitleRow = 36.dp",
            "            const val sourceLinkSize: Float = 13.5f",
        )) {
            assertTrue("missing: $expected", lines.contains(expected))
        }
        assertFalse("the stale frame width must not survive", lines.contains("        val maxWidth = 390.dp"))
    }

    @Test
    fun everyGroupOfTheTokensIsEmitted() {
        val text = generated()
        assertEquals(23, classFields(text, "class TruthyColors("))
        assertEquals(5, classFields(text, "class TruthyShadows("))
        assertEquals(11, members(text, "Space"))
        assertEquals(37, members(text, "Size"))
        assertEquals(5, members(text, "Radius"))
        assertEquals(7, members(text, "Stroke"))
        assertEquals(2, members(text, "Opacity"))
        assertEquals(25, members(text, "Duration"))
        assertEquals(5, members(text, "Curves"))
        assertEquals(3, members(text, "SpringTransitions"))
        assertEquals(15, members(text, "Transitions"))
        assertEquals(5, members(text, "Gesture"))
        assertEquals(35, members(text, "Type"))
        assertEquals(8, members(text, "Native"))
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :tokengen:test
```

Expected: `BUILD FAILED`; `TokensFreshnessTest > theCommittedFileIsWhatTheGeneratorWrites FAILED` with `java.lang.AssertionError: Tokens.kt is missing; run ./gradlew :tokengen:generateTokens`. The other two freshness tests pass (they read `resolved.json` only): if `theCodesOverridesReachTheConstants` fails, plan A's overrides do not match reference 5.0 and 5.3; stop and report instead of changing the expectation. If `everyGroupOfTheTokensIsEmitted` fails on a count, `tokens.json` changed since this plan was written (35 roles, 25 durations, 15 transitions, 37 sizes were counted on 2026-10-15); check the file and update the count together with the reference.

- [ ] **Step 7: Generate `Tokens.kt` and run the tests.**

```bash
cd android/Truthy
./gradlew :tokengen:generateTokens
head -12 app/src/main/kotlin/com/eienmosu/truthy/design/Tokens.kt
./gradlew :tokengen:test
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' tokengen/build/test-results/test/*.xml
```

Expected: a line `Wrote Tokens.kt (` followed by a line count of a few hundred and `lines)`, then the first twelve lines of the file: the two header comments, a blank line, `package com.eienmosu.truthy.design`, a blank line, the four imports, a blank line, `@Immutable` and `class TruthyColors(`. Then `BUILD SUCCESSFUL` and two result lines: `tests="18" skipped="0" failures="0" errors="0"` and `tests="3" skipped="0" failures="0" errors="0"`.

- [ ] **Step 8: Write the hand-kept types the generated file uses and compile the app.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/TokenTypes.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.animation.core.Easing
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp

// The small data types Tokens.kt (generated by :tokengen) is written in. Hand-kept, because the generator
// only prints values.

/** One layer of a CSS-style shadow: offset, blur and spread (negative for the ticket's shadows) and a colour with its alpha. */
@Immutable
class ShadowLayer(val offsetX: Dp, val offsetY: Dp, val blur: Dp, val spread: Dp, val color: Color)

/** A shadow: its layers, painted first to last. */
@Immutable
class ShadowSpec(val layers: List<ShadowLayer>)

/** A web transition token: duration, delay and curve. */
@Immutable
class TransitionSpec(val durationMs: Int, val delayMs: Int, val easing: Easing)

/** The two font families of the design system. */
enum class FontKey { SANS, MONO }

/**
 * A type role: weight, size in sp, line height as a ratio of the size, letter spacing in sp. The letter spacing is
 * the role's px value at the role's own size; a role drawn at another size keeps it (reference 5.3).
 */
@Immutable
data class TypeRole(
    val family: FontKey,
    val weight: Int,
    val sizeSp: Float,
    val lineHeight: Float,
    val letterSpacingSp: Float,
)
```

Run:

```bash
cd android/Truthy
./gradlew :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`. A warning about unused declarations is fine. An error in `Tokens.kt` is a generator defect: fix `TokenGenerator.kt`, keep `TokenGeneratorTest` green, regenerate (`./gradlew :tokengen:generateTokens`) and run again.

- [ ] **Step 9: Gate and commit the generator and `Tokens.kt`.**

```bash
cd android/Truthy
./gradlew :engine:test :tokengen:test :app:testDebugUnitTest :app:assembleDebug
cd ../..
git status --short
git add android/Truthy/settings.gradle.kts android/Truthy/tokengen android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Tokens.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/TokenTypes.kt
git commit -m "feat: generate the Android design tokens from the resolved token file"
```

Expected: `BUILD SUCCESSFUL`; `git status --short` lists only the files of the `git add` (plus nothing under `build/` or `.gradle/`, which are ignored); one commit.

- [ ] **Step 10: Write the fonts' tests (they fail: no font families yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/CmapReader.kt`:

```kotlin
package com.eienmosu.truthy.design

import java.nio.ByteBuffer
import java.nio.ByteOrder

/** The code points a TrueType font maps to a glyph, read from its cmap table (subtable formats 4 and 12). */
internal class CmapReader(bytes: ByteArray) {
    private val data: ByteBuffer = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN)

    private fun u16(at: Int): Int = data.getShort(at).toInt() and 0xFFFF

    private fun u32(at: Int): Long = data.getInt(at).toLong() and 0xFFFFFFFFL

    fun sfntVersion(): Long = u32(0)

    fun codePoints(): Set<Int> {
        val tableCount = u16(4)
        var cmapOffset = -1
        for (index in 0 until tableCount) {
            val record = 12 + 16 * index
            val tag = String(ByteArray(4) { data.get(record + it) }, Charsets.US_ASCII)
            if (tag == "cmap") cmapOffset = u32(record + 8).toInt()
        }
        require(cmapOffset >= 0) { "The font has no cmap table" }
        val found = HashSet<Int>()
        val subtables = u16(cmapOffset + 2)
        for (index in 0 until subtables) {
            val offset = cmapOffset + u32(cmapOffset + 4 + 8 * index + 4).toInt()
            when (u16(offset)) {
                4 -> readFormat4(offset, found)
                12 -> readFormat12(offset, found)
            }
        }
        return found
    }

    private fun readFormat4(offset: Int, found: MutableSet<Int>) {
        val segments = u16(offset + 6) / 2
        val endCodes = offset + 14
        val startCodes = endCodes + 2 * segments + 2
        val deltas = startCodes + 2 * segments
        val rangeOffsets = deltas + 2 * segments
        for (segment in 0 until segments) {
            val end = u16(endCodes + 2 * segment)
            val start = u16(startCodes + 2 * segment)
            val delta = u16(deltas + 2 * segment)
            val rangeOffset = u16(rangeOffsets + 2 * segment)
            for (code in start..end) {
                if (code == 0xFFFF) continue
                val glyph = if (rangeOffset == 0) {
                    (code + delta) and 0xFFFF
                } else {
                    val raw = u16(rangeOffsets + 2 * segment + rangeOffset + 2 * (code - start))
                    if (raw == 0) 0 else (raw + delta) and 0xFFFF
                }
                if (glyph != 0) found.add(code)
            }
        }
    }

    private fun readFormat12(offset: Int, found: MutableSet<Int>) {
        val groups = u32(offset + 12).toInt()
        for (group in 0 until groups) {
            val at = offset + 16 + 12 * group
            val start = u32(at).toInt()
            val end = u32(at + 4).toInt()
            for (code in start..end) found.add(code)
        }
    }
}
```

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/FontsTest.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontListFontFamily
import androidx.compose.ui.text.font.FontStyle
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// Unit tests run with the module directory as the working directory, so the font files and the licence
// are read from their place in the source tree.
class FontsTest {
    private fun weightsOf(family: FontFamily): List<Int> =
        (family as FontListFontFamily).fonts.map { it.weight.weight }

    @Test
    fun overpassSansRequestsWeights600And800Explicitly() {
        assertEquals(listOf(600, 800), weightsOf(OverpassSans))
        assertTrue((OverpassSans as FontListFontFamily).fonts.all { it.style == FontStyle.Normal })
    }

    @Test
    fun overpassMonoRequestsWeights400And600Explicitly() {
        assertEquals(listOf(400, 600), weightsOf(OverpassMono))
        assertTrue((OverpassMono as FontListFontFamily).fonts.all { it.style == FontStyle.Normal })
    }

    // Reference 2.2: the native fonts must cover the typographic marks of the cards and the copy, the middle dot,
    // the section sign, the accented letters and the arrows U+2190 to U+2193, besides printable ASCII.
    @Test
    fun everyFontIsTrueTypeAndCoversTheCharactersTheContentUses() {
        val required = buildSet {
            addAll(0x20..0x7E)
            addAll(listOf(0xA7, 0xB7, 0xC9, 0xE9, 0x2013, 0x2022))
            addAll(0x2018..0x201D)
            addAll(0x2190..0x2193)
        }
        for (name in listOf("overpass_600", "overpass_800", "overpass_mono_400", "overpass_mono_600")) {
            val file = File("src/main/res/font/$name.ttf")
            assertTrue("$file is missing", file.isFile)
            val reader = CmapReader(file.readBytes())
            assertEquals("$name is not a TrueType font", 0x00010000L, reader.sfntVersion())
            val missing = required - reader.codePoints()
            assertTrue("$name lacks " + missing.sorted().joinToString { "U+" + it.toString(16).uppercase().padStart(4, '0') }, missing.isEmpty())
        }
    }

    @Test
    fun theFontLicenceShipsInTheAssets() {
        val licence = File("src/main/assets/licenses/OFL.txt")
        assertTrue("$licence is missing", licence.isFile)
        assertTrue(licence.readText().startsWith("Copyright 2021 The Overpass Project Authors"))
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.FontsTest'
```

Expected: `BUILD FAILED` at `:app:compileDebugUnitTestKotlin` with `Unresolved reference 'OverpassSans'` and `Unresolved reference 'OverpassMono'`.

- [ ] **Step 11: Write the font families.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Fonts.kt` (if task 7 named the font files differently, change the four `R.font.` names here and the four names in `FontsTest`, nothing else):

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import com.eienmosu.truthy.R

// Overpass and Overpass Mono, the static cuts the design uses (SIL OFL 1.1, assets/licenses/OFL.txt).
// Each weight is requested explicitly: the body is 600, not the platform's regular.

val OverpassSans: FontFamily = FontFamily(
    Font(R.font.overpass_600, FontWeight.W600, FontStyle.Normal),
    Font(R.font.overpass_800, FontWeight.W800, FontStyle.Normal),
)

val OverpassMono: FontFamily = FontFamily(
    Font(R.font.overpass_mono_400, FontWeight.W400, FontStyle.Normal),
    Font(R.font.overpass_mono_600, FontWeight.W600, FontStyle.Normal),
)

fun FontKey.family(): FontFamily = when (this) {
    FontKey.SANS -> OverpassSans
    FontKey.MONO -> OverpassMono
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.FontsTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.FontsTest.xml
```

Expected: `BUILD SUCCESSFUL` and `tests="4" skipped="0" failures="0" errors="0"`. If `everyFontIsTrueTypeAndCoversTheCharactersTheContentUses` fails with `lacks U+....`, the font file task 7 committed is the wrong cut or a bad subset: stop and report to task 7's owner (source the full static cut from the upstream Overpass release, spec 6); do not remove a code point from the test.

- [ ] **Step 12: Commit the fonts.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Fonts.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/CmapReader.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/FontsTest.kt
git commit -m "feat: add the Overpass font families and check their glyph coverage"
```

- [ ] **Step 13: Write the type roles' tests (they fail: no `TruthyType` yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/TypeRolesTest.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontSynthesis
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

// The 30 roles the app uses, against reference 5.3 (size, weight, line height ratio) and tokens.json (letter
// spacing in px at the role's own size). list-title carries the code's 1.25.
class TypeRolesTest {
    private class Row(
        val name: String,
        val style: TextStyle,
        val sans: Boolean,
        val weight: Int,
        val size: Float,
        val lineHeight: Float,
        val tracking: Float,
    )

    private val rows = listOf(
        Row("logo", TruthyType.logo, true, 800, 36f, 1f, -0.9f),
        Row("step-title", TruthyType.stepTitle, true, 800, 22f, 1.27f, -0.33f),
        Row("tagline", TruthyType.tagline, true, 600, 17f, 1.4f, 0f),
        Row("card-statement", TruthyType.cardStatement, true, 600, 25f, 1.28f, -0.3f),
        Row("card-name", TruthyType.cardName, true, 800, 26f, 1.2f, -0.39f),
        Row("deck-code", TruthyType.deckCode, false, 600, 30f, 1.2f, 0.6f),
        Row("answer-label", TruthyType.answerLabel, true, 600, 13f, 1.2f, 0f),
        Row("answer-value", TruthyType.answerValue, true, 800, 26f, 1.27f, -0.26f),
        Row("stamp", TruthyType.stamp, true, 800, 24f, 1.27f, -0.24f),
        Row("button", TruthyType.button, true, 800, 20f, 1.27f, -0.2f),
        Row("button-quiet", TruthyType.buttonQuiet, true, 800, 16f, 1.27f, -0.16f),
        Row("button-back", TruthyType.buttonBack, true, 800, 15f, 1.27f, -0.15f),
        Row("carrier-title", TruthyType.carrierTitle, true, 800, 16f, 1.27f, -0.16f),
        Row("carrier-label", TruthyType.carrierLabel, false, 600, 12f, 1.27f, 0.72f),
        Row("leg-code", TruthyType.legCode, false, 600, 34f, 1f, 0.68f),
        Row("leg-name", TruthyType.legName, true, 600, 12f, 1.25f, 0f),
        Row("field-label", TruthyType.fieldLabel, false, 400, 10.5f, 1.27f, 0.42f),
        Row("field-value", TruthyType.fieldValue, false, 600, 15f, 1.27f, 0f),
        Row("field-value-pass", TruthyType.fieldValuePass, true, 800, 16f, 1.2f, -0.16f),
        Row("pass-line", TruthyType.passLine, true, 600, 13f, 1.69f, 0f),
        Row("body", TruthyType.body, true, 600, 15.5f, 1.45f, 0f),
        Row("list-title", TruthyType.listTitle, true, 600, 16f, 1.25f, -0.16f),
        Row("list-statement", TruthyType.listStatement, true, 600, 16f, 1.38f, -0.08f),
        Row("emphasis", TruthyType.emphasis, true, 800, 16f, 1.27f, -0.16f),
        Row("score", TruthyType.score, false, 600, 48f, 1f, 0.96f),
        Row("intent-stamp", TruthyType.intentStamp, false, 600, 26f, 1.27f, 0.52f),
        Row("mono-data", TruthyType.monoData, false, 400, 12f, 1.27f, 0f),
        Row("mono-data-strong", TruthyType.monoDataStrong, false, 600, 13f, 1.27f, 0f),
        Row("mono-caption", TruthyType.monoCaption, false, 400, 11f, 1.27f, 0.44f),
        Row("route-label", TruthyType.routeLabel, false, 400, 11f, 1.27f, 0f),
    )

    private fun family(sans: Boolean): FontFamily = if (sans) OverpassSans else OverpassMono

    @Test
    fun theThirtyUsedRolesMatchReference53() {
        assertEquals(30, rows.size)
        for (row in rows) {
            val style = row.style
            assertSame(row.name, family(row.sans), style.fontFamily)
            assertEquals(row.name, FontWeight(row.weight), style.fontWeight)
            assertEquals(row.name, row.size.sp, style.fontSize)
            assertEquals(row.name, (row.size * row.lineHeight).sp, style.lineHeight)
            assertEquals(row.name, row.tracking.sp, style.letterSpacing)
        }
    }

    // A role drawn at another size keeps its px letter spacing and its line height ratio (reference 5.3),
    // as the web's text-[28px] with the role's leading and tracking tokens does.
    @Test
    fun variantsKeepTheRolesPxTrackingAndScaleItsLineHeight() {
        val stub = TruthyType.stampStub
        assertEquals(28f.sp, stub.fontSize)
        assertEquals((28f * 1.27f).sp, stub.lineHeight)
        assertEquals((-0.24f).sp, stub.letterSpacing)
        assertEquals(FontWeight(800), stub.fontWeight)

        assertEquals(22f.sp, TruthyType.stampBest.fontSize)
        assertEquals(17f.sp, TruthyType.missedAnswer.fontSize)
        assertEquals(800, TruthyType.missedAnswer.fontWeight?.weight)
        assertEquals(15f.sp, TruthyType.missedExplanation.fontSize)
        assertEquals((15f * 1.45f).sp, TruthyType.missedExplanation.lineHeight)
        assertEquals(14f.sp, TruthyType.carrierTitleCompact.fontSize)
        assertEquals((-0.16f).sp, TruthyType.carrierTitleCompact.letterSpacing)
        assertEquals(11f.sp, TruthyType.carrierLabelCompact.fontSize)
        assertEquals(0.66f.sp, TruthyType.carrierLabelCompact.letterSpacing)
        assertEquals(13.5f.sp, TruthyType.sourceLink.fontSize)
        assertSame(OverpassMono, TruthyType.sourceLink.fontFamily)
        assertEquals(20f.sp, TruthyType.scoreUnit.fontSize)
        assertEquals(0f.sp, TruthyType.scoreUnit.letterSpacing)
        assertEquals(13f.sp, TruthyType.timedClock.fontSize)
        assertEquals("tnum", TruthyType.timedClock.fontFeatureSettings)
        assertEquals((16f * 1.27f).sp, TruthyType.stubValue.lineHeight)
        assertSame(OverpassMono, TruthyType.stubValue.fontFamily)
        assertEquals(0.32f.sp, TruthyType.passCode.letterSpacing)
        assertEquals((16f * 1.2f).sp, TruthyType.passCode.lineHeight)
        assertEquals((16f * 1.2f).sp, TruthyType.continueDeckName.lineHeight)
        assertEquals((-0.16f).sp, TruthyType.continueDeckName.letterSpacing)
    }

    @Test
    fun noStyleSynthesisesAWeightOrASlant() {
        val styles = rows.map { it.style } + listOf(
            TruthyType.stampStub, TruthyType.stampBest, TruthyType.missedAnswer, TruthyType.missedExplanation,
            TruthyType.carrierTitleCompact, TruthyType.carrierLabelCompact, TruthyType.sourceLink, TruthyType.scoreUnit,
            TruthyType.timedClock, TruthyType.stubValue, TruthyType.passCode, TruthyType.continueDeckName,
        )
        assertTrue(styles.all { it.fontSynthesis == FontSynthesis.None })
    }

    // 35 roles are defined, 30 used (reference 5.0). The five unused ones stay in the tokens, undrawn.
    @Test
    fun theUnusedRolesStayInTheTokensOnly() {
        assertEquals(24f, Tokens.Type.screenTitle.sizeSp)
        assertEquals(14f, Tokens.Type.bodySmall.sizeSp)
        assertEquals(18f, Tokens.Type.optionTitle.sizeSp)
        assertEquals(18f, Tokens.Type.sectionCode.sizeSp)
        assertEquals(12f, Tokens.Type.sheetTitle.sizeSp)
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.TypeRolesTest'
```

Expected: `BUILD FAILED` at `:app:compileDebugUnitTestKotlin` with `Unresolved reference 'TruthyType'`.

- [ ] **Step 14: Write the type roles.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/TypeRoles.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontSynthesis
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.sp

// The browser puts the extra leading above and below the line; Center with no trim does the same.
private val LINES = LineHeightStyle(
    alignment = LineHeightStyle.Alignment.Center,
    trim = LineHeightStyle.Trim.None,
)

/** The Compose style of a role. Sizes, line height and letter spacing are sp, so they follow the system font scale. */
fun TypeRole.toTextStyle(): TextStyle = TextStyle(
    fontFamily = family.family(),
    fontWeight = FontWeight(weight),
    fontSize = sizeSp.sp,
    lineHeight = (sizeSp * lineHeight).sp,
    letterSpacing = letterSpacingSp.sp,
    fontSynthesis = FontSynthesis.None,
    lineHeightStyle = LINES,
)

/**
 * The type roles the app draws (30 of the 35 in tokens.json) and the sizes the code draws them at that have no
 * role of their own (reference 5.0 and 5.3). Colour is never part of a style; the caller sets it.
 */
object TruthyType {
    val logo = Tokens.Type.logo.toTextStyle()
    val stepTitle = Tokens.Type.stepTitle.toTextStyle()
    val tagline = Tokens.Type.tagline.toTextStyle()
    val cardStatement = Tokens.Type.cardStatement.toTextStyle()
    val cardName = Tokens.Type.cardName.toTextStyle()
    val deckCode = Tokens.Type.deckCode.toTextStyle()
    val answerLabel = Tokens.Type.answerLabel.toTextStyle()
    val answerValue = Tokens.Type.answerValue.toTextStyle()
    val stamp = Tokens.Type.stamp.toTextStyle()
    val button = Tokens.Type.button.toTextStyle()
    val buttonQuiet = Tokens.Type.buttonQuiet.toTextStyle()
    val buttonBack = Tokens.Type.buttonBack.toTextStyle()
    val carrierTitle = Tokens.Type.carrierTitle.toTextStyle()
    val carrierLabel = Tokens.Type.carrierLabel.toTextStyle()
    val legCode = Tokens.Type.legCode.toTextStyle()
    val legName = Tokens.Type.legName.toTextStyle()
    val fieldLabel = Tokens.Type.fieldLabel.toTextStyle()
    val fieldValue = Tokens.Type.fieldValue.toTextStyle()
    val fieldValuePass = Tokens.Type.fieldValuePass.toTextStyle()
    val passLine = Tokens.Type.passLine.toTextStyle()
    val body = Tokens.Type.body.toTextStyle()
    val listTitle = Tokens.Type.listTitle.toTextStyle()
    val listStatement = Tokens.Type.listStatement.toTextStyle()
    val emphasis = Tokens.Type.emphasis.toTextStyle()
    val score = Tokens.Type.score.toTextStyle()
    val intentStamp = Tokens.Type.intentStamp.toTextStyle()
    val monoData = Tokens.Type.monoData.toTextStyle()
    val monoDataStrong = Tokens.Type.monoDataStrong.toTextStyle()
    val monoCaption = Tokens.Type.monoCaption.toTextStyle()
    val routeLabel = Tokens.Type.routeLabel.toTextStyle()

    // Every size and line height below comes from Tokens.Native.Type (plan A's native group), never from a literal.

    // The stamp role at the stub's size (Stamp.tsx) and at the result's New best size (ScoreBlock.tsx).
    val stampStub = Tokens.Type.stamp.copy(sizeSp = Tokens.Native.Type.stubStampSize).toTextStyle()
    val stampBest = Tokens.Type.stamp.copy(sizeSp = Tokens.Native.Type.newBestSize).toTextStyle()

    // The missed cards: the answer word is the emphasis role at 17, the explanation the body role at 15 (MissedCards.tsx).
    val missedAnswer = Tokens.Type.emphasis.copy(sizeSp = Tokens.Native.Type.missedAnswerSize).toTextStyle()
    val missedExplanation = Tokens.Type.body.copy(sizeSp = Tokens.Native.Type.missedExplanationSize).toTextStyle()

    // The compact pass band (FillInPass.tsx): the title at 14 keeps its px tracking; the label at 11 tracks 0.66,
    // tracking-[0.06em] at 11 px, not the role's 0.72 (the one variant whose tracking is its own).
    val carrierTitleCompact = Tokens.Type.carrierTitle.copy(sizeSp = Tokens.Native.Type.carrierCompactTitle).toTextStyle()
    val carrierLabelCompact = Tokens.Type.carrierLabel.copy(sizeSp = Tokens.Native.Type.carrierCompactLabel, letterSpacingSp = 0.66f).toTextStyle()

    // The source link: the strong mono data role at 13.5 (BoardingPass.tsx).
    val sourceLink = Tokens.Type.monoDataStrong.copy(sizeSp = Tokens.Native.Type.sourceLinkSize).toTextStyle()

    // The score's unit: the score role at 20 with no tracking (ScoreBlock.tsx).
    val scoreUnit = Tokens.Type.score.copy(sizeSp = Tokens.Native.Type.scoreUnitSize, letterSpacingSp = 0f).toTextStyle()

    // The Timed clock: the strong mono data role at 13 with tabular figures (TimedPath.tsx).
    val timedClock = Tokens.Type.monoDataStrong.copy(sizeSp = Tokens.Native.Type.timedClockSize).toTextStyle().copy(fontFeatureSettings = "tnum")

    // The card stub value: Mono 600 16 / 1.27 (DestinationCard.tsx). The pass code: Mono 600 16 / 1.2 with 0.02em (FillInPass.tsx).
    val stubValue = TypeRole(FontKey.MONO, 600, Tokens.Native.Type.stubValueSize, Tokens.Native.Type.stubValueLineHeight, 0f).toTextStyle()
    val passCode = TypeRole(FontKey.MONO, 600, 16f, 1.2f, 0.32f).toTextStyle()

    // The continue line's deck name: the emphasis role with line height 1.2 (ContinueLine.tsx).
    val continueDeckName = Tokens.Type.emphasis.copy(lineHeight = Tokens.Native.Type.continueDeckLineHeight).toTextStyle()
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.TypeRolesTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.TypeRolesTest.xml
```

Expected: `BUILD SUCCESSFUL` and `tests="4" skipped="0" failures="0" errors="0"`. If a row of `theThirtyUsedRolesMatchReference53` fails, the message names the role: compare it with `native-data/tokens/resolved.json` and reference 5.3 before touching either side.

- [ ] **Step 15: Commit the type roles.**

```bash
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/TypeRoles.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/TypeRolesTest.kt
git commit -m "feat: add the type roles as Compose text styles"
```

- [ ] **Step 16: Write the theme's tests (they fail: no `resolvedTheme` yet).**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/ThemeTest.kt`:

```kotlin
package com.eienmosu.truthy.design

import android.app.UiModeManager
import android.content.res.Configuration
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import com.eienmosu.truthy.engine.Theme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class ThemeTest {
    private fun rgb(hex: Long): Color = Color(0xFF000000L or hex)

    private fun rgba(hex: Long, alpha: Float): Color = Color(0xFF000000L or hex).copy(alpha = alpha)

    private fun roles(c: TruthyColors): Map<String, Color> = linkedMapOf(
        "sky1" to c.sky1, "sky2" to c.sky2, "sky3" to c.sky3, "sky4" to c.sky4,
        "surface" to c.surface, "surfaceRaised" to c.surfaceRaised, "surfaceSunk" to c.surfaceSunk,
        "surfaceSunkClear" to c.surfaceSunkClear, "ink" to c.ink, "inkMuted" to c.inkMuted, "rule" to c.rule,
        "accent" to c.accent, "onAccent" to c.onAccent, "trueColor" to c.trueColor, "falseColor" to c.falseColor,
        "correct" to c.correct, "wrong" to c.wrong, "onDark" to c.onDark, "cloud" to c.cloud, "scrim" to c.scrim,
        "press" to c.press, "focus" to c.focus, "focusOnFill" to c.focusOnFill,
    )

    // Reference 5.1, role by role.
    @Test
    fun dayAndNightColoursMatchReference51() {
        val day = linkedMapOf(
            "sky1" to rgb(0xA9D6F0), "sky2" to rgb(0xC4E3F5), "sky3" to rgb(0xDDEFF8), "sky4" to rgb(0xF3F0E6),
            "surface" to rgb(0xC4E3F5), "surfaceRaised" to rgb(0xFDFBF5), "surfaceSunk" to rgb(0xEEF3F5),
            "surfaceSunkClear" to rgba(0xEEF3F5, 0f), "ink" to rgb(0x10233F), "inkMuted" to rgb(0x56667C),
            "rule" to rgb(0xC9D3DC), "accent" to rgb(0xF5B400), "onAccent" to rgb(0x10233F),
            "trueColor" to rgb(0x1D5CC0), "falseColor" to rgb(0xB3321C), "correct" to rgb(0x0D7250),
            "wrong" to rgb(0xB3321C), "onDark" to rgb(0xFDFBF5), "cloud" to rgb(0xFFFFFF),
            "scrim" to rgba(0x10233F, 0.32f), "press" to rgba(0x10233F, 0.05f), "focus" to rgb(0x10233F),
            "focusOnFill" to rgb(0x10233F), // plan A override: the ink ring, as color.focus (reference 5.6)
        )
        val night = linkedMapOf(
            "sky1" to rgb(0x0B1528), "sky2" to rgb(0x101C33), "sky3" to rgb(0x15233D), "sky4" to rgb(0x1C2538),
            "surface" to rgb(0x101C33), "surfaceRaised" to rgb(0x252F41), "surfaceSunk" to rgb(0x1D2636),
            "surfaceSunkClear" to rgba(0x1D2636, 0f), "ink" to rgb(0xE6E3DA), "inkMuted" to rgb(0x9BA4B3),
            "rule" to rgb(0x3C4759), "accent" to rgb(0xE0A52C), "onAccent" to rgb(0x141C2B),
            "trueColor" to rgb(0x6F9AE0), "falseColor" to rgb(0xE2836F), "correct" to rgb(0x55B88E),
            "wrong" to rgb(0xE2836F), "onDark" to rgb(0x0F1A2C), "cloud" to rgb(0x2C3A55),
            "scrim" to rgba(0x000000, 0.6f), "press" to rgba(0xE6E3DA, 0.06f), "focus" to rgb(0xE6E3DA),
            "focusOnFill" to rgb(0xE6E3DA), // plan A override: the ink ring, as color.focus
        )
        assertEquals(23, day.size)
        assertEquals(day, roles(Tokens.Colors.day))
        assertEquals(night, roles(Tokens.Colors.night))
    }

    @Test
    fun withNothingStoredTheSystemDecides() {
        val light = resolvedTheme(null, false)
        val dark = resolvedTheme(null, true)
        assertEquals(Theme.LIGHT, light.theme)
        assertEquals(Theme.DARK, dark.theme)
        assertFalse(light.isDark)
        assertTrue(dark.isDark)
        assertSame(Tokens.Colors.day, light.colors)
        assertSame(Tokens.Colors.night, dark.colors)
    }

    // Review Focus 3: the stored theme is the opposite of the system theme. The choice wins, in both directions.
    @Test
    fun aStoredThemeBeatsTheSystemTheme() {
        val darkOnALightSystem = resolvedTheme(Theme.DARK, false)
        assertEquals(Theme.DARK, darkOnALightSystem.theme)
        assertSame(Tokens.Colors.night, darkOnALightSystem.colors)
        assertSame(Tokens.Shadows.night, darkOnALightSystem.shadows)

        val lightOnADarkSystem = resolvedTheme(Theme.LIGHT, true)
        assertEquals(Theme.LIGHT, lightOnADarkSystem.theme)
        assertSame(Tokens.Colors.day, lightOnADarkSystem.colors)
        assertSame(Tokens.Shadows.day, lightOnADarkSystem.shadows)

        assertEquals(Theme.DARK, resolvedTheme(Theme.DARK, true).theme)
        assertEquals(Theme.LIGHT, resolvedTheme(Theme.LIGHT, false).theme)
    }

    // The window background and the launch screen use the surface colour of the theme: #c4e3f5 by day, #101c33 at night.
    @Test
    fun theWindowBackgroundIsTheSurfaceColourOfTheTheme() {
        assertEquals(0xFFC4E3F5L.toInt(), resolvedTheme(Theme.LIGHT).colors.surface.toArgb())
        assertEquals(0xFF101C33L.toInt(), resolvedTheme(Theme.DARK).colors.surface.toArgb())
    }

    @Test
    fun theThemeCarriesItsOwnShadows() {
        assertSame(Tokens.Shadows.day, resolvedTheme(Theme.LIGHT).shadows)
        assertSame(Tokens.Shadows.night, resolvedTheme(Theme.DARK).shadows)
        assertEquals(2, Tokens.Shadows.day.ticket.layers.size)
        assertEquals(1, Tokens.Shadows.day.press.layers.size)
    }

    @Test
    fun theNightModeHandedToTheSystemFollowsTheStoredTheme() {
        assertEquals(UiModeManager.MODE_NIGHT_YES, nightModeFor(Theme.DARK))
        assertEquals(UiModeManager.MODE_NIGHT_NO, nightModeFor(Theme.LIGHT))
        assertEquals(2, nightModeFor(Theme.DARK))
        assertEquals(1, nightModeFor(Theme.LIGHT))
    }

    @Test
    fun theSystemsNightBitIsReadFromTheUiMode() {
        assertTrue(isNightUiMode(Configuration.UI_MODE_NIGHT_YES))
        assertTrue(isNightUiMode(Configuration.UI_MODE_NIGHT_YES or Configuration.UI_MODE_TYPE_NORMAL))
        assertFalse(isNightUiMode(Configuration.UI_MODE_NIGHT_NO))
        assertFalse(isNightUiMode(Configuration.UI_MODE_NIGHT_UNDEFINED))
        assertFalse(isNightUiMode(Configuration.UI_MODE_TYPE_NORMAL))
    }
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.ThemeTest'
```

Expected: `BUILD FAILED` at `:app:compileDebugUnitTestKotlin` with `Unresolved reference 'resolvedTheme'`, `'nightModeFor'` and `'isNightUiMode'`.

- [ ] **Step 17: Write the theme resolution and the composition locals.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Theme.kt`:

```kotlin
package com.eienmosu.truthy.design

import androidx.compose.foundation.IndicationNodeFactory
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.LocalOverscrollFactory
import androidx.compose.foundation.rememberPlatformOverscrollFactory
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.node.DelegatableNode
import androidx.compose.ui.node.DrawModifierNode
import com.eienmosu.truthy.engine.Theme
import com.eienmosu.truthy.engine.resolveTheme

/** The theme the player sees: which one, and its colours and shadows. Two instances exist, one per theme. */
@Immutable
class ResolvedTheme internal constructor(
    val theme: Theme,
    val colors: TruthyColors,
    val shadows: TruthyShadows,
) {
    val isDark: Boolean get() = theme == Theme.DARK
}

private val LIGHT_THEME = ResolvedTheme(Theme.LIGHT, Tokens.Colors.day, Tokens.Shadows.day)
private val DARK_THEME = ResolvedTheme(Theme.DARK, Tokens.Colors.night, Tokens.Shadows.night)

fun resolvedTheme(theme: Theme): ResolvedTheme = when (theme) {
    Theme.LIGHT -> LIGHT_THEME
    Theme.DARK -> DARK_THEME
}

/** The web's rule: a stored choice wins over the system setting; with none, the system decides. */
fun resolvedTheme(stored: Theme?, systemDark: Boolean): ResolvedTheme = resolvedTheme(resolveTheme(stored, systemDark))

val LocalResolvedTheme = staticCompositionLocalOf { resolvedTheme(Theme.LIGHT) }

/** No press indication at all. Foundation's default draws a debug overlay; the app's controls draw their own press feedback. */
object NoIndication : IndicationNodeFactory {
    override fun create(interactionSource: InteractionSource): DelegatableNode = NoIndicationNode()

    override fun hashCode(): Int = -1

    override fun equals(other: Any?): Boolean = other === this
}

private class NoIndicationNode : Modifier.Node(), DrawModifierNode {
    override fun ContentDrawScope.draw() {
        drawContent()
    }
}

/**
 * Provides the resolved theme, turns the default press indication off for everything below, and gives the
 * overscroll edge glow of API 26 to 30 the ink colour (spec 5.6; API 31 and later stretch, the platform's).
 */
@Composable
fun TruthyTheme(theme: ResolvedTheme, content: @Composable () -> Unit) {
    CompositionLocalProvider(
        LocalResolvedTheme provides theme,
        LocalIndication provides NoIndication,
        LocalOverscrollFactory provides rememberPlatformOverscrollFactory(glowColor = theme.colors.ink),
        content = content,
    )
}

/** The current theme, read in composition. */
object TruthyTheme {
    val resolved: ResolvedTheme
        @Composable @ReadOnlyComposable get() = LocalResolvedTheme.current

    val colors: TruthyColors
        @Composable @ReadOnlyComposable get() = LocalResolvedTheme.current.colors

    val shadows: TruthyShadows
        @Composable @ReadOnlyComposable get() = LocalResolvedTheme.current.shadows

    val isDark: Boolean
        @Composable @ReadOnlyComposable get() = LocalResolvedTheme.current.isDark
}
```

- [ ] **Step 18: Write the night-mode and window functions.**

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/NightMode.kt`:

```kotlin
package com.eienmosu.truthy.design

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import androidx.annotation.RequiresApi
import com.eienmosu.truthy.engine.Theme

/** The UiModeManager night mode that makes the app's resources, and on Android 12 and later its splash, follow a stored theme. */
fun nightModeFor(theme: Theme): Int =
    if (theme == Theme.DARK) UiModeManager.MODE_NIGHT_YES else UiModeManager.MODE_NIGHT_NO

/** Whether a configuration's uiMode says night. */
fun isNightUiMode(uiMode: Int): Boolean =
    (uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

/**
 * Hands a stored theme to the system for this app (Android 12 and later; below that the splash follows the system).
 * With nothing stored nothing is set: the system decides, as on the web. The system keeps the setting, so calling
 * this again with the same theme changes nothing.
 */
fun applyStoredNightMode(context: Context, stored: Theme?) {
    if (stored == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    setApplicationNightMode(context, nightModeFor(stored))
}

@RequiresApi(Build.VERSION_CODES.S)
private fun setApplicationNightMode(context: Context, mode: Int) {
    val manager = context.getSystemService(UiModeManager::class.java) ?: return
    manager.setApplicationNightMode(mode)
}
```

`android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/WindowTheme.kt`:

```kotlin
package com.eienmosu.truthy.design

import android.graphics.drawable.ColorDrawable
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.toArgb
import com.eienmosu.truthy.applySystemBars
import com.eienmosu.truthy.engine.Theme

/**
 * Edge to edge and the bar icons from the app's theme (not the system's), through task 7's applySystemBars
 * (spec 5.6: enableEdgeToEdge with SystemBarStyle.auto, no enforced navigation bar contrast), then the window
 * background. Call it again whenever the theme changes.
 */
fun applyWindowTheme(activity: ComponentActivity, theme: ResolvedTheme) {
    activity.applySystemBars(dark = theme.isDark)
    activity.window.setBackgroundDrawable(ColorDrawable(theme.colors.surface.toArgb()))
}

/**
 * Everything the first frame needs, in the order it needs it: the stored theme to the system, the theme the
 * player sees (a stored choice, else the system's night bit), then the window. Call it in onCreate before
 * setContent (task 11) and use the result as the initial theme.
 */
fun bootTheme(activity: ComponentActivity, stored: Theme?): ResolvedTheme {
    applyStoredNightMode(activity, stored)
    val systemDark = isNightUiMode(activity.resources.configuration.uiMode)
    val resolved = resolvedTheme(stored, systemDark)
    applyWindowTheme(activity, resolved)
    return resolved
}
```

Run:

```bash
cd android/Truthy
./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.design.ThemeTest'
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.ThemeTest.xml
```

Expected: `BUILD SUCCESSFUL` and `tests="7" skipped="0" failures="0" errors="0"`. If `dayAndNightColoursMatchReference51` fails, the assertion output is a map diff naming the role; the expected side is reference 5.1 and the actual side is the generated `Tokens.kt`, so the defect is in `resolved.json` or the generator, never in the test.

- [ ] **Step 19: Run every gate.**

```bash
cd android/Truthy
./gradlew :engine:test :tokengen:test :app:testDebugUnitTest :app:assembleDebug
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' tokengen/build/test-results/test/*.xml app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.design.*.xml
```

Expected: `BUILD SUCCESSFUL`. The result lines (in file name order): `tests="18"` (`TokenGeneratorTest`), `tests="3"` (`TokensFreshnessTest`), `tests="4"` (`FontsTest`), `tests="7"` (`ThemeTest`), `tests="4"` (`TypeRolesTest`), all with `skipped="0" failures="0" errors="0"`. The app tests of tasks 7 and later that already exist stay green (their result files are not in this list).

- [ ] **Step 20: Check the generated file once more for hygiene, then commit the theme.**

```bash
grep -c '' android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Tokens.kt
grep -n 'TODO\|FIXME' android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/*.kt || echo "no markers"
git add android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/Theme.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/NightMode.kt android/Truthy/app/src/main/kotlin/com/eienmosu/truthy/design/WindowTheme.kt android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/design/ThemeTest.kt
git commit -m "feat: resolve the theme from the stored choice and set up the window from it"
git status --short
git log --oneline -4
pnpm vitest run tests/repo-hygiene.test.ts
pnpm test
```

Expected: a line count of a few hundred; `no markers`; one commit; `git status --short` prints nothing; the log shows the four commits of this task in order (generator and tokens, fonts, type roles, theme); the web's hygiene test reads every tracked file, the new Kotlin, JSON and Gradle files included, and passes with `Test Files  1 passed (1)`; `pnpm test` passes every Vitest file (README, Global Constraints).

What the next tasks rely on from this one, and the checks that are not in this task: task 10 uses `Tokens`, `TruthyTheme.colors`, `TruthyTheme.shadows`, `TruthyType` and `Curves` for every shape and button; task 11 calls `bootTheme(this, themeStore.stored)` in `onCreate` before `setContent`, keeps a `StateFlow<ResolvedTheme>` and calls `applyWindowTheme` and `applyStoredNightMode` again when the switch is pressed; task 15 records the stored-theme-opposite-of-system screenshots (feel item N12) on API 36 and on an API below 31, where the splash follows the system and everything the app draws follows the stored theme.
