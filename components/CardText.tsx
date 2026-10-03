// A card's statement or explanation, with its code fragments (between backticks in the deck, see
// src/content/text.ts) set in the mono face, a little smaller so that its wide letters sit with the sans text
// around them. It renders inline, inside the paragraph of its role.
import { textParts } from "@/src/content/text";

const CODE = "font-(family-name:--font-mono) text-[0.92em] tracking-normal";

export function CardText({ text }: { text: string }) {
  return (
    <>
      {textParts(text).map((part, i) =>
        part.code ? (
          <code key={i} className={CODE}>
            {part.text}
          </code>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
