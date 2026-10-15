# Android feel checklist

Spec 5.8, 7.5 and 7.6: every feel item, checked on the emulator its method needs and recorded with the API level, the emulator (or the phone), the build and the date. The tests named in an item are the classes of `android/Truthy/app/src/androidTest`; "green" means the last full run on that emulator (task 15, steps 21 and 22) reported it passing. Recordings and screenshots are kept in `$TMPDIR/truthy-feel/api<level>/`, never in the repository.

Each item ends with a `Result:` line. Replace `PENDING` with one of:

- `Result: PASS (API 36, truthy-api36, build 1a2b3c4, 2026-10-20, f1-api36.mp4)`: the API level, the emulator or the phone, the short commit hash of the build, the date, and the recording or screenshot when the item has one.
- `Result: FAIL (what was seen)`: then fix it in the task that owns the behaviour; the item stays FAIL until a later check passes.
- `Result: SKIP (why)`: only with a reason.

`node android/Tools/feel/checklist.mjs android/Tools/feel/FEEL-CHECKLIST.md --done` exits 0 when nothing is pending or failed.

Recording: `adb shell screenrecord --bit-rate 12000000 /sdcard/<name>.mp4` (stop with Ctrl+C, at most 180 seconds), then `adb pull /sdcard/<name>.mp4 "$TMPDIR/truthy-feel/api<level>/"`. A slow edge swipe with the finger held mid-way (API 30 and later, px on the 1080 by 2400 Pixel 8 screen): `adb shell input motionevent DOWN 3 1400`, then `adb shell input motionevent MOVE 150 1400` and `adb shell input motionevent MOVE 300 1400` with a pause between them, then `adb shell input motionevent UP 300 1400` to commit, or `adb shell input motionevent MOVE 3 1400` before `adb shell input motionevent UP 3 1400` to cancel.

#### F1. Predictive back scrubs the start flow, API 36
Do: on steps 2 to 6 and on the deck step of the Recent path, a slow edge swipe held at about a third and two thirds, then released; then the same swipe pulled back to the edge before release; record f1-api36.mp4.
Expect: feel item N1: the old step sinks and the new step's items come in from above with the finger; the cleared pass fields are dashes only after the release; a cancel springs back with every choice kept; BackTest green.
Result: PENDING (owner watches f1-api36.mp4 and f1-recent-api36.mp4; machine part on API 36, build 097ace1, 2026-10-15: a held and released edge swipe went back one step on steps 2 to 6 and on the Recent deck step, a swipe pulled back kept the step; BackTest green)

#### F2. Predictive back scrubs the start flow and the round, API 34
Do: F1 on truthy-api34, then the same swipe on a round with no answers (release), on a round with one answer (release), and a cancel on each; record f2-api34.mp4.
Expect: N1 on API 34; on the round the surface shrinks towards 0.94 with the finger, a release does what the X does (leaves, or opens the sheet), a cancel springs back; BackTest green on API 34.
Result: PENDING (owner watches f2-api34.mp4; machine part on API 34, build 097ace1, 2026-10-15: a held and released edge swipe went back one step on steps 2 to 6 and a pulled back swipe kept the step; on a round with no answers a cancel stayed and a release left to step 1; with one answer a cancel opened nothing and a release opened the sheet; BackTest green, step 22 summary tests 109, failures 0, errors 0, skipped 2)

#### F3. Back commits at once with the right final frame, API 33
Do: on truthy-api33, edge swipes on steps 2 to 6 and on a round with one answer; record f3-api33.mp4; step 22's summary for API 33.
Expect: no scrubbing; at the release the previous step appears at rest in one motion (or the sheet opens), the cleared fields are dashes, and no element is left half moved in the last frame; BackTest green on API 33.
Result: PENDING (owner steps through f3-api33.mp4; machine part on API 33, build 097ace1, 2026-10-15: the same swipes went back one step on steps 2 to 6, left a round with no answers and opened the sheet with one answer; BackTest green, step 22 summary tests 109, failures 0, errors 0, skipped 2)

#### F4. Back commits at once with the right final frame, API 26
Do: on truthy-api26 (three-button navigation), the Back button on steps 2 to 6 and on a round with one answer; record f4-api26.mp4; step 22's summary for API 26.
Expect: as F3; BackTest green on API 26.
Result: PENDING (owner steps through f4-api26.mp4; machine part on API 26, build 6d26078, 2026-10-15: the Back key went back one step on steps 2 to 6, opened the sheet on a round with a tapped answer and kept playing from the sheet; BackTest green, step 22 summary tests 109, failures 0, errors 0, skipped 3; before 6d26078 back on a round with a tapped answer was swallowed on API 26, see the task 15 report)

