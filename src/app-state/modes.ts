// The one table of classes (modes): what the class step, the ticket, the continue line and the result
// say about each, and whether the class step offers it. The engine can play more modes than are offered:
// `offered` is the only gate between a finished mode and the player.
import type { Mode } from "@/src/content/play";

export interface ModeInfo {
  id: Mode;
  /** The class name: on the class card, the pass, the ticket and the continue line. */
  name: string;
  /**
   * What the class scores, in one sentence: on the class card and the ready pass. It names what counts, so a
   * player knows it before a first round puts a best and its unit on the class card (review finding U140).
   */
  description: string;
  /** The unit of a best on the class card: "of 10", "in a row", "cards", "correct". */
  unit: string;
  /** False: the class step shows it as "Not available yet" and it cannot be chosen or continued. */
  offered: boolean;
}

export const MODE_TABLE: readonly ModeInfo[] = [
  { id: "classic", name: "Classic", description: "Correct answers out of 10 cards.", unit: "of 10", offered: true },
  { id: "streak", name: "Streak", description: "Correct answers in a row, until the first wrong one.", unit: "in a row", offered: true },
  { id: "lives", name: "Three lives", description: "Correct answers before the third wrong one.", unit: "cards", offered: true },
  { id: "timed", name: "Timed", description: "Correct answers in one minute, wrong ones cost nothing.", unit: "correct", offered: true },
];

/** The row of the mode. Throws for a mode the table does not know. */
export function modeInfo(mode: Mode): ModeInfo {
  const row = MODE_TABLE.find((candidate) => candidate.id === mode);
  if (row === undefined) throw new Error(`Unknown mode "${String(mode)}".`);
  return row;
}

/** Whether the class step offers the mode. */
export function isOffered(mode: Mode): boolean {
  return modeInfo(mode).offered;
}

/** The score of a finished round as the continue line says it: "7 of 10", "13 in a row", "21 cards", "14 correct". */
export function lastScoreText(mode: Mode, score: number, total: number): string {
  return mode === "classic" ? `${score} of ${total}` : `${score} ${modeInfo(mode).unit}`;
}
