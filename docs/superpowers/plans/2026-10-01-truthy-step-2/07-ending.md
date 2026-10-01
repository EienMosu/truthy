### Task 7: The deciding answer on the play screen

The play screen learns the parts of the new modes that are the same for all of them (spec section 6: "after the ending answer the action is 'See results'"): the action after a deciding answer reads "See results →", the Card field shows no total outside Classic (design system 5.4: "01 / 10" for Classic, "01" for the others), and the explanation on the slip can be selected. Leaving a round does not change, and this task pins that it does not: a round whose deciding answer has been given is still left like any other round (spec sections 2 and 6). The headers of the three modes come in tasks 8 to 10; until then a Streak or Three lives round on `/play` (reachable in tests only) shows the Count header.

**Files:**
- Modify: `components/play/PlayScreen.tsx`
- Modify (e2e, the label of Classic's last card): `e2e/helpers.ts` (`waitForCard`, `playRound`, `expectUnanswered`), `e2e/small-screens.spec.ts` (the loop that plays cards 2 to 10)
- Test: create `tests/components/play/PlayScreenEnding.test.tsx`; modify `tests/components/play/PlayScreen.test.tsx`, `tests/components/play/PlayScreenResult.test.tsx`, `tests/components/play/leave.test.ts`, `tests/components/play/fixtures.ts`

**Interfaces:**
- Consumes:
  - Tasks 5 and 6, `src/engine/round.ts`: `isDecided(state: RoundState): boolean`, `summarise`, `lastAnswer`, `currentCard`.
  - Task 3: `saveLeftRound(round: RoundState, store: ProgressStore): void` (`components/play/leave.ts`, unchanged here), `pad2` (`components/format.ts`), `EASE` (`components/easing.ts`).
  - `components/play/PlayScreen.tsx` as it is: `NEXT_ARRIVES_MS = 420`, `RoundView` with `answer`, `next`, `requestLeave`, the `unsaved` ref and `leave` in `PlayScreen`.
  - `tests/components/play/fixtures.ts`: `harness(pending?, local?)`, `DECK_ID`, `DECK` (section SEC: 12 cards, six True).
  - `tests/components/play/PlayScreen.test.tsx` as it is on `main`: the helper `start`, which waits for the True button, then runs `await act(async () => {})` so that React has run the effects of that render (the key listener and the settle time start there), then advances the clock by 1000; `answerAndNext` does the same after "Next card". Every new test file of tasks 7 to 10 copies these helpers with the `act` line: without it a key pressed right after the render can reach no listener on a slow machine.
- Produces:

```ts
// tests/components/play/fixtures.ts
export function pendingFor(mode: Mode, sectionId?: string): PendingRound;   // { route: { deckId: DECK_ID, sectionId: "SEC" }, mode }
```

  - Accessible names later tasks and the e2e specs rely on: the action button is "Next card" or "See results" (same element, same place); the header button stays "Leave round".

**Rules:**

1. **The action label.** After an answer the action row shows one ink pill with the trailing "→": "See results" when `isDecided(round)`, otherwise "Next card". This holds in every mode: Classic's last card, the wrong answer of a Streak, the third wrong answer of Three lives. It is the same button as today (same ref, same position, same entry: rises 12 px, 220 ms, delay 360, `EASE`).
2. **The double-tap guard is unchanged and covers "See results":** the row takes no presses and Enter does nothing until `NEXT_ARRIVES_MS` (420) after the answer, on the answer's clock, also with reduced motion. Focus moves to it at 420 ms (at once with reduced motion). Enter anywhere but on a link or a button presses it.
3. **The Card field** of the pass is `` `${pad2(index + 1)} / ${pad2(cards.length)}` `` in Classic and `pad2(index + 1)` in the other modes. The stub's "Card NN" is unchanged.
4. **Leaving is unchanged, in every mode and in every state of a round.** No code changes for it; the tests below pin it for the new states.
   - No answer yet: the close button leaves at once and nothing is saved.
   - Once a card has been answered, also on a decided round: the "Leave round?" sheet ("Your answers so far stay in your history. This round won't set a record."). "Keep playing" returns to the card, where "See results" still waits. "Leave round" saves the round as abandoned: the answers go into the card history, no record, `last` without a score.
   - The back gesture (the screen unmounts) saves by the same rule, without a question: abandoned, on a decided round too.
   - Only "See results" finishes a round and lets it set a record.
5. **Selecting text.** The swipe wrapper (`[data-swipe-card]`) carries `select-none` while the card can be dragged or is being stamped (phases `question` and `stamped`) and `select-text` in the phase `answered`, so the explanation and the source title can be selected and copied. The swipe is off in that phase already.
6. Nothing else changes: the header is still the Count `FlightPath`, the slip, the tear, the jolt and the live region are as in Classic.

**Tests:**

`tests/components/play/fixtures.ts`: add `pendingFor`.

`tests/components/play/PlayScreen.test.tsx` and `PlayScreenResult.test.tsx`: the helpers `pressNext` and `answerAll` find the action by `{ name: /^(Next card|See results)$/ }`. In "finishes the round after the tenth card and shows its result" add before `pressNext()`: `expect(screen.getByRole("button", { name: "See results" })).toBeTruthy(); expect(screen.queryByRole("button", { name: "Next card" })).toBeNull();`. In "fills the ticket with the route, the class and the card number" the Classic fields stay `["Classic", "01 / 10", "F ← → T"]`.

`tests/components/play/leave.test.ts`, added:
- "saves a decided round that is left as abandoned: the answers are kept, no record is set": a Streak round (three right answers with `next`, one wrong, no `next`) through `saveLeftRound` gives `records` `{}`, four cards with `seen: 1`, and `last` `{ route, mode: "streak", score: null, total: null }`.

`tests/components/play/PlayScreenEnding.test.tsx`, new (jsdom; the same mocks, `beforeAll` and helpers as `PlayScreen.test.tsx`: `start` with its `act` line, `statementText`, `currentAnswer`). Helpers: `give(right: boolean)` clicks the button that is right or wrong for the card on screen; `go()` waits for the action button, advances 420 ms and clicks it, then waits for the next True button, runs `await act(async () => {})` and advances 1000 ms.

Streak (`harness(pendingFor("streak"))`):
- "reads Next card after a right answer and deals on past the first ten cards": 11 times `give(true)` and `go()`; the Card field reads "12"; every action button was "Next card".
- "reads See results after the first wrong answer, and nothing else": `give(false)`; the button "See results" exists, "Next card" does not; the True and False buttons are gone.
- "a second tap within 420 ms of the deciding answer does not open the result": `give(false)`, advance 150, click "See results": the heading "Round complete" is absent and the verdict status still reads "Not quite. The answer is …"; advance 270 more, click: the heading appears.
- "Enter opens the result once See results has arrived".
- "moves focus to See results at 420 ms".
- "shows the Card field without a total": fields `["Streak", "01", "F ← → T"]`.

Three lives (`harness(pendingFor("lives"))`):
- "goes on with Next card after the first and the second wrong answer, and reads See results after the third": wrong, go, wrong, go, right, go, wrong; labels in order "Next card", "Next card", "Next card", "See results".

Classic:
- "reads See results on the last card of a one card route" (`pendingFor("classic", "APP")`): after the answer the only action is "See results".

Leaving (each asserts the stored progress under `PROGRESS_KEY` and `router.replace("/")`):
- "leaving mid-round asks and sets no record" (`it.each(["streak", "lives"])`): right, go, then "Leave round": the dialog "Leave round?" opens; "Leave round" in it: `records` is `{}`, one card has `seen: 1`, `last.score` is null.
- "leaving a decided round asks too and sets no record": Streak: right, go, right, go, wrong; click the header's "Leave round": the dialog opens; "Leave round" in it: `records` is `{}`, three cards have `seen: 1`, `last` is `{ ..., mode: "streak", score: null, total: null }`; the result heading never appears.
- "Keep playing on a decided round returns to See results, which then records the round": the same round, the dialog, "Keep playing" (wait for the dialog to go), then "See results" after 420: `records` `{ "test-deck/SEC#streak": 2 }`.
- "unmounting on a decided round keeps the answers and sets no record" (the back gesture): the same round, then `unmount()`: `records` `{}`, three cards with `seen: 1`.
- "does not save a round twice when it is left and then unmounts": leave through the dialog, then `unmount()`: every `seen` is still 1.
- "the result that See results opened is not undone by unmounting": right, wrong, "See results", `unmount()`: the record 1 is still stored and both cards have `seen: 1`.

Selecting:
- "lets the player select the explanation: select-none only while the card can be dragged": in the question phase `[data-swipe-card]` has the class `select-none`; after an answer it has `select-text` and not `select-none`.

**Steps:**

- [ ] **Step 1: Write the tests** (the new file, the fixture, the changed helpers, the `leave.test.ts` case).
- [ ] **Step 2: Run them and watch them fail.** `pnpm vitest run tests/components/play`. Expected failures: every case that looks for "See results" (`Unable to find an accessible element with the role "button" and name "See results"`), the Card field case (`"01 / 10"` instead of `"01"`) and the selecting case. The Streak "deals on past the first ten cards" case fails on the Card field ("12 / 12": the second chunk of the 12 card section holds its last two cards). The leaving cases that do not press "See results" and the new `leave.test.ts` case pass already: they pin behaviour that must not change.
- [ ] **Step 3: Implement** rules 1 to 3 and 5 in `components/play/PlayScreen.tsx`.
- [ ] **Step 4: Run them green.** `pnpm vitest run tests/components/play`.
- [ ] **Step 5: Update the e2e helpers.** In `e2e/helpers.ts`: `waitForCard` and `expectUnanswered` also expect no "See results" button; `playRound` presses `number === total ? "See results" : "Next card"`. In `e2e/small-screens.spec.ts` the loop over cards 2 to 10 presses "See results" on card 10.
- [ ] **Step 6: Run the gates.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` (port 3100 free). All green: every Classic spec now ends through "See results".
- [ ] **Step 7: Commit.**

```bash
git add components/play e2e/helpers.ts e2e/small-screens.spec.ts tests/components/play
git commit -m "feat: See results after the deciding answer, the Card field without a total outside Classic"
```
