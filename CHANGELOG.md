# Changelog

All notable changes to ReportSnips. Follows [Keep a Changelog](https://keepachangelog.com/); versions follow semver (v0.5.0 will be the MVP tag).

## [Unreleased]

### M1 — Data & storage core (2026-08-01)

- Data model (`src/models/`): TypeScript interfaces for all entities (plan §5) plus zod schemas for trust-boundary validation (import bundles, doc-settings reads) and a UUID helper.
- `StorageProvider` interface (`src/storage/`): the contract stores/UI use — CRUD for every entity, batch reads, `exportAll`, and the `importBundle` seam (implementation lands in M6).
- `IndexedDbProvider`: Dexie-backed implementation with schema v1 (multi-entry tag/membership indexes, unique case-insensitive tag names), cascade rules (library delete → memberships removed, orphans to Unassigned Backlog; folder delete → contents to parent), tag usage-count maintenance, prefs with defaults and changes-since-export tracking, and `navigator.storage.persist()` on init.
- 21 new unit tests (fake-indexeddb + zod schema coverage); CRUD round-trips for all entities.

### M0 — Scaffold (2026-08-01)

- Scaffolded from the official Office Add-in React + TypeScript task pane template (Word single-host, XML manifest).
- Strict TypeScript; ESLint (`office-addin-lint`) + Prettier; Vitest wired up with a manifest contract test.
- Directory skeleton matching the plan's architecture (`models/`, `storage/`, `office/`, `search/`, `importexport/`, `taskpane/state/`).
- Manifest branded as ReportSnips (fresh Id, description, GitHub support URL, WordApi 1.3 requirement) with generated ReportSnips icons.
- npm scripts: `dev`, `test`, `lint`, `typecheck`, `build`, `validate-manifest`, `format`/`format:check`.
- GitHub Actions CI (typecheck, lint, format, test, build, validate-manifest) with GitHub Pages deploy of `dist/` on `main`.
- Docs: README, sideloading guide (Windows + Mac), architecture summary, manual test checklist, decisions log (ADR-001…003). MIT license.
