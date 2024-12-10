import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { fileSizeAsString, getExtension, getIcon, getKind, getProvider } from "../utils/files";
import type { FileProviderType } from "../types/files.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import chatCss from "../scss/all.scss"
import "./wy-icon";

@customElement("wy-attachment")
export default class WyAttachment extends LitElement {
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

  @property()
  name: string = "";

  @property()
  previewUrl: string = "";

  @property()
  url: string = "";

  @property()
  provider?: FileProviderType;

  @property({ type: Number })
  size: number = 0;

  override render() {
    const fileSize = this.size && this.size > 0 ? fileSizeAsString(this.size) : null;
    const ext = getExtension(this.name);
    const { icon } = getIcon(this.name);
    const kind = getKind(this.name);
    const provider = getProvider(this.provider);

    return html`
      <a href=${this.previewUrl || this.url} class="wy-item wy-list-item-lg" target="_blank" title=${this.name}>
        <wy-icon name=${icon} .overlayName=${provider} size="48" kind=${kind} ext=${ext}></wy-icon>
        <div class="wy-item-body ">
          <div class="wy-item-title">${this.name}</div>
          ${fileSize ? html`<div class="wy-item-text" title="${fileSize}">${fileSize}</div>` : ``}
        </div>
      </a>
    `;
  }
}
