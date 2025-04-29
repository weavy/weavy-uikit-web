import { LitElement, html, nothing, type PropertyValueMap } from "lit";
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
import { WeavyComponentConsumerMixin } from "../classes/weavy-component-consumer-mixin";
import type { RealtimeReactionEventType } from "../types/realtime.types";
import type { WeavyProps } from "../types/weavy.types";
import type { MsgType } from "../types/msg.types";
import { classMap } from "lit/directives/class-map.js";
import { Feature } from "../types/features.types";
import type { EditorSubmitEventType } from "../types/editor.events";
import type { CommentRestoreEventType, CommentTrashEventType } from "../types/comments.events";
import type { PollVoteEventType } from "../types/polls.events";

import chatCss from "../scss/all.scss";
import pagerStyles from "../scss/components/pager.scss";

import "./wy-comment";
import "./base/wy-spinner";
import "./wy-editor-comment";
import "./wy-empty";

@customElement("wy-comment-list")
@localized()
export default class WyCommentList extends WeavyComponentConsumerMixin(LitElement) {
  static override styles = [chatCss, pagerStyles];

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number })
  parentId?: number;

  @property({ attribute: false })
  location: "posts" | "files" | "apps" = "apps";

  #resolveParentId?: (parentId: number) => void;
  #whenParentId = new Promise<number>((r) => {
    this.#resolveParentId = r;
  });
  async whenParentId() {
    return await this.#whenParentId;
  }

  commentsQuery = new InfiniteQueryController<CommentsResultType>(this);

  private addCommentMutation = new MutationController<CommentType, Error, MutateCommentProps, unknown>(this);

  private removeCommentMutation?: RemoveCommentMutationType;
  private restoreCommentMutation?: RemoveCommentMutationType;
  private pollMutation?: PollMutationType;
  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<HTMLElement> = createRef();

  #unsubscribeToRealtime?: () => void;

  override async willUpdate(changedProperties: PropertyValueMap<this & WeavyProps>): Promise<void> {
    super.willUpdate(changedProperties);

    if (changedProperties.has("parentId") && this.parentId) {
      this.#resolveParentId?.(this.parentId)
    }

    if ((changedProperties.has("parentId") || changedProperties.has("weavy") || changedProperties.has("componentFeatures")) && this.parentId && this.weavy) {
      await this.commentsQuery.trackInfiniteQuery(getCommentsOptions(this.weavy, this.location, this.parentId));
      await this.addCommentMutation.trackMutation(getAddCommentMutationOptions(this.weavy));
      this.removeCommentMutation = getTrashCommentMutation(this.weavy, this.location, this.parentId);
      this.restoreCommentMutation = getRestoreCommentMutation(this.weavy, this.location, this.parentId);
    }
    
    if ((changedProperties.has("weavy") || changedProperties.has("app") || changedProperties.has("componentFeatures")) && this.weavy && this.app) {
      this.pollMutation = getPollMutation(this.weavy, this.app.id);

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

  handleRealtimeCommentCreated = () => {
    void this.weavy?.queryClient.invalidateQueries({ queryKey: [this.location, this.parentId, "comments"] });
  };

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

  private async handleSubmit(e: EditorSubmitEventType) {
    if (this.app && this.parentId && this.user) {
      await this.addCommentMutation.mutate({
        appId: this.app.id,
        parentId: this.parentId,
        type: this.location,
        text: e.detail.text,
        meetingId: e.detail.meetingId,
        blobs: e.detail.blobs,
        pollOptions: e.detail.pollOptions,
        embedId: e.detail.embed,
        user: this.user,
      });
    }
  }

  private renderComments(flattenedPages?: MsgType[]) {
    if (flattenedPages) {
      return repeat(
        flattenedPages,
        (comment) => comment.id,
        (comment) => {
          return this.parentId ? html`<wy-comment
              id="comment-${comment.id}"
              .commentId=${comment.id}
              .parentId=${this.parentId}
              .location=${this.location}
              .createdBy=${comment.created_by}
              .createdAt=${comment.created_at}
              .modifiedAt=${comment.updated_at}
              .isTrashed=${comment.is_trashed}
              .html=${comment.html}
              .text=${comment.text}
              .attachments=${comment.attachments?.data}
              .embed=${comment.embed}
              .meeting=${comment.meeting}
              .pollOptions=${comment.options?.data}
              .reactions=${comment.reactions?.data}
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
            ></wy-comment>` : nothing;
        }
      );
    }
    return nothing;
  }

  override render() {
    const { data: infiniteData, hasNextPage, isPending } = this.commentsQuery.result ?? {};
    const flattenedPages = getFlatInfiniteResultData(infiniteData);

    const commentsClass = {
      "wy-comments": true,
      "wy-comments-padded": this.location === "files"
    }

    return html`
      ${flattenedPages && flattenedPages.length
        ? html`
            <div class=${classMap(commentsClass)}>
              ${this.renderComments(flattenedPages)}
              ${hasNextPage ? html`<div ${ref(this.pagerRef)} part="wy-pager wy-pager-bottom"></div>` : nothing}
            </div>
          `
        : isPending
        ? html`<wy-empty noNetwork><wy-spinner padded reveal></wy-spinner></wy-empty>`
        : nothing}

      <wy-comment-editor
        editorLocation=${this.location}
        .parentId=${this.parentId}
        .typing=${false}
        .draft=${true}
        ?disabled=${!hasPermission(PermissionType.Create, this.app?.permissions)}
        placeholder=${msg("Create a comment...")}
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
