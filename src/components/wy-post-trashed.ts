import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import chatCss from "../scss/all.scss";
import { localized, msg } from "@lit/localize";

import "./wy-button";

@customElement("wy-post-trashed")
@localized()
export default class WyPostTrashed extends LitElement {
  
  static override styles = chatCss;

  @property({ type: Number })
  postId!: number;

  private dispatchRestore() {
    const event = new CustomEvent("restore", { detail: {} });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      <div class="wy-item wy-item-lg">
        <div class="wy-item-body">${msg("Post was trashed.")}</div>
        <wy-button @click=${() => this.dispatchRestore()} class="wy-button-variant">${msg("Undo")}</wy-button>
      </div>
    `;
  }
}
