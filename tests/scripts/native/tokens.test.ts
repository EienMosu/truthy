import { describe, expect, it } from "vitest";
import { type Override, resolveTokens } from "@/scripts/native/tokens";

// A small tokens file in the DTCG shape of design/system/tokens.json: groups, tokens with $value and
// $description, a composite value, an array value, and the one key that contains a dot ("ch.truthy").
function fixture() {
  return {
    $description: "fixture",
    size: {
      "max-width": { $type: "dimension", $value: { value: 390, unit: "px" }, $description: "The design viewport is 390." },
      gutter: { $type: "dimension", $value: { value: 16, unit: "px" }, $description: "Side gutter." },
    },
    motion: {
      curve: {
        $type: "cubicBezier",
        $value: [0.34, 1.56, 0.64, 1],
        $extensions: { "ch.truthy": { note: "kept" } },
      },
      transition: {
        "sheet-open": {
          $type: "transition",
          $value: {
            duration: "{motion.duration.stamp}",
            delay: { value: 0, unit: "ms" },
            timingFunction: "{motion.easing.spring}",
          },
        },
      },
    },
  };
}

function override(path: string, value: unknown, extra: Partial<Override> = {}): Override {
  return { path, value, reason: "the code wins", evidence: "app/globals.css:48", ...extra };
}

describe("resolveTokens: applying", () => {
  it("replaces the value at a dot path and leaves every other token as it was", () => {
    const resolved = resolveTokens(fixture(), [override("size.max-width.$value", { value: 430, unit: "px" })]);
    const expected = fixture();
    expected.size["max-width"].$value = { value: 430, unit: "px" };
    expect(resolved).toEqual(expected);
  });

  it("replaces a description, a string inside a composite value and one item of an array", () => {
    const resolved = resolveTokens(fixture(), [
      override("size.max-width.$description", "The frame is 430 wide."),
      override("motion.transition.sheet-open.$value.timingFunction", "{motion.easing.ease}"),
      override("motion.curve.$value.1", 1.5),
    ]) as ReturnType<typeof fixture>;
    expect(resolved.size["max-width"].$description).toBe("The frame is 430 wide.");
    expect(resolved.motion.transition["sheet-open"].$value.timingFunction).toBe("{motion.easing.ease}");
    expect(resolved.motion.curve.$value).toEqual([0.34, 1.5, 0.64, 1]);
  });

  it("returns the tokens unchanged (as a copy) when there are no overrides", () => {
    const tokens = fixture();
    const resolved = resolveTokens(tokens, []);
    expect(resolved).toEqual(tokens);
    expect(resolved).not.toBe(tokens);
  });

  it("does not change its input, and shares no object with the override values", () => {
    const tokens = fixture();
    const value = { value: 430, unit: "px" };
    const resolved = resolveTokens(tokens, [override("size.max-width.$value", value)]) as ReturnType<typeof fixture>;
    expect(tokens).toEqual(fixture());
    value.value = 1;
    expect(resolved.size["max-width"].$value).toEqual({ value: 430, unit: "px" });
  });

  it("gives the same result for the same input, twice", () => {
    const list = [override("size.max-width.$value", { value: 430, unit: "px" }), override("size.gutter.$description", "Gutter.")];
    expect(JSON.stringify(resolveTokens(fixture(), list))).toBe(JSON.stringify(resolveTokens(fixture(), list)));
  });
});

describe("resolveTokens: a dangling override", () => {
  it("throws for a token that is not in the file, naming the path and the missing key", () => {
    expect(() => resolveTokens(fixture(), [override("size.gone.$value", 1)])).toThrow(
      'Override size.gone.$value names a path that is not in the tokens (no "gone")',
    );
  });

  it("throws for a missing field of an existing token", () => {
    expect(() => resolveTokens(fixture(), [override("size.max-width.$extensions", 1)])).toThrow(
      'Override size.max-width.$extensions names a path that is not in the tokens (no "$extensions")',
    );
  });

  it("throws for a path that runs into a value, an empty segment or an array index past the end", () => {
    expect(() => resolveTokens(fixture(), [override("size.max-width.$value.value.deeper", 1)])).toThrow('(no "deeper")');
    expect(() => resolveTokens(fixture(), [override("size..gutter", 1)])).toThrow('(no "")');
    expect(() => resolveTokens(fixture(), [override("motion.curve.$value.4", 1)])).toThrow('(no "4")');
  });

  it("does not find the members every object inherits", () => {
    expect(() => resolveTokens(fixture(), [override("size.constructor", 1)])).toThrow('(no "constructor")');
    expect(() => resolveTokens(fixture(), [override("size.__proto__.x", 1)])).toThrow('(no "__proto__")');
  });

  it("throws for an input that is not an object", () => {
    expect(() => resolveTokens(null, [override("size", 1)])).toThrow('(no "size")');
    expect(() => resolveTokens("tokens", [override("size", 1)])).toThrow('(no "size")');
  });
});

