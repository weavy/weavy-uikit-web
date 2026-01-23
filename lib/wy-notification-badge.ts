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
 * Weavy notification badge component that renders a realtime badge for the number of unread notifications.
 * The badge fits well into a button or similar.
 * Weavy automatically creates notifications for reactions, mentions and other activities.
 *
 * The badge can optionally be provided with an app `uid` or a `typeFilter` to only display the unread count of a given app or a given notification type, such as _mention_, _reaction_ or _activity_.
 *  
 * When the `unread` count property changes, the component fires a `"wy-unread"` event with the updated count.
 * You can listen to the event to use the unread count for something else, and you can also turn off the component rendering by setting the `badge` property to `"none"`.
 * 
 * ** Component layout **
 *
 * The badge displays as an inline badge, matching normal text per default.
 * It has a filled background with rounded edge.
 * The size and font-size is relative to the current font-size where it's placed, defaulting to `0.75em` for the badge `font-size` and `0.3333em` of the badge *font-size* for the `padding`.
 * The badge is only displayed when there is an unread count of 1 or higher.
 *
 * > When placing the badge in a `<button>` element, note that buttons initially have a `font-size` of `13.3333px` instead of inheriting font-size from it's parents.
 *
 * Setting the `badge` property to `"compact"` reduces the padding and size to occupy less visual space.
 * It can also be set to `"dot"` to remove the text, only indicating that there is unread notifications without any count.
 *
 * The `badgePosition` property can be changed from `"inline"` to `"top-right"` or any other corner,
 * to give it absolute positioning over the top-right corner.
 * The absolute positioning is relative to the closest parent element with set CSS `position`, for instance `relative` positioning.
 *
 * **Used sub components:**
 *
 * - [`<wy-badge>`](./components/ui/wy-badge.ts)
 *
 * @tagname wy-notification-badge
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyUnreadEventType} wy-unread - Fired when the number of unread notifications change.
 *
 * @example <caption>Inline notification badge in a text</caption>
 *
 * Display a badge that shows unread count and tracks notifications for the authenticated user.
 * 
 * ```html
 * <div>Notifications <wy-notification-badge></wy-notification-badge></div>
 * ```
 *
 * @example <caption>Filtered notification badge</caption>
 * 
 * Only displays the count for _reactions_ that originated from the `"test-chat"` app component.
 * 
 * ```html
 *  <wy-notification-badge uid="test-chat" typeFilter="reaction"></wy-notification-badge>
 * ```
 * 
 * @example <caption>Compact cornered notification badge</caption>
 *
 * Displays a _compact_ badge in the top-right corner of a button with adjusted font-size.
 * Note that the badge position is relative to its closest positioned ancestor element, therefore we need to set CSS `position` on the button.
 *
 * ```html
 * <button style="position: relative; font-size: 1rem;">
 *   <span>Notifications</span>
 *   <wy-notification-badge badge="compact" badgePosition="top-right"></wy-notification-badge>
 * </button>
 * ```
 */
@customElement("wy-notification-badge")
export class WyNotificationBadge
  extends WeavyOptionalAppComponent
  implements UnreadNotificationsProps, NotificationFilterProps
{
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
