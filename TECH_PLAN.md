# ReportSnips — Technical Plan (v0.5 MVP)

> **Working title:** ReportSnips (rename freely). A Microsoft Word add-in that lets report writers save selected text as named, tagged, folder-organized "snippets," then search and insert them into other reports — with placeholders, a build queue, and import/export for team sharing.

**Audience for this document:** Claude Code (or any developer) building the MVP. It contains product decisions, architecture, data model, feature specs, milestones, and repo conventions. Where a decision was open, the chosen option and rationale are recorded so the implementer does not need to re-litigate it.

---

## 1. Product Vision & Phases

| Phase    | Name                | Scope                                                                                                                                                                                                                                                                                                                                                      |
| -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v0.5** | MVP (this document) | Personal snippet library. Save selection → named snippet in a user-built folder tree, per-library. Tags with autocomplete. Full-text search. Insert at cursor. Multi-select + Queue with sections. Placeholders with per-document auto-fill. Last-3 revision history. JSON export/import (whole library or selected snippets). Windows + Mac desktop Word. |
| **v1.0** | Team sharing        | Import/export manager UX polish, "master copy" curator workflow (diff/merge review of imported snippets), conflict detection by snippet ID + revision. Optional AppSource submission (free, open source).                                                                                                                                                  |
| **v2.0** | Cloud (premium)     | Optional cloud sync backend + shared team workspaces. Enabled by the storage abstraction defined in §6 — no rewrite required.                                                                                                                                                                                                                              |
| **v3.0** | Report Builder      | The Queue evolves into a report outline; drag snippets into outline sections and generate the full document. **This is the end goal** — MVP decisions below (especially the Queue and placeholder systems) are designed to grow into it.                                                                                                                   |

**Non-goals for v0.5:** rich text formatting (plain text only), images/tables inside snippets, cloud sync, real-time collaboration, Word on the web optimization (should not be broken, but not a test target), AppSource submission.

---

## 2. Platform Decision

**Chosen: Office Add-in (JavaScript API / Office.js), task pane add-in, XML manifest.**

Rationale:

- Office.js add-ins run on **Word for Windows and Word for Mac** (and web) from one codebase. VSTO/COM is Windows-only and requires installers — disqualified by the Mac requirement.
- Task pane is the correct surface: a persistent side panel for browsing/searching/queueing while writing.
- **XML manifest (not the unified/JSON manifest).** The unified manifest's Word support on Mac is still not at parity; XML manifest is the safe cross-platform choice for a sideloaded team tool. Revisit at v1.0/AppSource time.
- Distribution for MVP: **sideloading** (per-user) with the static app hosted on **GitHub Pages** (HTTPS, free, zero infrastructure — fits the "non-programmer, minimal infra" constraint). Dev mode runs on `https://localhost:3000` via the standard Office add-in dev server.

Runtime note: Word on Windows uses Edge WebView2; Word on Mac uses a Safari/WebKit webview. Both support IndexedDB, which matters for §3. Test both; WebKit is the stricter target.

---

## 3. Storage Decision

The user asked for pros/cons. Summary of options considered:

| Option                                         | Pros                                                                                                | Cons                                                                                                                                                       | Verdict                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Word document settings / custom XML parts**  | Travels with the file; zero setup                                                                   | Per-document, not a global library; size limits                                                                                                            | Used only for _document-scoped_ state (placeholder values, queue) — see below |
| **`localStorage`**                             | Dead simple                                                                                         | ~5–10 MB quota; synchronous; partitioned per host; can be silently cleared                                                                                 | Rejected as primary store                                                     |
| **IndexedDB** (in the add-in webview)          | Large quota; structured; async; works offline; zero infrastructure; supported in both Word webviews | Browser-managed storage _can_ be evicted (rare but real); local to one machine                                                                             | ✅ **Primary store for MVP**                                                  |
| **User-managed file (JSON on OneDrive, etc.)** | User owns the data; free sync via OneDrive                                                          | Office add-in webviews cannot reliably read/write arbitrary local files (no File System Access API on WebKit); would require constant manual import/export | Rejected as primary; **JSON export/import is the escape hatch instead**       |
| **Cloud backend**                              | Sync, sharing, multi-device                                                                         | Infrastructure, auth, cost, maintenance — everything the MVP must avoid                                                                                    | Deferred to v2.0 premium                                                      |

