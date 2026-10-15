### Task 16: The Personal Team device build and the device checklist

Everything before this task runs in the simulator. The spec reserves five things for the owner's iPhone 15 Pro Max because the simulator cannot show them: haptics, 120 Hz, VoiceOver, the real finger, and the sheet material around the paper card (spec 7.6), plus the app icon on a real Home Screen. This task makes that run repeatable and checkable. It adds a test that pins the build facts that only show up wrong on a device (the frame rate key, the icon, the fonts, the launch colour), three small Node tools with tests (is the phone ready, when does the free profile expire, is the checklist complete), a script that builds, signs with the Personal Team, installs and launches the app, and the device checklist itself: 17 items, each with what to do, what to expect and a `Result:` line that the owner fills in. The task ends when `checklist.mjs --done` exits 0.

The build is signed with the free Personal Team (`DEVELOPMENT_TEAM = 2MN3N47796`, already in the project from task 7) and expires after seven days; running the script again renews it and keeps the app's data. It is a Release build, so the DEBUG launch arguments of task 11 do not exist on the phone and every check is reached by tapping.

Nothing in this task was run on a device or in a simulator during drafting. What was run is stated in "Checked during drafting" below.

Builds on: all of tasks 1 to 15 (the app runs, `xcodebuild test` of the `Truthy` scheme is green on the iOS 26.5 simulator, the feel checklist of task 15 is done in the simulator). Task 7 (project, `Info.plist`, fonts, icon, launch colour), task 8 (fonts) and task 11 (`AppModel`) are used directly.

**Files:**
- Create: `ios/Tools/device/devices.mjs`, `ios/Tools/device/expiry.mjs`, `ios/Tools/device/checklist.mjs`, `ios/Tools/device/install.sh`, `ios/Tools/device/DEVICE-CHECKLIST.md`
- Create (tests): `ios/Tools/device/devices.test.mjs`, `ios/Tools/device/expiry.test.mjs`, `ios/Tools/device/checklist.test.mjs`, `ios/Truthy/TruthyTests/DeviceReadinessTests.swift`
- Modify: the app's `Info.plist` (the one named by `INFOPLIST_FILE` of the `Truthy` target), only if the key `CADisableMinimumFrameDurationOnPhone` is missing (task 7 sets it, spec 5.6, so normally nothing changes); `ios/docs/feel-checklist.md` (its `see task 16` cells, step 8); the checklist's `Result:` lines (step 17); at most the haptic mapping of task 13 (step 16, only when D4 fails)

**Interfaces:**
- Consumes, from task 7: the project `ios/Truthy/Truthy.xcodeproj`, the scheme `Truthy`, the unit test target `TruthyTests` whose sources live in the synchronized folder `ios/Truthy/TruthyTests/`, the build settings `PRODUCT_BUNDLE_IDENTIFIER = com.eienmosu.Truthy`, `DEVELOPMENT_TEAM = 2MN3N47796`, `CODE_SIGN_STYLE = Automatic`, `IPHONEOS_DEPLOYMENT_TARGET = 18.0`, a physical `Info.plist` named by `INFOPLIST_FILE`, the `UIAppFonts` list of four font files, `UILaunchScreen` with a `UIColorName`, and the app icon `AppIcon` in the asset catalog.
- Consumes, from task 11: `AppModel`, a class of the `Truthy` module (used only to find the app bundle: `Bundle(for: AppModel.self)`).
- Consumes, from task 13: the haptic mapping built on `sensoryFeedback` (step 16 only).
- Produces (nothing later in this plan relies on it; it is the end of plan B):

```swift
// ios/Truthy/TruthyTests/DeviceReadinessTests.swift
@Suite struct DeviceReadinessTests { /* eight tests */ }
```

```js
// ios/Tools/device/devices.mjs
export function physicalPhones(json): object[]
export function assessDevice(json, wantedName?): { ok: boolean, udid: string | null, name: string | null, osVersion: string | null, problems: string[] }
// ios/Tools/device/expiry.mjs
export function daysLeft(expiresAt: string, now: string): number
export function describeExpiry(expiresAt: string, now: string): string
// ios/Tools/device/checklist.mjs
export const STATUSES: string[]                       // PENDING, PASS, FAIL, SKIP
export function parseChecklist(text): { id, title, status, detail, hasDo, hasExpect }[]
export function structureProblems(items): string[]
export function openIssues(items): string[]
export function summarise(items): { PENDING, PASS, FAIL, SKIP }
```

**Rules:**

1. Signing: automatic, team `2MN3N47796`, built with `-allowProvisioningUpdates` from the command line. No signing file, provisioning profile or certificate enters git: the script builds into a folder under `$TMPDIR`, outside the repository.
2. The script's checks, in order: the phone is paired, reachable and in Developer Mode (`devicectl list devices` JSON is the only interface Apple supports for scripts); the build succeeds; the app is signed by team `2MN3N47796`; the embedded profile's expiry date; install; launch. A failure prints what to do and stops.
3. `devices.mjs` blocks only on `tunnelState == "unavailable"`. A paired phone whose tunnel is `disconnected` is idle, not gone, and `devicectl` connects on use.
4. A `PASS` result carries the device, the iOS version, the short commit hash of the build and the date, because the spec asks every feel item to record platform, OS version and device (spec 5.8). Photos and recordings from the phone never enter the repository.
5. If the phone's iOS needs a newer Xcode than 26.6, stop and ask the owner; Xcode 27 is installed only with the owner's agreement (spec risk 7). Then the items verified on the iOS 26.5 simulator are repeated on the phone: D6 (scroll not blocked), D7 (pan recognizers), D8 (sheet material).
6. The owner performs the device steps (12 to 15). The executing agent does steps 1 to 11 and 16 to 19, prepares each device step for the owner and writes down the results the owner gives.

**Assumed from other tasks:** `INFOPLIST_FILE` of the `Truthy` target names a physical `Info.plist` (step 1 checks it and stops if it does not); `ios/Truthy/TruthyTests/` is the synchronized folder of the unit test target and the test host is the app; the iPhone 17 Pro simulator with iOS 26.5 exists (it does on the drafting Mac).

**Checked during drafting:**
- `DeviceReadinessTests.swift` was typechecked against the iPhone simulator SDK (`xcrun -sdk iphonesimulator swiftc -typecheck -swift-version 6 -target arm64-apple-ios18.0-simulator`, with the Swift Testing framework and macro plugin of Xcode 26.6, and a stub module declaring `AppModel`): no errors.
- The three Node modules and their 17 tests ran under Node 24 (7 + 5 + 5, all passing; each test file also fails with `Cannot find module` before its module exists). `devices.mjs` was run on the real listing of the owner's phone while the phone was unreachable and printed the "not reachable" line with exit 1. `install.sh` was run in a scratch repository and stopped at its first check with the same line. The profile pipeline (`security cms`, `plutil -extract ExpirationDate raw`, `expiry.mjs`) was run on the embedded profile of a Debug build of The Slow Wire and printed "7 days left", the same Personal Team. `PlistBuddy` `Set` or `Add` was run twice on a scratch plist and is idempotent. `DEVICE-CHECKLIST.md` and the Node files were scanned with the repository's hygiene rules: clean.
- Not run: anything that needs the Truthy project, the simulator or the phone.
- Added in the review fix pass and not run: the two tests `theOrientationIsNotLocked` and `theLaunchColourIsTheSurfaceOfEachAppearance`, the third part of D10, the `see task 16` replacement of step 8, the pathspec of step 18 and D17, and the gates added to step 19.

