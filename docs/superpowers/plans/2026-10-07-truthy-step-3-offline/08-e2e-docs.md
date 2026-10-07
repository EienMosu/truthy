### Task 8: Offline and updates end to end, the phone check, the documents

The last task proves step 3 the way a player meets it and writes down what was decided. It adds the two end-to-end specs of spec section 11:
- An offline spec: a round online; then, without a network, the game opens and plays; a deck never loaded says it needs a connection; the labels go when the network is back; the game's 404 page still shows. Also two cases of the README's Review Focus: the network dropping in the middle of a round, and the game opened offline in the night theme with its own fonts.
- An update spec: a new release waits; it takes over when the app opens on the start and when the player leaves a round, and never during a round. Also a release that waits when the app next opens without a network (Review Focus).

It adds the phone check and updates these documents: the main spec (sections 3, 4, 5, 9, 10 and 11), the design system (section 8) and the testing note. Then it runs the whole suite. The offline spec's own amendments are its section 14, written with this plan; this task does not change that file.

No application code changes here. If a spec fails on the real code, it has found a defect: fix it in its module with a failing unit test first, and commit the fix on its own.

**How the specs go offline and get a release.** With task 6's kit, the one way every offline spec of step 3 goes offline (check C2, offline spec section 14): each test has its own proxy in front of the production server as its `baseURL`; `goOffline` makes it drop every connection and makes `navigator.onLine` read false with an `offline` event; `net.release(from, to)` makes it serve `sw.js` with a new version string, since neither engine routes the worker's update check through `page.route` or `context.route`. Both specs run in `phone-chromium` and `phone-webkit`, and nothing is skipped. They assert on what the page shows, on `response.fromServiceWorker()` and on `workerState`, never on Playwright's worker events (Chromium only). The phone check is added all the same: no spec runs the game as a home screen app on a real network.

**Files:**
- Create: `e2e/offline.spec.ts`, `e2e/update.spec.ts`
- Modify: `e2e/helpers.ts` (`playRoundWith`)
- Modify (documents): `docs/superpowers/specs/2026-10-01-truthy-design.md` (sections 3, 4, 5, 9, 10, 11), `design/system/DESIGN-SYSTEM.md` (section 8), `docs/testing.md` (a bullet in "Offline and updates", a section "On a phone")