#### F5. Back on step 1 plays the system back-to-home animation, API 36
Do: on step 1, a back swipe held mid-way, then released; record f5-api36.mp4.
Expect: feel item N2: the system's back-to-home preview follows the finger and the app goes to the background; BackTest backOnStepOneGoesToTheSystem green.
Result: PENDING (owner watches f5-api36.mp4; machine part on API 36, build 097ace1, 2026-10-15: the swipe on step 1 sent the app to the background, the launcher was the resumed activity; BackTest backOnStepOneGoesToTheSystem green)

#### F6. Back on the round and on the result, API 36
Do: back on a round with no answers, on a round with answers, with the sheet open, and on the result once at once and once after a second; record f6-api36.mp4.
Expect: feel item N13: the surface shrinks and back acts like the X; with the sheet open back keeps playing; on the result back does nothing in the first second and then closes the results; BackTest green.
Result: PENDING (owner watches f6-api36.mp4 and f6-result-api36.mp4; machine part on API 36, build 097ace1, 2026-10-15: back with no answers left to step 1, with an answer opened the sheet, with the sheet open kept playing, on the result a back at once was ignored and a back after a second closed it; BackTest green)

#### F7. Vertical, horizontal and diagonal drags on the ticket, API 36
Do: at font scale 2.0, on a card whose statement makes the ticket scroll, drag vertically, horizontally and at about 45 degrees with `adb shell input swipe`; record f7-api36.mp4; task 13's drag tests green.
Expect: feel item N3 and Review Focus 5: vertical scrolls the ticket with stretch overscroll at its ends, horizontal moves the card, a diagonal does one or the other and never both.
Result: PENDING (owner watches f7-api36.mp4; machine part on API 36 at font scale 2.0, build 097ace1, 2026-10-15: two vertical drags and a 45 degree drag answered nothing, a horizontal drag answered; SwipeGestureTest green)

#### F8. The card follows the finger, API 36 and API 26
Do: FingerTest in step 22's summaries for API 36 and API 26.
Expect: feel item N4: the offset equals the finger's travel within 1 dp at 10 sampled frames on both.
Result: PASS (API 36 and API 26, truthy-api36 and truthy-api26, builds 097ace1 and 6d26078, 2026-10-15: FingerTest green in every full run on both)

#### F9. Release springs with the finger's velocity, and a touch catches a springing card, API 36
Do: in the emulator window, drag the card 60 dp and release fast, then slowly; then release and touch the card again while it springs back; record f9-api36.mp4. The owner watches the recording.
Expect: feel item N5: the card springs back from the release with the finger's speed, a committed swipe tears the stub and never throws the card, and a touch stops a springing card where it is, which then follows the finger from there.
Result: PENDING (owner: needs a real finger in the emulator window; f9-api36.mp4 shows the same gestures injected with adb input motionevent)

#### F10. One haptic per crossing of the commit line, phone
Do: task 13's unit test of the trigger count green; on an Android phone, if the owner provides one, drag across the 90 line and back several times, answer right and wrong, and let a Timed minute run out.
Expect: feel item N6: one light tick per crossing and none while moving, a confirm on Correct, a reject on Not quite and at time up. Emulators do not vibrate: without a phone the result is SKIP with that reason.
Result: SKIP (no Android phone; emulators do not vibrate)

#### F11. The leave sheet keeps playing, API 36 and API 26
Do: LeaveSheetTest in step 22's summaries for API 36 and API 26; on API 36 record a swipe down, a scrim tap, back, and a Timed round with the sheet open (f11-api36.mp4).
Expect: feel item N7: every way out but Leave round keeps playing, the Timed clock keeps counting under the sheet, a double tap on the X leaves the sheet open, and the sheet shows the web's paper card on a transparent container with no drag handle. The Result line also says whether step 18 needed the sheet's scrim guard (spec 5.4).
Result: PASS (API 36 and API 26, truthy-api36 and truthy-api26, builds 097ace1 and 6d26078, 2026-10-15, f11-api36.mp4: LeaveSheetTest green on both, swipe down, scrim tap and back kept playing, the Timed clock ran on under the sheet, the paper card sits on a transparent container with no drag handle; the scrim guard was not needed: aDoubleTapOnTheXLeavesTheSheetOpen passed as written, the X's own 250 ms rule holds the second tap)

#### F12. No highlight, no selection menu, no focus ring after a tap, API 36
Do: FingerTest green; screenshots while a destination card, a pill and the X are held down and right after a tap (`adb exec-out screencap -p > "$TMPDIR/truthy-feel/api36/f12-held.png"` with the press held by `adb shell input motionevent DOWN`).
Expect: feel item N8: held controls scale as the web's press does with no ripple, except the bounded press tint on the pass fields and the Continue line; no selection or menu after a long press; no focus ring after a tap; after `adb shell input keyevent TAB` the focused control shows a 2 dp ink ring (task 10's `keyboardFocusRing`), and after a tap it does not.
Result: PASS (API 36, truthy-api36, build 097ace1, 2026-10-15, f12-held-card.png f12-held-true.png f12-held-x.png f12-held-passfield.png f12-after-tap.png f12-after-tab.png: no ripple on the held destination card, pill and X, the bounded tint on the held pass field, no ring after a tap, a 2 dp ink ring on the source link after TAB; FingerTest green)

