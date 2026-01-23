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
 * Weavy notifications component to render a list of notifications.
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
 * The component is [block-level](https://developer.mozilla.org/en-US/docs/Glossary/Block-level_content) with pre-defined CSS styling to adapt to flex- and grid-layouts as well as traditional flow-layouts.
 * It's usually recommended to use a proper flex-layout for the container you are placing the component in for a smooth layout integration.
 *
 * The height grows with the content per default. Content is automatically loaded during scrolling when the last content becomes visible (aka infinite scrolling).
 * If placed in a flex- or grid-layout or if an explicit height is set, the component becomes scrollable.
 *
 * The content within the components is per default aligned to the edges of it's own _box_ and designed to not be placed next to a edge or border.
 * It's recommended to adjust the layout with your default padding. Setting the `--wy-padding-outer` to your default padding will allow the component to still fill the are where it's placed,
 * but with proper padding within the scrollable area of the component.
 * If you want to make the component go all the way to the edges without padding or any outermost roundness instead,
 * set `--wy-padding-outer: 0;` and `--wy-border-radius-outer: 0;` to make the component fit nicely with the edge.
 *
 * You can add additional styling using _CSS Custom Properties_ and _CSS Shadow Parts_ and further customization using _slots_.
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
 *
 * @example <caption>Standard notification list</caption>
 *
 * Display a list of all notifications for the authenticated user, placed in a container using a flex layout which the component adapts to.
 *
 * ```html
 * <div style="display: flex; height: 100%;">
 *   <wy-notifications></wy-notifications>
 * </div>
 * ```
 *
 * @example <caption>Filtered notification list by app</caption>
 *
 * Display notifications for the authenticated user that originated from app with the specified `uid`.
 *
 * ```html
 * <wy-notifications uid="test-chat"></wy-notifications>
 * ```
 * 
 * @example <caption>Filtered notification list by type</caption>
 *
 * Display notifications that is of type _mention_ only.
 *
 * ```html
 * <wy-notifications typeFilter="mention"></wy-notifications>
 * ```
 */
@customElement("wy-notifications")
@localized()
export class WyNotifications
  extends WeavyOptionalAppComponent
  implements UnreadNotificationsProps, NotificationFilterProps
{
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
