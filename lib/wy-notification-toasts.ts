import { type PropertyValueMap, html, nothing } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { localized } from "@lit/localize";
import { ThemeController } from "./controllers/theme-controller";
import { FormattedNotificationType, NotificationType, NotificationTypes } from "./types/notifications.types";
import { WyNotificationEventType } from "./types/notifications.events";
import { repeat } from "lit/directives/repeat.js";
import { getMarkNotificationMutation } from "./data/notifications";
import { RealtimeNotificationEventType } from "./types/realtime.types";
import { dispatchLinkEvent, getNotificationText } from "./utils/notifications";
import { NamedEvent } from "./types/generic.types";
import { WeavyOptionalAppComponent } from "./classes/weavy-optional-app-component";

import colorModesCss from "./scss/color-modes.scss";
import hostFontCss from "./scss/host-font.scss";
import hostContentsCss from "./scss/host-contents.scss";

import "./components/wy-notification-list-item";
import { WyToast } from "./components/ui/wy-toast";

declare global {
  interface HTMLElementTagNameMap {
    "wy-notification-toasts": WyNotificationToasts;
  }
}

/**
 * @import { WyLinkEventType } from "./types/notifications.events"
 */

/**
 * Weavy notification toast component to show overlay toasts in realtime when notifications are received. It shows in-app rendered notifications, native [browser notifications](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API) or just provide notification events without rendering.
 *
 * When in-app notifications are used, each notification is displayed with an avatar, a title, and additional summary/details with formatted text. 
 * When clicked the notification fires a `"wy-link"` event with information about the originating Weavy component for the notification. 
 * This can be used to [handle navigation](https://www.weavy.com/docs/learn/notifications) in the app, and navigate back to where the originating Weavy component is placed.
 * 
 * **Component Layout**
 * 
 * When used with _in-app_ notifications, the notifications renders as overlays in the lower right corner of the [top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer). 
 * That means that the component does not occupy any visual layout space where it's placed in the DOM, it only renders in the top layer. 
 * 
 * You can add additional styling using _CSS Custom Properties_ and _CSS Shadow Parts_ and further customization using _slots_.
 *
 * **Used sub components:**
 *
 * - [`<wy-toasts>`](./components/ui/wy-toast.ts)
 * - [`<wy-toast>`](./components/ui/wy-toast.ts)
 * - [`<wy-notification-list-item>`](./components/wy-notification-list-item.ts)
 * 
 * @tagname wy-notification-toasts
 * @fires {WyLinkEventType} wy-link  - Fired when a notification is clicked.
 * @fires {WyNotificationEventType} wy-notification - Fired when a notification should be shown.
 * 
 * @example <caption>In-app notifications</caption>
 * 
 * Display rich html notification toasts on your page.
 * 
 * ```html
 * <wy-notification-toasts></wy-notification-toasts>
 * ```
 * 
 * @example <caption>Browser notifications</caption>
 * 
 * Display notifications using the native browser notification API.
 * 
 * ```html
 * <wy-notification-toasts appearance="native"></wy-notification-toasts>
 * ```
 */
@customElement("wy-notification-toasts")
@localized()
export class WyNotificationToasts extends WeavyOptionalAppComponent {
  static override styles = [colorModesCss, hostContentsCss, hostFontCss];

  /** @internal */
  protected theme = new ThemeController(this, WyNotificationToasts.styles);

  /**
   * Notification types to display.
   *
   * @type {"" | "activity" | "mention" | "reaction"}
   * @default ""
   */
  @property()
  typeFilter: NotificationTypes = NotificationTypes.All;

  /**
   * Notification delivery mode.
   *
   * - `internal` renders in-app toasts.
   * - `native` uses browser notifications.
   * - `none` only emits notification events.
   */
  @property()
  appearance: "internal" | "native" | "none" = "internal";

  /**
   * Require user consent before showing internal notifications. Native notifications always prompt automatically.
   */
  @property({ type: Boolean })
  requestUserPermission: boolean = false;

