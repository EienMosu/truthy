// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CardText } from "@/components/CardText";

afterEach(cleanup);

describe("CardText", () => {
  it("sets each code fragment in the mono face and shows no backtick", () => {
    const { container } = render(
      <p>
        <CardText text="An `asserts x is string` function narrows `x`." />
      </p>,
    );
    expect(container.textContent).toBe("An asserts x is string function narrows x.");
    const code = [...container.querySelectorAll("code")];
    expect(code.map((element) => element.textContent)).toEqual(["asserts x is string", "x"]);
    for (const element of code) expect(element.className).toContain("font-(family-name:--font-mono)");
  });

  it("draws a backtick without a partner in the mono face too, where it has a width", () => {
    const { container } = render(
      <p>
        <CardText text="one ` two" />
      </p>,
    );
    expect(container.textContent).toBe("one ` two");
    expect(container.querySelector("code")?.textContent).toBe("`");
  });

  it("renders a text without backticks as it is, with no code element", () => {
    const { container } = render(
      <p>
        <CardText text="AWS patches the host." />
      </p>,
    );
    expect(container.textContent).toBe("AWS patches the host.");
    expect(container.querySelector("code")).toBeNull();
  });
});
