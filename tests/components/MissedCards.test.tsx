// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MissedCards, missedCards, type MissedCard } from "@/components/MissedCards";
import type { Answered } from "@/src/engine/round";
import { DECK } from "./play/fixtures";

afterEach(cleanup);

const MISSED: MissedCard[] = [
  {
    number: 3,
    given: true,
    answer: false,
    statement: "Amazon EC2 Auto Scaling distributes incoming application requests among running instances.",
    explanation: "Elastic Load Balancing distributes incoming requests.",
    source: { title: "Elastic Load Balancing", url: "https://docs.aws.amazon.com/elasticloadbalancing/" },
  },
  {
    number: 9,
    given: false,
    answer: true,
    statement: "Security awareness training is a shared control.",
    explanation: "Both sides train their own people.",
    source: { title: "Shared responsibility model", url: "https://aws.amazon.com/compliance/shared-responsibility-model/" },
  },
];

describe("missedCards", () => {
  it("keeps the wrong answers in order, numbered by their place in the round", () => {
    const [a, b, c] = DECK.cards;
    if (!a || !b || !c) throw new Error("the fixture deck has fewer than three cards");
    const answers: Answered[] = [
      { card: a, given: a.answer, correct: true, at: 1 },
      { card: b, given: !b.answer, correct: false, at: 2 },
      { card: c, given: !c.answer, correct: false, at: 3 },
    ];
    expect(missedCards(answers)).toEqual([
      { number: 2, given: !b.answer, answer: b.answer, statement: b.text.en.statement, explanation: b.text.en.explanation, source: b.source },
      { number: 3, given: !c.answer, answer: c.answer, statement: c.text.en.statement, explanation: c.text.en.explanation, source: c.source },
    ]);
  });
});

describe("MissedCards", () => {
  it("is a section named Missed cards with a count to review", () => {
    render(<MissedCards missed={MISSED} />);
    const section = screen.getByRole("region", { name: "Missed cards" });
    expect(within(section).getByText("2 to review")).toBeTruthy();
    expect(within(section).getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows each card's number, what the player said, the statement and the right answer", () => {
    render(<MissedCards missed={MISSED} />);
    const [first, second] = screen.getAllByRole("listitem");
    expect(first?.textContent).toContain("Card 03");
    expect(first?.textContent).toContain("You said True");
    expect(first?.textContent).toContain(MISSED[0]?.statement);
    expect(first?.textContent).toContain("Answer False");
    expect(second?.textContent).toContain("Card 09");
    expect(second?.textContent).toContain("You said False");
    expect(second?.textContent).toContain("Answer True");
  });

  it("keeps the explanation and the source closed until Why is pressed", () => {
    render(<MissedCards missed={MISSED} />);
    const why = screen.getByRole("button", { name: "Why, card 03" });
    expect(why.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("region", { name: "Why, card 03" })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("reveals the explanation and the source link in a labelled region when Why is pressed", () => {
    render(<MissedCards missed={MISSED} />);
    const why = screen.getByRole("button", { name: "Why, card 03" });
    fireEvent.click(why);
    expect(why.getAttribute("aria-expanded")).toBe("true");
    const region = screen.getByRole("region", { name: "Why, card 03" });
    expect(why.getAttribute("aria-controls")).toBe(region.id);
    expect(within(region).getByText("Elastic Load Balancing distributes incoming requests.")).toBeTruthy();
    const link = within(region).getByRole("link", { name: "Elastic Load Balancing (opens in a new tab)" });
    expect(link.getAttribute("href")).toBe("https://docs.aws.amazon.com/elasticloadbalancing/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    // Only the card that was opened.
    expect(screen.getByRole("button", { name: "Why, card 09" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("closes again on a second press", () => {
    render(<MissedCards missed={MISSED} />);
    const why = screen.getByRole("button", { name: "Why, card 03" });
    fireEvent.click(why);
    fireEvent.click(why);
    expect(why.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("is a native button, so the keyboard reaches and works it, and the closed source link is out of the tab order", () => {
    render(<MissedCards missed={MISSED} />);
    const why = screen.getByRole("button", { name: "Why, card 03" });
    expect(why.tagName).toBe("BUTTON");
    expect(why.getAttribute("type")).toBe("button");
    why.focus();
    expect(document.activeElement).toBe(why);
    const closed = document.getElementById(why.getAttribute("aria-controls") ?? "");
    expect(closed?.hasAttribute("inert")).toBe(true);
    fireEvent.click(why);
    expect(closed?.hasAttribute("inert")).toBe(false);
  });

  it("shows one calm line instead of an empty list when nothing was missed", () => {
    const { container } = render(<MissedCards missed={[]} />);
    expect(screen.getByRole("region", { name: "Missed cards" }).textContent).toBe("No missed cards");
    expect(screen.queryByRole("list")).toBeNull();
    expect(container.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("sunk");
  });
});
