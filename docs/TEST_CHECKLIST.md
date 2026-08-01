# Manual Test Checklist

Executed per release (and per milestone where marked) on **Word for Windows** and **Word for Mac** desktop. Automated coverage (Vitest) handles pure logic; this list covers everything that needs a real Word host. See `TECH_PLAN.md` §10.

Record results as `[x] pass (platform, date)` or `[!] fail → issue link`.

## M0 — Scaffold

- [x] `npm run dev` starts the dev server, sideloads, and launches Word (Windows, 2026-08-01)
- [ ] `npm run dev` starts the dev server, sideloads, and launches Word (Mac)
- [x] ReportSnips button appears on the Home tab with the ReportSnips icon (Windows, 2026-08-01)
- [x] Task pane opens and renders the ReportSnips welcome screen (Windows, 2026-08-01)
- [ ] Production manifest (`dist/manifest.xml`) sideloads via shared-folder catalog (Windows) and loads from GitHub Pages
- [ ] Production manifest sideloads via `wef` folder (Mac) and loads from GitHub Pages

## M4 — Insert & placeholders

- [ ] Insert button places snippet text at the cursor, replacing any selection
- [ ] Insert into a table cell works
- [ ] First insert of a snippet with `[Building Name]` prompts; the value then appears in the Placeholders tab
- [ ] Second insert auto-fills without prompting
- [ ] Placeholder values survive closing and reopening the document (doc settings round-trip)
- [ ] Multi-select → Insert All inserts snippets in list order
- [ ] Blank dialog field keeps the literal `[token]` in the inserted text
- [ ] `\[escaped\]` text inserts as `[escaped]` and never prompts

## M5 — Queue

- [ ] "Add to Queue" from a browse row and a search result lands items in the Queue tab (badge updates)
- [ ] With 2+ sections, "Add to Queue" offers a section picker and remembers the last choice
- [ ] Per-item Insert and per-section Insert All insert top-to-bottom with placeholders resolved
- [ ] Inserted items dim + strike through and sink; "Clear inserted" removes them
- [ ] Drag reorders items and moves them between sections
- [ ] Queue persists after closing/reopening the document
- [ ] Deleting a queued snippet from the library shows "(snippet deleted)" in the queue, no crash
- [ ] Native drag grip into the document: note behavior per platform (Windows / Mac) — this is a bonus path, Insert is the contract
- [ ] Placeholders tab "Scan snippets" pre-lists all placeholders; unfilled ones still prompt on insert
- Import/export round-trip between two machines (M6)
- Dark mode pass; 320 px width pass (M7)
