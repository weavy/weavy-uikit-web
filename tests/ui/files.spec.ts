import { test, expect, Page } from "@playwright/test";
import { Buffer } from "buffer";
import { v4 as uuidv4 } from "uuid";

test.describe.configure({ mode: "serial" });

// Localhost
const WEAVY_UI_URL = "http://localhost:5173/dev/pages/files.html";

test("wy-files is visible", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);
  await expect(page.locator("wy-files")).toBeVisible();
});

test("wy-files app-bar is ok", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);

  await expect(page.locator("wy-files-appbar")).toBeVisible();

  await expect(page.getByTitle("Add files").and(page.locator("wy-dropdown"))).toBeVisible();
  await expect(page.getByTitle("Sort items by").and(page.locator("wy-dropdown"))).toBeVisible();
  await expect(page.getByTitle("View options").and(page.locator("wy-dropdown"))).toBeVisible();
});

test("upload a text-file and preview it", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);

  // Upload a file
  const filename = uuidv4() + ".txt";
  const content = `Some content in the ${filename} file`;
  uploadFile({ page, fileName: filename, content });

  // Verify the file exists and can be previewed
  const elemFile = page.getByText(filename);
  await expect(elemFile).toBeVisible();
  await elemFile.click();
  await expect(page.getByText(content)).toBeVisible();
});

/*
test("test sorting by col headers", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);

  // Upload a file and verify it is visible
  const fileA = "AFile.txt";
  await uploadFile(page, fileA, "Text in fileA");
  await expect(page.getByText(fileA)).toBeVisible();

  // Upload second file and verify it
  const fileZ = "ZFile.txt";
  await uploadFile(
    page,
    fileZ,
    "content in ZFile.txt. More text so it can be sorted by size. 123456789012345678901234567890"
  );
  await expect(page.getByText(fileZ)).toBeVisible();

  // Sort by name by clicking Name table header
  const nameHeader = page.locator(".wy-table-sort-link", { hasText: "Name" });
  const files = page.locator("wy-files-list").locator("tbody").locator("tr");
  await expect(nameHeader).toBeVisible();

  // Verify ZFile is first
  await nameHeader.click();
  await expect(files.first().getByText(fileZ)).toBeVisible();

  // Verify AFile is first after resort
  await nameHeader.click();
  await expect(files.first().getByText(fileA)).toBeVisible();

  // Click Modified table header
  const modHeader = page.locator(".wy-table-sort-link", { hasText: "Modified" });
  await expect(modHeader).toBeVisible();
  await modHeader.click();

  // Verify AFile is first (first to be uploaded, sorted ASC)
  await expect(files.first().getByText(fileA)).toBeVisible();

  // Verify ZFile is first after resort (last to be uploaded, sorted DESC)
  await modHeader.click();
  await expect(files.first().getByText(fileZ)).toBeVisible();

  // Click Size table header
  const sizeHeader = page.locator(".wy-table-sort-link", { hasText: "Size" });
  await expect(sizeHeader).toBeVisible();
  await sizeHeader.click();

  // Verify AFile is first (smallest, sorted ASC)
  await expect(files.first().getByText(fileA)).toBeVisible();

  // Verify ZFile is first after resort (largest, sorted DESC)
  await sizeHeader.click();
  await expect(files.first().getByText(fileZ)).toBeVisible();
});*/

test("sort by name from menu", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);
  await sortFromMenu(page, "Name");
});

test("sort by size from menu", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);
  await sortFromMenu(page, "Size");
});

test("sort by modified from menu", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);
  await sortFromMenu(page, "Modified");
});

