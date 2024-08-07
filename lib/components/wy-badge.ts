import { LitElement, html, nothing, type PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../contexts/weavy-context";
import chatCss from "../scss/all";
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
  private weavyContext?: WeavyContextType;

  @property({ attribute: false, type: Boolean })
  private: boolean = true;

  @property({ attribute: false, type: Boolean })
  rooms: boolean = true;

  @property()
  bot?: string;

  badgeQuery = new QueryController<BadgeType>(this);

  private handleBadgeRefresh = () => {
    if (!this.badgeQuery.result.isRefetching) {
      this.badgeQuery.result.refetch();
    }
  };

  handleRealtimeMessage = (_realtimeEvent: RealtimeMessageEventType) => {
    this.handleBadgeRefresh();
  };

  handleRealtimeSeenBy = (_realtimeEvent: RealtimeConversationMarkedEventType) => {
    this.handleBadgeRefresh();
  };

  #unsubscribeToRealtime?: () => void;

  override async updated(changedProperties: PropertyValueMap<this & WeavyContextProps>) {
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.badgeQuery.trackQuery(getApiOptions(this.weavyContext, ["conversations", "badge"]));

      this.#unsubscribeToRealtime?.();

      this.weavyContext.subscribe(null, "message_created", this.handleRealtimeMessage);
      this.weavyContext.subscribe(null, "conversation_marked", this.handleBadgeRefresh);

      this.#unsubscribeToRealtime = () => {
        this.weavyContext?.unsubscribe(null, "message_created", this.handleRealtimeMessage);
        this.weavyContext?.unsubscribe(null, "conversation_marked", this.handleBadgeRefresh);
        this.#unsubscribeToRealtime = undefined;
      };
    }
  }

  override render() {
    const { data, isPending } = this.badgeQuery.result ?? {};
    const conversationBadge = data ? (this.private ? data.private : 0) + (this.rooms ? data.rooms : 0) : 0;
    const badge = this.bot ? (data ? data.bots : 0) : conversationBadge;

    return html`
      ${!isPending && badge > 0 ? html` <span class="wy-badge wy-badge-danger">${badge}</span> ` : nothing}
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
