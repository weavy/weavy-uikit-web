import { localized, msg } from "@lit/localize";
import { LitElement, type PropertyValues, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { MutationController } from "../controllers/mutation-controller";
import { PollMutationType, getPollMutation } from "../data/poll";
import { RemovePostMutationType, getRestorePostMutation, getTrashPostMutation } from "../data/post-remove";
import { SubscribePostMutationType, getSubscribePostMutation } from "../data/post-subscribe";
import { getAddPostMutationOptions, getPostsOptions } from "../data/posts";
import { EntityTypeString, PermissionType } from "../types/app.types";
import type { MutatePostProps, PostType, PostsResultType } from "../types/posts.types";
import { RealtimeCommentEventType, RealtimePostEventType, RealtimeReactionEventType } from "../types/realtime.types";
import { hasPermission } from "../utils/permission";
import { addCacheItem, getFlatInfiniteResultData, updateCacheItem } from "../utils/query-cache";
import { MsgType } from "../types/msg.types";
import { updateReaction } from "../data/reactions";
import { Feature } from "../contexts/features-context";
import { WeavyComponentConsumerMixin } from "../classes/weavy-component-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import allStyles from "../scss/all.scss";
import pagerStyles from "../scss/components/pager.scss";

import "./wy-editor";
import "./wy-empty";
import "./wy-post";
import "./base/wy-spinner";
import { PollVoteEventType } from "../types/polls.events";
import { PostRestoreEventType, PostSubscribeEventType, PostTrashEventType } from "../types/posts.events";
import { EditorSubmitEventType } from "../types/editor.events";

@customElement("wy-post-list")
@localized()
export class WyPostList extends WeavyComponentConsumerMixin(LitElement) {
  static override styles = [allStyles, pagerStyles];

  protected exportParts = new ShadowPartsController(this);

  protected postsQuery = new InfiniteQueryController<PostsResultType>(this);

  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<HTMLElement> = createRef();
  private addPostMutation = new MutationController<PostType, Error, MutatePostProps, void>(this);
  private subscribePostMutation?: SubscribePostMutationType;
  private removePostMutation?: RemovePostMutationType;
  private restorePostMutation?: RemovePostMutationType;
  private pollMutation?: PollMutationType;

  private async handleSubmit(e: EditorSubmitEventType) {
    const app = await this.whenApp();
    const user = await this.whenUser();

    void this.addPostMutation.mutate({
      appId: app.id,
      text: e.detail.text,
      meetingId: e.detail.meetingId,
      blobs: e.detail.blobs,
      pollOptions: e.detail.pollOptions,
      embed: e.detail.embed,
      user: user,
    });
  }

  handleRealtimePostCreated = async (realtimeEvent: RealtimePostEventType) => {
    const weavy = await this.whenWeavy();
    const app = await this.whenApp();
    const user = await this.whenUser();

    if (realtimeEvent.post.app.id !== app.id || realtimeEvent.post.created_by?.id === user.id) {
      return;
    }

    realtimeEvent.post.created_by = realtimeEvent.actor;
    addCacheItem(weavy.queryClient, ["posts", app.id], realtimeEvent.post, {
      descending: true,
    });
  };

  handleRealtimeCommentCreated = async (realtimeEvent: RealtimeCommentEventType) => {
    const weavy = await this.whenWeavy();
    const app = await this.whenApp();
    const user = await this.whenUser();

    if (realtimeEvent.actor.id === user.id || !realtimeEvent.comment.parent) {
      return;
    }

    updateCacheItem(weavy.queryClient, ["posts", app.id], realtimeEvent.comment.parent.id, (item: PostType) => {
      if (item.comments) {
        item.comments.count += 1;
      } else {
        item.comments = { count: 1 };
      }
    });

    await weavy.queryClient.invalidateQueries({ queryKey: ["posts", realtimeEvent.comment.app.id, "comments"] });
  };

  handleRealtimeReactionAdded = async (realtimeEvent: RealtimeReactionEventType) => {
    const weavy = await this.whenWeavy();
    const app = await this.whenApp();

    if (realtimeEvent.entity.type !== EntityTypeString.Post) {
      return;
    }

    updateCacheItem(weavy.queryClient, ["posts", app.id], realtimeEvent.entity.id, (item: MsgType) => {
      updateReaction(item, realtimeEvent.reaction, realtimeEvent.actor);
    });

    // TODO: open sheet should also be updated in some way?
  };

  handleRealtimeReactionDeleted = async (realtimeEvent: RealtimeReactionEventType) => {
    const weavy = await this.whenWeavy();
    const app = await this.whenApp();

    if (realtimeEvent.entity.type !== EntityTypeString.Post) {
      return;
    }

    updateCacheItem(weavy.queryClient, ["posts", app.id], realtimeEvent.entity.id, (item: MsgType) => {
      updateReaction(item, undefined, realtimeEvent.actor);
    });

    // TODO: open sheet should also be updated in some way?
  };

  #unsubscribeToRealtime?: () => void;

  override async willUpdate(changedProperties: PropertyValues<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("app")) &&
      this.weavy &&
      this.app &&
      this.app?.id !== changedProperties.get("app")?.id
    ) {
      await this.postsQuery.trackInfiniteQuery(getPostsOptions(this.weavy, this.app.id));
    }

    if (
      (changedProperties.has("weavy") || changedProperties.has("app") || changedProperties.has("componentFeatures")) &&
      this.weavy &&
      this.app &&
      this.app?.id !== changedProperties.get("app")?.id
    ) {
      await this.addPostMutation.trackMutation(getAddPostMutationOptions(this.weavy, ["posts", this.app.id]));
      this.subscribePostMutation = getSubscribePostMutation(this.weavy, this.app);
      this.removePostMutation = getTrashPostMutation(this.weavy, this.app);
      this.restorePostMutation = getRestorePostMutation(this.weavy, this.app);
      this.pollMutation = getPollMutation(this.weavy, this.app.id);

      this.#unsubscribeToRealtime?.();

      // realtime
      const subscribeGroup = `a${this.app.id}`;

      void this.weavy.subscribe(subscribeGroup, "post_created", this.handleRealtimePostCreated);
      void this.weavy.subscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);

      if (this.componentFeatures?.allowsFeature(Feature.Reactions)) {
        void this.weavy.subscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
        void this.weavy.subscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
      }

      this.#unsubscribeToRealtime = () => {
        void this.weavy?.unsubscribe(subscribeGroup, "post_created", this.handleRealtimePostCreated);
        void this.weavy?.unsubscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);
        void this.weavy?.unsubscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
        void this.weavy?.unsubscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
        this.#unsubscribeToRealtime = undefined;
      };
    }
  }

  protected override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.postsQuery.result, this.pagerRef.value);
  }

  override render() {
    const { data: infiniteData, isPending, hasNextPage } = this.postsQuery.result ?? {};
    const flattenedPages = getFlatInfiniteResultData(infiniteData);

    return html`
      <div class="wy-posts">
        <div class="wy-post">
          <wy-editor
            editorLocation="apps"
            ?disabled=${!hasPermission(PermissionType.Create, this.app?.permissions)}
            .typing=${false}
            .draft=${true}
            placeholder=${msg("Create a post...")}
            buttonText=${msg("Post")}
            @submit=${(e: EditorSubmitEventType) => this.handleSubmit(e)}
          ></wy-editor>
        </div>

        <!-- this.user ?? -->
        ${!isPending
          ? html`
              ${flattenedPages
                ? repeat(
                    flattenedPages,
                    (post) => post.id,
                    (post) => {
                      return html`<wy-post
                        id="post-${post.id}"
                        .postId=${post.id}
                        .createdBy=${post.created_by}
                        .createdAt=${post.created_at}
                        .modifiedAt=${post.updated_at}
                        .isSubscribed=${post.is_subscribed}
                        .isTrashed=${post.is_trashed}
                        .html=${post.html}
                        .text=${post.text}
                        .plain=${post.plain}
                        .attachments=${post.attachments?.data}
                        .meeting=${post.meeting}
                        .pollOptions=${post.options?.data}
                        .embed=${post.embed}
                        .reactions=${post.reactions?.data}
                        .commentCount=${post.comments?.count || 0}
                        @subscribe=${(e: PostSubscribeEventType) => {
                          void this.subscribePostMutation?.mutate({
                            id: e.detail.id,
                            subscribe: e.detail.subscribe,
                          });
                        }}
                        @trash=${(e: PostTrashEventType) => {
                          void this.removePostMutation?.mutate({ id: e.detail.id });
                        }}
                        @restore=${(e: PostRestoreEventType) => {
                          void this.restorePostMutation?.mutate({ id: e.detail.id });
                        }}
                        @vote=${(e: PollVoteEventType) => {
                          if (e.detail.parentType && e.detail.parentId) {
                            void this.pollMutation?.mutate({
                              optionId: e.detail.optionId,
                              parentType: e.detail.parentType,
                              parentId: e.detail.parentId,
                            });
                          }
                        }}
                      ></wy-post>`;
                    }
                  )
                : html`<wy-empty></wy-empty>`}
              ${hasNextPage ? html`<div ${ref(this.pagerRef)} part="wy-pager wy-pager-bottom"></div>` : nothing}
            `
          : html`<wy-empty><wy-spinner padded reveal></wy-spinner></wy-empty> `}
      </div>
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
