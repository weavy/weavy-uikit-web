import { html, nothing, PropertyValueMap, PropertyValues } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { CommentRestoreEventType, CommentTrashEventType } from "../types/comments.events";
import type { PollVoteEventType } from "../types/polls.events";
import type { NamedEvent } from "../types/generic.types";
import type { CommentType, MutateCommentProps } from "../types/comments.types";
import type { FileType } from "../types/files.types";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { relativeTime } from "../utils/datetime";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";
import { FileOpenEventType } from "../types/files.events";
import { Feature } from "../types/features.types";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { isEntityChainMatch } from "../utils/notifications";
import { EntityTypeString } from "../types/app.types";
import { EditorSubmitEventType } from "../types/editor.events";
import { MutationController } from "../controllers/mutation-controller";
import { getUpdateCommentMutationOptions } from "../data/comments";
import { partMap } from "../utils/directives/shadow-part-map";
import type { WyPreview } from "./wy-preview";

import rebootCss from "../scss/reboot.scss";
import commentCss from "../scss/components/comments.scss";
import textCss from "../scss/components/text.scss";
import highlightCss from "../scss/base/_highlight.scss";
import contentCss from "../scss/components/content.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-avatar";
import "./ui/wy-button";
import "./ui/wy-dropdown";
import "./ui/wy-icon";
import "./ui/wy-item";
import "./ui/wy-image-grid";
import "./ui/wy-skeleton";
import "./wy-annotation";
import "./wy-attachment";
import "./wy-embed";
import "./wy-meeting-card";
import "./wy-poll";
import "./wy-preview";
import "./wy-reactions";

declare global {
  interface HTMLElementTagNameMap {
    "wy-comment": WyComment;
  }
}

