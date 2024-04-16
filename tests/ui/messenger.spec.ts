import { test, expect } from "@playwright/test";

const WEAVY_UI_URL = "http://localhost:5173/dev/pages/messenger.html";

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

test("test new conversion button", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);
  const btn = page.locator("wy-conversation-new").locator("wy-button");
  console.log("BTN: " + btn);
  await btn.click();
  await expect(page.locator("wy-portal").getByText("New conversation")).toBeVisible();
});
