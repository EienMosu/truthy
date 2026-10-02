import { expect, test } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  CONTINUE_CLF_SECURITY,
  atHome,
  atStep,
  chooseRoute,
  expectResult,
  openHome,
  playRound,
  startRound,
  stepTitle,
  storedProgress,
  wrongOn,
} from "./helpers";

test.use({ reducedMotion: "no-preference" });

// Spec section 7: progress lives on the device under one versioned key; storage that is corrupt gives
// empty progress and the game still runs.
test("progress survives a reload", async ({ page }) => {
  await openHome(page);
  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  await playRound(page, CLF_ID, wrongOn(4));
  await expectResult(page, 9);

  await page.goto("/");
  await page.reload();
  await atHome(page);
  // The deck card counts the ten cards seen (10 of 214 is 5 percent).
  await page.getByRole("button", { name: CLF_SECURITY.area }).click();
  await atStep(page, "Choose a platform");
  await page.getByRole("button", { name: CLF_SECURITY.platform }).click();
  await expect(page.getByRole("button", { name: /^CLF, Cloud Practitioner, \d+ cards, [1-9]\d* percent seen$/ })).toBeVisible();

  await page.reload();
  await atHome(page);
  await page.getByRole("button", { name: CONTINUE_CLF_SECURITY }).click();
  await page.getByRole("button", { name: "Back to classes" }).click();
  await expect(page.getByRole("button", { name: "Classic. 10 cards, score at the end. Your best: 9 of 10." })).toBeVisible();
});

const GARBAGE = ["{not json", "null", '{"version":1,"cards":"x","records":[],"last":7}', '{"version":2}'];

for (const [i, garbage] of GARBAGE.entries()) {
  test(`corrupt stored data starts clean and is replaced by the next round (${i + 1})`, async ({ page }) => {
    await page.goto("/");
    await page.evaluate((value) => {
      for (const key of ["truthy.progress.v1", "truthy.index.v1", "truthy.deck.aws-clf-c02"]) localStorage.setItem(key, value);
    }, garbage);
    await page.reload();

    await expect(page.getByRole("heading", { level: 1, name: "Truthy" })).toBeVisible();
    await atHome(page);
    await expect(page.getByRole("button", { name: /^Continue/ })).toHaveCount(0);

    await chooseRoute(page, CLF_SECURITY);
    await startRound(page);
    await playRound(page, CLF_ID, wrongOn());
    await expectResult(page, 10);
    await expect(page.getByText("First round on this route")).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("button", { name: CONTINUE_CLF_SECURITY })).toBeVisible();
  });
}

// Review finding U52 (spec section 7): the seen share counts the deck's current cards. After an update that
// removes the cards a player has seen, the deck reads "not started", and their history is dropped.
test("after a deck update that removes the cards seen, the deck reads not started", async ({ page }) => {
  type Deck = { id: string; hash: string; cards: { id: string; text: { en: { statement: string } } }[] };
  const deck = (await (await page.request.get(`/decks/${CLF_ID}.json`)).json()) as Deck;
  const index = (await (await page.request.get("/decks/index.json")).json()) as {
    areas: { platforms: { decks: { id: string; hash: string; cardCount: number; sections: { id: string; cardCount: number }[] }[] }[] }[];
  };
  const seenIds = deck.cards.slice(0, 10).map((card) => card.id);

  // A player who has seen ten CLF cards: their history, and the deck file on the device.
  await page.goto("/");
  await page.evaluate(
    ({ seenIds, deck }) => {
      const cards = Object.fromEntries(seenIds.map((id) => [id, { seen: 1, lastCorrect: true, lastSeenAt: 1 }]));
      localStorage.setItem("truthy.progress.v1", JSON.stringify({ version: 1, cards, records: {}, last: null }));
      localStorage.setItem(`truthy.deck.${deck.id}`, JSON.stringify(deck));
    },
    { seenIds, deck },
  );
  await page.reload();
  await atHome(page);
  await page.getByRole("button", { name: CLF_SECURITY.area }).click();
  await atStep(page, "Choose a platform");
  await page.getByRole("button", { name: CLF_SECURITY.platform }).click();
  await expect(page.getByRole("button", { name: /^CLF, Cloud Practitioner, \d+ cards, [1-9]\d* percent seen$/ })).toBeVisible();

  // The update: those ten cards removed, one added, a new hash.
  const updated: Deck = { ...deck, hash: "f1b0000000000001", cards: [...deck.cards.slice(10), { ...deck.cards[10]!, id: `${CLF_ID}-new-01` }] };
  const clf = index.areas.flatMap((a) => a.platforms.flatMap((p) => p.decks)).find((d) => d.id === CLF_ID)!;
  clf.hash = updated.hash;
  clf.cardCount = updated.cards.length;
  await page.route("**/decks/index.json*", (route) => route.fulfill({ json: index }));
  await page.route(`**/decks/${CLF_ID}.json*`, (route) => route.fulfill({ json: updated }));

  await page.goto("/");
  await atHome(page);
  await page.getByRole("button", { name: CLF_SECURITY.area }).click();
  await atStep(page, "Choose a platform");
  await page.getByRole("button", { name: CLF_SECURITY.platform }).click();
  await expect(page.getByRole("button", { name: `CLF, Cloud Practitioner, ${updated.cards.length} cards, not started`, exact: true })).toBeVisible();
  const stored = await storedProgress(page);
  expect(Object.keys(stored.cards).filter((id) => seenIds.includes(id))).toEqual([]);
});
