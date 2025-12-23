import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import { CommentType, CommentsResultType, MutateCommentProps } from "../types/comments.types";
import { getAddCommentMutationOptions, getCommentsOptions } from "../data/comments";
import { EntityTypeString, PermissionType } from "../types/app.types";
import { hasPermission } from "../utils/permission";
import { repeat } from "lit/directives/repeat.js";
import { localized, msg } from "@lit/localize";
import { updateReaction } from "../data/reactions";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { MutationController } from "../controllers/mutation-controller";
import { RemoveCommentMutationType, getRestoreCommentMutation, getTrashCommentMutation } from "../data/comment-remove";
import { PollMutationType, getPollMutation } from "../data/poll";
import { getFlatInfiniteResultData, updateCacheItem } from "../utils/query-cache";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import type { RealtimeReactionEventType } from "../types/realtime.types";
import type { MsgType } from "../types/msg.types";
import { Feature } from "../types/features.types";
import type { EditorSubmitEventType } from "../types/editor.events";
import type { CommentRestoreEventType, CommentTrashEventType } from "../types/comments.events";
import type { PollVoteEventType } from "../types/polls.events";

import commentsCss from "../scss/components/comments.scss";
import pagerStyles from "../scss/components/pager.scss";

import "./wy-comment";
import "./ui/wy-progress-circular";
import "./wy-editor-comment";
import "./wy-empty";

declare global {
  interface HTMLElementTagNameMap {
    "wy-comment-list": WyCommentList;
  }
}

