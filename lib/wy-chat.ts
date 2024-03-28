import { customElement, property } from "lit/decorators.js";
import { ThemeController } from "./controllers/theme-controller";
import { PropertyValues, html } from "lit";
import colorModes from "./scss/colormodes"
import { QueryController } from "./controllers/query-controller";
import { AppTypes } from "./types/app.types";
import { ConversationType } from "./types/conversations.types";
import { WeavyContextProps } from "./types/weavy.types";
import { RealtimeAppEventType, RealtimeMessageEventType, RealtimeReactionEventType } from "./types/realtime.types";
import { getAppOptions } from "./data/app";

import WyConversation from "./components/wy-conversation";

@customElement("wy-chat")
export class WyChat extends WyConversation {
  static override styles = [...WyConversation.styles, colorModes];

  @property()
  uid?: string;

  /**
   * Event: New message created.
   * @event wy:message_created
   */
  realtimeMessageCreatedEvent = (realtimeEvent: RealtimeMessageEventType) =>{
    if (
      !this.weavyContext ||
      !this.conversation ||
      !this.user ||
      realtimeEvent.message.app_id !== this.conversation.id ||
      realtimeEvent.message.created_by_id === this.user.id
    ) {
      return;
    }

    this.dispatchEvent(new CustomEvent("wy:message_created", { bubbles: true, composed: false, detail: realtimeEvent }));
  }

  /**
   * Event: Message reaction added.
   * @event wy:reaction_added
   */
  realtimeReactionAddedEvent = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavyContext || !this.user || !this.conversation || realtimeEvent.actor.id === this.user.id) {
      return;
    }
    
    this.dispatchEvent(new CustomEvent("wy:reaction_added", { bubbles: true, composed: false, detail: realtimeEvent }));
  }

  /**
   * Event: Message reaction removed.
   * @event wy:reaction_removed
   */
  realtimeReactionRemovedEvent = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavyContext || !this.conversation || !this.user || realtimeEvent.actor.id === this.user.id) {
      return;
    }
    this.dispatchEvent(new CustomEvent("wy:reaction_removed", { bubbles: true, composed: false, detail: realtimeEvent }));
  }

  /**
   * Event: Conversation app details updated.
   * @event wy:app_updated
   */
  realtimeAppUpdatedEvent = (realtimeEvent: RealtimeAppEventType) => {
    if (!this.conversation || realtimeEvent.app.id !== this.conversation.id) {
      return;
    }
    
    this.dispatchEvent(new CustomEvent("wy:app_updated", { bubbles: true, composed: false, detail: realtimeEvent }));
  }

  private conversationQuery = new QueryController<ConversationType>(this);

  constructor() {
    super();
    new ThemeController(this, WyChat.styles);
  }

  protected override async willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if ((changedProperties.has("weavyContext") || changedProperties.has("uid")) && this.weavyContext && this.uid) {
      this.conversationQuery.trackQuery(getAppOptions<ConversationType>(this.weavyContext, this.uid, AppTypes.Chat));
    }

    if (!this.conversationQuery.result?.isPending) {
      this.conversation = this.conversationQuery.result?.data;
      this.conversationId = this.conversation?.id; // TODO: use uid?
    }

    if ((changedProperties.has("weavyContext") || changedProperties.has("conversation"))  && this.weavyContext && this.conversation) {
      // realtime
      this.weavyContext.subscribe(`a${this.conversation.id}`, "message_created", this.realtimeMessageCreatedEvent);
      this.weavyContext.subscribe(`a${this.conversation.id}`, "reaction_added", this.realtimeReactionAddedEvent);
      this.weavyContext.subscribe(`a${this.conversation.id}`, "reaction_removed", this.realtimeReactionRemovedEvent);
      this.weavyContext.subscribe(`a${this.conversation.id}`, "app_updated", this.realtimeAppUpdatedEvent);
    }

    super.willUpdate(changedProperties);
  }

  private unsubscribeToChatRealtime(conversation: ConversationType) {
    if (!this.weavyContext) {
      return;
    }

    this.weavyContext.unsubscribe(`a${conversation.id}`, "message_created", this.realtimeMessageCreatedEvent);
    this.weavyContext.unsubscribe(`a${conversation.id}`, "reaction_added", this.realtimeReactionAddedEvent);
    this.weavyContext.unsubscribe(`a${conversation.id}`, "reaction_removed", this.realtimeReactionRemovedEvent);
    this.weavyContext.unsubscribe(`a${conversation.id}`, "app_updated", this.realtimeAppUpdatedEvent);
  }

  override render() {
      return html`
      <div class="wy-messenger-conversation wy-scroll-y">
        ${super.render()}
      </div>
      `
  }

  override disconnectedCallback(): void {
    if (this.weavyContext && this.conversation) {
      this.unsubscribeToChatRealtime(this.conversation);
    }
    super.disconnectedCallback();
  }
}
