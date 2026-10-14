# Truthy native port reference (corrected)

Repo: the repository root, `main` at `53e9c81`. This document combines the port map (`map.md`) with the completeness critic's findings (`critic.md`). I checked every claim from both against the source and made no changes to the repo. I ran no git commands, so all line numbers come from the working tree as it stands. A later pass applied the verification report's corrections (each checked against the code again) and the owner's decisions recorded in the design spec. Line numbers in `map.md` and `critic.md` are cited as `map:N` and `critic:N`.

Conventions in this document:
- `file:line` points into the repo. `DS:N` is `design/system/DESIGN-SYSTEM.md`. `SPEC:N` is `docs/superpowers/specs/2026-10-01-truthy-design.md`. `tokens:N` is `design/system/tokens.json`.
- **[web]** marks something the web build does that belongs to the browser (history, pointer events, focus rings, storage APIs). It records the web behaviour. It is not a native requirement.
- **[native]** marks guidance that the web code does not contain. It covers platform conventions, so that the ports feel native rather than like a webview.
- **Decided (spec X)** marks native behaviour that the owner decided on 2026-10-14 and that the design spec (`2026-10-14-truthy-native-apps-design.md`) records. The owner's choices: all 54 decks embedded (D3); back on the round behaves like the X (D4); light haptics at decision moments (D5); two native ports checked against shared golden vectors (D6); native interaction with the Boarding Pass look (D7); an in-place start flow whose back is a native gesture (D8). This document measures the web; the spec decides. Where they differ, the spec wins.

---

## 1. Product summary

1. Truthy is a true or false card game that teaches IT. It has 54 decks with 7378 cards across four areas: Cloud, Frontend, DevOps and Backend.
2. The player fills in a "boarding pass" one question per step: area, then platform, then deck, then section (or Whole deck), then mode. The UI calls the mode the "class".
   - A Recent shortcut skips the platform step.
   - A Continue line jumps straight to the ready pass.
   - A theme switch sits on every start step.
3. Each card is a statement.
   - The player drags right for True or left for False, or uses the True and False buttons. Arrow keys also work [web and hardware keyboards].
   - On a committed swipe the card springs back to rest and only the stub tears off (in Timed the stub stays and takes the stamp). The card is never thrown away.
   - A "Correct" or "Not quite" stamp lands, then the explanation and a source link appear.
4. Four modes run on one engine:
   - Classic: 10 cards, or fewer when the route has fewer.
   - Streak: ends at the first wrong answer.
   - Three lives: ends at the third wrong answer.
   - Timed: 60 seconds, and wrong answers cost nothing. Timed has no answer slip. Instead the verdict is stamped on the stub, the card is held for 700 ms, and then the next card is dealt.
5. The result shows:
   - the score;
   - a comparison with the best on that route and mode;
   - the missed cards, each with a "Why" disclosure.
6. Progress stays on the device. It drives:
   - the Continue line;
   - the Recent shortcut;
   - the seen percentage per deck;
   - the dealing order: missed cards first, then unseen, then seen longest ago.

---

## 2. Data contract

### 2.1 Shipped schemas (verbatim from `src/content/schema.ts`)

```ts
// public/decks/index.json  (schema.ts:93-125)
DeckIndex = { areas: [ { id: string, title: string,
  platforms: [ { id: string, title: string,
    decks: [ { id: string, code: string /*exactly 3 chars, may be digits: "104"*/, title: string, passName?: string,
      cardCount: int > 0,
      version: string,   // UTC build date YYYY-MM-DD, changes from day to day whatever the content: NOT a change signal
      hash: string,      // first 16 hex of sha256(JSON.stringify(cards)): the change signal
      sections: [ { id: string /*3 chars*/, title: string, cardCount: int > 0 } ] } ] } ] } ] }

// public/decks/<deckId>.json  (schema.ts:11-38)
DeckFile = { id: string, hash: string, cards: Card[] /*min 1*/ }
Card = {
  id: string,                 // "<deckId>-...", opaque, permanent
  section: string,            // a section id of the deck, or "ALL" for a sectionless deck (gcp-cdl)
  text: { en: { statement: string /*1..120 UTF-16 units*/, explanation: string /*1..240*/ } },
  answer: boolean,
  source: { title: string, url: string /*https only, domain host*/ },
  difficulty: 1 | 2 | 3,      // shipped, unused by app and engine
  appliesTo: string,          // "" when absent; shown above the statement when non-empty
  conflictGroups: string[]    // only groups shared by >= 2 cards in the same deck; scoped per deck
}
// Route { deckId: string; sectionId: string /* or WHOLE_DECK = "ALL" */ }  (schema.ts:8, :127-130)
// deckPassName = deck.passName ?? `${platform.title} ${deck.title}`   (schema.ts:137-139)
```

Notes on the schemas:
- **Key order.** A shipped card's keys are in the order `id, section, text, answer, source, difficulty, appliesTo, conflictGroups`.
- **Code markup.** The only markup is backtick pairs (`src/content/text.ts:13-40`).
  - A pair renders in the mono face at 0.92em with the backticks stripped (`components/CardText.tsx:6`).
  - An unpaired backtick, or each backtick of an empty pair, becomes a code part of its own and renders as itself in mono.
  - `plainText` (code without its backticks) is what announcements read.
- **Length checks.** The 3-character rule for codes and section ids lives in `CatalogSchema` (`schema.ts:53,59`). `DeckIndexSchema` does not re-check it.
- **Build pipeline.** The inputs are `content/catalog.json` (hand-written) and `content/reviewed/<deckId>.json`. `scripts/build-decks.ts` (logic in `src/content/build.ts`):
  - maps sections;
  - deduplicates each card's groups and drops groups used by only one card (`build.ts:146,160`);
  - drops pipeline-only fields;
  - sets `appliesTo` to `""` when absent (`build.ts:159`);
  - computes `hash = sha256(JSON.stringify(cards)).slice(0,16)` (`build.ts:39-41`);
  - writes `public/decks/`, which is gitignored and not present in this clone.
- **Order.** Catalog order is the display order at every level. Only the Recent list sorts.
- **Card id prefix.** A card id starts with `<deckId>-` (pruning relies on it, `progress.ts:92-101`). Card ids can contain dots, for example `aws-clf-c02-t1.1-01`.
- **Record and route keys.** Record keys are `` `${deckId}/${sectionId}#${mode}` `` (`progress.ts:22-24`, `schema.ts:141-143`). `findRoute` resolves a route by deck id across all areas, then by section, with `"ALL"` meaning the whole deck (`schema.ts:154-165`). `poolFor` returns the whole deck for `"ALL"`, otherwise the cards whose `section` equals the id, in file order (`load.ts:54-57`).

### 2.2 Sizes

