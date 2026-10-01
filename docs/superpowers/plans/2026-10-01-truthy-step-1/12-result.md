### Task 12: Result and progress recording

The result screen of a finished Classic round, and recording that round in the progress on the device: the completed flight path, the ticket with Class, Cards and Missed, the score block with the comparison against the record for this route and mode ("New best" stamp, "First round on this route", "Equals your best", "N short of your best"), the missed cards with a "Why" disclosure, "Play again" and "Choose another route". It replaces the placeholder that task 11 left in `components/play/PlayScreen.tsx`.

The visual specification is `design/flow/screens/result-classic.html` (shots `design/flow/shots/result-classic-1.png` closed and `result-classic-2.png` with the first "Why" open). The New best stamp on results is drawn in `design/flow/screens/result-timed.html` (shot `design/flow/shots/result-timed-1.png`). Behaviour comes from the spec, sections 6 ("Result"), 7 and 9, and from `design/system/DESIGN-SYSTEM.md` 5.11, 5.14 and 5.15.

Every command runs from the repository root. Tasks 1 to 9 and 11 are done (`pnpm test`, `pnpm typecheck` and `pnpm build` are green). Task 10 is not needed: the tests inject the pending round, and the comparison step writes it into `sessionStorage` itself.

**How it fits together.**
- `PlayScreen` renders `<ResultView />` when the round reaches the phase `finished` and is not abandoned (an abandoned round never gets there: task 11 shows the loading view while it navigates home).
- Recording happens once per round. `recordRound(round, store)` runs `applyResult(store.load(), summarise(round))`, saves the new progress and remembers the outcome in a module-level `WeakMap` keyed by the round object; a second call for the same round returns the remembered outcome and writes nothing. `ResultView` calls it from an effect, so a re-render, React strict mode's second effect run or a remount never records twice. The render itself computes the same outcome from the stored progress without writing, so the comparison is right in the first frame.
- `applyResult` (task 6) updates the card history, the record (only when beaten, or on the first finished round) and `last`, the route, mode and score the start screen's "Continue" line shows.
- "Play again" is `restart()` from `useRound` (task 11): it clears the round, loads the pending route again (from the caches when the network is gone) and deals with the card history as stored now and a new seed from `services.randomSeed()`. No navigation, no page reload. "Choose another route" and the close button call `goHome` (`router.replace("/")`).
- The ticket fills the stage and the missed-card list scrolls inside it, as in the mockup. On a phone too short for the score part plus a 228 px list (`--size-lower`), the stage scrolls instead (checked at 375 by 667 in the last step).

**Files:**
- Create: `components/ScoreBlock.tsx`, `components/MissedCards.tsx`, `components/play/ResultView.tsx`
- Modify: `components/play/PlayScreen.tsx` (the finished-round lines task 11 marked, the `useRound` destructuring, one import, the header comment; the `FinishedPlaceholder` component is deleted)
- Tests: `tests/components/ScoreBlock.test.tsx`, `tests/components/MissedCards.test.tsx`, `tests/components/play/ResultView.test.tsx`, `tests/components/play/PlayScreenResult.test.tsx`; modify the test "finishes the round after the tenth card" in `tests/components/play/PlayScreen.test.tsx`
- Temporary, never committed (last step only): `task12-shoot.mjs`

**Interfaces:**
- Consumes:
  - Task 5, `@/src/engine/round`: `summarise(state: RoundState): RoundResult`, types `RoundState`, `Answered` (`{ card: Card; given: boolean; correct: boolean; at: number }`), `startRound`, `reduce` (tests only).
  - Task 6, `@/src/progress/progress`: `applyResult(progress: Progress, result: RoundResult): ApplyOutcome`, `interface ApplyOutcome { progress: Progress; previousBest: number | null; isNewBest: boolean }`, `recordKey(route: Route, mode: Mode): string`, `emptyProgress()`, `parseProgress(raw)` (tests); `@/src/progress/local`: `createLocalStore(storage): ProgressStore`, `interface ProgressStore { load(): Progress; save(progress: Progress): void }` (never throws), `PROGRESS_KEY` (tests).
  - Task 8, `@/src/content/load`: `poolFor(deck, sectionId): Card[]` (tests only).
  - Task 9: `SkyBackdrop()`, `RoundButton({ label, children, onClick })`, `PillButton({ children, leadingIcon, onClick })`, `QuietButton({ children, leadingIcon, onClick })`; from `@/components/icons`: `CloseIcon`, `ReplayIcon`, `RouteIcon`, `StarIcon`, `BookIcon`, `ChevronIcon({ direction: "down" })`; the `.sr-only` utility; the ink focus ring (2 px, offset 2) from `app/globals.css`.
  - Task 11: `BoardingPass({ from, to, fields, children, lower, jolt, className })` and `PassLower({ tone, children, className })` from `@/components/BoardingPass`; `FlightPath({ variant: "completed", total, results })` from `@/components/FlightPath`; `SPRING_EASE` from `@/components/Stamp`; from `@/components/play/useRound`: `useRound(services, goHome): { status, dispatch, retry, restart, progressStore }`, `type TicketInfo = { deckCode; deckName; sectionCode; sectionName; modeLabel }`, `type PlayServices` (its `localStorage` and `randomSeed` are replaced in tests); test doubles from `tests/components/play/fixtures.ts`: `harness(pending?, local?)`, `memoryStorage(initial?)`, `cardByStatement`, `DECK`, `DECK_ID`, type `Harness`, type `MemoryStorage`.
  - Task 2 CSS variables: `--color-` `ink`, `ink-muted`, `rule`, `true`, `correct`, `surface-sunk`, `surface-sunk-clear`; every `--type-*` of the roles `field-label`, `score`, `emphasis`, `mono-data`, `mono-data-strong`, `mono-caption`, `list-statement`, `body`, `stamp`; `--space-2/4/6/8/10/12/14/16/18/20`; `--size-header`, `--size-ticket-inset`, `--size-touch-min`, `--size-lower`, `--size-pill`; `--radius-small`, `--radius-card`; `--stroke-rule`, `--stroke-stamp`, `--stroke-quote`; `--duration-t2`, `--duration-t3`, `--easing-ease`.
- Produces (task 13 and the later modes rely on these):
  - `components/ScoreBlock.tsx` (`"use client"`):
    - `ScoreBlock(props: ScoreBlockProps)`, `interface ScoreBlockProps { score: number; total: number; comparison: Comparison; label?: string; animate?: boolean }` (`label` defaults to "Your score"; `animate` lets the New best stamp land, otherwise it is shown at rest).
    - `type Comparison = { kind: "first" } | { kind: "new-best"; previousBest: number } | { kind: "equal"; best: number } | { kind: "short"; best: number; by: number }`.
    - `compareWithBest(score: number, previousBest: number | null): Comparison`.
    - DOM hooks: `[data-score-block]`, `[data-score]` (text "7 of 10"), `[data-comparison]` (its value is the kind), `[data-new-best]`.
  - `components/MissedCards.tsx` (`"use client"`):
    - `MissedCards(props: MissedCardsProps)`, `interface MissedCardsProps { missed: readonly MissedCard[]; className?: string }`. A region named "Missed cards" with an `<ol>`; each item `[data-missed-card="<number>"]` has a "Why" button named "Why, card NN" with `aria-expanded` and `aria-controls` pointing at a region labelled by the button that holds the explanation and the source link `"<title> (opens in a new tab)"`. With no missed cards: the region holds one line, "No missed cards".
    - `interface MissedCard { number: number; given: boolean; answer: boolean; statement: string; explanation: string; source: { title: string; url: string } }`.
    - `missedCards(answers: readonly Answered[]): MissedCard[]` (wrong answers in order, numbered by their place in the round from 1).
  - `components/play/ResultView.tsx` (`"use client"`):
    - `ResultView(props: ResultViewProps)`, `interface ResultViewProps { round: RoundState; ticket: TicketInfo; progressStore: () => ProgressStore; onPlayAgain: () => void; onHome: () => void }` (`progressStore` must be stable).
    - `recordRound(round: RoundState, store: ProgressStore): ApplyOutcome` (writes once per round object).
    - `useRecordedRound(round: RoundState, progressStore: () => ProgressStore): ApplyOutcome`.
    - Accessible landmarks for task 13: the heading `h1` "Round complete" (visually hidden, focused when the result appears); the flight path `role="img"` named "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9."; buttons "Close results", "Play again", "Choose another route", "Why, card NN".
  - `components/play/PlayScreen.tsx`: unchanged props (`PlayScreen({ services? })`); a finished round now renders `ResultView`.

- [ ] **Step 1: Write the failing tests for the score block**