async function sortFromMenu(page: Page, sortOption: string) {
  // Upload first file
  const fileA =`A_${uuidv4()}.txt`;
  await uploadFile({ page, fileName: fileA, content: "Text in file 1" });
  await expect(page.getByText(fileA)).toBeVisible();

  // Upload second file and verify it's visible
  const fileZ = `Z_${uuidv4()}.txt`;
  await uploadFile({
    page,
    fileName: fileZ,
    content:
      "Textcontent with some random text so it can be sorted by size. 123456789012345678901234567890123456789012345678901234567890",
  });
  await expect(page.getByText(fileZ)).toBeVisible();

  // Click sortOption (asc is default)
  const elemSortMenu = page.locator("wy-dropdown").getByTitle("Sort items by");
  await elemSortMenu.click();
  const elemItem =page.locator("wy-dropdown-option").getByText(sortOption).locator("div");
  await elemItem.click();
  
  // TODO - Try filelist.updateComplete instead of fixed timeout?
  await page.waitForTimeout(500);
  await expect(page.locator("wy-files-list")).toBeVisible();
  await expect(page.getByText(fileA)).toBeVisible(); // Wait for table to re-render and elems stable and visible

  // Verify sortOption is selected
  await elemSortMenu.click();
  await expect(page.locator("wy-dropdown-option").getByText(sortOption)).toHaveAttribute("selected", "");
  await expect(page.getByText(fileA)).toBeVisible();
  await elemSortMenu.click(); // Hide menu

  //Verify AFile is first (sorted asc)
  let fileAIndex = await getFileRowIndex({ page, filename: fileA });
  let fileZIndex = await getFileRowIndex({ page, filename: fileZ });
  expect(fileAIndex).toBeLessThan(fileZIndex);

  // Sort desc
  await page.locator("wy-dropdown").getByTitle("Sort items by").click();
  let el = page.locator("wy-dropdown-option").getByText("Descending").locator("div");
  await el.click();
  // TODO
  await page.waitForTimeout(750);
  await expect(page.locator("wy-files-list")).toBeVisible();
  await expect(page.getByText(fileA)).toBeVisible(); // Wait for table to re-render and elems stable and visible

  await elemSortMenu.click();
  el = page.locator("wy-dropdown-option").getByText("Descending");
  await expect(el).toBeVisible();
  await expect(el).toHaveAttribute("selected");
  await elemSortMenu.click(); // Hide menu*/

  //Verify ZFile is first (sorted desc)
  fileAIndex = await getFileRowIndex({ page, filename: fileA });
  fileZIndex = await getFileRowIndex({ page, filename: fileZ });
  await expect(page.getByText(fileZ)).toBeVisible();
  expect(fileZIndex).toBeLessThan(fileAIndex);
}

async function getFileRowIndex({ page, filename }: { page: Page; filename: string }): Promise<number> {
  const files = page.locator("wy-files-list").locator("tbody").locator("tr");
  const rowCount = await files.count();

  for (let i = 0; i < rowCount; i++) {
    const text = await files.nth(i).locator("td").nth(1).innerText();
    if (text?.includes(filename)) {
      return i;
    }
  }

  return 0;
}

