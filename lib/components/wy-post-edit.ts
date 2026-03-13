import { html, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import type { MutatePostProps, PostType } from "../types/posts.types";
import { MutationController } from "../controllers/mutation-controller";
import { getUpdatePostMutationOptions } from "../data/posts";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { PostEditEventType } from "../types/posts.events";
import type { NamedEvent } from "../types/generic.types";
import type { MsgEditorSubmitEventType } from "../types/editor.events";
import { relativeTime } from "../utils/datetime";

import postCss from "../scss/components/post.scss";
import textCss from "../scss/components/text.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-button";
import "./ui/wy-icon";
import "./ui/wy-item";
import "./wy-editor-msg";

declare global {
  interface HTMLElementTagNameMap {
    "wy-post-edit": WyPostEdit;
  }
}

/**
 * Post edit UI for editing an existing post.
 *
 * **Used sub components:**
 *
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-editor-msg>`](./wy-editor-msg.ts)
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 *
 * @csspart wy-post - Root post container.
 * @csspart wy-post-header - Header area with avatar and close button.
 *
 * @fires {PostEditEventType} edit - Emitted when editable state should change.
 */
@customElement("wy-post-edit")
@localized()
export class WyPostEdit extends WeavySubAppComponent {
  static override styles = [postCss, textCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Post data.
   */
  @property({ attribute: false })
  post!: PostType;


  /**
   * Mutation controller used to persist post updates.
   *
   * @internal
   */
  private updatePostMutation = new MutationController<PostType, Error, MutatePostProps, unknown>(this);

  /**
   * Emit an `edit` event toggling edit mode for the post.
   *
   * @param edit - Desired edit state.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchEdit(edit: boolean) {
    const event: PostEditEventType = new (CustomEvent as NamedEvent)("edit", { detail: { edit: edit } });
    return this.dispatchEvent(event);
  }

  /**
   * Handle editor submit events and trigger the post update mutation.
   *
   * @param e - Editor submit detail containing updated content.
   */
  private async handleSubmit(e: MsgEditorSubmitEventType) {
    const app = await this.whenApp();
    const user = await this.whenUser();
    void this.updatePostMutation.mutate({
      id: this.post.id,
      app_id: app.id,
      user, 
      text: e.detail.text,
      meeting_id: e.detail.meetingId,
      blobs: e.detail.blobs,
      attachments: e.detail.attachments,
      poll_options: e.detail.pollOptions,
      embed_id: e.detail.embedId,
    });

    this.dispatchEdit(false);
  }

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("weavy") || changedProperties.has("app")) && this.weavy && this.app) {
      await this.updatePostMutation.trackMutation(getUpdatePostMutationOptions(this.weavy, ["posts", this.app.id]));
    }
  }

  override render() {
    const dateFromNow = relativeTime(this.weavy?.locale, new Date(this.post.created_at));

    return html`
      <div part="wy-post">
        <wy-item part="wy-post-header" align="top" size="md" noPadding>
          <wy-avatar
            slot="image"
            .src="${this.post.created_by.avatar_url}"
            .isAgent=${this.post.created_by.is_agent}
            .size=${48}
            .name=${this.post.created_by.name}
          ></wy-avatar>
          <span slot="title" part="wy-placeholder">${this.post.created_by.name}</span>
          <time slot="text" part="wy-placeholder">${dateFromNow}</time>
          <wy-button slot="actions" kind="icon" @click=${() => this.dispatchEdit(false)}>
            <wy-icon name="close"></wy-icon>
          </wy-button>
        </wy-item>

        <wy-editor-msg
          editorLocation="apps"
          .text=${this.post.text}
          .embed=${this.post.embed}
          .pollOptions=${this.post.options?.data ?? []}
          .attachments=${this.post.attachments?.data ?? []}
          .parentId=${this.post.id}
          .typing=${false}
          .draft=${false}
          placeholder=${msg("Edit post...")}
          buttonText=${msg("Update", { desc: "Button action to update" })}
          @submit=${(e: MsgEditorSubmitEventType) => this.handleSubmit(e)}
        ></wy-editor-msg>
      </div>
    `;
  }
}
