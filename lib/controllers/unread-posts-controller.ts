import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";
import { QueryController } from "./query-controller";
import { NamedEvent } from "../types/generic.types";
import { ContextConsumer } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { whenParentsDefined } from "../utils/dom";
import { QueryObserverResult } from "@tanstack/query-core";
import { WyUnreadEventType } from "../types/ui.events";
import { PostQueryFilterType, PostsResultType } from "../types/posts.types";
import { getPostsCountOptions } from "../data/posts";
import { AppType } from "../types/app.types";
import { RealtimeController } from "./realtime-controller";
import { RealtimeOptionsType, RealtimePostEventType } from "../types/realtime.types";

export interface UnreadConversationsProps {
  /**
   * Number of unread conversations.
   */
  readonly unread: number;
}

/**
 * Lit element controller for Conversation live data.
 *
 * - Requires a weavy context.
 * - May be filtered for different app types and agent ids.
 *
 * @fires {WyUnreadEventType} wy-unread - Emitted when the number of unread apps change.
 */
export class UnreadPostsController implements ReactiveController {
  host: LitElement & ReactiveControllerHost;

  #lastCount?: number;
  #unread: number = 0;
  #updater?: number;

  /**
   * Which posts to show.
   */
  filter: PostQueryFilterType = {
    q: "",
    tag: "",
    trashed: false,
    following: false,
    order_by: "id desc",
  };

  appId?: number | "feed";
  updateInterval: number = 10000;

  /**
   * The number of unread items for the current scope
   */
  get unread(): number {
    return this.#unread;
  }

  /**
   * Is the unread count pending?
   */
  get isUnreadPending(): boolean {
    return this.currentQuery.result.isPending;
  }

  /**
   * The underlying query result for the unread count.
   */
  get unreadResult(): QueryObserverResult<PostsResultType> {
    return this.currentQuery.result;
  }

  protected currentQuery: QueryController<PostsResultType>;
  //protected activeQuery: QueryController<PostsResultType>;

  protected postsRealtime: RealtimeController;

  protected registrationRequested: boolean = false;

  // Weavy context
  protected weavyContext?: ContextConsumer<{ __context__: WeavyType }, LitElement>;
  protected whenWeavyContext: Promise<WeavyType>;
  protected resolveWeavyContext?: (value: WeavyType | PromiseLike<WeavyType>) => void;

  protected get weavy() {
    return this.weavyContext?.value;
  }

  constructor(host: LitElement) {
    host.addController(this);
    this.host = host;
    this.currentQuery = new QueryController<PostsResultType>(host);
    this.postsRealtime = new RealtimeController(host);
    this.whenWeavyContext = new Promise((r) => (this.resolveWeavyContext = r));
    void this.setContexts();
  }

  /**
   * Initiates context consumers
   */
  async setContexts() {
    await whenParentsDefined(this.host as LitElement);
    this.weavyContext = new ContextConsumer(this.host as LitElement, { context: WeavyContext, subscribe: true });
  }

  /**
   * Dispatch a `wy-unread` event on the host.
   *
   * @fires {WyUnreadEventType} wy-unread - Emitted when the number of unread items change.
   */
  dispatchUnreadEvent() {
    const event: WyUnreadEventType = new (CustomEvent as NamedEvent)("wy-unread", {
      detail: { unread: this.unread },
      bubbles: false,
      composed: true,
    });
    this.host.dispatchEvent(event);
  }

  /**
   * Request an update of the underlying query data.
   */
  refresh = () => {
    if (!this.currentQuery.result.isPending) {
      void this.currentQuery.result.refetch();
    }
  };

  async track(app: AppType | "feed", afterId: number | undefined, filter: PostQueryFilterType) {
    this.filter = filter;
    const weavy = await this.whenWeavyContext;
    const staleTime = 7 * 24 * 60 * 60 * 1000;
    this.#lastCount = undefined;
    await this.currentQuery.trackQuery(getPostsCountOptions(weavy, app, afterId, this.filter, { staleTime }), false);
    if (app !== "feed") {
      await this.postsRealtime.track([
        <RealtimeOptionsType>{
          group: `a${app.id}`,
          event: "post_created",
          onMessage: (realtimeEvent: RealtimePostEventType) => {
            if (!realtimeEvent.post.app || realtimeEvent.post.app.id !== app.id) {
              return;
            }

            this.refresh();
          },
        },
      ]);
    }
  }

  hostConnected(): void {
    this.#updater && window.clearInterval(this.#updater);
    this.#updater = window.setInterval(this.refresh, this.updateInterval);
  }

  hostDisconnected(): void {
    this.#updater && window.clearInterval(this.#updater);
  }

  hostUpdate(): void {
    // Resolve any context promises
    if (this.weavyContext?.value) {
      this.resolveWeavyContext?.(this.weavyContext?.value);
    }

    let unreadCount = 0;

    if (this.currentQuery.result.isPending || this.currentQuery.result.isStale) {
      //console.log("resetting unread");
      this.#lastCount = undefined;
    } else {
      const currentCount = this.currentQuery.result.data?.count ?? 0;
      this.#lastCount ??= currentCount;
      unreadCount = currentCount - this.#lastCount;
    }

    // Propagate and changes in the unread count.
    if (unreadCount !== this.unread) {
      if (unreadCount) {
        //console.log("New posts available", unreadCount);
      }
      this.#unread = unreadCount;
      this.dispatchUnreadEvent();
      this.host.requestUpdate();
    }
  }
}
