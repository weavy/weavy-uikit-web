import { PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import { QueryController } from "../controllers/query-controller";
import {
  getEnsureAppMutationOptions,
  getAppSubscribeMutationOptions,
  type MutateAppSubscribeProps,
  type MutateAppSubscribeContextType,
  mapMultipleAppsAsAppList,
  getAppOptions,
} from "../data/app";
import { AppContext, AppsContext } from "../contexts/apps-context";
import { AppListType, AppType, AppTypeGuid, LinkType, UnknownAppType } from "../types/app.types";
import { WyAppEventType } from "../types/app.events";
import { NamedEvent } from "../types/generic.types";
import { MutationController } from "../controllers/mutation-controller";
import type { MutationAbortProps } from "../types/query.types";
import { type WeavyType } from "../client/weavy";
import { toIntOrString } from "../converters/string";
import { AgentAppTypeGuids, WeavyTypeComponent } from "./weavy-type-component";
import {
  WeavyAppComponentContextProps,
  WeavyAppComponentProps,
  WeavyComponentContextProps,
  WeavyComponentSettingProps,
  WeavyTypeComponentContextProps,
} from "../types/component.types";
import { byWhitespace } from "../utils/strings";
import { onlyValues } from "../utils/data";

export const UnknownApp: UnknownAppType = "unknown";

/**
 * Base class for exposed/public weavy components. This class provides common external properties and internal data provided as contexts for sub components.
 */
export class WeavyAppComponent
  extends WeavyTypeComponent
  implements
    WeavyAppComponentProps,
    WeavyComponentContextProps,
    WeavyTypeComponentContextProps,
    WeavyComponentSettingProps,
    WeavyAppComponentContextProps
{
  // CONTEXT PROVIDERS

  /**
   * The current app data.
   *
   * @type {AppType | undefined}
   */
  @provide({ context: AppContext })
  @state()
  app: AppType | undefined;

  /**
   * A list of data for all the apps specified by the `uid` property.
   *
   * @type {AppListType | undefined}
   */
  @provide({ context: AppsContext })
  @state()
  apps: AppListType | undefined;

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

    if (this.apps) {
      this.apps = undefined;
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
    if (!this.appType) {
      return super.matchesLink(link);
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
   * Sets the uid property to a single uid with automatically appended user and agent name (where applicable).
   */
  @property()
  generateUid?: string | null;

  #uid?: string | number | null;
  #uids: Array<string | number> = [];

  /**
   * One or multiple unique app identifiers or app id:s. When a single uid is provided, the app gets automatically created on the server upon first request.
   */
  @property({ converter: toIntOrString })
  set uid(uid: string | number | null | undefined) {
    this.#uid = uid;
    if (typeof uid === "string") {
      this.#uids = uid
        .split(byWhitespace)
        .filter(onlyValues)
        .map((value) => toIntOrString(value) as string | number);
    } else if (uid) {
      this.#uids = [uid];
    } else {
      this.#uids = [];
    }
  }
  get uid() {
    return this.#uid;
  }

  /**
   * An array of parsed uids from the `uid` property.
   * @readonly
   */
  get uids() {
    return [...this.#uids];
  }

  /**
   * The currently selected app uid when multiple `uid` is provided. Defaults to the first uid from the `uid` property.
   */
  @property()
  currentUid: string | number | null | undefined = undefined;

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

  /**
   * Optional directory identifier (`id` or `name`) for the app.
   */
  @property({ type: String })
  directory?: string | number;

  // APP UPSERT

  /**
   * Upsert that makes sure the app exists. Kept beside the app query rather than inside it, see
   * `getEnsureAppMutationOptions()`.
   */
  #appUpsert = new MutationController<AppType, Error, MutationAbortProps, void>(this);

  /** The payload of the last upsert this component sent, used to avoid repeating an identical write. */
  #lastUpsertPayload?: string;

  /** The client and uid the app query is currently tracking, so identical options are not re-tracked. */
  #trackedApp?: { weavy: WeavyType; uid: string | number };

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
    if (!this.currentUid) {
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

  /**
   * Resolves when multiple apps is available.
   *
   * @returns {Promise<AppType[]>}
   */
  async whenApps() {
    return await this.#whenApps;
  }
  #resolveApps?: (apps: AppListType) => void;
  #whenApps = new Promise<AppListType>((r) => {
    this.#resolveApps = r;
  });

  // INTERNAL PROPERTIES

  #appQuery = new QueryController<AppType>(this);
  // #agentUserQuery = new QueryController<AgentType>(this);

  #multipleAppsQueryMap = new Map<string | number, QueryController<AppType>>();

  // Multiple app queries result mapping to a virtual AppsResultType query
  get #appsQuery() {
    return mapMultipleAppsAsAppList(this.#multipleAppsQueryMap);
  }

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

    if (changedProperties.has("uid") && this.uid) {
      if (!this.currentUid || (this.currentUid && !this.#uids.includes(this.currentUid))) {
        const firstUid = this.#uids[0];
        this.currentUid = firstUid;
      }
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
      changedProperties.has("currentUid") ||
      changedProperties.has("agent") ||
      changedProperties.has("directory") ||
      changedProperties.has("name") ||
      changedProperties.has("weavy")
    ) {
      const weavy = this.weavy;
      const appType = this.appType;
      const currentUid = this.currentUid;

      if (appType && currentUid && weavy) {
        // Only allow single-app initialization data when exactly one uid is specified.
        const allowAppDataChange = this.#uids.length === 1;

        if (!allowAppDataChange && this.name) {
          console.warn("Specifying a name for the app is not possible when using multiple uid.");
        }

        if (!allowAppDataChange && this.directory !== undefined && this.directory !== "") {
          console.warn("Specifying a directory for the app is not possible when using multiple uid.");
        }

        const appData =
          allowAppDataChange && (this.name || (this.directory !== undefined && this.directory !== ""))
            ? {
                ...(this.name ? { name: this.name } : undefined),
                ...(this.directory !== undefined && this.directory !== ""
                  ? { directory: this.directory.toString() }
                  : undefined),
              }
            : undefined;
        const appMembers = this.agent ? [this.agent] : undefined;

        const cachedApp =
          typeof currentUid === "string" ? weavy.queryClient.getQueryData<AppType>(["apps", currentUid]) : undefined;

        // "Ensure", not "upsert on every render". The app only needs writing when it is missing, or when what we would
        // send differs from what it already has. Without this the upsert repeats on every pass through this block,
        // including the one caused by `name` being reassigned from the app data below.
        //
        // `name` can be compared against the app itself. `directory` cannot — it is accepted when writing an app but
        // is not part of the app returned by the API — so for that we compare against the last payload this component
        // sent instead.
        const upsertPayload = JSON.stringify([currentUid, appType, appMembers, appData]);
        const appDataIsCurrent =
          !appData ||
          (cachedApp !== undefined &&
            (appData.name === undefined || appData.name === cachedApp.name) &&
            (appData.directory === undefined || upsertPayload === this.#lastUpsertPayload));

        // Creating the app is a write, so it runs as a mutation beside the query and seeds it on success rather than
        // being the query's `queryFn`. Only a known app type may create; an unknown type can merely look the app up,
        // and a numeric uid is an app id, which cannot be upserted.
        // Sending the same payload again is pointless whether the first one is still in flight or already done, and
        // this block runs several times per mount, so an identical payload is skipped regardless of cache state.
        const alreadySent = upsertPayload === this.#lastUpsertPayload;

        if (
          appType !== UnknownApp &&
          typeof currentUid === "string" &&
          !alreadySent &&
          !(cachedApp && appDataIsCurrent)
        ) {
          this.#lastUpsertPayload = upsertPayload;

          await this.#appUpsert.trackMutation(
            getEnsureAppMutationOptions(weavy, currentUid, appType, appMembers, appData),
          );

          // Deliberately not awaited. A mutation paused while offline never settles, and awaiting a network round trip
          // inside `willUpdate` would let a later update's `trackQuery` be overwritten by this one on resume, leaving
          // the component observing a uid it has already moved off.
          void this.#appUpsert.mutate({}).catch((error: unknown) => {
            // The app query is the single source of truth for what the component renders and already reports the app
            // as missing, so this only needs surfacing for diagnosis.
            console.warn(`Could not create app ${currentUid}.`, error);
          });
        }

        // Re-tracking builds a new observer and forces a fetch, so only do it when the query actually changes.
        // `getAppOptions()` depends on nothing but the client and the uid.
        if (this.#trackedApp?.weavy !== weavy || this.#trackedApp.uid !== currentUid) {
          this.#trackedApp = { weavy, uid: currentUid };
          // Not optimistic, for the same reason as the multiple-app queries below: several components can observe
          // one app, and a later one must not force a fetch over data an earlier one just put there.
          await this.#appQuery.trackQuery(getAppOptions(weavy, currentUid), false);
        }
      } else {
        this.#trackedApp = undefined;
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

    // Multiple app queries

    if (
      (changedProperties.has("uid") || changedProperties.has("weavy")) &&
      (this.uid || changedProperties.get("uid")) &&
      this.weavy
    ) {
      if (this.uids.length) {
        // Remove non-existing apps
        for (const [uid, query] of this.#multipleAppsQueryMap.entries()) {
          if (!this.uids.includes(uid)) {
            query.untrackQuery();
            this.#multipleAppsQueryMap.delete(uid);
          }
        }
        // add new apps
        this.uids.forEach((uid) => {
          if (!this.#multipleAppsQueryMap.has(uid) && this.weavy) {
            const query = new QueryController<AppType>(this);
            // Not optimistic: a second observer on a key another observer just populated must not force its own
            // fetch over data that is still fresh.
            void query.trackQuery(getAppOptions(this.weavy, uid), false);
            this.#multipleAppsQueryMap.set(uid, query);
          }
        });
      } else if (this.#multipleAppsQueryMap.size) {
        //untrack all
        this.#multipleAppsQueryMap.forEach((query) => query.untrackQuery());
        this.#multipleAppsQueryMap.clear();
      }
    }

    // Handle multiple apps result
    if (
      !this.#appsQuery.result.isPending &&
      (!this.apps || JSON.stringify(this.apps) !== JSON.stringify(this.#appsQuery.result.data?.data))
    ) {
      if (this.#appsQuery.result.data?.data) {
        const apps = this.#appsQuery.result.data?.data;
        const component = this;
        this.apps =
          apps &&
          Object.defineProperty([...apps], "current", {
            set(app: AppType | null | undefined) {
              component.app = app || undefined;
              component.currentUid = app?.uid || app?.id;
            },
            get() {
              return component.app || undefined;
            },
          });

        this.#resolveApps?.(this.apps);
      } else {
        this.apps = undefined;
      }
    }

    // Links
    if (
      changedProperties.has("currentUid") &&
      (this.currentUid || changedProperties.get("currentUid")) &&
      this.currentUid !== changedProperties.get("currentUid")
    ) {
      this.clearLink();
    }

    if (
      !this.link &&
      ((changedProperties.has("currentUid") && this.currentUid) || (changedProperties.has("app") && this.app)) &&
      this.appType &&
      this.appType !== UnknownApp
    ) {
      //console.log("Checking for storage link", this.appTypes, this.agent);
      this.link = this.weavy?.readStorageLink();
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
