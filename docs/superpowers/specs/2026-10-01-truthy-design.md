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
| Stack | Next.js like The Slow Wire, on Vercel | user |
| Decks | Static JSON built from the repository, no API key, no runtime server | approved recommendation |
| Repository | One repository, public | user |
| Accidental swipes | Prevention rules only in v1. A "Mis-swiped?" flag is reconsidered after the first play test | user |
| Leaving a round | One confirmation once a card has been answered; the round sets no record; card history is kept | approved recommendation |
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

The same skeleton as The Slow Wire: Next.js 16 (App Router), React 19, TypeScript in strict mode, Tailwind CSS 4, zod, Vitest, pnpm, deployed on Vercel from `main`. Two additions: Motion for transitions, Playwright for end-to-end tests.

### Rendering

Every route is prerendered at build time. The game is client components. There are no API routes, no server actions, no database and no environment secrets.

### Routes

| Route | Purpose |
|---|---|
| `/` | The start flow: area, platform, deck, section, class, then "Start round". One screen that steps through its states. |
| `/play` | The round and its result. The chosen route and class are read from the store; opening `/play` without a pending round redirects to `/`. |

### Modules

Each module has one job and a narrow interface. Dependencies only point downwards in this table.

| Module | Job | May depend on |
|---|---|---|
| `src/content` | zod schemas and types for the catalog and decks; loading and caching deck files | nothing |
| `src/engine` | Dealing a round, the mode rules, scoring. Pure TypeScript: no React, no DOM, no storage, no clock or randomness of its own | `content` types |
| `src/progress` | Card history, records, last route. An interface plus a local storage implementation | `content` types |
| `src/input` | Swipe interpretation: pure functions that turn pointer samples into "cancel", "true" or "false" | nothing |
| `components` | The design system's components | design tokens |
| `app` | Routes; wires the modules together | all of the above |

`engine` and `input` being pure is deliberate: they are fully unit-testable, and they are the reference that the Swift and Kotlin clones translate line by line. `progress` sitting behind an interface is what lets the native apps put iCloud key-value storage or Play Games behind the same contract.

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

### Build step

`scripts/build-decks.ts` runs before `next build`. It reads `content/catalog.json` and `content/reviewed/*.json`, validates both with zod, checks that every card maps to exactly one section and that every `conflictGroups` member exists, and writes `public/decks/`. Any validation failure fails the build, so a broken deck cannot be deployed.

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

Card ids are stable for the life of a card. Pipeline-only fields (misconception, factKey, topic, tags, volatility, revision) are not shipped. `appliesTo` is shown on the card when it is not empty (for example "Next.js 16 with cacheComponents: true").

### Loading

The app fetches `index.json` on start and a deck file when a round on that deck starts. Both are cached on the device; a deck is fetched again only when its `hash` in the index differs from the cached one. A fetch that fails or does not answer within a few seconds falls back to the cached copy; without one, the screen that needed the data shows a plain message with a retry action.

## 6. Game engine

### Shape

A reducer: `next(state, event) -> state`. Randomness comes from a seeded generator passed in at the start of a round; time comes in through events. The same seed and the same events always produce the same round.

Events: `answer(true | false, at)`, `next`, `tick(now)`, `visibility(hidden | visible, at)`, `abandon`. Every event that depends on time carries the time; the engine never reads a clock.

Round phases: `question`, `answered` (verdict visible; Classic, Streak, Three lives), `stamped` (Timed only: the verdict stamp for 700 ms, then the next question; also the state after time is up, until the result is opened), `finished`.

### Dealing

Input: the cards of the chosen route (a section or the whole deck), the mode, the card history.

Priority when choosing cards:

1. Cards last answered wrong, at most three per ten cards dealt.
2. Cards never seen.
3. Cards seen longest ago.

Constraints:

- No two cards that share a conflict group within one Classic round; in the unbounded modes, not within the last ten cards dealt.
- In every ten cards dealt, between four and six have the answer True.
- Order is random, with at most three equal answers in a row.

If the constraints cannot all be met from the available cards, they are relaxed in this order: recency, then conflict groups, then answer balance. The unbounded modes deal in chunks of ten and, when every card of the route has been dealt in the round, continue with the cards seen longest ago.

A chunk is ten cards, or as many as may be dealt. The cards the round has not shown come first; behind them stand the cards it showed longest ago, and a card never comes back within the last ten cards dealt (or all the other cards of a smaller route). Recency gives way first here too: a card comes back in place of an unshown card that would repeat a conflict group or tip the balance, and the chunk that uses up the route is filled with the cards shown longest ago. A chunk shares no conflict group with the ten cards dealt before it, and the run limit holds across the join of two chunks. On a route of twenty cards or fewer nothing can be chosen once the first ten are dealt: there conflict groups, the balance and the run limit give way where the forced cards break them, and the gap is kept. (On the 11 and 12 card sections of the built decks this gives runs of up to five equal answers where the route comes round again, and in theory up to seven.)

