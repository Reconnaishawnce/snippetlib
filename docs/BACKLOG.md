# Backlog

Ideas accepted but not scheduled into the v0.5 milestones. Reviewed at each milestone boundary.

## Save Snippet from Word's selection popup

**Requested:** 2026-08-01 (project owner)

When text is highlighted, Word shows its floating mini-toolbar. Requested: a "Save Snippet" button there.

**Feasibility:** Office.js provides no API to extend the hover mini-toolbar, so that exact placement is impossible. The closest supported mechanism is a **right-click context menu command** (`ExtensionPoint xsi:type="ContextMenuText"` in the XML manifest), which adds a "Save to ReportSnips" item when right-clicking selected text — it can open the task pane directly into the save form. Good candidate for M7 polish or v1.0.

## Dev-mode first-load race

The blank-pane-on-first-open in dev is mitigated by the watchdog in `taskpane.html` (auto-reload up to 2×). If it recurs in production (Office cache), revisit with cache-busting headers on the Pages deployment.
