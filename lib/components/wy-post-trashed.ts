import { LitElement, html } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import chatCss from "../scss/all.scss"

import "./base/wy-button";

@customElement("wy-post-trashed")
@localized()
export default class WyPostTrashed extends LitElement {
  
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number })
  postId!: number;

  private dispatchRestore() {
    const event = new CustomEvent("restore", { detail: {} });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      <div class="wy-item">
        <div class="wy-item-body">${msg("Post was trashed.")}</div>
        <wy-button @click=${() => this.dispatchRestore()} color="variant">${msg("Undo")}</wy-button>
      </div>
    `;
  }
}
