### Task 11: Play screen

The `/play` route and the Classic round on it: the flight-path header, the boarding pass with the statement and the stub, the True and False buttons, the swipe, the keyboard, the answer slip with the stamp, "Next card", and leaving with one confirmation. The finished round renders a small placeholder that task 12 replaces with the result screen.

The visual specification is `design/flow/screens/game-classic.html` (question and answer states; its CSS is identical to `design/round2/directions/e02.html`, whose shots `design/round2/shots/e02-question.png`, `e02-answer.png` and `e02-wrong.png` are the reference pictures; `design/flow/shots/start-7.png` shows the same ticket at card 1). Behaviour comes from the spec, sections 6, 8, 9 and 10.

Every command runs from the repository root. Tasks 1 to 9 are done (`pnpm test`, `pnpm typecheck` and `pnpm build` are green). Task 10 is not needed for this task: the tests inject the pending round, and the comparison step writes it into `sessionStorage` itself.

**How the screen is put together.**
- `app/play/page.tsx` is a server component that renders `<PlayScreen />`. Everything else is client side.
- `components/play/useRound.ts` loads and deals: `readPending` (from `sessionStorage`), `loadIndex` and `loadDeck` (with `createDeckCache` on `localStorage`), `pruneDeck` on the stored progress (saved back), `poolFor`, `startRound` with the stored card history and a fresh seed. The round then runs on `useReducer`, whose reducer delegates every round event to the engine's `reduce`.
- Everything that touches the outside world (network, the two storages, the clock, randomness) comes in through one object, `PlayServices`, passed to `PlayScreen` as the optional `services` prop. The default is `browserPlayServices`. Tests pass fakes (`tests/components/play/fixtures.ts`); task 12 and the end-to-end task use the same seam. Navigation is `useRouter()` from `next/navigation`; component tests mock that module.
- One answer path: the swipe (`useSwipe`), the buttons (`AnswerButtons`) and the keys (left arrow False, right arrow True) all call the same `answer(value)` in `PlayScreen`. It ignores input outside the question phase, while the leave dialog is open, and for 250 ms (`SWIPE.settleMs`) after a card appears, so a double tap on "Next card" cannot answer the next card. Enter is "Next card" in the answered phase unless focus is on a link or a button (they handle Enter themselves).
- The card follows the finger through CSS custom properties that `useSwipe` writes straight onto the card element (`--drag-x`, `--intent`, `--pull`), so a drag does not re-render React. The transforms are CSS `calc()` expressions over those properties and the gesture tokens (`--gesture-rotation-divisor`, `--gesture-stub-pull`, `--gesture-intent-opacity-gain`).
- Motion (`motion/react`) drives the answer beat, transforms and opacity only: the stub tears off (left after a correct answer, right after a wrong one, 460 ms `fall`), the stamp lands (420 ms spring, 380 ms delay), the main part jolts 2 px (260 ms, 420 ms delay), the True/False row leaves and "Next card" rises in (220 ms, 360 ms delay). Every component reads `useReducedMotion()` and swaps movement for a short cross-fade; the stamp is then shown at rest and there is no jolt.
- The ticket sits in a vertical scroller. At 390 by 844 nothing scrolls and every position equals the mockup; with a long explanation or on a shorter phone the ticket scrolls under the action row, so the source link and the explanation are never cut off. `touch-action: pan-y` on the card lets that vertical scroll work while horizontal drags reach the swipe code.

**Files:**
- Create: `components/FlightPath.tsx`, `components/Stamp.tsx`, `components/BoardingPass.tsx`, `components/play/useSwipe.ts`, `components/play/LeaveDialog.tsx`, `components/play/useRound.ts`, `components/play/PlayScreen.tsx`, `app/play/page.tsx`
- Tests: `tests/components/FlightPath.test.tsx`, `tests/components/Stamp.test.tsx`, `tests/components/BoardingPass.test.tsx`, `tests/components/play/useSwipe.test.tsx`, `tests/components/play/LeaveDialog.test.tsx`, `tests/components/play/useRound.test.tsx`, `tests/components/play/PlayScreen.test.tsx`, and the shared test doubles `tests/components/play/fixtures.ts` (not a test file itself)
- Temporary, never committed (last step only): `task11-shoot.mjs`

**Interfaces:**
- Consumes:
  - Task 3, `@/src/content/schema`: `WHOLE_DECK` (`"ALL"`), types `Card`, `DeckFile`, `DeckIndex`, `IndexDeck`, `Route`.
  - Task 5, `@/src/engine/round`: `startRound(args: StartArgs): RoundState`, `reduce(state: RoundState, event: RoundEvent): RoundState`, `currentCard(state): Card | undefined`, `lastAnswer(state): Answered | undefined`, `summarise(state): RoundResult`, types `Mode`, `RoundEvent`, `RoundState`.
  - Task 6, `@/src/progress/progress`: `pruneDeck(progress, deckId, cardIds): Progress`, `applyResult(progress, result): ApplyOutcome`, `emptyProgress()`, `parseProgress(raw)` (tests); `@/src/progress/local`: `createLocalStore(storage): ProgressStore`, `browserLocalStorage(): Storage | undefined`, `PROGRESS_KEY`, type `ProgressStore`.
  - Task 7, `@/src/input/swipe`: `SWIPE` (`settleMs` 250), `canStart(sample, context): boolean`, `interpret(samples, context): SwipeOutcome`, `intent(dx): number`, types `SwipeSample`, `SwipeContext`.
  - Task 8, `@/src/content/load`: `loadIndex(fetcher: Fetcher, storage?: Pick<Storage, "getItem" | "setItem">): Promise<DeckIndex>`, `loadDeck(entry: { id: string; hash: string }, cache: DeckCache, fetcher: Fetcher): Promise<DeckFile>`, `createDeckCache(storage): DeckCache`, `poolFor(deck, sectionId): Card[]`, type `Fetcher`; `@/src/app-state/pending`: `readPending(storage?: Pick<Storage, "getItem">): PendingRound | null` (only modes in `AVAILABLE_MODES` pass), `PENDING_KEY`, type `PendingRound`.
  - Task 9: `SkyBackdrop()`, `RoundButton({ label, children, ref, onClick })`, `PillButton({ children, trailingIcon, ref, onClick })`, `QuietButton({ children, ref, onClick })`, `AnswerButtons({ onAnswer: (value: boolean) => void })`, icons `CloseIcon`, `CheckIcon`, `CrossIcon`, `CloudIcon`, `BookIcon` and `ICON_PATHS.planeArrow` from `@/components/icons`; the screen skeleton (`<main className="flex min-h-0 flex-1 flex-col">`, header `h-(--size-header)` with `gap-(--space-12)`, stage `mt-(--space-12) flex-1`, actions `mt-(--space-12) h-(--size-actions)`); the `.sr-only` utility; the ink focus ring.
  - Task 2 CSS variables: `--color-` `ink`, `ink-muted`, `rule`, `accent`, `on-accent`, `true`, `false`, `correct`, `wrong`, `surface-raised`, `surface-sunk`, `scrim`; every `--type-*` of the roles `card-statement`, `carrier-title`, `carrier-label`, `leg-code`, `leg-name`, `field-label`, `field-value`, `answer-label`, `answer-value`, `stamp`, `intent-stamp`, `body`, `mono-data`, `mono-data-strong`, `route-label`, `step-title`; `--space-2/4/6/8/10/12/14/16/18/20/24`; `--size-header`, `--size-actions`, `--size-carrier`, `--size-ticket-inset`, `--size-statement-min`, `--size-lower`, `--size-barcode`, `--size-notch`, `--size-flight-path-height`, `--size-touch-min`, `--size-gutter`, `--size-safe-bottom`; `--radius-card`, `--radius-small`; `--stroke-rule`, `--stroke-perforation`, `--stroke-stamp`; `--elevation-ticket`, `--elevation-sheet`; `--duration-t2`, `--duration-t3`, `--easing-ease`, `--easing-spring`; `--gesture-rotation-divisor`, `--gesture-stub-pull`, `--gesture-intent-opacity-gain`; `--font-weight-mono-semibold`, `--font-weight-mono-regular`; and `--app-max-width` from `app/globals.css`.
