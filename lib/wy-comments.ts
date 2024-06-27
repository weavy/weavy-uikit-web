import { LitElement, html, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { localized } from "@lit/localize";

import { AppTypes, type AppType } from "./types/app.types";

import colorModes from "./scss/colormodes";
import postsCss from "./scss/all";
import { blockStyles } from "./scss/block";
import { hostScrollYStyles } from "./scss/host";

import "./components/wy-comment-list";
import "./components/wy-empty";
import "./components/wy-spinner";

import { ThemeController } from "./controllers/theme-controller";
import { RealtimeCommentEventType, RealtimeReactionEventType } from "./types/realtime.types";
import { WeavyContextProps } from "./types/weavy.types";
import { AppProviderMixin } from "./mixins/app-mixin";
import { Constructor } from "./types/generic.types";

@customElement("wy-comments")
@localized()
export class WyComments extends AppProviderMixin(LitElement) {
  static override styles = [
    postsCss,
    blockStyles,
    hostScrollYStyles,
    colorModes,
  ];

  override appType = AppTypes.Comments;

  @property()
  cssClass?: string;

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

  constructor() {
    super();
    new ThemeController(this, WyComments.styles);
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
    super.willUpdate(changedProperties);
    
    if (changedProperties.has("app")) {
      const lastApp = changedProperties.get("app");

      if (lastApp && lastApp !== this.app) {
        this.unsubscribeToRealtime(lastApp);
      }
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
            .location=${"apps"}
          ></wy-comment-list>
        `
      : html`
          <wy-empty>
            <wy-spinner padded></wy-spinner>
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

export type WyCommentsType = Constructor<WyComments>;