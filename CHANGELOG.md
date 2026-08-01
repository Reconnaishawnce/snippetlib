# Changelog

All notable changes to ReportSnips. Follows [Keep a Changelog](https://keepachangelog.com/); versions follow semver (v0.5.0 will be the MVP tag).

## [Unreleased]

### M5 — Queue (2026-08-01)

- The Queue tab (§7.7): per-document staging list stored in the Word file's settings; user-named collapsible sections (default "Queue"), un-inserted count badge on the tab and per section.
- "Add to Queue" on every snippet row and search result, with a section-picker flyout when more than one section exists (last choice remembered per document).
- Insert from queue: per-item Insert and per-section **Insert All** (top to bottom), both with full placeholder resolution; items mark as inserted (dimmed + struck through, sinking to the bottom) rather than disappearing; **Clear inserted** per section.
- Drag to reorder items and move them between sections (drop on an item to take its place, on a section header to append); deleting a section moves its items to the first remaining section.
- Deleted snippets render as "(snippet deleted)" with a remove affordance — never a crash.
- Feature-flagged native **drag into the document**: a grip on each queue item carries the placeholder-resolved plain text (unknown tokens kept — no dialog can interrupt a drag). Flag defaults on; toggle lands with Settings in M7.
- Placeholders tab gained **Scan snippets**: pre-lists every `[Placeholder]` across the library so values can be filled before writing begins (owner request); pre-listed rows still prompt until filled.
- Dev: webpack filesystem cache — after the first compile, `npm run dev` starts in seconds instead of ~50 s.

### M4 — Insert & placeholders (2026-08-01)

- Insert at cursor (§6): per-snippet Insert button in browse and search, plus multi-select checkboxes with **Insert All** in list order (§7.5).
- Placeholder engine (§7.6) as a pure, heavily-tested module: `[Placeholder Name]` parsing, key normalization (trim/collapse/case-insensitive), first-seen display casing, value substitution, and the `\[escaped\]` escape hatch (stripped on insert).
- Insert-time resolution: known values substitute automatically; unknown placeholders raise one dialog for all of them — values entered are remembered **per document** (stored in the Word file's settings, zod-validated on read, saves debounced 2 s) so later inserts auto-fill; blank fields keep the literal token for manual handling.
- Placeholders tab: editable table of this document's captured values with a "future inserts only" note; values can be forgotten per key.
- Dev experience: the blank-pane watchdog now probes the dev server and reloads only when it can actually respond (up to ~90 s), fixing the slow-first-open/2-refreshes cycle.

### M3 — Tags & search (2026-08-01)

- Tag chip input (§7.4) in the save/edit form: ranked autocomplete (usage count desc), Enter/comma commits, new-tag confirmation with **Yes / No / Stop showing this** (persisted preference). New tags are created at save time, so cancelling the form leaves no orphans.
- Tag Manager tab: usage-ranked list; rename (merges automatically on name collision, with confirm), merge-into, delete — every confirm states the affected snippet count.
- Multi-tag filter bar with **AND** semantics on both browse and search views; active filters shown as dismissible chips.
- Full-text search (§7.5): MiniSearch index over name (boost 3) / tags (2) / content (1) with prefix + fuzzy matching, 150 ms debounce, library scoping with an "All libraries" toggle, incremental index updates on snippet changes; `/` focuses the search box.
- Results show highlighted name, library>folder breadcrumb, tag chips, highlighted excerpt, read-only preview popover, and edit/delete actions.
- Verified over 200 seeded snippets in tests (search < 100 ms; typical < 5 ms).
- UX fixes from M2 feedback: blank-pane self-reload watchdog (max 2 tries), settings-gear "Manage libraries" button replacing the ambiguous chevron, dev-overlay no longer triggered by benign ResizeObserver noise; tag usage counts refresh live after saves.

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