**Steps:**

- [ ] **Step 1: Check the starting state and the signing settings.**

```bash
git branch --show-current
git status --short
node --version
xcodebuild -version
xcodebuild -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -configuration Release -showBuildSettings 2>/dev/null \
  | grep -E '^ +(CODE_SIGN_STYLE|DEVELOPMENT_TEAM|INFOPLIST_FILE|IPHONEOS_DEPLOYMENT_TARGET|PRODUCT_BUNDLE_IDENTIFIER) ='
git ls-files ios | grep -E '\.(mobileprovision|p12|jks|keystore)$' || echo "no signing files tracked"
```

Expected: `native`; nothing from `git status --short`; a Node version starting `v24`; `Xcode 26.6` with its build number; exactly these five lines (in this order, with this spacing from the tool):

```text
    CODE_SIGN_STYLE = Automatic
    DEVELOPMENT_TEAM = 2MN3N47796
    INFOPLIST_FILE = Truthy/Info.plist
    IPHONEOS_DEPLOYMENT_TARGET = 18.0
    PRODUCT_BUNDLE_IDENTIFIER = com.eienmosu.Truthy
```

and `no signing files tracked`. If `INFOPLIST_FILE` is missing the project generates its `Info.plist` and this task's step 3 has nothing to edit: stop and report. A different path after `INFOPLIST_FILE =` is fine, step 3 reads it from the build settings.

- [ ] **Step 2: Write the device-readiness tests for the phone listing.**

`ios/Tools/device/devices.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { assessDevice, physicalPhones } from "./devices.mjs";

// The shape of `xcrun devicectl list devices --json-output <file>` (jsonVersion 3), reduced to the fields read.
const phone = (over = {}) => ({
  identifier: "CORE-DEVICE-ID",
  connectionProperties: { pairingState: "paired", tunnelState: "connected", ...over.connection },
  deviceProperties: { name: "Test iPhone", osVersionNumber: "27.0", developerModeStatus: "enabled", ...over.device },
  hardwareProperties: { reality: "physical", deviceType: "iPhone", udid: "00008130-TEST", ...over.hardware },
});
const listing = (...devices) => ({ info: { jsonVersion: 3 }, result: { devices } });

test("a paired, connected iPhone with Developer Mode on is ready", () => {
  const verdict = assessDevice(listing(phone()));
  assert.equal(verdict.ok, true);
  assert.equal(verdict.udid, "00008130-TEST");
  assert.equal(verdict.name, "Test iPhone");
  assert.equal(verdict.osVersion, "27.0");
  assert.deepEqual(verdict.problems, []);
});

test("an empty or unreadable listing names the missing phone", () => {
  for (const json of [listing(), {}, null, "x"]) {
    const verdict = assessDevice(json);
    assert.equal(verdict.ok, false);
    assert.match(verdict.problems[0], /No physical iPhone/);
  }
});

test("simulators, iPads and Macs are not phones", () => {
  const devices = [
    phone({ hardware: { reality: "virtual" } }),
    phone({ hardware: { deviceType: "iPad" } }),
    phone({ hardware: { deviceType: "mac" } }),
    phone(),
  ];
  assert.equal(physicalPhones(listing(...devices)).length, 1);
});

test("a phone the Mac cannot reach is not ready, and the message says what to do", () => {
  const verdict = assessDevice(listing(phone({ connection: { tunnelState: "unavailable" } })));
  assert.equal(verdict.ok, false);
  assert.match(verdict.problems.join("\n"), /not reachable.*unlock/);
});

test("an idle but paired phone (tunnel disconnected) is still ready", () => {
  assert.equal(assessDevice(listing(phone({ connection: { tunnelState: "disconnected" } }))).ok, true);
});

test("Developer Mode off and an unpaired phone are reported together", () => {
  const verdict = assessDevice(
    listing(phone({ connection: { pairingState: "unpaired" }, device: { developerModeStatus: "disabled" } })),
  );
  assert.equal(verdict.ok, false);
  assert.equal(verdict.problems.length, 2);
  assert.match(verdict.problems.join("\n"), /not paired/);
  assert.match(verdict.problems.join("\n"), /Developer Mode/);
});

test("two phones need a name; a name picks one and an unknown name lists the known ones", () => {
  const two = listing(
    phone({ device: { name: "First" }, hardware: { udid: "U1" } }),
    phone({ device: { name: "Second" }, hardware: { udid: "U2" } }),
  );
  const ambiguous = assessDevice(two);
  assert.equal(ambiguous.ok, false);
  assert.match(ambiguous.problems[0], /First, Second/);
  assert.equal(assessDevice(two, "Second").udid, "U2");
  const unknown = assessDevice(two, "Third");
  assert.equal(unknown.ok, false);
  assert.match(unknown.problems[0], /"Third".*First, Second/);
});
```

Run `node --test --test-reporter=spec ios/Tools/device/devices.test.mjs 2>&1 | grep -E 'Cannot find module|ℹ (pass|fail)'`. Expected: a `Cannot find module` line naming `devices.mjs`, `ℹ pass 0`, `ℹ fail 1`.

- [ ] **Step 3: Write `devices.mjs`, run the tests, commit.**

`ios/Tools/device/devices.mjs`:

```js
// Reads the JSON that `xcrun devicectl list devices --json-output <file>` writes (jsonVersion 3)
// and says whether one physical iPhone is ready to receive a build.
//   node devices.mjs <listing.json> [device name]
// Prints the phone's UDID on stdout when it is ready. Prints what to fix on stderr and exits 1 when it is not.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function physicalPhones(json) {
  const devices = json?.result?.devices;
  if (!Array.isArray(devices)) return [];
  return devices.filter(
    (d) => d?.hardwareProperties?.reality === "physical" && d?.hardwareProperties?.deviceType === "iPhone",
  );
}

export function assessDevice(json, wantedName) {
  const phones = physicalPhones(json);
  const names = phones.map((d) => d.deviceProperties?.name ?? "unnamed").join(", ");
  const fail = (problem) => ({ ok: false, udid: null, name: null, osVersion: null, problems: [problem] });

  if (phones.length === 0) {
    return fail("No physical iPhone is known to this Mac. Connect it by cable once, unlock it and tap Trust.");
  }
  let phone = phones[0];
  if (wantedName) {
    phone = phones.find((d) => d.deviceProperties?.name === wantedName);
    if (!phone) return fail(`No iPhone is named "${wantedName}". Known iPhones: ${names}.`);
  } else if (phones.length > 1) {
    return fail(`More than one iPhone is known (${names}). Pass the name of the one to use.`);
  }

  const problems = [];
  if (phone.connectionProperties?.pairingState !== "paired") {
    problems.push("The iPhone is not paired. Connect the cable, unlock the phone and tap Trust.");
  }
  if (phone.deviceProperties?.developerModeStatus !== "enabled") {
    problems.push("Developer Mode is off. On the phone: Settings, Privacy & Security, Developer Mode, switch it on and restart.");
  }
  if (phone.connectionProperties?.tunnelState === "unavailable") {
    problems.push("The iPhone is not reachable. Connect it by cable, unlock it and keep the screen on.");
  }
  return {
    ok: problems.length === 0,
    udid: phone.hardwareProperties?.udid ?? null,
    name: phone.deviceProperties?.name ?? null,
    osVersion: phone.deviceProperties?.osVersionNumber ?? null,
    problems,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, name] = process.argv.slice(2);
  const verdict = assessDevice(JSON.parse(readFileSync(file, "utf8")), name);
  if (!verdict.ok) {
    for (const problem of verdict.problems) console.error(problem);
    process.exit(1);
  }
  console.error(`iPhone: ${verdict.name}, iOS ${verdict.osVersion}`);
  console.log(verdict.udid);
}
```

