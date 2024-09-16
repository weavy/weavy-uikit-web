import { LitElement, html, nothing, type PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import chatCss from "../scss/all.scss";
import { QueryController } from "../controllers/query-controller";
import { BadgeType } from "../types/badge.types";
import { getApiOptions } from "../data/api";
import { WeavyProps } from "../types/weavy.types";
import { RealtimeConversationMarkedEventType, RealtimeMessageEventType } from "../types/realtime.types";

@customElement("wy-badge")
export default class WyBadge extends LitElement {
  static override styles = chatCss;

  @consume({ context: WeavyContext, subscribe: true })
  @state()
  private weavy?: WeavyType;

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

  override async updated(changedProperties: PropertyValueMap<this & WeavyProps>) {
    if (changedProperties.has("weavy") && this.weavy) {
      this.badgeQuery.trackQuery(getApiOptions(this.weavy, ["conversations", "badge"]));

      this.#unsubscribeToRealtime?.();

      this.weavy.subscribe(null, "message_created", this.handleRealtimeMessage);
      this.weavy.subscribe(null, "conversation_marked", this.handleBadgeRefresh);

      this.#unsubscribeToRealtime = () => {
        this.weavy?.unsubscribe(null, "message_created", this.handleRealtimeMessage);
        this.weavy?.unsubscribe(null, "conversation_marked", this.handleBadgeRefresh);
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

  override connectedCallback(): void {
      super.connectedCallback();
      if (this.weavy) {
        this.requestUpdate("weavy");
      }
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
