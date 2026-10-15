### Task 16: R8, the release signing config, the keystore and its backup, the release APK played on API 36 and 26

Everything before this task runs the debug build. R8 renames, merges and removes code and resources, and the failures that follow (a serializer that was stripped, a font that was dropped, a debug-only path that survived) show only in the release build, which is why spec section 9 says the minified build is played through once. This task turns on R8 and resource shrinking for the release build type, adds a signing config that reads its credentials from the user's Gradle properties and applies only when they exist, creates a new keystore outside the repository and backs it up, builds the signed APK, checks the file itself (signature, certificate, not debuggable, R8 outputs, no `DebugLaunch`), and then plays it on an API 36 and an API 26 emulator with a small adb driver: install, open at start step 1, play a round of each class, check the progress file the app left behind, kill the app in the middle of a round and check that the next launch applies the journal (Review Focus 2, here on the minified build), and scan logcat.

A release build is not debuggable, so `run-as` and the debug launch extras of task 11 do not exist on it. The driver therefore reads the screen with `uiautomator dump`, taps and swipes with `adb shell input`, and reads the app's private folder with `adb root`, which needs a Google APIs emulator image (not a Google Play image). It finds what to tap by the labels of reference 4.5, so it also proves that those labels reach the accessibility tree of the real release build.

**This task was not compiled during drafting.** Nothing in this file was compiled or run while the plan was written, so the Kotlin test, the Gradle block and the keep rules were checked by reading against the Android Gradle Plugin documentation, the kotlinx-serialization README and the build script of the owner's other Android project (The Slow Wire, which builds with AGP 9.3.2 and the same signing pattern), never by a compiler. What did run during drafting is the Node side: the four tool modules and their 29 tests ran under Node 24 (every test file also fails first with `Cannot find module`), the `apksigner` and `aapt2` parsers were checked against strings taken from the real `apksigner.jar` of build-tools 36.0.0 and the real `aapt2 dump badging` output of an existing debug and release APK, and the driver ran end to end against a simulated phone in its own test. Nothing ran against a real emulator or a real keystore. If a Gradle or Kotlin line is rejected, fix the line and keep the behaviour the step states.

Builds on tasks 1 to 15: the debug gates are green, the app launches at start step 1, the labels of reference 4.5 are exposed to accessibility, rounds of all four classes play, results record, the round journal is written on each answer and applied at launch (tasks 9 and 11), and the API 36 and API 26 emulators of task 15 exist.

**Files:**
- Create: `android/Truthy/app/proguard-rules.pro`, `android/Truthy/RELEASE.md`
- Create: `android/Truthy/tools/release/keystore.mjs`, `android/Truthy/tools/release/checks.mjs`, `android/Truthy/tools/release/ui.mjs`, `android/Truthy/tools/release/playthrough.mjs`
- Modify: `android/Truthy/app/build.gradle.kts` (append one block), `android/Truthy/.gitignore` (append three lines)
- Test: create `android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/ReleaseConfigTest.kt`, `android/Truthy/tools/release/keystore.test.mjs`, `android/Truthy/tools/release/checks.test.mjs`, `android/Truthy/tools/release/ui.test.mjs`, `android/Truthy/tools/release/playthrough.test.mjs`
- Created by this task but never in git: `~/keystores/truthy-release.jks`, four lines in `~/.gradle/gradle.properties`, two backup folders chosen by the owner, the play-through output (screenshots and log) under `$TMPDIR`.

**Interfaces:**
- Consumes, from earlier tasks (step 1 checks each): the `:app` module and `android/Truthy/app/build.gradle.kts` of task 7 (a `release` build type from the template is fine, a `signingConfigs` block is not); `android/Truthy/.gitignore` of task 1; `repositoryRoot()` in `com.eienmosu.truthy.support` (task 9, test support); the file names `truthy.progress.v1.json` and `truthy.round.v1.json` and the record key `{deckId}/{sectionId}#{mode wire}` (task 9, reference 3.5); the accessibility labels of reference 4.5 on the start flow, the round and the result (tasks 10 to 14); `DebugLaunch` (README), which must not exist in the release build.
- Produces (nothing later in this plan relies on it; it is the end of plan C):

```text
Gradle user properties (names fixed here, set by keystore.mjs create):
  TRUTHY_STORE_FILE, TRUTHY_STORE_PASSWORD, TRUTHY_KEY_ALIAS, TRUTHY_KEY_PASSWORD
Keystore: ~/keystores/truthy-release.jks, PKCS12, RSA 2048, alias "truthy", 10000 days
APK: android/Truthy/app/build/outputs/apk/release/app-release.apk (app-release-unsigned.apk when the properties are missing)
```

```js
// android/Truthy/tools/release/keystore.mjs
export const ALIAS, KEYSTORE_NAME, PROPERTY_NAMES
export function paths(home?): { dir, keystore, gradleProps }
export function parseProperties(text): Record<string, string>
export function parseKeytoolSha256(text): string | null
export function createKeystore({ home?, run? }): { keystore, alias, properties, gradleProps }
export function fingerprint({ home?, run? }): string | null
export function backupKeystore({ home?, destination, run? }): { destination, copy, sha256, problems }
export function verifyBackup({ home?, destination, run? }): string[]
// android/Truthy/tools/release/checks.mjs
export function parseApksigner(text), signingProblems(parsed, expectedSha256)
export function parseBadging(text), badgingProblems(parsed, expected)
export function scanLogcat(text, { pkg, pids }), checkProgress(raw, options), checkJournal(raw, { minAnswers })
// android/Truthy/tools/release/ui.mjs
export function parseNodes(xml), centre(node), findNode(nodes, pattern), tapPlan(nodes, pattern)
export function screenOf(nodes), chooseStartTarget(nodes, wantedClass)
// android/Truthy/tools/release/playthrough.mjs
export const PKG, FILES, PROGRESS_FILE, JOURNAL_FILE, CLASSES
export function createDevice({ adb, clock }), walkToRound(device, clock, className), playRound(device, clock, options)
export async function run({ adb, clock, apk, outDir, log }): Promise<string[]>   // the names of the failed stages
```

**Rules:**

1. **Spec 9.** R8 and resource shrinking on the release build type. The signing config applies only when all four Gradle properties exist; without them `assembleRelease` still builds, unsigned, and every debug task is unaffected. No password, store path or key file name is written in a committed file. The keystore, the passwords and the backup copies are never in git; plan A's hygiene rejects signing files by type and `.gitignore` lists them too.
2. **The keystore** is PKCS12 with an RSA 2048 key, alias `truthy`, valid 10000 days, and one random 48 character hex password used for the store and the key. `keytool` gets the password through an environment variable (`-storepass:env`), never as an argument, so it is not visible in a process list. The keystore file is mode 600, its folder 700, and the properties file is set to 600. No command except `password` prints the password, and `password` is for the owner only: the executing agent never runs it, never prints `~/.gradle/gradle.properties` and never pastes a password anywhere.
3. **The backup.** A copy of the keystore in two folders outside the repository, each with a `.sha256` file and a `RESTORE.txt` without secrets. The keystore is itself encrypted by its password, so a copy is safe in a cloud-synced folder as long as the password is not stored next to it; the password goes into the owner's password manager. A backup counts only after `verify` passes: same bytes, same recorded hash, same certificate fingerprint read by `keytool`.
4. **The release is not debuggable** and has no debug launch path: `application-debuggable` is absent from the badging; the parser of the debug extras (`parseDebugLaunch` and the rest of the file class `DebugLaunchKt`) is absent from `mapping.txt`, because task 11 reads the extras behind `BuildConfig.DEBUG`, a compile-time constant R8 folds to false; and no dex file of the APK holds the extra's key `truthy.seed`. The `DebugLaunch` data class itself may remain: the controller's types name it, but nothing in the release build can make one, so it is inert.
5. **The play-through** plays the release APK as a person does. Swipes start at 30 percent of the screen width, away from the system gesture inset. It waits 400 ms or more between actions, because the start flow ignores taps for 250 ms after a step appears and the next and result rows for 420 and 1000 ms. It takes the first area, platform, deck and section (the whole deck) it finds, so a fresh install and a played one walk the same way. It swipes True every time: Streak and Three lives end by themselves at the first wrong answer and the third, Timed ends when its minute runs out.
6. **What a pass means** per class: the result screen shows, `truthy.progress.v1.json` reads back with a record for the class (`#classic`, `#streak`, `#lives`, `#timed`) and `last` with a score and a total, and `truthy.round.v1.json` is gone. After the kill: the next launch is at step 1, `last` is the killed round with score and total null, and the journal is gone.
7. If the play-through fails because a label is missing from the accessibility tree, the fix belongs to the task that drew that element (reference 4.5 states the label), not to the driver.

**Assumed from other tasks:** `repositoryRoot()` of task 9; `android/Truthy/.gitignore` from task 1; the launcher activity and the labels from tasks 10 to 14; the emulators of task 15 (their names are listed in step 29, not assumed); the engine's `Progress` and the app's `JournalEntry` are `@Serializable` classes in `com.eienmosu.truthy.engine` and `com.eienmosu.truthy` (step 8 greps for their companions).

**Steps:**

- [ ] **Step 1: Check the starting state.**

```bash
git branch --show-current
git status --short
java -version 2>&1 | head -1
keytool -help 2>&1 | head -1
node --version
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ls "$ANDROID_HOME/platform-tools/adb" "$ANDROID_HOME/emulator/emulator" "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"
ls "$ANDROID_HOME/build-tools"
grep -n 'signingConfigs\|isMinifyEnabled\|proguardFiles\|versionCode\|versionName' android/Truthy/app/build.gradle.kts
ls android/Truthy/app/proguard-rules.pro 2>&1 | head -1
cat android/Truthy/.gitignore
grep -c '^TRUTHY_' ~/.gradle/gradle.properties
ls ~/keystores/truthy-release.jks 2>&1 | head -1
(cd android/Truthy && ./gradlew :engine:test :app:testDebugUnitTest :app:assembleDebug)
```

Expected:
- `native`; `git status --short` prints nothing; a JDK 17 or later line; keytool's usage line (not an error); a Node version starting `v24`.
- The three SDK tools exist and `build-tools` lists at least one version.
- The `grep` prints no `signingConfigs` line. A `release` block from the module template (`isMinifyEnabled = false`, a `proguardFiles` line) is fine, this task's block overrides it. If a `signingConfigs` line exists, stop and report: the signing is already set up somewhere.
- `proguard-rules.pro`: `No such file or directory`, or an existing file that only holds comments (step 4 replaces the whole content).
- The `.gitignore` is printed. `grep -c '^TRUTHY_'` prints `0` (or `No such file` when the properties file does not exist). Any other number means a Truthy keystore was set up before: stop and ask the owner, never overwrite it. The `ls` of the keystore says `No such file or directory`.
- The last command ends `BUILD SUCCESSFUL`. If it does not, the earlier tasks are not done: stop.

- [ ] **Step 2: Write the release configuration test.**

`android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/ReleaseConfigTest.kt`:

