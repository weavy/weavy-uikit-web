/***
 * THIS IS UNUSED/DISABLED
 */

import { WeavyContextBase, WeavyContextMixins } from "./weavy";
import { Constructor } from "../types/generic.types";
import { WyNotificationToasts } from "../wy-notification-toasts";
import { WeavyContextOptionsType } from "../types/weavy.types";

export interface WeavyNotificationsProps {
  /**
   * Enable notification toasts in the browser.
   */
  notificationToasts: boolean;
}

// WeavyNotifications mixin/decorator
export const WeavyNotificationsMixin = <TBase extends Constructor<WeavyContextBase>>(Base: TBase) => {
  return class WeavyNotifications extends Base implements WeavyNotificationsProps {
    _notificationToastsComponent?: WyNotificationToasts;

    _notificationToasts: boolean = false;

    get notificationToasts() {
      return this._notificationToasts;
    }

    set notificationToasts(notificationToasts: boolean) {
      this._notificationToasts = notificationToasts;

      if (notificationToasts) {
        this._addNotificationToastsComponent();
      } else {
        this._removeNotificationToastsComponent();
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      const options: WeavyContextOptionsType = args[0];

      this.notificationToasts =
        options?.notificationToasts ?? WeavyContextBase.defaults.notificationToasts ?? this.notificationToasts;
    }

    _addNotificationToastsComponent() {
      this._notificationToastsComponent ??= new WyNotificationToasts();
      this.host.append(this._notificationToastsComponent);
    }

    _removeNotificationToastsComponent() {
      this._notificationToastsComponent?.remove();
      this._notificationToastsComponent = undefined;
    }

    override destroy(this: this & WeavyContextMixins): void {
      super.destroy();
    }
  };
};
