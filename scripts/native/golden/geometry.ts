// The golden vectors of the geometry group (reference 3.9): the ticket's scroll arithmetic, the flight path,
// the Streak, Three lives and Timed headers, the barcode and the contrast pairs. Each part has its own file
// next to this one.
import { barcodeGolden } from "./geometry-barcode";
import { contrastGolden } from "./geometry-contrast";
import { headersGolden } from "./geometry-headers";
import { pathGolden } from "./geometry-path";
import { scrollGolden } from "./geometry-scroll";
import type { GoldenFile } from "./format";

export function golden(): GoldenFile[] {
  return [...scrollGolden(), ...pathGolden(), ...headersGolden(), ...barcodeGolden(), ...contrastGolden()];
}