describe("resolveTokens: a stale override", () => {
  it("throws when the token already has the override's value", () => {
    expect(() => resolveTokens(fixture(), [override("size.max-width.$value", { value: 390, unit: "px" })])).toThrow(
      "Override size.max-width.$value is stale: tokens.json already has that value",
    );
    expect(() => resolveTokens(fixture(), [override("size.gutter.$description", "Side gutter.")])).toThrow("is stale");
  });

  it("compares objects and arrays by content, not by key order", () => {
    expect(() => resolveTokens(fixture(), [override("size.max-width.$value", { unit: "px", value: 390 })])).toThrow("is stale");
    expect(() => resolveTokens(fixture(), [override("motion.curve.$value", [0.34, 1.56, 0.64, 1])])).toThrow("is stale");
  });

  it("does not call a value stale because it only looks alike", () => {
    expect(() => resolveTokens(fixture(), [override("size.max-width.$value", { value: "390", unit: "px" })])).not.toThrow();
    expect(() => resolveTokens(fixture(), [override("motion.curve.$value", [0.34, 1.56, 0.64])])).not.toThrow();
  });
});

describe("resolveTokens: a malformed list", () => {
  it("needs a reason and evidence on every override", () => {
    expect(() => resolveTokens(fixture(), [override("size.gutter.$description", "Gutter.", { reason: " " })])).toThrow(
      "Override size.gutter.$description needs a reason and evidence",
    );
    expect(() => resolveTokens(fixture(), [override("size.gutter.$description", "Gutter.", { evidence: "" })])).toThrow(
      "needs a reason and evidence",
    );
    const noPath = { value: 1, reason: "r", evidence: "e" } as unknown as Override;
    expect(() => resolveTokens(fixture(), [noPath])).toThrow("An override needs a path, a reason and evidence");
  });

  it("needs a value, which may be any JSON value", () => {
    const noValue = { path: "size.gutter.$description", reason: "r", evidence: "e" } as unknown as Override;
    expect(() => resolveTokens(fixture(), [noValue])).toThrow("Override size.gutter.$description has no value");
    expect(() => resolveTokens(fixture(), [override("size.gutter.$description", null)])).not.toThrow();
  });

  it("refuses a path listed twice", () => {
    expect(() =>
      resolveTokens(fixture(), [override("size.gutter.$description", "A."), override("size.gutter.$description", "B.")]),
    ).toThrow("Override size.gutter.$description is listed twice");
  });

  it("refuses a path that lies inside another override's value, in either order", () => {
    const inner = override("size.max-width.$value.value", 430);
    const outer = override("size.max-width.$value", { value: 431, unit: "px" });
    expect(() => resolveTokens(fixture(), [outer, inner])).toThrow("Override size.max-width.$value.value overlaps size.max-width.$value");
    expect(() => resolveTokens(fixture(), [inner, outer])).toThrow("Override size.max-width.$value overlaps size.max-width.$value.value");
  });

  it("allows two paths below the same value that do not contain each other", () => {
    expect(() =>
      resolveTokens(fixture(), [override("size.max-width.$value.value", 430), override("size.max-width.$value.unit", "pt")]),
    ).not.toThrow();
  });

  it("throws for a bad override anywhere in the list", () => {
    expect(() => resolveTokens(fixture(), [override("size.gutter.$description", "Gutter."), override("size.gone", 1)])).toThrow("no \"gone\"");
  });
});

describe("resolveTokens: an additive override", () => {
  it("adds a key that the tokens do not have, at the top level or inside a group, after the existing keys", () => {
    const resolved = resolveTokens(fixture(), [
      override("native", { "sky-stops": [0, 0.35, 0.62, 1] }, { add: true }),
      override("size.sheet-min-width", 320, { add: true }),
    ]) as Record<string, unknown> & ReturnType<typeof fixture>;
    expect(resolved.native).toEqual({ "sky-stops": [0, 0.35, 0.62, 1] });
    expect(Object.keys(resolved)).toEqual(["$description", "size", "motion", "native"]);
    expect((resolved.size as Record<string, unknown>)["sheet-min-width"]).toBe(320);
  });

  it("refuses to add a key that the tokens already have", () => {
    expect(() => resolveTokens(fixture(), [override("size.gutter", 1, { add: true })])).toThrow(
      "Override size.gutter adds a key that tokens.json already has",
    );
  });

  it("refuses to add a key under a parent that is missing", () => {
    expect(() => resolveTokens(fixture(), [override("size.gone.x", 1, { add: true })])).toThrow(
      'Override size.gone.x names a path that is not in the tokens (no "gone")',
    );
  });
});
