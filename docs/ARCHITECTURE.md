# Architecture

Distilled from `TECH_PLAN.md` §5–6 — kept current as the code evolves. As of **M0** most directories are empty skeletons; this documents the contracts they will honor.

## Layout

```
src/
  taskpane/            # React app (entry: taskpane.html / index.tsx)
    components/        # UI, organized by feature
    state/             # Zustand stores (M1+)
  models/              # TypeScript interfaces + zod schemas (M1)
  storage/             # StorageProvider interface + IndexedDbProvider (M1)
  office/              # documentIO.ts + placeholderEngine.ts (M2/M4)
  search/              # MiniSearch wrapper (M3)
  importexport/        # exporter/importer (M6)
  commands/            # reserved; MVP is task-pane only
```

## Boundary rules

1. **Only `src/office/documentIO.ts` may call `Word.run` / `Office.context`.** Everything above it is unit-testable with a mock. Three-function surface: `getSelectedText()`, `insertText()`, doc-settings read/write.
2. **Only `src/storage/IndexedDbProvider.ts` may touch Dexie.** UI and stores go through the `StorageProvider` interface — the seam that makes a v2.0 cloud provider possible without a rewrite.
3. **`placeholderEngine.ts`, `search/`, `importexport/` are pure and browser-agnostic**, fully covered by Vitest.
4. **Snippet content is untrusted plain text everywhere** — rendered via React text nodes only, never as HTML.

## Data placement

- **IndexedDB (via `StorageProvider`):** libraries, folders, snippets (global, multi-library memberships), tags, app prefs.
- **Word document settings (via `documentIO`):** per-document placeholder values and the Queue — ids/values only, never snippet content.

## Stack

TypeScript strict · React 18 · Fluent UI v9 · Office.js (WordApi 1.3 baseline) · Dexie · MiniSearch · dnd-kit · Zustand · webpack (official Office template) · Vitest.
