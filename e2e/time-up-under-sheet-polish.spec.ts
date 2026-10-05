import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { CLF_ID, answerCard, deckAnswers, openPendingRound, waitForQuestion } from "./helpers";

test.use({ reducedMotion: "no-preference" });

const TIME_UP = "Time is up. This card doesn't count.";

interface Change {
  what: "exposed" | "status";
  at: number;
  text: string;
}

declare global {
  interface Window {
    __changes?: Change[];
  }
}

/** Notes, with the time, when <main> stops being inert and every change of the status region's text. */
async function watchMain(page: Page): Promise<void> {
  await page.evaluate(() => {
    const main = document.querySelector("main");
    const region = main?.querySelector('[role="status"]');
    if (!main || !region) throw new Error("no main or no status");
    const changes: Change[] = [];
    window.__changes = changes;
    const text = () => region.textContent ?? "";
    new MutationObserver(() => {
      if (!main.inert) changes.push({ what: "exposed", at: performance.now(), text: text() });
    }).observe(main, { attributes: true, attributeFilter: ["inert"] });
    new MutationObserver(() => changes.push({ what: "status", at: performance.now(), text: text() })).observe(region, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
}

interface AXNode {
  nodeId: string;
  ignored: boolean;
  role?: { value?: unknown };
  name?: { value?: unknown };
  childIds?: string[];
  backendDOMNodeId?: number;
}

/**
 * What the status region says in Chromium's accessibility tree (the tree a screen reader reads), or null
 * while it is not in it (inside the inert <main>).
 */
async function statusInTree(cdp: CDPSession): Promise<() => Promise<string | null>> {
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: 'main [role="status"]' });
  const { node } = await cdp.send("DOM.describeNode", { nodeId });
  return async () => {
    const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as unknown as { nodes: AXNode[] };
    const byId = new Map(nodes.map((n) => [n.nodeId, n]));
    const region = nodes.find((n) => n.backendDOMNodeId === node.backendNodeId);
    if (!region || region.ignored) return null;
    const textOf = (n: AXNode): string =>
      n.role?.value === "StaticText"
        ? String(n.name?.value ?? "")
        : (n.childIds ?? []).map((id) => byId.get(id)).map((child) => (child ? textOf(child) : "")).join("");
    return textOf(region);
  };
}

// Review finding U25: time running out while the leave sheet is open changed the status inside the inert
// <main>, so when the sheet closed the region came back already holding "Time is up" and nothing was said.
// The status now changes only some frames after <main> is exposed again, so the change is announced.
test("time up under the leave sheet is said after the sheet has closed, frames after <main> is exposed", async ({ page, browserName }) => {
  await page.clock.install();
  await openPendingRound(page, "timed");
  const answers = await deckAnswers(page, CLF_ID);
  const first = await answerCard(page, answers, 1, true);
  await waitForQuestion(page, answers, first.statement);
  const status = page.locator('main [role="status"]');
  const before = (await status.textContent()) ?? "";
  expect(before).not.toBe(TIME_UP);

  await page.getByRole("button", { name: "Leave round" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave round?" });
  await expect(dialog).toBeVisible();
  await page.clock.runFor(61_000);
  await expect(page.locator('[data-stub-stamp="time-up"]')).toBeAttached();
  await expect(status).toHaveText(before);

  await watchMain(page);
  const cdp = browserName === "chromium" ? await page.context().newCDPSession(page) : null;
  const read = cdp ? await statusInTree(cdp) : null;
  await dialog.getByRole("button", { name: "Keep playing" }).click();

  // Chromium: read the accessibility tree until it says time is up, noting each new thing it says.
  const heard: (string | null)[] = [];
  if (read) {
    const until = Date.now() + 5_000;
    while (Date.now() < until && heard[heard.length - 1] !== TIME_UP) {
      const now = await read();
      if (heard[heard.length - 1] !== now || heard.length === 0) heard.push(now);
    }
  }
  await expect(status).toHaveText(TIME_UP);

  const changes = (await page.evaluate(() => window.__changes)) ?? [];
  const exposed = changes.find((change) => change.what === "exposed");
  const said = changes.find((change) => change.what === "status" && change.text === TIME_UP);
  expect(exposed?.text).toBe(before);
  expect(said).toBeDefined();
  // The page clock flows on from here, so this is real time: well over one frame at 60 or 120 Hz.
  expect((said?.at ?? 0) - (exposed?.at ?? 0)).toBeGreaterThanOrEqual(100);

  if (read) {
    // The region is in the tree, saying what it said before, and only then says time is up. Each read
    // brings the tree up to date itself, so it cannot tell one frame from the next: the time between the
    // two changes above is what shows the frames in between.
    const exposedAt = heard.findIndex((text) => text !== null);
    expect(exposedAt).toBeGreaterThanOrEqual(0);
    expect(heard[exposedAt]).toBe(before);
    expect(heard[heard.length - 1]).toBe(TIME_UP);
  }
});
