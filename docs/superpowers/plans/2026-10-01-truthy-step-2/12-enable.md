### Task 12: The three classes can be chosen

Until now the class step showed Streak, Three lives and Timed as "Not available yet". Their play screens (tasks 7 to 10) and result screens (task 11) are complete, so this task opens the gate: the three rows of the mode table become `offered`, which makes the class cards buttons with their best, lets "Start round" hand the mode to `/play`, and lets the continue line lead back into a round of any mode. The one piece of copy that was Classic-shaped, the last score on the continue line ("last 7 of 10"), gets a form per mode (design system 5.4a shows only Classic; decision 36 of the README).

**Files:**
- Modify: `src/app-state/modes.ts`, `components/start/ContinueLine.tsx`, `components/start/StartFlow.tsx` (the props it passes to `ContinueLine`)
- Test: modify `tests/app-state/modes.test.ts`, `tests/components/start/ContinueLine.test.tsx`, `tests/components/start/StartFlow.test.tsx`, `tests/components/start/useCatalog.test.tsx`; create `tests/components/start/unoffered.test.tsx`

**Interfaces:**
- Consumes:
  - Task 3, `src/app-state/modes.ts`: `MODE_TABLE`, `modeInfo(mode)`, `isOffered(mode)`, `interface ModeInfo { id; name; description; unit; offered }`.
  - `components/start/StartFlow.tsx`: the class step (`MODE_TABLE.map`, `available = mode.offered`, the stub `{ label: "Best", value, unit: mode.unit }`, the labels `"{name}. {description} Not played yet."` and `"{name}. {description} Your best: {best} {unit}."`), the ready line `{description} Swipe right for true, left for false.`, `savePending({ route, mode })`.
  - `components/start/useCatalog.ts`: `continueTarget(index, progress): { route; mode; found; lastScore: { score; total } | null } | null`.
  - `components/start/ContinueLine.tsx`: `ContinueLineProps { deckCode; deckTitle; sectionCode; sectionTitle; modeLabel; lastScore?: { score: number; total: number }; onContinue; ref? }`, `continueLabel(...)`.
- Produces:

```ts
// src/app-state/modes.ts
/** The score of a finished round as the continue line says it: "7 of 10", "13 in a row", "21 cards", "14 correct". */
export function lastScoreText(mode: Mode, score: number, total: number): string;

// components/start/ContinueLine.tsx
export interface ContinueLineProps { /* as today */ lastScore?: string }   // already worded, for example "13 in a row"
```

  - Accessible names the e2e specs of task 13 use: class cards "Streak. Keep going until the first wrong answer. Not played yet." / "… Your best: 12 in a row."; "Three lives. The round ends on the third wrong answer. …" with the unit "cards"; "Timed. 60 seconds, as many cards as you can. …" with the unit "correct"; the continue line "Continue: {deck title}, {section title}, {class}. Last score {text}."

**Rules:**

1. `MODE_TABLE`: `offered: true` in all four rows. The field and `isOffered` stay: a class that is not built yet is shown as not available (spec section 9), and the next class will need the gate again.
2. `lastScoreText(mode, score, total)`: Classic `{score} of {total}`; every other mode `{score} {modeInfo(mode).unit}`: "13 in a row", "21 cards", "14 correct".
3. `ContinueLine`: the visible line ends "· last **{lastScore}**" (the `em` holds the text) and the accessible name ends " Last score {lastScore}." when `lastScore` is given; nothing when it is not (a round that was left). `StartFlow` passes `lastScore={returning.lastScore ? lastScoreText(returning.mode, returning.lastScore.score, returning.lastScore.total) : undefined}`.
4. Nothing else in the start flow changes: the class cards, `resolve`, the ready pass (Class field: the mode's name; Cards: the route's card count) and the ready line read the table and the progress already. Choosing a class and pressing "Start round" stores `{ route, mode }`; `/play` deals that mode.
5. The first card of each class shows that class's own header (Streak "Streak **0**", three full hearts, "**1:00** left"), because `/play` draws the header of the round's mode. The start flow's hand-over needs no change.

**Tests:**

`tests/app-state/modes.test.ts`: "offers only Classic until the other classes are built" becomes "offers all four classes" (`MODE_TABLE.every((m) => m.offered)`, `isOffered("timed")` true). Add "words the last score the way each class counts": `lastScoreText("classic", 7, 10)` "7 of 10", `("streak", 13, 14)` "13 in a row", `("streak", 1, 2)` "1 in a row", `("lives", 21, 21)` "21 cards", `("timed", 14, 17)` "14 correct", `("timed", 0, 0)` "0 correct".

