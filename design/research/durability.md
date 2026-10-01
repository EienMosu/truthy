# Summary

- DTCG Design Tokens Format Module 2025.10 is the first stable version (28 Oct 2025). Author tokens in it and generate CSS vars, Swift and Compose from one source with Style Dictionary v4. Do not hand-maintain three token sets.
- Tokens in three tiers: primitive (raw palette, scale), semantic (surface, ink, correct, wrong, accent), component (card, button). Only the semantic tier is themed, so light/dark is a remap of semantic to primitive.
- Safest type strategy: choose OFL families with STATIC weight files (3 to 4 weights per family) for the bundled app font. iOS has no clean SwiftUI variable-font axis API (CoreText or UIFont only). Compose variable fonts need Android 8 (API 26) or newer and Compose UI 1.3 or newer. Variable weight axes are fine on web. Do not design any variable-axis animation (wght or wdth morphing).
- Font shortlist (all OFL): display = Fraunces, Bricolage Grotesque, Space Grotesk, Syne, Unbounded, Familjen Grotesk, DM Serif Display, Instrument Serif, Bagel Fat One, Rubik, Lilita One, Baloo 2, Gloock; text = Inter, Manrope, Plus Jakarta Sans, DM Sans, Outfit, Figtree, Sora, Onest, Geologica, Albert Sans, Work Sans, Public Sans, Newsreader, Source Serif 4, Literata; mono = JetBrains Mono, IBM Plex Mono, Space Mono, DM Mono, Martian Mono, Geist Mono, Commit Mono.
- Licence caveats: Geist and Geist Mono (OFL, verify the current repo), Clash Display/Satoshi/General Sans (Fontshare ITF licence, not OFL, check app-embedding terms), SF Pro (Apple licence, not bundle-able on web or Android), Google Sans (not OFL). Exclude these from shortlisted directions.
- Port-risk ratings: backdrop blur = medium (SwiftUI Material is easy but not pixel-identical; Compose RenderEffect needs API 31+, no real backdrop blur before that); mesh gradient = medium-high (SwiftUI MeshGradient needs iOS 18; Compose has no built-in, needs AGSL on API 33+ or a pre-rendered image); blend modes = medium; noise/grain = low if pre-rendered PNG tile, high if SVG filter; inner shadow = medium (manual in both); 3D card flip = low-medium (rotation3DEffect and graphicsLayer rotationY both work); spring physics = low (spring has real equivalents on all three, tune by stiffness/damping, not cubic-bezier); SVG filters = high (no equivalent, avoid); variable font animation = high; shaders = high (Metal vs AGSL vs GLSL, three rewrites).
- Rule: any effect rated medium-high or high is allowed only as a pre-rendered raster asset, never as live code.
- Accessibility: never rely on red/green alone. Pair each result with shape, icon and word (check mark vs X, TRUE/FALSE labels, distinct card-edge treatment). Text contrast 4.5:1 (3:1 large), non-text/UI 3:1 (WCAG 1.4.11). Use a colour-blind-safe pair (blue/orange) as the default semantic colours.
- Touch targets: Apple 44x44 pt, Material 48x48 dp, WCAG 2.2 AA 24x24 CSS px. Design the True/False buttons at 48 or larger and the buttons as a full equal alternative to swipe (WCAG 2.5.1 pointer gestures). Respect reduced motion (prefers-reduced-motion, UIAccessibility.isReduceMotionEnabled, ANIMATOR_DURATION_SCALE) by replacing the card fly-off and flip with a cross-fade. Support Dynamic Type and Android font scale to at least 200 percent; do not hard-code line heights in px.
- Light and dark: design both from day one. Both iOS and Android follow system appearance, and retrofitting dark later breaks any palette built with hard-coded hex. Build each semantic colour as a light/dark pair, test the correct/wrong colours on both, and avoid pure black/pure white (use near-black and off-white).
- Motion tokens: store durations in ms and easings as named curves plus a spring pair (stiffness, damping) per platform; 3 to 4 durations (fast 120, base 220, slow 360) and one spring for the swipe release.

# Cross-platform durability findings

Scope note: I ran four web searches (tokens format, touch-target standards, mesh gradient / RenderEffect API levels, variable fonts on Android and iOS). The font list, most licence notes, port-risk ratings and accessibility items beyond the touch targets come from my own knowledge, not from searches. I did not check each font's current licence file, so treat the licence column as "verify before commit". Nothing was installed or written.

