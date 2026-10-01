### Task 3: Content schemas, catalog and deck build

The zod schemas every other module uses for content, the hand-written `content/catalog.json`, a pure `buildDecks` function that turns the catalog and the reviewed decks into `public/decks/index.json` plus one file per deck, and the `build:decks` script that runs it before `next build`. Any invalid card or catalog entry fails the build with the deck, the card id and the reason.

Every command runs from the repository root. The real reviewed decks live in `content/reviewed/` (moved in by task 1): `aws-clf-c02.json` (214 cards, each with a `task` such as `"2.1"`), `nextjs-rendering.json` (94 cards, each with a `section` such as `"r1"`) and `gcp-cdl.json` (133 cards, each with a `section` such as `"1.1"`). All three pass the schemas below unchanged.

**Files:**
- Create: `src/content/schema.ts`, `src/content/build.ts`, `scripts/build-decks.ts`, `content/catalog.json`
- Modify: `package.json` (the `build:decks` script, `prebuild` and `predev`), `README.md` (one row in the scripts table)
- Tests: `tests/content/schema.test.ts`, `tests/content/build.test.ts`

**Interfaces:**
- Consumes:
  - Task 1: the `@/` alias (Vitest, `tsc` and `tsx`), `tsx` 4.23.15 as the script runner, `zod` 4.6.5, Vitest with `tests/**/*.test.{ts,tsx}` in the node environment, `content/` moved in, `public/decks/` already in `.gitignore`.
  - Task 2: `"build:tokens": "tsx scripts/build-tokens.ts"` and `"prebuild": "pnpm build:tokens"` in `package.json`, and the `pnpm build:tokens` row in the README scripts table.
- Produces:
  - `src/content/schema.ts`, exactly the exports of the contract:
    - `WHOLE_DECK = "ALL"`
    - `SourceSchema`, `CardSchema` and `type Card`, `DeckFileSchema` and `type DeckFile`, `CatalogSchema` and `type Catalog`, `ReviewedCardSchema`, `ReviewedDeckSchema` and `type ReviewedDeck`, `DeckIndexSchema` and `type DeckIndex`, `type IndexArea`, `type IndexPlatform`, `type IndexDeck`
    - `interface Route { deckId: string; sectionId: string }` and `routeKey(route: Route): string`, which returns `` `${deckId}/${sectionId}` ``
    - `Card` is `{ id: string; section: string; text: { en: { statement: string; explanation: string } }; answer: boolean; source: { title: string; url: string }; difficulty: 1 | 2 | 3; appliesTo: string; conflictGroups: string[] }`. `CardSchema` drops unknown keys, so `DeckFileSchema.parse` in task 8 returns clean cards.
    - One change from the contract text: `SourceSchema.url` is `z.url({ protocol: /^https$/, hostname: z.regexes.domain })` instead of `z.url()`. Plain `z.url()` in zod 4.6.5 accepts `javascript:alert(1)` and `http://` links, and the source link is rendered as a link that opens in a new tab.
  - `src/content/build.ts`:
    - `interface BuildInput { catalog: unknown; reviewed: Record<string, unknown>; version: string }` (reviewed keyed by deck id, version an ISO date `YYYY-MM-DD`)
    - `interface BuildOutput { index: DeckIndex; decks: DeckFile[] }`
    - `class DeckBuildError extends Error` (`name` is `"DeckBuildError"`); messages read `<deck id>: card <card id>: <reason>`, `<deck id>: <reason>` or `catalog: <reason>`
    - `buildDecks(input: BuildInput): BuildOutput`, throws `DeckBuildError`
    - `hashDeck(cards: Card[]): string`, the first 16 hex characters of the sha256 of `JSON.stringify(cards)`
    - It imports `node:crypto`. Only scripts and tests may import it; client code (task 8 and the UI) imports `@/src/content/schema` only.
  - Guarantees of the generated files, which tasks 4, 6, 8 and 10 can rely on:
    - Every shipped card id starts with `` `${deckId}-` `` and is unique within its deck (task 6 `pruneDeck` depends on this).
    - A deck's `section` values are its catalog section ids, or `WHOLE_DECK` for every card when the catalog deck has no sections. In the index such a deck has `sections: []`; the start flow skips the section step for it.
    - A catalog deck without a reviewed file is left out of the index; its platform stays, possibly with `decks: []`. Areas with `platforms: []` stay too. A catalog section that no card falls into is left out of its deck's `sections`. So every `cardCount` in the index is a positive integer.
    - `conflictGroups` only holds groups that at least two cards of the same deck use, each listed once per card.
    - The `hash` in the index equals the deck file's `hash` and does not depend on `version`, so a rebuild on another day does not make players refetch an unchanged deck.
    - `version` is the UTC date of the build (`new Date().toISOString().slice(0, 10)`), the same for every deck.
  - `scripts/build-decks.ts`, run as `pnpm build:decks` (optional arguments `[content dir] [output dir]`, defaults `content` and `public/decks`). Writes `public/decks/index.json` and `public/decks/<deck id>.json` (minified JSON) into an emptied folder, exits 1 with `build-decks: <message>` on any failure and writes nothing in that case.
  - `"prebuild": "pnpm build:tokens && pnpm build:decks"` and `"predev": "pnpm build:tokens && pnpm build:decks"`. `pnpm dev` does not run `prebuild`, so `predev` runs the same chain: on a fresh clone `pnpm dev` generates `app/tokens.css` and `public/decks/` before the server starts.
  - Section ids in `content/catalog.json` (the codes the boarding pass shows):
    - `aws-clf-c02` (CLF, Cloud Practitioner): `CON` Cloud concepts, `SEC` Security and compliance, `TEC` Cloud technology and services, `BIL` Billing, pricing and support
    - `aws-saa-c03` (SAA, Solutions Architect Associate, no reviewed file yet): `SEC` Secure architectures, `RES` Resilient architectures, `PRF` High-performing architectures, `CST` Cost-optimized architectures
    - `gcp-cdl` (CDL, Cloud Digital Leader): no sections, whole deck only
    - `nextjs-rendering` (RND, Rendering): `RSC` Server and client components, `REQ` How a request renders, `STR` Streaming and Suspense, `STA` Static and dynamic rendering, `DAT` Data fetching, `CAC` Caching, the previous model, `CCM` Cache Components, `REV` Revalidation and Server Functions
    - Area and platform ids: `cloud` (`aws`, `gcp`, `azure`), `frontend` (`nextjs`), `devops` (no platforms).

- [ ] **Step 1: Write the failing schema tests**

