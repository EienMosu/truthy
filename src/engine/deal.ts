// Dealing: which cards a round gets, and in which order (spec section 6, "Dealing").
// Pure: the only source of randomness is the rng passed in.

import type { History } from "@/src/content/play";
import type { Card } from "@/src/content/schema";
import { shuffle, type Rng } from "./rng";

export type { CardHistory, History } from "@/src/content/play";

export const DEAL = { missedPerTen: 3, minTrue: 4, maxTrue: 6, maxRun: 3 } as const;

export interface DealOptions {
  count: number; // how many cards to deal
  avoid?: readonly Card[]; // cards whose conflict groups must not be repeated (unbounded modes pass the last ten; Classic passes nothing)
  before?: readonly boolean[]; // the answers of the cards dealt just before this deal, oldest first: the run limit holds across the join
  budget?: number; // the steps one search may take, SEARCH_BUDGET unless a test sets another
}

export function deal(pool: readonly Card[], history: History, rng: Rng, options: DealOptions): Card[] {
  const cards = uniqueById(pool);
  const size = dealSize(options.count, cards.length);
  if (size === 0) return [];
  return dealRanked(rankByPriority(cards, history, rng, size), size, rng, options);
}

// How a deal is chosen beyond its cards: the conflict groups to keep clear of, the answers just before it,
// the bound on the search and whether an unshown card is overdue (dealChunk only).
interface Setting {
  avoid?: readonly Card[];
  before?: readonly boolean[];
  budget?: number;
  overdue?: boolean;
}

// Chooses `size` cards from a ranking and puts them in order.
function dealRanked(ranking: Ranking, size: number, rng: Rng, setting: Setting): Card[] {
  const chosen = choose(ranking, size, setting.avoid ?? [], setting.budget ?? SEARCH_BUDGET, setting.overdue ?? false);
  return arrange(chosen, rng, joinOf(setting.before ?? []));
}

// Where a deal joins the cards before it: their last answer and the length of the run of equal answers
// that ends them. Nothing before: no last answer, no run.
interface Join {
  last: boolean | null;
  run: number;
}

function joinOf(before: readonly boolean[]): Join {
  const last = before[before.length - 1] ?? null;
  let run = 0;
  for (let i = before.length - 1; i >= 0 && before[i] === last; i--) run++;
  return { last, run };
}

export const CHUNK = 10;

// The next cards of a round, given every card the round has dealt so far (in order): ten, or as many as
// may be dealt. First in line are the cards the round has not shown, ranked by the stored history. Behind
// them stand the cards it may bring back: every card outside the last min(CHUNK, route size - 1) dealt,
// the one shown longest ago first. Never empty for a pool with a card in it.
// A card the round has still not shown once it has dealt the route twice over is overdue: the chunk then
// takes one unshown card even if a rule has to give way for it (see choose), so that every card of the
// route is shown, late at worst, never not at all.
export function dealChunk(
  pool: readonly Card[],
  history: History,
  rng: Rng,
  dealt: readonly Card[],
  budget: number = SEARCH_BUDGET,
): Card[] {
  const cards = uniqueById(pool);
  const lastDealtAt = new Map<string, number>();
  dealt.forEach((card, position) => lastDealtAt.set(card.id, position));
  const unshown = cards.filter((card) => !lastDealtAt.has(card.id));
  const gap = Math.min(CHUNK, cards.length - 1);
  const comeBack = cards
    .filter((card) => (lastDealtAt.get(card.id) ?? dealt.length) < dealt.length - gap)
    .sort((a, b) => (lastDealtAt.get(a.id) ?? 0) - (lastDealtAt.get(b.id) ?? 0));
  const size = Math.min(CHUNK, unshown.length + comeBack.length);
  const lastTen = dealt.slice(-CHUNK);
  return dealRanked({ ...rankByPriority(unshown, history, rng, size), comeBack }, size, rng, {
    avoid: lastTen,
    before: lastTen.map((card) => card.answer),
    budget,
    overdue: unshown.length > 0 && dealt.length >= OVERDUE_AFTER_PASSES * cards.length,
  });
}

