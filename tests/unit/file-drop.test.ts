import { aTimeout, expect, fixture, html, waitUntil } from "@open-wc/testing";
import { ContextProvider } from "@lit/context";
import { LitElement, nothing } from "lit";

import "../utils/version";
// Library entry first: importing the editor module alone hits a circular import.
import "../../lib";
import { DropZoneController } from "../../lib/controllers/dropzone-controller";
import { WyEditorMsg } from "../../lib/components/wy-editor-msg";
import type { WyEditorCore } from "../../lib/components/wy-editor-core";
import { Weavy } from "../../lib/client/weavy";
import { WeavyContext } from "../../lib/contexts/weavy-context";
import { UserContext } from "../../lib/contexts/user-context";
import { AppContext } from "../../lib/contexts/apps-context";
import { PermissionType, type AppType } from "../../lib/types/app.types";
import type { DropFilesEventType } from "../../lib/types/files.events";

/** A drop zone that can nest another in its shadow tree, like a preview's comment editor in `<wy-files>`. */
class TestDropZone extends LitElement {
  dropZone = new DropZoneController(this);

  droppedFiles: File[][] = [];

  constructor() {
    super();
    this.addEventListener("drop-files", (e) => this.droppedFiles.push([...((e as DropFilesEventType).detail.files ?? [])]));
  }

  override render() {
    return html`<div part="target"></div>${this.hasAttribute("nested") ? html`<test-drop-zone></test-drop-zone>` : nothing}`;
  }
}
customElements.define("test-drop-zone", TestDropZone);

/** Dispatch a drag event carrying one file from inside the zone. */
function dispatchDrag(zone: TestDropZone, type: "dragover" | "drop", file: File) {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  const event = new DragEvent(type, { bubbles: true, composed: true, cancelable: true, dataTransfer });
  // WebKit ignores `dataTransfer` in the init dictionary.
  if (!event.dataTransfer) {
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  }
  zone.shadowRoot!.querySelector("[part=target]")!.dispatchEvent(event);
  return event;
}

describe("file drop zones", () => {
  it("takes a drop on a single zone", async () => {
    const zone = await fixture<TestDropZone>(html`<test-drop-zone></test-drop-zone>`);
    const file = new File(["text"], "notes.txt", { type: "text/plain" });

    dispatchDrag(zone, "dragover", file);
    expect(zone.dropZone.isDragActive).to.equal(true);
    const drop = dispatchDrag(zone, "drop", file);

    expect(drop.defaultPrevented).to.equal(true);
    expect(zone.droppedFiles.map((files) => files.map((f) => f.name))).to.deep.equal([["notes.txt"]]);
    expect(zone.dropZone.isDragActive).to.equal(false);
  });

  it("gives a drop on a nested zone only to the nested zone and resets the outer drag state", async () => {
    const outer = await fixture<TestDropZone>(html`<test-drop-zone nested></test-drop-zone>`);
    const inner = outer.shadowRoot!.querySelector<TestDropZone>("test-drop-zone")!;
    await inner.updateComplete;
    const file = new File(["text"], "notes.txt", { type: "text/plain" });

    dispatchDrag(inner, "dragover", file);
    expect(outer.dropZone.isDragActive).to.equal(true);
    expect(inner.dropZone.isDragActive).to.equal(true);
    dispatchDrag(inner, "drop", file);

    expect(inner.droppedFiles.map((files) => files.map((f) => f.name))).to.deep.equal([["notes.txt"]]);
    expect(outer.droppedFiles).to.deep.equal([]);
    expect(inner.dropZone.isDragActive).to.equal(false);
    expect(outer.dropZone.isDragActive).to.equal(false);
  });

  it("stays inactive for drags without files, such as dragged text", async () => {
    const zone = await fixture<TestDropZone>(html`<test-drop-zone></test-drop-zone>`);
    const target = zone.shadowRoot!.querySelector("[part=target]")!;
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", "selected text");

    for (const type of ["dragstart", "dragenter", "dragover"]) {
      const event = new DragEvent(type, { bubbles: true, composed: true, cancelable: true, dataTransfer });
      if (!event.dataTransfer) {
        Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
      }
      target.dispatchEvent(event);
    }

    expect(zone.dropZone.isDragActive).to.equal(false);
  });
});

describe("pasted files in the message editor", () => {
  const originalHandleUploadFiles = Object.getOwnPropertyDescriptor(WyEditorMsg.prototype, "handleUploadFiles")!;

  afterEach(() => {
    Object.defineProperty(WyEditorMsg.prototype, "handleUploadFiles", originalHandleUploadFiles);
  });

  it("attaches pasted files without passing the drop-files event on", async () => {
    const uploaded: string[][] = [];
    Object.defineProperty(WyEditorMsg.prototype, "handleUploadFiles", {
      ...originalHandleUploadFiles,
      value: async (files: File[] | FileList | null) => {
        uploaded.push([...(files ?? [])].map((file) => file.name));
      },
    });
    const wrapper = await fixture<HTMLDivElement>(html`<div><wy-editor-comment></wy-editor-comment></div>`);
    const editor = wrapper.querySelector("wy-editor-comment")!;
    await editor.updateComplete;
    const outerEvents: Event[] = [];
    wrapper.addEventListener("drop-files", (e) => outerEvents.push(e));

    // As `wy-editor-core` dispatches pasted files.
    const source = document.createElement("span");
    editor.shadowRoot!.appendChild(source);
    const pasted = new File(["text"], "pasted.txt", { type: "text/plain" });
    source.dispatchEvent(new CustomEvent("drop-files", { detail: { files: [pasted] }, bubbles: true, composed: true }));

    expect(uploaded).to.deep.equal([["pasted.txt"]]);
    expect(outerEvents).to.deep.equal([]);
  });
});

