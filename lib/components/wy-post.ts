import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import type { EmbedType } from "../types/embeds.types";
import { PollOptionType } from "../types/polls.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import {
  PostEditEventType,
  PostRestoreEventType,
  PostSubscribeEventType,
  PostTrashEventType,
} from "../types/posts.events";
import { PollVoteEventType } from "../types/polls.events";
import { NamedEvent } from "../types/generic.types";

import rebootCss from "../scss/reboot.scss";

import "./wy-post-trashed";
import "./wy-post-view";
import "./wy-post-edit";

declare global {
  interface HTMLElementTagNameMap {
    "wy-post": WyPost;
  }
}

/**
 * Wrapper component for a single post, delegating rendering to view/edit/trashed subcomponents.
 *
 * **Used sub components:**
 *
 * - [`<wy-post-trashed>`](./wy-post-trashed.ts)
 * - [`<wy-post-edit>`](./wy-post-edit.ts)
 * - [`<wy-post-view>`](./wy-post-view.ts)
 *
 * @fires {PollVoteEventType} vote - Emitted when a poll option is voted.
 * @fires {PostSubscribeEventType} subscribe - Emitted when subscribe/unsubscribe is requested.
 * @fires {PostTrashEventType} trash - Emitted when the post should be trashed.
 * @fires {PostRestoreEventType} restore - Emitted when the post should be restored.
 * @fires {WyActionEventType} wy-action - Emitted when an embed action button is triggered.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement("wy-post")
export class WyPost extends LitElement {
  static override styles = [rebootCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Identifier of the wrapped post.
   */
  @property({ type: Number })
  postId!: number;

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
   * ISO timestamp for the last post modification.
   */
  @property()
  modifiedAt: string | undefined = undefined;

  /**
   * True when the current user subscribes to the post.
   */
  @property({ type: Boolean })
  isSubscribed: boolean = false;

  /**
   * True when the post resides in trash.
   */
  @property({ type: Boolean })
  isTrashed: boolean = false;

  /**
   * HTML formatted post content.
   */
  @property()
  html: string = "";

  /**
   * Plain-text post content.
   */
  @property()
  text: string = "";

  /**
   * Normalized plain-text body used when rendering.
   */
  @property()
  plain: string = "";

  /**
   * Annotation files attached to the post.
   */
  @property({ attribute: false })
  annotations?: FileType[] = [];

  /**
   * Attachment files linked to the post.
   */
  @property({ attribute: false })
  attachments?: FileType[] = [];

  /**
   * Poll options configured for the post.
   */
  @property({ type: Array })
  pollOptions: PollOptionType[] | undefined = [];

  /**
   * Meeting details attached to the post.
   */
  @property({ attribute: false })
  meeting?: MeetingType;

  /**
   * Embed metadata rendered with the post.
   */
  @property({ attribute: false })
  embed?: EmbedType;

  /**
   * Reactions associated with the post.
   */
  @property({ type: Array })
  reactions?: ReactableType[] = [];

  /**
   * Number of comments on the post.
   */
  @property({ attribute: false })
  commentCount: number = 0;

  /**
   * Members who have seen the post.
   */
  @property({ type: Array })
  seenBy: MemberType[] = [];

  /**
   * True while the post is displayed in edit mode.
   *
   * @internal
   */
  @state()
  private editing: boolean = false;

  /**
   * Emit a `vote` event scoped to the post.
   *
   * @internal
   * @param optionId - Identifier of the selected poll option.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchVote(optionId: number) {
    const event: PollVoteEventType = new (CustomEvent as NamedEvent)("vote", {
      detail: { optionId, parentId: this.postId, parentType: "posts" },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `subscribe` event toggling post subscription.
   *
   * @internal
   * @param subscribe - Desired subscription state.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchSubscribe(subscribe: boolean) {
    const event: PostSubscribeEventType = new (CustomEvent as NamedEvent)("subscribe", {
      detail: { id: this.postId, subscribe },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `trash` event requesting the post to be trashed.
   *
   * @internal
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchTrash() {
    const event: PostTrashEventType = new (CustomEvent as NamedEvent)("trash", { detail: { id: this.postId } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `restore` event requesting the post to be restored.
   *
   * @internal
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchRestore() {
    const event: PostRestoreEventType = new (CustomEvent as NamedEvent)("restore", { detail: { id: this.postId } });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      ${this.isTrashed
        ? html`<wy-post-trashed
            postId=${this.postId}
            .createdBy=${this.createdBy}
            @restore=${() => {
              this.dispatchRestore();
            }}
          ></wy-post-trashed> `
        : nothing}
      ${!this.isTrashed && this.editing
        ? html`<wy-post-edit
            .postId=${this.postId}
            .createdBy=${this.createdBy}
            .createdAt=${this.createdAt}
            .text=${this.text}
            .embed=${this.embed}
            .pollOptions=${this.pollOptions}
            .attachments=${this.attachments}
            @edit=${(e: PostEditEventType) => {
              this.editing = e.detail.edit;
            }}
          ></wy-post-edit> `
        : nothing}
      ${!this.isTrashed && !this.editing
        ? html`<wy-post-view
            id="${this.id}"
            .postId=${this.postId}
            .createdBy=${this.createdBy}
            .createdAt=${this.createdAt}
            .modifiedAt=${this.modifiedAt}
            .isSubscribed=${this.isSubscribed}
            .isTrashed=${this.isTrashed}
            .html=${this.html}
            .text=${this.plain}
            .annotations=${this.annotations ?? []}
            .attachments=${this.attachments ?? []}
            .meeting=${this.meeting}
            .pollOptions=${this.pollOptions}
            .embed=${this.embed}
            .reactions=${this.reactions}
            .commentCount=${this.commentCount}
            @edit=${(e: PostEditEventType) => {
              this.editing = e.detail.edit;
            }}
            @subscribe=${(e: PostSubscribeEventType) => {
              this.dispatchSubscribe(e.detail.subscribe);
            }}
            @trash=${() => {
              this.dispatchTrash();
            }}
            @vote=${(e: PollVoteEventType) => {
              this.dispatchVote(e.detail.optionId);
            }}
          ></wy-post-view> `
        : nothing}
    `;
  }
}
