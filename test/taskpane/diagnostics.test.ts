import { beforeEach, describe, expect, it } from "vitest";
import {
  buildDiagnosticsReport,
  getDiagnostics,
  libraryLooksMissing,
  logDiagnostic,
  updateLibraryMarker,
} from "../../src/taskpane/state/diagnostics";

// Minimal localStorage shim (vitest runs in node).
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

beforeEach(() => {
  store.clear();
});

describe("diagnostics ring buffer", () => {
  it("appends entries and caps at 50, newest last", () => {
    for (let i = 0; i < 55; i++) {
      logDiagnostic("test", `error ${i}`);
    }
    const entries = getDiagnostics();
    expect(entries).toHaveLength(50);
    expect(entries[0]?.message).toBe("error 5");
    expect(entries[49]?.message).toBe("error 54");
    expect(entries[49]?.source).toBe("test");
  });

  it("truncates very long messages", () => {
    logDiagnostic("test", "x".repeat(2000));
    expect(getDiagnostics()[0]?.message).toHaveLength(500);
  });
});

describe("library marker", () => {
  it("flags a missing library only when snippets existed and now none do", () => {
    expect(libraryLooksMissing(0)).toBeNull(); // no marker yet
    updateLibraryMarker(12, 2);
    expect(libraryLooksMissing(12)).toBeNull(); // still there
    expect(libraryLooksMissing(0)?.snippetCount).toBe(12); // gone!
    updateLibraryMarker(0, 0); // user accepted the fresh state
    expect(libraryLooksMissing(0)).toBeNull();
  });
});

describe("buildDiagnosticsReport", () => {
  it("includes version, counts, and log entries — content-free", () => {
    logDiagnostic("error-bar", "Insert failed: boom");
    const report = buildDiagnosticsReport("9.9.9", { libraries: 2, snippets: 41 });
    expect(report).toContain("version: 9.9.9");
    expect(report).toContain("2 libraries, 41 snippets");
    expect(report).toContain("[error-bar] Insert failed: boom");
  });
});
