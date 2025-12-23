import { LitElement, html } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { MemberType } from "../types/members.types";
import type { NamedEvent } from "../types/generic.types";
import type { PostRestoreEventType } from "../types/posts.events";

import hostContentsCss from "../scss/host-contents.scss";
import postCss from "../scss/components/post.scss";

import "./ui/wy-button";
import "./ui/wy-item";
import "./ui/wy-avatar";

declare global {
  interface HTMLElementTagNameMap {
    "wy-post-trashed": WyPostTrashed;
  }
}

/**
 * Trashed post placeholder shown when a post has been moved to trash.
 *
 * **Used sub components:**
 *
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 *
 * @csspart wy-post - Root post container.
 *
 * @fires {PostRestoreEventType} restore - Emitted when the trashed post should be restored.
 */
@customElement("wy-post-trashed")
@localized()
export class WyPostTrashed extends LitElement {
  static override styles = [postCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number })
  postId!: number;

  /**
   * Author metadata for the trashed post.
   */
  @property({ attribute: false })
  createdBy!: MemberType;

  /**
   * Emit a `restore` event requesting restoration of the trashed post.
   *
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchRestore() {
    const event: PostRestoreEventType = new (CustomEvent as NamedEvent)("restore", { detail: { id: this.postId } });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      <div part="wy-post wy-post-trashed">
        <wy-item part="wy-post-header" size="md" noPadding>
          <wy-avatar
            slot="image"
            .src="${this.createdBy.avatar_url}"
            .isAgent=${this.createdBy.is_agent}
            .size=${48}
            .name=${this.createdBy.name}
          ></wy-avatar>
          <span part="wy-trashed" slot="title">${msg("Post was trashed.")}</span>
          <wy-button small slot="actions" @click=${() => this.dispatchRestore()} color="variant"
            >${msg("Undo")}</wy-button
          >
        </wy-item>
      </div>
    `;
  }
}
