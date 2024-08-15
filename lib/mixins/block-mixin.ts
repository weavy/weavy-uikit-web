import { LitElement, PropertyValueMap } from "lit";
import { property, state } from "lit/decorators.js";
import { ContextConsumer, provide } from "@lit/context";
import { type BlockSettingsType, blockSettingsContext, BlockSettings } from "../contexts/settings-context";
import { Constructor } from "../types/generic.types";
import type { ServerConfigurationType } from "../types/server.types";
import { serverConfigurationsContext } from "../contexts/configuration-context";
import { whenParentsDefined } from "../utils/dom";
import { weavyContextDefinition, type WeavyContextType } from "../contexts/weavy-context";
import type { UserType } from "../types/users.types";
import {
  ProductFeatureMapping,
  ProductFeaturePropMapping,
  ProductFeaturesType,
  ProductTypes,
  type ProductFeatureProps,
  type ProductFeaturesListType,
} from "../types/product.types";
import { QueryController } from "../controllers/query-controller";
import { getApiOptions } from "../data/api";
import { getAppOptions } from "../data/app";
import { type AppType, appContext } from "../contexts/app-context";
import { userContext } from "../contexts/user-context";
import { productFeaturesContext } from "../contexts/features-context";
import { ContextualTypes, EntityType } from "../types/app.types";
import { linkContext } from "../contexts/link-context";
import { getStorage } from "../utils/data";
import type { NotificationsAppearanceType, NotificationsBadgeType, WyLinkEventType } from "../types/notifications.types";
import { ConversationTypeGuid } from "../types/conversations.types";

export interface BlockProps {
  /**
   * Any product type for the block.
   */
  productType?: ProductTypes;

  /**
   * Any contextual app type for the block.
   */
  contextualType?: ContextualTypes;

  /**
   * Any conversation types for the block.
   */
  conversationTypes?: ConversationTypeGuid[];

  /**
   * Unique identifier for your app component.
   * The uid should correspond to the uid of the app created using the server-to-server Web API.
   */
  uid?: string;

  /**
   * Optional display name for your app component.
   * The name will be updated on the server or fetched from the server.
   */
  name?: string;
}

// Define the interface for the mixin
export interface BlockSettingProps {
  /**
   * Sets the appearance of the built in notifications.
   */
  notifications: NotificationsAppearanceType;

  /**
   * Sets the appearance of the notifications badge.
   */
  notificationsBadge: NotificationsBadgeType;
}

export interface BlockContextProps {
  /**
   * The app data.
   */
  app: AppType | undefined;

  /**
   * The configuration from the server provided as a context on the component.
   */
  configuration: ServerConfigurationType | undefined;

  /**
   * Config for disabling features in the component.
   * *Note: You can't enable any features that aren't available in your license.*
   */
  hasFeatures: ProductFeaturesType | undefined;

  /**
   * Any provided link that should be loaded, shown and highlighted.
   */
  link: EntityType | undefined;

  /**
   * The settings provided as a context on the component.
   */
  settings: BlockSettingsType | undefined;

  /**
   * The current user.
   */
  user: UserType | undefined;

  /**
   * The consumed weavy context.
   */
  weavyContext: WeavyContextType | undefined;
}

export interface BlockContextProviderProps {
  /**
   * All block contexts provided in a combined object. Used for convenience when forwarding contexts.
   */
  contexts?: {} & BlockContextProps;

  whenApp: () => Promise<AppType>;
  whenConfiguration: () => Promise<ServerConfigurationType>;
  whenHasFeatures: () => Promise<ProductFeaturesType>;
  whenLink: () => Promise<EntityType>;
  whenSettings: () => Promise<BlockSettingsType>;
  whenUser: () => Promise<UserType>;
  whenWeavyContext: () => Promise<WeavyContextType>;
}

