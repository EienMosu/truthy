// Golden vectors for the start screen: the catalog helpers, the step helpers, the list cue and the labels.
import { catalogFiles } from "./catalog";
import type { GoldenFile } from "./format";
import { stepFiles } from "./steps";

export function golden(): GoldenFile[] {
  return [...catalogFiles(), ...stepFiles()];
}
