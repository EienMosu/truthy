### Task 8: The Streak header and "New best" on the slip

A Streak round gets its own flight-path header (design system 5.10, "Streak" and "Streak at or past the best"; mockups `game-streak.html`, `game-streak-record.html`): the route shows one dot per correct answer, the plane on the card on screen and a ring where the best is, with "Streak **8**" and "Best **12**" under it. On the answer that passes a stored best, the slip shows the New best stamp in place of "Correct" (5.11). Everything else on the card is the Classic answer beat (task 7 already ends the round with "See results").

The header pieces every mode shares are taken out of `FlightPath.tsx` first, without changing what Classic draws; tasks 9 to 11 build on them.

**Files:**
- Create: `components/StreakPath.tsx`
- Modify: `components/FlightPath.tsx`, `components/Stamp.tsx`, `components/BoardingPass.tsx` (`PassSlip`), `components/play/useRound.ts`, `components/play/PlayScreen.tsx`
- Test: create `tests/components/StreakPath.test.tsx`; modify `tests/components/FlightPath.test.tsx`, `tests/components/Stamp.test.tsx`, `tests/components/BoardingPass.test.tsx`, `tests/components/play/useRound.test.tsx`, `tests/components/play/PlayScreenEnding.test.tsx`, `tests/components/play/ResultView.test.tsx` (its `TICKET` gets `best: null`)

**Interfaces:**
- Consumes:
  - `components/FlightPath.tsx`: `pointAt(t)`, `flownPath(t)`, `headingAt(t)`, the private `cardList`, `Waypoint`, the wrapper markup of `FlightPath` (lines 162 to 225), `ICON_PATHS.planeArrow`.
  - Task 5: `scoreOf(mode, answers)`, `lastAnswer(state)`. Task 3: `bestFor(progress, route, mode)`, `ticketFor(found, mode)`, `SPRING_EASE`, `STAMP_REST`, `STAMP_LANDING`.
  - `components/Stamp.tsx`: `Stamp({ verdict, animate, className })`, `type Verdict = "correct" | "wrong"`. `components/icons.tsx`: `StarIcon({ size })`.
  - `components/BoardingPass.tsx`: `PassSlip({ answer, correct, explanation, source, animateStamp, className })`.
  - `components/play/PlayScreen.tsx`: `verdictText(correct, answer)`.
- Produces:

```ts
// components/FlightPath.tsx (new exports; FlightPath itself is drawn with them and looks the same)
export interface Point { x: number; y: number }
export function cardList(numbers: readonly number[]): string;      // "card 3", "cards 1 and 2", "cards 1, 2 and 5"
export interface PathFrameProps {
  label: string;          // the accessible name of the whole header (role="img")
  progress: ReactNode;    // left of the label row, [data-progress]
  tally?: ReactNode;      // right of the label row, [data-tally]; left out: nothing
  children: ReactNode;    // the SVG content, in the 276 by 34 viewBox
  className?: string;
}
export function PathFrame(props: PathFrameProps): ReactNode;
export function RouteLine({ flownTo }: { flownTo: number }): ReactNode;  // the dotted curve and the solid part up to t (not "Route": that is the type in @/src/content/schema)
export function Plane({ at, heading, hidden }: { at: Point; heading: number; hidden?: boolean }): ReactNode;
export interface MarkProps {
  verdict: "correct" | "wrong";
  at: Point;
  scale?: number;   // 1 (default) is r7 / 13 by 13; the whole mark scales
  fresh?: boolean;  // the card just answered: a correct mark is drawn in the correct colour instead of ink; the g carries data-fresh=""
  plain?: boolean;  // no tick and no x (marks too small to carry them)
}
export function Mark(props: MarkProps): ReactNode;
/** Bold numbers of the label row. */
export function Num({ children }: { children: ReactNode }): ReactNode;   // <b className="font-(--font-weight-mono-semibold)">

// components/StreakPath.tsx
export interface StreakLayout {
  t: (slot: number) => number;  // where slot i sits on the curve, 0 to 1
  dot: number;                  // radius of a done dot
  ticks: boolean;               // done dots carry a tick (dot >= 5)
  ring: number | null;          // the slot of the best (best - 1), or null without a best (null or 0)
  target: boolean;              // the ring is at or ahead of the card on screen: the route ends on it
  future: readonly number[];    // the open slots between the card on screen and the ring
}
export function streakLayout(done: number, best: number | null): StreakLayout;
export function streakLabel(streak: number, best: number | null, ended: boolean): string;
export interface StreakPathProps {
  streak: number;                          // correct answers so far, the one just given included
  best: number | null;                     // the record on this route when the round started; null and 0 both mean "no best to show"
  answered: "correct" | "wrong" | null;    // the verdict of the card on screen; null while it is a question
  className?: string;
}
export function StreakPath(props: StreakPathProps): ReactNode;

// components/Stamp.tsx
export type Verdict = "correct" | "wrong" | "new-best";

// components/BoardingPass.tsx
export interface PassSlipProps { /* as today */ newBest?: boolean }

// components/play/useRound.ts
export interface TicketInfo { /* as today */ best: number | null }   // the record for this route and mode when the round was dealt
export function ticketFor(found: RouteInIndex, mode: Mode, best: number | null): TicketInfo;

// components/play/PlayScreen.tsx
export function verdictText(correct: boolean, answer: boolean, newBest?: boolean): string;
```

