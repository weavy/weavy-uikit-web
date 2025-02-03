import { LitElement, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { ContextConsumer, provide } from "@lit/context";
import {
  type WeavyComponentSettingsType,
  WeavyComponentSettingsContext,
  WeavyComponentSettings,
} from "../contexts/settings-context";
import { defaultVisibilityCheckOptions, whenParentsDefined } from "../utils/dom";
import { WeavyContext, type WeavyType } from "../contexts/weavy-context";
import type { BotType, UserType } from "../types/users.types";
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
import { type AppType, AppContext } from "../contexts/app-context";
import { UserContext } from "../contexts/user-context";
import { ProductFeaturesContext } from "../contexts/features-context";
import {
  AppTypeString,
  AppTypeGuid,
  ComponentType,
  AppTypeGuidMapping,
  AppTypeStringMapping,
  LinkType,
  BotAppTypeGuidMapping,
  BotAppTypeStringMapping,
} from "../types/app.types";
import { LinkContext } from "../contexts/link-context";
import { getStorage } from "../utils/data";
import type {
  NotificationsAppearanceType,
  NotificationsBadgeType,
  WyLinkEventType,
  WyNotificationEventType,
} from "../types/notifications.types";
import { objectAsIterable } from "../utils/objects";
import { BotContext } from "../contexts/bot-context";

export interface WeavyComponentProps {
  /**
   * Any product type for the weavy component.
   */
  productType?: ProductTypes;

  /**
   * Any app type for the weavy component.
   */
  componentType?: AppTypeString | ComponentType;

  /**
   * Any app types handled by the component.
   */
  appTypes?: AppTypeGuid[];

  /**
   * Unique identifier for the weavy component.
   * The uid should correspond to the uid of the app created using the server-to-server Web API.
   */
  uid?: string | null;

  /**
   * Optional display name for the weavy component.
   * The name will be updated on the server or fetched from the server for weavy components with a componentType.
   */
  name?: string | null;

  /**
   * Optional bot name for the weavy component.
   */
  bot?: string | null;
}

// Define the interface for the mixin
export interface WeavyComponentSettingProps {
  /**
   * Sets the appearance of the built in notifications.
   */
  notifications: NotificationsAppearanceType;

  /**
   * Sets the appearance of the notifications badge.
   */
  notificationsBadge: NotificationsBadgeType;
}

export interface WeavyComponentContextProps {
  /**
   * The app data.
   */
  app: AppType | undefined;

  /**
   * Resolves when app data is available.
   */
  whenApp: () => Promise<AppType>;

  /**
   * The current bot.
   */
  botUser: BotType | undefined;

  /**
   * Resolves when current bot user data is available.
   */
  whenBotUser: () => Promise<BotType>;

  /**
   * Config for disabling features in the weavy component.
   * *Note: You can't enable any features that aren't available in your license.*
   */
  hasFeatures: ProductFeaturesType | undefined;

  /**
   * Resolves when weavy component features config is available.
   */
  whenHasFeatures: () => Promise<ProductFeaturesType>;

  /**
   * Any provided link that should be loaded, shown and highlighted.
   */
  link: LinkType | undefined;

  /**
   * Resolves when a provided link is available.
   */
  whenLink: () => Promise<LinkType>;

  /**
   * The weavy component settings provided as a context on the component.
   */
  settings: WeavyComponentSettingsType | undefined;

  /**
   * Resolves when weavy component settings are available.
   */
  whenSettings: () => Promise<WeavyComponentSettingsType>;

  /**
   * The current user.
   */
  user: UserType | undefined;

  /**
   * Resolves when current user data is available.
   */
  whenUser: () => Promise<UserType>;

  /**
   * The consumed weavy context.
   */
  weavy: WeavyType | undefined;

  /**
   * Resolves when a weavy context is available.
   */
  whenWeavy: () => Promise<WeavyType>;
}

export class WeavyComponent
  extends LitElement
  implements WeavyComponentProps, WeavyComponentContextProps, WeavyComponentSettingProps, ProductFeatureProps
{
  // CONTEXT CONSUMERS
  weavyContextConsumer?: ContextConsumer<{ __context__: WeavyType }, this>;

  // Manually consumed in scheduleUpdate()
  @state()
  weavy: WeavyType | undefined;

  // CONTEXT PROVIDERS
  @provide({ context: AppContext })
  @state()
  app: AppType | undefined;

  @provide({ context: BotContext })
  @state()
  botUser: BotType | undefined;

  @provide({ context: ProductFeaturesContext })
  @state()
  hasFeatures: ProductFeaturesType | undefined;

  @provide({ context: WeavyComponentSettingsContext })
  @state()
  settings: WeavyComponentSettingsType;

  @provide({ context: UserContext })
  @state()
  user: UserType | undefined;

  protected storage = getStorage("localStorage");

  /**
   * Checks if an Entity is matching the component.
   *
   * @param {EntityType} link Entity to check for match
   * @returns { boolean } True if the entity is matching the component
   */
  matchesLink(link?: LinkType) {
    if (
      // Messenger conversation
      link?.app?.type &&
      !this.componentType &&
      this.appTypes?.includes(link.app.type)
    ) {
      return link.bot ? link.bot === this.bot : true;
    } else if (
      // Normal contextual app
      link &&
      link.app &&
      this.componentType !== ComponentType.Unknown &&
      this.uid &&
      link.app?.uid === this.uid
    ) {
      return true;
    } else {
      // Not matching
      return false;
    }
  }

  @provide({ context: LinkContext })
  private _link: LinkType | undefined;

  @property({ type: Object })
  get link(): LinkType | undefined {
    return this._link;
  }
  set link(link: LinkType | undefined) {
    const oldLink = this._link;

    // If contextual app not configured yet
    if (!this.uid && this.componentType && this.componentType !== ComponentType.Unknown) {
      this.whenApp().then(() => {
        this._link = this.matchesLink(link) ? link : undefined;
        this.requestUpdate("link", oldLink);
      });
    } else {
      this._link = this.matchesLink(link) ? link : undefined;
      this.requestUpdate("link", oldLink);
    }
  }

  /**
   * Clears the link and resets the promise.
   */
  protected clearLink() {
    if (this.link) {
      this.#whenLink = new Promise<LinkType>((r) => {
        this.#resolveLink = r;
      });
      this.link = undefined;
    }
  }

  /**
   * Shares a link with other blocks that may consume it automatically.
   *
   * @param {LinkType} link - The entity to provide
   */
  protected provideStorageLink(link: LinkType) {
    this.storage?.setItem("wy-link", btoa(JSON.stringify(link)));
  }

  /**
   * Reads a link from storage provides it in the .link property/context.
   */
  protected readStorageLink() {
    if (!this.storage) {
      console.error("Storage not available");
      return;
    }

    const storageLink = this.storage.getItem("wy-link");
    if (storageLink) {
      //console.log("found link, parsing...")
      try {
        const parsedLink = JSON.parse(atob(storageLink)) as LinkType;
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
      if (this.link && this.link.id === e.detail.link.id) {
        this.link = undefined;
        await this.updateComplete;
      }
      this.link = e.detail.link;

      if (!this.link) {
        this.provideStorageLink(e.detail.link);
      }
    }
  };

  protected notificationEventHandler = (e: WyNotificationEventType) => {
    e.stopPropagation();
    if (!e.defaultPrevented) {
      // Check if notification belongs to this component and if it can be ignored
      if (this.isConnected && this.checkVisibility(defaultVisibilityCheckOptions) && this.matchesLink(e.detail.link)) {
        // Prevent the notification from showing
        e.preventDefault();
      }
    }
  };

  // PROPERTIES
  @state()
  productType?: ProductTypes;

  @state()
  componentType?: AppTypeString | ComponentType;

  @state()
  appTypes?: AppTypeGuid[];

  protected _bot?: string;

  @property({ type: String })
  get bot(): string | undefined {
    return this._bot;
  }
  set bot(bot: string | undefined) {
    this._bot = bot || undefined
  }

  @property({ type: String })
  uid?: string | null;

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
  noEmbeds = false;

  @property({ type: Boolean })
  noGoogleMeet = false;

  @property({ type: Boolean })
  noMentions = false;

  @property({ type: Boolean })
  noMicrosoftTeams = false;

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

  @property({ type: Boolean })
  noZoomMeetings = false;

  // PROMISES
  // TODO: Switch to Promise.withResolvers() when allowed by typescript

  #resolveApp?: (app: AppType) => void;
  #whenApp = new Promise<AppType>((r) => {
    this.#resolveApp = r;
  });
  async whenApp() {
    return await this.#whenApp;
  }

  #resolveBotUser?: (bot: BotType) => void;
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

  #resolveLink?: (link: LinkType) => void;
  #whenLink = new Promise<LinkType>((r) => {
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

  // INTERNAL PROPERTIES

  #appQuery = new QueryController<AppType>(this);
  #botUserQuery = new QueryController<BotType>(this);
  #featuresQuery = new QueryController<ProductFeaturesListType>(this);
  #userQuery = new QueryController<UserType>(this);

  // PROPERTY INIT
  constructor() {
    super();

    this.settings = new WeavyComponentSettings(this);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("wy-link", this.linkEventHandler);
    window.addEventListener("storage", this.storageLinkHandler);

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

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("wy-link", this.linkEventHandler);
    window.removeEventListener("storage", this.storageLinkHandler);
    this.weavy?.host.removeEventListener("wy-notification", this.notificationEventHandler, { capture: true });
  }

  protected override async scheduleUpdate(): Promise<void> {
    await whenParentsDefined(this);
    super.scheduleUpdate();
  }

  protected override willUpdate(changedProperties: PropertyValues) {
    super.willUpdate(changedProperties);

    this.weavyContextConsumer ??= new ContextConsumer(this, { context: WeavyContext, subscribe: true });

    if (this.weavyContextConsumer?.value && this.weavy !== this.weavyContextConsumer?.value) {
      this.weavy = this.weavyContextConsumer?.value;
    }

    const settingKeys = Object.keys(this.settings);
    if (settingKeys.find((setting) => changedProperties.has(setting as keyof this))) {
      this.settings = new WeavyComponentSettings(this);
    }

    if (changedProperties.has("weavy") && this.weavy) {
      this.#userQuery.trackQuery(getApiOptions<UserType>(this.weavy, ["user"]));
    }

    if (!this.#userQuery.result?.isPending) {
      if (this.user && this.#userQuery.result.data && this.user.id !== this.#userQuery.result.data.id) {
        console.warn("User changed, invalidating cache");
        this.weavy?.queryClient.invalidateQueries();
      }
    }

    if (!this.#userQuery.result?.isPending) {
      this.user = this.#userQuery.result?.data;
    }

    if ((changedProperties.has("productType") || changedProperties.has("weavy")) && this.productType && this.weavy) {
      this.#featuresQuery.trackQuery(
        getApiOptions<ProductFeaturesListType>(this.weavy, ["features", this.productType])
      );
    }

    if (!this.#featuresQuery.result?.isPending) {
      const availableFeatures = this.#featuresQuery.result?.data;

      if (availableFeatures) {
        const enabledFeatures: ProductFeaturesType = {};
        availableFeatures.forEach((feature) => {
          const featureDisabled = this[ProductFeaturePropMapping[feature] as keyof ProductFeatureProps];
          if (ProductFeatureMapping[feature]) {
            enabledFeatures[ProductFeatureMapping[feature]] = !featureDisabled;
          } else {
            console.warn("Unknown feature provided:", feature);
          }
        });
        const prevFeatures = this.hasFeatures;
        this.hasFeatures = enabledFeatures;
        this.requestUpdate("features", prevFeatures);
      }
    }

    if (
      changedProperties.has("componentType") ||
      changedProperties.has("uid") ||
      changedProperties.has("name") ||
      changedProperties.has("weavy")
    ) {
      // Reset whenApp
      this.#whenApp = new Promise<AppType>((r) => {
        this.#resolveApp = r;
      });

      if (this.componentType && this.uid && this.weavy) {
        const appData = this.name ? { name: this.name } : undefined;
        this.#appQuery.trackQuery(getAppOptions(this.weavy, this.uid, this.componentType, appData));
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

    if ((changedProperties.has("weavy") || changedProperties.has("bot")) && this.weavy && this.bot) {
      this.#botUserQuery.trackQuery(getApiOptions<BotType>(this.weavy, ["users", this.bot]));
    }

    if (!this.#botUserQuery.result?.isPending) {
      this.botUser = this.#botUserQuery.result?.data;
    }

    // Links
    if (
      changedProperties.has("uid") &&
      (this.uid || changedProperties.get("uid")) &&
      this.uid !== changedProperties.get("uid")
    ) {
      this.clearLink();
    }

    if (
      (!this.link &&
        ((changedProperties.has("uid") && this.uid) || (changedProperties.has("app") && this.app)) &&
        this.componentType &&
        this.componentType !== ComponentType.Unknown) ||
      ((changedProperties.has("appTypes") || changedProperties.has("bot")) && this.appTypes)
    ) {
      //console.log("Checking for storage link", this.appTypes, this.bot);
      this.readStorageLink();
    }

    if (changedProperties.has("link") && this.link) {
      console.info(`Opening notification link in ${this.uid ?? this.componentType ?? this.productType}`);
      this.consumeStorageLink();
    }

    // Promises

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
      this.weavy.host.addEventListener("wy-notification", this.notificationEventHandler, { capture: true });
      this.#resolveWeavy?.(this.weavy);
    }
  }
}

// Maps for working with app guids. Strong typing through objectAsIterable since all types are included.

/** Map for all app type guids. Returns app type string. */
export const AppTypeGuids = new Map(objectAsIterable<typeof AppTypeGuidMapping, AppTypeString>(AppTypeGuidMapping));

/** Map for all app type strings. Returns app type guid. */
export const AppTypeStrings = new Map(objectAsIterable<typeof AppTypeStringMapping, AppTypeGuid>(AppTypeStringMapping));

// Maps for bot types. Generic string typing, since not all app types are included.

/** Map for all bot app type guids. Returns app type string. */
export const BotAppTypeGuids = new Map(Object.entries(BotAppTypeGuidMapping));

/** Map for all bot app type strings. Returns app type guid. */
export const BotAppTypeStrings = new Map(Object.entries(BotAppTypeStringMapping));
