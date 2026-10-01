# Truthy: mockup contract for design directions

Every direction renders the SAME screen with the SAME content, so the only variable is the design language.

## Product

Truthy (working title) is a mobile true/false card game that teaches IT certification knowledge. A statement card appears, the player swipes right for True or left for False (or taps a button), then sees whether they were right plus a short explanation. Audience: developers and cloud engineers studying for certifications, playing in short sessions on their phone. It is a game first: it should feel like something you want to pick up, and it must not look like a quiz form, a SaaS dashboard or a generic flashcard app.

The web version comes first. It will later be cloned natively in SwiftUI and Jetpack Compose, and the design language chosen now has to survive that unchanged.

## File

- One standalone document: `design/directions/<id>.html` (for example `d07.html`).
- Inline CSS and JS only. The only allowed external resource is a Google Fonts `<link>`. Illustration, texture and icons are inline SVG or CSS.
- Fixed phone viewport: 390 x 844 CSS px. No page scroll, no horizontal overflow. `html, body { height: 100%; margin: 0; overflow: hidden }`.
- Keep the top 50px free of interactive content (status bar zone) and the bottom 30px free (home indicator zone). Backgrounds bleed into both zones.
- Keep the file under 60 KB.

## Screen content (use exactly this copy)

Question state:
- Deck: `AWS Cloud Practitioner`
- Domain: `Security and compliance`
- Mode: `Classic`
- Progress: card 4 of 10. Cards 1 to 3 already answered: correct, correct, wrong.
- Statement: `AWS is responsible for patching the guest operating system on your EC2 instances.`
- Two actions: `False` on the left, `True` on the right.
- A way to leave the round (close control).
- A hint that the card can be swiped.

Answer state (the correct answer is False):
- Verdict: `Correct` if the player chose False, `Not quite` if they chose True. Also show what the right answer was (`The answer is False`).
- Explanation: `You patch the guest OS on EC2. AWS looks after the hypervisor, the physical hosts and the data centres beneath it.`
- Source link label: `Shared responsibility model`
- Primary action: `Next card`

How the header, progress and meta information are arranged is a design decision. Not every item needs equal weight, but all of them must be present.

## Behaviour contract

- The root element carries `data-state="question"` or `data-state="answer"`, and in the answer state `data-result="correct"` or `data-result="wrong"`.
- The False control has `data-answer="false"`, the True control has `data-answer="true"`. Clicking either moves to the answer state with a transition that belongs to the design language (flip, slide, stamp, whatever fits).
- `Next card` returns to the question state so the mockup can be replayed.
- The card is draggable horizontally. Inline this helper and style against the custom properties it sets:

```js
// Sets --dx (px), --rot (deg) and --intent (-1 False .. 1 True) on the card while dragging.
function attachSwipe(card, onAnswer) {
  let startX = 0, dx = 0, dragging = false
  const set = v => {
    dx = v
    card.style.setProperty('--dx', dx + 'px')
    card.style.setProperty('--rot', dx / 18 + 'deg')
    card.style.setProperty('--intent', Math.max(-1, Math.min(1, dx / 110)))
  }
  card.addEventListener('pointerdown', e => {
    dragging = true; startX = e.clientX
    card.setPointerCapture(e.pointerId); card.dataset.dragging = ''
  })
  card.addEventListener('pointermove', e => { if (dragging) set(e.clientX - startX) })
  const end = () => {
    if (!dragging) return
    dragging = false; delete card.dataset.dragging
    const answer = dx > 90 ? 'true' : dx < -90 ? 'false' : null
    set(0)
    if (answer) onAnswer(answer)
  }
  card.addEventListener('pointerup', end)
  card.addEventListener('pointercancel', end)
}
```

  While dragging, the card should show which answer the drag is heading towards (that is part of the design language too).

## Quality floor

- Correct and wrong are never distinguished by colour alone: use a word, an icon or a shape as well. True and False likewise.
- Body text contrast at least 4.5:1, large text at least 3:1.
- Touch targets at least 48 x 48 px.
- `prefers-reduced-motion: reduce` removes non-essential motion.
- Visible keyboard focus.
- Copy in sentence case. No lorem ipsum, no extra invented features (no coins, avatars, shop, ads).

## Screenshot check

After writing a file, run:

```bash
node <scratchpad>/tools/shot.mjs \
  design/directions/<id>.html \
  design/shots/<id>
```

It writes `<id>-question.png` and `<id>-answer.png` and prints `ok` or a list of issues. Read both PNGs and look at them critically: clipped text, overflow, weak hierarchy, anything that looks templated. Fix and re-shoot until both states are right.

## Portability rules (from research, see `research/durability.md`)

The chosen language must be rebuilt in SwiftUI and Jetpack Compose without losing its identity.

- Typefaces: only SIL OFL families available on Google Fonts, used at static weights (at most two families, at most four weights in total). No variable-axis animation.
- Allowed as core identity: flat colour, linear and radial gradients, borders, hard or soft drop shadows, 2D transforms, 3D transforms with perspective (card tilt and flip), spring motion, repeating patterns that a pre-rendered image tile could replace.
- Not allowed as core identity: `backdrop-filter`, `mix-blend-mode`, SVG filters, shaders, mesh gradients, variable-font morphing. If the look collapses without one of these, the direction fails.
- Define the palette as semantic CSS custom properties on `:root` (`--surface`, `--surface-raised`, `--ink`, `--ink-muted`, `--accent`, `--true`, `--false`, `--correct`, `--wrong` or the equivalents your direction needs). Components read only these tokens, never raw hex.
- One radius scale, one shadow recipe, one accent. Spacing on a 4/8 px grid.
- Motion: three durations (about 120, 220, 360 ms) plus one spring for the swipe release. `cubic-bezier(0.34, 1.56, 0.64, 1)` is a usable spring approximation on web.

## Things that make a direction read as generic (avoid unless the direction is explicitly about it)

Purple-to-blue gradients with glass panels, neon-on-black "quiz app" look, Inter as the default face, emoji used as icons, a tracked-out uppercase eyebrow above every heading, identical rounded cards with the same soft grey shadow, corporate flat illustration, a Duolingo skin (green plus owl-style mascot).

## Game feel

This is a game. The card is the hero object and should feel like a thing: it has weight when dragged, it commits with a snap, the verdict lands with one clear beat. Buttons give press feedback. Keep it to one orchestrated moment per state change, not scattered effects.
