import { LitElement, html, nothing, type PropertyValueMap } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import {
  CommentMutationContextType,
  CommentType,
  CommentsResultType,
  MutateCommentProps,
} from "../types/comments.types";
import { getAddCommentMutationOptions, getCommentsOptions } from "../data/comments";
import { PermissionTypes } from "../types/app.types";
import { hasPermission } from "../utils/permission";
import { InfiniteData } from "@tanstack/query-core";
import { repeat } from "lit/directives/repeat.js";
import { localized, msg } from "@lit/localize";

import { MutationController } from "../controllers/mutation-controller";
import { RemoveCommentMutationType, getRestoreCommentMutation, getTrashCommentMutation } from "../data/comment-remove";
import { PollMutationType, getPollMutation } from "../data/poll";

import { addCacheItem, updateCacheItem } from "../utils/query-cache";
import { RealtimeCommentEventType, RealtimeReactionEventType } from "../types/realtime.types";
import { WeavyContextProps } from "../types/weavy.types";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import chatCss from "../scss/all";

import "./wy-comment";
import "./wy-spinner";
import "./wy-comment-editor";

@customElement("wy-comment-list")
@localized()
export default class WyCommentList extends BlockConsumerMixin(LitElement) {
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number })
  parentId!: number;

  @property({ attribute: false })
  location: "posts" | "files" | "apps" = "apps";

  commentsQuery = new InfiniteQueryController<CommentsResultType>(this);

  private addCommentMutation = new MutationController<
    CommentType,
    Error,
    MutateCommentProps,
    CommentMutationContextType
  >(this);

  private removeCommentMutation?: RemoveCommentMutationType;
  private restoreCommentMutation?: RemoveCommentMutationType;
  private pollMutation?: PollMutationType;
  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<Element> = createRef();

  #unsubscribeToRealtime?: () => void;

  override async willUpdate(changedProperties: PropertyValueMap<this & WeavyContextProps>) {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("parentId") || changedProperties.has("weavyContext")) &&
      this.parentId &&
      this.weavyContext
    ) {
      this.commentsQuery.trackInfiniteQuery(getCommentsOptions(this.weavyContext, this.location, this.parentId));
      this.addCommentMutation.trackMutation(
        getAddCommentMutationOptions(this.weavyContext, ["comments", this.parentId])
      );
      this.removeCommentMutation = getTrashCommentMutation(this.weavyContext, this.parentId);
      this.restoreCommentMutation = getRestoreCommentMutation(this.weavyContext, this.parentId);
      this.pollMutation = getPollMutation(this.weavyContext, ["comments", this.parentId]);
    }

    if ((changedProperties.has("weavyContext") || changedProperties.has("app")) && this.weavyContext && this.app) {
      // realtime

      this.#unsubscribeToRealtime?.();

      const subscribeGroup = `a${this.app.id}`;

      this.weavyContext.subscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);
      this.weavyContext.subscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
      this.weavyContext.subscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);

      this.#unsubscribeToRealtime = () => {
        this.weavyContext?.unsubscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);
        this.weavyContext?.unsubscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
        this.weavyContext?.unsubscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
        this.#unsubscribeToRealtime = undefined;
      };
    }
  }

  protected override update(changedProperties: PropertyValueMap<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.commentsQuery.result, this.pagerRef.value);
  }

  handleRealtimeCommentCreated = (realtimeEvent: RealtimeCommentEventType) => {
    if (
      !this.weavyContext ||
      realtimeEvent.actor.id === this.user!.id ||
      (realtimeEvent.comment.parent && realtimeEvent.comment.parent?.id !== this.parentId) ||
      (this.app && realtimeEvent.comment.app.id !== this.app.id)
    ) {
      return;
    }

    realtimeEvent.comment.created_by = realtimeEvent.actor;
    addCacheItem(this.weavyContext.queryClient, ["comments", this.parentId], realtimeEvent.comment, undefined, {
      descending: false,
    });
  };

  handleRealtimeReactionAdded = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavyContext || realtimeEvent.actor.id === this.user!.id || realtimeEvent.entity.type !== "comment") {
      return;
    }

    updateCacheItem(
      this.weavyContext.queryClient,
      ["comments", this.parentId],
      realtimeEvent.entity.id,
      (item: CommentType) => {
        if (!item.reactions?.data) {
          item.reactions = { count: 0 };
        }
        item.reactions.data = [
          ...(item.reactions.data || []),
          { content: realtimeEvent.reaction, created_by: realtimeEvent.actor },
        ];
      }
    );
  };

  handleRealtimeReactionDeleted = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavyContext || realtimeEvent.actor.id === this.user!.id || realtimeEvent.entity.type !== "comment") {
      return;
    }

    updateCacheItem(
      this.weavyContext.queryClient,
      ["comments", this.parentId],
      realtimeEvent.entity.id,
      (item: CommentType) => {
        if (item.reactions?.data) {
          item.reactions.data = item.reactions.data.filter((item) => item.created_by?.id !== realtimeEvent.actor.id);
        }
      }
    );
  };

  private async handleSubmit(e: CustomEvent) {
    if (this.app && this.user) {
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

  private renderComments(infiniteData?: InfiniteData<CommentsResultType>) {
    if (infiniteData) {
      const flattenedPages = infiniteData.pages.flatMap((messageResult) => messageResult.data || []);

      return repeat(
        flattenedPages,
        (comment) => comment.id,
        (comment) => {
          return [
            html`<wy-comment
              id="comment-${comment.id}"
              .commentId=${comment.id}
              .parentId=${this.parentId}
              .temp=${comment?.temp || false}
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
              @trash=${async (e: CustomEvent) => {
                const app = await this.whenApp();
                this.removeCommentMutation?.mutate({
                  id: e.detail.id,
                  appId: app.id,
                  parentId: this.parentId,
                  type: this.location,
                });
              }}
              @restore=${async (e: CustomEvent) => {
                const app = await this.whenApp();
                this.restoreCommentMutation?.mutate({
                  id: e.detail.id,
                  appId: app.id,
                  parentId: this.parentId,
                  type: this.location,
                });
              }}
              @vote=${(e: CustomEvent) => {
                this.pollMutation?.mutate({
                  optionId: e.detail.id,
                  parentType: e.detail.parentType,
                  parentId: e.detail.parentId,
                });
              }}
            ></wy-comment>`,
          ];
        }
      );
    }
    return nothing;
  }

  override render() {
    const { data: infiniteData, isPending } = this.commentsQuery.result ?? {};

    return html`
      <div class="wy-comments">
        ${!isPending && this.app && infiniteData
          ? this.renderComments(infiniteData)
          : html`<wy-spinner padded></wy-spinner>`}
        <div ${ref(this.pagerRef)} part="wy-pager"></div>
      </div>
      ${hasPermission(PermissionTypes.Create, this.app?.permissions)
        ? html`
            <wy-comment-editor
              editorLocation=${this.location}
              .parentId=${this.parentId}
              .typing=${false}
              .draft=${true}
              placeholder=${msg("Create a comment...")}
              buttonText=${msg("Comment", { desc: "Button action to comment" })}
              @submit=${(e: CustomEvent) => this.handleSubmit(e)}
            ></wy-comment-editor>
          `
        : nothing}
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
