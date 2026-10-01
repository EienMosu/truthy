import { createHash } from "node:crypto";
import type { Card } from "./schema";

// First 16 hex characters of the sha256 of the cards as JSON. The client refetches a deck when this changes.
export function hashDeck(cards: Card[]): string {
  return createHash("sha256").update(JSON.stringify(cards)).digest("hex").slice(0, 16);
}
