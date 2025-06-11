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
import type { UserType } from "../types/users.types";
import { QueryController } from "../controllers/query-controller";
import { getApiOptions } from "../data/api";
import { getOrCreateAppOptions } from "../data/app";
import { type AppType, AppContext } from "../contexts/app-context";
import { UserContext } from "../contexts/user-context";
import { type ComponentFeaturePolicy, Feature, FeaturePolicyContext } from "../contexts/features-context";
import {
  AppTypeString,
  AppTypeGuid,
  ComponentType,
  AppTypeGuidMapping,
  AppTypeStringMapping,
  LinkType,
  AgentAppTypeGuidMapping,
  AgentAppTypeStringMapping,
} from "../types/app.types";
import { LinkContext } from "../contexts/link-context";
import { getStorage } from "../utils/data";
import type { NotificationsAppearanceType, NotificationsBadgeType } from "../types/notifications.types";
import type { WyLinkEventType, WyNotificationEventType } from "../types/notifications.events";
import { asArray, findAsyncSequential, objectAsIterable } from "../utils/objects";
import { ComponentFeatures } from "../contexts/features-context";
import { WeavyClient } from "../client/weavy";
import { WyAppEventType } from "../types/app.events";
import { NamedEvent } from "../types/generic.types";
import { ContextDataBlobsType, ContextDataType } from "../types/context.types";
import { DataRefType } from "../types/refs.types";
import { getContextDataRef } from "../utils/contextdata";
import { getHash } from "../utils/files";
import { MutationStateController } from "../controllers/mutation-state-controller";
import { MutationController } from "../controllers/mutation-controller";
import { BlobType, FileMutationContextType, FileType, MutateFileProps } from "../types/files.types";
import { EmbedType } from "../types/embeds.types";
import { getUploadBlobMutationOptions } from "../data/blob-upload";
import { DataBlobsContext } from "../contexts/data-context";
import { ContextIdContext, type ContextIdType } from "../contexts/context-id-context";
import { v4 as uuid_v4 } from "uuid";
import { toIntOrString } from "../converters/string";

export interface WeavyComponentProps {
  /**
   * Any app type for the weavy component.
   */
  componentType?: AppTypeGuid | ComponentType;

  /**
   * Any app types handled by the component.
   */
  appTypes?: AppTypeGuid[];

  /**
   * Unique identifier or app id for the weavy component.
   * The unique identifier should correspond to the uid of the app created using the server-to-server Web API.
   */
  uid?: string | number | null;

  /**
   * Optional display name for the weavy component.
   * The name will be updated on the server or fetched from the server for weavy components with a componentType.
   */
  name?: string | null;

  /**
   * The configured uid of the agent for the weavy component.
   */
  agent?: string | null;

  /**
   * Array with any contextual data. The data is uploaded upon change.
   *
   * *Note: Only the first item in the array is currently used.*
   */
  data?: ContextDataType[];

  /**
   * Sets the uid property with automatically appended user and agent name (where applicable).
   */
  autoUid?: string | null;

  /**
   * It sets the component to it's initial state and resets the app state.
   */
  reset: () => void;
}

export interface WeavyComponentSettingProps {
  /**
   * Appearance of the built in notifications.
   */
  notifications: NotificationsAppearanceType;

  /**
   * Appearance of the notifications badge.
   */
  notificationsBadge: NotificationsBadgeType;

  /**
   * A space separated string of available reaction emojis in unicode.
   */
  reactions: string;
}

export interface WeavyComponentFeatureProps {
  /**
   * Config for only enabling specific features in the weavy component.
   */
  features?: string;
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

  // /**
  //  * The current agent.
  //  */
  // agentUser: AgentType | undefined;

  // /**
  //  * Resolves when current agent user data is available.
  //  */
  // whenAgentUser: () => Promise<AgentType>;

  /**
   * Uploaded context data blob ids.
   */
  contextDataBlobs: ContextDataBlobsType | undefined;

  /**
   * Resolves when context data blob uploads has finished.
   */
  whenContextDataBlobs: () => Promise<ContextDataBlobsType>;

  /**
   * Contextual guid that is unique for the client context.
   */
  contextId: ContextIdType | undefined;

  /**
   * Resolves when a contextual id is available.
   */
  whenContextId: () => Promise<ContextIdType>;

  /**
   * Policy for checking which features are available.
   */
  componentFeatures: ComponentFeaturePolicy | undefined;

