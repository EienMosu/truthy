# Truthy

A mobile-first true or false card game that teaches IT. Pick what to study by filling in a boarding pass, then swipe right for true or left for false and learn why from a short explanation and a link to the official source. Everything runs on the device: decks are static JSON, progress lives in local storage, there is no account and no backend.

The design specification is in [docs/superpowers/specs/2026-10-01-truthy-design.md](docs/superpowers/specs/2026-10-01-truthy-design.md). The card content pipeline lives in `content/` and the design system and approved mockups in `design/`.

## Requirements

Node 24 and pnpm 10.

## Scripts

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the development server on http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm build:tokens` | Generate `app/tokens.css` from `design/system/tokens.json` (runs automatically before `pnpm dev` and `pnpm build`) |
| `pnpm build:decks` | Validate `content/catalog.json` and `content/reviewed/*.json` and write `public/decks/` (runs automatically before `pnpm dev` and `pnpm build`) |
| `pnpm start` | Serve the production build |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:watch` | Unit tests in watch mode |
| `pnpm typecheck` | Strict TypeScript over app, scripts and tests |
| `pnpm e2e` | End-to-end tests (Playwright) at phone size in Chromium and WebKit, against the production build |

Before the first `pnpm e2e`, install the browsers once with `pnpm exec playwright install chromium webkit`.
