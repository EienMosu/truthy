import { describe, expect, it } from "vitest";
import { pad2 } from "@/components/format";

describe("pad2", () => {
  it("pads to two digits and leaves longer numbers alone", () => {
    expect(pad2(0)).toBe("00");
    expect(pad2(7)).toBe("07");
    expect(pad2(14)).toBe("14");
    expect(pad2(120)).toBe("120");
  });
});
