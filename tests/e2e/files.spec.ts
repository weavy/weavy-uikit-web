import { test, expect, Page } from "@playwright/test";
import { Buffer } from "buffer";
import { v4 as uuidv4 } from "uuid";

// Localhost
const WEAVY_UI_URL = "http://localhost:5173/dev/pages/files.html";
const timeout = 1500;

test("wy-files is visible", async ({ page }) => {
  await page.goto(getURLwAppId());
  await expect(page.locator("wy-files")).toBeVisible();
});

test("wy-files app-bar is ok", async ({ page }) => {
  await page.goto(getURLwAppId());

  await expect(page.locator("wy-files-appbar")).toBeVisible();

  await expect(page.getByTitle("Add files").and(page.locator("wy-dropdown"))).toBeVisible();
  await expect(page.getByTitle("Sort items by").and(page.locator("wy-dropdown"))).toBeVisible();
  await expect(page.getByTitle("View options").and(page.locator("wy-dropdown"))).toBeVisible();
});

test("upload a text-file and preview it", async ({ page }) => {
  await page.goto(getURLwAppId());

  // Upload a file
  const filename = uuidv4() + ".txt";
  const content = "Some content in the file";
  await uploadFile(page, filename, content);

  // Verify the file exists and can be previewed
  const elemFile = page.getByText(filename);
  await expect(elemFile).toBeVisible();
  await elemFile.click();
  await expect(page.getByText(content)).toBeVisible();
});

test("sort by name from menu", async ({ page }) => {
  await page.goto(getURLwAppId());
  await sortFromMenu(page, "Name");
});

test("sort by size from menu", async ({ page }) => {
  await page.goto(getURLwAppId());
  await sortFromMenu(page, "Size");
});

test("sort by modified from menu", async ({ page }) => {
  await page.goto(getURLwAppId());
  await sortFromMenu(page, "Modified");
});

test("sort by name from column header", async ({ page }) => {
  await page.goto(getURLwAppId());
  await sortByHeader(page, "Name");
});

test("sort by size from column header", async ({ page }) => {
  await page.goto(getURLwAppId());
  await sortByHeader(page, "Size");
});

test("sort by modified from column header", async ({ page }) => {
  await page.goto(getURLwAppId());
  await sortByHeader(page, "Modified");
});

test("trash, restore and delete a file", async ({ page }) => {
  await page.goto(getURLwAppId());

  // Make sure trashed files are not shown
  const elemOptionsMenu = page.getByTitle("View options").and(page.locator("wy-dropdown"));
  await expect(elemOptionsMenu).toBeVisible();
  await elemOptionsMenu.click();
  await elemOptionsMenu.getByText("Hide trashed").locator("div").click();

  // Upload a file if needed and verify it is visible
  const filename = uuidv4() + ".txt";
  await uploadFile(page, filename, "Some text content");
  await expect(page.getByText(filename)).toBeVisible();
  const fileRow = page.locator("tr", { has: page.locator(`text="${filename}"`) });

  // Click Trash in the first file's specific side menu
  const elemSideMenu = fileRow.locator("wy-file-menu");
  await expect(elemSideMenu).toBeVisible();
  await elemSideMenu.click();
  let elemItem = elemSideMenu.getByText("Trash").and(page.locator("wy-dropdown-item"));
  await expect(elemItem).toBeVisible();
  await elemItem.click();

  // Verify the file is not visible
  await page.waitForTimeout(timeout);
  await expect(page.locator("wy-files-list").getByText(filename!)).toBeHidden();

  // Show trashed files
  await elemOptionsMenu.click();
  await elemOptionsMenu.getByText("Show trashed").locator("div").click();
  await page.waitForTimeout(timeout);

  // Verify the file is visible and has strike through
  //let row = page.locator("tr", { has: page.locator(`text="${filename}"`) });
  await expect(fileRow).toBeVisible();
  await expect(fileRow).toHaveClass(/wy-trashed/);

  // Restore it
  //elemSideMenu = row.locator("wy-file-menu");
  await elemSideMenu.click();
  elemItem = elemSideMenu.getByText("Restore").and(page.locator("wy-dropdown-item"));
  await expect(elemItem).toBeVisible();
  await elemItem.click();

  await page.waitForTimeout(timeout);
  //const row = page.locator("wy-files-list").getByText(filename!).locator("..")
  //row = page.locator("tr", { has: page.locator(`text="${filename}"`) });
  await expect(fileRow).toBeVisible();
  const list = await fileRow.getAttribute("class");
  expect(list?.includes("wy-trashed")).toBeFalsy();

  // Trash and delete it
  //elemSideMenu = row.locator("wy-file-menu");
  await elemSideMenu.click();
  elemItem = elemSideMenu.getByText("Trash").and(page.locator("wy-dropdown-item"));
  await elemItem.click();
  await page.waitForTimeout(timeout);
  //row = page.locator("tr", { has: page.locator(`text="${filename}"`) });
  await expect(fileRow).toBeVisible();

  //elemSideMenu = row.locator("wy-file-menu");
  await elemSideMenu.click();
  elemItem = elemSideMenu.getByText("Delete").and(page.locator("wy-dropdown-item"));
  await elemItem.click();
  await page.waitForTimeout(timeout);
  await expect(page.locator("wy-files-list").getByText(filename!)).toBeHidden();
});