Create `tests/components/ScoreBlock.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScoreBlock, compareWithBest } from "@/components/ScoreBlock";

afterEach(cleanup);

function comparisonText(container: HTMLElement): string | null | undefined {
  return container.querySelector("[data-comparison]")?.textContent;
}

describe("compareWithBest", () => {
  it("is a first round when the route and mode had no record", () => {
    expect(compareWithBest(7, null)).toEqual({ kind: "first" });
  });

  it("is a new best when the score beats the record", () => {
    expect(compareWithBest(8, 7)).toEqual({ kind: "new-best", previousBest: 7 });
  });

  it("equals the best when the score matches the record", () => {
    expect(compareWithBest(9, 9)).toEqual({ kind: "equal", best: 9 });
  });

  it("says how far short of the record the score is", () => {
    expect(compareWithBest(7, 9)).toEqual({ kind: "short", best: 9, by: 2 });
    expect(compareWithBest(0, 10)).toEqual({ kind: "short", best: 10, by: 10 });
  });
});

describe("ScoreBlock", () => {
  it("shows Your score over the score and its total", () => {
    const { container } = render(<ScoreBlock score={7} total={10} comparison={{ kind: "first" }} />);
    expect(screen.getByRole("term").textContent).toBe("Your score");
    expect(screen.getByRole("definition").textContent).toBe("7 of 10");
    expect(container.querySelector("[data-score]")?.textContent).toBe("7 of 10");
  });

  it("takes another label", () => {
    render(<ScoreBlock score={14} total={17} label="Correct" comparison={{ kind: "first" }} />);
    expect(screen.getByRole("term").textContent).toBe("Correct");
  });

  it("says First round on this route when there was no record", () => {
    const { container } = render(<ScoreBlock score={7} total={10} comparison={{ kind: "first" }} />);
    expect(comparisonText(container)).toBe("First round on this route");
    expect(container.querySelector("[data-new-best]")).toBeNull();
  });

  it("stamps New best over the previous best when the record is beaten", () => {
    const { container } = render(<ScoreBlock score={8} total={10} comparison={{ kind: "new-best", previousBest: 7 }} />);
    const stamp = container.querySelector<HTMLElement>("[data-new-best]");
    expect(stamp?.textContent).toBe("New best");
    expect(stamp?.className).toContain("border-double");
    expect(stamp?.className).toContain("text-(--color-correct)");
    expect(stamp?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(stamp?.style.transform).toContain("rotate(-6deg)");
    expect(comparisonText(container)).toBe("New bestPrevious best 7 / 10");
  });

  it("lets the New best stamp land when asked", () => {
    const { container } = render(<ScoreBlock score={8} total={10} comparison={{ kind: "new-best", previousBest: 7 }} animate />);
    const stamp = container.querySelector<HTMLElement>("[data-new-best]");
    expect(stamp?.style.opacity).toBe("0");
    expect(stamp?.style.transform).toContain("scale(1.9)");
  });

  it("says Equals your best, in words and not as a stamp", () => {
    const { container } = render(<ScoreBlock score={9} total={10} comparison={{ kind: "equal", best: 9 }} />);
    expect(comparisonText(container)).toBe("Equals your bestBest 9 / 10");
    expect(container.querySelector("[data-new-best]")).toBeNull();
  });

  it("says how many short of the best, with the best under it", () => {
    const { container } = render(<ScoreBlock score={7} total={10} comparison={{ kind: "short", best: 9, by: 2 }} />);
    expect(comparisonText(container)).toBe("2 short of your bestBest 9 / 10");
  });
});
```

- [ ] **Step 2: Run the score block tests and watch them fail**

```bash
pnpm vitest run tests/components/ScoreBlock.test.tsx
```

Expected: the suite fails to load with `Error: Failed to resolve import "@/components/ScoreBlock" from "tests/components/ScoreBlock.test.tsx". Does the file exist?` and `Tests  no tests`.

- [ ] **Step 3: Create the score block**

Create `components/ScoreBlock.tsx`. It ports `.score` and `.cmp` of `result-classic.html` and `.stamp` of `result-timed.html` (the 22 px "New best on results" stamp with the 18 px star, landing like the slip stamp: scale 1.9 to 1 and -14 to -6 degrees, 420 ms spring after 380 ms). `{" "}` between the score and its unit is collapsed by the flex layout but keeps the text "7 of 10" for screen readers and tests.

```tsx
"use client";

// The score block of the result screens (design system 5.14): "Your score" over the score and its unit on
// the left; on the right the comparison with the record for this route and mode. Beating an earlier record
// is the one celebration: the New best stamp (5.11, "New best on results") lands over "Previous best".
// "Equals your best" and the other lines are plain text, not stamps.
import { motion, useReducedMotion } from "motion/react";
import { SPRING_EASE } from "./Stamp";
import { StarIcon } from "./icons";

/** How a finished round compares with the record that stood before it. */
export type Comparison =
  | { kind: "first" }
  | { kind: "new-best"; previousBest: number }
  | { kind: "equal"; best: number }
  | { kind: "short"; best: number; by: number };

/** Compares a score with the record before the round (null when this route and mode had none). */
export function compareWithBest(score: number, previousBest: number | null): Comparison {
  if (previousBest === null) return { kind: "first" };
  if (score > previousBest) return { kind: "new-best", previousBest };
  if (score === previousBest) return { kind: "equal", best: previousBest };
  return { kind: "short", best: previousBest, by: previousBest - score };
}

export interface ScoreBlockProps {
  /** Correct answers. */
  score: number;
  /** Cards in the round: the score reads "7 of 10" and the best "Best 9 / 10". */
  total: number;
  comparison: Comparison;
  /** The label over the score. Defaults to "Your score". */
  label?: string;
  /** Let the New best stamp land (scale 1.9 to 1, -14 to -6 degrees). Without it the stamp is shown at rest. */
  animate?: boolean;
}

const LABEL =
  "font-(family-name:--type-field-label-family) text-(length:--type-field-label-size) font-(--type-field-label-weight) " +
  "leading-(--type-field-label-line-height) tracking-(--type-field-label-letter-spacing) text-(--color-ink-muted)";
const SCORE =
  "m-0 mt-(--space-4) flex items-baseline gap-(--space-8) font-(family-name:--type-score-family) text-(length:--type-score-size) " +
  "font-(--type-score-weight) leading-(--type-score-line-height) tracking-(--type-score-letter-spacing) text-(--color-ink)";
const EMPHASIS =
  "block font-(family-name:--type-emphasis-family) text-(length:--type-emphasis-size) font-(--type-emphasis-weight) " +
  "leading-(--type-emphasis-line-height) tracking-(--type-emphasis-letter-spacing) text-(--color-ink)";
const BEST =
  "block font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) font-(--type-mono-data-weight) " +
  "leading-(--type-mono-data-line-height) tracking-(--type-mono-data-letter-spacing) text-(--color-ink-muted)";
// 22px is the documented "New best on results" variant of the stamp role (24); tokens.json has no role for it.
const NEW_BEST =
  "inline-flex items-center gap-(--space-8) px-(--space-14) pt-(--space-6) pb-(--space-4) rounded-(--radius-small) " +
  "border-(length:--stroke-stamp) border-double border-current text-(--color-correct) whitespace-nowrap " +
  "font-(family-name:--type-stamp-family) text-[22px] font-(--type-stamp-weight) leading-(--type-stamp-line-height) " +
  "tracking-(--type-stamp-letter-spacing)";

const REST = { opacity: 1, scale: 1, rotate: -6 };
const LANDING = { opacity: 0, scale: 1.9, rotate: -14 };

function NewBestStamp({ animate }: { animate: boolean }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.span
      data-new-best=""
      className={NEW_BEST}
      initial={animate && !reduced ? LANDING : false}
      animate={REST}
      transition={{ duration: 0.42, delay: 0.38, ease: SPRING_EASE }}
    >
      <StarIcon />
      New best
    </motion.span>
  );
}

function ComparisonLines({ comparison, total, animate }: { comparison: Comparison; total: number; animate: boolean }) {
  switch (comparison.kind) {
    case "first":
      return <b className={EMPHASIS}>First round on this route</b>;
    case "new-best":
      return (
        <>
          <NewBestStamp animate={animate} />
          <span className={`${BEST} mt-(--space-10)`}>
            Previous best {comparison.previousBest} / {total}
          </span>
        </>
      );
    case "equal":
      return (
        <>
          <b className={EMPHASIS}>Equals your best</b>
          <span className={`${BEST} mt-(--space-2)`}>
            Best {comparison.best} / {total}
          </span>
        </>
      );
    case "short":
      return (
        <>
          <b className={EMPHASIS}>{comparison.by} short of your best</b>
          <span className={`${BEST} mt-(--space-2)`}>
            Best {comparison.best} / {total}
          </span>
        </>
      );
  }
}

export function ScoreBlock({ score, total, comparison, label = "Your score", animate = false }: ScoreBlockProps) {
  return (
    <div
      data-score-block=""
      className="flex items-end justify-between gap-(--space-16) px-(--size-ticket-inset) pt-(--space-14) pb-(--space-18)"
    >
      <dl className="m-0">
        <dt className={LABEL}>{label}</dt>
        <dd data-score="" className={SCORE}>
          {score}{" "}
          <small className="text-[20px] tracking-normal whitespace-nowrap text-(--color-ink-muted)">of {total}</small>
        </dd>
      </dl>
      <p data-comparison={comparison.kind} className="m-0 flex flex-col items-end pb-(--space-2) text-right">
        <ComparisonLines comparison={comparison} total={total} animate={animate} />
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run the score block tests and watch them pass**

```bash
pnpm vitest run tests/components/ScoreBlock.test.tsx
```

Expected: `Tests  11 passed (11)`.

- [ ] **Step 5: Commit**

```bash
git add components/ScoreBlock.tsx tests/components/ScoreBlock.test.tsx
git commit -m "feat: add the score block with the comparison against the record"
```

- [ ] **Step 6: Write the failing tests for the missed cards**

Create `tests/components/MissedCards.test.tsx`. jsdom cannot press a key on a button and have it click, so the keyboard test checks what makes the button keyboard operable (a native `<button type="button">` that takes focus) and that the closed explanation's link is out of the tab order (`inert`).

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MissedCards, missedCards, type MissedCard } from "@/components/MissedCards";
import type { Answered } from "@/src/engine/round";
import { DECK } from "./play/fixtures";

afterEach(cleanup);

const MISSED: MissedCard[] = [
  {
    number: 3,
    given: true,
    answer: false,
    statement: "Amazon EC2 Auto Scaling distributes incoming application requests among running instances.",
    explanation: "Elastic Load Balancing distributes incoming requests.",
    source: { title: "Elastic Load Balancing", url: "https://docs.aws.amazon.com/elasticloadbalancing/" },
  },
  {
    number: 9,
    given: false,
    answer: true,
    statement: "Security awareness training is a shared control.",
    explanation: "Both sides train their own people.",
    source: { title: "Shared responsibility model", url: "https://aws.amazon.com/compliance/shared-responsibility-model/" },
  },
];

describe("missedCards", () => {
  it("keeps the wrong answers in order, numbered by their place in the round", () => {
    const [a, b, c] = DECK.cards;
    if (!a || !b || !c) throw new Error("the fixture deck has fewer than three cards");
    const answers: Answered[] = [
      { card: a, given: a.answer, correct: true, at: 1 },
      { card: b, given: !b.answer, correct: false, at: 2 },
      { card: c, given: !c.answer, correct: false, at: 3 },
    ];
    expect(missedCards(answers)).toEqual([
      { number: 2, given: !b.answer, answer: b.answer, statement: b.text.en.statement, explanation: b.text.en.explanation, source: b.source },
      { number: 3, given: !c.answer, answer: c.answer, statement: c.text.en.statement, explanation: c.text.en.explanation, source: c.source },
    ]);
  });
});

describe("MissedCards", () => {
  it("is a section named Missed cards with a count to review", () => {
    render(<MissedCards missed={MISSED} />);
    const section = screen.getByRole("region", { name: "Missed cards" });
    expect(within(section).getByText("2 to review")).toBeTruthy();
    expect(within(section).getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows each card's number, what the player said, the statement and the right answer", () => {
    render(<MissedCards missed={MISSED} />);
    const [first, second] = screen.getAllByRole("listitem");
    expect(first?.textContent).toContain("Card 03");
    expect(first?.textContent).toContain("You said True");
    expect(first?.textContent).toContain(MISSED[0]?.statement);
    expect(first?.textContent).toContain("Answer False");
    expect(second?.textContent).toContain("Card 09");
    expect(second?.textContent).toContain("You said False");
    expect(second?.textContent).toContain("Answer True");
  });

  it("keeps the explanation and the source closed until Why is pressed", () => {
    render(<MissedCards missed={MISSED} />);
    const why = screen.getByRole("button", { name: "Why, card 03" });
    expect(why.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("region", { name: "Why, card 03" })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("reveals the explanation and the source link in a labelled region when Why is pressed", () => {
    render(<MissedCards missed={MISSED} />);
    const why = screen.getByRole("button", { name: "Why, card 03" });
    fireEvent.click(why);
    expect(why.getAttribute("aria-expanded")).toBe("true");
    const region = screen.getByRole("region", { name: "Why, card 03" });
    expect(why.getAttribute("aria-controls")).toBe(region.id);
    expect(within(region).getByText("Elastic Load Balancing distributes incoming requests.")).toBeTruthy();
    const link = within(region).getByRole("link", { name: "Elastic Load Balancing (opens in a new tab)" });
    expect(link.getAttribute("href")).toBe("https://docs.aws.amazon.com/elasticloadbalancing/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    // Only the card that was opened.
    expect(screen.getByRole("button", { name: "Why, card 09" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("closes again on a second press", () => {
    render(<MissedCards missed={MISSED} />);
    const why = screen.getByRole("button", { name: "Why, card 03" });
    fireEvent.click(why);
    fireEvent.click(why);
    expect(why.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("is a native button, so the keyboard reaches and works it, and the closed source link is out of the tab order", () => {
    render(<MissedCards missed={MISSED} />);
    const why = screen.getByRole("button", { name: "Why, card 03" });
    expect(why.tagName).toBe("BUTTON");
    expect(why.getAttribute("type")).toBe("button");
    why.focus();
    expect(document.activeElement).toBe(why);
    const closed = document.getElementById(why.getAttribute("aria-controls") ?? "");
    expect(closed?.hasAttribute("inert")).toBe(true);
    fireEvent.click(why);
    expect(closed?.hasAttribute("inert")).toBe(false);
  });

  it("shows one calm line instead of an empty list when nothing was missed", () => {
    const { container } = render(<MissedCards missed={[]} />);
    expect(screen.getByRole("region", { name: "Missed cards" }).textContent).toBe("No missed cards");
    expect(screen.queryByRole("list")).toBeNull();
    expect(container.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("sunk");
  });
});
```

