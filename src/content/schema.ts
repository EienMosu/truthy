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
              // The deck's name on the pass where "<platform> <title>" reads badly; see deckPassName.
              passName: z.string().min(1).optional(),
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
              passName: z.string().optional(),
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

/**
 * The deck's name on the pass and the ticket: its own pass name when the catalog gives one, else the
 * platform and the deck title ("AWS Cloud Practitioner"). "Google Cloud" + "Cloud Digital Leader" would
 * say "Cloud" twice, so that deck is named "Google Cloud Digital Leader" in the catalog.
 */
export function deckPassName(platform: { title: string }, deck: { title: string; passName?: string | undefined }): string {
  return deck.passName ?? `${platform.title} ${deck.title}`;
}

export function routeKey(route: Route): string {
  return `${route.deckId}/${route.sectionId}`;
}
