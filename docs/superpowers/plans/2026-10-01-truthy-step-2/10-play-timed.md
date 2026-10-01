### Task 10: Timed on the play screen

The play screen gets Timed (spec section 6: "stamp only, next card at once", "Timed shows no explanations during play"; design system 5.2 "time up", 5.10 "Timed" and "Timed, time up", 5.11 "Stub stamp", section 7 "Timed beat" and "Time is up"; mockups `game-timed.html`, `game-timed-up.html`). Four parts: the clock source and the page-visibility source in `PlayServices`, with a hook that turns them into `tick` and `visibility` events; the Timer header; the stamp beat on the stub (no slip, no tear, the card leaves and the next is dealt); the time-up state with "See results". The engine does all the arithmetic (task 6); this layer only reports time and draws the state.

**Files:**
- Create: `components/TimedPath.tsx`, `components/play/useClock.ts`
- Modify: `components/play/useRound.ts`, `components/play/PlayScreen.tsx`, `components/BoardingPass.tsx`, `components/Stamp.tsx`, `components/PillButton.tsx`
- Test: create `tests/components/TimedPath.test.tsx`, `tests/components/play/useClock.test.tsx`, `tests/components/play/PlayScreenTimed.test.tsx`; modify `tests/components/play/fixtures.ts`, `tests/components/Stamp.test.tsx`, `tests/components/BoardingPass.test.tsx`, `tests/components/PillButton.test.tsx`, `tests/tokens/contrast.test.ts`

**Interfaces:**
- Consumes:
  - Task 6, `src/engine/round.ts`: `TIMED = { roundMs: 60_000, holdMs: 700, maxStepMs: 1_000 }`, `RoundState.clock: Clock | null` (`remainingMs`), phase `stamped`, the events `{ type: "tick"; now }` and `{ type: "visibility"; hidden; at }`, `isDecided(state)` (time up in Timed), `lastAnswer(state)`.
  - Task 3: `interface PlayServices extends AppServices { now; randomSeed; backToStart? }`, `EASE`, `FALL`, `EASE_IN`, `SPRING_EASE`, `STAMP_REST`, `STAMP_LANDING`. Task 7: the action row with "See results", `NEXT_ARRIVES_MS = 420`, and the test helper `start` with its `act` line. Task 8: `PathFrame`, `RouteLine`, `Plane`, `Num`, `pointAt`, `headingAt`.
  - `components/BoardingPass.tsx`: `BoardingPass({ from, to, fields, children, lower, jolt, className })` with the `JOLT` variant (delay 0.42), `GateValue()`, `PassStatement({ children, appliesTo, ref, id })`, `PassStub({ routeLine, cardLabel, barcode, className })`.
  - `components/AnswerButtons.tsx`: `AnswerButtons({ onAnswer, disabled })` (dims both pills to 0.45, ignores presses, keeps focus). `components/icons.tsx`: `CheckIcon`, `CrossIcon`, `ClockIcon` (22, stroke 2.4).
- Produces:

```ts
// components/play/useRound.ts
export const TICK_MS = 100;
export interface PageVisibility {
  /** Whether the page is hidden now. In the browser: document.visibilityState === "hidden". */
  hidden: () => boolean;
  /** Calls onChange when the page is hidden or shown. Returns the unsubscribe. In the browser: "visibilitychange". */
  listen: (onChange: (hidden: boolean) => void) => () => void;
}
export interface PlayServices extends AppServices {
  now: () => number;
  randomSeed: () => number;
  backToStart?: () => boolean;
  /** Calls onTick about every TICK_MS while subscribed. Returns the unsubscribe. In the browser: setInterval. */
  ticker: (onTick: () => void) => () => void;
  visibility: PageVisibility;
}

// components/play/useClock.ts
/** While `running`, reports time and page visibility to the round as tick and visibility events. */
export function useClock(running: boolean, dispatch: (event: RoundEvent) => void, services: Pick<PlayServices, "now" | "ticker" | "visibility">): void;

// components/TimedPath.tsx
export function clockText(remainingMs: number): string;                       // "1:00", "0:41", "0:00"
export function timedLabel(remainingMs: number, correct: number, wrong: number): string;
export interface TimedPathProps { remainingMs: number; correct: number; wrong: number; className?: string }
export function TimedPath(props: TimedPathProps): ReactNode;

// components/Stamp.tsx
export type StubStampKind = "correct" | "wrong" | "time-up";
export function StubStamp({ kind }: { kind: StubStampKind }): ReactNode;

// components/BoardingPass.tsx
export interface BoardingPassProps { /* as today */ joltDelay?: number }      // seconds; default 0.42
export function GateValue({ closed }: { closed?: boolean }): ReactNode;
export interface PassStatementProps { /* as today */ muted?: boolean; live?: boolean }
export interface PassStubProps { /* as today */ stamp?: ReactNode; hint?: string }

// components/play/PlayScreen.tsx
export function timedStatus(round: RoundState): string;   // what the live region says in Timed

// tests/components/play/fixtures.ts
export interface Harness {
  /* as today */
  tick: () => void;                         // calls every subscribed onTick once
  run: (ms: number) => void;                // every 100 ms up to ms: advance the clock by 100, then tick
  setHidden: (hidden: boolean) => void;     // changes visibility.hidden() and tells the listeners
  ticking: () => number;                    // how many ticker subscriptions are open
}
```

**Rules:**

*The clock source.*

1. `browserPlayServices.ticker` is `(onTick) => { const id = window.setInterval(onTick, TICK_MS); return () => window.clearInterval(id); }`. `visibility.hidden` is `() => document.visibilityState === "hidden"`; `visibility.listen` adds a `visibilitychange` listener on `document` that calls `onChange(document.visibilityState === "hidden")` and returns the function that removes it.
2. `useClock(running, dispatch, services)`: one effect on `[running, dispatch, services]`. When `running`: if `services.visibility.hidden()`, dispatch `{ type: "visibility", hidden: true, at: services.now() }`; then dispatch `{ type: "tick", now: services.now() }` (the clock starts when the first card is shown); subscribe the ticker (each call dispatches a tick with `services.now()`) and the visibility listener (each change dispatches `{ type: "visibility", hidden, at: services.now() }`). The cleanup unsubscribes both. `RoundView` receives `services` (in place of `now` alone) and calls `useClock(round.mode === "timed" && !isDecided(round), dispatch, services)`, so the ticker stops at time up, when the round is left and when the screen unmounts. The clock keeps running while the "Leave round?" sheet is open.

*The header.*

3. `TimedPath`: `t = 1 - remainingMs / 60000`, kept within 0 and 1. Drawn in `PathFrame`: `RouteLine flownTo={t}`; the start dot, a circle of radius 5 in `ink` at (6, 24); the quarter marks at `pointAt(0.25)`, `pointAt(0.5)`, `pointAt(0.75)` (72 12.75, 138 9, 204 12.75), radius 3.5, `ink` stroke 1.6, filled `ink` once `t` has reached the mark and `surface-raised` before (`data-quarter="passed" | "ahead"`); the destination, radius 5, fill `surface-raised`, `ink` stroke 1.6, at (270, 24); the `Plane` at `pointAt(t)` with `headingAt(t)`, never hidden. There are no per-card marks.
4. `clockText(remainingMs)`: seconds = `Math.ceil(remainingMs / 1000)`, written `m:ss`: 60000 gives "1:00", 40001 "0:41", 1 "0:01", 0 "0:00". Label row: left `<b>` with the clock (classes `font-(--font-weight-mono-semibold) text-[13px] tabular-nums`: Mono 600 13 with tabular figures; tokens.json has no role for it) followed by " left"; right "{correct} correct · {wrong} wrong".
5. `timedLabel`: while time is left `{s} seconds left of 60. {c} correct, {w} wrong.` (`1 second left of 60.`); at zero `No time left. {n} cards answered: {c} correct, {w} wrong.` (`1 card answered`), `n = c + w`. It changes at most once per second because it is built from the whole seconds.

