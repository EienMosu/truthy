// Golden vectors for the catalog helpers of the start screen (components/start/useCatalog.ts), computed by
// calling the TypeScript functions on the index of ./catalog-fixture.
//
// Two projections keep the files small: a RecentDeck and a ContinueTarget are written with the ids of the area,
// the platform, the deck (and the section) instead of the index objects they carry, and a class table that a case
// closes a class in travels in the case's input as `modeTable` (see withClosedClasses in ./content).
import {
  RECENT_LIMIT,
  continueTarget,
  deckCount,
  decksLabel,
  deckOfCard,
  recentDecks,
  seenPercent,
  withoutRemovedCards,
  type ContinueTarget,
  type RecentDeck,
} from "@/components/start/useCatalog";
import type { DeckIndex } from "@/src/content/schema";
import { emptyProgress, type Progress } from "@/src/progress/progress";
import { CATALOG_INDEX, indexWithAzure, indexWithProDeck } from "./catalog-fixture";
import { withClosedClasses } from "./content";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const CATALOG_TESTS = ["tests/components/start/useCatalog.test.tsx", "tests/components/start/unoffered.test.tsx"] as const;

function catalogFile(name: string, cases: readonly GoldenCase[]): GoldenFile {
  return goldenFile({ module: "components/start/useCatalog", function: name, source: "components/start/useCatalog.ts", tests: CATALOG_TESTS }, cases);
}

// ---------- the catalog ----------

const SEEN = { seen: 1, lastCorrect: true, lastSeenAt: 1 };

function progressWith(partial: Partial<Progress>): Progress {
  return { ...emptyProgress(), ...partial };
}

/** `count` card ids `<prefix><n>`, n from `from`. */
function ids(prefix: string, count: number, from = 0): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${from + i}`);
}

/** A history with this entry for each of these ids. */
function seenCards(cardIds: readonly string[], entry = SEEN): Progress["cards"] {
  return Object.fromEntries(cardIds.map((id) => [id, entry]));
}

function area(id: string) {
  const found = CATALOG_INDEX.areas.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no area ${id}`);
  return found;
}

function deckCountFile(): GoldenFile {
  const cloud = area("cloud");
  const call = (name: string, place: Parameters<typeof deckCount>[0]): GoldenCase => ({ name, input: { place }, output: deckCount(place) });
  return catalogFile("deckCount", [
    call("an area counts the decks of every platform", cloud),
    call("an area without platforms has none", area("devops")),
    call("a platform without decks has none", cloud.platforms[2]!),
    call("a platform counts its decks", cloud.platforms[0]!),
    call("another area with one deck", area("frontend")),
  ]);
}

function decksLabelFile(): GoldenFile {
  return catalogFile(
    "decksLabel",
    [0, 1, 2, 3, 10, 54].map((count) => ({ name: `${count} decks`, input: { count }, output: decksLabel(count) })),
  );
}

function deckOfCardFile(): GoldenFile {
  // The web takes a Set; the vector writes the ids as an array and the case calls the function with a Set.
  const call = (name: string, cardId: string, deckIds: readonly string[]): GoldenCase => ({
    name,
    input: { cardId, deckIds },
    output: deckOfCard(cardId, new Set(deckIds)),
  });
  const decks = ["aws-clf-c02", "gcp-cdl", "gcp-cdl-pro", "nextjs-rendering"];
  return catalogFile("deckOfCard", [
    call("the deck whose id and a dash begin the card id", "aws-clf-c02-t1.1-01", decks),
    call("a card of gcp-cdl", "gcp-cdl-7", decks),
    call("the longest prefix wins: gcp-cdl-pro keeps its own cards", "gcp-cdl-pro-1", decks),
    call("without the longer deck, gcp-cdl-pro-1 belongs to gcp-cdl", "gcp-cdl-pro-1", ["gcp-cdl", "aws-clf-c02"]),
    call("a deck id that only starts with the same letters is no owner", "aws-clf-c02x-1", decks),
    call("a card of a deck the index does not have", "aws-gone-1", decks),
    call("a card id with no dash has no deck", "x", decks),
    call("a card id that is a deck id has no deck: the dash must follow the id", "gcp-cdl", decks),
    call("a card id that starts with a dash has no deck", "-abc", decks),
    call("a short deck id that begins a longer one", "aws-clf-c02-t1.1-01", ["aws", "aws-clf-c02"]),
    call("only the short deck matches", "aws-clf-c03-1", ["aws", "aws-clf-c02"]),
    call("no decks at all", "aws-clf-c02-1", []),
    call("a dash at the very end", "gcp-cdl-", decks),
  ]);
}

