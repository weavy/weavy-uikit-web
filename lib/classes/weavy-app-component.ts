import { PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import { QueryController } from "../controllers/query-controller";
import {
  getAppSubscribeMutationOptions,
  getOrCreateAppOptions,
  type MutateAppSubscribeProps,
  type MutateAppSubscribeContextType,
} from "../data/app";
import { type AppType, AppContext } from "../contexts/app-context";
import { AppTypeGuid, LinkType, UnknownAppType } from "../types/app.types";
import { WyAppEventType } from "../types/app.events";
import { NamedEvent } from "../types/generic.types";
import { MutationController } from "../controllers/mutation-controller";
import { toIntOrString } from "../converters/string";
import { AgentAppTypeGuids, WeavyTypeComponent } from "./weavy-type-component";
import {
  WeavyAppComponentContextProps,
  WeavyComponentContextProps,
  WeavyComponentSettingProps,
  WeavyTypeComponentContextProps,
} from "../types/component.types";

export const UnknownApp: UnknownAppType = "unknown";

/**
 * Base class for exposed/public weavy components. This class provides common external properties and internal data provided as contexts for sub components.
 */
export class WeavyAppComponent
  extends WeavyTypeComponent
  implements
    WeavyComponentContextProps,
    WeavyTypeComponentContextProps,
    WeavyComponentSettingProps,
    WeavyAppComponentContextProps
{
  // CONTEXT PROVIDERS

  /**
   * The app data.
   *
   * @type {AppType | undefined}
   */
  @provide({ context: AppContext })
  @state()
  app: AppType | undefined;

  // @provide({ context: AgentContext })
  // @state()
  // agentUser: AgentType | undefined;

  /**
   * Sets the component to it's initial state and resets the app state.
   */
  reset() {
    if (this.app) {
      this.app = undefined;
    }

    if (this._appName !== this._initialAppName) {
      this._appName = this._initialAppName;
    }
  }

  /**
   * Checks if an entity matches the component configuration.
   *
   * @internal
   * @param link - Entity to check for a match.
   * @returns True if the entity targets this component.
   */
  override matchesLink(link?: LinkType): boolean {
    if (
      // Messenger conversation
      link?.app?.type &&
      !this.appType &&
      this.componentTypes?.includes(link.app.type)
    ) {
      return link.agent ? link.agent === this.agent : true;
    } else if (
      // Normal contextual app
      link &&
      link.app &&
      this.appType !== UnknownApp &&
      ((typeof this.uid === "string" && link.app?.uid === this.uid) || // Normal app with app uid
        (typeof this.uid === "number" && link.app?.id === this.uid) || // Normal app with app id
        (!this.uid && this.app && link.app.id === this.app.id)) // App without uid
    ) {
      return true;
    } else {
      // Not matching
      return false;
    }
  }

  /**
   * Any provided link that should be loaded, shown and highlighted.
   */
  @property({ type: Object })
  override set link(link: LinkType | undefined) {
    const oldLink = this._link;

    // If contextual app not configured yet
    if (!this.uid && this.appType && this.appType !== UnknownApp) {
      void this.whenApp().then(() => {
        this._link = this.matchesLink(link) ? link : undefined;
        this.requestUpdate("link", oldLink);
      });
    } else {
      this._link = this.matchesLink(link) ? link : undefined;
      this.requestUpdate("link", oldLink);
    }
  }
  override get link(): LinkType | undefined {
    return this._link;
  }

  // PROPERTIES
  /**
   * Any app type for the weavy component.
   *
   * @type {AppTypeGuid | UnknownAppType}
   */
  @state()
  protected appType?: AppTypeGuid | UnknownAppType;

  /**
   * Sets the uid property with automatically appended user and agent name (where applicable).
   */
  @property()
  generateUid?: string | null;

  /**
   * Required unique identifier or app id for the Weavy component. The unique identifier should correspond to the uid of the app created using the server-to-server Web API.
   */
  @property({ converter: toIntOrString })
  uid?: string | number | null;

  private _initialAppName?: string;
  private _appName?: string;

  /**
   * Optional display name for the app (used in notifications etc.)
   */
  @property({ type: String })
  set name(name: string | undefined) {
    this._initialAppName = name;
    this._appName = name;
  }
  get name(): string | undefined {
    return this._appName;
  }

  // APP SUBSCRIBE

  private appSubscribeMutation = new MutationController<
    void,
    Error,
    MutateAppSubscribeProps,
    MutateAppSubscribeContextType
  >(this);

  /**
   * Subscribes or unsubscribes to notification updates from the app. Check `.app.is_subscribed` to see current state.
   *
   * @param subscribe - Set to `false` to unsubscribe from updates. Defaults to `true`.
   * @returns {Promise<void>}
   *
   * @example <caption>Toggle app subscription</caption>
   * ```js
   * // Wait for app data
   * await myWeavyComponent.whenApp();
   *
   * // Get current app subscription state
   * const isSubscribed = myWeavyComponent.app.is_subscribed;
   *
   * // Toggle the app subscription state
   * myWeavyComponent.subscribe(!isSubscribed);
   * ```
   */
  async subscribe(subscribe: boolean = true) {
    if (!this.uid) {
      throw new Error(`Cannot ${subscribe ? "subscribe" : "unsubscribe"} without a uid.`);
    }
    await this.whenApp();
    if (this.app?.id) {
      void this.appSubscribeMutation.mutate({ subscribe });
    }
  }

  // PROMISES
  // TODO: Switch to Promise.withResolvers() when allowed by typescript
  // Promise.withResolvers() is available in ES2024, that needs to be set in TSConfig

  /**
   * Resolves when app data is available.
   *
   * @returns {Promise<AppType>}
   */
  async whenApp() {
    return await this.#whenApp;
  }
  #resolveApp?: (app: AppType) => void;
  #whenApp = new Promise<AppType>((r) => {
    this.#resolveApp = r;
  });

  // INTERNAL PROPERTIES

  #appQuery = new QueryController<AppType>(this);
  // #agentUserQuery = new QueryController<AgentType>(this);

  // DEPRECATED

  /**
   * DEPRECATED: Use `.generateUid`property instead.
   * @internal
   * @deprecated
   */
  @property()
  autoUid?: string | null;

  override connectedCallback(): void {
    super.connectedCallback();

    if (this.app) {
      this.requestUpdate("app");
    }
  }

  protected override async willUpdate(changedProperties: PropertyValues): Promise<void> {
    await super.willUpdate(changedProperties);

    // DEPRECATIONS

    if (changedProperties.has("autoUid") && typeof this.autoUid === "string") {
      console.error(`Using .autoUid property is deprecated. Use .generateUid = "${this.autoUid}"; instead`);
      this.generateUid = this.autoUid;
    }

    // DEPRECATIONS END

    // Generate UID using generateUid?
    if (
      (changedProperties.has("generateUid") || changedProperties.has("user") || changedProperties.has("agent")) &&
      this.generateUid &&
      this.user &&
      ((this.appType && AgentAppTypeGuids.has(this.appType) && this.agent) ||
        (this.appType && !AgentAppTypeGuids.has(this.appType)))
    ) {
      const uidParts: (string | number)[] = [this.generateUid];

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
      changedProperties.has("appType") ||
      changedProperties.has("uid") ||
      changedProperties.has("agent") ||
      changedProperties.has("weavy")
    ) {
      // Reset app name
      if (this._appName !== this._initialAppName) {
        this._appName = this._initialAppName;
        this.requestUpdate("name", oldName);
      }
    }

    if (
      changedProperties.has("appType") ||
      changedProperties.has("uid") ||
      changedProperties.has("agent") ||
      changedProperties.has("name") ||
      changedProperties.has("weavy")
    ) {
      if (this.appType && this.uid && this.weavy) {
        const appData = this.name ? { name: this.name } : undefined;
        const appMembers = this.agent ? [this.agent] : undefined;
        await this.#appQuery.trackQuery(getOrCreateAppOptions(this.weavy, this.uid, this.appType, appMembers, appData));
      } else {
        this.#appQuery.untrackQuery();
      }
    }

    if (!this.#appQuery.result?.isPending) {
      this.app = this.#appQuery.result?.data;
      if (this.app?.name && this._appName !== this.app.name) {
        this.name = this.app.name;
        this.requestUpdate("name", oldName);
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
      !this.link &&
      ((changedProperties.has("uid") && this.uid) || (changedProperties.has("app") && this.app)) &&
      this.appType &&
      this.appType !== UnknownApp
    ) {
      //console.log("Checking for storage link", this.appTypes, this.agent);
      this.readStorageLink();
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

    // APP SUBSCRIBE

    if ((changedProperties.has("weavy") || changedProperties.has("app")) && this.weavy && this.app) {
      void this.appSubscribeMutation.trackMutation(getAppSubscribeMutationOptions(this.weavy, this.app));
    }
  }
}
