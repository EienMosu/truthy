// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuietButton } from "@/components/QuietButton";
import { RouteIcon } from "@/components/icons";

afterEach(cleanup);

describe("QuietButton", () => {
  it("is a button named by its label, with the leading icon hidden from screen readers", () => {
    render(<QuietButton leadingIcon={<RouteIcon />}>Choose another route</QuietButton>);
    const button = screen.getByRole("button", { name: "Choose another route" });
    expect(button.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("works without an icon", () => {
    render(<QuietButton>Choose another route</QuietButton>);
    expect(screen.getByRole("button", { name: "Choose another route" }).querySelector("svg")).toBeNull();
  });

  it("calls onClick when pressed and does not submit a surrounding form", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <QuietButton onClick={onClick}>Choose another route</QuietButton>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose another route" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is 48 px tall with no fill, in the quiet button type role", () => {
    render(<QuietButton>Choose another route</QuietButton>);
    const button = screen.getByRole("button", { name: "Choose another route" });
    expect(button.className).toContain("h-(--size-pill-small)");
    expect(button.className).toContain("text-(length:--type-button-quiet-size)");
    expect(button.className).not.toContain("bg-");
    expect(button.className).not.toContain("shadow-");
  });
});
