# Decisions Log

Lightweight ADRs for deviations from or clarifications to `TECH_PLAN.md`. Newest first.

---

## ADR-005: Removed the template's `es6-promise` ProvidePlugin shim

**Date:** 2026-08-01 · **Milestone:** M2

The official template's webpack config injects `es6-promise` for every `Promise` reference via `ProvidePlugin`. TypeScript's transpiled `async/await` helpers then resolve through that polyfill instead of the native Promise, which defeats Dexie's transaction zone tracking — IndexedDB transactions auto-commit before their continuations run (`PrematureCommitError: Transaction committed too early`) in real browsers. Caught by a headless-Chromium smoke test; fake-indexeddb does not enforce commit timing, so unit tests can't see it. Removed the shim and the `es6-promise` dependency; `core-js` in the polyfill entry already supplies a global `Promise` for old webviews, which Dexie handles correctly.

## ADR-004: Commit directly to `main` — no feature branches

**Date:** 2026-08-01 · **Milestone:** M0

The plan (§12) proposed trunk-based development with short-lived feature branches and PRs. The project owner has directed that **all work is committed and pushed directly to `main`, never to branches**. This supersedes §12's branching convention; everything else in §12 (Conventional Commits, semver, docs) stands. Consequence: the CI workflow treats pushes to `main` as the primary trigger (checks + Pages deploy), and there is no PR gate — the local check suite must pass before every push.

## ADR-003: Manifest declares WordApi 1.3 in `<Requirements>`

**Date:** 2026-08-01 · **Milestone:** M0

The plan (§4) sets WordApi 1.3 as the API baseline. The template manifest declared no requirement set, which would let the add-in load on hosts below the baseline. Added `<Requirements><Set Name="WordApi" MinVersion="1.3"/></Requirements>` so unsupported hosts never load the pane. `office-addin-manifest validate` confirms coverage still includes Word 2016+ on Mac and Word 2019+ on Windows.

## ADR-002: ESLint via `office-addin-lint`, Prettier checked separately

**Date:** 2026-08-01 · **Milestone:** M0

The plan (§4) calls for "ESLint + Prettier, run in CI". The official template ships `office-addin-lint`, which _is_ ESLint preconfigured with `eslint-plugin-office-addins` plus the Office Prettier config — so we kept it (`npm run lint`) rather than maintaining a parallel ESLint config, and added an explicit `npm run format:check` (Prettier) step to CI. Revisit if we outgrow the packaged rule set (e.g., want typed-lint rules from typescript-eslint).

## ADR-001: Scaffolded by cloning the template repo directly; lockfile regenerated against public npm

**Date:** 2026-08-01 · **Milestone:** M0

`yo office` (the official generator) failed in the build environment (sandboxed home directory broke its config store, and its post-generate npm spawn). The generator is a thin wrapper that clones `OfficeDev/Office-Addin-TaskPane-React` and runs its `convert-to-single-host` script — so we did exactly that by hand (`word` + `xml` + name `ReportSnips`), which yields the identical project. The template's `package-lock.json` pinned tarball URLs to a Microsoft-internal Azure DevOps feed (401 for the public); it was regenerated against `registry.npmjs.org`. No functional difference from a `yo office` scaffold.

## ADR-006: Every non-core feature ships with an off switch

**Date:** 2026-08-02 · **Status:** accepted

Owner directive (usability run 2): the interface must stay simple for people who don't want every feature, and settings someone might fiddle into an annoying state (thresholds, alerts) must be easy to neutralize. Standing rule going forward: any feature beyond save/browse/search/insert gets a toggle in Settings → Features (defaulting to today's behavior), and anything that produces unsolicited alerts is opt-in. Current toggles: Queue (tab + Q buttons + menu items), usage sorting/frecency (recording + sorts), Quick Save, drag-into-document, new-tag confirm; stale-snippet review is opt-in with configurable thresholds and an alerts switch. Turning a feature off hides UI but never deletes data.