Create `tests/content/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CardSchema,
  CatalogSchema,
  DeckFileSchema,
  DeckIndexSchema,
  ReviewedCardSchema,
  ReviewedDeckSchema,
  SourceSchema,
  WHOLE_DECK,
  routeKey,
} from "@/src/content/schema";

const source = { title: "What is Cloud Computing?", url: "https://aws.amazon.com/what-is-cloud-computing/" };

function card(overrides: Record<string, unknown> = {}) {
  return {
    id: "aws-clf-c02-t2.1-06",
    section: "SEC",
    text: { en: { statement: "AWS patches the guest operating system on EC2.", explanation: "The customer patches the guest OS." } },
    answer: false,
    source,
    difficulty: 2,
    appliesTo: "",
    conflictGroups: ["shared-responsibility-split"],
    ...overrides,
  };
}

function withStatement(statement: string) {
  return card({ text: { en: { statement, explanation: "Because." } } });
}

function withExplanation(explanation: string) {
  return card({ text: { en: { statement: "A statement.", explanation } } });
}

describe("routeKey", () => {
  it("joins the deck id and the section id with a slash", () => {
    expect(routeKey({ deckId: "aws-clf-c02", sectionId: "SEC" })).toBe("aws-clf-c02/SEC");
  });

  it("uses ALL for the whole deck", () => {
    expect(WHOLE_DECK).toBe("ALL");
    expect(routeKey({ deckId: "nextjs-rendering", sectionId: WHOLE_DECK })).toBe("nextjs-rendering/ALL");
  });
});

describe("SourceSchema", () => {
  it("accepts an https link with a title", () => {
    expect(SourceSchema.safeParse(source).success).toBe(true);
  });

  it("rejects links that are not https", () => {
    for (const url of ["http://aws.amazon.com/", "javascript:alert(1)", "ftp://example.com/file"]) {
      expect(SourceSchema.safeParse({ ...source, url }).success, url).toBe(false);
    }
  });

  it("rejects relative links and hosts without a domain", () => {
    for (const url of ["/docs/page", "https:foo", "https://localhost/x", ""]) {
      expect(SourceSchema.safeParse({ ...source, url }).success, url).toBe(false);
    }
  });

  it("rejects an empty title", () => {
    expect(SourceSchema.safeParse({ ...source, title: "" }).success).toBe(false);
  });
});

describe("CardSchema", () => {
  it("accepts a card in the shipped format", () => {
    expect(CardSchema.parse(card())).toEqual(card());
  });

  it("accepts a statement of exactly 120 characters and rejects 121", () => {
    expect(CardSchema.safeParse(withStatement("x".repeat(120))).success).toBe(true);
    expect(CardSchema.safeParse(withStatement("x".repeat(121))).success).toBe(false);
  });

  it("accepts an explanation of exactly 240 characters and rejects 241", () => {
    expect(CardSchema.safeParse(withExplanation("x".repeat(240))).success).toBe(true);
    expect(CardSchema.safeParse(withExplanation("x".repeat(241))).success).toBe(false);
  });

  it("rejects an empty statement or explanation", () => {
    expect(CardSchema.safeParse(withStatement("")).success).toBe(false);
    expect(CardSchema.safeParse(withExplanation("")).success).toBe(false);
  });

  it("accepts only difficulty 1, 2 or 3", () => {
    for (const difficulty of [1, 2, 3]) {
      expect(CardSchema.safeParse(card({ difficulty })).success).toBe(true);
    }
    for (const difficulty of [0, 4, 1.5, "2"]) {
      expect(CardSchema.safeParse(card({ difficulty })).success, String(difficulty)).toBe(false);
    }
  });

  it("drops pipeline-only fields such as misconception", () => {
    const parsed = CardSchema.parse(card({ misconception: "Customers patch nothing.", factKey: "k" }));
    expect(parsed).not.toHaveProperty("misconception");
    expect(parsed).not.toHaveProperty("factKey");
  });
});

describe("DeckFileSchema", () => {
  it("accepts a deck with one card", () => {
    expect(DeckFileSchema.safeParse({ id: "aws-clf-c02", hash: "0123456789abcdef", cards: [card()] }).success).toBe(true);
  });

  it("rejects a deck with no cards", () => {
    expect(DeckFileSchema.safeParse({ id: "aws-clf-c02", hash: "0123456789abcdef", cards: [] }).success).toBe(false);
  });
});

describe("CatalogSchema", () => {
  const deck = { id: "aws-clf-c02", code: "CLF", title: "Cloud Practitioner", sections: [] };

  it("accepts an area without platforms and a platform without decks", () => {
    const catalog = {
      areas: [
        { id: "devops", title: "DevOps", platforms: [] },
        { id: "cloud", title: "Cloud", platforms: [{ id: "azure", title: "Azure", decks: [] }] },
      ],
    };
    expect(CatalogSchema.safeParse(catalog).success).toBe(true);
  });

  it("requires a three-letter deck code", () => {
    const catalog = (code: string) => ({ areas: [{ id: "cloud", title: "Cloud", platforms: [{ id: "aws", title: "AWS", decks: [{ ...deck, code }] }] }] });
    expect(CatalogSchema.safeParse(catalog("CLF")).success).toBe(true);
    expect(CatalogSchema.safeParse(catalog("CL")).success).toBe(false);
    expect(CatalogSchema.safeParse(catalog("CLFX")).success).toBe(false);
  });

  it("requires a three-letter section id and at least one match value", () => {
    const catalog = (section: object) => ({
      areas: [{ id: "cloud", title: "Cloud", platforms: [{ id: "aws", title: "AWS", decks: [{ ...deck, sections: [section] }] }] }],
    });
    expect(CatalogSchema.safeParse(catalog({ id: "SEC", title: "Security", match: ["2.1"] })).success).toBe(true);
    expect(CatalogSchema.safeParse(catalog({ id: "SECU", title: "Security", match: ["2.1"] })).success).toBe(false);
    expect(CatalogSchema.safeParse(catalog({ id: "SEC", title: "Security", match: [] })).success).toBe(false);
  });

  it("rejects a catalog without areas", () => {
    expect(CatalogSchema.safeParse({}).success).toBe(false);
  });
});

describe("ReviewedCardSchema", () => {
  const clfCard = {
    id: "aws-clf-c02-t1.1-01",
    task: "1.1",
    statement: "Cloud agility helps teams turn new business ideas into working applications quickly.",
    answer: true,
    explanation: "On-demand resources shorten the wait for infrastructure.",
    misconception: "",
    topic: "Cloud agility",
    services: [],
    difficulty: 1,
    volatility: "stable",
    volatilityNote: "",
    source,
    revision: "original",
    conflictGroups: [],
  };
  const rndCard = {
    id: "nextjs-rendering-sr1-01",
    section: "r1",
    statement: "App Router layouts and pages are Server Components by default.",
    answer: true,
    explanation: "Route-level UI starts in the server component graph.",
    misconception: "",
    factKey: "layouts-pages-default-server-components",
    topic: "Component boundaries",
    tags: ["Server Components"],
    appliesTo: "Next.js 16",
    difficulty: 1,
    volatility: "stable",
    volatilityNote: "",
    source: { title: "Server and Client Components", url: "https://nextjs.org/docs/app/getting-started/server-and-client-components" },
    revision: "original",
    conflictGroups: [],
  };

  it("accepts a card that carries a task (the CLF format) and keeps its extra fields", () => {
    const parsed = ReviewedCardSchema.parse(clfCard);
    expect(parsed.task).toBe("1.1");
    expect(parsed).toHaveProperty("topic", "Cloud agility");
  });

  it("accepts a card that carries a section (the newer format)", () => {
    const parsed = ReviewedCardSchema.parse(rndCard);
    expect(parsed.section).toBe("r1");
    expect(parsed.appliesTo).toBe("Next.js 16");
  });

  it("rejects a card without a source", () => {
    const { source: _omitted, ...withoutSource } = clfCard;
    expect(ReviewedCardSchema.safeParse(withoutSource).success).toBe(false);
  });

  it("rejects a deck file with no cards", () => {
    expect(ReviewedDeckSchema.safeParse({ deck: "aws-clf-c02", block: "reviewed", cards: [] }).success).toBe(false);
  });

  it("accepts a deck file with a block field next to deck and cards", () => {
    expect(ReviewedDeckSchema.safeParse({ deck: "aws-clf-c02", block: "reviewed", cards: [clfCard] }).success).toBe(true);
  });
});

describe("DeckIndexSchema", () => {
  const index = (cardCount: number) => ({
    areas: [{ id: "cloud", title: "Cloud", platforms: [{ id: "aws", title: "AWS", decks: [
      { id: "aws-clf-c02", code: "CLF", title: "Cloud Practitioner", cardCount, version: "2026-10-01", hash: "0123456789abcdef", sections: [] },
    ] }] }],
  });

  it("accepts a deck with a positive card count", () => {
    expect(DeckIndexSchema.safeParse(index(214)).success).toBe(true);
  });

  it("rejects a deck with zero cards", () => {
    expect(DeckIndexSchema.safeParse(index(0)).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the schema tests and watch them fail**

Run:

```bash
pnpm vitest run tests/content/schema.test.ts
```

Expected failure, because the module does not exist yet:

```
 FAIL  tests/content/schema.test.ts [ tests/content/schema.test.ts ]
Error: Cannot find package '@/src/content/schema' imported from .../tests/content/schema.test.ts

 Test Files  1 failed (1)
      Tests  no tests
```

- [ ] **Step 3: Write the schemas**

Create `src/content/schema.ts`. The zod names used here (`z.url` with `protocol` and `hostname`, `z.regexes.domain`, `.loose()`) were checked against the installed zod 4.6.5.

```ts
import { z } from "zod";

export const WHOLE_DECK = "ALL"; // section id meaning "the whole deck"

// The source link is rendered as a link that opens in a new tab, so only https links to a real domain are allowed.
export const SourceSchema = z.object({
  title: z.string().min(1),
  url: z.url({ protocol: /^https$/, hostname: z.regexes.domain }),
});

export const CardSchema = z.object({
  id: z.string().min(1),
  section: z.string().min(1), // a section id of the deck's catalog entry, or WHOLE_DECK for decks without sections
  text: z.object({
    en: z.object({
      statement: z.string().min(1).max(120),
      explanation: z.string().min(1).max(240),
    }),
  }),
  answer: z.boolean(),
  source: SourceSchema,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  appliesTo: z.string(),
  conflictGroups: z.array(z.string()),
});
export type Card = z.infer<typeof CardSchema>;

export const DeckFileSchema = z.object({
  id: z.string().min(1),
  hash: z.string().min(1),
  cards: z.array(CardSchema).min(1),
});
export type DeckFile = z.infer<typeof DeckFileSchema>;

// content/catalog.json, hand-written
export const CatalogSchema = z.object({
  areas: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      platforms: z.array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          decks: z.array(
            z.object({
              id: z.string().min(1),
              code: z.string().length(3),
              title: z.string().min(1),
              sections: z.array(
                z.object({
                  id: z.string().length(3),
                  title: z.string().min(1),
                  match: z.array(z.string().min(1)).min(1),
                }),
              ),
            }),
          ),
        }),
      ),
    }),
  ),
});
export type Catalog = z.infer<typeof CatalogSchema>;

// content/reviewed/<deck id>.json, written by the content pipeline.
// Cards carry either "task" (CLF deck) or "section" (newer decks). Pipeline-only fields pass through untouched.
export const ReviewedCardSchema = z
  .object({
    id: z.string().min(1),
    statement: z.string(),
    answer: z.boolean(),
    explanation: z.string(),
    source: SourceSchema,
    difficulty: z.number(),
    task: z.string().optional(),
    section: z.string().optional(),
    appliesTo: z.string().optional(),
    conflictGroups: z.array(z.string()).optional(),
  })
  .loose();
export const ReviewedDeckSchema = z
  .object({ deck: z.string().min(1), cards: z.array(ReviewedCardSchema).min(1) })
  .loose();
export type ReviewedDeck = z.infer<typeof ReviewedDeckSchema>;

// public/decks/index.json
export const DeckIndexSchema = z.object({
  areas: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      platforms: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          decks: z.array(
            z.object({
              id: z.string(),
              code: z.string(),
              title: z.string(),
              cardCount: z.number().int().positive(),
              version: z.string(),
              hash: z.string(),
              sections: z.array(
                z.object({ id: z.string(), title: z.string(), cardCount: z.number().int().positive() }),
              ),
            }),
          ),
        }),
      ),
    }),
  ),
});
export type DeckIndex = z.infer<typeof DeckIndexSchema>;
export type IndexArea = DeckIndex["areas"][number];
export type IndexPlatform = IndexArea["platforms"][number];
export type IndexDeck = IndexPlatform["decks"][number];

export interface Route {
  deckId: string;
  sectionId: string; // a section id or WHOLE_DECK
}

export function routeKey(route: Route): string {
  return `${route.deckId}/${route.sectionId}`;
}
```

- [ ] **Step 4: Run the schema tests and watch them pass**

Run:

```bash
pnpm vitest run tests/content/schema.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  25 passed (25)
```

- [ ] **Step 5: Commit**

```bash
git add src/content/schema.ts tests/content/schema.test.ts
git commit -m "feat: add zod schemas for the catalog, reviewed decks and deck files"
```

- [ ] **Step 6: Write the failing hash tests**

Create `tests/content/build.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashDeck } from "@/src/content/build";
import type { Card } from "@/src/content/schema";

function shippedCard(id: string, statement: string): Card {
  return {
    id,
    section: "SEC",
    text: { en: { statement, explanation: "Because." } },
    answer: true,
    source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
    difficulty: 1,
    appliesTo: "",
    conflictGroups: [],
  };
}

