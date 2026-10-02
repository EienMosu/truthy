import { expect, test, type Page } from "@playwright/test";
import { CLF_ID, centreOf, deckAnswers, openPendingRound, waitForCard, waitForQuestion } from "./helpers";

// Design system 5.11 and 7 ("Stamp lands", "Timed beat"): a verdict stamp lands as it appears, from 1.9 times
// its size, turned and invisible, and comes to rest at -6 degrees; with reduced motion it is shown at rest.
// The stamp is read on every frame from the moment it is in the page, so the spec sees its first frame
// whatever the machine's speed.

interface Sample {
  at: number;
  opacity: number;
  transform: string;
}

/** Starts recording the computed opacity and transform of `selector` on every frame, for `ms` after this call. */
async function startSampling(page: Page, selector: string, ms: number): Promise<void> {
  await page.evaluate(
    ({ selector, ms }) => {
      const samples: Sample[] = [];
      (window as unknown as { stampSamples: Sample[] }).stampSamples = samples;
      const start = performance.now();
      const frame = () => {
        const element = document.querySelector(selector);
        if (element) {
          const style = getComputedStyle(element);
          samples.push({ at: performance.now() - start, opacity: Number(style.opacity), transform: style.transform });
        }
        if (performance.now() - start < ms) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
    { selector, ms },
  );
}

async function samples(page: Page): Promise<Sample[]> {
  return page.evaluate(() => (window as unknown as { stampSamples: Sample[] }).stampSamples);
}

/** The scale of a computed transform matrix ("matrix(a, b, c, d, e, f)"; "none" is 1). */
function scaleOf(transform: string): number {
  const match = /^matrix\(([^,]+), ([^,]+),/.exec(transform);
  if (!match) return 1;
  return Math.hypot(Number(match[1]), Number(match[2]));
}

/** Answers the card on screen right by tapping True or False. */
async function answerRight(page: Page, truth: boolean): Promise<void> {
  const { x, y } = await centreOf(page.getByRole("button", { name: truth ? "True" : "False", exact: true }));
  await page.touchscreen.tap(x, y);
}

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the slip stamp lands after an answer: invisible and large first, at rest 800 ms later", async ({ page }) => {
    await openPendingRound(page, "classic");
    const { truth } = await waitForCard(page, await deckAnswers(page, CLF_ID), 1);
    await startSampling(page, "[data-verdict]", 1200);
    await answerRight(page, truth);
    await page.waitForTimeout(1300);
    const seen = await samples(page);
    expect(seen.length).toBeGreaterThan(0);
    const first = seen[0] as Sample;
    expect(first.opacity, "the stamp's first frame").toBeLessThan(1);
    expect(scaleOf(first.transform), "the stamp's first frame").toBeGreaterThan(1.5);
    // It waits (380 ms delay), then lands; about 60 ms in it has not shown yet.
    const early = seen.filter((s) => s.at - first.at <= 60);
    for (const s of early) expect(s.opacity).toBeLessThan(1);
    const last = seen.at(-1) as Sample;
    expect(last.opacity).toBe(1);
    expect(scaleOf(last.transform)).toBeCloseTo(1, 2);
  });

  test("the Timed stub stamp lands as the answer is given", async ({ page }) => {
    await openPendingRound(page, "timed");
    const answers = await deckAnswers(page, CLF_ID);
    await expect(page.locator("[data-statement]")).toBeFocused();
    const { truth } = await waitForQuestion(page, answers);
    await startSampling(page, "[data-stub-stamp]", 600);
    await answerRight(page, truth);
    await page.waitForTimeout(700);
    const seen = await samples(page);
    expect(seen.length).toBeGreaterThan(0);
    const first = seen[0] as Sample;
    expect(first.opacity, "the stub stamp's first frame").toBeLessThan(1);
    expect(scaleOf(first.transform), "the stub stamp's first frame").toBeGreaterThan(1.2);
    expect(seen.some((s) => s.opacity === 1)).toBe(true);
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the slip stamp is shown at rest from its first frame", async ({ page }) => {
    await openPendingRound(page, "classic");
    const { truth } = await waitForCard(page, await deckAnswers(page, CLF_ID), 1);
    await startSampling(page, "[data-verdict]", 400);
    await answerRight(page, truth);
    await page.waitForTimeout(500);
    const seen = await samples(page);
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) {
      expect(s.opacity).toBe(1);
      expect(scaleOf(s.transform)).toBeCloseTo(1, 2);
    }
  });
});