## 1. Typefaces

### Platform facts (sourced)
- Android: variable fonts need Compose UI 1.3.0 or newer and API 26 (Android 8) or newer. Below that you need a static fallback. Sources: https://developer.android.com/develop/ui/compose/text/fonts , https://medium.com/androiddevelopers/just-your-type-variable-fonts-in-compose-5bf63b357994 , https://developer.android.com/reference/android/graphics/fonts/FontVariationAxis
- iOS: variable font support exists in CoreText/UIFont but there is little or no guidance for SwiftUI, and no clean way to set arbitrary axes from SwiftUI. Fonts must be listed in Info.plist `UIAppFonts` by filename. Sources: https://mike-engel.com/writing/variable-fonts-on-macos-with-swiftui/ , https://movingparts.io/fonts-in-swiftui , https://developer.apple.com/forums/thread/669246
- Practical rule: ship static instances (Regular, Medium, SemiBold, Bold, plus one display weight) on iOS and Android, variable on web only if desired. The design must work with discrete weights, so never depend on a continuous wght/wdth/opsz axis.

### Candidates (OFL unless flagged)
Display / character:
1. Fraunces: soft-serif with wonky optical axis, warm and playful. Variable (opsz, wght, SOFT, WONK); use statics only.
2. Bricolage Grotesque: quirky grotesque, tight and editorial, strong at large sizes.
3. Space Grotesk: geometric with techy oddities; overused but safe.
4. Syne: wide, art-gallery feel at ExtraBold; light weights are plain.
5. Unbounded: rounded, wide, game-like; strong for score numerals.
6. Familjen Grotesk: compact, slightly eccentric grotesque.
7. DM Serif Display: high-contrast display serif, classic.
8. Instrument Serif: condensed editorial serif, single style plus italic, elegant.
9. Bagel Fat One: fat, friendly, toy-like; very casual.
10. Lilita One: chunky casual game feel; single weight.
11. Baloo 2: rounded, friendly, multi-script.
12. Rubik: slightly rounded corners, sturdy and approachable.
13. Gloock: high-contrast serif with attitude, display only.
14. Archivo (incl. Expanded/Narrow widths): workhorse grotesque with width range; good for poster-like cards.
15. Anton / Bebas Neue: condensed poster caps; very loud, single weight, caps only.

Text:
16. Inter: neutral UI standard, excellent numerals and hinting; safest body.
17. Manrope: modern geometric-humanist, slightly technical.
18. Plus Jakarta Sans: friendly geometric with distinctive shapes.
19. DM Sans: low-contrast geometric, clean.
20. Outfit: geometric, round, youthful.
21. Figtree: friendly neutral, good at small sizes.
22. Sora: wide geometric, techy.
23. Onest: neutral with slightly humanist touch.
24. Geologica: wide weight range, slightly industrial.
25. Albert Sans: geometric, Swiss feel.
26. Work Sans: sturdy grotesque, good on screens.
27. Public Sans: US-gov neutral, very legible.
28. Newsreader: text serif with optical sizes, editorial.
29. Source Serif 4: robust text serif.
30. Literata: Google Play Books serif, designed for long reading on screens.

Mono (code/terms like S3, EC2, ARNs):
31. JetBrains Mono: tall x-height, clear at small sizes.
32. IBM Plex Mono: slightly quirky, engineering character.
33. Space Mono: retro-geometric, strong personality, weak for long text.
34. DM Mono: soft, light, three weights.
35. Martian Mono: wide, variable width, distinctive.
36. Geist Mono: clean modern mono (check current licence file, believed OFL).
37. Commit Mono: neutral, tunable.

### Licence caveats
- Fontshare fonts (Clash Display, Satoshi, General Sans, Cabinet Grotesk): ITF Free Font licence, not OFL. Permits commercial use but check the clause on embedding in apps and redistribution.
- SF Pro / New York: Apple licence, only for Apple-platform UI; cannot ship on web or Android. Do not base a cross-platform design on it.
- Google Sans / Product Sans: not OFL, not freely redistributable.
- Geist (Vercel): believed OFL, verify the repo LICENSE.
- Any font from "free font" aggregator sites: verify the original foundry licence.
- OFL allows bundling and embedding, prohibits selling the font by itself, and requires the Reserved Font Name rule to be respected if you modify and redistribute it (subsetting is usually fine; renaming the output family is the safe route).

