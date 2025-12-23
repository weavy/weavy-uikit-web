import { LitElement, PropertyValues } from "lit";
import { state } from "lit/decorators.js";
import { ContextConsumer, provide } from "@lit/context";
import { whenParentsDefined } from "../utils/dom";
import { WeavyContext, type WeavyType } from "../contexts/weavy-context";
import type { UserType } from "../types/users.types";
import { QueryController } from "../controllers/query-controller";
import { getApiOptions } from "../data/api";
import { UserContext } from "../contexts/user-context";
import { ContextIdContext, type ContextIdType } from "../contexts/context-id-context";
import { v4 as uuid_v4 } from "uuid";
import type { WeavyComponentContextProps } from "../types/component.types";

/**
 * Base class for exposed/public weavy components. This class provides common external properties and internal data provided as contexts for sub components.
 */
export class WeavyComponent extends LitElement implements WeavyComponentContextProps {

  // CONTEXT CONSUMERS
  /** @internal */
  protected weavyContextConsumer?: ContextConsumer<{ __context__: WeavyType }, this>;

  /**
   * The consumed weavy context.
   */
  @state()
  weavy: WeavyType | undefined;

  // CONTEXT PROVIDERS

  /**
   * Contextual guid that is unique for the client context.
   *
   * @type {ContextIdType}
   */
  @provide({ context: ContextIdContext })
  @state()
  contextId: ContextIdType = uuid_v4();

  /**
   * The current user.
   *
   * @type {UserType | undefined}
   */
  @provide({ context: UserContext })
  @state()
  user: UserType | undefined;

  // PROPERTIES

  // PROMISES
  // TODO: Switch to Promise.withResolvers() when allowed by typescript
  // Promise.withResolvers() is available in ES2024, that needs to be set in TSConfig

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
   * @returns {Promise<WeavyType>}
   */
  async whenWeavy() {
    return await this.#whenWeavy;
  }
  #resolveWeavy?: (weavy: WeavyType) => void;
  #whenWeavy = new Promise<WeavyType>((r) => {
    this.#resolveWeavy = r;
  });

  // INTERNAL PROPERTIES

  #userQuery = new QueryController<UserType>(this);

  override connectedCallback(): void {
    super.connectedCallback();

    // if (this.agentUser) {
    //   this.requestUpdate("agentUser");
    // }

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

    // Promises

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
}
