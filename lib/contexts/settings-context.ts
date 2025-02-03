import { createContext } from "@lit/context";
import { WeavyComponentSettingProps } from "../classes/weavy-component";
import { LitElement } from "lit";
import { NotificationsAppearanceType, NotificationsBadgeType } from "../types/notifications.types";

export type { NotificationsAppearanceType, NotificationsBadgeType } from "../types/notifications.types";

export class WeavyComponentSettings implements WeavyComponentSettingProps {
  #component: LitElement;

  /**
   * Provides a reference to the host.
   */
  get component() {
    return this.#component;
  }

  // SETTINGS
  notifications: NotificationsAppearanceType = "button-list";
  notificationsBadge: NotificationsBadgeType = "count";
  //notificationsToasts: NotificationsToastsType = "browser";

  // PROPERTY INIT
  constructor(host: LitElement) {
    this.#component = host;

    const settingKeys = Object.keys(this);

    settingKeys.forEach((weavyComponentSetting) => {
      if (weavyComponentSetting in host) {
        Object.assign(this, { [weavyComponentSetting]: host[weavyComponentSetting as keyof typeof host] });
      }
    });
  }
}

export type WeavyComponentSettingsType = WeavyComponentSettings;
export const WeavyComponentSettingsContext = createContext<WeavyComponentSettings | undefined>(Symbol.for("weavy-component-settings"));
