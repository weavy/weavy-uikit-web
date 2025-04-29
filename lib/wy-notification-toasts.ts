import { PropertyValues, html, nothing } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { localized } from "@lit/localize";
import { ThemeController } from "./controllers/theme-controller";
import { WeavyComponent } from "./classes/weavy-component";
import { ComponentType } from "./types/app.types";
import { FormattedNotificationType, NotificationType, NotificationTypes } from "./types/notifications.types";
import { WyNotificationEventType } from "./types/notifications.events";
import { repeat } from "lit/directives/repeat.js";
import { getMarkNotificationMutation } from "./data/notifications";
import { RealtimeNotificationEventType } from "./types/realtime.types";
import { WeavyProps } from "./types/weavy.types";
import { dispatchLinkEvent, getBotName, getNotificationText } from "./utils/notifications";
import { NamedEvent } from "./types/generic.types";

import colorModesStyles from "./scss/color-modes.scss";
import hostFontStyles from "./scss/host-font.scss";
import hostContentsStyles from "./scss/host-contents.scss";

import "./components/wy-notification-list-item";
import { WyToast } from "./components/base/wy-toast";

export const WY_NOTIFICATION_TOASTS_TAGNAME = "wy-notification-toasts";

declare global {
  interface HTMLElementTagNameMap {
    [WY_NOTIFICATION_TOASTS_TAGNAME]: WyNotificationToasts;
  }
}

/**
 * Weavy component to show notification toast in realtime. May show rendered notifications, native browser notifications or just provide notification events.
 *
 * @element wy-notification-toasts
 * @class WyNotificationToasts
 * @extends {WeavyComponent}
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyNotificationEventType} wy-notification - Fired when a notification should be shown.
 * @fires {WyLinkEventType} wy-link  - Fired when a notification is clicked.
 */
@customElement(WY_NOTIFICATION_TOASTS_TAGNAME)
@localized()
export class WyNotificationToasts extends WeavyComponent {
  static override styles = [colorModesStyles, hostContentsStyles, hostFontStyles];

  override componentType = ComponentType.Unknown;

  protected theme = new ThemeController(this, WyNotificationToasts.styles);

  /**
   * What type of notifications to display.
   *
   * @type "" | "activity" | "mention" | "reaction"
   */
  @property()
  typeFilter: NotificationTypes = NotificationTypes.All;

  /**
   * Sets the kind of notifications to use.
   * - "internal" - Use HTML notifications.
   * - "native" - Use browser notifications.
   * - "none" - Only use notification events.
   */
  @property()
  appearance: "internal" | "native" | "none" = "internal";

  /**
   * Require the user to consent to notifications.
   * This in only affective with appearance =  "internal", since "native" always requires user consent.
   *
   * @type Boolean
   */
  @property({ type: Boolean })
  requestUserPermission: boolean = false;

  /**
   * Sets the duration in ms of the *internal* notification toasts. Defaults to 5000.
   */
  @property({ type: Number })
  duration: number = WyToast.defaultDuration;

  @state()
  protected _notifications: NotificationType[] = [];

  _nativeNotifications: Notification[] = [];

  protected markNotificationMutation?: ReturnType<typeof getMarkNotificationMutation>;

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

        // Populate bot
        formattedNotification.link.bot = getBotName(formattedNotification);

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

  removeNotification(notificationId: number) {
    const updatedNotifications = [...this._notifications];
    const existingNotificationIndex = updatedNotifications.findIndex((n) => n.id === notificationId);
    if (existingNotificationIndex !== -1) {
      updatedNotifications.splice(existingNotificationIndex, 1);
      this._notifications = updatedNotifications;
    }
  }

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
        await this.handleMark(true, formattedNotification.id);
        await dispatchLinkEvent(this, this.weavy, formattedNotification);
      };

      nativeNotification.onclose = () => {
        this.removeNativeNotification(formattedNotification.id);
      };

      this._nativeNotifications = [...this._nativeNotifications, nativeNotification];
    }
  }

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

  clearNotifications() {
    this._notifications = [];
  }

  private async handleMark(markAsRead: boolean, notificationId: number) {
    await this.markNotificationMutation?.mutate({ markAsRead: markAsRead, notificationId });
  }

  #unsubscribeToRealtime?: () => void;

  protected override async willUpdate(changedProperties: PropertyValues<this & WeavyProps>): Promise<void> {
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
                          void this.handleMark(true, notification.id);
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
