/** Rich text: OOXML capture + insert, placeholder fallback, toggle off. */
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
      body: paneStub({ selectionText: "Rich formatted body." }),
    })
  );
  await page.goto(`${baseUrl}/taskpane.html`, { waitUntil: "load" });
  await page.waitForTimeout(1500);

  await page.getByRole("tab", { name: "Settings" }).click();
  await page.waitForTimeout(400);
  await page.getByText("Rich text snippets (experimental — keep Word formatting)").click();
  await page.waitForTimeout(300);
  await page.getByRole("tab", { name: "Browse" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "Save Selection" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("textbox", { name: "Name" }).fill("Rich one");
  await page.getByRole("button", { name: "Save snippet" }).click();
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.__seltext = "Visit [Site Name] soon.";
  });
  await page.getByRole("button", { name: "Save Selection" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("textbox", { name: "Name" }).fill("Placeholder one");
  await page.getByRole("button", { name: "Save snippet" }).click();
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.__ops = [];
  });
  await page.locator('button[aria-label="Insert Rich one"]').click();
  await page.waitForTimeout(500);
  let ops = await page.evaluate(() => window.__ops);
  check(
    "rich snippet inserts as OOXML",
    ops.some((o) => o.op === "ooxml" && o.x.includes("Rich formatted body."))
  );

  await page.evaluate(() => {
    window.__ops = [];
  });
  await page.locator('button[aria-label="Insert Placeholder one"]').click();
  await page.waitForTimeout(400);
  await page.getByRole("textbox", { name: "Site Name" }).fill("HQ");
  await page.getByRole("button", { name: "Insert" }).click();
  await page.waitForTimeout(600);
  ops = await page.evaluate(() => window.__ops);
  check(
    "placeholder snippet falls back to resolved text",
    ops.some((o) => o.op === "text" && o.t.includes("Visit HQ soon.")) &&
      !ops.some((o) => o.op === "ooxml")
  );

  await page.getByRole("tab", { name: "Settings" }).click();
  await page.waitForTimeout(300);
  await page.getByText("Rich text snippets (experimental — keep Word formatting)").click();
  await page.waitForTimeout(300);
  await page.getByRole("tab", { name: "Browse" }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__ops = [];
  });
  await page.locator('button[aria-label="Insert Rich one"]').click();
  await page.waitForTimeout(500);
  ops = await page.evaluate(() => window.__ops);
  check(
    "toggle off reverts to plain text",
    ops.some((o) => o.op === "text" && o.t.includes("Rich formatted body.")) &&
      !ops.some((o) => o.op === "ooxml")
  );

  check("no page errors", errors.length === 0);
  await page.close();
}