`tests/components/start/ContinueLine.test.tsx`: "adds the last score when it is known" passes `lastScore="7 of 10"` and keeps its expectations. Add "says a Streak score in its own words": `modeLabel="Streak"`, `lastScore="13 in a row"`: name "Continue: Cloud Practitioner, Security and compliance, Streak. Last score 13 in a row.", text "Continue where you left offCLF → SEC · Streak · last 13 in a row".

`tests/components/start/StartFlow.test.tsx`:
- "shows the best for this route on Classic, and the other classes as not available" becomes "shows every class as a button with the best for this route": stored records `{ "aws-clf-c02/SEC#classic": 9, "aws-clf-c02/SEC#streak": 12, "aws-clf-c02/SEC#lives": 21, "aws-clf-c02/CON#timed": 30 }`; on the class step of CLF / SEC the four buttons are named "Classic. 10 cards, score at the end. Your best: 9 of 10.", "Streak. Keep going until the first wrong answer. Your best: 12 in a row.", "Three lives. The round ends on the third wrong answer. Your best: 21 cards.", "Timed. 60 seconds, as many cards as you can. Not played yet."; no group named `/not available yet/`.
- Add "hands the chosen class to /play" (`it.each(["streak", "lives", "timed"])`): choose the class by its name's start, the ready pass shows its name in the Class field and its rule in the ready line ("Keep going until the first wrong answer. Swipe right for true, left for false."), "Start round" stores `{ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode }` under `PENDING_KEY`.
- "is not shown when the last class cannot be played in this version" (`mode: "streak"`) is removed here (see `unoffered.test.tsx`). In the `canShow` case (the block that checks which step a stored path may show), the assertion that step 6 cannot be shown with `mode: "streak"` becomes: it can; the "cannot" assertion moves to `unoffered.test.tsx` with `mode: "timed"`. Add "continues a round of another class with its own score": `last: { ...LAST_CLF_SEC, mode: "lives", score: 21, total: 21 }`: the line is named "Continue: Cloud Practitioner, Security and compliance, Three lives. Last score 21 cards."; pressing it shows the ready pass with Class "Three lives".

`tests/components/start/useCatalog.test.tsx`: in "leads Continue to the last route and mode, only while both can be played" the last assertion (`mode: "streak"` gives null) becomes: `mode: "streak"` gives a target whose `mode` is "streak".

`tests/components/start/unoffered.test.tsx`, new (jsdom): keeps the gate under test now that no real class is closed. It mocks the table with Timed closed and the other three classes open, whatever the real table says, so the file is green before and after step 3:

```ts
vi.mock("@/src/app-state/modes", async (original) => {
  const real = await original<typeof import("@/src/app-state/modes")>();
  const table = real.MODE_TABLE.map((mode) => ({ ...mode, offered: mode.id !== "timed" }));
  return { ...real, MODE_TABLE: table, isOffered: (mode: string) => table.find((row) => row.id === mode)?.offered ?? false };
});
```

- "shows a class that is not offered as not available, and it cannot be chosen": on the class step, the group "Timed, not available yet" has `aria-disabled="true"`, there is no button named `/^Timed/`, and a click on the group leaves the step "Choose how to play".
- "does not continue into a class that is not offered": `last.mode: "timed"`: no button named `/^Continue/`; and `continueTarget` returns null for it.
- "does not show the ready step for a class that is not offered": `canShow(INDEX, 6, { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC", mode: "timed" })` is false, and true with `mode: "streak"`.

**Steps:**

- [ ] **Step 1: Write the tests** (the changed cases, the new cases, the new file).
- [ ] **Step 2: Run them and watch them fail.** `pnpm vitest run tests/app-state/modes.test.ts tests/components/start`. Expected: "offers all four classes" fails (`offered` false for three); `lastScoreText is not a function`; the class buttons of Streak, Three lives and Timed are not found; the continue cases fail on the name. `unoffered.test.tsx` is green from the start (the gate exists since task 3, and the file's mock opens Streak and Three lives itself): it guards what steps 3 and 4 must not break.
- [ ] **Step 3: Open the gate and word the score** (rules 1 and 2).
- [ ] **Step 4: The continue line** (rule 3).
- [ ] **Step 5: Run them green.** `pnpm vitest run tests/app-state tests/components/start`.
- [ ] **Step 6: Play each class once from the start flow.** `pnpm dev`: choose Cloud, AWS, Cloud Practitioner, Security and compliance, then Streak; play to the result; "Choose another route" and check the continue line ("… · Streak · last N in a row") and the class card's best. The same for Three lives and Timed, in the night theme for one of them. Stop the dev server.
- [ ] **Step 7: Run the gates.** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` (port 3100 free). All green: the Classic specs pick Classic by its name and are not affected by three more buttons.
- [ ] **Step 8: Commit.**

```bash
git add src/app-state/modes.ts components/start tests/app-state/modes.test.ts tests/components/start
git commit -m "feat: Streak, Three lives and Timed can be chosen on the class step"
```
