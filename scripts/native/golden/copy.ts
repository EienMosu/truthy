// The golden vectors of the copy group (reference 3.9): the play screen's words, leaving a round, the result,
// the missed cards and the ticket's route words. Each part has its own file next to this one.
import { leaveGolden } from "./copy-leave";
import { playGolden } from "./copy-play";
import { resultGolden } from "./copy-result";
import { ticketGolden } from "./copy-ticket";
import type { GoldenFile } from "./format";

export function golden(): GoldenFile[] {
  return [...playGolden(), ...leaveGolden(), ...resultGolden(), ...ticketGolden()];
}
