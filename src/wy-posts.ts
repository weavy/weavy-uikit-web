import { LitElement, html, type PropertyValues, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { ContextConsumer } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "./client/context-definition";
import { repeat } from "lit/directives/repeat.js";
import { localized, msg } from "@lit/localize";

import type { AppType } from "./types/app.types";
import type { PostType, PostsResultType, MutatePostProps } from "./types/posts.types";
import type { UserType } from "./types/users.types";
import type { FeaturesConfigType, FeaturesListType } from "./types/features.types";

import { getApiOptions } from "./data/api";

import { InfiniteQueryController } from "./controllers/infinite-query-controller";
import { InfiniteScrollController } from "./controllers/infinite-scroll-controller";
import { MutationController } from "./controllers/mutation-controller";
import { addCacheItem, updateCacheItem } from "./utils/query-cache";

import colorModes from "./scss/colormodes.scss";
import postsCss from "./scss/all.scss";

import "./components/wy-post";
import "./components/wy-editor";
import "./components/wy-empty";
import "./components/wy-spinner";

import { MutatePostContextType, getAddPostMutationOptions, getPostsOptions } from "./data/posts";
import { InfiniteData } from "@tanstack/query-core";
import { SubscribePostMutationType, getSubscribePostMutation } from "./data/post-subscribe";
import { RemovePostMutationType, getRestorePostMutation, getTrashPostMutation } from "./data/post-remove";
import { PollMutationType, getPollMutation } from "./data/poll";
import { ThemeController } from "./controllers/theme-controller";
import { RealtimeCommentEventType, RealtimePostEventType, RealtimeReactionEventType } from "./types/realtime.types";
import { QueryController } from "./controllers/query-controller";
import { whenParentsDefined } from "./utils/dom";
import { WeavyContextProps } from "./types/weavy.types";

@customElement("wy-posts")
@localized()
export default class WyPosts extends LitElement {
  static override styles = [
    colorModes, 
    postsCss,
    css`
      :host {
        position: relative;
      }
    `
  ];

  protected weavyContextConsumer?: ContextConsumer<{ __context__: WeavyContext }, this>;

  // Manually consumed in performUpdate()
  @state()
  protected weavyContext?: WeavyContext;

  @state()
  user?: UserType;

  @property()
  uid?: string;

  @property()
  cssClass?: string;

  @state()
  availableFeatures?: FeaturesListType;

  @property({ type: Object })
  features: FeaturesConfigType = {};

  /**
   * Event: New post created.
   * @event wy:post_created
   */
  realtimePostCreatedEvent = (realtimeEvent: RealtimePostEventType) =>
    new CustomEvent("wy:post_created", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: New comment created on a post.
   * @event wy:comment_created
   */
  realtimeCommentCreatedEvent = (realtimeEvent: RealtimeCommentEventType) =>
    new CustomEvent("wy:comment_created", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: Post reaction added.
   * @event wy:reaction_added
   */
  realtimeReactionAddedEvent = (realtimeEvent: RealtimeReactionEventType) =>
    new CustomEvent("wy:reaction_added", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: Post reaction removed.
   * @event wy:reaction_removed
   */
  realtimeReactionRemovedEvent = (realtimeEvent: RealtimeReactionEventType) =>
    new CustomEvent("wy:reaction_removed", { bubbles: true, composed: false, detail: realtimeEvent });

  @state()
  protected app?: AppType;

  protected postsQuery = new InfiniteQueryController<PostsResultType>(this);

  protected appQuery = new QueryController<AppType>(this);
  protected userQuery = new QueryController<UserType>(this);
  protected featuresQuery = new QueryController<FeaturesListType>(this);

  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<Element> = createRef();
  private addPostMutation = new MutationController<PostType, Error, MutatePostProps, MutatePostContextType>(this);
  private subscribePostMutation?: SubscribePostMutationType;
  private removePostMutation?: RemovePostMutationType;
  private restorePostMutation?: RemovePostMutationType;
  private pollMutation?: PollMutationType;

  constructor() {
    super();
    new ThemeController(this, WyPosts.styles);
  }

  override async performUpdate() {
    await whenParentsDefined(this);
    this.weavyContextConsumer = new ContextConsumer(this, { context: weavyContextDefinition, subscribe: true });

    if (this.weavyContextConsumer?.value && this.weavyContext !== this.weavyContextConsumer?.value) {
      this.weavyContext = this.weavyContextConsumer?.value;
    }

    await super.performUpdate();
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
      realtimeEvent.post.app_id !== this.app!.id ||
      realtimeEvent.post.created_by_id === this.user!.id
    ) {
      return;
    }

    realtimeEvent.post.created_by = realtimeEvent.actor;
    addCacheItem(this.weavyContext.queryClient, ["posts", this.app!.id], realtimeEvent.post, undefined, {
      descending: true,
    });

    this.dispatchEvent(this.realtimePostCreatedEvent(realtimeEvent));
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
        item.comment_count = (item.comment_count || 0) + 1;
      }
    );

    this.dispatchEvent(this.realtimeCommentCreatedEvent(realtimeEvent));
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
        item.reactions = [
          ...(item.reactions || []),
          { content: realtimeEvent.reaction, created_by_id: realtimeEvent.actor.id },
        ];
      }
    );

    this.dispatchEvent(this.realtimeReactionAddedEvent(realtimeEvent));
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
        item.reactions = item.reactions.filter((item) => item.created_by_id !== realtimeEvent.actor.id);
      }
    );

    this.dispatchEvent(this.realtimeReactionRemovedEvent(realtimeEvent));
  };

  private unsubscribeToRealtime(app: AppType) {
    if (!this.weavyContext) {
      return;
    }
    this.weavyContext.unsubscribe(`a${app.id}`, "post_created", this.handleRealtimePostCreated);
    this.weavyContext.unsubscribe(`a${app.id}`, "comment_created", this.handleRealtimeCommentCreated);
    this.weavyContext.unsubscribe(`a${app.id}`, "reaction_added", this.handleRealtimeReactionAdded);
    this.weavyContext.unsubscribe(`a${app.id}`, "reaction_removed", this.handleRealtimeReactionDeleted);
  }

  override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps & { app: AppType }>) {
    if (changedProperties.has("app")) {
      const lastApp = changedProperties.get("app");

      if (lastApp && lastApp !== this.app) {
        this.unsubscribeToRealtime(lastApp);
      }
    }

    if ((changedProperties.has("uid") || changedProperties.has("weavyContext")) && this.uid && this.weavyContext) {
      this.appQuery.trackQuery(getApiOptions<AppType>(this.weavyContext, ["apps", this.uid]));
      this.userQuery.trackQuery(getApiOptions<UserType>(this.weavyContext, ["user"]));
      this.featuresQuery.trackQuery(getApiOptions<FeaturesListType>(this.weavyContext, ["features", "feeds"]));
    }

    if (!this.appQuery.result?.isPending) {
      this.app = this.appQuery.result?.data;
    }

    if (!this.userQuery.result?.isPending) {
      this.user = this.userQuery.result?.data;
    }

    if (!this.featuresQuery.result?.isPending) {
      this.availableFeatures = this.featuresQuery.result?.data;
    }

    if ((changedProperties.has("weavyContext") || changedProperties.has("app")) && this.weavyContext && this.app) {
      this.postsQuery.trackInfiniteQuery(getPostsOptions(this.weavyContext, this.app.id));
    }

    if (
      (changedProperties.has("weavyContext") || changedProperties.has("app") || changedProperties.has("user")) &&
      this.weavyContext &&
      this.app &&
      this.user
    ) {
      this.addPostMutation.trackMutation(getAddPostMutationOptions(this.weavyContext, ["posts", this.app.id]));
      this.subscribePostMutation = getSubscribePostMutation(this.weavyContext, this.app);
      this.removePostMutation = getTrashPostMutation(this.weavyContext, this.app);
      this.restorePostMutation = getRestorePostMutation(this.weavyContext, this.app);
      this.pollMutation = getPollMutation(this.weavyContext, ["posts", this.app.id]);

      // realtime
      this.weavyContext.subscribe(`a${this.app.id}`, "post_created", this.handleRealtimePostCreated);
      this.weavyContext.subscribe(`a${this.app.id}`, "comment_created", this.handleRealtimeCommentCreated);
      this.weavyContext.subscribe(`a${this.app.id}`, "reaction_added", this.handleRealtimeReactionAdded);
      this.weavyContext.subscribe(`a${this.app.id}`, "reaction_removed", this.handleRealtimeReactionDeleted);
    }


  }

  protected override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.postsQuery.result, this.pagerRef.value);
  }

  private renderPosts(
    app: AppType,
    user: UserType,
    availableFeatures: FeaturesListType,
    features: FeaturesConfigType,
    infiniteData?: InfiniteData<PostsResultType>
  ) {
    if (infiniteData) {
      const flattenedPages = infiniteData.pages.flatMap((messageResult) => messageResult.data);

      return repeat(
        flattenedPages,
        (post) => post.id,
        (post) => {
          return [
            html`<wy-post
              id="post-${post.id}"
              .app=${app}
              .user=${user}
              .postId=${post.id}
              .temp=${post.temp || false}
              .createdBy=${post.created_by}
              .createdAt=${post.created_at}
              .modifiedAt=${post.modified_at}
              .isSubscribed=${post.is_subscribed}
              .isTrashed=${post.is_trashed}
              .html=${post.html}
              .text=${post.text}
              .plain=${post.plain}
              .attachments=${post.attachments}
              .meeting=${post.meeting}
              .pollOptions=${post.options}
              .embed=${post.embed}
              .reactions=${post.reactions}
              .commentCount=${post.comment_count || 0}
              .availableFeatures=${availableFeatures}
              .features=${features}
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
            ></wy-post>`,
          ];
        }
      );
    }
    return nothing;
  }

  override render() {
    const { data: infiniteData, isPending } = this.postsQuery.result ?? {};

    return html`
      <div class="wy-posts">
        ${this.availableFeatures && this.app && this.user
          ? html`
              <div class="wy-post">
                <wy-editor
                  editorLocation="apps"
                  .app=${this.app}
                  .user=${this.user}
                  .availableFeatures=${this.availableFeatures}
                  .features=${this.features}
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
              ${this.app && this.user && infiniteData && this.availableFeatures
                ? this.renderPosts(this.app, this.user, this.availableFeatures, this.features, infiniteData)
                : html`<wy-empty><wy-spinner class="wy-content-icon"></wy-spinner></wy-empty>`}
              <div ${ref(this.pagerRef)} class="wy-pager"></div>
            `
          : html` <wy-empty><wy-spinner overlay></wy-spinner></wy-empty> `}
      </div>
    `;
  }

  override disconnectedCallback(): void {
    if (this.weavyContext && this.app) {
      // realtime
      this.unsubscribeToRealtime(this.app);
    }
    super.disconnectedCallback();
  }
}