- [ ] **Step 7: Run the missed card tests and watch them fail**

```bash
pnpm vitest run tests/components/MissedCards.test.tsx
```

Expected: the suite fails to load with `Failed to resolve import "@/components/MissedCards"`.

- [ ] **Step 8: Create the missed cards list**

Create `components/MissedCards.tsx`. It ports `.lower`, `.lh`, `.list`, `.fade`, `.mc`, `.mc-head`, `.mc-q`, `.mc-foot`, `.ans`, `.why` and `.mc-exp` of `result-classic.html`, and adds the source link (the mockup's explanation has none; the spec asks for it) in the style of the answer slip's source link. The disclosure animates `grid-template-rows` from `0fr` to `1fr`: the one height animation the design system allows on the web (section 7); with reduced motion the global rule in `app/globals.css` makes it instant. While closed, the region is `aria-hidden` and `inert`, so its link cannot be reached by Tab. The button is named "Why, card NN" so that three "Why" buttons are told apart; the name starts with the visible word (WCAG 2.5.3).

```tsx
"use client";

// The missed cards of a finished round (design system 5.15), on the sunk lower part of the result ticket:
// a header row, then a scrolling list. Each card shows its number in the round, what the player said, the
// statement and the right answer (ink, not red: the word carries it), and a "Why" disclosure that reveals
// the explanation and the source. With no missed cards there is one calm line instead of an empty list.
import { useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import type { Answered } from "@/src/engine/round";
import { PassLower } from "./BoardingPass";
import { BookIcon, ChevronIcon } from "./icons";

/** One missed card, as the list shows it. */
export interface MissedCard {
  /** The card's place in the round, from 1. */
  number: number;
  /** What the player answered. */
  given: boolean;
  /** The right answer. */
  answer: boolean;
  statement: string;
  explanation: string;
  source: { title: string; url: string };
}

/** The wrong answers of a round, in order, with their card numbers. */
export function missedCards(answers: readonly Answered[]): MissedCard[] {
  return answers.flatMap((answered, i) =>
    answered.correct
      ? []
      : [
          {
            number: i + 1,
            given: answered.given,
            answer: answered.card.answer,
            statement: answered.card.text.en.statement,
            explanation: answered.card.text.en.explanation,
            source: answered.card.source,
          },
        ],
  );
}

export interface MissedCardsProps {
  missed: readonly MissedCard[];
  className?: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function word(value: boolean): string {
  return value ? "True" : "False";
}

const MONO_DATA =
  "font-(family-name:--type-mono-data-family) text-(length:--type-mono-data-size) font-(--type-mono-data-weight) " +
  "leading-(--type-mono-data-line-height) tracking-(--type-mono-data-letter-spacing) text-(--color-ink-muted)";
const MONO_STRONG =
  "font-(family-name:--type-mono-data-strong-family) text-(length:--type-mono-data-strong-size) " +
  "font-(--type-mono-data-strong-weight) leading-(--type-mono-data-strong-line-height) tracking-(--type-mono-data-strong-letter-spacing)";
const CAPTION =
  "flex justify-between font-(family-name:--type-mono-caption-family) text-(length:--type-mono-caption-size) " +
  "font-(--type-mono-caption-weight) leading-(--type-mono-caption-line-height) tracking-(--type-mono-caption-letter-spacing) text-(--color-ink-muted)";
const LIST_STATEMENT =
  "font-(family-name:--type-list-statement-family) text-(length:--type-list-statement-size) " +
  "font-(--type-list-statement-weight) leading-(--type-list-statement-line-height) tracking-(--type-list-statement-letter-spacing) text-(--color-ink)";
const STATEMENT = `m-0 mt-(--space-6) ${LIST_STATEMENT}`;
// The answer word is Sans 800 at 17 (the emphasis role is 16) and the explanation 15 / 1.45 (the body role
// is 15.5): the design system documents both sizes, tokens.json has no role for them.
const ANSWER_WORD =
  "font-(family-name:--type-emphasis-family) text-[17px] font-(--type-emphasis-weight) leading-(--type-emphasis-line-height) " +
  "tracking-(--type-emphasis-letter-spacing) text-(--color-ink)";
const EXPLANATION =
  "m-0 font-(family-name:--type-body-family) text-[15px] font-(--type-body-weight) leading-(--type-body-line-height) text-(--color-ink)";

function MissedItem({ item, listRef }: { item: MissedCard; listRef: RefObject<HTMLOListElement | null> }) {
  const reduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const itemRef = useRef<HTMLLIElement>(null);
  const buttonId = useId();
  const regionId = useId();
  const number = pad2(item.number);

  // Once the explanation has grown (380 ms, at once with reduced motion), scroll it fully into the list.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(
      () => {
        const list = listRef.current;
        const element = itemRef.current;
        if (!list || !element) return;
        const box = element.getBoundingClientRect();
        const frame = list.getBoundingClientRect();
        const over = box.bottom + 16 - frame.bottom;
        if (over > 0) list.scrollBy?.({ top: Math.min(over, box.top - frame.top), behavior: reduced ? "auto" : "smooth" });
      },
      reduced ? 0 : 380,
    );
    return () => clearTimeout(timer);
  }, [open, reduced, listRef]);

  return (
    <li
      ref={itemRef}
      data-missed-card={item.number}
      className="list-none pt-(--space-12) pb-(--space-4) not-first:border-t-(length:--stroke-rule) not-first:border-(--color-rule)"
    >
      <div className={CAPTION}>
        <span>Card {number}</span>
        <span>You said {word(item.given)}</span>
      </div>
      <p className={STATEMENT}>{item.statement}</p>
      <div className="flex min-h-(--size-touch-min) items-center justify-between gap-(--space-12)">
        <span className={`flex items-center gap-(--space-8) ${MONO_DATA}`}>
          Answer <b className={ANSWER_WORD}>{word(item.answer)}</b>
        </span>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          aria-label={`Why, card ${number}`}
          onClick={() => setOpen((value) => !value)}
          className={`-mr-(--space-8) flex min-h-(--size-touch-min) cursor-pointer items-center gap-(--space-6) rounded-(--radius-small) px-(--space-8) text-(--color-true) ${MONO_STRONG}`}
        >
          <u className="decoration-[1.5px] underline-offset-[3px]">Why</u>
          <ChevronIcon
            direction="down"
            className={`transition-transform duration-(--duration-t2) ease-(--easing-ease) ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {/* The one height animation of the web build (design system 7): the row grows from 0fr to 1fr.
          Closed, the explanation is hidden from screen readers and its link is out of the tab order. */}
      <div
        id={regionId}
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!open}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-(--duration-t3) ease-(--easing-ease) ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="mb-(--space-12) border-l-(length:--stroke-quote) border-(--color-rule) pl-(--space-12)">
            <p className={EXPLANATION}>{item.explanation}</p>
            <a
              href={item.source.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${item.source.title} (opens in a new tab)`}
              className={`flex min-h-(--size-touch-min) items-center gap-(--space-8) text-(--color-true) no-underline ${MONO_STRONG}`}
            >
              <BookIcon className="flex-none" />
              <u className="decoration-[1.5px] underline-offset-[3px]">{item.source.title}</u>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}

export function MissedCards({ missed, className }: MissedCardsProps) {
  const headingId = useId();
  const listRef = useRef<HTMLOListElement>(null);

  if (missed.length === 0) {
    return (
      <PassLower tone="sunk" className={["relative", className].filter(Boolean).join(" ")}>
        <section aria-label="Missed cards" className="px-(--size-ticket-inset) pt-(--space-16) pb-(--space-20)">
          <p data-no-missed="" className={`m-0 ${LIST_STATEMENT}`}>
            No missed cards
          </p>
        </section>
      </PassLower>
    );
  }

  return (
    <PassLower tone="sunk" className={["relative flex min-h-0 flex-col", className].filter(Boolean).join(" ")}>
      <section aria-labelledby={headingId} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-none items-baseline justify-between px-(--size-ticket-inset) pt-(--space-16) pb-(--space-4)">
          <h2 id={headingId} className={`m-0 ${MONO_DATA}`}>
            Missed cards
          </h2>
          <span className={`${MONO_STRONG} text-(--color-ink)`}>{missed.length} to review</span>
        </div>
        <ol
          ref={listRef}
          className="m-0 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-(--radius-card) px-(--size-ticket-inset) pt-0 pb-(--space-20) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {missed.map((item) => (
            <MissedItem key={item.number} item={item} listRef={listRef} />
          ))}
        </ol>
      </section>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[28px] rounded-b-(--radius-card) bg-linear-to-b from-(--color-surface-sunk-clear) to-(--color-surface-sunk)"
      />
    </PassLower>
  );
}
```

- [ ] **Step 9: Run the missed card tests and watch them pass**

```bash
pnpm vitest run tests/components/MissedCards.test.tsx
```

Expected: `Tests  8 passed (8)`.

- [ ] **Step 10: Commit**

```bash
git add components/MissedCards.tsx tests/components/MissedCards.test.tsx
git commit -m "feat: add the missed cards list with the Why disclosure"
```

- [ ] **Step 11: Write the failing tests for the result view**

Create `tests/components/play/ResultView.test.tsx`. It builds real finished rounds with the engine on the fixture deck, so the result is tested without loading anything. The strict-mode test is the proof that a round is recorded once: strict mode runs every effect twice, and a second write would show as a second `setItem` call and every card seen twice.

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { StrictMode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ResultView, recordRound } from "@/components/play/ResultView";
import type { TicketInfo } from "@/components/play/useRound";
import { poolFor } from "@/src/content/load";
import { reduce, startRound, type RoundState } from "@/src/engine/round";
import { PROGRESS_KEY, createLocalStore, type ProgressStore } from "@/src/progress/local";
import { emptyProgress, parseProgress, recordKey } from "@/src/progress/progress";
import { DECK, DECK_ID, memoryStorage, type MemoryStorage } from "./fixtures";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

const ROUTE = { deckId: DECK_ID, sectionId: "SEC" };
const KEY = recordKey(ROUTE, "classic");
const TICKET: TicketInfo = {
  deckCode: "TST",
  deckName: "AWS Test deck",
  sectionCode: "SEC",
  sectionName: "Security and compliance",
  modeLabel: "Classic",
};

/** A finished Classic round on SEC: card i is answered right when right[i] is true. */
function finishedRound(right: readonly boolean[]): RoundState {
  let state = startRound({ mode: "classic", route: ROUTE, pool: poolFor(DECK, "SEC"), history: {}, seed: 7 });
  right.forEach((ok, i) => {
    const card = state.cards[state.index];
    if (!card) throw new Error("ran out of cards");
    state = reduce(state, { type: "answer", value: ok ? card.answer : !card.answer, at: 1000 + i });
    state = reduce(state, { type: "next" });
  });
  if (state.phase !== "finished") throw new Error("the round did not finish");
  return state;
}

const SEVEN_OF_TEN = [true, true, false, true, true, false, true, true, false, true];

function storeWith(records: Record<string, number>): { storage: MemoryStorage; store: () => ProgressStore } {
  const storage = memoryStorage({ [PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), records }) });
  const store = createLocalStore(storage);
  return { storage, store: () => store };
}

