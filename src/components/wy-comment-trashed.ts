import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";

import chatCss from "../scss/all.scss";

import "./wy-button";

@customElement("wy-comment-trashed")
@localized()
export default class WyCommentTrashed extends LitElement {
  
  static override styles = chatCss;
  
  @property({ type: Number })
  commentId!: number;

  private dispatchRestore() {
    const event = new CustomEvent("restore", { detail: { id: this.commentId} });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      <div class="wy-item wy-item-lg">
        <div class="wy-item-body">${msg("Comment was trashed.")}</div>
        <wy-button @click=${() => this.dispatchRestore()} class="wy-button-variant">${msg("Undo")}</wy-button>
      </div>
    `;
  }
}
