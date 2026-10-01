// Progress: card history, records and the last route played (spec section 7).
// Pure: every function returns new objects and never changes its inputs.
// The storage side lives in ./local, behind the ProgressStore interface.

import { z } from "zod";
import { routeKey, type Route } from "@/src/content/schema";
import type { CardHistory, History } from "@/src/engine/deal";
import type { Mode, RoundResult } from "@/src/engine/round";

export interface Progress {
  version: 1;
  cards: Record<string, CardHistory>;
  records: Record<string, number>; // key: recordKey(route, mode)
  last: { route: Route; mode: Mode } | null;
}

export function emptyProgress(): Progress {
  return { version: 1, cards: {}, records: {}, last: null };
}

export function recordKey(route: Route, mode: Mode): string {
  return `${routeKey(route)}#${mode}`;
}

export interface ApplyOutcome {
  progress: Progress;
  previousBest: number | null;
  isNewBest: boolean;
}

// Records the answers of a round in the card history, remembers its route and mode,
// and sets the record for that route and mode when a finished round beats it.
// A first finished round on a route and mode always sets the record.
// An abandoned round keeps its answers in the history but never touches the record.
export function applyResult(progress: Progress, result: RoundResult): ApplyOutcome {
  const key = recordKey(result.route, result.mode);
  const previousBest = Object.hasOwn(progress.records, key) ? (progress.records[key] ?? null) : null;
  const isNewBest = !result.abandoned && (previousBest === null || result.score > previousBest);
  const records = isNewBest ? { ...progress.records, [key]: result.score } : { ...progress.records };
  return {
    progress: {
      version: 1,
      cards: withAnswers(progress.cards, result),
      records,
      last: { route: { deckId: result.route.deckId, sectionId: result.route.sectionId }, mode: result.mode },
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

// The stored shape. Unknown fields are dropped; any other difference makes the whole value invalid.
const MODES = ["classic", "streak", "lives", "timed"] as const satisfies readonly Mode[];

const CardHistorySchema = z.object({
  seen: z.number().int().nonnegative(),
  lastCorrect: z.boolean(),
  lastSeenAt: z.number().nonnegative(),
});

const ProgressSchema = z.object({
  version: z.literal(1),
  cards: z.record(z.string(), CardHistorySchema),
  records: z.record(z.string(), z.number().int().nonnegative()),
  last: z
    .object({
      route: z.object({ deckId: z.string().min(1), sectionId: z.string().min(1) }),
      mode: z.enum(MODES),
    })
    .nullable(),
});

// Never throws: nothing stored, invalid JSON, the wrong shape or another version all give empty progress.
export function parseProgress(raw: string | null): Progress {
  if (raw === null) return emptyProgress();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyProgress();
  }
  const parsed = ProgressSchema.safeParse(data);
  return parsed.success ? parsed.data : emptyProgress();
}
