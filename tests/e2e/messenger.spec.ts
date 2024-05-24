import { test, expect } from "@playwright/test";

const WEAVY_UI_URL = "http://localhost:5173/dev/pages/messenger.html";
const timeout = 1000;

test("wy-messenger is visible", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);
  await expect(page.locator("wy-messenger")).toBeVisible();
});

test("messenger appbar is visible", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);
  await expect(page.locator("wy-conversation-list")).toBeVisible();

  const elemList = page.locator("wy-conversation-list");
  await expect(elemList.filter({ has: page.locator("wy-avatar") })).toBeVisible();

  await expect(elemList.filter({ has: page.locator("wy-conversation-new") })).toBeVisible();
});

test("test new conversion dialog", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);
  const btn = page.locator("wy-conversation-new").getByRole("button");
  await btn.click();

  // Verify the dialog looks as expected, at least 2 preconfigued users are available etc.
  const userSearch = page.locator("wy-users-search");
  await expect(page.getByText("New conversation")).toBeVisible();
  await expect(userSearch.getByPlaceholder("Search...")).toBeVisible();
  await expect(userSearch.locator("wy-icon").and(userSearch.locator("[name='magnify']"))).toBeAttached();
  await page.waitForTimeout(timeout);
  expect(await userSearch.locator(".wy-item").count()).toBeGreaterThanOrEqual(2);

  // Add one user and make sure icon is checked
  const username = await page.locator(".wy-item > .wy-item-body").first().textContent();
  await page.locator(".wy-item > wy-icon > svg").first().click();
  await expect(page.locator(".wy-item > wy-icon").first()).toHaveAttribute("name", "checkbox-marked");

  // Search for user and verify it's the only one showing and is checked
  await userSearch.getByPlaceholder("Search...").fill(username!);
  //await expect(userSearch.locator(".wy-item-body").count()).toBeGreaterThanOrEqual(1); // Fails if multiple users with same name exist
  //await expect(userSearch.locator(".wy-item-body").getByText(username!)).toBeVisible();
  await expect(userSearch.locator(".wy-item > wy-icon").first()).toHaveAttribute("name", "checkbox-marked");

  // Search for "odefinierad" and verify 0 rows are visible below "People"
  await userSearch.getByPlaceholder("Search...").fill("odefinierad");
  await userSearch.getByPlaceholder("Search...").dispatchEvent("change");
  await expect(userSearch.locator(".wy-pane-group").nth(2).locator(".wy-item-body")).toHaveCount(0);
  await expect(userSearch.getByText("Your search did not match any people")).toBeVisible();

  // Click the search reset button and verify everything looks as expected
  const btnReset = page.locator('wy-users-search').getByRole('button').first();
  await expect(btnReset).toBeVisible();
  await expect(btnReset).toHaveAttribute("type", "reset");
  await btnReset.click();
  await page.waitForTimeout(timeout);

  expect(await userSearch.locator(".wy-item").count()).toBeGreaterThanOrEqual(3);
});
