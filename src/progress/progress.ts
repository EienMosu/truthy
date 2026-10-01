// Progress: card history, records and the last route played (spec section 7).
// Pure: every function returns new objects and never changes its inputs.
// The storage side lives in ./local, behind the ProgressStore interface.

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

// Records the answers of a round in the card history and remembers its route and mode.
// Records are added in the next step.
export function applyResult(progress: Progress, result: RoundResult): ApplyOutcome {
  const key = recordKey(result.route, result.mode);
  const previousBest = Object.hasOwn(progress.records, key) ? (progress.records[key] ?? null) : null;
  return {
    progress: {
      version: 1,
      cards: withAnswers(progress.cards, result),
      records: { ...progress.records },
      last: { route: { deckId: result.route.deckId, sectionId: result.route.sectionId }, mode: result.mode },
    },
    previousBest,
    isNewBest: false,
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
