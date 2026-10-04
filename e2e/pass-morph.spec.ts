import { expect, test, type Page } from "@playwright/test";
import { atStep, openHome } from "./helpers";

// Review finding U139, design system 7 "Pass changes layout": steps 3 to 4 and 5 to 6 change the fill-in pass
// as one paper. Its height and its band grow over 360 ms while the old block fades out over the new one,
// instead of jumping in one frame. The pass is measured on every animation frame from just before the press.

interface Frame {
  pass: number;
  band: number;
  blocks: number;
}

/** Presses `name` and records the pass on every frame until it has been still for a while. */
async function framesOfPress(page: Page, name: RegExp): Promise<Frame[]> {
  await page.evaluate(() => {
    const frames: { pass: number; band: number; blocks: number }[] = [];
    (window as unknown as { passFrames: typeof frames }).passFrames = frames;
    const tick = () => {
      const pass = document.querySelector("[data-fill-in-pass]");
      const band = pass?.querySelector("[data-pass-band]");
      if (pass && band) {
        frames.push({
          pass: pass.getBoundingClientRect().height,
          band: band.getBoundingClientRect().height,
          blocks: pass.querySelectorAll("[data-pass-block]").length,
        });
      }
      if (frames.length < 90) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByRole("button", { name }).click();
  await page.waitForFunction(() => (window as unknown as { passFrames: unknown[] }).passFrames.length >= 90);
  return page.evaluate(() => (window as unknown as { passFrames: Frame[] }).passFrames);
}

function distinct(values: number[]): number[] {
  return [...new Set(values.map((v) => Math.round(v * 10) / 10))];
}

/** Every step is in the same direction, from the first value to the last. */
function expectSteadyMove(values: number[]): void {
  const first = values[0] ?? 0;
  const last = values.at(-1) ?? 0;
  for (let i = 1; i < values.length; i += 1) {
    const step = (values[i] ?? 0) - (values[i - 1] ?? 0);
    expect(step * Math.sign(last - first), `frame ${i} moves toward ${last}`).toBeGreaterThanOrEqual(-0.5);
  }
}

async function toDecks(page: Page): Promise<void> {
  await openHome(page);
  await page.getByRole("button", { name: /^Cloud, / }).click();
  await atStep(page, "Choose a platform");
  await page.getByRole("button", { name: /^AWS, / }).click();
  await atStep(page, "Choose a deck");
}

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("choosing the deck grows the pass over several frames, the old block fading out over the new one", async ({ page }) => {
    await toDecks(page);
    const frames = await framesOfPress(page, /^CLF, /);
    const heights = frames.map((f) => f.pass);
    expect(distinct(heights).length, `pass heights ${JSON.stringify(distinct(heights))}`).toBeGreaterThan(4);
    expectSteadyMove(heights);
    expect(heights.at(-1) ?? 0).toBeGreaterThan(heights[0] ?? 0);
    expect(frames.some((f) => f.blocks === 2), "the old block is on the pass while the new one comes in").toBe(true);
    expect(frames.at(-1)?.blocks).toBe(1);
  });

  test("choosing the class grows the band from 30 to 44 with the pass", async ({ page }) => {
    await toDecks(page);
    await page.getByRole("button", { name: /^CLF, / }).click();
    await atStep(page, "Choose a section");
    await page.getByRole("button", { name: /^SEC, / }).click();
    await atStep(page, "Choose how to play");
    const frames = await framesOfPress(page, /^Classic\. /);
    const bands = frames.map((f) => f.band);
    expect(bands[0]).toBeCloseTo(30, 0);
    expect(bands.at(-1)).toBeCloseTo(44, 0);
    expect(distinct(bands).length, `band heights ${JSON.stringify(distinct(bands))}`).toBeGreaterThan(4);
    expectSteadyMove(bands);
    expectSteadyMove(frames.map((f) => f.pass));
  });

  test("going back from the ready pass shrinks the pass the same way", async ({ page }) => {
    await toDecks(page);
    await page.getByRole("button", { name: /^CLF, / }).click();
    await atStep(page, "Choose a section");
    await page.getByRole("button", { name: /^SEC, / }).click();
    await atStep(page, "Choose how to play");
    await page.getByRole("button", { name: /^Classic\. / }).click();
    await atStep(page, "Your pass is ready");
    const frames = await framesOfPress(page, /^Change deck, now CLF$/);
    const heights = frames.map((f) => f.pass);
    expect(distinct(heights).length).toBeGreaterThan(4);
    expectSteadyMove(heights);
    expect(heights.at(-1) ?? 0).toBeLessThan(heights[0] ?? 0);
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the pass changes layout at once, with no copy of the old block", async ({ page }) => {
    await toDecks(page);
    const frames = await framesOfPress(page, /^CLF, /);
    expect(distinct(frames.map((f) => f.pass))).toHaveLength(2);
    expect(frames.every((f) => f.blocks === 1)).toBe(true);
  });
});