| Item | Value | Verified here |
|---|---|---|
| Decks / cards / sections | 54 / 7378 / 285. 53 decks have sections; `gcp-cdl` has none | yes, recounted from `content/` |
| Platforms per area | cloud: aws 7, gcp 5, azure 5; frontend: 9 platforms (css 2, web 4); devops: 10 platforms (kubernetes 4, linux 2); backend: 10 platforms | yes |
| `content/reviewed/*.json` raw (pipeline format) | 6,826,946 B | yes |
| Shipped deck files, minified, sum | about 3.87 MB | no: `public/decks/` is a build output, absent here (map author's figure) |
| Shipped deck files, gzip all together | about 750 KB | no (map author's figure) |
| `index.json` | 27,216 B raw, 6,664 B gzip | no (map author's figure) |
| Largest deck `aws-clf-c02` | 214 cards, 112 KB shipped, about 23 KB gzip | card count is the critic's; sizes are the map's |
| Smallest deck `nextjs-rendering` | 94 cards, about 47 KB shipped | map's figure |
| Answers | 3517 True, 3861 False | yes |
| Cards with conflict groups | 2275 | yes |
| Non-ASCII text | 50 cards in statement or explanation (’ é É – “ ”). Also 286 cards whose `source.title` contains • § – ’ (U+2022, U+00A7, U+2013, U+2019) | yes. The map's "50" counts statement and explanation only |

Font consequence: the native font files must cover U+2022, U+00A7, U+2013, U+2018 to U+201D, é and É, the arrows U+2190 to U+2193, and U+00B7 (the middle dot in UI copy).

### 2.3 Deck delivery: embedded (decided, spec D3)

The table records the comparison that led to the decision. The fetch column was passed over.

| | Embed the build output in the binary | Fetch from `truthy-five.vercel.app` |
|---|---|---|
| Size cost | about 0.75 MB compressed in the IPA or APK | none |
| Offline | every deck always available | needs a cache plus "Needs a connection", loading and error states |
| States to build | none of loading, error or offline | `loadIndex` and `loadDeck` with an 8 s timeout, hash compare, any-copy fallback |
| Contract risk | none | no `schemaVersion` in `index.json`; the host is a free `vercel.app` subdomain; the hash cannot be checked natively, because it is Node `JSON.stringify` bytes |
| Freshness | content updates ship with app releases | live |

Decided (spec D3): all 54 decks are embedded, with no fetching and no offline states.
- `native-data/decks/` (`index.json` and the 54 deck files) is referenced in place, never copied: an Xcode folder reference on iOS, a Gradle `assets` source directory on Android (8.1).
- Decode the index at launch and one deck, off the main thread, when a route is chosen.
- Leave out the fetch path, the offline gating, "Needs a connection", and the `truthy.index.v1` and `truthy.deck.*` caches.

Constraints:
- Deck ids and card ids must never be renamed or reused across content releases, because native progress is keyed by them.
- **Keep the card order of each deck file.** The first shuffle runs over the pool in file order (`deal.ts:74,142`), so a fixture with a fixed seed depends on it. Use the build output as it is. The one change is the index's per-deck `version`, which the export fixes to the value recorded in `native-data/manifest.json` (spec 4.3).

---

## 3. Pure logic modules to port

Rules for every module:
- **Line-by-line reference.** These files are the reference that "the Swift and Kotlin clones translate line by line" (SPEC:83).
- **Purity.** `tests/purity.test.ts:11-18` enforces purity for `src/engine/*`, `src/input/*`, `src/progress/progress.ts`, `src/content/play.ts` and `src/content/text.ts`. It forbids `Date`, `performance`, `Math.random`, `crypto`, timers, the DOM and storage (`purity.test.ts:21-29`). Time and seeds always come in as arguments.
- **UI-pure helpers.** The helpers in 3.7 to 3.9 are pure in practice but are not purity-enforced. A native port should still keep them pure and unit tested.
- **No JSON golden file exists.** Every vector is inline in a `.ts` test.

### 3.1 rng (`src/engine/rng.ts`)

- **API:** `createRng(seed) -> () => Double` and `shuffle(items, rng)`.
- **mulberry32, exact:**
  ```
  state = seed >>> 0
  next: state = (state + 0x6d2b79f5) >>> 0; t = state
        t = imul(t ^ (t >>> 15), t | 1)
        t ^= t + imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  ```
  Natively, use `UInt32` with `&+` and `&*` in Swift. In Kotlin use `Int` with masking (or `UInt`). Return a Double.
- **Seed coercion:** -1 becomes 2^32-1, 1.9 becomes 1, and 2^32+1 becomes 1 (`rng.test.ts:51-56`).
- **Shuffle:** Fisher-Yates from the end, with `j = floor(rng() * (i+1))`. It makes exactly n-1 draws, and none for 0 or 1 items (`rng.ts:21-30`).
- **Golden vectors** (`tests/engine/rng.test.ts`; raw values are the draws times 2^32):

  | Input | Expected |
  |---|---|
  | seed 1 | `2693262067, 11749833, 2265367787` |
  | seed 42 | `2581720956, 1925393290, 3661312704` |
  | seed 0 | `1144304738, 1416247, 958946056` |
  | `shuffle(a..h, seed 1)` | `c,b,g,h,e,d,a,f` |

### 3.2 Dealing (`src/engine/deal.ts`)

**Which entry points to port (settled).** Port **both**:
- `deal(pool, history, rng, {count, avoid?, before?, budget?})` (`deal.ts:12-24`);
- `dealChunk(pool, history, rng, dealt, budget = SEARCH_BUDGET)` (`deal.ts:64-87`).

Both are thin wrappers over the shared `dealRanked` (`deal.ts:36-39`). The app calls only `dealChunk`, through `round.ts:72`. The golden tests need `deal`:

| Test | Call | Expressible through `dealChunk`? |
|---|---|---|
| `deal-pins-polish.test.ts:67-73` (seeds 1 to 3) and `:100-106` (over-cap, seeds 1 to 3) | `deal(..., {count: 10})`, empty avoid and before | Yes. `dealChunk(pool, history, rng, [])` takes the identical path: `unshown` is all cards, `comeBack` is empty, avoid and before are empty, overdue is false. `chunks.test.ts:191-196` pins the equality |
| `deal-pins-polish.test.ts:127-153`, `chunks.test.ts:90-125` | `deal(..., {count: 4, 5 or 10, before?})` | No. Property checks over 50 or 200 seeds (plus one length check at seed 1), not exact vectors |
| `deal.test.ts:246-258, 434-437` | `deal(..., {count, avoid})` | No |
| `search-polish.test.ts:57,81,103,146` | `deal(..., {count: 10, budget: 40 / 200 / 1})` | budget only through `dealChunk`'s 5th argument, with empty dealt |
| `deal-pins-polish.test.ts:190-219` | `deal(..., {count: 1..20})` | No (`dealChunk` is always min(10, available)) |
| `shipped-dealing-polish.test.ts:157` | `dealChunk(..., dealt, Infinity)` | yes |

**How `deal` sizes and sets up a deal** (`deal.ts:19-24, 36-39, 106-109`):
- size = 0 when `count` is NaN or at most 0, and `deal` then returns `[]` before any rng draw; otherwise size = min(floor(count), number of unique cards).
- `deal` ranks all unique cards (one shuffle of all of them), then calls `dealRanked` with `comeBack = []` and `overdue = false`. `dealRanked` defaults `avoid` and `before` to `[]` and `budget` to `SEARCH_BUDGET`, and applies `joinOf(before)`.

**Constants:**
- `DEAL = { missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3 }` (`deal.ts:10`)
- `CHUNK = 10` (`:55`)
- `SEARCH_BUDGET = 20_000` (`:219`)
- `OVERDUE_AFTER_PASSES = 2` (`:94`)

**Algorithm of `dealChunk`.** Port it exactly, including the order in which the rng is used:

1. **`uniqueById`.** Keep the first card with each id, in pool order (`:97-104`). `n` is the length of the result.
2. **Unshown, gap, comeBack, size** (`:72-79`):
   - `lastDealtAt[id]` is the last position of each card in `dealt`.
   - `unshown` is the cards never dealt, in pool order.
   - `gap = min(10, n-1)`.
   - `comeBack` is the cards whose `lastDealtAt < dealt.length - gap`, sorted by `lastDealtAt` ascending, oldest first. Positions are distinct, so there are no ties. **comeBack is not shuffled.**
   - `size = min(10, |unshown| + |comeBack|)`.
3. **`rankByPriority(unshown, history, rng, size)`** (`:141-154`, called at `:81`):
   - **It shuffles only `unshown`.** That makes |unshown|-1 draws, or none for 0 or 1 cards. In `deal()` the same function shuffles all unique cards (`:23`).
   - `missed` is the shuffled cards with `seen > 0 && lastCorrect === false`, stable-sorted by `lastSeenAt` ascending. A non-finite or missing `lastSeenAt` counts as 0 (`:120-123`).
   - `unseen` is the shuffled cards with no entry or with `seen == 0`. A `seen 0` entry counts as unseen even when `lastCorrect` is false (`:111-118`, pinned at `deal-pins-polish.test.ts:171-186`).
   - `seenRight` is the shuffled cards seen with the last answer right, stable-sorted by `lastSeenAt` ascending.
   - `missedCap = floor(size * 3 / 10)`.
   - `withinCap = missed[0..cap) + unseen + seenRight`, `overCap = missed[cap..]`.
   - `missed` (as a set of ids) holds the missed cards among the ranked cards only: the unshown cards in `dealChunk`, all unique cards in `deal` (`deal.ts:137, 151`). ComeBack cards are never in it, whatever their history, so they never count toward `missedLimit` or toward `missedLeft` in `canStillFinish`. They are not ranked by history either: they keep their `lastDealtAt` order.
4. **`choose`** (`:178-191`). Here `unshown` means `withinCap ++ overCap`, the ranked list, and `everyCard = unshown ++ comeBack`. The first step that finds a deal wins:
   1. `search(withinCap)`, with no missed limit.
   2. `searchOverCap` (`:197-211`). If `overCap` is empty it returns null. Otherwise `loosest = search(unshown)`, unlimited, and `held` is the number of missed cards in `loosest`. For `limit` from `missedCap` to `held-1`, it returns the first `search(unshown, {missedLimit: limit})` that succeeds, and otherwise `loosest`.
   3. `search(everyCard)`, only when `comeBack` is non-empty.
   4. `relaxStepByStep(everyCard, ...)`.
5. **Overdue** (`:85, :189-190`). This applies when `unshown` is non-empty, `dealt.length >= 2*n`, and the chosen deal holds no unshown card. The result is then `relaxStepByStep(everyCard, size, avoid, balance, first = [ranked unshown[0]])`. **`unshown[0]` is the first card of the ranked list** (`withinCap` then `overCap`), not the first card in file order.
6. **Balance** (`:162-167`): `minTrue = floor(size*4/10)`, `maxTrue = ceil(size*6/10)`. `balanceAllows` admits a True card while `trues < maxTrue` and a False card while `falses < size - minTrue` (`:371-373`).
7. **`searchWithAllRules`, a depth-first search** (`:232-320`):
   - At each card it tries "take", then "leave out".
   - `visit(from)` first returns true when the deal is full, **then** does `if (budget-- <= 0 || !canStillFinish(from)) return false` (`:307-308`).
   - Every search call starts with its own budget.
   - `canStillFinish` (`:274-304`) is an upper-bound cut. Port it exactly: the budget accounting decides ring-shaped pools (`search-polish.test.ts:128-190`).
8. **`relaxStepByStep`** (`:329-359`). It makes three greedy passes over `everyCard` that add to `first`: all rules, then without conflict groups, then without balance.
9. **`arrange`** (`:378-402`):
   - `trues = shuffle(chosen True cards)`, **then** `falses = shuffle(chosen False cards)`.
   - `limit = runLimit(t, f, join)` is computed once (`:407-411`). It starts at 3 and rises until some order fits after the join.
   - At each position, `allowed` is the answers that keep a placement possible (`placementCheck`, memoised, `:415-429`).
   - `pickAnswer` makes a draw **only when both answers are allowed**: True if `rng()*(t+f) < t` (`:433-437`).
10. **Join and conflict window.** `before` is the answers of the last 10 dealt cards and `avoid` is those cards (`:80-84`). `joinOf(before)` gives the last answer and the length of its run (`:48-53`).

**RNG draws, in order, per `dealChunk`:**
1. shuffle(unshown): |unshown|-1 draws;
2. the search: no draws;
3. shuffle(trues): t-1 draws;
4. shuffle(falses): f-1 draws;
5. one draw per position where both answers are allowed.

**Traps:**
- Use a stable sort, or add an index tiebreak. JS `Array.sort` is stable. Kotlin's `sortedWith` and `sortWith` are documented stable. On Swift `sort` see audit item R33; the tiebreak costs nothing.
- Compare cards by id, never by object identity (`unshown.includes(card)` works on the same objects in JS).
- A non-finite `lastSeenAt` counts as 0.

**Golden fixtures** (exact vectors):
- `deal-pins-polish.test.ts:67-73`: 16-card pool, seeds 1 to 3, `count: 10`.
- `:75-83`: three chunks with `createRng(100 + k)`.
- `:100-106`: over-cap pool, seeds 1 to 3.
- `:109-124`: 21-card route, six chunks with `createRng(210 + k)`, 60 ids, `k1` overdue in the sixth chunk.
- `overdue-boundary.test.ts:24-43`: 25-card route, `createRng(150 + k)`, overdue at exactly 2n.
- **Trap:** these chunk vectors seed each chunk with `createRng(base + k)`, **not** `chunkSeed`. The live round uses `chunkSeed` (3.3).

**Behaviour suites:** `deal.test.ts`, `chunks.test.ts`, `missed-cap-polish.test.ts`, `search-polish.test.ts`, `overdue-polish.test.ts`, `deal.property.test.ts` (pools generated with mulberry32), `tests/content/shipped-dealing-polish.test.ts` (every shipped route, with `chunkSeed`).

### 3.3 Round and modes (`src/engine/round.ts`, `src/content/play.ts`)

**API:**
- `startRound({mode, route, pool, history, seed})` (`:77-95`). It throws for an unknown mode or an empty pool and deals chunk 0.
- `reduce(state, event)` (`:133-151`). It returns **the same state** when the event does not apply, when the round is finished, or when the event time is not finite.
- `currentCard`, `lastAnswer`, `wrongCount`, `livesLeft`, `isDecided`, `scoreOf`, `summarise`.
- `chunkSeed(seed, k) = (seed + imul(k, 0x9e3779b9)) >>> 0` (`:66-68`). Chunk k is dealt with `createRng(chunkSeed(seed, k))`, after every card dealt so far (`:70-74`).
  - Pinned: `chunkSeed(12345, 0) == 12345` and `chunkSeed(0xffffffff, 1) == (0xffffffff + 0x9e3779b9) >>> 0 = 2654435768` (`modes.test.ts:74-81`).
  - Computed in this audit, for convenience: `chunkSeed(12345, 1..5) = 2654448114, 1013916587, 3668352356, 2027820829, 387289302`.

**Types** (verbatim):
- `Phase = "question" | "answered" | "stamped" | "finished"`
- `RoundEvent = answer{value, at} | next | tick{now} | visibility{hidden, at} | abandon`
- `Clock{remainingMs, lastTick, hidden, holdMs}`
- `Answered{card, given, correct, at}`
- `RoundResult{mode, route, score, total, answers, missed, abandoned}` (`play.ts:15-30`)

**Constants:** `CLASSIC_LENGTH = 10`, `LIVES = 3`, `TIMED = { roundMs: 60_000, holdMs: 700, maxStepMs: 1_000 }` (`:11-15`). The 700 equals token `motion.duration.hold-timed`.

**Phases.** Classic, Streak and Lives go `question -> answered -> (next) -> question`. Timed goes `question -> stamped -> (hold runs out on ticks) -> question`. Timed never enters `answered`.

**End rules (`isDecided`, `:116-128`):**

| Mode | Decided when |
|---|---|
| Classic | phase `answered` and `index + 1 >= cards.length` (10, or fewer for a small pool; no further chunk is ever dealt) |
| Streak | phase `answered` and the last answer is wrong |
| Lives | phase `answered` and 3 or more wrong answers |
| Timed | `clock.remainingMs == 0` |

A `next` event on a decided round finishes it with its score. `abandon` finishes it with `abandoned: true`.

**Scores (`:224-234`):**
- Classic and Timed: the number of correct answers.
- Streak: the longest correct run.
- Lives: `answers.length`.
- `total` is always `answers.length`.
- `scoreOf` over [T,T,F,T] gives classic 3, timed 3, streak 2, lives 4.

**Timed clock (`:174-221`):**
- `startRound` gives Timed `clock = {remainingMs: 60000, lastTick: null, hidden: false, holdMs: 0}`; the other modes get `clock = null` (`:93`).
- `elapsed` is 0 when the clock is hidden or `lastTick == null`. Otherwise it is `min(max(0, now - lastTick), 1000)`.
- `countTo(clock, now)` changes nothing while hidden; otherwise it counts `elapsed` off and sets `lastTick = now` (`:192-195`). The first tick **or** the first answer arms the clock, because both go through `countTo`.
- An answer counts the clock up to `at` first. If that reaches 0, the answer is **not** recorded, the phase becomes `stamped` with the clock at 0, and `holdMs` is left unchanged. Otherwise the answer is recorded, `phase = stamped` and `holdMs = 700`.
- While hidden, `countTo` changes nothing, so an answer is recorded with `holdMs = 700` and the hold waits until the page is shown again (ticks while hidden return the same state, `:198`).
- On a tick, the hold decrements by the same elapsed time. When it reaches 0 the round advances.
- If time runs out during a stamp, that answer counts. The round advances, and the card on screen at zero is **not** counted (`:201-206`).
- `visibility` is ignored when `remainingMs == 0` or when `hidden` already equals the event's value (`:215`, pinned at `timed.test.ts:106-113`).
- `visibility(hidden: true)` first runs the full tick logic at `at`: it counts the clock, decrements the stamp hold, advances when the hold reaches 0, and ends the time when the clock reaches 0. If the clock is then above 0, it sets `hidden = true, lastTick = null`. If the clock reached 0, it stays visible (`hidden: false`) and the round is decided (`:216-220`, pinned at `timed.test.ts:145-149` and `:216-219`).
- `visibility(hidden: false)` sets `hidden = false, lastTick = at`.
- Events with a non-finite time are ignored.

**Which clock (settled).** Ticks, visibility events and answer times must come from **one clock**, because `recordAnswer` counts up to `answer.at` (`round.ts:180`).
- On the web all three are `services.now = Date.now()`, the wall clock in epoch ms:
  - ticks: `useClock.ts:18-20`;
  - visibility: `useClock.ts:21`;
  - answers: `PlayScreen.tsx:588`;
  - definition: `useRound.ts:69`.
- `answer.at` is also stored as `lastSeenAt` (`progress.ts:85`).
- A wall clock set back during a round is survived: negative steps count as 0 (`tests/play/clock-jump-polish.test.tsx:101-106`).
- **Natively:** use epoch ms, floored to integer ms to match `Date.now()`, for all three.
  - iOS: `floor(Date().timeIntervalSince1970 * 1000)`.
  - Android: `System.currentTimeMillis()`.
  - Never mix a monotonic tick with epoch answers.

**Golden fixtures:** `round.test.ts`, `modes.test.ts`, `timed.test.ts`, `clock-polish.test.ts`.

### 3.4 Swipe interpretation (`src/input/swipe.ts`)

- **API:** `intent(dx)`, `canStart(sample, ctx)`, `interpret(samples, ctx) -> "true" | "false" | "cancel"`. A sample is `{x, y, t}` and the context is `{viewportWidth, cardShownAt}`.
- **Constants:** `SWIPE = { commitPx: 90, flingPx: 40, flingVelocity: 0.5 /*px/ms*/, settleMs: 250, edgePx: 24 }`, `INTENT_FULL_PX = 110`, `VELOCITY_WINDOW_MS = 80` (`swipe.ts:4-10`).
- **Rules, in order** (`swipe.ts:57-73`):
  1. Fewer than 2 samples: cancel.
  2. The first sample must pass `canStart`: `t - cardShownAt >= 250`, and `24 <= x <= viewportWidth - 24`, both ends inclusive (`:36-40`).
  3. `dx == 0`: cancel.
  4. `|dy| > |dx|`: cancel. An exact diagonal passes.
  5. `|dx| >= 90`: commit by the sign of dx.
  6. Otherwise commit if `|dx| >= 40` and the release velocity toward that side is at least 0.5. The reference sample is the first (oldest) earlier sample with `last.t - t <= 80`. A sample at exactly 80 ms counts; one at 81 ms does not. A `dt` of 0 or less means velocity 0 (`:48-54`).
- **Coordinates.** `viewportWidth` is **the window width** (`window.innerWidth`) and `x` is the viewport `clientX` (`components/play/useSwipe.ts:74,89`).
  - On a tablet or in landscape, where the frame is capped at 430, the edge zone is therefore the window edge, not the card edge.
  - Decided (spec 5.3): natives use window coordinates, and the 24 edge zone is measured from the window edges.
- **Sample time** (`useSwipe.ts:46-50, 73-76`) is the monotonic clock minus the age of the input event. It is the time the finger moved, not the time the handler ran.
- **Golden fixtures:**
  - `tests/input/swipe.test.ts`: 47 `it` blocks on a 390-wide context.
  - `swipe-polish.test.ts`, `swipe-early-touch-polish.test.ts`.
  - `tests/input/useSwipe-polish.test.tsx` and `tests/components/play/useSwipe.test.tsx` cover the binding.

### 3.5 Progress (`src/progress/progress.ts`, adapter `src/progress/local.ts`)

**API:** `emptyProgress`, `recordKey(route, mode)`, `bestFor`, `compareWithBest -> first | new-best{previousBest} | equal{best} | short{best, by}`, `applyResult -> {progress, previousBest, isNewBest}`, `pruneDeck`, `seenShare`, `readProgress(raw) -> {progress, whole}`, `parseProgress`.

**Format:**
```ts
interface Progress { version: 1; cards: Record<cardId, { seen: number; lastCorrect: boolean; lastSeenAt: number /*epoch ms*/ }>;
  records: Record<`${deckId}/${sectionId}#${mode}`, number>;
  last: { route: Route; mode: Mode; score: number | null; total: number | null } | null; }
```

**Record rules** (`applyResult`, `:57-78`):
- A first finished round sets the record, even with score 0.
- A record is replaced only by a strictly higher score. An equal score is not a new best.
- An abandoned round writes card history and `last` (with score and total null) and never touches the record. `last` is replaced by every applied round.
- A card answered twice in a round counts twice and keeps the later verdict and `at` (`:80-88`).

**Pruning** (`:92-101`): drop the history of cards whose id starts with `<deckId>-` and that are not in the deck's current ids. Records and `last` are kept.

**`seenShare`** (`:104-113`): the share of the given distinct ids with `seen > 0`. An empty list gives 0.

**Reading** (`:118-163`), part by part:
- Nothing stored gives empty progress and `whole: true`.
- Invalid JSON, a value that is not an object, or `version !== 1` (the number 1 exactly) gives empty progress and `whole: false`.
- Otherwise each card entry, each record and `last` is validated on its own. A failing part is dropped, `last` becomes null, and `whole` becomes false.
- A `cards` or `records` value that is missing, null, an array or not an object reads as `{}` with `whole: false` (`:156-157, 176-177`).
- **Validation** (zod 4, `package.json:30`): every number must be finite, because `z.number()` rejects Infinity and NaN. JSON such as `1e999` parses to Infinity in JS, so only the part that holds it is dropped. A native JSON decoder may accept or reject such a number; the port must end with the web's result: that part dropped, the rest kept.
  - `seen`: integer, at least 0.
  - `lastCorrect`: boolean.
  - `lastSeenAt`: finite, at least 0 (it need not be an integer).
  - records: integers, at least 0.
  - Integers must be safe integers: zod 4's `z.int()` rejects 2^53 and above (checked with zod 4.4.3 here; the repo pins 4.6.5).
  - `last.route.deckId` and `sectionId`: non-empty strings.
  - `last.mode`: one of the four modes.
  - `last.score` and `last.total`: nullable integers of at least 0. **They default to null when missing**, which covers legacy values.
- Unknown fields are dropped. A `__proto__` key stays a plain key (`:174-186`).
- A stored object with **no `last` key at all** fails the nullable schema (undefined is not null). It reads as `last: null, whole: false`, which triggers the side copy below.

**Golden fixtures:**
- `tests/progress/progress.test.ts`, `progress-polish.test.ts`;
- `partial-read.test.ts` (including the side key);
- `local.test.ts` (storage failures).

### 3.6 Start-flow derived data (`components/start/useCatalog.ts`; lift these to pure functions)

- **`deckOfCard(cardId, deckIds)`** (`:119-125`): the owner of a card is the deck id equal to the card id's longest prefix that ends before a `-`. For example `gcp-cdl` never takes the cards of `gcp-cdl-pro`.
- **`recentDecks(index, progress, limit = 4)`** (`:194-217`):
  - Only decks in the index count.
  - A deck's time is the maximum `lastSeenAt` over its cards' entries.
  - Newest first; ties keep catalog order (stable sort); at most 4.
  - The list is computed **once** per visit to the start screen, when the catalog loads (`:69-71`). It does not reorder while the screen is open.
  - The Recent card shows only when **2 or more** decks qualify (`StartFlow.tsx:900`).
- **`seenPercent(progress, deck, cardIds?)`** (`:153-164`):
  - 0 means "Not started". Otherwise `min(100, max(1, round(share*100)))`.
  - The share is over the deck's current card ids. With embedded decks those are always known. The fallback is a prefix count divided by `cardCount`.
- **`continueTarget(index, progress)`** (`:175-182`):
  - It exists when `last` is not null, its mode is offered, and `findRoute` still resolves.
  - `lastScore` is set only when both score and total are non-null.
- **`deckCount(place)`** and **`decksLabel(n)`** (`:103-112`): `"No decks yet"`, `"1 deck"`, `"N decks"`.
- **Start-screen prune and save** (`:64-69, :140-145`): for every deck with history, prune the history against the current ids, and save **only when the number of card entries changed**. With embedded decks this runs for every played deck at launch.

Tests: `tests/components/start/useCatalog.test.tsx`, `unoffered.test.tsx`, `e2e/recent-decks.spec.ts`.

### 3.7 Start-flow state machine helpers (`components/start/StartFlow.tsx:72-185`)

These are pure and exported. Natives mirror them:

- **Steps and keys:**
  - `Step = 1..6`.
  - `RECENT = "recent"`.
  - `Choice{via?, areaId?, platformId?, deckId?, sectionId?, mode?}`.
  - `STEP_OF = {via:1, areaId:1, platformId:2, deckId:3, sectionId:4, mode:5}`.
  - `stepOf(key, choice)`: on the recent path, area and platform belong to step 3 (`:95-97`).
- **`clearFrom(choice, step)`**: keep only the choices made on steps before `step` (`:102-108`).
- **`pathTo(step, hasSections, recent)`**: `[1,2,3,4,5,6]`, without 4 for a deck with no sections and without 2 on the recent path, cut at `step` (`:111-114`).
- **`previousStep`**: the second-to-last step of that path, else 1 (`:117-120`).
- **`chosenOn(target, choice)`**: the id whose card takes focus when going back. On step 1 of the recent path it is `RECENT` (`:126-130`).
- **`canShow(index, step, choice)`**: whether a remembered step can still be shown (`:172-185`). It looks the choices up with the internal `resolve` (`:157-169`): the platform only inside the chosen area, the deck only inside that platform, the section as `ALL` (the whole deck) or an existing section id of that deck, and the mode only when it is in `MODE_TABLE` and offered. Then, in order:
  - false if on the recent path and step == 2;
  - let placed = !(recent && step == 3);
  - step >= 2 && placed needs the area; step >= 3 && placed needs the platform;
  - step >= 4 needs the deck; step == 4 needs a deck with sections;
  - step >= 5 needs the section; step >= 6 needs the mode.
- **`entriesBehind`** [web, history only] (`:206-210`).

Tests: `tests/components/start/StartFlow.test.tsx`, `unoffered.test.tsx`.

### 3.8 Copy and guard helpers

Port these as tables or functions, not as UI. All are verbatim sources for 4.5.

- `MODE_TABLE`, `modeInfo`, `isOffered`, `lastScoreText` (`src/app-state/modes.ts:21-43`).
- `verdictText`, `roundStatus`, `timedStatus`, `timedCardText` (`PlayScreen.tsx:102-143`).
- `leavesSomething`, `saveLeftRound` (`components/play/leave.ts:10-23`):
  - Leaving saves something when there are answers **or** the round is decided.
  - A decided round is recorded with `next` semantics (score and record). Any other round is abandoned.
- `resultCopy` (`components/play/resultCopy.ts:42-105`).
- `cardList`, `flightPathLabel`, `completedLabel` (`components/FlightPath.tsx:97-126`).
- `streakLabel` (`StreakPath.tsx:48-54`), `livesLabel` (`LivesPath.tsx:44-57`), `clockText` and `timedLabel` (`TimedPath.tsx:18-32`).
- `changeLabel` (`FillInPass.tsx:71-73`) and `continueLabel` (`ContinueLine.tsx:37-41`).
- `missedCards(answers)` (`MissedCards.tsx:32-48`).
- `ticketFor` (`useRound.ts:128-137`): `sectionCode` is the section id or `"ALL"`; `sectionName` is the section title or `"Whole deck"`.
- `textParts` and `plainText` (`src/content/text.ts`).
- `pad2` (`components/format.ts`): two digits, longer numbers unchanged.
- `parseTheme`, `oppositeTheme`, `resolveTheme` (`src/app-state/theme.ts:36-47`).

### 3.9 Full inventory of pure helpers a native port must mirror (with tests)

| Module (web file) | Functions and constants | Test files |
|---|---|---|
| rng (`src/engine/rng.ts`) | `createRng`, `shuffle` | `tests/engine/rng.test.ts` |
| deal (`src/engine/deal.ts`) | `deal`, `dealChunk`, `DEAL`, `CHUNK`, `SEARCH_BUDGET`. Internal and ported: `dealRanked`, `uniqueById`, `dealSize`, `wasSeen`, `wasMissed`, `lastSeenAt`, `oldestFirst`, `rankByPriority`, `balanceFor`, `choose`, `searchOverCap`, `searchWithAllRules` with `canStillFinish`, `relaxStepByStep`, `sharesGroup`, `trueCount`, `balanceAllows`, `arrange`, `joinOf`, `runLimit`, `placementCheck`, `pickAnswer`, `OVERDUE_AFTER_PASSES` | `tests/engine/deal.test.ts`, `deal-pins-polish.test.ts`, `chunks.test.ts`, `missed-cap-polish.test.ts`, `search-polish.test.ts`, `overdue-polish.test.ts`, `overdue-boundary.test.ts`, `deal.property.test.ts`, `tests/content/shipped-dealing-polish.test.ts` |
| round (`src/engine/round.ts`) | `startRound`, `reduce`, `currentCard`, `lastAnswer`, `wrongCount`, `livesLeft`, `isDecided`, `scoreOf`, `summarise`, `chunkSeed`, `CLASSIC_LENGTH`, `LIVES`, `TIMED` | `tests/engine/round.test.ts`, `modes.test.ts`, `timed.test.ts`, `clock-polish.test.ts` |
| swipe (`src/input/swipe.ts`) | `intent`, `canStart`, `interpret`, `SWIPE` | `tests/input/swipe.test.ts`, `swipe-polish.test.ts`, `swipe-early-touch-polish.test.ts` |
| progress (`src/progress/progress.ts`) | `emptyProgress`, `recordKey`, `bestFor`, `compareWithBest`, `applyResult`, `pruneDeck`, `seenShare`, `readProgress`, `parseProgress` | `tests/progress/progress.test.ts`, `progress-polish.test.ts`, `partial-read.test.ts` |
| progress store (`src/progress/local.ts`) | `PROGRESS_KEY`, `UNREADABLE_KEY`, `createLocalStore(storage) -> {load, save}` (save calls `keepUnreadable` first), `browserLocalStorage` (an adapter, storage-backed) | `tests/progress/local.test.ts`, `partial-read.test.ts` |
| content (`src/content/schema.ts`, `load.ts`, `text.ts`) | `WHOLE_DECK`, `deckPassName`, `routeKey`, `findRoute`, `poolFor`, `textParts`, `plainText` | `tests/content/schema.test.ts`, `schema-polish.test.ts`, `load.test.ts`, `text.test.ts` |
| modes (`src/app-state/modes.ts`) | `MODE_TABLE`, `modeInfo`, `isOffered`, `lastScoreText` | `tests/app-state/modes.test.ts`, `modes-polish.test.ts`, `modes-score-copy-polish.test.ts` |
| theme (`src/app-state/theme.ts`) | `THEME_KEY`, `parseTheme`, `oppositeTheme`, `resolveTheme`, and the flip rule of `switchTheme` | `tests/app-state/theme.test.ts`, `theme-polish.test.ts` |
| catalog (`components/start/useCatalog.ts`) | `deckCount`, `decksLabel`, `deckOfCard`, `seenPercent`, `continueTarget`, `recentDecks`, `RECENT_LIMIT`, `withoutRemovedCards` | `tests/components/start/useCatalog.test.tsx`, `unoffered.test.tsx` |
| start flow (`components/start/StartFlow.tsx`) | `STEP_OF`, `stepOf`, `clearFrom`, `pathTo`, `previousStep`, `chosenOn`, `canShow` | `tests/components/start/StartFlow.test.tsx`, `unoffered.test.tsx` |
| list cue (`components/start/listCue.ts`) | `listCue`, `revealDelta`, `FADE_PX = 28` | `tests/components/start/listCue.test.tsx`, `reveal-on-return.test.tsx` |
| pass and continue (`FillInPass.tsx`, `ContinueLine.tsx`) | `changeLabel`, `continueLabel` | `tests/components/FillInPass.test.tsx`, `tests/components/start/ContinueLine.test.tsx`, `continue-line-polish.test.tsx` |
| play copy (`components/play/PlayScreen.tsx`) | `verdictText`, `roundStatus`, `timedStatus`, `timedCardText`, `NEXT_ARRIVES_MS`, `SPOKEN_RELEASE_MS` | `tests/components/play/PlayScreenTimed.test.tsx`, `timed-applies-to-polish.test.ts`, `round-status-voice.test.tsx` |
| leave (`components/play/leave.ts`) | `leavesSomething`, `saveLeftRound` | `tests/components/play/leave.test.ts` |
| result (`resultCopy.ts`, `ResultView.tsx`, `MissedCards.tsx`) | `resultCopy` (with `cards`, `tally`), `recordRound` (once per round), `RESULT_ARRIVES_MS`, `missedCards` | `tests/components/play/resultCopy.test.ts`, `ResultView.test.tsx`, `tests/components/MissedCards.test.tsx` |
| ticket scroll (`components/play/ticketScroll.ts`) | `statementScroll`, `slipScroll`, `keyScroll`, `ARROW_STEP = 40` | `tests/components/play/ticketScroll.test.ts` |
| flight path (`components/FlightPath.tsx`) | `pointAt`, `waypointT`, `flownPath`, `headingAt`, `waypointStates`, `cardList`, `flightPathLabel`, `completedLabel`, `completedScale` | `tests/components/FlightPath.test.tsx`, `FlightPath-polish.test.tsx` |
| streak, lives, timed headers | `streakLayout`, `streakLabel`; `trailLayout`, `livesLabel`; `clockText`, `timedLabel` (`wholeSeconds = ceil(max(0,ms)/1000)`) | `tests/components/StreakPath*.test.tsx`, `LivesPath*.test.tsx`, `TimedPath*.test.tsx` |
| barcode (`components/BoardingPass.tsx:257-277`) | `barcodeBars` | `tests/components/BoardingPass.test.tsx` |
| format (`components/format.ts`) | `pad2` | `tests/components/format.test.ts` |
| ticket info (`components/play/useRound.ts`) | `ticketFor` | `tests/components/play/useRound.test.tsx` |
| logo (`components/Logo.tsx:20`) | `LogoMark` height = `round(width*30/44*100)/100` | `tests/components/Logo.test.tsx` |
| tokens | the contrast pairs | `tests/tokens/contrast.test.ts` |

Formulas worth stating here:
- **Flight path** (`FlightPath.tsx:44-138`):
  - The curve is `P0(6,24) P1(138,-6) P2(270,24)` in a 276x34 box.
  - `pointAt` is the quadratic Bezier rounded to 0.01.
  - `waypointT(i,n) = n<=1 ? 0 : i/(n-1)`.
  - `headingAt` is the tangent angle in degrees, rounded to 0.01.
  - `completedScale(c)`: 1 up to 10 cards, 6/7 up to 17, then `min(6, 0.35*264/(c-1))/7`.
- **Barcode** (`BoardingPass.tsx:251-277`):
  1. Start bars 2/1/1/2 (on, off, on, off).
  2. For each character, `code = charCodeAt(0)`. For bits 0 to 6, LSB first, a bar of width `bit ? 2 : 1`, on when the bit index is even. Then a 1-wide off gap.
  3. End bars 1/1/2 (on, off, on).
  4. The bars are 56 tall in a `width x 56` box, stretched to the full stub width and 76 tall.
  5. **The data is `card.id`** (`PlayScreen.tsx:796`). DS:519's sample string is stale.

### 3.10 UI-guard constants

| Constant | Value | Clock |
|---|---|---|
| settle after a card appears (answers, swipes) | 250 ms (`SWIPE.settleMs`) | monotonic (`PlayScreen.tsx:491, 585-586`) |
| settle after a start step or options appear (option, Continue, Start round) | 250 ms | monotonic (`StartFlow.tsx:66, 483-500`) |
| Back pill and pass fields after the short-screen column jumped | 250 ms | monotonic (`StartFlow.tsx:493-501`) |
| `NEXT_ARRIVES_MS` (Next card and See results take presses) | 420 | monotonic, counted from the first answer to that card, or from time up (`PlayScreen.tsx:58, 595-599`) |
| `RESULT_ARRIVES_MS` (Play again, Choose another route, Close results) | 1000 | monotonic (`ResultView.tsx:48, 116-125`) |
| leave-sheet scrim ignores taps | 250 ms after it opens | monotonic (`LeaveDialog.tsx:57, 132-134`) |
| Timed ticker | every 100 ms (`TICK_MS`, `useRound.ts:17`) | wall clock (3.3) |
| Why scroll delay | 380 ms (50 with reduced motion), then waits up to 60 frames for the row to reach full height | `MissedCards.tsx:81, 114-144` |
| live regions held after the sheet closes | 150 ms (`SPOKEN_RELEASE_MS`) | `PlayScreen.tsx:66, 462-468` |

The guards (250, 420, 1000) and the 700 ms hold are the same with reduced motion.

---

## 4. Screens and navigation

### 4.1 Inventory

| Id | Screen | Contents |
|---|---|---|
| S1 | Step 1 | Top zone 176 tall. Logo as the page `h1` "Truthy", 36 from the top, then the tagline 14 below with a max width of 300 (`StartFlow.tsx:774-780`). Theme switch at the top right, offset 32 down (`:274, 815-822`). Title "Choose an area". Recent card first (2 or more decks), then the area cards. Continue line in the foot zone (when there is a target); the list then stops 76 above the bottom (`size.foot-gap`). |
| S2 | Step 2 | Back pill (visible "Back"; label "Back to areas"), the fill-in pass in the "destination" stage, title "Choose a platform", platform cards. Theme switch at y 0. |
| S3 | Step 3 | The pass in the "destination" stage. "Choose a deck", deck cards (ordinary, or the Recent list on the recent path). |
| S4 | Step 4 (decks with sections only) | The pass in the "route" stage. "Choose a section". The first card is "Whole deck", then the sections in catalog order. |
| S5 | Step 5 | The pass in the "route" stage. "Choose how to play". Class cards (no chevron) with stub "Best" and value/unit, or "–" and "not played". |
| S6 | Step 6 | The full "ready" pass (8 top margin). Title "Your pass is ready" with 112 top padding (88 under 600 tall, 0 under 568). Line "{description} Swipe right for true, left for false." (max width 320). Foot pill "Start round" with a trailing "→". |
| P0 | Play, loading | Sky, X ("Leave round"), a placeholder ticket (band only, 336 body, 228 stub). sr `h1` "Your round", status "Loading your round". With embedded decks, visible only if decoding is slow. |
| P1 | Play, load failed | Alert card with `h1` "This deck didn't load" and "Check your connection and try again."; pill "Try again"; X leaves. Unreachable with embedded decks except on a corrupt bundle. |
| P2 | Play, question | sr `h1` "{deckName}, {sectionName}: {class} round". Header: X plus the mode's header (4.1a). Ticket: band (cloud, "Truthy", "BOARDING PASS"), legs (code over name), field grid Class / Card / Gate (Card is "04 / 10" in Classic, "04" otherwise; Gate shows "F ← → T"), statement (appliesTo line above it when non-empty). Stub: route line "CLF → SEC · Classic", "Card 04", barcode, hint row "← False" / "swipe to board" / "True →". Intent stamps appear while dragging. Pills "False" and "True" (icons). |
| P3 | Play, answered (Classic, Streak, Lives) | The stub tears off and reveals the slip: "The answer is" over "True" or "False", a stamp ("Correct", "Not quite", or "New best" in Streak only), the explanation, the source link. The pill "Next card" or "See results" (trailing "→") rises in. The ticket jolts 2 px. |
| P3t | Timed stamp beat, then time up | The stub stays. A stub stamp lands ("Correct" or "Not quite"), with hint "Next card coming up" or "Wrong, saved for review at the end". True and False dim to 0.45 but keep focus. At time up: stamp "Time is up" (clock icon), hint "This card doesn't count · N answered", Gate "Closed", the statement turns ink-muted, and the pill becomes "See results". |
| P4 | Leave sheet | A floating card (not a bottom-edge sheet) over the scrim. Title "Leave round?". Body before the decision: "Your answers so far stay in your history. This round won't count toward your best." Body once decided: "This round is over and its score is kept. Leaving skips its result." Buttons "Keep playing" (pill) and "Leave round" (quiet). Natively the same card is drawn inside the platform sheet (7.2 item 7). |
| R1 | Result | X "Close results". Completed flight path with a per-mode label row. sr `h1` "Round complete". Ticket with the per-mode field grid, the score block and comparison, and the missed-card list ("Missed cards", "N to review", rows with "Why", or "No missed cards"). Actions "Play again" (replay icon) and "Choose another route" (route icon). |

The 404 page, `OfflineStart` and the service-worker update UI do not port.

**4.1a Play header per mode** (one image with a full-sentence label, plus a label row that is aria-hidden):

| Mode | Drawing | Label row (left / right) |
|---|---|---|
| Classic (`FlightPath.tsx`) | A dotted curve (stroke 1.6, dash 2/5), solid up to the current card (2.4). One waypoint per dealt card: a correct mark (an ink r7 circle with a tick; the card just answered uses the `correct` colour), a wrong mark (a `wrong` 13x13 rx2 square with an x), future cards (an r4 open circle, r5 for the last). The plane (amber r12 disc with an arrow) sits on the current card and fades out over 220 ms once the card is answered. | "Card **N** of T" / "c correct · w wrong" |
| Streak (`StreakPath.tsx`) | Dots per correct answer laid out by `streakLayout`. When a best of at least 1 is ahead, the route ends on a target ring (r7 paper plus an r3 ink centre). A "reached" ring once passed. | "Streak **N**" or "Streak ended at **N**" / "Best **B**" or "Previous best **B**" (only when best >= 1; "Previous" once streak > best) |
| Three lives (`LivesPath.tsx`) | Three hearts at x 11/39/67 (filled ink, or outlined ink-muted with a slash). The slash of the life just lost draws over 300 ms after 380 ms. A mini trail on y 17 (`trailLayout`), with the plane at x 238. | "**L** of 3 lives left" or "**No** lives left" / "**N** answered" |
| Timed (`TimedPath.tsx`) | The route is the minute. The plane glides along `t = 1 - remaining/60000`. A start dot, three quarter marks (filled once passed), an end dot. | "**0:41** left" (Mono 600 13, tabular figures; seconds rounded up, so "1:00" at the start and "0:00" only at the end) / "c correct · w wrong" |

### 4.2 State machine

```
Start(step, choice)  path = [1,2,3,4,5,6]; no sections drops 4 (sectionId="ALL"); Recent path drops 2
  S1 --area--> S2 --platform--> S3 --deck--> S4 --section--> S5 --mode--> S6
  S1 --Recent--> S3(recent) --deck fills area+platform+deck--> S4|S5
  S1 --Continue--> S6 with the full path pushed (Back retraces 5,4,3,2, or 5,3,2 for a deck without sections)
  Back / Escape / pass field "Change {x}, now {v}" --> that step, clears choices made on or after it
    (web back motion: dir = -1, no name travel; natively a function of progress p, see 7.2 item 4)
  Recent path: "Change platform" rewrites the stack to [1, 2{area}, 3{area,platform}], focus on the deck chosen before
  S6 --Start round (Back pill + theme switch fade 110, empty paper unrolls 360 ms)--> REPLACE with Play(route, mode)
    (natively: the two top-level screens are swapped in place right after the unroll, see 7.1;
     every back during the unroll is consumed and does nothing)
Play
  Loading --> Question --answer (one path: swipe | button | arrow key)--> Answered | Stamped(Timed)
  Answered --Next (>= 420 ms)--> Question | Result (when decided)
  Stamped --700 ms counted on ticks--> Question;  time up --> Stamped(clock 0) --See results (>= 420 ms)--> Result
  X / Escape: answers == 0 --> leave() --> S1   (a decided round with 0 answers is still RECORDED, see below)
              answers > 0 --> Sheet --Keep playing | Escape | scrim (after 250 ms)--> back
                                     --Leave round--> saveLeftRound --> S1
  System back [web]: unmount or pagehide --> saveLeftRound --> S1
  Native back (decided, spec D4 and 5.2): question, answered or stamped --> what the X does
                                          sheet open --> Keep playing;  loading --> leave at once
                                          result --> what Close results does (>= 1000 ms)
Result (recorded once on first show)
  --Play again (>= 1000 ms)--> Loading (same route+mode, progress re-read and re-pruned)
  --Choose another route | Close results (>= 1000 ms)--> S1 (choices cleared, focus on the S1 title)
```

Rules the map left out:
- **Escape on the start flow** goes back one step, like the Back pill (`StartFlow.tsx:653-660`). On step 1 it does nothing, because `backTo` ignores a target that is not earlier (`:604`). Natively Escape on step 1 is consumed, so on Android it does not fall back to Back (7.1).
- **The X with zero answers can still record.** `requestLeave` leaves at once when there are no answers (`PlayScreen.tsx:616-617`). `leave()` still runs `saveLeftRound` whenever `leavesSomething` is true (`:314-321`), and that is true for a decided round (`leave.ts:10-12`). So when the Timed minute runs out with 0 answers and the player presses X, the round is recorded with score 0. As a first round that sets the record and `last`, with score 0 and total 0.
- **The Timed clock keeps running under the leave sheet** (`PlayScreen.tsx:470-472`). If the round becomes decided while the sheet is open, the body text switches, and a status line announces the new text once. It only does so if the round was not already decided when the sheet opened (`LeaveDialog.tsx:58-63, 161-163`).
- **Unrolling blocks input.** During the 360 ms unroll, `main` is inert (`StartFlow.tsx:768`).
- **Play again** re-reads progress, prunes and saves, then deals with a new seed (`useRound.ts:169-197, 268-273`).
- **In-place steps.** The start flow is **one screen** whose steps animate in place (`StartFlow.tsx:3-8, 827-831`). On the web each step is also a history entry so browser back works [web]. The URL never changes.
- **Reload.** A web reload starts the flow at step 1 and rewinds the history entries behind it (`StartFlow.tsx:429-438`). Decided (spec 5.6): after process death the native app opens at start step 1 with no choices, the same way.

### 4.3 Guards

- Start options, Continue and Start round ignore presses for 250 ms after a step appears. That includes step 1's options when the index first loads, and the arrival from Play (`StartFlow.tsx:480-487, 575, 663, 696`).
- Back, the pass fields and Escape never wait for the settle time. The Back pill and the pass fields (not Escape) are held for 250 ms after the short-screen column jumped to its top (`:493-501, 590-599`); Escape goes through `back()` to `backTo` and skips that hold (`:647, 656`).
- Answers: the round must be in the `question` phase, no sheet may be open, and 250 ms must have passed since the card appeared (`PlayScreen.tsx:582-591`). A swipe is ignored outside the question phase or while the sheet is open (`:677-682`). A card that stops taking answers mid-drag springs back (`useSwipe.ts:64-67`).
- Next card and See results: 420 ms. Until then the row also ignores pointer input (`PlayScreen.tsx:837`) [web].
- Result actions: 1000 ms.
- On Play, a held key does not repeat any action (`PlayScreen.tsx:78, 605-613`). The start flow has no repeat guard: a held Escape walks back one step per key repeat (`StartFlow.tsx:654-660`, and `backTo` at `:602-610` has no settle check). Decided (spec section 2, hardware keyboard): natively a held key acts once everywhere, the start flow included.

### 4.4 Focus moves [web; natives map them to accessibility focus]

- **Start, forward:** the new step's title (an `h2`, programmatic, no visible ring).
- **Start, back:** the card chosen before. The list scrolls first so that card shows whole above the fade (`StartFlow.tsx:525-548`, `listCue.ts:87-105`).
- **Arriving from Play** by a control (Leave round, Choose another route, Close results): the step 1 title (`StartFlow.tsx:539-542`). A fresh launch moves no focus.
- **Round start:** the statement, a focus target with no ring. In Timed only the first card's statement takes focus. Later cards are announced, and focus stays on the pill, or moves to the ticket if it was on the statement (`PlayScreen.tsx:506-511`).
- **After an answer:** Next card or See results, at 420 ms, or at once with reduced motion (`:556-568`).
- **At Timed time up:** See results takes focus **only if True or False had focus** at that moment (`:547-551, 566`).
- **Sheet open:** "Keep playing". **Sheet closed** (Keep playing, Escape or scrim): the X (`LeaveDialog.tsx:65-67`, `PlayScreen.tsx:570-576`). Tab is trapped between the two buttons [web] (`LeaveDialog.tsx:97-113`).
- **Result:** the "Round complete" heading. If a New best was set, the comparison is scrolled into view first (`ResultView.tsx:128-139`).

### 4.5 User-facing copy and accessibility labels, verbatim, by screen

Text in `{}` is interpolated. `nn` means `pad2(n)`. "→" is U+2192, "←" is U+2190, "·" is U+00B7, and the Best placeholder "–" is U+2013 (en dash).

**App**
- Name "Truthy". Description "A true or false card game that teaches IT, one swipe at a time." (`src/meta.ts`). Use them for the store listing or the bundle display name.

**Start, every step**
- Theme switch label: "Switch to dark theme" while the day theme shows (moon icon), "Switch to light theme" while night shows (sun icon) (`ThemeSwitch.tsx:31, 58-71`). [web] "Switch theme" before hydration only.
- Back pill: visible "Back". Label "Back to {areas | platforms | decks | sections | classes}", naming `BACK_TO[previousStep]` (`StartFlow.tsx:360, 786-797`).
- Step titles: "Choose an area", "Choose a platform", "Choose a deck", "Choose a section", "Choose how to play", "Your pass is ready" (`:352-359`).
- Option lists are announced as lists (role list and listitem). They are not lists on step 6 or while loading (`:1084, 1100`).

**S1**
- Logo `h1` "Truthy". Tagline "True or false cards that teach you IT, one swipe at a time." (`:778-779`).
- Area card: name `{title}`, sub `decksLabel(n)` ("1 deck", "{n} decks", "No decks yet"). Label "{title}, {decksLabel(n)}", or "{title}, no decks yet" for an unavailable group (`:884-897`).
- Recent card: name "Recent", sub = deck codes joined by " · ", label "Recent, {decksLabel(count)}" (`:901-911`).
- Continue line: visible deck pass name (one line, truncated), then a mono line "{CODE} → {SEC}" " · {Class}" " · last {score}". The score part is left out when it is null. Label "Continue: {deckName}, {sectionTitle}, {class}. Last score {x}." or, without a score, "Continue: {deckName}, {sectionTitle}, {class}." (`ContinueLine.tsx:37-41, 84-110`). `{x}` comes from `lastScoreText`: "{s} of {t}", "{s} in a row", "{s} cards", "{s} correct". [web offline] "Needs a connection" and the label "Continue: {deckName}, {sectionTitle}, {class}, needs a connection."
- Loading: sr status "Loading the decks". Index failure: "The decks didn't load", "Check your connection and try again.", pill "Try again" (`StartFlow.tsx:1107-1132`). Unreachable with embedded decks.

**S2**
- Platform card: as the area card, with the platform title (`:915-928`).

**S3**
- Deck card:
  - name `{code}` (Mono 600 30) and detail `{title}`;
  - status `{p}% seen` (the percentage bold) or "Not started";
  - stub "Cards" over `{cardCount}`;
  - label "{code}, {title}, {cardCount} cards, {p} percent seen" or "{code}, {title}, {cardCount} cards, not started" (`:1012-1024`).
  - [web offline] dimmed variant: "Needs a connection", label "{code}, {title}, needs a connection".

**S4**
- Whole deck card: name "Whole deck", detail "All {k} sections", stub "Cards"/`{count}`, label "Whole deck, all {k} sections, {count} cards".
- Section card: name `{sectionId}` in mono, detail `{title}`, stub "Cards"/`{count}`, label "{sectionId}, {title}, {count} cards" (`:938-955`).

**S5**
- Class card: name `{name}`, detail `{description}` (ink-muted), stub "Best" over `{best}` and `{unit}`, or "Best", "–" (muted), "not played".
- Label "{name}. {description} Your best: {best} {unit}." or "{name}. {description} Not played yet."
- Not offered: sub "Not available yet", label "{name}, not available yet" (`:957-980`). Unreachable today.
- `MODE_TABLE` (`modes.ts:21-26`):

  | id | name | description | unit |
  |---|---|---|---|
  | classic | Classic | Correct answers out of 10 cards. | of 10 |
  | streak | Streak | Correct answers in a row, until the first wrong one. | in a row |
  | lives | Three lives | Cards answered until the third wrong one. | cards |
  | timed | Timed | Correct answers in one minute, wrong ones cost nothing. | correct |

**S6**
- "{description} Swipe right for true, left for false." Pill "Start round" (trailing "→", aria-hidden) (`:981-986, 855-857`).

**Fill-in pass** (`FillInPass.tsx`)
- Compact band: "Truthy" (14) and "YOUR PASS" (Mono 600 11, 0.06em). Ready band: cloud, "Truthy" (16) and "BOARDING PASS" (Mono 600 12, 0.06em).
- Destination labels: "Area", "Platform", "Deck". Route labels: "Deck", "Section", "Class". Ready labels: "Class", "Cards", "Gate".
- Ready values: Class `{class name}` and Cards `{cardCount}` of the chosen section or the whole deck, not padded (for example "214", unlike the ticket's padded Card field), both in field-value Mono 600 15; Gate as on the ticket (`FillInPass.tsx:270-282, 93-95, 304`, `StartFlow.tsx:751`). The Mono class value is why name travel skips the class.
- Gate visible "F ← → T" (aria-hidden), sr "False left, true right".
- A blank field is three dashes, with sr "not chosen" (`:135-156`).
- Filled field way-back label "Change {area|platform|deck|section|class}, now {value}" (`:71-73, 204`):
  - The value is the area or platform title, the deck code, the section code, or "Whole deck", or the class name.
  - The ready deck leg reads "Change deck, now {CODE}".
  - The ready section leg reads "Change section, now {SEC}", or "Change section, now Whole deck" for `ALL` (`:260`).
  - The field being chosen now has no way back.
  - The section is no way back when the deck has no sections (`:203, 249-255, 368`).
- The pass body is a polite live region (`:495`).

**Play** (`PlayScreen.tsx`, `BoardingPass.tsx`, `AnswerButtons.tsx`, `Stamp.tsx`)
- X label "Leave round" (`:342`).
- Headings: sr `h1` "{deckName}, {sectionName}: {class} round" (`:716`).
- Loading: sr `h1` "Your round", status (role status) "Loading your round", with the main area busy (`:350-365`).
- Regions: card region "Card" and ticket scroller group "Ticket" (`:737-743`) [web Tab stop].
- Fields: "Class" `{class}`; "Card" `{nn} / {total}` in Classic, otherwise `{nn}`, where total is the number of cards dealt, so a 7-card pool shows "04 / 07"; "Gate" as above, or "Closed".
- Applies-to line: visible `{appliesTo}`, sr "Applies to {appliesTo}" (`BoardingPass.tsx:207-215`). It is never truncated.
- Stub (aria-hidden as a whole): `{CODE} → {SEC} · {class}`, "Card {nn}", "← False", "swipe to board", "True →".
- Intent stamps: "True" (check icon) and "False" (cross icon).
- Pills: "False" (cross), "True" (check), "Next card", "See results" (trailing "→").
- Slip: "The answer is" with "True" or "False"; stamp "Correct", "Not quite", or "New best" with sr prefix "Correct. "; source link visible `{source.title}` and "→", label "{source.title} (opens in a new tab)" (`BoardingPass.tsx:485-495`) [web]. Native label (decided, spec 5.6): "{source.title} (opens in browser)".
- Stub stamps (Timed): "Correct", "Not quite", "Time is up". Hints: "Next card coming up", "Wrong, saved for review at the end", "This card doesn't count · {n} answered".
- Status announcements (role status):
  - Classic, Streak, Lives: `verdictText`, "{Correct|Not quite}. The answer is {True|False}." plus " New best." (Streak only, when the answer takes the streak one past a stored best of at least 1, `:446`). Then `roundStatus` follows after a space: "Life lost, {n} left.", "Last life.", "Out of lives.", "Streak ended at {n}." Nothing after a right answer, or in Classic.
  - Timed: "Correct." or "Not quite." during the stamp; "Time is up. This card doesn't count." at time up.
  - Timed card announcer (polite, atomic, outside the card), from card 2 until time up: "Card {n}. Applies to {appliesTo}. {statement}". The middle part appears only when appliesTo is set, and the statement is plain text.
  - While the sheet is open, both regions keep the text they had when it opened, and release it 150 ms after it closes.
- Header labels:
  - Classic: "Card {i} of {T}." then e.g. " Cards 1 and 2 correct, card 3 wrong." (`flightPathLabel`).
  - Streak (`streakLabel`):
    - "Streak of {n} correct answer[s]." or "Streak ended at {n}.";
    - with a best of at least 1: "... Your best on this route is {b}.", ", equal to your best on this route." or "... New best on this route, previous best {b}.".
  - Lives (`livesLabel`):
    - "{left} of 3 lives left. No cards answered yet.";
    - "{left} of 3 lives left. {n} card[s] answered[, cards ... was/were wrong].";
    - "No lives left. The round is over after {n} cards: {cards} was/were wrong.".
  - Timed (`timedLabel`): "{s} second[s] left of 60. {c} correct, {w} wrong." or "Time is up. {n} card[s] answered: {c} correct, {w} wrong."
- `cardList`: "card 3", "cards 1 and 2", "cards 1, 2 and 5".
- Load failure: `h1` "This deck didn't load", body "Check your connection and try again.", pill "Try again".

**Leave sheet** (`LeaveDialog.tsx`)
- Title "Leave round?". Body before the decision: "Your answers so far stay in your history. This round won't count toward your best." Body once decided: "This round is over and its score is kept. Leaving skips its result."
- Status: the decided body, only when the round became decided while the sheet was open.
- Buttons "Keep playing" and "Leave round". It is a modal dialog labelled by the title and described by the body.

**Result** (`ResultView.tsx`, `resultCopy.ts`, `ScoreBlock.tsx`, `MissedCards.tsx`)
- X "Close results". sr `h1` "Round complete". Actions "Play again" and "Choose another route".
- Per mode:

  | Mode | Fields | Score label / unit | Best text | Label row (bold word, detail) | Header label |
  |---|---|---|---|---|---|
  | Classic | Class `{name}`, Cards `{nn} / {dd}`, Wrong `{ww}` | "Your score" / "of {dealt}" | "{record} / {dealt}" | "Arrived", " · {n} of {dealt}" | `completedLabel`: "Round complete. {n} of {dealt} cards. {c} correct, {w} wrong." or "...: {cardList}." |
  | Streak | Class, Cards `{nn}`, Wrong `{ww}` | "Correct in a row" / none | "{record}" | "Ended", " · {n} card(s)" | "Streak over on card {n}. {score} correct in a row. Card {n} was wrong." |
  | Three lives | Class, Correct `{cc}`, Wrong `{ww}` | "Your score" / "cards" | "{record} cards" | "Out of lives", "" | "Out of lives after {n} cards. {c} correct, {w} wrong[: {cardList}]." |
  | Timed | Class, Time "60 s", Answered `{nn}` | "Correct" / "of {n}" | "{record}" | "Time is up", " · {n} card(s)" | "Time is up. {n} card(s) answered in 60 seconds. {c} correct, {w} wrong[: {cardList}]." |

  - The right side of the label row is "{c} correct · {w} wrong".
  - Streak rings the mark at the previous best (`previousBest - 1`) when the best is at least 1 and no more than the score.
  - "card(s)" means "1 card" or "{n} cards".
- Comparison (`ScoreBlock.tsx:62-94`):
  - "First round on this route";
  - a "New best" stamp over "Previous best {best(prev)}";
  - "Equals your best" over "Best {best(b)}";
  - "{by} short of your best" over "Best {best(b)}".
- Missed cards:
  - heading "Missed cards", count "{n} to review";
  - caption "Card {nn}" and "You said {True|False}";
  - the appliesTo line (sr "Applies to ..."), then the statement;
  - "Answer {True|False}", with the word in ink, not red;
  - "Why" button with label "Why, card {nn}", which expands a region with the explanation and the source link "{title} (opens in a new tab)" [web]; natively "{title} (opens in browser)".
  - Empty state: "No missed cards" in a section labelled "Missed cards".

---

## 5. Design tokens, fonts, motion, accessibility

### 5.0 Token source and override table

`design/system/tokens.json` (DTCG) is the source. The web already generates CSS from it (`scripts/build-tokens.ts` -> `src/tokens/build.ts` -> `app/tokens.css`). Natives may generate Swift and Kotlin constants the same way, but **tokens.json carries stale values that the code overrides**. A generator must apply this table, so the build fails loudly instead of baking in a stale value.

| Token | tokens.json value | Code value (wins) | Evidence |
|---|---|---|---|
| `size.max-width` | 390 (tokens:1707) | 430 (frame max width) | `app/globals.css:43,48` |
| `color.*.sky-1..4` (descriptions) | hard bands 0-22 / 22-48 / 48-76 / 76-100% (tokens:481, 598 and siblings) | one smooth vertical gradient with stops at 0 / 35 / 62 / 100% (colours unchanged) | `components/SkyBackdrop.tsx:15-17` |
| `motion.transition.sheet-open` | 420 `land` spring from translateY(104%) (tokens:3056) | 360 ms `ease`, y +24 -> 0 and opacity 0 -> 1; reduced: opacity only, 140 ms | `components/play/LeaveDialog.tsx:143-146` |
| `motion.transition.sheet-close` | 360 ease back to translateY(104%) (tokens:3068) | 360 ms `ease`, y 0 -> +24 and opacity -> 0; reduced: opacity, 140 ms | `LeaveDialog.tsx:145-146` |
| `motion.spring.land` (description "and the sheet rising") | spring (tokens:2938) | the sheet uses no spring | `LeaveDialog.tsx:146` |
| scrim timing | (spring with the sheet) | opacity 360 ms `ease` both ways | `LeaveDialog.tsx:124-131` |
| `size.sheet-overrun` 72, `size.sheet-bar` 68, `size.grab` 40, `size.list-row` 56, `size.radio` 24, `stroke.radio` 2 | tokens:1883, 1875, 1891, 1867, 1899, 2047 | unused. The sheet is a floating card: padding 20, radius 16 on all corners, inset by the 16 gutter, sitting `safe-bottom` above the bottom, minimum width 320, frame max width 430 | `LeaveDialog.tsx:136, 142` |
| `motion.duration.board` 460, `motion.transition.pass-board` | tokens:2840, 3158 (marked unused) | Start round unrolls an empty paper: `scaleY` 0 -> 1 from the top, 360 ms `ease` | `components/FillInPass.tsx:318-322, 523-534` |
| `color.focus-on-fill`, `stroke.focus` 3 | amber ring, 3 px (tokens:586/698, 2031) | ink ring, 2 px, offset 2 (inset -2 on the pass fields and the ticket) [web] | `app/globals.css:36-48, 113-116` |
| `typography.tagline` (description "colour ink-muted") | ink-muted (tokens:830) | `ink` (also the S6 line) | `StartFlow.tsx:372-374, 983` |
| `typography.step-title` line height | 1.27 (tokens:806) | a 36 px row, text centred vertically, on start-flow titles only; "Leave round?" and "This deck didn't load" keep 1.27 | `StartFlow.tsx:369-371`, `LeaveDialog.tsx:151`, `PlayScreen.tsx:377` |
| `typography.screen-title`, `body-small`, `option-title`, `section-code`, `sheet-title` | defined (tokens:783, 1230, 1299, 1369, 1536) | unused by the app (35 roles defined, 30 used) | grep of `components/` and `app/` |
| `typography.stamp` size | 24 | slip stamp 24; stub stamp **28**; result New best **22** | `Stamp.tsx:66`, `ScoreBlock.tsx:43` |
| `typography.body` 15.5 / 1.45 | explanation role | missed-card explanation **15** / 1.45; missed answer word Sans 800 **17** | `MissedCards.tsx:74-78` |
| `typography.carrier-title` / `carrier-label` | 16 / 12 | compact band **14** / **11** | `FillInPass.tsx:106, 109` |
| (no role) | n/a | source link Mono 600 **13.5**; score unit Mono 600 **20** ink-muted; Timed clock Mono 600 **13** tabular; card stub value Mono 600 **16** / 1.27; card detail lines Sans 600 16 / **1.25**; continue-line deck name line height **1.2** | `BoardingPass.tsx:490`, `ScoreBlock.tsx:115`, `TimedPath.tsx:56`, `DestinationCard.tsx:96,100`, `ContinueLine.tsx:69` |
| `size.safe-top` / `safe-bottom` | 52 / 34 | 52 / 34, but **8 / 12 under 568 tall** | `app/globals.css:57-62` |
| `size.start-top-zone` (description mentions a "step 7") | 176 | 176. There is no step 7: Start round hands over to Play | `StartFlow.tsx:772-774` |
| `motion.spring.snap` (card snap-back) | t3 + spring curve | CSS transition on `transform`: 360 ms with `cubic-bezier(.34,1.56,.64,1)` after **every** release, a committed swipe included; instant with reduced motion | `PlayScreen.tsx:755`, `useSwipe.ts:56-62, 118-125`, `globals.css:123-131` |

A missing colour in the map's table: `surface-sunk-clear`, `#eef3f5` at alpha 0 by day and `#1d2636` at alpha 0 at night. It is the start of the 28 px missed-list fade (`MissedCards.tsx:258-261`).

### 5.1 Colour roles

| Role | Day | Night |
|---|---|---|
| sky-1 / sky-2 / sky-3 / sky-4 | #a9d6f0 / #c4e3f5 / #ddeff8 / #f3f0e6 | #0b1528 / #101c33 / #15233d / #1c2538 |
| surface (= sky-2) | #c4e3f5 | #101c33 |
| surface-raised | #fdfbf5 | #252f41 |
| surface-sunk | #eef3f5 | #1d2636 |
| surface-sunk-clear | #eef3f5 at 0 | #1d2636 at 0 |
| ink (also the focus colour) | #10233f | #e6e3da |
| ink-muted | #56667c | #9ba4b3 |
| rule (decorative) | #c9d3dc | #3c4759 |
| accent | #f5b400 | #e0a52c |
| on-accent | #10233f | #141c2b |
| true | #1d5cc0 | #6f9ae0 |
| false = wrong | #b3321c | #e2836f |
| correct | #0d7250 | #55b88e |
| on-dark | #fdfbf5 | #0f1a2c |
| cloud (at 0.7 opacity) | #ffffff | #2c3a55 |
| scrim | #10233f at 0.32 | #000000 at 0.6 |
| press | #10233f at 0.05 | #e6e3da at 0.06 |

**Sky.** A smooth gradient at 0 / 35 / 62 / 100% of the viewport height (`SkyBackdrop.tsx:16-17`). The backdrop spans the full viewport. The two clouds sit in px inside the 430 frame:
- upper: 150x46 at (-30, 196);
- lower: 170x50 (the same 150x46 path, stretched) at right -40, top 620, or 660 in the start flow (`SkyBackdrop.tsx:7, 28-49`).

**Theme.** The theme follows the system until the switch is pressed (3.8 and 6).

### 5.2 Fonts and licences

- **Fonts:** Overpass 600 and 800, and Overpass Mono 400 and 600, as static cuts. Request weight 600 explicitly. The web body sets 600 (`globals.css:103`), and a native default would fall back to a system Regular.
- **Where the native files come from (gap).** The repo has only `app/fonts/*.woff2` (`app/layout.tsx:13-28`), subset to Google's latin range plus U+2190 to U+2193. iOS and Android need TTF or OTF.
  - Source the full static cuts from the upstream Overpass release, or instantiate them from the Google Fonts variable files at 600/800 and 400/600 (DS:99).
  - Check the coverage in 2.2.
  - Scan the files with the hygiene rules before committing (8.4).
- **Font licence:** SIL OFL 1.1, "Copyright 2021 The Overpass Project Authors" (`app/fonts/OFL.txt:1`). Ship the text inside each bundle; OFL needs no UI.
- **Code:** MIT. **Cards:** CC BY 4.0 by EienMosu (`tests/publish-files.test.ts:8-30`).
- **Native mapping:** iOS `UIAppFonts`, Android `res/font` (DS:99).

### 5.3 Type roles

tokens.json defines **35** roles; 30 are used. "Normal" line height is about 1.27 in Chrome; pin 1.27 or derive it from the font metrics. Letter spacing is given in em at the role's own size; tokens.json stores px, and the generated CSS keeps px, so a role drawn at another size keeps its px value.

| Role | Spec | Used for |
|---|---|---|
| logo | Sans 800 36 / 1, -0.025em | "Truthy" on S1 |
| step-title | Sans 800 22, -0.015em; in a 36 px row on start-flow titles, line height 1.27 on "Leave round?" and "This deck didn't load" | step titles, "Leave round?", "This deck didn't load" |
| tagline | Sans 600 17 / 1.4, **ink** | S1 tagline, S6 line |
| card-statement | Sans 600 25 / 1.28, -0.012em | statement |
| card-name | Sans 800 26 / 1.2, -0.015em | area, platform, class and "Whole deck" names |
| deck-code | Mono 600 30 / 1.2, 0.02em | deck and section codes on cards |
| answer-label / answer-value | Sans 600 13 / 1.2 ink-muted; Sans 800 26 / 1.27, -0.01em | "The answer is" / True or False |
| stamp | Sans 800 24 / 1.27, -0.01em (variants 28, 22) | stamps |
| button / button-quiet / button-back | Sans 800 20 / 16 / 15, 1.27, -0.01em | pills / quiet / Back |
| carrier-title / carrier-label | carrier-title Sans 800 16 (14) / 1.27, -0.01em (-0.16 px, kept at 14 on the compact band); carrier-label Mono 600 12 (11) / 1.27, 0.06em, uppercase | band |
| leg-code / leg-name | Mono 600 34 / 1, 0.02em / Sans 600 12 / 1.25 ink-muted | legs |
| field-label / field-value / field-value-pass | Mono 400 10.5, 0.04em / Mono 600 15 / Sans 800 16 / 1.2 (pass codes Mono 600 16, 0.02em) | grids |
| pass-line | Sans 600 13 in a 22 px row, ink-muted; the dot in `rule` | "Cloud · AWS" |
| body | Sans 600 15.5 / 1.45 | slip explanation, sheet body, the S1 and P1 load-failure bodies ("Check your connection and try again.") |
| list-title | Sans 600 16 / 1.25 (the token says 1.2, which is never applied), -0.01em | every destination-card detail line: deck, section, Whole deck and class (class in ink-muted) |
| list-statement | Sans 600 16 / 1.38, -0.005em | missed statement, "No missed cards" |
| emphasis | Sans 800 16 / 1.27 (1.2 on the continue line) | comparison line, continue deck name, "The decks didn't load" |
| score | Mono 600 48 / 1, 0.02em (unit Mono 600 20, tracking 0) | score |
| intent-stamp | Mono 600 26, 0.02em | drag preview |
| mono-data / mono-data-strong / mono-caption / route-label | Mono 400 12 / Mono 600 13 / Mono 400 11, 0.04em / Mono 400 11 (numbers 600) | small data |

The only uppercase text is the band label ("BOARDING PASS", "YOUR PASS").

### 5.4 Geometry and breakpoints

- **Frame:**
  - max width 430, minimum layout width 320 (the page scrolls sideways below that [web]), gutter 16;
  - safe areas 52 top and 34 bottom, or 8 and 12 under 568 tall.
  - **Natively** (decided, spec 5.6): top and bottom padding are max(system inset, 52 top / 34 bottom) on screens 568 or taller, and max(system inset, 8 / 12) on shorter ones; side padding is the 16 gutter plus the side inset. This settles DS open question 4 (DS:543).
- **Breakpoints** (`globals.css:27-34`):
  - **`tight`, under 600 tall:** the S6 ready offset becomes 112 - 24 = 88.
  - **Result `shortLegs`, 600 tall or less** (`max-height: 600px`, note: inclusive, `BoardingPass.tsx:93`): leg names become sr-only and the legs row is 8/8 padded.
  - **`short`, under 568 tall:** start and result scroll as one column, the top zone sizes to its content, the foot zone follows the list, the Play stage stops at the top of the action row, and the frame may scroll.
- **Sizes:**
  - header 56, pill 60, quiet and Back pill 48, round button 48, actions row 64;
  - carrier 44 (compact 30), pass line 30, statement minimum 188, stub and slip 228, barcode 76;
  - ticket inset 20;
  - notch r12, card notch r7;
  - card stubs 64 (place) and 80 (deck, section, class);
  - card minimum heights: place 104, deck 128, section 90, class 108, unavailable 84;
  - continue line 60 (icon disc 44, logo mark 26);
  - progress track 56x8;
  - touch minimum 48.
- **Radius:** card 16, small 8, pill 30, pill-small 24, tick 2.
- **Strokes:**
  - rule 1.5;
  - horizontal perforation 2, dash 7/5;
  - vertical card perforation 1.5, dash 5/5;
  - progress track 2, dash 4/4;
  - stamp 3 double (two 1 px lines, 1 px gap) on the verdict, stub and New best stamps; 3 solid on the intent stamps (`BoardingPass.tsx:330-334`);
  - quote rule 2.
- **Opacity:** disabled 0.45.
- **Start-flow layout:** the main area starts 20 below the top zone, with a 36 px title row, then the list with margin 8 top and -8 sides, padded 6 top, 8 sides and 24 bottom (`StartFlow.tsx:1078`). The foot zone sits 16 from each side and `safe-bottom + 4` from the bottom (DS:151-160).
- **Targets:** the route-pass words keep a 48x48 hit area, extended 13 up and down and at least 48 wide. The Deck, Section and Class fields under them are 43 tall as targets, which the owner accepted (DS:161). Check this against 44 pt and 48 dp natively.

### 5.5 Shadows (tokens elevation, all with negative spread)

| Shadow | Day | Night |
|---|---|---|
| ticket (ticket; also the ready pass, carried by the unrolling paper while it unrolls, `FillInPass.tsx:484, 527`) | `0 1 0 0` ink 0.06 + `0 22 36 -18` ink 0.45 | black 0.2 + black 0.75 |
| small (round button, Back pill, destination cards, fill-in pass in the destination and route stages) | `0 1 0 0` ink 0.1 + `0 6 12 -6` ink 0.4 | black 0.2 + black 0.6 |
| button (60 px pills; none while a pill is dimmed, `disabled` or `aria-disabled`, `PillButton.tsx:27-28`) | `0 1 0 0` ink 0.1 + `0 10 18 -10` ink 0.55 | black 0.2 + black 0.7 |
| press (pill pressed) | `0 1 0 0` ink 0.1 | black 0.2 |
| sheet (the leave card) | `0 -1 0 0` ink 0.06 + `0 -18 36 -18` ink 0.45, pointing up | black 0.2 + black 0.75 |

- **SwiftUI:** draw each shadow from a shape inset by the spread, then offset and blur it.
- **Compose:** `Modifier.dropShadow` needs Compose UI 1.9 or later; otherwise use `drawBehind` with a blurred paint (DS:528).

### 5.6 Icons and shapes

Port the path data in `components/icons.tsx:9-31` unchanged (`ICON_PATHS`, 19 entries). Strokes are in viewBox units, so they scale with the drawn size.

| Icon | Box and stroke |
|---|---|
| cross | 16 box. Close: 16 at 2.4. Stroke 3 at 16 (False pill, intent stamp), 18 (slip Not quite stamp), 20 (stub Not quite stamp) |
| check | 18 box, stroke 3. Drawn at 18 (True pill, intent stamp), 22 (slip Correct stamp), 24 (stub Correct stamp) (`Stamp.tsx:45, 91`) |
| backHeader / backPill | 18x16 at 2.4 (unused on screen; only the pill variant is drawn, `StartFlow.tsx:796`) / 18 at 2.2 |
| forward | 40x16 at 2 (unused on screen) |
| chevronRight / chevronDown | 16 at 2.2 / 12 at 1.8 |
| planeArrow | in an amber r12 disc, stroke 2 |
| carrierCloud | 22x16, filled |
| skyCloud | 150x46 |
| book | 18 at 1.6 |
| replay | 18 at 2.2 |
| routeCurve | 20x14, stroke 1.8, dash 2/3, plus two r2 circles |
| clockHands | 22, plus an r8 circle at 2.4 |
| star | 18 box, filled. Drawn at 20 on the slip New best stamp and 18 on the result New best stamp (`ScoreBlock.tsx:56`) |
| heart / heartSlash | 22 box |
| moon | 18 at 2 |
| sunRays | 18, plus an r3.3 circle at 2 |

Strokes use round caps and joins, except:
- the book: round join, butt caps (`icons.tsx:176`);
- the route icon: the curve has a round cap and no join set, the two circles set neither (`icons.tsx:194-196`);
- the waypoint tick and x (`FlightPath.tsx:159, 166`) and the Lives trail crosses (`LivesPath.tsx:160-165`): butt caps, miter joins.

Closed circles and rings set no cap or join either, which does not show.

Shapes to build natively:
- **Logo** (`Logo.tsx:5-8, 31-42`): the ticket, a dashed tear line (`M33 5v20`, 1.6, dash 2.5/3, round cap), and a check.
  - Full mark: accent ticket, with the tear line and the check in on-accent (check stroke 3). 44 wide beside the wordmark, 26 on the continue line (`ContinueLine.tsx:59`).
  - Compact mark (compact pass band, 20 wide, `FillInPass.tsx:104`): on-accent ticket, accent check at stroke 3.4, no tear line.
- **Ticket and card notches, perforations, stamp double border:** DS:509-519.
- **Android:** VectorDrawable cannot dash, so draw the logo tear line and the route icon in Compose code.

### 5.7 Motion (code values)

Curves (`components/easing.ts`):

| Curve | Value |
|---|---|
| ease | (.2, .7, .2, 1) |
| ease-out | (0, 0, .58, 1) |
| ease-in | (.42, 0, 1, 1) |
| fall | (.5, 0, .9, .4) |
| spring-ease (web) | (.34, 1.56, .64, 1) |

Native springs (damping 0.6, DS:429-433):

| Spring | SwiftUI | Compose |
|---|---|---|
| snap 360 | `.spring(response: 0.33, dampingFraction: 0.6)` | `spring(0.6f, 360f)` |
| land 420 | response 0.39 | stiffness 265 |
| land-fast 300 | response 0.28 | stiffness 515 |

Feed the release velocity into the snap-back spring.

| Element | Motion | Source |
|---|---|---|
| Press | round button scale 0.92; Back pill 0.96; pills move 2 down, scale 0.98, take the press shadow; cards, quiet button and continue line 0.98 (continue line also takes the `press` fill); pass ways back take the `press` fill. 120 ms ease | `RoundButton.tsx:16`, `StartFlow.tsx:792`, `PillButton.tsx:23-26`, `DestinationCard.tsx:220`, `QuietButton.tsx:15`, `ContinueLine.tsx:133`, `FillInPass.tsx:86` |
| Drag | card `translateX(dx) rotate(dx/18 deg)`; `intent = clamp(dx/110,-1,1)`; intent stamp opacity `intent x 1.6` (capped at 1), rotated -7 (True, left) and +7 (False, right), at top 64; the stub drops `abs(intent) x 7` and turns `intent x 2deg` about (20%, 0) | `PlayScreen.tsx:81-85`, `BoardingPass.tsx:323-334, 416-437` |
| Release (any outcome) | the card and the stub pull spring back to 0 (snap). **A committed swipe does not throw the card** | `useSwipe.ts:118-125`, `PlayScreen.tsx:755`, `BoardingPass.tsx:379` |
| Tear (Classic, Streak, Lives) | stub to (-40, 360, -18deg) when correct, (40, 360, 18deg) when wrong, whatever the swipe direction; 460 `fall`, opacity 460 ease-in. The stub enters from y +12, opacity 0, over 220 ease | `BoardingPass.tsx:302-315`, `PlayScreen.tsx:686` |
| Slip stamp lands | from opacity 0, scale 1.9, -14deg to opacity 1, scale 1, **-6deg**; 420 ms, delay 380, spring-ease | `Stamp.tsx:41-43`, `easing.ts:15-17` |
| Jolt | the main part of the ticket goes y 0 -> 2 -> 0 at times 0 / 0.4 / 1 over 260 ms ease; delay 420 (slip), 120 (Timed beat), 240 (time up), 420 on a result New best | `BoardingPass.tsx:65-68`, `PlayScreen.tsx:773-774`, `ResultView.tsx:179` |
| Action rows | the answer row leaves to y +12 with opacity 0 (220 ease); the Next row enters from y +12, opacity 0, over 220 ease, **delay 360**. The answer row returns from y +12 on a new card | `PlayScreen.tsx:816-847` |
| Timed beat | stub stamp 300 ms spring-ease from scale 1.9 (delay 0; "Time is up" delay 120); pills dim to 0.45; hold 700 counted on ticks; the card leaves to x ±120% with rotation ±8deg toward the answered side (220 `fall`, opacity ease-in); the next card comes from y +14, opacity 0, over 280 ease | `Stamp.tsx:79-96`, `PlayScreen.tsx:148-157, 688, 764` |
| Plane | opacity transition 220 ease when its card is answered | `FlightPath.tsx:255` |
| Life lost | slash `pathLength` 0 -> 1 over 300 ms ease, delay 380; opacity snaps on at 380 | `LivesPath.tsx:60-82` |
| Timed plane | glides with `remainingMs` | `TimedPath.tsx:46-47` |
| Why | chevron rotates 180 over 220 ease; the row grows 0 -> full over 360 ease; a 2 px quote rule beside the explanation; scroll into view after 380 ms | `MissedCards.tsx:184-202` |
| Leave sheet | scrim opacity 360 ease; card y +24 -> 0 with opacity, 360 ease (reverse on exit) | `LeaveDialog.tsx:124-147` |
| Ticket scroll | Timed: smooth scroll to the stub on stamp and back up for the next card; other modes: smooth scroll to the slip when it is not fully above the action row (`slipScroll`); a new card scrolls instantly (`statementScroll`) | `PlayScreen.tsx:489-544` |
| Start: step forward and back | dir is 1 forward and -1 back. The panel leaves (opacity 0, y -10 x dir: it rises forward and sinks back) over 140 ease-out; the title leaves over 80 ease-out; items enter from y 24 x dir (from below forward, from above back) over 240 ease, delay 110 plus 25 per item. Every back clears name travel. Natively the back motion is the same, written as a function of progress p (7.2 item 4) | `StartFlow.tsx:230-245, 602-610` |
| Start: top and foot zone swap | enter from y ±12 with opacity 0 over 240 ease, delay 120; leave over 110 ease (logo moves -12, pass and foot items +12) | `StartFlow.tsx:253-267, 777, 782, 840, 854` |
| Start: theme switch | y 32 <-> 0 over 240 ease; opacity 0 over 110 at Start round | `StartFlow.tsx:815-822` |
| Start: name travel | a scaled overlay copy moves from the chosen card's name into its pass field, 300 ms ease after 60 ms (translate and scale only; skipped when the typeface changes, e.g. the class becoming Mono on the ready pass) | `StartFlow.tsx:269, 574-587, 729-741, 1135-1150` |
| Start: blank dashes | out over 100 ease-out, delay 120; back over 140 ease, delay 220 | `FillInPass.tsx:131-132` |
| Pass layout change | band 30 -> 44 and body height over 360 ease; old block out over 120 ease-out; new block in over 220 ease, delay 90; values travel as two cross-fading copies (old gone by 60%, new in from 40%) | `FillInPass.tsx:379-385, 441-468, 488-495`, `passValueTravel.ts` |
| Start round | Back pill and theme switch fade over 110; the empty paper unrolls (`scaleY` from the top) over 360 ease; then Play opens | `StartFlow.tsx:784-789`, `FillInPass.tsx:523-534` |

**Name travel.** Animate a scaled overlay copy. `matchedGeometryEffect` and `sharedElement` re-lay out `Text` instead of scaling it (DS:530).

### 5.8 Reduced motion (corrected)

- **Detection:** `accessibilityReduceMotion` on iOS. On Android, `Settings.Global.ANIMATOR_DURATION_SCALE == 0` (DS:465). That setting also makes Compose end every animation at once, so on Android the fades below run with a `MotionDurationScale` of 1 (spec 5.1).
- **Web mechanism** [web]: every CSS animation and transition becomes instant (`globals.css:123-131`). Motion-driven elements branch explicitly.
- **Opacity fades that remain under reduced motion** (the map wrongly said everything jumps):

  | Element | Fade | Source |
  |---|---|---|
  | Slip | in, 140 | `BoardingPass.tsx:468-470` |
  | Stub | in 140, out 100 | `BoardingPass.tsx:317-321` |
  | Answer row and Next row | 220, no delay, no movement | `PlayScreen.tsx:827-841` |
  | Leave sheet card | 140 (the scrim stays at 360) | `LeaveDialog.tsx:143-146` |
  | Start-flow step panel | out 100, in 140 after a 90 delay | `StartFlow.tsx:247-251` |
  | Top and foot zone swaps | the same 100 / 140 after 90 | `StartFlow.tsx:254-260` |
  | Fill-in pass block cross-fade | out 100, in 140 after 90; the paper height and band switch at once and no value travels | `FillInPass.tsx:382-383, 441-442` |

- **Instant or at rest:**
  - stamps (shown at rest), jolt, tear (replaced by the fade above);
  - the Timed card swap (the card changes at once, `PlayScreen.tsx:764`);
  - the heart slash (drawn at rest);
  - name travel, unroll (Play opens at once, `StartFlow.tsx:705-706`), theme switch move;
  - CSS-driven items: card snap-back, stub pull, Why row and chevron, plane fade, band and body height;
  - scrolls become instant; the Why scroll waits 50 ms.
- **The Timed plane steps once per second** instead of gliding (`TimedPath.tsx:43-47`).
- **Unchanged:** focus moves to Next at once instead of at 420 ms, but Enter and presses still wait for 420. The guards (250, 420, 1000) and the 700 hold do not change.

### 5.9 Accessibility

- **Contrast gate:** body text 4.5, large text 3, non-text 3, in both themes. Port the pairs in `tests/tokens/contrast.test.ts` as a native unit test. Decided exceptions: the tagline and the S6 line are `ink`, and the focus ring is `ink`, never amber.
- **Colour is never the only signal:**
  - stamps pair an icon with a word;
  - waypoints use a circle with a tick against a square with an x;
  - hearts use fill against outline plus slash;
  - buttons pair an icon with a word;
  - the missed answer word is ink;
  - the "now" field uses ink dashes and a 600 label;
  - Time is up has a clock stamp, Gate "Closed" and the hint.
- **One image per header.** Each header is one image with a full-sentence label (4.5). Reuse the strings exactly.
- **Live regions:** the status (role status), the Timed card announcer (polite, atomic, outside the card), the fill-in pass body (polite), and the leave-sheet status. The Play status and the Timed card announcer keep their text while the sheet is open and release it 150 ms after it closes (`PlayScreen.tsx:454-468`). The pass body is never under the sheet, and the leave-sheet status is live inside the sheet (`LeaveDialog.tsx:161-163`).
  - **Natively:** iOS `AccessibilityNotification.Announcement`. Android `semantics { liveRegion = Polite }`, or `announceForAccessibility` for the one-shot texts.
- **Swipe alternatives:** the True and False buttons are a full alternative (WCAG 2.5.1). Natives add custom actions "Answer true" and "Answer false" on the card (DS:483).
- **Lists and groups:** lists are announced as lists. Unavailable and dimmed cards and the dimmed continue line are labelled disabled groups, not buttons.
- **Decorative parts:** the stub is hidden from screen readers entirely (`BoardingPass.tsx:370`). So are the legs' empty arrow column, the band, the barcode and the label rows.
- **Dynamic Type:** every fixed height is a minimum. At 200% text grows or scrolls and never clips. The orientation is not locked (`app/manifest.ts` has no `orientation`).

---

## 6. Persistence

| Web key | Format | Native equivalent |
|---|---|---|
| `truthy.progress.v1` (localStorage) | JSON `Progress` (3.5) | A file `truthy.progress.v1.json` in Application Support (iOS) or `filesDir` (Android, `AtomicFile`). Not UserDefaults or DataStore: the value grows with up to 7378 card entries and is rewritten whole. |
| `truthy.progress.v1.unreadable` | the raw stored value, kept aside | A sibling file `truthy.progress.v1.unreadable.json`. Before **every** save (`local.ts:29-38, 44-48`), if the stored raw value is not null **and** `readProgress(raw).whole` is false, **and** the side copy does not already equal it, write the side copy. A single dropped entry counts, and so does a missing `last` key. Nothing stored reads as whole, so it makes no copy. If that write fails, skip the main write too. The copy holds the latest unreadable value only. |
| `truthy.theme` | raw `"light"` or `"dark"`; anything else or absent means follow the system | UserDefaults on iOS or SharedPreferences on Android, same key. Read it before the first frame: `preferredColorScheme` or `overrideUserInterfaceStyle` on iOS, `AppCompatDelegate.setDefaultNightMode` on Android. One press flips the **theme visible now** (system-resolved when there is no choice) and stores the result (`theme.ts:108-113`). Nothing removes the key, so there is no way back to "system". The page flips even when the store fails. |
| `truthy.pending.v1` (sessionStorage) | `{route, mode}` | State handed to the round screen when the top-level screens swap (7.1). Not persisted. |
| `truthy.return.v1` [web] | return mark, max age 10 s | none. The S1 title takes accessibility focus when the player returns from Play by a control. |
| `truthy.index.v1`, `truthy.deck.<id>` [web] | deck caches | none with embedded decks |
| Cache Storage `truthy-shell-*` [web] | service worker | none |

Save rules (port exactly):
1. **Start screen load:** prune the history of every played deck against its current ids, and save only when the number of entries changed (`useCatalog.ts:64-69, 140-145`).
2. **Round start, before dealing:** load, prune the round's deck, save, then deal from the pruned history (`useRound.ts:177-183, 195`).
3. **Result shown:** record exactly once per round. The comparison is computed from the stored progress before the write (`ResultView.tsx:50-81`).
4. **Leave:**
   - Run `saveLeftRound` whenever `leavesSomething` is true: there are answers, or the round is decided. A round with no answers that is not decided saves nothing.
   - Not decided: abandon. The answers go into the card history, no record is set, and `last` becomes this route and mode with `score: null, total: null`, so the Continue line offers it without a score (`progress.ts:57-75`, `leave.ts:20-23`, `StartFlow.tsx:847`).
   - Decided: record as the result would.
   - On the web this also runs on unmount and `pagehide` [web] (`PlayScreen.tsx:264-309`). Decided (spec 4.5): natively each answer is also written to a round journal (`truthy.round.v1.json`); a journal found at launch is applied with these leave rules and deleted. Rounds are never resumed.
5. **Every save is a whole read-modify-write.**
6. **Storage failures never surface.** Play continues with empty progress, or with the parts that still read.

Versioning:
- `version: 1` is literal.
- Every release must read what the previous release wrote, or move to `.v2` with a migration.
- Both platforms write the same JSON shape. Keep `at` and `lastSeenAt` as integer epoch ms.
- SPEC:83 says the progress interface exists so natives can put "iCloud key-value storage or Play Games behind the same contract". A local file behind a store interface is compatible with that. A sync backend is out of scope (spec section 3).

Backups (decided, spec 4.5):
- Application Support and `filesDir` are backed up by default; backups stay on.
- On Android, declare `backup_rules.xml` and `data_extraction_rules.xml` explicitly, as The Slow Wire does: include the progress file and the theme, exclude the round journal.

---

## 7. Web-only items and native mapping

### 7.1 Mapping table

| Web item | Native decision |
|---|---|
| Service worker, shell cache, silent update at a safe moment, kill switch, `OfflineStart`, `goToStart` full-page load, `FULL_LOAD_WAIT_MS`, `RETURN_MAX_AGE_MS` [web] | Omit. Store updates replace them. |
| Deck fetch, 8 s timeout, `INDEX_REFRESH_MS` 1500, "Needs a connection", offline Continue line, "The decks didn't load" [web] | Omit: the decks are embedded (decided, spec D3). Keep the copy in the string table. |
| `navigator.onLine` [web] | Omit. |
| `history.pushState` per step, `history.go(-n)`, reload rewind, `popstate` validation [web] | Model the start flow as **one screen with a step stack in state** (3.7). Do **not** push a navigation destination per step: the steps animate in place, with the pass morph and name travel, and a system push transition would replace that motion. Decided (spec 5.2): the app has two top-level screens, Start and Play, **swapped in place** on both platforms right after the 360 ms unroll, as the web replaces start with play. No `fullScreenCover`, no `NavigationStack`, no navigation library. Leaving Play shows Start at step 1 with its choices cleared. |
| `pagehide`, `pageshow`, bfcache, unmount save [web] | Save on leave. Decided (spec 4.5): a round journal survives a killed app and is applied at launch (6, save rule 4). After process death the app opens at start step 1 with no choices, as a web reload does (spec 5.6). |
| `visibilitychange` pausing Timed [web] | Decided (spec 5.6): send `visibility(hidden: true, at: epochMs)` only when the app goes to the background (iOS scene phase `.background`, Android `ON_STOP`) and `hidden: false` when it returns, as the web pauses only when the page is hidden (`useRound.ts:81-87`). Control Center, the notification shade and the app's own sheet do not pause it. |
| `Date.now` (answers, Timed) and `performance.now` (guards) [web] | Two clocks, see 7.3. |
| `crypto.getRandomValues` seed [web] | `UInt32.random(in: .min ... .max)`, or `SecureRandom().nextInt().toLong() and 0xFFFFFFFFL`. |
| Pointer events, `touch-pan-y`, pinch cancel, pointer capture [web] | See 7.2. A second pointer during a drag cancels the gesture and springs the card back (`useSwipe.ts:80-85`). Positions are in window coordinates, and the 24 edge zone is measured from the **window edges** (`useSwipe.ts:89`). |
| Keyboard (arrows answer, Enter is the action, Escape is close or back, held-key suppression, ticket scrolling with arrows, Page Up and Down, Home and End, Space; Shift+Space scrolls up; Alt, Ctrl and Meta are ignored) [web] (`PlayScreen.tsx:629-675`, `ticketScroll.ts:41-54`) | Decided (spec section 2, hardware keyboard), on iPad and Android hardware keyboards: the arrows answer; Return is the action after an answer; Escape is the X on Play (Keep playing while the sheet is open) and one step back on Start (consumed and doing nothing on step 1, so on Android it does not fall back to Back); a held key acts once. The ticket scrolling keys are not ported. |
| `aria-live`, `inert`, `SPOKEN_RELEASE_MS` [web] | Announcements and live regions (5.9). The platform sheet makes the leave card modal (7.2 item 7). The Play status and the Timed card announcer hold their text while the sheet is open and release it 150 ms after it closes. |
| Focus ring, Tab order, Ticket as a Tab stop [web] | Accessibility focus only. No visible ring natively, unless a hardware keyboard drives focus. |
| Source links `target=_blank`, "(opens in a new tab)" [web] | Decided (spec 5.6): the in-app browser. iOS: `SFSafariViewController` presented from the top view controller. Android: Custom Tabs with `CustomTabColorSchemeParams` from the app's theme. Spoken label "{source.title} (opens in browser)" (4.5). |
| Text selection of the explanation in the answered phase (`select-text`) [web] | Decided (spec section 2, text selection): none natively. No text is selectable, the slip explanation included; selecting it is a web-only affordance. |
| CSS notches, dashes, masks, `theme-color`, manifest, PWA install, 404, security headers [web] | `Path` with arcs and dash `StrokeStyle` or `PathEffect`; a gradient mask for the list fade; the status bar follows the app's theme (dark icons by day, light at night; Android edge-to-edge); an app icon composed like `app/apple-icon.png` and `public/icon-512.png`: the `app/icon.svg` mark at 60 percent width (`app/manifest.ts:24`), centred on an opaque flat square in day `sky-1` `#a9d6f0` (decoded from both files in this audit; spec 5.6 uses the same value); a launch screen in `color-surface` of the system appearance (`#c4e3f5` day, `#101c33` night; spec 5.6). Omit the PWA, 404 and headers. |
| VectorDrawable dash limit (Android) | Draw the logo tear line and the route icon in Compose code. |
| Hidden scrollbars, `overscroll-behavior: none` and `contain` [web] | Native scroll views. See 7.2 on overscroll. |

### 7.2 Native gestures and platform feel [native]

These follow from the owner's instruction that the ports must feel native, not like a webview. Each item names the web fact it must preserve. Section 5 of the design spec (`2026-10-14-truthy-native-apps-design.md`) decides the native behaviour; where this list and the spec differ, the spec wins.

1. **The card drag must share the screen with a vertically scrolling ticket.** On the web the card claims only horizontal pans; vertical pans scroll the ticket (`touch-pan-y`, `PlayScreen.tsx:754`). Decided (spec 5.3):
   - iOS: a `UIPanGestureRecognizer` subclass bridged with `UIGestureRecognizerRepresentable` (iOS 18). Its `touchesBegan` records the touch-down sample (window location, `UITouch.timestamp`) before any slop; `touchesMoved` and `touchesEnded` append samples from the touches, coalesced touches included; a second touch cancels it. `gestureRecognizerShouldBegin` claims only horizontal-dominant movement. It is attached to a stationary container, and the card's offset lives inside it (a recognizer on the moving view reports drifting translations). `simultaneousGesture` is not used: on iOS 26.5 it blocks the scroll view.
   - Android: `pointerInput` on a stationary container inside the ticket's `verticalScroll`, with the card's translation and rotation applied by a `graphicsLayer` inside that container. `awaitFirstDown(requireUnconsumed = false)` records the touch-down sample; `awaitTouchSlopOrCancellation` then consumes only horizontal-dominant movement, so the parent `verticalScroll` keeps vertical drags. Not `detectHorizontalDragGestures`: it reports only after the slop, so it cannot give the touch-down sample.
   - Positions are in window coordinates, and the 24 edge zone is measured from the window edges.
   - `interpret` still decides the outcome from the samples: its `|dy| > |dx|` rule cancels.
2. **The first sample is the touch-down point and time.** `canStart` checks the settle time and the edge zone on that sample (`useSwipe.ts:88-90`).
   - This is why the drag is not a SwiftUI `DragGesture`: it reports its first `onChanged` only after `minimumDistance`, and its `Value.time` is a **`Date` (wall clock)**. Keep every sample of one gesture on one monotonic base (7.3).
3. **Following and release.** The drawn offset is the current x minus the touch-down x, slop included, so the card never lags the finger. On release the card springs back with the release velocity (`snap`). A commit tears the stub in Classic, Streak and Three lives. It never throws the card.
   - A touch on a card that is still springing back catches it at its offset c: during that gesture the drawn offset is c + dx, while `interpret`, the intent stamp and the threshold haptic use dx alone. The web instead repaints from the new touch-down point (`useSwipe.ts:88-93, 113`), so the card jumps to the finger.
4. **Back.** On Android, gesture navigation reserves both side edges (`WindowInsets.systemGestures`), and predictive back animates from them. The web ignores touches that start within 24 of the window edge, and natively a touch inside the system gesture inset never reaches the app. On iOS nothing is pushed, so there is no system pop; the leading-edge pans below are the app's own.
   - Start flow (decided, spec D8 and 5.1): every back (the iOS leading-edge pan, and on iOS 26 and later a rightward pan anywhere on a step; Android predictive back; the Back pill; a pass field; Escape) uses the web's own back motion (dir = -1: the old panel sinks 10, the new items drop in from 24 above, the cleared pass fields return to dashes, no name travel), written as a function of progress p so a gesture can scrub it. A gesture always goes back exactly one step. A jump of several steps (a pass field, or "Change platform" on the recent path) plays the same back motion over time. Choices are cleared only when a back completes; a cancelled gesture changes nothing. On step 1 back goes to the system (Android back-to-home). During the 360 ms unroll every back is consumed.
   - Round (decided, spec D4 and 5.2): Android predictive back and an iOS leading-edge pan shrink the round surface slightly with the progress (spec: scale 1 to 0.94, pivot at the centre) and on release do what the X does: leave at once with no answers, otherwise open the leave sheet. On the result screen back does what Close results does, after the 1000 ms guard. On loading it leaves at once. While the leave sheet is open it means Keep playing. The web leaves silently [web]. The iOS edge pan does not compete with the card, which ignores touches that start within 24 of the window edge.
5. **Press feedback** (decided, spec 5.6): the web's per-control press on both platforms: round button 0.92, Back pill 0.96, pills 2 px down plus 0.98 plus the press shadow, cards and the quiet button 0.98, all over 120 ms `ease` (5.7). The `press` tint only on the pass fields and the continue line. iOS: `ButtonStyle`s reading `configuration.isPressed`. Android: `collectIsPressedAsState` driving a `graphicsLayer`; the pass fields and the continue line show a bounded ripple in the press colour, and every other control has no indication.
6. **Scrolling:**
   - Use native scroll views for the step lists, the ticket, the result column and the missed list. Keep the programmatic scrolls in 5.7 (`ScrollViewReader.scrollTo`, `ScrollState.animateScrollTo`).
   - The web disables overscroll [web]. Decided (spec 5.6): native bounce on iOS and stretch on Android 12 and later.
   - Start-flow lists fade the bottom 28 when more content lies below (`listCue`).
7. **Leave confirmation.** On the web it is a custom floating card over a scrim (DS:529). Decided (spec 5.4): the platform sheet provides the behaviour (swipe down, scrim, back, accessibility) with a transparent container, and the app draws the web's floating card inside it.
   - iOS: `.sheet` with a measured `.height` detent and the grabber hidden. On iOS 26 and later the card fills the inset system sheet and takes its corner radius.
   - Android: Material3 `ModalBottomSheet` with a transparent container.
   - Swiping down, the scrim and back mean "Keep playing", like Escape.
   - The web ignores a scrim tap for 250 ms after it opens (`LeaveDialog.tsx:55-57, 132-134`), so the second tap of a double tap on the X cannot close it. Spec 5.4: a UI test double-taps the X on each platform, and the guard is added to the scrim tap if the sheet closes.
8. **Haptics and sound.** The web has none and the design system says nothing about them. DS principle 5 (DS:19) is about motion only. Decided (spec D5, 5.5): a light impact on crossing the 90 commit line (iOS `.impact(weight: .light)`, Android `GESTURE_THRESHOLD_ACTIVATE`); on the verdict `.success` or `.error` (iOS) and `CONFIRM` or `REJECT` (Android); at time up `.warning` (iOS) and `REJECT` (Android). No haptic for moving back under the line. No sound.
9. **Theme and status bar.** Apply the stored theme before the first frame (6). Update the status bar style with the theme.
10. **Dynamic Type and orientation.** See 5.9. Rotating must not reset the round.

### 7.3 Clocks (settled)

| Purpose | Web | Native |
|---|---|---|
| `answer.at`, `lastSeenAt`, Timed `tick.now`, `visibility.at` (one shared clock) | `Date.now()` (`useRound.ts:69`, `useClock.ts:18-21`, `PlayScreen.tsx:588`) | epoch ms, integer |
| Settle (250), Next arrival (420), result arrival (1000), scrim settle (250), start-flow settle | `performance.now()` (`useRound.ts:70`, `StartFlow.tsx:66`, `LeaveDialog.tsx:27`) | iOS: `CACurrentMediaTime()` or `ProcessInfo.systemUptime`, the same base as `UITouch.timestamp`. Android: **`SystemClock.uptimeMillis()`**, the base of `MotionEvent.eventTime` and Compose `PointerInputChange.uptimeMillis`. Not `elapsedRealtime`, which the map suggested: it would mix bases with the touch timestamps |
| Swipe samples | monotonic minus input-event age (`useSwipe.ts:46-50, 73-76`) | the event's own timestamp on the base above |
| Timed ticker | `setInterval` 100 ms | a 100 ms timer that **keeps firing during scroll tracking**: iOS `Timer` in `RunLoop.Mode.common` or a display link; Android a coroutine `delay` loop or `withFrameNanos`. Each tick may count at most 1000 ms, so ticks that stall for more than a second lose real time |

---

## 8. Repo integration

### 8.1 Layout (decided, spec 4.1; The Slow Wire precedent checked in `ai-news` by the map author)

```
truthy/
  native-data/                 # generated by `pnpm export:native`, committed
    manifest.json              # source hashes, the fixed deck index version, generator version
    decks/                     # index.json (fixed version) and the 54 deck files, card order kept
    tokens/                    # tokens.json copy, overrides.json, resolved.json (overrides applied)
    golden/                    # golden vectors computed by the TypeScript code, one file per function
  scripts/export-native.ts     # writes native-data/
  scripts/native-token-overrides.json  # hand-kept from the 5.0 table
  tests/native-data.test.ts    # drift gate
  ios/
    .gitignore                 # xcuserdata/, *.xcuserstate, build/, DerivedData/, .swiftpm/, .build/
    TruthyEngine/              # Swift package: the pure engine, tested with `swift test`
    Truthy/                    # Xcode app project, depends on TruthyEngine
      Truthy.xcodeproj         # objectVersion 77 (synchronized groups), deployment target iOS 18.0, bundle id com.eienmosu.Truthy
  android/
    Truthy/                    # one Gradle project, own .gitignore (/build, local.properties, .gradle, .cxx, *.iml)
      engine/                  # :engine, pure Kotlin JVM module, tested with `./gradlew :engine:test`
      app/                     # :app, Compose; namespace and applicationId com.eienmosu.truthy;
                               # minSdk 26, targetSdk 36, compileSdk 37; depends on :engine
        src/main/res/font/     # overpass_600.ttf, overpass_800.ttf, overpass_mono_400.ttf, overpass_mono_600.ttf
```

- **Decks** come from `native-data/decks` in place: an Xcode folder reference on iOS, a Gradle `assets` source directory on Android. Nothing is copied.
- **Golden vectors** live in `native-data/golden`. Swift engine tests find the folder from `#filePath`; the Gradle `:engine` test task passes it as a system property computed at build time, never written into a committed file (spec 4.1).

Root `.gitignore` additions, following the precedent: `android/**/.idea/`, `android/**/.gradle/`, `android/**/.kotlin/`.

**Exporting golden data (decided, spec D6 and 4.3).** `native-data/` is generated and committed, and `tests/native-data.test.ts` re-runs the export in memory and compares it with the committed files (decks, tokens, every golden vector), so a stale export fails the web tests. The vectors cover every function and constant in 3.9 except `entriesBehind` and the browser storage adapter, each with its inputs, outputs and every pinned case of its web test file. Cases worth naming:
- `deal` vectors with options (`count`, `avoid`, `before`, `budget`);
- `dealChunk` vectors with `createRng(base + k)` and with `chunkSeed`;
- round event traces, including Timed tick, visibility and answer sequences on one clock;
- swipe boundary tables;
- `readProgress` cases (partial, legacy `last`, missing `last`, `__proto__`, non-finite numbers).

### 8.2 `vercel.json`

- Today `vercel.json` has only `$schema` and `regions: ["fra1"]`. `tests/publish-files.test.ts:33-38` pins the keys to `["$schema", "regions"]`; the same commit that adds `ignoreCommand` must extend that pin.
- The Slow Wire uses:
  ```json
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- ':!ios' ':!android'"
  ```
- `HEAD^` compares only the last commit. Decided (spec 8): `"ignoreCommand": "git diff --quiet ${VERCEL_GIT_PREVIOUS_SHA:-HEAD^} HEAD -- . ':!ios' ':!android' ':!native-data'"`, which compares against the previously deployed commit and falls back to `HEAD^` when the variable is empty. `native-data/` is excluded from deploys because the Vercel build never reads it; the web CI still runs on it (8.3).
- Without a skip, every native-only commit deploys a new `sw.js` (its version is `<sha>-<build time>`), and every web client runs an update for nothing. Vercel's build runs no tests (`package.json`: `prebuild` builds the tokens, the decks and `sw.js`; `build` is `next build`), so without `':!native-data'` a commit that touches only `native-data/` would deploy and change `sw.js`; the decided command excludes it.

### 8.3 CI

- `.github/workflows/ci.yml:3-6` runs on every push (`branches: ["**"]`) and on pull requests, with no path filter. Decided (spec 8): add `paths-ignore: ["ios/**", "android/**"]` to both triggers, and nothing more. `native-data/**` must still run the web checks, because the drift test (`tests/native-data.test.ts`) and the hygiene test (`tests/repo-hygiene.test.ts`) live there. No test pins the `on:` block.
- Native CI, if the owner adds it later, goes in separate workflow files (the spec plans none). `tests/ci-workflow*.test.ts` reads only `ci.yml`. Any new action must meet the Node 24 major floors pinned in `ci-workflow-polish.test.ts`.
- A required check skipped by a path filter never reports. Do not make the web check required for native-only merges.
- `tsconfig.json:27` excludes `node_modules`, `content`, `design` and `public`. Add `ios` and `android` if either ever holds `.ts` or `.js`.

### 8.4 Hygiene rules for native files (public repo)

`tests/repo-hygiene.test.ts:11-35` scans every tracked file (`git ls-files`). The pre-push hook (`.githooks/pre-push` -> `scripts/pre-push.ts`) scans the added lines, file names, messages and binary blobs of pushed commits, plus the author and committer e-mail. Both use `scripts/hygiene.ts`.

- **Identity:** the author and committer e-mail must be the EienMosu GitHub noreply address (`ALLOWED_EMAIL`, `hygiene.ts:8`, checked at `:146-147`). Set it in the clone.
- **E-mail regex trap.** `EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g` (`hygiene.ts:37`) flags any match other than the allowed address. Checked with node in this audit, it matches:
  - File names with a scale suffix after an at sign: an app icon, a `logo` PDF or a `cloud` image named with the `@2x` or `@3x` suffix and an extension, an `.imageset` folder named the same way, and the matching `"filename"` lines inside an asset catalog `Contents.json`. Use scale-free names, for example `AppIcon-1024.png` or `cloud_2x.png`, in asset catalogs.
  - **Kotlin's labelled `this` followed by a member access**, for example the activity's labelled `this` used to reach its `window`. Avoid it, for example with a local `val activity = this`. `return@forEach`, `@Composable`, `@State` and `String(format: "%@.png")` do not match.
- **Paths and secrets** (`hygiene.ts:10-36`):
  - absolute local paths (`/Users/`, `/home/`, `/root/`, `/Volumes/`, `/mnt/<x>/Users`, `/private/tmp`, `/private/var`, `/var/folders`);
  - home-relative paths into the Desktop, Documents or Downloads folders;
  - `claude-<digits>`;
  - Windows user paths;
  - encoded `-Users-<name>-` folder names;
  - AWS keys, GitHub tokens, `sk-`, Slack, `AIza`, GitLab, npm, Stripe live and `GOCSPX` keys, Slack webhooks, JWTs, PEM private keys.
  - Check `project.pbxproj`, `*.xcscheme`, `local.properties`, `gradle.properties` and IDE files. `local.properties` and `xcuserdata` must stay ignored.
- **Binary files** (`hygiene.ts:57-61, 64-119`):
  - A PNG is scanned in its tEXt, zTXt, iTXt and eXIf chunks and any bytes after IEND. Strip metadata from exported PNGs.
  - **Any other binary** is scanned as runs of 4 or more printable ASCII characters (`readableRuns`, `hygiene.ts:116-119`). The repo's fonts are compressed woff2. Upstream TTF and OTF name tables can carry copyright, URL and vendor fields, and possibly e-mail addresses. **The scan can miss them:** name records on the Windows platform are UTF-16BE, with a zero byte between letters, so they never form an ASCII run. Before a font is committed, decode its name table (for example `ttx -t name`) and check it against the rules by hand; spec 8 has plan A add UTF-16 run reading. Replace or strip a failing name record (allowed by OFL with a different name only if the RFN rule applies; none is declared, DS:98).
- **Commit messages:** no `Co-authored-by:` and no "Generated with/by" lines (`hygiene.ts:122, 149-151`). Use the `feat:`, `fix:`, `test:`, `docs:` style.
- **Not secrets:** `DEVELOPMENT_TEAM` in `project.pbxproj` is a public team id. The Slow Wire commits it.
- **No em dash anywhere.** This is a convention, not an automated gate today. Spec 8 has plan A add rules against em dashes, signing files by type (`.jks`, `.keystore`, `.p12`, `.mobileprovision`) and PNG files with any text or EXIF chunk.
- **Enable the hook** with `git config core.hooksPath .githooks`. It is not on in this clone today: `.git/config` has no `hooksPath`. It needs `pnpm install` first, because it runs `node_modules/.bin/tsx`.

---

## 9. Risks and traps (ranked)

1. **Dealing parity.** Any of these silently changes the cards dealt:
   - one wrong rng draw: shuffling the whole pool instead of `unshown` in `dealChunk`, or shuffling `comeBack`;
   - an unstable sort;
   - identity comparison instead of id;
   - a single rng for all chunks, or `chunkSeed` used where a vector uses `base + k`;
   - budget accounting off by one;
   - taking the overdue card from file order instead of the ranked list.

   Mitigate with exported golden fixtures run in both native test suites, and with `deal` ported with its full options.
2. **Hygiene leaks in a public repo:** absolute paths in generated project files, image names with a scale suffix after an at sign, Kotlin's labelled `this` followed by a member access, font name tables (UTF-16 records escape the scan), PNG metadata, signing material. Once pushed, every commit is public.
3. **Clock discipline:**
   - Timed: tick, visibility and answer on one wall clock.
   - Guards and swipe samples on the monotonic base that matches the touch timestamps: Android `uptimeMillis`; SwiftUI `DragGesture.time` is a `Date`.
   - A stalled Timed ticker loses time, because of the 1000 ms cap per tick.
4. **Lost answers on process death.** The web saves on pagehide. A killed native app would lose the answers of the round in progress, which changes later dealing. Decided (spec 4.5): a round journal written on each answer, applied at launch with the leave rules (6, save rule 4); the app then opens at start step 1 with no choices.
5. **Record semantics:**
   - A decided round that is left is recorded, including Timed with 0 answers via the X.
   - An equal score is not a new best.
   - A first round with score 0 sets the record.
   - Record exactly once per round.
   - The Streak "New best" slip stamp needs a stored best of at least 1, and appears only in Streak.
6. **Timed lifecycle:**
   - pause only when the app goes to the background (iOS `.background`, Android `ON_STOP`), not on Control Center, the notification shade or the app's own sheet;
   - hiding runs a full tick first, and time up at that moment leaves the clock visible (3.3);
   - the first tick or the first answer arms the clock;
   - the clock keeps running under the leave sheet, and the sheet text switches when the round is decided;
   - the uncounted card on screen at zero;
   - focus moves to See results only if True or False had it.
7. **Gesture conflicts.** System edge gestures and predictive back overlap the 24 edge zone (measured from the window edges). The horizontal card drag must not block vertical ticket scroll: `simultaneousGesture` does on iOS 26.5, and `detectHorizontalDragGestures` loses the touch-down sample (7.2 item 1). A committed swipe springs the card back; it is not thrown.
8. **Wasted web deploys and service-worker churn,** if `ignoreCommand` is missing or uses only `HEAD^`, plus full web CI on native commits (8.2, 8.3).
9. **Stale docs and tokens against the code.** Code wins in each case:

   | Topic | Code | Docs or tokens |
   |---|---|---|
   | Sky | smooth gradient 0/35/62/100 | hard bands (DS:162, tokens descriptions) |
   | Barcode data | `card.id` | "CLF\|SEC\|CLASSIC\|04/10" (DS:519) |
   | Frame width | 430 | 390 (DS:151, tokens:1707) |
   | Leave sheet | floating card, 360 ease, y 24 | bottom sheet, 420 spring from 104%, overrun 72 (tokens:3056, 1883) |
   | Timed hint | "Wrong, saved for review at the end" | "Missed, ..." (plan `10-play-timed.md:87`) |
   | Leaving a decided round | recorded | plan `05-modes.md:38` says it sets no record |
   | Timed hold | 700 | 1000 (mockup; DS:548 closed it) |
   | Azure | 5 decks | "no decks" (SPEC:134, the initial catalog) |
   | Tagline colour | ink | ink-muted (tokens:830) |
   | Card release | springs back always, the stub tears | DS:441 shows snap only "under 90 px" |

10. **Typography fidelity:**
    - Request weight 600 explicitly.
    - Pin line height 1.27, or derive it from the metrics.
    - Strip backticks and use mono at 0.92em.
    - `appliesTo` is never truncated.
    - Native font files must cover the non-ASCII characters in 2.2.
11. **Shadows and the pass morph.** Negative spread has no native equivalent. Name travel needs an overlay copy. The leave card is drawn by the app inside the platform sheet (spec 5.4, 7.2 item 7); no system material may show around it.
12. **Progress file growth and write cost.** Each save rewrites the whole JSON. Write off the main thread, atomically, and keep the unreadable-copy rule.

---

## Audit of the critic

| Critic item | Verdict | Evidence |
|---|---|---|
| F1 Edge zone measured against the screen, not the container | CONFIRMED | `useSwipe.ts:74` (clientX), `:89` (`viewportWidth: window.innerWidth`); `swipe.ts:36-40` (inclusive 24 and w-24) |
| F2 Pins call `deal()` with options that `dealChunk` cannot express | PARTLY | The `{count:10}` pins (`deal-pins-polish.test.ts:72,105`) take the same path as `dealChunk(pool, history, rng, [])` (`deal.ts:19-24` against `:64-87`), pinned equal at `chunks.test.ts:191-196`. But `before` (`deal-pins-polish.test.ts:128-153`), `avoid` (`deal.test.ts:246-258`), `budget` (`search-polish.test.ts:57,81,103,146`) and count other than 10 (`deal-pins-polish.test.ts:190-219`) need `deal()`. Settled: port both (3.2) |
| F3 `rankByPriority` shuffles only `unshown` in `dealChunk`; overdue uses ranked `unshown[0]` | CONFIRMED | `deal.ts:74, 81, 142` (shuffle of the argument), `:180` (`unshown = withinCap ++ overCap`), `:190` |
| F4 35 typography roles, not 30 | CONFIRMED | tokens.json typography has 35 keys; 5 are unused in the code (`screen-title`, `body-small`, `option-title`, `section-code`, `sheet-title`) |
| F5 A token generator would bake in stale tokens.json values | CONFIRMED | tokens:1707 (390) against `globals.css:48` (430); tokens:3056/3068 against `LeaveDialog.tsx:143-146`; tokens:1867-1899 unused; tokens:2840 `board`. The full table is in 5.0 |
| F6 Reduced motion does not jump everything | CONFIRMED | `BoardingPass.tsx:317-321, 468-470`; `PlayScreen.tsx:827-841`; `LeaveDialog.tsx:146`; `FillInPass.tsx:382-383`; `StartFlow.tsx:247-260`; `TimedPath.tsx:43-47` |
| F7 "No haptics or sound per DS principle 5" is unsupported | CONFIRMED | Principle 5 is at DS:19 (the critic said DS:27) and speaks only of motion. A grep for haptic, sound or vibrat in DS and SPEC finds nothing |
| F8 Wrong decision cross-references | CONFIRMED | map:305 cites D5 for system back (D4 is system back, map:605); map:473 and map:547 cite D4 for process death (D3 is mid-round persistence, map:594) |
| F9 Unreadable copy is made on any non-whole read, skipped when already equal | CONFIRMED | `local.ts:44-48`; `progress.ts:148` (null is whole); a missing `last` key is also non-whole (`progress.ts:126-134, 158`) |
| G1 Theme switch missing | CONFIRMED | `ThemeSwitch.tsx:31, 52-71`; `StartFlow.tsx:274, 815-822`; `theme.ts:108-113`; `e2e/theme.spec.ts:91` (no switch on /play) |
| G2 Step 1 `h1` logo, top zone 176 | CONFIRMED | `StartFlow.tsx:774-780`; `Logo.tsx:47-73`; tokens `size.start-top-zone` 176 |
| G3 Escape goes back on the start flow | CONFIRMED | `StartFlow.tsx:653-660`; does nothing on step 1 (`:604`) |
| G4 Fill-in pass stages | CONFIRMED | `FillInPass.tsx:97-114, 135-156, 218-236, 239-267` (`ALL` gives "Whole deck" at `:260`), `:334-376` (columns 0.9/1.45/0.8 at `:342`), `:368` |
| G5 Card details (Recent, section, deck track, class, unavailable) | CONFIRMED | `StartFlow.tsx:901-911, 938-955, 957-980`; `DestinationCard.tsx:107-130, 137-160, 235`; `useCatalog.ts:109-112` |
| G6 Continue line content | CONFIRMED | `ContinueLine.tsx:37-41, 56-114` |
| G7 List fade cue | CONFIRMED | `listCue.ts:10, 33-43`; `StartFlow.tsx:1073-1087`; test `listCue.test.tsx` |
| G8 Start-flow motion values | CONFIRMED | `StartFlow.tsx:231-267`; `FillInPass.tsx:131-132` |
| G9 Unroll blocks everything; Back pill and theme switch fade 110 | CONFIRMED | `StartFlow.tsx:768, 788-789, 818-819` |
| G10 Card field "04 / 10" in Classic, "04" otherwise; "of N" for a small pool | PARTLY | `PlayScreen.tsx:692` confirms the split. A small pool shows "04 / 07" (`pad2` of the dealt count). "of N" appears only in the header label row "Card 4 of 7" (`FlightPath.tsx:358-362`) |
| G11 Per-mode header indicators and their pure helpers | CONFIRMED | `FlightPath.tsx:43-138`; `StreakPath.tsx:36-54`; `LivesPath.tsx:32-60`; `TimedPath.tsx:13-32` |
| G12 Barcode algorithm missing from section 3 | CONFIRMED | `BoardingPass.tsx:251-297` |
| G13 A committed swipe does not throw the card | CONFIRMED | `useSwipe.ts:56-62, 118-125` (reset paints 0); `PlayScreen.tsx:755` (CSS spring transition) |
| G14 Timed beat details | CONFIRMED | `PlayScreen.tsx:774, 805, 832, 547-568`; `AnswerButtons.tsx:24, 33`; `PillButton.tsx:28, 48-55` |
| G15 Stamp landing values and sizes | CONFIRMED | `easing.ts:13-17`; `Stamp.tsx:25-29, 41-43, 66, 87-89`; `ScoreBlock.tsx:40-44` |
| G16 Source links open a new tab with a matching label | CONFIRMED | `BoardingPass.tsx:485-495`; `MissedCards.tsx:206-216` |
| G17 Keyboard scrolling of the ticket; modified keys ignored | PARTLY | `PlayScreen.tsx:657-675` ignores Alt, Ctrl and Meta, but Shift+Space scrolls up and Shift with other keys returns null (`ticketScroll.ts:41-54`) |
| G18 Accessible headings | CONFIRMED | `PlayScreen.tsx:354, 716`; also `ResultView.tsx:170-172` "Round complete" and `PlayScreen.tsx:377-379` "This deck didn't load" |
| G19 X records a Timed round with 0 answers | CONFIRMED | `PlayScreen.tsx:314-321, 616-617`; `leave.ts:10-23`; `progress.ts:57-78` (first round sets the record) |
| G20 Leave sheet scrim and Escape; decided status | CONFIRMED | `LeaveDialog.tsx:57, 62, 89-96, 124-134, 161-163` |
| G21 Missed card rows | CONFIRMED | `MissedCards.tsx:147-220, 258-261` (chevron at t2 220, row at t3 360, quote stroke 2, fade 28) |
| G22 Per-mode result copy; short legs | CONFIRMED | `resultCopy.ts:42-105`; `ResultView.tsx:180`. Nuance: `shortLegs` applies at 600 tall or less (`BoardingPass.tsx:93`, `max-height: 600px`), while `tight` is under 600 |
| G23 Start screen prunes and saves | CONFIRMED | `useCatalog.ts:64-69, 140-145` |
| G24 Progress read details | CONFIRMED | `progress.ts:117-134, 174-186`. Addition: a missing `last` key reads as not whole |
| G25 Timed tick and answer must share the wall clock | CONFIRMED | `useRound.ts:69`; `useClock.ts:18-21`; `PlayScreen.tsx:588`; `round.ts:180`; pinned by `clock-jump-polish.test.tsx:101-106` |
| G26 Missing announcements and labels | CONFIRMED | `PlayScreen.tsx:113-143`; `LeaveDialog.tsx:161-163`; `StartFlow.tsx:892, 907, 949-950, 972-975, 1021`; `ContinueLine.tsx:37-41`; `ThemeSwitch.tsx:31` |
| G27 Icon set of about 20 paths | CONFIRMED | `icons.tsx:9-31` (19 entries); `SkyBackdrop.tsx:28-49` (150x46 and 170x50) |
| G28 Two short-height breakpoints and a 320 minimum width | CONFIRMED | `globals.css:29, 34, 57-62, 89-97`; `StartFlow.tsx:1059` |
| R29 `@2x` asset names trip the e-mail regex | CONFIRMED | `hygiene.ts:37, 47-49`; checked with node: icon, logo and `Contents.json` file names with an `@2x` or `@3x` suffix and an extension. Addition: Kotlin's labelled `this` followed by a member access also matches |
| R30 Raw fonts are scanned as readable runs; TTF source unspecified | CONFIRMED | `hygiene.ts:57-61, 117-119`; the repo has only `app/fonts/*.woff2` (`app/layout.tsx:13-28`) |
| R31 SPEC intent for native progress (iCloud KV, Play Games) not addressed | CONFIRMED | SPEC:83 |
| R32 No drift gate for `native-data/` | CONFIRMED (gap) | No such test exists yet. Decided: `tests/native-data.test.ts` (spec 4.3, 8.1) |
| R33 Swift `sort` stability claim may be outdated | PARTLY | Not verifiable in this session. Recent Swift documentation describes `sort` as stable, but the index tiebreak removes the question at no cost. Kotlin `sortWith` and `sortedWith` are stable |
| Checked-correct: colour table complete except `surface-sunk-clear` | CONFIRMED | `MissedCards.tsx:260`; resolved values in 5.1 |
| Auditor addition A1: chunk vectors seed with `createRng(base + k)`, not `chunkSeed` | NEW | `deal-pins-polish.test.ts:77, 115`; `overdue-boundary.test.ts:35` against `round.ts:72` |
| Auditor addition A2: Android guard and sample clock must be `uptimeMillis`; SwiftUI drag time is a `Date` | NEW | `useSwipe.ts:44-50, 73-76` (samples on the guard clock); platform API bases (7.3) |
| Auditor addition A3: start steps are in-place states; a per-step navigation push would replace the design's motion | NEW | `StartFlow.tsx:3-18, 827-831` |
| Auditor addition A4: 286 source titles carry non-ASCII (• § – ’) | NEW | recount of `content/reviewed` (2.2) |
| Auditor addition A5: the Timed ticker must not stall over 1000 ms | NEW | `round.ts:15, 187-190`; iOS default-mode timers pause during scroll tracking |