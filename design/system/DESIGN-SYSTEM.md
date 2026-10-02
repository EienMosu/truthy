# Truthy design system: Boarding Pass

The specification for building Truthy on the web, then in SwiftUI and Jetpack Compose, without going back to the mockups. Every value below was read from the CSS of the approved screens in `design/flow/screens`. The reference is `game-classic.html`. Machine-readable values are in `tokens.json` (DTCG 2025.10). Where two screens disagree, the reference wins and the disagreement is listed at the end.

Approved screens: `game-classic` (reference), `browse-c` (start flow "Filling in the pass", first version), `mode-select`, `game-streak`, `game-lives`, `game-timed`, `result-classic`, `result-timed`, `game-classic-night`, `result-classic-night`.

Final-pass screens (built from the approved ones, same tokens): `start` and `start-night` (the whole start flow: area, platform, deck, section, class, ready, first card, plus the continue line), `game-timed-up`, `game-streak-record`, `game-lives-out`, `result-streak`, `result-lives`.

**Which start flow to build:** `start.html`. It is browse-c carried through to the first card: the section and the class are chosen as steps on the same pass instead of in a sheet and on a separate mode screen. The sheet (5.16) and the option rows (5.13) stay documented because approved screens show them, but the start flow does not use them.

---

## 1. Principles

1. **One decision per screen.** Each start-flow step asks one question ("Choose an area") and shows only its own large cards (two to five). Stats, filters and secondary paths wait for later screens.
2. **The card is a boarding pass.** A deck and a section are three-letter codes on the legs, a round is a route (`CLF → SEC`), the mode is the class, progress is a flight path, answering tears off the stub and the verdict is a stamp. The metaphor explains state. Plain words win on controls ("Back", "Next card", "Play again").
3. **Calm and few.** Sky, paper, ink and one amber. Rules are 1.5px, there is plenty of space, and nothing is tilted except a stamp. No textures, thick outlines, loud colour blocks or giant decorative type.
4. **What the client rejected.** Home screens that showed everything at once: the departures list with filter chips (home-a), the wallet stack (home-b) and the itinerary with nested lists (home-c), as too complicated. They also passed over the morphing-header and horizontal-push start flows (browse-a, browse-b). Filter chips existed only in those rejected screens: do not build them.
5. **Motion explains, it does not decorate.** Every movement shows where something went (a name into its field, a stub off the ticket). There is one celebratory moment, the stamp.
6. **Night is a remap, not a redesign.** The same components and geometry, with token values swapped. The approved night theme keeps a dark pass (the lit cream pass was rejected because it glares). The theme follows the system setting until the player chooses one with the theme switch (5.5); the choice is kept on the device.

---

## 2. Colour

### 2.1 Semantic roles

Implement against these roles only. Primitives exist so tooling can alias them.

| Role | Day | Night | Used for |
|---|---|---|---|
| `sky-1` | `#a9d6f0` | `#0b1528` | Sky band 0 to 22% of screen height |
| `sky-2` | `#c4e3f5` | `#101c33` | Sky band 22 to 48% |
| `sky-3` | `#ddeff8` | `#15233d` | Sky band 48 to 76% |
| `sky-4` | `#f3f0e6` | `#1c2538` | Sky band 76 to 100% |
| `surface` | = sky-2 | = sky-2 | Page background behind the sky |
| `surface-raised` | `#fdfbf5` | `#252f41` | Ticket paper, round buttons, cards, fill-in pass, sheet |
| `surface-sunk` | `#eef3f5` | `#1d2636` | Answer slip, missed-cards slip, selected option, pressed row, unavailable card, sheet close |
| `ink` | `#10233f` | `#e6e3da` | Text, icons, primary pill fill, focus ring |
| `ink-muted` | `#56667c` | `#9ba4b3` | Secondary text, field labels, radio ring |
| `rule` | `#c9d3dc` | `#3c4759` | 1.5px dividers, perforations, blank dashes, grab bar (decorative only) |
| `accent` | `#f5b400` | `#e0a52c` | Carrier band, plane, progress dot, logo mark, focus ring on filled pills |
| `on-accent` | = ink | `#141c2b` | Text and glyphs on amber (band, plane arrow) |
| `true` | `#1d5cc0` | `#6f9ae0` | True pill, True hint and intent stamp, links (source, Why) |
| `false` | `#b3321c` | `#e2836f` | False pill, False hint and intent stamp |
| `correct` | `#0d7250` | `#55b88e` | Correct stamp, correct waypoint, New best stamp |
| `wrong` | `#b3321c` | `#e2836f` | Not quite stamp, wrong waypoint (same value as `false`) |
| `on-dark` | `#fdfbf5` | `#0f1a2c` | Labels on True, False and ink pills |
| `cloud` | `#ffffff` | `#2c3a55` | Cloud shapes, drawn at opacity 0.7 |
| `scrim` | `rgba(16,35,63,.32)` | none | Behind the bottom sheet (browse-c, day only) |
| `press` | `rgba(16,35,63,.05)` | `rgba(230,227,218,.06)` | Pressed tint on fill-in pass fields and the continue line |
| `surface-sunk-clear` | `rgba(238,243,245,0)` | `rgba(29,38,54,0)` | Top of the 28px fade at the bottom of the missed-cards list |

Notes:
- `on-accent` and the night shadow tokens were added by the night screens. In day they equal `ink` and the reference's hard-coded shadow literals, so adopting them changes nothing visually.
- In night, `ink` is light, so the primary pill becomes a light warm pill with dark `on-dark` text. That is intended.
- No night mockup shows the sheet, but the app's "Leave round?" confirmation is one. Its night values were decided at implementation: `scrim` is black at 60% and the sheet shadow is the night ticket shadow pointing up.

### 2.2 Contrast pairs checked (WCAG 2.x ratio)

| Pair | Day | Night | Where |
|---|---|---|---|
| ink / surface-raised | 15.21 | 10.48 | All ticket text |
| ink / surface-sunk | 14.07 | 11.83 | Slip text |
| ink-muted / surface-raised | 5.66 | 5.35 | Field labels, leg names |
| ink-muted / surface-sunk | 5.23 | 6.04 | Missed-card heads, unavailable card |
| true / surface-raised | 6.07 | 4.72 | True hint, intent stamp |
| true / surface-sunk | 5.61 | 5.33 | Source link, Why link |
| false / surface-raised | 5.99 | 4.94 | False hint, intent stamp |
| correct / surface-sunk | 5.30 | 6.24 | Correct stamp on slip |
| correct / surface-raised | 5.73 | 5.53 | New best stamp, Timed stamp on stub |
| wrong / surface-sunk | 5.54 | 5.58 | Not quite stamp |
| on-dark / true | 6.07 | 6.12 | True pill label |
| on-dark / false | 5.99 | 6.40 | False pill label |
| on-dark / ink | 15.21 | 13.59 | Next card, Play again, Start round |
| on-accent / accent | 8.55 | 7.79 | Carrier band |
| ink / sky-1 | 10.17 | 14.20 | Route labels, titles on the sky |
| **ink-muted / sky-1** | **3.78 (fails)** | 7.25 | Start-flow tagline, see Accessibility |
| ink-muted / sky-2 | 4.36 (fails for small text) | 6.76 | Same tagline where it crosses into sky-2 |
| **accent ring / sky-3, sky-4** | **1.56, 1.61 (fails 3:1)** | 7.16, 6.99 | Focus ring on filled pills, see Accessibility |
| ink-muted / sky-3 | 4.96 | 6.24 | "Your pass is ready" line (start step 6) |
| ink-muted / sky-4 | 5.13 | 6.09 | Continue line route (start step 1) |
| ink / surface-raised (stub stamp) | 15.21 | 10.48 | "Time is up" stamp |
| rule / surface-raised | 1.47 | 1.43 | Decorative only, never the only signal |

Brightness order in night is deliberate: amber (luminance 0.44) stays brighter than correct (0.38), false (0.34) and true (0.32).

---

## 3. Typography

### 3.1 Families and licence

| Family | Use | Static weights to bundle |
|---|---|---|
| **Overpass** | All text except codes and small data | SemiBold 600, ExtraBold 800 |
| **Overpass Mono** | Codes, field labels, small data, inline links, score | Regular 400, SemiBold 600 |

- Both are distributed under the **SIL Open Font License 1.1** on Google Fonts. The upstream Red Hat / Delve Fonts release has also been offered under LGPL 2.1. Ship the OFL text with the app. Before release, check the LICENSE file of the exact files you bundle and any Reserved Font Name clause. The OFL allows bundling, embedding and subsetting. It forbids selling the fonts on their own. If you modify the fonts, rename the family.
- Bundle the **four static files** on iOS (`UIAppFonts` in Info.plist) and Android (`res/font`). Web loads the same four weights from Google Fonts: `Overpass:wght@600;800` and `Overpass+Mono:wght@400;600`. Nothing depends on a variable axis.
- **Weight trap.** Some web rules set no weight (`.explain`, `.mc-exp p`), so they compute to 400. Overpass 400 is not loaded, so the browser renders SemiBold 600. Natives must ask for **600** explicitly, or they will fall back to a system Regular.
- Fallbacks: `system-ui, sans-serif` and `ui-monospace, monospace`.