```kotlin
package com.eienmosu.truthy

import com.eienmosu.truthy.support.repositoryRoot
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// Spec 9: the release build is shrunk with R8 and signed from properties that live outside the repository.
// These tests read the committed files. The build itself is checked by running it (steps 7, 8 and 17 of task 16).
class ReleaseConfigTest {
    private val project = File(repositoryRoot(), "android/Truthy")
    private val buildScript: String get() = File(project, "app/build.gradle.kts").readText()
    private val rules: String get() = File(project, "app/proguard-rules.pro").readText()

    // The last assignment of a flag wins: the release block of this task comes after the template of task 7.
    private fun lastFlag(name: String): String? =
        Regex("$name\\s*=\\s*(true|false)").findAll(buildScript).lastOrNull()?.groupValues?.get(1)

    @Test
    fun releaseTurnsOnR8AndResourceShrinking() {
        assertEquals("true", lastFlag("isMinifyEnabled"))
        assertEquals("true", lastFlag("isShrinkResources"))
    }

    @Test
    fun releaseUsesTheOptimizingDefaultRulesAndTheProjectFile() {
        assertTrue(buildScript.contains("getDefaultProguardFile(\"proguard-android-optimize.txt\")"))
        assertTrue(buildScript.contains("\"proguard-rules.pro\""))
        assertFalse(Regex("\"proguard-android\\.txt\"").containsMatchIn(buildScript), "AGP 9 dropped proguard-android.txt")
    }

    @Test
    fun signingReadsFourGradlePropertiesAndOnlyAppliesWhenAllExist() {
        for (name in listOf("TRUTHY_STORE_FILE", "TRUTHY_STORE_PASSWORD", "TRUTHY_KEY_ALIAS", "TRUTHY_KEY_PASSWORD")) {
            assertTrue(buildScript.contains("providers.gradleProperty(\"$name\")"), name)
        }
        val guard = "if (releaseSigningReady)"
        assertTrue(buildScript.split(guard).size - 1 >= 2, "the signing config and its use must both sit behind $guard")
        val lastGuard = buildScript.lastIndexOf(guard)
        val use = buildScript.indexOf("signingConfig = signingConfigs.getByName(\"release\")")
        assertTrue(use > lastGuard && lastGuard >= 0, "the release build type must use the signing config inside the guard")
        assertFalse(buildScript.substring(lastGuard, use).contains("}"), "the use must be directly inside the guard")
    }

    @Test
    fun noSecretIsWrittenInTheBuildScript() {
        assertFalse(Regex("(storePassword|keyPassword)\\s*=\\s*\"").containsMatchIn(buildScript))
        assertFalse(buildScript.contains(".jks"))
        assertFalse(buildScript.contains(".keystore"))
    }

    @Test
    fun theGitignoreKeepsSigningFilesOutOfGit() {
        val lines = File(project, ".gitignore").readLines().map { it.trim() }
        for (pattern in listOf("*.jks", "*.keystore", "keystore.properties")) {
            assertTrue(lines.contains(pattern), "android/Truthy/.gitignore lacks $pattern")
        }
    }

    @Test
    fun theRulesKeepTheSerializersAndTheStackTraceMapping() {
        val flat = rules.replace(Regex("\\s+"), " ")
        assertTrue(flat.contains("-keepattributes InnerClasses"))
        assertTrue(flat.contains("-keepclassmembers class com.eienmosu.truthy.** { *** Companion; }"))
        assertTrue(flat.contains("-keepclasseswithmembers class com.eienmosu.truthy.** { kotlinx.serialization.KSerializer serializer(...); }"))
        assertTrue(flat.contains("-keepattributes SourceFile, LineNumberTable"))
        assertTrue(flat.contains("-renamesourcefileattribute SourceFile"))
    }

    @Test
    fun theManifestDoesNotMakeTheAppDebuggable() {
        val manifest = File(project, "app/src/main/AndroidManifest.xml").readText()
        assertFalse(manifest.contains("android:debuggable"))
    }
}
```

- [ ] **Step 3: Run it and see it fail.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.ReleaseConfigTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.ReleaseConfigTest.xml
```

Expected: `BUILD FAILED` with `There were failing tests`, and `tests="7" skipped="0" failures="4"` or `failures="5"`. Failing: `releaseTurnsOnR8AndResourceShrinking` (`expected:<true> but was:<false>` or `<null>`), `signingReadsFourGradlePropertiesAndOnlyAppliesWhenAllExist`, `theGitignoreKeepsSigningFilesOutOfGit` and `theRulesKeepTheSerializersAndTheStackTraceMapping` (a missing or comment-only `proguard-rules.pro`). `releaseUsesTheOptimizingDefaultRulesAndTheProjectFile` fails only when the module template has no `proguardFiles` line. `noSecretIsWrittenInTheBuildScript` and `theManifestDoesNotMakeTheAppDebuggable` pass.

- [ ] **Step 4: Write the keep rules and the ignore lines.**

Replace the whole content of `android/Truthy/app/proguard-rules.pro`:

```text
# Truthy release rules for R8. The libraries ship their own consumer rules (kotlinx-serialization, Compose,
# AndroidX). These lines cover the app's own @Serializable classes (the engine's content and progress types,
# the round journal) and keep stack traces readable through mapping.txt.

# Every @Serializable class has a Companion that holds its generated serializer(). Looking one up by name
# needs the InnerClasses attribute, and R8 cannot see that link, so both are kept.
-keepattributes InnerClasses
-keepclassmembers class com.eienmosu.truthy.** {
    *** Companion;
}
-keepclasseswithmembers class com.eienmosu.truthy.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Stack traces: keep the line numbers and hide the file names, then retrace with mapping.txt.
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile
```

Append to `android/Truthy/.gitignore` (a leading blank line keeps the lines apart whatever the file ends with):

```bash
cat >> android/Truthy/.gitignore <<'GITIGNORE'

*.jks
*.keystore
keystore.properties
GITIGNORE
```

- [ ] **Step 5: Add the release block to the app's build script.**

Append this block to the end of `android/Truthy/app/build.gradle.kts`. A second `android { }` block is valid in the Gradle Kotlin DSL and its assignments run after the earlier ones, so it needs no edit of the template's own `release` block.

```bash
cat >> android/Truthy/app/build.gradle.kts <<'GRADLE'

// Release build (spec 9). R8 shrinks and renames the code and the resources. The signing credentials come
// from the user's Gradle properties (the file in the Gradle user home), never from this repository: with
// all four present the release APK is signed, otherwise assembleRelease still builds, unsigned, so a machine
// without the keystore builds everything. The assignments in this block come last and win over any release
// block earlier in the file.
val releaseStoreFile: String? = providers.gradleProperty("TRUTHY_STORE_FILE").orNull
val releaseStorePassword: String? = providers.gradleProperty("TRUTHY_STORE_PASSWORD").orNull
val releaseKeyAlias: String? = providers.gradleProperty("TRUTHY_KEY_ALIAS").orNull
val releaseKeyPassword: String? = providers.gradleProperty("TRUTHY_KEY_PASSWORD").orNull
val releaseSigningReady: Boolean =
    listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword).all { !it.isNullOrBlank() }

