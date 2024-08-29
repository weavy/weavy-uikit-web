import { LitElement, PropertyValueMap, PropertyValues, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";
import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileOpenEventType, FileType } from "../types/files.types";
import { PollOptionType } from "../types/polls.types";
import type { EmbedType } from "../types/embeds.types";
import { relativeTime } from "../utils/datetime";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { EntityTypes } from "../types/app.types";
import { isEntityChainMatch } from "../utils/notifications";

import chatCss from "../scss/all.scss";

import "./wy-avatar";
import "./wy-attachment";
import "./wy-image-grid";
import "./wy-attachments-list";
import "./wy-reactions";
import "./wy-meeting-card";
import "./wy-poll";
import "./wy-embed";
import "./wy-comment-list";
import "./wy-dropdown";
import "./wy-icon";
import WeavyPreview from "./wy-preview";
import "./wy-skeleton";

@customElement("wy-comment-view")
@localized()
export default class WyCommentView extends BlockConsumerMixin(LitElement) {
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

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
  text: string = "";

  @property()
  html: string = "";

  @property({ type: Array })
  attachments?: FileType[] = [];

  @property({ attribute: false })
  embed?: EmbedType;

  @property({ type: Array })
  pollOptions: PollOptionType[] | undefined = [];

  @property({ attribute: false })
  meeting?: MeetingType;

  @property({ type: Array })
  reactions?: ReactableType[] = [];

  private previewRef: Ref<WeavyPreview> = createRef();
  private highlightRef: Ref<HTMLElement> = createRef();

  @property({ type: Boolean })
  highlight: boolean = false;

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

  protected override willUpdate(changedProperties: PropertyValueMap<this>) {
    if (changedProperties.has("link")) {
      this.highlight = Boolean(this.link && isEntityChainMatch(this.link, EntityTypes.Comment, { id: this.commentId }));
    }

    if (changedProperties.has("highlight")) {
      if (this.highlight) {
        this.part.add("wy-highlight");
      } else {
        this.part.remove("wy-highlight");
      }
    }
  }

  override render() {
    const images = this.attachments?.filter((a: FileType) => a.kind === "image" && a.thumbnail_url);
    const files = this.attachments?.filter((a: FileType) => a.kind !== "image" || !a.thumbnail_url);

    const dateFull = new Intl.DateTimeFormat(this.weavyContext?.locale, {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(this.createdAt));
    const dateFromNow = relativeTime(this.weavyContext?.locale, new Date(this.createdAt));

    return this.temp
      ? html`<div class="wy-item wy-item-sm wy-comment-header">
            <wy-avatar
              .src="${this.createdBy.avatar_url}"
              .size=${32}
              .name=${this.createdBy.display_name}
              .isBot=${this.createdBy.is_bot}
            ></wy-avatar>
            <div class="wy-item-body">
              <div class="wy-item-title"><span class="wy-placeholder">${this.createdBy.display_name}</span></div>
              <div class="wy-item-text">
                <time class="wy-placeholder">${dateFromNow}</time>
              </div>
            </div>
          </div>
          <div class="wy-comment-body">
            <div class="wy-comment-content">
              ${this.html ? html`<div class="wy-content"><wy-skeleton .text=${this.text}></wy-skeleton></div>` : ``}
            </div>
          </div>`
      : html`<div class="wy-item wy-item-sm wy-comment-header" ${ref(this.highlightRef)}>
            <wy-avatar
              .src=${this.createdBy.avatar_url}
              .size=${32}
              .name=${this.createdBy.display_name}
              .isBot=${this.createdBy.is_bot}
            ></wy-avatar>
            <div class="wy-item-body">
              <div class="wy-item-title">${this.createdBy.display_name}</div>
              <div class="wy-item-text">
                <time datetime=${this.createdAt} title=${dateFull}>${dateFromNow}</time>
                ${this.modifiedAt ? html`<time datetime=${this.modifiedAt}> · ${msg("edited")}</time>` : nothing}
              </div>
            </div>

            ${this.user && this.user.id === this.createdBy.id
              ? html`
                  <div class="wy-item-actions wy-item-top">
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
                    @file-open=${(e: FileOpenEventType) => {
                      this.previewRef.value?.open(e.detail.fileId);
                    }}
                  ></wy-image-grid>`
                : ``}

              <!-- embeds -->
              ${this.embed && this.hasFeatures?.embeds
                ? html` <wy-embed class="wy-embed" .embed=${this.embed}></wy-embed> `
                : nothing}
              ${this.html ? html`<div class="wy-content">${unsafeHTML(this.html)}</div>` : ``}

              <!-- poll -->
              ${this.pollOptions && this.pollOptions.length > 0
                ? html`
                    <wy-poll
                      .pollOptions=${this.pollOptions}
                      @vote=${(e: CustomEvent) => this.dispatchVote(e.detail.id)}
                    ></wy-poll>
                  `
                : nothing}

              <!-- files -->
              ${files && !!files.length
                ? html`<wy-attachments-list
                    .files=${files ?? []}
                    @file-open=${(e: FileOpenEventType) => {
                      this.previewRef.value?.open(e.detail.fileId);
                    }}
                  ></wy-attachments-list>`
                : ``}

              <!-- meeting -->
              ${this.meeting ? html`<wy-meeting-card .meeting=${this.meeting}></wy-meeting-card>` : ``}
            </div>
          </div>

          ${this.hasFeatures?.reactions
            ? html` <wy-reactions
                lineBottom
                small
                .reactions=${this.reactions}
                parentId=${this.parentId}
                entityId=${this.commentId}
                messageType="comments"
              ></wy-reactions>`
            : nothing}

          <wy-preview
            ${ref(this.previewRef)}
            .uid=${`comment-${this.parentId}-${this.commentId.toString()}`}
            .files=${this.attachments}
            .isAttachment=${true}
          ></wy-preview> `;
  }

  protected override updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("highlight") && this.highlight) {
      this.highlightRef.value?.scrollIntoView({ block: "nearest" });
    }
  }
}
