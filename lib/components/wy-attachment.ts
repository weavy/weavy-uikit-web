import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import type { FileType } from "../types/files.types";
import { FileOpenEventType } from "../types/files.events";
import { fileSizeAsString, getExtension, getIcon, getKind, getProvider } from "../utils/files";
import { NamedEvent } from "../types/generic.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import itemCss from "../scss/components/item.scss";
import hostContentCss from "../scss/host-contents.scss";

import "./ui/wy-icon";
import "./ui/wy-item";

declare global {
  interface HTMLElementTagNameMap {
    "wy-attachment": WyAttachment;
    "wy-attachment-list": WyAttachmentList;
  }
}

/**
 * Attachment displayed as list item.
 *
 * **Used sub components:**
 *
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 *
 * @fires {FileOpenEventType} file-open - When opening a file in preview is requested
 */
@customElement("wy-attachment")
export class WyAttachment extends LitElement {
  static override styles = [itemCss, hostContentCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Attachment file to display.
   */
  @property({ attribute: false })
  file!: FileType;

  /**
   * Triggers file-open event.
   *
   * @param e
   * @param file
   * @returns
   */
  protected dispatchFileOpen(e: Event, file: FileType) {
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

    return html`    
      <wy-item
        @click=${(e: Event) => {
          !e.defaultPrevented && !this.file.is_trashed && this.dispatchFileOpen(e, this.file);
        }}
        size="md"
        title=${this.file.name}
        url=${ifDefined(this.file.download_url ?? this.file.external_url)}
        interactive
      >
        <wy-icon slot="image" name=${icon} .overlayName=${provider} size="48" kind=${kind} ext=${ext}></wy-icon>
        <span slot="title">${this.file.name}</span>
        ${fileSize ? html`<span slot="text" title="${fileSize}">${fileSize}</span>` : nothing}
      </wy-item>
    `;
  }
}

/**
 * List for displaying attachments.
 *
 * **Used sub components:**
 *
 * - [`<wy-attachment>`](./wy-attachment.ts)
 * - [`<wy-item-list>`](./ui/wy-item.ts)
 *
 * @fires {FileOpenEventType} file-open - When opening a file in preview is requested
 */
@customElement("wy-attachment-list")
export class WyAttachmentList extends LitElement {
  static override styles = [itemCss, hostContentCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * List of files to display in list.
   */
  @property({ attribute: false })
  files: FileType[] = [];

  /**
   * Filled background.
   */
  @property({ type: Boolean })
  filled = false;

  protected dispatchFileOpen(file: FileType) {
    const event: FileOpenEventType = new (CustomEvent as NamedEvent)("file-open", { detail: { fileId: file.id } });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      <wy-item-list rounded ?filled=${this.filled}>
        ${this.files.map((attachment: FileType) => {
          return html`<wy-attachment @file-open=${() => this.dispatchFileOpen(attachment)} .file=${attachment}></wy-attachment>`;
        })}
      </wy-item-list>
    `;
  }
}
