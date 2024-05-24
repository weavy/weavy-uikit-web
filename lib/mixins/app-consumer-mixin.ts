import { LitElement, PropertyValueMap } from "lit";
import { state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type AppSettingsType, appSettingsContext } from "../contexts/settings-context";
import { Constructor } from "../types/generic.types";
import type { ServerConfigurationType } from "../types/server.types";
import { serverConfigurationsContext } from "../contexts/configuration-context";
import { weavyContextDefinition, type WeavyContextType } from "../contexts/weavy-context";

import type { UserType } from "../types/users.types";
import { type AppType, appContext } from "../contexts/app-context";
import { userContext } from "../contexts/user-context";
import { type FeaturesType, featuresContext } from "../contexts/features-context";
import { AppContextProps } from "./app-mixin";
import { AppContextProviderProps } from "./app-provider-mixin";

export const AppConsumerMixin = <T extends Constructor<LitElement>>(Base: T) => {
  class AppConsumer extends Base implements AppContextProviderProps, AppContextProps {
    @consume({ context: weavyContextDefinition, subscribe: true })
    @state()
    weavyContext: WeavyContextType | undefined;

    // CONTEXT PROVIDERS
    @consume({ context: appSettingsContext, subscribe: true })
    @state()
    settings: AppSettingsType | undefined;

    @consume({ context: serverConfigurationsContext, subscribe: true })
    @state()
    configuration: ServerConfigurationType | undefined = {};

    @consume({ context: appContext, subscribe: true })
    @state()
    app: AppType | undefined;

    @consume({ context: userContext, subscribe: true })
    @state()
    user: UserType | undefined;

    @consume({ context: featuresContext, subscribe: true })
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

    // All contexts for convenience
    @state()
    contexts: {} & AppContextProps;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      this.contexts = {
        weavyContext: this.weavyContext,
        settings: this.settings,
        configuration: this.configuration,
        app: this.app,
        user: this.user,
        hasFeatures: this.hasFeatures,
      };
    }

    protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
      super.willUpdate(changedProperties);

      for (const context in this.contexts) {
        if (changedProperties.has(context as keyof this)) {
          const value = this[context as keyof this];
          this.contexts = { ...this.contexts, [context]: value }
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
  return AppConsumer as Constructor<AppContextProviderProps & AppContextProps> & T;
};