export const BlockProviderMixin = <T extends Constructor<LitElement>>(Base: T) => {
  class BlockProvider
    extends Base
    implements BlockProps, BlockContextProviderProps, BlockContextProps, BlockSettingProps, ProductFeatureProps
  {
    // CONTEXT CONSUMERS
    weavyContextConsumer?: ContextConsumer<{ __context__: WeavyContextType }, this>;

    // Manually consumed in scheduleUpdate()
    @state()
    weavyContext: WeavyContextType | undefined;

    // CONTEXT PROVIDERS
    @provide({ context: appContext })
    @state()
    app: AppType | undefined;

    @provide({ context: serverConfigurationsContext })
    @state()
    configuration: ServerConfigurationType = {};

    @provide({ context: productFeaturesContext })
    @state()
    hasFeatures: ProductFeaturesType | undefined;

    @provide({ context: blockSettingsContext })
    @state()
    settings: BlockSettingsType;

    @provide({ context: userContext })
    @state()
    user: UserType | undefined;

    protected storage = getStorage("localStorage");

    @provide({ context: linkContext })
    private _link: EntityType | undefined;

    @property({ type: Object })
    get link(): EntityType | undefined {
      return this._link;
    }
    set link(link: EntityType | undefined) {
      const oldLink = this._link;
      if (
        // Messenger conversation
        link &&
        link.app &&
        !this.contextualType &&
        this.conversationTypes?.includes(link.app.type as ConversationTypeGuid)
      ) {
        this._link = link;
        this.requestUpdate("link", oldLink);
      } else if (
        // Contextual app not configured yet
        link &&
        link.app &&
        !this.uid &&
        this.contextualType &&
        this.contextualType !== ContextualTypes.Unknown
      ) {
        this.whenApp().then((app) => {
          if (link?.app?.id === app.id) {
            //console.log("async link set", link)
            this._link = link;
            this.requestUpdate("link", oldLink);
          } else {
            console.error("Incorrect app uid or id in provided link", link);
            this._link = undefined;
            this.requestUpdate("link", oldLink);
          }
        });
      } else if (
        // Normal contextual app
        link &&
        link.app &&
        this.contextualType !== ContextualTypes.Unknown &&
        this.uid &&
        link.app?.uid === this.uid
      ) {
        //console.log("link set", link)
        this._link = link;
        this.requestUpdate("link", oldLink);
      } else {
        // Not matching
        //console.log("link removed", link)
        this._link = undefined;
        this.requestUpdate("link", oldLink);
      }
    }

    /**
     * Shares a link with other blocks that may consume it automatically.
     *
     * @param {EntityType} link - The entity to provide
     */
    protected provideStorageLink(link: EntityType) {
      this.storage?.setItem("wy-link", btoa(JSON.stringify(link)));
    }

    /**
     * Reads a link from storage provides it in the .link property/context.
     */
    protected readStorageLink() {
      if(!this.storage) {
        console.error("Storage not available")
        return;
      }

      const storageLink = this.storage.getItem("wy-link");
      if (storageLink) {
        //console.log("found link, parsing...")
        try {
          const parsedLink = JSON.parse(atob(storageLink)) as EntityType;
          if (parsedLink) {
            //console.log("parsed Link", parsedLink)
            this.link = parsedLink;
          }
        } catch (e) {
          console.error("Error parsing link", e);
        }
      }
    }

    /**
     * Consumes a link in the storage. Make sure to consume it after it has been used.
     */
    protected consumeStorageLink() {
      this.storage?.removeItem("wy-link");
    }

    protected storageLinkHandler = (e: StorageEvent) => {
      if (e.storageArea === this.storage && e.key === "wy-link" && e.newValue) {
        //console.log("storage updated with wy-link", e.newValue);
        this.readStorageLink();
      }
    };

    protected linkEventHandler = async (e: WyLinkEventType) => {
      if (!e.defaultPrevented) {
        if (this.link && this.link.id === e.detail.id) {
          this.link = undefined;
          await this.updateComplete;
        }
        this.link = e.detail;

        if (!this.link) {
          this.provideStorageLink(e.detail);
        }
      }
    };

    // DEPRECATED
    @property({ type: Object })
    set features(_features: ProductFeaturesType | undefined) {
      console.warn('Setting a "features" object is deprecated, use feature-disabling properties/attributes instead.');

      // Deprecated backward compatible feature settings object
      if (_features) {
        for (const featureKey in ProductFeatureMapping) {
          const featureConfigKey = ProductFeatureMapping[featureKey];
          if (featureConfigKey in _features) {
            const featureProp = ProductFeaturePropMapping[featureKey];
            const featureDisabled = _features[featureConfigKey] === false;
            console.warn(`Using "${featureProp}" from deprecated "features.${featureConfigKey}".`);
            this[featureProp] = featureDisabled;
          }
        }
      }
    }

    get features() {
      return this.hasFeatures;
    }

    // PROPERTIES
    @state()
    productType?: ProductTypes;

    @state()
    contextualType?: ContextualTypes;

    @state()
    conversationTypes?: ConversationTypeGuid[];

    @property()
    uid?: string;

    private _initialAppName?: string;
    private _appName?: string;

    @property({ type: String })
    set name(name) {
      this._initialAppName ??= name;
      this._appName = name;
    }
    get name() {
      return this._appName;
    }
    
    // SETTINGS
    @property({ type: String })
    notifications: NotificationsAppearanceType = "button-list";

    @property({ type: String })
    notificationsBadge: NotificationsBadgeType = "count";

    // FEATURES
    @property({ type: Boolean })
    noAttachments = false;

    @property({ type: Boolean })
    noCloudFiles = false;

    @property({ type: Boolean })
    noComments = false;

    @property({ type: Boolean })
    noConfluence = false;

    @property({ type: Boolean })
    noEmbeds = false;

    @property({ type: Boolean })
    noMeetings = false;

    @property({ type: Boolean })
    noMentions = false;

    @property({ type: Boolean })
    noPolls = false;

    @property({ type: Boolean })
    noPreviews = false;

    @property({ type: Boolean })
    noReactions = false;

    @property({ type: Boolean })
    noReceipts = false;

    @property({ type: Boolean })
    noThumbnails = false;

    @property({ type: Boolean })
    noTyping = false;

    @property({ type: Boolean })
    noVersions = false;

    @property({ type: Boolean })
    noWebDAV = false;

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
    contexts?: {} & BlockContextProps;

    // INTERNAL PROPERTIES

    #appQuery = new QueryController<AppType>(this);
    #configurationQuery = new QueryController<ServerConfigurationType>(this);
    #featuresQuery = new QueryController<ProductFeaturesListType>(this);
    #userQuery = new QueryController<UserType>(this);

    // PROPERTY INIT
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      this.settings = new BlockSettings(this);

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

    override connectedCallback(): void {
      super.connectedCallback();
      document.addEventListener("wy:link", this.linkEventHandler as unknown as EventListener);
      window.addEventListener("storage", this.storageLinkHandler);
      
      if (this.app) {
        this.requestUpdate("app");
      }

      if (this.configuration) {
        this.requestUpdate("configuration");
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

      if (this.weavyContext) {
        this.requestUpdate("weavyContext");
      }
    }

    override disconnectedCallback(): void {
      super.disconnectedCallback();
      document.removeEventListener("wy:link", this.linkEventHandler as unknown as EventListener);
      window.removeEventListener("storage", this.storageLinkHandler);
    }

    protected override async scheduleUpdate(): Promise<void> {
      await whenParentsDefined(this);
      super.scheduleUpdate();
    }

    protected override willUpdate(changedProperties: PropertyValueMap<this>) {
      super.willUpdate(changedProperties);

      this.weavyContextConsumer ??= new ContextConsumer(this, { context: weavyContextDefinition, subscribe: true });

      if (this.weavyContextConsumer?.value && this.weavyContext !== this.weavyContextConsumer?.value) {
        this.weavyContext = this.weavyContextConsumer?.value;
      }

      const settingKeys = Object.keys(this.settings);
      if (settingKeys.find((setting) => changedProperties.has(setting as keyof this))) {
        this.settings = new BlockSettings(this);
      }

      if (changedProperties.has("weavyContext") && this.weavyContext) {
        this.#configurationQuery.trackQuery(
          getApiOptions<ServerConfigurationType>(this.weavyContext, ["configuration"])
        );
        this.#userQuery.trackQuery(getApiOptions<UserType>(this.weavyContext, ["user"]));
      }

      if (!this.#configurationQuery.result?.isPending && this.#configurationQuery.result?.data) {
        this.configuration = this.#configurationQuery.result?.data;
      }

      if (!this.#userQuery.result?.isPending) {
        if (this.user && this.#userQuery.result.data && this.user.id !== this.#userQuery.result.data.id) {
          console.warn("User changed, invalidating cache");
          this.weavyContext?.queryClient.invalidateQueries();
        }
      }

      if (!this.#userQuery.result?.isPending) {
        this.user = this.#userQuery.result?.data;
      }

      if (
        (changedProperties.has("productType") || changedProperties.has("weavyContext")) &&
        this.productType &&
        this.weavyContext
      ) {
        this.#featuresQuery.trackQuery(
          getApiOptions<ProductFeaturesListType>(this.weavyContext, ["features", this.productType])
        );
      }

      if (!this.#featuresQuery.result?.isPending) {
        const availableFeatures = this.#featuresQuery.result?.data;

        if (availableFeatures) {
          const enabledFeatures: ProductFeaturesType = {};
          availableFeatures.forEach((feature) => {
            const featureDisabled = this[ProductFeaturePropMapping[feature] as keyof ProductFeatureProps];
            enabledFeatures[ProductFeatureMapping[feature]] = !featureDisabled;
          });
          const prevFeatures = this.hasFeatures;
          this.hasFeatures = enabledFeatures;
          this.requestUpdate("features", prevFeatures);
        }
      }

      if (
        changedProperties.has("contextualType") ||
        changedProperties.has("uid") ||
        changedProperties.has("name") ||
        changedProperties.has("weavyContext")
      ) {
        if (this.contextualType && this.uid && this.weavyContext) {
          const appData = this.name ? { name: this.name } : undefined;
          this.#appQuery.trackQuery(getAppOptions(this.weavyContext, this.uid, this.contextualType, appData));
        } else {
          this.#appQuery.untrackQuery();
          this.app = undefined;
          this.name = this._initialAppName;
        }
      }

      if (!this.#appQuery.result?.isPending) {
        this.app = this.#appQuery.result?.data;

        if (this.app?.name) {
          this.name = this.app.name;
        }
      }

      // Links
      if (
        (!this.link &&
          ((changedProperties.has("uid") && this.uid) || (changedProperties.has("app") && this.app)) &&
          this.contextualType &&
          this.contextualType !== ContextualTypes.Unknown) ||
        (changedProperties.has("conversationTypes") && this.conversationTypes)
      ) {
        //console.log("Checking for storage link");
        this.readStorageLink();
      }

      if (changedProperties.has("link") && this.link) {
        console.info(`Opening notification link in ${this.uid ?? this.contextualType ?? this.productType}`);
        this.consumeStorageLink();
      }

      // Contexts convenience object
      if (
        changedProperties.has("app") ||
        changedProperties.has("configuration") ||
        changedProperties.has("hasFeatures") ||
        changedProperties.has("link") ||
        changedProperties.has("settings") ||
        changedProperties.has("user") ||
        changedProperties.has("weavyContext")
      ) {
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

      // Promises

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

      // BACKWARDS DEPRECATED COMPATIBILITY
      if (
        (changedProperties.has("weavyContext") || changedProperties.has("configuration")) &&
        this.weavyContext &&
        this.configuration
      ) {
        if (!this.configuration.zoom_authentication_url && this.weavyContext.zoomAuthenticationUrl) {
          console.warn(`Using "zoomAuthenticationUrl" from WyContext.`);
          this.configuration.zoom_authentication_url = this.weavyContext.zoomAuthenticationUrl.toString();
        }
      }
    }
  }

  // Cast return type to your mixin's interface intersected with the Base type
  return BlockProvider as Constructor<
    BlockProps & BlockContextProviderProps & BlockContextProps & BlockSettingProps & ProductFeatureProps
  > &
    T;
};