*The stamp beat* (phase `stamped`, not decided).

6. No slip and no tear: the lower part stays the `PassStub` of the card. `PassStub` gets `stamp` (drawn centred on the stub: a wrapper `absolute left-1/2 top-[96px] -translate-x-1/2 -translate-y-1/2`, 96 px from the top of the stub) and `hint` (when given, the hint row is one centred line in Mono 400 13 `ink-muted` instead of "← False / swipe to board / True →"; the intent stamps are not rendered).
7. `StubStamp`: the stamp at 28 px (class `text-[28px]`, the documented stub variant of the `stamp` role), padding `px-(--space-18) pt-(--space-8) pb-(--space-6)`, fill `bg-(--color-surface-raised)`, the 3 px double border in the text colour, at rest rotated -6 degrees; `data-stub-stamp={kind}`.
   - `correct`: `text-(--color-correct)`, `CheckIcon` 24, "Correct". Hint: "Next card coming up".
   - `wrong`: `text-(--color-wrong)`, `CrossIcon` 20, "Not quite". Hint: "Missed, saved for review at the end".
   - `time-up`: `text-(--color-ink)`, `ClockIcon`, "Time is up".
   - Landing: from `STAMP_LANDING` (scale 1.9, -14 degrees, opacity 0) to `STAMP_REST`, 300 ms, `SPRING_EASE`, no delay for a verdict and 120 ms for `time-up`. With reduced motion it is shown at rest.
8. During the beat: `AnswerButtons disabled` (the pills dim to `--opacity-disabled`, 0.45, and ignore presses; they stay in place and keep focus); the swipe and the arrow keys are off (they act only in the phase `question`); there is no Next row and Enter does nothing. The pass jolts: `jolt` with `joltDelay={0.12}`. The tally in the header counts the answer at once; the plane stays.
9. When the engine moves on (700 ms after the answer, counted by ticks): inside `[data-swipe-card]` the `BoardingPass` is wrapped in a `motion.div` keyed by `round.index` inside `<AnimatePresence initial={false} custom={side}>` (parent `grid`, both cards in `[grid-area:1/1]`; `side` is `lastAnswer(round)?.given ? "right" : "left"`, read by the leaving card through `custom`), so the answered card leaves and the next is dealt at the same time:
   - leave: `x` to `"-120%"` and `rotate` -8 when the player answered False, `"120%"` and 8 for True (the side that was answered), `opacity` 0; 220 ms, `FALL` (opacity `EASE_IN`); the leaving card is on top (`zIndex: 1`).
   - deal: from `y: 14, opacity: 0` to rest; 280 ms, `EASE`.
   - Reduced motion: no variants, the card changes at once.
   - In the other modes the wrapper has a constant key and `initial={false}`: nothing changes for them.
   The 250 ms settle time counts from the new question as for every card.
10. Focus and announcements in Timed: the statement takes focus on the first card only (`round.index === 0`); on later cards focus stays where it is (on the pill the player used) and the statement, rendered with `live` (`aria-live="polite"` on `[data-statement]`), announces the new card. The live region says `timedStatus(round)`: "Correct." or "Not quite." during the beat (the answer is not given away), "Time is up. This card doesn't count." at time up, "" on a question.

*Time up* (`isDecided(round)` in Timed).

