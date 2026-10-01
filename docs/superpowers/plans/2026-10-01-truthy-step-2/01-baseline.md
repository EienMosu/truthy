### Task 1: The pinned SAA deck

The AWS Solutions Architect Associate deck is already in the game: `content/catalog.json` lists it under AWS, `content/reviewed/aws-saa-c03.json` holds its 154 reviewed cards, the build writes it to `public/decks/`, and the commit that added it is on `main`, which is what production deploys. Nothing in step 2 changes whether the deck shows in the app. What the repository still lacks is a test that pins the deck (the two "real content" blocks of `tests/content/build.test.ts` build two and three decks, never all four) and a spec that names it: the catalog line of section 5 still says "step 3". This task adds both. It changes no application code.

The branch must be the one the README's "Before task 1" describes: it contains `origin/main`, and all four gates are green before the first change.

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-truthy-design.md` (the line that starts "Initial catalog:")
- Test: `tests/content/build.test.ts` (one new `describe` at the end)

**Interfaces:**
- Consumes:
  - `src/content/build.ts`: `buildDecks(input: { catalog: unknown; reviewed: Record<string, unknown>; version: string }): BuildOutput` with `output.index.areas[].platforms[].decks[]` (`id`, `code`, `title`, `cardCount`, `hash`, `sections: { id, title, cardCount }[]`) and `output.decks[]` (`id`, `cards`); `hashDeck(cards)`.
  - `src/content/schema.ts`: `DeckFileSchema`, `DeckIndexSchema`.
  - `tests/content/build.test.ts`: the constant `VERSION`, the imports `readFileSync`, `buildDecks`, `hashDeck`, `DeckFileSchema`, `DeckIndexSchema` (all there already), and the pattern of the existing block `describe("the real content: Cloud Digital Leader", ...)` at the end of the file.
  - `content/catalog.json`: deck `aws-saa-c03`, code `SAA`, title "Solutions Architect Associate", sections `SEC` "Secure architectures", `RES` "Resilient architectures", `PRF` "High-performing architectures", `CST` "Cost-optimized architectures".
- Produces: nothing other tasks import.

**Rules:**

1. The real content builds four decks: `aws-clf-c02`, `aws-saa-c03`, `gcp-cdl`, `nextjs-rendering`. AWS lists Cloud Practitioner first, then Solutions Architect Associate.
2. `aws-saa-c03` has 154 cards: SEC 33, RES 20, PRF 54, CST 47. The smallest route of the deck is RES with 20 cards.
3. All four deck files pass the client schema, carry the hash the index names, and ship only conflict groups that at least two of their cards share. The existing block checks this for two decks; the new block checks it for the four the deploy builds.
4. The spec's catalog line reads: `Initial catalog: Cloud > AWS > Cloud Practitioner (CLF: CON 45, SEC 47, TEC 88, BIL 34 cards) and Solutions Architect Associate (SAA: SEC 33, RES 20, PRF 54, CST 47 cards); Cloud > Google Cloud > ...` (only the SAA parenthesis changes).

Not in this task, and not decided by this plan: the two SAA cards whose wording changed after the fact check (`aws-saa-c03-s4.4-02`, `aws-saa-c03-s4.4-11`) still wait for an independent re-check.

**Tests:**

`tests/content/build.test.ts`, new block appended to the file:

```ts
// The AWS Solutions Architect Associate deck entered after step 1 shipped. This pins what the deploy builds:
// all four reviewed decks together, which the blocks above never build.
describe("the real content: Solutions Architect Associate", () => {
  function readContent(path: string): unknown {
    return JSON.parse(readFileSync(new URL(`../../content/${path}`, import.meta.url), "utf8"));
  }

  const output = buildDecks({
    catalog: readContent("catalog.json"),
    reviewed: {
      "aws-clf-c02": readContent("reviewed/aws-clf-c02.json"),
      "aws-saa-c03": readContent("reviewed/aws-saa-c03.json"),
      "gcp-cdl": readContent("reviewed/gcp-cdl.json"),
      "nextjs-rendering": readContent("reviewed/nextjs-rendering.json"),
    },
    version: VERSION,
  });
  const indexDecks = output.index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks));

  it("lists it under AWS, after Cloud Practitioner, with 154 cards in four sections", () => {
    const aws = output.index.areas.find((area) => area.id === "cloud")?.platforms.find((platform) => platform.id === "aws");
    expect(aws?.decks.map((deck) => [deck.id, deck.code, deck.title, deck.cardCount])).toEqual([
      ["aws-clf-c02", "CLF", "Cloud Practitioner", 214],
      ["aws-saa-c03", "SAA", "Solutions Architect Associate", 154],
    ]);
    const saa = aws?.decks.find((deck) => deck.id === "aws-saa-c03");
    expect(saa?.sections.map((section) => [section.id, section.title, section.cardCount])).toEqual([
      ["SEC", "Secure architectures", 33],
      ["RES", "Resilient architectures", 20],
      ["PRF", "High-performing architectures", 54],
      ["CST", "Cost-optimized architectures", 47],
    ]);
  });

  it("builds a deck file whose every card belongs to the deck and to one of its sections", () => {
    const file = output.decks.find((deck) => deck.id === "aws-saa-c03");
    expect(file?.cards).toHaveLength(154);
    expect(file?.cards.every((card) => card.id.startsWith("aws-saa-c03-"))).toBe(true);
    expect([...new Set(file?.cards.map((card) => card.section))].sort()).toEqual(["CST", "PRF", "RES", "SEC"]);
  });

  it("builds next to the other three decks", () => {
    expect(output.decks.map((deck) => deck.id).sort()).toEqual(["aws-clf-c02", "aws-saa-c03", "gcp-cdl", "nextjs-rendering"]);
  });

  it("writes four deck files the client schema accepts, each with the hash the index names", () => {
    expect(DeckIndexSchema.safeParse(output.index).success).toBe(true);
    for (const deck of output.decks) {
      expect(DeckFileSchema.safeParse(deck).success, deck.id).toBe(true);
      expect(indexDecks.find((entry) => entry.id === deck.id)?.hash, deck.id).toBe(hashDeck(deck.cards));
    }
  });

  it("ships only conflict groups that at least two cards of a deck share", () => {
    for (const deck of output.decks) {
      const uses = new Map<string, number>();
      for (const card of deck.cards) for (const group of card.conflictGroups) uses.set(group, (uses.get(group) ?? 0) + 1);
      for (const [group, count] of uses) expect(count, `${deck.id} ${group}`).toBeGreaterThan(1);
    }
  });
});
```

This block pins content that already exists, so it passes on its first run. Step 3 shows that it can fail.

**Steps:**

- [ ] **Step 1: Check the base and the baseline.** `git merge-base --is-ancestor origin/main HEAD && echo ok` prints `ok` (if it does not, stop: see the README, "Before task 1"). Then, with port 3100 free: `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e`. All green. If a gate is red before any change, stop and report it: the baseline is not the one this plan was written against.
- [ ] **Step 2: Add the SAA block** to `tests/content/build.test.ts`. Run `pnpm vitest run tests/content/build.test.ts`. Expected: all pass, five new tests.
- [ ] **Step 3: Prove the pin bites.** Change `154` to `155` in the first new test, run the file, see it fail with `expected [ …, [ 'aws-saa-c03', 'SAA', 'Solutions Architect Associate', 154 ] ]`, and put `154` back.
- [ ] **Step 4: Update the spec line** (rule 4).
- [ ] **Step 5: Run the gates.** `pnpm test`, `pnpm typecheck`, `pnpm build` (its deck step prints the four decks), then with port 3100 free `pnpm e2e` (all specs pass in both projects).
- [ ] **Step 6: Commit.**

```bash
git add tests/content/build.test.ts docs/superpowers/specs/2026-10-01-truthy-design.md
git commit -m "test: pin the built Solutions Architect Associate deck and name it in the spec's catalog"
```
