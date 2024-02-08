import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { hasFeature } from "../utils/features";
import { localized, msg } from "@lit/localize";

import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import { Feature, type FeaturesConfigType, type FeaturesListType } from "../types/features.types";
import { PollOptionType } from "../types/polls.types";

import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";

import chatCss from "../scss/all.scss";

import type { AppType } from "../types/app.types";
import type { UserType } from "../types/users.types";
import WeavyPreview from "./wy-preview";
import type { EmbedType } from "../types/embeds.types";
import { relativeTime } from "../utils/datetime";

import "./wy-avatar";
import "./wy-attachment";
import "./wy-image-grid";
import "./wy-attachments-list";
import "./wy-reactions";
import "./wy-meeting-card";
import "./wy-poll";
import "./wy-embed";
import "./wy-comments";
import "./wy-dropdown";
import "./wy-icon";
import "./wy-preview";

@customElement("wy-comment-view")
@localized()
export default class WyCommentView extends LitElement {
  
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ attribute: false })
  app!: AppType;

  @property({ attribute: false })
  user!: UserType;

  @property({ type: Number })
  commentId!: number;

  @property({ type: Number })
  parentId!: number;

  @property({ type: Boolean })
  temp: boolean = false;

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

  @property({ type: Array })
  attachments: FileType[] = [];

  @property({ attribute: false })
  embed?: EmbedType;

  @property({ type: Array })
  pollOptions: PollOptionType[] | undefined = [];

  @property({ attribute: false })
  meeting?: MeetingType;

  @property({ type: Array })
  reactions: ReactableType[] = [];

  @property({ type: Object })
  features?: FeaturesConfigType = {};

  @property({ type: Array })
  availableFeatures?: FeaturesListType;

  private previewRef: Ref<WeavyPreview> = createRef();

  override createRenderRoot() {
    return this;
  }

  private dispatchVote(id: number) {
    const event = new CustomEvent("vote", { detail: { id: id } });
    return this.dispatchEvent(event);
  }

  private dispatchTrash() {
    const event = new CustomEvent("trash", { detail: { id: this.commentId } });
    return this.dispatchEvent(event);
  }

  private dispatchEdit(edit: boolean) {
    const event = new CustomEvent("edit", { detail: { edit: edit } });
    return this.dispatchEvent(event);
  }

  override render() {
    const images = this.attachments?.filter((a: FileType) => a.kind === "image" && a.thumbnail_url);
    const files = this.attachments?.filter((a: FileType) => a.kind !== "image" || !a.thumbnail_url);

    const dateFull = new Intl.DateTimeFormat(this.weavyContext?.locale, {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(this.createdAt));
    const dateFromNow = relativeTime(this.weavyContext?.locale, new Date(this.createdAt));

    return html`
      <div class="wy-item wy-item-sm wy-comment-header">
        <wy-avatar .src=${this.createdBy.avatar_url} .size=${32} .name=${this.createdBy.display_name}></wy-avatar>
        <div class="wy-item-body">
          <div class="wy-item-title">${this.createdBy.display_name}</div>
          <div class="wy-item-text">
            <time datetime=${this.createdAt} title=${dateFull}>${dateFromNow}</time>
            ${this.modifiedAt ? html`<time datetime=${this.modifiedAt}> · ${msg("edited")}</time>` : nothing}
          </div>
        </div>

        ${this.user.id === this.createdBy.id
          ? html`
              <div class="wy-item-actions wy-item-actions-top">
                <wy-dropdown>
                  ${this.user.id === this.createdBy.id
                    ? html`<wy-dropdown-item @click=${() => this.dispatchEdit(true)}>
                        <wy-icon name="pencil"></wy-icon>
                        ${msg("Edit")}
                      </wy-dropdown-item>`
                    : nothing}
                  ${this.user.id === this.createdBy.id
                    ? html`<wy-dropdown-item @click=${() => this.dispatchTrash()}>
                        <wy-icon name="trashcan"></wy-icon>
                        ${msg("Trash")}
                      </wy-dropdown-item>`
                    : nothing}
                </wy-dropdown>
              </div>
            `
          : nothing}
      </div>
      <div class="wy-comment-body">
        <div class="wy-comment-content">
          <!-- image grid -->
          ${images && !!images.length
            ? html`<wy-image-grid
                .images=${images}
                @file-open=${(e: CustomEvent) => {
                  this.previewRef.value?.open(e.detail.file);
                }}></wy-image-grid>`
            : ``}

          <!-- embeds -->
          ${this.embed && hasFeature(this.availableFeatures, Feature.Embeds, this.features?.embeds)
            ? html` <wy-embed class="wy-embed" .embed=${this.embed}></wy-embed> `
            : nothing}
          ${this.html ? html`<div class="wy-content">${unsafeHTML(this.html)}</div>` : ``}

          <!-- poll -->
          ${this.pollOptions && this.pollOptions.length > 0
            ? html`
                <wy-poll
                  .pollOptions=${this.pollOptions}
                  @vote=${(e: CustomEvent) => this.dispatchVote(e.detail.id)}></wy-poll>
              `
            : nothing}

          <!-- files -->
          ${files && !!files.length
            ? html`<wy-attachments-list
                .files=${files}
                @file-open=${(e: CustomEvent) => {
                  this.previewRef.value?.open(e.detail.file);
                }}></wy-attachments-list>`
            : ``}

          <!-- meeting -->
          ${this.meeting ? html`<wy-meeting-card .meeting=${this.meeting}></wy-meeting-card>` : ``}
        </div>
      </div>

      <div class="wy-reactions-line">
        <wy-reactions
          small
          .hasFeature=${hasFeature(this.availableFeatures, Feature.Reactions, this.features?.reactions)}
          .reactions=${this.reactions}
          parentId=${this.parentId}
          entityId=${this.commentId}
          messageType="comments"
          .userId=${this.user.id}></wy-reactions>
      </div>

      <wy-preview
        ${ref(this.previewRef)}
        .app=${this.app}
        .uid=${`comment-${this.parentId}-${this.commentId.toString()}`}
        .files=${this.attachments}
        .isAttachment=${true}
        .availableFeatures=${this.availableFeatures}
        .features=${this.features}></wy-preview>
    `;
  }
}