describe("hashDeck", () => {
  const cards = [shippedCard("d-1", "One."), shippedCard("d-2", "Two.")];

  it("is the first 16 hex characters of a sha256", () => {
    expect(hashDeck(cards)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("gives the same hash for the same cards", () => {
    const copy = structuredClone(cards);
    expect(hashDeck(copy)).toBe(hashDeck(cards));
  });

  it("changes when a statement changes", () => {
    const edited = [shippedCard("d-1", "One, edited."), shippedCard("d-2", "Two.")];
    expect(hashDeck(edited)).not.toBe(hashDeck(cards));
  });

  it("changes when a card is removed", () => {
    expect(hashDeck(cards.slice(0, 1))).not.toBe(hashDeck(cards));
  });

  it("hashes an empty list without throwing", () => {
    expect(hashDeck([])).toMatch(/^[0-9a-f]{16}$/);
  });
});
```

- [ ] **Step 7: Run the hash tests and watch them fail**

Run:

```bash
pnpm vitest run tests/content/build.test.ts
```

Expected:

```
 FAIL  tests/content/build.test.ts [ tests/content/build.test.ts ]
Error: Cannot find package '@/src/content/build' imported from .../tests/content/build.test.ts

 Test Files  1 failed (1)
      Tests  no tests
```

- [ ] **Step 8: Write hashDeck**

Create `src/content/build.ts`:

```ts
import { createHash } from "node:crypto";
import type { Card } from "./schema";

// First 16 hex characters of the sha256 of the cards as JSON. The client refetches a deck when this changes.
export function hashDeck(cards: Card[]): string {
  return createHash("sha256").update(JSON.stringify(cards)).digest("hex").slice(0, 16);
}
```

- [ ] **Step 9: Run the hash tests and watch them pass**

Run:

```bash
pnpm vitest run tests/content/build.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

- [ ] **Step 10: Commit**

```bash
git add src/content/build.ts tests/content/build.test.ts
git commit -m "feat: hash deck contents so clients refetch only changed decks"
```

- [ ] **Step 11: Write the failing tests for section mapping and the index**

In `tests/content/build.test.ts`, replace the two import lines

```ts
import { hashDeck } from "@/src/content/build";
import type { Card } from "@/src/content/schema";
```

with

```ts
import { DeckBuildError, buildDecks, hashDeck, type BuildOutput } from "@/src/content/build";
import { DeckFileSchema, DeckIndexSchema, WHOLE_DECK, type Card } from "@/src/content/schema";
```

Then append this to the end of the file, after one blank line:

```ts
const VERSION = "2026-10-01";

function reviewedCard(id: string, mapping: { task?: string; section?: string }, overrides: Record<string, unknown> = {}) {
  return {
    id,
    ...mapping,
    statement: `Statement of ${id}.`,
    answer: true,
    explanation: `Explanation of ${id}.`,
    misconception: "",
    topic: "Topic",
    difficulty: 2,
    volatility: "stable",
    source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
    revision: "original",
    conflictGroups: [],
    ...overrides,
  };
}

function reviewedDeck(deck: string, cards: object[]) {
  return { deck, block: "reviewed", cards };
}

const clfEntry = {
  id: "aws-clf-c02",
  code: "CLF",
  title: "Cloud Practitioner",
  sections: [
    { id: "CON", title: "Cloud concepts", match: ["1.1", "1.2"] },
    { id: "SEC", title: "Security and compliance", match: ["2.1"] },
  ],
};

function catalog(decks: object[]) {
  return {
    areas: [
      {
        id: "cloud",
        title: "Cloud",
        platforms: [
          { id: "aws", title: "AWS", decks },
          { id: "azure", title: "Azure", decks: [] },
        ],
      },
      { id: "devops", title: "DevOps", platforms: [] },
    ],
  };
}

function build(decks: object[], reviewed: Record<string, unknown>): BuildOutput {
  return buildDecks({ catalog: catalog(decks), reviewed, version: VERSION });
}

function firstDeck(output: BuildOutput) {
  const deck = output.index.areas[0]?.platforms[0]?.decks[0];
  if (!deck) throw new Error("the index has no deck");
  return deck;
}

function clfReviewed() {
  return reviewedDeck("aws-clf-c02", [
    reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }),
    reviewedCard("aws-clf-c02-t1.2-01", { task: "1.2" }),
    reviewedCard("aws-clf-c02-t2.1-01", { task: "2.1" }),
  ]);
}

describe("buildDecks: sections and the shipped format", () => {
  it("puts each card in the section whose match list holds its task", () => {
    const output = build([clfEntry], { "aws-clf-c02": clfReviewed() });
    expect(output.decks[0]?.cards.map((card) => card.section)).toEqual(["CON", "CON", "SEC"]);
    expect(firstDeck(output).sections).toEqual([
      { id: "CON", title: "Cloud concepts", cardCount: 2 },
      { id: "SEC", title: "Security and compliance", cardCount: 1 },
    ]);
    expect(firstDeck(output).cardCount).toBe(3);
  });

  it("maps cards by their section field as well", () => {
    const entry = {
      id: "nextjs-rendering",
      code: "RND",
      title: "Rendering",
      sections: [
        { id: "RSC", title: "Server and client components", match: ["r1"] },
        { id: "REQ", title: "How a request renders", match: ["r2"] },
      ],
    };
    const reviewed = reviewedDeck("nextjs-rendering", [
      reviewedCard("nextjs-rendering-sr2-01", { section: "r2" }),
      reviewedCard("nextjs-rendering-sr1-01", { section: "r1" }),
    ]);
    const output = build([entry], { "nextjs-rendering": reviewed });
    expect(output.decks[0]?.cards.map((card) => card.section)).toEqual(["REQ", "RSC"]);
  });

  it("ships cards with text keyed by language and without pipeline-only fields", () => {
    const output = build([clfEntry], { "aws-clf-c02": clfReviewed() });
    expect(output.decks[0]?.cards[0]).toEqual({
      id: "aws-clf-c02-t1.1-01",
      section: "CON",
      text: { en: { statement: "Statement of aws-clf-c02-t1.1-01.", explanation: "Explanation of aws-clf-c02-t1.1-01." } },
      answer: true,
      source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
      difficulty: 2,
      appliesTo: "",
      conflictGroups: [],
    });
  });

  it("keeps appliesTo when the reviewed card has one", () => {
    const reviewed = reviewedDeck("aws-clf-c02", [
      reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { appliesTo: "Next.js 16 with cacheComponents: true" }),
    ]);
    const output = build([clfEntry], { "aws-clf-c02": reviewed });
    expect(output.decks[0]?.cards[0]?.appliesTo).toBe("Next.js 16 with cacheComponents: true");
  });

  it("puts the build version and the deck file hash in the index", () => {
    const output = build([clfEntry], { "aws-clf-c02": clfReviewed() });
    const file = output.decks[0];
    expect(file?.id).toBe("aws-clf-c02");
    expect(firstDeck(output).version).toBe(VERSION);
    expect(firstDeck(output).hash).toBe(file?.hash);
    expect(file?.hash).toBe(hashDeck(file?.cards ?? []));
  });

  it("keeps the hash when only the build date changes, so players do not refetch an unchanged deck", () => {
    const reviewed = { "aws-clf-c02": clfReviewed() };
    const monday = buildDecks({ catalog: catalog([clfEntry]), reviewed, version: "2026-10-05" });
    const tuesday = buildDecks({ catalog: catalog([clfEntry]), reviewed, version: "2026-10-06" });
    expect(firstDeck(tuesday).version).toBe("2026-10-06");
    expect(firstDeck(tuesday).hash).toBe(firstDeck(monday).hash);
  });

  it("allows the same section id in two different decks", () => {
    const saa = { id: "aws-saa-c03", code: "SAA", title: "Solutions Architect Associate", sections: [{ id: "SEC", title: "Secure architectures", match: ["1.1"] }] };
    const saaReviewed = reviewedDeck("aws-saa-c03", [reviewedCard("aws-saa-c03-t1.1-01", { task: "1.1" })]);
    const output = build([clfEntry, saa], { "aws-clf-c02": clfReviewed(), "aws-saa-c03": saaReviewed });
    const decks = output.index.areas[0]?.platforms[0]?.decks ?? [];
    expect(decks.map((deck) => [deck.id, deck.sections.map((section) => section.id)])).toEqual([
      ["aws-clf-c02", ["CON", "SEC"]],
      ["aws-saa-c03", ["SEC"]],
    ]);
  });

  it("plays a deck without sections as the whole deck", () => {
    const entry = { id: "gcp-cdl", code: "CDL", title: "Cloud Digital Leader", sections: [] };
    const reviewed = reviewedDeck("gcp-cdl", [
      reviewedCard("gcp-cdl-s1.1-01", { section: "1.1" }),
      reviewedCard("gcp-cdl-s9.9-01", {}),
    ]);
    const output = build([entry], { "gcp-cdl": reviewed });
    expect(output.decks[0]?.cards.map((card) => card.section)).toEqual([WHOLE_DECK, WHOLE_DECK]);
    expect(firstDeck(output).sections).toEqual([]);
    expect(firstDeck(output).cardCount).toBe(2);
  });

  it("produces output that the client schemas accept", () => {
    const output = build([clfEntry], { "aws-clf-c02": clfReviewed() });
    expect(DeckIndexSchema.safeParse(output.index).success).toBe(true);
    for (const deck of output.decks) expect(DeckFileSchema.safeParse(deck).success).toBe(true);
  });
});

describe("buildDecks: what is available", () => {
  it("leaves out a catalog deck that has no reviewed file but keeps its platform", () => {
    const saa = { id: "aws-saa-c03", code: "SAA", title: "Solutions Architect Associate", sections: [{ id: "SEC", title: "Secure architectures", match: ["1.1"] }] };
    const output = build([clfEntry, saa], { "aws-clf-c02": clfReviewed() });
    expect(output.index.areas[0]?.platforms[0]?.decks.map((deck) => deck.id)).toEqual(["aws-clf-c02"]);
    expect(output.decks.map((deck) => deck.id)).toEqual(["aws-clf-c02"]);
  });

  it("keeps platforms without decks and areas without platforms", () => {
    const output = build([], {});
    expect(output.index.areas.map((area) => area.id)).toEqual(["cloud", "devops"]);
    expect(output.index.areas[0]?.platforms.map((platform) => [platform.id, platform.decks.length])).toEqual([
      ["aws", 0],
      ["azure", 0],
    ]);
    expect(output.index.areas[1]?.platforms).toEqual([]);
    expect(output.decks).toEqual([]);
  });

  it("ignores a reviewed file whose deck is not in the catalog", () => {
    const stray = reviewedDeck("aws-dva-c02", [reviewedCard("aws-dva-c02-t1.1-01", { task: "1.1" })]);
    const output = build([clfEntry], { "aws-clf-c02": clfReviewed(), "aws-dva-c02": stray });
    expect(output.decks.map((deck) => deck.id)).toEqual(["aws-clf-c02"]);
  });
});

function expectBuildError(run: () => unknown, ...fragments: string[]) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(DeckBuildError);
  const message = (caught as Error).message;
  for (const fragment of fragments) expect(message).toContain(fragment);
}

function clfWith(...cards: object[]) {
  return { "aws-clf-c02": reviewedDeck("aws-clf-c02", cards) };
}

describe("buildDecks: section mapping errors", () => {
  it("fails on a card that matches no section, naming the deck, the card and its task", () => {
    expectBuildError(
      () => build([clfEntry], clfWith(reviewedCard("aws-clf-c02-t3.1-01", { task: "3.1" }))),
      "aws-clf-c02: card aws-clf-c02-t3.1-01:",
      "3.1 matches no section",
    );
  });

  it("fails on a card that matches two sections", () => {
    const overlapping = {
      ...clfEntry,
      sections: [
        { id: "CON", title: "Cloud concepts", match: ["1.1"] },
        { id: "SEC", title: "Security and compliance", match: ["1.1", "2.1"] },
      ],
    };
    expectBuildError(
      () => build([overlapping], clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }))),
      "aws-clf-c02: card aws-clf-c02-t1.1-01:",
      "matches more than one section (CON, SEC)",
    );
  });

  it("fails on a card with neither a task nor a section when the deck has sections", () => {
    expectBuildError(
      () => build([clfEntry], clfWith(reviewedCard("aws-clf-c02-x-01", {}))),
      "card aws-clf-c02-x-01: has neither a task nor a section",
    );
  });

  it("fails on a reviewed file that is not a deck at all", () => {
    for (const corrupt of [null, "not json", [], { cards: "none" }]) {
      expectBuildError(() => build([clfEntry], { "aws-clf-c02": corrupt }), "aws-clf-c02:");
    }
  });
});
```

- [ ] **Step 12: Run the tests and watch the new ones fail**

Run:

```bash
pnpm vitest run tests/content/build.test.ts
```

Expected: the 16 new tests fail and the 5 hash tests still pass. Twelve failures read `TypeError: buildDecks is not a function`; the four tests in "buildDecks: section mapping errors" read `AssertionError: The instanceof assertion needs a constructor but undefined was given.` because `DeckBuildError` is not exported yet.

```
      Tests  16 failed | 5 passed (21)
```

- [ ] **Step 13: Build the index and the deck files**

Replace the whole of `src/content/build.ts` with:

```ts
import { createHash } from "node:crypto";
import {
  CatalogSchema,
  ReviewedDeckSchema,
  WHOLE_DECK,
  type Card,
  type Catalog,
  type DeckFile,
  type DeckIndex,
  type IndexDeck,
  type ReviewedDeck,
} from "./schema";

export interface BuildInput {
  catalog: unknown;
  reviewed: Record<string, unknown>; // keyed by deck id
  version: string; // ISO date of this build
}

export interface BuildOutput {
  index: DeckIndex;
  decks: DeckFile[];
}

// The message names the deck, the card id and the reason, so a failed build says what to fix.
export class DeckBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeckBuildError";
  }
}

type CatalogDeck = Catalog["areas"][number]["platforms"][number]["decks"][number];
type ReviewedCard = ReviewedDeck["cards"][number];

// First 16 hex characters of the sha256 of the cards as JSON. The client refetches a deck when this changes.
export function hashDeck(cards: Card[]): string {
  return createHash("sha256").update(JSON.stringify(cards)).digest("hex").slice(0, 16);
}

function cardError(deckId: string, cardId: string, reason: string): DeckBuildError {
  return new DeckBuildError(`${deckId}: card ${cardId}: ${reason}`);
}

function parseCatalog(raw: unknown): Catalog {
  const result = CatalogSchema.safeParse(raw);
  if (!result.success) throw new DeckBuildError(`catalog: ${result.error.message}`);
  return result.data;
}

function parseReviewed(deckId: string, raw: unknown): ReviewedDeck {
  const result = ReviewedDeckSchema.safeParse(raw);
  if (!result.success) throw new DeckBuildError(`${deckId}: ${result.error.message}`);
  return result.data;
}

function sectionFor(entry: CatalogDeck, card: ReviewedCard): string {
  if (entry.sections.length === 0) return WHOLE_DECK;
  const values = [card.task, card.section].filter((value): value is string => value !== undefined);
  if (values.length === 0) throw cardError(entry.id, card.id, "has neither a task nor a section to place it in a section");
  const matched = entry.sections.filter((section) => values.some((value) => section.match.includes(value)));
  const [only] = matched;
  if (!only) throw cardError(entry.id, card.id, `${values.join(" / ")} matches no section`);
  if (matched.length > 1) {
    throw cardError(entry.id, card.id, `${values.join(" / ")} matches more than one section (${matched.map((section) => section.id).join(", ")})`);
  }
  return only.id;
}

function toCard(entry: CatalogDeck, card: ReviewedCard): Card {
  return {
    id: card.id,
    section: sectionFor(entry, card),
    text: { en: { statement: card.statement, explanation: card.explanation } },
    answer: card.answer,
    source: { title: card.source.title, url: card.source.url },
    difficulty: card.difficulty as Card["difficulty"],
    appliesTo: card.appliesTo ?? "",
    conflictGroups: card.conflictGroups ?? [],
  };
}

function buildDeck(entry: CatalogDeck, raw: unknown, version: string): { file: DeckFile; summary: IndexDeck } {
  const reviewed = parseReviewed(entry.id, raw);
  const cards = reviewed.cards.map((card) => toCard(entry, card));
  const file: DeckFile = { id: entry.id, hash: hashDeck(cards), cards };
  const sections = entry.sections.map((section) => ({
    id: section.id,
    title: section.title,
    cardCount: cards.filter((card) => card.section === section.id).length,
  }));
  const summary: IndexDeck = {
    id: entry.id,
    code: entry.code,
    title: entry.title,
    cardCount: cards.length,
    version,
    hash: file.hash,
    sections,
  };
  return { file, summary };
}

export function buildDecks(input: BuildInput): BuildOutput {
  const catalog = parseCatalog(input.catalog);
  const decks: DeckFile[] = [];
  const index: DeckIndex = {
    areas: catalog.areas.map((area) => ({
      id: area.id,
      title: area.title,
      platforms: area.platforms.map((platform) => ({
        id: platform.id,
        title: platform.title,
        decks: platform.decks.flatMap((entry) => {
          // A catalog deck without a reviewed file is not available yet and is left out.
          if (!Object.hasOwn(input.reviewed, entry.id)) return [];
          const { file, summary } = buildDeck(entry, input.reviewed[entry.id], input.version);
          decks.push(file);
          return [summary];
        }),
      })),
    })),
  };
  return { index, decks };
}
```

- [ ] **Step 14: Run the tests and watch them pass**

Run:

```bash
pnpm vitest run tests/content/build.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

- [ ] **Step 15: Commit**

```bash
git add src/content/build.ts tests/content/build.test.ts
git commit -m "feat: build the deck index and deck files from the catalog"
```

- [ ] **Step 16: Write the failing tests for invalid cards and catalog entries**

Append this to the end of `tests/content/build.test.ts`, after one blank line:

```ts
describe("buildDecks: card and catalog errors", () => {
  it("accepts a statement of exactly 120 characters and fails on 121", () => {
    const at = (length: number) => clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { statement: "x".repeat(length) }));
    expect(build([clfEntry], at(120)).decks[0]?.cards[0]?.text.en.statement).toHaveLength(120);
    expectBuildError(() => build([clfEntry], at(121)), "card aws-clf-c02-t1.1-01: statement is 121 characters, the limit is 120");
  });

  it("accepts an explanation of exactly 240 characters and fails on 241", () => {
    const at = (length: number) => clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { explanation: "x".repeat(length) }));
    expect(build([clfEntry], at(240)).decks[0]?.cards[0]?.text.en.explanation).toHaveLength(240);
    expectBuildError(() => build([clfEntry], at(241)), "card aws-clf-c02-t1.1-01: explanation is 241 characters, the limit is 240");
  });

  it("fails on an empty or blank statement", () => {
    for (const statement of ["", "   "]) {
      expectBuildError(
        () => build([clfEntry], clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { statement }))),
        "card aws-clf-c02-t1.1-01: statement is empty",
      );
    }
  });

  it("fails on a difficulty other than 1, 2 or 3", () => {
    for (const difficulty of [0, 4, 2.5]) {
      expectBuildError(
        () => build([clfEntry], clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { difficulty }))),
        `card aws-clf-c02-t1.1-01: difficulty must be 1, 2 or 3, not ${difficulty}`,
      );
    }
  });

  it("fails on a source link that is not https and names the card", () => {
    const card = reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { source: { title: "Docs", url: "http://docs.aws.amazon.com/" } });
    expectBuildError(() => build([clfEntry], clfWith(card)), "aws-clf-c02: card aws-clf-c02-t1.1-01: source.url");
  });

  it("names a card by its position when it has no id", () => {
    const { id: _omitted, ...withoutId } = reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" });
    expectBuildError(() => build([clfEntry], clfWith(reviewedCard("aws-clf-c02-t1.1-02", { task: "1.1" }), withoutId)), "aws-clf-c02: card #2: id");
  });

  it("fails on a reviewed file with no cards", () => {
    expectBuildError(() => build([clfEntry], clfWith()), "aws-clf-c02: cards");
  });

  it("fails when the reviewed file is for another deck", () => {
    const reviewed = reviewedDeck("aws-saa-c03", [reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" })]);
    expectBuildError(() => build([clfEntry], { "aws-clf-c02": reviewed }), "aws-clf-c02: the reviewed file is for deck aws-saa-c03");
  });

  it("fails on a card id used twice in one deck", () => {
    const card = reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" });
    expectBuildError(() => build([clfEntry], clfWith(card, card)), "card aws-clf-c02-t1.1-01: the card id is used twice");
  });

  it("fails on a card id that does not start with the deck id", () => {
    expectBuildError(
      () => build([clfEntry], clfWith(reviewedCard("clf-t1.1-01", { task: "1.1" }))),
      "card clf-t1.1-01: the card id must start with aws-clf-c02-",
    );
  });

  it("fails on a catalog that does not match the schema", () => {
    expectBuildError(() => buildDecks({ catalog: { areas: "none" }, reviewed: {}, version: VERSION }), "catalog: areas");
    expectBuildError(() => buildDecks({ catalog: null, reviewed: {}, version: VERSION }), "catalog:");
  });

  it("fails on a deck listed twice in the catalog", () => {
    expectBuildError(() => build([clfEntry, clfEntry], { "aws-clf-c02": clfReviewed() }), "catalog: deck aws-clf-c02 is listed twice");
  });

  it("fails on an area or a platform listed twice", () => {
    const area = { id: "cloud", title: "Cloud", platforms: [] };
    expectBuildError(() => buildDecks({ catalog: { areas: [area, area] }, reviewed: {}, version: VERSION }), "catalog: area cloud is listed twice");
    const platform = { id: "aws", title: "AWS", decks: [] };
    const twice = { areas: [{ id: "cloud", title: "Cloud", platforms: [platform, platform] }] };
    expectBuildError(() => buildDecks({ catalog: twice, reviewed: {}, version: VERSION }), "catalog: area cloud: platform aws is listed twice");
  });

  it("fails on a section id used twice in one deck", () => {
    const twice = { ...clfEntry, sections: [clfEntry.sections[0], clfEntry.sections[0]] };
    expectBuildError(() => build([twice], { "aws-clf-c02": clfReviewed() }), "catalog: deck aws-clf-c02: section CON is listed twice");
  });

  it("fails on a section whose id is the whole deck id", () => {
    const reserved = { ...clfEntry, sections: [{ id: WHOLE_DECK, title: "Everything", match: ["1.1"] }] };
    expectBuildError(() => build([reserved], { "aws-clf-c02": clfReviewed() }), `catalog: deck aws-clf-c02: section id ${WHOLE_DECK} is reserved for the whole deck`);
  });

  it("fails on a version that is not an ISO date", () => {
    expectBuildError(
      () => buildDecks({ catalog: catalog([clfEntry]), reviewed: { "aws-clf-c02": clfReviewed() }, version: "yesterday" }),
      "version must be an ISO date (YYYY-MM-DD), not yesterday",
    );
  });
});
```

- [ ] **Step 17: Run the tests and watch the new ones fail**

Run:

```bash
pnpm vitest run tests/content/build.test.ts
```

Expected: the 16 new tests fail. Most report `AssertionError: expected undefined to be an instance of DeckBuildError` (nothing was thrown); the schema failures report a raw zod message such as `expected 'aws-clf-c02: [\n  {\n    "code": "inv…' to contain 'aws-clf-c02: card aws-clf-c02-t1.1-01…'`; the two section checks report the card error that the catalog check should have pre-empted.

```
      Tests  16 failed | 21 passed (37)