Run `node --test --test-reporter=spec ios/Tools/device/devices.test.mjs 2>&1 | grep -E 'ℹ (tests|pass|fail)'`. Expected: `ℹ tests 7`, `ℹ pass 7`, `ℹ fail 0`.

```bash
git add ios/Tools/device/devices.mjs ios/Tools/device/devices.test.mjs
git commit -m "feat: check that the iPhone is paired, reachable and in Developer Mode before a device build"
```

- [ ] **Step 4: Write the profile expiry tests.**

`ios/Tools/device/expiry.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { daysLeft, describeExpiry } from "./expiry.mjs";

const created = "2026-10-16T10:00:00Z";
const expires = "2026-10-23T10:00:00Z";

test("a Personal Team profile has seven days on the day it is made", () => {
  assert.equal(daysLeft(expires, created), 7);
});

test("days are whole days left, rounded down", () => {
  assert.equal(daysLeft(expires, "2026-10-17T10:00:01Z"), 5);
  assert.equal(daysLeft(expires, "2026-10-22T10:00:00Z"), 1);
  assert.equal(daysLeft(expires, "2026-10-22T10:00:01Z"), 0);
});

test("the message names the date and the days left", () => {
  assert.equal(describeExpiry(expires, created), "expires on 2026-10-23, 7 days left");
  assert.equal(describeExpiry(expires, "2026-10-22T10:00:00Z"), "expires on 2026-10-23, 1 day left");
});

test("under a day left says to renew today; past the end says expired", () => {
  assert.equal(describeExpiry(expires, "2026-10-23T02:00:00Z"), "expires on 2026-10-23, less than a day left: renew today");
  assert.equal(describeExpiry(expires, "2026-10-24T00:00:00Z"), "EXPIRED on 2026-10-23: run install.sh again with the phone connected");
});

test("a value that is not a date throws", () => {
  assert.throws(() => daysLeft("soon", created), /not a date: soon/);
});
```

Run `node --test --test-reporter=spec ios/Tools/device/expiry.test.mjs 2>&1 | grep -E 'Cannot find module|ℹ (pass|fail)'`. Expected: a `Cannot find module` line naming `expiry.mjs`, `ℹ pass 0`, `ℹ fail 1`.

- [ ] **Step 5: Write `expiry.mjs`, run the tests, commit.**

`ios/Tools/device/expiry.mjs`:

```js
// When does the Personal Team profile inside a built app stop working?
//   node expiry.mjs <ExpirationDate as ISO 8601> [now as ISO 8601]
// Exits 1 when the profile has already expired.
import { pathToFileURL } from "node:url";

const DAY_MS = 86_400_000;

function ms(value) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`not a date: ${value}`);
  return parsed;
}

export function daysLeft(expiresAt, now) {
  return Math.floor((ms(expiresAt) - ms(now)) / DAY_MS);
}

export function describeExpiry(expiresAt, now) {
  const when = new Date(ms(expiresAt)).toISOString().slice(0, 10);
  if (ms(expiresAt) <= ms(now)) return `EXPIRED on ${when}: run install.sh again with the phone connected`;
  const days = daysLeft(expiresAt, now);
  if (days < 1) return `expires on ${when}, less than a day left: renew today`;
  return `expires on ${when}, ${days} ${days === 1 ? "day" : "days"} left`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [expiresAt, now = new Date().toISOString()] = process.argv.slice(2);
  console.log(describeExpiry(expiresAt, now));
  process.exit(ms(expiresAt) <= ms(now) ? 1 : 0);
}
```

Run `node --test --test-reporter=spec ios/Tools/device/expiry.test.mjs 2>&1 | grep -E 'ℹ (tests|pass|fail)'`. Expected: `ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`.

```bash
git add ios/Tools/device/expiry.mjs ios/Tools/device/expiry.test.mjs
git commit -m "feat: say when the Personal Team profile of a device build expires"
```

- [ ] **Step 6: Write the checklist tests.**

`ios/Tools/device/checklist.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { openIssues, parseChecklist, structureProblems, summarise } from "./checklist.mjs";

const item = (id, result, extra = "Do: x\nExpect: y\n") => `#### ${id}. Title ${id}\n${extra}Result: ${result}\n\n`;

test("items are read with their id, title, status and detail", () => {
  const items = parseChecklist(item("D1", "PASS (iPhone 15 Pro Max, iOS 27.0, build abc1234, 2026-10-16)") + item("D2", "PENDING"));
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    id: "D1",
    title: "Title D1",
    status: "PASS",
    detail: "iPhone 15 Pro Max, iOS 27.0, build abc1234, 2026-10-16",
    hasDo: true,
    hasExpect: true,
  });
  assert.equal(items[1].status, "PENDING");
  assert.equal(items[1].detail, "");
});

test("structure: ids run D1, D2, ... without gaps, every item has Do, Expect and a known Result", () => {
  assert.deepEqual(structureProblems(parseChecklist(item("D1", "PENDING") + item("D2", "PENDING"))), []);
  const broken = parseChecklist(item("D1", "PENDING") + item("D3", "MAYBE") + "#### D4. No result\nDo: x\nExpect: y\n");
  const problems = structureProblems(broken);
  assert.ok(problems.some((p) => p.startsWith("D3: expected id D2")));
  assert.ok(problems.some((p) => p.startsWith("D3: unknown status MAYBE")));
  assert.ok(problems.some((p) => p.startsWith("D4: no Result line")));
  assert.ok(structureProblems(parseChecklist(item("D1", "PENDING", "Do: x\n"))).some((p) => p.startsWith("D1: no Expect line")));
});

test("done gate: pending and failed items block, a pass needs device, iOS version and date", () => {
  const good = "PASS (iPhone 15 Pro Max, iOS 27.0, build abc1234, 2026-10-16)";
  assert.deepEqual(openIssues(parseChecklist(item("D1", good) + item("D2", "SKIP (no Bluetooth keyboard at hand)"))), []);
  const issues = openIssues(
    parseChecklist(item("D1", "PENDING") + item("D2", "FAIL (sheet shows glass)") + item("D3", "PASS") + item("D4", "PASS (looked fine)") + item("D5", "SKIP")),
  );
  assert.deepEqual(issues, [
    "D1: still pending",
    "D2: failed (sheet shows glass)",
    "D3: a PASS needs (device, iOS version, build, date)",
    "D4: a PASS needs (device, iOS version, build, date)",
    "D5: a SKIP needs a reason in parentheses",
  ]);
});

