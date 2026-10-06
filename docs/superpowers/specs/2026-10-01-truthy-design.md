# Truthy: a true/false card game that teaches IT

Date: 2026-10-01. Status: design approved section by section in conversation, pending user review of this document.

## 1. What is being built, in one paragraph

Truthy is a mobile-first web game. The player picks what to study by filling in a boarding pass (area, platform, deck, section, class), then plays a round of true/false cards: a statement appears, the player swipes right for True or left for False (or taps a button), and sees whether they were right together with a short explanation and a link to the official source. Four modes share one engine. Everything runs on the device: decks are static JSON, progress lives in local storage, there is no account and no backend. The web version is the first of three; it will later be cloned natively in SwiftUI and then Jetpack Compose, so the design language, the content format and the game rules are specified to survive those clones unchanged.

## 2. Decisions already made (do not reopen)

| Decision | Value | Owner |
|---|---|---|
| Purpose | Personal project for fun and learning. No store, revenue or growth target. | user |
| Name | Truthy | user, after store and domain check |
| Platforms, in order | Mobile-first web, then SwiftUI, then Android | user |
| Content hierarchy | area > platform > deck > section | user |
| Modes | Classic, Streak, Three lives, Timed, on one engine | user |
| Answer input | Swipe plus buttons, one code path | user |
| Accounts and backend | None. Progress on the device behind one module | user |
| Content language | English, card text keyed by language (`text.en`) | user |
| Design language | Boarding Pass (round 1 design d10) | user, chosen from 40 directions |
| Start flow | "Filling in the pass" (prototype browse-c), one decision per screen | user |
| Stack | Next.js on Vercel | user |
| Decks | Static JSON built from the repository, no API key, no runtime server | approved recommendation |
| Repository | One repository, public | user |
| Accidental swipes | Prevention rules only in v1. A "Mis-swiped?" flag is reconsidered after the first play test | user |
| Leaving a round | One confirmation once a card has been answered; a round left before its deciding answer sets no record, one left after it (or at time up) is recorded as opening its result would record it; card history is kept | approved recommendation, the recording after the deciding answer an owner decision |
| Timed mode and hidden tab | The clock pauses while the page is hidden | approved recommendation |
| Timed mode, card on screen at time up | Not counted, not recorded as wrong | approved recommendation |
| three.js | Only as an optional web-only signature moment, after the core ships | approved recommendation |

## 3. Scope

### In scope, delivered in three steps

Each step leaves working, tested, deployed software.

1. **One mode end to end.** Project skeleton, design tokens, deck build, the start flow, a Classic round, the result screen, progress storage, deploy to Vercel. Decks: every deck whose review is finished when the step ships (AWS Cloud Practitioner, Next.js Rendering, Google Cloud Digital Leader).
2. **The other three modes.** Streak, Three lives and Timed with their in-game states and result screens.
3. **Polish.** Offline play. The night theme and the AWS Solutions Architect Associate deck were planned for this step and were pulled forward after step 1 shipped (section 9, "Tokens in code"; the deck entered once its review was finished).

This document specifies all three. Implementation plans are written per step, starting with step 1.

### Out of scope

Accounts, sync, leaderboards, any backend; Turkish or other languages; the native apps; the three.js signature moment; the "Mis-swiped?" flag; a theme menu or settings screen (the two-state theme switch of section 9 is in scope); analytics; the second game idea that has not been discussed yet.

## 4. Architecture

### Stack

Next.js 16 (App Router), React 19, TypeScript in strict mode, Tailwind CSS 4, zod, Vitest, pnpm, deployed on Vercel from `main`. Two additions: Motion for transitions, Playwright for end-to-end tests.

### Rendering

Every route is prerendered at build time. The game is client components. There are no API routes, no server actions, no database and no environment secrets.

### Routes

| Route | Purpose |
|---|---|
| `/` | The start flow: area, platform, deck, section, class, then "Start round". One screen that steps through its states. |
| `/play` | The round and its result. The chosen route and class are read from the store; opening `/play` without a pending round redirects to `/`. |
| any other | The game's own "Page not found" page (status 404) on the sky, in the theme the player chose, with one action: "Back to start". |

### Modules

Each module has one job and a narrow interface. Dependencies only point downwards in this table.

