import { WeavyType } from "../contexts";
import { WeavyComponentSettingsType } from "../contexts/settings-context";
import { AppListType, AppType, AppUidType, LinkType } from "./app.types";
import { ContextDataBlobsType, ContextIdType } from "./context.types";
import { EnterToSend } from "./editor.types";
import { ComponentFeaturePolicy } from "./features.types";
import { AnnotationsAppearanceType } from "./msg.types";
import { UserType } from "./users.types";
import type { LitElement } from "lit";

export interface WeavyComponentSettingProps {
  /**
   * Appearance of annotations.
   *
   * @type {"none" | "buttons-inline"}
   * @default "buttons-inline"
   */
  annotations: AnnotationsAppearanceType;

  /**
   * Enter-to-send keymap in the editor.
   *
   * - `never` - No keymap
   * - `modifier` - Mod+Enter
   * - `auto` - Mod+Enter on mobile. Enter on desktop.
   * - `always` - Mod+Enter and Enter for all.
   */
  enterToSend: EnterToSend;

  /**
   * A space separated string of available reaction emojis in unicode.
   */
  reactions: string;
}

export interface WeavyComponentContextProps {
  /**
   * Contextual guid that is unique for the component instance.
   */
  contextId: ContextIdType | undefined;

  /**
   * Resolves when a contextual id is available.
   *
   * @internal
   * @returns {Promise<ContextIdType>}
   */
  whenContextId(): Promise<ContextIdType>;

  /**
   * The current user.
   */
  user: UserType | undefined;

  /**
   * Resolves when current user data is available.
   *
   * @returns {Promise<UserType>}
   */
  whenUser(): Promise<UserType>;

  /**
   * The consumed weavy context.
   *
   */
  weavy: WeavyType | undefined;

  /**
   * Resolves when a weavy context is available.
   *
   * @returns {Promise<WeavyType>}
   */
  whenWeavy(): Promise<WeavyType>;

  /**
   * Resolves when the component has rendered first time.
   *
   * @returns {Promise<WeavyComponent | WeavySubComponent>}
   */
  whenReady(): Promise<LitElement & WeavyComponentContextProps>;
}

export interface WeavyTypeComponentContextProps {
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
   * @internal
   */
  contextDataBlobs: ContextDataBlobsType | undefined;

  /**
   * Resolves when context data blob uploads has finished.
   *
   * @internal
   * @returns {Promise<ContextDataBlobsType>}
   */
  whenContextDataBlobs(): Promise<ContextDataBlobsType>;

  /**
   * Policy for checking which features are available.
   * @internal
   */
  componentFeatures: ComponentFeaturePolicy | undefined;

  /**
   * Resolves when weavy component features config is available.
   *
   * @internal
   * @returns {Promise<ComponentFeaturePolicy>}
   */
  whenComponentFeatures(): Promise<ComponentFeaturePolicy>;

  /**
   * Any provided link that should be loaded, shown and highlighted.
   */
  link: LinkType | undefined;

  /**
   * Resolves when a provided link is available.
   *
   * @internal
   * @returns {Promise<LinkType>}
   */
  whenLink(): Promise<LinkType>;

  /**
   * The weavy component settings provided as a context on the component.
   */
  settings: WeavyComponentSettingsType | undefined;

  /**
   * Resolves when weavy component settings are available.
   *
   * @internal
   * @returns {Promise<WeavyComponentSettingsType>}
   */
  whenSettings(): Promise<WeavyComponentSettingsType>;
}

export interface WeavyAppComponentProps {
  /**
   * One or multiple unique app identifiers or app id:s. When a single uid is provided, the app gets automatically created on the server upon first request.  
   */
  uid: string | number | null | undefined;

  /**
   * An array of parsed uids from the `uid` property.
   */
  readonly uids: AppUidType[]

  /** 
   * The currently selected app uid when multiple `uid` is provided. Defaults to the first uid from the `uid` property.
   */
  currentUid: AppUidType | null | undefined;
}

export interface WeavyAppComponentContextProps {
  /**
   * The current app data.
   */
  app: AppType | undefined;
  
  /**
   * Resolves when app data is available.
   *
   * @returns {Promise<AppType>}
   */
  whenApp(): Promise<AppType>;

  /**
   * A list of data for all the apps specified by the `uid` property.
   */
  apps: AppListType | undefined;

  /**
   * Resolves when apps data is available.
   *
   * @returns {Promise<AppListType>}
   */
  whenApps(): Promise<AppListType>;
}
