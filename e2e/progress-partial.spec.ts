import { expect, test } from "@playwright/test";
import { CDL_ID, CLF_ID, CLF_SECURITY, atHome, chooseRoute, expectResult, playRound, startRound, storedProgress, wrongOn } from "./helpers";

test.use({ reducedMotion: "reduce" });

// Review finding U43 (spec section 7): stored progress is read part by part. A value with one bad record,
// one bad card entry and a last route in a mode this build does not know keeps its valid records and
// history through a round, and the raw value is kept under the side key before it is written over.
test("a partly invalid stored value keeps its valid records through a round", async ({ page }) => {
  // Real card ids: the start flow drops the history of cards that are not in their deck any more. The bad
  // entry is a card of another deck, which the round does not touch, so only the partial read can drop it.
  const cardIds = async (deckId: string) =>
    ((await (await page.request.get(`/decks/${deckId}.json`)).json()) as { cards: { id: string }[] }).cards.map(
      (card) => card.id,
    );
  const seenId = (await cardIds(CLF_ID))[0]!;
  const [otherDeckId, badId] = (await cardIds(CDL_ID)) as [string, string];
  const raw = JSON.stringify({
    version: 1,
    cards: {
      [seenId]: { seen: 2, lastCorrect: true, lastSeenAt: 1 },
      [otherDeckId]: { seen: 1, lastCorrect: false, lastSeenAt: 1 },
      [badId]: { seen: -1, lastCorrect: true, lastSeenAt: 1 },
    },
    records: { [`${CLF_ID}/SEC#classic`]: 7, [`${CDL_ID}/ALL#classic`]: 8, [`${CLF_ID}/ALL#classic`]: 7.5 },
    last: { route: { deckId: CLF_ID, sectionId: "SEC" }, mode: "daily", score: 7, total: 10 },
  });

  await page.goto("/");
  await page.evaluate((value) => localStorage.setItem("truthy.progress.v1", value), raw);
  await page.reload();
  await atHome(page);
  // The last route is the part that fails, so there is no continue line; the record still reads.
  await expect(page.getByRole("button", { name: /^Continue/ })).toHaveCount(0);
  await chooseRoute(page, { ...CLF_SECURITY, mode: /^Classic\. Correct answers out of 10 cards\. Your best: 7 of 10\.$/ });
  await startRound(page);

  // Opening the round saves the progress before any answer: the valid parts are what it writes.
  await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("truthy.progress.v1.unreadable"))).toBe(raw);
  const opened = await storedProgress(page);
  expect(opened.records).toEqual({ [`${CLF_ID}/SEC#classic`]: 7, [`${CDL_ID}/ALL#classic`]: 8 });
  expect(Object.keys(opened.cards).sort()).toEqual([otherDeckId, seenId].sort());
  expect(opened.last).toBeNull();

  await playRound(page, CLF_ID, wrongOn(4));
  await expectResult(page, 9);
  await expect(page.getByText("First round on this route")).toHaveCount(0);

  const after = await storedProgress(page);
  expect(after.records).toEqual({ [`${CLF_ID}/SEC#classic`]: 9, [`${CDL_ID}/ALL#classic`]: 8 });
  expect(Object.keys(after.cards)).toContain(otherDeckId);
  expect(Object.keys(after.cards)).not.toContain(badId);
  expect(await page.evaluate(() => localStorage.getItem("truthy.progress.v1.unreadable"))).toBe(raw);
});
