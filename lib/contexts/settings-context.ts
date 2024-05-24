import { createContext } from "@lit/context";
import { AppSettingProps } from "../mixins/app-mixin";
import { LitElement } from "lit";

export class AppSettings implements AppSettingProps {
  #component: LitElement;

  /**
   * Provides a reference to the host.
   */
  get component() {
    return this.#component;
  }

  // SETTINGS
  submodals: boolean = false;

  // PROPERTY INIT
  constructor(host: LitElement) {
    this.#component = host;

    const settingKeys = Object.keys(this);

    settingKeys.forEach((appSetting) => {
      if (appSetting in host) {
        Object.assign(this, { [appSetting]: host[appSetting as keyof typeof host] });
      }
    });
  }
}

export type AppSettingsType = AppSettings;
export const appSettingsContext = createContext<AppSettings | undefined>(Symbol.for("weavy-app-settings"));
