// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoundButton } from "@/components/RoundButton";
import { CloseIcon } from "@/components/icons";

afterEach(cleanup);

describe("RoundButton", () => {
  it("is a button named by its label, not by its icon", () => {
    render(
      <RoundButton label="Leave round">
        <CloseIcon />
      </RoundButton>,
    );
    const button = screen.getByRole("button", { name: "Leave round" });
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    render(
      <RoundButton label="Close results" onClick={onClick}>
        <CloseIcon />
      </RoundButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close results" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not submit a surrounding form", () => {
    const onSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <RoundButton label="Leave round">
          <CloseIcon />
        </RoundButton>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is 48 px round and raised by default", () => {
    render(
      <RoundButton label="Leave round">
        <CloseIcon />
      </RoundButton>,
    );
    const button = screen.getByRole("button", { name: "Leave round" });
    expect(button.className).toContain("size-(--size-round-button)");
    expect(button.className).toContain("rounded-full");
    expect(button.className).toContain("shadow-(--elevation-small)");
    expect(button.dataset.variant).toBe("raised");
  });

  it("has a sunk variant with no shadow", () => {
    render(
      <RoundButton label="Close" variant="sunk">
        <CloseIcon />
      </RoundButton>,
    );
    const button = screen.getByRole("button", { name: "Close" });
    expect(button.className).toContain("bg-(--color-surface-sunk)");
    expect(button.className).not.toContain("shadow-");
  });

  it("forwards a ref so a screen can move focus to it", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <RoundButton label="Leave round" ref={ref}>
        <CloseIcon />
      </RoundButton>,
    );
    ref.current?.focus();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Leave round" }));
  });
});
