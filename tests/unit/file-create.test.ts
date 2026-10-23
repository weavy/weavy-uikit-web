import { expect, fixture, html, waitUntil } from "@open-wc/testing";
import { MutationObserver } from "@tanstack/query-core";
import type { LitElement } from "lit";

import "../utils/version";
import { WyFilenameInput } from "../../lib/components/wy-filename-input";
import { WyFileCreate } from "../../lib/components/wy-file-create";
import { WyFileNew } from "../../lib/wy-file-new";
import { WyFile } from "../../lib/wy-file";
import { CreateFilesController } from "../../lib/controllers/create-files-controller";
import { ComponentFeatures, Feature } from "../../lib/contexts/features-context";
import { AccessType, PermissionType, type AppType } from "../../lib/types/app.types";
import { ActionType } from "../../lib/types/action.types";
import type { FileType } from "../../lib/types/files.types";
import { Weavy } from "../../lib/client/weavy";
import { getCreateFileMutationOptions } from "../../lib/data/file-create";
import { ContextProvider } from "@lit/context";
import { WeavyContext } from "../../lib/contexts/weavy-context";
import { AppContext } from "../../lib/contexts/apps-context";
import "../../lib/components/wy-file-create";
import "../../lib/wy-file-new";

/** Wait for the native modal to open and its shown handler to select the basename. */
async function promptInput(prompt: WyFilenameInput) {
  await waitUntil(() => prompt.shadowRoot?.querySelector("wy-overlay")?.show === true);
  const overlay = prompt.shadowRoot!.querySelector("wy-overlay")!;
  await overlay.updateComplete;
  await waitUntil(() => overlay.shadowRoot?.querySelector("dialog")?.open === true);
  const input = prompt.shadowRoot!.querySelector("input")!;
  await waitUntil(() => prompt.shadowRoot?.activeElement === input && input.selectionEnd === 8);
  return input;
}

/** Close through the overlay's normal user-facing close event. */
function cancel(prompt: WyFilenameInput) {
  const overlay = prompt.shadowRoot!.querySelector("wy-overlay")!;
  overlay.handleClose();
}

/** The inline error shown under the input, if any. */
function promptError(prompt: WyFilenameInput) {
  return prompt.shadowRoot!.querySelector('[part~="wy-invalid-feedback"]')?.textContent?.trim();
}

/** Whether the prompt's modal is still open. */
function promptOpen(prompt: WyFilenameInput) {
  return prompt.shadowRoot!.querySelector("wy-overlay")?.show === true;
}

/** Error the create mutation throws when the server answers 409 for a taken filename. */
function conflictError() {
  return new Error("Conflict", { cause: { status: 409, title: "Conflict" } });
}

/** Locate the shared prompt inside a public component or its menu component. */
async function componentPrompt(component: WyFileCreate | WyFileNew | WyFile) {
  await component.updateComplete;
  const menu = component.shadowRoot?.querySelector("wy-file-create");
  if (menu) {
    await menu.updateComplete;
  }
  const prompt = (menu ?? component).shadowRoot!.querySelector("wy-filename-input")!;
  await prompt.updateComplete;
  return prompt;
}

