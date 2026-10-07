# Truthy

A mobile-first true or false card game that teaches IT. Pick what to study by filling in a boarding pass (an area, a platform, a deck such as AWS Cloud Practitioner, React or Kubernetes, a section and a class), then answer each statement by swiping right for true or left for false, with the True and False buttons, or with the arrow keys, and learn why from a short explanation and a link to the official source. There are four classes: Classic (ten cards, score at the end), Streak (until the first wrong answer), Three lives (until the third wrong answer) and Timed (as many as you can in 60 seconds). Everything runs on the device: decks are static JSON, progress lives in local storage, there is no account and no backend.

Play it on your phone at https://truthy-five.vercel.app

The design specification is in [docs/superpowers/specs/2026-10-01-truthy-design.md](docs/superpowers/specs/2026-10-01-truthy-design.md). The card content pipeline lives in `content/` and the design system and approved mockups in `design/`.

## Requirements

Node 24 and pnpm 10. The build needs no network: the fonts are committed in `app/fonts/`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the development server on http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm build:tokens` | Generate `app/tokens.css` from `design/system/tokens.json` (runs automatically before `pnpm dev` and `pnpm build`) |
| `pnpm build:decks` | Validate `content/catalog.json` and `content/reviewed/*.json` and write `public/decks/` (runs automatically before `pnpm dev` and `pnpm build`) |
| `pnpm build:sw` | Bundle the service worker (`src/offline/sw-entry.ts`) into `public/sw.js` with the release version (runs automatically before `pnpm dev` and `pnpm build`) |
| `pnpm start` | Serve the production build |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:watch` | Unit tests in watch mode |
| `pnpm typecheck` | Strict TypeScript over app, scripts and tests |
| `pnpm e2e` | End-to-end tests (Playwright) at phone size in Chromium and WebKit, against the production build: it builds first and serves on port 3100 (another with `E2E_PORT`); outside CI it reuses a server already running there |

Before the first `pnpm e2e`, install the browsers once with `pnpm exec playwright install chromium webkit`. [docs/testing.md](docs/testing.md) describes the gates and how the specs are written.

## Before you push

The repository is public, and a push publishes every commit in it, not only the last one. `pnpm test` checks the tracked files (`tests/repo-hygiene.test.ts`, rules in `scripts/hygiene.ts`), but CI runs it only after the push. A tracked pre-push hook checks the commits themselves before they leave the machine: every line they add, the files they add (PNG text and EXIF chunks included), their author and committer e-mail addresses and their messages (no co-author or tool attribution lines). It refuses the push on a finding. Turn it on once per clone, after `pnpm install`:

```bash
git config core.hooksPath .githooks
```

## License

The code is licensed under [MIT](LICENSE). The card content in `content/` is licensed under [CC BY 4.0](content/LICENSE.md); the documentation pages the cards link to belong to their owners. The Overpass and Overpass Mono fonts in `app/fonts/` are by The Overpass Project Authors, under the [SIL Open Font License 1.1](app/fonts/OFL.txt); the files there are static cuts of the four weights the game uses, reduced to the latin characters and the arrows.