| Module | Job | May depend on |
|---|---|---|
| `src/meta` | The app's name and its one-line description, for the logo, the page head, the web manifest and the 404 page | nothing |
| `src/content` | zod schemas and types for the catalog and decks; loading and caching deck files | nothing |
| `src/engine` | Dealing a round, the mode rules, scoring. Pure TypeScript: no React, no DOM, no storage, no clock or randomness of its own | `content` types |
| `src/progress` | Card history, records, last route. An interface plus a local storage implementation | `content` types |
| `src/input` | Swipe interpretation: pure functions that turn pointer samples into "cancel", "true" or "false" | nothing |
| `src/app-state` | What the screens share outside the engine: the table of classes, the round the start flow hands to `/play` (session storage), the theme choice, and the services a screen takes (network, storages, history) so its tests run without a browser | `content`, `progress` |
| `components` | The design system's components | design tokens; `src/meta` for the app name (`Logo`); the engine's constants and types (`LIVES`, `TIMED`, `Answered`) and the progress types they draw (`Comparison`); `src/content/text`, which splits card text into plain and code parts (`CardText`); and, for `ThemeSwitch` alone, the theme logic and storage type in `src/app-state` and the local storage in `src/progress/local`, because the switch reads and keeps the player's theme choice itself |
| `components/start`, `components/play` | The start flow, and the play and result screens with their hooks: they wire the modules together | all of the above |
| `app` | Routes, each rendering one screen; the root layout (fonts, theme script) and the 404 page | all of the above |

`engine` and `input` being pure is deliberate: they are fully unit-testable, and they are the reference that the Swift and Kotlin clones translate line by line. `progress` sitting behind an interface is what lets the native apps put iCloud key-value storage or Play Games behind the same contract. `tests/purity.test.ts` enforces the pure rows (`src/engine`, `src/input`, the progress rules in `src/progress/progress.ts`, and `src/content/play.ts` and `text.ts`); the other rows are kept by review.

## 5. Content

### Repository layout

```
content/
  prompts/      generation prompts and their generator
  raw/          model output, never edited
  review/       verification results and the edit files that record every change and its reason
  reviewed/     the reviewed decks (generated from raw + edits)
  catalog.json  the hand-written hierarchy
scripts/build-decks.ts
public/decks/
  index.json
  <deck id>.json
```

The content pipeline (prompting, structural validation, fact checking, review edits) exists and is documented by its own files; this specification only fixes its output contract.

### catalog.json

Hand-written. It defines areas, platforms and decks, and for each deck its sections and how reviewed cards map to them.

