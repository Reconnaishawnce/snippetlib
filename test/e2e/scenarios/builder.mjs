/** The builder window: hash outline, library browse, add, save handoff, width guard. */
import { builderStub, paneStub } from "../stub.mjs";

export async function run({ context, baseUrl, check }) {
  // Seed the shared IndexedDB through the pane, including one monster snippet.
  const pane = await context.newPage();
  await pane.route("**/office.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: paneStub() })
  );
  await pane.goto(`${baseUrl}/taskpane.html`, { waitUntil: "load" });
  await pane.waitForTimeout(1500);
  for (const [name, text] of [
    ["Door defect", null],
    ["Monster", `LONGWORD_${"x".repeat(800)} tail`],
  ]) {
    if (text) {
      await pane.evaluate((t) => {
        window.__seltext = t;
      }, text);
    }
    await pane.getByRole("button", { name: "Save Selection" }).click();
    await pane.waitForTimeout(400);
    await pane.getByRole("textbox", { name: "Name" }).fill(name);
    await pane.getByRole("button", { name: "Save snippet" }).click();
    await pane.waitForTimeout(500);
  }
  await pane.close();

  const initial = {
    sections: [{ id: "sec-1", name: "HIGH Vulnerabilities", sortOrder: 0, items: [] }],
  };
  const page = await context.newPage();
  await page.setViewportSize({ width: 900, height: 700 });
  const errors = [];
  page.on("pageerror", (e) => {
    if (!/ResizeObserver/.test(e.message)) {
      errors.push(e.message);
    }
  });
  await page.route("**/office.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: builderStub() })
  );
  await page.goto(`${baseUrl}/builder.html#state=${encodeURIComponent(JSON.stringify(initial))}`, {
    waitUntil: "load",
  });
  await page.waitForTimeout(1500);

  check(
    "outline loads from the URL hash",
    (await page.locator('input[aria-label="Section name"]').first().inputValue()) ===
      "HIGH Vulnerabilities"
  );
  check("library snippets listed", (await page.getByText("Door defect").count()) > 0);

  // No horizontal overflow, even with the monster snippet on screen
  const w = await page.evaluate(() => ({
    scroll: document.body.scrollWidth,
    inner: window.innerWidth,
  }));
  check("no horizontal overflow with long content", w.scroll <= w.inner);

  await page.locator('button[aria-label="Add Door defect to outline"]').click();
  await page.waitForTimeout(300);
  await page.getByPlaceholder("New section name").fill("Recommendations");
  await page.getByRole("button", { name: "Add section" }).click();
  await page.waitForTimeout(300);

  await page.getByPlaceholder("Search snippets").fill("monster");
  await page.waitForTimeout(400);
  check(
    "search narrows the library",
    (await page.locator('button[aria-label^="Add "][aria-label$="to outline"]').count()) === 1
  );

  await page.getByRole("button", { name: "Save to queue" }).click();
  await page.waitForTimeout(400);
  const msg = await page.evaluate(() => window.__msg);
  const parsed = msg ? JSON.parse(msg) : null;
  check("save hands back two sections", parsed?.sections?.length === 2);
  check("existing section id survives the round-trip", parsed?.sections?.[0]?.id === "sec-1");
  check("added item present", parsed?.sections?.[0]?.items?.length === 1);

  check("no page errors", errors.length === 0);
  await page.close();
}