**Rules:**

*Shared pieces.*

1. `PathFrame` is the wrapper `FlightPath` has today: `div role="img" aria-label={label} data-flight-path=""` with the classes `min-w-0 flex-1`, the `svg viewBox="0 0 276 34"` (aria-hidden, the same classes), and the label row (aria-hidden, the same classes) holding `<span data-progress="">` and, when `tally` is given, `<span data-tally="">`. `RouteLine` is the dotted path (stroke 1.6, dash "2 5", round caps) and, when `flownTo > 0`, the solid `flownPath(flownTo)` (stroke 2.4). `Plane` is the `g[data-plane]` of today (r12 `accent` circle, `planeArrow` in `on-accent`, the `transition-opacity duration-(--duration-t2)` classes, `opacity-0` when `hidden`). `Mark` is today's correct circle and wrong square inside `g[data-waypoint] transform="translate(x y) scale(k)"`; with `fresh` the `g` also carries `data-fresh=""`, so a test can tell the card just answered from the marks of earlier cards. `FlightPath` renders through them; its tests pass unchanged.

*Streak geometry.* `done` is the number of dots: `answered === "correct" ? streak - 1 : streak`. The card on screen is slot `done`.

2. `streakLayout(done, best)`:

```ts
const round1 = (value: number) => Math.round(value * 10) / 10;

export function streakLayout(done: number, best: number | null): StreakLayout {
  const ring = best === null || best < 1 ? null : best - 1;
  const target = ring !== null && done <= ring;
  // Best still ahead: the slots spread over the whole curve and the ring ends it.
  // At or past the best, or without one: the route runs on into open sky, a little short of the end.
  const step = target ? 1 / Math.max(ring, 1) : 1 / (done + 1.6);
  const dot = Math.min(6, round1(264 * step * 0.31));
  const future = target ? Array.from({ length: Math.max(0, ring - done - 1) }, (_, i) => done + 1 + i) : [];
  return { t: (slot) => Math.min(1, slot * step), dot, ticks: dot >= 5, ring, target, future };
}
```

   With best 12 the slots sit 24 px apart in x and the ring is at (270, 24), as in `game-streak.html`; with streak 12 of best 12 the layout is the one of `game-streak-record.html`.