function renderResult(round: RoundState, store: () => ProgressStore, handlers = { onPlayAgain: vi.fn(), onHome: vi.fn() }) {
  const view = render(<ResultView round={round} ticket={TICKET} progressStore={store} {...handlers} />);
  return { ...view, ...handlers };
}

function comparison(): string | null | undefined {
  return document.querySelector("[data-comparison]")?.textContent;
}

describe("recordRound", () => {
  it("writes the round once, however often it is called, and returns the same outcome", () => {
    const round = finishedRound(SEVEN_OF_TEN);
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    const store = createLocalStore(storage);
    const first = recordRound(round, store);
    const second = recordRound(round, store);
    expect(second).toBe(first);
    expect(setItem).toHaveBeenCalledTimes(1);
    const saved = parseProgress(storage.getItem(PROGRESS_KEY));
    expect(saved.records[KEY]).toBe(7);
    expect(Object.values(saved.cards).map((entry) => entry.seen)).toEqual(Array.from({ length: 10 }, () => 1));
  });

  it("remembers the route, the mode and the score for the start screen's Continue", () => {
    const storage = memoryStorage();
    recordRound(finishedRound(SEVEN_OF_TEN), createLocalStore(storage));
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).last).toEqual({ route: ROUTE, mode: "classic", score: 7, total: 10 });
  });
});