**Decision: IndexedDB via a storage abstraction layer, with aggressive JSON export as backup.**

Eviction risk mitigations (all required in MVP):

1. Call `navigator.storage.persist()` on first run to request persistent storage.
2. **Auto-backup nudge:** track last-export timestamp; show a dismissible banner when > 7 days stale or > 25 snippets changed since last export. One click downloads a full-library JSON backup.
3. Export/import is a first-class feature (§7.8), not an afterthought — it doubles as the v1.0 team-sharing mechanism, exactly as the user described (central curator imports teammates' exports).

**Document-scoped state** (placeholder values for _this_ report, the Queue for _this_ report) is stored in the Word document itself via `Office.context.document.settings` so it travels with the file and survives reopening on another machine. Library data never lives in documents.

---

## 4. Tech Stack

| Concern                        | Choice                                                                                                          | Notes                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Language                       | TypeScript (strict mode)                                                                                        | Non-negotiable; the data model benefits heavily                                              |
| UI framework                   | React 18                                                                                                        |                                                                                              |
| Component library              | Fluent UI React v9 (`@fluentui/react-components`)                                                               | Native Office look; free a11y and theming (respects Office dark mode)                        |
| Office integration             | Office.js (`Word.run` API)                                                                                      | Requirement set WordApi 1.3 baseline (broad Mac coverage); feature-detect anything newer     |
| Local DB                       | Dexie.js (IndexedDB wrapper)                                                                                    | Schema versioning/migrations built in                                                        |
| Search                         | MiniSearch                                                                                                      | In-memory full-text index over name + tags + content; rebuilt on load, updated incrementally |
| Drag & drop (within task pane) | dnd-kit                                                                                                         | Queue reordering, folder tree moves                                                          |
| State                          | Zustand                                                                                                         | Small, testable, no boilerplate                                                              |
| Build                          | webpack via the official Office Add-in template (`yo office` → React+TS)                                        | Keeps `office-addin-debugging`, sideload tooling, and manifest validation scripts            |
| Tests                          | Vitest (unit: stores, storage layer, placeholder engine, search) + manual test checklist for Office integration | Office.js is impractical to fully automate for an MVP; see §10                               |
| Lint/format                    | ESLint + Prettier, run in CI                                                                                    |                                                                                              |
| CI                             | GitHub Actions: typecheck, lint, unit tests, build, deploy `dist/` to GitHub Pages on `main`                    |                                                                                              |

---

## 5. Data Model

All entities carry `id` (UUID v4), `createdAt`, `updatedAt` (ISO strings). TypeScript definitions live in `src/models/`.

```ts
/** A library = one working context (e.g., "Risk Assessments", "Compliance", "Marketing"). */
interface Library {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** Folder tree node. Folders belong to exactly one library. */
interface Folder {
  id: string;
  libraryId: string;
  parentId: string | null; // null = root of that library
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Snippets are GLOBAL entities. A snippet can live in multiple libraries
 * (possibly in a different folder in each), or in none (the Unassigned Backlog).
 */
interface Snippet {
  id: string;
  name: string;
  content: string; // plain text; may contain [Placeholder Name] tokens
  tagIds: string[];
  memberships: SnippetMembership[]; // empty array = Unassigned Backlog
  history: SnippetRevision[]; // most recent first, max length 3
  createdAt: string;
  updatedAt: string;
}

interface SnippetMembership {
  libraryId: string;
  folderId: string | null; // null = library root
}

interface SnippetRevision {
  content: string;
  name: string;
  savedAt: string;
}

/** Tags are global across all libraries. */
interface Tag {
  id: string;
  name: string; // unique, case-insensitive
  usageCount: number; // maintained on snippet save/delete; drives autocomplete ranking
  createdAt: string;
  updatedAt: string;
}

/** ---- Document-scoped (stored in Word document settings, NOT IndexedDB) ---- */

/** Placeholder values captured for the current document. Key = normalized placeholder name. */
type DocumentPlaceholderValues = Record<string, string>;

/** The Queue for the current document. */
interface QueueState {
  sections: QueueSection[];
}
interface QueueSection {
  id: string;
  name: string; // e.g., "High", "Medium", "Low" — user-defined
  sortOrder: number;
  items: QueueItem[];
}
interface QueueItem {
  id: string;
  snippetId: string;
  sortOrder: number;
  inserted: boolean; // marked true after insertion; struck through in UI, not removed
}

/** ---- App-scoped preferences (IndexedDB) ---- */
interface AppPrefs {
  activeLibraryId: string | null; // null = "All libraries" view
  suppressNewTagConfirm: boolean; // "Stop Showing This"
  lastExportAt: string | null;
  changesSinceExport: number;
}
```

Dexie tables: `libraries`, `folders`, `snippets`, `tags`, `prefs` (single row). Indexes: `folders: libraryId, parentId`; `snippets: *tagIds, *membershipLibraryIds` (computed multi-entry index maintained on write); `tags: name (unique), usageCount`.

---

## 6. Architecture & Storage Abstraction

```
src/
  taskpane/            # React app (entry: taskpane.html / taskpane.tsx)
    components/        # UI, organized by feature (see §8)
    state/             # Zustand stores: libraryStore, snippetStore, queueStore, searchStore, prefsStore
  models/              # TypeScript interfaces above + zod schemas for import validation
  storage/
    StorageProvider.ts # THE interface — everything below the stores goes through this
    IndexedDbProvider.ts
    (CloudProvider.ts) # v2.0 — not built now, but the interface must make it possible
  office/
    documentIO.ts      # getSelectionText(), insertTextAtCursor(), doc settings read/write
    placeholderEngine.ts
  search/
    searchIndex.ts     # MiniSearch wrapper; incremental add/update/remove
  importexport/
    exporter.ts        # library / selection → versioned JSON file download
    importer.ts        # JSON → validated (zod) → merge with conflict policy
  commands/            # (reserved; MVP is task-pane only, no ribbon function commands)
```

**`StorageProvider` interface (contract):** async CRUD for every entity type, batch reads (`getAllSnippets()` etc. for index building), a single `exportAll(): Promise<ExportBundle>`, and `importBundle(bundle, policy)`. Stores never touch Dexie directly. This is the seam where a v2.0 cloud provider (or a sync-both provider) slots in — **this constraint is the whole reason the MVP can later "push into the cloud" without a rewrite.**

**Office boundary rules** (`src/office/documentIO.ts` is the only file allowed to call `Word.run`):

- `getSelectedText(): Promise<string>` — used by Save Selection.
- `insertText(text: string): Promise<void>` — inserts at current cursor/selection (`Selection.insertText(..., "Replace")`). Works inside table cells natively — no special casing needed.
- `readDocSettings<T>(key) / writeDocSettings(key, value)` — wraps `Office.context.document.settings` + `saveAsync`, with JSON serialization and a 2 s debounce on writes.

---

## 7. Feature Specifications (MVP)

### 7.1 Libraries & the Library Switcher

- Dropdown at the top of the task pane: lists libraries alphabetically, plus **"All Libraries"** and **"Unassigned Backlog"** pseudo-entries.
- Selecting a library scopes the folder tree, browse view, and (by default) search. Search offers an "all libraries" toggle.
- CRUD: create (name + optional description), rename, delete. Deleting a library removes its folders and its _memberships_ — snippets that end up with zero memberships move to the Unassigned Backlog (never silently deleted). Confirm dialog states exactly this.
- First run: seed one library named "My Snippets" so the save flow never dead-ends.

### 7.2 Folder Tree

- Per-library, user-built, arbitrary depth (e.g., `Findings > Vulnerabilities > Physical > Door Fitment Issues`).
- Operations: create child/sibling, rename, delete (contents move to parent), drag to re-parent/reorder (dnd-kit).
- Tree rows show folder name + snippet count (recursive count in a muted badge).
- Practical depth guard: warn (don't block) beyond 8 levels.

### 7.3 Saving a Snippet ("Save Selection")

Flow:

1. User selects text in the document → clicks **Save Selection** (primary button, always visible).
2. If selection is empty → inline error "Select some text in your document first."
3. Save form: **Name** (required; prefilled with first 8 words of selection), **Content** (editable textarea, prefilled with selection), **Tags** (chip input, §7.4), **Save to** (multi-select of `Library > Folder path` targets, defaulting to the active library's currently selected folder; zero targets = Unassigned Backlog — the form says so explicitly).
4. Placeholder hint: if content matches `\[([^\[\]\n]{1,60})\]`, show detected placeholders as chips ("Will prompt for: Building Name, Client") — see §7.6. No action needed; purely informative.
5. Save → snippet created, tag usage counts incremented, search index updated, toast "Saved to <targets>".

### 7.4 Tags

- **Freeform with ranked autocomplete:** chip input; suggestions are existing tags filtered by prefix/substring, ranked by `usageCount` desc, then alphabetically. Enter or comma commits a chip.
- **New-tag confirmation:** committing a tag that doesn't exist (case-insensitive match) opens a small dialog: _"You're adding a new tag: '<name>'. You can edit tags later in the Tag Manager."_ Buttons: **Yes** / **No** / **Stop showing this** (sets `suppressNewTagConfirm`; re-enable in Settings).
- **Tag Manager tab:** list all tags with usage counts; rename (merges on collision, with confirm), delete (removes from all snippets, with confirm showing affected count), merge A→B.
- **Multi-tag filtering:** in browse and search views, a tag filter bar; selecting multiple tags is **AND** semantics (matches user intent of narrowing). Show active filters as removable chips.

### 7.5 Search

- Single search box, instant results (debounced 150 ms), scoped to active library with an "All libraries" toggle.
- MiniSearch index over `name` (boost 3), tag names (boost 2), `content` (boost 1); prefix + fuzzy (0.2) enabled.
- Results show: name, library/folder breadcrumb(s), tag chips, 2-line content excerpt with match highlighting.
- Result actions (hover/focus): **Insert**, **Add to Queue**, **Preview** (popover, read-only), overflow menu (Edit, History, Export).
- Multi-select mode: checkbox appears on hover / long-press; selection header offers **Insert All** (in list order) and **Add All to Queue**.

### 7.6 Placeholders

- **Syntax:** `[Placeholder Name]` — matches the user's own convention. Regex: `\[([^\[\]\n]{1,60})\]`. Normalization for keying: trim + collapse spaces + case-insensitive (`building name` ≡ `Building Name`); display preserves the first-seen casing.
- **Insert-time resolution:**
  1. On insert (single, multi, or from Queue), scan the snippet for placeholders.
  2. For each placeholder with a known value in `DocumentPlaceholderValues` (stored in _this document's_ settings) → substitute automatically.
  3. Unknown placeholders → one dialog listing all of them with text inputs ("New placeholders in this snippet"). Filling a value stores it for the document, so **every later insert auto-fills it** — the "as they insert more and more, Building Name fills itself in" behavior. A "leave blank, keep token" option per field inserts the literal `[Building Name]` for manual handling.
- **Placeholders tab:** table of all captured values for the current document; editable. Editing a value updates future inserts only (MVP does **not** retro-edit text already in the document; that's a v3 report-builder concern — note this in the UI copy).
- Escape hatch: `\[not a placeholder\]` is left alone (strip the backslashes on insert). Documented in Help.

### 7.7 The Queue

- **Purpose:** hunt snippets up front, then work through the document top-to-bottom inserting from a staged list. Per-document (stored in document settings via `documentIO`).
- Structure: user-named **sections** (e.g., High / Medium / Low) containing ordered snippet references. Default: single section "Queue" until the user adds more.
- Adding: "Add to Queue" from any snippet row/result; a section picker flyout appears if more than one section exists (remembers last choice).
- Queue tab UI: sections as collapsible groups; dnd-kit for reordering items and moving between sections; per-item **Insert** button; per-section **Insert All**; item context menu (Preview, Remove, Go to snippet).
- After insert: item marked `inserted: true` (dimmed + struck through, moves to bottom of its section) rather than removed — the user can see progress and re-insert if needed. "Clear inserted" button per section.
- **Drag-and-drop into the document (progressive enhancement):** queue items are HTML5-draggable with `text/plain` data set to the _placeholder-resolved_ content. Word desktop accepts plain-text drops, including into table cells — but behavior varies by platform/version, and drop-position APIs don't exist in Office.js. Therefore: implement it, feature-flag it, test on both platforms, and **never rely on it** — the Insert button is the contract; drag-drop is a bonus. If resolution requires prompting for unknown placeholders, resolve what's known and drop tokens for the rest (no dialog can interrupt a native drag).
- Snippet deleted from library while queued → queue item renders as "(snippet deleted)" with a remove affordance; never crash on a dangling reference.

### 7.8 Import / Export

- **Export:** full library(ies) or explicit snippet selection → single JSON file (`reportsnips-export-YYYYMMDD.json`) downloaded via blob link. Bundle contains: `formatVersion: 1`, exporter app version, entities (snippets with history, tags referenced, libraries/folders needed to reconstruct memberships).
- **Import:** file picker → zod validation (reject with a readable error, never a stack trace) → **preview screen**: N new snippets, M updates to existing (matched by snippet `id`), K new tags. Per-conflict policy for id-matches: Keep Mine / Take Theirs / **Keep Both** (imports as a copy with new id, name suffixed " (imported)"). Default: Keep Both — safest for the v1.0 curator workflow.
- Folder paths are reconstructed by name-matching within the target library; missing folders are created.
- This same bundle format is the v1.0 sharing currency and the backup format for §3's eviction mitigation. **Treat `formatVersion` as a real contract from day one.**

### 7.9 Snippet Editing & History

- Edit form = save form. On save of a content change, offer two buttons: **Update Snippet** and **Save as New Snippet**.
- **"Changed enough" heuristic:** compute token-level similarity (Dice coefficient on word bigrams — implement in ~20 lines, no dependency) between old and new content. If similarity < 0.6, the dialog defaults/highlights **Save as New** with copy: _"This looks like a substantially different snippet."_ The user can always override. Log the similarity score in dev mode for tuning.
- **Update** pushes the previous `{name, content}` onto `history` (cap 3, drop oldest). History viewer: read-only list of the last 3 revisions with timestamps and a **Restore** button (restoring also pushes current state to history).
- **Save as New** creates a new snippet with the same tags/memberships and empty history.

### 7.10 Settings & Help

- Settings: re-enable new-tag confirmation, backup reminder cadence, export/import shortcuts, feature flag toggle for doc drag-drop, "Delete all data" (typed confirmation).
- Help: one static page — placeholder syntax, queue workflow, backup guidance, sideloading link for teammates.

---

## 8. Task Pane UX

Layout (top → bottom):

1. **Header:** Library switcher dropdown + Save Selection button (primary).
2. **Search box** (always visible).
3. **Tab strip:** `Browse` (folder tree + snippet list) · `Queue` (badge = un-inserted count) · `Placeholders` · `Tags` · `Settings`.
4. **Backup nudge banner** slot (per §3), dismissible.

Design notes for the implementer:

- Task panes are ~320–450 px wide. Design **single-column, list-first**; breadcrumbs truncate middle (`Findings > … > Door Fitment`). Test at 320 px.
- Use Fluent v9 components and Office theme tokens throughout so dark mode and platform styling are free. This is a productivity tool living inside Word — it should feel like Word's own UI, not a branded web app. Spend any design personality on _clarity of the queue workflow_ (clear section grouping, satisfying inserted-state), not on decoration.
- Keyboard: full tab-order, Enter inserts focused result, `/` focuses search. Word power users live on the keyboard.
- Every destructive action confirms with specific consequences ("Delete tag 'physical' from 14 snippets?").
- Empty states teach: empty library → "Select text in your report and click Save Selection"; empty queue → one-line explanation of the hunt-then-insert workflow.

---

## 9. Milestones (build order for Claude Code)

Each milestone ends with: unit tests green, `npm run validate-manifest` clean, manual smoke test in Word desktop, conventional-commit history, short CHANGELOG entry.

- **M0 — Scaffold (½ day):** `yo office` React+TS task pane template; repo hygiene (ESLint/Prettier/strict TS, GitHub Actions CI, Pages deploy); manifest named/iconned; sideload docs for Windows + Mac in `docs/SIDELOADING.md`. _Exit: blank task pane loads in Word on both platforms._
- **M1 — Data & storage core:** models + zod schemas; `StorageProvider` interface; `IndexedDbProvider` with Dexie migrations; prefs; `navigator.storage.persist()`; unit tests against fake-indexeddb. _Exit: CRUD round-trips for all entities in tests._
- **M2 — Libraries, folders, snippets:** library switcher + CRUD; folder tree with drag re-parenting; Save Selection flow (`getSelectedText`); browse list; edit/delete; Unassigned Backlog view. _Exit: full save→browse→edit loop working in Word._
- **M3 — Tags & search:** tag chip input with ranked autocomplete + new-tag confirm; Tag Manager; MiniSearch index with incremental updates; search UI with multi-tag AND filtering, highlighting, preview popover. _Exit: search over 200 seeded snippets feels instant._
- **M4 — Insert & placeholders:** `insertText`; placeholder engine (parse, normalize, resolve, escape) as a pure, heavily-tested module; unknown-placeholder dialog; doc-settings persistence; Placeholders tab; multi-select Insert All. _Exit: the Building Name auto-fill story works end to end across task-pane reloads._
- **M5 — Queue:** queue store persisted to doc settings; sections; add-to-queue everywhere; reorder/move; insert-from-queue with placeholder resolution; inserted-state; feature-flagged native drag-drop. _Exit: hunt-then-insert workflow demo on a real risk-assessment-style doc._
- **M6 — Import/export & history:** export bundles; import with validation, preview, conflict policy; backup nudge; revision history + similarity heuristic + Save-as-New. _Exit: export from machine A, import on machine B, Keep Both conflicts behave._
- **M7 — Polish & hardening:** empty states, keyboard pass, dark mode pass, error boundaries, storage-failure toasts, Help page, manual test checklist executed on Windows + Mac; tag v0.5.0.

---

## 10. Testing Strategy

- **Unit (Vitest):** placeholder engine (the highest-risk pure logic — test escaping, normalization, unicode, nested-bracket edge cases), similarity heuristic, search index updates, import validation/merge policies, storage provider (fake-indexeddb), queue reducers.
- **Manual checklist** (`docs/TEST_CHECKLIST.md`, executed per release on Windows + Mac): save/insert round-trip, insert into a table cell, placeholder prompt + auto-fill on second insert, queue persistence after closing/reopening the document, doc drag-drop behavior notes per platform, import/export round-trip, dark mode, 320 px width.
- **Why no automated Office integration tests:** driving real Word cross-platform in CI is disproportionate for an MVP. The `documentIO` boundary is deliberately thin (3 functions) so everything above it is unit-testable with a mock.

## 11. Risks & Mitigations

| Risk                                            | Mitigation                                                                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| IndexedDB eviction loses the library            | `storage.persist()`, backup nudges, first-class export (§3)                                                                       |
| Native drag-drop into document is flaky         | Feature-flagged enhancement; Insert button is the contract (§7.7)                                                                 |
| WebKit (Mac) webview quirks                     | Mac in every milestone's smoke test, not just at the end                                                                          |
| `[brackets]` collide with real report text      | Escape syntax, insert-time-only substitution, "keep token" option (§7.6)                                                          |
| Doc settings size limits (queue + placeholders) | Store only ids/values, never snippet content, in doc settings; warn near limits                                                   |
| Import of malicious/garbage JSON                | zod validation, no `eval`, content treated as inert text everywhere (also render as text in React — no `dangerouslySetInnerHTML`) |
| Scope creep toward v3                           | The Queue's data model (§5) already anticipates the report builder; anything more ships later                                     |

## 12. Repo Conventions

- **License:** MIT (open-source goal). Add `LICENSE` at M0.
- **Branching:** trunk-based; short-lived feature branches → PR → squash merge to `main`; `main` auto-deploys to Pages.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`…).
- **Docs:** `README.md` (what/why/screenshots), `docs/SIDELOADING.md`, `docs/TEST_CHECKLIST.md`, `docs/ARCHITECTURE.md` (a distilled §5–6 kept current), this `TECH_PLAN.md` (immutable record of the plan; deviations get logged in `docs/DECISIONS.md` as lightweight ADRs).
- **Versioning:** semver; v0.5.0 is the MVP tag.
