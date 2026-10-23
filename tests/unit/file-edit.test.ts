import { expect, fixture, html, waitUntil } from "@open-wc/testing";
import { ContextProvider } from "@lit/context";

import "../utils/version";
import { Weavy } from "../../lib/client/weavy";
import { WyFileMenu } from "../../lib/components/wy-file-menu";
import { WyFileTitle } from "../../lib/components/wy-file-title";
import { WyFileVersions } from "../../lib/components/wy-file-versions";
import { WyFilesTable } from "../../lib/components/wy-files-table";
import "../../lib/components/wy-files-grid";
import { WyPreview } from "../../lib/components/wy-preview";
import { WyFileViewText } from "../../lib/components/wy-file-view-text";
import { WyEditorFile } from "../../lib/components/wy-editor-file";
import { WyFile } from "../../lib/wy-file";
import { WeavyContext } from "../../lib/contexts/weavy-context";
import { AppContext } from "../../lib/contexts/apps-context";
import { UserContext } from "../../lib/contexts/user-context";
import { ComponentFeatures, Feature, FeaturePolicyContext } from "../../lib/contexts/features-context";
import { AccessType, AppTypeGuid, PermissionType, type AppType } from "../../lib/types/app.types";
import type { FileType } from "../../lib/types/files.types";
import type { FileVersionSelectEventType } from "../../lib/types/files.events";
import { getFileDraftKey, removeDraft, saveDraft } from "../../lib/data/drafts";