test("test upload multiple files at same time", async ({ page }) => {
  await page.goto(getURLwAppId());
  await page.waitForTimeout(2000); //TODO
  await expect(page.locator("wy-files").locator(".wy-files")).toBeVisible();

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
  await page.goto(getURLwAppId());

  await uploadFile(page, "AFile.txt", "Some text content");

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

// Returns a url to the Weavy UI + adds a unique appUId+userId as query-parameter (uses the same id for app and user for easier debugging in db)
function getURLwAppId() {
  const uniqueID = uuidv4();
  return `${WEAVY_UI_URL}?appUID=${uniqueID}`;
}

// Uploads a file "from device" using Playwrights built in setInputFiles
async function uploadFile(page: Page, filename: string, content: string): Promise<void> {
  await expect(page.locator("wy-files").locator(".wy-files")).toBeVisible(); // Make sure the files-list is visible => all wy-files sub-components are ready and file can be uploaded
  const elemMenu = page.getByTitle("Add files").and(page.locator("wy-dropdown"));
  await elemMenu.click();
  const elemFromDevice = elemMenu.getByText("From device");
  await expect(elemFromDevice).toBeVisible();
  await elemFromDevice.click();

  await page
    .getByTestId("uploadFile")
    .setInputFiles([{ name: filename, mimeType: "text/plain", buffer: Buffer.from(content) }]);
  await page.waitForTimeout(500);
}

async function sortFromMenu(page: Page, sortOption: string) {
  // Upload first file
  const fileA = `A_${uuidv4()}.txt`;
  await uploadFile(page, fileA, "Text in file 1");
  await expect(page.getByText(fileA)).toBeVisible();

  // Upload second file and verify it's visible
  const fileZ = `Z_${uuidv4()}.txt`;
  await uploadFile(
    page,
    fileZ,
    "Textcontent with some random text so it can be sorted by size. 123456789012345678901234567890123456789012345678901234567890"
  );
  await expect(page.getByText(fileZ)).toBeVisible();

  const elemSortMenu = page.locator('wy-dropdown').filter({ hasText: 'Name Modified Size Ascending' }).getByRole('button');
  await expect(elemSortMenu).toBeVisible();
  
  await elemSortMenu.click();
  const elemItem = page.locator("wy-dropdown-option").getByText(sortOption).locator("div");
  await elemItem.click();
  await page.waitForTimeout(timeout);
  
  // Verify sortOption is selected
  await elemSortMenu.click();
  await expect(page.locator("wy-dropdown-option").getByText(sortOption)).toHaveAttribute("selected", "");
  await expect(page.getByText(fileA)).toBeVisible();
  await elemSortMenu.click(); // Hide menu
  await page.waitForTimeout(timeout);

  //Verify AFile is first (sorted asc)
  let fileAIndex = await getFileRowIndex({ page, filename: fileA });
  let fileZIndex = await getFileRowIndex({ page, filename: fileZ });
  expect(fileAIndex).toBeLessThan(fileZIndex);

  // Sort desc
  await page.locator('wy-dropdown').filter({ hasText: 'Name Modified Size Ascending' }).getByRole('button').click();
  let el = page.locator("wy-dropdown-option").getByText("Descending").locator("div");
  await el.click();
  await page.waitForTimeout(timeout);
  
  await elemSortMenu.click();
  el = page.locator("wy-dropdown-option").getByText("Descending");
  await expect(el).toBeVisible();
  await expect(el).toHaveAttribute("selected");
  await elemSortMenu.click(); // Hide menu
  await page.waitForTimeout(timeout);

  //Verify ZFile is first (sorted desc)
  fileAIndex = await getFileRowIndex({ page, filename: fileA });
  fileZIndex = await getFileRowIndex({ page, filename: fileZ });
  expect(fileZIndex).toBeLessThan(fileAIndex);
}

async function sortByHeader(page: Page, headerName: string) {
  // Upload first file
  const fileA = `A_${uuidv4()}.txt`;
  await uploadFile(page, fileA, "Text in file 1");
  await expect(page.getByText(fileA)).toBeVisible();

  // Upload second file and verify it's visible
  const fileZ = `Z_${uuidv4()}.txt`;
  await uploadFile(
    page,
    fileZ,
    "Textcontent with some random text so it can be sorted by size. 123456789012345678901234567890123456789012345678901234567890"
  );
  await expect(page.getByText(fileZ)).toBeVisible();

  // Sort by clicking column header
  const header = page.locator(".wy-sort-link", { hasText: headerName });
  const files = page.locator("wy-files-list").locator("tbody").locator("tr");
  await expect(header).toBeVisible();
  if (headerName != "Name") {
    //name asc is default so we can skip click
    await header.click();
    await page.waitForTimeout(timeout);
  }

  // Verify AFile is first
  await expect(files.first().getByText(fileA)).toBeVisible();

  // Verify ZFile is first after sort desc
  await header.click();
  await page.waitForTimeout(timeout);
  await expect(files.first().getByText(fileZ)).toBeVisible();
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