  /**
   * Duration in milliseconds for internal toast visibility.
   */
  @property({ type: Number })
  duration: number = WyToast.defaultDuration;

  /** @internal */
  @state()
  protected _notifications: NotificationType[] = [];

  /** @internal */
  protected _nativeNotifications: Notification[] = [];

  /** @internal */
  protected markNotificationMutation?: ReturnType<typeof getMarkNotificationMutation>;

  /** @internal */
  protected handleEvent = async (e: RealtimeNotificationEventType) => {
    if (this.typeFilter === NotificationTypes.All || this.typeFilter === e.notification.type) {
      if (e.action === "notification_deleted") {
        this.removeNotification(e.notification.id);
        this.closeNativeNotification(e.notification.id);
      } else {
        const { title, detail } = getNotificationText(e.notification);

        const formattedNotification: FormattedNotificationType = {
          ...e.notification,
          title,
          detail,
          lang: this.weavy?.locale,
        };

        const notificationEvent: WyNotificationEventType = new (CustomEvent as NamedEvent)("wy-notification", {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: formattedNotification,
        });

        /**
         * `wy-notification` event with formatted notification data.
         * Use preventDefault to prevent notifications from being displayed.
         * The event waits for user consent if required.
         * @fires wy-notification
         */
        const notificationShouldDisplay =
          (!this.requestUserPermission && this.appearance !== "native") || (await this.hasUserPermission())
            ? this.dispatchEvent(notificationEvent)
            : false;

        if (notificationShouldDisplay) {
          if (e.action === "notification_created" && e.notification.is_unread) {
            await this.addOrUpdateNotification(e.notification);
          } else {
            await this.updateNotification(e.notification);
          }
          await this.addOrUpdateNativeNotification(formattedNotification);
        }
      }
    }
  };

  /** @internal */
  async addOrUpdateNotification(notification: NotificationType) {
    if (!this.requestUserPermission || (await this.hasUserPermission())) {
      const updatedNotifications = [...this._notifications];
      const existingNotificationIndex = updatedNotifications.findIndex((n) => n.id === notification.id);

      if (existingNotificationIndex !== -1) {
        updatedNotifications.splice(existingNotificationIndex, 1, notification);
        this._notifications = updatedNotifications;
      } else {
        updatedNotifications.push(notification);
        this._notifications = updatedNotifications;
      }
    }
  }

  /** @internal */
  async updateNotification(notification: NotificationType) {
    if (!this.requestUserPermission || (await this.hasUserPermission())) {
      const updatedNotifications = [...this._notifications];
      const existingNotificationIndex = updatedNotifications.findIndex((n) => n.id === notification.id);

      if (existingNotificationIndex !== -1) {
        updatedNotifications.splice(existingNotificationIndex, 1, notification);
        this._notifications = updatedNotifications;
      }
    }
  }

  /** @internal */
  removeNotification(notificationId: number) {
    const updatedNotifications = [...this._notifications];
    const existingNotificationIndex = updatedNotifications.findIndex((n) => n.id === notificationId);
    if (existingNotificationIndex !== -1) {
      updatedNotifications.splice(existingNotificationIndex, 1);
      this._notifications = updatedNotifications;
    }
  }

  /** @internal */
  async addOrUpdateNativeNotification(formattedNotification: FormattedNotificationType) {
    if (this.appearance === "native" && (await this.hasUserPermission())) {
      const updatedExistingNotification = this.removeNativeNotification(formattedNotification.id);
      const otherMember = formattedNotification.actor;
      const nativeNotification = new Notification(formattedNotification.title, {
        tag: `wy-${formattedNotification.id}`,
        lang: formattedNotification.lang,
        body: formattedNotification.detail,
        icon: otherMember.avatar_url,
        // @ts-expect-error Property `renotify` not available in ts types yet
        renotify: updatedExistingNotification && formattedNotification.is_unread,
      });

      nativeNotification.onclick = async () => {
        await this.markAsRead(formattedNotification.id, true);
        await dispatchLinkEvent(this, this.weavy, formattedNotification);
      };

      nativeNotification.onclose = () => {
        this.removeNativeNotification(formattedNotification.id);
      };

      this._nativeNotifications = [...this._nativeNotifications, nativeNotification];
    }
  }