// How many times a round deals the whole route before a card it has not shown is overdue. A card can be
// locked out for good: a conflict group of the chunk before keeps it out of one chunk, the balance keeps it
// out of the next, and the round settles into those two chunks over and over (without this rule, a card of
// the 28 card section "OWASP Top 10:2025" of Web Security was still unshown after 300 cards in 113 of 120 rounds).
// Two passes give every other card its turn first.
const OVERDUE_AFTER_PASSES = 2;

// The first card with each id wins, so a card can never be dealt twice.
function uniqueById(pool: readonly Card[]): Card[] {
  const seen = new Set<string>();
  return pool.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function dealSize(count: number, available: number): number {
  if (Number.isNaN(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), available);
}

function wasSeen(card: Card, history: History): boolean {
  const entry = history[card.id];
  return entry !== undefined && entry.seen > 0;
}

function wasMissed(card: Card, history: History): boolean {
  return wasSeen(card, history) && history[card.id]?.lastCorrect === false;
}

function lastSeenAt(card: Card, history: History): number {
  const at = history[card.id]?.lastSeenAt;
  return at !== undefined && Number.isFinite(at) ? at : 0;
}

// Oldest first. Array.prototype.sort is stable, so equal times keep their (shuffled) order.
function oldestFirst(cards: readonly Card[], history: History): Card[] {
  return [...cards].sort((a, b) => lastSeenAt(a, history) - lastSeenAt(b, history));
}

// The pool in the order cards should be considered: missed cards up to the cap (oldest miss first),
// never seen (random), seen longest ago. The missed cards over the cap are kept apart, to be used only
// when a deal cannot be made without them. Shuffling first makes every tie random but reproducible.
interface Ranking {
  withinCap: Card[];
  overCap: Card[];
  comeBack: Card[]; // dealChunk only: cards the round has shown and may bring back, the one shown longest ago first
  missed: ReadonlySet<string>; // the ids of the missed cards among withinCap and overCap
  missedCap: number; // how many missed cards a deal of this size holds at most, unless the rules need more
}

function rankByPriority(cards: readonly Card[], history: History, rng: Rng, size: number): Ranking {
  const shuffled = shuffle(cards, rng);
  const missed = oldestFirst(shuffled.filter((card) => wasMissed(card, history)), history);
  const unseen = shuffled.filter((card) => !wasSeen(card, history));
  const seenRight = oldestFirst(shuffled.filter((card) => wasSeen(card, history) && !wasMissed(card, history)), history);
  const missedCap = Math.floor((size * DEAL.missedPerTen) / 10);
  return {
    withinCap: [...missed.slice(0, missedCap), ...unseen, ...seenRight],
    overCap: missed.slice(missedCap),
    comeBack: [],
    missed: new Set(missed.map((card) => card.id)),
    missedCap,
  };
}

// How many True cards a deal of `size` may have: 4 to 6 per ten, scaled (floor of 40%, ceiling of 60%).
interface Balance {
  minTrue: number;
  maxTrue: number;
}

function balanceFor(size: number): Balance {
  return {
    minTrue: Math.floor((size * DEAL.minTrue) / 10),
    maxTrue: Math.ceil((size * DEAL.maxTrue) / 10),
  };
}

// Picks `size` cards, relaxing the rules in the order of the spec only as far as needed:
// 1. every rule, without the missed cards over the cap;
// 2. recency: the missed cards over the cap may join, last in line, and only as many as the rules need
//    (searchOverCap);
// 3. recency again, in a round that goes on: a card the round has shown may come back, last in line;
// 4. conflict groups, then 5. answer balance (relaxStepByStep).
// When an unshown card is overdue and the chunk chosen so far holds none, no deal that keeps every rule
// holds one (the search takes the unshown cards first whenever it can), so the first unshown card goes in
// and the fallback relaxes the rest of the chunk around it: conflict groups before the balance, as always.
function choose(ranking: Ranking, size: number, avoid: readonly Card[], budget: number, overdue: boolean): Card[] {
  const balance = balanceFor(size);
  const unshown = [...ranking.withinCap, ...ranking.overCap];
  const everyCard = [...unshown, ...ranking.comeBack];
  const search = (ranked: readonly Card[], limits: Limits = {}) =>
    searchWithAllRules(ranked, size, avoid, balance, { budget, missed: ranking.missed, ...limits });
  const chosen =
    search(ranking.withinCap) ??
    searchOverCap(ranking, unshown, search) ??
    (ranking.comeBack.length > 0 ? search(everyCard) : null) ??
    relaxStepByStep(everyCard, size, avoid, balance);
  if (!overdue || chosen.some((card) => unshown.includes(card))) return chosen;
  return relaxStepByStep(everyCard, size, avoid, balance, unshown.slice(0, 1));
}

// Step 2. A deal that keeps the missed cards within the cap, a newer miss taking the place of an older one
// that cannot go, comes before a deal over it; over the cap, the fewer missed cards the better.
// The deal found with no limit holds as many missed cards as any limit can need, so the limits tried run
// from the cap up to one below that.
function searchOverCap(
  ranking: Ranking,
  unshown: readonly Card[],
  search: (ranked: readonly Card[], limits?: Limits) => Card[] | null,
): Card[] | null {
  if (ranking.overCap.length === 0) return null; // the same cards as step 1, which found nothing
  const loosest = search(unshown);
  if (loosest === null) return null;
  const held = loosest.filter((card) => ranking.missed.has(card.id)).length;
  for (let limit = ranking.missedCap; limit < held; limit++) {
    const found = search(unshown, { missedLimit: limit });
    if (found !== null) return found;
  }
  return loosest;
}

// A bound on the work one search may do. With the cut in canStillFinish, a search on the built decks takes
// about three steps on average and never more than about 8,000 (measured over every route, 300 card rounds
// and three kinds of history); before the cut, searches of more than 15,000 steps occurred and the bound
// ran out on pools that had a deal keeping every rule. It still matters for pools where no deal keeps every rule and
// the cut cannot tell early (False cards in a ring, each sharing a group with the next). When it runs out,
// the next step of choose takes over, which may skip a deal that keeps every rule.
export const SEARCH_BUDGET = 20_000;

// What else a search must keep to: the steps it may take, and at most `missedLimit` of the `missed` cards.
interface Limits {
  budget?: number;
  missed?: ReadonlySet<string>;
  missedLimit?: number;
}

// Depth-first over the ranked cards: at each card, first try to take it, then try to leave it out.
// The first full deal found keeps as many high-ranked cards as possible, so leaving out a higher card
// in favour of a lower one (relaxing recency) is the first thing that gives way.
// Returns null when no deal keeps both the conflict groups and the balance (or the search ran out of steps).
function searchWithAllRules(
  ranked: readonly Card[],
  size: number,
  avoid: readonly Card[],
  balance: Balance,
  limits: Limits = {},
): Card[] | null {
  const usedGroups = new Set(avoid.flatMap((card) => card.conflictGroups));
  const picked: Card[] = [];
  const missed = limits.missed ?? new Set<string>();
  const missedLimit = limits.missedLimit ?? Infinity;
  let trues = 0;
  let missedTaken = 0;
  let budget = limits.budget ?? SEARCH_BUDGET;

  const isMissed = (card: Card): boolean => missed.has(card.id);

  const canTake = (card: Card): boolean =>
    !card.conflictGroups.some((group) => usedGroups.has(group)) &&
    !(isMissed(card) && missedTaken >= missedLimit) &&
    balanceAllows(card.answer, trues, picked.length - trues, size, balance);

  const take = (card: Card) => {
    picked.push(card);
    if (card.answer) trues++;
    if (isMissed(card)) missedTaken++;
    for (const group of card.conflictGroups) usedGroups.add(group);
  };

  // A card is only taken when none of its groups is in use, so removing them on the way back is safe.
  const putBack = (card: Card) => {
    picked.pop();
    if (card.answer) trues--;
    if (isMissed(card)) missedTaken--;
    for (const group of card.conflictGroups) usedGroups.delete(group);
  };

  // Whether ranked[from..] can still fill the deal: an upper bound on what those cards can add, so that a
  // branch that cannot finish is cut at once rather than searched through. A card with a group in use can
  // never be taken; the cards with groups add at most one card for each group still free (each card taken
  // uses up at least one); missed cards add no more than the limit leaves; and each answer adds no more
  // than the balance leaves.
  const canStillFinish = (from: number): boolean => {
    const loose = [0, 0]; // cards with no group, by answer (0 False, 1 True)
    const grouped = [0, 0]; // cards with groups, by answer
    const groupsOf = [new Set<string>(), new Set<string>()];
    const allGroups = new Set<string>();
    let takeable = 0;
    let missedLeft = 0;
    for (let i = from; i < ranked.length; i++) {
      const card = ranked[i];
      if (card === undefined || card.conflictGroups.some((group) => usedGroups.has(group))) continue;
      const answer = card.answer ? 1 : 0;
      takeable++;
      if (isMissed(card)) missedLeft++;
      if (card.conflictGroups.length === 0) {
        loose[answer]! += 1;
        continue;
      }
      grouped[answer]! += 1;
      for (const group of card.conflictGroups) {
        groupsOf[answer]!.add(group);
        allGroups.add(group);
      }
    }
    const need = size - picked.length;
    const falses = picked.length - trues;
    const cardsLeft = loose[0]! + loose[1]! + Math.min(grouped[0]! + grouped[1]!, allGroups.size);
    const withinMissedLimit = takeable - Math.max(0, missedLeft - (missedLimit - missedTaken));
    const truesLeft = Math.min(loose[1]! + Math.min(grouped[1]!, groupsOf[1]!.size), balance.maxTrue - trues);
    const falsesLeft = Math.min(loose[0]! + Math.min(grouped[0]!, groupsOf[0]!.size), size - balance.minTrue - falses);
    return Math.min(cardsLeft, withinMissedLimit, truesLeft + falsesLeft) >= need;
  };

  const visit = (from: number): boolean => {
    if (picked.length === size) return true;
    if (budget-- <= 0 || !canStillFinish(from)) return false;
    const card = ranked[from];
    if (card === undefined) return false;
    if (canTake(card)) {
      take(card);
      if (visit(from + 1)) return true;
      putBack(card);
    }
    return visit(from + 1);
  };

  return visit(0) ? picked : null;
}

interface Rules {
  conflicts: boolean; // keep conflict groups apart (within the deal and against `avoid`)
  balance: boolean; // keep the number of True cards inside the balance
}

// The fallback when no deal keeps every rule. Three passes over the ranked cards, each adding to the
// cards already picked (`first`, if given): all rules, then without conflict groups, then without the balance.
function relaxStepByStep(
  ranked: readonly Card[],
  size: number,
  avoid: readonly Card[],
  balance: Balance,
  first: readonly Card[] = [],
): Card[] {
  const picked: Card[] = [...first];
  const pickedIds = new Set<string>(first.map((card) => card.id));

  const breaks = (card: Card, rules: Rules): boolean => {
    if (rules.conflicts && sharesGroup(card, [...avoid, ...picked])) return true;
    if (!rules.balance) return false;
    const trues = trueCount(picked);
    return !balanceAllows(card.answer, trues, picked.length - trues, size, balance);
  };

  const fill = (rules: Rules) => {
    for (const card of ranked) {
      if (picked.length === size) return;
      if (pickedIds.has(card.id) || breaks(card, rules)) continue;
      picked.push(card);
      pickedIds.add(card.id);
    }
  };

  fill({ conflicts: true, balance: true });
  fill({ conflicts: false, balance: true });
  fill({ conflicts: false, balance: false });
  return picked;
}

function sharesGroup(card: Card, others: readonly Card[]): boolean {
  return card.conflictGroups.some((group) => others.some((other) => other.conflictGroups.includes(group)));
}

function trueCount(cards: readonly Card[]): number {
  return cards.filter((card) => card.answer).length;
}

// True cards may not pass maxTrue, and False cards may not pass size - minTrue,
// so a full deal picked under this rule always lands inside the balance.
function balanceAllows(answer: boolean, trues: number, falses: number, size: number, balance: Balance): boolean {
  return answer ? trues < balance.maxTrue : falses < size - balance.minTrue;
}

// Puts the chosen cards in a random order with no run of equal answers longer than the run limit.
// Position by position, it draws True or False in proportion to how many of each are left, among the
// answers that still allow the rest to be placed; then it takes the next card of that answer.
function arrange(chosen: readonly Card[], rng: Rng, join: Join): Card[] {
  const trues = shuffle(chosen.filter((card) => card.answer), rng);
  const falses = shuffle(chosen.filter((card) => !card.answer), rng);
  const limit = runLimit(trues.length, falses.length, join);
  const canPlace = placementCheck(limit);
  const order: Card[] = [];
  let last = join.last;
  let run = join.run;

  while (trues.length + falses.length > 0) {
    const allowed = [true, false].filter((answer) => {
      const left = answer ? trues.length : falses.length;
      if (left === 0 || (answer === last && run >= limit)) return false;
      const nextRun = answer === last ? run + 1 : 1;
      return canPlace(trues.length - (answer ? 1 : 0), falses.length - (answer ? 0 : 1), answer, nextRun);
    });
    const answer = pickAnswer(allowed, trues.length, falses.length, rng);
    const card = answer ? trues.shift() : falses.shift();
    if (card === undefined) break;
    order.push(card);
    run = answer === last ? run + 1 : 1;
    last = answer;
  }
  return order;
}

// The run limit is DEAL.maxRun, unless no order of these answers after the cards before them can keep
// it (all True, 9 True and 1 False, or a True card alone after three True cards); then it is the
// smallest limit some order can keep. Without cards before, that is ceil(majority / (minority + 1)).
function runLimit(trues: number, falses: number, join: Join): number {
  let limit = DEAL.maxRun;
  while (!placementCheck(limit)(trues, falses, join.last, join.run)) limit++;
  return limit;
}

// canPlace(t, f, last, run): can t True and f False cards still be placed after a run of `run` cards
// with answer `last`, without any run passing the limit? Memoised, so a whole deal costs little.
function placementCheck(limit: number): (t: number, f: number, last: boolean | null, run: number) => boolean {
  const memo = new Map<string, boolean>();
  const canPlace = (t: number, f: number, last: boolean | null, run: number): boolean => {
    if (t === 0 && f === 0) return true;
    const key = `${t},${f},${last},${run}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    const result =
      (t > 0 && (last !== true || run < limit) && canPlace(t - 1, f, true, last === true ? run + 1 : 1)) ||
      (f > 0 && (last !== false || run < limit) && canPlace(t, f - 1, false, last === false ? run + 1 : 1));
    memo.set(key, result);
    return result;
  };
  return canPlace;
}

// Chooses between the allowed answers in proportion to the cards left of each.
// The run limit always leaves at least one allowed answer; the empty case is only a guard.
function pickAnswer(allowed: readonly boolean[], trues: number, falses: number, rng: Rng): boolean {
  if (allowed.length === 0) return trues > 0;
  if (allowed.length === 1) return allowed[0] === true;
  return rng() * (trues + falses) < trues;
}