### 3.2 Role scale

Sizes are px on web, pt on iOS and sp on Android. Letter spacing is in em (`tokens.json` also gives px = size × em). "normal" line height measures about 1.27 for these fonts in Chrome. The only uppercase text is the carrier band label.

| Role | Family / weight | Size | Line height | Tracking | Source and notes |
|---|---|---|---|---|---|
| `logo` | Sans 800 | 36 | 1 | -0.025em | browse-c `.logo b` |
| `screen-title` | Sans 800 | 24 | 1.1 | -0.015em | mode-select `.top h1` |
| `step-title` | Sans 800 | 22 | normal (36px row) | -0.015em | browse-c `.st-h` |
| `tagline` | Sans 600 | 17 | 1.4 | 0 | browse-c `.tag`, ink-muted. Also the "Your pass is ready" line (start `.ready-t`, max-width 320) |
| **`card-statement`** | Sans 600 | 25 | 1.28 | -0.012em | reference `.statement` |
| `card-name` | Sans 800 | 26 | 1.2 | -0.015em | browse-c `.nm` |
| `answer-value` | Sans 800 | 26 | normal | -0.01em | reference `.res .ans b` |
| `answer-label` | Sans 600 | 13 | 1.2 | 0 | reference `.res .ans`, ink-muted |
| `stamp` | Sans 800 | 24 | normal | -0.01em | reference; also New best on the slip. Variants: 28 (stub stamp: Timed verdict, Time is up), 22 (New best on results) |
| **`button`** | Sans 800 | 20 | normal | -0.01em | 60px pills |
| `button-quiet` | Sans 800 | 16 | normal | -0.01em | result `.quiet` |
| `button-back` | Sans 800 | 15 | normal | -0.01em | browse-c `.back` |
| `carrier-title` | Sans 800 | 16 (compact 14) | normal | -0.01em | "Truthy" on the band |
| `carrier-label` | Mono 600 | 12 (compact 11) | normal | 0.06em | "BOARDING PASS", "YOUR PASS" |
| **`leg-code`** | Mono 600 | 34 | 1 | 0.02em | `CLF`, `SEC` |
| `leg-name` | Sans 600 | 12 | 1.25 | 0 | two lines, ink-muted |
| **`field-label`** | Mono 400 | 10.5 | normal | 0.04em | ink-muted (ink 600 for the field being chosen) |
| **`field-value`** | Mono 600 | 15 | normal | 0 | ticket field grid |
| `field-value-pass` | Sans 800 | 16 | 1.2 | -0.01em | fill-in pass. Deck and section codes there: Mono 600 16, 0.02em ("Whole deck" stays Sans) |
| `pass-line` | Sans 600 | 13 | 22px row | 0 | start `.lv`: "Cloud · AWS" on the route pass, ink-muted; the dot is `rule` |
| **`body`** | Sans 600 | 15.5 | 1.45 | 0 | explanation |
| `body-small` | Sans 600 | 14 | 1.38 | 0 | option description, ink-muted |
| `list-title` | Sans 600 (800 for Whole deck) | 16 | 1.2 | -0.01em | section rows. Deck name on a card: 16 / 1.25 |
| `list-statement` | Sans 600 | 16 | 1.38 | -0.005em | missed card statement |
| `option-title` | Sans 800 | 18 | 1.2 | -0.01em | class name |
| `emphasis` | Sans 800 | 16 | normal (1.2 on the continue line) | -0.01em | "2 short of your best", "Equals your best", "Continue where you left off". Missed-card answer word is 17 |
| `deck-code` | Mono 600 | 30 | 1.2 | 0.02em | deck card |
| `section-code` | Mono 600 | 18 | normal | 0.02em | sheet rows |
| `score` | Mono 600 | 48 | 1 | 0.02em | unit "of 10": Mono 600 20, ink-muted, tracking 0 |
| `intent-stamp` | Mono 600 | 26 | normal | 0.02em | drag preview |
| **`mono-data`** | Mono 400 | 12 | normal | 0 | stub row, counts, subtitles, list header |
| `mono-data-strong` | Mono 600 | 13 | normal | 0 | swipe hint, Why, stub card number, best values |
| `mono-caption` | Mono 400 | 11 | normal | 0.04em | missed-card head |
| `route-label` | Mono 400 (numbers 600) | 11 | normal | 0 | under the flight path. Timed clock: Mono 600 13, tabular |
| `sheet-title` | Mono 600 | 12 | normal | 0.04em | "New boarding pass", ink |

Inline link (source): Mono 600 13.5, colour `true`, underline 1.5px thick with a 3px offset.

---

## 4. Layout

