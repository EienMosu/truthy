// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnswerButtons } from "@/components/AnswerButtons";

afterEach(cleanup);

describe("AnswerButtons", () => {
  it("shows two real buttons named False and True, False first (on the left)", () => {
    render(<AnswerButtons onAnswer={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["False", "True"]);
    expect(screen.getByRole("button", { name: "False" })).toBe(buttons[0]);
    expect(screen.getByRole("button", { name: "True" })).toBe(buttons[1]);
  });

  it("answers false with the False button and true with the True button", () => {
    const onAnswer = vi.fn();
    render(<AnswerButtons onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: "False" }));
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    expect(onAnswer.mock.calls).toEqual([[false], [true]]);
  });

  it("does not rely on colour: each button carries an icon and its word", () => {
    render(<AnswerButtons onAnswer={() => {}} />);
    const falseButton = screen.getByRole("button", { name: "False" });
    const trueButton = screen.getByRole("button", { name: "True" });
    expect(falseButton.querySelector("svg path")?.getAttribute("d")).toBe("M3 3l10 10M13 3L3 13");
    expect(trueButton.querySelector("svg path")?.getAttribute("d")).toBe("M3 9.5l4 4 8-9");
    expect(falseButton.className).toContain("bg-(--color-false)");
    expect(trueButton.className).toContain("bg-(--color-true)");
  });

  it("ignores presses while disabled and says so to assistive technology", () => {
    const onAnswer = vi.fn();
    render(<AnswerButtons onAnswer={onAnswer} disabled />);
    for (const name of ["False", "True"]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(button);
    }
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("keeps focus on the pressed button when it becomes disabled (Timed beat)", () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<AnswerButtons onAnswer={onAnswer} />);
    const trueButton = screen.getByRole("button", { name: "True" });
    trueButton.focus();
    fireEvent.click(trueButton);
    rerender(<AnswerButtons onAnswer={onAnswer} disabled />);
    expect(document.activeElement).toBe(trueButton);
    expect(trueButton.hasAttribute("disabled")).toBe(false);
    rerender(<AnswerButtons onAnswer={onAnswer} />);
    expect(trueButton.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(trueButton);
    expect(onAnswer.mock.calls).toEqual([[true], [true]]);
  });
});
