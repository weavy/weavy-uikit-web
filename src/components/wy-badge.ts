import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import chatCss from "../scss/all.scss";
import { QueryController } from "../controllers/query-controller";
import { BadgeType } from "../types/badge.types";
import { getApiOptions } from "../data/api";
import { WeavyContextProps } from "../types/weavy.types";
import { RealtimeConversationMarkedEventType, RealtimeMessageEventType } from "../types/realtime.types";

@customElement("wy-badge")
export default class WyBadge extends LitElement {
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ attribute: false, type: Boolean })
  private: boolean = true;

  @property({ attribute: false, type: Boolean })
  rooms: boolean = true;

  badgeQuery = new QueryController<BadgeType>(this);

  private handleBadgeRefresh = () => {
    setTimeout(() => this.badgeQuery.result.refetch(), 500);
  };

  /**
   * Event: New message created.
   * @event wy:message_created
   */
  realtimeMessageCreatedEvent = (realtimeEvent: RealtimeMessageEventType) =>
    new CustomEvent("wy:message_created", { bubbles: true, composed: false, detail: realtimeEvent });

  /**
   * Event: Message seen-by status updated.
   * @event wy:conversation_marked
   */
  realtimeConversationMarkedEvent = (realtimeEvent: RealtimeConversationMarkedEventType) =>
    new CustomEvent("wy:conversation_marked", { bubbles: true, composed: false, detail: realtimeEvent });

  handleRealtimeMessage = (realtimeEvent: RealtimeMessageEventType) => {
    this.handleBadgeRefresh();
    this.dispatchEvent(this.realtimeMessageCreatedEvent(realtimeEvent));
  };
  handleRealtimeSeenBy = (realtimeEvent: RealtimeConversationMarkedEventType) => {
    this.handleBadgeRefresh();
    this.dispatchEvent(this.realtimeConversationMarkedEvent(realtimeEvent));
  };

  override async updated(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.badgeQuery.trackQuery(getApiOptions(this.weavyContext, ["conversations", "badge"]));

      this.weavyContext.subscribe(null, "message_created", this.handleRealtimeMessage);
      this.weavyContext.subscribe(null, "conversation_marked", this.handleBadgeRefresh);
    }
  }

  override render() {
    const { data, isPending } = this.badgeQuery.result ?? {};
    const badge = data ? (this.private ? data.private : 0) + (this.rooms ? data.rooms : 0) : 0;

    return html`
      ${!isPending && badge > 0 ? html` <span class="wy-badge wy-badge-danger">${badge}</span> ` : nothing}
    `;
  }
}