test("the summary counts each status", () => {
  const items = parseChecklist(item("D1", "PENDING") + item("D2", "PENDING") + item("D3", "FAIL (x)"));
  assert.deepEqual(summarise(items), { PENDING: 2, PASS: 0, FAIL: 1, SKIP: 0 });
});

test("the committed checklist is well formed", () => {
  const items = parseChecklist(readFileSync(new URL("./DEVICE-CHECKLIST.md", import.meta.url), "utf8"));
  assert.ok(items.length >= 15);
  assert.deepEqual(structureProblems(items), []);
});
```

Run `node --test --test-reporter=spec ios/Tools/device/checklist.test.mjs 2>&1 | grep -E 'Cannot find module|ℹ (pass|fail)'`. Expected: a `Cannot find module` line naming `checklist.mjs`, `ℹ pass 0`, `ℹ fail 1`.

- [ ] **Step 7: Write `checklist.mjs` and run the tests.**

`ios/Tools/device/checklist.mjs`:

```js
// Reads DEVICE-CHECKLIST.md: every item is a "#### D<n>. Title" heading followed by Do, Expect and Result lines.
//   node checklist.mjs <DEVICE-CHECKLIST.md>          prints the counts, exits 1 when the file is malformed
//   node checklist.mjs <DEVICE-CHECKLIST.md> --done   also exits 1 while an item is pending, failed or recorded without its details
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const STATUSES = ["PENDING", "PASS", "FAIL", "SKIP"];

export function parseChecklist(text) {
  const items = [];
  let current = null;
  for (const line of text.split("\n")) {
    const head = /^#### (D\d+)\. (.+)$/.exec(line);
    if (head) {
      current = { id: head[1], title: head[2], status: null, detail: "", hasDo: false, hasExpect: false };
      items.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("Do: ")) current.hasDo = true;
    else if (line.startsWith("Expect: ")) current.hasExpect = true;
    else if (current.status === null) {
      const result = /^Result: (\S+)(?: \((.*)\))?\s*$/.exec(line);
      if (result) {
        current.status = result[1];
        current.detail = result[2] ?? "";
      }
    }
  }
  return items;
}

export function structureProblems(items) {
  const problems = [];
  items.forEach((item, index) => {
    if (item.id !== `D${index + 1}`) problems.push(`${item.id}: expected id D${index + 1}`);
    if (!item.hasDo) problems.push(`${item.id}: no Do line`);
    if (!item.hasExpect) problems.push(`${item.id}: no Expect line`);
    if (item.status === null) problems.push(`${item.id}: no Result line`);
    else if (!STATUSES.includes(item.status)) problems.push(`${item.id}: unknown status ${item.status}`);
  });
  return problems;
}

export function openIssues(items) {
  const issues = [];
  for (const item of items) {
    if (item.status === "PENDING") issues.push(`${item.id}: still pending`);
    else if (item.status === "FAIL") issues.push(`${item.id}: failed (${item.detail})`);
    else if (item.status === "SKIP" && item.detail === "") issues.push(`${item.id}: a SKIP needs a reason in parentheses`);
    else if (item.status === "PASS" && !(/iOS \d+/.test(item.detail) && /\d{4}-\d{2}-\d{2}/.test(item.detail))) {
      issues.push(`${item.id}: a PASS needs (device, iOS version, build, date)`);
    }
  }
  return issues;
}

export function summarise(items) {
  const counts = { PENDING: 0, PASS: 0, FAIL: 0, SKIP: 0 };
  for (const item of items) if (item.status in counts) counts[item.status] += 1;
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, flag] = process.argv.slice(2);
  const items = parseChecklist(readFileSync(file, "utf8"));
  const problems = structureProblems(items);
  const counts = summarise(items);
  console.log(`${items.length} items: ${STATUSES.map((s) => `${counts[s]} ${s}`).join(", ")}`);
  const blocking = flag === "--done" ? [...problems, ...openIssues(items)] : problems;
  for (const line of blocking) console.error(line);
  process.exit(blocking.length === 0 ? 0 : 1);
}
```

Run `node --test --test-reporter=spec ios/Tools/device/checklist.test.mjs 2>&1 | grep -E '✔|✖|ℹ (pass|fail)|ENOENT'`. Expected: four `✔` lines, one `✖ the committed checklist is well formed` with an `ENOENT` error naming `DEVICE-CHECKLIST.md`, `ℹ pass 4`, `ℹ fail 1`. The last test is the one that pins the checklist file, which step 8 writes.

- [ ] **Step 8: Write the device checklist, run the tests, commit.**

`ios/Tools/device/DEVICE-CHECKLIST.md` (the owner edits only the `Result:` lines; the headings, `Do:` and `Expect:` lines are what `checklist.mjs` reads and what the owner follows):

````markdown
# Truthy iOS: device checklist

The owner runs this on the iPhone 15 Pro Max with the Personal Team build from `ios/Tools/device/install.sh` (spec section 7.6). The simulator plays no haptics, runs at no more than 60 Hz, has no real finger and no VoiceOver rotor, so these checks cannot be done anywhere else.

## How to record a result

Each item ends with a `Result:` line. Replace `PENDING` with one of:

- `Result: PASS (iPhone 15 Pro Max, iOS 27.0, build 1a2b3c4, 2026-10-16)`: device, iOS version (Settings, General, About), the short commit hash of the build, the date.
- `Result: FAIL (what you saw)`: then open a fix; the item stays FAIL until a later run passes.
- `Result: SKIP (why)`: only with a reason.

When every item is PASS or SKIP, `node ios/Tools/device/checklist.mjs ios/Tools/device/DEVICE-CHECKLIST.md --done` exits 0.

Photos and screen recordings from the phone stay outside the repository (they carry location metadata, and the hygiene scan rejects PNG metadata). Record with Control Center, AirDrop to the Mac, and keep them in a scratch folder.

## Before you start

1. Phone: unlock it, keep it on the charger, Settings, Battery, Low Power Mode off (it can cap the display at 60 Hz), Settings, Accessibility, Motion, Limit Frame Rate off.
2. Install: `ios/Tools/device/install.sh`. The first launch can say "Untrusted Developer": Settings, General, VPN & Device Management, trust the Apple Development profile, then tap the Truthy icon.
3. The build is a Release build, so the debug launch arguments do not exist. Everything below is reached by tapping.

## Known failures of the install

| Message | Cause and fix |
|---|---|
| No Accounts | Xcode, Settings, Accounts: add the Apple ID of the Personal Team (team 2MN3N47796). |
| Your team has no devices | Select the iPhone in Xcode, run once with Cmd+R from the Xcode window; this registers the phone with the team. Then run the script again. |
| Developer Mode disabled | On the phone: Settings, Privacy & Security, Developer Mode. The row appears only after Xcode has paired the phone and tried one run. |
| The iPhone is not reachable | Cable, unlock, keep the screen on. |
| Provisioning refuses a new bundle id or a further app | Free provisioning limits how many apps stay installed and how many new app ids are created per week. Remove an unused app or wait. |
| The phone's iOS is newer than Xcode 26.6 supports | Stop. Xcode 27 and an iOS 27 simulator are installed only with the owner's agreement (spec risk 7). After that, repeat D6, D7, D8 and D9, which were verified on the iOS 26.5 simulator only. |

## Checks

### Install, icon and launch

#### D1. Install, first launch and renewal
Do: Run `ios/Tools/device/install.sh`. Note the expiry line it prints. Play one Classic round to the result. Then run the script again (install over the existing app) without deleting the app.
Expect: The script ends with the app open on start step 1. The expiry line says 6 or 7 days left. After the second install the Continue line on step 1 still shows the route you just played: progress survives a renewal.
Result: PENDING

#### D2. App icon
Do: Look at the icon on the Home Screen, in Settings and in the App Switcher. Switch the Home Screen to Dark and to Tinted (long press the Home Screen, Edit, Customize).
Expect: The Truthy mark at 60 percent of the width on an opaque light blue square (`#a9d6f0`), no transparent or black corners, sharp edges. Dark and Tinted variants are derived by the system and only need to look intentional.
Result: PENDING

