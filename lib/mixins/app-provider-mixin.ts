import { LitElement, PropertyValueMap } from "lit";
import { property, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import { type AppSettingsType, appSettingsContext } from "../contexts/settings-context";
import { Constructor, ValueOf } from "../types/generic.types";
import type { ServerConfigurationType } from "../types/server.types";
import { serverConfigurationsContext } from "../contexts/configuration-context";
import { weavyContextDefinition, type WeavyContextType } from "../contexts/weavy-context";

import type { UserType } from "../types/users.types";
import { type AppType, appContext } from "../contexts/app-context";
import { userContext } from "../contexts/user-context";
import { type FeaturesType, featuresContext } from "../contexts/features-context";
import { AppContextProps } from "./app-mixin";

export interface AppContextProviderProps {
  /**
   * All app contexts provided in a combined object. Used for convenience when forwarding contexts.
   */
  contexts?: {} & AppContextProps;

  whenWeavyContext: () => Promise<WeavyContextType>;
  whenSettings: () => Promise<AppSettingsType>;
  whenConfiguration: () => Promise<ServerConfigurationType>;
  whenApp: () => Promise<AppType>;
  whenUser: () => Promise<UserType>;
  whenHasFeatures: () => Promise<FeaturesType>;
}

export const AppContextProviderMixin = <T extends Constructor<LitElement>>(Base: T) => {
  class AppContextProvider extends Base implements AppContextProviderProps, AppContextProps {
    @provide({ context: weavyContextDefinition })
    @state()
    weavyContext: WeavyContextType | undefined;

    // CONTEXT PROVIDERS
    @provide({ context: appSettingsContext })
    @state()
    settings: AppSettingsType | undefined;

    @provide({ context: serverConfigurationsContext })
    @state()
    configuration: ServerConfigurationType | undefined = {};

    @provide({ context: appContext })
    @state()
    app: AppType | undefined;

    @provide({ context: userContext })
    @state()
    user: UserType | undefined;

    @provide({ context: featuresContext })
    @state()
    hasFeatures: FeaturesType | undefined;

        // PROMISES

    // TODO: Switch to Promise.withResolvers() when allowed by typescript

    #resolveWeavyContext?: (weavyContext: WeavyContextType) => void;
    #whenWeavyContext = new Promise<WeavyContextType>((r) => {
      this.#resolveWeavyContext = r;
    });

    async whenWeavyContext() {
      return await this.#whenWeavyContext;
    }

    #resolveSettings?: (settings: AppSettingsType) => void;
    #whenSettings = new Promise<AppSettingsType>((r) => {
      this.#resolveSettings = r;
    });

    async whenSettings() {
      return await this.#whenSettings;
    }

    #resolveConfiguration?: (configuration: ServerConfigurationType) => void;
    #whenConfiguration = new Promise<ServerConfigurationType>((r) => {
      this.#resolveConfiguration = r;
    });

    async whenConfiguration() {
      return await this.#whenConfiguration;
    }

    #resolveApp?: (app: AppType) => void;
    #whenApp = new Promise<AppType>((r) => {
      this.#resolveApp = r;
    });

    async whenApp() {
      return await this.#whenApp;
    }

    #resolveUser?: (user: UserType) => void;
    #whenUser = new Promise<UserType>((r) => {
      this.#resolveUser = r;
    });

    async whenUser() {
      return await this.#whenUser;
    }

    #resolveHasFeatures?: (hasFeatures: FeaturesType) => void;
    #whenHasFeatures = new Promise<FeaturesType>((r) => {
      this.#resolveHasFeatures = r;
    });

    async whenHasFeatures() {
      return await this.#whenHasFeatures;
    }

    // All contexts provided combined for convenience
    @property({ attribute: false })
    contexts?: {} & AppContextProps;

    protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
      super.willUpdate(changedProperties);

      if (changedProperties.has("contexts") && this.contexts) {
        for (const context in this.contexts) {
          this[context as keyof this] = this.contexts[context as keyof AppContextProps] as ValueOf<
            {} | AppContextProps
          >;
        }
      }

      if (changedProperties.has("weavyContext") && this.weavyContext) {
        this.#resolveWeavyContext?.(this.weavyContext);
      }

      if (changedProperties.has("settings") && this.settings) {
        this.#resolveSettings?.(this.settings);
      }

      if (changedProperties.has("configuration") && this.configuration) {
        this.#resolveConfiguration?.(this.configuration);
      }

      if (changedProperties.has("app") && this.app) {
        this.#resolveApp?.(this.app);
      }

      if (changedProperties.has("user") && this.user) {
        this.#resolveUser?.(this.user);
      }

      if (changedProperties.has("hasFeatures") && this.hasFeatures) {
        this.#resolveHasFeatures?.(this.hasFeatures);
      }
    }
  }

  // Cast return type to your mixin's interface intersected with the Base type
  return AppContextProvider as Constructor<AppContextProviderProps & AppContextProps> & T;
};
