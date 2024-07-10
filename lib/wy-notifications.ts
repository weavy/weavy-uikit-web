import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import { ThemeController } from "./controllers/theme-controller";
import { BlockProviderMixin } from "./mixins/block-mixin";
import { Constructor } from "./types/generic.types";
import WyNotificationList from "./components/wy-notification-list";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { ContextualTypes } from "./types/app.types";

import colorModesStyles from "./scss/color-modes";
import allStyles from "./scss/all";
import { blockStyles } from "./scss/block";
import { hostScrollYStyles } from "./scss/host";

import "./components/wy-notification-list";
import "./components/wy-empty";
import "./components/wy-spinner";

@customElement("wy-notifications")
@localized()
export class WyNotifications extends BlockProviderMixin(LitElement) {
  static override styles = [colorModesStyles, allStyles, blockStyles, hostScrollYStyles];

  /**
   * Unknown ContextualType will enable optional uid.
   * @ignore
   */
  override contextualType = ContextualTypes.Unknown;

  protected notificationsRef: Ref<WyNotificationList> = createRef();

  constructor() {
    super();
    new ThemeController(this, WyNotifications.styles);
  }

  /**
   * Mark all events as read.
   */
  markAllAsRead() {
    this.notificationsRef.value?.markAllRead();
  }

  override render() {
    return html`
      <header class="wy-appbars">
        <nav class="wy-appbar">
          <wy-avatar .src=${this.user?.avatar_url} .name=${this.user?.display_name} .size=${24}></wy-avatar>
          <div class="wy-appbar-text">${msg("Notifications")}</div>
          <wy-button kind="icon" @click=${() => this.markAllAsRead()}>
            <wy-icon name="check-all"></wy-icon>
          </wy-button>
        </nav>
      </header>

      ${this.user
        ? html` <wy-notification-list ${ref(this.notificationsRef)}></wy-notification-list> `
        : html`
            <wy-empty>
              <wy-spinner padded></wy-spinner>
            </wy-empty>
          `}
    `;
  }
}

export type WyNotificationsType = Constructor<WyNotifications>;