  /** @internal */
  removeNativeNotification(notificationId: number) {
    const updatedNativeNotifications = [...this._nativeNotifications];
    const existingNativeNotificationIndex = updatedNativeNotifications.findIndex(
      (n) => n.tag === `wy-${notificationId}`
    );
    if (existingNativeNotificationIndex) {
      updatedNativeNotifications.splice(existingNativeNotificationIndex, 1);
      this._nativeNotifications = updatedNativeNotifications;
      return true;
    }
    return false;
  }

  /** @internal */
  closeNativeNotification(notificationId: number) {
    const existingNativeNotificationIndex = this._nativeNotifications.findIndex(
      (n) => n.tag === `wy-${notificationId}`
    );
    if (existingNativeNotificationIndex) {
      this._nativeNotifications[existingNativeNotificationIndex].close();
      return true;
    }
    return false;
  }

  /** Checks if the user has granted permission for desktop notifications. A request will be made if permission has not yet been granted. */
  async hasUserPermission() {
    if (!("Notification" in window)) {
      console.error("This browser does not support desktop notifications");
    } else if (!window.isSecureContext) {
      console.error(
        `Desktop notifications can only be used in secure contexts. 
        See https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts`
      );
    } else if (Notification.permission === "granted") {
      return true;
    } else if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
    // Unavailable or the user has denied notifications
    return false;
  }

  /** Clears queued internal toast notifications. */
  clearNotifications() {
    this._notifications = [];
  }

  /**
   * Marks a notification as read or unread.
   * @param notificationId - The ID of the notification to mark.
   * @param [markAsRead=true] - Whether to mark the notification as read (true) or unread (false).
   */
 async markAsRead(notificationId: number, markAsRead: boolean = true ) {
    await this.markNotificationMutation?.mutate({ notificationId, markAsRead });
  }

  #unsubscribeToRealtime?: () => void;

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    await super.willUpdate(changedProperties);

    if (changedProperties.has("weavy") && this.weavy) {
      this.markNotificationMutation = getMarkNotificationMutation(this.weavy);

      this.#unsubscribeToRealtime?.();

      void this.weavy.subscribe(null, "notification_created", this.handleEvent);
      void this.weavy.subscribe(null, "notification_updated", this.handleEvent);
      //this.weavy.subscribe(null, "notification_deleted", this.handleEvent);

      this.#unsubscribeToRealtime = () => {
        void this.weavy?.unsubscribe(null, "notification_created", this.handleEvent);
        void this.weavy?.unsubscribe(null, "notification_updated", this.handleEvent);
        //this.weavy?.unsubscribe(null, "notification_deleted", this.handleEvent);
        this.#unsubscribeToRealtime = undefined;
      };
    }

    if (
      (changedProperties.has("requestUserPermission") && this.requestUserPermission) ||
      (changedProperties.has("appearance") && this.appearance === "native")
    ) {
      void this.hasUserPermission();
    }
  }

  override render() {
    return html`
      ${this.user && this.appearance === "internal"
        ? html`
            <wy-toasts ?show=${Boolean(this._notifications.length)} @hide=${() => this.clearNotifications()}>
              ${repeat(
                this._notifications,
                (notification) => notification.id,
                (notification) => {
                  return html`
                    <wy-toast
                      duration=${this.duration}
                      @closed=${(e: CustomEvent<{ silent: boolean }>) => {
                        if (!e.detail.silent) {
                          void this.markAsRead(notification.id, true);
                        }
                        this.removeNotification(notification.id);
                      }}
                    >
                      <wy-notification-list-item standalone .notification=${notification}></wy-notification-list-item>
                    </wy-toast>
                  `;
                }
              )}
            </wy-toasts>
          `
        : nothing}
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
