import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { FileType } from "../types/files.types";
import { fileSizeAsString, getExtension, getIcon, getKind, getProvider } from "../utils/files";

import chatCss from "../scss/all.scss";
import "./wy-icon";

@customElement("wy-attachments-list")
export default class WyAttachmentsList extends LitElement {
  static override styles = chatCss;

  override createRenderRoot() {
    return this;
  }

  @property({ attribute: false })
  files: FileType[] = [];

  @property({ type: Number })
  limit: number = 3;

  dispatchFileOpen(e: Event, file: FileType) {
    e.preventDefault();
    const event = new CustomEvent("file-open", { detail: { file } });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      <div class="wy-list wy-list-bordered">
        ${this.files.map((a: FileType) => {
          const fileSize = a.size && a.size > 0 ? fileSizeAsString(a.size) : null;
          const ext = getExtension(a.name);
          const { icon } = getIcon(a.name);
          const kind = getKind(a.name);
          const prov = getProvider(a.provider);

          return html`
            <a
              @click=${(e: Event) => {
                !e.defaultPrevented && !a.is_trashed && this.dispatchFileOpen(e, a);
              }}
              class="wy-item wy-item-lg"
              href="#"
              title=${a.name}>
              <wy-icon name=${icon + (prov ? `+ ${prov} ` : "")} size="48" kind=${kind} ext=${ext}></wy-icon>
              <div class="wy-item-body ">
                <div class="wy-item-title">${a.name}</div>
                ${fileSize ? html`<div class="wy-item-text" title="{fileSize}">${fileSize}</div>` : ``}
              </div>
            </a>
          `;
        })}
      </div>
    `;
  }
}
