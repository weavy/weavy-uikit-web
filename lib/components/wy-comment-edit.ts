import { LitElement, html, type PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { localized, msg } from "@lit/localize";

import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import type { EmbedType } from "../types/embeds.types";
import { PollOptionType } from "../types/polls.types";

import { MutationController } from "../controllers/mutation-controller";
import { CommentMutationContextType, CommentType, MutateCommentProps } from "../types/comments.types";
import { getUpdateCommentMutationOptions } from "../data/comments";
import { WeavyProps } from "../types/weavy.types";

import "./wy-attachment";
import "./wy-image-grid";
import "./wy-attachments-list";
import "./wy-poll";
import "./wy-embed";
import "./wy-button";
import "./wy-icon";
import "./wy-editor";

import chatCss from "../scss/all.scss"
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

@customElement("wy-comment-edit")
@localized()
export default class WyCommentEdit extends LitElement {
  
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

  @consume({ context: WeavyContext, subscribe: true })
  @state()
  private weavy?: WeavyType;

  @property({ type: Number })
  parentId!: number;

  @property({ type: Number })
  commentId!: number;

  @property({ type: Boolean })
  temp: boolean = false;

  @property({ attribute: false })
  createdBy!: MemberType;

  @property()
  createdAt: string = "";

  @property()
  modifiedAt: string | undefined = undefined;

  @property({ type: Boolean })
  isSubscribed: boolean = false;

  @property({ type: Boolean })
  isTrashed: boolean = false;

  @property()
  text: string = "";

  @property({ type: Array })
  attachments?: FileType[] = [];

  @property({ type: Array })
  pollOptions: PollOptionType[] | undefined = [];

  @property({ attribute: false })
  meeting?: MeetingType;

  @property({ attribute: false })
  embed?: EmbedType;

  @property({ type: Array })
  reactions: ReactableType[] = [];

  @property({ type: Array })
  seenBy: MemberType[] = [];

  private updateCommentMutation = new MutationController<
    CommentType,
    Error,
    MutateCommentProps,
    CommentMutationContextType
  >(this);


  private dispatchEdit(edit: boolean) {
    const event = new CustomEvent("edit", { detail: { edit: edit } });
    return this.dispatchEvent(event);
  }

  private handleSubmit(e: CustomEvent) {
    this.updateCommentMutation.mutate({
      id: this.commentId,
      type: "apps",
      parentId: this.parentId,
      text: e.detail.text,
      meetingId: e.detail.meetingId,
      blobs: e.detail.blobs,
      attachments: e.detail.attachments,
      pollOptions: e.detail.pollOptions,
      embedId: e.detail.embed,
    });

    this.dispatchEdit(false);
  }

  override async willUpdate(changedProperties: PropertyValueMap<this & WeavyProps>) {
    if ((changedProperties.has("parentId") || changedProperties.has("weavy")) && this.parentId && this.weavy) {
      this.updateCommentMutation.trackMutation(
        getUpdateCommentMutationOptions(this.weavy, ["comments", this.parentId])
      );
    }
  }

  override render() {
    return html`
      <nav class="wy-item">
        <div class="wy-item-body">
          <div class="wy-item-title">${msg("Edit comment")}</div>
        </div>

        <wy-button @click=${() => this.dispatchEdit(false)} kind="icon">
          <wy-icon name="close"></wy-icon>
        </wy-button>
      </nav>
      <wy-editor
        editorLocation="posts"
        .text=${this.text}
        .embed=${this.embed}
        .options=${this.pollOptions}
        .attachments=${this.attachments ?? []}
        .parentId=${this.commentId}
        .typing=${false}
        .draft=${false}
        placeholder=${msg("Edit comment...")}
        buttonText=${msg("Update", { desc: "Button action to update" })}
        @submit=${(e: CustomEvent) => this.handleSubmit(e)}></wy-editor>
    `;
  }
}
