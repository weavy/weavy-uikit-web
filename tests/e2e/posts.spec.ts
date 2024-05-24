import { test, expect, Locator, Page } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";

const WEAVY_UI_URL = "http://localhost:5173/dev/pages/posts.html";
const timeout = 1500;

test("wy-posts is visible", async ({ page }) => {
  await page.goto(getURLwAppId());
  await expect(page.locator("wy-posts")).toBeVisible();
});

test("posts editor and buttons are visible", async ({ page }) => {
  await page.goto(getURLwAppId());
  await expect(page.locator("wy-editor")).toBeVisible();
  await expect(page.locator("wy-editor")).toHaveAttribute("placeholder", "Create a post...");

  await expect(page.getByTitle('From device').getByRole('button')).toBeVisible();
  await expect(page.getByTitle('From cloud').getByRole('button')).toBeVisible();
  await expect(page.getByTitle("Poll").getByRole('button')).toBeVisible();

  await expect(page.locator("wy-editor").getByTitle("Post")).toBeVisible();
});

test("create a post", async ({ page }) => {
  await page.goto(getURLwAppId());

  const msg = uuidv4();
  await createAPost(page, msg);
  const post = await getFirstPost(page);
  await expect(post!).toBeVisible();
});

test("create a post and edit it", async ({ page }) => {
  await page.goto(getURLwAppId());

  const msg = uuidv4();
  const editedMsg = "edited " + msg;
  await createAPost(page, msg);

  const postToEdit = await getFirstPost(page);
  expect(postToEdit != null).toBeTruthy();
  await postToEdit!.locator(".wy-item-actions").click();
  await postToEdit!.locator("wy-dropdown-item").getByText("Edit").locator("div").click();
  await postToEdit!.locator(".wy-post-editor-text").getByRole("textbox").fill(editedMsg);
  await postToEdit!.locator("wy-editor").getByTitle("Update").click();
  await page.waitForTimeout(timeout);
  await expect(page.locator(".wy-post").getByText(editedMsg)).toBeVisible();
});

test("create a post, trash it and undo", async ({ page }) => {
  await page.goto(getURLwAppId());

  const msg = uuidv4();
  await createAPost(page, msg);

  // Trash the post
  const postToEdit = await getFirstPost(page);
  expect(postToEdit != null).toBeTruthy();
  await postToEdit!.locator(".wy-item-actions").click();
  await postToEdit!.locator("wy-dropdown-item").getByText("Trash").locator("div").click();
  await page.waitForTimeout(timeout);

  // Verify ui is correct after trash
  await expect(page.getByText(msg)).toBeHidden();
  await expect(page.getByText("Post was trashed")).toBeVisible();
  await expect(page.locator("wy-button").getByText("Undo")).toBeVisible();

  // Undo it
  await page.locator("wy-button").getByText("Undo").click();
  await page.waitForTimeout(timeout);

  // Verify ui is correct
  await expect(page.locator(".wy-post").getByText(msg)).toBeVisible();
  await expect(page.getByText("Post was trashed")).toBeHidden();
  await expect(page.locator("wy-button").getByText("Undo")).toBeHidden();
});

test("comment on a post", async ({ page }) => {
  await page.goto(getURLwAppId());
  const msg = uuidv4();
  await createAPost(page, msg);

  const post = await getFirstPost(page);
  expect(post != null).toBeTruthy();
  
  // getByText was flaky, seems like the button text can include whitespaces (for padding?), hence we need to find the button by traversing elements
  const btn = post!.locator(".wy-post-footer").locator("wy-button").first();
  expect(await btn.textContent()).toContain("0 comments")
  await btn.click();
  await page.waitForTimeout(timeout);
  await expect(post!.getByPlaceholder("Create a comment...")).toBeVisible();

  const commentTxt = uuidv4() + " - A comment by Playwright";
  await post!.locator(".wy-comment-editor").getByRole("textbox").fill(commentTxt);
  await post!.locator(".wy-comment-editor").getByTitle("Comment").getByRole("button").click();
  await page.waitForTimeout(timeout);

  await expect(post!.locator("wy-comment-list")).toHaveCount(1);
  await expect(post!.locator("wy-comment-list").getByText(commentTxt)).toBeVisible();
});

// Returns a url to the Weavy UI + adds a unique appUId+userId as query-parameter (uses the same id for app and user for easier debugging in db)
function getURLwAppId() {
  const uniqueID = uuidv4();
  return `${WEAVY_UI_URL}?appUID=${uniqueID}`;
}

async function getFirstPost(page: Page): Promise<Locator | null> {
  return page.locator("wy-post").first();
}

async function createAPost(page: Page, text: string) {
  await page.locator(".wy-post-editor-text").getByRole("textbox").fill(text);
  await page.locator("wy-editor").getByTitle("Post").click();
  await page.waitForTimeout(timeout);
}