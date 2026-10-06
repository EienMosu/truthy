// Progress: card history, records and the last route played (spec section 7).
// Pure: every function returns new objects and never changes its inputs.
// The storage side lives in ./local, behind the ProgressStore interface.

import { z } from "zod";
import { routeKey, type Route } from "@/src/content/schema";
import { MODES, type CardHistory, type History, type Mode, type RoundResult } from "@/src/content/play";

export interface Progress {
  version: 1;
  cards: Record<string, CardHistory>;
  records: Record<string, number>; // key: recordKey(route, mode)
  // The last round played. score and total are null for an abandoned round and for a last route stored
  // before scores were kept.
  last: { route: Route; mode: Mode; score: number | null; total: number | null } | null;
}

export function emptyProgress(): Progress {
  return { version: 1, cards: {}, records: {}, last: null };
}

export function recordKey(route: Route, mode: Mode): string {
  return `${routeKey(route)}#${mode}`;
}

/** The record for a route and mode, or null when it has not been played (to the end) yet. */
export function bestFor(progress: Progress, route: Route, mode: Mode): number | null {
  const key = recordKey(route, mode);
  return Object.hasOwn(progress.records, key) ? (progress.records[key] ?? null) : null;
}

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

export interface ApplyOutcome {
  progress: Progress;
  previousBest: number | null;
  isNewBest: boolean;
}

// Records the answers of a round in the card history, remembers its route and mode (and its score
// when it was finished), and sets the record for that route and mode when a finished round beats it.
// A first finished round on a route and mode always sets the record.
// An abandoned round keeps its answers in the history but never touches the record.
export function applyResult(progress: Progress, result: RoundResult): ApplyOutcome {
  const key = recordKey(result.route, result.mode);
  const previousBest = bestFor(progress, result.route, result.mode);
  const comparison = compareWithBest(result.score, previousBest);
  const isNewBest = !result.abandoned && (comparison.kind === "first" || comparison.kind === "new-best");
  const records = isNewBest ? { ...progress.records, [key]: result.score } : { ...progress.records };
  return {
    progress: {
      version: 1,
      cards: withAnswers(progress.cards, result),
      records,
      last: {
        route: { deckId: result.route.deckId, sectionId: result.route.sectionId },
        mode: result.mode,
        score: result.abandoned ? null : result.score,
        total: result.abandoned ? null : result.total,
      },
    },
    previousBest,
    isNewBest,
  };
}

function withAnswers(cards: Readonly<Record<string, CardHistory>>, result: RoundResult): Record<string, CardHistory> {
  const next: Record<string, CardHistory> = { ...cards };
  for (const answer of result.answers) {
    const id = answer.card.id;
    const before = Object.hasOwn(next, id) ? next[id] : undefined;
    next[id] = { seen: (before?.seen ?? 0) + 1, lastCorrect: answer.correct, lastSeenAt: answer.at };
  }
  return next;
}

// Drops the history of cards of this deck that are not in the deck any more.
// A card belongs to the deck when its id starts with `${deckId}-`. Records and the last route are kept.
export function pruneDeck(progress: Progress, deckId: string, cardIds: readonly string[]): Progress {
  const prefix = `${deckId}-`;
  const current = new Set(cardIds);
  const cards: Record<string, CardHistory> = {};
  for (const [id, entry] of Object.entries(progress.cards)) {
    if (id.startsWith(prefix) && !current.has(id)) continue;
    cards[id] = entry;
  }
  return { ...progress, cards, records: { ...progress.records } };
}

// The share (0 to 1) of the given cards that have been seen at least once. No cards gives 0.
export function seenShare(history: History, cardIds: readonly string[]): number {
  const ids = new Set(cardIds);
  if (ids.size === 0) return 0;
  let seen = 0;
  for (const id of ids) {
    const entry = Object.hasOwn(history, id) ? history[id] : undefined;
    if (entry !== undefined && entry.seen > 0) seen += 1;
  }
  return seen / ids.size;
}

// The stored shape, checked part by part: each card entry, each record and the last route stand on their
// own, so one part that fails (a mode a later version added, a count that cannot be) costs only that part.
// Unknown fields are dropped.
const CardHistorySchema = z.object({
  seen: z.number().int().nonnegative(),
  lastCorrect: z.boolean(),
  lastSeenAt: z.number().nonnegative(),
});

const RecordSchema = z.number().int().nonnegative();

const LastSchema = z
  .object({
    route: z.object({ deckId: z.string().min(1), sectionId: z.string().min(1) }),
    mode: z.enum(MODES),
    // Missing in progress stored before scores were kept: it reads as a round without a score.
    score: z.number().int().nonnegative().nullable().default(null),
    total: z.number().int().nonnegative().nullable().default(null),
  })
  .nullable();

/** A stored value as read: the progress kept from it, and whether all of it was kept. */
export interface ProgressRead {
  progress: Progress;
  // False when any part of a stored value was dropped, or the whole of it: the raw value then holds
  // something the progress does not, which the store keeps aside before it writes over it.
  whole: boolean;
}

// Never throws. Nothing stored reads as empty and whole. Invalid JSON, a value that is not an object
// and any version other than the number 1 read as empty and not whole. Otherwise a card entry, a record
// or a last route that fails is dropped alone (the last route becomes null), and the rest is kept.
export function readProgress(raw: string | null): ProgressRead {
  if (raw === null) return { progress: emptyProgress(), whole: true };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { progress: emptyProgress(), whole: false };
  }
  if (!isObject(data) || data["version"] !== 1) return { progress: emptyProgress(), whole: false };
  const cards = validEntries(data["cards"], CardHistorySchema);
  const records = validEntries(data["records"], RecordSchema);
  const last = LastSchema.safeParse(data["last"]);
  return {
    progress: { version: 1, cards: cards.kept, records: records.kept, last: last.success ? last.data : null },
    whole: cards.whole && records.whole && last.success,
  };
}

/** The progress kept from a stored value (see readProgress). */
export function parseProgress(raw: string | null): Progress {
  return readProgress(raw).progress;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The entries of a stored map that pass the schema. Object.fromEntries defines each key as an own
// property, so a "__proto__" key in stored data stays a plain key and never changes a prototype.
function validEntries<T>(value: unknown, schema: z.ZodType<T>): { kept: Record<string, T>; whole: boolean } {
  if (!isObject(value)) return { kept: {}, whole: false };
  const kept: [string, T][] = [];
  let whole = true;
  for (const [key, entry] of Object.entries(value)) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) kept.push([key, parsed.data]);
    else whole = false;
  }
  return { kept: Object.fromEntries(kept), whole };
}
