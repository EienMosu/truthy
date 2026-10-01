// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Home from "@/app/page";

afterEach(cleanup);

describe("placeholder home page", () => {
  it("shows the game name as the only top-level heading", () => {
    render(<Home />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toBe("Truthy");
  });

  it("says what the game is in one line", () => {
    render(<Home />);
    expect(screen.getByText("A true or false card game that teaches IT, one swipe at a time.")).toBeTruthy();
  });

  it("puts its content inside a main landmark", () => {
    render(<Home />);
    expect(screen.getByRole("main").textContent).toContain("Truthy");
  });
});