#### F13. Nothing clips at font scale 2.0, API 36 and API 26
Do: NoClipTest green at font scale 2.0 on both (steps 19 and 22); look at every font200 capture of the visual review (`android/Tools/visual-review/out/android/font200-*.png`).
Expect: feel item N9 and Review Focus 4: no text cut, ellipsized or overlapping; lists and the ticket scroll; the leave sheet's card grows and scrolls when it does not fit.
Result: FAIL (NoClipTest green at font scale 2.0 on API 36, 34, 33 and 26, but the font200 captures show text that runs together or overlaps: on the results Missed cards and N to review touch as Missed cardsreview with to on the line above; on s1-returning the Continue line is drawn over the faded list, Leader over DevOps; on s5 the Best column breaks not played as playe and d; owner to judge against the web at 200 percent)

#### F14. No white or mismatched frame at launch or between screens, API 36 and API 26
Do: record a cold start (`adb shell am force-stop com.eienmosu.truthy`, then `adb shell am start -n com.eienmosu.truthy/.MainActivity`) in day and in night, a round start and a leave, on both emulators (f14-api36.mp4, f14-api26.mp4); step through the recordings frame by frame.
Expect: feel item N10: the splash in the surface colour, then the app's first frame already in its theme; no white frame, no frame in the other theme, no blank frame between the start flow and the round.
Result: PENDING (owner steps through f14-api36.mp4 and f14-api26.mp4 frame by frame: cold starts in day and night (stored dark on API 26), a round start and a leave)

