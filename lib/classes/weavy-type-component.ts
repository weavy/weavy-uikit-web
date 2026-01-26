import { PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import {
  type WeavyComponentSettingsType,
  WeavyComponentSettingsContext,
  WeavyComponentSettings,
} from "../contexts/settings-context";
import { defaultVisibilityCheckOptions } from "../utils/dom";
import { type ComponentFeaturePolicy, Feature, FeaturePolicyContext } from "../contexts/features-context";
import {
  AppTypeString,
  AppTypeGuid,
  AppTypeGuidMapping,
  AppTypeStringMapping,
  LinkType,
  AgentAppTypeGuidMapping,
  AgentAppTypeStringMapping,
} from "../types/app.types";
import { LinkContext } from "../contexts/link-context";
import { getStorage } from "../utils/data";
import type { WyLinkEventType, WyNotificationEventType } from "../types/notifications.events";
import { asArray, findAsyncSequential, objectAsIterable } from "../utils/objects";
import { ComponentFeatures } from "../contexts/features-context";
import { WeavyClient } from "../client/weavy";
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
import type { AnnotationsAppearanceType } from "../types/msg.types";
import type { EnterToSend } from "../types/editor.types";
import { WeavyComponent } from "./weavy-component";
import {
  WeavyTypeComponentContextProps,
  WeavyComponentSettingProps,
  WeavyComponentContextProps,
} from "../types/component.types";

/**
 * Base class for exposed/public weavy components. This class provides common external properties and internal data provided as contexts for sub components.
 */
export class WeavyTypeComponent
  extends WeavyComponent
  implements WeavyComponentContextProps, WeavyTypeComponentContextProps, WeavyComponentSettingProps
{
  constructor() {
    super();

    // PROPERTY INIT
    /**
     * The weavy component settings provided as a context on the component.
     * @internal
     */
    this.settings = new WeavyComponentSettings(this);
  }

  /** @internal */
  protected storage = getStorage("localStorage");

  // CONTEXT PROVIDERS

  // @provide({ context: AgentContext })
  // @state()
  // agentUser: AgentType | undefined;

  /**
   * Uploaded context data blob ids.
   * @internal
   *
   * @type {ContextDataBlobsType | undefined}
   */
  @provide({ context: DataBlobsContext })
  @state()
  contextDataBlobs: ContextDataBlobsType | undefined;

  /**
   * Policy for checking which features are available.
   * @internal
   *
   * @type {ComponentFeaturePolicy | undefined}
   */
  @provide({ context: FeaturePolicyContext })
  @state()
  componentFeatures: ComponentFeaturePolicy | undefined;

  /**
   * The weavy component settings provided as a context on the component.
   *
   * @type {WeavyComponentSettingsType}
   */
  @provide({ context: WeavyComponentSettingsContext })
  @state()
  settings: WeavyComponentSettingsType;

  /**
   * Checks if an entity matches the component configuration.
   *
   * @internal
   * @param link - Entity to check for a match.
   * @returns True if the entity targets this component.
   */
  matchesLink(link?: LinkType): boolean {
    if (
      // Type app match, like the Messenger
      link?.app?.type &&
      this.componentTypes?.includes(link.app.type)
    ) {
      return link.agent ? link.agent === this.agent : true;
    } else {
      // Not matching
      return false;
    }
  }

  /**
   * Any provided link that should be loaded, shown and highlighted; provided through context.
   * @internal
   */
  @provide({ context: LinkContext })
  protected _link: LinkType | undefined;

  /**
   * Any provided link that should be loaded, shown and highlighted.
   */
  @property({ type: Object })
  set link(link: LinkType | undefined) {
    const oldLink = this._link;
    this._link = this.matchesLink(link) ? link : undefined;
    this.requestUpdate("link", oldLink);
  }
  get link(): LinkType | undefined {
    return this._link;
  }

  /**
   * Clears the link and resets the promise.
   *
   * @internal
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
   * @param link - The entity to provide.
   * @internal
   */
  protected provideStorageLink(link: LinkType) {
    this.storage?.setItem("wy-link", btoa(JSON.stringify(link)));
  }

  /**
   * Reads a link from storage and exposes it via the link property and context.
   *
   * @internal
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
   * Consumes a link in storage. Make sure to consume it after it has been used.
   *
   * @internal
   */
  protected consumeStorageLink() {
    this.storage?.removeItem("wy-link");
  }

  /**
   * Handles storage update events.
   *
   * @param e - `storage` event.
   * @internal
   */
  protected storageLinkHandler = (e: StorageEvent) => {
    if (e.storageArea === this.storage && e.key === "wy-link" && e.newValue) {
      //console.log("storage updated with wy-link", e.newValue);
      this.readStorageLink();
    }
  };

  /**
   * Handler for reacting to the `wy-link` event.
   *
   * @param e - `wy-link` event.
   * @internal
   */
  protected linkEventHandler = async (e: WyLinkEventType) => {
    if (!e.defaultPrevented && e.detail.link) {
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

  /**
   * Element to match visibility on.
   */
  protected get visibilityElement(): Element | undefined { 
    return this; 
  }

  /**
   * Handler for reacting to the `wy-notification` event. Consumes the event when the related component is visible.
   *
   * @param e - `wy-notification` event.
   * @internal
   */
  protected notificationEventConsumer = (e: WyNotificationEventType) => {
    e.stopPropagation();
    if (!e.defaultPrevented) {
      // Check if notification belongs to this component and if it can be ignored
      if (this.visibilityElement && this.visibilityElement.isConnected && this.visibilityElement.checkVisibility(defaultVisibilityCheckOptions) && this.matchesLink(e.detail.link)) {
        // Prevent the notification from showing
        e.preventDefault();
      }
    }
  };

  // PROPERTIES

  /**
   * Any app types handled by the component.
   *
   * @type {AppTypeGuid[]}
   */
  @state()
  protected componentTypes?: AppTypeGuid[];

  /**
   * Config for only enabling specific features in the weavy component.
   */
  @property()
  features?: string;

  /** @internal */
  protected _agentUid?: string;

  /**
   * The configured uid of the agent for the weavy component.
   */
  @property({ type: String })
  set agent(agent: string | null | undefined) {
    this._agentUid = agent || undefined;
  }
  get agent(): string | undefined {
    return this._agentUid;
  }

  /**
   * Contextual data for agents to reference. Provide descriptive data for optimal results.
   *
   * @example
   * ```js
   * myComponent.contextualData = `
   *  Country data:
   *  ${serializedCountryData}
   * `;
   * ```
   */
  @property({
    attribute: true,
    type: String,
  })
  contextualData?: string;

  // DEPRECATED .data property
  #data?: ContextDataType[];

  /**
   * DEPRECATED: Use `.contextualData` property instead.
   *
   * Array with contextual data.
   *
   * *Note: Only the first item in the array is currently used.*
   * @internal
   * @deprecated
   */
  @property({
    attribute: true,
    type: String,
    converter: {
      fromAttribute(value) {
        return asArray(value);
      },
    },
  })
  set data(data: ContextDataType[]) {
    console.warn(".data property array is deprecated. Use .contextualData string instead.");
    this.#data = data;
  }
  /**
   * DEPRECATED: Use `.contextualData` property instead.
   *
   * Array with contextual data.
   *
   * *Note: Only the first item in the array is currently used.*
   * @internal
   * @deprecated
   */
  get data(): ContextDataType[] | undefined {
    return this.#data;
  }

  // APP SUBSCRIBE

  // SETTINGS

  // annotations
  #annotations?: WeavyComponentSettingProps["annotations"];

  /**
   * Appearance of annotations.
   *
   * @type {"none" | "buttons-inline"}
   * @default "buttons-inline"
   */
  @property({ type: String })
  set annotations(annotations: AnnotationsAppearanceType) {
    this.#annotations = annotations;
  }
  get annotations(): AnnotationsAppearanceType {
    return this.#annotations ?? this.weavy?.annotations ?? WeavyClient.defaults.annotations;
  }

  // enterToSend
  #enterToSend?: EnterToSend;

  /**
   * Enter-to-send keymap in the editor. `"modifier"` is `Enter` combined with `Ctrl` or `Cmd`.
   *
   * @type {"never" | "modifier" | "auto" | "always"}
   * @default "auto"
   */
  @property({ type: String })
  set enterToSend(enterToSend: EnterToSend) {
    this.#enterToSend = enterToSend;
  }
  get enterToSend(): EnterToSend {
    return this.#enterToSend ?? this.weavy?.enterToSend ?? WeavyClient.defaults.enterToSend;
  }

  // reactions
  #reactions?: WeavyComponentSettingProps["reactions"];

  /**
   * A space separated string of available reaction emojis in unicode.
   *
   * @default "😍 😎 😉 😜 👍"
   */
  @property({ type: String })
  set reactions(reactions: string) {
    this.#reactions = reactions;
  }
  get reactions(): string {
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

  /**
   * Resolves when context data blob uploads has finished.
   *
   * @internal
   * @returns {Promise<ContextDataBlobsType>}
   */
  async whenContextDataBlobs() {
    return await this.#whenContextDataBlobs;
  }
  #resolveContextDataBlobs?: (blobs: ContextDataBlobsType) => void;
  #whenContextDataBlobs = new Promise<ContextDataBlobsType>((r) => {
    this.#resolveContextDataBlobs = r;
  });

  /**
   * Resolves when Weavy component features config is available.
   *
   * @internal
   * @returns {Promise<ComponentFeaturePolicy>}
   */
  async whenComponentFeatures() {
    return await this.#whenComponentFeatures;
  }
  #resolveComponentFeatures?: (componentFeatures: ComponentFeaturePolicy) => void;
  #whenComponentFeatures = new Promise<ComponentFeaturePolicy>((r) => {
    this.#resolveComponentFeatures = r;
  });

  /**
   * Resolves when a provided link is available.
   *
   * @internal
   * @returns {Promise<LinkType>}
   */
  async whenLink() {
    return await this.#whenLink;
  }
  #resolveLink?: (link: LinkType) => void;
  #whenLink = new Promise<LinkType>((r) => {
    this.#resolveLink = r;
  });

  /**
   * Resolves when Weavy component settings are available.
   *
   * @internal
   * @returns {Promise<WeavyComponentSettingsType>}
   */
  async whenSettings() {
    return await this.#whenSettings;
  }
  #resolveSettings?: (settings: WeavyComponentSettingsType) => void;
  #whenSettings = new Promise<WeavyComponentSettingsType>((r) => {
    this.#resolveSettings = r;
  });

  // INTERNAL PROPERTIES

  // #agentUserQuery = new QueryController<AgentType>(this);

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
   * DEPRECATED: Use `.agent` property instead.
   * @internal
   * @deprecated
   */
  @property()
  bot?: string;

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("wy-link", this.linkEventHandler);
    window.addEventListener("storage", this.storageLinkHandler);

    // if (this.agentUser) {
    //   this.requestUpdate("agentUser");
    // }

    if (this.componentFeatures) {
      this.requestUpdate("componentFeatures");
    }

    if (this.contextDataBlobs) {
      this.requestUpdate("contextDataBlobs");
    }

    if (this.link) {
      this.requestUpdate("link");
    }

    if (this.settings) {
      this.requestUpdate("settings");
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("wy-link", this.linkEventHandler);
    window.removeEventListener("storage", this.storageLinkHandler);
    this.weavy?.host.removeEventListener("wy-notification", this.notificationEventConsumer, { capture: true });
  }

  protected override async willUpdate(changedProperties: PropertyValues): Promise<void> {
    await super.willUpdate(changedProperties);

    // DEPRECATIONS

    if (changedProperties.has("bot") && typeof this.bot === "string") {
      console.error(`Using .bot property is deprecated. Use .agent = "${this.bot}"; instead`);
    }

    // DEPRECATIONS END

    const settingKeys = Object.keys(this.settings);
    if (changedProperties.has("weavy") || settingKeys.find((setting) => changedProperties.has(setting as keyof this))) {
      this.settings = new WeavyComponentSettings(this);
    }

    if (changedProperties.has("features") && this.componentFeatures) {
      this.componentFeatures.setAllowedFeatures(this.features);

      if (this.componentFeatures instanceof ComponentFeatures) {
        // Immutable update
        this.componentFeatures = this.componentFeatures.immutable();
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
    if (
      changedProperties.has("contextualData") ||
      changedProperties.has("data") ||
      changedProperties.has("componentFeatures")
    ) {
      // Provide as array for processing
      // DEPRECATED: this.data
      const contextualData = this.contextualData ? [this.contextualData] : this.data ? this.data : [];

      // Process array of contextual data
      const prevContextDataRefs = this.#contextDataRefs;
      this.#contextDataRefs = new Map();

      // Add items
      contextualData.forEach((dataItem) => {
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

    if ((changedProperties.has("componentTypes") || changedProperties.has("agent")) && this.componentTypes) {
      //console.log("Checking for storage link", this.appTypes, this.agent);
      this.readStorageLink();
    }

    if (changedProperties.has("link") && this.link) {
      console.info(`Opening notification link`);
      this.consumeStorageLink();
    }

    // Promises

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

    if (changedProperties.has("weavy") && this.weavy) {
      this.weavy.host.addEventListener("wy-notification", this.notificationEventConsumer, { capture: true });
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
