// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DestinationCard, ProgressTrack } from "@/components/DestinationCard";

afterEach(cleanup);

describe("DestinationCard", () => {
  it("is a button named by its full label, showing the name and the sub-line", () => {
    const onSelect = vi.fn();
    render(<DestinationCard variant="place" name="Cloud" sub="2 decks" label="Cloud, 2 decks" onSelect={onSelect} />);
    const button = screen.getByRole("button", { name: "Cloud, 2 decks" });
    expect(button.textContent).toBe("Cloud2 decks");
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("draws a place card 104 tall with a 64 stub holding only the chevron", () => {
    render(<DestinationCard variant="place" name="AWS" sub="1 deck" label="AWS, 1 deck" />);
    const button = screen.getByRole("button", { name: "AWS, 1 deck" });
    expect(button.className).toContain("min-h-(--size-card-min)");
    expect(button.style.gridTemplateColumns).toBe("minmax(0, 1fr) var(--size-card-stub)");
    expect(button.querySelectorAll("svg")).toHaveLength(1);
  });

  it("shows a deck's code, title, progress and card count", () => {
    render(
      <DestinationCard
        variant="deck"
        name="CLF"
        code
        detail="Cloud Practitioner"
        seenPercent={38}
        stub={{ label: "Cards", value: "214" }}
        label="CLF, Cloud Practitioner, 214 cards, 38 percent seen"
      />,
    );
    const button = screen.getByRole("button", { name: "CLF, Cloud Practitioner, 214 cards, 38 percent seen" });
    expect(button.className).toContain("min-h-(--size-card-min-deck)");
    expect(button.querySelector("[data-status]")?.textContent).toBe("38% seen");
    expect(button.querySelector<HTMLElement>("[data-seen]")?.style.width).toBe("38%");
    expect(button.textContent).toContain("Cards214");
  });

  it("says Not started and draws only the dashed track when nothing is seen", () => {
    render(<DestinationCard variant="deck" name="CDL" code detail="Cloud Digital Leader" seenPercent={0} stub={{ label: "Cards", value: "133" }} label="CDL" />);
    expect(screen.getByRole("button", { name: "CDL" }).querySelector("[data-status]")?.textContent).toBe("Not started");
    expect(document.querySelector("[data-seen]")).toBeNull();
  });

  it("shows a class's best with its unit, and no chevron", () => {
    render(
      <DestinationCard
        variant="class"
        name="Classic"
        detail="10 cards, score at the end."
        stub={{ label: "Best", value: "9", unit: "of 10" }}
        label="Classic. 10 cards, score at the end. Your best: 9 of 10."
      />,
    );
    const button = screen.getByRole("button", { name: "Classic. 10 cards, score at the end. Your best: 9 of 10." });
    expect(button.textContent).toBe("Classic10 cards, score at the end.Best9of 10");
    expect(button.querySelectorAll("svg")).toHaveLength(0);
  });

  it("is not a button when its option is not available: a labelled, disabled group", () => {
    const onSelect = vi.fn();
    render(<DestinationCard variant="place" name="DevOps" sub="No decks yet" label="DevOps, no decks yet" unavailable onSelect={onSelect} />);
    expect(screen.queryByRole("button")).toBeNull();
    const group = screen.getByRole("group", { name: "DevOps, no decks yet" });
    expect(group.getAttribute("aria-disabled")).toBe("true");
    expect(group.textContent).toBe("DevOpsNo decks yet");
    fireEvent.click(group);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("draws a deck that cannot be played now dimmed: a labelled, disabled group with the reason in the stub", () => {
    const onSelect = vi.fn();
    render(
      <DestinationCard
        variant="deck"
        name="SAA"
        code
        detail="Solutions Architect Associate"
        seenPercent={0}
        stub={{ label: "Cards", value: "248" }}
        dimmedReason="Needs a connection"
        label="SAA, Solutions Architect Associate, needs a connection"
        onSelect={onSelect}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    const group = screen.getByRole("group", { name: "SAA, Solutions Architect Associate, needs a connection" });
    expect(group.getAttribute("aria-disabled")).toBe("true");
    expect(group.hasAttribute("data-dimmed")).toBe(true);
    // The reason takes the place of the count: no "Cards", no number, no chevron.
    expect(group.textContent).toBe("SAASolutions Architect AssociateNot startedNeeds a connection");
    expect(group.querySelector("[data-stub-reason]")?.textContent).toBe("Needs a connection");
    expect(group.querySelectorAll("svg")).toHaveLength(0);
    fireEvent.click(group);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps a dimmed deck card the size and shape of a deck card, in sunk paper and muted ink without a shadow", () => {
    render(<DestinationCard variant="deck" name="SAA" code detail="Solutions Architect Associate" seenPercent={0} dimmedReason="Needs a connection" label="SAA" />);
    const group = screen.getByRole("group", { name: "SAA" });
    expect(group.className).toContain("min-h-(--size-card-min-deck)");
    expect(group.className).toContain("text-(--color-ink-muted)");
    expect(group.className).not.toContain("shadow-");
    expect(group.style.gridTemplateColumns).toBe("minmax(0, 1fr) var(--size-card-stub-deck)");
    expect(group.style.background).toContain("var(--color-surface-sunk)");
    expect(group.style.background).not.toContain("var(--color-surface-raised)");
  });

  it("shows the seen share of a dimmed deck in muted ink too", () => {
    render(<DestinationCard variant="deck" name="CLF" code detail="Cloud Practitioner" seenPercent={38} dimmedReason="Needs a connection" label="CLF" />);
    const share = screen.getByRole("group", { name: "CLF" }).querySelector("[data-status] b");
    expect(share?.textContent).toBe("38%");
    expect(share?.className).not.toContain("text-(--color-ink)");
  });

  it("writes every class attribute of a deck card, dimmed or not, without a leading, trailing or double space", () => {
    for (const seenPercent of [0, 38]) {
      for (const dimmedReason of [undefined, "Needs a connection"]) {
        const { container, unmount } = render(
          <DestinationCard variant="deck" name="CLF" code detail="Cloud Practitioner" seenPercent={seenPercent} dimmedReason={dimmedReason} stub={{ label: "Cards", value: "214" }} label="CLF" />,
        );
        const classes = [...container.querySelectorAll("[class]")].map((element) => element.getAttribute("class") ?? "");
        expect(classes.length).toBeGreaterThan(5);
        for (const value of classes) expect(value, `${seenPercent}% ${dimmedReason ?? "playable"}: "${value}"`).toMatch(/^\S+( \S+)*$/);
        unmount();
      }
    }
  });

  it("writes the class attributes of a class card, with a muted stub value or not, without a stray space too", () => {
    for (const muted of [true, false]) {
      const { container, unmount } = render(
        <DestinationCard variant="class" name="Classic" detail="Correct answers out of 10 cards." stub={{ label: "Best", value: muted ? "–" : "9", unit: muted ? "not played" : "of 10", muted }} label="Classic" />,
      );
      for (const element of container.querySelectorAll("[class]")) expect(element.getAttribute("class"), `muted ${muted}, ${element.tagName}`).toMatch(/^\S+( \S+)*$/);
      unmount();
    }
  });

  it("draws the track of a dimmed deck at the disabled opacity and leaves the reason in the stub at full strength", () => {
    render(<DestinationCard variant="deck" name="CLF" code detail="Cloud Practitioner" seenPercent={38} dimmedReason="Needs a connection" label="CLF" />);
    const group = screen.getByRole("group", { name: "CLF" });
    expect(group.querySelector("[data-track]")?.hasAttribute("data-dimmed")).toBe(true);
    expect(group.querySelector("[data-track]")?.className).toContain("opacity-(--opacity-disabled)");
    // Opacity lowers the contrast of whatever it covers, so none of it may reach the label that says why.
    const reason = group.querySelector("[data-stub-reason]");
    for (let node = reason; node && node !== group.parentElement; node = node.parentElement) {
      expect(node.className, node.tagName).not.toContain("opacity-");
    }
  });

  it("keeps the track of a playable deck at full strength", () => {
    render(<DestinationCard variant="deck" name="CLF" code detail="Cloud Practitioner" seenPercent={38} stub={{ label: "Cards", value: "214" }} label="CLF" />);
    const track = screen.getByRole("button", { name: "CLF" }).querySelector("[data-track]");
    expect(track?.hasAttribute("data-dimmed")).toBe(false);
    expect(track?.className).not.toContain("opacity-");
  });

  it("can hide its name while a copy of it travels into the pass", () => {
    render(<DestinationCard variant="place" name="Cloud" sub="2 decks" label="Cloud" nameHidden />);
    expect(document.querySelector<HTMLElement>("[data-card-name]")?.style.visibility).toBe("hidden");
  });
});

describe("ProgressTrack", () => {
  it("is decorative", () => {
    const { container } = render(<ProgressTrack percent={12} />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("is drawn at the disabled opacity only when dimmed", () => {
    const { container, rerender } = render(<ProgressTrack percent={12} />);
    expect(container.firstElementChild?.hasAttribute("data-dimmed")).toBe(false);
    rerender(<ProgressTrack percent={12} dimmed />);
    expect(container.firstElementChild?.hasAttribute("data-dimmed")).toBe(true);
    expect(container.firstElementChild?.className).toContain("opacity-(--opacity-disabled)");
  });
});
