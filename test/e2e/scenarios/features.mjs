/** Feature toggles, stale review UI, team library flow, bad-import handling. */
import { paneStub } from "../stub.mjs";

const TEAM_BUNDLE = {
  formatVersion: 1,
  appVersion: "0.1.0",
  exportedAt: "2026-08-02T12:00:00.000Z",
  libraries: [
    {
      id: "team-lib-1",
      name: "Team Shared",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  folders: [],
  snippets: [
    {
      id: "team-snip-1",
      name: "Team boilerplate",
      content: "Standard team wording.",
      tagIds: [],
      memberships: [{ libraryId: "team-lib-1", folderId: null }],
      history: [],
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  tags: [],
};

export async function run({ context, baseUrl, check }) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => {
    if (!/ResizeObserver/.test(e.message)) {
      errors.push(e.message);
    }
  });
  await page.route("**/office.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: paneStub() })
  );
  await page.route("https://team.example.com/**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify(TEAM_BUNDLE) })
  );
  await page.goto(`${baseUrl}/taskpane.html`, { waitUntil: "load" });
  await page.waitForTimeout(1500);

  // Save one snippet so toggles have something to act on
  await page.getByRole("button", { name: "Save Selection" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("textbox", { name: "Name" }).fill("Toggle target");
  await page.getByRole("button", { name: "Save snippet" }).click();
  await page.waitForTimeout(500);

  await page.getByRole("tab", { name: "Settings" }).click();
  await page.waitForTimeout(400);

  // Queue toggle hides tab + Q buttons
  await page.getByText("Queue (staging list, Q buttons, Queue tab)").click();
  await page.waitForTimeout(400);
  check(
    "queue toggle hides the Queue tab",
    (await page.getByRole("tab", { name: "Queue" }).count()) === 0
  );
  await page.getByRole("tab", { name: "Browse" }).click();
  await page.waitForTimeout(300);
  check(
    "queue toggle hides Q buttons",
    (await page.locator('button[aria-label$="to Queue"]').count()) === 0
  );
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.waitForTimeout(300);
  await page.getByText("Queue (staging list, Q buttons, Queue tab)").click();
  await page.waitForTimeout(300);

  // Frecency toggle removes usage sorts
  await page.getByText("Usage sorting (count inserts, sort by Recently/Most used)").click();
  await page.waitForTimeout(300);
  await page.getByRole("tab", { name: "Browse" }).click();
  await page.waitForTimeout(300);
  await page.locator('button[aria-label="Sort snippets"]').click();
  await page.waitForTimeout(300);
  check("frecency toggle hides usage sorts", (await page.getByText("Most used").count()) === 0);
  await page.keyboard.press("Escape");

  // Stale review: enable, thresholds appear, dialog opens on a fresh library
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.waitForTimeout(300);
  await page.getByText("Flag stale snippets for review").click();
  await page.waitForTimeout(400);
  check("stale thresholds appear", (await page.getByRole("spinbutton").count()) >= 2);
  await page.getByRole("button", { name: /Review stale snippets/ }).click();
  await page.waitForTimeout(400);
  check(
    "stale review dialog opens",
    await page
      .getByText(/Review stale snippets/)
      .first()
      .isVisible()
  );
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(300);

  // Team library: hidden until enabled, then full pull flow
  check(
    "team section hidden by default",
    (await page.getByText("Shared bundle URL").count()) === 0
  );
  await page.getByText("Team library (pull shared snippets from a URL)").click();
  await page.waitForTimeout(400);
  await page
    .getByPlaceholder("https://…/reportsnips-export.json")
    .fill("https://team.example.com/export.json");
  await page.getByRole("button", { name: "Save URL" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Check for updates" }).click();
  await page.waitForTimeout(1000);
  check("team pull preview opens", await page.getByText(/1 new snippet/).isVisible());
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.waitForTimeout(800);
  check(
    "team pull completes with notice",
    await page.getByText(/Pulled the team library/).isVisible()
  );

  // Bad import: readable error, no crash
  await page
    .locator('button[aria-label="Dismiss"]')
    .first()
    .click()
    .catch(() => undefined);
  await page.getByRole("button", { name: "Import…" }).click();
  await page.waitForTimeout(300);
  // Two ImportDialogs render hidden inputs (manual + team pull); the manual one renders first.
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{not json"),
    });
  await page.waitForTimeout(600);
  const body = await page.evaluate(() => document.body.innerText);
  check("bad import shows a readable error", /isn't|invalid|couldn't|JSON/i.test(body));

  // Data-loss guard: wipe IndexedDB (as Office storage-clearing would) and
  // reload — the missing-library banner must appear instead of a silent
  // fresh pane, and Copy diagnostics must produce a report.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.deleteDatabase("reportsnips");
        req.onsuccess = req.onerror = req.onblocked = () => resolve(null);
      })
  );
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(1800);
  check(
    "storage eviction shows the missing-library banner",
    await page.getByText(/library appears to be missing/).isVisible()
  );
  await page.getByRole("button", { name: "Restore from backup…" }).click();
  await page.waitForTimeout(400);
  check("Restore opens the import flow", (await page.locator('input[type="file"]').count()) > 0);

  check("no page errors", errors.length === 0);
  await page.close();
}