```

- [ ] **Step 18: Validate cards and the catalog**

Replace the whole of `src/content/build.ts` with:

```ts
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CardSchema,
  CatalogSchema,
  ReviewedDeckSchema,
  WHOLE_DECK,
  type Card,
  type Catalog,
  type DeckFile,
  type DeckIndex,
  type IndexDeck,
  type ReviewedDeck,
} from "./schema";

export interface BuildInput {
  catalog: unknown;
  reviewed: Record<string, unknown>; // keyed by deck id
  version: string; // ISO date of this build
}

export interface BuildOutput {
  index: DeckIndex;
  decks: DeckFile[];
}

// The message names the deck, the card id and the reason, so a failed build says what to fix.
export class DeckBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeckBuildError";
  }
}

type CatalogDeck = Catalog["areas"][number]["platforms"][number]["decks"][number];
type ReviewedCard = ReviewedDeck["cards"][number];

// First 16 hex characters of the sha256 of the cards as JSON. The client refetches a deck when this changes.
export function hashDeck(cards: Card[]): string {
  return createHash("sha256").update(JSON.stringify(cards)).digest("hex").slice(0, 16);
}

function cardError(deckId: string, cardId: string, reason: string): DeckBuildError {
  return new DeckBuildError(`${deckId}: card ${cardId}: ${reason}`);
}