function seenPercentFile(): GoldenFile {
  const call = (name: string, progress: Progress, deck: { id: string; cardCount: number }, cardIds?: readonly string[]): GoldenCase => ({
    name,
    input: { progress, deck, cardIds },
    output: seenPercent(progress, deck, cardIds),
  });
  const clf = { id: "aws-clf-c02", cardCount: 92 };
  const clfIds = ids("aws-clf-c02-t1-", 92);
  const removed = seenCards(ids("aws-clf-c02-old-", 10));
  const never = { seen: 0, lastCorrect: false, lastSeenAt: 0 };
  return catalogFile("seenPercent", [
    call("0 (not started) without history for the deck", progressWith({ cards: { "gcp-cdl-01": SEEN } }), clf),
    call("counts entries whose id starts with the deck id and a dash: 46 of 92 is 50", progressWith({ cards: { ...seenCards(ids("aws-clf-c02-t1-", 46)), "aws-clf-c02x-1": SEEN } }), clf),
    call("never reads 0 once a card is seen", progressWith({ cards: { "aws-clf-c02-1": SEEN } }), { id: "aws-clf-c02", cardCount: 500 }),
    call("never more than 100", progressWith({ cards: seenCards(ids("aws-clf-c02-", 5)) }), { id: "aws-clf-c02", cardCount: 3 }),
    call("with the current ids known, removed cards count for nothing", progressWith({ cards: removed }), clf, clfIds),
    call("with the current ids known: 23 of 92 is 25", progressWith({ cards: { ...removed, ...seenCards(clfIds.slice(0, 23)) } }), clf, clfIds),
    call("with the current ids known: 1 of 500 shows 1", progressWith({ cards: seenCards(clfIds.slice(0, 1)) }), { id: "aws-clf-c02", cardCount: 500 }, [...clfIds, ...ids("x-", 408)]),
    call("an entry that was never seen is not counted (prefix count)", progressWith({ cards: { "aws-clf-c02-1": never } }), clf),
    call("an entry that was never seen is not counted (known ids)", progressWith({ cards: { "aws-clf-c02-1": never } }), clf, ["aws-clf-c02-1"]),
    call("a deck with a card count of 0 reads 0 (prefix count)", progressWith({ cards: { "aws-clf-c02-1": SEEN } }), { id: "aws-clf-c02", cardCount: 0 }),
    call("an empty list of current ids reads 0", progressWith({ cards: { "aws-clf-c02-1": SEEN } }), clf, []),
    // Rounding: the share times 100, rounded half up, at least 1 once anything is seen.
    call("1 of 8 is 12.5 and rounds to 13", progressWith({ cards: seenCards(ids("d-", 1)) }), { id: "d", cardCount: 8 }),
    call("3 of 8 is 37.5 and rounds to 38", progressWith({ cards: seenCards(ids("d-", 3)) }), { id: "d", cardCount: 8 }),
    call("7 of 200 is 3.5 and rounds to 4", progressWith({ cards: seenCards(ids("d-", 7)) }), { id: "d", cardCount: 200 }),
    call("1 of 200 is 0.5 and rounds to 1", progressWith({ cards: seenCards(ids("d-", 1)) }), { id: "d", cardCount: 200 }),
    call("29 of 100: 0.29 times 100 is 28.999999999999996 and rounds to 29", progressWith({ cards: seenCards(ids("d-", 29)) }), { id: "d", cardCount: 100 }),
    call("57 of 100: 0.57 times 100 is 56.99999999999999 and rounds to 57", progressWith({ cards: seenCards(ids("d-", 57)) }), { id: "d", cardCount: 100 }),
    call("1 of 3 is 33", progressWith({ cards: seenCards(ids("d-", 1)) }), { id: "d", cardCount: 3 }),
    call("2 of 3 is 67", progressWith({ cards: seenCards(ids("d-", 2)) }), { id: "d", cardCount: 3 }),
    call("1 of 1000 shows 1", progressWith({ cards: seenCards(ids("d-", 1)) }), { id: "d", cardCount: 1000 }),
  ]);
}