11. The header shows the whole route flown, every quarter mark passed, the plane on the destination, "**0:00** left".
12. The card stays as it is, unanswered: `PassStatement muted` (the statement in `text-(--color-ink-muted)`, `data-muted=""`, not `live`); the Card field shows its number; the Gate field is `<GateValue closed />`: the word "Closed" in `ink-muted` (no hidden text needed). The stub stays: `stamp={<StubStamp kind="time-up" />}`, `hint` = "This card doesn't count · {answers.length} answered". The pass jolts with `joltDelay={0.24}`. The card cannot be dragged, and a drag that is under way when time runs out springs back and its release answers nothing (`useSwipe` resets when `enabled` turns false; the engine ignores an answer at or after zero anyway).
13. The action row shows "See results →" in place of True and False, entering like every Next row (rises 12 px, 220 ms, delay 360, `EASE`), and it takes presses and Enter only `NEXT_ARRIVES_MS` (420) after the moment time ran out, so a tap aimed at True or False as the clock reaches zero does not open the result.
    **One notion drives the whole row.** Today `RoundView` keys five things on `round.phase === "answered"` (its `answered` constant): which row is rendered, the timer that sets `arrivedAt`, the `pointer-events-none` class of the Next row, `focusNext`, and the Enter branch of the key handler; and `next` measures from the answer's time. At time up the phase is `stamped`, so all of them follow one new constant instead:

    ```ts
    const decided = isDecided(round);
    // The action row is the Next row ("Next card" or "See results"): after an answer in the modes that show
    // a verdict, and at time up in Timed. During the Timed stamp beat it is still the answer row.
    const awaitsNext = answered || (round.mode === "timed" && decided);
    ```

    - Which row: `awaitsNext` renders the Next row, otherwise the answer row (`AnswerButtons`, `disabled` during the stamp beat, rule 8).
    - Since when: the answer's time (`last.at`, as today) when `answered`; at time up the moment `RoundView` saw it, `now()` noted in a ref by an effect that runs when `awaitsNext` turns true in a Timed round. `next` returns without dispatching while `now() - since < NEXT_ARRIVES_MS` or while `since` is unknown.
    - The arrival timer (`setArrivedAt(round.index)` after `NEXT_ARRIVES_MS`) runs when `awaitsNext`, not only when `answered`; `nextArrived = awaitsNext && arrivedAt === round.index`.
    - The Next row's wrapper carries `pointer-events-none` until `nextArrived`. Without the two lines above it would keep that class for ever at time up and no real tap could press "See results"; jsdom's `fireEvent` ignores `pointer-events`, so the unit test below looks at the class.
    - `focusNext = awaitsNext && (reduced || nextArrived)`, at time up limited by rule 14.
    - The key handler's Enter branch runs when `awaitsNext`.
    Classic, Streak and Three lives are unchanged by this: for them `awaitsNext` is `answered`.
