import { LitElement, html, nothing, type PropertyValueMap } from "lit";
import { customElement, property } from "lit/decorators.js";
import chatCss from "../scss/all";
import { localized } from "@lit/localize";
import { WeavyContextProps } from "../types/weavy.types";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { NotificationTypes, NotificationsResultType } from "../types/notifications.types";
import {
  getBadgeOptions,
} from "../data/notifications";
import { QueryController } from "../controllers/query-controller";
import { hostContents } from "../scss/host";


@customElement("wy-notification-badge")
@localized()
export default class WyNotificationBadge extends BlockConsumerMixin(LitElement) {
  static override styles = [
    chatCss,
    hostContents
  ];
  protected exportParts = new ShadowPartsController(this);

  @property()
  typeFilter: NotificationTypes = NotificationTypes.All;

  protected badgeQuery = new QueryController<NotificationsResultType>(this);

  private handleRefresh = () => {
    this.badgeQuery.result.refetch();
  };

  #unsubscribeToRealtime?: () => void;

  protected override async willUpdate(changedProperties: PropertyValueMap<this & WeavyContextProps>) {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("weavyContext") || changedProperties.has("typeFilter") || changedProperties.has("app")) && this.weavyContext ) {
      this.badgeQuery.trackQuery(getBadgeOptions(this.weavyContext, this.typeFilter, this.app?.id), true);
    }

    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.#unsubscribeToRealtime?.();

      this.weavyContext.subscribe(null, "notification_created", this.handleRefresh);
      this.weavyContext.subscribe(null, "notification_updated", this.handleRefresh);
      //this.weavyContext.subscribe(null, "notification_deleted", this.handleRefresh);
      this.weavyContext.subscribe(null, "notifications_marked", this.handleRefresh);

      this.#unsubscribeToRealtime = () => {
        this.weavyContext?.unsubscribe(null, "notification_created", this.handleRefresh);
        this.weavyContext?.unsubscribe(null, "notification_updated", this.handleRefresh);
        //this.weavyContext?.unsubscribe(null, "notification_deleted", this.handleRefresh);
        this.weavyContext?.unsubscribe(null, "notifications_marked", this.handleRefresh);
        this.#unsubscribeToRealtime = undefined;
      }
    }
  }

  override render() {
    const { data, isPending } = this.badgeQuery.result ?? {};

    const truncatedCount = data?.count ? data.count >= 100 ? "99+" : data.count : "";

    return html`
      ${this.user && !isPending && data?.count
        ? html`
          <span class="wy-badge ${this.settings?.notificationsBadge === "count" ? "wy-button-badge" : "wy-button-dot"}" title=${data?.count}>${truncatedCount}</span> 
        `
        : nothing}
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