android {
    signingConfigs {
        if (releaseSigningReady) {
            create("release") {
                storeFile = file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (releaseSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}
GRADLE
```

- [ ] **Step 6: Run the test and see it pass.**

```bash
(cd android/Truthy && ./gradlew :app:testDebugUnitTest --tests 'com.eienmosu.truthy.ReleaseConfigTest')
grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*"' android/Truthy/app/build/test-results/testDebugUnitTest/TEST-com.eienmosu.truthy.ReleaseConfigTest.xml
```

Expected: `BUILD SUCCESSFUL` and `tests="7" skipped="0" failures="0"`. If Kotlin rejects the block (a type or a name the Android Gradle Plugin of task 1 spells differently), fix the block against the plugin's DSL and keep the test unchanged.

- [ ] **Step 7: Build the release without the properties.**

```bash
(cd android/Truthy && ./gradlew :app:assembleRelease)
ls android/Truthy/app/build/outputs/apk/release/
ls android/Truthy/app/build/outputs/mapping/release/
```

Expected: `BUILD SUCCESSFUL`; the APK folder holds `app-release-unsigned.apk`; the mapping folder holds at least `configuration.txt`, `mapping.txt`, `seeds.txt` and `usage.txt`. This proves the build works on a machine without the keystore.

If R8 stops with `Missing class ... referenced from ...`, open `missing_rules.txt` in the mapping folder. Add its `-dontwarn` lines for classes of libraries (never for `com.eienmosu.truthy`) at the end of `proguard-rules.pro` under the comment `# Optional classes some libraries mention and do not need.`, run the step again and name the lines in your report. If `lintVitalAnalyzeRelease` fails, read its message: fix the cause if it is in this app, and report it.

- [ ] **Step 8: Check what R8 did.**

```bash
(cd android/Truthy && DEBUG=$(stat -f %z app/build/outputs/apk/debug/app-debug.apk) && RELEASE=$(stat -f %z app/build/outputs/apk/release/app-release-unsigned.apk) && echo "debug $DEBUG release $RELEASE" && { [ "$RELEASE" -lt "$DEBUG" ] && echo "release is smaller"; })
(cd android/Truthy/app/build/outputs/mapping/release && grep -c 'JournalEntry\$Companion' seeds.txt; grep -c 'Progress\$Companion' seeds.txt; grep -c 'parseDebugLaunch\|DebugLaunchKt' mapping.txt)
(cd android/Truthy && unzip -p app/build/outputs/apk/release/app-release-unsigned.apk 'classes*.dex' | strings | grep -c 'truthy\.seed')
```

Expected: `release is smaller`; then `1` or more for the journal's companion, `1` or more for the progress companion (the keep rules found the app's serializers), and `0` for the debug parser, then `0` for the extra's key in the dex files (each `grep -c` exits 1 when it counts 0, that is fine). A `0` for a companion means the class lives in another package than the rule covers: the rules name `com.eienmosu.truthy.**`, so find the class with `grep -rn 'class Progress' android/Truthy/engine/src/main` and report. A non-zero count for the parser or the key means the debug launch path survives in release: stop, the `BuildConfig.DEBUG` guard of task 11 is missing or not a constant, report it. A line for the `DebugLaunch` data class alone is expected (rule 4).

- [ ] **Step 9: Commit the R8 and signing configuration.**

```bash
git add android/Truthy/app/proguard-rules.pro android/Truthy/app/build.gradle.kts android/Truthy/.gitignore android/Truthy/app/src/test/kotlin/com/eienmosu/truthy/ReleaseConfigTest.kt
git commit -m "feat: shrink the Android release build with R8 and sign it from Gradle properties"
```

- [ ] **Step 10: Write the keystore tool's tests.**

`android/Truthy/tools/release/keystore.test.mjs`:

```js
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  ALIAS,
  PROPERTY_NAMES,
  backupKeystore,
  createKeystore,
  parseKeytoolSha256,
  parseProperties,
  paths,
  verifyBackup,
} from "./keystore.mjs";

const here = dirname(fileURLToPath(import.meta.url));

// A temporary home folder, so no test touches the real one.
function tempHome() {
  return mkdtempSync(join(tmpdir(), "truthy-home-"));
}

// A stand-in for keytool. `-genkeypair` writes a file at the -keystore path; `-list` answers with a fixed
// SHA256 line unless the file content says otherwise. Every call is recorded.
function fakeKeytool(listing = "SHA256: AA:BB:CC:DD:EE:FF:00:11") {
  const calls = [];
  const run = (command, args, env) => {
    calls.push({ command, args, env });
    const keystore = args[args.indexOf("-keystore") + 1];
    if (args.includes("-genkeypair")) {
      mkdirSync(dirname(keystore), { recursive: true });
      writeFileSync(keystore, "fake-keystore-bytes");
      return "";
    }
    const content = readFileSync(keystore, "utf8");
    return content.includes("OTHER") ? "SHA256: 11:22:33:44" : `Certificate fingerprints:\n\t ${listing}\n`;
  };
  return { run, calls };
}

test("create runs keytool with a PKCS12 key and hands it the password through the environment", () => {
  const home = tempHome();
  const { run, calls } = fakeKeytool();
  createKeystore({ home, run });
  assert.equal(calls.length, 1);
  const { command, args, env } = calls[0];
  assert.equal(command, "keytool");
  for (const wanted of ["-genkeypair", "-storetype", "PKCS12", "-alias", ALIAS, "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000"]) {
    assert.ok(args.includes(wanted), `missing ${wanted}`);
  }
  assert.ok(args.includes("-storepass:env"), "the password must not be an argument");
  const variable = args[args.indexOf("-storepass:env") + 1];
  assert.match(env[variable], /^[0-9a-f]{48}$/);
  assert.ok(!args.some((a) => a.includes(env[variable])));
});

test("create writes the four properties, keeps other lines and never returns the password", () => {
  const home = tempHome();
  const { gradleProps, keystore } = paths(home);
  mkdirSync(dirname(gradleProps), { recursive: true });
  writeFileSync(gradleProps, "OTHERAPP_STORE_FILE=/somewhere/else.jks\norg.gradle.jvmargs=-Xmx2g\n");
  const { run } = fakeKeytool();
  const summary = createKeystore({ home, run });
  const text = readFileSync(gradleProps, "utf8");
  const props = parseProperties(text);
  assert.deepEqual(PROPERTY_NAMES.filter((n) => !(n in props)), []);
  assert.equal(props.TRUTHY_STORE_FILE, keystore);
  assert.equal(props.TRUTHY_KEY_ALIAS, ALIAS);
  assert.match(props.TRUTHY_STORE_PASSWORD, /^[0-9a-f]{48}$/);
  assert.equal(props.TRUTHY_KEY_PASSWORD, props.TRUTHY_STORE_PASSWORD);
  assert.equal(props.OTHERAPP_STORE_FILE, "/somewhere/else.jks");
  assert.equal(props["org.gradle.jvmargs"], "-Xmx2g");
  assert.ok(!JSON.stringify(summary).includes(props.TRUTHY_STORE_PASSWORD));
  assert.equal(statSync(keystore).mode & 0o777, 0o600);
  assert.equal(statSync(dirname(keystore)).mode & 0o777, 0o700);
  assert.equal(statSync(gradleProps).mode & 0o077, 0, "the properties file must not be readable by others");
});

test("create refuses to replace an existing keystore and does not call keytool", () => {
  const home = tempHome();
  const { keystore } = paths(home);
  mkdirSync(dirname(keystore), { recursive: true });
  writeFileSync(keystore, "precious");
  const { run, calls } = fakeKeytool();
  assert.throws(() => createKeystore({ home, run }), /already exists/);
  assert.equal(calls.length, 0);
  assert.equal(readFileSync(keystore, "utf8"), "precious");
});

test("create refuses when the Gradle properties already name a Truthy keystore", () => {
  const home = tempHome();
  const { gradleProps } = paths(home);
  mkdirSync(dirname(gradleProps), { recursive: true });
  writeFileSync(gradleProps, "TRUTHY_STORE_FILE=/old/place.jks\n");
  const { run, calls } = fakeKeytool();
  assert.throws(() => createKeystore({ home, run }), /already has/);
  assert.equal(calls.length, 0);
});

test("parseProperties skips comments and keeps values that contain an equals sign", () => {
  assert.deepEqual(parseProperties("# note\nA=1\n\nB=x=y\n  C = 3 \n"), { A: "1", B: "x=y", C: "3" });
});

test("parseKeytoolSha256 returns lowercase hex without colons", () => {
  const listing = "Certificate fingerprints:\n\t SHA1: 01:02\n\t SHA256: AB:CD:EF:01\n";
  assert.equal(parseKeytoolSha256(listing), "abcdef01");
  assert.equal(parseKeytoolSha256("nothing here"), null);
});

test("backup copies the keystore, records its hash and verifies clean", () => {
  const home = tempHome();
  const { run } = fakeKeytool();
  createKeystore({ home, run });
  const destination = join(tempHome(), "backup");
  const summary = backupKeystore({ home, destination, run });
  const copy = join(destination, "truthy-release.jks");
  assert.equal(readFileSync(copy, "utf8"), "fake-keystore-bytes");
  const recorded = readFileSync(join(destination, "truthy-release.jks.sha256"), "utf8");
  assert.equal(recorded, `${createHash("sha256").update("fake-keystore-bytes").digest("hex")}  truthy-release.jks\n`);
  assert.ok(existsSync(join(destination, "RESTORE.txt")));
  assert.deepEqual(summary.problems, []);
  assert.deepEqual(verifyBackup({ home, destination, run }), []);
  const restore = readFileSync(join(destination, "RESTORE.txt"), "utf8");
  assert.ok(!restore.includes(parseProperties(readFileSync(paths(home).gradleProps, "utf8")).TRUTHY_STORE_PASSWORD));
});

test("verify reports a copy whose bytes changed", () => {
  const home = tempHome();
  const { run } = fakeKeytool();
  createKeystore({ home, run });
  const destination = join(tempHome(), "backup");
  backupKeystore({ home, destination, run });
  writeFileSync(join(destination, "truthy-release.jks"), "fake-keystore-bytes OTHER");
  const problems = verifyBackup({ home, destination, run });
  assert.ok(problems.some((p) => /hash/.test(p)), problems.join("\n"));
  assert.ok(problems.some((p) => /fingerprint/.test(p)), problems.join("\n"));
});

test("verify reports a missing copy", () => {
  const home = tempHome();
  const { run } = fakeKeytool();
  createKeystore({ home, run });
  const problems = verifyBackup({ home, destination: join(tempHome(), "nothing"), run });
  assert.match(problems[0], /no backup copy/);
});

test("the property names are the ones app/build.gradle.kts reads", () => {
  const script = readFileSync(join(here, "../../app/build.gradle.kts"), "utf8");
  for (const name of PROPERTY_NAMES) assert.ok(script.includes(`"${name}"`), `${name} is not read by the build script`);
});
```

- [ ] **Step 11: Run them and see them fail.**

```bash
node --test --test-reporter=spec android/Truthy/tools/release/keystore.test.mjs 2>&1 | grep -E 'Cannot find module|ℹ (pass|fail)'
```

Expected: a `Cannot find module` line naming `keystore.mjs`, `ℹ pass 0`, `ℹ fail 1`.

- [ ] **Step 12: Write the keystore tool.**

`android/Truthy/tools/release/keystore.mjs`:

```js
// The release keystore of the Android app: create it outside the repository, back it up, check the backup.
// Spec 9: the keystore lives in ~/keystores/truthy-release.jks, its passwords in ~/.gradle/gradle.properties.
// Nothing here prints a password. The `password` command is the one exception and is for the owner only.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ALIAS = "truthy";
export const KEYSTORE_NAME = "truthy-release.jks";
export const PROPERTY_NAMES = ["TRUTHY_STORE_FILE", "TRUTHY_STORE_PASSWORD", "TRUTHY_KEY_ALIAS", "TRUTHY_KEY_PASSWORD"];
const PASSWORD_VARIABLE = "TRUTHY_KEYSTORE_PASSWORD";

export function paths(home = homedir()) {
  const dir = join(home, "keystores");
  return { dir, keystore: join(dir, KEYSTORE_NAME), gradleProps: join(home, ".gradle", "gradle.properties") };
}

// KEY=VALUE lines of a .properties file. Comments and blank lines are skipped.
export function parseProperties(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;
    const at = trimmed.indexOf("=");
    if (at < 0) continue;
    out[trimmed.slice(0, at).trim()] = trimmed.slice(at + 1).trim();
  }
  return out;
}

// The SHA-256 certificate fingerprint of `keytool -list -v`, as lowercase hex without colons.
export function parseKeytoolSha256(text) {
  const match = /SHA-?256:\s*([0-9A-Fa-f:]+)/.exec(text);
  return match ? match[1].replaceAll(":", "").toLowerCase() : null;
}

export function defaultRun(command, args, env = process.env) {
  return execFileSync(command, args, { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function sha256Of(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function readConfig(home) {
  const { gradleProps } = paths(home);
  const props = existsSync(gradleProps) ? parseProperties(readFileSync(gradleProps, "utf8")) : {};
  const missing = PROPERTY_NAMES.filter((name) => !props[name]);
  if (missing.length > 0) throw new Error(`the Gradle properties lack ${missing.join(", ")}; run the create command first`);
  return { keystore: props.TRUTHY_STORE_FILE, password: props.TRUTHY_STORE_PASSWORD, alias: props.TRUTHY_KEY_ALIAS };
}

function listing({ keystore, password, alias }, run) {
  return run("keytool", ["-list", "-v", "-keystore", keystore, "-alias", alias, "-storepass:env", PASSWORD_VARIABLE], {
    ...process.env,
    [PASSWORD_VARIABLE]: password,
  });
}

export function fingerprint({ home = homedir(), run = defaultRun } = {}) {
  return parseKeytoolSha256(listing(readConfig(home), run));
}

export function createKeystore({ home = homedir(), run = defaultRun } = {}) {
  const { dir, keystore, gradleProps } = paths(home);
  if (existsSync(keystore)) throw new Error(`${keystore} already exists, refusing to replace it`);
  const existingText = existsSync(gradleProps) ? readFileSync(gradleProps, "utf8") : "";
  const known = parseProperties(existingText);
  const present = PROPERTY_NAMES.filter((name) => name in known);
  if (present.length > 0) throw new Error(`${gradleProps} already has ${present.join(", ")}; remove those lines first`);

  const password = randomBytes(24).toString("hex");
  mkdirSync(dir, { recursive: true });
  chmodSync(dir, 0o700);
  run(
    "keytool",
    [
      "-genkeypair",
      "-keystore", keystore,
      "-storetype", "PKCS12",
      "-alias", ALIAS,
      "-keyalg", "RSA",
      "-keysize", "2048",
      "-validity", "10000",
      "-dname", "CN=Truthy, O=EienMosu",
      "-storepass:env", PASSWORD_VARIABLE,
    ],
    { ...process.env, [PASSWORD_VARIABLE]: password },
  );
  if (!existsSync(keystore)) throw new Error("keytool finished without creating the keystore");
  chmodSync(keystore, 0o600);

  const block = [
    "# Truthy (Android) release signing. Outside the repository on purpose.",
    "# LOSING THE KEYSTORE OR ITS PASSWORD MEANS NO UPDATE CAN EVER REPLACE AN INSTALLED COPY.",
    "# Keep a copy of the keystore elsewhere and the password in a password manager (android/Truthy/RELEASE.md).",
    `TRUTHY_STORE_FILE=${keystore}`,
    `TRUTHY_STORE_PASSWORD=${password}`,
    `TRUTHY_KEY_ALIAS=${ALIAS}`,
    `TRUTHY_KEY_PASSWORD=${password}`,
    "",
  ].join("\n");
  mkdirSync(dirname(gradleProps), { recursive: true });
  const separator = existingText === "" || existingText.endsWith("\n") ? "" : "\n";
  writeFileSync(gradleProps, existingText + separator + block, { mode: 0o600 });
  chmodSync(gradleProps, 0o600);
  return { keystore, alias: ALIAS, properties: PROPERTY_NAMES, gradleProps };
}

const RESTORE_TEXT = [
  "Truthy (Android) release keystore, backup copy.",
  "",
  "This folder holds the keystore only. The password is NOT here: it is in the owner's password manager.",
  "",
  "To restore on a machine:",
  "1. Copy truthy-release.jks to ~/keystores/truthy-release.jks and run: chmod 600 ~/keystores/truthy-release.jks",
  "2. Add these four lines to ~/.gradle/gradle.properties (the value of the first is the path of step 1):",
  "   TRUTHY_STORE_FILE, TRUTHY_STORE_PASSWORD, TRUTHY_KEY_ALIAS (the alias is truthy), TRUTHY_KEY_PASSWORD (the same as the store password)",
  "3. Check it: keytool -list -keystore ~/keystores/truthy-release.jks and compare the SHA256 line with truthy-release.jks.sha256 and with the APK (apksigner verify --print-certs).",
  "",
].join("\n");

export function verifyBackup({ home = homedir(), destination, run = defaultRun }) {
  const copy = join(destination, KEYSTORE_NAME);
  const hashFile = join(destination, `${KEYSTORE_NAME}.sha256`);
  if (!existsSync(copy)) return [`no backup copy at ${copy}`];
  const problems = [];
  const copyHash = sha256Of(copy);
  if (!existsSync(hashFile)) problems.push(`${hashFile} is missing`);
  else if (readFileSync(hashFile, "utf8").split(/\s+/)[0] !== copyHash) problems.push("the hash of the copy differs from the recorded hash");
  const config = readConfig(home);
  if (existsSync(config.keystore)) {
    if (sha256Of(config.keystore) !== copyHash) problems.push("the hash of the copy differs from the keystore in use");
    try {
      const original = parseKeytoolSha256(listing(config, run));
      const fromCopy = parseKeytoolSha256(listing({ ...config, keystore: copy }, run));
      if (original === null || original !== fromCopy) problems.push("the fingerprint of the copy differs from the keystore in use");
    } catch (error) {
      problems.push(`the fingerprint of the copy could not be read: ${String(error.message).split("\n")[0]}`);
    }
  }
  return problems;
}

export function backupKeystore({ home = homedir(), destination, run = defaultRun }) {
  const config = readConfig(home);
  if (!existsSync(config.keystore)) throw new Error(`${config.keystore} does not exist`);
  const copy = join(destination, KEYSTORE_NAME);
  mkdirSync(destination, { recursive: true });
  if (existsSync(copy) && sha256Of(copy) !== sha256Of(config.keystore)) {
    throw new Error(`${copy} already holds a different keystore, refusing to replace it`);
  }
  copyFileSync(config.keystore, copy);
  chmodSync(copy, 0o600);
  const hash = sha256Of(copy);
  writeFileSync(join(destination, `${KEYSTORE_NAME}.sha256`), `${hash}  ${KEYSTORE_NAME}\n`);
  writeFileSync(join(destination, "RESTORE.txt"), RESTORE_TEXT);
  return { destination, copy, sha256: hash, problems: verifyBackup({ home, destination, run }) };
}

function main(argv) {
  const [command, argument] = argv;
  if (command === "create") {
    const summary = createKeystore();
    console.log(`created ${summary.keystore} (alias ${summary.alias})`);
    console.log(`added ${summary.properties.join(", ")} to ${summary.gradleProps}`);
    console.log(`SHA-256 certificate fingerprint: ${fingerprint()}`);
    return 0;
  }
  if (command === "fingerprint") {
    console.log(fingerprint());
    return 0;
  }
  if (command === "backup" || command === "verify") {
    if (!argument) throw new Error(`usage: keystore.mjs ${command} <folder>`);
    const problems = command === "backup" ? backupKeystore({ destination: argument }).problems : verifyBackup({ destination: argument });
    if (problems.length > 0) {
      for (const problem of problems) console.log(`PROBLEM: ${problem}`);
      return 1;
    }
    console.log(`${command} ok: ${join(argument, KEYSTORE_NAME)}`);
    return 0;
  }
  if (command === "password") {
    console.log(readConfig(homedir()).password);
    return 0;
  }
  console.log("usage: keystore.mjs create | fingerprint | backup <folder> | verify <folder> | password (owner only)");
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.log(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 13: Run the tests and see them pass.**

```bash
node --test --test-reporter=spec android/Truthy/tools/release/keystore.test.mjs 2>&1 | grep -E 'ℹ (tests|pass|fail)'
```

Expected: `ℹ tests 10`, `ℹ pass 10`, `ℹ fail 0`. The last test reads `app/build.gradle.kts` and fails if the four property names there differ from the tool's.

- [ ] **Step 14: Commit the keystore tool.**

```bash
git add android/Truthy/tools/release/keystore.mjs android/Truthy/tools/release/keystore.test.mjs
git commit -m "feat: tool to create, back up and verify the Android release keystore"
```

- [ ] **Step 15: Create the real keystore.**

```bash
node android/Truthy/tools/release/keystore.mjs create
ls -l ~/keystores/truthy-release.jks
grep -c '^TRUTHY_' ~/.gradle/gradle.properties
git status --short
```

Expected: three lines, `created <path of the keystore> (alias truthy)`, `added TRUTHY_STORE_FILE, TRUTHY_STORE_PASSWORD, TRUTHY_KEY_ALIAS, TRUTHY_KEY_PASSWORD to <path of the properties file>` and `SHA-256 certificate fingerprint: ` followed by 64 hex characters; the `ls` line starts `-rw-------`; the count is `4`; `git status --short` prints nothing (the keystore is outside the repository). Do not print `~/.gradle/gradle.properties`, it now holds the password. If the tool says `already exists` or `already has`, stop and ask the owner; never delete or replace a keystore.

- [ ] **Step 16: Back up the keystore (the owner takes part).**

Stop and ask the owner two things, and do nothing else with the keystore until both are answered:

1. "Put the password of the release keystore into your password manager now. In your own terminal, run `node android/Truthy/tools/release/keystore.mjs password`, copy the line into an entry named `Truthy Android release keystore`, and clear the terminal. Tell me when it is saved." The agent does not run this command and does not read its output.
2. "Name two folders for the backup copies of the keystore, on different storage (for example one in a cloud-synced folder and one on an external drive). The keystore is protected by its password, and the password is not in those folders."

Then, with the folders as `BACKUP1` and `BACKUP2` (quoted if they contain spaces):

```bash
BACKUP1="<first folder>"
BACKUP2="<second folder>"
for dir in "$BACKUP1" "$BACKUP2"; do
  mkdir -p "$dir"
  case "$(cd "$dir" && pwd)/" in "$(git rev-parse --show-toplevel)/"*) echo "INSIDE THE REPOSITORY: $dir" ;; esac
  node android/Truthy/tools/release/keystore.mjs backup "$dir"
done
node android/Truthy/tools/release/keystore.mjs verify "$BACKUP1"
node android/Truthy/tools/release/keystore.mjs verify "$BACKUP2"
ls "$BACKUP1" "$BACKUP2"
git status --short
```

Expected: no `INSIDE THE REPOSITORY` line; `backup ok: <folder>/truthy-release.jks` twice and `verify ok: <folder>/truthy-release.jks` twice; each folder lists `RESTORE.txt`, `truthy-release.jks` and `truthy-release.jks.sha256`; `git status --short` prints nothing. A `PROBLEM:` line names what differs: copy again, and if the fingerprint differs, stop and report.

- [ ] **Step 17: Build the signed release.**

```bash
(cd android/Truthy && ./gradlew :app:assembleRelease)
ls android/Truthy/app/build/outputs/apk/release/
```

Expected: `BUILD SUCCESSFUL` and `app-release.apk` (not `-unsigned`) in the folder. If the unsigned file is still the only one, run `(cd android/Truthy && ./gradlew --stop)` and build again; if it persists, the four properties are not all set: `grep -c '^TRUTHY_' ~/.gradle/gradle.properties` must print `4`.

- [ ] **Step 18: Write the checks' tests.**

`android/Truthy/tools/release/checks.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { badgingProblems, checkJournal, checkProgress, parseApksigner, parseBadging, scanLogcat, signingProblems } from "./checks.mjs";

const SIGNED = `Verifies
Verified using v1 scheme (JAR signing): false
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
Verified using v3.1 scheme (APK Signature Scheme v3.1): false
Verified using v4 scheme (APK Signature Scheme v4): false
Number of signers: 1
Signer #1 certificate DN: CN=Truthy, O=EienMosu
Signer #1 certificate SHA-256 digest: aabbccdd00112233
Signer #1 certificate SHA-1 digest: 0102030405
`;

test("parseApksigner reads the verdict, the schemes and the certificate digest", () => {
  const parsed = parseApksigner(SIGNED);
  assert.equal(parsed.verifies, true);
  assert.deepEqual(parsed.schemes, { v1: false, v2: true, v3: true, "v3.1": false, v4: false });
  assert.equal(parsed.sha256, "aabbccdd00112233");
  assert.equal(parsed.dn, "CN=Truthy, O=EienMosu");
});

test("signingProblems accepts the right certificate and names every failure", () => {
  assert.deepEqual(signingProblems(parseApksigner(SIGNED), "aabbccdd00112233"), []);
  assert.match(signingProblems(parseApksigner(SIGNED), "ffff").join("\n"), /certificate differs/);
  assert.match(signingProblems(parseApksigner("DOES NOT VERIFY\nERROR: boom"), "ffff").join("\n"), /does not verify/);
  const noModernScheme = SIGNED.replaceAll("): true", "): false");
  assert.match(signingProblems(parseApksigner(noModernScheme), "aabbccdd00112233").join("\n"), /v2 or v3/);
});

const BADGING = `package: name='com.eienmosu.truthy' versionCode='1' versionName='1.0' platformBuildVersionName='17' compileSdkVersion='37'
minSdkVersion:'26'
targetSdkVersion:'36'
application-label:'Truthy'
`;

test("parseBadging and badgingProblems check the package, the SDK levels and the debuggable flag", () => {
  const parsed = parseBadging(BADGING);
  assert.deepEqual(parsed, { packageName: "com.eienmosu.truthy", versionCode: 1, minSdk: 26, targetSdk: 36, debuggable: false });
  const expected = { packageName: "com.eienmosu.truthy", minSdk: 26, targetSdk: 36 };
  assert.deepEqual(badgingProblems(parsed, expected), []);
  const bad = parseBadging(BADGING.replace("targetSdkVersion:'36'", "targetSdkVersion:'35'") + "application-debuggable\n");
  const problems = badgingProblems(bad, expected).join("\n");
  assert.match(problems, /debuggable/);
  assert.match(problems, /targetSdk/);
});

const line = (pid, level, tag, message) => `10-15 02:31:45.123  ${pid}  ${pid} ${level} ${tag}: ${message}`;

test("scanLogcat finds a crash of the app, a serialization failure of the app and an ANR, and ignores other processes", () => {
  const log = [
    line(1111, "E", "AndroidRuntime", "FATAL EXCEPTION: main"),
    line(1111, "E", "AndroidRuntime", "Process: com.eienmosu.truthy, PID: 1111"),
    line(2222, "E", "AndroidRuntime", "FATAL EXCEPTION: main"),
    line(2222, "E", "AndroidRuntime", "Process: com.google.android.gms, PID: 2222"),
    line(1111, "W", "System.err", "kotlinx.serialization.SerializationException: Serializer for class 'X' is not found"),
    line(3333, "W", "System.err", "java.lang.ClassNotFoundException: not ours"),
    line(500, "E", "ActivityManager", "ANR in com.eienmosu.truthy (com.eienmosu.truthy/.MainActivity)"),
    line(1111, "F", "libc", "Fatal signal 11 (SIGSEGV), code 1"),
    line(1111, "I", "Truthy", "round started"),
  ].join("\n");
  const findings = scanLogcat(log, { pkg: "com.eienmosu.truthy", pids: new Set(["1111"]) });
  assert.equal(findings.length, 4, findings.join("\n"));
  assert.ok(findings.some((f) => /FATAL EXCEPTION/.test(f)));
  assert.ok(findings.some((f) => /SerializationException/.test(f)));
  assert.ok(findings.some((f) => /ANR in/.test(f)));
  assert.ok(findings.some((f) => /Fatal signal/.test(f)));
});

test("scanLogcat is quiet on a clean log", () => {
  const log = [line(1111, "I", "Truthy", "round started"), line(1111, "D", "Compose", "frame")].join("\n");
  assert.deepEqual(scanLogcat(log, { pkg: "com.eienmosu.truthy", pids: new Set(["1111"]) }), []);
});

const progress = (over = {}) =>
  JSON.stringify({
    version: 1,
    cards: { "clf-001": { seen: 1, lastCorrect: true, lastSeenAt: 1790000000000 } },
    records: { "clf/ALL#classic": 7 },
    last: { route: { deckId: "clf", sectionId: "ALL" }, mode: "classic", score: 7, total: 10 },
    ...over,
  });

test("checkProgress accepts a scored round, an abandoned round and wants the record of the class", () => {
  assert.deepEqual(checkProgress(progress(), { expectScored: true, wire: "classic" }), []);
  const abandoned = progress({ last: { route: { deckId: "clf", sectionId: "ALL" }, mode: "classic", score: null, total: null } });
  assert.deepEqual(checkProgress(abandoned, { expectAbandoned: true }), []);
  assert.match(checkProgress(abandoned, { expectScored: true }).join("\n"), /score/);
  assert.match(checkProgress(progress(), { expectAbandoned: true }).join("\n"), /abandoned/);
  assert.match(checkProgress(progress(), { expectScored: true, wire: "streak" }).join("\n"), /#streak/);
});

test("checkProgress names a missing file, bad JSON and a wrong shape", () => {
  assert.match(checkProgress(null, {}).join("\n"), /missing/);
  assert.match(checkProgress("{nope", {}).join("\n"), /JSON/);
  assert.match(checkProgress(JSON.stringify({ version: 2, cards: {}, records: {}, last: null }), {}).join("\n"), /version/);
  assert.match(checkProgress(progress({ cards: {} }), {}).join("\n"), /no card history/);
  assert.match(checkProgress(progress({ records: { "clf/ALL#classic": 1.5 } }), {}).join("\n"), /record/);
});

const journal = (answers) =>
  JSON.stringify({ route: { deckId: "clf", sectionId: "ALL" }, mode: "classic", seed: 123456789, roundId: "r1", answers, decided: false, recorded: false });
const answer = { cardId: "clf-001", given: true, correct: true, at: 1790000000000 };

test("checkJournal wants the entry of the round with at least the answers given", () => {
  assert.deepEqual(checkJournal(journal([answer, answer, answer]), { minAnswers: 3 }), []);
  assert.match(checkJournal(journal([answer]), { minAnswers: 3 }).join("\n"), /3 answers/);
  assert.match(checkJournal(null, { minAnswers: 1 }).join("\n"), /missing/);
  assert.match(checkJournal("[]", { minAnswers: 1 }).join("\n"), /object/);
});
```

- [ ] **Step 19: Run them and see them fail.**

```bash
node --test --test-reporter=spec android/Truthy/tools/release/checks.test.mjs 2>&1 | grep -E 'Cannot find module|ℹ (pass|fail)'
```

Expected: a `Cannot find module` line naming `checks.mjs`, `ℹ pass 0`, `ℹ fail 1`.

- [ ] **Step 20: Write the checks.**

`android/Truthy/tools/release/checks.mjs`:

```js
// Pure checks on text the release play-through collects: apksigner and aapt2 output, logcat, the two files
// the app keeps in its private folder. Each returns a list of problems; an empty list means the check passed.

export function parseApksigner(text) {
  const schemes = {};
  for (const match of text.matchAll(/Verified using v(\d(?:\.\d)?) scheme[^\n]*: (true|false)/g)) schemes[`v${match[1]}`] = match[2] === "true";
  return {
    verifies: /^Verifies$/m.test(text),
    schemes,
    sha256: /Signer #1 certificate SHA-256 digest: ([0-9a-fA-F]+)/.exec(text)?.[1]?.toLowerCase() ?? null,
    dn: /Signer #1 certificate DN: (.*)/.exec(text)?.[1]?.trim() ?? null,
  };
}

export function signingProblems(parsed, expectedSha256) {
  const problems = [];
  if (!parsed.verifies) problems.push("apksigner does not verify the APK");
  if (!parsed.schemes.v2 && !parsed.schemes.v3) problems.push("the APK has no v2 or v3 signature");
  if (parsed.sha256 !== expectedSha256) problems.push(`the signing certificate differs from the keystore: ${parsed.sha256} against ${expectedSha256}`);
  return problems;
}

export function parseBadging(text) {
  const head = /^package: name='([^']*)' versionCode='(\d+)'/m.exec(text);
  return {
    packageName: head?.[1] ?? null,
    versionCode: head ? Number(head[2]) : null,
    minSdk: Number(/^(?:minSdkVersion|sdkVersion):'(\d+)'/m.exec(text)?.[1] ?? NaN),
    targetSdk: Number(/^targetSdkVersion:'(\d+)'/m.exec(text)?.[1] ?? NaN),
    debuggable: /^application-debuggable/m.test(text),
  };
}

export function badgingProblems(parsed, expected) {
  const problems = [];
  if (parsed.packageName !== expected.packageName) problems.push(`package is ${parsed.packageName}, expected ${expected.packageName}`);
  if (parsed.minSdk !== expected.minSdk) problems.push(`minSdk is ${parsed.minSdk}, expected ${expected.minSdk}`);
  if (parsed.targetSdk !== expected.targetSdk) problems.push(`targetSdk is ${parsed.targetSdk}, expected ${expected.targetSdk}`);
  if (parsed.debuggable) problems.push("the release APK is debuggable");
  return problems;
}

const THREADTIME = /^\d\d-\d\d \d\d:\d\d:\d\d\.\d+\s+(\d+)\s+\d+\s+([VDIWEF])\s+(.+?)\s*:\s(.*)$/;
const RUNTIME_FAILURES =
  /(SerializationException|ClassNotFoundException|NoSuchMethodError|NoSuchFieldError|NoClassDefFoundError|IllegalAccessError|AbstractMethodError|ExceptionInInitializerError|OutOfMemoryError)/;

// Findings in `adb logcat -d -v threadtime`. `pids` are the process ids the app had during the run.
export function scanLogcat(text, { pkg, pids }) {
  const lines = text.split("\n");
  const findings = [];
  lines.forEach((raw, index) => {
    const parsed = THREADTIME.exec(raw);
    if (!parsed) return;
    const [, pid, level, tag, message] = parsed;
    if (tag === "AndroidRuntime" && message.startsWith("FATAL EXCEPTION")) {
      const next = lines.slice(index + 1, index + 4).join("\n");
      if (next.includes(`Process: ${pkg},`)) findings.push(raw.trim());
      return;
    }
    if (message.includes(`ANR in ${pkg}`)) {
      findings.push(raw.trim());
      return;
    }
    if (!pids.has(pid)) return;
    if (RUNTIME_FAILURES.test(message) || (level === "F" && /Fatal signal/.test(message))) findings.push(raw.trim());
  });
  return findings.map((finding) => finding.slice(0, 240));
}

function parseJson(raw, name) {
  if (raw === null || raw === undefined) return { problems: [`${name} is missing`] };
  try {
    return { value: JSON.parse(raw), problems: [] };
  } catch (error) {
    return { problems: [`${name} is not JSON: ${error.message}`] };
  }
}

const isCount = (n) => Number.isSafeInteger(n) && n >= 0;

// truthy.progress.v1.json after rounds. expectScored: `last` carries a score and a total. expectAbandoned:
// `last` has both null. wire: a record for this class (a key ending in #<wire>) must exist.
export function checkProgress(raw, { expectScored = false, expectAbandoned = false, wire = null } = {}) {
  const { value, problems } = parseJson(raw, "the progress file");
  if (!value) return problems;
  if (value.version !== 1) problems.push(`version is ${value.version}, expected 1`);
  const cards = value.cards ?? {};
  if (Object.keys(cards).length === 0) problems.push("no card history was written");
  for (const [id, h] of Object.entries(cards)) {
    if (!isCount(h?.seen) || typeof h?.lastCorrect !== "boolean" || !Number.isFinite(h?.lastSeenAt)) problems.push(`card ${id} has a bad history entry`);
  }
  const records = value.records ?? {};
  for (const [key, best] of Object.entries(records)) {
    if (!/^[^/]+\/[^#]+#(classic|streak|lives|timed)$/.test(key) || !isCount(best)) problems.push(`record ${key} is malformed`);
  }
  if (wire && !Object.keys(records).some((key) => key.endsWith(`#${wire}`))) problems.push(`no record ends in #${wire}`);
  const last = value.last;
  if (expectScored) {
    if (!last || !isCount(last.score) || !isCount(last.total)) problems.push("last has no score and total after a finished round");
  }
  if (expectAbandoned) {
    if (!last || last.score !== null || last.total !== null) problems.push("last is not an abandoned round (score and total null)");
  }
  return problems;
}

// truthy.round.v1.json while a round is on: the route, class, seed, round id and the answers so far.
export function checkJournal(raw, { minAnswers }) {
  const { value, problems } = parseJson(raw, "the round journal");
  if (!value) return problems;
  if (typeof value !== "object" || Array.isArray(value)) return ["the round journal is not an object"];
  if (typeof value.route?.deckId !== "string" || typeof value.route?.sectionId !== "string") problems.push("the journal has no route");
  if (typeof value.mode !== "string") problems.push("the journal has no class");
  if (!Number.isFinite(value.seed)) problems.push("the journal has no seed");
  if (typeof value.roundId !== "string" || value.roundId === "") problems.push("the journal has no round id");
  if (typeof value.decided !== "boolean" || typeof value.recorded !== "boolean") problems.push("the journal lacks decided or recorded");
  if (!Array.isArray(value.answers) || value.answers.length < minAnswers) problems.push(`the journal holds fewer than ${minAnswers} answers`);
  return problems;
}
```

- [ ] **Step 21: Run the tests and see them pass.**

```bash
node --test --test-reporter=spec android/Truthy/tools/release/checks.test.mjs 2>&1 | grep -E 'ℹ (tests|pass|fail)'
```

Expected: `ℹ tests 8`, `ℹ pass 8`, `ℹ fail 0`.

- [ ] **Step 22: Write the screen reader's tests.**

`android/Truthy/tools/release/ui.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { centre, chooseStartTarget, findNode, parseNodes, screenOf, tapPlan } from "./ui.mjs";

// The shape of `uiautomator dump` output, reduced to the attributes read. Labels are what the app exposes:
// reference 4.5 gives them (area card "{title}, {n} decks", class card "{name}. {description} Not played yet.").
const node = (attrs, children = "") => {
  const a = { text: "", "content-desc": "", clickable: "false", enabled: "true", bounds: "[0,0][0,0]", ...attrs };
  const body = Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ");
  return children ? `<node ${body}>${children}</node>` : `<node ${body} />`;
};
const dump = (...nodes) => `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">${node({ bounds: "[0,0][1080,2400]" }, nodes.join(""))}</hierarchy>`;

test("parseNodes reads text, description, bounds and the clickable flag, and decodes entities", () => {
  const xml = dump(
    node({ text: "Choose an area", bounds: "[40,300][1040,380]" }),
    node({ "content-desc": "Cloud &amp; DevOps, 3 decks", clickable: "true", bounds: "[40,420][1040,620]" }),
    node({ "content-desc": "Why &quot;now&quot;&#10;ok &#8594;", bounds: "[0,0][10,10]" }),
  );
  const nodes = parseNodes(xml);
  const area = nodes.find((n) => n.label.startsWith("Cloud"));
  assert.equal(area.label, "Cloud & DevOps, 3 decks");
  assert.equal(area.clickable, true);
  assert.deepEqual(area.bounds, { x1: 40, y1: 420, x2: 1040, y2: 620 });
  assert.equal(nodes.find((n) => n.label.startsWith("Why")).label, 'Why "now"\nok →');
  assert.equal(nodes.find((n) => n.text === "Choose an area").label, "Choose an area");
});

test("centre is the middle of the bounds, rounded down", () => {
  assert.deepEqual(centre({ bounds: { x1: 40, y1: 420, x2: 1041, y2: 621 } }), { x: 540, y: 520 });
});

test("findNode matches a label by pattern, skips empty boxes and prefers the first in document order", () => {
  const nodes = parseNodes(dump(
    node({ "content-desc": "True", bounds: "[0,0][0,0]" }),
    node({ "content-desc": "True", clickable: "true", bounds: "[500,2000][900,2200]" }),
    node({ "content-desc": "False", clickable: "true", bounds: "[100,2000][480,2200]" }),
  ));
  assert.deepEqual(findNode(nodes, /^True$/).bounds, { x1: 500, y1: 2000, x2: 900, y2: 2200 });
  assert.equal(findNode(nodes, /^Maybe$/), null);
});

test("screenOf tells the start flow, a question, an answered card and the result apart", () => {
  const start = parseNodes(dump(node({ text: "Choose an area" }), node({ "content-desc": "Cloud, 3 decks", bounds: "[0,0][5,5]" })));
  const question = parseNodes(dump(node({ "content-desc": "False", bounds: "[0,0][5,5]" }), node({ "content-desc": "True", bounds: "[0,0][5,5]" })));
  const answered = parseNodes(dump(node({ "content-desc": "Next card", bounds: "[0,0][5,5]" })));
  const lastCard = parseNodes(dump(node({ "content-desc": "See results", bounds: "[0,0][5,5]" })));
  const result = parseNodes(dump(node({ text: "Play again", bounds: "[0,0][5,5]" }), node({ text: "Choose another route", bounds: "[0,0][5,5]" })));
  assert.equal(screenOf(start), "start");
  assert.equal(screenOf(question), "question");
  assert.equal(screenOf(answered), "answered");
  assert.equal(screenOf(lastCard), "answered");
  assert.equal(screenOf(result), "result");
  assert.equal(screenOf(parseNodes(dump())), "unknown");
});

test("chooseStartTarget walks the start flow in the order the steps appear", () => {
  const wanted = "Streak";
  const at = (label) => parseNodes(dump(node({ "content-desc": label, clickable: "true", bounds: "[10,10][20,20]" })));
  assert.equal(chooseStartTarget(at("Recent, 2 decks"), wanted), null);
  assert.equal(chooseStartTarget(at("Cloud, 3 decks"), wanted).label, "Cloud, 3 decks");
  assert.equal(chooseStartTarget(at("AWS, 1 deck"), wanted).label, "AWS, 1 deck");
  assert.equal(chooseStartTarget(at("CLF, Cloud Practitioner, 214 cards, not started"), wanted).label.slice(0, 3), "CLF");
  assert.equal(chooseStartTarget(at("CLF, Cloud Practitioner, 214 cards, 12 percent seen"), wanted).label.slice(0, 3), "CLF");
  assert.equal(chooseStartTarget(at("Whole deck, all 4 sections, 214 cards"), wanted).label.slice(0, 5), "Whole");
  assert.equal(chooseStartTarget(at("S01, Compute, 40 cards"), wanted).label.slice(0, 3), "S01");
  assert.equal(chooseStartTarget(at("Classic. Correct answers out of 10 cards. Not played yet."), wanted), null);
  assert.equal(chooseStartTarget(at("Streak. Correct answers in a row, until the first wrong one. Your best: 3 in a row."), wanted).label.slice(0, 6), "Streak");
  assert.equal(chooseStartTarget(at("Three lives. Cards answered until the third wrong one. Not played yet."), "Three lives").label.slice(0, 5), "Three");
  assert.equal(chooseStartTarget(at("Start round"), wanted).label, "Start round");
});

test("chooseStartTarget prefers Start round over a class card and a class card over the lists before it", () => {
  const nodes = parseNodes(dump(
    node({ "content-desc": "Streak. Correct answers in a row, until the first wrong one. Not played yet.", bounds: "[0,0][5,5]" }),
    node({ "content-desc": "Start round", bounds: "[0,0][5,5]" }),
    node({ "content-desc": "CLF, Cloud Practitioner, 214 cards, not started", bounds: "[0,0][5,5]" }),
  ));
  assert.equal(chooseStartTarget(nodes, "Streak").label, "Start round");
});

test("tapPlan taps the centre once, for a node or a pattern", () => {
  const nodes = parseNodes(dump(node({ "content-desc": "Play again", clickable: "true", bounds: "[100,2000][300,2100]" })));
  assert.deepEqual(tapPlan(nodes, /^Play again$/), { x: 200, y: 2050 });
  assert.equal(tapPlan(nodes, /^Nope$/), null);
});
```

- [ ] **Step 23: Run them and see them fail.**

```bash
node --test --test-reporter=spec android/Truthy/tools/release/ui.test.mjs 2>&1 | grep -E 'Cannot find module|ℹ (pass|fail)'
```

Expected: a `Cannot find module` line naming `ui.mjs`, `ℹ pass 0`, `ℹ fail 1`.

- [ ] **Step 24: Write the screen reader.**

`android/Truthy/tools/release/ui.mjs`:

```js
// Reads `uiautomator dump` XML and finds what to tap. Pure: no adb here.
// The labels are the ones of reference 4.5: an element's text or its content description.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[body] ?? whole;
  });
}