## 2. Design tokens
- W3C Design Tokens Community Group published the first stable Format Module, 2025.10, on 28 Oct 2025 (JSON, `$value`, `$type`, `$description`, aliases with `{group.token}`, composite types such as typography, shadow, cubicBezier, duration). Sources: https://w3c.github.io/cg-reports/design-tokens/CG-FINAL-format-20251028/ , https://www.w3.org/community/design-tokens/ , https://styledictionary.com/info/dtcg/
- Style Dictionary v4 reads DTCG and has built-in or community transforms for CSS variables, Swift, Android XML and Compose. Expect to write a custom format for SwiftUI `Color`/`Font` extensions and Compose `Color`/`TextStyle`; that is normal.
- Suggested structure:
  - Colour: primitive ramps (neutral, accent, positive, negative, plus one neutral-warm), then semantic roles: `surface.base`, `surface.raised`, `ink.primary`, `ink.muted`, `accent`, `correct.fill`, `correct.ink`, `wrong.fill`, `wrong.ink`, `focus`. Each semantic role has `light` and `dark` values.
  - Type scale: 7 to 8 named roles (display, title, headline, statement-card, body, caption, label, mono) each with family, weight, size, line height, tracking. Sizes in unitless numbers (px on web, pt on iOS, sp on Android) so scaling is per-platform.
  - Spacing: 4pt base (4, 8, 12, 16, 24, 32, 48, 64).
  - Radius: 4 to 5 steps (sm, md, lg, card, pill).
  - Elevation: 3 levels defined as shadow composites; note Android elevation is not a CSS shadow, so define them as a y-offset, blur, colour triple and accept small differences.
  - Motion: durations (instant 0, fast 120 ms, base 220 ms, slow 360 ms) and easings as named curves, plus one spring (stiffness, damping ratio) for swipe release and card snap. CSS cannot do true springs except via `linear()` approximation, so keep the spring as the native source of truth and generate a `linear()` curve for web.
- Figma variables export to DTCG via plugins, so a Figma file can be the editing surface if wanted.

## 3. Effects portability (port-risk)
| Effect | Web | SwiftUI | Compose | Risk |
|---|---|---|---|---|
| Linear/radial gradients | trivial | `LinearGradient`/`RadialGradient` | `Brush.linearGradient` | Low |
| Mesh gradient | CSS layered radial gradients or canvas | `MeshGradient`, iOS 18+ only | no built-in, AGSL API 33+ or bitmap | Medium-high; use pre-rendered image |
| Backdrop blur | `backdrop-filter` | `Material` / `.blur` (not identical) | `RenderEffect` blur API 31+, no true backdrop | Medium-high |
| Blend modes | `mix-blend-mode` | `.blendMode` | `BlendMode` in layer | Medium (behaviour differs with compositing groups) |
| Noise/grain | SVG feTurbulence or PNG tile | tiled image | tiled image | Low as PNG tile; high as SVG filter |
| Inner shadow | `inset` box-shadow | manual overlay/stroke trick | manual | Medium |
| 3D card flip | `rotateY` + perspective | `rotation3DEffect` | `graphicsLayer { rotationY, cameraDistance }` | Low-medium (perspective values differ) |
| Spring physics | `linear()` approx / JS | `.spring`, `.interpolatingSpring` | `spring(dampingRatio, stiffness)` | Low |
| SVG filters | yes | none | none | High; avoid |
| Variable font animation | yes | poor | API 26+ only | High; avoid |
| Shaders | WebGL/CSS houdini | Metal `[[stitchable]]` iOS 17+ | AGSL API 33+ | High; three rewrites |
| Clip paths / arbitrary shapes | `clip-path` | `Shape` | `GenericShape` | Low-medium |
Sources for API levels: https://developer.android.com/reference/android/graphics/RenderEffect , https://www.hackingwithswift.com/quick-start/swiftui/how-to-create-a-mesh-gradient , https://www.createwithswift.com/creating-a-mesh-gradient-in-swiftui/
Recommendation: allow gradients, shadows, flips, springs, PNG grain; restrict anything rated medium-high or high to pre-rendered raster or vector assets exported from design.