const LIMITS = { statement: 120, explanation: 240 } as const;

function describeIssue(issue: z.core.$ZodIssue | undefined): string {
  if (!issue) return "is not valid";
  const path = issue.path.map(String).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

function parseCatalog(raw: unknown): Catalog {
  const result = CatalogSchema.safeParse(raw);
  if (!result.success) throw new DeckBuildError(`catalog: ${describeIssue(result.error.issues[0])}`);
  const catalog = result.data;
  const areaIds = new Set<string>();
  const deckIds = new Set<string>();
  for (const area of catalog.areas) {
    if (areaIds.has(area.id)) throw new DeckBuildError(`catalog: area ${area.id} is listed twice`);
    areaIds.add(area.id);
    const platformIds = new Set<string>();
    for (const platform of area.platforms) {
      if (platformIds.has(platform.id)) throw new DeckBuildError(`catalog: area ${area.id}: platform ${platform.id} is listed twice`);
      platformIds.add(platform.id);
      for (const deck of platform.decks) {
        if (deckIds.has(deck.id)) throw new DeckBuildError(`catalog: deck ${deck.id} is listed twice`);
        deckIds.add(deck.id);
        const sectionIds = new Set<string>();
        for (const section of deck.sections) {
          if (section.id === WHOLE_DECK) {
            throw new DeckBuildError(`catalog: deck ${deck.id}: section id ${WHOLE_DECK} is reserved for the whole deck`);
          }
          if (sectionIds.has(section.id)) throw new DeckBuildError(`catalog: deck ${deck.id}: section ${section.id} is listed twice`);
          sectionIds.add(section.id);
        }
      }
    }
  }
  return catalog;
}

// The id of the card at a position in a file that failed validation, or its position when it has none.
function cardLabel(raw: unknown, position: number): string {
  const cards: unknown = typeof raw === "object" && raw !== null ? (raw as { cards?: unknown }).cards : undefined;
  const card: unknown = Array.isArray(cards) ? cards[position] : undefined;
  const id: unknown = typeof card === "object" && card !== null ? (card as { id?: unknown }).id : undefined;
  return typeof id === "string" && id.length > 0 ? id : `#${position + 1}`;
}

function parseReviewed(deckId: string, raw: unknown): ReviewedDeck {
  const result = ReviewedDeckSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const [first, position, ...rest] = issue?.path ?? [];
    if (issue && first === "cards" && typeof position === "number") {
      throw new DeckBuildError(`${deckId}: card ${cardLabel(raw, position)}: ${describeIssue({ ...issue, path: rest })}`);
    }
    throw new DeckBuildError(`${deckId}: ${describeIssue(issue)}`);
  }
  if (result.data.deck !== deckId) throw new DeckBuildError(`${deckId}: the reviewed file is for deck ${result.data.deck}`);
  return result.data;
}

function checkCard(deckId: string, card: ReviewedCard, seen: Set<string>): void {
  if (!card.id.startsWith(`${deckId}-`)) throw cardError(deckId, card.id, `the card id must start with ${deckId}-`);
  if (seen.has(card.id)) throw cardError(deckId, card.id, "the card id is used twice");
  seen.add(card.id);
  for (const field of ["statement", "explanation"] as const) {
    const text = card[field];
    if (text.trim().length === 0) throw cardError(deckId, card.id, `${field} is empty`);
    if (text.length > LIMITS[field]) {
      throw cardError(deckId, card.id, `${field} is ${text.length} characters, the limit is ${LIMITS[field]}`);
    }
  }
  if (![1, 2, 3].includes(card.difficulty)) {
    throw cardError(deckId, card.id, `difficulty must be 1, 2 or 3, not ${card.difficulty}`);
  }
}

function sectionFor(entry: CatalogDeck, card: ReviewedCard): string {
  if (entry.sections.length === 0) return WHOLE_DECK;
  const values = [card.task, card.section].filter((value): value is string => value !== undefined);
  if (values.length === 0) throw cardError(entry.id, card.id, "has neither a task nor a section to place it in a section");
  const matched = entry.sections.filter((section) => values.some((value) => section.match.includes(value)));
  const [only] = matched;
  if (!only) throw cardError(entry.id, card.id, `${values.join(" / ")} matches no section`);
  if (matched.length > 1) {
    throw cardError(entry.id, card.id, `${values.join(" / ")} matches more than one section (${matched.map((section) => section.id).join(", ")})`);
  }
  return only.id;
}

function toCard(entry: CatalogDeck, card: ReviewedCard): Card {
  const shipped = {
    id: card.id,
    section: sectionFor(entry, card),
    text: { en: { statement: card.statement, explanation: card.explanation } },
    answer: card.answer,
    source: { title: card.source.title, url: card.source.url },
    difficulty: card.difficulty,
    appliesTo: card.appliesTo ?? "",
    conflictGroups: card.conflictGroups ?? [],
  };
  // A last guard: whatever ships must pass the schema the client validates with.
  const result = CardSchema.safeParse(shipped);
  if (!result.success) throw cardError(entry.id, card.id, describeIssue(result.error.issues[0]));
  return result.data;
}

function buildDeck(entry: CatalogDeck, raw: unknown, version: string): { file: DeckFile; summary: IndexDeck } {
  const reviewed = parseReviewed(entry.id, raw);
  const seen = new Set<string>();
  for (const card of reviewed.cards) checkCard(entry.id, card, seen);
  const cards = reviewed.cards.map((card) => toCard(entry, card));
  const file: DeckFile = { id: entry.id, hash: hashDeck(cards), cards };
  const sections = entry.sections.map((section) => ({
    id: section.id,
    title: section.title,
    cardCount: cards.filter((card) => card.section === section.id).length,
  }));
  const summary: IndexDeck = {
    id: entry.id,
    code: entry.code,
    title: entry.title,
    cardCount: cards.length,
    version,
    hash: file.hash,
    sections,
  };
  return { file, summary };
}

