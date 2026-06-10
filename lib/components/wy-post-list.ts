import { localized, msg } from "@lit/localize";
import { type PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { PollMutationType, getPollMutation } from "../data/poll";
import { RemovePostMutationType, getRestorePostMutation, getTrashPostMutation } from "../data/post-remove";
import { SubscribePostMutationType, getSubscribePostMutation } from "../data/post-subscribe";
import { getPostsOptions, getRealtimePostOptions } from "../data/posts";
import type { PostQueryFilterType, PostsResultType } from "../types/posts.types";
import { getFlatInfiniteResultData } from "../utils/query-cache";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import type { PollVoteEventType } from "../types/polls.events";
import type { PostRestoreEventType, PostSubscribeEventType, PostTrashEventType } from "../types/posts.events";
import { property, state } from "lit/decorators.js";
import { UnreadPostsController } from "../controllers/unread-posts-controller";
import { isPlainObject } from "../utils/objects";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { scrollParentTo } from "../utils/scroll-position";
import { RealtimeController } from "../controllers/realtime-controller";

import postsCss from "../scss/components/post.scss";
import headerCss from "../scss/components/header.scss";
import pagerCss from "../scss/components/pager.scss";
import hostContentsCss from "../scss/host-contents.scss";
import bannerCss from "../scss/components/banner.scss";

import "./wy-empty";
import "./wy-post";
import "./ui/wy-progress-circular";

declare global {
  interface HTMLElementTagNameMap {
    "wy-post-list": WyPostList;
  }
}

/**
 * List container rendering a paginated list of posts.
 *
 * **Used sub components:**
 *
 * - [`<wy-post>`](./wy-post.ts)
 * - [`<wy-empty>`](./wy-empty.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 *
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
  static override styles = [postsCss, headerCss, pagerCss, hostContentsCss, bannerCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Infinite query controller providing paginated posts.
   *
   * @internal
   */
  protected postsQuery = new InfiniteQueryController<PostsResultType>(this);

  /**
   * Realtime controller.
   *
   * @internal
   */
  protected postsRealtime = new RealtimeController(this);

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

  /** @internal */
  protected unreadPostsController: UnreadPostsController = new UnreadPostsController(this);

  /**
   * Placeholder text for the comment editor input.
   */
  @property()
  placeholder?: string;

  /** Current unread conversation count. */
  get unread(): number {
    return this.unreadPostsController.unread;
  }

  /**
   * Id of the last post
   * @internal
   */
  @state()
  lastPostId?: number;

  /**
   * Whether the post list a feed of posts.
   */
  @property({ type: Boolean })
  feed: boolean = false;

  /**
   * Which posts to show.
   */
  @property({
    type: Object,
    hasChanged: (value, oldValue) => {
      return isPlainObject(value) && isPlainObject(oldValue) && JSON.stringify(value) !== JSON.stringify(oldValue);
    },
  })
  filter: PostQueryFilterType = {
    app: undefined,
    q: "",
    tag: "",
    trashed: false,
    following: false,
    order_by: undefined,
  };

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("app") ||
        changedProperties.has("feed") ||
        changedProperties.has("filter")) &&
      this.weavy &&
      (this.app || this.feed) &&
      this.filter
    ) {
      const listId = this.app && !this.feed ? this.app.id : "feed";
      await this.postsQuery.trackInfiniteQuery(getPostsOptions(this.weavy, listId, this.filter));
    }

    if (this.postsQuery.result.data) {
      let lastPostId = this.lastPostId;
      getFlatInfiniteResultData(this.postsQuery.result.data).forEach((post) => {
        if (!lastPostId || post.id > lastPostId) {
          lastPostId = post.id;
        }
      });
      this.lastPostId = lastPostId;
    }

    if (
      (changedProperties.has("weavy") || changedProperties.has("app") || changedProperties.has("feed")) &&
      this.weavy &&
      (this.feed || this.app)
    ) {
      const appOrFeed = !this.feed && this.app ? this.app : "feed";
      const appOrFeedId = (!this.feed && this.app?.id) || "feed";

      this.subscribePostMutation = getSubscribePostMutation(this.weavy, appOrFeed);
      this.removePostMutation = getTrashPostMutation(this.weavy, appOrFeed);
      this.restorePostMutation = getRestorePostMutation(this.weavy, appOrFeed);
      this.pollMutation = getPollMutation(this.weavy, appOrFeedId, ["posts", appOrFeedId]);
    }

    if (
      (changedProperties.has("filter") ||
        changedProperties.has("lastPostId") ||
        changedProperties.has("app") ||
        changedProperties.has("feed")) &&
      (this.feed || this.app)
    ) {
      const appOrFeed = this.app && !this.feed ? this.app : "feed";
      void this.unreadPostsController.track(appOrFeed, this.lastPostId, this.filter);
    }
  }

  override render() {
    const { data: infiniteData, isPending, hasNextPage } = this.postsQuery.result ?? {};
    const flattenedPages = getFlatInfiniteResultData(infiniteData);

    return !isPending
      ? html`
          <div
            part="wy-banner wy-banner-action wy-transition ${this.unread ? "wy-show" : ""}"
            tabindex=${this.unread ? 0 : -1}
            @click=${async () => {
              this.shadowRoot?.firstElementChild &&
                (await scrollParentTo("top", this.shadowRoot?.firstElementChild as HTMLElement, true));
              void this.weavy?.queryClient.invalidateQueries({
                queryKey: ["posts", this.feed ? "feed" : this.app?.id],
                exact: false,
              });
            }}
            @keydown=${clickOnEnterAndConsumeOnSpace}
            @keyup=${clickOnSpace}
          >
            ${msg("New posts")}
          </div>

          ${flattenedPages
            ? repeat(
                flattenedPages,
                (post) => post.id,
                (post) => {
                  // Feeds specify uid for each post
                  const uid = this.feed && post.app ? post.app.id : undefined;

                  // Non-feed forwards the app
                  const app = !this.feed ? this.app : undefined;

                  return html`<wy-post
                    id="post-${post.id}"
                    .placeholder=${this.placeholder}
                    .uid=${uid}
                    .app=${app}
                    .post=${post}
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
                },
              )
            : html`<wy-empty></wy-empty>`}
          ${hasNextPage ? html`<div ${ref(this.pagerRef)} part="wy-pager wy-pager-bottom"></div>` : nothing}
        `
      : html`<wy-empty><wy-progress-circular indeterminate padded></wy-progress-circular></wy-empty> `;
  }

  protected override updated(changedProperties: PropertyValueMap<this>): void {
    super.update(changedProperties);

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("app") ||
        changedProperties.has("componentFeatures") ||
        changedProperties.has("user") ||
        changedProperties.has("feed")) &&
      this.weavy &&
      this.app &&
      this.app?.id !== changedProperties.get("app")?.id &&
      this.componentFeatures &&
      this.user &&
      !this.feed
    ) {
      // Only post-apps can subscribe, not feeds.
      // Feeds subscribe on each post for the originating app instead
      void this.postsRealtime.track(getRealtimePostOptions(this.weavy, this.componentFeatures, this.app, this.user));
    }

    this.infiniteScroll.observe(this.postsQuery.result, this.pagerRef.value);
  }
}