3. Drawn, in this order: `RouteLine flownTo={t(done)}`; one `Mark verdict="correct"` per slot below `done` (`scale={dot / 7}`, `plain={!ticks}`, each wrapped `data-streak-dot`); when `ring < done`, the reached ring on slot `ring`: a circle of radius `dot + 3.5`, no fill, `ink` stroke 1.4 (`data-ring="reached"`); the future slots as circles of radius `min(4, round1(dot * 2 / 3))`, fill `surface-raised`, `ink` stroke 1.6; when `target` and `ring > done`, the target ring on slot `ring`: a circle of radius `dot + 1`, fill `surface-raised`, `ink` stroke 1.6, around a circle of radius `dot / 2` in `ink` (`data-ring="target"`); then the card on screen: the `Plane` at `pointAt(t(done))` with `headingAt(t(done))`, `hidden` once answered, and once answered a full-size `Mark` (`scale` 1, `fresh`) of the verdict in its place. When the answer on the ring slot is correct (`ring === done`), the reached ring is drawn around that mark with radius 10.5.
4. Label row: left "Streak **{streak}**"; after the wrong answer "Streak ended at **{streak}**". Right: nothing without a best; "Previous best **{best}**" when `streak > best`; otherwise "Best **{best}**". Numbers in `Num`.
   **A best of 0** (a first round lost on its first card stores the record 0) is treated as no best everywhere in this header: no ring (`streakLayout` already gives `ring: null`), no right label, and the accessible name of the "no best" row. A zero is nothing to fly towards, and "equal to your best" at a streak of 0 would be noise.
5. Accessible name, `streakLabel(streak, best, ended)`:

| Case | Text |
|---|---|
| start of the sentence, playing | `Streak of {streak} correct answers` (`1 correct answer`) |
| start of the sentence, ended | `Streak ended at {streak}` |
| no best (null or 0) | `{start}.` |
| streak below best | `{start}. Your best on this route is {best}.` |
| streak equals best | `{start}, equal to your best on this route.` |
| streak above best | `{start}. New best on this route, previous best {best}.` |

*Play screen.*

6. `prepareRound` puts the record on the ticket: `best: bestFor(progress, route, pending.mode)`, read from the progress it has just pruned. "Play again" prepares again, so a record set in the last round is the best of the next.
7. In `RoundView`, a Streak round renders `<StreakPath streak={scoreOf("streak", round.answers)} best={ticket.best} answered={...} />` in the header; every other mode keeps `FlightPath` for now.
8. **New best on the slip:** `newBest = ticket.best !== null && ticket.best >= 1 && last.correct && streak === ticket.best + 1`, so it shows once, on the answer that takes the streak past a stored best of at least 1, never on a first round, never after a stored best of 0 (the first right answer would get it) and not on later answers. The result screen still says "New best" and "Previous best 0" for such a round: that comparison is the progress module's and is true. `PassSlip newBest` renders `<Stamp verdict="new-best" />`: the 24 px stamp in `correct`, a filled `StarIcon` of 20, the words "New best", and before them `<span className="sr-only">Correct. </span>`; `data-verdict="new-best"`. It lands like every slip stamp (420, delay 380). The jolt and the tear are unchanged.
9. The live region says `verdictText(correct, answer, newBest)`: "Correct. The answer is True. New best." when `newBest`, otherwise as today.

**Tests:**

`tests/components/FlightPath.test.tsx`: unchanged cases must pass. Add: "Mark scales as a whole and can go without its tick" (`scale={6 / 7}` gives `transform` ending in `scale(0.857...)`; `plain` renders no `path`).

`tests/components/StreakPath.test.tsx`, new (jsdom):

