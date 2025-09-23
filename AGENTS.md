# Repository Guidelines

## Project Structure & Module Organization
MedPro mobile app built with Expo and TypeScript. Entry point `App.tsx` hooks into navigation from `src/navigation`. Domain code lives under `src/screens`, shared UI in `src/components`, global state with Zustand in `src/store`, services wiring APIs in `src/services`, types in `src/types`, and utilities in `src/utils`. Static assets are under `assets/`, theming tokens in `src/theme`, and operational playbooks in `docs/`—sync with these notes before major refactors.

## Build, Test, and Development Commands
Run `npm install` once per clone. Use `npm run start` for Expo Dev Tools, or platform shortcuts `npm run android`, `npm run ios`, `npm run web`. `npm run dev` clears the Metro cache when debugging stale bundles. Type safety is guarded with `npm run type-check`. For WSL or remote debugging, prefer `npm run start-wsl` or `npm run start-tunnel` so teammates can attach.

## Coding Style & Naming Conventions
Codebase uses TypeScript with path aliases defined in `tsconfig.json` (e.g. `@components/Button`). Follow Prettier defaults (2-space indent, single quotes) and run `npx prettier "src/**/*.{ts,tsx}" --check` before pushing if your editor is not configured. ESLint (extends Expo + React Native) blocks unsafe patterns; fix with `npx eslint src --fix`. Components and hooks use PascalCase filenames, utility modules camelCase, stores end with `Store.ts`. Keep strings localized in dedicated resource files when possible.

## Testing Guidelines
There is no automated test harness yet; see `docs/MOBILE-TESTING-PROCEDURES.md` for the staged adoption plan (Jest + Testing Library). Until that lands, rely on `npm run type-check`, manual verification in Expo, and QA scripts in `/docs`. When introducing tests, place them under `src/__tests__/` or alongside modules as `*.test.tsx`, mock APIs with helpers from `src/tests/mocks` once the scaffold exists, and aim for the 80% coverage goal documented in the roadmap.

## Commit & Pull Request Guidelines
Git history follows Conventional Commits (`feat:`, `fix:`, optional scopes like `feat(profile): …`). Keep messages imperative and singular. Each PR should include: concise summary, linked Jira/GitHub issue, screenshots or screen recordings for UI changes, and a test plan covering manual scenarios. Request review from the mobile lead before merging and ensure Expo packs cleanly (`npm run start` boots without warnings).

## Agent Operating Rules
You cannot run any git command without approval. You cannot guess anything without asking; if requirements are unclear, pause and request clarification before acting.
