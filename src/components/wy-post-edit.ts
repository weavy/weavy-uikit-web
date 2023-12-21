import { LitElement, html, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { localized, msg } from "@lit/localize";

import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import type { MutatePostProps, PostMutationContextType, PostType } from "../types/posts.types";
import type { EmbedType } from "../types/embeds.types";
import { type FeaturesConfigType, type FeaturesListType } from "../types/features.types";
import { PollOptionType } from "../types/polls.types";

import chatCss from "../scss/all.scss";

import "./wy-avatar";
import "./wy-attachment";
import "./wy-editor";
import "./wy-image-grid";
import "./wy-attachments-list";
import "./wy-reactions";
import "./wy-meeting-card";
import "./wy-poll";
import "./wy-embed";
import type { AppType } from "../types/app.types";
import type { UserType } from "../types/users.types";
import { MutationController } from "../controllers/mutation-controller";
import { getUpdatePostMutationOptions } from "../data/posts";
import { WeavyContextProps } from "../types/weavy.types";

@customElement("wy-post-edit")
@localized()
export default class WyPostEdit extends LitElement {
  
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ attribute: false })
  app!: AppType;

  @property({ attribute: false })
  user!: UserType;

  @property({ type: Number })
  postId!: number;

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
  features: FeaturesConfigType = {};

  @property({ type: Array })
  availableFeatures?: FeaturesListType;

  private updatePostMutation = new MutationController<PostType, Error, MutatePostProps, PostMutationContextType>(this);

  private dispatchEdit(edit: boolean) {
    const event = new CustomEvent("edit", { detail: { edit: edit } });
    return this.dispatchEvent(event);
  }

  private handleSubmit(e: CustomEvent) {
    this.updatePostMutation.mutate({
      id: this.postId,
      appId: this.app.id,
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
    if ((changedProperties.has("weavyContext") ||changedProperties.has("app")) && this.weavyContext) {
      this.updatePostMutation.trackMutation(getUpdatePostMutationOptions(this.weavyContext, ["posts", this.app.id]));
    }
  }

  override render() {
    return html`
      <nav class="wy-item">
        <div class="wy-item-body">
          <div class="wy-item-title">${msg("Edit post")}</div>
        </div>

        <wy-button kind="icon" @click=${() => this.dispatchEdit(false)}>
          <wy-icon name="close"></wy-icon>
        </wy-button>
      </nav>
      <wy-editor
        editorLocation="apps"
        .text=${this.text}
        .embed=${this.embed}
        .options=${this.pollOptions}
        .attachments=${this.attachments}
        .app=${this.app}
        .user=${this.user}
        .parentId=${this.postId}
        .availableFeatures=${this.availableFeatures}
        .features=${this.features}
        .typing=${false}
        .draft=${false}
        placeholder=${msg("Edit post...")}
        buttonText=${msg("Update", { desc: "Button action to update" })}
        @submit=${(e: CustomEvent) => this.handleSubmit(e)}></wy-editor>
    `;
  }
}
