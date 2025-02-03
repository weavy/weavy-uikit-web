import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { state } from "lit/decorators.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";
import { WeavyComponentConsumerMixin } from "../classes/weavy-component-consumer-mixin";
import { MutateAppSubscribeContextType, MutateAppSubscribeProps, getAppSubscribeMutationOptions } from "../data/app";
import { MutationController } from "../controllers/mutation-controller";

import "./wy-icon";
import "./wy-button";
import "./wy-sheet";
import WyNotificationList from "./wy-notification-list";
import "./wy-notification-badge";
import "./wy-dropdown";

@customElement("wy-notification-button-list")
@localized()
export default class WyNotificationButtonList extends WeavyComponentConsumerMixin(LitElement) {
  protected exportParts = new ShadowPartsController(this);

  @state()
  showNotifications = false;

  private notificationsRef: Ref<WyNotificationList> = createRef();

  private appSubscribeMutation = new MutationController<
    void,
    Error,
    MutateAppSubscribeProps,
    MutateAppSubscribeContextType
  >(this);

  private handleSubscribe(subscribe: boolean) {
    if (this.app?.id) {
      this.appSubscribeMutation.mutate({ subscribe });
    }
  }

  protected override willUpdate(changedProperties: PropertyValues<this>) {
    if ((changedProperties.has("weavy") || changedProperties.has("app")) && this.weavy && this.app) {
      this.appSubscribeMutation.trackMutation(getAppSubscribeMutationOptions(this.weavy, this.app));
    }
  }

  override render() {
    if (this.settings?.notifications === "none") {
      return nothing;
    }

    return html`
      <wy-button
        kind="icon"
        ?active=${this.showNotifications}
        @click=${() => (this.showNotifications = !this.showNotifications)}
      >
        <wy-icon name="bell"></wy-icon>
        ${this.settings?.notificationsBadge !== "none"
          ? html` <wy-notification-badge></wy-notification-badge> `
          : nothing}
      </wy-button>

      <wy-sheet
        noPadding
        .show=${this.showNotifications}
        @close=${() => (this.showNotifications = false)}
        @release-focus=${() => this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
      >
        <wy-dropdown slot="appbar-buttons" ?disabled=${!this.app}>
          ${this.app?.is_subscribed
            ? html`<wy-dropdown-item @click=${() => this.handleSubscribe(false)}>
                <wy-icon name="bell-off"></wy-icon>
                ${msg("Unsubscribe")}
              </wy-dropdown-item>`
            : html`<wy-dropdown-item @click=${() => this.handleSubscribe(true)}>
                <wy-icon name="bell"></wy-icon>
                ${msg("Subscribe")}
              </wy-dropdown-item>`}
        </wy-dropdown>
        <span slot="appbar-text">${msg("Notifications")}</span>
        ${this.showNotifications
          ? html`
              <wy-notification-list ${ref(this.notificationsRef)}>
                ${!this.app?.is_subscribed
                  ? html`
                      <wy-empty slot="empty">
                          <div>${msg("You are not subscribed to updates yet.")}</div>
                          <wy-button color="primary" @click=${() => this.handleSubscribe(true)}>${msg("Subscribe")}</wy-button>
                      </wy-empty>
                    `
                  : nothing}
              </wy-notification-list>
            `
          : nothing}
      </wy-sheet>
    `;
  }
}
