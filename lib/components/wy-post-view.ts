import { type PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import type { WyPreview } from "./wy-preview";
import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import type { FileOpenEventType } from "../types/files.events";
import type { EmbedType } from "../types/embeds.types";
import { PollOptionType } from "../types/polls.types";
import { localized, msg, str } from "@lit/localize";
import { relativeTime } from "../utils/datetime";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { EntityTypeString } from "../types/app.types";
import { hasEntityChildType, isEntityChainMatch } from "../utils/notifications";
import { partMap } from "../utils/directives/shadow-part-map";
import { Feature } from "../types/features.types";
import { PostEditEventType, PostSubscribeEventType, PostTrashEventType } from "../types/posts.events";
import { NamedEvent } from "../types/generic.types";
import { PollVoteEventType } from "../types/polls.events";

import postCss from "../scss/components/post.scss";
import highlightCss from "../scss/base/_highlight.scss";
import contentCss from "../scss/components/content.scss";
import hostContentsCss from "../scss/host-contents.scss";
import placeholderCss from "../scss/components/placeholder.scss";
import messagesCss from "../scss/components/messages.scss";
import textCss from "../scss/components/text.scss";

import "./ui/wy-avatar";
import "./ui/wy-image-grid";
import "./ui/wy-item";
import "./ui/wy-skeleton";
import "./wy-attachment";
import "./wy-reactions";
import "./wy-meeting-card";
import "./wy-poll";
import "./wy-embed";
import "./wy-comment-list";
import "./wy-preview";

declare global {
  interface HTMLElementTagNameMap {
    "wy-post-view": WyPostView;
  }
}

/**
 * Post view that renders the post content, attachments, polls, embeds and footer/meta.
 *
 * **Used sub components:**
 *
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-image-grid>`](./ui/wy-image-grid.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-skeleton>`](./ui/wy-skeleton.ts)
 * - [`<wy-annotation-list>`](./wy-annotation.ts)
 * - [`<wy-attachment-list>`](./wy-attachment.ts)
 * - [`<wy-embed>`](./wy-embed.ts)
 * - [`<wy-poll>`](./wy-poll.ts)
 * - [`<wy-meeting-card>`](./wy-meeting-card.ts)
 * - [`<wy-comment-list>`](./wy-comment-list.ts)
 * - [`<wy-preview>`](./wy-preview.ts)
 *
 * @csspart wy-post - Root post container.
 * @csspart wy-highlight - Highlight modifier for linked posts.
 * @csspart wy-post-header - Main post header wrapper.
 * @csspart wy-post-body - Main post body wrapper.
 * @csspart wy-post-footer - Footer meta/actions area.
 * @csspart wy-content - HTML/content area.
 * @csspart wy-post-comments - Comments container.
 * @csspart wy-post-attachment-list - Attachments area list.
 *
 * @fires {PollVoteEventType} vote - Emitted when a poll option is voted.
 * @fires {PostSubscribeEventType} subscribe - Emitted when subscribe/unsubscribe is requested.
 * @fires {PostTrashEventType} trash - Emitted when the post should be trashed.
 * @fires {PostEditEventType} edit - Emitted when edit mode is requested.
 * @fires {WyActionEventType} wy-action - Emitted when an embed action button is triggered.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement("wy-post-view")
@localized()
export class WyPostView extends WeavySubAppComponent {
  static override styles = [postCss, highlightCss, contentCss, placeholderCss, messagesCss, textCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Identifier of the post being rendered.
   */
  @property({ type: Number })
  postId!: number;

  /**
   * Author metadata for the post.
   */
  @property({ attribute: false })
  createdBy!: MemberType;

  /**
   * ISO timestamp indicating when the post was created.
   */
  @property()
  createdAt: string = "";

  /**
   * ISO timestamp for the last modification, if available.
   */
  @property()
  modifiedAt: string | undefined = undefined;

  /**
   * Indicates whether the current user subscribes to the post.
   */
  @property({ type: Boolean })
  isSubscribed: boolean = false;

  /**
   * True when the post has been moved to trash.
   */
  @property({ type: Boolean })
  isTrashed: boolean = false;

  /**
   * HTML content of the post body.
   */
  @property()
  html: string = "";

  /**
   * Plain-text representation of the post content.
   */
  @property()
  text: string = "";

  /**
   * Annotation files attached to the post.
   */
  @property({ type: Array })
  annotations: FileType[] = [];

  /**
   * Attachment files associated with the post.
   */
  @property({ type: Array })
  attachments: FileType[] = [];

  /**
   * Poll options configured on the post.
   */
  @property({ type: Array })
  pollOptions: PollOptionType[] | undefined = [];

  /**
   * Meeting information attached to the post, if any.
   */
  @property({ attribute: false })
  meeting?: MeetingType;

  /**
   * Embed metadata rendered inside the post.
   */
  @property({ attribute: false })
  embed?: EmbedType;

  /**
   * Reactions applied to the post.
   */
  @property({ type: Array })
  reactions?: ReactableType[] = [];

  /**
   * Number of comments associated with the post.
   */
  @property({ attribute: false })
  commentCount: number = 0;

  /**
   * Members who have seen the post.
   */
  @property({ type: Array })
  seenBy: MemberType[] = [];

  /**
   * Highlight the post when it matches the active deep link.
   */
  @property({ type: Boolean })
  highlight: boolean = false;

  /**
   * Toggle indicating whether comments are currently visible.
   *
   * @internal
   */
  @state()
  private showComments: boolean = false;

  /**
   * Guard used to lazy-load comments when expanded.
   *
   * @internal
   */
  @state()
  private loadComments: boolean = false;

  /**
   * True when a linked comment targets this post.
   *
   * @internal
   */
  @state()
  isCommentLinked: boolean = false;

  /**
   * Preview instance handling annotation files.
   *
   * @internal
   */
  private previewAnnotationsRef: Ref<WyPreview> = createRef();

  /**
   * Preview instance handling attachment files.
   *
   * @internal
   */
  private previewAttachmentsRef: Ref<WyPreview> = createRef();

  /**
   * DOM reference used to scroll highlighted posts into view.
   *
   * @internal
   */
  private highlightRef: Ref<HTMLElement> = createRef();

  /**
   * Emit a `vote` event for the specified poll option.
   *
   * @internal
   * @param optionId - Identifier of the selected poll option.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchVote(optionId: number) {
    const event: PollVoteEventType = new (CustomEvent as NamedEvent)("vote", { detail: { optionId } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `subscribe` event toggling post subscription state.
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
   * Emit a `trash` event requesting the post to move into trash.
   *
   * @internal
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchTrash() {
    const event: PostTrashEventType = new (CustomEvent as NamedEvent)("trash", { detail: { id: this.postId } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit an `edit` event toggling edit mode for this post.
   *
   * @internal
   * @param edit - Desired edit state.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchEdit(edit: boolean) {
    const event: PostEditEventType = new (CustomEvent as NamedEvent)("edit", { detail: { edit: edit } });
    return this.dispatchEvent(event);
  }

  /**
   * Toggle comment visibility and ensure comment data is loaded.
   *
   * @internal
   * @param e - Click event originating from the comment button.
   */
  private handleCommentsClick(e: Event) {
    e.preventDefault();
    this.showComments = !this.showComments;
    this.loadComments = true;
  }

  protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);

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

    const hasImages = Boolean(images && images.length);
    const hasText = Boolean(this.html);
    const hasAnnotations = Boolean(this.annotations && this.annotations.length);
    const hasPoll = Boolean(this.pollOptions && this.pollOptions.length);
    const hasEmbed = Boolean(this.componentFeatures?.allowsFeature(Feature.Embeds) && this.embed);
    const hasFiles = files && Boolean(files.length);
    const hasMeeting = Boolean(this.meeting);

    const hasBody = hasText || hasAnnotations || hasPoll || hasEmbed || hasFiles || hasMeeting;

    return this.postId < 0
      ? html`
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
            </wy-item>
            <div part="wy-post-body">
              <div part="wy-content wy-post-content"><wy-skeleton .text=${this.text}></wy-skeleton></div>
            </div>
            <div part="wy-post-footer"></div>
          </div>
        `
      : html`
          <div
            part=${partMap({ "wy-post": true, "wy-highlight": this.highlight && !this.isCommentLinked })}
            ${ref(this.highlightRef)}
          >
            <wy-item part="wy-post-header" align="top" size="md" noPadding>
              <wy-avatar
                slot="image"
                .src="${this.createdBy.avatar_url}"
                .isAgent=${this.createdBy.is_agent}
                .size=${48}
                .name=${this.createdBy.name}
              ></wy-avatar>
              <span slot="title">${this.createdBy.name}</span>
              <span slot="text">
                <time datetime=${this.createdAt} title=${dateFull}>${dateFromNow}</time>
                ${
                  this.modifiedAt
                    ? html`<time datetime="${this.modifiedAt}" title=${modifiedDateFull}> · ${msg("edited")}</time>`
                    : nothing
                }
              </span>
              <wy-dropdown slot="actions">
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
            </wy-item>

            <!-- image grid -->
            ${
              hasImages
                ? html`<wy-image-grid
                    part="wy-post-images"
                    outer
                    .images=${images}
                    @file-open=${(e: FileOpenEventType) => {
                      void this.previewAttachmentsRef.value?.open(e.detail.fileId);
                    }}
                  ></wy-image-grid>`
                : ``
            }

            ${
              hasBody
                ? html`
                    <div part="wy-post-body">
                      <!-- text content -->
                      ${hasText ? html`<div part="wy-content wy-post-content">${unsafeHTML(this.html)}</div>` : ``}

                      <!-- annotations -->
                      ${hasAnnotations
                        ? html`<wy-annotation-list
                            .files=${this.annotations}
                            @file-open=${(e: FileOpenEventType) => {
                              void this.previewAnnotationsRef.value?.open(e.detail.fileId);
                            }}
                          ></wy-annotation-list>`
                        : nothing}

                      <!-- poll -->
                      ${hasPoll && this.pollOptions
                        ? html`
                            <wy-poll
                              .pollOptions=${this.pollOptions}
                              @vote=${(e: PollVoteEventType) => this.dispatchVote(e.detail.optionId)}
                            ></wy-poll>
                          `
                        : nothing}

                      <!-- embeds -->
                      ${hasEmbed && this.embed ? html` <wy-embed .embed=${this.embed}></wy-embed> ` : nothing}

                      <!-- files -->
                      ${hasFiles
                        ? html`<wy-attachment-list
                            filled
                            part="wy-post-attachments"
                            .files=${files ?? []}
                            @file-open=${(e: FileOpenEventType) => {
                              void this.previewAttachmentsRef.value?.open(e.detail.fileId);
                            }}
                          ></wy-attachment-list>`
                        : nothing}
                      <!-- meeting -->
                      ${hasMeeting && this.meeting
                        ? html`<wy-meeting-card .meeting=${this.meeting}></wy-meeting-card>`
                        : nothing}
                    </div>
                  `
                : nothing
            }
          <div part="wy-post-footer">

            <!-- comment count -->
            ${
              this.componentFeatures?.allowsFeature(Feature.Comments)
                ? html` <wy-button
                    small
                    kind="inline"
                    ?active=${this.showComments}
                    part="wy-meta"
                    color="inherit"
                    @click=${(e: Event) => this.handleCommentsClick(e)}
                  >
                    ${this.commentCount !== 1 ? msg(str`${this.commentCount} comments`) : msg("1 comment")}
                  </wy-button>`
                : nothing
            }

            <!-- reactions -->
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
          <div part="wy-post-comments ${partMap({ "wy-show": this.showComments })}">
            ${
              this.loadComments
                ? html`
                    <wy-comment-list
                      reveal
                      part="wy-post-comment-list"
                      .parentId=${this.postId}
                      .location=${"posts"}
                    ></wy-comment-list>
                  `
                : nothing
            }
          </div>
        </div>

            ${
              this.annotations?.length
                ? html`<wy-preview
                    ${ref(this.previewAnnotationsRef)}
                    .files=${this.annotations}
                    .isAttachment=${true}
                  ></wy-preview> `
                : nothing
            }
            ${
              this.attachments?.length
                ? html`<wy-preview
                    ${ref(this.previewAttachmentsRef)}
                    .files=${[...images, ...files]}
                    .isAttachment=${true}
                  ></wy-preview> `
                : nothing
            }
          </div>
        `;
  }

  protected override updated(changedProperties: PropertyValueMap<this>) {
    if (changedProperties.has("highlight") && this.highlight) {
      this.highlightRef.value?.scrollIntoView({ block: "nearest" });
    }
  }
}
