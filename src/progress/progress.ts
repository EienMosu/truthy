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
