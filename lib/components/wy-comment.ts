import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import type { EmbedType } from "../types/embeds.types";
import type { PollOptionType } from "../types/polls.types";
import type { CommentEditEventType, CommentRestoreEventType, CommentTrashEventType } from "../types/comments.events";
import type { PollVoteEventType } from "../types/polls.events";
import type { NamedEvent } from "../types/generic.types";

import chatCss from "../scss/all.scss"
import hostContentsCss from "../scss/host-contents.scss";

import "./wy-comment-trashed";
import "./wy-comment-view";
import "./wy-comment-edit";

/**
 * @fires {PollVoteEventType} vote
 * @fires {CommentTrashEventType} trash
 * @fires {CommentRestoreEventType} restore
 */
@customElement("wy-comment")
export default class WyComment extends LitElement {
  
  static override styles = [chatCss, hostContentsCss];
  
  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number })
  commentId!: number;

  @property({ type: Number })
  parentId!: number;

  @property({ attribute: false })
  location: "posts" | "files" | "apps" = "apps";

  @property({ attribute: false })
  createdBy!: MemberType;

  @property()
  createdAt: string = "";

  @property()
  modifiedAt: string | undefined = undefined;

  @property({ type: Boolean })
  isTrashed: boolean = false;

  @property()
  html: string = "";

  @property()
  text: string = "";

  @property({ attribute: false })
  annotations?: FileType[] = [];

  @property({ attribute: false })
  attachments?: FileType[] = [];

  @property({ type: Array })
  pollOptions: PollOptionType[] | undefined = [];

  @property({ attribute: false })
  meeting?: MeetingType;

  @property({ attribute: false })
  embed?: EmbedType;

  @property({ type: Array })
  reactions?: ReactableType[] = [];

  @property({ attribute: false })
  commentCount: number = 0;

  @property({ type: Array })
  seenBy: MemberType[] = [];

  @state()
  private editing: boolean = false;

  private dispatchVote(optionId: number) {
    const event: PollVoteEventType = new (CustomEvent as NamedEvent)("vote", { detail: { optionId, parentId: this.commentId, parentType: "comments" } });
    return this.dispatchEvent(event);
  }

  private dispatchTrash() {
    const event: CommentTrashEventType = new (CustomEvent as NamedEvent)("trash", { detail: { id: this.commentId } });
    return this.dispatchEvent(event);
  }

  private dispatchRestore() {
    const event: CommentRestoreEventType = new (CustomEvent as NamedEvent)("restore", { detail: { id: this.commentId } });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      ${this.isTrashed
        ? html`<wy-comment-trashed
            class="wy-comment"
            commentId=${this.commentId}
            @restore=${() => {
              this.dispatchRestore();
            }}></wy-comment-trashed> `
        : nothing}
      ${!this.isTrashed && this.editing
        ? html`<wy-comment-edit
            class="wy-comment"
            .commentId=${this.commentId}
            .parentId=${this.parentId}
            .location=${this.location}
            .text=${this.text}
            .pollOptions=${this.pollOptions}
            .attachments=${this.attachments}
            .embed=${this.embed}
            @edit=${(e: CommentEditEventType) => {
              this.editing = e.detail.edit;
            }}></wy-comment-edit> `
        : nothing}
      ${!this.isTrashed && !this.editing
        ? html`<wy-comment-view
            class="wy-comment"
            id="comment-view-${this.commentId}"
            .commentId=${this.commentId}
            .parentId=${this.parentId}
            .location=${this.location}
            .createdBy=${this.createdBy}
            .createdAt=${this.createdAt}
            .modifiedAt=${this.modifiedAt}
            .isTrashed=${this.isTrashed}
            .text=${this.text}
            .html=${this.html}
            .annotations=${this.annotations}          
            .attachments=${this.attachments}
            .embed=${this.embed}
            .meeting=${this.meeting}
            .pollOptions=${this.pollOptions}
            .reactions=${this.reactions}
            @edit=${(e: CommentEditEventType) => {
              this.editing = e.detail.edit;
            }}
            @trash=${() => {
              this.dispatchTrash();
            }}
            @vote=${(e: PollVoteEventType) => {
              this.dispatchVote(e.detail.optionId);
            }}></wy-comment-view> `
        : nothing}
    `;
  }
}