export function parseNodes(xml) {
  const nodes = [];
  for (const tag of xml.matchAll(/<node\b([^>]*)>/g)) {
    const attributes = {};
    for (const pair of tag[1].matchAll(/([\w-]+)="([^"]*)"/g)) attributes[pair[1]] = decode(pair[2]);
    const box = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(attributes.bounds ?? "");
    if (!box) continue;
    const text = attributes.text ?? "";
    const description = attributes["content-desc"] ?? "";
    nodes.push({
      text,
      description,
      label: description !== "" ? description : text,
      clickable: attributes.clickable === "true",
      bounds: { x1: Number(box[1]), y1: Number(box[2]), x2: Number(box[3]), y2: Number(box[4]) },
    });
  }
  return nodes;
}

export function centre(node) {
  const { x1, y1, x2, y2 } = node.bounds;
  return { x: Math.floor((x1 + x2) / 2), y: Math.floor((y1 + y2) / 2) };
}

function hasArea(node) {
  return node.bounds.x2 > node.bounds.x1 && node.bounds.y2 > node.bounds.y1;
}

// The first node, in document order, whose label matches and that occupies some area.
export function findNode(nodes, pattern) {
  return nodes.find((node) => node.label !== "" && hasArea(node) && pattern.test(node.label)) ?? null;
}

