import { LitElement, html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import chatCss from "../scss/all.scss";
import { QueryController } from "../controllers/query-controller";
import { WeavyProps } from "../types/weavy.types";
import { RealtimeAppMarkedEventType, RealtimeMessageEventType } from "../types/realtime.types";
import { getBadgeOptions } from "../data/app";
import { AppsResultType, AppTypeGuid } from "../types/app.types";

@customElement("wy-messenger-badge")
export default class WyMessengerBadge extends LitElement {
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

  badgeQuery = new QueryController<AppsResultType>(this);

  private handleBadgeRefresh = async () => {
    if (!this.badgeQuery.result.isRefetching) {
      await this.badgeQuery.result.refetch();
    }
  };

  handleRealtimeMessage = (_realtimeEvent: RealtimeMessageEventType) => {
    this.handleBadgeRefresh();
  };

  handleRealtimeSeenBy = (_realtimeEvent: RealtimeAppMarkedEventType) => {
    this.handleBadgeRefresh();
  };

  #unsubscribeToRealtime?: () => void;

  override async willUpdate(changedProperties: PropertyValueMap<this & WeavyProps>) {
    if (changedProperties.has("weavy") && this.weavy) {
      const typeFilter = [];

      if (this.rooms) {
        typeFilter.push(AppTypeGuid.ChatRoom);
      }

      if (this.private) {
        typeFilter.push(AppTypeGuid.PrivateChat);
      }

      if (this.bot) {
        typeFilter.push(AppTypeGuid.BotChat);
      }

      this.badgeQuery.trackQuery(getBadgeOptions(this.weavy, typeFilter, this.bot), true);

      this.#unsubscribeToRealtime?.();

      this.weavy.subscribe(null, "message_created", this.handleRealtimeMessage);
      this.weavy.subscribe(null, "app_marked", this.handleBadgeRefresh);

      this.#unsubscribeToRealtime = () => {
        this.weavy?.unsubscribe(null, "message_created", this.handleRealtimeMessage);
        this.weavy?.unsubscribe(null, "app_marked", this.handleBadgeRefresh);
        this.#unsubscribeToRealtime = undefined;
      };
    }
  }

  override render() {
    const { data, isPending } = this.badgeQuery.result ?? {};

    const count = data ? data.count : 0;

    return html`
      ${!isPending && count > 0 ? html` <span class="wy-badge wy-badge-danger wy-badge-reveal">${count}</span> ` : nothing}
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
