import { LitElement, PropertyValueMap } from "lit";
import { state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyComponentSettingsType, WeavyComponentSettingsContext } from "../contexts/settings-context";
import { Constructor } from "../types/generic.types";
import { WeavyContext, type WeavyType } from "../contexts/weavy-context";

import type { BotType, UserType } from "../types/users.types";
import { type AppType, AppContext } from "../contexts/app-context";
import { type EntityType, LinkContext } from "../contexts/link-context";
import { UserContext } from "../contexts/user-context";
import { type ProductFeaturesType, ProductFeaturesContext } from "../contexts/features-context";
import { WeavyComponentContextProps } from "./weavy-component";
import { BotContext } from "../contexts/bot-context";

export const WeavyComponentConsumerMixin = <T extends Constructor<LitElement>>(Base: T) => {
  class WeavyComponentConsumer extends Base implements WeavyComponentContextProps {
    // CONTEXT PROVIDERS
    @consume({ context: AppContext, subscribe: true })
    @state()
    app: AppType | undefined;

    @consume({ context: BotContext, subscribe: true })
    @state()
    botUser: BotType | undefined;

    @consume({ context: ProductFeaturesContext, subscribe: true })
    @state()
    hasFeatures: ProductFeaturesType | undefined;

    @consume({ context: LinkContext, subscribe: true })
    @state()
    link: EntityType | undefined;

    @consume({ context: WeavyComponentSettingsContext, subscribe: true })
    @state()
    settings: WeavyComponentSettingsType | undefined;

    @consume({ context: UserContext, subscribe: true })
    @state()
    user: UserType | undefined;

    @consume({ context: WeavyContext, subscribe: true })
    @state()
    weavy: WeavyType | undefined;

    // PROMISES
    // TODO: Switch to Promise.withResolvers() when allowed by typescript

    #resolveApp?: (app: AppType) => void;
    #whenApp = new Promise<AppType>((r) => {
      this.#resolveApp = r;
    });
    async whenApp() {
      return await this.#whenApp;
    }

    #resolveBotUser?: (botUser: BotType) => void;
    #whenBotUser = new Promise<BotType>((r) => {
      this.#resolveBotUser = r;
    });
    async whenBotUser() {
      return await this.#whenBotUser;
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

    #resolveSettings?: (settings: WeavyComponentSettingsType) => void;
    #whenSettings = new Promise<WeavyComponentSettingsType>((r) => {
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

    #resolveWeavy?: (weavy: WeavyType) => void;
    #whenWeavy = new Promise<WeavyType>((r) => {
      this.#resolveWeavy = r;
    });
    async whenWeavy() {
      return await this.#whenWeavy;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);
    }

    protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
      super.willUpdate(changedProperties);

      if (changedProperties.has("app") && this.app) {
        this.#resolveApp?.(this.app);
      }

      if (changedProperties.has("botUser") && this.botUser) {
        this.#resolveBotUser?.(this.botUser);
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

      if (changedProperties.has("weavy") && this.weavy) {
        this.#resolveWeavy?.(this.weavy);
      }
    }

    override connectedCallback(): void {
      super.connectedCallback();

      if (this.app) {
        this.requestUpdate("app");
      }

      if (this.botUser) {
        this.requestUpdate("botUser");
      }

      if (this.hasFeatures) {
        this.requestUpdate("hasFeatures");
      }

      if (this.link) {
        this.requestUpdate("link");
      }

      if (this.settings) {
        this.requestUpdate("settings");
      }

      if (this.user) {
        this.requestUpdate("user");
      }

      if (this.weavy) {
        this.requestUpdate("weavy");
      }
    }
  }

  // Cast return type to your mixin's interface intersected with the Base type
  return WeavyComponentConsumer as Constructor<WeavyComponentContextProps> & T;
};
