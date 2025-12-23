import { localized, msg } from "@lit/localize";
import { type PropertyValueMap, html, nothing } from "lit";
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
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import type { PollVoteEventType } from "../types/polls.events";
import type { PostRestoreEventType, PostSubscribeEventType, PostTrashEventType } from "../types/posts.events";
import type { EditorSubmitEventType } from "../types/editor.events";
import { property } from "lit/decorators.js";

import postsCss from "../scss/components/post.scss";
import headerCss from "../scss/components/header.scss";
import pagerCss from "../scss/components/pager.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./wy-editor";
import "./wy-empty";
import "./wy-post";
import "./ui/wy-progress-circular";

declare global {
  interface HTMLElementTagNameMap {
    "wy-post-list": WyPostList;
  }
}

/**
 * List container rendering a post editor and a paginated feed of posts.
 *
 * **Used sub components:**
 *
 * - [`<wy-editor>`](./wy-editor.ts)
 * - [`<wy-post>`](./wy-post.ts)
 * - [`<wy-empty>`](./wy-empty.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 *
 * @csspart wy-posts - Root posts container.
 * @csspart wy-post - Wrapper for each post/editor block.
 * @csspart wy-pager - Pager container.
 * @csspart wy-pager-bottom - Pager modifier for bottom placement.
 *
 * @fires {WyActionEventType} wy-action - Emitted when an embed action button is triggered.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement("wy-post-list")
@localized()
export class WyPostList extends WeavySubAppComponent {
  static override styles = [postsCss, headerCss, pagerCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Placeholder text shown in the post editor input.
   */
  @property()
  placeholder?: string;

  /**
   * Infinite query controller providing paginated posts.
   *
   * @internal
   */
  protected postsQuery = new InfiniteQueryController<PostsResultType>(this);

  /**
   * Intersection observer used for infinite scrolling.
   *
   * @internal
   */
  private infiniteScroll = new InfiniteScrollController(this);

  /**
   * Pager sentinel reference for lazy loading.
   *
   * @internal
   */
  private pagerRef: Ref<HTMLElement> = createRef();

  /**
   * Mutation used when creating new posts.
   *
   * @internal
   */
  private addPostMutation = new MutationController<PostType, Error, MutatePostProps, void>(this);

  /**
   * Mutation used to toggle post subscription state.
   *
   * @internal
   */
  private subscribePostMutation?: SubscribePostMutationType;

  /**
   * Mutation used to trash posts.
   *
   * @internal
   */
  private removePostMutation?: RemovePostMutationType;

  /**
   * Mutation used to restore trashed posts.
   *
   * @internal
   */
  private restorePostMutation?: RemovePostMutationType;

  /**
   * Mutation used for poll vote submissions on posts.
   *
   * @internal
   */
  private pollMutation?: PollMutationType;

  /**
   * Handle editor submissions by dispatching the create-post mutation.
   *
   * @param e - Submitted editor data.
   */
  private async handleSubmit(e: EditorSubmitEventType) {
    const app = await this.whenApp();
    const user = await this.whenUser();

    void this.addPostMutation.mutate({
      app_id: app.id,
      text: e.detail.text,
      meeting_id: e.detail.meetingId,
      blobs: e.detail.blobs,
      poll_options: e.detail.pollOptions,
      embed_id: e.detail.embedId,
      user: user,
      context: e.detail.contextData,
    });
  }

  /**
   * React to realtime post creation events.
   *
   * @internal
   */
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

  /**
   * React to realtime comment creation events.
   *
   * @internal
   */
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

  /**
   * React to realtime reaction additions.
   *
   * @internal
   */
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

  /**
   * React to realtime reaction deletions.
   *
   * @internal
   */
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

  /**
   * Active realtime unsubscribe callback.
   *
   * @internal
   */
  #unsubscribeToRealtime?: () => void;

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
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
      this.pollMutation = getPollMutation(this.weavy, this.app.id, ["posts", this.app.id]);

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

  protected override update(changedProperties: PropertyValueMap<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.postsQuery.result, this.pagerRef.value);
  }

  override render() {
    const { data: infiniteData, isPending, hasNextPage } = this.postsQuery.result ?? {};
    const flattenedPages = getFlatInfiniteResultData(infiniteData);

    return html`
      <div part="wy-posts">
        <div part="wy-posts-header">
          <wy-editor
            editorLocation="apps"
            ?disabled=${!hasPermission(PermissionType.Create, this.app?.permissions)}
            .typing=${false}
            .draft=${true}
            placeholder=${this.placeholder ?? msg("Create a post...")}
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
                        .annotations=${post.annotations?.data}
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
          : html`<wy-empty><wy-progress-circular indeterminate padded></wy-progress-circular></wy-empty> `}
      </div>
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
