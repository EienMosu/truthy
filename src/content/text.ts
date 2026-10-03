// How card text marks code. A statement or an explanation writes a code fragment between backticks, as Markdown
// does ("An `asserts x is string` function narrows x"): the fragment is shown in the mono face, without its
// backticks. Overpass draws a backtick as an accent with no width over the next letter, so a backtick is never
// left in the sans face: one without a partner (or of an empty pair) is a code part of its own, shown as itself.

export interface TextPart {
  text: string;
  /** Shown in the mono face. */
  code: boolean;
}

// A pair of backticks around at least one character that is not a backtick.
const FRAGMENT = /`([^`]+)`/g;

function plainParts(text: string): TextPart[] {
  return text
    .split(/(`)/)
    .filter((piece) => piece.length > 0)
    .map((piece) => ({ text: piece, code: piece === "`" }));
}

/** The text in order as plain and code parts. No part is empty. */
export function textParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let from = 0;
  for (const match of text.matchAll(FRAGMENT)) {
    parts.push(...plainParts(text.slice(from, match.index)));
    parts.push({ text: match[1] ?? "", code: true });
    from = match.index + match[0].length;
  }
  parts.push(...plainParts(text.slice(from)));
  return parts;
}

/** The text as it is shown, for what is read rather than seen (an announcement): code without its backticks. */
export function plainText(text: string): string {
  return textParts(text)
    .map((part) => part.text)
    .join("");
}
