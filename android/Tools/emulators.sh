#!/usr/bin/env bash
# The four emulators of the Android review (spec 7.6): API 36, 34, 33 and 26, Pixel 8 size (412 by 915 dp).
#   android/Tools/emulators.sh create          installs the system images and creates the AVDs (once)
#   android/Tools/emulators.sh start <api>     boots one, waits for it and sets it up for tests (one at a time)
#   android/Tools/emulators.sh stop            shuts the running emulator down
set -euo pipefail
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK folder}"
sdkmanager="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
avdmanager="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"
emulator="$ANDROID_HOME/emulator/emulator"
adb="$ANDROID_HOME/platform-tools/adb"
apis=(36 34 33 26)
image() { echo "system-images;android-$1;google_apis;arm64-v8a"; }

case "${1:-}" in
  create)
    yes | "$sdkmanager" --licenses > /dev/null || true
    for api in "${apis[@]}"; do
      "$sdkmanager" "$(image "$api")" > /dev/null
      if ! "$emulator" -list-avds | grep -qx "truthy-api$api"; then
        echo no | "$avdmanager" create avd --name "truthy-api$api" --package "$(image "$api")" --device pixel_8 > /dev/null
      fi
      echo "truthy-api$api ready"
    done
    ;;
  start)
    api="${2:?which API: 36, 34, 33 or 26}"
    if "$adb" devices | grep -q '^emulator-'; then echo "an emulator is already running: stop it first" >&2; exit 1; fi
    "$emulator" -avd "truthy-api$api" -no-snapshot -no-boot-anim -no-audio > "${TMPDIR:-/tmp}/truthy-api$api.log" 2>&1 &
    "$adb" wait-for-device
    until [ "$("$adb" shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 2; done
    "$adb" shell input keyevent KEYCODE_WAKEUP
    "$adb" shell wm dismiss-keyguard > /dev/null 2>&1 || true
    "$adb" shell svc power stayon true
    "$adb" shell settings put system font_scale 1.0
    for scale in window_animation_scale transition_animation_scale animator_duration_scale; do
      "$adb" shell settings put global "$scale" 1
    done
    if [ "$api" -ge 29 ]; then
      "$adb" shell cmd overlay enable com.android.internal.systemui.navbar.gestural > /dev/null 2>&1 || true
      "$adb" shell cmd uimode night no > /dev/null
    fi
    echo "truthy-api$api booted, SDK $("$adb" shell getprop ro.build.version.sdk | tr -d '\r')"
    ;;
  stop)
    "$adb" emu kill > /dev/null 2>&1 || true
    while "$adb" devices | grep -q '^emulator-'; do sleep 1; done
    echo "stopped"
    ;;
  *)
    echo "usage: emulators.sh create | start <api> | stop" >&2
    exit 2
    ;;
esac