## 4. Accessibility for this genre
- Colour-independence: WCAG 1.4.1 Use of Color. Correct/wrong must use icon + text + shape/position change as well as colour. Use a colour-blind-safe pair (blue/orange or teal/magenta) rather than red/green; keep luminance difference between the two.
- Contrast: 4.5:1 text, 3:1 large text and UI components (1.4.3, 1.4.11). Check the correct/wrong fills against both card and background in both themes.
- Touch targets: Apple HIG 44x44 pt, Material 48x48 dp, WCAG 2.2 SC 2.5.8 AA 24x24 CSS px (AAA 2.5.5 44). Sources: https://www.curbcutaccessibility.com/blog/touch-target-size-accessibility/ , https://www.designsystemscollective.com/a-designers-field-guide-to-wcag-ios-and-android-rules-31ba5d01d46a , https://compliscan.ai/wcag-checker/target-size . Use 48 as the floor everywhere; the main True/False buttons should be much larger.
- Swipe alternatives: WCAG 2.5.1 Pointer Gestures requires a single-pointer alternative, so the two buttons must be a first-class path, plus VoiceOver/TalkBack custom actions ("Answer true", "Answer false") on the card, and optional keyboard shortcuts (left/right arrow, T/F) on web.
- Reduced motion: `prefers-reduced-motion`, iOS Reduce Motion, Android animator duration scale 0. Replace fly-off, flip and shake with cross-fade or instant state change; keep the result feedback static.
- Dynamic type: use relative units (rem/em on web, Dynamic Type text styles on iOS, sp on Android); design card layouts to survive 200 percent, with the statement card scrolling or growing rather than truncating. Avoid fixed-height buttons that clip labels.
- Screen-reader order: read statement, then controls, then announce result and explanation as a live region / accessibility announcement.
- Haptics and sound as extra channels, never the only one.

## 5. Light/dark
- Design both from day one. Both mobile OSes follow the system setting, and a dark retrofit breaks any design that uses hard-coded colours or shadows for depth.
- Structure: semantic tokens with paired light/dark values, primitives shared. Keep accent hue the same, shift lightness and chroma by theme; define correct/wrong pairs per theme and verify contrast in each.
- Dark mode depth: shadows disappear on dark, so use surface lightness steps or 1px strokes for elevation; avoid pure black and pure white; reduce saturated large fills (they vibrate).
- Web: CSS custom properties under `:root` plus `@media (prefers-color-scheme: dark)` and a `[data-theme]` override. SwiftUI: asset-catalog colour sets or `Color` with `colorScheme`-aware init. Compose: a `ColorScheme`-like class supplied via CompositionLocal.
- Directions that are inherently single-theme (for example a deliberately dark neon look) can still ship a designed "inverse" theme; decide this per direction up front rather than later.

## Constraint checklist (for the 20 directions)
1. Fonts: max 2 families plus optional mono, all OFL, static weights available, no Fontshare/Apple/Google Sans.
2. No dependence on variable axes or font animation.
3. All colours from semantic tokens with light and dark values.
4. Correct/wrong distinguishable without colour (icon, label, shape), colour-blind-safe pair.
5. Text 4.5:1, UI 3:1, verified in both themes.
6. Controls at least 48 pt/dp; buttons are a full alternative to swipe.
7. Effects limited to gradients, shadows, springs, 3D flip, PNG grain; mesh gradients, blur, shaders only as raster assets.
8. Motion defined as tokens with a reduced-motion variant.
9. Layouts survive 200 percent text scale.
10. Tokens authored in DTCG 2025.10 JSON and built with Style Dictionary v4.

## Sources
- https://w3c.github.io/cg-reports/design-tokens/CG-FINAL-format-20251028/
- https://styledictionary.com/info/dtcg/
- https://www.w3.org/community/design-tokens/
- https://developer.android.com/develop/ui/compose/text/fonts
- https://medium.com/androiddevelopers/just-your-type-variable-fonts-in-compose-5bf63b357994
- https://developer.android.com/reference/android/graphics/fonts/FontVariationAxis
- https://mike-engel.com/writing/variable-fonts-on-macos-with-swiftui/
- https://movingparts.io/fonts-in-swiftui
- https://developer.android.com/reference/android/graphics/RenderEffect
- https://www.hackingwithswift.com/quick-start/swiftui/how-to-create-a-mesh-gradient
- https://www.curbcutaccessibility.com/blog/touch-target-size-accessibility/
- https://www.designsystemscollective.com/a-designers-field-guide-to-wcag-ios-and-android-rules-31ba5d01d46a