### Modes

| Mode | Length | Ends | After an answer | Record per route |
|---|---|---|---|---|
| Classic | 10 cards | after card 10 | verdict, explanation, source, "Next card"; after the last card the action is "See results" | score out of 10 |
| Streak | unbounded | first wrong answer | same; after the ending answer the action is "See results" | longest streak |
| Three lives | unbounded | third wrong answer | same; after the ending answer the action is "See results" | cards answered |
| Timed | 60 seconds | time up | stamp only, next card at once | correct answers |

Timed: the clock starts when the first card is shown, pauses while the page is hidden and stops at zero. The card on screen at zero is neither counted nor recorded. Timed shows no explanations during play; missed cards are reviewed on the result screen.

Timed: a tick counts at most one second, so a device that sleeps without reporting it does not lose the round. An answer given at or after zero does not count; if time runs out while the stamp of an answer is shown, that answer counts and the next card is the one that does not.

### Result

Every mode ends on a result screen with the mode's score, the comparison with the record for that route and mode (including a "New best" moment when it is beaten), the list of missed cards with their right answer and explanation, and two actions: play the same route and mode again, or choose another route.

### Leaving a round

The close control asks for one confirmation once at least one card has been answered; before the first answer it leaves at once, because there is nothing to lose. A round that is left sets no record. This holds in every state of a round: after the deciding answer or at time up the round is still left without a record, and only "See results" finishes it. Answers already given stay in the card history, also when the player leaves with the browser or system back gesture. A reload in the middle of a round starts a new round; answers given before the reload are not kept.

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

Overpass and Overpass Mono (SIL OFL), static weights, loaded with `next/font` so they are served from the site.

### Screens

1. **Start**, the fill-in pass: the theme switch sits at the top right on every step (section 9, "Theme switch"). Step 1 shows the logo, one description line, the area cards and, for a returning player, one "Continue" line. Tapping "Continue" fills the pass with the last route and class and shows "Start round", so the player sees the route and can still change it; every round starts through the same "Start round" hand-off. Steps 2 to 5 (platform, deck, section, class) show the small pass with its filled fields above the options for the current step. Every step is shown even when it has a single option, with one exception: a deck without sections skips the section step and plays the whole deck. An area or platform without decks, and a class that is not built yet, are shown as not available and cannot be chosen. A deck whose review is not finished is not listed. Option presses are ignored for 250 ms after a step appears, so a double tap cannot choose an option the player has not seen. Back works at every step; a filled field returns to its step. After the class is chosen, "Start round" appears.
2. **Play**: the flight-path header in the variant of the mode, the boarding pass card with the statement, the stub with the swipe hint, the True and False buttons; then the answer state, or the stamp in Timed. A card with a non-empty `appliesTo` shows it as one small line above the statement. The source link opens in a new tab.
3. **Result**: as described in section 6.

### Motion

Motion (the library) drives the start flow's transitions and the card's reveal. Card dragging is hand-written on pointer events because the swipe rules need exact control. Every transition uses transforms and opacity only and has a reduced-motion fallback (a cross-fade), as specified in the design system.

### Accessibility

Buttons are a full alternative to swiping. True and False, and correct and wrong, are never distinguished by colour alone. Touch targets are at least 48 px. Focus is visible. The verdict is announced to assistive technology. Text contrast is at least 4.5:1 in both themes.

### Installability

A web app manifest and icons ship in step 1 so the game can be added to the home screen. A service worker that makes the app and the cached decks work offline ships in step 3.

## 10. Error handling

| Situation | Behaviour |
|---|---|
| A deck fails validation at build time | The build fails with the card id and the reason. |
| `index.json` or a deck cannot be fetched | Use the cached copy if there is one; otherwise show a message and a retry action. |
| Storage unavailable, full or corrupt | Play continues with empty progress; nothing is thrown at the player. |
| `/play` opened without a pending round | Redirect to `/`. |
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

One public GitHub repository. Commits use the owner's GitHub identity. The existing working folder (`~/Desktop/cloud-cards`: content pipeline and design files) moves into the repository as `content/` and `design/`, with local absolute paths in notes turned into relative ones. Vercel builds and deploys `main`; pull requests get preview deployments. The licence for code and for card content is decided when the repository is published.

## 13. Open questions

- The licence (section 12).
- Whether to add the "Mis-swiped?" flag, after the first play test.
- A custom domain; none has been bought.
