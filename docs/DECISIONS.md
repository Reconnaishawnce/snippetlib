# Decisions Log

Lightweight ADRs for deviations from or clarifications to `TECH_PLAN.md`. Newest first.

---

## ADR-003: Manifest declares WordApi 1.3 in `<Requirements>`

**Date:** 2026-08-01 · **Milestone:** M0

The plan (§4) sets WordApi 1.3 as the API baseline. The template manifest declared no requirement set, which would let the add-in load on hosts below the baseline. Added `<Requirements><Set Name="WordApi" MinVersion="1.3"/></Requirements>` so unsupported hosts never load the pane. `office-addin-manifest validate` confirms coverage still includes Word 2016+ on Mac and Word 2019+ on Windows.

## ADR-002: ESLint via `office-addin-lint`, Prettier checked separately

**Date:** 2026-08-01 · **Milestone:** M0

The plan (§4) calls for "ESLint + Prettier, run in CI". The official template ships `office-addin-lint`, which _is_ ESLint preconfigured with `eslint-plugin-office-addins` plus the Office Prettier config — so we kept it (`npm run lint`) rather than maintaining a parallel ESLint config, and added an explicit `npm run format:check` (Prettier) step to CI. Revisit if we outgrow the packaged rule set (e.g., want typed-lint rules from typescript-eslint).

## ADR-001: Scaffolded by cloning the template repo directly; lockfile regenerated against public npm

**Date:** 2026-08-01 · **Milestone:** M0

`yo office` (the official generator) failed in the build environment (sandboxed home directory broke its config store, and its post-generate npm spawn). The generator is a thin wrapper that clones `OfficeDev/Office-Addin-TaskPane-React` and runs its `convert-to-single-host` script — so we did exactly that by hand (`word` + `xml` + name `ReportSnips`), which yields the identical project. The template's `package-lock.json` pinned tarball URLs to a Microsoft-internal Azure DevOps feed (401 for the public); it was regenerated against `registry.npmjs.org`. No functional difference from a `yo office` scaffold.
