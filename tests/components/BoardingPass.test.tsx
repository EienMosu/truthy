// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { AnimatePresence } from "motion/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  BoardingPass,
  BoardingPassPlaceholder,
  GateValue,
  PassLower,
  PassSlip,
  PassStatement,
  PassStub,
  barcodeBars,
} from "@/components/BoardingPass";

afterEach(cleanup);

function renderPass() {
  return render(
    <BoardingPass
      from={{ code: "CLF", name: "AWS Cloud Practitioner" }}
      to={{ code: "SEC", name: "Security and compliance" }}
      fields={[
        { label: "Class", value: "Classic" },
        { label: "Card", value: "04 / 10" },
        { label: "Gate", value: <GateValue /> },
      ]}
      lower={<PassLower tone="raised">lower part</PassLower>}
    >
      <p>body</p>
    </BoardingPass>,
  );
}

describe("BoardingPass", () => {
  it("shows both legs with their code and name", () => {
    const { container } = renderPass();
    expect(container.querySelector('[data-leg="from"]')?.textContent).toBe("CLFAWS Cloud Practitioner");
    expect(container.querySelector('[data-leg="to"]')?.textContent).toBe("SECSecurity and compliance");
  });

  it("lists the three fields as terms and values", () => {
    renderPass();
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    const values = screen.getAllByRole("definition").map((value) => value.textContent);
    expect(terms).toEqual(["Class", "Card", "Gate"]);
    expect(values.slice(0, 2)).toEqual(["Classic", "04 / 10"]);
  });

  it("reads the gate as words, not as arrows", () => {
    renderPass();
    const gate = screen.getAllByRole("definition")[2];
    expect(gate?.querySelector('[aria-hidden="true"]')?.textContent).toBe("F ← → T");
    expect(gate?.querySelector(".sr-only")?.textContent).toBe("False left, true right");
  });

  it("keeps the carrier band out of the accessible text", () => {
    const { container } = renderPass();
    const band = [...container.querySelectorAll('[aria-hidden="true"]')].find((element) => element.textContent?.includes("BOARDING PASS"));
    expect(band?.textContent).toBe("TruthyBOARDING PASS");
  });

  it("renders the body in the main part and the lower part after it", () => {
    const { container } = renderPass();
    expect(screen.getByText("body")).toBeTruthy();
    const lower = screen.getByText("lower part");
    expect(lower.getAttribute("data-tone")).toBe("raised");
    expect(container.querySelector("[data-boarding-pass]")?.lastElementChild).toBe(lower);
  });
});

describe("PassStatement", () => {
  it("shows the statement and can take focus without being a tab stop", () => {
    const { container } = render(<PassStatement>AWS patches the guest OS.</PassStatement>);
    const statement = container.querySelector<HTMLElement>("[data-statement]");
    expect(statement?.textContent).toBe("AWS patches the guest OS.");
    expect(statement?.getAttribute("tabindex")).toBe("-1");
  });

  it("shows appliesTo as one small line above the statement when it is set", () => {
    const { container } = render(<PassStatement appliesTo="Next.js 16">The cache is opt-in.</PassStatement>);
    const lines = [...container.querySelectorAll("[data-statement] p")].map((line) => line.textContent);
    expect(lines).toEqual(["Applies to Next.js 16", "The cache is opt-in."]);
  });

  it("shows no appliesTo line when it is empty", () => {
    const { container } = render(<PassStatement appliesTo="">The cache is opt-in.</PassStatement>);
    expect(container.querySelectorAll("[data-statement] p")).toHaveLength(1);
    expect(screen.queryByText(/Applies to/)).toBeNull();
  });

  it("PassStatement can be muted and live", () => {
    const plain = render(<PassStatement>The cache is opt-in.</PassStatement>).container.querySelector<HTMLElement>("[data-statement]");
    expect(plain?.hasAttribute("data-muted")).toBe(false);
    expect(plain?.hasAttribute("aria-live")).toBe(false);
    expect(plain?.querySelector("p")?.className).toContain("text-(--color-ink)");
    cleanup();
    const muted = render(<PassStatement muted>The cache is opt-in.</PassStatement>).container.querySelector<HTMLElement>("[data-statement]");
    expect(muted?.getAttribute("data-muted")).toBe("");
    expect(muted?.querySelector("p")?.className).toContain("text-(--color-ink-muted)");
    cleanup();
    const live = render(<PassStatement live>The cache is opt-in.</PassStatement>).container.querySelector<HTMLElement>("[data-statement]");
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.hasAttribute("data-muted")).toBe(false);
  });
});