describe("filename prompt", () => {
  it("suggests an extension, focuses the input and selects only untitled", async () => {
    const prompt = await fixture<WyFilenameInput>(html`<wy-filename-input></wy-filename-input>`);
    const result = prompt.open("txt");
    const input = await promptInput(prompt);
    expect(input.value).to.equal("untitled.txt");
    expect(input.selectionStart).to.equal(0);
    expect(input.selectionEnd).to.equal(8);
    cancel(prompt);
    expect(await result).to.equal(undefined);
  });

  it("resets the actual input and selection after submission and cancellation", async () => {
    const prompt = await fixture<WyFilenameInput>(html`<wy-filename-input></wy-filename-input>`);
    for (const submit of [true, false, true]) {
      const result = prompt.open("txt");
      const input = await promptInput(prompt);
      expect(input.value).to.equal("untitled.txt");
      expect(input.selectionStart).to.equal(0);
      input.value = "changed.csv";
      if (submit) {
        input.form!.requestSubmit();
      } else {
        cancel(prompt);
      }
      expect(await result).to.equal(submit ? "changed.csv" : undefined);
      await prompt.updateComplete;
    }
  });

  it("rejects empty and whitespace-only filenames without closing", async () => {
    const prompt = await fixture<WyFilenameInput>(html`<wy-filename-input></wy-filename-input>`);
    const result = prompt.open();
    const input = await promptInput(prompt);
    expect(input.value).to.equal("untitled");
    for (const filename of ["", "   "]) {
      input.value = filename;
      expect(input.checkValidity()).to.equal(false);
      input.form!.requestSubmit();
      expect(prompt.shadowRoot!.querySelector("wy-overlay")!.show).to.equal(true);
    }
    cancel(prompt);
    expect(await result).to.equal(undefined);
  });

  it("settles replaced and disconnected prompts without orphaning calls", async () => {
    const prompt = await fixture<WyFilenameInput>(html`<wy-filename-input></wy-filename-input>`);
    const first = prompt.open("txt");
    const second = prompt.open("csv");
    expect(await first).to.equal(undefined);
    expect((await promptInput(prompt)).value).to.equal("untitled.csv");
    prompt.remove();
    expect(await second).to.equal(undefined);
  });

  it("ignores a replaced dialog's delayed close event", async () => {
    const prompt = await fixture<WyFilenameInput>(html`<wy-filename-input></wy-filename-input>`);
    const first = prompt.open("txt");
    await promptInput(prompt);
    const oldOverlay = prompt.shadowRoot!.querySelector("wy-overlay")!;
    const second = prompt.open("csv");
    expect(await first).to.equal(undefined);
    const input = await promptInput(prompt);
    oldOverlay.handleClose();
    input.value = "data.json";
    input.form!.requestSubmit();
    expect(await second).to.equal("data.json");
  });

  it("settles cancellation when the native dialog closes", async () => {
    const prompt = await fixture<WyFilenameInput>(html`<wy-filename-input></wy-filename-input>`);
    const result = prompt.open("txt");
    await promptInput(prompt);
    prompt.shadowRoot!.querySelector("wy-overlay")!.shadowRoot!.querySelector("dialog")!.close();
    expect(await result).to.equal(undefined);
  });

  it("stays open with an inline error when the submit handler rejects the name", async () => {
    const prompt = await fixture<WyFilenameInput>(html`<wy-filename-input></wy-filename-input>`);
    const submitted: string[] = [];
    let settle: ((error?: string) => void) | undefined;
    const result = prompt.open("md", (filename) => {
      submitted.push(filename);
      return new Promise<string | undefined>((resolve) => {
        settle = resolve;
      });
    });
    const input = await promptInput(prompt);
    input.value = "taken.md";
    input.form!.requestSubmit();
    await waitUntil(() => settle !== undefined);
    await prompt.updateComplete;
    expect(input.disabled).to.equal(true);
    expect(prompt.shadowRoot!.querySelector("wy-button")!.disabled).to.equal(true);
    expect(promptError(prompt)).to.equal(undefined);

    settle!("Name taken");
    await waitUntil(() => promptError(prompt) === "Name taken");
    expect(promptOpen(prompt)).to.equal(true);
    expect(input.disabled).to.equal(false);
    expect(input.getAttribute("aria-invalid")).to.equal("true");
    expect(input.getAttribute("part")).to.contain("wy-is-invalid");
    expect(prompt.shadowRoot!.activeElement).to.equal(input);
    expect(input.selectionStart).to.equal(0);
    expect(input.selectionEnd).to.equal("taken".length);

    // A second submit of the same name is handled again rather than being short-circuited.
    settle = undefined;
    input.form!.requestSubmit();
    await waitUntil(() => settle !== undefined);
    settle!("Still taken");
    await waitUntil(() => promptError(prompt) === "Still taken");

    input.value = "free.md";
    input.dispatchEvent(new Event("input"));
    await prompt.updateComplete;
    expect(promptError(prompt)).to.equal(undefined);
    expect(input.getAttribute("part")).to.not.contain("wy-is-invalid");

    settle = undefined;
    input.form!.requestSubmit();
    await waitUntil(() => settle !== undefined);
    settle!(undefined);
    expect(await result).to.equal("free.md");
    expect(submitted).to.deep.equal(["taken.md", "taken.md", "free.md"]);
    await prompt.updateComplete;
    expect(promptOpen(prompt)).to.equal(false);
  });

  it("closes and rejects when the submit handler throws", async () => {
    const prompt = await fixture<WyFilenameInput>(html`<wy-filename-input></wy-filename-input>`);
    const error = new Error("Upload failed");
    const result = prompt.open("md", async () => {
      throw error;
    });
    const input = await promptInput(prompt);
    input.form!.requestSubmit();
    expect(await result.catch((failure: unknown) => failure)).to.equal(error);
    await prompt.updateComplete;
    expect(promptOpen(prompt)).to.equal(false);
  });

  it("settles a prompt dismissed while the submit handler runs once the handler finishes", async () => {
    const prompt = await fixture<WyFilenameInput>(html`<wy-filename-input></wy-filename-input>`);
    for (const outcome of ["Name taken", undefined]) {
      let settle: ((error?: string) => void) | undefined;
      const result = prompt.open("md", () => {
        return new Promise<string | undefined>((resolve) => {
          settle = resolve;
        });
      });
      const input = await promptInput(prompt);
      input.value = "slow.md";
      input.form!.requestSubmit();
      await waitUntil(() => settle !== undefined);
      cancel(prompt);
      await prompt.updateComplete;
      expect(promptOpen(prompt)).to.equal(false);
      let settled = false;
      void result.then(() => (settled = true));
      await prompt.updateComplete;
      expect(settled).to.equal(false);
      settle!(outcome);
      // A file created by the handler is still reported; a rejected name becomes a cancellation.
      expect(await result).to.equal(outcome ? undefined : "slow.md");
    }
  });
});