- Produces (task 12 and task 13 rely on these):
  - `app/play/page.tsx`: default export `PlayPage()`, a server component rendering `<PlayScreen />`. Route `/play`, prerendered static.
  - `components/play/PlayScreen.tsx` (`"use client"`):
    - `PlayScreen(props: PlayScreenProps)`, `interface PlayScreenProps { services?: PlayServices }` (default `browserPlayServices`; pass a stable object).
    - `verdictText(correct: boolean, answer: boolean): string`, the live-region sentence, for example `"Not quite. The answer is False."`.
    - The finished round: the three lines from `// BEGIN finished-round placeholder (task 12 replaces this block)` to `// END finished-round placeholder` (one `if (round.phase === "finished") return <FinishedPlaceholder round={round} />;`) are where task 12 renders its result screen, and the block from `// BEGIN FinishedPlaceholder (task 12 deletes this component)` to `// END FinishedPlaceholder` is deleted by task 12. An abandoned round never reaches that line (it renders the loading view while navigating home). Task 12 also takes `restart` from `useRound(...)` for "Play again" (the destructuring in `PlayScreen` currently reads `status, dispatch, retry, progressStore`), records the finished round with `applyResult` through `progressStore()`, and updates the test "finishes the round after the tenth card" in `tests/components/play/PlayScreen.test.tsx`, which expects the placeholder heading "Round complete".
    - Accessible landmarks the end-to-end task can use: buttons "Leave round", "False", "True", "Next card", "Try again"; the flight path `role="img"` named `"Card N of T. ..."`; the verdict in the last `role="status"` element; the source `role="link"` named `"<title> (opens in a new tab)"`; the dialog `role="dialog"` named "Leave round?" with "Keep playing" and "Leave round"; the swipe target `[data-swipe-card]`; the statement `[data-statement]` (its last `<p>` is the statement text).
  - `components/play/useRound.ts`:
    - `interface PlayServices { fetcher: Fetcher; localStorage: () => Pick<Storage, "getItem" | "setItem"> | undefined; sessionStorage: () => Pick<Storage, "getItem"> | undefined; now: () => number; randomSeed: () => number }`. `now` is epoch ms (answer times and the settle time); `localStorage` holds progress, the deck cache and the index cache; `sessionStorage` holds the pending round.
    - `const browserPlayServices: PlayServices` (`fetch`, `browserLocalStorage`, `window.sessionStorage` guarded, `Date.now`, `crypto.getRandomValues`).
    - `const MODE_LABELS: Record<Mode, string>` (`classic` "Classic", `streak` "Streak", `lives` "Three lives", `timed` "Timed").
    - `interface TicketInfo { deckCode: string; deckName: string; sectionCode: string; sectionName: string; modeLabel: string }` (`deckName` is platform title plus deck title, "AWS Cloud Practitioner"; a whole-deck route is `"ALL"` / `"Whole deck"`).
    - `type RoundStatus = { kind: "loading" } | { kind: "redirecting" } | { kind: "error"; message: string } | { kind: "ready"; round: RoundState; ticket: TicketInfo }`.
    - `interface UseRoundResult { status: RoundStatus; dispatch(event: RoundEvent): void; retry(): void; restart(): void; progressStore(): ProgressStore }`.
    - `useRound(services: PlayServices, goHome: () => void): UseRoundResult`. `goHome` must be stable (`useCallback`); it is called when there is no pending round, or the deck or section has gone from the index, or the section has no cards. `restart` deals a new round on the same pending route with the history as stored at that moment.
    - `const LOAD_FAILED_MESSAGE = "This deck didn't load. Check your connection and try again."`, `locateRoute(index: DeckIndex, pending: PendingRound): { deck: IndexDeck; ticket: TicketInfo } | null`, `prepareRound(pending: PendingRound, services: PlayServices): Promise<{ round: RoundState; ticket: TicketInfo } | null>` (throws `LoadError`).
  - `components/play/useSwipe.ts`: `useSwipe<T extends HTMLElement>(options: UseSwipeOptions): SwipeBindings<T>`, `interface UseSwipeOptions { enabled: boolean; cardShownAt: () => number; now: () => number; onSwipe: (value: boolean) => void }`, `interface SwipeBindings<T> { ref: RefObject<T | null>; onPointerDown; onPointerMove; onPointerUp; onPointerCancel }` (each `(event: PointerEvent<T>) => void`). Writes `--drag-x` (unitless px), `--intent` and `--pull` on `ref.current` and sets `data-dragging` while a gesture runs.
  - `components/play/LeaveDialog.tsx` (`"use client"`): `LeaveDialog(props: LeaveDialogProps)`, `interface LeaveDialogProps { open: boolean; onStay: () => void; onLeave: () => void }`. Focuses "Keep playing" on open; Escape and a tap on the scrim call `onStay`; Tab stays inside. The caller makes the screen behind it `inert`.
  - `components/BoardingPass.tsx` (`"use client"`):
    - `BoardingPass(props: BoardingPassProps)`, `interface BoardingPassProps { from: PassLeg; to: PassLeg; fields: readonly [PassField, PassField, PassField]; children: ReactNode; lower: ReactNode; jolt?: boolean; className?: string }`, `interface PassLeg { code: string; name: string }`, `interface PassField { label: string; value: ReactNode }`. `children` is the body of the main part (the statement here, the score block on the result screen); `lower` is everything under the perforation. The result screen reuses this shell with its own body and lower part.
    - `PassLower(props: { tone: "raised" | "sunk"; children?: ReactNode; className?: string; style?: CSSProperties })`: the notched paper of a lower part (stub raised, slip and the result list sunk).
    - `PassStatement(props: { children: ReactNode; appliesTo?: string; ref?: Ref<HTMLDivElement>; id?: string })`: min height 188, `tabIndex={-1}`, the "Applies to ..." line above the statement only when `appliesTo` is not empty.
    - `PassStub(props: { routeLine: string; cardLabel: string; barcode: string; className?: string })`: render it as a direct child of `AnimatePresence custom={TearSide}`; `type TearSide = "left" | "right"`.
    - `PassSlip(props: { answer: boolean; correct: boolean; explanation: string; source: { title: string; url: string }; animateStamp?: boolean; className?: string })`.
    - `GateValue()`: "F ← → T", read as "False left, true right".
    - `BoardingPassPlaceholder()`: the decorative ticket shape for loading.
    - `barcodeBars(data: string): { bars: { x: number; width: number }[]; width: number }`, `interface BarcodeBar { x: number; width: number }`.
  - `components/FlightPath.tsx`: `FlightPath(props: FlightPathProps)`, `type FlightPathProps = RoundFlightPathProps | CompletedFlightPathProps`, `interface RoundFlightPathProps { variant?: "round"; total: number; results: readonly boolean[]; current: number; answered: boolean; className?: string }`, `interface CompletedFlightPathProps { variant: "completed"; total: number; results: readonly boolean[]; className?: string }` (the result screen's "Arrived · 10 of 10" path, named "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9."). Helpers: `type WaypointState = "correct" | "wrong" | "current" | "future"`, `waypointStates(total, results, current, answered): WaypointState[]`, `flightPathLabel(total, results, current): string`, `completedLabel(total, results): string`, `pointAt(t)`, `waypointT(i, n)`, `flownPath(t)`, `headingAt(t)`.
  - `components/Stamp.tsx` (`"use client"`): `Stamp(props: StampProps)`, `type Verdict = "correct" | "wrong"`, `interface StampProps { verdict: Verdict; animate?: boolean; className?: string }`, `SPRING_EASE` (`[0.34, 1.56, 0.64, 1]`).
  - `tests/components/play/fixtures.ts`: `harness(pending?, local?)` returning `{ services, network, local, session, advance(ms) }`, `memoryStorage(initial?)`, `fakeNetwork(files?)` (`online`, `hold`, `release()`, `calls`), `DECK`, `INDEX`, `DECK_ID`, `cardByStatement(statement)`, and the types `Harness`, `MemoryStorage`, `FakeNetwork`. Task 12's tests reuse them.

- [ ] **Step 1: Write the failing tests for the flight path**

Create `tests/components/FlightPath.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  FlightPath,
  completedLabel,
  flightPathLabel,
  flownPath,
  headingAt,
  pointAt,
  waypointStates,
  waypointT,
} from "@/components/FlightPath";

afterEach(cleanup);

function waypoints(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll("[data-waypoint]")].map((element) => element.getAttribute("data-waypoint"));
}

describe("flight path geometry", () => {
  it("runs along the curve M6 24 Q138 -6 270 24, waypoints evenly spread in t", () => {
    expect(pointAt(0)).toEqual({ x: 6, y: 24 });
    expect(pointAt(1)).toEqual({ x: 270, y: 24 });
    expect(pointAt(0.5)).toEqual({ x: 138, y: 9 });
    expect(waypointT(0, 10)).toBe(0);
    expect(waypointT(9, 10)).toBe(1);
    expect(waypointT(3, 10)).toBeCloseTo(1 / 3);
    expect(waypointT(0, 1)).toBe(0);
  });

  it("draws the flown part as the same curve cut at the plane", () => {
    expect(flownPath(1)).toBe("M6 24 Q138 -6 270 24");
    expect(flownPath(0.5)).toBe("M6 24 Q72 9 138 9");
  });

  it("points the plane along the curve: climbing at the start, level in the middle, descending at the end", () => {
    expect(headingAt(0)).toBeLessThan(0);
    expect(headingAt(0.5)).toBe(0);
    expect(headingAt(1)).toBeGreaterThan(0);
  });
});

describe("waypointStates", () => {
  it("marks answered cards correct or wrong, the card on screen current, the rest future", () => {
    expect(waypointStates(5, [true, false], 2, false)).toEqual(["correct", "wrong", "current", "future", "future"]);
  });

  it("shows the card on screen with its own mark once it is answered", () => {
    expect(waypointStates(4, [true, false, false], 2, true)).toEqual(["correct", "wrong", "wrong", "future"]);
  });
});

describe("flightPathLabel", () => {
  it("is one full sentence with the card numbers of each verdict", () => {
    expect(flightPathLabel(10, [true, true, false], 3)).toBe("Card 4 of 10. Cards 1 and 2 correct, card 3 wrong.");
    expect(flightPathLabel(10, [false, true, true, true], 4)).toBe("Card 5 of 10. Cards 2, 3 and 4 correct, card 1 wrong.");
  });

  it("says only where the round is before the first answer", () => {
    expect(flightPathLabel(10, [], 0)).toBe("Card 1 of 10.");
  });
});

describe("FlightPath", () => {
  it("is one image whose name says the progress and the verdicts", () => {
    render(<FlightPath total={10} results={[true, true, false]} current={3} answered={false} />);
    expect(screen.getByRole("img", { name: "Card 4 of 10. Cards 1 and 2 correct, card 3 wrong." })).toBeTruthy();
  });

  it("shows card N of total and the tally in the label row", () => {
    const { container } = render(<FlightPath total={10} results={[true, true, false]} current={3} answered={false} />);
    expect(container.querySelector("[data-progress]")?.textContent).toBe("Card 4 of 10");
    expect(container.querySelector("[data-tally]")?.textContent).toBe("2 correct · 1 wrong");
  });

  it("draws a waypoint per card and tells them apart by shape, not colour alone", () => {
    const { container } = render(<FlightPath total={10} results={[true, true, false]} current={3} answered={false} />);
    expect(waypoints(container)).toEqual([
      "correct",
      "correct",
      "wrong",
      "current",
      "future",
      "future",
      "future",
      "future",
      "future",
      "future",
    ]);
    expect(container.querySelector('[data-waypoint="correct"] circle')).not.toBeNull();
    expect(container.querySelector('[data-waypoint="wrong"] rect')).not.toBeNull();
    expect(container.querySelector('[data-waypoint="future"] circle')?.getAttribute("r")).toBe("4");
    expect(container.querySelectorAll("[data-waypoint]")[9]?.querySelector("circle")?.getAttribute("r")).toBe("5");
  });

  it("puts the plane on the card on screen and fades it out once that card is answered", () => {
    const question = render(<FlightPath total={10} results={[true, true, false]} current={3} answered={false} />);
    const plane = question.container.querySelector("[data-plane]");
    const at = pointAt(1 / 3);
    expect(plane?.getAttribute("transform")).toContain(`translate(${at.x} ${at.y})`);
    expect(plane?.getAttribute("class")).toContain("opacity-100");
    cleanup();
    const answered = render(<FlightPath total={10} results={[true, true, false, true]} current={3} answered />);
    expect(answered.container.querySelector("[data-plane]")?.getAttribute("class")).toContain("opacity-0");
    expect(waypoints(answered.container)[3]).toBe("correct");
    expect(answered.container.querySelector("[data-tally]")?.textContent).toBe("3 correct · 1 wrong");
  });

  it("has no flown line before the first card is left", () => {
    const { container } = render(<FlightPath total={10} results={[]} current={0} answered={false} />);
    expect(container.querySelectorAll("svg > path")).toHaveLength(1);
  });
});

describe("FlightPath, completed (result screens)", () => {
  const results = [true, true, false, true, true, false, true, true, false, true];

  it("names the finished round and lists the missed cards", () => {
    expect(completedLabel(10, results)).toBe("Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.");
    expect(completedLabel(10, Array.from({ length: 10 }, () => true))).toBe("Round complete. 10 of 10 cards. 10 correct, 0 wrong.");
    render(<FlightPath variant="completed" total={10} results={results} />);
    expect(screen.getByRole("img", { name: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." })).toBeTruthy();
  });

  it("flies the whole route: every card resolved, the line solid to the end, no plane", () => {
    const { container } = render(<FlightPath variant="completed" total={10} results={results} />);
    expect(waypoints(container)).toEqual(results.map((ok) => (ok ? "correct" : "wrong")));
    expect(container.querySelector("[data-plane]")).toBeNull();
    expect(container.querySelectorAll("svg > path")[1]?.getAttribute("d")).toBe("M6 24 Q138 -6 270 24");
  });

  it("reads Arrived with the count and the tally", () => {
    const { container } = render(<FlightPath variant="completed" total={10} results={results} />);
    expect(container.querySelector("[data-progress]")?.textContent).toBe("Arrived · 10 of 10");
    expect(container.querySelector("[data-tally]")?.textContent).toBe("7 correct · 3 wrong");
  });
});
```

- [ ] **Step 2: Run the flight path tests and watch them fail**

```bash
pnpm vitest run tests/components/FlightPath.test.tsx
```

Expected: the suite fails to load with `Error: Failed to resolve import "@/components/FlightPath" from "tests/components/FlightPath.test.tsx". Does the file exist?` and `Tests  no tests`.

- [ ] **Step 3: Create the flight path**

Create `components/FlightPath.tsx`. The curve, the marks and the label row are those of `game-classic.html` (`.route`) and, for the completed variant, `result-classic.html`; waypoints sit at t = i / (n - 1) on the curve, as the result screen's script places them.

```tsx
// The flight-path header of a Classic round (design system 5.10, "Count" and "Completed" variants): the route as a curve
// with one waypoint per card, the plane on the card on screen, and a label row with the progress and the
// tally. Waypoints differ by shape as well as colour: a circle with a tick (correct), a square with an x
// (wrong), the plane (current), a small open circle (still to come). The whole path is one image with a
// full-sentence label; the label row is hidden from screen readers because the image already says it.
import { ICON_PATHS } from "./icons";

export type WaypointState = "correct" | "wrong" | "current" | "future";

/** During a round: the plane on the card on screen. */
export interface RoundFlightPathProps {
  variant?: "round";
  /** Number of cards in the round (10 in Classic, fewer when the route has fewer cards). */
  total: number;
  /** Whether each answered card was correct, in order. */
  results: readonly boolean[];
  /** Index (from 0) of the card on screen. */
  current: number;
  /** True once the card on screen has been answered: the plane fades out and the card shows its mark. */
  answered: boolean;
  className?: string;
}

/** On the result screen: the whole route flown, every card resolved, no plane ("Arrived · 10 of 10"). */
export interface CompletedFlightPathProps {
  variant: "completed";
  total: number;
  results: readonly boolean[];
  className?: string;
}

export type FlightPathProps = RoundFlightPathProps | CompletedFlightPathProps;

// The curve of the route, M6 24 Q138 -6 270 24, in the 276 by 34 viewBox.
const P0 = { x: 6, y: 24 };
const P1 = { x: 138, y: -6 };
const P2 = { x: 270, y: 24 };

interface Point {
  x: number;
  y: number;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The point of the curve at t (0 to 1). */
export function pointAt(t: number): Point {
  const p = lerp(lerp(P0, P1, t), lerp(P1, P2, t), t);
  return { x: round2(p.x), y: round2(p.y) };
}

/** Where waypoint i of n sits on the curve: evenly spread in t, the first at the start, the last at the end. */
export function waypointT(i: number, n: number): number {
  return n <= 1 ? 0 : i / (n - 1);
}

/** The flown part of the curve, from the start to t, as an SVG path (the curve split at t). */
export function flownPath(t: number): string {
  const control = lerp(P0, P1, t);
  const end = pointAt(t);
  return `M${P0.x} ${P0.y} Q${round2(control.x)} ${round2(control.y)} ${end.x} ${end.y}`;
}

/** The plane's heading at t, in degrees (the direction of the curve). */
export function headingAt(t: number): number {
  const dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x);
  const dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);
  return round2((Math.atan2(dy, dx) * 180) / Math.PI);
}

/** The state of every waypoint. */
export function waypointStates(total: number, results: readonly boolean[], current: number, answered: boolean): WaypointState[] {
  return Array.from({ length: total }, (_, i) => {
    const result = results[i];
    if (result !== undefined && (i < current || answered)) return result ? "correct" : "wrong";
    if (i === current) return "current";
    return "future";
  });
}

// "card 3", "cards 1 and 2", "cards 1, 2 and 5"
function cardList(numbers: readonly number[]): string {
  if (numbers.length === 1) return `card ${numbers[0]}`;
  const head = numbers.slice(0, -1).join(", ");
  return `cards ${head} and ${numbers[numbers.length - 1]}`;
}

/** The accessible label: "Card 4 of 10. Cards 1 and 2 correct, card 3 wrong." */
export function flightPathLabel(total: number, results: readonly boolean[], current: number): string {
  const correct: number[] = [];
  const wrong: number[] = [];
  results.forEach((result, i) => (result ? correct : wrong).push(i + 1));
  const parts: string[] = [];
  if (correct.length > 0) parts.push(`${cardList(correct)} correct`);
  if (wrong.length > 0) parts.push(`${cardList(wrong)} wrong`);
  const head = `Card ${current + 1} of ${total}.`;
  if (parts.length === 0) return head;
  const tally = parts.join(", ");
  return `${head} ${tally.charAt(0).toUpperCase()}${tally.slice(1)}.`;
}

/** The accessible label of a finished round: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." */
export function completedLabel(total: number, results: readonly boolean[]): string {
  const wrong: number[] = [];
  results.forEach((result, i) => {
    if (!result) wrong.push(i + 1);
  });
  const correct = results.length - wrong.length;
  const head = `Round complete. ${results.length} of ${total} cards. ${correct} correct, ${wrong.length} wrong`;
  return wrong.length === 0 ? `${head}.` : `${head}: ${cardList(wrong)}.`;
}

const MARK_STROKE = 1.8;

function Waypoint({ state, at, isLast, isCurrent }: { state: WaypointState; at: Point; isLast: boolean; isCurrent: boolean }) {
  if (state === "correct") {
    // The card just answered shows its tick on the correct colour; earlier ones are ink.
    return (
      <g data-waypoint="correct" transform={`translate(${at.x} ${at.y})`}>
        <circle r="7" className={isCurrent ? "fill-(--color-correct)" : "fill-(--color-ink)"} />
        <path d="M-3 0l2 2 4-4" fill="none" className="stroke-(--color-surface-raised)" strokeWidth={MARK_STROKE} />
      </g>
    );
  }
  if (state === "wrong") {
    return (
      <g data-waypoint="wrong" transform={`translate(${at.x} ${at.y})`}>
        <rect x="-6.5" y="-6.5" width="13" height="13" rx="2" className="fill-(--color-wrong)" />
        <path d="M-3-3l6 6m0-6l-6 6" className="stroke-(--color-surface-raised)" strokeWidth={MARK_STROKE} />
      </g>
    );
  }
  if (state === "current") {
    // The plane is drawn on top of everything by the caller; this keeps the waypoint's place in the list.
    return <g data-waypoint="current" transform={`translate(${at.x} ${at.y})`} />;
  }
  return (
    <g data-waypoint="future" transform={`translate(${at.x} ${at.y})`}>
      <circle r={isLast ? 5 : 4} className="fill-(--color-surface-raised) stroke-(--color-ink)" strokeWidth="1.6" />
    </g>
  );
}

export function FlightPath(props: FlightPathProps) {
  const { total, results, className } = props;
  const completed = props.variant === "completed";
  const current = completed ? total - 1 : props.current;
  const answered = completed ? true : props.answered;
  const states = waypointStates(total, results, completed ? total : current, answered);
  const t = completed ? 1 : waypointT(current, total);
  const plane = pointAt(t);
  const correct = results.filter(Boolean).length;
  const wrong = results.length - correct;

  return (
    <div
      role="img"
      aria-label={completed ? completedLabel(total, results) : flightPathLabel(total, results, current)}
      data-flight-path=""
      className={["min-w-0 flex-1", className].filter(Boolean).join(" ")}
    >
      <svg viewBox="0 0 276 34" aria-hidden="true" focusable="false" className="block h-(--size-flight-path-height) w-full overflow-visible">
        <path
          d={`M${P0.x} ${P0.y} Q${P1.x} ${P1.y} ${P2.x} ${P2.y}`}
          fill="none"
          className="stroke-(--color-ink)"
          strokeWidth="1.6"
          strokeDasharray="2 5"
          strokeLinecap="round"
        />
        {t > 0 ? <path d={flownPath(t)} fill="none" className="stroke-(--color-ink)" strokeWidth="2.4" strokeLinecap="round" /> : null}
        {states.map((state, i) => (
          <Waypoint
            key={i}
            state={state}
            at={pointAt(waypointT(i, total))}
            isLast={i === total - 1}
            isCurrent={!completed && i === current}
          />
        ))}
        {completed ? null : (
          <g
            data-plane=""
            transform={`translate(${plane.x} ${plane.y}) rotate(${headingAt(t)})`}
            className={[
              "transition-opacity duration-(--duration-t2) ease-(--easing-ease)",
              answered ? "opacity-0" : "opacity-100",
            ].join(" ")}
          >
            <circle r="12" className="fill-(--color-accent)" />
            <path
              d={ICON_PATHS.planeArrow}
              fill="none"
              className="stroke-(--color-on-accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}
      </svg>
      <div
        aria-hidden="true"
        className="mt-(--space-2) flex justify-between font-(family-name:--type-route-label-family) text-(length:--type-route-label-size) leading-(--type-route-label-line-height) font-(--type-route-label-weight) tracking-(--type-route-label-letter-spacing) text-(--color-ink)"
      >
        {completed ? (
          <span data-progress="">
            <b className="font-(--font-weight-mono-semibold)">Arrived</b> · {results.length} of {total}
          </span>
        ) : (
          <span data-progress="">
            Card <b className="font-(--font-weight-mono-semibold)">{current + 1}</b> of {total}
          </span>
        )}
        <span data-tally="">
          {correct} correct · {wrong} wrong
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the flight path tests and watch them pass**

```bash
pnpm vitest run tests/components/FlightPath.test.tsx
```

Expected: `Tests  15 passed (15)`.

- [ ] **Step 5: Commit**

```bash
git add components/FlightPath.tsx tests/components/FlightPath.test.tsx
git commit -m "feat: add the flight-path header with shaped waypoints"
```

- [ ] **Step 6: Write the failing tests for the stamp**

Create `tests/components/Stamp.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Stamp } from "@/components/Stamp";

afterEach(cleanup);

function stampOf(container: HTMLElement): HTMLElement {
  const stamp = container.querySelector<HTMLElement>("[data-verdict]");
  if (!stamp) throw new Error("no stamp rendered");
  return stamp;
}

