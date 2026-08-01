import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Guards the M0 manifest contract: correct branding, Word host, HTTPS-only URLs.
describe("manifest.xml", () => {
  const manifest = readFileSync(join(__dirname, "..", "manifest.xml"), "utf8");

  it("is a task pane add-in named ReportSnips", () => {
    expect(manifest).toContain('xsi:type="TaskPaneApp"');
    expect(manifest).toContain('<DisplayName DefaultValue="ReportSnips"/>');
  });

  it("targets the Word host only", () => {
    expect(manifest).toContain('<Host Name="Document"/>');
    expect(manifest).not.toContain('<Host Name="Mailbox"');
    expect(manifest).not.toContain('<Host Name="Workbook"');
  });

  it("contains no leftover template placeholders", () => {
    expect(manifest).not.toMatch(/contoso/i);
    expect(manifest).not.toMatch(/sample add-in/i);
  });

  it("uses https URLs exclusively for resources", () => {
    const urls = (manifest.match(/DefaultValue="(https?:[^"]*)"/g) ?? []).map((m) =>
      m.replace(/^DefaultValue="/, "").replace(/"$/, "")
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\//);
    }
  });
});
