### Task 9: The Three lives header

A Three lives round shows its lives and its trail in the header (design system 5.10, "Lives" and "Lives, last life lost"; mockups `game-lives.html`, `game-lives-out.html`): three hearts on the left, then a straight mini path with one small mark per answered card and the plane on the card on screen, with "**2** of 3 lives left" and "**14** answered" under it. A life is lost by shape as well as colour: a filled heart becomes an outlined heart with a slash. The card, the slip, "Next card" and "See results" are already right (task 7).

**Files:**
- Create: `components/LivesPath.tsx`
- Modify: `components/play/PlayScreen.tsx`
- Test: create `tests/components/LivesPath.test.tsx`; modify `tests/components/play/PlayScreenEnding.test.tsx`

**Interfaces:**
- Consumes:
  - Task 8, `components/FlightPath.tsx`: `PathFrame`, `Plane`, `Mark`, `Num`, `cardList`, `type Point`.
  - Task 5: `LIVES = 3`. Task 3: `EASE`.
  - `components/icons.tsx`: `ICON_PATHS.heart` (drawn around x 0, from y 3.2 to 19.7), `ICON_PATHS.heartSlash` (`M-8 18L8 3`).
  - `motion/react`: `motion.path` with `pathLength`, `useReducedMotion`.
- Produces:

```ts
// components/LivesPath.tsx
export interface TrailLayout {
  x: (i: number) => number;  // x of mark i (0 is the oldest)
  r: number;                 // radius of a correct dot
  side: number;              // side of a wrong square
  cross: boolean;            // wrong squares carry their x (side >= 6)
}
export function trailLayout(marks: number): TrailLayout;
export function livesLabel(results: readonly boolean[]): string;
export interface LivesPathProps {
  results: readonly boolean[];   // whether each answer of the round was correct, in order
  answered: boolean;             // the card on screen has been answered (it is the last of results)
  className?: string;
}
export function LivesPath(props: LivesPathProps): ReactNode;
```

**Rules:**

1. **Hearts.** Lives left = `max(0, 3 - wrong answers)`. Three hearts in the header's SVG at `translate(11 6)`, `translate(39 6)` and `translate(67 6)`. Heart `j` (0 is the left one) is full when `j < lives left`, so **lives are lost from the right** and the last life is the left heart. Full: `ICON_PATHS.heart` filled `ink` (`data-heart="full"`). Lost: the same path with no fill and an `ink-muted` stroke of 1.6 (round joins), plus `ICON_PATHS.heartSlash` in `ink-muted`, stroke 1.6, round caps (`data-heart="lost"`).
2. **The strike.** The heart lost by the answer on screen (`answered` and the last result is wrong: heart index = lives left) draws its slash as the Not quite stamp lands: a `motion.path` from `pathLength: 0` to `1`, 300 ms, delay 380 ms, `EASE`. The outline appears at once. Hearts lost earlier, and every heart under reduced motion, are drawn at rest: a plain `path` with no animation. The slash says which it is, `data-strike="draw"` on the animated one and `data-strike="rest"` on a plain one, so a test can tell them apart (with animations skipped both look the same in the DOM otherwise). This applies to every lost life, the last included.
3. **The trail** runs on the line y 17. The plane sits at (238, 17), heading 0. The marks are the cards before the card on screen: `marks = answered ? results.slice(0, -1) : results`, and `trailLayout(marks.length)` places them:

```ts
const round1 = (value: number) => Math.round(value * 10) / 10;

export function trailLayout(marks: number): TrailLayout {
  // Up to 14 marks: 9 apart, the newest at x 219 next to the plane (14 marks start at x 102).
  if (marks <= 14) return { x: (i) => 219 - 9 * (marks - 1 - i), r: 2.6, side: 9, cross: true };
  // More: squeezed between x 100 and x 219.
  const step = 119 / (marks - 1);
  const side = Math.min(8, round1(step * 1.3));
  return { x: (i) => round1(100 + i * step), r: Math.min(2.2, round1(step * 0.45)), side, cross: side >= 6 };
}
```

   A correct card is an `ink` circle of radius `r` (`data-trail="correct"`); a wrong card is a square of `side` (rx 1.5) in `wrong` centred on the line, with a `surface-raised` x (stroke 1.4 up to 14 marks, 1.3 beyond) when `cross` (`data-trail="wrong"`). Under them: a solid `ink` line (stroke 1.2) from the first mark to x 238 when there is at least one mark, and the dotted continuation `M238 17H274` (stroke 1.6, dash "2 5", round caps) always.
4. **The card on screen:** the `Plane` at (238, 17) while it is a question; once answered the plane is `hidden` and a full-size `Mark` (`fresh`) of the verdict sits at (238, 17).
5. **Label row:** left "**{lives}** of 3 lives left", or "**No** lives left" at zero. Right "**{results.length}** answered". Numbers and "No" in `Num`.
6. **Accessible name,** `livesLabel(results)` with `n = results.length` and the 1-based numbers of the wrong cards through `cardList`:

| Case | Text |
|---|---|
| lives left, nothing answered | `3 of 3 lives left. No cards answered yet.` |
| lives left, no wrong card | `3 of 3 lives left. 5 cards answered.` (`1 card answered.`) |
| lives left, one wrong card | `2 of 3 lives left. 14 cards answered, card 6 was wrong.` |
| lives left, two wrong cards | `1 of 3 lives left. 20 cards answered, cards 6 and 15 were wrong.` |
| no lives left | `No lives left. The round is over after 21 cards: cards 6, 15 and 21 were wrong.` |

7. `RoundView` renders `<LivesPath results={round.answers.map((a) => a.correct)} answered={round.phase === "answered"} />` in a Three lives round.

