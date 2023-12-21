import { LitElement, type PropertyValues, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { FeaturesConfigType, FeaturesListType } from "../types/features.types";
import { consume } from "@lit/context";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import {
  CommentMutationContextType,
  CommentType,
  CommentsResultType,
  MutateCommentProps,
} from "../types/comments.types";
import { getAddCommentMutationOptions, getCommentsOptions } from "../data/comments";
import type { AppType } from "../types/app.types";
import type { UserType } from "../types/users.types";
import { InfiniteData } from "@tanstack/query-core";
import { repeat } from "lit/directives/repeat.js";
import { localized, msg } from "@lit/localize";

import { MutationController } from "../controllers/mutation-controller";
import { RemoveCommentMutationType, getRestoreCommentMutation, getTrashCommentMutation } from "../data/comment-remove";
import { PollMutationType, getPollMutation } from "../data/poll";

import chatCss from "../scss/all.scss";

import "./wy-comment";
import "./wy-spinner";
import "./wy-comment-editor";
import { addCacheItem, updateCacheItem } from "../utils/query-cache";
import { RealtimeCommentEventType, RealtimeReactionEventType } from "../types/realtime.types";
import { WeavyContextProps } from "../types/weavy.types";

@customElement("wy-comments")
@localized()
export default class WyComments extends LitElement {
  
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ attribute: false })
  app!: AppType;

  @property({ attribute: false })
  user!: UserType;

  @property({ type: Number })
  parentId!: number;

  @property({ attribute: false })
  location: "posts" | "files" | "apps" = "apps";

  @property({ type: Object })
  features?: FeaturesConfigType = {};

  @property({ type: Array })
  availableFeatures?: FeaturesListType;


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

  override async willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
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

    if (changedProperties.has("weavyContext") && this.weavyContext) {
      // realtime
      this.weavyContext.subscribe(`a${this.app.id}`, "comment_created", this.handleRealtimeCommentCreated);
      this.weavyContext.subscribe(`a${this.app.id}`, "reaction_added", this.handleRealtimeReactionAdded);
      this.weavyContext.subscribe(`a${this.app.id}`, "reaction_removed", this.handleRealtimeReactionDeleted);
    }
  }

  protected override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.commentsQuery.result, this.pagerRef.value);
  }

  handleRealtimeCommentCreated = (realtimeEvent: RealtimeCommentEventType) => {
    if (
      !this.weavyContext ||
      realtimeEvent.actor.id === this.user!.id ||
      realtimeEvent.comment.parent?.id !== this.parentId
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
        item.reactions = [
          ...(item.reactions || []),
          { content: realtimeEvent.reaction, created_by_id: realtimeEvent.actor.id },
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
        item.reactions = item.reactions.filter((item) => item.created_by_id !== realtimeEvent.actor.id);
      }
    );
  };

  private async handleSubmit(e: CustomEvent) {
    if (this.app) {
      await this.addCommentMutation.mutate({
        appId: this.app.id,
        parentId: this.parentId,
        type: this.location,
        text: e.detail.text,
        meetingId: e.detail.meetingId,
        blobs: e.detail.blobs,
        pollOptions: e.detail.pollOptions,
        embed: e.detail.embed,
        user: this.user,
      });
    }
  }

  private renderComments(infiniteData?: InfiniteData<CommentsResultType>) {
    if (infiniteData) {
      const flattenedPages = infiniteData.pages.flatMap((messageResult) => messageResult.data);

      return repeat(
        flattenedPages,
        (comment) => comment.id,
        (comment) => {
          return [
            html`<wy-comment
              id="comment-${comment.id}"
              .app=${this.app}
              .user=${this.user}
              .commentId=${comment.id}
              .parentId=${this.parentId}
              .temp=${false}
              .createdBy=${comment.created_by}
              .createdAt=${comment.created_at}
              .modifiedAt=${comment.modified_at}
              .isTrashed=${comment.is_trashed}
              .html=${comment.html}
              .text=${comment.text}
              .attachments=${comment.attachments}
              .embed=${comment.embed}
              .meeting=${comment.meeting}
              .pollOptions=${comment.options}
              .reactions=${comment.reactions}
              .availableFeatures=${this.availableFeatures}
              .features=${this.features}
              @trash=${(e: CustomEvent) => {
                this.removeCommentMutation?.mutate({
                  id: e.detail.id,
                  appId: this.app.id,
                  parentId: this.parentId,
                  type: this.location,
                });
              }}
              @restore=${(e: CustomEvent) => {
                this.restoreCommentMutation?.mutate({
                  id: e.detail.id,
                  appId: this.app.id,
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
              }}></wy-comment>`,
          ];
        }
      );
    }

    return nothing;
  }

  override render() {
    const { data: infiniteData, isPending } = this.commentsQuery.result ?? {};

    return html` <div>
      <div class="wy-comments">
        ${!isPending && this.app && infiniteData && this.availableFeatures
          ? this.renderComments(infiniteData)
          : html`<wy-spinner class="wy-content-icon"></wy-spinner>`}
        <div ${ref(this.pagerRef)} class="wy-pager"></div>
      </div>
      <wy-comment-editor
        editorLocation=${this.location}
        .app=${this.app}
        .user=${this.user}
        .parentId=${this.parentId}
        .availableFeatures=${this.availableFeatures}
        .features=${this.features}
        .typing=${false}
        .draft=${true}
        placeholder=${msg("Create a comment...")}
        buttonText=${msg("Comment", { desc: "Button action to comment" })}
        @submit=${(e: CustomEvent) => this.handleSubmit(e)}></wy-comment-editor>
    </div>`;
  }

  override disconnectedCallback(): void {
    if (this.weavyContext && this.app) {
      // realtime
      this.weavyContext.unsubscribe(`a${this.app.id}`, "comment_created", this.handleRealtimeCommentCreated);
      this.weavyContext.unsubscribe(`a${this.app.id}`, "reaction_added", this.handleRealtimeReactionAdded);
      this.weavyContext.unsubscribe(`a${this.app.id}`, "reaction_removed", this.handleRealtimeReactionDeleted);
    }
    super.disconnectedCallback();
  }
}
