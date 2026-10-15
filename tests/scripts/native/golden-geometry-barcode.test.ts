import { describe, expect, it } from "vitest";
import { barcodeBars } from "@/components/BoardingPass";
import { BARCODE_DATA, barcodeGolden } from "@/scripts/native/golden/geometry-barcode";
import { fileAt, outputFor, view } from "./golden-view";

const FILES = barcodeGolden();
const file = fileAt(FILES, "native-data/golden/components.BoardingPass.barcodeBars.json");
type Bars = { bars: { x: number; width: number }[]; width: number };
const bars = (data: string) => outputFor(file, { data }) as Bars;

describe("barcodeBars (the pinned cases of BoardingPass.test.tsx)", () => {
  it("makes one file", () => {
    expect(FILES).toHaveLength(1);
    expect(view(file)).toMatchObject({ module: "components/BoardingPass", function: "barcodeBars", source: "components/BoardingPass.tsx" });
    expect(view(file).cases).toHaveLength(BARCODE_DATA.length);
  });

  it("starts with bars 2/1/1/2 and ends with 1/1/2", () => {
    const { bars: drawn, width } = bars("A");
    expect(drawn[0]).toEqual({ x: 0, width: 2 });
    expect(drawn[1]).toEqual({ x: 3, width: 1 });
    expect(drawn.at(-1)).toEqual({ x: width - 2, width: 2 });
    expect(drawn.at(-2)).toEqual({ x: width - 4, width: 1 });
  });

  it("gives each character 7 bars and a gap, 2 wide for a 1 bit and 1 wide for a 0 bit", () => {
    expect(bars("A").width).toBe(6 + 10 + 4);
    expect(bars("AA").width).toBe(6 + 20 + 4);
  });

  it("is the same for the same data and different for different data", () => {
    expect(bars("aws-clf-c02-t2.1-06")).toEqual(barcodeBars("aws-clf-c02-t2.1-06"));
    expect(bars("aws-clf-c02-t2.1-06")).not.toEqual(bars("aws-clf-c02-t2.1-07"));
  });

  it("draws the end bars of the empty string right after the start bars", () => {
    expect(bars("")).toEqual({ bars: [{ x: 0, width: 2 }, { x: 3, width: 1 }, { x: 6, width: 1 }, { x: 8, width: 2 }], width: 10 });
  });

  it("counts the low seven bits of the first UTF-16 unit: e with an acute is 0x69, the G clef is its high surrogate", () => {
    expect(bars("\u{e9}")).toEqual(barcodeBars("i"));
    expect(bars("\u{1d11e}")).toEqual(barcodeBars(String.fromCharCode(0xd834)));
    expect(bars("\u{1d11e}")).not.toEqual(bars("\u{0}"));
  });

  it("every recorded output is what the function says", () => {
    for (const recorded of view(file).cases) expect(barcodeBars((recorded.input as { data: string }).data), recorded.name).toEqual(recorded.output);
  });
});
