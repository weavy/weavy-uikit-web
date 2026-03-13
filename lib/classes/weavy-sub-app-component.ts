import { PropertyValueMap } from "lit";
import { state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type AppType, AppContext, type AppListType, AppsContext } from "../contexts/apps-context";
import { WeavyAppComponentContextProps } from "../types/component.types";
import { WeavySubTypeComponent } from "./weavy-sub-type-component";

export class WeavySubAppComponent
  extends WeavySubTypeComponent
  implements WeavyAppComponentContextProps
{
  // CONTEXT PROVIDERS
  /**
   * The app data.
   */
  @consume({ context: AppContext, subscribe: true })
  @state()
  app: AppType | undefined;

  /**
   * Multiple apps data.
   */
  @consume({ context: AppsContext, subscribe: true })
  @state()
  apps: AppListType | undefined;

  // PROMISES
  // TODO: Switch to Promise.withResolvers() when allowed by typescript

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
   * Resolves when multiple app data is available.
   *
   * @returns {Promise<AppListType>}
   */
  async whenApps() {
    return await this.#whenApps;
  }
  #resolveApps?: (apps: AppListType) => void;
  #whenApps = new Promise<AppListType>((r) => {
    this.#resolveApps = r;
  });

  protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("app") && this.app) {
      if (changedProperties.get("app")) {
        // reset promise
        this.#whenApp = new Promise<AppType>((r) => {
          this.#resolveApp = r;
        });
      }
      this.#resolveApp?.(this.app);
    }

    if (changedProperties.has("apps") && this.apps) {
      if (changedProperties.get("apps")) {
        // reset promise
        this.#whenApps = new Promise<AppListType>((r) => {
          this.#resolveApps = r;
        });
      }
      this.#resolveApps?.(this.apps);
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();

    if (this.app) {
      this.requestUpdate("app");
    }

    if (this.apps) {
      this.requestUpdate("apps");
    }
  }
}