export function tapPlan(nodes, pattern) {
  const node = findNode(nodes, pattern);
  return node ? centre(node) : null;
}

const NEXT = /^(Next card|See results)\b/;
const RESULT = /^Play again$/;
const TITLE = /^(Choose an area|Choose a platform|Choose a deck|Choose a section|Choose how to play|Your pass is ready)$/;
const START_ROUND = /^Start round/;
const CLASS_CARD = /^(Classic|Streak|Three lives|Timed)\. /;
const SECTION_CARD = /^[^,]+, .+, \d+ cards$|^Whole deck, all \d+ sections, \d+ cards$/;
const DECK_CARD = /, \d+ cards, (not started|\d+ percent seen)$/;
const LIST_CARD = /^(?!Recent,).*, (\d+ decks?)$/;

// "start" (any step of the start flow), "question", "answered", "result" or "unknown".
export function screenOf(nodes) {
  if (findNode(nodes, RESULT)) return "result";
  if (findNode(nodes, NEXT)) return "answered";
  if (findNode(nodes, /^True$/) && findNode(nodes, /^False$/)) return "question";
  if (nodes.some((n) => TITLE.test(n.label))) return "start";
  for (const pattern of [START_ROUND, CLASS_CARD, SECTION_CARD, DECK_CARD, LIST_CARD, /^Recent, /]) {
    if (findNode(nodes, pattern)) return "start";
  }
  return "unknown";
}

