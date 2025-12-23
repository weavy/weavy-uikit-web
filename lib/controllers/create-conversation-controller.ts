import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";
import { NamedEvent } from "../types/generic.types";
import { ContextConsumer } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { whenParentsDefined } from "../utils/dom";
import { AppType, AppTypeString } from "../types/app.types";
import { CreateAppMutationType, getCreateAppMutation } from "../data/app";
import { WyActionEventType } from "../types/action.events";
import { ActionType } from "../types/action.types";

export interface CreateConversationProps {
  /**
   * Optional agent uid to use.
   */
  agent?: string;
}

/**
 * Lit element controller for creating a conversation app.
 *
 * - Requires a weavy context.
 * - May use members and an agent.
 *
 * @fires {WyActionEventType} wy-selected - Emitted when a conversation app is created and should be selected.
 */
export class CreateConversationController implements ReactiveController {
  host: LitElement & ReactiveControllerHost;

  /**
   * Explicit agent id for agent mode. This is also checked for directly on the host.
   */
  agent?: string;

  private addConversationMutation?: CreateAppMutationType;

  // Weavy context
  protected weavyContext?: ContextConsumer<{ __context__: WeavyType }, LitElement>;
  protected whenWeavyContext: Promise<WeavyType>;
  protected resolveWeavyContext?: (value: WeavyType | PromiseLike<WeavyType>) => void;

  protected get weavy() {
    return this.weavyContext?.value;
  }

  constructor(host: LitElement) {
    host.addController(this);
    this.host = host;
    this.whenWeavyContext = new Promise((r) => (this.resolveWeavyContext = r));
    void this.setContexts();
  }

  /**
   * Initiates context consumers
   */
  protected async setContexts() {
    await whenParentsDefined(this.host as LitElement);
    this.weavyContext = new ContextConsumer(this.host as LitElement, { context: WeavyContext, subscribe: true });
  }

  /**
   * Dispatch a `wy-action` event on the host.
   *
   * @fires {WyActionEventType} wy-action - Emitted when a conversation app is created and should be selected.
   */
  protected dispatchActionEvent(conversation: AppType) {
    const eventAction: WyActionEventType = new (CustomEvent as NamedEvent)("wy-action", {
      detail: { action: ActionType.Select, app: conversation },
      bubbles: true,
      composed: true,
    });
    return this.host.dispatchEvent(eventAction);
  }

  /**
   * Create mutation controller.
   */
  protected async initMutation() {
    if (!this.addConversationMutation) {
      const weavy = await this.whenWeavyContext;
      this.addConversationMutation = getCreateAppMutation(weavy);
    }
    return this.addConversationMutation;
  }

  /**
   * Create a conversation and trigger a `select` event.
   *
   * @param members - Array of members by id/uid for a new conversation.
   * @returns Whether the event was successful.
   * @fires {WyActionEventType} wy-action - Emitted when a conversation app is created and should be selected.
   */
  async create(members: (number | string)[] = []): Promise<AppType> {
    const addConversationMutation = await this.initMutation();

    const agent = this.agent ?? (this.host as CreateConversationProps).agent;

    const memberOptions = agent
      ? { members: [agent], type: AppTypeString.AgentChat }
      : { members, type: members.length === 1 ? AppTypeString.PrivateChat : AppTypeString.ChatRoom };

    // create conversation
    const conversation = await addConversationMutation.mutate(memberOptions);

    this.dispatchActionEvent(conversation)
    
    return conversation;
  }

  hostUpdate(): void {
    // Resolve any context promises
    if (this.weavyContext?.value) {
      this.resolveWeavyContext?.(this.weavyContext?.value);
    }
  }
}
