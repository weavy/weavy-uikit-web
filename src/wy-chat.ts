import { customElement, property } from "lit/decorators.js";
import WyConversation from "./components/wy-conversation";
import { ThemeController } from "./controllers/theme-controller";
import { PropertyValues } from "lit";
import colorModes from "./scss/colormodes.scss";
import { QueryController } from "./controllers/query-controller";
import { ConversationType } from "./types/app.types";
import { getApiOptions } from "./data/api";
import { WeavyContextProps } from "./types/weavy.types";
import { RealtimeAppEventType, RealtimeMessageEventType, RealtimeReactionEventType } from "./types/realtime.types";

@customElement("wy-chat")
export default class WyChat extends WyConversation {
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
      this.conversationQuery.trackQuery(getApiOptions<ConversationType>(this.weavyContext, ["apps", this.uid]));
    }

    if (!this.conversationQuery.result?.isPending) {
      this.conversation = this.conversationQuery.result?.data;
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

  override disconnectedCallback(): void {
    if (this.weavyContext && this.conversation) {
      this.unsubscribeToChatRealtime(this.conversation);
    }
    super.disconnectedCallback();
  }
}
