import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import chatCss from "../scss/all.scss";
import type { ReactionType } from "../types/reactions.types";
import "./wy-avatar";

@customElement("wy-reaction-item")
export default class WyReactionItem extends LitElement {
  
  static override styles = chatCss;

  @property({ attribute: false })
  reaction!: ReactionType;

  override render() {
    return html` <div class="wy-item">
      <wy-avatar .src=${this.reaction.created_by.avatar_url} .name=${this.reaction.created_by.display_name}></wy-avatar>
      <div class="wy-item-body">${this.reaction.created_by.display_name}</div>
      <span class="wy-emoji">${this.reaction.content}</span>
    </div>`;
  }
}
