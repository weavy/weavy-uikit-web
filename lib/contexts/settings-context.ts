import { createContext } from "@lit/context";
import { WeavyClient } from "../client/weavy";
import { WeavyComponentSettingProps } from "../types/component.types";

export class WeavyComponentSettings implements WeavyComponentSettingProps {
  
  #component: WeavyComponentSettingProps;

  /**
   * Provides a reference to the host.
   */
  get component() {
    return this.#component;
  }

  // SETTINGS
  enterToSend = WeavyClient.defaults.enterToSend;
  reactions = WeavyClient.defaults.reactions;
  annotations = WeavyClient.defaults.annotations;

  // PROPERTY INIT
  constructor(host: WeavyComponentSettingProps) {
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