describe("text files dropped on the editor text", () => {
  const originalHandleUploadFiles = Object.getOwnPropertyDescriptor(WyEditorMsg.prototype, "handleUploadFiles")!;
  let weavy: Weavy;

  beforeEach(() => {
    weavy = new Weavy();
    // CodeMirror only loads once the client has a url.
    weavy.url = "https://weavy.test";
    weavy.fetch = async () => Response.json({});
  });

  afterEach(() => {
    Object.defineProperty(WyEditorMsg.prototype, "handleUploadFiles", originalHandleUploadFiles);
    weavy.destroy();
  });

  /** A host with the contexts the editors need. */
  async function createHost() {
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    new ContextProvider(host, { context: WeavyContext, initialValue: weavy });
    new ContextProvider(host, { context: UserContext, initialValue: { id: 1, name: "Test user" } });
    new ContextProvider(host, {
      context: AppContext,
      initialValue: { id: 1, permissions: [PermissionType.Create] } as AppType,
    });
    return host;
  }

  /** Wait for the CodeMirror view and return its content element. */
  async function editorContent(core: WyEditorCore) {
    await waitUntil(() => core.editor, "CodeMirror view was not created", { timeout: 10000 });
    return core.shadowRoot!.querySelector<HTMLElement>(".cm-content")!;
  }

  /** Drop a text file at a point inside the editor text. */
  function dropTextFile(content: HTMLElement) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(["FILE CONTENTS"], "notes.txt", { type: "text/plain" }));
    const rect = content.getBoundingClientRect();
    const event = new DragEvent("drop", {
      bubbles: true,
      composed: true,
      cancelable: true,
      dataTransfer,
      clientX: rect.left + 5,
      clientY: rect.top + 5,
    });
    // WebKit ignores `dataTransfer` in the init dictionary.
    if (!event.dataTransfer) {
      Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    }
    content.dispatchEvent(event);
  }

  it("leaves dropped files to the host when ignoreFileDrops is set", async () => {
    const host = await createHost();
    const core = document.createElement("wy-editor-core");
    core.ignoreFileDrops = true;
    host.appendChild(core);
    const content = await editorContent(core);
    const hostDrops: DragEvent[] = [];
    host.addEventListener("drop", (e) => hostDrops.push(e));

    dropTextFile(content);
    // CodeMirror reads dropped files asynchronously.
    await aTimeout(300);

    expect(core.editor!.state.doc.toString()).to.equal("");
    expect(hostDrops).to.have.length(1);
  });

  it("inserts a dropped text file and keeps the drop inside the editor without ignoreFileDrops", async () => {
    const host = await createHost();
    const core = document.createElement("wy-editor-core");
    host.appendChild(core);
    const content = await editorContent(core);
    // Stands in for an outer drop zone such as `<wy-files>`.
    const hostDrops: DragEvent[] = [];
    host.addEventListener("drop", (e) => hostDrops.push(e));

    dropTextFile(content);

    await waitUntil(() => core.editor!.state.doc.toString() === "FILE CONTENTS", "Dropped text was not inserted");
    expect(hostDrops).to.have.length(0);
  });

  it("attaches a text file dropped on a message editor without inserting its contents", async () => {
    const uploaded: string[][] = [];
    Object.defineProperty(WyEditorMsg.prototype, "handleUploadFiles", {
      ...originalHandleUploadFiles,
      value: async (files: File[] | FileList | null) => {
        uploaded.push([...(files ?? [])].map((file) => file.name));
      },
    });
    const host = await createHost();
    const editor = document.createElement("wy-editor-comment");
    host.appendChild(editor);
    await editor.updateComplete;
    const core = editor.shadowRoot!.querySelector("wy-editor-core")!;
    const content = await editorContent(core);

    dropTextFile(content);
    await aTimeout(300);

    expect(uploaded).to.deep.equal([["notes.txt"]]);
    expect(core.editor!.state.doc.toString()).to.equal("");
  });

  it("keeps the drop overlay off the text while selected text is dragged in a message editor", async () => {
    const host = await createHost();
    const editor = document.createElement("wy-editor-comment");
    host.appendChild(editor);
    await editor.updateComplete;
    const core = editor.shadowRoot!.querySelector("wy-editor-core")!;
    const content = await editorContent(core);
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", "selected text");
    const dragstart = new DragEvent("dragstart", { bubbles: true, composed: true, cancelable: true, dataTransfer });
    if (!dragstart.dataTransfer) {
      Object.defineProperty(dragstart, "dataTransfer", { value: dataTransfer });
    }

    content.dispatchEvent(dragstart);
    await editor.updateComplete;

    // With the overlay up, the drop would hit it instead of the text.
    expect(editor.shadowRoot!.querySelector('[part~="wy-editor"]')!.getAttribute("part")).to.not.contain("wy-dragging");
    const rect = content.getBoundingClientRect();
    const hit = editor.shadowRoot!.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    expect(hit?.tagName.toLowerCase()).to.equal("wy-editor-core");
  });
});