function targetIds(target: ContinueTarget | null) {
  if (target === null) return null;
  const { found } = target;
  return {
    route: target.route,
    mode: target.mode,
    found: { areaId: found.area.id, platformId: found.platform.id, deckId: found.deck.id, sectionId: found.section?.id ?? null },
    lastScore: target.lastScore,
  };
}

function continueTargetFile(): GoldenFile {
  const call = (name: string, progress: Progress, index: DeckIndex = CATALOG_INDEX): GoldenCase => ({
    name,
    input: { index, progress },
    output: targetIds(continueTarget(index, progress)),
  });
  const last = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" as const, score: 7, total: 10 };
  const cases: GoldenCase[] = [
    call("leads to the last route and mode, with the score of the last round", progressWith({ last })),
    call("nothing without a last round", emptyProgress()),
    call("nothing when the section is gone", progressWith({ last: { ...last, route: { deckId: "aws-clf-c02", sectionId: "OLD" } } })),
    call("nothing when the deck is gone", progressWith({ last: { ...last, route: { deckId: "aws-saa-c03", sectionId: "ALL" } } })),
    call("keeps the mode of the last round (Streak)", progressWith({ last: { ...last, mode: "streak", score: 13, total: 14 } })),
    call("no score after a round that was left", progressWith({ last: { ...last, score: null, total: null } })),
    call("no score when only one of score and total is known", progressWith({ last: { ...last, total: null } })),
    call("a score of 0 is a score", progressWith({ last: { ...last, score: 0, total: 10 } })),
    call("a whole-deck route of a deck without sections", progressWith({ last: { route: { deckId: "gcp-cdl", sectionId: "ALL" }, mode: "lives", score: 21, total: 21 } })),
    call("the Timed class while it is offered", progressWith({ last: { ...last, mode: "timed", score: 14, total: 17 } })),
  ];
  const timed = progressWith({ last: { ...last, mode: "timed", score: null, total: null } });
  cases.push(withClosedClasses(["timed"], (modeTable) => ({ name: "nothing when the class is not offered (Timed closed)", input: { index: CATALOG_INDEX, progress: timed, modeTable }, output: targetIds(continueTarget(CATALOG_INDEX, timed)) })));
  cases.push(withClosedClasses(["timed"], (modeTable) => ({ name: "another class is still continued while Timed is closed", input: { index: CATALOG_INDEX, progress: progressWith({ last }), modeTable }, output: targetIds(continueTarget(CATALOG_INDEX, progressWith({ last }))) })));
  return catalogFile("continueTarget", cases);
}

function recentIds(played: RecentDeck[]) {
  return played.map((entry) => ({ areaId: entry.area.id, platformId: entry.platform.id, deckId: entry.deck.id, lastSeenAt: entry.lastSeenAt }));
}

