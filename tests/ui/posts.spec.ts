import { test, expect, Locator, Page } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";

const WEAVY_UI_URL = "http://localhost:5173/dev/pages/posts.html";
const timeout = 1500;

test("wy-posts is visible", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);
  await expect(page.locator("wy-posts")).toBeVisible();
});

test("posts editor and buttons are visible", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);
  await expect(page.locator("wy-editor")).toBeVisible();
  await expect(page.locator("wy-editor")).toHaveAttribute("placeholder", "Create a post...");

  await expect(page.locator("wy-editor").getByTitle("From device")).toBeVisible();
  await expect(page.locator("wy-editor").getByTitle("From cloud")).toBeVisible();
  await expect(page.locator("wy-editor").getByTitle("Poll")).toBeVisible();

  await expect(page.locator("wy-editor").getByTitle("Post")).toBeVisible();
});

test("create a post", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);

  const msg = uuidv4();
  await createAPost(page, msg);
  const post = await getPostByText(page, msg);
  await expect(post!).toBeVisible();

  await trashPostAsEndOfTest(page, post!); // "Delete" the test post TODO: Should do proper clean (or create a dynamic app for each test)
});

test("create a post and edit it", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);

  const msg = uuidv4();
  const editedMsg = "edited " + msg;
  await createAPost(page, msg);

  const postToEdit = await getPostByText(page, msg);
  expect(postToEdit != null).toBeTruthy();
  await postToEdit!.locator(".wy-item-actions").click();
  await postToEdit!.locator("wy-dropdown-item").getByText("Edit").locator("div").click();
  await postToEdit!.locator(".wy-post-editor-text").getByRole("textbox").fill(editedMsg);
  await postToEdit!.locator("wy-editor").getByTitle("Update").click();
  await page.waitForTimeout(timeout);
  await expect(page.locator(".wy-post").getByText(editedMsg)).toBeVisible();

  await trashPostAsEndOfTest(page, postToEdit!); // "Delete" the test post TODO: Should do proper clean (or create a dynamic app for each test)
});

test("create a post, trash it and undo", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);

  const msg = uuidv4();
  await createAPost(page, msg);

  // Trash the post
  const postToEdit = await getPostByText(page, msg);
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

  await trashPostAsEndOfTest(page, postToEdit!); // "Delete" the test post TODO: Should do proper clean (or create a dynamic app for each test)
});

test("comment on a post", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);
  const msg = uuidv4();
  await createAPost(page, msg);

  const post = await getPostByText(page, msg);
  expect(post != null).toBeTruthy();
  post!.getByText("0 comments").click();
  await expect(post!.getByText("Create a comment...")).toBeVisible();

  const commentTxt = uuidv4() + " - A comment by Playwright";
  await post!.locator(".wy-comment-editor").getByRole("textbox").fill(commentTxt);
  await post!.locator(".wy-comment-editor").getByTitle("Comment").click();
  await page.waitForTimeout(timeout);

  await expect(post!.locator("wy-comment-list")).toHaveCount(1);
  await expect(post!.locator("wy-comment-list").getByText(commentTxt)).toBeVisible();

  await trashPostAsEndOfTest(page, post!); // "Delete" the test post TODO: Should do proper clean (or create a dynamic app for each test)
});

// Try to find a post by it's text (could be multiple posts in the list).
async function getPostByText(page: Page, text: string): Promise<Locator | null> {
  for (const post of await page.locator(".wy-post").all()) {
    if ((await post.getByText(text).count()) == 1) {
      return post;
    }
  }
  return null;
}

async function createAPost(page: Page, text: string) {
  await page.locator(".wy-post-editor-text").getByRole("textbox").fill(text);
  await page.locator("wy-editor").getByTitle("Post").click();
  await page.waitForTimeout(timeout);
}

// Delete a post and all it's comments
async function trashPostAsEndOfTest(page: Page, post: Locator) {
  for (const comment of await post.locator("wy-comment").all()) {
    await comment.locator("wy-dropdown").click();
    await comment.getByText("Trash").click();
    await page.waitForTimeout(500);
  }

  await post!.locator(".wy-item-actions").click();
  await post.getByText("Trash", { exact: true }).click();
}