describe("GateValue", () => {
  it("GateValue reads Closed when the gate is closed", () => {
    const { container } = render(
      <dd>
        <GateValue closed />
      </dd>,
    );
    const gate = container.querySelector("dd");
    expect(gate?.textContent).toBe("Closed");
    expect(gate?.querySelector(".sr-only")).toBeNull();
    expect(gate?.querySelector("span")?.className).toContain("text-(--color-ink-muted)");
    expect(gate?.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});

describe("PassSlip", () => {
  const source = { title: "Shared responsibility model", url: "https://aws.amazon.com/compliance/shared-responsibility-model/" };

  it("shows the right answer, the verdict, the explanation and the source", () => {
    render(<PassSlip answer={false} correct explanation="You patch the guest OS on EC2." source={source} />);
    expect(screen.getByText("The answer is").textContent).toBe("The answer isFalse");
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(screen.getByText("You patch the guest OS on EC2.")).toBeTruthy();
  });

  it("says Not quite and the right answer after a wrong answer", () => {
    const { container } = render(<PassSlip answer={true} correct={false} explanation="Explained." source={source} />);
    expect(container.querySelector("[data-verdict]")?.textContent).toBe("Not quite");
    expect(container.querySelector("b")?.textContent).toBe("True");
  });

  it("opens the source in a new tab, safely, and says so", () => {
    render(<PassSlip answer={false} correct explanation="Explained." source={source} />);
    const link = screen.getByRole("link", { name: "Shared responsibility model (opens in a new tab)" });
    expect(link.getAttribute("href")).toBe(source.url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("PassSlip shows New best in place of Correct when asked", () => {
    const { container } = render(<PassSlip answer={false} correct newBest explanation="Explained." source={source} />);
    expect(container.querySelector('[data-verdict="new-best"]')).not.toBeNull();
    expect(container.querySelector('[data-verdict="correct"]')).toBeNull();
  });

  it("sits on the sunk paper", () => {
    const { container } = render(<PassSlip answer={false} correct explanation="Explained." source={source} />);
    expect(container.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("sunk");
  });

  // Overpass draws a backtick as an accent with no width over the next letter ("`x" reads as an x with a grave).
  it("sets a code fragment of the explanation in the mono face, without its backticks", () => {
    const { container } = render(<PassSlip answer={false} correct explanation="Only `docker start` starts it again." source={source} />);
    expect(screen.getByText(/starts it again\.$/).textContent).toBe("Only docker start starts it again.");
    expect(container.querySelector("code")?.textContent).toBe("docker start");
  });
});

describe("PassStub", () => {
  function renderStub() {
    return render(
      <AnimatePresence>
        <PassStub routeLine="CLF → SEC · Classic" cardLabel="Card 04" barcode="aws-clf-c02-t2.1-06" />
      </AnimatePresence>,
    );
  }

  it("shows the route line, the card number and the swipe hint", () => {
    const { container } = renderStub();
    const stub = container.querySelector("[data-stub]");
    expect(stub?.textContent).toContain("CLF → SEC · Classic");
    expect(stub?.textContent).toContain("Card 04");
    expect(stub?.textContent).toContain("← False");
    expect(stub?.textContent).toContain("swipe to board");
    expect(stub?.textContent).toContain("True →");
  });

  it("is decorative: hidden from screen readers (the buttons say the same)", () => {
    const { container } = renderStub();
    expect(container.querySelector("[data-stub]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("draws the barcode from the data it is given", () => {
    const { container } = renderStub();
    const barcode = container.querySelector("[data-barcode]");
    const { bars, width } = barcodeBars("aws-clf-c02-t2.1-06");
    expect(barcode?.getAttribute("viewBox")).toBe(`0 0 ${width} 56`);
    expect(barcode?.querySelectorAll("rect")).toHaveLength(bars.length);
  });

  it("carries the True and False intent stamps, driven by --intent", () => {
    const { container } = renderStub();
    const trueStamp = container.querySelector<HTMLElement>('[data-intent="true"]');
    const falseStamp = container.querySelector<HTMLElement>('[data-intent="false"]');
    expect(trueStamp?.textContent).toBe("True");
    expect(falseStamp?.textContent).toBe("False");
    expect(trueStamp?.style.opacity).toContain("var(--intent, 0)");
    expect(falseStamp?.style.opacity).toContain("-1");
  });

  it("PassStub shows a stamp and one hint line in place of the swipe hint", () => {
    const { container } = render(
      <AnimatePresence>
        <PassStub
          routeLine="CLF → SEC · Timed"
          cardLabel="Card 12"
          barcode="aws-clf-c02-t2.1-06"
          stamp={<span data-test-stamp="">Correct</span>}
          hint="Next card coming up"
        />
      </AnimatePresence>,
    );
    const stub = container.querySelector("[data-stub]");
    expect(stub?.textContent).toContain("Next card coming up");
    expect(stub?.textContent).toContain("Card 12");
    expect(stub?.textContent).not.toContain("swipe to board");
    expect(stub?.textContent).not.toContain("← False");
    expect(container.querySelector("[data-intent]")).toBeNull();
    const stamp = container.querySelector("[data-test-stamp]");
    expect(stamp).not.toBeNull();
    expect(stamp?.parentElement?.className).toContain("top-[96px]");
    expect(stamp?.parentElement?.className).toContain("left-1/2");
  });
});

describe("barcodeBars", () => {
  it("starts with bars 2/1/1/2 and ends with 1/1/2", () => {
    const { bars, width } = barcodeBars("A");
    expect(bars[0]).toEqual({ x: 0, width: 2 });
    expect(bars[1]).toEqual({ x: 3, width: 1 });
    expect(bars.at(-1)).toEqual({ x: width - 2, width: 2 });
    expect(bars.at(-2)).toEqual({ x: width - 4, width: 1 });
  });

  it("gives each character 7 bars and a gap, 2 wide for a 1 bit and 1 wide for a 0 bit", () => {
    // "A" is 1000001: bits 0 and 6 are 1, so 2+1+1+1+1+1+2 = 9, plus the 1-wide gap.
    expect(barcodeBars("A").width).toBe(6 + 10 + 4);
    expect(barcodeBars("AA").width).toBe(6 + 20 + 4);
  });

  it("is the same for the same data and different for different data", () => {
    expect(barcodeBars("aws-clf-c02-t2.1-06")).toEqual(barcodeBars("aws-clf-c02-t2.1-06"));
    expect(barcodeBars("aws-clf-c02-t2.1-06")).not.toEqual(barcodeBars("aws-clf-c02-t2.1-07"));
  });
});

describe("BoardingPassPlaceholder", () => {
  it("is a quiet, decorative shape with no text", () => {
    const { container } = render(<BoardingPassPlaceholder />);
    const placeholder = container.querySelector("[data-pass-placeholder]");
    expect(placeholder?.getAttribute("aria-hidden")).toBe("true");
    expect(placeholder?.textContent).toBe("");
  });
});
