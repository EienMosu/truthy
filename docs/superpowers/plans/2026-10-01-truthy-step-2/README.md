# Truthy step 2 (Streak, Three lives, Timed) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player can choose Streak, Three lives or Timed on the class step, play it to its end with its own header, ending action and (in Timed) stamp and clock, and see a result screen with the mode's score, the comparison with the record for that route and mode, and the missed cards.

**Architecture:** The engine stays one pure reducer: `src/engine/deal.ts` learns to deal a round chunk by chunk (ten cards at a time, no repeats until the route is used up), and `src/engine/round.ts` gets the three end rules, the `stamped` phase and a clock that only moves through `tick` and `visibility` events. The play screen reads the mode from the round and swaps the header, the lower part of the pass and the action row; the clock source and the page-visibility source live in `PlayServices` and are faked in tests. One mode table (`src/app-state/modes.ts`) feeds the start flow, the ticket and the result, and its `offered` flag is the only gate between a mode and the player.

**Tech Stack:** Next.js 16.3 (App Router, statically prerendered), React 19.2, TypeScript 5.9 (strict, `noUncheckedIndexedAccess`), Tailwind CSS 4, Motion, zod 4, Vitest 4 with Testing Library, Playwright (phone-sized Chromium and WebKit, with `page.clock` for the Timed minute), pnpm 10, Node 24.

**Spec:** `docs/superpowers/specs/2026-10-01-truthy-design.md` (sections 6 to 11 are binding). The visual authority is `design/system/DESIGN-SYSTEM.md`, `design/system/tokens.json` and the approved screens in `design/flow/screens/` (`game-streak`, `game-streak-record`, `game-lives`, `game-lives-out`, `game-timed`, `game-timed-up`, `result-streak`, `result-lives`, `result-timed`). Where they disagree: the specification wins, then DESIGN-SYSTEM.md, then the mockup.

## How this plan is organised

One file per task in this folder. Execute them in numeric order on the branch `step-2`; each task ends with all four gates green and all of its changes committed. Every command runs from the repository root.

| Task | File | Delivers | Tier |
|---|---|---|---|
| 1 | `01-baseline.md` | The base and the green baseline checked; the AWS Solutions Architect Associate deck pinned by a test that builds all four decks; the spec's catalog line | standard |
| 2 | `02-boundaries.md` | A test that enforces the purity and imports of `src/engine`, `src/input` and the progress rules; the types they share move to `src/content/play.ts` | standard |
| 3 | `03-shared.md` | One mode table, one session-storage reader, `PlayServices extends AppServices`, one route lookup, shared `pad2` and easing constants, one "save a left round" helper, one record comparison, logged load errors | standard |
| 4 | `04-chunks.md` | `dealChunk`: unbounded dealing in chunks of ten, unshown cards first and then the cards shown longest ago, the run limit across a join, every rule kept on routes like the real ones past the end of the route | most capable |
| 5 | `05-modes.md` | The round keeps its deal source; Streak and Three lives end rules, `isDecided`, the score of each mode; record and card history tests per mode | most capable |
| 6 | `06-clock.md` | Timed in the engine: `tick`, `visibility`, the `stamped` phase, pausing, time up | most capable |
| 7 | `07-ending.md` | Play screen: "See results" after the deciding answer, the Card field without a total, selectable explanation; leaving pinned as unchanged, on a decided round too | standard |
| 8 | `08-play-streak.md` | Streak header, the best on the ticket, "New best" on the slip | standard |
| 9 | `09-play-lives.md` | Three lives header: hearts, trail, the last life | standard |
| 10 | `10-play-timed.md` | Timed play: clock and visibility services, the Timer header, the stub stamp, the stamp beat, time up with a "See results" that takes taps | most capable |
| 11 | `11-results.md` | The result screen of each mode: completed header, fields, score block, "New best" | standard |
| 12 | `12-enable.md` | The three classes can be chosen on the start flow; the continue line per mode | standard |
| 13 | `13-e2e-docs.md` | End-to-end specs of each mode's ending in both browsers, night and reduced motion, the mockup comparison, the documents | most capable |

The engine code of tasks 2, 4, 5 and 6 (the purity scanner, `dealChunk`, the reducer and their tests) was run in a throwaway copy of `src/engine` before it was written down, and again after the plan's review changed tasks 4 to 6: the tests in those files passed (22 in `chunks.test.ts`, 21 in `modes.test.ts`, 23 in `timed.test.ts`), and the existing `tests/engine` suites passed against it except the cases those tasks tell you to change. The dealing of task 4 was also measured on the four built decks (its file gives the numbers), and the test block of task 1 was run. Playwright's `page.clock` (`install`, `runFor`, `fastForward`) was tried against the step 1 build in both browsers. The component code is described, not pre-run. If a step's actual output differs from the stated one, stop and find out why before going on.