export function buildDecks(input: BuildInput): BuildOutput {
  if (!z.iso.date().safeParse(input.version).success) {
    throw new DeckBuildError(`version must be an ISO date (YYYY-MM-DD), not ${input.version}`);
  }
  const catalog = parseCatalog(input.catalog);
  const decks: DeckFile[] = [];
  const index: DeckIndex = {
    areas: catalog.areas.map((area) => ({
      id: area.id,
      title: area.title,
      platforms: area.platforms.map((platform) => ({
        id: platform.id,
        title: platform.title,
        decks: platform.decks.flatMap((entry) => {
          // A catalog deck without a reviewed file is not available yet and is left out.
          if (!Object.hasOwn(input.reviewed, entry.id)) return [];
          const { file, summary } = buildDeck(entry, input.reviewed[entry.id], input.version);
          decks.push(file);
          return [summary];
        }),
      })),
    })),
  };
  return { index, decks };
}
```

- [ ] **Step 19: Run the tests and watch them pass**

Run:

```bash
pnpm vitest run tests/content/build.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  37 passed (37)
```

- [ ] **Step 20: Commit**

```bash
git add src/content/build.ts tests/content/build.test.ts
git commit -m "feat: fail the deck build on invalid cards and catalog entries"
```

- [ ] **Step 21: Write the failing tests for conflict groups and empty sections**

Append this to the end of `tests/content/build.test.ts`, after one blank line:

```ts
describe("buildDecks: conflict groups and empty sections", () => {
  function groupsOf(output: BuildOutput) {
    return Object.fromEntries((output.decks[0]?.cards ?? []).map((card) => [card.id, card.conflictGroups]));
  }

  it("keeps a conflict group that two cards share", () => {
    const output = build(
      [clfEntry],
      clfWith(
        reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { conflictGroups: ["shared-responsibility-split"] }),
        reviewedCard("aws-clf-c02-t2.1-01", { task: "2.1" }, { conflictGroups: ["shared-responsibility-split"] }),
      ),
    );
    expect(groupsOf(output)).toEqual({
      "aws-clf-c02-t1.1-01": ["shared-responsibility-split"],
      "aws-clf-c02-t2.1-01": ["shared-responsibility-split"],
    });
  });

  it("drops a conflict group that only one card uses", () => {
    const output = build(
      [clfEntry],
      clfWith(
        reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { conflictGroups: ["lonely", "pair"] }),
        reviewedCard("aws-clf-c02-t2.1-01", { task: "2.1" }, { conflictGroups: ["pair"] }),
      ),
    );
    expect(groupsOf(output)).toEqual({ "aws-clf-c02-t1.1-01": ["pair"], "aws-clf-c02-t2.1-01": ["pair"] });
  });

  it("counts a group listed twice on one card as one use and lists it once", () => {
    const alone = build([clfEntry], clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { conflictGroups: ["echo", "echo"] })));
    expect(groupsOf(alone)).toEqual({ "aws-clf-c02-t1.1-01": [] });
    const shared = build(
      [clfEntry],
      clfWith(
        reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { conflictGroups: ["echo", "echo"] }),
        reviewedCard("aws-clf-c02-t2.1-01", { task: "2.1" }, { conflictGroups: ["echo"] }),
      ),
    );
    expect(groupsOf(shared)).toEqual({ "aws-clf-c02-t1.1-01": ["echo"], "aws-clf-c02-t2.1-01": ["echo"] });
  });

  it("gives cards without a conflictGroups field an empty list", () => {
    const { conflictGroups: _omitted, ...withoutGroups } = reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" });
    expect(groupsOf(build([clfEntry], clfWith(withoutGroups)))).toEqual({ "aws-clf-c02-t1.1-01": [] });
  });

  it("hashes the cards after dropping single-use groups", () => {
    const output = build([clfEntry], clfWith(reviewedCard("aws-clf-c02-t1.1-01", { task: "1.1" }, { conflictGroups: ["lonely"] })));
    const deck = output.decks[0];
    expect(deck?.hash).toBe(hashDeck(deck?.cards ?? []));
  });

  it("leaves a section that no card falls into out of the index", () => {
    const withBilling = { ...clfEntry, sections: [...clfEntry.sections, { id: "BIL", title: "Billing, pricing and support", match: ["4.1"] }] };
    const output = build([withBilling], { "aws-clf-c02": clfReviewed() });
    expect(firstDeck(output).sections.map((section) => section.id)).toEqual(["CON", "SEC"]);
    expect(DeckIndexSchema.safeParse(output.index).success).toBe(true);
  });
});
```

- [ ] **Step 22: Run the tests and watch the new ones fail**

Run:

```bash
pnpm vitest run tests/content/build.test.ts
```

Expected: three failures (the other three new tests already hold):

```
 FAIL  ... > drops a conflict group that only one card uses
AssertionError: expected { …(2) } to deeply equal { …(2) }
 FAIL  ... > counts a group listed twice on one card as one use and lists it once
AssertionError: expected { 'aws-clf-c02-t1.1-01': [ …(2) ] } to deeply equal { 'aws-clf-c02-t1.1-01': [] }
 FAIL  ... > leaves a section that no card falls into out of the index
AssertionError: expected [ 'CON', 'SEC', 'BIL' ] to deeply equal [ 'CON', 'SEC' ]

      Tests  3 failed | 40 passed (43)
```

- [ ] **Step 23: Drop single-use conflict groups and empty sections**

Replace the whole of `src/content/build.ts` with:

```ts
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CardSchema,
  CatalogSchema,
  ReviewedDeckSchema,
  WHOLE_DECK,
  type Card,
  type Catalog,
  type DeckFile,
  type DeckIndex,
  type IndexDeck,
  type ReviewedDeck,
} from "./schema";

export interface BuildInput {
  catalog: unknown;
  reviewed: Record<string, unknown>; // keyed by deck id
  version: string; // ISO date of this build
}

export interface BuildOutput {
  index: DeckIndex;
  decks: DeckFile[];
}

// The message names the deck, the card id and the reason, so a failed build says what to fix.
export class DeckBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeckBuildError";
  }
}

type CatalogDeck = Catalog["areas"][number]["platforms"][number]["decks"][number];
type ReviewedCard = ReviewedDeck["cards"][number];

// First 16 hex characters of the sha256 of the cards as JSON. The client refetches a deck when this changes.
export function hashDeck(cards: Card[]): string {
  return createHash("sha256").update(JSON.stringify(cards)).digest("hex").slice(0, 16);
}

function cardError(deckId: string, cardId: string, reason: string): DeckBuildError {
  return new DeckBuildError(`${deckId}: card ${cardId}: ${reason}`);
}

const LIMITS = { statement: 120, explanation: 240 } as const;

function describeIssue(issue: z.core.$ZodIssue | undefined): string {
  if (!issue) return "is not valid";
  const path = issue.path.map(String).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

function parseCatalog(raw: unknown): Catalog {
  const result = CatalogSchema.safeParse(raw);
  if (!result.success) throw new DeckBuildError(`catalog: ${describeIssue(result.error.issues[0])}`);
  const catalog = result.data;
  const areaIds = new Set<string>();
  const deckIds = new Set<string>();
  for (const area of catalog.areas) {
    if (areaIds.has(area.id)) throw new DeckBuildError(`catalog: area ${area.id} is listed twice`);
    areaIds.add(area.id);
    const platformIds = new Set<string>();
    for (const platform of area.platforms) {
      if (platformIds.has(platform.id)) throw new DeckBuildError(`catalog: area ${area.id}: platform ${platform.id} is listed twice`);
      platformIds.add(platform.id);
      for (const deck of platform.decks) {
        if (deckIds.has(deck.id)) throw new DeckBuildError(`catalog: deck ${deck.id} is listed twice`);
        deckIds.add(deck.id);
        const sectionIds = new Set<string>();
        for (const section of deck.sections) {
          if (section.id === WHOLE_DECK) {
            throw new DeckBuildError(`catalog: deck ${deck.id}: section id ${WHOLE_DECK} is reserved for the whole deck`);
          }
          if (sectionIds.has(section.id)) throw new DeckBuildError(`catalog: deck ${deck.id}: section ${section.id} is listed twice`);
          sectionIds.add(section.id);
        }
      }
    }
  }
  return catalog;
}

// The id of the card at a position in a file that failed validation, or its position when it has none.
function cardLabel(raw: unknown, position: number): string {
  const cards: unknown = typeof raw === "object" && raw !== null ? (raw as { cards?: unknown }).cards : undefined;
  const card: unknown = Array.isArray(cards) ? cards[position] : undefined;
  const id: unknown = typeof card === "object" && card !== null ? (card as { id?: unknown }).id : undefined;
  return typeof id === "string" && id.length > 0 ? id : `#${position + 1}`;
}

function parseReviewed(deckId: string, raw: unknown): ReviewedDeck {
  const result = ReviewedDeckSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const [first, position, ...rest] = issue?.path ?? [];
    if (issue && first === "cards" && typeof position === "number") {
      throw new DeckBuildError(`${deckId}: card ${cardLabel(raw, position)}: ${describeIssue({ ...issue, path: rest })}`);
    }
    throw new DeckBuildError(`${deckId}: ${describeIssue(issue)}`);
  }
  if (result.data.deck !== deckId) throw new DeckBuildError(`${deckId}: the reviewed file is for deck ${result.data.deck}`);
  return result.data;
}

function checkCard(deckId: string, card: ReviewedCard, seen: Set<string>): void {
  if (!card.id.startsWith(`${deckId}-`)) throw cardError(deckId, card.id, `the card id must start with ${deckId}-`);
  if (seen.has(card.id)) throw cardError(deckId, card.id, "the card id is used twice");
  seen.add(card.id);
  for (const field of ["statement", "explanation"] as const) {
    const text = card[field];
    if (text.trim().length === 0) throw cardError(deckId, card.id, `${field} is empty`);
    if (text.length > LIMITS[field]) {
      throw cardError(deckId, card.id, `${field} is ${text.length} characters, the limit is ${LIMITS[field]}`);
    }
  }
  if (![1, 2, 3].includes(card.difficulty)) {
    throw cardError(deckId, card.id, `difficulty must be 1, 2 or 3, not ${card.difficulty}`);
  }
}

function sectionFor(entry: CatalogDeck, card: ReviewedCard): string {
  if (entry.sections.length === 0) return WHOLE_DECK;
  const values = [card.task, card.section].filter((value): value is string => value !== undefined);
  if (values.length === 0) throw cardError(entry.id, card.id, "has neither a task nor a section to place it in a section");
  const matched = entry.sections.filter((section) => values.some((value) => section.match.includes(value)));
  const [only] = matched;
  if (!only) throw cardError(entry.id, card.id, `${values.join(" / ")} matches no section`);
  if (matched.length > 1) {
    throw cardError(entry.id, card.id, `${values.join(" / ")} matches more than one section (${matched.map((section) => section.id).join(", ")})`);
  }
  return only.id;
}

// Each card lists a group once. A group that only one card uses cannot conflict with anything and is dropped.
function sharedGroups(cards: readonly ReviewedCard[]): Set<string> {
  const uses = new Map<string, number>();
  for (const card of cards) {
    for (const group of new Set(card.conflictGroups ?? [])) uses.set(group, (uses.get(group) ?? 0) + 1);
  }
  return new Set([...uses].filter(([, count]) => count > 1).map(([group]) => group));
}