  /**
   * Resolves when weavy component features config is available.
   */
  whenComponentFeatures: () => Promise<ComponentFeaturePolicy>;

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
   * @function
   */
  whenWeavy: () => Promise<WeavyType>;
}

/**
 * Base class for exposed/public weavy components. This class provides common external properties and internal data provided as contexts for sub components.
 */
export class WeavyComponent
  extends LitElement
  implements WeavyComponentProps, WeavyComponentContextProps, WeavyComponentSettingProps, WeavyComponentFeatureProps
{
  protected storage = getStorage("localStorage");

  // CONTEXT CONSUMERS
  weavyContextConsumer?: ContextConsumer<{ __context__: WeavyType }, this>;

  // Manually consumed in scheduleUpdate()
  @state()
  weavy: WeavyType | undefined;

  // CONTEXT PROVIDERS
  @provide({ context: AppContext })
  @state()
  app: AppType | undefined;

  // @provide({ context: AgentContext })
  // @state()
  // agentUser: AgentType | undefined;

  @provide({ context: DataBlobsContext })
  @state()
  contextDataBlobs: ContextDataBlobsType | undefined;

  @provide({ context: ContextIdContext })
  @state()
  contextId: ContextIdType = uuid_v4();

  @provide({ context: FeaturePolicyContext })
  @state()
  componentFeatures: ComponentFeaturePolicy | undefined;

  @provide({ context: WeavyComponentSettingsContext })
  @state()
  settings: WeavyComponentSettingsType;

  @provide({ context: UserContext })
  @state()
  user: UserType | undefined;

  reset() {
    if (this.app) {
      this.app = undefined;
    }

    if (this._appName !== this._initialAppName) {
      this._appName = this._initialAppName;
    }
  }

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
      return link.agent ? link.agent === this.agent : true;
    } else if (
      // Normal contextual app
      link &&
      link.app &&
      this.componentType !== ComponentType.Unknown &&
      ((typeof this.uid === "string" && link.app?.uid === this.uid) || // Normal app with app uid
        (typeof this.uid === "number" && link.app?.id === this.uid) || // Normal app with app id
        (this.agent && link.app.type === this.componentType && link.agent === this.agent)) // Agent app
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
      void this.whenApp().then(() => {
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
  componentType?: AppTypeGuid | ComponentType;

  @state()
  appTypes?: AppTypeGuid[];

  @property()
  features?: string;

  protected _agentUid?: string;

  @property({ type: String })
  get agent(): string | undefined {
    return this._agentUid;
  }
  set agent(agent: string | undefined) {
    this._agentUid = agent || undefined;
  }

  @property({
    attribute: true,
    type: String,
    converter: {
      fromAttribute(value) {
        return asArray(value);
      },
    },
  })
  data?: ContextDataType[];

  @property()
  autoUid?: string | null;

  @property({ converter: toIntOrString })
  uid?: string | number | null;

  private _initialAppName?: string;
  private _appName?: string;

  @property({ type: String })
  set name(name) {
    this._initialAppName = name;
    this._appName = name;
  }
  get name() {
    return this._appName;
  }

  // SETTINGS

  // notifications
  #notifications?: WeavyComponentSettingProps["notifications"];

  @property({ type: String })
  set notifications(notifications) {
    this.#notifications = notifications;
  }

  get notifications() {
    return this.#notifications ?? this.weavy?.notifications ?? WeavyClient.defaults.notifications;
  }

  // notificationsBadge
  #notificationsBadge?: WeavyComponentSettingProps["notificationsBadge"];

  @property({ type: String })
  set notificationsBadge(notificationsBadge) {
    this.#notificationsBadge = notificationsBadge;
  }

  get notificationsBadge() {
    return this.#notificationsBadge ?? this.weavy?.notificationsBadge ?? WeavyClient.defaults.notificationsBadge;
  }

  // reactions
  #reactions?: WeavyComponentSettingProps["reactions"];

  @property({ type: String })
  set reactions(reactions) {
    this.#reactions = reactions;
  }

  get reactions() {
    return this.#reactions ?? this.weavy?.reactions ?? WeavyClient.defaults.reactions;
  }

  // PROMISES
  // TODO: Switch to Promise.withResolvers() when allowed by typescript
  // Promise.withResolvers() is available in ES2024, that needs to be set in TSConfig

  // #resolveAgentUser?: (agent: AgentType) => void;
  // #whenAgentUser = new Promise<AgentType>((r) => {
  //   this.#resolveAgentUser = r;
  // });
  // async whenAgentUser() {
  //   return await this.#whenAgentUser;
  // }

  #resolveApp?: (app: AppType) => void;
  #whenApp = new Promise<AppType>((r) => {
    this.#resolveApp = r;
  });
  async whenApp() {
    return await this.#whenApp;
  }

  #resolveContextDataBlobs?: (blobs: ContextDataBlobsType) => void;
  #whenContextDataBlobs = new Promise<ContextDataBlobsType>((r) => {
    this.#resolveContextDataBlobs = r;
  });
  async whenContextDataBlobs() {
    return await this.#whenContextDataBlobs;
  }

  #resolveContextId?: (contextId: ContextIdType) => void;
  #whenContextId = new Promise<ContextIdType>((r) => {
    this.#resolveContextId = r;
  });
  async whenContextId() {
    return await this.#whenContextId;
  }

  #resolveComponentFeatures?: (componentFeatures: ComponentFeaturePolicy) => void;
  #whenComponentFeatures = new Promise<ComponentFeaturePolicy>((r) => {
    this.#resolveComponentFeatures = r;
  });
  async whenComponentFeatures() {
    return await this.#whenComponentFeatures;
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
  // #agentUserQuery = new QueryController<AgentType>(this);
  #userQuery = new QueryController<UserType>(this);

  #contextDataRefs: Map<ContextDataType, DataRefType> = new Map();

  #uploadContextDataMutation = new MutationController<BlobType, Error, MutateFileProps, FileMutationContextType>(this);

  #mutatingContextData = new MutationStateController<
    BlobType | FileType | EmbedType,
    Error,
    MutateFileProps,
    FileMutationContextType
  >(this);

  // DEPRECATED

  /**
   * @deprecated Use agent property instead.
   */
  @property()
  bot?: string;

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

    // if (this.agentUser) {
    //   this.requestUpdate("agentUser");
    // }

    if (this.componentFeatures) {
      this.requestUpdate("componentFeatures");
    }

    if (this.contextDataBlobs) {
      this.requestUpdate("contextDataBlobs");
    }

    if (this.contextId) {
      this.requestUpdate("contextId");
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
    await super.scheduleUpdate();
  }

  protected override async willUpdate(changedProperties: PropertyValues): Promise<void> {
    super.willUpdate(changedProperties);

    this.weavyContextConsumer ??= new ContextConsumer(this, { context: WeavyContext, subscribe: true });

    if (this.weavyContextConsumer?.value && this.weavy !== this.weavyContextConsumer?.value) {
      this.weavy = this.weavyContextConsumer?.value;
    }

    const settingKeys = Object.keys(this.settings);
    if (changedProperties.has("weavy") || settingKeys.find((setting) => changedProperties.has(setting as keyof this))) {
      this.settings = new WeavyComponentSettings(this);
    }

    if (changedProperties.has("weavy") && this.weavy) {
      await this.#userQuery.trackQuery(getApiOptions<UserType>(this.weavy, ["user"]));
    }

    if (!this.#userQuery.result?.isPending) {
      if (this.user && this.#userQuery.result.data && this.user.id !== this.#userQuery.result.data.id) {
        console.warn("User mismatch, resetting");
        void this.weavy?.reset();
      }

      this.user = this.#userQuery.result?.data;
    }

    if (changedProperties.has("features") && this.componentFeatures) {
      this.componentFeatures.setAllowedFeatures(this.features);

      if (this.componentFeatures instanceof ComponentFeatures) {
        // Immutable update
        this.componentFeatures = this.componentFeatures.immutable();
      }
    }

    // Generate UID using autoUid?
    if (
      (changedProperties.has("autoUid") || changedProperties.has("user") || changedProperties.has("agent")) &&
      this.autoUid &&
      this.user &&
      ((this.componentType && AgentAppTypeGuids.has(this.componentType) && this.agent) ||
        (this.componentType && !AgentAppTypeGuids.has(this.componentType)))
    ) {
      const uidParts: (string | number)[] = [this.autoUid];

      if (this.agent) {
        uidParts.push(this.agent);
      }

      if (this.user) {
        uidParts.push(this.user.uid || this.user.id);
      }

      this.uid = uidParts.join("-");
    }

    // Remember old name before any changes
    const oldName = this.name;

    if (
      changedProperties.has("componentType") ||
      changedProperties.has("uid") ||
      changedProperties.has("agent") ||
      changedProperties.has("name") ||
      changedProperties.has("weavy")
    ) {
      // Reset app name
      if (this._appName !== this._initialAppName) {
        this._appName = this._initialAppName;
        this.requestUpdate("name", oldName);
      }

      if (this.componentType && this.uid && this.weavy) {
        const appData = this.name ? { name: this.name } : undefined;
        const appMembers = this.agent ? [this.agent] : undefined;
        await this.#appQuery.trackQuery(
          getOrCreateAppOptions(this.weavy, this.uid, this.componentType, appMembers, appData)
        );
      } else {
        this.#appQuery.untrackQuery();
      }
    }

    if (!this.#appQuery.result?.isPending) {
      this.app = this.#appQuery.result?.data;

      if (this.app?.name && (this.app.name !== this.name || this._appName !== this.app.name)) {
        this._appName = this.app.name;
        this.requestUpdate("name", oldName);
      }
    }

    // Agent

    // if ((changedProperties.has("weavy") || changedProperties.has("agent")) && this.weavy && this.agent) {
    //   await this.#agentUserQuery.trackQuery(getApiOptions<AgentType>(this.weavy, ["users", this.agent]));
    // }

    // if (!this.#agentUserQuery.result?.isPending) {
    //   this.agentUser = this.#agentUserQuery.result?.data;
    // }

    // contextData
    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("contextId") ||
        changedProperties.has("user") ||
        changedProperties.has("componentFeatures")) &&
      this.weavy &&
      this.contextId &&
      this.user &&
      this.componentFeatures?.allowsFeature(Feature.ContextData)
    ) {
      await this.#uploadContextDataMutation.trackMutation(
        getUploadBlobMutationOptions(this.weavy, this.user, this.contextId, undefined, "data")
      );

      await this.#mutatingContextData.trackMutationState(
        {
          filters: {
            mutationKey: ["apps", this.contextId, "data"],
            exact: true,
          },
        },
        this.weavy.queryClient
      );
    }

    // Update context data refs
    if (changedProperties.has("data") || changedProperties.has("componentFeatures")) {
      const prevContextDataRefs = this.#contextDataRefs;
      this.#contextDataRefs = new Map();

      // Add items
      this.data?.forEach((dataItem) => {
        const prevItem = prevContextDataRefs.get(dataItem);
        if (prevItem) {
          this.#contextDataRefs.set(dataItem, prevItem);
        } else {
          const dataRef = getContextDataRef(dataItem);
          if (dataRef) {
            //console.log("context data item", dataRef);
            this.#contextDataRefs.set(dataItem, dataRef);
          }
        }
      });

      if (this.#contextDataRefs && this.componentFeatures?.allowsFeature(Feature.ContextData)) {
        for (const dataRef of Array.from(this.#contextDataRefs.values())) {
          if (dataRef.type === "file") {
            const sha256 = await getHash(dataRef.item);

            const existingUpload = await findAsyncSequential(
              this.#mutatingContextData.result ?? [],
              async (fileUpload) => {
                const existingSha256 = fileUpload.context?.sha256 ?? (await getHash(fileUpload.variables?.file));
                return existingSha256 === sha256;
              }
            );

            if (!existingUpload) {
              await this.#uploadContextDataMutation.mutate({ file: dataRef.item });
            }
          }
        }

        // TODO: remove old mutations or remove all when Feature.ContextData is changed

        const contextDataMutationResults = this.#mutatingContextData.result;

        const currentlyUploadingContextData = contextDataMutationResults?.some((upload) => upload.status === "pending");
        const contextDataBlobs =
          (contextDataMutationResults
            ?.map((mutation) => mutation.data?.id)
            .filter((x) => x)
            .reverse() as number[] | undefined) ?? [];

        if (!currentlyUploadingContextData) {
          this.contextDataBlobs = contextDataBlobs;
        }
      } else {
        // Let context consumers know that no blobs exist
        this.contextDataBlobs = [];
      }
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
      ((changedProperties.has("appTypes") || changedProperties.has("agent")) && this.appTypes)
    ) {
      //console.log("Checking for storage link", this.appTypes, this.agent);
      this.readStorageLink();
    }

    if (changedProperties.has("link") && this.link) {
      console.info(
        `Opening notification link in ${
          this.uid ?? AppTypeGuids.get(this.componentType as AppTypeGuid) ?? this.constructor.name
        }`
      );
      this.consumeStorageLink();
    }

    // Events

    if (changedProperties.has("app") && this.app) {
      const appEvent: WyAppEventType = new (CustomEvent as NamedEvent)("wy-app", {
        bubbles: false,
        composed: true,
        detail: {
          app: this.app,
        },
      });
      this.dispatchEvent(appEvent);
    }

    // Promises

    if (changedProperties.has("app") && this.app) {
      if (changedProperties.get("app")) {
        // reset promise
        this.#whenApp = new Promise<AppType>((r) => {
          this.#resolveApp = r;
        });
      }
      this.#resolveApp?.(this.app);
    }

    // if (changedProperties.has("agentUser") && this.agentUser) {
    //   if (changedProperties.get("agentUser")) {
    //     // reset promise
    //     this.#whenAgentUser = new Promise<AgentType>((r) => {
    //       this.#resolveAgentUser = r;
    //     });
    //   }
    //   this.#resolveAgentUser?.(this.agentUser);
    // }

    if (changedProperties.has("contextDataBlobs") && this.contextDataBlobs) {
      if (changedProperties.get("contextDataBlobs")) {
        // reset promise
        this.#whenContextDataBlobs = new Promise<ContextDataBlobsType>((r) => {
          this.#resolveContextDataBlobs = r;
        });
      }
      this.#resolveContextDataBlobs?.(this.contextDataBlobs);
    }

    if (changedProperties.has("contextId") && this.contextId) {
      if (changedProperties.get("contextId")) {
        // reset promise
        this.#whenContextId = new Promise<ContextIdType>((r) => {
          this.#resolveContextId = r;
        });
      }
      this.#resolveContextId?.(this.contextId);
    }

    if (changedProperties.has("componentFeatures") && this.componentFeatures) {
      if (changedProperties.get("componentFeatures")) {
        // reset promise
        this.#whenComponentFeatures = new Promise<ComponentFeaturePolicy>((r) => {
          this.#resolveComponentFeatures = r;
        });
      }
      this.#resolveComponentFeatures?.(this.componentFeatures);
    }

    if (changedProperties.has("link") && this.link) {
      if (changedProperties.get("link")) {
        // reset promise
        this.#whenLink = new Promise<LinkType>((r) => {
          this.#resolveLink = r;
        });
      }
      this.#resolveLink?.(this.link);
    }

    if (changedProperties.has("settings") && this.settings) {
      if (changedProperties.get("settings")) {
        // reset promise
        this.#whenSettings = new Promise<WeavyComponentSettingsType>((r) => {
          this.#resolveSettings = r;
        });
      }
      this.#resolveSettings?.(this.settings);
    }

    if (changedProperties.has("user") && this.user) {
      if (changedProperties.get("user")) {
        // reset promise
        this.#whenUser = new Promise<UserType>((r) => {
          this.#resolveUser = r;
        });
      }
      this.#resolveUser?.(this.user);
    }

    if (changedProperties.has("weavy") && this.weavy) {
      if (changedProperties.get("weavy")) {
        // reset promise
        this.#whenWeavy = new Promise<WeavyType>((r) => {
          this.#resolveWeavy = r;
        });
      }
      this.weavy.host.addEventListener("wy-notification", this.notificationEventHandler, { capture: true });
      this.#resolveWeavy?.(this.weavy);
    }

    // DEPRECATED
    if (changedProperties.has("bot") && typeof this.bot === "string") {
      console.error(`Using .bot property is deprecated. Use .agent = "${this.bot}"; instead`);
    }
  }
}

// Maps for working with app guids. Strong typing through objectAsIterable since all types are included.

/** Map for all app type guids. Returns app type string. */
export const AppTypeGuids = new Map(objectAsIterable<typeof AppTypeGuidMapping, AppTypeString>(AppTypeGuidMapping));

/** Map for all app type strings. Returns app type guid. */
export const AppTypeStrings = new Map(objectAsIterable<typeof AppTypeStringMapping, AppTypeGuid>(AppTypeStringMapping));

// Maps for agent types. Generic string typing, since not all app types are included.

/** Map for all agent app type guids. Returns app type string. */
export const AgentAppTypeGuids = new Map(Object.entries(AgentAppTypeGuidMapping));

/** Map for all agent app type strings. Returns app type guid. */
export const AgentAppTypeStrings = new Map(Object.entries(AgentAppTypeStringMapping));
