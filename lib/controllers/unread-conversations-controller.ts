import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";
import { QueryController } from "./query-controller";
import { NamedEvent } from "../types/generic.types";
import { ContextConsumer } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { whenParentsDefined } from "../utils/dom";
import { QueryObserverResult } from "@tanstack/query-core";
import { AppsResultType, AppTypeGuid } from "../types/app.types";
import { getAppsUnreadOptions } from "../data/app";
import { WyUnreadEventType } from "../types/ui.events";

export interface UnreadConversationsProps {
  /**
   * Number of unread conversations.
   */
  readonly unread: number;
}

export interface ConversationFilterProps {
  /**
   * App types for unread scoping.
   */
  componentTypes: AppTypeGuid[];

  /**
   * Optional agent uid for the scope.
   */
  agent?: string;
}

/**
 * Lit element controller for Conversation live data.
 *
 * - Requires a weavy context.
 * - May be filtered for different app types and agent ids.
 *
 * @fires {WyUnreadEventType} wy-unread - Emitted when the number of unread apps change.
 */
export class UnreadConversationsController implements ReactiveController {
  host: LitElement & ReactiveControllerHost;

  /**
   * Agent id for unread scoping.
   */
  agent?: string;

  /**
   * App types for the scope.
   */
  appTypes: AppTypeGuid[] = [];
  
  #unread: number = 0;

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
    return this.unreadQuery.result.isPending;
  }

  /**
   * The underlying query result for the unread count.
   */
  get unreadResult(): QueryObserverResult<AppsResultType> {
    return this.unreadQuery.result;
  }

  protected unreadQuery: QueryController<AppsResultType>;
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
    this.unreadQuery = new QueryController<AppsResultType>(host);
    this.whenWeavyContext = new Promise((r) => (this.resolveWeavyContext = r));
    void this.setContexts();
    void this.registerRealtime();
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
  private handleRefresh = () => {
    void this.unreadQuery.result.refetch();
  };

  /**
   * Register realtime handlers.
   */
  async registerRealtime() {
    if (!this.registrationRequested) {
      this.registrationRequested = true;
      await this.whenWeavyContext;

      void this.weavy?.subscribe(null, "message_created", this.handleRefresh);
      void this.weavy?.subscribe(null, "app_marked", this.handleRefresh);

      this.registrationRequested = false;
    }
  }

  /**
   * Unregister realtime handlers.
   *
   * @param skipAwait - Skip waiting for any context.
   */
  async unregisterRealtime(skipAwait: boolean = false) {
    if (!this.registrationRequested) {
      !skipAwait && (await this.whenWeavyContext);

      void this.weavy?.unsubscribe(null, "message_created", this.handleRefresh);
      void this.weavy?.unsubscribe(null, "app_marked", this.handleRefresh);
    }
  }

  async track(appTypes: AppTypeGuid[], agent?: string) {
    this.appTypes = appTypes;
    this.agent = agent;
    const weavy = await this.whenWeavyContext;
    await this.unreadQuery.trackQuery(getAppsUnreadOptions(weavy, appTypes, this.agent), true);
  }

  hostUpdate(): void {
    // Resolve any context promises
    if (this.weavyContext?.value) {
      this.resolveWeavyContext?.(this.weavyContext?.value);
    }

    const unreadCount = this.unreadQuery.result?.data?.count ?? 0;

    // Propagate and changes in the unread count.
    if (unreadCount !== this.unread) {
      this.#unread = unreadCount;
      this.dispatchUnreadEvent();
      this.host.requestUpdate();
    }
  }

  hostDisconnected() {
    if (this.weavy) {
      void this.unregisterRealtime(true);
    }
  }
}
