import { expect, test, type Page } from "@playwright/test";
import { atStep, openHome } from "./helpers";

// Review finding U139, design system 7 "Pass changes layout": steps 3 to 4 and 5 to 6 change the fill-in pass
// as one paper. Its height and its band grow over 360 ms while the old block fades out over the new one,
// instead of jumping in one frame. The pass is measured on every animation frame from just before the press.

interface Frame {
  pass: number;
  band: number;
  blocks: number;
  /** The opacity of the block the change leaves, while it is on the pass. */
  leaving: number | null;
  /** The opacity of the block the change brings. */
  entering: number | null;
}

/** Presses `name` and records the pass on every frame until it has been still for a while. */
async function framesOfPress(page: Page, name: RegExp): Promise<Frame[]> {
  await page.evaluate(() => {
    const frames: Frame[] = [];
    (window as unknown as { passFrames: typeof frames }).passFrames = frames;
    const opacityOf = (el: Element | null | undefined) => (el ? Number(getComputedStyle(el).opacity) : null);
    const tick = () => {
      const pass = document.querySelector("[data-fill-in-pass]");
      const band = pass?.querySelector("[data-pass-band]");
      if (pass && band) {
        frames.push({
          pass: pass.getBoundingClientRect().height,
          band: band.getBoundingClientRect().height,
          blocks: pass.querySelectorAll("[data-pass-block]").length,
          leaving: opacityOf(pass.querySelector("[data-pass-block][data-leaving]")),
          entering: opacityOf(pass.querySelector("[data-pass-block]:not([data-leaving])")),
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

// Review finding 18: with reduced motion the pass changes layout with the start flow's cross-fade (old block
// out in 100, new block in over 140 after 90), its height switching at once, not with an instant swap.
test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the pass takes its new height at once while the old block fades out and the new one fades in", async ({ page }) => {
    await toDecks(page);
    const frames = await framesOfPress(page, /^CLF, /);
    expect(distinct(frames.map((f) => f.pass)), "the height switches in one frame").toHaveLength(2);
    const both = frames.filter((f) => f.blocks === 2);
    expect(both.length, "the old block stays on the pass while it fades").toBeGreaterThan(1);
    expect(both[0]?.entering, "the new block waits before it fades in").toBeLessThan(0.1);
    const fading = (o: number | null) => o !== null && o > 0 && o < 1;
    expect(frames.some((f) => fading(f.leaving)), `old block ${JSON.stringify(both.map((f) => f.leaving))}`).toBe(true);
    expect(frames.some((f) => fading(f.entering)), `new block ${JSON.stringify(frames.map((f) => f.entering))}`).toBe(true);
    // From the change on, the old block is gone before the new one is all there.
    const start = frames.findIndex((f) => f.blocks === 2);
    const oldGone = frames.findIndex((f, i) => i > start && (f.blocks === 1 || f.leaving === 0));
    const newFull = frames.findIndex((f, i) => i > start && f.entering === 1);
    expect(oldGone).toBeGreaterThan(start);
    expect(oldGone).toBeLessThan(newFull);
    expect(frames.at(-1)?.blocks).toBe(1);
    expect(frames.at(-1)?.entering).toBe(1);
  });

  test("going back from the ready pass cross-fades the same way", async ({ page }) => {
    await toDecks(page);
    await page.getByRole("button", { name: /^CLF, / }).click();
    await atStep(page, "Choose a section");
    await page.getByRole("button", { name: /^SEC, / }).click();
    await atStep(page, "Choose how to play");
    await page.getByRole("button", { name: /^Classic\. / }).click();
    await atStep(page, "Your pass is ready");
    const frames = await framesOfPress(page, /^Change deck, now CLF$/);
    expect(distinct(frames.map((f) => f.pass))).toHaveLength(2);
    expect(distinct(frames.map((f) => f.band))).toEqual([44, 30]);
    expect(frames.some((f) => f.blocks === 2 && f.leaving !== null && f.leaving > 0 && f.leaving < 1)).toBe(true);
    expect(frames.at(-1)?.blocks).toBe(1);
    expect(frames.at(-1)?.entering).toBe(1);
  });
});

// The rest of design system 7 for the same moves: the values on both layouts travel to their new place as two
// copies that cross-fade on a linear clock, the dashes of a field fade out as its name heads for it and back
// in on the way back, and the step title leaves in 80 ms, before the rest of its step (140).

interface Copy {
  field: string;
  text: string;
  top: number;
  left: number;
  right: number;
  opacity: number;
  /** Whether the copy is cut with an ellipsis, as its value is. */
  cut: boolean;
}

interface Snapshot {
  /** The pass's left and right edges. */
  pass: [number, number];
  copies: Copy[];
  /** The opacity of each value on the pass's current block. */
  values: Record<string, number>;
  /** The opacity of each field's dashes, where a field shows them. */
  blanks: Record<string, number>;
  /** The leaving step's title and panel, while one is leaving. */
  leavingTitle: number | null;
  leavingPanel: number | null;
}

/** Presses the button and records the pass and the leaving step on every frame for 90 frames. */
async function snapshotsOfPress(page: Page, name: RegExp | string): Promise<Snapshot[]> {
  await page.evaluate(() => {
    const shots: Snapshot[] = [];
    (window as unknown as { passShots: typeof shots }).passShots = shots;
    const opacityOf = (el: Element) => Number(getComputedStyle(el).opacity);
    const tick = () => {
      const copies = [...document.querySelectorAll<HTMLElement>("[data-pass-travel]")].map((copy) => {
        const rect = copy.getBoundingClientRect();
        return {
          field: copy.dataset.passTravel ?? "",
          text: copy.textContent ?? "",
          top: rect.top,
          left: rect.left,
          right: rect.right,
          opacity: opacityOf(copy),
          cut: copy.scrollWidth > copy.clientWidth + 1,
        };
      });
      const passRect = document.querySelector("[data-fill-in-pass]")?.getBoundingClientRect();
      const values: Record<string, number> = {};
      for (const value of document.querySelectorAll<HTMLElement>("[data-pass-block]:not([data-leaving]) [data-pass-value]")) {
        values[value.dataset.passValue ?? ""] = opacityOf(value);
      }
      const blanks: Record<string, number> = {};
      for (const blank of document.querySelectorAll<HTMLElement>("[data-pass-block]:not([data-leaving]) [data-pass-blank]")) {
        blanks[blank.closest<HTMLElement>("[data-field]")?.dataset.field ?? ""] = opacityOf(blank);
      }
      const leaving = document.querySelector("[data-step][inert]");
      const title = leaving?.querySelector("h2");
      shots.push({ pass: [passRect?.left ?? 0, passRect?.right ?? 0], copies, values, blanks, leavingTitle: title ? opacityOf(title) : null, leavingPanel: leaving ? opacityOf(leaving) : null });
      if (shots.length < 90) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByRole("button", typeof name === "string" ? { name, exact: true } : { name }).click();
  await page.waitForFunction(() => (window as unknown as { passShots: unknown[] }).passShots.length >= 90);
  return page.evaluate(() => (window as unknown as { passShots: Snapshot[] }).passShots);
}

/** The frames in which `field` travels as its two copies, old look first. */
function travelFrames(shots: Snapshot[], field: string): [Copy, Copy][] {
  return shots.map((shot) => shot.copies.filter((copy) => copy.field === field)).filter((pair): pair is [Copy, Copy] => pair.length === 2);
}

function expectTravel(shots: Snapshot[], field: string): void {
  const frames = travelFrames(shots, field);
  expect(frames.length, `${field} travels over several frames`).toBeGreaterThan(4);
  // Both copies follow one path, so they move together, over many places.
  expect(distinct(frames.map(([, copy]) => copy.top + copy.left)).length).toBeGreaterThan(3);
  // The cross-fade: the old copy is gone before the new one is all there, and for a while both show.
  const oldGone = frames.findIndex(([old]) => old.opacity === 0);
  const newFull = frames.findIndex(([, next]) => next.opacity === 1);
  expect(oldGone, "the old copy fades out").toBeGreaterThan(0);
  expect(
    frames.some(([old, next]) => old.opacity > 0 && old.opacity < 1 && next.opacity > 0 && next.opacity < 1),
    "both copies show half way",
  ).toBe(true);
  if (newFull !== -1) expect(oldGone).toBeLessThan(newFull);
  // A copy that shows stays on the pass, however its words grow or shrink.
  for (const [i, shot] of shots.entries()) {
    for (const copy of shot.copies.filter((c) => c.field === field && c.opacity > 0)) {
      expect(copy.left, `${field} "${copy.text}" at frame ${i}`).toBeGreaterThanOrEqual(shot.pass[0] - 1);
      expect(copy.right, `${field} "${copy.text}" at frame ${i}`).toBeLessThanOrEqual(shot.pass[1] + 1);
    }
  }
  // The value itself waits under its copies and shows once they are gone.
  const last = shots.at(-1);
  expect(last?.copies).toEqual([]);
  expect(last?.values[field]).toBe(1);
}

test.describe("values, dashes and titles with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("choosing the deck sends the area and the platform from their fields to the quiet line", async ({ page }) => {
    await toDecks(page);
    const shots = await snapshotsOfPress(page, /^CLF, /);
    expectTravel(shots, "area");
    expectTravel(shots, "platform");
    // The deck itself flies in from its card, not from the pass.
    expect(travelFrames(shots, "deck")).toEqual([]);
  });

  test("choosing the class sends the deck and section codes from their fields to the legs, and back again", async ({ page }) => {
    await toDecks(page);
    await page.getByRole("button", { name: /^CLF, / }).click();
    await atStep(page, "Choose a section");
    await page.getByRole("button", { name: /^SEC, / }).click();
    await atStep(page, "Choose how to play");
    const forward = await snapshotsOfPress(page, /^Classic\. /);
    expectTravel(forward, "deck");
    expectTravel(forward, "section");
    await atStep(page, "Your pass is ready");
    const back = await snapshotsOfPress(page, "Back to classes");
    expectTravel(back, "deck");
    expectTravel(back, "section");
  });

  // Review finding 5: values travel by field, not by text. The route pass says "Whole deck" where the ready
  // pass's leg says "ALL"; the two copies carry their own words and cross-fade on the way, both ways.
  test("choosing the class sends Whole deck to the ALL leg, and back again", async ({ page }) => {
    await toDecks(page);
    await page.getByRole("button", { name: /^CLF, / }).click();
    await atStep(page, "Choose a section");
    await page.getByRole("button", { name: /^Whole deck, / }).click();
    await atStep(page, "Choose how to play");
    const forward = await snapshotsOfPress(page, /^Classic\. /);
    expectTravel(forward, "section");
    expect(travelFrames(forward, "section")[0]?.map((copy) => copy.text)).toEqual(["Whole deck", "ALL"]);
    expectTravel(forward, "deck");
    await atStep(page, "Your pass is ready");
    const back = await snapshotsOfPress(page, "Back to classes");
    expectTravel(back, "section");
    expect(travelFrames(back, "section")[0]?.map((copy) => copy.text)).toEqual(["ALL", "Whole deck"]);
  });

  test("a value cut with an ellipsis travels too, its old copy cut the same way", async ({ page }) => {
    await toDecks(page);
    // A field too narrow for its value, as on a phone narrower than any in the specs or with large text.
    await page.addStyleTag({ content: '[data-pass-block="destination"] [data-pass-value="platform"] { max-width: 18px !important; }' });
    const shots = await snapshotsOfPress(page, /^CLF, /);
    expectTravel(shots, "platform");
    const [old, next] = travelFrames(shots, "platform")[0] ?? [];
    expect(old?.cut, "the old copy is cut as the value was").toBe(true);
    expect(next?.cut, "the new copy shows the whole word, as the quiet line does").toBe(false);
  });

  test("the travelling copies leave from the old values and land on the new ones, the band's growth included", async ({ page }) => {
    await toDecks(page);
    await page.getByRole("button", { name: /^CLF, / }).click();
    await atStep(page, "Choose a section");
    await page.getByRole("button", { name: /^SEC, / }).click();
    await atStep(page, "Choose how to play");
    // The copies are measured the moment they are laid over the pass (in the same frame as the change), then
    // held at the end of their path while the paper and its band finish their move, and measured again.
    type Boxes = Record<string, { copy: number[]; value: number[] }[]>;
    await page.evaluate(() => {
      const textBox = (el: Element) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const rect = range.getBoundingClientRect();
        return [rect.left, rect.top, rect.height];
      };
      const measure = (block: string) => {
        const out: Boxes = {};
        for (const copy of document.querySelectorAll<HTMLElement>("[data-pass-travel]")) {
          const field = copy.dataset.passTravel ?? "";
          const value = document.querySelector(`${block} [data-pass-value="${field}"]`);
          if (value) (out[field] ??= []).push({ copy: textBox(copy), value: textBox(value) });
        }
        return out;
      };
      const probe = window as unknown as { travelStart?: Boxes; travelEnd?: () => Boxes };
      const observer = new MutationObserver(() => {
        if (!document.querySelector("[data-pass-travel]")) return;
        observer.disconnect();
        probe.travelStart = measure("[data-leaving]");
        for (const copy of document.querySelectorAll<HTMLElement>("[data-pass-travel]")) {
          for (const animation of copy.getAnimations()) {
            animation.pause();
            animation.currentTime = 359.9;
          }
        }
        probe.travelEnd = () => measure("[data-pass-block]:not([data-leaving])");
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    await page.getByRole("button", { name: /^Classic\. / }).click();
    await page.waitForFunction(() => (window as unknown as { travelStart?: unknown }).travelStart !== undefined);
    const start = await page.evaluate(() => (window as unknown as { travelStart: Boxes }).travelStart);
    for (const field of ["deck", "section"]) {
      const [oldCopy] = start[field] ?? [];
      expect(oldCopy, `${field} has an old copy`).toBeDefined();
      oldCopy?.copy.forEach((n, i) => expect(n, `${field} old copy`).toBeCloseTo(oldCopy.value[i] ?? 0, 0));
    }
    await page.waitForTimeout(600);
    const end = await page.evaluate(() => (window as unknown as { travelEnd: () => Boxes }).travelEnd());
    for (const field of ["deck", "section"]) {
      const newCopy = end[field]?.[1];
      expect(newCopy, `${field} has a new copy`).toBeDefined();
      newCopy?.copy.forEach((n, i) => expect(n, `${field} new copy`).toBeCloseTo(newCopy.value[i] ?? 0, 0));
    }
  });

  test("the dashes of a field fade out as its name heads for it, and fade back in on the way back", async ({ page }) => {
    await openHome(page);
    await page.getByRole("button", { name: /^Cloud, / }).click();
    await atStep(page, "Choose a platform");
    const forward = await snapshotsOfPress(page, /^AWS, /);
    const out = forward.map((shot) => shot.blanks.platform).filter((o): o is number => o !== undefined);
    expect(out.some((o) => o > 0 && o < 1), `platform dashes ${JSON.stringify(distinct(out))}`).toBe(true);
    expect(forward.at(-1)?.blanks.platform).toBeUndefined();
    await atStep(page, "Choose a deck");
    const back = await snapshotsOfPress(page, "Back to platforms");
    const comeBack = back.map((shot) => shot.blanks.platform).filter((o): o is number => o !== undefined);
    expect(comeBack[0], "the dashes start hidden").toBe(0);
    expect(comeBack.some((o) => o > 0 && o < 1)).toBe(true);
    expect(comeBack.at(-1)).toBe(1);
  });

  test("the step title leaves before the cards of its step", async ({ page }) => {
    await toDecks(page);
    const shots = await snapshotsOfPress(page, /^CLF, /);
    const leaving = shots.filter((shot) => shot.leavingTitle !== null && shot.leavingPanel !== null);
    expect(leaving.length).toBeGreaterThan(2);
    expect(
      leaving.some((shot) => (shot.leavingTitle ?? 1) < 0.1 && (shot.leavingPanel ?? 0) > 0.1),
      `title and panel ${JSON.stringify(leaving.map((s) => [s.leavingTitle, s.leavingPanel]))}`,
    ).toBe(true);
  });
});

test.describe("values with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("no value travels and no dashes fade", async ({ page }) => {
    await toDecks(page);
    await page.getByRole("button", { name: /^CLF, / }).click();
    await atStep(page, "Choose a section");
    await page.getByRole("button", { name: /^SEC, / }).click();
    await atStep(page, "Choose how to play");
    const shots = await snapshotsOfPress(page, /^Classic\. /);
    expect(shots.every((shot) => shot.copies.length === 0)).toBe(true);
    expect(shots.every((shot) => Object.values(shot.blanks).every((o) => o === 1))).toBe(true);
  });
});