#### D3. Launch screen and the first frame against the system appearance
Do: Set the system appearance to Dark (Control Center or Settings, Display & Brightness). In the app press the theme switch until the day theme shows ("Switch to dark theme" is the label while day shows). Swipe the app away and open it again. Repeat the other way round: system Light, app night theme.
Expect: The launch screen follows the system (dark, then light). The first frame the app draws is in the stored theme, with no flash of the other one, and the status bar icons follow the app theme (dark icons by day, light at night). Feel items N10 and N12 on the phone.
Result: PENDING

### Touch, motion and haptics

#### D4. Haptics
Do: In a Classic round drag the card slowly past the commit line (90 pt), back under it, and past it again. Answer one card right and one wrong with the True and False buttons. Play a Timed round until the time is up. Then switch System Haptics off (Settings, Sounds & Haptics) and repeat a drag.
Expect: One light tick per crossing of the line, none while the finger moves and none when moving back under the line. A success pattern on Correct, an error pattern on Not quite, a warning pattern at Time is up. Nothing else vibrates (not Next card, not the result, not the pills). With System Haptics off, nothing at all.
Decide: are the success, error and warning patterns too strong? If yes write FAIL (too strong) here: the spec's answer is to replace them with a light impact.
Result: PENDING

#### D5. 120 Hz
Do: With Low Power Mode and Limit Frame Rate off, drag the card slowly and fast, let it spring back, scroll a long ticket, and scrub the start-flow back with the edge pan. For a measurement, profile in Xcode: choose the iPhone as the run destination, Product, Profile, template Animation Hitches, drag the card for 20 seconds, stop, select the range of the drag in the hitches track.
Expect: Motion looks as smooth as the Home Screen scroll. In Instruments the frame intervals during the drag are about 8.3 ms (120 Hz), not 16.7 ms (60 Hz), and there are no hitches longer than one frame.
Result: PENDING

#### D6. Real finger on the card
Do: On a card with a long statement: (a) drag vertically; (b) drag horizontally; (c) drag diagonally, starting on the text; (d) release a fast flick and a slow drag; (e) touch the card while it is springing back; (f) put a second finger down during a drag.
Expect: N3: the vertical drag scrolls the ticket with iOS bounce, the horizontal drag moves the card, a diagonal does one or the other and never both. N4: the card sits under the finger at all times, with no lag. N5: the release springs back with the speed of the flick, and a touch catches the card where it is. A second finger cancels the drag and the card springs back. The scroll is not blocked at any time (the iOS 26.5 simulator showed `simultaneousGesture` blocking it; the app does not use it).
Result: PENDING

#### D7. Edge pans
Do: (a) On start steps 2 to 6 pan from the left screen edge slowly, then release before halfway and slowly past halfway; then flick quickly to the right and quickly to the left. (b) On iOS 26 or later also pan right from the middle of a step. (c) On the round pan from the left edge with no answers, then with answers. (d) Start a card drag within about a thumb's width of the left edge.
Expect: N1: the back motion follows the finger, a cancelled pan returns with no change of choices, a completed pan goes back exactly one step, a fast flick right completes and a fast flick left cancels. (b) does the same as (a). N13: on the round the surface shrinks towards 0.94 with the pan; with no answers it leaves at once, otherwise "Leave round?" opens. (d) never moves the card.
Result: PENDING

### Sheet, links and life cycle

#### D8. Leave sheet material
Do: In a round answer one card, tap the X ("Leave round"). Look at the sheet. Swipe it down. Open it again and tap the Keep playing button, then open it and tap outside. Double tap the X quickly. Then do it once at the largest accessibility text size (D12).
Expect: A paper card with the 16 gutter from the screen edges and no glass or blur visible around it (on iOS 26 and later the partial sheet is inset: the card fills it and takes its corner radius, which is accepted chrome), no grabber. Swipe down, tapping outside and Keep playing all keep playing. A double tap on the X leaves the sheet open. At the largest text size the sheet grows to fit the card and becomes full height when the card is taller than the screen, with the card scrolling. Check on every iOS version the phone runs.
Result: PENDING

#### D9. Timed round and the app life cycle
Do: Start a Timed round. (a) Pull down Control Center for 10 seconds, close it. (b) Open the leave sheet for 10 seconds, keep playing. (c) Press Home for 10 seconds, return. (d) Lock the phone for 10 seconds, unlock. (e) Rotate to landscape and back.
Expect: The clock keeps running in (a) and (b). In (c) and (d) it stops while the app is away and continues from the same second on return. In (e) the round is not reset and nothing clips.
Result: PENDING

#### D10. Killed in the middle of a round
Do: Start a Classic round on any deck, answer 3 cards, swipe the app away in the App Switcher, open it again. Then start another round, answer nothing, swipe the app away, open it again. Then start a third Classic round, answer all ten cards so the last answer shows See results, swipe the app away before tapping See results, and open it again.
Expect: Every launch opens at start step 1 with no choices. After the first, the Continue line shows that deck and section and the class, without a score part, the deck card shows a seen percentage above 0 and no new record was set. After the second, nothing changed. After the third, the round is recorded: the Continue line shows its score, and the class card on step 5 shows Best with this score.
Result: PENDING

#### D11. Source link
Do: Answer a card in Classic, tap the source link on the answer slip. Close the browser sheet with Done.
Expect: N11: the source opens in the in-app browser (Safari view controller) over the app, not in the Safari app. The round is as you left it after Done. The link is spoken as "{source.title} (opens in browser)" (D14).
Result: PENDING

### Accessibility

