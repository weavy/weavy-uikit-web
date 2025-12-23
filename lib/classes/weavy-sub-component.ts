import { LitElement, PropertyValueMap } from "lit";
import { state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { WeavyContext, type WeavyType } from "../contexts/weavy-context";
import type { UserType } from "../types/users.types";
import { UserContext } from "../contexts/user-context";
import { ContextIdContext, type ContextIdType } from "../contexts/context-id-context";
import { WeavyComponentContextProps } from "../types/component.types";

export class WeavySubComponent extends LitElement implements WeavyComponentContextProps {
  // CONTEXT PROVIDERS
  /**
   * @internal
   */
  @consume({ context: ContextIdContext, subscribe: true })
  @state()
  contextId: ContextIdType | undefined;

  /**
   * @internal
   */
  @consume({ context: UserContext, subscribe: true })
  @state()
  user: UserType | undefined;

  /**
   * @internal
   */
  @consume({ context: WeavyContext, subscribe: true })
  @state()
  weavy: WeavyType | undefined;

  // PROMISES
  // TODO: Switch to Promise.withResolvers() when allowed by typescript

  /**
   * Resolves when a contextual id is available.
   *
   * @internal
   * @returns {Promise<ContextIdType>}
   */
  async whenContextId() {
    return await this.#whenContextId;
  }
  #resolveContextId?: (contextId: ContextIdType) => void;
  #whenContextId = new Promise<ContextIdType>((r) => {
    this.#resolveContextId = r;
  });

  /**
   * Resolves when current user data is available.
   *
   * @internal
   * @returns {Promise<UserType>}
   */
  async whenUser() {
    return await this.#whenUser;
  }
  #resolveUser?: (user: UserType) => void;
  #whenUser = new Promise<UserType>((r) => {
    this.#resolveUser = r;
  });

  /**
   * Resolves when a weavy context is available.
   *
   * @internal
   * @returns {Promise<WeavyType>}
   */
  async whenWeavy() {
    return await this.#whenWeavy;
  }
  #resolveWeavy?: (weavy: WeavyType) => void;
  #whenWeavy = new Promise<WeavyType>((r) => {
    this.#resolveWeavy = r;
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

    if (changedProperties.has("contextId") && this.contextId) {
      if (changedProperties.get("contextId")) {
        // reset promise
        this.#whenContextId = new Promise<ContextIdType>((r) => {
          this.#resolveContextId = r;
        });
      }
      this.#resolveContextId?.(this.contextId);
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

    if (this.contextId) {
      this.requestUpdate("contextId");
    }

    if (this.user) {
      this.requestUpdate("user");
    }

    if (this.weavy) {
      this.requestUpdate("weavy");
    }
  }
}
