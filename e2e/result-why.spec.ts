import { expect, test, type Page } from "@playwright/test";
import { expectResult, playRound } from "./helpers";

// The Associate deck has the longest explanations of the decks.
const SAA_ID = "aws-saa-c03";
// The fade at the foot of the missed-card list (28 px) hides what scrolls under it.
const FADE = 28;

async function openWholeSaaClassic(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.setItem("truthy.pending.v1", JSON.stringify({ route: { deckId: "aws-saa-c03", sectionId: "ALL" }, mode: "classic" }));
  });
  await page.goto("/play");
}

// What of the opened card the player sees: the list box, cut at its fade and at the top of the opaque "Play
// again" pill, against the explanation and the source link of the card.
async function measureOpened(page: Page, n: number) {
  return page.evaluate(
    ({ n, fade }) => {
      const item = document.querySelector(`[data-missed-card="${n}"]`);
      const list = item?.closest("ol")?.getBoundingClientRect();
      const explanation = item?.querySelector("[role=region] p")?.getBoundingClientRect();
      const link = item?.querySelector("[role=region] a")?.getBoundingClientRect();
      const pill = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Play again"))?.getBoundingClientRect();
      if (!list || !explanation || !link || !pill) throw new Error(`Card ${n} is not on the list`);
      const top = list.top;
      const bottom = Math.min(list.bottom - fade, pill.top);
      return {
        top,
        bottom,
        explanationTop: explanation.top,
        explanationBottom: explanation.bottom,
        linkBottom: link.bottom,
      };
    },
    { n, fade: FADE },
  );
}

// Each Why the player opens shows its explanation from its first line, as much of it as the list can show,
// and the source link under it whenever the explanation and the link fit in the list together (design
// system 5.15: the list scrolls the opened item into view; review finding U30).
async function expectEveryWhyInView(page: Page): Promise<void> {
  // A player scrolls the result to the list first: on a short phone the stage scrolls, and its end shows the
  // whole ticket above "Play again".
  await page.locator("[data-boarding-pass]").locator("..").evaluate((scroller) => {
    scroller.scrollTop = scroller.scrollHeight;
  });
  for (let n = 1; n <= 10; n += 1) {
    const number = String(n).padStart(2, "0");
    const why = page.getByRole("button", { name: `Why, card ${number}` });
    await why.click();
    await expect(why).toHaveAttribute("aria-expanded", "true");
    await expect
      .poll(
        async () => {
          const m = await measureOpened(page, n);
          const shown = m.bottom - m.top;
          const problems: string[] = [];
          if (m.explanationTop < m.top - 0.5) problems.push("the first line of the explanation is above the list");
          const explanationSeen = Math.min(m.explanationBottom, m.bottom) - Math.max(m.explanationTop, m.top);
          if (explanationSeen < Math.min(m.explanationBottom - m.explanationTop, shown) - 0.5) problems.push("the explanation is cut off");
          if (m.linkBottom - m.explanationTop <= shown && m.linkBottom > m.bottom + 0.5) problems.push("the source link is out of view");
          return problems.length === 0 ? "" : `card ${number}: ${problems.join(", ")} ${JSON.stringify(m)}`;
        },
        { timeout: 3_000 },
      )
      .toBe("");
    await why.click();
    await expect(why).toHaveAttribute("aria-expanded", "false");
  }
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
]) for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test.describe(`the opened Why of a missed card on a ${viewport.width} by ${viewport.height} screen, ${reducedMotion === "reduce" ? "with" : "without"} reduced motion`, () => {
    test.use({ viewport, reducedMotion });

    test("shows the explanation from its first line and the source link, for each of ten missed cards", async ({ page }) => {
      test.setTimeout(90_000);
      await openWholeSaaClassic(page);
      await playRound(page, SAA_ID, (_, truth) => !truth);
      await expectResult(page, 0);
      await expectEveryWhyInView(page);
    });
  });
}