#### D12. Largest text, Reduce Motion and Increase Contrast
Do: Settings, Accessibility, Display & Text Size, Larger Text, Larger Accessibility Sizes on, slider to the maximum. Walk start steps 1 to 6, the fill-in pass, a round in all four classes, the leave sheet and the result with a missed card open. Then turn Reduce Motion on and repeat a forward step, a back pan and an answer. Turn Increase Contrast on and look at one screen.
Expect: N9: nothing clips on any screen; the start flow's whole column (task 12 rule 9), the ticket, the result column and the missed list scroll; the pass and the ticket's paper text stay at the `xxLarge` size (README deviation 6). With Reduce Motion the steps cross-fade (no travel, no unroll), stamps appear at rest, and the back pan still follows the finger. Increase Contrast leaves every label readable.
Result: PENDING

#### D13. VoiceOver on the start flow
Do: Turn VoiceOver on (triple-click the side button after adding it in Accessibility Shortcut). Swipe through step 1, then choose an area and go on through the steps, then use the Back pill and the theme switch.
Expect: Step titles read "Choose an area", "Choose a platform", "Choose a deck", "Choose a section", "Choose how to play", "Your pass is ready". Option lists are announced as lists. An area card reads "{title}, {n} decks". The Back pill reads "Back to areas" (and the matching word on the later steps). The theme switch reads "Switch to dark theme" or "Switch to light theme". A filled pass field reads "Change area, now {value}". The Continue line reads "Continue: {deckName}, {sectionTitle}, {class}. Last score {x}." The change of step is announced and focus lands on the new step.
Result: PENDING

#### D14. VoiceOver on the round
Do: With VoiceOver on, play a Classic round. Open the Actions rotor on the card. Answer with the buttons and with the custom actions. Play a Streak round to a wrong answer and a Three lives round to a lost life. Play a Timed round for a few cards.
Expect: The header is one element with a full sentence ("Card 1 of 10." and so on, the streak, lives and timed sentences of reference 4.5). The ticket scrolls with three fingers. The stub is not read. The card offers the custom actions "Answer true" and "Answer false". After an answer the verdict is announced ("Correct. The answer is True." or "Not quite. The answer is False.", plus the life or streak sentence). The source link reads "{source.title} (opens in browser)". In Timed the card announcer reads "Card {n}. Applies to {appliesTo}. {statement}" from card 2, and "Time is up. This card doesn't count." at the end.
Result: PENDING

#### D15. VoiceOver on the leave sheet and the result
Do: With VoiceOver on, open the leave sheet, close it, finish a Classic round with at least one wrong answer, open a missed card with Why.
Expect: The sheet is modal, reads "Leave round?" then its body, and the buttons "Keep playing" and "Leave round"; nothing behind it is reachable. The result screen has the heading "Round complete" and the completed sentence of the header; the comparison text is read ("First round on this route", "New best", "Equals your best" or "{by} short of your best"). The missed list reads "Missed cards" and "{n} to review"; the Why button reads "Why, card {nn}" and its region opens with the explanation. "Close results" is the first control and works after one second.
Result: PENDING

### The rest of the device

#### D16. Hardware keyboard, if one is at hand
Do: Pair a Bluetooth keyboard. On the round press the arrow keys, Return after an answer, Escape, and Escape again with the sheet open. Finish a round and press Escape on the result after a second. On the start flow press Escape on step 3 and on step 1. Hold Escape on step 5 for a second.
Expect: Arrows answer, Return does the action after an answer, Escape is the X (Keep playing while the sheet is open, the round as it was), Escape on the result closes it, Escape on the start flow goes back one step and does nothing on step 1. A held key acts once (the held Escape goes back exactly one step). This is the only run of Escape and Return on a device: the UI tests `testEscapeGoesBackAndIsConsumedOnStepOne`, `testEscapeOnTheSheetKeepsPlaying` and `testReturnAndEscape` skip on the simulator, where XCUITest cannot deliver these keys (task 12 rule 6).
Result: PENDING

#### D17. Install hygiene
Do: On the Mac, from the repository root, run `git status --short -- . ':!ios/Tools/device/DEVICE-CHECKLIST.md'`, then `git ls-files ios | grep -E '\.(mobileprovision|p12|jks|keystore)$'`, then `git grep -nE '/(Users|home)/' -- ios`.
Expect: No output from any of them: the build left no signing file, no user data folder and no absolute path in the repository (this checklist itself is modified until step 19 commits it).
Result: PENDING
````

Run:

```bash
node --test --test-reporter=spec 'ios/Tools/device/*.test.mjs' 2>&1 | grep -E 'ℹ (tests|pass|fail)'
node ios/Tools/device/checklist.mjs ios/Tools/device/DEVICE-CHECKLIST.md
node ios/Tools/device/checklist.mjs ios/Tools/device/DEVICE-CHECKLIST.md --done; echo "exit $?"
```

Expected: `ℹ tests 17`, `ℹ pass 17`, `ℹ fail 0`; then `17 items: 17 PENDING, 0 PASS, 0 FAIL, 0 SKIP`; then the same line, seventeen lines `D1: still pending` to `D17: still pending`, and `exit 1`. The gate is closed until the owner has run the checklist.

Replace each `see task 16` cell of `ios/docs/feel-checklist.md` (task 15) with the D item that checks the same thing on the phone: N1 `D7`, N3 `D6`, N4 `D6`, N5 `D6`, N6 `D4`, N7 `D8, D9`, N9 `D12`, N10 `D3`, N11 `D11`, N12 `D3`, N13 `D7` (N2 and N8 stay `not applicable`). Then:

```bash
grep -c 'see task 16' ios/docs/feel-checklist.md
git add ios/Tools/device/checklist.mjs ios/Tools/device/checklist.test.mjs ios/Tools/device/DEVICE-CHECKLIST.md ios/docs/feel-checklist.md
git commit -m "docs: add the device checklist and the tool that checks it is complete"
```

Expected: the `grep` prints `0`.

- [ ] **Step 9: Write the readiness test for the built app.**

`ios/Truthy/TruthyTests/DeviceReadinessTests.swift`:

