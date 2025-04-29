import { WeavyClient, WeavyType } from "./weavy";
import { Constructor } from "../types/generic.types";
import { WeavyComponentSettingProps } from "../classes/weavy-component";

export interface WeavySettingsProps extends WeavyComponentSettingProps {}

// WeavyStyles mixin/decorator
export const WeavySettingsMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavySettings extends Base implements WeavySettingsProps {
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      super(...args);
    }

    // notifications
    _notifications?: WeavySettingsProps["notifications"];

    set notifications(notifications) {
      this._notifications = notifications;
      (this as this & WeavyType).updateContext();
    }

    get notifications() {
      return this._notifications ?? WeavyClient.defaults.notifications;
    }

    // notificationsBadge
    _notificationsBadge?: WeavySettingsProps["notificationsBadge"];

    set notificationsBadge(notificationsBadge) {
      this._notificationsBadge = notificationsBadge;
      (this as this & WeavyType).updateContext();
    }

    get notificationsBadge() {
      return this._notificationsBadge ?? WeavyClient.defaults.notificationsBadge;
    }

    // reactions
    _reactions?: WeavySettingsProps["reactions"];

    set reactions(reactions) {
      this._reactions = reactions;
      (this as this & WeavyType).updateContext();
    }

    get reactions() {
      return this._reactions ?? WeavyClient.defaults.reactions;
    }
  };
};
