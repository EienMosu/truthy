#!/usr/bin/env bash
# Captures every reviewed screen on the running emulator, day and night, at font scale 1.0 and 2.0.
# Writes android/Tools/visual-review/out/android/<font100|font200>-<day|night>-<screen>.{png,json}.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
project="$(cd "$here/../.." && pwd)/Truthy"
out="$here/out/android"
pkg=com.eienmosu.truthy
adb="${ANDROID_HOME:?set ANDROID_HOME to the Android SDK folder}/platform-tools/adb"

rm -rf "$out"
mkdir -p "$out"
(cd "$project" && ./gradlew -q :app:installDebug :app:installDebugAndroidTest)
runner="$("$adb" shell pm list instrumentation | tr -d '\r' | grep "(target=$pkg)" | sed -E 's/^instrumentation:([^ ]+) .*/\1/' | head -n 1)"
[ -n "$runner" ] || { echo "no instrumentation installed for $pkg" >&2; exit 1; }
"$adb" shell run-as "$pkg" rm -rf files/visual

for scale in 1.0 2.0; do
  "$adb" shell settings put system font_scale "$scale"
  for theme in day night; do
    log="$("$adb" shell am instrument -w -e capture 1 -e theme "$theme" -e class com.eienmosu.truthy.review.VisualCaptureTest "$runner" | tr -d '\r')"
    echo "$log" | tail -n 2
    echo "$log" | grep -q '^OK (1 test)' || { echo "the capture failed at font scale $scale, $theme" >&2; exit 1; }
  done
done
"$adb" shell settings put system font_scale 1.0

for file in $("$adb" shell run-as "$pkg" ls files/visual | tr -d '\r'); do
  "$adb" exec-out run-as "$pkg" cat "files/visual/$file" > "$out/$file"
done
echo "$(ls "$out" | wc -l | tr -d ' ') files in out/android"