/**
 * Displays or edits a comment.
 *
 * **Used sub components**
 *
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-image-grid>`](./ui/wy-image-grid.ts)
 * - [`<wy-skeleton>`](./ui/wy-skeleton.ts)
 * - [`<wy-annotation-list>`](./wy-annotation.ts)
 * - [`<wy-attachment-list>`](./wy-attachment.ts)
 * - [`<wy-embed>`](./wy-embed.ts)
 * - [`<wy-meeting-card>`](./wy-meeting-card.ts)
 * - [`<wy-poll>`](./wy-poll.ts)
 * - [`<wy-preview>`](./wy-preview.ts)
 * - [`<wy-reactions>`](./wy-reactions.ts)
 *
 * @csspart wy-highlight - When the comment component should be briefly highlighted
 * @csspart wy-comment - Root comment container
 * @csspart wy-comment-reveal - When a comment has reveal transition
 * @csspart wy-comment-skeleton - When the comment should render as a skeleton during optimistic updates.
 * @csspart wy-comment-header - Header area (avatar, title, actions)
 * @csspart wy-comment-body - Body wrapper for comment content.
 * @csspart wy-comment-title - The title section of the comment body.
 * @csspart wy-comment-images - Images section.
 * @csspart wy-comment-footer - Section for reactions, attachments and annotations.
 * @csspart wy-trashed - When comment is trashed.
 * @csspart wy-content - HTML content area
 * @csspart wy-meta - Meta section.
 *
 * @fires {PollVoteEventType} vote - Emitted when a poll option is voted
 * @fires {CommentTrashEventType} trash - Emitted when the comment is trashed
 * @fires {CommentRestoreEventType} restore - Emitted when the comment is restored
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement("wy-comment")
@localized()
export class WyComment extends WeavySubAppComponent {
  static override styles = [rebootCss, commentCss, textCss, highlightCss, contentCss, hostContentsCss];

  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);

  /**
   * The comment data.
   */
  @property({ type: Object, attribute: false })
  comment!: CommentType;

  /**
   * The parent entity id the comment belongs to.
   *
   * Set this to ensure actions (edit/trash/restore) operate against the correct parent.
   */
  @property({ type: Number })
  parentId!: number;

  /**
   * The place where the comment is located.
   *
   * @deprecated Use contextual app info instead.
   */
  @property({ attribute: false })
  location: "posts" | "files" | "apps" = "apps";

  /**
   * Whether the comment should be visually highlighted.
   *
   * @internal
   */
  @state()
  highlight: boolean = false;

  /**
   * Whether to use a reveal transition when showing the comment.
   */
  @property({ type: Boolean, reflect: true })
  reveal: boolean = false;

  /**
   * Editing mode flag.
   *
   * @internal
   */
  @state()
  private editing: boolean = false;

  /**
   * Preview refs used to open preview overlays.
   *
   * @internal
   */
  private previewAnnotationsRef: Ref<WyPreview> = createRef();
  private previewAttachmentsRef: Ref<WyPreview> = createRef();
  private highlightRef: Ref<HTMLElement> = createRef();

  /**
   * Mutation controller used to update comments.
   *
   * @internal
   */
  private updateCommentMutation = new MutationController<CommentType, Error, MutateCommentProps, unknown>(this);

  /**
   * Dispatch a poll vote event for this comment.
   *
   * @internal
   */
  private dispatchVote(optionId: number) {
    const event: PollVoteEventType = new (CustomEvent as NamedEvent)("vote", {
      detail: { optionId, parentId: this.comment.id, parentType: "comments" },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Dispatch a trash event for this comment.
   *
   * @internal
   */
  private dispatchTrash() {
    const event: CommentTrashEventType = new (CustomEvent as NamedEvent)("trash", { detail: { id: this.comment.id } });
    return this.dispatchEvent(event);
  }

  /**
   * Dispatch a restore event for this comment.
   *
   * @internal
   */
  private dispatchRestore() {
    const event: CommentRestoreEventType = new (CustomEvent as NamedEvent)("restore", {
      detail: { id: this.comment.id },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Submit updated comment content via mutation and exit edit mode.
   *
   * @internal
   */
  private updateComment(e: EditorSubmitEventType) {
    void this.updateCommentMutation.mutate({
      id: this.comment.id,
      type: this.location,
      parent_id: this.parentId,
      text: e.detail.text,
      meeting_id: e.detail.meetingId,
      blobs: e.detail.blobs,
      attachments: e.detail.attachments,
      poll_options: e.detail.pollOptions,
      embed_id: e.detail.embedId,
    });

    this.editing = false;
  }

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("parentId") || changedProperties.has("weavy")) && this.parentId && this.weavy) {
      await this.updateCommentMutation.trackMutation(
        getUpdateCommentMutationOptions(this.weavy, [this.location, this.parentId, "comments"])
      );
    }

    if (changedProperties.has("link")) {
      this.highlight = Boolean(
        this.link && isEntityChainMatch(this.link, EntityTypeString.Comment, { id: this.comment.id })
      );
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
    const images = this.comment.attachments?.data?.filter((a: FileType) => a.kind === "image" && a.thumbnail_url) || [];
    const files = this.comment.attachments?.data?.filter((a: FileType) => a.kind !== "image" || !a.thumbnail_url) || [];

    const dateFull = new Intl.DateTimeFormat(this.weavy?.locale, {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(this.comment.created_at));
    const dateFromNow = relativeTime(this.weavy?.locale, new Date(this.comment.created_at));

    const isSkeleton = this.comment.id < 0;

    return html`
      <div part="wy-comment ${partMap({ "wy-comment-reveal": this.reveal, "wy-comment-skeleton": isSkeleton })}">
        ${isSkeleton
          ? html`
              <wy-item align="top" part="wy-comment-header">
                <wy-avatar
                  slot="image"
                  .src="${this.comment.created_by.avatar_url}"
                  .size=${32}
                  .name=${this.comment.created_by.name}
                  .isAgent=${this.comment.created_by.is_agent}
                ></wy-avatar>
                <div slot="content" part="wy-comment-body">
                  <div part="wy-comment-title">
                    ${this.comment.created_by.name}
                    <small part="wy-meta">
                      ·
                      <time datetime=${this.comment.created_at} title=${dateFull}>${dateFromNow}</time>
                      ${this.comment.updated_at
                        ? html`<time datetime=${this.comment.updated_at}> · ${msg("edited")}</time>`
                        : nothing}
                    </small>
                  </div>
                  ${this.comment.html
                    ? html`<div part="wy-content"><wy-skeleton .text=${this.comment.text}></wy-skeleton></div>`
                    : ``}
                </div>
              </wy-item>
            `
          : this.comment.is_trashed
          ? html`
              <wy-item part="wy-comment-header">
                <wy-avatar
                  slot="image"
                  .src="${this.comment.created_by.avatar_url}"
                  .size=${32}
                  .name=${this.comment.created_by.name}
                  .isAgent=${this.comment.created_by.is_agent}
                ></wy-avatar>
                <span part="wy-trashed" slot="title">${msg("Comment was trashed.")}</span>
                <wy-button small slot="actions" @click=${() => this.dispatchRestore()} color="variant"
                  >${msg("Undo")}</wy-button
                >
              </wy-item>
            `
          : this.editing
          ? html`
              <wy-item align="top" part="wy-comment-header">
                <wy-avatar
                  slot="image"
                  .src="${this.comment.created_by.avatar_url}"
                  .size=${32}
                  .name=${this.comment.created_by.name}
                  .isAgent=${this.comment.created_by.is_agent}
                ></wy-avatar>
                <wy-button small slot="actions" @click=${() => (this.editing = false)} kind="icon">
                  <wy-icon name="close"></wy-icon>
                </wy-button>
                <div slot="content" part="wy-comment-body">
                  <div part="wy-comment-title">
                    ${this.comment.created_by.name}

                    <small part="wy-meta">
                      ·
                      <time datetime=${this.comment.created_at} title=${dateFull}>${dateFromNow}</time>
                    </small>
                  </div>
                  <wy-editor
                    editorLocation=${this.location}
                    .text=${this.comment.text}
                    .embed=${this.comment.embed}
                    .options=${this.comment.options?.data}
                    .attachments=${this.comment.attachments?.data ?? []}
                    .parentId=${this.comment.id}
                    .typing=${false}
                    .draft=${false}
                    placeholder=${msg("Edit comment...")}
                    buttonText=${msg("Update", { desc: "Button action to update" })}
                    @submit=${(e: EditorSubmitEventType) => this.updateComment(e)}
                  ></wy-editor>
                </div>
              </wy-item>
            `
          : html`
              <wy-item align="top" part="wy-comment-header">
                <wy-avatar
                  slot="image"
                  .src=${this.comment.created_by.avatar_url}
                  .size=${32}
                  .name=${this.comment.created_by.name}
                  .isAgent=${this.comment.created_by.is_agent}
                ></wy-avatar>

                ${this.user && this.user.id === this.comment.created_by.id
                  ? html`
                      <wy-dropdown small slot="actions">
                        ${this.user.id === this.comment.created_by.id
                          ? html`
                              <wy-dropdown-item @click=${() => (this.editing = true)}>
                                <wy-icon name="pencil"></wy-icon>
                                ${msg("Edit")}
                              </wy-dropdown-item>
                            `
                          : nothing}
                        ${this.user.id === this.comment.created_by.id
                          ? html`
                              <wy-dropdown-item @click=${() => this.dispatchTrash()}>
                                <wy-icon name="trashcan"></wy-icon>
                                ${msg("Trash")}
                              </wy-dropdown-item>
                            `
                          : nothing}
                      </wy-dropdown>
                    `
                  : nothing}

                <div slot="content" part="wy-comment-body">
                  <div part="wy-comment-title">
                    ${this.comment.created_by.name}
                    <small part="wy-meta">
                      ·
                      <time datetime=${this.comment.created_at} title=${dateFull}>${dateFromNow}</time>
                      ${this.comment.updated_at
                        ? html`<time datetime=${this.comment.updated_at}> · ${msg("edited")}</time>`
                        : nothing}
                    </small>
                  </div>

                  <!-- image grid -->
                  ${images && Boolean(images.length)
                    ? html`<wy-image-grid
                        part="wy-comment-images"
                        .images=${images}
                        @file-open=${(e: FileOpenEventType) => {
                          void this.previewAttachmentsRef.value?.open(e.detail.fileId);
                        }}
                      ></wy-image-grid>`
                    : ``}

                  <!-- text content -->
                  ${this.comment.html ? html`<div part="wy-content">${unsafeHTML(this.comment.html)}</div>` : ``}

                  <!-- annotations -->
                  ${this.comment.annotations?.data?.length
                    ? html`<wy-annotation-list
                        .files=${this.comment.annotations.data}
                        @file-open=${(e: FileOpenEventType) => {
                          void this.previewAnnotationsRef.value?.open(e.detail.fileId);
                        }}
                      ></wy-annotation-list>`
                    : nothing}

                  <!-- poll -->
                  ${this.comment.options?.data?.length
                    ? html`
                        <wy-poll
                          .pollOptions=${this.comment.options.data}
                          @vote=${(e: PollVoteEventType) => this.dispatchVote(e.detail.optionId)}
                        ></wy-poll>
                      `
                    : nothing}

                  <!-- embeds -->
                  ${this.comment.embed && this.componentFeatures?.allowsFeature(Feature.Embeds)
                    ? html` <wy-embed .embed=${this.comment.embed}></wy-embed> `
                    : nothing}

                  <!-- files -->
                  ${files.length
                    ? html`<wy-attachment-list
                        filled
                        .files=${files ?? []}
                        @file-open=${(e: FileOpenEventType) => {
                          void this.previewAttachmentsRef.value?.open(e.detail.fileId);
                        }}
                      ></wy-attachment-list>`
                    : ``}

                  <!-- meeting -->
                  ${this.comment.meeting
                    ? html`<wy-meeting-card .meeting=${this.comment.meeting}></wy-meeting-card>`
                    : ``}

                  <div part="wy-comment-footer">
                    ${this.componentFeatures?.allowsFeature(Feature.Reactions)
                      ? html` <wy-reactions
                          lineReverse
                          small
                          .reactions=${this.comment.reactions?.data}
                          parentType=${this.location}
                          parentId=${this.parentId}
                          entityId=${this.comment.id}
                          entityType="comments"
                        ></wy-reactions>`
                      : nothing}
                    ${this.comment.annotations?.data?.length
                      ? html`<wy-preview
                          ${ref(this.previewAnnotationsRef)}
                          .files=${this.comment.annotations.data}
                          .isAttachment=${true}
                        ></wy-preview> `
                      : nothing}
                    ${this.comment.attachments?.data?.length
                      ? html`<wy-preview
                          ${ref(this.previewAttachmentsRef)}
                          .files=${[...images, ...files]}
                          .isAttachment=${true}
                        ></wy-preview> `
                      : nothing}
                  </div>
                </div>
              </wy-item>
            `}
      </div>
    `;
  }

  protected override updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("highlight") && this.highlight) {
      this.highlightRef.value?.scrollIntoView({ block: "nearest" });
    }
  }
}