function toCard(entry: CatalogDeck, card: ReviewedCard, shared: ReadonlySet<string>): Card {
  const shipped = {
    id: card.id,
    section: sectionFor(entry, card),
    text: { en: { statement: card.statement, explanation: card.explanation } },
    answer: card.answer,
    source: { title: card.source.title, url: card.source.url },
    difficulty: card.difficulty,
    appliesTo: card.appliesTo ?? "",
    conflictGroups: [...new Set(card.conflictGroups ?? [])].filter((group) => shared.has(group)),
  };
  // A last guard: whatever ships must pass the schema the client validates with.
  const result = CardSchema.safeParse(shipped);
  if (!result.success) throw cardError(entry.id, card.id, describeIssue(result.error.issues[0]));
  return result.data;
}

function buildDeck(entry: CatalogDeck, raw: unknown, version: string): { file: DeckFile; summary: IndexDeck } {
  const reviewed = parseReviewed(entry.id, raw);
  const seen = new Set<string>();
  for (const card of reviewed.cards) checkCard(entry.id, card, seen);
  const shared = sharedGroups(reviewed.cards);
  const cards = reviewed.cards.map((card) => toCard(entry, card, shared));
  const file: DeckFile = { id: entry.id, hash: hashDeck(cards), cards };
  // A section that no card falls into is not available yet and is left out, like a deck without a reviewed file.
  const sections = entry.sections
    .map((section) => ({
      id: section.id,
      title: section.title,
      cardCount: cards.filter((card) => card.section === section.id).length,
    }))
    .filter((section) => section.cardCount > 0);
  const summary: IndexDeck = {
    id: entry.id,
    code: entry.code,
    title: entry.title,
    cardCount: cards.length,
    version,
    hash: file.hash,
    sections,
  };
  return { file, summary };
}

export function buildDecks(input: BuildInput): BuildOutput {
  if (!z.iso.date().safeParse(input.version).success) {
    throw new DeckBuildError(`version must be an ISO date (YYYY-MM-DD), not ${input.version}`);
  }
  const catalog = parseCatalog(input.catalog);
  const decks: DeckFile[] = [];
  const index: DeckIndex = {
    areas: catalog.areas.map((area) => ({
      id: area.id,
      title: area.title,
      platforms: area.platforms.map((platform) => ({
        id: platform.id,
        title: platform.title,
        decks: platform.decks.flatMap((entry) => {
          // A catalog deck without a reviewed file is not available yet and is left out.
          if (!Object.hasOwn(input.reviewed, entry.id)) return [];
          const { file, summary } = buildDeck(entry, input.reviewed[entry.id], input.version);
          decks.push(file);
          return [summary];
        }),
      })),
    })),
  };
  return { index, decks };
}
```

- [ ] **Step 24: Run the tests and watch them pass**

Run:

```bash
pnpm vitest run tests/content/build.test.ts
```

Expected:

```
 Test Files  1 passed (1)
      Tests  43 passed (43)
```

- [ ] **Step 25: Commit**

```bash
git add src/content/build.ts tests/content/build.test.ts
git commit -m "feat: drop single-use conflict groups and empty sections from the build"
```

- [ ] **Step 26: Write the failing tests against the real decks**

Add this line as the very first line of `tests/content/build.test.ts`:

```ts
import { readFileSync } from "node:fs";
```

Then append this to the end of the file, after one blank line:

```ts
describe("the real content", () => {
  function readContent(path: string): unknown {
    return JSON.parse(readFileSync(new URL(`../../content/${path}`, import.meta.url), "utf8"));
  }

  function buildReal(): BuildOutput {
    return buildDecks({
      catalog: readContent("catalog.json"),
      reviewed: {
        "aws-clf-c02": readContent("reviewed/aws-clf-c02.json"),
        "nextjs-rendering": readContent("reviewed/nextjs-rendering.json"),
      },
      version: VERSION,
    });
  }

  function indexDeck(output: BuildOutput, deckId: string) {
    const deck = output.index.areas.flatMap((area) => area.platforms.flatMap((platform) => platform.decks)).find((entry) => entry.id === deckId);
    if (!deck) throw new Error(`${deckId} is not in the index`);
    return deck;
  }

  it("builds Cloud Practitioner with 214 cards in four sections", () => {
    const deck = indexDeck(buildReal(), "aws-clf-c02");
    expect([deck.code, deck.title, deck.cardCount]).toEqual(["CLF", "Cloud Practitioner", 214]);
    expect(deck.sections.map((section) => [section.id, section.cardCount])).toEqual([
      ["CON", 45],
      ["SEC", 47],
      ["TEC", 88],
      ["BIL", 34],
    ]);
  });

  it("builds Next.js Rendering with 94 cards in eight sections", () => {
    const deck = indexDeck(buildReal(), "nextjs-rendering");
    expect([deck.code, deck.title, deck.cardCount]).toEqual(["RND", "Rendering", 94]);
    expect(deck.sections.map((section) => [section.id, section.cardCount])).toEqual([
      ["RSC", 12],
      ["REQ", 11],
      ["STR", 12],
      ["STA", 12],
      ["DAT", 11],
      ["CAC", 12],
      ["CCM", 12],
      ["REV", 12],
    ]);
  });

  it("keeps every area and platform of the catalog, with or without decks", () => {
    const output = buildReal();
    expect(output.index.areas.map((area) => [area.id, area.title, area.platforms.map((platform) => [platform.id, platform.title, platform.decks.map((deck) => deck.id)])])).toEqual([
      ["cloud", "Cloud", [["aws", "AWS", ["aws-clf-c02"]], ["gcp", "Google Cloud", []], ["azure", "Azure", []]]],
      ["frontend", "Frontend", [["nextjs", "Next.js", ["nextjs-rendering"]]]],
      ["devops", "DevOps", []],
    ]);
  });

  it("writes deck files the client schema accepts, with a hash that matches the index", () => {
    const output = buildReal();
    expect(DeckIndexSchema.safeParse(output.index).success).toBe(true);
    for (const deck of output.decks) {
      expect(DeckFileSchema.safeParse(deck).success, deck.id).toBe(true);
      expect(indexDeck(output, deck.id).hash).toBe(hashDeck(deck.cards));
    }
  });

  it("ships only conflict groups that at least two cards share", () => {
    for (const deck of buildReal().decks) {
      const uses = new Map<string, number>();
      for (const card of deck.cards) for (const group of card.conflictGroups) uses.set(group, (uses.get(group) ?? 0) + 1);
      for (const [group, count] of uses) expect(count, `${deck.id} ${group}`).toBeGreaterThan(1);
    }
  });
});
```

- [ ] **Step 27: Run the tests and watch the new ones fail**

Run:

```bash
pnpm vitest run tests/content/build.test.ts
```

Expected: the five new tests fail because the catalog does not exist yet:

```
Error: ENOENT: no such file or directory, open '.../content/catalog.json'

      Tests  5 failed | 43 passed (48)
