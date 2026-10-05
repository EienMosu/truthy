import { expect, test, type Locator, type Page } from "@playwright/test";
import { CDL_WHOLE, CLF_SECURITY, RND_ID, chooseRoute, inClass, openHome, openPendingRound, startRound } from "./helpers";

test.use({ reducedMotion: "reduce" });

// The values on the pass and the ticket are never split or cut: each is one line, whole, on the smallest
// supported phone too. Measured in the browser, since jsdom has no layout.

/** The height of each value of a field grid and its line height, by its term ("Class", "Card", ...). */
async function fieldLines(grid: Locator): Promise<Record<string, { height: number; line: number }>> {
  return grid.evaluate((dl) =>
    Object.fromEntries(
      [...dl.querySelectorAll(":scope > div")].map((group) => {
        const dd = group.querySelector("dd");
        if (dd === null) throw new Error("A field without a value");
        return [group.querySelector("dt")?.textContent ?? "", { height: dd.getBoundingClientRect().height, line: parseFloat(getComputedStyle(dd).lineHeight) }];
      }),
    ),
  );
}

async function expectOneLineEach(grid: Locator, labels: readonly string[]): Promise<void> {
  const lines = await fieldLines(grid);
  expect(Object.keys(lines)).toEqual(labels);
  for (const [label, { height, line }] of Object.entries(lines)) {
    expect(height, `the ${label} value takes one line`).toBeLessThanOrEqual(line + 0.5);
  }
}

function ticketFields(page: Page): Locator {
  return page.locator("[data-boarding-pass] dl").first();
}

// Review finding U29: "01 / 10" broke after its slash at 320 px, and "Three lives" over two lines at 320 and 360.
for (const { width, height, mode, name } of [
  { width: 320, height: 568, mode: "classic", name: "Classic" },
  { width: 320, height: 568, mode: "lives", name: "Three lives" },
  { width: 360, height: 740, mode: "lives", name: "Three lives" },
  { width: 320, height: 568, mode: "timed", name: "Timed" },
] as const) {
  test(`the ticket's Class, Card and Gate of ${name} are each one line at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openPendingRound(page, mode);
    await expect(ticketFields(page)).toContainText(name);
    await expectOneLineEach(ticketFields(page), ["Class", "Card", "Gate"]);
  });
}

test("the ready pass of Three lives keeps its Class, Cards and Gate on one line each at 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openHome(page);
  await chooseRoute(page, inClass(CLF_SECURITY, "Three lives"));
  await expectOneLineEach(page.locator("[data-fill-in-pass] dl"), ["Class", "Cards", "Gate"]);
});

// Review finding U33: at 320 px "Whole deck" was cut to "Whole d…" in the Section field.
for (const width of [320, 360]) {
  test(`the Section field shows "Whole deck" whole at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await openHome(page);
    await chooseRoute(page, CDL_WHOLE);
    await page.getByRole("button", { name: "Back to classes" }).click();
    const section = page.locator('[data-fill-in-pass="route"] [data-pass-value="section"]');
    await expect(section).toHaveText("Whole deck");
    const fit = await section.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(fit.scroll).toBeLessThanOrEqual(fit.client);
  });
}

type DeckIndex = { areas: { platforms: { decks: { id: string }[] }[] }[] };

// Review finding U95: the appliesTo qualifier is one small line above the statement (spec section 9), shown
// without an "Applies to" in front. Every qualifier of every shipped deck is set into the line of a Next.js card
// in turn, on the smallest supported phone: each is one line, since a second line pushes the statement down and
// can part a setting from its value ("cacheComponents:" from "false").
test("the appliesTo line shows the qualifier alone, and every shipped qualifier is one line at 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openHome(page);
  await chooseRoute(page, { area: /^Frontend, /, platform: /^Next\.js, /, deck: /^RND, /, section: /^Whole deck, /, mode: /^Classic\. / });
  await startRound(page);
  const line = page.locator("[data-statement] [data-applies-to]");
  await expect(line).toBeVisible();
  await expect(line.locator("[aria-hidden]")).not.toContainText("Applies to");
  await expect(line.locator(".sr-only")).toHaveText(/^Applies to /);

  const index = (await (await page.request.get("/decks/index.json")).json()) as DeckIndex;
  const ids = index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks.map((deck) => deck.id)));
  expect(ids).toContain(RND_ID);
  const qualifiers = new Set<string>();
  for (const id of ids) {
    const deck = (await (await page.request.get(`/decks/${id}.json`)).json()) as { cards: { appliesTo: string }[] };
    for (const card of deck.cards) if (card.appliesTo !== "") qualifiers.add(card.appliesTo);
  }
  expect(qualifiers.size).toBeGreaterThan(1);
  const measured = await line.evaluate((p, texts) => {
    const shown = p.querySelector("[aria-hidden]");
    if (shown === null) throw new Error("No visible qualifier");
    const lineHeight = parseFloat(getComputedStyle(p).lineHeight);
    return texts.map((text) => {
      shown.textContent = text;
      return { text, lines: Math.round(p.getBoundingClientRect().height / lineHeight) };
    });
  }, [...qualifiers]);
  // A qualifier that wraps here is shortened in its deck (content/review/<deck>-edits.json), not cut on screen.
  const wrapped = measured.filter((m) => m.lines !== 1).map((m) => m.text);
  expect(wrapped, "qualifiers that take more than one line at 320 px").toEqual([]);
});
