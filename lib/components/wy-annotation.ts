import { html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import type { FileType } from "../types/files.types";
import type { FileOpenEventType } from "../types/files.events";
import { fileSizeAsString, getExtension, getIcon, getKind, getProvider } from "../utils/files";
import { NamedEvent } from "../types/generic.types";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import hostContentCss from "../scss/host-contents.scss";

import "./ui/wy-icon";
import "./ui/wy-button";
import { WeavySubComponent } from "../classes/weavy-sub-component";

declare global {
  interface HTMLElementTagNameMap {
    "wy-annotation": WyAnnotation;
    "wy-annotation-list": WyAnnotationList;
  }
}

/**
 * Annotation displayed as a small button.
 *
 * **Used sub components**
 *
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * 
 * @fires {FileOpenEventType} file-open - When opening a file in preview is requested
 * @csspart wy-annotation - Annotation button.
 * @csspart wy-annotation-icon - The icon of the annotation button.
 * @csspart wy-annotation-text - The text of the annotation button.
 */
@customElement("wy-annotation")
export class WyAnnotation extends WeavySubComponent {
  static override styles = [hostContentCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * The annotation file to display.
   */
  @property({ type: Object, attribute: false})
  file!: FileType;

  /**
   * Triggers file-open event.
   * @internal
   */
  dispatchFileOpen(e: Event, file: FileType) {
    e.preventDefault();
    const event: FileOpenEventType = new (CustomEvent as NamedEvent)("file-open", { detail: { fileId: file.id } });
    return this.dispatchEvent(event);
  }

  override render() {
    const fileSize = this.file.size && this.file.size > 0 ? fileSizeAsString(this.file.size) : null;
    const ext = getExtension(this.file.name);
    const { icon } = getIcon(this.file.name);
    const kind = getKind(this.file.name);
    const provider = getProvider(this.file.provider);
    const title = `${this.file.name}${fileSize ? ` • ${fileSize}` : ""}`;

    return html`
      <wy-button
        part="wy-annotation"
        @click=${(e: Event) => {
          !e.defaultPrevented && !this.file.is_trashed && this.dispatchFileOpen(e, this.file);
        }}
        kind="filled"
        small
        title=${title}
      >
        <wy-icon
          part="wy-annotation-icon"
          name=${icon}
          .overlayName=${provider}
          size="24"
          kind=${kind}
          ext=${ext}
        ></wy-icon>
        <span part="wy-annotation-text">${this.file.name}</span>
      </wy-button>
    `;
  }
}

/**
 * List of annotations. Displayed as inline buttons.
 *
 * **Used sub components**
 *
 * - [`<wy-annotation>`](./wy-annotation.ts)
 * 
 * @fires {FileOpenEventType} file-open - When opening a file in preview is requested
 * @csspart wy-annotations - Wrapper for the annotations.
 */
@customElement("wy-annotation-list")
export class WyAnnotationList extends WeavySubAppComponent {
  static override styles = [hostContentCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * The annotations file list to display.
   */
  @property({ attribute: false })
  files: FileType[] = [];

  override render() {
    if (this.settings?.annotations === "none") {
      return nothing;
    }

    return html`
      <div part="wy-annotations">
        ${this.files.map((file: FileType) => html`<wy-annotation .file=${file}></wy-annotation>`)}
      </div>
    `;
  }
}
