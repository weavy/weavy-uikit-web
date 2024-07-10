import { WeavyContextBase, WeavyContextMixins } from "./weavy";
import { Constructor } from "../types/generic.types";
import { RealtimeEventType } from "../types/realtime.types";
import { WyNotificationsEventType } from "../types/notifications.types";

export interface WeavyRealtimeProps {
  /**
   * Enable the realtime `wy:notifications` event.
   */
  notificationEvents: boolean;
}

// WeavyRealtime mixin/decorator
export const WeavyRealtimeMixin = <TBase extends Constructor<WeavyContextBase>>(Base: TBase) => {
  return class WeavyRealtime extends Base implements WeavyRealtimeProps {
    _notificationEvents: boolean = WeavyContextBase.defaults.notificationEvents ?? false;

    get notificationEvents() {
      return this._notificationEvents;
    }
    set notificationEvents(enable: boolean) {
      this.realtimeUnsubscribe();
      this._notificationEvents = enable;
      this.realtimeSubscribe();
    }

    dispatchRealtimeEvent = (realtimeEvent: RealtimeEventType) => {
      const eventOptions: EventInit = this.host !== document.documentElement ? { composed: true } : { bubbles: true };

      switch (realtimeEvent.action) {
        case "notification_created":
        case "notification_updated":
        case "notification_deleted":
        case "notifications_marked": {
          const event = new CustomEvent("wy:notifications", { ...eventOptions, detail: realtimeEvent })
          this.host.dispatchEvent(event as WyNotificationsEventType);
        }
          
      }
    };

    realtimeSubscribe() {
      const weavyContext = this as this & WeavyContextMixins;

      // Notifications
      if (this.notificationEvents) {
        weavyContext.subscribe(null, "notification_created", this.dispatchRealtimeEvent);
        weavyContext.subscribe(null, "notification_updated", this.dispatchRealtimeEvent);
        //weavyContext.subscribe(null, "notification_deleted", this.dispatchRealtimeEvent);
        weavyContext.subscribe(null, "notifications_marked", this.dispatchRealtimeEvent);
      }
    }

    realtimeUnsubscribe() {
      const weavyContext = this as this & WeavyContextMixins;

      if (this.notificationEvents) {
        weavyContext.unsubscribe(null, "notification_created", this.dispatchRealtimeEvent);
        weavyContext.unsubscribe(null, "notification_updated", this.dispatchRealtimeEvent);
        //weavyContext.unsubscribe(null, "notification_deleted", this.dispatchRealtimeEvent);
        weavyContext.unsubscribe(null, "notifications_marked", this.dispatchRealtimeEvent);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);
    }

    override destroy(this: this & WeavyContextMixins): void {
      this.realtimeUnsubscribe();
      super.destroy();
    }
  };
};
