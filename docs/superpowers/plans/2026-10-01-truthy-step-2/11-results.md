### Task 11: The result screen of each mode

Every mode ends on the result screen (spec section 6, "Result": "the mode's score, the comparison with the record for that route and mode (including a 'New best' moment when it is beaten), the list of missed cards ..., and two actions"). The screen exists for Classic; this task makes its four mode-bound parts follow the mode (design system 5.2 field grid, 5.10 "Completed", 5.14; mockups `result-streak.html`, `result-lives.html`, `result-timed.html`): the completed header, the three fields, the score block with its unit, and the comparison lines. Recording, the missed-card list, "Play again" and "Choose another route" are mode-agnostic already and stay as they are.

**Files:**
- Create: `components/play/resultCopy.ts`
- Modify: `components/FlightPath.tsx` (the completed variant), `components/ScoreBlock.tsx`, `components/play/ResultView.tsx`
- Test: create `tests/components/play/resultCopy.test.ts`; modify `tests/components/FlightPath.test.tsx`, `tests/components/ScoreBlock.test.tsx`, `tests/components/play/ResultView.test.tsx`, `tests/components/play/PlayScreenResult.test.tsx`

**Interfaces:**
- Consumes:
  - `src/content/play.ts`: `RoundResult { mode; route; score; total; answers; missed; abandoned }`. Task 5: `summarise(state)`, `scoreOf`. Task 6: `TIMED.roundMs`.
  - Task 3, `src/progress/progress.ts`: `compareWithBest(score, previousBest): Comparison`, `type Comparison`; `components/format.ts`: `pad2`. Task 8: `Mark`, `Num`, `cardList`, `PathFrame`, `RouteLine`, `TicketInfo` (`modeLabel`).
  - `components/FlightPath.tsx`: `completedLabel(total, results)`, `CompletedFlightPathProps { variant: "completed"; total; results; className? }`.
  - `components/ScoreBlock.tsx`: `ScoreBlock({ score, total, comparison, label, animate })`.
  - `components/play/ResultView.tsx`: `useRecordedRound(round, progressStore): ApplyOutcome` (`previousBest`), and its render (the header, the pass with its three fields, the score block, the missed cards, the two actions).
- Produces:

```ts
// components/FlightPath.tsx
export function completedScale(cards: number): number;   // the scale of the marks: 1 is r7 / 13
export interface CompletedFlightPathProps {
  variant: "completed";
  total: number;                 // marks on the route: cards dealt (Classic) or cards answered (the other modes)
  results: readonly boolean[];
  progress?: ReactNode;          // left of the label row; default: Arrived · {results.length} of {total}
  label?: string;                // accessible name; default: completedLabel(total, results)
  ring?: number;                 // index (from 0) of a card to ring
  className?: string;
}

// components/ScoreBlock.tsx
export interface ScoreBlockProps {
  score: number;
  label?: string;                       // default "Your score"
  unit?: string;                        // after the score: "of 10", "cards", "of 17"; left out: no unit
  best: (record: number) => string;     // how a record reads in the comparison: "9 / 10", "21 cards", "12"
  comparison: Comparison;
  animate?: boolean;
}

// components/play/resultCopy.ts
export interface ResultCopy {
  fields: readonly [{ label: string; value: string }, { label: string; value: string }, { label: string; value: string }];
  scoreLabel: string;
  unit: string | undefined;
  best: (record: number) => string;
  ended: string;            // the bold word of the header's label row: "Arrived", "Ended", "Out of lives", "Time up"
  endedDetail: string;      // what follows it: " · 10 of 10", " · 14 cards", ""
  label: string;            // the header's accessible name
  marks: number;            // marks on the completed route
  ring: number | undefined; // Streak: the card (from 0) where the previous best was reached
}
export function resultCopy(result: RoundResult, modeName: string, dealt: number, previousBest: number | null): ResultCopy;
```

**Rules:**

