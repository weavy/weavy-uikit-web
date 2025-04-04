import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import type WeavyPreview from "../components/wy-preview";
import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import type { FileOpenEventType } from "../types/files.events";
import type { EmbedType } from "../types/embeds.types";
import { PollOptionType } from "../types/polls.types";
import { localized, msg, str } from "@lit/localize";
import { relativeTime } from "../utils/datetime";
import { WeavyComponentConsumerMixin } from "../classes/weavy-component-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { EntityTypeString } from "../types/app.types";
import { hasEntityChildType, isEntityChainMatch } from "../utils/notifications";
import { partMap } from "../utils/directives/shadow-part-map";
import { Feature } from "../types/features.types";

import chatCss from "../scss/all.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./base/wy-avatar";
import "./wy-attachment";
import "./base/wy-image-grid";
import "./wy-attachments-list";
import "./base/wy-reactions";
import "./wy-meeting-card";
import "./wy-poll";
import "./wy-embed";
import "./wy-comment-list";
import "./base/wy-skeleton";

@customElement("wy-post-view")
@localized()
export default class WyPostView extends WeavyComponentConsumerMixin(LitElement) {
  static override styles = [
    chatCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number })
  postId!: number;

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
  html: string = "";

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
  reactions?: ReactableType[] = [];

  @property({ attribute: false })
  commentCount: number = 0;

  @property({ type: Array })
  seenBy: MemberType[] = [];

  @state()
  private showComments: boolean = false;

  @state()
  private loadComments: boolean = false;

  @property({ type: Boolean })
  highlight: boolean = false;

  @state()
  isCommentLinked: boolean = false;

  private previewRef: Ref<WeavyPreview> = createRef();
  private highlightRef: Ref<HTMLElement> = createRef();

  private dispatchVote(id: number) {
    const event = new CustomEvent("vote", { detail: { id: id } });
    return this.dispatchEvent(event);
  }

  private dispatchSubscribe(subscribe: boolean) {
    const event = new CustomEvent("subscribe", { detail: { id: this.postId, subscribe } });
    return this.dispatchEvent(event);
  }

  private dispatchTrash() {
    const event = new CustomEvent("trash", { detail: { id: this.postId } });
    return this.dispatchEvent(event);
  }

  private dispatchEdit(edit: boolean) {
    const event = new CustomEvent("edit", { detail: { edit: edit } });
    return this.dispatchEvent(event);
  }

  private handleCommentsClick(e: Event) {
    e.preventDefault();
    this.showComments = !this.showComments;
    this.loadComments = true;
  }

  protected override willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("link")) {
      this.highlight = Boolean(this.link && isEntityChainMatch(this.link, EntityTypeString.Post, { id: this.postId }));
      this.isCommentLinked = Boolean(
        this.link && hasEntityChildType(this.link, EntityTypeString.Post, { id: this.postId }, EntityTypeString.Comment)
      );
    }

    if (changedProperties.has("isCommentLinked") && this.isCommentLinked) {
      this.loadComments = true;
      this.showComments = true;
    }
  }

  override render() {
    const images = this.attachments?.filter((a: FileType) => a.kind === "image" && a.thumbnail_url);
    const files = this.attachments?.filter((a: FileType) => a.kind !== "image" || !a.thumbnail_url);
    //const date = dayjs.utc(this.createdAt).tz(dayjs.tz.guess());

    const dateFull = new Intl.DateTimeFormat(this.weavy?.locale, {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(this.createdAt));
    const dateFromNow = relativeTime(this.weavy?.locale, new Date(this.createdAt));
    const modifiedDateFull =
      this.modifiedAt && this.weavy
        ? new Intl.DateTimeFormat(this.weavy.locale, { dateStyle: "full", timeStyle: "short" }).format(
            new Date(this.modifiedAt)
          )
        : "";

    return this.postId < 0
      ? html`<div class="wy-post">
          <div class="wy-item">
            <wy-avatar
              .src="${this.createdBy.avatar_url}"
              .isBot=${this.createdBy.is_bot}
              .size=${48}
              .name=${this.createdBy.name}
            ></wy-avatar>
            <div class="wy-item-rows">
              <div class="wy-item-row">
                <div class="wy-item-title"><span class="wy-placeholder">${this.createdBy.name}</span></div>
              </div>
              <div class="wy-item-row">
                <div class="wy-item-text">
                  <time class="wy-placeholder">${dateFromNow}</time>
                </div>
              </div>
            </div>
          </div>
          <div class="wy-post-body">
            <div class="wy-content"><wy-skeleton .text=${this.text}></wy-skeleton></div>
          </div>
        </div>`
      : html`
          <div class="wy-post" part=${partMap({ "wy-highlight": this.highlight && !this.isCommentLinked })} ${ref(
          this.highlightRef
        )}>
            <div class="wy-item">
              <wy-avatar .src="${this.createdBy.avatar_url}" .isBot=${this.createdBy.is_bot} .size=${48} .name=${
          this.createdBy.name
        }></wy-avatar>
              <div class="wy-item-rows">
                <div class="wy-item-row">
                  <div class="wy-item-title">${this.createdBy.name}</div>
                </div>
                <div class="wy-item-row">
                  <div class="wy-item-text">
                    <time datetime=${this.createdAt} title=${dateFull}>${dateFromNow}</time>
                    ${
                      this.modifiedAt
                        ? html`<time datetime="${this.modifiedAt}" title=${modifiedDateFull}> · ${msg("edited")}</time>`
                        : nothing
                    }
                  </div>
                  </div>
                </div>

                <div class="wy-item-actions wy-item-top">
                  <wy-dropdown>
                    ${
                      this.isSubscribed
                        ? html`<wy-dropdown-item @click=${() => this.dispatchSubscribe(false)}>
                            <wy-icon name="bell-off"></wy-icon>
                            ${msg("Unsubscribe")}
                          </wy-dropdown-item>`
                        : html`<wy-dropdown-item @click=${() => this.dispatchSubscribe(true)}>
                            <wy-icon name="bell"></wy-icon>
                            ${msg("Subscribe")}
                          </wy-dropdown-item>`
                    }
                    ${
                      this.user && this.user.id === this.createdBy.id
                        ? html`<wy-dropdown-item @click=${() => this.dispatchEdit(true)}>
                            <wy-icon name="pencil"></wy-icon>
                            ${msg("Edit")}
                          </wy-dropdown-item>`
                        : nothing
                    }
                    ${
                      this.user && this.user.id === this.createdBy.id
                        ? html`<wy-dropdown-item @click=${() => this.dispatchTrash()}>
                            <wy-icon name="trashcan"></wy-icon>
                            ${msg("Trash")}
                          </wy-dropdown-item>`
                        : nothing
                    }
                  </wy-dropdown>
                </div>
              </div>
              <!-- image grid -->
              ${
                images && !!images.length
                  ? html`<wy-image-grid
                      class="wy-post-area-full-width"
                      .images=${images}
                      @file-open=${(e: FileOpenEventType) => {
                        this.previewRef.value?.open(e.detail.fileId);
                      }}
                    ></wy-image-grid>`
                  : ``
              }

              <!-- embeds -->
              ${
                this.componentFeatures?.allowsFeature(Feature.Embeds) && this.embed
                  ? html` <wy-embed class="wy-embed" .embed=${this.embed}></wy-embed> `
                  : nothing
              }

              <div class="wy-post-body">
                ${this.html ? html`<div class="wy-content">${unsafeHTML(this.html)}</div>` : ``}

                <!-- poll -->
                ${
                  this.pollOptions && this.pollOptions.length > 0
                    ? html`
                        <wy-poll
                          .pollOptions=${this.pollOptions}
                          @vote=${(e: CustomEvent) => this.dispatchVote(e.detail.id)}
                        ></wy-poll>
                      `
                    : nothing
                }

                <!-- files -->
                ${
                  files && !!files.length
                    ? html`<wy-attachments-list
                        .files=${files ?? []}
                        @file-open=${(e: FileOpenEventType) => {
                          this.previewRef.value?.open(e.detail.fileId);
                        }}
                      ></wy-attachments-list>`
                    : ``
                }

                <!-- meeting -->
                ${this.meeting ? html`<wy-meeting-card .meeting=${this.meeting}></wy-meeting-card>` : ``}
              </div>

              <div class="wy-post-footer">
                <div>
                  <!-- comment count -->
                  ${
                    this.componentFeatures?.allowsFeature(Feature.Comments)
                      ? html` <wy-button
                          small
                          kind="inline"
                          ?active=${this.showComments}
                          class="wy-meta"
                          color="inherit"
                          @click=${(e: Event) => this.handleCommentsClick(e)}
                        >
                          ${this.commentCount !== 1 ? msg(str`${this.commentCount} comments`) : msg("1 comment")}
                        </wy-button>`
                      : nothing
                  }
                </div>
                ${
                  this.componentFeatures?.allowsFeature(Feature.Reactions) && this.app
                    ? html`
                        <wy-reactions
                          line
                          small
                          .reactions=${this.reactions}
                          parentId=${this.app.id}
                          parentType="apps"
                          entityId=${this.postId}
                          entityType="posts"
                        ></wy-reactions>
                      `
                    : nothing
                }
              </div>

              <!-- comments -->
              ${
                this.loadComments
                  ? html`
                      <div class="wy-post-comments" ?hidden=${!this.showComments}>
                        <wy-comment-list .parentId=${this.postId} .location=${"posts"}></wy-comment-list>
                      </div>
                    `
                  : nothing
              }
            </div>
          
            ${
              this.attachments?.length
                ? html`<wy-preview
                    ${ref(this.previewRef)}
                    .files=${this.attachments}
                    .isAttachment=${true}
                  ></wy-preview> `
                : nothing
            }
           
          </div>
        `;
  }

  protected override updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("highlight") && this.highlight) {
      this.highlightRef.value?.scrollIntoView({ block: "nearest" });
    }
  }
}
