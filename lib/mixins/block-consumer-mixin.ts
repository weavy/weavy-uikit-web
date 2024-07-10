import { LitElement, PropertyValueMap } from "lit";
import { state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type BlockSettingsType, blockSettingsContext } from "../contexts/settings-context";
import { Constructor } from "../types/generic.types";
import type { ServerConfigurationType } from "../types/server.types";
import { serverConfigurationsContext } from "../contexts/configuration-context";
import { weavyContextDefinition, type WeavyContextType } from "../contexts/weavy-context";

import type { UserType } from "../types/users.types";
import { type AppType, appContext } from "../contexts/app-context";
import { type EntityType, linkContext } from "../contexts/link-context";
import { userContext } from "../contexts/user-context";
import { type ProductFeaturesType, productFeaturesContext } from "../contexts/features-context";
import { BlockContextProps, BlockContextProviderProps } from "./block-mixin";

export const BlockConsumerMixin = <T extends Constructor<LitElement>>(Base: T) => {
  class BlockConsumer extends Base implements BlockContextProviderProps, BlockContextProps {
    // CONTEXT PROVIDERS
    @consume({ context: appContext, subscribe: true })
    @state()
    app: AppType | undefined;

    @consume({ context: serverConfigurationsContext, subscribe: true })
    @state()
    configuration: ServerConfigurationType | undefined = {};

    @consume({ context: productFeaturesContext, subscribe: true })
    @state()
    hasFeatures: ProductFeaturesType | undefined;

    @consume({ context: linkContext, subscribe: true })
    @state()
    link: EntityType | undefined;

    @consume({ context: blockSettingsContext, subscribe: true })
    @state()
    settings: BlockSettingsType | undefined;

    @consume({ context: userContext, subscribe: true })
    @state()
    user: UserType | undefined;

    @consume({ context: weavyContextDefinition, subscribe: true })
    @state()
    weavyContext: WeavyContextType | undefined;

    // PROMISES
    // TODO: Switch to Promise.withResolvers() when allowed by typescript

    #resolveApp?: (app: AppType) => void;
    #whenApp = new Promise<AppType>((r) => {
      this.#resolveApp = r;
    });
    async whenApp() {
      return await this.#whenApp;
    }

    #resolveConfiguration?: (configuration: ServerConfigurationType) => void;
    #whenConfiguration = new Promise<ServerConfigurationType>((r) => {
      this.#resolveConfiguration = r;
    });
    async whenConfiguration() {
      return await this.#whenConfiguration;
    }

    #resolveHasFeatures?: (hasFeatures: ProductFeaturesType) => void;
    #whenHasFeatures = new Promise<ProductFeaturesType>((r) => {
      this.#resolveHasFeatures = r;
    });
    async whenHasFeatures() {
      return await this.#whenHasFeatures;
    }

    #resolveLink?: (link: EntityType) => void;
    #whenLink = new Promise<EntityType>((r) => {
      this.#resolveLink = r;
    });
    async whenLink() {
      return await this.#whenLink;
    }
    
    #resolveSettings?: (settings: BlockSettingsType) => void;
    #whenSettings = new Promise<BlockSettingsType>((r) => {
      this.#resolveSettings = r;
    });
    async whenSettings() {
      return await this.#whenSettings;
    }

    #resolveUser?: (user: UserType) => void;
    #whenUser = new Promise<UserType>((r) => {
      this.#resolveUser = r;
    });
    async whenUser() {
      return await this.#whenUser;
    }

    #resolveWeavyContext?: (weavyContext: WeavyContextType) => void;
    #whenWeavyContext = new Promise<WeavyContextType>((r) => {
      this.#resolveWeavyContext = r;
    });
    async whenWeavyContext() {
      return await this.#whenWeavyContext;
    }

    // All contexts for convenience
    @state()
    contexts: {} & BlockContextProps;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      this.contexts = {
        app: this.app,
        configuration: this.configuration,
        hasFeatures: this.hasFeatures,
        link: this.link,
        settings: this.settings,
        user: this.user,
        weavyContext: this.weavyContext,
      };
    }

    protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
      super.willUpdate(changedProperties);

      for (const context in this.contexts) {
        if (changedProperties.has(context as keyof this)) {
          const value = this[context as keyof this];
          this.contexts = { ...this.contexts, [context]: value };
        }
      }

      if (changedProperties.has("app") && this.app) {
        this.#resolveApp?.(this.app);
      }

      if (changedProperties.has("configuration") && this.configuration) {
        this.#resolveConfiguration?.(this.configuration);
      }

      if (changedProperties.has("hasFeatures") && this.hasFeatures) {
        this.#resolveHasFeatures?.(this.hasFeatures);
      }

      if (changedProperties.has("link") && this.link) {
        this.#resolveLink?.(this.link);
      }

      if (changedProperties.has("settings") && this.settings) {
        this.#resolveSettings?.(this.settings);
      }

      if (changedProperties.has("user") && this.user) {
        this.#resolveUser?.(this.user);
      }

      if (changedProperties.has("weavyContext") && this.weavyContext) {
        this.#resolveWeavyContext?.(this.weavyContext);
      }
    }
  }

  // Cast return type to your mixin's interface intersected with the Base type
  return BlockConsumer as Constructor<BlockContextProviderProps & BlockContextProps> & T;
};
