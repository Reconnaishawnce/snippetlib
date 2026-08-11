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

## Team library via shared bundle URL

**Requested:** 2026-08-02 (project owner — accepted as backlog)

A curator publishes the export JSON to any HTTPS URL (SharePoint, GitHub, intranet); teammates paste the URL once in Settings. The pane checks it and offers "Team library updated — pull changes?" through the existing import/conflict machinery. No backend to run; makes sharing continuous instead of email-a-file.

**Shipped 2026-08-02 (run 3)**, behind the opt-in "Team library" feature switch (ADR-006).

## Report Builder (plan v3.0)

**Requested:** 2026-08-02 (project owner — accepted as backlog)

The Queue grows into a report outline: sections with headings, snippets slotted underneath, placeholders filled once up front, then "Generate" writes the whole skeleton document in order. The plan's stated end goal (TECH_PLAN §1); queue sections, doc-scoped state, and the placeholder engine were designed to grow into it.

**v1 shipped 2026-08-11 (run 4a)** as marker-based generation (`{{Section}}` replacement, per-section table/paragraph layout, fix-or-skip for missing markers). Owner-directed design: the document template owns headings; generation fills content. **Remaining (run 4b):** the drag-and-drop builder in a separate Office dialog window — outline left (loadable from saved templates), folder tree + search right. **Future:** snippet names as real Word sub-headings.