/**
 * Comment list component rendering a list of comments and an editor to create comments.
 *
 * **Used sub components:**
 *
 * - [`<wy-comment>`](./wy-comment.ts)
 * - [`<wy-comment-editor>`](./wy-editor-comment.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * - [`<wy-empty>`](./wy-empty.ts)
 *
 * @csspart wy-comments - Container for the comments list
 * @csspart wy-pager - Pager container element
 * @csspart wy-pager-bottom - Bottom pager modifier
 *
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement("wy-comment-list")
@localized()
export class WyCommentList extends WeavySubAppComponent {
  static override styles = [commentsCss, pagerStyles];

  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Id of the parent entity (post/file/app) to which comments belong.
   *
   * Set this to load comments for a specific parent.
   */
  @property({ type: Number })
  parentId?: number;

  /**
   * Location where the comments are stored.
   */
  @property({ attribute: false })
  location: "posts" | "files" | "apps" = "apps";

  /**
   * Placeholder text for the comment editor input.
   */
  @property()
  placeholder?: string;

  /**
   * Whether comments should be revealed (expanded) by default.
   */
  @property({ type: Boolean, reflect: true })
  reveal: boolean = false;

  /**
   * Adds padding to the comment list container.
   */
  @property({ type: Boolean, reflect: true })
  padded: boolean = false;

  /**
   * Internal promise resolver used to wait for parentId to become available.
   *
   * @internal
   */
  #resolveParentId?: (parentId: number) => void;
  #whenParentId = new Promise<number>((r) => {
    this.#resolveParentId = r;
  });

  /**
   * Resolves when `parentId` is available.
   *
   * @returns Promise<number>
   */
  async whenParentId() {
    return await this.#whenParentId;
  }

  /**
   * Infinite query controller for loading paged comments.
   *
   * @internal
   */
  commentsQuery = new InfiniteQueryController<CommentsResultType>(this);

  /**
   * Mutation controller used to add comments.
   *
   * @internal
   */
  private addCommentMutation = new MutationController<CommentType, Error, MutateCommentProps, unknown>(this);

  /**
   * Mutation controller used to trash a comment.
   *
   * @internal
   */
  private removeCommentMutation?: RemoveCommentMutationType;
  
  /**
   * Mutation controller used to restore a comment.
   *
   * @internal
   */
  private restoreCommentMutation?: RemoveCommentMutationType;
  /**
   * Mutation controller used for poll voting.
   *
   * @internal
   */
  private pollMutation?: PollMutationType;

  /**
   * Infinite scroll controller instance used to observe the pager node.
   *
   * @internal
   */
  private infiniteScroll = new InfiniteScrollController(this);

  /**
   * Ref for pager element used by the infinite scroll controller.
   *
   * @internal
   */
  private pagerRef: Ref<HTMLElement> = createRef();

  /**
   * Unsubscribe function for realtime subscriptions.
   *
   * @internal
   */
  #unsubscribeToRealtime?: () => void;

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (changedProperties.has("parentId") && this.parentId) {
      this.#resolveParentId?.(this.parentId);
    }

    if (
      (changedProperties.has("parentId") ||
        changedProperties.has("weavy") ||
        changedProperties.has("componentFeatures")) &&
      this.parentId &&
      this.weavy
    ) {
      await this.commentsQuery.trackInfiniteQuery(getCommentsOptions(this.weavy, this.location, this.parentId));
      await this.addCommentMutation.trackMutation(getAddCommentMutationOptions(this.weavy));
      this.removeCommentMutation = getTrashCommentMutation(this.weavy, this.location, this.parentId);
      this.restoreCommentMutation = getRestoreCommentMutation(this.weavy, this.location, this.parentId);
    }

    if (
      (changedProperties.has("weavy") || changedProperties.has("app") || changedProperties.has("componentFeatures")) &&
      this.weavy &&
      this.app
    ) {
      this.pollMutation = getPollMutation(this.weavy, this.app.id, [this.location, this.parentId, "comments"]);

      // realtime

      this.#unsubscribeToRealtime?.();

      const subscribeGroup = `a${this.app.id}`;

      void this.weavy.subscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);

      if (this.componentFeatures?.allowsFeature(Feature.Reactions)) {
        void this.weavy.subscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
        void this.weavy.subscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
      }

      this.#unsubscribeToRealtime = () => {
        void this.weavy?.unsubscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);
        void this.weavy?.unsubscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
        void this.weavy?.unsubscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
        this.#unsubscribeToRealtime = undefined;
      };
    }
  }

  protected override update(changedProperties: PropertyValueMap<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.commentsQuery.result, this.pagerRef.value);
  }

  /**
   * Handler invoked when a realtime comment is created.
   *
   * @internal
   */
  handleRealtimeCommentCreated = () => {
    void this.weavy?.queryClient.invalidateQueries({ queryKey: [this.location, this.parentId, "comments"] });
  };

  /**
   * Handler invoked when a realtime reaction is added.
   *
   * Updates the local cache for the affected comment.
   *
   * @internal
   */
  handleRealtimeReactionAdded = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavy || realtimeEvent.entity.type !== EntityTypeString.Comment) {
      return;
    }

    updateCacheItem(
      this.weavy.queryClient,
      [this.location, this.parentId, "comments"],
      realtimeEvent.entity.id,
      (item: MsgType) => {
        updateReaction(item, realtimeEvent.reaction, realtimeEvent.actor);
      }
    );
  };

  /**
   * Handler invoked when a realtime reaction is removed.
   *
   * Updates the local cache for the affected comment.
   *
   * @internal
   */
  handleRealtimeReactionDeleted = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavy || realtimeEvent.entity.type !== EntityTypeString.Comment) {
      return;
    }
    updateCacheItem(
      this.weavy.queryClient,
      [this.location, this.parentId, "comments"],
      realtimeEvent.entity.id,
      (item: MsgType) => {
        updateReaction(item, undefined, realtimeEvent.actor);
      }
    );
  };

  /**
   * Handle submit from the comment editor and trigger add comment mutation.
   *
   * @internal
   */
  private async handleSubmit(e: EditorSubmitEventType) {
    if (this.app && this.parentId && this.user) {
      await this.addCommentMutation.mutate({
        app_id: this.app.id,
        parent_id: this.parentId,
        type: this.location,
        text: e.detail.text,
        meeting_id: e.detail.meetingId,
        blobs: e.detail.blobs,
        poll_options: e.detail.pollOptions,
        embed_id: e.detail.embedId,
        context: e.detail.contextData,
        user: this.user,
      });
    }
  }

  /**
   * Render comment items from a flattened page array.
   *
   * @internal
   */
  private renderComments(flattenedPages?: MsgType[]) {
    if (flattenedPages) {
      return repeat(
        flattenedPages,
        (comment) => comment.id,
        (comment) => {
          return this.parentId
            ? html`<wy-comment
                id="comment-${comment.id}"
                ?reveal=${this.reveal}
                .parentId=${this.parentId}
                .location=${this.location}
                .comment=${comment}
                @trash=${async (e: CommentTrashEventType) => {
                  const app = await this.whenApp();
                  const parentId = await this.whenParentId();
                  void this.removeCommentMutation?.mutate({
                    id: e.detail.id,
                    appId: app.id,
                    parentId: parentId,
                    type: this.location,
                  });
                }}
                @restore=${async (e: CommentRestoreEventType) => {
                  const app = await this.whenApp();
                  const parentId = await this.whenParentId();
                  void this.restoreCommentMutation?.mutate({
                    id: e.detail.id,
                    appId: app.id,
                    parentId: parentId,
                    type: this.location,
                  });
                }}
                @vote=${(e: PollVoteEventType) => {
                  if (e.detail.parentId && e.detail.parentType) {
                    void this.pollMutation?.mutate({
                      optionId: e.detail.optionId,
                      parentType: e.detail.parentType,
                      parentId: e.detail.parentId,
                    });
                  }
                }}
              ></wy-comment>`
            : nothing;
        }
      );
    }
    return nothing;
  }

  override render() {
    const { data: infiniteData, hasNextPage, isPending } = this.commentsQuery.result ?? {};
    const flattenedPages = getFlatInfiniteResultData(infiniteData);

    return html`
      ${flattenedPages && flattenedPages.length
        ? html`
            <div part="wy-comments">
              ${this.renderComments(flattenedPages)}
              ${hasNextPage ? html`<div ${ref(this.pagerRef)} part="wy-pager wy-pager-bottom"></div>` : nothing}
            </div>
          `
        : html`
            <wy-empty noNetwork
              ><wy-progress-circular indeterminate padded reveal ?hidden=${!isPending}></wy-progress-circular
            ></wy-empty>
          `}

      <wy-comment-editor
        editorLocation=${this.location}
        .parentId=${this.parentId}
        .typing=${false}
        .draft=${true}
        ?disabled=${!hasPermission(PermissionType.Create, this.app?.permissions)}
        placeholder=${this.placeholder ?? msg("Create a comment...")}
        buttonText=${msg("Comment", { desc: "Button action to comment" })}
        @submit=${(e: EditorSubmitEventType) => this.handleSubmit(e)}
      ></wy-comment-editor>
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
