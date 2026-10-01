// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContinueLine } from "@/components/start/ContinueLine";

afterEach(cleanup);

const ROUTE = { deckCode: "CLF", deckTitle: "Cloud Practitioner", sectionCode: "SEC", sectionTitle: "Security and compliance", modeLabel: "Classic" };

describe("ContinueLine", () => {
  it("is one button that names the route and the class in full", () => {
    const onContinue = vi.fn();
    render(<ContinueLine {...ROUTE} onContinue={onContinue} />);
    const button = screen.getByRole("button", { name: "Continue: Cloud Practitioner, Security and compliance, Classic." });
    expect(button.textContent).toBe("Continue where you left offCLF → SEC · Classic");
    fireEvent.click(button);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("adds the last score when it is known", () => {
    render(<ContinueLine {...ROUTE} lastScore={{ score: 7, total: 10 }} onContinue={() => {}} />);
    const button = screen.getByRole("button", { name: "Continue: Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10." });
    expect(button.textContent).toBe("Continue where you left offCLF → SEC · Classic · last 7 of 10");
    expect(button.querySelector("em")?.textContent).toBe("7 of 10");
  });

  it("is a 60 tall row, the same place and size as the pill it shares the foot with", () => {
    render(<ContinueLine {...ROUTE} onContinue={() => {}} />);
    expect(screen.getByRole("button").className).toContain("h-(--size-pill)");
  });
});
