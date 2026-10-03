// A deck marks a code fragment with backticks ("An `asserts x is string` function"). Overpass draws a backtick as
// an accent with no width over the next letter, so "`x" read as an x with a grave on it. The fragment is shown in
// Overpass Mono without its backticks: on the card, on the answer slip and in the missed cards.
import { expect, test, type Locator } from "@playwright/test";
import { deckAnswers, seeResults, verdict, verdictFor, waitForQuestion } from "./helpers";

test.use({ reducedMotion: "reduce" });

// TypeScript, "Compiler options and modules": every statement and explanation of the section holds code.
const TSC_ID = "typescript-fundamentals";

/** Every code element in `scope` is set in Overpass Mono and has a width, and no backtick is left in its text. */
async function expectCodeShown(scope: Locator): Promise<void> {
  const code = scope.locator("code");
  await expect(code.first()).toBeVisible();
  expect(await scope.textContent()).not.toContain("`");
  const faces = await code.evaluateAll((elements) =>
    elements.map((element) => ({ family: getComputedStyle(element).fontFamily, width: element.getBoundingClientRect().width })),
  );
  for (const face of faces) {
    expect(face.family).toMatch(/^"?Overpass Mono\b/);
    expect(face.width).toBeGreaterThan(0);
  }
}

test("a code fragment is set in the mono face, without backticks, on the card, the slip and the missed cards", async ({ page }) => {
  await page.addInitScript((deckId) => {
    sessionStorage.setItem("truthy.pending.v1", JSON.stringify({ route: { deckId, sectionId: "CFG" }, mode: "streak" }));
  }, TSC_ID);
  await page.goto("/play");
  const answers = await deckAnswers(page, TSC_ID);

  const { truth } = await waitForQuestion(page, answers);
  await expectCodeShown(page.locator("[data-statement] > p").last());

  // A wrong answer ends the Streak: the slip explains it, then the result lists the card.
  await page.getByRole("button", { name: truth ? "False" : "True", exact: true }).click();
  await expect(verdict(page)).toHaveText(verdictFor(!truth, truth));
  await expectCodeShown(page.locator("[data-slip] p").last());

  await seeResults(page);
  const missed = page.getByRole("region", { name: "Missed cards" }).getByRole("listitem");
  await expectCodeShown(missed.locator("p").first());
  await missed.getByRole("button", { name: /^Why, / }).click();
  await expectCodeShown(missed.getByRole("region"));
});