// The element to tap next on the way from step 1 to a started round, by the labels of reference 4.5.
// Priority: Start round, the wanted class, a section, a deck, an area or platform.
// The Recent card is skipped so the walk is the same on a fresh install and after rounds.
export function chooseStartTarget(nodes, wantedClass) {
  const escaped = wantedClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wanted = new RegExp(`^${escaped}\\. `);
  for (const pattern of [START_ROUND, wanted, SECTION_CARD, DECK_CARD, LIST_CARD]) {
    const node = findNode(nodes, pattern);
    if (node) return node;
  }
  return null;
}
```

Run `node --test --test-reporter=spec android/Truthy/tools/release/ui.test.mjs 2>&1 | grep -E 'ℹ (tests|pass|fail)'`. Expected: `ℹ tests 7`, `ℹ pass 7`, `ℹ fail 0`.

- [ ] **Step 25: Write the driver's tests.**

They play the whole driver against a simulated phone (the screens of reference 4.1, the progress file and the journal written by the spec 4.5 rules), including the three ways it must fail.

`android/Truthy/tools/release/playthrough.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CLASSES, FILES, JOURNAL_FILE, PKG, PROGRESS_FILE, run } from "./playthrough.mjs";

// A simulated phone behind the adb function: the screens of reference 4.1 with the labels of 4.5, the
// progress file and the round journal as the spec 4.5 rules write them. It answers only what the driver asks.
const SCREENS = {
  start1: [["Cloud, 3 decks", "start2"]],
  start2: [["AWS, 1 deck", "start3"]],
  start3: [["CLF, Cloud Practitioner, 214 cards, not started", "start4"]],
  start4: [["Whole deck, all 4 sections, 214 cards", "start5"]],
  start5: [
    ["Classic. Correct answers out of 10 cards. Not played yet.", "start6", "classic"],
    ["Streak. Correct answers in a row, until the first wrong one. Not played yet.", "start6", "streak"],
    ["Three lives. Cards answered until the third wrong one. Not played yet.", "start6", "lives"],
    ["Timed. Correct answers in one minute, wrong ones cost nothing. Not played yet.", "start6", "timed"],
  ],
  start6: [["Start round", "question"]],
  question: [["False"], ["True"]],
  answered: [["Next card", "next"]],
  last: [["See results", "result"]],
  result: [["Play again", "question"], ["Choose another route", "start1"]],
};

function simulatedPhone(options = {}) {
  const phone = { screen: "start1", alive: false, pid: 1000, backgrounded: false, wire: null, answers: [], files: {}, log: options.log ?? "", uid: options.uid ?? "0" };
  const length = () => (phone.wire === "classic" ? 5 : 3);
  const xml = () => {
    const nodes = (SCREENS[phone.screen] ?? []).map(([label], i) => {
      const y = 200 + i * 300;
      return `<node text="" content-desc="${label}" clickable="true" bounds="[100,${y}][900,${y + 200}]" />`;
    });
    return `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy>${nodes.join("")}</hierarchy>`;
  };
  const writeProgress = (patch) => {
    const old = phone.files[PROGRESS_FILE] ? JSON.parse(phone.files[PROGRESS_FILE]) : { version: 1, cards: {}, records: {}, last: null };
    phone.files[PROGRESS_FILE] = JSON.stringify({ ...old, ...patch });
  };
  const route = { deckId: "clf", sectionId: "ALL" };
  const journal = () => ({ route, mode: phone.wire, seed: 7, roundId: "r1", answers: phone.answers, decided: false, recorded: false });
  const launch = () => {
    if (!phone.alive) {
      phone.alive = true;
      phone.pid += 1;
      phone.screen = "start1";
      if (phone.files[JOURNAL_FILE] && !options.keepJournal) {
        const entry = JSON.parse(phone.files[JOURNAL_FILE]);
        const cards = Object.fromEntries(entry.answers.map((a) => [a.cardId, { seen: 1, lastCorrect: a.correct, lastSeenAt: a.at }]));
        writeProgress({ cards, last: { route: entry.route, mode: entry.mode, score: null, total: null } });
        delete phone.files[JOURNAL_FILE];
      }
    }
    phone.backgrounded = false;
  };
  const tapAt = () => {
    const entry = (SCREENS[phone.screen] ?? [])[0];
    return entry;
  };
  const show = (target, wire) => {
    if (wire) phone.wire = wire;
    if (target === "question") phone.answers = [];
    if (target === "next") target = "question";
    phone.screen = target;
    if (target === "result") {
      const cards = {};
      phone.answers.forEach((a) => { cards[a.cardId] = { seen: 1, lastCorrect: a.correct, lastSeenAt: a.at }; });
      const old = JSON.parse(phone.files[PROGRESS_FILE] ?? '{"records":{}}');
      writeProgress({ cards, records: { ...old.records, [`clf/ALL#${phone.wire}`]: phone.answers.length }, last: { route, mode: phone.wire, score: phone.answers.length, total: phone.answers.length } });
      delete phone.files[JOURNAL_FILE];
    }
  };
  const tap = (x, y) => {
    const list = SCREENS[phone.screen] ?? [];
    const index = Math.floor((y - 200) / 300);
    const entry = list[index];
    if (!entry || !entry[1] || x < 100 || x > 900) return;
    show(entry[1], entry[2]);
  };
  const swipe = () => {
    if (phone.screen !== "question") return;
    const n = phone.answers.length + 1;
    phone.answers = [...phone.answers, { cardId: `clf-${String(n).padStart(3, "0")}`, given: true, correct: true, at: 1790000000000 + n }];
    phone.files[JOURNAL_FILE] = JSON.stringify(journal());
    phone.screen = phone.answers.length >= length() ? "last" : "answered";
  };
  const shell = (command) => {
    if (command.startsWith("uiautomator dump")) return "";
    if (command.startsWith("cat /data/local/tmp/")) return xml();
    if (command.startsWith("input tap")) { const [, , x, y] = command.split(" "); tap(Number(x), Number(y)); return ""; }
    if (command.startsWith("input swipe")) { swipe(); return ""; }
    if (command === "input keyevent KEYCODE_HOME") { phone.backgrounded = true; return ""; }
    if (command.startsWith("monkey")) { launch(); return "Events injected: 1\n"; }
    if (command === `pidof ${PKG}`) { if (!phone.alive) throw new Error("exit 1"); return `${phone.pid}\n`; }
    if (command === `am kill ${PKG}`) { if (phone.backgrounded) phone.alive = false; return ""; }
    if (command === `am force-stop ${PKG}`) { phone.alive = false; return ""; }
    if (command === "wm size") return "Physical size: 1080x2400\n";
    if (command === "getprop ro.build.version.sdk") return "36\n";
    if (command === "id -u") return `${phone.uid}\n`;
    const read = /^test -f (\S+) && cat \S+$/.exec(command);
    if (read) {
      const name = read[1].slice(`${FILES}/`.length);
      if (!(name in phone.files)) throw new Error("exit 1");
      return phone.files[name];
    }
    throw new Error(`the simulated phone does not know: ${command}`);
  };
  const adb = (args, { binary = false } = {}) => {
    if (args[0] === "shell") return shell(args[1]);
    if (args[0] === "uninstall") throw new Error("not installed");
    if (args[0] === "install") return "Performing Streamed Install\nSuccess\n";
    if (args[0] === "logcat" && args[1] === "-d") return phone.log;
    if (args[0] === "exec-out") return binary ? Buffer.from("png") : "";
    return "";
  };
  return { adb, phone };
}

function fakeClock() {
  let now = 0;
  return { now: () => now, sleep: async (ms) => { now += ms; } };
}

async function play(options) {
  const { adb, phone } = simulatedPhone(options);
  const out = mkdtempSync(join(tmpdir(), "truthy-play-"));
  const lines = [];
  const failures = await run({ adb, clock: fakeClock(), apk: "app-release.apk", outDir: out, log: (line) => lines.push(line) });
  return { failures, lines, out, phone };
}

test("a healthy release build passes every stage and leaves screenshots and the log", async () => {
  const { failures, lines, out } = await play();
  assert.deepEqual(failures, [], lines.join("\n"));
  assert.equal(lines.filter((l) => l.startsWith("PASS")).length, 3 + CLASSES.length + 2);
  assert.equal(lines.at(-1), "ALL PASSED");
  const files = readdirSync(out);
  for (const name of ["01-start.png", "02-classic-question.png", "03-timed-result.png", "04-after-kill.png", "logcat.txt"]) assert.ok(files.includes(name), name);
});

test("a journal that survives the next launch fails the kill stage", async () => {
  const { failures, lines } = await play({ keepJournal: true });
  assert.deepEqual(failures, ["killed in the middle of a round, next launch applies the journal"], lines.join("\n"));
});

test("a crash of the app in the log fails the log stage and nothing else", async () => {
  const log = ["10-15 02:31:45.123  1001  1001 E AndroidRuntime: FATAL EXCEPTION: main", `10-15 02:31:45.124  1001  1001 E AndroidRuntime: Process: ${PKG}, PID: 1001`].join("\n");
  const { failures } = await play({ log });
  assert.deepEqual(failures, ["logcat has no crash, no serialization failure, no ANR"]);
});

