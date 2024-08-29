import { localized, msg } from "@lit/localize";
import { LitElement, type PropertyValues, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { InfiniteQueryController } from "./controllers/infinite-query-controller";
import { InfiniteScrollController } from "./controllers/infinite-scroll-controller";
import { MutationController } from "./controllers/mutation-controller";
import { ThemeController } from "./controllers/theme-controller";
import { PollMutationType, getPollMutation } from "./data/poll";
import { RemovePostMutationType, getRestorePostMutation, getTrashPostMutation } from "./data/post-remove";
import { SubscribePostMutationType, getSubscribePostMutation } from "./data/post-subscribe";
import { MutatePostContextType, getAddPostMutationOptions, getPostsOptions } from "./data/posts";
import { BlockProviderMixin } from "./mixins/block-mixin";
import { type AppType, ContextualTypes, PermissionTypes } from "./types/app.types";
import { Constructor } from "./types/generic.types";
import type { MutatePostProps, PostType, PostsResultType } from "./types/posts.types";
import { ProductTypes } from "./types/product.types";
import { RealtimeCommentEventType, RealtimePostEventType, RealtimeReactionEventType } from "./types/realtime.types";
import { WeavyContextProps } from "./types/weavy.types";
import { hasPermission } from "./utils/permission";
import { addCacheItem, updateCacheItem } from "./utils/query-cache";

import allStyles from "./scss/all.scss";
import colorModesStyles from "./scss/color-modes.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostScrollYStyles from "./scss/host-scroll-y.scss";
import hostFontStyles from "./scss/host-font.scss";

import "./components/wy-button";
import "./components/wy-editor";
import "./components/wy-empty";
import "./components/wy-notification-button-list";
import "./components/wy-post";
import "./components/wy-spinner";

@customElement("wy-posts")
@localized()
export class WyPosts extends BlockProviderMixin(LitElement) {
  static override styles = [colorModesStyles, allStyles, hostBlockStyles, hostScrollYStyles, hostFontStyles];

  override productType = ProductTypes.Feeds;
  override contextualType = ContextualTypes.Posts;

  protected postsQuery = new InfiniteQueryController<PostsResultType>(this);

  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<HTMLElement> = createRef();
  private addPostMutation = new MutationController<PostType, Error, MutatePostProps, MutatePostContextType>(this);
  private subscribePostMutation?: SubscribePostMutationType;
  private removePostMutation?: RemovePostMutationType;
  private restorePostMutation?: RemovePostMutationType;
  private pollMutation?: PollMutationType;

  constructor() {
    super();
    new ThemeController(this, WyPosts.styles);
  }

  private handleSubmit(e: CustomEvent) {
    if (this.app) {
      this.addPostMutation.mutate({
        appId: this.app.id,
        text: e.detail.text,
        meetingId: e.detail.meetingId,
        blobs: e.detail.blobs,
        pollOptions: e.detail.pollOptions,
        embed: e.detail.embed,
        user: this.user!,
      });
    }
  }

  handleRealtimePostCreated = (realtimeEvent: RealtimePostEventType) => {
    if (
      !this.weavyContext ||
      realtimeEvent.post.app.id !== this.app!.id ||
      realtimeEvent.post.created_by?.id === this.user!.id
    ) {
      return;
    }

    realtimeEvent.post.created_by = realtimeEvent.actor;
    addCacheItem(this.weavyContext.queryClient, ["posts", this.app!.id], realtimeEvent.post, undefined, {
      descending: true,
    });
  };

  handleRealtimeCommentCreated = (realtimeEvent: RealtimeCommentEventType) => {
    if (!this.weavyContext || realtimeEvent.actor.id === this.user!.id) {
      return;
    }

    updateCacheItem(
      this.weavyContext.queryClient,
      ["posts", this.app!.id],
      realtimeEvent.comment.parent!.id,
      (item: PostType) => {
        if (item.comments) {
          item.comments.count += 1;
        } else {
          item.comments = { count: 1 };
        }
      }
    );
  };

  handleRealtimeReactionAdded = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavyContext || realtimeEvent.actor.id === this.user!.id || realtimeEvent.entity.type !== "post") {
      return;
    }

    updateCacheItem(
      this.weavyContext.queryClient,
      ["posts", this.app!.id],
      realtimeEvent.entity.id,
      (item: PostType) => {
        item.reactions.data = [
          ...(item.reactions.data || []),
          { content: realtimeEvent.reaction, created_by: realtimeEvent.actor },
        ];
      }
    );
  };

  handleRealtimeReactionDeleted = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavyContext || realtimeEvent.actor.id === this.user!.id || realtimeEvent.entity.type !== "post") {
      return;
    }

    updateCacheItem(
      this.weavyContext.queryClient,
      ["posts", this.app!.id],
      realtimeEvent.entity.id,
      (item: PostType) => {
        if (item.reactions.data) {
          item.reactions.data = item.reactions.data.filter((item) => item.created_by?.id !== realtimeEvent.actor.id);
        }
      }
    );
  };

  #unsubscribeToRealtime?: () => void;

  override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps & { app: AppType }>) {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("weavyContext") || changedProperties.has("app")) && this.weavyContext && this.app) {
      this.postsQuery.trackInfiniteQuery(getPostsOptions(this.weavyContext, this.app.id));
    }

    if ((changedProperties.has("weavyContext") || changedProperties.has("app")) && this.weavyContext && this.app) {
      this.addPostMutation.trackMutation(getAddPostMutationOptions(this.weavyContext, ["posts", this.app.id]));
      this.subscribePostMutation = getSubscribePostMutation(this.weavyContext, this.app);
      this.removePostMutation = getTrashPostMutation(this.weavyContext, this.app);
      this.restorePostMutation = getRestorePostMutation(this.weavyContext, this.app);
      this.pollMutation = getPollMutation(this.weavyContext, ["posts", this.app.id]);

      this.#unsubscribeToRealtime?.();

      // realtime
      const subscribeGroup = `a${this.app.id}`;
      
      this.weavyContext.subscribe(subscribeGroup, "post_created", this.handleRealtimePostCreated);
      this.weavyContext.subscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);
      this.weavyContext.subscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
      this.weavyContext.subscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);

      this.#unsubscribeToRealtime = () => {
        this.weavyContext?.unsubscribe(subscribeGroup, "post_created", this.handleRealtimePostCreated);
        this.weavyContext?.unsubscribe(subscribeGroup, "comment_created", this.handleRealtimeCommentCreated);
        this.weavyContext?.unsubscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
        this.weavyContext?.unsubscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
        this.#unsubscribeToRealtime = undefined;
      };
    }
  }

  protected override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.postsQuery.result, this.pagerRef.value);
  }

  override render() {
    const { data: infiniteData, isPending } = this.postsQuery.result ?? {};
    const flattenedPages = infiniteData?.pages.flatMap((messageResult) => messageResult.data);

    return html`
      <wy-buttons floating reverse>
        <wy-notification-button-list></wy-notification-button-list>
      </wy-buttons>

      <div class="wy-posts">
        ${this.app && this.user && hasPermission(PermissionTypes.Create, this.app.permissions)
          ? html`
              <div class="wy-post">
                <wy-editor
                  editorLocation="apps"
                  .typing=${false}
                  .draft=${true}
                  placeholder=${msg("Create a post...")}
                  buttonText=${msg("Post")}
                  @submit=${(e: CustomEvent) => this.handleSubmit(e)}
                ></wy-editor>
              </div>
            `
          : nothing}
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
                            .temp=${post.temp || false}
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
                              this.subscribePostMutation?.mutate({ id: e.detail.id, subscribe: e.detail.subscribe });
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
                : html`<wy-empty><wy-spinner padded></wy-spinner></wy-empty>`}
              <div ${ref(this.pagerRef)} class="wy-pager"></div>
            `
          : html` <wy-empty><wy-spinner overlay></wy-spinner></wy-empty> `}
      </div>
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}

export type WyPostsType = Constructor<WyPosts>;