1. `resultCopy`, with `n = result.total` (cards answered), `w = result.missed.length`, `c = n - w`, `wrong` = the 1-based numbers of the wrong cards, `cards(k)` = "1 card" or "{k} cards", and every field number through `pad2`:

| | Classic | Streak | Three lives | Timed |
|---|---|---|---|---|
| Field 1 | Class: `modeName` | Class | Class | Class |
| Field 2 | Cards: `{n} / {dealt}` ("10 / 10") | Cards: `{n}` ("14") | Correct: `{c}` ("18") | Time: "60 s" |
| Field 3 | Missed: `{w}` ("03") | Missed: `{w}` ("01") | Missed: `{w}` ("03") | Answered: `{n}` ("17") |
| `scoreLabel` | "Your score" | "Correct in a row" | "Your score" | "Correct" |
| `unit` | `of {dealt}` | none | "cards" | `of {n}` |
| `best(r)` | `{r} / {dealt}` | `{r}` | `{r} cards` | `{r}` |
| `ended` + `endedDetail` | "Arrived" + ` · {n} of {dealt}` | "Ended" + ` · {cards(n)}` | "Out of lives" + "" | "Time up" + ` · {cards(n)}` |
| `label` | `completedLabel(dealt, results)` | `Streak over on card {n}. {score} correct in a row. Card {n} was wrong.` | `Out of lives after {n} cards. {c} correct, {w} wrong: {cardList(wrong)}.` | `Time is up. {cards(n)} answered in 60 seconds. {c} correct, {w} wrong: {cardList(wrong)}.` (without `: ...` when nothing is wrong) |
| `marks` | `dealt` | `n` | `n` | `n` |
| `ring` | none | `previousBest - 1` when `previousBest` is 1 or more and at most `score`; else none | none | none |

   "60 s" is `TIMED.roundMs / 1000` followed by " s". The Timed card that was on screen at zero is not in `answers`, so it has no mark and no number.
