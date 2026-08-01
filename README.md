# ReportSnips

A Microsoft Word task-pane add-in for report writers: save selected text as named, tagged, folder-organized **snippets**, then search and insert them into other reports — with placeholders that auto-fill per document, a build queue, and JSON import/export for team sharing.

> **Status:** v0.5 MVP in progress (M0 scaffold complete). See [`TECH_PLAN.md`](TECH_PLAN.md) for the full specification and [`CHANGELOG.md`](CHANGELOG.md) for progress.

## Why

Report writers reuse the same findings, boilerplate, and recommendations across dozens of documents. ReportSnips keeps a personal snippet library inside Word: hunt down the snippets you need up front, queue them, and work through the document top to bottom — with `[Placeholder Name]` tokens (client, building, dates…) filled in once per document and auto-substituted on every later insert.

## Features (v0.5)

- Save a selection as a named snippet in a folder tree, organized into libraries
- Tags with ranked autocomplete; full-text search (name, tags, content)
- Insert at cursor; multi-select insert; per-document build queue with sections
- `[Placeholders]` prompted once per document, auto-filled afterwards
- Last-3 revision history per snippet
- JSON export/import for backup and team sharing
- Runs on Word for Windows and Word for Mac (desktop); data stays local (IndexedDB)

## Development

```bash
npm install
npm run dev            # dev server + sideload into Word desktop
npm test               # unit tests (Vitest)
npm run lint           # ESLint (office-addin-lint)
npm run typecheck      # strict TypeScript, no emit
npm run build          # production build to dist/
npm run validate-manifest
```

Dev server runs at `https://localhost:3000`. See [`docs/SIDELOADING.md`](docs/SIDELOADING.md) for sideloading the add-in on Windows and Mac.

## Architecture

React 18 + Fluent UI v9 task pane, TypeScript strict, Dexie/IndexedDB behind a `StorageProvider` interface, MiniSearch for full-text search. All Word interaction is isolated in `src/office/documentIO.ts`. Details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and `TECH_PLAN.md` §5–6.

## License

[MIT](LICENSE)