describe("Stamp", () => {
  it("says Correct with a check in the correct colour", () => {
    const stamp = stampOf(render(<Stamp verdict="correct" />).container);
    expect(stamp.textContent).toBe("Correct");
    expect(stamp.className).toContain("text-(--color-correct)");
    expect(stamp.querySelector("path")?.getAttribute("d")).toBe("M3 9.5l4 4 8-9");
    expect(stamp.querySelector("svg")?.getAttribute("width")).toBe("22");
  });

  it("says Not quite with an X in the wrong colour", () => {
    const stamp = stampOf(render(<Stamp verdict="wrong" />).container);
    expect(stamp.textContent).toBe("Not quite");
    expect(stamp.className).toContain("text-(--color-wrong)");
    expect(stamp.querySelector("path")?.getAttribute("d")).toBe("M3 3l10 10M13 3L3 13");
    expect(stamp.querySelector("svg")?.getAttribute("width")).toBe("18");
  });

  it("keeps its icon out of the accessible text: the word carries the verdict", () => {
    const stamp = stampOf(render(<Stamp verdict="correct" />).container);
    expect(stamp.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("has the double 3px border and sits at rest tilted by -6 degrees", () => {
    const stamp = stampOf(render(<Stamp verdict="correct" />).container);
    expect(stamp.className).toContain("border-double");
    expect(stamp.className).toContain("border-(length:--stroke-stamp)");
    expect(stamp.style.transform).toContain("rotate(-6deg)");
    expect(stamp.style.opacity).toBe("1");
  });

  it("starts large, turned and invisible when it is to land", () => {
    const stamp = stampOf(render(<Stamp verdict="wrong" animate />).container);
    expect(stamp.style.opacity).toBe("0");
    expect(stamp.style.transform).toContain("scale(1.9)");
    expect(stamp.style.transform).toContain("rotate(-14deg)");
  });
});
```

- [ ] **Step 7: Run the stamp tests and watch them fail**

```bash
pnpm vitest run tests/components/Stamp.test.tsx
```

Expected: the suite fails to load with `Failed to resolve import "@/components/Stamp"`.

- [ ] **Step 8: Create the stamp**

Create `components/Stamp.tsx` (`.stamp` and `@keyframes stamp` of `game-classic.html`):

```tsx
"use client";

// The verdict stamp on the answer slip (design system 5.11, "Slip verdict"): the only tilted element and
// the only celebration. Icon plus word plus colour, so the verdict never depends on colour alone:
// a check and "Correct" in the correct colour, an X and "Not quite" in the wrong colour.
// When it lands it scales from 1.9 and turns from -14 to -6 degrees (420 ms spring, 380 ms delay);
// with reduced motion it is simply shown at rest.
import { motion, useReducedMotion } from "motion/react";
import { CheckIcon, CrossIcon } from "./icons";

export type Verdict = "correct" | "wrong";

export interface StampProps {
  verdict: Verdict;
  /** Play the landing animation when the stamp appears. Without it the stamp is shown at rest. */
  animate?: boolean;
  className?: string;
}

/** The spring curve of the design (cubic-bezier 0.34, 1.56, 0.64, 1), as Motion wants it. */
export const SPRING_EASE = [0.34, 1.56, 0.64, 1] as const;

const REST = { opacity: 1, scale: 1, rotate: -6 };
const LANDING = { opacity: 0, scale: 1.9, rotate: -14 };

const BASE =
  "inline-flex flex-none items-center gap-(--space-8) px-(--space-14) pt-(--space-6) pb-(--space-4) " +
  "rounded-(--radius-small) border-(length:--stroke-stamp) border-double border-current " +
  "font-(family-name:--type-stamp-family) text-(length:--type-stamp-size) font-(--type-stamp-weight) " +
  "leading-(--type-stamp-line-height) tracking-(--type-stamp-letter-spacing) whitespace-nowrap";

export function Stamp({ verdict, animate = false, className }: StampProps) {
  const reduced = useReducedMotion() ?? false;
  const land = animate && !reduced;
  return (
    <motion.div
      data-verdict={verdict}
      className={[BASE, verdict === "correct" ? "text-(--color-correct)" : "text-(--color-wrong)", className]
        .filter(Boolean)
        .join(" ")}
      initial={land ? LANDING : false}
      animate={REST}
      transition={{ duration: 0.42, delay: 0.38, ease: SPRING_EASE }}
    >
      {verdict === "correct" ? <CheckIcon size={22} /> : <CrossIcon size={18} />}
      {verdict === "correct" ? "Correct" : "Not quite"}
    </motion.div>
  );
}
```

- [ ] **Step 9: Run the stamp tests and watch them pass**

```bash
pnpm vitest run tests/components/Stamp.test.tsx
```

Expected: `Tests  5 passed (5)`.

- [ ] **Step 10: Commit**

```bash
git add components/Stamp.tsx tests/components/Stamp.test.tsx
git commit -m "feat: add the verdict stamp"
```

- [ ] **Step 11: Write the failing tests for the boarding pass**

Create `tests/components/BoardingPass.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { AnimatePresence } from "motion/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  BoardingPass,
  BoardingPassPlaceholder,
  GateValue,
  PassLower,
  PassSlip,
  PassStatement,
  PassStub,
  barcodeBars,
} from "@/components/BoardingPass";

afterEach(cleanup);

function renderPass() {
  return render(
    <BoardingPass
      from={{ code: "CLF", name: "AWS Cloud Practitioner" }}
      to={{ code: "SEC", name: "Security and compliance" }}
      fields={[
        { label: "Class", value: "Classic" },
        { label: "Card", value: "04 / 10" },
        { label: "Gate", value: <GateValue /> },
      ]}
      lower={<PassLower tone="raised">lower part</PassLower>}
    >
      <p>body</p>
    </BoardingPass>,
  );
}

describe("BoardingPass", () => {
  it("shows both legs with their code and name", () => {
    const { container } = renderPass();
    expect(container.querySelector('[data-leg="from"]')?.textContent).toBe("CLFAWS Cloud Practitioner");
    expect(container.querySelector('[data-leg="to"]')?.textContent).toBe("SECSecurity and compliance");
  });

  it("lists the three fields as terms and values", () => {
    renderPass();
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    const values = screen.getAllByRole("definition").map((value) => value.textContent);
    expect(terms).toEqual(["Class", "Card", "Gate"]);
    expect(values.slice(0, 2)).toEqual(["Classic", "04 / 10"]);
  });

  it("reads the gate as words, not as arrows", () => {
    renderPass();
    const gate = screen.getAllByRole("definition")[2];
    expect(gate?.querySelector('[aria-hidden="true"]')?.textContent).toBe("F ← → T");
    expect(gate?.querySelector(".sr-only")?.textContent).toBe("False left, true right");
  });

  it("keeps the carrier band out of the accessible text", () => {
    const { container } = renderPass();
    const band = [...container.querySelectorAll('[aria-hidden="true"]')].find((element) => element.textContent?.includes("BOARDING PASS"));
    expect(band?.textContent).toBe("TruthyBOARDING PASS");
  });

  it("renders the body in the main part and the lower part after it", () => {
    const { container } = renderPass();
    expect(screen.getByText("body")).toBeTruthy();
    const lower = screen.getByText("lower part");
    expect(lower.getAttribute("data-tone")).toBe("raised");
    expect(container.querySelector("[data-boarding-pass]")?.lastElementChild).toBe(lower);
  });
});

describe("PassStatement", () => {
  it("shows the statement and can take focus without being a tab stop", () => {
    const { container } = render(<PassStatement>AWS patches the guest OS.</PassStatement>);
    const statement = container.querySelector<HTMLElement>("[data-statement]");
    expect(statement?.textContent).toBe("AWS patches the guest OS.");
    expect(statement?.getAttribute("tabindex")).toBe("-1");
  });

  it("shows appliesTo as one small line above the statement when it is set", () => {
    const { container } = render(<PassStatement appliesTo="Next.js 16">The cache is opt-in.</PassStatement>);
    const lines = [...container.querySelectorAll("[data-statement] p")].map((line) => line.textContent);
    expect(lines).toEqual(["Applies to Next.js 16", "The cache is opt-in."]);
  });

  it("shows no appliesTo line when it is empty", () => {
    const { container } = render(<PassStatement appliesTo="">The cache is opt-in.</PassStatement>);
    expect(container.querySelectorAll("[data-statement] p")).toHaveLength(1);
    expect(screen.queryByText(/Applies to/)).toBeNull();
  });
});

describe("PassSlip", () => {
  const source = { title: "Shared responsibility model", url: "https://aws.amazon.com/compliance/shared-responsibility-model/" };

  it("shows the right answer, the verdict, the explanation and the source", () => {
    render(<PassSlip answer={false} correct explanation="You patch the guest OS on EC2." source={source} />);
    expect(screen.getByText("The answer is").textContent).toBe("The answer isFalse");
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(screen.getByText("You patch the guest OS on EC2.")).toBeTruthy();
  });

  it("says Not quite and the right answer after a wrong answer", () => {
    const { container } = render(<PassSlip answer={true} correct={false} explanation="Explained." source={source} />);
    expect(container.querySelector("[data-verdict]")?.textContent).toBe("Not quite");
    expect(container.querySelector("b")?.textContent).toBe("True");
  });

  it("opens the source in a new tab, safely, and says so", () => {
    render(<PassSlip answer={false} correct explanation="Explained." source={source} />);
    const link = screen.getByRole("link", { name: "Shared responsibility model (opens in a new tab)" });
    expect(link.getAttribute("href")).toBe(source.url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("sits on the sunk paper", () => {
    const { container } = render(<PassSlip answer={false} correct explanation="Explained." source={source} />);
    expect(container.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("sunk");
  });
});

describe("PassStub", () => {
  function renderStub() {
    return render(
      <AnimatePresence>
        <PassStub routeLine="CLF → SEC · Classic" cardLabel="Card 04" barcode="aws-clf-c02-t2.1-06" />
      </AnimatePresence>,
    );
  }

  it("shows the route line, the card number and the swipe hint", () => {
    const { container } = renderStub();
    const stub = container.querySelector("[data-stub]");
    expect(stub?.textContent).toContain("CLF → SEC · Classic");
    expect(stub?.textContent).toContain("Card 04");
    expect(stub?.textContent).toContain("← False");
    expect(stub?.textContent).toContain("swipe to board");
    expect(stub?.textContent).toContain("True →");
  });

  it("is decorative: hidden from screen readers (the buttons say the same)", () => {
    const { container } = renderStub();
    expect(container.querySelector("[data-stub]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("draws the barcode from the data it is given", () => {
    const { container } = renderStub();
    const barcode = container.querySelector("[data-barcode]");
    const { bars, width } = barcodeBars("aws-clf-c02-t2.1-06");
    expect(barcode?.getAttribute("viewBox")).toBe(`0 0 ${width} 56`);
    expect(barcode?.querySelectorAll("rect")).toHaveLength(bars.length);
  });

  it("carries the True and False intent stamps, driven by --intent", () => {
    const { container } = renderStub();
    const trueStamp = container.querySelector<HTMLElement>('[data-intent="true"]');
    const falseStamp = container.querySelector<HTMLElement>('[data-intent="false"]');
    expect(trueStamp?.textContent).toBe("True");
    expect(falseStamp?.textContent).toBe("False");
    expect(trueStamp?.style.opacity).toContain("var(--intent, 0)");
    expect(falseStamp?.style.opacity).toContain("-1");
  });
});

describe("barcodeBars", () => {
  it("starts with bars 2/1/1/2 and ends with 1/1/2", () => {
    const { bars, width } = barcodeBars("A");
    expect(bars[0]).toEqual({ x: 0, width: 2 });
    expect(bars[1]).toEqual({ x: 3, width: 1 });
    expect(bars.at(-1)).toEqual({ x: width - 2, width: 2 });
    expect(bars.at(-2)).toEqual({ x: width - 4, width: 1 });
  });

  it("gives each character 7 bars and a gap, 2 wide for a 1 bit and 1 wide for a 0 bit", () => {
    // "A" is 1000001: bits 0 and 6 are 1, so 2+1+1+1+1+1+2 = 9, plus the 1-wide gap.
    expect(barcodeBars("A").width).toBe(6 + 10 + 4);
    expect(barcodeBars("AA").width).toBe(6 + 20 + 4);
  });

  it("is the same for the same data and different for different data", () => {
    expect(barcodeBars("aws-clf-c02-t2.1-06")).toEqual(barcodeBars("aws-clf-c02-t2.1-06"));
    expect(barcodeBars("aws-clf-c02-t2.1-06")).not.toEqual(barcodeBars("aws-clf-c02-t2.1-07"));
  });
});

describe("BoardingPassPlaceholder", () => {
  it("is a quiet, decorative shape with no text", () => {
    const { container } = render(<BoardingPassPlaceholder />);
    const placeholder = container.querySelector("[data-pass-placeholder]");
    expect(placeholder?.getAttribute("aria-hidden")).toBe("true");
    expect(placeholder?.textContent).toBe("");
  });
});
```

- [ ] **Step 12: Run the boarding pass tests and watch them fail**

```bash
pnpm vitest run tests/components/BoardingPass.test.tsx
```

Expected: the suite fails to load with `Failed to resolve import "@/components/BoardingPass"`.

- [ ] **Step 13: Create the boarding pass**

Create `components/BoardingPass.tsx`. It ports `.main`, `.carrier`, `.legs`, `.meta`, `.statement`, `.perf`, `.stub`, `.intent`, `.slip`, `.res`, `.explain` and `.source` of `game-classic.html`, and the barcode algorithm of the design system's portability notes. Two choices differ from the mockup's HTML on purpose and match its pictures: the 40 px column between the legs is empty (the mockup's arrow there collapses to zero height, and no approved screen shows it), and the legs align at the top (`items-start`), which equals the mockup when both names take two lines and keeps the codes level when a real name fits on one.

```tsx
"use client";

// The boarding pass (design system 5.2): the ticket that carries the round. BoardingPass is the shell
// (shadow box, carrier band, legs, field grid, a body, the perforation and a lower part); the game fills
// the body with PassStatement and the lower part with PassStub (question) or PassSlip (answered).
// The result screen reuses the shell with its own body and lower part (PassLower gives the notched paper).
import { motion, useReducedMotion, type Variants } from "motion/react";
import type { CSSProperties, ReactNode, Ref } from "react";
import { Stamp } from "./Stamp";
import { BookIcon, CheckIcon, CloudIcon, CrossIcon } from "./icons";

export interface PassLeg {
  /** Three-letter code in the leg-code role, for example "CLF" or "SEC" ("ALL" for the whole deck). */
  code: string;
  /** The name under the code, for example "AWS Cloud Practitioner" or "Whole deck". */
  name: string;
}

export interface PassField {
  label: string;
  value: ReactNode;
}

export interface BoardingPassProps {
  from: PassLeg;
  to: PassLeg;
  /** The three cells of the field grid, for example Class / Card / Gate. */
  fields: readonly [PassField, PassField, PassField];
  /** The body of the main part: the statement (game) or the score (result). */
  children: ReactNode;
  /** The lower part under the perforation: a stub, a slip or a list, drawn with PassLower. */
  lower: ReactNode;
  /** True when the main part should give its small jolt (the stamp landing). Ignored with reduced motion. */
  jolt?: boolean;
  className?: string;
}

/** Notched paper: half circles of radius --size-notch cut into both sides at the given edge. */
function notchedPaper(colour: string, edge: "top" | "bottom"): string {
  const y = edge === "top" ? "0" : "100%";
  return [
    `radial-gradient(circle at 0 ${y}, transparent var(--size-notch), ${colour} calc(var(--size-notch) + 0.5px)) left / 51% 100% no-repeat`,
    `radial-gradient(circle at 100% ${y}, transparent var(--size-notch), ${colour} calc(var(--size-notch) + 0.5px)) right / 51% 100% no-repeat`,
  ].join(", ");
}

const MAIN_PAPER: CSSProperties = { background: notchedPaper("var(--color-surface-raised)", "bottom") };
const PERFORATION: CSSProperties = {
  left: "calc(var(--size-notch) + var(--space-6))",
  right: "calc(var(--size-notch) + var(--space-6))",
  background: "repeating-linear-gradient(90deg, var(--color-rule) 0 7px, transparent 7px 12px)",
};

const JOLT: Variants = {
  rest: { y: 0 },
  jolt: { y: [0, 2, 0], transition: { duration: 0.26, delay: 0.42, times: [0, 0.4, 1], ease: [0.2, 0.7, 0.2, 1] } },
};

const FIELD_LABEL =
  "font-(family-name:--type-field-label-family) text-(length:--type-field-label-size) font-(--type-field-label-weight) " +
  "leading-(--type-field-label-line-height) tracking-(--type-field-label-letter-spacing) text-(--color-ink-muted)";
const FIELD_VALUE =
  "m-0 mt-(--space-2) font-(family-name:--type-field-value-family) text-(length:--type-field-value-size) " +
  "font-(--type-field-value-weight) leading-(--type-field-value-line-height) tracking-(--type-field-value-letter-spacing)";
const LEG_CODE =
  "block font-(family-name:--type-leg-code-family) text-(length:--type-leg-code-size) font-(--type-leg-code-weight) " +
  "leading-(--type-leg-code-line-height) tracking-(--type-leg-code-letter-spacing)";
const LEG_NAME =
  "mt-(--space-6) block font-(family-name:--type-leg-name-family) text-(length:--type-leg-name-size) " +
  "font-(--type-leg-name-weight) leading-(--type-leg-name-line-height) tracking-(--type-leg-name-letter-spacing) text-(--color-ink-muted)";

export function BoardingPass({ from, to, fields, children, lower, jolt = false, className }: BoardingPassProps) {
  const reduced = useReducedMotion() ?? false;
  return (
    <div data-boarding-pass="" className={["relative text-(--color-ink)", className].filter(Boolean).join(" ")}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-(--radius-card) shadow-(--elevation-ticket)" />
      <motion.div
        className="relative overflow-hidden rounded-t-(--radius-card)"
        style={MAIN_PAPER}
        variants={JOLT}
        initial={false}
        animate={jolt && !reduced ? "jolt" : "rest"}
      >
        <div
          aria-hidden="true"
          className="flex h-(--size-carrier) items-center gap-(--space-10) bg-(--color-accent) px-(--space-16) text-(--color-on-accent)"
        >
          <CloudIcon />
          <span className="font-(family-name:--type-carrier-title-family) text-(length:--type-carrier-title-size) leading-(--type-carrier-title-line-height) font-(--type-carrier-title-weight) tracking-(--type-carrier-title-letter-spacing)">
            Truthy
          </span>
          <span className="ml-auto font-(family-name:--type-carrier-label-family) text-(length:--type-carrier-label-size) leading-(--type-carrier-label-line-height) font-(--type-carrier-label-weight) tracking-(--type-carrier-label-letter-spacing)">
            BOARDING PASS
          </span>
        </div>
        {/* The approved screens show no arrow between the legs (the mockup's 40px arrow collapses to zero
            height), only its 40px column. Codes align at the top so a one-line name does not push its code down. */}
        <div className="grid grid-cols-[1fr_40px_1fr] items-start gap-(--space-8) px-(--size-ticket-inset) pt-(--space-14) pb-(--space-12)">
          <div data-leg="from">
            <span className={LEG_CODE}>{from.code}</span>
            <span className={LEG_NAME}>{from.name}</span>
          </div>
          <span aria-hidden="true" />
          <div data-leg="to" className="text-right">
            <span className={LEG_CODE}>{to.code}</span>
            <span className={LEG_NAME}>{to.name}</span>
          </div>
        </div>
        <dl className="mx-(--size-ticket-inset) my-0 grid grid-cols-[1.1fr_1fr_1fr] border-y-(length:--stroke-rule) border-(--color-rule)">
          {fields.map((field, i) => (
            <div
              key={field.label}
              className={[
                "pt-(--space-8) pb-[7px]",
                i > 0 ? "border-l-(length:--stroke-rule) border-(--color-rule) pl-(--space-12)" : "",
              ].join(" ")}
            >
              <dt className={FIELD_LABEL}>{field.label}</dt>
              <dd className={FIELD_VALUE}>{field.value}</dd>
            </div>
          ))}
        </dl>
        {children}
        <div aria-hidden="true" className="absolute bottom-0 h-(--stroke-perforation)" style={PERFORATION} />
      </motion.div>
      {lower}
    </div>
  );
}

/** The value of the Gate field: "F ← → T", read as "False left, True right". */
export function GateValue() {
  return (
    <>
      <span aria-hidden="true" className="whitespace-nowrap">F ← → T</span>
      <span className="sr-only">False left, true right</span>
    </>
  );
}

export interface PassStatementProps {
  /** The statement of the card. */
  children: ReactNode;
  /** The card's appliesTo. Shown as one small line above the statement when it is not empty. */
  appliesTo?: string;
  /** The statement receives focus when a new card is shown (no visible ring, on purpose). */
  ref?: Ref<HTMLDivElement>;
  id?: string;
}

/** The statement area of the game: at least 188 tall, the text centred vertically. */
export function PassStatement({ children, appliesTo, ref, id }: PassStatementProps) {
  return (
    <div
      ref={ref}
      id={id}
      tabIndex={-1}
      data-statement=""
      className="flex min-h-(--size-statement-min) flex-col justify-center px-(--size-ticket-inset) pt-(--space-18) pb-(--space-24) outline-none"
    >
      {appliesTo ? (
        <p className="m-0 mb-(--space-6) font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) leading-(--type-mono-data-line-height) font-(--type-mono-data-weight) text-(--color-ink-muted)">
          Applies to {appliesTo}
        </p>
      ) : null}
      <p className="m-0 font-(family-name:--type-card-statement-family) text-(length:--type-card-statement-size) leading-(--type-card-statement-line-height) font-(--type-card-statement-weight) tracking-(--type-card-statement-letter-spacing) text-(--color-ink)">
        {children}
      </p>
    </div>
  );
}

export interface PassLowerProps {
  /** "raised": the paper of the stub. "sunk": the paper of the answer slip and the result list. */
  tone: "raised" | "sunk";
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** The lower part's paper: notches at the top, square top corners, radius 16 at the bottom. */
export function PassLower({ tone, children, className, style }: PassLowerProps) {
  const colour = tone === "raised" ? "var(--color-surface-raised)" : "var(--color-surface-sunk)";
  return (
    <div
      data-tone={tone}
      className={["rounded-b-(--radius-card)", className].filter(Boolean).join(" ")}
      style={{ background: notchedPaper(colour, "top"), ...style }}
    >
      {children}
    </div>
  );
}

/** One bar of a barcode: x and width in barcode units (the bars are 56 tall). */
export interface BarcodeBar {
  x: number;
  width: number;
}

/**
 * The barcode algorithm of the design system (Portability notes), the same on every platform:
 * start bars 2/1/1/2 (on, off, on, off); for each character 7 bits, least significant first, bit 1 gives
 * width 2 and bit 0 width 1, bars alternating on and off starting with on, then a 1-wide gap;
 * end bars 1/1/2 (on, off, on).
 */
export function barcodeBars(data: string): { bars: BarcodeBar[]; width: number } {
  const bars: BarcodeBar[] = [];
  let x = 0;
  const bar = (width: number, on: boolean) => {
    if (on) bars.push({ x, width });
    x += width;
  };
  bar(2, true);
  bar(1, false);
  bar(1, true);
  bar(2, false);
  for (const ch of data) {
    const code = ch.charCodeAt(0);
    for (let bit = 0; bit < 7; bit++) bar((code >> bit) & 1 ? 2 : 1, bit % 2 === 0);
    bar(1, false);
  }
  bar(1, true);
  bar(1, false);
  bar(2, true);
  return { bars, width: x };
}

function Barcode({ data }: { data: string }) {
  const { bars, width } = barcodeBars(data);
  return (
    <svg
      data-barcode={data}
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${width} 56`}
      preserveAspectRatio="none"
      className="block h-(--size-barcode) w-full text-(--color-ink)"
    >
      <g fill="currentColor">
        {bars.map((b) => (
          <rect key={b.x} x={b.x} y="0" width={b.width} height="56" />
        ))}
      </g>
    </svg>
  );
}

/** Which way the stub falls when it tears off: left after a correct answer, right after a wrong one. */
export type TearSide = "left" | "right";

const STUB_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, x: 0, y: 0, rotate: 0, transition: { duration: 0.22, ease: [0.2, 0.7, 0.2, 1] } },
  tear: (side: TearSide | undefined) => ({
    x: side === "right" ? 40 : -40,
    y: 360,
    rotate: side === "right" ? 18 : -18,
    opacity: 0,
    transition: {
      default: { duration: 0.46, ease: [0.5, 0, 0.9, 0.4] },
      opacity: { duration: 0.46, ease: [0.42, 0, 1, 1] },
    },
  }),
};

const STUB_VARIANTS_REDUCED: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.14 } },
  tear: { opacity: 0, transition: { duration: 0.1 } },
};

// While the card is dragged, the stub drops |intent| x 7px and turns intent x 2deg around (20%, 0).
// --intent and --pull are set on the swipe card by useSwipe.
const STUB_PULL: CSSProperties = {
  transformOrigin: "20% 0",
  transform: "translateY(calc(var(--pull, 0) * var(--gesture-stub-pull))) rotate(calc(var(--intent, 0) * 2deg))",
};

const INTENT_STAMP =
  "pointer-events-none absolute top-[64px] flex items-center gap-(--space-8) rounded-(--radius-small) " +
  "border-(length:--stroke-stamp) border-solid border-current bg-(--color-surface-raised) px-(--space-12) py-(--space-6) " +
  "font-(family-name:--type-intent-stamp-family) text-(length:--type-intent-stamp-size) font-(--type-intent-stamp-weight) " +
  "leading-(--type-intent-stamp-line-height) tracking-(--type-intent-stamp-letter-spacing)";

const MONO_DATA =
  "font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) font-(--type-mono-data-weight) " +
  "leading-(--type-mono-data-line-height) tracking-(--type-mono-data-letter-spacing)";
const MONO_STRONG =
  "font-(family-name:--type-mono-data-strong-family) text-(length:--type-mono-data-strong-size) font-(--type-mono-data-strong-weight) " +
  "leading-(--type-mono-data-strong-line-height) tracking-(--type-mono-data-strong-letter-spacing)";

export interface PassStubProps {
  /** The route line on the left, for example "CLF → SEC · Classic". */
  routeLine: string;
  /** On the right, for example "Card 04". */
  cardLabel: string;
  /** The data the barcode is drawn from (the card id). */
  barcode: string;
  className?: string;
}

/**
 * The stub of the question phase: route line, barcode, swipe hint, and the two intent stamps that fade in
 * while the card is dragged. Decorative (the buttons say the same), so it is hidden from screen readers.
 * Render it as a direct child of AnimatePresence with custom={TearSide}: it tears off when it leaves.
 */
export function PassStub({ routeLine, cardLabel, barcode, className }: PassStubProps) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.div
      aria-hidden="true"
      data-stub=""
      className={["relative z-10", className].filter(Boolean).join(" ")}
      variants={reduced ? STUB_VARIANTS_REDUCED : STUB_VARIANTS}
      initial="hidden"
      animate="shown"
      exit="tear"
    >
      <div
        className="h-full transition-transform duration-(--duration-t3) ease-(--easing-spring) group-data-dragging:transition-none"
        style={STUB_PULL}
      >
        <PassLower
          tone="raised"
          className="flex h-full flex-col justify-between px-(--size-ticket-inset) pt-[22px] pb-(--space-14)"
        >
          <div className={`flex items-baseline justify-between text-(--color-ink-muted) ${MONO_DATA}`}>
            <span>{routeLine}</span>
            <b className={`text-(--color-ink) ${MONO_STRONG}`}>{cardLabel}</b>
          </div>
          <Barcode data={barcode} />
          <div className={`flex min-h-8 items-center justify-between gap-(--space-8) ${MONO_STRONG}`}>
            <span className="flex items-center gap-(--space-4) text-(--color-false)">← False</span>
            <span className="font-(--font-weight-mono-regular) text-(--color-ink-muted)">swipe to board</span>
            <span className="flex items-center gap-(--space-4) text-(--color-true)">True →</span>
          </div>
        </PassLower>
        <div
          data-intent="true"
          className={`${INTENT_STAMP} left-(--space-16) rotate-[-7deg] text-(--color-true)`}
          style={{ opacity: "calc(var(--intent, 0) * var(--gesture-intent-opacity-gain))" }}
        >
          <CheckIcon size={18} />
          True
        </div>
        <div
          data-intent="false"
          className={`${INTENT_STAMP} right-(--space-16) rotate-[7deg] text-(--color-false)`}
          style={{ opacity: "calc(var(--intent, 0) * -1 * var(--gesture-intent-opacity-gain))" }}
        >
          <CrossIcon size={16} />
          False
        </div>
      </div>
    </motion.div>
  );
}

export interface PassSlipProps {
  /** The right answer of the card. */
  answer: boolean;
  /** Whether the player's answer was right. */
  correct: boolean;
  explanation: string;
  source: { title: string; url: string };
  /** Let the stamp land (the answer has just been given). */
  animateStamp?: boolean;
  className?: string;
}

/** The answer slip revealed under the stub: the right answer, the verdict stamp, the explanation and the source. */
export function PassSlip({ answer, correct, explanation, source, animateStamp = false, className }: PassSlipProps) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.div
      data-slip=""
      className={className}
      initial={reduced ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.14 }}
    >
      <PassLower tone="sunk" className="flex h-full flex-col px-(--size-ticket-inset) pt-(--space-18) pb-(--space-12)">
        <div className="flex min-h-[60px] items-center justify-between gap-(--space-12)">
          <p className="m-0 font-(family-name:--type-answer-label-family) text-(length:--type-answer-label-size) leading-(--type-answer-label-line-height) font-(--type-answer-label-weight) text-(--color-ink-muted)">
            The answer is
            <b className="mt-(--space-2) block font-(family-name:--type-answer-value-family) text-(length:--type-answer-value-size) leading-(--type-answer-value-line-height) font-(--type-answer-value-weight) tracking-(--type-answer-value-letter-spacing) text-(--color-ink)">
              {answer ? "True" : "False"}
            </b>
          </p>
          <Stamp verdict={correct ? "correct" : "wrong"} animate={animateStamp} />
        </div>
        <p className="m-0 mt-(--space-10) font-(family-name:--type-body-family) text-(length:--type-body-size) leading-(--type-body-line-height) font-(--type-body-weight) text-(--color-ink)">
          {explanation}
        </p>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${source.title} (opens in a new tab)`}
          className="mt-auto flex min-h-(--size-touch-min) items-center gap-(--space-8) font-(family-name:--type-mono-data-strong-family) text-[13.5px] leading-(--type-mono-data-strong-line-height) font-(--type-mono-data-strong-weight) text-(--color-true) no-underline"
        >
          <BookIcon className="flex-none" />
          <u className="decoration-[1.5px] underline-offset-[3px]">{source.title}</u>
          <span aria-hidden="true">→</span>
        </a>
      </PassLower>
    </motion.div>
  );
}

/** The calm stand-in while the round loads: the ticket's shape with the carrier band and nothing else. */
export function BoardingPassPlaceholder() {
  return (
    <div aria-hidden="true" data-pass-placeholder="" className="relative">
      <div className="pointer-events-none absolute inset-0 rounded-(--radius-card) shadow-(--elevation-ticket)" />
      <div className="relative overflow-hidden rounded-t-(--radius-card)" style={MAIN_PAPER}>
        <div className="flex h-(--size-carrier) items-center gap-(--space-10) bg-(--color-accent) px-(--space-16) text-(--color-on-accent)">
          <CloudIcon />
        </div>
        <div className="h-[336px]" />
        <div className="absolute bottom-0 h-(--stroke-perforation)" style={PERFORATION} />
      </div>
      <PassLower tone="raised" className="h-(--size-lower)" />
    </div>
  );
}
```

- [ ] **Step 14: Run the boarding pass tests and watch them pass**

```bash
pnpm vitest run tests/components/BoardingPass.test.tsx
```

Expected: `Tests  20 passed (20)`.

- [ ] **Step 15: Commit**

```bash
git add components/BoardingPass.tsx tests/components/BoardingPass.test.tsx
git commit -m "feat: add the boarding pass with its statement, stub and answer slip"
```

- [ ] **Step 16: Write the failing tests for the swipe hook**

Create `tests/components/play/useSwipe.test.tsx`. jsdom has `PointerEvent` with `clientX`, `pointerId` and `isPrimary`, but no pointer capture; the hook copes with both.

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSwipe } from "@/components/play/useSwipe";

afterEach(cleanup);

// The clock the hook reads. Each pointer event sets it first, so samples get exact times.
let time = 0;
const now = () => time;
const SHOWN_AT = 1000;

function Card({ enabled = true, onSwipe }: { enabled?: boolean; onSwipe: (value: boolean) => void }) {
  const swipe = useSwipe<HTMLDivElement>({ enabled, cardShownAt: () => SHOWN_AT, now, onSwipe });
  return (
    <div
      data-testid="card"
      ref={swipe.ref}
      onPointerDown={swipe.onPointerDown}
      onPointerMove={swipe.onPointerMove}
      onPointerUp={swipe.onPointerUp}
      onPointerCancel={swipe.onPointerCancel}
    />
  );
}

type Point = [x: number, y: number, t: number];
const pointer = { pointerId: 1, isPrimary: true, pointerType: "touch", button: 0 };

function down(card: HTMLElement, [x, y, t]: Point) {
  time = t;
  fireEvent.pointerDown(card, { ...pointer, clientX: x, clientY: y });
}
function move(card: HTMLElement, [x, y, t]: Point) {
  time = t;
  fireEvent.pointerMove(card, { ...pointer, clientX: x, clientY: y });
}
function up(card: HTMLElement, [x, y, t]: Point) {
  time = t;
  fireEvent.pointerUp(card, { ...pointer, clientX: x, clientY: y });
}

// A gesture: pointer down at the first point, moves through the middle ones, release at the last.
function drag(card: HTMLElement, points: Point[]) {
  const [first, ...rest] = points;
  const last = rest.pop();
  if (!first || !last) throw new Error("a drag needs two points");
  down(card, first);
  for (const point of rest) move(card, point);
  up(card, last);
}

function setup(enabled = true) {
  const onSwipe = vi.fn();
  const view = render(<Card enabled={enabled} onSwipe={onSwipe} />);
  return { onSwipe, card: view.getByTestId("card"), rerender: (on: boolean) => view.rerender(<Card enabled={on} onSwipe={onSwipe} />) };
}

beforeEach(() => {
  time = 0;
});

describe("useSwipe", () => {
  it("answers True for a slow drag released 90 px or more to the right", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [200, 400, 2000],
      [250, 402, 2300],
      [300, 404, 2600],
    ]);
    expect(onSwipe.mock.calls).toEqual([[true]]);
  });

  it("answers False for a drag released 90 px or more to the left", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [300, 400, 2000],
      [240, 400, 2300],
      [205, 400, 2600],
    ]);
    expect(onSwipe.mock.calls).toEqual([[false]]);
  });

  it("does not answer a short slow drag (an accidental nudge)", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [200, 400, 2000],
      [220, 400, 2300],
      [230, 400, 2600],
    ]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("answers a fast fling of at least 40 px", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [200, 400, 2000],
      [230, 400, 2040],
      [250, 400, 2060],
    ]);
    expect(onSwipe.mock.calls).toEqual([[true]]);
  });

  it("does not answer a drag back inside 90 px before release", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [200, 400, 2000],
      [320, 400, 2300],
      [240, 400, 2700],
    ]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("ignores a gesture that is more vertical than horizontal", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [200, 400, 2000],
      [300, 550, 2400],
    ]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("ignores a gesture that starts within the 250 ms settle time", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [200, 400, SHOWN_AT + 100],
      [320, 400, SHOWN_AT + 500],
    ]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("ignores a gesture that starts within 24 px of the screen edge", () => {
    const { onSwipe, card } = setup();
    drag(card, [
      [10, 400, 2000],
      [200, 400, 2400],
    ]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("does nothing while it is disabled", () => {
    const { onSwipe, card } = setup(false);
    drag(card, [
      [200, 400, 2000],
      [320, 400, 2400],
    ]);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("drops the gesture on pointercancel (the browser took over, for example to scroll)", () => {
    const { onSwipe, card } = setup();
    down(card, [200, 400, 2000]);
    move(card, [320, 400, 2300]);
    time = 2400;
    fireEvent.pointerCancel(card, pointer);
    up(card, [320, 400, 2500]);
    expect(onSwipe).not.toHaveBeenCalled();
    expect(card.dataset.dragging).toBeUndefined();
  });

  it("ignores a second finger", () => {
    const { onSwipe, card } = setup();
    time = 2000;
    fireEvent.pointerDown(card, { ...pointer, isPrimary: false, clientX: 200, clientY: 400 });
    time = 2400;
    fireEvent.pointerUp(card, { ...pointer, isPrimary: false, clientX: 320, clientY: 400 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("makes the card follow the finger and shows the intent while dragging", () => {
    const { card } = setup();
    down(card, [200, 400, 2000]);
    expect(card.dataset.dragging).toBe("");
    move(card, [255, 400, 2100]);
    expect(card.style.getPropertyValue("--drag-x")).toBe("55");
    expect(card.style.getPropertyValue("--intent")).toBe("0.5");
    expect(card.style.getPropertyValue("--pull")).toBe("0.5");
    move(card, [90, 400, 2200]);
    expect(card.style.getPropertyValue("--intent")).toBe("-1");
    expect(card.style.getPropertyValue("--pull")).toBe("1");
  });

  it("lets the card spring back after the release, answered or not", () => {
    const { card } = setup();
    drag(card, [
      [200, 400, 2000],
      [320, 400, 2300],
    ]);
    expect(card.dataset.dragging).toBeUndefined();
    expect(card.style.getPropertyValue("--drag-x")).toBe("0");
    expect(card.style.getPropertyValue("--intent")).toBe("0");
  });

  it("springs back when it is disabled in the middle of a drag (answered by a key or a button)", () => {
    const { onSwipe, card, rerender } = setup();
    down(card, [200, 400, 2000]);
    move(card, [320, 400, 2300]);
    rerender(false);
    expect(card.style.getPropertyValue("--drag-x")).toBe("0");
    up(card, [320, 400, 2400]);
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 17: Run the swipe hook tests and watch them fail**

```bash
pnpm vitest run tests/components/play/useSwipe.test.tsx
```

Expected: the suite fails to load with `Failed to resolve import "@/components/play/useSwipe"`.

- [ ] **Step 18: Create the swipe hook**

Create `components/play/useSwipe.ts`:

```ts
// Pointer events on the card, turned into answers by the pure rules in src/input/swipe (spec section 8).
// The card follows the finger through three CSS custom properties set directly on the element, so a drag
// does not re-render React on every move:
//   --drag-x  the horizontal travel in px, unitless (the card's translateX and rotation read it)
//   --intent  intent(dx), -1 (towards False) to 1 (towards True), for the intent stamps and the stub turn
//   --pull    |intent|, for the stub drop
// While a gesture runs the element carries data-dragging (transitions off, cursor grabbing).
import { useCallback, useEffect, useRef, type PointerEvent, type RefObject } from "react";
import { canStart, intent, interpret, type SwipeContext, type SwipeSample } from "@/src/input/swipe";

export interface UseSwipeOptions {
  /** False outside the question phase or while a dialog is open: pointers are ignored. */
  enabled: boolean;
  /** When the card on screen appeared, on the same clock as now(). Read at pointer down (settle time). */
  cardShownAt: () => number;
  /** The clock for the samples, in ms. */
  now: () => number;
  /** Called once per committed swipe: true for a swipe right, false for a swipe left. */
  onSwipe: (value: boolean) => void;
}

export interface SwipeBindings<T extends HTMLElement> {
  ref: RefObject<T | null>;
  onPointerDown: (event: PointerEvent<T>) => void;
  onPointerMove: (event: PointerEvent<T>) => void;
  onPointerUp: (event: PointerEvent<T>) => void;
  onPointerCancel: (event: PointerEvent<T>) => void;
}

interface Gesture {
  pointerId: number;
  samples: SwipeSample[];
  context: SwipeContext;
}

function paint(element: HTMLElement | null, dx: number): void {
  if (!element) return;
  const value = intent(dx);
  element.style.setProperty("--drag-x", String(dx));
  element.style.setProperty("--intent", String(value));
  element.style.setProperty("--pull", String(Math.abs(value)));
}

export function useSwipe<T extends HTMLElement>({ enabled, cardShownAt, now, onSwipe }: UseSwipeOptions): SwipeBindings<T> {
  const ref = useRef<T | null>(null);
  const gesture = useRef<Gesture | null>(null);

  const reset = useCallback(() => {
    gesture.current = null;
    const element = ref.current;
    if (!element) return;
    delete element.dataset.dragging;
    paint(element, 0);
  }, []);

  // A card that stops taking answers (answered by a button or a key mid-drag, a dialog opened) springs back.
  useEffect(() => {
    if (!enabled) reset();
  }, [enabled, reset]);

  const sample = useCallback((event: PointerEvent<T>): SwipeSample => ({ x: event.clientX, y: event.clientY, t: now() }), [now]);

  const onPointerDown = useCallback(
    (event: PointerEvent<T>) => {
      if (!enabled || gesture.current !== null || !event.isPrimary) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const first = sample(event);
      const context: SwipeContext = { viewportWidth: window.innerWidth, cardShownAt: cardShownAt() };
      if (!canStart(first, context)) return; // settle time or edge zone: this gesture is ignored
      gesture.current = { pointerId: event.pointerId, samples: [first], context };
      const element = event.currentTarget;
      element.dataset.dragging = "";
      // Keep receiving moves when the finger leaves the card. Not every environment has pointer capture.
      if (typeof element.setPointerCapture === "function") {
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // An already released pointer cannot be captured; the gesture still works while over the card.
        }
      }
    },
    [enabled, sample, cardShownAt],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<T>) => {
      const current = gesture.current;
      if (current === null || event.pointerId !== current.pointerId) return;
      const next = sample(event);
      current.samples.push(next);
      const first = current.samples[0];
      if (first) paint(ref.current, next.x - first.x);
    },
    [sample],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<T>) => {
      const current = gesture.current;
      if (current === null || event.pointerId !== current.pointerId) return;
      current.samples.push(sample(event));
      const outcome = interpret(current.samples, current.context);
      reset();
      if (enabled && outcome !== "cancel") onSwipe(outcome === "true");
    },
    [sample, reset, enabled, onSwipe],
  );

  const onPointerCancel = useCallback(
    (event: PointerEvent<T>) => {
      const current = gesture.current;
      if (current === null || event.pointerId !== current.pointerId) return;
      reset();
    },
    [reset],
  );

  return { ref, onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
```

- [ ] **Step 19: Run the swipe hook tests and watch them pass**

```bash
pnpm vitest run tests/components/play/useSwipe.test.tsx
```

Expected: `Tests  14 passed (14)`.

- [ ] **Step 20: Commit**

```bash
git add components/play/useSwipe.ts tests/components/play/useSwipe.test.tsx
git commit -m "feat: wire pointer events on the card to the swipe rules"
```

- [ ] **Step 21: Write the failing tests for the leave dialog**

Create `tests/components/play/LeaveDialog.test.tsx`. `MotionGlobalConfig.skipAnimations` makes every Motion animation finish at once, so exits do not keep elements around in tests.

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LeaveDialog } from "@/components/play/LeaveDialog";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

function setup(open = true) {
  const onStay = vi.fn();
  const onLeave = vi.fn();
  const view = render(<LeaveDialog open={open} onStay={onStay} onLeave={onLeave} />);
  return { onStay, onLeave, rerender: (next: boolean) => view.rerender(<LeaveDialog open={next} onStay={onStay} onLeave={onLeave} />) };
}

describe("LeaveDialog", () => {
  it("renders nothing while closed", () => {
    setup(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is a modal dialog named Leave round? that explains what leaving does", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    const description = document.getElementById(dialog.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toBe("Your answers so far stay in your history. This round won't set a record.");
  });

  it("offers Keep playing first and gives it focus", () => {
    setup();
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Keep playing", "Leave round"]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep playing" }));
  });

  it("calls onLeave from Leave round and onStay from Keep playing", () => {
    const { onStay, onLeave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it("keeps playing on Escape and on a tap outside the sheet", () => {
    const { onStay, onLeave } = setup();
    fireEvent.keyDown(screen.getByRole("button", { name: "Keep playing" }), { key: "Escape" });
    const scrim = document.querySelector("[data-scrim]");
    if (!scrim) throw new Error("no scrim");
    fireEvent.click(scrim);
    expect(onStay).toHaveBeenCalledTimes(2);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("keeps Tab and Shift+Tab inside the dialog", () => {
    setup();
    const stay = screen.getByRole("button", { name: "Keep playing" });
    const leave = screen.getByRole("button", { name: "Leave round" });
    leave.focus();
    fireEvent.keyDown(leave, { key: "Tab" });
    expect(document.activeElement).toBe(stay);
    fireEvent.keyDown(stay, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(leave);
  });

  it("goes away when it is closed", async () => {
    const { rerender } = setup();
    rerender(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
```

- [ ] **Step 22: Run the leave dialog tests and watch them fail**

```bash
pnpm vitest run tests/components/play/LeaveDialog.test.tsx
```

Expected: the suite fails to load with `Failed to resolve import "@/components/play/LeaveDialog"`.

- [ ] **Step 23: Create the leave dialog**

Create `components/play/LeaveDialog.tsx`. No approved screen draws this dialog; it is built from tokens only: the scrim colour, a paper sheet at the bottom of the frame (`--radius-card`, `--elevation-sheet`, 20 padding), the step-title role for "Leave round?", the body role for the line under it, the ink pill for the safe action and the quiet button for leaving. Native `<dialog>` is not used because jsdom has no `showModal`.

```tsx
"use client";

// The one confirmation before leaving a round (spec section 6, "Leaving a round"): a modal sheet at the
// bottom of the frame, over a scrim. "Keep playing" is the primary action and has focus when it opens;
// Escape and a tap on the scrim also keep playing. Focus stays inside while it is open. The screen behind
// should be made inert by the caller (PlayScreen sets inert on its <main>).
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { PillButton } from "@/components/PillButton";
import { QuietButton } from "@/components/QuietButton";

export interface LeaveDialogProps {
  open: boolean;
  /** "Keep playing", Escape or a tap on the scrim. */
  onStay: () => void;
  /** "Leave round". */
  onLeave: () => void;
}

export function LeaveDialog({ open, onStay, onLeave }: LeaveDialogProps) {
  return <AnimatePresence>{open ? <Sheet key="leave" onStay={onStay} onLeave={onLeave} /> : null}</AnimatePresence>;
}

const EASE = [0.2, 0.7, 0.2, 1] as const;

function Sheet({ onStay, onLeave }: Omit<LeaveDialogProps, "open">) {
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const bodyId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);
  const leaveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    stayRef.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onStay();
      return;
    }
    if (event.key !== "Tab") return;
    // Two buttons: Tab and Shift+Tab move between them and never leave the dialog.
    const first = stayRef.current;
    const last = leaveRef.current;
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <motion.div
        aria-hidden="true"
        data-scrim=""
        className="absolute inset-0 bg-(--color-scrim)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.36, ease: EASE }}
        onClick={onStay}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto w-full max-w-(--app-max-width) px-(--size-gutter) pb-(--size-safe-bottom)">
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          onKeyDown={onKeyDown}
          className="pointer-events-auto rounded-(--radius-card) bg-(--color-surface-raised) p-(--space-20) text-(--color-ink) shadow-(--elevation-sheet)"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: reduced ? 0.14 : 0.36, ease: EASE }}
        >
          <h2
            id={titleId}
            className="m-0 font-(family-name:--type-step-title-family) text-(length:--type-step-title-size) leading-(--type-step-title-line-height) font-(--type-step-title-weight) tracking-(--type-step-title-letter-spacing)"
          >
            Leave round?
          </h2>
          <p
            id={bodyId}
            className="m-0 mt-(--space-8) font-(family-name:--type-body-family) text-(length:--type-body-size) leading-(--type-body-line-height) font-(--type-body-weight)"
          >
            Your answers so far stay in your history. This round won&apos;t set a record.
          </p>
          <div className="mt-(--space-20) flex flex-col gap-(--space-4)">
            <PillButton ref={stayRef} onClick={onStay}>
              Keep playing
            </PillButton>
            <QuietButton ref={leaveRef} onClick={onLeave}>
              Leave round
            </QuietButton>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
```

- [ ] **Step 24: Run the leave dialog tests and watch them pass**

```bash
pnpm vitest run tests/components/play/LeaveDialog.test.tsx
```

Expected: `Tests  7 passed (7)`.

- [ ] **Step 25: Commit**

```bash
git add components/play/LeaveDialog.tsx tests/components/play/LeaveDialog.test.tsx
git commit -m "feat: add the leave round confirmation"
```

- [ ] **Step 26: Write the test doubles and the failing tests for loading a round**

Create `tests/components/play/fixtures.ts`, the doubles every play test uses: a 13-card deck (section SEC with 12 cards, half true; section APP with one card whose `appliesTo` is "Next.js 16"), its index, storage in memory, a fake network that can go offline or hold its answers, and a clock moved by hand.

```ts
// Test doubles for the play screen: a small deck and its index, storage in memory, a fake network and
// a clock the test moves by hand. Everything goes in through PlayScreen's `services` prop.
import type { PlayServices } from "@/components/play/useRound";
import { PENDING_KEY, type PendingRound } from "@/src/app-state/pending";
import type { Card, DeckFile, DeckIndex } from "@/src/content/schema";

export const DECK_ID = "test-deck";

function card(section: string, n: number, answer: boolean, appliesTo = ""): Card {
  const id = `${DECK_ID}-${section.toLowerCase()}-${String(n).padStart(2, "0")}`;
  return {
    id,
    section,
    text: { en: { statement: `Statement ${section} ${n}.`, explanation: `Explanation ${section} ${n}.` } },
    answer,
    source: { title: `Source ${section} ${n}`, url: `https://example.com/${id}` },
    difficulty: 1,
    appliesTo,
    conflictGroups: [],
  };
}

// SEC: 12 cards, half true. APP: one card with appliesTo.
export const DECK: DeckFile = {
  id: DECK_ID,
  hash: "hash-1",
  cards: [...Array.from({ length: 12 }, (_, i) => card("SEC", i + 1, i % 2 === 0)), card("APP", 1, true, "Next.js 16")],
};

export const INDEX: DeckIndex = {
  areas: [
    {
      id: "cloud",
      title: "Cloud",
      platforms: [
        {
          id: "aws",
          title: "AWS",
          decks: [
            {
              id: DECK_ID,
              code: "TST",
              title: "Test deck",
              cardCount: DECK.cards.length,
              version: "2026-10-01",
              hash: "hash-1",
              sections: [
                { id: "SEC", title: "Security and compliance", cardCount: 12 },
                { id: "APP", title: "Applies to", cardCount: 1 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export function cardByStatement(statement: string | null | undefined): Card {
  const found = DECK.cards.find((c) => c.text.en.statement === statement);
  if (!found) throw new Error(`no card with the statement "${statement}"`);
  return found;
}

export interface MemoryStorage extends Pick<Storage, "getItem" | "setItem"> {
  data: Map<string, string>;
}

export function memoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

export interface FakeNetwork {
  fetcher: PlayServices["fetcher"];
  calls: string[];
  /** When false every request fails, as offline. */
  online: boolean;
  /** When set, requests wait for release() before they answer. */
  hold: boolean;
  release: () => void;
}

export function fakeNetwork(files: Record<string, unknown> = { "/decks/index.json": INDEX, [`/decks/${DECK_ID}.json`]: DECK }): FakeNetwork {
  let waiting: (() => void)[] = [];
  const network: FakeNetwork = {
    calls: [],
    online: true,
    hold: false,
    release: () => {
      const queued = waiting;
      waiting = [];
      for (const go of queued) go();
    },
    fetcher: async (url) => {
      network.calls.push(url);
      if (network.hold) await new Promise<void>((resolve) => waiting.push(resolve));
      if (!network.online) throw new Error("offline");
      const path = url.split("?")[0] ?? url;
      if (!(path in files)) return { ok: false, json: async () => null };
      return { ok: true, json: async () => structuredClone(files[path]) };
    },
  };
  return network;
}

export interface Harness {
  services: PlayServices;
  network: FakeNetwork;
  local: MemoryStorage;
  session: MemoryStorage;
  /** Moves the clock on by ms. */
  advance: (ms: number) => void;
}

export function harness(pending: PendingRound | null = { route: { deckId: DECK_ID, sectionId: "SEC" }, mode: "classic" }, local = memoryStorage()): Harness {
  let time = 1_700_000_000_000;
  const network = fakeNetwork();
  const session = memoryStorage(pending ? { [PENDING_KEY]: JSON.stringify(pending) } : {});
  const services: PlayServices = {
    fetcher: network.fetcher,
    localStorage: () => local,
    sessionStorage: () => session,
    now: () => time,
    randomSeed: () => 12345,
  };
  return { services, network, local, session, advance: (ms) => (time += ms) };
}
```

Create `tests/components/play/useRound.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOAD_FAILED_MESSAGE, useRound, type RoundStatus } from "@/components/play/useRound";
import { PROGRESS_KEY } from "@/src/progress/local";
import { emptyProgress, parseProgress } from "@/src/progress/progress";
import { DECK_ID, harness, memoryStorage, type Harness } from "./fixtures";

afterEach(cleanup);

function run(h: Harness) {
  const goHome = vi.fn();
  const hook = renderHook(() => useRound(h.services, goHome));
  return { goHome, hook, status: () => hook.result.current.status };
}

async function ready(status: () => RoundStatus) {
  await waitFor(() => expect(status().kind).toBe("ready"));
  const current = status();
  if (current.kind !== "ready") throw new Error("not ready");
  return current;
}

describe("useRound", () => {
  it("goes home without loading anything when there is no pending round", async () => {
    const h = harness(null);
    const { goHome, status } = run(h);
    await waitFor(() => expect(goHome).toHaveBeenCalledTimes(1));
    expect(status().kind).toBe("redirecting");
    expect(h.network.calls).toEqual([]);
  });

  it("goes home when the deck is no longer in the index", async () => {
    const { goHome, status } = run(harness({ route: { deckId: "gone-deck", sectionId: "SEC" }, mode: "classic" }));
    await waitFor(() => expect(goHome).toHaveBeenCalledTimes(1));
    expect(status().kind).toBe("redirecting");
  });

  it("goes home when the section is no longer in the deck", async () => {
    const { goHome } = run(harness({ route: { deckId: DECK_ID, sectionId: "OLD" }, mode: "classic" }));
    await waitFor(() => expect(goHome).toHaveBeenCalledTimes(1));
  });

  it("is loading first, then deals a Classic round of ten cards from the section", async () => {
    const h = harness();
    const { status } = run(h);
    expect(status().kind).toBe("loading");
    const { round, ticket } = await ready(status);
    expect(round.phase).toBe("question");
    expect(round.cards).toHaveLength(10);
    expect(round.cards.every((card) => card.section === "SEC")).toBe(true);
    expect(ticket).toEqual({
      deckCode: "TST",
      deckName: "AWS Test deck",
      sectionCode: "SEC",
      sectionName: "Security and compliance",
      modeLabel: "Classic",
    });
    expect(h.network.calls).toEqual(["/decks/index.json", `/decks/${DECK_ID}.json?v=hash-1`]);
  });

  it("names a whole-deck route ALL, Whole deck and deals from every card", async () => {
    const { status } = run(harness({ route: { deckId: DECK_ID, sectionId: "ALL" }, mode: "classic" }));
    const { round, ticket } = await ready(status);
    expect(ticket.sectionCode).toBe("ALL");
    expect(ticket.sectionName).toBe("Whole deck");
    expect(round.route).toEqual({ deckId: DECK_ID, sectionId: "ALL" });
  });

  it("deals the same cards for the same seed", async () => {
    const first = await ready(run(harness()).status);
    cleanup();
    const second = await ready(run(harness()).status);
    expect(second.round.cards.map((c) => c.id)).toEqual(first.round.cards.map((c) => c.id));
  });

  it("deals with the stored card history: a card missed before comes back", async () => {
    const missed = `${DECK_ID}-sec-12`;
    const stored = { ...emptyProgress(), cards: { [missed]: { seen: 1, lastCorrect: false, lastSeenAt: 5 } } };
    const { status } = run(harness(undefined, memoryStorage({ [PROGRESS_KEY]: JSON.stringify(stored) })));
    const { round } = await ready(status);
    expect(round.cards.map((c) => c.id)).toContain(missed);
  });

  it("drops stored history of this deck's cards that no longer exist, and keeps the rest", async () => {
    const stored = {
      ...emptyProgress(),
      cards: {
        [`${DECK_ID}-gone-01`]: { seen: 2, lastCorrect: true, lastSeenAt: 5 },
        "other-deck-01": { seen: 1, lastCorrect: true, lastSeenAt: 5 },
      },
    };
    const h = harness(undefined, memoryStorage({ [PROGRESS_KEY]: JSON.stringify(stored) }));
    await ready(run(h).status);
    expect(Object.keys(parseProgress(h.local.getItem(PROGRESS_KEY)).cards)).toEqual(["other-deck-01"]);
  });

  it("runs the round on the engine's reducer", async () => {
    const { hook, status } = run(harness());
    await ready(status);
    act(() => hook.result.current.dispatch({ type: "answer", value: true, at: 1 }));
    const after = status();
    expect(after.kind === "ready" && after.round.phase).toBe("answered");
  });

  it("reports a load failure and loads again on retry", async () => {
    const h = harness();
    h.network.online = false;
    const { hook, status } = run(h);
    await waitFor(() => expect(status()).toEqual({ kind: "error", message: LOAD_FAILED_MESSAGE }));
    h.network.online = true;
    act(() => hook.result.current.retry());
    expect(status().kind).toBe("loading");
    await ready(status);
  });

  it("plays from the cached index and deck when the network fails", async () => {
    const local = memoryStorage();
    await ready(run(harness(undefined, local)).status);
    cleanup();
    const offline = harness(undefined, local);
    offline.network.online = false;
    const { round } = await ready(run(offline).status);
    expect(round.cards).toHaveLength(10);
  });

  it("starts a fresh round on the same route with restart", async () => {
    const { hook, status } = run(harness());
    await ready(status);
    act(() => hook.result.current.dispatch({ type: "answer", value: true, at: 1 }));
    act(() => hook.result.current.restart());
    expect(status().kind).toBe("loading");
    const { round } = await ready(status);
    expect(round.answers).toEqual([]);
    expect(round.phase).toBe("question");
  });

  it("gives the progress store on the device", async () => {
    const h = harness();
    const { hook, status } = run(h);
    await ready(status);
    hook.result.current.progressStore().save({ ...emptyProgress(), records: { [`${DECK_ID}/SEC#classic`]: 7 } });
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).records).toEqual({ [`${DECK_ID}/SEC#classic`]: 7 });
  });
});
```

- [ ] **Step 27: Run the loading tests and watch them fail**

```bash
pnpm vitest run tests/components/play/useRound.test.tsx
```

Expected: the suite fails to load with `Failed to resolve import "@/components/play/useRound"` (the fixtures import only a type from it, which is erased).

- [ ] **Step 28: Create the round hook**

Create `components/play/useRound.ts`:

```ts
// Loading a round and running it (spec sections 5, 6, 7 and 10): read the pending round, load the index and
// the deck, prune the stored progress for that deck, deal with startRound, then run the round on
// useReducer(reduce). Everything that touches the network, storage, the clock or randomness comes in
// through PlayServices, so the play screen runs in tests without a browser.
import { useCallback, useEffect, useReducer, useState } from "react";
import { WHOLE_DECK, type DeckIndex, type IndexDeck, type Route } from "@/src/content/schema";
import { createDeckCache, loadDeck, loadIndex, poolFor, type Fetcher } from "@/src/content/load";
import { readPending, type PendingRound } from "@/src/app-state/pending";
import { reduce, startRound, type Mode, type RoundEvent, type RoundState } from "@/src/engine/round";
import { pruneDeck } from "@/src/progress/progress";
import { browserLocalStorage, createLocalStore, type ProgressStore } from "@/src/progress/local";

/** The play screen's window on the outside world. Tests pass fakes; the app uses browserPlayServices. */
export interface PlayServices {
  /** GETs a URL. In the browser: window.fetch. */
  fetcher: Fetcher;
  /** Where progress, the deck cache and the index cache live. In the browser: localStorage (or undefined when blocked). */
  localStorage: () => Pick<Storage, "getItem" | "setItem"> | undefined;
  /** Where the start flow left the pending round. In the browser: sessionStorage (or undefined when blocked). */
  sessionStorage: () => Pick<Storage, "getItem"> | undefined;
  /** The clock in ms since the epoch: answer times (card history) and the swipe settle time. */
  now: () => number;
  /** A fresh 32-bit seed for dealing a round. */
  randomSeed: () => number;
}

function browserSessionStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** The real services. A module constant, so it is stable across renders. */
export const browserPlayServices: PlayServices = {
  fetcher: (url) => fetch(url),
  localStorage: browserLocalStorage,
  sessionStorage: browserSessionStorage,
  now: () => Date.now(),
  randomSeed: () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0,
};

export const MODE_LABELS: Record<Mode, string> = {
  classic: "Classic",
  streak: "Streak",
  lives: "Three lives",
  timed: "Timed",
};

/** What the ticket shows about the route, taken from the deck index. */
export interface TicketInfo {
  deckCode: string; // "CLF"
  deckName: string; // "AWS Cloud Practitioner": platform title plus deck title
  sectionCode: string; // "SEC", or "ALL" for the whole deck
  sectionName: string; // "Security and compliance", or "Whole deck"
  modeLabel: string; // "Classic"
}

export type RoundStatus =
  | { kind: "loading" }
  | { kind: "redirecting" }
  | { kind: "error"; message: string }
  | { kind: "ready"; round: RoundState; ticket: TicketInfo };

export interface UseRoundResult {
  status: RoundStatus;
  /** Sends an event to the round (answer, next, abandon). Ignored while no round is running. */
  dispatch: (event: RoundEvent) => void;
  /** After a load error: try loading again. */
  retry: () => void;
  /** A new round on the same route and mode, dealt with the card history as stored now (task 12: "Play again"). */
  restart: () => void;
  /** The progress store on the device, for recording a round. */
  progressStore: () => ProgressStore;
}

export const LOAD_FAILED_MESSAGE = "This deck didn't load. Check your connection and try again.";

interface Located {
  deck: IndexDeck;
  ticket: TicketInfo;
}

// Finds the route in the index. Null when the deck or the section no longer exists.
export function locateRoute(index: DeckIndex, pending: PendingRound): Located | null {
  const { deckId, sectionId } = pending.route;
  for (const area of index.areas) {
    for (const platform of area.platforms) {
      const deck = platform.decks.find((candidate) => candidate.id === deckId);
      if (!deck) continue;
      const deckName = `${platform.title} ${deck.title}`;
      const modeLabel = MODE_LABELS[pending.mode];
      if (sectionId === WHOLE_DECK) {
        return { deck, ticket: { deckCode: deck.code, deckName, sectionCode: WHOLE_DECK, sectionName: "Whole deck", modeLabel } };
      }
      const section = deck.sections.find((candidate) => candidate.id === sectionId);
      if (!section) return null;
      return { deck, ticket: { deckCode: deck.code, deckName, sectionCode: section.id, sectionName: section.title, modeLabel } };
    }
  }
  return null;
}

// Loads everything a round needs and deals it. Null means "this route cannot be played any more": go home.
// Throws LoadError when the index or the deck cannot be loaded and nothing is cached.
export async function prepareRound(pending: PendingRound, services: PlayServices): Promise<{ round: RoundState; ticket: TicketInfo } | null> {
  const local = services.localStorage();
  const index = await loadIndex(services.fetcher, local);
  const located = locateRoute(index, pending);
  if (located === null) return null;
  const deck = await loadDeck(located.deck, createDeckCache(local), services.fetcher);

  const store = createLocalStore(local);
  const progress = pruneDeck(
    store.load(),
    deck.id,
    deck.cards.map((card) => card.id),
  );
  store.save(progress);

  const pool = poolFor(deck, pending.route.sectionId);
  if (pool.length === 0) return null;
  const route: Route = { deckId: pending.route.deckId, sectionId: pending.route.sectionId };
  const round = startRound({ mode: pending.mode, route, pool, history: progress.cards, seed: services.randomSeed() });
  return { round, ticket: located.ticket };
}

type Action = RoundEvent | { type: "start"; round: RoundState } | { type: "clear" };

function roundReducer(state: RoundState | null, action: Action): RoundState | null {
  if (action.type === "start") return action.round;
  if (action.type === "clear") return null;
  return state === null ? null : reduce(state, action);
}

type LoadState = { kind: "loading" } | { kind: "redirecting" } | { kind: "error"; message: string } | { kind: "ready"; ticket: TicketInfo };

export function useRound(services: PlayServices, goHome: () => void): UseRoundResult {
  const [round, send] = useReducer(roundReducer, null);
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const pending = readPending(services.sessionStorage());
    if (pending === null) {
      setLoad({ kind: "redirecting" });
      goHome();
      return;
    }
    prepareRound(pending, services).then(
      (prepared) => {
        if (cancelled) return;
        if (prepared === null) {
          setLoad({ kind: "redirecting" });
          goHome();
          return;
        }
        send({ type: "start", round: prepared.round });
        setLoad({ kind: "ready", ticket: prepared.ticket });
      },
      () => {
        if (!cancelled) setLoad({ kind: "error", message: LOAD_FAILED_MESSAGE });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt, services, goHome]);

  const again = useCallback(() => {
    send({ type: "clear" });
    setLoad({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const dispatch = useCallback((event: RoundEvent) => send(event), []);
  const progressStore = useCallback(() => createLocalStore(services.localStorage()), [services]);

  let status: RoundStatus;
  if (load.kind === "ready") status = round === null ? { kind: "loading" } : { kind: "ready", round, ticket: load.ticket };
  else status = load;

  return { status, dispatch, retry: again, restart: again, progressStore };
}
```

- [ ] **Step 29: Run the loading tests and watch them pass**

```bash
pnpm vitest run tests/components/play/useRound.test.tsx
```

Expected: `Tests  13 passed (13)`.

- [ ] **Step 30: Commit**

```bash
git add components/play/useRound.ts tests/components/play/useRound.test.tsx tests/components/play/fixtures.ts
git commit -m "feat: load and deal the pending round in a hook"
```

- [ ] **Step 31: Write the failing tests for the play screen**

Create `tests/components/play/PlayScreen.test.tsx`. It mocks `next/navigation` (the router), skips Motion's animations, and moves the fake clock 1000 ms on after each new card so the 250 ms settle time has passed. The last `describe` holds the review focus cases (see the end of this task).

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayScreen } from "@/components/play/PlayScreen";
import { PROGRESS_KEY } from "@/src/progress/local";
import { parseProgress } from "@/src/progress/progress";
import { DECK_ID, cardByStatement, harness, memoryStorage, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  router.replace.mockReset();
  router.push.mockReset();
});
afterEach(cleanup);

let h: Harness;

async function start(setup: Harness = harness()) {
  h = setup;
  const view = render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  h.advance(1000); // past the 250 ms settle time of the first card
  return view;
}

function statementText(): string | null | undefined {
  return document.querySelector("[data-statement] p:last-of-type")?.textContent;
}

function currentAnswer(): boolean {
  return cardByStatement(statementText()).answer;
}

function swipeCard(): HTMLElement {
  const element = document.querySelector<HTMLElement>("[data-swipe-card]");
  if (!element) throw new Error("no swipe card");
  return element;
}

function status(): string | null {
  return screen.getAllByRole("status").at(-1)?.textContent ?? null;
}

async function answerAndNext(value: boolean) {
  fireEvent.click(screen.getByRole("button", { name: value ? "True" : "False" }));
  fireEvent.click(await screen.findByRole("button", { name: "Next card" }));
  await screen.findByRole("button", { name: "True" });
  h.advance(1000);
}

describe("PlayScreen: starting", () => {
  it("sends the player to the start when there is no pending round", async () => {
    h = harness(null);
    render(<PlayScreen services={h.services} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(h.network.calls).toEqual([]);
  });

  it("sends the player to the start when the section no longer exists", async () => {
    h = harness({ route: { deckId: DECK_ID, sectionId: "OLD" }, mode: "classic" });
    render(<PlayScreen services={h.services} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("shows a calm ticket placeholder while loading, then the first card", async () => {
    h = harness();
    h.network.hold = true;
    const { container } = render(<PlayScreen services={h.services} />);
    expect(screen.getByRole("status").textContent).toBe("Loading your round");
    expect(container.querySelector("[data-pass-placeholder]")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "True" })).toBeNull();
    await act(async () => {
      h.network.release();
    });
    await waitFor(() => expect(h.network.calls).toHaveLength(2));
    await act(async () => {
      h.network.release();
    });
    await screen.findByRole("button", { name: "True" });
    expect(screen.getByRole("img", { name: "Card 1 of 10." })).toBeTruthy();
    expect(cardByStatement(statementText()).section).toBe("SEC");
  });

  it("fills the ticket with the route, the class and the card number", async () => {
    const { container } = await start();
    expect(container.querySelector('[data-leg="from"]')?.textContent).toBe("TSTAWS Test deck");
    expect(container.querySelector('[data-leg="to"]')?.textContent).toBe("SECSecurity and compliance");
    expect(screen.getAllByRole("definition").map((value) => value.textContent?.slice(0, 7))).toEqual(["Classic", "01 / 10", "F ← → T"]);
  });

  it("plays the whole deck as ALL, Whole deck", async () => {
    const { container } = await start(harness({ route: { deckId: DECK_ID, sectionId: "ALL" }, mode: "classic" }));
    expect(container.querySelector('[data-leg="to"]')?.textContent).toBe("ALLWhole deck");
  });

  it("shows the appliesTo line only on a card that has one", async () => {
    await start(harness({ route: { deckId: DECK_ID, sectionId: "APP" }, mode: "classic" }));
    expect(screen.getByText("Applies to Next.js 16")).toBeTruthy();
    cleanup();
    await start();
    expect(screen.queryByText(/^Applies to/)).toBeNull();
  });

  it("removes the stored history of cards that left the deck", async () => {
    const stored = { version: 1, cards: { [`${DECK_ID}-gone-01`]: { seen: 1, lastCorrect: true, lastSeenAt: 1 } }, records: {}, last: null };
    await start(harness(undefined, memoryStorage({ [PROGRESS_KEY]: JSON.stringify(stored) })));
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).cards).toEqual({});
  });
});

describe("PlayScreen: answering", () => {
  it("answers with the True and False buttons and announces the verdict", async () => {
    await start();
    const right = currentAnswer();
    fireEvent.click(screen.getByRole("button", { name: right ? "True" : "False" }));
    expect(status()).toBe(`Correct. The answer is ${right ? "True" : "False"}.`);
  });

  it("says Not quite and the right answer after a wrong answer", async () => {
    await start();
    const right = currentAnswer();
    fireEvent.click(screen.getByRole("button", { name: right ? "False" : "True" }));
    expect(status()).toBe(`Not quite. The answer is ${right ? "True" : "False"}.`);
  });

  it("answers False with the left arrow and True with the right arrow", async () => {
    await start();
    const right = currentAnswer();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(status()).toBe(`${right ? "Not quite" : "Correct"}. The answer is ${right ? "True" : "False"}.`);
    fireEvent.click(await screen.findByRole("button", { name: "Next card" }));
    await screen.findByRole("button", { name: "True" });
    h.advance(1000);
    const second = currentAnswer();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(status()).toBe(`${second ? "Correct" : "Not quite"}. The answer is ${second ? "True" : "False"}.`);
  });

  it("answers with a swipe across the card", async () => {
    await start();
    const right = currentAnswer();
    const card = swipeCard();
    const pointer = { pointerId: 1, isPrimary: true, pointerType: "touch" };
    const from = 200;
    const to = right ? 320 : 80;
    fireEvent.pointerDown(card, { ...pointer, clientX: from, clientY: 400 });
    h.advance(200);
    fireEvent.pointerMove(card, { ...pointer, clientX: (from + to) / 2, clientY: 400 });
    h.advance(200);
    fireEvent.pointerUp(card, { ...pointer, clientX: to, clientY: 400 });
    expect(status()).toBe(`Correct. The answer is ${right ? "True" : "False"}.`);
  });

  it("does not answer an accidental short drag", async () => {
    await start();
    const card = swipeCard();
    const pointer = { pointerId: 1, isPrimary: true, pointerType: "touch" };
    fireEvent.pointerDown(card, { ...pointer, clientX: 200, clientY: 400 });
    h.advance(300);
    fireEvent.pointerUp(card, { ...pointer, clientX: 235, clientY: 404 });
    expect(status()).toBe("");
    expect(screen.getByRole("button", { name: "True" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next card" })).toBeNull();
  });

  it("ignores an answer in the first 250 ms of a card (a double tap on Next card)", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next card" }));
    await screen.findByRole("button", { name: "True" });
    h.advance(100);
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    expect(status()).toBe("");
    h.advance(200);
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    expect(status()).not.toBe("");
  });

  it("shows the right answer, the verdict stamp, the explanation and the source after an answer", async () => {
    await start();
    const card = cardByStatement(statementText());
    fireEvent.click(screen.getByRole("button", { name: card.answer ? "True" : "False" }));
    expect(screen.getByText("The answer is").textContent).toBe(`The answer is${card.answer ? "True" : "False"}`);
    expect(document.querySelector("[data-verdict]")?.textContent).toBe("Correct");
    expect(screen.getByText(card.text.en.explanation)).toBeTruthy();
    const link = screen.getByRole("link", { name: `${card.source.title} (opens in a new tab)` });
    expect(link.getAttribute("href")).toBe(card.source.url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("moves focus to Next card after an answer", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    const next = await screen.findByRole("button", { name: "Next card" });
    await waitFor(() => expect(document.activeElement).toBe(next), { timeout: 1500 });
  });

  it("shows the flight path with the tally and marks the answered card", async () => {
    await start();
    const right = currentAnswer();
    fireEvent.click(screen.getByRole("button", { name: right ? "True" : "False" }));
    expect(screen.getByRole("img", { name: "Card 1 of 10. Card 1 correct." })).toBeTruthy();
    expect(document.querySelector("[data-tally]")?.textContent).toBe("1 correct · 0 wrong");
  });
});

describe("PlayScreen: moving on", () => {
  it("goes to the next card with Next card", async () => {
    await start();
    const first = statementText();
    await answerAndNext(true);
    expect(statementText()).not.toBe(first);
    expect(screen.getByRole("img", { name: /^Card 2 of 10\./ })).toBeTruthy();
    expect(screen.getAllByRole("definition")[1]?.textContent).toBe("02 / 10");
    expect(document.activeElement).toBe(document.querySelector("[data-statement]"));
  });

  it("goes to the next card with Enter", async () => {
    await start();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await screen.findByRole("button", { name: "Next card" });
    fireEvent.keyDown(document.body, { key: "Enter" });
    await screen.findByRole("button", { name: "True" });
    expect(screen.getByRole("img", { name: /^Card 2 of 10\./ })).toBeTruthy();
  });

  it("finishes the round after the tenth card", async () => {
    await start();
    for (let i = 0; i < 9; i++) await answerAndNext(true);
    expect(screen.getByRole("img", { name: /^Card 10 of 10\./ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next card" }));
    expect(await screen.findByRole("heading", { name: "Round complete" })).toBeTruthy();
  });
});

describe("PlayScreen: leaving", () => {
  it("leaves at once, recording nothing, when no card has been answered", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).last).toBeNull();
  });

  it("asks once after an answer; Keep playing goes back to the card", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    const close = screen.getByRole("button", { name: "Leave round" });
    fireEvent.click(close);
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep playing" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(close);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not answer with the arrow keys while the dialog is open", async () => {
    await start();
    await answerAndNext(true);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(status()).toBe("");
  });

  it("records the answers given so far, but no record, when the player leaves", async () => {
    await start();
    const first = cardByStatement(statementText());
    await answerAndNext(first.answer);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave round" }));
    expect(router.replace).toHaveBeenCalledWith("/");
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(Object.keys(progress.cards)).toEqual([first.id]);
    expect(progress.cards[first.id]?.lastCorrect).toBe(true);
    expect(progress.records).toEqual({});
    expect(progress.last).toEqual({ route: { deckId: DECK_ID, sectionId: "SEC" }, mode: "classic", score: null, total: null });
  });
});

describe("PlayScreen: load failure", () => {
  it("says the deck did not load and tries again", async () => {
    h = harness();
    h.network.online = false;
    render(<PlayScreen services={h.services} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This deck didn't load");
    h.network.online = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "True" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("PlayScreen: review focus", () => {
  it("lets Enter open the source link instead of moving to the next card", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    const link = screen.getByRole("link");
    link.focus();
    fireEvent.keyDown(link, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Next card" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /^Card 1 of 10\./ })).toBeTruthy();
  });

  it("plays from the copies on the device when the network is gone", async () => {
    const local = memoryStorage();
    await start(harness(undefined, local));
    cleanup();
    const offline = harness(undefined, local);
    offline.network.online = false;
    await start(offline);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(cardByStatement(statementText()).section).toBe("SEC");
  });
});
```

- [ ] **Step 32: Run the play screen tests and watch them fail**

```bash
pnpm vitest run tests/components/play/PlayScreen.test.tsx
```

Expected: the suite fails to load with `Failed to resolve import "@/components/play/PlayScreen"`.

- [ ] **Step 33: Create the play screen and the route**

Create `components/play/PlayScreen.tsx`:

```tsx
"use client";

// The /play screen (spec sections 6, 8, 9 and 10): loads the pending round, shows the boarding pass with
// the statement and the stub, takes answers from the swipe, the buttons and the keyboard through one
// function, reveals the answer slip, and leaves with one confirmation. The finished round is task 12's
// result screen; until then a placeholder marks its place.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { AnswerButtons } from "@/components/AnswerButtons";
import {
  BoardingPass,
  BoardingPassPlaceholder,
  GateValue,
  PassSlip,
  PassStatement,
  PassStub,
  type TearSide,
} from "@/components/BoardingPass";
import { FlightPath } from "@/components/FlightPath";
import { PillButton } from "@/components/PillButton";
import { RoundButton } from "@/components/RoundButton";
import { SkyBackdrop } from "@/components/SkyBackdrop";
import { CloseIcon } from "@/components/icons";
import { SWIPE } from "@/src/input/swipe";
import {
  currentCard,
  lastAnswer,
  reduce,
  summarise,
  type RoundEvent,
  type RoundState,
} from "@/src/engine/round";
import { applyResult } from "@/src/progress/progress";
import { LeaveDialog } from "./LeaveDialog";
import { browserPlayServices, useRound, type PlayServices, type TicketInfo } from "./useRound";
import { useSwipe } from "./useSwipe";

export interface PlayScreenProps {
  /** The outside world. Defaults to the browser (fetch, localStorage, sessionStorage, Date.now, crypto). Pass a stable object. */
  services?: PlayServices;
}

const EASE = [0.2, 0.7, 0.2, 1] as const;

// The card follows --drag-x (set by useSwipe): translateX(dx) and a rotation of dx / 18 degrees.
const CARD_TRANSFORM: CSSProperties = {
  transform:
    "translateX(calc(var(--drag-x, 0) * 1px)) rotate(calc(var(--drag-x, 0) / var(--gesture-rotation-divisor) * 1deg))",
};

// The ticket scrolls inside the stage when it is taller than the space (long texts, short phones). The
// scroller runs on under the action row, so at 390 by 844 nothing scrolls and the ticket's shadow shows
// in the gap above the buttons, as in the mockup; its side padding lets a dragged card reach the frame edge.
const SCROLLER: CSSProperties = {
  bottom: "calc(-1 * (var(--space-12) + var(--size-actions)))",
  paddingBottom: "calc(var(--space-12) + var(--size-actions))",
  scrollbarWidth: "none",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** What the live region says after an answer: "Correct. The answer is False." */
export function verdictText(correct: boolean, answer: boolean): string {
  return `${correct ? "Correct" : "Not quite"}. The answer is ${answer ? "True" : "False"}.`;
}

export function PlayScreen({ services = browserPlayServices }: PlayScreenProps) {
  const router = useRouter();
  const goHome = useCallback(() => router.replace("/"), [router]);
  const { status, dispatch, retry, progressStore } = useRound(services, goHome);

  // Leaving: the round is abandoned, the answers given so far go into the card history (no record),
  // and the player goes back to the start. Without answers nothing is recorded.
  const leave = useCallback(
    (round: RoundState) => {
      dispatch({ type: "abandon" });
      if (round.answers.length > 0) {
        const store = progressStore();
        store.save(applyResult(store.load(), summarise(reduce(round, { type: "abandon" }))).progress);
      }
      goHome();
    },
    [dispatch, progressStore, goHome],
  );

  if (status.kind === "error") return <LoadFailed onRetry={retry} onLeave={goHome} />;
  if (status.kind !== "ready" || status.round.abandoned) return <Loading onLeave={goHome} />;

  const { round, ticket } = status;
  // BEGIN finished-round placeholder (task 12 replaces this block)
  if (round.phase === "finished") return <FinishedPlaceholder round={round} />;
  // END finished-round placeholder

  return <RoundView round={round} ticket={ticket} now={services.now} dispatch={dispatch} onLeave={() => leave(round)} />;
}

// BEGIN FinishedPlaceholder (task 12 deletes this component)
function FinishedPlaceholder({ round }: { round: RoundState }) {
  const result = summarise(round);
  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center">
      <SkyBackdrop />
      <h1 className="m-0 font-(family-name:--type-step-title-family) text-(length:--type-step-title-size) font-(--type-step-title-weight)">
        Round complete
      </h1>
      <p role="status" className="m-0 mt-(--space-8)">
        {result.score} of {result.total} correct
      </p>
    </main>
  );
}
// END FinishedPlaceholder

function Header({ onLeave, closeRef, children }: { onLeave: () => void; closeRef?: Ref<HTMLButtonElement>; children?: ReactNode }) {
  return (
    <header className="relative z-10 flex h-(--size-header) flex-none items-center gap-(--space-12)">
      <RoundButton ref={closeRef} label="Leave round" onClick={onLeave}>
        <CloseIcon />
      </RoundButton>
      {children}
    </header>
  );
}

function Loading({ onLeave }: { onLeave: () => void }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <SkyBackdrop />
      <Header onLeave={onLeave} />
      <section className="relative mt-(--space-12) min-h-0 flex-1">
        <BoardingPassPlaceholder />
      </section>
      <div className="mt-(--space-12) h-(--size-actions) flex-none" />
      <p role="status" className="sr-only">
        Loading your round
      </p>
    </main>
  );
}

function LoadFailed({ onRetry, onLeave }: { onRetry: () => void; onLeave: () => void }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <SkyBackdrop />
      <Header onLeave={onLeave} />
      <section className="relative mt-(--space-12) min-h-0 flex-1">
        <div role="alert" className="rounded-(--radius-card) bg-(--color-surface-raised) p-(--space-20) text-(--color-ink) shadow-(--elevation-ticket)">
          <h1 className="m-0 font-(family-name:--type-step-title-family) text-(length:--type-step-title-size) leading-(--type-step-title-line-height) font-(--type-step-title-weight) tracking-(--type-step-title-letter-spacing)">
            This deck didn&apos;t load
          </h1>
          <p className="m-0 mt-(--space-8) font-(family-name:--type-body-family) text-(length:--type-body-size) leading-(--type-body-line-height) font-(--type-body-weight)">
            Check your connection and try again.
          </p>
        </div>
      </section>
      <div className="mt-(--space-12) h-(--size-actions) flex-none">
        <PillButton onClick={onRetry}>Try again</PillButton>
      </div>
    </main>
  );
}

interface RoundViewProps {
  round: RoundState;
  ticket: TicketInfo;
  now: () => number;
  dispatch: (event: RoundEvent) => void;
  onLeave: () => void;
}

function RoundView({ round, ticket, now, dispatch, onLeave }: RoundViewProps) {
  const reduced = useReducedMotion() ?? false;
  const [confirming, setConfirming] = useState(false);
  const shownAt = useRef(0);
  const statementRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  const card = currentCard(round);
  const answered = round.phase === "answered";
  const last = answered ? lastAnswer(round) : undefined;
  const total = round.cards.length;

  // A new card: start its settle time, scroll the ticket to the top, put focus on the statement.
  useEffect(() => {
    if (round.phase !== "question") return;
    shownAt.current = now();
    scrollerRef.current?.scrollTo?.({ top: 0 });
    statementRef.current?.focus({ preventScroll: true });
  }, [round.cards, round.index, round.phase, now]);

  // After an answer, focus moves to "Next card" once it has arrived (420 ms, at once with reduced motion).
  useEffect(() => {
    if (!answered) return;
    const timer = setTimeout(() => nextRef.current?.focus({ preventScroll: true }), reduced ? 0 : 420);
    return () => clearTimeout(timer);
  }, [answered, round.index, reduced]);

  // Closing the dialog with "Keep playing" returns focus to the close button (once <main> is not inert).
  useEffect(() => {
    if (!confirming && restoreFocus.current) {
      restoreFocus.current = false;
      closeRef.current?.focus();
    }
  }, [confirming]);

  // The one answer path: swipe, buttons and keys all come here. Ignored outside the question phase,
  // while the dialog is open, and for 250 ms after a card appears (so a double tap on "Next card"
  // cannot answer the next card).
  const answer = useCallback(
    (value: boolean) => {
      if (round.phase !== "question" || confirming) return;
      const at = now();
      if (at - shownAt.current < SWIPE.settleMs) return;
      dispatch({ type: "answer", value, at });
    },
    [round.phase, confirming, now, dispatch],
  );

  const next = useCallback(() => dispatch({ type: "next" }), [dispatch]);

  // Keyboard: left arrow answers False, right arrow True; Enter is "Next card" after an answer
  // (unless focus is on a link or a button, which handle Enter themselves).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || confirming || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (round.phase === "question" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        answer(event.key === "ArrowRight");
      } else if (round.phase === "answered" && event.key === "Enter") {
        const target = event.target;
        if (target instanceof Element && target.closest("a, button, input, select, textarea")) return;
        event.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [round.phase, confirming, answer, next]);

  const swipe = useSwipe<HTMLDivElement>({
    enabled: round.phase === "question" && !confirming,
    cardShownAt: () => shownAt.current,
    now,
    onSwipe: answer,
  });

  const requestLeave = () => {
    if (round.answers.length === 0) onLeave();
    else setConfirming(true);
  };

  if (!card) return null;

  const tear: TearSide = last?.correct === false ? "right" : "left";
  const cardNumber = pad2(round.index + 1);

  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col" inert={confirming}>
        <SkyBackdrop />
        <Header onLeave={requestLeave} closeRef={closeRef}>
          <FlightPath
            total={total}
            results={round.answers.map((a) => a.correct)}
            current={round.index}
            answered={answered}
          />
        </Header>
        <section aria-label="Card" className="relative mt-(--space-12) -mx-(--size-gutter) min-h-0 flex-1">
          <div
            ref={scrollerRef}
            className="absolute inset-x-0 top-0 overflow-x-hidden overflow-y-auto overscroll-contain px-(--size-gutter)"
            style={SCROLLER}
          >
            <div
              ref={swipe.ref}
              data-swipe-card=""
              onPointerDown={swipe.onPointerDown}
              onPointerMove={swipe.onPointerMove}
              onPointerUp={swipe.onPointerUp}
              onPointerCancel={swipe.onPointerCancel}
              className={[
                "group relative touch-pan-y select-none",
                "transition-transform duration-(--duration-t3) ease-(--easing-spring) data-dragging:transition-none",
                answered ? "cursor-default" : "cursor-grab data-dragging:cursor-grabbing",
              ].join(" ")}
              style={CARD_TRANSFORM}
            >
              <BoardingPass
                from={{ code: ticket.deckCode, name: ticket.deckName }}
                to={{ code: ticket.sectionCode, name: ticket.sectionName }}
                fields={[
                  { label: "Class", value: ticket.modeLabel },
                  { label: "Card", value: `${cardNumber} / ${pad2(total)}` },
                  { label: "Gate", value: <GateValue /> },
                ]}
                jolt={answered}
                lower={
                  <div className="grid min-h-(--size-lower)">
                    {last ? (
                      <PassSlip
                        key={`slip-${round.index}`}
                        className="[grid-area:1/1]"
                        answer={last.card.answer}
                        correct={last.correct}
                        explanation={last.card.text.en.explanation}
                        source={last.card.source}
                        animateStamp
                      />
                    ) : null}
                    <AnimatePresence initial={false} custom={tear}>
                      {round.phase === "question" ? (
                        <PassStub
                          key={`stub-${round.index}`}
                          className="[grid-area:1/1]"
                          routeLine={`${ticket.deckCode} → ${ticket.sectionCode} · ${ticket.modeLabel}`}
                          cardLabel={`Card ${cardNumber}`}
                          barcode={card.id}
                        />
                      ) : null}
                    </AnimatePresence>
                  </div>
                }
              >
                <PassStatement ref={statementRef} appliesTo={card.appliesTo}>
                  {card.text.en.statement}
                </PassStatement>
              </BoardingPass>
            </div>
          </div>
        </section>
        <div className="relative z-10 mt-(--space-12) h-(--size-actions) flex-none">
          <AnimatePresence initial={false}>
            {round.phase === "question" ? (
              <motion.div
                key="answer"
                className="absolute inset-0"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                <AnswerButtons onAnswer={answer} />
              </motion.div>
            ) : (
              <motion.div
                key="next"
                className="absolute inset-0"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.22, delay: reduced ? 0 : 0.36, ease: EASE } }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                <PillButton ref={nextRef} trailingIcon="→" onClick={next}>
                  Next card
                </PillButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p role="status" className="sr-only">
          {last ? verdictText(last.correct, last.card.answer) : ""}
        </p>
      </main>
      <LeaveDialog
        open={confirming}
        onStay={() => {
          restoreFocus.current = true;
          setConfirming(false);
        }}
        onLeave={onLeave}
      />
    </>
  );
}
```

Create `app/play/page.tsx`:

```tsx
import { PlayScreen } from "@/components/play/PlayScreen";

// A server component that renders the client-side round. Everything it needs is read on the device.
export default function PlayPage() {
  return <PlayScreen />;
}
```

- [ ] **Step 34: Run the play screen tests and watch them pass**

```bash
pnpm vitest run tests/components/play/PlayScreen.test.tsx
```

Expected: `Tests  26 passed (26)`. If "moves focus to Next card after an answer" times out, check that the answered-phase effect still focuses `nextRef` after 420 ms (the test waits up to 1500 ms with real timers).

Then run every component test, so the token guard of task 9 (`tests/components/no-raw-colours.test.ts`) also checks the new files, and the type check:

```bash
pnpm vitest run tests/components
pnpm typecheck
```

Expected, in plan order (task 10 done): `Test Files  20 passed (20)` and `Tests  272 passed (272)` (task 9's 8 component files with 101 tests, task 10's 5 with 71 and this task's 7 with 100). Without task 10 the numbers are `15` and `201`. `tsc --noEmit` prints nothing.

- [ ] **Step 34a: Write the failing tests for leaving with the back gesture**

The close control is not the only way out of a round. The phone's back gesture (an edge swipe on iOS, the back gesture or button on Android) and the browser's back button leave `/play` through the router, with no dialog, and `PlayScreen` simply unmounts. Spec section 6 says the answers already given stay in the card history when a round is left; without this step they are thrown away, so a card the player just got wrong does not come back first next time. Append to the end of `tests/components/play/PlayScreen.test.tsx`:

```tsx
describe("PlayScreen: leaving with the back gesture", () => {
  // The phone's back gesture (or the browser's back button) leaves /play without the close control, so no
  // dialog is shown. Spec section 6: a round that is left sets no record, and the answers already given
  // stay in the card history.
  it("keeps the answers given so far in the card history, but sets no record, when the screen goes away mid-round", async () => {
    const view = await start();
    const first = cardByStatement(statementText());
    await answerAndNext(first.answer);
    view.unmount();
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(Object.keys(progress.cards)).toEqual([first.id]);
    expect(progress.cards[first.id]?.lastCorrect).toBe(true);
    expect(progress.records).toEqual({});
    expect(progress.last).toEqual({ route: { deckId: DECK_ID, sectionId: "SEC" }, mode: "classic", score: null, total: null });
  });

  it("records nothing when the screen goes away before the first answer", async () => {
    const view = await start();
    view.unmount();
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(progress.cards).toEqual({});
    expect(progress.last).toBeNull();
  });

  it("does not record the answers twice when the round was already left with Leave round", async () => {
    const view = await start();
    const first = cardByStatement(statementText());
    await answerAndNext(first.answer);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave round" }));
    view.unmount();
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).cards[first.id]?.seen).toBe(1);
  });
});
```

- [ ] **Step 34b: Run them and watch the first one fail**

```bash
pnpm vitest run tests/components/play/PlayScreen.test.tsx
```

Expected: `Tests  1 failed | 28 passed (29)`. The failure is "keeps the answers given so far in the card history..." with `AssertionError: expected [] to deeply equal [ 'test-deck-sec-…' ]`; the other two already pass and guard the fix against recording too much.

- [ ] **Step 34c: Leave the round when the screen goes away**

In `components/play/PlayScreen.tsx`, replace the `leave` callback together with its two comment lines (from `// Leaving: the round is abandoned` to the `);` that closes its `useCallback`) with:

```tsx
  // A round in progress with answers that are not in the card history yet. Leaving any other way than the
  // close control (the phone's back gesture, the browser's back button) unmounts this screen; the cleanup
  // below then leaves the round the same way, so those answers are not lost.
  const unsaved = useRef<RoundState | null>(null);
  useEffect(() => {
    const round = status.kind === "ready" ? status.round : null;
    unsaved.current = round && round.phase !== "finished" && !round.abandoned && round.answers.length > 0 ? round : null;
  });
  useEffect(
    () => () => {
      const round = unsaved.current;
      unsaved.current = null;
      if (round) {
        const store = progressStore();
        store.save(applyResult(store.load(), summarise(reduce(round, { type: "abandon" }))).progress);
      }
    },
    [progressStore],
  );

  // Leaving: the round is abandoned, the answers given so far go into the card history (no record),
  // and the player goes back to the start. Without answers nothing is recorded.
  const leave = useCallback(
    (round: RoundState) => {
      unsaved.current = null;
      dispatch({ type: "abandon" });
      if (round.answers.length > 0) {
        const store = progressStore();
        store.save(applyResult(store.load(), summarise(reduce(round, { type: "abandon" }))).progress);
      }
      goHome();
    },
    [dispatch, progressStore, goHome],
  );
```

`useRef` and `useEffect` are already imported. `progressStore` is stable (a `useCallback` over the stable `services`), so the cleanup runs only when the screen unmounts. A finished round is left out (task 12's result screen records it, once), and so is an abandoned one (`leave` saved it). React strict mode's extra mount and unmount happens while the round is still loading, so it records nothing. Not covered: a reload, or the system discarding a background tab, never unmounts React, so those answers are still lost.

- [ ] **Step 34d: Run the component tests and the type check**

```bash
pnpm vitest run tests/components
pnpm typecheck
```

Expected: three tests more than step 34 (`Tests  275 passed (275)` in plan order, `204` without task 10); `tsc --noEmit` prints nothing. Task 12's quoted totals for these files rise by the same 3 tests. Verified in the spike, where the whole unit suite stays green.

- [ ] **Step 35: Commit**

```bash
git add components/play/PlayScreen.tsx app/play/page.tsx tests/components/play/PlayScreen.test.tsx
git commit -m "feat: add the play screen with swipe, button and keyboard answers"
```

- [ ] **Step 36: Compare with the mockup**

Create `task11-shoot.mjs` in the repository root (temporary, never committed). It plays like the mockup (card 1 right, card 2 right, card 3 wrong) on a fixed seed, then photographs card 4 as a question, in the middle of a drag, answered right and answered wrong. It uses reduced motion so every picture shows an end state.

```js
// TEMPORARY: screenshots of /play at 390 by 844 (scale 2, like the mockup shots), never committed.
// Plays the round like the mockup: card 1 right, card 2 right, card 3 wrong, then shoots card 4 as a
// question, answered right, and (in a second run) answered wrong.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = "http://localhost:3100";
const deck = JSON.parse(readFileSync("public/decks/aws-clf-c02.json", "utf8"));
const answerOf = (statement) => deck.cards.find((card) => card.text.en.statement === statement).answer;
const pending = JSON.stringify({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" });

const browser = await chromium.launch({ channel: "chromium" });

async function play(name, fourth) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  // The same deal every time: a fixed seed.
  await page.addInitScript(() => {
    crypto.getRandomValues = (array) => {
      array.fill(7);
      return array;
    };
  });
  await page.goto(`${base}/`);
  await page.evaluate((value) => sessionStorage.setItem("truthy.pending.v1", value), pending);
  await page.goto(`${base}/play`);
  await page.evaluate(() => document.fonts.ready);
  const statement = page.locator("[data-statement] p").last();
  const answerCard = async (right) => {
    await page.waitForTimeout(300); // the 250 ms settle time
    const truth = answerOf(await statement.textContent());
    await page.keyboard.press(truth === right ? "ArrowRight" : "ArrowLeft");
    await page.getByRole("button", { name: "Next card" }).waitFor();
  };
  for (const right of [true, true, false]) {
    await answerCard(right);
    await page.getByRole("button", { name: "Next card" }).click();
    await page.getByRole("button", { name: "True" }).waitFor();
  }
  await page.waitForTimeout(300);
  if (fourth === "drag") {
    await page.mouse.move(195, 560);
    await page.mouse.down();
    await page.mouse.move(235, 562, { steps: 4 });
    await page.mouse.move(265, 563, { steps: 4 });
    await page.screenshot({ path: `test-results/task11-${name}.png` });
    await page.mouse.up();
  } else if (fourth === undefined) {
    await page.screenshot({ path: `test-results/task11-${name}.png` });
  } else {
    await answerCard(fourth);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/task11-${name}.png` });
  }
  console.log(`wrote test-results/task11-${name}.png`);
  await page.close();
}

await play("question");
await play("drag", "drag");
await play("answer", true);
await play("wrong", false);
await browser.close();
```

Build, serve, photograph, stop the server:

```bash
pnpm build
pnpm start --port 3100 &
sleep 3
node task11-shoot.mjs
kill %1
```

Expected: `wrote test-results/task11-question.png`, `...-drag.png`, `...-answer.png`, `...-wrong.png` (780 by 1688 pixels, like the mockup shots; `test-results/` is gitignored). If the build lists no `/play` route, step 33 is incomplete.

Open each pair side by side (the dealt card differs from the mockup's, so compare places, sizes and type, not words):

| Ours | Mockup | Must match |
|---|---|---|
| `test-results/task11-question.png` | `design/round2/shots/e02-question.png` | Round button 96 shot px at x 32 to 128, y 112 to 208. Flight path: dotted curve from x 186 to 714, solid line and three marks (tick, tick, red square with x) before the amber plane on waypoint 4, open circles after, the last one larger; label row "Card **4** of 10" left and "2 correct · 1 wrong" right at y about 192. Ticket from y 240 to about 1456: amber carrier 88 tall with the cloud, "Truthy" and "BOARDING PASS"; legs 192 tall with CLF and SEC in Mono 34 (68 shot px) at the same height; field grid 104 tall with rules above, below and between the cells, "Class / Classic", "Card / 04 / 10", "Gate / F ← → T"; statement area 376 tall, the text Overpass 600 25 (50 shot px) centred vertically, left edge x 72; dashed perforation at y 996 between two notches; stub 456 tall: route line and "Card 04" at y about 1056, barcode y 1144 to 1296 from x 72 to 708, hint row at y about 1392 with "← False" red, "swipe to board" grey, "True →" blue. False and True pills y 1492 to 1612. |
| `test-results/task11-drag.png` | `design/round2/shots/e02-question.png` (no drag shot exists; the mockup's drag rules are in `.card`, `.stub` and `.intent`) | The card has moved right and turned clockwise by about dx / 18 degrees; the blue "✓ True" intent stamp, tilted -7 degrees with a 3px border, shows at the left of the stub over the barcode; the stub has dropped a few px and turned slightly; the header and the buttons have not moved. |
| `test-results/task11-answer.png` | `design/round2/shots/e02-answer.png` | The stub is gone and the slip shows on the sunk paper with the same notches: "The answer is" grey 13 over the answer in ExtraBold 26; the green double-bordered "✓ Correct" stamp at the right, tilted -6 degrees; the explanation in 15.5 ink below; the blue underlined source link with the book icon and "→" near the bottom. Waypoint 4 is a green circle with a tick, the plane is gone, the tally reads "3 correct · 1 wrong". The pill row is one ink "Next card →" pill at y 1492 to 1612 (here with the focus ring, because the script answered with the keyboard and focus moved to it). |
| `test-results/task11-wrong.png` | `design/round2/shots/e02-wrong.png` | As above with the red "✗ Not quite" stamp, a red square on waypoint 4 and "2 correct · 2 wrong". |

Also check by hand at `http://localhost:3100/play` before stopping the server (open `/` first and run `sessionStorage.setItem("truthy.pending.v1", JSON.stringify({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" }))` in the console): with motion allowed, answering tears the stub down and to the left (right after a wrong answer) while the stamp drops in and the ticket jolts; a drag of less than 90 px springs back without answering; Tab reaches "Leave round", "False" and "True" with the ink ring; in a 375 by 667 window the ticket scrolls under the action row and the source link can be scrolled into view.

Measured in the spike (DOM boxes at 390 by 844, mockup versus ours): header 52 / 52, label row 91 / 91, carrier 120 to 164 / same, legs 96 / 96, field grid 52 / 51.4, statement 188 / 188, lower part 228 / 228, actions 746 / 746. Pixel differences: round button and sky 0 percent, carrier band 1.9 percent, False/True pills 1.4 percent. What still differs, and why:
- The arrows "←" and "→" (Gate, stub route line, hint row, "Next card →", source link) are wider and thinner than in the mockup. Neither Overpass nor Overpass Mono has those glyphs, and the fallback face that next/font generates ("Overpass Mono Fallback", local Arial at 138 percent) catches them before `ui-monospace` does. This comes from task 9's `app/layout.tsx`; fix it there (`adjustFontFallback: false` for `Overpass_Mono`, or draw the arrows as icons), not here.
- The field grid is 0.6 px shorter and "BOARDING PASS" sits 1 px higher, because the type roles fix line heights (1.27) where the mockup leaves `normal`. Accept it, as task 9 did for the pills.
- Waypoints sit exactly on the curve at t = i / 9; the mockup placed them by hand, up to about 3 px away, and its plane points 8 degrees up where ours follows the curve (4 degrees at card 4).
- Real deck names wrap by width ("AWS Cloud Practitioner" fits one line at 390); the mockup forces "AWS Cloud / Practitioner" with a `<br>`.
- Real explanations are longer than the mockup's (median about 150 characters against 114), so the slip grows past 228 and the ticket's bottom edge can sit under "Next card"; it scrolls.

Delete the temporary file and confirm the gates:

```bash
rm task11-shoot.mjs
pnpm test
pnpm typecheck
pnpm build
git status --short
```

Expected: all tests pass, `tsc --noEmit` prints nothing, the build lists `/`, `/_not-found` and `/play` as static, and `git status --short` prints nothing.

#### Notes for later tasks (verified in the spike)

- **Result screen (task 12).** Render it where the finished-round placeholder is (see Produces). The round's answers are `round.answers`, its summary `summarise(round)`; record it once with `applyResult(store.load(), summarise(round))` and `store.save(...)` through `progressStore()`, guarding against React running an effect twice. "Play again" is `restart()` (the pending round is still in `sessionStorage`); "Choose another route" and the close button go home with `router.replace("/")`. Reuse `BoardingPass` with the score block as `children` and the missed list inside a `PassLower tone="sunk"` as `lower`, and `FlightPath variant="completed"`.
- **End-to-end (task 13).** Seed the round with `sessionStorage.setItem("truthy.pending.v1", ...)` on `/` before opening `/play`, or go through the start flow. Wait about 300 ms after a card appears before answering (settle time). For a swipe, drive `[data-swipe-card]` with touch or mouse moves of more than 90 px that start at least 24 px from the screen edge. For a deterministic deal, replace `crypto.getRandomValues` in an init script, as `task11-shoot.mjs` does.
- **Headless Chromium on a Mac with "Reduce motion" on** reports `prefers-reduced-motion: reduce`; pass `reducedMotion: "no-preference"` to see the movement.

#### Review focus candidates

Conditions the spec implies, that a person could hit, and that the first draft of the tests did not cover. Each now has a test:

1. A quick double tap on "Next card" lands its second tap on True or False, which appear under the same finger, and answers the next card unseen (spec section 8: input is ignored for 250 ms after a new card appears; the settle time had only been applied to swipes). Covered by "ignores an answer in the first 250 ms of a card (a double tap on Next card)" in `tests/components/play/PlayScreen.test.tsx`, steps 31 to 34.
2. A keyboard player tabs to the source link after an answer and presses Enter to read it: the global Enter shortcut for "Next card" would also fire and move on, so the explanation is gone when they return (spec sections 8 and 9: Enter is the following action; the source opens in a new tab). Covered by "lets Enter open the source link instead of moving to the next card" in `tests/components/play/PlayScreen.test.tsx`, steps 31 to 34.
3. A player starts a round on a train that loses signal: the deck and the index were loaded before, so the round must play from the copies on the device rather than show "This deck didn't load" (spec sections 5 and 10: a failed fetch with a cached copy uses the copy). Covered by "plays from the copies on the device when the network is gone" in `tests/components/play/PlayScreen.test.tsx` (steps 31 to 34) and "plays from the cached index and deck when the network fails" in `tests/components/play/useRound.test.tsx` (steps 26 to 29).
