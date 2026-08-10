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

## M6 — Import/export & history

- [ ] Gear menu → Export everything downloads `reportsnips-export-YYYYMMDD.json`
- [ ] Round-trip: export on machine A, import on machine B — libraries, folder paths, tags, and snippets (with history) reconstruct
- [ ] Importing the same file again previews conflicts; **Keep Both** creates "… (imported)" copies; Keep Mine skips; Take Theirs overwrites
- [ ] A non-JSON or wrong-shape file shows a readable error, not a stack trace
- [ ] Backup banner appears when the library was never exported (or is stale); "Back up now" downloads and clears it
- [ ] Editing a snippet's content asks Update vs Save as New; a heavy rewrite highlights Save as New
- [ ] History shows the last 3 versions; Restore swaps a revision in and keeps the replaced version in history

## Run 3 — team library via shared URL

- [ ] Settings → Features: "Team library" switch is OFF by default and no team UI exists anywhere
- [ ] Switch on → Team library section appears (URL field, Check for updates, stamps)
- [ ] Publish an export somewhere reachable (e.g. a GitHub raw link), paste the URL, Save URL, Check for updates → import preview opens; Import pulls the snippets into the named libraries
- [ ] Check again immediately → "up to date" notice, no dialog
- [ ] Curator re-exports with a change and replaces the file → reopening the pane shows the update banner; Review & pull works
- [ ] A wrong URL (404) or non-JSON file shows a readable error on manual check, and stays silent on the automatic launch check
- [ ] Switch the feature off → section and banner disappear (URL is kept for later)

## Usability run 2 — right-click save, freshness, templates, toggles

**Re-sideload the manifest first** (the context menu is a manifest change): remove and re-add `manifest.xml` per docs/SIDELOADING.md, then restart Word.

- [ ] Select text → right-click → "Save to ReportSnips" appears and opens the pane into the save form with the selection pre-filled
- [ ] With Quick Save on, the right-click command saves instantly (toast) instead of opening the form
- [ ] Settings → Features: turning Queue off hides the Queue tab, all Q buttons, and Add-to-Queue menu items; turning it back on restores them (queue contents intact)
- [ ] Turning Usage sorting off removes Recently/Most used from the sort menu and stops counting inserts
- [ ] Settings → Snippet freshness: enable it, set "not used in" to 1 day, reopen the pane tomorrow (or set thresholds around an old imported library) — the alert banner appears; Review lists the snippets with reasons
- [ ] "Looks fine" removes a snippet from the review and it stays gone (clock reset)
- [ ] Alert-banner switch off: no banner, but Settings → "Review stale snippets (N)" still works
- [ ] Queue tab → Templates → Save queue as template; open a different/new document → Templates → Load — sections and snippets appear un-inserted
- [ ] Delete template removes it from the menu

## Usability run 1 — capture & insert speed

- [ ] Q button on a browse row adds the snippet to the Queue (badge increments); with 2+ sections it lands in the last-used section
- [ ] Q button works on search results too
- [ ] After Insert, the cursor sits after the inserted text + one space; inserting a second snippet continues cleanly
- [ ] Insert All still inserts in order with the cursor ending after the last snippet
- [ ] Settings → Quick Save on: Save Selection creates the snippet instantly (named from first words, filed in the open folder) with an Edit/Undo toast
- [ ] Quick Save toast: Edit opens the form; Undo removes the snippet
- [ ] Browse sort control: Recently used / Most used reorder after a few inserts; choice survives a pane reload

## M7 — Polish & hardening

- [ ] Settings tab: both toggles flip and persist across a pane reload
- [ ] Settings → toggle "Allow dragging queue items into the document" off hides the queue drag grips
- [ ] Settings → Export everything / Import… work (same behavior as the gear menu)
- [ ] Settings → Delete all data…: button stays disabled until `DELETE` is typed; after deletion the pane shows a fresh empty "My Snippets" library
- [ ] Help tab renders and the sideloading link opens
- [ ] Dark mode: with a dark Office theme (File → Account → Office Theme → Black) the pane renders dark; readable text everywhere, no white patches
- [ ] Importing a bad/non-JSON file shows a readable error and the pane does **not** vibrate/jitter (owner-reported bug)
- [ ] ⋯ → Move to… on a snippet: pick a folder, the snippet appears under that folder in Browse (and clicking the folder filters to it)
- [ ] Move to… with no location selected moves the snippet to the Unassigned Backlog
- [ ] Keyboard: Tab to a snippet card, press Enter — the snippet inserts at the cursor
- [ ] Narrow pane (~320 px): tabs wrap to a second row, no horizontal scrolling, dialogs fit
- [ ] Unexpected error simulation not required — but confirm no blank-pane states during the whole pass (error boundary + watchdog)