```tsx
describe("streakLayout", () => {
  it("spaces the slots 24 px apart and ends on the ring when the best is 12", () => {
    const layout = streakLayout(8, 12);
    expect([0, 1, 8, 11].map((slot) => pointAt(layout.t(slot)).x)).toEqual([6, 30, 198, 270]);
    expect(layout).toMatchObject({ dot: 6, ticks: true, ring: 11, target: true, future: [9, 10] });
  });

  it("ends on the ring for any best: three slots for a best of 3", () => {
    const layout = streakLayout(1, 3);
    expect([0, 1, 2].map((slot) => layout.t(slot))).toEqual([0, 0.5, 1]);
    expect(layout).toMatchObject({ ring: 2, target: true, future: [] });
  });

  it("keeps the plane on the ring slot while the next right answer would equal the best", () => {
    expect(streakLayout(11, 12)).toMatchObject({ target: true, future: [] });
    expect(streakLayout(11, 12).t(11)).toBe(1);
  });

  it("runs on into open sky at and past the best", () => {
    const layout = streakLayout(12, 12);
    expect(layout).toMatchObject({ ring: 11, target: false, future: [], dot: 6 });
    expect(layout.t(12)).toBeCloseTo(12 / 13.6, 5);
  });

  it("has no ring without a best", () => {
    expect(streakLayout(0, null)).toMatchObject({ ring: null, target: false, future: [], dot: 6 });
    expect(streakLayout(0, null).t(0)).toBe(0);
  });

  it("shrinks the dots of a long streak and drops their ticks", () => {
    expect(streakLayout(40, 12)).toMatchObject({ dot: 2, ticks: false });
    expect(streakLayout(13, 40)).toMatchObject({ dot: 2.1, ticks: false, target: true });
  });

  it("puts a best of 1 on the first slot", () => {
    expect(streakLayout(0, 1)).toMatchObject({ ring: 0, target: true, future: [] });
    expect(streakLayout(0, 1).t(0)).toBe(0);
  });
});

describe("streakLabel", () => {
  it.each([
    [8, 12, false, "Streak of 8 correct answers. Your best on this route is 12."],
    [12, 12, false, "Streak of 12 correct answers, equal to your best on this route."],
    [13, 12, false, "Streak of 13 correct answers. New best on this route, previous best 12."],
    [1, null, false, "Streak of 1 correct answer."],
    [0, null, false, "Streak of 0 correct answers."],
    [8, 12, true, "Streak ended at 8. Your best on this route is 12."],
    [12, 12, true, "Streak ended at 12, equal to your best on this route."],
    [13, 12, true, "Streak ended at 13. New best on this route, previous best 12."],
    [3, null, true, "Streak ended at 3."],
    [0, 0, false, "Streak of 0 correct answers."],
    [1, 0, false, "Streak of 1 correct answer."],
    [0, 0, true, "Streak ended at 0."],
  ])("streak %s, best %s, ended %s", (streak, best, ended, text) => {
    expect(streakLabel(streak, best, ended)).toBe(text);
  });
});
```

and, rendered (`render(<StreakPath ... />)`):
- "is one image named by streakLabel, with Streak and Best in the label row": streak 8, best 12, question: name as above; `[data-progress]` text "Streak 8"; `[data-tally]` text "Best 12"; 8 `[data-streak-dot]`; one `[data-ring="target"]`; `[data-plane]` without `opacity-0`.
- "after a right answer shows the mark of that card, hides the plane and counts it": streak 9, `answered="correct"`: 8 `[data-streak-dot]`, exactly one `[data-waypoint][data-fresh]` (the dots are marks too, so `[data-waypoint="correct"]` alone matches nine), its `data-waypoint` is "correct" and its circle has the class `fill-(--color-correct)`; the plane has `opacity-0`; progress "Streak 9".
- "after the wrong answer reads Streak ended at": streak 8, `answered="wrong"`: progress "Streak ended at 8", one `[data-waypoint="wrong"]` and it carries `data-fresh`, tally still "Best 12".
- "past the best reads Previous best and keeps the ring where the best was reached": streak 13, best 12, `answered="correct"`: tally "Previous best 12", one `[data-ring="reached"]`, no `[data-ring="target"]`.
- "draws no ring and no right label on a first round": best null: no `[data-ring]`, no `[data-tally]`.
- "treats a best of 0 like no best": streak 2, best 0, question: no `[data-ring]`, no `[data-tally]`, name "Streak of 2 correct answers."

