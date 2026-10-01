# Truthy: round 2 brief

Round 1 produced 20 unrelated directions. The client picked two and rejected the rest as either tiring to look at or overdone:

- `round2/directions/e01.html` Arcana (the card is a tarot card: ornate geometric frame, roman numeral, symbolic emblem, midnight indigo and gold, centred serif).
- `round2/directions/e02.html` Boarding Pass (the card is a boarding pass: airy sky, clean ticket fields, perforated stub, calm airline typography).

Open both files and their screenshots in `round2/shots/` (`e01-question.png`, `e01-answer.png`, `e01-wrong.png`, same for `e02`) before designing anything. They are the quality bar and the taste reference. Do not edit them.

Round 2 produces 18 new directions that stay inside the taste of these two. Each new direction is a sibling or cousin of one of them, never a copy and never a different planet.

## What the client liked (keep)

- The card is a refined real-world artefact: a designed object you could hold, with its own conventions (frame, numeral, emblem; fields, codes, stub).
- Calm. A limited palette of three or four colours, generous space, clear hierarchy, orderly symmetric or grid composition.
- The statement is comfortably readable and sits at the centre of attention.
- Detail is fine and precise (thin lines, small ornaments, small caps of metadata), never loud.
- Verdict and motion are graceful: one clear beat, no bouncing, no shaking.

## What the client rejected (avoid)

- Anything that tires the eye: heavy textures, halftones, mis-registration, pixel fonts, dense patterns behind text, long text in display or monospace faces, low-contrast text.
- Anything overdone: tilted elements, thick black outlines with hard offset shadows, loud saturated colour blocks, giant type as decoration, chunky candy buttons, busy 3D scenes, many competing accents.

## Contract

Everything in `design/BRIEF.md` still applies unchanged (fixed screen content and copy, file rules, behaviour contract with `data-state` / `data-result` / `data-answer` and the swipe helper, portability rules, quality floor), with these differences:

- Files go to `design/round2/directions/<id>.html`.
- The game is called `Truthy` wherever a product name appears.
- The explanation text is set in a comfortable reading face at 15px or larger. The statement is at least 22px.
- Add `user-select: none` on the draggable card.

Screenshot check (now also captures the wrong-answer state):

```bash
node <scratchpad>/tools/shot.mjs \
  design/round2/directions/<id>.html \
  design/round2/shots/<id>
```

It writes `<id>-question.png`, `<id>-answer.png` (correct) and `<id>-wrong.png`, and prints `ok` or a list of issues. Read all three and iterate.