```json
{
  "areas": [
    {
      "id": "cloud", "title": "Cloud",
      "platforms": [
        {
          "id": "aws", "title": "AWS",
          "decks": [
            {
              "id": "aws-clf-c02", "code": "CLF", "title": "Cloud Practitioner",
              "sections": [
                { "id": "CON", "title": "Cloud concepts", "match": ["1.1", "1.2", "1.3", "1.4"] },
                { "id": "SEC", "title": "Security and compliance", "match": ["2.1", "2.2", "2.3", "2.4"] }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

`match` lists the values of the reviewed card's `task` or `section` field that belong to the section. A deck with an empty `sections` array is played as a whole deck only. An area or platform with no decks is valid and is shown as not available yet.

Initial catalog: Cloud > AWS > Cloud Practitioner (CLF: CON 45, SEC 47, TEC 88, BIL 34 cards) and Solutions Architect Associate (SAA: SEC 33, RES 20, PRF 54, CST 47 cards); Cloud > Google Cloud > Cloud Digital Leader (CDL, no sections, 133 cards); Cloud > Azure (no decks); Frontend > Next.js > Rendering (RND, eight sections, 94 cards); DevOps (no decks).

Added after step 2: Cloud > Google Cloud > Associate Cloud Engineer (ACE, four sections, 113 cards); Cloud > Azure > Fundamentals (AZ9, six sections, 99 cards); Frontend > React > Fundamentals (RCT, five sections, 135 cards), TypeScript > Fundamentals (TSC, six sections, 113 cards) and Web platform > Security (WEB, five sections, 112 cards); DevOps > Docker > Fundamentals (DKR, six sections, 112 cards), Kubernetes > Kubernetes and Cloud Native Associate (KCN, four sections, 116 cards), Terraform > Associate (TFA, six sections, 144 cards) and GitHub > Actions (GHA, five sections, 125 cards). Then: Frontend > JavaScript > Fundamentals (JSC, six sections, 134 cards) and Web platform > Accessibility (ACC, six sections, 121 cards) and Performance (CWV, six sections, 122 cards); DevOps > Git > Fundamentals (GIT, five sections, 122 cards) and Linux > Command line (LNX, six sections, 119 cards). A deck whose platform and title would read badly together on the pass carries a `passName`: Google Cloud Digital Leader, Google Associate Cloud Engineer, Web Security, Web Accessibility, Web Performance, Kubernetes and Cloud Native Associate, Linux Command Line.

### Build step

`scripts/build-decks.ts` runs before `next build`. It reads `content/catalog.json` and `content/reviewed/*.json`, validates both with zod, checks that every card maps to exactly one section, and writes `public/decks/`. Any validation failure fails the build, so a broken deck cannot be deployed. A conflict group that only one card of the deck lists cannot conflict with anything: it is dropped from that card, not reported.

### public/decks/index.json

The catalog plus, for each deck, `cardCount`, per-section `cardCount`, a `version` (ISO date of the build that last changed the deck) and a `hash` of the deck file's content.

### Deck file

```json
{
  "id": "aws-clf-c02",
  "hash": "…",
  "cards": [
    {
      "id": "aws-clf-c02-t2.1-06",
      "section": "SEC",
      "text": { "en": { "statement": "…", "explanation": "…" } },
      "answer": false,
      "source": { "title": "…", "url": "https://…" },
      "difficulty": 2,
      "appliesTo": "",
      "conflictGroups": ["shared-responsibility-split"]
    }
  ]
}
```

Card ids are stable for the life of a card. Pipeline-only fields (misconception, factKey, topic, tags, volatility, revision) are not shipped. `appliesTo` is shown on the card when it is not empty (for example "cacheComponents: true"). A statement or an explanation marks a code fragment with backticks, as Markdown does ("An `asserts x is string` function"); the fragment is shown in the mono face without its backticks (`src/content/text.ts`), and a screen reader hears it without them.

### Loading

The app fetches `index.json` on start and a deck file when a round on that deck starts. Both are cached on the device; a deck is fetched again only when its `hash` in the index differs from the cached one. A fetch that fails or does not answer within 8 seconds falls back to the cached copy; without one, the screen that needed the data shows a plain message with a retry action. A round dealt again from the play screen ("Play again", or "Try again" once a round has been dealt there) waits at most 1.5 seconds for the index, then deals from the index the last round was dealt from; the fetch goes on behind it and still caches what it brings, so a deck update shows up in a later round.

## 6. Game engine

### Shape

A reducer: `next(state, event) -> state`. Randomness comes from a seeded generator passed in at the start of a round; time comes in through events. The same seed and the same events always produce the same round.

Events: `answer(true | false, at)`, `next`, `tick(now)`, `visibility(hidden | visible, at)`, `abandon`. Every event that depends on time carries the time; the engine never reads a clock.

Round phases: `question`, `answered` (verdict visible; Classic, Streak, Three lives), `stamped` (Timed only: the verdict stamp for 700 ms, then the next question; also the state after time is up, until the result is opened), `finished`.

### Dealing

Input: the cards of the chosen route (a section or the whole deck), the mode, the card history.

Priority when choosing cards:

1. Cards last answered wrong, at most three in each chunk of ten cards dealt (a Classic round is one chunk; see below for the unbounded modes).
2. Cards never seen.
3. Cards seen longest ago.

Constraints:

- No two cards that share a conflict group within one Classic round; in the unbounded modes, not within the last ten cards dealt.
- In each chunk of ten cards dealt, between four and six have the answer True. The balance holds per chunk, not for any ten cards in a row: across the join of two chunks, ten cards in a row can hold from two to eight True.
- Order is random, with at most three equal answers in a row (this one holds across the join of two chunks too).

If the constraints cannot all be met from the available cards, they are relaxed in this order: recency, then conflict groups, then answer balance (in the unbounded modes an overdue card, below, goes in whatever its conflict groups and answer). The unbounded modes deal in chunks of ten and, when every card of the route has been dealt in the round, continue with the cards seen longest ago.

A chunk is ten cards, or as many as may be dealt. The cards the round has not shown come first; behind them stand the cards it showed longest ago, and a card never comes back within the last ten cards dealt (or all the other cards of a smaller route). Recency gives way first here too: a card comes back in place of an unshown card that would repeat a conflict group or tip the balance, and the chunk that uses up the route is filled with the cards shown longest ago. A chunk shares no conflict group with the ten cards dealt before it (unless the relaxation below needs it, as it can for a chunk that takes an overdue card and for the chunk right after it), and the run limit holds across the join of two chunks. On a route of twenty cards or fewer nothing can be chosen once the first ten are dealt: there conflict groups, the balance and the run limit give way where the forced cards break them, and the gap is kept. (On the 11 and 12 card sections of the built decks this gives runs of up to five equal answers where the route comes round again, and in theory up to seven.)

A card the round has still not shown is overdue once the round has dealt at least twice as many cards as the route has. A chunk dealt while a card is overdue is first chosen as above; if it holds no card the round has not shown, it is chosen again around one: the first of the unshown cards in priority order (missed cards within the cap, never seen, seen longest ago, then the missed cards over the cap) goes in whatever its conflict groups and answer, and the rest of the chunk is filled in rank order, the unshown cards first and then the cards the round may bring back, keeping every rule it can: conflict groups give way first, then the balance. That chunk can share a conflict group with the ten cards dealt before it; the gap before a card comes back and the run limit across the join hold as above. Without this rule a card can be locked out for good: a conflict group of one chunk keeps it out of the next, the balance keeps it out of the one after, and the round settles into those two chunks over and over. With it every card of the route is shown, late at worst.

### Modes

| Mode | Length | Ends | After an answer | Record per route |
|---|---|---|---|---|
| Classic | 10 cards | after card 10 | verdict, explanation, source, "Next card"; after the last card the action is "See results" | score out of 10 |
| Streak | unbounded | first wrong answer | same; after the ending answer the action is "See results" | longest streak |
| Three lives | unbounded | third wrong answer | same; after the ending answer the action is "See results" | cards answered |
| Timed | 60 seconds | time up | the verdict stamp only, for 700 ms, then the next card | correct answers |

Timed: the clock starts when the first card is shown, pauses while the page is hidden and stops at zero. The card on screen at zero is neither counted nor recorded. Timed shows no explanations during play; missed cards are reviewed on the result screen.

Timed: a tick counts at most one second, so a device that sleeps without reporting it does not lose the round. An answer given at or after zero does not count; if time runs out while the stamp of an answer is shown, that answer counts and the next card is the one that does not.

### Result

Every mode ends on a result screen with the mode's score, the comparison with the record for that route and mode (including a "New best" moment when it is beaten), the list of missed cards with their right answer and explanation, and two actions: play the same route and mode again, or choose another route.

### Leaving a round

The close control asks for one confirmation once at least one card has been answered; before the first answer it leaves at once, because there is nothing to lose. A round that is left before its deciding answer sets no record. A round that is left after it, or at time up, before its result is opened, is recorded exactly as opening the result would record it: its score, its record and its answers. Answers already given stay in the card history, also when the player leaves with the browser or system back gesture. A reload in the middle of a round does not resume it: a new round is dealt, the round that was reloaded sets no record, and the answers given before the reload stay in the card history. The same holds when the page goes away in the middle of a round (the tab is closed, the player goes to another site).

## 7. Progress

Stored on the device under one versioned key.

- Per card: times seen, whether the last answer was correct, when it was last seen.
- Per route and mode: the record. A route is a deck id plus a section id or "whole deck".
- The last route and mode played, with the score of that round when it was finished, for the "Continue" line on the start screen.

Deck "seen" percentage is the share of the deck's current cards that have been seen at least once. When a deck file changes, history is kept by card id and entries for cards that no longer exist are removed. If storage is unavailable or corrupt, the game still runs with empty progress and does not crash.

## 8. Input

Three inputs produce the same `answer` event: swiping the card, the True and False buttons, and the keyboard (left arrow False, right arrow True, Enter for the following action).

Swipe rules, all implemented as pure functions in `src/input`:

| Rule | Value |
|---|---|
| Commit | The card is released at least 90 px from its start. Dragging back inside that distance before release cancels. |
| Fling | A fast release commits only if the card has travelled at least 40 px in that direction. |
| Settle time | Input is ignored for 250 ms after a new card appears. |
| Direction | A gesture that is more vertical than horizontal is not a swipe. |
| Edges | A touch that starts within 24 px of the left or right screen edge is ignored. |

While dragging, the card shows which answer the drag is heading towards. There is no undo.

## 9. Interface

### Authority

The visual specification is the approved mockups and the design system documents, which move into this repository under `design/`:

- `design/system/tokens.json`: design tokens in the W3C Design Tokens format, day and night values.
- `design/system/DESIGN-SYSTEM.md`: principles, colour roles, typography, layout, the component inventory, motion and its SwiftUI and Compose mapping, accessibility, portability notes.
- `design/flow/screens/*.html`: the approved screens (start flow, the four game screens and their end states, the result screens, the night theme).

Where this document and those disagree on a visual value, the design documents win. Where they disagree on behaviour, this document wins.

### Tokens in code

A build script turns `tokens.json` into CSS custom properties and the Tailwind theme reads those properties. Components use tokens only, never raw colour values. The day values sit on `:root` and the night values override them under `prefers-color-scheme: dark`, so by default the theme follows the system setting. The night theme was planned for step 3 and was pulled forward after step 1 shipped; every screen has been checked in both themes, and both themes pass the same contrast gate.

### Theme switch

The player can also choose the theme. A round button at the top right of the start flow, on every start step (in line with the logo on step 1 and with the Back pill on later steps), flips the theme the player sees: day to night or night to day. It is not on the play or result screens, and there is no three-way menu or settings screen.

- **Default:** no choice; the theme follows the system setting and changes with it.
- **After a press:** the choice is remembered on the device and wins over the system setting from then on, on every screen and after a reload. It is stored in `localStorage` under `truthy.theme` as `light` or `dark`. Any other value, or storage that is missing or throws, means follow the system; the switch then still works for the current page.
- **On the page:** the choice is `data-theme="light"` or `data-theme="dark"` on `<html>` (no attribute: follow the system). The token build writes the night values under the dark system setting for `:root:not([data-theme=light])` and again for `:root[data-theme=dark]`; `color-scheme` follows the same three cases.
- **No flash:** an inline script at the start of `<head>` reads the stored choice and sets the attribute before the first paint, so a player who chose night never sees a day frame first. The pages stay statically prerendered.
- **Browser bar:** with a choice, the browser bar takes the chosen theme's top sky colour (`sky-1`); without one, the two theme-color tags follow the system as before.
- **Button:** the 48 px raised round button with a moon while the day theme is shown and a sun while the night theme is shown. Its accessible name states the action: "Switch to dark theme" or "Switch to light theme". It never takes the focus on its own and does not touch the start flow's steps or settle time.

### Typography

Overpass and Overpass Mono (SIL OFL 1.1), the four static weights the design uses, committed as woff2 files in `app/fonts/` with the OFL text and loaded with `next/font/local`, so they are served from the site and the build needs no network. Each file holds the latin characters and the arrows (← →) the screens draw.

### Screens

1. **Start**, the fill-in pass: the theme switch sits at the top right on every step (section 9, "Theme switch"). Step 1 shows the logo, one description line, the area cards and, for a returning player, one "Continue" line. Tapping "Continue" fills the pass with the last route and class and shows "Start round", so the player sees the route and can still change it; every round starts through the same "Start round" hand-off. Steps 2 to 5 (platform, deck, section, class) show the small pass with its filled fields above the options for the current step. Every step is shown even when it has a single option, with one exception: a deck without sections skips the section step and plays the whole deck. An area or platform without decks, and a class that is not built yet, are shown as not available and cannot be chosen. A deck whose review is not finished is not listed. Option presses are ignored for 250 ms after a step appears, so a double tap cannot choose an option the player has not seen. Back works at every step; a filled field returns to its step; Escape goes back a step like Back. The steps are kept in the browser history (the address does not change), so the browser's back and forward buttons move through them; "Start round" takes those entries out again, so back from `/play` is step 1. After the class is chosen, step 6, "Your pass is ready", shows the filled pass, the class's rule with the swipe in one sentence, and "Start round".
2. **Play**: the flight-path header in the variant of the mode, the boarding pass card with the statement, the stub with the swipe hint, the True and False buttons; then the answer state, or the stamp in Timed. A card with a non-empty `appliesTo` shows it in a small line above the statement: the qualifier alone, read as "Applies to ..." by a screen reader; it is never cut. The result's missed cards show the same line above their statements. The source link opens in a new tab. After an answer, "Next card" (or "See results") comes in where True and False were and takes presses only once it has arrived, 420 ms after the answer, so a double tap on an answer cannot skip the verdict. In Streak, the answer that takes the streak past a stored best gets a "New best" stamp on its answer slip, once per round. Escape is the close control ("Leaving a round", section 6).
3. **Result**: as described in section 6. Each missed card has a "Why" disclosure that opens its explanation and its source link. Its actions ("Play again", "Choose another route", the close button) ignore presses for one second after the result appears, so a second tap on "See results", which lies where "Choose another route" is, cannot leave the result before the player has seen it.

### Motion

Motion (the library) drives the start flow's transitions and the card's reveal. Card dragging is hand-written on pointer events because the swipe rules need exact control. Transitions use transforms and opacity, with four small exceptions: a missed card's "Why" row grows its height (`grid-template-rows`), the strike of a lost life draws its line (`pathLength`), the continue line darkens while pressed (`background-color`) and a pressed pill lowers its shadow (`box-shadow`). Every transition has a reduced-motion fallback (a cross-fade, or no transition), as specified in the design system.

### Accessibility

Buttons are a full alternative to swiping. True and False, and correct and wrong, are never distinguished by colour alone. Touch targets are at least 48 px. Focus is visible. The verdict is announced to assistive technology, and in Three lives and Streak so is a lost life and the end of the round. Text contrast is at least 4.5:1 in both themes.

### Installability

A web app manifest and icons ship in step 1 so the game can be added to the home screen. A service worker that makes the app and the cached decks work offline ships in step 3.

## 10. Error handling

| Situation | Behaviour |
|---|---|
| A deck fails validation at build time | The build fails with the card id and the reason. |
| `index.json` or a deck cannot be fetched | Use the cached copy if there is one; otherwise show a message and a retry action. |
| Storage unavailable, full or corrupt | Play continues with empty progress; nothing is thrown at the player. |
| `/play` opened without a pending round | Redirect to `/`. |
| An unknown address | The game's "Page not found" page, status 404, with "Back to start". |
| A route has too few cards for the constraints | Relax the constraints in the documented order; never fail to deal. |

## 11. Testing

| Gate | What it proves |
|---|---|
| `pnpm test` (Vitest) | Engine: dealing priority and constraints, the end rule and record of each mode, determinism under a seed, Timed pausing. Input: every swipe rule. Progress: history, records, deck changes, corrupt storage. Content: schemas, section mapping, conflict group integrity. The purity and import boundaries of the engine, the input rules and the progress rules; dealing in chunks. |
| `pnpm typecheck` | Strict TypeScript across app, scripts and tests. |
| `pnpm build` | The deck build and validation, then the Next.js build. |
| `pnpm e2e` (Playwright) | At phone size in Chromium and WebKit: the start flow to a finished Classic round and its result; each mode's ending; answering by swipe, button and keyboard; an accidental-swipe case that must not answer; reduced motion; a returning player's "Continue"; a whole round in the dark colour scheme, drawn with the night colours; the Timed clock pausing while the page is hidden; the back gesture in every mode. |

The engine and the input module are written test first. GitHub Actions runs all gates on every pull request. After each screen is implemented it is compared side by side with its mockup at 390 by 844.

## 12. Repository and deployment

One public GitHub repository. Commits use the owner's GitHub identity. The former content working folder (content pipeline and design files) moves into the repository as `content/` and `design/`, with local absolute paths in notes turned into relative ones. Vercel builds and deploys `main`; pull requests get preview deployments. The code is licensed under MIT (`LICENSE`), the card content under CC BY 4.0 (`content/LICENSE.md`), and the fonts are under the SIL Open Font License 1.1 (`app/fonts/OFL.txt`).

## 13. Open questions

- Whether to add the "Mis-swiped?" flag, after the first play test.
- A custom domain; none has been bought.
