import { LitElement, PropertyValueMap } from "lit";
import { property, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import { AppSettings, appSettingsContext } from "../contexts/settings-context";
import { Constructor } from "../types/generic.types";

// Define the interface for the mixin
export interface AppSettingProps {
  /**
   * Whether to use local modals attached in place rather than globally attached modals.
   * May require adjustments to layout and z-index on the page.
   */
  submodals: boolean;
}

export interface AppSettingsProviderProps {
  /**
   * The settings provided as a context on the component.
   */
  settings: AppSettings;
}

export const AppSettingsProviderMixin = <T extends Constructor<LitElement>>(Base: T) => {
  class AppSettingsProvider extends Base implements AppSettingsProviderProps, AppSettingProps {
    // CONTEXT
    @provide({ context: appSettingsContext })
    @state()
    settings: AppSettings;

    // SETTINGS
    @property({ type: Boolean })
    submodals = false;

    // PROPERTY INIT
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      this.settings = new AppSettings(this);
    }

    protected override willUpdate(changedProperties: PropertyValueMap<this>) {
      super.willUpdate(changedProperties);

      const settingKeys = Object.keys(this.settings);
      if (settingKeys.find((setting) => changedProperties.has(setting as keyof this))) {
        this.settings = new AppSettings(this);
      }
    }
  }

  // Cast return type to your mixin's interface intersected with the Base type
  return AppSettingsProvider as Constructor<AppSettingsProviderProps & AppSettingProps> & T;
};
