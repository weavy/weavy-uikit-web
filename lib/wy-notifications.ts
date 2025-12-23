import { html, nothing, PropertyValueMap } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { localized, msg } from "@lit/localize";
import { ThemeController } from "./controllers/theme-controller";
import { property, state } from "lit/decorators.js";
import {
  UnreadNotificationsController,
  NotificationFilterProps,
  UnreadNotificationsProps,
} from "./controllers/unread-notifications-controller";
import { NotificationTypes } from "./types/notifications.types";
import { NotificationFilterEventType } from "./types/notifications.events";
import { WeavyOptionalAppComponent } from "./classes/weavy-optional-app-component";

import colorModesCss from "./scss/color-modes.scss";
import hostBlockCss from "./scss/host-block.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostScrollYCss from "./scss/host-scroll-y.scss";
import hostFontCss from "./scss/host-font.scss";

import "./components/ui/wy-button";
import "./components/ui/wy-icon";
import "./components/ui/wy-progress-circular";
import "./components/wy-empty";
import "./components/wy-notification-list";

declare global {
  interface HTMLElementTagNameMap {
    "wy-notifications": WyNotifications;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyLinkEventType } from "./types/notifications.events"
 * @import { WyUnreadEventType } from "./types/ui.events"
 * @import { WyActionEventType } from "./types/action.events"
 */

/**
 * Weavy component to render a list of notifications.
 * 
 * **Used sub components:**
 *
 * - [`<wy-notification-header>`](./components/wy-notification-list.ts)
 * - [`<wy-notification-list>`](./components/wy-notification-list.ts)
 * - [`<wy-button>`](./components/ui/wy-button.ts)
 * - [`<wy-icon>`](./components/ui/wy-icon.ts)
 * - [`<wy-empty>`](./components/wy-empty.ts)
 * - [`<wy-progress-circular>`](./components/ui/wy-progress-circular.ts)
 *
 * @tagname wy-notifications
 * @slot actions - Slot for action buttons in the notification list header. Replaces the default actions.
 * @fires {WyActionEventType} wy-action - Emitted when a notification is selected.
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyLinkEventType} wy-link - Fired when a notification is clicked.
 * @fires {WyUnreadEventType} wy-unread - Emitted when the number of unread notifications change.
 */
@customElement("wy-notifications")
@localized()
export class WyNotifications extends WeavyOptionalAppComponent implements UnreadNotificationsProps, NotificationFilterProps {
  static override styles = [colorModesCss, hostBlockCss, hostPaddedCss, hostScrollYCss, hostFontCss];

  /** @internal */
  protected unreadNotifications = new UnreadNotificationsController(this);
  
  /** @internal */
  protected theme = new ThemeController(this, WyNotifications.styles);

  /** @internal */
  @state()
  currentTypeFilter: NotificationTypes = NotificationTypes.All;

  /**
   * Notification type filter applied when loading notifications.
   *
   * @type {"" | "activity" | "mention" | "reaction"}
   * @default ""
   */
  @property()
  typeFilter: NotificationTypes = NotificationTypes.All;

  /** Current unread notification count. */
  get unread(): number {
    return this.unreadNotifications.unread;
  }

  /** Marks all tracked notifications as read. */
  async markAllAsRead() {
    await this.unreadNotifications.markAllAsRead();
  }

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    await super.willUpdate(changedProperties);

    if (changedProperties.has("typeFilter")) {
      this.currentTypeFilter = this.typeFilter;
    }

    if (changedProperties.has("typeFilter") || changedProperties.has("app")) {
      await this.unreadNotifications.track(this.typeFilter, this.app?.id);
    }
  }

  override render() {
    const showHeader = this.typeFilter === NotificationTypes.All;

    return html`
      ${showHeader
        ? html`
            <wy-notification-header
              @filter=${(e: NotificationFilterEventType) => {
                this.currentTypeFilter = e.detail.typeFilter;
              }}
            >
              <slot name="actions" slot="actions">
                <wy-button kind="icon" @click=${() => this.markAllAsRead()} title=${msg("Mark all as read")}>
                  <wy-icon name="check-all"></wy-icon>
                </wy-button>
              </slot>
            </wy-notification-header>
          `
        : nothing}
      ${this.user
        ? html` <wy-notification-list typeFilter=${this.currentTypeFilter}></wy-notification-list> `
        : html`
            <wy-empty>
              <wy-progress-circular indeterminate padded reveal></wy-progress-circular>
            </wy-empty>
          `}
    `;
  }
}
