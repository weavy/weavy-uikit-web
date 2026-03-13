import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";
import { ContextConsumer } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { whenParentsDefined } from "../utils/dom";
import { RealtimeOptionsType } from "../types/realtime.types";

/**
 * Lit element controller for Notification live data.
 *
 * - Requires a weavy context.
 * - May be filtered for different notification types and app id scopes.
 *
 * @fires {WyUnreadEventType} wy-unread - Emitted when the number of unread notifications change.
 */
export class RealtimeController implements ReactiveController {
  host: LitElement & ReactiveControllerHost;

  protected registrationRequested: boolean = false;

  realtimeOptions: (RealtimeOptionsType | null | undefined)[] = [];

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
   * Register realtime handlers.
   */
  async registerRealtime() {
    if (!this.registrationRequested) {
      this.registrationRequested = true;
      const weavy = await this.whenWeavyContext;

      for (const realtimeOptions of this.realtimeOptions) {
        if (realtimeOptions) {
          const  { group, event, onMessage } = realtimeOptions;
          await weavy.subscribe(group, event, onMessage);
        }
      }

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

      for (const realtimeOptions of this.realtimeOptions) {
        if (realtimeOptions) {
          const  { group, event, onMessage } = realtimeOptions;
          await this.weavy?.unsubscribe(group, event, onMessage);
        }
      }
    }
  }

  /**
   * Tracks unread data. Initiates the query data with the given filtering scope.
   *
   * @param typeFilter - The notification types to track.
   * @param appId - Optional app id for the filtering scope.
   */
  async track(realtimeOptions: (RealtimeOptionsType | null | undefined)[]) {
    await this.unregisterRealtime();
    this.realtimeOptions = realtimeOptions;
    await this.registerRealtime();
  }

  hostUpdate(): void {
    // Resolve any context promises
    if (this.weavyContext?.value) {
      this.resolveWeavyContext?.(this.weavyContext?.value);
    }
  }

  hostDisconnected() {
    if (this.weavy) {
      void this.unregisterRealtime(true);
    }
  }
}