```swift
import Foundation
import Testing
import UIKit
@testable import Truthy

// Facts of the built app that only show on a real device when they are wrong: the frame rate key,
// the icon, the fonts, the launch colour, the orientations. The test host is the app, so the bundle
// that holds AppModel is the app bundle. Spec 2, 5.4, 5.6 and 7.6. Eight tests.
@Suite struct DeviceReadinessTests {
  private let app = Bundle(for: AppModel.self)
  private var info: [String: Any] { app.infoDictionary ?? [:] }

  @Test func theBundleIsTheOwnersAppForIOS18() {
    #expect(app.bundleIdentifier == "com.eienmosu.Truthy")
    #expect(info["CFBundleDisplayName"] as? String == "Truthy")
    #expect(info["MinimumOSVersion"] as? String == "18.0")
  }

  @Test func theFrameRateKeyLetsDragsAndSpringsRunAt120Hz() {
    #expect(info["CADisableMinimumFrameDurationOnPhone"] as? Bool == true)
  }

  @Test func theAppDoesNotOptOutOfLiquidGlass() {
    #expect(info["UIDesignRequiresCompatibility"] == nil)
  }

  @Test func theLaunchScreenNamesAColour() {
    let launch = info["UILaunchScreen"] as? [String: Any]
    let colour = launch?["UIColorName"] as? String
    #expect(colour?.isEmpty == false)
  }

  @Test func fourFontFilesAreRegisteredAndPresentInTheBundle() {
    let fonts = info["UIAppFonts"] as? [String] ?? []
    #expect(fonts.count == 4)
    for file in fonts {
      let url = app.bundleURL.appendingPathComponent(file)
      #expect(FileManager.default.fileExists(atPath: url.path), "missing font file \(file)")
    }
  }

  @Test func theAppIconIsNamedInTheCompiledInfoPlist() {
    let icons = info["CFBundleIcons"] as? [String: Any]
    let primary = icons?["CFBundlePrimaryIcon"] as? [String: Any]
    #expect(primary?["CFBundleIconName"] as? String == "AppIcon")
  }

  @Test func theOrientationIsNotLocked() {
    let phone = Set(info["UISupportedInterfaceOrientations"] as? [String] ?? [])
    #expect(phone.isSuperset(of: ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"]))
  }

  @Test func theLaunchColourIsTheSurfaceOfEachAppearance() throws {
    let name = try #require((info["UILaunchScreen"] as? [String: Any])?["UIColorName"] as? String)
    func hex(_ style: UIUserInterfaceStyle) throws -> String {
      let colour = try #require(UIColor(named: name, in: app, compatibleWith: UITraitCollection(userInterfaceStyle: style)))
      var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
      colour.getRed(&r, green: &g, blue: &b, alpha: &a)
      return String(format: "#%02x%02x%02x", Int((r * 255).rounded()), Int((g * 255).rounded()), Int((b * 255).rounded()))
    }
    #expect(try hex(.light) == "#c4e3f5")
    #expect(try hex(.dark) == "#101c33")
  }
}
```

Run:

```bash
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -only-testing:TruthyTests/DeviceReadinessTests 2>&1 | grep -E 'Test run with|error:|✘|TEST (SUCCEEDED|FAILED)'
```

Expected: `Test run with 8 tests in 1 suite passed` and `** TEST SUCCEEDED **` (task 7 sets the frame rate key, spec 5.6, and step 10 then changes nothing). If `theFrameRateKeyLetsDragsAndSpringsRunAt120Hz` fails, task 7 missed the key: step 10 adds it. If any of the other seven fails, stop: it is a gap in task 7 or 8 (a missing icon name, font file, launch colour or orientation) and the fix belongs in the project, not in this test.

- [ ] **Step 10: Set the frame rate key, run the tests, commit.**

```bash
plist="ios/Truthy/$(xcodebuild -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -configuration Release -showBuildSettings 2>/dev/null | awk '$1 == "INFOPLIST_FILE" {print $3}')"
test -f "$plist" && echo "editing $plist"
/usr/libexec/PlistBuddy -c "Set :CADisableMinimumFrameDurationOnPhone true" "$plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CADisableMinimumFrameDurationOnPhone bool true" "$plist"
plutil -p "$plist" | grep CADisableMinimumFrameDurationOnPhone
```

Expected: `editing ios/Truthy/Truthy/Info.plist` (or the path the build settings gave), then `"CADisableMinimumFrameDurationOnPhone" => true`. The command is safe to repeat: `Set` succeeds when the key exists, `Add` runs only when it does not.

Run the step 9 command again. Expected: `Test run with 8 tests in 1 suite passed` and `** TEST SUCCEEDED **`. Then run the whole suite once:

```bash
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' 2>&1 | grep -E 'error:|✘|TEST (SUCCEEDED|FAILED)'
```

Expected: `** TEST SUCCEEDED **` and no `✘` or `error:` lines.

```bash
git add ios/Truthy/TruthyTests/DeviceReadinessTests.swift "$plist"
git commit -m "feat: allow 120 Hz drags and springs on ProMotion phones and pin the device build facts"
```

If step 9 passed at once, `"$plist"` is unchanged and `git add` of it adds nothing; the commit then holds only the test.

- [ ] **Step 11: Write the install script, check it, commit.**

`ios/Tools/device/install.sh`:

```bash
#!/bin/bash
# Builds Truthy for the owner's iPhone with the Personal Team, installs it and launches it.
#   ios/Tools/device/install.sh [name of the iPhone]
#   CONFIGURATION=Debug ios/Tools/device/install.sh      builds Debug instead of Release
# Run it again after seven days: the free profile expires, and installing over the app keeps its data.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
tool=ios/Tools/device
bundle_id=com.eienmosu.Truthy
team=2MN3N47796
configuration="${CONFIGURATION:-Release}"
work="${TMPDIR:-/tmp}/truthy-device"
mkdir -p "$work"

echo "1/5 looking for the iPhone"
xcrun devicectl list devices --json-output "$work/devices.json" > /dev/null
udid="$(node "$tool/devices.mjs" "$work/devices.json" ${1:+"$1"})"

echo "2/5 building $configuration for the device (log: $work/build.log)"
if ! xcodebuild build \
  -project ios/Truthy/Truthy.xcodeproj \
  -scheme Truthy \
  -configuration "$configuration" \
  -destination "id=$udid" \
  -derivedDataPath "$work/derived" \
  -allowProvisioningUpdates > "$work/build.log" 2>&1; then
  grep -E "error:" "$work/build.log" | sort -u | head -20 >&2 || true
  echo "The build failed. See the table in ios/Tools/device/DEVICE-CHECKLIST.md and the log above." >&2
  exit 1
fi
app="$work/derived/Build/Products/$configuration-iphoneos/Truthy.app"

echo "3/5 checking the signature"
codesign --verify --strict "$app"
signed_by="$(codesign -dvv "$app" 2>&1 | sed -n 's/^TeamIdentifier=//p')"
if [ "$signed_by" != "$team" ]; then
  echo "The app is signed by team '$signed_by', expected $team." >&2
  exit 1
fi
codesign -d --entitlements :- "$app" 2> /dev/null | plutil -extract get-task-allow raw -o - - 2> /dev/null | sed 's/^/get-task-allow: /' || true

echo "4/5 checking the profile"
security cms -D -i "$app/embedded.mobileprovision" > "$work/profile.plist"
node "$tool/expiry.mjs" "$(plutil -extract ExpirationDate raw -o - "$work/profile.plist")"

echo "5/5 installing and launching"
xcrun devicectl device install app --device "$udid" "$app"
xcrun devicectl device process launch --device "$udid" --terminate-existing "$bundle_id" \
  || echo "Installed, but the launch failed: unlock the phone and tap the Truthy icon." >&2
```

```bash
chmod +x ios/Tools/device/install.sh
bash -n ios/Tools/device/install.sh && echo "syntax ok"
ios/Tools/device/install.sh; echo "exit $?"
```

Run the last command with the phone unplugged. Expected: `syntax ok`; then `1/5 looking for the iPhone`, `The iPhone is not reachable. Connect it by cable, unlock it and keep the screen on.` and `exit 1`. (With no phone known to the Mac at all the line is `No physical iPhone is known to this Mac. ...`.)

```bash
git add ios/Tools/device/install.sh
git commit -m "feat: build, sign, install and launch Truthy on the owner's iPhone with the Personal Team"
```

