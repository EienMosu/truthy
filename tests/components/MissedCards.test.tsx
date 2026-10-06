// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  describe("scrolling an opened Why into the list", () => {
    // jsdom has no layout: the list is 200 tall, the explanation (with its link) runs from 150 to 300, and the
    // row that holds it is closed (0 tall) until the test lets it grow.
    let grown = false;
    // `column`: a box around the list that scrolls, 200 tall; the list then holds all of its content, 400 tall.
    function layout(column?: Element): HTMLElement {
      const region = screen.getByRole("region", { name: "Why, card 09" });
      const why = region.firstElementChild?.firstElementChild;
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
        if (this === column) return DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 200 });
        if (this.tagName === "OL") return DOMRect.fromRect({ x: 0, y: 0, width: 300, height: column ? 400 : 200 });
        if (this === why) return DOMRect.fromRect({ x: 0, y: 150, width: 300, height: 150 });
        if (this === region) return DOMRect.fromRect({ x: 0, y: 150, width: 300, height: grown ? 150 : 0 });
        return DOMRect.fromRect();
      });
      const list = screen.getByRole("list");
      list.scrollBy = vi.fn();
      return list;
    }

    beforeEach(() => {
      grown = false;
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"] });
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("waits until the row has grown, so a list that is still short does not stop the scroll", () => {
      render(<MissedCards missed={MISSED} />);
      fireEvent.click(screen.getByRole("button", { name: "Why, card 09" }));
      const list = layout();
      act(() => vi.advanceTimersByTime(500));
      expect(list.scrollBy).not.toHaveBeenCalled();
      grown = true;
      act(() => vi.advanceTimersByTime(20));
      // 16 px clear of the foot of the list: 300 + 16 - 200.
      expect(list.scrollBy).toHaveBeenCalledTimes(1);
      expect(list.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ top: 116 }));
    });

    // Review finding M1: under 568 tall the list holds all of its content and the result scrolls as one column, so
    // scrolling the list did nothing and the opened explanation stayed below the screen.
    it("scrolls the column around the list when the list has nothing to scroll", () => {
      render(
        <div data-column="" style={{ overflowY: "auto" }}>
          <MissedCards missed={MISSED} />
        </div>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Why, card 09" }));
      grown = true;
      const column = document.querySelector<HTMLElement>("[data-column]")!;
      const list = layout(column);
      column.scrollBy = vi.fn();
      Object.defineProperties(list, { scrollHeight: { value: 400 }, clientHeight: { value: 400 } });
      Object.defineProperties(column, { scrollHeight: { value: 900 }, clientHeight: { value: 200 } });
      act(() => vi.advanceTimersByTime(500));
      expect(list.scrollBy).not.toHaveBeenCalled();
      // 16 px clear of the foot of the column: 300 + 16 - 200.
      expect(column.scrollBy).toHaveBeenCalledTimes(1);
      expect(column.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ top: 116 }));
    });

    it("scrolls after about a second even if the row never reports its full height", () => {
      render(<MissedCards missed={MISSED} />);
      fireEvent.click(screen.getByRole("button", { name: "Why, card 09" }));
      const list = layout();
      act(() => vi.advanceTimersByTime(800));
      expect(list.scrollBy).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1000));
      expect(list.scrollBy).toHaveBeenCalledTimes(1);
    });
  });

  it("sets the code fragments of a statement and its explanation in the mono face, without their backticks", () => {
    const missed: MissedCard = {
      ...MISSED[0]!,
      statement: "`docker exec` can start a stopped container.",
      explanation: "It runs a command in a running container; `docker start` starts it.",
    };
    render(<MissedCards missed={[missed]} />);
    fireEvent.click(screen.getByRole("button", { name: "Why, card 03" }));
    const item = screen.getByRole("listitem");
    expect(item.textContent).toContain("docker exec can start a stopped container.");
    expect(item.textContent).toContain("It runs a command in a running container; docker start starts it.");
    expect(item.textContent).not.toContain("`");
    expect([...item.querySelectorAll("code")].map((code) => code.textContent)).toEqual(["docker exec", "docker start"]);
  });

  it("shows one calm line instead of an empty list when nothing was missed", () => {
    const { container } = render(<MissedCards missed={[]} />);
    expect(screen.getByRole("region", { name: "Missed cards" }).textContent).toBe("No missed cards");
    expect(screen.queryByRole("list")).toBeNull();
    expect(container.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("sunk");
  });
});
