import { html } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { localized } from "@lit/localize";
import { ThemeController } from "./controllers/theme-controller";
import { WeavyComponent } from "./classes/weavy-component";
import WyNotificationList from "./components/wy-notification-list";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import colorModesStyles from "./scss/color-modes.scss";
import allStyles from "./scss/all.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostScrollYStyles from "./scss/host-scroll-y.scss";
import hostFontStyles from "./scss/host-font.scss";
import { ComponentType } from "./types/app.types";

import "./components/wy-notification-list";
import "./components/wy-empty";
import "./components/base/wy-spinner";

export const WY_NOTIFICATIONS_TAGNAME = "wy-notifications";

declare global {
  interface HTMLElementTagNameMap {
    [WY_NOTIFICATIONS_TAGNAME]: WyNotifications;
  }
}

/**
 * Weavy component to render a list of notifications.
 *
 * @element wy-notifications
 * @class WyNotifications
 * @extends {WeavyComponent}
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyLinkEventType} wy-link - Fired when a notification is clicked.
 */
@customElement(WY_NOTIFICATIONS_TAGNAME)
@localized()
export class WyNotifications extends WeavyComponent {
  static override styles = [colorModesStyles, allStyles, hostBlockStyles, hostScrollYStyles, hostFontStyles];

  override componentType = ComponentType.Unknown;

  protected theme = new ThemeController(this, WyNotifications.styles);
  protected notificationsRef: Ref<WyNotificationList> = createRef();

  /**
   * Mark all events as read.
   */
  async markAllAsRead() {
    await this.notificationsRef.value?.markAllAsRead();
  }

  override render() {
    return html`
      ${this.user
        ? html` <wy-notification-list ${ref(this.notificationsRef)}></wy-notification-list> `
        : html`
            <wy-empty>
              <wy-spinner padded reveal></wy-spinner>
            </wy-empty>
          `}
    `;
  }
}
