import { en } from "zod/locales";
import * as z from "zod/mini";

// zod/mini leaves the messages out to stay small. The English ones keep the reasons a failed load or a failed
// deck build gives (src/content/load.ts, src/content/build.ts) as they read with the full zod.
z.config(en());

export const WHOLE_DECK = "ALL"; // section id meaning "the whole deck"

// The source link is rendered as a link that opens in a new tab, so only https links to a real domain are allowed.
export const SourceSchema = z.object({
  title: z.string().check(z.minLength(1)),
  url: z.url({ protocol: /^https$/, hostname: z.regexes.domain }),
});

export const CardSchema = z.object({
  id: z.string().check(z.minLength(1)),
  section: z.string().check(z.minLength(1)), // a section id of the deck's catalog entry, or WHOLE_DECK for decks without sections
  text: z.object({
    en: z.object({
      statement: z.string().check(z.minLength(1), z.maxLength(120)),
      explanation: z.string().check(z.minLength(1), z.maxLength(240)),
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
  id: z.string().check(z.minLength(1)),
  hash: z.string().check(z.minLength(1)),
  cards: z.array(CardSchema).check(z.minLength(1)),
});
export type DeckFile = z.infer<typeof DeckFileSchema>;

// content/catalog.json, hand-written
export const CatalogSchema = z.object({
  areas: z.array(
    z.object({
      id: z.string().check(z.minLength(1)),
      title: z.string().check(z.minLength(1)),
      platforms: z.array(
        z.object({
          id: z.string().check(z.minLength(1)),
          title: z.string().check(z.minLength(1)),
          decks: z.array(
            z.object({
              id: z.string().check(z.minLength(1)),
              code: z.string().check(z.length(3)),
              title: z.string().check(z.minLength(1)),
              // The deck's name on the pass where "<platform> <title>" reads badly; see deckPassName.
              passName: z.optional(z.string().check(z.minLength(1))),
              sections: z.array(
                z.object({
                  id: z.string().check(z.length(3)),
                  title: z.string().check(z.minLength(1)),
                  match: z.array(z.string().check(z.minLength(1))).check(z.minLength(1)),
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
export const ReviewedCardSchema = z.looseObject({
  id: z.string().check(z.minLength(1)),
  statement: z.string(),
  answer: z.boolean(),
  explanation: z.string(),
  source: SourceSchema,
  difficulty: z.number(),
  task: z.optional(z.string()),
  section: z.optional(z.string()),
  appliesTo: z.optional(z.string()),
  conflictGroups: z.optional(z.array(z.string())),
});
export const ReviewedDeckSchema = z.looseObject({
  deck: z.string().check(z.minLength(1)),
  cards: z.array(ReviewedCardSchema).check(z.minLength(1)),
});
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
              passName: z.optional(z.string()),
              cardCount: z.number().check(z.int(), z.positive()),
              version: z.string(),
              hash: z.string(),
              sections: z.array(
                z.object({ id: z.string(), title: z.string(), cardCount: z.number().check(z.int(), z.positive()) }),
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

/** Everything the index says about one route. `section` is null for the whole deck. */
export interface RouteInIndex {
  area: IndexArea;
  platform: IndexPlatform;
  deck: IndexDeck;
  section: IndexDeck["sections"][number] | null;
}

/** Finds a route in the index, or null when its deck or section is gone. */
export function findRoute(index: DeckIndex, route: Route): RouteInIndex | null {
  for (const area of index.areas) {
    for (const platform of area.platforms) {
      const deck = platform.decks.find((candidate) => candidate.id === route.deckId);
      if (!deck) continue;
      if (route.sectionId === WHOLE_DECK) return { area, platform, deck, section: null };
      const section = deck.sections.find((candidate) => candidate.id === route.sectionId);
      return section ? { area, platform, deck, section } : null;
    }
  }
  return null;
}