`git ls-files -s ios/Tools/device/install.sh` must show mode `100755`.

- [ ] **Step 12: Owner: connect the phone and install (D1 setup).**

The owner connects the iPhone 15 Pro Max by cable, unlocks it and taps Trust if asked. If Developer Mode has been switched off by an iOS update, the owner turns it on (the table in the checklist). Then, from the repository root:

```bash
ios/Tools/device/install.sh
```

Expected, in order (the first build takes a few minutes; the phone's name and iOS version come from the phone):

```text
1/5 looking for the iPhone
iPhone: <name of the phone>, iOS <version>
2/5 building Release for the device (log: .../truthy-device/build.log)
3/5 checking the signature
get-task-allow: false
4/5 checking the profile
expires on <date seven days ahead>, 6 days left
5/5 installing and launching
... App installed ...
... Launched application with com.eienmosu.Truthy bundle identifier.
```

The number of days left is 6 or 7 depending on the hour. `get-task-allow` may print `true` or `false` for a Release build; it only matters for step 14 (D5), where Instruments profiles through Xcode's Profile action, not through the script. On the first launch the phone may say "Untrusted Developer": Settings, General, VPN & Device Management, trust the profile, tap the icon. If the script stops, the message names the cause; the table in the checklist lists the known ones. A phone whose iOS is newer than Xcode 26.6 supports is rule 5: stop and ask.

Note the short hash of the build for the result lines: `git rev-parse --short HEAD`.

- [ ] **Step 13: Owner: run D1 to D3 (install, icon, launch).**

The owner follows items D1 to D3 of `ios/Tools/device/DEVICE-CHECKLIST.md` and gives the agent the result of each (or edits the `Result:` lines). D1 includes a second run of `install.sh` over the installed app; the Continue line must survive it. Expected, from the checklist: the app opens on start step 1 after install, the icon is the opaque light blue square with the mark, and the launch screen follows the system while the first drawn frame follows the stored theme.

- [ ] **Step 14: Owner: run D4 to D7 (haptics, 120 Hz, finger, edge pans).**

The owner follows D4 to D7. For D5 the owner profiles in Xcode (the iPhone as run destination, Product, Profile, template Animation Hitches). Expected: one tick per crossing of the commit line and the verdict patterns of the spec's table (D4); frame intervals of about 8.3 ms during a drag (D5); the vertical drag scrolls, the horizontal one moves the card, never both, and the card sits under the finger (D6); the edge pans scrub, cancel and complete as the spec describes, and a drag starting at the edge never moves the card (D7). A FAIL is recorded with what the owner saw; the checklist stays closed.

- [ ] **Step 15: Owner: run D8 to D16 (sheet, life cycle, links, accessibility, keyboard).**

The owner follows D8 to D16 in order: the leave sheet material (D8, on the phone's iOS: no glass around the card), the Timed clock under Control Center, the sheet, Home and lock (D9), the killed app (D10), the source link in the in-app browser (D11), the largest text size and Reduce Motion (D12), and VoiceOver on the start flow, the round and the sheet with the result (D13 to D15). D16 (a hardware keyboard) is SKIP with the reason "no keyboard at hand" when none is paired. Expected results are in the checklist items.

- [ ] **Step 16: If D4 says too strong: replace the notification haptics with a light impact.**

Skip this step when D4 is PASS. The spec's answer to patterns that feel too strong is `.impact(weight: .light)` for the three notification moments (spec 5.5). Find the mapping that task 13 built:

```bash
grep -rn "sensoryFeedback\|\.success\|\.error\|\.warning" ios/Truthy/Truthy --include=*.swift
```

Expected: the lines in the round screen where the verdict and time-up feedback are chosen. Replace each `.success`, `.error` and `.warning` passed to `sensoryFeedback` with `.impact(weight: .light)`; leave the threshold crossing, which already is `.impact(weight: .light)`. If a unit test of task 13 pins those three kinds, change its expected values the same way. Then:

```bash
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' 2>&1 | grep -E 'error:|✘|TEST (SUCCEEDED|FAILED)'
git add ios/Truthy
git commit -m "fix: use a light impact for the verdict and time-up haptics"
```

Expected: `** TEST SUCCEEDED **`. Run `ios/Tools/device/install.sh` again and let the owner redo D4; the old FAIL line is replaced by the new result.

- [ ] **Step 17: Record the results of D1 to D16 and check the gate.**

The agent writes the owner's results into the `Result:` lines, in the form `Result: PASS (iPhone 15 Pro Max, iOS <version>, build <short hash>, <date>)`, `Result: FAIL (<what the owner saw>)` or `Result: SKIP (<reason>)`. D17 stays PENDING until step 18. Then:

```bash
node ios/Tools/device/checklist.mjs ios/Tools/device/DEVICE-CHECKLIST.md --done; echo "exit $?"
```

Expected, when D1 to D16 are all PASS or SKIP with a reason: the count line (for example `17 items: 1 PENDING, 15 PASS, 0 FAIL, 1 SKIP`, the split depends on the owner), then `D17: still pending` and `exit 1`. Any other issue line names an item to redo or to complete.

- [ ] **Step 18: Run the install hygiene check (D17) and record it.**

```bash
git status --short -- . ':!ios/Tools/device/DEVICE-CHECKLIST.md'
git ls-files ios | grep -E '\.(mobileprovision|p12|jks|keystore)$'
git grep -nE '/(Users|home)/' -- ios
```

Expected: no output from any of the three (the checklist itself is modified and is committed in step 19). If `git status --short` lists files, they are build or Xcode user data that the ignores of plan A should cover: stop and report which paths. Then set D17 to `Result: PASS (iPhone 15 Pro Max, iOS <version>, build <short hash>, <date>)` and run the gate of step 17 again. Expected: `exit 0`.

- [ ] **Step 19: Run the web gates and commit the results.**

```bash
swift test --package-path ios/TruthyEngine 2>&1 | tail -1
xcodebuild test -project ios/Truthy/Truthy.xcodeproj -scheme Truthy -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' 2>&1 | grep -E 'TEST (SUCCEEDED|FAILED)'
pnpm test 2>&1 | tail -6
pnpm typecheck 2>&1 | tail -3
git add ios/Tools/device/DEVICE-CHECKLIST.md
git commit -m "docs: record the iPhone 15 Pro Max device results"
git status --short
```

Expected: the engine run ends `Test run with ... tests in ... suites passed after ... with 1 known issue` (task 1's rng that runs out on purpose) and skips nothing; `** TEST SUCCEEDED **`, so step 16's haptic change, if any, broke nothing; `pnpm test` ends with all test files passed and no failures (it runs the hygiene test over the new files: no em dash, no absolute path, no e-mail-shaped string); `pnpm typecheck` prints nothing; `git status --short` prints nothing. The Node tests of `ios/Tools/device` are not part of `pnpm test` (its `include` is `tests/**`), so run `node --test --test-reporter=spec 'ios/Tools/device/*.test.mjs'` once more: `ℹ pass 17`.

Plan B ends here. The owner's iPhone has the app, the checklist is complete, and the install is repeatable every seven days with `ios/Tools/device/install.sh`.