```

- [ ] **Step 28: Write the catalog**

Create `content/catalog.json`:

```json
{
  "areas": [
    {
      "id": "cloud",
      "title": "Cloud",
      "platforms": [
        {
          "id": "aws",
          "title": "AWS",
          "decks": [
            {
              "id": "aws-clf-c02",
              "code": "CLF",
              "title": "Cloud Practitioner",
              "sections": [
                { "id": "CON", "title": "Cloud concepts", "match": ["1.1", "1.2", "1.3", "1.4"] },
                { "id": "SEC", "title": "Security and compliance", "match": ["2.1", "2.2", "2.3", "2.4"] },
                { "id": "TEC", "title": "Cloud technology and services", "match": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"] },
                { "id": "BIL", "title": "Billing, pricing and support", "match": ["4.1", "4.2", "4.3"] }
              ]
            },
            {
              "id": "aws-saa-c03",
              "code": "SAA",
              "title": "Solutions Architect Associate",
              "sections": [
                { "id": "SEC", "title": "Secure architectures", "match": ["1.1", "1.2", "1.3"] },
                { "id": "RES", "title": "Resilient architectures", "match": ["2.1", "2.2"] },
                { "id": "PRF", "title": "High-performing architectures", "match": ["3.1", "3.2", "3.3", "3.4", "3.5"] },
                { "id": "CST", "title": "Cost-optimized architectures", "match": ["4.1", "4.2", "4.3", "4.4"] }
              ]
            }
          ]
        },
        {
          "id": "gcp",
          "title": "Google Cloud",
          "decks": [
            {
              "id": "gcp-cdl",
              "code": "CDL",
              "title": "Cloud Digital Leader",
              "sections": []
            }
          ]
        },
        {
          "id": "azure",
          "title": "Azure",
          "decks": []
        }
      ]
    },
    {
      "id": "frontend",
      "title": "Frontend",
      "platforms": [
        {
          "id": "nextjs",
          "title": "Next.js",
          "decks": [
            {
              "id": "nextjs-rendering",
              "code": "RND",
              "title": "Rendering",
              "sections": [
                { "id": "RSC", "title": "Server and client components", "match": ["r1"] },
                { "id": "REQ", "title": "How a request renders", "match": ["r2"] },
                { "id": "STR", "title": "Streaming and Suspense", "match": ["r3"] },
                { "id": "STA", "title": "Static and dynamic rendering", "match": ["r4"] },
                { "id": "DAT", "title": "Data fetching", "match": ["r5"] },
                { "id": "CAC", "title": "Caching, the previous model", "match": ["r6"] },
                { "id": "CCM", "title": "Cache Components", "match": ["r7"] },
                { "id": "REV", "title": "Revalidation and Server Functions", "match": ["r8"] }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "devops",
      "title": "DevOps",
      "platforms": []
    }
  ]
}
```

- [ ] **Step 29: Run all content tests and watch them pass**

Run:

```bash
pnpm vitest run tests/content/
```

Expected:

```
 Test Files  2 passed (2)
      Tests  73 passed (73)
```

- [ ] **Step 30: Commit**

```bash
git add content/catalog.json tests/content/build.test.ts
git commit -m "feat: add the content catalog with the CLF and Next.js rendering sections"
```

- [ ] **Step 31: Write the build script**

Create `scripts/build-decks.ts`:

```ts
// Builds public/decks/ from content/catalog.json and content/reviewed/*.json. Runs before `next build`.
// Usage: tsx scripts/build-decks.ts [content dir] [output dir]   (defaults: content, public/decks)
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { DeckBuildError, buildDecks } from "@/src/content/build";

const [contentArg, outArg] = process.argv.slice(2);
const contentDir = resolve(contentArg ?? "content");
const outDir = resolve(outArg ?? "public/decks");

// Paths in messages are relative to where the script runs, so they read the same on every machine.
function shown(path: string): string {
  return relative(process.cwd(), path) || ".";
}

function readJson(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new DeckBuildError(`${shown(path)} cannot be read: ${(error as Error).message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new DeckBuildError(`${shown(path)} is not valid JSON: ${(error as Error).message}`);
  }
}

function readReviewed(dir: string): Record<string, unknown> {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (error) {
    throw new DeckBuildError(`${shown(dir)} cannot be read: ${(error as Error).message}`);
  }
  const reviewed: Record<string, unknown> = {};
  for (const name of names.filter((file) => file.endsWith(".json")).sort()) {
    reviewed[basename(name, ".json")] = readJson(join(dir, name));
  }
  return reviewed;
}

function main(): void {
  const catalog = readJson(join(contentDir, "catalog.json"));
  const reviewed = readReviewed(join(contentDir, "reviewed"));
  const version = new Date().toISOString().slice(0, 10);
  const { index, decks } = buildDecks({ catalog, reviewed, version });

  // Start from an empty folder so a deck that left the catalog does not linger.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.json"), JSON.stringify(index));
  for (const deck of decks) writeFileSync(join(outDir, `${deck.id}.json`), JSON.stringify(deck));

  const built = new Set(decks.map((deck) => deck.id));
  for (const id of Object.keys(reviewed)) {
    if (!built.has(id)) console.warn(`build-decks: reviewed/${id}.json is not in the catalog and was skipped`);
  }
  const summary = decks.map((deck) => `${deck.id} (${deck.cards.length} cards)`).join(", ");
  const noun = decks.length === 1 ? "deck" : "decks";
  console.log(`build-decks: wrote ${decks.length} ${noun} to ${shown(outDir)}: ${summary || "none"}`);
}

try {
  main();
} catch (error) {
  console.error(`build-decks: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
```

- [ ] **Step 32: Wire the script into package.json and the README**

In `package.json`, add this line to `"scripts"` directly below `"build:tokens": "tsx scripts/build-tokens.ts",`:

```json
    "build:decks": "tsx scripts/build-decks.ts",
```

and change the `prebuild` line from `"prebuild": "pnpm build:tokens",` to:

```json
    "prebuild": "pnpm build:tokens && pnpm build:decks",
```

and the `predev` line from `"predev": "pnpm build:tokens",` to:

```json
    "predev": "pnpm build:tokens && pnpm build:decks",
```

`public/decks/` is gitignored like `app/tokens.css`: without the second half of `predev`, `pnpm dev` on a fresh clone would serve no `/decks/index.json` and the start flow (task 10) would show its load error.

In `README.md`, add this row to the scripts table directly below the `pnpm build:tokens` row:

```markdown
| `pnpm build:decks` | Validate `content/catalog.json` and `content/reviewed/*.json` and write `public/decks/` (runs automatically before `pnpm dev` and `pnpm build`) |
```

- [ ] **Step 33: Run the script and inspect the index**

Run:

```bash
pnpm build:decks
```

Expected:

```
> truthy@0.1.0 build:decks <repository root>
> tsx scripts/build-decks.ts

build-decks: wrote 3 decks to public/decks: aws-clf-c02 (214 cards), gcp-cdl (133 cards), nextjs-rendering (94 cards)
```

`gcp-cdl` is listed because `content/reviewed/gcp-cdl.json` exists and the catalog gives CDL no sections, so it is built as a whole deck. If that file is not in the repository the line reads `wrote 2 decks` without it.

Then summarise the index:

```bash
node -e 'const i=require("./public/decks/index.json");for(const a of i.areas){console.log(a.id, a.platforms.map(p=>p.id+":"+p.decks.map(d=>`${d.code} ${d.cardCount} [${d.sections.map(s=>s.id+" "+s.cardCount).join(", ")}]`).join(" | ")).join("; "))}'
```

Expected:

```
cloud aws:CLF 214 [CON 45, SEC 47, TEC 88, BIL 34]; gcp:CDL 133 []; azure:
frontend nextjs:RND 94 [RSC 12, REQ 11, STR 12, STA 12, DAT 11, CAC 12, CCM 12, REV 12]
devops
```

`ls public/decks` lists `aws-clf-c02.json`, `gcp-cdl.json`, `index.json` and `nextjs-rendering.json`. `git status --short` shows no file under `public/` (the folder is ignored).

Then check the chain that `pnpm build` runs first:

```bash
pnpm prebuild
```

Expected: pnpm runs `pnpm build:tokens && pnpm build:decks`, task 2's script prints its `Wrote .../app/tokens.css (<n> variables)` line, then the same `build-decks: wrote 3 decks to public/decks: ...` line as above, and the command exits 0.

Then check that `pnpm dev` regenerates both on a fresh clone, where neither generated file exists:

```bash
rm -rf app/tokens.css public/decks
pnpm dev --port 3200 > dev.log 2>&1 &
until curl -sf -o /dev/null http://localhost:3200/decks/index.json; do sleep 1; done
head -n 14 dev.log
ls app/tokens.css public/decks
kill %1
rm dev.log
```

Expected: the log starts with `> truthy@0.1.0 predev <repository root>` and `> pnpm build:tokens && pnpm build:decks`, then shows task 2's `Wrote <repository root>/app/tokens.css (324 variables)` line and ends with the same `build-decks: wrote 3 decks to public/decks: ...` line as above; `ls` prints `app/tokens.css` and, under `public/decks:`, `aws-clf-c02.json`, `gcp-cdl.json`, `index.json` and `nextjs-rendering.json`.

- [ ] **Step 34: Check that a broken deck fails the script and writes nothing**

Run (a throwaway copy with one statement made 121 characters long; the real content is not touched):

```bash
tmp=$(mktemp -d) && mkdir "$tmp/reviewed" && cp content/catalog.json "$tmp/" && node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync("content/reviewed/aws-clf-c02.json","utf8"));d.cards[5].statement="x".repeat(121);fs.writeFileSync(process.argv[1]+"/reviewed/aws-clf-c02.json",JSON.stringify(d))' "$tmp" && pnpm -s build:decks "$tmp" "$tmp/out"; echo "exit code $?"; ls "$tmp"; rm -rf "$tmp"
```

Expected:

```
build-decks: aws-clf-c02: card aws-clf-c02-t1.1-07: statement is 121 characters, the limit is 120
exit code 1
catalog.json
reviewed
```

There is no `out` folder: nothing is written when the build fails. A reviewed file that is not valid JSON fails the same way with `build-decks: <path> is not valid JSON: <parser message>`.

- [ ] **Step 35: Run the gates**

Run:

```bash
pnpm typecheck && pnpm test
```

Expected: `tsc --noEmit` prints nothing, and Vitest reports every test file passing, the two content files with 73 tests between them.

- [ ] **Step 35a: Pin Cloud Digital Leader in the real content tests**

Spec section 3 ships Cloud Digital Leader in step 1, and every end-to-end spec of task 13 counts on it ("Cloud, 2 decks", the deck without sections). `buildReal()` in step 26 leaves its reviewed file out, so until now no unit test failed if the CDL deck went missing from the build. Append to the end of `tests/content/build.test.ts`, after one blank line:

```ts
// Spec section 3, step 1: Cloud Digital Leader ships with the first step. buildReal() above leaves its
// reviewed file out, so this pins the deck the deploy really builds.
describe("the real content: Cloud Digital Leader", () => {
  function readContent(path: string): unknown {
    return JSON.parse(readFileSync(new URL(`../../content/${path}`, import.meta.url), "utf8"));
  }

  it("builds Cloud Digital Leader as a whole deck of 133 cards next to the other two", () => {
    const output = buildDecks({
      catalog: readContent("catalog.json"),
      reviewed: {
        "aws-clf-c02": readContent("reviewed/aws-clf-c02.json"),
        "gcp-cdl": readContent("reviewed/gcp-cdl.json"),
        "nextjs-rendering": readContent("reviewed/nextjs-rendering.json"),
      },
      version: VERSION,
    });
    const gcp = output.index.areas.find((area) => area.id === "cloud")?.platforms.find((platform) => platform.id === "gcp");
    expect(gcp?.decks.map((deck) => [deck.id, deck.code, deck.title, deck.cardCount, deck.sections])).toEqual([
      ["gcp-cdl", "CDL", "Cloud Digital Leader", 133, []],
    ]);
    const file = output.decks.find((deck) => deck.id === "gcp-cdl");
    expect(file?.cards).toHaveLength(133);
    expect(file?.cards.every((card) => card.section === WHOLE_DECK)).toBe(true);
    expect(output.decks.map((deck) => deck.id).sort()).toEqual(["aws-clf-c02", "gcp-cdl", "nextjs-rendering"]);
  });
});
```

- [ ] **Step 35b: Run the content tests**

```bash
pnpm vitest run tests/content/
```

Expected: `Test Files  2 passed (2)` and `Tests  74 passed (74)`. The test passes at once (the catalog and the build already handle CDL); it is a pin, so a lost `content/reviewed/gcp-cdl.json` or a catalog edit that gives CDL sections fails here instead of in the end-to-end specs. Every later part that quotes a `pnpm test` total counts one test more from here on.

- [ ] **Step 36: Commit**

```bash
git add scripts/build-decks.ts package.json README.md tests/content/build.test.ts
git commit -m "feat: build the decks before next build"
```

#### Review focus candidates

Conditions the spec implies, a person could hit, and that the first draft of the tests did not cover. Each now has a test:

1. A redeploy on a later day makes every returning player download every deck again, because the build date leaked into the hash (spec section 5, "a deck is fetched again only when its hash in the index differs"). Covered by "keeps the hash when only the build date changes, so players do not refetch an unchanged deck", step 11.
2. The same three-letter section code in two decks (the real catalog has `SEC` in both CLF and SAA) is rejected as a duplicate, or the two get mixed up, although a route is deck plus section. Covered by "allows the same section id in two different decks", step 11.
3. A hand edit of `catalog.json` that repeats an area or a platform shows two identical options on the boarding pass with no build error. Covered by "fails on an area or a platform listed twice", step 16, with the check in `parseCatalog`, step 18.
