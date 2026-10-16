# iOS visual review

The result of `ios/Tools/visual-review/review.mjs` (spec 7.4, success criterion 2) and the owner's decision on every difference outside the tolerances. The pairs and the full report are in `ios/Tools/visual-review/out/<runtime>/` (ignored by git); `approved.json` in the same folder as the script holds the approved keys.

## Runs

| Runtime | Commit | Frames | Colours | Theme checks | Outside tolerance | Approved |
|---|---|---|---|---|---|---|
| iOS 26.5 | 739d16a (2026-10-16) | 204 | 856 | 4 (all pass) | 23 | 0 |
| iOS 18.4 | 739d16a (2026-10-16) | 204 | 856 | 4 (all pass) | 15 | 0 |

The first runs (captured at 7fdd3cc) had 168 rows outside tolerance on each runtime. Step 51 item 2 sorted them as follows: every iOS frame or colour that differed from a correct web value was fixed in the task that owns the view, with a test, as a `fix:` commit, and the review ran again with a new build.

- The step 1 logo was a measurement fault of this task, not of task 12: the web measured the full-width `h1` and the app the mark with its wordmark. `web.mjs` now measures the union of the `h1`'s child boxes (b994664); the logo matches within 0.12 on the SE and 0.29 on the 15 Pro Max.
- Task 12 (start flow): the fill-in pass takes the web's grids, dashes, compact band and field paddings, the ready pass names the deck by its pass name ("AWS Cloud Practitioner"), sits 8 lower and rules its field grid, the destination cards carry the web's mono count line, progress track and stub chevron, and the top zone keeps 176 (5d786c7).
- Every type role draws the web's line height (873dd02): SwiftUI laid each line of Overpass out with the metrics of the rounded point size, up to 0.7 taller than the browser's.
- Task 13 (round): the ticket is the web's boarding pass (the band, the legs over an empty middle column, the ruled field grid, the statement centred in its 188 zone, the stub and the slip spread over the 228 lower part), and a stamped Timed stub scrolls the ticket to its end as the web does (b1d5abd). The 12 small-phone `timed-up` rows were this: the web scrolls the ticket to its end when time is up and iOS did not, so the "Time is up" stamp and its hint stayed under the See results row on the SE. They were not a height difference.
- Task 14 (leave sheet and result): the result's ticket is the boarding pass with the score block and the missed cards on its sunk lower part (b316aa1); the leave sheet's title takes the step-title role and the web's spacing (b316aa1) and its card sits 34 above the screen's foot on a phone with a home indicator (2f2692d); an opened Why scrolls into the list as the web does (739d16a).

## Differences

What remains after those fixes is sheet chrome under criterion 2 (README deviation 4: the system sheet, its inset frame on iOS 26 and its dimming) and one shadow colour that could not be settled. Each row is for the owner; none is decided yet.

