/** Core loop: save, quick-queue, insert behavior, Quick Save, usage sort. */
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
    r.fulfill({ contentType: "application/javascript", body: paneStub() })
  );
  await page.goto(`${baseUrl}/taskpane.html`, { waitUntil: "load" });
  await page.waitForTimeout(1500);

  for (const name of ["First snippet", "Second snippet"]) {
    await page.getByRole("button", { name: "Save Selection" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("textbox", { name: "Name" }).fill(name);
    await page.getByRole("button", { name: "Save snippet" }).click();
    await page.waitForTimeout(500);
  }
  check(
    "two snippets saved via form",
    (await page.locator('button[aria-label^="Insert "]').count()) === 2
  );

  await page.locator('button[aria-label="Add First snippet to Queue"]').click();
  await page.waitForTimeout(400);
  const queueTab = await page.locator('[role="tab"]', { hasText: "Queue" }).innerText();
  check("Q button bumps the queue badge", queueTab.includes("1"));

  await page.evaluate(() => {
    window.__ops = [];
  });
  await page.locator('button[aria-label="Insert First snippet"]').click();
  await page.waitForTimeout(500);
  const ops = await page.evaluate(() => window.__ops);
  const textOps = ops.filter((o) => o.op === "text");
  check(
    "insert writes text then a trailing space",
    textOps.length >= 2 && textOps[textOps.length - 1].t === " "
  );
  check(
    "cursor lands at End",
    ops[ops.length - 1]?.op === "select" && ops[ops.length - 1]?.m === "End"
  );

  // Most-used sort: First snippet (1 insert) ranks above Second
  await page.locator('button[aria-label="Sort snippets"]').click();
  await page.waitForTimeout(300);
  await page.getByText("Most used").click();
  await page.waitForTimeout(500);
  const order = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button[aria-label^="Insert "]')).map((b) =>
      b.getAttribute("aria-label")
    )
  );
  check(
    "most-used sort ranks the inserted snippet first",
    order.indexOf("Insert First snippet") === 0
  );

  // Quick Save with Edit/Undo toast
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.waitForTimeout(400);
  await page.getByText("Quick Save (skip the form when saving a selection)").click();
  await page.waitForTimeout(300);
  await page.getByRole("tab", { name: "Browse" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Save Selection" }).click();
  await page.waitForTimeout(600);
  check("Quick Save toast appears", await page.getByText(/^Saved “/).isVisible());
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(500);
  check(
    "Undo removes the quick-saved snippet",
    (await page.locator('button[aria-label^="Insert Sample selection"]').count()) === 0
  );

  check("no page errors", errors.length === 0);
  await page.close();
}