**Tests:**

`tests/components/LivesPath.test.tsx`, new (jsdom):

```tsx
describe("trailLayout", () => {
  it("keeps 9 px between marks and the newest at x 219, up to 14 marks", () => {
    const layout = trailLayout(14);
    expect([layout.x(0), layout.x(1), layout.x(13)]).toEqual([102, 111, 219]);
    expect(layout).toMatchObject({ r: 2.6, side: 9, cross: true });
    expect(trailLayout(1).x(0)).toBe(219);
    expect(trailLayout(3).x(0)).toBe(201);
  });

  it("squeezes more marks between x 100 and x 219", () => {
    const layout = trailLayout(20);
    expect([layout.x(0), layout.x(1), layout.x(19)]).toEqual([100, 106.3, 219]);
    expect(layout).toMatchObject({ r: 2.2, side: 8, cross: true });
  });

  it("drops the x of a wrong mark when a long round leaves no room for it", () => {
    expect(trailLayout(60)).toMatchObject({ r: 0.9, side: 2.6, cross: false });
  });
});

describe("livesLabel", () => {
  const round = (wrongAt: number[], n: number) => Array.from({ length: n }, (_, i) => !wrongAt.includes(i + 1));
  it.each([
    [[], 0, "3 of 3 lives left. No cards answered yet."],
    [[], 1, "3 of 3 lives left. 1 card answered."],
    [[], 5, "3 of 3 lives left. 5 cards answered."],
    [[6], 14, "2 of 3 lives left. 14 cards answered, card 6 was wrong."],
    [[6, 15], 20, "1 of 3 lives left. 20 cards answered, cards 6 and 15 were wrong."],
    [[6, 15, 21], 21, "No lives left. The round is over after 21 cards: cards 6, 15 and 21 were wrong."],
  ])("wrong on %j of %i", (wrongAt, n, text) => {
    expect(livesLabel(round(wrongAt, n))).toBe(text);
  });
});
```

and, rendered:
- "shows three full hearts, the plane and no trail on the first card": `results={[]}`: three `[data-heart="full"]`, no `[data-heart="lost"]`, no `[data-trail]`, `[data-plane]` shown, progress "3 of 3 lives left", tally "0 answered".
- "loses the hearts from the right": one wrong answer: the hearts in document order are full, full, lost; two wrong: full, lost, lost.
- "tells a lost life by shape: an outline and a slash" (the lost heart has two paths, the first with `fill="none"`).
- "marks every answered card on the trail and tells wrong from right by shape": 14 results with card 6 wrong, question: 13 `[data-trail="correct"]` circles, one `[data-trail="wrong"]` with a `rect`; tally "14 answered".
- "after an answer shows its mark where the plane was and counts it": 15 results, `answered`: 14 trail marks, the plane has `opacity-0`, one `[data-waypoint]`, tally "15 answered".
- "reads No lives left after the third wrong answer": progress "No lives left", three lost hearts, name as in the table.
- "draws the slash of the life just lost and leaves the earlier ones at rest": results wrong, right, wrong with `answered`: the hearts are full, lost, lost; the middle heart (lost by the answer on screen) has `[data-strike="draw"]`, the right one `[data-strike="rest"]`. With `answered={false}` (the next card is on screen) both are `rest`.
- "with reduced motion every slash is at rest": the file mocks the hook (`const motionPreference = vi.hoisted(() => ({ reduced: false }));` and `vi.mock("motion/react", async (original) => ({ ...(await original<typeof import("motion/react")>()), useReducedMotion: () => motionPreference.reduced }))`, reset to false in `afterEach`); with `motionPreference.reduced = true` the same props as the case above give no `[data-strike="draw"]` and two `[data-strike="rest"]`, each a `path` with the slash's `d`.

`tests/components/play/PlayScreenEnding.test.tsx`, added (Three lives):
- "shows the Three lives header from the first card": name "3 of 3 lives left. No cards answered yet."; no image named `/^Card 1 of/`.
- "takes a life per wrong answer and ends on the third": wrong, go, right, go, wrong, go, wrong: names after each answer "2 of 3 lives left. 1 card answered, card 1 was wrong.", "2 of 3 lives left. 2 cards answered, card 1 was wrong.", "1 of 3 lives left. 3 cards answered, cards 1 and 3 were wrong.", "No lives left. The round is over after 4 cards: cards 1, 3 and 4 were wrong."; then "See results".

**Steps:**

- [ ] **Step 1: Write `tests/components/LivesPath.test.tsx`.** Run it: `Cannot find package '@/components/LivesPath'`.
- [ ] **Step 2: Write `components/LivesPath.tsx`** (rules 1 to 6). Run the file green.
- [ ] **Step 3: Write the two PlayScreen cases.** Run `pnpm vitest run tests/components/play/PlayScreenEnding.test.tsx`: they fail (the header is named "Card 1 of 10.").
- [ ] **Step 4: Use `LivesPath` in `RoundView`** (rule 7). Run `pnpm vitest run tests/components`: green.
- [ ] **Step 5: Look at it.** `pnpm dev`; set the pending round to `mode: "lives"` as in task 8, step 6, and open `/play`. Compare with `game-lives.html` and, after two wrong answers and a third, with `game-lives-out.html`, at 390 by 844 in both themes; with "Reduce motion" on, the slash is there at once, without being drawn. Stop the dev server.
- [ ] **Step 6: Run the gates.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` (port 3100 free). All green.
- [ ] **Step 7: Commit.**

```bash
git add components/LivesPath.tsx components/play/PlayScreen.tsx tests/components
git commit -m "feat: the Three lives header: hearts lost from the right and the trail of answered cards"
```
