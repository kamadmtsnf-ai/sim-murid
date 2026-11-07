/** Exercise the real Radix confirmation instead of intercepting window.confirm. */
export async function chooseConfirmation(page, accept = true) {
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.locator(`[data-confirm-action="${accept ? "accept" : "cancel"}"]`).click();
  // Wait for unmount/restore-focus before touching the form behind the modal.
  await dialog.waitFor({ state: "detached" });
  // Resolution resumes the caller after unmount; allow its React update to commit.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
