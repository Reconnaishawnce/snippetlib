# CLAUDE.md — Working Instructions for This Repo

You are building **ReportSnips**, a Microsoft Word task-pane add-in for saving, organizing, and inserting reusable report snippets. The complete specification is in **`TECH_PLAN.md`** — read it in full before writing any code. This file covers how to work, not what to build.

## Ground rules

1. **`TECH_PLAN.md` is the spec.** Follow it. If you believe a decision in it is wrong or infeasible, do not silently deviate — implement the closest compliant version, then record the issue and your recommendation in `docs/DECISIONS.md` and flag it to the user.
2. **Build in milestone order (M0 → M7, plan §9).** Do not start a milestone until the previous one's exit criteria pass. Do not build v1.0+ features (cloud, sharing UX beyond import/export, report builder).
3. **Respect the architecture boundaries (plan §6):**
   - Only `src/office/documentIO.ts` may call `Word.run` / `Office.context`.
   - Only `src/storage/IndexedDbProvider.ts` may touch Dexie. UI and stores go through the `StorageProvider` interface.
   - `placeholderEngine.ts`, `search/`, and `importexport/` must be pure/browser-agnostic and unit-tested.
4. **TypeScript strict, no `any` without a comment justifying it.** Zod-validate anything crossing a trust boundary (imports, doc settings reads).
5. **Never render snippet content as HTML.** It is untrusted plain text everywhere (`textContent` / React text nodes only).
6. **Small commits, Conventional Commits, one logical change each.** Update `CHANGELOG.md` per milestone.
7. **Tests are part of the milestone**, not a follow-up. Vitest for pure logic; keep `docs/TEST_CHECKLIST.md` current for manual Office checks.

## Environment & commands

- Scaffold with the official Office Add-in generator (React + TypeScript task pane), then restructure to match plan §6.
- Expected scripts (wire these up in M0): `npm run dev` (dev server + sideload), `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run validate-manifest`.
- CI (GitHub Actions): typecheck + lint + test + build on every PR; deploy `dist/` to GitHub Pages on `main`.
- You cannot run Word yourself. When a task needs verification inside Word (sideload success, insert behavior, drag-drop, dark mode), stop and give the user precise manual test steps, then wait for their result before proceeding.

## Definition of done (every milestone)

- [ ] Exit criteria from plan §9 met
- [ ] `npm test`, `lint`, `typecheck`, `build`, `validate-manifest` all pass
- [ ] Manual test steps provided to the user (and confirmed, where blocking)
- [ ] CHANGELOG entry + any new decisions logged in `docs/DECISIONS.md`
