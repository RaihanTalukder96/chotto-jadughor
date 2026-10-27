import { test, expect } from "@playwright/test";
test("login, create product, find dashboard card, save estimate and download protected PDF", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Username", { exact: true })
    .fill(process.env.E2E_USERNAME ?? "admin");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD ?? "admin");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page
      .getByRole("heading", { name: "Set your new password" })
      .or(page.getByRole("link", { name: "Manage Product" })),
  ).toBeVisible();
  if (
    await page
      .getByRole("heading", { name: "Set your new password" })
      .isVisible()
  ) {
    await page
      .getByLabel("Current password")
      .fill(process.env.E2E_PASSWORD ?? "admin");
    await page
      .getByLabel("New password", { exact: true })
      .fill("E2e-Strong-Password-37!");
    await page
      .getByLabel("Confirm new password")
      .fill("E2e-Strong-Password-37!");
    await page.getByRole("button", { name: "Save password" }).click();
    await page.getByLabel("Username", { exact: true }).fill("admin");
    await page
      .getByLabel("Password", { exact: true })
      .fill("E2e-Strong-Password-37!");
    await page.getByRole("button", { name: "Sign in to workspace" }).click();
  }
  await page.getByRole("link", { name: "Manage Product" }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  const key = "E2E-" + Date.now();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("শিশুর নরম পোশাক " + key);
  await page.getByLabel("Product ID", { exact: true }).fill(key);
  await page.getByLabel("SKU", { exact: true }).fill(key);
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "Clothing" });
  await page.getByLabel("Buying price").fill("100.10");
  await page.getByLabel("Minimum selling price").fill("150.30");
  await page.getByLabel("Maximum selling price").fill("200.50");
  await page.getByLabel("Opening stock").fill("10");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.getByLabel("Search products").fill(key);
  await expect(
    page.getByRole("heading", { name: "শিশুর নরম পোশাক " + key }),
  ).toBeVisible();
  await page.screenshot({
    path: ".local/qa/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).toBeHidden();
  await page.screenshot({
    path: ".local/qa/dashboard-mobile.png",
    fullPage: true,
  });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "Profit Calculation" }).click();
  await page.getByLabel("Calculation title").fill("Browser verified " + key);
  await page.getByLabel("Find calculation products").fill(key);
  await page
    .getByRole("button")
    .filter({ hasText: "শিশুর নরম পোশাক " + key })
    .click();
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await page.getByRole("button", { name: "Save immutable report" }).click();
  await expect(
    page.getByRole("heading", { name: "Saved calculation snapshot" }),
  ).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await download.saveAs(".local/qa/workflow-report.pdf");
  await page.screenshot({
    path: ".local/qa/calculation-desktop.png",
    fullPage: true,
  });
});