describe("ResultView: the ticket", () => {
  it("shows the completed flight path with every card resolved", () => {
    const { container } = renderResult(finishedRound(SEVEN_OF_TEN), storeWith({}).store);
    expect(screen.getByRole("img", { name: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." })).toBeTruthy();
    expect(container.querySelectorAll('[data-waypoint="correct"]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-waypoint="wrong"]')).toHaveLength(3);
    expect(container.querySelector("[data-plane]")).toBeNull();
  });

  it("fills the ticket head with the route, Class, Cards and Missed", () => {
    const { container } = renderResult(finishedRound(SEVEN_OF_TEN), storeWith({}).store);
    expect(container.querySelector('[data-leg="from"]')?.textContent).toBe("TSTAWS Test deck");
    expect(container.querySelector('[data-leg="to"]')?.textContent).toBe("SECSecurity and compliance");
    expect(screen.getAllByRole("term").map((term) => term.textContent).slice(0, 4)).toEqual(["Class", "Cards", "Missed", "Your score"]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent).slice(0, 4)).toEqual(["Classic", "10 / 10", "03", "7 of 10"]);
  });

  it("has a heading for the result and puts focus on it", () => {
    renderResult(finishedRound(SEVEN_OF_TEN), storeWith({}).store);
    const heading = screen.getByRole("heading", { level: 1, name: "Round complete" });
    expect(document.activeElement).toBe(heading);
  });
});

describe("ResultView: the comparison with the record", () => {
  it("says First round on this route when there was no record, and sets it", () => {
    const { storage, store } = storeWith({});
    renderResult(finishedRound(SEVEN_OF_TEN), store);
    expect(comparison()).toBe("First round on this route");
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[KEY]).toBe(7);
  });

  it("stamps New best when an earlier record is beaten, and raises the record", () => {
    const { storage, store } = storeWith({ [KEY]: 6 });
    renderResult(finishedRound(SEVEN_OF_TEN), store);
    expect(document.querySelector("[data-new-best]")?.textContent).toBe("New best");
    expect(comparison()).toBe("New bestPrevious best 6 / 10");
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[KEY]).toBe(7);
  });

  it("says Equals your best when the record is matched", () => {
    const { storage, store } = storeWith({ [KEY]: 7 });
    renderResult(finishedRound(SEVEN_OF_TEN), store);
    expect(comparison()).toBe("Equals your bestBest 7 / 10");
    expect(document.querySelector("[data-new-best]")).toBeNull();
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[KEY]).toBe(7);
  });

  it("says how many short of the best, and keeps the record", () => {
    const { storage, store } = storeWith({ [KEY]: 9 });
    renderResult(finishedRound(SEVEN_OF_TEN), store);
    expect(comparison()).toBe("2 short of your bestBest 9 / 10");
    expect(parseProgress(storage.getItem(PROGRESS_KEY)).records[KEY]).toBe(9);
  });

  it("keeps comparing with the record from before the round after it has been saved", () => {
    const { store } = storeWith({ [KEY]: 6 });
    const round = finishedRound(SEVEN_OF_TEN);
    const view = renderResult(round, store);
    view.rerender(<ResultView round={round} ticket={TICKET} progressStore={store} onPlayAgain={view.onPlayAgain} onHome={view.onHome} />);
    expect(comparison()).toBe("New bestPrevious best 6 / 10");
    cleanup();
    renderResult(round, store);
    expect(comparison()).toBe("New bestPrevious best 6 / 10");
  });
});

describe("ResultView: recording", () => {
  it("records the round exactly once under strict mode and re-renders", () => {
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    const store = createLocalStore(storage);
    const progressStore = () => store;
    const round = finishedRound(SEVEN_OF_TEN);
    const handlers = { onPlayAgain: vi.fn(), onHome: vi.fn() };
    const view = render(
      <StrictMode>
        <ResultView round={round} ticket={TICKET} progressStore={progressStore} {...handlers} />
      </StrictMode>,
    );
    view.rerender(
      <StrictMode>
        <ResultView round={round} ticket={TICKET} progressStore={progressStore} {...handlers} />
      </StrictMode>,
    );
    expect(setItem).toHaveBeenCalledTimes(1);
    const saved = parseProgress(storage.getItem(PROGRESS_KEY));
    expect(Object.values(saved.cards).every((entry) => entry.seen === 1)).toBe(true);
    expect(comparison()).toBe("First round on this route");
  });

  it("still shows the result when storage throws on every read and write", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const store = createLocalStore(broken);
    renderResult(finishedRound(SEVEN_OF_TEN), () => store);
    expect(screen.getByRole("heading", { name: "Round complete" })).toBeTruthy();
    expect(comparison()).toBe("First round on this route");
    expect(screen.getByRole("button", { name: "Play again" })).toBeTruthy();
  });
});

describe("ResultView: missed cards", () => {
  it("lists the missed cards with their numbers in the round", () => {
    const round = finishedRound(SEVEN_OF_TEN);
    renderResult(round, storeWith({}).store);
    expect(screen.getByText("3 to review")).toBeTruthy();
    const missedNumbers = screen.getAllByRole("listitem").map((item) => item.getAttribute("data-missed-card"));
    expect(missedNumbers).toEqual(["3", "6", "9"]);
    const third = round.answers[2];
    expect(screen.getByText(third?.card.text.en.statement ?? "")).toBeTruthy();
  });

  it("shows No missed cards after a perfect round", () => {
    renderResult(finishedRound(Array.from({ length: 10 }, () => true)), storeWith({}).store);
    expect(screen.getByText("No missed cards")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getAllByRole("definition")[2]?.textContent).toBe("00");
  });
});

