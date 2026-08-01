# Changelog

All notable changes to ReportSnips. Follows [Keep a Changelog](https://keepachangelog.com/); versions follow semver (v0.5.0 will be the MVP tag).

## [Unreleased]

### M0 — Scaffold (2026-08-01)

- Scaffolded from the official Office Add-in React + TypeScript task pane template (Word single-host, XML manifest).
- Strict TypeScript; ESLint (`office-addin-lint`) + Prettier; Vitest wired up with a manifest contract test.
- Directory skeleton matching the plan's architecture (`models/`, `storage/`, `office/`, `search/`, `importexport/`, `taskpane/state/`).
- Manifest branded as ReportSnips (fresh Id, description, GitHub support URL, WordApi 1.3 requirement) with generated ReportSnips icons.
- npm scripts: `dev`, `test`, `lint`, `typecheck`, `build`, `validate-manifest`, `format`/`format:check`.
- GitHub Actions CI (typecheck, lint, format, test, build, validate-manifest) with GitHub Pages deploy of `dist/` on `main`.
- Docs: README, sideloading guide (Windows + Mac), architecture summary, manual test checklist, decisions log (ADR-001…003). MIT license.
