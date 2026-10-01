# Summary

- Research limits: WebFetch hit 403s on Mobbin, Medium and color-hex, a TLS error on card-thief.com, and truncated pages on Creative Bloq and GamesRadar. Quizlet, Anki, Peak and Elevate UI specifics could not be sourced beyond app-store and review copy. Items marked [KNOWLEDGE] are from my own background, not fetched this session.
- Duolingo is the only reference with a documented, tokenised design language. Feather Green #58CC02, Mask Green #89E219, Eel #4B4B4B. Accents: Macaw #1CB0F6, Cardinal #FF4B4B, Fox #FF9600, Bee #FFC800, Beetle #CE82FF. Pressed green is #58A700. Feather Bold (lowercase, display) plus DIN Next Rounded (body). 12px button radius with a 3-4px flat bottom "lip" that makes buttons feel like physical gamepad keys. Sources: shadcn.io/design/duolingo, canny-creative.com/atlas/brand/duolingo. This is also the genre's most overused look; a clone reads as a Duolingo skin.
- Balatro has the most distinctive game-feel language. Font: m6x11 (Daniel Linssen, freeware, used with a bouncing text effect). CRT fragment shaders for chromatic aberration and curvature. Colour works as an information system (neutral surfaces, bright active, high-intensity for peak events). Feedback has three layers: instant confirm, magnitude, fast return to decision-ready. Sources: fontsinuse.com/uses/65816, halabaojia.com Balatro analysis, foro3d.com CRT article. One fan-written CSS recipe (blakecrosley.com/guides/design/balatro) gives hex values (#1a1a2e bg, #009dff, #fe5f55, #f0c040). Treat those as an interpretation, not official; the same page names no typeface.
- Reigns is the direct mechanical ancestor of the swipe loop. It was built on the Tinder swipe metaphor, so no tutorial was needed. Art by Mieko Murakami is flat, angular, geometric, minimalist; characters are described as egg-like. Four meters (Army, People, Church, Wealth) sit above the card. Earlier prototypes put characters in portrait frames and were replaced by cards. Sources: birthmoviesdeath.com review, Wikipedia, gamedeveloper.com deep dive. No typeface or hex values were found.
- Tinder swipe mechanics are well documented and reusable: rotation proportional to horizontal drag offset, a LIKE/NOPE stamp that fades in approaching the threshold (green right, red left), a haptic tick at the threshold, spring-back if released short, fling velocity also commits the swipe, and cards behind move in sync. Sources: github.com/halilozel1903/compose-swipe-cards, stormotion.io Tinder-stack article. This maps directly to True/False stamps and works in React, SwiftUI and Compose.
- Brilliant (2023 Koto refresh) has a documented system. Illustration style is "PIX", built from straight-edged line segments. Character: Blorb. Typefaces: CoFo Robert (headers, marketing) and CoFo Sans (product, lightly customised). Brighter palette with a new "pear" green spectrum for CTAs and streaks. Wordmark mixes rounded and squared corners. Motion is built in Rive with many if/then states. The 2018 identity (The Studio) used FF Mark and a 50+ pictogram set, branded "Serious Playfulness". Sources: bpando.org/2018/12/04/branding-brilliant, pcho.medium.com (the Medium page returned 403; its content came through the search snippet), rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations.
- NYT Games: Connections uses NYT Franklin 700 for words and NYT Karnak Condensed 700 for the title. Wordle tile feedback hexes are #6aaa64 (correct), #c9b458 (present), #787c7e (absent), #d3d6da (empty border), with a tile flip reveal. Connections difficulty colours are yellow (easiest), green, blue, purple; I could not source their hexes. The recognisable traits are editorial serif plus grotesque, restrained palette, and colour as the answer. Sources: fontbolt.com/font/nyt-connections-font, brandcolorcode.com/wordle.
- Kahoot's identity is purple #46178f (primary), Montserrat (customised in the logo), and four answer shapes (circle, triangle, diamond, square) in red/blue/yellow/green. The brand guide says to use no more than three colours per layout. Other palette values: #45a3e5, #66bf39, #eb670f, #ff3355, #864cbf. Sources: 1000logos.net/kahoot-logo, kahoot.com brand guide (PDF unreadable to the fetcher), search snippets. Recognisable trait: shape-coded answers give accessibility that does not depend on colour.
- Hearthstone is the skeuomorphic counter-example: wooden panelling, "jewelry box" trays, cards that tilt and flutter, the whole UI built around a tavern-table "seed" idea. Inscryption shows the dark candle-lit, low-res, symbol-over-text card approach; cards show only the name as text, and the style shifts through the game. Pokemon TCG Pocket shows holographic foil, parallax layers inside the card border and hold-to-zoom immersive cards. Sources: gamedeveloper.com Hearthstone UI video, hearthstone.fandom.com, thumbsticks.com Inscryption, poke-holo.simey.me and github.com/simeydotme/pokemon-cards-css (working CSS holo effect).
- Genre competitors (Swipe Quiz, TriviaIQ, True or False apps) are generic: image plus statement, swipe right for true, animal or mascot reactions, treasure-chest collectibles, dark mode, haptics. Sources: swipequiz.app, Play Store and App Store listings. No standout visually distinct true/false app was found, so visual differentiation is open ground. Note direction inconsistency: one app maps left to True and right to False, which is the reverse of most.
- Overused or generic now: (1) Duolingo-clone (chunky 3D buttons, rounded sans, green/blue, mascot). (2) Purple-blue gradient with glassmorphism; iOS 26 Liquid Glass is being criticised for legibility and motion-for-motion's-sake (nngroup.com/articles/liquid-glass, macrumors.com). (3) Generic flat corporate-Memphis illustration. (4) Dark-mode neon "quiz app" templates. (5) Neobrutalism is past peak hype but its techniques are mainstream; still readable as a human-made signal (onething.design, marcfriedmanportfolio.com). Underused for this genre: editorial/NYT, pixel-CRT, tarot/occult, terminal, blueprint schematic, tactile card-stock.
- Design-system implication: pick a structure that survives three platforms. Tokens that port cleanly are colour roles, a 2-font pair, radius scale, border/shadow recipe, and a swipe-physics spec (rotation per px, threshold, spring). Avoid effects that only exist in CSS (backdrop-filter blur, mix-blend-mode holo, CRT shader) as the core identity; they need per-platform rewrites (Metal shaders in SwiftUI, AGSL in Compose).

# Visual reference survey: Cloud Cards (true/false swipe card game)

Sourcing caveat: 20+ searches and ~20 fetches. Blocked or unreadable: Mobbin (403), Medium pcho.medium.com (403), color-hex.com (403), card-thief.com (TLS error), Kahoot brand-guide PDF (binary, saved at <session tool-results>/webfetch-1790811935804-pca8o7.pdf, not parsed), Creative Bloq and GamesRadar (truncated). Quizlet, Anki, Peak, Elevate, Card Thief and Reigns have no sourced hex or typeface data. Items tagged [KNOWLEDGE] come from my own background and were not fetched, so verify before locking.

## Per-reference findings

### Duolingo
- Palette (documented): Feather Green #58CC02 (primary), Mask Green #89E219 (mascot backgrounds), Eel #4B4B4B (text), Snow white canvas. Pressed green #58A700, tint #D7FFB8 / #A5ED6E. Accents: Macaw #1CB0F6, Cardinal #FF4B4B, Fox #FF9600, Bee #FFC800, Beetle #CE82FF. Ink #3C3C3C body.
- Type: Feather Bold (custom, 2019, lowercase only, headlines/impact; "g" flick echoes the owl's eyebrows). DIN Next Rounded for body, sentence case, never mixed with Feather in one sentence. Web substitutes: Nunito Bold, Quicksand.
- Construction: 12px button radius; 3-4px flat bottom "lip" under primary buttons (tactile gamepad feel); uppercase 15px/700 labels with 0.8px tracking.
- Feedback: green/red result banners, mascot reactions [KNOWLEDGE for banner specifics]. Motion: Rive state-machine characters, 20+ mouth shapes, reacts to product state (listening, success, failure, progress). File under 1MB.
- Recognisable: the owl plus the chunky 3D green button.
- URLs: https://www.shadcn.io/design/duolingo, https://www.canny-creative.com/atlas/brand/duolingo/, https://www.canny-creative.com/brand-breakdown/brand/duolingo-a-brand-breakdown/, https://dev.to/uianimation/how-duolingo-uses-rive-for-their-character-animation-and-how-you-can-build-a-similar-rive-mascot-5d19

### Brilliant
- 2018 identity (The Studio): FF Mark ("Markbook"), 50+ pictogram icons, logotype doubles as bar-chart motif, "Serious Playfulness", colour blocking and repetition, lively animation. https://bpando.org/2018/12/04/branding-brilliant/
- 2023 refresh (Koto, from fall 2023): PIX illustration style from straight-edged line segments, character Blorb, globe-like app icon, light all-caps sans wordmark then a new wordmark mixing rounds and square corners, CoFo Robert (headers) plus CoFo Sans (product, lightly customised), lighter brighter palette with a "pear" green spectrum for CTAs and streaks. https://pcho.medium.com/a-brilliant-brand-refresh-4af021c11486 (via search snippet)
- Motion: Rive, many if/then moments, colour-coded learning paths, animated streak counts. https://rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations
- Recognisable: angular geometric illustrations plus pear green. No hex values found.

### Reigns
- Swipe metaphor from Tinder; no tutorial needed. Artist Mieko Murakami; style is flat, angular, geometric, minimalist, bright cards, egg-like characters. Four meters across the top (Army, People, Church, Wealth). Early prototype used portrait frames, replaced by cards. Short punchy copy ("short direct question, quick snappy answer, dire consequences"). Chiptune score by Disasterpeace. Sequel Her Majesty: art by Arnaud de Bock.
- No typeface or hex data found.
- Recognisable: one giant card, portrait, binary choice text above it, meters as consequences.
- URLs: https://en.wikipedia.org/wiki/Reigns_(video_game), https://birthmoviesdeath.com/2016/09/02/reigns-review-swipe-right-to-fight-the-devil.html, https://www.gamedeveloper.com/design/game-design-deep-dive-creating-an-adaptive-narrative-in-i-reigns-i-, https://www.gamedeveloper.com/design/there-is-no-right-way-to-be-queen-in-i-reigns-her-majesty-i-

### Balatro
- Font: m6x11 / m6x11plus by Daniel Linssen, freeware pixel font, bouncing text effect. https://fontsinuse.com/uses/65816/balatro-computer-game, https://x.com/LocalThunk/status/1739882509826248882
- Rendering: LÖVE engine with GLSL shaders for CRT curvature, scanlines, chromatic aberration; pixel art aligned to scanline resolution. https://foro3d.com/en/2026/mayo/el-arte-del-crt-digital-balatro-y-la-magia-de-love.html
- Colour as information system: neutral surfaces, bright active, high-intensity exceptional. Feedback in three layers: confirm, magnitude, return to ready. https://halabaojia.com/collection/20260212-balatro-visual-design-analysis/
- Fan CSS recreation (not official): #009dff chips, #fe5f55 mult, #f0c040 money, bg #1a1a2e, hover translateY(-12px) scale(1.05), selected -24px/1.08, digit roll 0.4s cubic-bezier(0.34,1.56,0.64,1), shake 0.2/0.3/0.5s, foil shimmer 3s loop. https://blakecrosley.com/guides/design/balatro
- Recognisable: warped CRT, swaying cards, bouncing pixel type, score numbers as objects.

### NYT Games (Wordle, Connections)
- Connections words in NYT Franklin 700, title in NYT Karnak Condensed 700. https://www.fontbolt.com/font/nyt-connections-font/
- Wordle: #6aaa64 correct, #c9b458 present, #787c7e absent, #d3d6da empty border; tile flip reveal. https://www.brandcolorcode.com/wordle
- Connections colours ordered yellow, green, blue, purple by difficulty. Hexes not sourced; commonly cited values are in my memory only [KNOWLEDGE].
- Recognisable: paper-white, serif title with grotesque body, colour only as answer state, hairline-bordered tiles. Wordle colour-blind variant (orange/blue) [KNOWLEDGE].

### Kahoot
- Purple #46178f primary; Montserrat (customised in logo); four answer shapes (circle, triangle, diamond, square) are brand symbols; rule of max three colours per layout; logo in colour on white or white on colour. Other palette values: #45a3e5, #66bf39, #eb670f, #ff3355, #864cbf, Denim #1368CE, Bilbao #26890C. Answer colours red/blue/yellow/green, teal/purple for upgrader.
- URLs: https://kahoot.com/files/2017/08/Kahoot-BrandGuide-July2019.pdf, https://1000logos.net/kahoot-logo/, https://mobbin.com/colors/brand/kahoot (403 to fetch; snippet only)
- Recognisable: shape plus colour pairs, full-bleed purple, countdown pressure.

### Quizlet
- Rebrand: Q logo reshaped; colour moved from #044d9c to a violet-blue #4056b3 (ultramarine). Typeface and flip animation not sourced. https://1000logos.net/quizlet-logo/
- Generic trait [KNOWLEDGE]: white card with centre text, horizontal flip on tap. Example of the "flat white card" default to avoid.

### Anki-style modern flashcard apps
- Mochi: clean, minimal, markdown, keyboard-driven. Noji: aesthetic, smooth. Brainscape: confidence-rated 1-5 cards. RemNote: notes plus cards. Anki's own UI called dated. No hex or typeface found. https://www.remnote.com/blog/best-anki-alternatives, https://scholarly.so/blog/best-anki-alternatives, https://mochi.cards/
- Family: utilitarian productivity (document UI, neutral greys).

### Elevate / Peak
- Elevate: Apple Editors' Choice, 4.8 stars, "sleek", "abstract visuals", adult tone, less illustration, more text. Peak: more visual games, scientific framing. Specific palette/type not found. https://apps.apple.com/us/app/elevate-brain-training-games/id875063456, https://www.medicalnewstoday.com/articles/316684
- Family: sober "adult" premium, gradients and abstract shapes [KNOWLEDGE].

### Card Thief / Card Crawl (Tinytouchtales)
- Solitaire stealth, 2-3 minute sessions, art by Max Fiedler, Editors' Choice, offline play. Hand-illustrated dark cards. Palette not sourced. https://apps.apple.com/us/app/card-thief/id1186226470, https://toucharcade.com/games/card-thief
- Family: dark engraving/woodcut card art with limited palette [KNOWLEDGE for palette].

### Tinder-style card stack (mechanics)
- Drag rotation proportional to x offset, LIKE/NOPE stamp fading in toward threshold (green right, red left), haptic tick at threshold, release past threshold or fling commits, else spring back, cards beneath scale/move in sync. https://github.com/halilozel1903/compose-swipe-cards, https://stormotion.io/blog/how-to-create-a-tinder-like-card-stack-using-react-native/, https://medium.com/@japeshsinghal/swipe-right-on-fun-creating-tinder-style-card-animations-a845e29601e5

### True/false and swipe quiz apps
- Swipe Quiz (Jollify): image plus statement, right=True, left=False, animal coin collectibles, chests, animated animal reactions (celebrate / sympathise). https://swipequiz.app/, https://apps.apple.com/us/app/-/id6756823159
- True or False Trivia (2017), TriviaIQ (right=yes), another app with left=True, right=False: direction mapping inconsistent across the genre. https://apps.apple.com/us/app/true-or-false-trivia-quiz/id1231182182
- Design: generic dark mode, haptics, mascots. No visually standout entrant found.

### Other relevant card-game references
- Hearthstone: skeuomorphic wood "jewelry box" UI, tavern-table seed concept, cards tilt/swoosh/flutter, board thumps on tap. https://www.gamedeveloper.com/design/video-designing-an-immersive-user-interface-for-i-hearthstone-i-, https://hearthstone.fandom.com/wiki/Design_and_development_of_Hearthstone
- Inscryption: candle-lit dark, low-res, cards show only name as text, symbols with clear metaphors for abilities, style shifts across acts. https://www.thumbsticks.com/magic-myst-pokemon-inspire-inscryption/, https://www.gamedeveloper.com/design/how-game-jam-sacrifices-became-inscryption
- Pokemon TCG Pocket: holofoil borders, parallax layers clipped to card border, hold-to-zoom immersive cards; CSS reproduction exists. https://poke-holo.simey.me/, https://github.com/simeydotme/pokemon-cards-css
- Monument Valley: soft pastel gradients, low-poly geometry, per-level colour script. https://www.creativebloq.com/computer-arts/making-monument-valley-71412213
- Neobrutalism: thick black borders, hard offset shadows (reduce 8px to 4px on small phones), electric accents; past peak hype, absorbed into mainstream; 2026 "human-made" signal. https://www.onething.design/post/what-is-neo-brutalism-ui-design, https://www.marcfriedmanportfolio.com/blog/neo-brutalism-design-guide/
- iOS 26 Liquid Glass: translucency and light refraction; widely criticised for low contrast and motion for motion's sake. https://www.nngroup.com/articles/liquid-glass/, https://www.macrumors.com/2025/09/17/ios-26-liquid-glass-critiques/

## Aesthetic families (distinct for this genre)
1. Friendly chunky mascot-gamified (Duolingo): rounded sans, 3D lip buttons, saturated green/blue. Overused.
2. Geometric flat illustrated edu (Brilliant PIX, Reigns): angular shapes, limited palette, quirky character.
3. Editorial newsprint (NYT Games): white/cream, serif plus grotesque, hairline borders, colour = state.
4. Pixel / CRT retro (Balatro): pixel font, scanlines, curvature, juiced numbers.
5. Neobrutalist (thick outlines, hard shadows, flat primaries): readable, cheap to port to all three platforms, moderately common.
6. Shape-coded broadcast-quiz (Kahoot): full-bleed saturated colour, symbol-per-answer, countdown pressure.
7. Dark engraved / occult tarot (Card Thief, Inscryption): dark ground, gold or bone line art, candle lighting, limited palette.
8. Skeuomorphic tabletop (Hearthstone): wood, felt, brass, physical card feel, warm lighting.
9. Holographic / collectible foil (Pokemon TCG Pocket): rarity tiers, parallax foil, shine tied to tilt. Suits streak/mastery rewards.
10. Soft gradient minimal (Monument Valley, Elevate-like): pastel gradients, abstract shapes, calm adult tone.
11. Productivity-minimal (Mochi, Anki-alternatives): neutral, keyboard-first, typographic. Safe but bland.
12. Glass / Liquid Glass (iOS 26): translucent layers; fashionable, but legibility-risky and platform-specific.
13. Technical terminal / blueprint (suggested by the cert/IT domain, e.g. AWS console or architecture diagrams) [KNOWLEDGE, no reference in this set]: monospaced, schematic lines, status colours.
14. Toy / sticker-collectible (Swipe Quiz-style mascot rewards pushed into sticker-book aesthetics).

## Overused or generic
- Duolingo-lookalike (rounded green/blue, 3D buttons, owl-alike mascot).
- Purple/blue gradient plus glassmorphism.
- Generic corporate-Memphis flat illustration.
- Dark neon "quiz app" template with animal mascots (the existing swipe-quiz competitors).
- White centred flashcard (Quizlet default).
- Neobrutalism is saturated in web/SaaS but rare in mobile games.

## Underused / open ground
Editorial (NYT-like), pixel-CRT, tarot/engraved dark, terminal/blueprint, tactile card-stock, holo-rarity progression. No competing true/false app occupies any of them.

## Cross-platform notes (React then SwiftUI then Compose)
- Portable tokens: colour roles, font pair, radius scale, border and shadow recipe, swipe physics (rotation factor, threshold, spring, haptic tick).
- Non-portable as identity: CSS backdrop-filter blur, blend-mode holo, CRT shader (need Metal / AGSL rewrites), Rive-dependent mascot states (Rive does run on all three).
- Choose fonts that are open-licence and bundle on all platforms (e.g. Google Fonts or Fontshare) rather than proprietary NYT/Duolingo faces [KNOWLEDGE].
- Use shape plus colour for correct/wrong (Kahoot lesson; Wordle has a colour-blind mode).
- Fix swipe direction (right = True) and keep it identical to Tinder/Reigns convention; one competitor reverses it.