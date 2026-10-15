// The small deck index the content, catalog and start-flow vectors run on: the index of the web's start-flow
// tests (tests/components/start/fixtures.ts), written out here so the producers need no test file.
//   Cloud: AWS (CLF with two sections), Google Cloud (CDL, no sections, its own pass name), Azure (no decks).
//   Frontend: Next.js (RND with one section). DevOps: no platforms at all.
import type { DeckIndex } from "@/src/content/schema";

export const CATALOG_INDEX: DeckIndex = {
  areas: [
    {
      id: "cloud",
      title: "Cloud",
      platforms: [
        {
          id: "aws",
          title: "AWS",
          decks: [
            {
              id: "aws-clf-c02",
              code: "CLF",
              title: "Cloud Practitioner",
              cardCount: 92,
              version: "2026-10-01",
              hash: "clf-1",
              sections: [
                { id: "CON", title: "Cloud concepts", cardCount: 45 },
                { id: "SEC", title: "Security and compliance", cardCount: 47 },
              ],
            },
          ],
        },
        {
          id: "gcp",
          title: "Google Cloud",
          decks: [
            {
              id: "gcp-cdl",
              code: "CDL",
              title: "Cloud Digital Leader",
              passName: "Google Cloud Digital Leader",
              cardCount: 133,
              version: "2026-10-01",
              hash: "cdl-1",
              sections: [],
            },
          ],
        },
        { id: "azure", title: "Azure", decks: [] },
      ],
    },
    {
      id: "frontend",
      title: "Frontend",
      platforms: [
        {
          id: "nextjs",
          title: "Next.js",
          decks: [
            {
              id: "nextjs-rendering",
              code: "RND",
              title: "Rendering",
              cardCount: 12,
              version: "2026-10-01",
              hash: "rnd-1",
              sections: [{ id: "RSC", title: "Server and client components", cardCount: 12 }],
            },
          ],
        },
      ],
    },
    { id: "devops", title: "DevOps", platforms: [] },
  ],
};

/** The index with `count` decks on Azure: azure-az0 to azure-az<count-1>, codes AZ0 to AZ<count-1>. */
export function indexWithAzure(count: number): DeckIndex {
  const index = structuredClone(CATALOG_INDEX);
  const azure = index.areas[0]?.platforms[2];
  if (!azure) throw new Error("the fixture has no Azure platform");
  azure.decks = Array.from({ length: count }, (_, i) => ({
    id: `azure-az${i}`,
    code: `AZ${i}`,
    title: `Azure ${i}`,
    cardCount: 10,
    version: "2026-10-01",
    hash: `az-${i}`,
    sections: [],
  }));
  return index;
}

/** The index with a second Google Cloud deck whose id begins the first one's: gcp-cdl and gcp-cdl-pro. */
export function indexWithProDeck(): DeckIndex {
  const index = structuredClone(CATALOG_INDEX);
  const gcp = index.areas[0]?.platforms[1];
  if (!gcp) throw new Error("the fixture has no Google Cloud platform");
  gcp.decks.push({ id: "gcp-cdl-pro", code: "CDP", title: "Pro", cardCount: 5, version: "2026-10-01", hash: "cdp-1", sections: [] });
  return index;
}