- **Design viewport** 390 × 844. `#app` is a column with padding **52 top, 16 sides, 34 bottom** (`max-width` 390). The page never scrolls. Only a list inside a screen scrolls, and it hides its scrollbar (one exception: the start flow on a screen under 568 tall scrolls as one column, see below). While more of a start-flow list lies below what it shows, its bottom edge fades out over 28 (the length of the missed-cards fade, as a mask, so it works on any sky and in both themes). Where the fold falls in the gap between two cards or shows only a sliver of the next, the fade ends higher, on the card above, so it always dissolves a card; scrolled to its end, or when everything fits, the edge is plain.
- **Safe zones.** The contract keeps the top 50px and the bottom 30px free of interactive content. The 52/34 padding stands in for the status bar and the home indicator. Natively, use the system safe-area insets and keep at least the same visual distance (see Open questions).
- **Game, result and mode screens:** header row 56 → stage (flex, `margin-top` 12) → actions row 64 (`margin-top` 12). The ticket content inset is **20**. Measured on the reference: header at y 52, ticket at y 120 to 728 (carrier 44, legs 96, field grid 52, statement 188, stub 228), actions at y 746 to 810.
- **Start flow (start.html):** three stacked zones, each holding one state at a time in the same place.
  - **Top zone, 176:** the theme switch (5.5) sits at its top right on steps 1 to 6. Step 1 shows the logo (36 top padding, logo, 14 gap, tagline with `max-width` 300). Steps 2 to 6 show the Back pill, a 12 gap and the fill-in pass (aligned to the top; from step 6 the pass is full size and overflows the zone, with an 8 top margin). Step 7 replaces the Back pill with the 56 flight-path header and the pass becomes the first card, at the same y as a game ticket (120).
  - **Main area:** `margin-top` 20, the step title row 36, then the scrolling card list. The list's margin (8 −8 0) and padding (6 8 24) leave room for the focus ring. Step 6 has 112 of top padding so its title clears the full pass; on a screen under 600 tall it has 88 (the title then sits about 7 under the pass), so a three-line rule ends above Start round at 320 × 568. On step 1, when the continue line shows, the list stops 76 above the bottom.
  - **Foot zone:** absolute, 16 from each side, 38 from the bottom, 60 tall (the same place as a game's action row). It holds the continue line (step 1, returning players), "Start round →" (step 6) or the True/False pair (step 7). Steps 2 to 5 leave it empty. It lies over the bottom of the list, so only what it holds takes a tap: where it is empty, a tap reaches the card under it.
  - **Short screens** (under 568 tall: a phone held sideways, a page zoomed to 200% and more): the three zones no longer fit, so the start screen scrolls as one column, the page padding scrolling with it. The top zone is as tall as what it holds (the full pass from step 6, so step 6 needs no top padding), the list takes its own height, and the foot zone follows the list (4 above the bottom padding) and takes no room while it is empty. A step that arrives starts at the top of the column; when that moves the column, the Back pill and the pass fields ignore presses for the settle time (250), since they now lie where the finger just was. Going back, the card chosen before is scrolled into view with its focus ring. Start round scrolls the column back to its top, so the pass unrolls in view. Every control then comes on screen by scrolling. The orientation is not locked.
- **4/8 grid.** Structure sits on 4: gutters 16 and 20, gaps 12, heights 44 / 48 / 56 / 60 / 64 / 104 / 108 / 128 / 176 (the section card's 90 is the one exception). Text cells use small optical values (7, 9, 11, 14, 18, 22) to put text on its baseline. Keep these exactly; do not round them to the grid. The spacing steps actually used are 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24.
- **Touch targets:** at least **48 × 48** everywhere. Round buttons 48, pills 60, quiet and Back pills 48, sheet rows ≥ 56, area cards ≥ 104, deck cards ≥ 128, section cards ≥ 90, class cards ≥ 108, continue line 60. Filled pass fields are as tall as their cell (56); the area and platform words on the route pass are 22 tall with their hit area extended 13 above and below (48), and to the right to at least 48 wide; it lies above the fields, so a tap just under a word is the word's, and under the words the Deck, Section and Class fields keep 43 of their 56 (the pass line is not made taller). The Why link and the source link are 48 tall (the Why link adds 8px side padding with a −8 right margin). The swipe hint row (32) is not interactive.
- **Sky backdrop.** The bands are hard-stop percentages of the screen height. Clouds are placed in px (see Components).

---

## 5. Components

Each entry gives purpose, anatomy (sizes in px), variants, states and the screens that use it.

### 5.1 Sky backdrop
- **Purpose:** the calm ground of every screen; it says "travel" without saying anything.
- **Anatomy:** a smooth vertical gradient across the whole viewport: `sky-1` at 0%, `sky-2` at 35%, `sky-3` at 62%, `sky-4` at 100% (the first build used hard stops at 22, 48 and 76%; on a real screen the bands cut through text and cards and read as a fault, so they were blended). Inside the app frame sit two cloud shapes (one path, viewBox 150 × 46) filled `cloud` at opacity 0.7, ignoring touches. Cloud 1: 150 × 46 at left −30, top 196. Cloud 2: 170 × 50 at right −40, top 620 (game, mode, result) or top 660 (browse-c, start).
- **Variants:** day, night.
- **Used by:** all screens.

### 5.2 Boarding pass (ticket)
- **Purpose:** carries the round: route, class, progress, statement, and the answer under the stub.
- **Anatomy, top to bottom** (full width of the stage, radius 16):
  1. **Shadow box:** a plain rounded rectangle (r16) behind the whole ticket with `elevation.ticket`. The shadow does **not** follow the notches.
  2. **Main part:** top corners r16, bottom corners square, paper `surface-raised`, with notches cut at the bottom edge.
  3. **Carrier band:** 44 tall, padding 0 16, gap 10, fill `accent`, text `on-accent`. It holds the cloud glyph (22 × 16), "Truthy" (`carrier-title`) and, pushed right, the uppercase label "BOARDING PASS" (`carrier-label`).
  4. **Legs:** a three-column grid (1fr, auto, 1fr), bottom-aligned, gap 8, padding 14 20 12. From: `leg-code` plus `leg-name` (margin-top 6). A fly arrow (40 × 16, stroke 2, `padding-bottom` 26) sits between. To: right-aligned.
  5. **Field grid** (`meta`): three columns (1.1fr 1fr 1fr), margin 0 20, 1.5px `rule` lines above and below. Cells have padding 8 0 7. From the second cell on, cells have `padding-left` 12 and a 1.5px `rule` divider on the left. Each cell is `field-label` over `field-value` (margin-top 2). Content per screen: Class / Card / Gate (game; Gate reads "Closed" in ink-muted when the time is up), Class / Cards / Gate (mode, start step 6), Class / Cards / Missed (result Classic, Streak), Class / Correct / Missed (result Three lives), Class / Time / Answered (result Timed).
  6. **Statement** (game), **score block** (results) or nothing (mode-select).
  7. **Perforation:** a 2px dashed line at the bottom edge of the main part, inset 18 (notch 12 + 6) from each side, dashes 7 on and 5 off, colour `rule`.
  8. **Notches:** half-circles of radius **12** cut into the left and right edges, centred on the perforation line. They appear on both the main part (bottom) and the lower part (top).
  9. **Lower part** (stub, slip or list): top corners square with notches, bottom corners r16.
- **Variants:** game (statement + stub over slip), time up (the stub stays on, statement in ink-muted, see 5.11), mode-select (stub holds the class list), start ready and boarding (5.4), result (score block, then the missed-cards slip), night (token remap; the glyph and plane use `on-accent`).
- **Used by:** game-*, mode-select, result-*, start (steps 6 and 7).

#### Stub (game)
- 228 tall, paper `surface-raised`, padding 22 20 14, laid out as a column with space between:
  - **Row:** `mono-data` in ink-muted ("CLF → SEC · Classic"), with "Card 04" on the right in Mono 600 13, ink.
  - **Barcode:** 76 tall, full width, `ink`, generated from the round data (see Portability).
  - **Hint row:** at least 32 tall, `mono-data-strong`. "← False" in `false` on the left, "swipe to board" in Mono 400 ink-muted in the middle, "True →" in `true` on the right.
- While dragging, the stub drops `|intent| × 7px` and rotates `intent × 2deg` around (20%, 0).
- In mode-select the stub holds the option rows instead (padding 16 8 8; header row "Class / Your best").
- **Time up:** the hint row is replaced by one centred line in Mono 400 13 ink-muted: "This card doesn't count · 17 answered". The stub does not tear; the Time is up stamp lands on the barcode.

#### Answer slip (game)
- Sits under the stub at the same size. Paper `surface-sunk` with the same notches, padding 18 20 12.
- **Result row** (at least 60 tall, gap 12): `answer-label` "The answer is" over `answer-value` "False", and the stamp on the right.
- **Explanation:** `body`, margin-top 10.
- **Source link:** pushed to the bottom, at least 48 tall, gap 8. Book icon 18, then the underlined label, then "→". Style: Mono 600 13.5 in `true`.
- Announced politely to screen readers (`aria-live="polite"`).
- **Used by:** game-classic, game-streak, game-lives, game-streak-record, game-lives-out, game-classic-night. Timed has no slip; its stamp lands on the stub.

### 5.3 Destination card (start flow)
- **Purpose:** one large, calm choice per row: an area, a platform or a deck.
- **Anatomy:** a two-column grid (main, then the stub, 64 wide) with radius 16. Paper `surface-raised` and `elevation.small`. Notches of radius **7** are cut at the top and bottom edges on the stub line. A vertical perforation (1.5 wide, dashes 5 on and 5 off, `rule`) runs between them, inset 12 at the top and bottom.
  - Main: padding 18 12 18 20, a column centred vertically with gap 4. Name in `card-name`, sub-line in Mono 400 12.5 ink-muted ("3 decks", "1 deck").
  - Stub: a right chevron (16, stroke 2.2, ink), centred.
- **Variants:**
  - **Area / platform:** at least 104 tall.
  - **Deck:** stub 80 wide, at least 128 tall, main gap 2. Code in `deck-code`, name in Sans 600 16 / 1.25. Below them a status row (margin-top 10, gap 10, `mono-data` ink-muted) with a progress track and "38% seen" (the number in 600 ink) or "Not started". The stub shows "Cards" (`field-label`), the count (Mono 600 16) and the chevron (margin-top 8).
  - **Progress track:** 56 × 8. The not-seen part is a dashed 2px line (4 on, 4 off, `rule`). The seen part is a solid 2px `ink` line, width = percent seen, ending in an 8px `accent` dot with a 1.5px `ink` ring. With nothing seen, only the dashed line shows.
  - **Section** (start step 4): stub 80, at least 90 tall, padding 14 top and bottom, main gap 2. The code in `deck-code` (or "Whole deck" in `card-name` for the first card) over the name in Sans 600 16 / 1.25, ink ("All 4 sections" under Whole deck). Stub: "Cards", count, chevron, as on the deck card. Whole deck always comes first.
  - **Class** (start step 5): stub 80, at least 108 tall, padding 16 top and bottom. The class name in `card-name` over its one-line rule in Sans 600 16 / 1.25, **ink-muted** ("10 cards, score at the end."). Stub: "Best" (`field-label`), the value (Mono 600 16) and its unit (`field-label`: "of 10", "in a row", "cards"). Never played: an ink-muted "–" over "not played". No chevron: the class card is the last choice before the ready step.
  - **Not available** ("No decks yet"): at least 84 tall, a single column with no stub, notches, shadow or icon. Fill `surface-sunk`, name in ink-muted. It is not a button and does nothing when tapped; it is a labelled group ("DevOps, no decks yet").
- **States:** pressed scales to 0.98 (`motion.transition.press`). Focus uses the 3px ink ring. While the chosen name is travelling, the card hides its own name.
- **Used by:** browse-c steps 1 to 3, start steps 1 to 5.

### 5.4 Fill-in pass (start flow)
- **Purpose:** shows what the player has chosen so far, written onto one pass that becomes the round's boarding pass and then its first card. It is the bridge between choosing and boarding. It is always the same piece of paper: it changes size, never gets replaced.
- **Placement:** the start-flow top zone on steps 2 to 6, under the Back pill. On step 1 the logo and tagline stand there instead.
- **Common parts:** radius 16 on all corners while being filled, paper `surface-raised`.
  - **Compact carrier band** (steps 2 to 5): 30 tall, padding 0 14, gap 8, `accent`. A 20 × 14 logo mark (ink ticket with an `accent` check), "Truthy" in Sans 800 14, and "YOUR PASS" in Mono 600 11, 0.06em.
  - **Field cell:** padding 9 0 11; from the second cell on, a 1.5px `rule` divider and `padding-left` 12. `field-label` over a 20 tall value box (margin-top 3) holding the value (`field-value-pass`; codes in Mono 600 16) or the blank.
  - **Blank:** three dashes, each 14 × 3, radius 2, gap 5, colour `rule`, labelled "not chosen" for screen readers.
- **Four layouts, one per stage:**
  1. **Choosing the destination** (steps 2 and 3): `elevation.small`, one row of Area / Platform / Deck (1fr 1.35fr 0.8fr), padding 0 16.
  2. **Choosing the route** (steps 4 and 5, `elevation.small`): area and platform fold into one quiet line (30 tall, padding 8 10 0): "Cloud · AWS" in `pass-line`. Under it Deck / Section / Class (0.75fr 1.1fr 1.15fr). A section shows its code ("SEC"); the whole deck shows "Whole deck" in Sans.
  3. **Ready** (step 6): the full boarding pass of 5.2 without its lower part: `elevation.ticket`, 44 carrier band with the cloud glyph and "BOARDING PASS", legs (deck code and "AWS Cloud / Practitioner" to section code and name; for a deck without sections `ALL` / "Whole deck"), field grid Class / Cards / Gate (Cards is the number of cards in the chosen section or deck), 18 of space below. 358 × 210 at y 120.
  4. **Boarding** (step 7): the pass grows downward into the first card of the round: statement, perforation and stub exactly as on a game ticket (120 to 728). The second field becomes Card "01 / 10" (Classic) or "01" (other classes).
- **Field states:** blank; **now** (the field being chosen: dashes and label switch to `ink`, label weight 600); filled (value shown, ellipsised on overflow). Changes are announced politely.
- **Filled fields are ways back.** Each filled field (and each word on the quiet line, and each leg on the ready pass) is a button that returns to its step, labelled "Change deck, now CLF". Pressed: `press` tint, radius 6 (8 on the legs). Going back clears every choice made on or after that step. Fields are inert on step 7.
- **Behaviour:** choosing a card sends its name travelling into its field (see Motion). Back sends it back to its card. A deck without sections (CDL) skips step 4: Section reads "Whole deck" and Back from the class step returns to the deck step.
- **Used by:** start, start-night (all four layouts); browse-c (layout 1 only, drawn above the sheet's scrim).

### 5.4a Continue line (start step 1)
- **Purpose:** one tap back into the last route for a returning player, without adding a second decision to the first screen.
- **Placement:** the foot zone of step 1, only when a previous round exists on the device (`data-player="returning"`). A first run shows nothing there.
- **Anatomy:** a 60 tall row, radius 16, no fill and no shadow, padding 0 12 0 4, gap 14. A 44 `surface-raised` disc holding the logo mark (26 × 18). Then two lines: "Continue where you left off" (`emphasis`, line height 1.2) over the route in `mono-data` ink-muted, ellipsised: "CLF → SEC · Classic · last **7 of 10**" (the last score in Mono 600 ink). A right chevron (16, stroke 2.2) at the end.
- **States:** pressed scales to 0.98 and fills with `press`. Accessible label: "Continue: Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10."
- **Behaviour:** fills the whole pass at once and goes straight to step 6 ("Your pass is ready"), so the player can still change any field or press Back.
- **Used by:** start, start-night.

### 5.5 Round button
- 48 circle, centred icon, colour `ink`.
- **Variants:**
  - **Raised** (header): `surface-raised` with `elevation.small`. The X icon (16, stroke 2.4) means leave or close ("Leave round", "Close results"). The ← icon (18 × 16, stroke 2.4) means back ("Back to sections", mode-select).
  - **Sunk** (on paper, the sheet close): `surface-sunk` with no shadow.
- **States:** pressed scales to 0.92 (t1, ease). Focus uses the 3px ink ring, offset 3.
- **Theme switch** (raised, start steps 1 to 6): at the top right of the start flow's top zone, its centre in line with the logo row on step 1 (top 32) and with the Back pill row from step 2 (top 0). It moves between the two with a transform (step timing; at once with reduced motion) and fades out with the Back pill when the round starts. The icon shows what a press gives: a moon (18, stroke 2) while the day theme is shown, a sun (18, stroke 2) while the night theme is shown. The label states the action: "Switch to dark theme", "Switch to light theme". A press flips the theme on screen and keeps the choice on the device. Not on the game or result screens.
- **Used by:** game-*, result-*, mode-select, start step 7 (Leave round), the browse-c sheet, start steps 1 to 6 (theme switch).

### 5.6 Back pill (start flow)
- 48 tall, padding 0 20 0 14, radius 24, `surface-raised`, `elevation.small`, gap 8. It holds a left arrow (18, stroke 2.2) and "Back" (`button-back`). It is aligned to the start of the row.
- Pressed scales to 0.96. Its accessible label names the destination ("Back to areas", "Back to platforms"). Escape also triggers it.
- **Used by:** browse-c steps 2 and 3, start steps 2 to 6 (on step 7 it gives way to the Leave round button, which returns to step 6).

### 5.7 Primary pill button
- 60 tall, radius 30, full width (or flex 1 in a pair), gap 10, label `button`, `elevation.button`.
- **Ink variant:** fill `ink`, text `on-dark`. Used for "Next card →", "See results →" (after every deciding answer, Classic's last card included: Classic after the last card, Streak after a wrong answer, Three lives after the third wrong answer, Time is up), "Start round →" (start step 6) and "Play again" (with a leading replay icon, 18, stroke 2.2).
- **States:** pressed moves down 2px, scales to 0.98 and switches to `elevation.press` (t1, ease). Focus ring colour `accent` (`focus-on-fill`).
- In the game answer state the Next row replaces the True/False row: it rises 12px and fades in after a 360ms delay. Focus moves to it at 420ms.
- On the result, "Play again", "Choose another route" (5.9) and "Close results" take presses only one second after the result appears; they look the same before. "Choose another route" lies where "See results" was, and a second tap, or a player still tapping when a Timed minute ends, must not leave the result unseen.
- **Used by:** game-*, mode-select, result-*, start (Start round).

### 5.8 True and False buttons
- A pair of 60px pills, each flex 1, with a gap of 12. **False on the left, True on the right**, matching the swipe directions.
- False: fill `false`, X icon (16, stroke 3), label "False". True: fill `true`, check icon (18, stroke 3), label "True". Text `on-dark`.
- States are the same as the primary pill. **Disabled** (Timed, during the stamp beat): opacity 0.45, no shadow, ignores taps.
- They are a full alternative to the swipe and always visible in the question state.
- **Used by:** game-*, start step 7 (the first card).

### 5.9 Quiet button
- 48 tall, radius 24, no fill and no shadow. Label `button-quiet` in `ink`, gap 8, with a leading route icon (20 × 14).
- Pressed scales to 0.98. It sits under the primary pill, 4px below it.
- **Used by:** result-* ("Choose another route").

### 5.10 Flight-path header
- **Purpose:** progress through the round at a glance, without numbers taking over.
- **Anatomy:** the header row (56 tall, gap 12) holds a round button, then the route. The route is an SVG with viewBox 276 × 34, drawn 34 tall at full width with overflow visible. Under it is the label row (`route-label`, margin-top 2, ink): progress on the left, tally on the right. Each label stays on one line with its number; when the two do not fit side by side (a 320 wide phone), the row wraps between them and the tally keeps to the right, so no label is ever split ("Ended · 5" over "cards"). The whole route is one image with a full-sentence accessible label ("Card 4 of 10. Cards 1 and 2 correct, card 3 wrong.").
- **Curve:** the quadratic `M6 24 Q138 -6 270 24`. The future part is dotted (stroke 1.6, dash 2 5, round caps, `ink`). The flown part is solid (stroke 2.4).
- **Marks:**
  - **Done:** a circle of r7 in `ink` with a `surface-raised` tick (stroke 1.8).
  - **Wrong:** a 13 × 13 square (rx 2) in `wrong` with a `surface-raised` x (stroke 1.8).
  - **Future:** a circle of r4 filled `surface-raised` with a 1.6 `ink` stroke. The destination is r5.
  - **Plane:** a circle of r12 in `accent` with an arrow (stroke 2, `on-accent`), rotated along the curve.
  - In the answer state the plane fades out (t2) and the current card shows its done or wrong mark.
- **Variants:**
  - **Count** (Classic, night): 10 waypoints. Label "Card **4** of 10" and "2 correct · 1 wrong".
  - **Streak:** done dots are r6 (tick stroke 1.6), spaced 24 apart along the curve. The best target at the end is a ring (r7 paper with ink stroke, around an r3 ink centre). Label "Streak **8**" and "Best **12**". After a wrong answer it reads "Streak ended at **8**".
    - **Any best.** The mockup's 24 apart is the case best = 12. While the best is still ahead, slot i sits at t = i / (best − 1) and the ring ends the route. At or past the best the route runs on into open sky: slot i sits at t = i / (cards + 1.6). Done dots take radius min(6, 0.31 × gap), where gap is the distance between two slots along x; they carry ticks from radius 5 and are plain dots below it.
    - **No best yet** (a first round, or a stored best of 0): the open-sky layout with no ring and no right label, only "Streak **3**".
  - **Lives:** three hearts at x 11, 39 and 67. A full heart is filled `ink`. A lost heart is an outline (1.6, `ink-muted`) with a slash. Hearts are lost from the right, so the last life is the heart on the left. Then a straight mini path at y 17: solid (1.2) dots of r2.6 spaced 9 apart, wrong cards as 9 × 9 squares (rx 1.5), the plane at x 238, then a dotted continuation. Up to 14 marks keep the 9 apart with the newest at x 219 (14 marks start at x 102); from 15 on they are squeezed between x 100 and x 219 (dot radius min(2.2, 0.45 × step), square side min(8, 1.3 × step), the x only from side 6). With no mark yet only the plane and the dotted continuation are drawn. Label "**2** of 3 lives left" and "**14** answered".
  - **Timed:** an r5 ink start dot, quarter marks (r3.5, paper that turns ink once passed) and an r5 paper destination. The plane moves continuously: x = 6 + 264t, y = 24 − 60t(1 − t), angle = atan2(−60(1 − 2t), 264). Label "**0:41** left" (clock in Mono 600 13 with tabular figures) and "9 correct · 2 wrong".
  - **Streak at or past the best** (game-streak-record): the old best keeps its ring where it was reached (ring radius = dot + 3.5, stroke 1.4) and the line runs on past it. Labels "Streak **13**" and "Previous best **12**" once the best is beaten; "Best **12**" while it is only equalled.
  - **Lives, a life lost** (game-lives, game-lives-out): the heart turns to the lost outline and its slash is drawn through as the Not quite stamp lands (300, delay 380), for every life, the last included. After the last life: labels "**No** lives left" and "**21** answered". The wrong square replaces the plane.
  - **Timed, time up** (game-timed-up): the solid line reaches the destination, every quarter mark is ink, the plane sits on the destination. Label "**0:00** left" and the tally.
  - **Start round** (start step 7): ten open waypoints and the plane on the first, "Card **1** of 10" and "0 correct · 0 wrong". The mock draws this Classic header for every class; a real round shows its own class header at card 1 (see Open questions).
  - **Completed** (results): the whole curve is solid (2.4), with every card resolved at t = i / (n − 1). Marks scale so they never touch: scale 1 up to 10 cards (r7 / 13), 6/7 up to 17 cards (r6 / 11, tick stroke 1.6), and from 18 cards a radius of min(6, 0.35 × 264 / (n − 1)) (21 cards: r4.6). Done marks carry their tick from radius 5, and a wrong square its x from side 6. On Streak the card where the previous best was reached is ringed. Labels "**Arrived** · 10 of 10", "**Ended** · 14 cards", "**Out of lives**", "**Time up** · 17 cards".
- **Used by:** game-*, result-*, start step 7.

### 5.11 Stamp
- **Purpose:** the verdict. It is the only tilted element and the only celebration.
- **Anatomy:** inline row, gap 8, padding 6 14 4, border **3px double** `currentColor`, radius 8, `stamp` type, rotated **−6deg**. Icon plus word: check plus "Correct" in `correct`, X plus "Not quite" in `wrong`.
- **Variants:**
  - **Slip verdict:** 24px, check icon 22, X icon 18.
  - **New best on the slip** (game-streak-record): 24px, filled star (20), `correct`. It takes the place of "Correct" on the answer that beats the best; screen readers still hear "Correct. New best".
  - **Stub stamp** (no slip under it): 28px, padding 8 18 6, `surface-raised` fill so it reads over the barcode, centred at 96px from the top of the stub, announced as a status, lands with `land-fast` (300).
    - **Timed verdict** (game-timed): check 24 and "Correct", or X 20 and "Not quite". It lands from scale 1.9 and −14deg like every stamp. The line under the barcode says what happens next: "Next card coming up" after a right answer, "Missed, saved for review at the end" after a wrong one.
    - **Time is up** (game-timed-up): `ink`, clock icon (22, stroke 2.4), delay 120, then the ticket jolts (delay 240). The statement and Gate turn ink-muted, Gate reads "Closed", the line under the barcode reads "This card doesn't count · 8 answered", and the only action is "See results →".
  - **New best on results** (result-timed, result-streak): 22px, filled star (18), `correct`. It replaces the comparison text and sits 10px above "Previous best 12".
- Reserved for real verdicts only: Correct, Not quite, New best, Time is up. "Arrived", "Ended", "Out of lives" and "Equals your best" are not stamps.
- **Used by:** game-*, result-timed, result-streak.

### 5.12 Intent stamp (drag preview)
- A stamp-like label on the stub that fades in while the card is dragged: Mono 600 26, a 3px **solid** border, radius 8, padding 6 12, paper fill, 64 from the top.
- True: left 16, rotated −7deg, `true`. False: right 16, rotated 7deg, `false`. Opacity = |intent| × 1.6. It is decorative, so screen readers skip it.
- **Used by:** game-*.

### 5.13 Option row (class picker)
- A radio row on the mode-select stub. Grid: 24 / 1fr / 96, gap 12, padding 12, radius 8, with a 1.5px transparent border.
- Content: the radio mark (24 circle, 2px `ink-muted` ring), `option-title`, `body-small` description, and on the right "Your best" in Mono 600 13 / 1.3. "Not played" is shown in Mono 400 ink-muted. Screen readers hear "Your best:" before the value, which is visually hidden.
- Rows are separated by 1.5px `rule` lines inset 12. The lines are hidden next to the selected row.
- **Selected:** fill `surface-sunk`, border `ink`. The mark fills `ink` and shows a paper check (14) that pops from scale 0.4 to 1 (t2, spring).
- Selecting a row writes its class into the Class field on the pass. Focus: 3px ink ring, offset 2.
- **Used by:** mode-select only. The start flow picks the class with class cards (5.3) instead.

### 5.14 Score block
- Padding 14 20 18, space between, bottom-aligned. Left: `field-label` ("Your score", "Correct", "Correct in a row") over `score` with its unit ("of 10", "of 17", "cards"; Streak has none). Right: `emphasis` comparison over `mono-data` ("2 short of your best / Best 9 / 10", "Equals your best / Best 21 cards"), or the New best stamp over "Previous best 12". Every mode uses the same three lines, "First round on this route" (no second line), "N short of your best" and "Equals your best", and a beaten record gets the New best stamp in every mode. The record reads by mode: "9 / 10" (Classic), "12" (Streak), "21 cards" (Three lives), "11" (Timed).
- **Used by:** result-*.

### 5.15 Missed-card list with "Why" disclosure
- **Container:** the ticket's lower part in `surface-sunk` with notches. Its header row (padding 16 20 4) shows "Missed cards" (`mono-data`, ink-muted) and "3 to review" (Mono 600 13, ink). Then comes a scrolling list (padding 0 20 20, scroll contained, scrollbar hidden). A 28px fade from `surface-sunk-clear` to `surface-sunk` covers the bottom edge.
- **Item:** padding 12 0 4, with a 1.5px `rule` line between items.
  - Head: `mono-caption`, "Card 03" on the left and "You said True" on the right.
  - Statement: `list-statement`, margin-top 6.
  - Foot: at least 48 tall. "Answer" (`mono-data`, ink-muted) followed by the word in Sans 800 17, ink (not red). The **Why** button sits on the right.
- **Why button:** at least 48 tall, padding 0 8, `mono-data-strong` in `true`, underlined 1.5 with a 3px offset, with a chevron-down (12, stroke 1.8). It reports whether it is expanded.
- **Expanded:** the chevron rotates 180deg (t2). The explanation (15 / 1.45, ink, with a 2px `rule` line on its left, `padding-left` 12, margin-bottom 12) grows from 0 to full height (t3, ease). The list then scrolls the opened item into view after 380ms (instantly with reduced motion).
- **Used by:** result-classic, result-timed, result-streak, result-lives, result-classic-night.

### 5.16 Bottom sheet (section picker)
- **Purpose:** after a deck is chosen, pick Whole deck or one section, without leaving the step. **Not part of the final start flow:** start.html makes the section its own step with section cards (5.3), so the flow stays one decision per screen and needs no overlay. Build the sheet only if the client asks for it back.
- **Anatomy:**
  - Pinned to the bottom, running **72px past the screen edge** (padding-bottom 106) so the spring overshoot never shows a gap.
  - `surface-raised` with top corners r16 and `elevation.sheet` (pointing up).
  - **Scrim:** `scrim` over the whole screen. Layering: scrim 5, sheet 6, fill-in pass 7.
  - **Grab bar:** 40 × 4, radius 2, `rule`, 8 from the top.
  - **Title bar:** 68 tall, padding 16 16 0 20. "New boarding pass" (`sheet-title`) and a sunk round close button.
  - **Head:** the legs grid. From: the deck code (`leg-code`) with the platform and deck name. To: a blank of three 18 × 3 dashes (gap 6) over "Choose a section" (ink-muted).
  - Then a perforation (margin 0 20) and a label row (`field-label`, padding 14 20 4) reading "Section" and "Cards".
  - **Rows** (padding 0 20): at least 56 tall. Grid 52 / 1fr / auto / 16, gap 12, padding 8 0 6. Each row shows the code (`section-code`), name (`list-title`), count (`mono-data`, ink-muted) and a muted chevron. Rows have a 1.5px `rule` line below them, except the last.
  - The first row is **Whole deck** (`ALL`): its name is set in 800 and the line under it is `ink`.
- **States:** pressed rows fill with `surface-sunk`. Row focus is the ring with offset −1 and radius 8.
- **Open, close and focus:** open and close are described in Motion. The scrim, the X and Escape all close the sheet. Focus moves to the first row after 420ms and returns to the deck card that opened the sheet. The sheet is a modal dialog labelled by the deck code and title.
- **Used by:** browse-c only.

### 5.17 Logo
- The mark is an amber ticket (44 × 30) with corner radius 6 and side notches of radius 4.5. A dashed tear line (stroke 1.6, dash 2.5 3) runs at x 33, and a check (stroke 3) sits inside, both in `on-accent` (ink by day). Next to the mark (gap 12) is "Truthy" in `logo`.
- The compact mark (20 × 14) on the fill-in pass is an ink ticket (`on-accent` at night) with an `accent` check (stroke 3.4) and no tear line. The continue line uses the full mark at 26 × 18.
- **Used by:** browse-c, start (step 1 header, compact pass band, continue line).

---

## 6. Iconography

- **Form:** inline line icons, round caps and joins, coloured with `currentColor`, hidden from screen readers. The control's label carries the meaning. No icon stands alone without a word or an accessible label.
- **Arrows inside text** are typed characters, not icons: "Next card →", "Start round →", "← False", "True →", "Gate F ← → T", and the → after the source link.

| Icon | Box | Path / construction | Stroke | Where |
|---|---|---|---|---|
| X (close, leave) | 16 | `M3 3l10 10M13 3L3 13` | 2.4 header; 3 in False button and stamps | header, sheet, False, Not quite |
| Check | 18 viewBox | `M3 9.5l4 4 8-9` | 3 | True (18), Correct stamp (22, Timed 24), radio (14), intent (18) |
| Back arrow, header | 18 × 16 | `M16 8H3M8 2.5L2.5 8 8 13.5` | 2.4 | mode-select |
| Back arrow, pill | 18 | `M15 9H4M8.5 4L3.5 9l5 5` | 2.2 | browse-c Back |
| Chevron right | 16 | `M6 3l5 5-5 5` | 2.2 | cards and continue line (ink), sheet rows (ink-muted) |
| Clock | 22 | circle r8 at (11, 12) plus `M11 7.5V12l3 2M8.5 2h5` | 2.4 | Time is up stamp |
| Chevron down | 12 | `M2 4l4 4 4-4` | 1.8 | Why; rotates 180deg when open |
| Fly arrow | 40 × 16 | `M1 8h36M30 2l7 6-7 6` | 2 | ticket legs, sheet head |
| Book | 18 | `M3 3h5l1 1 1-1h5v12h-5l-1 1-1-1H3zM9 4v11` | 1.6 | source link |
| Replay | 18 | `M3.5 9a5.5 5.5 0 1 0 1.8-4.1M3.5 2.5v3h3` | 2.2 | Play again |
| Route | 20 × 14 | two r2 circles plus a curve dashed 2 3 | 1.8 | Choose another route |
| Star | 18 | filled five-point path | fill | New best (20 on the slip, 18 on results) |
| Heart | 20 | filled `ink`; lost = outline 1.6 `ink-muted` plus slash | 1.6 | lives header |
| Carrier cloud | 22 × 16 | filled path | fill `on-accent` | carrier band |
| Plane | r12 | `accent` circle plus `M-7 0h14M1-6l4 6-4 6M-6-3l2 3-2 3` | 2 `on-accent` | flight path |
| Moon | 18 | `M15.8 9.6A6.8 6.8 0 1 1 8.4 2.2a5.3 5.3 0 0 0 7.4 7.4z` | 2 | theme switch, day theme shown |
| Sun | 18 | circle r3.3 at (9, 9) plus `M9 1.5v1.6M9 14.9v1.6M1.5 9h1.6M14.9 9h1.6M3.7 3.7l1.1 1.1M13.2 13.2l1.1 1.1M3.7 14.3l1.1-1.1M13.2 4.8l1.1-1.1` | 2 | theme switch, night theme shown |

The exact paths are in the reference files. Copy them; do not redraw. The moon and the sun came after the approved screens; they are drawn in the same style (round caps and joins, `currentColor`) and their paths are in `components/icons.tsx`.

---

## 7. Motion

Durations and curves come from `tokens.json` `motion`. On web, `--spring` is `cubic-bezier(0.34, 1.56, 0.64, 1)`, which overshoots by 9.8% and peaks at 57% of its duration. The native springs below were fitted to match that peak time and overshoot: **damping ratio 0.6**, stiffness = (π / (0.573 · D · 0.8))².

| Spring | Web | SwiftUI | Compose |
|---|---|---|---|
| `snap` (360) | t3 + spring | `.spring(response: 0.33, dampingFraction: 0.6)` | `spring(dampingRatio = 0.6f, stiffness = 360f)` |
| `land` (420) | 420 + spring | `.spring(response: 0.39, dampingFraction: 0.6)` | `spring(0.6f, 265f)` |
| `land-fast` (300) | 300 + spring | `.spring(response: 0.28, dampingFraction: 0.6)` | `spring(0.6f, 515f)` |

`ease` = `cubic-bezier(.2,.7,.2,1)`: SwiftUI `.timingCurve(0.2, 0.7, 0.2, 1, duration:)`, Compose `tween(d, easing = CubicBezierEasing(0.2f, 0.7f, 0.2f, 1f))`. `fall` = `(.5, 0, .9, .4)` works the same way.

| Transition | What moves | Duration / delay / easing | Reduced motion | SwiftUI | Compose |
|---|---|---|---|---|---|
| Press | Round 0.92, Back 0.96, pills move 2px down and scale 0.98 with the press shadow, cards and quiet 0.98 | 120, ease | Instant | `ButtonStyle` with `scaleEffect` and `.animation(.timingCurve…)` | `interactionSource.collectIsPressedAsState()` plus `graphicsLayer` |
| Drag | Card x = dx, rotation dx / 18; stub pull; intent stamp opacity | Follows the finger, no animation | Same (direct manipulation) | `DragGesture` | `pointerInput { detectHorizontalDragGestures }` |
| Release under 90px | Card returns to 0 | `snap` | Instant | `.spring` with the gesture's predicted velocity | `Animatable.animateTo(0f, spring, initialVelocity)` |
| Answer (swipe past 90 or tap) | **Tear:** stub to (−40, 360) at −18deg if correct, (40, 360) at 18deg if wrong, opacity to 0 | 460, `fall` (opacity ease-in) | Instant swap to the slip | `.transition(.offset.combined(with: .opacity))` with `timingCurve` | `AnimatedVisibility(exit = slideOut + fadeOut)` with `tween(460, fall)` |
| Stamp lands | Scale 1.9 → 1, rotation −14 → −6deg, opacity 0 → 1 | 420, delay 380, `land` | Shown at rest | `scaleEffect` / `rotationEffect` with `.spring(...).delay(0.38)` | `Animatable`s with `spring`, then `delay(380)` |
| Jolt | Ticket main part moves 2px down at 40% and back | 260, delay 420, ease (Timed: delay 120) | None | `keyframeAnimator` | `keyframes { 2f at 104 }` |
| Plane out | Plane opacity to 0, waypoint mark appears | 220, ease | Instant | `.opacity` | `animateFloatAsState` |
| Next row in | True/False row out (moves 12px down, fades); Next row rises 12px and fades in | 220, delay 360, ease | Instant | `.transition(.move + .opacity)` | `AnimatedContent` |
| Timed beat | Stamp on stub (`land-fast`, 300, from scale 1.9 to 1 like every stamp), pills dim to 0.45, hold **700 from the tap**, card leaves ±120% x at ±8deg toward the answered side (220, `fall`), next card dealt from 14px below (280, ease) | as listed | Stamp at rest, instant card change | `.transition(.asymmetric(...))` on a keyed card | `AnimatedContent(targetState = cardIndex)` |
| Start flow: step forward | Outgoing title (80) and cards (140) rise 10px and fade (ease-out). After a 60 hold the chosen **name travels** into its pass field (300, ease; translate and scale only, 26 → 16 or 30 → 16). Blank dashes fade out (100, delay 120); the value shows when the name lands. Incoming items rise from 24px (240, delay 110 + 25 per item, ease). Total 360 | Old step fades out (100), then the new one fades in (140, delay 90). Text never overlaps | `matchedGeometryEffect` with one `Namespace` id per field; steps as `.opacity.combined(with: .offset(y: ±24))` | `SharedTransitionLayout` + `Modifier.sharedElement(key = field)` inside `AnimatedContent(step)`; `fadeIn + slideInVertically` |
| Start flow: back | The reverse: the value flies from the pass back to its card, current items sink 10px, previous items drop from −24px, dashes return (140, delay 220) | as above | as above | Same, direction from navigation | Compare `targetState` with `initialState` |
| Top zone swap (step 1 ↔ 2, and step 1 → 6 on Continue) | Logo leaves (110, rises 12px) and the Back pill plus pass arrive (240, delay 120, from 12px below); the reverse on the way back | ease | Cross-fade as above | `.transition` on the top zone | `AnimatedContent` on the top zone |
| Pass changes layout (steps 3 → 4, 5 → 6 and back) | One paper: its height and y animate together, the band grows from 30 to 44 with its type; the old block fades out (120, ease-out) while the new one fades in (220, delay 90). Values already on the pass travel to their new place; when their look changes (Sans 16 field → Mono 34 leg, Mono 16 → Mono 15) the old and new copies cross-fade on a linear clock (old gone by 60%, new in from 40%) while the shape follows the eased path | 360, ease | Cross-fade as above | One view whose content switches inside an animated frame; `matchedGeometryEffect` per value with an overlay copy for the cross-fade | `animateContentSize` on the pass plus `sharedElement` per value |
| Start round (step 6 → 7) | The pass grows down into the first card (460, ease); the field Cards becomes Card "01 / 10" (fade 200, delay 160); the statement rises 8px and fades in (260, delay 220); the stub print fades in (240, delay 260); Back fades out (110) and the flight-path header comes in from 8px above (240, delay 160); True and False come in (240, delay 200). Focus moves to the statement | as listed | Cross-fade | as above | as above |
| Leave round (step 7 → 6) | The reverse: statement and stub print fade (120), the paper rolls up (460), the header leaves and Back returns (delay 160); the step 6 text waits until the paper has passed (delay 320) | as listed | Cross-fade | as above | as above |
| Jump back through a field | Tapping a filled field goes straight to its step: every later value fades out as a ghost (120) or flies back to its card if that card is on the target step | 360, ease | Cross-fade | as above | as above |
| Continue (step 1 → 6) | Logo out, full pass in (the top-zone swap); the pass values fade in (220, delay 200); Start round comes in (240, delay 140) | as listed | Cross-fade | as above | as above |
| Time is up | Stub stamp lands (`land-fast`, 300, delay 120); jolt (260, delay 240) | as listed | Stamp at rest | as Stamp lands | as Stamp lands |
| Timed stub into view | When the stub is stamped (an answer, or time up) the ticket scrolls to its end, which is the stub, so the stamp and its hint sit above the action row and nothing of the ticket is left under the dimmed pills. The next card scrolls the ticket back to the top while it is dealt. Only a ticket taller than its stage moves (320 × 568: about 270); at 390 × 844 nothing scrolls | Smooth scroll (the browser's) | Instant scroll | `ScrollViewReader.scrollTo(_:anchor: .bottom)` in `withAnimation` | `ScrollState.animateScrollTo(maxValue)` |
| Life lost | The slash is drawn through the heart that is lost (stroke dash 23 → 0, 300, delay 380, ease) as the Not quite stamp lands; every life, the last included | as listed | Drawn at rest | `trim(from:to:)` | `PathMeasure.getSegment` |
| Sheet open (browse-c) | Sheet rises from 104%; scrim fades in; deck code travels into Deck | 420 `land`; scrim 360 ease | Instant | Custom overlay (not `.sheet`) with `.spring` | Custom `Box` overlay with `animateFloatAsState(spring)`; not `ModalBottomSheet` |
| Sheet close (browse-c) | Sheet drops to 104%, scrim fades out, the code flies back to its card | 360 ease | Instant | as above | as above |
| Why | Height 0 → content; chevron rotates 180deg | 360 / 220, ease | Instant; scroll without animation | `DisclosureGroup`-like custom view with `.animation` | `AnimatedVisibility(expandVertically)` |
| Option select | Fill and border colour (220); mark fill (120); check pops 0.4 → 1 (220, spring) | as listed | Instant | `.animation(.spring(response: 0.2, dampingFraction: 0.6))` | `spring(0.6f, ~960f)` |

**Reduced motion rule.** On web, every animation is removed, transitions take 1ms and delays are dropped. Every end state must therefore be correct without its animation. The start flow is the one exception: it uses the timed cross-fade above. Native equivalents: `@Environment(\.accessibilityReduceMotion)` on iOS. On Android, read `Settings.Global.ANIMATOR_DURATION_SCALE` (0 means removed); Compose scales its animations by it, but the start-flow cross-fade needs an explicit branch.

Only transform and opacity animate, with one exception: the web Why disclosure animates the grid row height. Natives animate the height directly.

---

## 8. Accessibility

- **Colour independence.** Every result uses colour plus word plus shape:
  - Stamps: check + "Correct" / X + "Not quite".
  - Waypoints: a circle with a tick versus a square with an x.
  - Lives: a filled heart versus an outlined heart with a slash.
  - Buttons: icon + word.
  - The missed-card answer word is ink, not red.
  - The "now" field on the fill-in pass switches to ink dashes and a 600 label.
  - Time is up: a stamp with a clock and words, Gate reads "Closed", and the line under the barcode says the card does not count.
- **Contrast** is in 2.2. Text pairs are at least 4.5:1 in both themes, with two exceptions to fix or accept:
  1. **Day tagline:** `ink-muted` on `sky-1` is **3.78:1** (and 4.36:1 where it crosses into `sky-2`). 17px / 600 is not large text, so this fails 1.4.3.
  2. **Day focus ring on filled pills:** `accent` against `sky-3` / `sky-4` is **1.56 to 1.61:1**, which fails the 3:1 required for non-text contrast and focus appearance. Night is fine (about 7:1).
- **Decorative only:** `rule` (1.47:1) is never the only signal. Blank fields also say "not chosen" to screen readers and have a label above them. The disabled pills (0.45) are exempt as inactive controls.
- **Targets:** at least 48 everywhere (see Layout). The True/False buttons are a complete alternative to the swipe (WCAG 2.5.1). For natives, the research also recommends VoiceOver and TalkBack custom actions ("Answer true", "Answer false") on the card.
- **Focus:**
  - The ring is a 3px `ink` outline with a 3px offset. On filled pills it is `accent`; on option rows the offset is 2; on Why it is 0; on sheet rows it is −1 with radius 8.
  - Start-flow step titles take focus programmatically after each step, with no visible ring on purpose.
  - Focus moves to Next card, or to See results after a deciding answer, 420ms after the answer, to the first sheet row on open, and back to the opener on close or Back. At time up See results takes focus only if True or False had it. In Timed only the first card's statement takes focus.
  - In the start flow, going forward focuses the new step title; going back (Back, a field, Leave round) focuses the card that was chosen before; starting the round focuses the statement.
  - Escape closes the sheet, or goes back a step (on step 7 it leaves the round).
- **Screen reader:**
  - The flight path is one image with a full-sentence label.
  - The answer slip and the fill-in pass fields are polite live regions. In Timed the status says only "Correct." or "Not quite." during the stamp (the answer is given away nowhere during play) and "Time is up. This card doesn't count." at time up, and each new card from card 2 on is announced as "Card N. <statement>" from a polite, atomic live region that stays mounted outside the card (the card itself is replaced on every deal, and a live region that arrives with its text is not reliably read). The Timed statement is not a live region.
  - Cards carry full labels ("CLF, Cloud Practitioner, 214 cards, 38 percent seen", "Classic. 10 cards, score at the end. Your best: 9 of 10."). Filled pass fields say what they change ("Change section, now SEC"). The Back pill names its destination ("Back to classes").
  - The sheet is a modal dialog. The class picker is a radio group with a visually hidden legend.
- **Reduced motion:** see Motion. No information is carried by motion alone.
- **Dynamic type:**
  - The mockups use px and **fixed heights**: carrier 44, statement minimum 188 (170 + 18 in the start flow), stub and slip 228, actions 64, pass value box 20, step title row 36, top zone 176, foot zone 60.
  - Natives must scale text (Dynamic Type text styles mapped to the roles; `sp` on Android) and treat these heights as **minimums**. At 200% the statement and the explanation must grow or scroll, never clip.
  - Line heights are multipliers, so they scale with the text.

---

## 9. Portability notes

### Build natively as a custom Shape / Path
- **Ticket parts:** a rounded rectangle (r16 on the outer corners) with two half-circles of r12 cut at the perforation line. The web fakes this with two radial gradients (51% each, 0.5px soft edge). Natively, build one `Path` (`addArc`) and use it for both fill and clip.
- **Destination card:** a rounded rectangle r16 with r7 cuts at x = width − stub, top and bottom, plus a vertical dashed line.
- **Perforations:**
  - Horizontal: a 2px line dashed 7 / 5, which the web draws with butt ends. SwiftUI: `StrokeStyle(lineWidth: 2, dash: [7, 5])`. Compose: `PathEffect.dashPathEffect(floatArrayOf(7f, 5f))`.
  - Vertical: 1.5px dashed 5 / 5.
  - Progress track: 2px dashed 4 / 4.
- **Stamp double border:** two 1px rounded rectangles, the outer at radius 8 and the inner inset 2px at radius 6, rotated −6deg.
- **Flight path:** the quadratic curve `M6 24 Q138 -6 270 24` in a 276 × 34 box scaled to width. Place points at B(t) and rotate the plane along the tangent. Generate the streak, lives, timed and completed variants from data, as the web files do.
- **Logo mark, cloud, heart, star, plane:** port the SVG paths unchanged into `Path`.
- **Barcode:** generate it, do not draw it by hand. Start with bars 2/1/1/2 (on, off, on, off). Then, for each character of `"CLF|SEC|CLASSIC|04/10"`, take 7 bits (LSB first): bit 1 gives width 2, bit 0 gives width 1, and bars alternate on and off starting with on, followed by a 1-wide gap. End with 1/1/2 (on, off, on). Bars are 56 tall in a viewBox of total width × 56, stretched to the stub width and 76 tall. The same algorithm on every platform gives the same barcode.

### Pre-rendered assets
- **None are needed.** Everything is flat colour, hard-stop gradients, strokes and drop shadows. The only binary assets are the four font files.
- **Android caveat:** VectorDrawable cannot express SVG `stroke-dasharray`. The logo's dashed tear line and the dashed route icon must be drawn in Compose code (or exported with the dashes already expanded into paths).

### Known risks
- **Shadows:**
  - CSS uses blur plus **negative spread** (−18, −10, −6). SwiftUI `.shadow` has no spread, so draw the shadow from a shape inset by the spread, then offset and blur it. Compose: `Modifier.dropShadow` (Compose UI 1.9+; verify the version) takes radius, spread, offset and colour. Older versions need a `drawBehind` with a blurred paint.
  - The web ticket shadow comes from a plain rounded rectangle, not the notched outline. A native shadow drawn from the notched path will follow the notches. That is a small, acceptable difference.
- **Sheet:** the system sheets (`.sheet` with detents, `ModalBottomSheet`) cannot keep the fill-in pass above the scrim or match the spring and the 72px overrun. Build a custom overlay.
- **Name travel:** the web morph is translate plus scale of a copy of the name, and it works because both ends use line height 1.2 in the same family. With `matchedGeometryEffect` or `sharedElement`, Text re-lays out instead of scaling, so animate a scaled overlay copy instead, as the web does. For the deck code, mono 30 → 16 is a ratio of 0.533.
- **Sky:** the band stops are percentages of the screen height, but the clouds are placed in px. On taller or shorter screens the clouds move relative to the bands.
- **Fixed heights versus Dynamic Type** (see Accessibility).
- **Web-only CSS with no native meaning:** `:has()` in the option rows, `grid-template-rows: 0fr → 1fr` in the disclosure, and the radial-gradient notches.
- **Font fallback:** see the weight trap in Typography.

---

## 10. Open questions

1. **Day contrast failures.** The tagline is `ink-muted` on `sky-1` at 3.78:1, and the `accent` focus ring on pills is 1.6:1 against the sky. Possible fixes: make the tagline `ink`, or move it lower onto a lighter band; make the pill ring `ink` in day. Each fix changes an approved screen, so it needs the client's sign-off.
2. **Night sheet (closed).** The "Leave round?" confirmation is a sheet over `scrim` with the sheet shadow. With the day values it did not stand off the dark pass, so `tokens.json` now has a night scrim (black at 60%) and a night sheet shadow (the night ticket recipe pointing up).
3. **Two title sizes.** `screen-title` is 24 (mode-select) and `step-title` is 22 (browse-c, start). Unify them, or keep both? If the start flow replaces mode-select, only 22 remains.
4. **Safe areas on native.** Use the system insets alone, or the insets plus the mock's 52/34 as a minimum?
5. **Timed hold (closed).** 700ms from the tap until the card leaves, as spec section 6 says; `motion.duration.hold-timed` is 700. The mockup's 1000 is not used.
6. **Tear direction.** The reference drops the stub left when the answer was correct and right when it was wrong, whatever the swipe direction. Timed sends the card toward the side that was answered. Should the stub also fall the way the player swiped? **Answered: unchanged.** The stub falls left when the answer was correct and right when it was wrong; only the Timed card leaves toward the answered side.
7. **Where the result screens and Leave round go.** What the app does: Close on a result and "Choose another route" both return to start step 1, where the continue line offers the route just played. Leave round before the first answer leaves at once; after it, it asks once ("Leave round?") and then returns to start step 1 without a record, at any point of the round. "Play again" restarts the same route and class.
8. **Keyboard answering on the web.** The research suggests arrow keys or T/F. No approved screen implements them, so they are not specified here.
9. **Content data, not design:** browse-c counts CLF sections as CON 45 / SEC 47 / TEC 88 / BIL 34, while mode-select shows SEC as 64 cards (the earlier standard was 52 / 64 / 70 / 28). Pick one source of truth.
10. **Mode-select and the sheet versus the start flow.** start.html chooses the section and the class as steps, which makes the approved mode-select screen and the browse-c sheet redundant. Confirm with the client that start.html is the flow to build.
11. **Round header on start step 7 for other classes (closed).** Each class shows its own header from card 1: "Streak **0**" with its best, three full hearts and "**0** answered", "**1:00** left". The play screen draws the header of the mode, so the hand-over from the start flow needs no motion of its own.
12. **Bests per route.** The class cards show the best for the chosen deck and section. Whether a whole-deck best and a section best are kept apart (they are in the mock) needs confirming.
13. **Timed stamp on a short phone (decided in the build, for the owner to confirm).** At 320 × 568 the ticket is taller than the stage, and the stub with its stamp and hint lay under the answer row for the whole beat and at time up, with the statement showing through the dimmed pills. The ticket now scrolls to the stub when it is stamped and back for the next card (section 7, "Timed stub into view"). The alternative, a smaller or moved stub stamp on short screens, was not taken because it changes the approved stub.

### Where approved screens disagree (value chosen in bold)

| Topic | Values | Chosen |
|---|---|---|
| Body text | 15.5 (reference `.explain`) vs 15 (result `.mc-exp`) | **15.5** |
| Small mono sub-line | 12 (reference stub row) vs 12.5 (browse-c `.sub`) | **12** |
| Inline mono link | 13.5 (reference source) vs 13 (result Why) | **13.5** |
| Header icon stroke | 2.4 (reference X, mode-select ←) vs 2.2 (browse-c Back ←) | **2.4** |
| Field value | Mono 600 15 (reference ticket) vs Sans 800 16 (browse-c pass) | **Mono 600 15** on the ticket; the pass keeps its own role as a separate component |
| Field grid | 1.1 / 1 / 1 fr, cells 8 / 7, label gap 2 (reference) vs 1 / 1.35 / 0.8 fr, cells 9 / 11, gap 3 (pass) | Reference on the ticket; the pass keeps its own |
| Carrier band | 44 tall, 16 / 12 type, padding 16, gap 10 (reference) vs 30, 14 / 11, padding 14, gap 8 (pass) | **Reference**; compact variant for the pass |
| Stamp size | 24 (reference, New best on the slip) vs 28 (stub stamps: Timed, Time is up) vs 22 (New best on results) | **24** base; the other two are documented variants |
| Waypoint size | r7 / 13 (reference, result-classic) vs r6 / 11 (streak, result-timed) vs r2.6 / 9 (lives) | **r7 / 13**; smaller only when density requires it |
| Pill labels at 48 tall | 16 quiet (result) vs 15 Back (browse-c) | Both kept; no reference value (question 3 also applies) |
| Lower cloud | top 620 (game, mode, results) vs 660 (browse-c, start) | **620** for game screens; the start flow keeps 660 so the cloud sits under its foot zone |
| Shadow and on-accent tokens | defined in the night `:root`; hard-coded literals in day | Tokenised for both themes, same values |
| browse-c motion (builder notes vs file) | Notes: logo leaves in 160, pass in at 100. File: 110 and 120 | **File** |
