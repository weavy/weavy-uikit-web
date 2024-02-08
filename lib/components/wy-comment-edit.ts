import { LitElement, html, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { localized, msg } from "@lit/localize";

import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import type { EmbedType } from "../types/embeds.types";
import { type FeaturesConfigType, type FeaturesListType } from "../types/features.types";
import { PollOptionType } from "../types/polls.types";

import chatCss from "../scss/all.scss";

import type { AppType } from "../types/app.types";
import type { UserType } from "../types/users.types";
import { MutationController } from "../controllers/mutation-controller";
import { CommentMutationContextType, CommentType, MutateCommentProps } from "../types/comments.types";
import { getUpdateCommentMutationOptions } from "../data/comments";

import "./wy-attachment";
import "./wy-image-grid";
import "./wy-attachments-list";
import "./wy-poll";
import "./wy-embed";
import "./wy-button";
import "./wy-icon";
import "./wy-editor";
import { WeavyContextProps } from "../types/weavy.types";

@customElement("wy-comment-edit")
@localized()
export default class WyCommentEdit extends LitElement {
  
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ attribute: false })
  app!: AppType;

  @property({ attribute: false })
  user!: UserType;

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
  attachments: FileType[] = [];

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

  @property({ type: Number })
  userId: number = -1;

  @property({ type: Object })
  features?: FeaturesConfigType = {};

  @property({ type: Array })
  availableFeatures?: FeaturesListType;

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
      embed: e.detail.embed,
      user: this.user,
    });

    this.dispatchEdit(false);
  }

  override async willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if ((changedProperties.has("app") || changedProperties.has("weavyContext")) && this.app && this.weavyContext) {
      this.updateCommentMutation.trackMutation(
        getUpdateCommentMutationOptions(this.weavyContext, ["comments", this.parentId])
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
        .attachments=${this.attachments}
        .app=${this.app}
        .user=${this.user}
        .parentId=${this.commentId}
        .availableFeatures=${this.availableFeatures}
        .features=${this.features}
        .typing=${false}
        .draft=${false}
        placeholder=${msg("Edit comment...")}
        buttonText=${msg("Update", { desc: "Button action to update" })}
        @submit=${(e: CustomEvent) => this.handleSubmit(e)}></wy-editor>
    `;
  }
}