test("trash, restore and delete a file", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);

  // Make sure trashed files are not shown
  const elemOptionsMenu = page.getByTitle("View options").and(page.locator("wy-dropdown"));
  await expect(elemOptionsMenu).toBeVisible();
  await elemOptionsMenu.click();
  await elemOptionsMenu.getByText("Hide trashed").locator("div").click();
  
  // Upload a file if needed and verify it is visible
  const count = await page.locator("wy-files-list").locator("tbody").locator("tr").count();
  if (count == 0) {
    const filename = "AFile.txt";
    await uploadFile({ page, fileName: filename, content: "Some text content" });
    await expect(page.getByText(filename)).toBeVisible();
  } 
  
  // Store some refs to the first file in the list that will be used for the test
  const firstFile = page.locator("wy-files-list").locator("tbody").locator("tr").first();
  const filename = await firstFile.locator("td").nth(1).textContent();
  
  // Click Trash in the first file's specific side menu
  let elemSideMenu = firstFile.locator("wy-file-menu");
  await expect(elemSideMenu).toBeVisible();
  await elemSideMenu.click();
  let elemItem = elemSideMenu.getByText("Trash").and(page.locator("wy-dropdown-item"));
  await expect(elemItem).toBeVisible();
  await elemItem.click();

  // Verify the file is not visible
  await page.waitForTimeout(500);
  await expect(page.locator("wy-files-list").getByText(filename!)).toBeHidden();

  // Show trashed files
  await elemOptionsMenu.click();
  await elemOptionsMenu.getByText("Show trashed").locator("div").click();
  await page.waitForTimeout(500);

  // Verify the file is visible and has strike through
  let row = page.locator("tr", { has: page.locator(`text="${filename}"`) });
  await expect(row).toBeVisible();
  await expect(row).toHaveClass(/wy-table-trashed/);

  // Restore it
  elemSideMenu = row.locator("wy-file-menu");
  await elemSideMenu.click();
  elemItem = elemSideMenu.getByText("Restore").and(page.locator("wy-dropdown-item"));
  await expect(elemItem).toBeVisible();
  await elemItem.click();

  await page.waitForTimeout(500);
  //const row = page.locator("wy-files-list").getByText(filename!).locator("..")
  row = page.locator("tr", { has: page.locator(`text="${filename}"`) });
  await expect(row).toBeVisible();
  const list =await row.getAttribute("class");
  expect(list?.includes("wy-table-trashed") ).toBeFalsy();

  // Trash and delete it
  elemSideMenu = row.locator("wy-file-menu");
  await elemSideMenu.click();
  elemItem = elemSideMenu.getByText("Trash").and(page.locator("wy-dropdown-item"));
  await elemItem.click();
  await page.waitForTimeout(500);
  row = page.locator("tr", { has: page.locator(`text="${filename}"`) });
  await expect(row).toBeVisible();
  
  elemSideMenu = row.locator("wy-file-menu");
  await elemSideMenu.click();
  elemItem = elemSideMenu.getByText("Delete").and(page.locator("wy-dropdown-item"));
  await elemItem.click();
  await page.waitForTimeout(500);
  await expect(page.locator("wy-files-list").getByText(filename!)).toBeHidden();
});

test("test upload multiple files", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);

  const elemMenu = page.getByTitle("Add files").and(page.locator("wy-dropdown"));
  await elemMenu.click();
  const elemFromDevice = elemMenu.getByText("From device");
  await expect(elemFromDevice).toBeVisible();
  await elemFromDevice.click();

  await page.getByTestId("uploadFile").setInputFiles([
    { name: "file1", mimeType: "text/plain", buffer: Buffer.from("content1") },
    { name: "file2", mimeType: "text/plain", buffer: Buffer.from("content2") },
    { name: "file3", mimeType: "text/plain", buffer: Buffer.from("content3") },
  ]);

  await expect(page.getByText("file1")).toBeVisible();
  await expect(page.getByText("file2")).toBeVisible();
  await expect(page.getByText("file3")).toBeVisible();
});

test("test download", async ({ page }) => {
  await page.goto(WEAVY_UI_URL);

  // Check if file(s) already exist, otherwise upload 1 file.
  const files = await page.locator("wy-files-list").locator("tbody").locator("tr").count();
  if (files == 0) {
    await uploadFile({ page, fileName: "AFile.txt", content: "Some text content" });
  }
  
  // Get first file's side menu
  const elemSideMenu = page.locator("wy-file-menu").first();
  await expect(elemSideMenu).toBeVisible();
  await elemSideMenu.click();
  const elemItem = elemSideMenu.getByText("Download");
  await expect(elemItem).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await elemItem.click();
  const path = await (await downloadPromise).path();
  expect(path.length > 0).toBeTruthy();
});

async function uploadFile({
  page,
  fileName,
  content,
}: {
  page: Page;
  fileName: string;
  content: string;
}): Promise<void> {
  const elemMenu = page.getByTitle("Add files").and(page.locator("wy-dropdown"));
  await elemMenu.click();
  const elemFromDevice = elemMenu.getByText("From device");
  await expect(elemFromDevice).toBeVisible();
  await elemFromDevice.click();

  await page
    .getByTestId("uploadFile")
    .setInputFiles([{ name: fileName, mimeType: "text/plain", buffer: Buffer.from(content) }]);
}