describe("file creation", () => {
  const originalUpload = CreateFilesController.prototype.uploadFile;
  const originalFetch = globalThis.fetch;
  // Editing needs a text/code/html preview format and an app with write access and create permission.
  const createdFile = { id: 42, name: "created.txt", kind: "text", preview_format: "text" } as FileType;
  const editableApp = { id: 1, access: AccessType.Write, permissions: [PermissionType.Create] } as AppType;
  let uploads: { file: File; action?: ActionType }[];
  let requests: Parameters<typeof fetch>[0][];

  beforeEach(() => {
    uploads = [];
    requests = [];
    globalThis.fetch = async (input) => {
      requests.push(input);
      throw new Error("Unexpected network request while prompting for a filename");
    };
    CreateFilesController.prototype.uploadFile = async (file, action) => {
      if (!file) {
        throw new Error("Expected a file");
      }
      uploads.push({ file, action: typeof action === "function" ? action(createdFile) : action });
      return createdFile;
    };
  });

  afterEach(() => {
    CreateFilesController.prototype.uploadFile = originalUpload;
    globalThis.fetch = originalFetch;
  });

  for (const tag of ["wy-file-create", "wy-file-new", "wy-file"] as const) {
    it(`${tag} prompts without preflight requests and uploads the submitted name unchanged`, async () => {
      const component = await fixture<WyFileCreate | WyFileNew | WyFile>(document.createElement(tag));
      component.app = editableApp;
      if (tag === "wy-file-create") {
        // Standalone wy-file-create has no feature context, which would disable editing.
        (component as WyFileCreate).componentFeatures = new ComponentFeatures({ [Feature.FileEdit]: true });
      }
      for (const filename of ["notes.md", "data.csv", "notes", ".gitignore", ".env"]) {
        const result = component.createFile("txt");
        const prompt = await componentPrompt(component);
        const input = await promptInput(prompt);
        expect(input.value).to.equal("untitled.txt");
        expect(requests).to.have.length(0);
        const count = uploads.length;
        input.value = filename;
        input.form!.requestSubmit();
        expect(await result).to.equal(createdFile);
        expect(uploads.length).to.equal(count + 1);
        expect(uploads.at(-1)?.file.name).to.equal(filename);
        expect(uploads.at(-1)?.file.size).to.equal(0);
        expect(uploads.at(-1)?.action).to.equal(ActionType.Edit);
        if (component instanceof WyFile) {
          expect(component.fileId).to.equal(createdFile.id);
          expect(component.edit).to.equal(true);
        }
        await prompt.updateComplete;
      }
    });

    it(`${tag} accepts no extension and cancels without creating or opening a file`, async () => {
      const component = await fixture<WyFileCreate | WyFileNew | WyFile>(document.createElement(tag));
      const result = component.createFile();
      const prompt = await componentPrompt(component);
      const input = await promptInput(prompt);
      expect(input.value).to.equal("untitled");
      expect(uploads).to.have.length(0);
      expect(requests).to.have.length(0);
      cancel(prompt);
      expect(await result).to.equal(undefined);
      expect(uploads).to.have.length(0);
      if (component instanceof WyFile) {
        expect(component.fileId).to.equal(undefined);
        expect(component.edit).to.equal(false);
      }
    });
  }

  for (const tag of ["wy-file-create", "wy-file-new", "wy-file"] as const) {
    it(`${tag} keeps the prompt open with an error for a taken name and creates the next name`, async () => {
      CreateFilesController.prototype.uploadFile = async (file, action) => {
        if (!file) {
          throw new Error("Expected a file");
        }
        uploads.push({ file, action: typeof action === "function" ? action(createdFile) : action });
        if (file.name === "taken.md") {
          throw conflictError();
        }
        return createdFile;
      };
      const component = await fixture<WyFileCreate | WyFileNew | WyFile>(document.createElement(tag));
      component.app = editableApp;
      if (tag === "wy-file-create") {
        (component as WyFileCreate).componentFeatures = new ComponentFeatures({ [Feature.FileEdit]: true });
      }
      const result = component.createFile("md");
      const prompt = await componentPrompt(component);
      const input = await promptInput(prompt);
      input.value = "taken.md";
      input.form!.requestSubmit();
      await waitUntil(() => promptError(prompt) !== undefined);
      expect(promptError(prompt)).to.equal("A file with this name already exists. Choose a different name.");
      expect(promptOpen(prompt)).to.equal(true);
      expect(uploads.map((upload) => upload.file.name)).to.deep.equal(["taken.md"]);
      if (component instanceof WyFile) {
        expect(component.fileId).to.equal(undefined);
      }

      input.value = "free.md";
      input.dispatchEvent(new Event("input"));
      input.form!.requestSubmit();
      expect(await result).to.equal(createdFile);
      expect(uploads.map((upload) => upload.file.name)).to.deep.equal(["taken.md", "free.md"]);
      expect(uploads.at(-1)?.action).to.equal(ActionType.Edit);
      if (component instanceof WyFile) {
        expect(component.fileId).to.equal(createdFile.id);
      }
      await prompt.updateComplete;
      expect(promptOpen(prompt)).to.equal(false);
    });
  }

  it("cancels without a file when a taken name is dismissed", async () => {
    CreateFilesController.prototype.uploadFile = async () => {
      throw conflictError();
    };
    const component = await fixture<WyFileCreate>(html`<wy-file-create></wy-file-create>`);
    const result = component.createFile("md");
    const prompt = await componentPrompt(component);
    const input = await promptInput(prompt);
    input.form!.requestSubmit();
    await waitUntil(() => promptError(prompt) !== undefined);
    cancel(prompt);
    expect(await result).to.equal(undefined);
  });

  it("selects created files that cannot be edited instead of opening them", async () => {
    const imageFile = { id: 43, name: "image.png", kind: "image" } as FileType;
    let action: ActionType | undefined;
    CreateFilesController.prototype.uploadFile = async (_file, createAction) => {
      action = typeof createAction === "function" ? createAction(imageFile) : createAction;
      return imageFile;
    };
    const component = await fixture<WyFileCreate>(html`<wy-file-create></wy-file-create>`);
    component.app = editableApp;
    component.componentFeatures = new ComponentFeatures({ [Feature.FileEdit]: true });
    const result = component.createFile("txt");
    const input = await promptInput(await componentPrompt(component));
    input.value = "image.png";
    input.form!.requestSubmit();
    expect(await result).to.equal(imageFile);
    expect(action).to.equal(ActionType.Select);
  });

  it("keeps the menu options and feature/permission gates, with md only as an initial suggestion", async () => {
    const component = await fixture<WyFileCreate>(html`<wy-file-create></wy-file-create>`);
    component.app = { id: 1, permissions: [PermissionType.Create] } as AppType;
    component.componentFeatures = new ComponentFeatures({
      [Feature.FileCreate]: true,
      [Feature.FileUpload]: true,
      [Feature.CloudFiles]: true,
    });
    await component.updateComplete;
    const items = () => Array.from(component.shadowRoot!.querySelectorAll("wy-dropdown-item"));
    expect(items().map((item) => item.textContent?.trim())).to.deep.equal(["New file", "From device", "From cloud"]);
    let deviceOpened = false;
    let cloudOpened = false;
    component.getFileInput = async () => {
      deviceOpened = true;
      return [];
    };
    component.getCloudFiles = async () => {
      cloudOpened = true;
      return [];
    };
    items()[1].click();
    items()[2].click();
    expect(deviceOpened).to.equal(true);
    expect(cloudOpened).to.equal(true);
    items()[0].click();
    const prompt = await componentPrompt(component);
    const input = await promptInput(prompt);
    expect(input.value).to.equal("untitled.md");
    expect(uploads).to.have.length(0);
    cancel(prompt);

    component.componentFeatures = new ComponentFeatures({
      [Feature.FileCreate]: false,
      [Feature.FileUpload]: true,
      [Feature.CloudFiles]: true,
    });
    await component.updateComplete;
    expect(items().map((item) => item.textContent?.trim())).to.deep.equal(["From device", "From cloud"]);
    component.app = { ...component.app, permissions: [] };
    await component.updateComplete;
    expect(items()).to.have.length(0);
  });

  it("propagates an upload failure without trying another filename", async () => {
    let attempts = 0;
    const error = new Error("Upload failed");
    CreateFilesController.prototype.uploadFile = async () => {
      attempts++;
      throw error;
    };
    const component = await fixture<WyFileCreate>(html`<wy-file-create></wy-file-create>`);
    const result = component.createFile("txt").catch((failure: unknown) => failure);
    const input = await promptInput(await componentPrompt(component));
    input.value = "notes.txt";
    input.form!.requestSubmit();
    expect(await result).to.equal(error);
    expect(attempts).to.equal(1);
  });
});