### Before task 1 (the controller, not the executor)

This plan was written on a `step-2` that did not contain `origin/main`. `main` has two fixes the tasks build on: the Safari repaint fix in `components/FillInPass.tsx` (task 3 edits that file) and the effect fix in the helpers of `tests/components/play/PlayScreen.test.tsx` (tasks 7 to 10 copy those helpers). It also has the SAA review file with its repository-relative path, so the baseline is green there.

- `step-2` must contain `origin/main`: `git merge-base --is-ancestor origin/main HEAD` succeeds.
- If it does not, do not merge `main` into `step-2`: the old base of the branch is not part of the published history and must not come back into it. Move the plan's commit onto `origin/main` instead (`git rebase --onto origin/main step-2~1 step-2` while the plan commit is the only commit to keep), or recreate the branch from `origin/main` and cherry-pick that commit. The executor may not switch branches or rewrite history, so this happens before it starts.
- All four gates are green before the first change. Task 1, step 1 checks both points and stops if either fails.

## Global Constraints

Still in force from step 1:

- Versions: next 16.3.8, react and react-dom 19.2.8, typescript 5.9.3, tailwindcss 4.3.3, vitest 4.1.11, zod 4.6.5, motion 13.4.6, @playwright/test 1.63.0, pnpm 10, Node 24. Do not upgrade while executing this plan, and add no dependency.
- No server code: no API routes, no server actions, no database, no environment secrets. Every route is prerendered.
- Module boundaries: `src/engine` and `src/input` import nothing from React, the DOM, storage, `Date` or `Math.random`. Dependencies point only downwards in the spec's module table (section 4). From task 2 on a test enforces this.
- Components use the generated CSS variables only. No raw colour values in components (`tests/components/no-raw-colours.test.ts`).
- Accessibility floor: text contrast at least 4.5:1, touch targets at least 48 px, visible focus, nothing communicated by colour alone, `prefers-reduced-motion` removes movement and every end state is correct without its animation, buttons and keyboard are full alternatives to swiping.
- Swipe rules, exact values: commit at 90 px on release, fling needs 40 px travel, input ignored for 250 ms after a new card or a new start step appears, mostly vertical gestures are not swipes, touches starting within 24 px of the screen edge are ignored. There is no undo.
- Motion: transforms and opacity only, imported from `motion/react`. The two documented exceptions are the Why disclosure (row height) and the strike through a lost heart (stroke length, task 9).
- UI copy: English, sentence case, exactly as written in the task files. Code comments and docs: plain English.
- Test first: every behaviour gets a failing test before its implementation. Tests live in `tests/` mirroring the source path; end-to-end specs in `e2e/`.
- Commits: small, conventional prefix (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`), authored as `EienMosu <EienMosu@users.noreply.github.com>`, no co-author or tool attribution lines.
- The repository is public: nothing tracked may contain a local absolute path, a personal e-mail address or a secret (`tests/repo-hygiene.test.ts`).

New in step 2:

- Both themes must work. Every new element takes its colours from the roles in `design/system/tokens.json`, so night is the token remap; the theme switch specs (`e2e/theme.spec.ts`), the night spec (`e2e/night.spec.ts`) and the contrast gate (`tests/tokens/contrast.test.ts`) stay green in every task, and a new text colour on a new paper gets its pair in the contrast gate (task 10 adds one).
- `main` is production, so the branch must be shippable at every task boundary: all four gates green (`pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e`) and no half-built mode in front of a player. An unfinished mode stays "Not available yet" on the class step (`offered: false` in the mode table) until task 12 makes it playable. The class step is the gate: from task 5 on `/play` plays any mode the engine can play, and a player can only get a mode into the pending round through the class step.
- Engine purity is non-negotiable: time enters the engine only on events (`answer.at`, `tick.now`, `visibility.at`), randomness only through the seed given to `startRound`. The same seed and the same events give the same round. The clock source (`ticker`, `now`) and the visibility source live in `PlayServices` and are injected in tests.
- Before `pnpm e2e` make sure nothing is listening on port 3100 (`lsof -ti :3100 | xargs kill`), so the run builds the code as it is now.
- Publishing (push, merge, deploy) is not part of this plan: the controller does it. Offline play is step 3.
- The AWS Solutions Architect Associate deck is not a step 2 feature: it is in the catalog and its commit is on `main`, so it reaches the app through `main`'s deploy. Task 1 only pins it in a test and names it in the spec.

## Review Focus

The five inputs and conditions most likely to bite a player in the new modes, most likely first. Each is pinned by the tests named.

1. **The Timed clock while the page is hidden or the phone sleeps.** A notification, an app switch or a locked screen must pause the clock and resume it where it was, and a wake-up without a visibility event must not eat the minute. Task 6: "pauses while the page is hidden and goes on from where it was", "holds the stamp while the page is hidden", "counts a gap of more than a second between two ticks as one second". Task 10: "pauses the clock while the page is hidden". Task 13, `e2e/timed.spec.ts`: "the clock pauses while the page is hidden" and "a jump of the clock costs at most a second".
2. **A tap at the moment a round ends.** "See results" comes in where True and False were. A second tap on the answer that ends a Streak or the third life, or a tap as the Timed clock reaches zero, must not skip the verdict; and once it has arrived, "See results" must take a real tap. Task 7: "a second tap within 420 ms of the deciding answer does not open the result". Task 10: "a tap right after time is up does not open the result", "See results takes taps once it has arrived", "a drag that is under way when time runs out springs back and answers nothing", "ignores True and False during the stamp". Task 13, `e2e/streak.spec.ts`: "a double tap on the wrong answer keeps the verdict"; `e2e/timed.spec.ts` presses "See results" with a real click after time up.
3. **Leaving in each mode.** The back gesture keeps the answers in the card history and sets no record; the close button asks first once a card is answered. This is the same mid-round and on a round that is already decided (the wrong answer of a Streak, the third lost life, time up, Classic's last answer): only "See results" finishes a round. A player who swipes back on the verdict of a long Streak loses that score; this is the spec as written, and the proposal to change it is under "Left to the owner". Task 5: "leaving a round". Task 7: "leaving mid-round asks and sets no record", "leaving a decided round asks too and sets no record", "unmounting on a decided round keeps the answers and sets no record", "Keep playing on a decided round returns to See results, which then records the round". Task 10: "leaving at time up sets no record, like leaving earlier". Task 13, `e2e/leave.spec.ts`: "back in the middle of a round keeps the answers and sets no record, in every mode" and "back on a decided Streak round keeps the answers and sets no record".
4. **Running out of cards in an unbounded mode.** The smallest sections have 11 and 12 cards; a good Streak passes that, and a long Three lives round passes the 45 to 54 cards of a usual section. The round must never fail to deal, never bring a card back within the last ten, and on a route of more than twenty cards keep conflict groups apart, the balance and the run limit also where the route ends and after it. Task 4: "never deals an empty chunk and never more than ten", "brings a card back only after min(10, size - 1) other cards", "on a route like a real section keeps every rule for 150 cards and shows every card", "brings a card back rather than deal a card whose conflict group is among the last ten", "on a route of 11 or 12 cards keeps the gap and lets the run limit give way where the route wraps". Task 5: "never runs out of cards on an 11 card route", "a card answered twice in one round counts two sightings and keeps the later verdict". Task 13, `e2e/lives.spec.ts`: "an eleven card section goes on after its last card".
5. **The record comparison.** A score equal to the record is not a new best, a first round shows no "New best", a stored best of 0 is not a best to beat on the slip, and a record kept from before a deck update still counts. Task 5: "equalling a Streak record is not a new best", "a first Timed round with no correct answer sets the record 0". Task 8: "shows New best only on the answer that passes a stored best", "shows no New best on the slip after a stored best of 0". Task 11: "Streak: Equals your best", "a record stored before the deck changed still counts".

Also worth a reviewer's eye, covered by tests: a tick that arrives after time is up or after the round was left returns the very same state (task 6); an answer that arrives at or after zero does not count (task 6); the Timed stamp, the lost heart and the Time is up stamp at rest under reduced motion (tasks 9 and 10, `e2e/timed.spec.ts`); the purity scanner really fails on a planted `Date.now()` (task 2).

## Decisions made in this plan

Each closes an open question of the design map or a place where a mockup and DESIGN-SYSTEM.md disagree. The owner can overrule any of them; the task that implements it is named.

Engine and rules:

1. **The Timed stamp holds 700 ms**, not the 1000 of the mockup and the `hold-timed` token: spec section 6 says "about 700 ms" and the spec wins on behaviour (task 6; task 13 updates the token and the design system).
2. **Time up is the `stamped` phase with the clock at zero**, not a fifth phase: the Time is up stamp is a stamp, and the spec lists four phases. "See results" (`next`) finishes the round (task 6).
3. **Time running out during a stamp keeps that answer** (it was given before zero) and moves on to the next card, which is the one that "doesn't count". An answer whose time is at or after zero does not count (task 6).
4. **A gap of more than one second between two ticks counts as one second**: a phone that sleeps without a visibility event must not lose the round (task 6).
5. **`visibility` carries the time of the event** (`at`), as `answer` already does: hiding counts the time up to that moment, showing starts counting from it (task 6).
6. **The clock runs during the stamp and while the "Leave round?" sheet is open.** The spec pauses it only while the page is hidden (tasks 6 and 10).
7. **A decided round is left like any other round.** After the deciding answer or at time up the close button still asks once a card is answered, and leaving (also by the back gesture) keeps the answers and sets no record; only "See results" finishes a round. This is spec section 2 ("do not reopen") and section 6 as written, and what Classic does today after its tenth answer. The first version of this plan counted such a round as finished; that is now a proposal under "Left to the owner" (tasks 5, 7, 10, 13).
8. **"See results →" is the action on every decided card, Classic's last card included** (the step 1 review asked for it; the spec's Classic cell names the action after an ordinary answer) (task 7).
9. **A chunk is ten cards, or as many as may be dealt.** The cards the round has not shown come first, ranked by the stored history; behind them stand the cards it showed longest ago. A card never comes back within `min(10, route size - 1)` cards. The chunk that uses up the route is filled with the cards shown longest ago (a 47 card route deals its last seven cards together with three of its first ten), so a route of twenty cards or more always deals ten; an 11 card route deals ten, then one card per chunk in its first order. The stored card history ranks the unshown cards only (task 4).
10. **The conflict window is the ten cards before the chunk**, plus the chunk itself: stricter than a sliding window of ten. **Recency gives way first, as the spec orders:** an unshown card that would repeat a conflict group of that window, or tip the balance, waits for a later chunk, and a card shown long ago comes back in its place. Measured on the built decks, every route of more than twenty cards keeps the conflict window, the balance and the run limit for as long as a round goes on; the price is that the last unshown card of a route with a large conflict group can come late (after 61 to 100 cards on the 45 card section with a group of four) (task 4).
11. **Chunk k is dealt with the seed `(seed + k × 0x9e3779b9) mod 2³²`**; chunk 0 uses the seed itself, so a Classic round deals exactly as in step 1 (task 5).
12. **Scores:** Streak is the longest run of correct answers, Three lives is the cards answered including the one that cost the last life, Timed and Classic are the correct answers (task 5).
13. **The class step is the gate for an unfinished mode**; `/play` plays any mode the engine can play (tasks 3, 5, 12).
14. **The types the engine and the progress share live in `src/content/play.ts`** (`Mode`, `CardHistory`, `History`, `Answered`, `RoundResult`), so `src/progress` no longer imports the engine, as the spec's module table demands (task 2).

Play screens:

15. **Streak header for any best.** While the best is still ahead, slot i sits at `t = i / (best - 1)` and the ring ends the route (the mockup's 24 px spacing is the case best = 12). At or past the best, and without a best, the route runs on into open sky (`t = i / (cards + 1.6)`). Dots shrink with the mockup's record rule `min(6, 0.31 × gap)`, ticks from radius 5 (task 8).
16. **No best yet, or a best of 0: no ring and no right label** in the Streak header (no copy is designed for it; a stored 0 comes from a first round lost on its first card and is nothing to fly towards) (task 8).
17. **"New best" on the slip appears once**, on the answer that takes the streak to best + 1, and only when a best of at least 1 existed. Three lives and Timed show New best only on the result (task 8).
18. **Hearts are lost from the right** (the mockups; DESIGN-SYSTEM.md's "third heart" is the last one left). Every lost life draws its slash (300 ms, delay 380), not only the last, so no heart changes before the stamp lands (task 9).
19. **Lives trail:** up to 14 marks keep the 9 px spacing with the newest at x 219; from 15 on they compress between x 100 and 219 as in `game-lives-out`; with no mark only the plane and the dotted continuation are drawn (task 9).
20. **The stub stamp lands from scale 1.9** (the one landing DESIGN-SYSTEM.md documents), not the mockup's 1.8. Its icons are check 24 and X 20 (DESIGN-SYSTEM.md gives the check; the X size is only in the mockup) (task 10).
21. **Timed hint lines** come from the mockup: "Next card coming up" and "Missed, saved for review at the end"; at time up "This card doesn't count · N answered" (task 10).
22. **"See results" at time up enters like every Next row** (220 ms, delay 360, DESIGN-SYSTEM.md 5.7), not with the mockup's delay 300 (task 10).
23. **The clock reads `m:ss` from the seconds rounded up:** "1:00" at the start, "0:41", "0:00" (task 10).
24. **The Timed header keeps the plane during the stamp** (it has no per-card marks); every header's accessible label is rewritten after each answer (tasks 8 to 10).
25. **Focus:** "See results" takes focus like "Next card" (at 420 ms). At time up it takes focus only if True or False had it. In Timed the statement takes focus on the first card only; later cards are announced as "Card N. <statement>" by a polite, atomic live region that stays mounted outside the card (the statement itself is not live, since the card is replaced on every deal) (tasks 7 and 10).
26. **Timed announces only "Correct." or "Not quite."** to screen readers, without the answer: Timed shows no explanations during play (task 10).
27. **The tear direction stays as in Classic** (left when correct, right when wrong); only the Timed card leaves toward the answered side (task 10).
28. **The explanation can be selected:** the card is `select-none` only while it can be dragged (task 7).

Results and start flow:

29. **Completed header marks:** scale 1 up to 10 cards, 6/7 up to 17, then radius `min(6, 0.35 × 264 / (n - 1))`; ticks from radius 5, the x in a wrong square from side 6 (task 11).
30. **The Streak result rings the card where the previous best was reached**, as the mockup draws it (task 11).
31. **Comparison copy per mode:** "First round on this route", "N short of your best", "Equals your best" in every mode; the record reads "9 / 10" (Classic), "12" (Streak), "21 cards" (Three lives), "11" (Timed). A new best in Three lives gets the same stamp as the others (task 11).
32. **Result field numbers are padded to two digits everywhere** ("Cards 14", "Missed 01", "Correct 07") (task 11).
33. **A Timed round without an answer** shows "Time up · 0 cards", "0 of 0" and the calm "No missed cards" line (task 11).
34. **The result header's accessible label says how the round ended and what was missed; the comparison is said once, by the score block** (the three mockups disagree on this) (task 11).
35. **The score has no `aria-label`**: its label and text read "Correct 14 of 17" (task 11).
36. **Continue line:** "last 7 of 10" (Classic), "last 13 in a row", "last 21 cards", "last 14 correct". The Timed class card's unit is "correct" (task 12).
37. **Each class shows its own header from card 1** (Streak 0, three full hearts, 1:00 left): `/play` draws the header of the mode, so the start flow's hand-over needs no change (tasks 8 to 10).
38. **On a route of twenty cards or fewer the rules give way and the gap does not** (engine; it belongs with decisions 9 and 10). Once the first ten cards are dealt, the cards that may be dealt are exactly as many as the chunk (one card on the 11 card sections), so nothing can be chosen: conflict groups, the balance and the run limit give way where the forced cards break them (runs of up to five equal answers on the real 11 and 12 card sections where the route comes round again, and in theory up to seven, as the spec says). The spec names recency as the first rule to relax and does not name the run limit at all; this plan keeps the gap of decision 9 instead, because a card shown a few cards ago gives its answer away more surely than a conflict group, an unbalanced ten or a fourth equal answer does. Task 13 writes it into the spec (tasks 4 and 13).

## Left to the owner

Nothing here blocks the tasks: the plan is executable as written. Each point is a call the plan does not make on its own.

1. **Proposal: a decided round that is left counts as finished.** Today's rule (decision 7) lets a player lose the score of a finished Streak by swiping back on its verdict instead of pressing "See results". The change would be: the engine gets `leaveRound` (a decided round is finished as it stands, any other round is abandoned), `saveLeftRound` uses it, the close button skips the sheet on a decided round; the leaving cases of tasks 5, 6, 7, 10 and of `e2e/leave.spec.ts` flip, and task 13 rewords the "Leaving a round" row of spec section 2 and the paragraph of section 6. It needs an explicit yes because section 2 is headed "do not reopen" and because it also changes what Classic does today when it is left after its tenth answer.
2. **Decision 8 changes shipped Classic copy**: its last card reads "See results" instead of "Next card". The step 1 review asked for it. With a no, rule 1 of task 7 applies to Streak and Three lives only and the e2e helper change of that task falls away.
3. **Two SAA cards** whose wording changed after the fact check (`aws-saa-c03-s4.4-02`, `aws-saa-c03-s4.4-11`) still lack an independent re-check. They ship with the deck.
4. **No night mockups exist** for the nine new screens. Task 13 compares day against the mockups and checks night by the tokens, the contrast gate and the night spec.
