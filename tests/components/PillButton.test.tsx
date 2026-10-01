// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PillButton } from "@/components/PillButton";
import { ReplayIcon } from "@/components/icons";

afterEach(cleanup);

describe("PillButton", () => {
  it("is a button named by its label", () => {
    render(<PillButton>Start round</PillButton>);
    expect(screen.getByRole("button", { name: "Start round" })).toBeTruthy();
  });

  it("keeps a trailing arrow out of the accessible name", () => {
    render(<PillButton trailingIcon="→">Next card</PillButton>);
    const button = screen.getByRole("button", { name: "Next card" });
    expect(button.textContent).toBe("Next card→");
    expect(button.lastElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows a leading icon before the label, hidden from screen readers", () => {
    render(<PillButton leadingIcon={<ReplayIcon />}>Play again</PillButton>);
    const button = screen.getByRole("button", { name: "Play again" });
    const first = button.firstElementChild;
    expect(first?.getAttribute("aria-hidden")).toBe("true");
    expect(first?.querySelector("svg")).not.toBeNull();
  });

  it("calls onClick when pressed and does not submit a surrounding form", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PillButton onClick={onClick}>Next card</PillButton>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is a 60 px, full-width ink pill by default", () => {
    render(<PillButton>Play again</PillButton>);
    const button = screen.getByRole("button", { name: "Play again" });
    expect(button.className).toContain("h-(--size-pill)");
    expect(button.className).toContain("w-full");
    expect(button.className).toContain("bg-(--color-ink)");
    expect(button.className).toContain("text-(--color-on-dark)");
    expect(button.dataset.tone).toBe("ink");
  });

  it("takes the true and false fills for the answer buttons", () => {
    render(
      <>
        <PillButton tone="true">True</PillButton>
        <PillButton tone="false">False</PillButton>
      </>,
    );
    expect(screen.getByRole("button", { name: "True" }).className).toContain("bg-(--color-true)");
    expect(screen.getByRole("button", { name: "False" }).className).toContain("bg-(--color-false)");
  });

  it("does not call onClick while disabled", () => {
    const onClick = vi.fn();
    render(
      <PillButton disabled onClick={onClick}>
        Next card
      </PillButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards a ref so focus can move to it after an answer", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<PillButton ref={ref}>Next card</PillButton>);
    ref.current?.focus();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next card" }));
  });
});