describe("empty file creation", () => {
  const app = { id: 1, permissions: [PermissionType.Create] } as AppType;
  const createdFile = { id: 42, name: "free.md", kind: "text" } as FileType;

  /** A controller with resolved contexts whose upload runs the real create mutation against the stubbed server. */
  async function createController(weavy: Weavy) {
    const host = await fixture<LitElement & { app?: AppType }>(html`<wy-file-create></wy-file-create>`);
    host.app = app;
    const controller = new CreateFilesController(host);
    // The context consumers never resolve in a fixture without providers; supply the resolved values directly.
    (controller as unknown as { weavyContext: { value: Weavy } }).weavyContext = { value: weavy };
    const mutation = new MutationObserver(
      weavy.queryClient,
      getCreateFileMutationOptions(weavy, { id: 1, name: "Test user" }, app),
    );
    controller.uploadFile = async (file) => {
      await mutation.mutate({ blob: { id: 2, name: file!.name, size: 0, media_type: "text/plain" } });
      return createdFile;
    };
    return controller;
  }

  function conflicts(weavy: Weavy) {
    return weavy.queryClient
      .getMutationCache()
      .getAll()
      .filter((mutation) => (mutation.state.context as { status?: { state?: string } })?.status?.state === "conflict");
  }

  it("returns undefined for a taken name and drops the conflict from the mutation cache", async () => {
    const weavy = new Weavy();
    weavy.fetch = async () => Response.json({ status: 409, detail: "Conflict" }, { status: 409 });
    try {
      const controller = await createController(weavy);
      expect(await controller.createEmptyFile("taken.md")).to.equal(undefined);
      expect(conflicts(weavy)).to.have.length(0);
      expect(weavy.queryClient.getMutationCache().getAll()).to.have.length(0);
    } finally {
      weavy.destroy();
    }
  });

  it("rethrows other failures and keeps them in the mutation cache", async () => {
    const weavy = new Weavy();
    weavy.fetch = async () => Response.json({ status: 500, detail: "Server error" }, { status: 500 });
    try {
      const controller = await createController(weavy);
      const error = await controller.createEmptyFile("notes.md").catch((failure: unknown) => failure);
      expect(error).to.be.instanceOf(Error).with.property("message", "Server error");
      expect(weavy.queryClient.getMutationCache().getAll()).to.have.length(1);
    } finally {
      weavy.destroy();
    }
  });

  it("returns the created file", async () => {
    const weavy = new Weavy();
    weavy.fetch = async () => Response.json(createdFile);
    try {
      const controller = await createController(weavy);
      expect(await controller.createEmptyFile("free.md")).to.equal(createdFile);
    } finally {
      weavy.destroy();
    }
  });
});

