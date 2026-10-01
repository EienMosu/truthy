# Truthy step 1 (one mode end to end) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed, installable web game in which a player fills in a boarding pass (area, platform, deck, section, class), plays a ten-card Classic round of true/false cards by swipe, button or keyboard, sees the result with the missed cards, and has progress and records kept on the device.

**Architecture:** A statically prerendered Next.js app with two routes (`/` start flow, `/play` round and result) and no server code. Pure TypeScript modules hold the rules: `src/content` (schemas, deck build, loading), `src/engine` (seeded dealing and the round reducer), `src/progress` (card history and records behind a storage interface), `src/input` (swipe interpretation). Client components render the design system from generated CSS variables. Decks are built from `content/reviewed/` into static JSON at build time.

**Tech Stack:** Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript 5.9 (strict, `noUncheckedIndexedAccess`), Tailwind CSS 4, Motion, zod 4, Vitest 4 with Testing Library, Playwright (phone-sized Chromium and WebKit), pnpm 10, Node 24, tsx for scripts, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-01-truthy-design.md`. Executors read the spec and their own task file. The visual authority is `design/system/DESIGN-SYSTEM.md`, `design/system/tokens.json` and the approved screens in `design/flow/screens/` (all moved into the repository by task 1).

## How this plan is organised

One file per task in this folder. Execute them in numeric order; each task ends with all of its changes committed and its tests green.

| Task | File | Delivers |
|---|---|---|
| 1 | `01-skeleton.md` | Project skeleton, gates (test, typecheck, build), CI, content and design moved in |
| 2 | `02-tokens.md` | `design/system/tokens.json` to `app/tokens.css` |
| 3 | `03-content.md` | Schemas, `content/catalog.json`, deck build to `public/decks/` |
| 4 and 5 | `04-05-engine.md` | Seeded randomness and dealing; the round reducer and its summary |
| 6 | `06-progress.md` | Card history, records, last route; local storage store |
| 7 | `07-swipe.md` | Swipe interpretation rules |
| 8 | `08-load.md` | Loading and caching the index and decks; the pending round |
| 9 | `09-foundation.md` | Layout, fonts, global styles, backdrop, logo, icons, buttons, contrast gate |
| 10 | `10-start.md` | The start flow (fill-in pass) |
| 11 | `11-play.md` | The play screen |
| 12 | `12-result.md` | The result and progress recording |
| 13 | `13-e2e.md` | End-to-end tests, manifest and icons, final gates, mockup comparison |
| 14 | `14-publish.md` | Licence, repository hygiene gate, GitHub repository, Vercel |

Every code block in these files was run before it was written down: the tasks were built in order in a throwaway project, test first, and an independent rebuild from the plan text alone reproduced that project file for file with all gates green (813 unit and component tests, 47 end-to-end tests in two browsers). If a step's actual output differs from the stated one, stop and find out why before going on.

## Global Constraints

- Versions: next 16.3.8, react and react-dom 19.2.8, typescript 5.9.3, tailwindcss 4.3.3, vitest 4.1.11, zod 4.6.5, motion 13.4.6, @playwright/test 1.63.0, pnpm 10, Node 24. Do not upgrade majors while executing this plan.
- No server code: no API routes, no server actions, no database, no environment secrets. Every route is prerendered.
- Module boundaries: `src/engine` and `src/input` import nothing from React, the DOM, storage, `Date` or `Math.random`. Dependencies point only downwards in the spec's module table (section 4).
- Components use the generated CSS variables only. No raw colour values in components (a test enforces this).
- Day theme only in step 1. The theme follows the system setting from step 3 on.
- Accessibility floor: text contrast at least 4.5:1 (a test enforces the token pairs), touch targets at least 48 px, visible focus (2 px ink ring, 2 px offset), nothing communicated by colour alone, `prefers-reduced-motion` replaces movement with a cross-fade, buttons and keyboard are full alternatives to swiping.
- Swipe rules, exact values: commit at 90 px on release, fling needs 40 px travel, input ignored for 250 ms after a new card or a new start step appears, mostly vertical gestures are not swipes, touches starting within 24 px of the screen edge are ignored. There is no undo.
- Card limits: statement at most 120 characters, explanation at most 240. A deck that breaks a rule fails the build.
- Motion: transforms and opacity only, imported from `motion/react`.
- UI copy: English, sentence case, exactly as in the approved screens. Code comments and docs: plain English.
- Test first: every behaviour gets a failing test before its implementation. Tests live in `tests/` mirroring the source path; end-to-end specs in `e2e/`.
- Commits: small, conventional prefix (`feat:`, `test:`, `chore:`, `docs:`), authored as `EienMosu <EienMosu@users.noreply.github.com>`, no co-author or tool attribution lines.
- The repository is public: nothing tracked may contain a local absolute path, a personal e-mail address or a secret (task 14 adds a permanent gate; task 1 cleans the moved folders before their first commit).
- Publishing (task 14) changes things outside this machine. Every such step needs the owner's explicit go-ahead and first checks that the active GitHub account is EienMosu.

## Review Focus

The inputs and conditions the spec implies that are most likely to bite a player. Each is pinned by tests in the task that owns the code.

1. **Leaving a round with the phone's back gesture or the browser's back button.** The answers already given must stay in the card history, and no record is set. Task 11, steps 34a to 34d.
2. **A network that never answers.** With a cached index or deck the game must fall back to the cached copy after a short timeout instead of waiting forever; without one it shows the retry message. Task 8, steps 30a to 30d.
3. **Double taps.** A second tap on "Next card" must not answer the next card unseen, and a second tap on a start-flow option must not choose an option on the next step. Task 11 (settle time for every input) and task 10, steps 30f to 30j; end-to-end in task 13.
4. **A deck update between rounds.** "Play again" after a new build must refetch the deck, never deal a removed card, prune its history and keep the record. Task 12, steps 19a and 19b.
5. **Small and turned screens.** At 320 by 568 nothing scrolls sideways and every control stays reachable through a whole round; turning the phone mid-round keeps the round. Task 13, steps 37a and 37b.

Also worth a reviewer's eye, covered by tests: storage that is unavailable, full or corrupt (tasks 6 and 8); the result being recorded exactly once per round under React strict mode (task 12); source links restricted to https so a deck cannot ship a script URL (task 3).
