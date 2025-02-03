import { localized, msg } from "@lit/localize";
import { type PropertyValues, html, nothing } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { InfiniteQueryController } from "./controllers/infinite-query-controller";
import { InfiniteScrollController } from "./controllers/infinite-scroll-controller";
import { MutationController } from "./controllers/mutation-controller";
import { ThemeController } from "./controllers/theme-controller";
import { PollMutationType, getPollMutation } from "./data/poll";
import { RemovePostMutationType, getRestorePostMutation, getTrashPostMutation } from "./data/post-remove";
import { SubscribePostMutationType, getSubscribePostMutation } from "./data/post-subscribe";
import { getAddPostMutationOptions, getPostsOptions } from "./data/posts";
import { WeavyComponent } from "./classes/weavy-component";
import { AppTypeString, PermissionType } from "./types/app.types";
import type { MutatePostProps, PostType, PostsResultType } from "./types/posts.types";
import { ProductTypes } from "./types/product.types";
import { RealtimeCommentEventType, RealtimePostEventType, RealtimeReactionEventType } from "./types/realtime.types";
import { hasPermission } from "./utils/permission";
import { addCacheItem, getFlatInfiniteResultData, updateCacheItem } from "./utils/query-cache";
import { MsgType } from "./types/msg.types";
import { updateReaction } from "./data/reactions";

import allStyles from "./scss/all.scss";
import colorModesStyles from "./scss/color-modes.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostScrollYStyles from "./scss/host-scroll-y.scss";
import hostFontStyles from "./scss/host-font.scss";
import pagerStyles from "./scss/components/pager.scss";

import "./components/wy-button";
import "./components/wy-editor";
import "./components/wy-empty";
import "./components/wy-notification-button-list";
import "./components/wy-post";
import "./components/wy-spinner";

export const WY_POSTS_TAGNAME = "wy-posts";

declare global {
  interface HTMLElementTagNameMap {
    [WY_POSTS_TAGNAME]: WyPosts;
  }
}

/**
 * Weavy component to render a feed of posts.
 *
 * @element wy-posts
 * @class WyPosts
 * @fires wy-preview-open {WyPreviewOpenEventType}
 * @fires wy-preview-close {WyPreviewCloseEventType}
 */
@customElement(WY_POSTS_TAGNAME)
@localized()
export class WyPosts extends WeavyComponent {
  static override styles = [colorModesStyles, allStyles, hostBlockStyles, hostScrollYStyles, hostFontStyles, pagerStyles];

  override productType = ProductTypes.Feeds;
  override componentType = AppTypeString.Posts;

  protected postsQuery = new InfiniteQueryController<PostsResultType>(this);

  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<HTMLElement> = createRef();
  private addPostMutation = new MutationController<PostType, Error, MutatePostProps, void>(this);
  private subscribePostMutation?: SubscribePostMutationType;
  private removePostMutation?: RemovePostMutationType;
  private restorePostMutation?: RemovePostMutationType;
  private pollMutation?: PollMutationType;

  constructor() {
    super();
    new ThemeController(this, WyPosts.styles);
  }

  private async handleSubmit(e: CustomEvent) {
    const app = await this.whenApp();
    const user = await this.whenUser();

    this.addPostMutation.mutate({
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

    weavy.queryClient.invalidateQueries({ queryKey: ["posts", realtimeEvent.comment.app.id, "comments"] });
  };

  handleRealtimeReactionAdded = async (realtimeEvent: RealtimeReactionEventType) => {
    const weavy = await this.whenWeavy();
    const app = await this.whenApp();

    if (realtimeEvent.entity.type !== "post") {
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

    if (realtimeEvent.entity.type !== "post") {
      return;
    }

    updateCacheItem(weavy.queryClient, ["posts", app.id], realtimeEvent.entity.id, (item: MsgType) => {
      updateReaction(item, undefined, realtimeEvent.actor);
    });

    // TODO: open sheet should also be updated in some way?
  };

  #unsubscribeToRealtime?: () => void;

  override willUpdate(changedProperties: PropertyValues<this>) {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("weavy") || changedProperties.has("app")) && this.weavy && this.app) {
      this.postsQuery.trackInfiniteQuery(getPostsOptions(this.weavy, this.app.id));
    }

    if ((changedProperties.has("weavy") || changedProperties.has("app")) && this.weavy && this.app) {
      this.addPostMutation.trackMutation(getAddPostMutationOptions(this.weavy, ["posts", this.app.id]));
      this.subscribePostMutation = getSubscribePostMutation(this.weavy, this.app);
      this.removePostMutation = getTrashPostMutation(this.weavy, this.app);
      this.restorePostMutation = getRestorePostMutation(this.weavy, this.app);
      this.pollMutation = getPollMutation(this.weavy, ["posts", this.app.id]);

      this.#unsubscribeToRealtime?.();

      // realtime
      const subscribeGroup = `a${this.app.id}`;

      this.weavy.subscribe(subscribeGroup, "post_created", this.handleRealtimePostCreated);
      this.weavy.subscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);
      this.weavy.subscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
      this.weavy.subscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);

      this.#unsubscribeToRealtime = () => {
        this.weavy?.unsubscribe(subscribeGroup, "post_created", this.handleRealtimePostCreated);
        this.weavy?.unsubscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);
        this.weavy?.unsubscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
        this.weavy?.unsubscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
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

    return this.app
      ? html`
          <wy-buttons floating reverse>
            <wy-notification-button-list></wy-notification-button-list>
          </wy-buttons>

          <div class="wy-posts">
            <div class="wy-post">
              <wy-editor
                editorLocation="apps"
                ?disabled=${!hasPermission(PermissionType.Create, this.app.permissions)}
                .typing=${false}
                .draft=${true}
                placeholder=${msg("Create a post...")}
                buttonText=${msg("Post")}
                @submit=${(e: CustomEvent) => this.handleSubmit(e)}
              ></wy-editor>
            </div>

            <!-- this.user ?? -->
            ${!isPending
              ? html`
                  ${this.app && this.user && flattenedPages
                    ? repeat(
                        flattenedPages,
                        (post) => post.id,
                        (post) => {
                          return this.app && this.user
                            ? html`<wy-post
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
                                @subscribe=${(e: CustomEvent) => {
                                  this.subscribePostMutation?.mutate({
                                    id: e.detail.id,
                                    subscribe: e.detail.subscribe,
                                  });
                                }}
                                @trash=${(e: CustomEvent) => {
                                  this.removePostMutation?.mutate({ id: e.detail.id });
                                }}
                                @restore=${(e: CustomEvent) => {
                                  this.restorePostMutation?.mutate({ id: e.detail.id });
                                }}
                                @vote=${(e: CustomEvent) => {
                                  this.pollMutation?.mutate({
                                    optionId: e.detail.id,
                                    parentType: e.detail.parentType,
                                    parentId: e.detail.parentId,
                                  });
                                }}
                              ></wy-post>`
                            : nothing;
                        }
                      )
                    : html`<wy-empty><wy-spinner padded reveal></wy-spinner></wy-empty>`}
                  ${hasNextPage ? html`<div ${ref(this.pagerRef)} part="wy-pager wy-pager-bottom"></div>` : nothing}
                `
              : html`<wy-empty><wy-spinner padded reveal></wy-spinner></wy-empty> `}
          </div>
        `
      : html`<wy-empty><wy-spinner padded reveal></wy-spinner></wy-empty>`;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