test("an adb that is not root is reported with the reason", async () => {
  const { failures, lines } = await play({ uid: "2000" });
  assert.ok(failures.includes("device"));
  assert.ok(lines.some((l) => /Google APIs image/.test(l)));
});
```

Run `node --test --test-reporter=spec android/Truthy/tools/release/playthrough.test.mjs 2>&1 | grep -E 'Cannot find module|ℹ (pass|fail)'`. Expected: a `Cannot find module` line naming `playthrough.mjs`, `ℹ pass 0`, `ℹ fail 1`.

- [ ] **Step 26: Write the driver.**

`android/Truthy/tools/release/playthrough.mjs`:

```js
// Plays the signed release APK on an emulator through adb, the way a person would, and checks what the
// app left behind. Usage:
//   node playthrough.mjs static <apk> <mapping-folder>      checks of the file itself, no device
//   node playthrough.mjs play <apk> <out-folder> [serial]    install, play, kill, relaunch, scan the log
// The device must be a Google APIs image (not Google Play), so that `adb root` can read the app's private
// folder: a release build is not debuggable and `run-as` does not work on it.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { badgingProblems, checkJournal, checkProgress, parseApksigner, parseBadging, scanLogcat, signingProblems } from "./checks.mjs";
import { fingerprint } from "./keystore.mjs";
import { centre, chooseStartTarget, findNode, parseNodes, screenOf, tapPlan } from "./ui.mjs";

export const PKG = "com.eienmosu.truthy";
export const FILES = `/data/data/${PKG}/files`;
export const PROGRESS_FILE = "truthy.progress.v1.json";
export const JOURNAL_FILE = "truthy.round.v1.json";
export const CLASSES = [
  { name: "Classic", wire: "classic", seconds: 120 },
  { name: "Streak", wire: "streak", seconds: 240 },
  { name: "Three lives", wire: "lives", seconds: 240 },
  { name: "Timed", wire: "timed", seconds: 150 },
];
const UI_DUMP = "/data/local/tmp/truthy-ui.xml";

// A device over an `adb(args, { binary })` function, and a clock `{ now, sleep }`; both are injected so
// the tests can play the same flow against a simulated phone.
export function createDevice({ adb, clock }) {
  const sh = (command) => adb(["shell", command]);
  const device = {
    async screen() {
      let failure = "no nodes";
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          sh(`uiautomator dump ${UI_DUMP} >/dev/null 2>&1`);
          const xml = sh(`cat ${UI_DUMP}`);
          const nodes = parseNodes(xml.slice(Math.max(0, xml.indexOf("<?xml"))));
          if (nodes.length > 0) return nodes;
        } catch (error) {
          failure = String(error.message).split("\n")[0];
        }
        await clock.sleep(500);
      }
      throw new Error(`could not read the screen: ${failure}`);
    },
    tap(point) {
      sh(`input tap ${point.x} ${point.y}`);
    },
    size() {
      const sizes = [...sh("wm size").matchAll(/(\d+)x(\d+)/g)];
      const last = sizes.at(-1);
      return { width: Number(last[1]), height: Number(last[2]) };
    },
    swipeRight() {
      const { width, height } = device.size();
      const y = Math.round(height * 0.42);
      sh(`input swipe ${Math.round(width * 0.3)} ${y} ${Math.round(width * 0.85)} ${y} 150`);
    },
    home() {
      sh("input keyevent KEYCODE_HOME");
    },
    launch() {
      sh(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
    },
    pids() {
      try {
        return sh(`pidof ${PKG}`).trim().split(/\s+/).filter(Boolean);
      } catch {
        return [];
      }
    },
    readFile(name) {
      try {
        return sh(`test -f ${FILES}/${name} && cat ${FILES}/${name}`);
      } catch {
        return null;
      }
    },
    screenshot(file) {
      writeFileSync(file, adb(["exec-out", "screencap", "-p"], { binary: true }));
    },
  };
  return device;
}

async function eventually(clock, check, timeoutMs, describe) {
  const end = clock.now() + timeoutMs;
  let result = check();
  while (result !== true && clock.now() < end) {
    await clock.sleep(400);
    result = check();
  }
  if (result !== true) throw new Error(describe(result));
}

async function waitForScreen(device, clock, wanted, timeoutMs) {
  const end = clock.now() + timeoutMs;
  while (clock.now() < end) {
    const nodes = await device.screen();
    if (wanted.includes(screenOf(nodes))) return nodes;
    await clock.sleep(500);
  }
  throw new Error(`the screen never became ${wanted.join(" or ")}`);
}

// From any step of the start flow to the first question of a round of the given class.
export async function walkToRound(device, clock, className) {
  const end = clock.now() + 90_000;
  while (clock.now() < end) {
    const nodes = await device.screen();
    const kind = screenOf(nodes);
    if (kind === "question") return;
    if (kind === "start") {
      const target = chooseStartTarget(nodes, className);
      if (target) device.tap(centre(target));
    }
    await clock.sleep(800);
  }
  throw new Error(`the ${className} round did not start`);
}

// Swipes True until the result shows, or until `stopAfter` answers have been given and the last is on screen.
export async function playRound(device, clock, { seconds, stopAfter = null }) {
  const end = clock.now() + seconds * 1000;
  let answered = 0;
  let swiped = false;
  while (clock.now() < end) {
    const nodes = await device.screen();
    const kind = screenOf(nodes);
    if (kind === "result") return { finished: true, answered };
    if (kind === "answered") {
      if (swiped) {
        answered += 1;
        swiped = false;
      }
      if (stopAfter !== null && answered >= stopAfter) return { finished: false, answered };
      device.tap(tapPlan(nodes, /^(Next card|See results)\b/));
      await clock.sleep(700);
      continue;
    }
    if (kind === "question") {
      device.swipeRight();
      swiped = true;
      await clock.sleep(900);
      continue;
    }
    await clock.sleep(500);
  }
  throw new Error(`the round did not end within ${seconds} seconds`);
}

async function backToStart(device, clock) {
  const end = clock.now() + 20_000;
  while (clock.now() < end) {
    const nodes = await device.screen();
    const kind = screenOf(nodes);
    if (kind === "start") return;
    const plan = tapPlan(nodes, /^Choose another route$/);
    if (kind === "result" && plan) {
      await clock.sleep(1300);
      device.tap(plan);
    }
    await clock.sleep(700);
  }
  throw new Error("Choose another route did not lead back to step 1");
}

export async function run({ adb, clock, apk, outDir, log = console.log }) {
  const device = createDevice({ adb, clock });
  const failures = [];
  const seenPids = new Set();
  const notePids = () => device.pids().forEach((pid) => seenPids.add(pid));
  const stage = async (name, body) => {
    try {
      const detail = await body();
      log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
    } catch (error) {
      failures.push(name);
      log(`FAIL ${name}: ${error.message}`);
    }
  };
  const shot = (name) => device.screenshot(join(outDir, `${name}.png`));
  mkdirSync(outDir, { recursive: true });

  await stage("device", async () => {
    adb(["wait-for-device"]);
    try {
      adb(["root"]);
    } catch {
      // Already root, or a build where the command is refused: the id check below decides.
    }
    await clock.sleep(2000);
    adb(["wait-for-device"]);
    const sdk = adb(["shell", "getprop ro.build.version.sdk"]).trim();
    const uid = adb(["shell", "id -u"]).trim();
    if (uid !== "0") throw new Error("adb is not root: use a Google APIs image, not a Google Play image");
    return `API ${sdk}`;
  });
  await stage("install", async () => {
    try {
      adb(["uninstall", PKG]);
    } catch {
      // Not installed yet.
    }
    const out = adb(["install", "-r", "-g", apk]);
    if (!/Success/.test(out)) throw new Error(`adb install said: ${out.trim()}`);
  });
  await stage("cold start opens at step 1", async () => {
    adb(["logcat", "-c"]);
    device.launch();
    await clock.sleep(1500);
    notePids();
    await waitForScreen(device, clock, ["start"], 30_000);
    shot("01-start");
  });
  for (const { name, wire, seconds } of CLASSES) {
    await stage(`${name} round to the result`, async () => {
      await walkToRound(device, clock, name);
      notePids();
      shot(`02-${wire}-question`);
      const { answered } = await playRound(device, clock, { seconds });
      shot(`03-${wire}-result`);
      await eventually(clock, () => {
        const problems = checkProgress(device.readFile(PROGRESS_FILE), { expectScored: true, wire });
        return problems.length === 0 ? true : problems.join("; ");
      }, 5000, (why) => `progress after the round: ${why}`);
      await eventually(clock, () => device.readFile(JOURNAL_FILE) === null, 5000, () => "the round journal was not deleted after the result");
      await backToStart(device, clock);
      return `${answered} answers swiped`;
    });
  }
  await stage("killed in the middle of a round, next launch applies the journal", async () => {
    await walkToRound(device, clock, "Classic");
    notePids();
    await playRound(device, clock, { seconds: 60, stopAfter: 3 });
    const journalRaw = device.readFile(JOURNAL_FILE);
    const journalProblems = checkJournal(journalRaw, { minAnswers: 3 });
    if (journalProblems.length > 0) throw new Error(journalProblems.join("; "));
    const journal = JSON.parse(journalRaw);
    device.home();
    await clock.sleep(1500);
    adb(["shell", `am kill ${PKG}`]);
    await clock.sleep(1000);
    if (device.pids().length > 0) {
      adb(["shell", `am force-stop ${PKG}`]);
      await clock.sleep(500);
    }
    device.launch();
    await clock.sleep(1500);
    notePids();
    await waitForScreen(device, clock, ["start"], 30_000);
    await eventually(clock, () => {
      const problems = checkProgress(device.readFile(PROGRESS_FILE), { expectAbandoned: true });
      return problems.length === 0 ? true : problems.join("; ");
    }, 5000, (why) => `progress after the kill: ${why}`);
    const last = JSON.parse(device.readFile(PROGRESS_FILE)).last;
    if (last.route.deckId !== journal.route.deckId || last.mode !== journal.mode) throw new Error("last is not the round that was killed");
    await eventually(clock, () => device.readFile(JOURNAL_FILE) === null, 5000, () => "the journal was not deleted after it was applied");
    shot("04-after-kill");
  });
  await stage("logcat has no crash, no serialization failure, no ANR", async () => {
    const log = adb(["logcat", "-d", "-v", "threadtime", "-b", "main,system,crash"]);
    writeFileSync(join(outDir, "logcat.txt"), log);
    const findings = scanLogcat(log, { pkg: PKG, pids: seenPids });
    if (findings.length > 0) throw new Error(`${findings.length} finding(s), first: ${findings[0]}`);
    return `${seenPids.size} process id(s) seen`;
  });
  log(failures.length === 0 ? "ALL PASSED" : `FAILED: ${failures.join(", ")}`);
  return failures;
}