function recentDecksFile(): GoldenFile {
  const at = (lastSeenAt: number) => ({ seen: 1, lastCorrect: true, lastSeenAt });
  const call = (name: string, progress: Progress, index: DeckIndex = CATALOG_INDEX, limit?: number): GoldenCase => ({
    name,
    input: { index, progress, limit },
    output: recentIds(recentDecks(index, progress, limit)),
  });
  const azure = indexWithAzure(5);
  const azureCards = Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`azure-az${i}-1`, at(i)]));
  return catalogFile("recentDecks", [
    call("lists nothing without history", emptyProgress()),
    call("gives each deck its area, platform and latest time, newest first", progressWith({ cards: { "aws-clf-c02-1": at(100), "aws-clf-c02-2": at(300), "gcp-cdl-1": at(200), "nextjs-rendering-1": at(50) } })),
    call("keeps catalog order for equal times", progressWith({ cards: { "nextjs-rendering-1": at(5), "gcp-cdl-1": at(5), "aws-clf-c02-1": at(5) } })),
    call("leaves out a deck the index no longer has", progressWith({ cards: { "aws-gone-1": at(900), "gcp-cdl-1": at(1) } })),
    call("lists four at most", progressWith({ cards: azureCards }), azure),
    call("lists as many as asked: 2", progressWith({ cards: azureCards }), azure, 2),
    call("lists as many as asked: 4, the default spelled out", progressWith({ cards: azureCards }), azure, 4),
    call("lists as many as asked: 0", progressWith({ cards: azureCards }), azure, 0),
    call("lists as many as asked: more than there are", progressWith({ cards: azureCards }), azure, 10),
    call("an id that begins another deck's stays apart: only gcp-cdl-pro played", progressWith({ cards: { "gcp-cdl-pro-1": at(10) } }), indexWithProDeck()),
    call("an id that begins another deck's stays apart: both played", progressWith({ cards: { "gcp-cdl-pro-1": at(10), "gcp-cdl-7": at(20) } }), indexWithProDeck()),
    call("the latest time of a deck is the maximum, whatever the order of its cards", progressWith({ cards: { "aws-clf-c02-1": at(500), "aws-clf-c02-2": at(100), "gcp-cdl-1": at(300) } })),
    call("a card id that belongs to no deck is ignored", progressWith({ cards: { x: at(900), "gcp-cdl-1": at(1) } })),
    call("a time of 0 still counts the deck as played", progressWith({ cards: { "gcp-cdl-1": at(0) } })),
    call("fractional times are compared as they are", progressWith({ cards: { "aws-clf-c02-1": at(1.5), "gcp-cdl-1": at(1.25) } })),
    call("a real timestamp", progressWith({ cards: { "aws-clf-c02-1": at(1_790_000_000_000), "gcp-cdl-1": at(1_790_000_100_000) } })),
  ]);
}

function recentLimitFile(): GoldenFile {
  return catalogFile("RECENT_LIMIT", [{ name: "how many decks Recent lists at most", input: null, output: RECENT_LIMIT }]);
}

function withoutRemovedCardsFile(): GoldenFile {
  // The web passes a store and the function calls save when the number of card entries changed. The case
  // gives a store that records the call, and writes it as `saved`.
  const call = (name: string, progress: Progress, cardIds: Readonly<Record<string, readonly string[]>>): GoldenCase => {
    let saved = false;
    const pruned = withoutRemovedCards(progress, cardIds, {
      load: () => emptyProgress(),
      save: () => {
        saved = true;
      },
    });
    return { name, input: { progress, cardIds }, output: { progress: pruned, saved } };
  };
  const clfIds = ids("aws-clf-c02-t1-", 20);
  const played = progressWith({ cards: seenCards(clfIds.slice(0, 10)), records: { "aws-clf-c02/SEC#classic": 7 }, last: { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic", score: 7, total: 10 } });
  return catalogFile("withoutRemovedCards", [
    call("drops the history of cards that are no longer in the deck, and saves", played, { "aws-clf-c02": [...clfIds.slice(10), "aws-clf-c02-new"] }),
    call("keeps the history of cards still in the deck, and saves what was dropped", played, { "aws-clf-c02": [...clfIds.slice(0, 4), ...clfIds.slice(10)] }),
    call("saves nothing when every card is still in the deck", played, { "aws-clf-c02": clfIds }),
    call("saves nothing when no deck's ids are known", played, {}),
    call("a deck with no history changes nothing", played, { "gcp-cdl": ["gcp-cdl-1"] }),
    call("prunes several decks in one go", progressWith({ cards: { ...seenCards(clfIds.slice(0, 3)), ...seenCards(["gcp-cdl-1", "gcp-cdl-2"]) } }), { "aws-clf-c02": [clfIds[0]!], "gcp-cdl": ["gcp-cdl-2"] }),
    call("the records and the last route are kept whatever is dropped", played, { "aws-clf-c02": [] }),
    call("empty progress stays empty and is not saved", emptyProgress(), { "aws-clf-c02": clfIds }),
  ]);
}

export function catalogFiles(): GoldenFile[] {
  return [deckCountFile(), decksLabelFile(), deckOfCardFile(), seenPercentFile(), continueTargetFile(), recentDecksFile(), recentLimitFile(), withoutRemovedCardsFile()];
}
