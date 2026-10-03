import { describe, expect, it } from "vitest";
import { plainText, textParts } from "@/src/content/text";

describe("textParts", () => {
  it("is one plain part for a text without backticks", () => {
    expect(textParts("AWS patches the host.")).toEqual([{ text: "AWS patches the host.", code: false }]);
  });

  it("makes each pair of backticks a code part, without the backticks", () => {
    expect(textParts("An `asserts x is string` function narrows `x` after a call.")).toEqual([
      { text: "An ", code: false },
      { text: "asserts x is string", code: true },
      { text: " function narrows ", code: false },
      { text: "x", code: true },
      { text: " after a call.", code: false },
    ]);
  });

  it("leaves no empty plain part around a fragment at the start or the end, or between two fragments", () => {
    expect(textParts("`docker run` starts `nginx`")).toEqual([
      { text: "docker run", code: true },
      { text: " starts ", code: false },
      { text: "nginx", code: true },
    ]);
    expect(textParts("`a``b`")).toEqual([
      { text: "a", code: true },
      { text: "b", code: true },
    ]);
  });

  it("keeps a backtick without a partner, or of an empty pair, as a code part of its own", () => {
    expect(textParts("one ` two")).toEqual([
      { text: "one ", code: false },
      { text: "`", code: true },
      { text: " two", code: false },
    ]);
    expect(textParts("a `` b")).toEqual([
      { text: "a ", code: false },
      { text: "`", code: true },
      { text: "`", code: true },
      { text: " b", code: false },
    ]);
  });

  it("is empty for an empty text", () => {
    expect(textParts("")).toEqual([]);
  });
});

describe("plainText", () => {
  it("is the text as it is shown: code fragments without their backticks", () => {
    expect(plainText("Before narrowing, `x.indexOf(\"a\")` is accepted on `x: string | string[]`.")).toBe(
      'Before narrowing, x.indexOf("a") is accepted on x: string | string[].',
    );
  });

  it("keeps a backtick without a partner and leaves a text without backticks as it is", () => {
    expect(plainText("one ` two")).toBe("one ` two");
    expect(plainText("AWS patches the host.")).toBe("AWS patches the host.");
  });
});
