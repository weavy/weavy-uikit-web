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
import "./components/wy-spinner";

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
 * @fires wy-link
 */
@customElement(WY_NOTIFICATIONS_TAGNAME)
@localized()
export class WyNotifications extends WeavyComponent {
  static override styles = [colorModesStyles, allStyles, hostBlockStyles, hostScrollYStyles, hostFontStyles];

  /**
   * Unknown componentType will enable optional uid.
   * @ignore
   */
  override componentType = ComponentType.Unknown;

  protected notificationsRef: Ref<WyNotificationList> = createRef();

  constructor() {
    super();
    new ThemeController(this, WyNotifications.styles);
  }

  /**
   * Mark all events as read.
   */
  markAllAsRead() {
    this.notificationsRef.value?.markAllAsRead();
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