describe("ResultView: actions", () => {
  it("offers Play again with the replay icon, and calls onPlayAgain", () => {
    const view = renderResult(finishedRound(SEVEN_OF_TEN), storeWith({}).store);
    const again = screen.getByRole("button", { name: "Play again" });
    expect(again.querySelector("svg path")?.getAttribute("d")).toBe("M3.5 9a5.5 5.5 0 1 0 1.8-4.1M3.5 2.5v3h3");
    fireEvent.click(again);
    expect(view.onPlayAgain).toHaveBeenCalledTimes(1);
    expect(view.onHome).not.toHaveBeenCalled();
  });

  it("goes home with Choose another route and with the close button", () => {
    const view = renderResult(finishedRound(SEVEN_OF_TEN), storeWith({}).store);
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    expect(view.onHome).toHaveBeenCalledTimes(2);
    expect(view.onPlayAgain).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 12: Run the result view tests and watch them fail**

```bash
pnpm vitest run tests/components/play/ResultView.test.tsx
```

Expected: the suite fails to load with `Failed to resolve import "@/components/play/ResultView"`.

- [ ] **Step 13: Create the result view**

Create `components/play/ResultView.tsx`. The header, stage and action row follow the task 9 screen skeleton; the actions are the mockup's `.actions` (pill 60, gap 4, quiet button 48). The ticket is task 11's `BoardingPass` turned into a two-row grid: the main part keeps its height (`max-content`) and the lower part takes the rest, at least `--size-lower`. `contain-size` on the lower part stops the list's length from growing the ticket, so the list scrolls inside it. The scroller around the ticket runs on under "Play again" so the ticket's shadow shows in the gap above it, as task 11 does for the game.

```tsx
"use client";

// The result of a finished Classic round (spec sections 6, 7 and 9; mockup result-classic): the completed
// flight path, the ticket with the score block and the comparison with the record for this route and
// mode, the missed cards with their explanations, and two actions: play the same route and mode again,
// or choose another route. Showing it records the round in the progress on the device, exactly once.
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { BoardingPass } from "@/components/BoardingPass";
import { FlightPath } from "@/components/FlightPath";
import { MissedCards, missedCards } from "@/components/MissedCards";
import { PillButton } from "@/components/PillButton";
import { QuietButton } from "@/components/QuietButton";
import { RoundButton } from "@/components/RoundButton";
import { ScoreBlock, compareWithBest } from "@/components/ScoreBlock";
import { SkyBackdrop } from "@/components/SkyBackdrop";
import { CloseIcon, ReplayIcon, RouteIcon } from "@/components/icons";
import { summarise, type RoundState } from "@/src/engine/round";
import { applyResult, type ApplyOutcome } from "@/src/progress/progress";
import type { ProgressStore } from "@/src/progress/local";
import type { TicketInfo } from "./useRound";

export interface ResultViewProps {
  /** The finished round (phase "finished", not abandoned). */
  round: RoundState;
  ticket: TicketInfo;
  /** The progress store on the device (useRound's progressStore). Pass a stable function. */
  progressStore: () => ProgressStore;
  /** "Play again": a new round on the same route and mode (useRound's restart). */
  onPlayAgain: () => void;
  /** "Choose another route" and the close button: back to the start. */
  onHome: () => void;
}

// Rounds already written to the progress store, with what applyResult said. A round is recorded once,
// however often its result is rendered, its effect runs (React strict mode runs it twice) or it remounts.
const recorded = new WeakMap<RoundState, ApplyOutcome>();

/**
 * Records a finished round in the store: card history, the record for its route and mode, the last route
 * played (the start screen's "Continue"). The first call for a round writes; later calls return the same
 * outcome without writing again. A store that cannot save does not throw (createLocalStore).
 */
export function recordRound(round: RoundState, store: ProgressStore): ApplyOutcome {
  const done = recorded.get(round);
  if (done) return done;
  const outcome = applyResult(store.load(), summarise(round));
  store.save(outcome.progress);
  recorded.set(round, outcome);
  return outcome;
}

/**
 * The outcome of recording the round. The render computes it from the stored progress without writing
 * (so the comparison is on screen in the first frame); the effect then writes it, once.
 */
export function useRecordedRound(round: RoundState, progressStore: () => ProgressStore): ApplyOutcome {
  const outcome = useMemo(
    () => recorded.get(round) ?? applyResult(progressStore().load(), summarise(round)),
    [round, progressStore],
  );
  useEffect(() => {
    recordRound(round, progressStore());
  }, [round, progressStore]);
  return outcome;
}

// The ticket fills the stage and its missed-card list scrolls inside, as in the mockup. On a short phone,
// where the score part and a 228 px list do not both fit, the stage scrolls instead. The scroller runs on
// under "Play again" (opaque, like the play screen's pills), so the ticket's shadow still shows in the gap
// above it; it stops above the quiet button, which has no background to hide the ticket.
const UNDER_PILL = "(var(--space-12) + var(--size-pill))";
const SCROLLER: CSSProperties = {
  bottom: `calc(-1 * ${UNDER_PILL})`,
  paddingBottom: `calc${UNDER_PILL}`,
  scrollbarWidth: "none",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function ResultView({ round, ticket, progressStore, onPlayAgain, onHome }: ResultViewProps) {
  const outcome = useRecordedRound(round, progressStore);
  const result = summarise(round);
  const comparison = compareWithBest(result.score, outcome.previousBest);
  const total = round.cards.length;
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The ticket jolts as the New best stamp lands, so the jolt starts after the first frame.
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    setLanded(true);
  }, []);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <SkyBackdrop />
      <header className="relative z-10 flex h-(--size-header) flex-none items-center gap-(--space-12)">
        <RoundButton label="Close results" onClick={onHome}>
          <CloseIcon />
        </RoundButton>
        <FlightPath variant="completed" total={total} results={round.answers.map((answer) => answer.correct)} />
      </header>
      <section aria-labelledby={headingId} className="relative mt-(--space-12) min-h-0 flex-1">
        <h1 id={headingId} ref={headingRef} tabIndex={-1} className="sr-only">
          Round complete
        </h1>
        <div className="absolute inset-x-0 top-0 overflow-y-auto overscroll-contain" style={SCROLLER}>
          <BoardingPass
            className="grid min-h-full grid-rows-[max-content_minmax(var(--size-lower),1fr)]"
            from={{ code: ticket.deckCode, name: ticket.deckName }}
            to={{ code: ticket.sectionCode, name: ticket.sectionName }}
            fields={[
              { label: "Class", value: ticket.modeLabel },
              { label: "Cards", value: `${pad2(result.total)} / ${pad2(total)}` },
              { label: "Missed", value: pad2(result.missed.length) },
            ]}
            jolt={landed && comparison.kind === "new-best"}
            lower={<MissedCards missed={missedCards(round.answers)} className="contain-size" />}
          >
            <ScoreBlock score={result.score} total={total} comparison={comparison} animate />
          </BoardingPass>
        </div>
      </section>
      <div className="relative z-10 mt-(--space-12) flex flex-none flex-col gap-(--space-4)">
        <PillButton leadingIcon={<ReplayIcon />} onClick={onPlayAgain}>
          Play again
        </PillButton>
        <QuietButton leadingIcon={<RouteIcon />} onClick={onHome}>
          Choose another route
        </QuietButton>
      </div>
    </main>
  );
}
```

- [ ] **Step 14: Run the result view tests and watch them pass**

```bash
pnpm vitest run tests/components/play/ResultView.test.tsx
```

Expected: `Tests  16 passed (16)`.

- [ ] **Step 15: Commit**

```bash
git add components/play/ResultView.tsx tests/components/play/ResultView.test.tsx
git commit -m "feat: add the result view and record each finished round once"
```

- [ ] **Step 16: Write the failing tests for the result in the play screen**

Create `tests/components/play/PlayScreenResult.test.tsx`. These play whole rounds through `PlayScreen` with task 11's test doubles: recording under strict mode, Play again (a new seed, the updated history, back at card 1, no navigation), the two ways home, storage that throws, and the review focus cases at the end.

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { StrictMode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayScreen } from "@/components/play/PlayScreen";
import { PROGRESS_KEY } from "@/src/progress/local";
import { parseProgress, recordKey } from "@/src/progress/progress";
import { DECK_ID, cardByStatement, harness, type Harness } from "./fixtures";

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

const ROUTE = { deckId: DECK_ID, sectionId: "SEC" };

function statementText(): string | null | undefined {
  return document.querySelector("[data-statement] p:last-of-type")?.textContent;
}

/** Renders the play screen and answers one card per entry of right (right or wrong), up to the result. Returns the statements in order. */
async function playRound(h: Harness, right: readonly boolean[], strict = false): Promise<string[]> {
  const screenElement = <PlayScreen services={h.services} />;
  render(strict ? <StrictMode>{screenElement}</StrictMode> : screenElement);
  return answerAll(h, right);
}

/** Answers the cards on screen, one per entry of right, then waits for the result. */
async function answerAll(h: Harness, right: readonly boolean[]): Promise<string[]> {
  const statements: string[] = [];
  for (const ok of right) {
    await screen.findByRole("button", { name: "True" });
    h.advance(1000); // past the 250 ms settle time
    const statement = statementText() ?? "";
    statements.push(statement);
    const answer = cardByStatement(statement).answer;
    fireEvent.click(screen.getByRole("button", { name: (ok ? answer : !answer) ? "True" : "False" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next card" }));
  }
  await screen.findByRole("heading", { name: "Round complete" });
  return statements;
}

const SEVEN_OF_TEN = [true, true, false, true, true, false, true, true, false, true];

describe("PlayScreen: the result of a finished round", () => {
  it("shows the result after the tenth card: score, comparison and missed cards", async () => {
    const h = harness();
    await playRound(h, SEVEN_OF_TEN);
    expect(screen.getByRole("img", { name: "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9." })).toBeTruthy();
    expect(document.querySelector("[data-score]")?.textContent).toBe("7 of 10");
    expect(document.querySelector("[data-comparison]")?.textContent).toBe("First round on this route");
    expect(screen.getByText("3 to review")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "True" })).toBeNull();
  });

  it("records the round once, even in strict mode: history, record and last route", async () => {
    const h = harness();
    const statements = await playRound(h, SEVEN_OF_TEN, true);
    // Strict mode runs every effect twice; a second recording would make each card seen twice.
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(Object.keys(progress.cards).sort()).toEqual(statements.map((s) => cardByStatement(s).id).sort());
    expect(Object.values(progress.cards).every((entry) => entry.seen === 1)).toBe(true);
    expect(progress.records[recordKey(ROUTE, "classic")]).toBe(7);
    expect(progress.last).toEqual({ route: ROUTE, mode: "classic", score: 7, total: 10 });
  });

  it("goes home with Choose another route", async () => {
    await playRound(harness(), SEVEN_OF_TEN);
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("goes home with the close button", async () => {
    await playRound(harness(), SEVEN_OF_TEN);
    fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});

describe("PlayScreen: Play again", () => {
  it("deals a new round on the same route with a new seed and the updated history, back at card 1", async () => {
    const h = harness();
    let seed = 100;
    const randomSeed = vi.fn(() => seed++);
    h.services.randomSeed = randomSeed;
    const first = await playRound(h, SEVEN_OF_TEN);
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await screen.findByRole("button", { name: "True" });
    expect(randomSeed).toHaveBeenCalledTimes(2);
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "Card 1 of 10." })).toBeTruthy();
    expect(screen.getAllByRole("definition")[1]?.textContent).toBe("01 / 10");
    expect(document.activeElement).toBe(document.querySelector("[data-statement]"));
    // The history from the first round shapes the deal: the 2 unseen SEC cards come in, and the
    // 3 missed cards come back first in line.
    const second = await answerAll(h, Array.from({ length: 10 }, () => true));
    const missed = [first[2], first[5], first[8]];
    const sec = Array.from({ length: 12 }, (_, i) => `Statement SEC ${i + 1}.`);
    const unseen = sec.filter((statement) => !first.includes(statement));
    expect(unseen).toHaveLength(2);
    for (const statement of [...missed, ...unseen]) expect(second).toContain(statement);
  });

  it("records the second round on top of the first", async () => {
    const h = harness();
    await playRound(h, SEVEN_OF_TEN);
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await answerAll(h, Array.from({ length: 10 }, () => true));
    expect(document.querySelector("[data-new-best]")?.textContent).toBe("New best");
    expect(document.querySelector("[data-comparison]")?.textContent).toBe("New bestPrevious best 7 / 10");
    expect(screen.getByText("No missed cards")).toBeTruthy();
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(progress.records[recordKey(ROUTE, "classic")]).toBe(10);
    expect(Object.values(progress.cards).reduce((sum, entry) => sum + entry.seen, 0)).toBe(20);
  });
});

describe("PlayScreen: storage that fails", () => {
  it("plays and shows the result when every storage call throws", async () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const h = harness();
    h.services.localStorage = () => throwing;
    await playRound(h, SEVEN_OF_TEN);
    expect(document.querySelector("[data-comparison]")?.textContent).toBe("First round on this route");
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await waitFor(() => expect(screen.getByRole("img", { name: "Card 1 of 10." })).toBeTruthy());
  });
});

describe("PlayScreen: review focus", () => {
  it("counts a round on a short route by its own length, not by 10", async () => {
    // The APP section of the fixture deck has one card, so Classic deals a round of one.
    const h = harness({ route: { deckId: DECK_ID, sectionId: "APP" }, mode: "classic" });
    const best = { [recordKey({ deckId: DECK_ID, sectionId: "APP" }, "classic")]: 1 };
    h.local.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, cards: {}, records: best, last: null }));
    await playRound(h, [false]);
    expect(screen.getByRole("img", { name: "Round complete. 1 of 1 cards. 0 correct, 1 wrong: card 1." })).toBeTruthy();
    expect(screen.getAllByRole("definition").map((value) => value.textContent).slice(0, 4)).toEqual(["Classic", "01 / 01", "01", "0 of 1"]);
    expect(document.querySelector("[data-comparison]")?.textContent).toBe("1 short of your bestBest 1 / 1");
  });

  it("plays again from the copies on the device when the network has gone since the round began", async () => {
    const h = harness();
    await playRound(h, SEVEN_OF_TEN);
    h.network.online = false;
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    await screen.findByRole("button", { name: "True" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("img", { name: "Card 1 of 10." })).toBeTruthy();
  });

  it("compares with the stored record when storage is full and cannot save, and plays again", async () => {
    const h = harness();
    h.local.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, cards: {}, records: { [recordKey(ROUTE, "classic")]: 9 }, last: null }));
    const full = {
      getItem: (key: string) => h.local.getItem(key),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    h.services.localStorage = () => full;
    await playRound(h, SEVEN_OF_TEN);
    expect(document.querySelector("[data-comparison]")?.textContent).toBe("2 short of your bestBest 9 / 10");
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).last).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(await screen.findByRole("button", { name: "True" })).toBeTruthy();
  });
});
```

Then, in `tests/components/play/PlayScreen.test.tsx`, replace the test "finishes the round after the tenth card" (it expected only the placeholder's heading) with:

```tsx
  it("finishes the round after the tenth card and shows its result", async () => {
    await start();
    for (let i = 0; i < 9; i++) await answerAndNext(true);
    expect(screen.getByRole("img", { name: /^Card 10 of 10\./ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next card" }));
    expect(await screen.findByRole("heading", { name: "Round complete" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /^Round complete\. 10 of 10 cards\./ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Leave round" })).toBeNull();
  });
```

- [ ] **Step 17: Run the play screen tests and watch them fail**

```bash
pnpm vitest run tests/components/play/PlayScreenResult.test.tsx tests/components/play/PlayScreen.test.tsx
```

Expected: `Tests  11 failed | 28 passed (39)` (39 with the three back-gesture tests of task 11, step 34a). Every new test and the replaced one fail because the placeholder is still rendered, with messages such as `Unable to find an accessible element with the role "img" and name "Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9."` and `Unable to find an accessible element with the role "button" and name "Play again"`.

- [ ] **Step 18: Show the result in the play screen**

Make five edits in `components/play/PlayScreen.tsx`.

1. The header comment, lines 3 to 6, becomes:

```tsx
// The /play screen (spec sections 6, 8, 9 and 10): loads the pending round, shows the boarding pass with
// the statement and the stub, takes answers from the swipe, the buttons and the keyboard through one
// function, reveals the answer slip, and leaves with one confirmation. A finished round shows its result
// (ResultView), which records it and offers Play again and another route.
```

2. Under `import { LeaveDialog } from "./LeaveDialog";` add:

```tsx
import { ResultView } from "./ResultView";
```

3. In `PlayScreen`, take `restart` from the round hook:

```tsx
  const { status, dispatch, retry, restart, progressStore } = useRound(services, goHome);
```

4. Replace the three lines from `// BEGIN finished-round placeholder (task 12 replaces this block)` to `// END finished-round placeholder` with:

```tsx
  if (round.phase === "finished") {
    return <ResultView round={round} ticket={ticket} progressStore={progressStore} onPlayAgain={restart} onHome={goHome} />;
  }
```

5. Delete everything from `// BEGIN FinishedPlaceholder (task 12 deletes this component)` to `// END FinishedPlaceholder`, both lines included, and the blank line after it. `SkyBackdrop` and `summarise` stay imported: `Loading`, `LoadFailed`, `RoundView` and `leave` still use them.

The part of `PlayScreen` after the hooks now reads:

```tsx
  if (status.kind === "error") return <LoadFailed onRetry={retry} onLeave={goHome} />;
  if (status.kind !== "ready" || status.round.abandoned) return <Loading onLeave={goHome} />;

  const { round, ticket } = status;
  if (round.phase === "finished") {
    return <ResultView round={round} ticket={ticket} progressStore={progressStore} onPlayAgain={restart} onHome={goHome} />;
  }

  return <RoundView round={round} ticket={ticket} now={services.now} dispatch={dispatch} onLeave={() => leave(round)} />;
}

function Header({ onLeave, closeRef, children }: { onLeave: () => void; closeRef?: Ref<HTMLButtonElement>; children?: ReactNode }) {
```

- [ ] **Step 19: Run the play screen tests and watch them pass**

```bash
pnpm vitest run tests/components/play/PlayScreenResult.test.tsx tests/components/play/PlayScreen.test.tsx
```

Expected: `Tests  39 passed (39)` (with the three back-gesture tests of task 11, step 34a).

Then every component test (the token guard `tests/components/no-raw-colours.test.ts` checks the new files) and the type check:

```bash
pnpm vitest run tests/components
pnpm typecheck
```

Expected, in plan order (task 10 done): `Test Files  24 passed (24)` and `Tests  320 passed (320)` (task 9's 8 files with 101 tests, task 10's 5 with 71, task 11's 7 with 103 and this task's 4 with 45). Without task 10 the numbers are `19` and `249`. `tsc --noEmit` prints nothing.

- [ ] **Step 19a: Write the test for a deck update between rounds**

A new build can go live while a player looks at the result: a card corrected out of the deck, a new hash. "Play again" must then deal from the new version (spec section 5: a deck is fetched again when its hash in the index differs), never deal the dropped card, and forget that card's history (spec section 7: history is kept by card id, entries for cards that no longer exist are removed), while the record of the route survives. In `tests/components/play/PlayScreenResult.test.tsx`, replace the fixtures import line with:

```tsx
import { DECK, DECK_ID, INDEX, cardByStatement, fakeNetwork, harness, type Harness } from "./fixtures";
```

Then append to the end of the file:

```tsx
describe("PlayScreen: a deck update between rounds", () => {
  it("plays again from the new version of the deck, without the card it dropped, and forgets that card", async () => {
    const files: Record<string, unknown> = { "/decks/index.json": INDEX, [`/decks/${DECK_ID}.json`]: DECK };
    const network = fakeNetwork(files);
    const h = harness();
    h.services.fetcher = network.fetcher;
    const first = await playRound(h, SEVEN_OF_TEN);

    // While the result is on screen a new build is deployed: it drops a card the player has just answered.
    const dropped = cardByStatement(first[0]);
    const cards = DECK.cards.filter((card) => card.id !== dropped.id);
    const index = structuredClone(INDEX);
    const entry = index.areas[0]?.platforms[0]?.decks[0];
    if (!entry) throw new Error("the fixture index has no deck");
    entry.hash = "hash-2";
    entry.cardCount = cards.length;
    entry.sections = entry.sections.map((section) => (section.id === "SEC" ? { ...section, cardCount: 11 } : section));
    files["/decks/index.json"] = index;
    files[`/decks/${DECK_ID}.json`] = { ...DECK, hash: "hash-2", cards };

    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    const second = await answerAll(h, Array.from({ length: 10 }, () => true));

    expect(network.calls).toContain(`/decks/${DECK_ID}.json?v=hash-2`);
    expect(JSON.parse(h.local.getItem(`truthy.deck.${DECK_ID}`) ?? "null")?.hash).toBe("hash-2");
    expect(second).not.toContain(dropped.text.en.statement);
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(progress.cards[dropped.id]).toBeUndefined();
    // Every SEC card that is left has been seen once or twice; the record of the route survives the update.
    expect(Object.keys(progress.cards).sort()).toEqual(cards.filter((card) => card.section === "SEC").map((card) => card.id).sort());
    expect(progress.records[recordKey(ROUTE, "classic")]).toBe(10);
  });
});
```

- [ ] **Step 19b: Run it**

```bash
pnpm vitest run tests/components/play/PlayScreenResult.test.tsx
pnpm typecheck
```

Expected: `Tests  11 passed (11)`; `tsc --noEmit` prints nothing. It passes at once: `restart` loads the index again (always fetched), sees the new hash, refetches and prunes. It pins that chain, which no other test runs end to end. Verified in the spike.

- [ ] **Step 20: Commit**

```bash
git add components/play/PlayScreen.tsx tests/components/play/PlayScreen.test.tsx tests/components/play/PlayScreenResult.test.tsx
git commit -m "feat: show the result after a finished round with play again"
```

- [ ] **Step 21: Compare with the mockup**

Create `task12-shoot.mjs` in the repository root (temporary, never committed). It plays like the mockup (cards 3, 6 and 9 wrong, 7 of 10) on a fixed seed with a stored best of 9, and photographs the result closed and with the first "Why" open; then a run with a stored best of 6 (New best), a perfect round (no missed cards) and the result on a 375 by 667 phone. Reduced motion makes every picture an end state.

```js
// TEMPORARY: screenshots of the Classic result at 390 by 844 (scale 2, like the mockup shots), never committed.
// Plays a round like the mockup (cards 3, 6 and 9 wrong, 7 of 10) with a stored best of 9, then shoots the
// result closed, with the first Why open, and in further runs the New best stamp (stored best 6), a perfect
// round (no missed cards) and the result on a 375 by 667 phone.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.env.BASE ?? "http://localhost:3100";
const deck = JSON.parse(readFileSync("public/decks/aws-clf-c02.json", "utf8"));
const answerOf = (statement) => deck.cards.find((card) => card.text.en.statement === statement).answer;
const route = { deckId: "aws-clf-c02", sectionId: "SEC" };
const pending = JSON.stringify({ route, mode: "classic" });
const progress = (best) =>
  JSON.stringify({ version: 1, cards: {}, records: { "aws-clf-c02/SEC#classic": best }, last: null });

const browser = await chromium.launch({ channel: "chromium" });

async function play(best, shots, wrong = [2, 5, 8], viewport = { width: 390, height: 844 }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, reducedMotion: "reduce" });
  // The same deal every time: a fixed seed.
  await page.addInitScript(() => {
    crypto.getRandomValues = (array) => {
      array.fill(7);
      return array;
    };
  });
  await page.goto(`${base}/`);
  await page.evaluate(
    ([p, s]) => {
      sessionStorage.setItem("truthy.pending.v1", p);
      localStorage.setItem("truthy.progress.v1", s);
    },
    [pending, progress(best)],
  );
  await page.goto(`${base}/play`);
  await page.evaluate(() => document.fonts.ready);
  const statement = page.locator("[data-statement] p").last();
  for (let i = 0; i < 10; i++) {
    await page.getByRole("button", { name: "True" }).waitFor();
    await page.waitForTimeout(300); // the 250 ms settle time
    const truth = answerOf(await statement.textContent());
    const right = !wrong.includes(i);
    await page.keyboard.press(truth === right ? "ArrowRight" : "ArrowLeft");
    await page.getByRole("button", { name: "Next card" }).click();
  }
  await page.getByRole("button", { name: "Play again" }).waitFor();
  await page.waitForTimeout(300);
  await page.mouse.click(1, 1); // drop the programmatic focus so no ring shows in the picture
  for (const [name, action] of shots) {
    if (action) await action(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/task12-${name}.png` });
    console.log(`wrote test-results/task12-${name}.png`);
  }
  await page.close();
}

await play(9, [
  ["result", null],
  ["why", (page) => page.getByRole("button", { name: /^Why, card/ }).first().click()],
]);
await play(6, [["new-best", null]]);
await play(9, [["perfect", null]], []);
await play(9, [["short-phone", null]], [2, 5, 8], { width: 375, height: 667 });
await browser.close();
```

Build, serve, photograph, stop the server:

```bash
pnpm build
pnpm start --port 3100 &
sleep 3
node task12-shoot.mjs
kill %1
```

Expected: `wrote test-results/task12-result.png`, `...-why.png`, `...-new-best.png`, `...-perfect.png`, `...-short-phone.png` (780 by 1688 pixels like the mockup shots; the short phone 750 by 1334).

Open each pair side by side (the dealt cards differ from the mockup's, so compare places, sizes and type, not words):

| Ours | Mockup | Must match |
|---|---|---|
| `test-results/task12-result.png` | `design/flow/shots/result-classic-1.png` | Sky bands and both clouds as on the game screen. Round button at x 32 to 128, y 112 to 208 with the X. Completed flight path: the solid curve from x 186 to 714 with ten marks, ink circles with ticks and red squares with an x on waypoints 3, 6 and 9, no plane; label row "**Arrived** · 10 of 10" left and "7 correct · 3 wrong" right. Ticket from y 240: amber carrier 88 tall; legs CLF and SEC in Mono 34; field grid with "Class / Classic", "Cards / 10 / 10", "Missed / 03" and rules above, below and between. Score block: "Your score" (Mono 10.5, grey) at y about 661, the "7" in Mono 600 48 (96 shot px tall) with "of 10" in grey 20 on its baseline, left edge x 72; on the right "2 short of your best" in Sans 800 16 at y about 718 and "Best 9 / 10" grey Mono 12 at y about 757, right-aligned at x 708. Perforation at y about 812 between two notches. Lower part on the sunk paper: "Missed cards" grey and "3 to review" ink Mono 600 13 at y about 862; then items with "Card 03" and "You said ..." (Mono 11, grey), the statement in Sans 600 16, "Answer" grey Mono 12 then the word in Sans 800 17 ink, the blue underlined "Why" with the chevron at the right edge, a rule between items, and the 28 px fade at the bottom. Ticket bottom at y about 1372 with its shadow showing above the pill. "Play again" ink pill with the replay icon at y 1396 to 1516; "Choose another route" with the route icon at y about 1545 to 1593. |
| `test-results/task12-why.png` | `design/flow/shots/result-classic-2.png` | The first "Why" has its chevron turned up; under its foot the explanation in Sans 600 15 / 1.45 ink, indented 12 px behind a 2 px grey rule (text starting at x 100), then the source link (blue, underlined, book icon, "→", 48 tall; the mockup has no link here, see below). The rest of the screen does not move. |
| `test-results/task12-new-best.png` | `design/flow/shots/result-timed-1.png` | In the place of the comparison: the green double-bordered stamp with the filled star and "New best" in Sans 800 22, tilted -6 degrees, right edge at about x 708, top at about y 636; "Previous best 6 / 10" in grey Mono 12 under it, 10 px below the stamp (at y about 770). |
| `test-results/task12-perfect.png` | (no mockup) | "Missed / 00", ink ticks on all ten waypoints, "10 correct · 0 wrong", the New best stamp over "Previous best 9 / 10", and one calm line "No missed cards" in Sans 600 16 at the top of the sunk lower part, which still reaches down to y about 1372. |
| `test-results/task12-short-phone.png` | (no mockup) | At 375 by 667 the main part of the ticket keeps its full height; the lower part runs on under "Play again" (the stage scrolls to show the rest), and nothing of the ticket shows behind "Choose another route". |

Also check by hand at `http://localhost:3100/play` before stopping the server (open `/` first and run `sessionStorage.setItem("truthy.pending.v1", JSON.stringify({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" }))` in the console, then play ten cards): with motion allowed a New best stamp drops in and the ticket jolts 2 px; "Why" grows open over 360 ms and the chevron turns; Tab goes from "Close results" through each "Why" (and, when open, its source link) to "Play again" and "Choose another route" with the ink ring; "Play again" starts card 1 of a new round at once; in a 375 by 667 window the stage scrolls and the list still scrolls inside the ticket.

Measured in the spike (DOM boxes at 390 by 844, mockup versus ours, in CSS px): main part of the ticket 288 / 288.7, lower part 278 / 277.3, score block 97 / 97.3, the score 48 / 48 at y 342 / 342.7, comparison line at y 350 / 351.2, best line at y 372 / 373.5, list header 36 / 36.5, Why button 58 by 48 / 58 by 48, actions 112 at y 698 / same. Pixel differences against `result-classic-1.png` (share of pixels off by more than 24 in a channel): header 1.3 percent, carrier band 2.3 percent, score area 2.4 percent, list header 5.7 percent (text 1 px lower), actions 0.6 percent, the shadow under the ticket 0.6 percent. What still differs, and why:
- Type roles fix line heights at 1.27 where the mockup leaves `normal`, so lines sit up to 1.5 px lower (the list header, the comparison). Accepted, as tasks 9 and 11 did.
- "AWS Cloud Practitioner" fits one line at 390 (the mockup forces a `<br>`), and the label row sits 1.5 px higher: both come from task 11's ticket and flight path.
- The source link in the open explanation is not in the mockup (the spec asks for it).
- When an explanation is longer than the list's visible part, opening it does not scroll its source link into view: the mockup's rule scrolls at most until the item's top reaches the top of the list, and the first item already is there. The player scrolls the list.

Delete the temporary file and confirm the gates:

```bash
rm task12-shoot.mjs
pnpm test
pnpm typecheck
pnpm build
git status --short
```

Expected: all tests pass, `tsc --noEmit` prints nothing, the build lists `/`, `/_not-found` and `/play` as static, and `git status --short` prints nothing.

#### Notes for later tasks (verified in the spike)

- **End-to-end (task 13).** After the tenth "Next card" the result appears with the heading "Round complete" (visually hidden, focused). "Play again" deals a new round on the same route at once; "Choose another route" and "Close results" go to `/` with `router.replace`. The record and `last` are in `localStorage["truthy.progress.v1"]` right after the result appears, so a "Continue" spec can play one round, go home and find the line.
- **The other modes (step 2).** `ScoreBlock` takes `label` ("Correct", "Correct in a row"); its unit and best line are Classic's ("of N", "Best X / N") and will need a prop for Streak and Three lives. `FlightPath`'s completed variant is Classic's.

#### Review focus candidates

Conditions the spec implies, that a person could hit, and that the first draft of the tests did not cover. Each now has a test:

1. A section with fewer than ten cards deals a shorter Classic round (spec section 6: Classic deals `min(10, pool)`; section 10: never fail to deal). Every count on the result must follow the round's own length, not 10: the flight path, "Cards 01 / 01", "0 of 1" and "Best 1 / 1". Covered by "counts a round on a short route by its own length, not by 10" in `tests/components/play/PlayScreenResult.test.tsx`, steps 16 to 19.
2. The player finishes a round, loses the network on the train, and presses "Play again": the round must come from the copies on the device rather than show "This deck didn't load" (spec sections 5 and 10). Covered by "plays again from the copies on the device when the network has gone since the round began" in `tests/components/play/PlayScreenResult.test.tsx`, steps 16 to 19.
3. Storage that can be read but is full (spec sections 7 and 10: "Storage unavailable, full or corrupt: play continues"): the comparison still uses the stored record, nothing is thrown when the save fails, and "Play again" works. Covered by "compares with the stored record when storage is full and cannot save, and plays again" in `tests/components/play/PlayScreenResult.test.tsx`, steps 16 to 19 (storage that throws on every call is covered by "plays and shows the result when every storage call throws" in the same file and "still shows the result when storage throws on every read and write" in `tests/components/play/ResultView.test.tsx`).