2. **Completed header.** `completedScale(cards)`: 1 up to 10 cards; `6 / 7` up to 17; beyond that `Math.min(6, (0.35 * 264) / (cards - 1)) / 7` (radius 4.62 at 21 cards). Every card is a `Mark` at `pointAt(waypointT(i, total))` with that `scale`; a correct mark is `plain` (no tick) when its radius `7 * scale` is below 5, a wrong one (no x) when its side `13 * scale` is below 6. The whole curve is solid, no plane. With `ring`, a circle of radius `7 * scale + 3.5`, no fill, `ink` stroke 1.4, around that card (`data-ring="reached"`). `progress` and `label` replace the defaults when given; the tally stays "{c} correct · {w} wrong".
3. **Score block.** The score is followed by the unit in the small style of today (`of 10` is today's rendering) only when `unit` is given. The comparison lines:

| `comparison.kind` | First line | Second line |
|---|---|---|
| `first` | "First round on this route" (`emphasis`) | none |
| `new-best` | the New best stamp (22 px, star 18, lands 420 ms delay 380) | `Previous best {best(previousBest)}` |
| `equal` | "Equals your best" (`emphasis`) | `Best {best(best)}` |
| `short` | `{by} short of your best` (`emphasis`) | `Best {best(best)}` |

   So the second line reads "Previous best 7 / 10" and "Best 9 / 10" (Classic), "Previous best 12" and "Best 12" (Streak), "Previous best 20 cards" and "Best 21 cards" (Three lives), "Previous best 11" and "Best 11" (Timed). The pass jolts when the kind is `new-best`, in every mode (unchanged code).
4. **ResultView** computes `const result = summarise(round)`, `const comparison = compareWithBest(result.score, outcome.previousBest)`, `const copy = resultCopy(result, ticket.modeLabel, round.cards.length, outcome.previousBest)` and renders: `<FlightPath variant="completed" total={copy.marks} results={...} progress={<><Num>{copy.ended}</Num>{copy.endedDetail}</>} label={copy.label} ring={copy.ring} />`; the pass fields `copy.fields`; `<ScoreBlock score={result.score} label={copy.scoreLabel} unit={copy.unit} best={copy.best} comparison={comparison} animate />`. The hidden heading "Round complete" stays the focus target in every mode. Its header comment no longer says "Classic".
5. A Timed round without an answer shows "**Time up** · 0 cards", the fields "60 s" and "00", the score "0" with "of 0", the comparison by the same rules (a first round: "First round on this route", record 0), and the missed-card list's existing "No missed cards" line.

**Tests:**

`tests/components/play/resultCopy.test.ts` (node), new. A helper builds a `RoundResult` from a mode and a list of booleans (`score` through `scoreOf`). One case per column of rule 1, each asserting the whole `ResultCopy` (the functions through sample calls):
- "Classic: 7 of 10" (`dealt` 10, wrong on 3, 6, 9): fields `[["Class","Classic"],["Cards","10 / 10"],["Missed","03"]]`, unit "of 10", `best(9)` "9 / 10", "Arrived" + " · 10 of 10", label "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.", marks 10, no ring.
- "Streak: 13 right, then wrong" (previous best 12): fields `Cards "14"`, `Missed "01"`, label "Correct in a row", no unit, `best(12)` "12", "Ended" + " · 14 cards", label "Streak over on card 14. 13 correct in a row. Card 14 was wrong.", marks 14, ring 11.
- "Streak: the ring needs a previous best that this round reached": previous best null, 0 and 20 give no ring; 13 gives ring 12.
- "Streak: wrong on the first card": "Ended" + " · 1 card", "Streak over on card 1. 0 correct in a row. Card 1 was wrong.", fields "01" and "01".
- "Three lives: 21 cards, wrong on 6, 15 and 21": fields `Correct "18"`, `Missed "03"`, unit "cards", `best(21)` "21 cards", "Out of lives" + "", label "Out of lives after 21 cards. 18 correct, 3 wrong: cards 6, 15 and 21.", marks 21.
- "Timed: 17 answered, wrong on 4, 9 and 15": fields `Time "60 s"`, `Answered "17"`, label "Correct", unit "of 17", `best(11)` "11", "Time up" + " · 17 cards", label "Time is up. 17 cards answered in 60 seconds. 14 correct, 3 wrong: cards 4, 9 and 15.".
- "Timed: nothing answered": `Answered "00"`, unit "of 0", " · 0 cards", label "Time is up. 0 cards answered in 60 seconds. 0 correct, 0 wrong.", marks 0.
- "Timed: one right answer": " · 1 card", "Time is up. 1 card answered in 60 seconds. 1 correct, 0 wrong."

`tests/components/FlightPath.test.tsx`, added to the completed block:
- "scales the marks so that they never touch": the radius `7 * completedScale(n)` for n = 10, 11, 14, 17, 18, 21, 60 is 7, 6, 6, 6, 5.435, 4.62, 1.566, each `toBeCloseTo(..., 2)`.
- "drops the ticks of small marks and keeps the x while it fits": 21 results with three wrong: no `path` inside `[data-waypoint="correct"]`, one inside each `[data-waypoint="wrong"]`; 14 results: every mark has its path.
- "rings one card when asked" (`ring={11}` of 14: one `[data-ring="reached"]`).
- "takes its label row and its name from the caller, and keeps the Classic ones by default".
- "draws an empty solid route for no cards" (`total={0}`, `results={[]}`: no `[data-waypoint]`, no error).

`tests/components/ScoreBlock.test.tsx`: the existing cases pass `unit="of 10"` and `best={(n) => `${n} / 10`}` in place of `total={10}` and keep their expectations. Add: "shows no unit when none is given" (Streak: `[data-score]` text is "13"); "writes the record the way the mode does" (`best={(n) => `${n} cards`}`, `equal` of 21: "Equals your best" and "Best 21 cards"; `new-best` over 20: "New best" and "Previous best 20 cards").

`tests/components/play/ResultView.test.tsx`: `finishedRound` takes the mode (`finishedRound(mode, right)`; for Timed it sends a first tick, answers each card and ticks 700 ms on, then ticks to zero and sends `next`). It deals from the fixture's 12 card section, so a round longer than ten cards has dealt 12, then 14, then 16 cards (chunks of ten, two, two): a Streak of 13 right answers and a wrong one has dealt 14 cards, which only matters for the "before" values in step 3. Existing Classic cases unchanged. Added, each rendering the result and reading the header's name, the label row, the three fields, `[data-score]` and `[data-comparison]`:
- "Streak: the score is the streak, without a unit": 13 right then wrong, stored record 12: header "Streak over on card 14. …", progress "Ended · 14 cards", fields `["Streak", "14", "01"]`, score "13", comparison "New bestPrevious best 12", one `[data-ring="reached"]`, the stored record becomes 13.
- "Streak: Equals your best" (stored 13, the same round): "Equals your bestBest 13", no `[data-new-best]`, the record stays 13.
- "Streak: short of the best" (stored 20): "7 short of your bestBest 20", no ring.
- "Three lives: the score is the cards answered": wrong on 2, 4 and 7 of 7, no record: fields `["Three lives", "04", "03"]`, score "7 cards" (text content), "First round on this route", progress "Out of lives", record 7.
- "Three lives: a new best gets the stamp" (stored 5): "New bestPrevious best 5 cards".
- "Timed: the score is the correct answers of the cards answered": two right, one wrong: fields `["Timed", "60 s", "03"]`, score "2 of 3", progress "Time up · 3 cards", record 2, three history entries.
- "Timed: nothing answered": "Time up · 0 cards", score "0 of 0", "First round on this route", the text "No missed cards", record 0.
- "lists the missed cards of every mode with their place in the round" (Three lives: "Card 02", "Card 04", "Card 07").

`tests/components/play/PlayScreenResult.test.tsx`, added:
- "a record stored before the deck changed still counts": stored `records: { "test-deck/SEC#streak": 2 }`; the network serves the index and the deck with a new hash and one SEC card removed (the pattern of the existing deck-update case); a Streak round of two right answers and a wrong one shows "Equals your bestBest 2" and no New best stamp; the record stays 2.
- "Play again after a Streak result deals a new Streak round" (the header "Streak of 0 correct answers. Your best on this route is …" appears after "Play again").

**Steps:**

- [ ] **Step 1: Write `resultCopy.test.ts`.** Run it: `Cannot find package '@/components/play/resultCopy'`. Write `components/play/resultCopy.ts` (rule 1). Run it green. Commit: `feat: what the result screen says in each mode`.
- [ ] **Step 2: Write the FlightPath and ScoreBlock cases.** Run them: the new ones fail (`completedScale is not a function`; the unit "of undefined"; the missing `ring`). Implement rules 2 and 3. `pnpm vitest run tests/components/FlightPath.test.tsx tests/components/ScoreBlock.test.tsx`: green. `pnpm typecheck` now fails in `ResultView.tsx` (the `total` prop is gone): expected, fixed in step 4.
- [ ] **Step 3: Write the ResultView and PlayScreenResult cases.** Run them: the new ones fail (fields `["Streak", "14 / 14", "01"]`, the score "13 of 14", the header "Round complete. …").
- [ ] **Step 4: Implement rule 4** in `ResultView.tsx`. Run `pnpm vitest run tests/components`: green.
- [ ] **Step 5: Look at it.** `pnpm dev`; play a Streak, a Three lives and a Timed round to the end (pending round set by hand as in task 8, step 6). Compare with `result-streak.html`, `result-lives.html` and `result-timed.html` at 390 by 844 in both themes; with "Reduce motion" on, the New best stamp is at rest. Stop the dev server.
- [ ] **Step 6: Run the gates.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` (port 3100 free). All green; the Classic result is unchanged (the result specs still read "7 of 10", "Previous best 7 / 10", "Best 10 / 10").
- [ ] **Step 7: Commit.**

```bash
git add components tests/components
git commit -m "feat: the result screen of Streak, Three lives and Timed"
```
