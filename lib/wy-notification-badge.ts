import { type PropertyValueMap, html, nothing } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ShadowPartsController } from "./controllers/shadow-parts-controller";
import type { BadgeAppearanceType, PositionType } from "./types/ui.types";
import { NotificationTypes } from "./types/notifications.types";
import { WeavyOptionalAppComponent } from "./classes/weavy-optional-app-component";
import {
  UnreadNotificationsController,
  NotificationFilterProps,
  UnreadNotificationsProps,
} from "./controllers/unread-notifications-controller";

import hostFlexCss from "./scss/host-flex.scss";
import colorModesCss from "./scss/color-modes.scss";
import hostFontCss from "./scss/host-font.scss";

import "./components/ui/wy-badge";

declare global {
  interface HTMLElementTagNameMap {
    "wy-notification-badge": WyNotificationBadge;
  }
}

/**
 * Weavy component that displays a notification badge.
 *
 * **Used sub components:**
 *
 * - [`<wy-badge>`](./components/ui/wy-badge.ts)
 *
 * @tagname wy-notification-badge
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyUnreadEventType} wy-unread - Fired when the number of unread notifications change.
 */
@customElement("wy-notification-badge")
export class WyNotificationBadge extends WeavyOptionalAppComponent implements UnreadNotificationsProps, NotificationFilterProps {
  static override styles = [hostFlexCss, colorModesCss, hostFontCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);
  
  /** @internal */
  protected unreadNotifications: UnreadNotificationsController = new UnreadNotificationsController(this);

  /**
   * Display size of the badge.
   *
   * @type {"count" | "compact" | "dot" | "none"}
   * @default "count"
   */
  @property({ type: String })
  badge: BadgeAppearanceType = "count";

  /**
   * Positioning of the badge.
   *
   * @type {"inline" | "top-right" | "bottom-right" | "bottom-left" | "top-left"}
   * @default "inline"
   */
  @property({ type: String })
  badgePosition: PositionType = "inline";

  /**
   * Notification type filter used when tracking unread notifications.
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

    if (changedProperties.has("typeFilter") || changedProperties.has("app")) {
      await this.unreadNotifications.track(this.typeFilter, this.app?.id);
    }
  }

  override render() {
    return this.user && this.badge !== "none"
      ? html`
          <wy-badge
            appearance=${this.badge}
            position=${this.badgePosition}
            .count=${this.unreadNotifications.isUnreadPending ? NaN : this.unreadNotifications.unread}
          ></wy-badge>
        `
      : nothing;
  }
}
