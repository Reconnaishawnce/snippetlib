# Backlog

Ideas accepted but not scheduled into the v0.5 milestones. Reviewed at each milestone boundary.

## Save Snippet from Word's selection popup

**Requested:** 2026-08-01 (project owner)

When text is highlighted, Word shows its floating mini-toolbar. Requested: a "Save Snippet" button there.

**Feasibility:** Office.js provides no API to extend the hover mini-toolbar, so that exact placement is impossible. The closest supported mechanism is a **right-click context menu command** (`ExtensionPoint xsi:type="ContextMenu"` in the XML manifest), which adds a "Save to ReportSnips" item when right-clicking selected text — it can open the task pane directly into the save form.

**Shipped 2026-08-02 (usability run 2):** right-click on selected text → "Save to ReportSnips" opens the pane at `?action=save-selection`, which triggers the normal save flow (form, or Quick Save when enabled).

## Dev-mode first-load race

The blank-pane-on-first-open in dev is mitigated by the watchdog in `taskpane.html` (auto-reload up to 2×). If it recurs in production (Office cache), revisit with cache-busting headers on the Pages deployment.

## Rich text snippets (formatted content)

**Requested:** 2026-08-02 (project owner — accepted as backlog)

Snippets are plain text by design (CLAUDE.md rule 5). Real reports use bold headings, bullets, and tables. Feasible via Word's OOXML round-trip (`Range.getOoxml()` / `insertOoxml`), but it rewrites the security model (no more text-nodes-only rendering), preview, search extraction, and the export format. v1.0-scale project; decide deliberately.

**Shipped 2026-08-11 (run 5)** as an experimental opt-in that keeps the security model intact: OOXML is stored alongside plain text and only ever sent to Word — never rendered in the pane; text stays the source of truth for search/preview/history. v1 limits: placeholder snippets and report tables insert plain; text edits drop stored formatting. Word-fidelity verification (the OOXML spike) is the first item of the run-5 test checklist.

## Team library via shared bundle URL

**Requested:** 2026-08-02 (project owner — accepted as backlog)

A curator publishes the export JSON to any HTTPS URL (SharePoint, GitHub, intranet); teammates paste the URL once in Settings. The pane checks it and offers "Team library updated — pull changes?" through the existing import/conflict machinery. No backend to run; makes sharing continuous instead of email-a-file.

**Shipped 2026-08-02 (run 3)**, behind the opt-in "Team library" feature switch (ADR-006).

## Report Builder (plan v3.0)

**Requested:** 2026-08-02 (project owner — accepted as backlog)

The Queue grows into a report outline: sections with headings, snippets slotted underneath, placeholders filled once up front, then "Generate" writes the whole skeleton document in order. The plan's stated end goal (TECH_PLAN §1); queue sections, doc-scoped state, and the placeholder engine were designed to grow into it.

**v1 shipped 2026-08-11 (run 4a)** as marker-based generation (`{{Section}}` replacement, per-section table/paragraph layout, fix-or-skip for missing markers). Owner-directed design: the document template owns headings; generation fills content. **Run 4b shipped 2026-08-11:** the drag-and-drop builder window (outline left with rename/layout/reorder, library browse + search right, Save-to-queue round-trip preserving inserted flags). **Future:** snippet names as real Word sub-headings.

## Builder: editable table format per section (and globally)

**Requested:** 2026-08-11 (project owner)

The generated table layout is fixed at 2 columns (name | content). Wanted: control over the table format from the builder — per section, with a global default. Scope to define: column set (e.g. hide the name column, add a severity column), column widths, header row on/off, maybe style. Likely lands as a "layout options" popover on each builder section.

## Findings model: vulnerability + action plan + evidence

**Requested:** 2026-08-11 (project owner — needs design discussion before building)

A "finding" is a structured unit: **title + vulnerability + action plan + evidence**. In the builder, under a section header, you'd pick the vulnerability snippet and then assemble its action plan. Key owner insight: action plans should be **tied to vulnerabilities** — if vulnerability ABV is found, the linked action-plan snippets XYZ/ZDF/PRT are offered as selectable options (one or several) rather than hunting folders. Open design questions for the discussion: whether a finding is a new entity type or a convention over snippets + links; how snippet-to-snippet links are stored/exported; how findings render in generation (probably a per-finding table block); how evidence (likely images later) fits the plain-text constraint.
