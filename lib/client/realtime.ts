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
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      super(...args);
    }

    _notificationEvents: boolean = WeavyClient.defaults.notificationEvents ?? false;

    get notificationEvents(): boolean {
      return this._notificationEvents;
    }
    set notificationEvents(enable: boolean | null | undefined) {
      this.realtimeUnsubscribe();
      this._notificationEvents = enable ?? false;
      void this.realtimeSubscribe();
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

    realtimeSubscribe() {
      const weavy = this as this & WeavyType;

      // Notifications
      if (this.notificationEvents) {
        void weavy.subscribe(null, "notification_created", this.dispatchRealtimeEvent);
        void weavy.subscribe(null, "notification_updated", this.dispatchRealtimeEvent);
        //void weavy.subscribe(null, "notification_deleted", this.dispatchRealtimeEvent);
        void weavy.subscribe(null, "notifications_marked", this.dispatchRealtimeEvent);
      }
    }

    realtimeUnsubscribe() {
      const weavy = this as this & WeavyType;

      if (this.notificationEvents) {
        void weavy.unsubscribe(null, "notification_created", this.dispatchRealtimeEvent);
        void weavy.unsubscribe(null, "notification_updated", this.dispatchRealtimeEvent);
        //void weavy.unsubscribe(null, "notification_deleted", this.dispatchRealtimeEvent);
        void weavy.unsubscribe(null, "notifications_marked", this.dispatchRealtimeEvent);
      }
    }

    override destroy(this: this & WeavyType): void {
      this.realtimeUnsubscribe();
      super.destroy();
    }
  };
};