#### F15. Source links open in the in-app browser, API 36
Do: SourceLinkTest green; tap a slip's source link on the emulator; record f15-api36.mp4.
Expect: feel item N11: a Custom Tab opens over the app with its toolbar in the app's theme colours, and its back returns to the round. If the image has no browser that supports Custom Tabs, the system browser opens: record which.
Result: PASS (API 36, truthy-api36, build 097ace1, 2026-10-15, f15-api36.mp4: Chrome's CustomTabActivity opened in the app's task with a light toolbar on the day theme, back returned to the round; Chrome's first run screens appear once on a fresh image; SourceLinkTest green)

#### F16. Bars and splash follow the stored theme, API 36
Do: ThemeTest green; with the system dark and the stored theme light, then the opposite, a screenshot of step 1 and of a round, and a recorded cold start (f16-api36.mp4).
Expect: feel item N12 and Review Focus 3: the status and navigation bar icons are dark on the day theme and light on the night theme whatever the system says, the first frame is in the stored theme, and the splash (Android 12 and later) is in the stored theme too.
Result: PENDING (owner watches the splash in f16-api36.mp4; machine part on API 36, build 097ace1, 2026-10-15: ThemeTest green, f16-sysdark-light-step1.png and -round.png draw day with dark bar icons under the system dark theme, f16-sysday-dark-step1.png and -round.png draw night with light bar icons under the system light theme)

#### F17. Bars follow the stored theme and the splash follows the system, API 26
Do: ThemeTest in step 22's summary for API 26; with the stored theme dark, a screenshot of step 1 and a recorded cold start (f17-api26.mp4).
Expect: the app draws night with light status bar icons; the splash is the system's day surface colour (below Android 12 the splash follows the system), followed by the night app with no white frame.
Result: PENDING (owner watches the splash in f17-api26.mp4; machine part on API 26, build 6d26078, 2026-10-15: ThemeTest green with the system dark test skipped, f17-stored-dark-step1.png draws night with light status bar icons)

#### F18. Reduced animations keep the web's fades, API 36
Do: set the three animation scales to 0 (`adb shell settings put global animator_duration_scale 0` and the window and transition scales); record answering a card, opening and closing the leave sheet, and a step forward and back (f18-api36.mp4); set the scales back to 1.
Expect: Review Focus 4 and reference 5.8: the slip fades in over about 140 ms, the sheet card fades in 140 ms over a 360 ms scrim, the step panel fades out and in; stamps, tear, jolt and name travel show at rest at once; the 250, 420 and 1000 ms guards are unchanged.
Result: PENDING (owner watches f18-api36.mp4 (answer, sheet open and closed) and f18-steps-api36.mp4 (a step forward and Escape back) recorded with the three animation scales at 0)

#### F19. The app killed in the middle of a round, API 36
Do: answer two cards of a Classic round, press Home, run `adb shell am kill com.eienmosu.truthy`, launch the app; then again with "Don't keep activities" on (`adb shell settings put global always_finish_activities 1`, and back to 0 afterwards).
Expect: Review Focus 2: the app opens at start step 1 with no choices, the Continue line offers the route without a score (the journal was applied as an abandoned round), and a second launch applies nothing again.
Result: PASS (API 36, truthy-api36, build 097ace1, 2026-10-15: after two answers, Home and am kill, and again with always_finish_activities 1, the app opened at step 1 with Continue: AWS Cloud Practitioner, Security and compliance, Classic. and no score, the journal file was gone, the progress held the two cards with last score null, and a second launch left the progress byte for byte the same)

#### F20. The Timed clock pauses only in the background, API 36
Do: in a Timed round, pull the notification shade down for 5 seconds, then press Home for 10 seconds and come back; ModesTest green.
Expect: spec 5.6: the shade does not pause the clock; Home pauses it (the seconds left are the same on return), and it runs again at once.
Result: PASS (API 36, truthy-api36, build 097ace1, 2026-10-15: with the shade down 8 s the clock went 56 to 48; Home for 10 s cost only the 4 s of the reads around it, 48 to 43 over 14 s; it ran on at once after; ModesTest green)

#### F21. Overscroll follows the platform, API 36 and API 26
Do: drag past both ends of a long step list, of the ticket and of the result column on both emulators; record f21-api36.mp4 and f21-api26.mp4.
Expect: spec 5.6: stretch overscroll on API 36; on API 26 the edge glow in the ink colour (task 8's `TruthyTheme` provides it through `LocalOverscrollFactory`).
Result: PENDING (owner watches f21-api36.mp4 for stretch and f21-api26.mp4 for the ink glow: a step list, the ticket at font scale 2.0 and the result column dragged past both ends)

#### F22. A drag from the system gesture inset belongs to the system, API 36
Do: task 13's edge-drag test green; on a round with one answer, a drag that starts inside the left gesture inset and moves right (`adb shell input motionevent` from x 3); record f22-api36.mp4.
Expect: Review Focus 5 and spec 5.3: the system's back takes the drag (the round surface shrinks, the release opens the sheet), and the card never moves.
Result: PASS (API 36, truthy-api36, build 097ace1, 2026-10-15, f22-api36.mp4: a drag from x 3 to 600 on card 2 with one answer opened the leave sheet, Keep playing showed card 2 unanswered; SwipeGestureTest green)

#### F23. TalkBack reads the start flow, the round and the result, API 36
Do: `emulators.sh` starts the emulator with `-no-audio`, so run `android/Tools/emulators.sh stop` and start the API 36 emulator with its sound and window: `"$ANDROID_HOME/emulator/emulator" -avd truthy-api36 -no-snapshot &`; turn TalkBack on (`adb shell settings put secure enabled_accessibility_services com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService` and `adb shell settings put secure accessibility_enabled 1`); swipe through step 1 and take the Classic path with double taps; on the round swipe through the header, answer one card with the True pill, open the leave sheet, close it, and play to the result; then a Timed round with one answer; record f23-api36.mp4 for the focus order (`screenrecord` records no sound: the owner listens live and the Result line names what was heard wrong, if anything); turn TalkBack off afterwards (`adb shell settings delete secure enabled_accessibility_services` and `adb shell settings put secure accessibility_enabled 0`), stop that emulator by its PID and run `android/Tools/emulators.sh start 36` again. The owner listens and gives the result.
Expect: spec 7.6 and risk 11 (reference 4.5 and 5.9): the round's heading is read as "{deck}, {section}: {class} round" and the Classic header once as one image with its full sentence, "Card N of M." and then which cards were correct and wrong (for example "Card 4 of 10. Cards 1 and 2 correct, card 3 wrong."; RoundScreenTest and FlightPathGoldenTest assert these labels); an answer is read once as "Correct. The answer is True." (or "Not quite. The answer is ..."), politely, after what TalkBack was reading, and not cut off by the sheet; nothing stale is read after the sheet closes; in Timed each new card is read as "Card N. {statement}"; the X reads "Leave round", a source link "{title} (opens in browser)"; no hidden node is read twice and focus never lands on an invisible element.
Result: PENDING (owner: TalkBack needs the emulator with sound and a person listening live; not run)
