import { expect, test, type Page } from "@playwright/test";
import {
  CLF_ID,
  CLF_SECURITY,
  chooseRoute,
  deckAnswers,
  expectMissed,
  expectResult,
  openHome,
  playRound,
  startRound,
  verdict,
  verdictFor,
  waitForCard,
  wrongOn,
} from "./helpers";

// Spec section 9, "Motion": every transition has a reduced-motion fallback (a cross-fade).
test.use({ reducedMotion: "reduce" });

test("with reduced motion the start flow, a whole round and the result all work", async ({ page }) => {
  await openHome(page);
  expect(await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

  await chooseRoute(page, CLF_SECURITY);
  await startRound(page);
  const played = await playRound(page, CLF_ID, wrongOn(1, 2));

  await expectResult(page, 8);
  await expectMissed(page, played);
  await expect(page.getByText("First round on this route")).toBeVisible();
});

// The time "Next card" ignores presses guards against a double tap, not against the animation: it is the
// same 420 ms with reduced motion, although the cross-fade is over sooner.
for (const gap of [150, 300]) {
  test(`with reduced motion a double tap ${gap} ms apart on an answer keeps the verdict`, async ({ page }) => {
    await openHome(page);
    await chooseRoute(page, CLF_SECURITY);
    await startRound(page);
    const answers = await deckAnswers(page, CLF_ID);

    const first = await waitForCard(page, answers, 1);
    const box = await page.getByRole("button", { name: "True", exact: true }).boundingBox();
    if (box === null) throw new Error("True is not on screen");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.click(x, y);
    await page.waitForTimeout(gap);
    await page.mouse.click(x, y);

    await page.waitForTimeout(600);
    await expect(page.getByRole("img", { name: /^Card 1 of 10\./ })).toBeVisible();
    await expect(verdict(page)).toHaveText(verdictFor(true, first.truth));
    await expect(page.getByRole("button", { name: "Next card" })).toBeVisible();
  });
}

// Review finding U128: what reduced motion takes away, watched frame by frame from the press, with full
// motion as the control that shows each probe does see the movement when it is there.
type StartMotion = { ghost: boolean; hiddenName: boolean; panelMoved: boolean };

/** Presses the Cloud area on step 1 and watches 700 ms of frames: the travelling name and the step panels. */
function watchFirstChoice(page: Page): Promise<StartMotion> {
  return page.evaluate(
    () =>
      new Promise<StartMotion>((resolve) => {
        const seen = { ghost: false, hiddenName: false, panelMoved: false };
        const cloud = [...document.querySelectorAll<HTMLButtonElement>("[data-step] [data-option] button")].find((button) =>
          /^Cloud, \d+ decks?$/.test(button.getAttribute("aria-label") ?? button.textContent ?? ""),
        );
        if (!cloud) throw new Error("no Cloud area on step 1");
        const t0 = performance.now();
        cloud.click();
        const frame = () => {
          // The travelling copy of the chosen name, and the name it stands in for, hidden on its card.
          if (document.querySelector("span.origin-top-left")) seen.ghost = true;
          for (const name of document.querySelectorAll<HTMLElement>("[data-card-name]")) {
            if (name.style.opacity === "0" || name.style.visibility === "hidden") seen.hiddenName = true;
          }
          for (const panel of document.querySelectorAll<HTMLElement>("[data-step]")) {
            const transform = getComputedStyle(panel).transform;
            if (transform !== "none" && transform !== "matrix(1, 0, 0, 1, 0, 0)") seen.panelMoved = true;
          }
          if (performance.now() - t0 < 700) requestAnimationFrame(frame);
          else resolve(seen);
        };
        requestAnimationFrame(frame);
      }),
  );
}

/** Starts the round on the ready pass and says whether the unrolling paper was ever in the page before /play. */
async function boardAndWatchUnroll(page: Page): Promise<boolean> {
  await page.evaluate(() => {
    const flag = window as unknown as { unrollSeen?: boolean };
    flag.unrollSeen = false;
    new MutationObserver(() => {
      if (document.querySelector("[data-unroll]")) flag.unrollSeen = true;
    }).observe(document.body, { subtree: true, childList: true });
  });
  await startRound(page);
  return page.evaluate(() => (window as unknown as { unrollSeen?: boolean }).unrollSeen === true);
}

/** Answers True and times, from the press, when the Next row is more than half faded in and when Next card has focus. */
function watchNextRow(page: Page): Promise<{ visibleAt: number | null; focusAt: number | null }> {
  return page.evaluate(
    () =>
      new Promise<{ visibleAt: number | null; focusAt: number | null }>((resolve) => {
        const buttons = () => [...document.querySelectorAll<HTMLButtonElement>("main button")];
        const answer = buttons().find((button) => button.textContent?.trim() === "True");
        if (!answer) throw new Error("no True button");
        const out = { visibleAt: null as number | null, focusAt: null as number | null };
        const t0 = performance.now();
        answer.click();
        const frame = () => {
          const at = Math.round(performance.now() - t0);
          const next = buttons().find((button) => button.textContent?.includes("Next card"));
          const row = next?.parentElement;
          if (row && out.visibleAt === null && Number(getComputedStyle(row).opacity) > 0.5) out.visibleAt = at;
          if (next && out.focusAt === null && document.activeElement === next) out.focusAt = at;
          if (at < 900) requestAnimationFrame(frame);
          else resolve(out);
        };
        requestAnimationFrame(frame);
      }),
  );
}

for (const reduced of [true, false]) {
  test.describe(reduced ? "with reduced motion" : "control: with full motion", () => {
    test.use({ reducedMotion: reduced ? "reduce" : "no-preference" });

    test("a choice on the start flow: the travelling name and the step panels", async ({ page }) => {
      await openHome(page);
      const seen = await watchFirstChoice(page);
      if (reduced) expect(seen).toEqual({ ghost: false, hiddenName: false, panelMoved: false });
      else {
        expect(seen.ghost && seen.hiddenName).toBe(true);
        expect(seen.panelMoved).toBe(true);
      }
    });

    test("boarding: the pass unrolls only with full motion", async ({ page }) => {
      await openHome(page);
      await chooseRoute(page, CLF_SECURITY);
      expect(await boardAndWatchUnroll(page)).toBe(!reduced);
    });

    test("after an answer: when the Next row fades in and Next card takes focus", async ({ page }) => {
      await openHome(page);
      await chooseRoute(page, CLF_SECURITY);
      await startRound(page);
      await waitForCard(page, await deckAnswers(page, CLF_ID), 1);
      const { visibleAt, focusAt } = await watchNextRow(page);
      expect(visibleAt).not.toBeNull();
      expect(focusAt).not.toBeNull();
      // Reduced: a 220 ms fade with no delay, and focus at once (about 50 ms and 5 ms). Full motion: the row
      // waits 360 ms, and focus comes when it has arrived, 420 ms after the answer.
      if (reduced) {
        expect(visibleAt).toBeLessThan(330);
        expect(focusAt).toBeLessThan(330);
      } else {
        expect(visibleAt).toBeGreaterThanOrEqual(360);
        expect(focusAt).toBeGreaterThanOrEqual(400);
      }
    });
  });
}