1. Leave sheet frame on iOS 26.5: the inset system sheet is the paper card itself (x 8, 16 wider than the web's card, the system corner radius), so the sheet and its Keep playing pill sit 8 further out on each side. On iOS 18.4 the card now matches the web's frame.
2. Sheet dimming on both runtimes: the system's dimming over the sky is lighter than the web's `scrim` token, by up to 23 per channel by day and 7 at night on 26.5, and up to 42 by day and 18 at night on 18.4.
3. Ticket shadow on the SE at step 6: the sky probe at y 300 lies in the ready pass's shadow, 3 to 4 per channel darker than the browser's (task 10's shadow emulation). Not settled.

The key column is the runtime followed by the key `approved.json` takes. Colour rows give the expected token value in the Web column when the iOS side is out.

| Key | Web | iOS | What it is | Decision |
|---|---|---|---|---|
| iOS 26.5 small-day-p4:pill:Keep playing | [36, 501, 303, 60] | [27.15, 500.08, 320.71, 57.44] | frame, diff 17.71. The pill inside the inset sheet: 20 in from the sheet's edge at x 8 (the web's from its card at 16), so 17.7 wider and 8.9 further left. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 small-day-p4:sheet | [16, 380.13, 343, 252.88] | [8, 384.72, 359, 241.73] | frame, diff 16. The iOS 26 inset system sheet is the card (x 8, 16 wider than the web's card in the 16 gutter, the system corner radius); the card's content is the web's (title, text 8 under it, buttons 20 under that). Sheet chrome (criterion 2, README deviation 4), task 14. |  |
| iOS 26.5 small-night-p4:pill:Keep playing | [36, 501, 303, 60] | [27.15, 500.08, 320.71, 57.44] | frame, diff 17.71. The pill inside the inset sheet: 20 in from the sheet's edge at x 8 (the web's from its card at 16), so 17.7 wider and 8.9 further left. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 small-night-p4:sheet | [16, 380.13, 343, 252.88] | [8, 384.72, 359, 241.73] | frame, diff 16. The iOS 26 inset system sheet is the card (x 8, 16 wider than the web's card in the 16 gutter, the system corner radius); the card's content is the web's (title, text 8 under it, buttons 20 under that). Sheet chrome (criterion 2, README deviation 4), task 14. |  |
| iOS 26.5 large-day-p4:pill:Keep playing | [36, 766, 358, 60] | [27.26, 764.18, 375.49, 57.77] | frame, diff 17.49. The pill inside the inset sheet: 20 in from the sheet's edge at x 8 (the web's from its card at 16), so 17.7 wider and 8.9 further left. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 large-day-p4:sheet | [16, 645.13, 398, 252.88] | [8, 648, 414, 243.27] | frame, diff 16. The iOS 26 inset system sheet is the card (x 8, 16 wider than the web's card in the 16 gutter, the system corner radius); the card's content is the web's (title, text 8 under it, buttons 20 under that). Sheet chrome (criterion 2, README deviation 4), task 14. |  |
| iOS 26.5 large-night-p4:pill:Keep playing | [36, 766, 358, 60] | [27.26, 764.18, 375.49, 57.77] | frame, diff 17.49. The pill inside the inset sheet: 20 in from the sheet's edge at x 8 (the web's from its card at 16), so 17.7 wider and 8.9 further left. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 large-night-p4:sheet | [16, 645.13, 398, 252.88] | [8, 648, 414, 243.27] | frame, diff 16. The iOS 26 inset system sheet is the card (x 8, 16 wider than the web's card in the 16 gutter, the system corner radius); the card's content is the web's (title, text 8 under it, buttons 20 under that). Sheet chrome (criterion 2, README deviation 4), task 14. |  |
| iOS 26.5 small-day-s6:color:ios:sky-300 | #cde7f6 | #c9e3f2 | colour (sky, expected #cde7f6, web reads #cce6f5). On the small phone's step 6 the probe at y 300 lies in the ready pass's shadow (`elevation-ticket`, y 22, blur 36); the iOS shadow, emulated with SwiftUI's blur (task 10, `Shadows.swift`), is 3 to 4 per channel darker there than the browser's. Not settled: the emulation's blur radius would need its own measurement against the browser's. |  |
| iOS 26.5 small-day-p4:color:ios:sky-120 | #82a1b9 | #92b1c2 | colour (sky, expected #82a1b9). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 small-day-p4:color:ios:sky-300 | #91a8bb | #a4b9c5 | colour (sky, expected #91a8bb). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 small-day-p4:color:ios:sky-560 | #a4aeb6 | #babfbe | colour (sky, expected #a4aeb6). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 small-night-p4:color:ios:sky-120 | #060a12 | #070c17 | colour (sky, expected #060a12). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 small-night-p4:color:ios:sky-300 | #070c16 | #09101d | colour (sky, expected #070c16). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 small-night-p4:color:ios:sky-560 | #0a0e17 | #0d131e | colour (sky, expected #0a0e17). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 large-day-p4:color:ios:sky-120 | #7fa0b9 | #8fafc2 | colour (sky, expected #7fa0b9). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 large-day-p4:color:ios:sky-300 | #89a5bb | #9bb5c4 | colour (sky, expected #89a5bb). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 large-day-p4:color:ios:sky-560 | #9aadbd | #afbec6 | colour (sky, expected #9aadbd). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 large-day-p4:color:ios:sky-860 | #a8aeb3 | #bfc0ba | colour (sky, expected #a8aeb3). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 large-night-p4:color:ios:sky-120 | #050a12 | #060c17 | colour (sky, expected #050a12). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 large-night-p4:color:ios:sky-300 | #060b14 | #080e1a | colour (sky, expected #060b14). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 large-night-p4:color:ios:sky-560 | #080e18 | #0a121f | colour (sky, expected #080e18). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 26.5 large-night-p4:color:ios:sky-860 | #0b0f17 | #0e131e | colour (sky, expected #0b0f17). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 small-day-s6:color:ios:sky-300 | #cde7f6 | #c9e3f2 | colour (sky, expected #cde7f6, web reads #cce6f5). On the small phone's step 6 the probe at y 300 lies in the ready pass's shadow (`elevation-ticket`, y 22, blur 36); the iOS shadow, emulated with SwiftUI's blur (task 10, `Shadows.swift`), is 3 to 4 per channel darker there than the browser's. Not settled: the emulation's blur radius would need its own measurement against the browser's. |  |
| iOS 18.4 small-day-p4:color:ios:sky-120 | #82a1b9 | #a1c2d5 | colour (sky, expected #82a1b9). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 small-day-p4:color:ios:sky-300 | #91a8bb | #b4cbd8 | colour (sky, expected #91a8bb). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 small-day-p4:color:ios:sky-560 | #a4aeb6 | #cdd2d1 | colour (sky, expected #a4aeb6). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 small-night-p4:color:ios:sky-120 | #060a12 | #0a1120 | colour (sky, expected #060a12). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 small-night-p4:color:ios:sky-300 | #070c16 | #0d1527 | colour (sky, expected #070c16). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 small-night-p4:color:ios:sky-560 | #0a0e17 | #121a29 | colour (sky, expected #0a0e17). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 large-day-p4:color:ios:sky-120 | #7fa0b9 | #9ec1d5 | colour (sky, expected #7fa0b9). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 large-day-p4:color:ios:sky-300 | #89a5bb | #abc7d8 | colour (sky, expected #89a5bb). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 large-day-p4:color:ios:sky-560 | #9aadbd | #c1d1d9 | colour (sky, expected #9aadbd). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 large-day-p4:color:ios:sky-860 | #a8aeb3 | #d2d3cd | colour (sky, expected #a8aeb3). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 large-night-p4:color:ios:sky-120 | #050a12 | #08101f | colour (sky, expected #050a12). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 large-night-p4:color:ios:sky-300 | #060b14 | #0b1324 | colour (sky, expected #060b14). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 large-night-p4:color:ios:sky-560 | #080e18 | #0e192b | colour (sky, expected #080e18). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |
| iOS 18.4 large-night-p4:color:ios:sky-860 | #0b0f17 | #131a29 | colour (sky, expected #0b0f17). The system sheet's dimming over the sky is lighter than the web's `scrim` token. Sheet chrome (criterion 2), task 14. |  |

## Reviews

- Opus reviewer (step 52): not run. This run of task 15 may not dispatch a subagent; the step needs the controller or the owner to dispatch it. The material is ready: the pairs in `out/iOS-26-5/pairs` and `out/iOS-18-4/pairs`, the largest-text screenshots in `out/<runtime>/ios/*/*-largest/` and `report.md` of each runtime.
- Implementer's look, 2026-10-16: the pairs of every row listed above and of the screens the fixes touched (s3, s6, p2, p3, r1, streak-r1, lives-r1-why and timed-up on both phones), and every largest-text screenshot of both phones, both themes and both runtimes at 739d16a (80 per runtime). The pairs show the same layout on both sides apart from the sheet chrome above. At the largest text size no text is clipped outside a scroll view, no text overlaps, and no word breaks inside the word: the long words that broke before ("Cloud Practition / er" on a deck card, "Protecti / ng data at rest" under an open Why) now take the largest size at which they fit whole (873dd02, 8c3c352). The start column, the ticket and the result scroll where their content is taller than the screen.
- Owner: not run yet (step 53).