**Interfaces:**
- Consumes:
  - Task 1: `playwright.config.ts` sets `use.serviceWorkers = "block"`; these specs set `"allow"`.
  - Task 3:
    - `public/sw.js` holds the release version (`${commit}-${buildTime}`) as one string literal; its cache is `truthy-shell-<version>`.
    - Install keeps `/`, `/play`, their assets, `SHELL_FILES` and the 404 probe, and does not skip waiting.
    - Activate deletes every other `truthy-shell-*` cache and claims the open pages, on every activation.
    - The message `{ type: "apply-update" }` calls `skipWaiting()`.
    - Pages are network first, with the cached copy as fallback; offline, an unknown path gets the cached 404 page with status 404; `/decks/*` passes to the network untouched.
  - Task 4: `OfflineStart` in `app/layout.tsx`: `start()` registers `/sw.js` and checks for an update; on a page that opened on `/`, a waiting worker is applied and the page reloads once the controller changes (task 4, decision 1: the document's first path, not the pending round).
  - Task 5: `goToStart` sits behind Leave round, Choose another route and Close results. With a waiting worker it applies it and loads `/` in full (`location.replace`).
  - Task 6:
    - Offline, a deck with no copy has the accessible name `${code}, ${title}, needs a connection`, shows "Needs a connection" and is not a button; the continue line of a deck with no copy shows "Needs a connection" and is not a button; both go back to normal on the `online` event.
    - `e2e/offline.ts`: `test` (fixture `net`), `goOffline`, `goOnline`, `waitForWorker`, `workerState`; `e2e/proxy.ts`: `net.release`.
    - `docs/testing.md`, section "Offline and updates".
  - Task 7: the router's full-load fallback when its payload fetch fails offline, and `RETURN_KEY`, which gives the start its step 1 focus after a way back that loads the page (the update path too).
  - `e2e/helpers.ts`: `CLF_ID`, `CLF_SECURITY`, `atHome`, `atStep`, `chooseRoute`, `deckAnswers`, `expectResult`, `expectThemePage`, `openHome`, `playRound` (and its loop), `startRound`, `stepTitle`, `storedProgress`, `wrongOn`.
- Produces:

```ts
// e2e/helpers.ts
export function playRoundWith(page: Page, answers: Map<string, boolean>, choose: (number: number, truth: boolean) => boolean, method?: AnswerMethod, total?: number, from?: number): Promise<Played[]>;
```

**Rules:**

1. **One way to be offline, in both engines**: task 6's `goOffline(page, net)` and `goOnline(page, net)`. No spec of this task calls `context.setOffline`.
2. **Read from the network before going offline.** `deckAnswers` fetches the deck file through Playwright's request context. That context uses the same `baseURL`, and so the same proxy. An offline round therefore reads the answers while online and plays with `playRoundWith`.
3. **What "takes over" means.** The page reads its registration and caches through `workerState`.
   - A release waits while `registration.waiting` is set and both `truthy-shell-<old>` and `truthy-shell-<new>` exist.
   - It has taken over when nothing waits, the page is controlled and only `truthy-shell-<new>` is left (the new worker's activate deleted the old cache).
   - The new version is the old one with `-next` appended. The proxy's rewrite needs nothing from the bundle's shape but the version string itself.
4. **Spec section 11, line by line.** Where the specs below cover each part:

   | Spec section 11 asks for | Covered by |
   | --- | --- |
   | Open `/` online and wait until a worker controls the page; play a round on one deck | Offline spec, test 1: `waitForWorker`, then a Classic round on CLF / SEC |
   | Go offline and reload `/`; the played deck is available and another deck says "Needs a connection" | Test 1: the page is answered by the worker; CLF is a button with its seen share; SAA "needs a connection" and a tap on it does nothing. Test 2: every deck never loaded, and the labels going when the network is back |
   | Play the available deck to its result and check that the record is saved | Test 1: a second round offline (Start round goes through the router's full-load fallback, task 7); 10 of 10; `records["aws-clf-c02/SEC#classic"]` is 10 |
   | Reload `/play` offline | Test 1: a page the worker served deals a new round from the kept deck |
   | An unknown path shows the game's 404 page | Test 1: `/nope` offline, status 404 from the worker, "Page not found" |
   | Serve a changed `sw.js`; the new version takes over when the app opens and when the player leaves a round, and not during a round | Update spec, tests 1 and 2. Test 2 also reloads `/play` while the release waits (a reload of `/play` is not a safe moment), and checks the step 1 title has the focus after the update load |

   More cases:
   - The continue line offline (spec section 8): offline spec, test 3.
   - Spec section 10, "a stored round whose deck has no copy": task 7's spec, in both engines.
   - Review Focus 1, the network dropping during a round (spec section 10): offline spec, test 4.
   - Review Focus 3, a release waiting when the app next opens offline: update spec, test 3.
   - Review Focus 5, the game opened offline in the night theme with its own fonts (spec section 1): offline spec, test 5.

**Tests:**

`e2e/helpers.ts`: `playRound` keeps its signature and hands over to a new `playRoundWith`, which takes answers read beforehand. Replace the head of `playRound`, from its signature to `const played: Played[] = [];`, with:

```ts
export async function playRound(
  page: Page,
  deckId: string,
  choose: (number: number, truth: boolean) => boolean,
  method: AnswerMethod = "buttons",
  total = 10,
  from = 1,
): Promise<Played[]> {
  return playRoundWith(page, await deckAnswers(page, deckId), choose, method, total, from);
}

/** playRound with the deck's answers read before (deckAnswers): the offline specs read them while online. */
export async function playRoundWith(
  page: Page,
  answers: Map<string, boolean>,
  choose: (number: number, truth: boolean) => boolean,
  method: AnswerMethod = "buttons",
  total = 10,
  from = 1,
): Promise<Played[]> {
  const played: Played[] = [];
```

The loop below it, from `for (let number = from; ...` to `return played;`, is unchanged.

`e2e/offline.spec.ts` (new):

```ts
// Spec 2026-10-07, sections 1, 8, 10 and 11: after one visit online the game opens and plays without a network on
// every deck the device holds, a deck it never loaded says it needs a connection, and the labels go when the
// network is back; a round goes on when the network drops in its middle; the game opened offline looks as it does
// online. "Offline" here is the test's proxy dropping every connection (e2e/offline.ts), so the same spec runs in
// Chromium and WebKit.
import { expect, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  atHome,
  atStep,
  chooseRoute,
  deckAnswers,
  expectResult,
  expectThemePage,
  openHome,
  playRoundWith,
  startRound,
  stepTitle,
  storedProgress,
  wrongOn,
} from "./helpers";
import { goOffline, goOnline, test, waitForWorker } from "./offline";

test.use({ serviceWorkers: "allow", reducedMotion: "reduce" });

const CLF_KEPT = /^CLF, Cloud Practitioner, \d+ cards, \d+ percent seen$/;
const SAA_OFFLINE = "SAA, Solutions Architect Associate, needs a connection";
const CLF_OFFLINE = "CLF, Cloud Practitioner, needs a connection";

/** A deck card by its exact accessible name, whatever element carries it. */
function named(page: Page, name: string) {
  return page.locator(`[aria-label="${name}"]`);
}

async function toDeckStep(page: Page): Promise<void> {
  await page.getByRole("button", { name: CLF_SECURITY.area }).click();
  await atStep(page, "Choose a platform");
  await page.getByRole("button", { name: CLF_SECURITY.platform }).click();
  await atStep(page, "Choose a deck");
}

test("after one round online, the game opens offline and plays the deck it kept to a saved record", async ({ page, net }) => {
  test.slow();
  await openHome(page);
  await waitForWorker(page);
  const answers = await deckAnswers(page, CLF_ID);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await playRoundWith(page, answers, wrongOn(3));
  await expectResult(page, 9);

  await goOffline(page, net);
  const opened = await page.goto("/");
  expect(opened?.status()).toBe(200);
  expect(opened?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "Truthy" })).toBeVisible();
  await atHome(page);

  // The deck played online can be chosen; one never loaded says why it cannot, and a tap on it does nothing.
  await toDeckStep(page);
  await expect(page.getByRole("button", { name: CLF_KEPT })).toBeVisible();
  await expect(named(page, SAA_OFFLINE)).toBeVisible();
  await expect(named(page, SAA_OFFLINE)).toContainText("Needs a connection");
  await expect(page.getByRole("button", { name: /^SAA, /, disabled: false })).toHaveCount(0);
  await named(page, SAA_OFFLINE).click({ force: true });
  await page.waitForTimeout(500);
  await expect(stepTitle(page)).toHaveText("Choose a deck");

  // The kept deck to its result, offline: the move to /play and the record.
  await page.getByRole("button", { name: CLF_KEPT }).click();
  await atStep(page, "Choose a section");
  await page.getByRole("button", { name: CLF_SECURITY.section ?? "" }).click();
  await atStep(page, "Choose how to play");
  await page.getByRole("button", { name: CLF_SECURITY.mode }).click();
  await atStep(page, "Your pass is ready");
  await startRound(page);
  await playRoundWith(page, answers, wrongOn());
  await expectResult(page, 10);
  expect((await storedProgress(page)).records["aws-clf-c02/SEC#classic"]).toBe(10);

  // /play opened again offline deals a new round from the kept deck.
  const reloaded = await page.reload();
  expect(reloaded?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();
  await page.getByRole("button", { name: "Leave round" }).click();
  await atHome(page);

  // An unknown address offline: the game's own 404 page, kept by the worker.
  const missing = await page.goto("/nope");
  expect(missing?.status()).toBe(404);
  expect(missing?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
});

test("offline, every deck the device never loaded needs a connection, and the labels go when the network is back", async ({ page, net }) => {
  await openHome(page);
  await waitForWorker(page);
  await goOffline(page, net);
  const opened = await page.reload();
  expect(opened?.fromServiceWorker()).toBe(true);
  await atHome(page);
  // The kept stylesheet draws the day theme offline as online.
  await expectThemePage(page, "day");
  // Areas and platforms are shown as online, with their counts.
  await toDeckStep(page);
  await expect(named(page, CLF_OFFLINE)).toBeVisible();
  await expect(named(page, SAA_OFFLINE)).toBeVisible();
  await expect(page.getByRole("button", { name: /^(CLF|SAA), / })).toHaveCount(0);

  await goOnline(page, net);
  await expect(page.getByRole("button", { name: /^CLF, Cloud Practitioner, \d+ cards, not started$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^SAA, Solutions Architect Associate, \d+ cards, not started$/ })).toBeVisible();
  await expect(page.getByText("Needs a connection")).toHaveCount(0);
});

test("offline, the continue line of a deck with no copy says it needs a connection and is not a button", async ({ page, net }) => {
  await page.addInitScript(() => {
    const last = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: 7, total: 10 };
    if (localStorage.getItem("truthy.progress.v1") === null) {
      localStorage.setItem("truthy.progress.v1", JSON.stringify({ version: 1, cards: {}, records: {}, last }));
    }
  });
  await openHome(page);
  await expect(page.getByRole("button", { name: /^Continue: AWS Cloud Practitioner, Security and compliance, Classic\./ })).toBeVisible();
  await waitForWorker(page);

  await goOffline(page, net);
  await page.reload();
  await atHome(page);
  await expect(page.getByRole("button", { name: /^Continue/ })).toHaveCount(0);
  await expect(page.getByText("Needs a connection")).toBeVisible();

  await goOnline(page, net);
  await expect(page.getByRole("button", { name: /^Continue: AWS Cloud Practitioner, Security and compliance, Classic\./ })).toBeVisible();
});

test("the network drops in the middle of a round: the round goes on to its saved result, and the way back to the start works offline", async ({ page, net }) => {
  await openHome(page);
  await waitForWorker(page);
  const answers = await deckAnswers(page, CLF_ID);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();

  // Spec section 10: nothing changes, the round has its deck in memory.
  await goOffline(page, net);
  await playRoundWith(page, answers, wrongOn(2));
  await expectResult(page, 9);
  expect((await storedProgress(page)).records["aws-clf-c02/SEC#classic"]).toBe(9);

  // Choose another route once the result's actions take presses (ResultView drops pointer-events-none from them
  // when RESULT_ARRIVES_MS has passed). The start's entry is right behind /play, so the way back is a step back in
  // the history, which needs no network.
  await expect(page.getByRole("button", { name: "Close results" })).not.toHaveClass(/\bpointer-events-none\b/);
  await page.getByRole("button", { name: "Choose another route" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toBeFocused();
  await atHome(page);
  await toDeckStep(page);
  await expect(page.getByRole("button", { name: CLF_KEPT })).toBeVisible();
  await expect(named(page, SAA_OFFLINE)).toBeVisible();
});

test.describe("in the night theme", () => {
  test.use({ colorScheme: "dark" });

  test("offline, the start opens in the night theme with the game's own four font faces, as it does online", async ({ page, net }) => {
    await openHome(page);
    await waitForWorker(page);
    await goOffline(page, net);
    const opened = await page.reload();
    expect(opened?.fromServiceWorker()).toBe(true);
    await atHome(page);
    // Spec section 1: offline the pages "look as they do online", in both themes.
    await expectThemePage(page, "night");
    // Each face of the self-hosted fonts loads from the device: a font file the worker did not keep would fail
    // offline and leave the fallback font in its place.
    const faces = await page.evaluate(async () => {
      const own = [...document.fonts].filter((face) => !face.family.includes("Fallback"));
      await Promise.allSettled(own.map((face) => face.load()));
      return own.map((face) => face.status);
    });
    expect(faces).toEqual(["loaded", "loaded", "loaded", "loaded"]);
  });
});
```

`e2e/update.spec.ts` (new):

```ts
// Spec 2026-10-07, sections 2, 7 and 11: a new release downloads in the background and waits; it takes over only
// at a safe moment, when the app opens on the start or when the player comes back to the start from a round, and
// never while a round is open; also when the app opens without a network. The test's proxy (e2e/proxy.ts) serves
// sw.js with a new version string, which is what a deploy does.
import { expect } from "@playwright/test";
import { CLF_SECURITY, atHome, chooseRoute, openHome, startRound, stepTitle } from "./helpers";
import { goOffline, test, waitForWorker, workerState } from "./offline";

test.use({ serviceWorkers: "allow", reducedMotion: "reduce" });

const shell = (version: string) => `truthy-shell-${version}`;

test("a new release waits, then takes over when the app opens on the start", async ({ page, net }) => {
  await openHome(page);
  const first = await waitForWorker(page);
  const next = `${first}-next`;
  net.release(first, next);

  // The load after the deploy finds the release and installs it beside the running one.
  await page.reload();
  await atHome(page);
  await expect.poll(() => workerState(page), { timeout: 20_000 }).toEqual({ controlled: true, waiting: true, caches: [shell(first), shell(next)].sort() });

  // The next opening of the app applies it: the new worker controls the page and the old cache is gone.
  await page.reload();
  await expect.poll(() => workerState(page), { timeout: 20_000 }).toEqual({ controlled: true, waiting: false, caches: [shell(next)] });
  await atHome(page);
});

test("a new release waits while a round is open, also over a reload of /play, and takes over when the player leaves", async ({ page, net }) => {
  await openHome(page);
  const first = await waitForWorker(page);
  const next = `${first}-next`;
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();

  net.release(first, next);
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  const waitingDuringRound = { controlled: true, waiting: true, caches: [shell(first), shell(next)].sort() };
  await expect.poll(() => workerState(page), { timeout: 20_000 }).toEqual(waitingDuringRound);

  // Nothing applies it during the round: not time, not a reload of /play.
  await page.waitForTimeout(1500);
  expect(await workerState(page)).toEqual(waitingDuringRound);
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await workerState(page)).toEqual(waitingDuringRound);

  // Leaving the round is a safe moment: the way back to the start is a full load under the new release, and the
  // start focuses its step 1 title as after any way back from /play (task 7's RETURN_KEY).
  await page.getByRole("button", { name: "Leave round" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(stepTitle(page)).toBeFocused();
  await atHome(page);
  await expect.poll(() => workerState(page), { timeout: 20_000 }).toEqual({ controlled: true, waiting: false, caches: [shell(next)] });
});

test("a release that waits takes over when the app next opens without a network, and the start opens from it", async ({ page, net }) => {
  await openHome(page);
  const first = await waitForWorker(page);
  const next = `${first}-next`;
  net.release(first, next);
  await page.reload();
  await atHome(page);
  await expect.poll(() => workerState(page), { timeout: 20_000 }).toEqual({ controlled: true, waiting: true, caches: [shell(first), shell(next)].sort() });

  // The next opening is on a plane: the page comes from the running worker, applies the waiting release, and the
  // reload it makes comes from the new release's cache, which its install filled completely.
  await goOffline(page, net);
  const opened = await page.reload();
  expect(opened?.fromServiceWorker()).toBe(true);
  await expect.poll(() => workerState(page), { timeout: 20_000 }).toEqual({ controlled: true, waiting: false, caches: [shell(next)] });
  await atHome(page);
});
```

**Documents.** The exact text follows. The anchors are quoted from the files as they are at 5db53f3.

`docs/superpowers/specs/2026-10-01-truthy-design.md`:
- Section 3, step 3: "3. **Polish.** Offline play. The night theme" becomes "3. **Polish.** Offline play, specified in `docs/superpowers/specs/2026-10-07-truthy-offline-design.md`: a service worker keeps the app on the device, and every deck the player has played can be played without a network. The night theme". The rest of the item is unchanged.
- Section 4, "Modules": the table says dependencies only point downwards in it, so the new module goes above the rows that use it, and two rows name what now uses it.
  - Add a row before `src/app-state`:

```markdown
| `src/offline` | The service worker (`src/offline/worker.ts`, built to `public/sw.js` by `scripts/build-sw.ts`), its pure rules (which files the shell holds, what each request gets), its registration and updates, and which decks can be played offline. No React | `content` |
```

  - The `src/app-state` row (`services.ts` holds the offline client since task 4, and `to-start.ts` applies a waiting update since task 5) becomes:

```markdown
| `src/app-state` | What the screens share outside the engine: the table of classes, the round the start flow hands to `/play` (session storage), the theme choice, and the services a screen takes (network, storages, history, the service worker) so its tests run without a browser | `content`, `progress`, `offline` |
```

  - The `components` row (`OfflineStart` imports `src/app-state/services` and `src/offline/register` since task 4) becomes:

```markdown
| `components` | The design system's components | design tokens; `src/meta` for the app name (`Logo`); the engine's constants and types (`LIVES`, `TIMED`, `Answered`) and the progress types they draw (`Comparison`); `src/content/text`, which splits card text into plain and code parts (`CardText`); for `ThemeSwitch` alone, the theme logic and storage type in `src/app-state` and the local storage in `src/progress/local`, because the switch reads and keeps the player's theme choice itself; and, for `OfflineStart`, the services of `src/app-state` and the offline client of `src/offline`, because it starts the service worker and applies a waiting update when the app opens |
```

- Section 5, "Loading": after the paragraph that ends "so a deck update shows up in a later round.", add a new paragraph:

```markdown
Offline (`navigator.onLine` false, followed through the `online` and `offline` events) the start flow offers only the decks the device holds a copy of, of any hash, which is the copy `loadDeck` falls back to; every other deck reads "Needs a connection" and cannot be chosen, and so does the continue line when its deck has no copy. The labels go when the network is back, without a reload. The deck files and the index stay in local storage; the service worker never caches them (offline design, section 8).
```

- Section 9, "Installability": the paragraph becomes:

```markdown
A web app manifest and icons ship in step 1 so the game can be added to the home screen. A service worker ships in step 3 (offline design, sections 6 and 7): after one visit online it keeps the two pages and every file they load on the device and serves them when the network is missing, so the game opens from the home screen without a network and plays every deck the device holds. A new release downloads in the background and takes over without a prompt at a safe moment only: when the app opens on the start, or when the player comes back to the start from a round; never during a round. Without service worker support the game works as before, online only.
```

- Section 10: add these rows after "A route has too few cards for the constraints". These nine rows hold all ten of the offline design's section 10: its rows for the network dropping and for the network coming back are one row here. The stored round row names "Leave round", the control the load failure screen has, as the offline design's section 14 amends its section 10.

```markdown
| No service worker support, or its registration fails | The game works online only, as before step 3. Nothing is shown. |
| The install of a new release fails midway | The release before it stays and keeps serving; the browser tries again on a later visit. |
| Offline on the very first visit | The browser's own offline page. Offline play starts after one visit online. |
| Offline, a deck with no copy on the device | "Needs a connection" on the deck step, and it cannot be chosen. |
| Offline, a stored round whose deck has no copy | `/play` shows the load failure with "Try again"; "Leave round" goes back to the start. |
| The network drops during a round, or comes back | Nothing changes in the round. Back online, the deck step's labels go and the next index fetch refreshes the cached index. |
| A new release is waiting while a round is open | It waits until the next safe moment (section 9, "Installability"). |
| Two tabs are open, one in a round | Applying the update in one tab replaces the worker for both. The worker serves only pages and hashed files, and the other tab keeps the code it loaded, so its round goes on; it gets the new release on its next page load. |
| The device clears the site's storage | Decks, index, progress and the worker's cache go together; the next visit online starts fresh. |
```

- Section 11:
  - The `pnpm test` cell's last sentence, "The purity and import boundaries of the engine, the input rules and the progress rules; dealing in chunks.", gains: " Offline: the files the worker keeps, what it does with each request, its install, activate and update, the safe moments, and which decks can be played offline."
  - The `pnpm e2e` cell's ending, "the Timed clock pausing while the page is hidden; the back gesture in every mode.", becomes: "the Timed clock pausing while the page is hidden; the back gesture in every mode; after one round online, the game opening and playing that deck without a network, a deck never loaded saying it needs a connection, and a new release taking over only when the app opens on the start or the player leaves a round."

`design/system/DESIGN-SYSTEM.md`: task 6 wrote the entries of the two offline states (5.3, 5.4a and the contrast rows of 2.2); they are not repeated here. Section 8, "Screen reader": the line that starts "Cards carry full labels" gains, at its end: ` Offline, a deck the device holds no copy of says why it cannot be chosen: "SAA, Solutions Architect Associate, needs a connection".`

`docs/testing.md`:
- In the section "Offline and updates" (task 6), add a last bullet to its list:

```markdown
- Read what a spec needs from the network before going offline: `deckAnswers` fetches the deck file, so an offline round is played with `playRoundWith(page, answers, choose)`.
```

- Then add a section at the end of the file, after "Offline and updates" (which task 6 put after the last paragraph of "End-to-end specs", the one that starts "A failed test keeps its trace in `test-results/`"), so the run commands, the `E2E_PORT` note and the traces note stay under "End-to-end specs":

```markdown
## On a phone

After a release that changes the service worker, the owner checks on an iPhone in Safari (and, if at hand, Chrome on Android), because Playwright neither runs the game as a home screen app nor turns a real network off:

1. Online, open the game from the home screen icon and play one round on a deck.
2. Turn on flight mode and open the game from the home screen again: the start shows in the chosen theme, the deck played in step 1 can be played to its result, and another deck says "Needs a connection".
3. Turn flight mode off: the labels go without a reload.
4. After the next deploy, open the game from the home screen twice: it runs the new release, with no prompt; a round left open while the release arrives is never interrupted.
```

**Steps:**

- [ ] **Step 1: The helper.** Add `playRoundWith` to `e2e/helpers.ts` as above. Run `pnpm typecheck`. Expected: no output after the command line.
- [ ] **Step 2: Write and run the two specs.** Create `e2e/offline.spec.ts` and `e2e/update.spec.ts`. With the port free (3100, or the one in `E2E_PORT`), Playwright builds and serves:

```bash
E2E_PORT=3718 pnpm exec playwright test e2e/offline.spec.ts e2e/update.spec.ts
```

Expected: `16 passed`, every test in both `phone-chromium` and `phone-webkit` (5 offline tests and 3 update tests), nothing skipped. The behaviour exists since tasks 3 to 7. The first offline test plays two rounds and takes about 35 s per engine; the others take a few seconds each. A failure is a defect: fix it in its module, test first, in its own commit.

- [ ] **Step 3: Prove the specs bite.** Two runs, each with two changes whose failing tests do not overlap. For each run:
  1. Make the two changes in the real modules.
  2. Stop the server on the port. `next start` runs as `next-server`, so stop it by port: `kill $(lsof -tiTCP:3718 -sTCP:LISTEN)`.
  3. Run the command of step 2. The web server rebuilds first.
  4. Restore the files with `git checkout <files>`.

  Nothing from this step is committed. If a test's outcome differs from the list, the spec does not bite where this plan says it does: find out why before going on.
  1. **Apply on any path, and no cached pages.** In `components/OfflineStart.tsx` (`openApp`), delete the line `if (path !== "/") return;`. In `src/offline/worker.ts` (`respond`), replace `return page(request);` with `return null;`. Expected in each engine: 6 failed, 2 passed.
     - Fail at their first page load while offline (`net::ERR_CONNECTION_RESET`, or `net::ERR_EMPTY_RESPONSE` for update test 3, in Chromium; `The network connection was lost.` in WebKit): offline tests 1, 2, 3 and 5, and update test 3.
     - Fails at a `workerState` assertion after the reload of `/play` (the release was applied during the round): update test 2.
     - Pass: offline test 4 (the round and the way back load no page while offline) and update test 1.
  2. **Every deck offered offline, and the update never applied.** In `src/offline/availability.ts`, replace `return new Set(deckIds.filter((id) => cache.read(id) !== null));` with `return new Set(deckIds);`. In `components/OfflineStart.tsx`, replace `if (path !== "/") return;` with `if (path) return;`, and in `src/app-state/to-start.ts` replace `if (services.offline.updateWaiting()) {` with `if (services.offline.updateWaiting() && false) {`. Expected in each engine: 7 failed, 1 passed.
     - Fail on a missing "needs a connection" card or line, or a `toHaveCount(0)` that receives 1: offline tests 1, 2, 3 and 4.
     - Fail at their last `workerState` poll (still waiting, two caches): update tests 1, 2 and 3.
     - Pass: offline test 5.
- [ ] **Step 4: Commit the specs.**

```bash
git add e2e/offline.spec.ts e2e/update.spec.ts e2e/helpers.ts
git commit -m "test: play offline and take a new release end to end in both engines, through the proxy the specs switch offline"
```

- [ ] **Step 5: Update the documents** as listed. Then run `pnpm vitest run tests/repo-hygiene.test.ts tests/readme-polish.test.ts tests/e2e-reduced-motion-polish.test.ts`. Expected: all pass. That means no em dash and no local path, and the two new spec files set `reducedMotion`.
- [ ] **Step 6: The final gate of step 3.** With the port free, run:

```bash
pnpm typecheck
pnpm test
pnpm build
E2E_PORT=3718 pnpm e2e
```

Expected:
- `tsc --noEmit` prints nothing.
- `pnpm test`: `Test Files  147 passed (147)`, `Tests  2340 passed (2340)` (task 7's 147 files and 2338 tests, plus the e2e guard's cases for the two new specs).
- The build lists `/` and `/play` as `○ (Static)`.
- The full e2e run: 686 tests, `684 passed` and `2 skipped`. The skipped tests are the two Chromium-only touch cases of `e2e/swipe.spec.ts` in `phone-webkit`, as on `main`. The 686 are the 646 at 5db53f3 and, in both projects, the smoke spec of task 3 (2 tests), the registration spec of task 4 (3), the labels spec of task 6 (2), the navigation spec of task 7 (5), and this task's offline (5) and update (3) specs. The one known baseline flake of task 1 (`e2e/small-screens.spec.ts:776` in `phone-webkit`) gets the same allowance as there.
- `git status` shows only the files of step 5.

If the machine is heavily loaded, some long jsdom play screen tests can hit Vitest's 5000 ms timeout (`tests/play/leave-decided-polish.test.tsx`, `tests/components/play/PlayScreenResult.test.tsx`). Rerun them alone with `--maxWorkers=1` before you treat a failure as a regression.

- [ ] **Step 7: Commit the documents.**

```bash
git add docs design
git commit -m "docs: offline play and silent updates in the spec, the design system and the testing note, with the check on a phone"
```

**Tried.** Worktree at 5db53f3, with the earlier tasks written from the brief's signatures; Node 24, pnpm 10.34.0, Playwright 1.63.0, macOS. The proxy test failed to load and then passed (4). Offline tests 1 to 3 and update tests 1 and 2 passed in both engines (10), and with task 7's four navigation cases moved onto the proxy, 18 passed in 51 s with nothing skipped. The mutation runs failed the specs they aimed at. The full e2e suite then passed apart from the two WebKit swipe skips. Added after that run, by the review: offline tests 4 and 5 and update test 3 (README, Review Focus), the step 1 focus check in update test 2, the day theme check in offline test 2; the proxy and the fixture moved to task 6, so this task no longer creates them, and task 7's spec uses them from the start. Then the plan as written was run once more in a scratch copy (README, "How this plan is organised"): the two specs passed in both engines (16), and the two mutation runs of step 3 gave exactly the lists above (12 failed and 4 passed; 14 failed and 2 passed). The counts above are for the plan's task order.
