import { PropertyValueMap } from "lit";
import { state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyComponentSettingsType, WeavyComponentSettingsContext } from "../contexts/settings-context";
import { type AppType, AppContext } from "../contexts/app-context";
import { type LinkType, LinkContext } from "../contexts/link-context";
import { type ComponentFeaturePolicy, FeaturePolicyContext } from "../contexts/features-context";
import { type ContextDataBlobsType, DataBlobsContext } from "../contexts/data-context";
import { WeavyAppComponentContextProps } from "../types/component.types";
import { WeavySubComponent } from "./weavy-sub-component";

export class WeavySubAppComponent extends WeavySubComponent implements WeavyAppComponentContextProps {
  // CONTEXT PROVIDERS
  /**
   * The app data.
   */
  @consume({ context: AppContext, subscribe: true })
  @state()
  app: AppType | undefined;

  // @consume({ context: AgentContext, subscribe: true })
  // @state()
  // agentUser: AgentType | undefined;

  /**
   * @internal
   */
  @consume({ context: DataBlobsContext, subscribe: true })
  @state()
  contextDataBlobs: ContextDataBlobsType | undefined;

  /**
   * @internal
   */
  @consume({ context: FeaturePolicyContext, subscribe: true })
  @state()
  componentFeatures: ComponentFeaturePolicy | undefined;

  /**
   * Any provided link that should be loaded, shown and highlighted.
   *
   */
  @consume({ context: LinkContext, subscribe: true })
  @state()
  link: LinkType | undefined;

  /**
   * @internal
   */
  @consume({ context: WeavyComponentSettingsContext, subscribe: true })
  @state()
  settings: WeavyComponentSettingsType | undefined;

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

  // #resolveAgentUser?: (agentUser: AgentType) => void;
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
   * Resolves when weavy component features config is available.
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
   * Resolves when weavy component settings are available.
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

  protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);

    // if (changedProperties.has("agentUser") && this.agentUser) {
    //   if (changedProperties.get("agentUser")) {
    //     // reset promise
    //     this.#whenAgentUser = new Promise<AgentType>((r) => {
    //       this.#resolveAgentUser = r;
    //     });
    //   }
    //   this.#resolveAgentUser?.(this.agentUser);
    // }

    if (changedProperties.has("app") && this.app) {
      if (changedProperties.get("app")) {
        // reset promise
        this.#whenApp = new Promise<AppType>((r) => {
          this.#resolveApp = r;
        });
      }
      this.#resolveApp?.(this.app);
    }

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
  }

  override connectedCallback(): void {
    super.connectedCallback();

    // if (this.agentUser) {
    //   this.requestUpdate("agentUser");
    // }

    if (this.app) {
      this.requestUpdate("app");
    }

    if (this.contextDataBlobs) {
      this.requestUpdate("contextDataBlobs");
    }

    if (this.componentFeatures) {
      this.requestUpdate("componentFeatures");
    }

    if (this.link) {
      this.requestUpdate("link");
    }

    if (this.settings) {
      this.requestUpdate("settings");
    }
  }
}
