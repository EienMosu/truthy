// What a round is made of, as far as both the engine and the progress need to know (spec section 4:
// each may depend on content types only). Types and one constant, no behaviour.
import type { Card, Route } from "./schema";

export type Mode = "classic" | "streak" | "lives" | "timed";
export const MODES = ["classic", "streak", "lives", "timed"] as const satisfies readonly Mode[];

export interface CardHistory {
  seen: number;
  lastCorrect: boolean;
  lastSeenAt: number;
}
export type History = Readonly<Record<string, CardHistory>>; // by card id

export interface Answered {
  card: Card;
  given: boolean;
  correct: boolean;
  at: number;
}

export interface RoundResult {
  mode: Mode;
  route: Route;
  score: number; // the number the mode's record keeps
  total: number; // cards answered
  answers: readonly Answered[];
  missed: readonly Answered[]; // answers with correct === false, in order
  abandoned: boolean;
}