function sdkTool(name) {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (!home) throw new Error("set ANDROID_HOME to the Android SDK folder");
  const versions = readdirSync(join(home, "build-tools")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (versions.length === 0) throw new Error("no build-tools installed");
  return join(home, "build-tools", versions.at(-1), name);
}

function staticChecks(apk, mappingFolder) {
  const problems = [];
  const signer = execFileSync(sdkTool("apksigner"), ["verify", "--verbose", "--print-certs", apk], { encoding: "utf8" });
  problems.push(...signingProblems(parseApksigner(signer), fingerprint()));
  const badging = execFileSync(sdkTool("aapt2"), ["dump", "badging", apk], { encoding: "utf8" });
  problems.push(...badgingProblems(parseBadging(badging), { packageName: PKG, minSdk: 26, targetSdk: 36 }));
  for (const file of ["mapping.txt", "seeds.txt", "usage.txt"]) {
    if (!existsSync(join(mappingFolder, file))) problems.push(`R8 wrote no ${file}: the build was not shrunk`);
  }
  const mappingFile = join(mappingFolder, "mapping.txt");
  if (existsSync(mappingFile) && /(parseDebugLaunch|DebugLaunchKt)\b/.test(readFileSync(mappingFile, "utf8"))) {
    problems.push("DebugLaunch is in the release build: debug launch extras must not exist there");
  }
  // Rule 4: the extra's key in no dex file (task 11 reads the extras behind BuildConfig.DEBUG, which R8 folds away).
  const dex = execFileSync("unzip", ["-p", apk, "classes*.dex"], { maxBuffer: 256 * 1024 * 1024 });
  if (dex.includes(Buffer.from("truthy.seed"))) {
    problems.push("DebugLaunch is in the release build: debug launch extras must not exist there");
  }
  return problems;
}

async function main(argv) {
  const [command, apk, third, serial] = argv;
  if (command === "static") {
    const problems = staticChecks(apk, third);
    problems.forEach((problem) => console.log(`PROBLEM: ${problem}`));
    console.log(problems.length === 0 ? "static checks ok" : `${problems.length} problem(s)`);
    return problems.length === 0 ? 0 : 1;
  }
  if (command === "play") {
    const adbPath = process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, "platform-tools", "adb") : "adb";
    const adb = (args, { binary = false } = {}) => {
      const full = serial ? ["-s", serial, ...args] : args;
      return execFileSync(adbPath, full, { encoding: binary ? "buffer" : "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    };
    const clock = { now: () => Date.now(), sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };
    const failures = await run({ adb, clock, apk, outDir: third });
    return failures.length === 0 ? 0 : 1;
  }
  console.log("usage: playthrough.mjs static <apk> <mapping-folder> | play <apk> <out-folder> [serial]");
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.log(`ERROR: ${error.message}`);
      process.exitCode = 1;
    },
  );
}
```

```bash
node --test --test-reporter=spec "android/Truthy/tools/release/*.test.mjs" 2>&1 | grep -E 'ℹ (tests|pass|fail)'
```

Expected: `ℹ tests 29`, `ℹ pass 29`, `ℹ fail 0` (10 keystore, 8 checks, 7 screen reader, 4 driver).

- [ ] **Step 27: Commit the checks and the driver.**

```bash
git add android/Truthy/tools/release/checks.mjs android/Truthy/tools/release/checks.test.mjs android/Truthy/tools/release/ui.mjs android/Truthy/tools/release/ui.test.mjs android/Truthy/tools/release/playthrough.mjs android/Truthy/tools/release/playthrough.test.mjs
git commit -m "feat: checks and an adb driver that play the signed Android release build"
```

- [ ] **Step 28: Check the signed APK itself.**

```bash
node android/Truthy/tools/release/playthrough.mjs static android/Truthy/app/build/outputs/apk/release/app-release.apk android/Truthy/app/build/outputs/mapping/release
```

Expected: `static checks ok`. A `PROBLEM:` line says which check failed: `apksigner does not verify the APK` or `the signing certificate differs from the keystore` (the APK was signed with another key: rebuild after step 17), `the release APK is debuggable`, a wrong `package`, `minSdk` or `targetSdk`, `R8 wrote no ...` (the build was not shrunk), or `DebugLaunch is in the release build`.

- [ ] **Step 29: Get the two emulators running.**

```bash
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
"$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" list avd | grep -E 'Name:|Based on|Tag/ABI'
```

Expected: the emulators of task 15, one with API 36 and one with API 26, each `google_apis` (not `google_apis_playstore`). If the API 26 one is missing, create it:

```bash
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "system-images;android-26;google_apis;arm64-v8a"
"$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd -n Pixel8_API26 -k "system-images;android-26;google_apis;arm64-v8a" -d pixel_8
```

Start the API 36 one in the background (replace the name with the one listed), wait until it has booted and list the devices:

```bash
"$ANDROID_HOME/emulator/emulator" -avd Pixel8_API36 -no-snapshot -no-audio >/dev/null 2>&1 &
"$ANDROID_HOME/platform-tools/adb" wait-for-device
until [ "$("$ANDROID_HOME/platform-tools/adb" shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
"$ANDROID_HOME/platform-tools/adb" devices
```

Expected: a line `emulator-5554	device`.

- [ ] **Step 30: Play the release on API 36.**

```bash
OUT="${TMPDIR:-/tmp}/truthy-release-36"
node android/Truthy/tools/release/playthrough.mjs play android/Truthy/app/build/outputs/apk/release/app-release.apk "$OUT" emulator-5554
```

It takes about ten minutes (the Timed minute and the long Streak and Three lives rounds dominate). Expected, in this order:

```text
PASS device: API 36
PASS install
PASS cold start opens at step 1
PASS Classic round to the result: <n> answers swiped
PASS Streak round to the result: <n> answers swiped
PASS Three lives round to the result: <n> answers swiped
PASS Timed round to the result: <n> answers swiped
PASS killed in the middle of a round, next launch applies the journal
PASS logcat has no crash, no serialization failure, no ANR: <n> process id(s) seen
ALL PASSED
```

If a stage fails:
- `the <class> round did not start`: the screen never showed what the driver looks for. Run `adb -s emulator-5554 shell uiautomator dump /data/local/tmp/ui.xml` and `adb -s emulator-5554 shell cat /data/local/tmp/ui.xml`, compare the labels with reference 4.5, and fix the element in the task that drew it (rule 7). Screenshots are in `$OUT`.
- `progress after the round: ...` or `the round journal was not deleted ...`: the minified build wrote a different file than the debug build. This is the failure the task exists for. Read `$OUT/logcat.txt`, retrace a stack with `"$ANDROID_HOME/cmdline-tools/latest/bin/retrace" android/Truthy/app/build/outputs/mapping/release/mapping.txt <file with the trace>`, add the narrowest keep rule to `proguard-rules.pro` (and a line to `ReleaseConfigTest` if it is a general rule), rebuild (step 17), run steps 6 and 28, and play again. Commit the fix as `fix: keep <what> in the Android release build`.
- `logcat has no crash ...` with a finding: the first finding is printed; the rest is in `$OUT/logcat.txt`.

Then look at `$OUT/01-start.png`, `$OUT/02-classic-question.png`, `$OUT/03-classic-result.png` and `$OUT/04-after-kill.png` with the image viewer and confirm that the Overpass fonts are in use (not the system font), the colours and shapes are the Boarding Pass ones, and nothing is cut off. A system font in the release build means resource shrinking dropped the fonts: report it. Finally check that updating over the installed copy keeps the progress:

```bash
"$ANDROID_HOME/platform-tools/adb" -s emulator-5554 install -r android/Truthy/app/build/outputs/apk/release/app-release.apk
"$ANDROID_HOME/platform-tools/adb" -s emulator-5554 shell "test -f /data/data/com.eienmosu.truthy/files/truthy.progress.v1.json && echo progress kept"
```

Expected: `Success` and `progress kept`.

- [ ] **Step 31: Play the release on API 26.**

Shut the first emulator down and start the API 26 one the same way:

```bash
"$ANDROID_HOME/platform-tools/adb" -s emulator-5554 emu kill
"$ANDROID_HOME/emulator/emulator" -avd Pixel8_API26 -no-snapshot -no-audio >/dev/null 2>&1 &
"$ANDROID_HOME/platform-tools/adb" wait-for-device
until [ "$("$ANDROID_HOME/platform-tools/adb" shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
OUT="${TMPDIR:-/tmp}/truthy-release-26"
node android/Truthy/tools/release/playthrough.mjs play android/Truthy/app/build/outputs/apk/release/app-release.apk "$OUT" emulator-5554
"$ANDROID_HOME/platform-tools/adb" -s emulator-5554 install -r android/Truthy/app/build/outputs/apk/release/app-release.apk
"$ANDROID_HOME/platform-tools/adb" -s emulator-5554 shell "test -f /data/data/com.eienmosu.truthy/files/truthy.progress.v1.json && echo progress kept"
```

Use the AVD name from step 29. Expected: the same ten lines as step 30 with `PASS device: API 26`, then `Success` and `progress kept`. Look at the screenshots in `$OUT` the same way. If the emulator's id is not `emulator-5554`, pass the id `adb devices` shows. API 26 has the older splash and no predictive back, so a difference in the first screenshot from API 36 is expected; a difference in fonts or shapes is not.

- [ ] **Step 32: Write the release notes.**

`android/Truthy/RELEASE.md`:

```markdown
# Truthy for Android: the release build

The release APK is shrunk with R8 and signed with a keystore that lives outside this repository (spec section 9). Nothing in this folder holds a password.

## Build a signed release

1. The keystore and four lines in the Gradle user properties must exist (see "Keystore" below).
2. From `android/Truthy`: `./gradlew :app:assembleRelease`.
3. The APK is `app/build/outputs/apk/release/app-release.apk`. Without the four properties the build still works and writes `app-release-unsigned.apk`.
4. R8 writes `mapping.txt`, `seeds.txt` and `usage.txt` to `app/build/outputs/mapping/release`. Keep `mapping.txt` of any APK you hand out: it turns a stack trace back into readable names (`retrace` in the SDK command line tools).

## Keystore

| What | Where |
|---|---|
| Keystore file | `~/keystores/truthy-release.jks` (PKCS12, RSA 2048, alias `truthy`) |
| Passwords | `~/.gradle/gradle.properties`: `TRUTHY_STORE_FILE`, `TRUTHY_STORE_PASSWORD`, `TRUTHY_KEY_ALIAS`, `TRUTHY_KEY_PASSWORD` (the two passwords are the same) |
| Password copy | the owner's password manager |
| Keystore copies | two folders outside the repository, each with `truthy-release.jks`, its `.sha256` file and `RESTORE.txt` |

Losing the keystore or its password means no update can ever replace an installed copy: the app would have to be uninstalled first and its progress would be lost.

Commands (from the repository root; none prints a password except the last):

- `node android/Truthy/tools/release/keystore.mjs create` makes the keystore and the four properties. It refuses to run when either exists.
- `node android/Truthy/tools/release/keystore.mjs fingerprint` prints the SHA-256 fingerprint of the certificate.
- `node android/Truthy/tools/release/keystore.mjs backup <folder>` copies the keystore to a folder and verifies the copy.
- `node android/Truthy/tools/release/keystore.mjs verify <folder>` checks a copy again (run it now and then, and after moving a copy).
- `node android/Truthy/tools/release/keystore.mjs password` prints the password. Owner only, in a terminal nobody records.

To restore on another machine, follow `RESTORE.txt` in a backup folder.

## What the checks do

- `node android/Truthy/tools/release/playthrough.mjs static <apk> <mapping folder>`: the signature verifies with v2 or v3 and its certificate is the keystore's, the APK is not debuggable, package `com.eienmosu.truthy`, minSdk 26, targetSdk 36, R8 wrote its files, and the debug launch parser and its `truthy.seed` key are not in the release build.
- `node android/Truthy/tools/release/playthrough.mjs play <apk> <output folder> [adb serial]`: on a Google APIs emulator (not a Google Play image, because the checks read the app's private folder with `adb root`; a release build is not debuggable, so `run-as` does not work) it installs the APK, opens it at step 1, plays a round of each class by swiping and tapping, checks the progress file and that the round journal is gone, kills the app in the middle of a Classic round and checks that the next launch applies the journal, and scans logcat for crashes, serialization failures and ANRs. Screenshots and the log go to the output folder, outside the repository.
- `node --test "android/Truthy/tools/release/*.test.mjs"` runs the tests of these tools.

## Installing

`adb install -r app-release.apk` updates an installed copy that was signed with the same keystore and keeps its progress. A copy signed with the debug key has to be uninstalled first.

Google's developer verification (started 2026-09-30 in four countries, global in 2027) is reported to leave installs with `adb` alone. Sharing the APK with other people later may need the free limited distribution registration.

## Release record

| Date | Commit | APK size | API 36 | API 26 |
|---|---|---|---|---|
```

Add the record row (the table in the file ends at its header, so the row goes below it):

```bash
echo "| $(date +%Y-%m-%d) | $(git rev-parse --short HEAD) | $(stat -f %z android/Truthy/app/build/outputs/apk/release/app-release.apk) bytes | pass | pass |" >> android/Truthy/RELEASE.md
tail -3 android/Truthy/RELEASE.md
```

Expected: the last three lines are the table header, its separator line and one row with today's date, a short commit hash, a byte count and `pass | pass`. Only run this after steps 30 and 31 both ended `ALL PASSED`.

- [ ] **Step 33: Run every gate and commit.**

```bash
node --test --test-reporter=spec "android/Truthy/tools/release/*.test.mjs" 2>&1 | grep -E 'ℹ (tests|pass|fail)'
(cd android/Truthy && ./gradlew :engine:test :tokengen:test :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease)
pnpm test
git ls-files | grep -E '\.(jks|keystore|p12)$' || echo "no signing files tracked"
git status --short
```

Expected: `ℹ tests 29`, `ℹ pass 29`, `ℹ fail 0`; `BUILD SUCCESSFUL`; the web tests pass, including the repository hygiene test; `no signing files tracked`; `git status --short` prints exactly `?? android/Truthy/RELEASE.md` (the file is new).

```bash
git add android/Truthy/RELEASE.md
git commit -m "docs: Android release notes with the keystore and the play-through record"
```

Do not push. The branch `native` and `main` move only with the owner's explicit approval (spec section 8).
