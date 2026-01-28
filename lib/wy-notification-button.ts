import { type PropertyValueMap, html, nothing } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import type { OverlayAppearanceType, BadgeAppearanceType, PositionType } from "./types/ui.types";
import { NotificationTypes } from "./types/notifications.types";
import {} from "./types/app.types";
import {
  UnreadNotificationsController,
  NotificationFilterProps,
  UnreadNotificationsProps,
} from "./controllers/unread-notifications-controller";
import { NotificationFilterEventType } from "./types/notifications.events";
import { WeavyOptionalAppComponent } from "./classes/weavy-optional-app-component";
import { ThemeController } from "./controllers/theme-controller";

import hostContentsCss from "./scss/host-contents.scss";
import colorModesCss from "./scss/color-modes.scss";
import hostFontCss from "./scss/host-font.scss";

import "./components/ui/wy-icon";
import "./components/ui/wy-button";
import "./components/ui/wy-container";
import "./components/ui/wy-overlay";
import "./components/wy-notification-list";
import "./components/ui/wy-badge";
import "./components/ui/wy-dropdown";

declare global {
  interface HTMLElementTagNameMap {
    "wy-notification-button": WyNotificationButton;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyLinkEventType } from "./types/notifications.events"
 * @import { WyUnreadEventType } from "./types/ui.events"
 * @import { WyActionEventType } from "./types/action.events"
 */

/**
 * Weavy notification button component to render a button complete with a realtime badge for the number of unread notifications. When clicking the button, it opens a built in overlay displaying the full list of notifications.
 *
 * Weavy automatically creates notifications for reactions, mentions and other activities.
 *
 * The notifications can be clicked or marked as read or unread. When clicked the notification fires a `"wy-link"` event with information about the originating Weavy component for the notification.
 * This can be used to [handle navigation](https://www.weavy.com/docs/learn/notifications) in the app, back to where the originating Weavy component is placed.
 *
 * The notification button component can optionally be tailored to only show notifications for a specific app or notifications of a specific type, such as _mentions_ or _reactions_. 
 * When setting a predefined notification type, it removes the possibility for the user to filter the list by type in the UI.
 *
 * > Complement this with the [`<wy-notification-toasts>`](./wy-notification-toasts.ts) component to also get realtime _in-app notifications_ or _browser notifications_.
 *
 * **Component Layout**
 *
 * The button is displayed as a clickable icon that acts as a button.
 * The default size of the button is the icon size `1.5rem`/`24px` together with the set `--wy-padding` (which defaults to `0.5rem`/`8px`) on every side of the icon, which makes a total of `2.5rem`/`40px` per default.
 *
 * The openable notification list renders in an overlay in the [top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer).
 * That means that the notification list does not occupy any visual layout space where it's placed in the DOM, it only renders in the top layer.
 *
 * You can add additional styling using _CSS Custom Properties_ and _CSS Shadow Parts_ and further customization using _slots_.
 *
 * **Used sub components:**
 *
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-container>`](./ui/wy-container.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-overlay>`](./ui/wy-overlay.ts)
 * - [`<wy-notification-header>`](./wy-notification-list.ts)
 * - [`<wy-notification-list>`](./wy-notification-list.ts)
 * - [`<wy-badge>`](./ui/wy-badge.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-dropdown-item>`](./ui/wy-dropdown.ts)
 * - [`<wy-empty>`](./wy-empty.ts)
 *
 * @tagname wy-notification-button
 * @slot actions - Slot for action buttons in the notification list header.
 * @slot title - Slot for title in the notification list header.
 * @fires {WyActionEventType} wy-action - Emitted when a notification is selected.
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyLinkEventType} wy-link - Fired when a notification is clicked.
 * @fires {WyUnreadEventType} wy-unread - Fired when the number of unread notifications change.
 *
 * @example <caption>Notification button with notification list overlay</caption>
 *
 * Display notification button with a badge that tracks notifications for the authenticated user and can open an overlay with a notification list on click.
 *
 * ```html
 * <wy-notification-button></wy-notification-button>
 * ```
 *
 * @example <caption>Filter notifications by app</caption>
 * 
 * Display notifications for the authenticated user that originated from app with the specified `uid`. Also, show a dot instead of a count when there are unread notifications.
 *
 * ```html
 * <wy-notification-button uid="test-chat" badge="dot"></wy-notification-button>
 * ```
 *
 * @example <caption>Styling the badge</caption>
 *
 * Changes the styles of the badge in the notification button.  Set the background color of the `wy-badge` CSS shadow part.
 *
 * ```css
 * wy-notification-button::part(wy-badge) {
 *   background-color: violet;
 * }
 * ```
 */
@customElement("wy-notification-button")
@localized()
export class WyNotificationButton
  extends WeavyOptionalAppComponent
  implements UnreadNotificationsProps, NotificationFilterProps
{
  static override styles = [hostContentsCss, colorModesCss, hostFontCss];

  /** @internal */
  protected theme = new ThemeController(this, WyNotificationButton.styles);

  /** @internal */
  protected unreadNotifications: UnreadNotificationsController = new UnreadNotificationsController(this);

  /**
   * Overlay appearance used for the notification list.
   *
   * @type {"modal" | "sheet" | "drawer" | "full" | "none"}
   * @default "sheet"
   */
  @property({ type: String })
  overlay: OverlayAppearanceType = "sheet";

  /**
   * Overlay appearance used for the notification list.
   *
   * @deprecated
   * @internal
   * @type {"modal" | "sheet" | "drawer" | "full" | "none"}
   * @default "sheet"
   */
  @property({ type: String })
  set list(list: OverlayAppearanceType) {
    console.warn(`.list is deprecated. Use .overlay = "${list}"; instead`);
    this.overlay = list;
  }
  get list() {
    return this.overlay;
  }

  /**
   * Notification badge appearance variant.
   *
   * @type {"count" | "compact" | "dot" | "none"}
   * @default "count"
   */
  @property({ type: String })
  badge: BadgeAppearanceType = "compact";

  /**
   * Set the position of the badge. `"inline"` means no positioning.
   *
   * @type {"inline" | "top-right" | "bottom-right" | "bottom-left" | "top-left"}
   * @default "top-right"
   */
  @property({ type: String })
  badgePosition: PositionType = "top-right";

  /**
   * Notification type filter. No filter (`""`) will allow the user to filter.
   *
   * @type {"" | "activity" | "mention" | "reaction"}
   * @default ""
   */
  @property()
  typeFilter: NotificationTypes = NotificationTypes.All;

  /** @internal */
  @state()
  currentTypeFilter: NotificationTypes = NotificationTypes.All;

  /** @internal */
  @state()
  showNotificationList = false;

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
    const showNotificationHeader = this.typeFilter === NotificationTypes.All;

    return html`
      <wy-button
        kind="icon"
        ?active=${this.showNotificationList}
        @click=${() => (this.showNotificationList = !this.showNotificationList)}
      >
        <wy-icon name="bell">
          ${this.user && this.badge !== "none"
            ? html`
                <wy-badge
                  appearance=${this.badge}
                  position=${this.badgePosition}
                  .count=${this.unreadNotifications.isUnreadPending ? NaN : this.unreadNotifications.unread}
                ></wy-badge>
              `
            : nothing}
        </wy-icon>
      </wy-button>

      ${this.overlay !== "none"
        ? html`<wy-overlay
            type=${this.overlay}
            .show=${this.showNotificationList}
            @close=${() => (this.showNotificationList = false)}
          >
            <slot name="actions" slot="actions">
              <wy-button kind="icon" @click=${() => this.markAllAsRead()} title=${msg("Mark all as read")}>
                <wy-icon name="check-all"></wy-icon>
              </wy-button>
              ${this.app
                ? html`
                    <wy-dropdown>
                      ${this.app?.is_subscribed
                        ? html`
                            <wy-dropdown-item @click=${() => this.subscribe(false)}>
                              <wy-icon name="bell-off"></wy-icon>
                              ${msg("Unsubscribe")}
                            </wy-dropdown-item>
                          `
                        : html`
                            <wy-dropdown-item @click=${() => this.subscribe(true)}>
                              <wy-icon name="bell"></wy-icon>
                              ${msg("Subscribe")}
                            </wy-dropdown-item>
                          `}
                    </wy-dropdown>
                  `
                : nothing}
            </slot>
            <slot slot="title">${msg("Notifications")}</slot>
            <wy-container scrollY>
              ${this.showNotificationList
                ? html`
                    ${showNotificationHeader
                      ? html`
                          <wy-notification-header
                            @filter=${(e: NotificationFilterEventType) => {
                              this.currentTypeFilter = e.detail.typeFilter;
                            }}
                          ></wy-notification-header>
                        `
                      : nothing}
                    <wy-notification-list typeFilter=${this.currentTypeFilter}>
                      ${this.app && !this.app?.is_subscribed
                        ? html`
                            <wy-empty slot="empty">
                              <div>${msg("You are not subscribed to updates yet.")}</div>
                              <wy-button color="primary" @click=${() => this.subscribe(true)}
                                >${msg("Subscribe")}</wy-button
                              >
                            </wy-empty>
                          `
                        : nothing}
                    </wy-notification-list>
                  `
                : nothing}
            </wy-container>
          </wy-overlay>`
        : nothing}
    `;
  }
}
