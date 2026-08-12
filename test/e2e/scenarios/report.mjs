/** Report generation: placeholder dialog, missing-marker skip, table/paragraph writes. */
import { paneStub } from "../stub.mjs";

export async function run({ context, baseUrl, check }) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => {
    if (!/ResizeObserver/.test(e.message)) {
      errors.push(e.message);
    }
  });
  await page.route("**/office.js", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: paneStub({
        selectionText: "Issue at the [Client] site.",
        docBody: "Report intro {{Queue}} report end",
      }),
    })
  );
  await page.goto(`${baseUrl}/taskpane.html`, { waitUntil: "load" });
  await page.waitForTimeout(1500);

  for (const name of ["Broken door", "No cameras"]) {
    await page.getByRole("button", { name: "Save Selection" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("textbox", { name: "Name" }).fill(name);
    await page.getByRole("button", { name: "Save snippet" }).click();
    await page.waitForTimeout(500);
    await page.locator(`button[aria-label="Add ${name} to Queue"]`).click();
    await page.waitForTimeout(300);
  }

  // Second section with no matching {{Extra}} marker
  await page.getByRole("tab", { name: "Queue" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Add section" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("textbox", { name: "Section name" }).fill("Extra");
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("tab", { name: "Browse" }).click();
  await page.waitForTimeout(300);
  await page.locator('button[aria-label="Actions for Broken door"]').click();
  await page.waitForTimeout(300);
  await page.getByText("Add to Queue").click();
  await page.waitForTimeout(300);
  await page.getByRole("menuitem", { name: "Extra" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("tab", { name: "Queue" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForTimeout(600);
  check(
    "one placeholder dialog before generation",
    await page.getByRole("textbox", { name: "Client" }).isVisible()
  );
  await page.getByRole("textbox", { name: "Client" }).fill("Acme HQ");
  await page.getByRole("button", { name: "Insert" }).click();
  await page.waitForTimeout(700);
  check(
    "missing-marker dialog lists {{Extra}}",
    await page.getByText(/no matching marker/i).isVisible()
  );
  await page.getByRole("button", { name: "Generate anyway" }).click();
  await page.waitForTimeout(700);

  const ops = await page.evaluate(() => window.__ops);
  const table = ops.find((o) => o.op === "table");
  check("table written at the {{Queue}} marker", table?.marker === "{{Queue}}");
  check(
    "table rows in order with resolved placeholder",
    JSON.stringify(table?.values) ===
      JSON.stringify([
        ["Broken door", "Issue at the Acme HQ site."],
        ["No cameras", "Issue at the Acme HQ site."],
      ])
  );
  check(
    "result notice reports filled + skipped",
    await page.getByText(/Report generated: 1 section filled, 1 skipped/).isVisible()
  );

  // Builder button opens the dialog window at builder.html
  await page.getByRole("button", { name: "Builder…" }).click();
  await page.waitForTimeout(400);
  const dialogUrl = await page.evaluate(() => window.__dialogUrl);
  check("Builder opens the dialog at builder.html", (dialogUrl ?? "").includes("builder.html"));

  check("no page errors", errors.length === 0);
  await page.close();
}
