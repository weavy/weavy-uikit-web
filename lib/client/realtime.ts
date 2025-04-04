import { WeavyClient, type WeavyType } from "./weavy";
import { Constructor, NamedEvent } from "../types/generic.types";
import {
  RealtimeEventType,
  RealtimeNotificationEventType,
  RealtimeNotificationsEventDetailType,
  RealtimeNotificationsEventType,
} from "../types/realtime.types";
import { WyNotificationsEventType } from "../types/notifications.events";
import { throwOnDomNotAvailable } from "../utils/dom";

export interface WeavyRealtimeProps {
  /**
   * Enable the realtime `wy-notifications` event.
   */
  notificationEvents: boolean;
}

export type {
  WyNotificationsEventType,
  RealtimeNotificationsEventDetailType,
  RealtimeNotificationEventType,
  RealtimeNotificationsEventType,
};

// WeavyRealtime mixin/decorator
export const WeavyRealtimeMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavyRealtime extends Base implements WeavyRealtimeProps {
    _notificationEvents: boolean = WeavyClient.defaults.notificationEvents ?? false;

    get notificationEvents(): boolean {
      return this._notificationEvents;
    }
    set notificationEvents(enable: boolean | null | undefined) {
      this.realtimeUnsubscribe();
      this._notificationEvents = enable ?? false;
      this.realtimeSubscribe();
    }

    dispatchRealtimeEvent = (realtimeEvent: RealtimeEventType) => {
      throwOnDomNotAvailable();

      const eventOptions: EventInit = this.host !== document.documentElement ? { composed: true } : { bubbles: true };

      switch (realtimeEvent.action) {
        case "notification_created":
        case "notification_updated":
        case "notification_deleted":
        case "notifications_marked": {
          const event: WyNotificationsEventType = new (CustomEvent as NamedEvent)("wy-notifications", {
            ...eventOptions,
            detail: realtimeEvent as RealtimeNotificationsEventDetailType,
          });
          this.host.dispatchEvent(event);
        }
      }
    };

    async realtimeSubscribe() {
      const weavy = this as this & WeavyType;

      // Notifications
      if (this.notificationEvents) {
        weavy.subscribe(null, "notification_created", this.dispatchRealtimeEvent);
        weavy.subscribe(null, "notification_updated", this.dispatchRealtimeEvent);
        //weavy.subscribe(null, "notification_deleted", this.dispatchRealtimeEvent);
        weavy.subscribe(null, "notifications_marked", this.dispatchRealtimeEvent);
      }
    }

    realtimeUnsubscribe() {
      const weavy = this as this & WeavyType;

      if (this.notificationEvents) {
        weavy.unsubscribe(null, "notification_created", this.dispatchRealtimeEvent);
        weavy.unsubscribe(null, "notification_updated", this.dispatchRealtimeEvent);
        //weavy.unsubscribe(null, "notification_deleted", this.dispatchRealtimeEvent);
        weavy.unsubscribe(null, "notifications_marked", this.dispatchRealtimeEvent);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);
    }

    override destroy(this: this & WeavyType): void {
      this.realtimeUnsubscribe();
      super.destroy();
    }
  };
};
