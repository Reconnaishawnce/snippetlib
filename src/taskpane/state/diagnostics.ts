/**
 * Support diagnostics (run 8): a small error ring buffer plus a library
 * marker, both in localStorage — deliberately OUTSIDE IndexedDB so they
 * survive the failure they exist to explain (an evicted/cleared database).
 * Everything here is best-effort: diagnostics must never break the app.
 */
/* global localStorage, navigator, window, document */

const LOG_KEY = "reportsnips.diagnostics";
const MARKER_KEY = "reportsnips.libraryMarker";
const LOG_LIMIT = 50;

export interface DiagnosticEntry {
  at: string;
  source: string;
  message: string;
}

export interface LibraryMarker {
  snippetCount: number;
  libraryCount: number;
  updatedAt: string;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota/unavailable — diagnostics are best-effort.
  }
}

/** Appends to the ring buffer (newest last, capped at LOG_LIMIT). */
export function logDiagnostic(source: string, message: string): void {
  const entries = readJson<DiagnosticEntry[]>(LOG_KEY) ?? [];
  entries.push({ at: new Date().toISOString(), source, message: message.slice(0, 500) });
  writeJson(LOG_KEY, entries.slice(-LOG_LIMIT));
}

export function getDiagnostics(): DiagnosticEntry[] {
  return readJson<DiagnosticEntry[]>(LOG_KEY) ?? [];
}

/** Global last-resort hooks; call once at startup. */
export function installDiagnosticHooks(): void {
  try {
    window.addEventListener("error", (event) => {
      if (!/ResizeObserver/.test(event.message ?? "")) {
        logDiagnostic("window.onerror", event.message ?? "unknown error");
      }
    });
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      logDiagnostic(
        "unhandledrejection",
        reason instanceof Error ? reason.message : String(reason)
      );
    });
  } catch {
    // Never let diagnostics installation break startup.
  }
}

/** Remembers what the library looked like, for the missing-data check. */
export function updateLibraryMarker(snippetCount: number, libraryCount: number): void {
  writeJson(MARKER_KEY, {
    snippetCount,
    libraryCount,
    updatedAt: new Date().toISOString(),
  } satisfies LibraryMarker);
}

/**
 * True when this machine previously had snippets but the database now has
 * none — the signature of Office clearing its webview storage. The caller
 * shows the restore banner; dismissing it re-stamps the marker.
 */
export function libraryLooksMissing(currentSnippetCount: number): LibraryMarker | null {
  const marker = readJson<LibraryMarker>(MARKER_KEY);
  if (marker && marker.snippetCount > 0 && currentSnippetCount === 0) {
    return marker;
  }
  return null;
}

/** The support bundle for the Copy diagnostics button. */
export function buildDiagnosticsReport(
  appVersion: string,
  counts: { libraries: number; snippets: number }
): string {
  const lines = [
    `ReportSnips diagnostics — ${new Date().toISOString()}`,
    `version: ${appVersion}`,
    `user agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "n/a"}`,
    `library: ${counts.libraries} libraries, ${counts.snippets} snippets`,
    "",
    "Recent errors (oldest first):",
    ...getDiagnostics().map((e) => `${e.at} [${e.source}] ${e.message}`),
  ];
  return lines.join("\n");
}

/** Clipboard write with a hidden-textarea fallback for older webviews. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
