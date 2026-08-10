import { describe, expect, it } from "vitest";
import { EXPORT_FORMAT_VERSION, type ExportBundle } from "../../src/models/entities";
import { fetchTeamBundle, isBundleNew } from "../../src/taskpane/state/teamLibrary";

const VALID_BUNDLE: ExportBundle = {
  formatVersion: EXPORT_FORMAT_VERSION,
  appVersion: "0.1.0",
  exportedAt: "2026-08-02T00:00:00.000Z",
  libraries: [],
  folders: [],
  snippets: [],
  tags: [],
};

function fakeFetch(status: number, body: string) {
  return () => Promise.resolve({ ok: status < 400, status, text: () => Promise.resolve(body) });
}

describe("fetchTeamBundle", () => {
  it("returns the bundle for a valid response", async () => {
    const result = await fetchTeamBundle(
      "https://x/b.json",
      fakeFetch(200, JSON.stringify(VALID_BUNDLE))
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.exportedAt).toBe(VALID_BUNDLE.exportedAt);
    }
  });

  it("maps network failure to a readable CORS/connectivity hint", async () => {
    const result = await fetchTeamBundle("https://x/b.json", () =>
      Promise.reject(new Error("boom"))
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/cross-origin|connection/i);
    }
  });

  it("maps HTTP errors to a readable message with the status", async () => {
    const result = await fetchTeamBundle("https://x/b.json", fakeFetch(404, "not found"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("404");
    }
  });

  it("maps invalid bundle content through parseBundle's readable errors", async () => {
    const result = await fetchTeamBundle("https://x/b.json", fakeFetch(200, "{not json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/isn't valid/);
    }
  });
});

describe("isBundleNew", () => {
  const bundle = { ...VALID_BUNDLE, exportedAt: "2026-08-02T00:00:00.000Z" };
  it("is new when never pulled", () => {
    expect(isBundleNew(bundle, null)).toBe(true);
  });
  it("is new when exported after the last pull", () => {
    expect(isBundleNew(bundle, "2026-08-01T00:00:00.000Z")).toBe(true);
  });
  it("is not new when already pulled", () => {
    expect(isBundleNew(bundle, "2026-08-02T00:00:00.000Z")).toBe(false);
    expect(isBundleNew(bundle, "2026-08-03T00:00:00.000Z")).toBe(false);
  });
});
