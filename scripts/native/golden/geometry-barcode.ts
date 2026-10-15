// Vectors for the barcode of the boarding pass (components/BoardingPass.tsx, barcodeBars): the start bars,
// seven bits of every character least significant first, a gap, the end bars. Only the low seven bits of the
// first UTF-16 unit of each character count, which the cases with a letter beyond ASCII and one beyond the
// first plane pin. The data of a real pass is the card's id.
import { barcodeBars } from "@/components/BoardingPass";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

/** The data the cases draw: edge strings, the sample of the web test, and ids of shipped decks. */
export const BARCODE_DATA: readonly string[] = [
  "",
  "A",
  "AA",
  "~",
  "\u{0}",
  "\u{e9}",
  "\u{1d11e}",
  "aws-clf-c02-t2.1-06",
  "aws-clf-c02-t2.1-07",
  "gcp-cdl-s1.1-01",
];

/** The file of this group: barcodeBars. */
export function barcodeGolden(): GoldenFile[] {
  const cases = BARCODE_DATA.map((data): GoldenCase => ({ name: JSON.stringify(data), input: { data }, output: barcodeBars(data) }));
  return [
    goldenFile({ module: "components/BoardingPass", function: "barcodeBars", source: "components/BoardingPass.tsx", tests: ["tests/components/BoardingPass.test.tsx"] }, cases),
  ];
}
