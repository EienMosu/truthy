// The one table of classes (modes): what the class step, the ticket, the continue line and the result
// say about each, and whether the class step offers it. The engine can play more modes than are offered:
// `offered` is the only gate between a finished mode and the player.
import type { Mode } from "@/src/content/play";

export interface ModeInfo {
  id: Mode;
  /** The class name: on the class card, the pass, the ticket and the continue line. */
  name: string;
  /** The rule in one sentence: on the class card and the ready pass. */
  description: string;
  /** The unit of a best on the class card: "of 10", "in a row", "cards", "correct". */
  unit: string;
  /** False: the class step shows it as "Not available yet" and it cannot be chosen or continued. */
  offered: boolean;
}

export const MODE_TABLE: readonly ModeInfo[] = [
  { id: "classic", name: "Classic", description: "10 cards, score at the end.", unit: "of 10", offered: true },
  { id: "streak", name: "Streak", description: "Keep going until the first wrong answer.", unit: "in a row", offered: false },
  { id: "lives", name: "Three lives", description: "The round ends on the third wrong answer.", unit: "cards", offered: false },
  { id: "timed", name: "Timed", description: "60 seconds, as many cards as you can.", unit: "correct", offered: false },
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
