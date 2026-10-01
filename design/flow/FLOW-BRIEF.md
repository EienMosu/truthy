# Truthy: full-flow brief (Boarding Pass design language)

The client chose the Boarding Pass direction. The reference is `flow/screens/game-classic.html` (question and answer states of a Classic round) with screenshots in `round2/shots/e02-question.png`, `e02-answer.png`, `e02-wrong.png`. Open the file and READ the screenshots before designing: every new screen must look like it belongs to the same app, made by the same hand. Do not edit `game-classic.html`.

## Product

Truthy is a mobile true/false card game that teaches IT knowledge. A statement card appears, the player swipes right for True or left for False (or taps a button), then sees whether they were right plus a short explanation. It is built first as a mobile web app and later cloned natively in SwiftUI and Jetpack Compose. No accounts, no backend: progress lives on the device.

Content is organised as area > platform > deck > section:

- Cloud
  - AWS
    - Cloud Practitioner (code `CLF`, 214 cards). Sections: Cloud concepts (`CON`), Security and compliance (`SEC`), Cloud technology and services (`TEC`), Billing, pricing and support (`BIL`).
    - Solutions Architect Associate (code `SAA`, 168 cards). Sections: Secure architectures (`SEC`), Resilient architectures (`RES`), High-performing architectures (`PRF`), Cost-optimized architectures (`CST`).
  - Google Cloud
    - Cloud Digital Leader (code `CDL`, 140 cards).
- Frontend
  - Next.js
    - Rendering (code `RND`, 96 cards). Sections include Server and Client Components, Streaming and Suspense, Caching, Revalidation.

More areas and decks will be added later; the design must not assume this list is final.

A round is played on a whole deck or on one section of it, in one of four modes:

- Classic: 10 cards, score at the end.
- Streak: keep going until the first wrong answer.
- Three lives: the round ends on the third wrong answer.
- Timed: 60 seconds, as many cards as you can. No explanation between cards; missed cards are reviewed at the end.

## Design language (fixed, taken from the reference)

- The card is a boarding pass. Decks and sections are three-letter codes with their names underneath, a round is a route from deck to section (`CLF → SEC`), the mode is the travel "class", progress is a flight path with waypoints, the answer tears off the stub, the verdict is a stamp.
- Tokens: copy the `:root` block of the reference verbatim (sky bands `--sky-1..4`, `--surface-raised` ticket paper, `--ink`, `--ink-muted`, `--rule`, amber `--accent`, `--true` blue, `--false` red, `--correct` green, radius 16 / 8, the shadow recipe, durations and the spring). New screens add no new colours; if a screen truly needs a token the reference lacks, add it to `:root` with a comment and report it.
- Type: Overpass 600 / 800 for text, Overpass Mono 400 / 600 for codes, field labels and small data. Field labels are small mono above their value, as on the reference ticket.
- Calm and orderly. Generous space, few colours, fine detail, nothing tilted except a stamp. No heavy textures, no thick outlines, no loud colour blocks, no decorative giant type.
- Extend the metaphor only where it helps the player understand something (departures, routes, class, stamps, a logbook). Do not turn everything into aviation jargon: plain words win when the metaphor would make a control unclear. A player must never wonder what a button does.

## Contract for every screen

- One standalone file per screen in `design/flow/screens/<id>.html`. Inline CSS and JS, the Google Fonts link for Overpass and Overpass Mono as the only external resource, inline SVG for icons.
- Fixed phone viewport 390 x 844. `html, body { height: 100%; margin: 0 }`. The page itself does not scroll; a list inside the screen may scroll vertically if the content needs it. No horizontal overflow.
- Keep the top 50px free of interactive content and the bottom 30px free.
- Real content from the list above. English UI copy in sentence case. No lorem ipsum, no invented features (no coins, avatars, shop, ads, accounts, leaderboards, notifications, settings pages).
- Touch targets at least 48 x 48 px, body text contrast at least 4.5:1, visible keyboard focus, `prefers-reduced-motion` respected, nothing communicated by colour alone.
- Portability: only flat colour, linear and radial gradients, borders, drop shadows, 2D and 3D transforms, spring motion. No `backdrop-filter`, `mix-blend-mode`, SVG filters or shaders.
- Elements that switch the screen into another state worth seeing (open a sheet, select an option, expand a list) carry the attribute `data-demo`. The screenshot tool clicks them in document order.

## Screenshot check

```bash
node <scratchpad>/tools/shot2.mjs \
  design/flow/screens/<id>.html \
  design/flow/shots/<id>
```

It writes `<id>-1.png` (initial state) and one more PNG per `data-demo` element clicked, and prints `ok` or a list of issues. READ every PNG and compare it side by side with the reference screenshots: same paper, same type, same density, same calm. Iterate until it does.
