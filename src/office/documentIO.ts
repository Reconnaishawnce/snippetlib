/**
 * The Office boundary (TECH_PLAN.md §6): the ONLY file allowed to call
 * Word.run / Office.context. Everything above it is unit-testable with a mock.
 *
 * Surface grows by milestone: getSelectedText (M2), insertText + doc settings (M4).
 */
/* global Word */

/** Returns the text of the current selection ("" when the cursor is collapsed). */
export async function getSelectedText(): Promise<string> {
  return Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load("text");
    await context.sync();
    return selection.text;
  });
}
