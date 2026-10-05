// @vitest-environment jsdom
// Review finding U139, design system 7 "Start flow: step forward": the dashes of a field fade out as its name
// heads for it. While they fade they are only a picture, so the field reads as its value alone, never as
// "not chosen" and its value at once.
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FillInPass, type FillInPassValues } from "@/components/FillInPass";

afterEach(cleanup);

const BEFORE: FillInPassValues = { area: "Cloud" };
const AFTER: FillInPassValues = { area: "Cloud", platform: "AWS" };

function platform(): HTMLElement {
  const field = document.querySelector<HTMLElement>('[data-field="platform"]');
  if (!field) throw new Error("no platform field");
  return field;
}

describe("FillInPass: the dashes of a field being filled", () => {
  it("keep fading under the new value, which the field alone says", async () => {
    const { rerender } = render(<FillInPass stage="destination" values={BEFORE} now="platform" onJump={() => {}} />);
    expect(platform().textContent).toBe("Platformnot chosen");
    rerender(<FillInPass stage="destination" values={AFTER} now="deck" onJump={() => {}} />);
    expect(platform().querySelector("[data-pass-blank]"), "the dashes are still fading").not.toBeNull();
    expect(platform().textContent).toBe("PlatformAWS");
    await waitFor(() => expect(platform().querySelector("[data-pass-blank]")).toBeNull());
  });

  it("come back on the way back, saying not chosen again", () => {
    const { rerender } = render(<FillInPass stage="destination" values={AFTER} now="deck" onJump={() => {}} />);
    rerender(<FillInPass stage="destination" values={BEFORE} now="platform" onJump={() => {}} />);
    expect(platform().textContent).toBe("Platformnot chosen");
  });
});