describe("file editing", () => {
  const file: FileType = {
    id: 42,
    app: { id: 1 },
    name: "notes.txt",
    kind: "text",
    media_type: "text/plain",
    size: 5,
    preview_format: "text",
    created_at: "2026-10-16T08:00:00Z",
    is_subscribed: false,
    is_starred: false,
    is_trashed: false,
  };
  const app = {
    id: 1,
    type: AppTypeGuid.Files,
    access: AccessType.Write,
    permissions: [PermissionType.Create],
  } as AppType;
  let weavy: Weavy;
  let host: HTMLDivElement;

  beforeEach(async () => {
    weavy = new Weavy();
    host = await fixture<HTMLDivElement>(html`<div></div>`);
    new ContextProvider(host, { context: WeavyContext, initialValue: weavy });
    new ContextProvider(host, { context: AppContext, initialValue: app });
    new ContextProvider(host, {
      context: FeaturePolicyContext,
      initialValue: new ComponentFeatures({
        [Feature.FileEdit]: true,
        [Feature.Comments]: true,
        [Feature.Versions]: true,
      }),
    });
  });

  afterEach(() => {
    host.remove();
    weavy.destroy();
  });

  /** Creates a menu using real context and draft-query subscriptions. */
  async function menu(edit = true) {
    const menu = new WyFileMenu();
    menu.file = file;
    menu.hasEdit = true;
    menu.hasComments = true;
    menu.hasVersions = true;
    menu.editActive = edit;
    host.appendChild(menu);
    await menu.updateComplete;
    await waitUntil(() => weavy.queryClient.getQueryCache()
      .find({ queryKey: ["draft", getFileDraftKey(file)] })?.getObserversCount() === 1);
    return menu;
  }

  /** Returns only the toolbar buttons, excluding dropdown controls. */
  function buttons(menu: WyFileMenu) {
    return Array.from(menu.shadowRoot!.querySelectorAll("wy-button"));
  }

  /** Returns the rendered badge of the first `wy-file-draft-badge` in the element, or null while there is no draft. */
  function draftBadge(el: Element) {
    return el.shadowRoot!.querySelector("wy-file-draft-badge")?.shadowRoot?.querySelector("wy-badge") ?? null;
  }

  /** Returns the visible text of the draft badge in the element. */
  function badgeText(el: Element) {
    return draftBadge(el)?.shadowRoot?.querySelector('[part~="wy-badge"]')?.textContent?.trim();
  }

  it("shows Publish and Discard right away when editing, with Publish disabled until there is a draft", async () => {
    const el = await menu();
    expect(buttons(el).map((button) => button.textContent?.trim())).to.deep.equal(["Publish", "Discard"]);
    expect(buttons(el).every((button) => button.kind === "filled")).to.equal(true);
    expect(buttons(el)[0].disabled).to.equal(true);
    expect(buttons(el)[1].disabled).to.equal(false);

    // An empty text draft still represents an edit: deleting all file content.
    saveDraft(weavy, getFileDraftKey(file), { text: "" });
    await waitUntil(() => buttons(el)[0].disabled === false);
    expect(buttons(el).map((button) => button.textContent?.trim())).to.deep.equal(["Publish", "Discard"]);
    removeDraft(weavy, getFileDraftKey(file));
    await waitUntil(() => buttons(el)[0].disabled === true);
    expect(buttons(el).map((button) => button.textContent?.trim())).to.deep.equal(["Publish", "Discard"]);
  });

  it("discards an unchanged edit without saving", async () => {
    const el = await menu();
    let edit: boolean | undefined;
    let saves = 0;
    el.addEventListener("edit", (event) => (edit = event.detail.edit));
    el.addEventListener("save", () => saves++);
    await buttons(el)[1].updateComplete;
    buttons(el)[1].shadowRoot!.querySelector("button")!.click();
    expect(edit).to.equal(false);
    expect(el.editActive).to.equal(false);
    expect(saves).to.equal(0);
  });

  it("publishes through the save event without discarding the draft prematurely", async () => {
    const el = await menu();
    let saves = 0;
    el.addEventListener("save", () => saves++);
    saveDraft(weavy, getFileDraftKey(file), { text: "edited" });
    await waitUntil(() => buttons(el).length === 2);
    await buttons(el)[0].updateComplete;
    buttons(el)[0].shadowRoot!.querySelector("button")!.click();
    expect(saves).to.equal(1);
    expect(weavy.queryClient.getQueryData(["draft", getFileDraftKey(file)])).to.have.property("text", "edited");
  });

  it("discards the draft and requests preview mode", async () => {
    const el = await menu();
    let edit: boolean | undefined;
    el.addEventListener("edit", (event) => (edit = event.detail.edit));
    saveDraft(weavy, getFileDraftKey(file), { text: "edited" });
    await waitUntil(() => buttons(el).length === 2);
    await buttons(el)[1].updateComplete;
    buttons(el)[1].shadowRoot!.querySelector("button")!.click();
    expect(edit).to.equal(false);
    expect(el.editActive).to.equal(false);
    await waitUntil(() => !weavy.queryClient.getQueryData(["draft", getFileDraftKey(file)]));
  });

  it("hides sidebar actions during editing", async () => {
    const el = await menu();
    saveDraft(weavy, getFileDraftKey(file), { text: "edited" });
    await waitUntil(() => buttons(el).length === 2);
    const items = () => Array.from(el.shadowRoot!.querySelectorAll("wy-dropdown-item"))
      .map((item) => item.textContent?.trim());
    // Only Publish and Discard apply while editing, so the whole dropdown (Download, Rename, Subscribe...) is gone.
    expect(el.shadowRoot!.querySelector("wy-dropdown")).to.equal(null);
    expect(items()).to.deep.equal([]);

    // Back in preview on the draft (hosts land there after editing): one Continue editing button, and the dropdown
    // with Publish and Discard first, then the sidebar actions.
    el.editActive = false;
    el.draftActive = true;
    await el.updateComplete;
    expect(buttons(el).map((button) => button.textContent?.trim())).to.deep.equal(["Continue editing"]);
    expect(buttons(el)[0].kind).to.equal("filled");
    expect(buttons(el)[0].querySelector("wy-icon")).to.equal(null);
    expect(items().slice(0, 2)).to.deep.equal(["Publish", "Discard"]);
    expect(items()).to.include("Comments");
    expect(items()).to.include("Versions");
    expect(buttons(el).filter((button) => button.title === "Comments")).to.have.length(0);
  });

  it("shows Continue editing with Publish and Discard in the dropdown while a draft exists", async () => {
    const el = await menu(false);
    let edit: boolean | undefined;
    let saves = 0;
    el.addEventListener("edit", (event) => (edit = event.detail.edit));
    el.addEventListener("save", () => saves++);
    el.requestUpdate();
    await el.updateComplete;
    const labels = () => buttons(el).filter((button) => !button.title).map((button) => button.textContent?.trim());
    const commentsButtons = () => buttons(el).filter((button) => button.title === "Comments");
    const dropdownItems = () => Array.from(el.shadowRoot!.querySelectorAll("wy-dropdown-item"));
    const menuItems = () => dropdownItems().map((item) => item.textContent?.trim());
    const clickItem = async (label: string) => {
      const item = dropdownItems().find((candidate) => candidate.textContent?.trim() === label)!;
      await item.updateComplete;
      item.click();
    };
    // Without a draft the toolbar has only the comments button; editing starts from the first dropdown item.
    expect(labels()).to.deep.equal([]);
    expect(commentsButtons()).to.have.length(1);
    expect(menuItems()).to.deep.equal(["Edit", "Download", "Versions"]);

    // With a draft, Comments moves into the dropdown. Continue editing appears only once the draft is the viewed
    // entry; a stored version viewed alongside the draft gets no toolbar button.
    saveDraft(weavy, getFileDraftKey(file), { text: "edited" });
    await waitUntil(() => menuItems()[0] === "Publish");
    expect(labels()).to.deep.equal([]);
    expect(commentsButtons()).to.have.length(0);
    el.draftActive = true;
    await waitUntil(() => labels().length === 1);
    expect(labels()).to.deep.equal(["Continue editing"]);
    expect(menuItems()).to.deep.equal(["Publish", "Discard", "Download", "Comments", "Versions"]);
    expect(el.shadowRoot!.querySelector("wy-dropdown-item + wy-dropdown-item + wy-dropdown-divider")).not.to.equal(null);

    // Publish from the menu goes through the save event without touching the draft itself.
    await clickItem("Publish");
    expect(saves).to.equal(1);
    expect(weavy.queryClient.getQueryData(["draft", getFileDraftKey(file)])).to.have.property("text", "edited");

    // Discard from the menu drops the draft and stays in preview.
    await clickItem("Discard");
    await waitUntil(() => !weavy.queryClient.getQueryData(["draft", getFileDraftKey(file)]));
    await waitUntil(() => menuItems()[0] === "Edit");
    expect(labels()).to.deep.equal([]);
    expect(commentsButtons()).to.have.length(1);
    expect(edit).to.equal(undefined);
    expect(el.editActive).to.equal(false);

    saveDraft(weavy, getFileDraftKey(file), { text: "edited" });
    await waitUntil(() => labels().length === 1);
    await buttons(el)[0].updateComplete;
    buttons(el)[0].shadowRoot!.querySelector("button")!.click();
    expect(edit).to.equal(true);
  });

  it("toggles comments from the dropdown instead of the toolbar button while a draft exists", async () => {
    const el = await menu(false);
    let shown: boolean | undefined;
    el.addEventListener("comments", (event) => (shown = event.detail.show));
    el.requestUpdate();
    await el.updateComplete;
    const item = () =>
      Array.from(el.shadowRoot!.querySelectorAll("wy-dropdown-item")).find(
        (candidate) => candidate.textContent?.trim() === "Comments",
      )!;
    expect(buttons(el).filter((button) => button.title === "Comments")).to.have.length(1);
    expect(item()).to.equal(undefined);

    saveDraft(weavy, getFileDraftKey(file), { text: "edited" });
    await waitUntil(() => item() !== undefined);
    expect(buttons(el).filter((button) => button.title === "Comments")).to.have.length(0);
    expect(item().querySelector("wy-icon")!.name).to.equal("comment-outline");
    await item().updateComplete;
    item().click();
    expect(shown).to.equal(true);
    await el.updateComplete;
    expect(item().hasAttribute("active")).to.equal(true);
  });

  it("shows a Draft badge in the title only while the draft is shown or edited", async () => {
    const title = new WyFileTitle();
    title.file = file;
    host.appendChild(title);
    await title.updateComplete;
    const badge = () => draftBadge(title);
    saveDraft(weavy, getFileDraftKey(file), { text: "edited", updatedAt: new Date().toISOString() });
    await title.updateComplete;
    // A stored version is shown: the draft is not what is on screen.
    expect(badge()).to.equal(null);

    title.draft = true;
    await waitUntil(() => badgeText(title) === "Draft");
    expect(badge()!.getAttribute("appearance")).to.equal(null);

    removeDraft(weavy, getFileDraftKey(file));
    await waitUntil(() => badge() === null);
  });

  for (const tag of ["wy-files-table", "wy-files-grid"] as const) {
    it(`${tag} shows a Draft badge next to the file while a draft exists`, async () => {
      const el = document.createElement(tag);
      el.infiniteQueryResult = {
        data: { pages: [{ data: [file], start: 1, end: 1, count: 1 }], pageParams: [null] },
      } as unknown as typeof el.infiniteQueryResult;
      host.appendChild(el);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector("wy-file-draft-badge")).to.not.equal(null);
      expect(draftBadge(el)).to.equal(null);

      saveDraft(weavy, getFileDraftKey(file), { text: "edited", updatedAt: new Date().toISOString() });
      await waitUntil(() => badgeText(el) === "Draft");

      // The badge sits next to the name in the table and next to the menu in the card actions in the grid.
      const container = draftBadge(el)!.getRootNode() as ShadowRoot;
      const badgeHost = container.host;
      if (el instanceof WyFilesTable) {
        expect(badgeHost.parentElement!.getAttribute("part")).to.contain("wy-col-name");
        expect(badgeHost.previousSibling?.textContent).to.equal(file.name);
      } else {
        expect(badgeHost.parentElement!.getAttribute("part")).to.contain("wy-card-actions");
        expect(badgeHost.nextElementSibling?.tagName).to.equal("WY-FILE-MENU");
      }

      removeDraft(weavy, getFileDraftKey(file));
      await waitUntil(() => draftBadge(el) === null);
    });
  }

  it("hides the Edit item while an older version is viewed", async () => {
    const el = await menu(false);
    el.addEventListener("edit", () => {});
    el.requestUpdate();
    await el.updateComplete;
    const menuItems = () =>
      Array.from(el.shadowRoot!.querySelectorAll("wy-dropdown-item")).map((item) => item.textContent?.trim());
    expect(menuItems()[0]).to.equal("Edit");
    el.oldVersionActive = true;
    await el.updateComplete;
    expect(menuItems()).not.to.include("Edit");
    expect(buttons(el).filter((button) => !button.title)).to.have.length(0);
    el.oldVersionActive = false;
    await el.updateComplete;
    expect(menuItems()[0]).to.equal("Edit");
  });

  /** Returns the label and icon of each dropdown item, in render order. */
  function items(menu: WyFileMenu) {
    return Array.from(menu.shadowRoot!.querySelectorAll("wy-dropdown-item")).map((item) => ({
      label: item.textContent?.trim(),
      icon: item.querySelector("wy-icon")?.name,
    }));
  }

  for (const hasEdit of [true, false]) {
    it(`lists Edit before Download in the dropdown for text files (hasEdit ${hasEdit})`, async () => {
      const el = await menu(false);
      el.hasEdit = hasEdit;
      el.addEventListener("edit", () => {});
      el.requestUpdate();
      await el.updateComplete;
      expect(items(el)).to.deep.equal([
        { label: "Edit", icon: "pencil" },
        { label: "Download", icon: "download" },
        { label: "Versions", icon: "backup-restore" },
      ]);
    });
  }

  it("lists the WebDAV item as Edit with the document icon before Download", async () => {
    const office: FileType = {
      ...file,
      name: "report.docx",
      kind: "document",
      media_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      preview_format: "pdf",
      application_url: "ms-word:ofe|u|https://example.test/dav/report.docx",
    };
    const davHost = await fixture<HTMLDivElement>(html`<div></div>`);
    new ContextProvider(davHost, { context: WeavyContext, initialValue: weavy });
    new ContextProvider(davHost, { context: AppContext, initialValue: app });
    new ContextProvider(davHost, {
      context: FeaturePolicyContext,
      initialValue: new ComponentFeatures({ [Feature.FileEdit]: true, [Feature.WebDAV]: true, [Feature.Versions]: true }),
    });
    const el = new WyFileMenu();
    el.file = office;
    el.hasVersions = true;
    el.addEventListener("edit", () => {});
    davHost.appendChild(el);
    await el.updateComplete;
    expect(items(el)).to.deep.equal([
      { label: "Edit", icon: "file-word" },
      { label: "Download", icon: "download" },
      { label: "Versions", icon: "backup-restore" },
    ]);
    davHost.remove();
  });

  for (const tag of ["wy-file", "wy-preview"] as const) {
    it(`${tag} opens on an existing draft with Continue editing and Publish and Discard in the menu`, async () => {
      const current = { ...file, rev: 3 };
      const older = { ...file, rev: 2 };
      weavy.fetch = async () => Response.json(current);
      saveDraft(weavy, getFileDraftKey(file), { text: "draft" });

      const el = document.createElement(tag);
      el.app = app;
      if (el instanceof WyFile) {
        el.fileId = file.id;
      } else {
        el.files = [current];
        el.currentId = file.id;
        el.showOverlay = true;
      }
      host.appendChild(el);
      const fileMenu = () => el.shadowRoot!.querySelector("wy-file-menu")!;
      const labels = () =>
        Array.from(fileMenu()?.shadowRoot?.querySelectorAll("wy-button") ?? [])
          .filter((button) => !button.title)
          .map((button) => button.textContent?.trim());
      const menuItems = () =>
        Array.from(fileMenu()?.shadowRoot?.querySelectorAll("wy-dropdown-item") ?? []).map((item) =>
          item.textContent?.trim(),
        );
      await waitUntil(() => el.showDraft === true);
      expect(el.shadowRoot!.querySelector("wy-file-view")!.draft).to.equal(true);
      const title = () => el.shadowRoot!.querySelector("wy-file-title")!;
      await waitUntil(() => title().draft === true);
      await waitUntil(() => labels().length === 1);
      expect(labels()).to.deep.equal(["Continue editing"]);
      expect(menuItems().slice(0, 2)).to.deep.equal(["Publish", "Discard"]);

      // Viewing a stored version alongside the draft keeps Publish and Discard in the menu but drops the
      // Continue editing button; only the draft entry offers it.
      el.handleVersionFile({ detail: { versionFile: current, draft: false } } as FileVersionSelectEventType);
      await waitUntil(() => title().draft === false);
      expect(el.showDraft).to.equal(false);
      expect(fileMenu().oldVersionActive).to.equal(false);
      await waitUntil(() => labels().length === 0);
      expect(menuItems().slice(0, 2)).to.deep.equal(["Publish", "Discard"]);

      el.handleVersionFile({ detail: { versionFile: older, draft: false } } as FileVersionSelectEventType);
      await waitUntil(() => fileMenu().oldVersionActive === true);
      expect(labels()).to.deep.equal([]);

      // Back to the draft.
      el.handleVersionFile({ detail: { versionFile: current, draft: true } } as FileVersionSelectEventType);
      await waitUntil(() => title().draft === true);
      await waitUntil(() => labels().length === 1);
      expect(labels()).to.deep.equal(["Continue editing"]);

      // Discarding the draft leaves the draft view, and the current version is editable from the dropdown again.
      removeDraft(weavy, getFileDraftKey(file));
      await waitUntil(() => el.showDraft === false);
      await waitUntil(() => menuItems()[0] === "Edit");
      expect(labels()).to.deep.equal([]);

      // A draft that appears after the user picked a version does not replace the chosen view.
      el.handleVersionFile({ detail: { versionFile: older, draft: false } } as FileVersionSelectEventType);
      await waitUntil(() => fileMenu().oldVersionActive === true);
      saveDraft(weavy, getFileDraftKey(file), { text: "draft again" });
      await waitUntil(() => menuItems()[0] === "Publish");
      expect(el.showDraft).to.equal(false);
      expect(labels()).to.deep.equal([]);

      // Leaving the editor with a draft lands on the draft, whatever was viewed before.
      el.edit = true;
      await el.updateComplete;
      expect(el.showDraft).to.equal(false);
      expect(title().draft).to.equal(true);
      el.edit = false;
      await waitUntil(() => el.showDraft === true);
      await waitUntil(() => labels().length === 1);
      expect(labels()).to.deep.equal(["Continue editing"]);

      if (el instanceof WyPreview) {
        // So does closing and reopening the preview after viewing a stored version.
        el.handleVersionFile({ detail: { versionFile: current, draft: false } } as FileVersionSelectEventType);
        await waitUntil(() => el.showDraft === false);
        el.showOverlay = false;
        // Let the native dialog finish closing, or its delayed close event would undo the reopen below.
        const dialog = () => el.shadowRoot!.querySelector("wy-overlay")!.shadowRoot!.querySelector("dialog")!;
        await waitUntil(() => !dialog().open);
        await new Promise((resolve) => setTimeout(resolve, 50));
        el.showOverlay = true;
        await waitUntil(() => el.showDraft === true);
        await waitUntil(() => labels().length === 1);
      }
    });

    it(`${tag} does not open on a draft without one and hides Edit for older versions`, async () => {
      const current = { ...file, rev: 3 };
      weavy.fetch = async () => Response.json(current);
      const el = document.createElement(tag);
      el.app = app;
      if (el instanceof WyFile) {
        el.fileId = file.id;
      } else {
        el.files = [current];
        el.currentId = file.id;
        el.showOverlay = true;
      }
      host.appendChild(el);
      const fileMenu = () => el.shadowRoot!.querySelector("wy-file-menu")!;
      const labels = () =>
        Array.from(fileMenu()?.shadowRoot?.querySelectorAll("wy-button") ?? [])
          .filter((button) => !button.title)
          .map((button) => button.textContent?.trim());
      const menuItems = () =>
        Array.from(fileMenu()?.shadowRoot?.querySelectorAll("wy-dropdown-item") ?? []).map((item) =>
          item.textContent?.trim(),
        );
      await waitUntil(() => menuItems()[0] === "Edit");
      expect(labels()).to.deep.equal([]);
      expect(el.showDraft).to.equal(false);
      el.handleVersionFile({ detail: { versionFile: { ...file, rev: 1 }, draft: false } } as FileVersionSelectEventType);
      await waitUntil(() => !menuItems().includes("Edit"));
      expect(labels()).to.deep.equal([]);
      expect(fileMenu().oldVersionActive).to.equal(true);
    });
  }

  /** A host providing a read-only app, where a cached draft cannot be published or discarded. */
  async function readOnlyHost() {
    const readOnly = { ...app, access: AccessType.Read, permissions: [] } as AppType;
    const roHost = await fixture<HTMLDivElement>(html`<div></div>`);
    new ContextProvider(roHost, { context: WeavyContext, initialValue: weavy });
    new ContextProvider(roHost, { context: AppContext, initialValue: readOnly });
    new ContextProvider(roHost, {
      context: FeaturePolicyContext,
      initialValue: new ComponentFeatures({
        [Feature.FileEdit]: true,
        [Feature.Comments]: true,
        [Feature.Versions]: true,
      }),
    });
    return { readOnly, roHost };
  }

  /** Number of components observing the draft of the test file. */
  function draftObservers() {
    return weavy.queryClient.getQueryCache().find({ queryKey: ["draft", getFileDraftKey(file)] })?.getObserversCount() ?? 0;
  }

  it("ignores a cached draft the user cannot act on in the menu, title and versions", async () => {
    const { roHost } = await readOnlyHost();
    weavy.fetch = async () => Response.json({ data: [{ ...file, rev: 1 }], count: 1 });
    saveDraft(weavy, getFileDraftKey(file), { text: "draft", updatedAt: new Date().toISOString() });

    const menu = new WyFileMenu();
    menu.file = file;
    menu.hasEdit = true;
    menu.hasComments = true;
    menu.hasVersions = true;
    menu.addEventListener("edit", () => {});
    const title = new WyFileTitle();
    title.file = file;
    title.draft = true;
    const versions = new WyFileVersions();
    versions.file = file;
    for (const el of [menu, title, versions]) {
      roHost.appendChild(el);
    }
    // Menu, badge and versions list each observe the draft; wait until all have received it.
    await waitUntil(() => draftObservers() >= 3);
    await waitUntil(() => versions.shadowRoot?.querySelector("wy-item-list") !== null);
    await Promise.all([menu.updateComplete, title.updateComplete, versions.updateComplete]);

    // The menu behaves as without a draft: comments button in the toolbar, no draft or edit actions.
    expect(buttons(menu).filter((button) => !button.title)).to.have.length(0);
    expect(buttons(menu).filter((button) => button.title === "Comments")).to.have.length(1);
    expect(Array.from(menu.shadowRoot!.querySelectorAll("wy-dropdown-item")).map((item) => item.textContent?.trim()))
      .to.deep.equal(["Download", "Versions"]);
    // No badge and no "Unsaved draft" entry.
    expect(title.shadowRoot!.querySelector("wy-file-draft-badge")?.shadowRoot?.querySelector("wy-badge") ?? null)
      .to.equal(null);
    expect(versions.shadowRoot!.textContent).not.to.include("Unsaved draft");
    roHost.remove();
  });

  it("opens on the published version when the cached draft cannot be acted on", async () => {
    const { readOnly, roHost } = await readOnlyHost();
    saveDraft(weavy, getFileDraftKey(file), { text: "draft", updatedAt: new Date().toISOString() });
    const preview = new WyPreview();
    preview.app = readOnly;
    preview.files = [file];
    preview.currentId = file.id;
    preview.showOverlay = true;
    roHost.appendChild(preview);
    await waitUntil(() => preview.shadowRoot?.querySelector("wy-file-menu") !== null);
    // The preview itself observes the draft once its file is known.
    await waitUntil(() => draftObservers() >= 1);
    await preview.updateComplete;
    expect(preview.showDraft).to.equal(false);
    expect(preview.shadowRoot!.querySelector("wy-file-view")!.draft).to.equal(false);
    roHost.remove();
  });

  it("preserves edit permission gates", async () => {
    const el = await menu();
    el.app = { ...app, permissions: [] };
    await el.updateComplete;
    expect(buttons(el)).to.have.length(0);
  });

  it("never renders file sidebars in edit mode, even with an explicitly selected tab", async () => {
    const el = new WyFile();
    el.app = app;
    el.tab = "comments";
    const preview = await fixture<HTMLDivElement>(html`<div>${el.renderTabs(file)}</div>`);
    expect(preview.querySelector("wy-overlay")).not.to.equal(null);
    el.edit = true;
    for (const tab of ["comments", "versions"] as const) {
      el.tab = tab;
      const editing = await fixture<HTMLDivElement>(html`<div>${el.renderTabs(file)}</div>`);
      expect(editing.querySelector("wy-overlay")).to.equal(null);
      expect(editing.querySelector("aside")).to.equal(null);
    }
  });

  it("never renders preview sidebars while editing, including restored sidebar state", async () => {
    const el = new WyPreview();
    host.appendChild(el);
    await el.updateComplete;
    el.showOverlay = true;
    el.commentsOpen = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("#tab-comments")).not.to.equal(null);
    el.edit = true;
    await el.updateComplete;
    expect(el.commentsOpen).to.equal(false);
    expect(el.versionsOpen).to.equal(false);
    for (const tab of ["commentsOpen", "versionsOpen"] as const) {
      el[tab] = true;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector("aside")).to.equal(null);
    }
  });

  it("replaces the close button with a back arrow while editing, which returns to the preview", async () => {
    const el = new WyPreview();
    el.app = app;
    el.files = [file];
    el.currentId = file.id;
    el.showOverlay = true;
    host.appendChild(el);
    const iconButton = () => el.shadowRoot!.querySelector("wy-titlebar wy-button[slot=icon]")!;
    const iconName = () => iconButton().querySelector("wy-icon")!.getAttribute("name");
    await waitUntil(() => Boolean(el.shadowRoot?.querySelector("wy-titlebar wy-button[slot=icon]")));
    expect(iconName()).to.equal("close");
    expect(iconButton().getAttribute("title")).to.equal(null);

    el.edit = true;
    await waitUntil(() => iconName() === "back");
    expect(iconButton().getAttribute("title")).to.equal("Back to preview");

    saveDraft(weavy, getFileDraftKey(file), { text: "draft", updatedAt: new Date().toISOString() });
    await iconButton().updateComplete;
    iconButton().shadowRoot!.querySelector("button")!.click();
    await waitUntil(() => iconName() === "close");
    expect(el.edit).to.equal(false);
    expect(el.showOverlay).to.equal(true);
    // The draft survives and is what the preview shows.
    expect(weavy.queryClient.getQueryData(["draft", getFileDraftKey(file)])).to.have.property("text", "draft");
    await waitUntil(() => el.showDraft === true);
  });

  it("restores published text when leaving the editor without saving", async () => {
    const el = await fixture<WyFileViewText>(html`<wy-file-view-text></wy-file-view-text>`);
    el.fileContent = "published";
    el.text = "edited";
    el.edit = true;
    await el.updateComplete;
    el.edit = false;
    await el.updateComplete;
    expect(el.text).to.equal("published");
  });

  for (const tag of ["wy-file", "wy-preview"] as const) {
    it(`${tag} returns to preview only after a successful publish and stays editing on failure`, async () => {
      weavy.fetch = async () => Response.json(file);
      const el = document.createElement(tag);
      el.app = app;
      el.edit = true;
      if (el instanceof WyFile) {
        el.fileId = file.id;
      } else {
        el.files = [file];
        el.currentId = file.id;
        el.showOverlay = true;
      }
      host.appendChild(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector("wy-file-view")));
      const view = el.shadowRoot!.querySelector("wy-file-view")!;
      let finish: (() => void) | undefined;
      view.save = () => new Promise<void>((resolve) => (finish = resolve));
      const publishing = el.save();
      expect(el.edit).to.equal(true);
      finish!();
      await publishing;
      expect(el.edit).to.equal(false);

      el.edit = true;
      await el.updateComplete;
      const error = new Error("Publish failed");
      view.save = () => Promise.reject(error);
      expect(await el.save().catch((failure: unknown) => failure)).to.equal(error);
      expect(el.edit).to.equal(true);
    });
  }

  it("does not recreate a discarded draft from a pending editor write", async () => {
    const el = new WyEditorFile();
    el.file = file;
    el.fileContent = "published";
    el.text = "published";
    el.draft = true;
    host.appendChild(el);
    await waitUntil(() => weavy.queryClient.getQueryCache()
      .find({ queryKey: ["draft", getFileDraftKey(file)] })?.getObserversCount() === 1);
    el.text = "first edit";
    await el.updateComplete;
    el.text = "second edit";
    await el.updateComplete;
    removeDraft(weavy, getFileDraftKey(file));
    el.remove();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(weavy.queryClient.getQueryData(["draft", getFileDraftKey(file)])).not.to.be.ok;
  });

  for (const draft of ["restored draft", "", "  draft with whitespace\n"]) {
    it(`publishes an existing draft unchanged (${JSON.stringify(draft)}) and immediately shows the published text`, async () => {
      const original = { ...file, rev: 1, download_url: "/original" };
      const published = { ...original, rev: 2, download_url: "/published" };
      weavy.queryClient.setQueryData(["app", app.id, "file", file.id], original);
      let uploaded: string | undefined;
      weavy.fetchFile = async (url) => new Response(url === "/original" ? "original" : draft);
      weavy.upload = async (_url, _method, body) => {
        if (!(body instanceof FormData)) {
          throw new Error("Expected a file upload");
        }
        uploaded = await (body.get("blob") as File).text();
        return Response.json({ id: 123, name: file.name, size: draft.length, media_type: file.media_type });
      };
      weavy.fetch = async () => Response.json(published);
      saveDraft(weavy, getFileDraftKey(file), { text: draft });
      const el = new WyFileViewText();
      el.user = { id: 1, name: "Test user" };
      el.file = original;
      host.appendChild(el);
      await waitUntil(() => el.fileContent === "original");
      el.edit = true;
      // Publish immediately, without waiting for draft-query hydration or a user change event.
      await el.save();
      expect(uploaded).to.equal(draft);
      expect(original.rev).to.equal(1);
      expect(weavy.queryClient.getQueryData(["app", app.id, "file", file.id])).to.have.property("rev", 2);
      el.edit = false;
      await el.updateComplete;
      await waitUntil(() => !el.loadingText);
      expect(el.text).to.equal(draft);
      expect(el.fileContent).to.equal(draft);
      expect(el.shadowRoot!.querySelector('[part~="wy-content-text"]')?.textContent).to.equal(draft);
      await waitUntil(() => !weavy.queryClient.getQueryData(["draft", getFileDraftKey(file)]));
    });
  }

  it("publishes the stored draft from preview mode without the editor", async () => {
    const original = { ...file, rev: 1, download_url: "/original" };
    const published = { ...original, rev: 2, download_url: "/published" };
    weavy.queryClient.setQueryData(["app", app.id, "file", file.id], original);
    let uploaded: string | undefined;
    weavy.fetchFile = async (url) => new Response(url === "/original" ? "original" : "draft");
    weavy.upload = async (_url, _method, body) => {
      uploaded = await ((body as FormData).get("blob") as File).text();
      return Response.json({ id: 123, name: file.name, size: 5, media_type: file.media_type });
    };
    weavy.fetch = async () => {
      // A host pushes the published revision from the cache update before the mutation call returns to save().
      queueMicrotask(() => {
        el.file = published;
      });
      return Response.json(published);
    };
    const el = new WyFileViewText();
    el.user = { id: 1, name: "Test user" };
    el.file = original;
    host.appendChild(el);
    await waitUntil(() => el.fileContent === "original");

    // Nothing to publish without a draft: the loaded content is not uploaded again.
    await el.save();
    expect(uploaded).to.equal(undefined);

    saveDraft(weavy, getFileDraftKey(file), { text: "draft" });
    el.draft = true;
    await el.updateComplete;
    await el.save();
    expect(uploaded).to.equal("draft");
    expect(el.text).to.equal("draft");
    await waitUntil(() => !weavy.queryClient.getQueryData(["draft", getFileDraftKey(file)]));
    // The new revision's content load must not be discarded as stale, or the view keeps loading forever.
    expect(el.file).to.have.property("rev", 2);
    await waitUntil(() => !el.loadingText && !el.loadingHtml);
    expect(el.fileContent).to.equal("draft");
  });

  it("keeps a restored draft if publishing fails", async () => {
    saveDraft(weavy, getFileDraftKey(file), { text: "restored draft" });
    weavy.fetchFile = async () => new Response("original");
    weavy.upload = async () => Response.json({ detail: "Upload failed" }, { status: 500 });
    const el = new WyFileViewText();
    el.user = { id: 1, name: "Test user" };
    el.file = { ...file, download_url: "/original" };
    el.edit = true;
    host.appendChild(el);
    const error = await el.save().catch((failure: unknown) => failure);
    expect(error).to.be.instanceOf(Error);
    expect(el.edit).to.equal(true);
    expect(weavy.queryClient.getQueryData(["draft", getFileDraftKey(file)]))
      .to.have.property("text", "restored draft");
  });

  it("publishes the live editor document rather than a throttled draft snapshot", async () => {
    weavy.url = "https://weavy.test";
    new ContextProvider(host, { context: UserContext, initialValue: { id: 1, name: "Test user" } });
    saveDraft(weavy, getFileDraftKey(file), { text: "restored draft" });
    weavy.fetchFile = async () => new Response("original");
    let uploaded: string | undefined;
    weavy.upload = async (_url, _method, body) => {
      if (!(body instanceof FormData)) {
        throw new Error("Expected a file upload");
      }
      uploaded = await (body.get("blob") as File).text();
      return Response.json({ id: 123, name: file.name, size: 9, media_type: file.media_type });
    };
    weavy.fetch = async () => Response.json({ ...file, rev: 2 });
    const el = new WyFileViewText();
    el.file = file;
    el.fileContent = "original";
    el.text = "original";
    el.edit = true;
    host.appendChild(el);
    await waitUntil(() => Boolean(el.shadowRoot?.querySelector("wy-editor-file")
      ?.shadowRoot?.querySelector("wy-editor-core")?.editor), undefined, { timeout: 10000 });
    const editor = el.shadowRoot!.querySelector("wy-editor-file")!;
    const core = editor.shadowRoot!.querySelector("wy-editor-core")!;
    await waitUntil(() => core.editor?.state.doc.toString() === "restored draft");
    for (const text of ["first edit", "  latest edit\n"]) {
      core.editor!.dispatch({ changes: { from: 0, to: core.editor!.state.doc.length, insert: text } });
    }
    await el.save();
    expect(uploaded).to.equal("  latest edit\n");
  });

  for (const previewFormat of ["text", "code", "html"] as const) {
    it(`ignores out-of-order ${previewFormat} responses, including revisions mutated in place`, async () => {
      const requests: { resolve: (response: Response) => void; url: string | URL }[] = [];
      weavy.fetchFile = (url) => new Promise((resolve) => requests.push({ resolve, url }));
      const el = new WyFileViewText();
      const original = {
        ...file,
        rev: 1,
        preview_format: previewFormat,
        download_url: "/raw-1",
        preview_url: previewFormat === "text" ? undefined : "/preview-1",
      };
      el.file = original;
      host.appendChild(el);
      await waitUntil(() => requests.length === 1);
      // Cache update helpers mutate shared file objects; the old property value is not a revision snapshot.
      Object.assign(original, { rev: 2, download_url: "/raw-2", preview_url: "/preview-2" });
      el.file = { ...original };
      await waitUntil(() => requests.length === 2);
      requests[1].resolve(new Response("new content"));
      await waitUntil(() => (previewFormat === "text" ? el.text : el.html) === "new content");
      requests[0].resolve(new Response("old content"));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(previewFormat === "text" ? el.text : el.html).to.equal("new content");
    });
  }

  it("does not refetch plain text or overwrite unsaved edits when entering edit mode", async () => {
    let requests = 0;
    weavy.fetchFile = async () => {
      requests++;
      return new Response("original");
    };
    const el = new WyFileViewText();
    el.file = { ...file, download_url: "/original" };
    host.appendChild(el);
    await waitUntil(() => el.fileContent === "original");
    el.edit = true;
    await el.updateComplete;
    expect(requests).to.equal(1);
  });

  it("replaces old formatted HTML with the new published preview", async () => {
    let finishPreview: ((response: Response) => void) | undefined;
    const original = { ...file, rev: 1, preview_format: "html" as const, preview_url: "/preview-1", download_url: "/raw-1" };
    const published = { ...original, rev: 2, preview_url: "/preview-2", download_url: "/raw-2" };
    weavy.fetchFile = (url) => {
      if (url === "/preview-2") {
        return new Promise((resolve) => (finishPreview = resolve));
      }
      return Promise.resolve(new Response(url === "/preview-1" ? "<p>old preview</p>" : "original"));
    };
    weavy.upload = async () => Response.json({ id: 123, name: file.name, size: 9, media_type: file.media_type });
    weavy.fetch = async () => Response.json(published);
    const el = new WyFileViewText();
    el.user = { id: 1, name: "Test user" };
    el.file = original;
    host.appendChild(el);
    await waitUntil(() => el.html === "<p>old preview</p>");
    saveDraft(weavy, getFileDraftKey(file), { text: "new draft" });
    el.edit = true;
    await el.save();
    el.edit = false;
    await waitUntil(() => Boolean(finishPreview));
    expect(el.html).to.equal(undefined);
    expect(el.shadowRoot!.textContent).not.to.include("old preview");
    finishPreview!(new Response("<p>new preview</p>"));
    await waitUntil(() => el.html === "<p>new preview</p>");
    expect(el.shadowRoot!.querySelector('[part~="wy-content-html"]')?.textContent).to.equal("new preview");
  });
});
