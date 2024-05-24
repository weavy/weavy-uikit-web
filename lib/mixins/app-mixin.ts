import { LitElement, PropertyValueMap } from "lit";
import { property, state } from "lit/decorators.js";
import { ContextConsumer, provide } from "@lit/context";
import { AppSettings, appSettingsContext } from "../contexts/settings-context";
import { Constructor } from "../types/generic.types";
import type { ServerConfigurationType } from "../types/server.types";
import { serverConfigurationsContext } from "../contexts/configuration-context";
import { whenParentsDefined } from "../utils/dom";
import { weavyContextDefinition, type WeavyContextType } from "../contexts/weavy-context";
import { AppTypes } from "../types/app.types";
import type { UserType } from "../types/users.types";
import { FeatureMapping, FeaturePropMapping, type FeatureProps, type FeaturesListType } from "../types/features.types";
import { QueryController } from "../controllers/query-controller";
import { getApiOptions } from "../data/api";
import { getAppOptions } from "../data/app";
import { getProductFromAppType } from "../utils/features";
import { type AppType, appContext } from "../contexts/app-context";
import { userContext } from "../contexts/user-context";
import { type FeaturesType, featuresContext } from "../contexts/features-context";

export interface AppProps {
  /**
   * The type of the app.
   */
  appType?: AppTypes;

  /**
   * Unique identifier for your app component.
   * The uid should correspond to the uid of the app created using the server-to-server Web API.
   */
  uid?: string;
}

// Define the interface for the mixin
export interface AppSettingProps {
  /**
   * Whether to use local modals attached in place rather than globally attached modals.
   * May require adjustments to layout and z-index on the page.
   */
  submodals: boolean;
}

export interface AppContextProps {
  /**
   * The settings provided as a context on the component.
   */
  settings: AppSettings | undefined;

  /**
   * The configuration from the server provided as a context on the component.
   */
  configuration: ServerConfigurationType | undefined;

  /**
   * The consumed weavy context.
   */
  weavyContext: WeavyContextType | undefined;

  /**
   * The app data.
   */
  app: AppType | undefined;

  /**
   * The current user.
   */
  user: UserType | undefined;

  /**
   * Config for disabling features in the component.
   * *Note: You can't enable any features that aren't available in your license.*
   */
  hasFeatures: FeaturesType | undefined;
}

export const AppProviderMixin = <T extends Constructor<LitElement>>(Base: T) => {
  class AppProvider extends Base implements AppProps, AppContextProps, AppSettingProps, FeatureProps {
    // CONTEXT CONSUMERS
    weavyContextConsumer?: ContextConsumer<{ __context__: WeavyContextType }, this>;

    // Manually consumed in scheduleUpdate()
    @state()
    weavyContext: WeavyContextType | undefined;

    // CONTEXT PROVIDERS
    @provide({ context: appSettingsContext })
    @state()
    settings: AppSettings;

    @provide({ context: serverConfigurationsContext })
    @state()
    configuration: ServerConfigurationType = {};

    @provide({ context: appContext })
    @state()
    app: AppType | undefined;

    @provide({ context: userContext })
    @state()
    user: UserType | undefined;

    @provide({ context: featuresContext })
    @state()
    hasFeatures: FeaturesType | undefined;

    @property({ type: Object })
    set features(_features: FeaturesType | undefined) {
      console.warn('Setting a "features" object is deprecated, use feature-disabling properties/attributes instead.');

      // Deprecated backward compatible feature settings object
      if (_features) {
        for (const featureKey in FeatureMapping) {
          const featureConfigKey = FeatureMapping[featureKey];
          if (featureConfigKey in _features) {
            const featureProp = FeaturePropMapping[featureKey];
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
    @property({ attribute: false })
    appType?: AppTypes;

    @property()
    uid?: string;

    // SETTINGS
    @property({ type: Boolean })
    submodals = false;

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

    // INTERNAL PROPERTIES

    #configurationQuery = new QueryController<ServerConfigurationType>(this);
    #appQuery = new QueryController<AppType>(this);
    #userQuery = new QueryController<UserType>(this);
    #featuresQuery = new QueryController<FeaturesListType>(this);

    // PROPERTY INIT
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      this.settings = new AppSettings(this);
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
        this.settings = new AppSettings(this);
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
        this.user = this.#userQuery.result?.data;
      }

      if (
        (changedProperties.has("appType") || changedProperties.has("weavyContext")) &&
        this.appType &&
        this.weavyContext
      ) {
        this.#featuresQuery.trackQuery(
          getApiOptions<FeaturesListType>(this.weavyContext, ["features", getProductFromAppType(this.appType)])
        );
      }

      if (!this.#featuresQuery.result?.isPending) {
        const availableFeatures = this.#featuresQuery.result?.data;

        if (availableFeatures) {
          const enabledFeatures: FeaturesType = {};
          availableFeatures.forEach((feature) => {
            const featureDisabled = this[FeaturePropMapping[feature] as keyof FeatureProps];
            enabledFeatures[FeatureMapping[feature]] = !featureDisabled;
          });
          const prevFeatures = this.hasFeatures;
          this.hasFeatures = enabledFeatures;
          this.requestUpdate("features", prevFeatures);
        }
      }

      if (
        (changedProperties.has("appType") || changedProperties.has("uid") || changedProperties.has("weavyContext")) &&
        this.appType &&
        this.uid &&
        this.weavyContext
      ) {
        this.#appQuery.trackQuery(getAppOptions(this.weavyContext, this.uid, this.appType));
      }

      if (!this.#appQuery.result?.isPending) {
        this.app = this.#appQuery.result?.data;
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
  return AppProvider as Constructor<AppProps & AppContextProps & AppSettingProps & FeatureProps> & T;
};
