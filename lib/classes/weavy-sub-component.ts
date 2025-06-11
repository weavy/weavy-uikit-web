import { LitElement, PropertyValueMap } from "lit";
import { state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyComponentSettingsType, WeavyComponentSettingsContext } from "../contexts/settings-context";
import { WeavyContext, type WeavyType } from "../contexts/weavy-context";

import type { UserType } from "../types/users.types";
import { type AppType, AppContext } from "../contexts/app-context";
import { type LinkType, LinkContext } from "../contexts/link-context";
import { UserContext } from "../contexts/user-context";
import { type ComponentFeaturePolicy, FeaturePolicyContext } from "../contexts/features-context";
import { WeavyComponentContextProps } from "./weavy-component";
import { type ContextDataBlobsType, DataBlobsContext } from "../contexts/data-context";
import { ContextIdContext, type ContextIdType } from "../contexts/context-id-context";

export class WeavySubComponent extends LitElement implements WeavyComponentContextProps {
  // CONTEXT PROVIDERS
  @consume({ context: AppContext, subscribe: true })
  @state()
  app: AppType | undefined;

  // @consume({ context: AgentContext, subscribe: true })
  // @state()
  // agentUser: AgentType | undefined;

  @consume({ context: DataBlobsContext, subscribe: true })
  @state()
  contextDataBlobs: ContextDataBlobsType | undefined;

  @consume({ context: ContextIdContext, subscribe: true })
  @state()
  contextId: ContextIdType | undefined;

  @consume({ context: FeaturePolicyContext, subscribe: true })
  @state()
  componentFeatures: ComponentFeaturePolicy | undefined;

  @consume({ context: LinkContext, subscribe: true })
  @state()
  link: LinkType | undefined;

  @consume({ context: WeavyComponentSettingsContext, subscribe: true })
  @state()
  settings: WeavyComponentSettingsType | undefined;

  @consume({ context: UserContext, subscribe: true })
  @state()
  user: UserType | undefined;

  @consume({ context: WeavyContext, subscribe: true })
  @state()
  weavy: WeavyType | undefined;

  // PROMISES
  // TODO: Switch to Promise.withResolvers() when allowed by typescript

  #resolveApp?: (app: AppType) => void;
  #whenApp = new Promise<AppType>((r) => {
    this.#resolveApp = r;
  });
  async whenApp() {
    return await this.#whenApp;
  }

  // #resolveAgentUser?: (agentUser: AgentType) => void;
  // #whenAgentUser = new Promise<AgentType>((r) => {
  //   this.#resolveAgentUser = r;
  // });
  // async whenAgentUser() {
  //   return await this.#whenAgentUser;
  // }

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

  constructor() {
    super();
  }

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
      this.#resolveWeavy?.(this.weavy);
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

    if (this.contextId) {
      this.requestUpdate("contextId");
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

    if (this.user) {
      this.requestUpdate("user");
    }

    if (this.weavy) {
      this.requestUpdate("weavy");
    }
  }
}