describe("file status button", () => {
  const app = { id: 1, permissions: [PermissionType.Create] } as AppType;
  const blob = { id: 2, name: "notes.txt", size: 0, media_type: "text/plain" };

  /** A menu with real contexts, so it tracks the mutation cache of the app like in a files block. */
  async function createMenu(weavy: Weavy) {
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    new ContextProvider(host, { context: WeavyContext, initialValue: weavy });
    new ContextProvider(host, { context: AppContext, initialValue: app });
    const menu = document.createElement("wy-file-create");
    host.appendChild(menu);
    await menu.updateComplete;
    return menu;
  }

  function statusButton(menu: WyFileCreate) {
    return menu.shadowRoot!.querySelector("wy-button[kind=icon]");
  }

  for (const [status, title] of [
    [409, "File conflict"],
    [500, "Upload error"],
  ] as const) {
    it(`shows the status button for a ${status} failure but not after a successful upload`, async () => {
      const weavy = new Weavy();
      let respond = () => Response.json({ id: 42, name: blob.name, kind: "text" });
      weavy.fetch = async () => respond();
      try {
        const menu = await createMenu(weavy);
        const mutation = new MutationObserver(
          weavy.queryClient,
          getCreateFileMutationOptions(weavy, { id: 1, name: "Test user" }, app),
        );
        expect(statusButton(menu)).to.equal(null);

        await mutation.mutate({ blob });
        await menu.updateComplete;
        // A finished upload leaves nothing to act on, so there is no button for it.
        expect(statusButton(menu)).to.equal(null);

        respond = () => Response.json({ status, detail: "Cannot create file" }, { status });
        await mutation.mutate({ blob }).catch(() => undefined);
        await waitUntil(() => statusButton(menu) !== null);
        expect(statusButton(menu)!.getAttribute("title")).to.equal(title);
      } finally {
        weavy.destroy();
      }
    });
  }
});

describe("file creation mutation errors", () => {
  for (const status of [409, 500]) {
    it(`retains existing ${status === 409 ? "conflict" : "error"} handling without filename queries`, async () => {
      const weavy = new Weavy();
      const requests: string[] = [];
      weavy.fetch = async (url, options) => {
        requests.push(`${options?.method} ${url}`);
        return Response.json({ status, detail: "Cannot create file" }, { status });
      };
      const app = { id: 1 } as AppType;
      const blob = { id: 2, name: "notes.txt", size: 0, media_type: "text/plain" };
      const mutation = new MutationObserver(
        weavy.queryClient,
        getCreateFileMutationOptions(weavy, { id: 1, name: "Test user" }, app),
      );
      try {
        const error = await mutation.mutate({ blob }).catch((failure: unknown) => failure);
        expect(error).to.be.instanceOf(Error);
        expect(requests).to.deep.equal(["POST /api/apps/1/files"]);
        const state = weavy.queryClient.getMutationCache().getAll()[0].state;
        expect(state.context).to.have.nested.property("status.state", status === 409 ? "conflict" : "error");
      } finally {
        weavy.destroy();
      }
    });
  }
});
