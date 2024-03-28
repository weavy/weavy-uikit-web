import { LitElement, html, type PropertyValues, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ContextConsumer } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "./client/context-definition";
import { localized } from "@lit/localize";

import { AppTypes, type AppType } from "./types/app.types";
import type { UserType } from "./types/users.types";
import type { FeaturesConfigType, FeaturesListType } from "./types/features.types";

import { getApiOptions } from "./data/api";

import colorModes from "./scss/colormodes";
import postsCss from "./scss/all";

import "./components/wy-comment-list";
import "./components/wy-empty";
import "./components/wy-spinner";

import { ThemeController } from "./controllers/theme-controller";
import { RealtimeCommentEventType, RealtimeReactionEventType } from "./types/realtime.types";
import { QueryController } from "./controllers/query-controller";
import { whenParentsDefined } from "./utils/dom";
import { WeavyContextProps } from "./types/weavy.types";
import { getAppOptions } from "./data/app";

@customElement("wy-comments")
@localized()
export class WyComments extends LitElement {
  static override styles = [
    colorModes,
    postsCss,
    css`
      :host {
        position: relative;
      }
    `,
  ];

  protected weavyContextConsumer?: ContextConsumer<{ __context__: WeavyContextType }, this>;

  // Manually consumed in scheduleUpdate()
  @state()
  protected weavyContext?: WeavyContextType;

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
   * Event: New comment created.
   * @event wy:comment_created
   */
  realtimeCommentCreatedEvent = (realtimeEvent: RealtimeCommentEventType) =>
    new CustomEvent("wy:comment_created", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: Comment reaction added.
   * @event wy:reaction_added
   */
  realtimeReactionAddedEvent = (realtimeEvent: RealtimeReactionEventType) =>
    new CustomEvent("wy:reaction_added", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: Comment reaction removed.
   * @event wy:reaction_removed
   */
  realtimeReactionRemovedEvent = (realtimeEvent: RealtimeReactionEventType) =>
    new CustomEvent("wy:reaction_removed", { bubbles: true, composed: false, detail: realtimeEvent });

  @state()
  protected app?: AppType;

  protected appQuery = new QueryController<AppType>(this);
  protected userQuery = new QueryController<UserType>(this);
  protected featuresQuery = new QueryController<FeaturesListType>(this);

  constructor() {
    super();
    new ThemeController(this, WyComments.styles);
  }

  override async scheduleUpdate() {
    await whenParentsDefined(this);
    this.weavyContextConsumer = new ContextConsumer(this, { context: weavyContextDefinition, subscribe: true });

    if (this.weavyContextConsumer?.value && this.weavyContext !== this.weavyContextConsumer?.value) {
      this.weavyContext = this.weavyContextConsumer?.value;
    }

    await super.scheduleUpdate();
  }

  handleRealtimeCommentCreated = (realtimeEvent: RealtimeCommentEventType) => {
    if (!this.weavyContext || realtimeEvent.actor.id === this.user!.id) {
      return;
    }

    /*updateCacheItem(
      this.weavyContext.queryClient,
      ["posts", this.app!.id],
      realtimeEvent.comment.parent!.id,
      (item: PostType) => {
        item.comment_count = (item.comment_count || 0) + 1;
      }
    );*/

    this.dispatchEvent(this.realtimeCommentCreatedEvent(realtimeEvent));
  };

  handleRealtimeReactionAdded = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavyContext || realtimeEvent.actor.id === this.user!.id || realtimeEvent.entity.type !== "comment") {
      return;
    }

    /*updateCacheItem(
      this.weavyContext.queryClient,
      ["posts", this.app!.id],
      realtimeEvent.entity.id,
      (item: PostType) => {
        item.reactions = [
          ...(item.reactions || []),
          { content: realtimeEvent.reaction, created_by_id: realtimeEvent.actor.id },
        ];
      }
    );*/

    this.dispatchEvent(this.realtimeReactionAddedEvent(realtimeEvent));
  };

  handleRealtimeReactionDeleted = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavyContext || realtimeEvent.actor.id === this.user!.id || realtimeEvent.entity.type !== "comment") {
      return;
    }

    /*updateCacheItem(
      this.weavyContext.queryClient,
      ["posts", this.app!.id],
      realtimeEvent.entity.id,
      (item: PostType) => {
        item.reactions = item.reactions.filter((item) => item.created_by_id !== realtimeEvent.actor.id);
      }
    );*/

    this.dispatchEvent(this.realtimeReactionRemovedEvent(realtimeEvent));
  };

  private unsubscribeToRealtime(app: AppType) {
    if (!this.weavyContext) {
      return;
    }
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
      this.appQuery.trackQuery(getAppOptions(this.weavyContext, this.uid, AppTypes.Comments));
      this.userQuery.trackQuery(getApiOptions<UserType>(this.weavyContext, ["user"]));
      this.featuresQuery.trackQuery(getApiOptions<FeaturesListType>(this.weavyContext, ["features", "comments"]));
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

    if (
      (changedProperties.has("weavyContext") || changedProperties.has("app") || changedProperties.has("user")) &&
      this.weavyContext &&
      this.app &&
      this.user
    ) {
      // realtime
      this.weavyContext.subscribe(`a${this.app.id}`, "comment_created", this.handleRealtimeCommentCreated);
      this.weavyContext.subscribe(`a${this.app.id}`, "reaction_added", this.handleRealtimeReactionAdded);
      this.weavyContext.subscribe(`a${this.app.id}`, "reaction_removed", this.handleRealtimeReactionDeleted);
    }
  }

  override render() {
    return this.app && this.user
      ? html`
          <wy-comment-list
            parentId=${this.app?.id}
            .app=${this.app}
            .user=${this.user}
            .features=${this.features}
            .availableFeatures=${this.availableFeatures}
            .location=${"apps"}
          ></wy-comment-list>
        `
      : html`
          <wy-empty>
            <wy-spinner></wy-spinner>
          </wy-empty>
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
