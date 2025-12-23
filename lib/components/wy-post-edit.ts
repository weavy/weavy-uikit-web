import { html, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import type { MutatePostProps, PostType } from "../types/posts.types";
import type { EmbedType } from "../types/embeds.types";
import { PollOptionType } from "../types/polls.types";
import { MutationController } from "../controllers/mutation-controller";
import { getUpdatePostMutationOptions } from "../data/posts";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { PostEditEventType } from "../types/posts.events";
import type { NamedEvent } from "../types/generic.types";
import type { EditorSubmitEventType } from "../types/editor.events";
import { relativeTime } from "../utils/datetime";

import postCss from "../scss/components/post.scss";
import textCss from "../scss/components/text.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-button";
import "./ui/wy-icon";
import "./ui/wy-item";
import "./wy-editor";

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
 * - [`<wy-editor>`](./wy-editor.ts)
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
   * Identifier of the post being edited.
   */
  @property({ type: Number })
  postId!: number;

  /**
   * True when the post has not yet been persisted.
   */
  @property({ type: Boolean })
  temp: boolean = false;

  /**
   * Author metadata for the post.
   */
  @property({ attribute: false })
  createdBy!: MemberType;

  /**
   * ISO timestamp when the post was created.
   */
  @property()
  createdAt: string = "";

  /**
   * ISO timestamp when the post was last modified.
   */
  @property()
  modifiedAt: string | undefined = undefined;

  /**
   * Indicates if the current user is subscribed to the post.
   */
  @property({ type: Boolean })
  isSubscribed: boolean = false;

  /**
   * Indicates if the post resides in the trash.
   */
  @property({ type: Boolean })
  isTrashed: boolean = false;

  /**
   * HTML content of the post.
   */
  @property()
  text: string = "";

  /**
   * Files attached to the post.
   */
  @property({ type: Array })
  attachments?: FileType[] = [];

  /**
   * Poll options configured for the post.
   */
  @property({ type: Array })
  pollOptions: PollOptionType[] | undefined = [];

  /**
   * Meeting attached to the post, if any.
   */
  @property({ attribute: false })
  meeting?: MeetingType;

  /**
   * Embed metadata attached to the post.
   */
  @property({ attribute: false })
  embed?: EmbedType;

  /**
   * Reactions applied to the post.
   */
  @property({ type: Array })
  reactions: ReactableType[] = [];

  /**
   * Members who have viewed the post.
   */
  @property({ type: Array })
  seenBy: MemberType[] = [];

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
  private async handleSubmit(e: EditorSubmitEventType) {
    const app = await this.whenApp();
    void this.updatePostMutation.mutate({
      id: this.postId,
      app_id: app.id,
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
    const dateFromNow = relativeTime(this.weavy?.locale, new Date(this.createdAt));

    return html`
      <div part="wy-post">
        <wy-item part="wy-post-header" align="top" size="md" noPadding>
          <wy-avatar
            slot="image"
            .src="${this.createdBy.avatar_url}"
            .isAgent=${this.createdBy.is_agent}
            .size=${48}
            .name=${this.createdBy.name}
          ></wy-avatar>
          <span slot="title" part="wy-placeholder">${this.createdBy.name}</span>
          <time slot="text" part="wy-placeholder">${dateFromNow}</time>
          <wy-button slot="actions" kind="icon" @click=${() => this.dispatchEdit(false)}>
            <wy-icon name="close"></wy-icon>
          </wy-button>
        </wy-item>

        <wy-editor
          editorLocation="apps"
          .text=${this.text}
          .embed=${this.embed}
          .options=${this.pollOptions}
          .attachments=${this.attachments ?? []}
          .parentId=${this.postId}
          .typing=${false}
          .draft=${false}
          placeholder=${msg("Edit post...")}
          buttonText=${msg("Update", { desc: "Button action to update" })}
          @submit=${(e: EditorSubmitEventType) => this.handleSubmit(e)}
        ></wy-editor>
      </div>
    `;
  }
}