`tests/components/Stamp.test.tsx`: "the New best stamp is a star, the words New best and a hidden Correct": `verdict="new-best"`: text content "Correct. New best", `[data-verdict="new-best"]`, class `text-(--color-correct)`, the `sr-only` span holds "Correct. ".

`tests/components/BoardingPass.test.tsx`: "PassSlip shows New best in place of Correct when asked": `newBest` with `correct`: `[data-verdict="new-best"]` exists and `[data-verdict="correct"]` does not.

`tests/components/play/useRound.test.tsx`: the expected ticket of "is loading first, then deals a Classic round ..." gains `best: null`. Add "puts the record of the route and mode on the ticket": stored `records: { "test-deck/SEC#streak": 5, "test-deck/SEC#classic": 9 }`, pending Streak: `ticket.best` is 5. The `ticketFor` cases pass `null` as the third argument.

`tests/components/play/PlayScreenEnding.test.tsx`, added (Streak):
- "shows the Streak header from the first card": name "Streak of 0 correct answers."; no image named `/^Card 1 of/`.
- "counts the streak and ends it": two right answers then a wrong one: names "Streak of 1 correct answer." (answered), "Streak of 2 correct answers." and, after the wrong answer, "Streak ended at 2."
- "shows New best only on the answer that passes a stored best": stored record 2 for `test-deck/SEC#streak`. Answers 1 and 2: `[data-verdict="correct"]`. Answer 3: `[data-verdict="new-best"]`, status "Correct. The answer is … New best.", header name "Streak of 3 correct answers. New best on this route, previous best 2." Answer 4: `[data-verdict="correct"]` again.
- "shows no New best on a first round, however long the streak" (no stored record, four right answers: never `new-best`).
- "does not show New best when the streak only equals the best" (stored 2: answer 2 shows `correct`, header "…, equal to your best on this route.").
- "shows no New best on the slip after a stored best of 0": stored record 0 for `test-deck/SEC#streak`: the header is "Streak of 0 correct answers."; the first right answer shows `[data-verdict="correct"]` and the status "Correct. The answer is …" without "New best"; the header reads "Streak of 1 correct answer."
- "Play again reads the record the last round set": stored none; right, right, wrong, "See results", "Play again": the new round's header is "Streak of 0 correct answers. Your best on this route is 2."

**Steps:**

- [ ] **Step 1: Take the shared pieces out of `FlightPath.tsx`** (rule 1), add the `Mark` test. `pnpm vitest run tests/components/FlightPath.test.tsx tests/components/play`: green, nothing on screen changed. Commit: `refactor: the flight path's frame, route, plane and marks as shared pieces`.
- [ ] **Step 2: Write `tests/components/StreakPath.test.tsx`.** Run it: it fails with `Cannot find package '@/components/StreakPath'`.
- [ ] **Step 3: Write `components/StreakPath.tsx`** (rules 2 to 5). Run the file green.
- [ ] **Step 4: Write the Stamp, PassSlip, useRound and PlayScreen tests.** Run `pnpm vitest run tests/components`: the new cases fail (`ticket.best` is `undefined`; the header is named "Card 1 of 10."; no `[data-verdict="new-best"]`).
- [ ] **Step 5: Implement** rules 6 to 9. Run `pnpm vitest run tests/components`: green.
- [ ] **Step 6: Look at it.** `pnpm dev`, then in the browser console on `/`: `sessionStorage.setItem("truthy.pending.v1", JSON.stringify({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "streak" }))` and open `/play`. Compare the question and the answer state with `design/flow/screens/game-streak.html` at 390 by 844, in both themes (the theme switch is on `/`). With `localStorage` `truthy.progress.v1` holding a Streak record of 2 for that route, check the New best slip against `game-streak-record.html`. Stop the dev server.
- [ ] **Step 7: Run the gates.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` (port 3100 free). All green.
- [ ] **Step 8: Commit.**

```bash
git add components tests/components
git commit -m "feat: the Streak header and New best on the answer that passes the best"
```