14. Focus at time up: if True or False had focus when time ran out (tracked with `onFocus` and `onBlur` on the answer row's wrapper), focus moves to "See results" once it has arrived (at once with reduced motion). Otherwise focus is not moved.
15. `PillButton` ignores a press while `aria-disabled` is `true`: its `onClick` is wrapped (`if (rest["aria-disabled"] === true || rest["aria-disabled"] === "true") return;`), so the keyboard cannot fire a pill the pointer cannot. The dead class `aria-disabled:cursor-default` is removed.
16. Saving and leaving need no new code. A Timed round that is left is abandoned like any other, at time up too: once a card has been answered the close button asks, and leaving keeps the answers and sets no record; with no answer it leaves at once and saves nothing (task 7, rule 4). "See results" finishes the round and shows the result (still the Classic-shaped result until task 11). "Play again" mounts a new `RoundView`, so the clock subscription, the time-up moment and `arrivedAt` start fresh.

**Tests:**

`tests/components/play/fixtures.ts`: `harness` builds `ticker` and `visibility` over a set of subscribers and a `hidden` flag and returns `tick`, `run`, `setHidden`, `ticking` as specified under "Produces". Existing tests are unaffected (no clock runs outside Timed).

`tests/components/TimedPath.test.tsx`, new:

```tsx
describe("clockText", () => {
  it.each([[60_000, "1:00"], [59_999, "1:00"], [59_000, "0:59"], [40_001, "0:41"], [41_000, "0:41"], [1, "0:01"], [0, "0:00"]])("%i ms reads %s", (ms, text) => {
    expect(clockText(ms)).toBe(text);
  });
});

describe("timedLabel", () => {
  it.each([
    [41_000, 9, 2, "41 seconds left of 60. 9 correct, 2 wrong."],
    [60_000, 0, 0, "60 seconds left of 60. 0 correct, 0 wrong."],
    [900, 3, 0, "1 second left of 60. 3 correct, 0 wrong."],
    [0, 14, 3, "No time left. 17 cards answered: 14 correct, 3 wrong."],
    [0, 1, 0, "No time left. 1 card answered: 1 correct, 0 wrong."],
  ])("%i ms, %i correct, %i wrong", (ms, correct, wrong, text) => {
    expect(timedLabel(ms, correct, wrong)).toBe(text);
  });
});
```

and, rendered: "puts the plane where the time is: at the start with 60 s, on the destination at zero" (`[data-plane]` transform starts `translate(6 24)` and `translate(270 24)`); "fills the quarter marks as they are passed" (41 s left: `t` is 0.3167: one `passed`, two `ahead`; 0 left: three `passed`); "shows the clock and the tally" (progress "0:41 left", tally "9 correct · 2 wrong"); "has no flown line at the start".

`tests/components/play/useClock.test.tsx`, new (`renderHook`, a `dispatch` spy, the harness services):
- "does nothing while it is not running" (no dispatch, `ticking()` 0).
- "ticks once at the start, then on every tick of the source, with the time of the services": events `[{ type: "tick", now: T }, { type: "tick", now: T + 100 }]` after `advance(100); tick()`.
- "reports the page being hidden and shown with the time".
- "tells the round first when the page is already hidden at the start" (`setHidden(true)` before the render: the first event is the visibility event, the second the tick).
- "unsubscribes when it stops running and when it unmounts" (`ticking()` back to 0; a later `tick()` and `setHidden` dispatch nothing).

`tests/components/Stamp.test.tsx`: "StubStamp says Correct, Not quite or Time is up with its icon, at 28 px on raised paper" (`it.each` over the three kinds: text, `data-stub-stamp`, colour class, `text-[28px]`, `bg-(--color-surface-raised)`).

`tests/components/BoardingPass.test.tsx`: "GateValue reads Closed when the gate is closed"; "PassStatement can be muted and live"; "PassStub shows a stamp and one hint line in place of the swipe hint" (with `hint`: the text is in the stub, "swipe to board" and `[data-intent]` are not).

`tests/components/PillButton.test.tsx`: "does not call onClick while aria-disabled, by pointer or keyboard" (`fireEvent.click` on a pill with `aria-disabled`: the handler is not called).

`tests/tokens/contrast.test.ts`: add the pair `["wrong", "surface-raised", "large text", "Not quite stamp on the stub, 28px ExtraBold"]` to `PAIRS`. The stub stamp is the first place the `wrong` colour sits on raised paper; `correct` and `ink` on `surface-raised` are in the list already. It passes in both themes as the tokens are (5.99 by day, 4.94 at night, against the 3 of large text); it is there so that a later change of either colour is caught.

`tests/components/play/PlayScreenTimed.test.tsx`, new (jsdom, the mocks and `start` helper of `PlayScreen.test.tsx` as it is on `main`, with its `await act(async () => {})`; `harness(pendingFor("timed"))`; every `h.run`, `h.tick` and `h.setHidden` inside `act`). `give(right)` clicks the right or wrong button for the statement on screen.

Three things to know before writing the cases:
- **`start()` costs the clock one second.** The clock starts with the tick `useClock` sends on mount; `start()` then advances the test clock by 1000 (the settle time) without a tick. The next tick or answer sees that gap and counts it (a full second, the most one step may count). So after `start()`, `run(ms)` takes `ms + 900` off the clock, and an answer given right after `start()` takes 1000. The numbers in the cases below include it. `runToTimeUp()` is `run(59_100)` right after `start()`: its last tick is the one that reaches zero (1000 + 590 × 100), so no test time passes between time up and the next line.
- **A leaving card stays in the DOM until its exit is over** (`AnimatePresence`, also with animations skipped; the dialog case in `PlayScreen.test.tsx` waits for the same reason). After a card swap, `statementText()` and `[data-stub-stamp]` would still find the card that is leaving. The helper `nextCard(previous)` is `await waitFor(() => { expect(document.querySelectorAll("[data-statement]")).toHaveLength(1); expect(statementText()).not.toBe(previous); })`, then `await act(async () => {})`; every assertion about the new card comes after it.
- The arrival of "See results" (the `pointer-events-none` class, focus) runs on a real 420 ms timer, as in `PlayScreen.test.tsx`: wait for it with `waitFor(..., { timeout: 1500 })`. The guard in `next` runs on the test clock: `h.advance(420)`.
- "shows the Timer header from the first card": name "60 seconds left of 60. 0 correct, 0 wrong."; fields `["Timed", "01", "F ← → T"]`.
- "counts the clock down from the first card": `run(19_000)`: progress "0:41 left".
- "stamps an answer on the stub: no slip, no Next card, the buttons dimmed": `give(true)`: `[data-stub-stamp="correct"]`, the hint "Next card coming up", no `[data-slip]`, no "Next card", True and False `aria-disabled="true"`, status "Correct.", tally "1 correct · 0 wrong". With `give(false)`: `[data-stub-stamp="wrong"]`, "Missed, saved for review at the end", status "Not quite.".
- "ignores True and False during the stamp": a second click and an ArrowRight: the tally still shows one answer.
- "takes a swipe and the arrow keys like every mode": a drag of the card past 90 px (the pointer events of the swipe case in `PlayScreen.test.tsx`) stamps the card; `run(700)`, `nextCard`, `advance(300)`; ArrowLeft stamps the next card.
- "shows the next card 700 ms after the answer, not before": `give(true)`, `run(600)`: the same statement and its stamp; `run(100)`, `nextCard(first)`: another statement, Card "02", the buttons without `aria-disabled`, no `[data-stub-stamp]`.
- "keeps the settle time on the new card": after `nextCard`, a click at once is ignored (no stamp); after `advance(250)` it answers.
- "never shows an explanation or the answer during play" (no "The answer is" text in any state).
- "pauses the clock while the page is hidden": `run(5_000)`, `setHidden(true)`, `run(30_000)`: "0:55 left"; `setHidden(false)`, `run(1_000)`: "0:54 left".
- "counts one second for a long gap between two ticks": `advance(45_000); tick()`: "0:59 left".
- "at time up keeps the card, closes the gate and offers only See results": `runToTimeUp()`: `[data-stub-stamp="time-up"]`, Gate "Closed", `[data-statement][data-muted]` without `aria-live`, the hint "This card doesn't count · 0 answered", "See results", no True or False, name "No time left. 0 cards answered: 0 correct, 0 wrong.", status "Time is up. This card doesn't count.", `ticking()` 0.
- "a tap right after time is up does not open the result": `runToTimeUp()`, click "See results" at once: no "Round complete"; `advance(420)`, click: the heading appears.
- "See results takes taps once it has arrived": `runToTimeUp()`: the wrapper of "See results" (its parent element) has the class `pointer-events-none`; `await waitFor(() => expect(wrapper.className).not.toContain("pointer-events-none"), { timeout: 1500 })` passes. This is the case that fails when the arrival timer still follows the `answered` phase.
- "Enter opens the result once See results has arrived".
- "time running out during the stamp keeps that answer and shows a card that does not count": `run(59_000)` (100 ms are left: 1000 + 589 × 100 counted), `give(true)` (the stamp starts with 100 ms on the clock), `run(100)`, `nextCard(first)`: Card "02", `[data-stub-stamp="time-up"]`, hint "This card doesn't count · 1 answered", tally "1 correct · 0 wrong".
- "records the finished round: the correct answers as the record, the card at zero not in the history": one right and one wrong answer (each followed by `run(700)`, `nextCard` and `advance(300)`), then `run(60_000)`, "See results" after 420: `records` `{ "test-deck/SEC#timed": 1 }`, two cards in `cards`, `last` `{ ..., mode: "timed", score: 1, total: 2 }`.
- "leaving at time up sets no record, like leaving earlier": one right answer, `run(60_000)`, the header's "Leave round": the dialog opens; "Leave round" in it: `records` is `{}`, one card has `seen: 1`, `last.score` is null. The same mid-round (one answer, no time up): the same stored progress.
- "leaving at time up with nothing answered leaves at once and saves nothing": `runToTimeUp()`, "Leave round": no dialog, `router.replace("/")`, nothing stored under `PROGRESS_KEY`.
- "keeps the clock running while the leave sheet is open": one answer, open the sheet, `run(60_000)`, "Keep playing": the time-up state is on screen.
- "stops ticking after leaving and after unmounting" (`ticking()` 0).
- "moves focus to See results at time up when True or False had it, and leaves it alone otherwise".
- "a drag that is under way when time runs out springs back and answers nothing": `pointerDown` on `[data-swipe-card]` at x 200 and `pointerMove` to x 260 (the pointer object of the swipe case), `runToTimeUp()`, `pointerUp` at x 300: the hint reads "This card doesn't count · 0 answered", the only stub stamp is `time-up`, the tally is "0 correct · 0 wrong", and the card has no `data-dragging` and `--drag-x` "0".
- "Play again after a Timed result starts a full minute": one right answer, `run(60_000)`, `advance(420)`, "See results", "Play again", wait for True, `act`, `advance(1000)`: the header is named "60 seconds left of 60. 0 correct, 0 wrong.", `ticking()` is 1, and `give(true)` stamps the card (the answer takes the second of `start`'s gap). Then `run(59_000)`, whose last tick reaches zero, and a click on "See results" at once: no "Round complete" (the time-up moment is the new round's, not the old one's).
- "the statement is a live region and takes focus on the first card only".

**Steps:**

- [ ] **Step 1: The services and the hook.** Extend the fixture, write `useClock.test.tsx`; run it (it fails: `Cannot find package '@/components/play/useClock'`). Add `TICK_MS`, `PageVisibility`, `ticker` and `visibility` to `useRound.ts` (rule 1) and write `useClock.ts` (rule 2). Run `pnpm vitest run tests/components/play` and `pnpm typecheck`: green. Commit: `feat: a clock and a page-visibility source in the play services`.
- [ ] **Step 2: The header.** Write `TimedPath.test.tsx` (fails on the missing module), then `components/TimedPath.tsx` (rules 3 to 5). Run it green. Commit: `feat: the Timer header`.
- [ ] **Step 3: The parts.** Write the Stamp, BoardingPass and PillButton cases (they fail on the missing export `StubStamp`, the missing props and the fired handler) and add the contrast pair (it passes), then implement rules 6, 7, 12 (`GateValue`, `PassStatement`), 15 and `joltDelay`. Run `pnpm vitest run tests/components tests/tokens`: green. Commit: `feat: the stub stamp, the closed gate and a pill that ignores presses while disabled`.
- [ ] **Step 4: The screen.** Write `PlayScreenTimed.test.tsx`. Run it: every case fails (the header is "Card 1 of 10.", the answer shows a slip, the clock never moves).
- [ ] **Step 5: Implement** rules 2 (the call), 8 to 14 in `PlayScreen.tsx`. Run `pnpm vitest run tests/components/play`: green, the Classic, Streak and Three lives files included.
- [ ] **Step 6: Look at it.** `pnpm dev`; pending round `mode: "timed"` as in task 8, step 6. Compare the question, the stamp beat (right and wrong) and time up with `game-timed.html` and `game-timed-up.html` at 390 by 844 in both themes. Switch to another tab for ten seconds and come back: the clock has not moved. With "Reduce motion" on: the stamps are at rest and the card changes without moving. Stop the dev server.
- [ ] **Step 7: Run the gates.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` (port 3100 free). All green.
- [ ] **Step 8: Commit.**

```bash
git add components tests
git commit -m "feat: Timed on the play screen: the stamp beat, the clock that pauses when hidden, and time up"
```
