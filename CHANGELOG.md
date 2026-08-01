# Changelog

All notable changes to ReportSnips. Follows [Keep a Changelog](https://keepachangelog.com/); versions follow semver (v0.5.0 will be the MVP tag).

## [Unreleased]

### M2 — Libraries, folders, snippets (2026-08-01)

- Library switcher (§7.1): All Libraries / Unassigned Backlog / alphabetical libraries; create, rename, delete with consequence-spelling confirm; first-run seeds "My Snippets"; active library persists across sessions.
- Folder tree (§7.2): arbitrary depth, create/rename/delete (contents move to parent), drag re-parenting with cycle protection (dnd-kit), recursive snippet-count badges, depth-8 warning toast.
- Save Selection flow (§7.3): reads the Word selection via `documentIO.getSelectedText` (the only Office-boundary call), name prefilled with the first 8 words, editable content, multi-target "Save to" (zero targets = Unassigned Backlog, stated explicitly), informative placeholder-detection chips.
- Browse list with 2-line previews, edit (same form), and delete with confirm; teaching empty states.
- Zustand stores (`libraryStore`, `snippetStore`) over the StorageProvider; 19 new unit tests (tree utils, name/placeholder detection, store flows).
- Fixed: removed the template's `es6-promise` ProvidePlugin shim, which broke Dexie transactions in real browsers (`PrematureCommitError`) — see ADR-005.

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
