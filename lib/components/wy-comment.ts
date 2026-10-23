import { html, nothing, PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { CommentRestoreEventType, CommentTrashEventType } from "../types/comments.events";
import type { PollVoteEventType } from "../types/polls.events";
import type { NamedEvent } from "../types/generic.types";
import type { CommentType, MutateCommentProps } from "../types/comments.types";
import type { FileType } from "../types/files.types";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { relativeDays } from "../utils/datetime";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { localized, msg, str } from "@lit/localize";
import { Feature } from "../types/features.types";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { isEntityChainMatch } from "../utils/notifications";
import { EntityTypeString, PermissionType } from "../types/app.types";
import { MsgEditorSubmitEventType } from "../types/editor.events";
import { MutationController } from "../controllers/mutation-controller";
import { getUpdateCommentMutationOptions } from "../data/comments";
import { getReportMutationOptions, MutateReportProps } from "../data/reports";
import { partMap } from "../utils/directives/shadow-part-map";
import type { WyPreview } from "./wy-preview";
import { hasPermission } from "../utils/permission";
import { autoScrollRef } from "../utils/dom";
import { WyActionEventType } from "../types/action.events";
import { ActionType } from "../types/action.types";

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
import { WyEditorMsg } from "./wy-editor-msg";

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
 * @csspart wy-comment-reported - The filled flag in the meta section shown once the reader has reported the comment. Hide it with `::part(wy-comment-reported)` if reporting should be fire-and-forget.
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

  /**
   * Mutation controller used to update comments.
   *
   * @internal
   */
  private updateCommentMutation = new MutationController<CommentType, Error, MutateCommentProps, unknown>(this);

  /**
   * @internal
   */
  #reportMutation = new MutationController<void, Error, MutateReportProps, void>(this);

  /**
   * Confirm and report the comment for moderation.
   *
   * Uses the native confirm rather than an in-app dialog, matching how reporting a message works: reporting cannot be
   * undone and there is no report to look up afterwards, so the interruption is the point.
   *
   * @internal
   */
  private confirmReport() {
    const confirmed = window.confirm(
      msg("Report this comment for review? The author is not notified, and reporting cannot be undone."),
    );

    if (confirmed) {
      // comments are cached under their parent, so the patch needs the same key the list was loaded with
      void this.#reportMutation.mutate({
        entityType: "comments",
        entityId: this.comment.id,
        parentType: this.location,
        parentId: this.parentId,
      });
    }
  }

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
  private updateComment(e: MsgEditorSubmitEventType) {
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
        getUpdateCommentMutationOptions(this.weavy, [this.location, this.parentId, "comments"]),
      );
    }

    if (changedProperties.has("weavy") && this.weavy) {
      await this.#reportMutation.trackMutation(getReportMutationOptions(this.weavy));
    }

    if (changedProperties.has("link")) {
      this.highlight = Boolean(
        this.link && isEntityChainMatch(this.link, EntityTypeString.Comment, { id: this.comment.id }),
      );
    }
  }

  override render() {
    const images = this.comment.attachments?.data?.filter((a: FileType) => a.kind === "image" && a.thumbnail_url) || [];
    const files = this.comment.attachments?.data?.filter((a: FileType) => a.kind !== "image" || !a.thumbnail_url) || [];

    const dateFull = new Intl.DateTimeFormat(this.weavy?.locale, {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(this.comment.created_at));
    const dateFromNow = relativeDays(this.weavy?.locale, new Date(this.comment.created_at));

    const isSkeleton = this.comment.id < 0;

    // same wording and format as the flag on a reported message, so the two read the same across components.
    // "by you" because the flag is caller-relative: weavy keeps no report counts, so it can only ever say that this
    // reader reported the comment. Falls back to the label without a date when the report was patched into the cache
    // by the mutation and the next fetch has not brought the real timestamp yet.
    const reportedAtFull = this.comment.reported_at
      ? new Intl.DateTimeFormat(this.weavy?.locale, { dateStyle: "full", timeStyle: "short" }).format(
          new Date(this.comment.reported_at),
        )
      : "";
    const reportedTitle = this.comment.reported_at
      ? msg(str`Reported by you on ${reportedAtFull}`)
      : msg("Reported by you");

    const isAuthor = Boolean(this.user && this.user.id === this.comment.created_by.id);
    const isAdmin = hasPermission(PermissionType.Admin, this.app?.permissions);
    // Reporting your own comment is rejected by the server, and there is nothing to moderate about it anyway.
    // Skeleton comments are not on the server yet, so there is nothing to report either.
    const canReport = Boolean(
      this.componentFeatures?.allowsFeature(Feature.Report) && !isAuthor && !isSkeleton && !this.comment.is_reported,
    );

    return html`
      <div
        part="wy-comment ${partMap({
          "wy-comment-reveal": this.reveal,
          "wy-comment-skeleton": isSkeleton,
          "wy-highlight": this.highlight,
        })}"
        ${this.highlight ? ref(autoScrollRef({ block: "center" })) : nothing}
      >
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
                      <wy-editor-msg
                        editorLocation=${this.location}
                        .text=${this.comment.text}
                        .embed=${this.comment.embed}
                        .pollOptions=${this.comment.options?.data ?? []}
                        .attachments=${this.comment.attachments?.data ?? []}
                        .parentId=${this.comment.id}
                        .typing=${false}
                        .draft=${false}
                        placeholder=${msg("Edit comment...")}
                        buttonText=${msg("Update", { desc: "Button action to update" })}
                        @submit=${(e: MsgEditorSubmitEventType) => this.updateComment(e)}
                        @ready=${async (e: CustomEvent) => {
                          const editor = e.target as WyEditorMsg;
                          await editor.focusInput();
                          await editor.selectAllContent();
                        }}
                      ></wy-editor-msg>
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
                      @click=${() => this.dispatchAction({ action: ActionType.Preview, user: this.comment.created_by })}
                      role="button"
                      title=${this.comment.created_by.name}
                    ></wy-avatar>

                    ${isAuthor || isAdmin || canReport
                      ? html`
                          <wy-dropdown small slot="actions">
                            ${isAuthor
                              ? html`
                                  <wy-dropdown-item @click=${() => (this.editing = true)}>
                                    <wy-icon name="pencil"></wy-icon>
                                    ${msg("Edit")}
                                  </wy-dropdown-item>
                                `
                              : nothing}
                            ${canReport
                              ? html`
                                  <wy-dropdown-item @click=${() => this.confirmReport()}>
                                    <wy-icon name="flag"></wy-icon>
                                    ${msg("Report")}
                                  </wy-dropdown-item>
                                `
                              : nothing}
                            ${isAuthor || isAdmin
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
                        <wy-button
                          kind="link"
                          @click=${() =>
                            this.dispatchAction({ action: ActionType.Preview, user: this.comment.created_by })}
                          >${this.comment.created_by.name}</wy-button
                        >
                        <small part="wy-meta">
                          ·
                          <time datetime=${this.comment.created_at} title=${dateFull}>${dateFromNow}</time>
                          ${this.comment.updated_at
                            ? html`<time datetime=${this.comment.updated_at}> · ${msg("edited")}</time>`
                            : nothing}
                          ${this.comment.is_reported
                            ? html`<span part="wy-comment-reported" title=${reportedTitle}>
                                · <wy-icon inline name="flag" size=${14}></wy-icon>
                              </span>`
                            : nothing}
                        </small>
                      </div>

                      <!-- image grid -->
                      ${images && Boolean(images.length)
                        ? html`<wy-image-grid
                            part="wy-comment-images"
                            .images=${images}
                            @wy-action=${(e: WyActionEventType) => {
                              if (e.detail.action === ActionType.Preview && e.detail.file) {
                                void this.previewAttachmentsRef.value?.open(e.detail.file.id);
                              }
                            }}
                          ></wy-image-grid>`
                        : ``}

                      <!-- text content -->
                      ${this.comment.html
                        ? html`<div
                            part="wy-content"
                            @click=${(e: MouseEvent) => {
                              if (
                                e.target instanceof HTMLElement &&
                                e.target.matches('.wy-mention, [part~="wy-mention"]')
                              ) {
                                const uid =
                                  e.target.dataset.eid?.startsWith("u") && parseInt(e.target.dataset.eid.substring(1));
                                if (uid) {
                                  this.dispatchAction({
                                    action: ActionType.Preview,
                                    user: { id: uid, name: e.target.innerText },
                                  });
                                }
                              }
                            }}
                            >${
                              // eslint-disable-next-line lit-a11y/click-events-have-key-events
                              unsafeHTML(this.comment.html)
                            }</div
                          >`
                        : ``}

                      <!-- annotations -->
                      ${this.comment.annotations?.data?.length
                        ? html`<wy-annotation-list
                            .files=${this.comment.annotations.data}
                            @wy-action=${(e: WyActionEventType) => {
                              if (e.detail.action === ActionType.Preview && e.detail.file) {
                                void this.previewAnnotationsRef.value?.open(e.detail.file.id);
                              }
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
                            @wy-action=${(e: WyActionEventType) => {
                              if (e.detail.action === ActionType.Preview && e.detail.file) {
                                void this.previewAttachmentsRef.value?.open(e.detail.file.id);
                              }
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
}
