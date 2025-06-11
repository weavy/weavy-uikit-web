import { LitElement, html } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { FileType } from "../types/files.types";
import { FileOpenEventType } from "../types/files.events";
import { fileSizeAsString, getExtension, getIcon, getKind, getProvider } from "../utils/files";
import { NamedEvent } from "../types/generic.types";

import chatCss from "../scss/all.scss";

import "./base/wy-icon";
import "./base/wy-button";

/**
 * @fires {FileOpenEventType} file-open - When opening a file in preview is requested
 */
@customElement("wy-annotations-list")
export default class WyAttachmentsList extends LitElement {
  static override styles = chatCss;

  //protected exportParts = new ShadowPartsController(this);

  override createRenderRoot() {
    return this;
  }

  @property({ attribute: false })
  files: FileType[] = [];

  dispatchFileOpen(e: Event, file: FileType) {
    e.preventDefault();
    const event: FileOpenEventType = new (CustomEvent as NamedEvent)("file-open", { detail: { fileId: file.id } });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      <div>
        ${this.files.map((a: FileType) => {
          const fileSize = a.size && a.size > 0 ? fileSizeAsString(a.size) : null;
          const ext = getExtension(a.name);
          const { icon } = getIcon(a.name);
          const kind = getKind(a.name);
          const provider = getProvider(a.provider);
          const title = `${a.name}${fileSize ? ` • ${fileSize}` : ''}`;

          return html`
            <wy-button
              @click=${(e: Event) => {
                !e.defaultPrevented && !a.is_trashed && this.dispatchFileOpen(e, a);
              }}
              kind="filled"
              small
              title=${title}
            >
              <wy-icon name=${icon} .overlayName=${provider} size="24" kind=${kind} ext=${ext}></wy-icon>
              <span>${a.name}</span>
            </wy-button>
          `;
        })}
      </div>
    `;
  }
}
