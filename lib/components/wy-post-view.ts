import { type PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import type { WyPreview } from "./wy-preview";
import type { FileType } from "../types/files.types";
import type { FileOpenEventType } from "../types/files.events";
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
import { dispatchUserAction } from "../utils/users";
import type { PostType } from "../types/posts.types";

import rebootCss from "../scss/reboot.scss";
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
  static override styles = [
    rebootCss,
    postCss,
    highlightCss,
    contentCss,
    placeholderCss,
    messagesCss,
    textCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Post data.
   */
  @property({ attribute: false })
  post!: PostType;

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
    const event: PollVoteEventType = new (CustomEvent as NamedEvent)("vote", { detail: { optionId, parentType: "posts" } });
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
      detail: { id: this.post.id, subscribe },
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
    const event: PostTrashEventType = new (CustomEvent as NamedEvent)("trash", { detail: { id: this.post.id } });
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

  private dispatchUserAction = dispatchUserAction.bind(this);

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
      this.highlight = Boolean(this.link && isEntityChainMatch(this.link, EntityTypeString.Post, { id: this.post.id }));
      this.isCommentLinked = Boolean(
        this.link &&
        hasEntityChildType(this.link, EntityTypeString.Post, { id: this.post.id }, EntityTypeString.Comment),
      );
    }

    if (changedProperties.has("isCommentLinked") && this.isCommentLinked) {
      this.loadComments = true;
      this.showComments = true;
    }
  }

  override render() {
    const images = this.post.attachments?.data?.filter((a: FileType) => a.kind === "image" && a.thumbnail_url) ?? [];
    const files = this.post.attachments?.data?.filter((a: FileType) => a.kind !== "image" || !a.thumbnail_url) ?? [];
    const annotations = this.post.annotations?.data;
    const pollOptions = this.post.options?.data;
    const commentCount = this.post.comments?.count || 0;
    const reactions = this.post.reactions?.data;

    const { embed, meeting } = this.post;

    const dateFull = new Intl.DateTimeFormat(this.weavy?.locale, {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(this.post.created_at));
    const dateFromNow = relativeTime(this.weavy?.locale, new Date(this.post.created_at));
    const modifiedDateFull =
      this.post.updated_at && this.weavy
        ? new Intl.DateTimeFormat(this.weavy.locale, { dateStyle: "full", timeStyle: "short" }).format(
            new Date(this.post.updated_at),
          )
        : "";

    const hasImages = images && Boolean(images.length);
    const hasText = this.post.html && Boolean(this.post.html);
    const hasAnnotations = annotations && Boolean(annotations.length);
    const hasPoll = pollOptions && Boolean(pollOptions.length);
    const hasEmbed = embed && this.componentFeatures?.allowsFeature(Feature.Embeds);
    const hasFiles = files && Boolean(files.length);
    const hasMeeting = meeting && Boolean(meeting);

    const hasBody = hasText || hasAnnotations || hasPoll || hasEmbed || hasFiles || hasMeeting;

    return this.post.id < 0
      ? html`
          <div part="wy-post">
            <wy-item slot="button" part="wy-post-header" align="top" size="md" noPadding>
              <wy-avatar
                slot="image"
                .src="${this.post.created_by.avatar_url}"
                .isAgent=${this.post.created_by.is_agent}
                .size=${48}
                .name=${this.post.created_by.name}
              ></wy-avatar>
              <span slot="title" part="wy-placeholder">${this.post.created_by.name}</span>
              <time slot="text" part="wy-placeholder">${dateFromNow}</time>
            </wy-item>
            <div part="wy-post-body">
              <div part="wy-content wy-post-content"><wy-skeleton .text=${this.post.text}></wy-skeleton></div>
            </div>
            <div part="wy-post-footer"></div>
          </div>
        `
      : html`
          <div
            part=${partMap({ "wy-post": true, "wy-highlight": this.highlight && !this.isCommentLinked })}
            ${ref(this.highlightRef)}
          >
            <wy-item slot="toggle" part="wy-post-header" align="top" size="md" noPadding>
              <wy-avatar
                slot="image"
                .src="${this.post.created_by.avatar_url}"
                .isAgent=${this.post.created_by.is_agent}
                .size=${48}
                .name=${this.post.created_by.name}
                title=${this.post.created_by.name}
                role="button"
                @click=${() => this.dispatchUserAction(this.post.created_by)}
              ></wy-avatar>
              <wy-button 
                kind="link"
                slot="title"
                @click=${() => this.dispatchUserAction(this.post.created_by)}
                >${this.post.created_by.name}</wy-button>
              <span slot="text">
                <time datetime=${this.post.created_at} title=${dateFull}>${dateFromNow}</time>
                ${
                  this.post.updated_at
                    ? html`<time datetime="${this.post.updated_at}" title=${modifiedDateFull}> · ${msg("edited")}</time>`
                    : nothing
                }
              </span>
              <wy-dropdown slot="actions">
                ${
                  this.post.is_subscribed
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
                  this.user && this.user.id === this.post.created_by.id
                    ? html`<wy-dropdown-item @click=${() => this.dispatchEdit(true)}>
                        <wy-icon name="pencil"></wy-icon>
                        ${msg("Edit")}
                      </wy-dropdown-item>`
                    : nothing
                }
                ${
                  this.user && this.user.id === this.post.created_by.id
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
                      ${hasText
                        ? html`<div
                            part="wy-content wy-post-content"
                            @click=${(e: MouseEvent) => {
                              if (
                                e.target instanceof HTMLElement &&
                                e.target.matches('.wy-mention, [part~="wy-mention"]')
                              ) {
                                const uid =
                                  e.target.dataset.eid?.startsWith("u") && parseInt(e.target.dataset.eid.substring(1));
                                if (uid) {
                                  this.dispatchUserAction({ id: uid, name: e.target.innerText });
                                }
                              }
                            }}
                            >${
                              // eslint-disable-next-line lit-a11y/click-events-have-key-events
                              unsafeHTML(this.post.html)
                            }</div
                          >`
                        : ``}

                      <!-- annotations -->
                      ${hasAnnotations
                        ? html`<wy-annotation-list
                            .files=${annotations}
                            @file-open=${(e: FileOpenEventType) => {
                              void this.previewAnnotationsRef.value?.open(e.detail.fileId);
                            }}
                          ></wy-annotation-list>`
                        : nothing}

                      <!-- poll -->
                      ${hasPoll
                        ? html`
                            <wy-poll
                              .pollOptions=${pollOptions}
                              @vote=${(e: PollVoteEventType) => this.dispatchVote(e.detail.optionId)}
                            ></wy-poll>
                          `
                        : nothing}

                      <!-- embeds -->
                      ${hasEmbed ? html` <wy-embed .embed=${embed}></wy-embed> ` : nothing}

                      <!-- files -->
                      ${hasFiles
                        ? html`<wy-attachment-list
                            filled
                            part="wy-post-attachments"
                            .files=${files}
                            @file-open=${(e: FileOpenEventType) => {
                              void this.previewAttachmentsRef.value?.open(e.detail.fileId);
                            }}
                          ></wy-attachment-list>`
                        : nothing}
                      <!-- meeting -->
                      ${hasMeeting
                        ? html`<wy-meeting-card .meeting=${meeting}></wy-meeting-card>`
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
                    ${commentCount !== 1 ? msg(str`${commentCount} comments`) : msg("1 comment")}
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
                      .reactions=${reactions}
                      parentId=${this.app.id}
                      parentType="apps"
                      entityId=${this.post.id}
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
                      .parentId=${this.post.id}
                      .location=${"posts"}
                    ></wy-comment-list>
                  `
                : nothing
            }
          </div>
        </div>

            ${
              hasAnnotations
                ? html`<wy-preview
                    ${ref(this.previewAnnotationsRef)}
                    .files=${annotations}
                    .isAttachment=${true}
                  ></wy-preview> `
                : nothing
            }
            ${
              hasImages || hasFiles
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
