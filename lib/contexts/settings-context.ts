import { createContext } from "@lit/context";
import { BlockSettingProps } from "../mixins/block-mixin";
import { LitElement } from "lit";
import { NotificationsAppearanceType, NotificationsBadgeType } from "../types/notifications.types";

export type { NotificationsAppearanceType, NotificationsBadgeType } from "../types/notifications.types";

export class BlockSettings implements BlockSettingProps {
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

    settingKeys.forEach((blockSetting) => {
      if (blockSetting in host) {
        Object.assign(this, { [blockSetting]: host[blockSetting as keyof typeof host] });
      }
    });
  }
}

export type BlockSettingsType = BlockSettings;
export const BlockSettingsContext = createContext<BlockSettings | undefined>(Symbol.for("weavy-block-settings"));
